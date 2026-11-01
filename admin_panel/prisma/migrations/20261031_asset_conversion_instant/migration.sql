-- Asset conversions are now instant (status "completed") and cancellable by the caravan mentor.
-- Additive and idempotent: legacy rows keep their old status and have NULL structured fields.
ALTER TABLE "AssetConversionRequest" ADD COLUMN IF NOT EXISTS "sourceAsset" TEXT;
ALTER TABLE "AssetConversionRequest" ADD COLUMN IF NOT EXISTS "targetAsset" TEXT;
ALTER TABLE "AssetConversionRequest" ADD COLUMN IF NOT EXISTS "sourceAmount" INTEGER;
ALTER TABLE "AssetConversionRequest" ADD COLUMN IF NOT EXISTS "targetAmount" INTEGER;
ALTER TABLE "AssetConversionRequest" ADD COLUMN IF NOT EXISTS "cancelledBy" TEXT;
ALTER TABLE "AssetConversionRequest" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
