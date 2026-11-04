// Support cases tab.
// The chat tab's messenger (css/chat.css .chm-*, same rows, bubbles, composer and shimmer), like the mentors'
// tickets tab (js/features/tickets-chat.js): cases on the side with status chips (open ones first), the open case
// as a conversation; the admin claims it, answers from the composer and closes it.
// Data: GET /admin/support-cases, GET /admin/support-cases/:id/messages, POST …/:id/claim | /reply | /resolve.
(function () {
  const $ = id => document.getElementById(id);
  const st = { cases: [], filter: 'active', text: '', activeId: null, messages: new Map(), sending: false, bound: false };
  const FILTERS = [
    { key: 'active', label: 'جاری' },
    { key: 'open', label: 'باز' },
    { key: 'reviewing', label: 'در بررسی' },
    { key: 'resolved', label: 'حل‌شده' },
    { key: 'all', label: 'همه' },
  ];
  const STATUS_LABEL = { open: 'باز', reviewing: 'در بررسی', resolved: 'حل‌شده' };
  const CATEGORY_LABEL = { general: 'عمومی', technical: 'فنی', payment: 'مالی', account: 'حساب کاربری', content: 'محتوا' };
  const ORDER = { open: 0, reviewing: 1, resolved: 2 };

  const fa = n => Number(n || 0).toLocaleString('fa-IR');
  const initial = name => String(name || '؟').trim().charAt(0) || '؟';
  const statusOf = c => (STATUS_LABEL[c.status] ? c.status : 'open');
  const catLabel = c => CATEGORY_LABEL[c.category] || c.category || '';
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

  function avatar(person, icon, cls) {
    const gold = person && /mentor|admin/i.test(person.role || '') ? ' is-gold' : '';
    if (person && person.avatarUrl) return `<span class="chm-avatar${gold}${cls || ''}"><img src="${esc(person.avatarUrl)}" alt="" loading="lazy"></span>`;
    if (!person && icon) return `<span class="chm-avatar is-gold${cls || ''}"><i class="fa-solid ${icon}"></i></span>`;
    return `<span class="chm-avatar${gold}${cls || ''}">${esc(initial(person && person.name))}</span>`;
  }

  function rowSkeleton(n) {
    return Array.from({ length: n }, () => `
      <div class="chm-row chm-skel" aria-hidden="true"><span class="chm-skel-avatar"></span>
        <span class="chm-skel-body"><span class="lst-skel-line chl-skel-title"></span><span class="lst-skel-line lst-skel-short"></span></span></div>`).join('');
  }

  // ---------- inbox ----------
  function inFilter(c, key) {
    const s = statusOf(c);
    if (key === 'all') return true;
    if (key === 'active') return s !== 'resolved';
    return s === key;
  }
  function matches(c) {
    if (!inFilter(c, st.filter)) return false;
    const q = st.text.trim();
    if (!q) return true;
    return [c.subject, catLabel(c), c.user && c.user.name, c.user && c.user.phoneNumber, c.assigneeName].some(v => String(v || '').includes(q));
  }

  function renderChips() {
    $('spc-chips').innerHTML = FILTERS.map(f => {
      const n = f.key === 'all' || f.key === 'resolved' ? 0 : st.cases.filter(c => inFilter(c, f.key)).length;
      return `<button type="button" class="chm-chip${f.key === st.filter ? ' is-active' : ''}" role="tab" aria-selected="${f.key === st.filter}" data-filter="${f.key}">${esc(f.label)}${n ? `<span class="chm-chip-count">${esc(fa(n))}</span>` : ''}</button>`;
    }).join('');
  }

  function caseRow(c) {
    const s = statusOf(c);
    const sub = [catLabel(c), c.assigneeName ? `مسئول: ${c.assigneeName}` : 'بدون مسئول', c.rating ? `امتیاز ${fa(c.rating)}` : ''].filter(Boolean).join(' · ');
    return `<button type="button" class="chm-row spc-case${String(c.id) === String(st.activeId) ? ' is-active' : ''}" data-case="${esc(c.id)}">
      ${avatar(c.user, 'fa-headset')}
      <span class="chm-row-body">
        <span class="chm-row-top"><span class="chm-row-title">${esc((c.user && c.user.name) || 'کاربر')} · ${esc(c.subject || 'پرونده')}</span><span class="chm-row-time">${esc(timeLabel(c.createdAt))}</span></span>
        <span class="chm-row-bottom"><span class="chm-row-preview">${esc(sub)}</span><span class="chm-mini-chip is-${s}">${esc(STATUS_LABEL[s])}</span></span>
      </span></button>`;
  }

  function renderList() {
    renderChips();
    const box = $('spc-list');
    const rows = st.cases.filter(matches)
      .sort((a, b) => ORDER[statusOf(a)] - ORDER[statusOf(b)] || new Date(b.createdAt) - new Date(a.createdAt));
    box.innerHTML = rows.length ? rows.map(caseRow).join('')
      : `<div class="chm-state">${st.cases.length ? 'پرونده‌ای با این فیلتر پیدا نشد.' : 'هنوز پرونده‌ای ثبت نشده است.'}</div>`;
  }

  // ---------- conversation ----------
  const current = () => st.cases.find(c => String(c.id) === String(st.activeId)) || null;
  const setState = s => { $('spc-messenger').dataset.state = s; };

  function attachments(m) {
    const parts = (m.attachments || []).map(a => {
      if (a.kind === 'image') return `<img src="${esc(a.url)}" alt="${esc(a.name || 'پیوست')}" loading="lazy" data-zoom="${esc(a.url)}">`;
      if (a.kind === 'audio') return `<audio controls preload="none" src="${esc(a.url)}"></audio>`;
      if (a.kind === 'video') return `<video controls preload="none" src="${esc(a.url)}"></video>`;
      return `<a class="chm-file" href="${esc(a.url)}" target="_blank" rel="noopener"><i class="fa-solid fa-file-arrow-down"></i>${esc(a.name || 'فایل پیوست')}</a>`;
    });
    return parts.length ? `<div class="chm-att">${parts.join('')}</div>` : '';
  }

  function bubble(m, c, prev) {
    // A message without a sender is the support bot or a system line
    if (!m.sender) {
      if (!m.botKey) return `<div class="chm-msg is-system"><span class="chm-system">${esc(m.body || '')}</span></div>`;
    }
    const fromUser = m.sender && c.userId && String(m.sender.id) === String(c.userId);
    const mine = !!m.sender && !fromUser;
    const first = !(prev && prev.sender && m.sender && prev.sender.id === m.sender.id);
    const role = !m.sender ? 'ربات' : fromUser ? 'کاربر' : (/mentor/i.test(m.sender.role || '') ? 'راهبر' : 'پشتیبانی');
    return `<div class="chm-msg ${mine ? 'is-mine' : 'is-other'}${m.sender ? '' : ' is-bot'}${first ? ' is-first' : ''}">
      ${mine ? '' : avatar(m.sender, 'fa-robot', ' is-sm')}
      <div class="chm-bubble">
        ${first ? `<div class="chm-sender">${esc((m.sender && m.sender.name) || 'ربات پشتیبانی')}<span class="chm-role">${esc(role)}</span></div>` : ''}
        ${attachments(m)}${m.deleted ? '<p class="chm-text spc-deleted">این پیام حذف شده است</p>' : (m.body ? `<p class="chm-text">${esc(m.body)}</p>` : '')}
        <div class="chm-meta"><span>${esc(m.createdAt ? clock(m.createdAt) : '')}</span></div>
      </div>
    </div>`;
  }

  function renderConv(opts) {
    const c = current();
    if (!c) {
      $('spc-conv').hidden = true;
      $('spc-empty').hidden = false;
      return;
    }
    $('spc-empty').hidden = true;
    $('spc-conv').hidden = false;
    const s = statusOf(c);
    $('spc-head-avatar').outerHTML = avatar(c.user, 'fa-headset').replace('class="chm-avatar', 'id="spc-head-avatar" class="chm-avatar');
    $('spc-head-title').textContent = (c.user && c.user.name) || 'کاربر';
    $('spc-head-sub').textContent = [c.subject, catLabel(c), c.user && c.user.phoneNumber, c.assigneeName && `مسئول: ${c.assigneeName}`, c.rating && `امتیاز ${fa(c.rating)} از ۵`].filter(Boolean).join(' · ');
    const chip = $('spc-head-status');
    chip.className = `chm-mini-chip is-${s}`;
    chip.textContent = STATUS_LABEL[s];
    $('spc-claim').disabled = s === 'resolved';
    $('spc-resolve').disabled = s === 'resolved';

    const box = $('spc-stream');
    const list = st.messages.get(String(c.id));
    if (!list) {
      box.innerHTML = '<div class="chm-state"><i class="fa-solid fa-spinner fa-spin"></i> در حال دریافت گفتگو...</div>';
    } else {
      let html = '';
      let lastDay = '';
      list.forEach((m, i) => {
        const day = m.createdAt ? new Date(m.createdAt).toDateString() : '';
        if (day && day !== lastDay) { html += `<div class="chm-day">${esc(dayLabel(m.createdAt))}</div>`; lastDay = day; }
        html += bubble(m, c, i ? list[i - 1] : null);
      });
      if (!list.length) html = '<div class="chm-state">پیامی در این پرونده نیست.</div>';
      if (s === 'resolved') html += '<div class="chm-msg is-system"><span class="chm-system">این پرونده بسته شده است</span></div>';
      box.innerHTML = html;
      if (!opts || opts.bottom !== false) box.scrollTop = box.scrollHeight;
    }

    const notice = $('spc-notice');
    notice.hidden = s !== 'resolved';
    notice.textContent = s === 'resolved' ? 'این پرونده بسته شده است؛ با ارسال پاسخ دوباره در بررسی قرار می‌گیرد.' : '';
  }

  async function loadMessages(id) {
    try {
      const res = await request(`/api/v1/admin/support-cases/${encodeURIComponent(id)}/messages`);
      if (!res.ok) throw new Error('خطا در دریافت گفتگو');
      const data = await res.json();
      st.messages.set(String(id), Array.isArray(data) ? data : []);
    } catch (e) {
      showToast(e.message, 'error');
      st.messages.set(String(id), []);
    }
    if (String(st.activeId) === String(id)) renderConv();
  }

  function openCase(id) {
    st.activeId = String(id);
    renderList();
    renderConv();
    setState('conv');
    loadMessages(id);
    const input = $('spc-input');
    if (input && window.innerWidth > 900) input.focus({ preventScroll: true });
  }

  function autosize() {
    const el = $('spc-input');
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }

  async function post(id, action, body) {
    const res = await request(`/api/v1/admin/support-cases/${encodeURIComponent(id)}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'عملیات ناموفق');
    return data;
  }
  const me = () => (window.NopaAuth && NopaAuth.getUser && NopaAuth.getUser()) || {};

  async function send(e) {
    if (e) e.preventDefault();
    const c = current();
    const input = $('spc-input');
    const body = input.value.trim();
    if (!c || !body || st.sending) return;
    st.sending = true;
    $('spc-send').disabled = true;
    try {
      const msg = await post(c.id, 'reply', { body });
      input.value = '';
      autosize();
      const list = st.messages.get(String(c.id)) || [];
      list.push(msg && msg.id ? msg : { body, createdAt: new Date().toISOString(), sender: { id: me().id, name: me().name || 'پشتیبانی', role: me().role } });
      st.messages.set(String(c.id), list);
      c.status = 'reviewing';
      if (!c.assigneeName) c.assigneeName = me().name || null;
      renderList();
      renderConv();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      st.sending = false;
      $('spc-send').disabled = false;
    }
  }

  async function claim() {
    const c = current();
    if (!c || statusOf(c) === 'resolved') return;
    try {
      await post(c.id, 'claim');
      c.status = 'reviewing';
      c.assigneeName = me().name || c.assigneeName;
      showToast('پرونده به شما سپرده شد.', 'success');
      renderList();
      renderConv({ bottom: false });
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function resolve() {
    const c = current();
    if (!c || statusOf(c) === 'resolved') return;
    if (!(await NopaConfirm('این پرونده بسته شود؟ از کاربر خواسته می‌شود به پاسخ امتیاز بدهد.'))) return;
    try {
      await post(c.id, 'resolve');
      c.status = 'resolved';
      if (!c.assigneeName) c.assigneeName = me().name || null;
      showToast('پرونده بسته شد.', 'success');
      renderList();
      renderConv({ bottom: false });
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function bind() {
    if (st.bound || !$('spc-messenger')) return;
    st.bound = true;
    $('spc-chips').addEventListener('click', e => {
      const b = e.target.closest('[data-filter]');
      if (!b) return;
      st.filter = b.dataset.filter;
      renderList();
    });
    $('spc-list').addEventListener('click', e => {
      const row = e.target.closest('[data-case]');
      if (row) openCase(row.dataset.case);
    });
    $('spc-filter-text').addEventListener('input', e => { st.text = e.target.value; renderList(); });
    $('spc-refresh').addEventListener('click', () => loadSupportCases());
    $('spc-back').addEventListener('click', () => setState('list'));
    $('spc-claim').addEventListener('click', claim);
    $('spc-resolve').addEventListener('click', resolve);
    $('spc-composer').addEventListener('submit', send);
    $('spc-input').addEventListener('input', autosize);
    $('spc-input').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
    });
  }

  async function loadSupportCases() {
    bind();
    const box = $('spc-list');
    if (!box) return;
    if (!st.cases.length) box.innerHTML = rowSkeleton(6);
    $('spc-refresh').classList.add('is-spinning');
    try {
      const res = await request('/api/v1/admin/support-cases');
      if (!res.ok) throw new Error('خطا در دریافت پرونده‌ها');
      const data = await res.json();
      st.cases = Array.isArray(data) ? data : [];
      renderList();
      if (st.activeId && current()) { st.messages.delete(String(st.activeId)); renderConv({ bottom: false }); loadMessages(st.activeId); }
      else { st.activeId = null; renderConv(); setState('list'); }
    } catch (e) {
      console.error('Error loading support cases', e);
      box.innerHTML = `<div class="chm-state">${esc(e.message || 'خطا در دریافت پرونده‌ها')}</div>`;
    } finally {
      $('spc-refresh').classList.remove('is-spinning');
    }
  }

  window.loadSupportCases = loadSupportCases;
})();
