import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { getAssetNames } from '../utils/assetNames';
import { applyRankBadges, closeCompetitionTopics, payPrizes, prizePlan, unconfirmedCaravans } from '../modules/chat/intergroup';
import { parseRewardPlan, postSettlement, RANK_ORDER, RANKING_CLOSED_MESSAGE, rankingWindow, RewardPlan, rewardPlanOf, TIER_LABEL } from '../modules/chat/settlement';
import { getEconomyPolicy } from '../services/economy';
import { changeBalance } from '../services/ledger';
import { noteBalanceChanged } from '../services/balanceEvents';

const MEDALS = ['gold', 'silver', 'bronze'] as const;
const TIER_KEYS: Record<string, string> = {
  gold: 'derafsh_gold',
  silver: 'derafsh_silver',
  bronze: 'derafsh_bronze',
  cloth: 'derafsh_cloth',
};

/**
 * Caravans that took part in an inter-group challenge: those that delivered an official work.
 * Challenges run without the chat have no works, so an answer from a member counts for them.
 */
async function participatingCaravans(challengeId: string) {
  const entries = await prisma.interGroupEntry.findMany({ where: { challengeId }, select: { caravanId: true } });
  const counts = new Map<string, number>(entries.map(e => [e.caravanId, 1]));
  if (entries.length === 0) {
    const subs = await prisma.submission.findMany({
      where: { challengeId },
      select: { student: { select: { caravanId: true } } },
    });
    for (const s of subs) {
      const cid = s.student?.caravanId;
      if (cid) counts.set(cid, (counts.get(cid) || 0) + 1);
    }
  }
  if (counts.size === 0) return [];
  const caravans = await prisma.caravan.findMany({
    where: { id: { in: Array.from(counts.keys()) } },
    select: { id: true, name: true, coverImageUrl: true, groupPoints: true, mentor: { select: { name: true } }, _count: { select: { members: { where: { isDeleted: false } } } } },
  });
  const approvedRows = await prisma.submission.findMany({
    where: { challengeId, status: 'approved', student: { caravanId: { in: caravans.map(c => c.id) } } },
    select: { student: { select: { caravanId: true } } },
  });
  const approved = new Map<string, number>();
  for (const r of approvedRows) {
    const cid = r.student?.caravanId;
    if (cid) approved.set(cid, (approved.get(cid) || 0) + 1);
  }
  return caravans.map(c => ({
    id: c.id,
    name: c.name,
    mentorName: c.mentor?.name || null,
    coverImageUrl: c.coverImageUrl || null,
    memberCount: c._count.members,
    groupPoints: c.groupPoints,
    answers: counts.get(c.id) || 0,
    approved: approved.get(c.id) || 0,
  }));
}

/** Admin: the participating caravans, the reward plan, whether ranking is open yet (and the result once confirmed). */
export async function getChallengeRanking(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const challenge = await prisma.challenge.findUnique({ where: { id } });
    if (!challenge) return res.status(404).json({ error: 'چالش یافت نشد' });
    if (challenge.category !== 'inter_group') {
      return res.status(400).json({ error: 'رتبه‌بندی فقط برای چالش‌های فراگروهی است' });
    }
    const caravans = await participatingCaravans(id);
    const banners = await prisma.caravanBanner.findMany({ where: { challengeId: id }, orderBy: [{ rank: 'asc' }] });
    const { config } = await getEconomyPolicy();
    const window = await rankingWindow(challenge);
    // What the panel proposes before the admin arranges it: most approved answers, then most answers, then group points
    const suggested = [...caravans]
      .sort((a, b) => b.approved - a.approved || b.answers - a.answers || b.groupPoints - a.groupPoints)
      .map(c => c.id);
    res.json({
      challenge: { id: challenge.id, title: challenge.title, finalized: !!challenge.rankingFinalizedAt, dueDate: challenge.dueDate },
      prizes: config.interGroup.prizes,
      rewards: rewardPlanOf(challenge, config),
      ownRewards: !!challenge.rewardPlan,
      window: { ...window, message: window.open ? null : RANKING_CLOSED_MESSAGE },
      tiers: RANK_ORDER.map(t => ({ key: t, label: TIER_LABEL[t] })),
      caravans,
      suggested,
      result: banners.map(b => ({
        caravanId: b.caravanId,
        caravanName: caravans.find(c => c.id === b.caravanId)?.name || '',
        tier: b.tier,
        rank: b.rank,
      })),
    });
  } catch (error) {
    console.error('getChallengeRanking error:', error);
    res.status(500).json({ error: 'خطا در دریافت کاروان‌های شرکت‌کننده' });
  }
}

/** The admin's plan from the body, or the challenge's saved one / the money rules. */
async function planFromRequest(req: AuthRequest, challenge: { rewardPlan?: unknown }): Promise<{ plan: RewardPlan; changed: boolean } | { error: string }> {
  const { config } = await getEconomyPolicy();
  if (req.body?.rewards === undefined || req.body?.rewards === null) return { plan: rewardPlanOf(challenge, config), changed: false };
  const parsed = parseRewardPlan(req.body.rewards);
  if ('error' in parsed) return parsed;
  return { plan: parsed.plan, changed: true };
}

const totals = (plan: { zarik: number; nakh: number }[]) => ({
  zarik: plan.reduce((sum, p) => sum + p.zarik, 0),
  nakh: plan.reduce((sum, p) => sum + p.nakh, 0),
});

function bannerRows(caravans: { id: string }[], ranking: string[]) {
  return caravans.map(c => {
    const idx = ranking.indexOf(c.id);
    return idx >= 0
      ? { caravanId: c.id, tier: MEDALS[idx] as string, rank: idx + 1 }
      : { caravanId: c.id, tier: 'cloth', rank: null as number | null };
  });
}

/**
 * Admin confirms the ranking at the end of the challenge: 1st/2nd/3rd get the gold/silver/bronze banner, every other
 * participating caravan the cloth one. Each member is paid zarik and کلاف: base of the rank tier × participation %.
 * Final: a ranking can be confirmed only once per challenge (corrections go through editChallengeRanking).
 * Body: { ranking: [caravanId1, caravanId2, caravanId3], rewards?: { zarik: {gold..cloth}, nakh: {...} }, preview?: true }.
 */
export async function finalizeChallengeRanking(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const challenge = await prisma.challenge.findUnique({ where: { id } });
    if (!challenge) return res.status(404).json({ error: 'چالش یافت نشد' });
    if (challenge.category !== 'inter_group') {
      return res.status(400).json({ error: 'رتبه‌بندی فقط برای چالش‌های فراگروهی است' });
    }
    if (challenge.rankingFinalizedAt) {
      return res.status(409).json({ error: 'رتبه‌بندی این چالش قبلاً تایید شده است' });
    }

    const ranking: string[] = Array.isArray(req.body?.ranking) ? req.body.ranking.map((r: any) => String(r)) : [];
    const caravans = await participatingCaravans(id);
    if (caravans.length === 0) {
      return res.status(400).json({ error: 'هنوز هیچ کاروانی در این چالش پاسخ نداده است' });
    }
    const places = Math.min(3, caravans.length);
    if (ranking.length !== places || new Set(ranking).size !== places) {
      return res.status(400).json({ error: `رتبه‌ی ${places === 1 ? 'اول' : 'اول تا ' + (places === 2 ? 'دوم' : 'سوم')} را با کاروان‌های متفاوت مشخص کنید` });
    }
    const participating = new Set(caravans.map(c => c.id));
    if (ranking.some(cid => !participating.has(cid))) {
      return res.status(400).json({ error: 'کاروان انتخاب‌شده در این چالش شرکت نکرده است' });
    }
    const chosen = await planFromRequest(req, challenge);
    if ('error' in chosen) return res.status(400).json({ error: chosen.error });

    const rows = bannerRows(caravans, ranking);
    const plan = await prizePlan(id, ranking, caravans.map(c => c.id), chosen.plan);
    const unconfirmed = await unconfirmedCaravans(id, caravans);
    const window = await rankingWindow(challenge);
    const sum = totals(plan);
    if (req.body?.preview === true) {
      return res.json({
        preview: true, total: sum.zarik, totalNakh: sum.nakh, paidMembers: plan.filter(p => p.zarik > 0 || p.nakh > 0).length, members: plan.length,
        unconfirmed, window: { ...window, message: window.open ? null : RANKING_CLOSED_MESSAGE }, rewards: chosen.plan,
      });
    }
    // Strictly at the end of the challenge
    if (!window.open) return res.status(400).json({ error: RANKING_CLOSED_MESSAGE, window });
    // No bypass: a member's payout is their share of the reward, so it cannot be paid before their mentor (or the admin,
    // on the mentor's behalf) confirms how much they took part
    if (unconfirmed.length > 0) {
      return res.status(400).json({ error: `مشارکت اعضای این کاروان‌ها هنوز تأیید نشده است: ${unconfirmed.join('، ')}`, unconfirmed });
    }

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.challenge.updateMany({
        where: { id, rankingFinalizedAt: null },
        // The plan actually paid is kept, so a later correction computes the true difference
        data: { rankingFinalizedAt: new Date(), rewardPlan: chosen.plan as any },
      });
      if (claimed.count !== 1) throw new Error('ALREADY_FINALIZED');
      await tx.caravanBanner.createMany({
        data: rows.map(r => ({ ...r, challengeId: id, awardedBy: req.user!.id })),
      });
      await payPrizes(tx, challenge, plan, req.user!.id);
    });
    noteBalanceChanged(); // the caravans' درفش changed

    // Tell every member and the mentor of each caravan
    const names = await getAssetNames();
    const caravanIds = rows.map(r => r.caravanId);
    const caravanRows = await prisma.caravan.findMany({ where: { id: { in: caravanIds } }, select: { id: true, mentorId: true } });
    const notes: { userId: string; title: string; message: string; type: string }[] = [];
    for (const r of rows) {
      const bannerName = names[TIER_KEYS[r.tier]];
      const msg = r.rank
        ? `کاروان شما در چالش فراگروهی "${challenge.title}" رتبه‌ی ${['اول', 'دوم', 'سوم'][r.rank - 1]} شد و ${bannerName} دریافت کرد.`
        : `کاروان شما در چالش فراگروهی "${challenge.title}" شرکت کرد و ${bannerName} دریافت کرد.`;
      const recipients = new Set<string>(plan.filter(p => p.caravanId === r.caravanId).map(p => p.userId));
      const mentorId = caravanRows.find(c => c.id === r.caravanId)?.mentorId;
      if (mentorId) recipients.add(mentorId);
      for (const userId of recipients) notes.push({ userId, title: `${names.derafsh} کاروان`, message: msg, type: 'reward' });
    }
    if (notes.length > 0) await prisma.notification.createMany({ data: notes });
    // Caravans' places in the arena thread; each caravan's members only in its own challenge group; then the threads close
    await postSettlement(challenge, rows, plan);
    await closeCompetitionTopics(id).catch(e => console.error('closeCompetitionTopics error:', e));
    await applyRankBadges(id);

    res.json({ success: true, result: rows, paid: sum.zarik, paidNakh: sum.nakh });
  } catch (error: any) {
    if (error?.message === 'ALREADY_FINALIZED') {
      return res.status(409).json({ error: 'رتبه‌بندی این چالش قبلاً تایید شده است' });
    }
    console.error('finalizeChallengeRanking error:', error);
    res.status(500).json({ error: 'خطا در ثبت رتبه‌بندی' });
  }
}

/**
 * Admin corrects an already confirmed ranking and/or its reward plan. The banners are replaced and every member is paid
 * (or charged) only the difference, in zarik and in کلاف. Body: { ranking: [...], rewards?, preview?: true }.
 * A member who already spent the prize makes the change impossible (the ledger refuses a negative balance).
 */
export async function editChallengeRanking(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const challenge = await prisma.challenge.findUnique({ where: { id } });
    if (!challenge) return res.status(404).json({ error: 'چالش یافت نشد' });
    if (challenge.category !== 'inter_group') {
      return res.status(400).json({ error: 'رتبه‌بندی فقط برای چالش‌های فراگروهی است' });
    }
    if (!challenge.rankingFinalizedAt) {
      return res.status(409).json({ error: 'رتبه‌بندی این چالش هنوز تایید نشده است' });
    }

    const ranking: string[] = Array.isArray(req.body?.ranking) ? req.body.ranking.map((r: any) => String(r)) : [];
    const caravans = await participatingCaravans(id);
    const places = Math.min(3, caravans.length);
    if (places === 0 || ranking.length !== places || new Set(ranking).size !== places) {
      return res.status(400).json({ error: 'رتبه‌ها را با کاروان‌های متفاوت مشخص کنید' });
    }
    const participating = caravans.map(c => c.id);
    if (ranking.some(cid => !participating.includes(cid))) {
      return res.status(400).json({ error: 'کاروان انتخاب‌شده در این چالش شرکت نکرده است' });
    }
    const { config } = await getEconomyPolicy();
    const oldRewards = rewardPlanOf(challenge, config);
    const chosen = await planFromRequest(req, challenge);
    if ('error' in chosen) return res.status(400).json({ error: chosen.error });

    const oldBanners = await prisma.caravanBanner.findMany({ where: { challengeId: id, rank: { not: null } }, orderBy: { rank: 'asc' } });
    const oldRanking = oldBanners.map(b => b.caravanId);
    const sameRewards = JSON.stringify(oldRewards) === JSON.stringify(chosen.plan);
    if (oldRanking.join() === ranking.join() && sameRewards) return res.json({ success: true, unchanged: true });

    const oldPlan = await prizePlan(id, oldRanking, participating, oldRewards);
    const newPlan = await prizePlan(id, ranking, participating, chosen.plan);
    const oldOf = new Map(oldPlan.map(p => [p.userId, p]));
    const deltas = newPlan
      .map(p => ({ userId: p.userId, zarik: p.zarik - (oldOf.get(p.userId)?.zarik || 0), nakh: p.nakh - (oldOf.get(p.userId)?.nakh || 0) }))
      .filter(d => d.zarik !== 0 || d.nakh !== 0);
    if (req.body?.preview === true) {
      const up = (k: 'zarik' | 'nakh') => deltas.filter(d => d[k] > 0).reduce((sum, d) => sum + d[k], 0);
      const down = (k: 'zarik' | 'nakh') => deltas.filter(d => d[k] < 0).reduce((sum, d) => sum - d[k], 0);
      return res.json({
        preview: true, increase: up('zarik'), decrease: down('zarik'), increaseNakh: up('nakh'), decreaseNakh: down('nakh'), members: deltas.length,
      });
    }

    const rows = bannerRows(caravans, ranking);
    const revision = new Date().toISOString();
    try {
      await prisma.$transaction(async (tx) => {
        for (const d of deltas) {
          const reason = `اصلاح رتبه‌بندی چالش فراگروهی: ${challenge.title}`;
          await changeBalance(tx, {
            userId: d.userId, asset: 'zarik', amount: d.zarik, sourceType: 'intergroup_prize_edit', sourceId: `${id}:${revision}`,
            reason, createdBy: req.user!.id, zarikCategory: 'Special Campaigns',
          });
          await changeBalance(tx, {
            userId: d.userId, asset: 'nakh', amount: d.nakh, sourceType: 'intergroup_prize_edit', sourceId: `${id}:${revision}`,
            reason, createdBy: req.user!.id,
          });
        }
        await tx.caravanBanner.deleteMany({ where: { challengeId: id } });
        await tx.caravanBanner.createMany({ data: rows.map(r => ({ ...r, challengeId: id, awardedBy: req.user!.id })) });
        await tx.challenge.update({ where: { id }, data: { rewardPlan: chosen.plan as any } });
      });
      noteBalanceChanged(); // the caravans' درفش changed
    } catch (e: any) {
      if (e?.message === 'INSUFFICIENT_BALANCE') {
        return res.status(409).json({ error: 'اصلاح ممکن نیست: بعضی اعضا جایزه قبلی را خرج کرده‌اند و موجودی کافی برای کسر تفاوت ندارند' });
      }
      throw e;
    }

    const names = await getAssetNames();
    const caravanIds = rows.map(r => r.caravanId);
    const mentors = await prisma.caravan.findMany({ where: { id: { in: caravanIds } }, select: { id: true, mentorId: true } });
    const notes: { userId: string; title: string; message: string; type: string }[] = [];
    for (const r of rows) {
      const old = oldBanners.find(b => b.caravanId === r.caravanId)?.rank ?? null;
      if (old === r.rank && sameRewards) continue;
      const msg = r.rank
        ? `نتیجه‌ی کاروان شما در چالش فراگروهی "${challenge.title}" اصلاح شد: رتبه‌ی ${['اول', 'دوم', 'سوم'][r.rank - 1]} و ${names[TIER_KEYS[r.tier]]}.`
        : `نتیجه‌ی کاروان شما در چالش فراگروهی "${challenge.title}" اصلاح شد و ${names[TIER_KEYS.cloth]} دریافت کرد.`;
      const recipients = new Set<string>(newPlan.filter(p => p.caravanId === r.caravanId).map(p => p.userId));
      const mentorId = mentors.find(c => c.id === r.caravanId)?.mentorId;
      if (mentorId) recipients.add(mentorId);
      for (const userId of recipients) notes.push({ userId, title: `${names.derafsh} کاروان`, message: msg, type: 'reward' });
    }
    if (notes.length > 0) await prisma.notification.createMany({ data: notes });
    await postSettlement(challenge, rows, newPlan, true);
    await applyRankBadges(id);

    res.json({ success: true, result: rows });
  } catch (error) {
    console.error('editChallengeRanking error:', error);
    res.status(500).json({ error: 'خطا در اصلاح رتبه‌بندی' });
  }
}

/** The caller's caravan banners: total, per tier, and where each was won. Mentors may pass ?caravanId. */
export async function getMyCaravanBanners(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'کاربر احراز هویت نشده است' });
    let caravanId: string | null = null;
    if (req.user.role === 'student') {
      const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { caravanId: true } });
      caravanId = u?.caravanId || null;
    } else {
      const wanted = typeof req.query.caravanId === 'string' ? req.query.caravanId : null;
      const mine = await prisma.caravan.findMany({ where: { mentorId: req.user.id }, select: { id: true } });
      caravanId = wanted && (mine.some(c => c.id === wanted) || req.user.role === 'admin') ? wanted : (mine[0]?.id || null);
    }
    if (!caravanId) return res.json({ total: 0, byTier: { gold: 0, silver: 0, bronze: 0, cloth: 0 }, items: [] });

    const banners = await prisma.caravanBanner.findMany({ where: { caravanId }, orderBy: { createdAt: 'desc' } });
    const challengeIds = banners.map(b => b.challengeId).filter((x): x is string => !!x);
    const challenges = challengeIds.length
      ? await prisma.challenge.findMany({ where: { id: { in: challengeIds } }, select: { id: true, title: true, station: { select: { title: true } } } })
      : [];
    const byId = new Map(challenges.map(c => [c.id, c]));

    const byTier = { gold: 0, silver: 0, bronze: 0, cloth: 0 } as Record<string, number>;
    for (const b of banners) byTier[b.tier] = (byTier[b.tier] || 0) + 1;

    res.json({
      total: banners.length,
      byTier,
      items: banners.map(b => ({
        id: b.id,
        tier: b.tier,
        rank: b.rank,
        challengeTitle: (b.challengeId && byId.get(b.challengeId)?.title) || '',
        stationTitle: (b.challengeId && byId.get(b.challengeId)?.station?.title) || null,
        createdAt: b.createdAt,
      })),
    });
  } catch (error) {
    console.error('getMyCaravanBanners error:', error);
    res.status(500).json({ error: 'خطا در دریافت درفش‌های کاروان' });
  }
}
