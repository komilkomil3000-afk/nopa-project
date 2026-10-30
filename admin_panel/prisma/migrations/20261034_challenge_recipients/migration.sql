-- Challenge recipients: empty = every member of the caravan, otherwise only the listed students.
-- Safe to re-run. Existing challenges keep going to the whole caravan.
ALTER TABLE "Challenge" ADD COLUMN IF NOT EXISTS "recipientIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
