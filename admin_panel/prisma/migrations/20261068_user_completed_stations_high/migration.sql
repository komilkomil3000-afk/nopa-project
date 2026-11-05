-- Highest number of completed stations per user, so later content edits never re-lock stations already passed.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "completedStationsHigh" INTEGER NOT NULL DEFAULT 0;
