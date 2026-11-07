import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import prisma from '../config/db';
import { isChannelManagerRole, isSubAdminRole, parseChatPermissions, parseSectionGrants, PANEL_SECTIONS, ROLE_CHANNEL_MANAGER, SectionGrants, SectionLevel } from '../utils/roles';

/**
 * Default-deny gate for the /admin router.
 *
 * - role "admin" (super admin): unrestricted. This branch never touches the database, so a
 *   super admin can always get in.
 * - role "sub_admin" (content admin): only the panel sections a super admin granted (see below).
 * - mentor / SUPER_MENTOR: may only call the explicit allowlist below. Anything that
 *   mints currency, changes roles, deletes or exports users, rewrites RBAC, edits system
 *   settings or content, or broadcasts globally is admin-only simply because it is not listed.
 * - channel_manager: only the chat management routes, and only with panel access.
 * - everyone else (students...): rejected.
 *
 * New admin routes are therefore super-admin-only until someone deliberately adds them.
 *
 * Paths are matched against req.path, i.e. relative to the router mount (/api/v1/admin).
 */
interface Rule {
  methods: string[];
  path: RegExp;
}

const GET = ['GET'];

const MENTOR_ALLOWED: Rule[] = [
  // Read-only operational views
  { methods: GET, path: /^\/users$/i },
  { methods: GET, path: /^\/users\/metrics$/i },
  { methods: GET, path: /^\/users\/(?!export$)[^/]+$/i },
  { methods: GET, path: /^\/users\/[^/]+\/analytics$/i },
  { methods: GET, path: /^\/users\/[^/]+\/presence$/i },
  { methods: GET, path: /^\/caravans(\/[^/]+)?$/i },
  { methods: GET, path: /^\/asset-conversions$/i },
  { methods: GET, path: /^\/tickets$/i },
  { methods: GET, path: /^\/challenges$/i },
  { methods: GET, path: /^\/submissions$/i },
  { methods: GET, path: /^\/analytics$/i },
  { methods: GET, path: /^\/leaderboard\/(assets|individuals|caravans)$/i },
  { methods: GET, path: /^\/rewards\/ledger$/i },
  { methods: GET, path: /^\/messages$/i },
  { methods: GET, path: /^\/lms\/(stations|classes|sessions|clips|quizzes)$/i },
  { methods: GET, path: /^\/courses\/hierarchy$/i },
  { methods: GET, path: /^\/mentors\/(scorecards|evaluations)$/i },
  { methods: GET, path: /^\/levels-and-certificates$/i },
  { methods: GET, path: /^\/forms$/i },
  { methods: GET, path: /^\/news$/i },
  { methods: GET, path: /^\/banners$/i },

  // Day-to-day mentor actions
  { methods: ['POST'], path: /^\/tickets\/[^/]+\/(reply|resolve)$/i },
  { methods: ['POST', 'PATCH'], path: /^\/submissions\/[^/]+\/review$/i },
  { methods: ['POST'], path: /^\/challenges$/i },
  { methods: ['PUT', 'PATCH'], path: /^\/challenges\/[^/]+$/i },
  { methods: GET, path: /^\/drafts\/challenge$/i },
  { methods: ['PUT', 'DELETE'], path: /^\/drafts\/challenge\/[^/]+$/i },
  { methods: ['POST'], path: /^\/messages$/i },
  { methods: ['POST'], path: /^\/messages\/[^/]+\/reply$/i },
  { methods: ['POST'], path: /^\/caravans\/[^/]+\/broadcast$/i },
];

// ---------------------------------------------------------------------------------------------
// Sub admin (content admin): limited to the panel sections a super admin granted.
// Anything not mapped to a section below is super-admin only.
// ---------------------------------------------------------------------------------------------

/** Never available to a sub admin, whatever they were granted. */
const SUPER_ONLY: RegExp[] = [
  /^\/roles(\/|$)/i,
  /^\/security(\/|$)/i,
  /^\/settings(\/|$)/i,
  /^\/app-release(\/|$)/i,
  /^\/economy(\/|$)/i,
  /^\/audit(\/|$)/i,
  /^\/export(\/|$)/i,
  /^\/users\/export$/i,
  /^\/users\/[^/]+\/(role|panel-access|override-password)$/i,
];

const SECTION_RULES: Array<[RegExp, string]> = [
  [/^\/(users|students|levels|levels-and-certificates)(\/|$)/i, 'users'],
  [/^\/(rewards|zarik|wallet|assets)(\/|$)/i, 'rewards'],
  [/^\/mentors(\/|$)/i, 'mentors'],
  [/^\/instructors(\/|$)/i, 'instructors'],
  [/^\/(caravans|asset-conversions)(\/|$)/i, 'caravans'],
  [/^\/(lms|stations|courses|quizzes)(\/|$)/i, 'lms'],
  [/^\/(challenges|submissions|intergroup|challenge-taxonomy)(\/|$)/i, 'challenges'],
  [/^\/drafts\/challenge(\/|$)/i, 'challenges'],
  [/^\/drafts\/station(\/|$)/i, 'lms'],
  [/^\/(tickets|messages|support-cases)(\/|$)/i, 'support'],
  [/^\/chat-manage(\/|$)/i, 'chat'],
  [/^\/(news|banners|app-images|app-avatars|announcements|media|forms)(\/|$)/i, 'content'],
  [/^\/notifications(\/|$)/i, 'notifications'],
  [/^\/(analytics|leaderboard)(\/|$)/i, 'analytics'],
];

/** Which panel section a /admin path belongs to (undefined = super-admin only). */
export function sectionForPath(path: string): string | undefined {
  if (SUPER_ONLY.some(r => r.test(path))) return undefined;
  const hit = SECTION_RULES.find(([re]) => re.test(path));
  return hit ? hit[1] : undefined;
}

export interface PanelProfile {
  /** May the user use the panel at all */
  allowed: boolean;
  /** Sections granted (sub admins only; super admins implicitly have everything) */
  grants: SectionGrants;
}

/**
 * Resolves what a sub admin may do. The per-user override (User.panelAccess) wins over the
 * role default (RolePermission.canLoginPanel); the section grants live on the role row.
 */
export async function loadSubAdminProfile(user: { role: string; panelAccess?: boolean | null }): Promise<PanelProfile> {
  const row = await prisma.rolePermission.findFirst({
    where: { roleName: { in: [user.role, 'sub_admin'] } },
    orderBy: { roleName: 'asc' },
  });
  const allowed = user.panelAccess ?? row?.canLoginPanel ?? false;
  return { allowed, grants: parseSectionGrants(row?.permissionsJson) };
}

function hasGrant(grants: SectionGrants, section: string, needed: SectionLevel): boolean {
  const level = grants[section];
  if (!level) return false;
  return needed === 'view' ? true : level === 'edit';
}

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** A sub admin may never change an admin / sub admin account (no password reset, block, delete...). */
async function targetsProtectedAccount(req: AuthRequest): Promise<boolean> {
  const m = /^\/(users|students|mentors)\/([^/]+)/i.exec(req.path);
  const ids = [m?.[2], (req.body as any)?.id].filter((v): v is string => typeof v === 'string' && v.length > 0);
  for (const id of ids) {
    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (target) {
      const r = String(target.role || '').toLowerCase();
      if (r === 'admin' || r === 'sub_admin' || r === ROLE_CHANNEL_MANAGER) return true;
    }
  }
  return false;
}

async function subAdminGate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const profile = await loadSubAdminProfile(req.user as any);
    if (!profile.allowed) {
      return res.status(403).json({ error: 'دسترسی شما به پنل مدیریت فعال نشده است' });
    }
    if (req.path === '/panel/me') return next();

    const section = sectionForPath(req.path);
    if (!section) {
      return res.status(403).json({ error: 'این عملیات فقط برای سوپر ادمین مجاز است' });
    }
    const needed: SectionLevel = READ_METHODS.has(req.method.toUpperCase()) ? 'view' : 'edit';
    if (!hasGrant(profile.grants, section, needed)) {
      return res.status(403).json({
        error: `دسترسی ${needed === 'view' ? 'مشاهده' : 'ویرایش'} بخش «${PANEL_SECTIONS[section]}» برای شما فعال نشده است`,
      });
    }
    if (needed === 'edit' && (await targetsProtectedAccount(req))) {
      return res.status(403).json({ error: 'ویرایش حساب مدیران فقط برای سوپر ادمین مجاز است' });
    }
    return next();
  } catch (e) {
    console.error('subAdminGate error:', e);
    return res.status(500).json({ error: 'خطای سرور در بررسی دسترسی' });
  }
}

async function channelManagerGate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const row = await prisma.rolePermission.findUnique({ where: { roleName: ROLE_CHANNEL_MANAGER } });
    if (!(req.user?.panelAccess ?? row?.canLoginPanel ?? false)) {
      return res.status(403).json({ error: 'دسترسی شما به پنل مدیریت فعال نشده است' });
    }
    if (req.path === '/panel/me' || sectionForPath(req.path) === 'chat') return next();
    if (/^\/support-cases(\/|$)/i.test(req.path) && parseChatPermissions(row?.permissionsJson).privateChats) return next();
    return res.status(403).json({ error: 'این عملیات برای مسئول کانال مجاز نیست' });
  } catch (e) {
    console.error('channelManagerGate error:', e);
    return res.status(500).json({ error: 'خطای سرور در بررسی دسترسی' });
  }
}

/**
 * Same section check for routes that live outside the /admin router (e.g. /media, station access).
 * Super admin always passes; sub admins need the grant; every other role is rejected.
 */
export function requireSection(section: string, level: SectionLevel) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role?.toLowerCase();
    if (role === 'admin') return next();
    if (!isSubAdminRole(role)) {
      return res.status(403).json({ error: 'شما دسترسی لازم برای این عملیات را ندارید' });
    }
    try {
      const profile = await loadSubAdminProfile(req.user as any);
      if (profile.allowed && hasGrant(profile.grants, section, level)) return next();
      return res.status(403).json({ error: 'شما دسترسی لازم برای این عملیات را ندارید' });
    } catch (e) {
      console.error('requireSection error:', e);
      return res.status(500).json({ error: 'خطای سرور در بررسی دسترسی' });
    }
  };
}

/** GET /admin/panel/me: what the signed-in user may see, so the UI can hide the rest. */
export async function getPanelMe(req: AuthRequest, res: Response) {
  const role = req.user?.role || '';
  if (role.toLowerCase() === 'admin') {
    return res.json({
      role: 'admin',
      superAdmin: true,
      sections: Object.fromEntries(Object.keys(PANEL_SECTIONS).map(k => [k, 'edit'])),
    });
  }
  if (isSubAdminRole(role)) {
    const profile = await loadSubAdminProfile(req.user as any);
    return res.json({ role: 'sub_admin', superAdmin: false, sections: profile.grants });
  }
  if (isChannelManagerRole(role)) {
    const row = await prisma.rolePermission.findUnique({ where: { roleName: ROLE_CHANNEL_MANAGER } });
    return res.json({ role: ROLE_CHANNEL_MANAGER, superAdmin: false, sections: { chat: 'edit' }, chatPermissions: parseChatPermissions(row?.permissionsJson) });
  }
  // Mentors keep their fixed allowlist; the UI shows the mentor tabs only
  return res.json({ role, superAdmin: false, sections: {} });
}

export function restrictNonAdmins(req: AuthRequest, res: Response, next: NextFunction) {
  const role = req.user?.role?.toLowerCase();
  // Super admin: unrestricted, no database access here.
  if (role === 'admin') {
    return next();
  }

  if (isSubAdminRole(role)) {
    return subAdminGate(req, res, next);
  }

  if (isChannelManagerRole(role)) {
    return channelManagerGate(req, res, next);
  }

  // Defence in depth: only mentor roles get the allowlist; any other role is rejected here too
  if (role !== 'mentor' && role !== 'super_mentor') {
    return res.status(403).json({ error: 'این عملیات فقط برای مدیر سیستم مجاز است' });
  }

  // A super admin can switch a mentor's panel access off (User.panelAccess = false)
  if (req.user?.panelAccess === false) {
    return res.status(403).json({ error: 'دسترسی شما به پنل مدیریت غیرفعال شده است' });
  }

  const method = req.method.toUpperCase();
  const path = req.path;
  if (path === '/panel/me') {
    return next();
  }
  const allowed = MENTOR_ALLOWED.some(rule => rule.methods.includes(method) && rule.path.test(path));
  if (allowed) {
    return next();
  }

  return res.status(403).json({ error: 'این عملیات فقط برای مدیر سیستم مجاز است' });
}

// Exposed for tests
export const __MENTOR_ALLOWED_FOR_TESTS = MENTOR_ALLOWED;
