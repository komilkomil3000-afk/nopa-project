// Media manager: the files stored on the server (uploads folder), upload, delete.
// A bento like the stations / caravans tabs (#mdm-overview-view): file cards with storage stats; a card opens the
// file's dialog (preview, link, delete); "select" mode turns cards into checkboxes for one bulk delete.
// Split out of the former app.js (Phase 7). Classic script: shares globals with the other modules;
// load order is set in index.html. Styles: css/stations.css (.lst-*, .crv-*, .mdm-*).
// Data: GET /admin/media/files, POST /admin/media/files/delete, POST /media/upload.
let _storedFiles = [];
let _storedTotal = 0;
let mdmLoaded = false;
let mdmShown = 48;              // cards drawn; "more" adds a page
let mdmSelecting = false;
const mdmPicked = new Set();    // paths picked in select mode
let mdmOpenPath = null;         // the file in the dialog

const MDM_PAGE = 48;
const MDM_BIG = 50 * 1024 * 1024;
const MDM_KIND = {
  image: { label: 'تصویر', icon: 'fa-image', cls: 'active' },
  video: { label: 'ویدیو', icon: 'fa-video', cls: 'scheduled' },
  audio: { label: 'صوت', icon: 'fa-music', cls: 'locked' },
  doc: { label: 'سند', icon: 'fa-file-lines', cls: 'rest' },
};
const MDM_ASSET = { general: 'عمومی', course_video: 'ویدیوی آموزشی', banner: 'بنر اپلیکیشن', avatar: 'آواتار' };

function _fileKind(mime) {
  mime = String(mime || '');
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'doc';
}

function _fmtSize(bytes) {
  bytes = Number(bytes || 0);
  const fa = (n, d) => Number(n.toFixed(d)).toLocaleString('fa-IR');
  if (bytes < 1024) return fa(bytes, 0) + ' بایت';
  if (bytes < 1024 * 1024) return fa(bytes / 1024, 1) + ' کیلوبایت';
  if (bytes < 1024 * 1024 * 1024) return fa(bytes / (1024 * 1024), 1) + ' مگابایت';
  return fa(bytes / (1024 * 1024 * 1024), 2) + ' گیگابایت';
}
function mdmFind(p) { return _storedFiles.find(f => f.path === p) || null; }
function mdmTitle(f) { return f.title || f.name || f.path; }
function mdmFolder(f) { const i = f.path.lastIndexOf('/'); return i > 0 ? f.path.slice(0, i) : 'uploads'; }
function mdmAbs(f) { return window.location.origin + f.url; }

// ==================== LOADER ====================
async function loadMediaAssets() {
  window.mdmSetLoading(true);
  try {
    const res = await request('/api/v1/admin/media/files');
    if (!res.ok) throw new Error('خطا در دریافت فهرست فایل‌ها');
    const data = await res.json();
    _storedFiles = data.files || [];
    _storedTotal = data.totalSize || _storedFiles.reduce((s, f) => s + (f.size || 0), 0);
    mdmLoaded = true;
    // picks of files that are gone are dropped
    Array.from(mdmPicked).forEach(p => { if (!mdmFind(p)) mdmPicked.delete(p); });
    window.mdmSetLoading(false);
    window.filterMediaFiles(true);
  } catch (err) {
    console.error('Failed to load stored files:', err);
    window.mdmSetLoading(false);
    const grid = document.getElementById('mdm-bento-list');
    if (grid) grid.innerHTML = `<div class="lst-empty"><i class="fa-solid fa-triangle-exclamation lst-warn"></i> ${esc(err.message)}</div>`;
  }
}
window.loadMediaAssets = loadMediaAssets;

// ==================== OVERVIEW (BENTO) ====================
// keepPage: a refresh keeps the cards already shown; a new filter starts from the first page
window.filterMediaFiles = function(keepPage) {
  if (keepPage !== true) mdmShown = MDM_PAGE;
  const overview = document.getElementById('mdm-overview-view');
  if (window.NopaFlip && overview) window.NopaFlip.render(overview, mdmDraw); else mdmDraw();
};
window.renderStoredFiles = window.filterMediaFiles; // old name
window.mdmShowMore = function() { mdmShown += MDM_PAGE; window.filterMediaFiles(true); };

function mdmFiltered() {
  const q = (document.getElementById('files-search')?.value || '').trim().toLowerCase();
  const kind = document.getElementById('files-type-filter')?.value || '';
  const sort = document.getElementById('mdm-sort')?.value || 'new';
  const by = {
    new: (a, b) => String(b.modifiedAt).localeCompare(String(a.modifiedAt)),
    old: (a, b) => String(a.modifiedAt).localeCompare(String(b.modifiedAt)),
    big: (a, b) => (b.size || 0) - (a.size || 0),
    name: (a, b) => String(a.name).localeCompare(String(b.name)),
  };
  return _storedFiles.filter(f =>
    (!q || f.path.toLowerCase().includes(q) || (f.title || '').toLowerCase().includes(q)) &&
    (!kind || _fileKind(f.mimeType) === kind)).sort(by[sort] || by.new);
}

function mdmCard(f) {
  const k = _fileKind(f.mimeType);
  const picked = mdmPicked.has(f.path);
  const thumb = k === 'image'
    ? `<span class="mdc-thumb mdm-thumb"><img src="${esc(f.url)}" alt="" loading="lazy" data-error="lmsImageFallback" data-error-args='["$this", "${crvInitial(f.name)}"]'></span>`
    : `<span class="mdc-thumb mdm-thumb is-icon is-${k}"><i class="fa-solid ${MDM_KIND[k].icon}"></i></span>`;
  return `
    <button type="button" class="crv-card mdm-card${picked ? ' is-picked' : ''}${mdmSelecting ? ' is-selecting' : ''}" data-anim-key="mf:${esc(f.path)}" data-click="mdmCardClick" data-click-args="${crvArgs(f.path)}" title="${esc(f.path)}"${mdmSelecting ? ` aria-pressed="${picked}"` : ''}>
      ${thumb}
      ${mdmSelecting ? `<span class="mdm-check"><i class="fa-solid ${picked ? 'fa-square-check' : 'fa-square'}"></i></span>` : ''}
      <span class="crv-card-name mdm-name"><strong>${esc(mdmTitle(f))}</strong>${f.tracked ? '' : '<span class="lst-chip lst-chip-scheduled" title="این فایل از آپلود پنل ثبت نشده است"><i class="fa-solid fa-circle-question"></i> بدون مشخصات</span>'}</span>
      <span class="crv-card-mentor"><i class="fa-solid fa-folder"></i><span dir="ltr">${esc(mdmFolder(f))}</span></span>
      <span class="crv-card-foot">
        <span class="crv-card-nums">
          <span class="${f.size >= MDM_BIG ? 'u-c-danger-text' : 'u-c-primary-text'}"><i class="fa-solid fa-weight-hanging"></i> ${esc(_fmtSize(f.size))}</span>
          <span class="u-c-text-muted"><i class="fa-regular fa-clock"></i> ${esc(new Date(f.modifiedAt).toLocaleDateString('fa-IR'))}</span>
        </span>
      </span>
    </button>`;
}

function mdmDraw() {
  const all = _storedFiles;
  const list = mdmFiltered();
  const q = (document.getElementById('files-search')?.value || '').trim();
  const filtering = !!q || !!document.getElementById('files-type-filter')?.value;

  const badge = document.getElementById('mdm-count-badge');
  if (badge) badge.textContent = filtering ? `نمایش ${crvFa(list.length)} از ${crvFa(all.length)}` : 'پوشه uploads — برای جزئیات هر فایل بزنید';

  const grid = document.getElementById('mdm-bento-list');
  if (grid) {
    const cards = list.slice(0, mdmShown).map(mdmCard);
    if (!filtering && !mdmSelecting) cards.push(`
      <button type="button" class="crv-card crv-card-add" data-anim-key="mf-add" data-click="mdmOpenUpload" title="آپلود فایل">
        <span class="lsv-round lsv-round-lg"><i class="fa-solid fa-cloud-arrow-up"></i></span><span>آپلود فایل</span>
      </button>`);
    else if (!list.length) cards.push('<div class="lst-empty" data-anim-key="mf-empty">فایلی یافت نشد.</div>');
    grid.innerHTML = cards.join('');
    grid.setAttribute('aria-busy', 'false');
  }
  const more = document.getElementById('mdm-more');
  if (more) more.hidden = list.length <= mdmShown;
  mdmDrawSelbar();

  const of = k => all.filter(f => _fileKind(f.mimeType) === k);
  const setStat = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setStat('mdm-stat-count', crvFa(all.length));
  setStat('files-summary', _fmtSize(_storedTotal));
  setStat('mdm-stat-images', crvFa(of('image').length));
  setStat('mdm-stat-videos', crvFa(of('video').length));

  const storage = document.getElementById('mdm-bento-storage');
  if (storage) {
    const keys = Object.keys(MDM_KIND);
    const size = k => of(k).reduce((s, f) => s + (f.size || 0), 0);
    const w = k => (_storedTotal ? Math.max(size(k) ? 1 : 0, Math.round((size(k) / _storedTotal) * 100)) : 0);
    const bar = c => (c === 'rest' ? 'mdc-bar-rest' : 'lst-bar-' + c);
    const dot = c => (c === 'rest' ? 'mdc-dot-rest' : 'lst-dot-' + c);
    storage.innerHTML = all.length ? `
      <div class="lst-bar">${keys.filter(size).map(k => `<span class="${bar(MDM_KIND[k].cls)}" data-style="width:${w(k)}%"></span>`).join('')}</div>
      <div class="lst-legend">${keys.map(k => `<div class="lst-legend-row"><span><span class="lst-dot ${dot(MDM_KIND[k].cls)}"></span>${MDM_KIND[k].label} (${crvFa(of(k).length)})</span><strong>${esc(_fmtSize(size(k)))}</strong></div>`).join('')}</div>`
      : '<div class="lst-empty">فایلی روی سرور نیست.</div>';
  }

  const big = document.getElementById('mdm-bento-big');
  if (big) {
    const rows = all.slice().sort((a, b) => (b.size || 0) - (a.size || 0)).slice(0, 5);
    big.innerHTML = rows.length ? `<ul class="lst-list">${rows.map((f, i) => `
      <li class="lst-list-item lst-clickable" role="button" tabindex="0" data-anim-key="mb:${esc(f.path)}" data-click="mdmOpenFile" data-click-args="${crvArgs(f.path)}">
        <span class="crv-rank">${crvFa(i + 1)}</span>
        <span class="lst-grow"><strong>${esc(mdmTitle(f))}</strong></span>
        <span class="u-c-primary-text">${esc(_fmtSize(f.size))}</span>
      </li>`).join('')}</ul>` : '<div class="lst-empty">فایلی روی سرور نیست.</div>';
  }

  const health = document.getElementById('mdm-bento-health');
  if (health) {
    const huge = all.filter(f => f.size >= MDM_BIG);
    const untracked = all.filter(f => !f.tracked);
    const items = [];
    if (huge.length) items.push(`<li class="lst-list-item lst-clickable" role="button" tabindex="0" data-anim-key="mh-big" data-click="mdmFilterSort" data-click-args='["big"]'>
      <i class="fa-solid fa-triangle-exclamation lst-warn"></i><span class="lst-grow"><strong>${crvFa(huge.length)} فایل</strong> بزرگ‌تر از ۵۰ مگابایت (${esc(_fmtSize(huge.reduce((s, f) => s + f.size, 0)))})</span></li>`);
    huge.slice(0, 3).forEach(f => items.push(`<li class="lst-list-item lst-clickable" role="button" tabindex="0" data-anim-key="mh:${esc(f.path)}" data-click="mdmOpenFile" data-click-args="${crvArgs(f.path)}">
      <i class="fa-solid fa-weight-hanging lst-warn"></i><span class="lst-grow"><strong>${esc(mdmTitle(f))}</strong>: ${esc(_fmtSize(f.size))}</span></li>`));
    if (untracked.length) items.push(`<li class="lst-list-item" data-anim-key="mh-untracked">
      <i class="fa-solid fa-circle-question lst-warn"></i><span class="lst-grow"><strong>${crvFa(untracked.length)} فایل</strong> بدون مشخصات (آپلودشده از اپ یا بخش‌های دیگر؛ پیش از حذف مطمئن شوید جایی استفاده نمی‌شوند)</span></li>`);
    health.innerHTML = items.length ? `<ul class="lst-list">${items.join('')}</ul>`
      : '<div class="lst-empty"><i class="fa-solid fa-circle-check u-c-success-text"></i> مورد خاصی نیست.</div>';
  }
}

window.mdmFilterSort = function(sort) {
  const sel = document.getElementById('mdm-sort');
  if (sel) sel.value = sort;
  window.filterMediaFiles();
  document.getElementById('mdm-bento-list')?.scrollIntoView({ block: 'start', behavior: NopaMotion.scrollBehavior() });
};

window.mdmSetLoading = function(on) {
  const overview = document.getElementById('mdm-overview-view');
  if (!overview) return;
  overview.querySelectorAll('.lst-bento > .lst-tile').forEach(t => t.classList.toggle('is-loading', on));
  const grid = document.getElementById('mdm-bento-list');
  if (grid) grid.setAttribute('aria-busy', on ? 'true' : 'false');
  if (!on || mdmLoaded) return;
  if (grid) grid.innerHTML = Array.from({ length: 8 }, () => `
    <div class="crv-card mdm-card lst-skel" aria-hidden="true">
      <span class="mdc-thumb mdm-thumb"></span>
      <span class="lst-skel-line"></span><span class="lst-skel-line lst-skel-short"></span>
    </div>`).join('');
  const lines = '<div class="lst-skel-lines" aria-hidden="true">' + '<span class="lst-skel-row"></span>'.repeat(3) + '</div>';
  ['mdm-bento-storage', 'mdm-bento-big', 'mdm-bento-health'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = lines; });
};

// ==================== SELECT MODE ====================
window.mdmToggleSelect = function() {
  mdmSelecting = !mdmSelecting;
  if (!mdmSelecting) mdmPicked.clear();
  const btn = document.getElementById('mdm-select-toggle');
  if (btn) btn.classList.toggle('is-active', mdmSelecting);
  window.filterMediaFiles(true);
};
function mdmDrawSelbar() {
  const bar = document.getElementById('mdm-selbar');
  if (!bar) return;
  bar.hidden = !mdmSelecting;
  const n = mdmPicked.size;
  const size = Array.from(mdmPicked).reduce((s, p) => s + ((mdmFind(p) || {}).size || 0), 0);
  const count = document.getElementById('mdm-sel-count');
  if (count) count.textContent = n ? `${crvFa(n)} فایل انتخاب شده (${_fmtSize(size)})` : 'روی فایل‌ها بزنید تا انتخاب شوند';
  const del = bar.querySelector('.mdm-del-btn');
  if (del) del.disabled = !n;
}
window.mdmCardClick = function(p) {
  if (!mdmSelecting) return window.mdmOpenFile(p);
  if (mdmPicked.has(p)) mdmPicked.delete(p); else mdmPicked.add(p);
  // only this card and the bar change
  const card = Array.from(document.querySelectorAll('#mdm-bento-list .mdm-card')).find(c => c.dataset.animKey === 'mf:' + p);
  if (card) {
    const on = mdmPicked.has(p);
    card.classList.toggle('is-picked', on);
    card.setAttribute('aria-pressed', String(on));
    const icon = card.querySelector('.mdm-check i');
    if (icon) icon.className = `fa-solid ${on ? 'fa-square-check' : 'fa-square'}`;
  }
  mdmDrawSelbar();
};
window.mdmSelectVisible = function() {
  mdmFiltered().slice(0, mdmShown).forEach(f => mdmPicked.add(f.path));
  window.filterMediaFiles(true);
};
window.mdmDeleteSelected = function() { deleteStoredFiles(Array.from(mdmPicked)); };

// ==================== ONE FILE ====================
window.mdmOpenFile = function(p) {
  const f = mdmFind(p);
  const modal = document.getElementById('mdm-file-modal');
  if (!f || !modal) return;
  mdmOpenPath = p;
  const k = _fileKind(f.mimeType);
  document.getElementById('mdm-file-icon').innerHTML = `<i class="fa-solid ${MDM_KIND[k].icon}"></i>`;
  document.getElementById('mdm-file-title').textContent = mdmTitle(f);
  document.getElementById('mdm-file-sub').textContent = `${MDM_KIND[k].label} · ${_fmtSize(f.size)}`;
  document.getElementById('mdm-file-open').href = f.url;
  let preview = '';
  if (k === 'image') preview = `<a class="mdm-preview" href="${esc(f.url)}" target="_blank" rel="noopener"><img src="${esc(f.url)}" alt="${esc(f.name)}"></a>`;
  else if (k === 'video') preview = `<div class="mdm-preview"><video controls preload="metadata" src="${esc(f.url)}"></video></div>`;
  else if (k === 'audio') preview = `<div class="mdm-preview is-audio"><audio controls preload="metadata" src="${esc(f.url)}"></audio></div>`;
  else preview = `<div class="mdm-preview is-icon"><i class="fa-solid ${MDM_KIND[k].icon}"></i></div>`;
  const fact = (icon, label, value, ltr) => `
    <div class="aud-fact"><span><i class="fa-solid ${icon}"></i> ${label}</span><strong${ltr ? ' dir="ltr"' : ''}>${esc(value || '-')}</strong></div>`;
  document.getElementById('mdm-file-body').innerHTML = `
    <section class="lse-card">${preview}</section>
    <section class="lse-card">
      <h4 class="lse-card-title"><i class="fa-solid fa-link"></i> لینک مستقیم</h4>
      <div class="mdm-link"><input type="text" readonly class="input-ctrl" dir="ltr" value="${esc(mdmAbs(f))}" aria-label="لینک مستقیم" data-click="mdmSelectAll" data-click-args='["$this"]'>
        <button type="button" class="lsv-round" data-click="mdmCopyOpen" title="کپی لینک" aria-label="کپی لینک"><i class="fa-solid fa-copy"></i></button></div>
    </section>
    <section class="lse-card">
      <h4 class="lse-card-title"><i class="fa-solid fa-circle-info"></i> مشخصات</h4>
      <div class="aud-facts">
        ${fact('fa-file', 'نام فایل', f.name, true)}
        ${fact('fa-folder', 'پوشه', mdmFolder(f), true)}
        ${fact('fa-code', 'نوع (MIME)', f.mimeType, true)}
        ${fact('fa-weight-hanging', 'حجم', _fmtSize(f.size))}
        ${fact('fa-tag', 'دسته', f.assetType ? (MDM_ASSET[f.assetType] || f.assetType) : (f.tracked ? '-' : 'بدون مشخصات'))}
        ${fact('fa-clock', 'آخرین تغییر', new Date(f.modifiedAt).toLocaleString('fa-IR'))}
      </div>
    </section>`;
  modal.style.display = 'flex';
  modal.style.zIndex = 'var(--z-modal)';
};
window.mdmSelectAll = function(input) { if (input) input.select(); };
window.mdmCopyOpen = function() {
  const f = mdmFind(mdmOpenPath);
  if (!f) return;
  navigator.clipboard.writeText(mdmAbs(f)).then(() => showToast('لینک کپی شد', 'success'), () => showToast('کپی ممکن نشد؛ لینک را دستی کپی کنید', 'error'));
};
window.mdmDeleteOpen = async function() {
  if (!mdmOpenPath) return;
  const done = await deleteStoredFiles([mdmOpenPath]);
  if (done) NopaActions.hide('mdm-file-modal');
};

async function deleteStoredFiles(paths) {
  if (!paths.length) return false;
  if (!(await NopaConfirm('حذف ' + paths.length.toLocaleString('fa-IR') + ' فایل از سرور؟ این کار قابل بازگشت نیست و اگر فایل در جایی از اپ استفاده شده باشد، دیگر نمایش داده نمی‌شود.'))) return false;
  let ok = false;
  try {
    const res = await request('/api/v1/admin/media/files/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      ok = true;
      const failed = data.failed && data.failed.length;
      showToast(Number(data.deleted || 0).toLocaleString('fa-IR') + ' فایل حذف شد' + (failed ? ' (' + failed.toLocaleString('fa-IR') + ' مورد ناموفق)' : ''), failed ? 'error' : 'success');
      paths.forEach(p => mdmPicked.delete(p));
      if (mdmSelecting && !mdmPicked.size) { mdmSelecting = false; document.getElementById('mdm-select-toggle')?.classList.remove('is-active'); }
    } else {
      showToast(data.error || 'خطا در حذف فایل', 'error');
    }
  } catch (err) {
    console.error(err);
  }
  await loadMediaAssets();
  return ok;
}

// ==================== UPLOAD ====================
window.mdmOpenUpload = function() {
  const modal = document.getElementById('mdm-upload-modal');
  if (!modal) return;
  modal.querySelector('form')?.reset();
  window.mdmFilePicked();
  modal.style.display = 'flex';
  modal.style.zIndex = 'var(--z-modal)';
};
window.mdmFilePicked = function() {
  const input = document.getElementById('media-file-input');
  const file = input && input.files && input.files[0];
  const name = document.getElementById('mdm-drop-name');
  const size = document.getElementById('mdm-drop-size');
  document.getElementById('mdm-drop')?.classList.toggle('has-file', !!file);
  if (name) name.textContent = file ? file.name : 'فایل را انتخاب کنید یا اینجا رها کنید';
  if (size) size.textContent = file ? `${_fmtSize(file.size)} · ${file.type || 'نوع نامشخص'}` : 'تصویر، ویدیو، صوت یا سند';
};

async function handleMediaUpload(e) {
  e.preventDefault();

  const fileInput = document.getElementById('media-file-input');
  if (fileInput.files.length === 0) return;

  const file = fileInput.files[0];
  const assetType = document.getElementById('media-asset-type').value;
  const title = document.getElementById('media-title').value;
  const instructor = document.getElementById('media-instructor').value;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('assetType', assetType);
  if (title) formData.append('title', title);
  if (instructor) formData.append('instructor', instructor);

  const btn = document.getElementById('btn-upload-media');
  const progressText = document.getElementById('media-upload-progress');

  try {
    btn.disabled = true;
    progressText.style.display = '';

    const res = await request('/api/v1/media/upload', {
      method: 'POST',
      body: formData
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      showToast('فایل با موفقیت آپلود شد!', 'success');
      NopaActions.hide('mdm-upload-modal');
      loadMediaAssets();
    } else {
      showToast(data.error || 'خطا در آپلود فایل', 'error');
    }
  } catch (err) {
    console.error('Upload Error:', err);
    showToast('خطا در ارتباط با سرور هنگام آپلود', 'error');
  } finally {
    btn.disabled = false;
    progressText.style.display = 'none';
  }
}

// Drop a file on the upload box
(function () {
  const drop = document.getElementById('mdm-drop');
  const input = document.getElementById('media-file-input');
  if (!drop || !input) return;
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('is-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', e => {
    e.preventDefault();
    drop.classList.remove('is-over');
    if (e.dataTransfer.files.length) { input.files = e.dataTransfer.files; window.mdmFilePicked(); }
  });
})();

if (!mdmLoaded) window.mdmSetLoading(true);
