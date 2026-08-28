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

export const createNews = async (req: Request, res: Response) => {
  try {
    const { title, subtitle, body, reporter, category, isPublished, targetAudience, publishDate } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    
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
        isPublished: isPublished !== undefined ? String(isPublished) === 'true' : true,
      },
    });
    res.status(201).json(article);
  } catch (error) {
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
    res.status(200).json(article);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteNews = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await (prisma as any).newsArticle.delete({ where: { id } });
    res.status(200).json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
