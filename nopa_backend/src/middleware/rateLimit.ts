import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'تعداد درخواست‌های شما بیش از حد مجاز است. لطفا ۱۵ دقیقه دیگر تلاش کنید.'
  }
});
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 15 requests per windowMs for auth routes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'تعداد تلاش‌های ورود بیش از حد مجاز است. لطفا ۱۵ دقیقه دیگر تلاش کنید.'
  }
});
