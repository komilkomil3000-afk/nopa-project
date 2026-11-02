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

    const announce = data.bots.find(b => b.key === 'announce');
    window.chatTemplates = (announce && announce.settings && announce.settings.templates) || [];
    document.getElementById('chat-template').innerHTML = '<option value="">بدون قالب</option>' + window.chatTemplates.map((t, i) => `<option value="${i}">${esc(t.title)}</option>`).join('');
    document.getElementById('chat-templates-edit').value = window.chatTemplates.map(t => `${t.title} | ${t.body}`).join('\n');
    window.loadChatGroups();

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
  const fileInput = document.getElementById('chat-publish-file');
  const spaceId = document.getElementById('chat-publish-space').value;
  try {
    const attachmentIds = [];
    if (fileInput.files[0]) {
      const form = new FormData();
      form.append('spaceId', spaceId);
      form.append('file', fileInput.files[0]);
      const up = await request('/api/v1/admin/chat-manage/uploads', { method: 'POST', body: form });
      const data = await up.json();
      if (!up.ok) throw new Error(data.error || 'خطا در ارسال فایل');
      attachmentIds.push(data.id);
    }
    const r = await NopaApi.json('/api/v1/admin/chat-manage/publish', {
      method: 'POST',
      body: JSON.stringify({ spaceId, body: body.value, attachmentIds, sendAt: when ? new Date(when).toISOString() : undefined }),
    });
    body.value = '';
    fileInput.value = '';
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
    box.innerHTML = `<div class="u-c-text-soft u-fs-12 u-bold u-mb-5">میز رقابت</div>` + (d.challenge.judgingOpen ? '<div class="u-fs-12 u-c-text-muted u-mb-5">داوری باز است و آثار قفل شده‌اند.</div>' : chatRow(`<span class="u-flex-1 u-fs-12 u-c-text-muted">داوری پس از پایان مهلت باز می‌شود.</span>${chatBtn('startInterGroupJudging', [String(challengeId)], 'شروع داوری')}`)) + d.rows.map(r => chatRow(`
      <span class="u-flex-1">${esc(r.name)}</span>
      <span class="u-fs-11 u-c-text-muted">${r.delivered ? `اثر ${esc(String(r.anonCode))}${r.onTime ? '' : ' (با تأخیر)'}` : 'بدون اثر'} · ${esc(String(r.judgeCount))} داور · میانگین ${esc(String(r.judgeAverage))} · پوشش ${esc(String(r.activeShare))}٪ · ${r.tiersConfirmed ? 'سطوح تأیید شده' : 'سطوح تأیید نشده'} · امتیاز ${esc(String(r.score))}</span>${chatBtn('openTierEditor', [String(challengeId), String(r.caravanId)], 'سطوح')}`)).join('') + '<div id="intergroup-tiers" class="u-mt-15"></div>' +
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

window.startInterGroupJudging = async function(challengeId) {
  if (!(await NopaConfirm('با شروع داوری آثار قفل می‌شوند و راهبران آن‌ها را می‌بینند. ادامه می‌دهید؟'))) return;
  try {
    await NopaApi.json(`/api/v1/admin/intergroup/${challengeId}/start-judging`, { method: 'POST', body: '{}' });
    window.loadInterGroupDesk(challengeId);
  } catch (e) {
    showToast(e.message || 'خطا در شروع داوری', 'error');
  }
};

const TIER_LABELS = { full: 'فعال کامل', partner: 'همراه', minimal: 'حداقلی', inactive: 'غیرفعال' };

window.openTierEditor = async function(challengeId, caravanId) {
  const box = document.getElementById('intergroup-tiers');
  try {
    const d = await NopaApi.json(`/api/v1/admin/intergroup/${challengeId}/tiers?caravanId=${caravanId}`);
    box.innerHTML = d.rows.map(r => chatRow(`
      <span class="u-flex-1">${esc(r.user.name)} · ${esc(String(r.usefulMessages))} پیام مفید${r.confirmed ? '' : ' · تأیید نشده'}</span>
      <select class="select-ctrl tier-select" data-user="${esc(r.user.id)}">
        ${Object.entries(TIER_LABELS).map(([k, v]) => `<option value="${k}" ${k === r.tier ? 'selected' : ''}>${v}</option>`).join('')}
      </select>`)).join('') + chatBtn('saveTiers', [String(challengeId), String(caravanId)], 'تأیید سطوح');
  } catch (e) {
    box.textContent = e.message || 'خطا در دریافت سطوح';
  }
};

window.saveTiers = async function(challengeId, caravanId) {
  const tiers = {};
  document.querySelectorAll('#intergroup-tiers .tier-select').forEach(el => { tiers[el.dataset.user] = el.value; });
  try {
    await NopaApi.json(`/api/v1/admin/intergroup/${challengeId}/tiers`, { method: 'PUT', body: JSON.stringify({ caravanId, tiers }) });
    showToast('سطوح تأیید شد.', 'success');
    window.loadInterGroupDesk(challengeId);
  } catch (e) {
    showToast(e.message || 'خطا در ثبت سطوح', 'error');
  }
};

// ---- groups ----
window.loadChatGroups = async function() {
  const box = document.getElementById('chat-groups-list');
  if (!box) return;
  try {
    const groups = await NopaApi.json('/api/v1/admin/chat-manage/groups');
    box.innerHTML = groups.map(g => chatRow(`
      <span class="u-flex-1">${esc(g.title)}${g.caravanName ? ` · ${esc(g.caravanName)}` : ''} · ${esc(String(g.members.length))} عضو</span>
      ${chatBtn('openChatGroup', [String(g.id)], 'اعضا')}
      ${chatBtn('renameChatGroup', [String(g.id), String(g.title)], 'تغییر نام')}
      ${chatBtn('deleteChatGroup', [String(g.id), String(g.title)], 'حذف')}`)).join('') || '<div class="u-fs-12_5 u-c-text-muted">هنوز گروهی ساخته نشده است.</div>';
    window.chatGroupsCache = groups;
    const caravans = await NopaApi.json('/api/v1/admin/chat-manage/spaces').catch(() => []);
    const select = document.getElementById('chat-group-caravan');
    const seen = new Set();
    select.innerHTML = '<option value="">بدون کاروان</option>' + caravans.filter(s => s.type === 'caravan' && !seen.has(s.id) && seen.add(s.id)).map(s => `<option value="${esc(s.caravanId || '')}">${esc(s.caravanName || s.title)}</option>`).join('');
  } catch (e) {
    box.textContent = e.message || 'گروه‌ها در دسترس نیستند.';
  }
};

window.createChatGroup = async function() {
  const title = document.getElementById('chat-group-title');
  try {
    await NopaApi.json('/api/v1/admin/chat-manage/groups', { method: 'POST', body: JSON.stringify({ title: title.value, caravanId: document.getElementById('chat-group-caravan').value || undefined, memberIds: [] }) });
    title.value = '';
    window.loadChatGroups();
  } catch (e) {
    showToast(e.message || 'خطا در ساخت گروه', 'error');
  }
};

window.renameChatGroup = async function(id, current) {
  const title = window.prompt('نام تازه‌ی گروه', current);
  if (!title) return;
  try {
    await NopaApi.json(`/api/v1/admin/chat-manage/groups/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) });
    window.loadChatGroups();
  } catch (e) {
    showToast(e.message || 'خطا در تغییر نام', 'error');
  }
};

window.deleteChatGroup = async function(id, title) {
  if (!(await NopaConfirm(`گروه «${title}» و همه‌ی پیام‌هایش حذف می‌شود. ادامه می‌دهید؟`))) return;
  try {
    await NopaApi.json(`/api/v1/admin/chat-manage/groups/${id}`, { method: 'DELETE' });
    document.getElementById('chat-group-members').innerHTML = '';
    window.loadChatGroups();
  } catch (e) {
    showToast(e.message || 'خطا در حذف گروه', 'error');
  }
};

window.openChatGroup = async function(id) {
  const box = document.getElementById('chat-group-members');
  const group = (window.chatGroupsCache || []).find(g => g.id === id);
  if (!group) return;
  try {
    const query = group.caravanId ? `?caravanId=${group.caravanId}` : '';
    const people = await NopaApi.json(`/api/v1/admin/chat-manage/groups/candidates${query}`);
    const memberIds = new Set(group.members.map(m => m.id));
    box.innerHTML = `<div class="u-c-text-soft u-fs-12 u-bold u-mb-5">اعضای ${esc(group.title)}</div>` + group.members.map(m => chatRow(`<span class="u-flex-1">${esc(m.name)}</span>${chatBtn('removeChatGroupMember', [String(id), String(m.id)], 'حذف')}`)).join('') + `
      <select id="chat-group-add" class="select-ctrl u-mb-5">${people.filter(p => !memberIds.has(p.id)).map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select>
      ${chatBtn('addChatGroupMember', [String(id)], 'افزودن عضو')}`;
  } catch (e) {
    box.textContent = e.message || 'خطا در دریافت اعضا';
  }
};

async function refreshGroup(id) {
  await window.loadChatGroups();
  await window.openChatGroup(id);
}

window.addChatGroupMember = async function(id) {
  try {
    await NopaApi.json(`/api/v1/admin/chat-manage/groups/${id}/members`, { method: 'POST', body: JSON.stringify({ memberIds: [document.getElementById('chat-group-add').value] }) });
    await refreshGroup(id);
  } catch (e) {
    showToast(e.message || 'خطا در افزودن عضو', 'error');
  }
};

window.removeChatGroupMember = async function(id, userId) {
  try {
    await NopaApi.json(`/api/v1/admin/chat-manage/groups/${id}/members/${userId}`, { method: 'DELETE' });
    await refreshGroup(id);
  } catch (e) {
    showToast(e.message || 'خطا در حذف عضو', 'error');
  }
};

// ---- templates ----
window.applyChatTemplate = function() {
  const template = (window.chatTemplates || [])[Number(document.getElementById('chat-template').value)];
  if (template) document.getElementById('chat-publish-body').value = template.body;
};

window.saveChatTemplates = async function() {
  const templates = document.getElementById('chat-templates-edit').value.split('\n').map(line => {
    const [title, ...rest] = line.split('|');
    return { title: title.trim(), body: rest.join('|').trim() };
  }).filter(t => t.title && t.body);
  try {
    await NopaApi.json('/api/v1/admin/chat-manage/bots/announce', { method: 'PUT', body: JSON.stringify({ enabled: true, settings: { templates } }) });
    showToast('قالب‌ها ذخیره شدند.', 'success');
    window.loadChatOps();
  } catch (e) {
    showToast(e.message || 'خطا در ذخیره قالب‌ها', 'error');
  }
};

window.muteChatMember = async function(spaceId, userId, minutes) {
  try {
    await NopaApi.json(`/api/v1/admin/chat-manage/spaces/${spaceId}/members/${userId}/mute`, { method: 'POST', body: JSON.stringify({ minutes }) });
    showToast(minutes ? 'عضو تا یک ساعت نمی‌تواند پیام بفرستد.' : 'بی‌صدا برداشته شد.', 'success');
  } catch (e) {
    showToast(e.message || 'خطا در ثبت', 'error');
  }
};
