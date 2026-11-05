import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/db';
import { logAdminAction } from './adminController';

/**
 * The newest app release, announced to the app's «بررسی نسخه جدید» menu item.
 * Set from the panel (roles & security tab) and stored as JSON in SystemSetting under APP_RELEASE_KEY.
 * Until it is set once from the panel, the old env variables (APP_LATEST_VERSION, APP_DOWNLOAD_URL,
 * APP_RELEASE_NOTES split by "|") are used as a fallback.
 */
const APP_RELEASE_KEY = 'APP_LATEST_RELEASE';
const VERSION_RE = /^\d{1,4}(\.\d{1,4}){0,3}(\+\d{1,9})?$/;

interface AppRelease {
  version: string;
  downloadUrl: string;
  notes: string[];
  updatedAt: string | null;
}

function fromEnv(): AppRelease {
  return {
    version: process.env.APP_LATEST_VERSION || '',
    downloadUrl: process.env.APP_DOWNLOAD_URL || '',
    notes: (process.env.APP_RELEASE_NOTES || '').split('|').map(s => s.trim()).filter(Boolean),
    updatedAt: null,
  };
}

async function readRelease(): Promise<AppRelease & { source: 'panel' | 'env' }> {
  const row = await prisma.systemSetting.findUnique({ where: { key: APP_RELEASE_KEY } });
  if (!row) return { ...fromEnv(), source: 'env' };
  try {
    const v = JSON.parse(row.value) || {};
    return {
      version: String(v.version || ''),
      downloadUrl: String(v.downloadUrl || ''),
      notes: Array.isArray(v.notes) ? v.notes.map(String) : [],
      updatedAt: row.updatedAt.toISOString(),
      source: 'panel',
    };
  } catch {
    return { ...fromEnv(), source: 'env' };
  }
}

/** Public GET /api/v1/app/version — what the app compares its own version against. */
export async function getPublicAppVersion(_req: Request, res: Response) {
  try {
    const r = await readRelease();
    res.json({ version: r.version, downloadUrl: r.downloadUrl, notes: r.notes });
  } catch {
    // never break the app's update check on a database hiccup
    const r = fromEnv();
    res.json({ version: r.version, downloadUrl: r.downloadUrl, notes: r.notes });
  }
}

/** GET /api/v1/admin/app-release (super admin) */
export async function getAppRelease(_req: AuthRequest, res: Response) {
  try {
    res.json(await readRelease());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

/** PUT /api/v1/admin/app-release (super admin). An empty version stops announcing any update. */
export async function setAppRelease(req: AuthRequest, res: Response) {
  try {
    const version = String(req.body?.version ?? '').trim();
    const downloadUrl = String(req.body?.downloadUrl ?? '').trim();
    const rawNotes = req.body?.notes;
    const notes = (Array.isArray(rawNotes) ? rawNotes : String(rawNotes ?? '').split('\n'))
      .map((s: unknown) => String(s).trim())
      .filter(Boolean)
      .slice(0, 30)
      .map((s: string) => s.slice(0, 300));

    if (version && !VERSION_RE.test(version)) {
      return res.status(400).json({ error: 'شماره نسخه نامعتبر است (مثال: 1.2.0)' });
    }
    if (version && !downloadUrl) {
      return res.status(400).json({ error: 'لینک دانلود الزامی است' });
    }
    if (downloadUrl) {
      let ok = false;
      try { ok = ['http:', 'https:'].includes(new URL(downloadUrl).protocol); } catch { ok = false; }
      if (!ok || downloadUrl.length > 1000) return res.status(400).json({ error: 'لینک دانلود باید یک آدرس http یا https معتبر باشد' });
    }

    const value = JSON.stringify({ version, downloadUrl, notes });
    const row = await prisma.systemSetting.upsert({
      where: { key: APP_RELEASE_KEY },
      update: { value },
      create: { key: APP_RELEASE_KEY, value },
    });

    await logAdminAction(
      req.user!.id, 'Admin', 'SET_APP_RELEASE', 'SystemSetting', APP_RELEASE_KEY,
      version ? `Latest app version set to ${version} (${downloadUrl})` : 'App update announcement cleared',
      req.ip || '',
    );
    res.json({ success: true, version, downloadUrl, notes, updatedAt: row.updatedAt.toISOString(), source: 'panel' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
