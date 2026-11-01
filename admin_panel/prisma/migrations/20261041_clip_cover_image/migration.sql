-- Preview (cover) picture for a video clip
ALTER TABLE "VideoClip" ADD COLUMN IF NOT EXISTS "coverImageUrl" TEXT;
