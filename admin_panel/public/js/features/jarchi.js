// Jarchi: the app's news board and banners.
// One bento like the other tabs (#jch-overview-view): news cards with filters, stats and categories, and a
// full-width strip of the banners; a card opens its lse dialog (#news-modal / #banner-modal).
// Split out of the former app.js (Phase 7). Classic script: shares globals with the other modules;
// load order is set in index.html. Styles: css/stations.css (.lst-*, .crv-*, .jch-*).
// Data: GET/POST/PUT/DELETE /admin/news and /admin/banners (multipart, image in `image`).
window.cachedBannerList = [];
window.cachedNewsList = [];
let jchNewsLoaded = false;
let jchBannersLoaded = false;

const JCH_CATEGORY = {
  'اطلاعیه مهم': ['fa-circle-exclamation', 'locked'],
  'رویداد و مسابقه': ['fa-trophy', 'scheduled'],
  'اخبار کاروان‌ها': ['fa-compass', 'active'],
  'آموزشی': ['fa-graduation-cap', 'rest'],
};
const JCH_AUDIENCE = { ALL: ['عمومی', 'fa-users'], STUDENTS: ['نوجوانان', 'fa-user-graduate'], MENTORS: ['راهبران', 'fa-user-tie'] };
const JCH_POSITION = {
  home_top: ['بالای صفحه اصلی', 'fa-house'],
  bazaar_top: ['بالای صفحه بازار', 'fa-store'],
  challenges_top: ['بالای صفحه چالش‌ها', 'fa-trophy'],
  lms_slider: ['آموزش و منزلگاه', 'fa-graduation-cap'],
  general: ['عمومی', 'fa-globe'],
};
const jchFa = n => Number(n || 0).toLocaleString('fa-IR');
const jchActive = b => b.isActive === true || b.isActive === 1 || b.isActive === 'true';
function jchState(n) {
  if (!n.isPublished) return 'draft';
  return n.publishDate && new Date(n.publishDate) > new Date() ? 'scheduled' : 'published';
}
function jchStateChip(n) {
  const s = jchState(n);
  if (s === 'published') return '<span class="lst-chip lst-chip-active"><i class="fa-solid fa-check"></i> منتشرشده</span>';
  if (s === 'scheduled') return '<span class="lst-chip lst-chip-scheduled"><i class="fa-solid fa-clock"></i> زمان‌بندی‌شده</span>';
  return '<span class="lst-chip lst-chip-locked"><i class="fa-solid fa-file-pen"></i> پیش‌نویس</span>';
}
function jchLocalIso(d) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function jchShow(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.style.display = 'flex';
  m.style.zIndex = 'var(--z-modal)';
}
function jchPreview(previewId, src) {
  const preview = document.getElementById(previewId);
  if (!preview) return;
  preview.src = src || '';
  preview.style.display = src ? 'block' : 'none';
  preview.closest('.jch-drop')?.classList.toggle('has-image', !!src);
}

// The tab's loader (router)
window.loadNewsAndBanners = function() {
  jchSetLoading(true);
  return Promise.all([window.loadNewsTab(), window.loadBannersTab()]).finally(() => jchSetLoading(false));
};
window.switchJarchiSubTab = function() { window.loadNewsAndBanners(); }; // old name: there are no sub tabs any more

function jchSetLoading(on) {
  document.querySelectorAll('#jch-overview-view .lst-bento > .lst-tile').forEach(t => t.classList.toggle('is-loading', on));
  if (!on) return;
  const skel = n => Array.from({ length: n }, () => `
    <div class="crv-card jch-card lst-skel" aria-hidden="true"><span class="mdc-thumb"></span>
      <span class="lst-skel-line"></span><span class="lst-skel-line lst-skel-short"></span></div>`).join('');
  if (!jchNewsLoaded) { const g = document.getElementById('news-tbody'); if (g) g.innerHTML = skel(6); }
  if (!jchBannersLoaded) { const g = document.getElementById('banners-tbody'); if (g) g.innerHTML = skel(4); }
  const lines = '<div class="lst-skel-lines" aria-hidden="true">' + '<span class="lst-skel-row"></span>'.repeat(3) + '</div>';
  ['jch-bento-categories', 'jch-bento-positions'].forEach(id => { const el = document.getElementById(id); if (el && !(jchNewsLoaded && jchBannersLoaded)) el.innerHTML = lines; });
}

// ==================== BANNERS ====================
window.loadBannersTab = async function() {
  const box = document.getElementById('banners-tbody');
  try {
    const res = await request('/api/v1/admin/banners');
    if (!res.ok) throw new Error('خطا در دریافت بنرها از سرور');
    const banners = await res.json();
    window.cachedBannerList = Array.isArray(banners) ? banners : [];
    jchBannersLoaded = true;
    window.jchDrawBanners();
  } catch (e) {
    console.error('Error loading banners:', e);
    if (box) box.innerHTML = `<div class="lst-empty"><i class="fa-solid fa-triangle-exclamation lst-warn"></i> ${esc(e.message || 'ارتباط با سرور برقرار نشد')}</div>`;
  }
};

window.jchDrawBanners = function() {
  const draw = () => {
    const all = window.cachedBannerList || [];
    const pos = document.getElementById('jch-banner-position')?.value || 'all';
    const list = all.filter(b => pos === 'all' || b.position === pos)
      .sort((a, b) => (jchActive(b) - jchActive(a)) || (a.position || '').localeCompare(b.position || '') || (a.orderIndex || 0) - (b.orderIndex || 0));

    const el = document.getElementById('banners-stat-active');
    if (el) el.textContent = `${jchFa(all.filter(jchActive).length)} از ${jchFa(all.length)}`;

    const box = document.getElementById('banners-tbody');
    if (box) {
      const cards = list.map(b => {
        const [pl, pi] = JCH_POSITION[b.position] || [b.position || '-', 'fa-map-pin'];
        const on = jchActive(b);
        return `
          <button type="button" class="crv-card jch-banner${on ? '' : ' is-off'}" data-anim-key="jb:${esc(b.id)}" data-click="editBanner" data-click-args="${esc(JSON.stringify([String(b.id)]))}" title="ویرایش بنر">
            <span class="jch-banner-img">${b.imageUrl
              ? `<img src="${esc(b.imageUrl)}" alt="${esc(b.title || '')}" loading="lazy" data-error="NopaActions.fallbackSrc" data-error-args="[&quot;$this&quot;,&quot;/uploads/banner1.jpg&quot;]">`
              : '<i class="fa-solid fa-image"></i>'}
              <span class="jch-banner-order" title="ترتیب نمایش">${jchFa(b.orderIndex ?? 0)}</span></span>
            <span class="crv-card-name"><strong>${esc(b.title || 'بدون عنوان')}</strong>${on
              ? '<span class="lst-chip lst-chip-active"><i class="fa-solid fa-check"></i> فعال</span>'
              : '<span class="lst-chip lst-chip-locked"><i class="fa-solid fa-pause"></i> غیرفعال</span>'}</span>
            <span class="crv-card-mentor"><i class="fa-solid ${pi}"></i><span>${esc(pl)}${b.targetRoute ? ` · <bdi dir="ltr">${esc(b.targetRoute)}</bdi>` : ''}</span></span>
          </button>`;
      });
      if (pos === 'all') cards.push(`
        <button type="button" class="crv-card crv-card-add jch-banner" data-anim-key="jb-add" data-click="openCreateBannerModal" title="بنر جدید">
          <span class="lsv-round lsv-round-lg"><i class="fa-solid fa-plus"></i></span><span>بنر جدید</span>
        </button>`);
      else if (!list.length) cards.push('<div class="lst-empty" data-anim-key="jb-empty">بنری در این جایگاه نیست.</div>');
      box.innerHTML = cards.join('');
      box.setAttribute('aria-busy', 'false');
    }

    const positions = document.getElementById('jch-bento-positions');
    if (positions) {
      positions.innerHTML = `<ul class="lst-list">${Object.keys(JCH_POSITION).map(k => {
        const inPos = all.filter(b => b.position === k);
        const on = inPos.filter(jchActive).length;
        return `<li class="lst-list-item${inPos.length ? ' lst-clickable' : ''}"${inPos.length ? ` role="button" tabindex="0" data-click="jchFilterPosition" data-click-args="${esc(JSON.stringify([k]))}"` : ''} data-anim-key="jp:${k}">
          <i class="fa-solid ${JCH_POSITION[k][1]} ${on ? 'u-c-primary-text' : 'u-c-text-muted'}"></i>
          <span class="lst-grow">${esc(JCH_POSITION[k][0])}</span>
          <span class="${on ? 'u-c-success-text' : 'u-c-text-muted'}">${jchFa(on)} فعال${inPos.length > on ? ` / ${jchFa(inPos.length)}` : ''}</span></li>`;
      }).join('')}</ul>`;
    }
  };
  const view = document.getElementById('jch-overview-view');
  if (window.NopaFlip && view) window.NopaFlip.render(view, draw); else draw();
};

window.jchFilterPosition = function(pos) {
  const sel = document.getElementById('jch-banner-position');
  if (sel) sel.value = pos;
  window.jchDrawBanners();
  document.getElementById('banners-tbody')?.scrollIntoView({ block: 'center', behavior: NopaMotion.scrollBehavior() });
};

window.toggleBannerStatus = async function(id, currentActive) {
  try {
    const formData = new FormData();
    formData.append('isActive', !currentActive);
    const res = await request(`/api/v1/admin/banners/${encodeURIComponent(id)}`, { method: 'PUT', body: formData });
    if (res.ok) {
      // «لغو» within 10s switches the banner back
      NopaUndo.afterEdit({
        message: !currentActive ? 'بنر فعال شد' : 'بنر غیرفعال شد',
        url: `/api/v1/admin/banners/${encodeURIComponent(id)}`,
        form: true,
        revert: { isActive: !!currentActive },
        done: () => window.loadBannersTab(),
      });
      window.loadBannersTab();
    }
  } catch (e) {
    console.error('Error toggling banner status:', e);
  }
};

window.previewBannerImage = function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => jchPreview('banner-image-preview', evt.target.result);
  reader.readAsDataURL(file);
};

window.openCreateBannerModal = function() {
  document.getElementById('banner-form')?.reset();
  document.getElementById('banner-id').value = '';
  document.getElementById('banner-modal-title').textContent = 'بنر جدید';
  document.getElementById('banner-file').required = true;
  document.getElementById('banner-delete-btn').hidden = true;
  const pos = document.getElementById('jch-banner-position')?.value;
  if (pos && pos !== 'all') document.getElementById('banner-position').value = pos;
  jchPreview('banner-image-preview', '');
  jchShow('banner-modal');
};

window.closeBannerModal = function() { NopaActions.hide('banner-modal'); };

window.editBanner = function(id) {
  const b = (window.cachedBannerList || []).find(x => String(x.id) === String(id));
  if (!b) return;
  document.getElementById('banner-form')?.reset();
  document.getElementById('banner-id').value = b.id || '';
  document.getElementById('banner-title').value = b.title || '';
  document.getElementById('banner-target').value = b.targetRoute || '';
  document.getElementById('banner-position').value = b.position || 'home_top';
  document.getElementById('banner-order').value = b.orderIndex ?? 0;
  document.getElementById('banner-active').checked = jchActive(b);
  document.getElementById('banner-file').required = !b.imageUrl;
  document.getElementById('banner-modal-title').textContent = `ویرایش بنر: ${b.title || ''}`;
  document.getElementById('banner-delete-btn').hidden = false;
  jchPreview('banner-image-preview', b.imageUrl || '');
  jchShow('banner-modal');
};

window.saveBannerItem = async function(e) {
  e.preventDefault();
  const id = document.getElementById('banner-id').value;
  const formData = new FormData();
  formData.append('title', document.getElementById('banner-title').value);
  formData.append('targetRoute', document.getElementById('banner-target').value);
  formData.append('position', document.getElementById('banner-position').value);
  formData.append('orderIndex', document.getElementById('banner-order').value);
  formData.append('isActive', document.getElementById('banner-active').checked);
  const fileInput = document.getElementById('banner-file');
  if (fileInput && fileInput.files[0]) formData.append('image', fileInput.files[0]);

  try {
    const res = await request(id ? `/api/v1/admin/banners/${encodeURIComponent(id)}` : '/api/v1/admin/banners', { method: id ? 'PUT' : 'POST', body: formData });
    if (res.ok) {
      const old = id ? (window.cachedBannerList || []).find(b => String(b.id) === String(id)) : null;
      if (old) {
        // «لغو» within 10s sends the changed fields back (a new picture is kept: the old file is not on this page)
        const newPicture = !!(fileInput && fileInput.files[0]);
        NopaUndo.afterEdit({
          message: newPicture ? 'بنر ویرایش شد (لغو، عکس جدید را برنمی‌گرداند)' : 'بنر ویرایش شد',
          url: `/api/v1/admin/banners/${encodeURIComponent(id)}`,
          form: true,
          body: formData,
          before: { ...old, isActive: jchActive(old) },
          done: () => window.loadBannersTab(),
        });
      } else {
        showToast('بنر جدید با موفقیت بارگذاری شد', 'success');
      }
      window.closeBannerModal();
      window.loadBannersTab();
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || 'خطا در ثبت بنر', 'error');
    }
  } catch (err) {
    console.error('Network error saving banner:', err);
    showToast('خطا در برقراری ارتباط با سرور', 'error');
  }
};

window.deleteBanner = async function(id) {
  if (!(await NopaConfirm('آیا از حذف این بنر اطمینان دارید؟'))) return false;
  // Gone from the strip at once; deleted on the server only if not undone within 10s
  // (the server still has it until then, so «لغو» just loads the banners again)
  NopaUndo.later({
    message: 'بنر حذف شد.',
    hide: () => {
      window.cachedBannerList = (window.cachedBannerList || []).filter(b => String(b.id) !== String(id));
      window.jchDrawBanners();
      return () => window.loadBannersTab();
    },
    commit: () => request(`/api/v1/admin/banners/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    done: () => window.loadBannersTab(),
  });
  return true;
};
window.jchDeleteOpenBanner = async function() {
  const id = document.getElementById('banner-id').value;
  if (id && (await window.deleteBanner(id))) window.closeBannerModal();
};

// ==================== NEWS ====================
window.loadNewsTab = async function() {
  const box = document.getElementById('news-tbody');
  try {
    const res = await request('/api/v1/admin/news');
    if (!res.ok) throw new Error('خطا در دریافت اطلاعات اخبار از سرور');
    const news = await res.json();
    window.cachedNewsList = Array.isArray(news) ? news : [];
    jchNewsLoaded = true;
    window.filterNewsTable();
  } catch (e) {
    console.error('Error loading news:', e);
    if (box) box.innerHTML = `<div class="lst-empty"><i class="fa-solid fa-triangle-exclamation lst-warn"></i> ${esc(e.message || 'ارتباط با سرور برقرار نشد')}</div>`;
  }
};

window.filterNewsTable = function() {
  const view = document.getElementById('jch-overview-view');
  if (window.NopaFlip && view) window.NopaFlip.render(view, jchDrawNews); else jchDrawNews();
};

function jchNewsCard(n) {
  const [ci] = JCH_CATEGORY[n.category] || ['fa-tag'];
  const [al, ai] = JCH_AUDIENCE[n.targetAudience] || JCH_AUDIENCE.ALL;
  const date = n.publishDate ? new Date(n.publishDate).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
  return `
    <button type="button" class="crv-card jch-card${jchState(n) === 'draft' ? ' is-draft' : ''}" data-anim-key="jn:${esc(n.id)}" data-click="editNews" data-click-args="${esc(JSON.stringify([String(n.id)]))}" title="ویرایش خبر">
      ${n.imageUrl
        ? `<span class="mdc-thumb"><img src="${esc(n.imageUrl)}" alt="" loading="lazy"></span>`
        : `<span class="mdc-thumb is-icon"><i class="fa-solid ${ci}"></i></span>`}
      <span class="crv-card-name"><strong>${esc(n.title || 'بدون عنوان')}</strong>${jchStateChip(n)}</span>
      ${n.subtitle ? `<span class="jch-sub">${esc(n.subtitle)}</span>` : ''}
      <span class="crv-card-mentor"><i class="fa-solid ${ci}"></i><span>${esc(n.category || 'عمومی')} · ${esc(n.reporter || 'ستاد نپا')}</span></span>
      <span class="crv-card-foot">
        <span class="crv-card-nums">
          <span class="u-c-primary-text"><i class="fa-solid ${ai}"></i> ${esc(al)}</span>
          <span class="u-c-text-muted"><i class="fa-regular fa-calendar"></i> ${esc(date)}</span>
        </span>
      </span>
    </button>`;
}

function jchDrawNews() {
  const all = window.cachedNewsList || [];
  const q = (document.getElementById('news-search-input')?.value || '').toLowerCase().trim();
  const cat = document.getElementById('news-filter-category')?.value || 'all';
  const aud = document.getElementById('news-filter-audience')?.value || 'all';
  const st = document.getElementById('news-filter-status')?.value || 'all';
  const list = all.filter(n =>
    (!q || [n.title, n.subtitle, n.body, n.reporter].some(v => String(v || '').toLowerCase().includes(q))) &&
    (cat === 'all' || (n.category || '') === cat) &&
    (aud === 'all' || (n.targetAudience || 'ALL') === aud) &&
    (st === 'all' || jchState(n) === st))
    .sort((a, b) => new Date(b.publishDate || b.createdAt || 0) - new Date(a.publishDate || a.createdAt || 0));
  const filtering = !!q || cat !== 'all' || aud !== 'all' || st !== 'all';

  const badge = document.getElementById('jch-count-badge');
  if (badge) badge.textContent = filtering ? `نمایش ${jchFa(list.length)} از ${jchFa(all.length)}` : 'برای ویرایش هر خبر بزنید';

  const grid = document.getElementById('news-tbody');
  if (grid) {
    const cards = list.map(jchNewsCard);
    if (!filtering) cards.push(`
      <button type="button" class="crv-card crv-card-add" data-anim-key="jn-add" data-click="openCreateNewsModal" title="خبر جدید">
        <span class="lsv-round lsv-round-lg"><i class="fa-solid fa-plus"></i></span><span>خبر / اطلاعیه جدید</span>
      </button>`);
    else if (!list.length) cards.push('<div class="lst-empty" data-anim-key="jn-empty">هیچ خبر یا اطلاعیه‌ای یافت نشد.</div>');
    grid.innerHTML = cards.join('');
    grid.setAttribute('aria-busy', 'false');
  }

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const pub = all.filter(n => jchState(n) === 'published').length;
  set('news-stat-total', jchFa(all.length));
  set('news-stat-published', jchFa(pub));
  set('news-stat-drafts', jchFa(all.filter(n => jchState(n) === 'draft').length));

  const cats = document.getElementById('jch-bento-categories');
  if (cats) {
    const keys = Object.keys(JCH_CATEGORY);
    const n = k => all.filter(x => x.category === k).length;
    const other = all.length - keys.reduce((s, k) => s + n(k), 0);
    const w = v => (all.length ? Math.round((v / all.length) * 100) : 0);
    const bar = c => (c === 'rest' ? 'mdc-bar-rest' : 'lst-bar-' + c);
    const dot = c => (c === 'rest' ? 'mdc-dot-rest' : 'lst-dot-' + c);
    cats.innerHTML = all.length ? `
      <div class="lst-bar">${keys.filter(n).map(k => `<span class="${bar(JCH_CATEGORY[k][1])}" data-style="width:${w(n(k))}%"></span>`).join('')}</div>
      <div class="lst-legend">${keys.map(k => `<div class="lst-legend-row"><span><span class="lst-dot ${dot(JCH_CATEGORY[k][1])}"></span>${esc(k)}</span><strong>${jchFa(n(k))}</strong></div>`).join('')}
        ${other ? `<div class="lst-legend-row"><span><span class="lst-dot mdc-dot-rest"></span>سایر</span><strong>${jchFa(other)}</strong></div>` : ''}</div>`
      : '<div class="lst-empty">هنوز خبری ثبت نشده است.</div>';
  }
}

window.openCreateNewsModal = function() {
  document.getElementById('news-form')?.reset();
  document.getElementById('news-id').value = '';
  document.getElementById('news-modal-title').textContent = 'خبر جدید جارچی';
  document.getElementById('news-delete-btn').hidden = true;
  document.getElementById('news-publish-date').value = jchLocalIso(new Date());
  jchPreview('news-image-preview', '');
  jchShow('news-modal');
};

window.closeNewsModal = function() { NopaActions.hide('news-modal'); };

window.editNews = function(id) {
  const n = (window.cachedNewsList || []).find(x => String(x.id) === String(id));
  if (!n) return;
  document.getElementById('news-form')?.reset();
  document.getElementById('news-id').value = n.id;
  document.getElementById('news-title').value = n.title || '';
  document.getElementById('news-subtitle').value = n.subtitle || '';
  document.getElementById('news-body').value = n.body || '';
  document.getElementById('news-category').value = JCH_CATEGORY[n.category] ? n.category : 'اطلاعیه مهم';
  document.getElementById('news-reporter').value = n.reporter || 'ستاد آموزش نپا';
  document.getElementById('news-target').value = JCH_AUDIENCE[n.targetAudience] ? n.targetAudience : 'ALL';
  document.getElementById('news-publish-date').value = n.publishDate ? jchLocalIso(new Date(n.publishDate)) : '';
  document.getElementById('news-active').checked = n.isPublished !== false;
  document.getElementById('news-modal-title').textContent = `ویرایش خبر: ${n.title || ''}`;
  document.getElementById('news-delete-btn').hidden = false;
  jchPreview('news-image-preview', n.imageUrl || '');
  jchShow('news-modal');
};

window.saveNewsArticle = async function(e) {
  e.preventDefault();
  const id = document.getElementById('news-id')?.value;
  const formData = new FormData();
  formData.append('title', document.getElementById('news-title')?.value || '');
  formData.append('subtitle', document.getElementById('news-subtitle')?.value || '');
  formData.append('body', document.getElementById('news-body')?.value || '');
  formData.append('category', document.getElementById('news-category')?.value || 'اطلاعیه مهم');
  formData.append('reporter', document.getElementById('news-reporter')?.value || 'ستاد نپا');
  formData.append('targetAudience', document.getElementById('news-target')?.value || 'ALL');
  const pDate = document.getElementById('news-publish-date')?.value;
  if (pDate) formData.append('publishDate', new Date(pDate).toISOString());
  const published = !!document.getElementById('news-active')?.checked;
  formData.append('isPublished', published ? 'true' : 'false');
  const fileInput = document.getElementById('news-file');
  if (fileInput && fileInput.files[0]) formData.append('image', fileInput.files[0]);

  try {
    const res = await request(id ? `/api/v1/admin/news/${encodeURIComponent(id)}` : '/api/v1/admin/news', { method: id ? 'PUT' : 'POST', body: formData });
    if (res.ok) {
      const old = id ? (window.cachedNewsList || []).find(n => String(n.id) === String(id)) : null;
      window.closeNewsModal();
      await window.loadNewsTab();
      const message = published ? 'خبر ذخیره و در جارچی منتشر شد' : 'خبر به‌صورت پیش‌نویس ذخیره شد';
      if (old) {
        // «لغو» within 10s sends the changed fields back (a new picture is kept: the old file is not on this page)
        const newPicture = !!(fileInput && fileInput.files[0]);
        NopaUndo.afterEdit({
          message: newPicture ? `${message} (لغو، عکس جدید را برنمی‌گرداند)` : message,
          url: `/api/v1/admin/news/${encodeURIComponent(id)}`,
          form: true,
          body: formData,
          before: {
            ...old,
            isPublished: old.isPublished !== false ? 'true' : 'false',
            publishDate: old.publishDate ? new Date(old.publishDate).toISOString() : undefined,
          },
          done: () => window.loadNewsTab(),
        });
      } else {
        showToast(message, 'success');
      }
    } else {
      const err = await res.json().catch(() => ({}));
      showToast('خطا در ثبت خبر: ' + (err.error || 'خطای سرور'), 'error');
    }
  } catch (err) {
    console.error('Save news error:', err);
    showToast('خطا در برقراری ارتباط با سرور', 'error');
  }
};

window.previewNewsImage = function(event) {
  const file = event.target.files[0];
  if (!file) return jchPreview('news-image-preview', '');
  const reader = new FileReader();
  reader.onload = e => jchPreview('news-image-preview', e.target.result);
  reader.readAsDataURL(file);
};

window.deleteNews = async function(id) {
  if (!(await NopaConfirm('آیا از حذف این خبر از تابلوی اعلانات جارچی اطمینان دارید؟'))) return;
  window.closeNewsModal();
  // Gone from the board at once; deleted on the server only if not undone within 10s
  NopaUndo.later({
    message: 'خبر حذف شد.',
    hide: () => {
      window.cachedNewsList = (window.cachedNewsList || []).filter(n => String(n.id) !== String(id));
      window.filterNewsTable();
      return () => window.loadNewsTab();
    },
    commit: () => request(`/api/v1/admin/news/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    done: () => window.loadNewsTab(),
  });
};
window.jchDeleteOpenNews = function() { const id = document.getElementById('news-id').value; if (id) window.deleteNews(id); };

if (!jchNewsLoaded) jchSetLoading(true);
