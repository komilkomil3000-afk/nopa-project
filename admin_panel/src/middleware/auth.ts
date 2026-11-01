import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';
import { getJwtSecret } from '../config/secrets';

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
export async function verifyAccessToken(token: string, clientIp: string): Promise<TokenCheck> {
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
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
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
      const permission = await prisma.rolePermission.findUnique({
        where: { roleName: req.user.role }
      });
      
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
