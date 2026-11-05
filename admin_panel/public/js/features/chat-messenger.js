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
    challenges: 'گروه چالش‌ها', arena: 'میدان رقابت', mediaqa: 'گروه رسانه', media: 'گروه رسانه‌ای', direct: 'گفتگوی خصوصی', support: 'پشتیبانی نپا',
  };
  const TYPE_ICONS = {
    announcements: 'fa-bullhorn', public: 'fa-globe', mentors: 'fa-user-tie', caravan: 'fa-people-roof', challenges: 'fa-fire',
    arena: 'fa-trophy', mediaqa: 'fa-photo-film', media: 'fa-photo-film', direct: 'fa-user', support: 'fa-headset',
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
  // Tag colours the server accepts (light enough for the app's dark surfaces, topics.ts isReadableColor)
  const TAG_COLORS = ['#9292E2', '#DFB690', '#6EE7B7', '#7DD3FC', '#F9A8D4', '#FCA5A5', '#FDE68A', '#C4B5FD'];
  // Voice messages, as in the app (chat_voice_composer.dart): at most a minute, at least 0.8s, 40 bars in the file name
  const VOICE_MAX_MS = 60000;
  const VOICE_MIN_MS = 800;
  const VOICE_BARS = 40;
  const VOICE_RATE = 16000;
  const PEAK_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

  const st = {
    inited: false, manage: false, spaces: [], cases: [], filter: 'all', text: '',
    active: null,        // { kind: 'space' | 'case', id, meta }
    messages: [], hasOlder: false, reply: null, edit: null, files: [], sending: false,
    timer: null, inboxTimer: null, loadingToken: 0, stickBottom: true, unseen: 0, templates: null, signature: '',
    thread: null,        // the message whose conversation is open, or null for the main stream
    view: null,          // { tagId } or { stationId } with its label: the stream filter
    staffTags: {}, tags: null, people: null, mentions: [], rec: null, audio: null, playing: null,
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
    if (person && window.nopaImgSrc(person.avatarUrl)) return `<span class="chm-avatar${gold}${cls || ''}"><img src="${esc(window.nopaImgSrc(person.avatarUrl))}" alt="" loading="lazy"></span>`;
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
    $('chm-filter-toggle').hidden = isCase() || st.manage;
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
      if (s && !st.manage && (st.thread ? !s.canReply : (!s.canPost && !s.canReply))) reason = 'در این گفتگو فقط می‌توانید بخوانید.';
    }
    notice.hidden = !reason;
    notice.textContent = reason;
    const off = !!reason;
    $('chm-composer').hidden = off;
    input.disabled = off;
    // Scheduling and templates are for channels and groups, not for private conversations or a support case
    const s = curSpace();
    const channel = !isCase() && s && !['direct', 'support'].includes(s.type);
    $('chm-sched-toggle').hidden = !channel || !!st.thread;
    $('chm-templates').hidden = isCase() ? false : !channel;
    $('chm-mic').hidden = isCase();
    $('chm-attach').hidden = isCase();
    $('chm-poll-btn').hidden = !channel || !!st.thread || st.manage || !(s && s.canModerate);
    if (!channel || st.thread) clearSchedule();
  }

  // messages deleted a moment ago that can still be undone: left out of every redraw until then
  const pendingDelete = new Set();

  function messageHtml(m, prev) {
    if (pendingDelete.has(String(m.id))) return '';
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
      if (a.kind === 'audio') return voiceHtml(a);
      if (a.kind === 'video') return `<video controls preload="none" src="${esc(a.url)}"></video>`;
      return `<a class="chm-file" href="${esc(a.url)}" target="_blank" rel="noopener"><i class="fa-solid fa-file-arrow-down"></i>${esc(a.name)}</a>`;
    }).join('');
    let poll = '';
    if (m.kind === 'poll' && m.meta && Array.isArray(m.meta.options)) {
      const votes = m.pollVotes || [];
      const mineVote = (votes.find(v => v.userId === me().id) || {}).option;
      poll = `<div class="chm-poll">${m.meta.options.map((o, i) => {
        const n = votes.filter(v => v.option === i).length;
        const pct = votes.length ? Math.round((n / votes.length) * 100) : 0;
        return `<button type="button" class="chm-poll-opt${mineVote === i ? ' is-mine' : ''}" data-vote="${i}" data-mid="${esc(m.id)}"${st.manage ? ' disabled' : ''}>
          <span class="chm-poll-fill" data-pct="${pct}"></span><span class="chm-poll-label">${mineVote === i ? '<i class="fa-solid fa-circle-check"></i>' : ''}${esc(typeof o === 'string' ? o : (o.text || ''))}</span><span class="chm-poll-n">${esc(fa(n))}</span></button>`;
      }).join('')}<span class="chm-poll-total">${esc(fa(votes.length))} رأی</span></div>`;
    }
    const tagList = (m.tags || []).concat((st.staffTags[m.id] || []).map(t => ({ ...t, staff: true })));
    const tags = tagList.length ? `<div class="chm-tags">${tagList.map(t => `<span class="chm-tag${t.staff ? ' is-staff' : ''}" data-color="${esc(t.color)}"><span class="chm-tag-dot"></span>${esc(t.name)}${t.staff ? '<i class="fa-solid fa-eye-slash" title="فقط راهبران"></i>' : ''}</span>`).join('')}</div>` : '';
    const threadOpen = !st.thread && !isCase() && !st.manage && (m.threadOpen || m.threadReplies > 0);
    const thread = threadOpen ? `<button type="button" class="chm-thread-link" data-thread="${esc(m.id)}">
        <span class="chm-thread-faces">${(m.threadPeople || []).map(p => avatar(p, null, ' is-xs')).join('')}</span>
        <i class="fa-solid fa-comments"></i>${m.threadReplies ? `${esc(fa(m.threadReplies))} پاسخ` : 'ورود به گفتگو'}<i class="fa-solid fa-chevron-left"></i></button>` : '';
    const grouped = {};
    (m.reactions || []).forEach(r => { (grouped[r.type] = grouped[r.type] || []).push(r.userId); });
    const reactions = Object.keys(grouped).map(type => `<button type="button" class="chm-react-chip${grouped[type].includes(me().id) ? ' is-mine' : ''}" data-react="${esc(type)}" data-mid="${esc(m.id)}" title="${esc((REACTIONS[type] || [])[1] || type)}"><i class="fa-solid ${(REACTIONS[type] || ['fa-face-smile'])[0]}"></i>${esc(fa(grouped[type].length))}</button>`).join('');
    const reply = m.replyTo ? `<button type="button" class="chm-reply" data-goto="${esc(m.replyTo.id)}"><b>${esc(m.replyTo.senderName)}</b><span>${esc(m.replyTo.body || 'پیام حذف شده')}</span></button>` : '';
    const body = m.deleted
      ? '<p class="chm-text is-deleted">این پیام حذف شده است</p>'
      : (m.body ? `<p class="chm-text">${esc(m.body)}</p>` : '');
    // A challenge's messages carry the mentor as their sender: shown under the mentor's name, not the bot's
    const showName = !mine && !sameAuthor && m.sender;
    return `<div class="${cls}" data-id="${esc(m.id)}">
      ${!mine && !system && m.sender ? (sameAuthor ? '<span class="chm-avatar is-sm chm-ghost" aria-hidden="true"></span>' : avatar(m.sender, null, ' is-sm')) : ''}
      <div class="chm-bubble">
        ${showName ? `<div class="chm-sender">${esc(m.sender.name)}${role ? `<span class="chm-role">${esc(role)}</span>` : ''}</div>` : ''}
        ${m.botKey && !m.sender ? `<div class="chm-sender"><i class="fa-solid ${m.botKey === 'support' ? 'fa-headset' : 'fa-robot'}"></i>${esc(m.botName || 'ربات نپا')}</div>` : ''}
        ${reply}${att ? `<div class="chm-att">${att}</div>` : ''}${body}${poll}${tags}
        ${reactions ? `<div class="chm-react">${reactions}</div>` : ''}
        <div class="chm-meta">${m.best ? '<span class="chm-best"><i class="fa-solid fa-award"></i>بهترین پاسخ</span>' : ''}${m.pinned ? '<i class="fa-solid fa-thumbtack"></i>' : ''}${m.edited ? '<span>ویرایش‌شده</span>' : ''}<span>${esc(clock(m.createdAt))}</span></div>
        ${thread}
      </div>
      ${m.deleted || isCase() ? '' : `<button type="button" class="chm-more" data-more="${esc(m.id)}" aria-label="گزینه‌های پیام" aria-haspopup="menu"><i class="fa-solid fa-ellipsis"></i></button>`}
    </div>`;
  }

  function renderStream(opts) {
    opts = opts || {};
    const box = $('chm-stream');
    const prevTop = box.scrollHeight - box.scrollTop;
    let html = '';
    // In a thread the message it hangs under leads, then its replies
    if (st.thread) html += `<div class="chm-thread-root">${messageHtml(st.thread, null)}</div><div class="chm-day">${st.messages.length ? `${esc(fa(st.messages.length))} پاسخ` : 'هنوز پاسخی نیامده است'}</div>`;
    html += st.hasOlder ? '<button type="button" class="chm-pill-btn chm-older" id="chm-older"><i class="fa-solid fa-arrow-up"></i>پیام‌های قدیمی‌تر</button>' : '';
    let lastDay = '';
    st.messages.forEach((m, i) => {
      const day = new Date(m.createdAt).toDateString();
      if (day !== lastDay && !st.thread) { html += `<div class="chm-day">${esc(dayLabel(m.createdAt))}</div>`; lastDay = day; }
      html += messageHtml(m, day === (i && new Date(st.messages[i - 1].createdAt).toDateString()) ? st.messages[i - 1] : null);
    });
    box.innerHTML = html || `<div class="chm-state">${st.view ? 'پیامی با این فیلتر پیدا نشد.' : 'هنوز پیامی ارسال نشده است.'}</div>`;
    paint(box);
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

  const signatureOf = list => list.map(m => `${m.id}|${m.deleted ? 1 : 0}|${m.edited ? 1 : 0}|${m.pinned ? 1 : 0}|${m.best ? 1 : 0}|${(m.reactions || []).length}|${(m.pollVotes || []).length}|${(m.tags || []).length}|${(st.staffTags[m.id] || []).length}|${m.threadReplies || 0}`).join(',');

  // Inline style attributes are blocked by the panel's CSP: colours and widths go through the CSSOM
  function paint(root) {
    root.querySelectorAll('[data-color]').forEach(el => el.style.setProperty('--tag', el.dataset.color));
    root.querySelectorAll('[data-pct]').forEach(el => { el.style.width = `${el.dataset.pct}%`; });
    root.querySelectorAll('[data-peak]').forEach(el => { el.style.height = `${Math.round(Number(el.dataset.peak) * 100)}%`; });
    if (st.playing) syncVoice();
  }

  async function fetchMessages(beforeSeq) {
    const a = st.active;
    if (a.kind === 'case') {
      return { list: await api(`/api/v1/admin/support-cases/${a.id}/messages`), more: false };
    }
    if (st.manage) {
      const rows = await api(`${MANAGE}/spaces/${a.id}/messages`);
      return { list: rows.slice().reverse(), more: false };
    }
    const q = new URLSearchParams();
    if (beforeSeq) q.set('beforeSeq', beforeSeq);
    if (st.thread) q.set('threadRootId', st.thread.id);
    if (st.view && st.view.tagId) q.set('tagId', st.view.tagId);
    if (st.view && st.view.stationId) q.set('stationId', st.view.stationId);
    const data = await api(`${CHAT}/spaces/${a.id}/messages${q.toString() ? `?${q}` : ''}`);
    Object.assign(st.staffTags, data.staffTags || {});
    // Tags taken off a message no longer come back in staffTags: clear them for the messages of this page
    data.messages.forEach(m => { if (!(data.staffTags || {})[m.id]) delete st.staffTags[m.id]; });
    return { list: data.messages, more: data.messages.length >= PAGE };
  }

  // Reloads the stream from scratch (a thread opened or closed, a filter chosen)
  async function reloadStream() {
    const token = ++st.loadingToken;
    st.messages = []; st.hasOlder = false; st.stickBottom = true; st.unseen = 0; st.signature = '';
    renderBars();
    updateComposerAccess();
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
  }

  // The thread bar and the filter bar under the header
  function renderBars() {
    $('chm-threadbar').hidden = !st.thread;
    if (st.thread) $('chm-thread-title').textContent = (st.thread.body || 'پیام').slice(0, 80);
    $('chm-filterbar').hidden = !st.view;
    if (st.view) $('chm-filter-label').textContent = st.view.label;
    $('chm-filter-toggle').classList.toggle('is-on', !!st.view);
    $('chm-input').placeholder = st.thread ? 'پاسخ در این گفتگو...' : 'پیام خود را بنویسید...';
  }

  async function openConversation(kind, id) {
    const meta = kind === 'case' ? st.cases.find(c => c.id === id) : st.spaces.find(s => s.id === id);
    if (!meta) return;
    if (st.rec) cancelRecording();
    st.active = { kind, id, meta };
    st.reply = null; st.edit = null; st.files = []; st.thread = null; st.view = null;
    st.staffTags = {}; st.tags = null; st.people = null; st.mentions = [];
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
    await reloadStream();
    startPolling();
  }

  function enterThread(id) {
    const m = st.messages.find(x => x.id === id);
    if (!m) return;
    closeMenu();
    st.thread = m; st.reply = null; st.edit = null;
    renderContext();
    reloadStream();
  }
  function exitThread() {
    st.thread = null; st.reply = null;
    renderContext();
    reloadStream();
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
        const edited = st.edit;
        await api(`${CHAT}/messages/${edited.id}`, { method: 'PATCH', body: JSON.stringify({ body }) });
        // «لغو» within 10s puts the old text back
        NopaUndo.afterEdit({
          message: 'پیام ویرایش شد.',
          url: `${CHAT}/messages/${edited.id}`,
          method: 'PATCH',
          body: { body },
          before: { body: edited.body },
          done: () => refreshActive({ force: true }),
        });
      } else if (isCase()) {
        await post(`/api/v1/admin/support-cases/${st.active.id}/reply`, { body });
        st.active.meta.status = st.active.meta.status === 'open' ? 'reviewing' : st.active.meta.status;
      } else if ((st.manage || sendAt) && !st.thread) {
        if (sendAt && attachmentIds.length) throw new Error('پیام زمان‌بندی‌شده فعلاً پیوست نمی‌پذیرد');
        const r = await post(`${MANAGE}/publish`, { spaceId: st.active.id, body, attachmentIds, sendAt: sendAt ? new Date(sendAt).toISOString() : undefined });
        if (r.scheduled) showToast('پیام زمان‌بندی شد و در زمان مقرر منتشر می‌شود.', 'success');
      } else {
        const mentions = st.mentions.filter(p => body.includes(`@${p.name}`)).map(p => p.id);
        const r = await post(`${CHAT}/spaces/${st.active.id}/messages`, {
          body, attachmentIds, mentions, replyToId: st.reply ? st.reply.id : undefined, threadRootId: st.thread ? st.thread.id : undefined,
          clientMessageId: `p${Date.now()}${Math.random().toString(36).slice(2, 8)}`,
        });
        if (r && r.command) showToast(typeof r.result === 'string' ? r.result : 'دستور اجرا شد.', 'success');
      }
      input.value = '';
      st.reply = null; st.edit = null; st.files = []; st.mentions = [];
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
    menu.dataset.mode = '';
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
    const tagger = !st.manage && !!(s && s.canTag);
    const privateChat = !!(s && ['direct', 'support'].includes(s.type));
    const isRoot = st.thread && st.thread.id === m.id;
    const items = [];
    if (canWrite && (st.thread ? s.canReply : true)) items.push(['reply', 'fa-reply', 'پاسخ']);
    if (!st.thread && !st.manage && (m.threadOpen || m.threadReplies > 0)) items.push(['thread', 'fa-comments', 'ورود به گفتگو']);
    if (!st.thread && !st.manage && moderator && !m.threadOpen && !m.threadReplies && !privateChat && !m.threadRootId) items.push(['openThread', 'fa-comment-medical', 'باز کردن گفتگو زیر این پیام']);
    if (m.body) items.push(['copy', 'fa-copy', 'کپی متن']);
    if (mine && m.body && !st.manage && m.kind !== 'card') items.push(['edit', 'fa-pen', 'ویرایش']);
    if (moderator && !st.manage) items.push(['pin', 'fa-thumbtack', m.pinned ? 'برداشتن سنجاق' : 'سنجاق کردن']);
    if (tagger) {
      items.push(['tag', 'fa-tag', 'برچسب']);
      items.push(['best', 'fa-award', m.best ? 'برداشتن «بهترین پاسخ»' : 'بهترین پاسخ']);
      items.push(['evidence', 'fa-circle-check', 'شاهد امتیاز (روشن/خاموش)']);
    }
    if (moderator && !mine && m.sender) items.push(['mute', 'fa-volume-xmark', 'بی‌صدا تا یک ساعت']);
    if (!mine && m.sender && !st.manage && s && s.type !== 'direct') items.push(['report', 'fa-flag', 'گزارش تخلف', true]);
    if ((mine || moderator) && !isRoot) items.push(['delete', 'fa-trash', 'حذف', true]);
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
      else if (act === 'thread') { enterThread(id); }
      else if (act === 'openThread') { await post(`${CHAT}/messages/${id}/mark`, { mark: 'thread' }); await refreshActive({ force: true }); enterThread(id); }
      else if (act === 'best' || act === 'evidence') {
        const r = await post(`${CHAT}/messages/${id}/mark`, { mark: act });
        const on = (r.marks || []).includes(act);
        showToast(act === 'best' ? (on ? 'به‌عنوان بهترین پاسخ نشان شد.' : 'نشان بهترین پاسخ برداشته شد.') : (on ? 'شاهد امتیاز ثبت شد.' : 'شاهد امتیاز برداشته شد.'), 'success');
        await refreshActive({ force: true });
      }
      else if (act === 'tag') { await showTagPicker(id, $('chm-stream').querySelector(`[data-more="${CSS.escape(id)}"]`) || $('chm-filter-toggle')); }
      else if (act === 'report') {
        const reason = window.prompt('دلیل گزارش این پیام را بنویسید (اختیاری)', '');
        if (reason === null) return;
        await post(`${CHAT}/messages/${id}/report`, { reason });
        showToast('گزارش ثبت شد و به مدیران می‌رسد.', 'success');
      }
      else if (act === 'mute') { await post(`${CHAT}/spaces/${m.spaceId}/members/${m.sender.id}/mute`, { minutes: 60 }); showToast(`${m.sender.name} تا یک ساعت نمی‌تواند پیام بفرستد.`, 'success'); }
      else if (act === 'delete') {
        if (!(await NopaConfirm('این پیام برای همه حذف می‌شود. ادامه می‌دهید؟'))) return;
        // Hidden at once; deleted for everyone only if not undone within 10s
        const url = st.manage ? `${MANAGE}/messages/${id}` : `${CHAT}/messages/${id}`;
        NopaUndo.later({
          message: 'پیام حذف شد.',
          hide: () => {
            pendingDelete.add(String(id));
            const back = NopaUndo.hideEl($('chm-stream').querySelector(`[data-id="${CSS.escape(id)}"]`));
            return () => { pendingDelete.delete(String(id)); back(); refreshActive({ force: true }); };
          },
          commit: () => api(url, { method: 'DELETE' }),
          done: () => { pendingDelete.delete(String(id)); return refreshActive({ force: true }); },
        });
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

  // ---------- tags ----------
  async function loadTags(force) {
    const s = curSpace();
    if (!s) return [];
    if (st.tags && !force) return st.tags;
    st.tags = await api(`${CHAT}/spaces/${s.id}/tags`);
    return st.tags;
  }

  const tagChip = t => `<span class="chm-tag" data-color="${esc(t.color)}"><span class="chm-tag-dot"></span>${esc(t.name)}${t.visibility === 'staff' ? '<i class="fa-solid fa-eye-slash" title="فقط راهبران"></i>' : ''}</span>`;

  async function showTagPicker(id, anchor) {
    const m = st.messages.concat(st.thread ? [st.thread] : []).find(x => x.id === id);
    if (!m) return;
    let tags;
    try { tags = await loadTags(); } catch (e) { showToast(e.message || 'خطا در دریافت برچسب‌ها', 'error'); return; }
    const on = new Set((m.tags || []).concat(st.staffTags[m.id] || []).map(t => t.id));
    const s = curSpace();
    const menu = $('chm-menu');
    menu.innerHTML = `<div class="chm-menu-head">برچسب پیام</div><div class="chm-menu-list">${tags.map(t => `
      <div class="chm-menu-row"><button type="button" class="chm-menu-item" data-mtag="${esc(t.id)}"><i class="fa-solid ${on.has(t.id) ? 'fa-square-check' : 'fa-square'}"></i>${tagChip(t)}${t.spaceId ? '' : '<span class="chm-menu-hint">همگانی</span>'}</button>
      ${s && s.canModerate ? `<button type="button" class="chm-icon-btn is-sm" data-mtagdel="${esc(t.id)}" title="بایگانی برچسب" aria-label="بایگانی برچسب"><i class="fa-solid fa-box-archive"></i></button>` : ''}</div>`).join('') || '<div class="chm-state">هنوز برچسبی ساخته نشده است.</div>'}</div>
      <button type="button" class="chm-menu-item is-accent" data-mtagnew="1"><i class="fa-solid fa-plus"></i>برچسب تازه</button>`;
    menu.dataset.mid = id;
    paint(menu);
    placeMenu(anchor);
  }

  function showTagForm(id, anchor) {
    const role = String(me().role || '').toLowerCase();
    const menu = $('chm-menu');
    menu.innerHTML = `<form class="chm-form" id="chm-tag-form">
      <div class="chm-menu-head">برچسب تازه</div>
      <input type="text" id="chm-tag-name" maxlength="30" placeholder="نام برچسب" required>
      <div class="chm-swatches" role="radiogroup" aria-label="رنگ برچسب">${TAG_COLORS.map((c, i) => `<button type="button" class="chm-swatch${i ? '' : ' is-on'}" role="radio" aria-checked="${!i}" data-swatch="${c}" data-color="${c}" aria-label="${c}"></button>`).join('')}</div>
      <label class="chm-check"><input type="checkbox" id="chm-tag-staff">فقط راهبران و مدیران ببینند</label>
      ${['admin', 'sub_admin', 'channel_manager'].includes(role) ? '<label class="chm-check"><input type="checkbox" id="chm-tag-global">برای همه‌ی گفتگوها (همگانی)</label>' : ''}
      <button type="submit" class="chm-pill-btn is-primary"><i class="fa-solid fa-check"></i>ساخت و افزودن به پیام</button>
    </form>`;
    menu.dataset.mid = id;
    paint(menu);
    placeMenu(anchor);
    $('chm-tag-name').focus();
  }

  async function createTag(id) {
    const s = curSpace();
    const name = $('chm-tag-name').value.trim();
    if (!name || !s) return;
    const swatch = $('chm-menu').querySelector('.chm-swatch.is-on');
    const global = $('chm-tag-global');
    try {
      const tag = await post(`${CHAT}/spaces/${s.id}/tags`, {
        name, color: swatch ? swatch.dataset.swatch : TAG_COLORS[0],
        visibility: $('chm-tag-staff').checked ? 'staff' : 'public', global: !!(global && global.checked),
      });
      st.tags = null;
      if (id) await post(`${CHAT}/messages/${id}/tags`, { tagId: tag.id });
      closeMenu();
      showToast('برچسب ساخته شد.', 'success');
      await refreshActive({ force: true });
    } catch (e) { showToast(e.message || 'خطا در ساخت برچسب', 'error'); }
  }

  async function toggleTag(id, tagId) {
    try {
      await post(`${CHAT}/messages/${id}/tags`, { tagId });
      await refreshActive({ force: true });
      const anchor = $('chm-stream').querySelector(`[data-more="${CSS.escape(id)}"]`);
      if (anchor) showTagPicker(id, anchor); else closeMenu();
    } catch (e) { showToast(e.message || 'خطا در برچسب‌گذاری', 'error'); }
  }

  async function archiveTag(tagId, id) {
    if (!(await NopaConfirm('این برچسب بایگانی می‌شود و دیگر قابل انتخاب نیست. ادامه می‌دهید؟'))) return;
    closeMenu();
    // Archived on the server only if not undone within 10s
    NopaUndo.later({
      message: 'برچسب بایگانی شد.',
      commit: () => api(`${CHAT}/tags/${tagId}`, { method: 'DELETE' }),
      done: () => { st.tags = null; },
    });
  }

  // ---------- stream filter: by tag or by station ----------
  async function showFilterMenu() {
    const s = curSpace();
    if (!s) return;
    let tags = [];
    let stations = [];
    try { [tags, stations] = await Promise.all([loadTags(), api(`${CHAT}/spaces/${s.id}/stations`).catch(() => [])]); } catch (e) { /* show what we have */ }
    const menu = $('chm-menu');
    menu.innerHTML = `<div class="chm-menu-list">
      <button type="button" class="chm-menu-item" data-mview=""><i class="fa-solid fa-layer-group"></i>همه‌ی پیام‌ها</button>
      ${tags.length ? '<div class="chm-menu-head">برچسب‌ها</div>' : ''}
      ${tags.map(t => `<button type="button" class="chm-menu-item${st.view && st.view.tagId === t.id ? ' is-current' : ''}" data-mview="tag" data-vid="${esc(t.id)}" data-vlabel="${esc(t.name)}">${tagChip(t)}</button>`).join('')}
      ${stations.length ? '<div class="chm-menu-head">منزلگاه‌ها</div>' : ''}
      ${stations.map(x => `<button type="button" class="chm-menu-item${st.view && st.view.stationId === x.id ? ' is-current' : ''}" data-mview="station" data-vid="${esc(x.id)}" data-vlabel="${esc(x.title)}"><i class="fa-solid fa-signs-post"></i>${esc(x.title)}</button>`).join('')}
      ${!tags.length && !stations.length ? '<div class="chm-state">هنوز برچسب یا منزلگاهی در این گفتگو نیست.</div>' : ''}
    </div>`;
    menu.dataset.mid = '';
    paint(menu);
    placeMenu($('chm-filter-toggle'));
  }

  function setView(kind, id, label) {
    closeMenu();
    st.view = kind === 'tag' ? { tagId: id, label: `برچسب: ${label}` } : (kind === 'station' ? { stationId: id, label: `منزلگاه: ${label}` } : null);
    reloadStream();
  }

  // ---------- voice: player ----------
  function peaksOf(a) {
    const match = /~([0-9a-z]{16,64})\.[A-Za-z0-9]+$/.exec(a.name || '');
    if (match) return match[1].split('').map(c => PEAK_ALPHABET.indexOf(c) / (PEAK_ALPHABET.length - 1));
    // Same stand-in shape as the app (ChatWaveform.pseudoPeaks) for voices recorded without bars
    let state = String(a.id).split('').reduce((h, c) => ((h ^ c.charCodeAt(0)) * 16777619) & 0x7fffffff, 2166136261 & 0x7fffffff) || 1;
    let previous = 0.5;
    return Array.from({ length: VOICE_BARS }, () => {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      previous = Math.min(1, Math.max(0, previous * 0.55 + ((state % 1000) / 1000) * 0.45));
      return 0.18 + previous * 0.82;
    });
  }

  function voiceHtml(a) {
    return `<div class="chm-voice" data-aid="${esc(a.id)}" data-src="${esc(a.url)}">
      <button type="button" class="chm-voice-play" data-play="${esc(a.id)}" aria-label="پخش پیام صوتی"><i class="fa-solid fa-play"></i></button>
      <div class="chm-wave" data-seek="${esc(a.id)}" role="slider" aria-label="جای پخش" tabindex="0">${peaksOf(a).map(p => `<span data-peak="${Math.max(0.08, Math.min(1, p)).toFixed(2)}"></span>`).join('')}</div>
      <span class="chm-voice-time" data-vtime="${esc(a.id)}">صوت</span></div>`;
  }

  const mmss = sec => { const s = Math.max(0, Math.round(sec || 0)); return `${fa(Math.floor(s / 60))}:${fa(s % 60).padStart(2, '۰')}`; };

  function syncVoice() {
    document.querySelectorAll('.chm-voice').forEach(box => {
      const on = st.playing && st.playing.id === box.dataset.aid;
      const audio = on ? st.audio : null;
      const btn = box.querySelector('.chm-voice-play i');
      btn.className = `fa-solid ${audio && !audio.paused ? 'fa-pause' : 'fa-play'}`;
      box.classList.toggle('is-playing', !!(audio && !audio.paused));
      const ratio = audio && audio.duration ? audio.currentTime / audio.duration : 0;
      const bars = box.querySelectorAll('.chm-wave span');
      bars.forEach((b, i) => b.classList.toggle('is-played', on && i < Math.round(ratio * bars.length)));
      const time = box.querySelector('.chm-voice-time');
      if (audio && isFinite(audio.duration)) time.textContent = audio.paused && !audio.currentTime ? mmss(audio.duration) : mmss(audio.currentTime);
    });
  }

  function playVoice(id, seekRatio) {
    const box = document.querySelector(`.chm-voice[data-aid="${CSS.escape(id)}"]`);
    if (!box) return;
    if (!st.playing || st.playing.id !== id) {
      if (st.audio) st.audio.pause();
      const audio = new Audio(box.dataset.src);
      audio.addEventListener('timeupdate', syncVoice);
      audio.addEventListener('loadedmetadata', syncVoice);
      audio.addEventListener('pause', syncVoice);
      audio.addEventListener('play', syncVoice);
      audio.addEventListener('ended', () => { audio.currentTime = 0; syncVoice(); });
      audio.addEventListener('error', () => showToast('پخش این پیام صوتی ممکن نشد.', 'error'));
      st.audio = audio;
      st.playing = { id };
    }
    const audio = st.audio;
    if (typeof seekRatio === 'number') {
      const go = () => { audio.currentTime = seekRatio * audio.duration; audio.play().catch(() => {}); };
      if (audio.duration) go(); else audio.addEventListener('loadedmetadata', go, { once: true });
      return;
    }
    if (audio.paused) audio.play().catch(() => showToast('پخش این پیام صوتی ممکن نشد.', 'error'));
    else audio.pause();
  }

  // ---------- voice: recorder (WAV, which every player in the app and the browsers can play) ----------
  function encodeWav(samples, rate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const v = new DataView(buffer);
    const text = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    text(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
    v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); text(36, 'data');
    v.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Blob([buffer], { type: 'audio/wav' });
  }

  function downsample(chunks, from, to) {
    const length = chunks.reduce((a, c) => a + c.length, 0);
    const all = new Float32Array(length);
    let offset = 0;
    chunks.forEach(c => { all.set(c, offset); offset += c.length; });
    if (from === to) return all;
    const ratio = from / to;
    const out = new Float32Array(Math.floor(length / ratio));
    for (let i = 0; i < out.length; i++) {
      const start = Math.floor(i * ratio);
      const end = Math.min(length, Math.floor((i + 1) * ratio));
      let sum = 0;
      for (let j = start; j < end; j++) sum += all[j];
      out[i] = sum / Math.max(1, end - start);
    }
    return out;
  }

  function barsOf(levels, bars) {
    if (!levels.length) return Array(bars).fill(0.08);
    const top = Math.max(0.05, ...levels);
    return Array.from({ length: bars }, (_, i) => {
      const from = Math.floor((i * levels.length) / bars);
      const to = Math.max(from + 1, Math.ceil(((i + 1) * levels.length) / bars));
      let peak = 0;
      for (let j = from; j < Math.min(to, levels.length); j++) peak = Math.max(peak, levels[j]);
      return Math.max(0.08, Math.min(1, peak / top));
    });
  }

  function renderRecording() {
    const r = st.rec;
    $('chm-rec').hidden = !r;
    $('chm-composer').hidden = !!r || !!$('chm-notice').textContent;
    if (!r) return;
    const ms = r.stopped ? r.duration : Date.now() - r.start;
    $('chm-rec-time').textContent = mmss(ms / 1000);
    $('chm-rec').classList.toggle('is-stopped', !!r.stopped);
    $('chm-rec-stop').innerHTML = r.stopped ? `<i class="fa-solid ${r.preview && !r.preview.paused ? 'fa-pause' : 'fa-play'}"></i>` : '<i class="fa-solid fa-stop"></i>';
    $('chm-rec-stop').setAttribute('aria-label', r.stopped ? 'پیش‌شنود' : 'توقف ضبط');
    const live = r.levels.slice(-VOICE_BARS);
    const shown = r.stopped ? r.peaks : Array(VOICE_BARS - live.length).fill(0.06).concat(live.map(l => Math.max(0.08, Math.min(1, l * 2.2))));
    const wave = $('chm-rec-wave');
    if (wave.children.length !== VOICE_BARS) wave.innerHTML = Array(VOICE_BARS).fill('<span></span>').join('');
    Array.from(wave.children).forEach((b, i) => { b.style.height = `${Math.round(shown[i] * 100)}%`; });
  }

  async function startRecording() {
    if (!st.active || isCase()) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !(window.AudioContext || window.webkitAudioContext)) {
      showToast('مرورگر شما ضبط صدا را پشتیبانی نمی‌کند.', 'error');
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    } catch (e) {
      showToast('دسترسی به میکروفون داده نشد.', 'error');
      return;
    }
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const source = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    const r = { stream, ctx, source, proc, chunks: [], levels: [], start: Date.now(), stopped: false };
    proc.onaudioprocess = e => {
      if (r.stopped) return;
      const data = e.inputBuffer.getChannelData(0);
      r.chunks.push(new Float32Array(data));
      let peak = 0;
      for (let i = 0; i < data.length; i++) { const a = Math.abs(data[i]); if (a > peak) peak = a; }
      r.levels.push(peak);
    };
    source.connect(proc);
    proc.connect(ctx.destination); // the processor only runs when it is connected; its output stays silent
    r.timer = setInterval(() => {
      if (Date.now() - r.start >= VOICE_MAX_MS) { stopRecording(); showToast('حداکثر زمان پیام صوتی یک دقیقه است.', 'info'); }
      renderRecording();
    }, 120);
    st.rec = r;
    closeMenu();
    renderRecording();
  }

  function stopRecording() {
    const r = st.rec;
    if (!r || r.stopped) return r;
    r.stopped = true;
    r.duration = Date.now() - r.start;
    clearInterval(r.timer);
    try { r.source.disconnect(); r.proc.disconnect(); } catch (e) { /* already gone */ }
    r.stream.getTracks().forEach(t => t.stop());
    const rate = r.ctx.sampleRate;
    r.ctx.close().catch(() => {});
    r.peaks = barsOf(r.levels, VOICE_BARS);
    r.blob = encodeWav(downsample(r.chunks, rate, Math.min(VOICE_RATE, rate)), Math.min(VOICE_RATE, rate));
    r.chunks = [];
    renderRecording();
    return r;
  }

  function cancelRecording() {
    const r = st.rec;
    if (!r) return;
    stopRecording();
    if (r.preview) { r.preview.pause(); URL.revokeObjectURL(r.preview.src); }
    st.rec = null;
    renderRecording();
  }

  function togglePreview() {
    const r = st.rec;
    if (!r) return;
    if (!r.stopped) { stopRecording(); return; }
    if (!r.preview) {
      r.preview = new Audio(URL.createObjectURL(r.blob));
      ['play', 'pause', 'ended'].forEach(ev => r.preview.addEventListener(ev, renderRecording));
    }
    if (r.preview.paused) r.preview.play().catch(() => {}); else r.preview.pause();
  }

  async function sendRecording() {
    const r = stopRecording();
    if (!r) return;
    if (r.duration < VOICE_MIN_MS) { showToast('پیام صوتی خیلی کوتاه است.', 'info'); cancelRecording(); return; }
    const stamp = Date.now();
    const file = new File([r.blob], `voice-${stamp}~${r.peaks.map(p => PEAK_ALPHABET[Math.round(p * (PEAK_ALPHABET.length - 1))]).join('')}.wav`, { type: 'audio/wav' });
    const btn = $('chm-rec-send');
    btn.disabled = true;
    try {
      await uploadFiles([file]);
      if (!st.files.some(f => f.name === file.name && f.id)) return; // the upload failed and said why
      if (r.preview) { r.preview.pause(); URL.revokeObjectURL(r.preview.src); }
      st.rec = null;
      renderRecording();
      await send();
    } finally {
      btn.disabled = false;
    }
  }

  // ---------- mentions: "@" in the composer lists the people of the conversation ----------
  async function checkMention() {
    const input = $('chm-input');
    const s = curSpace();
    if (!s || st.manage || isCase()) return;
    const before = input.value.slice(0, input.selectionStart);
    const match = /(^|\s)@([^\s@]{0,30})$/.exec(before);
    if (!match) { if ($('chm-menu').dataset.mode === 'mention') closeMenu(); return; }
    if (!st.people) {
      try { st.people = await api(`${CHAT}/spaces/${s.id}/people`); } catch (e) { st.people = []; }
    }
    const q = match[2];
    const rows = st.people.filter(p => p.id !== me().id && (!q || p.name.includes(q))).slice(0, 8);
    if (!rows.length) { closeMenu(); return; }
    const menu = $('chm-menu');
    menu.innerHTML = `<div class="chm-menu-head">نام بردن از</div><div class="chm-menu-list">${rows.map(p => `<button type="button" class="chm-menu-item" data-mention="${esc(p.id)}">${avatar(p, null, ' is-xs')}${esc(p.name)}<span class="chm-menu-hint">${esc(ROLE_LABELS[String(p.role).toLowerCase()] || '')}</span></button>`).join('')}</div>`;
    menu.dataset.mid = '';
    menu.dataset.mode = 'mention';
    placeMenu($('chm-composer'));
  }

  function pickMention(id) {
    const p = (st.people || []).find(x => x.id === id);
    const input = $('chm-input');
    if (!p) return;
    const pos = input.selectionStart;
    const before = input.value.slice(0, pos).replace(/@([^\s@]{0,30})$/, `@${p.name} `);
    input.value = before + input.value.slice(pos);
    input.setSelectionRange(before.length, before.length);
    if (!st.mentions.some(x => x.id === p.id)) st.mentions.push({ id: p.id, name: p.name });
    closeMenu();
    autosize();
    input.focus();
  }

  // ---------- poll: the app's "/نظرسنجی سؤال | گزینه | گزینه" command, from a small form ----------
  function showPollForm() {
    const menu = $('chm-menu');
    menu.innerHTML = `<form class="chm-form" id="chm-poll-form">
      <div class="chm-menu-head">نظرسنجی تازه</div>
      <input type="text" id="chm-poll-q" maxlength="200" placeholder="پرسش" required>
      ${[1, 2, 3, 4].map(i => `<input type="text" class="chm-poll-o" maxlength="80" placeholder="گزینه ${fa(i)}"${i < 3 ? ' required' : ''}>`).join('')}
      <span class="chm-menu-hint">دست‌کم دو گزینه؛ گزینه‌های خالی کنار گذاشته می‌شوند.</span>
      <button type="submit" class="chm-pill-btn is-primary"><i class="fa-solid fa-square-poll-vertical"></i>انتشار نظرسنجی</button>
    </form>`;
    menu.dataset.mid = '';
    menu.dataset.mode = 'form';
    placeMenu($('chm-poll-btn'));
    $('chm-poll-q').focus();
  }

  async function publishPoll() {
    const q = $('chm-poll-q').value.trim().replace(/\|/g, '/');
    const options = Array.from(document.querySelectorAll('.chm-poll-o')).map(i => i.value.trim().replace(/\|/g, '/')).filter(Boolean);
    if (!q || options.length < 2) { showToast('پرسش و دست‌کم دو گزینه لازم است.', 'info'); return; }
    try {
      const r = await post(`${CHAT}/spaces/${st.active.id}/messages`, { body: `/نظرسنجی ${q} | ${options.join(' | ')}`, attachmentIds: [] });
      closeMenu();
      showToast(r && r.command && typeof r.result === 'string' ? r.result : 'نظرسنجی منتشر شد.', 'success');
      st.stickBottom = true;
      await refreshActive({ force: true });
    } catch (e) { showToast(e.message || 'خطا در انتشار نظرسنجی', 'error'); }
  }

  async function vote(id, option) {
    try {
      await post(`${CHAT}/messages/${id}/vote`, { option });
      await refreshActive({ force: true });
    } catch (e) { showToast(e.message || 'خطا در ثبت رأی', 'error'); }
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
      const play = e.target.closest('[data-play]');
      if (play) { playVoice(play.dataset.play); return; }
      const seek = e.target.closest('[data-seek]');
      if (seek) { const r = seek.getBoundingClientRect(); playVoice(seek.dataset.seek, Math.min(1, Math.max(0, (r.right - e.clientX) / r.width))); return; }
      const voteBtn = e.target.closest('[data-vote]');
      if (voteBtn) { vote(voteBtn.dataset.mid, Number(voteBtn.dataset.vote)); return; }
      const th = e.target.closest('[data-thread]');
      if (th) { enterThread(th.dataset.thread); return; }
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
      const tg = e.target.closest('[data-mtag]');
      const tgDel = e.target.closest('[data-mtagdel]');
      const tgNew = e.target.closest('[data-mtagnew]');
      const sw = e.target.closest('[data-swatch]');
      const vw = e.target.closest('[data-mview]');
      const mn = e.target.closest('[data-mention]');
      if (sw) { $('chm-menu').querySelectorAll('.chm-swatch').forEach(b => { const on = b === sw; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', String(on)); }); return; }
      if (tgDel) { archiveTag(tgDel.dataset.mtagdel, mid); return; }
      if (tg) { toggleTag(mid, tg.dataset.mtag); return; }
      if (tgNew) { showTagForm(mid, $('chm-stream').querySelector(`[data-more="${CSS.escape(mid)}"]`) || $('chm-filter-toggle')); return; }
      if (vw) { setView(vw.dataset.mview, vw.dataset.vid, vw.dataset.vlabel); return; }
      if (mn) { pickMention(mn.dataset.mention); return; }
      if (r) react(mid, r.dataset.mreact);
      else if (a) messageAction(mid, a.dataset.mact);
      else if (g) { closeMenu(); gotoMessage(g.dataset.mgoto); }
      else if (t) { const tpl = st.templates[Number(t.dataset.mtpl)]; closeMenu(); if (tpl) { $('chm-input').value = tpl.body; autosize(); $('chm-input').focus(); } }
    });
    $('chm-menu').addEventListener('submit', e => {
      e.preventDefault();
      if (e.target.id === 'chm-tag-form') createTag($('chm-menu').dataset.mid);
      else if (e.target.id === 'chm-poll-form') publishPoll();
    });
    document.addEventListener('click', closeMenu);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeMenu(); if (st.reply || st.edit) { st.reply = null; st.edit = null; renderContext(); } } });
    window.addEventListener('resize', closeMenu);
    $('chm-stream').addEventListener('scroll', closeMenu, { passive: true });

    $('chm-composer').addEventListener('submit', e => { e.preventDefault(); send(); });
    $('chm-input').addEventListener('input', () => { autosize(); checkMention(); });
    $('chm-mic').addEventListener('click', startRecording);
    $('chm-rec-cancel').addEventListener('click', cancelRecording);
    $('chm-rec-stop').addEventListener('click', togglePreview);
    $('chm-rec-send').addEventListener('click', sendRecording);
    $('chm-poll-btn').addEventListener('click', e => { e.stopPropagation(); showPollForm(); });
    $('chm-filter-toggle').addEventListener('click', e => { e.stopPropagation(); showFilterMenu(); });
    $('chm-filter-clear').addEventListener('click', () => setView(null));
    $('chm-thread-back').addEventListener('click', exitThread);
    $('chm-input').addEventListener('keydown', e => {
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
      e.preventDefault();
      const first = $('chm-menu').dataset.mode === 'mention' && !$('chm-menu').hidden && $('chm-menu').querySelector('[data-mention]');
      if (first) pickMention(first.dataset.mention); else send();
    });
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
