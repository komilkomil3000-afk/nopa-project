// Shared panel state (let globals used by every module), app start-up, auth gate
// (showLanding / showLogin / showDashboard) and the static event wiring (setupEventListeners).
// Split out of the former app.js (Phase 7). Classic script: shares globals with the other modules;
// load order is set in index.html.

// State Management (the session token is read live via window.token / NopaAuth, see auth.js)
let currentUser = NopaAuth.getUser();
let activeTab = 'users-tab';

// Pagination and filters state
let usersPage = 1;
let usersTotal = 0;
let userSearchVal = '';
let filterRoleVal = '';
let filterCaravanVal = '';
let filterLevelVal = '';
let filterStartDateVal = '';
let filterEndDateVal = '';

let caravansList = [];
let allUsersList = []; // Used for Zarik target selection dropdowns

// Charts references
let wealthChart = null;
let velocityChart = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  const token = NopaAuth.getToken();

  const form = document.getElementById('admin-login-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const phoneInput = document.getElementById('login-phone') || form.querySelector('input[type="text"]');
      const passInput = document.getElementById('login-password') || form.querySelector('input[type="password"]');

      const phoneNumber = phoneInput ? phoneInput.value.trim() : '';
      const password = passInput ? passInput.value.trim() : '';
      if (!phoneNumber || !password) {
        showToast('شماره همراه و گذرواژه را وارد کنید', 'error');
        return;
      }

      const submitBtn = document.getElementById('admin-login-btn');
      if (submitBtn) submitBtn.disabled = true;
      try {
        const res = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber, password })
        });
        const data = await res.json();
        if (res.ok && data.token) {
          NopaAuth.setSession(data.token, data.user || { role: 'admin', identityVerified: true });
          currentUser = NopaAuth.getUser();
          if (passInput) passInput.value = '';
          showDashboard();
        } else {
          showToast(data.error || 'اطلاعات ورود اشتباه است', 'error');
        }
      } catch (err) {
        console.error('Login error:', err);
        showToast('خطا در اتصال به سرور بکاند', 'error');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  if (token) showDashboard();
  else showLanding();
  setupEventListeners();
});

// Signed-out state: the public landing page (#landing-view). The panel stays hidden.
function showLanding() {
  document.documentElement.setAttribute('data-session', 'out');
  const layout = document.getElementById('app-layout');
  if (layout) layout.style.display = 'none';
  document.body.classList.remove('nav-open');
  if (window.NopaLanding) NopaLanding.onShow();
}

// Login is needed (expired session / 401): landing page with the login modal open on top.
function showLogin() {
  showLanding();
  if (window.NopaLanding) NopaLanding.openLogin();
}

function showDashboard() {
  document.documentElement.setAttribute('data-session', 'in');
  const chatOnly = window.isChannelManagerUser();
  if (!chatOnly && typeof window.loadAssetNames === 'function') window.loadAssetNames();
  const modal = document.getElementById('login-modal');
  if (modal) modal.style.display = 'none';
  const layout = document.getElementById('app-layout');
  if (layout) layout.style.display = 'block';
  window.scrollTo({ top: 0 });
  
  // Current user in the header (js/layout/topnav.js)
  NopaNav.setUser(currentUser);

  if (typeof applyPanelPermissions === 'function') applyPanelPermissions();

  // Route according to current URL hash
  if (typeof handleHashRouting === 'function') {
    handleHashRouting();
  } else if (typeof switchTab === 'function') {
    switchTab(NopaRouter.DEFAULT_TAB);
  }

  if (chatOnly) return;

  // Load initial data
  if (typeof window.loadCaravansData === 'function') window.loadCaravansData();
  if (typeof window.loadUsersData === 'function') window.loadUsersData();
  if (typeof window.loadAllUsersDropdown === 'function') window.loadAllUsersDropdown();
  if (typeof window.loadMentorsData === 'function') window.loadMentorsData();
  if (typeof window.loadLmsStationsData === 'function') {
    window.loadLmsStationsData();
  }
  // Instructor list feeds the LMS instructor pickers, so load it up front
  if (typeof window.fetchInstructorsList === 'function') window.fetchInstructorsList();
}

function setupEventListeners() {
  // Logout Ctrl
  document.getElementById('btn-logout-ctrl').addEventListener('click', async () => {
    // Revoke the server-side session first; otherwise the token stays valid until it expires
    try {
      const t = NopaAuth.getToken();
      if (t) {
        await fetch('/api/v1/auth/logout', { method: 'POST', headers: { 'Authorization': `Bearer ${t}` } });
      }
    } catch (_) { /* offline: still clear the local copy */ }
    NopaAuth.clear();
    window.location.reload();
  });

  // Tab switching is handled by the top navigation (js/layout/topnav.js)

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

  // Collapsible Date Filter Dropdown & Listeners
  const usersDateFilterBox = document.getElementById('users-date-filter-box');
  const usersDateFilterTrigger = document.getElementById('users-date-filter-trigger');
  const usersDateFilterBadge = document.getElementById('users-date-filter-badge');
  const userStartDateInput = document.getElementById('filter-user-start-date');
  const userEndDateInput = document.getElementById('filter-user-end-date');
  const clearUserDateBtn = document.getElementById('btn-clear-user-date-filter');

  function updateUserDateFilterBadge() {
    const s = userStartDateInput ? userStartDateInput.value : '';
    const e = userEndDateInput ? userEndDateInput.value : '';

    if (usersDateFilterBadge && usersDateFilterTrigger) {
      if (s && e) {
        usersDateFilterBadge.textContent = `${s} تا ${e}`;
        usersDateFilterBadge.style.display = 'inline-block';
        usersDateFilterTrigger.classList.add('active-filtered');
      } else if (s) {
        usersDateFilterBadge.textContent = `از ${s}`;
        usersDateFilterBadge.style.display = 'inline-block';
        usersDateFilterTrigger.classList.add('active-filtered');
      } else if (e) {
        usersDateFilterBadge.textContent = `تا ${e}`;
        usersDateFilterBadge.style.display = 'inline-block';
        usersDateFilterTrigger.classList.add('active-filtered');
      } else {
        usersDateFilterBadge.textContent = '';
        usersDateFilterBadge.style.display = 'none';
        usersDateFilterTrigger.classList.remove('active-filtered');
      }
    }
  }

  if (usersDateFilterTrigger && usersDateFilterBox) {
    usersDateFilterTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      usersDateFilterBox.classList.toggle('open');
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!usersDateFilterBox.contains(e.target)) {
        usersDateFilterBox.classList.remove('open');
      }
    });

    // Prevent panel clicks from bubbling up to close it
    const panel = document.getElementById('users-date-filter-panel');
    if (panel) {
      panel.addEventListener('click', (e) => e.stopPropagation());
    }
  }

  if (userStartDateInput) {
    userStartDateInput.addEventListener('change', (e) => {
      filterStartDateVal = e.target.value;
      updateUserDateFilterBadge();
      usersPage = 1;
      loadUsers();
    });
  }

  if (userEndDateInput) {
    userEndDateInput.addEventListener('change', (e) => {
      filterEndDateVal = e.target.value;
      updateUserDateFilterBadge();
      usersPage = 1;
      loadUsers();
    });
  }

  if (clearUserDateBtn) {
    clearUserDateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (userStartDateInput) userStartDateInput.value = '';
      if (userEndDateInput) userEndDateInput.value = '';
      filterStartDateVal = '';
      filterEndDateVal = '';
      updateUserDateFilterBadge();
      usersPage = 1;
      loadUsers();
    });
  }

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

  // The full report dialog (window.closeUserDetailDrawer, js/features/users.js) also closes with Escape

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.closeUserDetailDrawer();
    }
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

  // RBAC switches, blacklist and session revoke live in js/features/access.js (data-change / data-submit)

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
    showToast(res.ok ? data.message : data.error, res.ok ? 'success' : 'error');
    if (res.ok) { e.target.reset(); if (typeof loadNotificationLogs === 'function') loadNotificationLogs(); }
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
    showToast(res.ok ? data.message : data.error, res.ok ? 'success' : 'error');
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

// Caravan Drawer
