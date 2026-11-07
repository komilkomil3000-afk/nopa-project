-- Hand-made membership of chat spaces (panel: «اعضا و نقش‌ها»): "added" lets a person into a space they would not
-- reach by their caravan or role, "removed" keeps a person out of one they would. Null = the automatic rules.
-- One nullable column; no existing row changes.
ALTER TABLE "ChatMember" ADD COLUMN IF NOT EXISTS "manual" TEXT;
