import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { logAdminAction } from './adminController';

const prisma = new PrismaClient();

// Get 1-on-1 direct messages
export const getDirectMessages = async (req: AuthRequest, res: Response) => {
  try {
    const { mentorId } = req.params;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const messages = await prisma.chatMessage.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: mentorId },
          { senderId: mentorId, receiverId: userId }
        ]
      },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true, role: true } },
        receiver: { select: { id: true, name: true, avatarUrl: true, role: true } }
      }
    });

    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get caravan group messages
export const getCaravanMessages = async (req: AuthRequest, res: Response) => {
  try {
    const { caravanId } = req.params;

    const messages = await prisma.chatMessage.findMany({
      where: { caravanId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true, role: true } }
      }
    });

    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Send a message (Direct or Group)
export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const senderId = req.user?.id;
    if (!senderId) return res.status(401).json({ error: 'Unauthorized' });

    const { receiverId, caravanId, messageText, fileUrl, fileType } = req.body;

    if (!messageText && !fileUrl) {
      return res.status(400).json({ error: 'Message text or file is required' });
    }

    const message = await prisma.chatMessage.create({
      data: {
        senderId,
        receiverId: receiverId || null,
        caravanId: caravanId || null,
        messageText: messageText || '',
        fileUrl: fileUrl || null,
        fileType: fileType || null
      },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true, role: true } }
      }
    });

    res.status(201).json({ message: 'پیام ارسال شد', data: message });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

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
