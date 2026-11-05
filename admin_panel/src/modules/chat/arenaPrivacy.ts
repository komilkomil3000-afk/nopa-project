import prisma from '../../config/db';
import { ChatActor, isStaff } from './access';

/**
 * «میدان آثار» privacy: a caravan's submitted work under a cross-caravan challenge stays sealed from rival caravans
 * until the deadline passes or the admin opens judging. Staff (admin, sub admin, channel manager, support) always see it.
 * A submission is a mentor's reply with a file in the challenge's arena thread; its meta carries
 * { submission: true, caravanId, challengeId }.
 */

/** Works stay private until the deadline passes or the admin opens judging: a mentor must not read a rival early. */
export function judgingOpen(c: { dueDate: Date | null; judgingStartedAt: Date | null }, now = new Date()): boolean {
  return !!c.judgingStartedAt || (!!c.dueDate && c.dueDate <= now);
}

type SubmissionMeta = { submission?: boolean; caravanId?: string; challengeId?: string };

function submissionMeta(meta: unknown): { caravanId: string; challengeId: string } | null {
  const m = (meta ?? {}) as SubmissionMeta;
  return m.submission && m.caravanId && m.challengeId ? { caravanId: m.caravanId, challengeId: m.challengeId } : null;
}

function ownCaravans(actor: ChatActor): Set<string> {
  return new Set([...actor.mentoredCaravanIds, ...(actor.caravanId ? [actor.caravanId] : [])]);
}

/**
 * Ids of the arena messages this actor must not see yet: rival caravans' sealed submissions.
 * Empty outside the arena and for staff, so callers can always pass the result to `id: { notIn }`.
 */
export async function sealedMessageIds(actor: ChatActor, space: { id: string; type: string }): Promise<string[]> {
  if (space.type !== 'arena' || isStaff(actor)) return [];
  const topics = await prisma.chatTopic.findMany({
    where: { spaceId: space.id, challenge: { category: 'inter_group', rankingFinalizedAt: null } },
    select: { messageId: true, challenge: { select: { dueDate: true, judgingStartedAt: true } } },
  });
  const roots = topics.filter(t => !judgingOpen(t.challenge)).map(t => t.messageId);
  if (roots.length === 0) return [];
  const replies = await prisma.chatMessage.findMany({
    where: { threadRootId: { in: roots } },
    select: { id: true, meta: true },
  });
  const mine = ownCaravans(actor);
  return replies.filter(r => {
    const s = submissionMeta(r.meta);
    return !!s && !mine.has(s.caravanId);
  }).map(r => r.id);
}

/** Throws-free check for a single message (reactions, file links, edits by id). */
export async function isSealedFor(actor: ChatActor, message: { spaceId: string; meta: unknown }, spaceType: string): Promise<boolean> {
  if (spaceType !== 'arena' || isStaff(actor)) return false;
  const s = submissionMeta(message.meta);
  if (!s || ownCaravans(actor).has(s.caravanId)) return false;
  const challenge = await prisma.challenge.findUnique({ where: { id: s.challengeId }, select: { dueDate: true, judgingStartedAt: true, rankingFinalizedAt: true } });
  return !!challenge && !challenge.rankingFinalizedAt && !judgingOpen(challenge);
}

/**
 * Who may receive a live event about this message. Null = everyone in the space.
 * A sealed submission goes only to staff and to its own caravan (members and mentor).
 */
export async function sealedAudience(message: { meta: unknown }): Promise<string[] | null> {
  const s = submissionMeta(message.meta);
  if (!s) return null;
  const challenge = await prisma.challenge.findUnique({ where: { id: s.challengeId }, select: { dueDate: true, judgingStartedAt: true, rankingFinalizedAt: true } });
  if (!challenge || challenge.rankingFinalizedAt || judgingOpen(challenge)) return null;
  const [caravan, people] = await Promise.all([
    prisma.caravan.findUnique({ where: { id: s.caravanId }, select: { mentorId: true } }),
    prisma.user.findMany({
      where: { OR: [{ caravanId: s.caravanId }, { role: { in: ['admin', 'sub_admin', 'channel_manager', 'support'] } }] },
      select: { id: true },
    }),
  ]);
  const ids = new Set(people.map(p => p.id));
  if (caravan?.mentorId) ids.add(caravan.mentorId);
  return Array.from(ids);
}
