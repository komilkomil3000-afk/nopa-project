// LMS Stations Logic - Recovery
window.lmsStationsMasterList = [];

window.fetchLiveLmsStations = async function() {
  const tbody = document.getElementById('lms-directory-tbody');
  if (!tbody) return;

  const sheet03SeedData = [
    { id: 'MZ1', orderIndex: 1, title: 'مبانی شناخت و رسانه (شوک و اینشات)', instructors: 'پیراینهگر (مهارتی) / علیرضا خوشمنظر (رسانهای)', category: 'ترکیبی', schedule: 'شنبه و دوشنبه / ۵شنبه و جمعه', sessionsCount: 4, partsCount: 32, status: 'فعال' },
    { id: 'MZ2', orderIndex: 2, title: 'خودشناسی جامع و پادکست', instructors: 'پیرچهرهتراش (مهارتی) / علیرضا خوشمنظر (رسانهای)', category: 'ترکیبی', schedule: 'شنبه و دوشنبه / ۵شنبه و جمعه', sessionsCount: 16, partsCount: 128, status: 'فعال' },
    { id: 'MZ3', orderIndex: 3, title: 'شناخت همراهان و دشمنان (کنوا)', instructors: 'پیردیدهبان (مهارتی) / حیدری (رسانهای)', category: 'ترکیبی', schedule: 'شنبه و دوشنبه / ۵شنبه و جمعه', sessionsCount: 12, partsCount: 96, status: 'فعال' },
    { id: 'MZ4', orderIndex: 4, title: 'شناخت هستی (کنوا پیشرفته)', instructors: 'پیرناخدا (مهارتی) / حیدری (رسانهای)', category: 'ترکیبی', schedule: 'شنبه و دوشنبه / ۵شنبه و جمعه', sessionsCount: 8, partsCount: 64, status: 'فعال' },
    { id: 'MZ5', orderIndex: 5, title: 'هدفگذاری (فتوشاپ)', instructors: 'پیرمنجم (مهارتی) / کمیل زاهدی (رسانهای)', category: 'ترکیبی', schedule: 'شنبه و دوشنبه / ۵شنبه و جمعه', sessionsCount: 10, partsCount: 80, status: 'فعال' }
  ];

  try {
    const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
    const res = await fetch('/api/v1/lms/stations', {
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
    });

    if (res.ok) {
      const data = await res.json();
      const stations = Array.isArray(data) ? data : (data.stations || data.data || []);
      window.lmsStationsMasterList = (stations && stations.length > 0) ? stations : sheet03SeedData;
    } else {
      window.lmsStationsMasterList = sheet03SeedData;
    }
  } catch (err) {
    window.lmsStationsMasterList = sheet03SeedData;
  }

  window.renderLmsDirectoryRows(window.lmsStationsMasterList);
};

window.renderLmsDirectoryRows = function(list) {
  const tbody = document.getElementById('lms-directory-tbody');
  if (!tbody) return;

  tbody.innerHTML = list.map((st, i) => {
    const idx = st.orderIndex || st.index || (i + 1);
    const title = st.title || st.name || ('منزلگاه ' + idx);
    const instructors = st.instructors || st.instructor || st.mentor || 'اساتید نپا';
    const cat = st.category || 'ترکیبی';
    const schedule = st.schedule || 'شنبه و دوشنبه / ۵شنبه و جمعه';
    const sessions = st.sessionsCount || st.sessions || (idx === 1 ? 4 : idx === 2 ? 16 : idx === 3 ? 12 : idx === 4 ? 8 : 10);
    const parts = st.partsCount || (sessions * 8);

    return `
      <tr class="hover:bg-slate-800/40 transition-colors border-b border-slate-800/60 text-xs">
        <td class="p-4 text-center font-mono font-bold text-indigo-400">MZ${idx}</td>
        <td class="p-4 font-bold text-white">${title}</td>
        <td class="p-4 text-center text-slate-200 font-semibold">${instructors}</td>
        <td class="p-4 text-center">
          <span class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">${cat}</span>
        </td>
        <td class="p-4 text-center text-slate-300">${schedule}</td>
        <td class="p-4 text-center font-mono text-slate-300">${sessions} جلسه (${parts} پارت)</td>
        <td class="p-4 text-center">
          <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">فعال</span>
        </td>
        <td class="p-4 text-center">
          <div class="flex items-center justify-center gap-2">
            <button type="button" onclick="window.editStationModal('${st.id || ('MZ' + idx)}')" class="text-indigo-400 hover:text-indigo-300 transition" title="مشاهده و ویرایش">👁️</button>
            <button type="button" onclick="window.editStationModal('${st.id || ('MZ' + idx)}')" class="text-amber-400 hover:text-amber-300 transition" title="ویرایش">✏️</button>
            <button type="button" onclick="window.deleteStationRecord('${st.id || ('MZ' + idx)}')" class="text-rose-400 hover:text-rose-300 transition" title="حذف">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
};

window.filterLmsTable = function() {
  const query = (document.getElementById('lms-search-input')?.value || '').trim().toLowerCase();
  const cat = document.getElementById('lms-filter-category')?.value || 'all';
  const inst = document.getElementById('lms-filter-instructor')?.value || 'all';

  const filtered = window.lmsStationsMasterList.filter(st => {
    const matchesQuery = !query || 
      (st.title && st.title.toLowerCase().includes(query)) ||
      (st.instructors && st.instructors.toLowerCase().includes(query));

    const matchesCat = (cat === 'all') || (st.category === cat) || (st.description && st.description.includes(cat));
    const matchesInst = (inst === 'all') || (st.instructors && st.instructors.includes(inst));

    return matchesQuery && matchesCat && matchesInst;
  });

  window.renderLmsDirectoryRows(filtered);
};

window.openCreateStationModal = function() {
  const modal = document.getElementById('lms-station-creator-modal');
  if (!modal) return;
  document.getElementById('lms-creator-form').reset();
  document.getElementById('modal-st-id').value = '';
  document.getElementById('modal-st-index').value = window.lmsStationsMasterList.length + 1;
  document.getElementById('station-modal-title').innerHTML = '<span>➕</span> ایجاد منزلگاه آموزشی جدید در SQLite';
  modal.style.display = 'flex';
};

window.editStationModal = function(id) {
  const st = window.lmsStationsMasterList.find(s => (s.id === id || ('MZ' + (s.orderIndex || s.index)) === id || s.orderIndex == id)) || window.lmsStationsMasterList[0];
  if (!st) return;
  const modal = document.getElementById('lms-station-creator-modal');
  if (!modal) return;

  document.getElementById('modal-st-id').value = st.id || '';
  document.getElementById('modal-st-index').value = st.orderIndex || st.index || 1;
  document.getElementById('modal-st-title').value = st.title || st.name || '';
  document.getElementById('modal-st-cat').value = st.category || 'ترکیبی';
  document.getElementById('modal-st-instructors').value = st.instructors || st.instructor || '';
  document.getElementById('modal-st-schedule').value = st.schedule || 'شنبه و دوشنبه / ۵شنبه و جمعه';
  document.getElementById('modal-st-sessions').value = st.sessionsCount || st.sessions || 4;
  document.getElementById('modal-st-details').value = st.description || '';
  document.getElementById('station-modal-title').innerHTML = `<span>✏️</span> ویرایش منزلگاه: ${st.title || st.name}`;
  modal.style.display = 'flex';
};

window.saveCompleteStation = async function(e) {
  e.preventDefault();
  const id = document.getElementById('modal-st-id')?.value;
  const payload = {
    orderIndex: parseInt(document.getElementById('modal-st-index')?.value) || 1,
    title: document.getElementById('modal-st-title')?.value,
    category: document.getElementById('modal-st-cat')?.value,
    instructors: document.getElementById('modal-st-instructors')?.value,
    schedule: document.getElementById('modal-st-schedule')?.value,
    sessionsCount: parseInt(document.getElementById('modal-st-sessions')?.value) || 4,
    description: document.getElementById('modal-st-details')?.value
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
  } catch (err) {}
  window.fetchLiveLmsStations();
};

window.exportLmsToExcel = function() {
  let csv = '\uFEFFشناسه,نام منزلگاه,اساتید,دسته,زمان بندی,تعداد جلسات\n';
  window.lmsStationsMasterList.forEach(st => {
    csv += `"${st.id || 'MZ' + (st.orderIndex || 1)}","${st.title || ''}","${st.instructors || ''}","${st.category || ''}","${st.schedule || ''}","${st.sessionsCount || 4}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `LMS_Stations_${Date.now()}.csv`;
  a.click();
};

window.exportLmsToPdf = function() {
  window.print();
};

// Automatic load bindings
window.loadLmsStationsData = window.fetchLiveLmsStations;
document.addEventListener('DOMContentLoaded', () => {
  if (window.fetchLiveLmsStations) window.fetchLiveLmsStations();
});
document.querySelectorAll('[data-tab="lms"]').forEach(el => {
  el.addEventListener('click', () => setTimeout(window.fetchLiveLmsStations, 100));
});
