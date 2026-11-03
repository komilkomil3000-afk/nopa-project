-- Drafts of unfinished challenge / station forms (saved per admin, finished later from the panel).
CREATE TABLE "AdminDraft" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminDraft_ownerId_kind_key_key" ON "AdminDraft"("ownerId", "kind", "key");
CREATE INDEX "AdminDraft_ownerId_kind_idx" ON "AdminDraft"("ownerId", "kind");
