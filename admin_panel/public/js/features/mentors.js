// Mentors: list, dossier, mentor modal, moderation, document verification queue.
// Split out of the former app.js (Phase 7). Classic script: shares globals with the other modules;
// load order is set in index.html.

// ===============================
// MODULE A: MENTORS OPERATIONS & DOSSIER
// ===============================

window.mentorsMasterList = [];

window.calculateMentorStars = function(ratings, evals) {
  let sum = 0, count = 0;
  if (Array.isArray(ratings)) {
    ratings.forEach(r => {
      const v = Number(r.ratingValue) || Number(r.rating) || 0;
      if (v > 0) { sum += v; count++; }
    });
  }
  if (Array.isArray(evals)) {
    evals.forEach(e => {
      const v = Number(e.rating) || Number(e.responsivenessScore) || 0;
      if (v > 0) { sum += v; count++; }
    });
  }
  if (count === 0) {
    return { score: null, count: 0, text: 'فاقد ارزیابی (۰ نظر)', avgNumeric: 0 };
  }
  const avg = (sum / count).toFixed(1);
  return { score: avg, count: count, text: `${avg} (${count} نظر)`, avgNumeric: parseFloat(avg) };
};

// Like the stations / caravans tabs: a bento overview of all mentors (#mnt-overview-view) and one mentor's page
// (#mentor-detail-view): the mentor's caravans as circles in the notch, the mentor's card linked to the caravans'
// card and to the chosen caravan's students. Styles: css/stations.css (.lst-*, .lsv-*, .crv-*, .mnt-*).
// Shared helpers (crvAvatar, crvFa, crvArgs, crvFadeOut) come from caravans.js, loaded before this file.
window.mntActiveMentorId = null;
window.mntActiveCaravanId = null;
window.mntRenderedMentorId = null;
const mntDossierCache = new Map();

const MNT_STATUS = {
  ACTIVE: ['فعال', 'lst-chip-active', 'fa-circle-check'],
  PENDING_VERIFICATION: ['در انتظار بررسی', 'lst-chip-scheduled', 'fa-hourglass-half'],
  SUSPENDED: ['مسدود / تعلیق', 'lst-chip-locked', 'fa-ban'],
  RESTRICTED: ['محدود شده', 'lst-chip-locked', 'fa-lock'],
};
const MNT_LEVELS = { 1: 'راهبر مقدماتی', 2: 'راهبر پیشرفته', 3: 'راهبر ارشد' };

function mntCaravansOf(m) { return (m && m.mentoredCaravans) || []; }
function mntCaravanMembers(c) { return Number(c?._count?.members ?? c?.memberCount ?? 0) || 0; }
function mntStudentsOf(m) { return mntCaravansOf(m).reduce((n, c) => n + mntCaravanMembers(c), 0); }
function mntStars(m) { return window.calculateMentorStars(m?.ratingsReceived, m?.evaluationsReceived); }
function mntStatusKey(m) {
  if (m?.isDeleted || m?.blocked) return 'SUSPENDED';
  return MNT_STATUS[m?.accountStatus] ? m.accountStatus : 'ACTIVE';
}
function mntStatusChip(m) {
  const [label, cls, icon] = MNT_STATUS[mntStatusKey(m)];
  return `<span class="lst-chip ${cls}"><i class="fa-solid ${icon}"></i> ${label}</span>`;
}
function mntPendingDocs(m) { return (m?.mentorDocuments || []).filter(d => (d.status || 'pending') === 'pending').length; }
// a national id is shown only when it is real (old seed data used 123456… placeholders)
function mntNationalId(v) {
  const s = String(v || '').trim();
  return s && s !== 'null' && !s.startsWith('۱۲۳۴۵۶') && !s.startsWith('123456') ? s : '';
}
function mntFind(id) { return (window.mentorsMasterList || []).find(m => String(m.id) === String(id)) || null; }

// Opens another tab of the panel (quick-access buttons)
window.mntGoTab = function(tabId) {
  if (window.NopaRouter) window.NopaRouter.switchTab(tabId, true);
};

window.loadMentors = async function() {
  window.mntSetLoading(true);
  try {
    const res = await request('/api/v1/admin/mentors');
    if (!res.ok) throw new Error('خطا در دریافت لیست راهبران');
    const mentors = await res.json();
    window.mentorsMasterList = Array.isArray(mentors) ? mentors : [];
    window.mntSetLoading(false);
    window.filterMentorsList();

    // The open mentor page follows the new data; a removed mentor sends it back to the overview
    if (window.mntActiveMentorId) {
      if (mntFind(window.mntActiveMentorId)) {
        mntDossierCache.delete(String(window.mntActiveMentorId));
        window.loadMentorPage();
      } else {
        window.closeMentorView();
      }
    }
  } catch (err) {
    console.error('Error loading mentors:', err);
    window.mntSetLoading(false);
    const grid = document.getElementById('mnt-bento-mentors');
    if (grid) grid.innerHTML = `<div class="lst-empty"><i class="fa-solid fa-triangle-exclamation lst-warn"></i> ${esc(err.message)}</div>`;
  }
};

// ==================== OVERVIEW (BENTO) ====================

window.filterMentorsList = function() {
  const overview = document.getElementById('mnt-overview-view');
  if (window.NopaFlip && overview) window.NopaFlip.render(overview, mntDrawBento); else mntDrawBento();
};

function mntFiltered() {
  const query = (document.getElementById('mentor-filter-search')?.value || '').trim().toLowerCase();
  const caravanFilter = document.getElementById('mentor-filter-caravan')?.value || 'all';
  const statusFilter = document.getElementById('mentor-filter-status')?.value || 'all';
  const sortFilter = document.getElementById('mentor-filter-sort')?.value || 'caravans_desc';

  let list = (window.mentorsMasterList || []).filter(m => {
    if (query) {
      const hay = [m.name, m.phoneNumber, m.nationalId, m.city, m.userCode, ...mntCaravansOf(m).map(c => c.name)]
        .map(v => String(v || '').toLowerCase()).join(' ');
      if (!hay.includes(query)) return false;
    }
    if (caravanFilter === 'has_caravan' && !mntCaravansOf(m).length) return false;
    if (caravanFilter === 'no_caravan' && mntCaravansOf(m).length) return false;
    if (statusFilter !== 'all' && mntStatusKey(m) !== statusFilter) return false;
    return true;
  });
  const by = {
    caravans_desc: (a, b) => mntCaravansOf(b).length - mntCaravansOf(a).length,
    students_desc: (a, b) => mntStudentsOf(b) - mntStudentsOf(a),
    rating_desc: (a, b) => mntStars(b).avgNumeric - mntStars(a).avgNumeric,
    name_asc: (a, b) => (a.name || '').localeCompare(b.name || '', 'fa'),
  };
  list.sort(by[sortFilter] || by.caravans_desc);
  return { list, filtering: !!query || caravanFilter !== 'all' || statusFilter !== 'all' };
}

function mntMentorCard(m) {
  const caravans = mntCaravansOf(m);
  const stars = mntStars(m);
  const faces = caravans.slice(0, 4).map(c => crvAvatar(c.coverImageUrl, c.name, 'crv-face')).join('');
  const more = caravans.length > 4 ? `<span class="crv-face crv-face-more">+${crvFa(caravans.length - 4)}</span>` : '';
  const docs = mntPendingDocs(m);
  return `
    <button type="button" class="crv-card mnt-card" data-anim-key="mn:${esc(m.id)}" data-click="openMentorView" data-click-args="${crvArgs(m.id)}" title="ورود به صفحه ${esc(m.name || 'راهبر')}">
      <span class="crv-card-top">
        ${crvAvatar(m.avatarUrl, m.name, 'crv-card-cover')}
        <span class="crv-card-name"><strong>${esc(m.name || 'راهبر بدون نام')}</strong>${mntStatusChip(m)}</span>
      </span>
      <span class="crv-card-mentor">
        <i class="fa-solid fa-medal"></i>
        <span>${esc(MNT_LEVELS[m.mentorLevel] || MNT_LEVELS[1])}${m.city ? ` · ${esc(m.city)}` : ''}</span>
      </span>
      <span class="crv-card-cap">
        <span>${caravans.length ? `${crvFa(caravans.length)} کاروان` : '<em class="u-c-danger-text">بدون کاروان</em>'}</span>
        <strong>${crvFa(mntStudentsOf(m))} دانش‌آموز</strong>
      </span>
      <span class="crv-card-foot">
        <span class="crv-faces">${faces}${more}</span>
        <span class="crv-card-nums">
          ${docs ? `<span class="u-c-danger-text" title="مدرک در انتظار بررسی"><i class="fa-solid fa-file-circle-exclamation"></i> ${crvFa(docs)}</span>` : ''}
          <span class="u-c-accent-text" title="امتیاز"><i class="fa-solid fa-star"></i> ${stars.score !== null ? crvFa(stars.score) : '-'}</span>
        </span>
      </span>
    </button>`;
}

function mntDrawBento() {
  const all = window.mentorsMasterList || [];
  const { list, filtering } = mntFiltered();

  const badge = document.getElementById('mentors-total-count-badge');
  if (badge) badge.textContent = filtering ? `نمایش ${crvFa(list.length)} از ${crvFa(all.length)} راهبر` : 'برای ورود به صفحه راهبر بزنید';

  // ---- all mentors: one card each, then a "new mentor" card ----
  const grid = document.getElementById('mnt-bento-mentors');
  if (grid) {
    const cards = list.map(mntMentorCard);
    if (!filtering) {
      cards.push(`
        <button type="button" class="crv-card crv-card-add" data-anim-key="mn-add" data-click="showMentorModal" title="ثبت راهبر جدید">
          <span class="lsv-round lsv-round-lg"><i class="fa-solid fa-plus"></i></span>
          <span>راهبر جدید</span>
        </button>`);
    } else if (!list.length) {
      cards.push('<div class="lst-empty" data-anim-key="mn-empty">راهبری با این مشخصات یافت نشد.</div>');
    }
    grid.innerHTML = cards.join('');
    grid.setAttribute('aria-busy', 'false');
  }

  // ---- stats ----
  const caravanCount = all.reduce((n, m) => n + mntCaravansOf(m).length, 0);
  const studentCount = all.reduce((n, m) => n + mntStudentsOf(m), 0);
  const rated = all.map(m => mntStars(m)).filter(s => s.score !== null);
  const avg = rated.length ? (rated.reduce((n, s) => n + s.avgNumeric, 0) / rated.length).toFixed(1) : null;
  const setStat = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setStat('mnt-stat-mentors', crvFa(all.length));
  setStat('mnt-stat-caravans', crvFa(caravanCount));
  setStat('mnt-stat-students', crvFa(studentCount));
  setStat('mnt-stat-rating', avg !== null ? `${crvFa(avg)} / ۵` : '-');

  // ---- account statuses ----
  const statusEl = document.getElementById('mnt-bento-status');
  if (statusEl) {
    const counts = { ACTIVE: 0, PENDING_VERIFICATION: 0, SUSPENDED: 0 };
    all.forEach(m => { const k = mntStatusKey(m); counts[k === 'RESTRICTED' ? 'SUSPENDED' : k]++; });
    const total = all.length || 1;
    const pct = k => (counts[k] / total * 100).toFixed(1);
    statusEl.innerHTML = `
      <div class="lst-bar">
        <span class="lst-bar-active" data-style="width:${pct('ACTIVE')}%"></span>
        <span class="lst-bar-scheduled" data-style="width:${pct('PENDING_VERIFICATION')}%"></span>
        <span class="lst-bar-locked" data-style="width:${pct('SUSPENDED')}%"></span>
      </div>
      <div class="lst-legend">
        <div class="lst-legend-row"><span><span class="lst-dot lst-dot-active"></span>فعال</span><strong>${crvFa(counts.ACTIVE)}</strong></div>
        <div class="lst-legend-row"><span><span class="lst-dot lst-dot-scheduled"></span>در انتظار بررسی</span><strong>${crvFa(counts.PENDING_VERIFICATION)}</strong></div>
        <div class="lst-legend-row"><span><span class="lst-dot lst-dot-locked"></span>مسدود / محدود</span><strong>${crvFa(counts.SUSPENDED)}</strong></div>
      </div>`;
  }

  const rankList = (rows, value) => rows.length
    ? `<ul class="lst-list">${rows.map((m, i) => `
        <li class="lst-list-item lst-clickable" role="button" tabindex="0" data-click="openMentorView" data-click-args="${crvArgs(m.id)}">
          <span class="crv-rank">${crvFa(i + 1)}</span>
          ${crvAvatar(m.avatarUrl, m.name, 'lst-avatar')}
          <span class="lst-grow"><strong>${esc(m.name || '')}</strong></span>
          ${value(m)}
        </li>`).join('')}</ul>`
    : '';

  // ---- best rated ----
  const topEl = document.getElementById('mnt-bento-top');
  if (topEl) {
    const top = all.filter(m => mntStars(m).score !== null).sort((a, b) => mntStars(b).avgNumeric - mntStars(a).avgNumeric).slice(0, 4);
    topEl.innerHTML = rankList(top, m => `<span class="u-c-accent-text"><i class="fa-solid fa-star"></i> ${crvFa(mntStars(m).score)}</span>`)
      || '<div class="lst-empty">هنوز ارزیابی‌ای برای راهبران ثبت نشده است.</div>';
  }

  // ---- most students ----
  const crowdEl = document.getElementById('mnt-bento-crowd');
  if (crowdEl) {
    const crowd = all.filter(m => mntStudentsOf(m) > 0).sort((a, b) => mntStudentsOf(b) - mntStudentsOf(a)).slice(0, 4);
    crowdEl.innerHTML = rankList(crowd, m => `<span>${crvFa(mntCaravansOf(m).length)} کاروان · ${crvFa(mntStudentsOf(m))} نفر</span>`)
      || '<div class="lst-empty">هنوز دانش‌آموزی در کاروان‌های راهبران نیست.</div>';
  }

  // ---- what needs attention ----
  const healthEl = document.getElementById('mnt-bento-health');
  if (healthEl) {
    const issues = [];
    all.forEach(m => {
      const problems = [];
      if (!mntCaravansOf(m).length) problems.push('بدون کاروان');
      if (mntStatusKey(m) === 'PENDING_VERIFICATION') problems.push('در انتظار بررسی حساب');
      if (mntStatusKey(m) === 'SUSPENDED') problems.push('حساب مسدود');
      const docs = mntPendingDocs(m);
      if (docs) problems.push(`${crvFa(docs)} مدرک در انتظار بررسی`);
      if (!m.phoneNumber) problems.push('بدون شماره همراه');
      if (problems.length) issues.push({ m, problems });
    });
    healthEl.innerHTML = issues.length
      ? `<ul class="lst-list">${issues.slice(0, 6).map(({ m, problems }) => `
          <li class="lst-list-item lst-clickable" role="button" tabindex="0" data-click="openMentorView" data-click-args="${crvArgs(m.id)}">
            <i class="fa-solid fa-triangle-exclamation lst-warn"></i>
            <span class="lst-grow"><strong>${esc(m.name || '')}</strong>: ${esc(problems.join('، '))}</span>
          </li>`).join('')}</ul>`
      : '<div class="lst-empty"><i class="fa-solid fa-circle-check u-c-success-text"></i> همه راهبران فعال‌اند و کاروان دارند.</div>';
  }
}

// ==================== LOADING SHIMMER ====================
// The caravans tab's: a light band sweeps over each tile until the mentors arrive; the first load shows skeletons
window.mntSetLoading = function(on) {
  const overview = document.getElementById('mnt-overview-view');
  if (!overview) return;
  overview.querySelectorAll('.lst-bento > .lst-tile').forEach(t => t.classList.toggle('is-loading', on));
  const grid = document.getElementById('mnt-bento-mentors');
  if (grid) grid.setAttribute('aria-busy', on ? 'true' : 'false');
  if (!on || (window.mentorsMasterList || []).length) return;

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
  ['mnt-bento-status', 'mnt-bento-top', 'mnt-bento-crowd', 'mnt-bento-health'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = lines;
  });
};

// ==================== MENTOR PAGE ====================
// Opening draws at once from the list (card, caravans); the students column shimmers until the mentor's dossier
// arrives (kept for next time). The circles are the mentor's caravans: picking one shows its students.

window.openMentorView = function(mentorId) {
  const overview = document.getElementById('mnt-overview-view');
  window.mntActiveMentorId = String(mentorId);
  window.mntActiveCaravanId = null;
  crvFadeOut(overview, () => {
    window.loadMentorPage();
    document.getElementById('mentors-profile-tab')?.scrollIntoView({ block: 'start', behavior: NopaMotion.scrollBehavior() });
  });
};

window.closeMentorView = function() {
  const view = document.getElementById('mentor-detail-view');
  const overview = document.getElementById('mnt-overview-view');
  window.mntActiveMentorId = null;
  window.mntRenderedMentorId = null;
  crvFadeOut(view, () => {
    if (window.mntActiveMentorId) return; // another mentor was opened meanwhile
    if (view) view.style.display = 'none';
    if (overview) {
      overview.style.display = '';
      if (window.NopaFlip) window.NopaFlip.enter(overview.querySelectorAll(':scope > div:first-child, .lst-bento > .lst-tile'));
    }
  });
};

window.selectMentorCaravan = function(caravanId) {
  if (String(window.mntActiveCaravanId) === String(caravanId)) return;
  window.mntActiveCaravanId = String(caravanId);
  const view = document.getElementById('mentor-detail-view');
  const m = mntFind(window.mntActiveMentorId);
  if (!m || !view) return;
  const filter = document.getElementById('mnt-students-filter');
  if (filter) filter.value = '';
  const paint = () => mntPaint(m, mntDossierCache.get(String(m.id)) || null);
  if (window.NopaFlip) window.NopaFlip.render(view, paint); else paint();
  const picked = view.querySelector('.lsv-circle.is-active .lsv-circle-img');
  if (picked && typeof picked.animate === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    picked.animate([{ transform: 'scale(0.8)' }, { transform: 'scale(1.12)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
  }
  mntFitNotch(view);
};

window.editActiveMentor = function() {
  if (window.mntActiveMentorId) window.editMentor(window.mntActiveMentorId);
};
window.moderateActiveMentor = function() {
  if (window.mntActiveMentorId) window.openMentorModerationModal(window.mntActiveMentorId);
};
// "open caravan" on a caravan row: the caravan's own page in the caravans tab
window.openMentorCaravanPage = function(caravanId) {
  window.mntGoTab('caravans-tab');
  if (typeof window.openCaravanView === 'function') window.openCaravanView(caravanId);
};

function mntCircles(m, activeId) {
  return mntCaravansOf(m).map(c => {
    const active = String(c.id) === String(activeId);
    return `
      <button type="button" class="lsv-circle${active ? ' is-active' : ''}" data-anim-key="mc:${esc(c.id)}" data-click="selectMentorCaravan" data-click-args="${crvArgs(c.id)}" title="${esc(c.name)}"${active ? ' aria-current="true"' : ''}>
        <span class="lsv-circle-main">
          <span class="lsv-circle-img">${c.coverImageUrl ? `<img src="${esc(c.coverImageUrl)}" alt="" loading="lazy" data-error="lmsImageFallback" data-error-args='["$this", "${crvInitial(c.name)}"]'>` : `<span>${crvInitial(c.name)}</span>`}</span>
          <span class="lsv-circle-badge ${c.status === 'suspended' ? 'lsv-state-locked' : 'lsv-state-active'}">${crvFa(mntCaravanMembers(c))}</span>
        </span>
        <span class="lsv-circle-name"><span>${esc(c.name)}</span></span>
      </button>`;
  }).join('') + `
      <button type="button" class="lsv-circle lsv-circle-add" data-anim-key="mc-add" data-click="openAssignMentorCaravans" title="تخصیص کاروان به این راهبر" aria-label="تخصیص کاروان به این راهبر">
        <span class="lsv-circle-main">
          <span class="lsv-circle-img"><i class="fa-solid fa-plus"></i></span>
          <span class="lsv-circle-badge lsv-state-add"><i class="fa-solid fa-plus"></i></span>
        </span>
        <span class="lsv-circle-name"><span>تخصیص کاروان</span></span>
      </button>`;
}

function mntInfoCard(m, dossier) {
  const stars = mntStars(m);
  const natId = mntNationalId(m.nationalId);
  const facts = [
    m.userCode ? `<span><i class="fa-solid fa-hashtag"></i> NP-${esc(m.userCode)}</span>` : '',
    `<span><i class="fa-solid fa-medal"></i> ${esc(MNT_LEVELS[m.mentorLevel] || MNT_LEVELS[1])}</span>`,
    m.city ? `<span><i class="fa-solid fa-location-dot"></i> ${esc(m.city)}</span>` : '',
    m.academicDegree ? `<span><i class="fa-solid fa-graduation-cap"></i> ${esc(m.academicDegree)}</span>` : '',
    m.dateOfBirth ? `<span><i class="fa-solid fa-cake-candles"></i> ${esc(m.dateOfBirth)}</span>` : '',
    natId ? `<span><i class="fa-solid fa-id-card"></i> ${esc(natId)}</span>` : '',
    m.socialPlatform || m.socialMessengerHandle ? `<span><i class="fa-solid fa-comment-dots"></i> ${esc(m.socialPlatform || '')} <bdi dir="ltr">${esc(m.socialMessengerHandle || '')}</bdi></span>` : '',
    `<span><i class="fa-solid ${m.identityVerified ? 'fa-user-check' : 'fa-user-clock'}"></i> ${m.identityVerified ? 'هویت تایید شده' : 'هویت تایید نشده'}</span>`,
  ].filter(Boolean).join('');
  const students = dossier ? (dossier.supervisedStudents || []).length : mntStudentsOf(m);
  const openTickets = dossier ? (dossier.supervisedStudents || []).reduce((n, s) => n + (s.stats?.openTickets || 0), 0) : null;
  const docs = mntPendingDocs(m);
  return `
    ${nopaPersonPhoto(m, 'mnt', 'crv-mentor-photo')}
    <strong class="crv-mentor-name">${esc(m.name || 'راهبر بدون نام')}</strong>
    ${m.phoneNumber ? `<span class="crv-mentor-phone" dir="ltr">${esc(m.phoneNumber)}</span>` : ''}
    <span class="mnt-stars" title="${esc(stars.text)}">${[1, 2, 3, 4, 5].map(i => `<i class="fa-${stars.avgNumeric >= i - 0.25 ? 'solid' : 'regular'} fa-star"></i>`).join('')}<small>${stars.score !== null ? `${crvFa(stars.score)} · ${crvFa(stars.count)} نظر` : 'بدون ارزیابی'}</small></span>
    <div class="mnt-mini">
      <span><strong>${crvFa(mntCaravansOf(m).length)}</strong><small>کاروان</small></span>
      <span><strong>${crvFa(students)}</strong><small>دانش‌آموز</small></span>
      <span class="${openTickets ? 'is-warn' : ''}"><strong>${openTickets === null ? '…' : crvFa(openTickets)}</strong><small>تیکت باز</small></span>
    </div>
    <div class="lsv-facts crv-mentor-facts">${facts}</div>
    ${m.bio ? `<p class="crv-mentor-bio">${esc(m.bio)}</p>` : ''}
    ${window.nopaPresenceSlot(m.id)}
    <div class="mnt-info-actions">
      <button type="button" class="lsv-pill" data-click="editMentor" data-click-args="${crvArgs(m.id)}"><i class="fa-solid fa-pen"></i> ویرایش</button>
      <button type="button" class="lse-btn" data-click="openPersonSitePhoto" data-click-args="${crvArgs(m.id, 'mnt')}"><i class="fa-solid fa-image"></i> عکس سایت</button>
      <button type="button" class="lse-btn" data-click="openMentorModerationModal" data-click-args="${crvArgs(m.id)}"><i class="fa-solid fa-user-shield"></i> وضعیت حساب</button>
      ${docs ? `<button type="button" class="lse-btn mnt-docs-btn" data-click="mntGoTab" data-click-args="${crvArgs('mentors-docs-tab')}"><i class="fa-solid fa-file-circle-exclamation"></i> ${crvFa(docs)} مدرک</button>` : ''}
    </div>`;
}

function mntCaravanRow(c, active) {
  const count = mntCaravanMembers(c);
  const cap = Number(c.capacityLimit || 25) || 25;
  const progress = Math.round(Number(c.overallProgress || 0));
  const fill = Math.min(100, Math.round(count / cap * 100));
  const btn = (icon, title, click, a, extra = '') =>
    `<button type="button" class="lsv-round lsv-round-sm${extra ? ' ' + extra : ''}" data-click="${click}" data-click-args="${a}" title="${title}" aria-label="${title}"><i class="${icon}"></i></button>`;
  return `
    <div class="lsv-row crv-member mnt-caravan${active ? ' is-active' : ''}" data-anim-key="mr:${esc(c.id)}">
      <button type="button" class="mnt-caravan-main" data-click="selectMentorCaravan" data-click-args="${crvArgs(c.id)}" title="نمایش دانش‌آموزان ${esc(c.name)}"${active ? ' aria-current="true"' : ''}>
        ${crvAvatar(c.coverImageUrl, c.name, 'lsv-row-avatar lsv-row-num')}
        <span class="lsv-row-text">
          <strong>${esc(c.name)}</strong>
          <span>${crvFa(count)} / ${crvFa(cap)} عضو · پیشرفت ${crvFa(progress)}٪${c.status === 'suspended' ? ' · تعلیق‌شده' : ''}</span>
          <span class="lst-bar"><span class="${fill >= 100 ? 'lst-bar-locked' : fill >= 80 ? 'lst-bar-scheduled' : 'lst-bar-active'}" data-style="width:${fill}%"></span></span>
        </span>
      </button>
      <span class="lsv-round-group crv-member-tools">
        ${btn('fa-solid fa-arrow-up-right-from-square', 'صفحه کاروان', 'openMentorCaravanPage', crvArgs(c.id))}
        ${btn('fa-solid fa-link-slash', 'برداشتن از این راهبر', 'unassignMentorCaravan', crvArgs(c.id, c.name), 'lsv-round-danger')}
      </span>
    </div>`;
}

function mntStudentRow(s, mentorId) {
  const st = s.stats || {};
  const btn = (icon, title, click, count, cls) =>
    `<button type="button" class="mnt-student-btn ${cls}" data-click="${click}" data-click-args="${crvArgs(mentorId, s.id)}" title="${title}"><i class="${icon}"></i> ${crvFa(count)}</button>`;
  return `
    <div class="lsv-row crv-member mnt-student" data-anim-key="ms:${esc(s.id)}">
      ${crvAvatar(s.avatarUrl, s.name, 'lsv-row-avatar lsv-row-num')}
      <span class="lsv-row-text">
        <strong>${esc(s.name || '-')}</strong>
        <span>${s.userCode ? `NP-${esc(s.userCode)}` : ''}${s.userCode && s.phoneNumber ? ' · ' : ''}${s.phoneNumber ? `<bdi dir="ltr">${esc(s.phoneNumber)}</bdi>` : ''}</span>
      </span>
      <span class="u-c-accent-text mnt-student-zarik" title="زریک"><i class="fa-solid fa-coins"></i> ${crvFa(s.zarikBalance)}</span>
      <span class="mnt-student-tools">
        ${btn('fa-solid fa-comments', 'تیکت‌ها و مکالمات', 'openStudentTicketsModal', st.totalTickets || 0, st.openTickets ? 'is-warn' : '')}
        ${btn('fa-solid fa-trophy', 'رفت و برگشت چالش‌ها', 'openStudentChallengesModal', st.totalSubmissions || 0, st.pendingSubmissions ? 'is-accent' : '')}
      </span>
    </div>`;
}

// Students column: the chosen caravan's students, searchable; skeleton rows until the dossier arrives
window.renderMentorStudents = function() {
  const list = document.getElementById('mnt-students-list');
  const card = document.getElementById('mnt-students-card');
  const m = mntFind(window.mntActiveMentorId);
  if (!list || !m) return;
  const dossier = mntDossierCache.get(String(m.id)) || null;
  const caravan = mntCaravansOf(m).find(c => String(c.id) === String(window.mntActiveCaravanId)) || null;
  const label = document.getElementById('mnt-students-label');
  if (label) label.textContent = caravan ? `دانش‌آموزان «${caravan.name}»` : 'دانش‌آموزان کاروان';
  if (card) card.classList.toggle('is-loading', !dossier && !!caravan);
  const count = document.getElementById('mnt-students-count');

  if (!caravan) {
    if (count) count.textContent = crvFa(0);
    list.innerHTML = '<div class="lsv-col-empty">برای دیدن دانش‌آموزان، ابتدا کاروانی به این راهبر تخصیص دهید.</div>';
    return;
  }
  if (!dossier) {
    if (count) count.textContent = crvFa(mntCaravanMembers(caravan));
    list.innerHTML = Array.from({ length: Math.min(5, Math.max(2, mntCaravanMembers(caravan))) }, () => `
      <div class="lsv-row crv-member" aria-hidden="true"><span class="lsv-row-avatar lst-skel-avatar"></span>
        <span class="lsv-row-text"><span class="lst-skel-line"></span><span class="lst-skel-line lst-skel-short"></span></span></div>`).join('');
    return;
  }
  const q = (document.getElementById('mnt-students-filter')?.value || '').trim().toLowerCase();
  const inCaravan = (dossier.supervisedStudents || []).filter(s => String(s.caravanId) === String(caravan.id));
  const shown = inCaravan.filter(s => !q || [s.name, s.phoneNumber, s.userCode].some(v => String(v || '').toLowerCase().includes(q)));
  if (count) count.textContent = crvFa(inCaravan.length);
  list.innerHTML = shown.length
    ? shown.map(s => mntStudentRow(s, m.id)).join('')
    : `<div class="lsv-col-empty">${inCaravan.length ? 'دانش‌آموزی با این جستجو یافت نشد.' : 'این کاروان هنوز دانش‌آموزی ندارد.'}</div>`;
};

// Draws the mentor page; dossier = the mentor's dossier (students, tickets) or null while it loads
function mntPaint(m, dossier) {
  const caravans = mntCaravansOf(m);
  if (!caravans.some(c => String(c.id) === String(window.mntActiveCaravanId))) {
    window.mntActiveCaravanId = caravans.length ? String(caravans[0].id) : null;
  }
  const activeId = window.mntActiveCaravanId;
  const set = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };

  set('mnt-title', el => { el.textContent = m.name || 'راهبر'; });
  set('mnt-state', el => { el.innerHTML = mntStatusChip(m); });
  set('mnt-sub', el => { el.textContent = `${crvFa(caravans.length)} کاروان · ${crvFa(mntStudentsOf(m))} دانش‌آموز`; });
  set('mnt-circles', el => { el.innerHTML = mntCircles(m, activeId); });
  set('mnt-info-card', el => { el.innerHTML = mntInfoCard(m, dossier); });
  window.nopaFillPresence(m.id);
  NopaPhoto.remount();
  nopaPersonChart(document.getElementById('mnt-activity-chart'), 'mnt', m.id);
  set('mnt-caravans-count', el => { el.textContent = crvFa(caravans.length); });
  set('mnt-caravans-list', el => {
    const addRow = `
      <button type="button" class="lsv-row lsv-row-add crv-member" data-anim-key="mr-add" data-click="openAssignMentorCaravans">
        <span class="lsv-row-avatar lsv-row-plus"><i class="fa-solid fa-plus"></i></span>
        <span class="lsv-row-text"><strong>تخصیص کاروان</strong><span>کاروان‌هایی که «${esc(m.name || '')}» راهبرشان است</span></span>
      </button>`;
    el.innerHTML = (caravans.length ? caravans.map(c => mntCaravanRow(c, String(c.id) === String(activeId))).join('') : '<div class="lsv-col-empty">این راهبر هنوز کاروانی ندارد.</div>') + addRow;
  });
  window.renderMentorStudents();
}

window.loadMentorPage = async function() {
  const view = document.getElementById('mentor-detail-view');
  const overview = document.getElementById('mnt-overview-view');
  const mId = window.mntActiveMentorId;
  const m = mId && mntFind(mId);
  if (!view || !m) return;

  const cached = mntDossierCache.get(mId) || null;
  const wasOpen = view.style.display !== 'none';
  const same = wasOpen && window.mntRenderedMentorId === mId;
  window.mntRenderedMentorId = mId;
  if (overview) overview.style.display = 'none';
  view.style.display = 'block';
  window.currentMentorId = mId;
  window.currentDossierData = cached;
  if (same && window.NopaFlip) window.NopaFlip.render(view, () => mntPaint(m, cached));
  else {
    mntPaint(m, cached);
    if (window.NopaFlip) window.NopaFlip.enter(view.querySelectorAll('.lsv-head, .lsv-board, .lsv-notch .lsv-circle, .mnt-flow > .lsv-col'));
  }
  mntFitNotch(view);
  if (cached) return;

  // The dossier (supervised students with their tickets and submissions), drawn when this mentor is still open
  let dossier = null;
  try {
    const res = await request(`/api/v1/admin/mentors/${encodeURIComponent(mId)}/dossier`);
    if (res.ok) dossier = await res.json();
  } catch (_) {}
  if (window.mntActiveMentorId !== mId) return;
  if (!dossier) {
    document.getElementById('mnt-students-card')?.classList.remove('is-loading');
    const list = document.getElementById('mnt-students-list');
    if (list) list.innerHTML = '<div class="lsv-col-empty"><i class="fa-solid fa-triangle-exclamation lst-warn"></i> خطا در دریافت دانش‌آموزان این راهبر</div>';
    return;
  }
  mntDossierCache.set(mId, dossier);
  window.currentDossierData = dossier;
  if (window.NopaFlip) window.NopaFlip.render(view, () => mntPaint(m, dossier)); else mntPaint(m, dossier);
};

function mntFitNotch(view) {
  if (typeof lmsFitBoardNotch === 'function') lmsFitBoardNotch(view);
  const notch = view.querySelector('.lsv-notch');
  const activeEl = notch && notch.querySelector('.lsv-circle.is-active');
  if (activeEl && notch.scrollWidth > notch.clientWidth) {
    const nr = notch.getBoundingClientRect();
    const ar = activeEl.getBoundingClientRect();
    notch.scrollLeft += (ar.left + ar.width / 2) - (nr.left + nr.width / 2);
  }
}

// ==================== CARAVANS OF A MENTOR ====================
// One dialog ticks the caravans this mentor leads; each changed caravan gets its mentor set (or cleared) through
// PATCH /admin/caravans/:id, the same call the caravan page's "change mentor" uses.
let mntAssignCaravans = [];
let mntAssignPicked = new Set();

window.openAssignMentorCaravans = async function() {
  const m = mntFind(window.mntActiveMentorId);
  if (!m) return;
  const modal = document.getElementById('mentor-caravans-modal');
  const title = document.getElementById('mnt-assign-title');
  if (title) title.textContent = `کاروان‌های «${m.name || 'راهبر'}»`;
  const search = document.getElementById('mnt-assign-search');
  if (search) search.value = '';
  mntAssignPicked = new Set(mntCaravansOf(m).map(c => String(c.id)));
  const list = document.getElementById('mnt-assign-list');
  if (list) list.innerHTML = '<div class="lst-skel-lines" aria-hidden="true">' + '<span class="lst-skel-row"></span>'.repeat(5) + '</div>';
  if (modal) { modal.style.display = 'flex'; modal.style.zIndex = 'var(--z-modal)'; }
  try {
    const res = await request('/api/v1/admin/caravans');
    const data = res.ok ? await res.json() : [];
    mntAssignCaravans = Array.isArray(data) ? data : (data.caravans || data.data || []);
  } catch (e) {
    mntAssignCaravans = [];
  }
  window.renderAssignMentorCaravans();
};

window.renderAssignMentorCaravans = function() {
  const list = document.getElementById('mnt-assign-list');
  const note = document.getElementById('mnt-assign-note');
  const mId = String(window.mntActiveMentorId || '');
  if (!list) return;
  const q = (document.getElementById('mnt-assign-search')?.value || '').trim().toLowerCase();
  const rows = mntAssignCaravans.filter(c => !q || [c.name, c.mentor?.name].some(v => String(v || '').toLowerCase().includes(q)));
  list.innerHTML = rows.length ? rows.map(c => {
    const owner = c.mentor && String(c.mentor.id || c.mentorId) !== mId ? c.mentor.name : '';
    const checked = mntAssignPicked.has(String(c.id));
    return `
      <label class="lse-tree-row crv-cand">
        <input type="checkbox" value="${esc(c.id)}" ${checked ? 'checked' : ''} data-change="toggleAssignMentorCaravan" data-change-args="${esc(JSON.stringify(['$this']))}">
        ${crvAvatar(c.coverImageUrl, c.name, 'lse-tree-num crv-result-avatar')}
        <span class="lse-tree-text"><strong>${esc(c.name || '')}</strong><small>${crvFa(crvMemberCount(c))} عضو</small></span>
        ${owner ? `<span class="lst-chip lst-chip-scheduled"><i class="fa-solid fa-user-tie"></i> ${esc(owner)}</span>` : (c.mentor ? '' : '<span class="lst-chip lst-chip-locked"><i class="fa-solid fa-user-slash"></i> بدون راهبر</span>')}
      </label>`;
  }).join('') : `<div class="lsv-col-empty">${mntAssignCaravans.length ? 'کاروانی با این نام یافت نشد.' : 'هنوز کاروانی ساخته نشده است.'}</div>`;
  if (note) note.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${crvFa(mntAssignPicked.size)} کاروان انتخاب شده`;
};

window.toggleAssignMentorCaravan = function(input) {
  if (input.checked) mntAssignPicked.add(String(input.value)); else mntAssignPicked.delete(String(input.value));
  const note = document.getElementById('mnt-assign-note');
  if (note) note.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${crvFa(mntAssignPicked.size)} کاروان انتخاب شده`;
};

async function mntSetCaravanMentor(caravanId, mentorId) {
  const res = await request(`/api/v1/admin/caravans/${encodeURIComponent(caravanId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mentorId })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'خطا در تغییر راهبر کاروان');
  }
}

window.saveAssignMentorCaravans = async function() {
  const m = mntFind(window.mntActiveMentorId);
  if (!m) return;
  const before = new Set(mntCaravansOf(m).map(c => String(c.id)));
  const add = [...mntAssignPicked].filter(id => !before.has(id));
  const remove = [...before].filter(id => !mntAssignPicked.has(id));
  if (!add.length && !remove.length) { NopaActions.hide('mentor-caravans-modal'); return; }
  const btn = document.getElementById('mnt-assign-save');
  if (btn) btn.disabled = true;
  try {
    for (const id of add) await mntSetCaravanMentor(id, m.id);
    for (const id of remove) await mntSetCaravanMentor(id, null);
    showToast('کاروان‌های راهبر ذخیره شد.', 'success');
    NopaActions.hide('mentor-caravans-modal');
    if (add.length) window.mntActiveCaravanId = add[0];
    await window.loadMentors();
    if (typeof window.loadCaravansTab === 'function' && (window.caravansData || []).length) window.loadCaravansTab();
  } catch (e) {
    showToast(e.message, 'error');
    await window.loadMentors();
  } finally {
    if (btn) btn.disabled = false;
  }
};

window.unassignMentorCaravan = async function(caravanId, caravanName) {
  const m = mntFind(window.mntActiveMentorId);
  if (!m) return;
  if (!(await NopaConfirm(`کاروان «${caravanName}» از راهبری «${m.name || ''}» برداشته شود؟ کاروان بدون راهبر می‌ماند.`))) return;
  try {
    await mntSetCaravanMentor(caravanId, null);
    showToast('کاروان از این راهبر برداشته شد.', 'success');
    await window.loadMentors();
    if (typeof window.loadCaravansTab === 'function' && (window.caravansData || []).length) window.loadCaravansTab();
  } catch (e) {
    showToast(e.message, 'error');
  }
};

// The tab starts in its loading state until the first fetch finishes
if (!(window.mentorsMasterList || []).length) window.mntSetLoading(true);

window.openStudentTicketsModal = function(mentorId, studentId) {
  const modal = document.getElementById('student-tickets-modal');
  const body = document.getElementById('student-tickets-content-body');
  if (!modal || !body) return;

  const student = window.currentDossierData?.supervisedStudents?.find(s => s.id === studentId);
  if (!student) {
    showToast('اطلاعات دانش‌آموز یافت نشد.', 'error');
    return;
  }

  const mentorName = window.currentDossierData?.identity?.name || 'راهبر آموزشی';
  document.getElementById('student-tickets-title').innerHTML = `<i class="fa-solid fa-headset u-c-accent-text"></i> تیکت‌ها و مکالمات: <span class="u-c-text">${esc(student.name)}</span> <span class="u-fs-xs u-c-text-muted u-fw-normal">(تحت سرپرستی: ${mentorName})</span>`;
  document.getElementById('student-tickets-subtitle').textContent = `کاروان: ${student.caravanName} | موبایل: ${student.phoneNumber || '-'} | کد دانش‌آموزی: ${student.userCode || '-'}`;

  const tickets = student.tickets || [];
  if (tickets.length === 0) {
    body.innerHTML = `
      <div class="u-text-center u-p-32-20 u-c-text-muted u-bg-shade-25 u-r-12 u-bd-1-dashed-fg-10">
        <i class="fa-solid fa-inbox fa-3x u-c-text-faint u-mb-12"></i>
        <div class="u-fs-base u-bold u-c-text-soft">هیچ تیکتی بین این دانش‌آموز و این راهبر رد و بدل نشده است</div>
        <div class="u-fs-xs u-mt-6 u-c-text-muted">تیکت‌های مطرح‌شده توسط دانش‌آموز در کاروان و پاسخ‌های ارسالی راهبر، به صورت خودکار در این تاریخچه ثبت می‌شوند.</div>
      </div>
    `;
  } else {
    body.innerHTML = tickets.map(t => {
      let statusBadge = '';
      if (t.status === 'resolved') {
        statusBadge = '<span class="u-bg-success-15 u-c-success-text u-bd-success-30 u-p-4-8 u-r-6 u-fs-2xs u-bold">حل‌شده</span>';
      } else if (t.status === 'answered') {
        statusBadge = '<span class="u-bg-primary-15 u-c-primary-text u-bd-primary-30 u-p-4-8 u-r-6 u-fs-2xs u-bold">پاسخ داده شده</span>';
      } else {
        statusBadge = '<span class="u-bg-danger-15 u-c-danger-text u-bd-danger-30 u-p-4-8 u-r-6 u-fs-2xs u-bold">در انتظار پاسخ</span>';
      }

      const tDate = t.createdAt ? new Date(t.createdAt).toLocaleDateString('fa-IR') : '';
      const replies = t.replies || [];

      return `
        <div class="u-bg-surface-2-70 u-bd-fg-8 u-r-12 u-p-16">
          <!-- Ticket Header -->
          <div class="u-flex u-justify-between u-items-center u-wrap u-gap-8 u-mb-12 u-bb-fg-6 u-pb-10">
            <div class="u-flex u-items-center u-gap-8">
              <span class="u-bg-accent-15 u-c-accent-text u-bd-accent-30 u-p-2-8 u-r-6 u-fs-xs u-bold">
                ${esc(t.category || 'پشتیبانی')}
              </span>
              <span class="u-bold u-c-text u-fs-base">${esc(t.subject || 'بدون موضوع')}</span>
            </div>
            <div class="u-flex u-items-center u-gap-10">
              <span class="u-fs-xs u-c-text-muted u-mono">${tDate}</span>
              ${statusBadge}
            </div>
          </div>

          <!-- Initial Message from Student -->
          <div class="u-bg-surface-60 u-r-10 u-p-12 u-mb-12 u-br-3-solid-primary">
            <div class="u-fs-xs u-bold u-c-primary-text u-mb-4 u-flex u-items-center u-gap-6">
              <i class="fa-solid fa-user-graduate"></i> پیام دانش‌آموز (${esc(student.name)}):
            </div>
            <div class="u-fs-sm u-c-text u-lh-1_6">${esc(t.subject || '')}</div>
            ${t.voiceUrl ? `<div class="u-mt-8"><audio controls src="${esc(t.voiceUrl)}" class="u-h-34 u-w-full u-maxw-320"></audio></div>` : ''}
            ${t.attachmentUrl ? `<div class="u-mt-8"><a href="${esc(t.attachmentUrl)}" target="_blank" class="u-c-primary-text u-fs-xs u-no-underline"><i class="fa-solid fa-paperclip"></i> مشاهده فایل ضمیمه</a></div>` : ''}
          </div>

          <!-- Conversation Replies History -->
          ${replies.length > 0 ? `
            <div class="u-flex u-col u-gap-8 u-mb-12 u-pr-12 u-br-2-dashed-fg-10">
              ${replies.map(r => {
                const rDate = r.createdAt ? new Date(r.createdAt).toLocaleDateString('fa-IR') : '';
                return `
                  <div class="u-bg-surface-80 u-bd-fg-6 u-r-8 u-p-10-12">
                    <div class="u-flex u-justify-between u-items-center u-mb-4 u-fs-xs">
                      <span class="u-bold u-c-success-text u-flex u-items-center u-gap-6">
                        <i class="fa-solid fa-reply"></i> پاسخ راهبر (${esc(r.mentor?.name || mentorName)}):
                      </span>
                      <span class="u-c-text-muted u-mono">${rDate}</span>
                    </div>
                    <div class="u-fs-sm u-c-text u-lh-1_6">${esc(r.message)}</div>
                    ${r.voiceUrl ? `<div class="u-mt-6"><audio controls src="${esc(r.voiceUrl)}" class="u-h-30 u-w-full u-maxw-300"></audio></div>` : ''}
                    ${r.attachmentUrl ? `<div class="u-mt-6"><a href="${esc(r.attachmentUrl)}" target="_blank" class="u-c-primary-text u-fs-xs"><i class="fa-solid fa-paperclip"></i> مشاهده فایل ضمیمه</a></div>` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          ` : '<div class="u-fs-xs u-c-text-muted u-mb-12 u-p-6-0">هنوز پاسخی به این تیکت ثبت نشده است.</div>'}

          <!-- Quick Reply & Action Form -->
          <div class="u-bg-surface-50 u-bd-fg-5 u-r-8 u-p-10 u-flex u-col u-gap-8">
            <div class="u-flex u-gap-8">
              <input type="text" id="ticket-reply-input-${t.id}" placeholder="ثبت پاسخ راهبر به دانش‌آموز..." class="u-flex-1 u-bg-shade-30 u-bd-fg-15 u-c-text u-p-8-12 u-r-8 u-fs-sm">
              <button type="button" data-click="sendTicketReply" data-click-args="${esc(JSON.stringify([String(t.id), String(mentorId), String(studentId)]))}" class="u-bg-grad-accent u-c-white u-bd-none u-p-8-16 u-r-8 u-bold u-pointer u-fs-xs u-inline-flex u-items-center u-gap-6">
                <i class="fa-solid fa-paper-plane"></i> ارسال پاسخ
              </button>
              ${t.status !== 'resolved' ? `
                <button type="button" data-click="resolveStudentTicket" data-click-args="${esc(JSON.stringify([String(t.id), String(mentorId), String(studentId)]))}" class="u-bg-success-15 u-bd-success-35 u-c-success-text u-p-8-12 u-r-8 u-pointer u-fs-xs u-inline-flex u-items-center u-gap-6" title="تغییر وضعیت تیکت به حل‌شده">
                  <i class="fa-solid fa-check"></i> حل‌شد
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  modal.style.display = 'flex';
};

window.sendTicketReply = async function(ticketId, mentorId, studentId) {
  const input = document.getElementById(`ticket-reply-input-${ticketId}`);
  if (!input || !input.value.trim()) {
    showToast('لطفاً متن پاسخ را وارد نمایید.', 'error');
    return;
  }
  const message = input.value.trim();

  try {
    const res = await request(`/api/v1/admin/tickets/${ticketId}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        
      },
      body: JSON.stringify({ message, mentorId })
    });
    const result = await res.json();
    if (res.ok) {
      showToast('پاسخ با موفقیت ثبت و برای دانش‌آموز ارسال شد.', 'success');
      await window.refreshDossierData(mentorId);
      window.openStudentTicketsModal(mentorId, studentId);
    } else {
      showToast('خطا در ارسال پاسخ: ' + (result.error || 'خطای سرور'), 'error');
    }
  } catch (e) {
    console.error('sendTicketReply error:', e);
    showToast('خطا در برقراری ارتباط با سرور: ' + e.message, 'error');
  }
};

window.resolveStudentTicket = async function(ticketId, mentorId, studentId) {
  if (!(await NopaConfirm('آیا از تغییر وضعیت این تیکت به «حل‌شده» اطمینان دارید؟'))) return;
  try {
    const res = await request(`/api/v1/admin/tickets/${ticketId}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        
      }
    });
    if (res.ok) {
      showToast('وضعیت تیکت با موفقیت به «حل‌شده» تغییر یافت.', 'success');
      await window.refreshDossierData(mentorId);
      window.openStudentTicketsModal(mentorId, studentId);
    } else {
      const err = await res.json();
      showToast('خطا: ' + (err.error || 'عملیات ناموفق'), 'error');
    }
  } catch (e) {
    showToast('خطا در ارتباط با سرور: ' + e.message, 'error');
  }
};

window.openStudentChallengesModal = function(mentorId, studentId) {
  const modal = document.getElementById('student-challenges-modal');
  const body = document.getElementById('student-challenges-content-body');
  if (!modal || !body) return;

  const student = window.currentDossierData?.supervisedStudents?.find(s => s.id === studentId);
  if (!student) {
    showToast('اطلاعات دانش‌آموز یافت نشد.', 'error');
    return;
  }

  const mentorName = window.currentDossierData?.identity?.name || 'راهبر آموزشی';
  document.getElementById('student-challenges-title').innerHTML = `<i class="fa-solid fa-trophy u-c-primary-text"></i> رفت و برگشت چالش‌ها و تکالیف: <span class="u-c-text">${esc(student.name)}</span> <span class="u-fs-xs u-c-text-muted u-fw-normal">(راهبر: ${mentorName})</span>`;
  document.getElementById('student-challenges-subtitle').textContent = `کاروان: ${student.caravanName} | تکالیف، فایل‌های ارسالی، نمرات و بازخوردهای اصلاحی راهبر`;

  const submissions = student.submissions || [];
  const quizSubs = student.quizSubmissions || [];

  if (submissions.length === 0 && quizSubs.length === 0) {
    body.innerHTML = `
      <div class="u-text-center u-p-32-20 u-c-text-muted u-bg-shade-25 u-r-12 u-bd-1-dashed-fg-10">
        <i class="fa-solid fa-file-circle-xmark fa-3x u-c-text-faint u-mb-12"></i>
        <div class="u-fs-base u-bold u-c-text-soft">هیچ ارسال چالشی از طرف این دانش‌آموز ثبت نشده است</div>
        <div class="u-fs-xs u-mt-6 u-c-text-muted">به محض ارسال تکالیف یا آزمون‌های کاروان توسط دانش‌آموز، جهت بررسی و ثبت بازخورد در این قسمت قرار می‌گیرند.</div>
      </div>
    `;
  } else {
    body.innerHTML = submissions.map(sub => {
      let statusBadge = '';
      if (sub.status === 'approved' || sub.status === 'APPROVED') {
        statusBadge = '<span class="u-bg-success-15 u-c-success-text u-bd-success-30 u-p-4-10 u-r-6 u-fs-xs u-bold">تایید شده</span>';
      } else if (sub.status === 'rejected' || sub.status === 'REJECTED') {
        statusBadge = '<span class="u-bg-danger-15 u-c-danger-text u-bd-danger-30 u-p-4-10 u-r-6 u-fs-xs u-bold">نیاز به اصلاح / رد شده</span>';
      } else {
        statusBadge = '<span class="u-bg-accent-15 u-c-accent-text u-bd-accent-30 u-p-4-10 u-r-6 u-fs-xs u-bold">در انتظار بررسی راهبر</span>';
      }

      const subDate = sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString('fa-IR') : '';
      const defaultScore = sub.score !== undefined && sub.score !== null ? sub.score : (sub.challenge?.rewardZarik || 200);

      return `
        <div class="u-bg-surface-2-70 u-bd-fg-8 u-r-12 u-p-16">
          <!-- Challenge Header -->
          <div class="u-flex u-justify-between u-items-center u-wrap u-gap-8 u-mb-12 u-bb-fg-6 u-pb-10">
            <div class="u-flex u-items-center u-gap-8">
              <span class="u-bg-primary-15 u-c-primary-text u-bd-primary-30 u-p-2-8 u-r-6 u-fs-xs u-bold">
                چالش کاروان
              </span>
              <span class="u-bold u-c-text u-fs-base"><i class="fa-solid fa-award u-c-accent-text"></i> ${esc(sub.challenge?.title || 'عنوان چالش')}</span>
            </div>
            <div class="u-flex u-items-center u-gap-10">
              <span class="u-fs-xs u-c-text-muted u-mono">${subDate}</span>
              ${statusBadge}
            </div>
          </div>

          <!-- Student Submission Box -->
          <div class="u-bg-surface-60 u-r-10 u-p-12 u-mb-12 u-br-3-solid-primary">
            <div class="u-fs-xs u-bold u-c-primary-text u-mb-4 u-flex u-items-center u-gap-6">
              <i class="fa-solid fa-user-pen"></i> پاسخ ارسالی دانش‌آموز (${esc(student.name)}):
            </div>
            <div class="u-fs-sm u-c-text u-lh-1_7">${esc(sub.answerText || 'فاقد متن ارسالی (فقط فایل ضمیمه)')}</div>
            ${sub.fileUrl ? `
              <div class="u-mt-8">
                <a href="${esc(sub.fileUrl)}" target="_blank" class="u-inline-flex u-items-center u-gap-6 u-bg-primary-12 u-bd-primary-30 u-c-primary-text u-p-6-12 u-r-6 u-fs-xs u-no-underline">
                  <i class="fa-solid fa-arrow-up-right-from-square"></i> مشاهده فایل / تصویر پیوست دانش‌آموز
                </a>
              </div>
            ` : ''}
          </div>

          <!-- Mentor Feedback History (if any) -->
          ${sub.mentorFeedback ? `
            <div class="u-bg-success-8 u-bd-success-20 u-r-10 u-p-12 u-mb-12">
              <div class="u-flex u-justify-between u-items-center u-mb-4 u-fs-xs">
                <span class="u-bold u-c-success-text u-flex u-items-center u-gap-6">
                  <i class="fa-solid fa-comments"></i> بازخورد ثبت‌شده توسط راهبر:
                </span>
                <span class="u-bg-success-20 u-c-success-text u-p-2-8 u-r-6 u-bold u-fs-2xs">
                  امتیاز اعطایی: ${sub.score || 0} زریک
                </span>
              </div>
              <div class="u-fs-sm u-c-text u-lh-1_6">${esc(sub.mentorFeedback)}</div>
            </div>
          ` : ''}

          <!-- Mentor Review / Correction Form -->
          <div class="u-bg-surface-70 u-bd-primary-20 u-r-10 u-p-12">
            <div class="u-fs-xs u-bold u-c-primary-text u-mb-8 u-flex u-items-center u-gap-6">
              <i class="fa-solid fa-pen-to-square"></i> ثبت / بازنویسی نمره و بازخورد راهبر:
            </div>
            <div class="u-grid u-gap-10 u-items-center u-cols-fit-140-auto">
              <select id="review-status-${sub.id}" class="u-bg-surface-2 u-bd-fg-20 u-c-text u-p-8-10 u-r-6 u-fs-xs">
                <option value="approved" ${sub.status === 'approved' || sub.status === 'APPROVED' ? 'selected' : ''}>تایید تکلیف (قبول)</option>
                <option value="rejected" ${sub.status === 'rejected' || sub.status === 'REJECTED' ? 'selected' : ''}>رد تکلیف (نیاز به اصلاح)</option>
              </select>
              <input type="number" id="review-score-${sub.id}" placeholder="امتیاز زریک" value="${defaultScore}" class="u-bg-surface-2 u-bd-fg-20 u-c-text u-p-8-10 u-r-6 u-fs-xs">
              <input type="text" id="review-feedback-${sub.id}" placeholder="متن بازخورد و راهنمایی راهبر..." value="${esc(sub.mentorFeedback || '')}" class="u-col-span-span-2 u-bg-surface-2 u-bd-fg-20 u-c-text u-p-8-10 u-r-6 u-fs-xs">
              <button type="button" data-click="submitSubmissionReview" data-click-args="${esc(JSON.stringify([String(sub.id), String(mentorId), String(studentId)]))}" class="u-bg-grad-success u-c-white u-bd-none u-p-8-16 u-r-6 u-bold u-pointer u-fs-xs u-inline-flex u-items-center u-gap-6 u-nowrap">
                <i class="fa-solid fa-floppy-disk"></i> ثبت بازخورد
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  modal.style.display = 'flex';
};

window.submitSubmissionReview = async function(submissionId, mentorId, studentId) {
  const statusEl = document.getElementById(`review-status-${submissionId}`);
  const scoreEl = document.getElementById(`review-score-${submissionId}`);
  const feedbackEl = document.getElementById(`review-feedback-${submissionId}`);

  const status = statusEl ? statusEl.value : 'approved';
  const score = scoreEl ? parseInt(scoreEl.value, 10) || 0 : 0;
  const mentorFeedback = feedbackEl ? feedbackEl.value.trim() : '';

  try {
    const res = await request(`/api/v1/admin/submissions/${submissionId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        
      },
      body: JSON.stringify({ status, score, mentorFeedback })
    });
    const result = await res.json();
    if (res.ok) {
      showToast('بازخورد و نمره راهبر با موفقیت ثبت شد و در پرونده ذخیره گردید.', 'success');
      await window.refreshDossierData(mentorId);
      window.openStudentChallengesModal(mentorId, studentId);
    } else {
      showToast('خطا در ثبت بازخورد: ' + (result.error || 'خطای سرور'), 'error');
    }
  } catch (e) {
    console.error('submitSubmissionReview error:', e);
    showToast('خطا در برقراری ارتباط با سرور: ' + e.message, 'error');
  }
};

window.refreshDossierData = async function(mentorId) {
  try {
    const res = await request(`/api/v1/admin/mentors/${mentorId}/dossier`);
    if (res.ok) {
      const dossier = await res.json();
      window.currentDossierData = dossier;
      mntDossierCache.set(String(mentorId), dossier);
      // a reply or a review changes the students' counters on the open mentor page
      const m = mntFind(mentorId);
      if (m && String(window.mntActiveMentorId) === String(mentorId)) mntPaint(m, dossier);
    }
  } catch (e) {
    console.error('refreshDossierData error:', e);
  }
};

window.cachedCaravansForMentorModal = [];

window.showMentorModal = async function() {
  const form = document.getElementById('mentor-form');
  if (form) form.reset();
  NopaPersonFields.fill('modal-mentor', {}); // also forgets a previously loaded phone and clears field errors

  document.getElementById('modal-mentor-id').value = '';
  document.getElementById('mentor-modal-form-title').textContent = 'ثبت راهبر جدید';
  const certsSection = document.getElementById('modal-mentor-certs-section');
  if (certsSection) certsSection.style.display = 'none';

  const caravanSearch = document.getElementById('mentor-caravan-search-input');
  if (caravanSearch) caravanSearch.value = '';

  // Load caravans for checklist (starts completely unchecked: Standalone Mentor)
  await window.populateMentorCaravansChecklist([]);

  const modal = document.getElementById('mentor-modal-overlay');
  if (modal) {
    modal.style.display = 'flex';
    modal.style.zIndex = 'var(--z-modal)';
  }
};

window.editMentor = async function(mentorId) {
  const m = window.mentorsMasterList.find(x => x.id === mentorId);
  if (!m) {
    showToast('اطلاعات راهبر یافت نشد.', 'error');
    return;
  }

  document.getElementById('modal-mentor-id').value = m.id;
  NopaPersonFields.fill('modal-mentor', {
    name: m.name, phoneNumber: m.phoneNumber, nationalId: m.nationalId, dateOfBirth: m.dateOfBirth, gender: m.gender, city: m.city
  });
  document.getElementById('modal-mentor-academic-degree').value = m.academicDegree || m.education || '';
  document.getElementById('modal-mentor-level').value = String(m.mentorLevel || 1);
  document.getElementById('modal-mentor-status').value = m.accountStatus || 'ACTIVE';
  document.getElementById('modal-mentor-social-platform').value = m.socialPlatform || '';
  document.getElementById('modal-mentor-social-handle').value = m.socialMessengerHandle || '';

  document.getElementById('mentor-modal-form-title').textContent = `ویرایش راهبر: ${m.name || ''}`;

  const caravanSearch = document.getElementById('mentor-caravan-search-input');
  if (caravanSearch) caravanSearch.value = '';

  // Populate assigned caravans checklist
  const assignedCaravanIds = (m.mentoredCaravans || []).map(c => c.id);
  if (m.caravanId && !assignedCaravanIds.includes(m.caravanId)) {
    assignedCaravanIds.push(m.caravanId);
  }
  await window.populateMentorCaravansChecklist(assignedCaravanIds);

  // Populate certificates if any
  const certsSection = document.getElementById('modal-mentor-certs-section');
  const certsTbody = document.getElementById('modal-mentor-certs-tbody');
  if (certsSection && certsTbody) {
    if (m.mentorDocuments && m.mentorDocuments.length > 0) {
      certsSection.style.display = 'block';
      certsTbody.innerHTML = m.mentorDocuments.map(doc => {
        let statusTag = doc.status === 'approved' ? '<span class="badge u-bg-success u-c-white">تایید شده</span>' :
                        (doc.status === 'rejected' ? '<span class="badge u-bg-danger u-c-white">رد شده</span>' : '<span class="badge u-bg-accent u-c-white">در انتظار</span>');
        return `
          <tr>
            <td>${esc(doc.filename || 'مدرک پیوست')}</td>
            <td><a href="${esc(doc.url)}" target="_blank" class="u-c-primary-text u-td-underline">مشاهده مدرک</a></td>
            <td>${statusTag}</td>
            <td>
              ${doc.status === 'pending' ? `
                <button type="button" class="btn-icon u-c-success-text u-bg-none u-bd-none u-pointer" data-click="inlineApproveCert" data-click-args="${esc(JSON.stringify([String(doc.id), String(m.id)]))}" title="تایید مدرک"><i class="fa-solid fa-check"></i></button>
                <button type="button" class="btn-icon u-c-danger-text u-bg-none u-bd-none u-pointer" data-click="inlineRejectCert" data-click-args="${esc(JSON.stringify([String(doc.id), String(m.id)]))}" title="رد مدرک"><i class="fa-solid fa-times"></i></button>
              ` : '-'}
            </td>
          </tr>
        `;
      }).join('');
    } else {
      certsSection.style.display = 'none';
    }
  }

  const modal = document.getElementById('mentor-modal-overlay');
  if (modal) {
    modal.style.display = 'flex';
    modal.style.zIndex = 'var(--z-modal)';
  }
};

window.populateMentorCaravansChecklist = async function(assignedIds = []) {
  const container = document.getElementById('modal-mentor-caravans-list');
  if (!container) return;

  container.innerHTML = '<div class="lst-skel-lines" aria-hidden="true">' + '<span class="lst-skel-row"></span>'.repeat(3) + '</div>';
  
  try {
    const res = await request('/api/v1/admin/caravans');
    const caravans = res.ok ? await res.json() : [];
    window.cachedCaravansForMentorModal = Array.isArray(caravans) ? caravans : [];

    if (window.cachedCaravansForMentorModal.length === 0) {
      container.innerHTML = '<div class="lsv-col-empty">هیچ کاروانی در سامانه ثبت نشده است.</div>';
      return;
    }

    container.innerHTML = window.cachedCaravansForMentorModal.map(c => `
      <label class="lse-tree-row crv-cand mentor-caravan-item-label" data-caravan-name="${esc((c.name || '').toLowerCase())}">
        <input type="checkbox" class="mentor-caravan-checkbox" value="${esc(c.id)}" ${assignedIds.includes(c.id) ? 'checked' : ''}>
        ${crvAvatar(c.coverImageUrl, c.name, 'lse-tree-num crv-result-avatar')}
        <span class="lse-tree-text"><strong>${esc(c.name)}</strong><small>${c.mentor?.name ? `راهبر فعلی: ${esc(c.mentor.name)}` : 'بدون راهبر'}</small></span>
      </label>
    `).join('');
  } catch (e) {
    console.error('Error fetching caravans checklist:', e);
    container.innerHTML = '<div class="lsv-col-empty">خطا در دریافت لیست کاروان‌ها</div>';
  }
};

window.filterMentorCaravansChecklist = function(query) {
  const term = (query || '').trim().toLowerCase();
  const items = document.querySelectorAll('.mentor-caravan-item-label');
  items.forEach(el => {
    const cName = el.getAttribute('data-caravan-name') || '';
    if (!term || cName.includes(term)) {
      el.style.display = 'flex';
    } else {
      el.style.display = 'none';
    }
  });
};

window.uncheckAllMentorCaravans = function() {
  const checkboxes = document.querySelectorAll('.mentor-caravan-checkbox');
  checkboxes.forEach(cb => { cb.checked = false; });
  const caravanSearch = document.getElementById('mentor-caravan-search-input');
  if (caravanSearch) caravanSearch.value = '';
  window.filterMentorCaravansChecklist('');
};

window.handleMentorFormSubmit = async function(e) {
  if (e) e.preventDefault();

  const id = document.getElementById('modal-mentor-id').value;
  // a new mentor logs in with this phone, so it is required on create
  if (!NopaPersonFields.validate('modal-mentor', { requirePhone: !id })) return;
  // normalised (Latin digits, 09…); phoneNumber is undefined when an edit left it untouched
  const { name, phoneNumber, nationalId, dateOfBirth, city, gender } = NopaPersonFields.read('modal-mentor');
  const academicDegree = document.getElementById('modal-mentor-academic-degree').value.trim();
  const mentorLevel = parseInt(document.getElementById('modal-mentor-level').value) || 1;
  const accountStatus = document.getElementById('modal-mentor-status').value;
  const socialPlatform = document.getElementById('modal-mentor-social-platform').value;
  const socialMessengerHandle = document.getElementById('modal-mentor-social-handle').value.trim();

  // Read all selected caravan checkboxes (Can be empty [] for standalone mentors without caravans)
  const caravanCheckboxes = document.querySelectorAll('.mentor-caravan-checkbox:checked');
  const assignedCaravanIds = Array.from(caravanCheckboxes).map(cb => cb.value);

  const payload = {
    id: id || undefined,
    name,
    phoneNumber,
    nationalId,
    dateOfBirth,
    city,
    gender,
    academicDegree: academicDegree || null,
    mentorLevel,
    accountStatus,
    socialPlatform: socialPlatform || null,
    socialMessengerHandle: socialMessengerHandle || null,
    assignedCaravanIds: assignedCaravanIds, // Array of caravan IDs (empty array if no caravan chosen)
    caravanId: assignedCaravanIds.length > 0 ? assignedCaravanIds[0] : null
  };

  try {
    const res = await request('/api/v1/admin/mentors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const msg = assignedCaravanIds.length > 0 
        ? `راهبر «${name}» با موفقیت همراه با ${assignedCaravanIds.length} کاروان ثبت و ذخیره شد.`
        : `راهبر «${name}» با موفقیت به عنوان راهبر مستقل (بدون کاروان) ثبت و ذخیره شد.`;
      showToast(msg);
      document.getElementById('mentor-modal-overlay').style.display = 'none';
      await window.loadMentors();
    } else {
      const err = await res.json();
      showToast('خطا در ذخیره‌سازی: ' + (err.error || 'خطای سرور'), 'error');
    }
  } catch (err) {
    console.error('Save mentor error:', err);
    showToast('ارتباط با سرور برقرار نشد: ' + err.message, 'error');
  }
};

window.openMentorModerationModal = function(mentorId) {
  const m = window.mentorsMasterList.find(x => x.id === mentorId);
  document.getElementById('mod-mentor-id').value = mentorId;
  
  if (m) {
    document.getElementById('mod-mentor-subtitle').textContent = `راهبر: ${m.name || ''} (${m.phoneNumber || ''}) - وضعیت فعلی: ${m.accountStatus || 'ACTIVE'}`;
  }

  window.toggleTempSuspendDate(false);
  const modal = document.getElementById('mentor-moderation-modal');
  if (modal) {
    modal.style.display = 'flex';
    modal.style.zIndex = 'var(--z-modal)';
  }
};

window.toggleTempSuspendDate = function(show) {
  const container = document.getElementById('mod-temp-date-container');
  if (container) container.style.display = show ? 'block' : 'none';
};

window.executeMentorModeration = async function(e) {
  if (e) e.preventDefault();

  const id = document.getElementById('mod-mentor-id').value;
  if (!id) return;

  const action = document.querySelector('input[name="mod_action"]:checked')?.value || 'activate';
  const suspendedUntil = document.getElementById('mod-suspended-until')?.value;

  try {
    const res = await request(`/api/v1/admin/mentors/${id}/moderate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        
      },
      body: JSON.stringify({ action, suspendedUntil: suspendedUntil || undefined })
    });

    if (res.ok) {
      showToast('اقدام مدیریتی با موفقیت بر روی حساب کاربری راهبر اعمال شد.', 'success');
      document.getElementById('mentor-moderation-modal').style.display = 'none';
      await window.loadMentors();
    } else {
      const err = await res.json();
      showToast('خطا در اعمال اقدام: ' + (err.error || 'خطای سرور'), 'error');
    }
  } catch (err) {
    console.error('Mentor moderation error:', err);
    showToast('ارتباط با سرور برقرار نشد: ' + err.message, 'error');
  }
};

// The mentor documents queue (#mentors-docs-tab) lives in js/features/mentor-docs.js

// Approve / reject a certificate from inside the mentor modal (buttons rendered by editMentor).
// Only the row is updated so unsaved edits in the mentor form are kept.
async function decideMentorCertInline(docId, decision) {
  let note = 'تایید شد';
  if (decision === 'reject') {
    note = prompt('علت رد مدرک را وارد کنید (حداقل ۳ کاراکتر):') || '';
    if (note.trim().length < 3) return;
  }
  try {
    const res = await request(`/api/v1/admin/mentors/documents/${encodeURIComponent(docId)}/${decision}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note, reason: note })
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return showToast(d.error || 'خطا در ثبت وضعیت مدرک', 'error');
    }
    const row = Array.from(document.querySelectorAll('#modal-mentor-certs-tbody tr'))
      .find(tr => tr.innerHTML.includes(docId));
    if (row && row.cells.length >= 4) {
      row.cells[2].innerHTML = decision === 'approve'
        ? '<span class="badge u-bg-success u-c-white">تایید شده</span>'
        : '<span class="badge u-bg-danger u-c-white">رد شده</span>';
      row.cells[3].innerHTML = '';
    }
    showToast(decision === 'approve' ? 'مدرک تایید شد' : 'مدرک رد شد', 'success');
    if (typeof window.loadMentorDocs === 'function') window.loadMentorDocs();
  } catch (e) {
    console.error(e);
  }
}
window.inlineApproveCert = (docId) => decideMentorCertInline(docId, 'approve');
window.inlineRejectCert = (docId) => decideMentorCertInline(docId, 'reject');

// 3. Mentors Table Loader (#mentors-tbody)
window.loadMentorsData = async function() {
  if (typeof window.loadMentors === 'function') {
    await window.loadMentors();
  }
};
