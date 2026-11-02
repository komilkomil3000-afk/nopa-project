import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { Request } from 'express';
import { getJwtSecret } from '../config/secrets';

/**
 * Signed-in requests are counted per user, the rest per IP. A class on one school Wi-Fi, or many phones
 * behind one mobile carrier address, would otherwise share a single budget and lock each other out once
 * chat is in use. Only a token with a valid signature gets its own budget, so a made-up one cannot.
 */
function limiterKey(req: Request): string {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), getJwtSecret(), { algorithms: ['HS256'] }) as { id?: string };
      if (payload.id) return `user:${payload.id}`;
    } catch { /* expired or forged: counted by IP */ }
  }
  return `ip:${req.ip}`;
}

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // per signed-in user, or per IP for everything else
  keyGenerator: limiterKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'تعداد درخواست‌های شما بیش از حد مجاز است. لطفا ۱۵ دقیقه دیگر تلاش کنید.'
  }
});
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // Limit each IP to 60 requests per windowMs for auth routes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'تعداد درخواست‌های احراز هویت از این آدرس بیش از حد مجاز است. لطفا کمی بعد تلاش کنید.'
  }
});

export * from './smsProtection';

