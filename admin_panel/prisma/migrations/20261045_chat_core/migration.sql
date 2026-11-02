-- The old ChatMessage table had no screen behind it. It is kept under a new name in case it holds rows.
ALTER TABLE "ChatMessage" DROP CONSTRAINT "ChatMessage_senderId_fkey";
ALTER TABLE "ChatMessage" DROP CONSTRAINT "ChatMessage_receiverId_fkey";
ALTER TABLE "ChatMessage" DROP CONSTRAINT "ChatMessage_caravanId_fkey";
ALTER TABLE "ChatMessage" RENAME CONSTRAINT "ChatMessage_pkey" TO "ChatMessage_legacy_pkey";
ALTER TABLE "ChatMessage" RENAME TO "ChatMessage_legacy";

CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "senderId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'text',
    "body" TEXT NOT NULL DEFAULT '',
    "clientMessageId" TEXT,
    "replyToId" TEXT,
    "threadRootId" TEXT,
    "threadReplies" INTEGER NOT NULL DEFAULT 0,
    "mentions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pinnedAt" TIMESTAMP(3),
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSpace" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "caravanId" TEXT,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatSpace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMember" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "lastReadSeq" INTEGER NOT NULL DEFAULT 0,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "mutedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatReaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatAttachment" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "messageId" TEXT,
    "uploaderId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatSpace_key_key" ON "ChatSpace"("key");

-- CreateIndex
CREATE INDEX "ChatSpace_type_idx" ON "ChatSpace"("type");

-- CreateIndex
CREATE INDEX "ChatSpace_caravanId_idx" ON "ChatSpace"("caravanId");

-- CreateIndex
CREATE INDEX "ChatMember_userId_idx" ON "ChatMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMember_spaceId_userId_key" ON "ChatMember"("spaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatReaction_messageId_userId_type_key" ON "ChatReaction"("messageId", "userId", "type");

-- CreateIndex
CREATE INDEX "ChatAttachment_messageId_idx" ON "ChatAttachment"("messageId");

-- CreateIndex
CREATE INDEX "ChatMessage_spaceId_threadRootId_seq_idx" ON "ChatMessage"("spaceId", "threadRootId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_spaceId_seq_key" ON "ChatMessage"("spaceId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_senderId_clientMessageId_key" ON "ChatMessage"("senderId", "clientMessageId");

-- AddForeignKey
ALTER TABLE "ChatSpace" ADD CONSTRAINT "ChatSpace_caravanId_fkey" FOREIGN KEY ("caravanId") REFERENCES "Caravan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMember" ADD CONSTRAINT "ChatMember_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "ChatSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMember" ADD CONSTRAINT "ChatMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "ChatSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatReaction" ADD CONSTRAINT "ChatReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatAttachment" ADD CONSTRAINT "ChatAttachment_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "ChatSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatAttachment" ADD CONSTRAINT "ChatAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatSpace" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatReaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatAttachment" ENABLE ROW LEVEL SECURITY;
