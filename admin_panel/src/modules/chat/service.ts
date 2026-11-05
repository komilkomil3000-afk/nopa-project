import crypto from 'crypto';
import path from 'path';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import prisma from '../../config/db';
import { getJwtSecret } from '../../config/secrets';
import { ChatActor, canSee, SpaceRef } from './access';
import { isMentorRole, isSupportRole } from '../../utils/roles';

export const CHAT_FILES_DIR = process.env.CHAT_FILES_DIR || path.join(__dirname, '../../../chat-files');
export const REACTION_TYPES = ['like', 'dislike', 'idea', 'flower', 'thanks', 'bravo', 'agree', 'question', 'confused', 'star']; // the first five are offered; the rest are kept for old reactions
/** The extra "top message" star: only moderators give it, besides their ordinary reaction; "#برتر" in search lists these. */
export const STAR_REACTION = 'star';
export const MAX_BODY = 4000;
export const PAGE_SIZE = 40;
const FILE_LINK_SECONDS = 60 * 60;

// «کانال همگانی» (public) and «گروه رسانه» (mediaqa) were retired: people talk and work in their own caravan's group
// (`کاروان <name>`: its members, its mentor and support). Their old rows stay in the database but nobody sees them
// (access.ts canSee) and they are no longer created.
const GLOBAL_SPACES = [
  { key: 'announcements', type: 'announcements', title: 'کانال اعلانات' },
  { key: 'arena', type: 'arena', title: 'میدان آثار' },
  { key: 'mentors', type: 'mentors', title: 'اتاق راهبران' },
];

/** Stored title of a caravan group that was never renamed: the group then follows the caravan's name. */
export const DEFAULT_CARAVAN_GROUP_TITLE = 'گروه کاروان';

/**
 * The name a caravan's group is shown with: the caravan's own name, unless its mentor or an admin
 * gave the group another one (stored in ChatSpace.title).
 */
export const caravanGroupTitle = (caravanName: string, spaceTitle?: string | null) => {
  const own = (spaceTitle || '').trim();
  return own && own !== DEFAULT_CARAVAN_GROUP_TITLE ? own : caravanName;
};

/** The group's own name, or null while it follows the caravan's name. */
export const customCaravanGroupTitle = (spaceTitle?: string | null) => {
  const own = (spaceTitle || '').trim();
  return own && own !== DEFAULT_CARAVAN_GROUP_TITLE ? own : null;
};

/**
 * Renames a caravan's group (at most 60 characters). An empty name, or the caravan's own name,
 * makes the group follow the caravan's name again. Returns the name now shown.
 */
export async function setCaravanGroupTitle(caravanId: string, title: unknown): Promise<string> {
  const caravan = await prisma.caravan.findUnique({ where: { id: caravanId }, select: { name: true } });
  if (!caravan) throw new ChatError(404, 'کاروان یافت نشد');
  await ensureCaravanSpaces(caravanId);
  const wanted = String(title ?? '').trim().slice(0, 60);
  const stored = !wanted || wanted === caravan.name.trim() ? DEFAULT_CARAVAN_GROUP_TITLE : wanted;
  await prisma.chatSpace.update({ where: { key: `caravan:${caravanId}` }, data: { title: stored } });
  return caravanGroupTitle(caravan.name, stored);
}

const ensured = new Set<string>();

/**
 * Creates a space once. Prisma's upsert is a read then an insert, so two requests opening chat at the
 * same moment both try to insert: the loser reads the row the winner made instead of failing.
 */
export async function ensureSpace(key: string, data: { type: string; title: string; caravanId?: string }) {
  let space;
  try {
    space = await prisma.chatSpace.upsert({ where: { key }, update: {}, create: { key, ...data } });
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
    space = await prisma.chatSpace.findUniqueOrThrow({ where: { key } });
  }
  ensured.add(key);
  return space;
}

/** Caravan ids a user's spaces come from. Admins, channel managers and support work across all of them. */
export async function caravanIdsOf(actor: ChatActor): Promise<string[]> {
  const role = String(actor.role).toLowerCase();
  if (role === 'admin' || role === 'sub_admin' || role === 'channel_manager' || isSupportRole(role)) {
    return (await prisma.caravan.findMany({ select: { id: true } })).map(c => c.id);
  }
  return Array.from(new Set([...actor.mentoredCaravanIds, ...(actor.caravanId ? [actor.caravanId] : [])]));
}

export async function ensureCaravanSpaces(caravanId: string) {
  const caravan = `caravan:${caravanId}`, challenges = `challenges:${caravanId}`;
  if (!ensured.has(caravan)) await ensureSpace(caravan, { type: 'caravan', title: DEFAULT_CARAVAN_GROUP_TITLE, caravanId }); // shown as caravanGroupTitle(name, title)
  if (!ensured.has(challenges)) await ensureSpace(challenges, { type: 'challenges', title: 'گروه چالش‌ها', caravanId });
}

export const globalSpace = (key: 'announcements' | 'arena' | 'mentors') => {
  const s = GLOBAL_SPACES.find(g => g.key === key)!;
  return ensureSpace(s.key, { type: s.type, title: s.title });
};

/** Creates the spaces a user should have the first time they are needed. */
export async function ensureSpacesFor(actor: ChatActor): Promise<void> {
  for (const s of GLOBAL_SPACES) {
    if (!ensured.has(s.key)) await ensureSpace(s.key, { type: s.type, title: s.title });
  }
  for (const caravanId of await caravanIdsOf(actor)) await ensureCaravanSpaces(caravanId);
  // Support is always one tap away, not something to discover
  const role = String(actor.role).toLowerCase();
  const supportKey = `support:${actor.id}`;
  if ((role === 'student' || isMentorRole(role)) && !ensured.has(supportKey)) {
    const space = await ensureSpace(supportKey, { type: 'support', title: 'پشتیبانی نپا' });
    await prisma.chatMember.createMany({ data: [{ spaceId: space.id, userId: actor.id }], skipDuplicates: true });
  }
}

export async function visibleSpaces(actor: ChatActor) {
  await ensureSpacesFor(actor);
  const memberOf = await prisma.chatMember.findMany({ where: { userId: actor.id } });
  const members = new Map(memberOf.map(m => [m.spaceId, m]));
  const caravanIds = await caravanIdsOf(actor);
  const candidates = await prisma.chatSpace.findMany({
    where: {
      OR: [
        { type: { in: ['announcements', 'arena', 'mentors'] } },
        { caravanId: { in: caravanIds } },
        { id: { in: Array.from(members.keys()) } },
        // Support staff answer from the app: every user's support conversation with an unresolved case
        ...(isSupportRole(actor.role) ? [{ type: 'support', supportCases: { some: { status: { not: 'resolved' } } } }] : []),
      ],
    },
    include: { caravan: { select: { name: true, coverImageUrl: true } } },
  });
  return { spaces: candidates.filter(s => canSee(actor, s, members.has(s.id))), members };
}

export async function visibleSpaceIds(actor: ChatActor): Promise<string[]> {
  return (await visibleSpaces(actor)).spaces.map(s => s.id);
}

/** A space the actor can see, or null, so a hidden space looks the same as a missing one. */
export async function findVisibleSpace(actor: ChatActor, spaceId: string) {
  const space = await prisma.chatSpace.findUnique({ where: { id: spaceId } });
  if (!space) return null;
  const member = await prisma.chatMember.findUnique({ where: { spaceId_userId: { spaceId, userId: actor.id } } });
  return canSee(actor, space, !!member) ? { space, member } : null;
}

export function directKey(a: string, b: string): string {
  return `direct:${[a, b].sort().join(':')}`;
}

/** Link to a private file. It expires, so it cannot circulate the way a public URL can. */
export function signFileUrl(attachmentId: string): string {
  const token = jwt.sign({ a: attachmentId }, getJwtSecret(), { algorithm: 'HS256', expiresIn: FILE_LINK_SECONDS, audience: 'chat-file' });
  return `/api/v1/chat/files/${attachmentId}?t=${token}`;
}

export function verifyFileToken(attachmentId: string, token: string): boolean {
  try {
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'], audience: 'chat-file' }) as { a?: string };
    return payload.a === attachmentId;
  } catch {
    return false;
  }
}

export const MESSAGE_INCLUDE = {
  sender: { select: { id: true, name: true, avatarUrl: true, role: true, gender: true } },
  attachments: true,
  reactions: { select: { type: true, userId: true } },
  pollVotes: { select: { option: true, userId: true } },
  tags: { select: { tag: { select: { id: true, name: true, color: true, visibility: true } } } },
  topic: { select: { id: true, status: true, challengeId: true, challenge: { select: { type: true } } } },
  replyTo: { select: { id: true, body: true, deletedAt: true, sender: { select: { name: true } } } },
} satisfies Prisma.ChatMessageInclude;

type MessageRow = Prisma.ChatMessageGetPayload<{ include: typeof MESSAGE_INCLUDE }>;

export function serializeMessage(m: MessageRow) {
  const deleted = !!m.deletedAt;
  return {
    id: m.id,
    spaceId: m.spaceId,
    seq: m.seq,
    kind: m.kind,
    botKey: m.botKey,
    meta: m.meta,
    stationId: m.stationId,
    best: m.marks.includes('best'),
    // «شاهد امتیاز» and «پاسخ نهایی گروه»: shown on the message itself, to everyone
    evidence: m.marks.includes('evidence'),
    final: m.marks.includes('final'),
    // The mentor chose to wear the mentor's badge on this message
    mentorMark: m.marks.includes('mentor'),
    // Replies under a message: a challenge always has them; elsewhere a moderator opens them
    threadOpen: m.marks.includes('thread') || !!m.topic || m.threadReplies > 0,
    // quiz: a «چالش تستی», answered by picking options under the card instead of chatting
    topic: m.topic && { id: m.topic.id, status: m.topic.status, challengeId: m.topic.challengeId, quiz: m.topic.challenge?.type === 'quiz' || m.topic.challenge?.type === 'step_by_step_quiz' },
    pollVotes: m.pollVotes,
    tags: m.tags.map(t => t.tag).filter(t => t.visibility === 'public'),
    body: deleted ? '' : m.body,
    deleted,
    edited: !!m.editedAt,
    threadRootId: m.threadRootId,
    threadReplies: m.threadReplies,
    pinned: !!m.pinnedAt,
    clientMessageId: m.clientMessageId,
    createdAt: m.createdAt,
    sender: m.sender,
    mentions: m.mentions,
    reactions: m.reactions,
    replyTo: m.replyTo && {
      id: m.replyTo.id,
      senderName: m.replyTo.sender?.name || '',
      body: m.replyTo.deletedAt ? '' : m.replyTo.body.slice(0, 120),
    },
    attachments: deleted ? [] : m.attachments.map(a => ({
      id: a.id, name: a.name, mime: a.mime, size: a.size, kind: a.kind, url: signFileUrl(a.id),
    })),
  };
}

export function attachmentKind(mime: string): string {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return 'file';
}

export const randomStorageName = (ext: string) => crypto.randomBytes(16).toString('hex') + ext;

export interface NewMessage {
  spaceId: string;
  senderId?: string;
  botKey?: string;
  kind?: string;
  meta?: Prisma.InputJsonValue;
  stationId?: string;
  body: string;
  clientMessageId?: string;
  replyToId?: string;
  threadRootId?: string;
  attachmentIds: string[];
  mentions: string[];
  /** Staff answering in a user's support space stay outside it. */
  stayOutside?: boolean;
}

export class ChatError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/**
 * Writes a message, taking its place in the space from the row lock on the counter. A retry with
 * the same clientMessageId returns the first copy, so a flaky connection cannot post twice.
 */
export async function createMessage(input: NewMessage): Promise<{ row: MessageRow; created: boolean }> {
  const { spaceId, senderId, clientMessageId } = input;
  if (clientMessageId && senderId) {
    const existing = await prisma.chatMessage.findUnique({
      where: { senderId_clientMessageId: { senderId, clientMessageId } },
      include: MESSAGE_INCLUDE,
    });
    if (existing) return { row: existing, created: false };
  }

  try {
    const row = await prisma.$transaction(async (tx) => {
      if (input.threadRootId) {
        const root = await tx.chatMessage.findUnique({ where: { id: input.threadRootId } });
        if (!root || root.spaceId !== spaceId || root.threadRootId) throw new ChatError(400, 'رشته‌ی گفتگو معتبر نیست');
      }
      if (input.replyToId) {
        const target = await tx.chatMessage.findUnique({ where: { id: input.replyToId } });
        if (!target || target.spaceId !== spaceId) throw new ChatError(400, 'پیام انتخاب‌شده معتبر نیست');
      }
      const { lastSeq } = await tx.chatSpace.update({ where: { id: spaceId }, data: { lastSeq: { increment: 1 } } });

      const message = await tx.chatMessage.create({
        data: {
          spaceId,
          seq: lastSeq,
          senderId,
          body: input.body,
          kind: input.kind || (input.attachmentIds.length ? 'file' : 'text'),
          botKey: input.botKey,
          meta: input.meta,
          stationId: input.stationId,
          clientMessageId,
          replyToId: input.replyToId,
          threadRootId: input.threadRootId,
          mentions: input.mentions,
        },
      });
      if (input.attachmentIds.length) {
        const claimed = await tx.chatAttachment.updateMany({
          where: { id: { in: input.attachmentIds }, uploaderId: senderId, spaceId, messageId: null },
          data: { messageId: message.id },
        });
        if (claimed.count !== input.attachmentIds.length) throw new ChatError(400, 'فایل پیوست معتبر نیست');
      }
      if (input.threadRootId) {
        await tx.chatMessage.update({ where: { id: input.threadRootId }, data: { threadReplies: { increment: 1 } } });
      }
      if (senderId && !input.stayOutside) {
        await tx.chatMember.upsert({
          where: { spaceId_userId: { spaceId, userId: senderId } },
          update: { lastReadSeq: lastSeq },
          create: { spaceId, userId: senderId, lastReadSeq: lastSeq },
        });
      }
      return tx.chatMessage.findUniqueOrThrow({ where: { id: message.id }, include: MESSAGE_INCLUDE });
    });
    return { row, created: true };
  } catch (e: any) {
    // Two copies of one message raced: the unique index let one through
    if (e?.code === 'P2002' && clientMessageId && senderId) {
      const row = await prisma.chatMessage.findUniqueOrThrow({
        where: { senderId_clientMessageId: { senderId, clientMessageId } },
        include: MESSAGE_INCLUDE,
      });
      return { row, created: false };
    }
    throw e;
  }
}

export type { SpaceRef };
