// مدیریت چت tab, settings side: the chat switch (header and the mode tile are one control), the pilot caravans and
// the channel manager's access. The super admin changes them; everyone else sees them read-only.
// Classic script: load order is set in index.html.

const chsEl = id => document.getElementById(id);

window.chsCloseModal = function(el) {
  const modal = el && el.closest ? el.closest('.modal-overlay') : chsEl(el);
  if (modal) modal.style.display = 'none';
};

// Search inside a modal's checkbox list
window.chsFilterChecks = function(text, listId) {
  const q = String(text || '').trim();
  chsEl(listId).querySelectorAll('.chs-check').forEach(row => { row.hidden = !!q && !row.textContent.includes(q); });
};

window.loadChatSettings = async function() {
  if (!chsEl('chat-manage-pane')) return;
  await NopaChatSwitch.refresh(true);
};

// The endpoint stores the whole setting: every change sends the mode, the pilot list and the access together
async function saveChatSetting(patch, message) {
  const state = NopaChatSwitch.state();
  if (!state) return false;
  const next = { mode: state.mode, pilotCaravanIds: state.pilotCaravanIds, permissions: state.permissions, ...patch };
  try {
    await NopaApi.json('/api/v1/admin/chat-settings', { method: 'PUT', body: JSON.stringify(next) });
    showToast(message || 'تنظیمات چت ذخیره شد و تا چند ثانیه در اپ اعمال می‌شود.', 'success');
    await NopaChatSwitch.refresh(true);
    return true;
  } catch (e) {
    showToast(e.message || 'خطا در ذخیره تنظیمات چت', 'error');
    return false;
  }
}

function renderChatSettingTiles(state) {
  const admin = isSuperAdminUser();
  document.querySelectorAll('#chs-pilot-tile .chs-edit, #chs-perm-tile .chs-edit').forEach(b => { b.hidden = !admin; });
  chsEl('chs-mode-readonly').hidden = admin;
  if (!state) {
    chsEl('chs-pilot-summary').innerHTML = `<div class="lst-empty">${admin ? 'تنظیمات دریافت نشد.' : 'این تنظیمات را مدیر کل تعیین می‌کند.'}</div>`;
    chsEl('chs-perm-summary').innerHTML = '';
    return;
  }
  const pilots = state.caravans.filter(c => state.pilotCaravanIds.includes(c.id));
  chsEl('chs-pilot-summary').innerHTML = pilots.length
    ? `<div class="chs-chips">${pilots.map(c => `<span class="lst-chip lst-chip-scheduled">${esc(c.name)}</span>`).join('')}</div>`
    : '<div class="lst-empty">هنوز کاروانی انتخاب نشده است. حالت آزمایشی بدون کاروان روشن نمی‌شود.</div>';
  const keys = Object.keys(state.permissionLabels || {});
  const on = keys.filter(k => state.permissions[k]);
  chsEl('chs-perm-summary').innerHTML = `
    <div class="chs-perm-head"><span>${on.length.toLocaleString('fa-IR')} از ${keys.length.toLocaleString('fa-IR')} دسترسی فعال</span></div>
    <div class="lst-bar" aria-hidden="true"><span class="lst-bar-active" data-chs-width="${keys.length ? Math.round((on.length / keys.length) * 100) : 0}"></span></div>
    <ul class="lst-list chs-perm-list">${keys.map(k => `<li class="lst-list-item"><i class="fa-solid ${state.permissions[k] ? 'fa-circle-check u-c-success-text' : 'fa-circle-xmark u-c-text-faint'}"></i><span class="lst-grow">${esc(state.permissionLabels[k])}</span></li>`).join('')}</ul>`;
  chsEl('chs-perm-summary').querySelectorAll('[data-chs-width]').forEach(el => { el.style.width = `${el.dataset.chsWidth}%`; });
}

// ---- pilot caravans modal ----
window.chsOpenPilotModal = function() {
  const state = NopaChatSwitch.state();
  if (!state) return;
  chsEl('chs-pilot-list').innerHTML = state.caravans.map(c => `
    <label class="chs-check"><input type="checkbox" value="${esc(c.id)}" ${state.pilotCaravanIds.includes(c.id) ? 'checked' : ''} data-change="chsCountPilot"><span>${esc(c.name)}</span></label>`).join('')
    || '<div class="lst-empty">هنوز کاروانی ساخته نشده است.</div>';
  window.chsCountPilot();
  NopaModal.open('chs-pilot-modal');
};
window.chsCountPilot = function() {
  const n = chsEl('chs-pilot-list').querySelectorAll('input:checked').length;
  chsEl('chs-pilot-count').innerHTML = `<i class="fa-solid fa-flask"></i> ${n.toLocaleString('fa-IR')} کاروان انتخاب شده`;
};
window.chsSavePilot = async function(event) {
  event.preventDefault();
  const ids = Array.from(chsEl('chs-pilot-list').querySelectorAll('input:checked')).map(el => el.value);
  const state = NopaChatSwitch.state();
  if (state && state.mode === 'pilot' && !ids.length) { showToast('در حالت آزمایشی دست‌کم یک کاروان لازم است.', 'info'); return; }
  if (await saveChatSetting({ pilotCaravanIds: ids }, 'کاروان‌های آزمایشی ذخیره شدند.')) window.chsCloseModal('chs-pilot-modal');
};

// ---- channel manager access modal ----
window.chsOpenPermModal = function() {
  const state = NopaChatSwitch.state();
  if (!state) return;
  chsEl('chs-perm-list').innerHTML = Object.keys(state.permissionLabels).map(key => `
    <label class="chs-check"><span>${esc(state.permissionLabels[key])}</span><input type="checkbox" class="chs-switch" value="${esc(key)}" ${state.permissions[key] ? 'checked' : ''}></label>`).join('');
  NopaModal.open('chs-perm-modal');
};
window.chsSavePerms = async function(event) {
  event.preventDefault();
  const permissions = {};
  chsEl('chs-perm-list').querySelectorAll('input').forEach(el => { permissions[el.value] = el.checked; });
  if (await saveChatSetting({ permissions }, 'دسترسی مسئول کانال ذخیره شد.')) window.chsCloseModal('chs-perm-modal');
};

// ---- the chat switch: header dropdown and the mode tile, one state ----
window.NopaChatSwitch = (function () {
  const MODE_LABELS = { off: 'خاموش', pilot: 'آزمایشی', on: 'روشن' };
  const $ = id => document.getElementById(id);
  let state = null; // last GET /admin/chat-settings
  let busy = false;

  function note() {
    if (!state) return 'وضعیت چت دریافت نشد.';
    const pilotNames = state.caravans.filter(c => state.pilotCaravanIds.includes(c.id)).map(c => c.name);
    return {
      off: 'چت برای هیچ کاربری در اپ نمایش داده نمی‌شود. پیام‌ها پاک نمی‌شوند.',
      pilot: `فقط ادمین‌ها، راهبران، مسئول کانال و ${pilotNames.length.toLocaleString('fa-IR')} کاروان آزمایشی چت را می‌بینند${pilotNames.length ? `: ${pilotNames.join('، ')}` : ''}.`,
      on: 'چت برای همه کاربران اپ فعال است.',
    }[state.mode];
  }

  function render() {
    const mode = state ? state.mode : 'unknown';
    const admin = typeof isSuperAdminUser === 'function' && isSuperAdminUser();
    const dot = $('chat-switch-dot');
    const btn = $('btn-chat-switch');
    if (dot && btn) {
      dot.dataset.mode = mode;
      // the button opens the latest messages (js/layout/header-chat.js); the dot tells the super admin the mode
      btn.title = state ? `چت · ${MODE_LABELS[mode]}` : 'چت';
    }
    document.querySelectorAll('.chat-switch-mode, .chs-mode').forEach(b => {
      b.setAttribute('aria-checked', String(!!state && (b.dataset.chatMode || b.dataset.chsMode) === mode));
      b.disabled = busy || !admin;
    });
    if ($('chat-switch-note')) $('chat-switch-note').textContent = note();
    if ($('chs-mode-note')) $('chs-mode-note').textContent = state ? note() : (admin ? 'وضعیت چت دریافت نشد.' : 'وضعیت چت را مدیر کل تعیین می‌کند.');
    if ($('chs-mode-tile')) renderChatSettingTiles(state);
  }

  async function refresh(force) {
    if (!(typeof isSuperAdminUser === 'function' && isSuperAdminUser())) { state = null; render(); return; }
    if (state && !force) { render(); return; }
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

  function openChatTab(thenPilot) {
    closeDropdown();
    NopaRouter.switchTab('chat-tab', true);
    const manage = document.querySelector('.chm-view[data-chm-view="manage"]');
    if (manage) manage.click();
    if (thenPilot) setTimeout(() => window.chsOpenPilotModal(), 400);
  }

  async function setMode(mode) {
    if (busy || !state || state.mode === mode) return;
    if (mode === 'pilot' && state.pilotCaravanIds.length === 0) {
      showToast('برای حالت آزمایشی ابتدا کاروان‌های آزمایشی را انتخاب و ذخیره کنید.', 'info');
      openChatTab(true);
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
      await NopaApi.json('/api/v1/admin/chat-settings', {
        method: 'PUT',
        body: JSON.stringify({ mode, pilotCaravanIds: state.pilotCaravanIds, permissions: state.permissions }),
      });
      state = { ...state, mode };
      showToast(`چت ${MODE_LABELS[mode]} شد و تا چند ثانیه در اپ اعمال می‌شود.`, 'success');
    } catch (e) {
      showToast(e.message || 'خطا در تغییر وضعیت چت', 'error');
      await refresh(true);
    } finally {
      busy = false;
      render();
    }
  }

  // The header chat menu itself (latest messages) belongs to js/layout/header-chat.js; only its switch block
  // and the status dot on the button are the super admin's
  function applyRole() {
    const allowed = typeof isSuperAdminUser === 'function' && isSuperAdminUser();
    const block = $('chat-switch-block');
    if (block) block.hidden = !allowed;
    const dot = $('chat-switch-dot');
    if (dot) dot.hidden = !allowed;
    if (allowed) refresh(true);
    else render();
  }

  function init() {
    document.querySelectorAll('.chat-switch-mode').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      setMode(b.dataset.chatMode);
    }));
    document.querySelectorAll('.chs-mode').forEach(b => b.addEventListener('click', () => setMode(b.dataset.chsMode)));
    const menu = $('chat-switch-menu');
    if (menu) {
      $('btn-chat-switch-manage').addEventListener('click', () => openChatTab());
      // The generic header-menu toggle (js/layout/topnav.js) opens the dropdown; fetch fresh state on open
      $('btn-chat-switch').addEventListener('click', () => { if (menu.classList.contains('is-open')) refresh(true); });
    }
    window.addEventListener('nopa:accesschange', applyRole);
    applyRole();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { refresh, state: () => state, setMode };
})();
