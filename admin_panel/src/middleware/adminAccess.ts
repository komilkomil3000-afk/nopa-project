import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { canEnterPanel, isRequestAllowed } from '../utils/access';
import { DEFAULT_ROLE_PERMISSIONS, matches, rulesForKeys, configKey } from '../utils/permissions';
import { isAnyAdmin, isSuperAdmin } from '../utils/roles';

/**
 * Access control for the /admin router.
 *
 *   super admin (stored 'admin')  everything, always
 *   everyone else                 only the requests unlocked by the permission keys their role holds
 *                                 (utils/permissions.ts). The super admin edits those keys in the panel;
 *                                 until edited, each role has what it could do before the editor existed.
 *
 * Default-deny: a route that is not in the permission catalog (role management, the permission
 * matrix, ...) is super-admin-only. Paths are matched relative to the router mount (/api/v1/admin).
 */

export const PANEL_DENIED_MESSAGE = 'مجوز ورود به پنل برای حساب شما فعال نیست. با مدیر سیستم تماس بگیرید.';

/**
 * Hard stop for admin / super admin accounts whose panel login has been switched off, on every
 * request (a token issued earlier stops working immediately). Mentors and students are not blocked
 * here: the mobile app also calls a few /admin routes with their tokens, and what they can reach is
 * already limited by the permission keys of their role. They are kept out of the panel UI itself at
 * login and by GET /me/access.
 */
export async function requirePanelAccess(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return res.status(401).json({ error: 'توکن اعتبارسنجی ارسال نشده است' });
    if (isAnyAdmin(req.user.role) && !(await canEnterPanel(req.user.role, req.user.panelAccess))) {
      return res.status(403).json({ error: PANEL_DENIED_MESSAGE });
    }
    next();
  } catch (e) {
    console.error('requirePanelAccess error:', e);
    res.status(500).json({ error: 'خطای سرور در بررسی دسترسی' });
  }
}

export async function enforcePermissions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const role = req.user?.role;
    if (isSuperAdmin(role)) return next();
    if (await isRequestAllowed(role, req.method, req.path)) return next();
    return res.status(403).json({
      error: isAnyAdmin(role) || configKey(role) === 'mentor'
        ? 'این بخش برای نقش شما فعال نشده است. برای دریافت دسترسی با سوپر ادمین تماس بگیرید'
        : 'این عملیات فقط برای سوپر ادمین مجاز است',
    });
  } catch (e) {
    console.error('enforcePermissions error:', e);
    res.status(500).json({ error: 'خطای سرور در بررسی دسترسی' });
  }
}

// ---- Built-in defaults, synchronous, no database (kept for tests and as documentation) ----
const MENTOR_ALLOWED = rulesForKeys(DEFAULT_ROLE_PERMISSIONS.mentor);
const SUB_ADMIN_ALLOWED = rulesForKeys(DEFAULT_ROLE_PERMISSIONS.SUB_ADMIN);

/** Legacy synchronous gate using only the built-in defaults. The router uses enforcePermissions. */
export function restrictNonAdmins(req: AuthRequest, res: Response, next: NextFunction) {
  const role = req.user?.role?.toLowerCase();
  if (role === 'admin') return next();
  const rules = role === 'sub_admin' ? SUB_ADMIN_ALLOWED
    : (role === 'mentor' || role === 'super_mentor') ? MENTOR_ALLOWED : null;
  if (rules && matches(rules, req.method, req.path)) return next();
  return res.status(403).json({ error: 'این عملیات فقط برای سوپر ادمین مجاز است' });
}

// Exposed for tests
export const __MENTOR_ALLOWED_FOR_TESTS = MENTOR_ALLOWED;
export const __SUB_ADMIN_ALLOWED_FOR_TESTS = SUB_ADMIN_ALLOWED;