import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { getAssetNames } from '../utils/assetNames';

const MEDALS = ['gold', 'silver', 'bronze'] as const;
const TIER_KEYS: Record<string, string> = {
  gold: 'derafsh_gold',
  silver: 'derafsh_silver',
  bronze: 'derafsh_bronze',
  cloth: 'derafsh_cloth',
};

/** Caravans that took part in an inter-group challenge: at least one member has answered. */
async function participatingCaravans(challengeId: string) {
  const subs = await prisma.submission.findMany({
    where: { challengeId },
    select: { student: { select: { caravanId: true } } },
  });
  const counts = new Map<string, number>();
  for (const s of subs) {
    const cid = s.student?.caravanId;
    if (cid) counts.set(cid, (counts.get(cid) || 0) + 1);
  }
  if (counts.size === 0) return [];
  const caravans = await prisma.caravan.findMany({
    where: { id: { in: Array.from(counts.keys()) } },
    select: { id: true, name: true, mentor: { select: { name: true } } },
  });
  return caravans.map(c => ({
    id: c.id,
    name: c.name,
    mentorName: c.mentor?.name || null,
    answers: counts.get(c.id) || 0,
  }));
}

/** Admin: the participating caravans (and the result once it was confirmed). */
export async function getChallengeRanking(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const challenge = await prisma.challenge.findUnique({ where: { id } });
    if (!challenge) return res.status(404).json({ error: 'چالش یافت نشد' });
    if (challenge.category !== 'inter_group') {
      return res.status(400).json({ error: 'رتبه‌بندی فقط برای چالش‌های میان‌گروهی است' });
    }
    const caravans = await participatingCaravans(id);
    const banners = await prisma.caravanBanner.findMany({ where: { challengeId: id }, orderBy: [{ rank: 'asc' }] });
    res.json({
      challenge: { id: challenge.id, title: challenge.title, finalized: !!challenge.rankingFinalizedAt },
      caravans,
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

/**
 * Admin confirms the ranking: 1st/2nd/3rd get the gold/silver/bronze banner, every other participating
 * caravan gets the cloth banner. Final: a ranking can be confirmed only once per challenge.
 * Body: { ranking: [caravanId1, caravanId2, caravanId3] } (as many places as there are caravans, max 3).
 */
export async function finalizeChallengeRanking(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const challenge = await prisma.challenge.findUnique({ where: { id } });
    if (!challenge) return res.status(404).json({ error: 'چالش یافت نشد' });
    if (challenge.category !== 'inter_group') {
      return res.status(400).json({ error: 'رتبه‌بندی فقط برای چالش‌های میان‌گروهی است' });
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

    const rows = caravans.map(c => {
      const idx = ranking.indexOf(c.id);
      return idx >= 0
        ? { caravanId: c.id, tier: MEDALS[idx] as string, rank: idx + 1 }
        : { caravanId: c.id, tier: 'cloth', rank: null as number | null };
    });

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.challenge.updateMany({
        where: { id, rankingFinalizedAt: null },
        data: { rankingFinalizedAt: new Date() },
      });
      if (claimed.count !== 1) throw new Error('ALREADY_FINALIZED');
      await tx.caravanBanner.createMany({
        data: rows.map(r => ({ ...r, challengeId: id, awardedBy: req.user!.id })),
      });
    });

    // Tell every member and the mentor of each caravan
    const names = await getAssetNames();
    const caravanIds = rows.map(r => r.caravanId);
    const students = await prisma.user.findMany({ where: { caravanId: { in: caravanIds } }, select: { id: true, caravanId: true } });
    const caravanRows = await prisma.caravan.findMany({ where: { id: { in: caravanIds } }, select: { id: true, mentorId: true } });
    const notes: { userId: string; title: string; message: string; type: string }[] = [];
    for (const r of rows) {
      const bannerName = names[TIER_KEYS[r.tier]];
      const msg = r.rank
        ? `کاروان شما در چالش میان‌گروهی "${challenge.title}" رتبه‌ی ${['اول', 'دوم', 'سوم'][r.rank - 1]} شد و ${bannerName} دریافت کرد.`
        : `کاروان شما در چالش میان‌گروهی "${challenge.title}" شرکت کرد و ${bannerName} دریافت کرد.`;
      const recipients = new Set<string>(students.filter(m => m.caravanId === r.caravanId).map(m => m.id));
      const mentorId = caravanRows.find(c => c.id === r.caravanId)?.mentorId;
      if (mentorId) recipients.add(mentorId);
      for (const userId of recipients) notes.push({ userId, title: `${names.derafsh} کاروان 🚩`, message: msg, type: 'reward' });
    }
    if (notes.length > 0) await prisma.notification.createMany({ data: notes });

    res.json({ success: true, result: rows });
  } catch (error: any) {
    if (error?.message === 'ALREADY_FINALIZED') {
      return res.status(409).json({ error: 'رتبه‌بندی این چالش قبلاً تایید شده است' });
    }
    console.error('finalizeChallengeRanking error:', error);
    res.status(500).json({ error: 'خطا در ثبت رتبه‌بندی' });
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
