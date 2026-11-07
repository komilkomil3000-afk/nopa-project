import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import prisma from '../config/db';
import { uploadsDir } from './mediaController';
import { activeAvatarOptions } from '../services/avatarCatalog';

/**
 * Pictures the app shows that the admin sets in the panel («تصاویر اپلیکیشن»): the image of each asset and the
 * default picture of each kind of chat channel / group. Stored as one JSON row in SystemSetting (no migration);
 * the files themselves live in uploads/ like every other upload. Home header banners keep their own table (Banner).
 */
const SETTING_KEY = 'APP_IMAGES';

export const APP_IMAGE_SLOTS: Record<'assets' | 'chat', string[]> = {
  assets: ['zarik', 'nakh', 'farsh', 'derafsh', 'derafsh_gold', 'derafsh_silver', 'derafsh_bronze', 'derafsh_cloth'],
  chat: ['announcements', 'arena', 'mentors', 'caravan', 'challenges', 'media', 'support'],
};

type AppImages = { assets: Record<string, string>; chat: Record<string, string> };
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

let cache: { at: number; value: AppImages } | null = null;

export async function getAppImages(): Promise<AppImages> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  const value: AppImages = { assets: {}, chat: {} };
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key: SETTING_KEY } });
    const parsed = row ? JSON.parse(row.value) : {};
    for (const group of ['assets', 'chat'] as const) {
      for (const key of APP_IMAGE_SLOTS[group]) {
        const url = parsed?.[group]?.[key];
        if (typeof url === 'string' && url) value[group][key] = url;
      }
    }
  } catch (e) {
    console.error('getAppImages error (using none):', e);
  }
  cache = { at: Date.now(), value };
  return value;
}

/** The default picture of a chat space type, or null. */
export async function defaultChatImage(type: string): Promise<string | null> {
  return (await getAppImages()).chat[type] || null;
}

async function save(value: AppImages) {
  const json = JSON.stringify(value);
  await prisma.systemSetting.upsert({ where: { key: SETTING_KEY }, update: { value: json }, create: { key: SETTING_KEY, value: json } });
  cache = null;
}

/** Deletes a replaced picture, only a plain file in uploads/ (never a path outside it). */
function dropFile(url: string | undefined) {
  if (!url || !url.startsWith('/uploads/')) return;
  const name = path.basename(url);
  if (/^[a-f0-9]{32}\.[a-z0-9]+$/.test(name)) fs.unlink(path.join(uploadsDir, name), () => undefined);
}

function slotOf(req: Request): { group: 'assets' | 'chat'; key: string } | null {
  const group = req.params.group as 'assets' | 'chat';
  if (!APP_IMAGE_SLOTS[group] || !APP_IMAGE_SLOTS[group].includes(req.params.key)) return null;
  return { group, key: req.params.key };
}

/** App + panel: every picture that is set, plus the profile pictures the app offers per group (`avatars`). */
export async function listAppImages(_req: Request, res: Response) {
  res.json({ ...(await getAppImages()), avatars: await activeAvatarOptions() });
}

/** Panel: sets (multipart `image`) the picture of one slot. */
export async function setAppImage(req: Request, res: Response) {
  const file = (req as any).file as Express.Multer.File | undefined;
  try {
    const slot = slotOf(req);
    if (!slot) throw Object.assign(new Error('جایگاه تصویر نامعتبر است'), { status: 404 });
    if (!file) throw Object.assign(new Error('تصویری انتخاب نشده است'), { status: 400 });
    if (!IMAGE_EXTENSIONS.has(path.extname(file.filename).toLowerCase())) throw Object.assign(new Error('فقط تصویر (JPG، PNG، WEBP یا GIF) مجاز است'), { status: 400 });
    if (file.size > 5 * 1024 * 1024) throw Object.assign(new Error('حجم تصویر نباید بیشتر از ۵ مگابایت باشد'), { status: 400 });
    const current = await getAppImages();
    const value: AppImages = { assets: { ...current.assets }, chat: { ...current.chat } };
    const old = value[slot.group][slot.key];
    value[slot.group][slot.key] = `/uploads/${file.filename}`;
    await save(value);
    dropFile(old);
    res.json(value);
  } catch (e: any) {
    if (file) fs.unlink(file.path, () => undefined);
    res.status(e.status || 500).json({ error: e.status ? e.message : 'خطا در ذخیره‌ی تصویر' });
  }
}

/** Panel: clears one slot; the app falls back to its built-in icon. */
export async function clearAppImage(req: Request, res: Response) {
  try {
    const slot = slotOf(req);
    if (!slot) return res.status(404).json({ error: 'جایگاه تصویر نامعتبر است' });
    const current = await getAppImages();
    const value: AppImages = { assets: { ...current.assets }, chat: { ...current.chat } };
    const old = value[slot.group][slot.key];
    delete value[slot.group][slot.key];
    await save(value);
    dropFile(old);
    res.json(value);
  } catch (e) {
    console.error('clearAppImage error:', e);
    res.status(500).json({ error: 'خطا در حذف تصویر' });
  }
}
