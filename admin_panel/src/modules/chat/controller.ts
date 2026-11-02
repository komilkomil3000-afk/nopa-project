import fs from 'fs';
import path from 'path';
import { Response } from 'express';
import multer from 'multer';
import prisma from '../../config/db';
import { AuthRequest } from '../../middleware/auth';
import { ALLOWED_UPLOADS } from '../../controllers/mediaController';
import { getChatSettings } from '../../services/chatSettings';
import { canModerate, canPostTopLevel, canStartDirect, ChatActor, loadActor } from './access';
import { emitToSpace, isOnline, refreshUserRooms } from './realtime';
import {
  attachmentKind, ChatError, createMessage, directKey, findVisibleSpace, MAX_BODY, MESSAGE_INCLUDE, PAGE_SIZE,
  randomStorageName, REACTION_TYPES, serializeMessage, signFileUrl, verifyFileToken, visibleSpaces,
} from './service';

const FILES_DIR = process.env.CHAT_FILES_DIR || path.join(__dirname, '../../../chat-files');
const MAX_FILE_BYTES = 20 * 1024 * 1024;
fs.mkdirSync(FILES_DIR, { recursive: true });

export const chatUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, FILES_DIR),
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

type Handler = (req: AuthRequest, res: Response, actor: ChatActor) => Promise<unknown>;

/** Loads the caller and turns a ChatError into its response. */
function handler(fn: Handler) {
  return async (req: AuthRequest, res: Response) => {
    try {
      const actor = await loadActor(req.user!.id);
      if (!actor) return res.status(401).json({ error: 'کاربر یافت نشد' });
      await fn(req, res, actor);
    } catch (e: any) {
      if (e instanceof ChatError) return res.status(e.status).json({ error: e.message });
      console.error('chat error:', e);
      res.status(500).json({ error: 'خطای سرور در چت' });
    }
  };
}

async function requireSpace(actor: ChatActor, spaceId: string) {
  const found = await findVisibleSpace(actor, spaceId);
  if (!found) throw new ChatError(404, 'گفتگو یافت نشد');
  return found;
}

async function requireMessage(actor: ChatActor, messageId: string) {
  const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!message) throw new ChatError(404, 'پیام یافت نشد');
  const { space } = await requireSpace(actor, message.spaceId);
  return { message, space };
}

async function publishUpdate(messageId: string) {
  const row = await prisma.chatMessage.findUniqueOrThrow({ where: { id: messageId }, include: MESSAGE_INCLUDE });
  emitToSpace(row.spaceId, 'message:update', serializeMessage(row));
  return row;
}

export const listSpaces = handler(async (_req, res, actor) => {
  const { spaces, members } = await visibleSpaces(actor);
  const ids = spaces.map(s => s.id);
  const [lastMessages, directMembers] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { spaceId: { in: ids }, threadRootId: null },
      orderBy: { seq: 'desc' },
      distinct: ['spaceId'],
      select: { spaceId: true, body: true, kind: true, deletedAt: true, createdAt: true, sender: { select: { name: true } } },
    }),
    prisma.chatMember.findMany({
      where: { spaceId: { in: spaces.filter(s => s.type === 'direct').map(s => s.id) }, userId: { not: actor.id } },
      select: { spaceId: true, lastReadSeq: true, user: { select: { id: true, name: true, avatarUrl: true, role: true, gender: true } } },
    }),
  ]);

  res.json(spaces.map(s => {
    const peer = directMembers.find(m => m.spaceId === s.id);
    const last = lastMessages.find(m => m.spaceId === s.id);
    const me = members.get(s.id);
    return {
      id: s.id,
      type: s.type,
      title: peer?.user.name || (s.caravan && s.type === 'caravan' ? s.caravan.name : s.title),
      peer: peer?.user || null,
      peerReadSeq: peer?.lastReadSeq ?? 0,
      lastSeq: s.lastSeq,
      lastReadSeq: me?.lastReadSeq ?? 0,
      unread: Math.max(0, s.lastSeq - (me?.lastReadSeq ?? 0)),
      muted: !!me?.muted,
      canPost: canPostTopLevel(actor, s),
      canModerate: canModerate(actor, s),
      lastMessage: last && {
        senderName: last.sender?.name || '',
        preview: last.deletedAt ? '' : (last.body.slice(0, 80) || (last.kind === 'file' ? 'فایل' : '')),
        createdAt: last.createdAt,
      },
    };
  }));
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
    const people = await prisma.user.findMany({ where: { OR: [{ caravanId: { in: actor.mentoredCaravanIds }, role: 'student' }, { role: 'admin' }] }, select, orderBy: { name: 'asc' } });
    return res.json(people);
  }
  if (role === 'admin' || role === 'sub_admin') {
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

  const rows = await prisma.chatMessage.findMany({
    where: { spaceId: space.id, threadRootId, seq: { lt: beforeSeq, gt: afterSeq } },
    orderBy: { seq: afterSeq ? 'asc' : 'desc' },
    take: PAGE_SIZE,
    include: MESSAGE_INCLUDE,
  });
  const ordered = afterSeq ? rows : rows.reverse();
  res.json({ messages: ordered.map(serializeMessage), lastReadSeq: member?.lastReadSeq ?? 0 });
});

export const sendMessage = handler(async (req, res, actor) => {
  const { space, member } = await requireSpace(actor, req.params.id);
  const body = String(req.body?.body || '').trim();
  const threadRootId = req.body?.threadRootId ? String(req.body.threadRootId) : undefined;
  const attachmentIds: string[] = Array.isArray(req.body?.attachmentIds) ? req.body.attachmentIds.map(String) : [];
  const mentions: string[] = Array.isArray(req.body?.mentions) ? req.body.mentions.map(String).slice(0, 20) : [];

  if (!body && attachmentIds.length === 0) throw new ChatError(400, 'پیام خالی است');
  if (body.length > MAX_BODY) throw new ChatError(400, `پیام نباید بیشتر از ${MAX_BODY} نویسه باشد`);
  if (member?.mutedUntil && member.mutedUntil > new Date()) throw new ChatError(403, 'ارسال پیام برای شما موقتاً بسته است');
  if (!threadRootId && !canPostTopLevel(actor, space)) throw new ChatError(403, 'امکان ارسال پیام در این گفتگو وجود ندارد');

  const { row, created } = await createMessage({
    spaceId: space.id,
    senderId: actor.id,
    body,
    clientMessageId: req.body?.clientMessageId ? String(req.body.clientMessageId).slice(0, 64) : undefined,
    replyToId: req.body?.replyToId ? String(req.body.replyToId) : undefined,
    threadRootId,
    attachmentIds,
    mentions,
  });
  const message = serializeMessage(row);
  if (created) {
    emitToSpace(space.id, 'message:new', message);
    if (threadRootId) await publishUpdate(threadRootId);
    await notifyAbsent(space, actor, message.body, mentions);
  }
  res.status(created ? 201 : 200).json(message);
});

/** People who are offline hear about a mention or a private message through the app's notifications. */
async function notifyAbsent(space: { id: string; type: string; title: string }, actor: ChatActor, body: string, mentions: string[]) {
  const targets = new Set(mentions);
  if (space.type === 'direct') {
    const others = await prisma.chatMember.findMany({ where: { spaceId: space.id, userId: { not: actor.id } }, select: { userId: true } });
    others.forEach(o => targets.add(o.userId));
  }
  targets.delete(actor.id);
  const absent = Array.from(targets).filter(id => !isOnline(id));
  if (absent.length === 0) return;
  await prisma.notification.createMany({
    data: absent.map(userId => ({ userId, title: `پیام از ${actor.name}`, message: body.slice(0, 140) || 'فایل', type: 'chat' })),
  });
}

export const editMessage = handler(async (req, res, actor) => {
  const { message } = await requireMessage(actor, req.params.id);
  if (message.senderId !== actor.id) throw new ChatError(403, 'فقط پیام خودتان را می‌توانید ویرایش کنید');
  if (message.deletedAt) throw new ChatError(400, 'این پیام حذف شده است');
  const body = String(req.body?.body || '').trim();
  if (!body || body.length > MAX_BODY) throw new ChatError(400, 'متن پیام معتبر نیست');
  await prisma.chatMessage.update({ where: { id: message.id }, data: { body, editedAt: new Date() } });
  res.json(serializeMessage(await publishUpdate(message.id)));
});

export const deleteMessage = handler(async (req, res, actor) => {
  const { message, space } = await requireMessage(actor, req.params.id);
  if (message.senderId !== actor.id && !canModerate(actor, space)) throw new ChatError(403, 'اجازه‌ی حذف این پیام را ندارید');
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
  const { message } = await requireMessage(actor, req.params.id);
  const type = String(req.body?.type || '');
  if (!REACTION_TYPES.includes(type)) throw new ChatError(400, 'واکنش نامعتبر است');
  const key = { messageId_userId_type: { messageId: message.id, userId: actor.id, type } };
  const existing = await prisma.chatReaction.findUnique({ where: key });
  if (existing) await prisma.chatReaction.delete({ where: key });
  else await prisma.chatReaction.create({ data: { messageId: message.id, userId: actor.id, type } });
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
    where: { spaceId: space.id, pinnedAt: { not: null } }, orderBy: { pinnedAt: 'desc' }, take: 20, include: MESSAGE_INCLUDE,
  });
  res.json(rows.map(serializeMessage));
});

export const searchMessages = handler(async (req, res, actor) => {
  const { space } = await requireSpace(actor, req.params.id);
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json([]);
  const rows = await prisma.chatMessage.findMany({
    where: { spaceId: space.id, deletedAt: null, body: { contains: q, mode: 'insensitive' } },
    orderBy: { seq: 'desc' }, take: 30, include: MESSAGE_INCLUDE,
  });
  res.json(rows.map(serializeMessage));
});

/** People a member can mention in a space. */
export const listPeople = handler(async (req, res, actor) => {
  const { space } = await requireSpace(actor, req.params.id);
  const select = { id: true, name: true, avatarUrl: true, role: true, gender: true };
  if (space.caravanId) {
    const caravan = await prisma.caravan.findUnique({ where: { id: space.caravanId }, select: { mentor: { select } } });
    const members = await prisma.user.findMany({ where: { caravanId: space.caravanId, role: 'student' }, select, take: 200 });
    return res.json([...(caravan?.mentor ? [caravan.mentor] : []), ...members]);
  }
  const members = await prisma.chatMember.findMany({ where: { spaceId: space.id }, select: { user: { select } }, take: 200 });
  res.json(members.map(m => m.user));
});

export const uploadFile = handler(async (req, res, actor) => {
  const file = req.file;
  if (!file) throw new ChatError(400, 'فایلی ارسال نشده است');
  try {
    const { space } = await requireSpace(actor, String(req.body?.spaceId || ''));
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
    const attachment = await prisma.chatAttachment.findUnique({ where: { id } });
    if (!attachment) return res.status(404).json({ error: 'فایل یافت نشد' });

    const inline = attachment.kind !== 'file';
    res.setHeader('Content-Type', attachment.mime);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(attachment.name)}`);
    res.sendFile(path.basename(attachment.storageKey), { root: path.resolve(FILES_DIR) });
  } catch (e) {
    console.error('chat serveFile error:', e);
    res.status(500).json({ error: 'خطا در دریافت فایل' });
  }
}
