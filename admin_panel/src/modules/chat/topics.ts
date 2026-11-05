import { Challenge } from '@prisma/client';
import prisma from '../../config/db';
import { canModerate, canTag, ChatActor } from './access';
import { handler, requireMessage, requireSpace } from './http';
import { publishMessage, publishUpdate } from './publish';
import { refreshUserRooms } from './realtime';
import { ChatError, directKey, ensureCaravanSpaces, ensureSpace, globalSpace, MESSAGE_INCLUDE, serializeMessage } from './service';
import { generateInsight } from './insights';
import { isMentorRole } from '../../utils/roles';
import { categoryLabel } from '../../services/challengeTaxonomy';

async function cardMeta(c: Challenge) {
  const [station, creator, tag] = await Promise.all([
    c.stationId ? prisma.station.findUnique({ where: { id: c.stationId }, select: { title: true } }) : null,
    prisma.user.findUnique({ where: { id: c.createdByMentorId }, select: { name: true, role: true } }),
    // «شخصی» / «گروهی» / «فراگروهی», as named in the panel's «فرهنگ اصطلاحات»
    categoryLabel(c.category),
  ]);
  return {
    challengeId: c.id,
    category: c.category,
    tag,
    title: c.title,
    description: c.description.slice(0, 3000),
    stationTitle: station?.title || null,
    creatorName: creator?.role === 'admin' ? 'مدیر سیستم' : (creator?.name || 'راهبر'),
    creatorRole: creator?.role ?? 'mentor',
    startDate: c.startDate,
    dueDate: c.dueDate,
    reward: c.category === 'inter_group'
      ? 'درفش برای کاروان و زریک برای اعضا'
      : (c.rewardAssetType === 'nakh' ? `${c.rewardMin} تا ${c.rewardMax} کلاف` : `${c.rewardMax || c.rewardZarik} زریک`),
  };
}

async function directSpace(a: string, b: string) {
  const space = await ensureSpace(directKey(a, b), { type: 'direct', title: 'گفتگوی خصوصی' });
  await prisma.chatMember.createMany({ data: [a, b].map(userId => ({ spaceId: space.id, userId })), skipDuplicates: true });
  await refreshUserRooms([a, b]);
  return space;
}

/** The conversations a challenge belongs in. Rival caravans each get a private one. */
type Target = { spaceId: string; recipientId: string | null; caravanId: string | null };

async function targetsOf(c: Challenge): Promise<Target[]> {
  if (c.category === 'individual') {
    const out: Target[] = [];
    for (const recipientId of c.recipientIds) out.push({ spaceId: (await directSpace(c.createdByMentorId, recipientId)).id, recipientId, caravanId: null });
    return out;
  }
  // A caravan's challenge group only gets its own challenges: its mentor's, or the admin's for this caravan (or for all)
  const caravanIds = c.caravanId ? [c.caravanId] : (await prisma.caravan.findMany({ select: { id: true } })).map(x => x.id);
  const out: Target[] = [];
  for (const caravanId of caravanIds) {
    await ensureCaravanSpaces(caravanId);
    const space = await prisma.chatSpace.findUniqueOrThrow({ where: { key: `challenges:${caravanId}` } });
    out.push({ spaceId: space.id, recipientId: null, caravanId });
  }
  // An inter-group challenge is also announced in the shared exhibition ("میدان آثار")
  if (c.category === 'inter_group') out.push({ spaceId: (await globalSpace('arena')).id, recipientId: null, caravanId: null });
  return out;
}

/** Puts a challenge's card everywhere it belongs. Safe to repeat: existing cards are refreshed. */
export async function syncChallengeCards(challengeId: string): Promise<void> {
  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge) return;
  const existingTopics = await prisma.chatTopic.count({ where: { challengeId } });
  // A timed challenge stays out of sight until it starts; the worker publishes it then
  if (challenge.startDate && challenge.startDate > new Date() && existingTopics === 0) return;
  const meta = await cardMeta(challenge);

  for (const { spaceId, recipientId, caravanId } of await targetsOf(challenge)) {
    const scopeKey = `${challenge.id}:${spaceId}:${recipientId || ''}`;
    // In a caravan's own group the card is posted under that caravan's mentor, not the system
    const mentor = caravanId
      ? (await prisma.caravan.findUnique({ where: { id: caravanId }, select: { mentor: { select: { id: true, name: true } } } }))?.mentor ?? null
      : null;
    const spaceMeta = mentor ? { ...meta, mentorName: mentor.name } : meta;
    const existing = await prisma.chatTopic.findUnique({ where: { scopeKey } });
    if (existing) {
      const current = await prisma.chatMessage.findUnique({ where: { id: existing.messageId }, select: { meta: true } });
      const finalAnswer = (current?.meta as any)?.finalAnswer;
      await prisma.chatMessage.update({ where: { id: existing.messageId }, data: { meta: { ...spaceMeta, finalAnswer }, body: challenge.title, ...(mentor ? { senderId: mentor.id } : {}) } });
      await publishUpdate(existing.messageId);
      continue;
    }
    const { message } = await publishMessage({
      spaceId, botKey: 'challenge', body: challenge.title, kind: 'challenge', meta: spaceMeta, stationId: challenge.stationId || undefined,
      senderId: mentor?.id, stayOutside: true, attachmentIds: [], mentions: [],
    });
    await prisma.chatTopic.create({ data: { scopeKey, messageId: message.id, spaceId, challengeId: challenge.id, recipientId } });
    await publishUpdate(message.id);
  }
}

/** Called by the challenge screens. A chat failure must never fail the challenge itself. */
export function syncChallengeCardsQuietly(challengeId: string): void {
  syncChallengeCards(challengeId).catch(e => console.error('syncChallengeCards error:', e));
}

/** Hides the cards before a challenge is deleted. */
export async function removeChallengeCards(challengeId: string): Promise<void> {
  const topics = await prisma.chatTopic.findMany({ where: { challengeId } });
  for (const t of topics) {
    await prisma.chatMessage.update({ where: { id: t.messageId }, data: { deletedAt: new Date() } });
    await publishUpdate(t.messageId);
  }
}

/** Challenges still running when chat is switched on get their cards too. */
export async function backfillChallengeCards(): Promise<void> {
  const running = await prisma.challenge.findMany({
    where: { chatTopics: { none: {} }, rankingFinalizedAt: null, OR: [{ dueDate: null }, { dueDate: { gt: new Date() } }] },
    select: { id: true },
    take: 500,
  });
  for (const c of running) await syncChallengeCards(c.id);
}

export async function requireTopic(actor: ChatActor, topicId: string) {
  const topic = await prisma.chatTopic.findUnique({ where: { id: topicId }, include: { challenge: true, message: true } });
  if (!topic) throw new ChatError(404, 'گفتگوی چالش یافت نشد');
  const { space } = await requireSpace(actor, topic.spaceId);
  return { topic, space, moderator: canModerate(actor, space) || isDirectOwner(actor, topic) };
}

/** A personal challenge lives in a private conversation, which has no moderators: its creator runs it. */
function isDirectOwner(actor: ChatActor, topic: { challenge: Challenge; recipientId: string | null }) {
  return !!topic.recipientId && (topic.challenge.createdByMentorId === actor.id || String(actor.role).toLowerCase() === 'admin');
}

export const closeTopic = handler(async (req, res, actor) => {
  const { topic, moderator } = await requireTopic(actor, req.params.id);
  if (!moderator) throw new ChatError(403, 'اجازه‌ی بستن این چالش را ندارید');
  const closed = await prisma.chatTopic.updateMany({ where: { id: topic.id, status: 'open' }, data: { status: 'closed', closedAt: new Date(), closedBy: actor.id } });
  if (closed.count !== 1) throw new ChatError(400, 'این چالش قبلاً بسته شده است');
  await publishUpdate(topic.messageId);
  await generateInsight(topic.id).catch(e => console.error('generateInsight error:', e));
  res.json({ status: 'closed' });
});

/** The message the group settled on. It goes on the card and into the answer's record. */
export const setFinalAnswer = handler(async (req, res, actor) => {
  const { topic, moderator } = await requireTopic(actor, req.params.id);
  if (!moderator) throw new ChatError(403, 'اجازه‌ی این کار را ندارید');
  const message = await prisma.chatMessage.findFirst({ where: { id: String(req.body?.messageId || ''), threadRootId: topic.messageId, deletedAt: null } });
  if (!message) throw new ChatError(400, 'پیام انتخاب‌شده در این گفتگو نیست');
  const previousFinal = topic.finalMessageId && topic.finalMessageId !== message.id ? topic.finalMessageId : null;
  await prisma.chatTopic.update({ where: { id: topic.id }, data: { finalMessageId: message.id } });
  // The «final» mark follows the choice: only the chosen message wears it
  if (!message.marks.includes('final')) await prisma.chatMessage.update({ where: { id: message.id }, data: { marks: [...message.marks, 'final'] } });
  if (previousFinal) {
    const old = await prisma.chatMessage.findUnique({ where: { id: previousFinal }, select: { marks: true } });
    if (old) {
      await prisma.chatMessage.update({ where: { id: previousFinal }, data: { marks: old.marks.filter(x => x !== 'final') } });
      await publishUpdate(previousFinal);
    }
  }
  const meta = { ...((topic.message.meta as any) ?? {}), finalAnswer: message.body.slice(0, 500) };
  await prisma.chatMessage.update({ where: { id: topic.messageId }, data: { meta } });
  await publishUpdate(topic.messageId);
  await publishUpdate(message.id);
  res.json({ success: true });
});

/** From a challenge to its conversation: the first card this user can see. */
export const topicByChallenge = handler(async (req, res, actor) => {
  const topics = await prisma.chatTopic.findMany({ where: { challengeId: req.params.id, message: { deletedAt: null } }, orderBy: { createdAt: 'asc' } });
  for (const t of topics) {
    const seen = await requireSpace(actor, t.spaceId).catch(() => null);
    if (!seen) continue;
    if (seen.space.type === 'arena' && topics.length > 1) continue; // one's own caravan comes first
    const message = await prisma.chatMessage.findUniqueOrThrow({ where: { id: t.messageId }, include: MESSAGE_INCLUDE });
    return res.json({ spaceId: t.spaceId, message: serializeMessage(message) });
  }
  throw new ChatError(404, 'گفتگویی برای این چالش در دسترس نیست');
});

export const reopenTopic = handler(async (req, res, actor) => {
  const { topic, moderator } = await requireTopic(actor, req.params.id);
  if (!moderator) throw new ChatError(403, 'اجازه‌ی این کار را ندارید');
  const opened = await prisma.chatTopic.updateMany({ where: { id: topic.id, status: 'closed' }, data: { status: 'open', closedAt: null, closedBy: null } });
  if (opened.count !== 1) throw new ChatError(400, 'پس از پرداخت نمی‌توان چالش را باز کرد');
  await publishUpdate(topic.messageId);
  res.json({ status: 'open' });
});

// ---- tags ----
const COLOR = /^#[0-9a-fA-F]{6}$/;

/** Relative luminance: a colour too dark for the app's dark surfaces is refused. */
export function isReadableColor(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b >= 70;
}

export const listTags = handler(async (req, res, actor) => {
  const { space } = await requireSpace(actor, req.params.id);
  const staff = canTag(actor, space);
  const tags = await prisma.chatTag.findMany({
    where: { archivedAt: null, OR: [{ spaceId: space.id }, { spaceId: null }], ...(staff ? {} : { visibility: 'public' }) },
    orderBy: { name: 'asc' },
  });
  res.json(tags);
});

export const createTag = handler(async (req, res, actor) => {
  const { space } = await requireSpace(actor, req.params.id);
  if (!canTag(actor, space)) throw new ChatError(403, 'اجازه‌ی ساخت تگ ندارید');
  const name = String(req.body?.name || '').trim().slice(0, 30);
  const color = String(req.body?.color || '');
  if (!name) throw new ChatError(400, 'نام تگ الزامی است');
  if (!COLOR.test(color)) throw new ChatError(400, 'رنگ تگ معتبر نیست');
  if (!isReadableColor(color)) throw new ChatError(400, 'این رنگ روی زمینه‌ی تیره‌ی اپ خوانا نیست');
  const managerOrAdmin = ['admin', 'sub_admin', 'channel_manager'].includes(String(actor.role).toLowerCase());
  if (req.body?.global === true && (!managerOrAdmin || (String(actor.role).toLowerCase() === 'channel_manager' && !actor.permissions.publicTags))) {
    throw new ChatError(403, 'تگ عمومی فقط توسط مدیر و مسئول کانال ساخته می‌شود');
  }
  const tag = await prisma.chatTag.create({
    data: { name, color, spaceId: req.body?.global === true ? null : space.id, visibility: req.body?.visibility === 'staff' ? 'staff' : 'public', createdBy: actor.id },
  });
  res.status(201).json(tag);
});

export const archiveTag = handler(async (req, res, actor) => {
  const tag = await prisma.chatTag.findUnique({ where: { id: req.params.id } });
  if (!tag) throw new ChatError(404, 'تگ یافت نشد');
  if (tag.spaceId) {
    const { space } = await requireSpace(actor, tag.spaceId);
    if (!canModerate(actor, space)) throw new ChatError(403, 'اجازه‌ی این کار را ندارید');
  } else if (!['admin', 'sub_admin', 'channel_manager'].includes(String(actor.role).toLowerCase())) {
    throw new ChatError(403, 'اجازه‌ی این کار را ندارید');
  }
  await prisma.chatTag.update({ where: { id: tag.id }, data: { archivedAt: new Date() } });
  res.json({ success: true });
});

export const toggleMessageTag = handler(async (req, res, actor) => {
  const { message, space } = await requireMessage(actor, req.params.id);
  if (!canTag(actor, space)) throw new ChatError(403, 'اجازه‌ی تگ‌گذاری ندارید');
  const tagId = String(req.body?.tagId || '');
  const tag = await prisma.chatTag.findUnique({ where: { id: tagId } });
  if (!tag || tag.archivedAt || (tag.spaceId && tag.spaceId !== space.id)) throw new ChatError(400, 'تگ معتبر نیست');
  const key = { messageId_tagId: { messageId: message.id, tagId } };
  if (await prisma.chatMessageTag.findUnique({ where: key })) await prisma.chatMessageTag.delete({ where: key });
  else await prisma.chatMessageTag.create({ data: { messageId: message.id, tagId, createdBy: actor.id } });
  await publishUpdate(message.id);
  res.json({ success: true });
});

/** "best" is shown to everyone; "evidence" is the moderator's note for the evaluation. */
export const toggleMark = handler(async (req, res, actor) => {
  const { message, space } = await requireMessage(actor, req.params.id);
  const mark = String(req.body?.mark || '');
  if (!['best', 'evidence', 'thread', 'mentor'].includes(mark)) throw new ChatError(400, 'نشان معتبر نیست');
  // The mentor's badge: a mentor puts it on their own message, wherever they want it
  if (mark === 'mentor') {
    if (message.senderId !== actor.id || !(isMentorRole(actor.role) || canModerate(actor, space))) throw new ChatError(403, 'فقط راهبر روی پیام خودش می‌تواند نشان راهبر بگذارد');
  } else
  // Opening the conversation under a message is for mentors, admins and channel managers; never in a private chat
  if (mark === 'thread' ? (!canModerate(actor, space) || message.threadRootId) : !canTag(actor, space)) throw new ChatError(403, 'اجازه‌ی این کار را ندارید');
  const marks = message.marks.includes(mark) ? message.marks.filter(m => m !== mark) : [...message.marks, mark];
  await prisma.chatMessage.update({ where: { id: message.id }, data: { marks } });
  await publishUpdate(message.id);
  res.json({ marks });
});
