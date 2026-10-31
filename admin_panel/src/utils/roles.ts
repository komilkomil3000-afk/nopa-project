// Mentors (and super mentors) can browse all LMS content but never earn personal rewards.
export function isMentorRole(role?: string | null): boolean {
  const r = String(role || '').toLowerCase().replace(/[\s_-]/g, '');
  return r === 'mentor' || r === 'supermentor';
}

/**
 * The four user levels:
 *   admin      - super admin, unrestricted in the panel (can change roles and grant access)
 *   sub_admin  - content admin, limited to the panel sections a super admin granted
 *   mentor     - mentor (legacy value SUPER_MENTOR is treated as a mentor)
 *   student
 */
export const ROLE_ADMIN = 'admin';
export const ROLE_SUB_ADMIN = 'sub_admin';
export const ROLE_MENTOR = 'mentor';
export const ROLE_STUDENT = 'student';

/** Roles a super admin may assign from the panel. */
export const ASSIGNABLE_ROLES = [ROLE_ADMIN, ROLE_SUB_ADMIN, ROLE_MENTOR, ROLE_STUDENT];

export function isSuperAdminRole(role?: string | null): boolean {
  return String(role || '').toLowerCase() === ROLE_ADMIN;
}

export function isSubAdminRole(role?: string | null): boolean {
  return String(role || '').toLowerCase().replace(/[\s-]/g, '_') === ROLE_SUB_ADMIN;
}

/** Panel sections a super admin can grant to a sub admin. */
export const PANEL_SECTIONS: Record<string, string> = {
  users: 'کاربران، مخاطبان و سطوح',
  rewards: 'کیف پول، زریک و دارایی‌ها',
  mentors: 'راهبران و مدارک',
  instructors: 'بانک اساتید',
  caravans: 'کاروان‌ها',
  lms: 'منزلگاه‌ها، کلاس‌ها و آزمون‌ها',
  challenges: 'چالش‌ها و تکالیف',
  support: 'تیکت‌ها، پیام‌ها و چت',
  content: 'جارچی، بنر، رسانه و فرم‌ها',
  notifications: 'اعلان‌ها و پیام‌رسانی',
  analytics: 'آمار و لیگ',
};

export type SectionLevel = 'view' | 'edit';
export type SectionGrants = Record<string, SectionLevel>;

/** Parses RolePermission.permissionsJson, dropping unknown sections/levels. Never throws. */
export function parseSectionGrants(raw?: string | null): SectionGrants {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    const out: SectionGrants = {};
    if (parsed && typeof parsed === 'object') {
      for (const [key, level] of Object.entries(parsed)) {
        if (key in PANEL_SECTIONS && (level === 'view' || level === 'edit')) {
          out[key] = level as SectionLevel;
        }
      }
    }
    return out;
  } catch {
    return {};
  }
}
