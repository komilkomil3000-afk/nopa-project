/**
 * The mentor's verdict on how much each person took part in a challenge.
 * The percentage is fixed by the status, so a mentor picks a name, never a number.
 */
export const PARTICIPATION = {
  flagbearer: { label: 'پرچمدار', percent: 100 },
  active: { label: 'فعال', percent: 75 },
  semi: { label: 'نیمه‌فعال', percent: 50 },
  companion: { label: 'همراه', percent: 25 },
  tired: { label: 'خسته', percent: 0 },
} as const;

export type ParticipationStatus = keyof typeof PARTICIPATION;
export const PARTICIPATION_KEYS = Object.keys(PARTICIPATION) as ParticipationStatus[];

/** Levels saved before the five statuses existed. */
const LEGACY: Record<string, ParticipationStatus> = { full: 'flagbearer', partner: 'active', minimal: 'companion', inactive: 'tired' };

export function normalizeStatus(value: unknown): ParticipationStatus | null {
  const v = String(value ?? '');
  if (v in PARTICIPATION) return v as ParticipationStatus;
  return LEGACY[v] ?? null;
}

/** A share of an amount by status, always rounded up to a whole unit. */
export function shareOf(amount: number, status: ParticipationStatus): number {
  return Math.ceil((amount * PARTICIPATION[status].percent) / 100);
}

/** What the system would suggest from the conversation's score (0 to 100). */
export function suggestStatus(score: number): ParticipationStatus {
  if (score >= 85) return 'flagbearer';
  if (score >= 60) return 'active';
  if (score >= 35) return 'semi';
  if (score > 0) return 'companion';
  return 'tired';
}
