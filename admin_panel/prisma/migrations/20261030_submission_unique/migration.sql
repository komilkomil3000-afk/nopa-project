-- One submission per (challenge, student). Prevents double rewards from concurrent submits (H-06).
-- Safe to re-run. Fails only if duplicate rows exist; check first with:
--   SELECT "challengeId","studentId",COUNT(*) FROM "Submission" GROUP BY 1,2 HAVING COUNT(*)>1;
DROP INDEX IF EXISTS "Submission_challengeId_studentId_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "Submission_challengeId_studentId_key" ON "Submission"("challengeId", "studentId");
