-- Challenge recipients: empty = every member of the caravan, otherwise only the listed students.
-- Challenge start date: null = open immediately. Safe to re-run.
ALTER TABLE "Challenge" ADD COLUMN IF NOT EXISTS "recipientIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Challenge" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3);
