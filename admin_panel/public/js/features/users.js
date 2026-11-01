// Users: directory + filters, user drawer (360 view, class progress), user modal, levels, students.
// Split out of the former app.js (Phase 7). Classic script: shares globals with the other modules;
// load order is set in index.html.

// 8. Toggle Dark/Light Mode
async function loadLevelsAndCertificatesTab() {
  try {
    const res = await request('/api/v1/admin/levels-and-certificates');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const tbody = document.querySelector('#levels-data-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    data.data.forEach(user => {
      const levelNames = { 1: 'تازه وارد', 2: 'نقره‌ای', 3: 'طلایی' };
      const levelBadge = `<span class="badge" style="background:var(--primary); color:white; font-size:10px;">${levelNames[user.levelFrame] || 'نامشخص'}</span>`;
      
      const lastCert = user.certificates && user.certificates.length > 0 ? user.certificates[0].title : 'بدون گواهینامه';
      
      let physicalReqs = 'ندارد';
      if (user.physicalOrders && user.physicalOrders.length > 0) {
        physicalReqs = user.physicalOrders.map(o => `<span class="badge" style="background:${o.status === 'PENDING_PRINT' ? 'var(--accent)' : 'var(--success)'}; color:black;">${o.status === 'PENDING_PRINT' ? 'در انتظار چاپ' : 'ارسال شده'}</span>`).join(' ');
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${esc(user.name || 'کاربر بدون نام')}</strong></td>
        <td style="font-family: monospace;">${esc(user.phoneNumber)}</td>
        <td>${levelBadge}</td>
        <td>${esc(lastCert)}</td>
        <td>${user.registrationCompleted ? '<span style="color:var(--color-success)">تکمیل شده</span>' : '<span style="color:var(--color-danger)">ناقص</span>'}</td>
        <td>${physicalReqs}</td>
        <td>
          <button class="page-btn btn-edit" style="padding: 4px 8px; font-size:11px;" data-click="promptLevelOverride" data-click-args="${esc(JSON.stringify([String(user.id), (user.levelFrame)]))}" title="تغییر سطح دستی"><i class="fa-solid fa-edit"></i></button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load levels and certificates:', err);
  }
}

window.promptLevelOverride = async function(userId, currentLevel) {
  const newLevel = prompt('سطح جدید را وارد کنید (1=برنزی، 2=نقره‌ای، 3=طلایی):', currentLevel);
  if (!newLevel) return;
  try {
    const res = await request('/api/v1/admin/students/' + userId + '/level-frame', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ levelFrame: parseInt(newLevel) })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('سطح با موفقیت تغییر یافت', 'success');
      loadLevelsAndCertificatesTab();
    } else {
      showToast(data.error || 'خطا در تغییر سطح', 'error');
    }
  } catch (err) {
    showToast('خطای شبکه', 'error');
  }
};

// Load Caravans
// Load users (paginated)
async function loadUsers() {
  const usersTbody = document.querySelector('#users-data-table tbody');
  NopaTable.loading(usersTbody);
  try {
    const url = `/api/v1/admin/users?page=${usersPage}&limit=20&search=${encodeURIComponent(userSearchVal)}&role=${filterRoleVal}&caravanId=${filterCaravanVal}&levelFrame=${filterLevelVal}&startDate=${encodeURIComponent(filterStartDateVal)}&endDate=${encodeURIComponent(filterEndDateVal)}`;
    const res = await request(url);
    const data = await res.json();

    usersTotal = data.total || 0;
    const totalUsersEl = document.getElementById('stats-total-users');
    if (totalUsersEl) totalUsersEl.textContent = `${data.total || 0}`;
    
    // Update stats counts
    const mentorsCount = (data.users || []).filter(u => u.role === 'mentor').length;
    const mentorsEl = document.getElementById('stats-total-mentors');
    if (mentorsEl) mentorsEl.textContent = `${mentorsCount}`;

    const totalZarik = (data.users || []).reduce((acc, u) => acc + (u.zarikBalance || 0), 0);
    const zarikEl = document.getElementById('stats-total-zarik');
    if (zarikEl) zarikEl.textContent = totalZarik.toLocaleString('fa-IR');

    // Update pagination footer
    const totalPages = Math.ceil((data.total || 0) / 20) || 1;
    const pageInfoEl = document.getElementById('users-page-info');
    if (pageInfoEl) pageInfoEl.textContent = `صفحه ${usersPage} از ${totalPages} (کل ${data.total || 0} کاربر)`;
    
    const prevBtn = document.getElementById('btn-prev-users');
    if (prevBtn) prevBtn.disabled = usersPage <= 1;
    const nextBtn = document.getElementById('btn-next-users');
    if (nextBtn) nextBtn.disabled = usersPage >= totalPages;

    const tbody = document.querySelector('#users-data-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!Array.isArray(data.users) || data.users.length === 0) {
      NopaTable.empty(tbody, 'هیچ کاربری با این فیلترها یافت نشد', 'fa-solid fa-user-slash');
      return;
    }

    data.users.forEach(u => {
      let roleBadge = `<span class="badge badge-${u.role}">${roleLabel(u.role)}</span>`;
      if (u.role === 'mentor' && u.mentorLevel) {
        const levelName = u.mentorLevel === 3 ? 'راهنمای کل' : u.mentorLevel === 2 ? 'استاد' : 'یاور';
        roleBadge += ` <span class="badge" style="background:var(--primary); color:white; font-size:10px;">${levelName}</span>`;
      }
      
      const blockBadge = u.blocked ? `<span class="badge badge-blocked">مسدود شده</span>` : '';
      const regDate = u.createdAt ? new Date(u.createdAt).toLocaleDateString('fa-IR') : '-';
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${u.userCode || '-'}</td>
        <td><strong>${esc(u.name)}</strong> ${u.gender === 'male' ? '<span class="badge" style="background:var(--info-strong); color:white; font-size:10px;">مرد</span>' : u.gender === 'female' ? '<span class="badge" style="background:#db2777; color:white; font-size:10px;">زن</span>' : ''} ${blockBadge}</td>
        <td style="font-family: monospace;">${esc(u.phoneNumber)}</td>
        <td>${roleBadge}</td>
        <td>${esc(u.caravanName || '-')}</td>
        <td><strong style="color: var(--color-neon-blue);">${(u.zarikBalance || 0).toLocaleString()}</strong></td>
        <td style="font-size: 12px; color: var(--text-secondary); white-space: nowrap;">${regDate}</td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="progress-bar-container" style="flex: 1; margin:0; width:60px;">
              <div class="progress-bar-fill" style="width: ${u.completionRate}%"></div>
            </div>
            <span style="font-size:11px;">${u.completionRate}%</span>
          </div>
        </td>
        <td>
          <button class="page-btn btn-view" style="padding: 4px 8px; font-size:11px;" data-click="viewUserDetails" data-click-args="${esc(JSON.stringify([String(u.id)]))}"><i class="fa-solid fa-eye"></i></button>
          <button class="page-btn btn-edit" style="padding: 4px 8px; font-size:11px;" data-click="openUserModal" data-click-args="${esc(JSON.stringify([String(u.id), String(u.name), String(u.role), String(u.caravanId || ''), (u.levelFrame), (u.mentorLevel || 1), String(u.nationalId || ''), String(u.dateOfBirth || '')]))}"><i class="fa-solid fa-edit"></i></button>
          <button class="page-btn btn-block" style="padding: 4px 8px; font-size:11px; color: ${u.blocked ? 'var(--color-success)' : 'var(--color-warning)'}" data-click="toggleBlockUser" data-click-args="${esc(JSON.stringify([String(u.id), (!u.blocked)]))}"><i class="fa-solid ${u.blocked ? 'fa-unlock' : 'fa-ban'}"></i></button>
          <button class="page-btn btn-delete" style="padding: 4px 8px; font-size:11px; color: var(--color-danger);" data-click="deleteUser" data-click-args="${esc(JSON.stringify([String(u.id)]))}"><i class="fa-solid fa-trash"></i></button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load users:', err);
    if (err.message !== 'Unauthorized') NopaTable.error(usersTbody, 'خطا در دریافت فهرست کاربران');
  }
}

// Detailed Profile view in Drawer
async function viewUserDetails(userId) {
  try {
    const res = await request(`/api/v1/admin/users/${userId}/analytics`);
    const payload = await res.json();
    if (!res.ok) return showToast('خطا در دریافت اطلاعات', 'error');

    const user = payload.user;

    const drawerHeader = document.querySelector('#user-detail-drawer .drawer-header');
    drawerHeader.innerHTML = `
      <h3 id="drawer-user-name">${esc(user.name)}</h3>
      <div style="flex:1;"></div>
      ${(user.isDualRole || user.role === 'mentor') ? `
        <button id="btn-role-switcher" class="btn-action" style="background-color:var(--success); color:white; margin-left:15px;" data-click="toggleDualRoleView">
          <i class="fa-solid fa-exchange-alt"></i> تغییر نمای کاربر (راهبر / دانش‌آموز)
        </button>
      ` : ''}
      <button class="modal-close" id="btn-close-drawer" data-click="closeUserDetailDrawer">&times;</button>
    `;

    // Calculate age
    let ageGroup = 'نامشخص';
    if (user.dateOfBirth) {
      const birthYear = parseInt(user.dateOfBirth.split('/')[0] || '1380');
      const currentYear = 1405; // Approx current Shamsi year for simulation
      const age = currentYear - birthYear;
      if (age < 12) ageGroup = 'کودک';
      else if (age < 18) ageGroup = 'نوجوان';
      else if (age < 24) ageGroup = 'جوان';
      else ageGroup = 'بزرگسال';
    }

    const regDate = new Date(user.createdAt).toLocaleDateString('fa-IR');

    const body = document.getElementById('drawer-body-info');
    body.innerHTML = `
      <div id="student-view-container">
        <div style="display:flex; gap:18px; align-items:flex-start; flex-wrap: wrap;">
          <div class="glass" style="flex: 0 0 200px; text-align:center; padding: 20px; border-radius: 12px;">
            <div class="user-avatar" style="width:100px; height:100px; font-size:32px; margin: 0 auto 10px auto;">${esc(user.name.substring(0,2))}</div>
            <div style="margin-top:8px;"><span class="badge badge-${user.role}">${roleLabel(user.role)}</span></div>
            <div style="margin-top:10px; font-size:13px; color:var(--text-secondary);">${esc(user.phoneNumber)}</div>
            <div style="margin-top:5px; font-size:12px; color:var(--text-muted);">شناسه اختصاصی: ${user.userCode || 'فاقد شناسه'}</div>
            <hr style="border-color: rgb(var(--fg-rgb) / 0.1); margin: 15px 0;" />
            <div style="text-align: right; font-size: 13px;">
              <p><strong>زریک:</strong> <span style="color:var(--color-neon-blue);">${payload.balances.zarik.toLocaleString()}</span></p>
              <p><strong>کلاف:</strong> ${payload.balances.nakh}</p>
              <p><strong>درفش:</strong> ${payload.balances.beyragh}</p>
              <p><strong>قالیچه:</strong> ${payload.balances.farsh}</p>
            </div>
            <div style="margin-top:15px; display:flex; gap:5px; flex-wrap:wrap; justify-content:space-between;">
              <button class="btn-primary" style="flex:1; font-size:11px;" data-click="openPasswordOverride" data-click-args="${esc(JSON.stringify([String(user.id)]))}">تغییر رمز</button>
              <button class="btn-action" style="flex:1; background:var(--danger); color:white; font-size:11px; padding:6px;" data-click="setAccountStatus" data-click-args="${esc(JSON.stringify([String(user.id), "SUSPENDED"]))}">تعلیق</button>
            </div>
          </div>

          <div style="flex:1; min-width: 300px;">
            <div class="tabs-header" style="display:flex; gap:10px; margin-bottom:15px; border-bottom:1px solid rgb(var(--fg-rgb) / 0.1); padding-bottom:10px;">
              <button class="btn-action active" data-click="switchDrawerTab" data-click-args="[&quot;tab-identity&quot;]" id="btn-tab-identity"><i class="fa-solid fa-id-card"></i> هویت و پروفایل</button>
              <button class="btn-action" data-click="switchDrawerTab" data-click-args="[&quot;tab-class-progress&quot;]" id="btn-tab-class-progress"><i class="fa-solid fa-graduation-cap"></i> کلاس‌ها و آزمون</button>
              <button class="btn-action" data-click="switchDrawerTab" data-click-args="[&quot;tab-support&quot;]" id="btn-tab-support"><i class="fa-solid fa-headset"></i> پشتیبانی و کاروان</button>
            </div>
            
            <div id="tab-identity" class="drawer-tab-content active" style="display:block;">
              <div class="panel-card glass" style="margin-bottom:12px; padding:20px;">
                <h4 style="margin-bottom:15px; color:var(--color-neon-blue);">اطلاعات هویتی کامل</h4>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                  <p><strong>نام کامل:</strong> ${esc(user.name)}</p>
                  <p><strong>کد ملی:</strong> ${esc(user.nationalId || 'ثبت نشده')}</p>
                  <p><strong>شماره تماس:</strong> ${esc(user.phoneNumber)}</p>
                  <p><strong>تاریخ تولد:</strong> ${esc(user.dateOfBirth || 'ثبت نشده')}</p>
                  <p><strong>جنسیت:</strong> ${user.gender === 'male' ? 'مرد' : user.gender === 'female' ? 'زن' : 'ثبت نشده'}</p>
                  <p><strong>شهر/استان:</strong> ${esc(user.city || 'ثبت نشده')}</p>
                  <p><strong>رده سنی:</strong> ${ageGroup}</p>
                  <p><strong>سطح فریم:</strong> ${user.levelFrame}</p>
                  <p><strong>تاریخ عضویت:</strong> ${regDate}</p>
                </div>
              </div>
            </div>

            <div id="tab-class-progress" class="drawer-tab-content" style="display:none;">
              <div class="panel-card glass" style="padding:14px;">
                <!-- 5 Stats Summary Cards Bar -->
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(115px, 1fr)); gap:8px; margin-bottom:14px;">
                  <div style="background: rgb(var(--primary-rgb) / 0.12); border: 1px solid rgb(var(--primary-rgb) / 0.3); border-radius: 10px; padding: 10px; text-align: center;">
                    <div style="font-size: 11px; color: var(--primary-text); font-weight: bold;"><i class="fa-solid fa-map-location-dot"></i> منزلگاه‌ها</div>
                    <div id="drawer-stat-stations" style="font-size: 15px; font-weight: 800; color: var(--text); margin-top: 4px;">۰ از ۵</div>
                  </div>
                  <div style="background: rgb(var(--primary-rgb) / 0.12); border: 1px solid rgb(var(--primary-rgb) / 0.3); border-radius: 10px; padding: 10px; text-align: center;">
                    <div style="font-size: 11px; color: var(--primary-text); font-weight: bold;"><i class="fa-solid fa-chalkboard-user"></i> کلاس‌ها</div>
                    <div id="drawer-stat-classes" style="font-size: 15px; font-weight: 800; color: var(--text); margin-top: 4px;">۰ از ۰</div>
                  </div>
                  <div style="background: rgb(var(--success-rgb) / 0.12); border: 1px solid rgb(var(--success-rgb) / 0.3); border-radius: 10px; padding: 10px; text-align: center;">
                    <div style="font-size: 11px; color: var(--success-text); font-weight: bold;"><i class="fa-solid fa-circle-play"></i> پارت‌ها</div>
                    <div id="drawer-stat-parts" style="font-size: 15px; font-weight: 800; color: var(--text); margin-top: 4px;">۰ از ۰</div>
                  </div>
                  <div style="background: rgb(var(--accent-rgb) / 0.12); border: 1px solid rgb(var(--accent-rgb) / 0.3); border-radius: 10px; padding: 10px; text-align: center;">
                    <div style="font-size: 11px; color: var(--accent-text); font-weight: bold;"><i class="fa-solid fa-spell-check"></i> آزمون‌ها</div>
                    <div id="drawer-stat-quizzes" style="font-size: 15px; font-weight: 800; color: var(--text); margin-top: 4px;">۰ از ۰</div>
                  </div>
                  <div style="background: rgba(236, 72, 153, 0.12); border: 1px solid rgba(236, 72, 153, 0.3); border-radius: 10px; padding: 10px; text-align: center;">
                    <div style="font-size: 11px; color: #f472b6; font-weight: bold;"><i class="fa-solid fa-trophy"></i> چالش‌ها</div>
                    <div id="drawer-stat-challenges" style="font-size: 15px; font-weight: 800; color: var(--text); margin-top: 4px;">۰ از ۰</div>
                  </div>
                </div>

                <!-- Filter Chips & Search Bar -->
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px; background:rgb(var(--shade-rgb) / 0.25); padding:8px 10px; border-radius:8px; border:1px solid rgb(var(--fg-rgb) / 0.06);">
                  <div style="display:flex; gap:6px; flex-wrap:wrap;" id="drawer-class-filter-chips">
                    <button type="button" class="btn-action active" data-click="filterDrawerClassProgress" data-click-args="[&quot;all&quot;]" id="btn-prog-filter-all" style="padding:4px 8px; font-size:11px; border-radius:6px;">همه موارد</button>
                    <button type="button" class="btn-action" data-click="filterDrawerClassProgress" data-click-args="[&quot;classes&quot;]" id="btn-prog-filter-classes" style="padding:4px 8px; font-size:11px; border-radius:6px;">کلاس‌ها</button>
                    <button type="button" class="btn-action" data-click="filterDrawerClassProgress" data-click-args="[&quot;parts&quot;]" id="btn-prog-filter-parts" style="padding:4px 8px; font-size:11px; border-radius:6px;">پارت‌ها</button>
                    <button type="button" class="btn-action" data-click="filterDrawerClassProgress" data-click-args="[&quot;stations&quot;]" id="btn-prog-filter-stations" style="padding:4px 8px; font-size:11px; border-radius:6px;">منزلگاه‌ها</button>
                    <button type="button" class="btn-action" data-click="filterDrawerClassProgress" data-click-args="[&quot;quizzes&quot;]" id="btn-prog-filter-quizzes" style="padding:4px 8px; font-size:11px; border-radius:6px;">آزمون‌ها</button>
                    <button type="button" class="btn-action" data-click="filterDrawerClassProgress" data-click-args="[&quot;challenges&quot;]" id="btn-prog-filter-challenges" style="padding:4px 8px; font-size:11px; border-radius:6px;">چالش‌ها</button>
                  </div>
                  <div style="position:relative; flex: 1 1 150px; max-width: 220px;">
                    <input type="text" id="drawer-class-search-input" placeholder="جستجو در جدول..." data-input="filterDrawerClassProgress" style="width:100%; padding:5px 10px; background:var(--surface-2); border:1px solid var(--border-strong); border-radius:6px; color:var(--text); font-size:11.5px; box-sizing:border-box;">
                  </div>
                </div>

                <!-- 5-Column Table -->
                <div class="table-container" style="max-height: 380px; overflow-y: auto; border: 1px solid rgb(var(--fg-rgb) / 0.08); border-radius: 8px;">
                  <table class="data-table" id="drawer-class-progress-table" style="margin: 0; width: 100%;">
                    <thead style="position: sticky; top: 0; background: var(--surface); z-index: 2;">
                      <tr>
                        <th style="width: 130px;"><i class="fa-solid fa-map-location-dot" style="color: var(--primary-text);"></i> منزلگاه</th>
                        <th style="width: 140px;"><i class="fa-solid fa-chalkboard-user" style="color: var(--primary-text);"></i> کلاس</th>
                        <th style="width: 150px;"><i class="fa-solid fa-circle-play" style="color: var(--success-text);"></i> پارت</th>
                        <th style="width: 130px;"><i class="fa-solid fa-spell-check" style="color: var(--accent-text);"></i> آزمون</th>
                        <th style="width: 140px;"><i class="fa-solid fa-trophy" style="color: #f472b6;"></i> چالش</th>
                        <th style="width: 110px; text-align: center;">وضعیت پیشرفت</th>
                      </tr>
                    </thead>
                    <tbody id="drawer-class-progress-tbody">
                      <!-- Automatically populated by JS -->
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div id="tab-support" class="drawer-tab-content" style="display:none;">
              <div class="panel-card glass" style="padding:12px; margin-bottom:12px;">
                <h5 style="color: var(--color-neon-blue); border-bottom: 1px solid rgb(var(--fg-rgb) / 0.1); padding-bottom: 5px;">اطلاعات کاروان</h5>
                <p style="margin-top:10px;"><strong>نام کاروان:</strong> ${esc(user.caravanName || 'در هیچ کاروانی عضو نیست')}</p>
              </div>
              <div class="panel-card glass" style="padding:12px;">
                <h5 style="color: var(--color-neon-blue); border-bottom: 1px solid rgb(var(--fg-rgb) / 0.1); padding-bottom: 5px;">تاریخچه تیکت‌ها</h5>
                <div id="drawer-ticket-list" style="max-height:200px; overflow:auto; padding-left:12px; margin-top: 10px;"></div>
              </div>
            </div>
            
          </div>
        </div>
      </div>
      
      <div id="mentor-view-container" style="display:none; padding:20px;">
        <h3 style="color:var(--color-warning); text-align:center; margin-bottom:20px;">داشبورد و آمار اختصاصی راهبر</h3>
        <div class="grid-cards" style="grid-template-columns: 1fr 1fr;">
           <div class="stat-card glass">
             <i class="fa-solid fa-users" style="color: var(--info-text);"></i>
             <h4>کاروان‌های تحت مدیریت</h4>
             <div class="stat-value" id="mentor-caravans-count">${payload.mentoredCaravans?.length || 0}</div>
           </div>
           <div class="stat-card glass">
             <i class="fa-solid fa-star" style="color: var(--accent-text);"></i>
             <h4>سطح راهبری</h4>
             <div class="stat-value">${user.mentorLevel || 1}</div>
           </div>
        </div>
        <div class="panel-card glass" style="margin-top:20px; padding:15px;">
           <h4 style="margin-bottom:10px;">لیست کاروان‌ها</h4>
           <ul style="list-style:none; padding:0;">
             ${payload.mentoredCaravans?.map(c => '<li style="padding:10px; border-bottom:1px solid rgb(var(--fg-rgb) / 0.1);">' + esc(c.name) + ' (شناسه: ' + esc(c.id) + ')</li>').join('') || '<li>کاروانی یافت نشد</li>'}
           </ul>
        </div>
      </div>
    `;

    // Automatically populate the 5 sections in #tab-class-progress (کلاس، پارت، منزلگاه، آزمون، چالش)
    if (typeof window.populateDrawerClassProgress === 'function') {
      window.populateDrawerClassProgress(payload);
    }

    const tList = document.getElementById('drawer-ticket-list');
    tList.innerHTML = '';
    if (payload.tickets && payload.tickets.length > 0) {
      payload.tickets.forEach(t => {
        tList.innerHTML += `<div style="padding:8px; background:rgb(var(--shade-rgb) / 0.2); border-radius:8px; margin-bottom:8px;">
          <strong>${esc(t.subject)}</strong> <span class="badge" style="float:left; font-size:10px;">${t.status}</span>
          <p style="font-size:12px; margin-top:5px; color:var(--text-secondary);">${esc(t.description)}</p>
        </div>`;
      });
    } else {
      tList.innerHTML = '<div>تیکتی ثبت نشده است.</div>';
    }

    const overlay = document.getElementById('user-drawer-overlay');
    if (overlay) {
      overlay.classList.add('active');
      overlay.style.display = 'block';
    }
    const drawer = document.getElementById('user-detail-drawer');
    if (drawer) {
      drawer.classList.add('active');
    }

    setTimeout(() => {
      const ctx = document.getElementById('drawer-radar-chart');
      if (ctx) {
        if (window.drawerRadarChart) window.drawerRadarChart.destroy();
        window.drawerRadarChart = new Chart(ctx, {
          type: 'radar',
          data: {
            labels: [window.assetName('zarik'), window.assetName('nakh'), window.assetName('derafsh'), window.assetName('farsh'), 'فعالیت کلاسی', 'نمره آزمون'],
            datasets: [{
              label: 'سطح پیشرفت',
              data: [
                Math.min(100, payload.balances.zarik / 100),
                Math.min(100, payload.balances.nakh * 10),
                Math.min(100, payload.balances.beyragh * 20),
                Math.min(100, payload.balances.farsh * 25),
                Math.min(100, (payload.watchRecords?.length || 0) * 10),
                (payload.quizzes?.[0]?.score || 0)
              ],
              backgroundColor: NopaTheme.rgba('--primary-rgb', 0.4),
              borderColor: NopaTheme.rgba('--primary-rgb', 1),
              borderWidth: 2
            }]
          },
          options: {
            scales: {
              // text / grid colours come from the theme (theme.js syncCharts)
              r: {
                angleLines: { color: NopaTheme.cssVar('--border') },
                grid: { color: NopaTheme.cssVar('--border') },
                pointLabels: { color: NopaTheme.cssVar('--text-muted') },
                ticks: { display: false }
              }
            },
            plugins: { legend: { display: false } }
          }
        });
      }
    }, 300);

  } catch (error) {
    console.error('Error fetching user details:', error);
  }
}

// ==========================================
// Class & Exam Progress Breakdown (#tab-class-progress)
// Separate sections for: منزلگاه، کلاس، پارت، آزمون، چالش
// ==========================================
window.cachedDrawerClassRows = [];
window.activeDrawerClassFilter = 'all';

window.populateDrawerClassProgress = function(payload) {
  if (!payload) return;
  const summary = payload.stationsProgress?.summary || {};
  const stations = payload.stationsProgress?.allStations || [];
  const userProgressRecords = payload.userProgressRecords || [];
  const challenges = payload.challenges || payload.quizzes || [];
  const allChallenges = payload.allChallenges || [];
  const quizSubmissions = payload.quizSubmissions || payload.assignments || [];

  // Update 5 Header Stats Summary
  const totalStations = summary.totalStations || stations.length || 5;
  const passedStations = summary.passedStations || 0;
  const statStationsEl = document.getElementById('drawer-stat-stations');
  if (statStationsEl) statStationsEl.textContent = `${passedStations} از ${totalStations}`;

  const totalClasses = summary.totalClasses || 0;
  const passedClasses = summary.passedClasses || 0;
  const statClassesEl = document.getElementById('drawer-stat-classes');
  if (statClassesEl) statClassesEl.textContent = `${passedClasses} از ${totalClasses}`;

  const totalParts = summary.totalParts || 0;
  const passedParts = summary.passedParts || 0;
  const statPartsEl = document.getElementById('drawer-stat-parts');
  if (statPartsEl) statPartsEl.textContent = `${passedParts} از ${totalParts}`;

  const totalQuizzes = summary.totalQuizzes || 0;
  const passedQuizzes = summary.passedQuizzes || 0;
  const statQuizzesEl = document.getElementById('drawer-stat-quizzes');
  if (statQuizzesEl) statQuizzesEl.textContent = `${passedQuizzes} از ${totalQuizzes}`;

  const completedChallenges = challenges.filter(c => c.status === 'approved').length;
  const totalChCount = Math.max(allChallenges.length, challenges.length);
  const statChallengesEl = document.getElementById('drawer-stat-challenges');
  if (statChallengesEl) statChallengesEl.textContent = `${completedChallenges} از ${totalChCount}`;

  // Build lookups for fast retrieval
  const progressMap = {};
  userProgressRecords.forEach(p => {
    if (p.sessionId) progressMap[p.sessionId] = p;
  });

  const quizSubMap = {};
  quizSubmissions.forEach(qs => {
    const qid = qs.quizId || qs.quiz?.id;
    if (qid) quizSubMap[qid] = qs;
  });

  const challengeSubMap = {};
  challenges.forEach(ch => {
    const cid = ch.challengeId || ch.challenge?.id;
    if (cid) challengeSubMap[cid] = ch;
  });

  // Compile structured rows
  const rows = [];

  stations.forEach((st, stIdx) => {
    const stNumber = st.stationNumber || (stIdx + 1);
    const stTitle = st.title || `منزلگاه ${stNumber}`;

    // Correlate challenges by station number or identifier
    const stChallenges = allChallenges.filter(ch => {
      const cid = (ch.id || '').toUpperCase();
      const cTitle = (ch.title || '').toLowerCase();
      return cid.includes(`CH${stNumber}`) || cid.includes(`${stNumber}0`) || cTitle.includes(`منزلگاه ${stNumber}`);
    });

    let stHasSessions = false;

    (st.categories || []).forEach((cat) => {
      (cat.sessions || []).forEach((sess, sessIdx) => {
        stHasSessions = true;
        const prog = progressMap[sess.id] || {};
        const isWatched = !!prog.isWatched;
        const quizPassed = !!prog.quizPassed;
        const clips = sess.videoClips || [];
        const quizzes = sess.quizzes || [];

        // Match associated challenge for this session/station
        let assocChallenge = null;
        let assocSubmission = null;
        if (stChallenges.length > 0) {
          assocChallenge = stChallenges[sessIdx % stChallenges.length];
        } else if (allChallenges.length > 0) {
          assocChallenge = allChallenges[sessIdx % allChallenges.length];
        }

        if (assocChallenge) {
          assocSubmission = challengeSubMap[assocChallenge.id] || null;
        }

        // Calculate progress percentage
        let earnedScore = 0;
        let maxScore = 0;

        // Class & Part Weight (50%)
        maxScore += 50;
        if (isWatched) earnedScore += 50;

        // Quiz Weight (30%)
        if (quizzes.length > 0) {
          maxScore += 30;
          if (quizPassed) earnedScore += 30;
        }

        // Challenge Weight (20%)
        if (assocChallenge) {
          maxScore += 20;
          if (assocSubmission?.status === 'approved') earnedScore += 20;
          else if (assocSubmission?.status === 'pending') earnedScore += 10;
        }

        const pct = maxScore > 0 ? Math.round((earnedScore / maxScore) * 100) : (isWatched ? 100 : 0);

        rows.push({
          type: 'class_row',
          stationId: st.id,
          stationNumber: stNumber,
          stationTitle: stTitle,
          categoryTitle: cat.title,
          sessionId: sess.id,
          sessionTitle: sess.title,
          clips,
          isWatched,
          quizzes,
          quizPassed,
          quizSubmissions: quizzes.map(q => quizSubMap[q.id]).filter(Boolean),
          challenge: assocChallenge,
          challengeSubmission: assocSubmission,
          progressPct: pct,
          isCompleted: pct === 100
        });
      });
    });

    // If station has no sessions registered yet
    if (!stHasSessions) {
      rows.push({
        type: 'station_only',
        stationId: st.id,
        stationNumber: stNumber,
        stationTitle: stTitle,
        categoryTitle: '-',
        sessionId: null,
        sessionTitle: 'فاقد جلسه ثبت‌شده',
        clips: [],
        isWatched: false,
        quizzes: [],
        quizPassed: false,
        quizSubmissions: [],
        challenge: stChallenges[0] || null,
        challengeSubmission: stChallenges[0] ? challengeSubMap[stChallenges[0].id] : null,
        progressPct: 0,
        isCompleted: false
      });
    }
  });

  // Include any standalone/caravan challenges not linked to rows
  allChallenges.forEach(ch => {
    const isAlreadyAssigned = rows.some(r => r.challenge && r.challenge.id === ch.id);
    if (!isAlreadyAssigned) {
      const sub = challengeSubMap[ch.id];
      const isApproved = sub?.status === 'approved';
      rows.push({
        type: 'challenge_only',
        stationId: null,
        stationNumber: '-',
        stationTitle: 'چالش‌های کاروان / عمومی',
        categoryTitle: '-',
        sessionId: null,
        sessionTitle: '-',
        clips: [],
        isWatched: false,
        quizzes: [],
        quizPassed: false,
        quizSubmissions: [],
        challenge: ch,
        challengeSubmission: sub,
        progressPct: isApproved ? 100 : (sub ? 50 : 0),
        isCompleted: isApproved
      });
    }
  });

  window.cachedDrawerClassRows = rows;
  window.activeDrawerClassFilter = 'all';

  // Reset filter buttons UI
  const container = document.getElementById('drawer-class-filter-chips');
  if (container) {
    container.querySelectorAll('button').forEach(btn => {
      btn.style.background = 'rgb(var(--fg-rgb) / 0.06)';
      btn.style.color = 'var(--text-soft)';
      btn.style.borderColor = 'rgb(var(--fg-rgb) / 0.1)';
      btn.classList.remove('active');
    });
    const defaultBtn = document.getElementById('btn-prog-filter-all');
    if (defaultBtn) {
      defaultBtn.style.background = 'var(--primary)';
      defaultBtn.style.color = 'white';
      defaultBtn.style.borderColor = 'var(--primary)';
      defaultBtn.classList.add('active');
    }
  }

  window.renderDrawerClassProgressTable();
};

window.renderDrawerClassProgressTable = function() {
  const tbody = document.getElementById('drawer-class-progress-tbody');
  if (!tbody) return;
  const rows = window.cachedDrawerClassRows || [];
  const filterType = window.activeDrawerClassFilter || 'all';
  const searchInput = document.getElementById('drawer-class-search-input');
  const searchVal = searchInput ? searchInput.value.trim().toLowerCase() : '';

  const filtered = rows.filter(r => {
    if (filterType === 'classes' && (!r.sessionId || r.type === 'challenge_only')) return false;
    if (filterType === 'parts' && (!r.clips || r.clips.length === 0) && !r.sessionId) return false;
    if (filterType === 'stations' && (!r.stationTitle || r.stationNumber === '-')) return false;
    if (filterType === 'quizzes' && (!r.quizzes || r.quizzes.length === 0)) return false;
    if (filterType === 'challenges' && !r.challenge) return false;

    if (searchVal) {
      const matchSt = (r.stationTitle || '').toLowerCase().includes(searchVal);
      const matchCat = (r.categoryTitle || '').toLowerCase().includes(searchVal);
      const matchSess = (r.sessionTitle || '').toLowerCase().includes(searchVal);
      const matchClips = (r.clips || []).some(c => (c.title || '').toLowerCase().includes(searchVal));
      const matchQuiz = (r.quizzes || []).some(q => (q.title || '').toLowerCase().includes(searchVal));
      const matchCh = r.challenge && (r.challenge.title || '').toLowerCase().includes(searchVal);
      if (!matchSt && !matchCat && !matchSess && !matchClips && !matchQuiz && !matchCh) {
        return false;
      }
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:28px 12px; color:var(--text-secondary);"><i class="fa-solid fa-inbox" style="font-size:24px; margin-bottom:8px; display:block; opacity:0.6;"></i>اطلاعاتی متناسب با فیلتر یافت نشد.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    // 1. منزلگاه
    let stationCell = '';
    if (r.stationNumber && r.stationNumber !== '-') {
      stationCell = `
        <div style="display:flex; flex-direction:column; gap:4px;">
          <span class="badge" style="background:rgb(var(--primary-rgb) / 0.22); color:var(--primary-text); font-size:10px; width:fit-content; border: 1px solid rgb(var(--primary-rgb) / 0.3);">
            <i class="fa-solid fa-map-location-dot" style="margin-left:3px;"></i>منزلگاه ${r.stationNumber}
          </span>
          <strong style="font-size:12px; color:var(--text);">${esc(r.stationTitle)}</strong>
        </div>`;
    } else {
      stationCell = `<span class="badge" style="background:rgb(var(--fg-rgb) / 0.08); color:var(--text-muted); font-size:11px;"><i class="fa-solid fa-layer-group" style="margin-left:3px;"></i>عمومی / کاروان</span>`;
    }

    // 2. کلاس
    let classCell = '';
    if (r.sessionTitle && r.sessionTitle !== '-' && r.sessionId) {
      classCell = `
        <div style="display:flex; flex-direction:column; gap:3px;">
          <strong style="font-size:12px; color:var(--primary-text);">
            <i class="fa-solid fa-chalkboard-user" style="margin-left:4px; opacity:0.85;"></i>${esc(r.sessionTitle)}
          </strong>
          ${r.categoryTitle && r.categoryTitle !== '-' ? `<span style="font-size:10.5px; color:var(--text-secondary);">${esc(r.categoryTitle)}</span>` : ''}
        </div>`;
    } else {
      classCell = `<span style="color:var(--text-secondary); font-size:11px;">-</span>`;
    }

    // 3. پارت
    let partCell = '';
    if (r.clips && r.clips.length > 0) {
      partCell = `
        <div style="display:flex; flex-direction:column; gap:4px;">
          <span class="badge" style="background:${r.isWatched ? 'rgb(var(--success-rgb) / 0.2)' : 'rgb(var(--primary-rgb) / 0.15)'}; color:${r.isWatched ? 'var(--success-text)' : 'var(--primary)'}; font-size:10.5px; width:fit-content; border: 1px solid ${r.isWatched ? 'rgb(var(--success-rgb) / 0.3)' : 'rgb(var(--primary-rgb) / 0.3)'};">
            <i class="fa-solid fa-circle-play" style="margin-left:3px;"></i>${r.clips.length} پارت
          </span>
          <div style="font-size:10.5px; color:${r.isWatched ? 'var(--success-text)' : 'var(--text-muted)'};">
            ${r.isWatched ? 'کامل مشاهده شده' : `${esc(r.clips[0]?.title || 'پارت ۱')} (مشاهده نشده)`}
          </div>
        </div>`;
    } else if (r.sessionId) {
      partCell = `
        <div style="display:flex; align-items:center; gap:5px;">
          <span class="badge" style="background:${r.isWatched ? 'rgb(var(--success-rgb) / 0.18)' : 'rgb(var(--fg-rgb) / 0.06)'}; color:${r.isWatched ? 'var(--success-text)' : 'var(--text-muted)'}; font-size:10.5px; border: 1px solid ${r.isWatched ? 'rgb(var(--success-rgb) / 0.3)' : 'rgb(var(--fg-rgb) / 0.1)'};">
            <i class="fa-solid ${r.isWatched ? 'fa-check' : 'fa-video'}" style="margin-left:3px;"></i>${r.isWatched ? '۱ پارت (مشاهده شده)' : '۱ پارت اصلی'}
          </span>
        </div>`;
    } else {
      partCell = `<span style="color:var(--text-secondary); font-size:11px;">-</span>`;
    }

    // 4. آزمون
    let quizCell = '';
    if (r.quizzes && r.quizzes.length > 0) {
      const q = r.quizzes[0];
      const qSub = (r.quizSubmissions && r.quizSubmissions[0]) || null;
      if (r.quizPassed || (qSub && qSub.score >= 50)) {
        quizCell = `
          <div style="display:flex; flex-direction:column; gap:3px;">
            <span class="badge" style="background:rgb(var(--success-rgb) / 0.2); color:var(--success-text); font-size:10.5px; width:fit-content; border: 1px solid rgb(var(--success-rgb) / 0.3);">
              <i class="fa-solid fa-check-double" style="margin-left:3px;"></i>قبول شده ${qSub?.score ? `(${qSub.score})` : ''}
            </span>
            <span style="font-size:10.5px; color:var(--text-soft);">${esc(q.title || 'آزمون پایان کلاس')}</span>
          </div>`;
      } else if (qSub) {
        quizCell = `
          <div style="display:flex; flex-direction:column; gap:3px;">
            <span class="badge" style="background:rgb(var(--danger-rgb) / 0.2); color:var(--danger-text); font-size:10.5px; width:fit-content; border: 1px solid rgb(var(--danger-rgb) / 0.3);">
              <i class="fa-solid fa-xmark" style="margin-left:3px;"></i>مردود (${qSub.score})
            </span>
            <span style="font-size:10.5px; color:var(--text-soft);">${esc(q.title || 'آزمون')}</span>
          </div>`;
      } else {
        quizCell = `
          <div style="display:flex; flex-direction:column; gap:3px;">
            <span class="badge" style="background:rgb(var(--accent-rgb) / 0.15); color:var(--accent-text); font-size:10px; width:fit-content; border: 1px solid rgb(var(--accent-rgb) / 0.3);">
              <i class="fa-regular fa-clock" style="margin-left:3px;"></i>شرکت نکرده
            </span>
            <span style="font-size:10.5px; color:var(--text-secondary);">${esc(q.title || 'آزمون پایان کلاس')}</span>
          </div>`;
      }
    } else {
      quizCell = `<span style="color:var(--text-secondary); font-size:11px;">بدون آزمون</span>`;
    }

    // 5. چالش
    let challengeCell = '';
    if (r.challenge) {
      const ch = r.challenge;
      const sub = r.challengeSubmission;
      const chTypeLabel = ch.type === 'quiz' ? 'کوئیز' : ch.type === 'file' ? 'فایلی' : 'مهارتی';
      if (sub && sub.status === 'approved') {
        challengeCell = `
          <div style="display:flex; flex-direction:column; gap:3px;">
            <span class="badge" style="background:rgb(var(--success-rgb) / 0.2); color:var(--success-text); font-size:10.5px; width:fit-content; border: 1px solid rgb(var(--success-rgb) / 0.3);">
              <i class="fa-solid fa-trophy" style="margin-left:3px;"></i>تایید (+${ch.rewardZarik || 50} زریک)
            </span>
            <span style="font-size:10.5px; color:var(--text-soft);" title="${esc(ch.title)}">${esc(ch.title)}</span>
          </div>`;
      } else if (sub && sub.status === 'pending') {
        challengeCell = `
          <div style="display:flex; flex-direction:column; gap:3px;">
            <span class="badge" style="background:rgb(var(--accent-rgb) / 0.2); color:var(--accent-text); font-size:10.5px; width:fit-content; border: 1px solid rgb(var(--accent-rgb) / 0.3);">
              <i class="fa-solid fa-hourglass-start" style="margin-left:3px;"></i>در انتظار ارزیابی
            </span>
            <span style="font-size:10.5px; color:var(--text-soft);" title="${esc(ch.title)}">${esc(ch.title)}</span>
          </div>`;
      } else if (sub && sub.status === 'rejected') {
        challengeCell = `
          <div style="display:flex; flex-direction:column; gap:3px;">
            <span class="badge" style="background:rgb(var(--danger-rgb) / 0.2); color:var(--danger-text); font-size:10.5px; width:fit-content; border: 1px solid rgb(var(--danger-rgb) / 0.3);">
              <i class="fa-solid fa-xmark" style="margin-left:3px;"></i>نیازمند اصلاح
            </span>
            <span style="font-size:10.5px; color:var(--text-soft);" title="${esc(ch.title)}">${esc(ch.title)}</span>
          </div>`;
      } else {
        challengeCell = `
          <div style="display:flex; flex-direction:column; gap:3px;">
            <span class="badge" style="background:rgba(236, 72, 153, 0.12); color:#f472b6; font-size:10px; width:fit-content; border: 1px solid rgba(236, 72, 153, 0.25);">
              <i class="fa-regular fa-circle" style="margin-left:3px;"></i>انجام نشده (${chTypeLabel})
            </span>
            <span style="font-size:10.5px; color:var(--text-secondary);" title="${esc(ch.title)}">${esc(ch.title)}</span>
          </div>`;
      }
    } else {
      challengeCell = `<span style="color:var(--text-secondary); font-size:11px;">-</span>`;
    }

    // 6. وضعیت پیشرفت
    const pct = r.progressPct || 0;
    const barColor = pct === 100 ? 'var(--success)' : pct >= 50 ? 'var(--primary)' : pct > 0 ? 'var(--accent)' : 'var(--text-faint)';
    const statusText = pct === 100 ? 'تکمیل شده' : pct > 0 ? `${pct}% پیشرفت` : 'شروع نشده';

    const progressCell = `
      <div style="display:flex; flex-direction:column; align-items:center; gap:4px; min-width:85px;">
        <div style="width:100%; height:6px; background:rgb(var(--fg-rgb) / 0.1); border-radius:4px; overflow:hidden;">
          <div style="width:${pct}%; height:100%; background:${barColor}; border-radius:4px; transition:width 0.3s ease;"></div>
        </div>
        <span style="font-size:10px; font-weight:bold; color:${barColor};">${statusText}</span>
      </div>`;

    return `
      <tr style="border-bottom: 1px solid rgb(var(--fg-rgb) / 0.06); transition:background 0.2s ease;">
        <td style="vertical-align:middle; padding:10px 8px;">${stationCell}</td>
        <td style="vertical-align:middle; padding:10px 8px;">${classCell}</td>
        <td style="vertical-align:middle; padding:10px 8px;">${partCell}</td>
        <td style="vertical-align:middle; padding:10px 8px;">${quizCell}</td>
        <td style="vertical-align:middle; padding:10px 8px;">${challengeCell}</td>
        <td style="vertical-align:middle; padding:10px 8px; text-align:center;">${progressCell}</td>
      </tr>`;
  }).join('');
};

window.filterDrawerClassProgress = function(filterType) {
  if (filterType) {
    window.activeDrawerClassFilter = filterType;
    const container = document.getElementById('drawer-class-filter-chips');
    if (container) {
      container.querySelectorAll('button').forEach(btn => {
        btn.style.background = 'rgb(var(--fg-rgb) / 0.06)';
        btn.style.color = 'var(--text-soft)';
        btn.style.borderColor = 'rgb(var(--fg-rgb) / 0.1)';
        btn.classList.remove('active');
      });
      const activeBtn = document.getElementById(`btn-prog-filter-${filterType}`);
      if (activeBtn) {
        activeBtn.style.background = 'var(--primary)';
        activeBtn.style.color = 'white';
        activeBtn.style.borderColor = 'var(--primary)';
        activeBtn.classList.add('active');
      }
    }
  }
  window.renderDrawerClassProgressTable();
};

let isMentorView = false;
window.toggleDualRoleView = function() {
  isMentorView = !isMentorView;
  const sView = document.getElementById('student-view-container');
  const mView = document.getElementById('mentor-view-container');
  if (isMentorView) {
    sView.style.display = 'none';
    mView.style.display = 'block';
  } else {
    sView.style.display = 'block';
    mView.style.display = 'none';
  }
};

window.switchDrawerTab = function(tabId) {
  document.querySelectorAll('.drawer-tab-content').forEach(el => {
    el.style.display = 'none';
    el.classList.remove('active');
  });
  document.querySelectorAll('.tabs-header .btn-action').forEach(btn => btn.classList.remove('active'));
  
  document.getElementById(tabId).style.display = 'block';
  document.getElementById(tabId).classList.add('active');
  document.getElementById('btn-' + tabId).classList.add('active');
};

// Block / Unblock User
async function toggleBlockUser(userId, blockStatus) {
  try {
    const res = await request(`/api/v1/admin/users/${userId}/block`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocked: blockStatus })
    });
    if (res.ok) {
      loadUsers();
    }
  } catch (err) {
    console.error(err);
  }
}

// Delete User
async function deleteUser(userId) {
  if (!(await NopaConfirm('آیا از حذف دائم این کاربر اطمینان دارید؟ این عملیات غیرقابل بازگشت است.'))) return;
  try {
    const res = await request(`/api/v1/admin/users/${userId}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message);
      loadUsers();
    } else {
      showToast(data.error || 'خطا در حذف کاربر', 'error');
    }
  } catch (err) {
    console.error(err);
  }
}

// Open Password Override Dialog
function openPasswordOverride(userId) {
  const newPass = prompt('گذرواژه جدید کاربر را وارد کنید:');
  if (!newPass) return;
  
  request(`/api/v1/admin/users/${userId}/override-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: newPass })
  }).then(async res => {
    const data = await res.json();
    if (res.ok) {
      showToast('گذرواژه با موفقیت تغییر کرد', 'success');
    } else {
      showToast(data.error);
    }
  });
}

// Add/Edit User Modal
window.openUserModal = async function(id = '', name = '', role = 'student', caravanId = '', levelFrame = 1, mentorLevel = 1, nationalId = '', dateOfBirth = '') {
  let user = null;
  if (id) {
    try {
      const res = await request(`/api/v1/admin/users/${id}`);
      if (res.ok) user = await res.json();
    } catch(e) {
      console.warn('Could not fetch user details from API, using arguments');
    }
  }

  const userId = id || user?.id || '';
  const userName = user?.name || name || '';
  const userPhone = user?.phoneNumber || '';
  const userRole = user?.role || role || 'student';
  const userCaravanId = user?.caravanId !== undefined ? (user?.caravanId || '') : (caravanId || '');
  const userLevel = user?.levelFrame || levelFrame || 1;
  const userMentorLevel = user?.mentorLevel || mentorLevel || 1;
  const userNationalId = user?.nationalId || nationalId || '';
  const userDob = user?.dateOfBirth || dateOfBirth || '';

  document.getElementById('edit-user-id').value = userId;
  // identity fields (js/ui/person-fields.js) — remembers the loaded phone so an untouched one is not re-sent
  NopaPersonFields.fill('modal-user', {
    name: userName, phoneNumber: userId ? userPhone : '', nationalId: userNationalId, dateOfBirth: userDob, gender: user?.gender || ''
  });
  document.getElementById('modal-user-role').value = userRole;
  setupUserModalAccessControls(userRole, user?.panelAccess ?? null);
  document.getElementById('modal-user-level').value = userLevel;
  document.getElementById('modal-user-mentor-level').value = userMentorLevel;
  if (document.getElementById('modal-user-degree')) {
    document.getElementById('modal-user-degree').value = user?.academicDegree || '';
  }
  if (document.getElementById('modal-user-certificates')) {
    document.getElementById('modal-user-certificates').value = user?.academicCertificates || '';
  }

  // Populate Caravan Options in User Modal
  const caravanSelect = document.getElementById('modal-user-caravan');
  if (caravanSelect) {
    let options = '<option value="">فاقد کاروان</option>';
    const caravans = window.caravansData || window.caravansMasterList || caravansList || [];
    if (caravans.length > 0) {
      options += caravans.map(c => `<option value="${c.id}" ${c.id === userCaravanId ? 'selected' : ''}>${esc(c.name || c.title)}</option>`).join('');
    }
    caravanSelect.innerHTML = options;
    caravanSelect.value = userCaravanId;
  }

  const phoneGroup = document.getElementById('phone-field-group');
  const passGroup = document.getElementById('password-field-group');
  const mentorLevelGroup = document.getElementById('mentor-level-group');
  const title = document.getElementById('modal-user-title');

  // Toggle mentor level dropdown based on role
  if (mentorLevelGroup) mentorLevelGroup.style.display = userRole === 'mentor' ? 'block' : 'none';
  document.getElementById('modal-user-role').onchange = (e) => {
    if (mentorLevelGroup) mentorLevelGroup.style.display = e.target.value === 'mentor' ? 'block' : 'none';
  };

  if (userId) {
    if (title) title.textContent = `ویرایش کاربر: ${userName}`;
    if (phoneGroup) phoneGroup.style.display = 'block';
    if (passGroup) passGroup.style.display = 'none';
    const phoneInput = document.getElementById('modal-user-phone');
    if (phoneInput) {
      phoneInput.removeAttribute('required');
      phoneInput.value = userPhone;
    }
    document.getElementById('modal-user-password')?.removeAttribute('required');
  } else {
    if (title) title.textContent = 'ایجاد کاربر جدید';
    if (phoneGroup) phoneGroup.style.display = 'block';
    if (passGroup) passGroup.style.display = 'block';
    const phoneInput = document.getElementById('modal-user-phone');
    if (phoneInput) {
      phoneInput.setAttribute('required', 'true');
      phoneInput.value = '';
    }
    const passInput = document.getElementById('modal-user-password');
    if (passInput) {
      passInput.setAttribute('required', 'true');
      passInput.value = '';
    }
  }

  const modal = document.getElementById('user-modal-overlay');
  if (modal) {
    modal.style.display = 'flex';
    modal.style.zIndex = 'var(--z-modal)';
  }
};

async function handleUserFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('edit-user-id').value;
  if (!NopaPersonFields.validate('modal-user', { requirePhone: !id })) return;
  // normalised (Latin digits, 09…); phoneNumber is undefined when an edit left it untouched
  const { name, phoneNumber, nationalId, dateOfBirth, gender } = NopaPersonFields.read('modal-user');
  const role = document.getElementById('modal-user-role').value;
  const caravanId = document.getElementById('modal-user-caravan').value;
  const levelFrame = parseInt(document.getElementById('modal-user-level').value) || 1;
  const mentorLevel = parseInt(document.getElementById('modal-user-mentor-level').value) || 1;
  const academicDegree = document.getElementById('modal-user-degree')?.value;
  const academicCertificates = document.getElementById('modal-user-certificates')?.value;

  let res;
  if (id) {
    // Edit User
    res = await request(`/api/v1/admin/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phoneNumber, role, caravanId: caravanId || null, levelFrame, mentorLevel, nationalId, dateOfBirth, gender, academicDegree, academicCertificates })
    });
  } else {
    // Create User
    const password = document.getElementById('modal-user-password').value;
    res = await request('/api/v1/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phoneNumber, password, role, caravanId: caravanId || null, levelFrame, mentorLevel, nationalId, dateOfBirth, gender })
    });
  }

  const data = await res.json();
  if (res.ok) {
    await saveUserPanelAccess(id || data.userId);
    showToast(data.message || 'مشخصات کاربر با موفقیت ذخیره شد', 'success');
    document.getElementById('user-modal-overlay').style.display = 'none';
    if (typeof loadUsers === 'function') loadUsers();
    if (typeof loadAllUsersDropdown === 'function') loadAllUsersDropdown();
    if (typeof loadCaravansTab === 'function') await loadCaravansTab();
    if (typeof window.loadSelectedCaravanDetails === 'function') window.loadSelectedCaravanDetails();
  } else {
    showToast(data.error || 'خطا در ثبت اطلاعات', 'error');
  }
}
