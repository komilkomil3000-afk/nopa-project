import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/db';
import { logAdminAction } from './adminController';
import { uploadsDir } from './mediaController';

/**
 * The newest app release, announced to the app's «بررسی نسخه جدید» menu item.
 * Set from the panel (roles & security tab) and stored as JSON in SystemSetting under APP_RELEASE_KEY.
 * Until it is set once from the panel, the old env variables (APP_LATEST_VERSION, APP_DOWNLOAD_URL,
 * APP_RELEASE_NOTES split by "|") are used as a fallback.
 *
 * A release has one APK per CPU architecture (flutter build apk --split-per-abi, scripts/release_app.js):
 * `downloads` maps each ABI to its link, and the app picks the one of the phone. `downloadUrl` is the
 * all-in-one (universal) APK, optional; for apps older than the per-ABI check (which read only
 * downloadUrl) the public endpoint falls back to the arm64 / armv7 link.
 * APKs uploaded from the panel are kept in uploads/apk (served at /uploads/apk/..., as a download).
 */
const APP_RELEASE_KEY = 'APP_LATEST_RELEASE';
const VERSION_RE = /^\d{1,4}(\.\d{1,4}){0,3}(\+\d{1,9})?$/;

/** The architectures a release can carry, in the order a phone's list is matched against them. */
export const RELEASE_ABIS = ['arm64-v8a', 'armeabi-v7a', 'x86_64'] as const;
type Abi = (typeof RELEASE_ABIS)[number];
type Downloads = Partial<Record<Abi, string>>;

interface AppRelease {
  version: string;
  downloadUrl: string;
  downloads: Downloads;
  notes: string[];
  updatedAt: string | null;
}

function cleanDownloads(raw: unknown): Downloads {
  const out: Downloads = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const abi of RELEASE_ABIS) {
    const v = String((raw as Record<string, unknown>)[abi] ?? '').trim();
    if (v) out[abi] = v;
  }
  return out;
}

function fromEnv(): AppRelease {
  return {
    version: process.env.APP_LATEST_VERSION || '',
    downloadUrl: process.env.APP_DOWNLOAD_URL || '',
    downloads: {},
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
      downloads: cleanDownloads(v.downloads),
      notes: Array.isArray(v.notes) ? v.notes.map(String) : [],
      updatedAt: row.updatedAt.toISOString(),
      source: 'panel',
    };
  } catch {
    return { ...fromEnv(), source: 'env' };
  }
}

/** What an app that only knows one link should download: the universal APK, else the most common architecture. */
function fallbackUrl(r: AppRelease): string {
  return r.downloadUrl || r.downloads['arm64-v8a'] || r.downloads['armeabi-v7a'] || r.downloads['x86_64'] || '';
}

/** Public GET /api/v1/app/version — what the app compares its own version against. */
export async function getPublicAppVersion(_req: Request, res: Response) {
  let r: AppRelease;
  try {
    r = await readRelease();
  } catch {
    // never break the app's update check on a database hiccup
    r = fromEnv();
  }
  // downloadUrl: for old apps (one link). downloads + universalUrl: for apps that pick the file of the phone.
  res.json({ version: r.version, downloadUrl: fallbackUrl(r), downloads: r.downloads, universalUrl: r.downloadUrl, notes: r.notes });
}

/** GET /api/v1/admin/app-release (super admin) */
export async function getAppRelease(_req: AuthRequest, res: Response) {
  try {
    res.json(await readRelease());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

function badUrl(url: string): boolean {
  try {
    return !['http:', 'https:'].includes(new URL(url).protocol) || url.length > 1000;
  } catch {
    return true;
  }
}

/** PUT /api/v1/admin/app-release (super admin). An empty version stops announcing any update. */
export async function setAppRelease(req: AuthRequest, res: Response) {
  try {
    const version = String(req.body?.version ?? '').trim();
    const downloadUrl = String(req.body?.downloadUrl ?? '').trim();
    const downloads = cleanDownloads(req.body?.downloads);
    const rawNotes = req.body?.notes;
    const notes = (Array.isArray(rawNotes) ? rawNotes : String(rawNotes ?? '').split('\n'))
      .map((s: unknown) => String(s).trim())
      .filter(Boolean)
      .slice(0, 30)
      .map((s: string) => s.slice(0, 300));

    if (version && !VERSION_RE.test(version)) {
      return res.status(400).json({ error: 'شماره نسخه نامعتبر است (مثال: 1.2.0)' });
    }
    if (version && !downloadUrl && !Object.keys(downloads).length) {
      return res.status(400).json({ error: 'دست‌کم یک لینک دانلود (یکی از معماری‌ها یا نسخه‌ی کامل) لازم است' });
    }
    if (downloadUrl && badUrl(downloadUrl)) {
      return res.status(400).json({ error: 'لینک نسخه‌ی کامل باید یک آدرس http یا https معتبر باشد' });
    }
    for (const [abi, url] of Object.entries(downloads)) {
      if (badUrl(url as string)) return res.status(400).json({ error: `لینک ${abi} باید یک آدرس http یا https معتبر باشد` });
    }

    const value = JSON.stringify({ version, downloadUrl, downloads, notes });
    const row = await prisma.systemSetting.upsert({
      where: { key: APP_RELEASE_KEY },
      update: { value },
      create: { key: APP_RELEASE_KEY, value },
    });

    await logAdminAction(
      req.user!.id, 'Admin', 'SET_APP_RELEASE', 'SystemSetting', APP_RELEASE_KEY,
      version
        ? `Latest app version set to ${version} (${[downloadUrl && 'universal', ...Object.keys(downloads)].filter(Boolean).join(', ')})`
        : 'App update announcement cleared',
      req.ip || '',
    );
    res.json({ success: true, version, downloadUrl, downloads, notes, updatedAt: row.updatedAt.toISOString(), source: 'panel' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// ---------- APK upload (panel → uploads/apk) ----------

export const apkDir = path.join(uploadsDir, 'apk');
const UPLOAD_KINDS = new Set<string>([...RELEASE_ABIS, 'universal']);
/** Uploaded APKs no release points at any more are removed after this long (kept a while so «لغو» still works). */
const STALE_APK_MS = 30 * 24 * 60 * 60 * 1000;

export const apkUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(apkDir, { recursive: true });
      cb(null, apkDir);
    },
    // a fixed shape: nothing the client sends reaches the file name
    filename: (_req, _file, cb) => cb(null, `nopa-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.apk`),
  }),
  fileFilter: (_req, file, cb) => {
    if (path.extname(file.originalname || '').toLowerCase() !== '.apk') {
      const err: any = new Error('فقط فایل apk مجاز است');
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  },
  limits: { fileSize: 150 * 1024 * 1024, files: 1 },
});

/** Removes old APKs that the current release does not link to. */
async function pruneApks(keep: Set<string>) {
  let names: string[] = [];
  try { names = fs.readdirSync(apkDir); } catch { return; }
  const now = Date.now();
  for (const name of names) {
    if (!name.endsWith('.apk') || keep.has(name)) continue;
    const abs = path.join(apkDir, name);
    try {
      if (now - fs.statSync(abs).mtimeMs > STALE_APK_MS) fs.unlinkSync(abs);
    } catch { /* already gone */ }
  }
}

/**
 * POST /api/v1/admin/app-release/apk (super admin), multipart: `apk` (the file), `abi` (arm64-v8a | armeabi-v7a |
 * x86_64 | universal). Answers { url } (a path on this site); the panel puts it in the release form, which is
 * saved with PUT /app-release as usual.
 */
export async function uploadReleaseApk(req: AuthRequest, res: Response) {
  const file = (req as any).file as Express.Multer.File | undefined;
  try {
    const abi = String(req.body?.abi || '');
    if (!file) return res.status(400).json({ error: 'فایلی دریافت نشد' });
    if (!UPLOAD_KINDS.has(abi)) {
      fs.unlink(file.path, () => {});
      return res.status(400).json({ error: 'معماری نامعتبر است' });
    }
    // an APK is a zip: it starts with "PK"
    const head = Buffer.alloc(2);
    const fd = fs.openSync(file.path, 'r');
    try { fs.readSync(fd, head, 0, 2, 0); } finally { fs.closeSync(fd); }
    if (head.toString('latin1') !== 'PK') {
      fs.unlink(file.path, () => {});
      return res.status(400).json({ error: 'این فایل یک APK معتبر نیست' });
    }

    const current = await readRelease().catch(() => null);
    const keep = new Set<string>([file.filename]);
    if (current) [current.downloadUrl, ...Object.values(current.downloads)].forEach(u => { if (u) keep.add(path.basename(String(u))); });
    pruneApks(keep).catch(() => {});

    await logAdminAction(
      req.user!.id, 'Admin', 'UPLOAD_APP_APK', 'SystemSetting', APP_RELEASE_KEY,
      `APK uploaded for ${abi} (${Math.round(file.size / 1024 / 1024)} MB): ${file.filename}`,
      req.ip || '',
    );
    res.json({ url: `/uploads/apk/${file.filename}`, size: file.size, abi });
  } catch (error: any) {
    if (file) fs.unlink(file.path, () => {});
    res.status(500).json({ error: error.message });
  }
}
