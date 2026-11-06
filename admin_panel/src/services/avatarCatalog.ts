import fs from 'fs';
import path from 'path';
import prisma from '../config/db';

/**
 * The profile pictures users can pick in the app («تصاویر پروفایل» in the panel's «تصاویر اپلیکیشن» tab).
 *
 * Each picture stores the exact value written to User.avatarUrl: a picture bundled with the app (`asset:boy_1`) or an
 * upload (`/uploads/<hex>.jpg`). So a user keeps the picture they picked whatever happens to the list, and older app
 * versions show uploaded ones as ordinary network pictures. Stored as one JSON row in SystemSetting (no migration).
 *
 *  - active  = offered in the app's picker; the first active picture of a group is the default of that group
 *  - retired = no longer offered, but the users who picked it keep it (shown in the panel with their count)
 */
const SETTING_KEY = 'AVATAR_CATALOG';

export const AVATAR_GROUPS = ['male', 'female', 'mentor_male', 'mentor_female'] as const;
export type AvatarGroup = (typeof AVATAR_GROUPS)[number];
export type AvatarItem = { id: string; group: AvatarGroup; value: string; active: boolean };

const BUNDLED: Record<AvatarGroup, string[]> = {
  male: ['boy_1', 'boy_2', 'boy_3', 'boy_4'],
  female: ['girl_1', 'girl_2', 'girl_3', 'girl_4'],
  mentor_male: ['mentor_male'],
  mentor_female: ['mentor_female'],
};
/** Every picture bundled with the app (app/assets/avatars, copied to public/images/avatars). */
export const BUNDLED_AVATAR_KEYS = new Set(Object.values(BUNDLED).flat());

function defaults(): AvatarItem[] {
  return AVATAR_GROUPS.flatMap(group => BUNDLED[group].map(key => ({ id: key, group, value: `asset:${key}`, active: true })));
}

let cache: { at: number; items: AvatarItem[] } | null = null;

export async function getAvatarCatalog(): Promise<AvatarItem[]> {
  if (cache && Date.now() - cache.at < 30_000) return cache.items;
  let items = defaults();
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key: SETTING_KEY } });
    const parsed = row ? JSON.parse(row.value) : null;
    if (Array.isArray(parsed?.items)) {
      items = parsed.items
        .filter((i: any) => i && typeof i.id === 'string' && typeof i.value === 'string' && (AVATAR_GROUPS as readonly string[]).includes(i.group))
        .map((i: any) => ({ id: i.id, group: i.group, value: i.value, active: i.active !== false }));
    }
  } catch (e) {
    console.error('getAvatarCatalog error (using the bundled pictures):', e);
  }
  cache = { at: Date.now(), items };
  return items;
}

export async function saveAvatarCatalog(items: AvatarItem[]): Promise<void> {
  const json = JSON.stringify({ items });
  await prisma.systemSetting.upsert({ where: { key: SETTING_KEY }, update: { value: json }, create: { key: SETTING_KEY, value: json } });
  cache = { at: Date.now(), items };
}

export function isMentorRole(role: string | null | undefined): boolean {
  const r = String(role || '').toLowerCase().replace(/[\s_-]/g, '');
  return r === 'mentor' || r === 'supermentor';
}

/** The picture group of a user, or null (no gender yet). */
export function avatarGroupOf(role: string | null | undefined, gender: string | null | undefined): AvatarGroup | null {
  if (gender !== 'male' && gender !== 'female') return null;
  return isMentorRole(role) ? (`mentor_${gender}` as AvatarGroup) : gender;
}

/** The pictures the app offers, per group: {male: [value...], female: [...], mentor_male: [...], mentor_female: [...]}. */
export async function activeAvatarOptions(): Promise<Record<AvatarGroup, string[]>> {
  const items = await getAvatarCatalog();
  const out = { male: [], female: [], mentor_male: [], mentor_female: [] } as Record<AvatarGroup, string[]>;
  for (const i of items) if (i.active) out[i.group].push(i.value);
  return out;
}

/** The default picture of a group: its first active one, else the bundled one. */
export async function defaultAvatarOf(group: AvatarGroup): Promise<string> {
  const items = await getAvatarCatalog();
  return items.find(i => i.group === group && i.active)?.value || `asset:${BUNDLED[group][0]}`;
}

/**
 * The avatarUrl a user should have for a role + gender. A user keeps the picture they have while it belongs to their
 * group (even a retired one); otherwise they get the group's default. Returns undefined when the avatar must not be
 * touched (no gender, or a staff account).
 */
export async function avatarFor(role: string | null | undefined, gender: string | null | undefined, current: string | null | undefined): Promise<string | null | undefined> {
  const r = String(role || '').toLowerCase();
  if (r === 'admin' || r === 'sub_admin') return undefined;
  const group = avatarGroupOf(role, gender);
  if (!group) return undefined;
  const items = await getAvatarCatalog();
  if (current && items.some(i => i.group === group && i.value === current)) return current;
  return defaultAvatarOf(group);
}

/** Deletes an uploaded picture nobody uses any more (only a plain file in uploads/). */
export async function dropAvatarFileIfUnused(value: string, uploadsDir: string): Promise<void> {
  if (!value.startsWith('/uploads/')) return;
  const name = path.basename(value);
  if (!/^[a-f0-9]{32}\.[a-z0-9]+$/.test(name)) return;
  const items = await getAvatarCatalog();
  if (items.some(i => i.value === value)) return;
  const users = await prisma.user.count({ where: { OR: [{ avatarUrl: value }, { siteAvatarUrl: value }] } });
  if (users > 0) return;
  fs.unlink(path.join(uploadsDir, name), () => undefined);
}
