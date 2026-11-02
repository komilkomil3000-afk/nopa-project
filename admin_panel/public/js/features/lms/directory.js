// LMS stations directory: live station list, stats, table rows and filters.
// Split out of the former lms.js (Phase 7).

// LMS Stations Management & Directory Logic with Robust Station Finder & Modal Trigger
window.lmsStationsMasterList = [];

// A station's class categories are free text and there can be any number of them. Nothing here classifies a
// category by keywords in its title ("مهارت" / "رسانه"): a category is its position (orderIndex, ties broken by
// creation time) and is shown under its own title. The app uses the same rule, so its class tabs match this list.
window.lmsOrderedCategories = function(station) {
  return (station && station.categories ? station.categories : [])
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      const oa = Number(a.c.orderIndex) || 0;
      const ob = Number(b.c.orderIndex) || 0;
      if (oa !== ob) return oa - ob;
      const ta = a.c.createdAt ? new Date(a.c.createdAt).getTime() : 0;
      const tb = b.c.createdAt ? new Date(b.c.createdAt).getTime() : 0;
      return ta !== tb ? ta - tb : a.i - b.i;
    })
    .map(x => x.c);
};

// Category filter value -> category position (0-based), or -1 for "all". Old values (مهارتی / رسانه‌ای) still work.
window.lmsCategoryFilterIndex = function(value) {
  if (!value || value === 'all') return -1;
  const m = String(value).match(/^cat:(\d+)$/);
  if (m) return Number(m[1]);
  if (value === 'مهارتی' || value === 'skill') return 0;
  if (value === 'رسانه‌ای' || value === 'media') return 1;
  return -1;
};

window.lmsCategoryColor = function(index) {
  return ['var(--info-text)', 'var(--primary-text)', 'var(--accent-text)', 'var(--success-text)'][index % 4];
};

// The category filter lists one entry per category position with the titles used at that position
window.refreshLmsCategoryFilterOptions = function() {
  const select = document.getElementById('lms-filter-category');
  if (!select) return;
  const current = select.value;
  const titlesByIndex = [];
  (window.lmsStationsMasterList || []).forEach(st => {
    window.lmsOrderedCategories(st).forEach((c, i) => {
      titlesByIndex[i] = titlesByIndex[i] || new Set();
      if (c.title) titlesByIndex[i].add(c.title.trim());
    });
  });
  const options = ['<option value="all">همه دسته‌ها</option>'];
  titlesByIndex.forEach((set, i) => {
    const names = Array.from(set || []);
    const label = names.length ? names.slice(0, 3).join(' / ') + (names.length > 3 ? ' ...' : '') : '';
    options.push(`<option value="cat:${i}">دسته ${i + 1}${label ? ': ' + esc(label) : ''}</option>`);
  });
  select.innerHTML = options.join('');
  const idx = window.lmsCategoryFilterIndex(current);
  select.value = idx >= 0 && idx < titlesByIndex.length ? `cat:${idx}` : 'all';
};

window.fetchLiveLmsStations = async function() {
  const tbody = document.getElementById('lms-directory-tbody');
  if (!tbody) return;

  try {
    let res = await request('/api/v1/lms/stations');
    if (!res.ok) {
      res = await request('/api/v1/admin/lms/stations');
    }

    if (res.ok) {
      const data = await res.json();
      window.lmsStationsMasterList = Array.isArray(data) ? data : (data.stations || data.data || []);
    } else {
      console.warn('Could not fetch live stations');
    }
  } catch (err) {
    console.error('Fetch live stations error:', err);
  }

  // Calculate stats dynamically from REAL database station, session, part & quiz counts
  const totalStations = window.lmsStationsMasterList.length;
  let totalSessions = 0;
  let totalParts = 0;
  const uniqueQuizIds = new Set();

  window.lmsStationsMasterList.forEach(st => {
    const cats = st.categories || [];
    cats.forEach(c => {
      const sessList = c.sessions || [];
      totalSessions += sessList.length;
      sessList.forEach(s => {
        const clips = s.videoClips || [];
        totalParts += clips.length;
        (s.quizzes || []).forEach(q => uniqueQuizIds.add(q.id));
        clips.forEach(clip => {
          (clip.quizzes || []).forEach(q => uniqueQuizIds.add(q.id));
        });
      });
    });
  });

  const totalQuizzes = uniqueQuizIds.size;

  const statStationsEl = document.getElementById('lms-stat-stations');
  if (statStationsEl) statStationsEl.textContent = `${totalStations} منزلگاه`;

  const statSessionsEl = document.getElementById('lms-stat-sessions');
  if (statSessionsEl) statSessionsEl.textContent = `${totalSessions} جلسه مصوب`;

  const statPartsEl = document.getElementById('lms-stat-parts');
  if (statPartsEl) statPartsEl.textContent = `${totalParts} پارت ویدیو`;

  const statQuizzesEl = document.getElementById('lms-stat-quizzes');
  if (statQuizzesEl) statQuizzesEl.textContent = `${totalQuizzes} آزمونک فعال`;

  window.refreshLmsCategoryFilterOptions();
  window.filterLmsTable();
};

window.renderLmsDirectoryRows = function(list, selectedCategoryFilter = 'all', selectedInstructorFilter = 'all') {
  const tbody = document.getElementById('lms-directory-tbody');
  if (!tbody) return;

  if (!list || list.length === 0) {
    NopaTable.empty(tbody, 'هیچ منزلگاهی با این فیلترها یافت نشد.');
    return;
  }

  const PERSIAN_NUMS = ['صفر', 'اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم', 'هفتم', 'هشتم', 'نهم', 'دهم'];
  const filterIndex = window.lmsCategoryFilterIndex(selectedCategoryFilter);

  tbody.innerHTML = list.map((st, i) => {
    const idx = st.orderIndex ?? st.index ?? (i + 1);
    const stationIdentifier = st.id || ('MZ' + idx);
    const simpleStationName = PERSIAN_NUMS[idx - 1] ? `منزلگاه ${PERSIAN_NUMS[idx - 1]}` : `منزلگاه ${idx}`;

    // Every category of the station, in order, with its real session / part / quiz counts
    const categories = st.categories || [];
    const catStats = window.lmsOrderedCategories(st).map((cat, ci) => {
      const sessions = (cat.sessions || []).filter(s => !s.isDeleted);
      let parts = 0;
      let quizzes = 0;
      sessions.forEach(s => {
        const clips = s.videoClips || [];
        parts += clips.length;
        quizzes += (s.quizzes || []).length;
        clips.forEach(clip => { quizzes += (clip.quizzes || []).length; });
      });
      return { index: ci, title: cat.title || `دسته ${ci + 1}`, sessions: sessions.length, parts, quizzes };
    });
    const shownStats = filterIndex >= 0 ? catStats.filter(c => c.index === filterIndex) : catStats;

    const totalRealSess = shownStats.reduce((n, c) => n + c.sessions, 0);
    const totalRealParts = shownStats.reduce((n, c) => n + c.parts, 0);
    const totalRealQuizzes = shownStats.reduce((n, c) => n + c.quizzes, 0);

    // Topics column HTML: the categories under their own titles
    const topicsDisplayHtml = shownStats.length === 0
      ? '<span class="u-fs-2xs u-c-text-muted">دسته‌ای تعریف نشده است</span>'
      : `<div class="u-flex u-col u-gap-4">${shownStats.map(c => `
          <span class="badge u-bg-primary-12 u-c-primary-text u-bd-primary-30 u-fs-xs u-p-4-8 u-r-6 u-fw-600 u-inline-flex u-items-center u-gap-6">
            <i class="fa-solid fa-layer-group u-fs-2xs" data-style="color:${window.lmsCategoryColor(c.index)}"></i> <strong>دسته ${c.index + 1}:</strong> ${esc(c.title)}
          </span>`).join('')}
        </div>`;

    // Extract unique instructors teaching in this station
    const stationInstructors = new Set();
    categories.forEach(c => {
      (c.sessions || []).forEach(sess => {
        if (sess.instructor && sess.instructor.trim()) {
          stationInstructors.add(sess.instructor.trim());
        }
      });
    });

    let instructorsDisplayHtml = '';
    if (stationInstructors.size > 0) {
      instructorsDisplayHtml = `
        <div class="u-flex u-col u-gap-6">
          <div class="u-flex u-wrap u-gap-4 u-maxw-220">
            ${Array.from(stationInstructors).map(inst => {
              const isMatch = selectedInstructorFilter !== 'all' && (inst.toLowerCase().includes(selectedInstructorFilter) || inst.replace(/‌/g, '').includes(selectedInstructorFilter.replace(/‌/g, '')));
              const badgeStyle = isMatch
                ? 'background:rgb(var(--primary-rgb) / 0.3); color:var(--primary-text); border:1px solid var(--primary);'
                : 'background:rgb(var(--fg-rgb) / 0.06); color:var(--text-soft); border:1px solid rgb(var(--fg-rgb) / 0.08);';
              return `<span class="badge u-p-2-8 u-r-6 u-inline-flex u-items-center u-gap-4" data-style="${badgeStyle} font-size:var(--text-2xs)">
                <i class="fa-solid fa-chalkboard-user u-fs-2xs u-c-primary-text"></i> ${esc(inst)}
              </span>`;
            }).join('')}
          </div>
          <button type="button" data-click="openStationContentManagerModal" data-click-args="${esc(JSON.stringify([String(st.id)]))}" class="u-bg-primary-12 u-bd-primary-30 u-c-primary-text u-r-5 u-fs-2xs u-p-4-8 u-pointer u-w-fit-content u-inline-flex u-items-center u-gap-4 u-transition" data-hover="primary-strong" title="ویرایش و اصلاح اساتید این منزلگاه">
            <i class="fa-solid fa-user-pen"></i> ویرایش و اصلاح اساتید
          </button>
        </div>
      `;
    } else {
      instructorsDisplayHtml = `
        <div class="u-flex u-col u-gap-6">
          <div class="u-fs-2xs u-c-text-muted">
            <i class="fa-solid fa-chalkboard-user"></i> اساتید دوره نپا
          </div>
          <button type="button" data-click="openStationContentManagerModal" data-click-args="${esc(JSON.stringify([String(st.id)]))}" class="u-bg-primary-12 u-bd-primary-30 u-c-primary-text u-r-5 u-fs-2xs u-p-4-8 u-pointer u-w-fit-content u-inline-flex u-items-center u-gap-4">
            <i class="fa-solid fa-user-pen"></i> تعیین اساتید
          </button>
        </div>
      `;
    }

    const categoryBadgeHtml = `
        <div class="u-flex u-col u-gap-4 u-items-center">
          ${shownStats.map(c => `
          <span class="badge u-bg-primary-25 u-c-primary-text u-bd-primary-40 u-fs-2xs u-p-4-8 u-r-6 u-w-92p" title="${esc(c.title)}">
            دسته ${c.index + 1}: ${esc(c.title)} (${c.sessions} جلسه)
          </span>`).join('') || '<span class="u-fs-2xs u-c-text-muted">-</span>'}
        </div>
      `;
    const sessionsDisplayHtml = `
        <div class="u-flex u-col u-items-center u-gap-2">
          <div class="u-bold u-c-text u-fs-sm">
            <span class="u-c-primary-text">${totalRealSess} جلسه</span> | <span class="u-c-success-text">${totalRealParts} پارت</span>
          </div>
          ${shownStats.length > 1 ? `<div class="u-fs-2xs u-c-text-soft u-flex u-gap-6 u-wrap u-justify-center">
            ${shownStats.map(c => `<span class="u-c-primary-text">${c.sessions} ${esc(c.title)}</span>`).join(' + ')}
          </div>` : ''}
          <div class="u-fs-2xs u-c-accent-text u-bg-accent-12 u-p-1-6 u-r-4 u-bd-accent-30 u-mt-2">
            <i class="fa-solid fa-file-signature"></i> ${totalRealQuizzes} آزمونک ثبت‌شده
          </div>
        </div>
      `;

    let releaseDateStr = 'نامشخص';
    if (st.releaseDate) {
      try {
        const d = new Date(st.releaseDate);
        releaseDateStr = d.toISOString().split('T')[0];
      } catch (e) {
        releaseDateStr = String(st.releaseDate).split('T')[0];
      }
    }

    return `
      <tr>
        <td class="u-text-center u-mono u-bold u-c-color-neon-blue">MZ${idx}</td>
        <td>
          <strong class="u-c-text u-fs-base u-flex u-items-center u-gap-6">
            <i class="fa-solid fa-location-dot u-c-accent-text"></i> ${simpleStationName}
          </strong>
          ${st.stayDuration ? `<div class="u-fs-2xs u-c-primary-text u-mt-2"><i class="fa-solid fa-hourglass-half"></i> اقامت: ${st.stayDuration}</div>` : ''}
          ${st.animationTitle ? `<div class="u-fs-2xs u-c-primary-text u-mt-2"><i class="fa-solid fa-film"></i> ${esc(st.animationTitle)}</div>` : ''}
          <div class="u-fs-2xs u-c-text-muted u-mt-4">کد ترتیب: منزلگاه ${idx}</div>
        </td>
        <td>${topicsDisplayHtml}</td>
        <td>${instructorsDisplayHtml}</td>
        <td class="u-text-center">${categoryBadgeHtml}</td>
        <td class="u-c-text-soft u-fs-xs">
          <div class="u-flex u-items-center u-gap-6 u-c-primary-text u-bold">
            <i class="fa-solid fa-calendar-days"></i> ${releaseDateStr}
          </div>
        </td>
        <td class="u-text-center">${sessionsDisplayHtml}</td>
        <td role="button" tabindex="0" class="u-text-center u-va-middle u-pointer" data-click="openStationAccessModal" data-click-args="${esc(JSON.stringify([String(stationIdentifier)]))}" title="کلیک برای تغییر وضعیت و تنظیمات بازگشایی">
          ${(() => {
            const isStationTimeLocked = Boolean(st.isTimeLocked || (st.scheduledUnlockTime && new Date() < new Date(st.scheduledUnlockTime)));
            const effectiveIsLocked = Boolean(st.isLocked || st.status === 'locked' || isStationTimeLocked);

            let statusBadge = '';
            if (effectiveIsLocked) {
              statusBadge = `
                <span class="badge badge-locked u-fs-xs u-p-4-10 u-r-7 u-bg-danger-18 u-c-danger-text u-bd-danger-40 u-inline-flex u-items-center u-gap-6 u-bold u-pointer u-transition" title="کلیک برای تغییر وضعیت و تنظیمات بازگشایی">
                  <i class="fa-solid fa-lock"></i> قفل شده
                </span>
              `;
            } else {
              statusBadge = `
                <span class="badge badge-active u-fs-xs u-p-4-10 u-r-7 u-bg-success-18 u-c-success-text u-bd-success-40 u-inline-flex u-items-center u-gap-6 u-bold u-pointer u-transition" title="کلیک برای تغییر وضعیت و تنظیمات بازگشایی">
                  <i class="fa-solid fa-lock-open"></i> فعال
                </span>
              `;
            }

            let schedTag = '';
            if (st.scheduledUnlockTime) {
              try {
                const d = new Date(st.scheduledUnlockTime);
                const timePart = d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
                const datePart = d.toLocaleDateString('fa-IR');
                schedTag = `
                  <div class="u-fs-2xs u-c-primary-text u-mt-4 u-inline-flex u-items-center u-gap-4" title="زمان بازگشایی خودکار: ${datePart} ساعت ${timePart}">
                    <i class="fa-regular fa-clock"></i> بازگشایی: ${datePart}
                  </div>
                `;
              } catch (_) {}
            }

            let condTag = '';
            if (st.requirePreviousComplete && idx > 1) {
              condTag = `
                <div class="u-fs-2xs u-c-primary-text u-mt-2 u-inline-flex u-items-center u-gap-4" title="مشروط به اتمام مراحل منزلگاه قبل">
                  <i class="fa-solid fa-link"></i> مشروط به منزلگاه ${idx - 1}
                </div>
              `;
            }

            return `
              <div class="u-inline-flex u-col u-items-center u-pointer">
                ${statusBadge}
                ${schedTag}
                ${condTag}
              </div>
            `;
          })()}
        </td>
        <td class="u-text-center">
          <div class="u-flex u-justify-center u-gap-6 u-wrap">
            <button type="button" class="page-btn u-bg-primary u-c-white u-p-6-10 u-fs-2xs u-r-6 u-bd-none u-pointer" data-click="openStationContentManagerModal" data-click-args="${esc(JSON.stringify([String(stationIdentifier), String(selectedCategoryFilter)]))}" title="مدیریت پارت‌ها و آزمونک‌ها">
              <i class="fa-solid fa-film"></i> پارت‌ها
            </button>
            <button type="button" class="page-btn u-bg-info u-c-white u-p-6-10 u-fs-2xs u-r-6 u-bd-none u-pointer" data-click="editStationModal" data-click-args="${esc(JSON.stringify([String(stationIdentifier)]))}" title="ویرایش عنوان و تقویم">
              <i class="fa-solid fa-pen-to-square"></i> ویرایش
            </button>
            <button type="button" class="page-btn u-bg-danger u-c-white u-p-6-10 u-fs-2xs u-r-6 u-bd-none u-pointer" data-click="deleteStationRecord" data-click-args="${esc(JSON.stringify([String(stationIdentifier)]))}" title="حذف">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
};

window.filterLmsTable = function() {
  const query = (document.getElementById('lms-search-input')?.value || '').trim().toLowerCase();
  const catFilter = document.getElementById('lms-filter-category')?.value || 'all';
  const instructorFilter = (document.getElementById('lms-filter-instructor')?.value || 'all').trim().toLowerCase();
  const cleanInstFilter = instructorFilter.replace(/‌/g, '').replace(/\s+/g, '');

  const filtered = window.lmsStationsMasterList.filter(st => {
    const titleMatch = st.title && st.title.toLowerCase().includes(query);
    const descMatch = st.description && st.description.toLowerCase().includes(query);

    const categories = st.categories || [];
    let hasInstructorMatch = false;
    let hasQueryInSessions = false;

    categories.forEach(c => {
      if (c.title && c.title.toLowerCase().includes(query)) hasQueryInSessions = true;
      (c.sessions || []).forEach(sess => {
        if (sess.title && sess.title.toLowerCase().includes(query)) hasQueryInSessions = true;
        if (sess.instructor && sess.instructor.toLowerCase().includes(query)) hasQueryInSessions = true;
        if (instructorFilter !== 'all' && sess.instructor) {
          const cleanInstName = sess.instructor.toLowerCase().replace(/‌/g, '').replace(/\s+/g, '');
          if (cleanInstName.includes(cleanInstFilter) || sess.instructor.toLowerCase().includes(instructorFilter)) {
            hasInstructorMatch = true;
          }
        }
      });
    });

    const matchesQuery = !query || titleMatch || descMatch || hasQueryInSessions;
    const matchesInstructor = instructorFilter === 'all' || hasInstructorMatch;

    const catIndex = window.lmsCategoryFilterIndex(catFilter);
    const matchesCat = catIndex < 0 || categories.length > catIndex;

    return matchesQuery && matchesCat && matchesInstructor;
  });

  window.renderLmsDirectoryRows(filtered, catFilter, instructorFilter);
};

// Loaded by showDashboard() (js/app/bootstrap.js) once the user is signed in
window.loadLmsStationsData = window.fetchLiveLmsStations;
