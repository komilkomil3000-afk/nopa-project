const fs = require('fs');

const path = 'public/app.js';
const lines = fs.readFileSync(path, 'utf8').split('\n');

const startLine = 4800 - 1;
const endLine = 4849 - 1;

const head = lines.slice(0, startLine);
const tail = lines.slice(endLine + 1);

const newBlock = `window.onWorkspaceCaravanChanged = async function(caravanId) {
  window.caravanWorkspaceSelectedId = caravanId;
  currentWorkspaceCaravanId = caravanId;
  const tbody = document.getElementById('ws-roster-tbody');
  if (!caravanId) {
    document.getElementById('ws-mentor-name').textContent = '--';
    document.getElementById('ws-total-zarik').innerHTML = '<i class="fa-solid fa-coins"></i> <span>0</span>';
    document.getElementById('ws-stations-completed').textContent = '0';
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b; padding:24px;">لطفاً یک کاروان را انتخاب نمایید</td></tr>';
    return;
  }

  try {
    const [caravansRes, usersRes] = await Promise.all([
      request('/api/v1/admin/caravans'),
      request('/api/v1/admin/users?page=1&limit=500')
    ]);
    const caravans = await caravansRes.json();
    const usersData = await usersRes.json();
    const allUsers = usersData.users || (Array.isArray(usersData) ? usersData : []);

    const selectedCaravan = caravans.find(c => c.id === caravanId);
    const caravanMembers = allUsers.filter(u => u.caravanId === caravanId || (selectedCaravan && u.caravanName === selectedCaravan.name));

    // Update Cards
    document.getElementById('ws-mentor-name').textContent = selectedCaravan?.mentor?.name || selectedCaravan?.mentorName || 'فاقد راهبر';
    const totalZarik = caravanMembers.reduce((sum, u) => sum + (u.zarikBalance || 0), 0);
    document.getElementById('ws-total-zarik').innerHTML = \`<i class="fa-solid fa-coins"></i> <span>\${totalZarik.toLocaleString()}</span>\`;
    document.getElementById('ws-stations-completed').textContent = \`\${selectedCaravan?.overallProgress || 0}\`;

    if (caravanMembers.length === 0) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b; padding:24px;">عضوی در این کاروان یافت نشد</td></tr>';
      return;
    }

    // Render Roster Rows with 4 exact colored action buttons
    if (tbody) {
      tbody.innerHTML = caravanMembers.map(u => \`
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
          <td style="padding: 10px 12px; text-align: right; font-family: monospace; color: #94a3b8;">\${u.userCode ? 'NP-' + u.userCode : (u.id ? '...' + u.id.slice(-6) : '-')}</td>
          <td style="padding: 10px 12px; text-align: right; font-weight: bold; color: white;">\${u.name}</td>
          <td style="padding: 10px 12px; font-family: monospace; color: #cbd5e1;">\${u.phoneNumber}</td>
          <td style="padding: 10px 12px; color: #cbd5e1;">\${(u.zarikBalance || 0).toLocaleString()}</td>
          <td style="padding: 10px 12px; text-align: center; white-space: nowrap;">
            <button type="button" class="page-btn" style="background:#2563eb; color:white; padding:4px 10px; font-size:11px; margin-left:3px; border-radius:6px; border:none; cursor:pointer;" onclick="viewUserDetails('\${u.id}')">نمایش جزئیات</button>
            <button type="button" class="page-btn" style="background:#6366f1; color:white; padding:4px 10px; font-size:11px; margin-left:3px; border-radius:6px; border:none; cursor:pointer;" onclick="openUserModal('\${u.id}', '\${u.name}', '\${u.role}', '\${caravanId}', \${u.levelFrame || 1}, 1, '\${u.nationalId || ''}', '\${u.dateOfBirth || ''}')">ویرایش</button>
            <button type="button" class="page-btn" style="background:#f59e0b; color:white; padding:4px 10px; font-size:11px; margin-left:3px; border-radius:6px; border:none; cursor:pointer;" onclick="setAccountStatus('\${u.id}', 'SUSPENDED')">تعلیق موقت</button>
            <button type="button" class="page-btn" style="background:#ef4444; color:white; padding:4px 10px; font-size:11px; border-radius:6px; border:none; cursor:pointer;" onclick="window.removeMemberFromCurrentCaravan('\${u.id}')">حذف از کاروان</button>
          </td>
        </tr>
      \`).join('');
    }
  } catch (err) {
    console.error('Error hydrating workspace', err);
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#ef4444; padding:24px;">خطا در دریافت اطلاعات کاروان</td></tr>';
  }
};`;

const newContent = [...head, newBlock, ...tail].join('\n');
fs.writeFileSync(path, newContent, 'utf8');
console.log('app.js workspace function replaced based on lines.');
