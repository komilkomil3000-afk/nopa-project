import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    phoneNumber: string;
    tokenVersion?: number;
  };
}

export function authenticateJWT(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'nopa_super_secret_jwt_key_2026';

    jwt.verify(token, secret, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ error: 'کاربر غیرمجاز است یا توکن منقضی شده است' });
      }
      const payload = decoded as { id: string; role: string; phoneNumber: string; tokenVersion?: number };
      
      try {
        const user = await prisma.user.findUnique({ where: { id: payload.id } });
        if (!user || user.blocked || (payload.tokenVersion !== undefined && user.tokenVersion !== payload.tokenVersion)) {
          return res.status(401).json({ error: 'نشست شما نامعتبر یا منقضی شده است' });
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

        req.user = payload;
        next();
      } catch (dbErr) {
        return res.status(500).json({ error: 'خطای سرور در اعتبارسنجی کاربر' });
      }
    });
  } else {
    res.status(401).json({ error: 'توکن اعتبارسنجی ارسال نشده است' });
  }
}

const UNIVERSAL_SUPER_ADMIN_PHONE = '09380346668';

export function authorizeRoles(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(403).json({ error: 'شما دسترسی لازم برای این عملیات را ندارید' });
    }

    if (req.user.phoneNumber === UNIVERSAL_SUPER_ADMIN_PHONE) {
      return next();
    }

    if (!roles.includes(req.user.role)) {
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

    if (req.user.phoneNumber === UNIVERSAL_SUPER_ADMIN_PHONE) {
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
