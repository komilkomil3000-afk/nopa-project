// LMS Stations Management & Directory Logic with Robust Station Finder & Modal Trigger
window.lmsStationsMasterList = [];

window.fetchLiveLmsStations = async function() {
  const tbody = document.getElementById('lms-directory-tbody');
  if (!tbody) return;

  try {
    const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    let res = await fetch('/api/v1/lms/stations', { headers });
    if (!res.ok) {
      res = await fetch('/api/v1/admin/lms/stations', { headers });
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
  let totalQuizzes = 0;

  window.lmsStationsMasterList.forEach(st => {
    const cats = st.categories || [];
    cats.forEach(c => {
      const sessList = c.sessions || [];
      totalSessions += sessList.length;
      sessList.forEach(s => {
        totalParts += (s.videoClips || []).length;
        totalQuizzes += (s.quizzes || []).length;
        (s.videoClips || []).forEach(clip => {
          totalQuizzes += (clip.quizzes || []).length;
        });
      });
    });
  });

  const statStationsEl = document.getElementById('lms-stat-stations');
  if (statStationsEl) statStationsEl.textContent = `${totalStations} منزلگاه`;

  const statSessionsEl = document.getElementById('lms-stat-sessions');
  if (statSessionsEl) statSessionsEl.textContent = `${totalSessions} جلسه مصوب`;

  const statQuizzesEl = document.getElementById('lms-stat-quizzes');
  if (statQuizzesEl) statQuizzesEl.textContent = `${totalParts} پارت (${totalQuizzes} آزمونک)`;

  window.filterLmsTable();
};

window.renderLmsDirectoryRows = function(list, selectedCategoryFilter = 'all', selectedInstructorFilter = 'all') {
  const tbody = document.getElementById('lms-directory-tbody');
  if (!tbody) return;

  if (!list || list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:24px; color:#94a3b8;">هیچ منزلگاهی با این فیلترها یافت نشد.</td></tr>';
    return;
  }

  const PERSIAN_NUMS = ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم', 'هفتم', 'هشتم', 'نهم', 'دهم'];
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
          <span class="badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.35); font-size:12px; padding:4px 9px; border-radius:6px; font-weight:600;">
            <i class="fa-solid fa-person-running" style="margin-left:4px;"></i> ${skillTopic}
          </span>
        </div>
      `;
    } else if (isMediaOnly) {
      topicsDisplayHtml = `
        <div style="display:flex; align-items:center; gap:6px;">
          <span class="badge" style="background:rgba(167,139,250,0.15); color:#c4b5fd; border:1px solid rgba(167,139,250,0.35); font-size:12px; padding:4px 9px; border-radius:6px; font-weight:600;">
            <i class="fa-solid fa-microphone-lines" style="margin-left:4px;"></i> ${mediaTopic}
          </span>
        </div>
      `;
    } else {
      topicsDisplayHtml = `
        <div style="display:flex; flex-direction:column; gap:4px;">
          <span class="badge" style="background:rgba(56,189,248,0.12); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); font-size:11.5px; padding:3px 8px; border-radius:6px; font-weight:600; display:inline-flex; align-items:center; gap:5px;">
            <i class="fa-solid fa-person-running" style="font-size:10px;"></i> <strong>مهارتی:</strong> ${skillTopic}
          </span>
          <span class="badge" style="background:rgba(167,139,250,0.12); color:#c4b5fd; border:1px solid rgba(167,139,250,0.3); font-size:11.5px; padding:3px 8px; border-radius:6px; font-weight:600; display:inline-flex; align-items:center; gap:5px;">
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
        <div style="display:flex; flex-wrap:wrap; gap:4px; max-width:200px;">
          ${Array.from(stationInstructors).map(inst => {
            const isMatch = selectedInstructorFilter !== 'all' && (inst.toLowerCase().includes(selectedInstructorFilter) || inst.replace(/‌/g, '').includes(selectedInstructorFilter.replace(/‌/g, '')));
            const badgeStyle = isMatch
              ? 'background:rgba(56,189,248,0.3); color:#38bdf8; border:1px solid #38bdf8;'
              : 'background:rgba(255,255,255,0.06); color:#cbd5e1; border:1px solid rgba(255,255,255,0.08);';
            return `<span class="badge" style="${badgeStyle} font-size:11px; padding:2px 7px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;">
              <i class="fa-solid fa-chalkboard-user" style="font-size:10px; color:#38bdf8;"></i> ${inst}
            </span>`;
          }).join('')}
        </div>
      `;
    } else {
      instructorsDisplayHtml = `
        <div style="font-size:11px; color:#94a3b8;">
          <i class="fa-solid fa-chalkboard-user"></i> اساتید دوره نپا
        </div>
      `;
    }

    let categoryBadgeHtml = '';
    let sessionsDisplayHtml = '';

    if (isSkillOnly) {
      categoryBadgeHtml = `<span class="badge" style="background:#0284c7; color:white; font-size:11px; padding:4px 10px; border-radius:6px;">دسته ۱: مهارتی (${skillSessCount} جلسه | ${skillPartsCount} پارت)</span>`;
      sessionsDisplayHtml = `
        <div style="font-weight:bold; color:#38bdf8; font-size:13px;">${skillSessCount} جلسه مهارتی</div>
        <div style="font-size:11px; color:#34d399; margin-top:2px;">🎬 ${skillPartsCount} پارت ویدیو</div>
        <div style="font-size:10px; color:#f59e0b; margin-top:2px;"><i class="fa-solid fa-file-signature"></i> ${skillQuizzesCount} آزمونک</div>
      `;
    } else if (isMediaOnly) {
      categoryBadgeHtml = `<span class="badge" style="background:#7c3aed; color:white; font-size:11px; padding:4px 10px; border-radius:6px;">دسته ۲: رسانه‌ای (${mediaSessCount} جلسه | ${mediaPartsCount} پارت)</span>`;
      sessionsDisplayHtml = `
        <div style="font-weight:bold; color:#a78bfa; font-size:13px;">${mediaSessCount} جلسه رسانه‌ای</div>
        <div style="font-size:11px; color:#34d399; margin-top:2px;">🎬 ${mediaPartsCount} پارت ویدیو</div>
        <div style="font-size:10px; color:#f59e0b; margin-top:2px;"><i class="fa-solid fa-file-signature"></i> ${mediaQuizzesCount} آزمونک</div>
      `;
    } else {
      categoryBadgeHtml = `
        <div style="display:flex; flex-direction:column; gap:4px; align-items:center;">
          <span class="badge" style="background:rgba(2,132,199,0.25); color:#38bdf8; border:1px solid rgba(56,189,248,0.4); font-size:11px; padding:3px 8px; border-radius:6px; width:92%;">
            🏃‍♂️ دسته ۱ (${skillSessCount} جلسه)
          </span>
          <span class="badge" style="background:rgba(124,58,237,0.25); color:#c4b5fd; border:1px solid rgba(167,139,250,0.4); font-size:11px; padding:3px 8px; border-radius:6px; width:92%;">
            🎬 دسته ۲ (${mediaSessCount} جلسه)
          </span>
        </div>
      `;
      sessionsDisplayHtml = `
        <div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
          <div style="font-weight:bold; color:white; font-size:13px;">
            <span style="color:#38bdf8;">${totalRealSess} جلسه</span> | <span style="color:#34d399;">${totalRealParts} پارت</span>
          </div>
          <div style="font-size:11px; color:#cbd5e1; display:flex; gap:6px;">
            <span style="color:#38bdf8;">${skillSessCount} مهارتی</span> + <span style="color:#a78bfa;">${mediaSessCount} رسانه‌ای</span>
          </div>
          <div style="font-size:10px; color:#fbbf24; background:rgba(245,158,11,0.12); padding:1px 6px; border-radius:4px; border:1px solid rgba(245,158,11,0.3); margin-top:2px;">
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
          <strong style="color:white; font-size:14px; display:flex; align-items:center; gap:6px;">
            <span style="color:#fbbf24;">📍</span> ${simpleStationName}
          </strong>
          <div style="font-size:11px; color:#94a3b8; margin-top:3px;">کد ترتیب: منزلگاه ${idx}</div>
        </td>
        <td>${topicsDisplayHtml}</td>
        <td>${instructorsDisplayHtml}</td>
        <td style="text-align:center;">${categoryBadgeHtml}</td>
        <td style="color:#cbd5e1; font-size:12px;">
          <div style="display:flex; align-items:center; gap:5px; color:#38bdf8; font-weight:bold;">
            <i class="fa-solid fa-calendar-days"></i> ${releaseDateStr}
          </div>
        </td>
        <td style="text-align:center;">${sessionsDisplayHtml}</td>
        <td style="text-align:center;">
          <span class="badge badge-active" style="font-size:11px; padding:3px 8px;">فعال</span>
        </td>
        <td style="text-align:center;">
          <div style="display:flex; justify-content:center; gap:6px; flex-wrap:wrap;">
            <button type="button" class="page-btn" style="background:#0284c7; color:white; padding:5px 10px; font-size:11px; border-radius:6px; border:none; cursor:pointer;" onclick="window.openStationContentManagerModal('${stationIdentifier}', '${selectedCategoryFilter}')" title="مدیریت پارت‌ها و آزمونک‌ها">
              <i class="fa-solid fa-film"></i> پارت‌ها
            </button>
            <button type="button" class="page-btn" style="background:#3b82f6; color:white; padding:5px 10px; font-size:11px; border-radius:6px; border:none; cursor:pointer;" onclick="window.editStationModal('${stationIdentifier}')" title="ویرایش عنوان و تقویم">
              <i class="fa-solid fa-pen-to-square"></i> ویرایش
            </button>
            <button type="button" class="page-btn" style="background:#ef4444; color:white; padding:5px 10px; font-size:11px; border-radius:6px; border:none; cursor:pointer;" onclick="window.deleteStationRecord('${stationIdentifier}')" title="حذف">
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

// ==================== CONTENT MANAGER MODAL (VIDEO LINKS & QUIZZES PER PART) ====================

window.openStationContentManagerModal = function(stationId, filterCat) {
  if (!window.lmsStationsMasterList || window.lmsStationsMasterList.length === 0) return;

  const currentCatFilter = filterCat || document.getElementById('lms-filter-category')?.value || 'all';

  // Flexible Station Finder
  let station = window.lmsStationsMasterList.find(s => 
    s.id === stationId || 
    s.id == stationId || 
    ('MZ' + (s.orderIndex || s.index)) === stationId || 
    s.orderIndex == stationId
  );

  if (!station) {
    const idxNum = parseInt(String(stationId).replace(/\D/g, ''));
    if (idxNum && idxNum > 0 && idxNum <= window.lmsStationsMasterList.length) {
      station = window.lmsStationsMasterList[idxNum - 1];
    } else {
      station = window.lmsStationsMasterList[0];
    }
  }

  if (!station) return;

  window.currentActiveContentStationId = station.id;

  const modal = document.getElementById('lms-content-manager-modal');
  if (!modal) return;

  const PERSIAN_NUMS = ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم', 'هفتم', 'هشتم', 'نهم', 'دهم'];
  const stationIdx = station.orderIndex || 1;
  const simpleStationName = PERSIAN_NUMS[stationIdx - 1] ? `منزلگاه ${PERSIAN_NUMS[stationIdx - 1]}` : `منزلگاه ${stationIdx}`;

  let filterTitleSuffix = '';
  if (currentCatFilter === 'مهارتی' || currentCatFilter === 'skill') {
    filterTitleSuffix = ' <span style="font-size:12px; color:#38bdf8; font-weight:normal; background:rgba(2,132,199,0.2); padding:2px 8px; border-radius:10px; margin-right:6px;">(فقط کلاس‌های مهارتی)</span>';
  } else if (currentCatFilter === 'رسانه‌ای' || currentCatFilter === 'media') {
    filterTitleSuffix = ' <span style="font-size:12px; color:#a78bfa; font-weight:normal; background:rgba(124,58,237,0.2); padding:2px 8px; border-radius:10px; margin-right:6px;">(فقط کلاس‌های رسانه‌ای)</span>';
  }

  const titleEl = document.getElementById('lms-content-modal-title');
  if (titleEl) {
    titleEl.innerHTML = `<i class="fa-solid fa-film" style="color:#38bdf8;"></i> مدیریت پارت‌ها، ویدیوها و آزمونک‌های ${simpleStationName}${filterTitleSuffix}`;
  }

  const container = document.getElementById('lms-content-modal-body');
  if (!container) return;

  let releaseDateStr = '';
  if (station.releaseDate) {
    try {
      releaseDateStr = new Date(station.releaseDate).toISOString().split('T')[0];
    } catch (e) {}
  }

  window.lmsInitialModalState = {
    title: simpleStationName,
    date: releaseDateStr,
    desc: station.description || ''
  };

  let categories = station.categories || [];

  // Filter categories according to selected category filter
  if (currentCatFilter === 'مهارتی' || currentCatFilter === 'skill') {
    categories = categories.filter(c => c.orderIndex === 1 || (c.title && c.title.includes('مهارت')));
  } else if (currentCatFilter === 'رسانه‌ای' || currentCatFilter === 'media') {
    categories = categories.filter(c => c.orderIndex === 2 || (c.title && c.title.includes('رسانه')));
  }

  // --- SECTION 1: STATION BASIC INFO & CONTENT EDITOR CARD ---
  let html = `
    <div style="background:rgba(15, 23, 42, 0.95); border:1px solid rgba(56, 189, 248, 0.35); border-radius:12px; padding:16px; margin-bottom:20px; box-shadow:0 4px 15px rgba(0,0,0,0.3);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px;">
        <div style="font-size:14px; font-weight:bold; color:#38bdf8; display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-pen-to-square"></i> مشخصات، عنوان و محتوای ${simpleStationName}
        </div>
        <span class="badge" style="background:#0284c7; color:white; padding:4px 12px; border-radius:6px; font-size:12px; font-weight:bold;">
          کد: MZ${stationIdx} (${simpleStationName})
        </span>
      </div>

      <div style="display:grid; grid-template-columns: 120px 1.8fr 1.2fr; gap:12px; margin-bottom:12px;">
        <div>
          <label style="font-size:11px; color:#cbd5e1; display:block; margin-bottom:4px;"><i class="fa-solid fa-hashtag" style="color:#38bdf8;"></i> شماره منزلگاه:</label>
          <input type="number" id="content-modal-st-order" class="input-ctrl" value="${stationIdx}" readonly style="background:#0f172a; border-color:#334155; color:#38bdf8; font-weight:bold; cursor:not-allowed; text-align:center;" title="شماره منزلگاه یکتاست. برای جابجایی ترتیب از دکمه مرتب‌سازی منزلگاه‌ها استفاده فرمایید.">
        </div>
        <div>
          <label style="font-size:11px; color:#cbd5e1; display:block; margin-bottom:4px;"><i class="fa-solid fa-graduation-cap" style="color:#38bdf8;"></i> نام و عنوان منزلگاه:</label>
          <input type="text" id="content-modal-st-title" class="input-ctrl" value="${simpleStationName}" placeholder="عنوان منزلگاه..." style="background:#0f172a; border-color:#475569; font-weight:bold; color:white;">
        </div>
        <div>
          <label style="font-size:11px; color:#cbd5e1; display:block; margin-bottom:4px;"><i class="fa-solid fa-calendar-days" style="color:#38bdf8;"></i> تاریخ انتشار تقویم:</label>
          <input type="date" id="content-modal-st-date" class="input-ctrl" value="${releaseDateStr}" style="background:#0f172a; color:white; border-color:#475569;">
        </div>
      </div>

      <div style="margin-bottom:12px;">
        <label style="font-size:11px; color:#cbd5e1; display:block; margin-bottom:4px;"><i class="fa-solid fa-align-right" style="color:#38bdf8;"></i> سرفصل‌ها، اهداف و محتوای کلی منزلگاه:</label>
        <textarea id="content-modal-st-desc" class="input-ctrl" rows="2" placeholder="توضیحات و سرفصل‌های آموزشی این منزلگاه..." style="background:#0f172a; border-color:#475569;">${station.description || ''}</textarea>
      </div>

      <div style="display:flex; justify-content:flex-end;">
        <button type="button" onclick="window.saveStationBasicInfoFromContentModal('${station.id}')" style="background:linear-gradient(135deg, #0284c7, #0369a1); color:white; border:none; border-radius:8px; padding:8px 20px; font-size:12px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:6px; box-shadow:0 2px 6px rgba(0,0,0,0.3);">
          <i class="fa-solid fa-check"></i> ذخیره تغییرات نام و محتوای منزلگاه
        </button>
      </div>
    </div>
  `;

  if (categories.length === 0) {
    html += '<div style="text-align:center; color:#94a3b8; padding:20px;">هیچ دسته‌بندی با این فیلتر برای این منزلگاه پیدا نشد.</div>';
    container.innerHTML = html;
    modal.style.display = 'flex';
    modal.style.zIndex = '999999';
    return;
  }

  // --- SECTION 2: CATEGORIES, SESSIONS, VIDEO CLIPS (WITH REORDER) & QUIZZES ---
  categories.forEach(cat => {
    const isSkill = cat.orderIndex === 1 || (cat.title && cat.title.includes('مهارت'));
    const color = isSkill ? '#38bdf8' : '#a78bfa';
    const bg = isSkill ? 'rgba(2, 132, 199, 0.12)' : 'rgba(124, 58, 237, 0.12)';
    const sessions = cat.sessions || [];

    html += `
      <div style="background:${bg}; border:1px solid ${color}44; border-radius:12px; padding:16px; margin-bottom:20px;">
        
        <!-- Editable Category Header & Controls -->
        <div style="margin:0 0 14px 0; background:rgba(15, 23, 42, 0.85); border:1px solid ${color}55; border-radius:10px; padding:12px 14px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
          <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:280px;">
            <span class="badge" style="background:${isSkill ? '#0284c7' : '#7c3aed'}; color:white; padding:5px 10px; border-radius:6px; font-size:12px; font-weight:bold; white-space:nowrap;">
              ${isSkill ? 'دسته ۱ (مهارتی)' : 'دسته ۲ (رسانه‌ای)'}
            </span>
            <div style="flex:1; display:flex; align-items:center; gap:6px;">
              <label style="font-size:11px; color:#cbd5e1; white-space:nowrap;"><i class="fa-solid fa-pen" style="color:${color};"></i> عنوان دسته کلاس:</label>
              <input type="text" id="cat-title-${cat.id}" class="input-ctrl" value="${cat.title || (isSkill ? 'کلاس‌های مهارتی' : 'کلاس‌های رسانه‌ای')}" placeholder="عنوان دسته کلاس..." style="background:#0f172a; border-color:${color}66; color:white; font-weight:bold; font-size:13px; padding:6px 12px;">
            </div>
          </div>
          
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:12px; color:#cbd5e1; background:rgba(0,0,0,0.4); padding:5px 12px; border-radius:6px; border:1px solid rgba(255,255,255,0.06); font-weight:bold;">
              ${sessions.length} جلسه
            </span>
            <button type="button" onclick="window.saveCategoryTitle('${cat.id}', '${station.id}')" style="background:linear-gradient(135deg, ${color}, ${isSkill ? '#0284c7' : '#6d28d9'}); color:white; border:none; padding:6px 14px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:6px; box-shadow:0 2px 6px rgba(0,0,0,0.3);" title="ذخیره مستقیم عنوان این دسته">
              <i class="fa-solid fa-save"></i> ذخیره عنوان دسته
            </button>
          </div>
        </div>

        <!-- Quick Batch Zarik Allocation Tool for this entire Category -->
        <div style="background:rgba(245, 158, 11, 0.09); border:1px dashed rgba(245, 158, 11, 0.4); border-radius:8px; padding:10px 14px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <i class="fa-solid fa-coins" style="color:#fbbf24; font-size:18px;"></i>
            <div>
              <div style="font-weight:bold; color:#fbbf24; font-size:12px;">تخصیص یکجای پاداش زریک برای تمام پارت‌ها و آزمونک‌های این دسته:</div>
              <div style="font-size:11px; color:#94a3b8;">با یک کلیک، پاداش تمامی آزمونک‌های این دسته تعیین شده و پس از پاسخ صحیح به دانش‌آموز اعطا می‌گردد.</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <label style="font-size:11px; color:#cbd5e1;">پاداش هر پارت:</label>
            <input type="number" id="batch-zarik-cat-${cat.id}" class="input-ctrl" value="15" min="1" max="1000" style="width:65px; padding:5px 6px; text-align:center; background:#0f172a; border-color:#f59e0b; color:#fbbf24; font-weight:bold; font-size:12px;">
            <button type="button" onclick="window.applyBatchZarikToCategory('${cat.id}', '${station.id}')" style="background:linear-gradient(135deg, #f59e0b, #d97706); color:black; font-weight:bold; border:none; padding:6px 12px; border-radius:6px; font-size:11px; cursor:pointer; display:flex; align-items:center; gap:6px;">
              <i class="fa-solid fa-bolt"></i> اعمال روی کل این دسته
            </button>
          </div>
        </div>
    `;

    if (sessions.length === 0) {
      html += '<div style="color:#cbd5e1; font-size:12px; padding:10px;">جلسه‌ای در این دسته ثبت نشده است.</div>';
    } else {
      sessions.forEach((sess, sIdx) => {
        const clips = (sess.videoClips || []).sort((a, b) => (Number(a.clipOrder) || 0) - (Number(b.clipOrder) || 0));
        const quizzes = sess.quizzes || [];

        html += `
          <div style="background:rgba(15, 23, 42, 0.85); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:14px; margin-bottom:14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:8px;">
              <div>
                <strong style="color:white; font-size:13px; display:flex; align-items:center; gap:6px;">
                  <i class="fa-solid fa-book-open" style="color:${color};"></i> ${sess.title}
                </strong>
                <span style="font-size:11px; color:#94a3b8; margin-top:2px; display:block;">مدرس: ${sess.instructor || (isSkill ? 'پیراینه‌گر' : 'علیرضا خوش‌منظر')}</span>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:11px; color:#94a3b8; background:rgba(255,255,255,0.05); padding:3px 8px; border-radius:6px;">
                  ${clips.length} پارت ویدیو | ${quizzes.length} آزمونک
                </span>
                <button type="button" style="background:#0284c7; color:white; border:none; border-radius:6px; padding:4px 10px; font-size:11px; cursor:pointer;" onclick="window.addNewClipToSession('${sess.id}')">
                  <i class="fa-solid fa-plus"></i> + افزودن پارت جدید
                </button>
              </div>
            </div>

            <!-- Video Clips List & Link Editor with Order Adjustment -->
            <div style="margin-bottom:10px;">
              <div style="font-size:12px; color:#38bdf8; font-weight:bold; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                <i class="fa-solid fa-film"></i> پارت‌های ویدیویی (امکان جابجایی ترتیب با دکمه‌های بالا/پایین، ویرایش لینک و آزمونک):
              </div>
        `;

        if (clips.length === 0) {
          html += `
            <div style="color:#94a3b8; font-size:12px; background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; text-align:center;">
              پارتی برای این جلسه تعریف نشده است. 
              <button type="button" style="background:#0284c7; color:white; border:none; border-radius:4px; padding:4px 10px; font-size:11px; margin-right:8px; cursor:pointer;" onclick="window.addNewClipToSession('${sess.id}')">+ ایجاد اولین پارت</button>
            </div>`;
        } else {
          clips.forEach((clip, cIdx) => {
            const isFirstClip = cIdx === 0;
            const isLastClip = cIdx === clips.length - 1;

            html += `
              <div style="background:rgba(30, 41, 59, 0.9); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:12px; margin-bottom:10px;">
                <div style="display:grid; grid-template-columns: 85px 1.4fr 2fr auto; gap:10px; align-items:center; margin-bottom:8px;">
                  
                  <!-- Part Order with Up/Down Buttons -->
                  <div>
                    <label style="font-size:11px; color:#38bdf8; display:block; margin-bottom:3px; font-weight:bold;">ترتیب پارت:</label>
                    <div style="display:flex; align-items:center; gap:4px;">
                      <input type="number" id="clip-order-${clip.id}" min="1" max="50" class="input-ctrl" style="font-size:12px; padding:4px; text-align:center; background:#0f172a; font-weight:bold; color:#38bdf8; width:45px;" value="${clip.clipOrder || (cIdx + 1)}">
                      <div style="display:flex; flex-direction:column; gap:2px;">
                        <button type="button" onclick="window.moveClipInSession('${sess.id}', ${cIdx}, ${cIdx - 1})" ${isFirstClip ? 'disabled' : ''} style="background:${isFirstClip ? 'rgba(255,255,255,0.03)' : '#1e293b'}; color:${isFirstClip ? '#475569' : '#38bdf8'}; border:1px solid ${isFirstClip ? 'transparent' : 'rgba(56,189,248,0.3)'}; border-radius:3px; width:20px; height:15px; font-size:9px; cursor:${isFirstClip ? 'not-allowed' : 'pointer'}; display:flex; align-items:center; justify-content:center;" title="حرکت به بالا">▲</button>
                        <button type="button" onclick="window.moveClipInSession('${sess.id}', ${cIdx}, ${cIdx + 1})" ${isLastClip ? 'disabled' : ''} style="background:${isLastClip ? 'rgba(255,255,255,0.03)' : '#1e293b'}; color:${isLastClip ? '#475569' : '#38bdf8'}; border:1px solid ${isLastClip ? 'transparent' : 'rgba(56,189,248,0.3)'}; border-radius:3px; width:20px; height:15px; font-size:9px; cursor:${isLastClip ? 'not-allowed' : 'pointer'}; display:flex; align-items:center; justify-content:center;" title="حرکت به پایین">▼</button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style="font-size:11px; color:#cbd5e1; display:block; margin-bottom:3px;">عنوان پارت:</label>
                    <input type="text" id="clip-title-${clip.id}" class="input-ctrl" style="font-size:12px; padding:6px 10px; background:#0f172a;" value="${clip.title || ''}" placeholder="عنوان پارت...">
                  </div>
                  <div>
                    <label style="font-size:11px; color:#38bdf8; display:block; margin-bottom:3px;"><i class="fa-solid fa-video"></i> لینک ویدیو (آپارات یا URL مستقیم):</label>
                    <input type="text" id="clip-url-${clip.id}" class="input-ctrl" style="font-size:12px; padding:6px 10px; direction:ltr; background:#0f172a;" value="${clip.videoUrl || ''}" placeholder="https://www.aparat.com/v/...">
                  </div>
                  <div style="display:flex; gap:6px; align-items:flex-end; padding-top:16px;">
                    <button type="button" style="background:#0284c7; color:white; border:none; border-radius:6px; padding:7px 12px; font-size:11px; cursor:pointer;" onclick="window.saveClipVideoUrl('${sess.id}', '${clip.id}')" title="ذخیره ترتیب، عنوان و لینک ویدیو">
                      <i class="fa-solid fa-save"></i> ذخیره
                    </button>
                    <button type="button" style="background:#10b981; color:white; border:none; border-radius:6px; padding:7px 12px; font-size:11px; cursor:pointer;" onclick="window.openQuizModalForClip('${sess.id}', '${clip.id}')" title="افزودن آزمونک برای این پارت">
                      <i class="fa-solid fa-circle-question"></i> + آزمونک
                    </button>
                    <button type="button" style="background:rgba(239, 68, 68, 0.2); color:#ef4444; border:1px solid rgba(239, 68, 68, 0.4); border-radius:6px; padding:7px 10px; font-size:11px; cursor:pointer;" onclick="window.deleteClipRecord('${clip.id}', '${sess.id}')" title="حذف این پارت">
                      <i class="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </div>

                <!-- Per-Part Quiz Inspector & Manager -->
                <div style="background:rgba(15, 23, 42, 0.75); border-right:3px solid #f59e0b; padding:10px 14px; margin-top:10px; border-radius:8px; border:1px solid rgba(245, 158, 11, 0.2);">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div style="font-size:12px; color:#f59e0b; font-weight:bold; display:flex; align-items:center; gap:6px;">
                      <i class="fa-solid fa-circle-question"></i> آزمونک‌های تستی انتهای پارت ${clip.clipOrder || (cIdx + 1)}:
                    </div>
                    <button type="button" style="background:#f59e0b; color:black; border:none; padding:4px 10px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:4px;" onclick="window.openQuizModalForClip('${sess.id}', '${clip.id}')">
                      <i class="fa-solid fa-plus"></i> + طراحی آزمونک جدید برای این پارت
                    </button>
                  </div>
            `;

            const allSessionQuizzes = sess.quizzes || [];
            const clipQuizzes = (clip.quizzes && clip.quizzes.length > 0)
              ? clip.quizzes
              : allSessionQuizzes.filter(q => q.clipId === clip.id || (!q.clipId && q.orderIndex === (clip.clipOrder || cIdx + 1)));

            if (clipQuizzes.length === 0) {
              html += `
                <div style="font-size:11px; color:#94a3b8; background:rgba(0,0,0,0.2); padding:8px 12px; border-radius:6px;">
                  هنوز آزمونکی برای پایان این پارت ثبت نشده است. با زدن دکمه «+ طراحی آزمونک جدید» می‌توانید سوال، گزینه‌ها و پاداش زریک این پارت را تنظیم نمایید.
                </div>`;
            } else {
              clipQuizzes.forEach((quiz, qIdx) => {
                let questionText = 'متن سوال آزمونک';
                let opts = ['گزینه اول', 'گزینه دوم', 'گزینه سوم', 'گزینه چهارم'];
                let correctIdx = 0;

                if (quiz.questionsJson) {
                  try {
                    const parsed = typeof quiz.questionsJson === 'string' ? JSON.parse(quiz.questionsJson) : quiz.questionsJson;
                    if (Array.isArray(parsed) && parsed[0]) {
                      questionText = parsed[0].question || questionText;
                      if (Array.isArray(parsed[0].options)) opts = parsed[0].options;
                      correctIdx = parsed[0].correctIndex ?? 0;
                    }
                  } catch (e) {
                    console.error('Quiz parse error:', e);
                  }
                }

                html += `
                  <div style="background:rgba(30, 41, 59, 0.9); border:1px solid rgba(245, 158, 11, 0.35); border-radius:8px; padding:12px; margin-bottom:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <span style="background:linear-gradient(135deg, #f59e0b, #d97706); color:black; font-weight:bold; padding:2px 8px; border-radius:5px; font-size:11px;">
                          آزمونک ${qIdx + 1}: ${quiz.title || 'آزمونک پارت'}
                        </span>
                        <span style="background:rgba(245, 158, 11, 0.15); color:#fbbf24; border:1px solid rgba(245, 158, 11, 0.4); font-size:11px; padding:2px 8px; border-radius:5px; font-weight:bold; display:inline-flex; align-items:center; gap:4px;">
                          <i class="fa-solid fa-coins" style="color:#fbbf24;"></i> پاداش زریک: ${quiz.rewardZarik ?? 10} زریک
                        </span>
                      </div>
                      <div style="display:flex; gap:6px;">
                        <button type="button" style="background:#f59e0b; color:black; border:none; padding:4px 10px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:bold; display:flex; align-items:center; gap:4px;" onclick="window.editQuizRecord('${quiz.id}')" title="ویرایش سوال، گزینه‌ها و پاداش">
                          <i class="fa-solid fa-pen"></i> ویرایش سوال و گزینه‌ها
                        </button>
                        <button type="button" style="background:rgba(239, 68, 68, 0.2); color:#ef4444; border:1px solid rgba(239, 68, 68, 0.4); padding:4px 8px; border-radius:6px; font-size:11px; cursor:pointer;" onclick="window.deleteQuizRecord('${quiz.id}')" title="حذف آزمونک">
                          <i class="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </div>

                    <div style="font-weight:bold; color:#f8fafc; font-size:12px; margin-bottom:8px; background:rgba(15,23,42,0.6); padding:8px 12px; border-radius:6px; border:1px solid rgba(255,255,255,0.06);">
                      <i class="fa-solid fa-question-circle" style="color:#38bdf8;"></i> متن سوال: ${questionText}
                    </div>

                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:11px;">
                      ${opts.map((opt, oIdx) => `
                        <div style="background:${oIdx === correctIdx ? 'rgba(16, 185, 129, 0.15)' : 'rgba(15, 23, 42, 0.5)'}; border:1px solid ${oIdx === correctIdx ? '#10b981' : 'rgba(255, 255, 255, 0.06)'}; color:${oIdx === correctIdx ? '#34d399' : '#cbd5e1'}; padding:5px 8px; border-radius:6px; display:flex; align-items:center; gap:6px;">
                          <span style="font-size:12px;">${oIdx === correctIdx ? '✅' : '⚪'}</span>
                          <span><strong>گزینه ${oIdx + 1}:</strong> ${opt || '-'}</span>
                          ${oIdx === correctIdx ? '<span style="color:#10b981; font-weight:bold; margin-right:auto; font-size:10px;">(پاسخ صحیح)</span>' : ''}
                        </div>
                      `).join('')}
                    </div>
                  </div>
                `;
              });
            }

            html += `
                </div>
              </div>
            `;
          });
        }

        html += `</div>`;
      });
    }

    html += `</div>`;
  });

  container.innerHTML = html;
  modal.style.display = 'flex';
  modal.style.zIndex = '999999';
};

window.saveStationBasicInfoFromContentModal = async function(stationId) {
  const title = document.getElementById('content-modal-st-title')?.value;
  const description = document.getElementById('content-modal-st-desc')?.value;
  const releaseDate = document.getElementById('content-modal-st-date')?.value;

  const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
  try {
    const res = await fetch(`/api/v1/admin/lms/stations/${stationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({ id: stationId, title, description, releaseDate })
    });
    if (res.ok) {
      alert('مشخصات و محتوای کلی منزلگاه با موفقیت ذخیره شد');
      await window.fetchLiveLmsStations();
      window.openStationContentManagerModal(stationId);
    } else {
      const data = await res.json();
      alert('خطا در ذخیره مشخصات: ' + (data.error || 'خطای ناشناخته'));
    }
  } catch (err) {
    console.error('Save Station Basic Info Error:', err);
    alert('ارتباط با سرور برقرار نشد');
  }
};

window.moveClipInSession = async function(sessionId, fromIdx, toIdx) {
  let foundSession = null;
  let foundStation = null;
  window.lmsStationsMasterList.forEach(st => {
    (st.categories || []).forEach(cat => {
      (cat.sessions || []).forEach(sess => {
        if (sess.id === sessionId) {
          foundSession = sess;
          foundStation = st;
        }
      });
    });
  });

  if (!foundSession || !foundSession.videoClips || toIdx < 0 || toIdx >= foundSession.videoClips.length) return;

  const clips = [...foundSession.videoClips].sort((a, b) => (Number(a.clipOrder) || 0) - (Number(b.clipOrder) || 0));
  const moved = clips.splice(fromIdx, 1)[0];
  clips.splice(toIdx, 0, moved);

  const clipIds = clips.map(c => c.id);
  const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';

  try {
    const res = await fetch(`/api/v1/admin/lms/sessions/${sessionId}/clips/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({ clipIds })
    });
    if (res.ok) {
      await window.fetchLiveLmsStations();
      if (foundStation) window.openStationContentManagerModal(foundStation.id);
    } else {
      alert('خطا در تغییر ترتیب پارت‌ها');
    }
  } catch (err) {
    console.error('Reorder clips error:', err);
  }
};

window.addNewClipToSession = async function(sessionId) {
  const title = prompt('عنوان پارت جدید را وارد نمایید:', 'پارت جدید');
  if (!title) return;

  const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
  try {
    const res = await fetch('/api/v1/admin/lms/clips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({ sessionId, title, videoUrl: '', clipOrder: 99 })
    });
    if (res.ok) {
      await window.fetchLiveLmsStations();
      const st = window.lmsStationsMasterList.find(s => 
        (s.categories || []).some(c => (c.sessions || []).some(sess => sess.id === sessionId))
      );
      if (st) window.openStationContentManagerModal(st.id);
    } else {
      alert('خطا در ایجاد پارت جدید');
    }
  } catch (err) {
    console.error('Add clip error:', err);
  }
};

window.deleteClipRecord = async function(clipId, sessionId) {
  if (!confirm('آیا از حذف این پارت ویدیو و تمام آزمونک‌های متصل به آن اطمینان دارید؟')) return;
  const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
  try {
    const res = await fetch(`/api/v1/admin/lms/clips/${clipId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
    });
    if (res.ok) {
      await window.fetchLiveLmsStations();
      const st = window.lmsStationsMasterList.find(s => 
        (s.categories || []).some(c => (c.sessions || []).some(sess => sess.id === sessionId))
      );
      if (st) window.openStationContentManagerModal(st.id);
    } else {
      alert('خطا در حذف پارت');
    }
  } catch (err) {
    console.error('Delete clip error:', err);
  }
};

window.saveClipVideoUrl = async function(sessionId, clipId) {
  const title = document.getElementById(`clip-title-${clipId}`)?.value;
  const videoUrl = document.getElementById(`clip-url-${clipId}`)?.value;
  const clipOrder = parseInt(document.getElementById(`clip-order-${clipId}`)?.value) || undefined;

  const payload = {
    clipId: clipId,
    sessionId: sessionId,
    title: title || 'پارت ویدیو',
    videoUrl: videoUrl || '',
    clipOrder: clipOrder
  };

  const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
  try {
    const res = await fetch('/api/v1/admin/lms/clips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      alert('ترتیب، عنوان و مشخصات پارت با موفقیت ذخیره شد');
      await window.fetchLiveLmsStations();
      const st = window.lmsStationsMasterList.find(s => 
        (s.categories || []).some(c => (c.sessions || []).some(sess => sess.id === sessionId))
      );
      if (st) window.openStationContentManagerModal(st.id);
    } else {
      alert('خطا در ذخیره‌سازی مشخصات پارت');
    }
  } catch (err) {
    console.error('Save clip error:', err);
    alert('ارتباط با سرور برقرار نشد');
  }
};

window.saveCategoryTitle = async function(categoryId, stationId) {
  const title = document.getElementById(`cat-title-${categoryId}`)?.value;
  if (!title) {
    alert('لطفاً عنوان دسته کلاس را وارد نمایید.');
    return;
  }

  const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
  try {
    const res = await fetch('/api/v1/admin/lms/classes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ id: categoryId, title })
    });

    if (res.ok) {
      alert('✅ عنوان دسته کلاس با موفقیت ذخیره شد.');
      await window.fetchLiveLmsStations();
    } else {
      const d = await res.json();
      alert('خطا در ذخیره‌سازی: ' + (d.error || 'خطای سرور'));
    }
  } catch (err) {
    console.error('Save category title error:', err);
    alert('ارتباط با سرور برقرار نشد: ' + err.message);
  }
};

window.cancelLmsContentManagerModal = function() {
  const modal = document.getElementById('lms-content-manager-modal');
  if (!modal) return;

  const curTitle = document.getElementById('content-modal-st-title')?.value || '';
  const curDate = document.getElementById('content-modal-st-date')?.value || '';
  const curDesc = document.getElementById('content-modal-st-desc')?.value || '';

  const isDirty = window.lmsInitialModalState && (
    curTitle !== window.lmsInitialModalState.title ||
    curDate !== window.lmsInitialModalState.date ||
    curDesc !== window.lmsInitialModalState.desc
  );

  if (isDirty) {
    if (!confirm('تغییراتی در مشخصات منزلگاه یا پارت‌ها داده‌اید که هنوز ثبت نهایی نشده‌اند. آیا از انصراف و بستن پنجره اطمینان دارید؟')) {
      return;
    }
  }

  modal.style.display = 'none';
};

window.openFinalLmsSaveConfirmationModal = function() {
  const stationId = window.currentActiveContentStationId;
  if (!stationId) {
    alert('شناسه منزلگاه یافت نشد.');
    return;
  }

  const station = window.lmsStationsMasterList.find(s => s.id === stationId);
  const stTitle = document.getElementById('content-modal-st-title')?.value || station?.title || 'منزلگاه';
  const stDate = document.getElementById('content-modal-st-date')?.value || '';
  
  // Count clips currently in modal
  const clipOrderInputs = document.querySelectorAll('input[id^="clip-order-"]');
  const clipCount = clipOrderInputs.length;

  const summaryEl = document.getElementById('lms-confirm-summary-list');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px;">
        <div><strong>📌 نام منزلگاه:</strong> <span style="color:#38bdf8; font-weight:bold;">${stTitle}</span></div>
        <div><strong>📅 تاریخ انتشار:</strong> <span style="color:#fbbf24; font-weight:bold;">${stDate || 'تعیین‌نشده'}</span></div>
        <div><strong>🎬 پارت‌های ویدیویی:</strong> <span style="color:#10b981; font-weight:bold;">${clipCount} پارت</span></div>
        <div><strong>⚡ وضعیت اعمال:</strong> <span style="color:#a78bfa; font-weight:bold;">ذخیره‌سازی یکجا و آنی</span></div>
      </div>
    `;
  }

  const confirmModal = document.getElementById('lms-final-confirm-modal');
  if (confirmModal) {
    confirmModal.style.display = 'flex';
    confirmModal.style.zIndex = '99999999';
  }
};

window.executeFinalLmsSave = async function() {
  const stationId = window.currentActiveContentStationId;
  if (!stationId) return;

  const confirmBtn = document.getElementById('btn-confirm-save-lms-final');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> در حال ذخیره‌سازی نهایی...';
  }

  try {
    const stationTitle = document.getElementById('content-modal-st-title')?.value;
    const releaseDate = document.getElementById('content-modal-st-date')?.value;
    const stationDescription = document.getElementById('content-modal-st-desc')?.value;

    // Collect all category modifications
    const categoriesPayload = [];
    const catTitleInputs = document.querySelectorAll('input[id^="cat-title-"]');
    catTitleInputs.forEach(input => {
      const catId = input.id.replace('cat-title-', '');
      const title = input.value || '';
      categoriesPayload.push({
        id: catId,
        title
      });
    });

    // Collect all clip modifications
    const clipsPayload = [];
    const clipOrderInputs = document.querySelectorAll('input[id^="clip-order-"]');
    clipOrderInputs.forEach(input => {
      const clipId = input.id.replace('clip-order-', '');
      const clipOrder = parseInt(input.value) || 1;
      const title = document.getElementById(`clip-title-${clipId}`)?.value || '';
      const videoUrl = document.getElementById(`clip-url-${clipId}`)?.value || '';
      clipsPayload.push({
        id: clipId,
        title,
        videoUrl,
        clipOrder
      });
    });

    const payload = {
      stationTitle,
      releaseDate: releaseDate || undefined,
      stationDescription,
      categories: categoriesPayload,
      clips: clipsPayload
    };

    const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
    const res = await fetch(`/api/v1/admin/lms/stations/${stationId}/batch-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      document.getElementById('lms-final-confirm-modal').style.display = 'none';
      document.getElementById('lms-content-manager-modal').style.display = 'none';

      alert('✅ کلیه تغییرات منزلگاه، دسته‌های کلاس و پارت‌های ویدیو با موفقیت ثبت نهایی و در پایگاه‌داده ذخیره شد.');
      await window.fetchLiveLmsStations();
    } else {
      const d = await res.json();
      alert('خطا در ثبت نهایی: ' + (d.error || 'خطای سرور'));
    }
  } catch (err) {
    console.error('Final LMS save error:', err);
    alert('ارتباط با سرور برقرار نشد: ' + err.message);
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<i class="fa-solid fa-check-double"></i> تایید نهایی و ذخیره در دیتابیس';
    }
  }
};

// ==================== QUIZ EDITOR MODAL ====================

window.openQuizModalForClip = function(sessionId, clipId) {
  const modal = document.getElementById('lms-quiz-editor-modal');
  if (!modal) return;

  document.getElementById('lms-quiz-form').reset();
  document.getElementById('quiz-modal-id').value = '';
  document.getElementById('quiz-modal-session-id').value = sessionId;
  document.getElementById('quiz-modal-clip-id').value = clipId;

  document.getElementById('quiz-modal-title-input').value = 'آزمونک پارت ویدیو';
  document.getElementById('quiz-modal-zarik').value = 10;
  document.getElementById('quiz-modal-q-text').value = 'مفهوم اصلی مطرح‌شده در این پارت کدام است؟';

  document.getElementById('quiz-opt-0').value = 'گزینه صحیح (پاسخ درست)';
  document.getElementById('quiz-opt-1').value = 'گزینه نادرست اول';
  document.getElementById('quiz-opt-2').value = 'گزینه نادرست دوم';
  document.getElementById('quiz-opt-3').value = 'گزینه نادرست سوم';
  document.getElementById('opt-radio-0').checked = true;

  modal.style.display = 'flex';
  modal.style.zIndex = '1000000';
};

window.openQuizModalForClip = function(sessionId, clipId) {
  const modal = document.getElementById('lms-quiz-editor-modal');
  if (!modal) return;

  document.getElementById('lms-quiz-form').reset();
  document.getElementById('quiz-modal-id').value = '';
  document.getElementById('quiz-modal-session-id').value = sessionId;
  document.getElementById('quiz-modal-clip-id').value = clipId;

  document.getElementById('quiz-modal-title-input').value = 'آزمونک پارت ویدیو';
  document.getElementById('quiz-modal-zarik').value = 10;
  document.getElementById('quiz-modal-q-text').value = 'مفهوم اصلی مطرح‌شده در این پارت کدام است؟';

  document.getElementById('quiz-opt-0').value = 'گزینه صحیح (پاسخ درست)';
  document.getElementById('quiz-opt-1').value = 'گزینه نادرست اول';
  document.getElementById('quiz-opt-2').value = 'گزینه نادرست دوم';
  document.getElementById('quiz-opt-3').value = 'گزینه نادرست سوم';
  document.getElementById('opt-radio-0').checked = true;

  document.getElementById('quiz-modal-title').innerHTML = '<i class="fa-solid fa-circle-question"></i> طراحی آزمونک جدید برای پارت';
  modal.style.display = 'flex';
  modal.style.zIndex = '9999999';
};

window.editQuizRecord = async function(quizId) {
  let foundQuiz = null;
  let foundSession = null;

  // 1. Search in master list across sessions and clips
  window.lmsStationsMasterList.forEach(st => {
    (st.categories || []).forEach(cat => {
      (cat.sessions || []).forEach(sess => {
        (sess.quizzes || []).forEach(q => {
          if (q.id === quizId) { foundQuiz = q; foundSession = sess; }
        });
        (sess.videoClips || []).forEach(clip => {
          (clip.quizzes || []).forEach(q => {
            if (q.id === quizId) { foundQuiz = q; foundSession = sess; }
          });
        });
      });
    });
  });

  // 2. Fallback fetch from API if not found
  if (!foundQuiz) {
    const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
    try {
      const res = await fetch(`/api/v1/admin/lms/quizzes`, {
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const allQ = await res.json();
      if (Array.isArray(allQ)) {
        foundQuiz = allQ.find(q => q.id === quizId);
      }
    } catch(e) {}
  }

  if (!foundQuiz) {
    alert('آزمونک مورد نظر یافت نشد.');
    return;
  }

  const modal = document.getElementById('lms-quiz-editor-modal');
  if (!modal) return;

  document.getElementById('quiz-modal-id').value = foundQuiz.id;
  document.getElementById('quiz-modal-session-id').value = foundQuiz.sessionId || (foundSession ? foundSession.id : '');
  document.getElementById('quiz-modal-clip-id').value = foundQuiz.clipId || '';

  document.getElementById('quiz-modal-title-input').value = foundQuiz.title || 'آزمونک پارت';
  document.getElementById('quiz-modal-zarik').value = (foundQuiz.rewardZarik !== undefined && foundQuiz.rewardZarik !== null) ? foundQuiz.rewardZarik : 10;

  let qText = 'سوال پارت';
  let opts = ['گزینه اول', 'گزینه دوم', 'گزینه سوم', 'گزینه چهارم'];
  let correctIdx = 0;

  if (foundQuiz.questionsJson) {
    try {
      const parsed = typeof foundQuiz.questionsJson === 'string' ? JSON.parse(foundQuiz.questionsJson) : foundQuiz.questionsJson;
      if (Array.isArray(parsed) && parsed[0]) {
        qText = parsed[0].question || qText;
        if (Array.isArray(parsed[0].options)) opts = parsed[0].options;
        correctIdx = parsed[0].correctIndex ?? 0;
      }
    } catch (e) {
      console.error('Quiz parse error:', e);
    }
  }

  document.getElementById('quiz-modal-q-text').value = qText;
  document.getElementById('quiz-opt-0').value = opts[0] || '';
  document.getElementById('quiz-opt-1').value = opts[1] || '';
  document.getElementById('quiz-opt-2').value = opts[2] || '';
  document.getElementById('quiz-opt-3').value = opts[3] || '';

  const radioEl = document.getElementById(`opt-radio-${correctIdx}`) || document.getElementById('opt-radio-0');
  if (radioEl) radioEl.checked = true;

  document.getElementById('quiz-modal-title').innerHTML = `<i class="fa-solid fa-circle-question"></i> ویرایش آزمونک: ${foundQuiz.title || ''}`;
  modal.style.display = 'flex';
  modal.style.zIndex = '9999999';
};

window.saveQuizFromModal = async function(e) {
  e.preventDefault();
  const id = document.getElementById('quiz-modal-id')?.value;
  const sessionId = document.getElementById('quiz-modal-session-id')?.value;
  const clipId = document.getElementById('quiz-modal-clip-id')?.value;

  const title = document.getElementById('quiz-modal-title-input')?.value;
  const rewardZarik = parseInt(document.getElementById('quiz-modal-zarik')?.value) || 10;

  const question = document.getElementById('quiz-modal-q-text')?.value;
  const opts = [
    document.getElementById('quiz-opt-0')?.value || '',
    document.getElementById('quiz-opt-1')?.value || '',
    document.getElementById('quiz-opt-2')?.value || '',
    document.getElementById('quiz-opt-3')?.value || ''
  ];
  const correctIndex = parseInt(document.querySelector('input[name="quiz-correct-opt"]:checked')?.value) || 0;

  const questionsJson = JSON.stringify([
    {
      question,
      options: opts,
      correctIndex
    }
  ]);

  const payload = {
    id: id || undefined,
    sessionId,
    clipId: clipId || undefined,
    title,
    rewardZarik,
    questionsJson
  };

  const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
  try {
    const res = await fetch('/api/v1/admin/lms/quizzes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      alert('آزمونک (متن سوال، گزینه‌ها، پاسخ صحیح و پاداش زریک) با موفقیت در دیتابیس ذخیره شد');
      document.getElementById('lms-quiz-editor-modal').style.display = 'none';
      await window.fetchLiveLmsStations();
      if (sessionId) {
        const st = window.lmsStationsMasterList.find(s => 
          (s.categories || []).some(c => (c.sessions || []).some(sess => sess.id === sessionId))
        );
        if (st) window.openStationContentManagerModal(st.id);
      }
    } else {
      const data = await res.json();
      alert('خطا در ذخیره‌سازی آزمونک: ' + (data.error || 'خطای ناشناخته'));
    }
  } catch (err) {
    console.error('Save quiz error:', err);
    alert('ارتباط با سرور برقرار نشد');
  }
};

window.deleteQuizRecord = async function(quizId) {
  if (!confirm('آیا از حذف این آزمونک اطمینان دارید؟')) return;
  const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
  try {
    const res = await fetch(`/api/v1/admin/lms/quizzes/${quizId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
    });
    if (res.ok) {
      alert('آزمونک با موفقیت حذف شد');
      await window.fetchLiveLmsStations();
      document.getElementById('lms-quiz-editor-modal').style.display = 'none';
    }
  } catch (err) {
    console.error('Delete quiz error:', err);
  }
};

window.applyBatchZarikToCategory = async function(categoryId, stationId) {
  const inputEl = document.getElementById(`batch-zarik-cat-${categoryId}`);
  const amount = parseInt(inputEl ? inputEl.value : 15);
  if (isNaN(amount) || amount < 0) {
    alert('لطفاً یک عدد معتبر برای پاداش زریک وارد نمایید.');
    return;
  }

  if (!confirm(`آیا مطمئنید که می‌خواهید پاداش ${amount} زریک را برای تمام پارت‌ها و آزمونک‌های این دسته اعمال کنید؟`)) {
    return;
  }

  const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
  try {
    const res = await fetch(`/api/v1/admin/lms/categories/${categoryId}/batch-zarik`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ rewardZarik: amount })
    });

    if (res.ok) {
      const data = await res.json();
      alert(data.message || 'پاداش زریک با موفقیت روی تمام پارت‌ها اعمال شد');
      await window.fetchLiveLmsStations();
      if (stationId) {
        window.openStationContentManagerModal(stationId);
      }
    } else {
      const data = await res.json();
      alert('خطا در اعمال پاداش گروهی زریک: ' + (data.error || 'خطای ناشناخته'));
    }
  } catch (err) {
    console.error('Batch zarik error:', err);
    alert('ارتباط با سرور برقرار نشد');
  }
};

window.openCreateStationModal = function() {
  const modal = document.getElementById('lms-station-creator-modal');
  if (!modal) return;
  document.getElementById('lms-creator-form').reset();
  document.getElementById('modal-st-id').value = '';

  // Calculate highest existing order index and assign next unique number
  let nextIndex = 1;
  if (Array.isArray(window.lmsStationsMasterList) && window.lmsStationsMasterList.length > 0) {
    const maxOrder = window.lmsStationsMasterList.reduce((max, s) => {
      const ord = parseInt(s.orderIndex ?? s.index) || 0;
      return Math.max(max, ord);
    }, 0);
    nextIndex = maxOrder + 1;
  }

  document.getElementById('modal-st-index').value = nextIndex;
  document.getElementById('modal-st-release-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('modal-st-skill-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('modal-st-media-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('modal-st-skill-parts').value = 2;
  document.getElementById('modal-st-media-parts').value = 2;
  document.getElementById('modal-st-skill-sessions').value = 2;
  document.getElementById('modal-st-media-sessions').value = 2;
  document.getElementById('modal-st-skill-instructor').value = 'پیراینه‌گر';
  document.getElementById('modal-st-media-instructor').value = 'علیرضا خوش‌منظر';
  document.getElementById('station-modal-title').innerHTML = `<i class="fa-solid fa-graduation-cap"></i> ایجاد منزلگاه آموزشی جدید (شماره خودکار: منزلگاه ${nextIndex})`;
  modal.style.display = 'flex';
  modal.style.zIndex = '99999';
};

window.editStationModal = function(id) {
  const st = window.lmsStationsMasterList.find(s => (s.id === id || ('MZ' + (s.orderIndex || s.index)) === id || s.orderIndex == id)) || window.lmsStationsMasterList[0];
  if (!st) return;
  const modal = document.getElementById('lms-station-creator-modal');
  if (!modal) return;

  const categories = st.categories || [];
  const skillCategory = categories.find(c => c.orderIndex === 1 || (c.title && c.title.includes('مهارت'))) || {};
  const mediaCategory = categories.find(c => c.orderIndex === 2 || (c.title && c.title.includes('رسانه'))) || {};

  let formattedReleaseDate = new Date().toISOString().split('T')[0];
  if (st.releaseDate) {
    try {
      formattedReleaseDate = new Date(st.releaseDate).toISOString().split('T')[0];
    } catch (e) {}
  }

  document.getElementById('modal-st-id').value = st.id || '';
  document.getElementById('modal-st-index').value = st.orderIndex || st.index || 1;
  document.getElementById('modal-st-title').value = st.title || st.name || '';
  document.getElementById('modal-st-release-date').value = formattedReleaseDate;

  // Skill category values
  const skillSessions = skillCategory.sessions || [];
  let maxSkillClips = 2;
  skillSessions.forEach(s => {
    if ((s.videoClips || []).length > maxSkillClips) maxSkillClips = s.videoClips.length;
  });

  document.getElementById('modal-st-skill-title').value = skillCategory.title || 'کلاس‌های مهارتی (مهارت فردی و گروهی)';
  document.getElementById('modal-st-skill-instructor').value = (skillSessions[0] && skillSessions[0].instructor) || 'پیراینه‌گر';
  document.getElementById('modal-st-skill-sessions').value = skillSessions.length || 2;
  document.getElementById('modal-st-skill-parts').value = maxSkillClips;
  document.getElementById('modal-st-skill-date').value = formattedReleaseDate;

  // Media category values
  const mediaSessions = mediaCategory.sessions || [];
  let maxMediaClips = 2;
  mediaSessions.forEach(s => {
    if ((s.videoClips || []).length > maxMediaClips) maxMediaClips = s.videoClips.length;
  });

  document.getElementById('modal-st-media-title').value = mediaCategory.title || 'کلاس‌های رسانه‌ای (سواد رسانه و تولید محتوا)';
  document.getElementById('modal-st-media-instructor').value = (mediaSessions[0] && mediaSessions[0].instructor) || 'علیرضا خوش‌منظر';
  document.getElementById('modal-st-media-sessions').value = mediaSessions.length || 2;
  document.getElementById('modal-st-media-parts').value = maxMediaClips;
  document.getElementById('modal-st-media-date').value = formattedReleaseDate;

  document.getElementById('modal-st-details').value = st.description || '';
  document.getElementById('station-modal-title').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> ویرایش منزلگاه ${st.orderIndex || st.index || ''}: ${st.title || st.name}`;
  modal.style.display = 'flex';
  modal.style.zIndex = '99999';
};

window.saveCompleteStation = async function(e) {
  e.preventDefault();
  const id = document.getElementById('modal-st-id')?.value;
  const releaseDate = document.getElementById('modal-st-release-date')?.value || new Date().toISOString().split('T')[0];

  const skillTitle = document.getElementById('modal-st-skill-title')?.value || 'کلاس‌های مهارتی (شنبه و دوشنبه)';
  const skillInstructor = document.getElementById('modal-st-skill-instructor')?.value || 'پیراینه‌گر';
  const skillSessionsCount = parseInt(document.getElementById('modal-st-skill-sessions')?.value) || 2;
  const skillPartsCount = parseInt(document.getElementById('modal-st-skill-parts')?.value) || 2;

  const mediaTitle = document.getElementById('modal-st-media-title')?.value || 'کلاس‌های رسانه‌ای (پنجشنبه و جمعه)';
  const mediaInstructor = document.getElementById('modal-st-media-instructor')?.value || 'علیرضا خوش‌منظر';
  const mediaSessionsCount = parseInt(document.getElementById('modal-st-media-sessions')?.value) || 2;
  const mediaPartsCount = parseInt(document.getElementById('modal-st-media-parts')?.value) || 2;

  const payload = {
    id: id || undefined,
    orderIndex: parseInt(document.getElementById('modal-st-index')?.value) || undefined,
    title: document.getElementById('modal-st-title')?.value,
    releaseDate: releaseDate,
    description: document.getElementById('modal-st-details')?.value,
    categories: [
      {
        title: skillTitle,
        orderIndex: 1,
        instructor: skillInstructor,
        sessionsCount: skillSessionsCount,
        partsPerSession: skillPartsCount
      },
      {
        title: mediaTitle,
        orderIndex: 2,
        instructor: mediaInstructor,
        sessionsCount: mediaSessionsCount,
        partsPerSession: mediaPartsCount
      }
    ]
  };

  const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
  try {
    const url = id ? `/api/v1/admin/lms/stations/${id}` : '/api/v1/admin/lms/stations';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      alert('منزلگاه آموزشی با موفقیت ذخیره شد');
    }
  } catch (err) {
    console.error('Save Station Error:', err);
  }

  document.getElementById('lms-station-creator-modal').style.display = 'none';
  window.fetchLiveLmsStations();
};

window.deleteStationRecord = async function(id) {
  if (!confirm('آیا از حذف این منزلگاه اطمینان دارید؟')) return;
  const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
  try {
    await fetch(`/api/v1/admin/lms/stations/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
    });
  } catch (err) {
    console.error(err);
  }
  window.fetchLiveLmsStations();
};

// ==================== REORDER STATIONS (STRICTLY UNIQUE 1..N) ====================

window.lmsReorderList = [];

window.openReorderStationsModal = function() {
  const modal = document.getElementById('lms-station-reorder-modal');
  if (!modal) return;

  if (!window.lmsStationsMasterList || window.lmsStationsMasterList.length === 0) {
    alert('منزلگاهی برای مرتب‌سازی یافت نشد.');
    return;
  }

  // Clone and sort current stations by orderIndex
  window.lmsReorderList = JSON.parse(JSON.stringify(window.lmsStationsMasterList))
    .sort((a, b) => (Number(a.orderIndex ?? a.index) || 0) - (Number(b.orderIndex ?? b.index) || 0));

  window.renderReorderList();
  modal.style.display = 'flex';
  modal.style.zIndex = '999999';
};

window.renderReorderList = function() {
  const container = document.getElementById('lms-reorder-list-container');
  if (!container) return;

  if (!window.lmsReorderList || window.lmsReorderList.length === 0) {
    container.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:20px;">هیچ منزلگاهی وجود ندارد.</div>';
    return;
  }

  const PERSIAN_NUMS = ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم', 'هفتم', 'هشتم', 'نهم', 'دهم', 'یازدهم', 'دوازدهم', 'سیزدهم', 'چهاردهم', 'پانزدهم'];
  const DEFAULT_STATION_TOPICS = {
    1: { skill: 'شناخت هوش و حافظه', media: 'پادکست و مبانی رسانه' },
    2: { skill: 'خودشناسی جامع', media: 'تولید پادکست حرفه‌ای' },
    3: { skill: 'تفکر نقادانه و حل مسئله', media: 'عکاسی و تصویربرداری' },
    4: { skill: 'کار تیمی و مدیریت چالش‌ها', media: 'تدوین ویدیو و سناریونویسی' },
    5: { skill: 'هدف‌گذاری و مدیریت زمان', media: 'هوش مصنوعی و رسانه' }
  };

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

  let html = '';
  window.lmsReorderList.forEach((st, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === window.lmsReorderList.length - 1;
    const currentNumber = idx + 1; // Current order position (1..N)
    const originalIdx = st.orderIndex ?? st.index ?? currentNumber;
    
    // Persian station title matching main table exactly: منزلگاه اول، منزلگاه دوم، ...
    const persianStationTitle = PERSIAN_NUMS[idx] ? `منزلگاه ${PERSIAN_NUMS[idx]}` : `منزلگاه ${idx + 1}`;

    const categories = st.categories || [];
    const skillCategory = categories.find(c => c.orderIndex === 1 || (c.title && c.title.includes('مهارت'))) || categories[0];
    const mediaCategory = categories.find(c => c.orderIndex === 2 || (c.title && c.title.includes('رسانه'))) || categories[1];
    
    const defaultTopics = DEFAULT_STATION_TOPICS[originalIdx] || DEFAULT_STATION_TOPICS[currentNumber] || { skill: 'کلاس‌های مهارتی', media: 'کلاس‌های رسانه‌ای' };
    const skillTopic = getCleanTopic(skillCategory, defaultTopics.skill);
    const mediaTopic = getCleanTopic(mediaCategory, defaultTopics.media);

    let totalSessions = 0;
    categories.forEach(c => totalSessions += (c.sessions || []).length);

    html += `
      <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(30, 41, 59, 0.85); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:12px 16px; transition:all 0.2s;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="background:linear-gradient(135deg, #0284c7, #0369a1); color:white; font-weight:bold; font-size:13.5px; width:38px; height:38px; border-radius:8px; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 6px rgba(0,0,0,0.3);">
            ${currentNumber}
          </div>
          <div>
            <div style="font-weight:bold; color:white; font-size:14px; display:flex; align-items:center; gap:8px;">
              <span>${persianStationTitle}</span>
              ${st.title && !st.title.startsWith('Station') && !st.title.startsWith('منزلگاه') ? `<span style="font-size:12px; color:#38bdf8; font-weight:normal;">(${st.title})</span>` : ''}
            </div>
            <div style="font-size:11.5px; color:#94a3b8; margin-top:3px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span style="color:#38bdf8;"><i class="fa-solid fa-brain"></i> مهارتی: ${skillTopic}</span>
              <span style="color:#64748b;">|</span>
              <span style="color:#a78bfa;"><i class="fa-solid fa-photo-film"></i> رسانه‌ای: ${mediaTopic}</span>
              <span style="color:#64748b;">|</span>
              <span style="color:#cbd5e1;">${totalSessions} جلسه مصوب</span>
            </div>
          </div>
        </div>

        <div style="display:flex; gap:6px; align-items:center;">
          <button type="button" onclick="window.moveStationInReorder(${idx}, ${idx - 1})" ${isFirst ? 'disabled' : ''} style="background:${isFirst ? 'rgba(255,255,255,0.03)' : '#1e293b'}; color:${isFirst ? '#475569' : '#38bdf8'}; border:1px solid ${isFirst ? 'transparent' : 'rgba(56, 189, 248, 0.3)'}; width:36px; height:36px; border-radius:8px; cursor:${isFirst ? 'not-allowed' : 'pointer'}; font-size:14px; display:flex; align-items:center; justify-content:center;" title="حرکت به بالا">
            <i class="fa-solid fa-arrow-up"></i>
          </button>
          <button type="button" onclick="window.moveStationInReorder(${idx}, ${idx + 1})" ${isLast ? 'disabled' : ''} style="background:${isLast ? 'rgba(255,255,255,0.03)' : '#1e293b'}; color:${isLast ? '#475569' : '#38bdf8'}; border:1px solid ${isLast ? 'transparent' : 'rgba(56, 189, 248, 0.3)'}; width:36px; height:36px; border-radius:8px; cursor:${isLast ? 'not-allowed' : 'pointer'}; font-size:14px; display:flex; align-items:center; justify-content:center;" title="حرکت به پایین">
            <i class="fa-solid fa-arrow-down"></i>
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
};

window.moveStationInReorder = function(fromIndex, toIndex) {
  if (toIndex < 0 || toIndex >= window.lmsReorderList.length) return;
  const item = window.lmsReorderList.splice(fromIndex, 1)[0];
  window.lmsReorderList.splice(toIndex, 0, item);
  window.renderReorderList();
};

window.saveStationsReorder = async function() {
  if (!window.lmsReorderList || window.lmsReorderList.length === 0) return;

  const orderedIds = window.lmsReorderList.map(s => s.id);
  const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';

  try {
    const res = await fetch('/api/v1/admin/lms/stations/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({ stationIds: orderedIds })
    });
    if (res.ok) {
      alert('ترتیب منزلگاه‌ها با موفقیت ذخیره و یکتا شد (شماره‌گذاری ۱ تا ' + orderedIds.length + ')');
      document.getElementById('lms-station-reorder-modal').style.display = 'none';
      await window.fetchLiveLmsStations();
    } else {
      const data = await res.json();
      alert('خطا در ذخیره ترتیب: ' + (data.error || 'خطای ناشناخته'));
    }
  } catch (err) {
    console.error('Reorder error:', err);
    alert('ارتباط با سرور برقرار نشد');
  }
};

window.exportLmsToExcel = function() {

  const list = window.lmsStationsMasterList || [];
  if (list.length === 0) {
    alert('اطلاعات منزلگاه‌ها هنوز بارگذاری نشده است. لطفاً چند لحظه صبر کنید.');
    return;
  }

  let totalAllSessions = 0;
  let totalAllSkill = 0;
  let totalAllMedia = 0;
  let totalAllClips = 0;
  let totalAllQuizzes = 0;

  let tableRows = '';
  list.forEach((st, idx) => {
    const rowNum = idx + 1;
    const mzCode = 'MZ' + (st.orderIndex ?? st.index ?? rowNum);
    const title = st.title || ('منزلگاه ' + rowNum);
    const desc = st.description || '-';
    
    let releaseDateStr = '-';
    if (st.releaseDate) {
      try {
        releaseDateStr = new Date(st.releaseDate).toISOString().split('T')[0];
      } catch (e) {
        releaseDateStr = String(st.releaseDate).split('T')[0];
      }
    }

    const categories = st.categories || [];
    const skillCat = categories.find(c => c.orderIndex === 1 || (c.title && c.title.includes('مهارت'))) || { sessions: [] };
    const mediaCat = categories.find(c => c.orderIndex === 2 || (c.title && c.title.includes('رسانه'))) || { sessions: [] };

    const skillSessions = (skillCat.sessions || []).length;
    const mediaSessions = (mediaCat.sessions || []).length;
    const totalSessions = skillSessions + mediaSessions;

    totalAllSessions += totalSessions;
    totalAllSkill += skillSessions;
    totalAllMedia += mediaSessions;

    const instructors = new Set();
    let totalClips = 0;
    let totalQuizzes = 0;

    categories.forEach(c => {
      (c.sessions || []).forEach(sess => {
        if (sess.instructor && sess.instructor.trim()) instructors.add(sess.instructor.trim());
        totalClips += (sess.videoClips || []).length;
        totalQuizzes += (sess.quizzes || []).length;
      });
    });

    totalAllClips += totalClips;
    totalAllQuizzes += totalQuizzes;

    const instructorsStr = Array.from(instructors).join('، ') || 'اساتید دوره نپا';

    tableRows += `
      <tr>
        <td style="text-align:center; mso-number-format:'\\@';">${rowNum}</td>
        <td style="text-align:center; font-weight:bold; color:#0284c7; mso-number-format:'\\@';">${mzCode}</td>
        <td style="font-weight:bold; color:#0f172a;">${title}</td>
        <td>${instructorsStr}</td>
        <td style="text-align:center;">${categories.length} دسته</td>
        <td style="text-align:center;">${skillSessions} جلسه</td>
        <td style="text-align:center;">${mediaSessions} جلسه</td>
        <td style="text-align:center; font-weight:bold; color:#0284c7;">${totalSessions} جلسه</td>
        <td style="text-align:center;">${totalClips} پارت</td>
        <td style="text-align:center; font-weight:bold; color:#d97706;">${totalQuizzes} آزمونک</td>
        <td style="text-align:center; mso-number-format:'\\@';">${releaseDateStr}</td>
        <td style="font-size:11px; color:#475569;">${desc}</td>
        <td style="text-align:center; background-color:#dcfce7; color:#166534; font-weight:bold;">فعال</td>
      </tr>
    `;
  });

  // Summary footer row
  tableRows += `
    <tr style="background-color:#f1f5f9; font-weight:bold;">
      <td colspan="4" style="text-align:center; padding:10px; font-size:13px; color:#0f172a;">مجموع کل سامانه نپا</td>
      <td style="text-align:center; color:#0284c7;">۱۰ دسته</td>
      <td style="text-align:center; color:#0284c7;">${totalAllSkill} جلسه</td>
      <td style="text-align:center; color:#7c3aed;">${totalAllMedia} جلسه</td>
      <td style="text-align:center; color:#0284c7; font-size:13px;">${totalAllSessions} جلسه</td>
      <td style="text-align:center; color:#6366f1;">${totalAllClips} پارت</td>
      <td style="text-align:center; color:#d97706; font-size:13px;">${totalAllQuizzes} آزمونک</td>
      <td colspan="3" style="text-align:center; color:#64748b;">۵ منزلگاه فعال</td>
    </tr>
  `;

  const excelHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>ساختار منزلگاه‌های نپا</x:Name>
              <x:WorksheetOptions>
                <x:DisplayRightToLeft/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        body { font-family: Tahoma, 'Segoe UI', Arial, sans-serif; direction: rtl; }
        table { border-collapse: collapse; width: 100%; direction: rtl; }
        th { background-color: #0f172a; color: #ffffff; font-weight: bold; border: 1px solid #334155; padding: 10px 8px; font-size: 12px; text-align: center; }
        td { border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 12px; vertical-align: middle; }
      </style>
    </head>
    <body>
      <table>
        <thead>
          <tr>
            <th colspan="13" style="font-size:15px; padding:14px; background-color:#1e293b; color:#38bdf8; text-align:center;">
              گزارش جامع ساختار منزلگاه‌ها، جلسات و آزمونک‌های سامانه آموزشی نپا
            </th>
          </tr>
          <tr>
            <th style="width:40px;">ردیف</th>
            <th style="width:70px;">کد</th>
            <th style="width:220px;">نام و عنوان منزلگاه</th>
            <th style="width:180px;">اساتید و مربیان</th>
            <th style="width:90px;">دسته‌ها</th>
            <th style="width:90px;">جلسات مهارتی</th>
            <th style="width:90px;">جلسات رسانه‌ای</th>
            <th style="width:90px;">مجموع جلسات</th>
            <th style="width:80px;">پارت‌ها</th>
            <th style="width:80px;">آزمونک‌ها</th>
            <th style="width:100px;">تاریخ شروع / انتشار</th>
            <th style="width:250px;">توضیحات و سرفصل‌ها</th>
            <th style="width:60px;">وضعیت</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob(['\uFEFF' + excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  const todayStr = new Date().toISOString().slice(0, 10);
  a.download = `LMS_Stations_Report_${todayStr}.xls`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(downloadUrl);
    a.remove();
  }, 300);
};

// ==================== STATION CREATOR & EDIT MODAL (DYNAMIC CATEGORIES) ====================

window.modalCategoryBlockCounter = 0;

window.addCategoryBlockToCreatorModal = function(catData = null) {
  const container = document.getElementById('lms-modal-categories-container');
  if (!container) return;

  window.modalCategoryBlockCounter++;
  const blockId = 'modal-cat-block-' + window.modalCategoryBlockCounter;
  
  const existingCards = container.querySelectorAll('.modal-category-card');
  const catIndex = existingCards.length + 1;
  const isSkillDefault = catIndex === 1;
  const isMediaDefault = catIndex === 2;

  const defaultTitle = catData?.title || (isSkillDefault ? 'کلاس‌های مهارتی' : (isMediaDefault ? 'کلاس‌های رسانه‌ای' : `دسته کلاس ${catIndex}`));
  const defaultInstructor = catData?.instructor || (catData?.sessions?.[0]?.instructor) || (isSkillDefault ? 'پیراینه‌گر' : (isMediaDefault ? 'علیرضا خوش‌منظر' : 'استاد نپا'));
  const defaultSessions = (catData?.sessions?.length) || catData?.sessionsCount || 2;
  const defaultParts = (catData?.sessions?.[0]?.videoClips?.length) || catData?.partsPerSession || 2;
  const defaultSchedule = catData?.schedule || (isSkillDefault ? 'شنبه و دوشنبه' : (isMediaDefault ? 'پنجشنبه و جمعه' : 'سه‌شنبه و چهارشنبه'));
  
  let defaultDateStr = '';
  if (catData?.releaseDate) {
    try { defaultDateStr = new Date(catData.releaseDate).toISOString().split('T')[0]; } catch(e) {}
  } else {
    defaultDateStr = new Date().toISOString().split('T')[0];
  }

  const color = catIndex % 2 === 1 ? '#38bdf8' : '#a78bfa';
  const badgeBg = catIndex % 2 === 1 ? '#0284c7' : '#7c3aed';

  const cardHtml = `
    <div id="${blockId}" class="modal-category-card" data-cat-id="${catData?.id || ''}" style="background: rgba(30, 41, 59, 0.7); border: 1px solid ${color}55; border-radius: 12px; padding: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 8px;">
        <h4 class="modal-cat-badge-title" style="margin: 0; color: ${color}; font-size: 13.5px; display: flex; align-items: center; gap: 8px;">
          <span class="badge" style="background: ${badgeBg}; color: white; padding: 3px 8px; border-radius: 6px; font-weight: bold; font-size: 11px;">دسته ${catIndex}</span>
          <i class="fa-solid fa-graduation-cap"></i> <span class="cat-label-display">${defaultTitle}</span>
        </h4>
        <button type="button" onclick="window.removeCategoryBlockFromCreatorModal('${blockId}')" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 6px; padding: 4px 10px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px;" title="حذف این دسته کلاس">
          <i class="fa-solid fa-trash"></i> حذف دسته
        </button>
      </div>

      <div style="display: grid; grid-template-columns: 2fr 1.5fr 1fr 1fr; gap: 10px; margin-bottom: 10px;">
        <div class="form-group">
          <label style="font-size:11.5px; color:#cbd5e1;">عنوان دسته کلاس:</label>
          <input type="text" class="modal-cat-title input-ctrl" value="${defaultTitle}" placeholder="مثال: کلاس‌های مهارتی، کارگاه پادکست..." style="background: #1e293b;" oninput="this.closest('.modal-category-card').querySelector('.cat-label-display').textContent = this.value">
        </div>
        <div class="form-group">
          <label style="font-size:11.5px; color:#cbd5e1;">استاد و مدرس:</label>
          <input type="text" class="modal-cat-instructor input-ctrl" value="${defaultInstructor}" placeholder="نام مدرس..." style="background: #1e293b;">
        </div>
        <div class="form-group">
          <label style="font-size:11.5px; color:#cbd5e1;">تعداد جلسات:</label>
          <input type="number" class="modal-cat-sessions input-ctrl" value="${defaultSessions}" min="1" max="50" style="background: #1e293b;">
        </div>
        <div class="form-group">
          <label style="font-size:11.5px; color:#38bdf8; font-weight:bold;"><i class="fa-solid fa-film"></i> پارت هر جلسه:</label>
          <input type="number" class="modal-cat-parts input-ctrl" value="${defaultParts}" min="1" max="20" style="background: #1e293b; border-color: ${color};" title="تعداد پارت‌های ویدیویی در هر جلسه">
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div class="form-group">
          <label style="font-size:11.5px; color:#cbd5e1;">زمان‌بندی برگزاری هفتگی:</label>
          <input type="text" class="modal-cat-schedule input-ctrl" value="${defaultSchedule}" placeholder="مثال: شنبه و دوشنبه" style="background: #1e293b;">
        </div>
        <div class="form-group">
          <label style="font-size:11.5px; color:#cbd5e1;"><i class="fa-solid fa-calendar-check"></i> تاریخ شروع این دسته:</label>
          <input type="date" class="modal-cat-date input-ctrl" value="${defaultDateStr}" style="color:white; background: #1e293b;">
        </div>
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', cardHtml);
  window.reindexModalCategoryCards();
};

window.removeCategoryBlockFromCreatorModal = function(blockId) {
  const container = document.getElementById('lms-modal-categories-container');
  if (!container) return;

  const card = document.getElementById(blockId);
  if (!card) return;

  const allCards = container.querySelectorAll('.modal-category-card');
  if (allCards.length <= 1) {
    alert('حداقل یک دسته کلاس برای این منزلگاه الزامی است.');
    return;
  }

  if (confirm('آیا از حذف این دسته کلاس اطمینان دارید؟ جلسات مربوط به آن نیز حذف خواهند شد.')) {
    card.remove();
    window.reindexModalCategoryCards();
  }
};

window.reindexModalCategoryCards = function() {
  const container = document.getElementById('lms-modal-categories-container');
  if (!container) return;

  const cards = container.querySelectorAll('.modal-category-card');
  cards.forEach((card, idx) => {
    const badge = card.querySelector('.badge');
    if (badge) badge.textContent = `دسته ${idx + 1}`;
  });
};

window.openCreateStationModal = function() {
  const modal = document.getElementById('lms-station-creator-modal');
  if (!modal) return;

  const PERSIAN_NUMS = ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم', 'هفتم', 'هشتم', 'نهم', 'دهم'];
  const nextIdx = (window.lmsStationsMasterList?.length || 0) + 1;
  const nextPersianName = PERSIAN_NUMS[nextIdx - 1] ? `منزلگاه ${PERSIAN_NUMS[nextIdx - 1]}` : `منزلگاه ${nextIdx}`;

  document.getElementById('station-modal-title').innerHTML = `<i class="fa-solid fa-plus-circle"></i> ایجاد و تعریف ${nextPersianName}`;
  document.getElementById('modal-st-id').value = '';
  document.getElementById('modal-st-index').value = nextIdx;
  document.getElementById('modal-st-title').value = nextPersianName;
  document.getElementById('modal-st-release-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('modal-st-details').value = `سرفصل‌ها و اهداف آموزشی ${nextPersianName}`;

  // Populate dynamic category container
  const container = document.getElementById('lms-modal-categories-container');
  if (container) container.innerHTML = '';
  window.addCategoryBlockToCreatorModal({ title: 'کلاس‌های مهارتی', instructor: 'پیراینه‌گر', schedule: 'شنبه و دوشنبه' });
  window.addCategoryBlockToCreatorModal({ title: 'کلاس‌های رسانه‌ای', instructor: 'علیرضا خوش‌منظر', schedule: 'پنجشنبه و جمعه' });

  modal.style.display = 'flex';
  modal.style.zIndex = '99999';
};

window.editStationModal = function(stationId) {
  if (!window.lmsStationsMasterList || window.lmsStationsMasterList.length === 0) return;

  const station = window.lmsStationsMasterList.find(s => 
    s.id === stationId || 
    s.id == stationId || 
    ('MZ' + (s.orderIndex || s.index)) === stationId || 
    s.orderIndex == stationId
  );

  if (!station) return;

  const modal = document.getElementById('lms-station-creator-modal');
  if (!modal) return;

  const PERSIAN_NUMS = ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم', 'هفتم', 'هشتم', 'نهم', 'دهم'];
  const stIdx = station.orderIndex || 1;
  const simpleStationName = PERSIAN_NUMS[stIdx - 1] ? `منزلگاه ${PERSIAN_NUMS[stIdx - 1]}` : `منزلگاه ${stIdx}`;

  document.getElementById('station-modal-title').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> ویرایش مشخصات ${simpleStationName}`;
  document.getElementById('modal-st-id').value = station.id;
  document.getElementById('modal-st-index').value = stIdx;
  document.getElementById('modal-st-title').value = simpleStationName;
  
  let releaseDateStr = '';
  if (station.releaseDate) {
    try { releaseDateStr = new Date(station.releaseDate).toISOString().split('T')[0]; } catch(e) {}
  }
  document.getElementById('modal-st-release-date').value = releaseDateStr;
  document.getElementById('modal-st-details').value = station.description || '';

  // Populate categories dynamically
  const container = document.getElementById('lms-modal-categories-container');
  if (container) container.innerHTML = '';

  const categories = station.categories || [];
  if (categories.length > 0) {
    categories.forEach(cat => window.addCategoryBlockToCreatorModal(cat));
  } else {
    window.addCategoryBlockToCreatorModal({ title: 'کلاس‌های مهارتی', instructor: 'پیراینه‌گر', schedule: 'شنبه و دوشنبه' });
    window.addCategoryBlockToCreatorModal({ title: 'کلاس‌های رسانه‌ای', instructor: 'علیرضا خوش‌منظر', schedule: 'پنجشنبه و جمعه' });
  }

  modal.style.display = 'flex';
  modal.style.zIndex = '99999';
};

window.saveCompleteStation = async function(e) {
  if (e) e.preventDefault();

  const id = document.getElementById('modal-st-id')?.value;
  const orderIndex = parseInt(document.getElementById('modal-st-index')?.value) || 1;
  const title = document.getElementById('modal-st-title')?.value || 'منزلگاه';
  const releaseDate = document.getElementById('modal-st-release-date')?.value;
  const description = document.getElementById('modal-st-details')?.value || '';

  // Gather dynamic categories
  const container = document.getElementById('lms-modal-categories-container');
  const categoryCards = container ? container.querySelectorAll('.modal-category-card') : [];
  
  if (categoryCards.length === 0) {
    alert('حداقل یک دسته کلاس برای منزلگاه باید تعریف شود.');
    return;
  }

  const categories = [];
  categoryCards.forEach((card, idx) => {
    const catId = card.getAttribute('data-cat-id') || undefined;
    const catTitle = card.querySelector('.modal-cat-title')?.value || `دسته ${idx + 1}`;
    const instructor = card.querySelector('.modal-cat-instructor')?.value || 'استاد نپا';
    const sessionsCount = parseInt(card.querySelector('.modal-cat-sessions')?.value) || 2;
    const partsPerSession = parseInt(card.querySelector('.modal-cat-parts')?.value) || 2;
    const schedule = card.querySelector('.modal-cat-schedule')?.value || '';
    const catDate = card.querySelector('.modal-cat-date')?.value || undefined;

    categories.push({
      id: catId,
      orderIndex: idx + 1,
      title: catTitle,
      instructor,
      sessionsCount,
      partsPerSession,
      schedule,
      releaseDate: catDate
    });
  });

  const payload = {
    id: id || undefined,
    orderIndex,
    title,
    releaseDate: releaseDate || undefined,
    description,
    categories
  };

  const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
  try {
    const res = await fetch('/api/v1/admin/stations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      alert('✅ مشخصات منزلگاه و ساختار کلیه دسته‌ها با موفقیت ذخیره شد.');
      document.getElementById('lms-station-creator-modal').style.display = 'none';
      await window.fetchLiveLmsStations();
    } else {
      const d = await res.json();
      alert('خطا در ذخیره‌سازی: ' + (d.error || 'خطای سرور'));
    }
  } catch (err) {
    console.error('Save station error:', err);
    alert('ارتباط با سرور برقرار نشد: ' + err.message);
  }
};

// Automatic load bindings
window.loadLmsStationsData = window.fetchLiveLmsStations;
document.addEventListener('DOMContentLoaded', () => {
  if (window.fetchLiveLmsStations) window.fetchLiveLmsStations();
});
