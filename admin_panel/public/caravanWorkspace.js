async function initCaravanWorkspace(targetCaravanId = null) {
  const container = document.getElementById('dynamic-caravan-workspace-container');
  if (!container) return;

  // 1. Fetch live data
  const [caravansRes, usersRes] = await Promise.all([
    fetch('/api/v1/caravans').then(r => r.json()),
    fetch('/api/v1/admin/users').then(r => r.json())
  ]);
  const caravans = caravansRes.data || caravansRes || [];
  const users = usersRes.data || usersRes || [];

  if (caravans.length === 0) {
    container.innerHTML = '<div class="text-gray-400 p-4">هیچ کاروانی تعریف نشده است.</div>';
    return;
  }

  // Selected Caravan
  const activeCaravan = targetCaravanId 
    ? (caravans.find(c => String(c.id) === String(targetCaravanId) || c.title === targetCaravanId) || caravans[0])
    : caravans[0];

  // Filter members & mentor
  const members = users.filter(u => 
    u.role !== 'admin' && 
    u.role !== 'mentor' && 
    (String(u.caravanId) === String(activeCaravan.id) || u.caravan === activeCaravan.title)
  );
  const mentorUser = users.find(u => 
    (u.role === 'mentor' || u.role === 'راهبر') && 
    (String(u.caravanId) === String(activeCaravan.id) || u.caravan === activeCaravan.title)
  );
  const mentorName = mentorUser ? mentorUser.name : (activeCaravan.mentor || 'تعیین نشده');
  const totalZarik = members.reduce((sum, m) => sum + (Number(m.zarikBalance) || 0), 0);

  // 2. Render Full UI
  container.innerHTML = `
    <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl text-white">
      <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-6">
        <h3 class="text-xl font-bold flex items-center gap-2">
          <span class="w-2.5 h-6 bg-blue-500 rounded-full inline-block"></span>
          مدیریت و جزئیات کاروان
        </h3>
        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-400">انتخاب کاروان:</label>
          <select id="standalone-caravan-select" onchange="window.initCaravanWorkspace(this.value)" class="bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
            ${caravans.map(c => `
              <option value="${c.id}" ${String(c.id) === String(activeCaravan.id) ? 'selected' : ''}>${c.title || c.name}</option>
            `).join('')}
          </select>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="bg-slate-800/80 p-4 rounded-xl border border-slate-700/60 text-center">
          <div class="text-xs text-gray-400 mb-1">راهبر اختصاصی</div>
          <div class="text-lg font-bold text-cyan-400">${mentorName}</div>
        </div>
        <div class="bg-slate-800/80 p-4 rounded-xl border border-slate-700/60 text-center">
          <div class="text-xs text-gray-400 mb-1">مجموع ثروت (زریک)</div>
          <div class="text-lg font-bold text-yellow-400">${totalZarik} 🟡</div>
        </div>
        <div class="bg-slate-800/80 p-4 rounded-xl border border-slate-700/60 text-center">
          <div class="text-xs text-gray-400 mb-1">تعداد اعضای فعال</div>
          <div class="text-lg font-bold text-emerald-400">${members.length} نفر</div>
        </div>
      </div>

      <!-- Roster Table -->
      <div class="overflow-x-auto">
        <table class="w-full text-right text-sm">
          <thead class="bg-slate-800 text-gray-400 text-xs">
            <tr>
              <th class="p-3">شناسه</th>
              <th class="p-3">نام عضو</th>
              <th class="p-3">شماره تماس</th>
              <th class="p-3">موجودی زریک</th>
              <th class="p-3">عملیات</th>
            </tr>
          </thead>
          <tbody>
            ${members.length === 0 
              ? '<tr><td colspan="5" class="text-center py-6 text-gray-400">عضوی در این کاروان یافت نشد.</td></tr>' 
              : members.map(m => `
                <tr class="border-b border-slate-800 hover:bg-slate-800/40 transition">
                  <td class="p-3 font-mono text-xs text-gray-400">${m.customId || m.id}</td>
                  <td class="p-3 font-bold text-slate-100">${m.name}</td>
                  <td class="p-3 text-gray-300 font-mono">${m.phoneNumber || m.phone || '-'}</td>
                  <td class="p-3 text-yellow-400 font-semibold">${m.zarikBalance || 0} 🟡</td>
                  <td class="p-3 flex gap-2">
                    <button onclick="window.editMemberZarikPrompt('${m.id}', ${m.zarikBalance || 0})" class="px-3 py-1 bg-amber-600/80 hover:bg-amber-600 text-white rounded text-xs">تغییر زریک</button>
                    <button onclick="window.removeUserFromCaravanAction('${m.id}')" class="px-3 py-1 bg-red-600/80 hover:bg-red-600 text-white rounded text-xs">حذف از کاروان</button>
                  </td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

window.initCaravanWorkspace = initCaravanWorkspace;

window.editMemberZarikPrompt = async function(userId, currentZarik) {
  const newScore = prompt('موجودی جدید زریک را وارد کنید:', currentZarik);
  if (newScore === null || isNaN(Number(newScore))) return;
  await fetch('/api/v1/admin/users/' + userId, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
    body: JSON.stringify({ zarikBalance: Number(newScore) })
  });
  const currentSel = document.getElementById('standalone-caravan-select');
  window.initCaravanWorkspace(currentSel ? currentSel.value : null);
};

window.removeUserFromCaravanAction = async function(userId) {
  if (!confirm('آیا از حذف این عضو از کاروان اطمینان دارید؟')) return;
  await fetch('/api/v1/admin/users/' + userId, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
    body: JSON.stringify({ caravanId: null, caravan: null })
  });
  const currentSel = document.getElementById('standalone-caravan-select');
  window.initCaravanWorkspace(currentSel ? currentSel.value : null);
};

// Auto-mount on load
document.addEventListener('DOMContentLoaded', () => {
  window.initCaravanWorkspace();
});
