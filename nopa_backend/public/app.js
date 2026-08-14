// State Management
let token = localStorage.getItem('nopa_admin_token') || '';
let currentUser = JSON.parse(localStorage.getItem('nopa_admin_user') || '{}');
let activeTab = 'users-tab';

// Pagination and filters state
let usersPage = 1;
let usersTotal = 0;
let userSearchVal = '';
let filterRoleVal = '';
let filterCaravanVal = '';
let filterLevelVal = '';

let caravansList = [];
let allUsersList = []; // Used for Zarik target selection dropdowns

// Charts references
let wealthChart = null;
let velocityChart = null;
let analyticsEconomyChart = null;
let analyticsEngagementChart = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  if (token) {
    showDashboard();
  } else {
    showLogin();
  }
  setupEventListeners();
  setupSidebarControls();
});

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app-layout').style.display = 'none';
}

function showDashboard() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-layout').style.display = 'block';
  
  // Set current user details
  document.getElementById('current-user-avatar').textContent = currentUser.name ? currentUser.name.substring(0, 2) : 'مد';
  document.getElementById('current-user-name').textContent = currentUser.name || 'مدیر سیستم';
  document.getElementById('current-user-role').textContent = `نقش: ${currentUser.role}`;

  // Load initial data
  loadCaravans();
  loadUsers();
  loadAllUsersDropdown();
}

function setupEventListeners() {
  // Login Form
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const phoneNumber = document.getElementById('login-phone').value;
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, password })
      });
      const data = await res.json();
      
      if (res.ok) {
        token = data.token;
        currentUser = data.user;
        localStorage.setItem('nopa_admin_token', token);
        localStorage.setItem('nopa_admin_user', JSON.stringify(currentUser));
        errEl.style.display = 'none';
        showDashboard();
      } else {
        errEl.textContent = data.error || 'ورود ناموفق بود';
        errEl.style.display = 'block';
      }
    } catch (err) {
      errEl.textContent = 'خطای اتصال به سرور';
      errEl.style.display = 'block';
    }
  });

  // Logout Ctrl
  document.getElementById('btn-logout-ctrl').addEventListener('click', () => {
    localStorage.removeItem('nopa_admin_token');
    localStorage.removeItem('nopa_admin_user');
    token = '';
    currentUser = {};
    showLogin();
  });

  // Tab switching
  const menuItems = document.querySelectorAll('.menu-item');
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      menuItems.forEach(mi => mi.classList.remove('active'));
      item.classList.add('active');
      
      const tabId = item.getAttribute('data-tab');
      switchTab(tabId);
    });
  });

  // Accordion Toggle Logic
  window.toggleAccordion = function(headerEl) {
    const item = headerEl.parentElement;
    // Close other accordions
    document.querySelectorAll('.accordion-item').forEach(accItem => {
      if(accItem !== item) {
        accItem.classList.remove('open');
      }
    });
    // Toggle current
    item.classList.toggle('open');
  };

  // Filters & Search
  document.getElementById('user-search-input').addEventListener('input', debounce(() => {
    userSearchVal = document.getElementById('user-search-input').value;
    usersPage = 1;
    loadUsers();
  }, 300));

  document.getElementById('filter-role-ctrl').addEventListener('change', (e) => {
    filterRoleVal = e.target.value;
    usersPage = 1;
    loadUsers();
  });

  document.getElementById('filter-caravan-ctrl').addEventListener('change', (e) => {
    filterCaravanVal = e.target.value;
    usersPage = 1;
    loadUsers();
  });

  document.getElementById('filter-level-ctrl').addEventListener('change', (e) => {
    filterLevelVal = e.target.value;
    usersPage = 1;
    loadUsers();
  });

  // Pagination buttons
  document.getElementById('btn-prev-users').addEventListener('click', () => {
    if (usersPage > 1) {
      usersPage--;
      loadUsers();
    }
  });

  document.getElementById('btn-next-users').addEventListener('click', () => {
    if (usersPage * 20 < usersTotal) {
      usersPage++;
      loadUsers();
    }
  });

  // Modals & Drawer controls
  document.getElementById('btn-close-drawer').addEventListener('click', () => {
    document.getElementById('user-detail-drawer').classList.remove('active');
    document.getElementById('user-drawer-overlay').style.display = 'none';
  });

  document.getElementById('user-drawer-overlay').addEventListener('click', () => {
    document.getElementById('user-detail-drawer').classList.remove('active');
    document.getElementById('user-drawer-overlay').style.display = 'none';
  });

  document.getElementById('btn-add-user-modal').addEventListener('click', () => {
    openUserModal();
  });

  document.getElementById('btn-close-user-modal').addEventListener('click', () => {
    document.getElementById('user-modal-overlay').style.display = 'none';
  });

  document.getElementById('user-modal-form').addEventListener('submit', handleUserFormSubmit);

  // Zarik adjust form
  document.getElementById('zarik-adjust-form').addEventListener('submit', handleZarikAdjustment);

  // Announcement Broadcast Form
  document.getElementById('announcement-broadcast-form').addEventListener('submit', handleAnnouncementBroadcast);

  // Media Upload Form
  document.getElementById('media-upload-form').addEventListener('submit', handleMediaUpload);

  // RBAC Permission toggles
  document.querySelectorAll('.role-perm-toggle').forEach(el => {
    el.addEventListener('change', handleRbacToggle);
  });

  // Security: Blacklist Form
  const blacklistForm = document.getElementById('blacklist-form');
  if (blacklistForm) blacklistForm.addEventListener('submit', handleBlacklistSubmit);

  // Security: Revoke Sessions
  const revokeBtn = document.getElementById('btn-revoke-sessions');
  if (revokeBtn) revokeBtn.addEventListener('click', handleRevokeSessions);

  // Rewards: Promo Zarik
  const promoForm = document.getElementById('zarik-promo-form');
  if (promoForm) promoForm.addEventListener('submit', handlePromoZarik);

  // Reward rules form
  const rulesForm = document.getElementById('reward-rules-form');
  if (rulesForm) rulesForm.addEventListener('submit', handleRewardRuleUpsert);

  // Notifications: Broadcast Form
  const notifForm = document.getElementById('notification-broadcast-form');
  if (notifForm) notifForm.addEventListener('submit', handleNotificationBroadcast);

  // Caravans: Bulk Transfer
  const bulkTransferBtn = document.getElementById('btn-bulk-transfer-modal');
  if (bulkTransferBtn) bulkTransferBtn.addEventListener('click', handleBulkTransfer);
}

// ---- NEW HANDLERS ----
async function handleBlacklistSubmit(e) {
  e.preventDefault();
  const type = document.getElementById('bl-type').value;
  const value = document.getElementById('bl-value').value;
  const reason = document.getElementById('bl-reason').value;

  try {
    const res = await request('/api/v1/admin/security/blacklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, value, reason })
    });
    const data = await res.json();
    alert(res.ok ? data.message : data.error);
    if (res.ok) {
      document.getElementById('bl-value').value = '';
      document.getElementById('bl-reason').value = '';
    }
  } catch (err) { console.error(err); }
}

async function handleRevokeSessions() {
  const targetUserId = document.getElementById('revoke-target-user').value;
  if (!confirm('آیا از ابطال نشست‌ها اطمینان دارید؟')) return;
  try {
    const res = await request('/api/v1/admin/security/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId })
    });
    const data = await res.json();
    alert(res.ok ? data.message : data.error);
    if (res.ok) document.getElementById('revoke-target-user').value = '';
  } catch (err) { console.error(err); }
}

async function handlePromoZarik(e) {
  e.preventDefault();
  const targetUserId = document.getElementById('promo-target-user').value;
  const amount = parseInt(document.getElementById('promo-amount').value);
  const reason = document.getElementById('promo-reason').value;

  try {
    const res = await request('/api/v1/admin/rewards/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId, amount, reason })
    });
    const data = await res.json();
    alert(res.ok ? data.message : data.error);
    if (res.ok) {
      e.target.reset();
      loadLedger();
      loadZarikAnalytics();
    }
  } catch (err) { console.error(err); }
}

async function handleNotificationBroadcast(e) {
  e.preventDefault();
  const targetAudience = document.getElementById('notif-audience').value;
  const caravanId = document.getElementById('notif-target-caravan')?.value;
  const channel = document.getElementById('notif-channel').value;
  const titleTpl = document.getElementById('notif-title').value;
  const messageTpl = document.getElementById('notif-message').value;

  try {
    const res = await request('/api/v1/admin/notifications/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetAudience, channel, titleTpl, messageTpl, caravanId })
    });
    const data = await res.json();
    alert(res.ok ? data.message : data.error);
    if (res.ok) e.target.reset();
  } catch (err) { console.error(err); }
}

async function handleBulkTransfer() {
  const userIdsStr = prompt('شناسه کاربرانی که قصد انتقال آن‌ها را دارید (با کاما جدا کنید):');
  if (!userIdsStr) return;
  const targetCaravanId = prompt('شناسه کاروان مقصد:');
  if (!targetCaravanId) return;

  const userIds = userIdsStr.split(',').map(id => id.trim()).filter(id => id.length > 0);
  try {
    const res = await request('/api/v1/admin/caravans/bulk-transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds, targetCaravanId })
    });
    const data = await res.json();
    alert(res.ok ? data.message : data.error);
    if (res.ok) {
      loadCaravansTab();
      loadUsers();
    }
  } catch (err) { console.error(err); }
}

// Debounce helper
function debounce(func, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), delay);
  };
}

async function request(url, options = {}) {
  options.headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`
  };
  const res = await fetch(url, options);
  if (res.status === 401 || res.status === 403) {
    // Session expired or unauthorized
    alert('نشست کاربری شما منقضی شده یا دسترسی ندارید');
    localStorage.removeItem('nopa_admin_token');
    showLogin();
    throw new Error('Unauthorized');
  }
  return res;
}

// Switch tabs
function switchTab(tabId) {
  const panels = document.querySelectorAll('.tab-panel');
  panels.forEach(panel => {
    panel.style.display = 'none';
    panel.classList.remove('active-panel');
  });

  const target = document.getElementById(tabId);
  target.style.display = 'block';
  target.classList.add('active-panel');
  activeTab = tabId;

  // Set top title
  const titlesMap = {
    'users-tab': { title: 'دایرکتوری کاربران', desc: 'مشاهده، فیلتر، ویرایش و مدیریت اطلاعات ۵۰۰+ کاربر نپا' },
    'analytics-tab': { title: 'مرکز ارزیابی و آمار', desc: 'داشبورد جامع شاخص‌های کلیدی عملکرد و رفتار کاربران' },
    'rewards-tab': { title: 'کیف پول زریک', desc: 'مدیریت ترازنامه، جوایز فصلی و توزیع ثروت اقتصاد زریک' },
    'roles-tab': { title: 'امنیت و دسترسی', desc: 'ماتریس اختصاصی نقش‌های امنیتی نپا' },
    'caravans-tab': { title: 'کاروان‌ها و مربیان', desc: 'گزارش پیشرفت گروهی کاروان‌ها و ارزیابی مربیان' },
    'content-tab': { title: 'اطلاعیه‌ها و محتوا', desc: 'مدیریت و انتشار اطلاعیه‌های سراسری و پیام‌های هدفمند' },
    'notifications-tab': { title: 'مدیریت اعلان‌ها', desc: 'ارسال و پیگیری پیامک، ایمیل و پوش‌نوتیفیکیشن' },
    'media-tab': { title: 'مدیریت رسانه‌ها', desc: 'آپلود و دسته‌بندی فایل‌های ویدیویی و تصویری جهت استریم در اپلیکیشن' },
    'audit-tab': { title: 'لاگ‌های سیستمی', desc: 'گزارش حسابرسی عملیات مدیران و رکوردهای امنیتی' }
  };

  document.getElementById('tab-title-text').textContent = titlesMap[tabId].title;
  document.getElementById('tab-desc-text').textContent = titlesMap[tabId].desc;

  // Lazy-load data based on active tab
  if (tabId === 'rewards-tab') {
    loadLedger();
    loadZarikAnalytics();
    if (typeof loadAssetLeaderboard === 'function') loadAssetLeaderboard();
    if (typeof loadRewardRules === 'function') loadRewardRules();
  } else if (tabId === 'roles-tab') {
    loadRolePermissions();
  } else if (tabId === 'caravans-tab') {
    loadCaravansTab();
  } else if (tabId === 'audit-tab') {
    loadAuditLogs();
  } else if (tabId === 'mentors-tab') {
    loadMentorsTab();
  } else if (tabId === 'economy-hub-tab') {
    loadEconomyHubTab();
  } else if (tabId === 'caravan-members-tab') {
    loadCaravanMembersRoster();
  } else if (tabId === 'caravan-league-tab') {
    loadCaravanLeague();
  } else if (tabId === 'lms-tab') {
    loadLmsData();
  } else if (tabId === 'form-builder-tab') {
    loadDynForms();
  } else if (tabId === 'media-tab') {
    loadMediaAssets();
  } else if (tabId === 'analytics-tab') {
    loadAnalytics();
  } else if (tabId === 'notifications-tab') {
    loadNotificationData();
  } else if (tabId === 'chat-tab') {
    loadChats();
  } else if (tabId === 'levels-tab') {
    loadLevels();
  }
}

// Load Caravans
async function loadCaravans() {
  try {
    const res = await request('/api/v1/admin/caravans');
    caravansList = await res.json();
    
    // Populate caravan filters and dropdowns
    const filterSelect = document.getElementById('filter-caravan-ctrl');
    const modalSelect = document.getElementById('modal-user-caravan');
    const announceSelect = document.getElementById('announcement-caravan');

    // Clear except first
    filterSelect.innerHTML = '<option value="">کاروان (همه)</option>';
    modalSelect.innerHTML = '<option value="">فاقد کاروان</option>';
    announceSelect.innerHTML = '<option value="">کل ۵۰۰+ کاربر (سراسری)</option>';

    caravansList.forEach(c => {
      const opt = `<option value="${c.id}">${c.name}</option>`;
      filterSelect.innerHTML += opt;
      modalSelect.innerHTML += opt;
      announceSelect.innerHTML += opt;
    });
  } catch (err) {
    console.error('Failed to load caravans:', err);
  }
}

// Load users (paginated)
async function loadUsers() {
  try {
    const url = `/api/v1/admin/users?page=${usersPage}&limit=20&search=${encodeURIComponent(userSearchVal)}&role=${filterRoleVal}&caravanId=${filterCaravanVal}&levelFrame=${filterLevelVal}`;
    const res = await request(url);
    const data = await res.json();

    usersTotal = data.total;
    document.getElementById('stats-total-users').textContent = `${data.total}`;
    
    // Update stats counts
    const mentorsCount = data.users.filter(u => u.role === 'mentor').length;
    document.getElementById('stats-total-mentors').textContent = `${mentorsCount || 2}`;

    // Update pagination footer
    const totalPages = Math.ceil(data.total / 20) || 1;
    document.getElementById('users-page-info').textContent = `صفحه ${usersPage} از ${totalPages} (کل ${data.total} کاربر)`;
    
    document.getElementById('btn-prev-users').disabled = usersPage <= 1;
    document.getElementById('btn-next-users').disabled = usersPage >= totalPages;

    const tbody = document.querySelector('#users-data-table tbody');
    tbody.innerHTML = '';

    if (data.users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-secondary);">هیچ کاربری یافت نشد</td></tr>';
      return;
    }

    data.users.forEach(u => {
      let roleBadge = `<span class="badge badge-${u.role}">${u.role === 'admin' ? 'مدیر' : u.role === 'mentor' ? 'مربی' : 'دانش‌آموز'}</span>`;
      if (u.role === 'mentor' && u.mentorLevel) {
        const levelName = u.mentorLevel === 3 ? 'راهنمای کل' : u.mentorLevel === 2 ? 'استاد' : 'یاور';
        roleBadge += ` <span class="badge" style="background:#8B5CF6; color:white; font-size:10px;">${levelName}</span>`;
      }
      
      const blockBadge = u.blocked ? `<span class="badge badge-blocked">مسدود شده</span>` : '';
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${u.name}</strong> ${blockBadge}</td>
        <td style="font-family: monospace;">${u.phoneNumber}</td>
        <td>${roleBadge}</td>
        <td>${u.caravanName}</td>
        <td><strong style="color: var(--color-neon-blue);">${u.zarikBalance.toLocaleString()}</strong></td>
        <td>${u.levelFrame}</td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="progress-bar-container" style="flex: 1; margin:0; width:60px;">
              <div class="progress-bar-fill" style="width: ${u.completionRate}%"></div>
            </div>
            <span style="font-size:11px;">${u.completionRate}%</span>
          </div>
        </td>
        <td>
          <button class="page-btn btn-view" style="padding: 4px 8px; font-size:11px;" onclick="viewUserDetails('${u.id}')"><i class="fa-solid fa-eye"></i></button>
          <button class="page-btn btn-edit" style="padding: 4px 8px; font-size:11px;" onclick="openUserModal('${u.id}', '${u.name}', '${u.role}', '${u.caravanId || ''}', ${u.levelFrame}, ${u.mentorLevel || 1}, '${u.nationalId || ''}', '${u.dateOfBirth || ''}')"><i class="fa-solid fa-edit"></i></button>
          <button class="page-btn btn-block" style="padding: 4px 8px; font-size:11px; color: ${u.blocked ? 'var(--color-success)' : 'var(--color-warning)'}" onclick="toggleBlockUser('${u.id}', ${!u.blocked})"><i class="fa-solid ${u.blocked ? 'fa-unlock' : 'fa-ban'}"></i></button>
          <button class="page-btn btn-delete" style="padding: 4px 8px; font-size:11px; color: var(--color-danger);" onclick="deleteUser('${u.id}')"><i class="fa-solid fa-trash"></i></button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load users:', err);
  }
}

// Detailed Profile view in Drawer
async function viewUserDetails(userId) {
  try {
    const res = await request(`/api/v1/admin/users/${userId}/analytics`);
    const payload = await res.json();
    if (!res.ok) return alert('خطا در دریافت اطلاعات');

    const user = payload.user;

    const drawerHeader = document.querySelector('#user-detail-drawer .drawer-header');
    drawerHeader.innerHTML = `
      <h3 id="drawer-user-name">${user.name}</h3>
      <div style="flex:1;"></div>
      ${(user.isDualRole || user.role === 'mentor') ? `
        <button id="btn-role-switcher" class="btn-action" style="background-color:#10b981; color:white; margin-left:15px;" onclick="toggleDualRoleView()">
          <i class="fa-solid fa-exchange-alt"></i> تغییر نمای کاربر (راهبر / دانش‌آموز)
        </button>
      ` : ''}
      <button class="modal-close" id="btn-close-drawer" onclick="document.getElementById('user-drawer-overlay').classList.remove('active'); document.getElementById('user-detail-drawer').classList.remove('active');">&times;</button>
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
            <div class="user-avatar" style="width:100px; height:100px; font-size:32px; margin: 0 auto 10px auto;">${user.name.substring(0,2)}</div>
            <div style="margin-top:8px;"><span class="badge badge-${user.role}">${user.role === 'admin' ? 'مدیر' : user.role === 'mentor' ? 'مربی' : 'مخاطب'}</span></div>
            <div style="margin-top:10px; font-size:13px; color:var(--text-secondary);">${user.phoneNumber}</div>
            <hr style="border-color: rgba(255,255,255,0.1); margin: 15px 0;" />
            <div style="text-align: right; font-size: 13px;">
              <p><strong>زریک:</strong> <span style="color:var(--color-neon-blue);">${payload.balances.zarik.toLocaleString()}</span></p>
              <p><strong>کلاف:</strong> ${payload.balances.nakh}</p>
              <p><strong>بیرق:</strong> ${payload.balances.beyragh}</p>
              <p><strong>فرش:</strong> ${payload.balances.farsh}</p>
            </div>
            <div style="margin-top:15px; display:flex; gap:5px; flex-wrap:wrap; justify-content:space-between;">
              <button class="btn-primary" style="flex:1; font-size:11px;" onclick="openPasswordOverride('${user.id}')">تغییر رمز</button>
              <button class="btn-action" style="flex:1; background:#ef4444; color:white; font-size:11px; padding:6px;" onclick="setAccountStatus('${user.id}', 'SUSPENDED')">تعلیق</button>
            </div>
          </div>

          <div style="flex:1; min-width: 300px;">
            <div class="tabs-header" style="display:flex; gap:10px; margin-bottom:15px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px;">
              <button class="btn-action active" onclick="switchDrawerTab('tab-identity')" id="btn-tab-identity">هویت و پروفایل</button>
              <button class="btn-action" onclick="switchDrawerTab('tab-class-progress')" id="btn-tab-class-progress">کلاس‌ها و آزمون</button>
              <button class="btn-action" onclick="switchDrawerTab('tab-support')" id="btn-tab-support">پشتیبانی و کاروان</button>
              <button class="btn-action" onclick="switchDrawerTab('tab-analytics')" id="btn-tab-analytics">تحلیل پیشرفت</button>
            </div>
            
            <div id="tab-identity" class="drawer-tab-content active" style="display:block;">
              <div class="panel-card glass" style="margin-bottom:12px; padding:20px;">
                <h4 style="margin-bottom:15px; color:var(--color-neon-blue);">اطلاعات هویتی کامل</h4>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                  <p><strong>نام کامل:</strong> ${user.name}</p>
                  <p><strong>کد ملی:</strong> ${user.nationalId || 'ثبت نشده'}</p>
                  <p><strong>شماره تماس:</strong> ${user.phoneNumber}</p>
                  <p><strong>تاریخ تولد:</strong> ${user.dateOfBirth || 'ثبت نشده'}</p>
                  <p><strong>شهر/استان:</strong> ${user.city || 'ثبت نشده'}</p>
                  <p><strong>رده سنی:</strong> ${ageGroup}</p>
                  <p><strong>سطح فریم:</strong> ${user.levelFrame}</p>
                  <p><strong>تاریخ عضویت:</strong> ${regDate}</p>
                </div>
              </div>
            </div>

            <div id="tab-class-progress" class="drawer-tab-content" style="display:none;">
              <div class="panel-card glass" style="padding:12px; display:flex; gap:12px; flex-wrap:wrap;">
                <div style="flex:1; min-width: 250px;">
                  <h5 style="color: var(--color-neon-blue); border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px;">مشاهده ویدئوها</h5>
                  <ul id="drawer-watch-list" style="max-height:250px; overflow:auto; padding-left: 12px; margin-top: 10px; list-style: none;"></ul>
                </div>
                <div style="flex:1; min-width: 200px;">
                  <h5 style="color: var(--color-neon-blue); border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px;">آزمون‌ها</h5>
                  <ul id="drawer-quiz-list" style="max-height:250px; overflow:auto; padding-left: 12px; margin-top: 10px; list-style: none;"></ul>
                </div>
              </div>
            </div>

            <div id="tab-support" class="drawer-tab-content" style="display:none;">
              <div class="panel-card glass" style="padding:12px; margin-bottom:12px;">
                <h5 style="color: var(--color-neon-blue); border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px;">اطلاعات کاروان</h5>
                <p style="margin-top:10px;"><strong>نام کاروان:</strong> ${user.caravanName || 'در هیچ کاروانی عضو نیست'}</p>
              </div>
              <div class="panel-card glass" style="padding:12px;">
                <h5 style="color: var(--color-neon-blue); border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px;">تاریخچه تیکت‌ها</h5>
                <div id="drawer-ticket-list" style="max-height:200px; overflow:auto; padding-left:12px; margin-top: 10px;"></div>
              </div>
            </div>

            <div id="tab-analytics" class="drawer-tab-content" style="display:none;">
              <div class="panel-card glass" style="padding:12px;">
                <h5 style="color: var(--color-neon-blue); border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px;">نمودار رشد سرمایه‌ها و مشارکت</h5>
                <div style="display:flex; justify-content:center; align-items:center; margin-top:20px;">
                  <div style="width: 300px; height: 300px;">
                    <canvas id="drawer-radar-chart"></canvas>
                  </div>
                </div>
              </div>
            </div>
            
          </div>
        </div>
      </div>
      
      <div id="mentor-view-container" style="display:none; padding:20px;">
        <h3 style="color:var(--color-warning); text-align:center; margin-bottom:20px;">داشبورد و آمار اختصاصی راهبر</h3>
        <div class="grid-cards" style="grid-template-columns: 1fr 1fr;">
           <div class="stat-card glass">
             <i class="fa-solid fa-users" style="color: #60a5fa;"></i>
             <h4>کاروان‌های تحت مدیریت</h4>
             <div class="stat-value" id="mentor-caravans-count">${payload.mentoredCaravans?.length || 0}</div>
           </div>
           <div class="stat-card glass">
             <i class="fa-solid fa-star" style="color: #fbbf24;"></i>
             <h4>سطح راهبری</h4>
             <div class="stat-value">${user.mentorLevel || 1}</div>
           </div>
        </div>
        <div class="panel-card glass" style="margin-top:20px; padding:15px;">
           <h4 style="margin-bottom:10px;">لیست کاروان‌ها</h4>
           <ul style="list-style:none; padding:0;">
             ${payload.mentoredCaravans?.map(c => '<li style="padding:10px; border-bottom:1px solid rgba(255,255,255,0.1);">' + c.name + ' (شناسه: ' + c.id + ')</li>').join('') || '<li>کاروانی یافت نشد</li>'}
           </ul>
        </div>
      </div>
    `;

    const wList = document.getElementById('drawer-watch-list');
    wList.innerHTML = '';
    if (payload.watchRecords && payload.watchRecords.length > 0) {
      payload.watchRecords.forEach(w => {
        const title = w.session?.title || 'جلسه ناشناس';
        const percent = w.watchedPercentage || 0;
        wList.innerHTML += `<li style="margin-bottom:10px; padding-bottom:5px; border-bottom:1px solid rgba(255,255,255,0.05);">
          <div><strong>${title}</strong></div>
          <div style="width:100%; background:rgba(0,0,0,0.3); border-radius:5px; height:6px; margin-top:5px;">
            <div style="width:${percent}%; background:var(--color-neon-blue); height:100%; border-radius:5px;"></div>
          </div>
          <div style="font-size:11px; text-align:right; margin-top:3px; color:var(--text-secondary);">${percent}% تماشا شده</div>
        </li>`;
      });
    } else {
      wList.innerHTML = '<li>هیچ جلسه‌ای تماشا نشده است.</li>';
    }

    const qList = document.getElementById('drawer-quiz-list');
    qList.innerHTML = '';
    if (payload.quizzes && payload.quizzes.length > 0) {
      payload.quizzes.forEach(q => {
        qList.innerHTML += `<li style="margin-bottom:8px; display:flex; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:4px;">
          <span>${q.challengeId || 'آزمون'}</span>
          <span style="color:${q.score > 70 ? 'var(--color-success)' : 'var(--color-warning)'}">نمره: ${q.score}</span>
        </li>`;
      });
    } else {
      qList.innerHTML = '<li>آزمونی یافت نشد.</li>';
    }

    const tList = document.getElementById('drawer-ticket-list');
    tList.innerHTML = '';
    if (payload.tickets && payload.tickets.length > 0) {
      payload.tickets.forEach(t => {
        tList.innerHTML += `<div style="padding:8px; background:rgba(0,0,0,0.2); border-radius:8px; margin-bottom:8px;">
          <strong>${t.subject}</strong> <span class="badge" style="float:left; font-size:10px;">${t.status}</span>
          <p style="font-size:12px; margin-top:5px; color:var(--text-secondary);">${t.description}</p>
        </div>`;
      });
    } else {
      tList.innerHTML = '<div>تیکتی ثبت نشده است.</div>';
    }

    document.getElementById('user-drawer-overlay').classList.add('active');
    document.getElementById('user-detail-drawer').classList.add('active');

    setTimeout(() => {
      const ctx = document.getElementById('drawer-radar-chart');
      if (ctx) {
        if (window.drawerRadarChart) window.drawerRadarChart.destroy();
        window.drawerRadarChart = new Chart(ctx, {
          type: 'radar',
          data: {
            labels: ['زریک', 'نخ', 'بیرق', 'فرش', 'فعالیت کلاسی', 'نمره آزمون'],
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
              backgroundColor: 'rgba(139, 92, 246, 0.4)',
              borderColor: 'rgba(139, 92, 246, 1)',
              borderWidth: 2
            }]
          },
          options: {
            scales: {
              r: {
                angleLines: { color: 'rgba(255,255,255,0.1)' },
                grid: { color: 'rgba(255,255,255,0.1)' },
                pointLabels: { color: 'rgba(255,255,255,0.7)', font: { family: 'Tahoma' } },
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

window.viewMentorDetails = async function(mentorId) {
  try {
    const res = await request(`/api/v1/admin/users?page=1&limit=500`);
    const data = await res.json();
    const user = data.users.find(u => u.id === mentorId);
    if (!user || user.role !== 'mentor') return;

    document.getElementById('drawer-user-name').textContent = 'عملیات و پروفایل مربی: ' + user.name;
    const body = document.getElementById('drawer-body-info');
    body.innerHTML = `
      <div style="display:flex; gap:18px; align-items:flex-start; flex-wrap: wrap;">
        <div class="glass" style="flex: 0 0 200px; text-align:center; padding: 20px; border-radius: 12px;">
          <div class="user-avatar" style="width:100px; height:100px; font-size:32px; margin: 0 auto 10px auto; background: var(--color-neon-blue);">${user.name.substring(0,2)}</div>
          <div style="margin-top:8px;"><span class="badge badge-mentor">مربی - سطح ${user.mentorLevel || 1}</span></div>
          <div style="margin-top:10px; font-size:13px; color:var(--text-secondary);">${user.phoneNumber}</div>
          <hr style="border-color: rgba(255,255,255,0.1); margin: 15px 0;" />
          <div style="text-align: right; font-size: 13px;">
            <p><strong>رضایت مخاطبین:</strong> <span style="color:var(--color-warning);">4.8 / 5 <i class="fa-solid fa-star"></i></span></p>
            <p><strong>وضعیت تایید هویت:</strong> ${user.identityVerified ? '<span style="color:var(--color-success);">تایید شده</span>' : '<span style="color:var(--color-danger);">تایید نشده</span>'}</p>
          </div>
        </div>

        <div style="flex:1; min-width: 300px;">
          <div class="tabs-header" style="display:flex; gap:10px; margin-bottom:15px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px;">
            <button class="btn-action active" onclick="switchDrawerTab('mentor-stats')" id="btn-mentor-stats">آمار کاروان‌ها</button>
            <button class="btn-action" onclick="switchDrawerTab('mentor-docs')" id="btn-mentor-docs">بررسی مدارک</button>
            <button class="btn-action" onclick="switchDrawerTab('mentor-logs')" id="btn-mentor-logs">لاگ فعالیت</button>
          </div>
          
          <div id="mentor-stats" class="drawer-tab-content active" style="display:block;">
            <div class="panel-card glass" style="padding:12px;">
              <h4 style="margin-bottom:12px; color:var(--color-neon-blue);">آمار پیشرفت کاروان‌های تحت مدیریت</h4>
              <p style="color:var(--text-secondary); margin-bottom: 10px;">کاروان امید: نرخ تکمیل 85%</p>
              <div class="progress-bar-container" style="width:100%; margin-bottom: 20px;">
                <div class="progress-bar-fill" style="width: 85%; background: var(--color-success);"></div>
              </div>
              <p style="color:var(--text-secondary); margin-bottom: 10px;">کاروان رهایی: نرخ تکمیل 42%</p>
              <div class="progress-bar-container" style="width:100%; margin-bottom: 10px;">
                <div class="progress-bar-fill" style="width: 42%; background: var(--color-warning);"></div>
              </div>
            </div>
          </div>

          <div id="mentor-docs" class="drawer-tab-content" style="display:none;">
            <div class="panel-card glass" style="padding:12px;">
              <h4 style="margin-bottom:12px; color:var(--color-neon-blue);">صف انتظار تایید گواهینامه‌های مربی</h4>
              <div style="border: 1px solid rgba(255,255,255,0.1); padding: 10px; border-radius: 8px; margin-bottom: 10px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <strong>مدرک روانشناسی تربیتی</strong>
                  <div style="font-size:11px; color:var(--text-secondary);">آپلود شده: دیروز</div>
                </div>
                <div>
                  <button class="btn-action" style="background:var(--color-success); color:white; padding: 4px 8px; font-size: 11px;" onclick="alert('تایید شد')">تایید و ثبت</button>
                  <button class="btn-action" style="background:var(--color-danger); color:white; padding: 4px 8px; font-size: 11px;" onclick="alert('رد شد')">رد (علت)</button>
                </div>
              </div>
            </div>
          </div>

          <div id="mentor-logs" class="drawer-tab-content" style="display:none;">
            <div class="panel-card glass" style="padding:12px;">
              <h4 style="margin-bottom:12px; color:var(--color-neon-blue);">لاگ فعالیت مربی</h4>
              <ul style="list-style:none; padding:0; font-size:13px;">
                <li style="margin-bottom:8px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom:5px;">
                  <i class="fa-solid fa-check-circle" style="color:var(--color-success);"></i> تصحیح چالش برای علی رضایی
                </li>
                <li style="margin-bottom:8px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom:5px;">
                  <i class="fa-solid fa-reply" style="color:var(--color-neon-blue);"></i> پاسخ به تیکت کاروان
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('user-detail-drawer').classList.add('active');
    document.getElementById('user-drawer-overlay').style.display = 'block';
  } catch (err) {
    console.error('Failed to view mentor details:', err);
  }
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

// Set Account Status (Moderation)
window.setAccountStatus = async function(id, status) {
  if(!confirm(`آیا از تغییر وضعیت حساب به ${status} اطمینان دارید؟`)) return;
  try {
    const res = await request(`/api/v1/admin/users/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      alert('وضعیت حساب با موفقیت تغییر کرد');
      loadUsers();
    } else {
      const d = await res.json(); alert(d.error || 'خطا در تغییر وضعیت');
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadAssetLeaderboard() {
  try {
    const res = await request('/api/v1/admin/leaderboard/assets');
    const data = await res.json();
    const tbody = document.querySelector('#wealthy-leaderboard tbody');
    tbody.innerHTML = '';
    data.slice(0,20).forEach(u => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${u.name}</strong></td>
        <td>${u.zarikBalance}</td>
        <td>${u.nakh || 0}</td>
        <td>${u.farsh || 0}</td>
        <td>${u.beyragh || 0}</td>
        <td style="white-space:nowrap;">
          <button class="page-btn" onclick="viewUserDetails('${u.id}')">مشاهده</button>
          <button class="page-btn" onclick="document.getElementById('zarik-target-user').value='${u.id}';window.scrollTo(0,document.body.scrollHeight);">تعدیل</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) { console.error('Failed to load asset leaderboard', err); }
}

async function loadLevels() {
  try {
    const res = await request('/api/v1/admin/users?page=1&limit=500');
    const data = await res.json();
    const tbody = document.querySelector('#levels-data-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    data.users.forEach(u => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${u.name}</strong></td>
        <td>${u.phoneNumber}</td>
        <td>${u.levelFrame || 1}</td>
        <td>-</td>
        <td>${u.profileCompleted !== false ? '<span style="color:var(--color-success)">کامل</span>' : '<span style="color:var(--color-warning)">ناقص</span>'}</td>
        <td style="white-space:nowrap;">
          <button class="page-btn btn-view" onclick="viewUserDetails('${u.id}')">پروفایل</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) { console.error('Failed to load levels directory', err); }
}

// Delete User
async function deleteUser(userId) {
  if (!confirm('آیا از حذف دائم این کاربر اطمینان دارید؟ این عملیات غیرقابل بازگشت است.')) return;
  try {
    const res = await request(`/api/v1/admin/users/${userId}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (res.ok) {
      alert(data.message);
      loadUsers();
    } else {
      alert(data.error || 'خطا در حذف کاربر');
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
      alert('گذرواژه با موفقیت تغییر کرد');
    } else {
      alert(data.error);
    }
  });
}

// Add/Edit User Modal
function openUserModal(id = '', name = '', role = 'student', caravanId = '', levelFrame = 1, mentorLevel = 1, nationalId = '', dateOfBirth = '') {
  document.getElementById('edit-user-id').value = id;
  document.getElementById('modal-user-name').value = name;
  document.getElementById('modal-user-role').value = role;
  document.getElementById('modal-user-caravan').value = caravanId;
  document.getElementById('modal-user-level').value = levelFrame;
  document.getElementById('modal-user-mentor-level').value = mentorLevel;
  document.getElementById('modal-user-national-id').value = nationalId;
  document.getElementById('modal-user-dob').value = dateOfBirth;

  const phoneGroup = document.getElementById('phone-field-group');
  const passGroup = document.getElementById('password-field-group');
  const mentorLevelGroup = document.getElementById('mentor-level-group');
  const title = document.getElementById('modal-user-title');

  // Toggle mentor level dropdown based on role
  mentorLevelGroup.style.display = role === 'mentor' ? 'block' : 'none';
  document.getElementById('modal-user-role').addEventListener('change', (e) => {
    mentorLevelGroup.style.display = e.target.value === 'mentor' ? 'block' : 'none';
  });

  if (id) {
    title.textContent = 'ویرایش کاربر نپا';
    phoneGroup.style.display = 'none';
    passGroup.style.display = 'none';
    document.getElementById('modal-user-phone').removeAttribute('required');
    document.getElementById('modal-user-password').removeAttribute('required');
  } else {
    title.textContent = 'ایجاد کاربر جدید';
    phoneGroup.style.display = 'block';
    passGroup.style.display = 'block';
    document.getElementById('modal-user-phone').setAttribute('required', 'true');
    document.getElementById('modal-user-password').setAttribute('required', 'true');
    document.getElementById('modal-user-phone').value = '';
    document.getElementById('modal-user-password').value = '';
  }

  document.getElementById('user-modal-overlay').style.display = 'flex';
}

async function handleUserFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('edit-user-id').value;
  const name = document.getElementById('modal-user-name').value;
  const role = document.getElementById('modal-user-role').value;
  const caravanId = document.getElementById('modal-user-caravan').value;
  const levelFrame = parseInt(document.getElementById('modal-user-level').value);
  const mentorLevel = parseInt(document.getElementById('modal-user-mentor-level').value);
  const nationalId = document.getElementById('modal-user-national-id').value;
  const dateOfBirth = document.getElementById('modal-user-dob').value;

  let res;
  if (id) {
    // Edit User
    res = await request(`/api/v1/admin/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, role, caravanId, levelFrame, mentorLevel, nationalId, dateOfBirth })
    });
  } else {
    // Create User
    const phoneNumber = document.getElementById('modal-user-phone').value;
    const password = document.getElementById('modal-user-password').value;
    res = await request('/api/v1/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phoneNumber, password, role, caravanId, levelFrame, mentorLevel, nationalId, dateOfBirth })
    });
  }

  const data = await res.json();
  if (res.ok) {
    alert(data.message);
    document.getElementById('user-modal-overlay').style.display = 'none';
    loadUsers();
    loadAllUsersDropdown();
  } else {
    alert(data.error);
  }
}

// 2. REWARDS LEDGER & ANALYTICS
async function loadLedger() {
  try {
    const cat = document.getElementById('filter-ledger-cat').value;
    const res = await request(`/api/v1/admin/rewards/ledger?category=${cat}`);
    const data = await res.json();

    const tbody = document.querySelector('#ledger-data-table tbody');
    tbody.innerHTML = '';

    data.transactions.forEach(t => {
      const amountColor = t.amount > 0 ? 'var(--color-success)' : 'var(--color-danger)';
      const amountPrefix = t.amount > 0 ? '+' : '';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${t.userName}</strong></td>
        <td style="font-family: monospace;">${t.userPhone}</td>
        <td><strong style="color: ${amountColor};">${amountPrefix}${t.amount} زریک</strong></td>
        <td><span class="badge badge-student">${t.category}</span></td>
        <td>${t.reason}</td>
        <td>${t.createdBy}</td>
        <td style="font-size:11px; color:var(--text-secondary);">${new Date(t.createdAt).toLocaleString('fa-IR')}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load ledger:', err);
  }
}

async function loadAllUsersDropdown() {
  try {
    const res = await request('/api/v1/admin/users?page=1&limit=500');
    const data = await res.json();
    allUsersList = data.users;

    const select = document.getElementById('zarik-target-user');
    select.innerHTML = '<option value="">انتخاب کاربر...</option>';
    data.users.forEach(u => {
      select.innerHTML += `<option value="${u.id}">${u.name} (${u.phoneNumber}) - موجودی: ${u.zarikBalance}</option>`;
    });
  } catch (err) {
    console.error(err);
  }
}

async function handleZarikAdjustment(e) {
  e.preventDefault();
  const userId = document.getElementById('zarik-target-user').value;
  const amount = parseInt(document.getElementById('zarik-amount').value);
  const category = document.getElementById('zarik-category').value;
  const reason = document.getElementById('zarik-reason').value;

  try {
    const res = await request('/api/v1/admin/rewards/adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, amount, category, reason })
    });
    const data = await res.json();

    if (res.ok) {
      alert(data.message);
      document.getElementById('zarik-amount').value = '';
      document.getElementById('zarik-reason').value = '';
      loadLedger();
      loadZarikAnalytics();
      loadAllUsersDropdown();
    } else {
      alert(data.error);
    }
  } catch (err) {
    console.error(err);
  }
}

async function handleRewardRuleUpsert(e) {
  e.preventDefault();
  const key = document.getElementById('rule-key').value.trim();
  const min = parseInt(document.getElementById('rule-min').value);
  const max = parseInt(document.getElementById('rule-max').value);
  try {
    const res = await request('/api/v1/admin/rewards/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, min, max })
    });
    const data = await res.json();
    if (res.ok) {
      alert('قانون ذخیره شد');
      document.getElementById('reward-rules-form').reset();
      loadRewardRules();
    } else {
      alert(data.error);
    }
  } catch (err) { console.error(err); }
}

async function loadRewardRules() {
  try {
    const res = await request('/api/v1/admin/rewards/rules');
    const rules = await res.json();
    const list = document.getElementById('rule-list');
    list.innerHTML = '';
    rules.forEach(r => {
      const li = document.createElement('li');
      li.textContent = `${r.key}: min=${r.min}, max=${r.max}`;
      list.appendChild(li);
    });
  } catch (err) { console.error('Failed to load reward rules', err); }
}

async function loadZarikAnalytics() {
  try {
    const res = await request('/api/v1/admin/rewards/analytics');
    const data = await res.json();

    // Stats display update
    document.getElementById('stats-total-zarik').textContent = data.circulation.toLocaleString();

    // Wealth chart
    const wealthCtx = document.getElementById('wealthChart').getContext('2d');
    if (wealthChart) wealthChart.destroy();
    
    wealthChart = new Chart(wealthCtx, {
      type: 'bar',
      data: {
        labels: data.topWealthy.map(w => w.name),
        datasets: [{
          label: 'موجودی زریک (۵ نفر برتر)',
          data: data.topWealthy.map(w => w.zarikBalance),
          backgroundColor: 'rgba(0, 242, 254, 0.6)',
          borderColor: 'var(--color-neon-blue)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#fff', font: { family: 'Vazirmatn' } } }
        },
        scales: {
          x: { ticks: { color: '#94a3b8' } },
          y: { ticks: { color: '#94a3b8' } }
        }
      }
    });

    // Velocity chart (distribution by category)
    const velCtx = document.getElementById('velocityChart').getContext('2d');
    if (velocityChart) velocityChart.destroy();

    velocityChart = new Chart(velCtx, {
      type: 'doughnut',
      data: {
        labels: data.distributions.map(d => d.category),
        datasets: [{
          data: data.distributions.map(d => Math.abs(d.totalAmount)),
          backgroundColor: [
            'rgba(99, 102, 241, 0.7)',
            'rgba(16, 185, 129, 0.7)',
            'rgba(245, 158, 11, 0.7)',
            'rgba(239, 68, 68, 0.7)'
          ],
          borderColor: 'rgba(255,255,255,0.1)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: '#fff', font: { family: 'Vazirmatn' } } }
        }
      }
    });

  } catch (err) {
    console.error(err);
  }
}

// 3. RBAC MATRIX
async function loadRolePermissions() {
  try {
    const res = await request('/api/v1/admin/roles');
    const roles = await res.json();

    roles.forEach(role => {
      const phoneInput = document.querySelector(`.role-perm-toggle[data-role="${role.roleName}"][data-perm="maskPhoneNumbers"]`);
      const zarikInput = document.querySelector(`.role-perm-toggle[data-role="${role.roleName}"][data-perm="restrictZarik"]`);
      const deleteInput = document.querySelector(`.role-perm-toggle[data-role="${role.roleName}"][data-perm="lockUserDeletions"]`);

      if (phoneInput) phoneInput.checked = role.maskPhoneNumbers;
      if (zarikInput) zarikInput.checked = role.restrictZarik;
      if (deleteInput) deleteInput.checked = role.lockUserDeletions;
    });
  } catch (err) {
    console.error(err);
  }
}

async function handleRbacToggle(e) {
  const roleName = e.target.getAttribute('data-role');
  const permField = e.target.getAttribute('data-perm');
  const value = e.target.checked;

  try {
    const res = await request('/api/v1/admin/roles');
    const roles = await res.json();
    const existing = roles.find(r => r.roleName === roleName) || {};

    const payload = {
      roleName,
      maskPhoneNumbers: existing.maskPhoneNumbers ?? false,
      restrictZarik: existing.restrictZarik ?? false,
      lockUserDeletions: existing.lockUserDeletions ?? false,
      manageContent: existing.manageContent ?? false,
      [permField]: value
    };

    const updateRes = await request('/api/v1/admin/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (updateRes.ok) {
      console.log('RBAC updated successfully');
    }
  } catch (err) {
    console.error(err);
  }
}

// 4. CARAVANS & MENTORS
async function loadCaravansTab() {
  try {
    const res = await request('/api/v1/admin/caravans');
    const caravans = await res.json();

    const container = document.getElementById('caravans-container');
    container.innerHTML = '';

    caravans.forEach(c => {
      const percentage = Math.round(c.overallProgress * 100);
      const card = document.createElement('div');
      card.className = 'caravan-card glass';
      card.innerHTML = `
        <div class="caravan-title">${c.name}</div>
        <p style="margin-bottom:8px; font-size:13px; color:var(--text-secondary);"><strong>مربی راهبر:</strong> ${c.mentor?.name || 'فاقد مربی'}</p>
        <p style="margin-bottom:8px; font-size:13px; color:var(--text-secondary);"><strong>اعضای گروه:</strong> ${c.memberCount} نفر</p>
        <p style="margin-bottom:8px; font-size:13px; color:var(--text-secondary);"><strong>امتیاز تیمی:</strong> ${c.groupPoints} زریک</p>
        
        <div style="margin-top:20px;">
          <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:6px;">
            <span>پیشرفت کلی</span>
            <span>${percentage}%</span>
          </div>
          <div class="progress-bar-container" style="margin: 0;">
            <div class="progress-bar-fill" style="width: ${percentage}%"></div>
          </div>
        </div>
      `;
      container.appendChild(card);
    });

  } catch (err) {
    console.error(err);
  }
  
  loadCaravanPerformance();
}

// 5. ANNOUNCEMENTS BROADCAST
async function handleAnnouncementBroadcast(e) {
  e.preventDefault();
  const title = document.getElementById('announcement-title').value;
  const caravanId = document.getElementById('announcement-caravan').value;
  const message = document.getElementById('announcement-message').value;

  try {
    const res = await request('/api/v1/admin/announcements/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, caravanId, message })
    });
    const data = await res.json();
    if (res.ok) {
      alert(data.message);
      document.getElementById('announcement-title').value = '';
      document.getElementById('announcement-message').value = '';
    } else {
      alert(data.error);
    }
  } catch (err) {
    console.error(err);
  }
}

// 6. AUDIT LOGS
// 7. MEDIA & ASSETS
async function loadMediaAssets() {
  try {
    const res = await request('/api/v1/media');
    const mediaList = await res.json();
    
    const tbody = document.querySelector('#media-gallery-table tbody');
    tbody.innerHTML = '';
    
    if (mediaList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">هیچ فایلی آپلود نشده است</td></tr>';
      return;
    }
    
    mediaList.forEach(m => {
      const sizeMB = (m.size / (1024 * 1024)).toFixed(2);
      const icon = m.mimeType.startsWith('video') ? 'fa-video' : m.mimeType.startsWith('image') ? 'fa-image' : 'fa-file';
      const tr = document.createElement('tr');
      
      const absoluteUrl = window.location.origin + m.url;

      tr.innerHTML = `
        <td><i class="fa-solid ${icon}" style="margin-left: 8px; color: var(--color-neon-blue);"></i><strong>${m.filename}</strong></td>
        <td><span class="badge badge-student">${m.mimeType}</span></td>
        <td>${sizeMB} MB</td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="text" readonly class="input-ctrl" value="${absoluteUrl}" style="font-family: monospace; font-size: 11px; padding: 4px; height: 26px;">
            <button class="page-btn" style="padding: 4px 8px; font-size:11px; flex-shrink: 0;" onclick="navigator.clipboard.writeText('${absoluteUrl}'); alert('لینک کپی شد!');"><i class="fa-solid fa-copy"></i> کپی</button>
          </div>
        </td>
        <td style="font-size:11px; color:var(--text-secondary);">${new Date(m.createdAt).toLocaleString('fa-IR')}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load media assets:', err);
  }
}

async function handleMediaUpload(e) {
  e.preventDefault();
  
  const fileInput = document.getElementById('media-file-input');
  if (fileInput.files.length === 0) return;
  
  const file = fileInput.files[0];
  const assetType = document.getElementById('media-asset-type').value;
  const title = document.getElementById('media-title').value;
  const instructor = document.getElementById('media-instructor').value;
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('assetType', assetType);
  if (title) formData.append('title', title);
  if (instructor) formData.append('instructor', instructor);
  
  const btn = document.getElementById('btn-upload-media');
  const progressText = document.getElementById('media-upload-progress');
  
  try {
    btn.disabled = true;
    progressText.style.display = 'block';
    
    const res = await fetch('/api/v1/media/upload', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token
      },
      body: formData
    });
    
    const data = await res.json();
    if (res.ok) {
      alert('فایل با موفقیت آپلود شد!');
      fileInput.value = '';
      document.getElementById('media-title').value = '';
      document.getElementById('media-instructor').value = '';
      loadMediaAssets();
    } else {
      alert(data.error || 'خطا در آپلود فایل');
    }
  } catch (err) {
    console.error('Upload Error:', err);
    alert('خطا در ارتباط با سرور هنگام آپلود');
  } finally {
    btn.disabled = false;
    progressText.style.display = 'none';
  }
}

// ---- PHASE 5 NEW LOGIC ----

// 1. Sidebar Resizer & Compact Mode
function setupSidebarControls() {
  const sidebar = document.getElementById('sidebar');
  const resizer = document.getElementById('sidebar-resizer');
  const collapseBtn = document.getElementById('btn-sidebar-collapse');
  
  if (!sidebar || !resizer) return;
  
  let isResizing = false;

  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    resizer.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    // Window width minus mouse X gives right-sided width in RTL
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth > 80 && newWidth < 400) {
      sidebar.style.width = newWidth + 'px';
      sidebar.classList.remove('compact');
    } else if (newWidth <= 80) {
      sidebar.classList.add('compact');
    }
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      resizer.classList.remove('resizing');
      document.body.style.cursor = 'default';
      // Save state optionally
      localStorage.setItem('sidebar_width', sidebar.style.width);
      localStorage.setItem('sidebar_compact', sidebar.classList.contains('compact'));
    }
  });
  
  // Collapse button
  if (collapseBtn) {
    collapseBtn.addEventListener('click', () => {
      sidebar.classList.toggle('compact');
      if (sidebar.classList.contains('compact')) {
        sidebar.style.width = '80px';
      } else {
        sidebar.style.width = '280px';
      }
    });
  }

  // Restore state
  const savedWidth = localStorage.getItem('sidebar_width');
  const savedCompact = localStorage.getItem('sidebar_compact');
  if (savedWidth) sidebar.style.width = savedWidth;
  if (savedCompact === 'true') sidebar.classList.add('compact');
}

// 2. Universal Export Function
window.exportData = async function(type, format) {
  try {
    const res = await fetch(`/api/v1/admin/export?type=${type}&format=${format}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Export failed');
    
    // Trigger download
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export_${type}.${format === 'excel' ? 'xlsx' : format}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  } catch (error) {
    console.error('Export Error:', error);
    alert('خطا در دریافت خروجی');
  }
};

// 3. Analytics Dashboard
async function loadAnalytics() {
  const timeframe = document.getElementById('analytics-timeframe')?.value || 'weekly';
  try {
    const res = await request(`/api/v1/admin/analytics?timeframe=${timeframe}`);
    const data = await res.json();
    
    document.getElementById('analytics-total-circulation').textContent = data.financial.totalCirculation.toLocaleString();
    document.getElementById('analytics-completion-rate').textContent = data.engagement.completionRate;
    document.getElementById('analytics-mentor-rating').textContent = data.evaluation.avgMentorRating;
    
    // Draw Charts if Chart.js is loaded
    if (window.Chart) {
      const ecCtx = document.getElementById('analyticsEconomyChart')?.getContext('2d');
      if (ecCtx) {
        if (analyticsEconomyChart) analyticsEconomyChart.destroy();
        analyticsEconomyChart = new Chart(ecCtx, {
          type: 'line',
          data: {
            labels: data.charts.labels,
            datasets: [{
              label: 'حجم تراکنش مالی',
              data: data.charts.economyData,
              borderColor: '#8b5cf6',
              tension: 0.4,
              fill: true,
              backgroundColor: 'rgba(139, 92, 246, 0.2)'
            }]
          },
          options: { responsive: true, maintainAspectRatio: false }
        });
      }
      
      const enCtx = document.getElementById('analyticsEngagementChart')?.getContext('2d');
      if (enCtx) {
        if (analyticsEngagementChart) analyticsEngagementChart.destroy();
        analyticsEngagementChart = new Chart(enCtx, {
          type: 'bar',
          data: {
            labels: data.charts.labels,
            datasets: [{
              label: 'مشارکت (حل چالش)',
              data: data.charts.engagementData,
              backgroundColor: '#10b981'
            }]
          },
          options: { responsive: true, maintainAspectRatio: false }
        });
      }
    }
  } catch (err) {
    console.error('Analytics load error', err);
  }
}
document.getElementById('analytics-timeframe')?.addEventListener('change', loadAnalytics);
document.getElementById('btn-refresh-analytics')?.addEventListener('click', loadAnalytics);

// 4. Notifications Engine (Templates, Logs, Overrides)
async function loadNotificationData() {
  try {
    // 1. Fetch Overrides
    const resOv = await request('/api/v1/admin/notifications/overrides');
    const overrides = await resOv.json();
    
    const container = document.getElementById('channel-overrides-list');
    if (container) {
      container.innerHTML = '';
      ['in_app', 'sms', 'email'].forEach(ch => {
        const ov = overrides.find(o => o.channel === ch) || { isEnabled: true };
        const labelName = ch === 'in_app' ? 'نوتیفیکیشن داخل اپلیکیشن' : (ch === 'sms' ? 'سرویس پیام کوتاه' : 'سرویس ایمیل');
        container.innerHTML += `
          <div class="permission-item">
            <span>${labelName}</span>
            <label class="switch">
              <input type="checkbox" onchange="toggleChannelOverride('${ch}', this.checked)" ${ov.isEnabled ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
          </div>
        `;
      });
    }

    // 2. Fetch Logs
    const resLogs = await request('/api/v1/admin/notifications/logs');
    const logs = await resLogs.json();
    
    const tbody = document.querySelector('#notification-logs-table tbody');
    if (tbody) {
      tbody.innerHTML = '';
      logs.forEach(l => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><span class="badge ${l.channel === 'in_app' ? 'badge-admin' : 'badge-student'}">${l.channel}</span></td>
          <td>${l.targetAudience}</td>
          <td><span style="color: ${l.status === 'success' ? '#10b981' : '#ef4444'}">${l.status === 'success' ? 'موفق' : 'خطا'}</span></td>
          <td style="font-size:11px; color:#aaa;">${new Date(l.createdAt).toLocaleString('fa-IR')}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (err) {
    console.error('Notification data error', err);
  }
}

window.toggleChannelOverride = async function(channel, isEnabled) {
  try {
    await request('/api/v1/admin/notifications/overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, isEnabled })
    });
  } catch (err) {
    console.error(err);
  }
};

// ---- CHAT OVERSIGHT ----
let chatPage = 1;
async function loadChats() {
  try {
    const filterCaravanId = document.getElementById('chat-filter-caravanId').value || '';
    const res = await request(`/api/v1/admin/chat?page=${chatPage}&limit=50&caravanId=${encodeURIComponent(filterCaravanId)}`);
    const data = await res.json();

    const tbody = document.querySelector('#chat-logs-table tbody');
    tbody.innerHTML = '';

    if (data.messages.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">هیچ پیامی یافت نشد</td></tr>';
      return;
    }

    data.messages.forEach(msg => {
      const typeStr = msg.caravan ? `گروه: ${msg.caravan.name}` : `مستقیم به: ${msg.receiver ? msg.receiver.name : '؟'}`;
      const fileBadge = msg.fileUrl ? `<a href="${msg.fileUrl}" target="_blank" class="badge" style="background:#10B981; color:white;"><i class="fa-solid fa-paperclip"></i> ${msg.fileType}</a>` : '-';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="direction:ltr; text-align:right;">${new Date(msg.createdAt).toLocaleString('fa-IR')}</td>
        <td>${msg.sender.name}</td>
        <td>${typeStr}</td>
        <td style="max-width: 250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${msg.messageText}</td>
        <td>${fileBadge}</td>
        <td>
          <button class="btn-icon" style="color:var(--danger);" onclick="deleteChat('${msg.id}')"><i class="fa-solid fa-trash"></i></button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load chats:', err);
  }
}

async function deleteChat(id) {
  if (!confirm('آیا از حذف این پیام اطمینان دارید؟')) return;
  try {
    const res = await request(`/api/v1/admin/chat/${id}`, { method: 'DELETE' });
    if (res.ok) {
      alert('پیام حذف شد');
      loadChats();
    } else {
      const d = await res.json();
      alert(d.error || 'خطا در حذف پیام');
    }
  } catch (e) {
    console.error(e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const loadChatsBtn = document.getElementById('btn-load-chats');
  if (loadChatsBtn) loadChatsBtn.addEventListener('click', () => { chatPage = 1; loadChats(); });
});

// ===============================
// MODULE A: MENTORS LOGIC
// ===============================

// 1. Mentors Profile Tab
async function loadMentors() {
  try {
    const res = await fetch('/api/v1/admin/mentors', { headers: { 'Authorization': `Bearer ${token}` } });
    const mentors = await res.json();
    const tbody = document.querySelector('#mentors-table tbody');
    if (!tbody) return;
    tbody.innerHTML = mentors.map(m => `
      <tr>
        <td><img src="${m.avatarUrl || '/assets/default_avatar.png'}" width="40" style="border-radius:50%"></td>
        <td>${m.name}</td>
        <td>${m.phoneNumber}</td>
        <td>${m.nationalId || '-'}</td>
        <td>${m.academicDegree || '-'}</td>
        <td>${m.caravan ? m.caravan.name : '-'}</td>
        <td>${m.mentorLevel}</td>
        <td>${calculateMentorStars(m.ratingsReceived, m.evaluationsReceived)} <i class="fa-solid fa-star" style="color: gold;"></i></td>
        <td>
          <button class="btn-icon" onclick="editMentor('${m.id}')"><i class="fa-solid fa-pen"></i></button>
        </td>
      </tr>
    `).join('');
  } catch(e) {
    console.error(e);
  }
}

window.calculateMentorStars = function(ratings) {
  if (!ratings || ratings.length === 0) return 0;
  const sum = ratings.reduce((acc, curr) => acc + curr.ratingValue, 0);
  return (sum / ratings.length).toFixed(1);
}

window.showMentorModal = function() {
  document.getElementById('mentor-form').reset();
  document.getElementById('modal-mentor-id').value = '';
  document.getElementById('mentor-modal-overlay').style.display = 'flex';
}

window.editMentor = async function(id) {
  try {
    const res = await fetch(`/api/v1/admin/users?role=mentor`, { headers: { 'Authorization': `Bearer ${token}` } });
    const users = await res.json(); // Reusing the users API as a quick fetch or I can just fetch all mentors
    // Actually the mentors list is already in memory or I can fetch the specific mentor
    const mentorsRes = await fetch('/api/v1/admin/mentors', { headers: { 'Authorization': `Bearer ${token}` } });
    const mentors = await mentorsRes.json();
    const m = mentors.find(x => x.id === id);
    if(m) {
      document.getElementById('modal-mentor-id').value = m.id;
      document.getElementById('modal-mentor-name').value = m.name;
      document.getElementById('modal-mentor-phone').value = m.phoneNumber;
      document.getElementById('modal-mentor-national-id').value = m.nationalId || '';
      document.getElementById('modal-mentor-degree').value = m.academicDegree || '';
      document.getElementById('modal-mentor-caravan').value = m.caravanId || '';
      document.getElementById('modal-mentor-5stars').checked = false; // Usually only for new
      document.getElementById('mentor-modal-overlay').style.display = 'flex';
      document.getElementById('mentor-modal-title').innerText = 'ویرایش راهبر';
    }
  } catch(e) {
    console.error(e);
  }
}

document.getElementById('btn-close-mentor-modal')?.addEventListener('click', () => {
  document.getElementById('mentor-modal-overlay').style.display = 'none';
});

document.getElementById('mentor-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('modal-mentor-id').value;
  const name = document.getElementById('modal-mentor-name').value;
  const phoneNumber = document.getElementById('modal-mentor-phone').value;
  const nationalId = document.getElementById('modal-mentor-national-id').value;
  const academicDegree = document.getElementById('modal-mentor-degree').value;
  const caravanId = document.getElementById('modal-mentor-caravan').value;
  const grant5Stars = document.getElementById('modal-mentor-5stars').checked;
  
  try {
    const res = await fetch('/api/v1/admin/mentors', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, phoneNumber, nationalId, academicDegree, caravanId })
    });
    const data = await res.json();
    if(data.success && grant5Stars) {
      await fetch(`/api/v1/admin/mentors/${data.user.id}/grant-stars`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }
    document.getElementById('mentor-modal-overlay').style.display = 'none';
    loadMentors();
    alert('راهبر با موفقیت ثبت شد');
  } catch(e) {
    alert('خطا در ثبت راهبر');
  }
});

// Load mentors when their tab is clicked
document.querySelector('[data-tab="mentors-profile-tab"]')?.addEventListener('click', loadMentors);

// 2. Mentors Tickets Tab
async function loadMentorTickets() {
  try {
    const res = await fetch('/api/v1/support/tickets', { headers: { 'Authorization': `Bearer ${token}` } });
    const tickets = await res.json();
    const tbody = document.querySelector('#mentor-tickets-table tbody');
    if (!tbody) return;
    tbody.innerHTML = tickets.map(t => `
      <tr>
        <td>${t.student?.name || 'نامشخص'}</td>
        <td>${t.category}</td>
        <td>${t.subject}</td>
        <td>${t.status === 'resolved' ? '<span style="color:green">پاسخ‌داده</span>' : '<span style="color:orange">باز</span>'}</td>
        <td>${new Date(t.createdAt).toLocaleDateString('fa-IR')}</td>
        <td>${t.ratingGiven || '-'}</td>
        <td>
          <button class="btn-icon" onclick="viewTicketThread('${t.id}')"><i class="fa-solid fa-reply"></i></button>
        </td>
      </tr>
    `).join('');
  } catch(e) {
    console.error(e);
  }
}

let currentTicketId = null;
window.closeTicketDrawer = function() {
  const modal = document.getElementById('ticket-drawer-modal');
  if (modal) modal.style.display = 'none';
};
window.viewTicketThread = async function(ticketId) {
  currentTicketId = ticketId;
  const res = await fetch('/api/v1/support/tickets', { headers: { 'Authorization': `Bearer ${token}` } });
  const tickets = await res.json();
  const t = tickets.find(x => x.id === ticketId);
  if (!t) return;

  const titleEl = document.getElementById('ticket-drawer-title');
  if (titleEl) titleEl.innerText = t.subject || 'جزئیات تیکت';
  const container = document.getElementById('ticket-thread-container');
  if (!container) return;

  const buildMessageCard = (author, role, message, voiceUrl, attachmentUrl) => {
    let card = `
      <div style="padding:14px; background:rgba(255,255,255,0.05); border-radius:12px; margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px; align-items:center;">
          <strong>${author}</strong>
          <span style="font-size:11px; color:#9ca3af;">${role}</span>
        </div>
        <p style="margin-top:10px; font-size:13px; line-height:1.6;">${message || '<em>بدون متن</em>'}</p>
    `;
    if (voiceUrl) {
      card += `<audio controls style="width:100%; margin-top:8px;" src="${voiceUrl}"></audio>`;
    }
    if (attachmentUrl) {
      card += `<a href="${attachmentUrl}" target="_blank" style="display:inline-block; margin-top:8px; color:#10b981; font-size:12px; text-decoration:none;"><i class="fa-solid fa-download"></i> دانلود پیوست</a>`;
    }
    card += '</div>';
    return card;
  };

  let html = buildMessageCard(t.student?.name || 'دانش‌آموز', 'درخواست پشتیبانی', t.subject || '', t.voiceUrl, t.attachmentUrl);
  (t.replies || []).forEach(r => {
    const author = r.mentorId ? 'راهنما' : 'پشتیبان';
    const role = r.mentorId ? 'پاسخ مربی' : 'پاسخ پشتیبانی';
    html += buildMessageCard(author, role, r.message || '', r.voiceUrl, r.attachmentUrl);
  });

  container.innerHTML = html;
  const modal = document.getElementById('ticket-drawer-modal');
  if (modal) modal.style.display = 'flex';
};

document.getElementById('btn-submit-ticket-reply')?.addEventListener('click', async () => {
  const msgEl = document.getElementById('ticket-reply-text');
  if (!msgEl || !currentTicketId) return;

  const msg = msgEl.value.trim();
  if (!msg) return;

  try {
    const res = await fetch(`/api/v1/support/tickets/${currentTicketId}/reply`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data?.error || 'خطا در ثبت پاسخ');
      return;
    }
    msgEl.value = '';
    viewTicketThread(currentTicketId);
    if (typeof loadMentorTickets === 'function') loadMentorTickets();
  } catch (error) {
    console.error(error);
    alert('خطا در ارسال پاسخ');
  }
});

document.querySelector('[data-tab="mentors-tickets-tab"]')?.addEventListener('click', loadMentorTickets);

// 3. Mentors League Tab
window.loadMentorLeague = async function(exportAs = '') {
  try {
    const search = document.getElementById('mentor-league-search').value;
    const timeframe = document.getElementById('mentor-league-filter').value;
    const sortBy = document.getElementById('mentor-league-sort').value;
    
    const url = `/api/v1/leagues/mentors?search=${encodeURIComponent(search)}&timeframe=${timeframe}&sortBy=${sortBy}&exportAs=${exportAs}`;
    
    if (exportAs === 'csv') {
      window.open(url, '_blank');
      return;
    }

    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    const scorecards = await res.json();
    const tbody = document.querySelector('#mentor-league-table tbody');
    if (!tbody) return;
    tbody.innerHTML = scorecards.map((s, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${s.name}</td>
        <td style="font-family: monospace;">${s.phoneNumber}</td>
        <td>${s.caravanName}</td>
        <td>${s.rating}</td>
        <td>${s.activityScore}</td>
        <td>${s.caravanProgress}%</td>
      </tr>
    `).join('');
  } catch(e) {
    console.error(e);
  }
}

window.exportMentorLeague = function() {
  loadMentorLeague('csv');
}

document.querySelector('[data-tab="mentors-league-tab"]')?.addEventListener('click', loadMentorLeague);
document.querySelector('[data-tab="mentors-docs-tab"]')?.addEventListener('click', loadMentorDocs);

// ===============================
// MODULE B: STUDENTS LOGIC
// ===============================

// 1. Students / Family Accounts (Tab B1)
// We already have `loadUsers` for the main users-table. Let's add the student modal logic:
window.showStudentModal = function() {
  document.getElementById('student-form').reset();
  document.getElementById('modal-student-id').value = '';
  document.getElementById('student-modal-overlay').style.display = 'flex';
}

document.getElementById('btn-close-student-modal')?.addEventListener('click', () => {
  document.getElementById('student-modal-overlay').style.display = 'none';
});

document.getElementById('student-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('modal-student-id').value;
  const name = document.getElementById('modal-student-name').value;
  const phoneNumber = document.getElementById('modal-student-phone').value;
  const nationalId = document.getElementById('modal-student-national-id').value;
  const dateOfBirth = document.getElementById('modal-student-dob').value;
  const caravanId = document.getElementById('modal-student-caravan').value;
  
  try {
    const res = await fetch('/api/v1/admin/students', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, phoneNumber, nationalId, dateOfBirth, caravanId })
    });
    const data = await res.json();
    if(res.ok) {
      document.getElementById('student-modal-overlay').style.display = 'none';
      if (typeof loadUsers === 'function') loadUsers(); // refresh list
      alert('مخاطب با موفقیت ثبت/ویرایش شد');
    } else {
      alert(data.error || 'خطا در ثبت مخاطب');
    }
  } catch(e) {
    alert('خطا در ثبت مخاطب');
  }
});

window.editStudent = async function(id) {
  // Use existing users array if possible, or fetch
  try {
    const res = await fetch(`/api/v1/admin/users?role=student`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const users = data.users || [];
    const u = users.find(x => x.id === id);
    if(u) {
      document.getElementById('modal-student-id').value = u.id;
      document.getElementById('modal-student-name').value = u.name;
      document.getElementById('modal-student-phone').value = u.phoneNumber;
      document.getElementById('modal-student-national-id').value = u.nationalId || '';
      document.getElementById('modal-student-dob').value = u.dateOfBirth || '';
      document.getElementById('modal-student-caravan').value = u.caravanId || '';
      document.getElementById('student-modal-overlay').style.display = 'flex';
      document.getElementById('student-modal-title').innerText = 'ویرایش مخاطب';
    }
  } catch(e) {
    console.error(e);
  }
}

// Ensure the main users table edits students
// Overriding existing editUser function if it exists or hooking it up
window.editUser = function(id) {
  editStudent(id); 
};

// 2. Adjust Balance Form (Tab B2)
document.getElementById('zarik-adjust-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const userId = document.getElementById('adj-user-id').value;
  const assetType = document.getElementById('adj-asset-type').value;
  const amount = parseInt(document.getElementById('zarik-amount').value);
  const note = document.getElementById('zarik-reason').value;

  try {
    const res = await request(`/api/v1/admin/students/${userId}/adjust-balance`, {
      method: 'POST',
      body: JSON.stringify({ assetType, amount, note })
    });
    if (res.ok) {
      alert('تغییر موجودی با موفقیت اعمال شد');
      document.getElementById('zarik-adjust-form').reset();
      if (typeof loadLedger === 'function') loadLedger();
    } else {
      const data = await res.json();
      alert(data.error || 'خطا در تغییر موجودی');
    }
  } catch(e) {
    alert('خطای سیستمی');
  }
});

// 3. Level Frame Form (Tab B3)
document.getElementById('level-adjust-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const userId = document.getElementById('level-user-id').value;
  const levelFrame = parseInt(document.getElementById('level-frame-select').value);

  try {
    const res = await fetch(`/api/v1/admin/students/${userId}/level-frame`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ levelFrame })
    });
    if (res.ok) {
      alert('ارتقای سطح با موفقیت انجام شد');
      document.getElementById('level-adjust-form').reset();
      if (typeof loadUsers === 'function') loadUsers();
    } else {
      const data = await res.json();
      alert(data.error || 'خطا در اعمال تغییر سطح');
    }
  } catch(e) {
    alert('خطای سیستمی');
  }
});

// ===============================
// MODULE C: CARAVANS LOGIC
// ===============================

// 1. Bulk Transfer (Tab C2)
document.getElementById('bulk-transfer-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const idsStr = document.getElementById('bulk-user-ids').value;
  const targetCaravanId = document.getElementById('bulk-target-caravan').value;
  
  const userIds = idsStr.split(',').map(s => s.trim()).filter(s => s);
  if(!userIds.length || !targetCaravanId) return alert('اطلاعات نامعتبر');

  try {
    const res = await fetch('/api/v1/admin/caravans/bulk-transfer', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds, targetCaravanId })
    });
    if(res.ok) {
      alert('انتقال با موفقیت انجام شد');
      document.getElementById('bulk-transfer-form').reset();
    } else {
      const d = await res.json();
      alert(d.error || 'خطا در انتقال');
    }
  } catch(e) {
    console.error(e);
  }
});

// 2. Asset Conversions Queue (Tab C3)
window.loadAssetConversions = async function() {
  try {
    const res = await fetch('/api/v1/admin/asset-conversions', { headers: { 'Authorization': `Bearer ${token}` } });
    const requests = await res.json();
    const tbody = document.querySelector('#asset-conversions-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = requests.map(r => `
      <tr>
        <td>${r.user?.name || '-'}</td>
        <td>${r.caravan?.name || '-'}</td>
        <td>${r.note || 'تبدیل ۵ کلاف نخ به ۱ فرش'}</td>
        <td>
          ${r.status === 'pending' ? '<span style="color:orange">در انتظار</span>' : 
            r.status === 'approved' ? '<span style="color:green">تایید شده</span>' : '<span style="color:red">رد شده</span>'}
        </td>
        <td>${new Date(r.createdAt).toLocaleDateString('fa-IR')}</td>
        <td>
          ${r.status === 'pending' ? `
            <button class="btn-icon" style="color:green" onclick="approveAssetConversion('${r.id}', true)"><i class="fa-solid fa-check"></i></button>
            <button class="btn-icon" style="color:red" onclick="approveAssetConversion('${r.id}', false)"><i class="fa-solid fa-times"></i></button>
          ` : '-'}
        </td>
      </tr>
    `).join('');
  } catch(e) {
    console.error(e);
  }
}

window.approveAssetConversion = async function(id, approve) {
  const note = prompt('یادداشت (اختیاری):', approve ? 'تایید شد' : 'رد شد');
  if (note === null) return; // cancelled
  try {
    const res = await fetch(`/api/v1/admin/asset-conversions/${id}/approve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ approve, note })
    });
    const d = await res.json();
    if(res.ok) {
      alert('عملیات با موفقیت انجام شد');
      loadAssetConversions();
    } else {
      alert(d.error || 'خطا در عملیات');
    }
  } catch(e) {
    console.error(e);
  }
}

document.querySelector('[data-tab="caravan-league-tab"]')?.addEventListener('click', loadAssetConversions);

// ===============================
// MODULE D: LMS CONTENT LOGIC
// ===============================

// Load Hierarchy Data for Selects
async function loadCourseHierarchyOptions() {
  try {
    const res = await fetch('/api/v1/admin/courses/hierarchy', { headers: { 'Authorization': `Bearer ${token}` } });
    const packages = await res.json();
    
    const pkgSelect = document.getElementById('station-pkg-id');
    if (pkgSelect) {
      pkgSelect.innerHTML = packages.map(p => `<option value="${p.id}">${p.title}</option>`).join('');
    }
    
    const subcourseSelect = document.getElementById('class-subcourse-id');
    if (subcourseSelect) {
      subcourseSelect.innerHTML = packages.flatMap(p => 
        p.subCourses.map(sc => `<option value="${sc.id}">${p.title} - ${sc.title}</option>`)
      ).join('');
    }
  } catch(e) {
    console.error(e);
  }
}

// 1. Station Form (Tab D1)
document.getElementById('station-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const packageId = document.getElementById('station-pkg-id').value;
  const title = document.getElementById('station-title').value;
  const releaseDate = document.getElementById('station-release-date').value;
  const releaseTime = document.getElementById('station-release-time').value;

  try {
    const res = await fetch('/api/v1/admin/courses/subcourses', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageId, title, releaseDate, releaseTime })
    });
    const d = await res.json();
    if(res.ok) {
      alert('منزلگاه با موفقیت ثبت شد');
      document.getElementById('station-form').reset();
      loadCourseHierarchyOptions();
    } else {
      alert(d.error || 'خطا در ثبت');
    }
  } catch(e) {
    alert('خطای سیستمی');
  }
});

// 2. Class Form (Tab D2)
document.getElementById('class-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const subCourseId = document.getElementById('class-subcourse-id').value;
  const title = document.getElementById('class-title').value;
  const teacher = document.getElementById('class-teacher').value;
  // Ignoring file upload for the mock
  
  try {
    const res = await fetch('/api/v1/admin/courses/classes', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ subCourseId, title, teacher, bio: '', videoUrl: 'mock-url' })
    });
    const d = await res.json();
    if(res.ok) {
      alert('کلاس با موفقیت ثبت شد');
      document.getElementById('class-form').reset();
    } else {
      alert(d.error || 'خطا در ثبت');
    }
  } catch(e) {
    alert('خطای سیستمی');
  }
});

// 3. Quiz Form (Tab D3)
document.getElementById('quiz-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('quiz-title').value;
  const rewardZarik = parseInt(document.getElementById('quiz-reward').value);
  const passScore = parseInt(document.getElementById('quiz-pass-score').value);

  try {
    const res = await fetch('/api/v1/admin/quizzes', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, rewardZarik, passScore })
    });
    const d = await res.json();
    if(res.ok) {
      alert(d.message || 'آزمون با موفقیت ثبت شد');
      document.getElementById('quiz-form').reset();
    } else {
      alert(d.error || 'خطا در ثبت آزمون');
    }
  } catch(e) {
    alert('خطای سیستمی');
  }
});

document.querySelector('[data-tab="stations-tab"]')?.addEventListener('click', loadCourseHierarchyOptions);
document.querySelector('[data-tab="content-tab"]')?.addEventListener('click', loadCourseHierarchyOptions);

// ===============================
// MODULE E: SYSTEM / RBAC LOGIC
// ===============================

// 1. Roles (Tab E1)
async function loadRoles() {
  try {
    const res = await fetch('/api/v1/admin/roles', { headers: { 'Authorization': `Bearer ${token}` } });
    const roles = await res.json();
    const tbody = document.querySelector('#roles-table tbody');
    if (!tbody) return;
    tbody.innerHTML = roles.map(r => `
      <tr>
        <td>${r.roleName}</td>
        <td><input type="checkbox" ${r.maskPhoneNumbers ? 'checked' : ''} onchange="updateRole('${r.roleName}', 'maskPhoneNumbers', this.checked)"></td>
        <td><input type="checkbox" ${r.restrictZarik ? 'checked' : ''} onchange="updateRole('${r.roleName}', 'restrictZarik', this.checked)"></td>
        <td><input type="checkbox" ${r.lockUserDeletions ? 'checked' : ''} onchange="updateRole('${r.roleName}', 'lockUserDeletions', this.checked)"></td>
        <td><input type="checkbox" ${r.manageContent ? 'checked' : ''} onchange="updateRole('${r.roleName}', 'manageContent', this.checked)"></td>
        <td><input type="checkbox" ${r.canSendMessage ? 'checked' : ''} onchange="updateRole('${r.roleName}', 'canSendMessage', this.checked)"></td>
        <td><input type="checkbox" ${r.canJoinClasses ? 'checked' : ''} onchange="updateRole('${r.roleName}', 'canJoinClasses', this.checked)"></td>
        <td><input type="checkbox" ${r.canScoreAndEvaluate ? 'checked' : ''} onchange="updateRole('${r.roleName}', 'canScoreAndEvaluate', this.checked)"></td>
        <td><input type="checkbox" ${r.canConvertAssets ? 'checked' : ''} onchange="updateRole('${r.roleName}', 'canConvertAssets', this.checked)"></td>
        <td><input type="checkbox" ${r.canCreateChallenges ? 'checked' : ''} onchange="updateRole('${r.roleName}', 'canCreateChallenges', this.checked)"></td>
        <td><input type="checkbox" ${r.canViewGlobalAnalytics ? 'checked' : ''} onchange="updateRole('${r.roleName}', 'canViewGlobalAnalytics', this.checked)"></td>
        <td><input type="checkbox" ${r.canManageUsers ? 'checked' : ''} onchange="updateRole('${r.roleName}', 'canManageUsers', this.checked)"></td>
        <td>-</td>
      </tr>
    `).join('');
  } catch(e) {
    console.error(e);
  }
}

window.updateRole = async function(roleName, field, value) {
  try {
    const data = { roleName };
    data[field] = value;
    await fetch('/api/v1/admin/roles', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch(e) {
    console.error(e);
    alert('خطا در بروزرسانی نقش');
  }
}

document.querySelector('[data-tab="roles-tab"]')?.addEventListener('click', loadRoles);

// 2. Notifications (Tab E2)
document.getElementById('broadcast-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('bc-title').value;
  const message = document.getElementById('bc-message').value;
  const target = document.getElementById('bc-target').value; // all, students, mentors

  try {
    const res = await fetch('/api/v1/admin/notifications/broadcast', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, message, userIds: [] }) // Note: our broadcast Notification currently requires userIds. In a real system, you'd fetch userIds by role or update the backend.
    });
    // For now, let's just use the global announcement endpoint if we want broad cast, but we already wrote the form.
    const res2 = await fetch('/api/v1/admin/announcements/broadcast', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message, targetRole: target })
    });
    if(res2.ok) {
      alert('پیام گروهی با موفقیت ارسال شد');
      document.getElementById('broadcast-form').reset();
    } else {
      alert('خطا در ارسال پیام');
    }
  } catch(e) {
    alert('خطای سیستمی');
  }
});

// 3. Audit Logs (Tab E3)
async function loadAuditLogs() {
  try {
    const res = await fetch('/api/v1/admin/audit/logs', { headers: { 'Authorization': `Bearer ${token}` } });
    const logs = await res.json();
    const tbody = document.querySelector('#audit-logs-table tbody');
    if (!tbody) return;
    tbody.innerHTML = logs.map(l => `
      <tr>
        <td><span style="font-size:0.8rem">${new Date(l.createdAt).toLocaleString('fa-IR')}</span></td>
        <td>${l.actorName}</td>
        <td>${l.action}</td>
        <td>${l.targetEntity}</td>
        <td><span style="font-size:0.8rem">${l.details}</span></td>
        <td>${l.ipAddress || '-'}</td>
      </tr>
    `).join('');
  } catch(e) {
    console.error(e);
  }
}

document.querySelector('[data-tab="audit-tab"]')?.addEventListener('click', loadAuditLogs);

// ===============================
// MODULE A (CONT.) : MENTOR DOCUMENTS QUEUE
// ===============================

let _mentorDocsCache = [];
let _currentMentorDocId = null;

window.loadMentorDocs = async function() {
  try {
    const res = await fetch('/api/v1/admin/mentors/documents/pending', { headers: { 'Authorization': `Bearer ${token}` } });
    if(!res.ok) return console.error('Failed to load mentor docs');
    const docs = await res.json();
    _mentorDocsCache = docs;
    const tbody = document.querySelector('#mentor-docs-table tbody');
    if (!tbody) return;
    tbody.innerHTML = docs.map(d => `
      <tr>
        <td>${d.user?.name || 'نامعلوم'}</td>
        <td>${d.fileName ? `<a href="${d.url || '/uploads/' + d.filePath}" target="_blank">باز کردن</a>` : '-'}</td>
        <td>${d.documentType || '-'}</td>
        <td>${new Date(d.createdAt).toLocaleString('fa-IR')}</td>
        <td>${d.status || 'pending'}</td>
        <td>
          <button class="btn-icon" onclick="openMentorDocModal('${d.id}')"><i class="fa-solid fa-eye"></i></button>
          <button class="btn-icon" style="color:green" onclick="quickApproveMentorDoc('${d.id}')"><i class="fa-solid fa-check"></i></button>
          <button class="btn-icon" style="color:red" onclick="openMentorDocModal('${d.id}', true)"><i class="fa-solid fa-ban"></i></button>
        </td>
      </tr>
    `).join('');
  } catch(e) {
    console.error('Failed to load mentor docs', e);
  }
}

window.openMentorDocModal = function(id, focusReject = false) {
  const doc = _mentorDocsCache.find(x => x.id === id);
  _currentMentorDocId = id;
  const preview = document.getElementById('mentor-doc-preview');
  if(!doc) {
    preview.innerHTML = '<div>مدرک یافت نشد</div>';
  } else {
    let html = `<div style="display:flex; gap:12px; align-items:center;">
      <div style="flex:1">
        <strong>مربی: </strong>${doc.user?.name || '-'}<br>
        <strong>نوع: </strong>${doc.documentType || '-'}<br>
        <strong>فایل: </strong>${doc.fileName || '-'}
      </div>
      <div style="flex:1; text-align:left;">
        <a href="${doc.url || ('/uploads/' + doc.filePath)}" target="_blank" class="btn-action">باز کردن در پنجره جدید</a>
      </div>
    </div>`;
    // If image show inline preview
    if(doc.mimeType && doc.mimeType.startsWith('image')) {
      html += `<div style="margin-top:10px;"><img src="${doc.url || ('/uploads/' + doc.filePath)}" style="max-width:100%; max-height:360px;"/></div>`;
    }
    preview.innerHTML = html;
  }
  document.getElementById('mentor-doc-admin-note').value = '';
  document.getElementById('mentor-doc-modal').style.display = 'flex';
  if(focusReject) document.getElementById('mentor-doc-admin-note').focus();
}

window.quickApproveMentorDoc = async function(id) {
  if(!confirm('آیا مطمئنید می‌خواهید این مدرک را بدون اضافه کردن یادداشت تایید کنید؟')) return;
  try {
    const res = await fetch(`/api/v1/admin/mentors/documents/${id}/approve`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: 'تایید سریع توسط ادمین' })
    });
    if(res.ok) {
      alert('مدرک تایید شد');
      loadMentorDocs();
    } else {
      const d = await res.json(); alert(d.error || 'خطا در تایید');
    }
  } catch(e) { console.error(e); alert('خطا'); }
}

document.getElementById('btn-close-mentor-doc-modal')?.addEventListener('click', () => {
  document.getElementById('mentor-doc-modal').style.display = 'none';
  _currentMentorDocId = null;
});

document.getElementById('btn-approve-mentor-doc')?.addEventListener('click', async () => {
  if(!_currentMentorDocId) return alert('مدرکی انتخاب نشده');
  const note = document.getElementById('mentor-doc-admin-note').value || 'تایید شد';
  try {
    const res = await fetch(`/api/v1/admin/mentors/documents/${_currentMentorDocId}/approve`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ note })
    });
    if(res.ok) {
      alert('مدرک تایید شد');
      document.getElementById('mentor-doc-modal').style.display = 'none';
      loadMentorDocs();
    } else {
      const d = await res.json(); alert(d.error || 'خطا');
    }
  } catch(e) { console.error(e); alert('خطا'); }
});

document.getElementById('btn-reject-mentor-doc')?.addEventListener('click', async () => {
  if(!_currentMentorDocId) return alert('مدرکی انتخاب نشده');
  const note = document.getElementById('mentor-doc-admin-note').value;
  if(!note || note.trim().length < 3) return alert('لطفا علت رد را وارد کنید (حداقل ۳ کاراکتر)');
  try {
    const res = await fetch(`/api/v1/admin/mentors/documents/${_currentMentorDocId}/reject`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ note })
    });
    if(res.ok) {
      alert('مدرک رد شد');
      document.getElementById('mentor-doc-modal').style.display = 'none';
      loadMentorDocs();
    } else {
      const d = await res.json(); alert(d.error || 'خطا');
    }
  } catch(e) { console.error(e); alert('خطا'); }
});

// Hook refresh button
document.getElementById('btn-refresh-mentor-docs')?.addEventListener('click', loadMentorDocs);

// Small export helper: build CSV from visible table
window.exportData = function(kind, format) {
  // For now support CSV export by reading visible table rows
  if(format === 'csv') {
    let tableId = 'users-data-table';
    if(kind === 'ledger') tableId = 'ledger-data-table';
    if(kind === 'mentor-docs' || kind === 'mentors-docs') tableId = 'mentor-docs-table';
    if(kind === 'caravans') tableId = 'caravans-container';
    const table = document.getElementById(tableId);
    if(!table) return alert('داده‌ای برای خروجی یافت نشد');
    // If it's a container (caravans) try to collect cards
    if(tableId === 'caravans-container') {
      const cards = Array.from(document.querySelectorAll('#caravans-container .caravan-card'));
      const rows = cards.map(c => [c.querySelector('.caravan-title')?.innerText || '-', c.querySelector('.caravan-members')?.innerText || '-']);
      const csv = ['title,members', ...rows.map(r => r.map(v=>`"${(v||'').replace(/"/g,'""')}"`).join(','))].join('\n');
      downloadCSV(`export_${kind}.csv`, csv);
      return;
    }
    const rows = Array.from(table.querySelectorAll('tr'));
    const csvRows = rows.map(tr => {
      const cols = Array.from(tr.querySelectorAll('th,td')).map(td => td.innerText.trim().replace(/\n/g,' '));
      return cols.map(c => `"${c.replace(/"/g,'""')}"`).join(',');
    });
    downloadCSV(`export_${kind}.csv`, csvRows.join('\n'));
  } else {
    // Fallback: CSV for other formats
    exportData(kind, 'csv');
  }
}

function downloadCSV(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}async function loadCaravanPerformance() {
  try {
    const res = await request('/api/v1/admin/caravans/league');
    const caravans = await res.json();
    const tbody = document.querySelector('#caravan-performance-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    caravans.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${c.name}</strong></td>
        <td>${c.mentorName}</td>
        <td>${c.memberCount} / ${c.capacityLimit}</td>
        <td>
          <span style="color:#fbbf24;"><i class="fa-solid fa-coins"></i> ${c.assets?.zarik || 0}</span> |
          <span style="color:#d946ef;"><i class="fa-solid fa-gem"></i> ${c.assets?.nakh || 0}</span>
        </td>
        <td>${c.overallProgress}%</td>
        <td>-</td>
        <td>
          <button class="page-btn btn-view" style="padding: 4px 8px; font-size:11px;" onclick="openCaravanDrawer('${c.id}')"><i class="fa-solid fa-eye"></i> مشاهده و عملیات</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) { console.error(err); }
}

async function openCaravanWizard() {
  document.getElementById('caravan-wizard-modal').style.display = 'flex';
  const mentorSelect = document.getElementById('cw-mentor');
  mentorSelect.innerHTML = '<option value="">در حال بارگذاری...</option>';
  try {
    const res = await request('/api/v1/admin/mentors');
    const mentors = await res.json();
    mentorSelect.innerHTML = mentors.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  } catch(e) {}
}
function closeCaravanWizard() { document.getElementById('caravan-wizard-modal').style.display = 'none'; }

async function submitCaravan(e) {
  e.preventDefault();
  const name = document.getElementById('cw-name').value;
  const capacityLimit = document.getElementById('cw-capacity').value;
  const targetStationId = document.getElementById('cw-target-station').value;
  const mentorId = document.getElementById('cw-mentor').value;
  const description = document.getElementById('cw-description').value;
  const socialGroupLink = document.getElementById('cw-social-link').value;
  const studentsRaw = document.getElementById('cw-students').value;
  const studentIds = studentsRaw ? studentsRaw.split(',').map(s => s.trim()).filter(s => s) : [];

  try {
    const res = await request('/api/v1/admin/caravans', {
      method: 'POST',
      body: JSON.stringify({ name, capacityLimit, targetStationId, mentorId, description, socialGroupLink, studentIds })
    });
    if (res.ok) {
      alert('کاروان با موفقیت ایجاد شد');
      closeCaravanWizard();
      loadCaravansTab();
    } else {
      const data = await res.json();
      alert(data.error || 'خطا در ایجاد کاروان');
    }
  } catch(err) { console.error(err); }
}

let currentDrawerCaravanId = null;
async function openCaravanDrawer(caravanId) {
  currentDrawerCaravanId = caravanId;
  document.getElementById('caravan-drawer-modal').style.display = 'flex';
  try {
    const res = await request(`/api/v1/admin/caravans/${caravanId}`);
    const data = await res.json();
    
    document.getElementById('cd-title').textContent = `داشبورد کاروان: ${data.name}`;
    document.getElementById('cd-mentor-name').textContent = data.mentor?.name || 'بدون راهبر';
    
    const capPct = (data.membersList.length / data.capacityLimit) * 100;
    document.getElementById('cd-capacity-bar').style.width = `${Math.min(capPct, 100)}%`;
    document.getElementById('cd-capacity-text').textContent = `${data.membersList.length} / ${data.capacityLimit} نفر`;
    
    document.getElementById('cd-wealth-zarik').textContent = data.wealth.zarik;
    document.getElementById('cd-wealth-nakh').textContent = data.wealth.nakh;
    document.getElementById('cd-wealth-farsh').textContent = data.wealth.farsh;
    document.getElementById('cd-wealth-beyragh').textContent = data.wealth.beyragh;
    
    document.getElementById('cd-progress-bar').style.width = `${data.overallProgress}%`;
    document.getElementById('cd-progress-text').textContent = `${data.overallProgress}%`;
    
  } catch (err) { console.error(err); }
}
function closeCaravanDrawer() { document.getElementById('caravan-drawer-modal').style.display = 'none'; }

async function sendCaravanBroadcast() {
  const title = document.getElementById('cd-broadcast-title').value;
  const message = document.getElementById('cd-broadcast-msg').value;
  if(!message) return alert('متن پیام الزامی است');
  try {
    const res = await request(`/api/v1/admin/caravans/${currentDrawerCaravanId}/broadcast`, {
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

async function loadCaravanMembersRoster() {
  try {
    const q = document.getElementById('search-caravan-members')?.value || '';
    const res = await request(`/api/v1/admin/users?role=student&search=${encodeURIComponent(q)}`);
    const users = await res.json();
    const tbody = document.querySelector('#caravan-roster-table tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    users.forEach(u => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${u.name}</td>
        <td>${u.phoneNumber}</td>
        <td>${u.caravanId || 'بدون کاروان'}</td>
        <td>-</td>
        <td>
           <button class="page-btn" onclick="removeFromCaravan('${u.caravanId}', '${u.id}')" ${!u.caravanId ? 'disabled' : ''}><i class="fa-solid fa-unlink"></i> حذف از کاروان</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    
    // Load default capacity if available
    try {
      const setRes = await request('/api/v1/admin/settings/DEFAULT_CARAVAN_CAPACITY');
      if (setRes.ok) {
        const setJson = await setRes.json();
        if (setJson.value) document.getElementById('global-capacity-input').value = setJson.value;
      }
    } catch(e) {}
  } catch(e) { console.error(e); }
}

function filterCaravanMembers() {
   clearTimeout(window.rosterTimeout);
   window.rosterTimeout = setTimeout(loadCaravanMembersRoster, 500);
}

async function removeFromCaravan(caravanId, studentId) {
  if(!caravanId) return;
  if(confirm('آیا از حذف این دانش‌آموز از کاروان مطمئن هستید؟')) {
     try {
       const res = await request(`/api/v1/admin/caravans/${caravanId}/members/${studentId}`, { method: 'DELETE' });
       if(res.ok) { alert('با موفقیت حذف شد'); loadCaravanMembersRoster(); }
     } catch(e) { console.error(e); }
  }
}

async function saveGlobalCapacity(e) {
  e.preventDefault();
  const val = document.getElementById('global-capacity-input').value;
  try {
    const res = await request('/api/v1/admin/settings/DEFAULT_CARAVAN_CAPACITY', {
      method: 'POST', body: JSON.stringify({ value: val })
    });
    if(res.ok) alert('ظرفیت پیش‌فرض ذخیره شد');
  } catch(err) { console.error(err); }
}

async function loadCaravanLeague() {
  const sortBy = document.getElementById('caravan-league-sort')?.value || 'progress';
  try {
    const res = await request(`/api/v1/admin/caravans/league?sortBy=${sortBy}`);
    const caravans = await res.json();
    const tbody = document.querySelector('#caravan-league-table tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    caravans.forEach((c, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${index + 1}</strong></td>
        <td>${c.name}</td>
        <td>${c.mentorName}</td>
        <td>${c.memberCount} / ${c.capacityLimit}</td>
        <td>${c.overallProgress}%</td>
        <td>${c.totalWealth.toLocaleString()}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch(e) { console.error(e); }
}

async function loadLmsData() {
  try {
    const res = await request('/api/v1/admin/lms/stations');
    const stations = await res.json();
    
    const catStationSelect = document.getElementById('lms-cat-station-id');
    const sessCatSelect = document.getElementById('lms-sess-category-id');
    const quizSessSelect = document.getElementById('lms-quiz-session-id');
    
    if(catStationSelect) catStationSelect.innerHTML = stations.map(s => `<option value="${s.id}">${s.title}</option>`).join('');
    
    let cats = [];
    stations.forEach(s => cats.push(...s.categories));
    if(sessCatSelect) sessCatSelect.innerHTML = cats.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
    
    let sessions = [];
    cats.forEach(c => sessions.push(...c.sessions));
    if(quizSessSelect) quizSessSelect.innerHTML = sessions.map(s => `<option value="${s.id}">${s.title}</option>`).join('');
    
  } catch(e) { console.error(e); }
}

async function submitLmsStation(e) {
  e.preventDefault();
  const id = document.getElementById('lms-station-id').value;
  const orderIndex = document.getElementById('lms-station-order').value;
  const title = document.getElementById('lms-station-title').value;
  const releaseDate = document.getElementById('lms-station-release-date').value;
  const releaseTime = document.getElementById('lms-station-release-time').value;
  
  try {
    const res = await request('/api/v1/admin/lms/stations', {
      method: 'POST', body: JSON.stringify({ id, orderIndex, title, releaseDate, releaseTime })
    });
    if(res.ok) { alert('منزلگاه ذخیره شد'); document.getElementById('lms-station-form').reset(); loadLmsData(); }
  } catch(e) { console.error(e); }
}

async function submitLmsCategory(e) {
  e.preventDefault();
  const id = document.getElementById('lms-category-id').value;
  const stationId = document.getElementById('lms-cat-station-id').value;
  const title = document.getElementById('lms-cat-title').value;
  const orderIndex = document.getElementById('lms-cat-order').value;
  
  try {
    const res = await request('/api/v1/admin/lms/categories', {
      method: 'POST', body: JSON.stringify({ id, stationId, title, orderIndex })
    });
    if(res.ok) { alert('دسته‌بندی ذخیره شد'); document.getElementById('lms-category-form').reset(); loadLmsData(); }
  } catch(e) { console.error(e); }
}

async function submitLmsSession(e) {
  e.preventDefault();
  const id = document.getElementById('lms-session-id').value;
  const categoryId = document.getElementById('lms-sess-category-id').value;
  const title = document.getElementById('lms-sess-title').value;
  const minWatchThreshold = document.getElementById('lms-sess-watch-min').value;
  const minPassScore = document.getElementById('lms-sess-pass-score').value;
  
  try {
    const res = await request('/api/v1/admin/lms/sessions', {
      method: 'POST', body: JSON.stringify({ id, categoryId, title, minWatchThreshold, minPassScore })
    });
    if(res.ok) { alert('کلاس ذخیره شد'); document.getElementById('lms-session-form').reset(); loadLmsData(); }
  } catch(e) { console.error(e); }
}

async function submitLmsQuiz(e) {
  e.preventDefault();
  const id = document.getElementById('lms-quiz-id').value;
  const sessionId = document.getElementById('lms-quiz-session-id').value;
  const title = document.getElementById('lms-quiz-title').value;
  const rewardZarik = document.getElementById('lms-quiz-zarik').value;
  
  try {
    const res = await request('/api/v1/admin/lms/quizzes', {
      method: 'POST', body: JSON.stringify({ id, sessionId, title, rewardZarik })
    });
    if(res.ok) { alert('آزمون ذخیره شد'); document.getElementById('lms-quiz-form').reset(); loadLmsData(); }
  } catch(e) { console.error(e); }
}

// FORM BUILDER LOGIC
async function loadDynForms() {
  try {
    const res = await request('/api/v1/admin/forms');
    const forms = await res.json();
    const tbody = document.querySelector('#dyn-forms-table tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    forms.forEach(f => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${f.title}</td>
        <td>${f.placement}</td>
        <td>${f.targetAudience}</td>
        <td>
           <button class="page-btn btn-danger" onclick="deleteDynForm('${f.id}')"><i class="fa-solid fa-trash"></i> حذف</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch(e) { console.error(e); }
}

async function submitDynamicForm(e) {
  e.preventDefault();
  const id = document.getElementById('dyn-form-id').value;
  const title = document.getElementById('dyn-form-title').value;
  const purpose = document.getElementById('dyn-form-purpose').value;
  const placement = document.getElementById('dyn-form-placement').value;
  const targetAudience = document.getElementById('dyn-form-audience').value;
  
  try {
    const res = await request('/api/v1/admin/forms', {
      method: 'POST', body: JSON.stringify({ id, title, purpose, placement, targetAudience })
    });
    if(res.ok) { alert('فرم با موفقیت ذخیره شد'); document.getElementById('dyn-form-builder').reset(); loadDynForms(); }
    tbody.innerHTML = '';
    users.forEach(u => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${u.name}</td>
        <td>${u.phoneNumber}</td>
        <td>${u.caravanId || 'بدون کاروان'}</td>
        <td>-</td>
        <td>
           <button class="page-btn" onclick="removeFromCaravan('${u.caravanId}', '${u.id}')" ${!u.caravanId ? 'disabled' : ''}><i class="fa-solid fa-unlink"></i> حذف از کاروان</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    
    // Load default capacity if available
    try {
      const setRes = await request('/api/v1/admin/settings/DEFAULT_CARAVAN_CAPACITY');
      if (setRes.ok) {
        const setJson = await setRes.json();
        if (setJson.value) document.getElementById('global-capacity-input').value = setJson.value;
      }
    } catch(e) {}
  } catch(e) { console.error(e); }
}

function filterCaravanMembers() {
   clearTimeout(window.rosterTimeout);
   window.rosterTimeout = setTimeout(loadCaravanMembersRoster, 500);
}

async function removeFromCaravan(caravanId, studentId) {
  if(!caravanId) return;
  if(confirm('آیا از حذف این دانش‌آموز از کاروان مطمئن هستید؟')) {
     try {
       const res = await request(`/api/v1/admin/caravans/${caravanId}/members/${studentId}`, { method: 'DELETE' });
       if(res.ok) { alert('با موفقیت حذف شد'); loadCaravanMembersRoster(); }
     } catch(e) { console.error(e); }
  }
}

async function saveGlobalCapacity(e) {
  e.preventDefault();
  const val = document.getElementById('global-capacity-input').value;
  try {
    const res = await request('/api/v1/admin/settings/DEFAULT_CARAVAN_CAPACITY', {
      method: 'POST', body: JSON.stringify({ value: val })
    });
    if(res.ok) alert('ظرفیت پیش‌فرض ذخیره شد');
  } catch(err) { console.error(err); }
}

async function loadCaravanLeague() {
  const sortBy = document.getElementById('caravan-league-sort')?.value || 'progress';
  try {
    const res = await request(`/api/v1/admin/caravans/league?sortBy=${sortBy}`);
    const caravans = await res.json();
    const tbody = document.querySelector('#caravan-league-table tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    caravans.forEach((c, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${index + 1}</strong></td>
        <td>${c.name}</td>
        <td>${c.mentorName}</td>
        <td>${c.memberCount} / ${c.capacityLimit}</td>
        <td>${c.overallProgress}%</td>
        <td>${c.totalWealth.toLocaleString()}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch(e) { console.error(e); }
}

async function loadLmsData() {
  try {
    const res = await request('/api/v1/admin/lms/stations');
    const stations = await res.json();
    
    const catStationSelect = document.getElementById('lms-cat-station-id');
    const sessCatSelect = document.getElementById('lms-sess-category-id');
    const quizSessSelect = document.getElementById('lms-quiz-session-id');
    
    if(catStationSelect) catStationSelect.innerHTML = stations.map(s => `<option value="${s.id}">${s.title}</option>`).join('');
    
    let cats = [];
    stations.forEach(s => cats.push(...s.categories));
    if(sessCatSelect) sessCatSelect.innerHTML = cats.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
    
    let sessions = [];
    cats.forEach(c => sessions.push(...c.sessions));
    if(quizSessSelect) quizSessSelect.innerHTML = sessions.map(s => `<option value="${s.id}">${s.title}</option>`).join('');
    
  } catch(e) { console.error(e); }
}

async function submitLmsStation(e) {
  e.preventDefault();
  const id = document.getElementById('lms-station-id').value;
  const orderIndex = document.getElementById('lms-station-order').value;
  const title = document.getElementById('lms-station-title').value;
  const releaseDate = document.getElementById('lms-station-release-date').value;
  const releaseTime = document.getElementById('lms-station-release-time').value;
  
  try {
    const res = await request('/api/v1/admin/lms/stations', {
      method: 'POST', body: JSON.stringify({ id, orderIndex, title, releaseDate, releaseTime })
    });
    if(res.ok) { alert('منزلگاه ذخیره شد'); document.getElementById('lms-station-form').reset(); loadLmsData(); }
  } catch(e) { console.error(e); }
}

async function submitLmsCategory(e) {
  e.preventDefault();
  const id = document.getElementById('lms-category-id').value;
  const stationId = document.getElementById('lms-cat-station-id').value;
  const title = document.getElementById('lms-cat-title').value;
  const orderIndex = document.getElementById('lms-cat-order').value;
  
  try {
    const res = await request('/api/v1/admin/lms/categories', {
      method: 'POST', body: JSON.stringify({ id, stationId, title, orderIndex })
    });
    if(res.ok) { alert('دسته‌بندی ذخیره شد'); document.getElementById('lms-category-form').reset(); loadLmsData(); }
  } catch(e) { console.error(e); }
}

async function submitLmsSession(e) {
  e.preventDefault();
  const id = document.getElementById('lms-session-id').value;
  const categoryId = document.getElementById('lms-sess-category-id').value;
  const title = document.getElementById('lms-sess-title').value;
  const minWatchThreshold = document.getElementById('lms-sess-watch-min').value;
  const minPassScore = document.getElementById('lms-sess-pass-score').value;
  
  try {
    const res = await request('/api/v1/admin/lms/sessions', {
      method: 'POST', body: JSON.stringify({ id, categoryId, title, minWatchThreshold, minPassScore })
    });
    if(res.ok) { alert('کلاس ذخیره شد'); document.getElementById('lms-session-form').reset(); loadLmsData(); }
  } catch(e) { console.error(e); }
}

async function submitLmsQuiz(e) {
  e.preventDefault();
  const id = document.getElementById('lms-quiz-id').value;
  const sessionId = document.getElementById('lms-quiz-session-id').value;
  const title = document.getElementById('lms-quiz-title').value;
  const rewardZarik = document.getElementById('lms-quiz-zarik').value;
  
  try {
    const res = await request('/api/v1/admin/lms/quizzes', {
      method: 'POST', body: JSON.stringify({ id, sessionId, title, rewardZarik })
    });
    if(res.ok) { alert('آزمون ذخیره شد'); document.getElementById('lms-quiz-form').reset(); loadLmsData(); }
  } catch(e) { console.error(e); }
}

// FORM BUILDER LOGIC
async function loadDynForms() {
  try {
    const res = await request('/api/v1/admin/forms');
    const forms = await res.json();
    const tbody = document.querySelector('#dyn-forms-table tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    forms.forEach(f => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${f.title}</td>
        <td>${f.placement}</td>
        <td>${f.targetAudience}</td>
        <td>
           <button class="page-btn btn-danger" onclick="deleteDynForm('${f.id}')"><i class="fa-solid fa-trash"></i> حذف</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch(e) { console.error(e); }
}

async function submitDynamicForm(e) {
  e.preventDefault();
  const id = document.getElementById('dyn-form-id').value;
  const title = document.getElementById('dyn-form-title').value;
  const purpose = document.getElementById('dyn-form-purpose').value;
  const placement = document.getElementById('dyn-form-placement').value;
  const targetAudience = document.getElementById('dyn-form-audience').value;
  
  try {
    const res = await request('/api/v1/admin/forms', {
      method: 'POST', body: JSON.stringify({ id, title, purpose, placement, targetAudience })
    });
    if(res.ok) { alert('فرم با موفقیت ذخیره شد'); document.getElementById('dyn-form-builder').reset(); loadDynForms(); }
  } catch(e) { console.error(e); }
}

async function deleteDynForm(id) {
  if(!confirm('آیا از حذف این فرم مطمئن هستید؟')) return;
  try {
    const res = await request(`/api/v1/admin/forms/${id}`, { method: 'DELETE' });
    if(res.ok) loadDynForms();
  } catch(e) { console.error(e); }
}

// Override loadAuditLogs
window.loadAuditLogs = async function(role = null) {
  try {
    if(role) {
      const activeRoleInput = document.getElementById('audit-active-role');
      if (activeRoleInput) activeRoleInput.value = role;
    }
    const activeRole = document.getElementById('audit-active-role')?.value || '';
    const action = document.getElementById('audit-action-filter')?.value || '';
    const search = document.getElementById('audit-search')?.value || '';
    
    let url = `/api/v1/admin/audit/logs?actorRole=${activeRole}`;
    if (action) url += `&action=${action}`;
    if (search) url += `&search=${search}`;

    const res = await request(url);
    const data = await res.json();
    const tbody = document.querySelector('#audit-logs-table tbody');
    if (!tbody) return;
    
    // Fallback if data is array or object with logs array
    const logs = data.logs || data || [];
    
    tbody.innerHTML = logs.map(l => `
      <tr>
        <td><span style="font-size:0.8rem">${new Date(l.createdAt).toLocaleString('fa-IR')}</span></td>
        <td>${l.actorName}</td>
        <td><span class="badge badge-mentor">${l.actorRole || ''}</span></td>
        <td>${l.action}</td>
        <td>${l.targetEntity}</td>
        <td><span style="font-size:0.8rem">${l.details}</span></td>
        <td>${l.ipAddress || '-'}</td>
      </tr>
    `).join('');
  } catch(e) {
    console.error(e);
  }
}

document.getElementById('audit-filter-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  loadAuditLogs();
});

window.exportAuditLogs = async function() {
    const activeRole = document.getElementById('audit-active-role')?.value || '';
    const action = document.getElementById('audit-action-filter')?.value || '';
    const search = document.getElementById('audit-search')?.value || '';
    
    let url = `/api/v1/admin/audit/logs?actorRole=${activeRole}&limit=1000`;
    if (action) url += `&action=${action}`;
    if (search) url += `&search=${search}`;

    try {
       const res = await request(url);
       const data = await res.json();
       const logs = data.logs || data || [];
       
       let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
       csvContent += "Date,Actor,Role,Action,Target,Details,IP\r\n";
       
       logs.forEach(l => {
           let row = [
             new Date(l.createdAt).toLocaleString('fa-IR'),
             l.actorName,
             l.actorRole,
             l.action,
             l.targetEntity,
             l.details,
             l.ipAddress
           ].map(v => '"' + (v || '').toString().replace(/"/g, '""') + '"').join(",");
           csvContent += row + "\r\n";
       });

       const encodedUri = encodeURI(csvContent);
       const link = document.createElement("a");
       link.setAttribute("href", encodedUri);
       link.setAttribute("download", `audit_logs_${activeRole}.csv`);
       document.body.appendChild(link);
       link.click();
       document.body.removeChild(link);
    } catch(e) {
       console.error(e);
    }
}

// ----------------------------------------------------
// VIDEO CLIP UPLOAD & SUBMIT
// ----------------------------------------------------
window.uploadClipMedia = async function(input) {
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  const formData = new FormData();
  formData.append('file', file);
  formData.append('assetType', 'course_video');
  
  const statusEl = document.getElementById('lms-clip-upload-status');
  statusEl.innerText = 'در حال آپلود...';
  
  try {
    const res = await fetch('/api/v1/media/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    if (data.url) {
      document.getElementById('lms-clip-url').value = data.url;
      statusEl.innerText = 'آپلود موفق!';
    } else {
      statusEl.innerText = 'خطا در آپلود';
      statusEl.style.color = 'red';
    }
  } catch(e) {
    console.error(e);
    statusEl.innerText = 'خطا در آپلود';
    statusEl.style.color = 'red';
  }
}

window.submitLmsClip = async function(e) {
  e.preventDefault();
  const sessionId = document.getElementById('lms-clip-session-id').value;
  const title = document.getElementById('lms-clip-title').value;
  const clipOrder = parseInt(document.getElementById('lms-clip-order').value);
  const videoUrl = document.getElementById('lms-clip-url').value;
  
  if (!videoUrl) {
    alert('لطفا ابتدا یک ویدیو آپلود کنید');
    return;
  }
  
  try {
    // Note: This endpoint must exist in the backend. 
    // We will ensure it is handled or we use a generic class-clip endpoint.
    const res = await fetch(`/api/v1/admin/lms/sessions/${sessionId}/clips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ title, clipOrder, videoUrl })
    });
    
    if (res.ok) {
      alert('کلیپ با موفقیت اضافه شد!');
      document.getElementById('lms-clip-form').reset();
      document.getElementById('lms-clip-upload-status').innerText = '';
    } else {
      alert('خطا در افزودن کلیپ');
    }
  } catch(e) {
    console.error(e);
    alert('خطا در ارتباط با سرور');
  }
}
