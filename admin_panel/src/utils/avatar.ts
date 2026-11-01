// Bundled profile pictures of the app (app/assets/avatars). The database only stores `asset:<key>` in User.avatarUrl;
// the gender is set by the admin panel and decides which pictures a user gets.
export const GENDERS = ['male', 'female'] as const;
export type Gender = (typeof GENDERS)[number];

export const STUDENT_AVATARS: Record<Gender, string[]> = {
  male: ['boy_1', 'boy_2', 'boy_3', 'boy_4'],
  female: ['girl_1', 'girl_2', 'girl_3', 'girl_4'],
};
export const MENTOR_AVATARS: Record<Gender, string> = { male: 'mentor_male', female: 'mentor_female' };

export function normalizeGender(value: unknown): Gender | null | undefined {
  if (value === undefined) return undefined;            // not sent -> leave unchanged
  if (value === null || value === '') return null;      // cleared
  return (GENDERS as readonly string[]).includes(String(value)) ? (String(value) as Gender) : undefined;
}

export function isMentorRole(role: string | null | undefined): boolean {
  return role === 'mentor' || role === 'SUPER_MENTOR';
}

/**
 * The avatarUrl a user should have for a role + gender. Mentors always get the mentor picture of their gender;
 * students keep their chosen picture while it still matches the gender, otherwise get the first one of the set.
 * Returns undefined when the avatar must not be touched (no gender, or an admin account).
 */
export function avatarFor(role: string | null | undefined, gender: Gender | null | undefined, current: string | null | undefined): string | null | undefined {
  if (!gender) return undefined;
  if (isMentorRole(role)) return `asset:${MENTOR_AVATARS[gender]}`;
  if (role === 'admin' || role === 'sub_admin') return undefined;
  const keys = STUDENT_AVATARS[gender];
  const currentKey = current && current.startsWith('asset:') ? current.slice(6) : '';
  return keys.includes(currentKey) ? current : `asset:${keys[0]}`;
}
