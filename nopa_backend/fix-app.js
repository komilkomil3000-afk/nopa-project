const fs = require('fs');
const path = './public/app.js';

let lines = fs.readFileSync(path, 'utf8').split('\n');
const cutoff = lines.findIndex(l => l.includes('window.closeChangeCaravanMentorModal = function() {')) + 3;

const head = lines.slice(0, cutoff).join('\n');

const newTail = `
window.caravanWorkspaceSelectedId = null;
let currentWorkspaceCaravanId = null;
let selectedCandidateIds = new Set();
let allMentorsCache = [];

// 1. Fix Top Table Mentor Name & Button Action
const _origRenderCaravansTable = window.renderCaravansTable;
window.renderCaravansTable = function() {
  const tbody = document.querySelector('#caravan-performance-table tbody');
  if (!tbody || !window.caravansData) return;
  
  const searchQuery = (document.getElementById('caravan-search-input')?.value || '').toLowerCase();
  const mentorFilter = document.getElementById('caravan-mentor-filter')?.value || 'all';
  
  const filtered = window.caravansData.filter(c => {
    const mName = c.mentor?.name || c.mentorName || '-';
    const matchSearch = c.name.toLowerCase().includes(searchQuery) || mName.toLowerCase().includes(searchQuery);
    const matchMentor = mentorFilter === 'all' || mName === mentorFilter;
    return matchSearch && matchMentor;
  });

  tbody.innerHTML = filtered.map(c => {
    const mentorDisplayName = c.mentor?.name || c.mentorName || 'فاقد راهبر';
    const count = c._count?.members ?? c.membersList?.length ?? c.memberCount ?? 0;
    const cap = c.capacityLimit ?? c.capacity ?? 50;
    const zarik = c.assets?.zarik ?? c.totalWealth ?? 0;
    const progress = c.overallProgress ?? 0;
    
    return \`
      <tr>
        <td><strong>\${c.name}</strong></td>
        <td><span class="badge badge-mentor">\${mentorDisplayName}</span></td>
        <td>\${count} / \${cap}</td>
        <td><span style="color:#fbbf24;"><i class="fa-solid fa-coins"></i> \${zarik.toLocaleString()}</span></td>
        <td>
          <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
            <span>\${progress}%</span>
          </div>
          <div class="progress-bar-container" style="margin:0; height:6px;">
            <div class="progress-bar-fill" style="width:\${progress}%"></div>
          </div>
        </td>
        <td>-</td>
        <td>
          <button class="page-btn btn-view" style="padding:4px 10px; font-size:12px; background:#2563eb; color:white; border-radius:6px; border:none; cursor:pointer;" onclick="window.selectCaravanWorkspace('\${c.id}')">
            <i class="fa-solid fa-eye"></i> مشاهده
          </button>
        </td>
      </tr>
    \`;
  }).join('');
};

window.selectCaravanWorkspace = function(caravanId) {
  const picker = document.getElementById('ws-caravan-picker');
  if (picker) picker.value = caravanId;
  window.onWorkspaceCaravanChanged(caravanId);
  document.getElementById('caravan-workspace-box')?.scrollIntoView({ behavior: 'smooth' });
};

window.onWorkspaceCaravanChanged = async function(caravanId) {
  window.caravanWorkspaceSelectedId = caravanId;
  currentWorkspaceCaravanId = caravanId;
  const tbody = document.getElementById('ws-roster-tbody');
  if (!tbody) return;

  if (!caravanId || caravanId === 'undefined' || caravanId === 'null') {
    document.getElementById('ws-mentor-name').textContent = '-';
    document.getElementById('ws-total-zarik').innerHTML = '۰ <span style="font-size:13px;">زریک</span>';
    document.getElementById('ws-stations-completed').textContent = '۰٪';
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:20px;">لطفاً یک کاروان را انتخاب نمایید</td></tr>';
    return;
  }

  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#38bdf8; padding:20px;">در حال بارگذاری اطلاعات اعضا...</td></tr>';

  try {
    const [caravansRes, usersRes] = await Promise.all([
      request('/api/v1/admin/caravans'),
      request('/api/v1/admin/users?page=1&limit=500')
    ]);
    const caravans = await caravansRes.json();
    const usersData = await usersRes.json();
    const allUsers = usersData.users || (Array.isArray(usersData) ? usersData : []);
    
    const currentCaravan = caravans.find(c => c.id === caravanId);
    const caravanMembers = allUsers.filter(u => u.role === 'student' && (u.caravanId === caravanId || (currentCaravan && u.caravanName === currentCaravan.name)));

    const mentorName = currentCaravan?.mentor?.name || currentCaravan?.mentorName || 'بدون راهبر';
    document.getElementById('ws-mentor-name').textContent = mentorName;
    
    const totalZarik = caravanMembers.reduce((sum, u) => sum + (u.zarikBalance || 0), 0);
    document.getElementById('ws-total-zarik').innerHTML = \`\${totalZarik.toLocaleString()} <span style="font-size:13px;">زریک</span>\`;
    document.getElementById('ws-stations-completed').textContent = \`\${currentCaravan?.overallProgress || 0}٪\`;

    if (caravanMembers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:20px;">هیچ عضوی در این کاروان ثبت نشده است</td></tr>';
      return;
    }

    tbody.innerHTML = caravanMembers.map(u => \`
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
        <td style="padding:10px; font-family:monospace; color:#38bdf8;">\${u.userCode ? 'NP-' + u.userCode : u.id}</td>
        <td style="padding:10px;"><strong>\${u.name}</strong></td>
        <td style="padding:10px; font-family:monospace;">\${u.phoneNumber}</td>
        <td style="padding:10px; color:#fbbf24;"><i class="fa-solid fa-coins"></i> \${(u.zarikBalance || 0).toLocaleString()}</td>
        <td style="padding:10px; text-align:center; white-space:nowrap;">
          <button class="page-btn" style="background:#3b82f6; color:white; padding:4px 8px; font-size:11px; margin-left:4px; border-radius:6px; border:none; cursor:pointer;" onclick="viewUserDetails('\${u.id}')">نمایش جزئیات</button>
          <button class="page-btn" style="background:#6366f1; color:white; padding:4px 8px; font-size:11px; margin-left:4px; border-radius:6px; border:none; cursor:pointer;" onclick="openUserModal('\${u.id}', '\${u.name}', '\${u.role}', '\${caravanId}', \${u.levelFrame || 1}, 1, '\${u.nationalId || ''}', '\${u.dateOfBirth || ''}')">ویرایش</button>
          <button class="page-btn" style="background:#f59e0b; color:white; padding:4px 8px; font-size:11px; margin-left:4px; border-radius:6px; border:none; cursor:pointer;" onclick="setAccountStatus('\${u.id}', 'SUSPENDED')">تعلیق موقت</button>
          <button class="page-btn" style="background:#ef4444; color:white; padding:4px 8px; font-size:11px; border-radius:6px; border:none; cursor:pointer;" onclick="window.removeMemberFromCurrentCaravan('\${u.id}')">حذف از کاروان</button>
        </td>
      </tr>
    \`).join('');
  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#ef4444; padding:20px;">خطا در دریافت اطلاعات</td></tr>';
  }
};

const _prevLoadCaravans = window.loadCaravansTab;
window.loadCaravansTab = async function() {
  if (typeof _prevLoadCaravans === 'function') await _prevLoadCaravans();
  try {
    const res = await request('/api/v1/admin/caravans');
    const caravans = await res.json();
    window.caravansData = caravans;
    const picker = document.getElementById('ws-caravan-picker');
    if (picker) {
      picker.innerHTML = '<option value="">-- لطفاً یک کاروان انتخاب کنید --</option>' +
        caravans.map(c => \`<option value="\${c.id}">\${c.name}</option>\`).join('');
    }
    window.renderCaravansTable();
  } catch (e) { console.error(e); }
};

// Modals Handlers
window.openAddMemberModal = function() {
  if (!currentWorkspaceCaravanId) return alert('لطفاً ابتدا یک کاروان را انتخاب کنید');
  selectedCandidateIds.clear();
  document.getElementById('ws-selected-candidates-count').textContent = '0';
  document.getElementById('ws-search-student-input').value = '';
  document.getElementById('ws-candidate-list').innerHTML = '<p style="text-align:center; color:#64748b; font-size:12px; margin:15px 0;">نام، شماره تلفن یا کد ملی دانش‌آموز را جستجو کنید...</p>';
  const modal = document.getElementById('ws-add-member-modal');
  if (modal) modal.style.display = 'flex';
};

window.closeAddMemberModal = function() {
  const modal = document.getElementById('ws-add-member-modal');
  if (modal) modal.style.display = 'none';
};

window.onSearchCandidates = async function(query) {
  if (query.length < 2) return;
  const container = document.getElementById('ws-candidate-list');
  container.innerHTML = '<p style="text-align:center; color:#38bdf8; font-size:12px;">در حال جستجو...</p>';
  try {
    const res = await request(\`/api/v1/admin/users?search=\${encodeURIComponent(query)}\`);
    const data = await res.json();
    const users = data.users || (Array.isArray(data) ? data : []);
    const students = users.filter(u => u.role === 'student');
    
    if (students.length === 0) {
      container.innerHTML = '<p style="text-align:center; color:#94a3b8; font-size:12px;">موردی یافت نشد</p>';
      return;
    }
    
    container.innerHTML = students.map(u => {
      const isSelected = selectedCandidateIds.has(u.id);
      return \`
        <div style="padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong style="color:white; font-size:13px;">\${u.name}</strong>
            <span style="color:#94a3b8; font-size:11px; margin-right:6px;">(\${u.phoneNumber})</span>
            \${u.caravanName ? \`<span style="color:#f59e0b; font-size:10px; background:rgba(245,158,11,0.1); padding:2px 4px; border-radius:4px;">در \${u.caravanName}</span>\` : ''}
          </div>
          <input type="checkbox" \${isSelected ? 'checked' : ''} onchange="window.toggleCandidateSelection('\${u.id}')" style="accent-color:#10b981; width:16px; height:16px; cursor:pointer;" />
        </div>
      \`;
    }).join('');
  } catch (e) {
    container.innerHTML = '<p style="text-align:center; color:#ef4444; font-size:12px;">خطا در جستجو</p>';
  }
};

window.toggleCandidateSelection = function(id) {
  if (selectedCandidateIds.has(id)) {
    selectedCandidateIds.delete(id);
  } else {
    selectedCandidateIds.add(id);
  }
  document.getElementById('ws-selected-candidates-count').textContent = selectedCandidateIds.size;
};

window.submitAddSelectedMembers = async function() {
  if (selectedCandidateIds.size === 0) return alert('هیچ کاربری انتخاب نشده است');
  if (!currentWorkspaceCaravanId) return alert('کاروان مشخص نیست');
  
  try {
    const res = await request(\`/api/v1/admin/caravans/\${currentWorkspaceCaravanId}/members/bulk-add\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds: Array.from(selectedCandidateIds) })
    });
    
    if (res.ok) {
      alert('اعضا با موفقیت افزوده شدند');
      window.closeAddMemberModal();
      window.onWorkspaceCaravanChanged(currentWorkspaceCaravanId);
      if(window.loadCaravansTab) window.loadCaravansTab();
    } else {
      const d = await res.json();
      alert(d.error || 'خطا در افزودن اعضا');
    }
  } catch (e) {
    alert('خطای ارتباط با سرور');
  }
};

window.removeMemberFromCurrentCaravan = async function(studentId) {
  if (!currentWorkspaceCaravanId) return;
  if (!confirm('آیا از حذف این کاربر از کاروان اطمینان دارید؟')) return;
  try {
    const res = await request(\`/api/v1/admin/caravans/\${currentWorkspaceCaravanId}/members/\${studentId}\`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) {
      alert('کاربر با موفقیت حذف شد');
      window.onWorkspaceCaravanChanged(currentWorkspaceCaravanId);
      if(window.loadCaravansTab) window.loadCaravansTab();
    } else {
      const d = await res.json();
      alert(d.error || 'خطا در حذف کاربر');
    }
  } catch (e) {
    alert('خطای ارتباط با سرور');
  }
};

window.openReassignMentorModal = async function() {
  if (!currentWorkspaceCaravanId) return alert('لطفاً ابتدا یک کاروان را انتخاب کنید');
  const container = document.getElementById('ws-mentor-candidates-list');
  container.innerHTML = '<p style="text-align:center; color:#94a3b8; font-size:12px;">در حال بارگذاری راهبرها...</p>';
  document.getElementById('ws-search-mentor-input').value = '';
  document.getElementById('ws-reassign-mentor-modal').style.display = 'flex';
  
  try {
    const res = await request('/api/v1/admin/mentors');
    allMentorsCache = await res.json();
    window.renderMentorCandidates(allMentorsCache);
  } catch (e) {
    container.innerHTML = '<p style="text-align:center; color:#ef4444; font-size:12px;">خطا در دریافت لیست راهبرها</p>';
  }
};

window.closeReassignMentorModal = function() {
  document.getElementById('ws-reassign-mentor-modal').style.display = 'none';
};

window.onSearchMentors = function(query) {
  const filtered = allMentorsCache.filter(m => 
    m.name.includes(query) || (m.phoneNumber && m.phoneNumber.includes(query))
  );
  window.renderMentorCandidates(filtered);
};

window.renderMentorCandidates = function(mentors) {
  const container = document.getElementById('ws-mentor-candidates-list');
  if (mentors.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#94a3b8; font-size:12px;">راهبری یافت نشد</p>';
    return;
  }
  container.innerHTML = \`
    <div style="padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
      <span style="color: #ef4444; font-size: 13px;">-- بدون راهبر (حذف انتساب) --</span>
      <button type="button" onclick="window.confirmReassignMentor(null)" class="btn-action" style="background:#ef4444; color:white; padding:4px 10px; font-size:11px; border-radius:6px; border:none; cursor:pointer;">انتخاب</button>
    </div>
  \` + mentors.map(m => \`
    <div style="padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
      <div>
        <strong style="color:white; font-size:13px;">\${m.name}</strong>
        <span style="color:#94a3b8; font-size:11px; margin-right:6px;">(\${m.phoneNumber})</span>
      </div>
      <button type="button" onclick="window.confirmReassignMentor('\${m.id}')" class="btn-action" style="background:#38bdf8; color:black; font-weight:bold; padding:4px 10px; font-size:11px; border-radius:6px; border:none; cursor:pointer;">انتخاب</button>
    </div>
  \`).join('');
};

window.confirmReassignMentor = async function(mentorId) {
  if (!currentWorkspaceCaravanId) return;
  try {
    const res = await request(\`/api/v1/admin/caravans/\${currentWorkspaceCaravanId}\`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mentorId })
    });
    if (res.ok) {
      alert('راهبر کاروان با موفقیت تغییر کرد');
      window.closeReassignMentorModal();
      window.onWorkspaceCaravanChanged(currentWorkspaceCaravanId);
      if(window.loadCaravansTab) window.loadCaravansTab();
    } else {
      const d = await res.json();
      alert(d.error || 'خطا در ثبت راهبر');
    }
  } catch (e) {
    alert('خطای ارتباط با سرور');
  }
};
\`;

fs.writeFileSync(path, head + '\\n' + newTail);
