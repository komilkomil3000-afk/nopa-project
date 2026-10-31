import prisma from '../config/db';
import {
  CONFIGURABLE_ROLES, DEFAULT_PANEL_LOGIN, DEFAULT_ROLE_PERMISSIONS, PERMISSION_KEYS,
  configKey, isValidKey, matches, rulesForKeys, Rule,
} from './permissions';
import { isSuperAdmin } from './roles';

export interface RoleConfig {
  canLoginPanel: boolean;
  permissions: string[];
  /** true when the super admin has not saved a custom list for this role yet */
  isDefault: boolean;
}

const TTL_MS = 15_000;
const cache = new Map<string, { at: number; cfg: RoleConfig; rules: Rule[] }>();

export function clearAccessCache() {
  cache.clear();
}

function parseKeys(json: string | null | undefined): string[] | null {
  if (!json) return null;
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((k: any) => typeof k === 'string' && isValidKey(k)) : null;
  } catch {
    return null;
  }
}

/** Stored configuration of a role bucket ('SUB_ADMIN' | 'mentor' | 'student'), with defaults filled in. */
export async function getRoleConfig(role?: string | null): Promise<RoleConfig & { rules: Rule[] }> {
  const key = configKey(role);
  if (key === 'admin') {
    return { canLoginPanel: true, permissions: PERMISSION_KEYS.slice(), isDefault: false, rules: [] };
  }
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return { ...hit.cfg, rules: hit.rules };

  let row: { canLoginPanel: boolean; permissionsJson: string | null } | null = null;
  try {
    row = await prisma.rolePermission.findUnique({
      where: { roleName: key },
      select: { canLoginPanel: true, permissionsJson: true },
    });
  } catch (e) {
    console.error('getRoleConfig error:', e);
  }
  const custom = parseKeys(row?.permissionsJson);
  const cfg: RoleConfig = {
    // No row (or old DB without the column) => the built-in default for that role
    canLoginPanel: row ? !!row.canLoginPanel : DEFAULT_PANEL_LOGIN[key],
    permissions: custom ?? DEFAULT_ROLE_PERMISSIONS[key as typeof CONFIGURABLE_ROLES[number]].slice(),
    isDefault: custom === null,
  };
  const rules = rulesForKeys(cfg.permissions);
  cache.set(key, { at: Date.now(), cfg, rules });
  return { ...cfg, rules };
}

/**
 * May this person use the admin panel?
 *   1. a per-user setting (true / false) wins
 *   2. otherwise the role default: super admin always, admin on, mentor / student off (editable)
 */
export async function canEnterPanel(role: string | null | undefined, userOverride: boolean | null | undefined): Promise<boolean> {
  if (userOverride === true || userOverride === false) return userOverride;
  if (isSuperAdmin(role)) return true;
  return (await getRoleConfig(role)).canLoginPanel;
}

export async function isRequestAllowed(role: string | null | undefined, method: string, path: string): Promise<boolean> {
  if (isSuperAdmin(role)) return true;
  const cfg = await getRoleConfig(role);
  return matches(cfg.rules, method, path);
}

/**
 * Only a super admin may change or act on an admin / super admin account (reset a password, block,
 * delete, edit ...). Anyone else holding e.g. "manage users" is stopped here. Returns an error
 * message, or null when the action may go ahead.
 */
export async function guardPrivilegedTarget(actorRole: string | null | undefined, targetId: string | null | undefined): Promise<string | null> {
  if (isSuperAdmin(actorRole) || !targetId) return null;
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { role: true } });
  if (target && isAnyAdminRole(target.role)) {
    return 'فقط سوپر ادمین می‌تواند حساب ادمین یا سوپر ادمین را تغییر دهد';
  }
  return null;
}

function isAnyAdminRole(role?: string | null) {
  const r = String(role || '').toLowerCase();
  return r === 'admin' || r === 'sub_admin';
}