# Autonomous Agent Directives & Rules — Nopa Project

> [!IMPORTANT]
> **CRITICAL RULE 1: MANDATORY AGENT CHANGE LOGGING**
> Whenever you (any autonomous agent, coding assistant, or sub-agent such as Antigravity, Roo Code, Continue, DeepSeek, or Cursor) create, modify, rename, or delete any files or database schemas in this repository, you **MUST** append a complete entry to [`AGENT_CHANGELOG.md`](file:///c:/Users/komeil/Projects/nopa_app/AGENT_CHANGELOG.md) **BEFORE finishing your turn or reporting completion**.
>
> Failing to log changes in [`AGENT_CHANGELOG.md`](file:///c:/Users/komeil/Projects/nopa_app/AGENT_CHANGELOG.md) is considered an incomplete and broken execution.

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
- **Target Component(s):** <nopa_app | nopa_backend | crm | database | docs>
- **Files Modified / Created / Deleted:**
  - `path/to/file1.ext` (Created / Modified / Deleted)
  - `path/to/file2.ext` (Modified)
- **Description of Changes:**
  - Bullet points explaining the rationale and technical modifications made.
- **Verification / Checkpoints Executed:**
  - e.g., `flutter analyze`, `npx tsc --noEmit`, test endpoints, etc.
- **Status:** [Completed | In Progress | Blocked]
```

### Automation Helper Script
You may also run the automated helper script to append your log entry:
```bash
node scripts/append_agent_changelog.js --role "<Your Role>" --component "<Component>" --desc "<Description 1; Description 2>" --verify "<Verification done>" --status "Completed"
```

---

## 2. Agent Roles and Architecture References
Refer to [`AGENT_ROLES.md`](file:///c:/Users/komeil/Projects/nopa_app/AGENT_ROLES.md) for details on specialized responsibilities:
- **Agent 1 (CRM & Analytics Specialist):** Admin UI, mentor queues, CSV/Excel export.
- **Agent 2 (Flutter App & LMS Specialist):** Mobile app, station video locks, homework submissions.
- **Agent 3 (Integration & Sync Auditor):** Prisma syncing, notifications, bidirectional linking.
- **Agent 4 (Self-Debugging Engine):** Compiler checks (`flutter analyze`, `tsc --noEmit`), server health.
