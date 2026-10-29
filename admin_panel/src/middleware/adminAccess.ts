import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

/**
 * Default-deny gate for the /admin router.
 *
 * - role "admin": unrestricted (same as before).
 * - mentor / SUPER_MENTOR: may only call the explicit allowlist below. Anything that
 *   mints currency, changes roles, deletes or exports users, rewrites RBAC, edits system
 *   settings or content, or broadcasts globally is admin-only simply because it is not listed.
 *
 * New admin routes are therefore admin-only until someone deliberately adds them here.
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
  { methods: GET, path: /^\/caravans(\/[^/]+)?$/i },
  { methods: GET, path: /^\/asset-conversions$/i },
  { methods: GET, path: /^\/tickets$/i },
  { methods: GET, path: /^\/challenges$/i },
  { methods: GET, path: /^\/submissions$/i },
  { methods: GET, path: /^\/analytics$/i },
  { methods: GET, path: /^\/leaderboard\/(assets|individuals|caravans)$/i },
  { methods: GET, path: /^\/rewards\/ledger$/i },
  { methods: GET, path: /^\/chat$/i },
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
  { methods: ['POST'], path: /^\/messages$/i },
  { methods: ['POST'], path: /^\/messages\/[^/]+\/reply$/i },
  { methods: ['POST'], path: /^\/caravans\/[^/]+\/broadcast$/i },
];

export function restrictNonAdmins(req: AuthRequest, res: Response, next: NextFunction) {
  const role = req.user?.role?.toLowerCase();
  if (role === 'admin') {
    return next();
  }

  // Defence in depth: only mentor roles get the allowlist; any other role is rejected here too
  if (role !== 'mentor' && role !== 'super_mentor') {
    return res.status(403).json({ error: 'این عملیات فقط برای مدیر سیستم مجاز است' });
  }

  const method = req.method.toUpperCase();
  const path = req.path;
  const allowed = MENTOR_ALLOWED.some(rule => rule.methods.includes(method) && rule.path.test(path));
  if (allowed) {
    return next();
  }

  return res.status(403).json({ error: 'این عملیات فقط برای مدیر سیستم مجاز است' });
}

// Exposed for tests
export const __MENTOR_ALLOWED_FOR_TESTS = MENTOR_ALLOWED;
