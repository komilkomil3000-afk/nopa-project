import prisma from '../config/db';

// Records a person's activity into UserActivityHour (Asia/Tehran day + hour). Never throws: losing one sample
// must not fail the request that carried it.

const tehranParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
});

/** { day: "YYYY-MM-DD", hour: 0..23 } of a moment in Tehran. */
export function tehranSlot(d: Date = new Date()): { day: string; hour: number } {
  const parts: Record<string, string> = {};
  for (const p of tehranParts.formatToParts(d)) parts[p.type] = p.value;
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) % 24 };
}

export type ActivityKind = 'app' | 'open' | 'video';

export async function addActivity(userId: string, kind: ActivityKind, value: number, refId = ''): Promise<void> {
  const v = Math.round(value);
  if (!userId || !(v > 0)) return;
  const { day, hour } = tehranSlot();
  try {
    await prisma.userActivityHour.upsert({
      where: { userId_day_hour_kind_refId: { userId, day, hour, kind, refId } },
      create: { userId, day, hour, kind, refId, value: v },
      update: { value: { increment: v } },
    });
  } catch (e) {
    console.error('addActivity failed:', e);
  }
}
