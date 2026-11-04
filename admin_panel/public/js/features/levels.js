// Levels & certificates tab: bento overview of the levels (#lvl-overview-view) and one level's page
// (#lvl-detail-view), like the caravans and mentors tabs. A student's level (levelFrame) is the 1-based position of
// the station they reached in the ordered station list (app/lib/core/station_state.dart), so each level is one
// station. Everything comes from GET /admin/levels-and-certificates (students + stations) in one request; the
// page also changes a student's level and marks printed certificates as posted (PATCH /admin/levels/orders/:id).
// Styles: css/stations.css (.lst-*, .lsv-*, .crv-*, .lvl-*). Helpers from caravans.js / mentors.js / audience.js.
window.lvlStudents = [];
window.lvlStations = null;  // null until the first load (then the LMS list is the fallback for level names)
window.lvlActiveLevel = null;
window.lvlRendered = null;
let lvlLoadedOnce = false;

const LVL_ORDER_STATUS = {
  PENDING_PRINT: { cls: 'is-warn', label: 'در انتظار چاپ', icon: 'fa-print' },
  DISPATCHED: { cls: 'is-ok', label: 'ارسال شده', icon: 'fa-truck-fast' },
};

// ---- levels (= stations in path order) ----
function lvlStationList() {
  const list = window.lvlStations || window.lmsStationsMasterList || [];
  return list.slice().sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
}
function lvlStationAt(level) { return lvlStationList()[Number(level) - 1] || null; }
// "سطح ۳ · منزلگاه شهر" (short: "سطح ۳")
window.lvlLevelName = function(level, short) {
  const n = Number(level) || 1;
  const s = !short && lvlStationAt(n);
  return `سطح ${crvFa(n)}${s ? ` · ${s.title}` : ''}`;
};
// <option>s for a level select (the user dialog uses it too)
window.lvlLevelOptionsHtml = function(selected) {
  const count = Math.max(lvlStationList().length, Number(selected) || 1, 1);
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    return `<option value="${n}"${n === Number(selected) ? ' selected' : ''}>${esc(window.lvlLevelName(n))}</option>`;
  }).join('');
};
// Every level that exists: one per station, plus any level a student holds beyond the list
function lvlLevels() {
  const stations = lvlStationList();
  const max = Math.max(stations.length, ...window.lvlStudents.map(s => Number(s.levelFrame) || 1), 1);
  return Array.from({ length: max }, (_, i) => {
    const n = i + 1;
    const students = window.lvlStudents.filter(s => (Number(s.levelFrame) || 1) === n);
    const orders = students.flatMap(s => (s.physicalOrders || []).map(o => ({ ...o, student: s })));
    return {
      n, station: stations[i] || null, students, orders,
      certified: students.filter(lvlCertCount).length,
      pending: orders.filter(o => o.status !== 'DISPATCHED').length,
      incomplete: students.filter(s => !s.registrationCompleted).length,
    };
  });
}
function lvlFind(n) { return lvlLevels().find(l => l.n === Number(n)) || null; }
function lvlCertCount(s) { return Number(s?._count?.certificates ?? (s?.certificates || []).length) || 0; }
function lvlDays(d) { const t = new Date(d); return isNaN(t) ? 0 : Math.floor((Date.now() - t) / 86400000); }
function lvlMatches(s, q) {
  return !q || [s.name, s.phoneNumber, s.userCode ? `np-${s.userCode}` : '', s.caravan?.name].some(v => String(v || '').toLowerCase().includes(q));
}

// ==================== LOADER ====================
async function loadLevelsAndCertificatesTab() {
  window.lvlSetLoading(true);
  try {
    const res = await request('/api/v1/admin/levels-and-certificates');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'خطا در دریافت سطوح و گواهینامه‌ها');
    window.lvlStudents = Array.isArray(data.data) ? data.data : [];
    if (Array.isArray(data.stations)) window.lvlStations = data.stations;
    lvlLoadedOnce = true;
    window.lvlSetLoading(false);
    lvlFillUserLevelFilter();
    window.filterLevelsList();
    if (window.lvlActiveLevel !== null) {
      if (lvlFind(window.lvlActiveLevel)) window.loadLevelPage(); else window.closeLevelView();
    }
  } catch (err) {
    console.error('Failed to load levels and certificates:', err);
    window.lvlSetLoading(false);
    const grid = document.getElementById('lvl-bento-list');
    if (grid) grid.innerHTML = `<div class="lst-empty"><i class="fa-solid fa-triangle-exclamation lst-warn"></i> ${esc(err.message || 'خطا در دریافت سطوح و گواهینامه‌ها')}</div>`;
  }
}
window.loadLevelsAndCertificatesTab = loadLevelsAndCertificatesTab;
// Something changed a student elsewhere (user dialog): refresh when this tab is the one showing
window.lvlInvalidate = function() {
  if (typeof activeTab !== 'undefined' && activeTab === 'levels-tab') loadLevelsAndCertificatesTab();
};

// The همسفران tab's level filter shows the level names too
function lvlFillUserLevelFilter() {
  const sel = document.getElementById('filter-level-ctrl');
  if (!sel) return;
  const current = sel.value;
  const count = Math.max(lvlStationList().length, 1);
  sel.innerHTML = '<option value="">همه سطح‌ها</option>' + Array.from({ length: count }, (_, i) => `<option value="${i + 1}">${esc(window.lvlLevelName(i + 1))}</option>`).join('');
  if (current && !sel.querySelector(`option[value="${CSS.escape(current)}"]`)) sel.insertAdjacentHTML('beforeend', `<option value="${esc(current)}">${esc(window.lvlLevelName(current))}</option>`);
  sel.value = current;
}

// ==================== OVERVIEW (BENTO) ====================

window.filterLevelsList = function() {
  const overview = document.getElementById('lvl-overview-view');
  if (window.NopaFlip && overview) window.NopaFlip.render(overview, lvlDrawBento); else lvlDrawBento();
};

window.openLevelPrintQueue = function() {
  const f = document.getElementById('lvl-filter');
  if (f) f.value = 'pending';
  if (window.lvlActiveLevel !== null) window.closeLevelView();
  window.filterLevelsList();
};

function lvlCard(l, q, total, maxCount) {
  const s = l.station;
  const title = s ? s.title : 'بدون منزلگاه';
  const hits = q ? l.students.filter(st => lvlMatches(st, q)).length : 0;
  const fill = maxCount ? Math.round(l.students.length / maxCount * 100) : 0;
  const shown = (q ? l.students.filter(st => lvlMatches(st, q)) : l.students);
  const faces = shown.slice(0, 4).map(st => crvAvatar(st.avatarUrl, st.name, 'crv-face')).join('');
  const more = shown.length > 4 ? `<span class="crv-face crv-face-more">+${crvFa(shown.length - 4)}</span>` : '';
  const chip = !s
    ? '<span class="lst-chip lst-chip-locked"><i class="fa-solid fa-circle-question"></i> بدون منزلگاه</span>'
    : s.status === 'locked'
      ? `<span class="lst-chip lst-chip-scheduled"><i class="fa-solid fa-lock"></i> منزلگاه ${crvFa(s.orderIndex)}</span>`
      : `<span class="lst-chip lst-chip-active"><i class="fa-solid fa-map-location-dot"></i> منزلگاه ${crvFa(s.orderIndex)}</span>`;
  return `
    <button type="button" class="crv-card lvl-card" data-anim-key="lv:${l.n}" data-click="openLevelView" data-click-args="${crvArgs(l.n)}" title="ورود به ${esc(window.lvlLevelName(l.n))}">
      <span class="crv-card-top">
        ${crvAvatar(s?.iconUrl, String(l.n), 'crv-card-cover lvl-cover')}
        <span class="crv-card-name"><strong>سطح ${crvFa(l.n)}</strong>${chip}</span>
      </span>
      <span class="crv-card-mentor"><i class="fa-solid fa-flag"></i><span>${esc(title)}</span></span>
      <span class="crv-card-cap">
        <span>${q ? `${crvFa(hits)} نفر با این جستجو` : `${crvFa(total ? Math.round(l.students.length / total * 100) : 0)}٪ نوجوانان`}</span>
        <strong>${crvFa(l.students.length)} نوجوان</strong>
      </span>
      <span class="lst-bar"><span class="lst-bar-active" data-style="width:${fill}%"></span></span>
      <span class="crv-card-foot">
        <span class="crv-faces">${faces}${more}</span>
        <span class="crv-card-nums">
          ${l.pending ? `<span class="u-c-accent-text" title="در انتظار چاپ"><i class="fa-solid fa-print"></i> ${crvFa(l.pending)}</span>` : ''}
          <span class="u-c-success-text" title="گواهینامه‌دار"><i class="fa-solid fa-certificate"></i> ${crvFa(l.certified)}</span>
        </span>
      </span>
    </button>`;
}

function lvlDrawBento() {
  const levels = lvlLevels();
  const students = window.lvlStudents || [];
  const q = (document.getElementById('lvl-search')?.value || '').trim().toLowerCase();
  const filter = document.getElementById('lvl-filter')?.value || 'all';
  const sort = document.getElementById('lvl-sort')?.value || 'order';
  const filtering = !!q || filter !== 'all';

  let list = levels.filter(l => {
    if (filter === 'pending' && !l.pending) return false;
    if (filter === 'incomplete' && !l.incomplete) return false;
    if (q && !(String(l.station?.title || '').toLowerCase().includes(q) || l.students.some(s => lvlMatches(s, q)))) return false;
    return true;
  });
  if (sort === 'students_desc') list = list.slice().sort((a, b) => b.students.length - a.students.length);
  if (sort === 'certs_desc') list = list.slice().sort((a, b) => b.certified - a.certified);

  const badge = document.getElementById('lvl-count-badge');
  if (badge) badge.textContent = filtering ? `نمایش ${crvFa(list.length)} از ${crvFa(levels.length)} سطح` : 'هر سطح یک منزلگاه است؛ برای دیدن نوجوانانش بزنید';

  const grid = document.getElementById('lvl-bento-list');
  if (grid) {
    const maxCount = Math.max(...levels.map(l => l.students.length), 0);
    const cards = list.map(l => lvlCard(l, q, students.length, maxCount));
    if (!cards.length) cards.push(`<div class="lst-empty" data-anim-key="lv-empty">${filtering ? 'سطحی با این مشخصات یافت نشد.' : 'هنوز منزلگاهی ساخته نشده است.'}</div>`);
    grid.innerHTML = cards.join('');
    grid.setAttribute('aria-busy', 'false');
  }

  // ---- stats ----
  const orders = students.flatMap(s => (s.physicalOrders || []).map(o => ({ ...o, student: s })));
  const pending = orders.filter(o => o.status !== 'DISPATCHED');
  const sent = orders.length - pending.length;
  const setStat = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setStat('lvl-stat-students', crvFa(students.length));
  setStat('lvl-stat-certified', crvFa(students.filter(lvlCertCount).length));
  setStat('lvl-stat-pending', crvFa(pending.length));
  setStat('lvl-stat-sent', crvFa(sent));

  const ordersEl = document.getElementById('lvl-bento-orders');
  if (ordersEl) {
    const certs = students.reduce((n, s) => n + lvlCertCount(s), 0);
    const all = orders.length || 1;
    ordersEl.innerHTML = `
      <div class="lst-bar">
        <span class="lst-bar-active" data-style="width:${(sent / all * 100).toFixed(1)}%"></span>
        <span class="lst-bar-scheduled" data-style="width:${(pending.length / all * 100).toFixed(1)}%"></span>
      </div>
      <div class="lst-legend">
        <div class="lst-legend-row"><span><span class="lst-dot lst-dot-active"></span>ارسال‌شده</span><strong>${crvFa(sent)}</strong></div>
        <div class="lst-legend-row"><span><span class="lst-dot lst-dot-scheduled"></span>در انتظار چاپ</span><strong>${crvFa(pending.length)}</strong></div>
        <div class="lst-legend-row"><span><i class="fa-solid fa-certificate u-c-success-text"></i> گواهینامه صادرشده</span><strong>${crvFa(certs)}</strong></div>
      </div>`;
  }

  const queueEl = document.getElementById('lvl-bento-queue');
  if (queueEl) {
    const queue = pending.slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).slice(0, 5);
    queueEl.innerHTML = queue.length
      ? `<ul class="lst-list">${queue.map(o => `
          <li class="lst-list-item lst-clickable" role="button" tabindex="0" data-click="openLevelView" data-click-args="${crvArgs(Number(o.student.levelFrame) || 1)}">
            ${crvAvatar(o.student.avatarUrl, o.student.name, 'lst-avatar')}
            <span class="lst-grow"><strong>${esc(o.student.name || '')}</strong> <small class="u-c-text-muted">${esc(o.certificate?.title || '')}</small></span>
            <span class="${lvlDays(o.createdAt) > 7 ? 'u-c-danger-text' : 'u-c-accent-text'}">${crvFa(lvlDays(o.createdAt))} روز</span>
          </li>`).join('')}</ul>`
      : '<div class="lst-empty"><i class="fa-solid fa-circle-check u-c-success-text"></i> صف چاپ خالی است.</div>';
  }

  const topEl = document.getElementById('lvl-bento-top');
  if (topEl) {
    const top = students.slice().sort((a, b) => (b.levelFrame - a.levelFrame) || (lvlCertCount(b) - lvlCertCount(a))).slice(0, 4);
    topEl.innerHTML = top.length
      ? `<ul class="lst-list">${top.map((s, i) => `
          <li class="lst-list-item lst-clickable" role="button" tabindex="0" data-click="openLevelView" data-click-args="${crvArgs(Number(s.levelFrame) || 1)}">
            <span class="crv-rank">${crvFa(i + 1)}</span>
            ${crvAvatar(s.avatarUrl, s.name, 'lst-avatar')}
            <span class="lst-grow"><strong>${esc(s.name || '')}</strong></span>
            <span class="u-c-primary-text"><i class="fa-solid fa-layer-group"></i> ${crvFa(s.levelFrame || 1)}</span>
          </li>`).join('')}</ul>`
      : '<div class="lst-empty">هنوز نوجوانی ثبت‌نام نکرده است.</div>';
  }

  const healthEl = document.getElementById('lvl-bento-health');
  if (healthEl) {
    const issues = [];
    const stale = pending.filter(o => lvlDays(o.createdAt) > 7);
    if (stale.length) issues.push({ n: Number(stale[0].student.levelFrame) || 1, text: `${crvFa(stale.length)} درخواست چاپ بیش از یک هفته در صف مانده است` });
    levels.filter(l => !l.station && l.students.length).forEach(l => issues.push({ n: l.n, text: `سطح ${crvFa(l.n)}: ${crvFa(l.students.length)} نوجوان در سطحی بدون منزلگاه` }));
    levels.filter(l => l.incomplete).forEach(l => issues.push({ n: l.n, text: `سطح ${crvFa(l.n)}: ${crvFa(l.incomplete)} پروفایل ناقص` }));
    healthEl.innerHTML = issues.length
      ? `<ul class="lst-list">${issues.slice(0, 6).map(x => `
          <li class="lst-list-item lst-clickable" role="button" tabindex="0" data-click="openLevelView" data-click-args="${crvArgs(x.n)}">
            <i class="fa-solid fa-triangle-exclamation lst-warn"></i>
            <span class="lst-grow">${esc(x.text)}</span>
          </li>`).join('')}</ul>`
      : '<div class="lst-empty"><i class="fa-solid fa-circle-check u-c-success-text"></i> پروفایل‌ها کامل‌اند و صف چاپ به‌روز است.</div>';
  }
}

// ==================== LOADING SHIMMER ====================
window.lvlSetLoading = function(on) {
  const overview = document.getElementById('lvl-overview-view');
  if (!overview) return;
  overview.querySelectorAll('.lst-bento > .lst-tile').forEach(t => t.classList.toggle('is-loading', on));
  const grid = document.getElementById('lvl-bento-list');
  if (grid) grid.setAttribute('aria-busy', on ? 'true' : 'false');
  if (!on || lvlLoadedOnce) return;
  if (grid) {
    grid.innerHTML = Array.from({ length: 6 }, () => `
      <div class="crv-card lst-skel" aria-hidden="true">
        <span class="crv-card-top"><span class="crv-card-cover"></span><span class="crv-card-name"><span class="lst-skel-line"></span><span class="lst-skel-line lst-skel-chip"></span></span></span>
        <span class="lst-skel-line lst-skel-short"></span>
        <span class="lst-skel-line"></span>
        <span class="lst-skel-line lst-skel-short"></span>
      </div>`).join('');
  }
  const lines = '<div class="lst-skel-lines" aria-hidden="true">' + '<span class="lst-skel-row"></span>'.repeat(3) + '</div>';
  ['lvl-bento-orders', 'lvl-bento-queue', 'lvl-bento-top', 'lvl-bento-health'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = lines;
  });
};

// ==================== ONE LEVEL'S PAGE ====================
// Circles are all levels; the level's station card is linked to its students and to their certificate requests.

window.openLevelView = function(level) {
  const overview = document.getElementById('lvl-overview-view');
  window.lvlActiveLevel = Number(level) || 1;
  // the overview search carries over to the students column
  const q = document.getElementById('lvl-search')?.value || '';
  const filter = document.getElementById('lvl-students-filter');
  if (filter) filter.value = q;
  const open = () => {
    window.loadLevelPage();
    document.getElementById('levels-tab')?.scrollIntoView({ block: 'start', behavior: NopaMotion.scrollBehavior() });
  };
  // from another tab (همسفران) the overview may not have been drawn yet
  if (!lvlLoadedOnce) { loadLevelsAndCertificatesTab(); return; }
  if (overview && overview.style.display !== 'none') crvFadeOut(overview, open); else open();
};

window.closeLevelView = function() {
  const view = document.getElementById('lvl-detail-view');
  const overview = document.getElementById('lvl-overview-view');
  window.lvlActiveLevel = null;
  window.lvlRendered = null;
  crvFadeOut(view, () => {
    if (window.lvlActiveLevel !== null) return; // another level was opened meanwhile
    if (view) view.style.display = 'none';
    if (overview) {
      overview.style.display = '';
      if (window.NopaFlip) window.NopaFlip.enter(overview.querySelectorAll(':scope > div:first-child, .lst-bento > .lst-tile'));
    }
  });
};

window.selectLevelCircle = function(level) {
  if (Number(window.lvlActiveLevel) === Number(level)) return;
  window.lvlActiveLevel = Number(level);
  const filter = document.getElementById('lvl-students-filter');
  if (filter) filter.value = '';
  window.loadLevelPage();
};

window.openActiveLevelStation = function() {
  const s = lvlStationAt(window.lvlActiveLevel);
  if (!s) return showToast('این سطح منزلگاهی ندارد', 'info');
  window.usrGoTab('lms-tab');
  if (typeof window.openLmsStationView === 'function') window.openLmsStationView(s.id);
};
window.openActiveLevelUsers = function() {
  const n = String(window.lvlActiveLevel || '');
  const sel = document.getElementById('filter-level-ctrl');
  if (sel) sel.value = n;
  filterLevelVal = n;
  usersPage = 1;
  if (typeof window.closeUserView === 'function' && window.usrActiveId) window.closeUserView();
  window.usrGoTab('users-tab');
};

function lvlCircles(active) {
  return lvlLevels().map(l => {
    const isActive = l.n === Number(active);
    const s = l.station;
    return `
      <button type="button" class="lsv-circle${isActive ? ' is-active' : ''}" data-anim-key="lc:${l.n}" data-click="selectLevelCircle" data-click-args="${crvArgs(l.n)}" title="${esc(window.lvlLevelName(l.n))}"${isActive ? ' aria-current="true"' : ''}>
        <span class="lsv-circle-main">
          <span class="lsv-circle-img">${s?.iconUrl ? `<img src="${esc(s.iconUrl)}" alt="" loading="lazy" data-error="lmsImageFallback" data-error-args='["$this", "${l.n}"]'>` : `<span>${crvFa(l.n)}</span>`}</span>
          <span class="lsv-circle-badge ${l.pending ? 'lsv-state-scheduled' : !s ? 'lsv-state-locked' : 'lsv-state-active'}">${crvFa(l.students.length)}</span>
        </span>
        <span class="lsv-circle-name"><span>سطح ${crvFa(l.n)}</span></span>
      </button>`;
  }).join('');
}

function lvlInfoCard(l) {
  const s = l.station;
  const total = (window.lvlStudents || []).length;
  const facts = [
    s ? `<span><i class="fa-solid fa-hashtag"></i> منزلگاه ${crvFa(s.orderIndex)}</span>` : '<span class="u-c-danger-text"><i class="fa-solid fa-circle-question"></i> منزلگاهی برای این سطح نیست</span>',
    s ? `<span><i class="fa-solid ${s.status === 'locked' ? 'fa-lock' : 'fa-lock-open'}"></i> ${s.status === 'locked' ? 'قفل' : 'باز'}</span>` : '',
    `<span><i class="fa-solid fa-chart-pie"></i> ${crvFa(total ? Math.round(l.students.length / total * 100) : 0)}٪ نوجوانان</span>`,
    l.incomplete ? `<span class="u-c-danger-text"><i class="fa-solid fa-user-clock"></i> ${crvFa(l.incomplete)} پروفایل ناقص</span>` : '',
  ].filter(Boolean).join('');
  return `
    ${crvAvatar(s?.iconUrl, String(l.n), 'crv-mentor-photo lvl-photo')}
    <strong class="crv-mentor-name">سطح ${crvFa(l.n)}</strong>
    <span class="crv-mentor-phone">${esc(s ? s.title : 'بدون منزلگاه')}</span>
    <div class="mnt-mini">
      <span><strong>${crvFa(l.students.length)}</strong><small>نوجوان</small></span>
      <span><strong>${crvFa(l.certified)}</strong><small>گواهینامه‌دار</small></span>
      <span class="${l.pending ? 'is-warn' : ''}"><strong>${crvFa(l.pending)}</strong><small>در انتظار چاپ</small></span>
    </div>
    <div class="lsv-facts crv-mentor-facts">${facts}</div>
    ${s?.subtitle ? `<p class="crv-mentor-bio">${esc(s.subtitle)}</p>` : ''}
    <div class="mnt-info-actions">
      ${s ? '<button type="button" class="lsv-pill" data-click="openActiveLevelStation"><i class="fa-solid fa-map-location-dot"></i> صفحه منزلگاه</button>' : ''}
      <button type="button" class="lse-btn" data-click="openActiveLevelUsers"><i class="fa-solid fa-people-group"></i> در همسفران</button>
    </div>`;
}

function lvlStudentRow(s) {
  const cert = (s.certificates || [])[0];
  const sub = [s.userCode ? `NP-${esc(s.userCode)}` : '', s.caravan?.name ? esc(s.caravan.name) : 'بدون کاروان', cert ? `<i class="fa-solid fa-certificate u-c-success-text"></i> ${esc(cert.title)}` : ''].filter(Boolean).join(' · ');
  return `
    <div class="lsv-row crv-member" data-anim-key="ls:${esc(s.id)}">
      ${crvAvatar(s.avatarUrl, s.name, 'lsv-row-avatar lsv-row-num')}
      <span class="lsv-row-text"><strong>${esc(s.name || 'بدون نام')}</strong><span>${sub}</span></span>
      ${s.registrationCompleted ? '' : '<span class="lsv-status is-warn">ناقص</span>'}
      <span class="lsv-round-group crv-member-tools">
        <button type="button" class="lsv-round lsv-round-sm" data-click="openLevelOverride" data-click-args="${crvArgs(s.id)}" title="تغییر سطح" aria-label="تغییر سطح"><i class="fa-solid fa-layer-group"></i></button>
        <button type="button" class="lsv-round lsv-round-sm" data-click="viewUserDetails" data-click-args="${crvArgs(s.id)}" title="گزارش کامل" aria-label="گزارش کامل"><i class="fa-solid fa-chart-line"></i></button>
      </span>
    </div>`;
}

function lvlOrderRow(o) {
  const st = LVL_ORDER_STATUS[o.status] || LVL_ORDER_STATUS.PENDING_PRINT;
  const sent = o.status === 'DISPATCHED';
  const sub = [esc(o.student.name || ''), o.postalCode ? `کدپستی <bdi dir="ltr">${esc(o.postalCode)}</bdi>` : '', usrDate(o.createdAt), o.trackingCode ? `رهگیری <bdi dir="ltr">${esc(o.trackingCode)}</bdi>` : ''].filter(Boolean).join(' · ');
  return `
    <div class="lsv-row crv-member" data-anim-key="lo:${esc(o.id)}">
      <span class="lsv-row-avatar lsv-row-num usr-act-icon ${sent ? 'is-info' : 'is-accent'}"><i class="fa-solid ${st.icon}"></i></span>
      <span class="lsv-row-text"><strong>${esc(o.certificate?.title || 'گواهینامه')}</strong><span>${sub}</span></span>
      <span class="lsv-status ${st.cls}">${st.label}</span>
      <span class="lsv-round-group crv-member-tools">
        ${sent
          ? `<button type="button" class="lsv-round lsv-round-sm" data-click="returnLevelOrder" data-click-args="${crvArgs(o.id)}" title="بازگشت به صف چاپ" aria-label="بازگشت به صف چاپ"><i class="fa-solid fa-rotate-left"></i></button>`
          : `<button type="button" class="lsv-round lsv-round-sm" data-click="openLevelOrderDispatch" data-click-args="${crvArgs(o.id)}" title="ثبت ارسال" aria-label="ثبت ارسال"><i class="fa-solid fa-truck-fast"></i></button>`}
      </span>
    </div>`;
}

// Students column: searchable (the overview's search carries over)
window.renderLevelStudents = function() {
  const l = lvlFind(window.lvlActiveLevel);
  const list = document.getElementById('lvl-students-list');
  if (!l || !list) return;
  const q = (document.getElementById('lvl-students-filter')?.value || '').trim().toLowerCase();
  const shown = l.students.filter(s => lvlMatches(s, q)).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fa'));
  const count = document.getElementById('lvl-students-count');
  if (count) count.textContent = crvFa(l.students.length);
  list.innerHTML = shown.length
    ? shown.map(lvlStudentRow).join('')
    : `<div class="lsv-col-empty">${l.students.length ? 'نوجوانی با این جستجو یافت نشد.' : 'هنوز نوجوانی به این سطح نرسیده است.'}</div>`;
};

function lvlPaint(l) {
  const set = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };
  set('lvl-title', el => { el.textContent = window.lvlLevelName(l.n); });
  set('lvl-state', el => {
    el.innerHTML = l.pending ? `<span class="lst-chip lst-chip-scheduled"><i class="fa-solid fa-print"></i> ${crvFa(l.pending)} در انتظار چاپ</span>` : '';
  });
  set('lvl-sub', el => { el.textContent = `${crvFa(l.students.length)} نوجوان · ${crvFa(l.certified)} گواهینامه‌دار`; });
  set('lvl-circles', el => { el.innerHTML = lvlCircles(l.n); });
  set('lvl-info-card', el => { el.innerHTML = lvlInfoCard(l); });
  window.renderLevelStudents();
  const orders = l.orders.slice().sort((a, b) => (a.status === 'DISPATCHED') - (b.status === 'DISPATCHED') || new Date(a.createdAt) - new Date(b.createdAt));
  set('lvl-orders-count', el => { el.textContent = crvFa(orders.length); });
  set('lvl-orders-list', el => {
    el.innerHTML = orders.length
      ? orders.map(lvlOrderRow).join('')
      : `<div class="lsv-col-empty">درخواست چاپی در این سطح نیست${l.certified ? `؛ ${crvFa(l.certified)} نفر گواهینامه دیجیتال دارند` : ''}.</div>`;
  });
}

window.loadLevelPage = function() {
  const view = document.getElementById('lvl-detail-view');
  const overview = document.getElementById('lvl-overview-view');
  const l = lvlFind(window.lvlActiveLevel);
  if (!view || !l) return;
  const wasOpen = view.style.display !== 'none';
  const same = wasOpen && window.lvlRendered === l.n;
  window.lvlRendered = l.n;
  if (overview) overview.style.display = 'none';
  view.style.display = 'block';
  if (same && window.NopaFlip) window.NopaFlip.render(view, () => lvlPaint(l));
  else {
    lvlPaint(l);
    if (window.NopaFlip) {
      window.NopaFlip.enter(view.querySelectorAll(wasOpen ? '.lvl-flow > .lsv-col, .lvl-flow > .lsv-link'
        : '.lsv-head, .lsv-board, .lsv-notch .lsv-circle, .lvl-flow > .lsv-col'));
      const picked = wasOpen && view.querySelector('.lsv-circle.is-active .lsv-circle-img');
      if (picked && typeof picked.animate === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        picked.animate([{ transform: 'scale(0.8)' }, { transform: 'scale(1.12)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
      }
    }
  }
  mntFitNotch(view);
};

// ==================== DIALOGS ====================

// Change a student's level: one row per level (station)
window.openLevelOverride = function(userId) {
  const s = (window.lvlStudents || []).find(x => String(x.id) === String(userId));
  const modal = document.getElementById('lvl-level-modal');
  if (!modal) return;
  const current = Number(s?.levelFrame) || 1;
  document.getElementById('lvl-level-user-id').value = String(userId);
  document.getElementById('lvl-level-modal-title').textContent = `تغییر سطح ${s?.name || ''}`.trim();
  const box = document.getElementById('lvl-level-options');
  if (box) {
    box.innerHTML = lvlLevels().map(l => `
      <label class="lse-tree-row mnt-mod-option${l.n === current ? ' is-ok' : ''}">
        <input type="radio" name="lvl-level" value="${l.n}"${l.n === current ? ' checked' : ''}>
        <span class="lse-tree-num">${crvFa(l.n)}</span>
        <span class="lse-tree-text"><strong>${esc(l.station ? l.station.title : 'بدون منزلگاه')}</strong><small>${crvFa(l.students.length)} نوجوان${l.n === current ? ' · سطح فعلی' : ''}</small></span>
      </label>`).join('');
  }
  modal.style.display = 'flex';
  modal.style.zIndex = 'var(--z-modal)';
};
window.promptLevelOverride = window.openLevelOverride; // old name

window.saveLevelOverride = async function(e) {
  if (e) e.preventDefault();
  const userId = document.getElementById('lvl-level-user-id').value;
  const picked = document.querySelector('#lvl-level-options input[name="lvl-level"]:checked');
  if (!userId || !picked) return showToast('یک سطح انتخاب کنید', 'error');
  try {
    const res = await request(`/api/v1/admin/students/${encodeURIComponent(userId)}/level-frame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ levelFrame: parseInt(picked.value, 10) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return showToast(data.error || 'خطا در تغییر سطح', 'error');
    showToast('سطح با موفقیت تغییر یافت', 'success');
    NopaActions.hide('lvl-level-modal');
    await loadLevelsAndCertificatesTab();
  } catch (_) {
    showToast('خطای شبکه', 'error');
  }
};

function lvlOrderById(id) {
  for (const s of window.lvlStudents || []) {
    const o = (s.physicalOrders || []).find(x => String(x.id) === String(id));
    if (o) return { ...o, student: s };
  }
  return null;
}

window.openLevelOrderDispatch = function(orderId) {
  const o = lvlOrderById(orderId);
  const modal = document.getElementById('lvl-order-modal');
  if (!o || !modal) return;
  document.getElementById('lvl-order-id').value = String(o.id);
  document.getElementById('lvl-order-tracking').value = o.trackingCode || '';
  document.getElementById('lvl-order-modal-title').textContent = `ارسال «${o.certificate?.title || 'گواهینامه'}»`;
  const addr = document.getElementById('lvl-order-address');
  if (addr) {
    addr.innerHTML = `
      <div class="lsv-facts">
        <span><i class="fa-solid fa-user"></i> ${esc(o.recipientName || o.student.name || '')}</span>
        ${o.phoneNumber ? `<span><i class="fa-solid fa-phone"></i> <bdi dir="ltr">${esc(o.phoneNumber)}</bdi></span>` : ''}
        ${o.postalCode ? `<span><i class="fa-solid fa-envelope"></i> <bdi dir="ltr">${esc(o.postalCode)}</bdi></span>` : ''}
      </div>
      <p class="lvl-address-text">${esc(o.postalAddress || 'نشانی ثبت نشده است')}</p>`;
  }
  modal.style.display = 'flex';
  modal.style.zIndex = 'var(--z-modal)';
};

async function lvlSetOrderStatus(orderId, body) {
  const res = await request(`/api/v1/admin/levels/orders/${encodeURIComponent(orderId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'خطا در ثبت وضعیت سفارش');
  return data;
}

window.saveLevelOrderDispatch = async function(e) {
  if (e) e.preventDefault();
  const id = document.getElementById('lvl-order-id').value;
  const trackingCode = document.getElementById('lvl-order-tracking').value.trim();
  try {
    await lvlSetOrderStatus(id, { status: 'DISPATCHED', trackingCode });
    showToast('ارسال گواهینامه ثبت شد', 'success');
    NopaActions.hide('lvl-order-modal');
    await loadLevelsAndCertificatesTab();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.returnLevelOrder = async function(orderId) {
  if (!(await NopaConfirm('این سفارش به صف چاپ برگردد؟'))) return;
  try {
    await lvlSetOrderStatus(orderId, { status: 'PENDING_PRINT' });
    showToast('سفارش به صف چاپ برگشت', 'success');
    await loadLevelsAndCertificatesTab();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// The tab starts in its loading state until the first fetch finishes
window.lvlSetLoading(true);
