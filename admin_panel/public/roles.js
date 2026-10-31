// Role labels + permission-based UI gating for the admin panel. Loaded before app.js.
// Levels: super admin (stored 'admin')  >  admin (stored 'SUB_ADMIN')  >  mentor  >  student.
//
// What a person may open comes from the server (GET /api/v1/admin/me/access), which reads the
// permission matrix the super admin edits in "نقش‌ها و دسترسی‌ها". This file only hides what the
// person cannot use; the real enforcement is on the server (middleware/adminAccess.ts), so editing
// this file in the browser grants nothing.
(function () {
  var LABELS = { admin: 'سوپر ادمین', sub_admin: 'ادمین', super_mentor: 'سرراهبر', mentor: 'راهبر', student: 'دانش‌آموز' };
  var access = null; // { role, isSuper, permissions: [...], tabs: [...] | null }

  function norm(role) { return String(role || '').toLowerCase(); }

  var R = {
    norm: norm,
    label: function (role) { return LABELS[norm(role)] || 'دانش‌آموز'; },
    isSuper: function (role) { return norm(role) === 'admin'; },
    isAdmin: function (role) { return norm(role) === 'sub_admin'; },
    isStaffAdmin: function (role) { var r = norm(role); return r === 'admin' || r === 'sub_admin'; },

    setAccess: function (a) { access = a || null; },
    getAccess: function () { return access; },
    has: function (key) {
      if (!access) return true; // not loaded yet (pre-login): never hide on a guess
      return access.isSuper || (access.permissions || []).indexOf(key) !== -1;
    },
    // Tabs the signed-in person may open; null = no restriction (super admin, or access not loaded yet)
    allowedTabs: function () { return access && !access.isSuper ? (access.tabs || []) : null; },
    canOpenTab: function (role, tabId) {
      var list = R.allowedTabs();
      return !list || list.indexOf(tabId) !== -1;
    },
    defaultTab: function () {
      var list = R.allowedTabs();
      if (!list) return 'users-tab';
      var first = null;
      document.querySelectorAll('.menu-item[data-tab]').forEach(function (li) {
        if (!first && list.indexOf(li.getAttribute('data-tab')) !== -1) first = li.getAttribute('data-tab');
      });
      return first || list[0] || 'users-tab';
    },
    // Hide sidebar entries (and empty modules) the person cannot open.
    applyMenu: function (role) {
      var list = R.allowedTabs();
      document.body.classList.toggle('role-sub-admin', norm(role) === 'sub_admin');
      document.body.classList.toggle('role-super-admin', norm(role) === 'admin');
      document.querySelectorAll('.menu-item[data-tab]').forEach(function (li) {
        li.style.display = (!list || list.indexOf(li.getAttribute('data-tab')) !== -1) ? '' : 'none';
      });
      document.querySelectorAll('.accordion-item').forEach(function (acc) {
        var any = false;
        acc.querySelectorAll('.menu-item[data-tab]').forEach(function (li) { if (li.style.display !== 'none') any = true; });
        acc.style.display = any ? '' : 'none';
      });
      // Anything marked data-super-only is for the super admin; data-perm="key" needs that permission
      document.querySelectorAll('[data-super-only]').forEach(function (el) {
        el.style.display = norm(role) === 'admin' ? '' : 'none';
      });
      document.querySelectorAll('[data-perm]').forEach(function (el) {
        el.style.display = R.has(el.getAttribute('data-perm')) ? '' : 'none';
      });
    }
  };

  window.NopaRoles = R;
})();