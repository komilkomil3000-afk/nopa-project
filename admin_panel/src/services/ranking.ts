import prisma from '../config/db';
import { capitalValue, getEconomyPolicy } from './economy';

/**
 * The one source of every ranking the app shows: «برترین‌ها» in the market, the member's and the caravan's
 * «رتبه» on the chat profiles, and the station report cards. Same people, same formula (capitalValue), same order,
 * so a place never differs between two screens.
 *
 * - People: active students (not deleted). Mentors hold no capital of their own.
 * - Caravans: those not deleted; their active students' زریک / کلاف / قالیچه summed. درفش is the banners the
 *   caravan itself won (inter-group challenges), by tier; a member's personal درفش is theirs, not the caravan's.
 *   Ordered by the capital per member (fair to small caravans); equal capital: by banner points
 *   (BANNER_POINTS: 2 silver = 1 gold, 2 bronze = 1 silver, 5 cloth = 1 bronze); then by the total.
 *
 * Results are kept for a few seconds so a burst of requests (every open app reloading after a balance moved)
 * costs one query; any balance change clears them at once (see balanceEvents.ts).
 */

const CACHE_MS = 5_000;

export type BannerTier = 'gold' | 'silver' | 'bronze' | 'cloth';
export type BannerCounts = Record<BannerTier, number>;

/** Worth of each banner in «امتیاز درفش», counted in cloth banners: 2 silver = 1 gold, 2 bronze = 1 silver, 5 cloth = 1 bronze. */
export const BANNER_POINTS: BannerCounts = { gold: 20, silver: 10, bronze: 5, cloth: 1 };

export function bannerPoints(b: BannerCounts): number {
  return b.gold * BANNER_POINTS.gold + b.silver * BANNER_POINTS.silver + b.bronze * BANNER_POINTS.bronze + b.cloth * BANNER_POINTS.cloth;
}

/** The banners each caravan won, by tier. */
export async function caravanBannerCounts(): Promise<Map<string, BannerCounts>> {
  const rows = await prisma.caravanBanner.groupBy({ by: ['caravanId', 'tier'], _count: { _all: true } });
  const map = new Map<string, BannerCounts>();
  for (const r of rows) {
    const counts = map.get(r.caravanId) ?? { gold: 0, silver: 0, bronze: 0, cloth: 0 };
    if (r.tier in counts) counts[r.tier as BannerTier] += r._count._all;
    map.set(r.caravanId, counts);
  }
  return map;
}

export interface RankedStudent {
  id: string;
  name: string;
  avatarUrl: string | null;
  levelFrame: number;
  caravanId: string | null;
  zarikBalance: number;
  nakh: number;
  farsh: number;
  beyragh: number;
  capital: number;
}

export interface RankedCaravan {
  id: string;
  name: string;
  coverImageUrl: string | null;
  mentorName: string;
  memberCount: number;
  capacityLimit: number;
  /** Sum of each asset over the caravan's members; beyragh: the banners the caravan won (all tiers). */
  assets: { zarik: number; nakh: number; farsh: number; beyragh: number };
  /** The caravan's banners by tier, and their «امتیاز درفش». */
  banners: BannerCounts;
  bannerPoints: number;
  /** Sum of the members' capital, in zarik. */
  totalWealth: number;
  /** totalWealth per member: what the caravans are ordered by. */
  averageWealth: number;
}

let studentsCache: { at: number; list: Promise<RankedStudent[]> } | null = null;
let caravansCache: { at: number; list: Promise<RankedCaravan[]> } | null = null;

/** Drops the cached rankings; the next request computes them again. */
export function invalidateRankings(): void {
  studentsCache = null;
  caravansCache = null;
}

function fresh<T>(cache: { at: number; list: Promise<T> } | null): Promise<T> | null {
  return cache && Date.now() - cache.at < CACHE_MS ? cache.list : null;
}

/** Active students, richest first (ties: the older id first, so the order never flickers). */
export function rankedStudents(): Promise<RankedStudent[]> {
  const hit = fresh(studentsCache);
  if (hit) return hit;
  const list = computeStudents();
  studentsCache = { at: Date.now(), list };
  list.catch(() => { if (studentsCache?.list === list) studentsCache = null; });
  return list;
}

async function computeStudents(): Promise<RankedStudent[]> {
  const { config } = await getEconomyPolicy();
  const students = await prisma.user.findMany({
    where: { role: 'student', isDeleted: false },
    select: { id: true, name: true, avatarUrl: true, levelFrame: true, caravanId: true, zarikBalance: true, nakh: true, farsh: true, beyragh: true },
  });
  return students
    .map(s => ({ ...s, levelFrame: s.levelFrame || 1, capital: capitalValue(s, config) }))
    .sort((a, b) => b.capital - a.capital || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Caravans, best first (capital per member, then total capital). */
export function rankedCaravans(): Promise<RankedCaravan[]> {
  const hit = fresh(caravansCache);
  if (hit) return hit;
  const list = computeCaravans();
  caravansCache = { at: Date.now(), list };
  list.catch(() => { if (caravansCache?.list === list) caravansCache = null; });
  return list;
}

async function computeCaravans(): Promise<RankedCaravan[]> {
  const [caravans, students, banners] = await Promise.all([
    prisma.caravan.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true, coverImageUrl: true, capacityLimit: true, mentor: { select: { name: true } } },
    }),
    rankedStudents(),
    caravanBannerCounts(),
  ]);
  const membersOf = new Map<string, RankedStudent[]>();
  for (const s of students) {
    if (!s.caravanId) continue;
    const list = membersOf.get(s.caravanId);
    if (list) list.push(s); else membersOf.set(s.caravanId, [s]);
  }
  return caravans
    .map(c => toRankedCaravan(c, membersOf.get(c.id) ?? [], banners.get(c.id) ?? { gold: 0, silver: 0, bronze: 0, cloth: 0 }))
    .sort((a, b) => b.averageWealth - a.averageWealth || b.bannerPoints - a.bannerPoints || b.totalWealth - a.totalWealth
      || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function toRankedCaravan(
  c: { id: string; name: string; coverImageUrl: string | null; capacityLimit: number | null; mentor: { name: string } | null },
  members: RankedStudent[],
  banners: BannerCounts,
): RankedCaravan {
  const sum = (pick: (m: RankedStudent) => number) => members.reduce((total, m) => total + (pick(m) || 0), 0);
  const totalWealth = sum(m => m.capital);
  return {
    id: c.id,
    name: c.name,
    coverImageUrl: c.coverImageUrl || null,
    mentorName: c.mentor?.name || '-',
    memberCount: members.length,
    capacityLimit: c.capacityLimit || 25,
    assets: {
      zarik: sum(m => m.zarikBalance), nakh: sum(m => m.nakh), farsh: sum(m => m.farsh),
      beyragh: banners.gold + banners.silver + banners.bronze + banners.cloth,
    },
    banners,
    bannerPoints: bannerPoints(banners),
    totalWealth,
    averageWealth: members.length > 0 ? Math.round(totalWealth / members.length) : 0,
  };
}

/** 1-based place of a student in [rankedStudents], or null when they are not ranked (not an active student). */
export async function studentRank(userId: string): Promise<number | null> {
  const at = (await rankedStudents()).findIndex(s => s.id === userId);
  return at >= 0 ? at + 1 : null;
}

/** A caravan's figures for its mentor's screens: exactly what «برترین کاروان‌ها» counts, plus its place. */
export interface CaravanStanding {
  rank: number;
  of: number;
  memberCount: number;
  assets: RankedCaravan['assets'];
  banners: BannerCounts;
  bannerPoints: number;
  totalWealth: number;
  averageWealth: number;
}

/** Standing of each caravan by id (deleted caravans have none). */
export async function caravanStandings(): Promise<Map<string, CaravanStanding>> {
  const list = await rankedCaravans();
  return new Map(list.map((c, i) => [c.id, {
    rank: i + 1, of: list.length, memberCount: c.memberCount, assets: c.assets, banners: c.banners, bannerPoints: c.bannerPoints,
    totalWealth: c.totalWealth, averageWealth: c.averageWealth,
  }]));
}

/** 1-based place of a caravan in [rankedCaravans], or null. */
export async function caravanRank(caravanId: string): Promise<number | null> {
  const at = (await rankedCaravans()).findIndex(c => c.id === caravanId);
  return at >= 0 ? at + 1 : null;
}
