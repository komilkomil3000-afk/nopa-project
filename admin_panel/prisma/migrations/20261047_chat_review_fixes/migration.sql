-- Fixes from the chat review.
ALTER TABLE "Challenge" ADD COLUMN "judgingStartedAt" TIMESTAMP(3);
ALTER TABLE "ChatTopic" ADD COLUMN "finalMessageId" TEXT;
ALTER TABLE "ChallengeEvaluation" ADD COLUMN "objectionStatus" TEXT, ADD COLUMN "objectionResponse" TEXT;

-- Objections filed before this release still await an answer
UPDATE "ChallengeEvaluation" SET "objectionStatus" = 'pending' WHERE "objection" IS NOT NULL;
