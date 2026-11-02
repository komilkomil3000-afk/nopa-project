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
