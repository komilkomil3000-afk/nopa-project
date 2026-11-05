-- Admin-managed number of animation episodes of a station (shown as «انیمیشن» in the app).
ALTER TABLE "Station" ADD COLUMN IF NOT EXISTS "animationCount" INTEGER;
