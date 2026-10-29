import { Request, Response, NextFunction } from 'express';

// Safety net: no API response may ever contain credential material, whatever a controller
// forgets to `select`. Controllers should still use explicit `select` lists.
const FORBIDDEN_KEYS = new Set(['passwordHash', 'tokenVersion']);

function scrub(value: any, depth = 0): any {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(v => scrub(v, depth + 1));
  if (depth > 25) return value;
  if (typeof value.toJSON === 'function') return scrub(value.toJSON(), depth + 1);
  const out: any = {};
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    out[key] = scrub(value[key], depth + 1);
  }
  return out;
}

export function scrubResponses(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);
  res.json = ((body?: any) => originalJson(scrub(body))) as any;
  next();
}

export const __scrubForTests = scrub;
