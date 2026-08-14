# AGENT_ROLES.md

This document defines the Multi-Agent Autonomous Development Loop orchestration for the Nopa project. It assigns responsibilities, acceptance criteria, artifacts, and verification commands for four specialized sub-agents.

## Overview
- Orchestrator: Master Lead Architect & Orchestrator (this document and execution pipeline)
- Purpose: Split implementation, verification, and integration across dedicated sub-agents to deliver full-stack features across `nopa_app`, `nopa_backend`, and `nopa_admin`.

## Agent Definitions

### Agent 1 — CRM & Analytics Specialist (Roo Code / Extension Mode)
- Primary Mandate: Close the visibility gap between mobile actions and CRM, implement the admin UI features, exports, and reviewer workflows.
- Responsibilities:
  - Expand 360-degree Student Modal to render dynamic charts and categorized data.
  - Implement Mentor Document Verification Queue (list, approve, reject with reason).
  - Add client-export capabilities (CSV, Excel, PDF) for CRM tables.
- Artifacts:
  - `nopa_backend/src/controllers/mentorController.ts` endpoints for documents & caravan assignment.
  - `nopa_backend/public/app.js` UI enhancements (drawer charts, lists, export hooks).
  - Admin routes in `nopa_backend/src/routes/admin.ts` for document management.
- Acceptance:
  - Drawer modal shows charts and lists populated from `/api/v1/admin/users/:id/analytics`.
  - Admin can approve/reject mentor documents; decisions persisted in `MentorDocument` records.
  - Export buttons produce CSV and Excel downloads in-browser.

### Agent 2 — Flutter App & LMS Specialist (DeepSeek V4 / Extension Mode)
- Primary Mandate: Deliver LMS UX and submission flows in Flutter client.
- Responsibilities:
  - Station detail screens categorized by class type.
  - Sequential 4-session video player locking logic until assignment submitted.
  - Multi-format homework submission (text, 4-choice quiz, file upload).
  - Mentor workbench: review submissions, reply, approve, grant Zarik.
- Artifacts:
  - `lib/screens/*` additions and `lib/services/api_service.dart` endpoints for uploads/submissions.
- Acceptance:
  - Sessions enforce lock/unlock rules locally and via backend flags.
  - Mentor review actions call admin endpoints and update records.

### Agent 3 — System Integration & Bidirectional Linking Auditor (Continue / Extension Mode)
- Primary Mandate: Ensure full bilateral syncing and notification delivery.
- Responsibilities:
  - Ensure every student action updates prisma records and reflects in CRM UI.
  - Ensure support tickets and homework feedback are saved both sides and visible in both CRM modules.
  - Ensure notification triggers (manual adjustments, broadcasts) are routed in-app and to CRM.
- Artifacts:
  - Integration test scripts, webhook handlers (if needed), and notification helper functions.
- Acceptance:
  - Actions performed in Flutter appear in CRM within seconds and vice versa.

### Agent 4 — Self-Debugging & Verification Engine (Compiler Mode)
- Primary Mandate: Run continuous static analysis, fix type issues, ensure server runs persistently at `0.0.0.0:5000`.
- Responsibilities:
  - Run `npx tsc --noEmit` and fix type errors.
  - Run `flutter analyze` and fix null-safety/warnings.
  - Verify backend runs and DB schema pushed (`npx prisma db push`).
- Artifacts:
  - CI-like checks executed locally; patches for type mismatches.
- Acceptance:
  - `npx tsc --noEmit` returns no errors.
  - `flutter analyze` returns no critical issues.
  - Backend process runs on `0.0.0.0:5000` and `/health` returns 200.

## Execution Phases
- Phase 1 — Database & Backend
  - Ensure Prisma models exist: `MentorDocument`, `RewardRule`.
  - Implement admin endpoints for document queue, approve/reject, assign caravans.
  - Implement reward rules endpoints and leaderboards.
- Phase 2 — CRM UI
  - Enhance drawer, implement export, document queue UI, leaderboard UI.
- Phase 3 — Flutter Client
  - Implement session player lock, submission engine, mentor workbench UI.
- Phase 4 — Integration Audit
  - Run verification scenarios across stack; fix any missing linkages.

## Checkpoints & Verification Commands
- Seed DB:
  ```bash
  cd nopa_backend
  npm run db:seed
  ```
- Run backend (dev):
  ```bash
  cd nopa_backend
  npm run dev
  # server should bind to 0.0.0.0:5000
  curl http://0.0.0.0:5000/health
  ```
- TypeScript check:
  ```bash
  cd nopa_backend
  npx tsc --noEmit
  ```
- Flutter analyze:
  ```bash
  cd nopa_app
  flutter analyze
  ```
- Test login (PowerShell example):
  ```powershell
  Invoke-RestMethod -Uri 'http://localhost:5000/api/v1/auth/login' -Method Post -ContentType 'application/json' -Body (ConvertTo-Json @{phoneNumber='09380346668'; password='123456'})
  ```

## Reporting
- Each agent will update `AGENT_PROGRESS.md` (or the central TODO list) with incremental changes and verification steps.
- Final consolidated report will summarize acceptance checks and include commands to reproduce tests.

---
Generated: by Master Lead Architect & Orchestrator
