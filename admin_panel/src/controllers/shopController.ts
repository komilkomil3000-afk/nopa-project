// فروشگاه بازارچه: things sold for zarik in the app's market.
//   kinds: sticker_pack (stickers sent in chat), gif_pack (ready GIFs sent in chat), feature (unlocks an ability).
//   Panel (super admin, /admin/shop/*): list, create, edit, put on / take off sale, delete (only if nobody bought it).
//   App (/api/v1/shop*): what is on sale and what I own, buy (pays zarik through the ledger), my packs for the chat.
// A purchase is permanent. Taking an item off sale hides it from the shop; whoever bought it keeps using it.
import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { changeBalance } from '../services/ledger';
import { logAdminAction } from './adminController';
import { isAdminRole } from '../utils/answerKeys';
import { isSupportRole } from '../utils/roles';

export const SHOP_KINDS = ['sticker_pack', 'gif_pack', 'feature'] as const;
type ShopKind = typeof SHOP_KINDS[number];

/** Abilities that can be sold. Only one shop item per feature. */
export const SHOP_FEATURES: Record<string, string> = {
  gif_send: 'ارسال گیف در چت',
};

const ASSET_KIND: Record<string, 'sticker' | 'gif'> = { sticker_pack: 'sticker', gif_pack: 'gif' };
const MAX_ASSETS = 60;
const URL_OK = /^(\/uploads\/|https?:\/\/)/i;

const ITEM_INCLUDE = { assets: { orderBy: { sortOrder: 'asc' as const } } };

function serializeItem(item: any, extra: Record<string, unknown> = {}) {
  return {
    id: item.id,
    kind: item.kind,
    featureKey: item.featureKey,
    featureLabel: item.featureKey ? SHOP_FEATURES[item.featureKey] || item.featureKey : null,
    title: item.title,
    description: item.description || '',
    coverUrl: item.coverUrl || (item.assets?.[0]?.url ?? null),
    priceZarik: item.priceZarik,
    isActive: item.isActive,
    sortOrder: item.sortOrder,
    assets: (item.assets || []).map((a: any) => ({ id: a.id, url: a.url, kind: a.kind })),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    ...extra,
  };
}

/** Reads and checks the item fields sent by the panel. Returns the data or an error message. */
function readItemInput(body: any, partial: boolean): { data?: any; assets?: { url: string; kind: string }[]; error?: string } {
  const data: any = {};
  if (!partial || body.kind !== undefined) {
    if (!SHOP_KINDS.includes(body.kind)) return { error: 'نوع محصول معتبر نیست' };
    data.kind = body.kind as ShopKind;
  }
  if (!partial || body.title !== undefined) {
    const title = String(body.title || '').trim();
    if (!title) return { error: 'نام محصول را وارد کنید' };
    if (title.length > 80) return { error: 'نام محصول حداکثر ۸۰ نویسه است' };
    data.title = title;
  }
  if (body.description !== undefined) data.description = String(body.description || '').trim().slice(0, 500) || null;
  if (body.coverUrl !== undefined) {
    const cover = String(body.coverUrl || '').trim();
    if (cover && !URL_OK.test(cover)) return { error: 'آدرس تصویر جلد معتبر نیست' };
    data.coverUrl = cover || null;
  }
  if (!partial || body.priceZarik !== undefined) {
    const price = Number(body.priceZarik);
    if (!Number.isInteger(price) || price < 0 || price > 1_000_000) return { error: 'قیمت باید عددی صحیح و صفر یا بیشتر باشد' };
    data.priceZarik = price;
  }
  if (body.isActive !== undefined) data.isActive = body.isActive === true;
  if (body.sortOrder !== undefined) data.sortOrder = Number.parseInt(body.sortOrder, 10) || 0;
  if (body.featureKey !== undefined) data.featureKey = body.featureKey ? String(body.featureKey) : null;

  let assets: { url: string; kind: string }[] | undefined;
  if (Array.isArray(body.assets)) {
    const urls = body.assets.map((a: any) => String(typeof a === 'string' ? a : a?.url || '').trim()).filter(Boolean);
    if (urls.length > MAX_ASSETS) return { error: `هر بسته حداکثر ${MAX_ASSETS} مورد دارد` };
    if (urls.some((u: string) => !URL_OK.test(u))) return { error: 'آدرس یکی از تصاویر بسته معتبر نیست' };
    assets = urls.map((url: string) => ({ url, kind: '' }));
  }
  return { data, assets };
}

/** Rules that need the item as a whole (after merging an edit with what is stored). */
async function checkItem(merged: { id?: string; kind: string; featureKey: string | null; isActive: boolean }, assetCount: number): Promise<string | null> {
  if (merged.kind === 'feature') {
    if (!merged.featureKey || !SHOP_FEATURES[merged.featureKey]) return 'قابلیتی که فروخته می‌شود را انتخاب کنید';
    const other = await prisma.shopItem.findFirst({ where: { featureKey: merged.featureKey, ...(merged.id ? { id: { not: merged.id } } : {}) }, select: { title: true } });
    if (other) return `برای این قابلیت قبلاً محصول «${other.title}» ساخته شده است`;
  } else if (merged.isActive && assetCount === 0) {
    return 'بسته‌ی بدون استیکر یا گیف را نمی‌توان برای فروش گذاشت';
  }
  return null;
}

// ---------------- Panel ----------------

export async function adminListShopItems(_req: AuthRequest, res: Response) {
  try {
    const items = await prisma.shopItem.findMany({ include: ITEM_INCLUDE, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] });
    const stats = await prisma.shopPurchase.groupBy({ by: ['itemId'], _count: { _all: true }, _sum: { price: true } });
    const byItem = new Map(stats.map(s => [s.itemId, { buyers: s._count._all, revenue: s._sum.price || 0 }]));
    res.json({
      items: items.map(i => serializeItem(i, byItem.get(i.id) || { buyers: 0, revenue: 0 })),
      features: Object.entries(SHOP_FEATURES).map(([key, label]) => ({ key, label })),
    });
  } catch (error: any) {
    console.error('adminListShopItems error:', error);
    res.status(500).json({ error: 'خطا در دریافت محصولات بازارچه' });
  }
}

export async function adminCreateShopItem(req: AuthRequest, res: Response) {
  try {
    const input = readItemInput(req.body || {}, false);
    if (input.error) return res.status(400).json({ error: input.error });
    const data = input.data;
    if (data.kind !== 'feature') data.featureKey = null;
    const assets = data.kind === 'feature' ? [] : (input.assets || []);
    const problem = await checkItem({ kind: data.kind, featureKey: data.featureKey ?? null, isActive: !!data.isActive }, assets.length);
    if (problem) return res.status(400).json({ error: problem });

    const item = await prisma.shopItem.create({
      data: { ...data, assets: { create: assets.map((a, i) => ({ url: a.url, kind: ASSET_KIND[data.kind] || 'sticker', sortOrder: i })) } },
      include: ITEM_INCLUDE,
    });
    await logAdminAction(req.user!.id, req.user?.phoneNumber || 'Admin', 'CREATE_SHOP_ITEM', 'ShopItem', item.id, `محصول بازارچه: ${item.title} (${item.priceZarik} زریک)`, req.ip || '');
    res.status(201).json(serializeItem(item, { buyers: 0, revenue: 0 }));
  } catch (error: any) {
    console.error('adminCreateShopItem error:', error);
    res.status(500).json({ error: 'خطا در ساخت محصول' });
  }
}

export async function adminUpdateShopItem(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const existing = await prisma.shopItem.findUnique({ where: { id }, include: { _count: { select: { assets: true, purchases: true } } } });
    if (!existing) return res.status(404).json({ error: 'محصول یافت نشد' });
    const input = readItemInput(req.body || {}, true);
    if (input.error) return res.status(400).json({ error: input.error });
    const data = input.data;
    // What people bought stays what it was: the kind of a sold item cannot change
    if (data.kind && data.kind !== existing.kind && existing._count.purchases > 0) {
      return res.status(409).json({ error: 'این محصول خریدار دارد؛ نوع آن قابل تغییر نیست' });
    }
    const kind = data.kind || existing.kind;
    if (kind !== 'feature') data.featureKey = null;
    const assets = kind === 'feature' ? [] : input.assets;
    const assetCount = assets ? assets.length : existing._count.assets;
    const problem = await checkItem({
      id, kind,
      featureKey: data.featureKey !== undefined ? data.featureKey : existing.featureKey,
      isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
    }, assetCount);
    if (problem) return res.status(400).json({ error: problem });

    const item = await prisma.$transaction(async tx => {
      if (assets) {
        // Stickers already sent in chats keep their own copy of the link (message meta), so replacing the list is safe
        await tx.shopItemAsset.deleteMany({ where: { itemId: id } });
        if (assets.length) await tx.shopItemAsset.createMany({ data: assets.map((a, i) => ({ itemId: id, url: a.url, kind: ASSET_KIND[kind] || 'sticker', sortOrder: i })) });
      }
      return tx.shopItem.update({ where: { id }, data, include: ITEM_INCLUDE });
    });
    await logAdminAction(req.user!.id, req.user?.phoneNumber || 'Admin', 'UPDATE_SHOP_ITEM', 'ShopItem', id, `ویرایش محصول بازارچه: ${item.title}`, req.ip || '');
    const stats = await prisma.shopPurchase.aggregate({ where: { itemId: id }, _count: { _all: true }, _sum: { price: true } });
    res.json(serializeItem(item, { buyers: stats._count._all, revenue: stats._sum.price || 0 }));
  } catch (error: any) {
    console.error('adminUpdateShopItem error:', error);
    res.status(500).json({ error: 'خطا در ذخیره محصول' });
  }
}

export async function adminDeleteShopItem(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const item = await prisma.shopItem.findUnique({ where: { id }, include: { _count: { select: { purchases: true } } } });
    if (!item) return res.status(404).json({ error: 'محصول یافت نشد' });
    if (item._count.purchases > 0) {
      return res.status(409).json({ error: 'این محصول خریدار دارد و حذف نمی‌شود؛ آن را از فروش خارج کنید' });
    }
    await prisma.shopItem.delete({ where: { id } });
    await logAdminAction(req.user!.id, req.user?.phoneNumber || 'Admin', 'DELETE_SHOP_ITEM', 'ShopItem', id, `حذف محصول بازارچه: ${item.title}`, req.ip || '');
    res.json({ success: true });
  } catch (error: any) {
    console.error('adminDeleteShopItem error:', error);
    res.status(500).json({ error: 'خطا در حذف محصول' });
  }
}

// ---------------- App ----------------

/** GET /shop -> what is on sale, with what I already own (owned items stay listed even when taken off sale). */
export async function getShop(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const owned = await prisma.shopPurchase.findMany({ where: { userId }, select: { itemId: true } });
    const ownedIds = owned.map(o => o.itemId);
    const items = await prisma.shopItem.findMany({
      where: { OR: [{ isActive: true }, { id: { in: ownedIds } }] },
      include: ITEM_INCLUDE,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { zarikBalance: true } });
    const ownedSet = new Set(ownedIds);
    res.json({
      zarik: me?.zarikBalance ?? 0,
      items: items.map(i => serializeItem(i, { owned: ownedSet.has(i.id) })),
    });
  } catch (error: any) {
    console.error('getShop error:', error);
    res.status(500).json({ error: 'خطا در دریافت فروشگاه بازارچه' });
  }
}

/** POST /shop/items/:id/buy -> pays the price in zarik (ledger) and records the purchase, once. */
export async function buyShopItem(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const item = await prisma.shopItem.findUnique({ where: { id } });
    if (!item || !item.isActive) return res.status(404).json({ error: 'این محصول در حال حاضر فروشی نیست' });
    const already = await prisma.shopPurchase.findUnique({ where: { userId_itemId: { userId, itemId: id } } });
    if (already) return res.status(409).json({ error: 'این محصول را قبلاً خریده‌اید' });

    await prisma.$transaction(async tx => {
      await changeBalance(tx, {
        userId, asset: 'zarik', amount: -item.priceZarik, sourceType: 'shop_purchase', sourceId: item.id,
        reason: `خرید «${item.title}» از بازارچه`, createdBy: userId, zarikCategory: 'shop',
      });
      await tx.shopPurchase.create({ data: { userId, itemId: id, price: item.priceZarik } });
    });
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { zarikBalance: true } });
    res.status(201).json({ success: true, message: `«${item.title}» خریداری شد`, zarik: me?.zarikBalance ?? 0 });
  } catch (error: any) {
    if (error?.message === 'INSUFFICIENT_BALANCE') return res.status(400).json({ error: 'زریک شما برای این خرید کافی نیست' });
    if (error?.code === 'P2002') return res.status(409).json({ error: 'این محصول را قبلاً خریده‌اید' });
    console.error('buyShopItem error:', error);
    res.status(500).json({ error: 'خطا در خرید' });
  }
}

/** GET /shop/mine -> my sticker / GIF packs (for the chat picker) and what my bought features allow. */
export async function getMyShop(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const rows = await prisma.shopPurchase.findMany({ where: { userId }, include: { item: { include: ITEM_INCLUDE } }, orderBy: { createdAt: 'asc' } });
    const packs = rows.filter(r => r.item.kind !== 'feature').map(r => serializeItem(r.item));
    res.json({ packs, abilities: { gifSend: await canSendGif({ id: userId, role: req.user!.role }) } });
  } catch (error: any) {
    console.error('getMyShop error:', error);
    res.status(500).json({ error: 'خطا در دریافت بسته‌های شما' });
  }
}

// ---------------- Used by the chat ----------------

/**
 * Sending a GIF file in chat. Free for everyone until the admin puts the «ارسال گیف در چت» feature on sale;
 * then only its buyers (and staff) may send one.
 */
export async function canSendGif(user: { id: string; role: string }): Promise<boolean> {
  if (isAdminRole(user.role) || isSupportRole(user.role)) return true;
  const feature = await prisma.shopItem.findFirst({ where: { kind: 'feature', featureKey: 'gif_send', isActive: true }, select: { id: true } });
  if (!feature) return true;
  const bought = await prisma.shopPurchase.findFirst({ where: { userId: user.id, item: { kind: 'feature', featureKey: 'gif_send' } }, select: { id: true } });
  return !!bought;
}

/** A sticker / GIF of a pack the user owns, or null. */
export async function ownedShopAsset(userId: string, assetId: string) {
  const asset = await prisma.shopItemAsset.findUnique({ where: { id: assetId }, include: { item: { select: { id: true, title: true, kind: true } } } });
  if (!asset || asset.item.kind === 'feature') return null;
  const bought = await prisma.shopPurchase.findUnique({ where: { userId_itemId: { userId, itemId: asset.itemId } }, select: { id: true } });
  return bought ? asset : null;
}
