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

  // Calculate stats dynamically from REAL station session counts
  const totalStations = window.lmsStationsMasterList.length;
  let totalSessions = 0;
  let totalParts = 0;

  window.lmsStationsMasterList.forEach(st => {
    const cats = st.categories || [];
    cats.forEach(c => {
      const sessList = c.sessions || [];
      totalSessions += sessList.length;
      sessList.forEach(s => {
        totalParts += (s.videoClips || []).length;
      });
    });
  });

  const statStationsEl = document.getElementById('lms-stat-stations');
  if (statStationsEl) statStationsEl.textContent = `${totalStations} منزلگاه ثبت‌شده`;

  const statSessionsEl = document.getElementById('lms-stat-sessions');
  if (statSessionsEl) statSessionsEl.textContent = `${totalSessions} جلسه واقعی`;

  const statQuizzesEl = document.getElementById('lms-stat-quizzes');
  if (statQuizzesEl) statQuizzesEl.textContent = `${totalParts} پارت با آزمونک`;

  window.filterLmsTable();
};

window.renderLmsDirectoryRows = function(list, selectedCategoryFilter = 'all', selectedInstructorFilter = 'all') {
  const tbody = document.getElementById('lms-directory-tbody');
  if (!tbody) return;

  if (!list || list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:#94a3b8;">هیچ منزلگاهی با این فیلترها یافت نشد.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map((st, i) => {
    const idx = st.orderIndex ?? st.index ?? (i + 1);
    const stationIdentifier = st.id || ('MZ' + idx);
    const title = st.title || st.name || ('منزلگاه ' + idx);
    
    // Process categories & real session counts
    const categories = st.categories || [];
    const skillCategory = categories.find(c => c.orderIndex === 1 || (c.title && c.title.includes('مهارت'))) || {
      title: 'کلاس مهارتی',
      sessions: []
    };
    const mediaCategory = categories.find(c => c.orderIndex === 2 || (c.title && c.title.includes('رسانه'))) || {
      title: 'کلاس رسانه‌ای',
      sessions: []
    };

    const skillSessCount = (skillCategory.sessions || []).length;
    const mediaSessCount = (mediaCategory.sessions || []).length;
    const totalRealSess = skillSessCount + mediaSessCount;

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

    // Filter display depending on selected category filter ('all', 'مهارتی', 'رسانه‌ای')
    const isSkillOnly = selectedCategoryFilter === 'مهارتی' || selectedCategoryFilter === 'skill';
    const isMediaOnly = selectedCategoryFilter === 'رسانه‌ای' || selectedCategoryFilter === 'media';

    let categoryBadgeHtml = '';
    let sessionsDisplayHtml = '';

    if (isSkillOnly) {
      categoryBadgeHtml = `<span class="badge" style="background:#0284c7; color:white; font-size:11px; padding:4px 10px;">فقط کلاس مهارتی</span>`;
      sessionsDisplayHtml = `<div style="font-weight:bold; color:#38bdf8;">${skillSessCount} جلسه مهارتی</div>`;
    } else if (isMediaOnly) {
      categoryBadgeHtml = `<span class="badge" style="background:#7c3aed; color:white; font-size:11px; padding:4px 10px;">فقط کلاس رسانه‌ای</span>`;
      sessionsDisplayHtml = `<div style="font-weight:bold; color:#a78bfa;">${mediaSessCount} جلسه رسانه‌ای</div>`;
    } else {
      categoryBadgeHtml = `
        <div style="display:flex; flex-direction:column; gap:4px; align-items:center;">
          <span class="badge" style="background:#0284c7; color:white; font-size:11px; padding:3px 8px;">کلاس مهارتی (${skillSessCount} جلسه)</span>
          <span class="badge" style="background:#7c3aed; color:white; font-size:11px; padding:3px 8px;">کلاس رسانه‌ای (${mediaSessCount} جلسه)</span>
        </div>
      `;
      sessionsDisplayHtml = `
        <div style="font-weight:bold; color:#38bdf8;">${totalRealSess} جلسه واقعی</div>
        <div style="font-size:11px; color:#a78bfa;">(${skillSessCount} مهارتی / ${mediaSessCount} رسانه‌ای)</div>
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
          <strong style="color:white; font-size:14px;">${title}</strong>
          <div style="font-size:11px; color:#94a3b8; margin-top:2px;">${st.description || ''}</div>
        </td>
        <td>${instructorsDisplayHtml}</td>
        <td style="text-align:center;">${categoryBadgeHtml}</td>
        <td style="color:#cbd5e1; font-size:12px;">
          <div style="display:flex; align-items:center; gap:5px; color:#38bdf8; font-weight:bold;">
            <i class="fa-solid fa-calendar-days"></i> ${releaseDateStr}
          </div>
        </td>
        <td style="text-align:center; font-family:monospace;">${sessionsDisplayHtml}</td>
        <td style="text-align:center;">
          <span class="badge badge-active">فعال</span>
        </td>
        <td style="text-align:center;">
          <div style="display:flex; justify-content:center; gap:6px; flex-wrap:wrap;">
            <button type="button" class="page-btn" style="background:#0284c7; color:white; padding:5px 10px; font-size:11px; border-radius:6px; border:none; cursor:pointer;" onclick="window.openStationContentManagerModal('${stationIdentifier}', '${selectedCategoryFilter}')" title="مدیریت پارت‌ها و آزمونک‌ها">
              <i class="fa-solid fa-film"></i> پارت‌ها و آزمونک‌ها
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

  const modal = document.getElementById('lms-content-manager-modal');
  if (!modal) return;

  let filterTitleSuffix = '';
  if (currentCatFilter === 'مهارتی' || currentCatFilter === 'skill') {
    filterTitleSuffix = ' <span style="font-size:12px; color:#38bdf8; font-weight:normal; background:rgba(2,132,199,0.2); padding:2px 8px; border-radius:10px; margin-right:6px;">(فقط کلاس‌های مهارتی)</span>';
  } else if (currentCatFilter === 'رسانه‌ای' || currentCatFilter === 'media') {
    filterTitleSuffix = ' <span style="font-size:12px; color:#a78bfa; font-weight:normal; background:rgba(124,58,237,0.2); padding:2px 8px; border-radius:10px; margin-right:6px;">(فقط کلاس‌های رسانه‌ای)</span>';
  }

  const titleEl = document.getElementById('lms-content-modal-title');
  if (titleEl) {
    titleEl.innerHTML = `<i class="fa-solid fa-photo-film"></i> مدیریت ویدیوها و آزمونک‌های ${station.title}${filterTitleSuffix}`;
  }

  const container = document.getElementById('lms-content-modal-body');
  if (!container) return;

  let categories = station.categories || [];

  // Filter categories according to selected category filter
  if (currentCatFilter === 'مهارتی' || currentCatFilter === 'skill') {
    categories = categories.filter(c => c.orderIndex === 1 || (c.title && c.title.includes('مهارت')));
  } else if (currentCatFilter === 'رسانه‌ای' || currentCatFilter === 'media') {
    categories = categories.filter(c => c.orderIndex === 2 || (c.title && c.title.includes('رسانه')));
  }

  if (categories.length === 0) {
    container.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:20px;">هیچ دسته‌بندی با این فیلتر برای این منزلگاه پیدا نشد.</div>';
    modal.style.display = 'flex';
    modal.style.zIndex = '999999';
    return;
  }

  let html = '';
  categories.forEach(cat => {
    const isSkill = cat.orderIndex === 1 || (cat.title && cat.title.includes('مهارت'));
    const color = isSkill ? '#38bdf8' : '#a78bfa';
    const bg = isSkill ? 'rgba(2, 132, 199, 0.1)' : 'rgba(124, 58, 237, 0.1)';
    const sessions = cat.sessions || [];

    html += `
      <div style="background:${bg}; border:1px solid ${color}; border-radius:10px; padding:15px; margin-bottom:20px;">
        <h4 style="margin:0 0 15px 0; color:${color}; font-size:15px; display:flex; align-items:center; justify-content:space-between;">
          <span><i class="fa-solid fa-layer-group"></i> ${cat.title} (${sessions.length} جلسه)</span>
        </h4>
    `;

    if (sessions.length === 0) {
      html += '<div style="color:#cbd5e1; font-size:12px; padding:10px;">جلسه‌ای در این دسته ثبت نشده است.</div>';
    } else {
      sessions.forEach((sess, sIdx) => {
        const clips = sess.videoClips || [];
        const quizzes = sess.quizzes || [];

        html += `
          <div style="background:rgba(15, 23, 42, 0.7); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:12px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <strong style="color:white; font-size:13px;"><i class="fa-solid fa-book-open"></i> ${sess.title}</strong>
              <span style="font-size:11px; color:#94a3b8;">${clips.length} پارت ویدیو | ${quizzes.length} آزمونک</span>
            </div>

            <!-- Video Clips List & Link Editor -->
            <div style="margin-bottom:10px;">
              <div style="font-size:12px; color:#38bdf8; font-weight:bold; margin-bottom:6px;"><i class="fa-solid fa-link"></i> پارت‌های ویدیویی (مشاهده و اصلاح لینک):</div>
        `;

        if (clips.length === 0) {
          html += '<div style="color:#94a3b8; font-size:11px;">پارتی برای این جلسه ثبت نشده است.</div>';
        } else {
          clips.forEach((clip, cIdx) => {
            // Find quizzes attached to this specific clip
            const clipQuizzes = quizzes.filter(q => q.clipId === clip.id || q.orderIndex === clip.clipOrder);

            html += `
              <div style="background:rgba(30, 41, 59, 0.8); border:1px solid rgba(255,255,255,0.05); border-radius:6px; padding:10px; margin-bottom:8px;">
                <div style="display:grid; grid-template-columns: 1.5fr 2fr 1fr; gap:8px; align-items:center; margin-bottom:6px;">
                  <div>
                    <label style="font-size:11px; color:#cbd5e1; display:block;">عنوان پارت ${clip.clipOrder || (cIdx + 1)}:</label>
                    <input type="text" id="clip-title-${clip.id}" class="input-ctrl" style="font-size:12px; padding:4px 8px;" value="${clip.title || ''}">
                  </div>
                  <div>
                    <label style="font-size:11px; color:#38bdf8; display:block;"><i class="fa-solid fa-video"></i> لینک ویدیو (Aparat/URL):</label>
                    <input type="text" id="clip-url-${clip.id}" class="input-ctrl" style="font-size:11px; padding:4px 8px; direction:ltr;" value="${clip.videoUrl || ''}" placeholder="https://...">
                  </div>
                  <div style="display:flex; gap:4px; align-items:flex-end;">
                    <button type="button" style="background:#0284c7; color:white; border:none; border-radius:4px; padding:6px 10px; font-size:11px; cursor:pointer;" onclick="window.saveClipVideoUrl('${sess.id}', '${clip.id}')">
                      <i class="fa-solid fa-save"></i> ذخیره لینک
                    </button>
                    <button type="button" style="background:#10b981; color:white; border:none; border-radius:4px; padding:6px 10px; font-size:11px; cursor:pointer;" onclick="window.openQuizModalForClip('${sess.id}', '${clip.id}')">
                      <i class="fa-solid fa-plus"></i> ایجاد آزمونک
                    </button>
                  </div>
                </div>

                <!-- Per-Part Quiz Inspector & Manager -->
                <div style="background:rgba(15, 23, 42, 0.5); border-right:3px solid #f59e0b; padding:6px 10px; margin-top:6px; border-radius:4px;">
                  <div style="font-size:11px; color:#f59e0b; font-weight:bold; margin-bottom:4px;"><i class="fa-solid fa-circle-question"></i> آزمونک‌های پارت ${clip.clipOrder || (cIdx + 1)}:</div>
            `;

            if (clipQuizzes.length === 0) {
              html += `<div style="font-size:11px; color:#94a3b8;">هنوز آزمونکی برای این پارت تعریف نشده است. <a href="javascript:void(0)" style="color:#38bdf8;" onclick="window.openQuizModalForClip('${sess.id}', '${clip.id}')">+ افزودن آزمونک</a></div>`;
            } else {
              clipQuizzes.forEach(quiz => {
                let questionText = 'سوال چندگزینه‌ای پارت';
                if (quiz.questionsJson) {
                  try {
                    const parsed = JSON.parse(quiz.questionsJson);
                    if (Array.isArray(parsed) && parsed[0]) {
                      questionText = parsed[0].question || questionText;
                    }
                  } catch (e) {}
                }

                html += `
                  <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:white; background:rgba(0,0,0,0.2); padding:4px 8px; border-radius:4px; margin-bottom:4px;">
                    <span><strong>${quiz.title}</strong> (${questionText}) - پاداش: ${quiz.rewardZarik || 10} زریک</span>
                    <div style="display:flex; gap:4px;">
                      <button type="button" style="background:#f59e0b; color:black; border:none; padding:2px 6px; border-radius:4px; font-size:10px; cursor:pointer;" onclick="window.editQuizRecord('${quiz.id}')">
                        <i class="fa-solid fa-pen"></i> اصلاح
                      </button>
                      <button type="button" style="background:#ef4444; color:white; border:none; padding:2px 6px; border-radius:4px; font-size:10px; cursor:pointer;" onclick="window.deleteQuizRecord('${quiz.id}')">
                        <i class="fa-solid fa-trash"></i> حذف
                      </button>
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

window.saveClipVideoUrl = async function(sessionId, clipId) {
  const title = document.getElementById(`clip-title-${clipId}`)?.value;
  const videoUrl = document.getElementById(`clip-url-${clipId}`)?.value;

  const payload = {
    id: clipId,
    sessionId: sessionId,
    title: title || 'پارت ویدیو',
    videoUrl: videoUrl || ''
  };

  const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
  try {
    const res = await fetch('/api/v1/admin/lms/clips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      alert('لینک و مشخصات پارت با موفقیت ذخیره شد');
      window.fetchLiveLmsStations();
    } else {
      alert('خطا در ذخیره‌سازی لینک ویدیو');
    }
  } catch (err) {
    console.error('Save clip error:', err);
    alert('ارتباط با سرور برقرار نشد');
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

  document.getElementById('quiz-opt-0').value = 'گزینه صحیح';
  document.getElementById('quiz-opt-1').value = 'گزینه نادرست اول';
  document.getElementById('quiz-opt-2').value = 'گزینه نادرست دوم';
  document.getElementById('quiz-opt-3').value = 'گزینه نادرست سوم';
  document.getElementById('opt-radio-0').checked = true;

  modal.style.display = 'flex';
  modal.style.zIndex = '1000000';
};

window.editQuizRecord = function(quizId) {
  let foundQuiz = null;
  window.lmsStationsMasterList.forEach(st => {
    (st.categories || []).forEach(cat => {
      (cat.sessions || []).forEach(sess => {
        (sess.quizzes || []).forEach(q => {
          if (q.id === quizId) foundQuiz = q;
        });
      });
    });
  });

  if (!foundQuiz) return;

  const modal = document.getElementById('lms-quiz-editor-modal');
  if (!modal) return;

  document.getElementById('quiz-modal-id').value = foundQuiz.id;
  document.getElementById('quiz-modal-session-id').value = foundQuiz.sessionId;
  document.getElementById('quiz-modal-clip-id').value = foundQuiz.clipId || '';

  document.getElementById('quiz-modal-title-input').value = foundQuiz.title || 'آزمونک پارت';
  document.getElementById('quiz-modal-zarik').value = foundQuiz.rewardZarik || 10;

  let qText = 'سوال پارت';
  let opts = ['گزینه ۱', 'گزینه ۲', 'گزینه ۳', 'گزینه ۴'];
  let correctIdx = 0;

  if (foundQuiz.questionsJson) {
    try {
      const parsed = JSON.parse(foundQuiz.questionsJson);
      if (Array.isArray(parsed) && parsed[0]) {
        qText = parsed[0].question || qText;
        opts = parsed[0].options || opts;
        correctIdx = parsed[0].correctIndex ?? 0;
      }
    } catch (e) {}
  }

  document.getElementById('quiz-modal-q-text').value = qText;
  document.getElementById('quiz-opt-0').value = opts[0] || '';
  document.getElementById('quiz-opt-1').value = opts[1] || '';
  document.getElementById('quiz-opt-2').value = opts[2] || '';
  document.getElementById('quiz-opt-3').value = opts[3] || '';

  const radioEl = document.getElementById(`opt-radio-${correctIdx}`) || document.getElementById('opt-radio-0');
  if (radioEl) radioEl.checked = true;

  modal.style.display = 'flex';
  modal.style.zIndex = '1000000';
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
      alert('آزمونک با موفقیت ذخیره شد');
      document.getElementById('lms-quiz-editor-modal').style.display = 'none';
      await window.fetchLiveLmsStations();
      if (sessionId) {
        const st = window.lmsStationsMasterList.find(s => 
          (s.categories || []).some(c => (c.sessions || []).some(sess => sess.id === sessionId))
        );
        if (st) window.openStationContentManagerModal(st.id);
      }
    } else {
      alert('خطا در ذخیره‌سازی آزمونک');
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
      document.getElementById('lms-content-manager-modal').style.display = 'none';
    }
  } catch (err) {
    console.error(err);
  }
};

window.openCreateStationModal = function() {
  const modal = document.getElementById('lms-station-creator-modal');
  if (!modal) return;
  document.getElementById('lms-creator-form').reset();
  document.getElementById('modal-st-id').value = '';
  document.getElementById('modal-st-index').value = window.lmsStationsMasterList.length + 1;
  document.getElementById('modal-st-release-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('modal-st-skill-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('modal-st-media-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('station-modal-title').innerHTML = '<i class="fa-solid fa-plus"></i> ایجاد منزلگاه آموزشی جدید (با تقویم دو دسته کلاس)';
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
  document.getElementById('modal-st-skill-title').value = skillCategory.title || 'کلاس‌های مهارتی (شنبه و دوشنبه)';
  document.getElementById('modal-st-skill-sessions').value = (skillCategory.sessions || []).length || 2;
  document.getElementById('modal-st-skill-date').value = formattedReleaseDate;

  // Media category values
  document.getElementById('modal-st-media-title').value = mediaCategory.title || 'کلاس‌های رسانه‌ای (پنجشنبه و جمعه)';
  document.getElementById('modal-st-media-sessions').value = (mediaCategory.sessions || []).length || 2;
  document.getElementById('modal-st-media-date').value = formattedReleaseDate;

  document.getElementById('modal-st-details').value = st.description || '';
  document.getElementById('station-modal-title').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> ویرایش منزلگاه و تاریخ تقویم: ${st.title || st.name}`;
  modal.style.display = 'flex';
  modal.style.zIndex = '99999';
};

window.saveCompleteStation = async function(e) {
  e.preventDefault();
  const id = document.getElementById('modal-st-id')?.value;
  const releaseDate = document.getElementById('modal-st-release-date')?.value || new Date().toISOString().split('T')[0];

  const skillTitle = document.getElementById('modal-st-skill-title')?.value || 'کلاس‌های مهارتی (شنبه و دوشنبه)';
  const skillSessionsCount = parseInt(document.getElementById('modal-st-skill-sessions')?.value) || 2;

  const mediaTitle = document.getElementById('modal-st-media-title')?.value || 'کلاس‌های رسانه‌ای (پنجشنبه و جمعه)';
  const mediaSessionsCount = parseInt(document.getElementById('modal-st-media-sessions')?.value) || 2;

  const payload = {
    id: id || undefined,
    orderIndex: parseInt(document.getElementById('modal-st-index')?.value) || 1,
    title: document.getElementById('modal-st-title')?.value,
    releaseDate: releaseDate,
    description: document.getElementById('modal-st-details')?.value,
    categories: [
      {
        title: skillTitle,
        orderIndex: 1,
        sessionsCount: skillSessionsCount
      },
      {
        title: mediaTitle,
        orderIndex: 2,
        sessionsCount: mediaSessionsCount
      }
    ]
  };

  const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
  try {
    const url = id ? `/api/v1/admin/lms/stations/${id}` : '/api/v1/admin/lms/stations';
    const method = id ? 'PUT' : 'POST';
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload)
    });
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

// Automatic load bindings
window.loadLmsStationsData = window.fetchLiveLmsStations;
document.addEventListener('DOMContentLoaded', () => {
  if (window.fetchLiveLmsStations) window.fetchLiveLmsStations();
});
