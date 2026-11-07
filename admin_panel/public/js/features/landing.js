// «صفحه لندینگ» (settings): the public site's pages. Overview bento (#landing-tab), the create dialog (#lnd-create-modal:
// template / builder / HTML file / pasted code) and the editor (#lnd-editor-modal: details, content, versions).
// API: /admin/landing (+ /:id, /:id/home, /:id/duplicate, /:id/versions/:v/restore, /:id/preview-link, /render).
// Uses the caravans tab's helpers (crvArgs, crvFa), so it loads after js/features/caravans.js.
window.lndPages = window.lndPages || [];
let lndTemplates = [];
let lndSectionTypes = [];
let lndLoaded = false;
let lndEdit = null;       // { id, page, html, builder: {theme, sections}, dirty }
let lndCreateWay = 'template';
let lndNewFileText = '';

const lndEl = id => document.getElementById(id);
const LND_API = '/api/v1/admin/landing';

// ==================== OVERVIEW ====================

window.loadLandingTab = async function() {
  lndSetLoading(true);
  try {
    const data = await NopaApi.json(LND_API);
    window.lndPages = data.pages || [];
    lndTemplates = data.templates || [];
    lndSectionTypes = data.sectionTypes || [];
    lndLoaded = true;
  } catch (err) {
    console.error('loadLandingTab error:', err);
    if (err.message !== 'Unauthorized') showToast(err.message || 'خطا در دریافت صفحات', 'error');
  }
  lndSetLoading(false);
  window.lndFilter();
};

window.lndFilter = function() {
  const overview = lndEl('lnd-overview-view');
  if (window.NopaFlip && overview) window.NopaFlip.render(overview, lndDrawBento); else lndDrawBento();
};

function lndChip(p) {
  if (p.isHome) return '<span class="lst-chip lst-chip-active"><i class="fa-solid fa-house"></i> صفحه اصلی</span>';
  return p.isPublished ? '<span class="lst-chip lst-chip-active">منتشرشده</span>' : '<span class="lst-chip lst-chip-scheduled">پیش‌نویس</span>';
}

function lndCard(p) {
  const what = p.mode === 'html'
    ? `کد HTML · ${crvFa(Math.ceil((p.size || 0) / 1024))} کیلوبایت`
    : `فرم‌ساز · ${crvFa(p.sections || 0)} بخش`;
  return `
    <button type="button" class="crv-card lnd-card" data-anim-key="lnd:${esc(p.id)}" data-click="lndOpenEditor" data-click-args="${crvArgs(p.id)}" title="ویرایش ${esc(p.title)}">
      <span class="crv-card-top">
        <span class="crv-card-cover lnd-cover"><i class="fa-solid ${p.mode === 'html' ? 'fa-code' : 'fa-layer-group'}"></i></span>
        <span class="crv-card-name"><strong>${esc(p.title)}</strong>${lndChip(p)}</span>
      </span>
      <span class="crv-card-mentor"><i class="fa-solid fa-link"></i><bdi dir="ltr">${esc(p.isHome ? '/' : '/p/' + p.slug)}</bdi></span>
      <span class="crv-card-foot">
        <span class="crv-card-nums"><span class="u-c-text-soft">${what}</span></span>
        <span class="crv-card-nums"><span class="u-c-text-faint">${p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('fa-IR') : ''}</span></span>
      </span>
    </button>`;
}

function lndDrawBento() {
  const all = window.lndPages || [];
  const q = (lndEl('lnd-search')?.value || '').trim().toLowerCase();
  const st = lndEl('lnd-status-filter')?.value || 'all';
  const list = all.filter(p => {
    if (st === 'published' && !p.isPublished) return false;
    if (st === 'draft' && p.isPublished) return false;
    return !q || [p.title, p.slug].some(v => String(v || '').toLowerCase().includes(q));
  });
  const filtering = !!q || st !== 'all';
  const badge = lndEl('lnd-count-badge');
  if (badge) badge.textContent = filtering ? `نمایش ${crvFa(list.length)} از ${crvFa(all.length)} صفحه` : 'برای ویرایش روی هر صفحه بزنید';

  const grid = lndEl('lnd-bento-list');
  if (grid) {
    const cards = list.map(lndCard);
    if (!filtering) {
      cards.push(`
        <button type="button" class="crv-card crv-card-add" data-anim-key="lnd-add" data-click="lndOpenCreate" title="صفحه جدید">
          <span class="lsv-round lsv-round-lg"><i class="fa-solid fa-plus"></i></span><span>صفحه جدید</span>
        </button>`);
    } else if (!list.length) {
      cards.push('<div class="lst-empty" data-anim-key="lnd-empty">صفحه‌ای با این مشخصات یافت نشد.</div>');
    }
    grid.innerHTML = cards.join('');
    grid.setAttribute('aria-busy', 'false');
  }

  const set = (id, v) => { const el = lndEl(id); if (el) el.textContent = v; };
  set('lnd-stat-total', crvFa(all.length));
  set('lnd-stat-published', crvFa(all.filter(p => p.isPublished).length));
  set('lnd-stat-builder', crvFa(all.filter(p => p.mode === 'builder').length));
  set('lnd-stat-html', crvFa(all.filter(p => p.mode === 'html').length));

  const home = all.find(p => p.isHome && p.isPublished);
  const homeEl = lndEl('lnd-bento-home');
  if (homeEl) {
    homeEl.innerHTML = home
      ? `<ul class="lst-list"><li class="lst-list-item lst-clickable" role="button" tabindex="0" data-click="lndOpenEditor" data-click-args="${crvArgs(home.id)}">
           <i class="fa-solid fa-house u-c-success-text"></i><span class="lst-grow"><strong>${esc(home.title)}</strong><small>${home.mode === 'html' ? 'کد HTML' : 'فرم‌ساز'}</small></span></li></ul>
         <div class="lst-quick"><a class="lst-quick-btn" href="/" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> دیدن سایت</a></div>`
      : '<div class="lst-empty">هنوز صفحه‌ای «صفحه اصلی» نشده است؛ نشانی اصلی سایت مثل قبل نمایش داده می‌شود.</div>';
  }
}

function lndSetLoading(on) {
  const overview = lndEl('lnd-overview-view');
  if (!overview) return;
  overview.querySelectorAll('.lst-bento > .lst-tile').forEach(t => t.classList.toggle('is-loading', on));
  const grid = lndEl('lnd-bento-list');
  if (grid) grid.setAttribute('aria-busy', on ? 'true' : 'false');
  if (!on || lndLoaded) return;
  if (grid) grid.innerHTML = Array.from({ length: 4 }, () => `
    <div class="crv-card lst-skel" aria-hidden="true">
      <span class="crv-card-top"><span class="crv-card-cover"></span><span class="crv-card-name"><span class="lst-skel-line"></span><span class="lst-skel-line lst-skel-chip"></span></span></span>
      <span class="lst-skel-line lst-skel-short"></span><span class="lst-skel-line"></span>
    </div>`).join('');
  const home = lndEl('lnd-bento-home');
  if (home) home.innerHTML = '<div class="lst-skel-lines" aria-hidden="true">' + '<span class="lst-skel-row"></span>'.repeat(2) + '</div>';
}
lndSetLoading(true);

// ==================== CREATE ====================

const LND_WAYS = [
  { key: 'template', icon: 'fa-swatchbook', title: 'قالب آماده', text: 'شروع از یک صفحه‌ی آماده و تغییر آن' },
  { key: 'builder', icon: 'fa-layer-group', title: 'فرم‌ساز گرافیکی', text: 'ساخت بخش‌به‌بخش بدون کدنویسی' },
  { key: 'upload', icon: 'fa-file-code', title: 'بارگذاری فایل HTML', text: 'فایل آماده‌ی صفحه را بارگذاری کنید' },
  { key: 'paste', icon: 'fa-paste', title: 'کپی و پیست کد', text: 'کد HTML را مستقیم بچسبانید' },
];

window.lndOpenCreate = function(way) {
  const modal = lndEl('lnd-create-modal');
  if (!modal) return;
  lndEl('lnd-new-title').value = '';
  lndEl('lnd-new-slug').value = '';
  lndEl('lnd-new-code').value = '';
  lndNewFileText = '';
  lndEl('lnd-new-file-name').textContent = 'انتخاب فایل .html';
  lndEl('lnd-new-template').innerHTML = lndTemplates.map(t => `<option value="${esc(t.key)}">${esc(t.title)} — ${esc(t.description)}</option>`).join('');
  window.lndPickWay(typeof way === 'string' && LND_WAYS.some(w => w.key === way) ? way : 'template');
  modal.style.display = 'flex';
  setTimeout(() => lndEl('lnd-new-title')?.focus(), 50);
};

window.lndCloseCreate = function() { const m = lndEl('lnd-create-modal'); if (m) m.style.display = 'none'; };

window.lndPickWay = function(way) {
  lndCreateWay = way;
  lndEl('lnd-ways').innerHTML = LND_WAYS.map(w => `
    <button type="button" class="lnd-way${w.key === way ? ' is-active' : ''}" data-click="lndPickWay" data-click-args="${crvArgs(w.key)}">
      <i class="fa-solid ${w.icon}"></i><strong>${w.title}</strong><small>${w.text}</small>
    </button>`).join('');
  lndEl('lnd-new-template-field').style.display = way === 'template' ? '' : 'none';
  lndEl('lnd-new-file-field').style.display = way === 'upload' ? '' : 'none';
  lndEl('lnd-new-code-field').style.display = way === 'paste' ? '' : 'none';
};

async function lndReadFile(file) {
  if (!file) return '';
  if (file.size > 2 * 1024 * 1024) throw new Error('حجم فایل بیشتر از ۲ مگابایت است');
  return file.text();
}

window.lndPickNewFile = async function(input) {
  const file = input && input.files && input.files[0];
  if (!file) return;
  try {
    lndNewFileText = await lndReadFile(file);
    lndEl('lnd-new-file-name').textContent = file.name;
    if (!lndEl('lnd-new-title').value.trim()) lndEl('lnd-new-title').value = file.name.replace(/\.html?$/i, '');
  } catch (err) { showToast(err.message, 'error'); }
  input.value = '';
};

window.lndCreate = async function() {
  const title = lndEl('lnd-new-title').value.trim();
  if (!title) return showToast('عنوان صفحه را وارد کنید.', 'error');
  const body = { title };
  const slug = lndEl('lnd-new-slug').value.trim();
  if (slug) body.slug = slug;
  if (lndCreateWay === 'template') body.templateKey = lndEl('lnd-new-template').value;
  else if (lndCreateWay === 'builder') body.mode = 'builder';
  else if (lndCreateWay === 'upload') {
    if (!lndNewFileText) return showToast('فایل HTML را انتخاب کنید.', 'error');
    Object.assign(body, { mode: 'html', html: lndNewFileText });
  } else {
    const code = lndEl('lnd-new-code').value;
    if (!code.trim()) return showToast('کد HTML را وارد کنید.', 'error');
    Object.assign(body, { mode: 'html', html: code });
  }
  const btn = lndEl('lnd-create-btn');
  if (btn) btn.disabled = true;
  try {
    const page = await NopaApi.json(LND_API, { method: 'POST', body: JSON.stringify(body) });
    window.lndCloseCreate();
    showToast('صفحه ساخته شد (پیش‌نویس).', 'success');
    await window.loadLandingTab();
    window.lndOpenEditor(page.id, 'content');
  } catch (err) {
    showToast(err.message || 'خطا در ساخت صفحه', 'error');
  } finally { if (btn) btn.disabled = false; }
};

// ==================== EDITOR ====================

window.lndOpenEditor = async function(id, tab) {
  const modal = lndEl('lnd-editor-modal');
  if (!modal) return;
  try {
    const page = await NopaApi.json(`${LND_API}/${encodeURIComponent(id)}`);
    const builder = page.builder && typeof page.builder === 'object' ? JSON.parse(JSON.stringify(page.builder)) : {};
    lndEdit = { id: page.id, page, html: page.html || '', builder: { theme: builder.theme || {}, sections: Array.isArray(builder.sections) ? builder.sections : [] }, dirty: false };
  } catch (err) {
    return showToast(err.message || 'خطا در دریافت صفحه', 'error');
  }
  const p = lndEdit.page;
  lndEl('lnd-ed-title').textContent = p.title;
  lndEl('lnd-ed-sub').textContent = `${p.isHome ? 'صفحه اصلی سایت' : p.isPublished ? 'منتشرشده' : 'پیش‌نویس'} · ${p.isHome ? '/' : '/p/' + p.slug}`;
  lndEl('lnd-title').value = p.title;
  lndEl('lnd-slug').value = p.slug;
  lndEl('lnd-url-hint').textContent = `/p/${p.slug}`;
  lndEl('lnd-published').checked = !!p.isPublished;
  lndEl('lnd-home').checked = !!p.isHome;
  lndEl('lnd-meta-title').value = p.metaTitle || '';
  lndEl('lnd-meta-desc').value = p.metaDescription || '';
  lndEl('lnd-og-image').value = p.ogImage || '';
  lndEl('lnd-mode').value = p.mode;
  lndEl('lnd-html').value = lndEdit.html;
  lndEl('lnd-add-type').innerHTML = lndSectionTypes.map(t => `<option value="${esc(t.key)}">${esc(t.label)}</option>`).join('');
  lndDrawTheme();
  lndDrawSections();
  lndDrawVersions();
  window.lndModeChanged();
  window.lndTab(tab || 'info');
  modal.style.display = 'flex';
};

window.lndCloseEditor = async function() {
  if (lndEdit && lndEdit.dirty && !(await NopaConfirm('تغییرات ذخیره نشده‌اند. بسته شود؟'))) return;
  const m = lndEl('lnd-editor-modal');
  if (m) m.style.display = 'none';
  lndEdit = null;
};

window.lndTab = function(tab) {
  document.querySelectorAll('#lnd-editor-modal [data-lnd-tab]').forEach(b => b.classList.toggle('is-active', b.dataset.lndTab === tab));
  document.querySelectorAll('#lnd-editor-modal [data-lnd-pane]').forEach(p => { p.style.display = p.dataset.lndPane === tab ? '' : 'none'; });
};

window.lndModeChanged = function() {
  const html = lndEl('lnd-mode').value === 'html';
  lndEl('lnd-html-pane').style.display = html ? '' : 'none';
  lndEl('lnd-builder-pane').style.display = html ? 'none' : '';
  if (lndEdit) lndEdit.dirty = true;
};

// ---- code ----
function lndHtmlSize() {
  const el = lndEl('lnd-html-size');
  if (el) el.textContent = `${crvFa(Math.ceil(new Blob([lndEl('lnd-html').value]).size / 1024))} KB`;
}
window.lndHtmlInput = function() { if (lndEdit) lndEdit.dirty = true; lndHtmlSize(); };

window.lndUploadHtml = async function(input) {
  const file = input && input.files && input.files[0];
  if (!file) return;
  try {
    lndEl('lnd-html').value = await lndReadFile(file);
    lndEl('lnd-mode').value = 'html';
    window.lndModeChanged();
    lndHtmlSize();
    showToast(`«${file.name}» بارگذاری شد؛ برای اعمال، ذخیره کنید.`, 'success');
  } catch (err) { showToast(err.message, 'error'); }
  input.value = '';
};

window.lndDownloadHtml = function() {
  const blob = new Blob([lndEl('lnd-html').value], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(lndEl('lnd-slug').value || 'landing').trim()}.html`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
};

window.lndBuilderToHtml = async function() {
  if (!lndEdit) return;
  if (lndEl('lnd-html').value.trim() && !(await NopaConfirm('کد فعلی با کد ساخته‌شده از فرم‌ساز جایگزین شود؟'))) return;
  try {
    const data = await NopaApi.json(`${LND_API}/render`, { method: 'POST', body: JSON.stringify({ title: lndEl('lnd-title').value, metaTitle: lndEl('lnd-meta-title').value, metaDescription: lndEl('lnd-meta-desc').value, ogImage: lndEl('lnd-og-image').value, builder: lndBuilderOut() }) });
    lndEl('lnd-html').value = data.html || '';
    lndEl('lnd-mode').value = 'html';
    window.lndModeChanged();
    lndHtmlSize();
  } catch (err) { showToast(err.message || 'خطا', 'error'); }
};

// ---- builder: theme ----
const LND_THEME = [
  ['primary', 'رنگ اصلی (دکمه‌ها)', '#7c6cf2'], ['background', 'پس‌زمینه', '#14122b'], ['surface', 'کارت‌ها', '#221f3d'],
  ['text', 'متن', '#f3f1ff'], ['accent', 'رنگ تأکید', '#ffd580'],
];
function lndDrawTheme() {
  const t = lndEdit.builder.theme;
  lndEl('lnd-theme').innerHTML = LND_THEME.map(([k, label, def]) => `
    <label class="lnd-color"><input type="color" value="${esc(/^#[0-9a-f]{6}$/i.test(t[k] || '') ? t[k] : def)}" data-input="lndThemeField" data-input-args="${crvArgs(k, '$value')}"><span>${label}</span></label>`).join('') + `
    <label class="lse-field lnd-radius"><span>گردی گوشه‌ها</span><input type="number" class="input-ctrl" min="0" max="40" value="${esc(t.radius ?? 20)}" dir="ltr" data-input="lndThemeField" data-input-args="${crvArgs('radius', '$value')}"></label>`;
}
window.lndThemeField = function(key, value) {
  if (!lndEdit) return;
  lndEdit.builder.theme[key] = key === 'radius' ? Number(value) || 0 : value;
  lndEdit.dirty = true;
};

// ---- builder: sections ----
// [key, label, kind, hint]: kind text | textarea | ltr | image | check | list (one item per line, parts split by «|»)
const LND_FIELDS = {
  hero: [['badge', 'برچسب بالای عنوان'], ['title', 'عنوان'], ['subtitle', 'متن زیر عنوان', 'textarea'], ['buttonText', 'متن دکمه'], ['buttonUrl', 'لینک دکمه', 'ltr', '#download یا https://...'], ['secondaryText', 'متن دکمه دوم'], ['secondaryUrl', 'لینک دکمه دوم', 'ltr'], ['imageUrl', 'تصویر کنار متن', 'image']],
  features: [['title', 'عنوان'], ['subtitle', 'توضیح', 'textarea'], ['items', 'ویژگی‌ها', 'list', 'هر خط: آیکون (ایموجی) | عنوان | متن', ['icon', 'title', 'text']]],
  stats: [['title', 'عنوان'], ['items', 'اعداد', 'list', 'هر خط: عدد | برچسب', ['value', 'label']]],
  imageText: [['title', 'عنوان'], ['text', 'متن', 'textarea'], ['imageUrl', 'تصویر', 'image'], ['buttonText', 'متن دکمه'], ['buttonUrl', 'لینک دکمه', 'ltr'], ['reverse', 'تصویر سمت راست باشد', 'check']],
  gallery: [['title', 'عنوان'], ['items', 'تصاویر', 'list', 'هر خط: نشانی تصویر | توضیح', ['url', 'caption']]],
  download: [['title', 'عنوان'], ['text', 'متن', 'textarea'], ['buttonText', 'متن دکمه'], ['url', 'لینک دانلود', 'ltr', 'خالی = آخرین نسخه‌ای که در «نسخه اپلیکیشن» اعلام شده']],
  faq: [['title', 'عنوان'], ['items', 'پرسش‌ها', 'list', 'هر خط: پرسش | پاسخ', ['q', 'a']]],
  cta: [['title', 'عنوان'], ['text', 'متن', 'textarea'], ['buttonText', 'متن دکمه'], ['buttonUrl', 'لینک دکمه', 'ltr']],
  contact: [['title', 'عنوان'], ['phone', 'تلفن', 'ltr'], ['email', 'ایمیل', 'ltr'], ['address', 'نشانی', 'textarea'], ['instagram', 'لینک اینستاگرام', 'ltr'], ['telegram', 'لینک تلگرام', 'ltr'], ['whatsapp', 'لینک واتس‌اپ', 'ltr']],
  html: [['html', 'کد HTML این بخش', 'code', 'کد این بخش همان‌طور که هست درج می‌شود و صفحه در محیط جدا (sandbox) اجرا می‌شود']],
  footer: [['text', 'متن پانویس', 'textarea'], ['links', 'لینک‌ها', 'list', 'هر خط: عنوان | نشانی', ['label', 'url']]],
};
const LND_ANCHOR = ['anchor', 'شناسه برای لینک داخلی', 'ltr', 'مثلاً download؛ لینک «#download» به این بخش می‌رود'];

const lndTypeLabel = type => (lndSectionTypes.find(t => t.key === type) || {}).label || type;

function lndListText(items, cols) {
  return (Array.isArray(items) ? items : []).map(i => cols.map(c => String((i && i[c]) ?? '').replace(/\n/g, ' ')).join(' | ')).join('\n');
}

function lndFieldHtml(s, i, [key, label, kind = 'text', hint = '', cols]) {
  const args = (...a) => crvArgs(i, key, ...a);
  const hintHtml = hint ? ` <small>${esc(hint)}</small>` : '';
  if (kind === 'check') {
    return `<label class="crv-check lnd-check"><input type="checkbox"${s[key] ? ' checked' : ''} data-change="lndSecField" data-change-args="${args('$checked')}"> ${esc(label)}</label>`;
  }
  if (kind === 'list') {
    const raw = (s.__raw && s.__raw[key]) ?? lndListText(s[key], cols);
    return `<label class="lse-field lnd-wide"><span>${esc(label)}${hintHtml}</span><textarea class="input-ctrl" rows="4" data-input="lndSecList" data-input-args="${args('$value')}">${esc(raw)}</textarea></label>`;
  }
  if (kind === 'textarea' || kind === 'code') {
    return `<label class="lse-field lnd-wide"><span>${esc(label)}${hintHtml}</span><textarea class="input-ctrl${kind === 'code' ? ' lnd-code' : ''}" rows="${kind === 'code' ? 8 : 3}"${kind === 'code' ? ' dir="ltr" spellcheck="false"' : ''} data-input="lndSecField" data-input-args="${args('$value')}">${esc(s[key] || '')}</textarea></label>`;
  }
  if (kind === 'image') {
    return `<div class="lse-field lnd-wide"><span>${esc(label)}${hintHtml}</span><div class="lnd-img-row">
      <input type="text" class="input-ctrl" dir="ltr" placeholder="/uploads/..." value="${esc(s[key] || '')}" data-lnd-img="${i}:${esc(key)}" data-input="lndSecField" data-input-args="${args('$value')}">
      <label class="lse-btn"><i class="fa-solid fa-upload"></i> بارگذاری<input type="file" accept="image/*" hidden data-change="lndUploadImage" data-change-args="${args('$this')}"></label></div></div>`;
  }
  return `<label class="lse-field"><span>${esc(label)}${hintHtml}</span><input type="text" class="input-ctrl"${kind === 'ltr' ? ' dir="ltr"' : ''} value="${esc(s[key] || '')}" data-input="lndSecField" data-input-args="${args('$value')}"></label>`;
}

function lndDrawSections(openIndex) {
  const box = lndEl('lnd-sections');
  const list = lndEdit.builder.sections;
  lndEl('lnd-sections-count').textContent = crvFa(list.length);
  if (!list.length) { box.innerHTML = '<div class="lst-empty">هنوز بخشی ندارد؛ از پایین یک بخش اضافه کنید.</div>'; return; }
  const btn = (icon, title, click, a, extra = '') => `<button type="button" class="lsv-round lsv-round-sm${extra}" data-click="${click}" data-click-args="${a}" title="${title}" aria-label="${title}"><i class="fa-solid ${icon}"></i></button>`;
  box.innerHTML = list.map((s, i) => `
    <details class="lnd-sec${s.hidden ? ' is-hidden' : ''}"${i === openIndex ? ' open' : ''}>
      <summary>
        <span class="lnd-sec-num">${crvFa(i + 1)}</span>
        <span class="lnd-sec-name"><strong>${esc(lndTypeLabel(s.type))}</strong><small>${esc(s.title || s.text || '')}</small></span>
        <span class="lnd-sec-tools">
          ${btn('fa-arrow-up', 'بالاتر', 'lndMoveSection', crvArgs(i, -1))}
          ${btn('fa-arrow-down', 'پایین‌تر', 'lndMoveSection', crvArgs(i, 1))}
          ${btn(s.hidden ? 'fa-eye-slash' : 'fa-eye', s.hidden ? 'نمایش دادن' : 'پنهان کردن', 'lndToggleSection', crvArgs(i))}
          ${btn('fa-trash', 'حذف بخش', 'lndRemoveSection', crvArgs(i), ' lsv-round-danger')}
        </span>
      </summary>
      <div class="lse-grid lse-grid-2 lnd-sec-body">
        ${(LND_FIELDS[s.type] || []).map(f => lndFieldHtml(s, i, f)).join('')}
        ${s.type !== 'html' ? lndFieldHtml(s, i, LND_ANCHOR) : ''}
      </div>
    </details>`).join('');
}

window.lndSecField = function(i, key, value) {
  if (!lndEdit || !lndEdit.builder.sections[i]) return;
  lndEdit.builder.sections[i][key] = value;
  lndEdit.dirty = true;
};

window.lndSecList = function(i, key, value) {
  const s = lndEdit && lndEdit.builder.sections[i];
  if (!s) return;
  const cols = ((LND_FIELDS[s.type] || []).find(f => f[0] === key) || [])[4] || [];
  s.__raw = Object.assign({}, s.__raw, { [key]: value });
  s[key] = String(value).split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const parts = line.split('|').map(p => p.trim());
    const o = {};
    cols.forEach((c, n) => { o[c] = n === cols.length - 1 ? parts.slice(n).join(' | ') : (parts[n] || ''); });
    return o;
  });
  lndEdit.dirty = true;
};

window.lndUploadImage = async function(i, key, input) {
  const file = input && input.files && input.files[0];
  if (!file) return;
  try {
    const form = new FormData();
    form.append('file', file);
    const data = await NopaApi.json('/api/v1/media/upload', { method: 'POST', body: form });
    const url = data.url || (data.media && data.media.url) || '';
    if (!url) throw new Error('آدرس فایل برنگشت');
    window.lndSecField(i, key, url);
    const field = document.querySelector(`[data-lnd-img="${i}:${key}"]`);
    if (field) field.value = url;
  } catch (err) { showToast('خطا در بارگذاری تصویر: ' + (err.message || ''), 'error'); }
  input.value = '';
};

window.lndAddSection = function() {
  if (!lndEdit) return;
  const type = lndEl('lnd-add-type').value;
  const list = lndEdit.builder.sections;
  // a new section goes before the footer, if there is one
  const footerAt = list.findIndex(s => s.type === 'footer');
  const at = type !== 'footer' && footerAt >= 0 ? footerAt : list.length;
  list.splice(at, 0, { id: 's' + Date.now().toString(36), type, title: type === 'footer' ? undefined : lndTypeLabel(type) });
  lndEdit.dirty = true;
  lndDrawSections(at);
};

window.lndMoveSection = function(i, d) {
  const list = lndEdit && lndEdit.builder.sections;
  const j = Number(i) + Number(d);
  if (!list || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  lndEdit.dirty = true;
  lndDrawSections(j);
};

window.lndToggleSection = function(i) {
  const s = lndEdit && lndEdit.builder.sections[i];
  if (!s) return;
  s.hidden = !s.hidden;
  lndEdit.dirty = true;
  lndDrawSections();
};

window.lndRemoveSection = async function(i) {
  const s = lndEdit && lndEdit.builder.sections[i];
  if (!s || !(await NopaConfirm(`بخش «${lndTypeLabel(s.type)}» حذف شود؟`))) return;
  lndEdit.builder.sections.splice(i, 1);
  lndEdit.dirty = true;
  lndDrawSections();
};

function lndBuilderOut() {
  return {
    theme: lndEdit.builder.theme,
    sections: lndEdit.builder.sections.map(s => { const { __raw, ...rest } = s; return rest; }),
  };
}

// ---- versions ----
function lndDrawVersions() {
  const box = lndEl('lnd-versions');
  const versions = lndEdit.page.versions || [];
  box.innerHTML = versions.length
    ? `<ul class="lst-list">${versions.map(v => `
        <li class="lst-list-item">
          <i class="fa-solid ${v.mode === 'html' ? 'fa-code' : 'fa-layer-group'} u-c-primary-text"></i>
          <span class="lst-grow"><strong>${new Date(v.createdAt).toLocaleString('fa-IR')}</strong><small>${esc(v.note || (v.mode === 'html' ? 'کد HTML' : 'فرم‌ساز'))}${v.author ? ' · ' + esc(v.author) : ''}</small></span>
          <button type="button" class="lse-btn" data-click="lndRestore" data-click-args="${crvArgs(v.id)}"><i class="fa-solid fa-rotate-left"></i> بازگردانی</button>
        </li>`).join('')}</ul>`
    : '<div class="lst-empty">هنوز نسخه‌ی قبلی‌ای نیست؛ بعد از اولین ذخیره‌ی محتوا اینجا می‌آید.</div>';
}

window.lndRestore = async function(versionId) {
  if (!lndEdit || !(await NopaConfirm('محتوای صفحه به این نسخه برگردد؟ محتوای فعلی هم به‌عنوان نسخه نگه داشته می‌شود.'))) return;
  try {
    await NopaApi.json(`${LND_API}/${encodeURIComponent(lndEdit.id)}/versions/${encodeURIComponent(versionId)}/restore`, { method: 'POST', body: '{}' });
    showToast('نسخه بازگردانده شد.', 'success');
    const id = lndEdit.id;
    lndEdit.dirty = false;
    await window.loadLandingTab();
    window.lndOpenEditor(id, 'content');
  } catch (err) { showToast(err.message || 'خطا در بازگردانی', 'error'); }
};

// ---- save / preview / duplicate / delete ----
window.lndSave = async function() {
  if (!lndEdit) return;
  const title = lndEl('lnd-title').value.trim();
  if (!title) { window.lndTab('info'); return showToast('عنوان صفحه را وارد کنید.', 'error'); }
  const mode = lndEl('lnd-mode').value;
  const wantHome = lndEl('lnd-home').checked;
  const body = {
    title, slug: lndEl('lnd-slug').value.trim().toLowerCase(), mode,
    isPublished: lndEl('lnd-published').checked || wantHome,
    metaTitle: lndEl('lnd-meta-title').value, metaDescription: lndEl('lnd-meta-desc').value, ogImage: lndEl('lnd-og-image').value,
    html: lndEl('lnd-html').value,
    builder: lndBuilderOut(),
  };
  if (mode === 'html' && !body.html.trim()) { window.lndTab('content'); return showToast('کد HTML صفحه خالی است.', 'error'); }
  const btn = lndEl('lnd-save-btn');
  if (btn) btn.disabled = true;
  try {
    await NopaApi.json(`${LND_API}/${encodeURIComponent(lndEdit.id)}`, { method: 'PUT', body: JSON.stringify(body) });
    if (wantHome !== !!lndEdit.page.isHome) {
      await NopaApi.json(`${LND_API}/${encodeURIComponent(lndEdit.id)}/home`, { method: 'POST', body: JSON.stringify({ home: wantHome }) });
    }
    showToast(wantHome ? 'ذخیره شد؛ این صفحه، صفحه اصلی سایت است.' : body.isPublished ? 'ذخیره و منتشر شد.' : 'ذخیره شد (پیش‌نویس).', 'success');
    const id = lndEdit.id;
    lndEdit.dirty = false;
    await window.loadLandingTab();
    const tab = document.querySelector('#lnd-editor-modal [data-lnd-tab].is-active')?.dataset.lndTab;
    window.lndOpenEditor(id, tab);
  } catch (err) {
    showToast(err.message || 'خطا در ذخیره صفحه', 'error');
  } finally { if (btn) btn.disabled = false; }
};

window.lndPreview = async function() {
  if (!lndEdit) return;
  // the window opens now (a popup opened after an await is blocked), the address arrives after the request
  const win = window.open('', '_blank');
  try {
    if (lndEdit.dirty) showToast('پیش‌نمایش، آخرین نسخه‌ی ذخیره‌شده است؛ تغییرات تازه را اول ذخیره کنید.', 'info');
    const data = await NopaApi.json(`${LND_API}/${encodeURIComponent(lndEdit.id)}/preview-link`);
    if (win) { win.opener = null; win.location.href = data.url; } else window.open(data.url, '_blank', 'noopener');
  } catch (err) {
    if (win) win.close();
    showToast(err.message || 'خطا در پیش‌نمایش', 'error');
  }
};

window.lndDuplicate = async function() {
  if (!lndEdit) return;
  try {
    const copy = await NopaApi.json(`${LND_API}/${encodeURIComponent(lndEdit.id)}/duplicate`, { method: 'POST', body: '{}' });
    showToast('کپی صفحه ساخته شد (پیش‌نویس).', 'success');
    lndEdit.dirty = false;
    await window.loadLandingTab();
    window.lndOpenEditor(copy.id);
  } catch (err) { showToast(err.message || 'خطا در کپی صفحه', 'error'); }
};

window.lndDelete = async function() {
  if (!lndEdit) return;
  const p = lndEdit.page;
  if (!(await NopaConfirm(`صفحه «${p.title}» و همه‌ی نسخه‌هایش حذف شود؟${p.isHome ? ' این صفحه، صفحه اصلی سایت است.' : ''}`))) return;
  try {
    await NopaApi.json(`${LND_API}/${encodeURIComponent(lndEdit.id)}`, { method: 'DELETE' });
    showToast('صفحه حذف شد.', 'success');
    lndEdit = null;
    const m = lndEl('lnd-editor-modal');
    if (m) m.style.display = 'none';
    await window.loadLandingTab();
  } catch (err) { showToast(err.message || 'خطا در حذف صفحه', 'error'); }
};
