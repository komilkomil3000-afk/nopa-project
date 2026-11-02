// Messaging: announcement broadcast and the notification engine (templates, logs, overrides).
// Split out of the former app.js (Phase 7). Classic script: shares globals with the other modules;
// load order is set in index.html.

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
      showToast(data.message);
      document.getElementById('announcement-title').value = '';
      document.getElementById('announcement-message').value = '';
    } else {
      showToast(data.error);
    }
  } catch (err) {
    console.error(err);
  }
}

// 4. Notifications Engine (Templates, Logs, Overrides)
// The two parts load independently: a failure in one must not leave the other blank.
async function loadNotificationData() {
  await Promise.all([loadChannelOverrides(), loadNotificationLogs()]);
}

async function loadChannelOverrides() {
  const container = document.getElementById('channel-overrides-list');
  try {
    const resOv = await request('/api/v1/admin/notifications/overrides');
    const overrides = await resOv.json();
    if (!resOv.ok || !Array.isArray(overrides)) return NopaState.error(container, 'خطا در دریافت تنظیمات کانال‌ها');
    if (container) {
      container.innerHTML = '';
      ['in_app', 'sms', 'email'].forEach(ch => {
        const ov = overrides.find(o => o.channel === ch) || { isEnabled: true };
        const labelName = ch === 'in_app' ? 'نوتیفیکیشن داخل اپلیکیشن' : (ch === 'sms' ? 'سرویس پیام کوتاه' : 'سرویس ایمیل');
        container.innerHTML += `
          <div class="permission-item">
            <span>${labelName}</span>
            <label class="switch">
              <input type="checkbox" data-change="toggleChannelOverride" data-change-args="${esc(JSON.stringify([String(ch), "$checked"]))}" ${ov.isEnabled ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
          </div>
        `;
      });
    }
  } catch (err) {
    console.error('Notification overrides error', err);
    NopaState.error(container, 'خطا در دریافت تنظیمات کانال‌ها');
  }
}

async function loadNotificationLogs() {
  const tbody = document.querySelector('#notification-logs-table tbody');
  try {
    const resLogs = await request('/api/v1/admin/notifications/logs');
    const logs = await resLogs.json();
    if (!resLogs.ok || !Array.isArray(logs)) return NopaTable.error(tbody, 'خطا در دریافت گزارش ارسال‌ها');
    if (!logs.length) return NopaTable.empty(tbody, 'هنوز اعلانی ارسال نشده است');
    if (tbody) {
      tbody.innerHTML = '';
      logs.forEach(l => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><span class="badge ${l.channel === 'in_app' ? 'badge-admin' : 'badge-student'}">${esc(l.channel)}</span></td>
          <td>${esc(l.targetAudience)}</td>
          <td><span style="color: ${l.status === 'success' ? 'var(--success-text)' : 'var(--danger)'}">${l.status === 'success' ? 'موفق' : 'خطا'}</span></td>
          <td class="u-fs-2xs u-c-text-muted">${new Date(l.createdAt).toLocaleString('fa-IR')}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (err) {
    console.error('Notification logs error', err);
    NopaTable.error(tbody, 'خطا در دریافت گزارش ارسال‌ها');
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

// Both composers can target one caravan; their caravan lists were never filled before (Phase 7 fix)
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
  if (ann) ann.innerHTML = '<option value="">همه کاربران (سراسری)</option>' + options;
  const notif = document.getElementById('notif-target-caravan');
  if (notif) notif.innerHTML = caravans.length ? options : '<option value="">کاروانی در دسترس نیست</option>';
  syncNotifAudience();
};

// "کاروان خاص" shows the caravan picker (it stayed hidden before, so no caravan was ever sent)
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
document.getElementById('notification-broadcast-form')?.addEventListener('reset', () => setTimeout(syncNotifAudience, 0));

