// همسفران (users tab): bento overview (#usr-overview-view) and one person's page (#usr-detail-view), like the
// caravans and mentors tabs. Search, filters and paging stay on the server (GET /admin/users, 20 per page; the
// filter controls are wired in js/app/bootstrap.js and call loadUsers). The circles are the people of the current
// page; a person's balances, path and activity come from GET /admin/users/:id/analytics (kept for next time).
// Styles: css/stations.css (.lst-*, .lsv-*, .crv-*, .usr-*). Helpers crvAvatar / crvFa / crvArgs / crvInitial /
// crvFadeOut come from js/features/caravans.js and mntFitNotch from js/features/mentors.js (both load earlier).
window.usrList = [];
window.usrStats = null;
window.usrActiveId = null;
window.usrRenderedId = null;
let usrLoadedOnce = false;
let usrLoadSeq = 0;
const usrAnalyticsCache = new Map(); // id -> /users/:id/analytics payload

const USR_ROLES = {
  student: { label: 'نوجوان', icon: 'fa-user-graduate' },
  mentor: { label: 'راهبر', icon: 'fa-user-tie' },
  sub_admin: { label: 'ادمین محتوا', icon: 'fa-user-gear' },
  channel_manager: { label: 'مسئول کانال‌ها', icon: 'fa-tower-broadcast' },
  admin: { label: 'سوپر ادمین', icon: 'fa-user-shield' },
};
const USR_MENTOR_LEVELS = { 1: 'راهبر مقدماتی', 2: 'راهبر پیشرفته', 3: 'راهبر ارشد' };

function usrFind(id) { return (window.usrList || []).find(u => String(u.id) === String(id)) || null; }
function usrRole(u) { return USR_ROLES[u?.role] || { label: u?.role || 'کاربر', icon: 'fa-user' }; }
function usrCode(u) { return u?.userCode ? `NP-${u.userCode}` : ''; }
function usrHasCaravan(u) { return !!u?.caravanId; }
function usrDate(d) { const t = d ? new Date(d) : null; return t && !isNaN(t) ? t.toLocaleDateString('fa-IR') : ''; }
function usrSuspended(u) { return u?.accountStatus && u.accountStatus !== 'ACTIVE' && u.accountStatus !== 'PENDING_VERIFICATION'; }
function usrStatusChip(u) {
  if (u.blocked) return '<span class="lst-chip lst-chip-locked"><i class="fa-solid fa-ban"></i> مسدود</span>';
  if (usrSuspended(u)) return '<span class="lst-chip lst-chip-locked"><i class="fa-solid fa-pause"></i> تعلیق</span>';
  if (u.accountStatus === 'PENDING_VERIFICATION') return '<span class="lst-chip lst-chip-scheduled"><i class="fa-solid fa-hourglass-half"></i> در انتظار تایید</span>';
  return `<span class="lst-chip lst-chip-active"><i class="fa-solid ${usrRole(u).icon}"></i> ${esc(usrRole(u).label)}</span>`;
}
// what a person still lacks (the "needs attention" tile and the identity card)
function usrProblems(u) {
  const p = [];
  if (u.blocked) p.push('حساب مسدود');
  else if (usrSuspended(u)) p.push('حساب تعلیق‌شده');
  if (u.role === 'student' && !usrHasCaravan(u)) p.push('بدون کاروان');
  if (u.registrationCompleted === false) p.push('ثبت‌نام ناقص');
  if (!u.phoneNumber) p.push('بدون شماره همراه');
  return p;
}
function usrLevelName(level, short) {
  return typeof window.lvlLevelName === 'function' ? window.lvlLevelName(level, short) : `سطح ${crvFa(level || 1)}`;
}

window.usrGoTab = function(tabId) {
  if (window.NopaRouter) window.NopaRouter.switchTab(tabId, true);
};
// Quick access: go to a tab, then open one of its dialogs (e.g. the station editor lives inside the stations tab)
window.usrGoTabAndRun = function(tabId, fnName) {
  window.usrGoTab(tabId);
  requestAnimationFrame(() => { if (typeof window[fnName] === 'function') window[fnName](); });
};

// ==================== LOADER ====================
// Called by the router on every visit and by the filters / pager (bootstrap.js). Keeps an open page in sync.
async function loadUsers() {
  const seq = ++usrLoadSeq;
  usrFillCaravanFilter();
  window.usrSetLoading(true);
  try {
    const url = `/api/v1/admin/users?page=${usersPage}&limit=20&search=${encodeURIComponent(userSearchVal)}&role=${encodeURIComponent(filterRoleVal)}&caravanId=${encodeURIComponent(filterCaravanVal)}&levelFrame=${encodeURIComponent(filterLevelVal)}&startDate=${encodeURIComponent(filterStartDateVal)}&endDate=${encodeURIComponent(filterEndDateVal)}`;
    const res = await request(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'خطا در دریافت فهرست همسفران');
    if (seq !== usrLoadSeq) return; // a newer filter is already loading
    usersTotal = data.total || 0;
    window.usrList = Array.isArray(data.users) ? data.users : [];
    window.usrStats = data.stats || null;
    usrLoadedOnce = true;
    window.usrSetLoading(false);
    window.filterUsersList();
    if (window.usrActiveId) {
      if (usrFind(window.usrActiveId)) { usrAnalyticsCache.delete(String(window.usrActiveId)); window.loadUserPage(); }
      else window.closeUserView();
    }
  } catch (err) {
    if (seq !== usrLoadSeq) return;
    console.error('Failed to load users:', err);
    window.usrSetLoading(false);
    if (err.message === 'Unauthorized') return;
    const grid = document.getElementById('usr-bento-list');
    if (grid) grid.innerHTML = `<div class="lst-empty"><i class="fa-solid fa-triangle-exclamation lst-warn"></i> ${esc(err.message || 'خطا در دریافت فهرست همسفران')}</div>`;
  }
}
window.loadUsersData = loadUsers;

// The caravan filter lists the caravans the panel already loaded (caravans.js); kept selected across reloads
function usrFillCaravanFilter() {
  const sel = document.getElementById('filter-caravan-ctrl');
  const caravans = window.caravansData || window.caravansMasterList || (typeof caravansList !== 'undefined' ? caravansList : []) || [];
  if (!sel || !caravans.length || sel.options.length === caravans.length + 1) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">همه کاروان‌ها</option>' + caravans.map(c => `<option value="${esc(c.id)}">${esc(c.name || c.title || '')}</option>`).join('');
  sel.value = current;
}

// ==================== OVERVIEW (BENTO) ====================

window.filterUsersList = function() {
  const overview = document.getElementById('usr-overview-view');
  if (window.NopaFlip && overview) window.NopaFlip.render(overview, usrDrawBento); else usrDrawBento();
};

function usrFiltering() {
  return !!(userSearchVal || filterRoleVal || filterCaravanVal || filterLevelVal || filterStartDateVal || filterEndDateVal);
}

function usrCard(u) {
  const role = usrRole(u);
  const pct = Math.max(0, Math.min(100, Number(u.completionRate) || 0));
  const line = u.role === 'mentor'
    ? `${USR_MENTOR_LEVELS[u.mentorLevel] || USR_MENTOR_LEVELS[1]}${u.city ? ` · ${esc(u.city)}` : ''}`
    : u.role === 'student'
      ? (usrHasCaravan(u) ? esc(u.caravanName) : '<em class="u-c-danger-text">بدون کاروان</em>')
      : esc(role.label);
  return `
    <button type="button" class="crv-card usr-card" data-anim-key="us:${esc(u.id)}" data-click="openUserView" data-click-args="${crvArgs(u.id)}" title="ورود به شناسنامه ${esc(u.name || '')}">
      <span class="crv-card-top">
        ${crvAvatar(u.avatarUrl, u.name, 'crv-card-cover')}
        <span class="crv-card-name"><strong>${esc(u.name || 'بدون نام')}</strong>${usrStatusChip(u)}</span>
      </span>
      <span class="crv-card-mentor"><i class="fa-solid ${u.role === 'student' ? 'fa-compass' : role.icon}"></i><span>${line}</span></span>
      <span class="crv-card-cap">
        <span>${usrCode(u) ? `<bdi dir="ltr">${esc(usrCode(u))}</bdi>` : 'بدون کد'}</span>
        <strong>${u.role === 'student' ? esc(usrLevelName(u.levelFrame, true)) : esc(usrDate(u.createdAt))}</strong>
      </span>
      ${u.role === 'student' ? `<span class="lst-bar" title="پیشرفت چالش‌ها"><span class="${pct >= 100 ? 'lst-bar-locked' : pct >= 80 ? 'lst-bar-scheduled' : 'lst-bar-active'}" data-style="width:${pct}%"></span></span>` : ''}
      <span class="crv-card-foot">
        <span class="usr-card-phone" dir="ltr">${esc(u.phoneNumber || '')}</span>
        <span class="crv-card-nums">
          ${u.role === 'student' ? `<span class="u-c-success-text" title="پیشرفت چالش‌ها"><i class="fa-solid fa-route"></i> ${crvFa(pct)}٪</span>` : ''}
          <span class="u-c-accent-text" title="زریک"><i class="fa-solid fa-coins"></i> ${crvFa(u.zarikBalance)}</span>
        </span>
      </span>
    </button>`;
}

function usrDrawBento() {
  const list = window.usrList || [];
  const filtering = usrFiltering();
  const st = window.usrStats || {};
  const roles = st.roles || {};
  const totalPages = Math.ceil((usersTotal || 0) / 20) || 1;

  const badge = document.getElementById('usr-count-badge');
  if (badge) badge.textContent = filtering ? `${crvFa(usersTotal)} همسفر با این فیلترها` : 'برای ورود به شناسنامه هر نفر بزنید';

  const grid = document.getElementById('usr-bento-list');
  if (grid) {
    const cards = list.map(usrCard);
    if (!filtering && usersPage === 1) {
      cards.push(`
        <button type="button" class="crv-card crv-card-add" data-anim-key="us-add" data-click="openUserModal" title="ثبت همسفر جدید">
          <span class="lsv-round lsv-round-lg"><i class="fa-solid fa-plus"></i></span>
          <span>همسفر جدید</span>
        </button>`);
    } else if (!list.length) {
      cards.push('<div class="lst-empty" data-anim-key="us-empty"><i class="fa-solid fa-user-slash"></i> همسفری با این فیلترها یافت نشد.</div>');
    }
    grid.innerHTML = cards.join('');
    grid.setAttribute('aria-busy', 'false');
  }

  // ---- pager ----
  const info = document.getElementById('users-page-info');
  if (info) info.textContent = `صفحه ${crvFa(usersPage)} از ${crvFa(totalPages)} · ${crvFa(usersTotal)} همسفر`;
  const prev = document.getElementById('btn-prev-users');
  if (prev) prev.disabled = usersPage <= 1;
  const next = document.getElementById('btn-next-users');
  if (next) next.disabled = usersPage >= totalPages;

  // ---- stats over everyone (server totals; the page alone when an older server sends none) ----
  const count = r => (st.roles ? Number(roles[r] || 0) : list.filter(u => u.role === r).length);
  const total = st.total ?? usersTotal;
  const setStat = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setStat('usr-stat-total', crvFa(total));
  setStat('usr-stat-students', crvFa(count('student')));
  setStat('usr-stat-mentors', crvFa(count('mentor')));
  setStat('usr-stat-zarik', crvFa(st.zarik ?? list.reduce((n, u) => n + (u.zarikBalance || 0), 0)));

  const rolesEl = document.getElementById('usr-bento-roles');
  if (rolesEl) {
    const students = count('student');
    const mentors = count('mentor');
    const admins = count('admin') + count('sub_admin') + count('channel_manager');
    const sum = students + mentors + admins || 1;
    const pct = n => (n / sum * 100).toFixed(1);
    rolesEl.innerHTML = `
      <div class="lst-bar">
        <span class="lst-bar-active" data-style="width:${pct(students)}%"></span>
        <span class="lst-bar-scheduled" data-style="width:${pct(mentors)}%"></span>
        <span class="lst-bar-locked" data-style="width:${pct(admins)}%"></span>
      </div>
      <div class="lst-legend">
        <div class="lst-legend-row"><span><span class="lst-dot lst-dot-active"></span>نوجوانان</span><strong>${crvFa(students)}</strong></div>
        <div class="lst-legend-row"><span><span class="lst-dot lst-dot-scheduled"></span>راهبران</span><strong>${crvFa(mentors)}</strong></div>
        <div class="lst-legend-row"><span><span class="lst-dot lst-dot-locked"></span>مدیران پنل</span><strong>${crvFa(admins)}</strong></div>
      </div>`;
  }

  const weekEl = document.getElementById('usr-bento-week');
  if (weekEl) {
    const row = (icon, label, value, cls = '') => `<div class="lst-legend-row"><span><i class="fa-solid ${icon} ${cls}"></i> ${label}</span><strong>${value}</strong></div>`;
    weekEl.innerHTML = st.roles
      ? `<div class="lst-legend">
          ${row('fa-user-plus', 'عضو تازه (۷ روز)', crvFa(st.newThisWeek), 'u-c-success-text')}
          ${row('fa-user-clock', 'ثبت‌نام ناقص', crvFa(st.incomplete), 'u-c-accent-text')}
          ${row('fa-ban', 'مسدود', crvFa(st.blocked), 'u-c-danger-text')}
        </div>`
      : '<div class="lst-empty">آمار هفتگی پس از بروزرسانی سرور نمایش داده می‌شود.</div>';
  }

  const topEl = document.getElementById('usr-bento-top');
  if (topEl) {
    const top = list.filter(u => (u.zarikBalance || 0) > 0).sort((a, b) => (b.zarikBalance || 0) - (a.zarikBalance || 0)).slice(0, 4);
    topEl.innerHTML = top.length
      ? `<ul class="lst-list">${top.map((u, i) => `
          <li class="lst-list-item lst-clickable" role="button" tabindex="0" data-click="openUserView" data-click-args="${crvArgs(u.id)}">
            <span class="crv-rank">${crvFa(i + 1)}</span>
            ${crvAvatar(u.avatarUrl, u.name, 'lst-avatar')}
            <span class="lst-grow"><strong>${esc(u.name || '')}</strong></span>
            <span class="u-c-accent-text"><i class="fa-solid fa-coins"></i> ${crvFa(u.zarikBalance)}</span>
          </li>`).join('')}</ul>`
      : '<div class="lst-empty">در این صفحه کسی زریک ندارد.</div>';
  }

  const healthEl = document.getElementById('usr-bento-health');
  if (healthEl) {
    const issues = list.map(u => ({ u, problems: usrProblems(u) })).filter(x => x.problems.length);
    healthEl.innerHTML = issues.length
      ? `<ul class="lst-list">${issues.slice(0, 6).map(({ u, problems }) => `
          <li class="lst-list-item lst-clickable" role="button" tabindex="0" data-click="openUserView" data-click-args="${crvArgs(u.id)}">
            <i class="fa-solid fa-triangle-exclamation lst-warn"></i>
            <span class="lst-grow"><strong>${esc(u.name || '')}</strong>: ${esc(problems.join('، '))}</span>
          </li>`).join('')}</ul>`
      : '<div class="lst-empty"><i class="fa-solid fa-circle-check u-c-success-text"></i> همه همسفران این صفحه کامل و فعال‌اند.</div>';
  }
}

// ==================== LOADING SHIMMER ====================
window.usrSetLoading = function(on) {
  const overview = document.getElementById('usr-overview-view');
  if (!overview) return;
  overview.querySelectorAll('.lst-bento > .lst-tile').forEach(t => t.classList.toggle('is-loading', on));
  const grid = document.getElementById('usr-bento-list');
  if (grid) grid.setAttribute('aria-busy', on ? 'true' : 'false');
  if (!on || usrLoadedOnce) return; // a refresh keeps the old content under the shimmer
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
  ['usr-bento-roles', 'usr-bento-week', 'usr-bento-top', 'usr-bento-health'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = lines;
  });
};

// ==================== ONE PERSON'S PAGE ====================

window.openUserView = function(userId) {
  const overview = document.getElementById('usr-overview-view');
  window.usrActiveId = String(userId);
  crvFadeOut(overview, () => {
    window.loadUserPage();
    document.getElementById('users-tab')?.scrollIntoView({ block: 'start', behavior: NopaMotion.scrollBehavior() });
  });
};

window.closeUserView = function() {
  const view = document.getElementById('usr-detail-view');
  const overview = document.getElementById('usr-overview-view');
  window.usrActiveId = null;
  window.usrRenderedId = null;
  crvFadeOut(view, () => {
    if (window.usrActiveId) return; // another person was opened meanwhile
    if (view) view.style.display = 'none';
    if (overview) {
      overview.style.display = '';
      if (window.NopaFlip) window.NopaFlip.enter(overview.querySelectorAll(':scope > div:first-child, .lst-bento > .lst-tile'));
    }
  });
};

window.selectUserCircle = function(userId) {
  if (String(window.usrActiveId) === String(userId)) return;
  window.usrActiveId = String(userId);
  window.loadUserPage();
};

window.editActiveUser = function() { if (window.usrActiveId) window.openUserModal(window.usrActiveId); };
window.reportActiveUser = function() { if (window.usrActiveId) viewUserDetails(window.usrActiveId); };
window.passwordActiveUser = function() { if (window.usrActiveId) openPasswordOverride(window.usrActiveId); };
window.blockActiveUser = function() {
  const u = usrFind(window.usrActiveId);
  if (u) toggleBlockUser(u.id, !u.blocked);
};
window.deleteActiveUser = function() { if (window.usrActiveId) deleteUser(window.usrActiveId); };
window.openUserCaravanPage = function(caravanId) {
  window.usrGoTab('caravans-tab');
  if (typeof window.openCaravanView === 'function') window.openCaravanView(caravanId);
};
window.openUserLevelPage = function(level) {
  window.usrGoTab('levels-tab');
  if (typeof window.openLevelView === 'function') window.openLevelView(level);
};

function usrCircles(activeId) {
  return (window.usrList || []).map(u => {
    const active = String(u.id) === String(activeId);
    const state = u.blocked || usrSuspended(u) ? 'lsv-state-locked' : usrProblems(u).length ? 'lsv-state-scheduled' : 'lsv-state-active';
    return `
      <button type="button" class="lsv-circle${active ? ' is-active' : ''}" data-anim-key="uc:${esc(u.id)}" data-click="selectUserCircle" data-click-args="${crvArgs(u.id)}" title="${esc(u.name || '')}"${active ? ' aria-current="true"' : ''}>
        <span class="lsv-circle-main">
          <span class="lsv-circle-img">${nopaImgSrc(u.avatarUrl) ? `<img src="${esc(nopaImgSrc(u.avatarUrl))}" alt="" loading="lazy" data-error="lmsImageFallback" data-error-args='["$this", "${crvInitial(u.name)}"]'>` : `<span>${crvInitial(u.name)}</span>`}</span>
          <span class="lsv-circle-badge ${state}"><i class="fa-solid ${usrRole(u).icon}"></i></span>
        </span>
        <span class="lsv-circle-name"><span>${esc(u.name || '')}</span></span>
      </button>`;
  }).join('') + `
      <button type="button" class="lsv-circle lsv-circle-add" data-anim-key="uc-add" data-click="openUserModal" title="همسفر جدید" aria-label="همسفر جدید">
        <span class="lsv-circle-main">
          <span class="lsv-circle-img"><i class="fa-solid fa-plus"></i></span>
          <span class="lsv-circle-badge lsv-state-add"><i class="fa-solid fa-plus"></i></span>
        </span>
        <span class="lsv-circle-name"><span>همسفر جدید</span></span>
      </button>`;
}

function usrInfoCard(u, a) {
  const full = a?.user || {};
  const gender = (full.gender || u.gender) === 'male' ? 'پسر' : (full.gender || u.gender) === 'female' ? 'دختر' : '';
  const city = full.city || u.city;
  const dob = full.dateOfBirth || u.dateOfBirth;
  const nid = full.nationalId || u.nationalId;
  const facts = [
    usrCode(u) ? `<span><i class="fa-solid fa-hashtag"></i> <bdi dir="ltr">${esc(usrCode(u))}</bdi></span>` : '',
    `<span><i class="fa-solid ${usrRole(u).icon}"></i> ${esc(usrRole(u).label)}${u.role === 'mentor' ? ` · ${esc(USR_MENTOR_LEVELS[u.mentorLevel] || USR_MENTOR_LEVELS[1])}` : ''}</span>`,
    u.role === 'student' ? `<span><i class="fa-solid fa-compass"></i> ${usrHasCaravan(u) ? esc(u.caravanName) : 'بدون کاروان'}</span>` : '',
    gender ? `<span><i class="fa-solid fa-venus-mars"></i> ${gender}</span>` : '',
    city ? `<span><i class="fa-solid fa-location-dot"></i> ${esc(city)}</span>` : '',
    dob ? `<span><i class="fa-solid fa-cake-candles"></i> ${esc(dob)}</span>` : '',
    nid ? `<span><i class="fa-solid fa-id-card"></i> ${esc(nid)}</span>` : '',
    u.createdAt ? `<span><i class="fa-solid fa-calendar-plus"></i> عضو از ${esc(usrDate(u.createdAt))}</span>` : '',
    u.registrationCompleted === false ? '<span class="u-c-danger-text"><i class="fa-solid fa-user-clock"></i> ثبت‌نام ناقص</span>' : '',
  ].filter(Boolean).join('');
  const tickets = a ? (a.tickets || []).filter(t => String(t.status || '').toLowerCase() !== 'resolved' && String(t.status || '').toLowerCase() !== 'closed').length : null;
  return `
    ${nopaPersonPhoto(u, 'usr', 'crv-mentor-photo')}
    <strong class="crv-mentor-name">${esc(u.name || 'بدون نام')}</strong>
    ${u.phoneNumber ? `<span class="crv-mentor-phone" dir="ltr">${esc(u.phoneNumber)}</span>` : ''}
    <div class="mnt-mini">
      <span><strong>${crvFa(u.zarikBalance)}</strong><small>زریک</small></span>
      <span><strong>${crvFa(u.levelFrame || 1)}</strong><small>سطح</small></span>
      <span class="${tickets ? 'is-warn' : ''}"><strong>${tickets === null ? '…' : crvFa(tickets)}</strong><small>تیکت باز</small></span>
    </div>
    <div class="lsv-facts crv-mentor-facts">${facts}</div>
    ${window.nopaPresenceSlot(u.id)}
    <div class="mnt-info-actions">
      <button type="button" class="lsv-pill" data-click="openUserModal" data-click-args="${crvArgs(u.id)}"><i class="fa-solid fa-pen"></i> ویرایش</button>
      <button type="button" class="lse-btn" data-click="openPersonSitePhoto" data-click-args="${crvArgs(u.id, 'usr')}"><i class="fa-solid fa-image"></i> عکس سایت</button>
      <button type="button" class="lse-btn" data-click="viewUserDetails" data-click-args="${crvArgs(u.id)}"><i class="fa-solid fa-chart-line"></i> گزارش کامل</button>
      ${usrHasCaravan(u) ? `<button type="button" class="lse-btn" data-click="openUserCaravanPage" data-click-args="${crvArgs(u.caravanId)}"><i class="fa-solid fa-compass"></i> کاروان</button>` : ''}
    </div>`;
}

// Balances and the path through the stations: tiles, the path ones shimmer until the analytics arrive
function usrAssets(u, a) {
  const bal = a?.balances || {};
  const sum = a?.stationsProgress?.summary || {};
  const name = k => (typeof window.assetName === 'function' ? window.assetName(k) : ({ nakh: 'کلاف', derafsh: 'درفش', farsh: 'قالیچه' })[k]);
  const pair = (done, all) => (a ? `${crvFa(done || 0)} از ${crvFa(all || 0)}` : '…');
  const tile = (cls, icon, label, value) => `
    <div class="crv-asset ${cls}" data-anim-key="ua:${esc(label)}">
      <span class="crv-asset-icon"><i class="fa-solid ${icon}"></i></span>
      <span class="crv-asset-text"><small>${esc(label)}</small><strong>${value}</strong></span>
    </div>`;
  return [
    tile('is-accent', 'fa-coins', 'زریک', crvFa(a ? bal.zarik : u.zarikBalance)),
    tile('is-progress', 'fa-layer-group', name('nakh'), a ? crvFa(bal.nakh) : '…'),
    tile('is-progress', 'fa-flag', name('derafsh'), a ? crvFa(bal.beyragh) : '…'),
    tile('is-progress', 'fa-rug', name('farsh'), a ? crvFa(bal.farsh) : '…'),
    `<button type="button" class="crv-asset is-info usr-asset-link" data-anim-key="ua:level" data-click="openUserLevelPage" data-click-args="${crvArgs(u.levelFrame || 1)}" title="صفحه این سطح">
      <span class="crv-asset-icon"><i class="fa-solid fa-layer-group"></i></span>
      <span class="crv-asset-text"><small>سطح در مسیر</small><strong>${esc(usrLevelName(u.levelFrame))}</strong></span>
    </button>`,
    tile('is-progress', 'fa-map-location-dot', 'منزلگاه‌ها', pair(sum.passedStations, sum.totalStations)),
    tile('is-progress', 'fa-chalkboard-user', 'کلاس‌ها', pair(sum.passedClasses, sum.totalClasses)),
    tile('is-progress', 'fa-spell-check', 'آزمون‌ها', pair(sum.passedQuizzes, sum.totalQuizzes)),
    tile('is-progress', 'fa-trophy', 'چالش‌ها', pair(sum.passedChallenges, sum.totalChallenges)),
  ].join('');
}

const USR_SUB_STATUS = {
  approved: ['is-ok', 'تایید شده'],
  pending: ['is-warn', 'در انتظار ارزیابی'],
  rejected: ['is-warn', 'نیازمند اصلاح'],
};

// Activity: caravans they lead, challenge answers, tickets and certificates, newest first
function usrActivityRows(u, a) {
  const rows = [];
  (a.mentoredCaravans || []).forEach(c => rows.push({
    key: `c:${c.id}`, at: c.createdAt, html: `
      <div class="lsv-row crv-member" data-anim-key="uy:c:${esc(c.id)}">
        ${crvAvatar(c.coverImageUrl, c.name, 'lsv-row-avatar lsv-row-num')}
        <span class="lsv-row-text"><strong>${esc(c.name)}</strong><span>کاروان تحت راهبری</span></span>
        <span class="lsv-round-group crv-member-tools">
          <button type="button" class="lsv-round lsv-round-sm" data-click="openUserCaravanPage" data-click-args="${crvArgs(c.id)}" title="صفحه کاروان" aria-label="صفحه کاروان"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>
        </span>
      </div>`,
  }));
  (a.challenges || []).forEach(s => {
    const [cls, label] = USR_SUB_STATUS[s.status] || ['', s.status || '-'];
    rows.push({
      key: `s:${s.id}`, at: s.submittedAt, html: `
        <div class="lsv-row crv-member" data-anim-key="uy:s:${esc(s.id)}">
          <span class="lsv-row-avatar lsv-row-num usr-act-icon is-pink"><i class="fa-solid fa-trophy"></i></span>
          <span class="lsv-row-text"><strong>${esc(s.challenge?.title || 'چالش')}</strong><span>پاسخ چالش · ${esc(usrDate(s.submittedAt))}</span></span>
          <span class="lsv-status ${cls}">${esc(label)}</span>
        </div>`,
    });
  });
  (a.tickets || []).forEach(t => {
    const open = !['resolved', 'closed'].includes(String(t.status || '').toLowerCase());
    rows.push({
      key: `t:${t.id}`, at: t.createdAt, html: `
        <div class="lsv-row crv-member" data-anim-key="uy:t:${esc(t.id)}">
          <span class="lsv-row-avatar lsv-row-num usr-act-icon is-info"><i class="fa-solid fa-headset"></i></span>
          <span class="lsv-row-text"><strong>${esc(t.subject || 'تیکت')}</strong><span>تیکت پشتیبانی · ${crvFa((t.replies || []).length)} پاسخ${t.createdAt ? ` · ${esc(usrDate(t.createdAt))}` : ''}</span></span>
          <span class="lsv-status ${open ? 'is-warn' : 'is-ok'}">${open ? 'باز' : 'بسته'}</span>
        </div>`,
    });
  });
  (a.certificates || []).forEach(c => rows.push({
    key: `g:${c.id}`, at: c.issuedAt, html: `
      <div class="lsv-row crv-member" data-anim-key="uy:g:${esc(c.id)}">
        <span class="lsv-row-avatar lsv-row-num usr-act-icon is-success"><i class="fa-solid fa-certificate"></i></span>
        <span class="lsv-row-text"><strong>${esc(c.title)}</strong><span>گواهینامه · ${esc(usrDate(c.issuedAt))}${c.verifyId ? ` · <bdi dir="ltr">${esc(c.verifyId)}</bdi>` : ''}</span></span>
      </div>`,
  }));
  return rows.sort((x, y) => new Date(y.at || 0) - new Date(x.at || 0));
}

// Draws the person's page; a = their analytics, or null while it loads
function usrPaint(u, a) {
  const set = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };
  set('usr-title', el => { el.textContent = u.name || 'همسفر'; });
  set('usr-state', el => { el.innerHTML = usrStatusChip(u); });
  set('usr-sub', el => {
    el.textContent = [usrCode(u), usrRole(u).label, u.role === 'student' ? (usrHasCaravan(u) ? u.caravanName : 'بدون کاروان') : ''].filter(Boolean).join(' · ');
  });
  set('usr-circles', el => { el.innerHTML = usrCircles(u.id); });
  set('usr-block-btn', el => {
    const t = u.blocked ? 'رفع مسدودیت' : 'مسدود کردن';
    el.title = t; el.setAttribute('aria-label', t);
    el.innerHTML = `<i class="fa-solid ${u.blocked ? 'fa-unlock' : 'fa-ban'}"></i>`;
  });
  set('usr-info-card', el => { el.innerHTML = usrInfoCard(u, a); });
  window.nopaFillPresence(u.id, a);
  NopaPhoto.remount();
  nopaPersonChart(document.getElementById('usr-activity-chart'), 'usr', u.id);
  set('usr-assets-card', el => { el.classList.toggle('is-loading', !a); el.innerHTML = usrAssets(u, a); });

  const rows = a ? usrActivityRows(u, a) : null;
  set('usr-activity-count', el => { el.textContent = rows === null ? '…' : crvFa(rows.length); });
  set('usr-activity-card', el => { el.classList.toggle('is-loading', !a); });
  set('usr-activity-list', el => {
    if (!a) {
      el.innerHTML = Array.from({ length: 4 }, () => `
        <div class="lsv-row crv-member" aria-hidden="true"><span class="lsv-row-avatar lst-skel-avatar"></span>
          <span class="lsv-row-text"><span class="lst-skel-line"></span><span class="lst-skel-line lst-skel-short"></span></span></div>`).join('');
      return;
    }
    el.innerHTML = rows.length ? rows.slice(0, 30).map(r => r.html).join('')
      : '<div class="lsv-col-empty">هنوز فعالیتی (چالش، تیکت یا گواهینامه) ثبت نشده است.</div>';
  });
}

window.loadUserPage = async function() {
  const view = document.getElementById('usr-detail-view');
  const overview = document.getElementById('usr-overview-view');
  const id = window.usrActiveId;
  const u = id && usrFind(id);
  if (!view || !u) return;

  const cached = usrAnalyticsCache.get(id) || null;
  const wasOpen = view.style.display !== 'none';
  const same = wasOpen && window.usrRenderedId === id;
  window.usrRenderedId = id;
  if (overview) overview.style.display = 'none';
  view.style.display = 'block';
  if (same && window.NopaFlip) window.NopaFlip.render(view, () => usrPaint(u, cached));
  else {
    usrPaint(u, cached);
    if (window.NopaFlip) {
      // switching people keeps the header and circles still; opening animates everything in
      window.NopaFlip.enter(view.querySelectorAll(wasOpen ? '.usr-flow > .lsv-col, .usr-flow > .lsv-link'
        : '.lsv-head, .lsv-board, .lsv-notch .lsv-circle, .usr-flow > .lsv-col'));
      const picked = wasOpen && view.querySelector('.lsv-circle.is-active .lsv-circle-img');
      if (picked && typeof picked.animate === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        picked.animate([{ transform: 'scale(0.8)' }, { transform: 'scale(1.12)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
      }
    }
  }
  mntFitNotch(view);
  if (cached) return;

  let a = null;
  try {
    const res = await request(`/api/v1/admin/users/${encodeURIComponent(id)}/analytics`);
    if (res.ok) a = await res.json();
  } catch (_) {}
  if (window.usrActiveId !== id) return; // the user moved on while this loaded
  if (!a) {
    ['usr-assets-card', 'usr-activity-card'].forEach(k => document.getElementById(k)?.classList.remove('is-loading'));
    const list = document.getElementById('usr-activity-list');
    if (list) list.innerHTML = '<div class="lsv-col-empty"><i class="fa-solid fa-triangle-exclamation lst-warn"></i> خطا در دریافت فعالیت‌های این همسفر</div>';
    return;
  }
  usrAnalyticsCache.set(id, a);
  const fresh = usrFind(id) || u;
  if (window.NopaFlip) window.NopaFlip.render(view, () => usrPaint(fresh, a)); else usrPaint(fresh, a);
};

// The tab starts in its loading state until the first fetch finishes
window.usrSetLoading(true);
