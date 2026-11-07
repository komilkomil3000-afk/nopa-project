-- Landing pages (صفحه لندینگ) edited in the panel, and the versions kept before each save.
-- Only new tables; no existing data is touched.
CREATE TABLE IF NOT EXISTS "LandingPage" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'builder',
    "html" TEXT,
    "builder" JSONB,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "ogImage" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isHome" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LandingPage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LandingPage_slug_key" ON "LandingPage"("slug");

CREATE TABLE IF NOT EXISTS "LandingPageVersion" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "html" TEXT,
    "builder" JSONB,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LandingPageVersion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LandingPageVersion_pageId_createdAt_idx" ON "LandingPageVersion"("pageId", "createdAt");

DO $$ BEGIN
    ALTER TABLE "LandingPageVersion" ADD CONSTRAINT "LandingPageVersion_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "LandingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
