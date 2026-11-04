// The signed-in person's own messages (Notification rows: chat messages, ticket replies, staff messages...).
// Polls GET /api/v1/notifications/inbox and announces each new message once:
//   - system notification (via the service worker) when the person allowed notifications;
//   - otherwise, on desktop only, a card at the top left of the page: at most the 3 newest, hidden after a few
//     seconds, while the bell's badge (js/layout/topnav.js) keeps counting them until they are read.
// Loaded before js/layout/topnav.js.
//   NopaInbox.start() / refresh() / markRead(id) / markAllRead()
//   NopaInbox.state -> { unread, items }       NopaInbox.onChange(fn)
//   NopaInbox.permission() -> 'granted' | 'denied' | 'default' | 'unsupported'    NopaInbox.askPermission()
(function () {
  const URL_INBOX = '/api/v1/notifications/inbox';
  const POLL_MS = 30 * 1000;
  const POPUP_MS = 7000;
  const POPUP_MAX = 3;
  const SYSTEM_MAX = 5;  // one poll never floods the system tray
  const DESKTOP = '(min-width: 768px)';
  const ICON = '/admin/icons/icon-192.png';

  const state = { unread: 0, items: [] };
  const listeners = [];
  let timer = null;
  let busy = false;

  // The newest message already announced, per user: a reload announces only what arrived meanwhile
  const seenKey = () => 'nopa_inbox_seen_' + (NopaAuth.getUser().id || 'me');
  function readSeen() { try { return localStorage.getItem(seenKey()); } catch (_) { return null; } }
  function writeSeen(v) { try { localStorage.setItem(seenKey(), v); } catch (_) { /* storage blocked */ } }

  const supported = () => 'Notification' in window;
  const permission = () => (supported() ? Notification.permission : 'unsupported');

  function emit() { listeners.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } }); }

  async function refresh() {
    if (busy || !NopaAuth.getToken()) return;
    busy = true;
    try {
      const res = await request(URL_INBOX, { silent: true });
      if (!res.ok) return;
      const data = await res.json();
      state.unread = data.unreadCount || 0;
      state.items = Array.isArray(data.items) ? data.items : [];
      announce(state.items);
      emit();
    } catch (_) { /* offline or signed out: the next poll tries again */ } finally {
      busy = false;
    }
  }

  function announce(items) {
    const newest = items[0] && items[0].createdAt;
    const seen = readSeen();
    if (!newest) { if (!seen) writeSeen(new Date(0).toISOString()); return; } // empty inbox: the first message is news
    writeSeen(newest);
    if (!seen) return; // first visit: what is already there is not news
    const fresh = items.filter(n => !n.isRead && new Date(n.createdAt) > new Date(seen));
    if (!fresh.length) return;
    if (permission() === 'granted') fresh.slice(0, SYSTEM_MAX).forEach(showSystem);
    else if (window.matchMedia(DESKTOP).matches) fresh.slice(0, POPUP_MAX).reverse().forEach(showPopup);
  }

  // ---- system notification --------------------------------------------------------------------
  async function showSystem(n) {
    const opts = { body: n.message || '', icon: ICON, badge: ICON, tag: 'nopa-' + n.id, lang: 'fa', dir: 'rtl', data: { id: n.id } };
    try {
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration('/admin/') : null;
      if (reg) { await reg.showNotification(n.title || 'نپا', opts); return; }
      const shown = new Notification(n.title || 'نپا', opts);
      shown.onclick = () => { window.focus(); openBell(); shown.close(); };
    } catch (_) {
      if (window.matchMedia(DESKTOP).matches) showPopup(n); // the browser refused: fall back to the page
    }
  }

  function askPermission() {
    if (!supported() || Notification.permission !== 'default') return Promise.resolve(permission());
    return Promise.resolve(Notification.requestPermission()).then(p => { emit(); return p; });
  }

  // ---- in-page card (top left, desktop) -------------------------------------------------------
  function container() {
    let c = document.getElementById('nopa-inbox-popups');
    if (!c) {
      c = document.createElement('div');
      c.id = 'nopa-inbox-popups';
      c.setAttribute('aria-live', 'polite');
      document.body.appendChild(c);
    }
    return c;
  }

  function hidePopup(el) {
    if (!el || el.dataset.closing) return;
    el.dataset.closing = '1';
    clearTimeout(el._timer);
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }

  function showPopup(n) {
    const box = container();
    while (box.children.length >= POPUP_MAX) { clearTimeout(box.firstChild._timer); box.firstChild.remove(); }

    const el = document.createElement('div');
    el.className = 'nopa-toast nopa-toast-info inbox-popup';
    el.setAttribute('role', 'status');
    el.innerHTML = `<i class="fa-solid fa-bell nopa-toast-icon"></i>
      <div class="nopa-toast-body"><strong></strong><span></span></div>
      <button type="button" class="nopa-toast-close" aria-label="بستن">&times;</button>
      <div class="nopa-toast-progress"></div>`;
    el.querySelector('strong').textContent = n.title || 'پیام جدید';
    el.querySelector('span').textContent = n.message || '';
    el.querySelector('.nopa-toast-progress').style.animationDuration = POPUP_MS + 'ms';
    el.querySelector('.nopa-toast-close').addEventListener('click', e => { e.stopPropagation(); hidePopup(el); });
    el.addEventListener('click', e => { e.stopPropagation(); hidePopup(el); openBell(); }); // a click outside the menu would close it again
    box.appendChild(el);

    // Pause while hovered, like the bottom-left toasts
    const bar = el.querySelector('.nopa-toast-progress');
    let remaining = POPUP_MS, startedAt;
    const start = () => { startedAt = Date.now(); el._timer = setTimeout(() => hidePopup(el), remaining); bar.style.animationPlayState = 'running'; };
    el.addEventListener('mouseenter', () => { clearTimeout(el._timer); remaining -= Date.now() - startedAt; bar.style.animationPlayState = 'paused'; });
    el.addEventListener('mouseleave', start);
    requestAnimationFrame(() => el.classList.add('show'));
    start();
  }

  function openBell() {
    const btn = document.getElementById('btn-attention');
    const menu = document.getElementById('attention-menu');
    if (btn && menu && !menu.classList.contains('is-open')) btn.click();
  }

  // ---- read state ------------------------------------------------------------------------------
  async function markRead(id) {
    const n = state.items.find(x => x.id === id);
    if (!n || n.isRead) return;
    n.isRead = true;
    state.unread = Math.max(0, state.unread - 1);
    emit();
    try { await request(`/api/v1/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH', silent: true }); } catch (_) { /* next poll corrects it */ }
  }

  async function markAllRead() {
    state.items.forEach(n => { n.isRead = true; });
    state.unread = 0;
    emit();
    try { await request(URL_INBOX + '/read', { method: 'POST', silent: true }); } catch (_) { /* next poll corrects it */ }
  }

  function start() {
    clearInterval(timer);
    refresh();
    timer = setInterval(() => { if (!document.hidden || permission() === 'granted') refresh(); }, POLL_MS);
  }

  // A click on a system notification (sw.js) brings the panel forward with the bell open
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.type === 'nopa:open-inbox') openBell(); });
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && timer) refresh(); });

  window.NopaInbox = {
    state, start, refresh, markRead, markAllRead, permission, askPermission,
    onChange: fn => listeners.push(fn),
  };
})();
