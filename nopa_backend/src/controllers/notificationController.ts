import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/db';

export async function getNotifications(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'کاربر احراز هویت نشده است' });
    }

    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });

    const unreadCount = notifications.filter(n => !n.isRead).length;

    res.json({
      unreadCount,
      notifications
    });
  } catch (error) {
    console.error('getNotifications error:', error);
    res.status(500).json({ error: 'خطایی در دریافت لیست اعلان‌ها رخ داد' });
  }
}

export async function sendSystemNotification(userId: string, title: string, message: string, type: string = 'info') {
  try {
    await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type
      }
    });
  } catch (error) {
    console.error('Failed to dispatch system notification:', error);
  }
}


export async function markNotificationAsRead(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'کاربر احراز هویت نشده است' });
    }

    const { id } = req.params;

    const notification = await prisma.notification.findUnique({
      where: { id }
    });

    if (!notification || notification.userId !== req.user.id) {
      return res.status(404).json({ error: 'اعلان مورد نظر یافت نشد' });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });

    res.json(updated);
  } catch (error) {
    console.error('markNotificationAsRead error:', error);
    res.status(500).json({ error: 'خطایی در به‌روزرسانی وضعیت اعلان رخ داد' });
  }
}

export async function broadcastNotification(req: AuthRequest, res: Response) {
  try {
    const { targetAudience, channel, titleTpl, messageTpl, caravanId } = req.body;
    
    let users: any[] = [];
    if (targetAudience === 'all') {
      users = await prisma.user.findMany();
    } else if (targetAudience === 'mentors') {
      users = await prisma.user.findMany({ where: { role: 'mentor' } });
    } else if (targetAudience === 'caravan' && caravanId) {
      users = await prisma.user.findMany({ where: { caravanId } });
    }
    
    // Fetch Overrides
    const overrides = await prisma.channelOverride.findMany();
    const isChannelEnabled = (ch: string) => {
      const ov = overrides.find(o => o.channel === ch);
      return ov ? ov.isEnabled : true;
    };
    
    // Process templates and send
    let successCount = 0;
    for (const user of users) {
      const title = titleTpl.replace('{user_name}', user.name).replace('{zarik_balance}', user.zarikBalance.toString());
      const message = messageTpl.replace('{user_name}', user.name).replace('{zarik_balance}', user.zarikBalance.toString());
      
      if ((channel === 'in_app' || channel === 'all') && isChannelEnabled('in_app')) {
        await prisma.notification.create({
          data: {
            userId: user.id,
            title,
            message,
            type: 'alert'
          }
        });
      }
      
      if ((channel === 'sms' || channel === 'all') && isChannelEnabled('sms')) {
        // Mock SMS provider
        console.log(`[SMS MOCK] Sending SMS to ${user.phoneNumber}: ${message}`);
      }
      
      if ((channel === 'email' || channel === 'all') && isChannelEnabled('email')) {
        // Mock Email provider
        console.log(`[EMAIL MOCK] Sending Email to ${user.name}: ${title} - ${message}`);
      }
      successCount++;
    }
    
    // Log the broadcast
    await prisma.notificationLog.create({
      data: {
        channel,
        targetAudience: targetAudience + (caravanId ? `:${caravanId}` : ''),
        status: 'success',
      }
    });
    
    res.json({ message: `ارسال پیام با موفقیت به ${successCount} کاربر انجام شد.` });
  } catch (error: any) {
    await prisma.notificationLog.create({
      data: {
        channel: req.body.channel || 'unknown',
        targetAudience: req.body.targetAudience || 'unknown',
        status: 'failed',
        error: error.message
      }
    });
    res.status(500).json({ error: error.message });
  }
}

// ---- TEMPLATES ----
export async function getTemplates(req: AuthRequest, res: Response) {
  try {
    const templates = await prisma.notificationTemplate.findMany();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
}

export async function createTemplate(req: AuthRequest, res: Response) {
  try {
    const { name, titleTpl, messageTpl, channel } = req.body;
    const template = await prisma.notificationTemplate.create({
      data: { name, titleTpl, messageTpl, channel }
    });
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create template' });
  }
}

// ---- OVERRIDES & LOGS ----
export async function getOverrides(req: AuthRequest, res: Response) {
  try {
    const overrides = await prisma.channelOverride.findMany();
    res.json(overrides);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch overrides' });
  }
}

export async function toggleOverride(req: AuthRequest, res: Response) {
  try {
    const { channel, isEnabled } = req.body;
    const override = await prisma.channelOverride.upsert({
      where: { channel },
      update: { isEnabled },
      create: { channel, isEnabled }
    });
    res.json(override);
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle override' });
  }
}

export async function getLogs(req: AuthRequest, res: Response) {
  try {
    const logs = await prisma.notificationLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
}
