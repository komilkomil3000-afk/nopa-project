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
  const token = localStorage.getItem('token');
  const modal = document.getElementById('login-modal');

  if (token && token !== 'dev-bypass') {
    if (modal) modal.style.setProperty('display', 'none', 'important');
  }

  const form = document.getElementById('admin-login-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const phoneInput = document.getElementById('login-phone') || form.querySelector('input[type="text"]');
      const passInput = document.getElementById('login-password') || form.querySelector('input[type="password"]');

      const phoneNumber = phoneInput ? phoneInput.value.trim() : '09380346668';
      const password = passInput ? passInput.value.trim() : '123456';

      try {
        const res = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber, password })
        });
        const data = await res.json();
        if (res.ok && data.token) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('nopa_admin_token', data.token);
          localStorage.setItem('nopa_admin_user', JSON.stringify(data.user || { role: 'admin', identityVerified: true }));
          currentUser = JSON.parse(localStorage.getItem('nopa_admin_user') || '{}');
          
          const modal = document.getElementById('login-modal');
          if (modal) modal.style.setProperty('display', 'none', 'important');
          
          showDashboard();
        } else {
          alert(data.error || 'اطلاعات ورود اشتباه است');
        }
      } catch (err) {
        console.error('Login error:', err);
        alert('خطا در اتصال به سرور بکاند');
      }
    });
  }

  if (token && token !== 'dev-bypass') {
    showDashboard();
  }
  setupEventListeners();
  setupSidebarControls();
});

function showLogin() {
  const modal = document.getElementById('login-modal');
  if (modal) modal.style.display = 'flex';
  const layout = document.getElementById('app-layout');
  if (layout) layout.style.display = 'none';
}

function showDashboard() {
  const modal = document.getElementById('login-modal');
  if (modal) modal.style.setProperty('display', 'none', 'important');
  const layout = document.getElementById('app-layout');
  if (layout) layout.style.display = 'block';
  
  // Set current user details
  document.getElementById('current-user-avatar').textContent = currentUser.name ? currentUser.name.substring(0, 2) : 'مد';
  document.getElementById('current-user-name').textContent = currentUser.name || 'مدیر سیستم';
  document.getElementById('current-user-role').textContent = `نقش: ${currentUser.role}`;

  // Route according to current URL hash
  if (typeof handleHashRouting === 'function') {
    handleHashRouting();
  } else if (typeof switchTab === 'function') {
    switchTab('users-tab');
  }

  // Load initial data
  if (typeof window.loadCaravansData === 'function') window.loadCaravansData();
  if (typeof window.loadUsersData === 'function') window.loadUsersData();
  if (typeof window.loadAllUsersDropdown === 'function') window.loadAllUsersDropdown();
  if (typeof window.loadMentorsData === 'function') window.loadMentorsData();
  if (typeof window.loadLmsStationsData === 'function') {
    window.loadLmsStationsData();
  }
}

window.handleAdminLogin = async function() {
  const phoneInput = document.getElementById('login-phone') || document.querySelector('input[type="text"]');
  const passInput = document.getElementById('login-password') || document.querySelector('input[type="password"]');

  const phoneNumber = phoneInput ? phoneInput.value.trim() : '09380346668';
  const password = passInput ? passInput.value.trim() : '123456';

  try {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber, password })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('nopa_admin_token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user || { role: 'admin' }));

      const modal = document.getElementById('login-modal') || document.getElementById('login-overlay');
      if (modal) modal.style.setProperty('display', 'none', 'important');
      const screen = document.getElementById('login-screen');
      if (screen) screen.style.display = 'none';
      document.body.classList.remove('modal-open');

      // Trigger initial dashboard load
      if (typeof loadDashboardStats === 'function') loadDashboardStats();
      if (typeof loadUsers === 'function') loadUsers();
      if (typeof loadMentorsTab === 'function') loadMentorsTab();
      window.location.reload();
    } else {
      alert(data.error || 'اطلاعات ورود نادرست است');
    }
  } catch (err) {
    console.error('Login fetch failed:', err);
    alert('عدم برقراری ارتباط با سرور. مطمئن شوید سرور بکاند فعال است.');
  }
};

function setupEventListeners() {
  // Logout Ctrl
  document.getElementById('btn-logout-ctrl').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('nopa_admin_token');
    localStorage.removeItem('nopa_admin_user');
    window.location.reload();
  });

  // Tab switching
  const menuItems = document.querySelectorAll('.menu-item');
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabId = item.getAttribute('data-tab');
      switchTab(tabId, true);
    });
  });

  // Add Member Modal Trigger
  const addMemberBtn = document.getElementById('btn-open-add-member-modal');
  if (addMemberBtn) {
    addMemberBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof window.openAddMemberToCaravanModal === 'function') {
        window.openAddMemberToCaravanModal();
      }
    });
  }

  // Change Mentor Modal Trigger
  const changeMentorBtn = document.getElementById('btn-change-caravan-mentor');
  if (changeMentorBtn) {
    changeMentorBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof window.openChangeCaravanMentorModal === 'function') {
        window.openChangeCaravanMentorModal();
      }
    });
  }

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

  // 8. Toggle Dark/Light Mode
function toggleTheme() {
  document.body.classList.toggle('light-theme');
}

async function loadMentorsTab() {
  if (typeof window.loadMentors === 'function') {
    await window.loadMentors();
  }
}

window.moderateMentorModal = function(id) {
  const action = prompt('نوع عملیات را وارد کنید (soft_delete / permanent_suspend / temp_suspend):');
  if (!action) return;
  
  let suspendedUntil = null;
  if (action === 'temp_suspend') {
    suspendedUntil = prompt('تاریخ پایان تعلیق (فرمت YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
    if (!suspendedUntil) return;
  }
  
  request('/api/v1/admin/mentors/' + id + '/moderate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, suspendedUntil })
  }).then(async res => {
    if (res.ok) {
      alert('عملیات با موفقیت انجام شد');
      loadMentorsTab();
    } else {
      const data = await res.json();
      alert(data.error);
    }
  });
};  

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
      const levelBadge = `<span class="badge" style="background:#8B5CF6; color:white; font-size:10px;">${levelNames[user.levelFrame] || 'نامشخص'}</span>`;
      
      const lastCert = user.certificates && user.certificates.length > 0 ? user.certificates[0].title : 'بدون گواهینامه';
      
      let physicalReqs = 'ندارد';
      if (user.physicalOrders && user.physicalOrders.length > 0) {
        physicalReqs = user.physicalOrders.map(o => `<span class="badge" style="background:${o.status === 'PENDING_PRINT' ? '#fbbf24' : '#10b981'}; color:black;">${o.status === 'PENDING_PRINT' ? 'در انتظار چاپ' : 'ارسال شده'}</span>`).join(' ');
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${user.name || 'کاربر بدون نام'}</strong></td>
        <td style="font-family: monospace;">${user.phoneNumber}</td>
        <td>${levelBadge}</td>
        <td>${lastCert}</td>
        <td>${user.registrationCompleted ? '<span style="color:var(--color-success)">تکمیل شده</span>' : '<span style="color:var(--color-danger)">ناقص</span>'}</td>
        <td>${physicalReqs}</td>
        <td>
          <button class="page-btn btn-edit" style="padding: 4px 8px; font-size:11px;" onclick="promptLevelOverride('${user.id}', ${user.levelFrame})" title="تغییر سطح دستی"><i class="fa-solid fa-edit"></i></button>
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
      alert('سطح با موفقیت تغییر یافت');
      loadLevelsAndCertificatesTab();
    } else {
      alert(data.error || 'خطا در تغییر سطح');
    }
  } catch (err) {
    alert('خطای شبکه');
  }
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
  const currentToken = localStorage.getItem('token') || localStorage.getItem('nopa_admin_token') || '';
  options.headers = {
    ...options.headers,
    'Authorization': `Bearer ${currentToken}`
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

const HASH_TAB_MAP = {
  '#users': 'users-tab',
  '#users-tab': 'users-tab',
  '#rewards': 'rewards-tab',
  '#rewards-tab': 'rewards-tab',
  '#levels': 'levels-tab',
  '#levels-tab': 'levels-tab',
  
  '#mentors': 'mentors-profile-tab',
  '#mentors-profile': 'mentors-profile-tab',
  '#mentors-profile-tab': 'mentors-profile-tab',
  '#mentors-tickets': 'mentors-tickets-tab',
  '#mentors-tickets-tab': 'mentors-tickets-tab',
  '#mentors-docs': 'mentors-docs-tab',
  '#mentors-docs-tab': 'mentors-docs-tab',
  '#mentors-league': 'mentors-league-tab',
  '#mentors-league-tab': 'mentors-league-tab',

  '#caravans': 'caravans-tab',
  '#caravans-tab': 'caravans-tab',
  '#caravan-league': 'caravans-tab',
  '#caravan-league-tab': 'caravans-tab',

  '#lms': 'lms-tab',
  '#lms-tab': 'lms-tab',
  '#stations': 'lms-tab',
  '#form-builder': 'form-builder-tab',
  '#form-builder-tab': 'form-builder-tab',
  '#submissions': 'submissions-tab',
  '#submissions-tab': 'submissions-tab',

  '#roles': 'roles-tab',
  '#roles-tab': 'roles-tab',
  '#notifications': 'notifications-tab',
  '#notifications-tab': 'notifications-tab',
  '#news': 'news-tab',
  '#news-tab': 'news-tab',
  '#jarchi': 'news-tab',
  '#audit': 'audit-tab',
  '#audit-tab': 'audit-tab',
  '#analytics': 'analytics-tab',
  '#analytics-tab': 'analytics-tab'
};

const TAB_REVERSE_HASH_MAP = {
  'users-tab': 'users',
  'rewards-tab': 'rewards',
  'levels-tab': 'levels',
  'mentors-profile-tab': 'mentors',
  'mentors-tickets-tab': 'mentors-tickets',
  'mentors-docs-tab': 'mentors-docs',
  'mentors-league-tab': 'mentors-league',
  'caravans-tab': 'caravans',
  'caravan-league-tab': 'caravan-league',
  'lms-tab': 'lms',
  'form-builder-tab': 'form-builder',
  'submissions-tab': 'submissions',
  'news-tab': 'news',
  'roles-tab': 'roles',
  'notifications-tab': 'notifications',
  'audit-tab': 'audit',
  'analytics-tab': 'analytics'
};

// Switch tabs with URL Hash updates
function switchTab(tabId, updateUrl = true) {
  if (!tabId) tabId = 'users-tab';

  const panels = document.querySelectorAll('.tab-panel');
  panels.forEach(panel => {
    panel.style.display = 'none';
    panel.classList.remove('active-panel');
  });

  const target = document.getElementById(tabId);
  if (target) {
    target.style.display = 'block';
    target.classList.add('active-panel');
  }

  activeTab = tabId;

  // Highlight menu item and expand parent accordion
  const menuItems = document.querySelectorAll('.menu-item');
  menuItems.forEach(mi => {
    if (mi.getAttribute('data-tab') === tabId) {
      mi.classList.add('active');
      const accordion = mi.closest('.accordion-item');
      if (accordion) {
        accordion.classList.add('open');
      }
    } else {
      mi.classList.remove('active');
    }
  });

  // Set top title
  const titlesMap = {
    'users-tab': { title: 'دایرکتوری کاربران', desc: 'مشاهده، فیلتر، ویرایش و مدیریت اطلاعات کاربران نپا' },
    'levels-tab': { title: 'سطوح و گواهینامه‌ها', desc: 'دایرکتوری دستاوردهای مخاطبان و درخواست‌های فیزیکی گواهینامه' },
    'analytics-tab': { title: 'مرکز ارزیابی و آمار', desc: 'داشبورد جامع شاخص‌های کلیدی عملکرد و رفتار کاربران' },
    'rewards-tab': { title: 'کیف پول زریک', desc: 'مدیریت ترازنامه، جوایز فصلی و توزیع ثروت اقتصاد زریک' },
    'roles-tab': { title: 'امنیت و دسترسی', desc: 'ماتریس اختصاصی نقش‌های امنیتی نپا' },
    'caravans-tab': { title: 'کاروان‌ها و مربیان', desc: 'گزارش پیشرفت گروهی کاروان‌ها و ارزیابی مربیان' },
    'caravan-league-tab': { title: 'لیگ و تبدیل سرمایه‌ها', desc: 'جدول رده‌بندی و تبدیل سرمایه‌های کاروان‌ها' },
    'content-tab': { title: 'اطلاعیه‌ها و محتوا', desc: 'مدیریت و انتشار اطلاعیه‌های سراسری و پیام‌های هدفمند' },
    'notifications-tab': { title: 'مدیریت اعلان‌ها', desc: 'ارسال و پیگیری پیامک، ایمیل و پوش‌نوتیفیکیشن' },
    'media-tab': { title: 'مدیریت رسانه‌ها', desc: 'آپلود و دسته‌بندی فایل‌های ویدیویی و تصویری جهت استریم در اپلیکیشن' },
    'audit-tab': { title: 'لاگ‌های سیستمی', desc: 'گزارش حسابرسی عملیات مدیران و رکوردهای امنیتی' },
    'banners-tab': { title: 'مدیریت بنرها', desc: 'مدیریت بنرها و تبلیغات نمایشی اپلیکیشن' },
    'news-tab': { title: 'اخبار جارچی', desc: 'مدیریت تابلوی اعلانات جارچی و رویدادها' },
    'mentors-profile-tab': { title: 'پروفایل و شناسنامه راهبران', desc: 'مرکز ارزیابی راهبران و مربیان' },
    'mentors-tickets-tab': { title: 'میزکار و تیکت‌ها', desc: 'مدیریت تیکت‌ها و درخواست‌های مربیان' },
    'mentors-docs-tab': { title: 'تایید مدارک و گواهینامه‌ها', desc: 'صف انتظار بررسی و تایید مدارک مربیان' },
    'mentors-league-tab': { title: 'لیگ و ارزیابی مربیان', desc: 'ارزیابی عملکرد و رتبه‌بندی راهبران' },
    'lms-tab': { title: 'ساختار منزلگاه‌ها', desc: 'مدیریت منزلگاه‌ها، کلاس‌ها و آزمون‌ها' },
    'stations-tab': { title: 'ساختار منزلگاه‌ها', desc: 'مدیریت منزلگاه‌ها، کلاس‌ها و آزمون‌ها' },
    'form-builder-tab': { title: 'فرم‌ساز داینامیک', desc: 'طراحی و مدیریت فرم‌ها و پرسشنامه‌های اختصاصی' },
    'submissions-tab': { title: 'بررسی تکالیف معلق', desc: 'مدیریت و ارزیابی پاسخ‌ها و تکالیف دانش‌آموزان' }
  };

  if (titlesMap[tabId]) {
    const titleEl = document.getElementById('tab-title-text');
    if (titleEl) titleEl.textContent = titlesMap[tabId].title;
    const descEl = document.getElementById('tab-desc-text');
    if (descEl) descEl.textContent = titlesMap[tabId].desc;
  }

  // Update URL hash cleanly without page reload
  if (updateUrl) {
    const cleanHash = TAB_REVERSE_HASH_MAP[tabId] || tabId.replace('-tab', '');
    if (window.location.hash !== '#' + cleanHash) {
      history.pushState(null, '', '#' + cleanHash);
    }
  }

  // Lazy-load data based on active tab
  if (tabId === 'users-tab') {
    if (typeof window.loadUsersData === 'function') window.loadUsersData();
    else loadUsers();
  } else if (tabId === 'mentors-profile-tab') {
    if (typeof window.loadMentorsData === 'function') window.loadMentorsData();
    else loadMentorsTab();
  } else if (tabId === 'caravans-tab') {
    if (typeof window.loadCaravansData === 'function') window.loadCaravansData();
    else loadCaravansTab();
  } else if (tabId === 'lms-tab' || tabId === 'stations-tab') {
    if (typeof window.fetchLiveLmsStations === 'function') window.fetchLiveLmsStations();
    else if (typeof window.loadLmsStationsData === 'function') window.loadLmsStationsData();
  } else if (tabId === 'rewards-tab') {
    loadLedger();
    loadZarikAnalytics();
    if (typeof loadAssetLeaderboard === 'function') loadAssetLeaderboard();
    if (typeof loadRewardRules === 'function') loadRewardRules();
  } else if (tabId === 'roles-tab') {
    loadRolePermissions();
  } else if (tabId === 'audit-tab') {
    loadAuditLogs();
  } else if (tabId === 'levels-tab') {
    loadLevelsAndCertificatesTab();
  } else if (tabId === 'economy-hub-tab') {
    if (typeof loadEconomyHubTab === 'function') loadEconomyHubTab();
  } else if (tabId === 'caravan-league-tab') {
    if (typeof loadCaravanLeague === 'function') loadCaravanLeague();
  } else if (tabId === 'form-builder-tab') {
    if (typeof loadDynForms === 'function') loadDynForms();
  } else if (tabId === 'media-tab') {
    if (typeof loadMediaAssets === 'function') loadMediaAssets();
  } else if (tabId === 'analytics-tab') {
    if (typeof loadAnalytics === 'function') loadAnalytics();
  } else if (tabId === 'notifications-tab') {
    if (typeof loadNotificationData === 'function') loadNotificationData();
  } else if (tabId === 'banners-tab') {
    if (typeof loadBannersTab === 'function') loadBannersTab();
  } else if (tabId === 'news-tab') {
    if (typeof loadNewsTab === 'function') loadNewsTab();
  } else if (tabId === 'chat-tab') {
    if (typeof loadChats === 'function') loadChats();
  } else if (tabId === 'mentors-tickets-tab') {
    if (typeof loadTickets === 'function') loadTickets();
  } else if (tabId === 'mentors-league-tab') {
    if (typeof loadMentorLeague === 'function') loadMentorLeague();
  } else if (tabId === 'submissions-tab') {
    if (typeof loadSubmissions === 'function') loadSubmissions();
  }
}

function handleHashRouting() {
  const currentHash = (window.location.hash || '#users').toLowerCase();
  const targetTab = HASH_TAB_MAP[currentHash] || 'users-tab';
  switchTab(targetTab, false);
}

// Window popstate / hashchange listeners
window.addEventListener('hashchange', handleHashRouting);
window.addEventListener('popstate', handleHashRouting);

// Caravan Drawer
async function openCaravanDrawer(caravanId) {
  try {
    const res = await request(`/api/v1/admin/caravans/${caravanId}`);
    if (!res.ok) return alert('خطا در دریافت اطلاعات کاروان');
    const caravan = await res.json();
    
    document.getElementById('cd-title').textContent = `داشبورد کاروان: ${caravan.name}`;
    document.getElementById('cd-mentor-name').textContent = caravan.mentor?.name || 'بدون راهبر';
    document.getElementById('cd-capacity-text').textContent = `${caravan.memberCount || 0} / ${caravan.capacityLimit || 50} نفر`;
    document.getElementById('cd-capacity-bar').style.width = `${Math.min(100, ((caravan.memberCount || 0) / (caravan.capacityLimit || 50)) * 100)}%`;
    
    document.getElementById('cd-wealth-zarik').textContent = caravan.assets?.zarik || 0;
    document.getElementById('cd-wealth-nakh').textContent = caravan.assets?.nakh || 0;
    document.getElementById('cd-wealth-farsh').textContent = caravan.assets?.farsh || 0;
    document.getElementById('cd-wealth-beyragh').textContent = caravan.assets?.beyragh || 0;
    
    const progress = caravan.overallProgress || 0;
    document.getElementById('cd-progress-text').textContent = `${progress}%`;
    document.getElementById('cd-progress-bar').style.width = `${progress}%`;
    
    document.getElementById('caravan-drawer-modal').style.display = 'flex';
  } catch (err) {
    console.error(err);
    alert('خطا در ارتباط با سرور');
  }
}

function closeCaravanDrawer() {
  document.getElementById('caravan-drawer-modal').style.display = 'none';
}

// Tickets
async function loadTickets() {
  try {
    const res = await request('/api/v1/admin/tickets');
    if (!res.ok) return;
    const tickets = await res.json();
    const tbody = document.querySelector('#mentor-tickets-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = tickets.map(t => `
      <tr>
        <td>${t.student?.name || 'ناشناس'}</td>
        <td>${t.category}</td>
        <td>${t.subject}</td>
        <td><span class="badge ${t.status === 'OPEN' ? 'badge-warning' : 'badge-success'}">${t.status}</span></td>
        <td>${new Date(t.createdAt).toLocaleDateString('fa-IR')}</td>
        <td>${t.rating || '-'}</td>
        <td>
          <button class="page-btn btn-view" onclick="alert('نمایش جزئیات به زودی')"><i class="fa-solid fa-eye"></i></button>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    console.error('Error loading tickets', e);
  }
}

// Submissions
async function loadSubmissions() {
  try {
    const res = await request('/api/v1/admin/submissions');
    if (!res.ok) return;
    const submissions = await res.json();
    const tbody = document.querySelector('#admin-submissions-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = submissions.map(s => `
      <tr>
        <td>${s.user?.name || 'ناشناس'}</td>
        <td>${s.challengeId || 'تکلیف کلاسی'}</td>
        <td>${s.content || '-'}</td>
        <td>${s.attachmentUrl ? `<a href="${s.attachmentUrl}" target="_blank">دانلود</a>` : '-'}</td>
        <td>${new Date(s.createdAt).toLocaleDateString('fa-IR')}</td>
        <td>${s.rewardZarik || 0}</td>
        <td>
          ${s.status === 'PENDING' ? `
            <button class="page-btn btn-success" onclick="reviewSubmission('${s.id}', true)"><i class="fa-solid fa-check"></i> تایید</button>
            <button class="page-btn btn-danger" onclick="reviewSubmission('${s.id}', false)"><i class="fa-solid fa-times"></i> رد</button>
          ` : `<span class="badge ${s.status === 'APPROVED' ? 'badge-success' : 'badge-danger'}">${s.status}</span>`}
        </td>
      </tr>
    `).join('');
  } catch (e) {
    console.error('Error loading submissions', e);
  }
}

window.reviewSubmission = async function(id, isApproved) {
  try {
    const res = await request(`/api/v1/admin/submissions/${id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isApproved })
    });
    if (res.ok) {
      alert(isApproved ? 'تکلیف تایید شد' : 'تکلیف رد شد');
      loadSubmissions();
    } else {
      const data = await res.json();
      alert(data.error || 'خطا در ارزیابی');
    }
  } catch (e) {
    console.error(e);
  }
};

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

    if (data.users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-secondary);">هیچ کاربری یافت نشد</td></tr>';
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
        <td>${u.userCode || '-'}</td>
        <td><strong>${u.name}</strong> ${blockBadge}</td>
        <td style="font-family: monospace;">${u.phoneNumber}</td>
        <td>${roleBadge}</td>
        <td>${u.caravanName || '-'}</td>
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
            <div style="margin-top:5px; font-size:12px; color:var(--text-muted);">شناسه اختصاصی: ${user.userCode || 'فاقد شناسه'}</div>
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
          <div style="margin-top:10px; font-size:13px; cursor:pointer;" onclick="navigator.clipboard.writeText('NP-${user.userCode || user.phoneNumber}'); alert('کد راهبر کپی شد')">
            <i class="fa-solid fa-copy text-primary"></i> <strong style="color:var(--text-primary);">NP-${user.userCode || user.phoneNumber}</strong>
          </div>
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

let currentLeagueTab = 'caravans';
let leagueSearchTimeout = null;

function switchLeagueTab(tab) {
  currentLeagueTab = tab;
  const btnCaravans = document.getElementById('btn-league-caravans');
  const btnIndividuals = document.getElementById('btn-league-individuals');
  const containerCaravans = document.getElementById('league-caravans-container');
  const containerIndividuals = document.getElementById('league-individuals-container');
  const roleFilterBox = document.getElementById('league-role-filter-box');

  if (tab === 'caravans') {
    if (btnCaravans) {
      btnCaravans.style.background = 'var(--color-accent)';
      btnCaravans.style.color = '#fff';
      btnCaravans.style.fontWeight = '700';
    }
    if (btnIndividuals) {
      btnIndividuals.style.background = 'transparent';
      btnIndividuals.style.color = 'var(--text-secondary)';
      btnIndividuals.style.fontWeight = 'normal';
    }
    if (containerCaravans) containerCaravans.style.display = 'block';
    if (containerIndividuals) containerIndividuals.style.display = 'none';
    if (roleFilterBox) roleFilterBox.style.display = 'none';
    loadCaravansLeaderboard();
  } else {
    if (btnIndividuals) {
      btnIndividuals.style.background = 'var(--color-accent)';
      btnIndividuals.style.color = '#fff';
      btnIndividuals.style.fontWeight = '700';
    }
    if (btnCaravans) {
      btnCaravans.style.background = 'transparent';
      btnCaravans.style.color = 'var(--text-secondary)';
      btnCaravans.style.fontWeight = 'normal';
    }
    if (containerCaravans) containerCaravans.style.display = 'none';
    if (containerIndividuals) containerIndividuals.style.display = 'block';
    if (roleFilterBox) roleFilterBox.style.display = 'flex';
    loadIndividualsLeaderboard();
  }
}

function debounceLeagueSearch() {
  clearTimeout(leagueSearchTimeout);
  leagueSearchTimeout = setTimeout(() => {
    applyLeagueFilters();
  }, 300);
}

function applyLeagueFilters() {
  if (currentLeagueTab === 'caravans') {
    loadCaravansLeaderboard();
  } else {
    loadIndividualsLeaderboard();
  }
}

async function loadLeagueCaravansOptions() {
  try {
    const res = await request('/api/v1/admin/caravans');
    if (!res.ok) return;
    const data = await res.json();
    const select = document.getElementById('league-caravan-filter');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="all">تمام کاروان‌ها</option>';
    const caravans = Array.isArray(data) ? data : (data.caravans || []);
    caravans.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      select.appendChild(opt);
    });
    if (currentVal) select.value = currentVal;
  } catch (err) {
    console.error('Failed to load caravan options for league filter', err);
  }
}

async function loadCaravansLeaderboard() {
  const tbody = document.querySelector('#caravans-leaderboard-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; padding: 25px; color: var(--text-secondary);"><i class="fa-solid fa-spinner fa-spin" style="margin-left: 8px;"></i> در حال دریافت رتبه‌بندی کاروان‌ها...</td></tr>';

  const sortBy = document.getElementById('league-sort-by')?.value || 'totalScore';
  const search = document.getElementById('league-search-input')?.value || '';
  const caravanId = document.getElementById('league-caravan-filter')?.value || 'all';

  try {
    const res = await request(`/api/v1/admin/leaderboard/caravans?sortBy=${encodeURIComponent(sortBy)}&search=${encodeURIComponent(search)}`);
    if (!res.ok) throw new Error('خطا در ارتباط با سرور');
    let caravans = await res.json();

    if (caravanId && caravanId !== 'all') {
      caravans = caravans.filter(c => c.id === caravanId);
    }

    tbody.innerHTML = '';
    if (!caravans || caravans.length === 0) {
      tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; padding: 25px; color: var(--text-secondary);">موردی برای نمایش یافت نشد.</td></tr>';
      return;
    }

    caravans.forEach((c, idx) => {
      const rank = idx + 1;
      let rankBadge = `<span style="font-weight:bold; color:var(--text-secondary);">${rank}</span>`;
      let trStyle = '';
      if (rank === 1) {
        rankBadge = '<span style="font-size: 18px; filter: drop-shadow(0 0 6px #fbbf24);" title="رتبه ۱ - طلایی">🥇</span>';
        trStyle = 'background: rgba(251, 191, 36, 0.07); border-right: 3px solid #fbbf24;';
      } else if (rank === 2) {
        rankBadge = '<span style="font-size: 18px; filter: drop-shadow(0 0 6px #94a3b8);" title="رتبه ۲ - نقره‌ای">🥈</span>';
        trStyle = 'background: rgba(148, 163, 184, 0.05); border-right: 3px solid #94a3b8;';
      } else if (rank === 3) {
        rankBadge = '<span style="font-size: 18px; filter: drop-shadow(0 0 6px #b45309);" title="رتبه ۳ - برنزی">🥉</span>';
        trStyle = 'background: rgba(180, 83, 9, 0.05); border-right: 3px solid #b45309;';
      }

      const tr = document.createElement('tr');
      if (trStyle) tr.style = trStyle;
      tr.innerHTML = `
        <td style="text-align: center; vertical-align: middle;">${rankBadge}</td>
        <td>
          <div style="font-weight: 700; font-size: 14px; color: #fff;">${c.name}</div>
        </td>
        <td>
          <div style="font-size: 13px; font-weight: 500;">${c.mentorName || '-'}</div>
          ${c.mentorPhone && c.mentorPhone !== '-' ? `<span style="font-size: 11px; color: var(--text-secondary);">${c.mentorPhone}</span>` : ''}
        </td>
        <td style="text-align: center;">
          <span style="background: rgba(255,255,255,0.08); padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">${c.memberCount} / ${c.capacityLimit}</span>
        </td>
        <td style="color: #fbbf24; font-weight: 600;">${(c.zarik || 0).toLocaleString()}</td>
        <td style="color: #a78bfa; font-weight: 600;">${(c.nakh || 0).toLocaleString()}</td>
        <td style="color: #ef4444; font-weight: 600;">${(c.farsh || 0).toLocaleString()}</td>
        <td style="color: #3b82f6; font-weight: 600;">${(c.beyragh || 0).toLocaleString()}</td>
        <td style="color: #f59e0b; font-weight: 600;">⭐ ${c.stars || 0}</td>
        <td><span style="color: #00f2fe; font-weight: 600;">🎯 ${c.challengeScore || 0}</span></td>
        <td style="min-width: 110px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <div style="flex: 1; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
              <div style="height: 100%; width: ${Math.min(100, c.overallProgress || 0)}%; background: linear-gradient(to left, #10b981, #00f2fe); border-radius: 3px;"></div>
            </div>
            <span style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">${c.overallProgress || 0}%</span>
          </div>
        </td>
        <td style="color: #10b981; font-weight: 800; font-size: 14px;">${(c.totalScore || 0).toLocaleString()}</td>
        <td style="text-align: center; white-space: nowrap;">
          <button class="page-btn" style="padding: 4px 10px; font-size: 11px;" onclick="if(typeof viewCaravanDetails==='function'){viewCaravanDetails('${c.id}')}else{alert('کاروان: ${c.name}');}">
            <i class="fa-solid fa-eye" style="margin-left: 4px;"></i>اعضا
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load caravans leaderboard', err);
    tbody.innerHTML = `<tr><td colspan="13" style="text-align:center; padding: 25px; color: var(--color-danger);"><i class="fa-solid fa-triangle-exclamation" style="margin-left: 6px;"></i>خطا در بارگذاری اطلاعات: ${err.message}</td></tr>`;
  }
}

async function loadIndividualsLeaderboard() {
  const tbody = document.querySelector('#individuals-leaderboard-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="14" style="text-align:center; padding: 25px; color: var(--text-secondary);"><i class="fa-solid fa-spinner fa-spin" style="margin-left: 8px;"></i> در حال دریافت رتبه‌بندی افراد...</td></tr>';

  const role = document.getElementById('league-role-filter')?.value || 'all';
  const caravanId = document.getElementById('league-caravan-filter')?.value || 'all';
  const sortBy = document.getElementById('league-sort-by')?.value || 'totalScore';
  const search = document.getElementById('league-search-input')?.value || '';

  try {
    const res = await request(`/api/v1/admin/leaderboard/individuals?role=${encodeURIComponent(role)}&caravanId=${encodeURIComponent(caravanId)}&sortBy=${encodeURIComponent(sortBy)}&search=${encodeURIComponent(search)}`);
    if (!res.ok) throw new Error('خطا در ارتباط با سرور');
    const users = await res.json();

    tbody.innerHTML = '';
    if (!users || users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="14" style="text-align:center; padding: 25px; color: var(--text-secondary);">موردی برای نمایش یافت نشد.</td></tr>';
      return;
    }

    users.forEach((u, idx) => {
      const rank = idx + 1;
      let rankBadge = `<span style="font-weight:bold; color:var(--text-secondary);">${rank}</span>`;
      let trStyle = '';
      if (rank === 1) {
        rankBadge = '<span style="font-size: 18px; filter: drop-shadow(0 0 6px #fbbf24);" title="رتبه ۱ - طلایی">🥇</span>';
        trStyle = 'background: rgba(251, 191, 36, 0.07); border-right: 3px solid #fbbf24;';
      } else if (rank === 2) {
        rankBadge = '<span style="font-size: 18px; filter: drop-shadow(0 0 6px #94a3b8);" title="رتبه ۲ - نقره‌ای">🥈</span>';
        trStyle = 'background: rgba(148, 163, 184, 0.05); border-right: 3px solid #94a3b8;';
      } else if (rank === 3) {
        rankBadge = '<span style="font-size: 18px; filter: drop-shadow(0 0 6px #b45309);" title="رتبه ۳ - برنزی">🥉</span>';
        trStyle = 'background: rgba(180, 83, 9, 0.05); border-right: 3px solid #b45309;';
      }

      const roleBadge = u.role === 'mentor'
        ? '<span style="background: rgba(99, 102, 241, 0.2); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.4); padding: 2px 8px; border-radius: 6px; font-size: 11px;">راهبر</span>'
        : '<span style="background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); padding: 2px 8px; border-radius: 6px; font-size: 11px;">دانش‌آموز</span>';

      const tr = document.createElement('tr');
      if (trStyle) tr.style = trStyle;
      tr.innerHTML = `
        <td style="text-align: center; vertical-align: middle;">${rankBadge}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,0.1); overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 14px;">
              ${u.avatarUrl ? `<img src="${u.avatarUrl}" style="width:100%;height:100%;object-fit:cover;">` : '<i class="fa-solid fa-user" style="color:var(--text-secondary);"></i>'}
            </div>
            <div>
              <div style="font-weight: 700; font-size: 13px; color: #fff;">${u.name}</div>
              <div style="font-size: 11px; color: var(--text-secondary);">${u.phoneNumber || ''}</div>
            </div>
          </div>
        </td>
        <td>${roleBadge}</td>
        <td><span style="background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 6px; font-size: 12px;">${u.caravanName}</span></td>
        <td style="color: #fbbf24; font-weight: 600;">${(u.zarik || 0).toLocaleString()}</td>
        <td style="color: #a78bfa; font-weight: 600;">${(u.nakh || 0).toLocaleString()}</td>
        <td style="color: #ef4444; font-weight: 600;">${(u.farsh || 0).toLocaleString()}</td>
        <td style="color: #3b82f6; font-weight: 600;">${(u.beyragh || 0).toLocaleString()}</td>
        <td style="color: #f59e0b; font-weight: 600;">⭐ ${u.stars || 0}</td>
        <td><span style="color: #38bdf8; font-weight: 600;">📝 ${u.quizScore || 0}</span></td>
        <td><span style="color: #00f2fe; font-weight: 600;">🎯 ${u.challengeScore || 0}</span></td>
        <td style="min-width: 100px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <div style="flex: 1; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
              <div style="height: 100%; width: ${Math.min(100, u.progressPercentage || 0)}%; background: linear-gradient(to left, #6366f1, #38bdf8); border-radius: 3px;"></div>
            </div>
            <span style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">${u.progressPercentage || 0}%</span>
          </div>
        </td>
        <td style="color: #10b981; font-weight: 800; font-size: 14px;">${(u.totalScore || 0).toLocaleString()}</td>
        <td style="text-align: center; white-space: nowrap;">
          <button class="page-btn" style="padding: 3px 8px; font-size: 11px;" onclick="viewUserDetails('${u.id}')" title="مشاهده پروفایل">
            <i class="fa-solid fa-user"></i>
          </button>
          <button class="page-btn" style="padding: 3px 8px; font-size: 11px; margin-right: 4px;" onclick="document.getElementById('zarik-target-user').value='${u.id}';window.scrollTo({top: document.body.scrollHeight, behavior: 'smooth'});" title="تعدیل زریک">
            <i class="fa-solid fa-coins"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load individuals leaderboard', err);
    tbody.innerHTML = `<tr><td colspan="14" style="text-align:center; padding: 25px; color: var(--color-danger);"><i class="fa-solid fa-triangle-exclamation" style="margin-left: 6px;"></i>خطا در بارگذاری اطلاعات: ${err.message}</td></tr>`;
  }
}

function exportCurrentLeague(type) {
  const sortBy = document.getElementById('league-sort-by')?.value || 'totalScore';
  const search = document.getElementById('league-search-input')?.value || '';
  const caravanId = document.getElementById('league-caravan-filter')?.value || 'all';
  const role = document.getElementById('league-role-filter')?.value || 'all';

  if (currentLeagueTab === 'caravans') {
    const url = `/api/v1/admin/leaderboard/caravans?sortBy=${encodeURIComponent(sortBy)}&search=${encodeURIComponent(search)}&exportAs=csv`;
    window.open(url, '_blank');
  } else {
    const url = `/api/v1/admin/leaderboard/individuals?role=${encodeURIComponent(role)}&caravanId=${encodeURIComponent(caravanId)}&sortBy=${encodeURIComponent(sortBy)}&search=${encodeURIComponent(search)}&exportAs=csv`;
    window.open(url, '_blank');
  }
}

async function loadAssetLeaderboard() {
  loadLeagueCaravansOptions();
  if (currentLeagueTab === 'caravans') {
    loadCaravansLeaderboard();
  } else {
    loadIndividualsLeaderboard();
  }
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
window.openUserModal = async function(id = '', name = '', role = 'student', caravanId = '', levelFrame = 1, mentorLevel = 1, nationalId = '', dateOfBirth = '') {
  let user = null;
  if (id) {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('nopa_admin_token') || '';
      const res = await fetch(`/api/v1/admin/users/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
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
  document.getElementById('modal-user-name').value = userName;
  document.getElementById('modal-user-role').value = userRole;
  document.getElementById('modal-user-level').value = userLevel;
  document.getElementById('modal-user-mentor-level').value = userMentorLevel;
  document.getElementById('modal-user-national-id').value = userNationalId;
  document.getElementById('modal-user-dob').value = userDob;
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
      options += caravans.map(c => `<option value="${c.id}" ${c.id === userCaravanId ? 'selected' : ''}>${c.name || c.title}</option>`).join('');
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
    modal.style.zIndex = '999999';
  }
};

function openUserModal(id = '', name = '', role = 'student', caravanId = '', levelFrame = 1, mentorLevel = 1, nationalId = '', dateOfBirth = '') {
  return window.openUserModal(id, name, role, caravanId, levelFrame, mentorLevel, nationalId, dateOfBirth);
}

async function handleUserFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('edit-user-id').value;
  const name = document.getElementById('modal-user-name').value;
  const role = document.getElementById('modal-user-role').value;
  const caravanId = document.getElementById('modal-user-caravan').value;
  const levelFrame = parseInt(document.getElementById('modal-user-level').value) || 1;
  const mentorLevel = parseInt(document.getElementById('modal-user-mentor-level').value) || 1;
  const nationalId = document.getElementById('modal-user-national-id').value;
  const dateOfBirth = document.getElementById('modal-user-dob').value;
  const academicDegree = document.getElementById('modal-user-degree')?.value;
  const academicCertificates = document.getElementById('modal-user-certificates')?.value;
  const phoneNumber = document.getElementById('modal-user-phone')?.value;

  let res;
  if (id) {
    // Edit User
    res = await request(`/api/v1/admin/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phoneNumber, role, caravanId: caravanId || null, levelFrame, mentorLevel, nationalId, dateOfBirth, academicDegree, academicCertificates })
    });
  } else {
    // Create User
    const password = document.getElementById('modal-user-password').value;
    res = await request('/api/v1/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phoneNumber, password, role, caravanId: caravanId || null, levelFrame, mentorLevel, nationalId, dateOfBirth })
    });
  }

  const data = await res.json();
  if (res.ok) {
    alert(data.message || 'مشخصات کاربر با موفقیت ذخیره شد');
    document.getElementById('user-modal-overlay').style.display = 'none';
    if (typeof loadUsers === 'function') loadUsers();
    if (typeof loadAllUsersDropdown === 'function') loadAllUsersDropdown();
    if (typeof loadCaravansTab === 'function') await loadCaravansTab();
    if (typeof window.loadSelectedCaravanDetails === 'function') window.loadSelectedCaravanDetails();
  } else {
    alert(data.error || 'خطا در ثبت اطلاعات');
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
    if (!res.ok) return;
    const data = await res.json();

    // Stats display update
    const totalZarikElem = document.getElementById('stats-total-zarik');
    if (totalZarikElem && data.circulation !== undefined) {
      totalZarikElem.textContent = data.circulation.toLocaleString();
    }

    // Wealth chart
    const wealthCanvas = document.getElementById('wealthChart');
    if (wealthCanvas && typeof Chart !== 'undefined') {
      const wealthCtx = wealthCanvas.getContext('2d');
      if (wealthChart) wealthChart.destroy();
      
      wealthChart = new Chart(wealthCtx, {
        type: 'bar',
        data: {
          labels: data.topWealthy ? data.topWealthy.map(w => w.name) : [],
          datasets: [{
            label: 'موجودی زریک (۵ نفر برتر)',
            data: data.topWealthy ? data.topWealthy.map(w => w.zarikBalance) : [],
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
    }

    // Velocity chart (distribution by category)
    const velCanvas = document.getElementById('velocityChart');
    if (velCanvas && typeof Chart !== 'undefined') {
      const velCtx = velCanvas.getContext('2d');
      if (velocityChart) velocityChart.destroy();

      velocityChart = new Chart(velCtx, {
        type: 'doughnut',
        data: {
          labels: data.distributions ? data.distributions.map(d => d.category) : [],
          datasets: [{
            data: data.distributions ? data.distributions.map(d => Math.abs(d.totalAmount)) : [],
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
    }

  } catch (err) {
    console.error('loadZarikAnalytics error:', err);
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
// 4. CARAVANS & MENTORS
window.caravansData = [];

async function loadCaravansTab() {
  try {
    const res = await request('/api/v1/admin/caravans');
    if (!res.ok) {
      console.warn('Failed to load /api/v1/admin/caravans');
      return;
    }
    const data = await res.json();
    window.caravansData = Array.isArray(data) ? data : (data.caravans || data.data || []);
    
    // Populate Mentor Filter
    const mentorSelect = document.getElementById('caravan-mentor-filter');
    if (mentorSelect) {
      const mentors = new Set(window.caravansData.map(c => c.mentor?.name || c.mentorName || '-').filter(n => n !== '-'));
      mentorSelect.innerHTML = '<option value="all">همه مربیان</option>';
      mentors.forEach(m => {
        mentorSelect.innerHTML += `<option value="${m}">${m}</option>`;
      });
    }

    // Populate Caravan Picker
    const caravanPicker = document.getElementById('target-caravan-picker');
    if (caravanPicker) {
      const currentVal = caravanPicker.value;
      caravanPicker.innerHTML = '<option value="">-- لطفاً یک کاروان انتخاب کنید --</option>';
      window.caravansData.forEach(c => {
        caravanPicker.innerHTML += `<option value="${c.id}">${c.name}</option>`;
      });
      caravanPicker.onchange = window.loadSelectedCaravanDetails;
      
      if (currentVal && window.caravansData.some(c => c.id === currentVal)) {
        caravanPicker.value = currentVal;
      } else if (!caravanPicker.value && window.caravansData.length > 0) {
        caravanPicker.value = window.caravansData[0].id;
      }
      window.loadSelectedCaravanDetails();
    }

    renderCaravansTable();
  } catch (err) {
    console.error('loadCaravansTab error:', err);
  }
}

window.renderCaravansTable = function() {
  const tbody = document.querySelector('#caravan-performance-table tbody') || document.getElementById('caravans-tbody');
  if (!tbody) return;

  if (!window.caravansData || window.caravansData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:#94a3b8;">هیچ کاروانی یافت نشد.</td></tr>';
    return;
  }

  const searchQuery = (document.getElementById('caravan-search-input')?.value || '').toLowerCase().trim();
  const sortBy = document.getElementById('caravan-sort-select')?.value || 'newest';
  const mentorFilter = document.getElementById('caravan-mentor-filter')?.value || 'all';

  let filtered = window.caravansData.filter(c => {
    const mName = c.mentor?.name || c.mentorName || '-';
    const cName = c.name || c.title || '';
    const matchesSearch = !searchQuery || 
                          cName.toLowerCase().includes(searchQuery) || 
                          mName.toLowerCase().includes(searchQuery) ||
                          (c.id && c.id.toLowerCase().includes(searchQuery));
    const matchesMentor = mentorFilter === 'all' || mName === mentorFilter;
    return matchesSearch && matchesMentor;
  });

  if (sortBy === 'most_members') {
    filtered.sort((a, b) => (b._count?.members || b.membersList?.length || b.memberCount || 0) - (a._count?.members || a.membersList?.length || a.memberCount || 0));
  } else if (sortBy === 'highest_zarik') {
    filtered.sort((a, b) => (b.assets?.zarik || b.totalWealth || b.wealth?.zarik || 0) - (a.assets?.zarik || a.totalWealth || a.wealth?.zarik || 0));
  } else if (sortBy === 'highest_progress') {
    filtered.sort((a, b) => (b.overallProgress || b.progress || 0) - (a.overallProgress || a.progress || 0));
  }

  tbody.innerHTML = '';
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:#94a3b8;">کاروانی با این مشخصات یافت نشد.</td></tr>';
    return;
  }

  filtered.forEach(c => {
    const memberCount = c._count?.members ?? c.membersList?.length ?? c.memberCount ?? 0;
    const capacity = c.capacityLimit ?? c.capacity ?? 50;
    const totalZarik = (c.assets?.zarik ?? c.totalWealth ?? c.wealth?.zarik ?? 0).toLocaleString();
    const progress = c.overallProgress ?? c.progress ?? 0;
    const mentorDisplay = c.mentor?.name || c.mentorName || 'بدون راهبر';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${c.name || c.title}</strong></td>
      <td><span class="badge badge-student">${mentorDisplay}</span></td>
      <td>${memberCount} / ${capacity}</td>
      <td>
        <span style="color:#fbbf24;"><i class="fa-solid fa-coins"></i> ${totalZarik}</span>
      </td>
      <td>
        <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:6px;">
          <span>${progress}%</span>
        </div>
        <div class="progress-bar-container" style="margin: 0; height: 6px;">
          <div class="progress-bar-fill" style="width: ${progress}%"></div>
        </div>
      </td>
      <td style="color:#94a3b8; font-size:12px;">لحظاتی پیش</td>
      <td>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button class="page-btn btn-view" style="padding: 4px 8px; font-size:11px; background:#0284c7; color:white; border-radius:6px; border:none; cursor:pointer;" onclick="window.selectCaravanForManagement('${c.id}')" title="مشاهده کاروان">
            <i class="fa-solid fa-eye"></i> مشاهده
          </button>
          <button class="page-btn" style="padding: 4px 8px; font-size:11px; background:#3b82f6; color:white; border-radius:6px; border:none; cursor:pointer;" onclick="window.openChangeCaravanMentorModalForCaravan('${c.id}')" title="تغییر راهبر">
            <i class="fa-solid fa-user-gear"></i> تغییر راهبر
          </button>
          <button class="page-btn" style="padding: 4px 8px; font-size:11px; background:#ef4444; color:white; border-radius:6px; border:none; cursor:pointer;" onclick="window.deleteCaravanRecord('${c.id}', '${(c.name || '').replace(/'/g, "\\'")}')" title="حذف کاروان">
            <i class="fa-solid fa-trash"></i> حذف
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
};

window.selectCaravanForManagement = function(id) {
  const picker = document.getElementById('target-caravan-picker');
  if (picker) {
    picker.value = id;
    if (window.loadSelectedCaravanDetails) {
      window.loadSelectedCaravanDetails();
    }
    const detailsSection = picker.closest('.panel-card');
    if (detailsSection) {
      detailsSection.scrollIntoView({ behavior: 'smooth' });
    }
  }
};

function selectCaravanForManagement(id) {
  return window.selectCaravanForManagement(id);
}

window.openChangeCaravanMentorModalForCaravan = function(id) {
  window.selectCaravanForManagement(id);
  if (window.openChangeCaravanMentorModal) {
    window.openChangeCaravanMentorModal();
  }
};

function openChangeCaravanMentorModalForCaravan(id) {
  return window.openChangeCaravanMentorModalForCaravan(id);
}

window.deleteCaravanRecord = async function(caravanId, caravanName) {
  if (!confirm(`آیا از حذف کاروان "${caravanName || ''}" اطمینان دارید؟ اعضای این کاروان آزاد خواهند شد.`)) {
    return;
  }
  try {
    const token = localStorage.getItem('token') || localStorage.getItem('nopa_admin_token') || '';
    const res = await fetch(`/api/v1/admin/caravans/${caravanId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      alert('کاروان با موفقیت حذف گردید.');
      if (typeof window.loadCaravansTab === 'function') {
        await window.loadCaravansTab();
      }
    } else {
      const err = await res.json();
      alert(err.error || 'خطا در حذف کاروان');
    }
  } catch (e) {
    console.error(e);
    alert('خطا در ارتباط با سرور');
  }
};

function deleteCaravanRecord(caravanId, caravanName) {
  return window.deleteCaravanRecord(caravanId, caravanName);
}

window.removeMemberFromCaravan = async function(caravanId, studentId, memberName) {
  const nameText = memberName ? `«${memberName}»` : 'این فرد';
  if (!confirm(`آیا می‌خواهید ${nameText} را از این کاروان حذف کنید؟`)) {
    return;
  }
  try {
    const token = localStorage.getItem('token') || localStorage.getItem('nopa_admin_token') || '';
    const res = await fetch(`/api/v1/admin/caravans/${caravanId}/members/${studentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      alert(`فرد با موفقیت از این کاروان حذف گردید.`);
      if (typeof window.loadCaravansTab === 'function') {
        await window.loadCaravansTab();
      }
      const picker = document.getElementById('target-caravan-picker');
      if (picker) {
        picker.value = caravanId;
      }
      if (typeof window.loadSelectedCaravanDetails === 'function') {
        window.loadSelectedCaravanDetails();
      }
    } else {
      const err = await res.json();
      alert(err.error || 'خطا در حذف فرد از کاروان');
    }
  } catch (e) {
    console.error(e);
    alert('خطا در ارتباط با سرور');
  }
};

function removeMemberFromCaravan(caravanId, studentId, memberName) {
  return window.removeMemberFromCaravan(caravanId, studentId, memberName);
}

window.viewStudentDetails = async function(studentId) {
  const modal = document.getElementById('caravan-student-detail-modal');
  if (!modal) return;

  const identityEl = document.getElementById('csd-identity');
  const assetsEl = document.getElementById('csd-assets');
  const progressEl = document.getElementById('csd-progress');
  const ticketsEl = document.getElementById('csd-tickets');

  if (identityEl) identityEl.innerHTML = '<p style="color:#94a3b8; font-size:13px;">در حال بارگذاری...</p>';
  if (assetsEl) assetsEl.innerHTML = '<p style="color:#94a3b8; font-size:13px;">در حال بارگذاری...</p>';
  if (progressEl) progressEl.innerHTML = '<p style="color:#94a3b8; font-size:13px;">در حال بارگذاری...</p>';
  if (ticketsEl) ticketsEl.innerHTML = '<p style="color:#94a3b8; font-size:13px;">در حال بارگذاری...</p>';

  modal.style.display = 'flex';
  modal.style.zIndex = '999999';

  try {
    const token = localStorage.getItem('token') || localStorage.getItem('nopa_admin_token') || '';
    let data = {};
    let u = null;
    let balances = {};
    let watchRecords = [];
    let quizzes = [];
    let tickets = [];
    let metrics = {};

    const res = await fetch(`/api/v1/admin/users/${studentId}/analytics`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.ok) {
      data = await res.json();
      u = data.user || {};
      balances = data.balances || {};
      watchRecords = data.watchRecords || [];
      quizzes = data.quizzes || [];
      tickets = data.tickets || [];
      metrics = data.metrics || {};
    } else {
      const basicRes = await fetch(`/api/v1/admin/users/${studentId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (basicRes.ok) {
        u = await basicRes.json();
        balances = {
          zarik: u.zarikBalance || 0,
          nakh: u.nakh || 0,
          beyragh: u.beyragh || 0,
          farsh: u.farsh || 0
        };
      }
    }

    if (!u) {
      if (identityEl) identityEl.innerHTML = '<p style="color:#ef4444;">کاربر یافت نشد.</p>';
      return;
    }

    // Determine Caravan Name
    let caravanDisplay = u.caravanName || 'فاقد کاروان';
    if (!u.caravanName && u.caravanId) {
      const c = window.caravansData?.find(item => item.id === u.caravanId);
      if (c) caravanDisplay = c.name || c.title || u.caravanId;
    }

    if (identityEl) {
      identityEl.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:8px;">
          <div><strong style="color:#38bdf8;">نام و نام‌خانوادگی:</strong> ${u.name || 'بدون نام'}</div>
          <div><strong style="color:#94a3b8;">شماره همراه:</strong> <span dir="ltr">${u.phoneNumber || '-'}</span></div>
          <div><strong style="color:#94a3b8;">کد کاربری:</strong> <span style="font-family:monospace; color:#38bdf8;">${u.userCode ? 'NP-' + u.userCode : (u.id ? u.id.slice(0, 8) : '-')}</span></div>
          <div><strong style="color:#94a3b8;">کاروان عضو:</strong> <span style="background:rgba(56,189,248,0.15); color:#38bdf8; padding:3px 10px; border-radius:6px; font-weight:bold;">${caravanDisplay}</span></div>
          <div><strong style="color:#94a3b8;">نقش سیستمی:</strong> ${u.role === 'mentor' ? 'مربی' : u.role === 'admin' ? 'مدیر' : 'دانش‌آموز'}</div>
          <div><strong style="color:#94a3b8;">کد ملی:</strong> ${u.nationalId || 'ثبت نشده'}</div>
          <div><strong style="color:#94a3b8;">تاریخ تولد:</strong> ${u.dateOfBirth || '-'}</div>
          <div><strong style="color:#94a3b8;">سطح فریم:</strong> سطح ${u.levelFrame || 1}</div>
        </div>
      `;
    }

    if (assetsEl) {
      assetsEl.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:8px;">
          <div><strong style="color:#fbbf24;"><i class="fa-solid fa-coins"></i> موجودی زریک:</strong> <span style="font-size:16px; font-weight:bold; color:#fbbf24;">${(balances.zarik || u.zarikBalance || 0).toLocaleString()}</span> زریک</div>
          <div><strong style="color:#a78bfa;"><i class="fa-solid fa-layer-group"></i> نخ:</strong> ${(balances.nakh || 0).toLocaleString()}</div>
          <div><strong style="color:#38bdf8;"><i class="fa-solid fa-flag"></i> بیرق:</strong> ${(balances.beyragh || 0).toLocaleString()}</div>
          <div><strong style="color:#10b981;"><i class="fa-solid fa-rug"></i> فرش:</strong> ${(balances.farsh || 0).toLocaleString()}</div>
          <div><strong style="color:#94a3b8;">مدت فعالیت تقریبی:</strong> ${metrics.approximateActiveMinutes || 0} دقیقه</div>
        </div>
      `;
    }

    if (progressEl) {
      const sp = data.stationsProgress || {};
      const summary = sp.summary || {
        passedStations: 0,
        totalStations: 5,
        totalCategories: 10,
        passedClasses: 0,
        totalClasses: 50,
        passedParts: 0,
        totalParts: 201,
        passedQuizzes: 0,
        totalQuizzes: 331
      };

      const stations = sp.stations || [
        { stationNumber: 1, title: 'منزلگاه ۱: مبانی شناخت و رسانه (شوک و اینشات)', order: 1, isUnlocked: true, isCompleted: false, categoriesCount: 2, totalClasses: 4, completedClasses: 0, partsPerSession: '4', totalParts: 16, completedParts: 0, totalQuizzes: 32, completedQuizzes: 0 },
        { stationNumber: 2, title: 'منزلگاه ۲: خودشناسی جامع و پادکست', order: 2, isUnlocked: false, isCompleted: false, categoriesCount: 2, totalClasses: 16, completedClasses: 0, partsPerSession: '4', totalParts: 64, completedParts: 0, totalQuizzes: 126, completedQuizzes: 0 },
        { stationNumber: 3, title: 'منزلگاه ۳: شناخت همراهان و دشمنان (کنوا)', order: 3, isUnlocked: false, isCompleted: false, categoriesCount: 2, totalClasses: 12, completedClasses: 0, partsPerSession: '4.1', totalParts: 49, completedParts: 0, totalQuizzes: 85, completedQuizzes: 0 },
        { stationNumber: 4, title: 'منزلگاه ۴: شناخت هستی (کنوا پیشرفته)', order: 4, isUnlocked: false, isCompleted: false, categoriesCount: 2, totalClasses: 8, completedClasses: 0, partsPerSession: '4', totalParts: 32, completedParts: 0, totalQuizzes: 46, completedQuizzes: 0 },
        { stationNumber: 5, title: 'منزلگاه ۵: هدف‌گذاری (فتوشاپ)', order: 5, isUnlocked: false, isCompleted: false, categoriesCount: 2, totalClasses: 10, completedClasses: 0, partsPerSession: '4', totalParts: 40, completedParts: 0, totalQuizzes: 42, completedQuizzes: 0 }
      ];

      let stationsHtml = `
        <!-- Summary Stats Counter -->
        <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:6px; margin-bottom:12px; background:rgba(0,0,0,0.4); padding:10px; border-radius:10px; border:1px solid rgba(255,255,255,0.06); text-align:center;">
          <div style="padding:2px;">
            <div style="color:#94a3b8; font-size:10px; margin-bottom:2px;">منزلگاه‌ها</div>
            <div style="font-weight:bold; color:#10b981; font-size:13px;">${summary.passedStations || 0} / ${summary.totalStations || 5}</div>
          </div>
          <div style="padding:2px; border-right:1px solid rgba(255,255,255,0.1);">
            <div style="color:#94a3b8; font-size:10px; margin-bottom:2px;">دسته‌ها / کلاس‌ها</div>
            <div style="font-weight:bold; color:#38bdf8; font-size:13px;">${summary.passedClasses || 0} / ${summary.totalClasses || 50}</div>
          </div>
          <div style="padding:2px; border-right:1px solid rgba(255,255,255,0.1);">
            <div style="color:#94a3b8; font-size:10px; margin-bottom:2px;">کل پارت‌ها</div>
            <div style="font-weight:bold; color:#a78bfa; font-size:13px;">${summary.passedParts || 0} / ${summary.totalParts || 201}</div>
          </div>
          <div style="padding:2px; border-right:1px solid rgba(255,255,255,0.1);">
            <div style="color:#94a3b8; font-size:10px; margin-bottom:2px;">آزمونک‌ها</div>
            <div style="font-weight:bold; color:#fbbf24; font-size:13px;">${summary.passedQuizzes || 0} / ${summary.totalQuizzes || 331}</div>
          </div>
        </div>

        <!-- 5 Stations Progression List -->
        <div style="display:flex; flex-direction:column; gap:8px; max-height:260px; overflow-y:auto; padding-left:4px;">
      `;

      stations.forEach((st, idx) => {
        const isUnlocked = st.isUnlocked;
        const isCompleted = st.isCompleted || (st.completedClasses > 0 && st.completedClasses >= st.totalClasses);
        const stNum = st.stationNumber || (idx + 1);

        let statusBadge = '';
        let cardBorder = 'rgba(255,255,255,0.06)';
        let cardBg = 'rgba(15,23,42,0.6)';
        let titleColor = '#cbd5e1';

        if (isCompleted) {
          statusBadge = '<span style="background:rgba(16,185,129,0.2); color:#10b981; font-size:11px; padding:2px 8px; border-radius:12px; font-weight:bold;"><i class="fa-solid fa-circle-check"></i> گذرانده شده</span>';
          cardBorder = 'rgba(16,185,129,0.3)';
          cardBg = 'rgba(16,185,129,0.05)';
          titleColor = '#34d399';
        } else if (isUnlocked) {
          statusBadge = '<span style="background:rgba(56,189,248,0.2); color:#38bdf8; font-size:11px; padding:2px 8px; border-radius:12px; font-weight:bold;"><i class="fa-solid fa-play"></i> در حال آموزش</span>';
          cardBorder = 'rgba(56,189,248,0.3)';
          cardBg = 'rgba(56,189,248,0.05)';
          titleColor = '#38bdf8';
        } else {
          statusBadge = '<span style="background:rgba(239,68,68,0.15); color:#f87171; font-size:11px; padding:2px 8px; border-radius:12px; font-weight:bold;"><i class="fa-solid fa-lock"></i> قفل (مسیر آتی)</span>';
          cardBorder = 'rgba(255,255,255,0.04)';
          cardBg = 'rgba(0,0,0,0.25)';
          titleColor = '#64748b';
        }

        const pct = st.totalClasses > 0 ? Math.min(100, Math.round(((st.completedClasses || 0) / st.totalClasses) * 100)) : 0;

        stationsHtml += `
          <div style="background:${cardBg}; border:1px solid ${cardBorder}; border-radius:10px; padding:10px 12px; font-size:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:6px;">
              <div>
                <span style="background:rgba(56,189,248,0.2); color:#38bdf8; font-size:11px; font-weight:bold; padding:2px 7px; border-radius:6px; margin-left:6px;">منزلگاه ${stNum}</span>
                <strong style="color:${titleColor}; font-size:13px;">${st.title}</strong>
              </div>
              ${statusBadge}
            </div>

            <!-- Categorized Metrics Grid -->
            <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:6px 12px; font-size:11.5px;">
              <div style="color:#94a3b8;">
                <i class="fa-solid fa-layer-group" style="color:#38bdf8; width:16px;"></i> 
                <strong>دسته‌های کلاس:</strong> <span style="color:white; font-weight:bold;">${st.categoriesCount || 2} دسته</span> <span style="font-size:10px; color:#64748b;">(مهارتی و رسانه‌ای)</span>
              </div>

              <div style="color:#94a3b8;">
                <i class="fa-solid fa-chalkboard-user" style="color:#10b981; width:16px;"></i> 
                <strong>تعداد کلاس‌ها:</strong> <span style="color:white; font-weight:bold;">${st.completedClasses || 0}</span> از ${st.totalClasses || 0} جلسه <span style="color:#34d399; font-size:10px;">(${pct}%)</span>
              </div>

              <div style="color:#94a3b8;">
                <i class="fa-solid fa-film" style="color:#a78bfa; width:16px;"></i> 
                <strong>پارت‌های هر جلسه:</strong> <span style="color:white; font-weight:bold;">${st.partsPerSession || 4} پارت</span> <span style="font-size:10px; color:#a78bfa;">(مجموعاً ${st.totalParts || 0} پارت)</span>
              </div>

              <div style="color:#94a3b8;">
                <i class="fa-solid fa-list-check" style="color:#fbbf24; width:16px;"></i> 
                <strong>تعداد آزمون‌ها:</strong> <span style="color:#fbbf24; font-weight:bold;">${st.completedQuizzes || 0}</span> از ${st.totalQuizzes || 0} آزمونک
              </div>
            </div>
          </div>
        `;
      });

      stationsHtml += `</div>`;
      progressEl.innerHTML = stationsHtml;
    }

    if (ticketsEl) {
      if (tickets.length === 0) {
        ticketsEl.innerHTML = '<p style="color:#94a3b8; font-size:12px;">تیکت یا درخواستی ثبت نشده است.</p>';
      } else {
        ticketsEl.innerHTML = tickets.slice(0, 4).map(t => `
          <div style="border-bottom:1px solid rgba(255,255,255,0.05); padding:4px 0;">
            <strong style="color:white;">${t.subject || 'تیکت پشتیبانی'}</strong>
            <span style="color:#94a3b8; font-size:11px; margin-right:6px;">[${t.status === 'RESOLVED' ? 'حل شده' : 'در حال بررسی'}]</span>
          </div>
        `).join('');
      }
    }
  } catch(e) {
    console.error('Error fetching student details:', e);
    if (identityEl) identityEl.innerHTML = '<p style="color:#ef4444; font-size:13px;">خطا در دریافت اطلاعات دانش‌آموز</p>';
  }
};

function viewStudentDetails(studentId) {
  return window.viewStudentDetails(studentId);
}

window.setAccountStatus = async function(userId, status) {
  if (!confirm(`آیا از تغییر وضعیت حساب این کاربر اطمینان دارید؟`)) return;
  try {
    const token = localStorage.getItem('token') || localStorage.getItem('nopa_admin_token') || '';
    const res = await fetch(`/api/v1/admin/users/${userId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      alert('وضعیت حساب کاربر با موفقیت تغییر کرد');
      if (typeof window.loadSelectedCaravanDetails === 'function') {
        window.loadSelectedCaravanDetails();
      }
    } else {
      const err = await res.json();
      alert(err.error || 'خطا در تغییر وضعیت کاربر');
    }
  } catch(e) {
    console.error(e);
    alert('خطا در ارتباط با سرور');
  }
};

function setAccountStatus(userId, status) {
  return window.setAccountStatus(userId, status);
}



window.loadSelectedCaravanDetails = async function() {
  const picker = document.getElementById('target-caravan-picker');
  if (!picker) return;
  const cId = picker.value;
  
  const mentorEl = document.getElementById('cw-mentor-name');
  const zarikEl = document.getElementById('caravan-detail-zarik');
  const milestonesEl = document.getElementById('caravan-detail-milestones');
  const rosterBody = document.getElementById('caravan-roster-body');

  if (!zarikEl || !milestonesEl || !rosterBody) return;

  if (!cId) {
    if (mentorEl) mentorEl.innerText = '-';
    zarikEl.innerHTML = '0 <i class="fa-solid fa-coins"></i>';
    milestonesEl.innerText = '0';
    rosterBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#64748b;">کاروانی انتخاب نشده است.</td></tr>';
    return;
  }

  const caravan = window.caravansData?.find(c => c.id === cId);
  if (!caravan) return;

  if (mentorEl) {
    mentorEl.innerText = caravan.mentorName || caravan.mentor?.name || 'فاقد راهبر';
  }

  const zarikVal = (caravan.assets?.zarik ?? caravan.totalWealth ?? caravan.wealth?.zarik ?? 0).toLocaleString();
  zarikEl.innerHTML = `${zarikVal} <i class="fa-solid fa-coins"></i>`;
  milestonesEl.innerText = caravan.overallProgress ? `${caravan.overallProgress}%` : '0%';

  rosterBody.innerHTML = '';
  const members = caravan.membersList || caravan.members || [];
  if (members.length === 0) {
    rosterBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#64748b;">این کاروان عضوی ندارد.</td></tr>';
  } else {
    members.forEach(m => {
      const name = m.name || m.user?.name || '-';
      const phone = m.phoneNumber || m.user?.phoneNumber || '-';
      const zarik = (m.zarikBalance ?? m.zarik ?? m.assets?.zarik ?? 0).toLocaleString();
      const displayId = m.userCode ? `NP-${m.userCode}` : (m.user?.userCode ? `NP-${m.user?.userCode}` : (m.id || '-'));
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-family: monospace; color: #38bdf8;">${displayId}</td>
        <td><strong>${name}</strong></td>
        <td style="font-family: monospace;" dir="ltr">${phone}</td>
        <td style="color:#fbbf24;"><i class="fa-solid fa-coins"></i> ${zarik}</td>
        <td style="white-space:nowrap; display:flex; gap:5px;">
          <button class="btn-action" style="background:#3b82f6; color:white; padding:4px 8px; font-size:11px; border-radius:6px; cursor:pointer;" onclick="window.viewStudentDetails('${m.id}')">نمایش جزئیات</button>
          <button class="btn-action" style="background:#6366f1; color:white; padding:4px 8px; font-size:11px; border-radius:6px; cursor:pointer;" onclick="window.openUserModal('${m.id}', '${name}', '${m.role || 'student'}', '${cId}')">ویرایش</button>
          <button class="btn-action" style="background:#f59e0b; color:white; padding:4px 8px; font-size:11px; border-radius:6px; cursor:pointer;" onclick="window.setAccountStatus('${m.id}', 'SUSPENDED')">تعلیق موقت</button>
          <button class="btn-action" style="background:#ef4444; color:white; padding:4px 8px; font-size:11px; border-radius:6px; cursor:pointer;" onclick="window.removeMemberFromCaravan('${cId}', '${m.id}', '${name.replace(/'/g, "\\'")}')">حذف فرد</button>
        </td>
      `;
      rosterBody.appendChild(tr);
    });
  }
};


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
  const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
  try {
    let url = `/api/v1/admin/export?type=${type}&format=${format}`;
    
    // Append current filters for league
    if (type === 'mentors_league') {
      const search = document.getElementById('mentor-league-search')?.value || '';
      const timeframe = document.getElementById('mentor-league-filter')?.value || 'weekly';
      const sortBy = document.getElementById('mentor-league-sort')?.value || 'rating';
      url += `&search=${encodeURIComponent(search)}&timeframe=${timeframe}&sortBy=${sortBy}`;
    }

    const res = await fetch(url, {
      headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'خطا در تولید فایل خروجی');
    }
    
    const buffer = await res.arrayBuffer();
    const mimeType = format === 'pdf' ? 'application/pdf' 
                   : (format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv;charset=utf-8;');
    
    const blob = new Blob([buffer], { type: mimeType });
    const downloadUrl = window.URL.createObjectURL(blob);
    
    const extension = format === 'excel' ? 'xlsx' : format;
    const fileName = `export_${type}_${Date.now()}.${extension}`;
    
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      window.URL.revokeObjectURL(downloadUrl);
      a.remove();
    }, 15000);
  } catch (error) {
    console.error('Export Error:', error);
    alert('خطا در دریافت فایل خروجی: ' + error.message);
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
// MODULE A: MENTORS OPERATIONS & DOSSIER
// ===============================

window.mentorsMasterList = [];

window.calculateMentorStars = function(ratings, evals) {
  let sum = 0, count = 0;
  if (Array.isArray(ratings)) {
    ratings.forEach(r => {
      const v = Number(r.ratingValue) || Number(r.rating) || 0;
      if (v > 0) { sum += v; count++; }
    });
  }
  if (Array.isArray(evals)) {
    evals.forEach(e => {
      const v = Number(e.rating) || Number(e.responsivenessScore) || 0;
      if (v > 0) { sum += v; count++; }
    });
  }
  if (count === 0) {
    return { score: null, count: 0, text: 'فاقد ارزیابی (۰ نظر)', avgNumeric: 0 };
  }
  const avg = (sum / count).toFixed(1);
  return { score: avg, count: count, text: `⭐ ${avg} (${count} نظر)`, avgNumeric: parseFloat(avg) };
};

window.loadMentors = async function() {
  const tbody = document.getElementById('mentors-table-body') || document.querySelector('#mentors-table tbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:24px; color:#38bdf8;"><i class="fa-solid fa-spinner fa-spin"></i> در حال بارگذاری لیست راهبران و اساتید...</td></tr>';

  const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
  try {
    const res = await fetch('/api/v1/admin/mentors', {
      headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
    });
    if (!res.ok) throw new Error('خطا در دریافت لیست راهبران');
    const mentors = await res.json();
    window.mentorsMasterList = Array.isArray(mentors) ? mentors : [];

    const totalBadge = document.getElementById('mentors-total-count-badge');
    if (totalBadge) {
      totalBadge.textContent = `${window.mentorsMasterList.length} راهبر`;
    }

    window.filterMentorsList();
  } catch (err) {
    console.error('Error loading mentors:', err);
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:20px; color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> خطا در بارگذاری اطلاعات: ${err.message}</td></tr>`;
  }
};

window.filterMentorsList = function() {
  const tbody = document.getElementById('mentors-table-body') || document.querySelector('#mentors-table tbody');
  if (!tbody) return;

  if (!window.mentorsMasterList || window.mentorsMasterList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:24px; color:#94a3b8;">هیچ راهبری در سیستم ثبت نشده است.</td></tr>';
    return;
  }

  const query = (document.getElementById('mentor-filter-search')?.value || '').trim().toLowerCase();
  const levelFilter = document.getElementById('mentor-filter-level')?.value || 'all';
  const caravanFilter = document.getElementById('mentor-filter-caravan')?.value || 'all';
  const statusFilter = document.getElementById('mentor-filter-status')?.value || 'all';
  const sortFilter = document.getElementById('mentor-filter-sort')?.value || 'rating_desc';

  let filtered = [...window.mentorsMasterList];

  // 1. Text search filter
  if (query) {
    filtered = filtered.filter(m => {
      const name = (m.name || '').toLowerCase();
      const phone = (m.phoneNumber || '').toLowerCase();
      const natId = (m.nationalId || '').toLowerCase();
      const city = (m.city || '').toLowerCase();
      const degree = (m.academicDegree || m.education || '').toLowerCase();
      const caravanNames = (m.mentoredCaravans || []).map(c => (c.name || '').toLowerCase()).join(' ');

      return name.includes(query) || phone.includes(query) || natId.includes(query) || city.includes(query) || degree.includes(query) || caravanNames.includes(query);
    });
  }

  // 2. Mentor level filter
  if (levelFilter !== 'all') {
    const targetLvl = parseInt(levelFilter);
    filtered = filtered.filter(m => (parseInt(m.mentorLevel) || 1) === targetLvl);
  }

  // 3. Caravan assignment filter
  if (caravanFilter === 'has_caravan') {
    filtered = filtered.filter(m => (m.mentoredCaravans && m.mentoredCaravans.length > 0) || m.caravanId != null);
  } else if (caravanFilter === 'no_caravan') {
    filtered = filtered.filter(m => (!m.mentoredCaravans || m.mentoredCaravans.length === 0) && !m.caravanId);
  }

  // 4. Account status filter
  if (statusFilter !== 'all') {
    filtered = filtered.filter(m => (m.accountStatus || 'ACTIVE') === statusFilter);
  }

  // 5. Sorting
  filtered.sort((a, b) => {
    const starsA = window.calculateMentorStars(a.ratingsReceived, a.evaluationsReceived).avgNumeric;
    const starsB = window.calculateMentorStars(b.ratingsReceived, b.evaluationsReceived).avgNumeric;
    const levelA = parseInt(a.mentorLevel) || 1;
    const levelB = parseInt(b.mentorLevel) || 1;
    const caravansCountA = (a.mentoredCaravans?.length || 0);
    const caravansCountB = (b.mentoredCaravans?.length || 0);

    if (sortFilter === 'rating_desc') {
      return starsB - starsA;
    } else if (sortFilter === 'level_desc') {
      return levelB - levelA;
    } else if (sortFilter === 'caravans_desc') {
      return caravansCountB - caravansCountA;
    } else if (sortFilter === 'name_asc') {
      return (a.name || '').localeCompare(b.name || '', 'fa');
    }
    return 0;
  });

  // Update count badge
  const totalBadge = document.getElementById('mentors-total-count-badge');
  if (totalBadge) {
    if (filtered.length === window.mentorsMasterList.length) {
      totalBadge.textContent = `${window.mentorsMasterList.length} راهبر`;
    } else {
      totalBadge.textContent = `نمایش ${filtered.length} از ${window.mentorsMasterList.length} راهبر`;
    }
  }

  // Render rows
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:30px; color:#94a3b8;"><i class="fa-solid fa-filter-circle-xmark" style="font-size:24px; color:#64748b; margin-bottom:8px; display:block;"></i> هیچ راهبری با معیارهای فیلتر و جستجوی انتخاب‌شده مطابقت ندارد.</td></tr>';
    return;
  }

  window.renderMentorsRows(filtered, tbody);
};

window.resetMentorFilters = function() {
  const searchInput = document.getElementById('mentor-filter-search');
  const levelSelect = document.getElementById('mentor-filter-level');
  const caravanSelect = document.getElementById('mentor-filter-caravan');
  const statusSelect = document.getElementById('mentor-filter-status');
  const sortSelect = document.getElementById('mentor-filter-sort');

  if (searchInput) searchInput.value = '';
  if (levelSelect) levelSelect.value = 'all';
  if (caravanSelect) caravanSelect.value = 'all';
  if (statusSelect) statusSelect.value = 'all';
  if (sortSelect) sortSelect.value = 'rating_desc';

  window.filterMentorsList();
};

window.renderMentorsRows = function(mentorsList, tbody) {
  tbody.innerHTML = mentorsList.map(m => {
    const avatarInitials = (m.name ? m.name.trim().split(' ').map(n => n[0]).join('') : 'را').substring(0, 2);
    
    // Calculate accurate stars rating based ONLY on real DB records
    const starsInfo = window.calculateMentorStars(m.ratingsReceived, m.evaluationsReceived);

    const ratingCellHtml = starsInfo.score !== null
      ? `<div style="display:inline-flex; align-items:center; gap:4px; background:rgba(245, 158, 11, 0.15); border:1px solid rgba(245, 158, 11, 0.35); padding:4px 8px; border-radius:8px;">
           <span style="color:#fbbf24; font-weight:bold; font-size:12.5px;">⭐ ${starsInfo.score}</span>
           <span style="font-size:10.5px; color:#cbd5e1;">(${starsInfo.count} ارزیابی)</span>
         </div>`
      : `<div style="display:inline-flex; align-items:center; gap:4px; background:rgba(100, 116, 139, 0.15); border:1px solid rgba(100, 116, 139, 0.25); padding:3px 8px; border-radius:6px; font-size:11px; color:#94a3b8;">
           <i class="fa-regular fa-star"></i> فاقد ارزیابی (۰ نظر)
         </div>`;

    // Format caravans badges
    const caravans = m.mentoredCaravans || (m.caravan ? [m.caravan] : []);
    const caravansHtml = caravans.length > 0
      ? caravans.map(c => `<span class="badge" style="background:rgba(2, 132, 199, 0.2); color:#38bdf8; border:1px solid rgba(56, 189, 248, 0.4); padding:3px 8px; border-radius:6px; font-size:11px; margin:2px; display:inline-block;"><i class="fa-solid fa-people-group"></i> ${c.name}</span>`).join(' ')
      : '<span style="color:#64748b; font-size:12px;">فاقد کاروان</span>';

    // Mentor level badge (Exact database field: 1: یاور, 2: استاد, 3: راهنمای کل)
    let levelBadge = '';
    const lvl = Number(m.mentorLevel) || 1;
    if (lvl >= 3) {
      levelBadge = `<span class="badge" style="background:linear-gradient(135deg, rgba(245,158,11,0.25), rgba(217,119,6,0.35)); color:#fbbf24; border:1px solid rgba(245,158,11,0.5); font-weight:bold; padding:4px 9px; border-radius:6px; font-size:11.5px;" title="سطح ۳: راهنمای کل"><i class="fa-solid fa-crown"></i> سطح ۳ (راهنمای کل)</span>`;
    } else if (lvl === 2) {
      levelBadge = `<span class="badge" style="background:linear-gradient(135deg, rgba(139,92,246,0.25), rgba(109,40,217,0.35)); color:#c084fc; border:1px solid rgba(139,92,246,0.5); font-weight:bold; padding:4px 9px; border-radius:6px; font-size:11.5px;" title="سطح ۲: استاد"><i class="fa-solid fa-graduation-cap"></i> سطح ۲ (استاد)</span>`;
    } else {
      levelBadge = `<span class="badge" style="background:rgba(100, 116, 139, 0.25); color:#94a3b8; border:1px solid rgba(100,116,139,0.4); padding:4px 9px; border-radius:6px; font-size:11.5px;" title="سطح ۱: یاور"><i class="fa-solid fa-hand-holding-hand"></i> سطح ۱ (یاور)</span>`;
    }

    // Status indicator
    const isSuspended = m.accountStatus === 'SUSPENDED' || m.blocked || m.isDeleted;
    const statusDot = isSuspended ? '<span title="مسدود / غیرفعال" style="color:#ef4444;">🔴</span>' : '<span title="فعال" style="color:#10b981;">🟢</span>';

    // Degree and National ID (only real data)
    const degreeText = m.academicDegree || m.education || 'عمومی';
    const nationalIdText = (m.nationalId && m.nationalId !== 'null' && m.nationalId.trim() && !m.nationalId.startsWith('۱۲۳۴۵۶') && !m.nationalId.startsWith('123456'))
      ? `<span style="font-family:monospace; color:#cbd5e1;">${m.nationalId}</span>`
      : '<span style="color:#64748b; font-size:11px;">وارد نشده است</span>';

    return `
      <tr style="transition:all 0.2s ease;">
        <td style="text-align:center;">
          <div style="width:38px; height:38px; border-radius:50%; background:linear-gradient(135deg, #0284c7, #6366f1); display:flex; align-items:center; justify-content:center; font-weight:bold; color:white; font-size:13px; margin:0 auto; box-shadow:0 2px 6px rgba(0,0,0,0.3);">
            ${avatarInitials}
          </div>
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:6px;">
            ${statusDot}
            <strong style="color:#f8fafc; font-size:13.5px;">${m.name || 'راهبر بدون نام'}</strong>
          </div>
          ${m.role === 'SUPER_MENTOR' ? '<span style="font-size:10px; color:#fbbf24; background:rgba(245,158,11,0.15); padding:1px 6px; border-radius:4px;">سرراهبر</span>' : ''}
        </td>
        <td style="font-family:monospace; direction:ltr; text-align:right; color:#cbd5e1;">${m.phoneNumber || '-'}</td>
        <td style="text-align:center;">${nationalIdText}</td>
        <td style="color:#cbd5e1; font-size:12.5px;">${degreeText}</td>
        <td>${caravansHtml}</td>
        <td style="text-align:center;">${levelBadge}</td>
        <td style="text-align:center;">
          ${ratingCellHtml}
        </td>
        <td style="text-align:center; white-space:nowrap;">
          <div style="display:inline-flex; gap:6px; align-items:center;">
            <button class="btn-action" onclick="window.viewMentorDossier('${m.id}')" style="background:rgba(56, 189, 248, 0.15); color:#38bdf8; border:1px solid rgba(56, 189, 248, 0.35); border-radius:6px; padding:5px 9px; font-size:11.5px; cursor:pointer; font-weight:500; display:inline-flex; align-items:center; gap:4px;" title="نمایش شناسنامه جامع">
              <i class="fa-solid fa-eye"></i> شناسنامه
            </button>
            <button class="btn-action" onclick="window.editMentor('${m.id}')" style="background:rgba(16, 185, 129, 0.15); color:#10b981; border:1px solid rgba(16, 185, 129, 0.35); border-radius:6px; padding:5px 9px; font-size:11.5px; cursor:pointer; font-weight:500; display:inline-flex; align-items:center; gap:4px;" title="ویرایش اطلاعات">
              <i class="fa-solid fa-pen"></i> ویرایش
            </button>
            <button class="btn-action" onclick="window.openMentorModerationModal('${m.id}')" style="background:rgba(239, 68, 68, 0.15); color:#ef4444; border:1px solid rgba(239, 68, 68, 0.35); border-radius:6px; padding:5px 9px; font-size:11.5px; cursor:pointer; font-weight:500; display:inline-flex; align-items:center; gap:4px;" title="مدیریت وضعیت و تعلیق">
              <i class="fa-solid fa-user-shield"></i> وضعیت
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
};

window.quickUpdateMentorLevel = async function(mentorId, newLevel) {
  const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
  try {
    const res = await fetch(`/api/v1/admin/users/${mentorId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ mentorLevel: parseInt(newLevel) })
    });
    if (res.ok) {
      const m = window.mentorsMasterList.find(x => x.id === mentorId);
      if (m) m.mentorLevel = parseInt(newLevel);
      alert(`✅ سطح راهبری با موفقیت به سطح ${newLevel} بروزرسانی شد.`);
      window.filterMentorsList();
    } else {
      const err = await res.json().catch(() => ({}));
      alert('خطا در بروزرسانی سطح: ' + (err.error || 'خطای سرور'));
    }
  } catch (e) {
    console.error('Update mentor level error:', e);
    alert('خطا در برقراری ارتباط با سرور: ' + e.message);
  }
};

window.viewMentorDossier = async function(mentorId) {
  const modal = document.getElementById('mentor-dossier-modal');
  const body = document.getElementById('dossier-content-body');
  const footerActions = document.getElementById('dossier-footer-actions');
  if (!modal || !body) return;

  modal.style.display = 'flex';
  modal.style.zIndex = '999999';
  body.innerHTML = '<div style="text-align:center; padding:30px; color:#38bdf8;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><div style="margin-top:10px;">در حال بارگذاری شناسنامه جامع راهبر...</div></div>';

  const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
  let mentor = window.mentorsMasterList.find(m => m.id === mentorId);

  try {
    const res = await fetch(`/api/v1/admin/mentors/${mentorId}/dossier`, {
      headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
    });
    let dossier = null;
    if (res.ok) {
      dossier = await res.json();
    }

    if (!mentor && dossier?.identity) {
      mentor = dossier.identity;
    }

    const mentorName = dossier?.identity?.name || mentor?.name || 'راهبر آموزشی';
    const initials = mentorName.trim().split(' ').map(n => n[0]).join('').substring(0, 2);
    
    document.getElementById('dossier-mentor-name').innerHTML = `<i class="fa-solid fa-id-card" style="color:#38bdf8;"></i> شناسنامه راهبر: ${mentorName}`;
    const cleanNatId = (dossier?.identity?.nationalId || mentor?.nationalId || '').trim();
    const natIdDisplay = (cleanNatId && cleanNatId !== 'null' && !cleanNatId.startsWith('۱۲۳۴۵۶') && !cleanNatId.startsWith('123456')) ? cleanNatId : 'وارد نشده است';
    document.getElementById('dossier-mentor-subtitle').textContent = `کد ملی: ${natIdDisplay} | موبایل: ${dossier?.identity?.phoneNumber || mentor?.phoneNumber || '-'}`;
    document.getElementById('dossier-avatar').textContent = initials;

    // Build rich dossier content with pure real ratings
    const caravans = dossier?.caravans || mentor?.mentoredCaravans || [];
    const starsInfo = window.calculateMentorStars(mentor?.ratingsReceived, mentor?.evaluationsReceived);
    const scoreTitle = starsInfo.score !== null ? `⭐ ${starsInfo.score} <span style="font-size:12px; color:#94a3b8;">/ ۵</span>` : `<span style="font-size:15px; color:#94a3b8;">فاقد ارزیابی</span>`;
    const scoreSub = starsInfo.count > 0 ? `از میان ${starsInfo.count} ارزیابی ثبت‌شده` : `هنوز ارزیابی یا امتیازی برای این راهبر ثبت نشده است`;

    body.innerHTML = `
      <!-- TOP STATS CARDS -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-bottom:18px;">
        <div style="background:rgba(30, 41, 59, 0.7); border:1px solid rgba(245, 158, 11, 0.3); border-radius:12px; padding:14px; text-align:center;">
          <div style="font-size:11px; color:#cbd5e1; margin-bottom:4px;"><i class="fa-solid fa-star" style="color:#fbbf24;"></i> امتیاز رضایت و عملکرد</div>
          <div style="font-size:20px; font-weight:bold; color:#fbbf24;">${scoreTitle}</div>
          <div style="font-size:11px; color:#94a3b8; margin-top:2px;">${scoreSub}</div>
        </div>

        <div style="background:rgba(30, 41, 59, 0.7); border:1px solid rgba(56, 189, 248, 0.3); border-radius:12px; padding:14px; text-align:center;">
          <div style="font-size:11px; color:#cbd5e1; margin-bottom:4px;"><i class="fa-solid fa-people-group" style="color:#38bdf8;"></i> کاروان‌های تحت راهبری</div>
          <div style="font-size:22px; font-weight:bold; color:#38bdf8;">${caravans.length} <span style="font-size:12px; color:#94a3b8;">کاروان</span></div>
          <div style="font-size:11px; color:#94a3b8; margin-top:2px;">گروه‌های فعال آموزشی</div>
        </div>

        <div style="background:rgba(30, 41, 59, 0.7); border:1px solid rgba(16, 185, 129, 0.3); border-radius:12px; padding:14px; text-align:center;">
          <div style="font-size:11px; color:#cbd5e1; margin-bottom:4px;"><i class="fa-solid fa-coins" style="color:#10b981;"></i> دارایی‌های راهبر</div>
          <div style="font-size:14px; font-weight:bold; color:#10b981; display:flex; justify-content:center; gap:8px; margin-top:6px;">
            <span>🪙 ${mentor?.zarikBalance || 0} زریک</span>
            <span>🚩 ${mentor?.beyragh || 0} بیرق</span>
          </div>
          <div style="font-size:11px; color:#94a3b8; margin-top:4px;">🧵 ${mentor?.nakh || 0} نخ | 🧶 ${mentor?.farsh || 0} فرش</div>
        </div>

        <div style="background:rgba(30, 41, 59, 0.7); border:1px solid rgba(139, 92, 246, 0.3); border-radius:12px; padding:14px; text-align:center;">
          <div style="font-size:11px; color:#cbd5e1; margin-bottom:4px;"><i class="fa-solid fa-award" style="color:#a78bfa;"></i> رتبه و سطح کاربری</div>
          <div style="font-size:18px; font-weight:bold; color:#a78bfa; margin-top:2px;">سطح ${mentor?.mentorLevel || 1}</div>
          <div style="font-size:11px; color:#94a3b8; margin-top:4px;">وضعیت: <span style="color:#10b981;">${mentor?.accountStatus || 'ACTIVE'}</span></div>
        </div>
      </div>

        <div style="background:rgba(30, 41, 59, 0.7); border:1px solid rgba(56, 189, 248, 0.3); border-radius:12px; padding:14px; text-align:center;">
          <div style="font-size:11px; color:#cbd5e1; margin-bottom:4px;"><i class="fa-solid fa-people-group" style="color:#38bdf8;"></i> کاروان‌های تحت راهبری</div>
          <div style="font-size:22px; font-weight:bold; color:#38bdf8;">${caravans.length} <span style="font-size:12px; color:#94a3b8;">کاروان</span></div>
          <div style="font-size:11px; color:#94a3b8; margin-top:2px;">گروه‌های فعال آموزشی</div>
        </div>

        <div style="background:rgba(30, 41, 59, 0.7); border:1px solid rgba(16, 185, 129, 0.3); border-radius:12px; padding:14px; text-align:center;">
          <div style="font-size:11px; color:#cbd5e1; margin-bottom:4px;"><i class="fa-solid fa-coins" style="color:#10b981;"></i> دارایی‌های راهبر</div>
          <div style="font-size:14px; font-weight:bold; color:#10b981; display:flex; justify-content:center; gap:8px; margin-top:6px;">
            <span>🪙 ${mentor?.zarikBalance || 0} زریک</span>
            <span>🚩 ${mentor?.beyragh || 0} بیرق</span>
          </div>
          <div style="font-size:11px; color:#94a3b8; margin-top:4px;">🧵 ${mentor?.nakh || 0} نخ | 🧶 ${mentor?.farsh || 0} فرش</div>
        </div>

        <div style="background:rgba(30, 41, 59, 0.7); border:1px solid rgba(139, 92, 246, 0.3); border-radius:12px; padding:14px; text-align:center;">
          <div style="font-size:11px; color:#cbd5e1; margin-bottom:4px;"><i class="fa-solid fa-award" style="color:#a78bfa;"></i> رتبه و سطح کاربری</div>
          <div style="font-size:18px; font-weight:bold; color:#a78bfa; margin-top:2px;">سطح ${mentor?.mentorLevel || 1}</div>
          <div style="font-size:11px; color:#94a3b8; margin-top:4px;">وضعیت: <span style="color:#10b981;">${mentor?.accountStatus || 'ACTIVE'}</span></div>
        </div>
      </div>

      <!-- PERSONAL & ACADEMIC DOSSIER -->
      <div style="background:rgba(15, 23, 42, 0.6); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px; margin-bottom:16px;">
        <div style="font-weight:bold; color:#38bdf8; font-size:13.5px; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
          <i class="fa-solid fa-user-check"></i> مشخصات هویتی و آکادمیک راهبر
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; font-size:12.5px;">
          <div><strong style="color:#94a3b8;">نام کامل:</strong> <span style="color:white;">${mentorName}</span></div>
          <div><strong style="color:#94a3b8;">شماره همراه:</strong> <span style="color:white; font-family:monospace;">${mentor?.phoneNumber || '-'}</span></div>
          <div><strong style="color:#94a3b8;">کد ملی:</strong> <span style="color:white; font-family:monospace;">${mentor?.nationalId && mentor?.nationalId !== 'null' && !mentor?.nationalId.startsWith('۱۲۳۴۵۶') && !mentor?.nationalId.startsWith('123456') ? mentor.nationalId : 'وارد نشده است'}</span></div>
          <div><strong style="color:#94a3b8;">تاریخ تولد:</strong> <span style="color:white;">${mentor?.dateOfBirth || 'ثبت نشده'}</span></div>
          <div><strong style="color:#94a3b8;">شهر محل سکونت:</strong> <span style="color:white;">${mentor?.city || 'ثبت نشده'}</span></div>
          <div><strong style="color:#94a3b8;">مدرک و رشته تحصیلی:</strong> <span style="color:white;">${mentor?.academicDegree || 'عمومی'}</span></div>
          <div><strong style="color:#94a3b8;">پلتفرم پیام‌رسان:</strong> <span style="color:white;">${mentor?.socialPlatform || 'ثبت نشده'} (${mentor?.socialMessengerHandle || '-'})</span></div>
          <div><strong style="color:#94a3b8;">وضعیت احراز هویت:</strong> <span style="color:${mentor?.identityVerified ? '#10b981' : '#f59e0b'};">${mentor?.identityVerified ? '✅ تایید شده' : '🟡 در انتظار بررسی'}</span></div>
        </div>
      </div>

      <!-- CARAVANS LIST -->
      <div style="background:rgba(15, 23, 42, 0.6); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px; margin-bottom:16px;">
        <div style="font-weight:bold; color:#a78bfa; font-size:13.5px; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
          <i class="fa-solid fa-caravan"></i> وضعیت کاروان‌های تحت نظارت
        </div>
        ${caravans.length > 0 ? `
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:10px;">
            ${caravans.map(c => `
              <div style="background:rgba(30,41,59,0.7); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:12px;">
                <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:bold; color:#38bdf8; margin-bottom:6px;">
                  <span>${c.name}</span>
                  <span style="font-size:11px; color:#cbd5e1;">${c.memberCount || 0} عضو</span>
                </div>
                <div style="font-size:11px; color:#94a3b8; margin-bottom:6px;">پیشرفت کلی کاروان: ${c.progress || 0}%</div>
                <div style="background:rgba(0,0,0,0.3); height:6px; border-radius:3px; overflow:hidden;">
                  <div style="background:linear-gradient(90deg, #38bdf8, #10b981); height:100%; width:${c.progress || 0}%;"></div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : '<div style="color:#94a3b8; font-size:12px;">راهبر در حال حاضر به کاروانی منتسب نشده است.</div>'}
      </div>
    `;

    footerActions.innerHTML = `
      <button type="button" class="btn-primary" onclick="document.getElementById('mentor-dossier-modal').style.display='none'; window.editMentor('${mentorId}')" style="background:linear-gradient(135deg, #10b981, #059669); color:white; border:none; padding:8px 18px; border-radius:8px; font-weight:bold; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
        <i class="fa-solid fa-pen"></i> ویرایش مشخصات این راهبر
      </button>
    `;
  } catch (err) {
    console.error('viewMentorDossier error:', err);
    body.innerHTML = `<div style="color:#ef4444; text-align:center; padding:20px;">خطا در دریافت اطلاعات پرونده: ${err.message}</div>`;
  }
};

window.closeMentorDossier = function() {
  const modal = document.getElementById('mentor-dossier-modal');
  if (modal) modal.style.display = 'none';
};

window.cachedCaravansForMentorModal = [];

window.showMentorModal = async function() {
  const form = document.getElementById('mentor-form');
  if (form) form.reset();
  
  document.getElementById('modal-mentor-id').value = '';
  document.getElementById('mentor-modal-form-title').innerHTML = '<i class="fa-solid fa-user-plus"></i> ثبت راهبر جدید در سامانه';
  const certsSection = document.getElementById('modal-mentor-certs-section');
  if (certsSection) certsSection.style.display = 'none';

  const caravanSearch = document.getElementById('mentor-caravan-search-input');
  if (caravanSearch) caravanSearch.value = '';

  // Load caravans for checklist (starts completely unchecked: Standalone Mentor)
  await window.populateMentorCaravansChecklist([]);

  const modal = document.getElementById('mentor-modal-overlay');
  if (modal) {
    modal.style.display = 'flex';
    modal.style.zIndex = '999999';
  }
};

window.editMentor = async function(mentorId) {
  const m = window.mentorsMasterList.find(x => x.id === mentorId);
  if (!m) {
    alert('اطلاعات راهبر یافت نشد.');
    return;
  }

  document.getElementById('modal-mentor-id').value = m.id;
  document.getElementById('modal-mentor-name').value = m.name || '';
  document.getElementById('modal-mentor-phone').value = m.phoneNumber || '';
  document.getElementById('modal-mentor-national-id').value = m.nationalId || '';
  document.getElementById('modal-mentor-dob').value = m.dateOfBirth || '';
  document.getElementById('modal-mentor-city').value = m.city || '';
  document.getElementById('modal-mentor-academic-degree').value = m.academicDegree || m.education || '';
  document.getElementById('modal-mentor-level').value = String(m.mentorLevel || 1);
  document.getElementById('modal-mentor-status').value = m.accountStatus || 'ACTIVE';
  document.getElementById('modal-mentor-social-platform').value = m.socialPlatform || '';
  document.getElementById('modal-mentor-social-handle').value = m.socialMessengerHandle || '';

  document.getElementById('mentor-modal-form-title').innerHTML = `<i class="fa-solid fa-user-pen"></i> ویرایش اطلاعات راهبر: ${m.name || ''}`;

  const caravanSearch = document.getElementById('mentor-caravan-search-input');
  if (caravanSearch) caravanSearch.value = '';

  // Populate assigned caravans checklist
  const assignedCaravanIds = (m.mentoredCaravans || []).map(c => c.id);
  if (m.caravanId && !assignedCaravanIds.includes(m.caravanId)) {
    assignedCaravanIds.push(m.caravanId);
  }
  await window.populateMentorCaravansChecklist(assignedCaravanIds);

  // Populate certificates if any
  const certsSection = document.getElementById('modal-mentor-certs-section');
  const certsTbody = document.getElementById('modal-mentor-certs-tbody');
  if (certsSection && certsTbody) {
    if (m.mentorDocuments && m.mentorDocuments.length > 0) {
      certsSection.style.display = 'block';
      certsTbody.innerHTML = m.mentorDocuments.map(doc => {
        let statusTag = doc.status === 'approved' ? '<span class="badge" style="background:#10b981;color:white;">🟢 تایید شده</span>' :
                        (doc.status === 'rejected' ? '<span class="badge" style="background:#ef4444;color:white;">🔴 رد شده</span>' : '<span class="badge" style="background:#f59e0b;color:white;">🟡 در انتظار</span>');
        return `
          <tr>
            <td>${doc.filename || 'مدرک پیوست'}</td>
            <td><a href="${doc.url}" target="_blank" style="color:#38bdf8; text-decoration:underline;">مشاهده مدرک</a></td>
            <td>${statusTag}</td>
            <td>
              ${doc.status === 'pending' ? `
                <button type="button" class="btn-icon" style="color:#10b981; background:none; border:none; cursor:pointer;" onclick="window.inlineApproveCert('${doc.id}', '${m.id}')" title="تایید مدرک"><i class="fa-solid fa-check"></i></button>
                <button type="button" class="btn-icon" style="color:#ef4444; background:none; border:none; cursor:pointer;" onclick="window.inlineRejectCert('${doc.id}', '${m.id}')" title="رد مدرک"><i class="fa-solid fa-times"></i></button>
              ` : '-'}
            </td>
          </tr>
        `;
      }).join('');
    } else {
      certsSection.style.display = 'none';
    }
  }

  const modal = document.getElementById('mentor-modal-overlay');
  if (modal) {
    modal.style.display = 'flex';
    modal.style.zIndex = '999999';
  }
};

window.populateMentorCaravansChecklist = async function(assignedIds = []) {
  const container = document.getElementById('modal-mentor-caravans-list');
  if (!container) return;

  container.innerHTML = '<span style="font-size:11px; color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> در حال بارگذاری کاروان‌ها...</span>';
  
  const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
  try {
    const res = await fetch('/api/v1/admin/caravans', {
      headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
    });
    const caravans = res.ok ? await res.json() : [];
    window.cachedCaravansForMentorModal = Array.isArray(caravans) ? caravans : [];

    if (window.cachedCaravansForMentorModal.length === 0) {
      container.innerHTML = '<span style="font-size:12px; color:#94a3b8;">هیچ کاروانی در سامانه ثبت نشده است.</span>';
      return;
    }

    container.innerHTML = window.cachedCaravansForMentorModal.map(c => `
      <label class="mentor-caravan-item-label" data-caravan-name="${(c.name || '').toLowerCase()}" style="display:flex; align-items:center; gap:8px; background:rgba(15, 23, 42, 0.85); border:1px solid rgba(255,255,255,0.12); border-radius:8px; padding:8px 12px; color:#f8fafc; font-size:12.5px; cursor:pointer; transition:all 0.2s;">
        <input type="checkbox" class="mentor-caravan-checkbox" value="${c.id}" ${assignedIds.includes(c.id) ? 'checked' : ''} style="width:16px; height:16px; cursor:pointer;">
        <span style="font-weight:500;">${c.name}</span>
      </label>
    `).join('');
  } catch (e) {
    console.error('Error fetching caravans checklist:', e);
    container.innerHTML = '<span style="font-size:12px; color:#ef4444;">خطا در دریافت لیست کاروان‌ها</span>';
  }
};

window.filterMentorCaravansChecklist = function(query) {
  const term = (query || '').trim().toLowerCase();
  const items = document.querySelectorAll('.mentor-caravan-item-label');
  items.forEach(el => {
    const cName = el.getAttribute('data-caravan-name') || '';
    if (!term || cName.includes(term)) {
      el.style.display = 'flex';
    } else {
      el.style.display = 'none';
    }
  });
};

window.uncheckAllMentorCaravans = function() {
  const checkboxes = document.querySelectorAll('.mentor-caravan-checkbox');
  checkboxes.forEach(cb => { cb.checked = false; });
  const caravanSearch = document.getElementById('mentor-caravan-search-input');
  if (caravanSearch) caravanSearch.value = '';
  window.filterMentorCaravansChecklist('');
};

window.handleMentorFormSubmit = async function(e) {
  if (e) e.preventDefault();

  const id = document.getElementById('modal-mentor-id').value;
  const name = document.getElementById('modal-mentor-name').value.trim();
  const phoneNumber = document.getElementById('modal-mentor-phone').value.trim();
  const nationalId = document.getElementById('modal-mentor-national-id').value.trim();
  const dateOfBirth = document.getElementById('modal-mentor-dob').value.trim();
  const city = document.getElementById('modal-mentor-city').value.trim();
  const academicDegree = document.getElementById('modal-mentor-academic-degree').value.trim();
  const mentorLevel = parseInt(document.getElementById('modal-mentor-level').value) || 1;
  const accountStatus = document.getElementById('modal-mentor-status').value;
  const socialPlatform = document.getElementById('modal-mentor-social-platform').value;
  const socialMessengerHandle = document.getElementById('modal-mentor-social-handle').value.trim();

  // Read all selected caravan checkboxes (Can be empty [] for standalone mentors without caravans)
  const caravanCheckboxes = document.querySelectorAll('.mentor-caravan-checkbox:checked');
  const assignedCaravanIds = Array.from(caravanCheckboxes).map(cb => cb.value);

  const payload = {
    id: id || undefined,
    name,
    phoneNumber,
    nationalId: nationalId || null,
    dateOfBirth: dateOfBirth || null,
    city: city || null,
    academicDegree: academicDegree || null,
    mentorLevel,
    accountStatus,
    socialPlatform: socialPlatform || null,
    socialMessengerHandle: socialMessengerHandle || null,
    assignedCaravanIds: assignedCaravanIds, // Array of caravan IDs (empty array if no caravan chosen)
    caravanId: assignedCaravanIds.length > 0 ? assignedCaravanIds[0] : null
  };

  const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
  try {
    const res = await fetch('/api/v1/admin/mentors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const msg = assignedCaravanIds.length > 0 
        ? `✅ راهبر «${name}» با موفقیت همراه با ${assignedCaravanIds.length} کاروان ثبت و ذخیره شد.`
        : `✅ راهبر «${name}» با موفقیت به عنوان راهبر مستقل (بدون کاروان) ثبت و ذخیره شد.`;
      alert(msg);
      document.getElementById('mentor-modal-overlay').style.display = 'none';
      await window.loadMentors();
    } else {
      const err = await res.json();
      alert('خطا در ذخیره‌سازی: ' + (err.error || 'خطای سرور'));
    }
  } catch (err) {
    console.error('Save mentor error:', err);
    alert('ارتباط با سرور برقرار نشد: ' + err.message);
  }
};

window.openMentorModerationModal = function(mentorId) {
  const m = window.mentorsMasterList.find(x => x.id === mentorId);
  document.getElementById('mod-mentor-id').value = mentorId;
  
  if (m) {
    document.getElementById('mod-mentor-subtitle').textContent = `راهبر: ${m.name || ''} (${m.phoneNumber || ''}) - وضعیت فعلی: ${m.accountStatus || 'ACTIVE'}`;
  }

  window.toggleTempSuspendDate(false);
  const modal = document.getElementById('mentor-moderation-modal');
  if (modal) {
    modal.style.display = 'flex';
    modal.style.zIndex = '999999';
  }
};

window.toggleTempSuspendDate = function(show) {
  const container = document.getElementById('mod-temp-date-container');
  if (container) container.style.display = show ? 'block' : 'none';
};

window.executeMentorModeration = async function(e) {
  if (e) e.preventDefault();

  const id = document.getElementById('mod-mentor-id').value;
  if (!id) return;

  const action = document.querySelector('input[name="mod_action"]:checked')?.value || 'activate';
  const suspendedUntil = document.getElementById('mod-suspended-until')?.value;

  const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
  try {
    const res = await fetch(`/api/v1/admin/mentors/${id}/moderate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ action, suspendedUntil: suspendedUntil || undefined })
    });

    if (res.ok) {
      alert('✅ اقدام مدیریتی با موفقیت بر روی حساب کاربری راهبر اعمال شد.');
      document.getElementById('mentor-moderation-modal').style.display = 'none';
      await window.loadMentors();
    } else {
      const err = await res.json();
      alert('خطا در اعمال اقدام: ' + (err.error || 'خطای سرور'));
    }
  } catch (err) {
    console.error('Mentor moderation error:', err);
    alert('ارتباط با سرور برقرار نشد: ' + err.message);
  }
};

// Hook for Student Drawer Events their tab is clicked
document.querySelector('[data-tab="mentors-profile-tab"]')?.addEventListener('click', loadMentors);

// 2. Mentors Tickets Tab
async function loadMentorTickets() {
  try {
    const res = await request('/api/v1/support/tickets');
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

// Removed duplicate click listener for mentor tickets

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

    const res = await request(url);
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

// Mentor docs tab listener
document.querySelector('[data-tab="mentors-docs-tab"]')?.addEventListener('click', () => {
  if (typeof window.loadMentorDocs === 'function') window.loadMentorDocs();
});

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
// Removed loadCaravanPerformance logic to loadCaravansTab

window.pendingCaravanMembers = [];

async function openCaravanWizard() {
  document.getElementById('caravan-wizard-modal').style.display = 'flex';
  document.getElementById('cw-mentor-search').value = '';
  document.getElementById('cw-mentor-id').value = '';
  document.getElementById('cw-student-search').value = '';
  document.getElementById('cw-mentor-results').innerHTML = '';
  document.getElementById('cw-student-results').innerHTML = '';
  
  window.pendingCaravanMembers = [];
  renderPendingMembers();

  // Mentor search logic
  document.getElementById('cw-mentor-search').oninput = async (e) => {
    const q = e.target.value.trim();
    if(q.length < 2) return document.getElementById('cw-mentor-results').innerHTML = '';
    const res = await request(`/api/v1/admin/mentors`);
    const allMentors = await res.json();
    const filtered = allMentors.filter(m => m.name.includes(q) || (m.phoneNumber && m.phoneNumber.includes(q)) || (m.userCode && m.userCode.toString() === q));
    const html = filtered.map(m => `
      <div class="mentor-result-item" style="padding:10px; cursor:pointer; border-bottom:1px solid #333;" data-id="${m.id}" data-name="${m.name}">
        <strong>${m.name}</strong> - NP-${m.userCode || m.phoneNumber}
      </div>
    `).join('');
    document.getElementById('cw-mentor-results').innerHTML = html;
  };

  document.getElementById('cw-mentor-results').onclick = (e) => {
    const item = e.target.closest('.mentor-result-item');
    if (item) {
      document.getElementById('cw-mentor-id').value = item.dataset.id;
      document.getElementById('cw-mentor-search').value = item.dataset.name;
      document.getElementById('cw-mentor-results').innerHTML = '';
    }
  };

  // Member search logic
  document.getElementById('cw-student-search').oninput = async (e) => {
    const q = e.target.value.trim();
    if(q.length < 2) return document.getElementById('cw-student-results').innerHTML = '';
    const res = await request(`/api/v1/admin/users?role=student&search=${encodeURIComponent(q)}`);
    const data = await res.json();
    const students = Array.isArray(data) ? data : data.users;
    const html = students.filter(s => !window.pendingCaravanMembers.some(p => p.id === s.id)).map(s => `
      <div class="student-result-item" style="padding:10px; cursor:pointer; border-bottom:1px solid #333; display:flex; justify-content:space-between;" data-id="${s.id}" data-name="${s.name}" data-code="${s.userCode || s.phoneNumber}">
        <span><strong>${s.name}</strong> - NP-${s.userCode || s.phoneNumber}</span>
        <i class="fa-solid fa-plus text-primary"></i>
      </div>
    `).join('');
    document.getElementById('cw-student-results').innerHTML = html;
  };

  document.getElementById('cw-student-results').onclick = (e) => {
    const item = e.target.closest('.student-result-item');
    if (item) {
      window.pendingCaravanMembers.push({ id: item.dataset.id, name: item.dataset.name, code: item.dataset.code });
      document.getElementById('cw-student-search').value = '';
      document.getElementById('cw-student-results').innerHTML = '';
      renderPendingMembers();
    }
  };
}

window.selectMentor = function(id, name) {
  document.getElementById('cw-mentor-id').value = id;
  document.getElementById('cw-mentor-search').value = name;
  document.getElementById('cw-mentor-results').innerHTML = '';
};

window.addPendingMember = function(id, name, code) {
  window.pendingCaravanMembers.push({ id, name, code });
  document.getElementById('cw-student-search').value = '';
  document.getElementById('cw-student-results').innerHTML = '';
  renderPendingMembers();
};

window.removePendingMember = function(id) {
  window.pendingCaravanMembers = window.pendingCaravanMembers.filter(p => p.id !== id);
  renderPendingMembers();
};

function renderPendingMembers() {
  document.getElementById('cw-pending-count').innerText = window.pendingCaravanMembers.length;
  document.getElementById('cw-pending-members').innerHTML = window.pendingCaravanMembers.map(p => `
    <li style="background:var(--primary-color); padding:4px 8px; border-radius:4px; font-size:12px; display:flex; align-items:center; gap:5px;">
      ${p.name} (NP-${p.code})
      <i class="fa-solid fa-times" style="cursor:pointer;" onclick="removePendingMember('${p.id}')"></i>
    </li>
  `).join('');
}

function closeCaravanWizard() { document.getElementById('caravan-wizard-modal').style.display = 'none'; }

async function submitCaravan(e) {
  e.preventDefault();
  const name = document.getElementById('cw-name').value;
  const capacityLimit = document.getElementById('cw-capacity').value;
  const mentorId = document.getElementById('cw-mentor-id').value;
  const description = document.getElementById('cw-description').value;
  const socialGroupLink = document.getElementById('cw-social-link').value;
  const studentIds = window.pendingCaravanMembers.map(s => s.id);

  if(!mentorId) return alert('لطفاً یک راهبر انتخاب کنید.');

  try {
    const res = await request('/api/v1/admin/caravans', {
      method: 'POST',
      body: JSON.stringify({ name, capacityLimit, mentorId, description, socialGroupLink, studentIds })
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
window.switchCaravanDrawerTab = function(tabId) {
  document.querySelectorAll('.cd-tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('#caravan-drawer-modal .btn-action').forEach(el => el.classList.remove('active'));
  document.getElementById(tabId).style.display = 'block';
  document.getElementById('btn-' + tabId).classList.add('active');
};

window.viewCaravanDetails = async function(caravanId) {
  currentDrawerCaravanId = caravanId;
  document.getElementById('caravan-drawer-modal').style.display = 'flex';
  switchCaravanDrawerTab('cd-roster'); // Default tab
  try {
    const res = await request(`/api/v1/admin/caravans/${caravanId}`);
    const data = await res.json();
    
    document.getElementById('cd-title').textContent = `داشبورد کاروان: ${data.name}`;
    document.getElementById('cd-mentor-name').innerHTML = `<i class="fa-solid fa-user-tie"></i> مربی: ${data.mentor?.name || data.mentors?.[0]?.name || 'بدون راهبر'}`;
    document.getElementById('cd-capacity-text').innerHTML = `<i class="fa-solid fa-users"></i> ظرفیت: ${data.membersList?.length || 0} / ${data.capacityLimit} نفر`;
    document.getElementById('cd-status-text').innerHTML = `<i class="fa-solid fa-circle-info"></i> وضعیت: ${data.status === 'active' ? 'فعال' : 'غیرفعال'}`;
    
    document.getElementById('cd-wealth-zarik').textContent = data.wealth?.zarik || 0;
    document.getElementById('cd-wealth-nakh').textContent = data.wealth?.nakh || 0;
    document.getElementById('cd-wealth-farsh').textContent = data.wealth?.farsh || 0;
    document.getElementById('cd-wealth-beyragh').textContent = data.wealth?.beyragh || 0;
    
    document.getElementById('cd-progress-bar').style.width = `${data.overallProgress || 0}%`;
    document.getElementById('cd-progress-text').textContent = `${data.overallProgress || 0}%`;
    
    // Populate Roster
    const tbody = document.querySelector('#cd-roster-table tbody');
    tbody.innerHTML = '';
    if (data.membersList && data.membersList.length > 0) {
      data.membersList.forEach(u => {
        const tr = document.createElement('tr');
        const roleLabel = u.role === 'student' ? 'مخاطب' : 'راهبر';
        tr.innerHTML = `
          <td><strong>${u.name}</strong></td>
          <td style="font-family: monospace; color: var(--text-secondary);">NP-${u.userCode || u.phoneNumber}</td>
          <td style="font-family: monospace;">${u.phoneNumber}</td>
          <td><span class="badge" style="background: rgba(255,255,255,0.1);">${roleLabel}</span></td>
          <td>سطح ${u.levelFrame || 1}</td>
          <td style="color: #fbbf24;"><i class="fa-solid fa-coins"></i> ${u.zarikBalance || 0}</td>
          <td>
            <button class="page-btn" onclick="openCaravanStudentDetails('${u.id}')" title="نمایش جزئیات" style="color: var(--color-neon-blue);"><i class="fa-solid fa-eye"></i></button>
            <button class="page-btn" onclick="removeFromCaravan('${caravanId}', '${u.id}')" title="حذف از کاروان"><i class="fa-solid fa-user-minus" style="color: var(--color-danger);"></i></button>
          </td>
        `;
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

window.removeFromCaravan = async function(caravanId, studentId) {
  if(!caravanId) return;
  if(confirm('آیا از حذف این دانش‌آموز از کاروان مطمئن هستید؟')) {
     try {
       const res = await request(`/api/v1/admin/caravans/${caravanId}/members/${studentId}`, { method: 'DELETE' });
       if(res.ok) { 
         alert('با موفقیت حذف شد'); 
         if (typeof window.loadCaravanDetails === 'function') {
           window.loadCaravanDetails(caravanId);
         } else {
           loadCaravanMembersRoster();
         }
       }
     } catch(e) { console.error(e); }
  }
}

window.loadCaravanDetails = async function(caravanId) {
  if (!caravanId) return;
  try {
    const res = await request(`/api/v1/admin/caravans/${caravanId}`);
    if (!res.ok) return;
    const caravan = await res.json();
    
    // Update header fields
    const mentorEl = document.getElementById('cw-mentor-name');
    const zarikEl = document.getElementById('caravan-detail-zarik');
    const milestonesEl = document.getElementById('caravan-detail-milestones');
    
    if (mentorEl) mentorEl.innerText = caravan.mentor?.name || caravan.mentorName || 'فاقد راهبر';
    if (zarikEl) zarikEl.innerHTML = `${caravan.assets?.zarik || caravan.totalWealth || 0} <i class="fa-solid fa-coins"></i>`;
    if (milestonesEl) milestonesEl.innerText = `${caravan.overallProgress || caravan.completedStations || 0}%`;

    // Populate roster
    const tbody = document.querySelector('#cd-roster-table tbody');
    if (tbody) {
      tbody.innerHTML = '';
      const members = caravan.membersList || caravan.members || [];
      if (members.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#64748b;">هیچ عضوی در این کاروان یافت نشد</td></tr>';
      } else {
        members.forEach(m => {
          const name = m.name || m.user?.name || '-';
          const phone = m.phoneNumber || m.user?.phoneNumber || '-';
          const zarik = m.zarik || m.assets?.zarik || m.zarikBalance || 0;
          const userId = m.userId || m.user?.id || m.id;
          
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>
              <input type="text" id="edit-name-${userId}" value="${name}" class="input-ctrl" style="width:120px; padding:4px; font-size:12px; border:1px solid rgba(255,255,255,0.2); background:transparent; color:white; border-radius: 4px;">
            </td>
            <td style="font-family: monospace;">${phone}</td>
            <td>${zarik}</td>
            <td>-</td>
            <td style="white-space:nowrap; display:flex; gap:5px;">
              <button class="btn-action" style="background:#6366f1; color:white; padding:4px 8px; font-size:11px; border-radius:6px;" onclick="editMember('${userId}')">ذخیره</button>
              <button class="btn-action" style="background:#ef4444; color:white; padding:4px 8px; font-size:11px; border-radius:6px;" onclick="removeFromCaravan('${caravanId}', '${userId}')">حذف</button>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }
    }
  } catch (err) {
    console.error(err);
  }
};

window.editMember = async function(userId) {
  const nameInput = document.getElementById(`edit-name-${userId}`);
  if (!nameInput) return;
  const newName = nameInput.value;
  try {
    const res = await request(`/api/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName })
    });
    if (res.ok) {
      alert('نام کاربر با موفقیت ویرایش شد');
    } else {
      alert('خطا در ذخیره نام');
    }
  } catch (e) {
    console.error(e);
  }
};

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

window.lmsStations = [];

async function loadLmsData() {
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
      tbody.innerHTML = stations.map(s => `
  <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; color: #e2e8f0;">
    <td style="padding: 12px;">${s.orderIndex ?? s.order ?? 1}</td>
    <td style="padding: 12px; font-weight: bold;">${s.title || s.name || 'منزلگاه'}</td>
    <td style="padding: 12px; color: #94a3b8;">${s.releaseDate ? s.releaseDate.split('T')[0] : 'آزاد'}</td>
    <td style="padding: 12px; color: #94a3b8;">${s.description || '-'}</td>
    <td style="padding: 12px; text-align: center;">
      <button onclick="editLmsStation('${s.id}')" style="background:#2563eb; color:white; border:none; padding:4px 10px; border-radius:6px; cursor:pointer;">ویرایش</button>
      <button onclick="deleteLmsStation('${s.id}')" style="background:#ef4444; color:white; border:none; padding:4px 10px; border-radius:6px; cursor:pointer; margin-right:4px;">حذف</button>
    </td>
  </tr>
`).join('');
    }
  } catch(e) { console.error(e); }
}

function initNewStation() {
  document.getElementById('lms-station-id').value = '';
  document.getElementById('lms-station-title').value = '';
  document.getElementById('lms-station-order').value = '0';
  document.getElementById('lms-station-release-date').value = '';
  document.getElementById('lms-station-release-time').value = '';
  document.getElementById('lms-station-desc').value = '';
  document.getElementById('lms-station-icon').value = '';
  
  document.getElementById('builder-categories-container').innerHTML = '';
  document.getElementById('lms-builder-title').innerText = 'ایجاد منزلگاه جدید';
  document.getElementById('lms-builder-card').style.display = 'block';
  
  // Scroll to builder
  document.getElementById('lms-builder-card').scrollIntoView({ behavior: 'smooth' });
}

function cancelLmsBuilder() {
  document.getElementById('lms-builder-card').style.display = 'none';
}

function addCategoryUI(catData = null) {
  const container = document.getElementById('builder-categories-container');
  const catId = catData && catData.id ? catData.id : 'new_' + Math.random().toString(36).substring(2, 9);
  const catTitle = catData ? catData.title : '';
  const catOrder = catData ? catData.orderIndex : container.children.length;
  
  const catDiv = document.createElement('div');
  catDiv.className = 'builder-category-item';
  catDiv.dataset.id = catId;
  catDiv.style.cssText = 'background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 10px; padding: 15px; position: relative;';
  catDiv.innerHTML = `
    <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px; flex-wrap: wrap;">
      <span style="color: #EC4899; font-weight: bold; font-size: 13px;">دسته کلاس:</span>
      <input type="text" class="input-ctrl cat-title-input" value="${catTitle}" required placeholder="عنوان دسته (مانند: پودمان اول)" style="flex: 2; min-width: 150px; height: 32px; font-size: 12px;">
      <input type="number" class="input-ctrl cat-order-input" value="${catOrder}" required placeholder="ترتیب" style="width: 70px; height: 32px; font-size: 12px;">
      <button type="button" class="btn-primary" style="background: #10B981; padding: 4px 10px; font-size: 11px; height: 32px;" onclick="addClassUI(this.closest('.builder-category-item'))"><i class="fa-solid fa-plus"></i> افزودن کلاس</button>
      <button type="button" class="page-btn btn-danger" style="padding: 4px 10px; font-size: 11px; height: 32px; margin-right: auto;" onclick="this.closest('.builder-category-item').remove()"><i class="fa-solid fa-trash"></i> حذف دسته</button>
    </div>
    <div class="category-classes-container" style="display: flex; flex-direction: column; gap: 15px; margin-top: 15px; padding-right: 15px; border-right: 2px dashed rgba(255,255,255,0.1);">
      <!-- Classes populated here -->
    </div>
  `;
  container.appendChild(catDiv);
  
  if (catData && catData.sessions) {
    catData.sessions.forEach(sess => {
      addClassUI(catDiv, sess);
    });
  }
}

function addClassUI(catEl, classData = null) {
  const container = catEl.querySelector('.category-classes-container');
  const classId = classData && classData.id ? classData.id : 'new_' + Math.random().toString(36).substring(2, 9);
  const classTitle = classData ? classData.title : '';
  const classDesc = classData ? (classData.description || '') : '';
  const classInstructor = classData ? (classData.instructor || '') : '';
  const minWatch = classData ? (classData.minWatchThreshold || 70) : 70;
  const minPass = classData ? (classData.minPassScore || 0) : 0;
  const maxZarik = classData ? (classData.maxZarikReward || 0) : 0;
  const classOrder = classData ? classData.orderIndex : container.children.length;
  
  const classDiv = document.createElement('div');
  classDiv.className = 'builder-class-item';
  classDiv.dataset.id = classId;
  classDiv.style.cssText = 'background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.03); border-radius: 8px; padding: 12px;';
  classDiv.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 10px;">
      <div class="form-group" style="grid-column: span 2;">
        <label style="font-size: 10px; color: #8b5cf6;">عنوان کلاس / درس</label>
        <input type="text" class="input-ctrl class-title-input" value="${classTitle}" required style="height: 30px; font-size: 11px;">
      </div>
      <div class="form-group" style="grid-column: span 2;">
        <label style="font-size: 10px; color: #8b5cf6;">خلاصه/توضیح کلاس (سرفصل‌ها)</label>
        <input type="text" class="input-ctrl class-desc-input" value="${classDesc}" style="height: 30px; font-size: 11px;" placeholder="مثال: ۱. معرفی دوره - ۲. قوانین">
      </div>
      <div class="form-group" style="grid-column: span 2;">
        <label style="font-size: 10px; color: #8b5cf6;">نام استاد</label>
        <input type="text" class="input-ctrl class-instructor-input" value="${classInstructor}" style="height: 30px; font-size: 11px;" placeholder="نام و نام خانوادگی">
      </div>
      <div class="form-group">
        <label style="font-size: 10px; color: #8b5cf6;">حداقل درصد تماشا</label>
        <input type="number" class="input-ctrl class-watch-input" value="${minWatch}" required style="height: 30px; font-size: 11px;">
      </div>
      <div class="form-group">
        <label style="font-size: 10px; color: #8b5cf6;">ترتیب کلاس</label>
        <input type="number" class="input-ctrl class-order-input" value="${classOrder}" required style="height: 30px; font-size: 11px;">
      </div>
    </div>
    <div style="display: flex; gap: 8px; margin-bottom: 10px;">
      <button type="button" class="btn-primary" style="background:#f59e0b; padding: 3px 8px; font-size: 10px;" onclick="addClipUI(this.closest('.builder-class-item'))"><i class="fa-solid fa-video"></i> + پارت/کلیپ ویدیو</button>
      <button type="button" class="btn-primary" style="background:#e040fb; padding: 3px 8px; font-size: 10px;" onclick="addQuizUI(this.closest('.builder-class-item'))"><i class="fa-solid fa-circle-question"></i> + آزمون ارزیابی</button>
      <button type="button" class="page-btn btn-danger" style="padding: 3px 8px; font-size: 10px; margin-right: auto;" onclick="this.closest('.builder-class-item').remove()"><i class="fa-solid fa-trash"></i> حذف کلاس</button>
    </div>
    
    <!-- Video parts container -->
    <div class="class-clips-container" style="display: flex; flex-direction: column; gap: 8px; margin: 10px 10px 0 0; padding-left: 10px; border-left: 2px solid rgba(245,158,11,0.2);">
      <!-- Video parts clips populated here -->
    </div>
    
    <!-- Quiz container -->
    <div class="class-quiz-container" style="margin-top: 10px;">
      <!-- Quiz populated here -->
    </div>
  `;
  container.appendChild(classDiv);
  
  if (classData) {
    if (classData.videoClips) {
      classData.videoClips.forEach(clip => {
        addClipUI(classDiv, clip);
      });
    }
    if (classData.quiz) {
      addQuizUI(classDiv, classData.quiz);
    }
  }
}

window.uploadClipMediaDirect = async function(input) {
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  const formData = new FormData();
  formData.append('file', file);
  formData.append('assetType', 'course_video');
  
  const parent = input.parentElement;
  const statusEl = parent.querySelector('.clip-upload-status');
  const urlInput = parent.querySelector('.clip-url-input');
  
  statusEl.innerText = 'در حال آپلود...';
  statusEl.style.color = '#10B981';
  
  try {
    const res = await fetch('/api/v1/media/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    if (data.url) {
      urlInput.value = data.url;
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

function addClipUI(classEl, clipData = null) {
  const container = classEl.querySelector('.class-clips-container');
  const clipId = clipData && clipData.id ? clipData.id : 'new_' + Math.random().toString(36).substring(2, 9);
  const clipTitle = clipData ? clipData.title : '';
  const clipUrl = clipData ? clipData.videoUrl : '';
  const clipDur = clipData ? (clipData.duration || 0) : 0;
  const clipOrder = clipData ? clipData.clipOrder : container.children.length;
  
  const clipDiv = document.createElement('div');
  clipDiv.className = 'builder-clip-item';
  clipDiv.dataset.id = clipId;
  clipDiv.style.cssText = 'background: rgba(245,158,11,0.03); border: 1px solid rgba(245,158,11,0.08); border-radius: 6px; padding: 10px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center;';
  clipDiv.innerHTML = `
    <span style="font-size: 10px; color: #f59e0b; font-weight: bold;">پارت/کلیپ:</span>
    <input type="text" class="input-ctrl clip-title-input" value="${clipTitle}" required placeholder="عنوان پارت" style="flex:1; min-width:100px; height:28px; font-size:11px;">
    <input type="text" class="input-ctrl clip-url-input" value="${clipUrl}" required placeholder="آدرس مستقیم ویدیو" style="flex:2; min-width:150px; height:28px; font-size:11px;">
    <input type="number" class="input-ctrl clip-duration-input" value="${clipDur}" required placeholder="مدت (ثانیه)" style="width:75px; height:28px; font-size:11px;">
    <input type="number" class="input-ctrl clip-order-input" value="${clipOrder}" required placeholder="ترتیب" style="width:50px; height:28px; font-size:11px;">
    <div style="display: flex; align-items: center; gap: 5px;">
      <input type="file" onchange="uploadClipMediaDirect(this)" class="input-ctrl" accept="video/*" style="width: 130px; height: 28px; font-size: 9px; padding: 2px;">
      <small class="clip-upload-status" style="font-size: 9px; color: #10B981;"></small>
    </div>
    <button type="button" class="page-btn btn-danger" style="padding: 2px 6px; font-size: 10px; margin-right: auto;" onclick="this.closest('.builder-clip-item').remove()"><i class="fa-solid fa-times"></i> حذف پارت</button>
  `;
  container.appendChild(clipDiv);
}

function addQuizUI(classEl, quizData = null) {
  const container = classEl.querySelector('.class-quiz-container');
  // Check if quiz already exists
  if (container.children.length > 0) return;
  
  const quizId = quizData && quizData.id ? quizData.id : 'new_' + Math.random().toString(36).substring(2, 9);
  const quizTitle = quizData ? quizData.title : 'آزمون پایان کلاس';
  const rewardZarik = quizData ? (quizData.rewardZarik || 0) : 10;
  let qJson = [];
  if (quizData && quizData.questionsJson) {
    try {
      qJson = typeof quizData.questionsJson === 'string' ? JSON.parse(quizData.questionsJson) : quizData.questionsJson;
    } catch(e) { console.error('questionsJson parse error', e); }
  }
  const quizType = quizData ? (quizData.type || 'MULTIPLE_CHOICE') : 'MULTIPLE_CHOICE';

  const quizDiv = document.createElement('div');
  quizDiv.className = 'builder-quiz-item';
  quizDiv.dataset.id = quizId;
  quizDiv.style.cssText = 'background: rgba(224,64,251,0.03); border: 1px solid rgba(224,64,251,0.08); border-radius: 6px; padding: 10px;';
  quizDiv.innerHTML = `
    <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 8px;">
      <span style="font-size: 11px; color: #e040fb; font-weight: bold;">آزمون ارزیابی:</span>
      <input type="text" class="input-ctrl quiz-title-input" value="${quizTitle}" required placeholder="عنوان آزمون" style="flex:2; height:28px; font-size:11px;">
      <select class="select-ctrl quiz-type-input" style="width:100px; height:28px; font-size:11px;">
        <option value="MULTIPLE_CHOICE" ${quizType === 'MULTIPLE_CHOICE' ? 'selected' : ''}>تستی (۴ گزینه‌ای)</option>
        <option value="TEXT" ${quizType === 'TEXT' ? 'selected' : ''}>تشریحی (متنی)</option>
        <option value="FILE" ${quizType === 'FILE' ? 'selected' : ''}>ارسال فایل</option>
      </select>
      <input type="number" class="input-ctrl quiz-zarik-input" value="${rewardZarik}" required placeholder="پاداش زریک" style="width:85px; height:28px; font-size:11px;">
      <button type="button" class="btn-primary" style="background:#e040fb; padding:2px 8px; font-size:9px;" onclick="addQuizQuestionUI(this.closest('.builder-quiz-item'))"><i class="fa-solid fa-plus"></i> افزودن سوال/فیلد</button>
      <button type="button" class="page-btn btn-danger" style="padding:2px 8px; font-size:9px; margin-right: auto;" onclick="this.closest('.builder-quiz-item').remove()"><i class="fa-solid fa-times"></i> حذف آزمون</button>
    </div>
    
    <div class="quiz-questions-container" style="display:flex; flex-direction:column; gap:8px; margin-top:8px; padding-right: 10px; border-right: 2px dashed rgba(224,64,251,0.2);">
      <!-- Questions list -->
    </div>
  `;
  container.appendChild(quizDiv);
  
  if (qJson.length > 0) {
    qJson.forEach(q => {
      addQuizQuestionUI(quizDiv, q);
    });
  } else {
    // Add one empty question by default
    addQuizQuestionUI(quizDiv);
  }
}

function addQuizQuestionUI(quizEl, qData = null) {
  const container = quizEl.querySelector('.quiz-questions-container');
  const qText = qData ? qData.q : '';
  const options = qData && qData.options ? qData.options : ['', '', '', ''];
  const correctIdx = qData ? (qData.correct || 0) : 0;
  
  const qDiv = document.createElement('div');
  qDiv.className = 'builder-question-item';
  qDiv.style.cssText = 'background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.02); border-radius: 5px; padding: 8px;';
  qDiv.innerHTML = `
    <div style="display: flex; gap: 8px; margin-bottom: 5px; align-items: center;">
      <span style="font-size: 10px; color: #ccc;">صورت سوال:</span>
      <input type="text" class="input-ctrl question-text-input" value="${qText}" required placeholder="متن سوال ارزیابی را وارد کنید" style="flex:1; height:26px; font-size:10px;">
      <button type="button" class="page-btn btn-danger" style="padding:1px 5px; font-size:9px;" onclick="this.closest('.builder-question-item').remove()"><i class="fa-solid fa-trash"></i></button>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding-right: 15px;">
      <div style="display:flex; align-items:center; gap:5px;">
        <input type="radio" name="correct_radio_${Math.random()}" class="correct-option-radio" value="0" ${correctIdx === 0 ? 'checked' : ''}>
        <input type="text" class="input-ctrl option-input" value="${options[0] || ''}" required placeholder="گزینه ۱" style="height:24px; font-size:10px;">
      </div>
      <div style="display:flex; align-items:center; gap:5px;">
        <input type="radio" name="${Math.random()}" class="correct-option-radio" value="1" ${correctIdx === 1 ? 'checked' : ''}>
        <input type="text" class="input-ctrl option-input" value="${options[1] || ''}" required placeholder="گزینه ۲" style="height:24px; font-size:10px;">
      </div>
      <div style="display:flex; align-items:center; gap:5px;">
        <input type="radio" name="${Math.random()}" class="correct-option-radio" value="2" ${correctIdx === 2 ? 'checked' : ''}>
        <input type="text" class="input-ctrl option-input" value="${options[2] || ''}" required placeholder="گزینه ۳" style="height:24px; font-size:10px;">
      </div>
      <div style="display:flex; align-items:center; gap:5px;">
        <input type="radio" name="${Math.random()}" class="correct-option-radio" value="3" ${correctIdx === 3 ? 'checked' : ''}>
        <input type="text" class="input-ctrl option-input" value="${options[3] || ''}" required placeholder="گزینه ۴" style="height:24px; font-size:10px;">
      </div>
    </div>
  `;
  
  // Set shared radio name per question
  const radioName = 'correct_radio_' + Math.random().toString(36).substring(2, 9);
  qDiv.querySelectorAll('.correct-option-radio').forEach(r => r.name = radioName);
  
  container.appendChild(qDiv);
}

function editLmsStation(stationId) {
  const station = window.lmsStations.find(s => s.id === stationId);
  if (!station) return;
  
  document.getElementById('lms-station-id').value = station.id;
  document.getElementById('lms-station-title').value = station.title;
  document.getElementById('lms-station-order').value = station.orderIndex;
  document.getElementById('lms-station-release-date').value = station.releaseDate ? station.releaseDate.substring(0, 10) : '';
  document.getElementById('lms-station-release-time').value = station.releaseTime || '';
  document.getElementById('lms-station-desc').value = station.description || '';
  document.getElementById('lms-station-icon').value = station.iconUrl || '';
  
  const container = document.getElementById('builder-categories-container');
  container.innerHTML = '';
  
  document.getElementById('lms-builder-title').innerText = `ویرایش منزلگاه: ${station.title}`;
  document.getElementById('lms-builder-card').style.display = 'block';
  
  if (station.categories) {
    station.categories.forEach(cat => {
      addCategoryUI(cat);
    });
  }
  
  document.getElementById('lms-builder-card').scrollIntoView({ behavior: 'smooth' });
}

async function deleteLmsStation(stationId) {
  if (confirm('آیا از حذف این منزلگاه و تمام پارت‌های ویدیو و آزمون‌های آن مطمئن هستید؟ این عملیات غیرقابل بازگشت است.')) {
    try {
      const res = await request(`/api/v1/admin/lms/stations/${stationId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        alert('منزلگاه با موفقیت حذف شد');
        loadLmsData();
        cancelLmsBuilder();
      } else {
        alert('خطا در حذف منزلگاه');
      }
    } catch(e) {
      console.error(e);
      alert('خطا در ارتباط با سرور');
    }
  }
}

async function submitLmsStationUnified(e) {
  e.preventDefault();
  
  const id = document.getElementById('lms-station-id').value;
  const title = document.getElementById('lms-station-title').value;
  const orderIndex = document.getElementById('lms-station-order').value;
  const releaseDate = document.getElementById('lms-station-release-date').value;
  const releaseTime = document.getElementById('lms-station-release-time').value;
  const description = document.getElementById('lms-station-desc').value;
  const iconUrl = document.getElementById('lms-station-icon').value;
  
  // Serialize Categories
  const categories = [];
  const catItems = document.querySelectorAll('.builder-category-item');
  
  catItems.forEach(catEl => {
    const catId = catEl.dataset.id.startsWith('new_') ? null : catEl.dataset.id;
    const catTitle = catEl.querySelector('.cat-title-input').value;
    const catOrder = catEl.querySelector('.cat-order-input').value;
    
    // Serialize Sessions (Classes)
    const sessions = [];
    const classItems = catEl.querySelectorAll('.builder-class-item');
    
    classItems.forEach(classEl => {
      const classId = classEl.dataset.id.startsWith('new_') ? null : classEl.dataset.id;
      const classTitle = classEl.querySelector('.class-title-input').value;
      const classDesc = classEl.querySelector('.class-desc-input').value;
      const classInstructor = classEl.querySelector('.class-instructor-input').value;
      const classWatch = classEl.querySelector('.class-watch-input').value;
      const classOrder = classEl.querySelector('.class-order-input').value;
      
      // Serialize Clips
      const videoClips = [];
      const clipItems = classEl.querySelectorAll('.builder-clip-item');
      clipItems.forEach(clipEl => {
        const clipId = clipEl.dataset.id.startsWith('new_') ? null : clipEl.dataset.id;
        const clipTitle = clipEl.querySelector('.clip-title-input').value;
        const clipUrl = clipEl.querySelector('.clip-url-input').value;
        const clipDur = clipEl.querySelector('.clip-duration-input').value;
        const clipOrder = clipEl.querySelector('.clip-order-input').value;
        
        videoClips.push({
          id: clipId,
          title: clipTitle,
          videoUrl: clipUrl,
          duration: Number(clipDur),
          clipOrder: Number(clipOrder)
        });
      });
      
      // Serialize Quiz
      let quiz = null;
      const quizEl = classEl.querySelector('.builder-quiz-item');
      if (quizEl) {
        const quizId = quizEl.dataset.id.startsWith('new_') ? null : quizEl.dataset.id;
        const quizTitle = quizEl.querySelector('.quiz-title-input').value;
        const quizType = quizEl.querySelector('.quiz-type-input').value;
        const quizZarik = quizEl.querySelector('.quiz-zarik-input').value;
        
        // Serialize Questions
        const questions = [];
        const qItems = quizEl.querySelectorAll('.builder-question-item');
        qItems.forEach(qEl => {
          const qText = qEl.querySelector('.question-text-input').value;
          const options = [];
          qEl.querySelectorAll('.option-input').forEach(optEl => {
            options.push(optEl.value);
          });
          
          let correctIdx = 0;
          const radios = qEl.querySelectorAll('.correct-option-radio');
          radios.forEach((r, rIdx) => {
            if (r.checked) correctIdx = rIdx;
          });
          
          questions.push({
            q: qText,
            options,
            correct: correctIdx
          });
        });
        
        quiz = {
          id: quizId,
          title: quizTitle,
          type: quizType,
          questionsJson: JSON.stringify(questions),
          rewardZarik: Number(quizZarik)
        };
      }
      
      sessions.push({
        id: classId,
        title: classTitle,
        description: classDesc,
        instructor: classInstructor,
        minWatchThreshold: Number(classWatch),
        orderIndex: Number(classOrder),
        videoClips,
        quiz
      });
    });
    
    categories.push({
      id: catId,
      title: catTitle,
      orderIndex: Number(catOrder),
      sessions
    });
  });
  
  const payload = {
    id: id || undefined,
    title,
    orderIndex,
    releaseDate: releaseDate || null,
    releaseTime: releaseTime || null,
    description,
    iconUrl,
    categories
  };
  
  try {
    const url = id ? `/api/v1/admin/lms/stations/${id}` : '/api/v1/admin/lms/stations';
    const method = id ? 'PUT' : 'POST';
    
    const res = await request(url, {
      method,
      body: JSON.stringify(payload)
    });
    
    if (res.ok) {
      alert('کل ساختار منزلگاه با موفقیت ذخیره شد');
      cancelLmsBuilder();
      loadLmsData();
    } else {
      const data = await res.json();
      alert('خطا در ذخیره ساختار: ' + (data.error || 'خطای ناشناخته'));
    }
  } catch(e) {
    console.error(e);
    alert('خطای شبکه در ارتباط با سرور');
  }
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

// Deprecated legacy LMS functions replaced by Unified Visual Form Builder

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

document.querySelector('[data-tab="submissions-tab"]')?.addEventListener('click', loadAdminSubmissions);

async function loadAdminSubmissions() {
  try {
    const res = await fetch('/api/v1/submissions/pending', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const list = await res.json();
    const tbody = document.querySelector('#admin-submissions-table tbody');
    if (!tbody) return;
    
    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">خطا در بارگذاری داده‌ها</td></tr>`;
      return;
    }
    
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">هیچ تکلیف معلقی یافت نشد</td></tr>`;
      return;
    }
    
    tbody.innerHTML = list.map(s => `
      <tr>
        <td>${s.student?.name || 'نامشخص'}</td>
        <td>${s.challenge?.title || 'نامشخص'}</td>
        <td>${s.answerText || '-'}</td>
        <td>${s.fileUrl ? `<a href="${s.fileUrl}" target="_blank" class="btn-action"><i class="fa-solid fa-download"></i> دانلود</a>` : '-'}</td>
        <td>${new Date(s.submittedAt).toLocaleDateString('fa-IR')}</td>
        <td>${s.challenge?.rewardZarik || 200}</td>
        <td>
          <button class="btn-primary btn-sm" onclick="reviewAdminSubmission('${s.id}', true, ${s.challenge?.rewardZarik || 200})">تایید <i class="fa-solid fa-check"></i></button>
          <button class="btn-danger btn-sm" onclick="reviewAdminSubmission('${s.id}', false, 0)">رد <i class="fa-solid fa-xmark"></i></button>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error(error);
  }
}

window.reviewAdminSubmission = async function(id, approve, defaultReward) {
  const score = approve ? (prompt('میزان پاداش زریک:', defaultReward) || defaultReward) : 0;
  const feedback = prompt('یادداشت / فیدبک ارزیابی:', approve ? 'تایید شد' : 'رد شد. لطفا مجدد تلاش کنید.');
  
  if (score === null || feedback === null) return; // cancel
  
  try {
    const res = await fetch(`/api/v1/submissions/${id}/review`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: approve ? 'approved' : 'rejected',
        score: Number(score),
        mentorFeedback: feedback
      })
    });
    
    if (res.ok) {
      alert('ارزیابی با موفقیت ثبت شد');
      loadAdminSubmissions();
    } else {
      const data = await res.json();
      alert('خطا در ارزیابی: ' + (data.error || 'خطای ناشناخته'));
    }
  } catch (error) {
    console.error(error);
    alert('خطای اتصال به سرور');
  }
};

// ===============================
// BULK TRANSFER MODAL LOGIC
// ===============================

window.bulkTransferSelectedMembers = [];

window.openBulkTransferModal = async function() {
  document.getElementById('bulk-transfer-modal').style.display = 'flex';
  document.getElementById('bt-student-search').value = '';
  document.getElementById('bt-student-results').innerHTML = '';
  document.getElementById('bt-target-caravan').innerHTML = '<option value="">در حال بارگذاری...</option>';
  
  window.bulkTransferSelectedMembers = [];
  renderBulkSelectedMembers();

  try {
    const res = await request('/api/v1/admin/caravans');
    const caravans = await res.json();
    
    let optionsHtml = '<option value="">لطفاً کاروان مقصد را انتخاب کنید</option>';
    optionsHtml += '<option value="unassign" style="color:red; font-weight:bold;">-- خروج از کاروان فعلی (بدون کاروان) --</option>';
    
    caravans.forEach(c => {
      optionsHtml += `<option value="${c.id}">${c.name} (راهبر: ${c.mentor?.name || 'ندارد'})</option>`;
    });
    
    document.getElementById('bt-target-caravan').innerHTML = optionsHtml;
  } catch (error) {
    console.error('Failed to load caravans for transfer modal', error);
    document.getElementById('bt-target-caravan').innerHTML = '<option value="">خطا در بارگذاری کاروان‌ها</option>';
  }
};

window.closeBulkTransferModal = function() {
  document.getElementById('bulk-transfer-modal').style.display = 'none';
};

window.renderBulkSelectedMembers = function() {
  const container = document.getElementById('bt-selected-members');
  const count = document.getElementById('bt-selected-count');
  
  count.innerText = window.bulkTransferSelectedMembers.length;
  
  if (window.bulkTransferSelectedMembers.length === 0) {
    container.innerHTML = '<li style="color: var(--text-secondary); font-size: 13px;">هیچ عضوی انتخاب نشده است.</li>';
    return;
  }
  
  container.innerHTML = window.bulkTransferSelectedMembers.map(m => `
    <li style="background: rgba(139, 92, 246, 0.2); border: 1px solid #8b5cf6; padding: 5px 12px; border-radius: 20px; font-size: 13px; display:flex; align-items:center; gap:8px;">
      ${m.name} (NP-${m.code})
      <i class="fa-solid fa-times" style="cursor:pointer; color: #f43f5e;" onclick="removeBulkSelectedMember('${m.id}')"></i>
    </li>
  `).join('');
};

window.removeBulkSelectedMember = function(id) {
  window.bulkTransferSelectedMembers = window.bulkTransferSelectedMembers.filter(m => m.id !== id);
  renderBulkSelectedMembers();
};

document.getElementById('bt-student-search')?.addEventListener('input', async (e) => {
  const q = e.target.value.trim();
  const resultsDiv = document.getElementById('bt-student-results');
  if (q.length < 2) {
    resultsDiv.innerHTML = '';
    return;
  }
  
  try {
    const res = await request(`/api/v1/admin/users?role=student&search=${encodeURIComponent(q)}`);
    const data = await res.json();
    const students = Array.isArray(data) ? data : data.users;
    
    const html = students.filter(s => !window.bulkTransferSelectedMembers.some(sel => sel.id === s.id)).map(s => `
      <div class="bt-student-item" style="padding:10px; cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between;" data-id="${s.id}" data-name="${s.name}" data-code="${s.userCode || s.phoneNumber}">
        <span><strong>${s.name}</strong> - NP-${s.userCode || s.phoneNumber} <span style="font-size:10px; color:#aaa;">(${s.caravan?.name || 'بدون کاروان'})</span></span>
        <i class="fa-solid fa-plus" style="color: #8b5cf6;"></i>
      </div>
    `).join('');
    
    resultsDiv.innerHTML = html;
  } catch (error) {
    console.error('Search failed', error);
  }
});

document.getElementById('bt-student-results')?.addEventListener('click', (e) => {
  const item = e.target.closest('.bt-student-item');
  if (item) {
    window.bulkTransferSelectedMembers.push({ 
      id: item.dataset.id, 
      name: item.dataset.name, 
      code: item.dataset.code 
    });
    document.getElementById('bt-student-search').value = '';
    document.getElementById('bt-student-results').innerHTML = '';
    renderBulkSelectedMembers();
  }
});

window.submitBulkTransfer = async function() {
  const targetCaravanId = document.getElementById('bt-target-caravan').value;
  const userIds = window.bulkTransferSelectedMembers.map(m => m.id);
  
  if (userIds.length === 0) {
    return alert('لطفاً حداقل یک عضو را برای انتقال انتخاب کنید.');
  }
  if (!targetCaravanId) {
    return alert('لطفاً کاروان مقصد را انتخاب کنید.');
  }
  
  try {
    const payloadTarget = targetCaravanId === 'unassign' ? null : targetCaravanId;
    
    const res = await request('/api/v1/admin/caravans/bulk-transfer', {
      method: 'POST',
      body: JSON.stringify({ userIds, targetCaravanId: payloadTarget })
    });
    
    if (res.ok) {
      alert('اعضا با موفقیت منتقل شدند');
      closeBulkTransferModal();
      if (typeof loadCaravansTab === 'function') loadCaravansTab();
      if (typeof loadCaravanMembersRoster === 'function') loadCaravanMembersRoster();
    } else {
      const data = await res.json();
      alert('خطا در انتقال: ' + (data.error || 'ناشناخته'));
    }
  } catch (err) {
    console.error(err);
    alert('خطا در ارتباط با سرور');
  }
};

window.addStudentToCaravan = async function() {
  const q = document.getElementById('cw-add-student-input').value.trim();
  if(!q) return alert('لطفاً نام یا کد ملی را وارد کنید');
  if(!currentDrawerCaravanId) return alert('خطا: کاروان فعلی مشخص نیست');

  try {
    const searchRes = await request(`/api/v1/admin/users?role=student&search=${encodeURIComponent(q)}`);
    const users = await searchRes.json();
    
    if(users.length === 0) return alert('دانش‌آموزی یافت نشد');
    const targetUser = users.find(u => !u.caravanId) || users[0];

    const res = await request(`/api/v1/admin/caravans/${currentDrawerCaravanId}/members/add`, {
      method: 'PATCH',
      body: JSON.stringify({ userId: targetUser.id })
    });
    
    if(res.ok) {
      alert('دانش‌آموز با موفقیت افزوده شد');
      document.getElementById('cw-add-student-input').value = '';
      if (typeof viewCaravanDetails === 'function') viewCaravanDetails(currentDrawerCaravanId);
    } else {
      const data = await res.json();
      alert('خطا: ' + (data.error || 'ناشناخته'));
    }
  } catch(e) {
    console.error(e);
    alert('خطا در ارتباط با سرور');
  }
};

window.openCaravanStudentDetails = async function(userId) {
  try {
    const res = await request(`/api/v1/admin/users/${userId}/analytics`);
    if(!res.ok) throw new Error('Failed to fetch user analytics');
    const data = await res.json();
    
    document.getElementById('csd-identity').innerHTML = `
      <strong>نام:</strong> ${data.name || 'نامشخص'}<br>
      <strong>کد ملی:</strong> ${data.nationalId || '-'}<br>
      <strong>شماره تماس:</strong> ${data.phoneNumber || '-'}<br>
      <strong>شهر:</strong> ${data.city || '-'}<br>
      <strong>تاریخ ثبت‌نام:</strong> ${data.createdAt ? new Date(data.createdAt).toLocaleDateString('fa-IR') : '-'}<br>
      <strong>پروفایل فریم:</strong> ${data.levelFrame || 1}
    `;

    document.getElementById('csd-assets').innerHTML = `
      <strong>موجودی زریک:</strong> ${data.zarikBalance || 0}<br>
      <strong>موجودی نخ:</strong> ${data.nakhBalance || 0}<br>
      <strong>موجودی بیرق:</strong> ${data.beyraghBalance || 0}<br>
      <strong>موجودی فرش:</strong> ${data.farshBalance || 0}
    `;

    let progHtml = '';
    if(data.classProgress && data.classProgress.length > 0) {
       progHtml = data.classProgress.map(p => `<div>- ${p.sessionName}: ${p.watchPercentage}% | کوییز: ${p.quizScore}</div>`).join('');
    } else {
       progHtml = 'داده‌ای موجود نیست';
    }
    document.getElementById('csd-progress').innerHTML = progHtml;

    let ticketsHtml = '';
    if(data.recentTickets && data.recentTickets.length > 0) {
       ticketsHtml = data.recentTickets.map(t => `<div>- ${t.subject} (${t.status})</div>`).join('');
    } else {
       ticketsHtml = 'تیکتی یافت نشد';
    }
    document.getElementById('csd-tickets').innerHTML = ticketsHtml;

    document.getElementById('caravan-student-detail-modal').style.display = 'flex';
  } catch(e) {
    console.error(e);
    alert('خطا در دریافت جزئیات دانش‌آموز');
  }
};

window.selectedCandidateMembers = new Set();

window.openAddMemberToCaravanModal = async function() {
  window.selectedCandidateMembers.clear();
  const countEl = document.getElementById('add-member-selected-count');
  if (countEl) countEl.innerText = '0';

  const modal = document.getElementById('add-member-to-caravan-modal');
  if (!modal) return;

  // Populate modal caravan picker options
  const modalPicker = document.getElementById('modal-add-member-caravan-picker');
  const pagePicker = document.getElementById('target-caravan-picker') || document.getElementById('main-caravan-selector');
  const selectedCaravanId = pagePicker ? pagePicker.value : '';

  if (modalPicker) {
    let optionsHtml = '<option value="">-- انتخاب کاروان --</option>';
    const caravans = window.caravansData || window.caravansMasterList || caravansList || [];
    if (caravans.length > 0) {
      optionsHtml += caravans.map(c => `<option value="${c.id}" ${c.id === selectedCaravanId ? 'selected' : ''}>${c.name}</option>`).join('');
    } else if (pagePicker && pagePicker.options) {
      Array.from(pagePicker.options).forEach(opt => {
        if (opt.value) {
          optionsHtml += `<option value="${opt.value}" ${opt.value === selectedCaravanId ? 'selected' : ''}>${opt.text}</option>`;
        }
      });
    }
    modalPicker.innerHTML = optionsHtml;
  }

  const searchInput = document.getElementById('input-search-candidate-member');
  if (searchInput) searchInput.value = '';

  modal.style.display = 'flex';
  modal.style.zIndex = '999999';

  // Load all candidates by default
  window.searchCandidateMembers('');
};

function openAddMemberToCaravanModal() {
  if (typeof window.openAddMemberToCaravanModal === 'function') {
    return window.openAddMemberToCaravanModal();
  }
}

window.closeAddMemberToCaravanModal = function() {
  const modal = document.getElementById('add-member-to-caravan-modal');
  if (modal) modal.style.display = 'none';
};

function closeAddMemberToCaravanModal() {
  if (typeof window.closeAddMemberToCaravanModal === 'function') {
    return window.closeAddMemberToCaravanModal();
  }
}

window.toggleCandidateSelection = function(checkbox, userId) {
  if (checkbox.checked) {
    window.selectedCandidateMembers.add(userId);
  } else {
    window.selectedCandidateMembers.delete(userId);
  }
  const countEl = document.getElementById('add-member-selected-count');
  if (countEl) countEl.innerText = window.selectedCandidateMembers.size;
};

window.searchCandidateMembers = async function(query) {
  const container = document.getElementById('candidate-members-list');
  if (!container) return;

  container.innerHTML = '<p style="text-align:center; color:#94a3b8; font-size:12px; margin:10px 0;">در حال بارگذاری کاربران...</p>';

  try {
    const qStr = query ? query.trim() : '';
    const token = localStorage.getItem('token') || localStorage.getItem('nopa_admin_token') || '';
    const res = await fetch(`/api/v1/admin/users?limit=100&search=${encodeURIComponent(qStr)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const users = data.users || (Array.isArray(data) ? data : []);

    if (users.length === 0) {
      container.innerHTML = '<p style="text-align:center; color:#ef4444; font-size:12px; margin:10px 0;">کاربری با این مشخصات یافت نشد</p>';
      return;
    }

    container.innerHTML = users.map(u => {
      const isChecked = window.selectedCandidateMembers.has(u.id) ? 'checked' : '';
      const caravanBadge = u.caravanName ? `<span style="color:#a78bfa; font-size:11px; background:rgba(124,58,237,0.2); padding:1px 6px; border-radius:4px;">(${u.caravanName})</span>` : `<span style="color:#10b981; font-size:11px; background:rgba(16,185,129,0.2); padding:1px 6px; border-radius:4px;">(بدون کاروان)</span>`;
      const roleBadge = u.role === 'mentor' ? 'مربی' : u.role === 'admin' ? 'مدیر' : 'دانش‌آموز';

      return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; border-bottom:1px solid rgba(255,255,255,0.05); font-size:13px;">
          <label style="display:flex; align-items:center; gap:10px; cursor:pointer; flex:1;">
            <input type="checkbox" onchange="window.toggleCandidateSelection(this, '${u.id}')" ${isChecked}>
            <div>
              <strong style="color:white;">${u.name || 'بدون نام'}</strong>
              <span style="color:#94a3b8; font-size:11px; margin-right:6px;" dir="ltr">${u.phoneNumber || '-'}</span>
              <span style="color:#cbd5e1; font-size:11px; margin-right:4px;">[${roleBadge}]</span>
              ${caravanBadge}
            </div>
          </label>
        </div>
      `;
    }).join('');
  } catch(e) {
    console.error(e);
    container.innerHTML = '<p style="text-align:center; color:#ef4444; font-size:12px;">خطا در جستجو و دریافت لیست کاربران</p>';
  }
};

window.confirmBulkAddUsersToCaravan = async function() {
  const modalPicker = document.getElementById('modal-add-member-caravan-picker');
  const pagePicker = document.getElementById('target-caravan-picker') || document.getElementById('main-caravan-selector');
  const targetCaravanId = modalPicker?.value || pagePicker?.value;

  if (!targetCaravanId) {
    return alert('لطفاً کاروان مقصد را از کشوی بالای فرم انتخاب کنید');
  }

  const userIds = Array.from(window.selectedCandidateMembers);
  if (userIds.length === 0) {
    return alert('لطفاً حداقل یک کاربر را انتخاب کنید');
  }

  try {
    const token = localStorage.getItem('token') || localStorage.getItem('nopa_admin_token') || '';
    const res = await fetch(`/api/v1/admin/caravans/${targetCaravanId}/members/bulk-add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ userIds })
    });

    if (res.ok) {
      window.closeAddMemberToCaravanModal();
      alert('کاربران با موفقیت به کاروان اضافه شدند');
      
      // Update page caravan picker & refresh details
      if (pagePicker) {
        pagePicker.value = targetCaravanId;
      }
      if (typeof window.loadSelectedCaravanDetails === 'function') {
        window.loadSelectedCaravanDetails();
      }
      if (typeof window.renderCaravansTable === 'function') {
        window.renderCaravansTable();
      }
      if (typeof window.loadCaravansTab === 'function') {
        window.loadCaravansTab();
      }
    } else {
      const err = await res.json();
      alert(err.error || 'خطا در افزودن کاربران به کاروان');
    }
  } catch(e) {
    console.error(e);
    alert('خطا در ارتباط با سرور');
  }
};

function confirmBulkAddUsersToCaravan() {
  if (typeof window.confirmBulkAddUsersToCaravan === 'function') {
    return window.confirmBulkAddUsersToCaravan();
  }
}

window.openChangeCaravanMentorModal = async function() {
  const currentCaravanId = document.getElementById('target-caravan-picker')?.value || document.getElementById('main-caravan-selector')?.value;
  if (!currentCaravanId) {
    return alert('لطفاً ابتدا یک کاروان را انتخاب کنید');
  }

  const modal = document.getElementById('change-caravan-mentor-modal');
  if (!modal) return;

  const mentorSelect = document.getElementById('cw-mentor-select');
  if (mentorSelect) {
    mentorSelect.innerHTML = '<option value="">در حال بارگذاری راهبران...</option>';
  }

  modal.style.display = 'flex';
  modal.style.zIndex = '999999';

  const caravan = window.caravansData?.find(c => c.id === currentCaravanId);
  const currentMentorId = caravan?.mentorId || caravan?.mentor?.id || '';

  try {
    const token = localStorage.getItem('token') || localStorage.getItem('nopa_admin_token') || '';
    let mentors = [];
    
    // Fetch mentors
    const res = await fetch('/api/v1/admin/mentors', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      mentors = Array.isArray(data) ? data : (data.users || data.mentors || []);
    }

    if (mentorSelect) {
      let options = '<option value="">-- بدون راهبر --</option>';
      if (mentors.length === 0) {
        options += '<option value="" disabled>هیچ راهبری یافت نشد</option>';
      } else {
        options += mentors.map(m => `
          <option value="${m.id}" ${m.id === currentMentorId ? 'selected' : ''}>
            ${m.name || 'بدون نام'} (${m.phoneNumber || '-'})
          </option>
        `).join('');
      }
      mentorSelect.innerHTML = options;
    }
  } catch(e) {
    console.error('Error loading mentors:', e);
    if (mentorSelect) mentorSelect.innerHTML = '<option value="">خطا در بارگذاری لیست راهبران</option>';
  }
};

function openChangeCaravanMentorModal() {
  if (typeof window.openChangeCaravanMentorModal === 'function') {
    return window.openChangeCaravanMentorModal();
  }
}

window.closeChangeCaravanMentorModal = function() {
  const modal = document.getElementById('change-caravan-mentor-modal');
  if (modal) modal.style.display = 'none';
};

function closeChangeCaravanMentorModal() {
  if (typeof window.closeChangeCaravanMentorModal === 'function') {
    return window.closeChangeCaravanMentorModal();
  }
}

window.updateCaravanMentor = async function() {
  const currentCaravanId = document.getElementById('target-caravan-picker')?.value || document.getElementById('main-caravan-selector')?.value;
  if (!currentCaravanId) {
    return alert('لطفاً ابتدا یک کاروان را انتخاب کنید');
  }

  const mentorId = document.getElementById('cw-mentor-select')?.value || null;
  
  try {
    const token = localStorage.getItem('token') || localStorage.getItem('nopa_admin_token') || '';
    const res = await fetch(`/api/v1/admin/caravans/${currentCaravanId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ mentorId })
    });

    if (res.ok) {
      window.closeChangeCaravanMentorModal();
      alert('راهبر کاروان با موفقیت تغییر یافت');
      
      if (typeof window.loadCaravansTab === 'function') {
        await window.loadCaravansTab();
      }

      const picker = document.getElementById('target-caravan-picker');
      if (picker) {
        picker.value = currentCaravanId;
      }
      if (typeof window.loadSelectedCaravanDetails === 'function') {
        window.loadSelectedCaravanDetails();
      }
    } else {
      const err = await res.json();
      alert(err.error || 'خطا در تغییر راهبر');
    }
  } catch(e) {
    console.error(e);
    alert('خطا در ارتباط با سرور');
  }
};

// --- BANNERS & NEWS MANAGEMENT ---

window.loadBannersTab = async function() {
  try {
    const res = await fetch('/api/v1/banners', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
    const banners = await res.json();
    const tbody = document.querySelector('#banners-table tbody');
    tbody.innerHTML = '';
    banners.forEach(b => {
      tbody.innerHTML += `
        <tr>
          <td><img src="${b.imageUrl}" style="width: 60px; border-radius: 4px;" /></td>
          <td>${b.title}</td>
          <td>${b.position}</td>
          <td>${b.orderIndex}</td>
          <td>${b.isActive ? '<span class="status-badge status-active">فعال</span>' : '<span class="status-badge status-inactive">غیرفعال</span>'}</td>
          <td>
            <button class="btn-action" style="background:var(--color-primary); color:white;" onclick="editBanner('${b.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="btn-action" style="background:var(--color-danger); color:white;" onclick="deleteBanner('${b.id}')"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>
      `;
    });
  } catch(e) {
    console.error('Error loading banners', e);
  }
};

window.openCreateBannerModal = function() {
  document.getElementById('banner-form').reset();
  document.getElementById('banner-id').value = '';
  document.getElementById('banner-modal-title').innerHTML = '<i class="fa-solid fa-image" style="color: #f59e0b;"></i> افزودن بنر';
  
  const m = document.getElementById('banner-modal');
  if (m) {
    m.style.display = 'flex';
    m.classList.remove('hidden');
  } else {
    console.error("Modal #banner-modal not found in DOM");
  }
};

window.closeBannerModal = function() {
  const m = document.getElementById('banner-modal');
  if (m) m.style.display = 'none';
};

window.editBanner = async function(id) {
  try {
    const res = await fetch('/api/v1/admin/banners', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
    const banners = await res.json();
    const b = banners.find(x => x.id === id);
    if (!b) return;
    document.getElementById('banner-id').value = b.id;
    document.getElementById('banner-title').value = b.title;
    document.getElementById('banner-target').value = b.targetRoute || '';
    document.getElementById('banner-position').value = b.position;
    document.getElementById('banner-order').value = b.orderIndex;
    document.getElementById('banner-active').checked = b.isActive;
    document.getElementById('banner-modal-title').innerHTML = '<i class="fa-solid fa-pen" style="color: #f59e0b;"></i> ویرایش بنر';
    document.getElementById('banner-modal').style.display = 'flex';
  } catch (e) { console.error(e); }
};

window.saveBannerItem = async function(e) {
  e.preventDefault();
  const id = document.getElementById('banner-id').value;
  const formData = new FormData();
  formData.append('title', document.getElementById('banner-title').value);
  formData.append('targetRoute', document.getElementById('banner-target').value);
  formData.append('position', document.getElementById('banner-position').value);
  formData.append('orderIndex', document.getElementById('banner-order').value);
  formData.append('isActive', document.getElementById('banner-active').checked);
  const fileInput = document.getElementById('banner-file');
  if (fileInput.files[0]) formData.append('image', fileInput.files[0]);
  
  const url = id ? `/api/v1/admin/banners/${id}` : '/api/v1/admin/banners';
  const method = id ? 'PUT' : 'POST';
  
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: formData
    });
    if (res.ok) {
      closeBannerModal();
      loadBannersTab();
    } else {
      const err = await res.json();
      alert(err.error || 'خطا در ثبت بنر');
    }
  } catch(e) { alert('Network Error'); }
};

window.deleteBanner = async function(id) {
  if (!confirm('آیا از حذف این بنر مطمئن هستید؟')) return;
  try {
    const res = await fetch(`/api/v1/admin/banners/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.ok) loadBannersTab();
  } catch(e) { console.error(e); }
};

window.cachedNewsList = [];

window.loadNewsTab = async function() {
  const tbody = document.querySelector('#news-tbody') || document.querySelector('#news-table tbody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> در حال بارگذاری اخبار و اعلانات جارچی...</td></tr>';
  }

  try {
    const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
    const res = await fetch('/api/v1/admin/news', { 
      headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) } 
    });
    
    if (!res.ok) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:#ef4444;">خطا در دریافت اطلاعات اخبار از سرور</td></tr>';
      return;
    }

    const news = await res.json();
    window.cachedNewsList = Array.isArray(news) ? news : [];

    // Calculate stats
    const totalCount = window.cachedNewsList.length;
    const publishedCount = window.cachedNewsList.filter(n => n.isPublished).length;
    const draftCount = totalCount - publishedCount;

    const elTotal = document.getElementById('news-stat-total');
    const elPub = document.getElementById('news-stat-published');
    const elDraft = document.getElementById('news-stat-drafts');

    if (elTotal) elTotal.textContent = `${totalCount} خبر`;
    if (elPub) elPub.textContent = `${publishedCount} خبر فعال`;
    if (elDraft) elDraft.textContent = `${draftCount} پیش‌نویس`;

    window.filterNewsTable();
  } catch(e) {
    console.error('Error loading news:', e);
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:#ef4444;">ارتباط با سرور برقرار نشد</td></tr>';
  }
};

window.filterNewsTable = function() {
  const query = (document.getElementById('news-search-input')?.value || '').toLowerCase().trim();
  const categoryFilter = document.getElementById('news-filter-category')?.value || 'all';
  const audienceFilter = document.getElementById('news-filter-audience')?.value || 'all';

  let filtered = window.cachedNewsList || [];

  if (query) {
    filtered = filtered.filter(n => 
      (n.title && n.title.toLowerCase().includes(query)) ||
      (n.subtitle && n.subtitle.toLowerCase().includes(query)) ||
      (n.body && n.body.toLowerCase().includes(query)) ||
      (n.reporter && n.reporter.toLowerCase().includes(query))
    );
  }

  if (categoryFilter !== 'all') {
    filtered = filtered.filter(n => (n.category || '') === categoryFilter);
  }

  if (audienceFilter !== 'all') {
    filtered = filtered.filter(n => (n.targetAudience || 'ALL') === audienceFilter);
  }

  window.renderNewsTable(filtered);
};

window.renderNewsTable = function(newsList) {
  const tbody = document.querySelector('#news-tbody') || document.querySelector('#news-table tbody');
  if (!tbody) return;

  if (!newsList || newsList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:#94a3b8;"><i class="fa-solid fa-inbox" style="font-size:24px; display:block; margin-bottom:8px; opacity:0.5;"></i>هیچ خبر یا اطلاعیه‌ای یافت نشد.</td></tr>';
    return;
  }

  const categoryColors = {
    'اطلاعیه مهم': { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: 'rgba(239, 68, 68, 0.3)' },
    'رویداد و مسابقه': { bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', border: 'rgba(56, 189, 248, 0.3)' },
    'اخبار کاروان‌ها': { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: 'rgba(16, 185, 129, 0.3)' },
    'آموزشی': { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.3)' }
  };

  const audienceLabels = {
    'ALL': '<span class="badge" style="background:rgba(255,255,255,0.08); color:#cbd5e1; border:1px solid rgba(255,255,255,0.1); font-size:11px; padding:3px 8px; border-radius:6px;"><i class="fa-solid fa-users"></i> عمومی</span>',
    'STUDENTS': '<span class="badge" style="background:rgba(14, 165, 233, 0.15); color:#38bdf8; border:1px solid rgba(14, 165, 233, 0.3); font-size:11px; padding:3px 8px; border-radius:6px;"><i class="fa-solid fa-user-graduate"></i> دانش‌آموزان</span>',
    'MENTORS': '<span class="badge" style="background:rgba(245, 158, 11, 0.15); color:#fbbf24; border:1px solid rgba(245, 158, 11, 0.3); font-size:11px; padding:3px 8px; border-radius:6px;"><i class="fa-solid fa-user-tie"></i> راهبران</span>'
  };

  tbody.innerHTML = newsList.map(n => {
    const catStyle = categoryColors[n.category] || { bg: 'rgba(148, 163, 184, 0.15)', text: '#cbd5e1', border: 'rgba(148, 163, 184, 0.3)' };
    const audienceBadge = audienceLabels[n.targetAudience] || audienceLabels['ALL'];
    const pDate = n.publishDate ? new Date(n.publishDate).toLocaleDateString('fa-IR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
    
    const imageMarkup = n.imageUrl 
      ? `<img src="${n.imageUrl}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 2px 6px rgba(0,0,0,0.3);" />`
      : `<div style="width: 50px; height: 50px; border-radius: 8px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; color: #64748b; border: 1px solid rgba(255,255,255,0.08);"><i class="fa-solid fa-image" style="font-size: 18px;"></i></div>`;

    const statusBadge = n.isPublished
      ? `<span class="badge" style="background:rgba(16, 185, 129, 0.15); color:#34d399; border:1px solid rgba(16, 185, 129, 0.3); font-size:11px; padding:3px 8px; border-radius:6px;"><i class="fa-solid fa-check"></i> منتشرشده</span>`
      : `<span class="badge" style="background:rgba(245, 158, 11, 0.15); color:#fbbf24; border:1px solid rgba(245, 158, 11, 0.3); font-size:11px; padding:3px 8px; border-radius:6px;"><i class="fa-solid fa-clock"></i> پیش‌نویس</span>`;

    return `
      <tr>
        <td style="text-align:center;">${imageMarkup}</td>
        <td>
          <div style="font-weight:bold; color:white; font-size:13px; margin-bottom:3px;">${n.title || 'بدون عنوان'}</div>
          ${n.subtitle ? `<div style="font-size:11px; color:#94a3b8; line-height:1.4;">${n.subtitle}</div>` : ''}
        </td>
        <td style="text-align:center;">
          <span class="badge" style="background:${catStyle.bg}; color:${catStyle.text}; border:1px solid ${catStyle.border}; font-size:11px; padding:3px 8px; border-radius:6px; font-weight:bold;">
            ${n.category || 'عمومی'}
          </span>
        </td>
        <td>
          <div style="font-size:12px; color:#cbd5e1; display:flex; align-items:center; gap:5px;">
            <i class="fa-solid fa-user-pen" style="color:#38bdf8; font-size:11px;"></i>
            <span>${n.reporter || 'ستاد نپا'}</span>
          </div>
        </td>
        <td dir="ltr" style="text-align:right; font-size:11px; color:#94a3b8;">${pDate}</td>
        <td style="text-align:center;">${audienceBadge}</td>
        <td style="text-align:center;">${statusBadge}</td>
        <td style="text-align:center;">
          <div style="display:flex; justify-content:center; gap:6px;">
            <button type="button" class="btn-action" style="background:rgba(56, 189, 248, 0.15); border:1px solid rgba(56, 189, 248, 0.3); color:#38bdf8; padding:5px 8px; border-radius:6px; cursor:pointer;" onclick="window.editNews('${n.id}')" title="ویرایش خبر">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button type="button" class="btn-action" style="background:rgba(239, 68, 68, 0.15); border:1px solid rgba(239, 68, 68, 0.3); color:#f87171; padding:5px 8px; border-radius:6px; cursor:pointer;" onclick="window.deleteNews('${n.id}')" title="حذف خبر">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
};

window.openCreateNewsModal = function() {
  const form = document.getElementById('news-form');
  if (form) form.reset();

  const idEl = document.getElementById('news-id');
  if (idEl) idEl.value = '';

  const subEl = document.getElementById('news-subtitle');
  if (subEl) subEl.value = '';

  const preview = document.getElementById('news-image-preview');
  if (preview) {
    preview.style.display = 'none';
    preview.src = '';
  }
  
  // Set default datetime to current time
  const now = new Date();
  const iso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const dateEl = document.getElementById('news-publish-date');
  if (dateEl) dateEl.value = iso;
  
  const titleEl = document.getElementById('news-modal-title');
  if (titleEl) {
    titleEl.innerHTML = '<i class="fa-solid fa-newspaper" style="color: #38bdf8;"></i> افزودن خبر جدید جارچی';
  }
  
  const m = document.getElementById('news-modal');
  if (m) {
    m.style.display = 'flex';
    m.classList.remove('hidden');
  }
};

window.closeNewsModal = function() {
  const m = document.getElementById('news-modal');
  if (m) m.style.display = 'none';
};

window.editNews = async function(id) {
  try {
    let n = (window.cachedNewsList || []).find(x => x.id === id);
    if (!n) {
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
      const res = await fetch('/api/v1/admin/news', { headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) } });
      const news = await res.json();
      n = news.find(x => x.id === id);
    }
    if (!n) return;

    document.getElementById('news-id').value = n.id;
    document.getElementById('news-title').value = n.title || '';
    document.getElementById('news-subtitle').value = n.subtitle || '';
    document.getElementById('news-body').value = n.body || '';
    document.getElementById('news-category').value = n.category || 'اطلاعیه مهم';
    document.getElementById('news-reporter').value = n.reporter || 'ستاد آموزش نپا';
    document.getElementById('news-target').value = n.targetAudience || 'ALL';

    if (n.publishDate) {
      const d = new Date(n.publishDate);
      const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      document.getElementById('news-publish-date').value = iso;
    }

    const preview = document.getElementById('news-image-preview');
    if (n.imageUrl && preview) {
      preview.src = n.imageUrl;
      preview.style.display = 'block';
    } else if (preview) {
      preview.style.display = 'none';
    }

    const activeEl = document.getElementById('news-active');
    if (activeEl) activeEl.checked = n.isPublished !== false;

    const pushEl = document.getElementById('news-push');
    if (pushEl) pushEl.checked = false;

    const titleEl = document.getElementById('news-modal-title');
    if (titleEl) {
      titleEl.innerHTML = '<i class="fa-solid fa-pen" style="color: #38bdf8;"></i> ویرایش خبر جارچی';
    }

    const m = document.getElementById('news-modal');
    if (m) {
      m.style.display = 'flex';
      m.classList.remove('hidden');
    }
  } catch (e) {
    console.error('Edit news error:', e);
  }
};

window.saveNewsArticle = async function(e) {
  e.preventDefault();
  const id = document.getElementById('news-id')?.value;
  const title = document.getElementById('news-title')?.value;
  const audience = document.getElementById('news-target')?.value || 'ALL';
  
  const formData = new FormData();
  formData.append('title', title);
  formData.append('subtitle', document.getElementById('news-subtitle')?.value || '');
  formData.append('body', document.getElementById('news-body')?.value || '');
  formData.append('category', document.getElementById('news-category')?.value || 'اطلاعیه مهم');
  formData.append('reporter', document.getElementById('news-reporter')?.value || 'ستاد نپا');
  formData.append('targetAudience', audience);
  
  const pDate = document.getElementById('news-publish-date')?.value;
  if (pDate) formData.append('publishDate', new Date(pDate).toISOString());
  formData.append('isPublished', document.getElementById('news-active')?.checked ? 'true' : 'false');
  
  const fileInput = document.getElementById('news-file');
  if (fileInput && fileInput.files[0]) {
    formData.append('image', fileInput.files[0]);
  }
  
  const url = id ? `/api/v1/admin/news/${id}` : '/api/v1/admin/news';
  const method = id ? 'PUT' : 'POST';
  
  const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
  try {
    const res = await fetch(url, {
      method,
      headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: formData
    });
    
    if (res.ok) {
      window.closeNewsModal();
      await window.loadNewsTab();
      showToastSuccess('✅ خبر با موفقیت در تابلوی اعلانات جارچی ذخیره و منتشر شد!');
      
      if (document.getElementById('news-push')?.checked) {
        showToastSuccess('📢 نوتیفیکیشن خبر برای مخاطبان هدف ارسال گردید.');
      }
    } else {
      const err = await res.json();
      alert('خطا در ثبت خبر: ' + (err.error || 'خطای سرور'));
    }
  } catch(e) { 
    console.error('Save news error:', e);
    alert('خطا در برقراری ارتباط با سرور'); 
  }
};

window.previewNewsImage = function(event) {
  const file = event.target.files[0];
  const preview = document.getElementById('news-image-preview');
  if (file && preview) {
    const reader = new FileReader();
    reader.onload = function(e) {
      preview.src = e.target.result;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  } else if (preview) {
    preview.style.display = 'none';
  }
};

function showToastSuccess(message) {
  let toast = document.getElementById('nopa-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'nopa-toast';
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '20px';
    toast.style.backgroundColor = '#10b981';
    toast.style.color = 'white';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '8px';
    toast.style.zIndex = '1000000';
    toast.style.boxShadow = '0 4px 14px rgba(0,0,0,0.4)';
    toast.style.fontWeight = 'bold';
    toast.style.fontSize = '13px';
    toast.style.transition = 'opacity 0.3s ease';
    document.body.appendChild(toast);
  }
  toast.innerHTML = message;
  toast.style.opacity = '1';
  toast.style.display = 'block';
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.style.display = 'none', 300);
  }, 3500);
}

window.deleteNews = async function(id) {
  if (!confirm('آیا از حذف این خبر از تابلوی اعلانات جارچی اطمینان دارید؟')) return;
  const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
  try {
    const res = await fetch(`/api/v1/admin/news/${id}`, {
      method: 'DELETE',
      headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
    });
    if (res.ok) {
      showToastSuccess('✅ خبر با موفقیت حذف شد.');
      await window.loadNewsTab();
    } else {
      const d = await res.json();
      alert('خطا در حذف خبر: ' + (d.error || 'خطای سرور'));
    }
  } catch(e) { 
    console.error('Delete news error:', e);
    alert('خطا در ارتباط با سرور');
  }
};
// --- CARAVAN MANAGEMENT MODAL LOGIC ---
window.activeCaravanId = null;
window.allCaravansDataCache = []; // To hold all caravans for the transfer dropdown

window.openCaravanDetailDrawer = async function(caravanId) {
  try {
    const res = await fetch(`/api/v1/admin/caravans/${caravanId}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
    if (!res.ok) throw new Error('Failed to load caravan');
    const caravan = await res.json();

    document.getElementById('cd-title').textContent = `Caravan: ${caravan.name}`;
    document.getElementById('cd-mentor-name').textContent = caravan.mentor?.name || 'No mentor';
    document.getElementById('cd-wealth-zarik').textContent = caravan.assets?.zarik || 0;
    document.getElementById('cd-completed-stations').textContent = caravan.completedStations || 0;
    document.getElementById('cd-progress-text').textContent = `${caravan.overallProgress || 0}%`;

    const tbody = document.querySelector('#cd-roster-table tbody');
    tbody.innerHTML = '';

    if (caravan.membersList && caravan.membersList.length > 0) {
      caravan.membersList.forEach(member => {
        const isBlocked = member.blocked ? 'Blocked' : 'Active';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${member.name}</strong></td>
          <td>${member.phoneNumber}</td>
          <td style="color: #fbbf24;">${member.zarikBalance || 0}</td>
          <td>${member.completedStations || 0}</td>
          <td><span class="badge" style="background:${isBlocked === 'Active' ? '#10b981' : '#ef4444'};">${isBlocked}</span></td>
          <td>
            <button onclick="window.editMember('${member.id}')" style="margin-right: 5px;"><i class="fa-solid fa-edit"></i></button>
            <button onclick="window.toggleBlockMember('${member.id}', ${!member.blocked})" style="margin-right: 5px;"><i class="fa-solid ${member.blocked ? 'fa-unlock' : 'fa-ban'}"></i></button>
            <button onclick="window.removeFromCaravan('${caravanId}', '${member.id}')" style="color:red;"><i class="fa-solid fa-trash"></i></button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } else {
      tbody.innerHTML = '<tr><td colspan="6">No members found</td></tr>';
    }

    document.getElementById('caravan-detail-drawer').style.display = 'flex';
    window.currentCaravanId = caravanId;
  } catch (err) {
    console.error(err);
    alert('Error loading caravan');
  }
};

window.closeCaravanDetailDrawer = function() {
  document.getElementById('caravan-detail-drawer').style.display = 'none';
};

window.editMember = async function(userId) {
  try {
    const res = await fetch(`/api/v1/admin/users/${userId}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
    const user = await res.json();
    const newName = prompt('Enter new name:', user.name);
    if (newName && newName.trim() !== '' && newName !== user.name) {
      await fetch(`/api/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ ...user, name: newName.trim() })
      });
      alert('Member updated');
      if (window.currentCaravanId) window.openCaravanDetailDrawer(window.currentCaravanId);
    }
  } catch (err) {
    console.error(err);
    alert('Error updating member');
  }
};

window.toggleBlockMember = async function(userId, blockStatus) {
  if (!confirm(`Are you sure you want to ${blockStatus ? 'block' : 'unblock'} this user?`)) return;
  try {
    await fetch(`/api/v1/admin/users/${userId}/block`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ blocked: blockStatus })
    });
    alert(`User ${blockStatus ? 'blocked' : 'unblocked'}`);
    if (window.currentCaravanId) window.openCaravanDetailDrawer(window.currentCaravanId);
  } catch (err) {
    console.error(err);
    alert('Error changing user status');
  }
};

window.renderAllUsersNow = async function() {
  if (typeof loadUsers === 'function') {
    await loadUsers();
  }
};

window.loadUsersData = loadUsers;

window.removeFromCaravan = async function(caravanId, memberId) {
  if (!confirm('Remove this member from caravan?')) return;
  try {
    await fetch(`/api/v1/admin/caravans/${caravanId}/members/${memberId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    alert('Member removed');
    if (window.currentCaravanId) window.openCaravanDetailDrawer(window.currentCaravanId);
  } catch (err) {
    console.error(err);
    alert('Error removing member');
  }
};

window.openAddMemberModal = function() {
  const userId = prompt('Enter user ID to add:');
  if (!userId || !window.currentCaravanId) return;
  
  fetch(`/api/v1/admin/caravans/${window.currentCaravanId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
    body: JSON.stringify({ userId })
  }).then(async res => {
    if (res.ok) {
      alert('Member added');
      window.openCaravanDetailDrawer(window.currentCaravanId);
    } else {
      const data = await res.json();
      alert(data.error || 'Error adding member');
    }
  }).catch(err => {
    console.error(err);
    alert('Server error');
  });
};

// --- CARAVAN EDIT MODAL LOGIC ---
window.openCaravanEditModal = async function(caravanId) {
  window.activeCaravanId = caravanId;
  const modal = document.getElementById('caravan-edit-modal');
  if (modal) {
    modal.style.setProperty('display', 'flex', 'important');
    modal.style.setProperty('z-index', '999999', 'important');
  }
  await window.refreshCaravanEditData();
};

window.closeCaravanEditModal = function() {
  const modal = document.getElementById('caravan-edit-modal');
  if (modal) modal.style.display = 'none';
};

window.refreshCaravanEditData = async function() {
  if (!window.activeCaravanId) return;
  const token = localStorage.getItem('token');
  const res = await fetch('/api/v1/caravans', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json());
  const caravans = res.data || res || [];
  
  const caravan = caravans.find(c => String(c.id) === String(window.activeCaravanId));
  if (!caravan) return;

  document.getElementById('edit-caravan-name').value = caravan.title || caravan.name || '';
  document.getElementById('edit-caravan-capacity').value = caravan.capacityLimit || caravan.capacity || 25;
  const notesEl = document.getElementById('edit-caravan-notes');
  if(notesEl) notesEl.value = caravan.notes || caravan.adminNotes || '';
};

window.saveCaravanEdits = async function() {
  const name = document.getElementById('edit-caravan-name').value.trim();
  const capacity = document.getElementById('edit-caravan-capacity').value.trim();
  const notesEl = document.getElementById('edit-caravan-notes');
  const notes = notesEl ? notesEl.value.trim() : '';
  
  try {
    const res = await fetch('/api/v1/caravans/' + window.activeCaravanId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ name, title: name, capacityLimit: Number(capacity), notes, adminNotes: notes })
    });
    if (res.ok) {
      alert('تغییرات با موفقیت ذخیره شد.');
      window.closeCaravanEditModal();
      if(typeof window.loadCaravansTable === 'function') window.loadCaravansTable();
    } else {
      alert('خطا در ذخیره تغییرات');
    }
  } catch(e) { console.error(e); }
};

// --- STATUS / DELETE MODAL LOGIC ---
window.openCaravanStatusDialog = function(caravanId, caravanName) {
  window.activeCaravanId = caravanId;
  document.getElementById('status-caravan-name').innerText = caravanName || '';
  const modal = document.getElementById('caravan-status-modal');
  if (modal) {
    modal.style.setProperty('display', 'flex', 'important');
    modal.style.setProperty('z-index', '999999', 'important');
  }
};

window.closeCaravanStatusDialog = function() {
  const modal = document.getElementById('caravan-status-modal');
  if (modal) modal.style.display = 'none';
};

window.confirmSuspendCaravan = async function() {
  if(!confirm('آیا از تعلیق موقت این کاروان مطمئن هستید؟')) return;
  try {
    const res = await fetch('/api/v1/caravans/' + window.activeCaravanId + '/status', {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if(res.ok) {
      alert('وضعیت کاروان تغییر کرد.');
      window.closeCaravanStatusDialog();
      if(typeof window.loadCaravansTable === 'function') window.loadCaravansTable();
    }
  } catch(e) { console.error(e); }
};

window.confirmBlockCaravan = async function() {
  if(!confirm('آیا از مسدودسازی تمامی اعضای این کاروان مطمئن هستید؟')) return;
  try {
    const res = await fetch('/api/v1/caravans/' + window.activeCaravanId + '/block-members', {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if(res.ok) {
      alert('تمامی اعضا مسدود شدند.');
      window.closeCaravanStatusDialog();
    }
  } catch(e) { console.error(e); }
};

window.confirmDeleteCaravan = async function() {
  if(!confirm('آیا از حذف کامل این کاروان و خروج تمامی اعضا اطمینان دارید؟ این عمل غیرقابل بازگشت است!')) return;
  try {
    const res = await fetch('/api/v1/caravans/' + window.activeCaravanId, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if(res.ok) {
      alert('کاروان با موفقیت حذف شد.');
      window.closeCaravanStatusDialog();
      if(typeof window.loadCaravansTable === 'function') window.loadCaravansTable();
    }
  } catch(e) { console.error(e); }
};

// =========================================================================
// UNIVERSAL ROBUST API FETCHING & DOM TABLE INJECTION (v2.0.1)
// =========================================================================

async function fetchWithFallback(primaryUrl, fallbackUrl) {
  const token = localStorage.getItem('token') || localStorage.getItem('nopa_admin_token') || localStorage.getItem('adminToken') || '';
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    let res = await fetch(primaryUrl, { headers });
    if (!res.ok && (res.status === 401 || res.status === 404 || res.status === 403)) {
      console.warn(`[Fallback] ${primaryUrl} (${res.status}) -> trying ${fallbackUrl}`);
      res = await fetch(fallbackUrl, { headers });
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn(`[Fetch Error] ${primaryUrl}:`, err.message);
    try {
      if (fallbackUrl && fallbackUrl !== primaryUrl) {
        const res2 = await fetch(fallbackUrl, { headers });
        if (res2.ok) return await res2.json();
      }
    } catch (e) {
      console.error(`[Fallback Error] ${fallbackUrl}:`, e);
    }
    return null;
  }
}

// 1. User Directory Loader (#users-tbody)


// 2. LMS Stations Management Table Loader (#lms-directory-tbody / #stations-tbody)
window.loadLmsStationsData = async function() {
  if (typeof window.fetchLiveLmsStations === 'function') {
    await window.fetchLiveLmsStations();
  }
};

// 3. Mentors Table Loader (#mentors-tbody)
window.loadMentorsData = async function() {
  if (typeof window.loadMentors === 'function') {
    await window.loadMentors();
  }
};

// 4. Caravans Table Loader (#caravans-tbody)
window.loadCaravansData = async function() {
  if (typeof loadCaravansTab === 'function') {
    await loadCaravansTab();
  }
};

// 5. Automatic Event Binding On Load
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (window.loadUsersData) window.loadUsersData();
    if (window.loadLmsStationsData) window.loadLmsStationsData();
    if (window.loadMentorsData) window.loadMentorsData();
    if (window.loadCaravansData) window.loadCaravansData();
  }, 300);
});




