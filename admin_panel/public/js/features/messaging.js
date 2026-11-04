// Messaging: announcement broadcast and the notification engine (templates, logs, overrides).
// The page is a bento like the other tabs (#msg-overview-view): the two composers in the big tile with templates,
// variables and a live preview; channel switches, delivery stats and history around them. The forms are submitted
// by js/app/bootstrap.js (handleNotificationBroadcast) and handleAnnouncementBroadcast below.
// Split out of the former app.js (Phase 7). Classic script: shares globals with the other modules;
// load order is set in index.html. Styles: css/stations.css (.msg-*), css/components.css (.msg-mode).
let msgLogs = null;
let msgOverrides = null;
let msgTemplates = [];

const MSG_CHANNELS = {
  in_app: ['اعلان داخل اپ', 'fa-mobile-screen', 'active'],
  sms: ['پیامک', 'fa-comment-sms', 'scheduled'],
  email: ['ایمیل', 'fa-envelope', 'locked'],
};
const MSG_AUDIENCE = { all: 'همه کاربران', mentors: 'راهبران', caravan: 'یک کاروان', students: 'نوجوانان' };
const MSG_SAMPLE = { '{user_name}': 'سارا', '{zarik_balance}': '۱٬۲۵۰' };
const msgFa = n => Number(n || 0).toLocaleString('fa-IR');
const msgChannel = ch => MSG_CHANNELS[ch] || [ch || '-', 'fa-paper-plane', 'rest'];

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
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      showToast(data.message || 'اطلاعیه منتشر شد', 'success');
      document.getElementById('announcement-title').value = '';
      document.getElementById('announcement-message').value = '';
      window.msgPreviewAnnouncement();
      loadNotificationLogs();
    } else {
      showToast(data.error || 'خطا در انتشار اطلاعیه', 'error');
    }
  } catch (err) {
    console.error(err);
  }
}

// 4. Notifications Engine (Templates, Logs, Overrides)
// The parts load independently: a failure in one must not leave the others blank.
async function loadNotificationData() {
  msgSetLoading(true);
  await Promise.all([loadChannelOverrides(), loadNotificationLogs(), loadNotificationTemplates()]);
  msgSetLoading(false);
  window.msgPreview();
}
window.loadNotificationData = loadNotificationData;

function msgSetLoading(on) {
  document.querySelectorAll('#msg-overview-view .lst-bento > .lst-tile:not(.lst-tile-stations)').forEach(t => t.classList.toggle('is-loading', on));
  if (!on) return;
  const lines = '<div class="lst-skel-lines" aria-hidden="true">' + '<span class="lst-skel-row"></span>'.repeat(3) + '</div>';
  if (!msgOverrides) { const el = document.getElementById('channel-overrides-list'); if (el) el.innerHTML = lines; }
  if (!msgLogs) ['msg-bento-channels', 'msg-bento-logs'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = lines; });
}

async function loadChannelOverrides() {
  const container = document.getElementById('channel-overrides-list');
  try {
    const resOv = await request('/api/v1/admin/notifications/overrides');
    const overrides = await resOv.json().catch(() => null);
    if (!resOv.ok || !Array.isArray(overrides)) throw new Error('خطا در دریافت تنظیمات کانال‌ها');
    msgOverrides = overrides;
    msgDrawChannels();
  } catch (err) {
    console.error('Notification overrides error', err);
    if (container) container.innerHTML = `<div class="lst-empty"><i class="fa-solid fa-triangle-exclamation lst-warn"></i> ${esc(err.message)}</div>`;
  }
}

function msgEnabled(ch) {
  const ov = (msgOverrides || []).find(o => o.channel === ch);
  return ov ? ov.isEnabled !== false : true;
}

function msgDrawChannels() {
  const container = document.getElementById('channel-overrides-list');
  if (container && msgOverrides) {
    container.innerHTML = Object.keys(MSG_CHANNELS).map(ch => {
      const [label, icon] = MSG_CHANNELS[ch];
      return `
        <label class="chs-check msg-channel">
          <span><strong><i class="fa-solid ${icon}"></i> ${label}</strong><small>${msgEnabled(ch) ? 'فعال — پیام‌ها ارسال می‌شوند' : 'خاموش — ارسال انجام نمی‌شود'}</small></span>
          <input type="checkbox" class="chs-switch" aria-label="${label}" data-change="toggleChannelOverride" data-change-args="${esc(JSON.stringify([ch, '$checked', '$this']))}"${msgEnabled(ch) ? ' checked' : ''}>
        </label>`;
    }).join('');
  }
  const el = document.getElementById('msg-stat-channels');
  if (el && msgOverrides) el.textContent = `${msgFa(Object.keys(MSG_CHANNELS).filter(msgEnabled).length)} از ${msgFa(3)}`;
  msgChannelHint();
}

async function loadNotificationLogs() {
  const box = document.getElementById('msg-bento-logs');
  try {
    const resLogs = await request('/api/v1/admin/notifications/logs');
    const logs = await resLogs.json().catch(() => null);
    if (!resLogs.ok || !Array.isArray(logs)) throw new Error('خطا در دریافت گزارش ارسال‌ها');
    msgLogs = logs;
    msgDrawLogs();
  } catch (err) {
    console.error('Notification logs error', err);
    if (box) box.innerHTML = `<div class="lst-empty"><i class="fa-solid fa-triangle-exclamation lst-warn"></i> ${esc(err.message)}</div>`;
  }
}

function msgDrawLogs() {
  const logs = msgLogs || [];
  const ok = logs.filter(l => l.status === 'success').length;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('msg-stat-total', msgFa(logs.length));
  set('msg-stat-ok', msgFa(ok));
  set('msg-stat-fail', msgFa(logs.length - ok));

  const byCh = document.getElementById('msg-bento-channels');
  if (byCh) {
    const keys = Object.keys(MSG_CHANNELS);
    const n = k => logs.filter(l => l.channel === k).length;
    const w = k => (logs.length ? Math.round((n(k) / logs.length) * 100) : 0);
    byCh.innerHTML = logs.length ? `
      <div class="lst-bar">${keys.filter(n).map(k => `<span class="lst-bar-${MSG_CHANNELS[k][2]}" data-style="width:${w(k)}%"></span>`).join('')}</div>
      <div class="lst-legend">${keys.map(k => `<div class="lst-legend-row"><span><span class="lst-dot lst-dot-${MSG_CHANNELS[k][2]}"></span>${MSG_CHANNELS[k][0]}</span><strong>${msgFa(n(k))}</strong></div>`).join('')}</div>`
      : '<div class="lst-empty">هنوز پیامی ارسال نشده است.</div>';
  }

  const box = document.getElementById('msg-bento-logs');
  if (box) {
    box.innerHTML = logs.length ? `<ul class="lst-list msg-logs">${logs.slice(0, 20).map(l => {
      const [label, icon] = msgChannel(l.channel);
      const okRow = l.status === 'success';
      return `
        <li class="lst-list-item${okRow ? '' : ' is-failed'}">
          <span class="lst-avatar msg-log-icon${okRow ? '' : ' is-failed'}"><i class="fa-solid ${icon}"></i></span>
          <span class="lst-grow"><strong>${esc(label)}</strong> · ${esc(MSG_AUDIENCE[l.targetAudience] || l.targetAudience || '-')}${!okRow && l.error ? `<small>${esc(l.error)}</small>` : ''}</span>
          <span class="lst-chip ${okRow ? 'lst-chip-active' : 'lst-chip-locked'}">${okRow ? 'موفق' : 'ناموفق'}</span>
          <small class="u-c-text-muted msg-log-time">${esc(new Date(l.createdAt).toLocaleString('fa-IR'))}</small>
        </li>`;
    }).join('')}</ul>` : '<div class="lst-empty">هنوز پیامی ارسال نشده است.</div>';
  }
}

window.toggleChannelOverride = async function(channel, isEnabled, input) {
  if (input) input.disabled = true;
  try {
    const res = await request('/api/v1/admin/notifications/overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, isEnabled })
    });
    if (!res.ok) throw new Error('خطا در تغییر وضعیت کانال');
    msgOverrides = (msgOverrides || []).filter(o => o.channel !== channel).concat([{ channel, isEnabled }]);
    msgDrawChannels();
    showToast(`${msgChannel(channel)[0]} ${isEnabled ? 'روشن' : 'خاموش'} شد`, 'success');
  } catch (err) {
    console.error(err);
    if (input) input.checked = !isEnabled;
    showToast(err.message, 'error');
  } finally {
    if (input) input.disabled = false;
  }
};

// ---- templates ----
async function loadNotificationTemplates() {
  try {
    const res = await request('/api/v1/admin/notifications/templates');
    const list = res.ok ? await res.json() : [];
    msgTemplates = Array.isArray(list) ? list : [];
  } catch (_) { msgTemplates = []; }
  const sel = document.getElementById('msg-template-select');
  if (!sel) return;
  const keep = sel.value;
  sel.innerHTML = `<option value="">${msgTemplates.length ? 'بدون الگو' : 'الگویی ذخیره نشده'}</option>` +
    msgTemplates.map(t => `<option value="${esc(t.id)}">${esc(t.name)} (${esc(msgChannel(t.channel)[0])})</option>`).join('');
  if (keep) sel.value = keep;
}

window.msgApplyTemplate = function() {
  const t = msgTemplates.find(x => String(x.id) === document.getElementById('msg-template-select').value);
  if (!t) return;
  document.getElementById('notif-title').value = t.titleTpl || '';
  document.getElementById('notif-message').value = t.messageTpl || '';
  if (MSG_CHANNELS[t.channel]) document.getElementById('notif-channel').value = t.channel;
  window.msgPreview();
};

window.msgOpenTemplateSave = function() {
  const title = document.getElementById('notif-title').value.trim();
  const message = document.getElementById('notif-message').value.trim();
  if (!title || !message) return showToast('اول عنوان و متن پیام را بنویسید', 'error');
  const modal = document.getElementById('msg-template-modal');
  document.getElementById('msg-template-name').value = '';
  modal.style.display = 'flex';
  modal.style.zIndex = 'var(--z-modal)';
  setTimeout(() => document.getElementById('msg-template-name')?.focus(), 50);
};

window.msgSaveTemplate = async function(e) {
  if (e) e.preventDefault();
  const name = document.getElementById('msg-template-name').value.trim();
  const channel = document.getElementById('notif-channel').value;
  if (!name) return;
  try {
    const res = await request('/api/v1/admin/notifications/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        titleTpl: document.getElementById('notif-title').value.trim(),
        messageTpl: document.getElementById('notif-message').value.trim(),
        channel: MSG_CHANNELS[channel] ? channel : 'in_app',
      })
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(msgTemplates.some(t => t.name === name) ? 'الگویی با این نام وجود دارد' : (d.error || 'خطا در ذخیره الگو'));
    NopaActions.hide('msg-template-modal');
    showToast('الگو ذخیره شد', 'success');
    await loadNotificationTemplates();
    if (d.id) document.getElementById('msg-template-select').value = d.id;
  } catch (err) { showToast(err.message, 'error'); }
};

// ---- variables & preview ----
window.msgInsertVar = function(token) {
  const el = document.getElementById('notif-message');
  if (!el) return;
  const s = el.selectionStart ?? el.value.length;
  const t = el.selectionEnd ?? el.value.length;
  el.value = el.value.slice(0, s) + token + el.value.slice(t);
  el.focus();
  el.selectionStart = el.selectionEnd = s + token.length;
  window.msgPreview();
};

function msgFill(text) {
  return esc(text).replace(/\{user_name\}|\{zarik_balance\}/g, m => `<mark>${MSG_SAMPLE[m]}</mark>`);
}

window.msgPreview = function() {
  const title = document.getElementById('notif-title')?.value.trim() || '';
  const text = document.getElementById('notif-message')?.value.trim() || '';
  const ch = document.getElementById('notif-channel')?.value || 'in_app';
  const t = document.getElementById('msg-preview-title');
  const p = document.getElementById('msg-preview-text');
  if (t) t.innerHTML = title ? msgFill(title) : '<span class="u-c-text-muted">عنوان پیام</span>';
  if (p) p.innerHTML = text ? msgFill(text) : '<span class="u-c-text-muted">متن پیام اینجا نمایش داده می‌شود.</span>';
  const label = document.getElementById('msg-preview-channel');
  if (label) label.textContent = ch === 'all' ? 'همه‌ی کانال‌ها' : msgChannel(ch)[0];
  const len = document.getElementById('msg-length');
  if (len) {
    const n = text.length;
    len.textContent = ch === 'sms' || ch === 'all' ? `${msgFa(n)} حرف · حدود ${msgFa(Math.max(1, Math.ceil(n / 70)))} پیامک` : `${msgFa(n)} حرف`;
  }
  msgChannelHint();
};

window.msgPreviewAnnouncement = function() {
  const title = document.getElementById('announcement-title')?.value.trim() || '';
  const text = document.getElementById('announcement-message')?.value.trim() || '';
  const t = document.getElementById('msg-ann-preview-title');
  const p = document.getElementById('msg-ann-preview-text');
  if (t) t.innerHTML = title ? esc(title) : '<span class="u-c-text-muted">عنوان اطلاعیه</span>';
  if (p) p.innerHTML = text ? esc(text) : '<span class="u-c-text-muted">متن اطلاعیه اینجا نمایش داده می‌شود.</span>';
};

// A warning under the send button when the chosen channel is switched off
function msgChannelHint() {
  const hint = document.getElementById('msg-channel-hint');
  if (!hint) return;
  const ch = document.getElementById('notif-channel')?.value || 'in_app';
  const off = (ch === 'all' ? Object.keys(MSG_CHANNELS) : [ch]).filter(c => MSG_CHANNELS[c] && !msgEnabled(c));
  hint.innerHTML = off.length ? `<i class="fa-solid fa-triangle-exclamation lst-warn"></i> ${esc(off.map(c => MSG_CHANNELS[c][0]).join('، '))} خاموش است و از آن ارسال نمی‌شود.` : '';
}

// ---- Messaging page: two composers (multi-channel campaign / Jarchi announcement) ----
function setMessagingMode(mode) {
  const tab = document.querySelector('.msg-mode[data-msg-mode="' + mode + '"]');
  if (!tab || tab.classList.contains('is-denied')) mode = 'campaign';
  document.querySelectorAll('.msg-mode').forEach(b => {
    const on = b.dataset.msgMode === mode;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-selected', String(on));
  });
  document.querySelectorAll('.msg-pane').forEach(p => { p.hidden = p.dataset.msgPane !== mode; });
}

// #content (the former global-announcement tab) opens the announcement composer
window.selectMessagingModeFromHash = function() {
  setMessagingMode(/^#content/.test(window.location.hash) ? 'announcement' : 'campaign');
};

document.querySelector('#notifications-tab .msg-modes')?.addEventListener('click', e => {
  const btn = e.target.closest('.msg-mode');
  if (btn) setMessagingMode(btn.dataset.msgMode);
});

// Both composers can target one caravan
window.loadMessagingCaravans = async function() {
  let caravans = [];
  try {
    const res = await request('/api/v1/admin/caravans', { silent: true });
    if (res.ok) {
      const data = await res.json();
      caravans = Array.isArray(data) ? data : (data.caravans || data.data || []);
    }
  } catch (_) { /* no caravans grant: global targets only */ }
  const options = caravans.map(c => '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>').join('');
  const ann = document.getElementById('announcement-caravan');
  if (ann) { const keep = ann.value; ann.innerHTML = '<option value="">همه کاربران (سراسری)</option>' + options; ann.value = keep; }
  const notif = document.getElementById('notif-target-caravan');
  if (notif) { const keep = notif.value; notif.innerHTML = caravans.length ? options : '<option value="">کاروانی در دسترس نیست</option>'; if (keep) notif.value = keep; }
  syncNotifAudience();
};

// "یک کاروان خاص" shows the caravan picker
function syncNotifAudience() {
  const audience = document.getElementById('notif-audience');
  const box = document.getElementById('notif-caravan-container');
  const select = document.getElementById('notif-target-caravan');
  if (!audience || !box) return;
  const isCaravan = audience.value === 'caravan';
  box.style.display = isCaravan ? '' : 'none';
  if (select) select.required = isCaravan;
}
document.getElementById('notif-audience')?.addEventListener('change', syncNotifAudience);
document.getElementById('notification-broadcast-form')?.addEventListener('reset', () => setTimeout(() => { syncNotifAudience(); window.msgPreview(); }, 0));
