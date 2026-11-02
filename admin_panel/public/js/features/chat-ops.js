// Chat operations in the panel: support cases, abuse reports, bots, publishing, analytics and
// the inter-group desk. Classic script: load order is set in index.html.

const chatDate = v => (v ? new Date(v).toLocaleString('fa-IR') : '-');
const chatRow = (html) => `<div class="u-flex u-gap-6 u-items-center u-mb-5 u-fs-12_5 u-c-text">${html}</div>`;
const chatBtn = (fn, args, label) => `<button type="button" class="btn-action u-p-5-10 u-fs-11 u-pointer" data-click="${fn}" data-click-args="${esc(JSON.stringify(args))}">${esc(label)}</button>`;

// ---- support cases ----
const CASE_STATUS = { open: 'باز', reviewing: 'در بررسی', resolved: 'حل‌شده' };

window.loadSupportCases = async function() {
  const box = document.getElementById('support-cases-list');
  const status = document.getElementById('support-cases-filter').value;
  try {
    const cases = await NopaApi.json(`/api/v1/admin/support-cases${status ? `?status=${status}` : ''}`);
    box.innerHTML = cases.map(c => chatRow(`
      <span class="u-flex-1">${esc(c.user.name)}: ${esc(c.subject)}</span>
      <span class="u-fs-11 u-c-text-muted">${esc(c.category)} · ${esc(CASE_STATUS[c.status] || c.status)}${c.assigneeName ? ` · ${esc(c.assigneeName)}` : ''}${c.rating ? ` · امتیاز ${esc(String(c.rating))}` : ''}</span>
      ${chatBtn('openSupportCase', [String(c.id)], 'باز کردن')}`)).join('') || '<div class="u-fs-12_5 u-c-text-muted">پرونده‌ای وجود ندارد.</div>';
  } catch (e) {
    box.textContent = e.message || 'خطا در دریافت پرونده‌ها';
  }
};

window.openSupportCase = async function(id) {
  const box = document.getElementById('support-case-detail');
  try {
    const messages = await NopaApi.json(`/api/v1/admin/support-cases/${id}/messages`);
    box.innerHTML = messages.map(m => chatRow(`<span class="u-flex-1">${esc(m.sender ? m.sender.name : 'ربات')}: ${esc(m.body || 'فایل')}</span><span class="u-fs-11 u-c-text-muted">${esc(chatDate(m.createdAt))}</span>`)).join('') + `
      <input type="text" id="support-case-reply" maxlength="4000" placeholder="پاسخ..." class="u-w-full u-p-6-10 u-bg-surface-2 u-bd-border-strong u-r-6 u-c-text u-fs-12_5 u-mb-5">
      <div class="u-flex u-gap-6">
        ${chatBtn('replySupportCase', [String(id)], 'ارسال پاسخ')}
        ${chatBtn('claimSupportCase', [String(id)], 'برداشتن پرونده')}
        ${chatBtn('resolveSupportCase', [String(id)], 'بستن پرونده')}
      </div>`;
  } catch (e) {
    showToast(e.message || 'خطا در دریافت پرونده', 'error');
  }
};

async function supportAction(id, action, body) {
  try {
    await NopaApi.json(`/api/v1/admin/support-cases/${id}/${action}`, { method: 'POST', body: JSON.stringify(body || {}) });
    window.openSupportCase(id);
    window.loadSupportCases();
  } catch (e) {
    showToast(e.message || 'خطا در ثبت', 'error');
  }
}
window.replySupportCase = id => supportAction(id, 'reply', { body: document.getElementById('support-case-reply').value });
window.claimSupportCase = id => supportAction(id, 'claim');
window.resolveSupportCase = id => supportAction(id, 'resolve');

// ---- reports, bots, publishing, analytics (chat tab) ----
window.loadChatOps = async function() {
  const reports = document.getElementById('chat-reports-list');
  const bots = document.getElementById('chat-bots-list');
  const analytics = document.getElementById('chat-analytics');
  const target = document.getElementById('chat-publish-space');
  try {
    const list = await NopaApi.json('/api/v1/admin/chat-manage/reports');
    reports.innerHTML = list.map(r => chatRow(`
      <span class="u-flex-1">${esc(r.message.sender ? r.message.sender.name : '')}: ${esc(r.message.body)} (${esc(r.reason)})</span>
      ${chatBtn('resolveChatReport', [String(r.id), true], 'حذف پیام')}
      ${chatBtn('resolveChatReport', [String(r.id), false], 'رد گزارش')}`)).join('') || '<div class="u-fs-12_5 u-c-text-muted">گزارشی وجود ندارد.</div>';

    const data = await NopaApi.json('/api/v1/admin/chat-manage/bots');
    bots.innerHTML = data.bots.map(b => chatRow(`
      <label class="u-flex u-gap-6 u-items-center u-flex-1"><input type="checkbox" class="chat-bot-toggle" data-key="${esc(b.key)}" ${b.enabled ? 'checked' : ''}>${esc(b.name)}</label>`)).join('') + `
      <input type="text" id="chat-banned-words" placeholder="واژه‌های ممنوع، جداشده با ویرگول" value="${esc(((data.bots.find(b => b.key === 'moderation') || {}).settings || {}).bannedWords?.join('، ') || '')}" class="u-w-full u-p-6-10 u-bg-surface-2 u-bd-border-strong u-r-6 u-c-text u-fs-12_5 u-mb-5">
      ${chatBtn('saveChatBots', [], 'ذخیره‌ی ربات‌ها')}`;

    const spaces = await NopaApi.json('/api/v1/admin/chat-manage/spaces');
    target.innerHTML = spaces.map(s => `<option value="${esc(s.id)}">${esc(s.caravanName ? `${s.title} · ${s.caravanName}` : s.title)}</option>`).join('');
  } catch (e) {
    console.error('loadChatOps error', e);
  }
  if (!analytics) return;
  try {
    const a = await NopaApi.json('/api/v1/admin/chat-manage/analytics');
    analytics.innerHTML = a.caravans.map(c => chatRow(`
      <span class="u-flex-1">${esc(c.name)} · ${esc(c.mentorName || '-')}</span>
      <span class="u-fs-11 u-c-text-muted">${esc(String(c.activeMembers))} از ${esc(String(c.members))} فعال · ${esc(String(c.messages))} پیام · میانگین کلاف ${esc(String(c.averageNakh ?? '-'))}</span>`)).join('') +
      (a.confusionByStation.length ? `<div class="u-c-text-soft u-fs-12 u-bold u-mb-5 u-mt-15">منزلگاه‌های پرابهام</div>` + a.confusionByStation.map(s => chatRow(`<span class="u-flex-1">${esc(s.title)}</span><span class="u-fs-11 u-c-text-muted">${esc(String(s.count))} نشانه‌ی ابهام</span>`)).join('') : '');
  } catch (e) {
    analytics.textContent = 'آمار در دسترس نیست.';
  }
};

window.resolveChatReport = async function(id, deleteMessage) {
  try {
    await NopaApi.json(`/api/v1/admin/chat-manage/reports/${id}/resolve`, { method: 'POST', body: JSON.stringify({ deleteMessage }) });
    window.loadChatOps();
  } catch (e) {
    showToast(e.message || 'خطا در ثبت', 'error');
  }
};

window.saveChatBots = async function() {
  const words = document.getElementById('chat-banned-words').value.split(/[،,]/).map(w => w.trim()).filter(Boolean);
  try {
    for (const el of document.querySelectorAll('.chat-bot-toggle')) {
      const key = el.dataset.key;
      await NopaApi.json(`/api/v1/admin/chat-manage/bots/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: el.checked, settings: key === 'moderation' ? { bannedWords: words } : undefined }),
      });
    }
    showToast('ربات‌ها ذخیره شدند.', 'success');
  } catch (e) {
    showToast(e.message || 'خطا در ذخیره', 'error');
  }
};

window.publishChatMessage = async function() {
  const body = document.getElementById('chat-publish-body');
  const when = document.getElementById('chat-publish-at').value;
  try {
    const r = await NopaApi.json('/api/v1/admin/chat-manage/publish', {
      method: 'POST',
      body: JSON.stringify({ spaceId: document.getElementById('chat-publish-space').value, body: body.value, sendAt: when ? new Date(when).toISOString() : undefined }),
    });
    body.value = '';
    showToast(r.scheduled ? 'پیام زمان‌بندی شد.' : 'پیام منتشر شد.', 'success');
  } catch (e) {
    showToast(e.message || 'خطا در انتشار', 'error');
  }
};

// ---- inter-group desk (in the ranking dialog) ----
window.loadInterGroupDesk = async function(challengeId) {
  const box = document.getElementById('intergroup-desk');
  if (!box) return;
  try {
    const d = await NopaApi.json(`/api/v1/admin/intergroup/${challengeId}/board`);
    box.innerHTML = `<div class="u-c-text-soft u-fs-12 u-bold u-mb-5">میز رقابت</div>` + d.rows.map(r => chatRow(`
      <span class="u-flex-1">${esc(r.name)}</span>
      <span class="u-fs-11 u-c-text-muted">${r.delivered ? `اثر ${esc(String(r.anonCode))}${r.onTime ? '' : ' (با تأخیر)'}` : 'بدون اثر'} · ${esc(String(r.judgeCount))} داور · میانگین ${esc(String(r.judgeAverage))} · پوشش ${esc(String(r.activeShare))}٪ · ${r.tiersConfirmed ? 'سطوح تأیید شده' : 'سطوح تأیید نشده'} · امتیاز ${esc(String(r.score))}</span>`)).join('') +
      d.questions.filter(q => !q.answer).map(q => chatRow(`
        <span class="u-flex-1">پرسش: ${esc(q.body)}</span>
        <input type="text" id="ig-answer-${esc(q.id)}" placeholder="پاسخ عمومی" class="u-p-6-10 u-bg-surface-2 u-bd-border-strong u-r-6 u-c-text u-fs-12_5">
        ${chatBtn('answerInterGroupQuestion', [String(q.id), String(challengeId)], 'انتشار')}`)).join('');
  } catch (e) {
    box.textContent = e.message || 'خطا در دریافت میز رقابت';
  }
};

window.answerInterGroupQuestion = async function(id, challengeId) {
  try {
    await NopaApi.json(`/api/v1/admin/intergroup/questions/${id}/answer`, { method: 'POST', body: JSON.stringify({ answer: document.getElementById(`ig-answer-${id}`).value }) });
    window.loadInterGroupDesk(challengeId);
  } catch (e) {
    showToast(e.message || 'خطا در انتشار پاسخ', 'error');
  }
};
