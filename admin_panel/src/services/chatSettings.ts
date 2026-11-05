import { NextFunction, Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { isChannelManagerRole, isMentorRole, isSubAdminRole, isSupportRole } from '../utils/roles';

export const CHAT_MODES = ['off', 'pilot', 'on'] as const;
export type ChatMode = typeof CHAT_MODES[number];

export interface ChatSettings {
  mode: ChatMode;
  pilotCaravanIds: string[];
}

const MODE_KEY = 'chat_mode';
const PILOT_KEY = 'chat_pilot_caravans';
const CACHE_MS = 3_000;
let cached: { settings: ChatSettings; at: number } | null = null;

export async function getChatSettings(): Promise<ChatSettings> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.settings;
  const rows = await prisma.systemSetting.findMany({ where: { key: { in: [MODE_KEY, PILOT_KEY] } } });
  const value = (key: string) => rows.find(r => r.key === key)?.value;

  const storedMode = value(MODE_KEY) as ChatMode | undefined;
  let pilotCaravanIds: string[] = [];
  try {
    const parsed = JSON.parse(value(PILOT_KEY) || '[]');
    if (Array.isArray(parsed)) pilotCaravanIds = parsed.map(String);
  } catch {
    // A damaged list means no caravan is in the pilot
  }
  const settings: ChatSettings = { mode: storedMode && CHAT_MODES.includes(storedMode) ? storedMode : 'off', pilotCaravanIds };
  cached = { settings, at: Date.now() };
  return settings;
}

export async function saveChatSettings(settings: ChatSettings): Promise<void> {
  const save = (key: string, value: string) => prisma.systemSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
  await prisma.$transaction([
    save(MODE_KEY, settings.mode),
    save(PILOT_KEY, JSON.stringify(settings.pilotCaravanIds)),
  ]);
  cached = null;
}

/** Off: nobody. Pilot: staff and the chosen caravans. On: everyone. */
export function canUseChat(user: { role?: string | null; caravanId?: string | null }, settings: ChatSettings): boolean {
  if (settings.mode === 'on') return true;
  if (settings.mode === 'off') return false;
  const role = String(user.role || '').toLowerCase();
  if (role === 'admin' || isSubAdminRole(role) || isMentorRole(role) || isChannelManagerRole(role) || isSupportRole(role)) return true;
  return !!user.caravanId && settings.pilotCaravanIds.includes(user.caravanId);
}

/** The server-side switch: the app hides the tab, and this refuses the calls. */
export async function requireChatEnabled(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const [settings, user] = await Promise.all([
      getChatSettings(),
      prisma.user.findUnique({ where: { id: req.user!.id }, select: { role: true, caravanId: true } }),
    ]);
    if (!user || !canUseChat(user, settings)) {
      return res.status(403).json({ error: 'بخش چت غیرفعال است', code: 'CHAT_DISABLED' });
    }
    next();
  } catch (e) {
    console.error('requireChatEnabled error:', e);
    res.status(500).json({ error: 'خطای سرور در بررسی وضعیت چت' });
  }
}
