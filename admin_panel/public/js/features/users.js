// Users: a person's full report (#urp-modal), user modal, levels, students.
// Split out of the former app.js (Phase 7). Classic script: shares globals with the other modules;
// load order is set in index.html.

// The همسفران page itself (bento + one person's page) is js/features/audience.js; levels are js/features/levels.js.

// ==========================================
// Full report: the station editor's large dialog with four tabs (css/stations.css .lse-*, .urp-*).
// Opens at once with skeletons; GET /admin/users/:id/analytics fills it. Helpers crvAvatar / crvFa come from
// js/features/caravans.js (loads earlier).
// ==========================================
let urpUserId = null;

function urpFact(icon, label, value, ltr) {
  return `<div class="aud-fact"><span><i class="fa-solid ${icon}"></i> ${label}</span><strong${ltr ? ' dir="ltr"' : ''}>${esc(value == null || value === '' ? 'ثبت نشده' : String(value))}</strong></div>`;
}
function urpAgeGroup(dob) {
  if (!dob) return 'نامشخص';
  const y = parseInt(String(dob).split('/')[0], 10);
  if (!y) return 'نامشخص';
  const age = 1405 - y; // approximate current Shamsi year
  if (age < 12) return 'کودک';
  if (age < 18) return 'نوجوان';
  if (age < 24) return 'جوان';
  return 'بزرگسال';
}
function urpSkeleton() {
  const lines = '<div class="lst-skel-lines" aria-hidden="true">' + '<span class="lst-skel-row"></span>'.repeat(4) + '</div>';
  return `<section class="lse-card is-loading">${lines}</section><section class="lse-card is-loading">${lines}</section>`;
}

async function viewUserDetails(userId) {
  const modal = document.getElementById('urp-modal');
  if (!modal) return;
  urpUserId = String(userId);
  window.switchDrawerTab('identity');
  document.querySelector('#urp-tabs [data-urp-tab="mentor"]').hidden = true;
  document.getElementById('drawer-user-name').textContent = 'گزارش کامل';
  document.getElementById('urp-head-sub').textContent = 'در حال دریافت اطلاعات...';
  document.getElementById('urp-head-avatar').innerHTML = '<i class="fa-solid fa-user"></i>';
  document.getElementById('urp-foot-actions').innerHTML = '';
  document.getElementById('drawer-body-info').innerHTML = urpSkeleton();
  modal.style.display = 'flex';
  modal.style.zIndex = 'var(--z-modal)';

  try {
    const res = await request(`/api/v1/admin/users/${encodeURIComponent(userId)}/analytics`);
    const payload = await res.json().catch(() => ({}));
    if (urpUserId !== String(userId)) return; // another report was opened meanwhile
    if (!res.ok) throw new Error(payload.error || 'خطا در دریافت اطلاعات');
    urpPaint(payload);
  } catch (error) {
    console.error('Error fetching user details:', error);
    if (urpUserId === String(userId)) {
      document.getElementById('drawer-body-info').innerHTML = `<div class="lst-empty"><i class="fa-solid fa-triangle-exclamation lst-warn"></i> ${esc(error.message || 'خطا در دریافت اطلاعات')}</div>`;
    }
  }
}

function urpPaint(payload) {
  urpLastPayload = payload;
  const user = payload.user || {};
  const b = payload.balances || {};
  const mentor = !!(user.isDualRole || String(user.role).toLowerCase() === 'mentor');
  const name = user.name || 'کاربر';
  const sp = payload.stationsProgress?.summary || {};

  document.getElementById('drawer-user-name').textContent = name;
  document.getElementById('urp-head-sub').textContent = [roleLabel(user.role), user.phoneNumber, user.userCode ? `کد ${crvFa(user.userCode)}` : ''].filter(Boolean).join(' · ');
  document.getElementById('urp-head-avatar').outerHTML = crvAvatar(user.avatarUrl, name, 'lse-id-icon is-accent urp-head-avatar').replace('<span class="', '<span id="urp-head-avatar" class="');
  document.querySelector('#urp-tabs [data-urp-tab="mentor"]').hidden = !mentor;
  document.getElementById('urp-foot-actions').innerHTML = `
    <button type="button" class="lse-btn" data-click="openPersonSitePhoto" data-click-args="${crvArgs(user.id, 'urp')}"><i class="fa-solid fa-image"></i> عکس سایت</button>
    <button type="button" class="lse-btn" data-click="openPasswordOverride" data-click-args="${crvArgs(user.id)}"><i class="fa-solid fa-key"></i> تغییر رمز</button>
    <button type="button" class="lse-btn urp-danger" data-click="setAccountStatus" data-click-args="${crvArgs(user.id, 'SUSPENDED')}"><i class="fa-solid fa-user-slash"></i> تعلیق حساب</button>`;

  const asset = (cls, icon, label, value) => `<div class="crv-asset ${cls}"><span class="crv-asset-icon"><i class="fa-solid ${icon}"></i></span><span class="crv-asset-text"><small>${esc(label)}</small><strong>${crvFa(value)}</strong></span></div>`;
  const gender = user.gender === 'male' ? 'مرد' : user.gender === 'female' ? 'زن' : null;
  const tickets = payload.tickets || [];
  const caravans = payload.mentoredCaravans || [];
  const ticketState = t => {
    const s = String(t.status || '').toLowerCase();
    if (s === 'resolved' || s === 'closed') return '<span class="chm-mini-chip is-resolved">حل‌شده</span>';
    if (s === 'answered') return '<span class="chm-mini-chip is-reviewing">پاسخ‌داده</span>';
    return '<span class="chm-mini-chip is-open">در انتظار پاسخ</span>';
  };

  document.getElementById('drawer-body-info').innerHTML = `
    <div class="urp-pane is-active" data-urp-pane="identity">
      <section class="lse-card urp-hero">
        ${nopaPersonPhoto(user, 'urp', 'crv-mentor-photo urp-photo')}
        <div class="urp-hero-text">
          <strong>${esc(name)}</strong>
          <span>${esc(roleLabel(user.role))}${user.caravanName ? ` · کاروان ${esc(user.caravanName)}` : ''}</span>
          <div class="lsv-facts">
            <span><i class="fa-solid fa-layer-group"></i> سطح ${crvFa(user.levelFrame || 1)}</span>
            <span><i class="fa-regular fa-calendar"></i> عضو از ${esc(user.createdAt ? new Date(user.createdAt).toLocaleDateString('fa-IR') : '-')}</span>
          </div>
          ${payload.presence ? window.nopaPresenceChip(payload.presence) : ''}
        </div>
      </section>
      <div id="urp-activity-chart"></div>
      <section class="lse-card">
        <h4 class="lse-card-title"><i class="fa-solid fa-coins"></i> دارایی‌ها</h4>
        <div class="crv-assets-card urp-assets">
          ${asset('is-accent', 'fa-coins', window.assetName ? window.assetName('zarik') : 'زریک', b.zarik)}
          ${asset('is-primary', 'fa-circle-nodes', window.assetName ? window.assetName('nakh') : 'کلاف', b.nakh)}
          ${asset('is-success', 'fa-flag', window.assetName ? window.assetName('derafsh') : 'درفش', b.beyragh)}
          ${asset('is-info', 'fa-rug', window.assetName ? window.assetName('farsh') : 'قالیچه', b.farsh)}
        </div>
      </section>
      <section class="lse-card">
        <h4 class="lse-card-title"><i class="fa-solid fa-address-card"></i> اطلاعات هویتی</h4>
        <div class="aud-facts urp-facts">
          ${urpFact('fa-signature', 'نام کامل', name)}
          ${urpFact('fa-id-badge', 'کد ملی', user.nationalId, true)}
          ${urpFact('fa-phone', 'شماره تماس', user.phoneNumber, true)}
          ${urpFact('fa-hashtag', 'کد کاربری', user.userCode ? crvFa(user.userCode) : null)}
          ${urpFact('fa-cake-candles', 'تاریخ تولد', user.dateOfBirth)}
          ${urpFact('fa-children', 'رده سنی', urpAgeGroup(user.dateOfBirth))}
          ${urpFact('fa-venus-mars', 'جنسیت', gender)}
          ${urpFact('fa-location-dot', 'شهر / استان', user.city)}
          ${urpFact('fa-graduation-cap', 'تحصیلات', user.academicDegree)}
          ${urpFact('fa-compass', 'کاروان', user.caravanName || 'عضو هیچ کاروانی نیست')}
        </div>
      </section>
    </div>

    <div class="urp-pane" data-urp-pane="progress" hidden>
      <section class="lse-card">
        <div class="urp-stats">
          <div class="urp-stat is-primary"><span><i class="fa-solid fa-map-location-dot"></i> منزلگاه‌ها</span><strong id="drawer-stat-stations">-</strong><span class="lst-bar"><span class="lst-bar-active" id="urp-bar-stations"></span></span></div>
          <div class="urp-stat is-primary"><span><i class="fa-solid fa-chalkboard-user"></i> کلاس‌ها</span><strong id="drawer-stat-classes">-</strong><span class="lst-bar"><span class="lst-bar-active" id="urp-bar-classes"></span></span></div>
          <div class="urp-stat is-success"><span><i class="fa-solid fa-circle-play"></i> پارت‌ها</span><strong id="drawer-stat-parts">-</strong><span class="lst-bar"><span class="lst-bar-active" id="urp-bar-parts"></span></span></div>
          <div class="urp-stat is-accent"><span><i class="fa-solid fa-spell-check"></i> آزمون‌ها</span><strong id="drawer-stat-quizzes">-</strong><span class="lst-bar"><span class="lst-bar-active" id="urp-bar-quizzes"></span></span></div>
          <div class="urp-stat is-info"><span><i class="fa-solid fa-trophy"></i> چالش‌ها</span><strong id="drawer-stat-challenges">-</strong><span class="lst-bar"><span class="lst-bar-active" id="urp-bar-challenges"></span></span></div>
        </div>
      </section>
      <div class="urp-filters">
        <div class="chm-chips" id="drawer-class-filter-chips" role="tablist">
          ${[['all', 'همه'], ['classes', 'کلاس‌ها'], ['parts', 'پارت‌ها'], ['quizzes', 'آزمون‌ها'], ['challenges', 'چالش‌ها']].map((f, i) =>
            `<button type="button" class="chm-chip${i ? '' : ' is-active'}" role="tab" id="btn-prog-filter-${f[0]}" data-click="filterDrawerClassProgress" data-click-args='["${f[0]}"]'>${f[1]}</button>`).join('')}
        </div>
        <label class="search-box"><i class="fa-solid fa-search"></i><input type="text" id="drawer-class-search-input" class="input-ctrl" placeholder="جستجوی منزلگاه، کلاس، آزمون..." data-input="filterDrawerClassProgress" aria-label="جستجو در پیشرفت"></label>
      </div>
      <div id="drawer-class-progress-list" class="urp-stations"></div>
    </div>

    <div class="urp-pane" data-urp-pane="support" hidden>
      <section class="lse-card">
        <h4 class="lse-card-title"><i class="fa-solid fa-compass"></i> کاروان</h4>
        ${user.caravanName
          ? `<div class="lsv-row crv-member"><span class="lsv-row-avatar lsv-row-num"><i class="fa-solid fa-compass"></i></span><span class="lsv-row-text"><strong>${esc(user.caravanName)}</strong><span>کاروان فعلی</span></span></div>`
          : '<div class="lsv-col-empty">عضو هیچ کاروانی نیست.</div>'}
      </section>
      <section class="lse-card">
        <h4 class="lse-card-title"><i class="fa-solid fa-ticket"></i> تیکت‌ها <span class="lsv-col-count">${crvFa(tickets.length)}</span></h4>
        <div id="drawer-ticket-list" class="urp-tickets">${tickets.length ? tickets.map(t => `
          <div class="urp-ticket">
            <div class="urp-ticket-head"><strong>${esc(t.subject || 'تیکت')}</strong>${ticketState(t)}</div>
            ${t.description ? `<p>${esc(t.description)}</p>` : ''}
            <small>${esc(t.createdAt ? new Date(t.createdAt).toLocaleString('fa-IR') : '')}${(t.replies || []).length ? ` · ${crvFa(t.replies.length)} پاسخ` : ''}</small>
          </div>`).join('') : '<div class="lsv-col-empty">تیکتی ثبت نشده است.</div>'}</div>
      </section>
    </div>

    <div class="urp-pane" data-urp-pane="mentor" hidden>
      <section class="lse-card">
        <div class="crv-assets-card urp-assets">
          ${asset('is-primary', 'fa-compass', 'کاروان‌های تحت مدیریت', caravans.length)}
          ${asset('is-accent', 'fa-star', 'سطح راهبری', user.mentorLevel || 1)}
        </div>
      </section>
      <section class="lse-card">
        <h4 class="lse-card-title"><i class="fa-solid fa-list"></i> کاروان‌ها</h4>
        ${caravans.length ? caravans.map(c => `
          <div class="lsv-row crv-member"><span class="lsv-row-avatar lsv-row-num">${crvInitial(c.name)}</span>
            <span class="lsv-row-text"><strong>${esc(c.name)}</strong><span>${c.memberCount != null ? `${crvFa(c.memberCount)} عضو` : ''}${c.status === 'suspended' ? ' · تعلیق‌شده' : ''}</span></span></div>`).join('')
          : '<div class="lsv-col-empty">کاروانی ثبت نشده است.</div>'}
      </section>
    </div>`;

  window.populateDrawerClassProgress(payload);
  nopaPersonChart(document.getElementById('urp-activity-chart'), 'urp', user.id);
  NopaPhoto.remount();
  if (window.NopaFlip) window.NopaFlip.enter(document.querySelectorAll('#drawer-body-info .urp-pane.is-active > .lse-card'));
}

window.closeUserDetailDrawer = function() {
  urpUserId = null;
  const modal = document.getElementById('urp-modal');
  if (modal && modal.style.display !== 'none') NopaActions.hide('urp-modal');
};

window.switchDrawerTab = function(tabId) {
  const key = String(tabId || 'identity').replace(/^tab-/, '').replace('class-progress', 'progress');
  document.querySelectorAll('#urp-tabs [data-urp-tab]').forEach(b => {
    const on = b.dataset.urpTab === key;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-selected', String(on));
  });
  document.querySelectorAll('#drawer-body-info .urp-pane').forEach(p => {
    const on = p.dataset.urpPane === key;
    p.hidden = !on;
    p.classList.toggle('is-active', on);
  });
  const body = document.getElementById('drawer-body-info');
  if (body) body.scrollTop = 0;
};
window.toggleDualRoleView = function() { window.switchDrawerTab('mentor'); }; // old name

// ==========================================
// Class & Exam Progress Breakdown (the report's second tab)
// Separate sections for: منزلگاه، کلاس، پارت، آزمون، چالش
// ==========================================
window.cachedDrawerClassRows = [];
window.activeDrawerClassFilter = 'all';

window.populateDrawerClassProgress = function(payload) {
  if (!payload) return;
  const summary = payload.stationsProgress?.summary || {};
  const stations = payload.stationsProgress?.allStations || [];
  const userProgressRecords = payload.userProgressRecords || [];
  const challenges = payload.challenges || payload.quizzes || [];
  const allChallenges = payload.allChallenges || [];
  const quizSubmissions = payload.quizSubmissions || payload.assignments || [];

  // Update 5 Header Stats Summary
  const totalStations = summary.totalStations || stations.length || 5;
  const passedStations = summary.passedStations || 0;
  const statStationsEl = document.getElementById('drawer-stat-stations');
  if (statStationsEl) statStationsEl.textContent = `${passedStations} از ${totalStations}`;

  const totalClasses = summary.totalClasses || 0;
  const passedClasses = summary.passedClasses || 0;
  const statClassesEl = document.getElementById('drawer-stat-classes');
  if (statClassesEl) statClassesEl.textContent = `${passedClasses} از ${totalClasses}`;

  const totalParts = summary.totalParts || 0;
  const passedParts = summary.passedParts || 0;
  const statPartsEl = document.getElementById('drawer-stat-parts');
  if (statPartsEl) statPartsEl.textContent = `${passedParts} از ${totalParts}`;

  const totalQuizzes = summary.totalQuizzes || 0;
  const passedQuizzes = summary.passedQuizzes || 0;
  const statQuizzesEl = document.getElementById('drawer-stat-quizzes');
  if (statQuizzesEl) statQuizzesEl.textContent = `${passedQuizzes} از ${totalQuizzes}`;

  const completedChallenges = challenges.filter(c => c.status === 'approved').length;
  const totalChCount = Math.max(allChallenges.length, challenges.length);
  const statChallengesEl = document.getElementById('drawer-stat-challenges');
  if (statChallengesEl) statChallengesEl.textContent = `${completedChallenges} از ${totalChCount}`;

  // Build lookups for fast retrieval
  const progressMap = {};
  userProgressRecords.forEach(p => {
    if (p.sessionId) progressMap[p.sessionId] = p;
  });

  const quizSubMap = {};
  quizSubmissions.forEach(qs => {
    const qid = qs.quizId || qs.quiz?.id;
    if (qid) quizSubMap[qid] = qs;
  });

  const challengeSubMap = {};
  challenges.forEach(ch => {
    const cid = ch.challengeId || ch.challenge?.id;
    if (cid) challengeSubMap[cid] = ch;
  });

  // Compile structured rows
  const rows = [];

  stations.forEach((st, stIdx) => {
    const stNumber = st.stationNumber || (stIdx + 1);
    const stTitle = st.title || `منزلگاه ${stNumber}`;

    // Correlate challenges by station number or identifier
    const stChallenges = allChallenges.filter(ch => {
      const cid = (ch.id || '').toUpperCase();
      const cTitle = (ch.title || '').toLowerCase();
      return cid.includes(`CH${stNumber}`) || cid.includes(`${stNumber}0`) || cTitle.includes(`منزلگاه ${stNumber}`);
    });

    let stHasSessions = false;

    (st.categories || []).forEach((cat) => {
      (cat.sessions || []).forEach((sess, sessIdx) => {
        stHasSessions = true;
        const prog = progressMap[sess.id] || {};
        const isWatched = !!prog.isWatched;
        const quizPassed = !!prog.quizPassed;
        const clips = sess.videoClips || [];
        const quizzes = sess.quizzes || [];

        // Match associated challenge for this session/station
        let assocChallenge = null;
        let assocSubmission = null;
        if (stChallenges.length > 0) {
          assocChallenge = stChallenges[sessIdx % stChallenges.length];
        } else if (allChallenges.length > 0) {
          assocChallenge = allChallenges[sessIdx % allChallenges.length];
        }

        if (assocChallenge) {
          assocSubmission = challengeSubMap[assocChallenge.id] || null;
        }

        // Calculate progress percentage
        let earnedScore = 0;
        let maxScore = 0;

        // Class & Part Weight (50%)
        maxScore += 50;
        if (isWatched) earnedScore += 50;

        // Quiz Weight (30%)
        if (quizzes.length > 0) {
          maxScore += 30;
          if (quizPassed) earnedScore += 30;
        }

        // Challenge Weight (20%)
        if (assocChallenge) {
          maxScore += 20;
          if (assocSubmission?.status === 'approved') earnedScore += 20;
          else if (assocSubmission?.status === 'pending') earnedScore += 10;
        }

        const pct = maxScore > 0 ? Math.round((earnedScore / maxScore) * 100) : (isWatched ? 100 : 0);

        rows.push({
          type: 'class_row',
          stationId: st.id,
          stationNumber: stNumber,
          stationTitle: stTitle,
          categoryTitle: cat.title,
          sessionId: sess.id,
          sessionTitle: sess.title,
          clips,
          isWatched,
          quizzes,
          quizPassed,
          quizSubmissions: quizzes.map(q => quizSubMap[q.id]).filter(Boolean),
          challenge: assocChallenge,
          challengeSubmission: assocSubmission,
          progressPct: pct,
          isCompleted: pct === 100
        });
      });
    });

    // If station has no sessions registered yet
    if (!stHasSessions) {
      rows.push({
        type: 'station_only',
        stationId: st.id,
        stationNumber: stNumber,
        stationTitle: stTitle,
        categoryTitle: '-',
        sessionId: null,
        sessionTitle: 'فاقد جلسه ثبت‌شده',
        clips: [],
        isWatched: false,
        quizzes: [],
        quizPassed: false,
        quizSubmissions: [],
        challenge: stChallenges[0] || null,
        challengeSubmission: stChallenges[0] ? challengeSubMap[stChallenges[0].id] : null,
        progressPct: 0,
        isCompleted: false
      });
    }
  });

  // Include any standalone/caravan challenges not linked to rows
  allChallenges.forEach(ch => {
    const isAlreadyAssigned = rows.some(r => r.challenge && r.challenge.id === ch.id);
    if (!isAlreadyAssigned) {
      const sub = challengeSubMap[ch.id];
      const isApproved = sub?.status === 'approved';
      rows.push({
        type: 'challenge_only',
        stationId: null,
        stationNumber: '-',
        stationTitle: 'چالش‌های کاروان / عمومی',
        categoryTitle: '-',
        sessionId: null,
        sessionTitle: '-',
        clips: [],
        isWatched: false,
        quizzes: [],
        quizPassed: false,
        quizSubmissions: [],
        challenge: ch,
        challengeSubmission: sub,
        progressPct: isApproved ? 100 : (sub ? 50 : 0),
        isCompleted: isApproved
      });
    }
  });

  window.cachedDrawerClassRows = rows;
  window.activeDrawerClassFilter = 'all';

  // Bars under the five counters
  const bar = (id, done, total) => {
    const el = document.getElementById(id);
    if (el) el.style.width = (total ? Math.round((done / total) * 100) : 0) + '%';
  };
  bar('urp-bar-stations', passedStations, totalStations);
  bar('urp-bar-classes', passedClasses, totalClasses);
  bar('urp-bar-parts', passedParts, totalParts);
  bar('urp-bar-quizzes', passedQuizzes, totalQuizzes);
  bar('urp-bar-challenges', completedChallenges, totalChCount);
  ['stations', 'classes', 'parts', 'quizzes', 'challenges'].forEach(k => {
    const el = document.getElementById('drawer-stat-' + k);
    if (el) el.textContent = el.textContent.replace(/\d+/g, d => Number(d).toLocaleString('fa-IR'));
  });

  window.filterDrawerClassProgress('all');
};

// One state pill: ok (green), wait (amber), bad (red), none (grey)
function urpPill(tone, icon, text, title) {
  return `<span class="urp-pill is-${tone}"${title ? ` title="${esc(title)}"` : ''}><i class="fa-solid ${icon}"></i>${esc(text)}</span>`;
}

function urpRowPills(r) {
  const pills = [];
  // part(s)
  if (r.sessionId) {
    const n = (r.clips || []).length || 1;
    pills.push(r.isWatched ? urpPill('ok', 'fa-circle-play', `${n.toLocaleString('fa-IR')} پارت دیده شده`)
                           : urpPill('none', 'fa-circle-play', `${n.toLocaleString('fa-IR')} پارت — دیده نشده`));
  }
  // quiz
  if (r.quizzes && r.quizzes.length) {
    const q = r.quizzes[0];
    const sub = (r.quizSubmissions && r.quizSubmissions[0]) || null;
    if (r.quizPassed || (sub && sub.score >= 50)) pills.push(urpPill('ok', 'fa-check-double', `آزمون قبول${sub && sub.score != null ? ` (${Number(sub.score).toLocaleString('fa-IR')})` : ''}`, q.title));
    else if (sub) pills.push(urpPill('bad', 'fa-xmark', `آزمون مردود (${Number(sub.score || 0).toLocaleString('fa-IR')})`, q.title));
    else pills.push(urpPill('wait', 'fa-clock', 'آزمون: شرکت نکرده', q.title));
  }
  // challenge
  if (r.challenge) {
    const ch = r.challenge;
    const s = r.challengeSubmission && r.challengeSubmission.status;
    if (s === 'approved') pills.push(urpPill('ok', 'fa-trophy', `چالش تأیید (+${Number(ch.rewardZarik || 50).toLocaleString('fa-IR')})`, ch.title));
    else if (s === 'pending') pills.push(urpPill('wait', 'fa-hourglass-half', 'چالش در انتظار ارزیابی', ch.title));
    else if (s === 'rejected') pills.push(urpPill('bad', 'fa-rotate-left', 'چالش نیازمند اصلاح', ch.title));
    else pills.push(urpPill('none', 'fa-trophy', `چالش انجام نشده (${ch.type === 'quiz' ? 'کوئیز' : ch.type === 'file' ? 'فایلی' : 'مهارتی'})`, ch.title));
  }
  return pills.join('');
}

window.renderDrawerClassProgressTable = function() {
  const box = document.getElementById('drawer-class-progress-list');
  if (!box) return;
  const rows = window.cachedDrawerClassRows || [];
  const filterType = window.activeDrawerClassFilter || 'all';
  const searchVal = (document.getElementById('drawer-class-search-input')?.value || '').trim().toLowerCase();

  const filtered = rows.filter(r => {
    if (filterType === 'classes' && (!r.sessionId || r.type === 'challenge_only')) return false;
    if (filterType === 'parts' && (!r.clips || r.clips.length === 0) && !r.sessionId) return false;
    if (filterType === 'stations' && (!r.stationTitle || r.stationNumber === '-')) return false;
    if (filterType === 'quizzes' && (!r.quizzes || r.quizzes.length === 0)) return false;
    if (filterType === 'challenges' && !r.challenge) return false;
    if (searchVal) {
      const hay = [r.stationTitle, r.categoryTitle, r.sessionTitle, r.challenge && r.challenge.title]
        .concat((r.clips || []).map(c => c.title), (r.quizzes || []).map(q => q.title));
      if (!hay.some(v => String(v || '').toLowerCase().includes(searchVal))) return false;
    }
    return true;
  });

  if (!filtered.length) {
    box.innerHTML = '<div class="lst-empty">اطلاعاتی متناسب با فیلتر یافت نشد.</div>';
    return;
  }

  // One card per station (general / caravan challenges last), rows inside
  const groups = new Map();
  filtered.forEach(r => {
    const key = r.stationNumber && r.stationNumber !== '-' ? 'st:' + r.stationNumber : 'general';
    if (!groups.has(key)) groups.set(key, { key, number: r.stationNumber, title: r.stationTitle, rows: [] });
    groups.get(key).rows.push(r);
  });
  const fa = n => Number(n || 0).toLocaleString('fa-IR');
  box.innerHTML = Array.from(groups.values()).map(g => {
    const avg = Math.round(g.rows.reduce((s, r) => s + (r.progressPct || 0), 0) / g.rows.length);
    const done = g.rows.filter(r => r.isCompleted).length;
    const general = g.key === 'general';
    return `
      <section class="lse-card urp-station">
        <header class="urp-station-head">
          <span class="lsv-row-avatar lsv-row-num">${general ? '<i class="fa-solid fa-layer-group"></i>' : fa(g.number)}</span>
          <span class="lsv-row-text"><strong>${esc(general ? 'چالش‌های کاروان / عمومی' : g.title)}</strong><span>${fa(done)} از ${fa(g.rows.length)} مورد کامل</span></span>
          <span class="urp-pct ${avg === 100 ? 'is-done' : avg > 0 ? 'is-going' : ''}">${fa(avg)}٪</span>
        </header>
        <div class="urp-rows">${g.rows.map(r => {
          const pct = r.progressPct || 0;
          const tone = pct === 100 ? 'lst-bar-active' : pct >= 50 ? 'urp-bar-mid' : 'urp-bar-low';
          const title = r.sessionId ? r.sessionTitle : (r.challenge ? r.challenge.title : r.sessionTitle);
          return `
          <div class="urp-row${r.isCompleted ? ' is-done' : ''}">
            <div class="urp-row-main">
              <i class="fa-solid ${r.isCompleted ? 'fa-circle-check' : r.sessionId ? 'fa-chalkboard-user' : 'fa-trophy'}"></i>
              <span><strong>${esc(title || '-')}</strong>${r.categoryTitle && r.categoryTitle !== '-' ? `<small>${esc(r.categoryTitle)}</small>` : ''}</span>
              <span class="urp-row-pct">${pct === 100 ? 'تکمیل شده' : pct > 0 ? fa(pct) + '٪' : 'شروع نشده'}</span>
            </div>
            <span class="lst-bar urp-row-bar"><span class="${tone}" data-style="width:${pct}%"></span></span>
            <div class="urp-pills">${urpRowPills(r) || '<span class="urp-pill is-none">بدون جلسه ثبت‌شده</span>'}</div>
          </div>`;
        }).join('')}</div>
      </section>`;
  }).join('');
};

window.filterDrawerClassProgress = function(filterType) {
  if (filterType) {
    window.activeDrawerClassFilter = filterType;
    document.querySelectorAll('#drawer-class-filter-chips .chm-chip').forEach(btn => {
      const on = btn.id === `btn-prog-filter-${filterType}`;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', String(on));
    });
  }
  window.renderDrawerClassProgressTable();
};

// Block / Unblock User
async function toggleBlockUser(userId, blockStatus) {
  try {
    const res = await request(`/api/v1/admin/users/${userId}/block`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocked: blockStatus })
    });
    if (res.ok) {
      // «لغو» within 10s blocks / unblocks the user back
      NopaUndo.afterEdit({
        message: blockStatus ? 'کاربر مسدود شد.' : 'مسدودیت کاربر برداشته شد.',
        url: `/api/v1/admin/users/${userId}/block`,
        method: 'PATCH',
        revert: { blocked: !blockStatus },
        done: () => loadUsers(),
      });
      loadUsers();
    }
  } catch (err) {
    console.error(err);
  }
}

// Delete User
async function deleteUser(userId) {
  if (!(await NopaConfirm('آیا از حذف دائم این کاربر اطمینان دارید؟ پس از ۱۰ ثانیه دیگر قابل بازگشت نیست.'))) return;
  // Gone from the list (its open page closes) at once; deleted on the server only if not undone within 10s.
  // The server still has the user until then, so «لغو» just loads the list again.
  const u = (window.usrList || []).find(x => String(x.id) === String(userId));
  NopaUndo.later({
    message: `کاربر «${(u && u.name) || ''}» حذف شد.`,
    hide: () => {
      window.usrList = (window.usrList || []).filter(x => String(x.id) !== String(userId));
      if (String(window.usrActiveId) === String(userId) && typeof window.closeUserView === 'function') window.closeUserView();
      if (typeof window.filterUsersList === 'function') window.filterUsersList();
      return () => loadUsers();
    },
    commit: () => request(`/api/v1/admin/users/${userId}`, { method: 'DELETE' }),
    done: () => loadUsers(),
  });
}

// Open Password Override Dialog
function openPasswordOverride(userId) {
  const newPass = prompt('گذرواژه جدید کاربر را وارد کنید:');
  if (!newPass) return;
  
  request(`/api/v1/admin/users/${userId}/override-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: newPass })
  }).then(async res => {
    const data = await res.json();
    if (res.ok) {
      showToast('گذرواژه با موفقیت تغییر کرد', 'success');
    } else {
      showToast(data.error);
    }
  });
}

// Add/Edit User Modal
window.openUserModal = async function(id = '', name = '', role = 'student', caravanId = '', levelFrame = 1, mentorLevel = 1, nationalId = '', dateOfBirth = '') {
  let user = null;
  if (id) {
    try {
      const res = await request(`/api/v1/admin/users/${id}`);
      if (res.ok) user = await res.json();
    } catch(e) {
      console.warn('Could not fetch user details from API, using arguments');
    }
  }

  const userId = id || user?.id || '';
  const userName = user?.name || name || '';
  const userPhone = user?.phoneNumber || '';
  const userRole = user?.role || role || 'student';
  const userCaravanId = user?.caravanId !== undefined ? (user?.caravanId || '') : (caravanId || '');
  const userLevel = user?.levelFrame || levelFrame || 1;
  const userMentorLevel = user?.mentorLevel || mentorLevel || 1;
  const userNationalId = user?.nationalId || nationalId || '';
  const userDob = user?.dateOfBirth || dateOfBirth || '';

  document.getElementById('edit-user-id').value = userId;
  // identity fields (js/ui/person-fields.js) — remembers the loaded phone so an untouched one is not re-sent
  NopaPersonFields.fill('modal-user', {
    name: userName, phoneNumber: userId ? userPhone : '', nationalId: userNationalId, dateOfBirth: userDob, gender: user?.gender || ''
  });
  document.getElementById('modal-user-role').value = userRole;
  setupUserModalAccessControls(userRole, user?.panelAccess ?? null);
  // levels are the stations in path order (js/features/levels.js)
  const levelSelect = document.getElementById('modal-user-level');
  if (levelSelect) {
    levelSelect.innerHTML = typeof window.lvlLevelOptionsHtml === 'function'
      ? window.lvlLevelOptionsHtml(userLevel)
      : `<option value="${Number(userLevel) || 1}">سطح ${Number(userLevel) || 1}</option>`;
    levelSelect.value = String(userLevel);
  }
  document.getElementById('modal-user-mentor-level').value = userMentorLevel;
  if (document.getElementById('modal-user-degree')) {
    document.getElementById('modal-user-degree').value = user?.academicDegree || '';
  }
  if (document.getElementById('modal-user-certificates')) {
    document.getElementById('modal-user-certificates').value = user?.academicCertificates || '';
  }

  // Populate Caravan Options in User Modal
  const caravanSelect = document.getElementById('modal-user-caravan');
  if (caravanSelect) {
    let options = '<option value="">فاقد کاروان</option>';
    const caravans = window.caravansData || window.caravansMasterList || caravansList || [];
    if (caravans.length > 0) {
      options += caravans.map(c => `<option value="${c.id}" ${c.id === userCaravanId ? 'selected' : ''}>${esc(c.name || c.title)}</option>`).join('');
    }
    caravanSelect.innerHTML = options;
    caravanSelect.value = userCaravanId;
  }

  const phoneGroup = document.getElementById('phone-field-group');
  const passGroup = document.getElementById('password-field-group');
  const mentorLevelGroup = document.getElementById('mentor-level-group');
  const title = document.getElementById('modal-user-title');

  // Toggle mentor level dropdown based on role
  if (mentorLevelGroup) mentorLevelGroup.style.display = userRole === 'mentor' ? '' : 'none';
  document.getElementById('modal-user-role').onchange = (e) => {
    if (mentorLevelGroup) mentorLevelGroup.style.display = e.target.value === 'mentor' ? '' : 'none';
  };

  if (userId) {
    if (title) title.textContent = `ویرایش همسفر: ${userName}`;
    if (phoneGroup) phoneGroup.style.display = '';
    if (passGroup) passGroup.style.display = 'none';
    const phoneInput = document.getElementById('modal-user-phone');
    if (phoneInput) {
      phoneInput.removeAttribute('required');
      phoneInput.value = userPhone;
    }
    document.getElementById('modal-user-password')?.removeAttribute('required');
  } else {
    if (title) title.textContent = 'همسفر جدید';
    if (phoneGroup) phoneGroup.style.display = '';
    if (passGroup) passGroup.style.display = '';
    const phoneInput = document.getElementById('modal-user-phone');
    if (phoneInput) {
      phoneInput.setAttribute('required', 'true');
      phoneInput.value = '';
    }
    const passInput = document.getElementById('modal-user-password');
    if (passInput) {
      passInput.setAttribute('required', 'true');
      passInput.value = '';
    }
  }

  const modal = document.getElementById('user-modal-overlay');
  if (modal) {
    modal.style.display = 'flex';
    const icon = modal.querySelector('.lse-id-icon i');
    if (icon) icon.className = userId ? 'fa-solid fa-user-pen' : 'fa-solid fa-user-plus';
    modal.style.zIndex = 'var(--z-modal)';
  }
};

async function handleUserFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('edit-user-id').value;
  if (!NopaPersonFields.validate('modal-user', { requirePhone: !id })) return;
  // normalised (Latin digits, 09…); phoneNumber is undefined when an edit left it untouched
  const { name, phoneNumber, nationalId, dateOfBirth, gender } = NopaPersonFields.read('modal-user');
  const role = document.getElementById('modal-user-role').value;
  const caravanId = document.getElementById('modal-user-caravan').value;
  const levelFrame = parseInt(document.getElementById('modal-user-level').value) || 1;
  const mentorLevel = parseInt(document.getElementById('modal-user-mentor-level').value) || 1;
  const academicDegree = document.getElementById('modal-user-degree')?.value;
  const academicCertificates = document.getElementById('modal-user-certificates')?.value;

  let res;
  let editBody = null;
  if (id) {
    // Edit User
    editBody = { name, phoneNumber, role, caravanId: caravanId || null, levelFrame, mentorLevel, nationalId, dateOfBirth, gender, academicDegree, academicCertificates };
    res = await request(`/api/v1/admin/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editBody)
    });
  } else {
    // Create User
    const password = document.getElementById('modal-user-password').value;
    res = await request('/api/v1/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phoneNumber, password, role, caravanId: caravanId || null, levelFrame, mentorLevel, nationalId, dateOfBirth, gender })
    });
  }

  const data = await res.json();
  if (res.ok) {
    await saveUserPanelAccess(id || data.userId);
    document.getElementById('user-modal-overlay').style.display = 'none';
    const refresh = async () => {
      if (typeof loadUsers === 'function') loadUsers();
      if (typeof window.lvlInvalidate === 'function') window.lvlInvalidate();
      if (typeof loadAllUsersDropdown === 'function') loadAllUsersDropdown();
      if (typeof loadCaravansTab === 'function') await loadCaravansTab();
      if (typeof window.loadSelectedCaravanDetails === 'function') window.loadSelectedCaravanDetails();
    };
    const old = id ? ((window.usrList || []).find(u => String(u.id) === String(id)) || (typeof nopaFindPerson === 'function' ? nopaFindPerson(id) : null)) : null;
    if (old && editBody) {
      // «لغو» within 10s sends the changed details back (panel access is kept as chosen)
      NopaUndo.afterEdit({
        message: data.message || 'مشخصات کاربر ذخیره شد.',
        url: `/api/v1/admin/users/${id}`,
        body: editBody,
        before: old,
        done: refresh,
      });
    } else {
      showToast(data.message || 'مشخصات کاربر با موفقیت ذخیره شد', 'success');
    }
    await refresh();
  } else {
    showToast(data.error || 'خطا در ثبت اطلاعات', 'error');
  }
}

// ==========================================
// Online / last seen (GET /admin/users/:id/presence, also inside the analytics payload), the activity chart
// (js/ui/activity-chart.js) and the person's two pictures: the app one (picked by the person in the app) and the
// site one (set here, in place, with NopaPhoto). Shared by the همسفران page (audience.js), the mentor page
// (mentors.js) and the full report above.
// ==========================================
const nopaPresenceCache = new Map(); // userId -> { at, data: { presence, usage } }

function nopaAgo(at) {
  if (!at) return 'نامشخص';
  const t = new Date(at).getTime();
  if (!t) return 'نامشخص';
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 1) return 'همین الان';
  if (min < 60) return `${crvFa(min)} دقیقه پیش`;
  const h = Math.round(min / 60);
  if (h < 24) return `${crvFa(h)} ساعت پیش`;
  const d = Math.round(h / 24);
  if (d < 30) return `${crvFa(d)} روز پیش`;
  return new Date(t).toLocaleDateString('fa-IR');
}
window.nopaPresenceChip = function(p) {
  if (!p) return '<span class="nop-presence-chip"><i class="fa-solid fa-circle"></i> …</span>';
  return p.online
    ? '<span class="nop-presence-chip is-online"><i class="fa-solid fa-circle"></i> آنلاین</span>'
    : `<span class="nop-presence-chip"><i class="fa-solid fa-circle"></i> آفلاین · آخرین حضور ${esc(nopaAgo(p.lastSeenAt))}</span>`;
};

/** Fills every [data-presence-for="<id>"] on the page with the online chip; cached for a minute. */
window.nopaFillPresence = async function(userId, seed) {
  const id = String(userId || '');
  if (!id) return;
  if (seed && seed.presence) nopaPresenceCache.set(id, { at: Date.now(), data: { presence: seed.presence, usage: seed.usage } });
  const slots = () => document.querySelectorAll(`[data-presence-for="${CSS.escape(id)}"]`);
  const paint = data => slots().forEach(el => { el.innerHTML = window.nopaPresenceChip(data && data.presence); });
  const hit = nopaPresenceCache.get(id);
  if (hit && Date.now() - hit.at < 60000) return paint(hit.data);
  paint(hit ? hit.data : null);
  try {
    const data = await NopaApi.json(`/api/v1/admin/users/${encodeURIComponent(id)}/presence`, { silent: true });
    nopaPresenceCache.set(id, { at: Date.now(), data });
    paint(data);
  } catch (_) {
    slots().forEach(el => { el.innerHTML = ''; });
  }
};
window.nopaPresenceSlot = function(userId) {
  return `<div class="nop-presence" data-presence-for="${esc(userId)}">${window.nopaPresenceChip(null)}</div>`;
};

/** The activity chart of one person, drawn into host (kept as it is when drawn again for the same person). */
window.nopaPersonChart = function(host, where, userId) {
  if (!host || !window.NopaActivity) return;
  NopaActivity.render(host, `${where}:chart`, { params: { userId: String(userId) }, title: 'نمودار فعالیت' });
  // the detailed log of what the person did in the app, right under the chart (js/ui/activity-log.js)
  if (!window.NopaActivityLog) return;
  let logHost = host.nextElementSibling;
  if (!logHost || !logHost.classList.contains('nal-host')) {
    logHost = document.createElement('div');
    logHost.className = 'nal-host';
    host.after(logHost);
  }
  NopaActivityLog.render(logHost, userId);
};

// ---- the site picture ----
let urpLastPayload = null;
function nopaPersonLists() {
  const lists = [window.usrList, window.mentorsMasterList, window.caravansData, urpLastPayload];
  if (typeof usrAnalyticsCache !== 'undefined') lists.push(Array.from(usrAnalyticsCache.values()));
  if (typeof mntDossierCache !== 'undefined') lists.push(Array.from(mntDossierCache.values()));
  return lists;
}
function nopaWalk(value, fn, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 8) return;
  if (Array.isArray(value)) { value.forEach(v => nopaWalk(v, fn, depth + 1)); return; }
  fn(value);
  Object.keys(value).forEach(k => { if (value[k] && typeof value[k] === 'object') nopaWalk(value[k], fn, depth + 1); });
}
function nopaFindPerson(id) {
  let found = null;
  nopaWalk(nopaPersonLists(), o => { if (!found && String(o.id) === String(id) && 'avatarUrl' in o && o.name) found = o; });
  return found;
}

/** The person's picture as a button that opens the picture editor right under it (where = usr | mnt | urp). */
window.nopaPersonPhoto = function(person, where, cls) {
  const name = person.name || '';
  return `<button type="button" class="nph-trigger" data-click="openPersonSitePhoto" data-click-args="${crvArgs(person.id, where)}" title="تغییر عکس سایت" aria-label="تغییر عکس سایت">
      ${crvAvatar(person.avatarUrl, name, cls)}
      <span class="nph-trigger-badge"><i class="fa-solid fa-camera"></i></span>
    </button>
    ${NopaPhoto.slot(`${where}:${person.id}`)}`;
};

window.openPersonSitePhoto = function(userId, where) {
  const p = nopaFindPerson(userId);
  if (!p) return showToast('اطلاعات این شخص پیدا نشد؛ صفحه را دوباره باز کنید.', 'error');
  NopaPhoto.toggle(`${where || 'usr'}:${userId}`, {
    name: p.name,
    current: p.siteAvatarUrl || '',
    app: p.appAvatarUrl !== undefined ? (p.appAvatarUrl || '') : (p.siteAvatarUrl ? '' : (p.avatarUrl || '')),
    hint: 'عکس سایت فقط در پنل دیده می‌شود؛ اپ همان عکسی را نشان می‌دهد که خود کاربر انتخاب کرده.',
    onSave: async url => {
      const oldUrl = p.siteAvatarUrl || '';
      const show = next => {
        nopaWalk(nopaPersonLists(), o => {
          if (String(o.id) !== String(userId) || !('avatarUrl' in o)) return;
          if (o.appAvatarUrl === undefined) o.appAvatarUrl = o.siteAvatarUrl ? null : o.avatarUrl;
          o.siteAvatarUrl = next;
          o.avatarUrl = next || o.appAvatarUrl || null;
        });
        // redraw whatever shows this person
        if (urpUserId === String(userId) && urpLastPayload) urpPaint(urpLastPayload);
        if (String(window.usrActiveId) === String(userId) && typeof window.loadUserPage === 'function') window.loadUserPage();
        if (String(window.mntActiveMentorId) === String(userId) && typeof window.loadMentorPage === 'function') window.loadMentorPage();
      };
      await NopaApi.json(`/api/v1/admin/users/${encodeURIComponent(userId)}/site-avatar`, { method: 'PUT', body: JSON.stringify({ url }) });
      NopaPhoto.close();
      show(url);
      // «لغو» within 10s puts the old site picture back
      NopaUndo.afterEdit({
        message: url ? 'عکس سایت تغییر کرد.' : 'عکس سایت حذف شد.',
        url: `/api/v1/admin/users/${encodeURIComponent(userId)}/site-avatar`,
        body: { url: url || '' },
        before: { url: oldUrl },
        done: ok => { if (ok) show(oldUrl || null); },
      });
    },
  });
};
