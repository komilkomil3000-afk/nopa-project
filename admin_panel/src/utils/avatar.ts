// Profile pictures. The list users can pick from lives in services/avatarCatalog.ts (editable in the panel);
// the gender is set by the admin panel and decides which pictures a user gets.
export { avatarFor, isMentorRole } from '../services/avatarCatalog';

export const GENDERS = ['male', 'female'] as const;
export type Gender = (typeof GENDERS)[number];

export function normalizeGender(value: unknown): Gender | null | undefined {
  if (value === undefined) return undefined;            // not sent -> leave unchanged
  if (value === null || value === '') return null;      // cleared
  return (GENDERS as readonly string[]).includes(String(value)) ? (String(value) as Gender) : undefined;
}
