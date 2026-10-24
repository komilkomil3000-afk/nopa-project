# Agent Change Log (AGENT_CHANGELOG.md)

This document is the mandatory audit log for all automated and autonomous agents working on the Nopa project.

> [!NOTE]
> **User Identity Detection:**
> Each log entry **MUST** include a `Triggered By` field identifying the user who initiated the change.
> - **Step 1:** Run `git config user.name` and `git config user.email` — use these if they are set and not default/placeholder values.
> - **Step 2:** Extract GitHub username from `git remote get-url origin` (e.g., `komilkomil3000-afk` from `https://github.com/komilkomil3000-afk/nopa-project.git`).
> - **Step 3 (Fallback):** Use the OS system username via `$env:USERNAME` (Windows) or `whoami` (Linux/macOS).
> - Report format: `GitHub: <username>` or `System: <username>` depending on the source.

> [!IMPORTANT]
> **Mandatory Rule for All Agents:**
> Whenever an agent creates, edits, or deletes any files or database schemas across `nopa_app`, `nopa_backend`, or other project directories, it **MUST** record an entry in this file before concluding its step/turn.

---

## Log Entry Template

When logging changes, append a new entry to the bottom of the "Change Entries" section using the following structure:

```markdown
### [YYYY-MM-DD HH:mm] - <Agent Name / Role>
- **Triggered By:** <GitHub: username | System: username>
- **Target Component(s):** <e.g., nopa_app | nopa_backend | crm | database | docs>
- **Files Modified / Created / Deleted:**
  - `path/to/file1.ext` (Created / Modified / Deleted)
  - `path/to/file2.ext` (Modified)
- **Description of Changes:**
  - Brief bullet points describing what was changed and why.
- **Verification / Checkpoints Executed:**
  - e.g., `flutter analyze` (passed), `npx tsc --noEmit` (passed), manual API curl test.
- **Status:** [In Progress | Completed | Blocked]
```

---

## Change Entries

### [2026-10-24 21:15] - Master Orchestrator / Lead Architect
- **Triggered By:** GitHub: komilkomil3000-afk | System: komeil
- **Target Component(s):** Root / Orchestration Documentation
- **Files Modified / Created / Deleted:**
  - `AGENT_CHANGELOG.md` (Created)
  - `AGENT_ROLES.md` (Modified)
- **Description of Changes:**
  - Created the dedicated agent change log file (`AGENT_CHANGELOG.md`) with standardized logging format and guidelines.
  - Registered the mandatory logging rule in `AGENT_ROLES.md` requiring all sub-agents and coding assistants to document all modifications here.
- **Verification / Checkpoints Executed:**
  - Verified markdown formatting and cross-references.
- **Status:** Completed
