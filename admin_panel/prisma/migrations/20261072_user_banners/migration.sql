-- Banners (درفش) the admin gives one person, by tier. User.beyragh stays their total.
CREATE TABLE IF NOT EXISTS "UserBanner" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "reason" TEXT,
    "awardedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserBanner_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UserBanner_userId_tier_idx" ON "UserBanner"("userId", "tier");

DO $$ BEGIN
    ALTER TABLE "UserBanner" ADD CONSTRAINT "UserBanner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
