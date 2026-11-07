// Roles & access: the roles-and-security tab (bento of the roles, one role's page, blacklist, session revoke),
// role labels, panel permissions for the top nav, sub-admin grants.
// Split out of the former app.js (Phase 7). Classic script: shares globals with the other modules;
// load order is set in index.html. Styles: css/stations.css (.lst-*, .lsv-*, .crv-*, .sec-*); the switches are
// .chs-check / .chs-switch from css/chat.css. Helpers crvAvatar / crvFa / crvArgs / crvInitial / crvFadeOut come
// from js/features/caravans.js and mntFitNotch from js/features/mentors.js (both load later, used only at runtime).

window.secRoles = [];
window.secBlacklist = null;
window.secActiveRole = null;
window.secRenderedRole = null;

// Flags of a RolePermission row, in two groups: restrictions on data and abilities
const SEC_LIMITS = [
  ['maskPhoneNumbers', 'مخفی‌سازی شماره موبایل', 'شماره همسفران به صورت ستاره‌دار نمایش داده می‌شود'],
  ['restrictZarik', 'محدودیت تراکنش زریک', 'امکان واریز و کسر زریک گرفته می‌شود'],
  ['lockUserDeletions', 'قفل حذف کاربران', 'حذف کاربر برای این نقش ممکن نیست'],
];
// What each role can do. Only the sub admin's part is editable (its panel sections, «تنظیم بخش‌ها» on its page);
// the rest is fixed in the server (middleware/adminAccess.ts). The old RolePermission switches (manageContent,
// canCreateChallenges...) were never checked anywhere, so they are no longer shown.
const SEC_FIXED_ABILITIES = {
  channel_manager: [['مدیریت چت، کانال‌ها و گروه‌ها', 'edit'], ['جزئیات در «تنظیمات چت»', 'view']],
  support: [['پاسخ به پرونده‌های پشتیبانی در چت', 'edit'], ['کمک به کاروان‌ها (یکی‌یکی)', 'edit']],
  mentor: [['کاروان‌های خودش: تکلیف، چالش، پیام و بررسی آثار', 'edit'], ['مشاهده‌ی کاربران، کلاس‌ها و آمار', 'view']],
  student: [['فقط اپلیکیشن (بدون پنل)', 'view']],
};
// The roles a user can have (utils/roles.ts); legacy rows (content_manager, caravan_supervisor, Sub-Admin...) are folded in
const SEC_ROLE_ORDER = ['admin', 'sub_admin', 'channel_manager', 'support', 'mentor', 'student'];
const SEC_ROLE_ALIAS = { super_mentor: 'mentor', supermentor: 'mentor', content_manager: 'sub_admin', subadmin: 'sub_admin' };

function secKey(name) { return String(name || '').toLowerCase().replace(/[\s-]/g, '_'); }
function secIsSuper(r) { return secKey(r.roleName) === 'admin'; }
function secFind(name) { return (window.secRoles || []).find(r => r.roleName === name) || null; }
function secRoleLabel(name) {
  const k = secKey(name);
  const labels = {
    admin: 'سوپر ادمین', sub_admin: 'ادمین (مدیر محتوایی)', channel_manager: 'مسئول کانال و گروه‌ها', support: 'پشتیبانی',
    super_mentor: 'سوپر راهبر', supermentor: 'سوپر راهبر', mentor: 'راهبر', student: 'نوجوان',
    caravan_supervisor: 'راهبر کاروان', content_manager: 'مدیر محتوا',
  };
  return labels[k] || String(name || '');
}
function secRoleIcon(name) {
  const k = secKey(name);
  if (k === 'admin') return 'fa-crown';
  if (k === 'sub_admin' || k === 'content_manager') return 'fa-user-gear';
  if (k === 'channel_manager') return 'fa-comments';
  if (k === 'support') return 'fa-headset';
  if (k.includes('mentor') || k.includes('supervisor')) return 'fa-user-tie';
  if (k === 'student') return 'fa-user-graduate';
  return 'fa-user-lock';
}
// Super admin always has everything, whatever its row says
function secFlag(r, field) {
  if (secIsSuper(r)) return !SEC_LIMITS.some(l => l[0] === field);
  return r[field] === true;
}
// [[title, 'view' | 'edit'], ...] of a role
function secAbilities(r) {
  const k = secKey(r.roleName);
  if (k === 'admin') return Object.values(PANEL_SECTION_LABELS).map(t => [t, 'edit']);
  if (k === 'sub_admin') {
    const grants = secGrantsOf(r);
    return Object.keys(PANEL_SECTION_LABELS).filter(key => grants[key]).map(key => [PANEL_SECTION_LABELS[key], grants[key]]);
  }
  return SEC_FIXED_ABILITIES[k] || [];
}
function secCounts(r) {
  return {
    caps: secAbilities(r).length,
    limits: SEC_LIMITS.filter(l => secFlag(r, l[0])).length,
  };
}
function secGrantsOf(r) {
  try { return JSON.parse((r && r.permissionsJson) || '{}') || {}; } catch (_) { return {}; }
}
function secChip(r) {
  if (secIsSuper(r)) return '<span class="lst-chip lst-chip-active"><i class="fa-solid fa-crown"></i> دسترسی کامل</span>';
  const { limits } = secCounts(r);
  return limits
    ? `<span class="lst-chip lst-chip-scheduled"><i class="fa-solid fa-lock"></i> ${crvFa(limits)} محدودیت</span>`
    : '<span class="lst-chip lst-chip-locked"><i class="fa-solid fa-lock-open"></i> بدون محدودیت</span>';
}

// ==================== LOADER ====================
async function loadRolePermissions() {
  window.secSetLoading(true);
  try {
    const [res, bl, rel] = await Promise.all([
      request('/api/v1/admin/roles'),
      request('/api/v1/admin/security/blacklist').catch(() => null),
      request('/api/v1/admin/app-release', { silent: true }).catch(() => null),
    ]);
    window.secRelease = rel && rel.ok ? await rel.json().catch(() => null) : (window.secRelease || null);
    if (!res.ok) throw new Error('خطا در دریافت نقش‌ها');
    const roles = await res.json();
    // One card per real role: the row named exactly like the role wins; legacy spellings and old roles nobody can have
    // any more are not listed (they only made a second «ادمین» card). Every real role is listed even without a row.
    const rows = Array.isArray(roles) ? roles : [];
    window.secRoles = SEC_ROLE_ORDER.map(name =>
      rows.find(r => r.roleName === name)
      || rows.find(r => (SEC_ROLE_ALIAS[secKey(r.roleName)] || secKey(r.roleName)) === name && secKey(r.roleName) === name)
      || { roleName: name });
    window.secBlacklist = bl && bl.ok ? await bl.json().catch(() => []) : (window.secBlacklist || []);
    window.secSetLoading(false);
    window.filterSecRoles();
    if (window.secActiveRole) {
      if (secFind(window.secActiveRole)) { window.secRenderedRole = null; window.loadSecRolePage(); }
      else window.closeSecRoleView();
    }
  } catch (err) {
    console.error('loadRolePermissions error:', err);
    window.secSetLoading(false);
    const grid = document.getElementById('sec-bento-list');
    if (grid) grid.innerHTML = `<div class="lst-empty"><i class="fa-solid fa-triangle-exclamation lst-warn"></i> ${esc(err.message)}</div>`;
  }
}
window.loadRolePermissions = loadRolePermissions;

// ==================== OVERVIEW (BENTO) ====================
window.filterSecRoles = function() {
  const overview = document.getElementById('sec-overview-view');
  if (window.NopaFlip && overview) window.NopaFlip.render(overview, secDrawBento); else secDrawBento();
};

function secCard(r) {
  const { caps, limits } = secCounts(r);
  const total = Object.keys(PANEL_SECTION_LABELS).length;
  const pct = Math.round((Math.min(caps, total) / total) * 100);
  const label = secRoleLabel(r.roleName);
  return `
    <button type="button" class="crv-card" data-anim-key="sr:${esc(r.roleName)}" data-click="openSecRoleView" data-click-args="${crvArgs(r.roleName)}" title="دسترسی‌های ${esc(label)}">
      <span class="crv-card-top">
        <span class="crv-card-cover sec-cover"><i class="fa-solid ${secRoleIcon(r.roleName)}"></i></span>
        <span class="crv-card-name"><strong>${esc(label)}</strong>${secChip(r)}</span>
      </span>
      <span class="crv-card-mentor"><i class="fa-solid fa-tag"></i><span dir="ltr">${esc(r.roleName)}</span></span>
      <span class="crv-card-cap"><span>${secKey(r.roleName) === 'sub_admin' ? 'بخش‌های مجاز' : 'توانایی‌ها'}</span><strong>${secKey(r.roleName) === 'sub_admin' || secIsSuper(r) ? `${crvFa(caps)} / ${crvFa(total)}` : crvFa(caps)}</strong></span>
      ${secIsSuper(r) || secKey(r.roleName) === 'sub_admin' ? `<span class="lst-bar"><span class="${pct >= 80 ? 'lst-bar-scheduled' : 'lst-bar-active'}" data-style="width:${pct}%"></span></span>` : ''}
      <span class="crv-card-foot">
        <span class="crv-card-nums">
          <span class="u-c-accent-text"><i class="fa-solid fa-lock"></i> ${crvFa(limits)}</span>
          <span class="${secIsSuper(r) || r.canLoginPanel ? 'u-c-success-text' : 'u-c-text-muted'}"><i class="fa-solid fa-right-to-bracket"></i> ${secIsSuper(r) || r.canLoginPanel ? 'ورود به پنل' : 'بدون پنل'}</span>
        </span>
      </span>
    </button>`;
}

function secDrawBento() {
  const all = window.secRoles || [];
  const q = (document.getElementById('sec-search')?.value || '').trim().toLowerCase();
  const list = all.filter(r => !q || [r.roleName, secRoleLabel(r.roleName)].some(v => String(v || '').toLowerCase().includes(q)));

  const badge = document.getElementById('sec-count-badge');
  if (badge) badge.textContent = q ? `نمایش ${crvFa(list.length)} از ${crvFa(all.length)}` : 'برای دیدن و تغییر دسترسی‌های هر نقش بزنید';

  const grid = document.getElementById('sec-bento-list');
  if (grid) {
    grid.innerHTML = list.length ? list.map(secCard).join('') : '<div class="lst-empty" data-anim-key="sr-empty">نقشی با این نام یافت نشد.</div>';
    grid.setAttribute('aria-busy', 'false');
  }

  const bl = window.secBlacklist || [];
  const setStat = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setStat('sec-stat-roles', crvFa(all.length));
  setStat('sec-stat-panel', crvFa(all.filter(r => secIsSuper(r) || r.canLoginPanel).length));
  setStat('sec-stat-ip', crvFa(bl.filter(b => b.type === 'ip').length));
  setStat('sec-stat-phone', crvFa(bl.filter(b => b.type !== 'ip').length));

  // Sub-admin grants summary (super admin only)
  const tile = document.getElementById('sec-grants-tile');
  if (tile) tile.style.display = isSuperAdminUser() ? '' : 'none';
  const grantsBox = document.getElementById('sec-bento-grants');
  if (grantsBox) {
    const sub = all.find(r => secKey(r.roleName) === 'sub_admin') || {};
    const grants = secGrantsOf(sub);
    const keys = Object.keys(PANEL_SECTION_LABELS);
    const edit = keys.filter(k => grants[k] === 'edit').length;
    const view = keys.filter(k => grants[k] === 'view').length;
    const none = keys.length - edit - view;
    const w = n => Math.round((n / keys.length) * 100);
    grantsBox.innerHTML = `
      <div class="lst-bar"><span class="lst-bar-active" data-style="width:${w(edit)}%"></span><span class="lst-bar-scheduled" data-style="width:${w(view)}%"></span><span class="lst-bar-locked" data-style="width:${w(none)}%"></span></div>
      <div class="lst-legend">
        <div class="lst-legend-row"><span><span class="lst-dot lst-dot-active"></span>مشاهده و ویرایش</span><strong>${crvFa(edit)}</strong></div>
        <div class="lst-legend-row"><span><span class="lst-dot lst-dot-scheduled"></span>فقط مشاهده</span><strong>${crvFa(view)}</strong></div>
        <div class="lst-legend-row"><span><span class="lst-dot lst-dot-locked"></span>بدون دسترسی</span><strong>${crvFa(none)}</strong></div>
      </div>
      <button type="button" class="lst-quick-btn sec-grants-open" data-click="openSecRoleView" data-click-args="${crvArgs(sub.roleName || 'sub_admin')}"><i class="fa-solid fa-sliders"></i> تنظیم بخش‌ها</button>`;
  }

  secDrawRelease();
  secDrawLmsRules();

  const blBox = document.getElementById('sec-bento-blacklist');
  if (blBox) {
    const rows = bl.slice(0, 12).map(b => `
      <li class="lst-list-item sec-bl-row" data-anim-key="bl:${esc(b.value)}">
        <span class="lst-avatar sec-bl-icon${b.type === 'ip' ? '' : ' is-phone'}"><i class="fa-solid ${b.type === 'ip' ? 'fa-network-wired' : 'fa-mobile-screen'}"></i></span>
        <span class="lst-grow"><strong dir="ltr">${esc(b.value)}</strong><small>${esc(b.reason || 'بدون دلیل')} · ${b.createdAt ? new Date(b.createdAt).toLocaleDateString('fa-IR') : ''}</small></span>
        <button type="button" class="lsv-round lsv-round-sm lsv-round-danger" data-click="secRemoveBlacklist" data-click-args="${crvArgs(b.value)}" title="برداشتن مسدودیت" aria-label="برداشتن مسدودیت ${esc(b.value)}"><i class="fa-solid fa-trash"></i></button>
      </li>`);
    rows.push(`
      <li class="lst-list-item lst-clickable sec-bl-add" role="button" tabindex="0" data-anim-key="bl-add" data-click="secOpenBlacklist">
        <span class="lst-avatar"><i class="fa-solid fa-plus"></i></span>
        <span class="lst-grow"><strong>مسدودسازی جدید</strong><small>آدرس IP یا شماره تلفن</small></span>
      </li>`);
    blBox.innerHTML = `<ul class="lst-list sec-bl-list">${rows.join('')}</ul>`;
    const sub = document.getElementById('sec-blacklist-sub');
    if (sub) sub.textContent = bl.length > 12 ? `${crvFa(12)} مورد آخر از ${crvFa(bl.length)}` : 'آی‌پی‌ها و شماره‌هایی که اجازه ورود ندارند';
  }
}

// The stations tab's shimmer; the first load shows skeletons
window.secSetLoading = function(on) {
  const overview = document.getElementById('sec-overview-view');
  if (!overview) return;
  overview.querySelectorAll('.lst-bento > .lst-tile').forEach(t => t.classList.toggle('is-loading', on));
  const grid = document.getElementById('sec-bento-list');
  if (grid) grid.setAttribute('aria-busy', on ? 'true' : 'false');
  if (!on || (window.secRoles || []).length) return;
  if (grid) grid.innerHTML = Array.from({ length: 6 }, () => `
    <div class="crv-card lst-skel" aria-hidden="true">
      <span class="crv-card-top"><span class="crv-card-cover"></span><span class="crv-card-name"><span class="lst-skel-line"></span><span class="lst-skel-line lst-skel-chip"></span></span></span>
      <span class="lst-skel-line lst-skel-short"></span><span class="lst-skel-line"></span><span class="lst-skel-line lst-skel-short"></span>
    </div>`).join('');
  const lines = '<div class="lst-skel-lines" aria-hidden="true">' + '<span class="lst-skel-row"></span>'.repeat(3) + '</div>';
  ['sec-bento-grants', 'sec-bento-blacklist', 'sec-bento-release'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = lines; });
};

// ==================== ONE ROLE'S PAGE ====================
window.openSecRoleView = function(name) {
  const overview = document.getElementById('sec-overview-view');
  window.secActiveRole = String(name);
  crvFadeOut(overview, () => {
    window.loadSecRolePage();
    document.getElementById('roles-tab')?.scrollIntoView({ block: 'start', behavior: NopaMotion.scrollBehavior() });
  });
};

window.closeSecRoleView = function() {
  const view = document.getElementById('sec-detail-view');
  const overview = document.getElementById('sec-overview-view');
  window.secActiveRole = null;
  window.secRenderedRole = null;
  crvFadeOut(view, () => {
    if (window.secActiveRole) return;
    if (view) view.style.display = 'none';
    if (overview) {
      overview.style.display = '';
      if (window.NopaFlip) window.NopaFlip.enter(overview.querySelectorAll(':scope > div:first-child, .lst-bento > .lst-tile'));
    }
  });
};

window.selectSecRole = function(name) { window.secActiveRole = String(name); window.loadSecRolePage(); };

function secCircles(active) {
  return (window.secRoles || []).map(r => {
    const on = r.roleName === active;
    const label = secRoleLabel(r.roleName);
    return `
      <button type="button" class="lsv-circle${on ? ' is-active' : ''}" data-anim-key="sc:${esc(r.roleName)}" data-click="selectSecRole" data-click-args="${crvArgs(r.roleName)}" title="${esc(label)}"${on ? ' aria-current="true"' : ''}>
        <span class="lsv-circle-main">
          <span class="lsv-circle-img"><i class="fa-solid ${secRoleIcon(r.roleName)}"></i></span>
          <span class="lsv-circle-badge ${secIsSuper(r) ? 'lsv-state-active' : secCounts(r).limits ? 'lsv-state-scheduled' : 'lsv-state-active'}">${secIsSuper(r) ? '<i class="fa-solid fa-crown"></i>' : crvFa(secCounts(r).caps)}</span>
        </span>
        <span class="lsv-circle-name"><span>${esc(label)}</span></span>
      </button>`;
  }).join('');
}

function secSwitch(r, field, title, hint) {
  const locked = secIsSuper(r);
  return `
    <label class="chs-check sec-switch" data-anim-key="sw:${field}">
      <span><strong>${esc(title)}</strong>${hint ? `<small>${esc(hint)}</small>` : ''}</span>
      <input type="checkbox" class="chs-switch" aria-label="${esc(title)}"${secFlag(r, field) ? ' checked' : ''}${locked ? ' disabled' : ''} data-change="secTogglePerm" data-change-args="${esc(JSON.stringify([String(r.roleName), field, '$checked', '$this']))}">
    </label>`;
}

function secPaintInfo(r) {
  const set = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };
  const { caps, limits } = secCounts(r);
  const label = secRoleLabel(r.roleName);
  const panel = secIsSuper(r) || r.canLoginPanel;
  set('sec-title', el => { el.textContent = label; });
  set('sec-state', el => { el.innerHTML = secChip(r); });
  set('sec-sub', el => { el.textContent = secIsSuper(r) ? 'دسترسی سوپر ادمین ثابت است' : 'هر تغییر همان لحظه ذخیره می‌شود'; });
  set('sec-circles', el => { el.innerHTML = secCircles(r.roleName); });
  set('sec-limits-count', el => { el.textContent = crvFa(limits); });
  set('sec-caps-count', el => { el.textContent = crvFa(caps); });
  set('sec-info-card', el => {
    el.innerHTML = `
      <span class="crv-mentor-photo sec-photo"><i class="fa-solid ${secRoleIcon(r.roleName)}"></i></span>
      <strong class="crv-mentor-name">${esc(label)}</strong>
      <span class="crv-mentor-phone" dir="ltr">${esc(r.roleName)}</span>
      <div class="mnt-mini">
        <span><strong>${crvFa(caps)}</strong><small>توانایی</small></span>
        <span${limits ? ' class="is-warn"' : ''}><strong>${crvFa(limits)}</strong><small>محدودیت</small></span>
        <span><strong>${panel ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-xmark"></i>'}</strong><small>ورود به پنل</small></span>
      </div>
      <p class="crv-mentor-bio">${secIsSuper(r)
        ? 'سوپر ادمین همیشه به همه بخش‌ها و عملیات دسترسی دارد و دسترسی‌هایش قابل تغییر نیست.'
        : secKey(r.roleName) === 'sub_admin'
          ? 'ادمین فقط بخش‌هایی از پنل را می‌بیند که در «دسترسی به بخش‌های پنل» (پایین همین صفحه) باز کرده‌اید؛ مثلاً برای ساخت چالش، «چالش‌ها و تکالیف» را روی «مشاهده و ویرایش» بگذارید.'
          : 'توانایی‌های این نقش ثابت است؛ محدودیت‌ها بخشی از داده‌ها را برای آن پنهان یا قفل می‌کنند.'}</p>`;
  });
}

function secPaint(r) {
  secPaintInfo(r);
  const set = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };
  set('sec-limits', el => { el.innerHTML = SEC_LIMITS.map(l => secSwitch(r, l[0], l[1], l[2])).join(''); });
  set('sec-caps', el => {
    const list = secAbilities(r);
    const isSub = secKey(r.roleName) === 'sub_admin';
    el.innerHTML = (list.length ? list.map(([title, level]) => `
      <div class="chs-check sec-ability" data-anim-key="ab:${esc(title)}">
        <span><strong>${esc(title)}</strong></span>
        <span class="lst-chip ${level === 'edit' ? 'lst-chip-active' : 'lst-chip-scheduled'}">${level === 'edit' ? 'مشاهده و ویرایش' : 'فقط مشاهده'}</span>
      </div>`).join('') : '<div class="lsv-col-empty">هنوز بخشی برای این نقش باز نشده است.</div>')
      + (isSub && isSuperAdminUser() ? `<button type="button" class="lsv-pill sec-ability-edit" data-click="secScrollToGrants"><i class="fa-solid fa-sliders"></i> تنظیم بخش‌ها</button>` : '');
  });

  // The sub admin's section grants, under the board
  const card = document.getElementById('sub-admin-access-card');
  const showGrants = secKey(r.roleName) === 'sub_admin' && isSuperAdminUser();
  if (card) card.style.display = showGrants ? '' : 'none';
  if (showGrants) renderSubAdminAccess(window.secRoles);
}

window.loadSecRolePage = function() {
  const view = document.getElementById('sec-detail-view');
  const overview = document.getElementById('sec-overview-view');
  const name = window.secActiveRole;
  const r = name && secFind(name);
  if (!view || !r) return;
  const wasOpen = view.style.display !== 'none';
  const same = wasOpen && window.secRenderedRole === name;
  window.secRenderedRole = name;
  if (overview) overview.style.display = 'none';
  view.style.display = 'block';
  if (same && window.NopaFlip) window.NopaFlip.render(view, () => secPaint(r));
  else {
    secPaint(r);
    if (window.NopaFlip) {
      window.NopaFlip.enter(view.querySelectorAll(wasOpen ? '.sec-flow > .lsv-col, .sec-flow > .lsv-link, .sec-grants'
                                                          : '.lsv-head, .lsv-board, .lsv-notch .lsv-circle, .sec-flow > .lsv-col, .sec-grants'));
      const picked = wasOpen && view.querySelector('.lsv-circle.is-active .lsv-circle-img');
      if (picked && typeof picked.animate === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        picked.animate([{ transform: 'scale(0.8)' }, { transform: 'scale(1.12)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
      }
    }
  }
  mntFitNotch(view);
};

// One switch: saved at once (the server upserts only the sent field); reverted if the save fails
window.secTogglePerm = async function(roleName, field, value, input) {
  const r = secFind(roleName);
  if (!r || secIsSuper(r)) return;
  if (input) input.disabled = true;
  try {
    const res = await request('/api/v1/admin/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleName, [field]: value })
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || 'خطا در بروزرسانی نقش');
    Object.assign(r, d.role || { [field]: value });
    if (window.secActiveRole === roleName) secPaintInfo(r);
    secDrawBento();
  } catch (e) {
    console.error(e);
    if (input) input.checked = !value;
    showToast(e.message || 'خطا در بروزرسانی نقش', 'error');
  } finally {
    if (input) input.disabled = false;
  }
};

// ==================== STATION RULES (quiz required for every part) ====================
async function secDrawLmsRules() {
  const tile = document.getElementById('sec-lms-tile');
  if (tile) tile.style.display = isSuperAdminUser() ? '' : 'none';
  const box = document.getElementById('sec-quiz-required');
  if (!box || !isSuperAdminUser()) return;
  try {
    const r = await request('/api/v1/admin/lms/settings');
    if (r && r.ok) {
      const s = await r.json();
      box.checked = s.quizRequired !== false;
      window.lmsQuizRequired = box.checked;
    }
  } catch (_) { /* the switch keeps its last state */ }
}

window.secSaveQuizRequired = async function(checked) {
  const box = document.getElementById('sec-quiz-required');
  try {
    const res = await request('/api/v1/admin/settings/LMS_QUIZ_REQUIRED', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: checked ? 'true' : 'false' }),
    });
    if (!res.ok) throw new Error('save failed');
    window.lmsQuizRequired = !!checked;
    showToast(checked ? 'ساخت آزمونک برای هر پارت اجباری شد.' : 'ساخت آزمونک برای پارت‌ها اختیاری شد.', 'success');
  } catch (err) {
    if (box) box.checked = !checked;
    showToast('خطا در ذخیره تنظیم', 'error');
  }
};

// ==================== BLACKLIST & SESSIONS ====================
// ==================== APP RELEASE (the app's «بررسی نسخه جدید») ====================
window.secRelease = window.secRelease || null;

function secDrawRelease() {
  const tile = document.getElementById('sec-release-tile');
  if (tile) tile.style.display = isSuperAdminUser() ? '' : 'none';
  const box = document.getElementById('sec-bento-release');
  if (!box) return;
  const r = window.secRelease || {};
  const set = !!r.version;
  const notes = Array.isArray(r.notes) ? r.notes : [];
  const when = r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('fa-IR') : '';
  const links = secReleaseLinks(r);
  box.innerHTML = `
    <div class="lst-mini-stats">
      <div class="lst-mini-stat"><span class="stat-label">آخرین نسخه</span><span class="stat-value keep-latin ${set ? 'u-c-success-text' : 'u-c-text-soft'}" dir="ltr">${set ? esc(r.version) : '—'}</span></div>
      <div class="lst-mini-stat"><span class="stat-label">فایل‌ها</span><span class="stat-value u-c-info-text">${crvFa(links.length)}</span></div>
      <div class="lst-mini-stat"><span class="stat-label">تغییرات</span><span class="stat-value u-c-info-text">${crvFa(notes.length)}</span></div>
    </div>
    <p class="lse-hint">${set
      ? `${links.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" dir="ltr">${esc(l.label)}</a>`).join(' · ') || 'بدون فایل'}${when ? ' · ' + when : ''}${r.source === 'env' ? ' · از تنظیمات سرور (nopa.env)' : ''}`
      : 'هنوز نسخه‌ای اعلام نشده؛ اپ همیشه پیام «آخرین نسخه را دارید» نشان می‌دهد.'}</p>
    <div class="lst-quick">
      <button type="button" class="lst-quick-btn" data-click="secOpenRelease"><i class="fa-solid fa-cloud-arrow-up"></i> ${set ? 'ثبت نسخه جدید' : 'اعلام نسخه'}</button>
    </div>`;
}

// One APK per CPU architecture; 'universal' is the all-in-one file (downloadUrl on the server)
const SEC_ABIS = ['arm64-v8a', 'armeabi-v7a', 'x86_64'];
const SEC_ABI_LABEL = { 'arm64-v8a': 'arm64-v8a', 'armeabi-v7a': 'armeabi-v7a', x86_64: 'x86_64', universal: 'نسخه‌ی کامل' };
let secUploading = 0;

function secReleaseLinks(r) {
  const d = (r && r.downloads) || {};
  return [
    ...SEC_ABIS.filter(a => d[a]).map(a => ({ label: a, url: d[a] })),
    ...(r && r.downloadUrl ? [{ label: 'کامل', url: r.downloadUrl }] : []),
  ];
}

window.secOpenRelease = function() {
  const modal = document.getElementById('sec-release-modal');
  if (!modal) return;
  const r = window.secRelease || {};
  document.getElementById('rel-version').value = r.version || '';
  [...SEC_ABIS, 'universal'].forEach(abi => {
    const input = document.getElementById(`rel-url-${abi}`);
    if (input) input.value = abi === 'universal' ? (r.downloadUrl || '') : ((r.downloads || {})[abi] || '');
    const state = document.getElementById(`rel-state-${abi}`);
    if (state) { state.textContent = ''; state.className = 'rel-abi-state'; }
  });
  document.getElementById('rel-notes').value = (Array.isArray(r.notes) ? r.notes : []).join('\n');
  modal.style.display = 'flex';
  modal.style.zIndex = 'var(--z-modal)';
  setTimeout(() => document.getElementById('rel-version')?.focus(), 50);
};

async function secPutRelease(body, okMsg) {
  try {
    const res = await request('/api/v1/admin/app-release', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return showToast(data.error || 'خطا در ذخیره نسخه', 'error');
    // «لغو» within 10s puts the version announced before back (when there was one)
    const old = window.secRelease || {};
    const reload = async () => {
      const r = await request('/api/v1/admin/app-release').catch(() => null);
      if (r && r.ok) { window.secRelease = await r.json().catch(() => window.secRelease); secDrawRelease(); }
    };
    if (old.version && (old.downloadUrl || Object.keys(old.downloads || {}).length)) {
      NopaUndo.afterEdit({
        message: okMsg,
        url: '/api/v1/admin/app-release',
        // the server reads every field every time
        revert: { version: old.version, downloadUrl: old.downloadUrl || '', downloads: old.downloads || {}, notes: Array.isArray(old.notes) ? old.notes : [] },
        done: reload,
      });
    } else {
      showToast(okMsg, 'success');
    }
    window.secRelease = data;
    NopaActions.hide('sec-release-modal');
    secDrawRelease();
  } catch (err) { console.error('secPutRelease error:', err); }
}

window.secSaveRelease = function(e) {
  if (e) e.preventDefault();
  // Persian/Arabic digits typed on a Persian keyboard → ASCII
  const version = document.getElementById('rel-version').value.trim()
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0)).replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660));
  const read = abi => (document.getElementById(`rel-url-${abi}`)?.value || '').trim();
  const downloadUrl = read('universal');
  const downloads = {};
  SEC_ABIS.forEach(abi => { if (read(abi)) downloads[abi] = read(abi); });
  const notes = document.getElementById('rel-notes').value.split('\n').map(s => s.trim()).filter(Boolean);
  if (!version) return;
  if (secUploading) return showToast('صبر کنید تا بارگذاری فایل‌ها تمام شود.', 'info');
  if (!downloadUrl && !Object.keys(downloads).length) return showToast('دست‌کم برای یکی از معماری‌ها فایل بارگذاری کنید یا لینک بگذارید.', 'error');
  if (!downloads['arm64-v8a'] && !downloadUrl) showToast('فایل arm64-v8a ندارید؛ بیشتر گوشی‌ها همین معماری را دارند.', 'info');
  secPutRelease({ version, downloadUrl, downloads, notes }, `نسخه ${version} منتشر شد`);
};

// Uploads one APK into uploads/apk and puts its link in that architecture's field (saved with «انتشار»).
// XMLHttpRequest instead of fetch: the upload shows its progress (an APK is tens of megabytes).
window.secUploadApk = function(abi, input) {
  const file = input && input.files && input.files[0];
  input.value = '';
  if (!file) return;
  const state = document.getElementById(`rel-state-${abi}`);
  const button = document.querySelector(`label[for="rel-file-${abi}"]`);
  const say = (text, cls) => { if (state) { state.textContent = text; state.className = `rel-abi-state${cls ? ' ' + cls : ''}`; } };
  if (!/\.apk$/i.test(file.name)) return say('فقط فایل apk', 'is-error');
  // the release script names each file after its architecture: catch a file put in the wrong row
  const named = ['arm64-v8a', 'armeabi-v7a', 'x86_64'].find(a => file.name.includes(a));
  if (named && named !== abi) say(`هشدار: نام فایل «${named}» است ولی در ردیف ${SEC_ABI_LABEL[abi]} گذاشته شد.`, 'is-error');

  const mb = n => (n / 1024 / 1024).toFixed(1).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const form = new FormData();
  form.append('abi', abi);
  form.append('apk', file);
  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/v1/admin/app-release/apk');
  const token = NopaAuth.getToken();
  if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
  xhr.setRequestHeader('X-Nopa-Client', 'panel');
  secUploading++;
  if (button) button.classList.add('is-busy');
  xhr.upload.onprogress = e => { if (e.lengthComputable) say(`در حال بارگذاری ${Math.round((e.loaded / e.total) * 100)}٪ از ${mb(e.total)} مگابایت`); };
  const finish = () => { secUploading--; if (button) button.classList.remove('is-busy'); };
  xhr.onerror = () => { finish(); say('بارگذاری انجام نشد؛ اتصال را بررسی کنید.', 'is-error'); };
  xhr.onload = () => {
    finish();
    let data = {};
    try { data = JSON.parse(xhr.responseText || '{}'); } catch (_) { /* not JSON */ }
    if (xhr.status === 413) return say('حجم فایل از حد مجاز سرور بیشتر است (client_max_body_size در nginx).', 'is-error');
    if (xhr.status < 200 || xhr.status >= 300 || !data.url) return say(data.error || `بارگذاری انجام نشد (${xhr.status})`, 'is-error');
    const field = document.getElementById(`rel-url-${abi}`);
    if (field) field.value = location.origin + data.url;
    say(`بارگذاری شد (${mb(data.size || file.size)} مگابایت) — برای اعمال، «انتشار» را بزنید.`, 'is-ok');
  };
  xhr.send(form);
};

window.secClearRelease = async function() {
  if (!(await NopaConfirm('اعلان نسخه جدید متوقف شود؟ اپ دیگر پیام به‌روزرسانی نشان نمی‌دهد.'))) return;
  secPutRelease({ version: '', downloadUrl: '', downloads: {}, notes: [] }, 'اعلان نسخه جدید متوقف شد');
};

window.secOpenBlacklist = function() {
  const modal = document.getElementById('sec-blacklist-modal');
  if (!modal) return;
  modal.querySelector('form')?.reset();
  modal.style.display = 'flex';
  modal.style.zIndex = 'var(--z-modal)';
  setTimeout(() => document.getElementById('bl-value')?.focus(), 50);
};

window.secSaveBlacklist = async function(e) {
  if (e) e.preventDefault();
  const type = document.getElementById('bl-type').value;
  const value = document.getElementById('bl-value').value.trim();
  const reason = document.getElementById('bl-reason').value.trim();
  if (!value) return;
  try {
    const res = await request('/api/v1/admin/security/blacklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, value, reason })
    });
    const data = await res.json().catch(() => ({}));
    showToast(res.ok ? data.message : (data.error || 'خطا در ثبت'), res.ok ? 'success' : 'error');
    if (!res.ok) return;
    NopaActions.hide('sec-blacklist-modal');
    window.secBlacklist = [{ type, value, reason, createdAt: new Date().toISOString() }, ...(window.secBlacklist || [])];
    window.filterSecRoles();
  } catch (err) { console.error(err); }
};

window.secRemoveBlacklist = async function(value) {
  if (!(await NopaConfirm(`مسدودیت «${value}» برداشته شود؟`))) return;
  // Gone from the list at once; lifted on the server only if not undone within 10s
  NopaUndo.later({
    message: `مسدودیت «${value}» برداشته شد.`,
    hide: () => {
      const before = window.secBlacklist || [];
      window.secBlacklist = before.filter(b => b.value !== value);
      window.filterSecRoles();
      return () => { window.secBlacklist = before; window.filterSecRoles(); };
    },
    commit: () => request('/api/v1/admin/security/blacklist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value })
    }),
  });
};

window.secRevokeMode = function() {
  const all = document.querySelector('input[name="sec-revoke-mode"]:checked')?.value === 'all';
  const field = document.getElementById('sec-revoke-user-field');
  const input = document.getElementById('revoke-target-user');
  if (field) field.style.display = all ? 'none' : '';
  if (input) input.required = !all;
};

window.secOpenRevoke = function(mode = 'user') {
  const modal = document.getElementById('sec-revoke-modal');
  if (!modal) return;
  modal.querySelector('form')?.reset();
  const radio = modal.querySelector(`input[name="sec-revoke-mode"][value="${mode === 'all' ? 'all' : 'user'}"]`);
  if (radio) radio.checked = true;
  window.secRevokeMode();
  modal.style.display = 'flex';
  modal.style.zIndex = 'var(--z-modal)';
};

window.secRevokeSessions = async function(e) {
  if (e) e.preventDefault();
  const all = document.querySelector('input[name="sec-revoke-mode"]:checked')?.value === 'all';
  const targetUserId = all ? '' : document.getElementById('revoke-target-user').value.trim();
  if (!all && !targetUserId) return;
  const q = all ? 'نشست همه کاربران (از جمله خود شما) باطل شود؟' : 'نشست‌های این کاربر باطل شود؟';
  if (!(await NopaConfirm(q))) return;
  try {
    const res = await request('/api/v1/admin/security/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId })
    });
    const data = await res.json().catch(() => ({}));
    showToast(res.ok ? data.message : (data.error || 'خطا در ابطال نشست‌ها'), res.ok ? 'success' : 'error');
    if (res.ok) NopaActions.hide('sec-revoke-modal');
  } catch (err) { console.error(err); }
};

// =========================================================================
// USER LEVELS: super admin (admin), admin (sub_admin), channel manager, support, mentor, student
// =========================================================================
function roleLabel(role) {
  const r = String(role || '').toLowerCase().replace(/[\s-]/g, '_');
  if (r === 'admin') return 'سوپر ادمین';
  if (r === 'sub_admin') return 'ادمین (مدیر محتوایی)';
  if (r === 'channel_manager') return 'مسئول کانال و گروه‌ها';
  if (r === 'support') return 'پشتیبانی';
  if (r === 'mentor' || r === 'super_mentor' || r === 'supermentor') return 'راهبر';
  return 'نوجوان';
}
window.roleLabel = roleLabel;

// A channel manager's panel is the chat tab alone
function isChannelManagerUser() {
  return String(NopaAuth.getUser().role || '').toLowerCase() === 'channel_manager';
}
window.isChannelManagerUser = isChannelManagerUser;

const PANEL_SECTION_LABELS = {
  users: 'همسفران، سطوح و گواهینامه‌ها',
  rewards: 'کیف پول، زریک و دارایی‌ها',
  mentors: 'راهبران و مدارک',
  instructors: 'بانک اساتید',
  caravans: 'کاروان‌ها',
  lms: 'منزلگاه‌ها، کلاس‌ها و آزمون‌ها',
  challenges: 'چالش‌ها و تکالیف',
  support: 'تیکت‌ها، پیام‌ها و چت',
  chat: 'مدیریت چت و کانال‌ها',
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
    if (role !== 'sub_admin' && role !== 'channel_manager') {
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
      opt.hidden = !superAdmin && (opt.value === 'admin' || opt.value === 'sub_admin' || opt.value === 'channel_manager' || opt.value === 'support');
    });
    const refresh = () => {
      const group = document.getElementById('panel-access-group');
      const r = roleSelect.value;
      if (group) group.style.display = (superAdmin && (r === 'sub_admin' || r === 'channel_manager' || r === 'mentor')) ? '' : 'none';
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

// ---- roles tab: section grants for the sub admin role (super admin only; drawn on the sub_admin page) ----
function renderSubAdminAccess(roles) {
  const box = document.getElementById('sub-admin-sections');
  if (!box) return;
  const row = (roles || []).find(r => r.roleName === 'sub_admin') || {};
  const grants = secGrantsOf(row);
  document.getElementById('sub-admin-can-login').checked = row.canLoginPanel === true;
  box.innerHTML = Object.keys(PANEL_SECTION_LABELS).map(key => `
    <div class="sec-grant${grants[key] ? ' is-' + esc(grants[key]) : ''}" data-anim-key="gr:${key}">
      <span class="sec-grant-name">${PANEL_SECTION_LABELS[key]}${key === 'challenges' ? '<small>با «مشاهده و ویرایش» ادمین می‌تواند چالش (فراگروهی) بسازد و آثار را بررسی کند</small>' : ''}</span>
      <select class="select-ctrl sub-admin-section" data-section="${key}" data-change="secGrantChanged" data-change-args='["$this"]' aria-label="دسترسی ${PANEL_SECTION_LABELS[key]}">
        <option value="" ${!grants[key] ? 'selected' : ''}>بدون دسترسی</option>
        <option value="view" ${grants[key] === 'view' ? 'selected' : ''}>فقط مشاهده</option>
        <option value="edit" ${grants[key] === 'edit' ? 'selected' : ''}>مشاهده و ویرایش</option>
      </select>
    </div>`).join('');
}

window.secScrollToGrants = function() {
  document.getElementById('sub-admin-access-card')?.scrollIntoView({ block: 'start', behavior: NopaMotion.scrollBehavior() });
};

// Tints the row by its level before saving
window.secGrantChanged = function(sel) {
  const row = sel && sel.closest('.sec-grant');
  if (row) { row.classList.remove('is-view', 'is-edit'); if (sel.value) row.classList.add('is-' + sel.value); }
};

async function saveSubAdminAccess() {
  const permissions = {};
  document.querySelectorAll('.sub-admin-section').forEach(sel => {
    if (sel.value) permissions[sel.dataset.section] = sel.value;
  });
  const canLoginPanel = document.getElementById('sub-admin-can-login').checked;
  try {
    const res = await request('/api/v1/admin/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleName: 'sub_admin', canLoginPanel, permissionsJson: permissions })
    });
    const d = await res.json().catch(() => ({}));
    showToast(res.ok ? 'دسترسی‌های ادمین ذخیره شد' : (d.error || 'خطا در ذخیره دسترسی‌ها'), res.ok ? 'success' : 'error');
    if (!res.ok) return;
    const r = secFind('sub_admin');
    if (r) {
      Object.assign(r, d.role || { canLoginPanel, permissionsJson: JSON.stringify(permissions) });
      if (window.secActiveRole === 'sub_admin') secPaintInfo(r);
      secDrawBento();
    }
  } catch (e) {
    console.error('saveSubAdminAccess error:', e);
  }
}
window.saveSubAdminAccess = saveSubAdminAccess;

// The tab starts in its loading state until the first fetch finishes
if (!(window.secRoles || []).length) window.secSetLoading(true);
