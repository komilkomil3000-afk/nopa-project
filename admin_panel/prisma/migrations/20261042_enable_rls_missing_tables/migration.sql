-- These tables were added after 0_init and never had RLS turned on, which left them readable
-- through the public anon API of Supabase. The backend owns the tables, so it is unaffected.
ALTER TABLE "SubmissionEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssetType" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CaravanBanner" ENABLE ROW LEVEL SECURITY;
