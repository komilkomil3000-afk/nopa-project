// Users: directory + filters, user drawer (360 view, class progress), user modal, levels, students.
// Split out of the former app.js (Phase 7). Classic script: shares globals with the other modules;
// load order is set in index.html.

// 8. Toggle Dark/Light Mode
async function loadLevelsAndCertificatesTab() {
  const tbody = document.querySelector('#levels-data-table tbody');
  try {
    const res = await request('/api/v1/admin/levels-and-certificates');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    if (!tbody) return;
    if (!data.data || !data.data.length) return NopaTable.empty(tbody, 'کاربری برای نمایش وجود ندارد');
    tbody.innerHTML = '';

    data.data.forEach(user => {
      const levelNames = { 1: 'تازه وارد', 2: 'نقره‌ای', 3: 'طلایی' };
      const levelBadge = `<span class="badge u-bg-primary u-c-white u-fs-2xs">${levelNames[user.levelFrame] || 'نامشخص'}</span>`;
      
      const lastCert = user.certificates && user.certificates.length > 0 ? user.certificates[0].title : 'بدون گواهینامه';
      
      let physicalReqs = 'ندارد';
      if (user.physicalOrders && user.physicalOrders.length > 0) {
        physicalReqs = user.physicalOrders.map(o => `<span class="badge u-c-black" data-style="background:${o.status === 'PENDING_PRINT' ? 'var(--accent)' : 'var(--success)'}">${o.status === 'PENDING_PRINT' ? 'در انتظار چاپ' : 'ارسال شده'}</span>`).join(' ');
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${esc(user.name || 'کاربر بدون نام')}</strong></td>
        <td class="u-mono">${esc(user.phoneNumber)}</td>
        <td>${levelBadge}</td>
        <td>${esc(lastCert)}</td>
        <td>${user.registrationCompleted ? '<span class="u-c-color-success">تکمیل شده</span>' : '<span class="u-c-color-danger">ناقص</span>'}</td>
        <td>${physicalReqs}</td>
        <td>
          <button class="page-btn btn-edit u-p-4-8 u-fs-2xs" data-click="promptLevelOverride" data-click-args="${esc(JSON.stringify([String(user.id), (user.levelFrame)]))}" title="تغییر سطح دستی"><i class="fa-solid fa-edit"></i></button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load levels and certificates:', err);
    NopaTable.error(tbody, 'خطا در دریافت سطوح و گواهینامه‌ها');
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
        roleBadge += ` <span class="badge u-bg-primary u-c-white u-fs-2xs">${levelName}</span>`;
      }
      
      const blockBadge = u.blocked ? `<span class="badge badge-blocked">مسدود شده</span>` : '';
      const regDate = u.createdAt ? new Date(u.createdAt).toLocaleDateString('fa-IR') : '-';
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${u.userCode || '-'}</td>
        <td><strong>${esc(u.name)}</strong> ${u.gender === 'male' ? '<span class="badge u-bg-info-strong u-c-white u-fs-2xs">مرد</span>' : u.gender === 'female' ? '<span class="badge u-c-white u-fs-2xs u-bg-pink-strong">زن</span>' : ''} ${blockBadge}</td>
        <td class="u-mono">${esc(u.phoneNumber)}</td>
        <td>${roleBadge}</td>
        <td>${esc(u.caravanName || '-')}</td>
        <td><strong class="u-c-color-neon-blue">${(u.zarikBalance || 0).toLocaleString()}</strong></td>
        <td class="u-fs-xs u-c-text-secondary u-nowrap">${regDate}</td>
        <td>
          <div class="u-flex u-items-center u-gap-8">
            <div class="progress-bar-container u-flex-1 u-m-0 u-w-60">
              <div class="progress-bar-fill" data-style="width: ${Number(u.completionRate) || 0}%"></div>
            </div>
            <span class="u-fs-2xs">${Number(u.completionRate) || 0}%</span>
          </div>
        </td>
        <td>
          <button title="مشاهده‌ی جزئیات کاربر" aria-label="مشاهده‌ی جزئیات کاربر" class="page-btn btn-view u-p-4-8 u-fs-2xs" data-click="viewUserDetails" data-click-args="${esc(JSON.stringify([String(u.id)]))}"><i class="fa-solid fa-eye"></i></button>
          <button title="ویرایش کاربر" aria-label="ویرایش کاربر" class="page-btn btn-edit u-p-4-8 u-fs-2xs" data-click="openUserModal" data-click-args="${esc(JSON.stringify([String(u.id), String(u.name), String(u.role), String(u.caravanId || ''), (u.levelFrame), (u.mentorLevel || 1), String(u.nationalId || ''), String(u.dateOfBirth || '')]))}"><i class="fa-solid fa-edit"></i></button>
          <button title="${u.blocked ? 'رفع مسدودیت' : 'مسدود کردن'}" aria-label="${u.blocked ? 'رفع مسدودیت' : 'مسدود کردن'}" class="page-btn btn-block u-p-4-8 u-fs-2xs" data-style="color: ${u.blocked ? 'var(--color-success)' : 'var(--color-warning)'}" data-click="toggleBlockUser" data-click-args="${esc(JSON.stringify([String(u.id), (!u.blocked)]))}"><i class="fa-solid ${u.blocked ? 'fa-unlock' : 'fa-ban'}"></i></button>
          <button title="حذف کاربر" aria-label="حذف کاربر" class="page-btn btn-delete u-p-4-8 u-fs-2xs u-c-color-danger" data-click="deleteUser" data-click-args="${esc(JSON.stringify([String(u.id)]))}"><i class="fa-solid fa-trash"></i></button>
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
      <div class="u-flex-1"></div>
      ${(user.isDualRole || user.role === 'mentor') ? `
        <button id="btn-role-switcher" class="btn-action u-bgc-success u-c-white u-ml-16" data-click="toggleDualRoleView">
          <i class="fa-solid fa-exchange-alt"></i> تغییر نمای کاربر (راهبر / دانش‌آموز)
        </button>
      ` : ''}
      <button aria-label="بستن" class="modal-close" id="btn-close-drawer" data-click="closeUserDetailDrawer">&times;</button>
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
        <div class="u-flex u-gap-20 u-items-start u-wrap">
          <div class="glass u-flex-0-0-200 u-text-center u-p-20 u-r-12">
            <div class="user-avatar u-w-100 u-h-100 u-fs-2xl u-m-0-auto-10-auto">${esc(user.name.substring(0,2))}</div>
            <div class="u-mt-8"><span class="badge badge-${user.role}">${roleLabel(user.role)}</span></div>
            <div class="u-mt-10 u-fs-sm u-c-text-secondary">${esc(user.phoneNumber)}</div>
            <div class="u-mt-6 u-fs-xs u-c-text-muted">شناسه اختصاصی: ${user.userCode || 'فاقد شناسه'}</div>
            <hr class="u-bdc-fg-10 u-m-16-0" />
            <div class="u-text-right u-fs-sm">
              <p><strong>زریک:</strong> <span class="u-c-color-neon-blue">${payload.balances.zarik.toLocaleString()}</span></p>
              <p><strong>کلاف:</strong> ${payload.balances.nakh}</p>
              <p><strong>درفش:</strong> ${payload.balances.beyragh}</p>
              <p><strong>قالیچه:</strong> ${payload.balances.farsh}</p>
            </div>
            <div class="u-mt-16 u-flex u-gap-6 u-wrap u-justify-between">
              <button class="btn-primary u-flex-1 u-fs-2xs" data-click="openPasswordOverride" data-click-args="${esc(JSON.stringify([String(user.id)]))}">تغییر رمز</button>
              <button class="btn-action u-flex-1 u-bg-danger u-c-white u-fs-2xs u-p-6" data-click="setAccountStatus" data-click-args="${esc(JSON.stringify([String(user.id), "SUSPENDED"]))}">تعلیق</button>
            </div>
          </div>

          <div class="u-flex-1 u-minw-300">
            <div class="tabs-header u-flex u-gap-10 u-mb-16 u-bb-fg-10 u-pb-10">
              <button class="btn-action active" data-click="switchDrawerTab" data-click-args="[&quot;tab-identity&quot;]" id="btn-tab-identity"><i class="fa-solid fa-id-card"></i> هویت و پروفایل</button>
              <button class="btn-action" data-click="switchDrawerTab" data-click-args="[&quot;tab-class-progress&quot;]" id="btn-tab-class-progress"><i class="fa-solid fa-graduation-cap"></i> کلاس‌ها و آزمون</button>
              <button class="btn-action" data-click="switchDrawerTab" data-click-args="[&quot;tab-support&quot;]" id="btn-tab-support"><i class="fa-solid fa-headset"></i> پشتیبانی و کاروان</button>
            </div>
            
            <div id="tab-identity" class="drawer-tab-content active u-block">
              <div class="panel-card glass u-mb-12 u-p-20">
                <h4 class="u-mb-16 u-c-color-neon-blue">اطلاعات هویتی کامل</h4>
                <div class="u-grid u-cols-2 u-gap-15">
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

            <div id="tab-class-progress" class="drawer-tab-content" data-style="display:none;">
              <div class="panel-card glass u-p-14">
                <!-- 5 Stats Summary Cards Bar -->
                <div class="u-grid u-cols-fit-115 u-gap-8 u-mb-14">
                  <div class="u-bg-primary-12 u-bd-primary-30 u-r-10 u-p-10 u-text-center">
                    <div class="u-fs-2xs u-c-primary-text u-bold"><i class="fa-solid fa-map-location-dot"></i> منزلگاه‌ها</div>
                    <div id="drawer-stat-stations" class="u-fs-md u-fw-800 u-c-text u-mt-4">۰ از ۵</div>
                  </div>
                  <div class="u-bg-primary-12 u-bd-primary-30 u-r-10 u-p-10 u-text-center">
                    <div class="u-fs-2xs u-c-primary-text u-bold"><i class="fa-solid fa-chalkboard-user"></i> کلاس‌ها</div>
                    <div id="drawer-stat-classes" class="u-fs-md u-fw-800 u-c-text u-mt-4">۰ از ۰</div>
                  </div>
                  <div class="u-bg-success-12 u-bd-success-30 u-r-10 u-p-10 u-text-center">
                    <div class="u-fs-2xs u-c-success-text u-bold"><i class="fa-solid fa-circle-play"></i> پارت‌ها</div>
                    <div id="drawer-stat-parts" class="u-fs-md u-fw-800 u-c-text u-mt-4">۰ از ۰</div>
                  </div>
                  <div class="u-bg-accent-12 u-bd-accent-30 u-r-10 u-p-10 u-text-center">
                    <div class="u-fs-2xs u-c-accent-text u-bold"><i class="fa-solid fa-spell-check"></i> آزمون‌ها</div>
                    <div id="drawer-stat-quizzes" class="u-fs-md u-fw-800 u-c-text u-mt-4">۰ از ۰</div>
                  </div>
                  <div class="u-r-10 u-p-10 u-text-center u-bg-pink-12 u-bd-pink-30">
                    <div class="u-fs-2xs u-bold u-c-pink-text"><i class="fa-solid fa-trophy"></i> چالش‌ها</div>
                    <div id="drawer-stat-challenges" class="u-fs-md u-fw-800 u-c-text u-mt-4">۰ از ۰</div>
                  </div>
                </div>

                <!-- Filter Chips & Search Bar -->
                <div class="u-flex u-justify-between u-items-center u-wrap u-gap-8 u-mb-12 u-bg-shade-25 u-p-8-10 u-r-8 u-bd-fg-6">
                  <div class="u-flex u-gap-6 u-wrap" id="drawer-class-filter-chips">
                    <button type="button" class="btn-action active u-p-4-8 u-fs-2xs u-r-6" data-click="filterDrawerClassProgress" data-click-args="[&quot;all&quot;]" id="btn-prog-filter-all">همه موارد</button>
                    <button type="button" class="btn-action u-p-4-8 u-fs-2xs u-r-6" data-click="filterDrawerClassProgress" data-click-args="[&quot;classes&quot;]" id="btn-prog-filter-classes">کلاس‌ها</button>
                    <button type="button" class="btn-action u-p-4-8 u-fs-2xs u-r-6" data-click="filterDrawerClassProgress" data-click-args="[&quot;parts&quot;]" id="btn-prog-filter-parts">پارت‌ها</button>
                    <button type="button" class="btn-action u-p-4-8 u-fs-2xs u-r-6" data-click="filterDrawerClassProgress" data-click-args="[&quot;stations&quot;]" id="btn-prog-filter-stations">منزلگاه‌ها</button>
                    <button type="button" class="btn-action u-p-4-8 u-fs-2xs u-r-6" data-click="filterDrawerClassProgress" data-click-args="[&quot;quizzes&quot;]" id="btn-prog-filter-quizzes">آزمون‌ها</button>
                    <button type="button" class="btn-action u-p-4-8 u-fs-2xs u-r-6" data-click="filterDrawerClassProgress" data-click-args="[&quot;challenges&quot;]" id="btn-prog-filter-challenges">چالش‌ها</button>
                  </div>
                  <div class="u-relative u-flex-1-1-150 u-maxw-220">
                    <input type="text" id="drawer-class-search-input" placeholder="جستجو در جدول..." data-input="filterDrawerClassProgress" class="u-w-full u-p-6-10 u-bg-surface-2 u-bd-border-strong u-r-6 u-c-text u-fs-xs u-border-box">
                  </div>
                </div>

                <!-- 5-Column Table -->
                <div class="table-container u-maxh-380 u-scroll-y u-bd-fg-8 u-r-8">
                  <table class="data-table u-m-0 u-w-full" id="drawer-class-progress-table">
                    <thead class="u-pos-sticky u-top-0 u-bg-surface u-z-2">
                      <tr>
                        <th class="u-w-130"><i class="fa-solid fa-map-location-dot u-c-primary-text"></i> منزلگاه</th>
                        <th class="u-w-140"><i class="fa-solid fa-chalkboard-user u-c-primary-text"></i> کلاس</th>
                        <th class="u-w-150"><i class="fa-solid fa-circle-play u-c-success-text"></i> پارت</th>
                        <th class="u-w-130"><i class="fa-solid fa-spell-check u-c-accent-text"></i> آزمون</th>
                        <th class="u-w-140"><i class="fa-solid fa-trophy u-c-pink-text"></i> چالش</th>
                        <th class="u-w-110 u-text-center">وضعیت پیشرفت</th>
                      </tr>
                    </thead>
                    <tbody id="drawer-class-progress-tbody">
                      <!-- Automatically populated by JS -->
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div id="tab-support" class="drawer-tab-content" data-style="display:none;">
              <div class="panel-card glass u-p-12 u-mb-12">
                <h5 class="u-c-color-neon-blue u-bb-fg-10 u-pb-6">اطلاعات کاروان</h5>
                <p class="u-mt-10"><strong>نام کاروان:</strong> ${esc(user.caravanName || 'در هیچ کاروانی عضو نیست')}</p>
              </div>
              <div class="panel-card glass u-p-12">
                <h5 class="u-c-color-neon-blue u-bb-fg-10 u-pb-6">تاریخچه تیکت‌ها</h5>
                <div id="drawer-ticket-list" class="u-maxh-200 u-overflow-auto u-pl-12 u-mt-10"></div>
              </div>
            </div>
            
          </div>
        </div>
      </div>
      
      <div id="mentor-view-container" class="u-p-20" data-style="display:none">
        <h3 class="u-c-color-warning u-text-center u-mb-20">داشبورد و آمار اختصاصی راهبر</h3>
        <div class="grid-cards u-cols-2">
           <div class="stat-card glass">
             <i class="fa-solid fa-users u-c-info-text"></i>
             <h4>کاروان‌های تحت مدیریت</h4>
             <div class="stat-value" id="mentor-caravans-count">${payload.mentoredCaravans?.length || 0}</div>
           </div>
           <div class="stat-card glass">
             <i class="fa-solid fa-star u-c-accent-text"></i>
             <h4>سطح راهبری</h4>
             <div class="stat-value">${user.mentorLevel || 1}</div>
           </div>
        </div>
        <div class="panel-card glass u-mt-20 u-p-16">
           <h4 class="u-mb-10">لیست کاروان‌ها</h4>
           <ul class="u-list-none u-p-0">
             ${payload.mentoredCaravans?.map(c => '<li class="u-p-10 u-bb-fg-10">' + esc(c.name) + ' (شناسه: ' + esc(c.id) + ')</li>').join('') || '<li>کاروانی یافت نشد</li>'}
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
        tList.innerHTML += `<div class="u-p-8 u-bg-shade-20 u-r-8 u-mb-8">
          <strong>${esc(t.subject)}</strong> <span class="badge u-float-left u-fs-2xs">${t.status}</span>
          <p class="u-fs-xs u-mt-6 u-c-text-secondary">${esc(t.description)}</p>
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
    NopaTable.empty(tbody, 'اطلاعاتی متناسب با فیلتر یافت نشد.', 'fa-solid fa-inbox');
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    // 1. منزلگاه
    let stationCell = '';
    if (r.stationNumber && r.stationNumber !== '-') {
      stationCell = `
        <div class="u-flex u-col u-gap-4">
          <span class="badge u-bg-primary-22 u-c-primary-text u-fs-2xs u-w-fit-content u-bd-primary-30">
            <i class="fa-solid fa-map-location-dot u-ml-4"></i>منزلگاه ${r.stationNumber}
          </span>
          <strong class="u-fs-xs u-c-text">${esc(r.stationTitle)}</strong>
        </div>`;
    } else {
      stationCell = `<span class="badge u-bg-fg-8 u-c-text-muted u-fs-2xs"><i class="fa-solid fa-layer-group u-ml-4"></i>عمومی / کاروان</span>`;
    }

    // 2. کلاس
    let classCell = '';
    if (r.sessionTitle && r.sessionTitle !== '-' && r.sessionId) {
      classCell = `
        <div class="u-flex u-col u-gap-4">
          <strong class="u-fs-xs u-c-primary-text">
            <i class="fa-solid fa-chalkboard-user u-ml-4 u-o-0_85"></i>${esc(r.sessionTitle)}
          </strong>
          ${r.categoryTitle && r.categoryTitle !== '-' ? `<span class="u-fs-2xs u-c-text-secondary">${esc(r.categoryTitle)}</span>` : ''}
        </div>`;
    } else {
      classCell = `<span class="u-c-text-secondary u-fs-2xs">-</span>`;
    }

    // 3. پارت
    let partCell = '';
    if (r.clips && r.clips.length > 0) {
      partCell = `
        <div class="u-flex u-col u-gap-4">
          <span class="badge u-fs-2xs u-w-fit-content" data-style="background:${r.isWatched ? 'rgb(var(--success-rgb) / 0.2)' : 'rgb(var(--primary-rgb) / 0.15)'}; color:${r.isWatched ? 'var(--success-text)' : 'var(--primary)'}; border: 1px solid ${r.isWatched ? 'rgb(var(--success-rgb) / 0.3)' : 'rgb(var(--primary-rgb) / 0.3)'}">
            <i class="fa-solid fa-circle-play u-ml-4"></i>${r.clips.length} پارت
          </span>
          <div class="u-fs-2xs" data-style="color:${r.isWatched ? 'var(--success-text)' : 'var(--text-muted)'}">
            ${r.isWatched ? 'کامل مشاهده شده' : `${esc(r.clips[0]?.title || 'پارت ۱')} (مشاهده نشده)`}
          </div>
        </div>`;
    } else if (r.sessionId) {
      partCell = `
        <div class="u-flex u-items-center u-gap-6">
          <span class="badge u-fs-2xs" data-style="background:${r.isWatched ? 'rgb(var(--success-rgb) / 0.18)' : 'rgb(var(--fg-rgb) / 0.06)'}; color:${r.isWatched ? 'var(--success-text)' : 'var(--text-muted)'}; border: 1px solid ${r.isWatched ? 'rgb(var(--success-rgb) / 0.3)' : 'rgb(var(--fg-rgb) / 0.1)'}">
            <i class="fa-solid ${r.isWatched ? 'fa-check' : 'fa-video'} u-ml-4"></i>${r.isWatched ? '۱ پارت (مشاهده شده)' : '۱ پارت اصلی'}
          </span>
        </div>`;
    } else {
      partCell = `<span class="u-c-text-secondary u-fs-2xs">-</span>`;
    }

    // 4. آزمون
    let quizCell = '';
    if (r.quizzes && r.quizzes.length > 0) {
      const q = r.quizzes[0];
      const qSub = (r.quizSubmissions && r.quizSubmissions[0]) || null;
      if (r.quizPassed || (qSub && qSub.score >= 50)) {
        quizCell = `
          <div class="u-flex u-col u-gap-4">
            <span class="badge u-bg-success-20 u-c-success-text u-fs-2xs u-w-fit-content u-bd-success-30">
              <i class="fa-solid fa-check-double u-ml-4"></i>قبول شده ${qSub?.score ? `(${qSub.score})` : ''}
            </span>
            <span class="u-fs-2xs u-c-text-soft">${esc(q.title || 'آزمون پایان کلاس')}</span>
          </div>`;
      } else if (qSub) {
        quizCell = `
          <div class="u-flex u-col u-gap-4">
            <span class="badge u-bg-danger-20 u-c-danger-text u-fs-2xs u-w-fit-content u-bd-danger-30">
              <i class="fa-solid fa-xmark u-ml-4"></i>مردود (${qSub.score})
            </span>
            <span class="u-fs-2xs u-c-text-soft">${esc(q.title || 'آزمون')}</span>
          </div>`;
      } else {
        quizCell = `
          <div class="u-flex u-col u-gap-4">
            <span class="badge u-bg-accent-15 u-c-accent-text u-fs-2xs u-w-fit-content u-bd-accent-30">
              <i class="fa-regular fa-clock u-ml-4"></i>شرکت نکرده
            </span>
            <span class="u-fs-2xs u-c-text-secondary">${esc(q.title || 'آزمون پایان کلاس')}</span>
          </div>`;
      }
    } else {
      quizCell = `<span class="u-c-text-secondary u-fs-2xs">بدون آزمون</span>`;
    }

    // 5. چالش
    let challengeCell = '';
    if (r.challenge) {
      const ch = r.challenge;
      const sub = r.challengeSubmission;
      const chTypeLabel = ch.type === 'quiz' ? 'کوئیز' : ch.type === 'file' ? 'فایلی' : 'مهارتی';
      if (sub && sub.status === 'approved') {
        challengeCell = `
          <div class="u-flex u-col u-gap-4">
            <span class="badge u-bg-success-20 u-c-success-text u-fs-2xs u-w-fit-content u-bd-success-30">
              <i class="fa-solid fa-trophy u-ml-4"></i>تایید (+${ch.rewardZarik || 50} زریک)
            </span>
            <span class="u-fs-2xs u-c-text-soft" title="${esc(ch.title)}">${esc(ch.title)}</span>
          </div>`;
      } else if (sub && sub.status === 'pending') {
        challengeCell = `
          <div class="u-flex u-col u-gap-4">
            <span class="badge u-bg-accent-20 u-c-accent-text u-fs-2xs u-w-fit-content u-bd-accent-30">
              <i class="fa-solid fa-hourglass-start u-ml-4"></i>در انتظار ارزیابی
            </span>
            <span class="u-fs-2xs u-c-text-soft" title="${esc(ch.title)}">${esc(ch.title)}</span>
          </div>`;
      } else if (sub && sub.status === 'rejected') {
        challengeCell = `
          <div class="u-flex u-col u-gap-4">
            <span class="badge u-bg-danger-20 u-c-danger-text u-fs-2xs u-w-fit-content u-bd-danger-30">
              <i class="fa-solid fa-xmark u-ml-4"></i>نیازمند اصلاح
            </span>
            <span class="u-fs-2xs u-c-text-soft" title="${esc(ch.title)}">${esc(ch.title)}</span>
          </div>`;
      } else {
        challengeCell = `
          <div class="u-flex u-col u-gap-4">
            <span class="badge u-fs-2xs u-w-fit-content u-bg-pink-12 u-c-pink-text u-bd-pink-25">
              <i class="fa-regular fa-circle u-ml-4"></i>انجام نشده (${chTypeLabel})
            </span>
            <span class="u-fs-2xs u-c-text-secondary" title="${esc(ch.title)}">${esc(ch.title)}</span>
          </div>`;
      }
    } else {
      challengeCell = `<span class="u-c-text-secondary u-fs-2xs">-</span>`;
    }

    // 6. وضعیت پیشرفت
    const pct = r.progressPct || 0;
    const barColor = pct === 100 ? 'var(--success)' : pct >= 50 ? 'var(--primary)' : pct > 0 ? 'var(--accent)' : 'var(--text-faint)';
    const statusText = pct === 100 ? 'تکمیل شده' : pct > 0 ? `${pct}% پیشرفت` : 'شروع نشده';

    const progressCell = `
      <div class="u-flex u-col u-items-center u-gap-4 u-minw-85">
        <div class="u-w-full u-h-6 u-bg-fg-10 u-r-4 u-overflow-hidden">
          <div class="u-h-full u-r-4 u-tr-width-0_3s-ease" data-style="width:${pct}%; background:${barColor}"></div>
        </div>
        <span class="u-fs-2xs u-bold" data-style="color:${barColor}">${statusText}</span>
      </div>`;

    return `
      <tr class="u-bb-fg-6 u-tr-background-0_2s-ease">
        <td class="u-va-middle u-p-10-8">${stationCell}</td>
        <td class="u-va-middle u-p-10-8">${classCell}</td>
        <td class="u-va-middle u-p-10-8">${partCell}</td>
        <td class="u-va-middle u-p-10-8">${quizCell}</td>
        <td class="u-va-middle u-p-10-8">${challengeCell}</td>
        <td class="u-va-middle u-p-10-8 u-text-center">${progressCell}</td>
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
