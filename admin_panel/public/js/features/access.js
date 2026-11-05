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
const SEC_CAPS = [
  ['manageContent', 'مدیریت محتوا'],
  ['manageStudents', 'مدیریت نوجوانان'],
  ['manageMentors', 'مدیریت راهبران'],
  ['manageCaravans', 'مدیریت کاروان‌ها'],
  ['manageSystem', 'مدیریت سیستم'],
  ['canManageUsers', 'مدیریت کاربران'],
  ['canSendMessage', 'پیام و چت'],
  ['canJoinClasses', 'شرکت در کلاس'],
  ['canScoreAndEvaluate', 'ارزیابی تکالیف'],
  ['canConvertAssets', 'تبدیل سرمایه'],
  ['canCreateChallenges', 'ایجاد چالش'],
  ['canViewGlobalAnalytics', 'آمار کلی'],
];
const SEC_ROLE_ORDER = ['admin', 'sub_admin', 'channel_manager', 'support', 'super_mentor', 'mentor', 'student'];

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
function secCounts(r) {
  return {
    caps: SEC_CAPS.filter(c => secFlag(r, c[0])).length,
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
    const list = Array.isArray(roles) ? roles : [];
    // The sub admin's section grants are edited on its page, so it is always listed
    if (!list.some(r => secKey(r.roleName) === 'sub_admin')) list.push({ roleName: 'sub_admin' });
    const rank = r => { const i = SEC_ROLE_ORDER.indexOf(secKey(r.roleName)); return i < 0 ? 99 : i; };
    window.secRoles = list.sort((a, b) => rank(a) - rank(b) || String(a.roleName).localeCompare(String(b.roleName)));
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
  const pct = Math.round((caps / SEC_CAPS.length) * 100);
  const label = secRoleLabel(r.roleName);
  return `
    <button type="button" class="crv-card" data-anim-key="sr:${esc(r.roleName)}" data-click="openSecRoleView" data-click-args="${crvArgs(r.roleName)}" title="دسترسی‌های ${esc(label)}">
      <span class="crv-card-top">
        <span class="crv-card-cover sec-cover"><i class="fa-solid ${secRoleIcon(r.roleName)}"></i></span>
        <span class="crv-card-name"><strong>${esc(label)}</strong>${secChip(r)}</span>
      </span>
      <span class="crv-card-mentor"><i class="fa-solid fa-tag"></i><span dir="ltr">${esc(r.roleName)}</span></span>
      <span class="crv-card-cap"><span>توانایی‌ها</span><strong>${crvFa(caps)} / ${crvFa(SEC_CAPS.length)}</strong></span>
      <span class="lst-bar"><span class="${pct >= 80 ? 'lst-bar-scheduled' : 'lst-bar-active'}" data-style="width:${pct}%"></span></span>
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
  set('sec-caps-count', el => { el.textContent = `${crvFa(caps)} / ${crvFa(SEC_CAPS.length)}`; });
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
        : 'توانایی‌ها کارهایی است که این نقش مجاز به انجامش است؛ محدودیت‌ها بخشی از داده‌ها را برای آن پنهان یا قفل می‌کنند.'}</p>`;
  });
}

function secPaint(r) {
  secPaintInfo(r);
  const set = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };
  set('sec-limits', el => { el.innerHTML = SEC_LIMITS.map(l => secSwitch(r, l[0], l[1], l[2])).join(''); });
  set('sec-caps', el => { el.innerHTML = SEC_CAPS.map(c => secSwitch(r, c[0], c[1])).join(''); });

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
  box.innerHTML = `
    <div class="lst-mini-stats">
      <div class="lst-mini-stat"><span class="stat-label">آخرین نسخه</span><span class="stat-value keep-latin ${set ? 'u-c-success-text' : 'u-c-text-soft'}" dir="ltr">${set ? esc(r.version) : '—'}</span></div>
      <div class="lst-mini-stat"><span class="stat-label">تغییرات</span><span class="stat-value u-c-info-text">${crvFa(notes.length)}</span></div>
    </div>
    <p class="lse-hint">${set
      ? `لینک: <a href="${esc(r.downloadUrl)}" target="_blank" rel="noopener noreferrer" dir="ltr">${esc(r.downloadUrl.length > 48 ? r.downloadUrl.slice(0, 45) + '…' : r.downloadUrl)}</a>${when ? ' · ' + when : ''}${r.source === 'env' ? ' · از تنظیمات سرور (nopa.env)' : ''}`
      : 'هنوز نسخه‌ای اعلام نشده؛ اپ همیشه پیام «آخرین نسخه را دارید» نشان می‌دهد.'}</p>
    <div class="lst-quick">
      <button type="button" class="lst-quick-btn" data-click="secOpenRelease"><i class="fa-solid fa-cloud-arrow-up"></i> ${set ? 'ثبت نسخه جدید' : 'اعلام نسخه'}</button>
    </div>`;
}

window.secOpenRelease = function() {
  const modal = document.getElementById('sec-release-modal');
  if (!modal) return;
  const r = window.secRelease || {};
  document.getElementById('rel-version').value = r.version || '';
  document.getElementById('rel-url').value = r.downloadUrl || '';
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
    showToast(res.ok ? okMsg : (data.error || 'خطا در ذخیره نسخه'), res.ok ? 'success' : 'error');
    if (!res.ok) return;
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
  const downloadUrl = document.getElementById('rel-url').value.trim();
  const notes = document.getElementById('rel-notes').value.split('\n').map(s => s.trim()).filter(Boolean);
  if (!version || !downloadUrl) return;
  secPutRelease({ version, downloadUrl, notes }, `نسخه ${version} منتشر شد`);
};

window.secClearRelease = async function() {
  if (!(await NopaConfirm('اعلان نسخه جدید متوقف شود؟ اپ دیگر پیام به‌روزرسانی نشان نمی‌دهد.'))) return;
  secPutRelease({ version: '', downloadUrl: '', notes: [] }, 'اعلان نسخه جدید متوقف شد');
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
  try {
    const res = await request('/api/v1/admin/security/blacklist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value })
    });
    const data = await res.json().catch(() => ({}));
    showToast(res.ok ? data.message : (data.error || 'خطا در حذف'), res.ok ? 'success' : 'error');
    if (!res.ok) return;
    window.secBlacklist = (window.secBlacklist || []).filter(b => b.value !== value);
    window.filterSecRoles();
  } catch (err) { console.error(err); }
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
// FOUR USER LEVELS: super admin (admin), admin (sub_admin), mentor, student
// =========================================================================
function roleLabel(role) {
  const r = String(role || '').toLowerCase().replace(/[\s-]/g, '_');
  if (r === 'admin') return 'سوپر ادمین';
  if (r === 'sub_admin') return 'ادمین (مدیر محتوایی)';
  if (r === 'channel_manager') return 'مسئول کانال و گروه‌ها';
  if (r === 'support') return 'پشتیبانی';
  if (r === 'mentor' || r === 'super_mentor' || r === 'supermentor') return 'مربی';
  return 'دانش‌آموز';
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
      <span class="sec-grant-name">${PANEL_SECTION_LABELS[key]}</span>
      <select class="select-ctrl sub-admin-section" data-section="${key}" data-change="secGrantChanged" data-change-args='["$this"]' aria-label="دسترسی ${PANEL_SECTION_LABELS[key]}">
        <option value="" ${!grants[key] ? 'selected' : ''}>بدون دسترسی</option>
        <option value="view" ${grants[key] === 'view' ? 'selected' : ''}>فقط مشاهده</option>
        <option value="edit" ${grants[key] === 'edit' ? 'selected' : ''}>مشاهده و ویرایش</option>
      </select>
    </div>`).join('');
}

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
