import prisma from '../config/db';

// Two pictures per person: User.avatarUrl is picked in the app (a bundled `asset:<key>` or an upload) and
// User.siteAvatarUrl is set from the admin panel. Responses to the panel (header `X-Nopa-Client: panel`) get
// `avatarUrl` = the site picture when there is one (else the app one), `appAvatarUrl` = the app picture, and every
// bundled `asset:<key>` turned into the copy served from public/images/avatars. The app's responses are untouched.

const ASSET_PREFIX = 'asset:';
const BUNDLED = new Set(['boy_1', 'boy_2', 'boy_3', 'boy_4', 'girl_1', 'girl_2', 'girl_3', 'girl_4', 'mentor_male', 'mentor_female']);

/** `asset:boy_2` -> `/images/avatars/boy_2.jpg`; anything else is returned as it is. */
export function resolveAvatarSrc(url: unknown): unknown {
  if (typeof url !== 'string' || !url.startsWith(ASSET_PREFIX)) return url;
  const key = url.slice(ASSET_PREFIX.length);
  return BUNDLED.has(key) ? `/images/avatars/${key}.jpg` : null;
}

// userId -> site picture, for the (few) people that have one; lets any response carry it without a select change
let cache: Map<string, string> | null = null;
let loading: Promise<void> | null = null;

export function loadSiteAvatars(): Promise<void> {
  if (cache) return Promise.resolve();
  if (!loading) {
    loading = prisma.user
      .findMany({ where: { siteAvatarUrl: { not: null } }, select: { id: true, siteAvatarUrl: true } })
      .then(rows => { cache = new Map(rows.map(r => [r.id, r.siteAvatarUrl as string])); })
      .catch(err => { console.error('site avatars load failed:', err); })
      .finally(() => { loading = null; });
  }
  return loading;
}

export function setCachedSiteAvatar(userId: string, url: string | null): void {
  if (!cache) return;
  if (url) cache.set(userId, url); else cache.delete(userId);
}

export function isPanelRequest(headers: Record<string, unknown>): boolean {
  return String(headers['x-nopa-client'] || '').toLowerCase() === 'panel';
}

/** Rewrites an already plain (scrubbed) response body for the panel, in place. */
export function applyPanelAvatars(value: any, depth = 0): any {
  if (value === null || typeof value !== 'object' || depth > 25) return value;
  if (Array.isArray(value)) { value.forEach(v => applyPanelAvatars(v, depth + 1)); return value; }
  if (value instanceof Date) return value;
  if ('avatarUrl' in value || 'siteAvatarUrl' in value) {
    const app = value.avatarUrl ?? null;
    const site = value.siteAvatarUrl || (typeof value.id === 'string' && cache?.get(value.id)) || null;
    value.appAvatarUrl = resolveAvatarSrc(app);
    value.siteAvatarUrl = site;
    value.avatarUrl = site || value.appAvatarUrl;
  }
  for (const key of Object.keys(value)) {
    const v = value[key];
    if (v && typeof v === 'object') applyPanelAvatars(v, depth + 1);
  }
  return value;
}
