# Agent Change Log (AGENT_CHANGELOG.md)

This document is the mandatory audit log for all automated and autonomous agents working on the Nopa project.

> [!NOTE]
> **User Identity Detection:**
> Each log entry **MUST** include a `Triggered By` field identifying the user who initiated the change.
>
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

### [2026-10-25 18:35] - Agent 2 — Flutter App & LMS Specialist

- **Triggered By:** GitHub: komilkomil3000-afk | System: komeil
- **Target Component(s):** nopa_app / Mobile Client
- **Files Modified / Created / Deleted:**
  - `lib/models/station.dart` (Modified)
  - `lib/screens/mentor/home/mentor_home_screen.dart` (Modified)
  - `lib/screens/student/academy/student_academy_roadmap_screen.dart` (Modified)
  - `lib/screens/student/home/student_home_screen.dart` (Modified)
  - `lib/screens/student/profile/student_certificates_screen.dart` (Modified)
  - `lib/services/api_service.dart` (Modified)
  - `lib/services/app_state_repository.dart` (Modified)
  - `lib/widgets/station_card.dart` (Modified)
  - `lib/widgets/station_progress_stepper.dart` (Modified)
  - `android/app/src/main/AndroidManifest.xml` (Modified)
  - `android/app/src/main/res/xml/network_security_config.xml` (Created)
- **Description of Changes:**
  - Implemented mentor and student home screens, API services, and navigation widgets.
  - Added station model data mappings and station roadmap progression steppers.
  - Added Android network security config to support dev backend communication.
- **Verification / Checkpoints Executed:**
  - `flutter analyze` checked.
- **Status:** Completed

### [2026-10-26 14:00] - Agent 2 — Flutter App & LMS Specialist

- **Triggered By:** GitHub: komilkomil3000-afk | System: komeil
- **Target Component(s):** nopa_app / Mobile LMS & Routing
- **Files Modified / Created / Deleted:**
  - `lib/main.dart` (Modified)
  - `lib/screens/student/academy/student_class1_screen.dart` (Modified)
  - `lib/screens/student/home/student_home_screen.dart` (Modified)
  - `android/app/src/main/res/xml/network_security_config.xml` (Modified)
- **Description of Changes:**
  - Fixed 0-based vs 1-based index calculation (`orderIndex - 1` offset) in `StudentClass1Screen` so station taps reliably open the designated station.
  - Added `/station_detail` route in `lib/main.dart` pointing to `StudentClass1Screen`.
  - Updated `student_home_screen.dart` station click handler to navigate to `/class1`.
  - Configured `base-config cleartextTrafficPermitted="true"` in Android `network_security_config.xml` for local development.
- **Verification / Checkpoints Executed:**
  - Code syntax inspection and station order index verification.
- **Status:** Completed

### [2026-10-26 15:35] - Master Orchestrator / Lead Architect

- **Triggered By:** GitHub: komilkomil3000-afk | System: komeil
- **Target Component(s):** Multi-Agent Orchestration & Logging Infrastructure
- **Files Modified / Created / Deleted:**
  - `AGENTS.md` (Created)
  - `GEMINI.md` (Created)
  - `.agents/rules/agent_changelog.md` (Created)
  - `.clinerules` (Created)
  - `.cursorrules` (Created)
  - `scripts/append_agent_changelog.js` (Created)
  - `scripts/git-hooks/pre-commit` (Created)
  - `.git/hooks/pre-commit` (Created)
  - `AGENT_CHANGELOG.md` (Modified)
- **Description of Changes:**
  - Resolved issue where AI agents were not automatically logging changes into `AGENT_CHANGELOG.md`.
  - Created root-level rule files recognized across all agent environments: `AGENTS.md` (universal), `GEMINI.md` and `.agents/rules/agent_changelog.md` (Antigravity/Gemini), `.clinerules` (Roo Code/Cline), and `.cursorrules` (Cursor).
  - Built automated logging script `scripts/append_agent_changelog.js` with automatic Git & GitHub identity detection (`GitHub: komilkomil3000-afk | System: komeil`).
  - Added git pre-commit hook to warn and prevent silent commits without changelog updates.
  - Backfilled missing changelog entries for past commits and uncommitted Flutter workspace changes.
- **Verification / Checkpoints Executed:**
  - Tested `scripts/append_agent_changelog.js` identity resolution (`node scripts/append_agent_changelog.js`).
  - Validated markdown structure and cross-file references.
- **Status:** Completed

### [2026-10-26 15:48] - Agent 2 — Flutter App & LMS Specialist

- **Triggered By:** GitHub: komilkomil3000-afk | System: komeil
- **Target Component(s):** nopa_app
- **Files Modified / Created / Deleted:**
  - `lib/screens/student/home/student_home_screen.dart`
  - `lib/widgets/station_card.dart`
  - `lib/widgets/education_calendar.dart`
  - `lib/screens/student/academy/student_class2_screen.dart`
  - `lib/main.dart`
- **Description of Changes:**
  - Fixed station carousel and user info strip tap handling to open the respective station screen (/class1)
  - Added HitTestBehavior.opaque to StationCard GestureDetector
  - Added interactive clickable session items in EducationCalendar table under the calendar navigating directly to the specific class (/class2)
  - Supported sessionTitle, instructor, and tab routing in StudentClass2Screen to automatically expand and play the selected session video
- **Verification / Checkpoints Executed:**
  - flutter analyze (No issues found!)
- **Status:** Completed

### [2026-10-26 16:05] - Antigravity Assistant / UX & Architecture Specialist
- **Triggered By:** GitHub: komilkomil3000-afk | System: komeil
- **Target Component(s):** nopa_app | crm | docs
- **Files Modified / Created / Deleted:**
  - `ui_ux_audit.md` (Created)
  - `AGENT_CHANGELOG.md` (Modified)
- **Description of Changes:**
  - Performed a strict, end-to-end UI/UX audit across Flutter Mobile App (`nopa_app`) and Admin CRM Panel (`nopa_backend/public`).
  - Audited visual consistency, design tokens, YekanBakh typography hierarchy, modal ergonomics, and dark surface readability.
  - Audited information architecture, TopBar LTR directionality inversion, Station Stepper fluidity, and deep-linking back-stack popping.
  - Flagged critical LMS quiz validation bypass (answers submitted without correctness check or server sync in `student_class2_screen.dart`).
  - Flagged dummy mock file upload button in `student_edit_profile_screen.dart`.
  - Audited Admin CRM table density, uncompiled Tailwind classes in `caravanWorkspace.js`, blocking `window.confirm`/`window.alert` calls, and lack of Persian numerals in data tables.
  - Formulated a prioritized, actionable matrix (P0 to P2) mapped to exact source files.
- **Verification / Checkpoints Executed:**
  - Audited live Dart and JavaScript source trees across both components.
  - Generated and verified persistent documentation in [`ui_ux_audit.md`](file:///c:/Users/komeil/Projects/nopa_app/ui_ux_audit.md).
- **Status:** Completed

### [2026-10-26 19:48] - Agent 2 — Flutter App & Integration Specialist
- **Triggered By:** GitHub: komilkomil3000-afk | System: komeil
- **Target Component(s):** nopa_app / Android Build
- **Files Modified / Created / Deleted:**
  - `lib/core/constants/api_constants.dart` (Modified)
  - `lib/services/api_service.dart` (Modified)
  - `android/app/src/main/AndroidManifest.xml` (Modified)
  - `android/app/src/main/res/xml/network_security_config.xml` (Modified)
  - `AGENT_CHANGELOG.md` (Modified)
- **Description of Changes:**
  - Switched default API host and media base URL from local IP/localhost:5000 to production domain `http://nopa-app.ir`.
  - Added legacy media URL sanitizer in `ApiConstants.resolveImageUrl` to automatically remap stale `localhost:5000` and `127.0.0.1:5000` URLs to `http://nopa-app.ir`.
  - Updated `HttpApiService` host probing and health-check routine (`_formatBaseUrl`, `_pingHost`, `checkBackendHealth`) to support standard HTTP domains without appending `:5000`, while preserving developer candidate fallback.
  - Enabled cleartext HTTP network traffic in Android (`android:usesCleartextTraffic="true"` and explicit domain whitelist in `network_security_config.xml` for `nopa-app.ir`) to prevent Android OS cleartext blocking.
  - Built production release APK (`flutter build apk`).
- **Verification / Checkpoints Executed:**
  - Tested live endpoint connectivity to `http://nopa-app.ir/health` and `http://nopa-app.ir/api/v1/auth/verify-phone`.
  - `flutter analyze` executed (No issues found!).
  - `flutter build apk` executed successfully (`build/app/outputs/flutter-apk/app-release.apk` - 59.4MB).
- **Status:** Completed


### [2026-10-27 13:19] - Antigravity UI/UX Specialist
- **Triggered By:** GitHub: komilkomil3000-afk | System: komeil
- **Target Component(s):** nopa_app & nopa_backend
- **Files Modified / Created / Deleted:**
  - `gitignore` (Modified)
  - `AGENT_CHANGELOG.md` (Modified)
  - `android/app/src/main/AndroidManifest.xml` (Modified)
  - `android/app/src/main/res/xml/network_security_config.xml` (Modified)
  - `lib/core/constants/api_constants.dart` (Modified)
  - `lib/main.dart` (Modified)
  - `lib/screens/student/academy/student_class2_screen.dart` (Modified)
  - `lib/screens/student/market/student_market_screen.dart` (Modified)
  - `lib/screens/student/profile/student_edit_profile_screen.dart` (Modified)
  - `lib/services/api_service.dart` (Modified)
  - `lib/widgets/app_scaffold.dart` (Modified)
  - `lib/widgets/complete_profile_dialog.dart` (Modified)
  - `nopa_backend/public/app.js` (Modified)
  - `nopa_backend/public/caravanWorkspace.js` (Modified)
  - `nopa_backend/public/instructors.js` (Modified)
- **Description of Changes:**
  - Implemented audit points from ui_ux_audit.md
  - Added quiz answer correctness validation & HttpApiService.submitClassSessionQuiz sync with AnimatedSwitcher transitions in student_class2_screen.dart
  - Integrated real FilePicker & HttpApiService.uploadMediaFile in student_edit_profile_screen.dart
  - Wrapped AppScaffold in PopScope for safe pop handling
  - Unified font tokens to AppTheme.fontFamily and added keyboard avoidance AnimatedPadding in complete_profile_dialog.dart
  - Renamed pill label to بیرق in student_market_screen.dart
  - Added onGenerateRoute and onUnknownRoute in main.dart
  - Replaced uncompiled Tailwind classes in caravanWorkspace.js with glassmorphism style.css tokens
  - Replaced browser alert/confirm/prompt with unified showConfirmDialog, toasts, and secure masked password override modal in app.js and instructors.js
  - Localized table numbers with toPersianDigits
- **Verification / Checkpoints Executed:**
  - flutter analyze (0 issues found); node -c syntax checks on app.js, instructors.js, and caravanWorkspace.js
- **Status:** Completed
