import { Request, Response } from 'express';
import prisma from '../config/db';

export const getNews = async (req: Request, res: Response) => {
  try {
    const news = await (prisma as any).newsArticle.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json(news);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAdminNews = async (req: Request, res: Response) => {
  try {
    const news = await (prisma as any).newsArticle.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json(news);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export async function syncNewsNotifications(article: any) {
  try {
    if (!article || !article.isPublished) return;
    
    const aud = (article.targetAudience || 'ALL').toUpperCase();
    let whereClause: any = { isDeleted: false };
    if (aud === 'STUDENTS') {
      whereClause.OR = [{ role: 'student' }, { role: 'admin' }];
    } else if (aud === 'MENTORS') {
      whereClause.OR = [{ role: 'mentor' }, { role: 'admin' }];
    } else if (aud === 'CARAVAN_LEADERS') {
      whereClause.OR = [
        { role: 'mentor' },
        { role: 'admin' },
        { caravansLed: { some: {} } }
      ];
    }
    
    const users = await prisma.user.findMany({
      where: whereClause,
      select: { id: true }
    });

    const notifTitle = `📢 ${article.title}`;
    const messageContent = article.subtitle ? `${article.subtitle}\n\n${article.body}` : article.body;

    for (const u of users) {
      const existing = await prisma.notification.findFirst({
        where: {
          userId: u.id,
          OR: [
            { title: notifTitle },
            { title: article.title }
          ]
        }
      });

      if (!existing) {
        await prisma.notification.create({
          data: {
            userId: u.id,
            title: notifTitle,
            message: messageContent || 'خبر جدیدی در تابلوی اعلانات جارچی منتشر شد.',
            type: 'news',
            createdAt: article.publishDate || article.createdAt || new Date(),
            isRead: false
          }
        });
      }
    }
  } catch (err) {
    console.error('Failed to sync news notifications:', err);
  }
}

export const createNews = async (req: Request, res: Response) => {
  try {
    const { title, subtitle, body, reporter, category, isPublished, targetAudience, publishDate } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const isPub = isPublished !== undefined ? String(isPublished) === 'true' : true;
    
    const article = await (prisma as any).newsArticle.create({
      data: {
        title,
        subtitle,
        body,
        imageUrl,
        reporter: reporter || 'نپا',
        category: category || 'general',
        targetAudience: targetAudience || 'ALL',
        publishDate: publishDate ? new Date(publishDate) : new Date(),
        isPublished: isPub,
      },
    });

    if (isPub) {
      await syncNewsNotifications(article);
    }

    res.status(201).json(article);
  } catch (error) {
    console.error('createNews error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateNews = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, subtitle, body, reporter, category, isPublished, targetAudience, publishDate } = req.body;
    
    const data: any = {};
    if (title) data.title = title;
    if (subtitle !== undefined) data.subtitle = subtitle;
    if (body) data.body = body;
    if (reporter !== undefined) data.reporter = reporter;
    if (category) data.category = category;
    if (targetAudience) data.targetAudience = targetAudience;
    if (publishDate) data.publishDate = new Date(publishDate);
    if (isPublished !== undefined) data.isPublished = String(isPublished) === 'true';
    if (req.file) data.imageUrl = `/uploads/${req.file.filename}`;

    const article = await (prisma as any).newsArticle.update({
      where: { id },
      data,
    });

    if (article.isPublished) {
      await syncNewsNotifications(article);
    }

    res.status(200).json(article);
  } catch (error) {
    console.error('updateNews error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteNews = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const article = await (prisma as any).newsArticle.findUnique({ where: { id } });
    if (article) {
      const notifTitle = `📢 ${article.title}`;
      await prisma.notification.deleteMany({
        where: {
          OR: [
            { title: notifTitle },
            { title: article.title }
          ]
        }
      });
    }
    await (prisma as any).newsArticle.delete({ where: { id } });
    res.status(200).json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('deleteNews error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
