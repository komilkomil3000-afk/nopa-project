import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { PANEL_DENIED_MESSAGE } from '../middleware/adminAccess';
import { canEnterPanel, clearAccessCache, getRoleConfig } from '../utils/access';
import {
  CONFIGURABLE_ROLES, DEFAULT_PANEL_LOGIN, DEFAULT_ROLE_PERMISSIONS, PERMISSION_KEYS, ROLE_LABELS_FA,
  catalogForClient, isValidKey, tabsForKeys,
} from '../utils/permissions';
import { isSuperAdmin } from '../utils/roles';
import { logAdminAction } from './adminController';

/**
 * GET /admin/me/access
 * What the signed-in person may do in the panel. The panel calls this right after login and refuses
 * to open (without ever showing the dashboard) when entry is not allowed.
 */
export async function getMyAccess(req: AuthRequest, res: Response) {
  try {
    const role = req.user?.role;
    if (!req.user) return res.status(401).json({ error: 'توکن اعتبارسنجی ارسال نشده است' });

    if (!(await canEnterPanel(role, req.user.panelAccess))) {
      return res.status(403).json({ error: PANEL_DENIED_MESSAGE });
    }

    if (isSuperAdmin(role)) {
      return res.json({ role, isSuper: true, permissions: PERMISSION_KEYS, tabs: null });
    }
    const cfg = await getRoleConfig(role);
    res.json({ role, isSuper: false, permissions: cfg.permissions, tabs: tabsForKeys(cfg.permissions) });
  } catch (error: any) {
    console.error('getMyAccess error:', error);
    res.status(500).json({ error: 'خطای سرور در بررسی دسترسی' });
  }
}

/** GET /admin/roles/matrix  (super admin only) */
export async function getAccessMatrix(req: AuthRequest, res: Response) {
  try {
    if (!isSuperAdmin(req.user?.role)) {
      return res.status(403).json({ error: 'فقط سوپر ادمین می‌تواند دسترسی‌ها را مشاهده یا ویرایش کند' });
    }
    const roles = [];
    for (const roleName of CONFIGURABLE_ROLES) {
      const cfg = await getRoleConfig(roleName);
      roles.push({
        roleName,
        label: ROLE_LABELS_FA[roleName],
        canLoginPanel: cfg.canLoginPanel,
        permissions: cfg.permissions,
        isDefault: cfg.isDefault,
        defaultPermissions: DEFAULT_ROLE_PERMISSIONS[roleName],
        defaultCanLoginPanel: DEFAULT_PANEL_LOGIN[roleName],
      });
    }
    res.json({ catalog: catalogForClient(), roles });
  } catch (error: any) {
    console.error('getAccessMatrix error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * PUT /admin/roles/matrix/:roleName  (super admin only)
 * body: { canLoginPanel?: boolean, permissions?: string[], reset?: boolean }
 */
export async function updateRoleAccess(req: AuthRequest, res: Response) {
  try {
    if (!isSuperAdmin(req.user?.role)) {
      return res.status(403).json({ error: 'فقط سوپر ادمین می‌تواند دسترسی‌ها را ویرایش کند' });
    }
    const roleName = req.params.roleName as typeof CONFIGURABLE_ROLES[number];
    if (!(CONFIGURABLE_ROLES as readonly string[]).includes(roleName)) {
      return res.status(400).json({ error: 'نقش نامعتبر است. دسترسی سوپر ادمین قابل تغییر نیست' });
    }

    const { reset } = req.body || {};
    let canLoginPanel: boolean;
    let permissionsJson: string | null;

    if (reset === true) {
      canLoginPanel = DEFAULT_PANEL_LOGIN[roleName];
      permissionsJson = null;
    } else {
      const { permissions } = req.body || {};
      if (typeof req.body?.canLoginPanel !== 'boolean' || !Array.isArray(permissions)) {
        return res.status(400).json({ error: 'اطلاعات ارسالی نامعتبر است' });
      }
      const bad = permissions.filter((k: any) => typeof k !== 'string' || !isValidKey(k));
      if (bad.length) {
        return res.status(400).json({ error: `کلید دسترسی نامعتبر: ${bad.join(', ')}` });
      }
      canLoginPanel = req.body.canLoginPanel;
      permissionsJson = JSON.stringify(Array.from(new Set<string>(permissions)));
    }

    await prisma.rolePermission.upsert({
      where: { roleName },
      update: { canLoginPanel, permissionsJson },
      create: { roleName, canLoginPanel, permissionsJson },
    });
    clearAccessCache();

    await logAdminAction(
      req.user?.id || 'system',
      req.user?.phoneNumber || 'Admin',
      'UPDATE_ROLE_ACCESS',
      'RolePermission',
      roleName,
      reset === true
        ? `بازگشت دسترسی‌های نقش ${ROLE_LABELS_FA[roleName]} به پیش‌فرض`
        : `ویرایش دسترسی‌های نقش ${ROLE_LABELS_FA[roleName]}: ورود به پنل ${canLoginPanel ? 'فعال' : 'غیرفعال'}، ${JSON.parse(permissionsJson as string).length} دسترسی`,
      req.ip || '127.0.0.1',
      req.user?.role || 'admin'
    );

    const cfg = await getRoleConfig(roleName);
    res.json({
      message: 'دسترسی‌های نقش ذخیره شد',
      role: { roleName, label: ROLE_LABELS_FA[roleName], canLoginPanel: cfg.canLoginPanel, permissions: cfg.permissions, isDefault: cfg.isDefault },
    });
  } catch (error: any) {
    console.error('updateRoleAccess error:', error);
    res.status(500).json({ error: error.message });
  }
}