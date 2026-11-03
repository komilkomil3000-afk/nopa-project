// Challenges & submissions: list, create/edit modals, steps, ranking, submission review.
// Split out of the former app.js (Phase 7). Classic script: shares globals with the other modules;
// load order is set in index.html.

// ==========================================
// CHALLENGES & SUBMISSIONS MANAGEMENT (LMS)
// ==========================================
window.cachedAdminChallenges = [];
window.cachedAdminCaravans = [];

window.loadChallengesAndSubmissionsTab = async function() {
  window.chlSetLoading(true);
  try {
    await Promise.all([
      window.loadAdminChallengesData(),
      window.loadAdminSubmissionsData()
    ]);
  } finally {
    window.chlSetLoading(false);
  }
};

// ==================== LOADING SHIMMER ====================
// Same as the stations tab (window.lmsSetStationsLoading): a light band sweeps over each bento tile until the
// data arrives. On the first load the tiles hold skeletons (challenge cards, submission rows, list lines);
// a refresh keeps the current content under the shimmer.
window.chlSetLoading = function(on) {
  const tab = document.getElementById('submissions-tab');
  if (!tab) return;
  tab.querySelectorAll('.chl-bento .lst-tile').forEach(t => t.classList.toggle('is-loading', on));
  ['admin-challenges-grid', 'admin-submissions-list'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('aria-busy', on ? 'true' : 'false');
  });
  if (!on) return;

  const grid = document.getElementById('admin-challenges-grid');
  if (grid && !window.cachedAdminChallenges.length) {
    grid.innerHTML = Array.from({ length: 6 }, () => `
      <div class="chl-card chl-skel" aria-hidden="true">
        <span class="chl-card-top"><span class="lst-skel-line lst-skel-chip"></span><span class="lst-skel-line lst-skel-chip"></span></span>
        <span class="lst-skel-line chl-skel-title"></span>
        <span class="lst-skel-lines"><span class="lst-skel-line"></span><span class="lst-skel-line lst-skel-short"></span></span>
        <span class="lst-skel-lines"><span class="lst-skel-line lst-skel-short"></span><span class="lst-skel-line lst-skel-short"></span></span>
        <span class="chl-card-foot"><span class="lst-skel-line lst-skel-chip"></span><span class="lst-skel-line chl-skel-btns"></span></span>
      </div>`).join('');
  }
  const subs = document.getElementById('admin-submissions-list');
  if (subs && !(window.cachedAdminSubmissions || []).length) {
    subs.innerHTML = Array.from({ length: 3 }, () => `
      <div class="chl-sub chl-skel" aria-hidden="true">
        <span class="chl-sub-avatar chl-skel-avatar"></span>
        <span class="lst-skel-lines"><span class="lst-skel-line"></span><span class="lst-skel-line lst-skel-short"></span></span>
        <span class="lst-skel-lines"><span class="lst-skel-line"></span><span class="lst-skel-line lst-skel-short"></span></span>
        <span class="lst-skel-line lst-skel-chip"></span>
        <span class="lst-skel-line chl-skel-btns"></span>
      </div>`).join('');
  }
  const lines = n => `<div class="lst-skel-lines" aria-hidden="true">${'<span class="lst-skel-row"></span>'.repeat(n)}</div>`;
  const fill = { 'chl-bento-status': lines(3), 'chl-bento-types': lines(2), 'chl-bento-pending': lines(3) };
  const empty = !window.cachedAdminChallenges.length && !(window.cachedAdminSubmissions || []).length;
  if (empty) Object.keys(fill).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = fill[id];
  });
};

window.loadAdminChallengesData = async function() {
  if (window.NopaDrafts) NopaDrafts.sync();
  try {
    const [challengesRes, caravansRes] = await Promise.all([
      request('/api/v1/admin/challenges'),
      request('/api/v1/admin/caravans').catch(() => null)
    ]);

    if (!challengesRes.ok) {
      console.warn('Failed to load admin challenges');
      return chlEmpty(document.getElementById('admin-challenges-grid'), 'خطا در دریافت چالش‌ها', 'fa-solid fa-triangle-exclamation');
    }
    const challenges = await challengesRes.json();
    window.cachedAdminChallenges = Array.isArray(challenges) ? challenges : [];

    if (caravansRes && caravansRes.ok) {
      const caravans = await caravansRes.json();
      window.cachedAdminCaravans = Array.isArray(caravans) ? caravans : [];
      populateCaravanDropdowns(window.cachedAdminCaravans);
    }
    
    // Update stats
    const countEl = document.getElementById('stat-challenges-count');
    if (countEl) countEl.textContent = window.cachedAdminChallenges.length;
    const badgeEl = document.getElementById('badge-challenges-total');
    if (badgeEl) badgeEl.textContent = `${window.cachedAdminChallenges.length} چالش فعال`;

    window.filterChallengesList();
    window.renderChallengeInsights();
  } catch (err) {
    console.error('loadAdminChallengesData error:', err);
    chlEmpty(document.getElementById('admin-challenges-grid'), 'خطا در دریافت چالش‌ها', 'fa-solid fa-triangle-exclamation');
  }
};

function populateCaravanDropdowns(caravans) {
  const filterSelect = document.getElementById('filter-challenges-caravan');
  const newChalSelect = document.getElementById('new-chal-caravan-id');
  const editChalSelect = document.getElementById('edit-chal-caravan-id');

  const optionsHtml = caravans.map(c => {
    const mentorName = c.mentor?.name || 'بدون راهبر';
    return `<option value="${c.id}">${esc(c.name)} (راهبر: ${esc(mentorName)})</option>`;
  }).join('');

  if (filterSelect) {
    const currentVal = filterSelect.value;
    filterSelect.innerHTML = `<option value="all">همه کاروان‌ها و راهبران</option>` + optionsHtml;
    filterSelect.value = currentVal || 'all';
  }

  if (newChalSelect) {
    newChalSelect.innerHTML = `<option value="inter_group">عمومی (میان‌گروهی)</option>` + optionsHtml;
  }

  if (editChalSelect) {
    editChalSelect.innerHTML = `<option value="inter_group">عمومی (میان‌گروهی)</option>` + optionsHtml;
  }

  if (typeof populateSubmissionsFilterDropdowns === 'function') {
    populateSubmissionsFilterDropdowns(window.cachedAdminSubmissions || []);
  }
}

function chlEmpty(el, text, icon = 'fa-regular fa-folder-open') {
  if (!el) return;
  el.innerHTML = `<div class="lst-empty"><i class="${icon}"></i> ${esc(text)}</div>`;
}

function chlRoundBtn(icon, title, click, args, extra = '') {
  return `<button type="button" class="lsv-round lsv-round-sm${extra ? ' ' + extra : ''}" data-click="${click}" data-click-args="${esc(JSON.stringify(args))}" title="${esc(title)}" aria-label="${esc(title)}"><i class="${icon}"></i></button>`;
}

function chlTypeChip(c) {
  if (c.type === 'quiz') return '<span class="chl-chip is-success"><i class="fa-solid fa-circle-question"></i> آزمون مرحله‌ای</span>';
  if (c.type === 'skill' || c.type === 'text' || c.type === 'file') return '<span class="chl-chip is-accent"><i class="fa-solid fa-pen"></i> تشریحی</span>';
  return `<span class="chl-chip">${esc(c.type || '')}</span>`;
}

function renderAdminChallenges(challenges) {
  const grid = document.getElementById('admin-challenges-grid');
  if (!grid) return;

  // like the stations tab: the "new challenge" card closes the grid unless a filter narrowed the list
  const unfiltered = challenges.length === (window.cachedAdminChallenges || challenges).length;
  if (challenges.length === 0 && !unfiltered) {
    chlEmpty(grid, 'هیچ چالشی با فیلتر انتخابی یافت نشد');
    return;
  }

  const cards = challenges.map(c => {
    const isByAdmin = c.creatorInfo?.isByAdmin ?? (!c.createdByMentorId);
    const creatorName = c.creatorInfo?.name || (isByAdmin ? 'مدیر سیستم' : 'راهبر کاروان');
    const creator = isByAdmin
      ? '<span><i class="fa-solid fa-shield-halved"></i> مدیر سیستم</span>'
      : `<span><i class="fa-solid fa-user-tie"></i> راهبر: ${esc(creatorName)}</span>`;

    const audience = c.targetAudience && c.targetAudience.type === 'caravan'
      ? { name: c.targetAudience.name, mentorName: c.targetAudience.mentorName }
      : (c.caravanInfo || null);
    const audienceHtml = audience
      ? `<span><i class="fa-solid fa-users"></i> کاروان: ${esc(audience.name)} · راهبر: ${esc(audience.mentorName || 'نامشخص')}</span>`
      : '<span><i class="fa-solid fa-globe"></i> عمومی (همه کاروان‌ها)</span>';

    const approved = c.approvedSubmissions || (c.submissions ? c.submissions.filter(x => x.status === 'approved').length : 0);
    const pending = c.pendingSubmissions || (c.submissions ? c.submissions.filter(x => x.status === 'pending' || x.status === 'PENDING_REVIEW').length : 0);
    const interGroup = c.category === 'inter_group';
    const reward = interGroup ? 'درفش (بر اساس رتبه)' : window.formatChallengeReward(c);
    const id = String(c.id);

    return `
      <article class="chl-card">
        <div class="chl-card-top">
          <span class="chl-id">${esc(id)}</span>
          ${chlTypeChip(c)}
        </div>
        <h5 class="chl-card-title">${esc(c.title)}</h5>
        <p class="chl-card-desc">${esc(c.description || '')}</p>
        <div class="chl-card-meta">
          ${audienceHtml}
          ${creator}
          <span class="chl-reward"><i class="fa-solid ${interGroup ? 'fa-flag' : 'fa-coins'}"></i> ${reward}</span>
        </div>
        <div class="chl-card-foot">
          <span class="chl-counts" title="تایید شده | در انتظار">
            <b class="is-ok"><i class="fa-solid fa-check"></i> ${approved}</b>
            <b class="is-wait"><i class="fa-solid fa-clock"></i> ${pending}</b>
          </span>
          <span class="lsv-round-group">
            ${chlRoundBtn('fa-solid fa-list-check', 'مشاهده مراحل چالش', 'openChallengeStepsModal', [id])}
            ${interGroup ? chlRoundBtn('fa-solid fa-flag', 'رتبه‌بندی کاروان‌ها و اعطای درفش', 'openChallengeRanking', [id]) : ''}
            ${chlRoundBtn('fa-solid fa-pen', 'ویرایش و اصلاح چالش', 'openEditChallengeModal', [id])}
            ${chlRoundBtn('fa-solid fa-trash', 'حذف چالش', 'deleteChallengeAdmin', [id, String(escJs(c.title || ''))], 'lsv-round-danger')}
          </span>
        </div>
      </article>`;
  });
  if (unfiltered) {
    cards.push(`
      <button type="button" class="chl-card chl-card-add" data-click="openCreateChallengeModal" title="ایجاد چالش جدید">
        <i class="fa-solid fa-plus"></i>
        <span>چالش جدید</span>
      </button>`);
  }
  grid.innerHTML = cards.join('');
}

window.filterChallengesList = function() {
  const query = (document.getElementById('filter-challenges-search')?.value || '').trim().toLowerCase();
  const selectedCaravan = document.getElementById('filter-challenges-caravan')?.value || 'all';
  const selectedCreator = document.getElementById('filter-challenges-creator')?.value || 'all';

  let filtered = [...window.cachedAdminChallenges];

  // Filter by Caravan
  if (selectedCaravan !== 'all') {
    filtered = filtered.filter(c => {
      if (c.caravanInfo && c.caravanInfo.id === selectedCaravan) return true;
      if (c.caravanId && c.caravanId === selectedCaravan) return true;
      return false;
    });
  }

  // Filter by Creator
  if (selectedCreator === 'admin') {
    filtered = filtered.filter(c => c.creatorInfo?.isByAdmin === true || !c.createdByMentorId);
  } else if (selectedCreator === 'mentor') {
    filtered = filtered.filter(c => c.creatorInfo?.isByAdmin === false && c.createdByMentorId);
  }

  // Filter by Search Query
  if (query) {
    filtered = filtered.filter(c => 
      (c.title && c.title.toLowerCase().includes(query)) ||
      (c.id && c.id.toLowerCase().includes(query)) ||
      (c.description && c.description.toLowerCase().includes(query)) ||
      (c.creatorInfo && c.creatorInfo.name && c.creatorInfo.name.toLowerCase().includes(query)) ||
      (c.caravanInfo && c.caravanInfo.name && c.caravanInfo.name.toLowerCase().includes(query))
    );
  }

  renderAdminChallenges(filtered);
};

// ==========================================
// CHALLENGE CRUD MODALS & DYNAMIC STEPS
// ==========================================

window.handleChallengeTypeChange = function(mode) {
  const typeSelect = document.getElementById(`${mode}-chal-type`);
  const section = document.getElementById(`${mode}-chal-questions-section`);
  if (!typeSelect || !section) return;

  const isQuiz = typeSelect.value === 'quiz';
  section.style.display = isQuiz ? '' : 'none';
  const noq = document.getElementById(`${mode}-chal-noq`);
  if (noq) noq.style.display = isQuiz ? 'none' : 'flex';
};

// Reward of a challenge as "min تا max نخ/زریک" (fixed amount when no range is set).
window.formatChallengeReward = function(c) {
  const unit = c.rewardAssetType === 'nakh' ? 'کلاف' : 'زریک';
  const min = Number(c.rewardMin) || 0;
  const max = Number(c.rewardMax) || 0;
  if (max > 0) return min === max ? `${max} ${unit}` : `${min} تا ${max} ${unit}`;
  return `${c.rewardZarik || 50} ${unit}`;
};

// Reads + validates the reward fields of the create ('new') / edit ('edit') form. Returns null after alerting.
window.readChallengeReward = function(mode) {
  if (document.getElementById(`${mode}-chal-caravan-id`)?.value === 'inter_group') {
    return { rewardAssetType: 'derafsh', rewardMin: 0, rewardMax: 0, rewardZarik: 0 };
  }
  const rewardAssetType = 'nakh';
  const rewardMin = Number(document.getElementById(`${mode}-chal-reward-min`)?.value);
  const rewardMax = Number(document.getElementById(`${mode}-chal-reward-max`)?.value);
  if (!Number.isInteger(rewardMin) || !Number.isInteger(rewardMax) || rewardMin < 0 || rewardMax <= 0) {
    showToast('حداقل و حداکثر پاداش را به صورت عدد صحیح وارد کنید (حداکثر بزرگ‌تر از صفر).', 'error');
    return null;
  }
  if (rewardMin > rewardMax) {
    showToast('حداقل پاداش نمی‌تواند از حداکثر بیشتر باشد.', 'info');
    return null;
  }
  return { rewardAssetType, rewardMin, rewardMax, rewardZarik: rewardMax };
};

// Shows the length of the challenge computed from its start and end dates (read-only).
window.updateChallengeDuration = function(mode) {
  const el = document.getElementById(`${mode}-chal-duration`);
  if (!el) return;
  const start = document.getElementById(`${mode}-chal-start-date`)?.value;
  const due = document.getElementById(`${mode}-chal-due-date`)?.value;
  if (!due) { el.textContent = 'مهلت: -'; return; }
  const from = start ? new Date(`${start}T00:00:00`) : new Date(new Date().toDateString());
  const days = Math.round((new Date(`${due}T00:00:00`) - from) / 86400000) + 1;
  el.textContent = days > 0 ? `مهلت: ${days} روز` : 'تاریخ پایان قبل از شروع است';
};

// Inter-group challenges pay no zarik/kalaf: the only reward is the caravan banner (derafsh) given by the admin's ranking.
window.handleChallengeAudienceChange = function(mode) {
  const inter = document.getElementById(`${mode}-chal-caravan-id`)?.value === 'inter_group';
  const assetBox = document.getElementById(`${mode}-chal-asset`)?.parentElement;
  const rangeRow = document.getElementById(`${mode}-chal-reward-min`)?.parentElement?.parentElement;
  [assetBox, rangeRow].forEach(el => { if (el) el.style.display = inter ? 'none' : ''; });
  let note = document.getElementById(`${mode}-chal-banner-note`);
  if (!note && rangeRow) {
    note = document.createElement('div');
    note.id = `${mode}-chal-banner-note`;
    note.style.cssText = 'font-size: var(--text-xs); color: var(--accent-text); background: rgb(var(--accent-rgb) / 0.1); border: 1px solid rgb(var(--accent-rgb) / 0.3); border-radius: 8px; padding: 8px 12px; margin-bottom: 14px; line-height: 1.7;';
    note.innerHTML = 'پاداش چالش میان‌گروهی فقط <b>درفش</b> است: پس از پاسخ کاروان‌ها، در بخش «رتبه‌بندی» کاروان‌های اول تا سوم را تایید کنید؛ به ترتیب درفش طلایی، نقره‌ای و برنزی می‌گیرند و بقیه‌ی کاروان‌های شرکت‌کننده درفش پارچه‌ای.';
    rangeRow.parentElement.insertBefore(note, rangeRow);
  }
  if (note) note.style.display = inter ? 'block' : 'none';
};

// ---- Ranking of the caravans in an inter-group challenge ----
window.openChallengeRanking = async function(challengeId) {
  const modal = document.getElementById('ranking-modal');
  const body = document.getElementById('ranking-body');
  if (!modal || !body) return;
  body.innerHTML = '<div class="u-c-text-muted">در حال بارگذاری...</div>';
  modal.style.display = 'flex';
  try {
    const res = await request(`/api/v1/admin/challenges/${challengeId}/ranking`);
    const data = await res.json();
    if (!res.ok) { body.innerHTML = `<div class="u-c-danger-text">${esc(data.error || 'خطا')}</div>`; return; }
    document.getElementById('ranking-title').textContent = `رتبه‌بندی کاروان‌ها: ${data.challenge.title}`;
    if (typeof window.loadInterGroupDesk === 'function') window.loadInterGroupDesk(challengeId);
    const names = window.assetNamesMap || {};
    const tierName = { gold: names.derafsh_gold || 'درفش طلایی', silver: names.derafsh_silver || 'درفش نقره‌ای', bronze: names.derafsh_bronze || 'درفش برنزی', cloth: names.derafsh_cloth || 'درفش پارچه‌ای' };
    const tierColor = { gold: 'var(--accent-text)', silver: 'var(--text-soft)', bronze: 'var(--accent-strong)', cloth: 'var(--text-muted)' };

    if (data.challenge.finalized) {
      body.innerHTML = '<p class="lse-lead"><i class="fa-solid fa-circle-check"></i> رتبه‌بندی تایید و درفش‌ها اعطا شده است.</p>' +
        data.result.map(r => `<div class="chl-rank-row"><span>${r.rank ? 'رتبه ' + lmsFaDigits(r.rank) + ': ' : ''}${esc(r.caravanName)}</span><b data-style="color:${tierColor[r.tier]};">${esc(tierName[r.tier])}</b></div>`).join('');
      return;
    }
    if (!data.caravans.length) {
      body.innerHTML = '<div class="lst-empty">هنوز هیچ کاروانی در این چالش پاسخ نداده است.</div>';
      return;
    }
    const places = Math.min(3, data.caravans.length);
    const placeLabel = ['رتبه‌ی اول (' + tierName.gold + ')', 'رتبه‌ی دوم (' + tierName.silver + ')', 'رتبه‌ی سوم (' + tierName.bronze + ')'];
    const options = '<option value="">انتخاب کاروان...</option>' + data.caravans.map(c => `<option value="${c.id}">${esc(c.name)}${c.mentorName ? ' - ' + esc(c.mentorName) : ''} (${c.answers} پاسخ)</option>`).join('');
    let html = `<p class="lse-lead"><i class="fa-solid fa-circle-info"></i> ${data.caravans.length} کاروان شرکت کرده‌اند و بقیه ${esc(tierName.cloth)} می‌گیرند. تایید نهایی قابل بازگشت نیست.</p>`;
    for (let i = 0; i < places; i++) {
      html += `<label class="lse-field"><span data-style="color:${[tierColor.gold, tierColor.silver, tierColor.bronze][i]}">${placeLabel[i]}</span>
        <select class="ranking-select select-ctrl">${options}</select></label>`;
    }
    html += `<button type="button" data-click="submitChallengeRanking" data-click-args="${esc(JSON.stringify([String(challengeId), (places)]))}" class="lsv-pill chl-rank-submit"><i class="fa-solid fa-flag"></i> تایید نهایی و اعطای درفش</button>`;
    body.innerHTML = html;
  } catch (e) {
    body.innerHTML = '<div class="u-c-danger-text">خطا در ارتباط با سرور</div>';
  }
};

window.submitChallengeRanking = async function(challengeId, places) {
  const ranking = Array.from(document.querySelectorAll('#ranking-body .ranking-select')).map(s => s.value);
  if (ranking.length !== places || ranking.some(v => !v) || new Set(ranking).size !== places) {
    showToast('برای هر رتبه یک کاروان متفاوت انتخاب کنید.', 'error');
    return;
  }
  const preview = await NopaApi.json(`/api/v1/admin/challenges/${challengeId}/ranking`, { method: 'POST', body: JSON.stringify({ ranking, preview: true }) }).catch(e => ({ error: e.message }));
  if (preview.error) { showToast(preview.error, 'error'); return; }
  const warning = preview.unconfirmed.length ? ` سطح اعضای این کاروان‌ها تأیید نشده و بدون جایزه می‌مانند: ${preview.unconfirmed.join('، ')}.` : '';
  const question = `${Number(preview.total).toLocaleString('fa-IR')} زریک به ${Number(preview.paidMembers).toLocaleString('fa-IR')} نفر از ${Number(preview.members).toLocaleString('fa-IR')} عضو پرداخت می‌شود.${warning} رتبه‌بندی نهایی است و برنمی‌گردد. ادامه می‌دهید؟`;
  if (!(await NopaConfirm(question))) return;
  const res = await request(`/api/v1/admin/challenges/${challengeId}/ranking`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ranking, acceptUnconfirmed: true })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { showToast(data.error || 'خطا در ثبت رتبه‌بندی', 'error'); return; }
  await window.openChallengeRanking(challengeId);
};

let chlQuestionSeq = 0;
const chlSelected = { new: null, edit: null };

function chlCards(mode) {
  return Array.from(document.querySelectorAll(`#${mode}-chal-questions-list > .challenge-q-card`));
}

function chlCardInfo(card) {
  const title = card.querySelector('.chal-q-title')?.value.trim() || '';
  const opts = Array.from(card.querySelectorAll('.chal-q-opt')).map(i => i.value.trim());
  const filled = opts.filter(Boolean).length;
  const correct = Array.from(card.querySelectorAll('input[type="radio"]')).findIndex(r => r.checked);
  return { title, opts, filled, correct };
}

function chlSelectQuestion(mode, qid) {
  chlSelected[mode] = qid;
  chlCards(mode).forEach(c => c.classList.toggle('is-selected', c.dataset.qid === qid));
  chlRenderQIndex(mode);
}

// The right-hand column: one row per question (grip, number, title, completeness)
function chlRenderQIndex(mode) {
  const box = document.getElementById(`${mode}-chal-qindex`);
  if (!box) return;
  const cards = chlCards(mode);
  if (!cards.some(c => c.dataset.qid === chlSelected[mode]) && cards[0]) {
    chlSelected[mode] = cards[0].dataset.qid;
    cards[0].classList.add('is-selected');
  }
  box.innerHTML = cards.map((card, i) => {
    const info = chlCardInfo(card);
    const active = card.dataset.qid === chlSelected[mode];
    const status = !info.title ? 'بدون صورت سوال' : (info.filled < 2 ? 'گزینه‌ها ناقص' : `${lmsFaDigits(info.filled)} گزینه`);
    const num = card.querySelector('.chl-q-num');
    if (num) num.textContent = `سوال ${lmsFaDigits(i + 1)}`;
    return `
      <div class="lse-tree-row chl-qrow${active ? ' is-active' : ''}" data-qid="${esc(card.dataset.qid)}" role="button" tabindex="0"${active ? ' aria-current="true"' : ''}>
        <span class="lse-tree-grip lse-grip" title="برای جابجایی بکشید" aria-hidden="true"><i class="fa-solid fa-grip-vertical"></i></span>
        <span class="lse-tree-num">${lmsFaDigits(i + 1)}</span>
        <span class="lse-tree-text"><strong>${esc(info.title || `سوال ${lmsFaDigits(i + 1)}`)}</strong><small class="${info.title && info.filled >= 2 ? '' : 'is-warn'}">${status}</small></span>
      </div>`;
  }).join('');
}

function chlBindQuestions(mode) {
  const box = document.getElementById(`${mode}-chal-qindex`);
  const list = document.getElementById(`${mode}-chal-questions-list`);
  if (!box || !list || box.dataset.bound) return;
  box.dataset.bound = '1';

  box.addEventListener('click', e => {
    const row = e.target.closest('.chl-qrow');
    if (row) chlSelectQuestion(mode, row.dataset.qid);
  });
  box.addEventListener('keydown', e => {
    const row = e.target.closest('.chl-qrow');
    if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); chlSelectQuestion(mode, row.dataset.qid); }
  });

  list.addEventListener('click', e => {
    const del = e.target.closest('.chl-q-del');
    if (!del) return;
    del.closest('.challenge-q-card')?.remove();
    chlMarkDirty(mode);
    chlRenderQIndex(mode);
  });
  list.addEventListener('input', () => chlRenderQIndex(mode));
}

window.addQuestionRow = function(mode, initialData = null) {
  const container = document.getElementById(`${mode}-chal-questions-list`);
  if (!container) return;
  chlBindQuestions(mode);

  const seq = ++chlQuestionSeq;
  const qText = initialData ? (initialData.q || initialData.question || '') : '';
  const opts = initialData && Array.isArray(initialData.options) ? initialData.options : ['', '', '', ''];
  const correctIdx = initialData && initialData.correct !== undefined ? initialData.correct : 0;

  const card = document.createElement('div');
  card.className = 'challenge-q-card';
  card.dataset.qid = `q${seq}`;
  card.innerHTML = `
    <div class="chl-q-head">
      <h5 class="chl-q-num"></h5>
      <button type="button" class="lsv-round lsv-round-sm lsv-round-danger chl-q-del" title="حذف سوال" aria-label="حذف سوال"><i class="fa-solid fa-trash"></i></button>
    </div>
    <label class="lse-field">
      <span>صورت سوال</span>
      <textarea aria-label="صورت سوال" class="chal-q-title input-ctrl" rows="2" placeholder="متن سوال یا عنوان مرحله...">${esc(qText)}</textarea>
    </label>
    <fieldset class="lse-options">
      <legend>گزینه‌ها <small>دایره‌ی کنار پاسخ درست را انتخاب کنید</small></legend>
      ${[0, 1, 2, 3].map(i => `
        <label class="lse-option">
          <input type="radio" aria-label="گزینه‌ی ${i + 1} پاسخ درست است" name="${mode}-correct-q${seq}" value="${i}" ${i === Number(correctIdx) ? 'checked' : ''}>
          <span>${['۱', '۲', '۳', '۴'][i]}</span>
          <input type="text" aria-label="متن گزینه‌ی ${i + 1}" class="chal-q-opt input-ctrl" placeholder="گزینه ${['اول', 'دوم', 'سوم', 'چهارم'][i]}" value="${esc(opts[i] || '')}">
        </label>
      `).join('')}
    </fieldset>
  `;
  container.appendChild(card);
  // a question added by hand opens for editing; the ones loaded with the challenge keep the current selection
  if (!initialData || !chlSelected[mode] || !chlCards(mode).some(c => c.dataset.qid === chlSelected[mode])) {
    chlSelected[mode] = card.dataset.qid;
  }
  chlCards(mode).forEach(c => c.classList.toggle('is-selected', c.dataset.qid === chlSelected[mode]));
  chlRenderQIndex(mode);
  if (!initialData) {
    chlMarkDirty(mode);
    card.querySelector('.chal-q-title')?.focus();
  }
};

window.populateStationDropdownForChallenges = function(selectId, selectedId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const stations = window.lmsStationsMasterList || [];
  let html = '<option value="">بدون انتساب به منزلگاه (عمومی دوره)</option>';
  stations.forEach((st, idx) => {
    const num = st.orderIndex ?? (idx + 1);
    const title = st.title || `منزلگاه ${num}`;
    const isSel = (selectedId && (st.id === selectedId || st.id == selectedId)) ? 'selected' : '';
    html += `<option value="${st.id}" ${isSel}>${esc(title)} (منزلگاه ${num})</option>`;
  });
  sel.innerHTML = html;
};

window.openCreateChallengeModal = function() {
  console.log('[openCreateChallengeModal] Opening create challenge modal');
  const modal = document.getElementById('create-challenge-modal');
  if (!modal) {
    console.error('Modal create-challenge-modal not found');
    showToast('مودال ایجاد چالش یافت نشد. لطفاً صفحه را مجدداً بارگذاری کنید.', 'error');
    return;
  }

  const form = document.getElementById('create-challenge-form');
  if (form) form.reset();

  document.getElementById('new-chal-asset').value = 'zarik';
  document.getElementById('new-chal-reward-min').value = '10';
  document.getElementById('new-chal-reward-max').value = '50';

  const caravanSelect = document.getElementById('new-chal-caravan-id');
  const mentorNotice = document.getElementById('new-chal-mentor-notice');

  if (currentUser && currentUser.role === 'mentor') {
    // Find mentor's caravan
    const myCaravan = (window.cachedAdminCaravans || []).find(cv => 
      cv.mentorId === currentUser.id || cv.mentor?.id === currentUser.id || cv.id === currentUser.caravanId
    );
    if (caravanSelect) {
      if (myCaravan) {
        caravanSelect.value = myCaravan.id;
        caravanSelect.disabled = true;
      }
    }
    if (mentorNotice) {
      mentorNotice.style.display = 'block';
      mentorNotice.innerHTML = `<i class="fa-solid fa-lock"></i> به عنوان راهبر، این چالش به صورت خودکار برای کاروان «${esc(myCaravan?.name || 'اختصاصی شما')}» تنظیم شده است و فقط اعضای این کاروان آن را مشاهده خواهند کرد.`;
    }
  } else {
    if (caravanSelect) {
      caravanSelect.disabled = false;
      caravanSelect.value = 'inter_group';
    }
    if (mentorNotice) {
      mentorNotice.style.display = 'none';
    }
  }

  window.populateStationDropdownForChallenges('new-chal-station-id', '');
  window.handleChallengeAudienceChange('new');

  const qContainer = document.getElementById('new-chal-questions-list');
  if (qContainer) {
    qContainer.innerHTML = '';
    window.addQuestionRow('new');
  }

  if (typeof window.handleChallengeTypeChange === 'function') {
    window.handleChallengeTypeChange('new');
  }

  modal.style.display = 'flex';
  modal.classList.remove('hidden');
};

window.closeCreateChallengeModal = async function(force) {
  if (force !== true && CHL.new.dirty && !(await NopaConfirm('اطلاعات این چالش هنوز ثبت نشده و از بین می‌رود. ادامه می‌دهید؟', { okText: 'بستن بدون ثبت', danger: true }))) return;
  CHL.new.dirty = false;
  const modal = document.getElementById('create-challenge-modal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.add('hidden');
  }
};

window.submitCreateChallenge = async function(event) {
  event.preventDefault();

  const title = document.getElementById('new-chal-title')?.value.trim();
  const reward = window.readChallengeReward('new');
  if (!reward) return;
  let caravanId = document.getElementById('new-chal-caravan-id')?.value || 'inter_group';
  if (currentUser && currentUser.role === 'mentor') {
    const myCaravan = (window.cachedAdminCaravans || []).find(cv => 
      cv.mentorId === currentUser.id || cv.mentor?.id === currentUser.id || cv.id === currentUser.caravanId
    );
    if (myCaravan) {
      caravanId = myCaravan.id;
    }
  }
  const type = document.getElementById('new-chal-type')?.value || 'quiz';
  const description = document.getElementById('new-chal-desc')?.value.trim();
  const stationId = document.getElementById('new-chal-station-id')?.value || null;
  const dueDate = document.getElementById('new-chal-due-date')?.value || null;
  const startDate = document.getElementById('new-chal-start-date')?.value || null;
  if (startDate && dueDate && startDate > dueDate) {
    showToast('تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.', 'info');
    return;
  }

  if (!title || !description) {
    showToast('لطفاً عنوان و توضیحات چالش را تکمیل فرمایید.', 'error');
    return;
  }

  // Parse questions if quiz
  let questions = [];
  if (type === 'quiz') {
    const cards = document.querySelectorAll('#new-chal-questions-list .challenge-q-card');
    cards.forEach((card, idx) => {
      const qTitle = card.querySelector('.chal-q-title')?.value.trim() || `مرحله ${idx + 1}`;
      const optInputs = card.querySelectorAll('.chal-q-opt');
      const options = Array.from(optInputs).map(inp => inp.value.trim()).filter(Boolean);
      const radio = card.querySelector('input[type="radio"]:checked');
      const correctIndex = radio ? Number(radio.value) : 0;

      questions.push({
        step: idx + 1,
        q: qTitle,
        options: options.length > 0 ? options : ['گزینه ۱', 'گزینه ۲', 'گزینه ۳', 'گزینه ۴'],
        correct: correctIndex
      });
    });
  }

  try {
    const payload = {
      title,
      description,
      type,
      ...reward,
      stationId: stationId || undefined,
      startDate: startDate ? new Date(`${startDate}T00:00:00+03:30`).toISOString() : undefined,
      dueDate: dueDate ? new Date(`${dueDate}T23:59:59+03:30`).toISOString() : undefined,
      caravanId: caravanId === 'all' ? undefined : caravanId,
      questions: questions.length > 0 ? questions : undefined
    };

    const res = await request('/api/v1/admin/challenges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      showToast('چالش جدید با موفقیت توسط مدیر ثبت گردید و اعلان درون‌برنامه‌ای به کاربران و راهبر ارسال شد.', 'success');
      window.closeCreateChallengeModal(true);
      await window.loadChallengesAndSubmissionsTab();
    } else {
      const data = await res.json();
      showToast(data.error || 'خطایی در ثبت چالش رخ داد', 'error');
    }
  } catch (err) {
    console.error('submitCreateChallenge error:', err);
    showToast('خطا در ارتباط با سرور هنگام ایجاد چالش', 'error');
  }
};

window.openEditChallengeModal = function(challengeId) {
  const c = window.cachedAdminChallenges.find(item => item.id === challengeId);
  if (!c) {
    showToast('اطلاعات چالش یافت نشد', 'error');
    return;
  }

  const modal = document.getElementById('edit-challenge-modal');
  if (!modal) return;

  document.getElementById('edit-chal-id').value = c.id;
  document.getElementById('edit-chal-title').value = c.title || '';
  document.getElementById('edit-chal-asset').value = 'nakh';
  document.getElementById('edit-chal-reward-min').value = c.rewardMin || 0;
  document.getElementById('edit-chal-reward-max').value = c.rewardMax || c.rewardZarik || 50;
  document.getElementById('edit-chal-desc').value = c.description || '';
  document.getElementById('edit-chal-type').value = c.type === 'quiz' ? 'quiz' : 'text';

  const caravanSelect = document.getElementById('edit-chal-caravan-id');
  if (caravanSelect) {
    caravanSelect.value = c.category === 'inter_group' ? 'inter_group' : (c.caravanInfo?.id || c.caravanId || 'inter_group');
    if (currentUser && currentUser.role === 'mentor') {
      caravanSelect.disabled = true;
    } else {
      caravanSelect.disabled = false;
    }
  }

  window.populateStationDropdownForChallenges('edit-chal-station-id', c.stationId);
  const editDueDate = document.getElementById('edit-chal-due-date');
  if (editDueDate) {
    editDueDate.value = c.dueDate ? new Date(c.dueDate).toISOString().split('T')[0] : '';
  }
  const editStartDate = document.getElementById('edit-chal-start-date');
  if (editStartDate) {
    editStartDate.value = c.startDate ? new Date(c.startDate).toISOString().split('T')[0] : '';
  }
  window.updateChallengeDuration('edit');

  // Creator badge
  const badgeEl = document.getElementById('edit-chal-creator-badge');
  if (badgeEl) {
    if (c.creatorInfo?.isByAdmin) {
      badgeEl.className = 'badge';
      badgeEl.style.cssText = 'background: rgb(var(--primary-rgb) / 0.2); color: #f472b6; border: 1px solid rgba(244, 114, 182, 0.4);';
      badgeEl.innerHTML = '<i class="fa-solid fa-shield-halved"></i> ایجاد شده توسط: مدیر سیستم';
    } else {
      badgeEl.className = 'badge';
      badgeEl.style.cssText = 'background: rgb(var(--info-rgb) / 0.2); color: var(--info-text); border: 1px solid rgb(var(--info-rgb) / 0.4);';
      badgeEl.innerHTML = `<i class="fa-solid fa-user-tie"></i> ایجاد شده توسط راهبر: ${esc(c.creatorInfo?.name || 'راهبر')}`;
    }
  }

  // Questions
  const qContainer = document.getElementById('edit-chal-questions-list');
  if (qContainer) {
    qContainer.innerHTML = '';
    const qList = Array.isArray(c.questions) ? c.questions : [];
    if (qList.length > 0) {
      qList.forEach(q => window.addQuestionRow('edit', q));
    } else {
      window.addQuestionRow('edit');
    }
  }

  window.handleChallengeTypeChange('edit');
  window.handleChallengeAudienceChange('edit');
  modal.style.display = 'flex';
};

window.closeEditChallengeModal = async function(force) {
  if (force !== true && CHL.edit.dirty && !(await NopaConfirm('تغییرات ذخیره‌نشده این چالش از بین می‌رود. ادامه می‌دهید؟', { okText: 'بستن بدون ذخیره', danger: true }))) return;
  CHL.edit.dirty = false;
  const modal = document.getElementById('edit-challenge-modal');
  if (modal) modal.style.display = 'none';
};

window.submitEditChallenge = async function(event) {
  event.preventDefault();

  const id = document.getElementById('edit-chal-id')?.value;
  const title = document.getElementById('edit-chal-title')?.value.trim();
  const reward = window.readChallengeReward('edit');
  if (!reward) return;
  const type = document.getElementById('edit-chal-type')?.value || 'quiz';
  const description = document.getElementById('edit-chal-desc')?.value.trim();
  const caravanId = document.getElementById('edit-chal-caravan-id')?.value;
  const stationId = document.getElementById('edit-chal-station-id')?.value || null;
  const dueDate = document.getElementById('edit-chal-due-date')?.value || null;
  const startDate = document.getElementById('edit-chal-start-date')?.value || null;
  if (startDate && dueDate && startDate > dueDate) {
    showToast('تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.', 'info');
    return;
  }

  if (!id || !title || !description) {
    showToast('لطفاً عنوان و توضیحات چالش را تکمیل فرمایید.', 'error');
    return;
  }

  let questions = [];
  if (type === 'quiz') {
    const cards = document.querySelectorAll('#edit-chal-questions-list .challenge-q-card');
    cards.forEach((card, idx) => {
      const qTitle = card.querySelector('.chal-q-title')?.value.trim() || `مرحله ${idx + 1}`;
      const optInputs = card.querySelectorAll('.chal-q-opt');
      const options = Array.from(optInputs).map(inp => inp.value.trim()).filter(Boolean);
      const radio = card.querySelector('input[type="radio"]:checked');
      const correctIndex = radio ? Number(radio.value) : 0;

      questions.push({
        step: idx + 1,
        q: qTitle,
        options: options.length > 0 ? options : ['گزینه ۱', 'گزینه ۲', 'گزینه ۳', 'گزینه ۴'],
        correct: correctIndex
      });
    });
  }

  try {
    const payload = {
      title,
      description,
      type,
      ...reward,
      stationId: stationId || null,
      startDate: startDate ? new Date(`${startDate}T00:00:00+03:30`).toISOString() : null,
      dueDate: dueDate ? new Date(`${dueDate}T23:59:59+03:30`).toISOString() : null,
      caravanId: caravanId === 'all' ? null : caravanId,
      questions: questions.length > 0 ? questions : undefined
    };

    const res = await request(`/api/v1/admin/challenges/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      showToast('تغییرات چالش با موفقیت ذخیره شد.', 'success');
      window.closeEditChallengeModal(true);
      await window.loadChallengesAndSubmissionsTab();
    } else {
      const data = await res.json();
      showToast(data.error || 'خطایی در ویرایش چالش رخ داد', 'error');
    }
  } catch (err) {
    console.error('submitEditChallenge error:', err);
    showToast('خطا در ارتباط با سرور هنگام ویرایش چالش', 'error');
  }
};

window.deleteChallengeAdmin = async function(challengeId, challengeTitle) {
  if (!(await NopaConfirm(`آیا از حذف چالش "${challengeTitle || challengeId}" اطمینان دارید؟ تمامی تکالیف، پاسخ‌ها و تاریخچه‌ی ثبت‌شده برای این چالش نیز حذف می‌شوند. پاداش‌هایی که قبلاً پرداخت شده برگردانده نمی‌شود.`))) {
    return;
  }

  try {
    const res = await request(`/api/v1/admin/challenges/${challengeId}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      showToast('چالش با موفقیت حذف گردید.', 'success');
      await window.loadChallengesAndSubmissionsTab();
    } else {
      const data = await res.json();
      showToast(data.error || 'خطایی در حذف چالش رخ داد', 'error');
    }
  } catch (err) {
    console.error('deleteChallengeAdmin error:', err);
    showToast('خطا در برقراری ارتباط با سرور', 'error');
  }
};

window.openChallengeStepsModal = function(challengeId) {
  const c = window.cachedAdminChallenges.find(item => item.id === challengeId);
  if (!c) {
    showToast('اطلاعات چالش یافت نشد', 'error');
    return;
  }

  const modal = document.getElementById('challenge-steps-modal');
  const titleEl = document.getElementById('modal-challenge-title');
  const badgeEl = document.getElementById('modal-challenge-badge');
  const bodyEl = document.getElementById('modal-challenge-body');
  if (!modal || !bodyEl) return;

  if (titleEl) titleEl.textContent = c.title || 'مراحل چالش';
  if (badgeEl) badgeEl.textContent = `کد ${c.id} · پاداش ${window.formatChallengeReward(c)} · ${c.type === 'quiz' ? 'آزمون مرحله‌ای' : 'تشریحی'}`;

  const qList = Array.isArray(c.questions) ? c.questions : [];

  let html = '';
  if (qList.length > 0) {
    html += `<p class="lse-lead"><i class="fa-solid fa-circle-info"></i> این چالش ${qList.length} مرحله دارد و دانش‌آموز در اپلیکیشن قدم‌به‌قدم به آن‌ها پاسخ می‌دهد.</p>`;
    qList.forEach((q, idx) => {
      const qText = q.q || q.question || q.title || `مرحله ${idx + 1}`;
      const opts = Array.isArray(q.options) ? q.options : (Array.isArray(q.opts) ? q.opts : []);
      const correctIdx = q.correct !== undefined ? q.correct : -1;
      html += `
        <section class="lse-card">
          <div class="lse-card-row">
            <h4 class="lse-card-title"><i class="fa-solid fa-circle-question"></i> مرحله ${idx + 1} از ${qList.length}</h4>
            <span class="chl-chip">چهارگزینه‌ای</span>
          </div>
          <div class="chl-view-main">${esc(qText)}</div>
          ${opts.length ? `
            <div class="lse-options">
              ${opts.map((opt, oIdx) => `
                <div class="lse-option chl-option-view${oIdx === correctIdx ? ' is-correct' : ''}">
                  <span>${lmsFaDigits(oIdx + 1)}</span>
                  <span class="chl-option-text">${esc(opt)}</span>
                  ${oIdx === correctIdx ? '<span class="chl-option-tag"><i class="fa-solid fa-check"></i> پاسخ درست</span>' : ''}
                </div>`).join('')}
            </div>` : '<p class="lse-hint">این مرحله گزینه ندارد و پاسخ آن تشریحی است.</p>'}
        </section>`;
    });
  } else {
    html += `
      <section class="lse-card">
        <div class="lse-card-row">
          <h4 class="lse-card-title"><i class="fa-solid fa-pen"></i> ${esc(c.title)}</h4>
          <span class="chl-chip is-accent">تشریحی</span>
        </div>
        <div class="chl-view-answer">${esc(c.description)}</div>
        <p class="lse-hint">دانش‌آموز پاسخ را تایپ می‌کند و در صورت نیاز فایل (صدا، عکس یا طرح) ضمیمه می‌کند. راهبر یا مدیر آن را در بخش پاسخ‌ها بررسی و پاداش را ثبت می‌کند.</p>
      </section>`;
  }

  bodyEl.innerHTML = html;
  modal.style.display = 'flex';
};

window.closeChallengeStepsModal = function() {
  const modal = document.getElementById('challenge-steps-modal');
  if (modal) modal.style.display = 'none';
};

window.cachedAdminSubmissions = [];
window.activeViewSubmissionId = null;

function populateSubmissionsFilterDropdowns(submissions = []) {
  const caravanSelect = document.getElementById('filter-submissions-caravan');
  const mentorSelect = document.getElementById('filter-submissions-mentor');
  const studentSelect = document.getElementById('filter-submissions-student');

  // 1. Caravan dropdown
  if (caravanSelect) {
    const currentVal = caravanSelect.value || 'all';
    const caravanMap = new Map();
    if (Array.isArray(window.cachedAdminCaravans)) {
      window.cachedAdminCaravans.forEach(c => {
        if (c.id) caravanMap.set(c.id, c.name || `کاروان ${c.id}`);
      });
    }
    submissions.forEach(s => {
      const c = s.student?.caravan || s.challenge?.caravan;
      if (c && c.id) {
        caravanMap.set(c.id, c.name || `کاروان ${c.id}`);
      } else if (s.student?.caravanId) {
        if (!caravanMap.has(s.student.caravanId)) {
          caravanMap.set(s.student.caravanId, `کاروان ${s.student.caravanId}`);
        }
      }
    });

    let options = '<option value="all">همه کاروان‌ها</option>';
    caravanMap.forEach((name, id) => {
      options += `<option value="${id}">${esc(name)}</option>`;
    });
    caravanSelect.innerHTML = options;
    if (caravanMap.has(currentVal)) {
      caravanSelect.value = currentVal;
    }
  }

  // 2. Mentor dropdown
  if (mentorSelect) {
    const currentVal = mentorSelect.value || 'all';
    const mentorMap = new Map();
    if (Array.isArray(window.cachedAdminCaravans)) {
      window.cachedAdminCaravans.forEach(c => {
        if (c.mentor && c.mentor.id) {
          mentorMap.set(c.mentor.id, c.mentor.name || 'راهبر کاروان');
        }
      });
    }
    submissions.forEach(s => {
      const m = s.student?.caravan?.mentor;
      if (m && m.id) {
        mentorMap.set(m.id, m.name || 'راهبر کاروان');
      }
      const creator = s.challenge?.creatorInfo;
      if (creator && creator.id && !creator.isByAdmin) {
        mentorMap.set(creator.id, creator.name || 'راهبر چالش');
      } else if (s.challenge?.createdByMentorId && !s.challenge.createdByMentorId.toLowerCase().includes('admin')) {
        if (!mentorMap.has(s.challenge.createdByMentorId)) {
          mentorMap.set(s.challenge.createdByMentorId, `راهبر ${s.challenge.createdByMentorId.slice(0, 8)}`);
        }
      }
    });

    let options = '<option value="all">همه راهبران</option>';
    mentorMap.forEach((name, id) => {
      options += `<option value="${id}">${esc(name)}</option>`;
    });
    mentorSelect.innerHTML = options;
    if (mentorMap.has(currentVal)) {
      mentorSelect.value = currentVal;
    }
  }

  // 3. Student dropdown
  if (studentSelect) {
    const currentVal = studentSelect.value || 'all';
    const studentMap = new Map();
    submissions.forEach(s => {
      if (s.student && s.student.id) {
        const phone = s.student.phoneNumber ? ` (${esc(s.student.phoneNumber)})` : '';
        studentMap.set(s.student.id, `${esc(s.student.name || 'دانش‌آموز')}${phone}`);
      } else if (s.studentId) {
        if (!studentMap.has(s.studentId)) {
          studentMap.set(s.studentId, `دانش‌آموز ${s.studentId.slice(0, 8)}`);
        }
      }
    });

    let options = '<option value="all">همه دانش‌آموزان</option>';
    studentMap.forEach((name, id) => {
      options += `<option value="${id}">${name}</option>`;
    });
    studentSelect.innerHTML = options;
    if (studentMap.has(currentVal)) {
      studentSelect.value = currentVal;
    }
  }
}

window.loadAdminSubmissionsData = async function() {
  try {
    const statusFilter = document.getElementById('filter-submissions-status')?.value || 'pending';
    const res = await request(`/api/v1/admin/submissions?status=${statusFilter}`);
    if (!res.ok) return chlEmpty(document.getElementById('admin-submissions-list'), 'خطا در دریافت پاسخ‌ها', 'fa-solid fa-triangle-exclamation');
    const list = await res.json();
    const submissions = Array.isArray(list) ? list : [];
    window.cachedAdminSubmissions = submissions;

    // Calculate stats
    const pendingCount = submissions.filter(s => s.status === 'pending' || s.status === 'PENDING_REVIEW').length;
    const approvedCount = submissions.filter(s => s.status === 'approved').length;
    
    const pendEl = document.getElementById('stat-pending-submissions');
    if (pendEl) pendEl.textContent = pendingCount;
    const appEl = document.getElementById('stat-approved-submissions');
    if (appEl) appEl.textContent = approvedCount;

    populateSubmissionsFilterDropdowns(submissions);
    window.filterAdminSubmissionsList();
    window.renderChallengeInsights();
  } catch (err) {
    console.error('loadAdminSubmissionsData error:', err);
    chlEmpty(document.getElementById('admin-submissions-list'), 'خطا در دریافت پاسخ‌ها', 'fa-solid fa-triangle-exclamation');
  }
};

window.filterAdminSubmissionsList = function() {
  const query = (document.getElementById('filter-submissions-search')?.value || '').trim().toLowerCase();
  const selectedStudent = document.getElementById('filter-submissions-student')?.value || 'all';
  const selectedCaravan = document.getElementById('filter-submissions-caravan')?.value || 'all';
  const selectedMentor = document.getElementById('filter-submissions-mentor')?.value || 'all';

  let filtered = Array.isArray(window.cachedAdminSubmissions) ? [...window.cachedAdminSubmissions] : [];

  // Filter by Student
  if (selectedStudent !== 'all') {
    filtered = filtered.filter(s => s.studentId === selectedStudent || s.student?.id === selectedStudent);
  }

  // Filter by Caravan
  if (selectedCaravan !== 'all') {
    filtered = filtered.filter(s => {
      const studentCaravanId = s.student?.caravanId || s.student?.caravan?.id;
      const challengeCaravanId = s.challenge?.caravanId || s.challenge?.caravan?.id;
      return studentCaravanId === selectedCaravan || challengeCaravanId === selectedCaravan;
    });
  }

  // Filter by Mentor
  if (selectedMentor !== 'all') {
    filtered = filtered.filter(s => {
      const challengeCreatorId = s.challenge?.createdByMentorId || s.challenge?.creatorInfo?.id;
      const caravanMentorId = s.student?.caravan?.mentorId || s.student?.caravan?.mentor?.id;
      return challengeCreatorId === selectedMentor || caravanMentorId === selectedMentor;
    });
  }

  // Filter by Search text (student name, phone, challenge title, challenge id, answer text, caravan name, mentor name)
  if (query) {
    filtered = filtered.filter(s => {
      const sName = (s.student?.name || '').toLowerCase();
      const sPhone = (s.student?.phoneNumber || '').toLowerCase();
      const cTitle = (s.challenge?.title || '').toLowerCase();
      const cId = (s.challengeId || s.challenge?.id || '').toLowerCase();
      const ans = (s.answerText || '').toLowerCase();
      const carName = (s.student?.caravan?.name || s.challenge?.caravan?.name || '').toLowerCase();
      const mName = (s.student?.caravan?.mentor?.name || s.challenge?.creatorInfo?.name || '').toLowerCase();

      return sName.includes(query) ||
             sPhone.includes(query) ||
             cTitle.includes(query) ||
             cId.includes(query) ||
             ans.includes(query) ||
             carName.includes(query) ||
             mName.includes(query);
    });
  }

  const badgeEl = document.getElementById('badge-submissions-filtered-count');
  if (badgeEl) {
    const total = window.cachedAdminSubmissions ? window.cachedAdminSubmissions.length : 0;
    badgeEl.textContent = `${filtered.length} از ${total} پاسخ`;
  }

  renderAdminSubmissions(filtered);
};

window.resetAdminSubmissionsFilters = function() {
  const searchInput = document.getElementById('filter-submissions-search');
  if (searchInput) searchInput.value = '';

  const studentSelect = document.getElementById('filter-submissions-student');
  if (studentSelect) studentSelect.value = 'all';

  const caravanSelect = document.getElementById('filter-submissions-caravan');
  if (caravanSelect) caravanSelect.value = 'all';

  const mentorSelect = document.getElementById('filter-submissions-mentor');
  if (mentorSelect) mentorSelect.value = 'all';

  const statusSelect = document.getElementById('filter-submissions-status');
  if (statusSelect) statusSelect.value = 'pending';

  window.loadAdminSubmissionsData();
};

function renderAdminSubmissions(submissions) {
  const list = document.getElementById('admin-submissions-list');
  if (!list) return;

  if (submissions.length === 0) {
    chlEmpty(list, 'هیچ پاسخی با فیلترهای انتخابی یافت نشد', 'fa-solid fa-filter-circle-xmark');
    return;
  }

  list.innerHTML = submissions.map(s => {
    const studentName = s.student?.name || 'دانش‌آموز نپا';
    const studentPhone = s.student?.phoneNumber || '';
    const caravanName = s.student?.caravan?.name || s.challenge?.caravan?.name || 'عمومی (فاقد کاروان)';
    const mentorName = s.student?.caravan?.mentor?.name || s.challenge?.creatorInfo?.name || 'راهبر نامشخص';
    const chalTitle = s.challenge?.title || s.challengeId || 'تکلیف کلاسی';
    const answer = s.answerText || 'بدون متن (فایل ارسالی)';
    const dateStr = s.submittedAt ? new Date(s.submittedAt).toLocaleDateString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : '-';
    const rewardVal = s.challenge?.rewardZarik || 50;
    const isPending = s.status === 'pending' || s.status === 'PENDING_REVIEW';
    const sid = String(s.id);

    let chip;
    if (isPending) chip = '<span class="lst-chip lst-chip-scheduled"><i class="fa-regular fa-clock"></i> در انتظار ارزیابی</span>';
    else if (s.status === 'approved') chip = `<span class="lst-chip lst-chip-active"><i class="fa-solid fa-check"></i> تایید شده (+${s.score || rewardVal} زریک)</span>`;
    else chip = '<span class="lst-chip lst-chip-locked"><i class="fa-solid fa-xmark"></i> رد شده</span>';

    const file = s.fileUrl
      ? `<a href="${esc(s.fileUrl)}" target="_blank" rel="noopener" class="lsv-round lsv-round-sm" title="دانلود فایل پیوست" aria-label="دانلود فایل پیوست"><i class="fa-solid fa-download"></i></a>`
      : '';

    return `
      <div class="chl-sub">
        <span class="chl-sub-avatar">${esc(String(studentName).trim().charAt(0) || '؟')}</span>
        <div class="chl-sub-who">
          <strong>${esc(studentName)}</strong>
          <span>${esc(studentPhone)}</span>
          <span><i class="fa-solid fa-users"></i> ${esc(caravanName)} · <i class="fa-solid fa-user-tie"></i> ${esc(mentorName)}</span>
        </div>
        <div class="chl-sub-body" role="button" tabindex="0" data-click="openViewSubmissionModal" data-click-args="${esc(JSON.stringify([sid]))}" title="برای مشاهده کامل پاسخ کلیک کنید">
          <strong>${esc(chalTitle)}</strong>
          <span class="chl-sub-answer">${esc(answer)}</span>
        </div>
        <div class="chl-sub-side">
          ${chip}
          <span class="chl-sub-date">${dateStr} · <i class="fa-solid fa-coins"></i> ${rewardVal}</span>
        </div>
        <span class="lsv-round-group">
          ${file}
          ${chlRoundBtn('fa-solid fa-eye', 'مشاهده کامل و ارزیابی پاسخ', 'openViewSubmissionModal', [sid])}
          ${isPending ? chlRoundBtn('fa-solid fa-check', 'تایید سریع', 'reviewAdminSubmission', [sid, true, rewardVal], 'chl-btn-ok') : ''}
          ${isPending ? chlRoundBtn('fa-solid fa-xmark', 'رد سریع', 'reviewAdminSubmission', [sid, false, 0], 'lsv-round-danger') : ''}
        </span>
      </div>`;
  }).join('');
}

// Side tiles of the bento: submission status, challenge mix and the challenges with the most pending answers
window.renderChallengeInsights = function() {
  const challenges = window.cachedAdminChallenges || [];
  const subs = window.cachedAdminSubmissions || [];
  const isPendingStatus = x => x.status === 'pending' || x.status === 'PENDING_REVIEW';

  const statusEl = document.getElementById('chl-bento-status');
  if (statusEl) {
    const counts = { pending: 0, approved: 0, rejected: 0 };
    subs.forEach(x => {
      if (isPendingStatus(x)) counts.pending++;
      else if (x.status === 'approved') counts.approved++;
      else counts.rejected++;
    });
    const total = subs.length || 1;
    const pct = k => (counts[k] / total * 100).toFixed(1);
    statusEl.innerHTML = `
      <div class="lst-bar">
        <span class="lst-bar-scheduled" data-style="width:${pct('pending')}%"></span>
        <span class="lst-bar-active" data-style="width:${pct('approved')}%"></span>
        <span class="lst-bar-locked" data-style="width:${pct('rejected')}%"></span>
      </div>
      <div class="lst-legend">
        <div class="lst-legend-row"><span><span class="lst-dot lst-dot-scheduled"></span>در انتظار ارزیابی</span><strong>${counts.pending}</strong></div>
        <div class="lst-legend-row"><span><span class="lst-dot lst-dot-active"></span>تایید شده</span><strong>${counts.approved}</strong></div>
        <div class="lst-legend-row"><span><span class="lst-dot lst-dot-locked"></span>رد شده</span><strong>${counts.rejected}</strong></div>
      </div>`;
  }

  const typesEl = document.getElementById('chl-bento-types');
  if (typesEl) {
    const byAdmin = challenges.filter(c => c.creatorInfo?.isByAdmin ?? !c.createdByMentorId).length;
    const quiz = challenges.filter(c => c.type === 'quiz').length;
    const rows = [
      ['آزمون مرحله‌ای', quiz],
      ['تشریحی', challenges.length - quiz],
      ['میان‌گروهی (درفش)', challenges.filter(c => c.category === 'inter_group').length],
      ['ساخته‌ی مدیر', byAdmin],
      ['ساخته‌ی راهبران', challenges.length - byAdmin]
    ];
    typesEl.innerHTML = `<div class="lst-legend">${rows.map(([label, n]) => `<div class="lst-legend-row"><span>${label}</span><strong>${n}</strong></div>`).join('')}</div>`;
  }

  const pendEl = document.getElementById('chl-bento-pending');
  if (pendEl) {
    const top = challenges
      .map(c => ({ c, n: c.pendingSubmissions || (c.submissions ? c.submissions.filter(isPendingStatus).length : 0) }))
      .filter(x => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, 4);
    pendEl.innerHTML = top.length
      ? `<ul class="lst-list">${top.map(({ c, n }) => `
          <li class="lst-list-item lst-clickable" role="button" tabindex="0" data-click="openChallengeStepsModal" data-click-args="${esc(JSON.stringify([String(c.id)]))}">
            <i class="fa-regular fa-clock u-c-accent-text"></i>
            <span class="lst-grow"><strong>${esc(c.title)}</strong></span>
            <span>${n} پاسخ</span>
          </li>`).join('')}</ul>`
      : '<div class="lst-empty">پاسخی در انتظار ارزیابی نیست.</div>';
  }
};

// ==========================================
// VIEW SUBMISSION & ANSWER MODAL
// ==========================================

window.openViewSubmissionModal = function(submissionId) {
  const s = window.cachedAdminSubmissions.find(item => item.id === submissionId);
  if (!s) {
    showToast('اطلاعات پاسخ یافت نشد', 'error');
    return;
  }

  window.activeViewSubmissionId = submissionId;
  const modal = document.getElementById('view-submission-modal');
  if (!modal) return;

  // Student Info
  const studentName = s.student?.name || 'دانش‌آموز نپا';
  const studentPhone = s.student?.phoneNumber ? `تلفن: ${esc(s.student.phoneNumber)}` : '';
  const caravanName = s.student?.caravan?.name ? `کاروان: ${esc(s.student.caravan.name)}` : 'کاروان: عمومی';

  document.getElementById('view-sub-student-name').textContent = studentName;
  document.getElementById('view-sub-student-phone').textContent = studentPhone;
  document.getElementById('view-sub-student-caravan').textContent = caravanName;

  // Challenge Info
  const chalTitle = s.challenge?.title || s.challengeId || 'تکلیف کلاسی';
  const defaultReward = s.challenge?.rewardZarik || 50;
  const dateStr = s.submittedAt ? new Date(s.submittedAt).toLocaleDateString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : '-';

  document.getElementById('view-sub-chal-title').textContent = chalTitle;
  document.getElementById('view-sub-chal-reward').innerHTML = `<i class="fa-solid fa-coins"></i> پاداش چالش: ${window.formatChallengeReward(s.challenge || {})}`;
  document.getElementById('view-sub-date').textContent = `تاریخ ارسال: ${dateStr}`;

  // Status Badge
  const metaBadge = document.getElementById('view-sub-meta-badge');
  const isPending = s.status === 'pending' || s.status === 'PENDING_REVIEW';
  if (metaBadge) {
    if (isPending) {
      metaBadge.style.color = 'var(--accent-text)';
      metaBadge.innerHTML = '<i class="fa-solid fa-clock"></i> وضعیت: در انتظار بررسی و ارزیابی';
    } else if (s.status === 'approved') {
      metaBadge.style.color = 'var(--success-text)';
      metaBadge.innerHTML = `<i class="fa-solid fa-check"></i> وضعیت: تایید شده (+${s.score || defaultReward} ${s.challenge?.rewardAssetType === 'nakh' ? 'کلاف' : 'زریک'})`;
    } else {
      metaBadge.style.color = 'var(--danger-text)';
      metaBadge.innerHTML = '<i class="fa-solid fa-times"></i> وضعیت: رد شده';
    }
  }

  // Answer Text
  const answerEl = document.getElementById('view-sub-answer-text');
  if (answerEl) {
    answerEl.textContent = s.answerText || 'دانش‌آموز متن پاسخی وارد نکرده است (فقط فایل پیوست ارسال شده است).';
  }

  // File Attachment
  const fileContainer = document.getElementById('view-sub-file-container');
  if (fileContainer) {
    if (s.fileUrl) {
      const isImg = s.fileUrl.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i);
      if (isImg) {
        fileContainer.innerHTML = `
          <div class="u-flex u-col u-gap-8">
            <a href="${esc(s.fileUrl)}" target="_blank" title="مشاهده تصویر در اندازه اصلی">
              <img src="${esc(s.fileUrl)}" class="u-maxh-220 u-maxw-100p u-r-8 u-fit-contain u-bd-fg-10 u-bg-shade-40" />
            </a>
            <div class="u-fs-2xs u-c-text-muted">برای مشاهده در اندازه بزرگ روی تصویر کلیک کنید.</div>
          </div>
        `;
      } else {
        fileContainer.innerHTML = `
          <div class="u-flex u-items-center u-justify-between u-wrap u-gap-10">
            <div class="u-flex u-items-center u-gap-8 u-c-text-soft u-fs-sm">
              <i class="fa-solid fa-file-lines u-c-primary-text u-fs-lg"></i>
              <span>فایل ضمیمه شده توسط دانش‌آموز</span>
            </div>
            <a href="${esc(s.fileUrl)}" target="_blank" class="lse-btn">
              <i class="fa-solid fa-download"></i> دانلود و مشاهده فایل
            </a>
          </div>
        `;
      }
    } else {
      fileContainer.innerHTML = `<span class="u-c-text-faint u-fs-xs"><i class="fa-solid fa-info-circle"></i> بدون فایل یا پیوست ضمیمه</span>`;
    }
  }

  // Pre-fill Feedback and Reward
  const feedbackInput = document.getElementById('view-sub-feedback-input');
  if (feedbackInput) {
    feedbackInput.value = s.mentorFeedback || (isPending ? 'پاسخ شما بررسی شد و مورد تایید قرار گرفت.' : '');
  }

  const rewardInput = document.getElementById('view-sub-reward-input');
  if (rewardInput) {
    const ch = s.challenge || {};
    if (Number(ch.rewardMax) > 0) {
      rewardInput.min = ch.rewardMin || 0;
      rewardInput.max = ch.rewardMax;
    }
    rewardInput.value = s.score || defaultReward;
  }

  // Setup buttons inside modal
  const approveBtn = document.getElementById('view-sub-btn-approve');
  if (approveBtn) {
    approveBtn.onclick = () => window.submitReviewFromModal(true);
  }

  const rejectBtn = document.getElementById('view-sub-btn-reject');
  if (rejectBtn) {
    rejectBtn.onclick = () => window.submitReviewFromModal(false);
  }

  modal.style.display = 'flex';
  modal.classList.remove('hidden');
};

window.closeViewSubmissionModal = function() {
  const modal = document.getElementById('view-submission-modal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.add('hidden');
  }
};

window.submitReviewFromModal = async function(isApproved) {
  if (!window.activeViewSubmissionId) return;

  const score = isApproved ? Number(document.getElementById('view-sub-reward-input')?.value || 50) : 0;
  const feedback = document.getElementById('view-sub-feedback-input')?.value.trim() || (isApproved ? 'تکلیف تایید شد.' : 'تکلیف رد شد.');

  try {
    const res = await request(`/api/v1/admin/submissions/${window.activeViewSubmissionId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isApproved,
        status: isApproved ? 'approved' : 'rejected',
        score: score,
        mentorFeedback: feedback
      })
    });

    if (res.ok) {
      showToast(isApproved ? 'تکلیف با موفقیت تایید شد و زریک به دانش‌آموز اعطا گردید.' : 'تکلیف رد شد و اعلان ارسال گردید.', 'success');
      window.closeViewSubmissionModal();
      await window.loadAdminSubmissionsData();
    } else {
      const data = await res.json();
      showToast(data.error || 'خطایی در ثبت ارزیابی رخ داد', 'error');
    }
  } catch (err) {
    console.error('submitReviewFromModal error:', err);
    showToast('خطا در برقراری ارتباط با سرور', 'error');
  }
};

window.copySubmissionAnswerText = function() {
  const text = document.getElementById('view-sub-answer-text')?.textContent || '';
  if (!text || text === '-') {
    showToast('متنی برای کپی وجود ندارد', 'info');
    return;
  }
  navigator.clipboard.writeText(text).then(() => {
    showToast('متن پاسخ دانش‌آموز در کلیپ‌بورد کپی شد.', 'info');
  }).catch(() => {
    showToast('امکان کپی در کلیپ‌بورد فراهم نشد.', 'info');
  });
};

window.reviewAdminSubmission = async function(id, isApproved, defaultReward) {
  const promptScore = isApproved ? (prompt('میزان پاداش زریک اهدایی به دانش‌آموز:', defaultReward) || defaultReward) : 0;
  if (isApproved && promptScore === null) return; // user cancelled

  const promptFeedback = prompt('یادداشت / فیدبک ارزیابی برای دانش‌آموز:', isApproved ? 'پاسخ و تکلیف شما بررسی و با موفقیت تایید شد.' : 'پاسخ شما ناقص بوده یا نیاز به بازبینی دارد.');
  if (promptFeedback === null) return; // user cancelled

  try {
    const res = await request(`/api/v1/admin/submissions/${id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isApproved,
        status: isApproved ? 'approved' : 'rejected',
        score: Number(promptScore),
        mentorFeedback: promptFeedback
      })
    });

    if (res.ok) {
      showToast(isApproved ? 'تکلیف با موفقیت تایید شد و زریک به حساب دانش‌آموز اضافه گردید.' : 'تکلیف رد شد و اطلاع‌رسانی ارسال شد.', 'success');
      window.loadChallengesAndSubmissionsTab();
    } else {
      const data = await res.json();
      showToast(data.error || 'خطایی در ارزیابی تکلیف رخ داد', 'error');
    }
  } catch (err) {
    console.error('reviewAdminSubmission error:', err);
    showToast('خطا در ارتباط با سرور', 'error');
  }
};


// ==========================================
// CHALLENGE EDITOR SHELL (tabs when editing, a four-step wizard with a review when creating)
// Same pattern as the station editor (js/features/lms/station-editor.js); the fields keep their ids.
// ==========================================
const CHL = { new: { step: 0, max: 0, dirty: false }, edit: { tab: 'info', dirty: false } };
const CHL_NEW_PANES = ['info', 'reward', 'steps', 'review'];
const chlModal = mode => document.getElementById(mode === 'new' ? 'create-challenge-modal' : 'edit-challenge-modal');

function chlMarkDirty(mode) {
  if (!CHL[mode] || CHL[mode].dirty) return;
  CHL[mode].dirty = true;
  chlRefreshNote(mode);
}

function chlRefreshNote(mode) {
  if (mode !== 'edit') return;
  const note = document.getElementById('edit-chal-note');
  if (!note) return;
  const dirty = CHL.edit.dirty;
  note.classList.toggle('is-dirty', dirty);
  note.innerHTML = dirty
    ? '<span class="lse-dot"></span> تغییر ذخیره‌نشده دارید.'
    : '<i class="fa-solid fa-circle-info"></i> همه تغییرات با یک دکمه ذخیره می‌شود.';
}

window.chlGoPane = function(mode, pane) {
  const root = chlModal(mode);
  if (!root) return;
  if (mode === 'new') {
    const idx = CHL_NEW_PANES.indexOf(pane);
    if (idx < 0 || idx > CHL.new.max) return;
    CHL.new.step = idx;
  } else {
    CHL.edit.tab = pane;
  }
  root.querySelectorAll('.chl-pane').forEach(el => el.classList.toggle('is-active', el.dataset.pane === pane));
  root.querySelectorAll('[data-chl-tab]').forEach(btn => {
    const i = CHL_NEW_PANES.indexOf(btn.dataset.chlTab);
    const active = btn.dataset.chlTab === pane;
    btn.classList.toggle('is-active', active);
    if (mode === 'new') {
      btn.classList.toggle('is-done', i < CHL.new.step);
      btn.disabled = i > CHL.new.max;
      const num = btn.querySelector('.lse-step-num');
      if (num) num.innerHTML = i < CHL.new.step ? '<i class="fa-solid fa-check"></i>' : lmsFaDigits(i + 1);
    }
  });
  if (pane === 'review') chlRenderReview();
  if (pane === 'steps') chlRenderQIndex(mode);
  if (mode === 'new') {
    const last = CHL.new.step === CHL_NEW_PANES.length - 1;
    const show = (id, on, display = '') => { const el = document.getElementById(id); if (el) el.style.display = on ? display : 'none'; };
    show('new-chal-prev', CHL.new.step > 0, 'inline-flex');
    show('new-chal-next', !last, 'inline-flex');
    show('new-chal-submit', last, 'inline-flex');
    const note = document.getElementById('new-chal-note');
    if (note) note.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${last ? 'با «ایجاد چالش» همه اطلاعات ثبت و اعلان ارسال می‌شود.' : 'تا قدم آخر چیزی ذخیره نمی‌شود.'}`;
  }
  const body = document.getElementById(`${mode}-chal-body`);
  if (body) body.scrollTop = 0;
};

window.chlStep = function(mode, delta) {
  if (mode !== 'new') return;
  const next = CHL.new.step + Number(delta);
  if (next < 0 || next >= CHL_NEW_PANES.length) return;
  if (delta > 0 && CHL.new.step === 0) {
    const title = document.getElementById('new-chal-title')?.value.trim();
    const desc = document.getElementById('new-chal-desc')?.value.trim();
    if (!title || !desc) {
      showToast('عنوان و صورت تکلیف را بنویسید، بعد ادامه دهید.', 'error');
      (title ? document.getElementById('new-chal-desc') : document.getElementById('new-chal-title'))?.focus();
      return;
    }
  }
  CHL.new.max = Math.max(CHL.new.max, next);
  window.chlGoPane('new', CHL_NEW_PANES[next]);
};

// The create form only submits from the last step; Enter on an earlier step just moves on
const chlSubmitCreate = window.submitCreateChallenge;
window.submitCreateChallenge = function(event) {
  if (CHL.new.step < CHL_NEW_PANES.length - 1) {
    if (event && event.preventDefault) event.preventDefault();
    window.chlStep('new', 1);
    return;
  }
  if (event && event.preventDefault) event.preventDefault();
  if (chlBlockOnIssues('new')) return;
  return chlSubmitCreate(event);
};
const chlSubmitEdit = window.submitEditChallenge;
window.submitEditChallenge = function(event) {
  if (event && event.preventDefault) event.preventDefault();
  if (chlBlockOnIssues('edit')) return;
  return chlSubmitEdit(event);
};

// Problems that stop a challenge from being saved: [{ msg, pane }]
function chlIssues(mode) {
  const val = id => (document.getElementById(`${mode}-${id}`)?.value || '').trim();
  const issues = [];
  if (!val('chal-title')) issues.push({ msg: 'عنوان چالش خالی است.', pane: 'info' });
  if (!val('chal-desc')) issues.push({ msg: 'صورت تکلیف خالی است.', pane: 'info' });
  if (val('chal-caravan-id') !== 'inter_group') {
    const min = Number(val('chal-reward-min'));
    const max = Number(val('chal-reward-max'));
    if (!(max > 0)) issues.push({ msg: 'حداکثر پاداش باید بزرگ‌تر از صفر باشد.', pane: 'reward' });
    else if (min > max) issues.push({ msg: 'حداقل پاداش از حداکثر بیشتر است.', pane: 'reward' });
  }
  if (val('chal-type') === 'quiz') {
    const cards = chlCards(mode);
    if (!cards.length) issues.push({ msg: 'آزمون مرحله‌ای حداقل یک سوال لازم دارد.', pane: 'steps' });
    cards.forEach((card, i) => {
      const info = chlCardInfo(card);
      if (!info.title) issues.push({ msg: `سوال ${lmsFaDigits(i + 1)} صورت ندارد.`, pane: 'steps', qid: card.dataset.qid });
      if (info.filled < 2) issues.push({ msg: `سوال ${lmsFaDigits(i + 1)} حداقل دو گزینه لازم دارد.`, pane: 'steps', qid: card.dataset.qid });
    });
  }
  return issues;
}

// Create / save stop at the first problem and open the place to fix it
function chlBlockOnIssues(mode) {
  const issues = chlIssues(mode);
  if (!issues.length) return false;
  const first = issues[0];
  showToast(`${first.msg}${issues.length > 1 ? ` (و ${lmsFaDigits(issues.length - 1)} مورد دیگر)` : ''}`, 'error');
  if (mode === 'new') {
    CHL.new.max = Math.max(CHL.new.max, CHL_NEW_PANES.indexOf('review'));
    window.chlGoPane('new', 'review');
  } else {
    window.chlGoPane('edit', first.pane);
    if (first.qid) chlSelectQuestion('edit', first.qid);
  }
  return true;
}

function chlRenderReview() {
  const box = document.getElementById('new-chal-review');
  if (!box) return;
  const val = id => (document.getElementById(id)?.value || '').trim();
  const selText = id => {
    const el = document.getElementById(id);
    return el && el.selectedIndex >= 0 ? el.options[el.selectedIndex].textContent.trim() : '';
  };
  const inter = val('new-chal-caravan-id') === 'inter_group';
  const isQuiz = val('new-chal-type') === 'quiz';
  const issues = chlIssues('new').map(i => i.msg);
  const row = (label, value) => `<div class="chl-rev-row"><span>${label}</span><strong>${value ? esc(value) : '<em>-</em>'}</strong></div>`;
  const edit = pane => `<button type="button" class="lse-btn" data-click="chlGoPane" data-click-args="${esc(JSON.stringify(['new', pane]))}"><i class="fa-solid fa-pen"></i> ویرایش</button>`;
  const submitBtn = document.getElementById('new-chal-submit');
  if (submitBtn) {
    submitBtn.disabled = issues.length > 0;
    submitBtn.title = issues.length ? 'ابتدا مشکلات بالا را برطرف کنید' : '';
  }
  const dates = [val('new-chal-start-date'), val('new-chal-due-date')];
  const cards = chlCards('new');

  box.innerHTML = `
    ${issues.length
      ? `<div class="chl-rev-issues"><strong><i class="fa-solid fa-triangle-exclamation"></i> قبل از ثبت اصلاح کنید</strong><ul>${issues.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`
      : '<p class="lse-lead"><i class="fa-solid fa-circle-check"></i> همه‌چیز آماده است. اگر درست است «ایجاد چالش» را بزنید.</p>'}
    <section class="lse-card">
      <div class="lse-card-row"><h4 class="lse-card-title"><i class="fa-solid fa-circle-info"></i> مشخصات</h4>${edit('info')}</div>
      ${row('عنوان', val('new-chal-title'))}
      ${row('نوع', selText('new-chal-type'))}
      ${row('مخاطب', selText('new-chal-caravan-id'))}
      ${row('منزلگاه', selText('new-chal-station-id'))}
      <div class="chl-rev-text">${esc(val('new-chal-desc')) || '<em>-</em>'}</div>
    </section>
    <section class="lse-card">
      <div class="lse-card-row"><h4 class="lse-card-title"><i class="fa-solid fa-coins"></i> پاداش و مهلت</h4>${edit('reward')}</div>
      ${inter
        ? row('پاداش', 'درفش (بر اساس رتبه‌ی کاروان‌ها)')
        : row('پاداش', `${val('new-chal-reward-min')} تا ${val('new-chal-reward-max')} کلاف`)}
      ${row('شروع', dates[0])}
      ${row('پایان', dates[1])}
    </section>
    <section class="lse-card">
      <div class="lse-card-row"><h4 class="lse-card-title"><i class="fa-solid fa-list-check"></i> مراحل</h4>${edit('steps')}</div>
      ${isQuiz
        ? (cards.length
          ? cards.map((card, i) => {
              const info = chlCardInfo(card);
              return `<div class="chl-rev-row"><span>${lmsFaDigits(i + 1)}</span><strong>${esc(info.title || 'بدون صورت سوال')}</strong><small>${lmsFaDigits(info.filled)} گزینه</small></div>`;
            }).join('')
          : '<p class="lse-hint">هنوز سوالی نوشته نشده است.</p>')
        : '<p class="lse-hint">چالش تشریحی است و مرحله ندارد.</p>'}
    </section>`;
}

// Any change in a form marks it as unsaved (programmatic fills on open do not fire input events)
['new', 'edit'].forEach(mode => {
  const form = document.getElementById(mode === 'new' ? 'create-challenge-form' : 'edit-challenge-form');
  if (!form) return;
  form.addEventListener('input', () => chlMarkDirty(mode));
  form.addEventListener('change', () => chlMarkDirty(mode));
});

// After the original open functions fill the fields: back to the first tab / step, clean state
function chlAfterOpen(mode) {
  CHL[mode].dirty = false;
  chlBindQuestions(mode);
  const first = chlCards(mode)[0];
  chlSelected[mode] = first ? first.dataset.qid : null;
  chlCards(mode).forEach(c => c.classList.toggle('is-selected', c === first));
  chlRenderQIndex(mode);
  if (mode === 'new') { CHL.new.step = 0; CHL.new.max = 0; }
  window.chlGoPane(mode, 'info');
  window.handleChallengeTypeChange(mode);
  chlRefreshNote(mode);
}
const chlOpenCreate = window.openCreateChallengeModal;
window.openCreateChallengeModal = function() { chlOpenCreate.apply(this, arguments); chlAfterOpen('new'); };
const chlOpenEdit = window.openEditChallengeModal;
window.openEditChallengeModal = function() { chlOpenEdit.apply(this, arguments); chlAfterOpen('edit'); };


// Called by the shared drag engine (js/features/lms/station-dnd.js, sortable "chl-question") with the new row order
window.chlQuestionReorder = function(mode, qids) {
  const list = document.getElementById(`${mode}-chal-questions-list`);
  if (!list) return false;
  const before = chlCards(mode).map(c => c.dataset.qid).join();
  if (before === qids.join()) return false;
  qids.forEach(id => {
    const card = list.querySelector(`.challenge-q-card[data-qid="${id}"]`);
    if (card) list.appendChild(card);
  });
  chlMarkDirty(mode);
  chlRenderQIndex(mode);
  return true;
};
window.chlQuestionRedraw = mode => chlRenderQIndex(mode);

// ==========================================
// DRAFTS (kept in this browser; see js/ui/drafts.js)
// ==========================================
const CHL_FIELDS = ['chal-title', 'chal-type', 'chal-caravan-id', 'chal-station-id', 'chal-desc', 'chal-asset', 'chal-reward-min', 'chal-reward-max', 'chal-start-date', 'chal-due-date'];
const chlDraftKey = mode => (mode === 'new' ? 'challenge:new' : `challenge:${document.getElementById('edit-chal-id')?.value || ''}`);

function chlSnapshot(mode) {
  const fields = {};
  CHL_FIELDS.forEach(f => { const el = document.getElementById(`${mode}-${f}`); if (el) fields[f] = el.value; });
  const questions = chlCards(mode).map(card => {
    const info = chlCardInfo(card);
    return { q: info.title, options: info.opts, correct: Math.max(info.correct, 0) };
  });
  return { fields, questions, step: mode === 'new' ? CHL.new.step : 0 };
}

function chlRestore(mode, snap) {
  CHL_FIELDS.forEach(f => {
    const el = document.getElementById(`${mode}-${f}`);
    if (el && snap.fields && snap.fields[f] !== undefined && !el.disabled) el.value = snap.fields[f];
  });
  window.handleChallengeAudienceChange(mode);
  window.handleChallengeTypeChange(mode);
  window.updateChallengeDuration(mode);
  const list = document.getElementById(`${mode}-chal-questions-list`);
  if (list) {
    list.innerHTML = '';
    chlSelected[mode] = null;
    (snap.questions || []).forEach(q => window.addQuestionRow(mode, q));
  }
  chlRenderQIndex(mode);
  if (mode === 'new') {
    const step = Math.min(snap.step || 0, CHL_NEW_PANES.length - 1);
    CHL.new.max = step;
    window.chlGoPane('new', CHL_NEW_PANES[step]);
  }
  CHL[mode].dirty = true;
  chlRefreshNote(mode);
}

window.chlRefreshDraftChip = function() {
  const show = window.NopaDrafts && NopaDrafts.has('challenge:new') ? '' : 'none';
  ['chl-draft-chip', 'chl-draft-del'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = show; });
};
document.addEventListener('nopa-drafts', () => window.chlRefreshDraftChip());

window.chlDeleteDraft = async function() {
  if (!(await NopaConfirm('پیش‌نویس این چالش حذف شود؟ این کار قابل بازگشت نیست.', { okText: 'حذف پیش‌نویس', danger: true }))) return;
  NopaDrafts.remove('challenge:new');
  showToast('پیش‌نویس حذف شد.', 'success');
};

// Closing with unsaved work offers a draft instead of losing it
async function chlConfirmClose(mode) {
  if (!CHL[mode].dirty) return true;
  const problems = chlIssues(mode).length;
  const choice = await NopaDrafts.askOnClose({ what: 'این چالش', problems, isNew: mode === 'new' });
  if (choice === 'stay') return false;
  const key = chlDraftKey(mode);
  if (choice === 'save') {
    if (NopaDrafts.save(key, chlSnapshot(mode))) showToast('پیش‌نویس ذخیره شد؛ بعداً می‌توانید ادامه دهید.', 'success');
    else showToast('ذخیره پیش‌نویس در این مرورگر ممکن نشد.', 'error');
  }
  window.chlRefreshDraftChip();
  return true;
}

window.closeCreateChallengeModal = async function(force) {
  if (force === true) NopaDrafts.remove(chlDraftKey('new'));
  else if (!(await chlConfirmClose('new'))) return;
  CHL.new.dirty = false;
  const modal = document.getElementById('create-challenge-modal');
  if (modal) { modal.style.display = 'none'; modal.classList.add('hidden'); }
  window.chlRefreshDraftChip();
};
window.closeEditChallengeModal = async function(force) {
  if (force === true) NopaDrafts.remove(chlDraftKey('edit'));
  else if (!(await chlConfirmClose('edit'))) return;
  CHL.edit.dirty = false;
  const modal = document.getElementById('edit-challenge-modal');
  if (modal) modal.style.display = 'none';
};

// Opening: a saved draft is offered back (the "ادامه پیش‌نویس" button opens it directly)
let chlRestoreNow = false;
async function chlOfferDraft(mode) {
  const key = chlDraftKey(mode);
  const draft = NopaDrafts.load(key);
  if (!draft) return;
  if (!chlRestoreNow && (await NopaDrafts.offerResume(key, 'پیش‌نویس چالش')) !== 'resume') return;
  chlRestore(mode, draft.data);
}
window.chlResumeDraft = function() {
  chlRestoreNow = true;
  window.openCreateChallengeModal();
};

const chlOpenCreate2 = window.openCreateChallengeModal;
window.openCreateChallengeModal = async function() {
  const resume = chlRestoreNow;
  chlOpenCreate2.apply(this, arguments);
  await chlOfferDraft('new');
  chlRestoreNow = false;
  return resume;
};
const chlOpenEdit2 = window.openEditChallengeModal;
window.openEditChallengeModal = async function() {
  chlOpenEdit2.apply(this, arguments);
  await chlOfferDraft('edit');
};
window.chlRefreshDraftChip();

// The tab starts in its loading state until the first fetch finishes
if (!window.cachedAdminChallenges.length) window.chlSetLoading(true);
