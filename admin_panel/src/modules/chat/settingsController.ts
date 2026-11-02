import { Response } from 'express';
import prisma from '../../config/db';
import { AuthRequest } from '../../middleware/auth';
import { logAdminAction } from '../../controllers/adminController';
import { CHAT_MODES, ChatMode, getChatSettings, saveChatSettings } from '../../services/chatSettings';
import { CHAT_PERMISSION_LABELS, ChatPermissions, parseChatPermissions, ROLE_CHANNEL_MANAGER } from '../../utils/roles';
import { revalidateAllSockets } from './realtime';
import { backfillChallengeCards } from './topics';

async function loadRolePermissions(): Promise<ChatPermissions> {
  const row = await prisma.rolePermission.findUnique({ where: { roleName: ROLE_CHANNEL_MANAGER } });
  return parseChatPermissions(row?.permissionsJson);
}

export async function getChatAdminSettings(_req: AuthRequest, res: Response) {
  try {
    const [settings, caravans, permissions] = await Promise.all([
      getChatSettings(),
      prisma.caravan.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      loadRolePermissions(),
    ]);
    res.json({ ...settings, caravans, permissions, permissionLabels: CHAT_PERMISSION_LABELS });
  } catch (error) {
    console.error('getChatAdminSettings error:', error);
    res.status(500).json({ error: 'خطا در دریافت تنظیمات چت' });
  }
}

/** Body: { mode, pilotCaravanIds, permissions }. */
export async function updateChatAdminSettings(req: AuthRequest, res: Response) {
  try {
    const mode = req.body?.mode as ChatMode;
    if (!CHAT_MODES.includes(mode)) return res.status(400).json({ error: 'وضعیت چت نامعتبر است' });

    const requested: string[] = Array.isArray(req.body?.pilotCaravanIds) ? req.body.pilotCaravanIds.map(String) : [];
    const found = await prisma.caravan.findMany({ where: { id: { in: requested } }, select: { id: true } });
    if (found.length !== new Set(requested).size) return res.status(400).json({ error: 'کاروان انتخاب‌شده معتبر نیست' });
    if (mode === 'pilot' && requested.length === 0) return res.status(400).json({ error: 'برای حالت آزمایشی حداقل یک کاروان انتخاب کنید' });

    const permissions = parseChatPermissions(JSON.stringify({ chat: req.body?.permissions }));
    await saveChatSettings({ mode, pilotCaravanIds: requested });
    const permissionsJson = JSON.stringify({ chat: permissions });
    await prisma.rolePermission.upsert({
      where: { roleName: ROLE_CHANNEL_MANAGER },
      update: { permissionsJson },
      create: { roleName: ROLE_CHANNEL_MANAGER, canLoginPanel: true, permissionsJson },
    });

    await logAdminAction(
      req.user!.id, req.user!.phoneNumber || 'Admin', 'UPDATE_CHAT_SETTINGS', 'SystemSetting', 'chat',
      `حالت ${mode}، ${requested.length} کاروان آزمایشی، دسترسی‌ها: ${permissionsJson}`, req.ip || ''
    );
    await revalidateAllSockets();
    if (mode !== 'off') backfillChallengeCards().catch(e => console.error('backfillChallengeCards error:', e));
    res.json({ success: true });
  } catch (error) {
    console.error('updateChatAdminSettings error:', error);
    res.status(500).json({ error: 'خطا در ذخیره تنظیمات چت' });
  }
}
