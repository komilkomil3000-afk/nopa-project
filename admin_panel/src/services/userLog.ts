import prisma from '../config/db';

// The per-person activity log of the mobile app (UserActivityLog), shown on a person's page in the panel.
// Rows come from the app (entering a part of the app, sent with the usage ping), from the video reports
// (controllers/videoWatchController.ts) and from the server itself for actions done through the API
// (middleware/activityLog.ts: picture / profile changes, challenge answers, quizzes, tickets ...).

/** The parts of the app the usage ping reports time for (UserActivityHour kind "area", refId = the part). */
export const APP_AREAS = ['home', 'academy', 'station', 'challenges', 'market', 'profile', 'chat', 'other'] as const;
export type AppSection = typeof APP_AREAS[number];
export const AREA_LABELS: Record<AppSection, string> = {
  home: 'خانه',
  academy: 'آموزگاه',
  station: 'منزلگاه‌ها',
  challenges: 'چالش‌ها',
  market: 'بازار',
  profile: 'پروفایل',
  chat: 'چت',
  other: 'سایر بخش‌ها',
};
export const isAppSection = (v: unknown): v is AppSection => typeof v === 'string' && (APP_AREAS as readonly string[]).includes(v);

export interface UserLogEntry {
  type: string;
  area?: string;
  refId?: string;
  label?: string;
  seconds?: number;
  at?: Date;
}

const clip = (v: unknown, n: number) => String(v == null ? '' : v).slice(0, n);

/** Adds rows to a person's log; never throws (the log must not break the request that caused it). */
export async function logUserEvents(userId: string, entries: UserLogEntry[]): Promise<void> {
  if (!userId || !entries.length) return;
  const now = Date.now();
  const data = entries.slice(0, 50).map(e => {
    // times sent by the app: not in the future, not older than a day
    const t = e.at instanceof Date && !isNaN(e.at.getTime()) ? Math.min(now, Math.max(now - 86400000, e.at.getTime())) : now;
    return {
      userId,
      type: clip(e.type, 24) || 'other',
      area: clip(e.area, 24),
      refId: clip(e.refId, 64),
      label: clip(e.label, 200),
      seconds: Math.max(0, Math.min(86400, Math.round(Number(e.seconds) || 0))),
      createdAt: new Date(t),
    };
  });
  try {
    await prisma.userActivityLog.createMany({ data });
  } catch (e) {
    console.error('logUserEvents failed:', e);
  }
}

export function logUserEvent(userId: string, entry: UserLogEntry): void {
  void logUserEvents(userId, [entry]);
}

/** Drops log rows older than USER_ACTIVITY_LOG_RETENTION_DAYS (default 180); run with the audit-log cleanup. */
export async function cleanupUserActivityLog(): Promise<number> {
  const days = Number(process.env.USER_ACTIVITY_LOG_RETENTION_DAYS) || 180;
  const r = await prisma.userActivityLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - days * 86400000) } } });
  return r.count;
}
