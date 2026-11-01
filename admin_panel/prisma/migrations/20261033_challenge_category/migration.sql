-- Challenge audience: 'intra_group' (inside one caravan / admin "public") or 'inter_group' (admin, every caravan).
-- Safe to re-run. Existing challenges become intra_group.
ALTER TABLE "Challenge" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'intra_group';
