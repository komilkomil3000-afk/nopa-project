import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { getAssetNames } from '../utils/assetNames';
import { changeBalance, LedgerAsset } from '../services/ledger';
import { noteBalanceChanged } from '../services/balanceEvents';

const ASSETS: LedgerAsset[] = ['zarik', 'nakh', 'farsh', 'beyragh'];
const TIERS = ['gold', 'silver', 'bronze', 'cloth'] as const;
type Tier = typeof TIERS[number];
const TIER_KEY: Record<Tier, string> = { gold: 'derafsh_gold', silver: 'derafsh_silver', bronze: 'derafsh_bronze', cloth: 'derafsh_cloth' };
const ASSET_KEY: Record<LedgerAsset, string> = { zarik: 'zarik', nakh: 'nakh', farsh: 'farsh', beyragh: 'derafsh' };
/** One request never makes more banner rows than this. */
const MAX_BANNERS = 100;

class GrantError extends Error {}

/**
 * The «تراکنش جدید» dialog of the wallets tab, for what the older endpoints cannot do:
 *   - a banner (درفش) of a chosen tier to one person: User.beyragh moves through the ledger and UserBanner keeps the tier;
 *   - anything to a whole caravan: a banner of a tier to the caravan itself (CaravanBanner, like the cross-caravan
 *     ranking gives), or zarik / کلاف / قالیچه to each of its members.
 * Body: { target: 'user' | 'caravan', userId | caravanId, assetType, tier (banners), amount (± integer), reason, category? (zarik) }
 * A negative amount takes away; banners are taken back newest first, and only those given by hand (never a ranking's).
 */
export async function grantAssets(req: AuthRequest, res: Response) {
  try {
    const target = req.body?.target === 'caravan' ? 'caravan' : 'user';
    const assetType = String(req.body?.assetType || '') as LedgerAsset;
    const amount = Number(req.body?.amount);
    const reason = String(req.body?.reason || '').trim().slice(0, 300);
    const category = String(req.body?.category || 'Special Campaigns');
    const tier = String(req.body?.tier || '') as Tier;

    if (!ASSETS.includes(assetType)) return res.status(400).json({ error: 'نوع دارایی نامعتبر است' });
    if (!Number.isInteger(amount) || amount === 0) return res.status(400).json({ error: 'مقدار باید یک عدد صحیح غیرصفر باشد' });
    if (!reason) return res.status(400).json({ error: 'دلیل تراکنش را بنویسید' });
    const banner = assetType === 'beyragh';
    if (banner && !TIERS.includes(tier)) return res.status(400).json({ error: 'نوع درفش را انتخاب کنید (طلایی، نقره‌ای، برنزی یا پارچه‌ای)' });
    if (banner && Math.abs(amount) > MAX_BANNERS) return res.status(400).json({ error: `در هر تراکنش حداکثر ${MAX_BANNERS} درفش` });

    const names = await getAssetNames();
    const assetName = banner ? names[TIER_KEY[tier]] : names[ASSET_KEY[assetType]];
    const count = Math.abs(amount);
    const actorId = req.user!.id;
    const ledgerReason = banner ? `${reason} (${assetName})` : reason;
    const change = amount > 0 ? `${count} ${assetName} دریافت کرد` : `${count} ${assetName} از او کسر شد`;

    if (target === 'user') {
      const userId = String(req.body?.userId || '');
      const user = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } }) : null;
      if (!user) return res.status(404).json({ error: 'کاربر یافت نشد' });

      await prisma.$transaction(async tx => {
        await changeBalance(tx, { userId, asset: assetType, amount, sourceType: 'admin_adjust', reason: ledgerReason, createdBy: actorId, zarikCategory: category });
        if (!banner) return;
        if (amount > 0) {
          await tx.userBanner.createMany({ data: Array.from({ length: count }, () => ({ userId, tier, reason, awardedBy: actorId })) });
        } else {
          const rows = await tx.userBanner.findMany({ where: { userId, tier }, orderBy: { createdAt: 'desc' }, take: count, select: { id: true } });
          if (rows.length < count) throw new GrantError(`این نفر فقط ${rows.length} ${assetName} ثبت‌شده دارد`);
          await tx.userBanner.deleteMany({ where: { id: { in: rows.map(r => r.id) } } });
        }
      });
      await prisma.notification.create({
        data: { userId, title: amount > 0 ? 'پاداش جدید' : 'کسر موجودی', message: `شما ${change}. بابت: ${reason}`, type: amount > 0 ? 'reward' : 'alert' },
      });
      await audit(req, 'User', userId, `${assetName} به میزان ${amount} برای ${user.name}. علت: ${reason}`);
      return res.json({ success: true, message: `${user.name} ${change}` });
    }

    const caravanId = String(req.body?.caravanId || '');
    const caravan = caravanId ? await prisma.caravan.findUnique({ where: { id: caravanId }, select: { id: true, name: true, mentorId: true } }) : null;
    if (!caravan) return res.status(404).json({ error: 'کاروان یافت نشد' });
    const members = await prisma.user.findMany({ where: { caravanId, isDeleted: false, role: 'student' }, select: { id: true } });

    if (banner) {
      // The caravan holds the banner, as with the cross-caravan ranking
      await prisma.$transaction(async tx => {
        if (amount > 0) {
          await tx.caravanBanner.createMany({ data: Array.from({ length: count }, () => ({ caravanId, tier, rank: null, challengeId: null, awardedBy: actorId })) });
        } else {
          const rows = await tx.caravanBanner.findMany({ where: { caravanId, tier, challengeId: null }, orderBy: { createdAt: 'desc' }, take: count, select: { id: true } });
          if (rows.length < count) throw new GrantError(`این کاروان فقط ${rows.length} ${assetName} دارد که دستی داده شده باشد (درفش‌های رتبه‌بندی از اینجا کم نمی‌شوند)`);
          await tx.caravanBanner.deleteMany({ where: { id: { in: rows.map(r => r.id) } } });
        }
      });
      noteBalanceChanged(); // the caravans' درفش changed
    } else {
      if (members.length === 0) return res.status(400).json({ error: 'این کاروان عضوی ندارد' });
      await prisma.$transaction(async tx => {
        for (const m of members) {
          await changeBalance(tx, { userId: m.id, asset: assetType, amount, sourceType: 'admin_adjust', reason: `${reason} (کاروان ${caravan.name})`, createdBy: actorId, zarikCategory: category });
        }
      }, { timeout: 60000 });
    }

    const recipients = new Set(members.map(m => m.id));
    if (caravan.mentorId) recipients.add(caravan.mentorId);
    const message = banner
      ? `کاروان شما ${change}. بابت: ${reason}`
      : `هر عضو کاروان شما ${change}. بابت: ${reason}`;
    if (recipients.size > 0) {
      await prisma.notification.createMany({
        data: Array.from(recipients).map(userId => ({ userId, title: amount > 0 ? 'پاداش کاروان' : 'کسر موجودی کاروان', message, type: amount > 0 ? 'reward' : 'alert' })),
      });
    }
    await audit(req, 'Caravan', caravanId, `${assetName} به میزان ${amount} برای ${banner ? 'کاروان' : 'هر عضو کاروان'} ${caravan.name}. علت: ${reason}`);
    res.json({
      success: true,
      message: banner ? `کاروان ${caravan.name} ${change}` : `هر یک از ${members.length} عضو کاروان ${caravan.name} ${change}`,
    });
  } catch (error: any) {
    if (error instanceof GrantError) return res.status(400).json({ error: error.message });
    if (error?.message === 'INSUFFICIENT_BALANCE') return res.status(400).json({ error: 'موجودی نمی‌تواند منفی شود (موجودی دست‌کم یک نفر کافی نیست)' });
    console.error('grantAssets error:', error);
    res.status(500).json({ error: 'خطا در اعمال تراکنش' });
  }
}

function audit(req: AuthRequest, targetEntity: string, targetEntityId: string, details: string) {
  return prisma.auditLog.create({
    data: { actorId: req.user!.id, actorName: req.user!.role, action: 'ADJUST_BALANCE', targetEntity, targetEntityId, details, ipAddress: req.ip || '127.0.0.1' },
  });
}
