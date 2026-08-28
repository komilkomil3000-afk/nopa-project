const fs = require('fs');

let content = fs.readFileSync('public/app.js', 'utf-8');

const targetString = `  try {\n    const res = await request(\`/api/v1/admin/caravans/\${caravanId}\`);\n\nasync function loadCaravanMembersRoster() {`;

const replacementString = `  try {
    const res = await request(\`/api/v1/admin/caravans/\${caravanId}\`);
    const data = await res.json();
    
    document.getElementById('cd-title').textContent = \`داشبورد کاروان: \${data.name}\`;
    document.getElementById('cd-mentor-name').innerHTML = \`<i class="fa-solid fa-user-tie"></i> مربی: \${data.mentor?.name || data.mentors?.[0]?.name || 'بدون راهبر'}\`;
    document.getElementById('cd-capacity-text').innerHTML = \`<i class="fa-solid fa-users"></i> ظرفیت: \${data.membersList?.length || 0} / \${data.capacityLimit} نفر\`;
    document.getElementById('cd-status-text').innerHTML = \`<i class="fa-solid fa-circle-info"></i> وضعیت: \${data.status === 'active' ? 'فعال' : 'غیرفعال'}\`;
    
    document.getElementById('cd-wealth-zarik').textContent = data.wealth?.zarik || 0;
    document.getElementById('cd-wealth-nakh').textContent = data.wealth?.nakh || 0;
    document.getElementById('cd-wealth-farsh').textContent = data.wealth?.farsh || 0;
    document.getElementById('cd-wealth-beyragh').textContent = data.wealth?.beyragh || 0;
    
    document.getElementById('cd-progress-bar').style.width = \`\${data.overallProgress || 0}%\`;
    document.getElementById('cd-progress-text').textContent = \`\${data.overallProgress || 0}%\`;
    
    // Populate Roster
    const tbody = document.querySelector('#cd-roster-table tbody');
    tbody.innerHTML = '';
    if (data.membersList && data.membersList.length > 0) {
      data.membersList.forEach(u => {
        const tr = document.createElement('tr');
        const roleLabel = u.role === 'student' ? 'مخاطب' : 'راهبر';
        tr.innerHTML = \`
          <td><strong>\${u.name}</strong></td>
          <td style="font-family: monospace; color: var(--text-secondary);">NP-\${u.userCode || u.phoneNumber}</td>
          <td style="font-family: monospace;">\${u.phoneNumber}</td>
          <td><span class="badge" style="background: rgba(255,255,255,0.1);">\${roleLabel}</span></td>
          <td>سطح \${u.levelFrame || 1}</td>
          <td style="color: #fbbf24;"><i class="fa-solid fa-coins"></i> \${u.zarikBalance || 0}</td>
          <td>
            <button class="page-btn" onclick="openCaravanStudentDetails('\${u.id}')" title="نمایش جزئیات" style="color: var(--color-neon-blue);"><i class="fa-solid fa-eye"></i></button>
            <button class="page-btn" onclick="removeFromCaravan('\${caravanId}', '\${u.id}')" title="حذف از کاروان"><i class="fa-solid fa-user-minus" style="color: var(--color-danger);"></i></button>
          </td>
        \`;
        tbody.appendChild(tr);
      });
    } else {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">عضوی در این کاروان یافت نشد.</td></tr>';
    }
  } catch (err) { console.error(err); }
};
function closeCaravanDrawer() { document.getElementById('caravan-drawer-modal').style.display = 'none'; }

async function sendCaravanBroadcast() {
  const title = document.getElementById('cd-broadcast-title').value;
  const message = document.getElementById('cd-broadcast-msg').value;
  if(!message) return alert('متن پیام الزامی است');
  try {
    const res = await request(\`/api/v1/admin/caravans/\${currentDrawerCaravanId}/broadcast\`, {
      method: 'POST',
      body: JSON.stringify({ title, message })
    });
    if (res.ok) {
      alert('پیام گروهی با موفقیت ارسال شد');
      document.getElementById('cd-broadcast-title').value = '';
      document.getElementById('cd-broadcast-msg').value = '';
    }
  } catch(e) { console.error(e); }
}

async function loadCaravanMembersRoster() {`;

content = content.replace(targetString, replacementString);
fs.writeFileSync('public/app.js', content, 'utf-8');
console.log("Successfully restored caravan code.");
