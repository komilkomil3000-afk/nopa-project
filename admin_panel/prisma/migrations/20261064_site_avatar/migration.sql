-- A second picture for a person, set from the admin panel and shown only on the site (the app keeps avatarUrl).
ALTER TABLE "User" ADD COLUMN "siteAvatarUrl" TEXT;
