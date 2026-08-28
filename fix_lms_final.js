const fs = require('fs');

let content = fs.readFileSync('nopa_backend/public/app.js', 'utf-8');

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
    content = content.replace(oldLoadLms, newLoadLms);
    fs.writeFileSync('nopa_backend/public/app.js', content, 'utf-8');
    console.log("Successfully replaced loadLmsData.");
} else {
    console.log("Could not find oldLoadLms");
}
