import prisma from '../../config/db';
import { validateRewardGrant } from '../../controllers/rewardController';
import { getEconomyPolicy } from '../../services/economy';
import crypto from 'crypto';
import { changeBalance, creditChallengeReward } from '../../services/ledger';
import { isMentorRole } from '../../utils/roles';
import { handler } from './http';
import { publishBotMessage, publishUpdate } from './publish';
import { ChatError } from './service';
import { normalizeStatus, PARTICIPATION, PARTICIPATION_KEYS, shareOf, suggestStatus } from './participation';
import { requireTopic } from './topics';

export interface ThreadMessage {
  id: string;
  senderId: string;
  body: string;
  marks: string[];
  replyToSenderId?: string | null;
  hasFile: boolean;
  reactionsFrom: string[];
}

export interface Weights { relevance: number; quality: number; collaboration: number; initiative: number }

const REASONING = /چون|زیرا|بنابراین|مثال|به نظرم|دلیل|پس |اگر /;
const normalize = (t: string) => t.replace(/[\s‌.,،؟?!]+/g, ' ').trim().toLowerCase();
const words = (t: string) => normalize(t).split(' ').filter(w => w.length > 1);

/** 0 empty or repeated, 1 related, 3 moves it forward, 5 a key idea. Length alone earns nothing. */
export function messageLevel(m: ThreadMessage, seen: Set<string>, topicWords: Set<string>): number {
  if (m.marks.includes('best') || m.marks.includes('evidence')) return 5;
  const text = normalize(m.body);
  if (!text) return m.hasFile ? 1 : 0;
  if (seen.has(text)) return 0;
  seen.add(text);
  const list = words(m.body);
  if (list.length < 3) return 0;
  if (REASONING.test(m.body) || m.body.includes('؟') || m.body.includes('?') || list.length >= 12) return 3;
  return 1;
}

export interface Participation {
  userId: string;
  criteria: Weights;
  score: number;
  share: number;
  usefulMessages: number;
  repeats: number;
  evidence: string[];
  flags: string[];
}

const percent = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/** Turns a conversation into one row per person. Pure, so the rules can be tested without a database. */
export function scoreConversation(messages: ThreadMessage[], topicText: string, weights: Weights): Participation[] {
  const topicWords = new Set(words(topicText));
  const seen = new Set<string>();
  const people = new Map<string, { total: number; useful: number; levels: number; repeats: number; related: number; replies: number; reactions: number; evidenceCount: number; files: number; samples: { id: string; level: number }[]; first: boolean }>();
  const reactionPairs = new Map<string, number>();

  messages.forEach((m, index) => {
    const p = people.get(m.senderId) || { total: 0, useful: 0, levels: 0, repeats: 0, related: 0, replies: 0, reactions: 0, evidenceCount: 0, files: 0, samples: [], first: index === 0 };
    people.set(m.senderId, p);
    const level = messageLevel(m, seen, topicWords);
    // Each further message of a run counts a little less: flooding does not pay
    const decay = p.total >= 10 ? 0.5 : 1;
    p.total += 1;
    p.levels += level * decay;
    if (level > 0) p.useful += 1;
    if (level === 0 && normalize(m.body)) p.repeats += 1;
    if (words(m.body).some(w => topicWords.has(w))) p.related += 1;
    if (m.replyToSenderId && m.replyToSenderId !== m.senderId) p.replies += 1;
    if (m.hasFile) p.files += 1;
    if (m.marks.includes('evidence') || m.marks.includes('best')) p.evidenceCount += 1;
    p.samples.push({ id: m.id, level });
    for (const from of m.reactionsFrom) {
      if (from === m.senderId) continue;
      const pair = `${from}>${m.senderId}`;
      const count = (reactionPairs.get(pair) || 0) + 1;
      reactionPairs.set(pair, count);
      if (count <= 3) p.reactions += 1; // the same friend's praise stops counting
    }
  });

  const rows = Array.from(people.entries()).map(([userId, p]) => {
    const criteria = {
      relevance: percent(p.total ? ((p.useful + p.related) / (2 * p.total)) * 100 : 0),
      quality: percent(p.levels * 8),
      collaboration: percent((p.replies + p.reactions) * 15),
      initiative: percent(p.evidenceCount * 30 + p.files * 20 + (p.first ? 10 : 0)),
    };
    const score = percent(
      (criteria.relevance * weights.relevance + criteria.quality * weights.quality + criteria.collaboration * weights.collaboration + criteria.initiative * weights.initiative) / 100
    );
    const flags: string[] = [];
    if (p.repeats >= 3) flags.push('پیام تکراری یا بی‌محتوا');
    return {
      userId, criteria, score, share: 0, usefulMessages: p.useful, repeats: p.repeats,
      evidence: p.samples.filter(s => s.level > 0).sort((a, b) => b.level - a.level).slice(0, 3).map(s => s.id),
      flags,
    };
  });

  const mutual = (a: string, b: string) => (reactionPairs.get(`${a}>${b}`) || 0) >= 3 && (reactionPairs.get(`${b}>${a}`) || 0) >= 3;
  for (const row of rows) {
    if (rows.some(o => o.userId !== row.userId && mutual(row.userId, o.userId))) row.flags.push('ریاکشن متقابل');
  }
  const total = rows.reduce((sum, r) => sum + r.score, 0);
  for (const row of rows) row.share = total ? Math.round((row.score / total) * 100) : 0;
  return rows;
}

/** Suggested kalaf: the score mapped onto the challenge's own range. */
export function suggestedNakh(score: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round((score / 100) * max)));
}

/** Everyone who really took part: wrote in the conversation or sent an answer. Staff are not scored. */
export async function buildEvaluation(topicId: string) {
  const topic = await prisma.chatTopic.findUniqueOrThrow({ where: { id: topicId }, include: { challenge: true } });
  const rows = await prisma.chatMessage.findMany({
    where: { threadRootId: topic.messageId, deletedAt: null, senderId: { not: null } },
    orderBy: { seq: 'asc' },
    include: { attachments: { select: { id: true } }, reactions: { select: { userId: true } }, replyTo: { select: { senderId: true } }, sender: { select: { role: true } } },
  });
  const students = rows.filter(m => String(m.sender?.role).toLowerCase() === 'student');
  const { config } = await getEconomyPolicy();
  const scored = scoreConversation(
    students.map(m => ({
      id: m.id, senderId: m.senderId!, body: m.body, marks: m.marks, replyToSenderId: m.replyTo?.senderId,
      hasFile: m.attachments.length > 0, reactionsFrom: m.reactions.map(r => r.userId),
    })),
    `${topic.challenge.title} ${topic.challenge.description}`,
    config.evaluationWeights,
  );

  const submissions = await prisma.submission.findMany({ where: { challengeId: topic.challengeId }, select: { studentId: true, status: true } });
  const inScope = topic.recipientId
    ? submissions.filter(s => s.studentId === topic.recipientId)
    : submissions.filter(s => s.status !== 'approved');
  for (const s of inScope) {
    if (!scored.some(r => r.userId === s.studentId)) {
      const space = await prisma.chatSpace.findUnique({ where: { id: topic.spaceId }, select: { caravanId: true } });
      const member = await prisma.user.findUnique({ where: { id: s.studentId }, select: { caravanId: true } });
      if (topic.recipientId || space?.caravanId === member?.caravanId) {
        scored.push({ userId: s.studentId, criteria: { relevance: 0, quality: 0, collaboration: 0, initiative: 0 }, score: 0, share: 0, usefulMessages: 0, repeats: 0, evidence: [], flags: ['فقط پاسخ ثبت کرده است'] });
      }
    }
  }
  return { topic, rows: scored, messages: rows };
}

/** The kalaf a challenge can pay. The ceiling of the money rules binds even a challenge made before them. */
async function rangeOf(c: { rewardMin: number; rewardMax: number }) {
  const { config } = await getEconomyPolicy();
  const max = Math.min(c.rewardMax || config.challengeMaxNakh, config.challengeMaxNakh);
  return { min: Math.min(c.rewardMin || 0, max), max };
}

/** Old challenges that pay zarik keep their own review path: their numbers mean nothing in kalaf. */
function assertPaysKalaf(c: { rewardAssetType: string }) {
  if (c.rewardAssetType !== 'nakh') throw new ChatError(400, 'این چالش زریکی است و از صفحه‌ی بررسی پاسخ‌ها پرداخت می‌شود');
}

/** A challenge whose time is over closes by itself, so the mentor can evaluate it without closing it by hand. */
async function closeIfDue(topicId: string) {
  const topic = await prisma.chatTopic.findUnique({ where: { id: topicId }, include: { challenge: { select: { dueDate: true } } } });
  if (!topic || topic.status !== 'open' || !topic.challenge.dueDate || topic.challenge.dueDate > new Date()) return;
  const closed = await prisma.chatTopic.updateMany({ where: { id: topicId, status: 'open' }, data: { status: 'closed', closedAt: new Date() } });
  if (closed.count === 1) await publishUpdate(topic.messageId);
}

export const getEvaluation = handler(async (req, res, actor) => {
  const { moderator } = await requireTopic(actor, req.params.id);
  if (!moderator) throw new ChatError(403, 'این بخش مخصوص راهبر است');
  await closeIfDue(req.params.id);
  const { topic, rows, messages } = await buildEvaluation(req.params.id);
  const saved = await prisma.challengeEvaluation.findMany({ where: { topicId: topic.id } });
  const users = await prisma.user.findMany({ where: { id: { in: rows.map(r => r.userId) } }, select: { id: true, name: true, avatarUrl: true, gender: true } });
  const history = await prisma.challengeEvaluation.groupBy({ by: ['userId'], where: { userId: { in: rows.map(r => r.userId) }, paidAt: { not: null }, topicId: { not: topic.id } }, _avg: { score: true }, _count: { _all: true } });
  const range = await rangeOf(topic.challenge);

  res.json({
    topic: { id: topic.id, status: topic.status, title: topic.challenge.title, min: range.min, max: range.max, statuses: PARTICIPATION_KEYS.map(k => ({ key: k, ...PARTICIPATION[k] })), messageCount: messages.length, legacy: topic.challenge.rewardAssetType !== 'nakh' },
    rows: rows.map(r => {
      const s = saved.find(x => x.userId === r.userId);
      const suggestedStatus = suggestStatus(r.score);
      const status = normalizeStatus(s?.status) ?? suggestedStatus;
      const suggested = shareOf(range.max, suggestedStatus);
      const h = history.find(x => x.userId === r.userId);
      return {
        ...r,
        user: users.find(u => u.id === r.userId),
        suggested,
        suggestedStatus,
        status,
        finalNakh: s?.status ? s.finalNakh : shareOf(range.max, status),
        reason: s?.reason ?? null,
        objection: s?.objection ?? null,
        objectionStatus: s?.objectionStatus ?? null,
        paid: !!s?.paidAt,
        previousAverage: h?._avg.score != null ? Math.round(h._avg.score) : null,
        previousCount: h?._count._all ?? 0,
        evidenceMessages: r.evidence.map(id => {
          const m = messages.find(x => x.id === id);
          return { id, body: m?.body.slice(0, 200) ?? '' };
        }),
      };
    }),
  });
});

/** Body: { rows: [{ userId, status, reason? }] }. The kalaf follows from the status: the challenge's top reward times its percent, rounded up. */
export const saveEvaluation = handler(async (req, res, actor) => {
  const { moderator } = await requireTopic(actor, req.params.id);
  if (!moderator) throw new ChatError(403, 'این بخش مخصوص راهبر است');
  await closeIfDue(req.params.id);
  const { topic, rows } = await buildEvaluation(req.params.id);
  if (topic.status === 'paid') throw new ChatError(400, 'این چالش پرداخت شده است');
  assertPaysKalaf(topic.challenge);
  const range = await rangeOf(topic.challenge);
  const input: any[] = Array.isArray(req.body?.rows) ? req.body.rows : [];

  for (const item of input) {
    const row = rows.find(r => r.userId === item.userId);
    if (!row) throw new ChatError(400, 'فقط شرکت‌کنندگان واقعی ارزیابی می‌شوند');
    const status = normalizeStatus(item.status);
    if (!status) throw new ChatError(400, 'وضعیت مشارکت همه‌ی افراد را مشخص کنید');
    const finalNakh = shareOf(range.max, status);
    const suggested = shareOf(range.max, suggestStatus(row.score));
    const reason = String(item.reason || '').trim().slice(0, 300) || null;
    const data = { criteria: row.criteria as any, score: row.score, share: row.share, suggested, finalNakh, status, reason, flags: row.flags };
    await prisma.challengeEvaluation.upsert({
      where: { topicId_userId: { topicId: topic.id, userId: item.userId } },
      update: data,
      create: { topicId: topic.id, userId: item.userId, ...data },
    });
  }
  res.json({ success: true });
});

/** Pays every saved row at once. The claim on the status makes a repeated or parallel call do nothing. */
export const payEvaluation = handler(async (req, res, actor) => {
  const { topic, moderator } = await requireTopic(actor, req.params.id);
  if (!moderator) throw new ChatError(403, 'این بخش مخصوص راهبر است');
  if (topic.challenge.category === 'inter_group') throw new ChatError(400, 'جایزه‌ی چالش فراگروهی از مسیر رتبه‌بندی پرداخت می‌شود');
  await closeIfDue(req.params.id);
  assertPaysKalaf(topic.challenge);
  if (topic.status === 'open') throw new ChatError(400, 'اول چالش را ببندید');
  const rows = await prisma.challengeEvaluation.findMany({ where: { topicId: topic.id, paidAt: null } });
  if (rows.length === 0) throw new ChatError(400, 'ارزیابی ثبت‌شده‌ای وجود ندارد');

  const space = await prisma.chatSpace.findUnique({ where: { id: topic.spaceId }, select: { caravanId: true } });
  if (isMentorRole(actor.role)) {
    try {
      await validateRewardGrant(actor.id, space?.caravanId || '', topic.challenge.stationId || '', 'CHALLENGE', rows.reduce((sum, r) => sum + r.finalNakh, 0));
    } catch (e: any) {
      throw new ChatError(400, e.message);
    }
  }

  const skipped: string[] = [];
  const finalAnswer = topic.finalMessageId
    ? (await prisma.chatMessage.findUnique({ where: { id: topic.finalMessageId }, select: { body: true } }))?.body
    : null;
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.chatTopic.updateMany({ where: { id: topic.id, status: 'closed' }, data: { status: 'paid' } });
    if (claimed.count !== 1) throw new ChatError(400, 'این چالش قبلاً پرداخت شده است');
    for (const row of rows) {
      const existing = await tx.submission.findUnique({ where: { challengeId_studentId: { challengeId: topic.challengeId, studentId: row.userId } } });
      if (existing?.status === 'approved') {
        skipped.push(row.userId); // already paid from the challenge screen
        continue;
      }
      const submission = await tx.submission.upsert({
        where: { challengeId_studentId: { challengeId: topic.challengeId, studentId: row.userId } },
        update: { status: 'approved', score: row.finalNakh, mentorFeedback: row.reason },
        create: { challengeId: topic.challengeId, studentId: row.userId, status: 'approved', score: row.finalNakh, mentorFeedback: row.reason, answerText: finalAnswer || 'ارزیابی از گفتگوی چالش' },
      });
      if (row.finalNakh > 0) await creditChallengeReward(tx, { submissionId: submission.id, studentId: row.userId, asset: 'nakh', amount: row.finalNakh, title: topic.challenge.title, actorId: actor.id });
      await tx.challengeEvaluation.update({ where: { id: row.id }, data: { paidAt: new Date() } });
      await tx.submissionEvent.create({
        data: { submissionId: submission.id, challengeId: topic.challengeId, studentId: row.userId, action: 'approved', feedback: row.reason, score: row.finalNakh, actorId: actor.id, actorName: actor.name },
      });
      await tx.notification.create({
        data: { userId: row.userId, title: 'نتیجه‌ی چالش', message: `در چالش «${topic.challenge.title}» با وضعیت «${PARTICIPATION[normalizeStatus(row.status) ?? 'tired'].label}» ${row.finalNakh} کلاف گرفتید.`, type: 'reward' },
      });
    }
  });
  await publishUpdate(topic.messageId);
  await publishBotMessage({ spaceId: topic.spaceId, botKey: 'challenge', threadRootId: topic.messageId, body: 'نتیجه‌ی ارزیابی ثبت شد. کارنامه‌ی خود را از کارت چالش ببینید.' });
  res.json({ paid: rows.length - skipped.length, skipped: skipped.length });
});

/** A change after payment: the difference moves in the ledger, the first payment stays on record. */
async function applyCorrection(actor: { id: string }, topic: { id: string; challengeId: string; challenge: { title: string; rewardMax: number; rewardMin: number } }, userId: string, finalNakh: number, reason: string) {
  const row = await prisma.challengeEvaluation.findUnique({ where: { topicId_userId: { topicId: topic.id, userId } } });
  if (!row?.paidAt) throw new ChatError(404, 'پرداختی برای این فرد ثبت نشده است');
  const range = await rangeOf(topic.challenge);
  if (!Number.isInteger(finalNakh) || finalNakh < range.min || finalNakh > range.max) throw new ChatError(400, 'مقدار کلاف معتبر نیست');
  if (!reason) throw new ChatError(400, 'دلیل اصلاح الزامی است');
  const delta = finalNakh - row.finalNakh;
  if (delta === 0) return 0;

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.challengeEvaluation.updateMany({ where: { id: row.id, finalNakh: row.finalNakh }, data: { finalNakh, reason } });
      if (updated.count !== 1) throw new ChatError(409, 'این ردیف هم‌زمان تغییر کرده است');
      await tx.submission.updateMany({ where: { challengeId: topic.challengeId, studentId: userId }, data: { score: finalNakh } });
      await changeBalance(tx, {
        userId, asset: 'nakh', amount: delta, sourceType: 'evaluation_correction', sourceId: crypto.randomUUID(),
        reason: `اصلاح ارزیابی چالش «${topic.challenge.title}»: ${reason}`, createdBy: actor.id,
      });
      await tx.notification.create({ data: { userId, title: 'اصلاح نتیجه‌ی چالش', message: `نتیجه‌ی چالش «${topic.challenge.title}» به ${finalNakh} کلاف اصلاح شد. ${reason}`, type: 'reward' } });
    });
  } catch (e: any) {
    if (e?.message === 'INSUFFICIENT_BALANCE') throw new ChatError(400, 'موجودی کلاف این فرد برای کسر کافی نیست؛ او آن را تبدیل کرده است');
    throw e;
  }
  return delta;
}

export const correctEvaluation = handler(async (req, res, actor) => {
  const { topic, moderator } = await requireTopic(actor, req.params.id);
  if (!moderator) throw new ChatError(403, 'این بخش مخصوص راهبر است');
  const delta = await applyCorrection(actor, topic, String(req.body?.userId || ''), Number(req.body?.finalNakh), String(req.body?.reason || '').trim());
  res.json({ delta });
});

/** Body: { userId, accept, response, finalNakh? }. An accepted objection can change the result. */
export const resolveObjection = handler(async (req, res, actor) => {
  const { topic, moderator } = await requireTopic(actor, req.params.id);
  if (!moderator) throw new ChatError(403, 'این بخش مخصوص راهبر است');
  const userId = String(req.body?.userId || '');
  const response = String(req.body?.response || '').trim().slice(0, 300);
  if (!response) throw new ChatError(400, 'پاسخ به اعتراض الزامی است');
  const row = await prisma.challengeEvaluation.findUnique({ where: { topicId_userId: { topicId: topic.id, userId } } });
  if (row?.objectionStatus !== 'pending') throw new ChatError(404, 'اعتراض بازی برای این فرد وجود ندارد');
  const accept = req.body?.accept === true;
  if (accept && req.body?.finalNakh !== undefined) await applyCorrection(actor, topic, userId, Number(req.body.finalNakh), response);
  await prisma.challengeEvaluation.update({ where: { id: row.id }, data: { objectionStatus: accept ? 'accepted' : 'rejected', objectionResponse: response } });
  await prisma.notification.create({ data: { userId, title: 'پاسخ اعتراض', message: `${topic.challenge.title}: ${response}`, type: 'alert' } });
  res.json({ success: true });
});

export const myReport = handler(async (req, res, actor) => {
  const { topic } = await requireTopic(actor, req.params.id);
  const row = await prisma.challengeEvaluation.findUnique({ where: { topicId_userId: { topicId: topic.id, userId: actor.id } } });
  if (!row?.paidAt) return res.json({ ready: false });
  res.json({ ready: true, status: normalizeStatus(row.status), statusLabel: row.status ? PARTICIPATION[normalizeStatus(row.status)!].label : null, score: row.score, share: row.share, finalNakh: row.finalNakh, criteria: row.criteria, reason: row.reason, objection: row.objection, objectionStatus: row.objectionStatus, objectionResponse: row.objectionResponse, canObject: Date.now() - row.paidAt.getTime() < 24 * 3600 * 1000 && !row.objection });
});

export const fileObjection = handler(async (req, res, actor) => {
  const { topic } = await requireTopic(actor, req.params.id);
  const text = String(req.body?.text || '').trim().slice(0, 500);
  if (!text) throw new ChatError(400, 'متن اعتراض الزامی است');
  const row = await prisma.challengeEvaluation.findUnique({ where: { topicId_userId: { topicId: topic.id, userId: actor.id } } });
  if (!row?.paidAt) throw new ChatError(404, 'کارنامه‌ای برای شما ثبت نشده است');
  if (Date.now() - row.paidAt.getTime() > 24 * 3600 * 1000) throw new ChatError(400, 'مهلت ۲۴ ساعته‌ی اعتراض تمام شده است');
  if (row.objection) throw new ChatError(400, 'اعتراض شما قبلاً ثبت شده است');
  await prisma.challengeEvaluation.update({ where: { id: row.id }, data: { objection: text, objectionStatus: 'pending' } });
  await prisma.notification.create({ data: { userId: topic.challenge.createdByMentorId, title: 'اعتراض به ارزیابی', message: `${actor.name}: ${text.slice(0, 120)}`, type: 'alert' } });
  res.json({ success: true });
});
