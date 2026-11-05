import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import prisma from '../../config/db';
import { uploadsDir } from '../../controllers/mediaController';
import { canModerate, canTag, ChatActor } from './access';
import { handler, requireSpace } from './http';
import { isOnline, onlineUserIds } from './realtime';
import { caravanGroupTitle, ChatError, customCaravanGroupTitle, setCaravanGroupTitle, signFileUrl } from './service';
import { defaultChatImage } from '../../controllers/appImagesController';
import { sealedMessageIds } from './arenaPrivacy';

const PERSON_SELECT = { id: true, name: true, avatarUrl: true, role: true, gender: true };
const PUBLIC_TYPES = new Set(['announcements', 'arena']);
const MEDIA_LIMIT = 60;
const STATS_DAYS = 30;

type SpaceRow = { id: string; type: string; caravanId: string | null };

/** Everyone who belongs to a space, with whether they are connected right now. */
/** Members a moderator silenced in this space and until when; only mutes still running. */
export async function activeMutes(spaceId: string): Promise<Map<string, Date>> {
  const rows = await prisma.chatMember.findMany({ where: { spaceId, mutedUntil: { gt: new Date() } }, select: { userId: true, mutedUntil: true } });
  return new Map(rows.map(r => [r.userId, r.mutedUntil!]));
}

/** The people of a space; with [withMutes] (moderators only) each carries `mutedUntil` while silenced. */
export async function peopleWithMutes(space: SpaceRow, withMutes: boolean) {
  const people = await peopleOf(space);
  if (!withMutes) return people;
  const mutes = await activeMutes(space.id);
  return people.map(p => ({ ...p, mutedUntil: mutes.get(p.id) ?? null }));
}

export async function peopleOf(space: SpaceRow) {
  let people: { id: string; name: string; avatarUrl: string | null; role: string; gender: string | null }[];
  if (space.caravanId) {
    const caravan = await prisma.caravan.findUnique({ where: { id: space.caravanId }, select: { mentor: { select: PERSON_SELECT } } });
    const members = await prisma.user.findMany({ where: { caravanId: space.caravanId, role: 'student' }, select: PERSON_SELECT, take: 200 });
    people = [...(caravan?.mentor ? [caravan.mentor] : []), ...members];
  } else {
    const members = await prisma.chatMember.findMany({ where: { spaceId: space.id }, select: { user: { select: PERSON_SELECT } }, take: 200 });
    people = members.map(m => m.user);
  }
  return people.map(p => ({ ...p, online: isOnline(p.id) }));
}

/** Who may see how much a member takes part: the space's moderators, the member's mentor and the member. */
async function mayAnalyze(actor: ChatActor, space: SpaceRow, userId: string): Promise<boolean> {
  if (actor.id === userId || canModerate(actor, space) || canTag(actor, space)) return true;
  if (!actor.mentoredCaravanIds.length) return false;
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { caravanId: true } });
  return !!target?.caravanId && actor.mentoredCaravanIds.includes(target.caravanId);
}

/** Header of a group or channel profile: counts, the caravan's rank and its members. */
export const spaceProfile = handler(async (req, res, actor) => {
  const { space } = await requireSpace(actor, req.params.id);
  const isPublic = PUBLIC_TYPES.has(space.type);
  const members = isPublic ? [] : await peopleWithMutes(space, canModerate(actor, space));
  const memberCount = isPublic ? await prisma.user.count({ where: { role: { in: ['student', 'mentor'] } } }) : members.length;
  const onlineCount = isPublic ? onlineUserIds().size : members.filter(m => m.online).length;

  let rank: number | null = null;
  let caravanName: string | null = null;
  let coverImageUrl: string | null = null;
  let slogan: string | null = null;
  if (space.caravanId) {
    const own = await prisma.caravan.findUnique({ where: { id: space.caravanId }, select: { coverImageUrl: true, slogan: true } });
    coverImageUrl = own?.coverImageUrl || null;
    slogan = own?.slogan || null;
    const caravans = await prisma.caravan.findMany({ where: { isDeleted: false }, select: { id: true, name: true, groupPoints: true }, orderBy: { groupPoints: 'desc' } });
    const at = caravans.findIndex(c => c.id === space.caravanId);
    if (at >= 0) { rank = at + 1; caravanName = caravans[at].name; }
  }
  const title = space.type === 'caravan' && caravanName ? caravanGroupTitle(caravanName, space.title) : space.title;
  // the group's own name (null while it follows the caravan's name), for the rename dialog
  const groupTitle = space.type === 'caravan' ? customCaravanGroupTitle(space.title) : null;
  const hasOwnCover = !!coverImageUrl;
  // no picture of its own: the default the admin set for this kind of space («تصاویر اپلیکیشن»)
  if (!coverImageUrl && space.type !== 'direct') coverImageUrl = await defaultChatImage(space.type);
  res.json({
    id: space.id, type: space.type, title, groupTitle, caravanName, coverImageUrl, hasOwnCover, slogan, memberCount, onlineCount, rank, members,
    canModerate: canModerate(actor, space),
    canEditCover: canEditCover(actor, space),
  });
});

/** Sets or clears the slogan of the caravan group (at most 30 characters); the caravan's mentor or an admin. */
export const setSpaceSlogan = handler(async (req, res, actor) => {
  const { space } = await requireSpace(actor, req.params.id);
  if (!canEditCover(actor, space)) throw new ChatError(403, 'فقط راهبر کاروان می‌تواند شعار گروه را تغییر دهد');
  const slogan = String(req.body?.slogan ?? '').trim().slice(0, 30) || null;
  await prisma.caravan.update({ where: { id: space.caravanId! }, data: { slogan } });
  res.json({ slogan });
});

/**
 * Renames the caravan group; the caravan's mentor or an admin. By default the group carries the caravan's
 * name; an empty name (or the caravan's own) makes it follow the caravan's name again.
 */
export const setSpaceTitle = handler(async (req, res, actor) => {
  const { space } = await requireSpace(actor, req.params.id);
  if (!canEditCover(actor, space)) throw new ChatError(403, 'فقط راهبر کاروان می‌تواند نام گروه را تغییر دهد');
  const title = await setCaravanGroupTitle(space.caravanId!, req.body?.title);
  const stored = await prisma.chatSpace.findUnique({ where: { id: space.id }, select: { title: true } });
  res.json({ title, groupTitle: customCaravanGroupTitle(stored?.title) });
});

const COVER_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_COVER_BYTES = 5 * 1024 * 1024;

/** The caravan's picture is set by its mentor (or an admin) from the caravan group. */
function canEditCover(actor: ChatActor, space: SpaceRow): boolean {
  return space.type === 'caravan' && !!space.caravanId && canModerate(actor, space) && (actor.mentoredCaravanIds.includes(space.caravanId) || ['admin'].includes(String(actor.role).toLowerCase()));
}

export const coverUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => cb(null, `caravan-${crypto.randomBytes(16).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: MAX_COVER_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!COVER_EXTENSIONS.has(path.extname(file.originalname || '').toLowerCase())) {
      return cb(Object.assign(new Error('فقط تصویر (JPG، PNG یا WEBP) مجاز است'), { status: 400 }));
    }
    cb(null, true);
  },
});

/** Removes a stored cover file, only when it is one this feature created. */
function dropCoverFile(url: string | null | undefined) {
  const name = url ? path.basename(url) : '';
  if (name.startsWith('caravan-')) fs.unlink(path.join(uploadsDir, name), () => undefined);
}

/** Sets (file sent) or clears (no file) the picture of the caravan this group belongs to. */
export const setSpaceCover = handler(async (req, res, actor) => {
  const file = req.file;
  try {
    const { space } = await requireSpace(actor, req.params.id);
    if (!canEditCover(actor, space)) throw new ChatError(403, 'فقط راهبر کاروان می‌تواند عکس گروه را تغییر دهد');
    const current = await prisma.caravan.findUnique({ where: { id: space.caravanId! }, select: { coverImageUrl: true } });
    const coverImageUrl = file ? `/uploads/${file.filename}` : null;
    await prisma.caravan.update({ where: { id: space.caravanId! }, data: { coverImageUrl } });
    dropCoverFile(current?.coverImageUrl);
    res.json({ coverImageUrl });
  } catch (e) {
    if (file) fs.unlink(file.path, () => undefined);
    throw e;
  }
});

/** A member as seen from a space: public numbers for everyone, participation for those who guide them. */
export const memberProfile = handler(async (req, res, actor) => {
  const { space } = await requireSpace(actor, req.params.id);
  const userId = req.params.userId;
  const isPublic = PUBLIC_TYPES.has(space.type);
  if (!isPublic) {
    const belongs = (await peopleOf(space)).some(p => p.id === userId)
      || !!(await prisma.chatMessage.findFirst({ where: { spaceId: space.id, senderId: userId }, select: { id: true } }));
    if (!belongs) throw new ChatError(404, 'این فرد عضو این گفتگو نیست');
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ...PERSON_SELECT, slogan: true, caravanId: true, zarikBalance: true, nakh: true, farsh: true, beyragh: true, levelFrame: true, caravan: { select: { name: true } } },
  });
  if (!user) throw new ChatError(404, 'کاربر یافت نشد');

  // Rank among the members of their caravan, by زریک
  let rank: number | null = null;
  if (user.caravanId) {
    rank = (await prisma.user.count({ where: { caravanId: user.caravanId, role: 'student', zarikBalance: { gt: user.zarikBalance } } })) + 1;
  }

  let stats: Record<string, unknown> | null = null;
  if (await mayAnalyze(actor, space, userId)) {
    const since = new Date(Date.now() - STATS_DAYS * 24 * 3600 * 1000);
    const [mine, all, topics, recent, reactions, last] = await Promise.all([
      prisma.chatMessage.count({ where: { spaceId: space.id, senderId: userId, deletedAt: null } }),
      prisma.chatMessage.count({ where: { spaceId: space.id, senderId: { not: null }, deletedAt: null } }),
      prisma.chatTopic.findMany({ where: { spaceId: space.id }, select: { messageId: true } }),
      prisma.chatMessage.findMany({ where: { spaceId: space.id, senderId: userId, createdAt: { gte: since } }, select: { createdAt: true } }),
      prisma.chatReaction.count({ where: { message: { spaceId: space.id, senderId: userId } } }),
      prisma.chatMessage.findFirst({ where: { spaceId: space.id, senderId: userId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    ]);
    const joined = topics.length
      ? (await prisma.chatMessage.findMany({ where: { threadRootId: { in: topics.map(t => t.messageId) }, senderId: userId }, distinct: ['threadRootId'], select: { threadRootId: true } })).length
      : 0;
    const activeDays = new Set(recent.map(m => m.createdAt.toISOString().slice(0, 10))).size;
    stats = {
      messages: mine,
      messageShare: all ? Math.round((mine / all) * 100) : 0,
      sessions: topics.length,
      sessionsJoined: joined,
      sessionShare: topics.length ? Math.round((joined / topics.length) * 100) : 0,
      reactionsReceived: reactions,
      activeDays,
      activeDaysShare: Math.round((activeDays / STATS_DAYS) * 100),
      lastActiveAt: last?.createdAt ?? null,
    };
  }

  res.json({
    id: user.id, name: user.name, avatarUrl: user.avatarUrl, role: user.role, gender: user.gender, slogan: user.slogan,
    caravanId: user.caravanId, caravanName: user.caravan?.name ?? null,
    zarik: user.zarikBalance, nakh: user.nakh, farsh: user.farsh, derafsh: user.beyragh, levelFrame: user.levelFrame,
    rank, online: isOnline(user.id), stats,
    // Moderators see whether this member is silenced here, to lift it
    mutedUntil: canModerate(actor, space) ? ((await activeMutes(space.id)).get(user.id) ?? null) : undefined,
  });
});

/**
 * Photos, voices, links or sessions (threads) of a space; with userId, only that member's.
 * Newest first. Pages: `limit` (default and maximum MEDIA_LIMIT) and `before` (ISO time of the last item
 * already held) give the next older items; without them the first MEDIA_LIMIT come back as before.
 */
export const spaceMedia = handler(async (req, res, actor) => {
  const { space } = await requireSpace(actor, req.params.id);
  const kind = String(req.query.kind || 'image');
  const userId = typeof req.query.userId === 'string' && req.query.userId ? req.query.userId : undefined;
  const limit = Math.min(Math.max(Math.floor(Number(req.query.limit)) || MEDIA_LIMIT, 1), MEDIA_LIMIT);
  const beforeRaw = typeof req.query.before === 'string' ? new Date(req.query.before) : null;
  const olderThan = beforeRaw && !isNaN(beforeRaw.getTime()) ? { createdAt: { lt: beforeRaw } } : {};
  const sealed = await sealedMessageIds(actor, space);

  if (kind === 'image' || kind === 'audio') {
    const rows = await prisma.chatAttachment.findMany({
      where: { spaceId: space.id, kind, messageId: { not: null, notIn: sealed }, message: { deletedAt: null }, ...olderThan, ...(userId ? { uploaderId: userId } : {}) },
      orderBy: { createdAt: 'desc' }, take: limit,
      select: { id: true, name: true, kind: true, createdAt: true, messageId: true },
    });
    return res.json(rows.map(a => ({ ...a, url: signFileUrl(a.id) })));
  }

  if (kind === 'link') {
    const rows = await prisma.chatMessage.findMany({
      where: { spaceId: space.id, deletedAt: null, id: { notIn: sealed }, body: { contains: 'http' }, ...olderThan, ...(userId ? { senderId: userId } : {}) },
      orderBy: { createdAt: 'desc' }, take: limit,
      select: { id: true, body: true, createdAt: true, sender: { select: { name: true } } },
    });
    return res.json(rows.map(m => ({ id: m.id, body: m.body.slice(0, 300), createdAt: m.createdAt, senderName: m.sender?.name ?? '' })));
  }

  if (kind === 'session') {
    // Sessions live in groups and channels; a private conversation has none
    if (space.type === 'direct' || space.type === 'support') return res.json([]);
    const rows = await prisma.chatMessage.findMany({
      where: {
        spaceId: space.id, threadRootId: null, deletedAt: null, ...olderThan,
        OR: [{ threadReplies: { gt: 0 } }, { topic: { isNot: null } }],
      },
      orderBy: { createdAt: 'desc' }, take: limit,
      select: { id: true, body: true, kind: true, meta: true, threadReplies: true, createdAt: true, topic: { select: { id: true, status: true } } },
    });
    let list = rows;
    if (userId) {
      const joined = new Set((await prisma.chatMessage.findMany({
        where: { threadRootId: { in: rows.map(r => r.id) }, senderId: userId }, distinct: ['threadRootId'], select: { threadRootId: true },
      })).map(r => r.threadRootId));
      list = rows.filter(r => joined.has(r.id));
    }
    return res.json(list.map(m => ({
      id: m.id, kind: m.kind, threadReplies: m.threadReplies, createdAt: m.createdAt, topicId: m.topic?.id ?? null, topicStatus: m.topic?.status ?? null,
      title: String((m.meta as any)?.title || m.body || 'گفتگو').slice(0, 160),
    })));
  }

  throw new ChatError(400, 'نوع نامعتبر است');
});
