// «صفحه لندینگ» (panel → تنظیمات): public site pages made in the panel.
//   Ways to make a page: upload an .html file or paste code (mode "html"), the section form builder (mode "builder"),
//   or start from a ready template / duplicate an existing page. Each save keeps the previous content as a version.
//   Public: the page marked «صفحه اصلی» is served at "/", every published page at "/p/<slug>"; while no page is
//   published as the home page, "/" keeps showing what it showed before.
//   Safety: pages with custom code run in a CSP sandbox (an opaque origin), so their scripts can never reach the admin
//   panel's login token stored on this same domain. Builder pages without custom code allow no scripts at all.
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { getJwtSecret } from '../config/secrets';
import { logAdminAction } from './adminController';
import { latestDownload } from './appReleaseController';
import { landingTemplates, renderBuilderPage, SECTION_TYPES } from '../services/landingRender';

const MAX_HTML = 2 * 1024 * 1024;
const KEEP_VERSIONS = 30;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,59}$/;
const RESERVED_SLUGS = new Set(['admin', 'api', 'uploads', 'fonts', 'p', 'landing-preview']);

// ---------------- rendering and caching ----------------

type PageRow = Awaited<ReturnType<typeof prisma.landingPage.findFirst>>;
const cache = new Map<string, { at: number; html: string; sandbox: boolean }>();
const CACHE_MS = 30_000;
export function clearLandingCache() { cache.clear(); }

function hasCustomCode(page: NonNullable<PageRow>): boolean {
  if (page.mode === 'html') return true;
  const sections = (page.builder as any)?.sections;
  return Array.isArray(sections) && sections.some((s: any) => s && s.type === 'html' && !s.hidden && String(s.html || '').trim());
}

async function renderPage(page: NonNullable<PageRow>): Promise<{ html: string; sandbox: boolean }> {
  if (page.mode === 'html') return { html: page.html || '', sandbox: true };
  const dl = await latestDownload().catch(() => ({ version: '', url: '' }));
  return { html: renderBuilderPage(page as any, { downloadUrl: dl.url, version: dl.version }), sandbox: hasCustomCode(page) };
}

function sendPage(res: Response, out: { html: string; sandbox: boolean }, opts: { preview?: boolean } = {}) {
  res.removeHeader('Content-Security-Policy');
  res.setHeader('Content-Security-Policy', out.sandbox
    // custom code: scripts run, but in an opaque origin (no access to this domain's storage, cookies or API session)
    ? "sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation allow-downloads allow-modals; default-src * data: blob: 'unsafe-inline' 'unsafe-eval'"
    // builder page: nothing but our own escaped markup and styles
    : "default-src 'self'; img-src * data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; media-src * data: blob:; script-src 'none'; frame-src *; base-uri 'none'; form-action 'self'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', opts.preview ? 'no-store' : 'public, max-age=60');
  if (opts.preview) res.setHeader('X-Robots-Tag', 'noindex');
  res.type('html').send(out.html);
}

async function serveCached(key: string, find: () => Promise<PageRow>, res: Response, next: NextFunction) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return sendPage(res, hit);
  const page = await find();
  if (!page) return next();
  const out = await renderPage(page);
  cache.set(key, { at: Date.now(), ...out });
  sendPage(res, out);
}

/** GET / -> the published home page; otherwise whatever "/" served before (next). */
export async function serveLandingHome(req: Request, res: Response, next: NextFunction) {
  try {
    await serveCached('home', () => prisma.landingPage.findFirst({ where: { isHome: true, isPublished: true } }), res, next);
  } catch (e) {
    console.error('serveLandingHome error:', e);
    next();
  }
}

/** GET /p/:slug -> a published page. */
export async function serveLandingSlug(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = String(req.params.slug || '').toLowerCase();
    if (!SLUG_RE.test(slug)) return next();
    await serveCached(`slug:${slug}`, () => prisma.landingPage.findFirst({ where: { slug, isPublished: true } }), res, next);
  } catch (e) {
    console.error('serveLandingSlug error:', e);
    next();
  }
}

/** GET /landing-preview/:id?t= -> any page (published or not) for a short-lived signed link from the panel. */
export async function serveLandingPreview(req: Request, res: Response) {
  try {
    const { id } = req.params;
    let ok = false;
    try {
      const p = jwt.verify(String(req.query.t || ''), getJwtSecret(), { algorithms: ['HS256'], audience: 'landing-preview' }) as { p?: string };
      ok = p.p === id;
    } catch { ok = false; }
    if (!ok) return res.status(403).type('text').send('لینک پیش‌نمایش منقضی شده است؛ از پنل دوباره باز کنید.');
    const page = await prisma.landingPage.findUnique({ where: { id } });
    if (!page) return res.status(404).type('text').send('صفحه یافت نشد');
    sendPage(res, await renderPage(page), { preview: true });
  } catch (e) {
    console.error('serveLandingPreview error:', e);
    res.status(500).type('text').send('خطا');
  }
}

// ---------------- panel ----------------

function summary(p: any) {
  return {
    id: p.id, title: p.title, slug: p.slug, mode: p.mode, isPublished: p.isPublished, isHome: p.isHome,
    metaTitle: p.metaTitle, metaDescription: p.metaDescription, ogImage: p.ogImage,
    sections: p.mode === 'builder' && Array.isArray(p.builder?.sections) ? p.builder.sections.length : null,
    size: p.mode === 'html' ? Buffer.byteLength(p.html || '', 'utf8') : null,
    url: p.isHome ? '/' : `/p/${p.slug}`,
    updatedAt: p.updatedAt, createdAt: p.createdAt,
  };
}

function cleanBuilder(v: any) {
  if (!v || typeof v !== 'object') return { theme: {}, sections: [] };
  const sections = Array.isArray(v.sections)
    ? v.sections.filter((s: any) => s && typeof s === 'object' && SECTION_TYPES[s.type]).slice(0, 60)
    : [];
  return { theme: v.theme && typeof v.theme === 'object' ? v.theme : {}, sections };
}

function randomSlug() {
  return 'page-' + Math.random().toString(36).slice(2, 8);
}

async function uniqueSlug(wanted: string, exceptId?: string): Promise<string | { error: string }> {
  const slug = String(wanted || '').trim().toLowerCase();
  if (!SLUG_RE.test(slug)) return { error: 'نشانی صفحه فقط حروف کوچک انگلیسی، عدد و خط تیره (حداکثر ۶۰ نویسه) است' };
  if (RESERVED_SLUGS.has(slug)) return { error: 'این نشانی رزرو شده است' };
  const taken = await prisma.landingPage.findFirst({ where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } });
  if (taken) return { error: 'صفحه‌ی دیگری با این نشانی وجود دارد' };
  return slug;
}

/** Reads the editable fields. Returns the Prisma data or an error message. */
function readFields(body: any): { data?: any; error?: string } {
  const data: any = {};
  if (body.title !== undefined) {
    const title = String(body.title || '').trim();
    if (!title) return { error: 'عنوان صفحه را وارد کنید' };
    data.title = title.slice(0, 120);
  }
  if (body.mode !== undefined) {
    if (!['builder', 'html'].includes(body.mode)) return { error: 'نوع ساخت صفحه معتبر نیست' };
    data.mode = body.mode;
  }
  if (body.html !== undefined) {
    const html = String(body.html ?? '');
    if (Buffer.byteLength(html, 'utf8') > MAX_HTML) return { error: 'حجم کد صفحه بیشتر از ۲ مگابایت است' };
    data.html = html;
  }
  if (body.builder !== undefined) data.builder = cleanBuilder(body.builder);
  for (const k of ['metaTitle', 'metaDescription', 'ogImage'] as const) {
    if (body[k] !== undefined) data[k] = String(body[k] || '').trim().slice(0, k === 'metaDescription' ? 300 : 300) || null;
  }
  if (body.isPublished !== undefined) data.isPublished = body.isPublished === true;
  return { data };
}

export async function adminListLanding(_req: AuthRequest, res: Response) {
  try {
    const pages = await prisma.landingPage.findMany({ orderBy: [{ isHome: 'desc' }, { updatedAt: 'desc' }] });
    res.json({
      pages: pages.map(summary),
      templates: landingTemplates().map(t => ({ key: t.key, title: t.title, description: t.description })),
      sectionTypes: Object.entries(SECTION_TYPES).map(([key, label]) => ({ key, label })),
    });
  } catch (e) {
    console.error('adminListLanding error:', e);
    res.status(500).json({ error: 'خطا در دریافت صفحات لندینگ' });
  }
}

export async function adminGetLanding(req: AuthRequest, res: Response) {
  try {
    const page = await prisma.landingPage.findUnique({ where: { id: req.params.id } });
    if (!page) return res.status(404).json({ error: 'صفحه یافت نشد' });
    const versions = await prisma.landingPageVersion.findMany({
      where: { pageId: page.id }, orderBy: { createdAt: 'desc' }, take: KEEP_VERSIONS,
      select: { id: true, mode: true, note: true, createdBy: true, createdAt: true },
    });
    const authors = await prisma.user.findMany({ where: { id: { in: versions.map(v => v.createdBy).filter(Boolean) as string[] } }, select: { id: true, name: true } });
    const nameOf = new Map(authors.map(a => [a.id, a.name]));
    res.json({ ...summary(page), html: page.html || '', builder: page.builder || { theme: {}, sections: [] }, versions: versions.map(v => ({ ...v, author: v.createdBy ? nameOf.get(v.createdBy) || '' : '' })) });
  } catch (e) {
    console.error('adminGetLanding error:', e);
    res.status(500).json({ error: 'خطا در دریافت صفحه' });
  }
}

export async function adminCreateLanding(req: AuthRequest, res: Response) {
  try {
    const body = req.body || {};
    const fields = readFields(body);
    if (fields.error) return res.status(400).json({ error: fields.error });
    const data = fields.data;
    if (!data.title) return res.status(400).json({ error: 'عنوان صفحه را وارد کنید' });
    data.mode = data.mode || 'builder';
    if (body.templateKey) {
      const t = landingTemplates().find(x => x.key === body.templateKey);
      if (!t) return res.status(400).json({ error: 'قالب یافت نشد' });
      data.mode = 'builder';
      data.builder = t.builder;
    }
    if (data.mode === 'builder' && !data.builder) data.builder = { theme: {}, sections: [] };
    const slug = await uniqueSlug(body.slug || randomSlug());
    if (typeof slug !== 'string') return res.status(400).json(slug);

    const page = await prisma.landingPage.create({ data: { ...data, slug, isPublished: false, isHome: false, updatedBy: req.user!.id } });
    clearLandingCache();
    await logAdminAction(req.user!.id, req.user?.phoneNumber || 'Admin', 'CREATE_LANDING_PAGE', 'LandingPage', page.id, `صفحه لندینگ: ${page.title}`, req.ip || '');
    res.status(201).json(summary(page));
  } catch (e) {
    console.error('adminCreateLanding error:', e);
    res.status(500).json({ error: 'خطا در ساخت صفحه' });
  }
}

export async function adminUpdateLanding(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const page = await prisma.landingPage.findUnique({ where: { id } });
    if (!page) return res.status(404).json({ error: 'صفحه یافت نشد' });
    const fields = readFields(req.body || {});
    if (fields.error) return res.status(400).json({ error: fields.error });
    const data = fields.data;
    if (req.body?.slug !== undefined && req.body.slug !== page.slug) {
      const slug = await uniqueSlug(req.body.slug, id);
      if (typeof slug !== 'string') return res.status(400).json(slug);
      data.slug = slug;
    }
    if (data.isPublished === false && page.isHome) data.isHome = false; // an unpublished page cannot stay the home page

    const contentChanged = (data.mode !== undefined && data.mode !== page.mode)
      || (data.html !== undefined && data.html !== (page.html || ''))
      || (data.builder !== undefined && JSON.stringify(data.builder) !== JSON.stringify(page.builder || null));
    const updated = await prisma.$transaction(async tx => {
      if (contentChanged) {
        // what was there before this save, so it can be restored
        await tx.landingPageVersion.create({ data: { pageId: id, mode: page.mode, html: page.html, builder: page.builder ?? undefined, note: String(req.body?.versionNote || '').slice(0, 120) || null, createdBy: page.updatedBy } });
        const old = await tx.landingPageVersion.findMany({ where: { pageId: id }, orderBy: { createdAt: 'desc' }, skip: KEEP_VERSIONS, select: { id: true } });
        if (old.length) await tx.landingPageVersion.deleteMany({ where: { id: { in: old.map(o => o.id) } } });
      }
      return tx.landingPage.update({ where: { id }, data: { ...data, updatedBy: req.user!.id } });
    });
    clearLandingCache();
    await logAdminAction(req.user!.id, req.user?.phoneNumber || 'Admin', 'UPDATE_LANDING_PAGE', 'LandingPage', id, `ویرایش صفحه لندینگ: ${updated.title}`, req.ip || '');
    res.json(summary(updated));
  } catch (e) {
    console.error('adminUpdateLanding error:', e);
    res.status(500).json({ error: 'خطا در ذخیره صفحه' });
  }
}

/** POST /admin/landing/:id/home {home: true|false} -> makes it the page served at "/" (publishing it), or stops that. */
export async function adminSetLandingHome(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const page = await prisma.landingPage.findUnique({ where: { id } });
    if (!page) return res.status(404).json({ error: 'صفحه یافت نشد' });
    const home = req.body?.home !== false;
    await prisma.$transaction([
      prisma.landingPage.updateMany({ where: { isHome: true, id: { not: id } }, data: { isHome: false } }),
      prisma.landingPage.update({ where: { id }, data: home ? { isHome: true, isPublished: true } : { isHome: false } }),
    ]);
    clearLandingCache();
    await logAdminAction(req.user!.id, req.user?.phoneNumber || 'Admin', 'SET_LANDING_HOME', 'LandingPage', id, `${home ? 'صفحه اصلی سایت شد' : 'از صفحه اصلی برداشته شد'}: ${page.title}`, req.ip || '');
    res.json({ success: true });
  } catch (e) {
    console.error('adminSetLandingHome error:', e);
    res.status(500).json({ error: 'خطا در تعیین صفحه اصلی' });
  }
}

export async function adminDuplicateLanding(req: AuthRequest, res: Response) {
  try {
    const page = await prisma.landingPage.findUnique({ where: { id: req.params.id } });
    if (!page) return res.status(404).json({ error: 'صفحه یافت نشد' });
    let slug = `${page.slug}-copy`.slice(0, 60);
    if (typeof (await uniqueSlug(slug)) !== 'string') slug = randomSlug();
    const copy = await prisma.landingPage.create({
      data: {
        title: `${page.title} (کپی)`, slug, mode: page.mode, html: page.html, builder: page.builder ?? undefined,
        metaTitle: page.metaTitle, metaDescription: page.metaDescription, ogImage: page.ogImage,
        isPublished: false, isHome: false, updatedBy: req.user!.id,
      },
    });
    res.status(201).json(summary(copy));
  } catch (e) {
    console.error('adminDuplicateLanding error:', e);
    res.status(500).json({ error: 'خطا در کپی صفحه' });
  }
}

export async function adminRestoreLandingVersion(req: AuthRequest, res: Response) {
  try {
    const { id, versionId } = req.params;
    const [page, version] = await Promise.all([
      prisma.landingPage.findUnique({ where: { id } }),
      prisma.landingPageVersion.findFirst({ where: { id: versionId, pageId: id } }),
    ]);
    if (!page || !version) return res.status(404).json({ error: 'نسخه یافت نشد' });
    await prisma.$transaction([
      // the current content becomes a version too, so a restore can itself be undone
      prisma.landingPageVersion.create({ data: { pageId: id, mode: page.mode, html: page.html, builder: page.builder ?? undefined, note: 'پیش از بازگردانی', createdBy: page.updatedBy } }),
      prisma.landingPage.update({ where: { id }, data: { mode: version.mode, html: version.html, builder: version.builder ?? undefined, updatedBy: req.user!.id } }),
    ]);
    clearLandingCache();
    await logAdminAction(req.user!.id, req.user?.phoneNumber || 'Admin', 'RESTORE_LANDING_PAGE', 'LandingPage', id, `بازگردانی نسخه صفحه لندینگ: ${page.title}`, req.ip || '');
    res.json({ success: true });
  } catch (e) {
    console.error('adminRestoreLandingVersion error:', e);
    res.status(500).json({ error: 'خطا در بازگردانی نسخه' });
  }
}

export async function adminDeleteLanding(req: AuthRequest, res: Response) {
  try {
    const page = await prisma.landingPage.findUnique({ where: { id: req.params.id } });
    if (!page) return res.status(404).json({ error: 'صفحه یافت نشد' });
    await prisma.landingPage.delete({ where: { id: page.id } });
    clearLandingCache();
    await logAdminAction(req.user!.id, req.user?.phoneNumber || 'Admin', 'DELETE_LANDING_PAGE', 'LandingPage', page.id, `حذف صفحه لندینگ: ${page.title}`, req.ip || '');
    res.json({ success: true });
  } catch (e) {
    console.error('adminDeleteLanding error:', e);
    res.status(500).json({ error: 'خطا در حذف صفحه' });
  }
}

/** GET /admin/landing/:id/preview-link -> a 15-minute link that shows the page as saved, published or not. */
export async function adminLandingPreviewLink(req: AuthRequest, res: Response) {
  const exists = await prisma.landingPage.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!exists) return res.status(404).json({ error: 'صفحه یافت نشد' });
  const t = jwt.sign({ p: exists.id }, getJwtSecret(), { algorithm: 'HS256', expiresIn: 15 * 60, audience: 'landing-preview' });
  res.json({ url: `/landing-preview/${exists.id}?t=${t}` });
}

/** POST /admin/landing/render {builder, title, ...} -> the HTML a builder page makes (to continue it as code). */
export async function adminRenderLanding(req: AuthRequest, res: Response) {
  try {
    const body = req.body || {};
    const dl = await latestDownload().catch(() => ({ version: '', url: '' }));
    const html = renderBuilderPage({
      title: String(body.title || 'نپا'), metaTitle: body.metaTitle || null, metaDescription: body.metaDescription || null,
      ogImage: body.ogImage || null, builder: cleanBuilder(body.builder),
    }, { downloadUrl: dl.url, version: dl.version });
    res.json({ html });
  } catch (e) {
    console.error('adminRenderLanding error:', e);
    res.status(500).json({ error: 'خطا در ساخت کد صفحه' });
  }
}
