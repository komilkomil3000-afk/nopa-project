-- Cross-caravan challenges: the admin's per-member base reward by rank tier (zarik and کلاف). NULL = the economy defaults.
ALTER TABLE "Challenge" ADD COLUMN IF NOT EXISTS "rewardPlan" JSONB;
