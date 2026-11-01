-- Gender decides which bundled avatar set the app offers (avatarUrl stores "asset:<key>").
ALTER TABLE "User" ADD COLUMN "gender" TEXT;
