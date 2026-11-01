-- Full history of every answer / rejection (with the mentor's message) / approval of a submission.
-- Safe to re-run.
CREATE TABLE IF NOT EXISTS "SubmissionEvent" (
  "id"           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "submissionId" TEXT NOT NULL REFERENCES "Submission"("id") ON DELETE CASCADE,
  "challengeId"  TEXT NOT NULL,
  "studentId"    TEXT NOT NULL,
  "action"       TEXT NOT NULL,
  "answerText"   TEXT,
  "fileUrl"      TEXT,
  "feedback"     TEXT,
  "score"        INTEGER,
  "actorId"      TEXT,
  "actorName"    TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "SubmissionEvent_submissionId_createdAt_idx" ON "SubmissionEvent"("submissionId", "createdAt");
CREATE INDEX IF NOT EXISTS "SubmissionEvent_challengeId_idx" ON "SubmissionEvent"("challengeId");
