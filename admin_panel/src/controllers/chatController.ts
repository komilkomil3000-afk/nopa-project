import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { logAdminAction } from './adminController';


// --- ADMIN OVERSIGHT CONTROLLERS ---

// Get all chats (paginated) for Admin Oversight
export const getAllChatsAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const caravanId = (req.query.caravanId as string) || '';

    const skip = (page - 1) * limit;

    const whereClause: any = {};
    if (caravanId) {
      whereClause.caravanId = caravanId;
    }

    const [messages, totalCount] = await prisma.$transaction([
      prisma.chatMessage.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: { id: true, name: true, role: true } },
          receiver: { select: { id: true, name: true, role: true } },
          caravan: { select: { id: true, name: true } }
        }
      }),
      prisma.chatMessage.count({ where: whereClause })
    ]);

    res.json({
      messages,
      total: totalCount,
      page,
      pages: Math.ceil(totalCount / limit)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Delete/moderate a message
export const deleteMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const message = await prisma.chatMessage.delete({ where: { id } });

    await logAdminAction(
      req.user?.id || 'system',
      req.user?.phoneNumber || 'Admin',
      'DELETE_CHAT_MESSAGE',
      'ChatMessage',
      id,
      `حذف پیام (کاربر: ${message.senderId})`,
      req.ip || '127.0.0.1'
    );

    res.json({ message: 'پیام با موفقیت حذف شد' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
