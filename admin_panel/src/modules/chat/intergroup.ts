import { Prisma } from '@prisma/client';
import prisma from '../../config/db';
import { EconomyConfig, getEconomyPolicy } from '../../services/economy';
import { changeBalance } from '../../services/ledger';
import { isMentorRole } from '../../utils/roles';
import { ChatActor } from './access';
import { handler } from './http';
import { publishBotMessage, publishUpdate } from './publish';
import { normalizeStatus, PARTICIPATION_KEYS, ParticipationStatus, shareOf } from './participation';
import { ChatError, globalSpace, signFileUrl } from './service';

/** The mentor's participation status of a member: flagbearer 100, active 75, semi 50, companion 25, tired 0 percent. */
export const TIERS = PARTICIPATION_KEYS;
export type Tier = ParticipationStatus;

const isAdmin = (a: ChatActor) => ['admin', 'sub_admin'].includes(String(a.role).toLowerCase());

async function requireInterChallenge(id: string) {
  const challenge = await prisma.challenge.findUnique({ where: { id } });
  if (!challenge || challenge.category !== 'inter_group') throw new ChatError(404, 'چالش فراگروهی یافت نشد');
  return challenge;
}

/** Works stay private until the deadline passes or the admin opens judging: a mentor must not read a rival early. */
export function judgingOpen(c: { dueDate: Date | null; judgingStartedAt: Date | null }, now = new Date()): boolean {
  return !!c.judgingStartedAt || (!!c.dueDate && c.dueDate <= now);
}

/** A member's prize: the banner's amount times the participation the mentor confirmed, rounded up. A tired member's share is never redistributed. */
export function memberPrize(rankTier: 'gold' | 'silver' | 'bronze' | 'cloth', tier: Tier, config: EconomyConfig): number {
  return shareOf(config.interGroup.prizes[rankTier], tier);
}

/** Effort suggested from the caravan's private thread. The mentor confirms or changes it. */
export function suggestTier(usefulMessages: number): Tier {
  if (usefulMessages >= 8) return 'flagbearer';
  if (usefulMessages >= 5) return 'active';
  if (usefulMessages >= 3) return 'semi';
  if (usefulMessages >= 1) return 'companion';
  return 'tired';
}

/** The caravan's mark: the judges' average, the share of active members and delivery on time. */
export function rankScore(input: { judgeAverage: number; activeShare: number; onTime: boolean; delivered: boolean }, config: EconomyConfig): number {
  const w = config.interGroup.rankWeights;
  const delivery = !input.delivered ? 0 : (input.onTime ? 100 : 50);
  return Math.round((input.judgeAverage * w.judges + input.activeShare * w.coverage + delivery * w.delivery) / 100);
}

async function caravanOfActor(actor: ChatActor, requested?: string): Promise<string> {
  const caravanId = requested || actor.mentoredCaravanIds[0] || actor.caravanId;
  if (!caravanId) throw new ChatError(400, 'کاروانی برای شما ثبت نشده است');
  if (!isAdmin(actor) && !actor.mentoredCaravanIds.includes(caravanId)) throw new ChatError(403, 'این کار مخصوص راهبر همین کاروان است');
  return caravanId;
}

/** The caravan's official work. It can be replaced until the deadline. */
export const submitEntry = handler(async (req, res, actor) => {
  const challenge = await requireInterChallenge(req.params.id);
  const caravanId = await caravanOfActor(actor, req.body?.caravanId);
  if (challenge.rankingFinalizedAt) throw new ChatError(400, 'این رقابت پایان یافته است');
  const body = String(req.body?.body || '').trim().slice(0, 8000);
  if (!body) throw new ChatError(400, 'متن اثر الزامی است');
  if (judgingOpen(challenge)) throw new ChatError(400, 'داوری شروع شده و اثر دیگر قابل تغییر نیست');
  const attachmentId = req.body?.attachmentId ? String(req.body.attachmentId) : null;
  if (attachmentId) {
    const space = await prisma.chatSpace.findUnique({ where: { key: `challenges:${caravanId}` }, select: { id: true } });
    const file = await prisma.chatAttachment.findUnique({ where: { id: attachmentId } });
    if (!file || file.uploaderId !== actor.id || file.spaceId !== space?.id) throw new ChatError(400, 'فایل پیوست معتبر نیست');
  }

  const entry = await prisma.$transaction(async (tx) => {
    const existing = await tx.interGroupEntry.findUnique({ where: { challengeId_caravanId: { challengeId: challenge.id, caravanId } } });
    if (existing) return tx.interGroupEntry.update({ where: { id: existing.id }, data: { body, fileUrl: attachmentId, submittedBy: actor.id, submittedAt: new Date() } });
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${challenge.id}))`;
    const count = await tx.interGroupEntry.count({ where: { challengeId: challenge.id } });
    return tx.interGroupEntry.create({ data: { challengeId: challenge.id, caravanId, anonCode: count + 1, body, fileUrl: attachmentId, submittedBy: actor.id } });
  });
  res.status(201).json({ id: entry.id, anonCode: entry.anonCode });
});

export const askJudge = handler(async (req, res, actor) => {
  const challenge = await requireInterChallenge(req.params.id);
  const caravanId = actor.caravanId || actor.mentoredCaravanIds[0];
  if (!caravanId) throw new ChatError(400, 'کاروانی برای شما ثبت نشده است');
  const body = String(req.body?.body || '').trim().slice(0, 500);
  if (!body) throw new ChatError(400, 'متن پرسش الزامی است');
  res.status(201).json(await prisma.interGroupQuestion.create({ data: { challengeId: challenge.id, caravanId, userId: actor.id, body } }));
});

/** Anonymous works a judge may score: never their own caravan's. */
export const judgeList = handler(async (req, res, actor) => {
  const challenge = await requireInterChallenge(req.params.id);
  if (!isAdmin(actor) && !isMentorRole(actor.role)) throw new ChatError(403, 'این بخش مخصوص داوران است');
  if (!judgingOpen(challenge)) throw new ChatError(403, 'داوری پس از پایان مهلت شروع می‌شود');
  const entries = await prisma.interGroupEntry.findMany({
    where: { challengeId: challenge.id, caravanId: { notIn: actor.mentoredCaravanIds } },
    include: { scores: { where: { judgeId: actor.id } } },
    orderBy: { anonCode: 'asc' },
  });
  res.json(entries.map(e => ({ id: e.id, code: e.anonCode, body: e.body, fileUrl: e.fileUrl ? signFileUrl(e.fileUrl) : null, myScore: e.scores[0] || null })));
});

export const judgeEntry = handler(async (req, res, actor) => {
  if (!isAdmin(actor) && !isMentorRole(actor.role)) throw new ChatError(403, 'این بخش مخصوص داوران است');
  const entry = await prisma.interGroupEntry.findUnique({ where: { id: req.params.entryId } });
  if (!entry) throw new ChatError(404, 'اثر یافت نشد');
  if (actor.mentoredCaravanIds.includes(entry.caravanId)) throw new ChatError(403, 'راهبر اثر کاروان خود را داوری نمی‌کند');
  const challenge = await requireInterChallenge(entry.challengeId);
  if (!judgingOpen(challenge)) throw new ChatError(403, 'داوری پس از پایان مهلت شروع می‌شود');
  if (challenge.rankingFinalizedAt) throw new ChatError(400, 'این رقابت پایان یافته است');
  const score = Number(req.body?.score);
  const strength = String(req.body?.strength || '').trim().slice(0, 300);
  const suggestion = String(req.body?.suggestion || '').trim().slice(0, 300);
  if (!Number.isInteger(score) || score < 0 || score > 100) throw new ChatError(400, 'نمره باید بین ۰ تا ۱۰۰ باشد');
  if (!strength || !suggestion) throw new ChatError(400, 'یک نقطه‌ی قوت و یک پیشنهاد بنویسید');
  await prisma.interGroupJudgeScore.upsert({
    where: { entryId_judgeId: { entryId: entry.id, judgeId: actor.id } },
    update: { score, strength, suggestion },
    create: { entryId: entry.id, judgeId: actor.id, score, strength, suggestion },
  });
  res.json({ success: true });
});

async function usefulByUser(challengeId: string, caravanId: string): Promise<Map<string, number>> {
  const space = await prisma.chatSpace.findUnique({ where: { key: `challenges:${caravanId}` } });
  const out = new Map<string, number>();
  if (!space) return out;
  const topic = await prisma.chatTopic.findFirst({ where: { challengeId, spaceId: space.id } });
  if (!topic) return out;
  const messages = await prisma.chatMessage.findMany({ where: { threadRootId: topic.messageId, deletedAt: null, senderId: { not: null } }, select: { senderId: true, body: true } });
  for (const m of messages) {
    if (m.body.trim().split(/\s+/).length >= 3) out.set(m.senderId!, (out.get(m.senderId!) || 0) + 1);
  }
  return out;
}

export const getTiers = handler(async (req, res, actor) => {
  const challenge = await requireInterChallenge(req.params.id);
  const caravanId = await caravanOfActor(actor, req.query.caravanId ? String(req.query.caravanId) : undefined);
  const members = await prisma.user.findMany({ where: { caravanId, role: 'student' }, select: { id: true, name: true, avatarUrl: true, gender: true } });
  const [saved, useful] = await Promise.all([
    prisma.interGroupMemberTier.findMany({ where: { challengeId: challenge.id, caravanId } }),
    usefulByUser(challenge.id, caravanId),
  ]);
  res.json({
    caravanId,
    rows: members.map(m => {
      const s = saved.find(x => x.userId === m.id);
      const messages = useful.get(m.id) || 0;
      return { user: m, usefulMessages: messages, suggested: suggestTier(messages), tier: normalizeStatus(s?.tier) ?? suggestTier(messages), confirmed: !!s };
    }),
  });
});

/** Body: { caravanId?, tiers: { [userId]: tier } }. */
export const saveTiers = handler(async (req, res, actor) => {
  const challenge = await requireInterChallenge(req.params.id);
  if (challenge.rankingFinalizedAt) throw new ChatError(400, 'این رقابت پایان یافته است');
  const caravanId = await caravanOfActor(actor, req.body?.caravanId);
  const tiers: Record<string, string> = req.body?.tiers || {};
  const members = await prisma.user.findMany({ where: { caravanId, role: 'student' }, select: { id: true } });
  for (const m of members) {
    const tier = tiers[m.id];
    if (!tier) throw new ChatError(400, 'وضعیت مشارکت همه‌ی اعضا را مشخص کنید');
    if (!(PARTICIPATION_KEYS as string[]).includes(tier)) throw new ChatError(400, 'وضعیت انتخاب‌شده معتبر نیست');
  }
  await prisma.$transaction(members.map(m => prisma.interGroupMemberTier.upsert({
    where: { challengeId_userId: { challengeId: challenge.id, userId: m.id } },
    update: { tier: tiers[m.id], caravanId, confirmedBy: actor.id },
    create: { challengeId: challenge.id, caravanId, userId: m.id, tier: tiers[m.id], confirmedBy: actor.id },
  })));
  res.json({ success: true });
});

export const RANK_TIERS = ['gold', 'silver', 'bronze'] as const;

/** Every caravan's numbers for the admin's desk. */
export async function interGroupBoard(challengeId: string) {
  const challenge = await requireInterChallenge(challengeId);
  const { config } = await getEconomyPolicy();
  const [entries, caravans, tiers, questions] = await Promise.all([
    prisma.interGroupEntry.findMany({ where: { challengeId }, include: { scores: true } }),
    prisma.caravan.findMany({ select: { id: true, name: true, mentor: { select: { name: true } }, members: { where: { role: 'student' }, select: { id: true } } } }),
    prisma.interGroupMemberTier.findMany({ where: { challengeId } }),
    prisma.interGroupQuestion.findMany({ where: { challengeId }, orderBy: { createdAt: 'desc' } }),
  ]);

  const rows = caravans.map(c => {
    const entry = entries.find(e => e.caravanId === c.id);
    const own = tiers.filter(t => t.caravanId === c.id);
    const active = own.filter(t => normalizeStatus(t.tier) !== 'tired').length;
    const judgeAverage = entry && entry.scores.length ? Math.round(entry.scores.reduce((s, x) => s + x.score, 0) / entry.scores.length) : 0;
    const activeShare = c.members.length ? Math.round((active / c.members.length) * 100) : 0;
    const onTime = !!entry && (!challenge.dueDate || entry.submittedAt <= challenge.dueDate);
    return {
      caravanId: c.id, name: c.name, mentorName: c.mentor?.name || null, members: c.members.length,
      anonCode: entry?.anonCode ?? null, delivered: !!entry, onTime, judgeCount: entry?.scores.length ?? 0, judgeAverage,
      tiersConfirmed: own.length === c.members.length && c.members.length > 0, activeShare,
      score: entry ? rankScore({ judgeAverage, activeShare, onTime, delivered: true }, config) : 0,
    };
  }).sort((a, b) => b.score - a.score);
  return { challenge, rows, questions, config };
}

export const startJudging = handler(async (req, res, actor) => {
  const challenge = await requireInterChallenge(req.params.id);
  if (challenge.rankingFinalizedAt) throw new ChatError(400, 'این رقابت پایان یافته است');
  await prisma.challenge.update({ where: { id: challenge.id }, data: { judgingStartedAt: new Date() } });
  await prisma.auditLog.create({ data: { actorId: actor.id, actorName: actor.name, actorRole: 'ADMIN', action: 'START_INTERGROUP_JUDGING', targetEntity: 'Challenge', targetEntityId: challenge.id, details: challenge.title, ipAddress: req.ip || '' } });
  res.json({ success: true });
});

export const adminBoard = handler(async (req, res) => {
  const { challenge, rows, questions } = await interGroupBoard(req.params.id);
  res.json({ challenge: { id: challenge.id, title: challenge.title, dueDate: challenge.dueDate, finalized: !!challenge.rankingFinalizedAt, judgingOpen: judgingOpen(challenge) }, rows, questions });
});

/** The money a finished ranking pays. Used for the preview and for the payment itself, so they agree. */
export async function prizePlan(challengeId: string, ranking: string[], participating: string[]) {
  const { config } = await getEconomyPolicy();
  const tiers = await prisma.interGroupMemberTier.findMany({ where: { challengeId } });
  const members = await prisma.user.findMany({ where: { caravanId: { in: participating }, role: 'student' }, select: { id: true, caravanId: true } });
  const submissions = await prisma.submission.findMany({ where: { challengeId }, select: { studentId: true } });
  const answered = new Set(submissions.map(s => s.studentId));
  return members.map(m => {
    const place = ranking.indexOf(m.caravanId!);
    const rankTier = place >= 0 ? RANK_TIERS[place] : 'cloth' as const;
    // Run without the chat there are no confirmed levels: whoever answered took part fully
    const tier = normalizeStatus(tiers.find(t => t.userId === m.id)?.tier) ?? (answered.has(m.id) ? 'flagbearer' : 'tired');
    return { userId: m.id, caravanId: m.caravanId!, rankTier, tier, amount: memberPrize(rankTier, tier, config) };
  });
}

/** Caravans that delivered a work but whose members' effort nobody confirmed. */
export async function unconfirmedCaravans(challengeId: string, participating: { id: string; name: string }[]) {
  const entries = await prisma.interGroupEntry.count({ where: { challengeId } });
  if (entries === 0) return [];
  const tiers = await prisma.interGroupMemberTier.groupBy({ by: ['caravanId'], where: { challengeId }, _count: { _all: true } });
  const out = [];
  for (const c of participating) {
    const members = await prisma.user.count({ where: { caravanId: c.id, role: 'student' } });
    if ((tiers.find(t => t.caravanId === c.id)?._count._all ?? 0) < members) out.push(c.name);
  }
  return out;
}

/** The competition is over: its conversations stop. */
export async function closeCompetitionTopics(challengeId: string) {
  const topics = await prisma.chatTopic.findMany({ where: { challengeId, status: { not: 'paid' } } });
  await prisma.chatTopic.updateMany({ where: { challengeId }, data: { status: 'paid', closedAt: new Date() } });
  for (const t of topics) await publishUpdate(t.messageId);
}

export async function payPrizes(tx: Prisma.TransactionClient, challenge: { id: string; title: string }, plan: { userId: string; amount: number }[], actorId: string) {
  for (const row of plan) {
    await changeBalance(tx, {
      userId: row.userId, asset: 'zarik', amount: row.amount, sourceType: 'intergroup_prize', sourceId: challenge.id,
      reason: `جایزه‌ی چالش فراگروهی: ${challenge.title}`, createdBy: actorId, zarikCategory: 'Special Campaigns',
    });
  }
}

/** Results with something good to say about each work: the place for praise, not comparison. */
export async function publishResults(challengeId: string, title: string, ranking: string[]) {
  const arena = await globalSpace('arena');
  const entries = await prisma.interGroupEntry.findMany({ where: { challengeId }, include: { scores: { take: 1 } } });
  const caravans = await prisma.caravan.findMany({ where: { id: { in: entries.map(e => e.caravanId) } }, select: { id: true, name: true } });
  const places = ranking.map((id, i) => ({ place: i + 1, name: caravans.find(c => c.id === id)?.name || '' }));
  const strengths = entries.map(e => ({ name: caravans.find(c => c.id === e.caravanId)?.name || '', strength: e.scores[0]?.strength || null })).filter(s => s.strength);
  await publishBotMessage({ spaceId: arena.id, botKey: 'challenge', kind: 'result', body: `نتیجه‌ی ${title}`, meta: { title, places, strengths } });
}

export const answerQuestion = handler(async (req, res) => {
  const question = await prisma.interGroupQuestion.findUnique({ where: { id: req.params.id } });
  if (!question) throw new ChatError(404, 'پرسش یافت نشد');
  const answer = String(req.body?.answer || '').trim().slice(0, 800);
  if (!answer) throw new ChatError(400, 'متن پاسخ الزامی است');
  await prisma.interGroupQuestion.update({ where: { id: question.id }, data: { answer } });
  const arena = await globalSpace('arena');
  const topic = await prisma.chatTopic.findFirst({ where: { challengeId: question.challengeId, spaceId: arena.id } });
  await publishBotMessage({ spaceId: arena.id, botKey: 'challenge', threadRootId: topic?.messageId, body: `پرسش: ${question.body}\nپاسخ داور: ${answer}` });
  res.json({ success: true });
});

// ---- «میدان آثار»: a mentor's deliverable under a challenge, and the rank it later earns ----

const RANK_LABELS = ['مقام اول', 'مقام دوم', 'مقام سوم'];

/**
 * A mentor's reply with a file under an inter-group challenge in the arena is the caravan's work for that challenge.
 * It is marked on the message (so a rank can be shown on it later) and kept as the caravan's entry for the admin's ranking.
 * Text-only replies stay ordinary discussion. Never throws: a failure here must not lose the message.
 */
export async function recordArenaSubmission(actor: ChatActor, space: { id: string; type: string }, message: { id: string; body: string; threadRootId?: string | null; attachments?: { id: string }[] }): Promise<void> {
  try {
    if (space.type !== 'arena' || !message.threadRootId || !message.attachments?.length) return;
    if (!isMentorRole(actor.role) || actor.mentoredCaravanIds.length === 0) return;
    const topic = await prisma.chatTopic.findUnique({ where: { messageId: message.threadRootId }, include: { challenge: true } });
    if (!topic || topic.challenge.category !== 'inter_group') return;
    const challenge = topic.challenge;
    const caravanId = actor.mentoredCaravanIds[0];
    const meta = { submission: true, caravanId, challengeId: challenge.id };
    await prisma.chatMessage.update({ where: { id: message.id }, data: { meta } });
    if (!challenge.rankingFinalizedAt && !judgingOpen(challenge)) {
      const body = (message.body || '').trim().slice(0, 8000) || 'اثر پیوست‌شده';
      const attachmentId = message.attachments[0].id;
      await prisma.$transaction(async (tx) => {
        const existing = await tx.interGroupEntry.findUnique({ where: { challengeId_caravanId: { challengeId: challenge.id, caravanId } } });
        if (existing) {
          await tx.interGroupEntry.update({ where: { id: existing.id }, data: { body, fileUrl: attachmentId, submittedBy: actor.id, submittedAt: new Date() } });
          return;
        }
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${challenge.id}))`;
        const count = await tx.interGroupEntry.count({ where: { challengeId: challenge.id } });
        await tx.interGroupEntry.create({ data: { challengeId: challenge.id, caravanId, anonCode: count + 1, body, fileUrl: attachmentId, submittedBy: actor.id } });
      });
    }
    await publishUpdate(message.id);
  } catch (e) {
    console.error('recordArenaSubmission error:', e);
  }
}

/**
 * Copies the admin's ranking onto the caravans' submissions in the arena, so each shows its place.
 * Safe to repeat after a correction: a caravan without a place has its badge removed.
 */
export async function applyRankBadges(challengeId: string): Promise<void> {
  try {
    const [banners, topics] = await Promise.all([
      prisma.caravanBanner.findMany({ where: { challengeId }, select: { caravanId: true, rank: true } }),
      prisma.chatTopic.findMany({ where: { challengeId, space: { type: 'arena' } }, select: { messageId: true } }),
    ]);
    if (topics.length === 0) return;
    const rankOf = new Map(banners.map(b => [b.caravanId, b.rank]));
    const caravans = await prisma.caravan.findMany({ where: { id: { in: banners.map(b => b.caravanId) } }, select: { id: true, name: true } });
    const nameOf = new Map(caravans.map(c => [c.id, c.name]));
    const replies = await prisma.chatMessage.findMany({ where: { threadRootId: { in: topics.map(t => t.messageId) }, deletedAt: null }, select: { id: true, meta: true } });
    for (const reply of replies) {
      const meta = (reply.meta ?? {}) as Record<string, any>;
      if (!meta.submission || !meta.caravanId) continue;
      const rank = rankOf.get(meta.caravanId) ?? null;
      const { rank: _oldRank, rankLabel: _oldLabel, caravanName: _oldName, ...rest } = meta;
      const next = rank ? { ...rest, rank, rankLabel: RANK_LABELS[rank - 1] ?? `مقام ${rank}`, caravanName: nameOf.get(meta.caravanId) ?? '' } : rest;
      await prisma.chatMessage.update({ where: { id: reply.id }, data: { meta: next } });
      await publishUpdate(reply.id);
    }
  } catch (e) {
    console.error('applyRankBadges error:', e);
  }
}
