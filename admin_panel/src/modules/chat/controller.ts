import fs from 'fs';
import path from 'path';
import { Response } from 'express';
import multer from 'multer';
import prisma from '../../config/db';
import { AuthRequest } from '../../middleware/auth';
import { ALLOWED_UPLOADS } from '../../controllers/mediaController';
import { getAppImages } from '../../controllers/appImagesController';
import { getChatSettings } from '../../services/chatSettings';
import { canModerate, canPostTopLevel, canReply, canReplyInArena, canStartDirect, canTag, ChatActor } from './access';
import { blockedWord, runCommand } from './bots';
import { handler, requireMessage, requireSpace } from './http';
import { notifyAbsent, publishMessage, publishUpdate } from './publish';
import { emitToSpace, isOnline, refreshUserRooms } from './realtime';
import { peopleOf } from './profiles';
import { ensureOpenCase } from './support';
import { recordArenaSubmission, resolveActorCaravan } from './intergroup';
import { sealedMessageIds } from './arenaPrivacy';
import { isMentorRole, isSupportRole } from '../../utils/roles';
import {
  attachmentKind, CHAT_FILES_DIR, caravanGroupTitle, caravanIdsOf, ChatError, directKey, findVisibleSpace, MAX_BODY, MESSAGE_INCLUDE, PAGE_SIZE,
  randomStorageName, REACTION_TYPES, serializeMessage, STAR_REACTION, signFileUrl, verifyFileToken, visibleSpaces,
} from './service';

const MAX_FILE_BYTES = 30 * 1024 * 1024;
const DAILY_UPLOAD_BYTES = 200 * 1024 * 1024;
// Private folder: only the server's own user may read it (files are chmod 600 after upload)
fs.mkdirSync(CHAT_FILES_DIR, { recursive: true, mode: 0o700 });

export const chatUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, CHAT_FILES_DIR),
    filename: (_req, file, cb) => cb(null, randomStorageName(path.extname(file.originalname).toLowerCase())),
  }),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const mime = ALLOWED_UPLOADS[path.extname(file.originalname || '').toLowerCase()];
    if (!mime) return cb(Object.assign(new Error('نوع فایل مجاز نیست'), { status: 400 }));
    file.mimetype = mime;
    cb(null, true);
  },
});

export const listSpaces = handler(async (req, res, actor) => {
  const visible = await visibleSpaces(actor);
  const members = visible.members;
  // ?caravanId= narrows the caravan-bound spaces to one caravan (support's caravan selector); the rest stay
  const only = req.query.caravanId ? String(req.query.caravanId) : null;
  const spaces = only ? visible.spaces.filter(s => !s.caravanId || s.caravanId === only) : visible.spaces;
  const ids = spaces.map(s => s.id);
  const [lastMessages, directMembers] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { spaceId: { in: ids }, threadRootId: null },
      orderBy: { seq: 'desc' },
      distinct: ['spaceId'],
      select: { spaceId: true, body: true, kind: true, deletedAt: true, createdAt: true, senderId: true, sender: { select: { name: true } } },
    }),
    prisma.chatMember.findMany({
      where: { spaceId: { in: spaces.filter(s => s.type === 'direct').map(s => s.id) }, userId: { not: actor.id } },
      select: { spaceId: true, lastReadSeq: true, user: { select: { id: true, name: true, avatarUrl: true, role: true, gender: true } } },
    }),
  ]);
  const defaults = (await getAppImages()).chat;

  res.json(spaces.map(s => {
    const peer = directMembers.find(m => m.spaceId === s.id);
    const last = lastMessages.find(m => m.spaceId === s.id);
    const me = members.get(s.id);
    return {
      id: s.id,
      type: s.type,
      title: peer?.user.name || (s.caravan && s.type === 'caravan' ? caravanGroupTitle(s.caravan.name) : s.title),
      // the caravan's own picture first, then the default the admin set for this kind of space («تصاویر اپلیکیشن»)
      coverImageUrl: (s.type === 'caravan' ? s.caravan?.coverImageUrl : null) || (s.type === 'direct' ? null : defaults[s.type] || null),
      peer: peer ? { ...peer.user, online: isOnline(peer.user.id) } : null,
      peerReadSeq: peer?.lastReadSeq ?? 0,
      lastSeq: s.lastSeq,
      lastReadSeq: me?.lastReadSeq ?? 0,
      unread: Math.max(0, s.lastSeq - (me?.lastReadSeq ?? 0)),
      muted: !!me?.muted,
      canPost: canPostTopLevel(actor, s),
      canReply: canReply(actor, s),
      canModerate: canModerate(actor, s),
      canTag: canTag(actor, s),
      lastMessage: last && {
        senderId: last.senderId,
        senderName: last.sender?.name || '',
        preview: last.deletedAt ? '' : (last.body.slice(0, 80) || (last.kind === 'file' ? 'فایل' : '')),
        createdAt: last.createdAt,
      },
    };
  }));
});

/** The caravans the caller works across, for the caravan selector (support, admins, channel managers, multi-caravan mentors). */
export const listCaravans = handler(async (_req, res, actor) => {
  const ids = await caravanIdsOf(actor);
  const caravans = await prisma.caravan.findMany({
    where: { id: { in: ids }, isDeleted: false },
    select: { id: true, name: true, coverImageUrl: true, memberCount: true, mentor: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(caravans);
});

/** People the caller may start a private conversation with. */
export const listContacts = handler(async (_req, res, actor) => {
  const select = { id: true, name: true, avatarUrl: true, role: true, gender: true };
  const role = String(actor.role).toLowerCase();
  if (role === 'student') {
    if (!actor.caravanId) return res.json([]);
    const caravan = await prisma.caravan.findUnique({ where: { id: actor.caravanId }, select: { mentor: { select } } });
    return res.json(caravan?.mentor ? [caravan.mentor] : []);
  }
  if (actor.mentoredCaravanIds.length) {
    const people = await prisma.user.findMany({ where: { OR: [{ caravanId: { in: actor.mentoredCaravanIds }, role: 'student' }, { role: { in: ['admin', 'support'] } }] }, select, orderBy: { name: 'asc' } });
    return res.json(people);
  }
  if (role === 'admin' || role === 'sub_admin') {
    const people = await prisma.user.findMany({ where: { role: { in: ['mentor', 'SUPER_MENTOR'] } }, select, orderBy: { name: 'asc' } });
    return res.json(people);
  }
  if (isSupportRole(role)) {
    const people = await prisma.user.findMany({ where: { role: { in: ['mentor', 'SUPER_MENTOR'] } }, select, orderBy: { name: 'asc' } });
    return res.json(people);
  }
  res.json([]);
});

export const openDirect = handler(async (req, res, actor) => {
  const otherId = String(req.body?.userId || '');
  if (!(await canStartDirect(actor, otherId))) throw new ChatError(403, 'امکان شروع این گفتگو وجود ندارد');

  const key = directKey(actor.id, otherId);
  const space = await prisma.chatSpace.upsert({
    where: { key },
    update: {},
    create: { key, type: 'direct', title: 'گفتگوی خصوصی' },
  });
  await prisma.chatMember.createMany({
    data: [actor.id, otherId].map(userId => ({ spaceId: space.id, userId })),
    skipDuplicates: true,
  });
  await refreshUserRooms([actor.id, otherId]);
  res.json({ id: space.id });
});

/** One page, oldest first. Query: beforeSeq or afterSeq, and threadRootId for a thread's replies. */
export const listMessages = handler(async (req, res, actor) => {
  const { space, member } = await requireSpace(actor, req.params.id);
  const beforeSeq = Number(req.query.beforeSeq) || undefined;
  const afterSeq = Number(req.query.afterSeq) || undefined;
  const threadRootId = req.query.threadRootId ? String(req.query.threadRootId) : null;
  const tagId = req.query.tagId ? String(req.query.tagId) : undefined;
  const stationId = req.query.stationId ? String(req.query.stationId) : undefined;
  const sealed = await sealedMessageIds(actor, space);

  const rows = await prisma.chatMessage.findMany({
    where: { spaceId: space.id, threadRootId, stationId, seq: { lt: beforeSeq, gt: afterSeq }, id: { notIn: sealed }, ...(tagId ? { tags: { some: { tagId } } } : {}) },
    orderBy: { seq: afterSeq ? 'asc' : 'desc' },
    take: PAGE_SIZE,
    include: MESSAGE_INCLUDE,
  });
  const ordered = afterSeq ? rows : rows.reverse();
  const staffTags = canTag(actor, space)
    ? Object.fromEntries(ordered.map(m => [m.id, m.tags.map(t => t.tag).filter(t => t.visibility === 'staff')]).filter(([, tags]) => tags.length))
    : {};
  // Small faces of who took part, beside the way into each conversation under a message
  const roots = ordered.filter(m => !m.threadRootId && m.threadReplies > 0).map(m => m.id);
  const replies = roots.length
    ? await prisma.chatMessage.findMany({
        where: { threadRootId: { in: roots }, senderId: { not: null }, deletedAt: null, id: { notIn: sealed } },
        distinct: ['threadRootId', 'senderId'], orderBy: { createdAt: 'desc' },
        select: { threadRootId: true, sender: { select: { id: true, name: true, avatarUrl: true, role: true, gender: true } } },
      })
    : [];
  const people = new Map<string, unknown[]>();
  for (const r of replies) {
    const list = people.get(r.threadRootId!) ?? [];
    if (list.length < 4 && r.sender) list.push(r.sender);
    people.set(r.threadRootId!, list);
  }
  res.json({ messages: ordered.map(m => ({ ...serializeMessage(m), threadPeople: people.get(m.id) ?? [] })), lastReadSeq: member?.lastReadSeq ?? 0, staffTags });
});

export const sendMessage = handler(async (req, res, actor) => {
  const { space, member } = await requireSpace(actor, req.params.id);
  const body = String(req.body?.body || '').trim();
  const threadRootId = req.body?.threadRootId ? String(req.body.threadRootId) : undefined;
  const attachmentIds: string[] = Array.isArray(req.body?.attachmentIds) ? req.body.attachmentIds.map(String) : [];
  const asked: string[] = Array.isArray(req.body?.mentions) ? req.body.mentions.map(String).slice(0, 20) : [];
  const people = asked.length ? new Set((await peopleOf(space)).map(p => p.id)) : new Set<string>();
  const mentions = asked.filter(id => people.has(id));

  if (!body && attachmentIds.length === 0) throw new ChatError(400, 'پیام خالی است');
  if (body.length > MAX_BODY) throw new ChatError(400, `پیام نباید بیشتر از ${MAX_BODY} نویسه باشد`);
  if (member?.mutedUntil && member.mutedUntil > new Date()) throw new ChatError(403, 'ارسال پیام برای شما موقتاً بسته است');
  const command = await runCommand(actor, space, body, threadRootId);
  if (command !== null) return res.json({ command: true, result: command, clientMessageId: req.body?.clientMessageId });

  if (threadRootId ? !canReply(actor, space) : !canPostTopLevel(actor, space)) throw new ChatError(403, 'امکان ارسال پیام در این گفتگو وجود ندارد');
  // A mentor's file in an open cross-caravan thread of the arena is the caravan's work: its caravan is fixed at send time
  let submission: { caravanId: string; challengeId: string } | null = null;
  if (threadRootId) {
    const root = await prisma.chatMessage.findUnique({ where: { id: threadRootId }, select: { spaceId: true, threadRootId: true, marks: true, threadReplies: true } });
    if (!root || root.spaceId !== space.id || root.threadRootId) throw new ChatError(404, 'پیام یافت نشد');
    const topic = await prisma.chatTopic.findUnique({ where: { messageId: threadRootId }, include: { challenge: { select: { category: true, rankingFinalizedAt: true, type: true } } } });
    if (topic && topic.status !== 'open') throw new ChatError(403, 'این چالش بسته شده است');
    // A quiz challenge is answered by picking options under its card; its thread is not a conversation
    if (topic && ['quiz', 'step_by_step_quiz'].includes(topic.challenge.type) && !canModerate(actor, space)) throw new ChatError(403, 'این چالش تستی است؛ گزینه‌ها را انتخاب و پاسخ را ثبت کنید');
    if (space.type === 'arena' && !canReplyInArena(actor, topic)) {
      throw new ChatError(403, 'در میدان آثار فقط در گفت‌وگوی یک چالش فراگروهیِ باز می‌توانید بنویسید');
    }
    // Only a message a moderator opened (or a challenge) takes replies under it
    const open = !!topic || root.marks.includes('thread') || root.threadReplies > 0 || canModerate(actor, space);
    if (!open) throw new ChatError(403, 'گفتگو زیر این پیام باز نشده است');
    if (space.type === 'arena' && topic && topic.challenge.category === 'inter_group' && isMentorRole(actor.role) && attachmentIds.length > 0) {
      submission = { caravanId: resolveActorCaravan(actor, req.body?.caravanId), challengeId: topic.challengeId };
    }
  }
  // Support staff answer inside a user's support conversation without joining it, like the panel does
  const answeringSupport = space.type === 'support' && space.key !== `support:${actor.id}` && isSupportRole(actor.role);
  const word = await blockedWord(body);
  if (word) throw new ChatError(400, 'این پیام شامل واژه‌ی نامناسب است');
  if (space.slowSeconds > 0 && !canModerate(actor, space)) {
    const last = await prisma.chatMessage.findFirst({ where: { spaceId: space.id, senderId: actor.id }, orderBy: { seq: 'desc' }, select: { createdAt: true } });
    if (last && Date.now() - last.createdAt.getTime() < space.slowSeconds * 1000) throw new ChatError(429, `هر ${space.slowSeconds} ثانیه یک پیام می‌توانید بفرستید`);
  }

  const { message, created } = await publishMessage({
    spaceId: space.id,
    senderId: actor.id,
    body,
    clientMessageId: req.body?.clientMessageId ? String(req.body.clientMessageId).slice(0, 64) : undefined,
    replyToId: req.body?.replyToId ? String(req.body.replyToId) : undefined,
    threadRootId,
    attachmentIds,
    mentions,
    meta: submission ? { submission: true, ...submission } : undefined,
    stayOutside: answeringSupport || undefined,
  });
  if (created) {
    // A mentor's file under an inter-group challenge in the arena is that caravan's work
    if (submission) await recordArenaSubmission(actor, submission, message);
    if (space.type === 'support' && space.key === `support:${actor.id}`) await ensureOpenCase(space.id, actor.id, body, message.seq);
    if (answeringSupport) {
      await prisma.supportCase.updateMany({ where: { spaceId: space.id, status: 'open' }, data: { status: 'reviewing', assigneeId: actor.id } });
    }
    // Bold/italic markers stay in the chat, not in the notification
    await notifyAbsent(space, actor.id, actor.name, message.body.replace(/\*\*(.+?)\*\*|__(.+?)__/gs, (_m: string, b?: string, i?: string) => b ?? i ?? ''), mentions);
  }
  res.status(created ? 201 : 200).json(message);
});

/** A closed challenge's conversation is the evidence of its evaluation. */
async function assertNotEvidence(threadRootId: string | null) {
  if (!threadRootId) return;
  const topic = await prisma.chatTopic.findUnique({ where: { messageId: threadRootId } });
  if (topic && topic.status !== 'open') throw new ChatError(403, 'پس از بسته‌شدن چالش، پیام‌های آن قابل تغییر نیست');
}

export const editMessage = handler(async (req, res, actor) => {
  const { message } = await requireMessage(actor, req.params.id);
  if (message.senderId !== actor.id) throw new ChatError(403, 'فقط پیام خودتان را می‌توانید ویرایش کنید');
  if (message.deletedAt) throw new ChatError(400, 'این پیام حذف شده است');
  await assertNotEvidence(message.threadRootId);
  const body = String(req.body?.body || '').trim();
  if (!body || body.length > MAX_BODY) throw new ChatError(400, 'متن پیام معتبر نیست');
  await prisma.chatMessage.update({ where: { id: message.id }, data: { body, editedAt: new Date() } });
  res.json(serializeMessage(await publishUpdate(message.id)));
});

export const deleteMessage = handler(async (req, res, actor) => {
  const { message, space } = await requireMessage(actor, req.params.id);
  if (message.senderId !== actor.id && !canModerate(actor, space)) throw new ChatError(403, 'اجازه‌ی حذف این پیام را ندارید');
  if (!canModerate(actor, space)) await assertNotEvidence(message.threadRootId);
  await prisma.chatMessage.update({ where: { id: message.id }, data: { deletedAt: new Date(), deletedBy: actor.id, pinnedAt: null } });
  res.json(serializeMessage(await publishUpdate(message.id)));
});

export const markRead = handler(async (req, res, actor) => {
  const { space } = await requireSpace(actor, req.params.id);
  const seq = Math.min(Number(req.body?.seq) || 0, space.lastSeq);
  await prisma.chatMember.upsert({
    where: { spaceId_userId: { spaceId: space.id, userId: actor.id } },
    update: {},
    create: { spaceId: space.id, userId: actor.id },
  });
  await prisma.chatMember.updateMany({
    where: { spaceId: space.id, userId: actor.id, lastReadSeq: { lt: seq } },
    data: { lastReadSeq: seq },
  });
  emitToSpace(space.id, 'read', { spaceId: space.id, userId: actor.id, seq });
  res.json({ success: true });
});

export const setMuted = handler(async (req, res, actor) => {
  const { space } = await requireSpace(actor, req.params.id);
  const muted = req.body?.muted === true;
  await prisma.chatMember.upsert({
    where: { spaceId_userId: { spaceId: space.id, userId: actor.id } },
    update: { muted },
    create: { spaceId: space.id, userId: actor.id, muted },
  });
  res.json({ muted });
});

export const toggleReaction = handler(async (req, res, actor) => {
  const { message, space } = await requireMessage(actor, req.params.id);
  const type = String(req.body?.type || '');
  if (!REACTION_TYPES.includes(type)) throw new ChatError(400, 'واکنش نامعتبر است');
  // Once a challenge is closed its conversation is the record of the evaluation: reactions can no longer change
  const closedTopic = await prisma.chatTopic.findFirst({ where: { messageId: message.threadRootId ?? message.id, status: 'closed' }, select: { id: true } });
  if (closedTopic) throw new ChatError(400, 'این چالش بسته شده است و واکنش‌ها دیگر قابل تغییر نیستند');
  if (type === STAR_REACTION) {
    // The star is separate from the ordinary reaction: it neither replaces it nor is replaced by it
    if (!canModerate(actor, space)) throw new ChatError(403, 'فقط راهبران می‌توانند پیام را برتر کنند');
    const star = await prisma.chatReaction.findFirst({ where: { messageId: message.id, userId: actor.id, type } });
    if (star) await prisma.chatReaction.delete({ where: { id: star.id } });
    else await prisma.chatReaction.create({ data: { messageId: message.id, userId: actor.id, type } });
    return res.json(serializeMessage(await publishUpdate(message.id)));
  }
  // One reaction per person per message: the same one again takes it back, another one replaces it
  const mine = await prisma.chatReaction.findMany({ where: { messageId: message.id, userId: actor.id, type: { not: STAR_REACTION } } });
  const same = mine.some(r => r.type === type);
  await prisma.chatReaction.deleteMany({ where: { messageId: message.id, userId: actor.id, type: { not: STAR_REACTION } } });
  if (!same) await prisma.chatReaction.create({ data: { messageId: message.id, userId: actor.id, type } });
  res.json(serializeMessage(await publishUpdate(message.id)));
});

export const votePoll = handler(async (req, res, actor) => {
  const { message } = await requireMessage(actor, req.params.id);
  const options = (message.meta as any)?.options;
  const option = Number(req.body?.option);
  if (message.kind !== 'poll' || !Array.isArray(options)) throw new ChatError(400, 'این پیام نظرسنجی نیست');
  if (!Number.isInteger(option) || option < 0 || option >= options.length) throw new ChatError(400, 'گزینه معتبر نیست');
  await prisma.chatPollVote.upsert({
    where: { messageId_userId: { messageId: message.id, userId: actor.id } },
    update: { option },
    create: { messageId: message.id, userId: actor.id, option },
  });
  res.json(serializeMessage(await publishUpdate(message.id)));
});

export const togglePin = handler(async (req, res, actor) => {
  const { message, space } = await requireMessage(actor, req.params.id);
  if (!canModerate(actor, space)) throw new ChatError(403, 'اجازه‌ی سنجاق کردن ندارید');
  await prisma.chatMessage.update({ where: { id: message.id }, data: { pinnedAt: message.pinnedAt ? null : new Date() } });
  res.json(serializeMessage(await publishUpdate(message.id)));
});

export const listPins = handler(async (req, res, actor) => {
  const { space } = await requireSpace(actor, req.params.id);
  const rows = await prisma.chatMessage.findMany({
    where: { spaceId: space.id, pinnedAt: { not: null }, id: { notIn: await sealedMessageIds(actor, space) } }, orderBy: { pinnedAt: 'desc' }, take: 20, include: MESSAGE_INCLUDE,
  });
  res.json(rows.map(serializeMessage));
});

export const searchMessages = handler(async (req, res, actor) => {
  const { space } = await requireSpace(actor, req.params.id);
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json([]);
  // "#برتر" lists the messages a mentor starred; words after it narrow them down
  const top = /^#\s*(برتر|top)(?=\s|$)\s*/i.exec(q);
  const text = top ? q.slice(top[0].length).trim() : q;
  const rows = await prisma.chatMessage.findMany({
    where: {
      spaceId: space.id, deletedAt: null, id: { notIn: await sealedMessageIds(actor, space) },
      ...(text ? { body: { contains: text, mode: 'insensitive' as const } } : {}),
      ...(top ? { reactions: { some: { type: STAR_REACTION } } } : {}),
    },
    orderBy: { seq: 'desc' }, take: 30, include: MESSAGE_INCLUDE,
  });
  res.json(rows.map(serializeMessage));
});

/** People a member can mention in a space. */
export const listPeople = handler(async (req, res, actor) => {
  const { space } = await requireSpace(actor, req.params.id);
  res.json(await peopleOf(space));
});

/** Moderators silence a member for a while; 0 lifts it. */
export const muteMember = handler(async (req, res, actor) => {
  const { space } = await requireSpace(actor, req.params.id);
  if (!canModerate(actor, space)) throw new ChatError(403, 'اجازه‌ی این کار را ندارید');
  const minutes = Number(req.body?.minutes);
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 7 * 24 * 60) throw new ChatError(400, 'مدت معتبر نیست');
  const mutedUntil = minutes ? new Date(Date.now() + minutes * 60000) : null;
  await prisma.chatMember.upsert({
    where: { spaceId_userId: { spaceId: space.id, userId: req.params.userId } },
    update: { mutedUntil },
    create: { spaceId: space.id, userId: req.params.userId, mutedUntil },
  });
  res.json({ mutedUntil });
});

/** Stations this conversation has material from, for the filter. */
export const listSpaceStations = handler(async (req, res, actor) => {
  const { space } = await requireSpace(actor, req.params.id);
  const rows = await prisma.chatMessage.findMany({ where: { spaceId: space.id, stationId: { not: null } }, distinct: ['stationId'], select: { stationId: true } });
  res.json(await prisma.station.findMany({ where: { id: { in: rows.map(r => r.stationId!) } }, select: { id: true, title: true }, orderBy: { orderIndex: 'asc' } }));
});

export const uploadFile = handler(async (req, res, actor) => {
  const file = req.file;
  if (!file) throw new ChatError(400, 'فایلی ارسال نشده است');
  try {
    const { space } = await requireSpace(actor, String(req.body?.spaceId || ''));
    fs.chmod(file.path, 0o600, () => undefined);
    const day =new Date(Date.now() - 24 * 3600 * 1000);
    const used = await prisma.chatAttachment.aggregate({ where: { uploaderId: actor.id, createdAt: { gte: day } }, _sum: { size: true } });
    if ((used._sum.size || 0) + file.size > DAILY_UPLOAD_BYTES) throw new ChatError(400, 'سهمیه‌ی ارسال فایل امروز شما تمام شده است');
    const attachment = await prisma.chatAttachment.create({
      data: {
        spaceId: space.id,
        uploaderId: actor.id,
        storageKey: file.filename,
        name: Buffer.from(file.originalname, 'latin1').toString('utf8').slice(0, 200),
        mime: file.mimetype,
        size: file.size,
        kind: attachmentKind(file.mimetype),
      },
    });
    res.status(201).json({ id: attachment.id, name: attachment.name, kind: attachment.kind, url: signFileUrl(attachment.id) });
  } catch (e) {
    fs.unlink(file.path, () => undefined);
    throw e;
  }
});

/** Serves a file for a signed, expiring link. Outside the auth middleware: image and audio players send no header. */
export async function serveFile(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    if (!verifyFileToken(id, String(req.query.t || ''))) return res.status(403).json({ error: 'لینک فایل معتبر نیست' });
    if ((await getChatSettings()).mode === 'off') return res.status(403).json({ error: 'بخش چت غیرفعال است', code: 'CHAT_DISABLED' });
    const attachment = await prisma.chatAttachment.findUnique({ where: { id }, include: { message: { select: { deletedAt: true } } } });
    if (!attachment || attachment.message?.deletedAt) return res.status(404).json({ error: 'فایل یافت نشد' });

    const inline = attachment.kind !== 'file';
    res.setHeader('Content-Type', attachment.mime);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    // User content must never run as active content on our origin, whatever its bytes look like
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(attachment.name)}`);
    res.sendFile(path.basename(attachment.storageKey), { root: path.resolve(CHAT_FILES_DIR) });
  } catch (e) {
    console.error('chat serveFile error:', e);
    res.status(500).json({ error: 'خطا در دریافت فایل' });
  }
}

/** A fresh signed link for a file the caller may see: saved copies of a message carry links that have expired. */
export const attachmentLink = handler(async (req, res, actor) => {
  const attachment = await prisma.chatAttachment.findUnique({ where: { id: req.params.id }, select: { id: true, messageId: true } });
  if (!attachment || !attachment.messageId) throw new ChatError(404, 'فایل یافت نشد');
  const { message } = await requireMessage(actor, attachment.messageId);
  if (message.deletedAt) throw new ChatError(404, 'فایل یافت نشد');
  res.json({ url: signFileUrl(attachment.id) });
});
