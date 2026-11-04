import prisma from '../config/db';
import { isOnline } from '../modules/chat/realtime';
import { isInApp } from './liveActivity';
import { tehranDay } from '../controllers/mentorWorkspaceController';

// Is a person in the app right now, and how long have they used it. Online = a live chat socket, or an app usage
// report in the last few minutes (the app reports its foreground seconds about once a minute, see recordAppUsage).
const RECENT_PING_MS = 3 * 60 * 1000;

export interface Presence {
  online: boolean;
  lastSeenAt: Date | null;
}

export async function presenceOf(userIds: string[]): Promise<Map<string, Presence>> {
  const out = new Map<string, Presence>();
  if (!userIds.length) return out;
  const [users, latest] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, lastActiveTimestamp: true } }),
    prisma.userUsageDay.groupBy({ by: ['userId'], where: { userId: { in: userIds } }, _max: { updatedAt: true } }),
  ]);
  const pinged = new Map(latest.map(l => [l.userId, l._max.updatedAt]));
  const now = Date.now();
  for (const u of users) {
    const ping = pinged.get(u.id) || null;
    const seen = [u.lastActiveTimestamp, ping].filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0] || null;
    const online = isInApp(u.id) || isOnline(u.id) || (!!ping && now - ping.getTime() < RECENT_PING_MS);
    out.set(u.id, { online, lastSeenAt: online ? new Date() : seen });
  }
  return out;
}

/** Seconds in the app: today, the last 7 and 30 days, all time, and the last 30 days one by one ("YYYY-MM-DD" -> s). */
export async function usageSummary(userId: string) {
  const rows = await prisma.userUsageDay.findMany({ where: { userId }, select: { day: true, seconds: true } });
  const today = tehranDay(new Date());
  const since7 = tehranDay(new Date(Date.now() - 6 * 86400000));
  const since30 = tehranDay(new Date(Date.now() - 29 * 86400000));
  let todaySec = 0, week = 0, month = 0, total = 0;
  const days: Record<string, number> = {};
  for (const r of rows) {
    total += r.seconds;
    if (r.day === today) todaySec += r.seconds;
    if (r.day >= since7) week += r.seconds;
    if (r.day >= since30) { month += r.seconds; days[r.day] = r.seconds; }
  }
  return { todaySeconds: todaySec, weekSeconds: week, monthSeconds: month, totalSeconds: total, activeDays: rows.length, days };
}
