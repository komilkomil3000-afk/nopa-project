import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Request, Response } from 'express';
import prisma from '../config/db';
import { uploadsDir } from './mediaController';
import { AVATAR_GROUPS, AvatarGroup, AvatarItem, dropAvatarFileIfUnused, getAvatarCatalog, saveAvatarCatalog } from '../services/avatarCatalog';

// «تصاویر پروفایل» (panel → تصاویر اپلیکیشن): the profile pictures the app offers, per group.
//   GET    /admin/app-avatars                      -> { items: [{ id, group, value, active, holders }] }
//   POST   /admin/app-avatars/group/:group         (multipart image)            add a picture to a group
//   POST   /admin/app-avatars/item/:id             (multipart image, mode)      replace a picture
//          mode=all  -> everyone who has it gets the new one;  mode=keep -> they keep the old one, which is retired
//   DELETE /admin/app-avatars/item/:id?mode=switch|keep
//          switch -> its users get the group's default and it is removed; keep -> it is retired, its users keep it
//   POST   /admin/app-avatars/item/:id/restore     offer a retired picture again
//   POST   /admin/app-avatars/item/:id/first       make it the group's default (first one)

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function checkImage(file: Express.Multer.File | undefined): string {
  if (!file) throw new HttpError(400, 'تصویری انتخاب نشده است');
  if (!IMAGE_EXTENSIONS.has(path.extname(file.filename).toLowerCase())) throw new HttpError(400, 'فقط تصویر (JPG، PNG، WEBP یا GIF) مجاز است');
  if (file.size > 5 * 1024 * 1024) throw new HttpError(400, 'حجم تصویر نباید بیشتر از ۵ مگابایت باشد');
  return `/uploads/${file.filename}`;
}

async function holdersOf(values: string[]): Promise<Map<string, number>> {
  if (!values.length) return new Map();
  const rows = await prisma.user.groupBy({ by: ['avatarUrl'], where: { avatarUrl: { in: values }, isDeleted: false }, _count: { _all: true } });
  return new Map(rows.map(r => [r.avatarUrl as string, r._count._all]));
}

async function listing() {
  const items = await getAvatarCatalog();
  const counts = await holdersOf(items.map(i => i.value));
  return { groups: AVATAR_GROUPS, items: items.map(i => ({ ...i, holders: counts.get(i.value) || 0 })) };
}

function fail(res: Response, e: any, file?: Express.Multer.File) {
  if (file) fs.unlink(file.path, () => undefined);
  if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
  console.error('avatar catalog error:', e);
  res.status(500).json({ error: 'خطا در ذخیره‌ی تصاویر پروفایل' });
}

async function findItem(id: string): Promise<{ items: AvatarItem[]; item: AvatarItem }> {
  const items = (await getAvatarCatalog()).map(i => ({ ...i }));
  const item = items.find(i => i.id === id);
  if (!item) throw new HttpError(404, 'این تصویر پیدا نشد');
  return { items, item };
}

const newId = () => `av_${crypto.randomBytes(6).toString('hex')}`;
const activeIn = (items: AvatarItem[], group: AvatarGroup) => items.filter(i => i.group === group && i.active);

export async function listAvatarCatalog(_req: Request, res: Response) {
  try { res.json(await listing()); } catch (e) { fail(res, e); }
}

export async function addAvatar(req: Request, res: Response) {
  const file = (req as any).file as Express.Multer.File | undefined;
  try {
    const group = req.params.group as AvatarGroup;
    if (!(AVATAR_GROUPS as readonly string[]).includes(group)) throw new HttpError(404, 'گروه تصویر نامعتبر است');
    const value = checkImage(file);
    const items = [...(await getAvatarCatalog()), { id: newId(), group, value, active: true }];
    await saveAvatarCatalog(items);
    res.json(await listing());
  } catch (e) { fail(res, e, file); }
}

export async function replaceAvatar(req: Request, res: Response) {
  const file = (req as any).file as Express.Multer.File | undefined;
  try {
    const { items, item } = await findItem(req.params.id);
    const value = checkImage(file);
    const old = item.value;
    // nobody has it yet: nothing to keep, so it is simply replaced
    const mode = (await holdersOf([old])).get(old) ? String(req.body?.mode || 'all') : 'all';
    if (mode === 'keep') {
      // the old picture stays with the users who have it and is no longer offered; the new one takes its place
      const index = items.indexOf(item);
      item.active = false;
      items.splice(index, 0, { id: newId(), group: item.group, value, active: true });
      await saveAvatarCatalog(items);
    } else {
      item.value = value;
      item.active = true;
      await saveAvatarCatalog(items);
      await prisma.user.updateMany({ where: { avatarUrl: old }, data: { avatarUrl: value } });
      await dropAvatarFileIfUnused(old, uploadsDir);
    }
    res.json(await listing());
  } catch (e) { fail(res, e, file); }
}

export async function removeAvatar(req: Request, res: Response) {
  try {
    const { items, item } = await findItem(req.params.id);
    const mode = String(req.query.mode || 'switch');
    const holders = (await holdersOf([item.value])).get(item.value) || 0;
    const others = activeIn(items, item.group).filter(i => i.id !== item.id);
    if (item.active && !others.length) throw new HttpError(400, 'هر گروه باید دست‌کم یک تصویر قابل انتخاب داشته باشد؛ اول تصویر دیگری اضافه کنید');
    if (mode === 'keep' && holders > 0) {
      item.active = false;
      await saveAvatarCatalog(items);
    } else {
      // its users get the group's default picture
      if (holders > 0) {
        const fallback = others[0]?.value;
        if (!fallback) throw new HttpError(400, 'تصویر جایگزینی در این گروه نیست');
        await prisma.user.updateMany({ where: { avatarUrl: item.value }, data: { avatarUrl: fallback } });
      }
      await saveAvatarCatalog(items.filter(i => i.id !== item.id));
      await dropAvatarFileIfUnused(item.value, uploadsDir);
    }
    res.json(await listing());
  } catch (e) { fail(res, e); }
}

export async function restoreAvatar(req: Request, res: Response) {
  try {
    const { items, item } = await findItem(req.params.id);
    item.active = true;
    await saveAvatarCatalog(items);
    res.json(await listing());
  } catch (e) { fail(res, e); }
}

export async function makeAvatarFirst(req: Request, res: Response) {
  try {
    const { items, item } = await findItem(req.params.id);
    item.active = true;
    const rest = items.filter(i => i.id !== item.id);
    await saveAvatarCatalog([item, ...rest]);
    res.json(await listing());
  } catch (e) { fail(res, e); }
}
