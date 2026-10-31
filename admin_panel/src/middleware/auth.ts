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
    /** per-user panel login override (null/undefined = follow the role) */
    panelAccess?: boolean | null;
  };
}

export function authenticateJWT(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    let secret: string;
    try {
      secret = getJwtSecret();
    } catch (e) {
      console.error('JWT configuration error:', e);
      return res.status(500).json({ error: 'پیکربندی امنیتی سرور نامعتبر است' });
    }

    jwt.verify(token, secret, { algorithms: ['HS256'] }, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ error: 'کاربر غیرمجاز است یا توکن منقضی شده است' });
      }
      const payload = decoded as { id: string; role: string; phoneNumber: string; tokenVersion?: number };

        try {
          const user = await prisma.user.findUnique({ where: { id: payload.id } });
          const isAdmin = payload.role?.toLowerCase() === 'admin';

          if (!user || (payload.tokenVersion !== undefined && user.tokenVersion !== payload.tokenVersion)) {
            return res.status(401).json({ error: 'نشست شما نامعتبر یا منقضی شده است' });
          }

          if (!isAdmin) {
            if (user.blocked || user.isDeleted) {
              return res.status(401).json({ error: 'حساب شما مسدود یا حذف شده است' });
            }
            if (user.accountStatus === 'SUSPENDED') {
              return res.status(403).json({ error: 'حساب کاربری شما تعلیق شده است' });
            }
            if (user.suspendedUntil && new Date(user.suspendedUntil) > new Date()) {
              return res.status(403).json({ error: 'حساب کاربری شما موقتا مسدود شده است' });
            }
          }

        // Validate active session token in database
        const activeSession = await prisma.userSession.findUnique({ where: { token } });
        if (!activeSession) {
          return res.status(401).json({ error: 'نشست شما نامعتبر یا منقضی شده است' });
        }
        
        // Also check IP blacklist as an extra layer
        const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
        const blacklistedIp = await prisma.blacklist.findUnique({ where: { value: clientIp } });
        if (blacklistedIp) {
          return res.status(403).json({ error: 'دسترسی مسدود شده است (IP Blocked)' });
        }

        // The role always comes from the database, never from the token: when a super admin
        // changes someone's role (or demotes an admin) it applies on their very next request.
        req.user = { ...payload, role: user.role, panelAccess: (user as any).panelAccess ?? null };
        next();
      } catch (dbErr) {
        return res.status(500).json({ error: 'خطای سرور در اعتبارسنجی کاربر' });
      }
    });
  } else {
    res.status(401).json({ error: 'توکن اعتبارسنجی ارسال نشده است' });
  }
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