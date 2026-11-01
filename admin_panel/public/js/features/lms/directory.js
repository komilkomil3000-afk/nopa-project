// LMS stations directory: live station list, stats, table rows and filters.
// Split out of the former lms.js (Phase 7).

// LMS Stations Management & Directory Logic with Robust Station Finder & Modal Trigger
window.lmsStationsMasterList = [];

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

  window.filterLmsTable();
};

window.renderLmsDirectoryRows = function(list, selectedCategoryFilter = 'all', selectedInstructorFilter = 'all') {
  const tbody = document.getElementById('lms-directory-tbody');
  if (!tbody) return;

  if (!list || list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:24px; color:var(--text-muted);">هیچ منزلگاهی با این فیلترها یافت نشد.</td></tr>';
    return;
  }

  const PERSIAN_NUMS = ['صفر', 'اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم', 'هفتم', 'هشتم', 'نهم', 'دهم'];
  const DEFAULT_STATION_TOPICS = {
    1: { skill: 'شناخت هوش و حافظه', media: 'پادکست و مبانی رسانه' },
    2: { skill: 'خودشناسی جامع', media: 'تولید پادکست حرفه‌ای' },
    3: { skill: 'تفکر نقادانه و حل مسئله', media: 'عکاسی و تصویربرداری' },
    4: { skill: 'کار تیمی و مدیریت چالش‌ها', media: 'تدوین ویدیو و سناریونویسی' },
    5: { skill: 'هدف‌گذاری و مدیریت زمان', media: 'هوش مصنوعی و رسانه' }
  };

  tbody.innerHTML = list.map((st, i) => {
    const idx = st.orderIndex ?? st.index ?? (i + 1);
    const stationIdentifier = st.id || ('MZ' + idx);
    const simpleStationName = PERSIAN_NUMS[idx - 1] ? `منزلگاه ${PERSIAN_NUMS[idx - 1]}` : `منزلگاه ${idx}`;
    
    // Process categories & real session, part, and quiz counts
    const categories = st.categories || [];
    const skillCategory = categories.find(c => c.orderIndex === 1 || (c.title && c.title.includes('مهارت'))) || {
      title: 'کلاس‌های مهارتی',
      sessions: []
    };
    const mediaCategory = categories.find(c => c.orderIndex === 2 || (c.title && c.title.includes('رسانه'))) || {
      title: 'کلاس‌های رسانه‌ای',
      sessions: []
    };

    // Helper to get clean category topic
    const defaultTopics = DEFAULT_STATION_TOPICS[idx] || { skill: 'کلاس‌های مهارتی', media: 'کلاس‌های رسانه‌ای' };
    
    function getCleanTopic(cat, fallback) {
      if (!cat) return fallback;
      if (cat.title && !cat.title.startsWith('کلاس') && !cat.title.startsWith('دسته') && cat.title.length > 2) {
        return cat.title;
      }
      const firstSess = (cat.sessions || [])[0];
      if (firstSess && firstSess.title) {
        let clean = firstSess.title.replace(/^جلسه\s*\d+\s*[:\-–]?\s*/i, '').replace(/^کلاس\s*\d+\s*[:\-–]?\s*/i, '').replace(/\([^)]*\)/g, '').trim();
        if (clean && clean.length > 2 && !clean.includes('مهارتی') && !clean.includes('رسانه‌ای')) {
          return clean;
        }
      }
      return fallback;
    }

    const skillTopic = getCleanTopic(skillCategory, defaultTopics.skill);
    const mediaTopic = getCleanTopic(mediaCategory, defaultTopics.media);

    const skillSessions = skillCategory.sessions || [];
    let skillPartsCount = 0;
    let skillQuizzesCount = 0;
    skillSessions.forEach(s => {
      const clips = s.videoClips || [];
      skillPartsCount += clips.length;
      skillQuizzesCount += (s.quizzes || []).length;
      clips.forEach(clip => {
        skillQuizzesCount += (clip.quizzes || []).length;
      });
    });

    const mediaSessions = mediaCategory.sessions || [];
    let mediaPartsCount = 0;
    let mediaQuizzesCount = 0;
    mediaSessions.forEach(s => {
      const clips = s.videoClips || [];
      mediaPartsCount += clips.length;
      mediaQuizzesCount += (s.quizzes || []).length;
      clips.forEach(clip => {
        mediaQuizzesCount += (clip.quizzes || []).length;
      });
    });

    const skillSessCount = skillSessions.length;
    const mediaSessCount = mediaSessions.length;
    const totalRealSess = skillSessCount + mediaSessCount;
    const totalRealParts = skillPartsCount + mediaPartsCount;
    const totalRealQuizzes = skillQuizzesCount + mediaQuizzesCount;

    // Topics column HTML
    let topicsDisplayHtml = '';
    const isSkillOnly = selectedCategoryFilter === 'مهارتی' || selectedCategoryFilter === 'skill';
    const isMediaOnly = selectedCategoryFilter === 'رسانه‌ای' || selectedCategoryFilter === 'media';

    if (isSkillOnly) {
      topicsDisplayHtml = `
        <div style="display:flex; align-items:center; gap:6px;">
          <span class="badge" style="background:rgb(var(--primary-rgb) / 0.15); color:var(--primary-text); border:1px solid rgb(var(--primary-rgb) / 0.35); font-size:12px; padding:4px 9px; border-radius:6px; font-weight:600;">
            <i class="fa-solid fa-person-running" style="margin-left:4px;"></i> ${esc(skillTopic)}
          </span>
        </div>
      `;
    } else if (isMediaOnly) {
      topicsDisplayHtml = `
        <div style="display:flex; align-items:center; gap:6px;">
          <span class="badge" style="background:rgb(var(--primary-rgb) / 0.15); color:var(--primary-text); border:1px solid rgb(var(--primary-rgb) / 0.35); font-size:12px; padding:4px 9px; border-radius:6px; font-weight:600;">
            <i class="fa-solid fa-microphone-lines" style="margin-left:4px;"></i> ${esc(mediaTopic)}
          </span>
        </div>
      `;
    } else {
      topicsDisplayHtml = `
        <div style="display:flex; flex-direction:column; gap:4px;">
          <span class="badge" style="background:rgb(var(--primary-rgb) / 0.12); color:var(--primary-text); border:1px solid rgb(var(--primary-rgb) / 0.3); font-size:11.5px; padding:3px 8px; border-radius:6px; font-weight:600; display:inline-flex; align-items:center; gap:5px;">
            <i class="fa-solid fa-person-running" style="font-size:10px;"></i> <strong>مهارتی:</strong> ${skillTopic}
          </span>
          <span class="badge" style="background:rgb(var(--primary-rgb) / 0.12); color:var(--primary-text); border:1px solid rgb(var(--primary-rgb) / 0.3); font-size:11.5px; padding:3px 8px; border-radius:6px; font-weight:600; display:inline-flex; align-items:center; gap:5px;">
            <i class="fa-solid fa-microphone-lines" style="font-size:10px;"></i> <strong>رسانه‌ای:</strong> ${mediaTopic}
          </span>
        </div>
      `;
    }

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
        <div style="display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; flex-wrap:wrap; gap:4px; max-width:220px;">
            ${Array.from(stationInstructors).map(inst => {
              const isMatch = selectedInstructorFilter !== 'all' && (inst.toLowerCase().includes(selectedInstructorFilter) || inst.replace(/‌/g, '').includes(selectedInstructorFilter.replace(/‌/g, '')));
              const badgeStyle = isMatch
                ? 'background:rgb(var(--primary-rgb) / 0.3); color:var(--primary-text); border:1px solid var(--primary);'
                : 'background:rgb(var(--fg-rgb) / 0.06); color:var(--text-soft); border:1px solid rgb(var(--fg-rgb) / 0.08);';
              return `<span class="badge" style="${badgeStyle} font-size:11px; padding:2px 7px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;">
                <i class="fa-solid fa-chalkboard-user" style="font-size:10px; color:var(--primary-text);"></i> ${esc(inst)}
              </span>`;
            }).join('')}
          </div>
          <button type="button" data-click="openStationContentManagerModal" data-click-args="${esc(JSON.stringify([String(st.id)]))}" style="background:rgb(var(--primary-rgb) / 0.12); border:1px solid rgb(var(--primary-rgb) / 0.3); color:var(--primary-text); border-radius:5px; font-size:10px; padding:3px 8px; cursor:pointer; width:fit-content; display:inline-flex; align-items:center; gap:4px; transition:all 0.2s;" data-hover="primary-strong" title="ویرایش و اصلاح اساتید این منزلگاه">
            <i class="fa-solid fa-user-pen"></i> ویرایش و اصلاح اساتید
          </button>
        </div>
      `;
    } else {
      instructorsDisplayHtml = `
        <div style="display:flex; flex-direction:column; gap:6px;">
          <div style="font-size:11px; color:var(--text-muted);">
            <i class="fa-solid fa-chalkboard-user"></i> اساتید دوره نپا
          </div>
          <button type="button" data-click="openStationContentManagerModal" data-click-args="${esc(JSON.stringify([String(st.id)]))}" style="background:rgb(var(--primary-rgb) / 0.12); border:1px solid rgb(var(--primary-rgb) / 0.3); color:var(--primary-text); border-radius:5px; font-size:10px; padding:3px 8px; cursor:pointer; width:fit-content; display:inline-flex; align-items:center; gap:4px;">
            <i class="fa-solid fa-user-pen"></i> تعیین اساتید
          </button>
        </div>
      `;
    }

    let categoryBadgeHtml = '';
    let sessionsDisplayHtml = '';

    if (isSkillOnly) {
      categoryBadgeHtml = `<span class="badge" style="background:var(--primary); color:white; font-size:11px; padding:4px 10px; border-radius:6px;">دسته ۱: مهارتی (${skillSessCount} جلسه | ${skillPartsCount} پارت)</span>`;
      sessionsDisplayHtml = `
        <div style="font-weight:bold; color:var(--primary-text); font-size:13px;">${skillSessCount} جلسه مهارتی</div>
        <div style="font-size:11px; color:var(--success-text); margin-top:2px;">${skillPartsCount} پارت ویدیو</div>
        <div style="font-size:10px; color:var(--accent-text); margin-top:2px;"><i class="fa-solid fa-file-signature"></i> ${skillQuizzesCount} آزمونک</div>
      `;
    } else if (isMediaOnly) {
      categoryBadgeHtml = `<span class="badge" style="background:var(--primary-strong); color:white; font-size:11px; padding:4px 10px; border-radius:6px;">دسته ۲: رسانه‌ای (${mediaSessCount} جلسه | ${mediaPartsCount} پارت)</span>`;
      sessionsDisplayHtml = `
        <div style="font-weight:bold; color:var(--primary-text); font-size:13px;">${mediaSessCount} جلسه رسانه‌ای</div>
        <div style="font-size:11px; color:var(--success-text); margin-top:2px;">${mediaPartsCount} پارت ویدیو</div>
        <div style="font-size:10px; color:var(--accent-text); margin-top:2px;"><i class="fa-solid fa-file-signature"></i> ${mediaQuizzesCount} آزمونک</div>
      `;
    } else {
      categoryBadgeHtml = `
        <div style="display:flex; flex-direction:column; gap:4px; align-items:center;">
          <span class="badge" style="background:rgb(var(--primary-rgb) / 0.25); color:var(--primary-text); border:1px solid rgb(var(--primary-rgb) / 0.4); font-size:11px; padding:3px 8px; border-radius:6px; width:92%;">
            دسته ۱ (${skillSessCount} جلسه)
          </span>
          <span class="badge" style="background:rgb(var(--primary-rgb) / 0.25); color:var(--primary-text); border:1px solid rgb(var(--primary-rgb) / 0.4); font-size:11px; padding:3px 8px; border-radius:6px; width:92%;">
            دسته ۲ (${mediaSessCount} جلسه)
          </span>
        </div>
      `;
      sessionsDisplayHtml = `
        <div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
          <div style="font-weight:bold; color:var(--text); font-size:13px;">
            <span style="color:var(--primary-text);">${totalRealSess} جلسه</span> | <span style="color:var(--success-text);">${totalRealParts} پارت</span>
          </div>
          <div style="font-size:11px; color:var(--text-soft); display:flex; gap:6px;">
            <span style="color:var(--primary-text);">${skillSessCount} مهارتی</span> + <span style="color:var(--primary-text);">${mediaSessCount} رسانه‌ای</span>
          </div>
          <div style="font-size:10px; color:var(--accent-text); background:rgb(var(--accent-rgb) / 0.12); padding:1px 6px; border-radius:4px; border:1px solid rgb(var(--accent-rgb) / 0.3); margin-top:2px;">
            <i class="fa-solid fa-file-signature"></i> ${totalRealQuizzes} آزمونک ثبت‌شده
          </div>
        </div>
      `;
    }

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
        <td style="text-align:center; font-family:monospace; font-weight:bold; color:var(--color-neon-blue);">MZ${idx}</td>
        <td>
          <strong style="color:var(--text); font-size:14px; display:flex; align-items:center; gap:6px;">
            <i class="fa-solid fa-location-dot" style="color:var(--accent-text);"></i> ${simpleStationName}
          </strong>
          ${st.stayDuration ? `<div style="font-size:11px; color:var(--primary-text); margin-top:2px;"><i class="fa-solid fa-hourglass-half"></i> اقامت: ${st.stayDuration}</div>` : ''}
          ${st.animationTitle ? `<div style="font-size:10px; color:var(--primary-text); margin-top:2px;"><i class="fa-solid fa-film"></i> ${esc(st.animationTitle)}</div>` : ''}
          <div style="font-size:11px; color:var(--text-muted); margin-top:3px;">کد ترتیب: منزلگاه ${idx}</div>
        </td>
        <td>${topicsDisplayHtml}</td>
        <td>${instructorsDisplayHtml}</td>
        <td style="text-align:center;">${categoryBadgeHtml}</td>
        <td style="color:var(--text-soft); font-size:12px;">
          <div style="display:flex; align-items:center; gap:5px; color:var(--primary-text); font-weight:bold;">
            <i class="fa-solid fa-calendar-days"></i> ${releaseDateStr}
          </div>
        </td>
        <td style="text-align:center;">${sessionsDisplayHtml}</td>
        <td style="text-align:center; vertical-align:middle; cursor:pointer;" data-click="openStationAccessModal" data-click-args="${esc(JSON.stringify([String(stationIdentifier)]))}" title="کلیک برای تغییر وضعیت و تنظیمات بازگشایی">
          ${(() => {
            const isStationTimeLocked = Boolean(st.isTimeLocked || (st.scheduledUnlockTime && new Date() < new Date(st.scheduledUnlockTime)));
            const effectiveIsLocked = Boolean(st.isLocked || st.status === 'locked' || isStationTimeLocked);

            let statusBadge = '';
            if (effectiveIsLocked) {
              statusBadge = `
                <span class="badge badge-locked" style="font-size:11.5px; padding:4px 10px; border-radius:7px; background:rgb(var(--danger-rgb) / 0.18); color:var(--danger-text); border:1px solid rgb(var(--danger-rgb) / 0.4); display:inline-flex; align-items:center; gap:5px; font-weight:bold; cursor:pointer; transition:all 0.2s;" title="کلیک برای تغییر وضعیت و تنظیمات بازگشایی">
                  <i class="fa-solid fa-lock"></i> قفل شده
                </span>
              `;
            } else {
              statusBadge = `
                <span class="badge badge-active" style="font-size:11.5px; padding:4px 10px; border-radius:7px; background:rgb(var(--success-rgb) / 0.18); color:var(--success-text); border:1px solid rgb(var(--success-rgb) / 0.4); display:inline-flex; align-items:center; gap:5px; font-weight:bold; cursor:pointer; transition:all 0.2s;" title="کلیک برای تغییر وضعیت و تنظیمات بازگشایی">
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
                  <div style="font-size:10px; color:var(--primary-text); margin-top:4px; display:inline-flex; align-items:center; gap:3px;" title="زمان بازگشایی خودکار: ${datePart} ساعت ${timePart}">
                    <i class="fa-regular fa-clock"></i> بازگشایی: ${datePart}
                  </div>
                `;
              } catch (_) {}
            }

            let condTag = '';
            if (st.requirePreviousComplete && idx > 1) {
              condTag = `
                <div style="font-size:10px; color:var(--primary-text); margin-top:2px; display:inline-flex; align-items:center; gap:3px;" title="مشروط به اتمام مراحل منزلگاه قبل">
                  <i class="fa-solid fa-link"></i> مشروط به منزلگاه ${idx - 1}
                </div>
              `;
            }

            return `
              <div style="display:inline-flex; flex-direction:column; align-items:center; cursor:pointer;">
                ${statusBadge}
                ${schedTag}
                ${condTag}
              </div>
            `;
          })()}
        </td>
        <td style="text-align:center;">
          <div style="display:flex; justify-content:center; gap:6px; flex-wrap:wrap;">
            <button type="button" class="page-btn" style="background:var(--primary); color:white; padding:5px 10px; font-size:11px; border-radius:6px; border:none; cursor:pointer;" data-click="openStationContentManagerModal" data-click-args="${esc(JSON.stringify([String(stationIdentifier), String(selectedCategoryFilter)]))}" title="مدیریت پارت‌ها و آزمونک‌ها">
              <i class="fa-solid fa-film"></i> پارت‌ها
            </button>
            <button type="button" class="page-btn" style="background:var(--info); color:white; padding:5px 10px; font-size:11px; border-radius:6px; border:none; cursor:pointer;" data-click="editStationModal" data-click-args="${esc(JSON.stringify([String(stationIdentifier)]))}" title="ویرایش عنوان و تقویم">
              <i class="fa-solid fa-pen-to-square"></i> ویرایش
            </button>
            <button type="button" class="page-btn" style="background:var(--danger); color:white; padding:5px 10px; font-size:11px; border-radius:6px; border:none; cursor:pointer;" data-click="deleteStationRecord" data-click-args="${esc(JSON.stringify([String(stationIdentifier)]))}" title="حذف">
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

    let matchesCat = true;
    if (catFilter !== 'all') {
      const hasSkill = categories.some(c => c.orderIndex === 1 || (c.title && c.title.includes('مهارت')));
      const hasMedia = categories.some(c => c.orderIndex === 2 || (c.title && c.title.includes('رسانه')));

      if (catFilter === 'مهارتی' || catFilter === 'skill') {
        matchesCat = hasSkill;
      } else if (catFilter === 'رسانه‌ای' || catFilter === 'media') {
        matchesCat = hasMedia;
      }
    }

    return matchesQuery && matchesCat && matchesInstructor;
  });

  window.renderLmsDirectoryRows(filtered, catFilter, instructorFilter);
};

// Loaded by showDashboard() (js/app/bootstrap.js) once the user is signed in
window.loadLmsStationsData = window.fetchLiveLmsStations;
