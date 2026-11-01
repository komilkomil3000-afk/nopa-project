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
          <button class="page-btn btn-view" onclick="showToast('نمایش جزئیات به زودی', 'info')"><i class="fa-solid fa-eye"></i></button>
        </td>
      </tr>
    `, { empty: 'تیکتی ثبت نشده است', emptyIcon: 'fa-solid fa-inbox' });
  } catch (e) {
    console.error('Error loading tickets', e);
  }
}

// ---- CHAT OVERSIGHT ----
let chatPage = 1;
async function loadChats() {
  try {
    const filterCaravanId = document.getElementById('chat-filter-caravanId').value || '';
    const res = await request(`/api/v1/admin/chat?page=${chatPage}&limit=50&caravanId=${encodeURIComponent(filterCaravanId)}`);
    const data = await res.json();

    const tbody = document.querySelector('#chat-logs-table tbody');
    tbody.innerHTML = '';

    if (data.messages.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">هیچ پیامی یافت نشد</td></tr>';
      return;
    }

    data.messages.forEach(msg => {
      const typeStr = msg.caravan ? `گروه: ${esc(msg.caravan.name)}` : `مستقیم به: ${esc(msg.receiver ? msg.receiver.name : '؟')}`;
      const fileBadge = msg.fileUrl ? `<a href="${esc(msg.fileUrl)}" target="_blank" class="badge" style="background:var(--success); color:white;"><i class="fa-solid fa-paperclip"></i> ${esc(msg.fileType)}</a>` : '-';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="direction:ltr; text-align:right;">${new Date(msg.createdAt).toLocaleString('fa-IR')}</td>
        <td>${esc(msg.sender.name)}</td>
        <td>${typeStr}</td>
        <td style="max-width: 250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(msg.messageText)}</td>
        <td>${fileBadge}</td>
        <td>
          <button class="btn-icon" style="color:var(--danger);" onclick="deleteChat('${msg.id}')"><i class="fa-solid fa-trash"></i></button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load chats:', err);
  }
}

async function deleteChat(id) {
  if (!(await NopaConfirm('آیا از حذف این پیام اطمینان دارید؟'))) return;
  try {
    const res = await request(`/api/v1/admin/chat/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('پیام حذف شد', 'success');
      loadChats();
    } else {
      const d = await res.json();
      showToast(d.error || 'خطا در حذف پیام', 'error');
    }
  } catch (e) {
    console.error(e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const loadChatsBtn = document.getElementById('btn-load-chats');
  if (loadChatsBtn) loadChatsBtn.addEventListener('click', () => { chatPage = 1; loadChats(); });
});

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
        <td>${t.status === 'resolved' ? '<span style="color:green">پاسخ‌داده</span>' : '<span style="color:orange">باز</span>'}</td>
        <td>${new Date(t.createdAt).toLocaleDateString('fa-IR')}</td>
        <td>${t.ratingGiven || '-'}</td>
        <td>
          <button class="btn-icon" onclick="viewTicketThread('${t.id}')"><i class="fa-solid fa-reply"></i></button>
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
      <div style="padding:14px; background:rgb(var(--fg-rgb) / 0.05); border-radius:12px; margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px; align-items:center;">
          <strong>${esc(author)}</strong>
          <span style="font-size:11px; color:var(--text-muted);">${esc(role)}</span>
        </div>
        <p style="margin-top:10px; font-size:13px; line-height:1.6;">${message ? esc(message) : '<em>بدون متن</em>'}</p>
    `;
    if (voiceUrl) {
      card += `<audio controls style="width:100%; margin-top:8px;" src="${esc(voiceUrl)}"></audio>`;
    }
    if (attachmentUrl) {
      card += `<a href="${esc(attachmentUrl)}" target="_blank" style="display:inline-block; margin-top:8px; color:var(--success-text); font-size:12px; text-decoration:none;"><i class="fa-solid fa-download"></i> دانلود پیوست</a>`;
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
