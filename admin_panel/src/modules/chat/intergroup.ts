import { Prisma } from '@prisma/client';
import prisma from '../../config/db';
import { EconomyConfig, getEconomyPolicy } from '../../services/economy';
import { changeBalance } from '../../services/ledger';
import { isMentorRole } from '../../utils/roles';
import { ChatActor } from './access';
import { handler } from './http';
import { publishBotMessage } from './publish';
import { ChatError, globalSpace } from './service';

export const TIERS = ['full', 'partner', 'minimal', 'inactive'] as const;
export type Tier = typeof TIERS[number];

const isAdmin = (a: ChatActor) => ['admin', 'sub_admin'].includes(String(a.role).toLowerCase());

async function requireInterChallenge(id: string) {
  const challenge = await prisma.challenge.findUnique({ where: { id } });
  if (!challenge || challenge.category !== 'inter_group') throw new ChatError(404, 'چالش فراگروهی یافت نشد');
  return challenge;
}

/** A member's prize: the rank's amount times their effort. An absent member's share is never redistributed. */
export function memberPrize(rankTier: 'gold' | 'silver' | 'bronze' | 'cloth', tier: Tier, config: EconomyConfig): number {
  if (tier === 'inactive') return 0;
  return Math.round((config.interGroup.prizes[rankTier] * config.interGroup.tiers[tier]) / 100);
}

/** Effort suggested from the caravan's private thread. The mentor confirms or changes it. */
export function suggestTier(usefulMessages: number): Tier {
  if (usefulMessages >= 5) return 'full';
  if (usefulMessages >= 2) return 'partner';
  if (usefulMessages >= 1) return 'minimal';
  return 'inactive';
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

  const entry = await prisma.$transaction(async (tx) => {
    const existing = await tx.interGroupEntry.findUnique({ where: { challengeId_caravanId: { challengeId: challenge.id, caravanId } } });
    if (existing) return tx.interGroupEntry.update({ where: { id: existing.id }, data: { body, submittedBy: actor.id, submittedAt: new Date() } });
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${challenge.id}))`;
    const count = await tx.interGroupEntry.count({ where: { challengeId: challenge.id } });
    return tx.interGroupEntry.create({ data: { challengeId: challenge.id, caravanId, anonCode: count + 1, body, submittedBy: actor.id } });
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
  const entries = await prisma.interGroupEntry.findMany({
    where: { challengeId: challenge.id, caravanId: { notIn: actor.mentoredCaravanIds } },
    include: { scores: { where: { judgeId: actor.id } } },
    orderBy: { anonCode: 'asc' },
  });
  res.json(entries.map(e => ({ id: e.id, code: e.anonCode, body: e.body, myScore: e.scores[0] || null })));
});

export const judgeEntry = handler(async (req, res, actor) => {
  if (!isAdmin(actor) && !isMentorRole(actor.role)) throw new ChatError(403, 'این بخش مخصوص داوران است');
  const entry = await prisma.interGroupEntry.findUnique({ where: { id: req.params.entryId } });
  if (!entry) throw new ChatError(404, 'اثر یافت نشد');
  if (actor.mentoredCaravanIds.includes(entry.caravanId)) throw new ChatError(403, 'راهبر اثر کاروان خود را داوری نمی‌کند');
  const challenge = await requireInterChallenge(entry.challengeId);
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
      return { user: m, usefulMessages: messages, suggested: suggestTier(messages), tier: s?.tier ?? suggestTier(messages), confirmed: !!s };
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
    if (!tier) throw new ChatError(400, 'سطح همه‌ی اعضا را مشخص کنید');
    if (!TIERS.includes(tier as Tier)) throw new ChatError(400, 'سطح انتخاب‌شده معتبر نیست');
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
    const active = own.filter(t => t.tier !== 'inactive').length;
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

export const adminBoard = handler(async (req, res) => {
  const { challenge, rows, questions } = await interGroupBoard(req.params.id);
  res.json({ challenge: { id: challenge.id, title: challenge.title, dueDate: challenge.dueDate, finalized: !!challenge.rankingFinalizedAt }, rows, questions });
});

/** The money a finished ranking pays. Used for the preview and for the payment itself, so they agree. */
export async function prizePlan(challengeId: string, ranking: string[], participating: string[]) {
  const { config } = await getEconomyPolicy();
  const tiers = await prisma.interGroupMemberTier.findMany({ where: { challengeId } });
  const members = await prisma.user.findMany({ where: { caravanId: { in: participating }, role: 'student' }, select: { id: true, caravanId: true } });
  return members.map(m => {
    const place = ranking.indexOf(m.caravanId!);
    const rankTier = place >= 0 ? RANK_TIERS[place] : 'cloth' as const;
    const tier = (tiers.find(t => t.userId === m.id)?.tier ?? 'inactive') as Tier;
    return { userId: m.id, caravanId: m.caravanId!, rankTier, tier, amount: memberPrize(rankTier, tier, config) };
  });
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
