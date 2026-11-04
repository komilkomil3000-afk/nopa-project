// Dynamic form builder (#form-builder-tab). Like the caravans tab: a bento of the forms (#dfm-overview-view) and one
// form's page (#dfm-detail-view): circles of the forms in the notch, the form's card linked to its questions and its
// answers. Questions and answers use the existing API: POST /admin/forms/fields, DELETE /admin/forms/fields/:id,
// GET /admin/forms/:id/submissions.
// Split out of the former app.js (Phase 7). Classic script: shares globals with the other modules;
// load order is set in index.html. Styles: css/stations.css (.lst-*, .lsv-*, .crv-*, .dfm-*). Helpers crvAvatar /
// crvFa / crvArgs / crvInitial / crvFadeOut come from js/features/caravans.js and mntFitNotch from mentors.js.
window.dfmForms = [];
window.dfmActiveId = null;
window.dfmRenderedId = null;
const dfmAnswersCache = new Map(); // form id -> submissions
let dfmLoaded = false;
let dfmCaravans = null;

const DFM_PLACEMENT = {
  HOME_SCREEN_OVERLAY: ['صفحه اصلی', 'fa-house'],
  AFTER_CLASS_SURVEY: ['پس از کلاس', 'fa-chalkboard-user'],
  MENTOR_EVALUATION: ['ارزیابی راهبر', 'fa-user-tie'],
  PROFILE_TAB: ['زبانه پروفایل', 'fa-id-card'],
  DRAWER_MENU: ['منوی کناری', 'fa-bars'],
};
const DFM_AUDIENCE = { ALL_USERS: 'همه کاربران', STUDENTS_ONLY: 'فقط نوجوانان', MENTORS_ONLY: 'فقط راهبران', SPECIFIC_CARAVAN: 'یک کاروان خاص' };
const DFM_TYPE = {
  text: ['متن کوتاه', 'fa-font'], textarea: ['متن بلند', 'fa-align-right'], radio: ['یک گزینه', 'fa-circle-dot'],
  checkbox: ['چند گزینه', 'fa-square-check'], rating: ['امتیاز', 'fa-star'], date: ['تاریخ', 'fa-calendar'], file: ['فایل', 'fa-paperclip'],
};
const DFM_CHOICE = ['radio', 'checkbox'];

function dfmFind(id) { return (window.dfmForms || []).find(f => String(f.id) === String(id)) || null; }
function dfmPlace(f) { return DFM_PLACEMENT[f.placement] || [f.placement || '-', 'fa-mobile-screen']; }
function dfmAudience(f) {
  if (f.targetAudience === 'SPECIFIC_CARAVAN') {
    const c = (dfmCaravans || []).find(x => String(x.id) === String(f.targetCaravanId));
    return c ? `کاروان ${c.name}` : DFM_AUDIENCE.SPECIFIC_CARAVAN;
  }
  return DFM_AUDIENCE[f.targetAudience] || f.targetAudience || '-';
}
function dfmFields(f) { return (f.fields || []).slice().sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0)); }
function dfmAnswerCount(f) { return f._count ? f._count.submissions || 0 : 0; }
function dfmOptions(field) {
  try { const v = JSON.parse(field.optionsJson || '[]'); return Array.isArray(v) ? v.map(String) : []; } catch (_) { return []; }
}
function dfmChip(f) {
  return dfmFields(f).length
    ? `<span class="lst-chip lst-chip-active"><i class="fa-solid fa-circle-check"></i> ${crvFa(dfmFields(f).length)} سؤال</span>`
    : '<span class="lst-chip lst-chip-locked"><i class="fa-solid fa-triangle-exclamation"></i> بدون سؤال</span>';
}

// ==================== LOADER ====================
async function loadDynForms() {
  window.dfmSetLoading(true);
  try {
    const res = await request('/api/v1/admin/forms');
    const forms = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(forms)) throw new Error('خطا در دریافت فرم‌ها');
    window.dfmForms = forms;
    dfmLoaded = true;
    if (!dfmCaravans && forms.some(f => f.targetAudience === 'SPECIFIC_CARAVAN')) await dfmLoadCaravans();
    window.dfmSetLoading(false);
    dfmFillFilters();
    window.filterDynForms();
    if (window.dfmActiveId) {
      if (dfmFind(window.dfmActiveId)) { dfmAnswersCache.delete(String(window.dfmActiveId)); window.dfmRenderedId = null; window.loadDynFormPage(); }
      else window.closeDynFormView();
    }
  } catch (e) {
    console.error(e);
    window.dfmSetLoading(false);
    const grid = document.getElementById('dfm-bento-list');
    if (grid) grid.innerHTML = `<div class="lst-empty"><i class="fa-solid fa-triangle-exclamation lst-warn"></i> ${esc(e.message)}</div>`;
  }
}
window.loadDynForms = loadDynForms;

async function dfmLoadCaravans() {
  try {
    const list = window.caravansData || [];
    if (list.length) { dfmCaravans = list; return; }
    const res = await request('/api/v1/admin/caravans');
    const data = res.ok ? await res.json() : [];
    dfmCaravans = Array.isArray(data) ? data : (data.caravans || data.data || []);
  } catch (_) { dfmCaravans = []; }
}

function dfmFillFilters() {
  const fill = (id, map, all) => {
    const sel = document.getElementById(id);
    if (!sel || sel.options.length > 1) return;
    sel.innerHTML = `<option value="all">${all}</option>` + Object.keys(map).map(k => `<option value="${k}">${esc(Array.isArray(map[k]) ? map[k][0] : map[k])}</option>`).join('');
  };
  fill('dfm-placement-filter', DFM_PLACEMENT, 'همه محل‌ها');
  fill('dfm-audience-filter', DFM_AUDIENCE, 'همه مخاطبان');
}

// ==================== OVERVIEW (BENTO) ====================
window.filterDynForms = function() {
  const overview = document.getElementById('dfm-overview-view');
  if (window.NopaFlip && overview) window.NopaFlip.render(overview, dfmDrawBento); else dfmDrawBento();
};

function dfmCard(f) {
  const [place, icon] = dfmPlace(f);
  return `
    <button type="button" class="crv-card" data-anim-key="df:${esc(f.id)}" data-click="openDynFormView" data-click-args="${crvArgs(f.id)}" title="ورود به ${esc(f.title)}">
      <span class="crv-card-top">
        <span class="crv-card-cover dfm-cover"><i class="fa-solid ${icon}"></i></span>
        <span class="crv-card-name"><strong>${esc(f.title)}</strong>${dfmChip(f)}</span>
      </span>
      <span class="crv-card-mentor"><i class="fa-solid fa-mobile-screen"></i><span>${esc(place)}${f.purpose ? ` · ${esc(f.purpose)}` : ''}</span></span>
      <span class="crv-card-foot">
        <span class="crv-card-nums">
          <span class="u-c-primary-text"><i class="fa-solid fa-users"></i> ${esc(dfmAudience(f))}</span>
          <span class="u-c-accent-text"><i class="fa-solid fa-inbox"></i> ${crvFa(dfmAnswerCount(f))}</span>
        </span>
      </span>
    </button>`;
}

function dfmDrawBento() {
  const all = window.dfmForms || [];
  const q = (document.getElementById('dfm-search')?.value || '').trim().toLowerCase();
  const place = document.getElementById('dfm-placement-filter')?.value || 'all';
  const aud = document.getElementById('dfm-audience-filter')?.value || 'all';
  const list = all.filter(f => (place === 'all' || f.placement === place) && (aud === 'all' || f.targetAudience === aud) &&
    (!q || [f.title, f.purpose].some(v => String(v || '').toLowerCase().includes(q))));
  const filtering = !!q || place !== 'all' || aud !== 'all';

  const badge = document.getElementById('dfm-count-badge');
  if (badge) badge.textContent = filtering ? `نمایش ${crvFa(list.length)} از ${crvFa(all.length)}` : 'برای ساختن سؤال‌ها و دیدن پاسخ‌ها وارد هر فرم شوید';

  const grid = document.getElementById('dfm-bento-list');
  if (grid) {
    const cards = list.map(dfmCard);
    if (!filtering) cards.push(`
      <button type="button" class="crv-card crv-card-add" data-anim-key="df-add" data-click="openDynFormModal" title="فرم جدید">
        <span class="lsv-round lsv-round-lg"><i class="fa-solid fa-plus"></i></span><span>فرم جدید</span>
      </button>`);
    else if (!list.length) cards.push('<div class="lst-empty" data-anim-key="df-empty">فرمی با این مشخصات یافت نشد.</div>');
    grid.innerHTML = cards.join('');
    grid.setAttribute('aria-busy', 'false');
  }

  const setStat = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setStat('dfm-stat-forms', crvFa(all.length));
  setStat('dfm-stat-fields', crvFa(all.reduce((s, f) => s + (f.fields || []).length, 0)));
  setStat('dfm-stat-answers', crvFa(all.reduce((s, f) => s + dfmAnswerCount(f), 0)));
  setStat('dfm-stat-places', crvFa(new Set(all.map(f => f.placement)).size));

  const places = document.getElementById('dfm-bento-places');
  if (places) {
    const rows = Object.keys(DFM_PLACEMENT).map(k => [k, all.filter(f => f.placement === k).length]);
    places.innerHTML = all.length ? `<ul class="lst-list">${rows.map(([k, n]) => `
      <li class="lst-list-item${n ? ' lst-clickable' : ''}"${n ? ` role="button" tabindex="0" data-click="dfmFilterPlace" data-click-args="${crvArgs(k)}"` : ''} data-anim-key="dp:${k}">
        <i class="fa-solid ${DFM_PLACEMENT[k][1]} ${n ? 'u-c-primary-text' : 'u-c-text-muted'}"></i>
        <span class="lst-grow">${esc(DFM_PLACEMENT[k][0])}</span><strong>${crvFa(n)}</strong>
      </li>`).join('')}</ul>` : '<div class="lst-empty">هنوز فرمی ساخته نشده است.</div>';
  }

  const top = document.getElementById('dfm-bento-top');
  if (top) {
    const rows = all.filter(dfmAnswerCount).sort((a, b) => dfmAnswerCount(b) - dfmAnswerCount(a)).slice(0, 5);
    top.innerHTML = rows.length ? `<ul class="lst-list">${rows.map((f, i) => `
      <li class="lst-list-item lst-clickable" role="button" tabindex="0" data-anim-key="dt:${esc(f.id)}" data-click="openDynFormView" data-click-args="${crvArgs(f.id)}">
        <span class="crv-rank">${crvFa(i + 1)}</span><span class="lst-grow"><strong>${esc(f.title)}</strong></span>
        <span class="u-c-accent-text"><i class="fa-solid fa-inbox"></i> ${crvFa(dfmAnswerCount(f))}</span>
      </li>`).join('')}</ul>` : '<div class="lst-empty">هنوز پاسخی ثبت نشده است.</div>';
  }

  const health = document.getElementById('dfm-bento-health');
  if (health) {
    const problems = [];
    all.forEach(f => {
      const issues = [];
      if (!(f.fields || []).length) issues.push('بدون سؤال');
      dfmFields(f).forEach(fd => { if (DFM_CHOICE.includes(fd.type) && dfmOptions(fd).length < 2) issues.push(`سؤال «${fd.label}» گزینه ندارد`); });
      if (f.targetAudience === 'SPECIFIC_CARAVAN' && !f.targetCaravanId) issues.push('کاروان مخاطب انتخاب نشده');
      if (issues.length) problems.push({ f, issues });
    });
    health.innerHTML = problems.length ? `<ul class="lst-list">${problems.slice(0, 6).map(p => `
      <li class="lst-list-item lst-clickable" role="button" tabindex="0" data-anim-key="dh:${esc(p.f.id)}" data-click="openDynFormView" data-click-args="${crvArgs(p.f.id)}">
        <i class="fa-solid fa-triangle-exclamation lst-warn"></i><span class="lst-grow"><strong>${esc(p.f.title)}</strong>: ${esc(p.issues.join('، '))}</span>
      </li>`).join('')}</ul>`
      : '<div class="lst-empty"><i class="fa-solid fa-circle-check u-c-success-text"></i> همه فرم‌ها کامل هستند.</div>';
  }
}

window.dfmFilterPlace = function(place) {
  const sel = document.getElementById('dfm-placement-filter');
  if (sel) sel.value = place;
  window.filterDynForms();
};

window.dfmSetLoading = function(on) {
  const overview = document.getElementById('dfm-overview-view');
  if (!overview) return;
  overview.querySelectorAll('.lst-bento > .lst-tile').forEach(t => t.classList.toggle('is-loading', on));
  const grid = document.getElementById('dfm-bento-list');
  if (grid) grid.setAttribute('aria-busy', on ? 'true' : 'false');
  if (!on || dfmLoaded) return;
  if (grid) grid.innerHTML = Array.from({ length: 6 }, () => `
    <div class="crv-card lst-skel" aria-hidden="true">
      <span class="crv-card-top"><span class="crv-card-cover"></span><span class="crv-card-name"><span class="lst-skel-line"></span><span class="lst-skel-line lst-skel-chip"></span></span></span>
      <span class="lst-skel-line lst-skel-short"></span><span class="lst-skel-line"></span><span class="lst-skel-line lst-skel-short"></span>
    </div>`).join('');
  const lines = '<div class="lst-skel-lines" aria-hidden="true">' + '<span class="lst-skel-row"></span>'.repeat(3) + '</div>';
  ['dfm-bento-places', 'dfm-bento-top', 'dfm-bento-health'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = lines; });
};

// ==================== ONE FORM'S PAGE ====================
window.openDynFormView = function(id) {
  const overview = document.getElementById('dfm-overview-view');
  window.dfmActiveId = String(id);
  crvFadeOut(overview, () => {
    window.loadDynFormPage();
    document.getElementById('form-builder-tab')?.scrollIntoView({ block: 'start', behavior: NopaMotion.scrollBehavior() });
  });
};

window.closeDynFormView = function() {
  const view = document.getElementById('dfm-detail-view');
  const overview = document.getElementById('dfm-overview-view');
  window.dfmActiveId = null;
  window.dfmRenderedId = null;
  crvFadeOut(view, () => {
    if (window.dfmActiveId) return;
    if (view) view.style.display = 'none';
    if (overview) {
      overview.style.display = '';
      if (window.NopaFlip) window.NopaFlip.enter(overview.querySelectorAll(':scope > div:first-child, .lst-bento > .lst-tile'));
    }
  });
};

window.selectDynForm = function(id) { window.dfmActiveId = String(id); window.loadDynFormPage(); };

function dfmCircles(activeId) {
  return (window.dfmForms || []).map(f => {
    const active = String(f.id) === String(activeId);
    const n = (f.fields || []).length;
    return `
      <button type="button" class="lsv-circle${active ? ' is-active' : ''}" data-anim-key="dc:${esc(f.id)}" data-click="selectDynForm" data-click-args="${crvArgs(f.id)}" title="${esc(f.title)}"${active ? ' aria-current="true"' : ''}>
        <span class="lsv-circle-main">
          <span class="lsv-circle-img"><i class="fa-solid ${dfmPlace(f)[1]}"></i></span>
          <span class="lsv-circle-badge ${n ? 'lsv-state-active' : 'lsv-state-locked'}">${crvFa(n)}</span>
        </span>
        <span class="lsv-circle-name"><span>${esc(f.title)}</span></span>
      </button>`;
  }).join('') + `
      <button type="button" class="lsv-circle lsv-circle-add" data-anim-key="dc-add" data-click="openDynFormModal" title="فرم جدید" aria-label="فرم جدید">
        <span class="lsv-circle-main"><span class="lsv-circle-img"><i class="fa-solid fa-plus"></i></span><span class="lsv-circle-badge lsv-state-add"><i class="fa-solid fa-plus"></i></span></span>
        <span class="lsv-circle-name"><span>فرم جدید</span></span>
      </button>`;
}

function dfmAnswerSummary(s, fields) {
  let answers = {};
  try { answers = JSON.parse(s.answersJson || '{}') || {}; } catch (_) { answers = {}; }
  const first = fields.map(fd => answers[fd.id] ?? answers[fd.label]).find(v => v != null && v !== '');
  const v = Array.isArray(first) ? first.join('، ') : first;
  return v == null ? '' : String(v);
}

function dfmPaint(f, answers) {
  const set = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };
  const fields = dfmFields(f);
  const [place, icon] = dfmPlace(f);
  set('dfm-title', el => { el.textContent = f.title; });
  set('dfm-state', el => { el.innerHTML = dfmChip(f); });
  set('dfm-sub', el => { el.textContent = `${place} · ${dfmAudience(f)}`; });
  set('dfm-circles', el => { el.innerHTML = dfmCircles(f.id); });
  set('dfm-info-card', el => {
    el.innerHTML = `
      <span class="crv-mentor-photo dfm-photo"><i class="fa-solid ${icon}"></i></span>
      <strong class="crv-mentor-name">${esc(f.title)}</strong>
      ${f.purpose ? `<span class="crv-mentor-phone">${esc(f.purpose)}</span>` : ''}
      <div class="mnt-mini">
        <span${fields.length ? '' : ' class="is-warn"'}><strong>${crvFa(fields.length)}</strong><small>سؤال</small></span>
        <span><strong>${crvFa(fields.filter(x => x.isRequired).length)}</strong><small>اجباری</small></span>
        <span><strong>${crvFa(dfmAnswerCount(f))}</strong><small>پاسخ</small></span>
      </div>
      <div class="lsv-facts crv-mentor-facts">
        <span><i class="fa-solid fa-mobile-screen"></i> ${esc(place)}</span>
        <span><i class="fa-solid fa-users"></i> ${esc(dfmAudience(f))}</span>
        <span><i class="fa-regular fa-calendar"></i> ${esc(new Date(f.createdAt).toLocaleDateString('fa-IR'))}</span>
      </div>
      <div class="mnt-info-actions">
        <button type="button" class="lsv-pill" data-click="openDynFormModal" data-click-args="${crvArgs(f.id)}"><i class="fa-solid fa-pen"></i> ویرایش</button>
        <button type="button" class="lse-btn" data-click="openDynFieldModal"><i class="fa-solid fa-plus"></i> سؤال جدید</button>
      </div>`;
  });

  set('dfm-fields-count', el => { el.textContent = crvFa(fields.length); });
  set('dfm-fields', el => {
    el.innerHTML = fields.map((fd, i) => {
      const [tl, ti] = DFM_TYPE[fd.type] || [fd.type, 'fa-circle-question'];
      const opts = DFM_CHOICE.includes(fd.type) ? dfmOptions(fd) : [];
      return `
        <div class="lsv-row crv-member dfm-field" data-anim-key="ff:${esc(fd.id)}">
          <span class="lsv-row-avatar lsv-row-num">${crvFa(i + 1)}</span>
          <span class="lsv-row-text"><strong>${esc(fd.label)}${fd.isRequired ? ' <b class="lse-req">*</b>' : ''}</strong>
            <span><i class="fa-solid ${ti}"></i> ${esc(tl)}${opts.length ? ` · ${esc(opts.join('، '))}` : DFM_CHOICE.includes(fd.type) ? ' · <b class="u-c-danger-text">بدون گزینه</b>' : ''}</span></span>
          <span class="lsv-round-group crv-member-tools">
            <button type="button" class="lsv-round lsv-round-sm" data-click="moveDynField" data-click-args="${crvArgs(fd.id, -1)}" title="بالاتر" aria-label="بالاتر"${i ? '' : ' disabled'}><i class="fa-solid fa-arrow-up"></i></button>
            <button type="button" class="lsv-round lsv-round-sm" data-click="moveDynField" data-click-args="${crvArgs(fd.id, 1)}" title="پایین‌تر" aria-label="پایین‌تر"${i < fields.length - 1 ? '' : ' disabled'}><i class="fa-solid fa-arrow-down"></i></button>
            <button type="button" class="lsv-round lsv-round-sm" data-click="openDynFieldModal" data-click-args="${crvArgs(fd.id)}" title="ویرایش" aria-label="ویرایش سؤال"><i class="fa-solid fa-pen"></i></button>
            <button type="button" class="lsv-round lsv-round-sm lsv-round-danger" data-click="deleteDynField" data-click-args="${crvArgs(fd.id)}" title="حذف" aria-label="حذف سؤال"><i class="fa-solid fa-trash"></i></button>
          </span>
        </div>`;
    }).join('') + `
      <button type="button" class="lsv-row lsv-row-add crv-member" data-anim-key="ff-add" data-click="openDynFieldModal">
        <span class="lsv-row-avatar lsv-row-plus"><i class="fa-solid fa-plus"></i></span>
        <span class="lsv-row-text"><strong>سؤال جدید</strong><span>متن، گزینه‌ای، امتیاز، تاریخ یا فایل</span></span>
      </button>`;
  });

  set('dfm-answers-count', el => { el.textContent = answers ? crvFa(answers.length) : '…'; });
  set('dfm-answers-card', el => { el.classList.toggle('is-loading', !answers); });
  set('dfm-answers', el => {
    if (!answers) {
      el.innerHTML = Array.from({ length: 4 }, () => `
        <div class="lsv-row crv-member" aria-hidden="true"><span class="lsv-row-avatar lst-skel-avatar"></span>
          <span class="lsv-row-text"><span class="lst-skel-line"></span><span class="lst-skel-line lst-skel-short"></span></span></div>`).join('');
      return;
    }
    el.innerHTML = answers.length ? answers.map(s => {
      const summary = dfmAnswerSummary(s, fields);
      return `
        <button type="button" class="lsv-row crv-member dfm-answer" data-anim-key="fa:${esc(s.id)}" data-click="openDynAnswer" data-click-args="${crvArgs(s.id)}">
          <span class="lsv-row-avatar lsv-row-num">${crvInitial(s.user?.name)}</span>
          <span class="lsv-row-text"><strong>${esc(s.user?.name || 'کاربر')}</strong><span>${esc(new Date(s.submittedAt).toLocaleString('fa-IR'))}${summary ? ` · ${esc(summary)}` : ''}</span></span>
        </button>`;
    }).join('') : '<div class="lsv-col-empty">هنوز کسی به این فرم پاسخ نداده است.</div>';
  });
}

window.loadDynFormPage = async function() {
  const view = document.getElementById('dfm-detail-view');
  const overview = document.getElementById('dfm-overview-view');
  const id = window.dfmActiveId;
  const f = id && dfmFind(id);
  if (!view || !f) return;
  const cached = dfmAnswersCache.get(id) || null;
  const wasOpen = view.style.display !== 'none';
  const same = wasOpen && window.dfmRenderedId === id;
  window.dfmRenderedId = id;
  if (overview) overview.style.display = 'none';
  view.style.display = 'block';
  if (same && window.NopaFlip) window.NopaFlip.render(view, () => dfmPaint(f, cached));
  else {
    dfmPaint(f, cached);
    if (window.NopaFlip) {
      window.NopaFlip.enter(view.querySelectorAll(wasOpen ? '.dfm-flow > .lsv-col, .dfm-flow > .lsv-link'
                                                          : '.lsv-head, .lsv-board, .lsv-notch .lsv-circle, .dfm-flow > .lsv-col'));
      const picked = wasOpen && view.querySelector('.lsv-circle.is-active .lsv-circle-img');
      if (picked && typeof picked.animate === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        picked.animate([{ transform: 'scale(0.8)' }, { transform: 'scale(1.12)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
      }
    }
  }
  mntFitNotch(view);
  if (cached) return;

  let answers = [];
  try {
    const res = await request(`/api/v1/admin/forms/${encodeURIComponent(id)}/submissions`);
    if (res.ok) answers = await res.json();
  } catch (_) {}
  if (window.dfmActiveId !== id) return;
  dfmAnswersCache.set(id, Array.isArray(answers) ? answers : []);
  if (window.NopaFlip) window.NopaFlip.render(view, () => dfmPaint(dfmFind(id) || f, dfmAnswersCache.get(id)));
  else dfmPaint(f, dfmAnswersCache.get(id));
};

// ==================== FORM DIALOG ====================
window.openDynFormModal = async function(id = null) {
  const modal = document.getElementById('dfm-form-modal');
  if (!modal) return;
  const form = document.getElementById('dyn-form-builder');
  if (form) form.reset();
  const f = id ? dfmFind(id) : null;
  document.getElementById('dfm-form-modal-title').textContent = f ? `ویرایش: ${f.title}` : 'فرم جدید';
  document.getElementById('dyn-form-id').value = f ? f.id : '';
  document.getElementById('dyn-form-title').value = f ? f.title : '';
  document.getElementById('dyn-form-purpose').value = f ? (f.purpose || '') : '';
  document.getElementById('dyn-form-placement').value = f ? f.placement : 'HOME_SCREEN_OVERLAY';
  document.getElementById('dyn-form-audience').value = f ? f.targetAudience : 'ALL_USERS';
  modal.style.display = 'flex';
  modal.style.zIndex = 'var(--z-modal)';
  await window.dfmAudienceChanged(f ? f.targetCaravanId : null);
};

window.dfmAudienceChanged = async function(selected) {
  const specific = document.getElementById('dyn-form-audience').value === 'SPECIFIC_CARAVAN';
  const field = document.getElementById('dfm-caravan-field');
  const sel = document.getElementById('dyn-form-caravan');
  if (field) field.style.display = specific ? '' : 'none';
  if (sel) sel.required = specific;
  if (!specific || !sel) return;
  const keep = typeof selected === 'string' ? selected : sel.value;
  if (!dfmCaravans) await dfmLoadCaravans();
  sel.innerHTML = '<option value="">انتخاب کاروان...</option>' + (dfmCaravans || []).map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  if (keep) sel.value = keep;
};

window.editActiveDynForm = function() { if (window.dfmActiveId) window.openDynFormModal(window.dfmActiveId); };

async function submitDynamicForm(e) {
  if (e) e.preventDefault();
  const id = document.getElementById('dyn-form-id').value;
  const targetAudience = document.getElementById('dyn-form-audience').value;
  const body = {
    id: id || undefined,
    title: document.getElementById('dyn-form-title').value.trim(),
    purpose: document.getElementById('dyn-form-purpose').value.trim() || null,
    placement: document.getElementById('dyn-form-placement').value,
    targetAudience,
    targetCaravanId: targetAudience === 'SPECIFIC_CARAVAN' ? (document.getElementById('dyn-form-caravan').value || null) : null,
  };
  if (!body.title) return;
  try {
    const res = await request('/api/v1/admin/forms', { method: 'POST', body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || 'خطا در ذخیره فرم');
    showToast('فرم با موفقیت ذخیره شد', 'success');
    NopaActions.hide('dfm-form-modal');
    await loadDynForms();
    if (!id && d.data && d.data.id) window.openDynFormView(d.data.id); // a new form opens on its page to add questions
  } catch (err) {
    console.error(err);
    showToast(err.message, 'error');
  }
}
window.submitDynamicForm = submitDynamicForm;

async function deleteDynForm(id) {
  const f = dfmFind(id);
  if (!(await NopaConfirm(`فرم «${f ? f.title : ''}» و همه‌ی سؤال‌ها و پاسخ‌هایش حذف شود؟`))) return;
  try {
    const res = await request(`/api/v1/admin/forms/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('خطا در حذف فرم');
    showToast('فرم حذف شد', 'success');
    if (String(window.dfmActiveId) === String(id)) window.closeDynFormView();
    loadDynForms();
  } catch (e) { console.error(e); showToast(e.message, 'error'); }
}
window.deleteDynForm = deleteDynForm;
window.deleteActiveDynForm = function() { if (window.dfmActiveId) deleteDynForm(window.dfmActiveId); };

// ==================== QUESTIONS ====================
window.dfmFieldTypeChanged = function() {
  const choice = DFM_CHOICE.includes(document.getElementById('dfm-field-type').value);
  const field = document.getElementById('dfm-options-field');
  if (field) field.style.display = choice ? '' : 'none';
};

window.openDynFieldModal = function(fieldId = null) {
  const f = dfmFind(window.dfmActiveId);
  const modal = document.getElementById('dfm-field-modal');
  if (!f || !modal) return;
  const fd = fieldId ? (f.fields || []).find(x => String(x.id) === String(fieldId)) : null;
  modal.querySelector('form')?.reset();
  document.getElementById('dfm-field-modal-title').textContent = fd ? 'ویرایش سؤال' : 'سؤال جدید';
  document.getElementById('dfm-field-modal-sub').textContent = `فرم «${f.title}»`;
  document.getElementById('dfm-field-id').value = fd ? fd.id : '';
  document.getElementById('dfm-field-label').value = fd ? fd.label : '';
  document.getElementById('dfm-field-type').value = fd ? fd.type : 'text';
  document.getElementById('dfm-field-required').checked = !!(fd && fd.isRequired);
  document.getElementById('dfm-field-options').value = fd ? dfmOptions(fd).join('\n') : '';
  window.dfmFieldTypeChanged();
  modal.style.display = 'flex';
  modal.style.zIndex = 'var(--z-modal)';
  setTimeout(() => document.getElementById('dfm-field-label')?.focus(), 50);
};

async function dfmSaveField(body) {
  const res = await request('/api/v1/admin/forms/fields', { method: 'POST', body: JSON.stringify(body) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || 'خطا در ذخیره سؤال');
  return d.data;
}

window.saveDynField = async function(e) {
  if (e) e.preventDefault();
  const f = dfmFind(window.dfmActiveId);
  if (!f) return;
  const id = document.getElementById('dfm-field-id').value;
  const type = document.getElementById('dfm-field-type').value;
  const options = document.getElementById('dfm-field-options').value.split('\n').map(s => s.trim()).filter(Boolean);
  if (DFM_CHOICE.includes(type) && options.length < 2) return showToast('برای این نوع سؤال دست‌کم دو گزینه بنویسید', 'error');
  const existing = id ? (f.fields || []).find(x => String(x.id) === String(id)) : null;
  const order = existing ? existing.orderIndex : (dfmFields(f).reduce((m, x) => Math.max(m, x.orderIndex || 0), 0) + 1);
  try {
    await dfmSaveField({
      id: id || undefined, formId: f.id, type,
      label: document.getElementById('dfm-field-label').value.trim(),
      isRequired: document.getElementById('dfm-field-required').checked,
      orderIndex: order,
      optionsJson: DFM_CHOICE.includes(type) ? JSON.stringify(options) : null,
    });
    showToast('سؤال ذخیره شد', 'success');
    NopaActions.hide('dfm-field-modal');
    await loadDynForms();
  } catch (err) { showToast(err.message, 'error'); }
};

// Swap the order of two neighbouring questions (orders are renumbered 1..n so equal orders sort predictably)
window.moveDynField = async function(fieldId, dir) {
  const f = dfmFind(window.dfmActiveId);
  if (!f) return;
  const list = dfmFields(f);
  const i = list.findIndex(x => String(x.id) === String(fieldId));
  const j = i + Number(dir);
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  const changes = list.map((x, k) => ({ x, order: k + 1 })).filter(c => c.x.orderIndex !== c.order);
  try {
    await Promise.all(changes.map(c => dfmSaveField({ id: c.x.id, type: c.x.type, label: c.x.label, isRequired: c.x.isRequired, orderIndex: c.order, optionsJson: c.x.optionsJson })));
    changes.forEach(c => { c.x.orderIndex = c.order; });
    window.loadDynFormPage();
  } catch (err) { showToast(err.message, 'error'); loadDynForms(); }
};

window.deleteDynField = async function(fieldId) {
  const f = dfmFind(window.dfmActiveId);
  const fd = f && (f.fields || []).find(x => String(x.id) === String(fieldId));
  if (!fd || !(await NopaConfirm(`سؤال «${fd.label}» حذف شود؟`))) return;
  try {
    const res = await request(`/api/v1/admin/forms/fields/${encodeURIComponent(fieldId)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('خطا در حذف سؤال');
    f.fields = (f.fields || []).filter(x => String(x.id) !== String(fieldId));
    window.loadDynFormPage();
    dfmDrawBento();
  } catch (err) { showToast(err.message, 'error'); }
};

// ==================== ONE ANSWER ====================
window.openDynAnswer = function(subId) {
  const f = dfmFind(window.dfmActiveId);
  const s = (dfmAnswersCache.get(String(window.dfmActiveId)) || []).find(x => String(x.id) === String(subId));
  const modal = document.getElementById('dfm-answer-modal');
  if (!f || !s || !modal) return;
  let answers = {};
  try { answers = JSON.parse(s.answersJson || '{}') || {}; } catch (_) { answers = { پاسخ: s.answersJson }; }
  const fields = dfmFields(f);
  const used = new Set();
  const show = v => (v == null || v === '' ? '<span class="u-c-text-muted">بی‌پاسخ</span>' : esc(Array.isArray(v) ? v.join('، ') : typeof v === 'object' ? JSON.stringify(v) : String(v)));
  const rows = fields.map(fd => {
    const key = fd.id in answers ? fd.id : fd.label in answers ? fd.label : null;
    if (key) used.add(key);
    return `<div class="dfm-qa"><span>${esc(fd.label)}</span><p>${show(key ? answers[key] : null)}</p></div>`;
  });
  Object.keys(answers).filter(k => !used.has(k)).forEach(k => rows.push(`<div class="dfm-qa is-extra"><span>${esc(k)}</span><p>${show(answers[k])}</p></div>`));
  document.getElementById('dfm-answer-title').textContent = s.user?.name || 'کاربر';
  document.getElementById('dfm-answer-sub').textContent = `${new Date(s.submittedAt).toLocaleString('fa-IR')}${s.user?.phoneNumber ? ' · ' + s.user.phoneNumber : ''}`;
  document.getElementById('dfm-answer-body').innerHTML = `<section class="lse-card"><h4 class="lse-card-title"><i class="fa-brands fa-wpforms"></i> ${esc(f.title)}</h4>${rows.join('') || '<div class="lsv-col-empty">پاسخی ثبت نشده است.</div>'}</section>`;
  modal.style.display = 'flex';
  modal.style.zIndex = 'var(--z-modal)';
};

if (!dfmLoaded) window.dfmSetLoading(true);
