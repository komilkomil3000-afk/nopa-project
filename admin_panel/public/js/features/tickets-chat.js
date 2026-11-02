// Support: tickets, mentor ticket workbench, chat oversight.
// Split out of the former app.js (Phase 7). Classic script: shares globals with the other modules;
// load order is set in index.html.

// Tickets
async function loadTickets() {
  try {
    const res = await request('/api/v1/admin/tickets');
    if (!res.ok) return;
    const tickets = await res.json();
    const tbody = document.querySelector('#mentor-tickets-table tbody');
    if (!tbody) return;
    
    NopaTable.render(tbody, tickets, t => `
      <tr>
        <td>${esc(t.student?.name || 'ناشناس')}</td>
        <td>${esc(t.category)}</td>
        <td>${esc(t.subject)}</td>
        <td><span class="badge ${t.status === 'OPEN' ? 'badge-warning' : 'badge-success'}">${t.status}</span></td>
        <td>${new Date(t.createdAt).toLocaleDateString('fa-IR')}</td>
        <td>${t.rating || '-'}</td>
        <td>
          <button class="page-btn btn-view" data-click="showToast" data-click-args="[&quot;نمایش جزئیات به زودی&quot;,&quot;info&quot;]"><i class="fa-solid fa-eye"></i></button>
        </td>
      </tr>
    `, { empty: 'تیکتی ثبت نشده است', emptyIcon: 'fa-solid fa-inbox' });
  } catch (e) {
    console.error('Error loading tickets', e);
  }
}

// 2. Mentors Tickets Tab
async function loadMentorTickets() {
  try {
    const res = await request('/api/v1/support/tickets');
    const tickets = await res.json();
    const tbody = document.querySelector('#mentor-tickets-table tbody');
    if (!tbody) return;
    tbody.innerHTML = tickets.map(t => `
      <tr>
        <td>${esc(t.student?.name || 'نامشخص')}</td>
        <td>${esc(t.category)}</td>
        <td>${esc(t.subject)}</td>
        <td>${t.status === 'resolved' ? '<span class="u-c-green">پاسخ‌داده</span>' : '<span class="u-c-orange">باز</span>'}</td>
        <td>${new Date(t.createdAt).toLocaleDateString('fa-IR')}</td>
        <td>${t.ratingGiven || '-'}</td>
        <td>
          <button class="btn-icon" data-click="viewTicketThread" data-click-args="${esc(JSON.stringify([String(t.id)]))}"><i class="fa-solid fa-reply"></i></button>
        </td>
      </tr>
    `).join('');
  } catch(e) {
    console.error(e);
  }
}

let currentTicketId = null;
window.closeTicketDrawer = function() {
  const modal = document.getElementById('ticket-drawer-modal');
  if (modal) modal.style.display = 'none';
};
window.viewTicketThread = async function(ticketId) {
  currentTicketId = ticketId;
  const res = await request('/api/v1/support/tickets');
  const tickets = await res.json();
  const t = tickets.find(x => x.id === ticketId);
  if (!t) return;

  const titleEl = document.getElementById('ticket-drawer-title');
  if (titleEl) titleEl.innerText = t.subject || 'جزئیات تیکت';
  const container = document.getElementById('ticket-thread-container');
  if (!container) return;

  const buildMessageCard = (author, role, message, voiceUrl, attachmentUrl) => {
    let card = `
      <div class="u-p-14 u-bg-fg-5 u-r-12 u-mb-12">
        <div class="u-flex u-justify-between u-wrap u-gap-10 u-items-center">
          <strong>${esc(author)}</strong>
          <span class="u-fs-11 u-c-text-muted">${esc(role)}</span>
        </div>
        <p class="u-mt-10 u-fs-13 u-lh-1_6">${message ? esc(message) : '<em>بدون متن</em>'}</p>
    `;
    if (voiceUrl) {
      card += `<audio controls class="u-w-full u-mt-8" src="${esc(voiceUrl)}"></audio>`;
    }
    if (attachmentUrl) {
      card += `<a href="${esc(attachmentUrl)}" target="_blank" class="u-inline-block u-mt-8 u-c-success-text u-fs-12 u-no-underline"><i class="fa-solid fa-download"></i> دانلود پیوست</a>`;
    }
    card += '</div>';
    return card;
  };

  let html = buildMessageCard(t.student?.name || 'دانش‌آموز', 'درخواست پشتیبانی', t.subject || '', t.voiceUrl, t.attachmentUrl);
  (t.replies || []).forEach(r => {
    const author = r.mentorId ? 'راهنما' : 'پشتیبان';
    const role = r.mentorId ? 'پاسخ مربی' : 'پاسخ پشتیبانی';
    html += buildMessageCard(author, role, r.message || '', r.voiceUrl, r.attachmentUrl);
  });

  container.innerHTML = html;
  const modal = document.getElementById('ticket-drawer-modal');
  if (modal) modal.style.display = 'flex';
};

document.getElementById('btn-submit-ticket-reply')?.addEventListener('click', async () => {
  const msgEl = document.getElementById('ticket-reply-text');
  if (!msgEl || !currentTicketId) return;

  const msg = msgEl.value.trim();
  if (!msg) return;

  try {
    const res = await request(`/api/v1/support/tickets/${currentTicketId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    });
    if (!res.ok) {
      const data = await res.json();
      showToast(data?.error || 'خطا در ثبت پاسخ', 'error');
      return;
    }
    msgEl.value = '';
    viewTicketThread(currentTicketId);
    if (typeof loadMentorTickets === 'function') loadMentorTickets();
  } catch (error) {
    console.error(error);
    showToast('خطا در ارسال پاسخ', 'error');
  }
});

// Removed duplicate click listener for mentor tickets

// 3. Mentors League Tab
