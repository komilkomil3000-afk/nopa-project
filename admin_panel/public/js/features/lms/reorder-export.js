// LMS station delete, reorder (unique 1..N) and Excel export.
// Split out of the former lms.js (Phase 7).

// Note: Station creator and edit modal functions are defined in the dynamic section below.

window.deleteStationRecord = async function(id) {
  if (!(await NopaConfirm('آیا از حذف این منزلگاه اطمینان دارید؟'))) return;
  try {
    await request(`/api/v1/admin/lms/stations/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json'  }
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
    showToast('منزلگاهی برای مرتب‌سازی یافت نشد.', 'error');
    return;
  }

  // Clone and sort current stations by orderIndex
  window.lmsReorderList = JSON.parse(JSON.stringify(window.lmsStationsMasterList))
    .sort((a, b) => (Number(a.orderIndex ?? a.index) || 0) - (Number(b.orderIndex ?? b.index) || 0));

  window.renderReorderList();
  modal.style.display = 'flex';
  modal.style.zIndex = 'var(--z-modal)';
};

window.renderReorderList = function() {
  const container = document.getElementById('lms-reorder-list-container');
  if (!container) return;

  if (!window.lmsReorderList || window.lmsReorderList.length === 0) {
    container.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:20px;">هیچ منزلگاهی وجود ندارد.</div>';
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
      <div style="display:flex; align-items:center; justify-content:space-between; background:rgb(var(--surface-2-rgb) / 0.85); border:1px solid rgb(var(--fg-rgb) / 0.08); border-radius:10px; padding:12px 16px; transition:all 0.2s;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="background:linear-gradient(135deg, var(--primary), var(--primary-strong)); color:white; font-weight:bold; font-size:13.5px; width:38px; height:38px; border-radius:8px; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 6px rgb(var(--shade-rgb) / 0.3);">
            ${currentNumber}
          </div>
          <div>
            <div style="font-weight:bold; color:var(--text); font-size:14px; display:flex; align-items:center; gap:8px;">
              <span>${persianStationTitle}</span>
              ${st.title && !st.title.startsWith('Station') && !st.title.startsWith('منزلگاه') ? `<span style="font-size:12px; color:var(--primary-text); font-weight:normal;">(${esc(st.title)})</span>` : ''}
            </div>
            <div style="font-size:11.5px; color:var(--text-muted); margin-top:3px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span style="color:var(--primary-text);"><i class="fa-solid fa-brain"></i> مهارتی: ${skillTopic}</span>
              <span style="color:var(--text-faint);">|</span>
              <span style="color:var(--primary-text);"><i class="fa-solid fa-photo-film"></i> رسانه‌ای: ${mediaTopic}</span>
              <span style="color:var(--text-faint);">|</span>
              <span style="color:var(--text-soft);">${totalSessions} جلسه مصوب</span>
            </div>
          </div>
        </div>

        <div style="display:flex; gap:6px; align-items:center;">
          <button type="button" onclick="window.moveStationInReorder(${idx}, ${idx - 1})" ${isFirst ? 'disabled' : ''} style="background:${isFirst ? 'rgb(var(--fg-rgb) / 0.03)' : 'var(--surface-2)'}; color:${isFirst ? 'var(--text-faint)' : 'var(--primary)'}; border:1px solid ${isFirst ? 'transparent' : 'rgb(var(--primary-rgb) / 0.3)'}; width:36px; height:36px; border-radius:8px; cursor:${isFirst ? 'not-allowed' : 'pointer'}; font-size:14px; display:flex; align-items:center; justify-content:center;" title="حرکت به بالا">
            <i class="fa-solid fa-arrow-up"></i>
          </button>
          <button type="button" onclick="window.moveStationInReorder(${idx}, ${idx + 1})" ${isLast ? 'disabled' : ''} style="background:${isLast ? 'rgb(var(--fg-rgb) / 0.03)' : 'var(--surface-2)'}; color:${isLast ? 'var(--text-faint)' : 'var(--primary)'}; border:1px solid ${isLast ? 'transparent' : 'rgb(var(--primary-rgb) / 0.3)'}; width:36px; height:36px; border-radius:8px; cursor:${isLast ? 'not-allowed' : 'pointer'}; font-size:14px; display:flex; align-items:center; justify-content:center;" title="حرکت به پایین">
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

  try {
    const res = await request('/api/v1/admin/lms/stations/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json'  },
      body: JSON.stringify({ stationIds: orderedIds })
    });
    if (res.ok) {
      showToast('ترتیب منزلگاه‌ها با موفقیت ذخیره و یکتا شد (شماره‌گذاری ۱ تا ' + orderedIds.length + ')', 'success');
      document.getElementById('lms-station-reorder-modal').style.display = 'none';
      await window.fetchLiveLmsStations();
    } else {
      const data = await res.json();
      showToast('خطا در ذخیره ترتیب: ' + (data.error || 'خطای ناشناخته'), 'error');
    }
  } catch (err) {
    console.error('Reorder error:', err);
    showToast('ارتباط با سرور برقرار نشد', 'error');
  }
};

window.exportLmsToExcel = function() {

  const list = window.lmsStationsMasterList || [];
  if (list.length === 0) {
    showToast('اطلاعات منزلگاه‌ها هنوز بارگذاری نشده است. لطفاً چند لحظه صبر کنید.', 'error');
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
        <td style="text-align:center; font-weight:bold; color:var(--primary-text); mso-number-format:'\\@';">${mzCode}</td>
        <td style="font-weight:bold; color:var(--text);">${esc(title)}</td>
        <td>${esc(instructorsStr)}</td>
        <td style="text-align:center;">${categories.length} دسته</td>
        <td style="text-align:center;">${skillSessions} جلسه</td>
        <td style="text-align:center;">${mediaSessions} جلسه</td>
        <td style="text-align:center; font-weight:bold; color:var(--primary-text);">${totalSessions} جلسه</td>
        <td style="text-align:center;">${totalClips} پارت</td>
        <td style="text-align:center; font-weight:bold; color:var(--accent-text);">${totalQuizzes} آزمونک</td>
        <td style="text-align:center; mso-number-format:'\\@';">${releaseDateStr}</td>
        <td style="font-size:11px; color:var(--text-faint);">${esc(desc)}</td>
        <td style="text-align:center; background-color:rgb(var(--success-rgb) / 0.15); color:var(--success-text); font-weight:bold;">فعال</td>
      </tr>
    `;
  });

  // Summary footer row
  tableRows += `
    <tr style="background-color:var(--surface-2); font-weight:bold;">
      <td colspan="4" style="text-align:center; padding:10px; font-size:13px; color:var(--text);">مجموع کل سامانه نپا</td>
      <td style="text-align:center; color:var(--primary-text);">۱۰ دسته</td>
      <td style="text-align:center; color:var(--primary-text);">${totalAllSkill} جلسه</td>
      <td style="text-align:center; color:var(--primary-text);">${totalAllMedia} جلسه</td>
      <td style="text-align:center; color:var(--primary-text); font-size:13px;">${totalAllSessions} جلسه</td>
      <td style="text-align:center; color:var(--primary-text);">${totalAllClips} پارت</td>
      <td style="text-align:center; color:var(--accent-text); font-size:13px;">${totalAllQuizzes} آزمونک</td>
      <td colspan="3" style="text-align:center; color:var(--text-faint);">۵ منزلگاه فعال</td>
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
        body { font-family: 'YekanBakh', Tahoma, sans-serif; direction: rtl; }
        table { border-collapse: collapse; width: 100%; direction: rtl; }
        th { background-color: #0f172a; color: #ffffff; font-weight: bold; border: 1px solid #334155; padding: 10px 8px; font-size: 12px; text-align: center; }
        td { border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 12px; vertical-align: middle; }
      </style>
    </head>
    <body>
      <table>
        <thead>
          <tr>
            <th colspan="13" style="font-size:15px; padding:14px; background-color:var(--surface-2); color:var(--primary-text); text-align:center;">
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
