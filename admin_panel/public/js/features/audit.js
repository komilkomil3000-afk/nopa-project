// Audit logs tab: a bento like the other tabs — the filterable event list (pages of 20; "more" appends the next
// page) with stats, the actions and actors of the loaded events and the sensitive ones; a row opens its details.
// Split out of the former app.js (Phase 7). Classic script: shares globals with the other modules;
// load order is set in index.html. Styles: css/stations.css (.lst-*, .lsv-*, .aud-*).

window.audLogs = [];
window.audTotal = null;
let audPage = 1;
let audPages = 1;
let audSeq = 0;          // drops responses of a filter the user has already changed
let audSearchTimer = null;

const AUD_LIMIT = 20;
const AUD_SENSITIVE = /^(REVOKE|ADD_BLACKLIST|BLOCK|DELETE|DEDUCT|UPDATE_RBAC|CANCEL|SET_SYSTEM)/;
const AUD_ROLE_LABELS = { student: 'مخاطب', mentor: 'راهبر', super_mentor: 'سوپر راهبر', admin: 'مدیر', sub_admin: 'ادمین', channel_manager: 'مسئول کانال' };

// Persian name of an action code: the filter's own option text (the dashboard reads it the same way)
function audActionLabel(code) {
  const opt = Array.from(document.querySelectorAll('#audit-action-filter option')).find(o => o.value && o.value === code);
  return opt ? opt.textContent.trim() : String(code || '');
}
function audRoleLabel(role) {
  const k = String(role || '').toLowerCase().replace(/[\s-]/g, '_');
  return AUD_ROLE_LABELS[k] || String(role || '');
}
function audIcon(code) {
  const c = String(code || '');
  if (/REVOKE/.test(c)) return 'fa-user-shield';
  if (/BLACKLIST|BLOCK/.test(c)) return 'fa-ban';
  if (/DELETE|CANCEL/.test(c)) return 'fa-trash';
  if (/ZARIK|ASSET|TRANSFER/.test(c)) return 'fa-coins';
  if (/BROADCAST|CHAT/.test(c)) return 'fa-paper-plane';
  if (/RBAC|SETTING/.test(c)) return 'fa-sliders';
  if (/CARAVAN/.test(c)) return 'fa-compass';
  if (/EXPORT/.test(c)) return 'fa-file-export';
  if (/CREATE/.test(c)) return 'fa-plus';
  return 'fa-pen';
}
function audTime(d) {
  const t = new Date(d);
  if (isNaN(t)) return '';
  const sec = (Date.now() - t.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat('fa', { numeric: 'auto' });
  if (sec < 60) return 'همین حالا';
  if (sec < 3600) return rtf.format(-Math.round(sec / 60), 'minute');
  if (sec < 86400) return rtf.format(-Math.round(sec / 3600), 'hour');
  if (sec < 7 * 86400) return rtf.format(-Math.round(sec / 86400), 'day');
  return t.toLocaleDateString('fa-IR');
}
function audFa(n) { return Number(n || 0).toLocaleString('fa-IR'); }
function audArgs(...a) { return esc(JSON.stringify(a.map(String))); }

// ==================== LOADER ====================
// The tab calls it with no args; loadAuditLogs('mentor') / ('all') still sets the role filter
window.loadAuditLogs = async function(role = null, append = false) {
  if (typeof role === 'string') {
    const roleSel = document.getElementById('audit-active-role');
    if (roleSel) roleSel.value = role === 'all' ? '' : role;
  }
  const activeRole = document.getElementById('audit-active-role')?.value || '';
  const action = document.getElementById('audit-action-filter')?.value || '';
  const search = (document.getElementById('audit-search')?.value || '').trim();
  const page = append ? audPage + 1 : 1;
  const seq = ++audSeq;
  if (!append) window.audSetLoading(true);

  try {
    let url = `/api/v1/admin/audit/logs?page=${page}&limit=${AUD_LIMIT}&actorRole=${encodeURIComponent(activeRole)}`;
    if (action) url += `&action=${encodeURIComponent(action)}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    const res = await request(url);
    if (!res.ok) throw new Error('خطا در دریافت لاگ‌ها');
    const data = await res.json();
    if (seq !== audSeq) return;
    const logs = Array.isArray(data) ? data : (data.logs || []);
    window.audLogs = append ? window.audLogs.concat(logs) : logs;
    window.audTotal = Array.isArray(data) ? logs.length : (data.total ?? logs.length);
    audPage = page;
    audPages = Array.isArray(data) ? 1 : (data.pages || 1);
    window.audSetLoading(false);
    const overview = document.getElementById('aud-overview-view');
    if (window.NopaFlip && overview) window.NopaFlip.render(overview, audDraw); else audDraw();
  } catch (e) {
    console.error(e);
    if (seq !== audSeq) return;
    window.audSetLoading(false);
    const list = document.getElementById('aud-list');
    if (list && !append) list.innerHTML = `<div class="lst-empty"><i class="fa-solid fa-triangle-exclamation lst-warn"></i> ${esc(e.message)}</div>`;
  }
};

window.audLoadMore = function() { return window.loadAuditLogs(null, true); };
window.audSubmitFilters = function(e) { if (e) e.preventDefault(); clearTimeout(audSearchTimer); window.loadAuditLogs(); };
window.audSearchInput = function() {
  clearTimeout(audSearchTimer);
  audSearchTimer = setTimeout(() => window.loadAuditLogs(), 400);
};

// ==================== BENTO ====================
function audRow(l, i) {
  const label = audActionLabel(l.action);
  const sensitive = AUD_SENSITIVE.test(String(l.action || ''));
  return `
    <button type="button" class="lsv-row crv-member aud-row${sensitive ? ' is-sensitive' : ''}" data-anim-key="al:${esc(l.id || i)}" data-click="audOpenLog" data-click-args="${audArgs(l.id || i)}">
      <span class="lsv-row-avatar aud-icon"><i class="fa-solid ${audIcon(l.action)}"></i></span>
      <span class="lsv-row-text">
        <strong><bdi>${esc(l.actorName || 'سیستم')}</bdi> <span class="aud-action${label === l.action ? ' is-code' : ''}">${esc(label)}</span></strong>
        <span>${esc(l.details || l.targetEntity || '')}</span>
      </span>
      <span class="aud-meta">
        ${l.actorRole ? `<span class="lst-chip lst-chip-active">${esc(audRoleLabel(l.actorRole))}</span>` : ''}
        <small title="${esc(new Date(l.createdAt).toLocaleString('fa-IR'))}">${esc(audTime(l.createdAt))}</small>
      </span>
    </button>`;
}

function audDraw() {
  const logs = window.audLogs || [];
  const filtering = !!((document.getElementById('audit-search')?.value || '').trim()
    || document.getElementById('audit-active-role')?.value || document.getElementById('audit-action-filter')?.value);

  const badge = document.getElementById('aud-count-badge');
  if (badge) badge.textContent = logs.length
    ? `نمایش ${audFa(logs.length)} از ${audFa(window.audTotal)}${filtering ? ' (فیلترشده)' : ''}`
    : 'برای دیدن جزئیات هر رویداد بزنید';

  const list = document.getElementById('aud-list');
  if (list) {
    list.innerHTML = logs.length ? logs.map(audRow).join('')
      : `<div class="lst-empty" data-anim-key="al-empty"><i class="fa-solid fa-clock-rotate-left"></i> ${filtering ? 'رویدادی با این فیلترها ثبت نشده است.' : 'هنوز رویدادی ثبت نشده است.'}</div>`;
    list.setAttribute('aria-busy', 'false');
  }
  const more = document.getElementById('aud-more');
  if (more) more.hidden = audPage >= audPages;

  const today = new Date().toDateString();
  const actors = new Map();
  const actions = new Map();
  logs.forEach(l => {
    const a = l.actorName || 'سیستم';
    actors.set(a, (actors.get(a) || 0) + 1);
    actions.set(l.action, (actions.get(l.action) || 0) + 1);
  });
  const sensitive = logs.filter(l => AUD_SENSITIVE.test(String(l.action || '')));
  const setStat = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setStat('aud-stat-total', audFa(window.audTotal));
  setStat('aud-stat-today', audFa(logs.filter(l => new Date(l.createdAt).toDateString() === today).length));
  setStat('aud-stat-actors', audFa(actors.size));
  setStat('aud-stat-sensitive', audFa(sensitive.length));

  const actBox = document.getElementById('aud-bento-actions');
  if (actBox) {
    const top = Array.from(actions.entries()).sort((a, b) => b[1] - a[1]);
    const cls = ['active', 'scheduled', 'locked'];
    const main = top.slice(0, 3);
    const rest = top.slice(3).reduce((s, x) => s + x[1], 0);
    const w = n => (logs.length ? Math.round((n / logs.length) * 100) : 0);
    actBox.innerHTML = top.length ? `
      <div class="lst-bar">${main.map((x, i) => `<span class="lst-bar-${cls[i]}" data-style="width:${w(x[1])}%"></span>`).join('')}${rest ? `<span class="aud-bar-rest" data-style="width:${w(rest)}%"></span>` : ''}</div>
      <div class="lst-legend">
        ${main.map((x, i) => `<div class="lst-legend-row"><span><span class="lst-dot lst-dot-${cls[i]}"></span>${esc(audActionLabel(x[0]))}</span><strong>${audFa(x[1])}</strong></div>`).join('')}
        ${rest ? `<div class="lst-legend-row"><span><span class="lst-dot aud-dot-rest"></span>سایر</span><strong>${audFa(rest)}</strong></div>` : ''}
      </div>` : '<div class="lst-empty">رویدادی نیست.</div>';
  }

  const actBoxActors = document.getElementById('aud-bento-actors');
  if (actBoxActors) {
    const top = Array.from(actors.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    actBoxActors.innerHTML = top.length ? `<ul class="lst-list">${top.map((x, i) => `
      <li class="lst-list-item lst-clickable" role="button" tabindex="0" data-anim-key="aa:${esc(x[0])}" data-click="audFilterActor" data-click-args="${audArgs(x[0])}" title="رویدادهای ${esc(x[0])}">
        <span class="crv-rank">${audFa(i + 1)}</span>
        <span class="lst-avatar">${esc(String(x[0]).trim().charAt(0) || '؟')}</span>
        <span class="lst-grow"><strong><bdi>${esc(x[0])}</bdi></strong></span>
        <span class="u-c-primary-text">${audFa(x[1])}</span>
      </li>`).join('')}</ul>` : '<div class="lst-empty">رویدادی نیست.</div>';
  }

  const sensBox = document.getElementById('aud-bento-sensitive');
  if (sensBox) {
    sensBox.innerHTML = sensitive.length ? `<ul class="lst-list">${sensitive.slice(0, 6).map(l => `
      <li class="lst-list-item lst-clickable" role="button" tabindex="0" data-anim-key="as:${esc(l.id)}" data-click="audOpenLog" data-click-args="${audArgs(l.id)}">
        <i class="fa-solid ${audIcon(l.action)} lst-warn"></i>
        <span class="lst-grow"><strong><bdi>${esc(l.actorName || 'سیستم')}</bdi></strong>: ${esc(audActionLabel(l.action))}${l.details ? ` — ${esc(l.details)}` : ''}</span>
        <small class="u-c-text-muted">${esc(audTime(l.createdAt))}</small>
      </li>`).join('')}</ul>`
      : '<div class="lst-empty"><i class="fa-solid fa-circle-check u-c-success-text"></i> در رویدادهای نمایش‌داده‌شده مورد حساسی نیست.</div>';
  }
}

// Ranked actor -> search by the name
window.audFilterActor = function(name) {
  const input = document.getElementById('audit-search');
  if (input) input.value = name;
  window.loadAuditLogs();
};

window.audSetLoading = function(on) {
  const overview = document.getElementById('aud-overview-view');
  if (!overview) return;
  overview.querySelectorAll('.lst-bento > .lst-tile').forEach(t => t.classList.toggle('is-loading', on));
  const list = document.getElementById('aud-list');
  if (list) list.setAttribute('aria-busy', on ? 'true' : 'false');
  if (!on || (window.audLogs || []).length) return;
  if (list) list.innerHTML = Array.from({ length: 6 }, () => `
    <div class="lsv-row crv-member" aria-hidden="true"><span class="lsv-row-avatar lst-skel-avatar"></span>
      <span class="lsv-row-text"><span class="lst-skel-line"></span><span class="lst-skel-line lst-skel-short"></span></span></div>`).join('');
  const lines = '<div class="lst-skel-lines" aria-hidden="true">' + '<span class="lst-skel-row"></span>'.repeat(3) + '</div>';
  ['aud-bento-actions', 'aud-bento-actors', 'aud-bento-sensitive'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = lines; });
};

// ==================== ONE EVENT ====================
window.audOpenLog = function(id) {
  const l = (window.audLogs || []).find((x, i) => String(x.id || i) === String(id));
  const modal = document.getElementById('aud-log-modal');
  if (!l || !modal) return;
  document.getElementById('aud-log-title').textContent = audActionLabel(l.action);
  document.getElementById('aud-log-time').textContent = new Date(l.createdAt).toLocaleString('fa-IR');
  const fact = (icon, label, value, ltr) => `
    <div class="aud-fact"><span><i class="fa-solid ${icon}"></i> ${label}</span><strong${ltr ? ' dir="ltr"' : ''}>${esc(value || '-')}</strong></div>`;
  document.getElementById('aud-log-body').innerHTML = `
    <section class="lse-card">
      <h4 class="lse-card-title"><i class="fa-solid fa-user"></i> انجام‌دهنده</h4>
      <div class="aud-facts">
        ${fact('fa-signature', 'نام', l.actorName)}
        ${fact('fa-user-tag', 'نقش', audRoleLabel(l.actorRole))}
        ${fact('fa-network-wired', 'آدرس IP', l.ipAddress, true)}
        ${fact('fa-fingerprint', 'شناسه', l.actorId, true)}
      </div>
    </section>
    <section class="lse-card">
      <h4 class="lse-card-title"><i class="fa-solid ${audIcon(l.action)}"></i> عملیات</h4>
      <div class="aud-facts">
        ${fact('fa-code', 'کد عملیات', l.action, true)}
        ${fact('fa-cube', 'موجودیت هدف', l.targetEntity)}
        ${fact('fa-hashtag', 'شناسه هدف', l.targetEntityId, true)}
      </div>
      ${l.details ? `<p class="aud-details">${esc(l.details)}</p>` : ''}
    </section>`;
  modal.style.display = 'flex';
  modal.style.zIndex = 'var(--z-modal)';
};

if (!(window.audLogs || []).length) window.audSetLoading(true);
