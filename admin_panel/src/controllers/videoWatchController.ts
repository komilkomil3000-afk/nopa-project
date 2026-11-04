import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { addActivity } from '../services/activity';
import { logUserEvent } from '../services/userLog';

// Watching of station videos, reported by the app's player (widgets/nopa_inline_video_player.dart):
//   POST /usage/video        { clipId, kind: session|gallery, stationId, sessionId, trackType, title, duration,
//                              playSeconds, segments: [[start, end], ...], started, final, viewSeconds }
//   GET  /usage/video/:clipId -> what was really watched so far (the app merges it with what it plays now)
// segments are the second ranges really played (a seek starts a new range), so jumping ahead or watching the first
// 30 % three times never adds up to 90 %: the part quiz opens only when the union covers 90 % of the video.
// playSeconds is all the time it played, repeats included; it feeds the «زمان تماشای فیلم‌ها» chart:
//   UserActivityHour kind "video"  (refId = ClassSession) for class parts, kind "gvideo" (refId = Station) for the gallery.

export const QUIZ_UNLOCK_FRACTION = 0.9;
const MAX_DURATION = 6 * 3600;
type Seg = [number, number];

/** Sorted, merged ranges (gaps of up to a second are closed). */
export function mergeSegments(list: Seg[]): Seg[] {
  const sorted = list.filter(s => s[1] > s[0]).sort((a, b) => a[0] - b[0]);
  const out: Seg[] = [];
  for (const [s, e] of sorted) {
    const last = out[out.length - 1];
    if (last && s <= last[1] + 1) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}
const coverOf = (segs: Seg[]) => segs.reduce((sum, [s, e]) => sum + (e - s), 0);

function parseSegments(raw: unknown, duration: number): Seg[] {
  if (!Array.isArray(raw)) return [];
  const out: Seg[] = [];
  for (const r of raw.slice(0, 300)) {
    if (!Array.isArray(r) || r.length < 2) continue;
    const s = Math.max(0, Math.min(duration, Math.floor(Number(r[0]))));
    const e = Math.max(0, Math.min(duration, Math.ceil(Number(r[1]))));
    if (Number.isFinite(s) && Number.isFinite(e) && e > s) out.push([s, e]);
  }
  return out;
}

function storedSegments(v: unknown): Seg[] {
  return Array.isArray(v) ? (v as any[]).filter(x => Array.isArray(x) && x.length >= 2).map(x => [Number(x[0]) || 0, Number(x[1]) || 0] as Seg) : [];
}

const faNum = (n: number) => n.toLocaleString('fa-IR', { useGrouping: false });

export async function reportVideoWatch(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const b = req.body || {};
    const clipId = typeof b.clipId === 'string' ? b.clipId.slice(0, 64) : '';
    const kind = b.kind === 'gallery' ? 'gallery' : b.kind === 'session' ? 'session' : '';
    if (!clipId || !kind) return res.status(400).json({ error: 'clipId and kind are required' });
    const duration = Math.max(0, Math.min(MAX_DURATION, Math.round(Number(b.duration) || 0)));
    const stationId = typeof b.stationId === 'string' ? b.stationId.slice(0, 64) : '';
    const sessionId = typeof b.sessionId === 'string' ? b.sessionId.slice(0, 64) : '';
    const title = typeof b.title === 'string' ? b.title.slice(0, 160) : '';
    const now = new Date();

    const prev = await prisma.videoWatch.findUnique({ where: { userId_clipId: { userId, clipId } } });
    // playing time since the last report: at most the wall-clock time since then (+ slack), and 10 minutes per report
    const sinceLast = prev ? Math.max(0, (now.getTime() - prev.lastWatchedAt.getTime()) / 1000) : 600;
    const play = Math.max(0, Math.min(600, Math.round(Number(b.playSeconds) || 0), Math.round(sinceLast + 30)));

    const dur = duration || prev?.durationSeconds || 0;
    const oldSegs = storedSegments(prev?.segments);
    let segs = oldSegs;
    if (dur > 0) {
      const merged = mergeSegments([...oldSegs, ...parseSegments(b.segments, dur)]);
      // newly covered seconds must be plausible for the time played (up to 2x speed, plus a little slack)
      if (coverOf(merged) - coverOf(oldSegs) <= play * 2.2 + 8) segs = merged;
    }
    const covered = Math.min(dur || Infinity, coverOf(segs));

    const data = {
      kind, title: title || prev?.title || '', durationSeconds: dur,
      stationId: stationId || prev?.stationId || '', sessionId: sessionId || prev?.sessionId || '',
      segments: segs as any, coveredSeconds: Math.round(covered),
      playSeconds: (prev?.playSeconds || 0) + play,
      plays: (prev?.plays || 0) + (b.started ? 1 : 0),
      lastWatchedAt: now,
    };
    const row = prev
      ? await prisma.videoWatch.update({ where: { id: prev.id }, data })
      : await prisma.videoWatch.create({ data: { userId, clipId, ...data } });

    if (play > 0) {
      void addActivity(userId, kind === 'session' ? 'video' : 'gvideo', play, kind === 'session' ? row.sessionId : row.stationId);
    }

    const fraction = row.durationSeconds > 0 ? Math.min(1, row.coveredSeconds / row.durationSeconds) : 0;
    const watched = fraction >= QUIZ_UNLOCK_FRACTION;
    // a class part watched for real: it counts as watched (opens its quiz) on every device
    if (kind === 'session' && watched) {
      const trackType = typeof b.trackType === 'string' && b.trackType ? b.trackType.slice(0, 24) : 'unknown';
      await prisma.userProgress.upsert({
        where: { userId_clipId: { userId, clipId } },
        update: { isWatched: true },
        create: { userId, clipId, trackType, stationId: row.stationId || 'unknown', sessionId: row.sessionId || 'unknown', isWatched: true },
      });
    }

    // one row in the person's log for each viewing (sent when the player stops / closes)
    const viewSeconds = Math.max(0, Math.min(6 * 3600, Math.round(Number(b.viewSeconds) || 0)));
    if (b.final && viewSeconds >= 3) {
      const where = kind === 'session' ? 'فیلم جلسه' : 'فیلم نگارستان';
      logUserEvent(userId, {
        type: 'video', area: 'station', refId: clipId, seconds: viewSeconds,
        label: `${where}: ${row.title || 'بدون عنوان'} (دیده‌شده تا الان: ${faNum(Math.round(fraction * 100))}٪ فیلم، ${faNum(row.plays)} بار پخش)`,
      });
    }

    res.json({ segments: segs, coveredSeconds: row.coveredSeconds, durationSeconds: row.durationSeconds, fraction, watched, playSeconds: row.playSeconds, plays: row.plays });
  } catch (error: any) {
    console.error('reportVideoWatch failed:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function getVideoWatch(req: AuthRequest, res: Response) {
  try {
    const clipId = String(req.params.clipId || '').slice(0, 64);
    const row = await prisma.videoWatch.findUnique({ where: { userId_clipId: { userId: req.user!.id, clipId } } });
    if (!row) return res.json({ segments: [], coveredSeconds: 0, durationSeconds: 0, fraction: 0, watched: false, playSeconds: 0, plays: 0 });
    const fraction = row.durationSeconds > 0 ? Math.min(1, row.coveredSeconds / row.durationSeconds) : 0;
    res.json({
      segments: storedSegments(row.segments), coveredSeconds: row.coveredSeconds, durationSeconds: row.durationSeconds,
      fraction, watched: fraction >= QUIZ_UNLOCK_FRACTION, playSeconds: row.playSeconds, plays: row.plays,
    });
  } catch (error: any) {
    console.error('getVideoWatch failed:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
