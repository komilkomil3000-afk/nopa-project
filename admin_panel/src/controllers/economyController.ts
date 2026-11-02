import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { logAdminAction } from './adminController';
import { capitalValue, EconomyConfig, getEconomyPolicy, nakhValue, parseEconomyConfig, saveEconomyPolicy } from '../services/economy';

/** The rates the app shows and calculates with. */
export async function getEconomyRates(_req: AuthRequest, res: Response) {
  try {
    const { config } = await getEconomyPolicy();
    res.json({
      nakhPerFarsh: config.nakhPerFarsh,
      farshSalePrice: config.farshSalePrice,
      allowBuyNakh: config.allowBuyNakh,
      zarikPerNakh: config.zarikPerNakh,
      challengeMaxNakh: config.challengeMaxNakh,
      nakhValue: nakhValue(config),
    });
  } catch (error) {
    console.error('getEconomyRates error:', error);
    res.status(500).json({ error: 'خطا در دریافت نرخ‌ها' });
  }
}

export async function getEconomyAdmin(_req: AuthRequest, res: Response) {
  try {
    const policy = await getEconomyPolicy();
    const history = await prisma.economyPolicy.findMany({ orderBy: { version: 'desc' }, take: 20 });
    const actorIds = Array.from(new Set(history.map(h => h.createdBy)));
    const actors = await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } });
    res.json({
      ...policy,
      history: history.map(h => ({ ...h, createdByName: actors.find(a => a.id === h.createdBy)?.name || 'سیستم' })),
    });
  } catch (error) {
    console.error('getEconomyAdmin error:', error);
    res.status(500).json({ error: 'خطا در دریافت تنظیمات مالی' });
  }
}

/** What a change would do: total ranking capital and the most one inter-group challenge can pay. */
async function previewEconomy(current: EconomyConfig, next: EconomyConfig) {
  const students = await prisma.user.findMany({
    where: { role: 'student' },
    select: { zarikBalance: true, nakh: true, farsh: true, caravanId: true },
  });
  const capital = (c: EconomyConfig) => students.reduce((sum, s) => sum + capitalValue(s, c), 0);

  const sizes = new Map<string, number>();
  for (const s of students) if (s.caravanId) sizes.set(s.caravanId, (sizes.get(s.caravanId) || 0) + 1);
  const largestFirst = Array.from(sizes.values()).sort((a, b) => b - a);
  const maxPrize = (c: EconomyConfig) => {
    const { gold, silver, bronze, cloth } = c.interGroup.prizes;
    return largestFirst.reduce((sum, size, i) => sum + size * ([gold, silver, bronze][i] ?? cloth), 0);
  };

  return {
    students: students.length,
    capitalBefore: capital(current),
    capitalAfter: capital(next),
    maxInterGroupBefore: maxPrize(current),
    maxInterGroupAfter: maxPrize(next),
  };
}

/** Body: { config, note?, dryRun? }. A save adds a new version; past transactions keep theirs. */
export async function updateEconomy(req: AuthRequest, res: Response) {
  try {
    const parsed = parseEconomyConfig(req.body?.config);
    if ('error' in parsed) return res.status(400).json({ error: parsed.error });

    const current = await getEconomyPolicy();
    const preview = await previewEconomy(current.config, parsed.config);
    if (req.body?.dryRun === true) return res.json({ preview });

    const note = String(req.body?.note || '').trim().slice(0, 300) || null;
    const saved = await saveEconomyPolicy(parsed.config, req.user!.id, note);
    await logAdminAction(
      req.user!.id, req.user!.phoneNumber || 'Admin', 'UPDATE_ECONOMY_POLICY', 'EconomyPolicy', String(saved.version),
      `نسخه ${current.version} به ${saved.version}: ${JSON.stringify(parsed.config)}`, req.ip || ''
    );
    res.json({ ...saved, preview });
  } catch (error) {
    console.error('updateEconomy error:', error);
    res.status(500).json({ error: 'خطا در ذخیره تنظیمات مالی' });
  }
}
