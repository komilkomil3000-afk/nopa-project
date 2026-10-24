# Agent Change Log (AGENT_CHANGELOG.md)

This document is the mandatory audit log for all automated and autonomous agents working on the Nopa project. 

> [!IMPORTANT]
> **Mandatory Rule for All Agents:**
> Whenever an agent creates, edits, or deletes any files or database schemas across `nopa_app`, `nopa_backend`, or other project directories, it **MUST** record an entry in this file before concluding its step/turn.

---

## Log Entry Template

When logging changes, append a new entry to the bottom of the "Change Entries" section using the following structure:

```markdown
### [YYYY-MM-DD HH:mm] - <Agent Name / Role>
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
