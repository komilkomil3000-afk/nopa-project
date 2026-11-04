# Nopa backend load test (sandbox)

Containerized, isolated stress test for the Express + Prisma backend. It finds the concurrent-user
capacity and the first bottlenecks **without touching production data**.

| File | Purpose |
|---|---|
| `../Dockerfile` | Multi-stage production image (`runner`), plus a `migrator` target for `prisma migrate deploy` |
| `docker-compose.yml` | Sandbox: Postgres 15 (named volume) → PgBouncer (transaction mode) → backend, plus Redis, seed, cleanup, k6 |
| `pgbouncer/` | Pooler config that mirrors production's Supavisor on `:6543` |
| `seed.js` | Tagged test data + pre-issued session tokens → `out/` |
| `k6/nopa-load.js` | App-realistic traffic, 50 → 500 concurrent users, p95 < 400 ms |
| `cleanup.js` | Deletes only tagged test rows, in one transaction |
| `sandbox-guard.js` | Refuses to run seed/cleanup against anything that is not the sandbox |

## 1. Safety model (why this cannot hit real data)

1. **Separate database.** The sandbox has its own Postgres container and named volume (`nopa-loadtest_pgdata`).
   Nothing in `docker-compose.yml` knows the production address. Postgres is only published on `127.0.0.1:55432`.
2. **Guarded tools.** `seed.js` and `cleanup.js` exit with code 2 unless *all* of these hold:
   - `LOADTEST_SANDBOX=1` is set;
   - the DB host is `postgres`, `pgbouncer`, `localhost` or `127.0.0.1` (more via `LT_EXTRA_DB_HOSTS`), and never `*.nopa-app.ir`, `supabase` or `pooler`;
   - the database name contains `loadtest`;
   - the DB carries the `loadtest_sandbox` marker row. On first seed, the DB must have no untagged users,
     so a restored production dump is refused even if someone names it `loadtest`.
3. **Tagged writes.** Every row the test creates is findable: users have phones `0900…` (not an allocated
   mobile prefix) and names `LT-…`, and caravans, stations and challenges are titled `LT-…`. Writes during the run
   (submissions, submission events, mentor notifications, login sessions, audit rows) all hang off those rows.
4. **k6 refuses `nopa-app.ir`** as `BASE_URL`, unless you explicitly override it (you should not).
5. **Test-only secrets.** The JWT secrets and DB password in the compose file exist only for the sandbox.
   Tokens signed with them are worthless anywhere else.

All of the above is tested: guards, seed, every k6 endpoint (status codes), and cleanup leaving
`_prisma_migrations` and untagged rows intact. The tests ran against an embedded Postgres; see `AGENT_CHANGELOG.md`.

## 2. Running

```bash
cd admin_panel/loadtest
docker compose up -d --build                 # postgres, pgbouncer, redis, migrate (one-shot), backend
docker compose run --rm seed                 # 600 students, 100 login users, 28 caravans, 8 stations
docker compose run --rm k6                   # ~25 min: steps 50,100,200,300,400,500 (1 min ramp + 3 min hold each)
docker compose run --rm cleanup              # remove test rows, keep schema
docker compose down -v                       # or: throw the whole sandbox away
```

Useful variations:

```bash
docker compose run --rm -e POLL_SECONDS=3 k6            # worst case: WebSocket blocked, app polls every 3 s
docker compose run --rm -e STEPS=100,200 -e HOLD=2m k6  # quick check
LT_PRISMA_CONNECTIONS=20 docker compose up -d backend   # try a bigger Prisma pool
docker compose run --rm cleanup node loadtest/cleanup.js --dry-run
```

**What a "user" is.** One k6 VU is one student with the app open, doing what `app_state_repository.dart`
does. Every `POLL_SECONDS` (15 s with a socket, 3 s without) it requests `/users/me`, `/challenges` and `/notifications`.
Every 10th round it also requests `/lms/stations`, `/my-caravan/banners` and `/caravans`. In 30 % of rounds it reads recent chat
messages (the newest page first, then `afterSeq`). In 2 % of rounds it sends `POST /submissions` (201, or 409 while the
answer is pending review; both are expected). A separate scenario sends one real `POST /auth/login` per second
against its own users. Each VU gets its own client IP through `X-Forwarded-For` (`TRUST_PROXY=uniquelocal`),
as real phones do, so the per-IP auth limiter behaves as in production.

**Resource budget.** The limits model a 2 vCPU / 4 GB VPS: backend 1 CPU / 768 MB, Postgres 1 CPU / 1.5 GB,
PgBouncer 0.25 CPU, and Redis 0.25 CPU. Production runs the DB on its own server; give `postgres` that server's size
to mirror it. For clean numbers, run k6 on a different machine (`BASE_URL=http://<host>:5050`) so it does not
steal CPU from the backend.

## 3. Reading the results

The k6 output ends with p95 per step and a **capacity estimate**: the highest step whose p95 stayed under
400 ms. It also lists the slowest endpoints. Each run's full JSON is saved in `out/summary-*.json`. The run aborts early if
more than 1 % of requests fail for a minute. That is the breaking point.

While the test runs, watch:

```bash
docker stats                                                     # which container hits its CPU/memory limit first
docker compose logs -f backend | grep -iE "P2024|timed out|error"  # P2024 = Prisma pool exhausted
# PgBouncer pools (cl_waiting > 0 = clients queue for a DB connection = pool too small)
docker compose exec postgres psql "postgresql://nopa_lt:lt_only_password@pgbouncer:6543/pgbouncer" -c "SHOW POOLS;"
```

After the test, list the queries that cost the most time:

```sql
-- docker compose exec postgres psql -U nopa_lt nopa_loadtest
SELECT round(total_exec_time) AS total_ms, calls, round(mean_exec_time::numeric, 2) AS mean_ms, left(query, 120)
FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 15;
```

How to read it: if the backend container is at 100 % CPU while Postgres is idle, the limit is Node's single event loop
(JSON serialization, bcrypt, compression). If requests are slow while pools show `cl_waiting` or P2024 errors, the limit is
connections. If Postgres is at 100 %, look at the top queries above.

## 4. Bottleneck remediation checklist

Found by reading the code before any run. The measured one is marked. Confirm them with the run.

- [ ] **`GET /lms/stations` returns the whole LMS tree on every call** (stations → categories → sessions →
      clips → quizzes; about 6 queries). **Measured: 165 KB of JSON for just 3 stations**, so about 440 KB for 8. Every user
      loads it on app start and every ~150 s. It is the same for all students, so cache the serialized response in
      memory per role (admin vs. others, because of the answer-key stripping), with a short TTL (30–60 s). Clear the cache on any
      LMS admin edit. Add an `ETag` so unchanged polls get `304`. Longer term, return a summary list and load a station's
      sessions on demand.
- [ ] **Every authenticated request costs 3 DB round-trips before the handler** (`verifyAccessToken`: user,
      `UserSession` by token, `Blacklist` by IP). Chat routes add a 4th (`requireChatEnabled` reads the user again), and
      `apiLimiter` verifies the JWT a second time. Fixes:
      (a) load the session with `include: { user: true }` in one query;
      (b) keep the IP blacklist as an in-memory set refreshed every 30 s;
      (c) optionally cache successful token checks for 5–10 s, keyed by token and dropped on logout or `tokenVersion` change;
      (d) pass the user from `authenticateJWT` to `requireChatEnabled`.
      Together these cut the per-request DB load by about 2/3.
- [ ] **Login counts `AuditLog` rows by `actorId`, which has no index** (only `createdAt` and `action`). That
      lookup gets slower as the audit log grows. Add a migration with
      `@@index([actorId, action, createdAt])` on `AuditLog`.
- [ ] **bcrypt runs in pure JS (`bcryptjs`, cost 10) on the only event loop.** A wrong password can trigger up to 3
      compares (digit variants). A burst of logins, such as a class starting, stalls every other request. Options: native `bcrypt`
      (runs in libuv's thread pool), or keep the login rate limits strict.
- [ ] **Prisma pool vs. PgBouncer.** Production uses `?pgbouncer=true&connection_limit=10` through Supavisor. Sizing rules:
  - `connection_limit` (per Node process): 10–20. Above ~2× the DB's cores, extra connections only queue inside Postgres.
  - `pool_timeout`: 10 s by default. Under saturation, Prisma throws P2024 instead of queuing forever, which is what you want.
  - Pooler `default_pool_size` ≈ 2–4 × DB CPU cores (20 here). `max_client_conn` ≥ the sum of all `connection_limit` values plus tools.
  - `max_db_connections` must stay below Postgres `max_connections` minus headroom for migrations, backups and admin (we use 40 of 100).
  - In production these are Supavisor settings in Supabase's `.env` (`POOLER_DEFAULT_POOL_SIZE`,
    `POOLER_MAX_CLIENT_CONN`). Change them there and restart the pooler. Keep `pool_mode` = transaction.
  - Never point `DATABASE_URL` at `:5432` for the app. That is `DIRECT_URL`, for migrations only.
- [ ] **One process is the hard ceiling.** Rate-limit counters, the SMS cooldown and Socket.IO rooms live in memory
      (see `ecosystem.config.js`), so PM2 cluster mode or a second container would break them. To scale past one core:
      `rate-limit-redis` for `express-rate-limit`, `@socket.io/redis-adapter`, sticky sessions in nginx. Then run N
      instances. The compose file already includes Redis for that step; **the backend does not use Redis today**.
- [ ] **WebSocket off = 5× the polling load.** Without a socket, the app polls every 3 s instead of 15 s. Compare
      `POLL_SECONDS=3` with the default run. Make sure Arvan and nginx keep `/socket.io/` WebSocket enabled
      (`deploy/nginx-chat.conf`).

## 5. Post-test cleanup

| Goal | Command | Effect |
|---|---|---|
| Re-run with fresh data | `docker compose run --rm cleanup` then `seed` | Deletes tagged rows only, in one transaction; then `VACUUM ANALYZE`. Schema, `_prisma_migrations` and the sandbox marker stay. |
| See what would go | `docker compose run --rm cleanup node loadtest/cleanup.js --dry-run` | Counts only |
| Reset query stats | `docker compose exec postgres psql -U nopa_lt nopa_loadtest -c "SELECT pg_stat_statements_reset()"` | |
| Remove everything | `docker compose down -v` | Drops the sandbox containers and volumes (`pgdata`, `chatfiles`, `uploads`) only. Run it from this folder; the project name `nopa-loadtest` keeps it away from other stacks. |
| Remove tokens | `rm -rf out/` | `out/` is git-ignored. Tokens only work against the sandbox anyway. |

Cleanup deletes with raw SQL on purpose: the app's Prisma middleware turns `delete` on `User`, `Caravan` and
`ClassSession` into soft deletes, which would leave the rows in place.

## 6. Not covered

- **Socket.IO** (live chat delivery). k6 has no Socket.IO client. Use the existing check:
  `npm run build && npm run test:e2e -- load` (120 users on sockets, embedded Postgres).
- **Uploads and PDF export.** The image has no Chrome, which `html-pdf-node` needs (see `patches/`), so PDF export is
  not available in the container.
- **Network and CDN** (Arvan, TLS, nginx). The sandbox hits the backend directly. Add nginx in front if you want its cost included.
