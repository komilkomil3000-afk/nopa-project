// Support: the mentors' tickets tab.
// The chat tab's messenger (css/chat.css .chm-*, same rows, bubbles, composer and shimmer): students' tickets are
// grouped under the mentor of the student's caravan (a group per mentor, then "without a mentor"); the open ticket
// reads as a conversation, the admin answers from the composer and can mark it resolved.
// Data: GET /admin/tickets (students carry their caravan's mentor), POST /admin/tickets/:id/reply | /resolve.
(function () {
  const $ = id => document.getElementById(id);
  const st = { tickets: [], filter: 'all', text: '', activeId: null, closed: new Set(), sending: false, bound: false };
  const FILTERS = [
    { key: 'all', label: 'همه' },
    { key: 'open', label: 'در انتظار پاسخ' },
    { key: 'answered', label: 'پاسخ‌داده' },
    { key: 'resolved', label: 'حل‌شده' },
  ];
  const STATUS_LABEL = { open: 'در انتظار پاسخ', answered: 'پاسخ‌داده', resolved: 'حل‌شده' };
  const STATUS_CLASS = { open: 'is-open', answered: 'is-reviewing', resolved: 'is-resolved' };
  const NO_MENTOR = '__none__';

  const fa = n => Number(n || 0).toLocaleString('fa-IR');
  const initial = name => String(name || '؟').trim().charAt(0) || '؟';
  const statusOf = t => {
    const s = String(t.status || '').toLowerCase();
    if (s === 'resolved' || s === 'closed') return 'resolved';
    if (s === 'answered') return 'answered';
    return 'open';
  };
  const mentorOf = t => (t.student && t.student.caravan && t.student.caravan.mentor) || null;
  const lastAt = t => {
    const r = t.replies || [];
    return new Date((r.length ? r[r.length - 1].createdAt : null) || t.updatedAt || t.createdAt || 0);
  };
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
    if (person && window.nopaImgSrc(person.avatarUrl)) return `<span class="chm-avatar${gold}${cls || ''}"><img src="${esc(window.nopaImgSrc(person.avatarUrl))}" alt="" loading="lazy"></span>`;
    if (!person && icon) return `<span class="chm-avatar is-gold${cls || ''}"><i class="fa-solid ${icon}"></i></span>`;
    return `<span class="chm-avatar${gold}${cls || ''}">${esc(initial(person && person.name))}</span>`;
  }

  // ---------- skeletons (the chat tab's shimmer) ----------
  function rowSkeleton(n) {
    return Array.from({ length: n }, () => `
      <div class="chm-row chm-skel" aria-hidden="true"><span class="chm-skel-avatar"></span>
        <span class="chm-skel-body"><span class="lst-skel-line chl-skel-title"></span><span class="lst-skel-line lst-skel-short"></span></span></div>`).join('');
  }

  // ---------- inbox: groups per mentor ----------
  function matches(t) {
    if (st.filter !== 'all' && statusOf(t) !== st.filter) return false;
    const q = st.text.trim();
    if (!q) return true;
    const m = mentorOf(t);
    return [t.subject, t.category, t.student && t.student.name, t.student && t.student.caravan && t.student.caravan.name, m && m.name]
      .some(v => String(v || '').includes(q));
  }

  function groups() {
    const map = new Map();
    st.tickets.filter(matches).forEach(t => {
      const m = mentorOf(t);
      const key = m ? String(m.id) : NO_MENTOR;
      if (!map.has(key)) map.set(key, { key, mentor: m, tickets: [] });
      map.get(key).tickets.push(t);
    });
    const list = Array.from(map.values());
    list.forEach(g => g.tickets.sort((a, b) => lastAt(b) - lastAt(a)));
    // waiting tickets first, then the latest activity; tickets without a mentor go last
    const waiting = g => g.tickets.filter(t => statusOf(t) === 'open').length;
    list.sort((a, b) => (a.key === NO_MENTOR) - (b.key === NO_MENTOR) || waiting(b) - waiting(a) || lastAt(b.tickets[0]) - lastAt(a.tickets[0]));
    return list;
  }

  function renderChips() {
    $('mtk-chips').innerHTML = FILTERS.map(f => {
      const n = f.key === 'all' ? 0 : st.tickets.filter(t => statusOf(t) === f.key).length;
      return `<button type="button" class="chm-chip${f.key === st.filter ? ' is-active' : ''}" role="tab" aria-selected="${f.key === st.filter}" data-filter="${f.key}">${esc(f.label)}${n ? `<span class="chm-chip-count">${esc(fa(n))}</span>` : ''}</button>`;
    }).join('');
  }

  function ticketRow(t) {
    const s = statusOf(t);
    const r = t.replies || [];
    const preview = r.length ? `${esc((r[r.length - 1].mentor && r[r.length - 1].mentor.name) || 'پشتیبانی')}: ${esc(r[r.length - 1].message || '')}` : esc(t.subject || '');
    return `<button type="button" class="chm-row mtk-ticket${String(t.id) === String(st.activeId) ? ' is-active' : ''}" data-ticket="${esc(t.id)}">
      ${avatar(t.student, 'fa-user-graduate', ' is-sm')}
      <span class="chm-row-body">
        <span class="chm-row-top"><span class="chm-row-title">${esc((t.student && t.student.name) || 'دانش‌آموز')} · ${esc(t.subject || t.category || 'تیکت')}</span><span class="chm-row-time">${esc(timeLabel(lastAt(t)))}</span></span>
        <span class="chm-row-bottom"><span class="chm-row-preview">${preview}</span><span class="chm-mini-chip ${STATUS_CLASS[s]}">${esc(STATUS_LABEL[s])}</span></span>
      </span></button>`;
  }

  function renderList() {
    renderChips();
    const box = $('mtk-list');
    const list = groups();
    if (!list.length) {
      box.innerHTML = `<div class="chm-state">${st.tickets.length ? 'تیکتی با این فیلتر پیدا نشد.' : 'هنوز تیکتی ثبت نشده است.'}</div>`;
      return;
    }
    const searching = !!st.text.trim();
    box.innerHTML = list.map(g => {
      const waiting = g.tickets.filter(t => statusOf(t) === 'open').length;
      const caravans = Array.from(new Set(g.tickets.map(t => t.student && t.student.caravan && t.student.caravan.name).filter(Boolean)));
      const open = searching || !st.closed.has(g.key);
      const title = g.mentor ? g.mentor.name : 'بدون راهبر';
      return `<div class="mtk-group${open ? ' is-open' : ''}">
        <button type="button" class="chm-row mtk-group-head" data-group="${esc(g.key)}" aria-expanded="${open}">
          ${g.mentor ? avatar({ ...g.mentor, role: 'mentor' }) : avatar(null, 'fa-user-slash')}
          <span class="chm-row-body">
            <span class="chm-row-top"><span class="chm-row-title">${esc(title)}</span><i class="fa-solid fa-chevron-down mtk-caret"></i></span>
            <span class="chm-row-bottom"><span class="chm-row-preview">${esc(fa(g.tickets.length))} تیکت${caravans.length ? ` · ${esc(caravans.join('، '))}` : ''}</span>
              ${waiting ? `<span class="chm-badge" title="در انتظار پاسخ">${esc(fa(waiting))}</span>` : ''}</span>
          </span>
        </button>
        <div class="mtk-group-body"${open ? '' : ' hidden'}>${g.tickets.map(ticketRow).join('')}</div>
      </div>`;
    }).join('');
  }

  // ---------- conversation ----------
  const current = () => st.tickets.find(t => String(t.id) === String(st.activeId)) || null;
  const setState = s => { $('mtk-messenger').dataset.state = s; };

  function bubble(kind, person, roleLabel, text, at, extras) {
    const mine = kind === 'mine';
    return `<div class="chm-msg ${mine ? 'is-mine' : 'is-other'} is-first">
      ${mine ? '' : avatar(person, 'fa-user-graduate', ' is-sm')}
      <div class="chm-bubble">
        <div class="chm-sender">${esc((person && person.name) || (mine ? 'پشتیبانی' : 'دانش‌آموز'))}${roleLabel ? `<span class="chm-role">${esc(roleLabel)}</span>` : ''}</div>
        ${extras || ''}${text ? `<p class="chm-text">${esc(text)}</p>` : ''}
        <div class="chm-meta"><span>${esc(at ? clock(at) : '')}</span></div>
      </div>
    </div>`;
  }
  function attachments(o) {
    const parts = [];
    if (o.voiceUrl) parts.push(`<audio controls preload="none" src="${esc(o.voiceUrl)}"></audio>`);
    if (o.attachmentUrl) parts.push(/\.(png|jpe?g|gif|webp)$/i.test(o.attachmentUrl)
      ? `<img src="${esc(o.attachmentUrl)}" alt="پیوست" loading="lazy" data-zoom="${esc(o.attachmentUrl)}">`
      : `<a class="chm-file" href="${esc(o.attachmentUrl)}" target="_blank" rel="noopener"><i class="fa-solid fa-file-arrow-down"></i>فایل پیوست</a>`);
    return parts.length ? `<div class="chm-att">${parts.join('')}</div>` : '';
  }

  function renderConv(opts) {
    const t = current();
    if (!t) {
      $('mtk-conv').hidden = true;
      $('mtk-empty').hidden = false;
      return;
    }
    $('mtk-empty').hidden = true;
    $('mtk-conv').hidden = false;
    const s = statusOf(t);
    const m = mentorOf(t);
    $('mtk-head-avatar').outerHTML = avatar(t.student, 'fa-user-graduate').replace('class="chm-avatar', 'id="mtk-head-avatar" class="chm-avatar');
    $('mtk-head-title').textContent = (t.student && t.student.name) || 'دانش‌آموز';
    $('mtk-head-sub').textContent = [t.subject, t.category, t.student && t.student.caravan && `کاروان ${t.student.caravan.name}`, m && `راهبر: ${m.name}`].filter(Boolean).join(' · ');
    const chip = $('mtk-head-status');
    chip.className = `chm-mini-chip ${STATUS_CLASS[s]}`;
    chip.textContent = STATUS_LABEL[s];
    $('mtk-resolve').disabled = s === 'resolved';

    // the student's message opens the thread; replies follow, a day label wherever the day changes
    const items = [{ kind: 'other', person: t.student, role: 'دانش‌آموز', text: t.subject, at: t.createdAt, extra: `${t.category ? `<span class="chm-tag"><span class="chm-tag-dot"></span>${esc(t.category)}</span>` : ''}${attachments(t)}` }]
      .concat((t.replies || []).map(r => {
        const role = String((r.mentor && r.mentor.role) || '').toLowerCase();
        return { kind: 'mine', person: r.mentor, role: /mentor/.test(role) ? 'راهبر' : 'پشتیبانی', text: r.message, at: r.createdAt, extra: attachments(r) };
      }));
    let html = '';
    let lastDay = '';
    items.forEach(it => {
      const day = it.at ? new Date(it.at).toDateString() : '';
      if (day && day !== lastDay) { html += `<div class="chm-day">${esc(dayLabel(it.at))}</div>`; lastDay = day; }
      html += bubble(it.kind, it.person, it.role, it.text, it.at, it.extra);
    });
    if (s === 'resolved') html += '<div class="chm-msg is-system"><span class="chm-system">این تیکت حل‌شده است</span></div>';
    const box = $('mtk-stream');
    box.innerHTML = html;
    if (!opts || opts.bottom !== false) box.scrollTop = box.scrollHeight;

    const notice = $('mtk-notice');
    notice.hidden = s !== 'resolved';
    notice.textContent = s === 'resolved' ? 'این تیکت بسته شده است؛ با ارسال پاسخ دوباره باز می‌شود.' : '';
  }

  function openTicket(id) {
    st.activeId = String(id);
    renderList();
    renderConv();
    setState('conv');
    const input = $('mtk-input');
    if (input && window.innerWidth > 900) input.focus({ preventScroll: true });
  }

  function autosize() {
    const el = $('mtk-input');
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }

  async function send(e) {
    if (e) e.preventDefault();
    const t = current();
    const input = $('mtk-input');
    const message = input.value.trim();
    if (!t || !message || st.sending) return;
    st.sending = true;
    $('mtk-send').disabled = true;
    try {
      const res = await request(`/api/v1/admin/tickets/${encodeURIComponent(t.id)}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'خطا در ارسال پاسخ');
      input.value = '';
      autosize();
      t.replies = (t.replies || []).concat(data.reply ? [data.reply] : [{ message, createdAt: new Date().toISOString() }]);
      t.status = 'answered';
      renderList();
      renderConv();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      st.sending = false;
      $('mtk-send').disabled = false;
    }
  }

  async function resolve() {
    const t = current();
    if (!t || statusOf(t) === 'resolved') return;
    if (!(await NopaConfirm('این تیکت «حل‌شده» علامت بخورد؟'))) return;
    try {
      const res = await request(`/api/v1/admin/tickets/${encodeURIComponent(t.id)}/resolve`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'عملیات ناموفق');
      }
      t.status = 'resolved';
      showToast('تیکت حل‌شده علامت خورد.', 'success');
      renderList();
      renderConv({ bottom: false });
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function bind() {
    if (st.bound || !$('mtk-messenger')) return;
    st.bound = true;
    $('mtk-chips').addEventListener('click', e => {
      const b = e.target.closest('[data-filter]');
      if (!b) return;
      st.filter = b.dataset.filter;
      renderList();
    });
    $('mtk-list').addEventListener('click', e => {
      const head = e.target.closest('[data-group]');
      if (head) {
        const k = head.dataset.group;
        if (st.closed.has(k)) st.closed.delete(k); else st.closed.add(k);
        renderList();
        return;
      }
      const row = e.target.closest('[data-ticket]');
      if (row) openTicket(row.dataset.ticket);
    });
    $('mtk-filter-text').addEventListener('input', e => { st.text = e.target.value; renderList(); });
    $('mtk-refresh').addEventListener('click', () => loadTickets());
    $('mtk-back').addEventListener('click', () => setState('list'));
    $('mtk-resolve').addEventListener('click', resolve);
    $('mtk-composer').addEventListener('submit', send);
    $('mtk-input').addEventListener('input', autosize);
    $('mtk-input').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
    });
  }

  async function loadTickets() {
    bind();
    const box = $('mtk-list');
    if (!box) return;
    if (!st.tickets.length) box.innerHTML = rowSkeleton(6);
    $('mtk-refresh').classList.add('is-spinning');
    try {
      const res = await request('/api/v1/admin/tickets');
      if (!res.ok) throw new Error('خطا در دریافت تیکت‌ها');
      const data = await res.json();
      st.tickets = Array.isArray(data) ? data : [];
      renderList();
      const wanted = pendingOpen;
      pendingOpen = null;
      if (wanted && st.tickets.some(t => String(t.id) === String(wanted))) openTicket(wanted);
      else if (st.activeId && current()) renderConv({ bottom: false });
      else { st.activeId = null; renderConv(); setState('list'); }
    } catch (e) {
      console.error('Error loading tickets', e);
      box.innerHTML = `<div class="chm-state">${esc(e.message || 'خطا در دریافت تیکت‌ها')}</div>`;
    } finally {
      $('mtk-refresh').classList.remove('is-spinning');
    }
  }

  window.loadTickets = loadTickets;

  // Opens one ticket (the header bell's support messages): the tab loads, then the ticket opens
  let pendingOpen = null;
  window.openTicketById = function (id) {
    pendingOpen = String(id);
    NopaRouter.switchTab('mentors-tickets-tab', true);
  };
})();

// 3. Mentors League Tab
