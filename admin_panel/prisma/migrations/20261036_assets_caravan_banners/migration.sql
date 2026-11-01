-- Editable asset names + caravan banners (درفش) won in inter-group challenges. Safe to re-run.

CREATE TABLE IF NOT EXISTS "AssetType" (
  "key"       TEXT PRIMARY KEY,
  "nameFa"    TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "AssetType" ("key", "nameFa", "sortOrder") VALUES
  ('zarik',          'زریک',          0),
  ('nakh',           'کلاف',          1),
  ('farsh',          'قالیچه',        2),
  ('derafsh',        'درفش',          3),
  ('derafsh_gold',   'درفش طلایی',    4),
  ('derafsh_silver', 'درفش نقره‌ای',  5),
  ('derafsh_bronze', 'درفش برنزی',    6),
  ('derafsh_cloth',  'درفش پارچه‌ای', 7)
ON CONFLICT ("key") DO UPDATE SET "nameFa" = EXCLUDED."nameFa", "sortOrder" = EXCLUDED."sortOrder";

CREATE TABLE IF NOT EXISTS "CaravanBanner" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "caravanId"   TEXT NOT NULL REFERENCES "Caravan"("id") ON DELETE CASCADE,
  "tier"        TEXT NOT NULL,
  "rank"        INTEGER,
  "challengeId" TEXT,
  "awardedBy"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CaravanBanner_challengeId_caravanId_key" ON "CaravanBanner"("challengeId", "caravanId");
CREATE INDEX IF NOT EXISTS "CaravanBanner_caravanId_idx" ON "CaravanBanner"("caravanId");

ALTER TABLE "Challenge" ADD COLUMN IF NOT EXISTS "rankingFinalizedAt" TIMESTAMP(3);
