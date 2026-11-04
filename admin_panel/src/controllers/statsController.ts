import { Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { tehranSlot } from '../services/activity';
import { liveInApp, recentLiveEvents } from '../services/liveActivity';

// Charts of the admin panel: a person's page and the «آمار» tab.
//   GET /admin/analytics/stats/series   ?metric&range[&userId|caravanId|role|stationId]  -> one bar chart
//   GET /admin/analytics/stats/overview ?range[&caravanId|role]                          -> totals and breakdowns
// Days are Asia/Tehran days ("YYYY-MM-DD"); weeks start on Saturday and months are Persian (Jalali) months.
// range: today (24 hours) | week (Sat..Fri) | month (this Jalali month) | month:1405-07 | all (one bar per month)

type Metric = 'app' | 'video' | 'chat' | 'station' | 'other' | 'opens' | 'logins' | 'active' | 'messages' | 'challenges' | 'quizzes';
// video = time the station videos played (class parts + gallery, repeats included; controllers/videoWatchController.ts)
// station = time on the station pages (a part of the app, whether or not a video plays); other = app - chat - station
const METRICS: Record<Metric, { label: string; unit: 'seconds' | 'count' }> = {
  app: { label: 'زمان حضور در اپ', unit: 'seconds' },
  video: { label: 'زمان تماشای فیلم‌ها', unit: 'seconds' },
  chat: { label: 'زمان حضور در چت', unit: 'seconds' },
  station: { label: 'زمان حضور در منزلگاه‌ها', unit: 'seconds' },
  other: { label: 'زمان در بقیه بخش‌ها', unit: 'seconds' },
  opens: { label: 'دفعات باز کردن اپ', unit: 'count' },
  logins: { label: 'تعداد لاگین در اپ', unit: 'count' },
  active: { label: 'کاربران فعال', unit: 'count' },
  messages: { label: 'پیام‌های چت', unit: 'count' },
  challenges: { label: 'ارسال پاسخ چالش', unit: 'count' },
  quizzes: { label: 'آزمون‌های داده‌شده', unit: 'count' },
};

// ---- calendar -------------------------------------------------------------------------------
const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
const jFmt = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', { timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric' });
const jCache = new Map<string, { y: number; m: number; d: number }>();
const fa = (n: number) => n.toLocaleString('fa-IR', { useGrouping: false });

function jalali(day: string) {
  let hit = jCache.get(day);
  if (!hit) {
    const p: Record<string, string> = {};
    for (const part of jFmt.formatToParts(new Date(`${day}T12:00:00Z`))) p[part.type] = part.value;
    hit = { y: Number(p.year), m: Number(p.month), d: Number(p.day) };
    jCache.set(day, hit);
  }
  return hit;
}
function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const monthKey = (j: { y: number; m: number }) => `${j.y}-${String(j.m).padStart(2, '0')}`;
const monthLabel = (j: { y: number; m: number }) => `${MONTHS[j.m - 1]} ${fa(j.y)}`;

/** All Tehran days of a Jalali month. */
function daysOfMonth(y: number, m: number, today: string): string[] {
  const t = jalali(today);
  const diff = (t.y * 12 + t.m) - (y * 12 + m);
  let k = addDays(today, -Math.round(diff * 30.44));
  const cmp = (day: string) => { const j = jalali(day); return (j.y * 12 + j.m) - (y * 12 + m); };
  for (let i = 0; i < 40 && cmp(k) < 0; i++) k = addDays(k, 1);
  for (let i = 0; i < 40 && cmp(k) > 0; i++) k = addDays(k, -1);
  if (cmp(k) !== 0) return [];
  let start = k;
  while (cmp(addDays(start, -1)) === 0) start = addDays(start, -1);
  const out: string[] = [];
  for (let d = start; cmp(d) === 0; d = addDays(d, 1)) out.push(d);
  return out;
}

/** The Jalali months before the current one (newest first), for the «ماه‌های قبل» picker. */
function previousMonths(today: string, count = 12) {
  const out: { key: string; label: string }[] = [];
  let { y, m } = jalali(today);
  for (let i = 0; i < count; i++) {
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
    out.push({ key: `month:${monthKey({ y, m })}`, label: monthLabel({ y, m }) });
  }
  return out;
}

interface Span { kind: 'hours' | 'days' | 'months'; from: string; to: string; days: string[]; label: string }

function resolveRange(range: string, today: string, firstDay: () => Promise<string>): Promise<Span> | Span {
  if (range === 'today') return { kind: 'hours', from: today, to: today, days: [today], label: 'امروز' };
  if (range === 'week') {
    const offset = (new Date(`${today}T12:00:00Z`).getUTCDay() + 1) % 7; // days since Saturday
    const start = addDays(today, -offset);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    return { kind: 'days', from: days[0], to: days[6], days, label: 'هفته جاری' };
  }
  const mm = /^month:(\d{4})-(\d{2})$/.exec(range);
  if (range === 'month' || mm) {
    const j = mm ? { y: Number(mm[1]), m: Number(mm[2]) } : jalali(today);
    const days = daysOfMonth(j.y, j.m, today);
    if (!days.length) return { kind: 'days', from: today, to: today, days: [today], label: monthLabel(j) };
    return { kind: 'days', from: days[0], to: days[days.length - 1], days, label: range === 'month' ? 'ماه جاری' : monthLabel(j) };
  }
  // all: from the first recorded day, one bar per month
  return firstDay().then(first => {
    const from = first && first < today ? first : today;
    const days: string[] = [];
    for (let d = from; d <= today && days.length < 4000; d = addDays(d, 1)) days.push(d);
    return { kind: 'months' as const, from, to: today, days, label: 'تمام مدت' };
  });
}

// ---- data -----------------------------------------------------------------------------------
interface Scope { userIds: string[] | null; sessionIds: string[] | null; stationId?: string }

type SqlMetric = 'messages' | 'challenges' | 'quizzes' | 'logins';
const SQL_SOURCES: Record<SqlMetric, { table: string; at: string; user: string; where?: string }> = {
  messages: { table: '"ChatMessage"', at: '"createdAt"', user: '"senderId"' },
  challenges: { table: '"Submission"', at: '"submittedAt"', user: '"studentId"' },
  quizzes: { table: '"QuizSubmission"', at: '"submittedAt"', user: '"studentId"' },
  // successful sign-ins (authController); the admin panel's own sign-ins are tagged [پنل] and left out
  logins: { table: '"AuditLog"', at: '"createdAt"', user: '"actorId"', where: `"action" = 'USER_LOGIN' AND "details" NOT LIKE '%[پنل]%'` },
};
const isSql = (m: Metric): m is SqlMetric => m in SQL_SOURCES;
const sqlWhere = (src: { where?: string }) => (src.where ? Prisma.raw(`AND ${src.where}`) : Prisma.empty);
/** activity kinds kept in UserActivityHour, summed */
const HOUR_KINDS: Partial<Record<Metric, string>> = { app: 'app', opens: 'open', chat: 'chat' };
const isHourMetric = (m: Metric) => m === 'video' || m === 'station' || m in HOUR_KINDS;
/** UserActivityHour rows of a metric (video: class parts "video" + gallery "gvideo", only one station's when filtered) */
function hourWhere(metric: Metric, scope: Scope): any {
  const uf = userFilter(scope);
  if (metric === 'station') return { kind: 'area', refId: 'station', ...uf };
  if (metric === 'video') {
    if (!scope.stationId) return { kind: { in: ['video', 'gvideo'] }, ...uf };
    return { ...uf, OR: [{ kind: 'video', refId: { in: scope.sessionIds || [] } }, { kind: 'gvideo', refId: scope.stationId }] };
  }
  return { kind: metric === 'active' ? 'app' : HOUR_KINDS[metric]!, ...uf };
}
const sqlLocal = (at: string) => Prisma.raw(`((${at} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Tehran')`);

function userFilter(scope: Scope): any {
  return scope.userIds ? { userId: { in: scope.userIds } } : {};
}

/** value per Tehran day (from..to) */
async function daily(metric: Metric, from: string, to: string, scope: Scope): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (scope.userIds && scope.userIds.length === 0) return out;
  const dayRange = { gte: from, lte: to };
  if (metric === 'app' || metric === 'active') {
    const rows = await prisma.userUsageDay.groupBy({
      by: ['day'], where: { day: dayRange, ...userFilter(scope) }, _sum: { seconds: true }, _count: { _all: true },
    });
    rows.forEach(r => out.set(r.day, metric === 'app' ? r._sum.seconds || 0 : r._count._all));
    return out;
  }
  if (metric === 'other') {
    // time outside the chat and the station pages
    const [app, chat, station] = await Promise.all([daily('app', from, to, scope), daily('chat', from, to, scope), daily('station', from, to, scope)]);
    app.forEach((v, d) => out.set(d, Math.max(0, v - (chat.get(d) || 0) - (station.get(d) || 0))));
    return out;
  }
  if (isHourMetric(metric)) {
    const rows = await prisma.userActivityHour.groupBy({ by: ['day'], where: { day: dayRange, ...hourWhere(metric, scope) }, _sum: { value: true } });
    rows.forEach(r => out.set(r.day, r._sum.value || 0));
    return out;
  }
  if (!isSql(metric)) return out;
  const src = SQL_SOURCES[metric];
  const local = sqlLocal(src.at);
  const users = scope.userIds ? Prisma.sql`AND ${Prisma.raw(src.user)} IN (${Prisma.join(scope.userIds)})` : Prisma.empty;
  const rows = await prisma.$queryRaw<{ day: string; n: bigint }[]>`
    SELECT to_char(${local}, 'YYYY-MM-DD') AS day, COUNT(*)::bigint AS n
    FROM ${Prisma.raw(src.table)}
    WHERE ${Prisma.raw(src.user)} IS NOT NULL ${users} ${sqlWhere(src)}
      AND to_char(${local}, 'YYYY-MM-DD') BETWEEN ${from} AND ${to}
    GROUP BY 1`;
  rows.forEach(r => out.set(r.day, Number(r.n)));
  return out;
}

/** value per hour (0..23) of one Tehran day */
async function hourly(metric: Metric, day: string, scope: Scope): Promise<number[]> {
  const out = new Array(24).fill(0);
  if (scope.userIds && scope.userIds.length === 0) return out;
  if (metric === 'other') {
    const [app, chat, station] = await Promise.all([hourly('app', day, scope), hourly('chat', day, scope), hourly('station', day, scope)]);
    return app.map((v, h) => Math.max(0, v - chat[h] - station[h]));
  }
  if (metric === 'active' || isHourMetric(metric)) {
    const where: any = { day, ...hourWhere(metric, scope) };
    if (metric === 'active') {
      const rows = await prisma.userActivityHour.groupBy({ by: ['hour', 'userId'], where });
      rows.forEach(r => { out[r.hour] += 1; });
    } else {
      const rows = await prisma.userActivityHour.groupBy({ by: ['hour'], where, _sum: { value: true } });
      rows.forEach(r => { out[r.hour] = r._sum.value || 0; });
    }
    return out;
  }
  if (!isSql(metric)) return out;
  const src = SQL_SOURCES[metric];
  const local = sqlLocal(src.at);
  const users = scope.userIds ? Prisma.sql`AND ${Prisma.raw(src.user)} IN (${Prisma.join(scope.userIds)})` : Prisma.empty;
  const rows = await prisma.$queryRaw<{ h: number; n: bigint }[]>`
    SELECT EXTRACT(HOUR FROM ${local})::int AS h, COUNT(*)::bigint AS n
    FROM ${Prisma.raw(src.table)}
    WHERE ${Prisma.raw(src.user)} IS NOT NULL ${users} ${sqlWhere(src)}
      AND to_char(${local}, 'YYYY-MM-DD') = ${day}
    GROUP BY 1`;
  rows.forEach(r => { out[Number(r.h)] = Number(r.n); });
  return out;
}

async function firstDayOf(metric: Metric, scope: Scope): Promise<string> {
  const where = userFilter(scope);
  if (metric === 'app' || metric === 'active' || metric === 'other') {
    return (await prisma.userUsageDay.findFirst({ where, orderBy: { day: 'asc' }, select: { day: true } }))?.day || '';
  }
  if (isHourMetric(metric)) {
    return (await prisma.userActivityHour.findFirst({ where: hourWhere(metric, scope), orderBy: { day: 'asc' }, select: { day: true } }))?.day || '';
  }
  if (!isSql(metric)) return '';
  const src = SQL_SOURCES[metric];
  const users = scope.userIds ? (scope.userIds.length ? Prisma.sql`AND ${Prisma.raw(src.user)} IN (${Prisma.join(scope.userIds)})` : Prisma.sql`AND FALSE`) : Prisma.empty;
  const rows = await prisma.$queryRaw<{ day: string | null }[]>`
    SELECT to_char(MIN(${sqlLocal(src.at)}), 'YYYY-MM-DD') AS day FROM ${Prisma.raw(src.table)} WHERE ${Prisma.raw(src.user)} IS NOT NULL ${users} ${sqlWhere(src)}`;
  return rows[0]?.day || '';
}

/** The people a request is about: one person, a caravan's members, a role; null = everyone. */
async function resolveScope(q: any): Promise<Scope> {
  const where: any = { isDeleted: false };
  let filtered = false;
  if (typeof q.userId === 'string' && q.userId) { where.id = q.userId; filtered = true; }
  if (typeof q.caravanId === 'string' && q.caravanId) { where.caravanId = q.caravanId; filtered = true; }
  if (typeof q.role === 'string' && q.role) {
    where.role = q.role === 'mentor' ? { in: ['mentor', 'SUPER_MENTOR'] } : q.role;
    filtered = true;
  }
  const userIds = filtered ? (await prisma.user.findMany({ where, select: { id: true } })).map(u => u.id) : null;
  let sessionIds: string[] | null = null;
  let stationId: string | undefined;
  if (typeof q.stationId === 'string' && q.stationId) {
    stationId = q.stationId;
    sessionIds = (await prisma.classSession.findMany({ where: { category: { stationId: q.stationId } }, select: { id: true } })).map(s => s.id);
  }
  return { userIds, sessionIds, stationId };
}

function parseMetric(v: unknown): Metric {
  return (typeof v === 'string' && v in METRICS ? v : 'app') as Metric;
}

// ---- series ---------------------------------------------------------------------------------
export async function getStatsSeries(req: AuthRequest, res: Response) {
  try {
    const metric = parseMetric(req.query.metric);
    const range = String(req.query.range || 'week');
    const scope = await resolveScope(req.query);
    const today = tehranSlot().day;
    const span = await resolveRange(range, today, () => firstDayOf(metric, scope));

    let buckets: { key: string; label: string; value: number; future?: boolean; current?: boolean }[] = [];
    if (span.kind === 'hours') {
      const values = await hourly(metric, today, scope);
      const nowHour = tehranSlot().hour;
      buckets = values.map((value, h) => ({ key: String(h), label: fa(h), value, future: h > nowHour, current: h === nowHour }));
    } else {
      const values = await daily(metric, span.from, span.to, scope);
      if (span.kind === 'days') {
        buckets = span.days.map(day => {
          const j = jalali(day);
          const label = range === 'week' ? WEEKDAYS[(new Date(`${day}T12:00:00Z`).getUTCDay() + 1) % 7] : fa(j.d);
          return { key: day, label, value: values.get(day) || 0, future: day > today, current: day === today };
        });
      } else {
        const byMonth = new Map<string, { label: string; value: number }>();
        for (const day of span.days) {
          const j = jalali(day);
          const k = monthKey(j);
          const row = byMonth.get(k) || { label: monthLabel(j), value: 0 };
          if (metric === 'active') row.value = Math.max(row.value, values.get(day) || 0); // busiest day of the month
          else row.value += values.get(day) || 0;
          byMonth.set(k, row);
        }
        const nowKey = monthKey(jalali(today));
        buckets = Array.from(byMonth, ([key, r]) => ({ key, label: r.label, value: r.value, current: key === nowKey }));
      }
    }
    const values = buckets.filter(b => !b.future).map(b => b.value);
    const total = metric === 'active'
      ? await activeUsersIn(span.from, span.to, scope)
      : values.reduce((s, v) => s + v, 0);
    res.json({
      metric, metricLabel: METRICS[metric].label, unit: METRICS[metric].unit,
      range, rangeLabel: span.label, bucketKind: span.kind,
      buckets, total,
      average: values.length ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : 0,
      peak: buckets.reduce((best, b) => (b.value > (best?.value ?? 0) ? b : best), null as any),
      months: previousMonths(today),
      metrics: Object.entries(METRICS).map(([key, m]) => ({ key, label: m.label, unit: m.unit })),
    });
  } catch (error: any) {
    console.error('stats series failed:', error);
    res.status(500).json({ error: error.message });
  }
}

async function activeUsersIn(from: string, to: string, scope: Scope): Promise<number> {
  if (scope.userIds && !scope.userIds.length) return 0;
  const rows = await prisma.userUsageDay.groupBy({ by: ['userId'], where: { day: { gte: from, lte: to }, ...userFilter(scope) } });
  return rows.length;
}

/** rows of a SQL source per person in from..to */
async function countByUser(metric: SqlMetric, from: string, to: string, scope: Scope): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (scope.userIds && !scope.userIds.length) return out;
  const src = SQL_SOURCES[metric];
  const local = sqlLocal(src.at);
  const users = scope.userIds ? Prisma.sql`AND ${Prisma.raw(src.user)} IN (${Prisma.join(scope.userIds)})` : Prisma.empty;
  const rows = await prisma.$queryRaw<{ u: string; n: bigint }[]>`
    SELECT ${Prisma.raw(src.user)} AS u, COUNT(*)::bigint AS n
    FROM ${Prisma.raw(src.table)}
    WHERE ${Prisma.raw(src.user)} IS NOT NULL ${users} ${sqlWhere(src)}
      AND to_char(${local}, 'YYYY-MM-DD') BETWEEN ${from} AND ${to}
    GROUP BY 1`;
  rows.forEach(r => out.set(r.u, Number(r.n)));
  return out;
}

// ---- overview -------------------------------------------------------------------------------
export async function getStatsOverview(req: AuthRequest, res: Response) {
  try {
    const range = String(req.query.range || 'week');
    const scope = await resolveScope({ caravanId: req.query.caravanId, role: req.query.role });
    const today = tehranSlot().day;
    const span = await resolveRange(range, today, () => firstDayOf('app', scope));
    const from = span.from;
    const to = span.to;
    const all = range === 'all';
    const none = !!scope.userIds && scope.userIds.length === 0;
    const uf = userFilter(scope);
    const dayRange = { gte: from, lte: to };
    const empty = <T>(v: T) => Promise.resolve(v);

    const [appByUser, videoByUser, opensByUser, videoBySession, appByHour, messages, challenges, quizzes, watchAll] = await Promise.all([
      none ? empty([] as any[]) : prisma.userUsageDay.groupBy({ by: ['userId'], where: { day: dayRange, ...uf }, _sum: { seconds: true } }),
      none ? empty([] as any[]) : prisma.userActivityHour.groupBy({ by: ['userId'], where: { day: dayRange, kind: { in: ['video', 'gvideo'] }, ...uf }, _sum: { value: true } }),
      none ? empty([] as any[]) : prisma.userActivityHour.groupBy({ by: ['userId'], where: { day: dayRange, kind: 'open', ...uf }, _sum: { value: true } }),
      none ? empty([] as any[]) : prisma.userActivityHour.groupBy({ by: ['refId', 'userId'], where: { day: dayRange, kind: 'video', ...uf }, _sum: { value: true } }),
      none ? empty([] as any[]) : prisma.userActivityHour.groupBy({ by: ['hour'], where: { day: dayRange, kind: 'app', ...uf }, _sum: { value: true } }),
      daily('messages', from, to, scope),
      daily('challenges', from, to, scope),
      daily('quizzes', from, to, scope),
      // before hourly video tracking existed only the per-class totals were kept: "all time" uses them
      all && !none ? prisma.sessionWatchRecord.groupBy({ by: ['sessionId', 'userId'], where: { watchedSeconds: { gt: 0 }, ...uf }, _sum: { watchedSeconds: true } }) : empty([] as any[]),
    ]);
    const sumMap = (m: Map<string, number>) => Array.from(m.values()).reduce((s, v) => s + v, 0);
    const [chatByUser, stationByUser, areaRows, galleryRows, hourUserRows, logins, messagesByUser] = await Promise.all([
      none ? empty([] as any[]) : prisma.userActivityHour.groupBy({ by: ['userId'], where: { day: dayRange, kind: 'chat', ...uf }, _sum: { value: true } }),
      none ? empty([] as any[]) : prisma.userActivityHour.groupBy({ by: ['userId'], where: { day: dayRange, kind: 'area', refId: 'station', ...uf }, _sum: { value: true } }),
      // time in each part of the app (home, academy, market ...), from app versions that report it
      none ? empty([] as any[]) : prisma.userActivityHour.groupBy({ by: ['refId'], where: { day: dayRange, kind: 'area', ...uf }, _sum: { value: true } }),
      // gallery videos per station and person
      none ? empty([] as any[]) : prisma.userActivityHour.groupBy({ by: ['refId', 'userId'], where: { day: dayRange, kind: 'gvideo', ...uf }, _sum: { value: true } }),
      none ? empty([] as any[]) : prisma.userActivityHour.groupBy({ by: ['hour', 'userId'], where: { day: dayRange, kind: 'app', ...uf } }),
      countByUser('logins', from, to, scope),
      countByUser('messages', from, to, scope),
    ]);
    const chat = new Map<string, number>(chatByUser.map((r: any) => [r.userId, r._sum.value || 0]));
    const stationTime = new Map<string, number>(stationByUser.map((r: any) => [r.userId, r._sum.value || 0]));
    const areaTotals: Record<string, number> = {};
    areaRows.forEach((r: any) => { areaTotals[r.refId] = r._sum.value || 0; });

    // per class / per person video: hourly tracking, or for "all" whichever is larger per class+person
    const watch = new Map<string, number>(); // `${sessionId}|${userId}` -> seconds
    videoBySession.forEach((r: any) => watch.set(`${r.refId}|${r.userId}`, r._sum.value || 0));
    watchAll.forEach((r: any) => {
      const k = `${r.sessionId}|${r.userId}`;
      watch.set(k, Math.max(watch.get(k) || 0, r._sum.watchedSeconds || 0));
    });
    const videoUser = new Map<string, number>();
    const videoSession = new Map<string, { seconds: number; viewers: Set<string> }>();
    watch.forEach((sec, k) => {
      const [sid, uid] = k.split('|');
      videoUser.set(uid, (videoUser.get(uid) || 0) + sec);
      const row = videoSession.get(sid) || { seconds: 0, viewers: new Set<string>() };
      row.seconds += sec;
      if (sec > 0) row.viewers.add(uid);
      videoSession.set(sid, row);
    });
    if (!all) videoByUser.forEach((r: any) => videoUser.set(r.userId, r._sum.value || 0));

    const app = new Map<string, number>(appByUser.map((r: any) => [r.userId, r._sum.seconds || 0]));
    const opens = new Map<string, number>(opensByUser.map((r: any) => [r.userId, r._sum.value || 0]));
    // time outside the chat and the station pages, per person (watching a video is counted on its own: «video»)
    const other = new Map<string, number>();
    app.forEach((a, id) => other.set(id, Math.max(0, a - (chat.get(id) || 0) - (stationTime.get(id) || 0))));

    // who is in the app right now (heartbeats of the app, services/liveActivity.ts)
    const scopeSet = scope.userIds ? new Set(scope.userIds) : null;
    const liveNow = liveInApp(scopeSet);
    const events = recentLiveEvents(80, scopeSet);

    const ids = Array.from(new Set([...app.keys(), ...videoUser.keys(), ...stationTime.keys(), ...opens.keys(), ...logins.keys(), ...messagesByUser.keys()]));
    const extraIds = Array.from(new Set([...liveNow.map(l => l.userId), ...events.map(e => e.userId)])).filter(id => !ids.includes(id));
    const people = ids.length
      ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, avatarUrl: true, siteAvatarUrl: true, role: true, caravanId: true, gender: true } })
      : [];
    const byId = new Map(people.map(p => [p.id, p]));
    if (extraIds.length) {
      (await prisma.user.findMany({ where: { id: { in: extraIds } }, select: { id: true, name: true, avatarUrl: true, siteAvatarUrl: true, role: true, caravanId: true, gender: true } }))
        .forEach(p => byId.set(p.id, p));
    }
    const brief = (id: string) => {
      const p = byId.get(id);
      return { id, name: p?.name || 'کاربر', avatarUrl: p?.avatarUrl || null, role: p?.role || '' };
    };

    // caravans
    const caravanRows = await prisma.caravan.findMany({
      where: { isDeleted: false, ...(typeof req.query.caravanId === 'string' && req.query.caravanId ? { id: req.query.caravanId } : {}) },
      select: { id: true, name: true, coverImageUrl: true, status: true, _count: { select: { members: true } } },
    });
    const caravans = caravanRows.map(c => {
      let appSeconds = 0, videoSeconds = 0, active = 0, opensCount = 0;
      people.forEach(p => {
        if (p.caravanId !== c.id) return;
        const a = app.get(p.id) || 0;
        appSeconds += a;
        videoSeconds += videoUser.get(p.id) || 0;
        opensCount += opens.get(p.id) || 0;
        if (a > 0) active++;
      });
      return { id: c.id, name: c.name, coverImageUrl: c.coverImageUrl, status: c.status, members: c._count.members, activeMembers: active, appSeconds, videoSeconds, opens: opensCount };
    }).sort((a, b) => b.appSeconds - a.appSeconds || b.videoSeconds - a.videoSeconds);

    // stations and classes
    const sessionIds = Array.from(videoSession.keys());
    const sessions = sessionIds.length
      ? await prisma.classSession.findMany({ where: { id: { in: sessionIds } }, select: { id: true, title: true, category: { select: { title: true, station: { select: { id: true, title: true } } } } } })
      : [];
    const stationMap = new Map<string, { id: string; title: string; videoSeconds: number; viewers: Set<string>; classes: number; gallerySeconds?: number }>();
    const classes = sessions.map(s => {
      const v = videoSession.get(s.id)!;
      const st = s.category?.station;
      if (st) {
        const row = stationMap.get(st.id) || { id: st.id, title: st.title, videoSeconds: 0, viewers: new Set<string>(), classes: 0 };
        row.videoSeconds += v.seconds;
        row.classes += 1;
        v.viewers.forEach(u => row.viewers.add(u));
        stationMap.set(st.id, row);
      }
      return { id: s.id, title: s.title, station: st?.title || '', category: s.category?.title || '', videoSeconds: v.seconds, viewers: v.viewers.size };
    }).sort((a, b) => b.videoSeconds - a.videoSeconds).slice(0, 15);
    // the gallery (نگارستان) videos of each station
    const galleryStationIds = Array.from(new Set(galleryRows.map((r: any) => r.refId as string).filter(Boolean)));
    const galleryStations = galleryStationIds.length
      ? await prisma.station.findMany({ where: { id: { in: galleryStationIds } }, select: { id: true, title: true } })
      : [];
    galleryRows.forEach((r: any) => {
      const st = galleryStations.find(x => x.id === r.refId);
      if (!st) return;
      const row = stationMap.get(st.id) || { id: st.id, title: st.title, videoSeconds: 0, viewers: new Set<string>(), classes: 0, gallerySeconds: 0 };
      const sec = r._sum.value || 0;
      row.videoSeconds += sec;
      row.gallerySeconds = (row.gallerySeconds || 0) + sec;
      if (sec > 0) row.viewers.add(r.userId);
      stationMap.set(st.id, row);
    });
    const stations = Array.from(stationMap.values())
      .map(s => ({ id: s.id, title: s.title, videoSeconds: s.videoSeconds, gallerySeconds: s.gallerySeconds || 0, viewers: s.viewers.size, classes: s.classes }))
      .sort((a, b) => b.videoSeconds - a.videoSeconds);

    // roles
    const ROLE_LABELS: Record<string, string> = { student: 'دانش‌آموز', mentor: 'راهبر', SUPER_MENTOR: 'راهبر ارشد', admin: 'مدیر', sub_admin: 'مدیر بخش', channel_manager: 'مدیر کانال' };
    const roleMap = new Map<string, { role: string; label: string; people: number; appSeconds: number; videoSeconds: number }>();
    people.forEach(p => {
      const row = roleMap.get(p.role) || { role: p.role, label: ROLE_LABELS[p.role] || p.role, people: 0, appSeconds: 0, videoSeconds: 0 };
      const a = app.get(p.id) || 0;
      if (a > 0) row.people++;
      row.appSeconds += a;
      row.videoSeconds += videoUser.get(p.id) || 0;
      roleMap.set(p.role, row);
    });

    const topUsers = ids
      .map(id => {
        const p = byId.get(id);
        return p && {
          id, name: p.name, avatarUrl: p.avatarUrl, siteAvatarUrl: p.siteAvatarUrl, role: p.role, gender: p.gender,
          caravanName: caravanRows.find(c => c.id === p.caravanId)?.name || null,
          appSeconds: app.get(id) || 0, videoSeconds: videoUser.get(id) || 0, opens: opens.get(id) || 0,
          chatSeconds: chat.get(id) || 0, stationSeconds: stationTime.get(id) || 0, otherSeconds: other.get(id) || 0,
          logins: logins.get(id) || 0, messages: messagesByUser.get(id) || 0,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.appSeconds - a.appSeconds || b.videoSeconds - a.videoSeconds)
      .slice(0, 50);

    const hours = new Array(24).fill(0);
    appByHour.forEach((r: any) => { hours[r.hour] = r._sum.value || 0; });
    const hourUsers = new Array(24).fill(0); // different people in the app in each hour of the day
    hourUserRows.forEach((r: any) => { hourUsers[r.hour] += 1; });
    // the three busiest hours of the day (time in the app, then people)
    const peakHours = hours
      .map((seconds, hour) => ({ hour, seconds, users: hourUsers[hour] }))
      .filter(h => h.seconds > 0 || h.users > 0)
      .sort((a, b) => b.seconds - a.seconds || b.users - a.users)
      .slice(0, 3);

    // choices of the «آمار» tab's filters
    const [caravanOptions, stationOptions] = await Promise.all([
      prisma.caravan.findMany({ where: { isDeleted: false }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      prisma.station.findMany({ select: { id: true, title: true }, orderBy: { orderIndex: 'asc' } }),
    ]);

    const now = Date.now();
    const online = liveNow
      .map(l => ({ ...brief(l.userId), area: l.area, playing: l.playing, areaSeconds: Math.round((now - l.areaSince) / 1000), sessionSeconds: Math.round((now - l.since) / 1000) }))
      .sort((a, b) => b.sessionSeconds - a.sessionSeconds);
    // chat / station pages / the rest of the app, and how many are watching a video right now
    const onlineAreas = { chat: 0, station: 0, other: 0, video: 0 } as Record<string, number>;
    online.forEach(o => {
      const k = o.area === 'chat' || o.area === 'station' ? o.area : 'other';
      onlineAreas[k] += 1;
      if (o.playing) onlineAreas.video += 1;
    });

    res.json({
      range, rangeLabel: span.label, from, to,
      months: previousMonths(today),
      totals: {
        appSeconds: Array.from(app.values()).reduce((s, v) => s + v, 0),
        videoSeconds: Array.from(videoUser.values()).reduce((s, v) => s + v, 0),
        opens: Array.from(opens.values()).reduce((s, v) => s + v, 0),
        chatSeconds: sumMap(chat),
        stationSeconds: sumMap(stationTime),
        otherSeconds: sumMap(other),
        logins: sumMap(logins),
        activeUsers: Array.from(app.values()).filter(v => v > 0).length,
        messages: sumMap(messages), challenges: sumMap(challenges), quizzes: sumMap(quizzes),
        onlineNow: online.length,
        people: scope.userIds ? scope.userIds.length : await prisma.user.count({ where: { isDeleted: false } }),
      },
      topUsers, caravans, stations, classes,
      roles: Array.from(roleMap.values()).sort((a, b) => b.appSeconds - a.appSeconds),
      hours, hourUsers, peakHours, areaTotals,
      online: online.slice(0, 100), onlineAreas,
      events: events.map(e => ({ at: new Date(e.at).toISOString(), type: e.type, user: brief(e.userId) })),
      serverTime: new Date(now).toISOString(),
      options: { caravans: caravanOptions, stations: stationOptions },
    });
  } catch (error: any) {
    console.error('stats overview failed:', error);
    res.status(500).json({ error: error.message });
  }
}

export const __statsCalendarForTests = { jalali, daysOfMonth, previousMonths, resolveRange, addDays };

// ---- one person's activity log --------------------------------------------------------------
// GET /admin/analytics/stats/user-log ?userId[&before=ISO][&limit=60][&group=all|areas|videos|actions]
//   items   what the person did in the app, newest first (UserActivityLog; services/userLog.ts)
//   videos  every station video they played: times started, time played (repeats included) and how much of it
//           was really watched (only on the first page)
const LOG_GROUPS: Record<string, string[] | null> = {
  all: null,
  areas: ['enter', 'open', 'away', 'login', 'logout'],
  videos: ['video'],
  actions: ['avatar', 'profile', 'password', 'challenge', 'quiz', 'ticket', 'exchange', 'rate', 'message'],
};
export async function getUserActivityLog(req: AuthRequest, res: Response) {
  try {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : '';
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const limit = Math.max(10, Math.min(200, Number(req.query.limit) || 60));
    const before = typeof req.query.before === 'string' && !isNaN(Date.parse(req.query.before)) ? new Date(req.query.before) : null;
    const group = typeof req.query.group === 'string' && req.query.group in LOG_GROUPS ? req.query.group : 'all';
    const types = LOG_GROUPS[group];
    const rows = await prisma.userActivityLog.findMany({
      where: { userId, ...(before ? { createdAt: { lt: before } } : {}), ...(types ? { type: { in: types } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      select: { id: true, type: true, area: true, refId: true, label: true, seconds: true, createdAt: true },
    });
    const more = rows.length > limit;
    const items = rows.slice(0, limit).map(r => ({ ...r, at: r.createdAt.toISOString() }));
    let videos: any[] | undefined;
    if (!before) {
      const watches = await prisma.videoWatch.findMany({
        where: { userId }, orderBy: { lastWatchedAt: 'desc' }, take: 100,
        select: { clipId: true, kind: true, stationId: true, title: true, durationSeconds: true, coveredSeconds: true, playSeconds: true, plays: true, lastWatchedAt: true },
      });
      const stIds = Array.from(new Set(watches.map(w => w.stationId).filter(Boolean)));
      const sts = stIds.length ? await prisma.station.findMany({ where: { id: { in: stIds } }, select: { id: true, title: true } }) : [];
      videos = watches.map(w => ({
        ...w, lastWatchedAt: w.lastWatchedAt.toISOString(),
        station: sts.find(s => s.id === w.stationId)?.title || '',
        percent: w.durationSeconds > 0 ? Math.min(100, Math.round((w.coveredSeconds / w.durationSeconds) * 100)) : 0,
      }));
    }
    res.json({ items, more, next: more ? items[items.length - 1].at : null, videos });
  } catch (error: any) {
    console.error('user activity log failed:', error);
    res.status(500).json({ error: error.message });
  }
}
