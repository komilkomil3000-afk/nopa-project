// Roles & access: RBAC matrix, role labels, panel permissions for the top nav, sub-admin grants.
// Split out of the former app.js (Phase 7). Classic script: shares globals with the other modules;
// load order is set in index.html.

// 3. RBAC MATRIX
async function loadRolePermissions() {
  try {
    const res = await request('/api/v1/admin/roles');
    const roles = await res.json();
    if (typeof renderSubAdminAccess === 'function') renderSubAdminAccess(roles);
    loadRoles(); // full role matrix (#roles-table)

    roles.forEach(role => {
      const phoneInput = document.querySelector(`.role-perm-toggle[data-role="${esc(role.roleName)}"][data-perm="maskPhoneNumbers"]`);
      const zarikInput = document.querySelector(`.role-perm-toggle[data-role="${esc(role.roleName)}"][data-perm="restrictZarik"]`);
      const deleteInput = document.querySelector(`.role-perm-toggle[data-role="${esc(role.roleName)}"][data-perm="lockUserDeletions"]`);

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

// ===============================
// MODULE E: SYSTEM / RBAC LOGIC
// ===============================

// 1. Roles (Tab E1)
async function loadRoles() {
  try {
    const res = await request('/api/v1/admin/roles');
    const roles = await res.json();
    const tbody = document.querySelector('#roles-table tbody');
    if (!tbody) return;
    NopaTable.render(tbody, roles, r => `
      <tr>
        <td>${esc(r.roleName)}</td>
        <td><input type="checkbox" ${r.maskPhoneNumbers ? 'checked' : ''} data-change="updateRole" data-change-args="${esc(JSON.stringify([String(r.roleName), "maskPhoneNumbers", "$checked"]))}"></td>
        <td><input type="checkbox" ${r.restrictZarik ? 'checked' : ''} data-change="updateRole" data-change-args="${esc(JSON.stringify([String(r.roleName), "restrictZarik", "$checked"]))}"></td>
        <td><input type="checkbox" ${r.lockUserDeletions ? 'checked' : ''} data-change="updateRole" data-change-args="${esc(JSON.stringify([String(r.roleName), "lockUserDeletions", "$checked"]))}"></td>
        <td><input type="checkbox" ${r.manageContent ? 'checked' : ''} data-change="updateRole" data-change-args="${esc(JSON.stringify([String(r.roleName), "manageContent", "$checked"]))}"></td>
        <td><input type="checkbox" ${r.canSendMessage ? 'checked' : ''} data-change="updateRole" data-change-args="${esc(JSON.stringify([String(r.roleName), "canSendMessage", "$checked"]))}"></td>
        <td><input type="checkbox" ${r.canJoinClasses ? 'checked' : ''} data-change="updateRole" data-change-args="${esc(JSON.stringify([String(r.roleName), "canJoinClasses", "$checked"]))}"></td>
        <td><input type="checkbox" ${r.canScoreAndEvaluate ? 'checked' : ''} data-change="updateRole" data-change-args="${esc(JSON.stringify([String(r.roleName), "canScoreAndEvaluate", "$checked"]))}"></td>
        <td><input type="checkbox" ${r.canConvertAssets ? 'checked' : ''} data-change="updateRole" data-change-args="${esc(JSON.stringify([String(r.roleName), "canConvertAssets", "$checked"]))}"></td>
        <td><input type="checkbox" ${r.canCreateChallenges ? 'checked' : ''} data-change="updateRole" data-change-args="${esc(JSON.stringify([String(r.roleName), "canCreateChallenges", "$checked"]))}"></td>
        <td><input type="checkbox" ${r.canViewGlobalAnalytics ? 'checked' : ''} data-change="updateRole" data-change-args="${esc(JSON.stringify([String(r.roleName), "canViewGlobalAnalytics", "$checked"]))}"></td>
        <td><input type="checkbox" ${r.canManageUsers ? 'checked' : ''} data-change="updateRole" data-change-args="${esc(JSON.stringify([String(r.roleName), "canManageUsers", "$checked"]))}"></td>
        <td>-</td>
      </tr>
    `, { empty: 'نقشی تعریف نشده است', emptyIcon: 'fa-solid fa-user-lock' });
  } catch(e) {
    console.error(e);
  }
}

window.updateRole = async function(roleName, field, value) {
  try {
    const data = { roleName };
    data[field] = value;
    await request('/api/v1/admin/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch(e) {
    console.error(e);
    showToast('خطا در بروزرسانی نقش', 'error');
  }
}

// =========================================================================
// FOUR USER LEVELS: super admin (admin), admin (sub_admin), mentor, student
// =========================================================================
function roleLabel(role) {
  const r = String(role || '').toLowerCase().replace(/[\s-]/g, '_');
  if (r === 'admin') return 'سوپر ادمین';
  if (r === 'sub_admin') return 'ادمین (مدیر محتوایی)';
  if (r === 'mentor' || r === 'super_mentor' || r === 'supermentor') return 'مربی';
  return 'دانش‌آموز';
}
window.roleLabel = roleLabel;

const PANEL_SECTION_LABELS = {
  users: 'کاربران، مخاطبان و سطوح',
  rewards: 'کیف پول، زریک و دارایی‌ها',
  mentors: 'راهبران و مدارک',
  instructors: 'بانک اساتید',
  caravans: 'کاروان‌ها',
  lms: 'منزلگاه‌ها، کلاس‌ها و آزمون‌ها',
  challenges: 'چالش‌ها و تکالیف',
  support: 'تیکت‌ها، پیام‌ها و چت',
  content: 'جارچی، بنر، رسانه و فرم‌ها',
  notifications: 'اعلان‌ها و پیام‌رسانی',
  analytics: 'آمار و لیگ'
};

// Tab -> panel section lives in the tab registry (js/core/router.js); tabs without a section are super-admin only.

function isSuperAdminUser() {
  return String((currentUser && currentUser.role) || '').toLowerCase() === 'admin';
}

// Builds the top navigation for the signed-in user: a sub admin only sees the sections a super
// admin granted (the server enforces it as well); everyone else sees every tab.
async function applyPanelPermissions() {
  try {
    const role = String((currentUser && currentUser.role) || '').toLowerCase().replace(/[\s-]/g, '_');
    if (role !== 'sub_admin') {
      NopaNav.applyAccess({ all: true });
      return;
    }
    // Until the grants arrive a sub admin sees nothing beyond the dashboard shell
    NopaNav.applyAccess({ all: false, sections: {}, pending: true });
    const res = await request('/api/v1/admin/panel/me');
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      showToast(d.error || 'دسترسی شما به پنل فعال نشده است', 'error');
      NopaNav.applyAccess({ all: true });
      return;
    }
    const me = await res.json();
    NopaNav.applyAccess({ all: false, sections: me.sections || {} });
  } catch (e) {
    console.error('applyPanelPermissions error:', e);
  }
}
window.applyPanelPermissions = applyPanelPermissions;

// ---- user modal: role options and panel access (super admin only) ----
function setupUserModalAccessControls(role, panelAccess) {
  const superAdmin = isSuperAdminUser();
  const roleSelect = document.getElementById('modal-user-role');
  if (roleSelect) {
    Array.from(roleSelect.options).forEach(opt => {
      // Only a super admin may hand out admin levels
      opt.hidden = !superAdmin && (opt.value === 'admin' || opt.value === 'sub_admin');
    });
    const refresh = () => {
      const group = document.getElementById('panel-access-group');
      const r = roleSelect.value;
      if (group) group.style.display = (superAdmin && (r === 'sub_admin' || r === 'mentor')) ? 'block' : 'none';
    };
    roleSelect.addEventListener('change', refresh);
    refresh();
  }
  const sel = document.getElementById('modal-user-panel-access');
  if (sel) sel.value = panelAccess === true ? 'true' : panelAccess === false ? 'false' : 'default';
}

async function saveUserPanelAccess(userId) {
  const group = document.getElementById('panel-access-group');
  if (!userId || !isSuperAdminUser() || !group || group.style.display === 'none') return;
  const v = document.getElementById('modal-user-panel-access').value;
  const panelAccess = v === 'true' ? true : v === 'false' ? false : null;
  try {
    const res = await request('/api/v1/admin/users/' + userId + '/panel-access', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ panelAccess })
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      showToast(d.error || 'خطا در ذخیره دسترسی پنل', 'error');
    }
  } catch (e) {
    console.error('saveUserPanelAccess error:', e);
  }
}

// ---- roles tab: section grants for the sub admin role (super admin only) ----
function renderSubAdminAccess(roles) {
  const box = document.getElementById('sub-admin-sections');
  const card = document.getElementById('sub-admin-access-card');
  if (!box || !card) return;
  card.style.display = isSuperAdminUser() ? '' : 'none';
  const row = (roles || []).find(r => r.roleName === 'sub_admin') || {};
  let grants = {};
  try { grants = JSON.parse(row.permissionsJson || '{}') || {}; } catch (_) { grants = {}; }
  document.getElementById('sub-admin-can-login').checked = row.canLoginPanel === true;
  box.innerHTML = Object.keys(PANEL_SECTION_LABELS).map(key => `
    <div class="u-flex u-justify-between u-items-center u-gap-8 u-bg-fg-4 u-p-8-10 u-r-8">
      <span class="u-fs-12_5">${PANEL_SECTION_LABELS[key]}</span>
      <select class="select-ctrl sub-admin-section u-minw-120" data-section="${key}">
        <option value="" ${!grants[key] ? 'selected' : ''}>بدون دسترسی</option>
        <option value="view" ${grants[key] === 'view' ? 'selected' : ''}>فقط مشاهده</option>
        <option value="edit" ${grants[key] === 'edit' ? 'selected' : ''}>مشاهده و ویرایش</option>
      </select>
    </div>`).join('');
}

async function saveSubAdminAccess() {
  const permissions = {};
  document.querySelectorAll('.sub-admin-section').forEach(sel => {
    if (sel.value) permissions[sel.dataset.section] = sel.value;
  });
  try {
    const res = await request('/api/v1/admin/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roleName: 'sub_admin',
        canLoginPanel: document.getElementById('sub-admin-can-login').checked,
        permissionsJson: permissions
      })
    });
    const d = await res.json().catch(() => ({}));
    showToast(res.ok ? 'دسترسی‌های ادمین ذخیره شد' : (d.error || 'خطا در ذخیره دسترسی‌ها'), res.ok ? 'success' : 'error');
  } catch (e) {
    console.error('saveSubAdminAccess error:', e);
  }
}
window.saveSubAdminAccess = saveSubAdminAccess;
