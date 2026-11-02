import { Response } from 'express';
import prisma from '../../config/db';
import { AuthRequest } from '../../middleware/auth';
import { logAdminAction } from '../../controllers/adminController';
import { isChannelManagerRole, parseChatPermissions, ROLE_CHANNEL_MANAGER } from '../../utils/roles';
import { emitToSpace } from './realtime';
import { MESSAGE_INCLUDE, serializeMessage } from './service';

// Oversight from the panel. Private conversations are not reachable from here.
const SHARED_TYPES = ['announcements', 'public', 'mentors', 'caravan', 'challenges', 'media'];

export async function listManagedSpaces(_req: AuthRequest, res: Response) {
  try {
    const spaces = await prisma.chatSpace.findMany({
      where: { type: { in: SHARED_TYPES } },
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
      include: { caravan: { select: { name: true } } },
    });
    res.json(spaces.map(s => ({ id: s.id, type: s.type, title: s.title, caravanName: s.caravan?.name || null, messageCount: s.lastSeq })));
  } catch (error) {
    console.error('listManagedSpaces error:', error);
    res.status(500).json({ error: 'خطا در دریافت فضاها' });
  }
}

export async function listManagedMessages(req: AuthRequest, res: Response) {
  try {
    const space = await prisma.chatSpace.findFirst({ where: { id: req.params.id, type: { in: SHARED_TYPES } } });
    if (!space) return res.status(404).json({ error: 'فضا یافت نشد' });
    const rows = await prisma.chatMessage.findMany({ where: { spaceId: space.id }, orderBy: { seq: 'desc' }, take: 100, include: MESSAGE_INCLUDE });
    res.json(rows.map(serializeMessage));
  } catch (error) {
    console.error('listManagedMessages error:', error);
    res.status(500).json({ error: 'خطا در دریافت پیام‌ها' });
  }
}

export async function deleteManagedMessage(req: AuthRequest, res: Response) {
  try {
    if (isChannelManagerRole(req.user?.role)) {
      const row = await prisma.rolePermission.findUnique({ where: { roleName: ROLE_CHANNEL_MANAGER } });
      if (!parseChatPermissions(row?.permissionsJson).moderate) {
        return res.status(403).json({ error: 'دسترسی مدیریت پیام برای شما فعال نیست' });
      }
    }
    const message = await prisma.chatMessage.findFirst({ where: { id: req.params.id, space: { type: { in: SHARED_TYPES } } } });
    if (!message) return res.status(404).json({ error: 'پیام یافت نشد' });

    const row = await prisma.chatMessage.update({
      where: { id: message.id },
      data: { deletedAt: new Date(), deletedBy: req.user!.id, pinnedAt: null },
      include: MESSAGE_INCLUDE,
    });
    emitToSpace(row.spaceId, 'message:update', serializeMessage(row));
    await logAdminAction(req.user!.id, req.user!.phoneNumber || 'Admin', 'DELETE_CHAT_MESSAGE', 'ChatMessage', message.id, `پیام کاربر ${message.senderId}`, req.ip || '');
    res.json({ success: true });
  } catch (error) {
    console.error('deleteManagedMessage error:', error);
    res.status(500).json({ error: 'خطا در حذف پیام' });
  }
}
