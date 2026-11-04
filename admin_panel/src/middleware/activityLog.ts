import { NextFunction, Request, Response } from 'express';
import { isAppClient } from '../services/liveActivity';
import { logUserEvent } from '../services/userLog';

// Adds the actions a person does in the mobile app through the API to their activity log (UserActivityLog,
// shown on the person's page in the panel), once the request has succeeded. Mounted on the /api/v1 router
// (routes/api.ts) before the routes; only requests of the app (X-Nopa-Client: app) are logged.

interface Rule { method: string; path: RegExp; type: string; area: string; label: string; throttleMs?: number }

const RULES: Rule[] = [
  { method: 'PATCH', path: /^\/users\/me\/avatar\/?$/, type: 'avatar', area: 'profile', label: 'تصویر پروفایل را تغییر داد' },
  { method: 'POST', path: /^\/users\/complete-profile\/?$/, type: 'profile', area: 'profile', label: 'مشخصات پروفایل را ثبت / ویرایش کرد' },
  { method: 'POST', path: /^\/auth\/change-password\/?$/, type: 'password', area: 'profile', label: 'رمز عبور را تغییر داد' },
  { method: 'POST', path: /^\/submissions\/?$/, type: 'challenge', area: 'challenges', label: 'پاسخ چالش فرستاد' },
  { method: 'POST', path: /^\/challenges\/[^/]+\/submit-quiz\/?$/, type: 'quiz', area: 'challenges', label: 'به آزمون چالش پاسخ داد' },
  { method: 'POST', path: /^\/lms\/sessions\/[^/]+\/submit-quiz\/?$/, type: 'quiz', area: 'station', label: 'به آزمونک پارت جلسه پاسخ داد' },
  { method: 'POST', path: /^\/support\/tickets\/?$/, type: 'ticket', area: 'other', label: 'تیکت پشتیبانی باز کرد' },
  { method: 'POST', path: /^\/support\/tickets\/[^/]+\/reply\/?$/, type: 'ticket', area: 'other', label: 'به تیکت پشتیبانی پاسخ داد' },
  { method: 'POST', path: /^\/caravans\/submit-exchange\/?$/, type: 'exchange', area: 'market', label: 'درخواست تبدیل دارایی ثبت کرد' },
  { method: 'POST', path: /^\/(evaluations\/mentor|mentors\/evaluate)\/?$/, type: 'rate', area: 'other', label: 'به راهبر امتیاز داد' },
  { method: 'POST', path: /^\/chat\/spaces\/[^/]+\/messages\/?$/, type: 'message', area: 'chat', label: 'در چت پیام فرستاد', throttleMs: 10 * 60 * 1000 },
  { method: 'POST', path: /^\/chat\/intergroup\/[^/]+\/entry\/?$/, type: 'challenge', area: 'chat', label: 'پاسخ چالش بین‌گروهی فرستاد' },
];

// one "sent a message" row per person per 10 minutes (the chat charts count the messages themselves)
const lastLogged = new Map<string, number>();

export function activityLogMiddleware(req: Request, res: Response, next: NextFunction) {
  const method = req.method;
  if (method === 'GET' || method === 'OPTIONS' || !isAppClient(req.headers)) return next();
  const path = req.path;
  const rule = RULES.find(r => r.method === method && r.path.test(path));
  if (!rule) return next();
  res.on('finish', () => {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId || res.statusCode >= 400) return;
    if (rule.throttleMs) {
      const key = `${userId}|${rule.type}`;
      const now = Date.now();
      if (now - (lastLogged.get(key) || 0) < rule.throttleMs) return;
      lastLogged.set(key, now);
      if (lastLogged.size > 20000) lastLogged.clear();
    }
    logUserEvent(userId, { type: rule.type, area: rule.area, label: rule.label });
  });
  next();
}
