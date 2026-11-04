// Nopa backend load test (k6). Sandbox only: run through loadtest/docker-compose.yml after seed.js.
//
// One virtual user (VU) = one student with the app in the foreground, doing what the Flutter app does
// (app/lib/services/app_state_repository.dart _pollOnce):
//   every POLL_SECONDS (15 s with a live socket, 3 s when WebSocket is blocked):
//     GET /users/me, GET /challenges, GET /notifications
//   every 10th round (heavy): GET /lms/stations, GET /my-caravan/banners, GET /caravans
//   on open, and while "in chat" (CHAT_RATIO of rounds): recent caravan messages, then newer ones
//   now and then (SUBMIT_RATIO of rounds): POST /submissions to a sandbox challenge (201, or 409 if pending)
// Plus a low, constant rate of real POST /auth/login (bcrypt + session + audit row) on separate users.
//
// Load: steps of concurrent users (default 50,100,200,300,400,500), each ramped then held, so every step
// gets its own p95. The highest step that keeps p95 < 400 ms and errors < 1 % is the capacity estimate.
//
//   docker compose run --rm k6
//   docker compose run --rm -e POLL_SECONDS=3 k6                 # worst case: no WebSocket
//   docker compose run --rm -e STEPS=50,100,150 -e HOLD=2m k6
import http from 'k6/http';
import exec from 'k6/execution';
import { check, sleep, fail } from 'k6';
import { SharedArray } from 'k6/data';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

const BASE = (__ENV.BASE_URL || 'http://backend:5000').replace(/\/$/, '');
const API = `${BASE}/api/v1`;
if (/nopa-app\.ir/i.test(BASE) && __ENV.I_KNOW_THIS_IS_NOT_PRODUCTION !== 'yes') {
  throw new Error('BASE_URL points at the production domain. This script only runs against the sandbox.');
}

const MAX_VUS = Number(__ENV.MAX_VUS || 500);
const STEPS = String(__ENV.STEPS || '50,100,200,300,400,500').split(',').map(Number).filter(n => n > 0 && n <= MAX_VUS);
const RAMP = __ENV.RAMP || '1m';
const HOLD = __ENV.HOLD || '3m';
const POLL_SECONDS = Number(__ENV.POLL_SECONDS || 15);
const CHAT_RATIO = Number(__ENV.CHAT_RATIO || 0.3);
const SUBMIT_RATIO = Number(__ENV.SUBMIT_RATIO || 0.02);
const LOGIN_RATE = Number(__ENV.LOGIN_RATE || 1); // logins per second
const P95_MS = Number(__ENV.P95_MS || 400);

const users = new SharedArray('users', () => JSON.parse(open('../out/users.json')));
const loginUsers = new SharedArray('loginUsers', () => JSON.parse(open('../out/login-users.json')));
const meta = JSON.parse(open('../out/meta.json'));
if (users.length < Math.max(...STEPS)) {
  throw new Error(`Only ${users.length} seeded users for ${Math.max(...STEPS)} VUs: re-seed with LT_STUDENTS >= ${Math.max(...STEPS)}`);
}

// ---- timeline: ramp to each step, hold it; requests are tagged with the step being held ----
const secs = d => { const m = /^(\d+)(s|m)$/.exec(d); if (!m) throw new Error(`bad duration ${d}`); return Number(m[1]) * (m[2] === 'm' ? 60 : 1); };
const stages = [], timeline = [];
let t = 0;
for (const s of STEPS) {
  stages.push({ duration: RAMP, target: s }); t += secs(RAMP); timeline.push({ until: t, level: 'ramp' });
  stages.push({ duration: HOLD, target: s }); t += secs(HOLD); timeline.push({ until: t, level: String(s) });
}
stages.push({ duration: '30s', target: 0 }); t += 30; timeline.push({ until: t, level: 'ramp' });
const TOTAL_SECONDS = t;
const levelAt = sec => (timeline.find(x => sec < x.until) || { level: 'ramp' }).level;

const thresholds = {
  // Stop early once the system is clearly broken (more than 1 % failures for a minute)
  http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '1m' }],
  'http_req_duration{expected_response:true}': [`p(95)<${P95_MS}`],
  checks: ['rate>0.99'],
};
for (const s of STEPS) thresholds[`http_req_duration{level:${s}}`] = [`p(95)<${P95_MS}`];
for (const name of ['me', 'challenges', 'notifications', 'stations', 'banners', 'caravans', 'chat_spaces', 'chat_recent', 'chat_newer', 'submit', 'login']) {
  thresholds[`http_req_duration{name:${name}}`] = [`p(95)<${P95_MS}`];
}

export const options = {
  scenarios: {
    app_users: { executor: 'ramping-vus', exec: 'appUser', startVUs: 0, stages, gracefulRampDown: '30s', gracefulStop: '30s' },
    logins: {
      executor: 'constant-arrival-rate', exec: 'loginFlow', rate: LOGIN_RATE, timeUnit: '1s',
      duration: `${TOTAL_SECONDS}s`, preAllocatedVUs: 5, maxVUs: 30,
    },
  },
  thresholds,
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  discardResponseBodies: false,
  noConnectionReuse: false,
  userAgent: 'nopa-k6-loadtest/1.0',
};

// Each VU looks like its own phone (distinct client IP): the backend trusts X-Forwarded-For from the
// sandbox's private network only (TRUST_PROXY=uniquelocal). 198.18.0.0/15 is the benchmarking range.
const ipFor = n => `198.${18 + ((n >> 16) & 1)}.${(n >> 8) & 255}.${n & 255}`;

export function setup() {
  const health = http.get(`${BASE}/health`);
  if (health.status !== 200) fail(`backend not healthy at ${BASE} (status ${health.status})`);
  // First chat call creates the global spaces; do it once instead of 500 VUs racing to
  const warm = http.get(`${API}/chat/spaces`, { headers: { Authorization: `Bearer ${users[0].token}` } });
  if (warm.status === 401) fail('seeded token rejected (401): JWT_SECRET of seed and backend differ, or the DB was re-created after seeding');
  if (warm.status !== 200) fail(`warm-up /chat/spaces returned ${warm.status}: ${warm.body}`);
  console.log(`seeded ${meta.seededAt}; ${users.length} users; steps ${STEPS.join(',')}; poll ${POLL_SECONDS}s; ~${Math.round(TOTAL_SECONDS / 60)} min`);
}

// ---- per-VU state (module scope is per VU in k6) ----
let round = 0;
let opened = false;
let lastSeq = 0;

function get(path, name, headers) {
  const res = http.get(`${API}${path}`, { headers, tags: { name } });
  check(res, { [`${name} 200`]: r => r.status === 200 });
  return res;
}

export function appUser() {
  const vu = exec.vu.idInTest;
  const me = users[(vu - 1) % users.length];
  exec.vu.tags.level = levelAt((Date.now() - exec.scenario.startTime) / 1000);
  const headers = { Authorization: `Bearer ${me.token}`, 'X-Forwarded-For': ipFor(vu), 'Content-Type': 'application/json' };
  const started = Date.now();

  if (!opened) {
    // App start: session check, content, chat list
    const r = get('/users/me', 'me', headers);
    if (r.status === 401) fail(`VU ${vu}: token rejected`);
    get('/lms/stations', 'stations', headers);
    get('/chat/spaces', 'chat_spaces', headers);
    opened = true;
    sleep(1 + Math.random() * 2);
  }

  // One poll round, as the app's periodic sync does
  round += 1;
  const heavy = round % 10 === 0;
  http.batch([
    ['GET', `${API}/users/me`, null, { headers, tags: { name: 'me' } }],
    ['GET', `${API}/challenges`, null, { headers, tags: { name: 'challenges' } }],
    ['GET', `${API}/notifications`, null, { headers, tags: { name: 'notifications' } }],
  ]).forEach(r => check(r, { 'poll 200': x => x.status === 200 }));
  if (heavy) {
    http.batch([
      ['GET', `${API}/lms/stations`, null, { headers, tags: { name: 'stations' } }],
      ['GET', `${API}/my-caravan/banners`, null, { headers, tags: { name: 'banners' } }],
      ['GET', `${API}/caravans`, null, { headers, tags: { name: 'caravans' } }],
    ]).forEach(r => check(r, { 'heavy 200': x => x.status === 200 }));
  }

  // Chat screen open: newest page first, then only what is newer
  if (me.space && Math.random() < CHAT_RATIO) {
    const path = lastSeq ? `/chat/spaces/${me.space}/messages?afterSeq=${lastSeq}` : `/chat/spaces/${me.space}/messages`;
    const res = get(path, lastSeq ? 'chat_newer' : 'chat_recent', headers);
    if (res.status === 200) {
      const msgs = res.json('messages') || [];
      if (msgs.length) lastSeq = Math.max(lastSeq, ...msgs.map(m => m.seq || 0));
    }
  }

  // Challenge answer (sandbox challenge of the VU's own caravan). 409 = already pending review: expected.
  if (me.challenges.length && Math.random() < SUBMIT_RATIO) {
    const challengeId = me.challenges[Math.floor(Math.random() * me.challenges.length)];
    const res = http.post(`${API}/submissions`, JSON.stringify({ challengeId, answerText: `LT answer ${Date.now()}` }), {
      headers, tags: { name: 'submit' }, responseCallback: http.expectedStatuses(201, 409),
    });
    check(res, { 'submit 201/409': r => r.status === 201 || r.status === 409 });
  }

  const spent = (Date.now() - started) / 1000;
  sleep(Math.max(0.1, POLL_SECONDS - spent + (Math.random() - 0.5)));
}

export function loginFlow() {
  const n = exec.scenario.iterationInTest;
  const u = loginUsers[n % loginUsers.length];
  const res = http.post(`${API}/auth/login`, JSON.stringify({ phoneNumber: u.phone, password: meta.loginPassword }), {
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ipFor(100000 + n) },
    tags: { name: 'login', level: 'login' },
  });
  check(res, { 'login 200 + token': r => r.status === 200 && !!r.json('token') });
}

export function handleSummary(data) {
  const p95 = name => data.metrics[name] && data.metrics[name].values['p(95)'];
  const fails = data.metrics.http_req_failed ? data.metrics.http_req_failed.values.rate : 0;
  let capacity = 0;
  const lines = ['', '=== p95 per concurrent-user step (target < ' + P95_MS + ' ms) ==='];
  for (const s of STEPS) {
    const v = p95(`http_req_duration{level:${s}}`);
    const ok = v !== undefined && v < P95_MS;
    lines.push(`  ${String(s).padStart(4)} users: ${v === undefined ? 'not reached' : v.toFixed(0) + ' ms'} ${v === undefined ? '' : ok ? 'OK' : 'OVER'}`);
  }
  // Highest step reached before the first one over budget
  for (const s of STEPS) { const v = p95(`http_req_duration{level:${s}}`); if (v !== undefined && v < P95_MS) capacity = s; else break; }
  lines.push(`  error rate: ${(fails * 100).toFixed(2)} %`);
  lines.push(`  => capacity estimate (poll ${POLL_SECONDS}s): ${capacity ? capacity + ' concurrent users' : 'below the first step'}`);
  lines.push('=== slowest endpoints (p95) ===');
  Object.keys(data.metrics).filter(k => k.startsWith('http_req_duration{name:'))
    .map(k => [k.slice(23, -1), p95(k)]).filter(([, v]) => v !== undefined).sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => lines.push(`  ${k.padEnd(14)} ${v.toFixed(0)} ms`));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return {
    stdout: textSummary(data, { indent: '  ', enableColors: true }) + lines.join('\n') + '\n',
    [`${__ENV.OUT_DIR || '/scripts/out'}/summary-${stamp}.json`]: JSON.stringify(data, null, 2),
  };
}
