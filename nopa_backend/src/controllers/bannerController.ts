import { Request, Response } from 'express';
import prisma from '../config/db';

export const getBanners = async (req: Request, res: Response) => {
  try {
    const { position } = req.query;
    const banners = await (prisma as any).banner.findMany({
      where: {
        isActive: true,
        ...(position ? { position: position as string } : {})
      },
      orderBy: { orderIndex: 'asc' },
    });
    res.status(200).json(banners);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAdminBanners = async (req: Request, res: Response) => {
  try {
    const banners = await (prisma as any).banner.findMany({
      orderBy: [
        { position: 'asc' },
        { orderIndex: 'asc' }
      ],
    });
    res.status(200).json(banners);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createBanner = async (req: Request, res: Response) => {
  try {
    const { title, targetRoute, position, isActive, orderIndex } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    
    if (!imageUrl) {
      return res.status(400).json({ error: 'Image is required for a banner' });
    }

    const banner = await (prisma as any).banner.create({
      data: {
        title,
        imageUrl,
        targetRoute: targetRoute || null,
        position: position || 'bazaar_top',
        isActive: isActive !== undefined ? String(isActive) === 'true' : true,
        orderIndex: orderIndex ? parseInt(orderIndex) : 0,
      },
    });
    res.status(201).json(banner);
  } catch (error) {
    console.error('Error creating banner:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateBanner = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, targetRoute, position, isActive, orderIndex } = req.body;
    
    const data: any = {};
    if (title) data.title = title;
    if (targetRoute !== undefined) data.targetRoute = targetRoute;
    if (position) data.position = position;
    if (isActive !== undefined) data.isActive = String(isActive) === 'true';
    if (orderIndex !== undefined) data.orderIndex = parseInt(orderIndex);
    if (req.file) data.imageUrl = `/uploads/${req.file.filename}`;

    const banner = await (prisma as any).banner.update({
      where: { id },
      data,
    });
    res.status(200).json(banner);
  } catch (error) {
    console.error('Error updating banner:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteBanner = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await (prisma as any).banner.delete({ where: { id } });
    res.status(200).json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
