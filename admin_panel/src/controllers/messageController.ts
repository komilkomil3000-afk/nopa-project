import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// User sends a message (escalation)
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { userId, category, message, priority } = req.body;
    
    if (!userId || !category || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const adminMessage = await prisma.adminMessage.create({
      data: {
        userId,
        category,
        message,
        priority: priority || 'Normal'
      }
    });

    res.status(201).json({ message: 'پیام شما با موفقیت به مدیر سیستم ارسال شد', data: adminMessage });
  } catch (error) {
    console.error('sendMessage Error:', error);
    res.status(500).json({ error: 'خطای سرور در ارسال پیام' });
  }
};

// Admin gets all messages
export const getAdminMessages = async (req: Request, res: Response) => {
  try {
    const messages = await prisma.adminMessage.findMany({
      include: {
        user: {
          select: { name: true, phoneNumber: true, role: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(messages);
  } catch (error) {
    console.error('getAdminMessages Error:', error);
    res.status(500).json({ error: 'خطای سرور' });
  }
};

// Admin replies to a message
export const replyToMessage = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { replyText, status } = req.body;

    const updated = await prisma.adminMessage.update({
      where: { id },
      data: {
        adminReply: replyText,
        status: status || 'Resolved'
      }
    });

    res.json({ message: 'پاسخ شما ثبت شد', data: updated });
  } catch (error) {
    console.error('replyToMessage Error:', error);
    res.status(500).json({ error: 'خطای سرور' });
  }
};
