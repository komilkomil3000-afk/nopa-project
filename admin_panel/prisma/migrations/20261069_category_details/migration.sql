-- Per-category details shown in the app's «مشخصات جلسه» tab: description, instructors, handout.
ALTER TABLE "ClassCategory" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "ClassCategory" ADD COLUMN IF NOT EXISTS "instructor" TEXT;
ALTER TABLE "ClassCategory" ADD COLUMN IF NOT EXISTS "handoutUrl" TEXT;
ALTER TABLE "ClassCategory" ADD COLUMN IF NOT EXISTS "handoutTitle" TEXT;
