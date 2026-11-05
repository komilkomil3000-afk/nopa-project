import prisma from '../../config/db';
import { EconomyConfig, RankRewards, rankRewardError, RankTier } from '../../services/economy';
import { getAssetNames } from '../../utils/assetNames';
import { PARTICIPATION, normalizeStatus } from './participation';
import { publishBotMessage } from './publish';

/**
 * Settlement of a cross-caravan challenge («چالش فراگروهی»), docs/specs/chat-access-matrix.md Part 3.
 * - The admin ranks the caravans: 1st طلایی, 2nd نقره‌ای, 3rd برنزی, everyone else پارچه‌ای (the banner, درفش).
 * - Each member is paid, in zarik and in کلاف, `base reward of the rank tier × participation % / 100`, rounded up.
 *   The base comes from the challenge's own reward plan (set by the admin) or the money rules' defaults.
 * - Ranking happens only at the end: after the deadline, once judging started, or when every caravan delivered.
 * - The arena thread gets the caravans' ranking only; each caravan's «گروه چالش‌ها» thread gets its own members' breakdown.
 */

export const RANK_ORDER: RankTier[] = ['gold', 'silver', 'bronze', 'cloth'];
export const TIER_LABEL: Record<RankTier, string> = { gold: 'طلایی', silver: 'نقره‌ای', bronze: 'برنزی', cloth: 'پارچه‌ای' };
const PLACE_LABEL = ['اول', 'دوم', 'سوم'];

export interface RewardPlan { zarik: RankRewards; nakh: RankRewards }

/** The base rewards a challenge pays per member, by rank: its own plan, else the money rules. */
export function rewardPlanOf(challenge: { rewardPlan?: unknown }, config: EconomyConfig): RewardPlan {
  const own = parseRewardPlan(challenge.rewardPlan);
  if (!('error' in own)) return own.plan;
  return { zarik: { ...config.interGroup.prizes }, nakh: { ...config.interGroup.nakhPrizes } };
}

/** Validates an admin's plan: whole non-negative amounts, never more for a lower place, for both assets. */
export function parseRewardPlan(raw: any): { plan: RewardPlan } | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'برنامه‌ی جایزه ارسال نشده است' };
  const pick = (r: any): RankRewards => ({ gold: Number(r?.gold), silver: Number(r?.silver), bronze: Number(r?.bronze), cloth: Number(r?.cloth) });
  const zarik = pick(raw.zarik), nakh = pick(raw.nakh);
  const ze = rankRewardError(zarik);
  if (ze) return { error: `زریک: ${ze}` };
  const ne = rankRewardError(nakh);
  if (ne) return { error: `کلاف: ${ne}` };
  return { plan: { zarik, nakh } };
}

/** A member's share of one base amount by participation status, rounded up; unclaimed percent is never redistributed. */
export function shareOfPercent(amount: number, percent: number): number {
  return Math.ceil((amount * percent) / 100);
}

/**
 * Caravans expected to deliver: active ones with a mentor and at least one student. Used to tell whether everyone
 * delivered before the deadline.
 */
async function expectedCaravans(): Promise<string[]> {
  const rows = await prisma.caravan.findMany({
    where: { isDeleted: false, status: 'active', mentorId: { not: null }, members: { some: { role: 'student' } } },
    select: { id: true },
  });
  return rows.map(r => r.id);
}

/**
 * Whether the admin may rank now. Strictly at the end: the deadline passed, the admin opened judging (which also freezes
 * the works), or every expected caravan has delivered its work.
 */
export async function rankingWindow(challenge: { id: string; dueDate: Date | null; judgingStartedAt: Date | null }): Promise<{ open: boolean; reason: string; delivered: number; expected: number }> {
  const [expected, entries] = await Promise.all([
    expectedCaravans(),
    prisma.interGroupEntry.findMany({ where: { challengeId: challenge.id }, select: { caravanId: true } }),
  ]);
  const delivered = new Set(entries.map(e => e.caravanId));
  const allIn = expected.length > 0 && expected.every(id => delivered.has(id));
  if (challenge.dueDate && challenge.dueDate <= new Date()) return { open: true, reason: 'deadline', delivered: delivered.size, expected: expected.length };
  if (challenge.judgingStartedAt) return { open: true, reason: 'judging', delivered: delivered.size, expected: expected.length };
  if (allIn) return { open: true, reason: 'all_delivered', delivered: delivered.size, expected: expected.length };
  return { open: false, reason: 'running', delivered: delivered.size, expected: expected.length };
}

export const RANKING_CLOSED_MESSAGE = 'رتبه‌بندی فقط در پایان چالش ممکن است: پس از پایان مهلت، شروع داوری، یا وقتی همه‌ی کاروان‌ها اثرشان را فرستاده باشند';

const fa = (n: number) => Number(n).toLocaleString('fa-IR');

type BannerRow = { caravanId: string; tier: string; rank: number | null };
type PlanRow = { userId: string; caravanId: string; tier: string; zarik: number; nakh: number };

/** The challenge's card in a space, so the settlement lands in its discussion thread. */
async function topicIn(challengeId: string, spaceKey: string) {
  return prisma.chatTopic.findFirst({ where: { challengeId, space: { key: spaceKey } }, select: { messageId: true, spaceId: true } });
}

/**
 * Posts the settlement. Arena: the caravans' places and banners only (no member names or amounts).
 * Each caravan's «گروه چالش‌ها»: that caravan's members, their participation and what they received.
 * `correction` marks a re-ranking. Never throws: the money has already moved.
 */
export async function postSettlement(challenge: { id: string; title: string }, banners: BannerRow[], plan: PlanRow[], correction = false): Promise<void> {
  try {
    const names = await getAssetNames();
    const caravans = await prisma.caravan.findMany({ where: { id: { in: banners.map(b => b.caravanId) } }, select: { id: true, name: true } });
    const nameOf = new Map(caravans.map(c => [c.id, c.name]));
    const banner = (tier: string) => names[`derafsh_${tier}`] || `${names.derafsh} ${TIER_LABEL[tier as RankTier] ?? ''}`;
    const ordered = [...banners].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
    const heading = correction ? `اصلاح نتیجه‌ی «${challenge.title}»` : `نتیجه‌ی نهایی «${challenge.title}»`;

    // ---- arena: caravans only ----
    const arena = await topicIn(challenge.id, 'arena');
    const arenaLines = ordered.map(b => `${b.rank ? `رتبه‌ی ${PLACE_LABEL[b.rank - 1] ?? fa(b.rank)}` : 'شرکت‌کننده'}: ${nameOf.get(b.caravanId) ?? ''} — ${banner(b.tier)}`);
    const arenaSpaceId = arena?.spaceId ?? (await prisma.chatSpace.findUnique({ where: { key: 'arena' }, select: { id: true } }))?.id;
    // Something good the judges said about each work: the place for praise, not comparison
    const entries = await prisma.interGroupEntry.findMany({ where: { challengeId: challenge.id }, include: { scores: { take: 1 } } });
    const strengths = entries
      .map(e => ({ name: nameOf.get(e.caravanId) ?? '', strength: e.scores[0]?.strength || null }))
      .filter(s => s.name && s.strength);
    if (arenaSpaceId) {
      await publishBotMessage({
        spaceId: arenaSpaceId, botKey: 'challenge', kind: 'result', threadRootId: arena?.messageId,
        body: `${heading}\n${arenaLines.join('\n')}\nجایزه‌ی هر عضو بر اساس رتبه‌ی کاروان و درصد مشارکت او پرداخت شد؛ جزئیات در «گروه چالش‌ها»ی هر کاروان است.`,
        meta: {
          settlement: true, scope: 'arena', correction, title: challenge.title,
          places: ordered.map(b => ({ place: b.rank, caravanId: b.caravanId, name: nameOf.get(b.caravanId) ?? '', tier: b.tier, tierLabel: TIER_LABEL[b.tier as RankTier] ?? b.tier })),
          strengths,
        },
      });
    }

    // ---- each caravan: its own members ----
    const tiers = await prisma.interGroupMemberTier.findMany({ where: { challengeId: challenge.id } });
    const people = await prisma.user.findMany({ where: { id: { in: plan.map(p => p.userId) } }, select: { id: true, name: true } });
    const personName = new Map(people.map(p => [p.id, p.name]));
    for (const b of ordered) {
      const topic = await topicIn(challenge.id, `challenges:${b.caravanId}`);
      const space = topic ?? (await prisma.chatSpace.findUnique({ where: { key: `challenges:${b.caravanId}` }, select: { id: true } }).then(s => (s ? { spaceId: s.id, messageId: undefined } : null)));
      if (!space) continue;
      const own = plan.filter(p => p.caravanId === b.caravanId);
      const members = own.map(p => {
        const status = normalizeStatus(tiers.find(t => t.userId === p.userId)?.tier) ?? normalizeStatus(p.tier) ?? 'tired';
        return { userId: p.userId, name: personName.get(p.userId) ?? '', status, statusLabel: PARTICIPATION[status].label, percent: PARTICIPATION[status].percent, zarik: p.zarik, nakh: p.nakh };
      }).sort((x, y) => y.percent - x.percent || x.name.localeCompare(y.name, 'fa'));
      const place = b.rank ? `رتبه‌ی ${PLACE_LABEL[b.rank - 1] ?? fa(b.rank)}` : 'شرکت‌کننده';
      const lines = members.map(m => `• ${m.name}: ${m.statusLabel} (${fa(m.percent)}٪) — ${fa(m.zarik)} ${names.zarik}${m.nakh ? ` و ${fa(m.nakh)} ${names.nakh}` : ''}`);
      await publishBotMessage({
        spaceId: space.spaceId, botKey: 'challenge', threadRootId: space.messageId,
        body: `${heading}\nکاروان شما: ${place} — ${banner(b.tier)}\n${lines.join('\n') || 'عضوی برای پرداخت نبود.'}`,
        meta: { settlement: true, scope: 'caravan', correction, title: challenge.title, caravanId: b.caravanId, rank: b.rank, tier: b.tier, members },
      });
    }
  } catch (e) {
    console.error('postSettlement error:', e);
  }
}
