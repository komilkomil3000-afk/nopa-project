-- Market shop (فروشگاه بازارچه): items sold for zarik, their stickers / GIFs, and who bought what.
-- Only new tables; no existing data is touched.
CREATE TABLE IF NOT EXISTS "ShopItem" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "featureKey" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coverUrl" TEXT,
    "priceZarik" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShopItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ShopItem_isActive_sortOrder_idx" ON "ShopItem"("isActive", "sortOrder");

CREATE TABLE IF NOT EXISTS "ShopItemAsset" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'sticker',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopItemAsset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ShopItemAsset_itemId_idx" ON "ShopItemAsset"("itemId");

CREATE TABLE IF NOT EXISTS "ShopPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopPurchase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ShopPurchase_userId_itemId_key" ON "ShopPurchase"("userId", "itemId");
CREATE INDEX IF NOT EXISTS "ShopPurchase_userId_idx" ON "ShopPurchase"("userId");

DO $$ BEGIN
    ALTER TABLE "ShopItemAsset" ADD CONSTRAINT "ShopItemAsset_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ShopItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE "ShopPurchase" ADD CONSTRAINT "ShopPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE "ShopPurchase" ADD CONSTRAINT "ShopPurchase_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ShopItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
