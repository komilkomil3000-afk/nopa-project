import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { DEFAULT_ASSET_NAMES, getAssetNames, invalidateAssetNames } from '../utils/assetNames';

const ORDER = Object.keys(DEFAULT_ASSET_NAMES);

export async function listAssetTypes(_req: AuthRequest, res: Response) {
  try {
    const names = await getAssetNames();
    res.json(ORDER.map((key, i) => ({ key, nameFa: names[key], sortOrder: i })));
  } catch (error) {
    console.error('listAssetTypes error:', error);
    res.status(500).json({ error: 'خطا در دریافت نام دارایی‌ها' });
  }
}

export async function updateAssetType(req: AuthRequest, res: Response) {
  try {
    const { key } = req.params;
    const nameFa = String(req.body?.nameFa ?? '').trim();
    if (!ORDER.includes(key)) {
      return res.status(404).json({ error: 'نوع دارایی یافت نشد' });
    }
    if (!nameFa || nameFa.length > 30) {
      return res.status(400).json({ error: 'نام دارایی باید بین ۱ تا ۳۰ نویسه باشد' });
    }
    const row = await prisma.assetType.upsert({
      where: { key },
      update: { nameFa },
      create: { key, nameFa, sortOrder: ORDER.indexOf(key) },
    });
    invalidateAssetNames();
    res.json(row);
  } catch (error) {
    console.error('updateAssetType error:', error);
    res.status(500).json({ error: 'خطا در ذخیره‌ی نام دارایی' });
  }
}
