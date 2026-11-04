// Who is in the mobile app right now, and what they are doing (kept in memory; rebuilt by the app's heartbeats
// within a few seconds after a restart). The app sends POST /usage/ping every ~15 s while in the foreground with
// the part of the app it is in ("chat" | "video" | "other") and "away" when it goes to the background.
// Old app versions send no area and report about once a minute.
//
// Also keeps a short in-memory log of what people did in the app (opened it, signed in, went to the chat, started
// a video, left) for the «آمار» tab's live log; persistent numbers are in UserActivityHour / AuditLog.

export type AppArea = 'chat' | 'video' | 'other' | 'away';

interface Live {
  lastSeen: number;
  area: AppArea;
  areaSince: number;
  since: number;      // start of the current stay in the app
  legacy: boolean;    // an old app version (no area, pings once a minute)
}

const ONLINE_MS = 40 * 1000;
const LEGACY_ONLINE_MS = 100 * 1000;
const live = new Map<string, Live>();

export type LiveEventType = 'open' | 'login' | 'logout' | 'away' | 'chat' | 'video' | 'other';
export interface LiveEvent { at: number; userId: string; type: LiveEventType }
const MAX_EVENTS = 400;
const events: LiveEvent[] = [];

export function logLiveEvent(userId: string, type: LiveEventType): void {
  if (!userId) return;
  events.push({ at: Date.now(), userId, type });
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
}

function isLive(l: Live, now: number): boolean {
  return l.area !== 'away' && now - l.lastSeen < (l.legacy ? LEGACY_ONLINE_MS : ONLINE_MS);
}

/** A heartbeat from the app. `area` undefined = an old app version. */
export function touchApp(userId: string, area: AppArea | undefined): void {
  const now = Date.now();
  const prev = live.get(userId);
  const wasLive = !!prev && isLive(prev, now);
  const a: AppArea = area || 'other';
  if (!prev || !wasLive) {
    live.set(userId, { lastSeen: now, area: a, areaSince: now, since: now, legacy: !area });
    if (a !== 'away' && a !== 'other') logLiveEvent(userId, a);
    return;
  }
  prev.lastSeen = now;
  prev.legacy = !area;
  if (prev.area !== a) {
    prev.area = a;
    prev.areaSince = now;
    logLiveEvent(userId, a);
  }
}

export function markAppAway(userId: string): void {
  const l = live.get(userId);
  if (l && isLive(l, Date.now())) logLiveEvent(userId, 'away');
  live.delete(userId);
}

export interface LivePerson { userId: string; area: AppArea; areaSince: number; since: number; lastSeen: number }

/** Everyone in the app right now (optionally only these people). */
export function liveInApp(only?: Set<string> | null): LivePerson[] {
  const now = Date.now();
  const out: LivePerson[] = [];
  for (const [userId, l] of live) {
    if (!isLive(l, now)) {
      if (now - l.lastSeen > 10 * 60 * 1000) live.delete(userId);
      continue;
    }
    if (only && !only.has(userId)) continue;
    out.push({ userId, area: l.area, areaSince: l.areaSince, since: l.since, lastSeen: l.lastSeen });
  }
  return out;
}

export function isInApp(userId: string): boolean {
  const l = live.get(userId);
  return !!l && isLive(l, Date.now());
}

export function recentLiveEvents(limit = 60, only?: Set<string> | null): LiveEvent[] {
  const out: LiveEvent[] = [];
  for (let i = events.length - 1; i >= 0 && out.length < limit; i--) {
    if (!only || only.has(events[i].userId)) out.push(events[i]);
  }
  return out;
}

/** Was this request sent by the mobile app (not the admin panel / site in a browser)? */
export function isAppClient(headers: Record<string, any>): boolean {
  const c = String(headers['x-nopa-client'] || '').toLowerCase();
  if (c) return c === 'app';
  return /^Dart\//.test(String(headers['user-agent'] || ''));
}
