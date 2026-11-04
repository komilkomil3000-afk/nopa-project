// Chat icon in the header: a click shows the latest conversations (GET /api/v1/chat/spaces, the same inbox the
// chat tab's messenger reads) with their newest message; a row opens that conversation in the chat tab.
// Shown to everyone whose grants include the chat section. The badge counts unread messages.
// The super admin's chat switch (off / pilot / on) sits under the list (js/features/chat-settings.js).
// Classic script: loaded after js/layout/topnav.js and js/features/chat-messenger.js.
(function () {
  const $ = id => document.getElementById(id);
  const SHOWN = 7;
  const REFRESH_MS = 2 * 60 * 1000;
  const TYPE_LABELS = {
    announcements: 'کانال اعلانات', public: 'کانال همگانی', mentors: 'اتاق راهبران', caravan: 'گروه کاروان',
    challenges: 'گروه چالش‌ها', arena: 'میدان رقابت', mediaqa: 'گروه رسانه', media: 'گروه رسانه‌ای', direct: 'گفتگوی خصوصی', support: 'پشتیبانی نپا',
  };
  const TYPE_ICONS = {
    announcements: 'fa-bullhorn', public: 'fa-globe', mentors: 'fa-user-tie', caravan: 'fa-people-roof', challenges: 'fa-fire',
    arena: 'fa-trophy', mediaqa: 'fa-photo-film', media: 'fa-photo-film', direct: 'fa-user', support: 'fa-headset',
  };
  const fa = n => Number(n || 0).toLocaleString('fa-IR');
  let timer = null;
  let seq = 0;

  const allowed = () => !!(window.NopaNav && NopaNav.sectionAllowed('chat')) && !!(window.NopaAuth && NopaAuth.getToken());

  function when(v) {
    if (!v) return '';
    const d = new Date(v);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    if (now - d < 6 * 864e5) return d.toLocaleDateString('fa-IR', { weekday: 'short' });
    return d.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });
  }

  function badge(unread) {
    const b = $('chat-badge');
    if (!b) return;
    b.hidden = !unread;
    b.textContent = unread > 99 ? '99+' : fa(unread);
  }

  function row(s) {
    const last = s.lastMessage || {};
    const title = s.title || TYPE_LABELS[s.type] || 'گفتگو';
    const text = last.preview ? `${last.senderName ? last.senderName + ': ' : ''}${last.preview}` : 'هنوز پیامی نیست';
    return `<li><button type="button" class="inbox-item chat-recent-item${s.unread ? ' is-unread' : ''}" data-chat-space="${esc(s.id)}">
      <span class="inbox-item-head"><strong><i class="fa-solid ${esc(TYPE_ICONS[s.type] || 'fa-comments')}"></i> ${esc(title)}</strong>
        <span class="chat-recent-meta">${s.unread ? `<b class="chat-recent-count">${esc(fa(s.unread))}</b>` : ''}<time>${esc(when(last.createdAt))}</time></span></span>
      <span class="inbox-item-text">${esc(String(text).slice(0, 140))}</span></button></li>`;
  }

  async function refresh() {
    const list = $('chat-recent-list');
    if (!list || !allowed()) return;
    const mine = ++seq;
    try {
      const spaces = await NopaApi.json('/api/v1/chat/spaces', { silent: true });
      if (mine !== seq) return;
      const rows = (Array.isArray(spaces) ? spaces : [])
        .filter(s => s.lastMessage && s.lastMessage.createdAt)
        .sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));
      badge((Array.isArray(spaces) ? spaces : []).reduce((n, s) => n + (s.muted ? 0 : (s.unread || 0)), 0));
      list.innerHTML = rows.length ? rows.slice(0, SHOWN).map(row).join('') : '<li class="attention-empty">هنوز پیامی در گفتگوها نیست</li>';
    } catch (e) {
      if (mine !== seq) return;
      badge(0);
      const off = e && e.body && e.body.code === 'CHAT_DISABLED';
      list.innerHTML = `<li class="attention-empty">${off ? 'چت برای اپ خاموش است؛ گفتگوها در بخش مدیریت چت دیده می‌شوند' : 'پیام‌های چت دریافت نشد'}</li>`;
    }
  }

  function apply() {
    const menu = $('chat-switch-menu');
    if (!menu) return;
    const on = allowed();
    menu.hidden = !on;
    clearInterval(timer);
    if (!on) return;
    refresh();
    timer = setInterval(() => { if (!document.hidden) refresh(); }, REFRESH_MS);
  }

  function openAll() {
    if (window.NopaNav) NopaNav.closeMenus();
    if (typeof window.loadChatMessenger === 'function') {
      NopaRouter.switchTab('chat-tab', true);
      window.loadChatMessenger();
    } else NopaRouter.switchTab('chat-tab', true);
  }

  function init() {
    const menu = $('chat-switch-menu');
    if (!menu) return;
    menu.addEventListener('nopa:menuopen', refresh);
    $('btn-chat-open-all').addEventListener('click', e => { e.stopPropagation(); openAll(); });
    $('chat-recent-list').addEventListener('click', e => {
      const item = e.target.closest('[data-chat-space]');
      if (!item) return;
      e.stopPropagation();
      if (window.NopaNav) NopaNav.closeMenus();
      if (typeof window.openChatConversation === 'function') window.openChatConversation('space', item.dataset.chatSpace);
      else openAll();
    });
    window.addEventListener('nopa:accesschange', apply);
    apply();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.NopaHeaderChat = { refresh };
})();
