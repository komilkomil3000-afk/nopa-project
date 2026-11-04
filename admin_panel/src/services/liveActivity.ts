// Who is in the mobile app right now, and what they are doing (kept in memory; rebuilt by the app's heartbeats
// within a few seconds after a restart). The app sends POST /usage/ping every ~15 s while in the foreground with
// the part of the app it is in (services/userLog.ts APP_AREAS: home | academy | station | challenges | market |
// profile | chat | other), whether a video is playing, and "away" when it goes to the background.
// Old app versions send chat | video | other, or no area at all and report about once a minute.
//
// Also keeps a short in-memory log of what people did in the app (opened it, signed in, went to a part of the app,
// started a video, left) for the «آمار» tab's live log; the persistent per-person log is UserActivityLog.

import { AppSection, isAppSection } from './userLog';

export type AppArea = AppSection | 'away';

interface Live {
  lastSeen: number;
  area: AppSection;
  areaSince: number;
  since: number;      // start of the current stay in the app
  playing: boolean;   // a video is playing
  legacy: boolean;    // an old app version (no area, pings once a minute)
}

const ONLINE_MS = 40 * 1000;
const LEGACY_ONLINE_MS = 100 * 1000;
const live = new Map<string, Live>();

export type LiveEventType = 'open' | 'login' | 'logout' | 'away' | 'video' | AppSection;
export interface LiveEvent { at: number; userId: string; type: LiveEventType }
const MAX_EVENTS = 400;
const events: LiveEvent[] = [];

export function logLiveEvent(userId: string, type: LiveEventType): void {
  if (!userId) return;
  events.push({ at: Date.now(), userId, type });
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
}

function isLive(l: Live, now: number): boolean {
  return now - l.lastSeen < (l.legacy ? LEGACY_ONLINE_MS : ONLINE_MS);
}

/** The area sent by the app -> part of the app + video playing (old versions sent "video" for any playing video). */
export function parseArea(raw: unknown, playing: unknown): { area: AppArea | undefined; playing: boolean } {
  if (raw === 'away') return { area: 'away', playing: false };
  if (raw === 'video') return { area: 'other', playing: true };
  return { area: isAppSection(raw) ? raw : undefined, playing: playing === true };
}

/** A heartbeat from the app. `area` undefined = an old app version. */
export function touchApp(userId: string, area: AppSection | undefined, playing = false): void {
  const now = Date.now();
  const prev = live.get(userId);
  const wasLive = !!prev && isLive(prev, now);
  const a: AppSection = area || 'other';
  if (!prev || !wasLive) {
    live.set(userId, { lastSeen: now, area: a, areaSince: now, since: now, playing, legacy: !area });
    if (area) logLiveEvent(userId, a);
    if (playing) logLiveEvent(userId, 'video');
    return;
  }
  prev.lastSeen = now;
  prev.legacy = !area;
  if (prev.area !== a) {
    prev.area = a;
    prev.areaSince = now;
    logLiveEvent(userId, a);
  }
  if (playing && !prev.playing) logLiveEvent(userId, 'video');
  prev.playing = playing;
}

export function markAppAway(userId: string): void {
  const l = live.get(userId);
  if (l && isLive(l, Date.now())) logLiveEvent(userId, 'away');
  live.delete(userId);
}

export interface LivePerson { userId: string; area: AppSection; playing: boolean; areaSince: number; since: number; lastSeen: number }

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
    out.push({ userId, area: l.area, playing: l.playing, areaSince: l.areaSince, since: l.since, lastSeen: l.lastSeen });
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
