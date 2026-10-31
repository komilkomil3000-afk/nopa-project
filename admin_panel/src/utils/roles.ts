/**
 * Role hierarchy (highest first):
 *   super admin  >  admin  >  mentor  >  student
 *
 * Storage note: the existing "admin" accounts ARE the super admins, so the stored value
 * 'admin' keeps meaning super admin and every existing `role === 'admin'` check keeps working
 * (and fails closed for the new role). The new, limited admin is stored as 'SUB_ADMIN'.
 */
export const ROLE_SUPER_ADMIN = 'admin';
export const ROLE_ADMIN = 'SUB_ADMIN';

const RANK: Record<string, number> = {
  admin: 4,        // super admin
  sub_admin: 3,    // admin
  super_mentor: 2,
  mentor: 2,
  dual: 2,
  student: 1,
};

const norm = (role?: string | null) => String(role || '').toLowerCase();

export function roleRank(role?: string | null): number {
  return RANK[norm(role)] ?? 0;
}

export function isSuperAdmin(role?: string | null): boolean {
  return norm(role) === 'admin';
}

export function isSubAdmin(role?: string | null): boolean {
  return norm(role) === 'sub_admin';
}

/** Super admin or admin. */
export function isAnyAdmin(role?: string | null): boolean {
  return isSuperAdmin(role) || isSubAdmin(role);
}

/** Canonical stored spelling for a role coming from a request body. */
export function normalizeRole(role?: string | null): string {
  const r = norm(role);
  if (r === 'sub_admin') return ROLE_ADMIN;
  if (r === 'admin') return ROLE_SUPER_ADMIN;
  if (r === 'super_mentor') return 'SUPER_MENTOR';
  return String(role || '').trim();
}

export function roleLabelFa(role?: string | null): string {
  switch (norm(role)) {
    case 'admin': return 'سوپر ادمین';
    case 'sub_admin': return 'ادمین';
    case 'mentor':
    case 'super_mentor': return 'راهبر';
    default: return 'دانش‌آموز';
  }
}

/**
 * Only a super admin may grant or remove the admin / super admin roles, or edit someone who
 * already holds one. Returns an error message, or null when allowed.
 */
export function checkRoleChange(
  actorRole: string | undefined,
  targetCurrentRole: string | undefined | null,
  newRole: string | undefined | null
): string | null {
  const touchesPrivileged = isAnyAdmin(targetCurrentRole) || isAnyAdmin(newRole);
  if (touchesPrivileged && !isSuperAdmin(actorRole)) {
    return 'فقط سوپر ادمین می‌تواند نقش ادمین یا سوپر ادمین را تعریف یا تغییر دهد';
  }
  return null;
}
