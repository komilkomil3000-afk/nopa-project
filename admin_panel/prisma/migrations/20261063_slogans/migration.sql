-- A short slogan (at most 30 characters) for a person and for a caravan group.
ALTER TABLE "User" ADD COLUMN "slogan" TEXT;
ALTER TABLE "Caravan" ADD COLUMN "slogan" TEXT;
