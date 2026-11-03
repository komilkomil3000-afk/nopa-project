import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/db';

// Drafts of unfinished challenge / station forms. Every admin only ever sees their own rows.
const KINDS = new Set(['challenge', 'station']);
const KEY_RE = /^[\w-]{1,64}$/;
const MAX_DRAFT_BYTES = 90 * 1024;

function parseParams(req: AuthRequest, res: Response): { ownerId: string; kind: string; key?: string } | null {
  const ownerId = req.user?.id;
  const kind = String(req.params.kind || '');
  const key = req.params.key === undefined ? undefined : String(req.params.key);
  if (!ownerId) { res.status(401).json({ error: 'احراز هویت لازم است' }); return null; }
  if (!KINDS.has(kind)) { res.status(400).json({ error: 'نوع پیش‌نویس نامعتبر است' }); return null; }
  if (key !== undefined && !KEY_RE.test(key)) { res.status(400).json({ error: 'کلید پیش‌نویس نامعتبر است' }); return null; }
  return { ownerId, kind, key };
}

export const listDrafts = async (req: AuthRequest, res: Response) => {
  const p = parseParams(req, res);
  if (!p) return;
  try {
    const rows = await prisma.adminDraft.findMany({
      where: { ownerId: p.ownerId, kind: p.kind },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(rows.map(r => ({ key: r.key, data: r.data, savedAt: r.updatedAt.getTime() })));
  } catch (e) {
    console.error('listDrafts error:', e);
    res.status(500).json({ error: 'خطا در دریافت پیش‌نویس‌ها' });
  }
};

export const saveDraft = async (req: AuthRequest, res: Response) => {
  const p = parseParams(req, res);
  if (!p || !p.key) return;
  const data = (req.body || {}).data;
  if (data === undefined || data === null || typeof data !== 'object') {
    return res.status(400).json({ error: 'محتوای پیش‌نویس نامعتبر است' });
  }
  if (Buffer.byteLength(JSON.stringify(data)) > MAX_DRAFT_BYTES) {
    return res.status(413).json({ error: 'پیش‌نویس بیش از حد بزرگ است' });
  }
  try {
    const row = await prisma.adminDraft.upsert({
      where: { ownerId_kind_key: { ownerId: p.ownerId, kind: p.kind, key: p.key } },
      create: { ownerId: p.ownerId, kind: p.kind, key: p.key, data },
      update: { data },
    });
    res.json({ key: row.key, savedAt: row.updatedAt.getTime() });
  } catch (e) {
    console.error('saveDraft error:', e);
    res.status(500).json({ error: 'خطا در ذخیره پیش‌نویس' });
  }
};

export const deleteDraft = async (req: AuthRequest, res: Response) => {
  const p = parseParams(req, res);
  if (!p || !p.key) return;
  try {
    await prisma.adminDraft.deleteMany({ where: { ownerId: p.ownerId, kind: p.kind, key: p.key } });
    res.json({ ok: true });
  } catch (e) {
    console.error('deleteDraft error:', e);
    res.status(500).json({ error: 'خطا در حذف پیش‌نویس' });
  }
};
