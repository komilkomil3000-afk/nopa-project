// ==================== SUPPORT MESSAGES (تابلوی اعلانات جارچی > پیام‌های پشتیبانی) ====================
// Messages sent from the app's "ارسال پیام به پشتیبانی" are stored as SupportTicket rows
// (category "پیام به پشتیبانی"). This view lists them, shows the conversation, lets the admin answer
// (the sender gets an in-app notification) and mark them as resolved.

(function () {
  const SUPPORT_CATEGORY = 'پیام به پشتیبانی';
  const STATUS_LABEL = { open: 'باز', answered: 'پاسخ داده شده', resolved: 'حل شده' };
  const STATUS_FAMILY = { open: 'accent', answered: 'info', resolved: 'success' };

  let allTickets = [];
  let currentTicketId = null;

  function fmtDate(value) {
    try { return new Date(value).toLocaleString('fa-IR'); } catch (_) { return ''; }
  }

  function roleLabel(role) {
    const r = String(role || '').toLowerCase();
    if (r === 'mentor' || r === 'super_mentor') return 'راهبر';
    if (r === 'admin') return 'مدیر';
    return 'دانش‌آموز';
  }

  function statusBadge(status) {
    const key = String(status || 'open').toLowerCase();
    const fam = STATUS_FAMILY[key];
    const tint = fam ? `rgb(var(--${fam}-rgb) / ` : 'rgb(var(--muted-rgb) / ';
    const text = fam ? `var(--${fam}-text)` : 'var(--text-muted)';
    return `<span class="u-p-2-9 u-r-8 u-fs-11_5 u-bold" style="background:${tint}0.13); color:${text}; border:1px solid ${tint}0.4)">${esc(STATUS_LABEL[key] || key)}</span>`;
  }

  function ensureView() {
    const view = document.getElementById('jarchi-support-view');
    if (!view || view.dataset.ready) return view;
    view.dataset.ready = '1';
    view.innerHTML = `
      <div class="u-flex u-justify-between u-items-center u-wrap u-gap-10 u-mb-14">
        <h4 class="u-m-0 u-c-text u-fs-15 u-flex u-items-center u-gap-6">
          <i class="fa-solid fa-headset u-c-primary-text"></i> صندوق پیام‌های پشتیبانی
        </h4>
        <div class="u-flex u-gap-8 u-wrap">
          <select id="support-filter-scope" class="input-ctrl u-minw-170">
            <option value="support">فقط پیام‌های «ارسال به پشتیبانی»</option>
            <option value="all">همه تیکت‌ها (شامل درخواست‌های دیگر)</option>
          </select>
          <select id="support-filter-status" class="input-ctrl u-minw-130">
            <option value="all">همه وضعیت‌ها</option>
            <option value="open">باز</option>
            <option value="answered">پاسخ داده شده</option>
            <option value="resolved">حل شده</option>
          </select>
          <input id="support-filter-search" class="input-ctrl u-minw-180" placeholder="جستجو در نام یا متن پیام">
          <button type="button" id="support-refresh" class="btn-action u-r-8 u-p-8-14 u-pointer">
            <i class="fa-solid fa-sync"></i> بروزرسانی
          </button>
        </div>
      </div>
      <div class="table-container glass">
        <table class="data-table">
          <thead>
            <tr>
              <th>فرستنده</th>
              <th>نقش / کاروان</th>
              <th>پیام</th>
              <th>وضعیت</th>
              <th>تاریخ</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody id="support-tbody"></tbody>
        </table>
      </div>
      <div id="support-ticket-modal" class="modal-overlay u-items-center u-justify-center" style="display:none">
        <div class="modal-content glass u-maxw-760 u-w-92p u-flex u-col u-bg-surface-2-97">
          <div class="modal-header u-bb-fg-10">
            <h3 id="support-modal-title" class="u-m-0">پیام پشتیبانی</h3>
            <button type="button" class="modal-close" id="support-modal-close">&times;</button>
          </div>
          <div class="u-p-18 u-flex u-col u-gap-14 u-maxh-70vh u-scroll-y">
            <div id="support-thread"></div>
            <div class="u-flex u-col u-gap-8">
              <label class="u-c-text-muted">پاسخ پشتیبانی (برای فرستنده اعلان می‌شود)</label>
              <textarea id="support-reply-text" class="input-ctrl" rows="4" placeholder="متن پاسخ را بنویسید..."></textarea>
              <div class="u-flex u-gap-8 u-justify-end u-wrap">
                <button type="button" id="support-resolve" class="btn-action u-r-8 u-p-8-16 u-pointer">
                  <i class="fa-solid fa-circle-check"></i> بستن و حل‌شده
                </button>
                <button type="button" id="support-send" class="btn-primary">ارسال پاسخ</button>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    ['support-filter-scope', 'support-filter-status'].forEach(id =>
      document.getElementById(id).addEventListener('change', render));
    document.getElementById('support-filter-search').addEventListener('input', render);
    document.getElementById('support-refresh').addEventListener('click', load);
    document.getElementById('support-modal-close').addEventListener('click', closeModal);
    document.getElementById('support-send').addEventListener('click', sendReply);
    document.getElementById('support-resolve').addEventListener('click', resolveTicket);
    return view;
  }

  async function load() {
    ensureView();
    try {
      const res = await request('/api/v1/admin/tickets');
      if (!res.ok) return;
      const data = await res.json();
      allTickets = Array.isArray(data) ? data : [];
      render();
    } catch (e) {
      console.error('Error loading support messages', e);
    }
  }

  function render() {
    const tbody = document.getElementById('support-tbody');
    if (!tbody) return;
    const scope = document.getElementById('support-filter-scope').value;
    const status = document.getElementById('support-filter-status').value;
    const q = document.getElementById('support-filter-search').value.trim().toLowerCase();

    const openCount = allTickets.filter(t => t.category === SUPPORT_CATEGORY && String(t.status).toLowerCase() === 'open').length;
    const badge = document.getElementById('support-open-count');
    if (badge) {
      badge.textContent = openCount;
      badge.style.display = openCount > 0 ? 'inline-block' : 'none';
    }

    const rows = allTickets.filter(t => {
      if (scope === 'support' && t.category !== SUPPORT_CATEGORY) return false;
      if (status !== 'all' && String(t.status).toLowerCase() !== status) return false;
      if (q && !`${t.student?.name || ''} ${t.subject || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });

    if (rows.length === 0) {
      NopaTable.empty(tbody, 'پیامی یافت نشد');
      return;
    }

    tbody.innerHTML = rows.map(t => `
      <tr>
        <td>${esc(t.student?.name || 'ناشناس')}<div class="u-fs-11 u-c-text-muted u-direction-ltr u-text-right">${esc(t.student?.phoneNumber || '')}</div></td>
        <td>${esc(roleLabel(t.student?.role))}${t.student?.caravan?.name ? ' • ' + esc(t.student.caravan.name) : ''}</td>
        <td class="u-maxw-320">${t.category !== SUPPORT_CATEGORY ? `<span class="u-c-text-muted u-fs-11">[${esc(t.category)}]</span> ` : ''}${esc(String(t.subject || '').slice(0, 120))}</td>
        <td>${statusBadge(t.status)}</td>
        <td>${fmtDate(t.createdAt)}</td>
        <td><button type="button" class="page-btn btn-view" data-support-open="${esc(t.id)}"><i class="fa-solid fa-eye"></i></button></td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-support-open]').forEach(btn =>
      btn.addEventListener('click', () => openTicket(btn.getAttribute('data-support-open'))));
  }

  function messageCard(author, role, text, when, voiceUrl, attachmentUrl) {
    return `
      <div class="u-p-12-14 u-bg-fg-5 u-r-12 u-mb-10">
        <div class="u-flex u-justify-between u-gap-10 u-wrap">
          <strong>${esc(author)} <span class="u-fs-11 u-c-text-muted u-fw-normal">${esc(role)}</span></strong>
          <span class="u-fs-11 u-c-text-muted">${esc(when)}</span>
        </div>
        <p class="u-m-8-0-0 u-fs-13 u-lh-1_8 u-ws-pre-wrap">${text ? esc(text) : '<em>بدون متن</em>'}</p>
        ${voiceUrl ? `<audio controls class="u-w-full u-mt-8" src="${esc(voiceUrl)}"></audio>` : ''}
        ${attachmentUrl ? `<a href="${esc(attachmentUrl)}" target="_blank" rel="noopener" class="u-inline-block u-mt-8 u-c-success-text u-fs-12"><i class="fa-solid fa-download"></i> دانلود پیوست</a>` : ''}
      </div>`;
  }

  function openTicket(id) {
    const t = allTickets.find(x => x.id === id);
    if (!t) return;
    currentTicketId = id;
    document.getElementById('support-modal-title').textContent = `پیام ${t.student?.name || 'ناشناس'}`;
    let html = messageCard(t.student?.name || 'فرستنده', roleLabel(t.student?.role), t.subject, fmtDate(t.createdAt), t.voiceUrl, t.attachmentUrl);
    (t.replies || []).forEach(r => {
      html += messageCard(r.mentorId ? 'راهبر' : 'پشتیبانی', 'پاسخ', r.message, fmtDate(r.createdAt), r.voiceUrl, r.attachmentUrl);
    });
    document.getElementById('support-thread').innerHTML = html;
    document.getElementById('support-reply-text').value = '';
    document.getElementById('support-resolve').style.display = String(t.status).toLowerCase() === 'resolved' ? 'none' : '';
    document.getElementById('support-ticket-modal').style.display = 'flex';
  }

  function closeModal() {
    document.getElementById('support-ticket-modal').style.display = 'none';
    currentTicketId = null;
  }

  async function sendReply() {
    const input = document.getElementById('support-reply-text');
    const message = input.value.trim();
    if (!message || !currentTicketId) return;
    try {
      const res = await request(`/api/v1/admin/tickets/${currentTicketId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'خطا در ثبت پاسخ', 'error');
        return;
      }
      const id = currentTicketId;
      await load();
      openTicket(id);
    } catch (e) {
      console.error(e);
      showToast('خطا در ارسال پاسخ', 'error');
    }
  }

  async function resolveTicket() {
    if (!currentTicketId) return;
    try {
      const res = await request(`/api/v1/admin/tickets/${currentTicketId}/resolve`, { method: 'POST' });
      if (!res.ok) {
        showToast('خطا در تغییر وضعیت', 'error');
        return;
      }
      closeModal();
      await load();
    } catch (e) {
      console.error(e);
    }
  }

  // The Jarchi tab has two sub views; this adds the third one.
  const originalSwitch = window.switchJarchiSubTab;
  window.switchJarchiSubTab = function (subtab) {
    const supportView = document.getElementById('jarchi-support-view');
    const supportBtn = document.getElementById('subtab-btn-support');
    if (subtab !== 'support') {
      if (supportView) supportView.style.display = 'none';
      if (supportBtn) {
        supportBtn.style.background = 'rgb(var(--fg-rgb) / 0.06)';
        supportBtn.style.color = 'var(--text-muted)';
        supportBtn.style.border = '1px solid rgb(var(--fg-rgb) / 0.1)';
        supportBtn.style.boxShadow = 'none';
      }
      if (typeof originalSwitch === 'function') originalSwitch(subtab);
      return;
    }

    ['jarchi-banners-view', 'jarchi-news-view'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    ['subtab-btn-banners', 'subtab-btn-news'].forEach(id => {
      const b = document.getElementById(id);
      if (!b) return;
      b.style.background = 'rgb(var(--fg-rgb) / 0.06)';
      b.style.color = 'var(--text-muted)';
      b.style.boxShadow = 'none';
      b.style.border = '1px solid rgb(var(--fg-rgb) / 0.1)';
    });
    if (supportBtn) {
      supportBtn.style.background = 'linear-gradient(135deg, var(--primary), var(--primary-strong))';
      supportBtn.style.color = 'white';
      supportBtn.style.border = 'none';
      supportBtn.style.boxShadow = '0 4px 12px rgb(var(--primary-rgb) / 0.35)';
    }
    ensureView();
    if (supportView) supportView.style.display = 'block';
    load();
  };

  // Show the number of open messages on the button as soon as the Jarchi tab is opened
  document.querySelector('[data-tab="news-tab"]')?.addEventListener('click', () => {
    ensureView();
    load();
  });
})();
