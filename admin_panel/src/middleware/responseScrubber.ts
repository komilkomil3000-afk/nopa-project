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

// Messages authored for users are Persian; raw exception text (Prisma, Node, libraries) is English.
const HAS_PERSIAN = /[\u0600-\u06FF]/;
const GENERIC_500 = 'خطای داخلی سرور. لطفاً دوباره تلاش کنید.';
const exposeErrors = () => process.env.EXPOSE_ERRORS === '1';

// 5xx responses must not leak internals (Prisma model/field names, query shapes, stack hints).
// The original text is logged server-side; authored Persian messages are kept as they are.
function hideInternalError(req: Request, res: Response, body: any): any {
  if (res.statusCode < 500 || exposeErrors()) return body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  let changed = false;
  const out: any = { ...body };
  for (const key of ['error', 'message', 'details']) {
    if (typeof out[key] === 'string' && !HAS_PERSIAN.test(out[key]) && out[key] !== 'Internal Server Error' && out[key] !== 'Internal server error') {
      console.error(`[5xx] ${req.method} ${req.originalUrl} -> ${key}: ${out[key]}`);
      out[key] = GENERIC_500;
      changed = true;
    }
  }
  return changed ? out : body;
}

export function scrubResponses(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);
  res.json = ((body?: any) => originalJson(hideInternalError(req, res, scrub(body)))) as any;
  next();
}

export const __scrubForTests = scrub;

export const __hideInternalErrorForTests = hideInternalError;
