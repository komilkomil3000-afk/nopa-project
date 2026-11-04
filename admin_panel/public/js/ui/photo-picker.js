// Pictures of people and caravans, edited in place on the page (no dialog). Loaded before the feature modules.
//   nopaImgSrc(url)              -> a src the browser can show: the app's bundled pictures (`asset:boy_2`) become
//                                   /images/avatars/boy_2.jpg (copies of app/assets/avatars); other links are kept.
//   NopaPhoto.slot(key)          -> markup of the place the editor opens in (put it in the card that shows the picture)
//   NopaPhoto.toggle(key, opts)  -> opens the editor in [data-nph-slot="key"], or closes it when it is open there
//       opts: name, current (picture set now, '' = none), app (people: the app's picture, shown read-only beside it),
//             hint, onSave(url | null) async (null removes; throw to keep the editor open)
//   NopaPhoto.remount()          -> call after redrawing a card: puts an open editor back into its slot
//   NopaPhoto.close()
// A picture comes from an upload (kept in the media library as assetType "avatar"), a link, or the pictures already on
// the server (GET /api/v1/admin/media/files).
(function () {
  const BUNDLED = /^asset:(boy_[1-4]|girl_[1-4]|mentor_male|mentor_female)$/;

  function nopaImgSrc(url) {
    const s = String(url || '').trim();
    if (!s) return '';
    if (s.startsWith('asset:')) {
      const m = s.match(BUNDLED);
      return m ? `/images/avatars/${m[1]}.jpg` : '';
    }
    return s;
  }
  window.nopaImgSrc = nopaImgSrc;

  const escHtml = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initial = name => escHtml(String(name || '؟').trim().charAt(0) || '؟');

  let active = null;  // { key, opts, chosen, saving, uploading, showAll }
  let library = null; // [{ url, title, assetType }] once fetched

  const slotEl = key => document.querySelector(`[data-nph-slot="${CSS.escape(key)}"]`);

  function slot(key) {
    return `<div class="nph-inline" data-nph-slot="${escHtml(key)}" hidden></div>`;
  }

  function pic(src, name) {
    const s = nopaImgSrc(src);
    return s ? `<span class="nph-photo"><img src="${escHtml(s)}" alt="" loading="lazy"></span>` : `<span class="nph-photo">${initial(name)}</span>`;
  }

  function libraryHtml() {
    if (library === null) return '<span class="nph-lib-item lst-skel"></span>'.repeat(6);
    const own = library.filter(f => f.assetType === 'avatar');
    const list = active.showAll || !own.length ? library : own;
    if (!list.length) return '<div class="lsv-col-empty">هنوز عکسی روی سرور نیست؛ با «آپلود» اولین را اضافه کنید.</div>';
    return list.map(f => `<button type="button" class="nph-lib-item${f.url === active.chosen ? ' is-active' : ''}" data-nph="pick" data-url="${escHtml(f.url)}" title="${escHtml(f.title || f.name || '')}" aria-label="انتخاب این عکس"><img src="${escHtml(f.url)}" alt="" loading="lazy"></button>`).join('');
  }

  function draw() {
    if (!active) return;
    const el = slotEl(active.key);
    if (!el) return;
    const o = active.opts;
    const hasApp = o.app !== undefined;
    const own = library ? library.filter(f => f.assetType === 'avatar').length : 0;
    const changed = (active.chosen || '') !== (o.current || '');
    el.hidden = false;
    el.innerHTML = `
      <div class="nph-pair">
        ${hasApp ? `<div class="nph-slot">${pic(o.app, o.name)}<strong>عکس اپ</strong><small>${o.app ? 'انتخاب خود کاربر' : 'انتخاب نشده'}</small></div>` : ''}
        <div class="nph-slot is-site">${pic(active.chosen, o.name)}<strong>${hasApp ? 'عکس سایت' : 'عکس'}</strong><small>${changed ? 'ذخیره نشده' : active.chosen ? 'فعلی' : hasApp ? 'خالی: عکس اپ نمایش داده می‌شود' : 'بدون عکس'}</small></div>
      </div>
      ${o.hint ? `<p class="nph-hint">${escHtml(o.hint)}</p>` : ''}
      <div class="nph-row">
        <input type="text" class="input-ctrl" data-nph-url dir="ltr" placeholder="https://... یا /uploads/..." aria-label="آدرس عکس" value="${escHtml(active.chosen.startsWith('asset:') ? '' : active.chosen)}">
        <label class="lse-btn lse-upload"><i class="fa-solid ${active.uploading ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-up'}"></i> ${active.uploading ? 'در حال آپلود' : 'آپلود'}
          <input type="file" accept="image/*" data-nph-file hidden></label>
      </div>
      <div class="nph-lib-head">
        <span><i class="fa-solid fa-images"></i> عکس‌های روی سرور</span>
        ${library && own && own < library.length ? `<button type="button" class="nph-link" data-nph="all">${active.showAll ? 'فقط عکس‌های پروفایل' : 'همه تصاویر سایت'}</button>` : ''}
      </div>
      <div class="nph-lib">${libraryHtml()}</div>
      <div class="nph-actions">
        ${o.current ? '<button type="button" class="lse-btn urp-danger" data-nph="remove"><i class="fa-solid fa-trash"></i> حذف</button>' : '<span></span>'}
        <span class="nph-actions-end">
          <button type="button" class="lse-btn" data-nph="close">انصراف</button>
          <button type="button" class="lsv-pill" data-nph="save"${!changed || active.saving ? ' disabled' : ''}><i class="fa-solid ${active.saving ? 'fa-spinner fa-spin' : 'fa-check'}"></i> ذخیره</button>
        </span>
      </div>`;
  }

  async function loadLibrary() {
    try {
      const data = await NopaApi.json('/api/v1/admin/media/files', { silent: true });
      const images = (data.files || []).filter(f => String(f.mimeType || '').startsWith('image/'));
      // the pictures uploaded for people and caravans first, then the other images of the site
      library = images.filter(f => f.assetType === 'avatar').concat(images.filter(f => f.assetType !== 'avatar')).slice(0, 120);
    } catch (_) {
      library = [];
    }
    draw();
  }

  async function upload(input) {
    const file = input.files && input.files[0];
    if (!file || !active) return;
    const mine = active;
    mine.uploading = true;
    draw();
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('assetType', 'avatar');
      if (mine.opts.name) form.append('title', mine.opts.name);
      const data = await NopaApi.json('/api/v1/media/upload', { method: 'POST', body: form });
      const url = data.url || (data.media && data.media.url) || '';
      if (!url) throw new Error('آدرس فایل برنگشت');
      mine.chosen = url;
      if (library) library.unshift({ url, title: mine.opts.name, assetType: 'avatar' });
    } catch (err) {
      showToast('خطا در آپلود عکس: ' + (err.message || ''), 'error');
    } finally {
      mine.uploading = false;
      if (active === mine) draw();
    }
  }

  async function save(url) {
    if (!active || active.saving) return;
    const mine = active;
    mine.saving = true;
    draw();
    try {
      await mine.opts.onSave(url);
      showToast(url ? 'عکس ذخیره شد.' : 'عکس حذف شد.', 'success');
      if (active === mine) close();
    } catch (err) {
      showToast(err.message || 'ذخیره عکس انجام نشد', 'error');
      mine.saving = false;
      if (active === mine) draw();
    }
  }

  function close() {
    if (!active) return;
    const el = slotEl(active.key);
    active = null;
    if (el) { el.hidden = true; el.innerHTML = ''; }
  }

  function toggle(key, opts) {
    if (active && active.key === key) { close(); return; }
    close();
    if (!slotEl(key)) return;
    const o = opts || {};
    active = { key, opts: o, chosen: String(o.current || ''), saving: false, uploading: false, showAll: false };
    draw();
    const el = slotEl(key);
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest', behavior: window.NopaMotion ? NopaMotion.scrollBehavior() : 'auto' });
    if (library === null) loadLibrary();
  }

  function remount() {
    if (!active) return;
    if (slotEl(active.key)) draw(); else active = null;
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-nph]');
    if (!btn || !active || !btn.closest('[data-nph-slot]')) return;
    const act = btn.dataset.nph;
    if (act === 'close') close();
    else if (act === 'save') save(active.chosen || null);
    else if (act === 'remove') save(null);
    else if (act === 'all') { active.showAll = !active.showAll; draw(); }
    else if (act === 'pick') { active.chosen = btn.dataset.url || ''; draw(); }
  });
  document.addEventListener('input', e => {
    if (!active || !e.target.matches || !e.target.matches('[data-nph-url]')) return;
    active.chosen = e.target.value.trim();
    // redraw everything but the field being typed in
    const el = slotEl(active.key);
    const site = el && el.querySelector('.nph-slot.is-site .nph-photo');
    if (site) site.outerHTML = pic(active.chosen, active.opts.name);
    const saveBtn = el && el.querySelector('[data-nph="save"]');
    if (saveBtn) saveBtn.disabled = (active.chosen || '') === (active.opts.current || '');
  });
  document.addEventListener('change', e => {
    if (active && e.target.matches && e.target.matches('[data-nph-file]')) upload(e.target);
  });

  window.NopaPhoto = { slot, toggle, remount, close };
})();
