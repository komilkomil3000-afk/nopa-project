// ==================== SUPPORT MESSAGES (تابلوی اعلانات جارچی > پیام‌های پشتیبانی) ====================
// Messages sent from the app's "ارسال پیام به پشتیبانی" are stored as SupportTicket rows
// (category "پیام به پشتیبانی"). This view lists them, shows the conversation, lets the admin answer
// (the sender gets an in-app notification) and mark them as resolved.

(function () {
  const SUPPORT_CATEGORY = 'پیام به پشتیبانی';
  const STATUS_LABEL = { open: 'باز', answered: 'پاسخ داده شده', resolved: 'حل شده' };
  const STATUS_COLOR = { open: '#f59e0b', answered: '#38bdf8', resolved: '#10b981' };

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
    const color = STATUS_COLOR[key] || '#94a3b8';
    return `<span style="background:${color}22; color:${color}; border:1px solid ${color}66; padding:2px 9px; border-radius:8px; font-size:11.5px; font-weight:bold;">${esc(STATUS_LABEL[key] || key)}</span>`;
  }

  function ensureView() {
    const view = document.getElementById('jarchi-support-view');
    if (!view || view.dataset.ready) return view;
    view.dataset.ready = '1';
    view.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px;">
        <h4 style="margin:0; color:#f8fafc; font-size:15px; display:flex; align-items:center; gap:6px;">
          <i class="fa-solid fa-headset" style="color:#38bdf8;"></i> صندوق پیام‌های پشتیبانی
        </h4>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <select id="support-filter-scope" class="input-ctrl" style="min-width:170px;">
            <option value="support">فقط پیام‌های «ارسال به پشتیبانی»</option>
            <option value="all">همه تیکت‌ها (شامل درخواست‌های دیگر)</option>
          </select>
          <select id="support-filter-status" class="input-ctrl" style="min-width:130px;">
            <option value="all">همه وضعیت‌ها</option>
            <option value="open">باز</option>
            <option value="answered">پاسخ داده شده</option>
            <option value="resolved">حل شده</option>
          </select>
          <input id="support-filter-search" class="input-ctrl" placeholder="جستجو در نام یا متن پیام" style="min-width:180px;">
          <button type="button" id="support-refresh" class="btn-action" style="border-radius:8px; padding:8px 14px; cursor:pointer;">
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
      <div id="support-ticket-modal" class="modal-overlay" style="display:none; align-items:center; justify-content:center;">
        <div class="modal-content glass" style="max-width:760px; width:92%; display:flex; flex-direction:column; background:rgba(30,41,59,0.97);">
          <div class="modal-header" style="border-bottom:1px solid rgba(255,255,255,0.1);">
            <h3 id="support-modal-title" style="margin:0;">پیام پشتیبانی</h3>
            <button type="button" class="modal-close" id="support-modal-close">&times;</button>
          </div>
          <div style="padding:18px; display:flex; flex-direction:column; gap:14px; max-height:70vh; overflow-y:auto;">
            <div id="support-thread"></div>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <label style="color:var(--text-muted);">پاسخ پشتیبانی (برای فرستنده اعلان می‌شود)</label>
              <textarea id="support-reply-text" class="input-ctrl" rows="4" placeholder="متن پاسخ را بنویسید..."></textarea>
              <div style="display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap;">
                <button type="button" id="support-resolve" class="btn-action" style="border-radius:8px; padding:8px 16px; cursor:pointer;">
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
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding:24px;">پیامی یافت نشد</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(t => `
      <tr>
        <td>${esc(t.student?.name || 'ناشناس')}<div style="font-size:11px; color:#94a3b8; direction:ltr; text-align:right;">${esc(t.student?.phoneNumber || '')}</div></td>
        <td>${esc(roleLabel(t.student?.role))}${t.student?.caravan?.name ? ' • ' + esc(t.student.caravan.name) : ''}</td>
        <td style="max-width:320px;">${t.category !== SUPPORT_CATEGORY ? `<span style="color:#94a3b8; font-size:11px;">[${esc(t.category)}]</span> ` : ''}${esc(String(t.subject || '').slice(0, 120))}</td>
        <td>${statusBadge(t.status)}</td>
        <td>${fmtDate(t.createdAt)}</td>
        <td><button type="button" class="page-btn btn-view" data-support-open="${esc(t.id)}"><i class="fa-solid fa-eye"></i></button></td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-support-open]').forEach(btn =>
      btn.addEventListener('click', () => openTicket(btn.getAttribute('data-support-open'))));
  }

  function messageCard(author, role, text, when, voiceUrl, attachmentUrl) {
    return `
      <div style="padding:12px 14px; background:rgba(255,255,255,0.05); border-radius:12px; margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
          <strong>${esc(author)} <span style="font-size:11px; color:#9ca3af; font-weight:normal;">${esc(role)}</span></strong>
          <span style="font-size:11px; color:#9ca3af;">${esc(when)}</span>
        </div>
        <p style="margin:8px 0 0; font-size:13px; line-height:1.8; white-space:pre-wrap;">${text ? esc(text) : '<em>بدون متن</em>'}</p>
        ${voiceUrl ? `<audio controls style="width:100%; margin-top:8px;" src="${esc(voiceUrl)}"></audio>` : ''}
        ${attachmentUrl ? `<a href="${esc(attachmentUrl)}" target="_blank" rel="noopener" style="display:inline-block; margin-top:8px; color:#10b981; font-size:12px;"><i class="fa-solid fa-download"></i> دانلود پیوست</a>` : ''}
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
        alert(data.error || 'خطا در ثبت پاسخ');
        return;
      }
      const id = currentTicketId;
      await load();
      openTicket(id);
    } catch (e) {
      console.error(e);
      alert('خطا در ارسال پاسخ');
    }
  }

  async function resolveTicket() {
    if (!currentTicketId) return;
    try {
      const res = await request(`/api/v1/admin/tickets/${currentTicketId}/resolve`, { method: 'POST' });
      if (!res.ok) {
        alert('خطا در تغییر وضعیت');
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
        supportBtn.style.background = 'rgba(255,255,255,0.06)';
        supportBtn.style.color = '#94a3b8';
        supportBtn.style.border = '1px solid rgba(255,255,255,0.1)';
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
      b.style.background = 'rgba(255,255,255,0.06)';
      b.style.color = '#94a3b8';
      b.style.boxShadow = 'none';
      b.style.border = '1px solid rgba(255,255,255,0.1)';
    });
    if (supportBtn) {
      supportBtn.style.background = 'linear-gradient(135deg, #0284c7, #0369a1)';
      supportBtn.style.color = 'white';
      supportBtn.style.border = 'none';
      supportBtn.style.boxShadow = '0 4px 12px rgba(2, 132, 199, 0.35)';
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
