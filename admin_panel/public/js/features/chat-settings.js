// مدیریت چت tab. The super admin controls the switch and the channel manager's access;
// a channel manager sees what they may do. Classic script: load order is set in index.html.

window.loadChatSettings = async function() {
  const adminBox = document.getElementById('chat-settings-admin');
  const managerBox = document.getElementById('chat-settings-manager');
  if (!adminBox) return;

  window.loadChatSpaces();
  if (!isSuperAdminUser()) {
    adminBox.style.display = 'none';
    managerBox.style.display = 'block';
    return;
  }

  let data;
  try {
    data = await NopaApi.json('/api/v1/admin/chat-settings');
  } catch (e) {
    showToast(e.message || 'خطا در دریافت تنظیمات چت', 'error');
    return;
  }
  document.querySelectorAll('input[name="chat-mode"]').forEach(r => { r.checked = r.value === data.mode; });
  document.getElementById('chat-pilot-caravans').innerHTML = data.caravans.map(c => `
    <label class="u-flex u-gap-6 u-items-center u-fs-12_5 u-c-text">
      <input type="checkbox" class="chat-pilot-caravan" value="${esc(c.id)}" ${data.pilotCaravanIds.includes(c.id) ? 'checked' : ''}>${esc(c.name)}
    </label>`).join('') || '<div class="u-fs-12_5 u-c-text-muted">هنوز کاروانی ساخته نشده است.</div>';
  document.getElementById('chat-manager-permissions').innerHTML = Object.keys(data.permissionLabels).map(key => `
    <label class="u-flex u-gap-6 u-items-center u-fs-12_5 u-c-text">
      <input type="checkbox" class="chat-manager-permission" value="${esc(key)}" ${data.permissions[key] ? 'checked' : ''}>${esc(data.permissionLabels[key])}
    </label>`).join('');
};

window.saveChatSettings = async function() {
  const checked = selector => Array.from(document.querySelectorAll(`${selector}:checked`)).map(el => el.value);
  const permissions = {};
  document.querySelectorAll('.chat-manager-permission').forEach(el => { permissions[el.value] = el.checked; });
  try {
    await NopaApi.json('/api/v1/admin/chat-settings', {
      method: 'PUT',
      body: JSON.stringify({
        mode: checked('input[name="chat-mode"]')[0],
        pilotCaravanIds: checked('.chat-pilot-caravan'),
        permissions,
      }),
    });
    showToast('تنظیمات چت ذخیره شد و تا چند ثانیه در اپ اعمال می‌شود.', 'success');
    if (window.NopaChatSwitch) NopaChatSwitch.refresh();
  } catch (e) {
    showToast(e.message || 'خطا در ذخیره تنظیمات چت', 'error');
  }
};

const CHAT_SPACE_LABELS = {
  announcements: 'کانال اعلانات', public: 'کانال همگانی', mentors: 'اتاق راهبران',
  caravan: 'گروه کاروان', challenges: 'گروه چالش‌ها', media: 'گروه رسانه‌ای',
};

window.loadChatSpaces = async function() {
  const box = document.getElementById('chat-spaces-list');
  try {
    const spaces = await NopaApi.json('/api/v1/admin/chat-manage/spaces');
    box.innerHTML = spaces.map(s => `
      <div class="u-flex u-gap-6 u-items-center u-mb-5">
        <span class="u-flex-1 u-fs-12_5 u-c-text">${esc(CHAT_SPACE_LABELS[s.type] || s.title)}${s.caravanName ? ` · ${esc(s.caravanName)}` : ''}</span>
        <span class="u-fs-11 u-c-text-muted">${esc(String(s.messageCount))} پیام</span>
        <button type="button" class="btn-action u-p-5-10 u-fs-11 u-pointer" data-click="openChatSpace" data-click-args="${esc(JSON.stringify([String(s.id)]))}">مشاهده</button>
      </div>`).join('') || '<div class="u-fs-12_5 u-c-text-muted">هنوز فضایی ساخته نشده است. فضاها با اولین ورود کاربران به چت ساخته می‌شوند.</div>';
  } catch (e) {
    box.textContent = e.message || 'خطا در دریافت فضاها';
  }
};

window.openChatSpace = async function(spaceId) {
  const box = document.getElementById('chat-space-messages');
  box.dataset.spaceId = spaceId;
  try {
    const messages = await NopaApi.json(`/api/v1/admin/chat-manage/spaces/${spaceId}/messages`);
    box.innerHTML = messages.map(m => `
      <div class="u-flex u-gap-6 u-items-center u-mb-5 u-fs-12_5 u-c-text">
        <span class="u-flex-1">${esc(m.sender ? m.sender.name : 'سیستم')}: ${m.deleted ? 'این پیام حذف شده است' : esc(m.body || 'فایل')}</span>
        ${m.deleted ? '' : `<button type="button" class="btn-action u-p-5-10 u-fs-11 u-pointer" data-click="deleteChatMessage" data-click-args="${esc(JSON.stringify([String(m.id)]))}">حذف</button>`}
        ${m.sender && !m.deleted ? `<button type="button" class="btn-action u-p-5-10 u-fs-11 u-pointer" data-click="muteChatMember" data-click-args="${esc(JSON.stringify([String(spaceId), String(m.sender.id), 60]))}">بی‌صدا</button>` : ''}
      </div>`).join('') || '<div class="u-fs-12_5 u-c-text-muted">پیامی وجود ندارد.</div>';
  } catch (e) {
    showToast(e.message || 'خطا در دریافت پیام‌ها', 'error');
  }
};

window.deleteChatMessage = async function(id) {
  if (!(await NopaConfirm('این پیام برای همه حذف می‌شود. ادامه می‌دهید؟'))) return;
  try {
    await NopaApi.json(`/api/v1/admin/chat-manage/messages/${id}`, { method: 'DELETE' });
    window.openChatSpace(document.getElementById('chat-space-messages').dataset.spaceId);
  } catch (e) {
    showToast(e.message || 'خطا در حذف پیام', 'error');
  }
};

// ---- Header toolbar switch (super admin): the chat state at a glance, switched from any page ----
window.NopaChatSwitch = (function () {
  const MODE_LABELS = { off: 'خاموش', pilot: 'آزمایشی', on: 'روشن' };
  const $ = id => document.getElementById(id);
  let state = null; // last GET /admin/chat-settings
  let busy = false;

  function render() {
    const dot = $('chat-switch-dot');
    const btn = $('btn-chat-switch');
    const note = $('chat-switch-note');
    if (!dot || !btn) return;
    const mode = state ? state.mode : 'unknown';
    dot.dataset.mode = mode;
    const label = state ? `چت: ${MODE_LABELS[mode]}` : 'وضعیت چت';
    btn.setAttribute('aria-label', label);
    btn.title = label;
    document.querySelectorAll('.chat-switch-mode').forEach(b => {
      b.setAttribute('aria-checked', String(!!state && b.dataset.chatMode === mode));
      b.disabled = busy;
    });
    if (!note) return;
    if (!state) { note.textContent = 'وضعیت چت دریافت نشد.'; return; }
    const pilotNames = state.caravans.filter(c => state.pilotCaravanIds.includes(c.id)).map(c => c.name);
    note.textContent = {
      off: 'چت برای هیچ کاربری در اپ نمایش داده نمی‌شود. پیام‌ها پاک نمی‌شوند.',
      pilot: `فقط ادمین‌ها، راهبران، مسئول کانال و ${pilotNames.length.toLocaleString('fa-IR')} کاروان آزمایشی چت را می‌بینند${pilotNames.length ? `: ${pilotNames.join('، ')}` : ''}.`,
      on: 'چت برای همه کاربران اپ فعال است.',
    }[state.mode];
  }

  // Mirror the header state into the radios of the chat tab when it is open
  function syncTabRadios() {
    if (!state) return;
    document.querySelectorAll('input[name="chat-mode"]').forEach(r => { r.checked = r.value === state.mode; });
  }

  async function refresh() {
    if (!(typeof isSuperAdminUser === 'function' && isSuperAdminUser())) return;
    try {
      state = await NopaApi.json('/api/v1/admin/chat-settings');
    } catch (e) {
      state = null;
    }
    render();
  }

  function closeDropdown() {
    const menu = $('chat-switch-menu');
    if (!menu) return;
    menu.classList.remove('is-open');
    $('btn-chat-switch').setAttribute('aria-expanded', 'false');
    $('chat-switch-dropdown').hidden = true;
  }

  function openChatTab(preselectMode) {
    closeDropdown();
    NopaRouter.switchTab('chat-tab', true);
    if (preselectMode) {
      // The tab loads its settings asynchronously; select the mode once they are in
      setTimeout(() => {
        const radio = document.querySelector(`input[name="chat-mode"][value="${preselectMode}"]`);
        if (radio) radio.checked = true;
        const box = $('chat-pilot-caravans');
        if (box) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 600);
    }
  }

  async function setMode(mode) {
    if (busy || !state || state.mode === mode) return;
    if (mode === 'pilot' && state.pilotCaravanIds.length === 0) {
      showToast('برای حالت آزمایشی ابتدا کاروان‌های آزمایشی را انتخاب و ذخیره کنید.', 'info');
      openChatTab('pilot');
      return;
    }
    const question = {
      off: 'چت برای همه کاربران اپ خاموش می‌شود (پیام‌ها پاک نمی‌شوند). ادامه می‌دهید؟',
      pilot: 'چت فقط برای کادر و کاروان‌های آزمایشی نمایش داده می‌شود. ادامه می‌دهید؟',
      on: 'چت برای همه کاربران اپ روشن می‌شود. ادامه می‌دهید؟',
    }[mode];
    if (!(await NopaConfirm(question))) return;
    busy = true;
    render();
    try {
      // The endpoint stores the whole setting: keep the pilot list and the channel manager's access as they are
      await NopaApi.json('/api/v1/admin/chat-settings', {
        method: 'PUT',
        body: JSON.stringify({ mode, pilotCaravanIds: state.pilotCaravanIds, permissions: state.permissions }),
      });
      state = { ...state, mode };
      syncTabRadios();
      showToast(`چت ${MODE_LABELS[mode]} شد و تا چند ثانیه در اپ اعمال می‌شود.`, 'success');
    } catch (e) {
      showToast(e.message || 'خطا در تغییر وضعیت چت', 'error');
      await refresh();
    } finally {
      busy = false;
      render();
    }
  }

  function applyRole() {
    const menu = $('chat-switch-menu');
    if (!menu) return;
    const allowed = typeof isSuperAdminUser === 'function' && isSuperAdminUser();
    menu.hidden = !allowed;
    if (allowed) refresh();
    else closeDropdown();
  }

  function init() {
    const menu = $('chat-switch-menu');
    if (!menu) return;
    menu.querySelectorAll('.chat-switch-mode').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      setMode(b.dataset.chatMode);
    }));
    $('btn-chat-switch-manage').addEventListener('click', () => openChatTab());
    // The generic header-menu toggle (js/layout/topnav.js) opens the dropdown; fetch fresh state on open
    $('btn-chat-switch').addEventListener('click', () => { if (menu.classList.contains('is-open')) refresh(); });
    window.addEventListener('nopa:accesschange', applyRole);
    applyRole();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { refresh };
})();
