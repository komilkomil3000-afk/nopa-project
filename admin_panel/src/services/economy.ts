import prisma from '../config/db';

/** Every money rule the admin can change from the panel. Stored as versioned rows in EconomyPolicy. */
export interface EconomyConfig {
  nakhPerFarsh: number;       // how many nakh make one farsh
  farshSalePrice: number;     // zarik paid for one farsh
  allowBuyNakh: boolean;      // may students turn zarik into nakh
  zarikPerNakh: number;       // price of one nakh while allowBuyNakh is on
  challengeMaxNakh: number;   // highest nakh a personal or group challenge can pay
  challengeMaxZarik: number;  // highest zarik a personal or group challenge can pay
  evaluationWeights: { relevance: number; quality: number; collaboration: number; initiative: number }; // percent, must total 100
  interGroup: {
    prizes: { gold: number; silver: number; bronze: number; cloth: number }; // zarik per member, by rank
    nakhPrizes: { gold: number; silver: number; bronze: number; cloth: number }; // nakh (کلاف) per member, by rank; 0 = none
    tiers: { full: number; partner: number; minimal: number };               // percent of the prize, by effort
    rankWeights: { judges: number; coverage: number; delivery: number };     // percent, must total 100
  };
}

export const DEFAULT_ECONOMY: EconomyConfig = {
  nakhPerFarsh: 10,
  farshSalePrice: 50000,
  allowBuyNakh: false,
  zarikPerNakh: 500,
  challengeMaxNakh: 10,
  // Same worth as the nakh ceiling (10 nakh × 5,000 zarik): a zarik challenge cannot pay more than a nakh one
  challengeMaxZarik: 50000,
  evaluationWeights: { relevance: 30, quality: 30, collaboration: 20, initiative: 20 },
  interGroup: {
    prizes: { gold: 20000, silver: 15000, bronze: 10000, cloth: 2500 },
    nakhPrizes: { gold: 0, silver: 0, bronze: 0, cloth: 0 },
    tiers: { full: 100, partner: 60, minimal: 25 },
    rankWeights: { judges: 60, coverage: 25, delivery: 15 },
  },
};

export interface EconomyPolicy { version: number; config: EconomyConfig; }

const CACHE_MS = 10_000;
let cached: { policy: EconomyPolicy; at: number } | null = null;

export async function getEconomyPolicy(): Promise<EconomyPolicy> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.policy;
  const row = await prisma.economyPolicy.findFirst({ orderBy: { version: 'desc' } });
  const policy = row
    ? { version: row.version, config: { ...DEFAULT_ECONOMY, ...(row.config as unknown as EconomyConfig) } }
    : { version: 0, config: DEFAULT_ECONOMY };
  // Policies saved before a field existed get its default (nested groups too)
  if (row) {
    const saved = row.config as any;
    policy.config.interGroup = { ...DEFAULT_ECONOMY.interGroup, ...(saved?.interGroup ?? {}) };
  }
  cached = { policy, at: Date.now() };
  return policy;
}

export async function saveEconomyPolicy(config: EconomyConfig, createdBy: string, note: string | null): Promise<EconomyPolicy> {
  const row = await prisma.economyPolicy.create({ data: { config: config as any, createdBy, note } });
  cached = null;
  return { version: row.version, config };
}

/** Zarik worth of one nakh. Derived, so it can never disagree with the farsh rules. */
export function nakhValue(c: EconomyConfig): number {
  return c.farshSalePrice / c.nakhPerFarsh;
}

/**
 * Ranking capital: holdings counted at their zarik worth. کلاف (nakh) has no worth of its own: it counts only
 * once turned into قالیچه (farsh), so converting it raises the capital. Selling a farsh leaves it unchanged.
 * Every ranking (app, chat profiles, panel, station report cards) uses this one formula.
 */
export function capitalValue(b: { zarikBalance?: number | null; nakh?: number | null; farsh?: number | null }, c: EconomyConfig): number {
  return Math.round((b.zarikBalance || 0) + (b.farsh || 0) * c.farshSalePrice);
}

export type CapitalAsset = 'zarik' | 'nakh' | 'farsh';

/** The exchange from -> to: sourceAmount must be a multiple of `step`, and each step pays `pays` units. */
export function conversionRule(from: CapitalAsset, to: CapitalAsset, c: EconomyConfig): { step: number; pays: number } | null {
  if (from === 'nakh' && to === 'farsh') return { step: c.nakhPerFarsh, pays: 1 };
  if (from === 'farsh' && to === 'zarik') return { step: 1, pays: c.farshSalePrice };
  if (from === 'zarik' && to === 'nakh' && c.allowBuyNakh) return { step: c.zarikPerNakh, pays: 1 };
  return null;
}

function positiveInts(values: Record<string, unknown>): boolean {
  return Object.values(values).every(v => Number.isInteger(v) && (v as number) > 0);
}

export type RankTier = 'gold' | 'silver' | 'bronze' | 'cloth';
export type RankRewards = Record<RankTier, number>;

/** One asset's amounts per rank: whole, not negative, and never more for a lower place. Null = valid. */
export function rankRewardError(r: Partial<Record<RankTier, unknown>> | null | undefined): string | null {
  if (!r) return 'مقادیر ناقص است';
  const values = [r.gold, r.silver, r.bronze, r.cloth];
  if (!values.every(v => Number.isInteger(v) && (v as number) >= 0)) return 'مقدار هر رتبه باید عدد صحیح نامنفی باشد';
  const [gold, silver, bronze, cloth] = values as number[];
  if (!(gold >= silver && silver >= bronze && bronze >= cloth)) return 'جایزه‌ی رتبه‌ی بالاتر نمی‌تواند کمتر باشد';
  return null;
}

function percents(values: Record<string, unknown>): boolean {
  return Object.values(values).every(v => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 100);
}

/** Validates a config sent by the panel and keeps only the known fields. */
export function parseEconomyConfig(raw: any): { error: string } | { config: EconomyConfig } {
  const g = raw?.interGroup;
  const prizes = g?.prizes, tiers = g?.tiers, weights = g?.rankWeights;
  const weightsE = raw?.evaluationWeights ?? DEFAULT_ECONOMY.evaluationWeights;
  if (!prizes || !tiers || !weights) return { error: 'تنظیمات مالی ناقص است' };

  const config: EconomyConfig = {
    nakhPerFarsh: raw.nakhPerFarsh,
    farshSalePrice: raw.farshSalePrice,
    allowBuyNakh: raw.allowBuyNakh === true,
    zarikPerNakh: raw.zarikPerNakh,
    challengeMaxNakh: raw.challengeMaxNakh,
    challengeMaxZarik: raw.challengeMaxZarik ?? DEFAULT_ECONOMY.challengeMaxZarik,
    evaluationWeights: {
      relevance: weightsE?.relevance, quality: weightsE?.quality, collaboration: weightsE?.collaboration, initiative: weightsE?.initiative,
    },
    interGroup: {
      prizes: { gold: prizes.gold, silver: prizes.silver, bronze: prizes.bronze, cloth: prizes.cloth },
      nakhPrizes: {
        gold: g?.nakhPrizes?.gold ?? 0, silver: g?.nakhPrizes?.silver ?? 0, bronze: g?.nakhPrizes?.bronze ?? 0, cloth: g?.nakhPrizes?.cloth ?? 0,
      },
      tiers: { full: tiers.full, partner: tiers.partner, minimal: tiers.minimal },
      rankWeights: { judges: weights.judges, coverage: weights.coverage, delivery: weights.delivery },
    },
  };

  const { allowBuyNakh, interGroup, evaluationWeights, ...numbers } = config;
  if (!positiveInts(numbers)) return { error: 'نرخ‌ها باید عدد صحیح مثبت باشند' };
  if (!positiveInts(config.interGroup.prizes)) return { error: 'جایزه‌ی هر رتبه باید عدد صحیح مثبت باشد' };
  const { gold, silver, bronze, cloth } = config.interGroup.prizes;
  if (!(gold >= silver && silver >= bronze && bronze >= cloth)) return { error: 'جایزه‌ی رتبه‌ی بالاتر نمی‌تواند کمتر باشد' };
  const rankError = rankRewardError(config.interGroup.nakhPrizes);
  if (rankError) return { error: `کلاف فراگروهی: ${rankError}` };
  if (!percents(config.interGroup.tiers)) return { error: 'ضریب سطوح باید بین ۰ تا ۱۰۰ باشد' };
  if (!percents(config.interGroup.rankWeights)) return { error: 'وزن معیارها باید بین ۰ تا ۱۰۰ باشد' };
  if (config.interGroup.rankWeights.judges + config.interGroup.rankWeights.coverage + config.interGroup.rankWeights.delivery !== 100) {
    return { error: 'جمع وزن معیارهای رتبه باید ۱۰۰ باشد' };
  }
  if (!percents(evaluationWeights) || Object.values(evaluationWeights).reduce((a, b) => a + b, 0) !== 100) {
    return { error: 'جمع وزن معیارهای ارزیابی باید ۱۰۰ باشد' };
  }
  return { config };
}

/** The richest students by the official formula, with the fields the panel shows. */
export async function topByCapital(take: number) {
  const { config } = await getEconomyPolicy();
  const students = await prisma.user.findMany({ where: { role: 'student', isDeleted: false }, select: { name: true, zarikBalance: true, nakh: true, beyragh: true, farsh: true } });
  return students.map(s => ({ ...s, capital: capitalValue(s, config) })).sort((a, b) => b.capital - a.capital).slice(0, take);
}
