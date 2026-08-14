import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/db';
import { logAdminAction } from './adminController';

export async function getSystemSetting(req: AuthRequest, res: Response) {
  try {
    const { key } = req.params;
    const setting = await prisma.systemSetting.findUnique({ where: { key } });
    res.json({ key, value: setting?.value || null });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function setSystemSetting(req: AuthRequest, res: Response) {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    if (!value) return res.status(400).json({ error: 'Value is required' });

    const setting = await prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    });
    
    await logAdminAction(req.user!.id, 'Admin', 'SET_SYSTEM_SETTING', 'SystemSetting', key, `Set ${key} to ${value}`, req.ip || '');
    res.json({ success: true, setting });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
