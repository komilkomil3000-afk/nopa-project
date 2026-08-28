const fs = require('fs');

let content = fs.readFileSync('nopa_backend/public/app.js', 'utf-8');

const oldLoadLms = `async function loadLmsData() {
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

const newLoadLms = `async function loadLmsData() {
  try {
    let response;
    try {
      response = await request('/api/v1/admin/lms/stations');
    } catch(e) {
      response = await request('/api/v1/stations');
    }
    const data = await response.json();
    const stations = data.stations || data.data || (Array.isArray(data) ? data : []);
    window.lmsStations = stations;
    
    const tbody = document.querySelector('#stations-table tbody');
    if(tbody) {
      tbody.innerHTML = stations.map(s => \`
  <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; color: #e2e8f0;">
    <td style="padding: 12px;">\${s.orderIndex ?? s.order ?? 1}</td>
    <td style="padding: 12px; font-weight: bold;">\${s.title || s.name || 'منزلگاه'}</td>
    <td style="padding: 12px; color: #94a3b8;">\${s.releaseDate ? s.releaseDate.split('T')[0] : 'آزاد'}</td>
    <td style="padding: 12px; color: #94a3b8;">\${s.description || '-'}</td>
    <td style="padding: 12px; text-align: center;">
      <button onclick="editLmsStation('\${s.id}')" style="background:#2563eb; color:white; border:none; padding:4px 10px; border-radius:6px; cursor:pointer;">ویرایش</button>
      <button onclick="deleteLmsStation('\${s.id}')" style="background:#ef4444; color:white; border:none; padding:4px 10px; border-radius:6px; cursor:pointer; margin-right:4px;">حذف</button>
    </td>
  </tr>
\`).join('');
    }
  } catch(e) { console.error(e); }
}`;

if (content.includes(oldLoadLms)) {
    content = content.replace(oldLoadLms, newLoadLms);
    console.log("Successfully replaced loadLmsData.");
} else {
    console.log("Could not find oldLoadLms");
}

const tabTarget = `} else if (tabId === 'lms-tab') {\n    loadLmsData();`;
if (content.includes(tabTarget)) {
    content = content.replace(tabTarget, `} else if (tabId === 'lms-tab' || tabId === 'stations-tab') {\n    loadLmsData();`);
    console.log("Successfully replaced tabTarget.");
} else {
    console.log("Could not find tabTarget");
}

fs.writeFileSync('nopa_backend/public/app.js', content, 'utf-8');
