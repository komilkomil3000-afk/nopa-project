import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';
import { getJwtSecret } from '../config/secrets';
import { channelManagerMayCall, isChannelManagerRole, isSupportRole, supportMayCall } from '../utils/roles';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    phoneNumber: string;
    tokenVersion?: number;
    panelAccess?: boolean | null;
  };
}

export type TokenCheck =
  | { ok: true; user: NonNullable<AuthRequest['user']> }
  | { ok: false; status: number; error: string };

/**
 * Runs every access-token check: signature, token version, account state, active session and IP
 * blacklist. Shared by the HTTP middleware and any non-HTTP entry point, such as a socket handshake.
 * A bad or expired token is a 401 so that clients know to refresh it.
 */
// Every request used to cost 3 sequential queries (user, session, IP blacklist). A successful verdict is
// kept for a few seconds per token. Writes to auth/admin/security routes clear it (see app.ts), and the
// TTL bounds the staleness of anything changed another way.
const AUTH_CACHE_TTL_MS = 10_000;
const AUTH_CACHE_MAX = 5000;
const authVerdicts = new Map<string, { at: number; ip: string; result: TokenCheck }>();
// Role permission rows change rarely (admin writes clear this cache too).
const permissionCache = new Map<string, { at: number; row: import('@prisma/client').RolePermission | null }>();
export function clearAuthCache() {
  authVerdicts.clear();
  permissionCache.clear();
}

export async function verifyAccessToken(token: string, clientIp: string): Promise<TokenCheck> {
  const cached = authVerdicts.get(token);
  if (cached && cached.ip === clientIp && Date.now() - cached.at < AUTH_CACHE_TTL_MS) return cached.result;
  const result = await verifyAccessTokenUncached(token, clientIp);
  // Only successes are cached: a failure is always re-checked.
  if (result.ok) {
    if (authVerdicts.size >= AUTH_CACHE_MAX) authVerdicts.clear();
    authVerdicts.set(token, { at: Date.now(), ip: clientIp, result });
  }
  return result;
}

async function verifyAccessTokenUncached(token: string, clientIp: string): Promise<TokenCheck> {
  let payload: { id: string; role: string; phoneNumber: string; tokenVersion?: number };
  try {
    payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as typeof payload;
  } catch (e) {
    if (e instanceof jwt.JsonWebTokenError) {
      return { ok: false, status: 401, error: 'کاربر غیرمجاز است یا توکن منقضی شده است' };
    }
    console.error('JWT configuration error:', e);
    return { ok: false, status: 500, error: 'پیکربندی امنیتی سرور نامعتبر است' };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { role: true, tokenVersion: true, blocked: true, isDeleted: true, accountStatus: true, suspendedUntil: true, panelAccess: true },
    });
    const isAdmin = String(user?.role || payload.role).toLowerCase() === 'admin';

    if (!user || (payload.tokenVersion !== undefined && user.tokenVersion !== payload.tokenVersion)) {
      return { ok: false, status: 401, error: 'نشست شما نامعتبر یا منقضی شده است' };
    }

    if (!isAdmin) {
      if (user.blocked || user.isDeleted) {
        return { ok: false, status: 401, error: 'حساب شما مسدود یا حذف شده است' };
      }
      if (user.accountStatus === 'SUSPENDED') {
        return { ok: false, status: 403, error: 'حساب کاربری شما تعلیق شده است' };
      }
      if (user.suspendedUntil && new Date(user.suspendedUntil) > new Date()) {
        return { ok: false, status: 403, error: 'حساب کاربری شما موقتا مسدود شده است' };
      }
    }

    // Validate active session token in database
    const activeSession = await prisma.userSession.findUnique({ where: { token } });
    if (!activeSession) {
      return { ok: false, status: 401, error: 'نشست شما نامعتبر یا منقضی شده است' };
    }

    // Also check IP blacklist as an extra layer
    const blacklistedIp = await prisma.blacklist.findUnique({ where: { value: clientIp } });
    if (blacklistedIp) {
      return { ok: false, status: 403, error: 'دسترسی مسدود شده است (IP Blocked)' };
    }

    // Use the live role from the database so a role change takes effect immediately
    return { ok: true, user: { ...payload, role: user.role, panelAccess: user.panelAccess } };
  } catch (dbErr) {
    return { ok: false, status: 500, error: 'خطای سرور در اعتبارسنجی کاربر' };
  }
}

export function authenticateJWT(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'توکن اعتبارسنجی ارسال نشده است' });
  }

  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  verifyAccessToken(authHeader.split(' ')[1], clientIp).then(result => {
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    const apiPath = req.originalUrl.split('?')[0].replace(/^\/api\/v1/, '');
    if ((isChannelManagerRole(result.user.role) && !channelManagerMayCall(apiPath)) || (isSupportRole(result.user.role) && !supportMayCall(apiPath))) {
      return res.status(403).json({ error: 'شما دسترسی لازم برای این عملیات را ندارید' });
    }
    req.user = result.user;
    next();
  });
}

export function authorizeRoles(...roles: string[]) {
  const lowerRoles = roles.map(r => r.toLowerCase());
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(403).json({ error: 'شما دسترسی لازم برای این عملیات را ندارید' });
    }

    if (req.user.role?.toLowerCase() === 'admin') {
      return next();
    }

    if (!req.user.role || !lowerRoles.includes(req.user.role.toLowerCase())) {
      return res.status(403).json({ error: 'شما دسترسی لازم برای این عملیات را ندارید' });
    }
    next();
  };
}

export function checkPermission(scope: keyof import('@prisma/client').RolePermission) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'شما دسترسی لازم برای این عملیات را ندارید' });
    }

    // Admins are authorised by role (verified against the DB in authenticateJWT),
    // never by a hard-coded phone number.
    if (req.user.role?.toLowerCase() === 'admin') {
      return next();
    }

    try {
      const roleName = req.user.role;
      let entry = permissionCache.get(roleName);
      if (!entry || Date.now() - entry.at >= AUTH_CACHE_TTL_MS) {
        entry = { at: Date.now(), row: await prisma.rolePermission.findUnique({ where: { roleName } }) };
        permissionCache.set(roleName, entry);
      }
      const permission = entry.row;

      if (!permission) {
         return res.status(403).json({ error: 'نقش کاربری شما نامعتبر است یا هیچ دسترسی تعریف نشده است' });
      }

      if (permission[scope] !== true) {
         return res.status(403).json({ error: 'شما دسترسی مجاز به این بخش را ندارید' });
      }

      next();
    } catch (e) {
      return res.status(500).json({ error: 'خطای سرور در بررسی دسترسی' });
    }
  };
}
