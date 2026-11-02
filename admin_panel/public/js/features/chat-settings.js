// مدیریت چت tab. The super admin controls the switch and the channel manager's access;
// a channel manager sees what they may do. Classic script: load order is set in index.html.

window.loadChatSettings = async function() {
  const adminBox = document.getElementById('chat-settings-admin');
  const managerBox = document.getElementById('chat-settings-manager');
  if (!adminBox) return;

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
  } catch (e) {
    showToast(e.message || 'خطا در ذخیره تنظیمات چت', 'error');
  }
};
