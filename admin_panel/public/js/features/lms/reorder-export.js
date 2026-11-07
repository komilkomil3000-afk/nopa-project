// LMS station delete and Excel export (stations are reordered by drag and drop: station-dnd.js).
// Split out of the former lms.js (Phase 7).

// Note: Station creator and edit modal functions are defined in the dynamic section below.

window.deleteStationRecord = async function(id) {
  if (!(await NopaConfirm('آیا از حذف این منزلگاه اطمینان دارید؟'))) return;
  // Gone from the overview at once (its open page closes); deleted on the server only if not undone within 10s.
  // The server still has it until then, so «لغو» just loads the stations again.
  const st = (window.lmsStationsMasterList || []).find(s => String(s.id) === String(id));
  NopaUndo.later({
    message: `منزلگاه «${(st && st.title) || ''}» حذف شد.`,
    hide: () => {
      window.lmsStationsMasterList = (window.lmsStationsMasterList || []).filter(s => String(s.id) !== String(id));
      if (String(window.lmsActiveStationId) === String(id) && typeof window.closeLmsStationView === 'function') window.closeLmsStationView();
      if (typeof window.renderLmsStationsBento === 'function') window.renderLmsStationsBento();
      return () => window.fetchLiveLmsStations();
    },
    commit: () => request(`/api/v1/admin/lms/stations/${id}`, { method: 'DELETE' }),
    done: () => window.fetchLiveLmsStations(),
  });
};

// A full copy of a station (sessions, parts and quizzes; no student data). The copy starts locked.
window.duplicateStationRecord = async function(id) {
  const st = (window.lmsStationsMasterList || []).find(s => String(s.id) === String(id));
  if (!(await NopaConfirm(`از منزلگاه «${(st && st.title) || ''}» یک کپی کامل (دسته‌ها، جلسات، پارت‌ها و آزمونک‌ها) ساخته شود؟ کپی قفل ساخته می‌شود.`))) return;
  try {
    const res = await request(`/api/v1/admin/lms/stations/${id}/duplicate`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return showToast(data.error || 'خطا در کپی منزلگاه', 'error');
    showToast('کپی منزلگاه ساخته شد و قفل است؛ پس از بررسی، قفلش را باز کنید.', 'success');
    await window.fetchLiveLmsStations();
  } catch (err) {
    console.error('duplicateStationRecord error:', err);
    showToast('خطا در کپی منزلگاه', 'error');
  }
};

window.exportLmsToExcel = function() {

  const list = window.lmsStationsMasterList || [];
  if (list.length === 0) {
    showToast('اطلاعات منزلگاه‌ها هنوز بارگذاری نشده است. لطفاً چند لحظه صبر کنید.', 'error');
    return;
  }

  let totalAllSessions = 0;
  let totalAllCategories = 0;
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

    // Every category under its own title, in order (any number of them)
    const categories = window.lmsOrderedCategories ? window.lmsOrderedCategories(st) : (st.categories || []);
    const perCategory = categories.map(c => ({ title: c.title || 'دسته', count: (c.sessions || []).filter(s => !s.isDeleted).length }));
    const totalSessions = perCategory.reduce((n, c) => n + c.count, 0);
    const perCategoryStr = perCategory.map(c => `${c.title}: ${c.count} جلسه`).join(' | ') || '-';

    totalAllSessions += totalSessions;
    totalAllCategories += categories.length;

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
        <td style="text-align:center; font-weight:bold; color:#7C3AED; mso-number-format:'\\@';">${mzCode}</td>
        <td style="font-weight:bold; color:#1E1633;">${esc(title)}</td>
        <td>${esc(instructorsStr)}</td>
        <td style="text-align:center;">${categories.length} دسته</td>
        <td>${esc(perCategoryStr)}</td>
        <td style="text-align:center; font-weight:bold; color:#7C3AED;">${totalSessions} جلسه</td>
        <td style="text-align:center;">${totalClips} پارت</td>
        <td style="text-align:center; font-weight:bold; color:#A16207;">${totalQuizzes} آزمونک</td>
        <td style="text-align:center; mso-number-format:'\\@';">${releaseDateStr}</td>
        <td style="font-size:11px; color:#64748b;">${esc(desc)}</td>
        <td style="text-align:center; background-color:#dcfce7; color:#166534; font-weight:bold;">فعال</td>
      </tr>
    `;
  });

  // Summary footer row
  tableRows += `
    <tr style="background-color:#f3f0ff; font-weight:bold;">
      <td colspan="4" style="text-align:center; padding:10px; font-size:13px; color:#1E1633;">مجموع کل سامانه نپا</td>
      <td style="text-align:center; color:#7C3AED;">${totalAllCategories} دسته</td>
      <td style="text-align:center; color:#7C3AED;">-</td>
      <td style="text-align:center; color:#7C3AED; font-size:13px;">${totalAllSessions} جلسه</td>
      <td style="text-align:center; color:#7C3AED;">${totalAllClips} پارت</td>
      <td style="text-align:center; color:#A16207; font-size:13px;">${totalAllQuizzes} آزمونک</td>
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
        body { font-family: 'YekanBakh', Tahoma, sans-serif; direction: rtl; }
        table { border-collapse: collapse; width: 100%; direction: rtl; }
        th { background-color: #2E1065; color: #ffffff; font-weight: bold; border: 1px solid #4C1D95; padding: 10px 8px; font-size: 12px; text-align: center; }
        td { border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 12px; vertical-align: middle; }
      </style>
    </head>
    <body>
      <table>
        <thead>
          <tr>
            <th colspan="13" style="font-size:15px; padding:14px; background-color:#1E1633; color:#EAB308; text-align:center;">
              گزارش جامع ساختار منزلگاه‌ها، جلسات و آزمونک‌های سامانه آموزشی نپا
            </th>
          </tr>
          <tr>
            <th style="width:40px;">ردیف</th>
            <th style="width:70px;">کد</th>
            <th style="width:220px;">نام و عنوان منزلگاه</th>
            <th style="width:180px;">اساتید و مربیان</th>
            <th style="width:90px;">دسته‌ها</th>
            <th style="width:220px;">جلسات هر دسته</th>
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
