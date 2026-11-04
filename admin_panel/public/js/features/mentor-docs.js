// Mentor documents: the review queue (#mentors-docs-tab). Like the caravans tab: a bento of the pending documents
// (#mdc-overview-view) and one document's page (#mdc-detail-view): circles of the queue in the notch, the mentor's
// card linked to the preview and the decision. A decision drops the document from the queue and opens the next one.
// Styles: css/stations.css (.lst-*, .lsv-*, .crv-*, .mdc-*). Helpers crvAvatar / crvFa / crvArgs / crvInitial /
// crvFadeOut come from js/features/caravans.js and mntFitNotch from js/features/mentors.js (both load earlier).
// Data: GET /admin/mentors/documents/pending, POST /admin/mentors/documents/:id/approve | /reject.
window.mdcDocs = [];
window.mdcActiveId = null;
window.mdcRenderedId = null;
let mdcLoaded = false;
let mdcDeciding = false;

const MDC_CATEGORY = { EDUCATION: 'مدرک تحصیلی', JOB: 'سابقه شغلی', RESUME: 'رزومه' };
const MDC_OLD_DAYS = 3;

function mdcFind(id) { return (window.mdcDocs || []).find(d => String(d.id) === String(id)) || null; }
function mdcUrl(d) { return d.url || (d.filePath ? '/uploads/' + d.filePath : ''); }
function mdcName(d) { return d.filename || d.fileName || 'مدرک'; }
function mdcKind(d) {
  const mime = String(d.mimeType || '');
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf' || /\.pdf$/i.test(mdcName(d))) return 'pdf';
  return 'file';
}
function mdcIcon(d) { const k = mdcKind(d); return k === 'image' ? 'fa-image' : k === 'pdf' ? 'fa-file-pdf' : 'fa-file-lines'; }
function mdcCategoryKey(d) { return MDC_CATEGORY[String(d.category || '').toUpperCase()] ? String(d.category).toUpperCase() : 'other'; }
function mdcCategory(d) { return MDC_CATEGORY[mdcCategoryKey(d)] || (d.category ? String(d.category) : 'سایر'); }
function mdcAgeDays(d) { return Math.floor((Date.now() - new Date(d.createdAt).getTime()) / 864e5); }
function mdcAge(d) {
  const n = mdcAgeDays(d);
  if (n <= 0) return 'امروز';
  if (n === 1) return 'دیروز';
  return `${crvFa(n)} روز پیش`;
}
function mdcAgeChip(d) {
  const n = mdcAgeDays(d);
  return n >= MDC_OLD_DAYS
    ? `<span class="lst-chip lst-chip-locked"><i class="fa-solid fa-hourglass-end"></i> ${esc(mdcAge(d))}</span>`
    : `<span class="lst-chip lst-chip-scheduled"><i class="fa-solid fa-hourglass-half"></i> ${esc(mdcAge(d))}</span>`;
}
function mdcSameMentor(d) { return (window.mdcDocs || []).filter(x => x.userId === d.userId); }

// ==================== LOADER ====================
window.loadMentorDocs = async function() {
  window.mdcSetLoading(true);
  try {
    const res = await request('/api/v1/admin/mentors/documents/pending');
    if (!res.ok) throw new Error('خطا در دریافت مدارک');
    const docs = await res.json();
    window.mdcDocs = Array.isArray(docs) ? docs : [];
    mdcLoaded = true;
    window.mdcSetLoading(false);
    window.filterMentorDocs();
    if (window.mdcActiveId) {
      if (mdcFind(window.mdcActiveId)) { window.mdcRenderedId = null; window.loadMentorDocPage(); }
      else window.closeMentorDocView();
    }
  } catch (err) {
    console.error('loadMentorDocs error:', err);
    window.mdcSetLoading(false);
    const grid = document.getElementById('mdc-bento-list');
    if (grid) grid.innerHTML = `<div class="lst-empty"><i class="fa-solid fa-triangle-exclamation lst-warn"></i> ${esc(err.message)}</div>`;
  }
};

// ==================== OVERVIEW (BENTO) ====================
window.filterMentorDocs = function() {
  const overview = document.getElementById('mdc-overview-view');
  if (window.NopaFlip && overview) window.NopaFlip.render(overview, mdcDrawBento); else mdcDrawBento();
};

// The queue in the order of the overview's sort (the detail page walks it the same way)
function mdcSorted(list) {
  const sort = document.getElementById('mdc-sort')?.value || 'old';
  const by = {
    old: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    new: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    mentor: (a, b) => String(a.user?.name || '').localeCompare(String(b.user?.name || ''), 'fa') || new Date(a.createdAt) - new Date(b.createdAt),
  };
  return list.slice().sort(by[sort] || by.old);
}

function mdcCard(d) {
  const name = d.user?.name || 'راهبر';
  const url = mdcUrl(d);
  const cover = mdcKind(d) === 'image' && url
    ? `<span class="mdc-thumb"><img src="${esc(url)}" alt="" loading="lazy" data-error="lmsImageFallback" data-error-args='["$this", "${crvInitial(name)}"]'></span>`
    : `<span class="mdc-thumb is-icon"><i class="fa-solid ${mdcIcon(d)}"></i></span>`;
  return `
    <button type="button" class="crv-card mdc-card" data-anim-key="md:${esc(d.id)}" data-click="openMentorDocView" data-click-args="${crvArgs(d.id)}" title="بررسی مدرک ${esc(name)}">
      ${cover}
      <span class="crv-card-top">
        ${crvAvatar(d.user?.avatarUrl, name, 'crv-card-cover mdc-avatar')}
        <span class="crv-card-name"><strong>${esc(name)}</strong>${mdcAgeChip(d)}</span>
      </span>
      <span class="crv-card-mentor"><i class="fa-solid ${mdcIcon(d)}"></i><span>${esc(mdcName(d))}</span></span>
      <span class="crv-card-foot">
        <span class="crv-card-nums">
          <span class="u-c-primary-text"><i class="fa-solid fa-tag"></i> ${esc(mdcCategory(d))}</span>
          <span class="u-c-text-muted"><i class="fa-regular fa-clock"></i> ${esc(new Date(d.createdAt).toLocaleDateString('fa-IR'))}</span>
        </span>
      </span>
    </button>`;
}

function mdcDrawBento() {
  const all = window.mdcDocs || [];
  const q = (document.getElementById('mdc-search')?.value || '').trim().toLowerCase();
  const cat = document.getElementById('mdc-category-filter')?.value || 'all';
  const list = mdcSorted(all.filter(d => (cat === 'all' || mdcCategoryKey(d) === cat) &&
    (!q || [d.user?.name, d.user?.phoneNumber, mdcName(d)].some(v => String(v || '').toLowerCase().includes(q)))));
  const filtering = !!q || cat !== 'all';

  const badge = document.getElementById('mdc-count-badge');
  if (badge) badge.textContent = filtering ? `نمایش ${crvFa(list.length)} از ${crvFa(all.length)}` : 'برای بررسی هر مدرک بزنید';

  const grid = document.getElementById('mdc-bento-list');
  if (grid) {
    grid.innerHTML = list.length ? list.map(mdcCard).join('')
      : filtering ? '<div class="lst-empty" data-anim-key="md-empty">مدرکی با این مشخصات یافت نشد.</div>'
      : '<div class="lst-empty mdc-done" data-anim-key="md-done"><i class="fa-solid fa-circle-check u-c-success-text"></i> مدرکی در انتظار بررسی نیست.</div>';
    grid.setAttribute('aria-busy', 'false');
  }

  const today = new Date().toDateString();
  const old = all.filter(d => mdcAgeDays(d) >= MDC_OLD_DAYS);
  const mentors = new Map();
  all.forEach(d => {
    const k = d.userId || d.user?.id || '?';
    if (!mentors.has(k)) mentors.set(k, { user: d.user || {}, docs: [] });
    mentors.get(k).docs.push(d);
  });
  const setStat = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setStat('mdc-stat-total', crvFa(all.length));
  setStat('mdc-stat-mentors', crvFa(mentors.size));
  setStat('mdc-stat-today', crvFa(all.filter(d => new Date(d.createdAt).toDateString() === today).length));
  setStat('mdc-stat-old', crvFa(old.length));

  const types = document.getElementById('mdc-bento-types');
  if (types) {
    const keys = ['EDUCATION', 'JOB', 'RESUME', 'other'];
    const cls = { EDUCATION: 'active', JOB: 'scheduled', RESUME: 'locked', other: 'rest' };
    const n = k => all.filter(d => mdcCategoryKey(d) === k).length;
    const w = k => (all.length ? Math.round((n(k) / all.length) * 100) : 0);
    types.innerHTML = all.length ? `
      <div class="lst-bar">${keys.filter(n).map(k => `<span class="${k === 'other' ? 'mdc-bar-rest' : 'lst-bar-' + cls[k]}" data-style="width:${w(k)}%"></span>`).join('')}</div>
      <div class="lst-legend">${keys.map(k => `<div class="lst-legend-row"><span><span class="lst-dot ${k === 'other' ? 'mdc-dot-rest' : 'lst-dot-' + cls[k]}"></span>${esc(MDC_CATEGORY[k] || 'سایر')}</span><strong>${crvFa(n(k))}</strong></div>`).join('')}</div>`
      : '<div class="lst-empty">صف خالی است.</div>';
  }

  const top = document.getElementById('mdc-bento-mentors');
  if (top) {
    const rows = Array.from(mentors.values()).sort((a, b) => b.docs.length - a.docs.length).slice(0, 5);
    top.innerHTML = rows.length ? `<ul class="lst-list">${rows.map((m, i) => `
      <li class="lst-list-item lst-clickable" role="button" tabindex="0" data-anim-key="mm:${esc(m.user.id || i)}" data-click="openMentorDocView" data-click-args="${crvArgs(mdcSorted(m.docs)[0].id)}">
        <span class="crv-rank">${crvFa(i + 1)}</span>
        ${crvAvatar(m.user.avatarUrl, m.user.name, 'lst-avatar')}
        <span class="lst-grow"><strong>${esc(m.user.name || 'راهبر')}</strong></span>
        <span class="u-c-primary-text"><i class="fa-solid fa-file"></i> ${crvFa(m.docs.length)}</span>
      </li>`).join('')}</ul>` : '<div class="lst-empty">صف خالی است.</div>';
  }

  const health = document.getElementById('mdc-bento-health');
  if (health) {
    const rows = mdcSorted(old).slice(0, 6);
    health.innerHTML = rows.length ? `<ul class="lst-list">${rows.map(d => `
      <li class="lst-list-item lst-clickable" role="button" tabindex="0" data-anim-key="mh:${esc(d.id)}" data-click="openMentorDocView" data-click-args="${crvArgs(d.id)}">
        <i class="fa-solid fa-triangle-exclamation lst-warn"></i>
        <span class="lst-grow"><strong>${esc(d.user?.name || 'راهبر')}</strong>: ${esc(mdcCategory(d))} «${esc(mdcName(d))}» — ${esc(mdcAge(d))}</span>
      </li>`).join('')}</ul>${old.length > rows.length ? `<div class="lst-empty">و ${crvFa(old.length - rows.length)} مدرک دیگر</div>` : ''}`
      : '<div class="lst-empty"><i class="fa-solid fa-circle-check u-c-success-text"></i> مدرکی بیش از ۳ روز منتظر نمانده است.</div>';
  }
}

window.mdcSetLoading = function(on) {
  const overview = document.getElementById('mdc-overview-view');
  if (!overview) return;
  overview.querySelectorAll('.lst-bento > .lst-tile').forEach(t => t.classList.toggle('is-loading', on));
  const grid = document.getElementById('mdc-bento-list');
  if (grid) grid.setAttribute('aria-busy', on ? 'true' : 'false');
  if (!on || mdcLoaded) return;
  if (grid) grid.innerHTML = Array.from({ length: 6 }, () => `
    <div class="crv-card lst-skel" aria-hidden="true">
      <span class="crv-card-top"><span class="crv-card-cover"></span><span class="crv-card-name"><span class="lst-skel-line"></span><span class="lst-skel-line lst-skel-chip"></span></span></span>
      <span class="lst-skel-line lst-skel-short"></span><span class="lst-skel-line"></span><span class="lst-skel-line lst-skel-short"></span>
    </div>`).join('');
  const lines = '<div class="lst-skel-lines" aria-hidden="true">' + '<span class="lst-skel-row"></span>'.repeat(3) + '</div>';
  ['mdc-bento-types', 'mdc-bento-mentors', 'mdc-bento-health'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = lines; });
};

// ==================== ONE DOCUMENT'S PAGE ====================
window.openMentorDocView = function(id) {
  const overview = document.getElementById('mdc-overview-view');
  window.mdcActiveId = String(id);
  crvFadeOut(overview, () => {
    window.loadMentorDocPage();
    document.getElementById('mentors-docs-tab')?.scrollIntoView({ block: 'start', behavior: NopaMotion.scrollBehavior() });
  });
};
window.mdcOpenFirst = function() {
  const first = mdcSorted(window.mdcDocs || [])[0];
  if (first) window.openMentorDocView(first.id); else showToast('مدرکی در انتظار بررسی نیست.', 'info');
};
// Old name (the mentor modal and other pages may still call it)
window.openMentorDocModal = function(id) { window.usrGoTab('mentors-docs-tab'); window.openMentorDocView(id); };

window.closeMentorDocView = function() {
  const view = document.getElementById('mdc-detail-view');
  const overview = document.getElementById('mdc-overview-view');
  window.mdcActiveId = null;
  window.mdcRenderedId = null;
  crvFadeOut(view, () => {
    if (window.mdcActiveId) return;
    if (view) view.style.display = 'none';
    if (overview) {
      overview.style.display = '';
      if (window.NopaFlip) window.NopaFlip.enter(overview.querySelectorAll('.lst-bento > .lst-tile'));
    }
  });
};

window.selectMentorDoc = function(id) { window.mdcActiveId = String(id); window.loadMentorDocPage(); };

function mdcCircles(activeId) {
  return mdcSorted(window.mdcDocs || []).map(d => {
    const active = String(d.id) === String(activeId);
    const name = d.user?.name || 'راهبر';
    const url = mdcUrl(d);
    const img = mdcKind(d) === 'image' && url
      ? `<img src="${esc(url)}" alt="" loading="lazy" data-error="lmsImageFallback" data-error-args='["$this", "${crvInitial(name)}"]'>`
      : `<i class="fa-solid ${mdcIcon(d)}"></i>`;
    const old = mdcAgeDays(d) >= MDC_OLD_DAYS;
    return `
      <button type="button" class="lsv-circle${active ? ' is-active' : ''}" data-anim-key="mc:${esc(d.id)}" data-click="selectMentorDoc" data-click-args="${crvArgs(d.id)}" title="${esc(name)} — ${esc(mdcName(d))}"${active ? ' aria-current="true"' : ''}>
        <span class="lsv-circle-main">
          <span class="lsv-circle-img">${img}</span>
          <span class="lsv-circle-badge ${old ? 'lsv-state-locked' : 'lsv-state-scheduled'}"><i class="fa-solid fa-hourglass-half"></i></span>
        </span>
        <span class="lsv-circle-name"><span>${esc(name)}</span></span>
      </button>`;
  }).join('');
}

function mdcPaint(d) {
  const set = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };
  const queue = mdcSorted(window.mdcDocs || []);
  const pos = queue.findIndex(x => String(x.id) === String(d.id));
  const name = d.user?.name || 'راهبر';
  const url = mdcUrl(d);
  const same = mdcSameMentor(d);
  set('mdc-title', el => { el.textContent = `${mdcCategory(d)} — ${name}`; });
  set('mdc-state', el => { el.innerHTML = mdcAgeChip(d); });
  set('mdc-sub', el => { el.textContent = `مدرک ${crvFa(pos + 1)} از ${crvFa(queue.length)}`; });
  set('mdc-circles', el => { el.innerHTML = mdcCircles(d.id); });
  set('mdc-open-file', el => { el.href = url || '#'; });
  set('mdc-info-card', el => {
    el.innerHTML = `
      ${crvAvatar(d.user?.avatarUrl, name, 'crv-mentor-photo')}
      <strong class="crv-mentor-name">${esc(name)}</strong>
      ${d.user?.phoneNumber ? `<span class="crv-mentor-phone" dir="ltr">${esc(d.user.phoneNumber)}</span>` : ''}
      <div class="mnt-mini">
        <span><strong>${crvFa(same.length)}</strong><small>در صف</small></span>
        <span${mdcAgeDays(d) >= MDC_OLD_DAYS ? ' class="is-warn"' : ''}><strong>${crvFa(Math.max(0, mdcAgeDays(d)))}</strong><small>روز انتظار</small></span>
        <span><strong>${d.user?.userCode ? crvFa(d.user.userCode) : '-'}</strong><small>کد کاربری</small></span>
      </div>
      <div class="lsv-facts crv-mentor-facts">
        <span><i class="fa-solid fa-tag"></i> ${esc(mdcCategory(d))}</span>
        <span><i class="fa-regular fa-calendar"></i> ${esc(new Date(d.createdAt).toLocaleString('fa-IR'))}</span>
      </div>
      <div class="mnt-info-actions">
        <button type="button" class="lse-btn" data-click="mdcOpenMentor" data-click-args="${crvArgs(d.userId || d.user?.id || '')}"><i class="fa-solid fa-id-card"></i> پروفایل راهبر</button>
      </div>`;
  });
  set('mdc-preview', el => {
    const k = mdcKind(d);
    const head = `<div class="mdc-file"><i class="fa-solid ${mdcIcon(d)}"></i><span><strong>${esc(mdcName(d))}</strong><small dir="ltr">${esc(d.mimeType || '')}</small></span>
      ${url ? `<a class="lsv-pill" href="${esc(url)}" target="_blank" rel="noopener"><i class="fa-solid fa-up-right-from-square"></i> باز کردن</a>` : ''}</div>`;
    let body = '';
    if (!url) body = '<div class="lsv-col-empty">آدرس فایل ثبت نشده است.</div>';
    else if (k === 'image') body = `<a class="mdc-image" href="${esc(url)}" target="_blank" rel="noopener" title="نمایش در اندازه کامل"><img src="${esc(url)}" alt="${esc(mdcName(d))}"></a>`;
    else body = `<div class="mdc-noprev"><i class="fa-solid ${mdcIcon(d)}"></i><span>پیش‌نمایش این نوع فایل در پنل ممکن نیست؛ آن را در پنجره جدید باز کنید.</span></div>`;
    el.innerHTML = head + body;
  });
}

window.loadMentorDocPage = function() {
  const view = document.getElementById('mdc-detail-view');
  const overview = document.getElementById('mdc-overview-view');
  const id = window.mdcActiveId;
  const d = id && mdcFind(id);
  if (!view || !d) return;
  const wasOpen = view.style.display !== 'none';
  const same = wasOpen && window.mdcRenderedId === id;
  if (!same) { const note = document.getElementById('mentor-doc-admin-note'); if (note) note.value = ''; }
  window.mdcRenderedId = id;
  if (overview) overview.style.display = 'none';
  view.style.display = 'block';
  if (same && window.NopaFlip) window.NopaFlip.render(view, () => mdcPaint(d));
  else {
    mdcPaint(d);
    if (window.NopaFlip) {
      window.NopaFlip.enter(view.querySelectorAll(wasOpen ? '.mdc-flow > .lsv-col, .mdc-flow > .lsv-link'
                                                          : '.lsv-head, .lsv-board, .lsv-notch .lsv-circle, .mdc-flow > .lsv-col'));
      const picked = wasOpen && view.querySelector('.lsv-circle.is-active .lsv-circle-img');
      if (picked && typeof picked.animate === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        picked.animate([{ transform: 'scale(0.8)' }, { transform: 'scale(1.12)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
      }
    }
  }
  mntFitNotch(view);
};

// The mentor's own page in the mentors tab (its list loads on the tab's first visit)
window.mdcOpenMentor = function(userId) {
  if (!userId) return;
  window.usrGoTab('mentors-profile-tab');
  let tries = 0;
  const wait = setInterval(() => {
    tries++;
    if (typeof mntFind === 'function' && mntFind(userId)) { clearInterval(wait); window.openMentorView(userId); }
    else if (tries > 30) { clearInterval(wait); showToast('راهبر در فهرست راهبران پیدا نشد.', 'error'); }
  }, 200);
};

// ==================== DECISION ====================
window.mdcDecide = async function(decision) {
  const d = mdcFind(window.mdcActiveId);
  if (!d || mdcDeciding) return;
  const noteEl = document.getElementById('mentor-doc-admin-note');
  const note = (noteEl?.value || '').trim();
  if (decision === 'reject' && note.length < 3) {
    showToast('لطفا علت رد را وارد کنید (حداقل ۳ کاراکتر)', 'error');
    noteEl?.focus();
    return;
  }
  // the next document in the queue, picked before this one leaves it
  const queue = mdcSorted(window.mdcDocs || []);
  const pos = queue.findIndex(x => String(x.id) === String(d.id));
  const next = queue[pos + 1] || queue[pos - 1] || null;
  mdcDeciding = true;
  document.querySelectorAll('.mdc-decide-actions button').forEach(b => { b.disabled = true; });
  try {
    const res = await request(`/api/v1/admin/mentors/documents/${encodeURIComponent(d.id)}/${decision}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(decision === 'reject' ? { note, reason: note } : { note: note || 'تایید شد' })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'خطا در ثبت تصمیم');
    }
    showToast(decision === 'approve' ? 'مدرک تایید شد' : 'مدرک رد شد', decision === 'approve' ? 'success' : 'info');
    window.mdcDocs = (window.mdcDocs || []).filter(x => String(x.id) !== String(d.id));
    mdcDrawBento();
    if (next) { window.mdcActiveId = String(next.id); window.loadMentorDocPage(); }
    else { window.closeMentorDocView(); showToast('صف بررسی خالی شد.', 'success'); }
  } catch (e) {
    console.error(e);
    showToast(e.message || 'خطا', 'error');
  } finally {
    mdcDeciding = false;
    document.querySelectorAll('.mdc-decide-actions button').forEach(b => { b.disabled = false; });
  }
};

if (!mdcLoaded) window.mdcSetLoading(true);
