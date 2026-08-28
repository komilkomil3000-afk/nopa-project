const fs = require('fs');

let content = fs.readFileSync('public/app.js', 'utf-8');

// 1. Fix the broken viewCaravanDetails
const brokenCaravanRegex = /switchCaravanDrawerTab\('cd-roster'\); \/\/ Default tab\s+try \{\s+const res = await request\(\`\/api\/v1\/admin\/caravans\/\$\{caravanId\}\`\);\s+document\.getElementById\('cd-broadcast-title'\)\.value = '';/;

if (brokenCaravanRegex.test(content)) {
    console.log("Found broken viewCaravanDetails. Fixing...");
    const correctCaravanCode = `switchCaravanDrawerTab('cd-roster'); // Default tab
  try {
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
      document.getElementById('cd-broadcast-title').value = '';`;
    
    content = content.replace(brokenCaravanRegex, correctCaravanCode);
} else {
    console.log("Broken caravan code not found.");
}

// 2. Fix loadLmsData
const oldLoadLms = `async function loadLmsData() {
  try {
    const res = await request('/api/v1/admin/lms/stations');
    const stations = await res.json();
    window.lmsStations = stations;
    
    const tbody = document.querySelector('#stations-table tbody');
    if(tbody) {
      tbody.innerHTML = '';
      stations.forEach(s => {
        const releaseStr = s.releaseDate ? \`\${new Date(s.releaseDate).toLocaleDateString('fa-IR')} \${s.releaseTime || ''}\` : 'فوری/آزاد';
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td><strong>\${s.orderIndex}</strong></td>
          <td>\${s.title}</td>
          <td>\${releaseStr}</td>
          <td>\${s.categories ? s.categories.length : 0} دسته</td>
          <td>
            <button class="page-btn btn-edit" style="background:#8b5cf6; color:white;" onclick="editLmsStation('\${s.id}')"><i class="fa-solid fa-edit"></i> ویرایش</button>
            <button class="page-btn btn-danger" onclick="deleteLmsStation('\${s.id}')"><i class="fa-solid fa-trash"></i> حذف</button>
          </td>
        \`;
        tbody.appendChild(tr);
      });
    }
  } catch(e) { console.error(e); }
}`;

const newLoadLms = `async function loadLmsData() {
  try {
    let response;
    try {
      response = await request('/api/v1/admin/lms/stations');
    } catch(e) {
      response = await request('/api/v1/stations');
    }
    const data = await response.json();
    const stations = data.stations || (Array.isArray(data) ? data : []);
    window.lmsStations = stations;
    
    const tbody = document.querySelector('#stations-table tbody');
    if(tbody) {
      tbody.innerHTML = '';
      stations.forEach(s => {
        const releaseStr = s.releaseDate ? \`\${new Date(s.releaseDate).toLocaleDateString('fa-IR')} \${s.releaseTime || ''}\` : 'پیش‌فرض';
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td><strong>\${s.orderIndex || 0}</strong></td>
          <td>\${s.title || s.name || 'بدون نام'}</td>
          <td>\${releaseStr}</td>
          <td>\${s.description || 'بدون توضیحات'}</td>
          <td>
            <button class="page-btn btn-edit" style="background:#8b5cf6; color:white;" onclick="editLmsStation('\${s.id}')"><i class="fa-solid fa-edit"></i> ویرایش</button>
            <button class="page-btn btn-danger" onclick="deleteLmsStation('\${s.id}')"><i class="fa-solid fa-trash"></i> حذف</button>
          </td>
        \`;
        tbody.appendChild(tr);
      });
    }
  } catch(e) { console.error(e); }
}`;

if (content.includes(oldLoadLms)) {
    console.log("Replacing loadLmsData...");
    content = content.replace(oldLoadLms, newLoadLms);
} else {
    console.log("Could not find exact oldLoadLms string, maybe it was already modified?");
}

fs.writeFileSync('public/app.js', content, 'utf-8');
console.log("Done");
