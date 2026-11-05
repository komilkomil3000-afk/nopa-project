# Autonomous Agent Directives & Rules — Nopa Project

> [!IMPORTANT]
> **CRITICAL RULE 1: MANDATORY AGENT CHANGE LOGGING**
> Whenever you (any autonomous agent, coding assistant, or sub-agent such as Antigravity, Roo Code, Continue, DeepSeek, or Cursor) create, modify, rename, or delete any files or database schemas in this repository, you **MUST** append a complete entry to [`AGENT_CHANGELOG.md`](file:///c:/Users/komeil/Projects/nopa_app/AGENT_CHANGELOG.md) **BEFORE finishing your turn or reporting completion**.
>
> Failing to log changes in [`AGENT_CHANGELOG.md`](file:///c:/Users/komeil/Projects/nopa_app/AGENT_CHANGELOG.md) is considered an incomplete and broken execution.

---

## 0. Repository Layout

| Folder | Contents |
|---|---|
| `app/` | Flutter mobile app (`lib/`, `android/`, `ios/`, `assets/`, `test/`, `pubspec.yaml`). **Run all `flutter` commands from inside `app/`** (e.g. `cd app && flutter analyze`). |
| `admin_panel/` | Backend + admin panel project (Express + Prisma/PostgreSQL on self-hosted Supabase): `src/`, `prisma/`, `supabase/`, `public/` (the CRM static panel), `deploy/`, `docs/`. It is developed and deployed from another machine; the whole folder is copied here in bulk, so avoid large edits here unless asked. Never commit its `.env`. |
| `scripts/`, `AGENTS.md`, `AGENT_CHANGELOG.md`, ... | Shared tooling and agent rules at the repo root. |

**Releasing a new app version:** never edit `version:` in `app/pubspec.yaml` by hand for a release; run `node scripts/release_app.js` (fix release, `x.y.Z+1`) or `node scripts/release_app.js minor` (`x.Y+1.0`) from the repo root. Only the first (major) number is raised by hand. The script keeps `app/release_state.json` (commit it), builds one light APK per architecture (`--split-per-abi`: arm64-v8a, armeabi-v7a, x86_64) into `app/build/releases/`, and prints the version to enter in the panel (roles tab → «نسخه اپلیکیشن», one upload row per architecture). Do not ship an all-in-one APK after split ones: its Android version code is lower and will not install over them.

The deployed API lives at `/api/v1` on `nopa-app.ir`; the Flutter app reaches it only through `app/lib/core/constants/api_constants.dart`. Database host is `db.nopa-app.ir` (DNS only, ports 6543/5432).

---

## 1. How to Log Changes in `AGENT_CHANGELOG.md`

### User Identity Detection Protocol
Each log entry must specify the `Triggered By` field:
1. **GitHub Username:** Extract from `git remote get-url origin` (e.g. `komilkomil3000-afk`).
2. **Git Author:** Run `git config user.name` and `git config user.email` (use if not default placeholder).
3. **OS System Username:** Fallback to `$env:USERNAME` (Windows) or `whoami` (Unix).
4. **Format:** `GitHub: <username> | System: <username>` (e.g. `GitHub: komilkomil3000-afk | System: komeil`).

### Entry Format
Append to the end of [`AGENT_CHANGELOG.md`](file:///c:/Users/komeil/Projects/nopa_app/AGENT_CHANGELOG.md):

```markdown
### [YYYY-MM-DD HH:mm] - <Agent Name / Role>
- **Triggered By:** GitHub: <user> | System: <user>
- **Target Component(s):** <app | admin_panel | docs>  
- **Files Modified / Created / Deleted:**
  - `path/to/file1.ext` (Created / Modified / Deleted)
  - `path/to/file2.ext` (Modified)
- **Description of Changes:**
  - Bullet points explaining the rationale and technical modifications made.
- **Verification / Checkpoints Executed:**
  - e.g., `flutter analyze` (run from `app/`), `npx tsc --noEmit` in `admin_panel/`, etc.
- **Status:** [Completed | In Progress | Blocked]
```

### Automation Helper Script
You may also run the automated helper script to append your log entry:
```bash
node scripts/append_agent_changelog.js --role "<Your Role>" --component "<Component>" --desc "<Description 1; Description 2>" --verify "<Verification done>" --status "Completed"
```

---

## 1b. Server-Side Requirements Rule

> [!IMPORTANT]
> **CRITICAL RULE 2: KEEP `admin_panel/docs/SERVER_CHECKLIST.md` CURRENT**
> If a change you make needs anything to be done or checked **on the server** (or must be remembered when running or migrating a server), you **MUST** update [`admin_panel/docs/SERVER_CHECKLIST.md`](admin_panel/docs/SERVER_CHECKLIST.md) in the same turn, and tell the user in your final message exactly what they must do on the server.
>
> Triggers: a new/changed env variable (also add it to the server's `~/nopa.env`), a new persistent folder or file on disk (also add it to `deploy/backup.sh`), a new port/domain/nginx rule/WebSocket need, a new cron job or external service, a Prisma migration, a change to `deploy/` scripts, or any new secret.
> Update the inventory table (section 1), the relevant migration checklist (sections 2/3) and the periodic tasks (section 4) as needed. If the change affects backup or privacy, update `admin_panel/docs/BACKUP_AND_PRIVACY.md` too.

---

## 2. Agent Roles and Architecture References
Refer to [`AGENT_ROLES.md`](file:///c:/Users/komeil/Projects/nopa_app/AGENT_ROLES.md) for details on specialized responsibilities:
- **Agent 1 (CRM & Analytics Specialist):** Admin UI, mentor queues, CSV/Excel export.
- **Agent 2 (Flutter App & LMS Specialist):** Mobile app, station video locks, homework submissions.
- **Agent 3 (Integration & Sync Auditor):** Prisma syncing, notifications, bidirectional linking.
- **Agent 4 (Self-Debugging Engine):** Compiler checks (`flutter analyze` from `app/`); backend checks (`npx tsc --noEmit`, server health) run in `admin_panel/`.
