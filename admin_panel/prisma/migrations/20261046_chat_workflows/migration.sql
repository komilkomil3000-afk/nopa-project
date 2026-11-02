-- AlterTable
ALTER TABLE "ChatSpace" ADD COLUMN     "slowSeconds" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "botKey" TEXT,
ADD COLUMN     "marks" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "meta" JSONB,
ADD COLUMN     "stationId" TEXT;

-- CreateTable
CREATE TABLE "ChatTopic" (
    "id" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "recipientId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "spaceId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "createdBy" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessageTag" (
    "messageId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "ChatMessageTag_pkey" PRIMARY KEY ("messageId","tagId")
);

-- CreateTable
CREATE TABLE "ChatPollVote" (
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "option" INTEGER NOT NULL,

    CONSTRAINT "ChatPollVote_pkey" PRIMARY KEY ("messageId","userId")
);

-- CreateTable
CREATE TABLE "ChatReport" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatScheduledMessage" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatScheduledMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatBot" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB,

    CONSTRAINT "ChatBot_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "StationEvent" (
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StationEvent_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "StationReport" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "capital" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportCase" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "status" TEXT NOT NULL DEFAULT 'open',
    "assigneeId" TEXT,
    "rating" INTEGER,
    "fromSeq" INTEGER NOT NULL DEFAULT 0,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeEvaluation" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "score" INTEGER NOT NULL,
    "share" INTEGER NOT NULL,
    "suggested" INTEGER NOT NULL,
    "finalNakh" INTEGER NOT NULL,
    "reason" TEXT,
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "objection" TEXT,
    "paidAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterGroupEntry" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "caravanId" TEXT NOT NULL,
    "anonCode" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "fileUrl" TEXT,
    "submittedBy" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterGroupEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterGroupJudgeScore" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "strength" TEXT NOT NULL,
    "suggestion" TEXT NOT NULL,

    CONSTRAINT "InterGroupJudgeScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterGroupMemberTier" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "caravanId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "confirmedBy" TEXT,

    CONSTRAINT "InterGroupMemberTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterGroupQuestion" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "caravanId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "answer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterGroupQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicInsight" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatTopic_scopeKey_key" ON "ChatTopic"("scopeKey");

-- CreateIndex
CREATE UNIQUE INDEX "ChatTopic_messageId_key" ON "ChatTopic"("messageId");

-- CreateIndex
CREATE INDEX "ChatTopic_challengeId_idx" ON "ChatTopic"("challengeId");

-- CreateIndex
CREATE INDEX "ChatTag_spaceId_idx" ON "ChatTag"("spaceId");

-- CreateIndex
CREATE INDEX "ChatReport_status_idx" ON "ChatReport"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ChatReport_messageId_reporterId_key" ON "ChatReport"("messageId", "reporterId");

-- CreateIndex
CREATE INDEX "ChatScheduledMessage_status_sendAt_idx" ON "ChatScheduledMessage"("status", "sendAt");

-- CreateIndex
CREATE UNIQUE INDEX "StationReport_stationId_userId_key" ON "StationReport"("stationId", "userId");

-- CreateIndex
CREATE INDEX "SupportCase_status_idx" ON "SupportCase"("status");

-- CreateIndex
CREATE INDEX "SupportCase_userId_idx" ON "SupportCase"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeEvaluation_topicId_userId_key" ON "ChallengeEvaluation"("topicId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "InterGroupEntry_challengeId_caravanId_key" ON "InterGroupEntry"("challengeId", "caravanId");

-- CreateIndex
CREATE UNIQUE INDEX "InterGroupEntry_challengeId_anonCode_key" ON "InterGroupEntry"("challengeId", "anonCode");

-- CreateIndex
CREATE UNIQUE INDEX "InterGroupJudgeScore_entryId_judgeId_key" ON "InterGroupJudgeScore"("entryId", "judgeId");

-- CreateIndex
CREATE INDEX "InterGroupMemberTier_challengeId_caravanId_idx" ON "InterGroupMemberTier"("challengeId", "caravanId");

-- CreateIndex
CREATE UNIQUE INDEX "InterGroupMemberTier_challengeId_userId_key" ON "InterGroupMemberTier"("challengeId", "userId");

-- CreateIndex
CREATE INDEX "InterGroupQuestion_challengeId_idx" ON "InterGroupQuestion"("challengeId");

-- CreateIndex
CREATE UNIQUE INDEX "TopicInsight_topicId_key" ON "TopicInsight"("topicId");

-- AddForeignKey
ALTER TABLE "ChatTopic" ADD CONSTRAINT "ChatTopic_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatTopic" ADD CONSTRAINT "ChatTopic_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "ChatSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatTopic" ADD CONSTRAINT "ChatTopic_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessageTag" ADD CONSTRAINT "ChatMessageTag_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessageTag" ADD CONSTRAINT "ChatMessageTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "ChatTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatPollVote" ADD CONSTRAINT "ChatPollVote_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatReport" ADD CONSTRAINT "ChatReport_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "ChatSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeEvaluation" ADD CONSTRAINT "ChallengeEvaluation_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "ChatTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterGroupJudgeScore" ADD CONSTRAINT "InterGroupJudgeScore_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "InterGroupEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicInsight" ADD CONSTRAINT "TopicInsight_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "ChatTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatTopic" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatTag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatMessageTag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatPollVote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatScheduledMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatBot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StationEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StationReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupportCase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChallengeEvaluation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InterGroupEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InterGroupJudgeScore" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InterGroupMemberTier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InterGroupQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TopicInsight" ENABLE ROW LEVEL SECURITY;
