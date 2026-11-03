// Messenger in the chat tab: the staff's own view of the same chat the app has - inbox, conversation, replies,
// reactions, pins, search, files, scheduled posts, private conversations and the support queue.
// It talks to /api/v1/chat (as the signed-in staff member). When chat is switched off for the app those calls are
// refused (CHAT_DISABLED): the panel then falls back to /admin/chat-manage (read, delete, publish).
// Classic script: load order is set in index.html.
(function () {
  const $ = id => document.getElementById(id);
  const CHAT = '/api/v1/chat';
  const MANAGE = '/api/v1/admin/chat-manage';
  const POLL_MS = 6000;
  const PAGE = 40;

  const TYPE_LABELS = {
    announcements: 'کانال اعلانات', public: 'کانال همگانی', mentors: 'اتاق راهبران', caravan: 'گروه کاروان',
    challenges: 'گروه چالش‌ها', arena: 'میدان رقابت', media: 'گروه رسانه‌ای', direct: 'گفتگوی خصوصی', support: 'پشتیبانی نپا',
  };
  const TYPE_ICONS = {
    announcements: 'fa-bullhorn', public: 'fa-globe', mentors: 'fa-user-tie', caravan: 'fa-people-roof', challenges: 'fa-fire',
    arena: 'fa-trophy', media: 'fa-photo-film', direct: 'fa-user', support: 'fa-headset',
  };
  const FILTERS = [
    { key: 'all', label: 'همه', types: null },
    { key: 'challenges', label: 'چالش‌ها', types: ['challenges', 'arena'] },
    { key: 'personal', label: 'شخصی', types: ['direct', 'support'] },
    { key: 'gathering', label: 'دورهمی', types: ['caravan', 'mentors', 'media'] },
    { key: 'academy', label: 'آموزگاه', types: ['announcements', 'public'] },
    { key: 'cases', label: 'پرونده‌های پشتیبانی', types: null },
  ];
  const REACTIONS = {
    bravo: ['fa-wand-magic-sparkles', 'آفرین'], agree: ['fa-circle-check', 'موافقم'], idea: ['fa-lightbulb', 'ایده‌ی خوب'],
    question: ['fa-circle-question', 'سؤال دارم'], confused: ['fa-face-confused', 'متوجه نشدم'],
  };
  const CASE_STATUS = { open: 'باز', reviewing: 'در بررسی', resolved: 'حل‌شده' };
  const ROLE_LABELS = { admin: 'مدیر', sub_admin: 'ادمین', mentor: 'راهبر', super_mentor: 'راهبر ارشد', channel_manager: 'مسئول کانال' };

  const st = {
    inited: false, manage: false, spaces: [], cases: [], filter: 'all', text: '',
    active: null,        // { kind: 'space' | 'case', id, meta }
    messages: [], hasOlder: false, reply: null, edit: null, files: [], sending: false,
    timer: null, inboxTimer: null, loadingToken: 0, stickBottom: true, unseen: 0, templates: null, signature: '',
  };

  const api = (url, opts) => NopaApi.json(url, opts);
  const post = (url, body) => api(url, { method: 'POST', body: JSON.stringify(body || {}) });
  const me = () => (window.NopaAuth && NopaAuth.getUser && NopaAuth.getUser()) || {};
  const initial = name => String(name || '؟').trim().charAt(0) || '؟';
  const fa = n => Number(n).toLocaleString('fa-IR');
  const tabVisible = () => { const t = $('chat-tab'); return !!t && t.style.display !== 'none' && !$('chat-messenger').hidden && document.visibilityState === 'visible'; };

  function timeLabel(v) {
    if (!v) return '';
    const d = new Date(v);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    if (now - d < 6 * 864e5) return d.toLocaleDateString('fa-IR', { weekday: 'short' });
    return d.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });
  }
  const dayLabel = v => new Date(v).toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' });
  const clock = v => new Date(v).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

  function avatar(person, fallbackIcon, cls) {
    const gold = person && /mentor|admin|channel/i.test(person.role || '') ? ' is-gold' : '';
    if (person && person.avatarUrl) return `<span class="chm-avatar${gold}${cls || ''}"><img src="${esc(person.avatarUrl)}" alt="" loading="lazy"></span>`;
    if (!person && fallbackIcon) return `<span class="chm-avatar is-gold${cls || ''}"><i class="fa-solid ${fallbackIcon}"></i></span>`;
    return `<span class="chm-avatar${gold}${cls || ''}">${esc(initial(person && person.name))}</span>`;
  }

  // ---------- skeletons (the shimmer of the stations / challenges tabs) ----------
  function rowSkeleton(n) {
    return Array.from({ length: n }, () => `
      <div class="chm-row chm-skel" aria-hidden="true"><span class="chm-skel-avatar"></span>
        <span class="chm-skel-body"><span class="lst-skel-line chl-skel-title"></span><span class="lst-skel-line lst-skel-short"></span></span></div>`).join('');
  }
  function streamSkeleton() {
    return `<div class="chm-skel chm-skel-stream" aria-hidden="true">
      <div class="chm-skel-bubble is-other"></div><div class="chm-skel-bubble is-mine"></div>
      <div class="chm-skel-bubble is-other is-tall"></div><div class="chm-skel-bubble is-mine"></div><div class="chm-skel-bubble is-other"></div></div>`;
  }

  // ---------- inbox ----------
  function spaceTitle(s) { return s.title || TYPE_LABELS[s.type] || 'گفتگو'; }

  function filteredSpaces() {
    const f = FILTERS.find(x => x.key === st.filter);
    const q = st.text.trim();
    return st.spaces.filter(s => (!f || !f.types || f.types.includes(s.type)) && (!q || spaceTitle(s).includes(q) || (s.caravanName || '').includes(q)));
  }

  function renderChips() {
    const unreadOf = f => st.spaces.filter(s => f.types && f.types.includes(s.type)).reduce((a, s) => a + (s.unread || 0), 0);
    $('chm-chips').innerHTML = FILTERS.filter(f => f.key !== 'cases' || st.cases !== null).map(f => {
      const n = f.key === 'cases' ? st.cases.filter(c => c.status !== 'resolved').length : unreadOf(f);
      return `<button type="button" class="chm-chip${f.key === st.filter ? ' is-active' : ''}" role="tab" aria-selected="${f.key === st.filter}" data-filter="${f.key}">${esc(f.label)}${n ? `<span class="chm-chip-count">${esc(fa(n))}</span>` : ''}</button>`;
    }).join('');
  }

  function spaceRow(s) {
    const last = s.lastMessage;
    const active = st.active && st.active.kind === 'space' && st.active.id === s.id;
    const person = s.peer || null;
    const preview = last ? `${last.senderName ? `${esc(last.senderName)}: ` : ''}${esc(last.preview || '')}` : 'هنوز پیامی نیست';
    return `<button type="button" class="chm-row${active ? ' is-active' : ''}" data-space="${esc(s.id)}">
      ${person ? avatar(person, null, person.online ? ' chm-online' : '') : avatar(null, TYPE_ICONS[s.type] || 'fa-comments')}
      <span class="chm-row-body">
        <span class="chm-row-top"><span class="chm-row-title">${esc(spaceTitle(s))}</span><span class="chm-row-time">${esc(last ? timeLabel(last.createdAt) : '')}</span></span>
        <span class="chm-row-bottom"><span class="chm-row-preview">${preview}</span>
          ${s.unread ? `<span class="chm-badge${s.muted ? ' is-muted' : ''}">${esc(fa(s.unread))}</span>` : (s.muted ? '<i class="fa-solid fa-bell-slash chm-row-time"></i>' : '')}</span>
      </span></button>`;
  }

  function caseRow(c) {
    const active = st.active && st.active.kind === 'case' && st.active.id === c.id;
    return `<button type="button" class="chm-row${active ? ' is-active' : ''}" data-case="${esc(c.id)}">
      ${avatar(c.user, 'fa-headset')}
      <span class="chm-row-body">
        <span class="chm-row-top"><span class="chm-row-title">${esc(c.user ? c.user.name : 'کاربر')}</span><span class="chm-row-time">${esc(timeLabel(c.createdAt))}</span></span>
        <span class="chm-row-bottom"><span class="chm-row-preview">${esc(c.subject || '')}</span>
          <span class="chm-mini-chip is-${esc(c.status)}">${esc(CASE_STATUS[c.status] || c.status)}</span></span>
      </span></button>`;
  }

  function renderList() {
    renderChips();
    const box = $('chm-list');
    if (st.filter === 'cases') {
      const q = st.text.trim();
      const rows = st.cases.filter(c => !q || (c.user && c.user.name.includes(q)) || (c.subject || '').includes(q));
      box.innerHTML = rows.map(caseRow).join('') || '<div class="chm-state">پرونده‌ای وجود ندارد.</div>';
      return;
    }
    const rows = filteredSpaces();
    box.innerHTML = rows.map(spaceRow).join('') || `<div class="chm-state">${st.spaces.length ? 'گفتگویی با این فیلتر پیدا نشد.' : 'هنوز گفتگویی ساخته نشده است. فضاها با اولین ورود کاربران به چت ساخته می‌شوند.'}</div>`;
  }

  async function loadInbox(quiet) {
    if (!quiet) { $('chm-list').innerHTML = rowSkeleton(6); }
    try {
      let spaces;
      try {
        spaces = await api(`${CHAT}/spaces`);
        st.manage = false;
      } catch (e) {
        if (!(e.body && e.body.code === 'CHAT_DISABLED') && e.status !== 403 && e.status !== 404) throw e;
        const managed = await api(`${MANAGE}/spaces`);
        st.manage = true;
        spaces = managed.map(s => ({
          id: s.id, type: s.type, title: s.caravanName ? `${TYPE_LABELS[s.type] || s.title} · ${s.caravanName}` : (TYPE_LABELS[s.type] || s.title),
          lastSeq: s.messageCount, unread: 0, canPost: true, canReply: true, canModerate: true, lastMessage: null,
        }));
      }
      spaces.sort((a, b) => new Date((b.lastMessage || {}).createdAt || 0) - new Date((a.lastMessage || {}).createdAt || 0));
      st.spaces = spaces;
      $('chm-live').className = `chm-live ${st.manage ? 'is-off' : 'is-on'}`;
      $('chm-live').title = st.manage ? 'چت برای اپ خاموش است؛ فقط مشاهده، حذف و انتشار' : 'متصل';
      $('chm-new-direct').hidden = st.manage;
    } catch (e) {
      if (!quiet) $('chm-list').innerHTML = `<div class="chm-state">${esc(e.message || 'خطا در دریافت گفتگوها')}</div>`;
      return;
    }
    try {
      st.cases = await api('/api/v1/admin/support-cases');
    } catch (e) {
      st.cases = [];
    }
    if (st.filter === 'cases' && !st.cases.length && !st.spaces.length) st.filter = 'all';
    renderList();
  }

  // ---------- conversation ----------
  const curSpace = () => (st.active && st.active.kind === 'space' ? st.spaces.find(s => s.id === st.active.id) : null);
  const isCase = () => !!st.active && st.active.kind === 'case';

  function setState(state) { $('chat-messenger').dataset.state = state; }

  function setHead() {
    const a = st.active;
    if (!a) return;
    const tools = $('chm-case-tools');
    tools.hidden = !isCase();
    $('chm-pins-toggle').hidden = isCase() || st.manage;
    $('chm-mute-toggle').hidden = isCase() || st.manage;
    $('chm-search-toggle').hidden = isCase() || st.manage;
    if (isCase()) {
      const c = a.meta;
      $('chm-head-avatar').outerHTML = avatar(c.user, 'fa-headset').replace('class="chm-avatar', 'id="chm-head-avatar" class="chm-avatar');
      $('chm-head-title').textContent = c.user ? c.user.name : 'پرونده';
      $('chm-head-sub').textContent = `${c.subject || ''} · ${c.category || ''} · ${CASE_STATUS[c.status] || c.status}${c.assigneeName ? ` · ${c.assigneeName}` : ''}`;
      $('chm-case-claim').disabled = c.status === 'resolved';
      $('chm-case-resolve').disabled = c.status === 'resolved';
    } else {
      const s = a.meta;
      $('chm-head-avatar').outerHTML = (s.peer ? avatar(s.peer) : avatar(null, TYPE_ICONS[s.type] || 'fa-comments')).replace('class="chm-avatar', 'id="chm-head-avatar" class="chm-avatar');
      $('chm-head-title').textContent = spaceTitle(s);
      $('chm-head-sub').textContent = s.peer ? (s.peer.online ? 'آنلاین' : (ROLE_LABELS[String(s.peer.role).toLowerCase()] || 'کاربر')) : (TYPE_LABELS[s.type] || '');
      $('chm-mute-toggle').classList.toggle('is-on', !!s.muted);
      $('chm-mute-toggle').firstElementChild.className = s.muted ? 'fa-solid fa-bell-slash' : 'fa-solid fa-bell';
    }
    updateComposerAccess();
  }

  function updateComposerAccess() {
    const notice = $('chm-notice');
    const input = $('chm-input');
    let reason = '';
    if (isCase()) { if (st.active.meta.status === 'resolved') reason = 'این پرونده بسته شده است.'; }
    else {
      const s = curSpace();
      if (s && !st.manage && !s.canPost && !s.canReply) reason = 'در این گفتگو فقط می‌توانید بخوانید.';
    }
    notice.hidden = !reason;
    notice.textContent = reason;
    const off = !!reason;
    $('chm-composer').hidden = off;
    input.disabled = off;
    // Scheduling and templates are for channels and groups, not for private conversations or a support case
    const s = curSpace();
    const channel = !isCase() && s && !['direct', 'support'].includes(s.type);
    $('chm-sched-toggle').hidden = !channel;
    $('chm-templates').hidden = isCase() ? false : !channel;
    if (!channel) clearSchedule();
  }

  function messageHtml(m, prev) {
    const mine = !!(m.sender && m.sender.id === me().id);
    const system = !m.sender || m.botKey;
    const sameAuthor = prev && prev.sender && m.sender && prev.sender.id === m.sender.id && !prev.deleted;
    const cls = ['chm-msg', system && !m.sender ? 'is-system' : (mine ? 'is-mine' : 'is-other'), m.botKey ? 'is-bot' : '', m.deleted ? 'is-deleted' : '', m.best ? 'is-best' : '', sameAuthor ? '' : 'is-first'].filter(Boolean).join(' ');
    if (!m.sender && !m.botKey && m.kind !== 'card') {
      return `<div class="${cls}" data-id="${esc(m.id)}"><span class="chm-system">${esc(m.body || '')}</span></div>`;
    }
    const role = m.sender ? ROLE_LABELS[String(m.sender.role).toLowerCase()] : '';
    const att = (m.attachments || []).map(a => {
      if (a.kind === 'image') return `<img src="${esc(a.url)}" alt="${esc(a.name)}" loading="lazy" data-zoom="${esc(a.url)}">`;
      if (a.kind === 'audio') return `<audio controls preload="none" src="${esc(a.url)}"></audio>`;
      if (a.kind === 'video') return `<video controls preload="none" src="${esc(a.url)}"></video>`;
      return `<a class="chm-file" href="${esc(a.url)}" target="_blank" rel="noopener"><i class="fa-solid fa-file-arrow-down"></i>${esc(a.name)}</a>`;
    }).join('');
    const poll = m.kind === 'poll' && m.meta && Array.isArray(m.meta.options)
      ? `<div class="chm-poll">${m.meta.options.map((o, i) => `<span class="chm-poll-opt">${esc(typeof o === 'string' ? o : (o.text || ''))} · ${esc(fa((m.pollVotes || []).filter(v => v.option === i).length))}</span>`).join('')}</div>` : '';
    const grouped = {};
    (m.reactions || []).forEach(r => { (grouped[r.type] = grouped[r.type] || []).push(r.userId); });
    const reactions = Object.keys(grouped).map(type => `<button type="button" class="chm-react-chip${grouped[type].includes(me().id) ? ' is-mine' : ''}" data-react="${esc(type)}" data-mid="${esc(m.id)}" title="${esc((REACTIONS[type] || [])[1] || type)}"><i class="fa-solid ${(REACTIONS[type] || ['fa-face-smile'])[0]}"></i>${esc(fa(grouped[type].length))}</button>`).join('');
    const reply = m.replyTo ? `<button type="button" class="chm-reply" data-goto="${esc(m.replyTo.id)}"><b>${esc(m.replyTo.senderName)}</b><span>${esc(m.replyTo.body || 'پیام حذف شده')}</span></button>` : '';
    const body = m.deleted
      ? '<p class="chm-text is-deleted">این پیام حذف شده است</p>'
      : (m.body ? `<p class="chm-text">${esc(m.body)}</p>` : '');
    const showName = !mine && !sameAuthor && m.sender;
    return `<div class="${cls}" data-id="${esc(m.id)}">
      ${!mine && !system && m.sender ? (sameAuthor ? '<span class="chm-avatar is-sm chm-ghost" aria-hidden="true"></span>' : avatar(m.sender, null, ' is-sm')) : ''}
      <div class="chm-bubble">
        ${showName ? `<div class="chm-sender">${esc(m.sender.name)}${role ? `<span class="chm-role">${esc(role)}</span>` : ''}</div>` : ''}
        ${m.botKey ? '<div class="chm-sender"><i class="fa-solid fa-robot"></i>ربات نپا</div>' : ''}
        ${reply}${att ? `<div class="chm-att">${att}</div>` : ''}${body}${poll}
        ${reactions ? `<div class="chm-react">${reactions}</div>` : ''}
        <div class="chm-meta">${m.pinned ? '<i class="fa-solid fa-thumbtack"></i>' : ''}${m.edited ? '<span>ویرایش‌شده</span>' : ''}<span>${esc(clock(m.createdAt))}</span></div>
      </div>
      ${m.deleted || isCase() ? '' : `<button type="button" class="chm-more" data-more="${esc(m.id)}" aria-label="گزینه‌های پیام" aria-haspopup="menu"><i class="fa-solid fa-ellipsis"></i></button>`}
    </div>`;
  }

  function renderStream(opts) {
    opts = opts || {};
    const box = $('chm-stream');
    const prevTop = box.scrollHeight - box.scrollTop;
    let html = st.hasOlder ? '<button type="button" class="chm-pill-btn chm-older" id="chm-older"><i class="fa-solid fa-arrow-up"></i>پیام‌های قدیمی‌تر</button>' : '';
    let lastDay = '';
    st.messages.forEach((m, i) => {
      const day = new Date(m.createdAt).toDateString();
      if (day !== lastDay) { html += `<div class="chm-day">${esc(dayLabel(m.createdAt))}</div>`; lastDay = day; }
      html += messageHtml(m, day === (i && new Date(st.messages[i - 1].createdAt).toDateString()) ? st.messages[i - 1] : null);
    });
    box.innerHTML = html || '<div class="chm-state">هنوز پیامی ارسال نشده است.</div>';
    if (opts.keepOffset) box.scrollTop = box.scrollHeight - prevTop;
    else if (opts.bottom || st.stickBottom) {
      box.scrollTop = box.scrollHeight;
      requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; updateJump(); });
    }
    const pins = st.messages.filter(m => m.pinned && !m.deleted);
    const bar = $('chm-pinbar');
    bar.hidden = !pins.length;
    if (pins.length) { $('chm-pinbar-text').textContent = pins[pins.length - 1].body || 'فایل'; bar.dataset.goto = pins[pins.length - 1].id; }
    updateJump();
  }

  function updateJump() {
    const box = $('chm-stream');
    const away = box.scrollHeight - box.scrollTop - box.clientHeight > 160;
    st.stickBottom = !away;
    if (!away) st.unseen = 0;
    $('chm-jump').hidden = !away;
    $('chm-jump-count').textContent = st.unseen ? fa(st.unseen) : '';
  }

  const signatureOf = list => list.map(m => `${m.id}|${m.deleted ? 1 : 0}|${m.edited ? 1 : 0}|${m.pinned ? 1 : 0}|${(m.reactions || []).length}|${m.threadReplies || 0}`).join(',');

  async function fetchMessages(beforeSeq) {
    const a = st.active;
    if (a.kind === 'case') {
      return { list: await api(`/api/v1/admin/support-cases/${a.id}/messages`), more: false };
    }
    if (st.manage) {
      const rows = await api(`${MANAGE}/spaces/${a.id}/messages`);
      return { list: rows.slice().reverse(), more: false };
    }
    const data = await api(`${CHAT}/spaces/${a.id}/messages${beforeSeq ? `?beforeSeq=${beforeSeq}` : ''}`);
    return { list: data.messages, more: data.messages.length >= PAGE };
  }

  async function openConversation(kind, id) {
    const meta = kind === 'case' ? st.cases.find(c => c.id === id) : st.spaces.find(s => s.id === id);
    if (!meta) return;
    st.active = { kind, id, meta };
    st.reply = null; st.edit = null; st.files = []; st.messages = []; st.hasOlder = false; st.stickBottom = true; st.unseen = 0; st.signature = '';
    const token = ++st.loadingToken;
    closeMenu();
    $('chm-empty').hidden = true;
    $('chm-conv').hidden = false;
    $('chm-searchbar').hidden = true;
    $('chm-search-text').value = '';
    $('chm-input').value = '';
    autosize();
    renderContext(); renderFiles();
    setState('conv');
    setHead();
    renderList();
    $('chm-stream').innerHTML = streamSkeleton();
    try {
      const { list, more } = await fetchMessages();
      if (token !== st.loadingToken) return;
      st.messages = list; st.hasOlder = more; st.signature = signatureOf(list);
      renderStream({ bottom: true });
      markRead();
    } catch (e) {
      if (token !== st.loadingToken) return;
      $('chm-stream').innerHTML = `<div class="chm-state">${esc(e.message || 'خطا در دریافت پیام‌ها')}</div>`;
    }
    startPolling();
  }

  async function loadOlder() {
    const first = st.messages[0];
    if (!first || isCase()) return;
    const btn = $('chm-older');
    if (btn) btn.disabled = true;
    try {
      const { list, more } = await fetchMessages(first.seq);
      const known = new Set(st.messages.map(m => m.id));
      st.messages = list.filter(m => !known.has(m.id)).concat(st.messages);
      st.hasOlder = more;
      renderStream({ keepOffset: true });
    } catch (e) {
      showToast(e.message || 'خطا در دریافت پیام‌های قدیمی', 'error');
      if (btn) btn.disabled = false;
    }
  }

  function markRead() {
    const s = curSpace();
    if (!s || st.manage || isCase() || !st.messages.length) return;
    const seq = Math.max.apply(null, st.messages.map(m => m.seq || 0));
    if (seq > (s.lastReadSeq || 0) || s.unread) {
      post(`${CHAT}/spaces/${s.id}/read`, { seq }).then(() => { s.unread = 0; s.lastReadSeq = seq; renderList(); }).catch(() => {});
    }
  }

  async function refreshActive(opts) {
    if (!st.active) return;
    const token = st.loadingToken;
    try {
      const { list } = await fetchMessages();
      if (token !== st.loadingToken) return;
      // Keep older pages the user loaded; the poll only brings the newest page
      const fresh = new Map(list.map(m => [m.id, m]));
      const oldestFresh = list.length ? Math.min.apply(null, list.map(m => m.seq || 0)) : 0;
      const kept = st.messages.filter(m => !fresh.has(m.id) && (m.seq || 0) < oldestFresh);
      const merged = kept.concat(list);
      const sig = signatureOf(merged);
      if (sig === st.signature && !(opts && opts.force)) return;
      const added = merged.filter(m => !st.messages.some(o => o.id === m.id) && !(m.sender && m.sender.id === me().id)).length;
      st.signature = sig;
      st.messages = merged;
      if (added && !st.stickBottom) st.unseen += added;
      renderStream();
      markRead();
    } catch (e) { /* the next tick tries again */ }
  }

  function startPolling() {
    stopPolling();
    st.timer = setInterval(() => { if (tabVisible() && st.active && !st.sending) refreshActive(); }, POLL_MS);
  }
  function stopPolling() { if (st.timer) clearInterval(st.timer); st.timer = null; }

  // ---------- composer ----------
  function autosize() {
    const el = $('chm-input');
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }

  function renderContext() {
    const box = $('chm-context');
    const ctx = st.edit ? { icon: 'fa-pen', title: 'ویرایش پیام', body: st.edit.body } : (st.reply ? { icon: 'fa-reply', title: `پاسخ به ${st.reply.sender ? st.reply.sender.name : 'پیام'}`, body: st.reply.body || 'فایل' } : null);
    box.hidden = !ctx;
    if (!ctx) return;
    $('chm-context-icon').className = `fa-solid ${ctx.icon}`;
    $('chm-context-title').textContent = ctx.title;
    $('chm-context-body').textContent = ctx.body;
  }

  function renderFiles() {
    const box = $('chm-files');
    box.hidden = !st.files.length;
    box.innerHTML = st.files.map((f, i) => `<span class="chm-file-chip${f.id ? '' : ' is-busy'}"><i class="fa-solid ${f.id ? 'fa-paperclip' : 'fa-circle-notch fa-spin'}"></i>${esc(f.name)}<button type="button" data-rmfile="${i}" aria-label="حذف پیوست"><i class="fa-solid fa-xmark"></i></button></span>`).join('');
  }

  function clearSchedule() { $('chm-sched').hidden = true; $('chm-sched-at').value = ''; $('chm-sched-toggle').classList.remove('is-on'); }

  async function uploadFiles(fileList) {
    const spaceId = isCase() ? null : st.active.id;
    if (!spaceId) { showToast('پیوست فایل در پرونده‌ی پشتیبانی ممکن نیست.', 'info'); return; }
    for (const file of Array.from(fileList)) {
      const entry = { name: file.name, id: null };
      st.files.push(entry);
      renderFiles();
      try {
        const form = new FormData();
        form.append('spaceId', spaceId);
        form.append('file', file);
        const res = await request(st.manage ? `${MANAGE}/uploads` : `${CHAT}/uploads`, { method: 'POST', body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'خطا در ارسال فایل');
        entry.id = data.id;
      } catch (e) {
        st.files = st.files.filter(f => f !== entry);
        showToast(e.message || 'خطا در ارسال فایل', 'error');
      }
      renderFiles();
    }
  }

  async function send() {
    if (st.sending || !st.active) return;
    const input = $('chm-input');
    const body = input.value.trim();
    const ready = st.files.filter(f => f.id);
    if (st.files.some(f => !f.id)) { showToast('پیوست‌ها هنوز در حال ارسال هستند.', 'info'); return; }
    if (!body && !ready.length) return;
    const attachmentIds = ready.map(f => f.id);
    const sendAt = $('chm-sched-at').value;
    st.sending = true;
    $('chm-send').disabled = true;
    try {
      if (st.edit) {
        await api(`${CHAT}/messages/${st.edit.id}`, { method: 'PATCH', body: JSON.stringify({ body }) });
        showToast('پیام ویرایش شد.', 'success');
      } else if (isCase()) {
        await post(`/api/v1/admin/support-cases/${st.active.id}/reply`, { body });
        st.active.meta.status = st.active.meta.status === 'open' ? 'reviewing' : st.active.meta.status;
      } else if (st.manage || sendAt) {
        if (sendAt && attachmentIds.length) throw new Error('پیام زمان‌بندی‌شده فعلاً پیوست نمی‌پذیرد');
        const r = await post(`${MANAGE}/publish`, { spaceId: st.active.id, body, attachmentIds, sendAt: sendAt ? new Date(sendAt).toISOString() : undefined });
        if (r.scheduled) showToast('پیام زمان‌بندی شد و در زمان مقرر منتشر می‌شود.', 'success');
      } else {
        const r = await post(`${CHAT}/spaces/${st.active.id}/messages`, {
          body, attachmentIds, replyToId: st.reply ? st.reply.id : undefined, clientMessageId: `p${Date.now()}${Math.random().toString(36).slice(2, 8)}`,
        });
        if (r && r.command) showToast(typeof r.result === 'string' ? r.result : 'دستور اجرا شد.', 'success');
      }
      input.value = '';
      st.reply = null; st.edit = null; st.files = [];
      clearSchedule(); autosize(); renderContext(); renderFiles();
      st.stickBottom = true;
      await refreshActive({ force: true });
      loadInbox(true);
    } catch (e) {
      showToast(e.message || 'خطا در ارسال پیام', 'error');
    } finally {
      st.sending = false;
      $('chm-send').disabled = false;
      input.focus();
    }
  }

  // ---------- message menu ----------
  function closeMenu() {
    const menu = $('chm-menu');
    menu.hidden = true;
    document.querySelectorAll('.chm-more.is-open').forEach(b => b.classList.remove('is-open'));
  }

  function placeMenu(anchor) {
    const menu = $('chm-menu');
    menu.hidden = false;
    const a = anchor.getBoundingClientRect();
    const w = menu.offsetWidth;
    const h = menu.offsetHeight;
    let left = a.left + a.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = a.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, a.top - h - 6);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  function openMessageMenu(id, anchor) {
    const m = st.messages.find(x => x.id === id);
    if (!m) return;
    const s = curSpace();
    const mine = !!(m.sender && m.sender.id === me().id);
    const moderator = st.manage || !!(s && s.canModerate);
    const canWrite = !!(s && (s.canPost || s.canReply)) && !st.manage;
    const items = [];
    if (canWrite) items.push(['reply', 'fa-reply', 'پاسخ']);
    if (m.body) items.push(['copy', 'fa-copy', 'کپی متن']);
    if (mine && m.body && !st.manage && m.kind !== 'card') items.push(['edit', 'fa-pen', 'ویرایش']);
    if (moderator && !st.manage) items.push(['pin', 'fa-thumbtack', m.pinned ? 'برداشتن سنجاق' : 'سنجاق کردن']);
    if (moderator && !mine && m.sender) items.push(['mute', 'fa-volume-xmark', 'بی‌صدا تا یک ساعت']);
    if (mine || moderator) items.push(['delete', 'fa-trash', 'حذف', true]);
    const menu = $('chm-menu');
    menu.innerHTML = (st.manage ? '' : `<div class="chm-menu-react">${Object.keys(REACTIONS).map(k => `<button type="button" data-mreact="${k}" title="${esc(REACTIONS[k][1])}" aria-label="${esc(REACTIONS[k][1])}"><i class="fa-solid ${REACTIONS[k][0]}"></i></button>`).join('')}</div>`) +
      items.map(it => `<button type="button" class="chm-menu-item${it[3] ? ' is-danger' : ''}" role="menuitem" data-mact="${it[0]}"><i class="fa-solid ${it[1]}"></i>${esc(it[2])}</button>`).join('');
    menu.dataset.mid = id;
    anchor.classList.add('is-open');
    placeMenu(anchor);
  }

  async function messageAction(id, act) {
    const m = st.messages.find(x => x.id === id);
    closeMenu();
    if (!m) return;
    try {
      if (act === 'reply') { st.reply = m; st.edit = null; renderContext(); $('chm-input').focus(); }
      else if (act === 'edit') { st.edit = m; st.reply = null; $('chm-input').value = m.body; autosize(); renderContext(); $('chm-input').focus(); }
      else if (act === 'copy') { await navigator.clipboard.writeText(m.body); showToast('متن کپی شد.', 'success'); }
      else if (act === 'pin') { await post(`${CHAT}/messages/${id}/pin`); await refreshActive({ force: true }); }
      else if (act === 'mute') { await post(`${CHAT}/spaces/${m.spaceId}/members/${m.sender.id}/mute`, { minutes: 60 }); showToast(`${m.sender.name} تا یک ساعت نمی‌تواند پیام بفرستد.`, 'success'); }
      else if (act === 'delete') {
        if (!(await NopaConfirm('این پیام برای همه حذف می‌شود. ادامه می‌دهید؟'))) return;
        await api(st.manage ? `${MANAGE}/messages/${id}` : `${CHAT}/messages/${id}`, { method: 'DELETE' });
        await refreshActive({ force: true });
      }
    } catch (e) {
      showToast(e.message || 'خطا در انجام کار', 'error');
    }
  }

  async function react(id, type) {
    closeMenu();
    try {
      await post(`${CHAT}/messages/${id}/reactions`, { type });
      await refreshActive({ force: true });
    } catch (e) { showToast(e.message || 'خطا در ثبت واکنش', 'error'); }
  }

  function gotoMessage(id) {
    const el = $('chm-stream').querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (!el) { showToast('این پیام در بخش بارگذاری‌شده نیست؛ پیام‌های قدیمی‌تر را باز کنید.', 'info'); return; }
    el.scrollIntoView({ block: 'center' });
    el.classList.add('is-flash');
    setTimeout(() => el.classList.remove('is-flash'), 1400);
  }

  // ---------- header tools ----------
  async function searchInSpace(q) {
    const s = curSpace();
    if (!s) return;
    if (q.trim().length < 2) { renderStream({ bottom: true }); return; }
    $('chm-stream').innerHTML = streamSkeleton();
    try {
      const rows = (await api(`${CHAT}/spaces/${s.id}/search?q=${encodeURIComponent(q.trim())}`)).reverse();
      const saved = st.messages;
      st.messages = rows;
      renderStream({ bottom: true });
      if (!rows.length) $('chm-stream').innerHTML = '<div class="chm-state">نتیجه‌ای پیدا نشد.</div>';
      st.messages = saved;
    } catch (e) { $('chm-stream').innerHTML = `<div class="chm-state">${esc(e.message || 'خطا در جستجو')}</div>`; }
  }

  async function showPins() {
    const s = curSpace();
    if (!s) return;
    try {
      const pins = await api(`${CHAT}/spaces/${s.id}/pins`);
      const menu = $('chm-menu');
      menu.innerHTML = `<div class="chm-menu-list">${pins.map(p => `<button type="button" class="chm-menu-item" data-mgoto="${esc(p.id)}"><i class="fa-solid fa-thumbtack"></i><span>${esc((p.body || 'فایل').slice(0, 70))}</span></button>`).join('') || '<div class="chm-state">پیام سنجاق‌شده‌ای نیست.</div>'}</div>`;
      menu.dataset.mid = '';
      placeMenu($('chm-pins-toggle'));
    } catch (e) { showToast(e.message || 'خطا در دریافت سنجاق‌ها', 'error'); }
  }

  async function toggleMute() {
    const s = curSpace();
    if (!s) return;
    try {
      await post(`${CHAT}/spaces/${s.id}/mute`, { muted: !s.muted });
      s.muted = !s.muted;
      setHead(); renderList();
    } catch (e) { showToast(e.message || 'خطا در تغییر وضعیت اعلان', 'error'); }
  }

  async function caseAction(action) {
    const c = st.active.meta;
    if (action === 'resolve' && !(await NopaConfirm('پرونده بسته می‌شود و از کاربر خواسته می‌شود به پاسخ امتیاز بدهد. ادامه می‌دهید؟'))) return;
    try {
      const updated = await post(`/api/v1/admin/support-cases/${c.id}/${action}`, {});
      Object.assign(c, { status: updated.status, assigneeId: updated.assigneeId });
      showToast(action === 'resolve' ? 'پرونده بسته شد.' : 'پرونده به شما سپرده شد.', 'success');
      setHead(); loadInbox(true);
    } catch (e) { showToast(e.message || 'خطا در ثبت', 'error'); }
  }

  async function showTemplates() {
    if (st.templates === null) {
      try {
        const data = await api(`${MANAGE}/bots`);
        const announce = data.bots.find(b => b.key === 'announce');
        st.templates = (announce && announce.settings && announce.settings.templates) || [];
      } catch (e) { st.templates = []; }
    }
    const menu = $('chm-menu');
    menu.innerHTML = `<div class="chm-menu-list">${st.templates.map((t, i) => `<button type="button" class="chm-menu-item" data-mtpl="${i}"><i class="fa-solid fa-bolt"></i><span>${esc(t.title)}</span></button>`).join('') || '<div class="chm-state">قالبی ثبت نشده است. از «مدیریت چت» قالب بسازید.</div>'}</div>`;
    menu.dataset.mid = '';
    placeMenu($('chm-templates'));
  }

  // ---------- new private conversation ----------
  async function openContacts() {
    const box = $('chm-contacts');
    box.hidden = false;
    $('chm-contacts-text').value = '';
    $('chm-contacts-list').innerHTML = rowSkeleton(5);
    try {
      st.contacts = await api(`${CHAT}/contacts`);
      renderContacts();
    } catch (e) { $('chm-contacts-list').innerHTML = `<div class="chm-state">${esc(e.message || 'خطا در دریافت مخاطبان')}</div>`; }
  }
  function renderContacts() {
    const q = $('chm-contacts-text').value.trim();
    const rows = (st.contacts || []).filter(p => !q || p.name.includes(q));
    $('chm-contacts-list').innerHTML = rows.map(p => `<button type="button" class="chm-row" data-contact="${esc(p.id)}">${avatar(p)}<span class="chm-row-body"><span class="chm-row-title">${esc(p.name)}</span><span class="chm-row-preview">${esc(ROLE_LABELS[String(p.role).toLowerCase()] || 'دانش‌آموز')}</span></span></button>`).join('') || '<div class="chm-state">مخاطبی پیدا نشد.</div>';
  }
  async function startDirect(userId) {
    try {
      const r = await post(`${CHAT}/direct`, { userId });
      $('chm-contacts').hidden = true;
      await loadInbox(true);
      st.filter = 'all';
      openConversation('space', r.id);
    } catch (e) { showToast(e.message || 'خطا در شروع گفتگو', 'error'); }
  }

  // ---------- views + wiring ----------
  function showView(view) {
    document.querySelectorAll('.chm-view').forEach(b => { const on = b.dataset.chmView === view; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', String(on)); });
    $('chat-messenger').hidden = view !== 'messenger';
    $('chat-manage-pane').hidden = view !== 'manage';
    if (view === 'messenger') { loadInbox(true); startPolling(); } else { stopPolling(); }
  }

  function init() {
    if (st.inited || !$('chat-messenger')) return;
    st.inited = true;
    document.querySelectorAll('.chm-view').forEach(b => b.addEventListener('click', () => showView(b.dataset.chmView)));
    $('chm-chips').addEventListener('click', e => { const b = e.target.closest('[data-filter]'); if (b) { st.filter = b.dataset.filter; renderList(); } });
    $('chm-filter-text').addEventListener('input', e => { st.text = e.target.value; renderList(); });
    $('chm-list').addEventListener('click', e => {
      const sp = e.target.closest('[data-space]');
      const cs = e.target.closest('[data-case]');
      if (sp) openConversation('space', sp.dataset.space);
      else if (cs) openConversation('case', cs.dataset.case);
    });
    $('chm-back').addEventListener('click', () => { setState('list'); });
    $('chm-refresh').addEventListener('click', () => { refreshActive({ force: true }); loadInbox(true); });
    $('chm-new-direct').addEventListener('click', openContacts);
    $('chm-contacts-close').addEventListener('click', () => { $('chm-contacts').hidden = true; });
    $('chm-contacts-text').addEventListener('input', renderContacts);
    $('chm-contacts-list').addEventListener('click', e => { const b = e.target.closest('[data-contact]'); if (b) startDirect(b.dataset.contact); });
    $('chm-search-toggle').addEventListener('click', () => {
      const bar = $('chm-searchbar');
      bar.hidden = !bar.hidden;
      $('chm-search-toggle').classList.toggle('is-on', !bar.hidden);
      if (bar.hidden) { $('chm-search-text').value = ''; renderStream({ bottom: true }); } else $('chm-search-text').focus();
    });
    let searchTimer;
    $('chm-search-text').addEventListener('input', e => { clearTimeout(searchTimer); searchTimer = setTimeout(() => searchInSpace(e.target.value), 350); });
    $('chm-pins-toggle').addEventListener('click', e => { e.stopPropagation(); showPins(); });
    $('chm-mute-toggle').addEventListener('click', toggleMute);
    $('chm-pinbar').addEventListener('click', () => gotoMessage($('chm-pinbar').dataset.goto));
    $('chm-case-claim').addEventListener('click', () => caseAction('claim'));
    $('chm-case-resolve').addEventListener('click', () => caseAction('resolve'));
    $('chm-jump').addEventListener('click', () => { st.unseen = 0; $('chm-stream').scrollTo({ top: $('chm-stream').scrollHeight, behavior: 'smooth' }); });
    $('chm-stream').addEventListener('scroll', updateJump);
    $('chm-stream').addEventListener('click', e => {
      const more = e.target.closest('[data-more]');
      if (more) { e.stopPropagation(); openMessageMenu(more.dataset.more, more); return; }
      const rc = e.target.closest('[data-react]');
      if (rc) { react(rc.dataset.mid, rc.dataset.react); return; }
      const go = e.target.closest('[data-goto]');
      if (go) { gotoMessage(go.dataset.goto); return; }
      const zoom = e.target.closest('[data-zoom]');
      if (zoom && window.NopaLightbox && NopaLightbox.open) { NopaLightbox.open(zoom.dataset.zoom); return; }
      if (zoom) { window.open(zoom.dataset.zoom, '_blank', 'noopener'); return; }
      if (e.target.closest('#chm-older')) loadOlder();
    });
    $('chm-menu').addEventListener('click', e => {
      e.stopPropagation();
      const mid = $('chm-menu').dataset.mid;
      const r = e.target.closest('[data-mreact]');
      const a = e.target.closest('[data-mact]');
      const g = e.target.closest('[data-mgoto]');
      const t = e.target.closest('[data-mtpl]');
      if (r) react(mid, r.dataset.mreact);
      else if (a) messageAction(mid, a.dataset.mact);
      else if (g) { closeMenu(); gotoMessage(g.dataset.mgoto); }
      else if (t) { const tpl = st.templates[Number(t.dataset.mtpl)]; closeMenu(); if (tpl) { $('chm-input').value = tpl.body; autosize(); $('chm-input').focus(); } }
    });
    document.addEventListener('click', closeMenu);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeMenu(); if (st.reply || st.edit) { st.reply = null; st.edit = null; renderContext(); } } });
    window.addEventListener('resize', closeMenu);
    $('chm-stream').addEventListener('scroll', closeMenu, { passive: true });

    $('chm-composer').addEventListener('submit', e => { e.preventDefault(); send(); });
    $('chm-input').addEventListener('input', autosize);
    $('chm-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
    $('chm-attach').addEventListener('click', () => $('chm-file').click());
    $('chm-file').addEventListener('change', e => { uploadFiles(e.target.files); e.target.value = ''; });
    $('chm-files').addEventListener('click', e => { const b = e.target.closest('[data-rmfile]'); if (b) { st.files.splice(Number(b.dataset.rmfile), 1); renderFiles(); } });
    $('chm-templates').addEventListener('click', e => { e.stopPropagation(); showTemplates(); });
    $('chm-sched-toggle').addEventListener('click', () => {
      const box = $('chm-sched');
      box.hidden = !box.hidden;
      $('chm-sched-toggle').classList.toggle('is-on', !box.hidden);
    });
    $('chm-sched-clear').addEventListener('click', clearSchedule);
    $('chm-context-cancel').addEventListener('click', () => {
      if (st.edit) { $('chm-input').value = ''; autosize(); }
      st.reply = null; st.edit = null; renderContext();
    });
    // Drop a file anywhere on the conversation to attach it
    const main = document.querySelector('.chm-main');
    main.addEventListener('dragover', e => { if (st.active && !isCase()) e.preventDefault(); });
    main.addEventListener('drop', e => { if (st.active && !isCase() && e.dataTransfer.files.length) { e.preventDefault(); uploadFiles(e.dataTransfer.files); } });

    inboxTick();
  }

  function inboxTick() {
    if (st.inboxTimer) clearInterval(st.inboxTimer);
    st.inboxTimer = setInterval(() => { if (tabVisible()) loadInbox(true); }, POLL_MS * 2.5);
  }

  // The router calls loadChatSettings/loadChatOps when the tab opens; the messenger loads with it.
  const baseLoad = window.loadChatSettings;
  window.loadChatSettings = function () {
    init();
    if (!$('chat-messenger').hidden) { loadInbox(false); if (st.active) startPolling(); }
    return baseLoad ? baseLoad.apply(this, arguments) : undefined;
  };
  window.loadChatMessenger = function () { init(); showView('messenger'); };

  // Open a conversation from elsewhere in the panel (a support case, a notification)
  window.openChatConversation = async function (kind, id) {
    init();
    if (window.NopaRouter) NopaRouter.switchTab('chat-tab', true);
    showView('messenger');
    await loadInbox(true);
    openConversation(kind, id);
  };
})();
