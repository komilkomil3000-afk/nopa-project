// LMS stations tab views: the bento overview (all stations + stats, status, quick access, upcoming unlocks,
// instructors, what still needs completing) and the single-station view (station strip, info, parts by
// category, instructors). Styles: css/stations.css. Data: window.lmsStationsMasterList (directory.js) and
// window.globalInstructorsList (instructors.js); both re-render this view when they reload.

window.lmsActiveStationId = null;

const LMS_VIDEO_EXT = /\.(mp4|webm|mov|m4v|m3u8|mkv)(\?|#|$)/i;

function lmsStationGallery(st) {
  if (Array.isArray(st.animations) && st.animations.length) return st.animations;
  if (st.animationsJson) {
    try {
      const parsed = typeof st.animationsJson === 'string' ? JSON.parse(st.animationsJson) : st.animationsJson;
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
  }
  return st.animationUrl ? [{ url: st.animationUrl, title: st.animationTitle }] : [];
}

// The station's picture: its icon, else the first gallery picture (a video entry's cover), else none
function lmsStationImage(st) {
  for (const key of ['iconUrl', 'imageUrl']) {
    const v = String(st[key] || '').trim();
    if (v) return v;
  }
  for (const item of lmsStationGallery(st)) {
    if (item.coverImageUrl) return item.coverImageUrl;
    const url = item.url || item.videoUrl;
    if (url && !LMS_VIDEO_EXT.test(url)) return url;
  }
  return '';
}

// ---- The app's home-screen station card (app/lib/widgets/station_card.dart, models/station.dart) ----

// Station.getPureName: the title without its "منزلگاه N" prefix and parentheses
const LMS_PURE_STATION_NAMES = ['آغاز راه', 'کاروانسرای غبارگرفته', 'معدن زیرزمینی', 'قلعه', 'دهکده ساحلی', 'فانوس دریایی'];
function lmsPureStationName(number, title) {
  const original = String(title || '').trim();
  if (original) {
    const clean = original
      .replace(/منزلگاه\s+[؀-ۿ\d]+\s*[(:–-]?\s*/g, '')
      .replace(/[()]/g, '')
      .trim();
    return clean || original;
  }
  if (number >= 0 && number < LMS_PURE_STATION_NAMES.length) return LMS_PURE_STATION_NAMES[number];
  return `ایستگاه ${number}`;
}

function lmsFaDigits(n) {
  return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
}

// A circle / cover picture that fails to load shows the station number (or the pin icon) instead
window.lmsImageFallback = function(img, label) {
  if (!img || !img.parentElement) return;
  const holder = document.createElement(label ? 'span' : 'i');
  if (label) holder.textContent = label; else holder.className = 'fa-solid fa-location-dot';
  img.replaceWith(holder);
};

// A picture that fails to load shows the app's "no image" icon instead
window.lmsStationImageFailed = function(img) {
  if (!img || img.classList.contains('app-station-noimg')) return;
  img.classList.add('app-station-noimg');
  img.src = '/admin/icons/stations/imagenot01.svg';
};

function lmsStationNumber(st, i) {
  return st.orderIndex ?? st.index ?? (i + 1);
}

function lmsStationState(st) {
  const scheduled = Boolean(st.scheduledUnlockTime && new Date() < new Date(st.scheduledUnlockTime));
  if (st.isLocked || st.status === 'locked') return scheduled ? 'scheduled' : 'locked';
  if (scheduled || st.isTimeLocked) return 'scheduled';
  return 'active';
}

function lmsStateChip(state) {
  if (state === 'locked') return '<span class="lst-chip lst-chip-locked"><i class="fa-solid fa-lock"></i> قفل</span>';
  if (state === 'scheduled') return '<span class="lst-chip lst-chip-scheduled"><i class="fa-regular fa-clock"></i> زمان‌بندی‌شده</span>';
  return '<span class="lst-chip lst-chip-active"><i class="fa-solid fa-lock-open"></i> فعال</span>';
}

function lmsSplitInstructors(value) {
  return String(value || '').split(/[،,]/).map(s => s.trim()).filter(Boolean);
}

function lmsNormName(name) {
  return String(name || '').replace(/‌/g, '').replace(/\s+/g, '').toLowerCase();
}

function lmsFindInstructor(name) {
  const n = lmsNormName(name);
  return (window.globalInstructorsList || []).find(i => lmsNormName(i.name) === n) || null;
}

function lmsAvatar(inst, name) {
  if (inst && inst.avatarUrl) return `<img class="lst-avatar" src="${esc(inst.avatarUrl)}" alt="${esc(name)}">`;
  return '<span class="lst-avatar"><i class="fa-solid fa-chalkboard-user"></i></span>';
}

function lmsFaDate(value) {
  try { return new Date(value).toLocaleDateString('fa-IR'); } catch (_) { return ''; }
}

function lmsArgs(...a) {
  return esc(JSON.stringify(a.map(String)));
}

// Sessions (not deleted), parts, quizzes and instructors of one station
function lmsStationSummary(st) {
  const cats = window.lmsOrderedCategories(st);
  let sessions = 0, parts = 0, quizzes = 0, emptySessions = 0;
  const instructors = new Map(); // name -> { sessions, categories:Set }
  cats.forEach(c => {
    (c.sessions || []).filter(s => !s.isDeleted).forEach(s => {
      sessions++;
      const clips = s.videoClips || [];
      parts += clips.length;
      if (!clips.length) emptySessions++;
      quizzes += (s.quizzes || []).length;
      clips.forEach(clip => { quizzes += (clip.quizzes || []).length; });
      lmsSplitInstructors(s.instructor).forEach(name => {
        const rec = instructors.get(name) || { sessions: 0, categories: new Set() };
        rec.sessions++;
        rec.categories.add(c.title || '');
        instructors.set(name, rec);
      });
    });
  });
  return { categories: cats.length, sessions, parts, quizzes, emptySessions, instructors };
}

// Back face of a station card (flips in on hover): its instructors and its class categories, in short
const LMS_BACK_MAX_INSTRUCTORS = 3;
const LMS_BACK_MAX_CATEGORIES = 4;
function lmsStationCardBack(st, num, sum) {
  const instructors = Array.from(sum.instructors.entries()).sort((a, b) => b[1].sessions - a[1].sessions);
  const instHtml = instructors.length
    ? instructors.slice(0, LMS_BACK_MAX_INSTRUCTORS).map(([name, rec]) => `
        <span class="lst-back-row">
          ${lmsAvatar(lmsFindInstructor(name), name)}
          <span class="lst-back-name">${esc(name)}</span>
          <em>${rec.sessions} جلسه</em>
        </span>`).join('') +
      (instructors.length > LMS_BACK_MAX_INSTRUCTORS ? `<span class="lst-back-more">+${instructors.length - LMS_BACK_MAX_INSTRUCTORS} استاد دیگر</span>` : '')
    : '<span class="lst-back-empty">هنوز استادی تعیین نشده</span>';

  const cats = window.lmsOrderedCategories(st);
  const catHtml = cats.length
    ? cats.slice(0, LMS_BACK_MAX_CATEGORIES).map((c, ci) => {
        const sessions = (c.sessions || []).filter(s => !s.isDeleted);
        const parts = sessions.reduce((n, s) => n + (s.videoClips || []).length, 0);
        return `
        <span class="lst-back-row">
          <span class="lst-back-dot" data-style="color:${window.lmsCategoryColor(ci)}"></span>
          <span class="lst-back-name">${esc(c.title || `دسته ${ci + 1}`)}</span>
          <em>${sessions.length} جلسه · ${parts} پارت</em>
        </span>`;
      }).join('') +
      (cats.length > LMS_BACK_MAX_CATEGORIES ? `<span class="lst-back-more">+${cats.length - LMS_BACK_MAX_CATEGORIES} بخش دیگر</span>` : '')
    : '<span class="lst-back-empty">هنوز بخشی تعریف نشده</span>';

  return `
    <span class="app-station-card lst-flip-back" aria-hidden="true">
      <span class="app-station-inner lst-back">
        <span class="lst-back-head">
          <span class="app-station-num">${lmsFaDigits(num)}</span>
          <span class="lst-back-title">${esc(lmsPureStationName(num, st.title))}</span>
        </span>
        <span class="lst-back-label"><i class="fa-solid fa-chalkboard-user"></i> اساتید</span>
        <span class="lst-back-list">${instHtml}</span>
        <span class="lst-back-label"><i class="fa-solid fa-layer-group"></i> بخش‌ها</span>
        <span class="lst-back-list">${catHtml}</span>
        <span class="lst-back-foot">برای ورود بزنید <i class="fa-solid fa-arrow-left"></i></span>
      </span>
    </span>`;
}

// ==================== OVERVIEW (BENTO) ====================

window.renderLmsStationsBento = function(list) {
  // a drag in progress owns the DOM; it re-renders when it drops (js/features/lms/station-dnd.js)
  if (window.lmsDragActive) { window.lmsRenderPending = true; return; }
  const overview = document.getElementById('lms-overview-view');
  const draw = () => lmsDrawBento(list);
  if (window.NopaFlip && overview) window.NopaFlip.render(overview, draw); else draw();
  if (window.lmsActiveStationId) window.renderLmsStationView();
};

function lmsDrawBento(list) {
  const all = window.lmsStationsMasterList || [];
  const shown = list || all;

  const grid = document.getElementById('lms-bento-stations');
  if (grid) {
    const cards = shown.map((st, i) => {
      const num = lmsStationNumber(st, all.indexOf(st) >= 0 ? all.indexOf(st) : i);
      // the same picture as the circles and the cover in the station page (icon, else the first gallery picture)
      const img = lmsStationImage(st);
      const sum = lmsStationSummary(st);
      const state = lmsStationState(st);
      const locked = state !== 'active';
      // The card's front is the app's home-screen StationCard and its back (shown on hover) the station's
      // instructors and categories; the admin counts and status sit under it
      return `
        <button type="button" class="lst-station-card" data-station-id="${esc(st.id)}" data-anim-key="st:${esc(st.id)}" data-click="openLmsStationView" data-click-args="${lmsArgs(st.id)}" title="ورود به ${esc(st.title || '')}">
          <span class="lst-flip"><span class="lst-flip-inner">
          <span class="app-station-card">
            <span class="app-station-inner">
              <span class="app-station-image">
                ${img ? `<img src="${esc(img)}" alt="" loading="lazy" data-error="lmsStationImageFailed" data-error-args='["$this"]'>` : '<img class="app-station-noimg" src="/admin/icons/stations/imagenot01.svg" alt="">'}
                ${locked ? '<span class="app-station-shade"></span>' : ''}
                <span class="app-station-lock${locked ? ' is-locked' : ''}"><img src="/admin/icons/stations/${locked ? 'lock02' : 'lock01'}.svg" alt="${locked ? 'قفل' : 'باز'}"></span>
                <span class="lst-station-grip" title="برای جابجایی بکشید" aria-hidden="true"><i class="fa-solid fa-grip"></i></span>
              </span>
              <span class="app-station-divider"></span>
              <span class="app-station-bar">
                <span class="app-station-num">${lmsFaDigits(num)}</span>
                <span class="app-station-title">${esc(lmsPureStationName(num, st.title))}</span>
              </span>
            </span>
          </span>
          ${lmsStationCardBack(st, num, sum)}
          </span></span>
          <span class="lst-station-meta">
            ${lmsStateChip(state)}
            <span>${sum.categories} دسته · ${sum.sessions} جلسه · ${sum.parts} پارت</span>
          </span>
        </button>`;
    });
    if (!list || list === all) {
      cards.push(`
        <button type="button" class="lst-station-card lst-station-card-add" data-anim-key="st-add" data-click="openCreateStationModal" title="ایجاد منزلگاه جدید">
          <span class="app-station-card">
            <span class="app-station-inner app-station-add">
              <i class="fa-solid fa-plus"></i>
              <span>منزلگاه جدید</span>
            </span>
          </span>
        </button>`);
    } else if (!shown.length) {
      cards.push('<div class="lst-empty" data-anim-key="st-empty">هیچ منزلگاهی با این جستجو یافت نشد.</div>');
    }
    grid.innerHTML = cards.join('');
  }

  // Access status
  const counts = { active: 0, scheduled: 0, locked: 0 };
  all.forEach(st => { counts[lmsStationState(st)]++; });
  const statusEl = document.getElementById('lms-bento-status');
  if (statusEl) {
    const total = all.length || 1;
    const pct = k => (counts[k] / total * 100).toFixed(1);
    statusEl.innerHTML = `
      <div class="lst-bar">
        <span class="lst-bar-active" data-style="width:${pct('active')}%"></span>
        <span class="lst-bar-scheduled" data-style="width:${pct('scheduled')}%"></span>
        <span class="lst-bar-locked" data-style="width:${pct('locked')}%"></span>
      </div>
      <div class="lst-legend">
        <div class="lst-legend-row"><span><span class="lst-dot lst-dot-active"></span>باز و فعال</span><strong>${counts.active}</strong></div>
        <div class="lst-legend-row"><span><span class="lst-dot lst-dot-scheduled"></span>در انتظار بازگشایی</span><strong>${counts.scheduled}</strong></div>
        <div class="lst-legend-row"><span><span class="lst-dot lst-dot-locked"></span>قفل</span><strong>${counts.locked}</strong></div>
      </div>`;
  }

  // Upcoming unlocks
  const upcomingEl = document.getElementById('lms-bento-upcoming');
  if (upcomingEl) {
    const now = new Date();
    const upcoming = all
      .filter(st => st.scheduledUnlockTime && new Date(st.scheduledUnlockTime) > now)
      .sort((a, b) => new Date(a.scheduledUnlockTime) - new Date(b.scheduledUnlockTime))
      .slice(0, 4);
    upcomingEl.innerHTML = upcoming.length
      ? `<ul class="lst-list">${upcoming.map(st => `
          <li class="lst-list-item lst-clickable" role="button" tabindex="0" data-click="openLmsStationView" data-click-args="${lmsArgs(st.id)}">
            <i class="fa-regular fa-calendar u-c-primary-text"></i>
            <span class="lst-grow"><strong>${esc(st.title || '')}</strong></span>
            <span>${lmsFaDate(st.scheduledUnlockTime)}</span>
          </li>`).join('')}</ul>`
      : '<div class="lst-empty">بازگشایی زمان‌بندی‌شده‌ای در پیش نیست.</div>';
  }

  // Instructors across all stations
  const instEl = document.getElementById('lms-bento-instructors');
  if (instEl) {
    const totals = new Map();
    all.forEach(st => {
      lmsStationSummary(st).instructors.forEach((rec, name) => {
        const t = totals.get(name) || { sessions: 0, stations: 0 };
        t.sessions += rec.sessions;
        t.stations++;
        totals.set(name, t);
      });
    });
    const top = Array.from(totals.entries()).sort((a, b) => b[1].sessions - a[1].sessions).slice(0, 4);
    instEl.innerHTML = top.length
      ? `<ul class="lst-list">${top.map(([name, t]) => `
          <li class="lst-list-item">
            ${lmsAvatar(lmsFindInstructor(name), name)}
            <span class="lst-grow"><strong>${esc(name)}</strong></span>
            <span>${t.sessions} جلسه · ${t.stations} منزلگاه</span>
          </li>`).join('')}</ul>`
      : '<div class="lst-empty">هنوز استادی به جلسات منزلگاه‌ها تخصیص داده نشده است.</div>';
  }

  // What still needs completing
  const healthEl = document.getElementById('lms-bento-health');
  if (healthEl) {
    const issues = [];
    all.forEach(st => {
      const sum = lmsStationSummary(st);
      const problems = [];
      if (!lmsStationImage(st)) problems.push('بدون تصویر');
      if (!sum.categories) problems.push('بدون دسته کلاس');
      else if (!sum.sessions) problems.push('بدون جلسه');
      if (sum.emptySessions) problems.push(`${sum.emptySessions} جلسه بدون پارت`);
      if (sum.sessions && !sum.instructors.size) problems.push('بدون استاد');
      if (problems.length) issues.push({ st, problems });
    });
    healthEl.innerHTML = issues.length
      ? `<ul class="lst-list">${issues.slice(0, 5).map(({ st, problems }) => `
          <li class="lst-list-item lst-clickable" role="button" tabindex="0" data-click="openLmsStationView" data-click-args="${lmsArgs(st.id)}">
            <i class="fa-solid fa-triangle-exclamation lst-warn"></i>
            <span class="lst-grow"><strong>${esc(st.title || '')}</strong>: ${esc(problems.join('، '))}</span>
          </li>`).join('')}</ul>`
      : '<div class="lst-empty"><i class="fa-solid fa-circle-check u-c-success-text"></i> همه منزلگاه‌ها کامل هستند.</div>';
  }
}

window.openLmsInstructorsBank = function() {
  if (window.NopaRouter) window.NopaRouter.switchTab('instructors-tab');
};

// ==================== SINGLE-STATION VIEW ====================
// Layout: one large board (title | station circles in a notch | round actions) holding the category columns
// as a connected flow, an add-category column; below it, station stats (right) and
// the station's instructors (left).

window.lmsAssignFormOpen = false;

window.lmsRenderedStationId = null;

// Fades el out (when it is showing and motion is allowed), then runs next
function lmsFadeOut(el, next) {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!el || el.style.display === 'none' || !el.getClientRects().length || reduce || typeof el.animate !== 'function') { next(); return; }
  const anim = el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-8px)' }], { duration: 170, easing: 'ease-in' });
  anim.onfinish = next;
}

window.openLmsStationView = function(stationId) {
  const overview = document.getElementById('lms-overview-view');
  window.lmsActiveStationId = String(stationId);
  lmsFadeOut(overview, () => {
    window.renderLmsStationView();
    document.getElementById('lms-tab')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
};

window.closeLmsStationView = function() {
  const view = document.getElementById('lms-station-view');
  const overview = document.getElementById('lms-overview-view');
  window.lmsActiveStationId = null;
  window.lmsRenderedStationId = null;
  lmsFadeOut(view, () => {
    if (window.lmsActiveStationId) return; // another station was opened meanwhile
    if (view) { view.style.display = 'none'; view.innerHTML = ''; }
    if (overview) {
      overview.style.display = '';
      if (window.NopaFlip) window.NopaFlip.enter(overview.querySelectorAll(':scope > div:first-child, .lst-bento > .lst-tile'));
    }
  });
};

window.toggleLmsAssignForm = function() {
  window.lmsAssignFormOpen = !window.lmsAssignFormOpen;
  window.renderLmsStationView();
};

function lmsRoundBtn(icon, title, click, args, extraClass = '') {
  return `<button type="button" class="lsv-round${extraClass ? ' ' + extraClass : ''}" data-click="${click}"${args ? ` data-click-args="${args}"` : ''} title="${esc(title)}" aria-label="${esc(title)}"${/is-disabled/.test(extraClass) ? ' disabled' : ''}><i class="${icon}"></i></button>`;
}

// SVG donut: segments [{ value, cls }] over total; the centre shows `label`
function lmsDonut(key, segments, total, label, caption) {
  let offset = 25; // start at 12 o'clock
  const rings = total > 0 ? segments.filter(s => s.value > 0).map(s => {
    const pct = s.value / total * 100;
    const ring = `<circle class="lsv-donut-seg ${s.cls}" cx="21" cy="21" r="15.915" fill="none" stroke-width="5" stroke-dasharray="${pct.toFixed(2)} ${(100 - pct).toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"></circle>`;
    offset -= pct;
    return ring;
  }).join('') : '';
  return `
    <figure class="lsv-donut">
      <svg viewBox="0 0 42 42" role="img" aria-label="${esc(caption)}">
        <circle class="lsv-donut-track" cx="21" cy="21" r="15.915" fill="none" stroke-width="5"></circle>
        ${rings}
      </svg>
      <span class="lsv-donut-label">${label}</span>
      <figcaption>${esc(caption)}</figcaption>
    </figure>`;
}

window.renderLmsStationView = function() {
  // a drag in progress owns the DOM; it re-renders when it drops
  if (window.lmsDragActive) { window.lmsRenderPending = true; return; }
  const view = document.getElementById('lms-station-view');
  const overview = document.getElementById('lms-overview-view');
  if (!view) return;
  const all = window.lmsStationsMasterList || [];
  const st = all.find(s => String(s.id) === String(window.lmsActiveStationId));
  if (!st) { window.closeLmsStationView(); return; }

  const num = lmsStationNumber(st, all.indexOf(st));
  const sum = lmsStationSummary(st);
  const img = lmsStationImage(st);
  const state = lmsStationState(st);
  const cats = window.lmsOrderedCategories(st);
  const sid = lmsArgs(st.id);

  // ---- station circles (notch at the top of the board); the last one, on the left, adds a station ----
  const circles = all.map((s, i) => {
    const sImg = lmsStationImage(s);
    const sNum = lmsStationNumber(s, i);
    const sName = s.title || `منزلگاه ${sNum}`;
    const active = String(s.id) === String(st.id);
    return `
      <button type="button" class="lsv-circle${active ? ' is-active' : ''}" data-station-id="${esc(s.id)}" data-anim-key="c:${esc(s.id)}" data-click="openLmsStationView" data-click-args="${lmsArgs(s.id)}" title="${esc(sName)}"${active ? ' aria-current="true"' : ''}>
        <span class="lsv-circle-main">
          <span class="lsv-circle-img">${sImg ? `<img src="${esc(sImg)}" alt="" loading="lazy" data-error="lmsImageFallback" data-error-args='["$this", "${sNum}"]'>` : `<span>${sNum}</span>`}</span>
          <span class="lsv-circle-badge lsv-state-${lmsStationState(s)}">${sNum}</span>
        </span>
        <span class="lsv-circle-name"><span>${esc(sName)}</span></span>
      </button>`;
  }).join('') + `
      <button type="button" class="lsv-circle lsv-circle-add" data-anim-key="c-add" data-click="openCreateStationModal" title="افزودن منزلگاه جدید" aria-label="افزودن منزلگاه جدید">
        <span class="lsv-circle-main">
          <span class="lsv-circle-img"><i class="fa-solid fa-plus"></i></span>
          <span class="lsv-circle-badge lsv-state-add"><i class="fa-solid fa-plus"></i></span>
        </span>
        <span class="lsv-circle-name"><span>افزودن منزلگاه جدید</span></span>
      </button>`;

  // ---- one column per category: its sessions as rows, then a "+" row ----
  const columns = cats.map((c, ci) => {
    const color = window.lmsCategoryColor(ci);
    const sessions = (c.sessions || []).filter(s => !s.isDeleted)
      .slice().sort((a, b) => (Number(a.orderIndex) || 0) - (Number(b.orderIndex) || 0));
    const rows = sessions.map((s, si) => {
      const clips = s.videoClips || [];
      let q = (s.quizzes || []).length;
      clips.forEach(clip => { q += (clip.quizzes || []).length; });
      const names = lmsSplitInstructors(s.instructor);
      const inst = names.length ? lmsFindInstructor(names[0]) : null;
      const lead = inst && inst.avatarUrl
        ? `<img class="lsv-row-avatar" src="${esc(inst.avatarUrl)}" alt="${esc(names[0])}">`
        : `<span class="lsv-row-avatar lsv-row-num">${si + 1}</span>`;
      const done = clips.length > 0;
      return `
        <div class="lsv-row" data-session-id="${esc(s.id)}" data-anim-key="row:${esc(s.id)}" role="button" tabindex="0" data-click="openStationContentManagerModal" data-click-args="${lmsArgs(st.id, `sess:${s.id}`)}" title="${esc([names.join('، '), s.sessionDate, s.sessionTime].filter(Boolean).join(' · ') || 'مدیریت پارت‌ها و آزمونک‌ها')}">
          <span class="lsv-row-grip" title="برای جابجایی بکشید" aria-hidden="true"><i class="fa-solid fa-grip-vertical"></i></span>
          ${lead}
          <span class="lsv-row-text">
            <strong>${esc(s.title || `جلسه ${si + 1}`)}</strong>
            <span>${clips.length} پارت · ${q} آزمونک</span>
          </span>
          <i class="lsv-row-state ${done ? 'fa-solid fa-check-double is-done' : 'fa-solid fa-ellipsis'}" title="${done ? 'دارای پارت ویدیو' : 'هنوز پارتی ندارد'}"></i>
          <button type="button" class="lsv-round lsv-round-sm lsv-row-del" data-click="lmsDeleteSessionFromView" data-click-args="${esc(JSON.stringify([String(s.id), String(st.id), '$event']))}" title="حذف جلسه" aria-label="حذف جلسه"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    }).join('');
    return `${ci > 0 ? `<div class="lsv-link" data-anim-key="link:${esc(c.id)}" aria-hidden="true"></div>` : ''}
      <div class="lsv-col" data-cat-col="${esc(c.id)}" data-anim-key="col:${esc(c.id)}">
        <div class="lsv-col-card" data-cat-id="${esc(c.id)}" data-anim-key="card:${esc(c.id)}" data-anim-size="h">
          <div class="lsv-col-tools">
            <span class="lsv-col-grip" title="برای جابجایی دسته بکشید" aria-hidden="true"><i class="fa-solid fa-grip-lines"></i></span>
            ${lmsRoundBtn('fa-solid fa-trash', 'حذف دسته', 'lmsDeleteCategoryFromView', lmsArgs(c.id, st.id), 'lsv-round-danger')}
          </div>
          ${rows || `<div class="lsv-col-empty">هنوز جلسه‌ای ندارد</div>`}
          <button type="button" class="lsv-row lsv-row-add" data-click="lmsAddSessionFromView" data-click-args="${lmsArgs(c.id, st.id)}">
            <span class="lsv-row-avatar lsv-row-plus"><i class="fa-solid fa-plus"></i></span>
            <span class="lsv-row-text"><strong>جلسه / پارت جدید</strong><span>افزودن به «${esc(c.title || '')}»</span></span>
          </button>
        </div>
        <div class="lsv-col-label"><span class="lsv-col-dot" data-style="background:${color}"></span> دسته ${ci + 1}: ${esc(c.title || '')} <span class="lsv-col-count">${sessions.length}</span></div>
      </div>`;
  }).join('');

  const addColumn = `
    <div class="lsv-col" data-anim-key="col-new">
      <div class="lsv-col-card lsv-col-new">
        <span class="lsv-round lsv-round-lg"><i class="fa-solid fa-plus"></i></span>
        <input type="text" id="lsv-new-cat-title" class="input-ctrl" placeholder="عنوان دسته جدید" aria-label="عنوان دسته کلاس جدید">
        <button type="button" class="lsv-pill" data-click="lmsAddCategoryFromView" data-click-args="${sid}">افزودن دسته</button>
      </div>
      <div class="lsv-col-label">دسته / بخش جدید</div>
    </div>`;

  const board = `
    <section class="lsv-board" data-anim-key="board" data-anim-size="h">
      <header class="lsv-board-head">
        <div class="lsv-board-title">
          <h4>بخش‌ها و پارت‌های منزلگاه</h4>
          <span>${sum.categories} دسته · ${sum.sessions} جلسه · ${sum.parts} پارت</span>
        </div>
        <div class="lsv-notch-wrap"><nav class="lsv-notch" aria-label="منزلگاه‌ها">${circles}</nav></div>
        <div class="lsv-round-group">
          ${lmsRoundBtn('fa-solid fa-pen', 'ویرایش مشخصات', 'editStationModal', sid)}
          ${lmsRoundBtn('fa-solid fa-key', 'دسترسی و بازگشایی', 'openStationAccessModal', sid)}
          ${lmsRoundBtn('fa-solid fa-film', 'مدیریت محتوا', 'openStationContentManagerModal', sid)}
          ${lmsRoundBtn('fa-solid fa-file-excel', 'خروجی اکسل', 'exportLmsToExcel')}
          ${lmsRoundBtn('fa-solid fa-trash', 'حذف منزلگاه', 'lmsDeleteActiveStation', sid, 'lsv-round-danger')}
        </div>
      </header>
      <div class="lsv-flow">
        ${columns}${cats.length ? '<div class="lsv-link" data-anim-key="link-new" aria-hidden="true"></div>' : ''}${addColumn}
      </div>
    </section>`;

  // ---- bottom right: station card + donuts ----
  const withParts = sum.sessions - sum.emptySessions;
  const catSegs = cats.map((c, ci) => ({ value: (c.sessions || []).filter(s => !s.isDeleted).length, cls: `lsv-seg-${ci % 4}` }));
  let releaseStr = '';
  if (st.releaseDate) releaseStr = lmsFaDate(st.releaseDate) + (st.releaseTime ? ` - ${esc(st.releaseTime)}` : '');
  const statsPanel = `
    <section class="lsv-panel" data-anim-key="panel-stats" data-anim-size="h">
      <header class="lsv-panel-head">
        <h4>وضعیت منزلگاه</h4>
        <div class="lsv-round-group">
          ${lmsRoundBtn('fa-solid fa-images', 'نگارستان', 'editStationModal', lmsArgs(st.id, 'gallery'))}
          ${lmsRoundBtn('fa-solid fa-key', 'دسترسی', 'openStationAccessModal', sid)}
        </div>
      </header>
      <div class="lsv-station-card">
        <div class="lsv-cover">${img ? `<img src="${esc(img)}" alt="" data-zoom data-zoom-title="${esc(st.title || '')}" data-error="lmsImageFallback" data-error-args='["$this", ""]'>` : '<i class="fa-solid fa-location-dot"></i>'}</div>
        <div class="lsv-station-text">
          <strong>${esc(st.title || `منزلگاه ${num}`)}</strong>
          ${st.subtitle ? `<span>${esc(st.subtitle)}</span>` : ''}
          ${lmsStateChip(state)}
          ${st.description ? `<p>${esc(st.description)}</p>` : ''}
        </div>
      </div>
      <div class="lsv-facts">
        <span><i class="fa-solid fa-hashtag"></i> منزلگاه ${num}</span>
        ${st.stayDuration ? `<span><i class="fa-solid fa-hourglass-half"></i> اقامت: ${esc(st.stayDuration)}</span>` : ''}
        ${releaseStr ? `<span><i class="fa-solid fa-calendar-days"></i> انتشار: ${releaseStr}</span>` : ''}
        ${st.scheduledUnlockTime ? `<span><i class="fa-regular fa-clock"></i> بازگشایی: ${lmsFaDate(st.scheduledUnlockTime)}</span>` : ''}
        ${st.requirePreviousComplete ? '<span><i class="fa-solid fa-link"></i> مشروط به منزلگاه قبلی</span>' : ''}
        <span><i class="fa-solid fa-images"></i> ${lmsStationGallery(st).length} تصویر</span>
        <span><i class="fa-solid fa-file-signature"></i> ${sum.quizzes} آزمونک</span>
      </div>
      <div class="lsv-donuts">
        ${lmsDonut('donut-done', [{ value: withParts, cls: 'lsv-seg-done' }], sum.sessions, `${withParts}<small>/${sum.sessions}</small>`, 'جلسات دارای پارت')}
        ${lmsDonut('donut-cats', catSegs, sum.sessions, `${sum.sessions}`, 'جلسات به تفکیک دسته')}
      </div>
      ${cats.length ? `<div class="lsv-legend">${cats.map((c, ci) => `<span><span class="lsv-col-dot lsv-seg-bg-${ci % 4}"></span>${esc(c.title || '')}</span>`).join('')}</div>` : ''}
    </section>`;

  // ---- bottom left: instructors table ----
  const bank = window.globalInstructorsList || [];
  const instRows = Array.from(sum.instructors.entries()).map(([name, rec]) => {
    const inst = lmsFindInstructor(name);
    return `
      <tr>
        <td><span class="lsv-person">${lmsAvatar(inst, name)}<span><strong>${esc(name)}</strong>${inst && inst.phoneNumber ? `<small dir="ltr">${esc(inst.phoneNumber)}</small>` : ''}</span></span></td>
        <td>${esc((inst && inst.degree) || '-')}</td>
        <td>${rec.sessions}</td>
        <td>${esc(Array.from(rec.categories).filter(Boolean).join('، ') || '-')}</td>
        <td>${inst ? '<span class="lsv-status is-ok">در بانک اساتید</span>' : '<span class="lsv-status is-warn">ثبت نشده</span>'}</td>
        <td><span class="lsv-round-group">
          ${inst
            ? lmsRoundBtn('fa-solid fa-user-pen', 'ویرایش اطلاعات استاد', 'openInstructorModal', lmsArgs(inst.id), 'lsv-round-sm')
            : lmsRoundBtn('fa-solid fa-user-plus', 'ثبت در بانک اساتید', 'openInstructorModal', '', 'lsv-round-sm')}
          ${lmsRoundBtn('fa-solid fa-user-minus', 'حذف از جلسات این منزلگاه', 'lmsRemoveInstructorFromStation', lmsArgs(st.id, name), 'lsv-round-sm lsv-round-danger')}
        </span></td>
      </tr>`;
  }).join('');

  const assignForm = window.lmsAssignFormOpen ? `
      <div class="lsv-assign">
        <select id="lsv-assign-inst" class="select-ctrl" aria-label="استاد">
          <option value="">انتخاب استاد از بانک اساتید...</option>
          ${bank.map(i => `<option value="${esc(i.name)}">${esc(i.name)}${i.degree ? ` (${esc(i.degree)})` : ''}</option>`).join('')}
        </select>
        <select id="lsv-assign-cat" class="select-ctrl" aria-label="جلسات مقصد">
          <option value="all">همه جلسات منزلگاه</option>
          ${cats.map(c => `<option value="${esc(c.id)}">فقط دسته «${esc(c.title || '')}»</option>`).join('')}
        </select>
        <button type="button" class="lsv-pill" data-click="lmsAssignInstructorToStation" data-click-args="${sid}"><i class="fa-solid fa-user-check"></i> تخصیص</button>
      </div>` : '';

  const instPanel = `
    <section class="lsv-panel" data-anim-key="panel-inst" data-anim-size="h">
      <header class="lsv-panel-head">
        <h4>اساتید این منزلگاه <span class="lsv-col-count">${sum.instructors.size}</span></h4>
        <div class="lsv-round-group">
          ${lmsRoundBtn('fa-solid fa-plus', 'تخصیص استاد به جلسات', 'toggleLmsAssignForm', '', window.lmsAssignFormOpen ? 'is-on' : '')}
          ${lmsRoundBtn('fa-solid fa-user-plus', 'ثبت استاد جدید', 'openInstructorModal')}
          ${lmsRoundBtn('fa-solid fa-address-book', 'بانک اساتید', 'openLmsInstructorsBank')}
        </div>
      </header>
      ${assignForm}
      ${instRows ? `
      <div class="lsv-table-wrap">
        <table class="lsv-table">
          <thead><tr><th>استاد</th><th>مدرک</th><th>جلسات</th><th>دسته‌ها</th><th>وضعیت</th><th>عملیات</th></tr></thead>
          <tbody>${instRows}</tbody>
        </table>
      </div>` : '<div class="lst-empty">هنوز استادی به جلسات این منزلگاه تخصیص داده نشده است. با دکمه + یکی را تخصیص دهید.</div>'}
    </section>`;

  const html = `
    <div class="lsv-head">
      ${lmsRoundBtn('fa-solid fa-arrow-right', 'بازگشت به همه منزلگاه‌ها', 'closeLmsStationView')}
      <h3>${esc(st.title || `منزلگاه ${num}`)}</h3>
      ${lmsStateChip(state)}
    </div>
    ${board}
    <div class="lsv-bottom">${statsPanel}${instPanel}</div>`;

  const wasOpen = view.style.display !== 'none' && view.innerHTML.trim() !== '';
  const sameStation = wasOpen && window.lmsRenderedStationId === String(st.id);
  window.lmsRenderedStationId = String(st.id);
  if (overview) overview.style.display = 'none';
  view.style.display = 'block';
  if (sameStation && window.NopaFlip) {
    window.NopaFlip.render(view, () => { view.innerHTML = html; });
  } else {
    view.innerHTML = html;
    if (window.NopaFlip) {
      // switching between stations keeps the header and the circles still; opening animates everything in
      const parts = wasOpen
        ? view.querySelectorAll('.lsv-flow > .lsv-col, .lsv-flow > .lsv-link, .lsv-bottom > .lsv-panel')
        : view.querySelectorAll('.lsv-head, .lsv-board, .lsv-notch .lsv-circle, .lsv-flow > .lsv-col, .lsv-bottom > .lsv-panel');
      window.NopaFlip.enter(parts);
      // the newly selected circle pops into its ring
      const picked = wasOpen && view.querySelector('.lsv-circle.is-active .lsv-circle-img');
      if (picked && typeof picked.animate === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        picked.animate([{ transform: 'scale(0.8)' }, { transform: 'scale(1.12)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
      }
    }
  }

  lmsFitBoardNotch(view);

  // Centre the active circle inside the notch only (scrollIntoView would also scroll the page sideways)
  const notch = view.querySelector('.lsv-notch');
  const activeEl = notch && notch.querySelector('.lsv-circle.is-active');
  if (activeEl && notch.scrollWidth > notch.clientWidth) {
    const nr = notch.getBoundingClientRect();
    const ar = activeEl.getBoundingClientRect();
    notch.scrollLeft += (ar.left + ar.width / 2) - (nr.left + nr.width / 2);
  }
};

// The board's glass is cut away where the station circles hang from its top edge (so the page shows through, not a
// fill), with concave flares at the cut's top corners. The cut is a clip-path measured from the circles' strip, and
// the board's outline is an SVG stroke along the same path so it follows the curves instead of being cut off.
let lmsBoardObserver = null;
function lmsFitBoardNotch(view) {
  const board = view.querySelector('.lsv-board');
  if (!board) return;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  let svg = board.querySelector(':scope > .lsv-board-outline');
  if (!svg) {
    svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'lsv-board-outline');
    svg.setAttribute('aria-hidden', 'true');
    svg.appendChild(document.createElementNS(SVG_NS, 'path'));
    board.prepend(svg);
  }
  const fit = () => {
    const wrap = board.querySelector('.lsv-notch-wrap');
    const bw = board.offsetWidth, bh = board.offsetHeight;
    const R = 28;
    let d;
    if (!wrap || wrap.offsetTop > 4) { // stacked layout: no cut
      d = `M ${R} 0 H ${bw - R} A ${R} ${R} 0 0 1 ${bw} ${R} V ${bh - R} A ${R} ${R} 0 0 1 ${bw - R} ${bh} H ${R} A ${R} ${R} 0 0 1 0 ${bh - R} V ${R} A ${R} ${R} 0 0 1 ${R} 0 Z`;
    } else {
      const F = 22;
      const x0 = wrap.offsetLeft, x1 = x0 + wrap.offsetWidth, h = wrap.offsetHeight;
      const r = Math.min(24, h / 2);
      d = `M ${R} 0 H ${x0 - F} A ${F} ${F} 0 0 1 ${x0} ${F} V ${h - r} A ${r} ${r} 0 0 0 ${x0 + r} ${h} H ${x1 - r} A ${r} ${r} 0 0 0 ${x1} ${h - r} V ${F} A ${F} ${F} 0 0 1 ${x1 + F} 0 H ${bw - R} A ${R} ${R} 0 0 1 ${bw} ${R} V ${bh - R} A ${R} ${R} 0 0 1 ${bw - R} ${bh} H ${R} A ${R} ${R} 0 0 1 0 ${bh - R} V ${R} A ${R} ${R} 0 0 1 ${R} 0 Z`;
    }
    board.style.setProperty('--board-clip', `path('${d}')`);
    svg.setAttribute('width', bw);
    svg.setAttribute('height', bh);
    svg.firstChild.setAttribute('d', d);
  };
  fit();
  if (lmsBoardObserver) lmsBoardObserver.disconnect();
  if (typeof ResizeObserver === 'function') {
    lmsBoardObserver = new ResizeObserver(fit);
    lmsBoardObserver.observe(board);
    const wrap = board.querySelector('.lsv-notch-wrap');
    if (wrap) lmsBoardObserver.observe(wrap);
  }
}

// ==================== STATION VIEW ACTIONS ====================

async function lmsViewErrorText(res) {
  try { const d = await res.json(); return d.error || 'خطای سرور'; } catch (_) { return 'خطای سرور'; }
}

window.lmsDeleteActiveStation = function(stationId) {
  // Once the station is gone, the reload in deleteStationRecord re-renders and closes this view
  return window.deleteStationRecord(stationId);
};

// Toasts raised while fn runs are held back and shown once the cards have finished moving (js/ui/flip.js)
async function lmsWithDeferredToasts(fn) {
  const original = window.showToast;
  const queued = [];
  window.showToast = (...args) => { queued.push(args); };
  try {
    return await fn();
  } finally {
    window.showToast = original;
    if (queued.length) {
      if (window.NopaFlip) await window.NopaFlip.settled();
      queued.forEach(args => original(...args));
    }
  }
}

// The content actions (content-manager.js) only redraw the station editor when it is open; here they just reload
function lmsViewRun(fn, ...args) {
  return lmsWithDeferredToasts(() => fn(...args));
}

// "+" in a column: add the session, then open it in the station editor to fill it in; toast after the animation
window.lmsAddSessionFromView = function(categoryId, stationId) {
  return lmsWithDeferredToasts(async () => {
    const id = await window.addNewSessionToCategory(categoryId, stationId);
    if (id) window.openStationContentManagerModal(stationId, `sess:${id}`);
  });
};

window.lmsDeleteSessionFromView = function(sessionId, stationId, event) {
  // The delete button sits inside the card; don't open the content manager too
  if (event) event.stopPropagation();
  return lmsViewRun(window.deleteSessionRecord, sessionId, stationId);
};

window.lmsDeleteCategoryFromView = function(categoryId, stationId) {
  return lmsViewRun(window.deleteCategoryRecord, categoryId, stationId);
};

window.lmsAddCategoryFromView = stationId => lmsWithDeferredToasts(() => lmsAddCategoryNow(stationId));
async function lmsAddCategoryNow(stationId) {
  const input = document.getElementById('lsv-new-cat-title');
  const title = (input?.value || '').trim();
  if (!title) {
    showToast('لطفاً عنوان دسته کلاس جدید را وارد نمایید.', 'error');
    input?.focus();
    return;
  }
  const station = (window.lmsStationsMasterList || []).find(s => String(s.id) === String(stationId));
  const ordered = window.lmsOrderedCategories(station);
  const nextOrder = ordered.reduce((m, c) => Math.max(m, Number(c.orderIndex) || 0), 0) + 1;
  try {
    const res = await request('/api/v1/admin/lms/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stationId, title, orderIndex: nextOrder })
    });
    if (!res.ok) {
      showToast('خطا در افزودن دسته: ' + (await lmsViewErrorText(res)), 'error');
      return;
    }
    showToast(`دسته «${title}» اضافه شد.`, 'success');
    await window.fetchLiveLmsStations();
  } catch (err) {
    console.error('Add category error:', err);
    showToast('ارتباط با سرور برقرار نشد', 'error');
  }
};

// Writes each changed session's instructor list ("a، b"), then reloads the stations
async function lmsSaveSessionInstructors(updates) {
  let failed = 0;
  for (const { id, names } of updates) {
    const value = names.join('، ');
    const res = await request(`/api/v1/admin/lms/sessions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      // an empty "instructor" falls back to "teacher" on the server, so send both to clear it
      body: JSON.stringify({ id, instructor: value, teacher: value })
    });
    if (!res.ok) failed++;
  }
  await window.fetchLiveLmsStations();
  return failed;
}

window.lmsAssignInstructorToStation = stationId => lmsWithDeferredToasts(() => lmsAssignInstructorNow(stationId));
async function lmsAssignInstructorNow(stationId) {
  const name = (document.getElementById('lsv-assign-inst')?.value || '').trim();
  const catId = document.getElementById('lsv-assign-cat')?.value || 'all';
  if (!name) {
    showToast('لطفاً یک استاد از بانک اساتید انتخاب کنید.', 'error');
    return;
  }
  const station = (window.lmsStationsMasterList || []).find(s => String(s.id) === String(stationId));
  const updates = [];
  window.lmsOrderedCategories(station).forEach(c => {
    if (catId !== 'all' && String(c.id) !== String(catId)) return;
    (c.sessions || []).filter(s => !s.isDeleted).forEach(s => {
      const names = lmsSplitInstructors(s.instructor);
      if (names.some(n => lmsNormName(n) === lmsNormName(name))) return;
      updates.push({ id: s.id, names: names.concat(name) });
    });
  });
  if (!updates.length) {
    showToast('جلسه‌ای برای تخصیص یافت نشد (یا این استاد از قبل در همه آن‌ها حضور دارد). ابتدا جلسه اضافه کنید.', 'error');
    return;
  }
  try {
    const failed = await lmsSaveSessionInstructors(updates);
    if (failed) showToast(`تخصیص استاد برای ${failed} جلسه انجام نشد.`, 'error');
    else showToast(`«${name}» به ${updates.length} جلسه این منزلگاه اضافه شد.`, 'success');
  } catch (err) {
    console.error('Assign instructor error:', err);
    showToast('ارتباط با سرور برقرار نشد', 'error');
  }
};

window.lmsRemoveInstructorFromStation = (stationId, name) => lmsWithDeferredToasts(() => lmsRemoveInstructorNow(stationId, name));
async function lmsRemoveInstructorNow(stationId, name) {
  const station = (window.lmsStationsMasterList || []).find(s => String(s.id) === String(stationId));
  const updates = [];
  window.lmsOrderedCategories(station).forEach(c => {
    (c.sessions || []).filter(s => !s.isDeleted).forEach(s => {
      const names = lmsSplitInstructors(s.instructor);
      const rest = names.filter(n => lmsNormName(n) !== lmsNormName(name));
      if (rest.length !== names.length) updates.push({ id: s.id, names: rest });
    });
  });
  if (!updates.length) return;
  if (!(await NopaConfirm(`«${name}» از ${updates.length} جلسه این منزلگاه برداشته شود؟ اطلاعات استاد در بانک اساتید باقی می‌ماند.`))) return;
  try {
    const failed = await lmsSaveSessionInstructors(updates);
    if (failed) showToast(`برداشتن استاد از ${failed} جلسه انجام نشد.`, 'error');
    else showToast(`«${name}» از جلسات این منزلگاه برداشته شد.`, 'success');
  } catch (err) {
    console.error('Remove instructor error:', err);
    showToast('ارتباط با سرور برقرار نشد', 'error');
  }
};

// Instructor saves / deletes reload the bank; refresh the avatars and pickers shown here as well
(function() {
  const original = window.fetchInstructorsList;
  if (typeof original !== 'function') return;
  window.fetchInstructorsList = async function(...args) {
    const result = await original.apply(this, args);
    if (window.lmsStationsMasterList && window.lmsStationsMasterList.length) window.renderLmsStationsBento();
    return result;
  };
})();

// Saving a station (station editor) or its access settings reloads the list; their toasts also wait for the cards
['lmsEditorSave', 'lmsEditorCreate', 'saveStationAccessSettings'].forEach(name => {
  const original = window[name];
  if (typeof original !== 'function') return;
  window[name] = function(...args) {
    return lmsWithDeferredToasts(() => original.apply(this, args));
  };
});

// ==================== LOADING SHIMMER ====================
// Like the dashboard tiles: a light band sweeps over each bento tile until the stations arrive. On the
// first load the tiles hold skeletons (station cards in the app's frame, list lines); a refresh keeps the
// current content under the shimmer.
window.lmsSetStationsLoading = function(on) {
  const overview = document.getElementById('lms-overview-view');
  if (!overview) return;
  overview.querySelectorAll('.lst-bento > .lst-tile').forEach(t => t.classList.toggle('is-loading', on));
  const grid = document.getElementById('lms-bento-stations');
  if (grid) grid.setAttribute('aria-busy', on ? 'true' : 'false');
  if (!on || (window.lmsStationsMasterList || []).length) return;

  if (grid) {
    grid.innerHTML = Array.from({ length: 5 }, () => `
      <div class="lst-station-card lst-skel" aria-hidden="true">
        <span class="app-station-card">
          <span class="app-station-inner">
            <span class="app-station-image"></span>
            <span class="app-station-divider"></span>
            <span class="app-station-bar"><span class="lst-skel-line lst-skel-num"></span><span class="lst-skel-line"></span></span>
          </span>
        </span>
        <span class="lst-station-meta"><span class="lst-skel-line lst-skel-chip"></span><span class="lst-skel-line lst-skel-short"></span></span>
      </div>`).join('');
  }
  const lines = n => `<div class="lst-skel-lines" aria-hidden="true">${'<span class="lst-skel-row"></span>'.repeat(n)}</div>`;
  const fill = { 'lms-bento-status': lines(3), 'lms-bento-upcoming': lines(2), 'lms-bento-instructors': lines(3), 'lms-bento-health': lines(4) };
  Object.keys(fill).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = fill[id];
  });
};

// The tab starts in its loading state until the first fetch (directory.js) finishes
if (!(window.lmsStationsMasterList || []).length) window.lmsSetStationsLoading(true);
