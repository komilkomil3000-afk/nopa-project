-- Versioned money rules and a ledger for every asset. Balances are not changed.
CREATE TABLE "EconomyPolicy" (
    "version" SERIAL NOT NULL,
    "config" JSONB NOT NULL,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EconomyPolicy_pkey" PRIMARY KEY ("version")
);

CREATE TABLE "AssetTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "policyVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssetTransaction_sourceType_sourceId_userId_asset_key" ON "AssetTransaction"("sourceType", "sourceId", "userId", "asset");
CREATE INDEX "AssetTransaction_userId_idx" ON "AssetTransaction"("userId");
CREATE INDEX "AssetTransaction_asset_idx" ON "AssetTransaction"("asset");
CREATE INDEX "AssetTransaction_createdAt_idx" ON "AssetTransaction"("createdAt");

ALTER TABLE "AssetTransaction" ADD CONSTRAINT "AssetTransaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EconomyPolicy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssetTransaction" ENABLE ROW LEVEL SECURITY;

-- Version 1: the rules confirmed by the product owner
INSERT INTO "EconomyPolicy" ("config", "note", "createdBy") VALUES (
  '{"nakhPerFarsh":10,"farshSalePrice":50000,"allowBuyNakh":false,"zarikPerNakh":500,"challengeMaxNakh":10,"interGroup":{"prizes":{"gold":20000,"silver":15000,"bronze":10000,"cloth":2500},"tiers":{"full":100,"partner":60,"minimal":25},"rankWeights":{"judges":60,"coverage":25,"delivery":15}}}',
  'نسخه‌ی اولیه',
  'SYSTEM'
);

-- Opening rows, so that from here on the sum of a user's ledger equals their balance
INSERT INTO "AssetTransaction" ("id", "userId", "asset", "amount", "sourceType", "sourceId", "reason", "createdBy", "policyVersion")
SELECT gen_random_uuid()::text, u."id", b.asset, b.amount, 'opening_balance', 'opening', 'موجودی ابتدای دفتر', 'SYSTEM', 1
FROM "User" u
CROSS JOIN LATERAL (VALUES
  ('zarik', u."zarikBalance"),
  ('nakh', u."nakh"),
  ('farsh', u."farsh"),
  ('beyragh', u."beyragh")
) AS b(asset, amount)
WHERE b.amount <> 0;
