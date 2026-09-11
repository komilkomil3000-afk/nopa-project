import { Request, Response, NextFunction } from 'express';
export declare const PHONE_COOLDOWN_SECONDS = 120;
export declare const IP_HOURLY_LIMIT = 24;
export declare const IP_HOURLY_WINDOW_MS: number;
export declare const LOCKOUT_DURATION_MS: number;
/**
 * Robust Client IP Extractor
 */
export declare function getClientIp(req: Request): string;
/**
 * Normalize Persian/Arabic & international phone digits
 */
export declare function normalizePhone(phone: any): string;
/**
 * Record a successfully dispatched SMS or phone verification attempt.
 * Must be called when the verification code is actually sent/approved.
 */
export declare function recordSmsDispatch(phone: string, ip: string): void;
/**
 * Helper to check if a phone is currently in cooldown (for programmatic inspection)
 */
export declare function getPhoneCooldownRemaining(phone: string): number;
/**
 * Helper to check if an IP is currently locked out
 */
export declare function getIpLockoutRemaining(ip: string): number;
/**
 * Clear rate limit state (useful for testing or admin override)
 */
export declare function resetSmsRateLimits(phone?: string, ip?: string): void;
/**
 * Comprehensive Bot Protection & SMS Rate Limiting Middleware
 * 1. Honeypot Trap: Checks for hidden field (e.g. website_source). If filled, returns dummy 200 OK.
 * 2. Temporary Lockout: Blocks IP for 5 minutes (300s) if rate limits were previously violated.
 * 3. IP Rate Limit: Max 24 requests per IP per hour. Triggers 5-minute lockout on breach.
 * 4. Phone Number Cooldown: 120 seconds between SMS dispatches for the same phone number.
 */
export declare function smsProtectionMiddleware(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
