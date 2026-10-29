-- Performance indexes (M-08). Idempotent and non-destructive: no data is changed.

CREATE INDEX IF NOT EXISTS "Submission_studentId_idx" ON "Submission"("studentId");
CREATE INDEX IF NOT EXISTS "Submission_challengeId_studentId_idx" ON "Submission"("challengeId", "studentId");
CREATE INDEX IF NOT EXISTS "Submission_status_idx" ON "Submission"("status");
CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "SupportTicket_studentId_idx" ON "SupportTicket"("studentId");
CREATE INDEX IF NOT EXISTS "SupportTicket_status_idx" ON "SupportTicket"("status");
CREATE INDEX IF NOT EXISTS "MentorRating_mentorId_idx" ON "MentorRating"("mentorId");
CREATE INDEX IF NOT EXISTS "MentorRating_studentId_idx" ON "MentorRating"("studentId");
CREATE INDEX IF NOT EXISTS "AssetConversionRequest_caravanId_idx" ON "AssetConversionRequest"("caravanId");
CREATE INDEX IF NOT EXISTS "AssetConversionRequest_requestedBy_idx" ON "AssetConversionRequest"("requestedBy");
CREATE INDEX IF NOT EXISTS "AssetConversionRequest_status_idx" ON "AssetConversionRequest"("status");
