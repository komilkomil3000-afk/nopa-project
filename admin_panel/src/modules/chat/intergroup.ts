import { Prisma } from '@prisma/client';
import prisma from '../../config/db';
import { EconomyConfig, getEconomyPolicy } from '../../services/economy';
import { changeBalance } from '../../services/ledger';
import { isMentorRole } from '../../utils/roles';
import { ChatActor } from './access';
import { handler } from './http';
import { publishBotMessage, publishUpdate } from './publish';
import { normalizeStatus, PARTICIPATION, PARTICIPATION_KEYS, ParticipationStatus, shareOf } from './participation';
import { RewardPlan, rewardPlanOf, shareOfPercent } from './settlement';
import { ChatError, globalSpace, signFileUrl } from './service';
import { judgingOpen } from './arenaPrivacy';

export { judgingOpen };

/** The mentor's participation status of a member: flagbearer 100, active 75, semi 50, companion 25, tired 0 percent. */
export const TIERS = PARTICIPATION_KEYS;
export type Tier = ParticipationStatus;

const isAdmin = (a: ChatActor) => ['admin', 'sub_admin'].includes(String(a.role).toLowerCase());

async function requireInterChallenge(id: string) {
  const challenge = await prisma.challenge.findUnique({ where: { id } });
  if (!challenge || challenge.category !== 'inter_group') throw new ChatError(404, 'چالش فراگروهی یافت نشد');
  return challenge;
}

/**
 * The caravan an action is for. Never guessed for a mentor of several caravans: they must name it, or the work,
 * question or participation would land on whichever caravan happens to come first.
 * `members` lets a student act for their own caravan (asking the judges).
 */
export function resolveActorCaravan(actor: ChatActor, requested?: unknown, opts: { members?: boolean } = {}): string {
  const wanted = requested ? String(requested) : null;
  if (wanted) {
    if (isAdmin(actor) || actor.mentoredCaravanIds.includes(wanted) || (opts.members && actor.caravanId === wanted)) return wanted;
    throw new ChatError(403, 'این کار مخصوص راهبر همین کاروان است');
  }
  if (actor.mentoredCaravanIds.length === 1) return actor.mentoredCaravanIds[0];
  if (actor.mentoredCaravanIds.length > 1) throw new ChatError(400, 'شما راهبر چند کاروان هستید؛ کاروان را مشخص کنید');
  if (opts.members && actor.caravanId) return actor.caravanId;
  if (isAdmin(actor)) throw new ChatError(400, 'کاروان را مشخص کنید');
  throw new ChatError(400, 'کاروانی برای شما ثبت نشده است');
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

/** The caravan's official work. It can be replaced until the deadline. */
export const submitEntry = handler(async (req, res, actor) => {
  const challenge = await requireInterChallenge(req.params.id);
  const caravanId = resolveActorCaravan(actor, req.body?.caravanId);
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
  const caravanId = resolveActorCaravan(actor, req.body?.caravanId, { members: true });
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

export type RosterRow = { userId: string; caravanId: string; tier: Tier | null };

/**
 * Who competes for which caravan in a challenge. A confirmed participation row fixes the student's caravan for that
 * challenge: transferring afterwards moves neither their prize nor their place. A student without a row counts for
 * the caravan they are in now (and is "unconfirmed" until their mentor confirms them).
 */
export async function challengeRoster(challengeId: string, caravanIds: string[]): Promise<RosterRow[]> {
  const wanted = new Set(caravanIds);
  const tiers = await prisma.interGroupMemberTier.findMany({ where: { challengeId } });
  const tierOf = new Map(tiers.map(t => [t.userId, t]));
  const [current, stillStudents] = await Promise.all([
    prisma.user.findMany({ where: { caravanId: { in: caravanIds }, role: 'student' }, select: { id: true, caravanId: true } }),
    prisma.user.findMany({ where: { id: { in: tiers.map(t => t.userId) }, role: 'student' }, select: { id: true } }),
  ]);
  const rows = new Map<string, RosterRow>();
  for (const s of stillStudents) {
    const t = tierOf.get(s.id)!;
    if (wanted.has(t.caravanId)) rows.set(s.id, { userId: s.id, caravanId: t.caravanId, tier: normalizeStatus(t.tier) });
  }
  for (const u of current) {
    if (!tierOf.has(u.id)) rows.set(u.id, { userId: u.id, caravanId: u.caravanId!, tier: null });
  }
  return Array.from(rows.values());
}

const PERSON = { id: true, name: true, avatarUrl: true, gender: true } as const;

export const getTiers = handler(async (req, res, actor) => {
  const challenge = await requireInterChallenge(req.params.id);
  const caravanId = resolveActorCaravan(actor, req.query.caravanId);
  const [roster, current, useful] = await Promise.all([
    challengeRoster(challenge.id, [caravanId]),
    prisma.user.findMany({ where: { caravanId, role: 'student' }, select: { id: true } }),
    usefulByUser(challenge.id, caravanId),
  ]);
  const people = await prisma.user.findMany({ where: { id: { in: roster.map(r => r.userId) } }, select: PERSON });
  const nowHere = new Set(current.map(c => c.id));
  // Members who joined from a caravan that already confirmed them stay with that caravan for this challenge
  const elsewhere = await prisma.interGroupMemberTier.findMany({
    where: { challengeId: challenge.id, userId: { in: current.map(c => c.id) }, caravanId: { not: caravanId } }, select: { userId: true },
  });
  const elsewhereUsers = await prisma.user.findMany({ where: { id: { in: elsewhere.map(e => e.userId) } }, select: PERSON });
  res.json({
    caravanId,
    rows: roster.map(r => {
      const messages = useful.get(r.userId) || 0;
      return {
        user: people.find(p => p.id === r.userId), usefulMessages: messages, suggested: suggestTier(messages),
        tier: r.tier ?? suggestTier(messages), confirmed: r.tier !== null, movedOut: !nowHere.has(r.userId), locked: false,
      };
    }).concat(elsewhereUsers.map(u => ({
      user: u, usefulMessages: 0, suggested: 'tired' as Tier, tier: 'tired' as Tier, confirmed: true, movedOut: false, locked: true,
    }))),
  });
});

/** Body: { caravanId?, tiers: { [userId]: tier } }. Covers the caravan's roster for this challenge (see challengeRoster). */
export const saveTiers = handler(async (req, res, actor) => {
  const challenge = await requireInterChallenge(req.params.id);
  if (challenge.rankingFinalizedAt) throw new ChatError(400, 'این رقابت پایان یافته است');
  const caravanId = resolveActorCaravan(actor, req.body?.caravanId);
  const tiers: Record<string, string> = req.body?.tiers || {};
  const roster = await challengeRoster(challenge.id, [caravanId]);
  for (const m of roster) {
    const tier = tiers[m.userId];
    if (!tier) throw new ChatError(400, 'وضعیت مشارکت همه‌ی اعضا را مشخص کنید');
    if (!(PARTICIPATION_KEYS as string[]).includes(tier)) throw new ChatError(400, 'وضعیت انتخاب‌شده معتبر نیست');
  }
  // The caravan is never rewritten: a member confirmed by another caravan is not in this roster at all
  await prisma.$transaction(roster.map(m => prisma.interGroupMemberTier.upsert({
    where: { challengeId_userId: { challengeId: challenge.id, userId: m.userId } },
    update: { tier: tiers[m.userId], confirmedBy: actor.id },
    create: { challengeId: challenge.id, caravanId, userId: m.userId, tier: tiers[m.userId], confirmedBy: actor.id },
  })));
  res.json({ success: true });
});

export const RANK_TIERS = ['gold', 'silver', 'bronze'] as const;

/** Every caravan's numbers for the admin's desk. */
export async function interGroupBoard(challengeId: string) {
  const challenge = await requireInterChallenge(challengeId);
  const { config } = await getEconomyPolicy();
  const [entries, caravans, questions] = await Promise.all([
    prisma.interGroupEntry.findMany({ where: { challengeId }, include: { scores: true } }),
    prisma.caravan.findMany({ select: { id: true, name: true, mentor: { select: { name: true } } } }),
    prisma.interGroupQuestion.findMany({ where: { challengeId }, orderBy: { createdAt: 'desc' } }),
  ]);
  const roster = await challengeRoster(challengeId, caravans.map(c => c.id));

  const rows = caravans.map(c => {
    const entry = entries.find(e => e.caravanId === c.id);
    const own = roster.filter(r => r.caravanId === c.id);
    const active = own.filter(r => r.tier !== null && r.tier !== 'tired').length;
    const judgeAverage = entry && entry.scores.length ? Math.round(entry.scores.reduce((s, x) => s + x.score, 0) / entry.scores.length) : 0;
    const activeShare = own.length ? Math.round((active / own.length) * 100) : 0;
    const onTime = !!entry && (!challenge.dueDate || entry.submittedAt <= challenge.dueDate);
    return {
      caravanId: c.id, name: c.name, mentorName: c.mentor?.name || null, members: own.length,
      anonCode: entry?.anonCode ?? null, delivered: !!entry, onTime, judgeCount: entry?.scores.length ?? 0, judgeAverage,
      tiersConfirmed: own.length > 0 && own.every(r => r.tier !== null), activeShare,
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

/**
 * The money a finished ranking pays. Used for the preview and for the payment itself, so they agree.
 * Each student is paid with the caravan they competed for (challengeRoster), not the one they are in today.
 */
export async function prizePlan(challengeId: string, ranking: string[], participating: string[], plan?: RewardPlan) {
  const { config } = await getEconomyPolicy();
  const base = plan ?? rewardPlanOf((await prisma.challenge.findUnique({ where: { id: challengeId }, select: { rewardPlan: true } })) ?? {}, config);
  const roster = await challengeRoster(challengeId, participating);
  const submissions = await prisma.submission.findMany({ where: { challengeId }, select: { studentId: true } });
  const answered = new Set(submissions.map(s => s.studentId));
  return roster.map(m => {
    const place = ranking.indexOf(m.caravanId);
    const rankTier = place >= 0 ? RANK_TIERS[place] : 'cloth' as const;
    // A new ranking is refused while anyone is unconfirmed (unconfirmedCaravans). The fallback only reproduces what
    // rankings confirmed before that rule paid, so correcting them charges or pays the true difference.
    const tier = m.tier ?? (answered.has(m.userId) ? 'flagbearer' : 'tired');
    const percent = PARTICIPATION[tier].percent;
    const zarik = shareOfPercent(base.zarik[rankTier], percent);
    const nakh = shareOfPercent(base.nakh[rankTier], percent);
    // `amount` stays the zarik part for callers that predate کلاف prizes
    return { userId: m.userId, caravanId: m.caravanId, rankTier, tier, zarik, nakh, amount: zarik };
  });
}

/** Participating caravans with at least one member whose participation nobody confirmed. Ranking waits for them. */
export async function unconfirmedCaravans(challengeId: string, participating: { id: string; name: string }[]) {
  const roster = await challengeRoster(challengeId, participating.map(c => c.id));
  const open = new Set(roster.filter(r => r.tier === null).map(r => r.caravanId));
  return participating.filter(c => open.has(c.id)).map(c => c.name);
}

/** The competition is over: its conversations stop. */
export async function closeCompetitionTopics(challengeId: string) {
  const topics = await prisma.chatTopic.findMany({ where: { challengeId, status: { not: 'paid' } } });
  await prisma.chatTopic.updateMany({ where: { challengeId }, data: { status: 'paid', closedAt: new Date() } });
  for (const t of topics) await publishUpdate(t.messageId);
}

/** Pays each member's zarik and کلاف. The ledger's unique key (source, member, asset) makes a second payment impossible. */
export async function payPrizes(tx: Prisma.TransactionClient, challenge: { id: string; title: string }, plan: { userId: string; zarik: number; nakh: number }[], actorId: string) {
  for (const row of plan) {
    await changeBalance(tx, {
      userId: row.userId, asset: 'zarik', amount: row.zarik, sourceType: 'intergroup_prize', sourceId: challenge.id,
      reason: `جایزه‌ی چالش فراگروهی: ${challenge.title}`, createdBy: actorId, zarikCategory: 'Special Campaigns',
    });
    await changeBalance(tx, {
      userId: row.userId, asset: 'nakh', amount: row.nakh, sourceType: 'intergroup_prize', sourceId: challenge.id,
      reason: `جایزه‌ی چالش فراگروهی: ${challenge.title}`, createdBy: actorId,
    });
  }
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
 * The message is marked at creation (sendMessage passes the meta, so it is sealed from rivals from the first moment)
 * and kept here as the caravan's entry for the admin's ranking. The caravan was resolved by the sender
 * (resolveActorCaravan), never guessed. Text-only replies stay ordinary discussion.
 * Never throws: a failure here must not lose the message.
 */
export async function recordArenaSubmission(actor: ChatActor, target: { caravanId: string; challengeId: string }, message: { id: string; body: string; attachments?: { id: string }[] }): Promise<void> {
  try {
    if (!message.attachments?.length || !isMentorRole(actor.role)) return;
    const challenge = await prisma.challenge.findUnique({ where: { id: target.challengeId } });
    if (!challenge || challenge.category !== 'inter_group') return;
    const { caravanId } = target;
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
