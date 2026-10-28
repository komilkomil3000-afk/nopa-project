import { Request, Response, NextFunction } from 'express';

// Configuration constants
export const PHONE_COOLDOWN_SECONDS = 120; // 120 seconds cooldown per phone number
export const IP_HOURLY_LIMIT = 24; // Max 24 SMS requests per IP address per hour
export const IP_HOURLY_WINDOW_MS = 60 * 60 * 1000; // 1 hour window (3600s)
export const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes lockout (300s)

// Lightweight In-Memory Stores
const phoneCooldownMap = new Map<string, number>(); // normalized phone -> cooldown expiry timestamp (ms)
const ipRequestsMap = new Map<string, number[]>(); // IP -> list of request timestamps (ms)
const ipLockoutMap = new Map<string, number>(); // IP -> lockout expiry timestamp (ms)

/**
 * Periodic Memory Cleanup (Runs every 10 minutes)
 * Ensures zero memory leak in high-concurrency environments.
 */
setInterval(() => {
  const now = Date.now();
  const oneHourAgo = now - IP_HOURLY_WINDOW_MS;

  // 1. Clean IP request histories
  for (const [ip, timestamps] of ipRequestsMap.entries()) {
    const active = timestamps.filter((t) => t > oneHourAgo);
    if (active.length === 0) {
      ipRequestsMap.delete(ip);
    } else {
      ipRequestsMap.set(ip, active);
    }
  }

  // 2. Clean IP lockouts
  for (const [ip, lockUntil] of ipLockoutMap.entries()) {
    if (lockUntil <= now) {
      ipLockoutMap.delete(ip);
    }
  }

  // 3. Clean Phone cooldowns
  for (const [phone, nextAllowed] of phoneCooldownMap.entries()) {
    if (nextAllowed <= now) {
      phoneCooldownMap.delete(phone);
    }
  }
}, 10 * 60 * 1000).unref();

/**
 * Robust Client IP Extractor
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Normalize Persian/Arabic & international phone digits
 */
export function normalizePhone(phone: any): string {
  if (!phone) return '';
  const persianToEnglish = (str: string) => {
    const persianNumbers = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    for (let i = 0; i < 10; i++) {
      str = str.replace(new RegExp(persianNumbers[i], 'g'), i.toString());
      str = str.replace(new RegExp(arabicNumbers[i], 'g'), i.toString());
    }
    return str;
  };
  let cleanPhone = persianToEnglish(phone.toString()).replace(/\D/g, '');
  if (cleanPhone.startsWith('0098')) {
    cleanPhone = '0' + cleanPhone.slice(4);
  } else if (cleanPhone.startsWith('98')) {
    cleanPhone = '0' + cleanPhone.slice(2);
  } else if (cleanPhone.length === 10 && cleanPhone.startsWith('9')) {
    cleanPhone = '0' + cleanPhone;
  }
  return cleanPhone;
}

/**
 * Record a successfully dispatched SMS or phone verification attempt.
 * Must be called when the verification code is actually sent/approved.
 */
export function recordSmsDispatch(phone: string, ip: string): void {
  const now = Date.now();
  const cleanPhone = normalizePhone(phone);

  if (cleanPhone) {
    phoneCooldownMap.set(cleanPhone, now + PHONE_COOLDOWN_SECONDS * 1000);
  }

  if (ip) {
    const existing = ipRequestsMap.get(ip) || [];
    const oneHourAgo = now - IP_HOURLY_WINDOW_MS;
    const filtered = existing.filter((t) => t > oneHourAgo);
    filtered.push(now);
    ipRequestsMap.set(ip, filtered);
  }
}

/**
 * Helper to check if a phone is currently in cooldown (for programmatic inspection)
 */
export function getPhoneCooldownRemaining(phone: string): number {
  const cleanPhone = normalizePhone(phone);
  const expiry = phoneCooldownMap.get(cleanPhone);
  if (!expiry) return 0;
  const remaining = Math.ceil((expiry - Date.now()) / 1000);
  return remaining > 0 ? remaining : 0;
}

/**
 * Helper to check if an IP is currently locked out
 */
export function getIpLockoutRemaining(ip: string): number {
  const expiry = ipLockoutMap.get(ip);
  if (!expiry) return 0;
  const remaining = Math.ceil((expiry - Date.now()) / 1000);
  return remaining > 0 ? remaining : 0;
}

/**
 * Clear rate limit state (useful for testing or admin override)
 */
export function resetSmsRateLimits(phone?: string, ip?: string): void {
  if (phone) {
    phoneCooldownMap.delete(normalizePhone(phone));
  }
  if (ip) {
    ipRequestsMap.delete(ip);
    ipLockoutMap.delete(ip);
  }
}

/**
 * Comprehensive Bot Protection & SMS Rate Limiting Middleware
 * 1. Honeypot Trap: Checks for hidden field (e.g. website_source). If filled, returns dummy 200 OK.
 * 2. Temporary Lockout: Blocks IP for 5 minutes (300s) if rate limits were previously violated.
 * 3. IP Rate Limit: Max 24 requests per IP per hour. Triggers 5-minute lockout on breach.
 * 4. Phone Number Cooldown: 120 seconds between SMS dispatches for the same phone number.
 */
export function smsProtectionMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const clientIp = getClientIp(req);
    const now = Date.now();

    // =========================================================================
    // TASK 1: HONEYPOT TRAP
    // =========================================================================
    const honeypotFields = ['website_source', 'websiteSource', 'honeypot', 'bot_trap'];
    let isBotDetected = false;

    for (const field of honeypotFields) {
      if (req.body && req.body[field] !== undefined && req.body[field] !== null) {
        const val = req.body[field];
        if (typeof val === 'string' && val.trim().length > 0) {
          isBotDetected = true;
          break;
        } else if (typeof val !== 'string' && Boolean(val)) {
          isBotDetected = true;
          break;
        }
      }
    }

    if (isBotDetected) {
      console.warn(`🤖 [Honeypot Trap] Bot caught submitting hidden honeypot field from IP: ${clientIp}`);
      // Immediately return dummy 200 OK without executing downstream SMS logic or database writes
      return res.status(200).json({
        success: true,
        message: 'کد تایید ارسال شد',
        count: 1,
      });
    }

    // =========================================================================
    // TASK 4: TEMPORARY LOCKOUT CHECK (5 minutes = 300 seconds)
    // =========================================================================
    const lockUntil = ipLockoutMap.get(clientIp);
    if (lockUntil) {
      if (now < lockUntil) {
        const remainingLockoutSeconds = Math.ceil((lockUntil - now) / 1000);
        res.setHeader('Retry-After', remainingLockoutSeconds);
        return res.status(429).json({
          success: false,
          error: 'دسترسی شما به دلیل درخواست‌های بیش از حد مجاز موقتاً به مدت ۵ دقیقه مسدود شده است.',
          retryAfter: remainingLockoutSeconds,
          isLockedOut: true,
        });
      } else {
        // Lockout expired, clean up
        ipLockoutMap.delete(clientIp);
      }
    }

    // =========================================================================
    // TASK 3: IP RATE LIMIT (Max 24 SMS requests per IP per hour)
    // =========================================================================
    const ipTimestamps = ipRequestsMap.get(clientIp) || [];
    const oneHourAgo = now - IP_HOURLY_WINDOW_MS;
    const activeIpTimestamps = ipTimestamps.filter((t) => t > oneHourAgo);

    if (activeIpTimestamps.length >= IP_HOURLY_LIMIT) {
      // Trigger 5-minute temporary lockout immediately
      const newLockoutUntil = now + LOCKOUT_DURATION_MS;
      ipLockoutMap.set(clientIp, newLockoutUntil);
      const remainingLockoutSeconds = Math.ceil(LOCKOUT_DURATION_MS / 1000);

      console.warn(`🚨 [IP Rate Limit Exceeded] IP ${clientIp} made ${activeIpTimestamps.length} requests in 1 hour. Locked out for 5 minutes.`);
      res.setHeader('Retry-After', remainingLockoutSeconds);
      return res.status(429).json({
        success: false,
        error: 'شما به سقف مجاز ۲۴ درخواست پیامک در هر ساعت رسیده‌اید. دسترسی شما به مدت ۵ دقیقه مسدود شد.',
        retryAfter: remainingLockoutSeconds,
        isLockedOut: true,
      });
    }

    // Record this attempt for the IP
    activeIpTimestamps.push(now);
    ipRequestsMap.set(clientIp, activeIpTimestamps);

    // =========================================================================
    // TASK 2: PHONE NUMBER COOLDOWN (120 seconds)
    // =========================================================================
    const rawPhone = req.body?.phoneNumber || req.body?.phone || req.query?.phoneNumber;
    if (rawPhone) {
      const cleanPhone = normalizePhone(rawPhone);
      const cooldownUntil = phoneCooldownMap.get(cleanPhone);

      if (cooldownUntil && now < cooldownUntil) {
        const remainingSeconds = Math.ceil((cooldownUntil - now) / 1000);
        res.setHeader('Retry-After', remainingSeconds);
        return res.status(429).json({
          success: false,
          error: `لطفاً ${remainingSeconds} ثانیه دیگر دوباره تلاش کنید.`,
          retryAfter: remainingSeconds,
          cooldown: PHONE_COOLDOWN_SECONDS,
        });
      }
    }

    // All protection checks passed
    next();
  } catch (error) {
    console.error('Error in smsProtectionMiddleware (Fail-Safe bypassed):', error);
    // Fail-safe: Allow request to proceed if internal check fails
    next();
  }
}
