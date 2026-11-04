// Chat operations in the panel: the chat tab bento (reports, bots and templates, groups,
// analytics, scheduled posts) and the inter-group desk. Classic script: load order is set in index.html.

const chatDate = v => (v ? new Date(v).toLocaleString('fa-IR') : '-');
const chatRow = (html) => `<div class="u-flex u-gap-6 u-items-center u-mb-5 u-fs-12_5 u-c-text">${html}</div>`;
const chatBtn = (fn, args, label) => `<button type="button" class="btn-action u-p-5-10 u-fs-11 u-pointer" data-click="${fn}" data-click-args="${esc(JSON.stringify(args))}">${esc(label)}</button>`;

// Support cases have their own tab: js/features/support-cases.js

// ---- chat tab bento: stats, reports, analytics, scheduled posts (js/features/chat-settings.js has the switch) ----
const opsEl = id => document.getElementById(id);
const faNum = n => Number(n || 0).toLocaleString('fa-IR');
const tileEmpty = text => `<div class="lst-empty">${esc(text)}</div>`;
// Rows inside a tile: the stations tab's list item, actions on the end
const tileRow = (main, side, actions) => `<li class="lst-list-item"><span class="lst-grow">${main}</span>${side ? `<span class="chs-side">${side}</span>` : ''}${actions || ''}</li>`;
const tileBtn = (fn, args, icon, label, danger) => `<button type="button" class="chs-act${danger ? ' is-danger' : ''}" data-click="${fn}" data-click-args="${esc(JSON.stringify(args))}" title="${esc(label)}" aria-label="${esc(label)}"><i class="fa-solid ${icon}"></i></button>`;

function tileLoading(ids) {
  ids.forEach(id => { const el = opsEl(id); if (el) el.innerHTML = '<div class="lst-skel-lines chs-skel" aria-hidden="true"><span class="lst-skel-row"></span><span class="lst-skel-row"></span><span class="lst-skel-row"></span></div>'; });
}

window.chsOpenMessenger = function() {
  const btn = document.querySelector('.chm-view[data-chm-view="messenger"]');
  if (btn) btn.click();
};

window.loadChatOps = async function() {
  if (!opsEl('chat-reports-list')) return;
  tileLoading(['chat-reports-list', 'chat-groups-list', 'chat-analytics', 'chat-confusion', 'chat-scheduled']);
  const [reports, bots, spaces, analytics] = await Promise.all([
    NopaApi.json('/api/v1/admin/chat-manage/reports').catch(e => ({ error: e })),
    NopaApi.json('/api/v1/admin/chat-manage/bots').catch(e => ({ error: e })),
    NopaApi.json('/api/v1/admin/chat-manage/spaces').catch(() => []),
    NopaApi.json('/api/v1/admin/chat-manage/analytics').catch(() => null),
  ]);
  window.chatSpacesCache = Array.isArray(spaces) ? spaces : [];
  window.chatBotsCache = bots.error ? null : bots;

  opsEl('chs-stat-spaces').textContent = faNum(window.chatSpacesCache.length);
  opsEl('chs-stat-messages').textContent = faNum(window.chatSpacesCache.reduce((a, s) => a + (s.messageCount || 0), 0));
  opsEl('chs-stat-reports').textContent = reports.error ? '-' : faNum(reports.length);
  opsEl('chs-stat-scheduled').textContent = bots.error ? '-' : faNum((bots.scheduled || []).length);
  const dot = opsEl('chm-reports-dot');
  if (dot) dot.hidden = reports.error || !reports.length;

  opsEl('chat-reports-list').innerHTML = reports.error ? tileEmpty(reports.error.message || 'گزارش‌ها در دسترس نیستند.')
    : (reports.length ? `<ul class="lst-list">${reports.map(r => tileRow(
      `<strong>${esc(r.message.sender ? r.message.sender.name : 'کاربر')}</strong>: ${esc(r.message.deletedAt ? 'پیام حذف شده' : r.message.body || 'فایل')}`,
      `${esc(r.reason)}${r.message.space ? ` · ${esc(r.message.space.title)}` : ''}`,
      tileBtn('resolveChatReport', [String(r.id), true], 'fa-trash', 'حذف پیام', true) + tileBtn('resolveChatReport', [String(r.id), false], 'fa-check', 'رد گزارش'),
    )).join('')}</ul>` : tileEmpty('گزارش بازی وجود ندارد.'));

  opsEl('chat-scheduled').innerHTML = bots.error ? tileEmpty('در دسترس نیست.')
    : ((bots.scheduled || []).length ? `<ul class="lst-list">${bots.scheduled.map(m => {
      const space = window.chatSpacesCache.find(s => s.id === m.spaceId);
      return tileRow(esc(m.body), `${esc(new Date(m.sendAt).toLocaleString('fa-IR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}${space ? ` · ${esc(space.title)}` : ''}`);
    }).join('')}</ul>` : tileEmpty('پیامی در صف انتشار نیست. از گفتگوها با دکمه‌ی ساعت زمان‌بندی کنید.'));

  if (!analytics) {
    opsEl('chat-analytics').innerHTML = tileEmpty('آمار در دسترس نیست.');
    opsEl('chat-confusion').innerHTML = tileEmpty('آمار در دسترس نیست.');
  } else {
    opsEl('chat-analytics').innerHTML = analytics.caravans.length ? `<ul class="lst-list">${analytics.caravans.map(c => {
      const share = c.members ? Math.round((c.activeMembers / c.members) * 100) : 0;
      return `<li class="lst-list-item chs-stat-row"><span class="lst-grow"><strong>${esc(c.name)}</strong> · ${esc(c.mentorName || 'بدون راهبر')}</span>
        <span class="chs-meter" title="${faNum(share)}٪ فعال"><span data-chs-width="${share}"></span></span>
        <span class="chs-side">${faNum(c.activeMembers)}/${faNum(c.members)} فعال · ${faNum(c.messages)} پیام · کلاف ${esc(String(c.averageNakh ?? '-'))}</span></li>`;
    }).join('')}</ul>` : tileEmpty('هنوز کاروانی پیامی نداده است.');
    opsEl('chat-confusion').innerHTML = analytics.confusionByStation.length
      ? `<ul class="lst-list">${analytics.confusionByStation.map(s => tileRow(esc(s.title), `<span class="lst-chip lst-chip-locked">${faNum(s.count)}</span>`)).join('')}</ul>`
      : tileEmpty('نشانه‌ی ابهامی ثبت نشده است.');
    opsEl('chat-analytics').querySelectorAll('[data-chs-width]').forEach(el => { el.style.width = `${el.dataset.chsWidth}%`; });
  }

  window.loadChatGroups();
};

window.resolveChatReport = async function(id, deleteMessage) {
  if (deleteMessage && !(await NopaConfirm('پیام گزارش‌شده برای همه حذف می‌شود. ادامه می‌دهید؟'))) return;
  try {
    await NopaApi.json(`/api/v1/admin/chat-manage/reports/${id}/resolve`, { method: 'POST', body: JSON.stringify({ deleteMessage }) });
    showToast(deleteMessage ? 'پیام حذف و گزارش بسته شد.' : 'گزارش رد شد.', 'success');
    window.loadChatOps();
  } catch (e) {
    showToast(e.message || 'خطا در ثبت', 'error');
  }
};

// ---- bots, banned words and templates: one modal, one save ----
const BOT_HINTS = { moderation: 'پیام‌های شامل واژه‌های ممنوع را نمی‌پذیرد', announce: 'اعلان، نظرسنجی و قالب‌های پیام' };
let chsBotDraft = null;

window.chsOpenBotsModal = async function() {
  let data = window.chatBotsCache;
  if (!data) {
    try { data = window.chatBotsCache = await NopaApi.json('/api/v1/admin/chat-manage/bots'); } catch (e) { showToast(e.message || 'ربات‌ها در دسترس نیستند.', 'error'); return; }
  }
  const settingsOf = key => JSON.parse(JSON.stringify((data.bots.find(b => b.key === key) || {}).settings || {}));
  chsBotDraft = {
    words: (settingsOf('moderation').bannedWords || []).slice(),
    templates: (settingsOf('announce').templates || []).map(t => ({ title: t.title, body: t.body })),
  };
  opsEl('chs-bots-list').innerHTML = data.bots.map(b => `
    <label class="chs-check"><span><strong>${esc(b.name)}</strong>${BOT_HINTS[b.key] ? `<small>${esc(BOT_HINTS[b.key])}</small>` : ''}</span>
      <input type="checkbox" class="chs-switch" data-bot="${esc(b.key)}" ${b.enabled ? 'checked' : ''}></label>`).join('');
  renderBotWords();
  renderTemplates();
  NopaModal.open('chs-bots-modal');
};

function renderBotWords() {
  opsEl('chs-words').innerHTML = chsBotDraft.words.map((w, i) => `<span class="chs-word">${esc(w)}<button type="button" data-click="chsRemoveWord" data-click-args="[${i}]" aria-label="حذف ${esc(w)}"><i class="fa-solid fa-xmark"></i></button></span>`).join('')
    || '<span class="lse-hint">واژه‌ای ثبت نشده است.</span>';
}
window.chsAddWord = function() {
  const input = opsEl('chs-word-input');
  input.value.split(/[،,]/).map(w => w.trim()).filter(Boolean).forEach(w => { if (!chsBotDraft.words.includes(w)) chsBotDraft.words.push(w); });
  input.value = '';
  renderBotWords();
  input.focus();
};
window.chsWordKey = function(event) {
  if (event.key !== 'Enter' || event.isComposing) return;
  event.preventDefault(); // Enter adds the word instead of saving the whole modal
  window.chsAddWord();
};
window.chsRemoveWord = function(i) { chsBotDraft.words.splice(i, 1); renderBotWords(); };

function readTemplates() {
  opsEl('chs-templates').querySelectorAll('.chs-template').forEach((row, i) => {
    chsBotDraft.templates[i] = { title: row.querySelector('input').value, body: row.querySelector('textarea').value };
  });
}
function renderTemplates() {
  opsEl('chs-templates').innerHTML = chsBotDraft.templates.map((t, i) => `
    <div class="chs-template">
      <div class="lse-inline"><input type="text" class="input-ctrl" maxlength="40" placeholder="عنوان قالب" value="${esc(t.title)}">
        <button type="button" class="chs-act is-danger" data-click="chsRemoveTemplate" data-click-args="[${i}]" title="حذف قالب" aria-label="حذف قالب"><i class="fa-solid fa-trash"></i></button></div>
      <textarea class="input-ctrl" rows="2" maxlength="4000" placeholder="متن پیام">${esc(t.body)}</textarea>
    </div>`).join('') || '<span class="lse-hint">هنوز قالبی ساخته نشده است.</span>';
}
window.chsAddTemplate = function() { readTemplates(); chsBotDraft.templates.push({ title: '', body: '' }); renderTemplates(); const rows = opsEl('chs-templates').querySelectorAll('.chs-template input'); rows[rows.length - 1].focus(); };
window.chsRemoveTemplate = function(i) { readTemplates(); chsBotDraft.templates.splice(i, 1); renderTemplates(); };

window.chsSaveBots = async function(event) {
  event.preventDefault();
  if (opsEl('chs-word-input').value.trim()) window.chsAddWord();
  readTemplates();
  const templates = chsBotDraft.templates.map(t => ({ title: t.title.trim(), body: t.body.trim() })).filter(t => t.title && t.body);
  const data = window.chatBotsCache;
  try {
    for (const el of opsEl('chs-bots-list').querySelectorAll('[data-bot]')) {
      const key = el.dataset.bot;
      // The endpoint replaces a bot's settings: send the stored ones with this modal's edits
      const settings = { ...((data.bots.find(b => b.key === key) || {}).settings || {}) };
      if (key === 'moderation') settings.bannedWords = chsBotDraft.words;
      if (key === 'announce') settings.templates = templates;
      await NopaApi.json(`/api/v1/admin/chat-manage/bots/${key}`, { method: 'PUT', body: JSON.stringify({ enabled: el.checked, settings }) });
    }
    window.chatBotsCache = null;
    showToast('ربات‌ها و قالب‌ها ذخیره شدند.', 'success');
    window.chsCloseModal('chs-bots-modal');
    window.loadChatOps();
  } catch (e) {
    showToast(e.message || 'خطا در ذخیره', 'error');
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

// ---- groups: listed in a tile, created and filled in a modal ----
let chsGroupId = null;

window.loadChatGroups = async function() {
  const box = opsEl('chat-groups-list');
  if (!box) return;
  try {
    const groups = await NopaApi.json('/api/v1/admin/chat-manage/groups');
    window.chatGroupsCache = groups;
    box.innerHTML = groups.length ? `<ul class="lst-list">${groups.map(g => tileRow(
      `<strong>${esc(g.title)}</strong>${g.caravanName ? ` · ${esc(g.caravanName)}` : ''}`,
      `${faNum(g.members.length)} عضو`,
      tileBtn('chsOpenGroupModal', [String(g.id)], 'fa-users', 'اعضا و نام') + tileBtn('deleteChatGroup', [String(g.id), String(g.title)], 'fa-trash', 'حذف گروه', true),
    )).join('')}</ul>` : tileEmpty('هنوز گروهی ساخته نشده است.');
  } catch (e) {
    box.innerHTML = tileEmpty(e.message || 'گروه‌ها در دسترس نیستند.');
  }
};

function fillCaravanSelect(selected) {
  const select = opsEl('chat-group-caravan');
  const seen = new Set();
  select.innerHTML = '<option value="">بدون کاروان</option>' + (window.chatSpacesCache || [])
    .filter(s => s.type === 'caravan' && s.caravanId && !seen.has(s.caravanId) && seen.add(s.caravanId))
    .map(s => `<option value="${esc(s.caravanId)}" ${s.caravanId === selected ? 'selected' : ''}>${esc(s.caravanName || s.title)}</option>`).join('');
}

// id: an existing group (rename + members), or none for a new one
window.chsOpenGroupModal = async function(id) {
  const group = id ? (window.chatGroupsCache || []).find(g => g.id === id) : null;
  chsGroupId = group ? group.id : null;
  opsEl('chs-group-title').textContent = group ? group.title : 'گروه جدید';
  opsEl('chs-group-sub').textContent = group ? (group.caravanName ? `گروه رسانه‌ای · ${group.caravanName}` : 'گروه رسانه‌ای') : 'گروه رسانه‌ای، با کاروان یا بدون آن';
  opsEl('chat-group-title').value = group ? group.title : '';
  fillCaravanSelect(group ? group.caravanId : '');
  opsEl('chat-group-caravan').disabled = !!group;
  opsEl('chs-group-save').innerHTML = group ? '<i class="fa-solid fa-check"></i> ذخیره‌ی نام' : '<i class="fa-solid fa-check"></i> ساخت گروه';
  opsEl('chs-group-hint').textContent = group ? 'کاروان گروه پس از ساخت تغییر نمی‌کند.' : 'پس از ساخت، اعضا را همین‌جا اضافه کنید.';
  opsEl('chs-group-members-card').hidden = !group;
  NopaModal.open('chs-group-modal');
  if (group) await renderGroupMembers(group);
};

async function renderGroupMembers(group) {
  const box = opsEl('chat-group-members');
  opsEl('chs-group-count').textContent = `${faNum(group.members.length)} نفر`;
  box.innerHTML = group.members.length ? `<ul class="lst-list">${group.members.map(m => tileRow(esc(m.name), '', tileBtn('removeChatGroupMember', [String(group.id), String(m.id)], 'fa-user-minus', 'حذف از گروه', true))).join('')}</ul>` : tileEmpty('هنوز عضوی ندارد.');
  try {
    const people = await NopaApi.json(`/api/v1/admin/chat-manage/groups/candidates${group.caravanId ? `?caravanId=${group.caravanId}` : ''}`);
    const memberIds = new Set(group.members.map(m => m.id));
    const rest = people.filter(p => !memberIds.has(p.id));
    opsEl('chat-group-add').innerHTML = rest.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('') || '<option value="">همه عضو شده‌اند</option>';
  } catch (e) {
    opsEl('chat-group-add').innerHTML = '<option value="">فهرست افراد در دسترس نیست</option>';
  }
}

async function refreshGroup(id) {
  await window.loadChatGroups();
  const group = (window.chatGroupsCache || []).find(g => g.id === id);
  if (group) await renderGroupMembers(group);
}

window.chsSaveGroup = async function(event) {
  event.preventDefault();
  const title = opsEl('chat-group-title').value.trim();
  if (!title) return;
  try {
    if (chsGroupId) {
      await NopaApi.json(`/api/v1/admin/chat-manage/groups/${chsGroupId}`, { method: 'PATCH', body: JSON.stringify({ title }) });
      opsEl('chs-group-title').textContent = title;
      showToast('نام گروه ذخیره شد.', 'success');
      await refreshGroup(chsGroupId);
    } else {
      const created = await NopaApi.json('/api/v1/admin/chat-manage/groups', { method: 'POST', body: JSON.stringify({ title, caravanId: opsEl('chat-group-caravan').value || undefined, memberIds: [] }) });
      showToast('گروه ساخته شد؛ اعضا را اضافه کنید.', 'success');
      await window.loadChatGroups();
      const id = created && created.id;
      if (id) window.chsOpenGroupModal(id); else window.chsCloseModal('chs-group-modal');
    }
  } catch (e) {
    showToast(e.message || 'خطا در ذخیره‌ی گروه', 'error');
  }
};

window.chsAddMember = async function() {
  const userId = opsEl('chat-group-add').value;
  if (!chsGroupId || !userId) return;
  try {
    await NopaApi.json(`/api/v1/admin/chat-manage/groups/${chsGroupId}/members`, { method: 'POST', body: JSON.stringify({ memberIds: [userId] }) });
    await refreshGroup(chsGroupId);
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

window.deleteChatGroup = async function(id, title) {
  if (!(await NopaConfirm(`گروه «${title}» و همه‌ی پیام‌هایش حذف می‌شود. ادامه می‌دهید؟`))) return;
  try {
    await NopaApi.json(`/api/v1/admin/chat-manage/groups/${id}`, { method: 'DELETE' });
    window.loadChatGroups();
  } catch (e) {
    showToast(e.message || 'خطا در حذف گروه', 'error');
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
