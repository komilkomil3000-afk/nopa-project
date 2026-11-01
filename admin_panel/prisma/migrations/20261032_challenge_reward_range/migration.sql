-- A challenge pays zarik or nakh, and the reviewing mentor picks the amount between a min and a max.
-- Safe to re-run. Existing challenges keep paying their fixed rewardZarik (min = max = 0).
ALTER TABLE "Challenge" ADD COLUMN IF NOT EXISTS "rewardAssetType" TEXT NOT NULL DEFAULT 'zarik';
ALTER TABLE "Challenge" ADD COLUMN IF NOT EXISTS "rewardMin" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Challenge" ADD COLUMN IF NOT EXISTS "rewardMax" INTEGER NOT NULL DEFAULT 0;
