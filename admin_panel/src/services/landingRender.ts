// Renders a landing page made with the panel's form builder (LandingPage.mode = "builder") into one HTML document.
// Every value is escaped; only a "html" section (custom code block) is inserted as written.
// The builder JSON: { theme: {...}, sections: [{ id, type, ...fields }] }. List fields are arrays of objects.

export interface LandingTheme {
  primary?: string; background?: string; surface?: string; text?: string; accent?: string; radius?: number;
}
export interface LandingSection { id?: string; type: string; hidden?: boolean; [key: string]: any }
export interface LandingBuilder { theme?: LandingTheme; sections?: LandingSection[] }

export const SECTION_TYPES: Record<string, string> = {
  hero: 'سربرگ اصلی',
  features: 'ویژگی‌ها',
  stats: 'آمار و اعداد',
  imageText: 'تصویر و متن',
  gallery: 'گالری تصاویر',
  download: 'دانلود اپلیکیشن',
  faq: 'پرسش‌های پرتکرار',
  cta: 'دعوت به اقدام',
  contact: 'تماس با ما',
  html: 'کد دلخواه',
  footer: 'پانویس',
};

const DEFAULT_THEME: Required<LandingTheme> = {
  primary: '#7c6cf2', background: '#14122b', surface: '#221f3d', text: '#f3f1ff', accent: '#ffd580', radius: 20,
};

const esc = (v: unknown) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
/** Multi-line text: escaped, line breaks kept. */
const para = (v: unknown) => esc(v).replace(/\r?\n/g, '<br>');
/** Links: http(s), relative, mailto/tel and in-page anchors only. */
const safeUrl = (v: unknown) => {
  const s = String(v ?? '').trim();
  return /^(https?:\/\/|\/|#|mailto:|tel:)/i.test(s) ? esc(s) : '';
};
const color = (v: unknown, fallback: string) => (/^#[0-9a-f]{3,8}$/i.test(String(v || '').trim()) ? String(v).trim() : fallback);
const list = (v: unknown): any[] => (Array.isArray(v) ? v.filter(x => x && typeof x === 'object') : []);

function button(text: unknown, url: unknown, kind: 'primary' | 'ghost' = 'primary') {
  const href = safeUrl(url);
  return text && href ? `<a class="btn btn-${kind}" href="${href}">${esc(text)}</a>` : '';
}

function section(s: LandingSection, ctx: { downloadUrl: string; version: string }): string {
  const id = s.anchor ? ` id="${esc(String(s.anchor).replace(/[^\w-]/g, ''))}"` : '';
  const head = (s.title ? `<h2>${esc(s.title)}</h2>` : '') + (s.subtitle ? `<p class="sub">${para(s.subtitle)}</p>` : '');
  switch (s.type) {
    case 'hero':
      return `<header class="hero"${id}><div class="wrap hero-grid">
        <div class="hero-text">
          ${s.badge ? `<span class="badge">${esc(s.badge)}</span>` : ''}
          <h1>${esc(s.title)}</h1>
          ${s.subtitle ? `<p class="lead">${para(s.subtitle)}</p>` : ''}
          <div class="actions">${button(s.buttonText, s.buttonUrl)}${button(s.secondaryText, s.secondaryUrl, 'ghost')}</div>
        </div>
        ${safeUrl(s.imageUrl) ? `<div class="hero-img"><img src="${safeUrl(s.imageUrl)}" alt="${esc(s.title)}"></div>` : ''}
      </div></header>`;
    case 'features':
      return `<section class="block"${id}><div class="wrap">${head}<div class="cards">${list(s.items).map(i => `
        <div class="card">${i.icon ? `<div class="icon">${esc(i.icon)}</div>` : ''}<h3>${esc(i.title)}</h3><p>${para(i.text)}</p></div>`).join('')}</div></div></section>`;
    case 'stats':
      return `<section class="block"${id}><div class="wrap">${head}<div class="stats">${list(s.items).map(i => `
        <div class="stat"><strong>${esc(i.value)}</strong><span>${esc(i.label)}</span></div>`).join('')}</div></div></section>`;
    case 'imageText':
      return `<section class="block"${id}><div class="wrap split${s.reverse ? ' reverse' : ''}">
        <div>${s.title ? `<h2>${esc(s.title)}</h2>` : ''}<p>${para(s.text)}</p><div class="actions">${button(s.buttonText, s.buttonUrl)}</div></div>
        ${safeUrl(s.imageUrl) ? `<img class="split-img" src="${safeUrl(s.imageUrl)}" alt="${esc(s.title)}">` : '<div></div>'}
      </div></section>`;
    case 'gallery':
      return `<section class="block"${id}><div class="wrap">${head}<div class="gallery">${list(s.items).filter(i => safeUrl(i.url)).map(i => `
        <figure><img src="${safeUrl(i.url)}" alt="${esc(i.caption)}" loading="lazy">${i.caption ? `<figcaption>${esc(i.caption)}</figcaption>` : ''}</figure>`).join('')}</div></div></section>`;
    case 'download': {
      const url = safeUrl(s.url) || safeUrl(ctx.downloadUrl);
      return `<section class="block"${id}><div class="wrap panel center">${head || '<h2>دانلود اپلیکیشن</h2>'}
        ${s.text ? `<p>${para(s.text)}</p>` : ''}
        ${url ? `<a class="btn btn-primary btn-lg" href="${url}">${esc(s.buttonText || 'دانلود نسخه اندروید')}</a>` : '<p class="sub">لینک دانلود هنوز اعلام نشده است.</p>'}
        ${!s.url && ctx.version ? `<p class="sub">نسخه ${esc(ctx.version)}</p>` : ''}
      </div></section>`;
    }
    case 'faq':
      return `<section class="block"${id}><div class="wrap narrow">${head}${list(s.items).map(i => `
        <details class="faq"><summary>${esc(i.q)}</summary><p>${para(i.a)}</p></details>`).join('')}</div></section>`;
    case 'cta':
      return `<section class="block"${id}><div class="wrap panel center accent">${s.title ? `<h2>${esc(s.title)}</h2>` : ''}${s.text ? `<p>${para(s.text)}</p>` : ''}<div class="actions center">${button(s.buttonText, s.buttonUrl)}</div></div></section>`;
    case 'contact': {
      const rows = [
        s.phone && `<a href="tel:${esc(String(s.phone).replace(/[^\d+]/g, ''))}">📞 <bdi>${esc(s.phone)}</bdi></a>`,
        s.email && `<a href="mailto:${esc(s.email)}">✉️ ${esc(s.email)}</a>`,
        s.address && `<span>📍 ${para(s.address)}</span>`,
        safeUrl(s.instagram) && `<a href="${safeUrl(s.instagram)}" target="_blank" rel="noopener">اینستاگرام</a>`,
        safeUrl(s.telegram) && `<a href="${safeUrl(s.telegram)}" target="_blank" rel="noopener">تلگرام</a>`,
        safeUrl(s.whatsapp) && `<a href="${safeUrl(s.whatsapp)}" target="_blank" rel="noopener">واتس‌اپ</a>`,
      ].filter(Boolean);
      return `<section class="block"${id}><div class="wrap panel">${head || '<h2>تماس با ما</h2>'}<div class="contact">${rows.join('')}</div></div></section>`;
    }
    case 'html':
      return `<section class="block custom"${id}>${String(s.html || '')}</section>`;
    case 'footer':
      return `<footer class="foot"${id}><div class="wrap foot-row"><span>${para(s.text)}</span><nav>${list(s.links).map(l => button(l.label, l.url, 'ghost').replace('btn btn-ghost', 'foot-link')).join('')}</nav></div></footer>`;
    default:
      return '';
  }
}

export function renderBuilderPage(
  page: { title: string; metaTitle?: string | null; metaDescription?: string | null; ogImage?: string | null; builder: any },
  ctx: { downloadUrl: string; version: string },
): string {
  const b: LandingBuilder = page.builder && typeof page.builder === 'object' ? page.builder : {};
  const t = { ...DEFAULT_THEME, ...(b.theme || {}) };
  const theme = {
    primary: color(t.primary, DEFAULT_THEME.primary), background: color(t.background, DEFAULT_THEME.background),
    surface: color(t.surface, DEFAULT_THEME.surface), text: color(t.text, DEFAULT_THEME.text), accent: color(t.accent, DEFAULT_THEME.accent),
    radius: Math.max(0, Math.min(40, Number(t.radius) || DEFAULT_THEME.radius)),
  };
  const body = (b.sections || []).filter(s => s && !s.hidden).map(s => section(s, ctx)).join('\n');
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.metaTitle || page.title)}</title>
${page.metaDescription ? `<meta name="description" content="${esc(page.metaDescription)}">` : ''}
<meta property="og:title" content="${esc(page.metaTitle || page.title)}">
${page.metaDescription ? `<meta property="og:description" content="${esc(page.metaDescription)}">` : ''}
${safeUrl(page.ogImage) ? `<meta property="og:image" content="${safeUrl(page.ogImage)}">` : ''}
<style>
@font-face{font-family:Yekan;src:url(/fonts/YekanBakh-Regular.ttf) format("truetype");font-weight:400;font-display:swap}
@font-face{font-family:Yekan;src:url(/fonts/YekanBakh-Bold.ttf) format("truetype");font-weight:700;font-display:swap}
:root{--p:${theme.primary};--bg:${theme.background};--s:${theme.surface};--t:${theme.text};--a:${theme.accent};--r:${theme.radius}px}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;font-family:Yekan,Tahoma,sans-serif;background:var(--bg);color:var(--t);line-height:1.9;-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}a{color:inherit}
.wrap{max-width:1120px;margin:0 auto;padding:0 20px}.narrow{max-width:780px}
h1{font-size:clamp(28px,5vw,48px);line-height:1.4;margin:0 0 14px}h2{font-size:clamp(22px,3.4vw,32px);margin:0 0 10px}h3{margin:6px 0}
.sub,.lead{opacity:.8}.lead{font-size:18px}.center{text-align:center}
.hero{padding:72px 0 48px;background:radial-gradient(1200px 500px at 80% -10%,color-mix(in srgb,var(--p) 35%,transparent),transparent)}
.hero-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:36px;align-items:center}.hero-img img{border-radius:var(--r)}
.badge{display:inline-block;padding:4px 14px;border-radius:99px;background:color-mix(in srgb,var(--a) 20%,transparent);color:var(--a);font-size:14px;margin-bottom:10px}
.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:18px}.actions.center{justify-content:center}
.btn{display:inline-block;padding:11px 26px;border-radius:calc(var(--r)/1.6);text-decoration:none;font-weight:700;transition:transform .15s,opacity .15s}
.btn:hover{transform:translateY(-2px)}.btn-primary{background:var(--p);color:#fff}.btn-ghost{border:1.5px solid color-mix(in srgb,var(--t) 35%,transparent)}.btn-lg{padding:14px 34px;font-size:18px}
.block{padding:56px 0}.block>.wrap>h2,.block>.wrap>.sub{text-align:center}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px;margin-top:26px}
.card,.panel,.stat,.faq{background:var(--s);border:1px solid color-mix(in srgb,var(--t) 10%,transparent);border-radius:var(--r)}
.card{padding:22px}.card .icon{font-size:30px}.card p{opacity:.8;margin:0}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-top:24px}
.stat{padding:22px;text-align:center}.stat strong{display:block;font-size:34px;color:var(--a)}
.split{display:grid;grid-template-columns:1fr 1fr;gap:36px;align-items:center}.split.reverse>:first-child{order:2}.split-img{border-radius:var(--r)}
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;margin-top:24px}
.gallery figure{margin:0}.gallery img{border-radius:var(--r);aspect-ratio:4/3;object-fit:cover;width:100%}.gallery figcaption{text-align:center;opacity:.75;font-size:14px}
.panel{padding:34px}.panel.accent{background:linear-gradient(135deg,var(--p),color-mix(in srgb,var(--p) 55%,var(--bg)));color:#fff}
.faq{padding:6px 20px;margin-bottom:10px}.faq summary{cursor:pointer;font-weight:700;padding:10px 0}.faq p{opacity:.85;margin-top:0}
.contact{display:flex;flex-wrap:wrap;gap:14px 26px;margin-top:10px}.contact a{text-decoration:none}
.foot{padding:28px 0;border-top:1px solid color-mix(in srgb,var(--t) 12%,transparent);opacity:.85;font-size:14px}
.foot-row{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.foot-link{margin-inline-start:14px;text-decoration:none}
@media (max-width:760px){.hero-grid,.split{grid-template-columns:1fr}.split.reverse>:first-child{order:0}.hero{padding-top:44px}}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}.btn{transition:none}}
</style>
</head>
<body>
${body || '<section class="block"><div class="wrap center"><h2>این صفحه هنوز بخشی ندارد</h2></div></section>'}
</body>
</html>`;
}

/** Ready-made starting points for a new page (panel → «از روی قالب»). */
export function landingTemplates(): { key: string; title: string; description: string; builder: LandingBuilder }[] {
  const sid = (n: number) => `s${n}`;
  return [
    {
      key: 'app',
      title: 'معرفی اپلیکیشن نپا',
      description: 'سربرگ، ویژگی‌ها، آمار، دانلود اپ، پرسش‌ها و پانویس',
      builder: {
        theme: { ...DEFAULT_THEME },
        sections: [
          { id: sid(1), type: 'hero', badge: 'سفر یادگیری نوجوانان', title: 'نپا؛ کاروانی برای رشد', subtitle: 'منزلگاه به منزلگاه با راهبر و همسفرانت پیش برو، چالش‌ها را پشت سر بگذار و سرمایه جمع کن.', buttonText: 'دانلود اپلیکیشن', buttonUrl: '#download', secondaryText: 'بیشتر بدانید', secondaryUrl: '#features', imageUrl: '' },
          { id: sid(2), type: 'features', anchor: 'features', title: 'چرا نپا؟', subtitle: '', items: [
            { icon: '🧭', title: 'کاروان و راهبر', text: 'هر نوجوان در یک کاروان با راهبر همراه می‌شود.' },
            { icon: '🎬', title: 'منزلگاه‌های آموزشی', text: 'کلاس‌ها، فیلم‌ها و آزمونک‌های هر منزلگاه.' },
            { icon: '🏆', title: 'چالش و لیگ', text: 'چالش‌های گروهی و فراگروهی و رتبه‌بندی کاروان‌ها.' },
          ] },
          { id: sid(3), type: 'stats', title: 'نپا در یک نگاه', items: [{ value: '+۱۰۰', label: 'همسفر' }, { value: '+۱۰', label: 'کاروان' }, { value: '۷', label: 'منزلگاه' }] },
          { id: sid(4), type: 'download', anchor: 'download', title: 'همین حالا شروع کن', text: 'آخرین نسخه‌ی اپلیکیشن نپا را دریافت کنید.', buttonText: 'دانلود نسخه اندروید', url: '' },
          { id: sid(5), type: 'faq', title: 'پرسش‌های پرتکرار', items: [{ q: 'چطور عضو شوم؟', a: 'پس از نصب اپ با شماره همراه وارد شوید.' }, { q: 'هزینه دارد؟', a: 'برای اطلاع از شرایط با پشتیبانی تماس بگیرید.' }] },
          { id: sid(6), type: 'footer', text: '© نپا — همه حقوق محفوظ است.', links: [] },
        ],
      },
    },
    {
      key: 'simple',
      title: 'صفحه ساده',
      description: 'سربرگ، تصویر و متن، دعوت به اقدام، تماس',
      builder: {
        theme: { ...DEFAULT_THEME, background: '#0f1724', surface: '#1b2638', primary: '#22a39f' },
        sections: [
          { id: sid(1), type: 'hero', title: 'عنوان صفحه', subtitle: 'یک جمله‌ی کوتاه درباره‌ی این صفحه.', buttonText: 'شروع کنید', buttonUrl: '#contact' },
          { id: sid(2), type: 'imageText', title: 'درباره ما', text: 'متن معرفی را اینجا بنویسید.', imageUrl: '' },
          { id: sid(3), type: 'cta', title: 'آماده‌اید؟', text: 'همین حالا به ما بپیوندید.', buttonText: 'تماس با ما', buttonUrl: '#contact' },
          { id: sid(4), type: 'contact', anchor: 'contact', title: 'تماس با ما', phone: '', email: '', address: '' },
          { id: sid(5), type: 'footer', text: '© نپا', links: [] },
        ],
      },
    },
    {
      key: 'soon',
      title: 'به‌زودی',
      description: 'یک صفحه‌ی «به‌زودی» با لینک دانلود',
      builder: {
        theme: { ...DEFAULT_THEME },
        sections: [
          { id: sid(1), type: 'hero', badge: 'به‌زودی', title: 'نسخه‌ی جدید سایت نپا در راه است', subtitle: 'تا آن زمان اپلیکیشن را نصب کنید.', buttonText: 'دانلود اپلیکیشن', buttonUrl: '#download' },
          { id: sid(2), type: 'download', anchor: 'download', title: '', text: '', url: '' },
        ],
      },
    },
  ];
}
