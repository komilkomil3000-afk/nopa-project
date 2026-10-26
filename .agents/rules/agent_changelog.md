# Mandatory Agent Change Log Protocol

## Requirement
Every agent operating within this workspace that makes modifications to the codebase (creation, update, renaming, deletion of any files or database schemas) MUST append an entry to `AGENT_CHANGELOG.md` at the project root before completing its task.

## Triggered By Resolution
- Check `git remote get-url origin` for GitHub username (e.g. `komilkomil3000-afk`).
- Check system username (`komeil`).
- Format: `GitHub: komilkomil3000-afk | System: komeil`.

## Template
```markdown
### [YYYY-MM-DD HH:mm] - <Agent Role>
- **Triggered By:** GitHub: komilkomil3000-afk | System: komeil
- **Target Component(s):** <components>
- **Files Modified / Created / Deleted:**
  - `path/to/file` (Modified)
- **Description of Changes:**
  - Details
- **Verification / Checkpoints Executed:**
  - Checks
- **Status:** Completed
```

Alternatively run:
```bash
node scripts/append_agent_changelog.js
```
