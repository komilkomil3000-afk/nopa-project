// Cross-feature helpers: universal export (exportData) and the dropdown toggle handler.
// Split out of the former app.js (Phase 7). Classic script: shares globals with the other modules;
// load order is set in index.html.

// ---- PHASE 5 NEW LOGIC ----

// 2. Universal Export Function
window.exportData = async function(type, format) {
  try {
    let url = `/api/v1/admin/export?type=${encodeURIComponent(type)}&format=${encodeURIComponent(format)}`;
    
    // Append current filters for league
    if (type === 'mentors_league') {
      const search = document.getElementById('mentor-league-search')?.value || '';
      const timeframe = document.getElementById('mentor-league-filter')?.value || 'weekly';
      const sortBy = document.getElementById('mentor-league-sort')?.value || 'rating';
      url += `&search=${encodeURIComponent(search)}&timeframe=${encodeURIComponent(timeframe)}&sortBy=${encodeURIComponent(sortBy)}`;
    } else if (type === 'league_caravans' || type === 'caravans_league') {
      const search = document.getElementById('league-search-input')?.value || '';
      const sortBy = document.getElementById('league-sort-by')?.value || 'totalScore';
      url += `&search=${encodeURIComponent(search)}&sortBy=${encodeURIComponent(sortBy)}`;
    } else if (type === 'league_individuals' || type === 'individuals_league') {
      const search = document.getElementById('league-search-input')?.value || '';
      const sortBy = document.getElementById('league-sort-by')?.value || 'totalScore';
      const caravanId = document.getElementById('league-caravan-filter')?.value || 'all';
      const role = document.getElementById('league-role-filter')?.value || 'all';
      url += `&search=${encodeURIComponent(search)}&sortBy=${encodeURIComponent(sortBy)}&caravanId=${encodeURIComponent(caravanId)}&role=${encodeURIComponent(role)}`;
    }

    if (typeof showToastSuccess === 'function') {
      showToastSuccess('در حال آماده‌سازی و دانلود فایل خروجی...');
    }

    const res = await request(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'خطا در تولید فایل خروجی');
    }
    
    const buffer = await res.arrayBuffer();
    const mimeType = format === 'pdf' ? 'application/pdf' 
                   : (format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv;charset=utf-8;');
    
    const blob = new Blob([buffer], { type: mimeType });
    const downloadUrl = window.URL.createObjectURL(blob);
    
    const extension = format === 'excel' ? 'xlsx' : format;
    let label = type;
    if (type === 'league_caravans' || type === 'caravans_league') label = 'لیگ_کاروان_ها';
    else if (type === 'league_individuals' || type === 'individuals_league') label = 'لیگ_افراد_و_اعضا';
    else if (type === 'mentors_league') label = 'لیگ_راهبران';
    else if (type === 'mentors') label = 'راهبران';
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `${label}_${dateStr}.${extension}`;
    
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      window.URL.revokeObjectURL(downloadUrl);
      a.remove();
    }, 15000);
  } catch (error) {
    console.error('Export Error:', error);
    showToast('خطا در دریافت فایل خروجی: ' + error.message, 'error');
  }
};

// 6. Universal Dropdown Toggle Handler (for export menus and dropdowns)
document.addEventListener('click', (e) => {
  const trigger = e.target.closest('.dropdown-wrapper > button, .dropdown-wrapper > .btn-action, .dropdown-wrapper > .btn-export');
  if (trigger) {
    e.preventDefault();
    e.stopPropagation();
    const wrapper = trigger.closest('.dropdown-wrapper');
    const wasOpen = wrapper.classList.contains('open');
    document.querySelectorAll('.dropdown-wrapper.open').forEach(w => w.classList.remove('open'));
    if (!wasOpen) wrapper.classList.add('open');
    return;
  }
  if (e.target.closest('.dropdown-content a')) {
    document.querySelectorAll('.dropdown-wrapper.open').forEach(w => w.classList.remove('open'));
    return;
  }
  if (!e.target.closest('.dropdown-wrapper')) {
    document.querySelectorAll('.dropdown-wrapper.open').forEach(w => w.classList.remove('open'));
  }
});
