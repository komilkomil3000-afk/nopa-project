import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { getTaxonomy, saveTaxonomy, TAXONOMY_KEYS } from '../services/challengeTaxonomy';
import { logAdminAction } from './adminController';

/** The three challenge categories with their names and explanations, in a fixed order. App and panel. */
export async function getChallengeTaxonomy(_req: AuthRequest, res: Response) {
  try {
    const t = await getTaxonomy();
    res.json(TAXONOMY_KEYS.map(k => t[k]));
  } catch (error) {
    console.error('getChallengeTaxonomy error:', error);
    res.status(500).json({ error: 'خطا در دریافت فرهنگ اصطلاحات' });
  }
}

/** Panel («فرهنگ اصطلاحات»): saves names and explanations. Keys and who creates each category cannot change. */
export async function updateChallengeTaxonomy(req: AuthRequest, res: Response) {
  try {
    const result = await saveTaxonomy(req.body);
    if ('error' in result) return res.status(400).json({ error: result.error });
    await logAdminAction(req.user!.id, (req.user as any).name || '', 'UPDATE_CHALLENGE_TAXONOMY', 'SystemSetting', 'challenge_taxonomy', 'فرهنگ اصطلاحات چالش‌ها', req.ip || '');
    res.json(TAXONOMY_KEYS.map(k => result.value[k]));
  } catch (error) {
    console.error('updateChallengeTaxonomy error:', error);
    res.status(500).json({ error: 'خطا در ذخیره‌ی فرهنگ اصطلاحات' });
  }
}
