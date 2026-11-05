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
      window.chlLoadTaxonomy(),
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
  const fill = { 'chl-bento-caravans': lines(3), 'chl-bento-status': lines(3), 'chl-bento-types': lines(2), 'chl-bento-pending': lines(3) };
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
      window.chlRenderCaravanBoard();
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
    filterSelect.innerHTML = `<option value="all">همه کاروان‌ها و راهبران</option><option value="public">فقط چالش‌های فراگروهی (همه‌ی کاروان‌ها)</option>` + optionsHtml;
    filterSelect.value = currentVal || 'all';
  }

  if (newChalSelect) {
    // An admin creates «چالش فراگروهی» only; personal and group challenges are the mentors' (spec Part 1)
    newChalSelect.innerHTML = `<option value="inter_group">${esc(chlCatLabel('inter_group'))} (همه‌ی کاروان‌ها)</option>`;
  }

  if (editChalSelect) {
    // Caravans stay listed only so an older admin challenge for one caravan shows its own; the server refuses moving one there
    editChalSelect.innerHTML = `<option value="inter_group">${esc(chlCatLabel('inter_group'))} (همه‌ی کاروان‌ها)</option>` + optionsHtml;
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

/** «شخصی» / «گروهی» / «فراگروهی», as named in «فرهنگ اصطلاحات». */
function chlCategoryChip(c) {
  const key = c.category === 'inter_group' || c.category === 'individual' ? c.category : 'intra_group';
  const icon = key === 'inter_group' ? 'fa-globe' : key === 'individual' ? 'fa-user' : 'fa-users';
  return `<span class="chl-chip${key === 'inter_group' ? ' is-accent' : ''}"><i class="fa-solid ${icon}"></i> ${esc(chlCatLabel(key, true))}</span>`;
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
      : '<span><i class="fa-solid fa-globe"></i> همه‌ی کاروان‌ها</span>';

    const approved = c.approvedSubmissions || (c.submissions ? c.submissions.filter(x => x.status === 'approved').length : 0);
    const pending = c.pendingSubmissions || (c.submissions ? c.submissions.filter(x => x.status === 'pending' || x.status === 'PENDING_REVIEW').length : 0);
    const interGroup = c.category === 'inter_group';
    const reward = interGroup ? 'درفش (بر اساس رتبه)' : window.formatChallengeReward(c);
    const id = String(c.id);

    return `
      <article class="chl-card chl-card-open" role="button" tabindex="0" data-click="openChallengeDetail" data-click-args="${esc(JSON.stringify([id]))}" title="مشاهده جزئیات چالش">
        <div class="chl-card-top">
          <span class="chl-id">${esc(id)}</span>
          ${chlCategoryChip(c)}
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

// The challenges the toolbar filters let through
function chlFilteredList() {
  const query = (document.getElementById('filter-challenges-search')?.value || '').trim().toLowerCase();
  const selectedCaravan = document.getElementById('filter-challenges-caravan')?.value || 'all';
  const selectedCreator = document.getElementById('filter-challenges-creator')?.value || 'all';

  let filtered = [...window.cachedAdminChallenges];

  // Filter by audience: one caravan, or the public ones (no caravan)
  if (selectedCaravan === 'public') {
    filtered = filtered.filter(c => !chlCaravanIdOf(c));
  } else if (selectedCaravan !== 'all') {
    filtered = filtered.filter(c => chlCaravanIdOf(c) === selectedCaravan);
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

  return filtered;
}

function chlCaravanIdOf(c) {
  if (c.targetAudience && c.targetAudience.type === 'caravan' && c.targetAudience.id) return String(c.targetAudience.id);
  if (c.caravanInfo && c.caravanInfo.id) return String(c.caravanInfo.id);
  if (c.caravanId && c.caravanId !== 'inter_group') return String(c.caravanId);
  return '';
}

window.filterChallengesList = function() {
  renderAdminChallenges(chlFilteredList());
  if (window.chlActiveId) chlRenderDetail(false);
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
    note.innerHTML = `در ${esc(chlCatLabel('inter_group'))} کاروان‌ها <b>درفش</b> می‌گیرند و اعضا زریک و کلاف به نسبت مشارکت: پس از پایان چالش، در بخش «رتبه‌بندی» کاروان‌های اول تا سوم را تایید کنید؛ به ترتیب درفش طلایی، نقره‌ای و برنزی می‌گیرند و بقیه‌ی کاروان‌های شرکت‌کننده درفش پارچه‌ای.`;
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
    let html = chlRankWaitNote(data.window);
    html += `<p class="lse-lead"><i class="fa-solid fa-circle-info"></i> ${data.caravans.length} کاروان شرکت کرده‌اند و بقیه ${esc(tierName.cloth)} می‌گیرند. تایید نهایی قابل بازگشت نیست.</p>`;
    for (let i = 0; i < places; i++) {
      html += `<label class="lse-field"><span data-style="color:${[tierColor.gold, tierColor.silver, tierColor.bronze][i]}">${placeLabel[i]}</span>
        <select class="ranking-select select-ctrl">${options}</select></label>`;
    }
    if (data.rewards) html += chlRewardsEditor(data.rewards, true);
    html += `<button type="button" data-click="submitChallengeRanking" data-click-args="${esc(JSON.stringify([String(challengeId), (places)]))}" class="lsv-pill chl-rank-submit"${data.window && !data.window.open ? ' disabled' : ''}><i class="fa-solid fa-flag"></i> تایید نهایی و اعطای درفش</button>`;
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
  const rewards = chlReadRewards(document.getElementById('ranking-body'));
  const preview = await NopaApi.json(`/api/v1/admin/challenges/${challengeId}/ranking`, { method: 'POST', body: JSON.stringify({ ranking, rewards, preview: true }) }).catch(e => ({ error: e.message }));
  if (preview.error) { showToast(preview.error, 'error'); return; }
  if (preview.window && !preview.window.open) { showToast(preview.window.message, 'error'); return; }
  // Payout waits until every member's participation is confirmed (by the mentor, or by the admin on their behalf)
  if (preview.unconfirmed.length) { showToast(`مشارکت اعضای این کاروان‌ها هنوز تأیید نشده است: ${preview.unconfirmed.join('، ')}`, 'error'); return; }
  const question = `${chlPayLine(preview)} به ${chlFa(preview.paidMembers)} نفر از ${chlFa(preview.members)} عضو پرداخت می‌شود. رتبه‌بندی نهایی است و برنمی‌گردد. ادامه می‌دهید؟`;
  if (!(await NopaConfirm(question))) return;
  const res = await request(`/api/v1/admin/challenges/${challengeId}/ranking`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ranking, rewards })
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

const CHL_OPT_MIN = 2;
const CHL_OPT_MAX = 8;
const CHL_OPT_NAMES = ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم', 'هفتم', 'هشتم'];

function chlCardInfo(card) {
  const title = card.querySelector('.chal-q-title')?.value.trim() || '';
  const opts = Array.from(card.querySelectorAll('.chal-q-opt')).map(i => i.value.trim());
  const filled = opts.filter(Boolean).length;
  const correct = Array.from(card.querySelectorAll('input[type="radio"]')).findIndex(r => r.checked);
  return { title, opts, filled, correct };
}

// The options a question is saved with: empty ones dropped, and the correct index counted among the kept ones
function chlCardOptions(card) {
  const rows = Array.from(card.querySelectorAll('.lse-option'));
  const options = [];
  let correct = 0;
  rows.forEach(row => {
    const text = row.querySelector('.chal-q-opt')?.value.trim() || '';
    if (!text) return;
    if (row.querySelector('input[type="radio"]')?.checked) correct = options.length;
    options.push(text);
  });
  return { options, correct };
}

function chlOptionRow(name, i, text, checked) {
  return `
    <label class="lse-option">
      <span class="chl-opt-grip lse-grip" title="برای جابجایی بکشید" aria-hidden="true"><i class="fa-solid fa-grip-vertical"></i></span>
      <input type="radio" name="${name}" value="${i}" ${checked ? 'checked' : ''}>
      <span class="chl-opt-num">${lmsFaDigits(i + 1)}</span>
      <input type="text" class="chal-q-opt input-ctrl" value="${esc(text)}">
      <button type="button" class="lsv-round lsv-round-sm lsv-round-danger chl-opt-del" title="حذف گزینه"><i class="fa-solid fa-xmark"></i></button>
    </label>`;
}

// Numbers, labels, radio values and the add / remove buttons follow the current order of the rows
function chlRenumberOptions(card) {
  const rows = Array.from(card.querySelectorAll('.lse-option'));
  rows.forEach((row, i) => {
    const radio = row.querySelector('input[type="radio"]');
    radio.value = String(i);
    radio.setAttribute('aria-label', `گزینه‌ی ${i + 1} پاسخ درست است`);
    row.querySelector('.chl-opt-num').textContent = lmsFaDigits(i + 1);
    const input = row.querySelector('.chal-q-opt');
    input.setAttribute('aria-label', `متن گزینه‌ی ${i + 1}`);
    input.placeholder = `گزینه ${CHL_OPT_NAMES[i] || lmsFaDigits(i + 1)}`;
    row.querySelector('.chl-opt-del').disabled = rows.length <= CHL_OPT_MIN;
  });
  if (rows.length && !rows.some(r => r.querySelector('input[type="radio"]').checked)) rows[0].querySelector('input[type="radio"]').checked = true;
  const add = card.querySelector('.chl-opt-add');
  if (add) add.disabled = rows.length >= CHL_OPT_MAX;
}

// Called by the shared drag engine (sortable "chl-option") after the rows were moved
window.chlOptionsReorder = function(box) {
  const card = box.closest('.challenge-q-card');
  if (!card) return false;
  chlRenumberOptions(card);
  const mode = card.parentElement && String(card.parentElement.id).indexOf('new-') === 0 ? 'new' : 'edit';
  chlMarkDirty(mode);
  chlRenderQIndex(mode);
  return true;
};
window.chlOptionsRedraw = box => { const card = box && box.closest('.challenge-q-card'); if (card) chlRenumberOptions(card); };

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
    const optDel = e.target.closest('.chl-opt-del');
    const optAdd = e.target.closest('.chl-opt-add');
    if (optDel || optAdd) {
      e.preventDefault();
      const card = (optDel || optAdd).closest('.challenge-q-card');
      const box = card.querySelector('.chl-opts');
      const rows = box.querySelectorAll('.lse-option');
      if (optDel && rows.length > CHL_OPT_MIN) {
        optDel.closest('.lse-option').remove();
      } else if (optAdd && rows.length < CHL_OPT_MAX) {
        box.insertAdjacentHTML('beforeend', chlOptionRow(box.dataset.name, rows.length, '', false));
        box.lastElementChild.querySelector('.chal-q-opt').focus();
      } else {
        return;
      }
      chlRenumberOptions(card);
      chlMarkDirty(mode);
      chlRenderQIndex(mode);
      return;
    }
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
  const optionTexts = opts.length >= CHL_OPT_MIN ? opts.slice(0, CHL_OPT_MAX) : opts.concat(Array(CHL_OPT_MIN - opts.length).fill(''));
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
      <legend>گزینه‌ها <small>دایره‌ی کنار پاسخ درست را انتخاب کنید؛ برای جابجایی، گزینه را بکشید</small></legend>
      <div class="chl-opts" data-name="${mode}-correct-q${seq}">
        ${optionTexts.map((text, i) => chlOptionRow(`${mode}-correct-q${seq}`, i, text, i === Number(correctIdx))).join('')}
      </div>
      <button type="button" class="lse-add-row chl-opt-add"><i class="fa-solid fa-plus"></i> گزینه جدید</button>
    </fieldset>
  `;
  container.appendChild(card);
  chlRenumberOptions(card);
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
      const { options, correct: correctIndex } = chlCardOptions(card);

      questions.push({
        step: idx + 1,
        q: qTitle,
        options: options.length >= CHL_OPT_MIN ? options : ['گزینه ۱', 'گزینه ۲', 'گزینه ۳', 'گزینه ۴'],
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
      const { options, correct: correctIndex } = chlCardOptions(card);

      questions.push({
        step: idx + 1,
        q: qTitle,
        options: options.length >= CHL_OPT_MIN ? options : ['گزینه ۱', 'گزینه ۲', 'گزینه ۳', 'گزینه ۴'],
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
  if (window.chlActiveId) chlRenderDetail(false);
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

  list.innerHTML = submissions.map(chlSubRow).join('');
}

function chlSubRow(s) {
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
      [chlCatLabel('individual'), challenges.filter(c => c.category === 'individual').length],
      [chlCatLabel('intra_group'), challenges.filter(c => c.category === 'intra_group').length],
      [chlCatLabel('inter_group'), challenges.filter(c => c.category === 'inter_group').length],
      ['ساخته‌ی مدیر', byAdmin],
      ['ساخته‌ی راهبران', challenges.length - byAdmin]
    ];
    typesEl.innerHTML = `<div class="lst-legend">${rows.map(([label, n]) => `<div class="lst-legend-row"><span>${esc(label)}</span><strong>${n}</strong></div>`).join('')}</div>`;
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


// ==========================================
// CHALLENGE DETAIL (same layout idea as a station page: the open challenge on the right, the side column on the left
// with its numbers and the list of all challenges)
// ==========================================
window.chlActiveId = null;
let chlDetailSearch = '';
let chlRank = null; // ranking panel of the open challenge: { id, data, order, editing, finalized }

function chlDetailBox() {
  const tab = document.getElementById('submissions-tab');
  if (!tab) return null;
  let box = document.getElementById('chl-detail-view');
  if (!box) {
    box = document.createElement('div');
    box.id = 'chl-detail-view';
    box.style.display = 'none';
    tab.appendChild(box);
  }
  return box;
}

function chlOverviewParts() {
  const tab = document.getElementById('submissions-tab');
  return tab ? Array.from(tab.querySelectorAll(':scope > .lms-head-actions, :scope > .chl-bento')) : [];
}

function chlAudienceOf(c) {
  return c.targetAudience && c.targetAudience.type === 'caravan'
    ? { name: c.targetAudience.name, mentorName: c.targetAudience.mentorName }
    : (c.caravanInfo || null);
}

function chlSubmissionsOf(c) {
  return (window.cachedAdminSubmissions || []).filter(x => String(x.challengeId || (x.challenge && x.challenge.id) || '') === String(c.id));
}

// The steps as columns, like the categories of a station: a card of rows (one per option), the step under it
function chlDetailStepsHtml(c) {
  const qList = Array.isArray(c.questions) ? c.questions : [];
  if (!qList.length) {
    return `
      <div class="chl-dv-open">
        <span class="lsv-round lsv-round-lg"><i class="fa-solid fa-pen"></i></span>
        <div>
          <strong>پاسخ تشریحی</strong>
          <p class="lse-hint">دانش‌آموز پاسخ را تایپ می‌کند و در صورت نیاز فایل (صدا، عکس یا طرح) ضمیمه می‌کند. راهبر یا مدیر آن را در بخش پاسخ‌ها بررسی و پاداش را ثبت می‌کند.</p>
        </div>
      </div>`;
  }
  return `<div class="chl-dv-cols">${qList.map((q, idx) => {
    const qText = q.q || q.question || q.title || `مرحله ${idx + 1}`;
    const opts = Array.isArray(q.options) ? q.options : (Array.isArray(q.opts) ? q.opts : []);
    const correctIdx = q.correct !== undefined ? Number(q.correct) : -1;
    const rows = opts.map((opt, oi) => `
      <div class="lsv-row chl-dv-optrow${oi === correctIdx ? ' is-correct' : ''}">
        <span class="lsv-row-avatar lsv-row-num">${lmsFaDigits(oi + 1)}</span>
        <span class="lsv-row-text"><strong title="${esc(opt)}">${esc(opt)}</strong>${oi === correctIdx ? '<span>پاسخ درست</span>' : ''}</span>
        <i class="lsv-row-state ${oi === correctIdx ? 'fa-solid fa-circle-check is-done' : 'fa-regular fa-circle'}"></i>
      </div>`).join('');
    return `
      <div class="lsv-col chl-dv-col">
        <div class="lsv-col-card">
          <div class="chl-dv-q">${esc(qText)}</div>
          ${rows || '<div class="lsv-col-empty">این مرحله گزینه ندارد (پاسخ تشریحی)</div>'}
        </div>
        <div class="lsv-col-label"><span class="lsv-col-dot" data-style="background:${window.lmsCategoryColor ? window.lmsCategoryColor(idx) : 'var(--primary)'}"></span> مرحله ${lmsFaDigits(idx + 1)} <span class="lsv-col-count">${lmsFaDigits(opts.length)} گزینه</span></div>
      </div>`;
  }).join('')}</div>`;
}

function chlDetailMainHtml(c) {
  const id = String(c.id);
  const interGroup = c.category === 'inter_group';
  const isByAdmin = c.creatorInfo?.isByAdmin ?? (!c.createdByMentorId);
  const creatorName = c.creatorInfo?.name || (isByAdmin ? 'مدیر سیستم' : 'راهبر کاروان');
  const audience = chlAudienceOf(c);
  const subs = chlSubmissionsOf(c);
  const reward = interGroup ? 'درفش (بر اساس رتبه)' : window.formatChallengeReward(c);
  const dateOf = v => (v ? new Date(v).toLocaleDateString('fa-IR') : '');
  const when = [c.startDate && `شروع: ${dateOf(c.startDate)}`, c.dueDate && `مهلت: ${dateOf(c.dueDate)}`].filter(Boolean).join(' · ');
  return `
    <div class="lst-tile glass chl-dv-main">
      <header class="chl-dv-head">
        <div class="chl-card-top"><span class="chl-id">${esc(id)}</span>${chlTypeChip(c)}</div>
        <h4 class="chl-dv-title">${esc(c.title)}</h4>
        <span class="lsv-round-group">
          ${chlRoundBtn('fa-solid fa-pen', 'ویرایش و اصلاح چالش', 'openEditChallengeModal', [id])}
          ${chlRoundBtn('fa-solid fa-trash', 'حذف چالش', 'deleteChallengeAdmin', [id, String(escJs(c.title || ''))], 'lsv-round-danger')}
        </span>
      </header>
      <p class="chl-dv-desc">${esc(c.description || 'برای این چالش توضیحی ثبت نشده است.')}</p>
      <div class="chl-card-meta chl-dv-meta">
        ${audience ? `<span><i class="fa-solid fa-users"></i> کاروان: ${esc(audience.name)} · راهبر: ${esc(audience.mentorName || 'نامشخص')}</span>` : '<span><i class="fa-solid fa-globe"></i> عمومی (همه کاروان‌ها)</span>'}
        <span>${isByAdmin ? '<i class="fa-solid fa-shield-halved"></i> مدیر سیستم' : `<i class="fa-solid fa-user-tie"></i> راهبر: ${esc(creatorName)}`}</span>
        <span class="chl-reward"><i class="fa-solid ${interGroup ? 'fa-flag' : 'fa-coins'}"></i> ${reward}</span>
        ${when ? `<span><i class="fa-regular fa-calendar"></i> ${esc(when)}</span>` : ''}
      </div>
    </div>
    <div class="lst-tile glass chl-dv-block">
      <h4 class="lst-tile-title"><i class="fa-solid fa-list-check"></i> مراحل چالش <span class="lst-tile-sub">آنچه دانش‌آموز در اپلیکیشن می‌بیند</span></h4>
      ${chlDetailStepsHtml(c)}
    </div>
    <div class="lst-tile glass chl-dv-block">
      <h4 class="lst-tile-title"><i class="fa-solid fa-clipboard-check"></i> وضعیت پاسخ‌ها <span class="lst-tile-sub">${lmsFaDigits(subs.length)} پاسخ</span></h4>
      ${interGroup ? '<div id="chl-dv-rank" class="chl-rank"></div>' : ''}
      <div class="chl-subs">${subs.length ? subs.map(chlSubRow).join('') : '<div class="lst-empty"><i class="fa-regular fa-folder-open"></i> هنوز پاسخی برای این چالش ارسال نشده است.</div>'}</div>
    </div>`;
}

// Numbers of the open challenge, in the left column and shaped like the overview's "آمار کلی" tile
function chlDetailStatsHtml(c) {
  const subs = chlSubmissionsOf(c);
  const approved = c.approvedSubmissions ?? subs.filter(x => x.status === 'approved').length;
  const pending = c.pendingSubmissions ?? subs.filter(x => x.status === 'pending' || x.status === 'PENDING_REVIEW').length;
  const rejected = subs.filter(x => x.status === 'rejected').length;
  const steps = Array.isArray(c.questions) ? c.questions.length : 0;
  return `
    <div class="lst-tile glass">
      <h4 class="lst-tile-title"><i class="fa-solid fa-chart-simple"></i> آمار این چالش</h4>
      <div class="lst-mini-stats">
        <div class="lst-mini-stat"><span class="stat-label">مراحل</span><span class="stat-value u-c-primary-text">${lmsFaDigits(steps)}</span></div>
        <div class="lst-mini-stat"><span class="stat-label">کل پاسخ‌ها</span><span class="stat-value">${lmsFaDigits(subs.length)}</span></div>
        <div class="lst-mini-stat"><span class="stat-label">در انتظار ارزیابی</span><span class="stat-value u-c-accent-text">${lmsFaDigits(pending)}</span></div>
        <div class="lst-mini-stat"><span class="stat-label">تایید شده</span><span class="stat-value u-c-success-text">${lmsFaDigits(approved)}</span></div>
        ${rejected ? `<div class="lst-mini-stat"><span class="stat-label">رد شده</span><span class="stat-value u-c-danger-text">${lmsFaDigits(rejected)}</span></div>` : ''}
      </div>
    </div>`;
}

function chlDetailListHtml(list) {
  const q = chlDetailSearch.trim().toLowerCase();
  const shown = q ? list.filter(c => `${c.title || ''} ${c.id}`.toLowerCase().includes(q)) : list;
  const items = shown.map(c => {
    const active = String(c.id) === window.chlActiveId;
    return `
      <button type="button" class="chl-dv-item${active ? ' is-active' : ''}" data-click="openChallengeDetail" data-click-args="${esc(JSON.stringify([String(c.id)]))}"${active ? ' aria-current="true"' : ''}>
        <span class="chl-card-top"><span class="chl-id">${esc(String(c.id))}</span>${chlTypeChip(c)}</span>
        <strong>${esc(c.title)}</strong>
      </button>`;
  }).join('');
  return `
    <div class="lst-tile glass chl-dv-list">
      <h4 class="lst-tile-title"><i class="fa-solid fa-trophy"></i> همه چالش‌ها <span class="lst-tile-sub">${lmsFaDigits(list.length)} چالش</span></h4>
      <div class="search-box">
        <i class="fa-solid fa-search"></i>
        <input aria-label="جستجوی چالش‌ها" type="text" id="chl-dv-search" class="input-ctrl" placeholder="جستجو در چالش‌ها..." value="${esc(chlDetailSearch)}" data-input="chlDetailFilter">
      </div>
      <div class="chl-dv-items">${items || '<div class="lst-empty">چالشی یافت نشد</div>'}</div>
    </div>`;
}

function chlDetailSkeleton() {
  const line = (cls = '') => `<span class="lst-skel-line ${cls}"></span>`;
  const rows = n => `<div class="lst-skel-lines">${'<span class="lst-skel-row"></span>'.repeat(n)}</div>`;
  return `
    <div class="chl-dv-body" aria-busy="true">
      <div class="chl-dv-detail">
        <div class="lst-tile glass is-loading chl-dv-main">
          <span class="chl-card-top">${line('lst-skel-chip')}${line('lst-skel-chip')}</span>
          ${line('chl-skel-title')}
          <span class="lst-skel-lines">${line()}${line('lst-skel-short')}</span>
        </div>
        <div class="lst-tile glass is-loading chl-dv-block">${rows(3)}</div>
        <div class="lst-tile glass is-loading chl-dv-block">${rows(2)}</div>
      </div>
      <div class="chl-dv-side">
        <div class="lst-tile glass is-loading">${rows(2)}</div>
        <div class="lst-tile glass is-loading chl-dv-list">${rows(4)}</div>
      </div>
    </div>`;
}

function chlRenderDetail(animate) {
  const box = chlDetailBox();
  if (!box || !window.chlActiveId) return;
  const list = chlFilteredList();
  const c = (window.cachedAdminChallenges || []).find(x => String(x.id) === window.chlActiveId);
  if (!c) { window.closeChallengeDetail(); return; }
  // a challenge hidden by the filters is still shown; it just is not in the list
  const listed = list.some(x => String(x.id) === window.chlActiveId) ? list : [c, ...list];
  const keepSearchFocus = document.activeElement && document.activeElement.id === 'chl-dv-search';
  box.innerHTML = `
    <div class="lsv-head">
      ${chlRoundBtn('fa-solid fa-arrow-right', 'بازگشت به همه چالش‌ها', 'closeChallengeDetail', [], 'lsv-round')}
      <h3>${esc(c.title)}</h3>
    </div>
    <div class="chl-dv-body">
      <div class="chl-dv-detail">${chlDetailMainHtml(c)}</div>
      <div class="chl-dv-side">${chlDetailStatsHtml(c)}${chlDetailListHtml(listed)}</div>
    </div>`;
  if (keepSearchFocus) {
    const input = document.getElementById('chl-dv-search');
    if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
  }
  if (c.category === 'inter_group') chlRankLoad(String(c.id), animate);
  if (animate && window.NopaFlip) window.NopaFlip.enter(box.querySelectorAll('.lsv-head, .chl-dv-body .lst-tile'));
}

window.chlDetailFilter = function() {
  chlDetailSearch = document.getElementById('chl-dv-search')?.value || '';
  chlRenderDetail(false);
};

window.openChallengeDetail = async function(id) {
  const box = chlDetailBox();
  if (!box) return;
  const first = !window.chlActiveId;
  if (window.chlActiveId !== String(id)) chlRank = null;
  window.chlActiveId = String(id);
  if (!first) {
    chlRenderDetail(false);
    return;
  }
  chlDetailSearch = '';
  const parts = chlOverviewParts();
  const swap = () => {
    parts.forEach(p => { p.style.display = 'none'; });
    box.style.display = 'block';
    // data still loading (or never loaded): skeleton with the light sweep, like the cards of the overview
    if (!(window.cachedAdminChallenges || []).length) box.innerHTML = chlDetailSkeleton(); else chlRenderDetail(true);
    document.getElementById('submissions-tab')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  const visible = parts.find(p => p.style.display !== 'none');
  lmsFadeOut(visible, swap);
  // answers may have changed since the page was loaded: refresh them while the detail shimmers
  box.classList.add('is-refreshing');
  try {
    await window.loadAdminSubmissionsData();
    if (!(window.cachedAdminChallenges || []).length) await window.loadAdminChallengesData();
  } finally {
    box.classList.remove('is-refreshing');
  }
  if (window.chlActiveId) chlRenderDetail(false);
};

window.closeChallengeDetail = function() {
  const box = document.getElementById('chl-detail-view');
  window.chlActiveId = null;
  chlRank = null;
  lmsFadeOut(box, () => {
    if (window.chlActiveId) return;
    if (box) { box.style.display = 'none'; box.innerHTML = ''; }
    const parts = chlOverviewParts();
    parts.forEach(p => { p.style.display = ''; });
    if (window.NopaFlip) window.NopaFlip.enter(parts.flatMap(p => Array.from(p.matches('.chl-bento') ? p.querySelectorAll('.lst-tile') : [p])));
  });
};

// ==================== RANKING OF AN INTER-GROUP CHALLENGE ====================
// Not confirmed yet: the panel proposes an order (most approved answers first) and the admin arranges it by dragging;
// "تایید و اعمال" pays the prizes. Confirmed: the result is shown and "ویرایش رتبه‌بندی" opens it for correction.

const chlRankTierNames = () => ({
  gold: window.assetName('derafsh_gold'), silver: window.assetName('derafsh_silver'), bronze: window.assetName('derafsh_bronze'), cloth: window.assetName('derafsh_cloth')
});

function chlRankPlaces() {
  return chlRank ? Math.min(3, chlRank.data.caravans.length) : 0;
}

// ---- per-member base reward of a cross-caravan challenge, by rank tier (زریک and کلاف) ----
const CHL_RW_TIERS = [['gold', 'طلایی'], ['silver', 'نقره‌ای'], ['bronze', 'برنزی'], ['cloth', 'پارچه‌ای']];

/** The reward table: editable before the ranking is confirmed (and while correcting it), read-only after. */
function chlRewardsEditor(rewards, editable) {
  const names = window.assetNamesMap || {};
  const zarik = names.zarik || 'زریک', nakh = names.nakh || 'کلاف';
  const cell = (asset, tier) => {
    const v = Number(rewards?.[asset]?.[tier] ?? 0);
    return editable
      ? `<input type="number" min="0" step="1" class="input-ctrl" data-rw="${asset}.${tier}" value="${esc(String(v))}" aria-label="${esc(asset === 'zarik' ? zarik : nakh)}">`
      : `<span>${v.toLocaleString('fa-IR')}</span>`;
  };
  return `
    <div class="chl-rw">
      <span class="lse-card-title"><i class="fa-solid fa-coins"></i> پاداش پایه‌ی هر عضو بر اساس رتبه</span>
      <div class="chl-rw-grid">
        <span class="chl-rw-head">رتبه</span><span class="chl-rw-head">${esc(zarik)}</span><span class="chl-rw-head">${esc(nakh)}</span>
        ${CHL_RW_TIERS.map(([k, label]) => `<span class="chl-rw-tier">${esc(label)}</span>${cell('zarik', k)}${cell('nakh', k)}`).join('')}
      </div>
      <p class="lse-hint">سهم هر عضو = پاداش پایه × درصد مشارکتی که راهبر تأیید کرده است (پرچمدار ۱۰۰، فعال ۷۵، نیمه‌فعال ۵۰، همراه ۲۵، خسته ۰). درصد استفاده‌نشده میان بقیه پخش نمی‌شود.</p>
    </div>`;
}

/** Reads the table back into { zarik: {gold..cloth}, nakh: {...} }, or null when it is not on screen. */
function chlReadRewards(root) {
  const inputs = root ? root.querySelectorAll('[data-rw]') : [];
  if (!inputs.length) return null;
  const out = { zarik: {}, nakh: {} };
  inputs.forEach(input => {
    const [asset, tier] = input.getAttribute('data-rw').split('.');
    out[asset][tier] = Math.max(0, Math.floor(Number(input.value) || 0));
  });
  return out;
}

/** The notice shown while ranking cannot happen yet: before the deadline and before every caravan delivered. */
function chlRankWaitNote(win) {
  if (!win || win.open) return '';
  return `<div class="chl-rank-wait"><i class="fa-solid fa-hourglass-half"></i><span>${esc(win.message || 'رتبه‌بندی فقط در پایان چالش ممکن است.')} (${lmsFaDigits(win.delivered)} از ${lmsFaDigits(win.expected)} کاروان اثرشان را فرستاده‌اند.)</span></div>`;
}

const chlFa = n => Number(n || 0).toLocaleString('fa-IR');
function chlPayLine(p) {
  const names = window.assetNamesMap || {};
  return `${chlFa(p.total)} ${names.zarik || 'زریک'}${p.totalNakh ? ` و ${chlFa(p.totalNakh)} ${names.nakh || 'کلاف'}` : ''}`;
}

async function chlRankLoad(id, animate) {
  const box = document.getElementById('chl-dv-rank');
  if (!box) return;
  // keep what the admin has arranged while the panel redraws
  if (!chlRank || chlRank.id !== id) {
    box.innerHTML = '<div class="lst-tile-skel"><span class="lst-skel-line chl-skel-title"></span><div class="lst-skel-lines"><span class="lst-skel-row"></span><span class="lst-skel-row"></span></div></div>';
    box.classList.add('is-loading');
    try {
      const res = await request(`/api/v1/admin/challenges/${id}/ranking`);
      const data = await res.json();
      if (!res.ok) { box.classList.remove('is-loading'); box.innerHTML = `<div class="lst-empty">${esc(data.error || 'خطا در دریافت رتبه‌بندی')}</div>`; return; }
      const finalized = data.challenge.finalized;
      const order = finalized
        ? [...data.result].sort((a, b) => (a.rank || 99) - (b.rank || 99)).map(r => r.caravanId).concat(data.caravans.map(c => c.id).filter(cid => !data.result.some(r => r.caravanId === cid)))
        : data.suggested.slice();
      chlRank = { id, data, order, editing: false, finalized, suggestion: !finalized };
    } catch (e) {
      box.classList.remove('is-loading');
      box.innerHTML = '<div class="lst-empty">خطا در ارتباط با سرور</div>';
      return;
    }
  }
  if (window.chlActiveId !== id) return;
  const el = document.getElementById('chl-dv-rank');
  if (!el) return;
  el.classList.remove('is-loading');
  chlRankRender(el);
}

function chlRankRender(el) {
  const r = chlRank;
  if (!r) return;
  // what the admin typed in the reward table survives a redraw
  const typed = chlReadRewards(el);
  if (typed) r.rewards = typed;
  const { data } = r;
  if (!data.caravans.length) {
    el.innerHTML = '<div class="lst-empty"><i class="fa-regular fa-folder-open"></i> هنوز هیچ کاروانی در این چالش پاسخ نداده است، پس رتبه‌بندی ممکن نیست.</div>';
    return;
  }
  const places = chlRankPlaces();
  const tiers = chlRankTierNames();
  const draggable = !r.finalized || r.editing;
  const rows = r.order.map((cid, i) => {
    const c = data.caravans.find(x => x.id === cid);
    if (!c) return '';
    const tier = i < places ? ['gold', 'silver', 'bronze'][i] : 'cloth';
    const pic = c.coverImageUrl
      ? `<img class="chl-rank-pic" src="${esc(c.coverImageUrl)}" alt="">`
      : `<span class="chl-rank-pic chl-rank-pic-empty">${esc(String(c.name).trim().charAt(0) || '؟')}</span>`;
    return `
      <div class="chl-rank-item is-${tier}" data-cid="${esc(c.id)}">
        ${draggable ? '<span class="chl-rank-grip lse-grip" title="برای جابجایی بکشید" aria-hidden="true"><i class="fa-solid fa-grip-vertical"></i></span>' : ''}
        <span class="chl-rank-no">${i < places ? lmsFaDigits(i + 1) : '<i class="fa-solid fa-flag"></i>'}</span>
        ${pic}
        <span class="chl-rank-who"><strong>${esc(c.name)}</strong><small>${c.mentorName ? `راهبر: ${esc(c.mentorName)} · ` : ''}${lmsFaDigits(c.approved)} تایید شده از ${lmsFaDigits(c.answers)} پاسخ</small></span>
        <span class="chl-rank-tier">${esc(tiers[tier])}</span>
      </div>`;
  }).join('');
  let note;
  let actions;
  const closed = !r.finalized && data.window && !data.window.open;
  if (!r.finalized) {
    note = `<i class="fa-solid fa-wand-magic-sparkles"></i> ترتیب پیشنهادی بر اساس بیشترین پاسخ تایید شده است. با کشیدن کاروان‌ها آن را تغییر دهید؛ ${places === 1 ? 'اولین' : `${lmsFaDigits(places)} کاروان اول`} درفش طلایی تا برنزی می‌گیرند و بقیه ${esc(tiers.cloth)}. رتبه‌بندی هنوز اعمال نشده است.`;
    actions = `
      <button type="button" class="lsv-pill" data-click="chlRankApply"${closed ? ' disabled' : ''}><i class="fa-solid fa-flag"></i> تایید و اعمال رتبه‌بندی</button>
      <button type="button" class="lse-btn" data-click="chlRankReset"><i class="fa-solid fa-rotate-left"></i> بازگشت به پیشنهاد خودکار</button>`;
  } else if (r.editing) {
    note = '<i class="fa-solid fa-pen"></i> در حال ویرایش رتبه‌بندی یا پاداش: کاروان‌ها را بکشید یا مقادیر را تغییر دهید و ذخیره کنید؛ فقط تفاوت جایزه‌ها (زریک و کلاف) به اعضا افزوده یا از آن‌ها کسر می‌شود.';
    actions = `
      <button type="button" class="lsv-pill" data-click="chlRankSaveEdit"><i class="fa-solid fa-check"></i> ذخیره اصلاح رتبه‌بندی</button>
      <button type="button" class="lse-btn" data-click="chlRankCancelEdit">انصراف</button>`;
  } else {
    note = '<i class="fa-solid fa-circle-check"></i> رتبه‌بندی اعمال شده و درفش‌ها و جایزه‌ها پرداخت شده است.';
    actions = '<button type="button" class="lsv-pill" data-click="chlRankStartEdit"><i class="fa-solid fa-pen"></i> ویرایش رتبه‌بندی</button>';
  }
  el.innerHTML = `
    ${chlRankWaitNote(!r.finalized ? data.window : null)}
    <p class="lse-lead">${note}</p>
    <div class="chl-rank-list${draggable ? ' is-editable' : ''}">${rows}</div>
    ${data.rewards ? chlRewardsEditor(r.rewards || data.rewards, draggable) : ''}
    <div class="chl-rank-actions">${actions}</div>`;
}

// the drag engine (station-dnd.js, sortable "chl-rank") calls this with the list after the rows were moved
window.chlRankReorder = function(box) {
  if (!chlRank) return false;
  const order = Array.from(box.querySelectorAll(':scope > .chl-rank-item')).map(r => r.getAttribute('data-cid'));
  if (order.join() === chlRank.order.join()) return false;
  chlRank.order = order;
  chlRankRenumber(box);
  return true;
};

// numbers, tier labels and colours follow the rows' new positions without redrawing (the drag is still finishing)
function chlRankRenumber(box) {
  if (!chlRank) return;
  const places = chlRankPlaces();
  const tiers = chlRankTierNames();
  Array.from(box.querySelectorAll(':scope > .chl-rank-item')).forEach((row, i) => {
    const tier = i < places ? ['gold', 'silver', 'bronze'][i] : 'cloth';
    row.className = row.className.replace(/\bis-(gold|silver|bronze|cloth)\b/g, '').trim() + ` is-${tier}`;
    row.querySelector('.chl-rank-no').innerHTML = i < places ? lmsFaDigits(i + 1) : '<i class="fa-solid fa-flag"></i>';
    row.querySelector('.chl-rank-tier').textContent = tiers[tier];
  });
}
window.chlRankRedraw = function(box) { chlRankRenumber(box); };

window.chlRankReset = function() {
  if (!chlRank || chlRank.finalized) return;
  chlRank.order = chlRank.data.suggested.slice();
  chlRankRender(document.getElementById('chl-dv-rank'));
};

window.chlRankStartEdit = function() {
  if (!chlRank) return;
  chlRank.editing = true;
  chlRank.before = chlRank.order.slice();
  chlRankRender(document.getElementById('chl-dv-rank'));
};

window.chlRankCancelEdit = function() {
  if (!chlRank) return;
  chlRank.editing = false;
  chlRank.order = chlRank.before || chlRank.order;
  chlRank.rewards = null;
  const el = document.getElementById('chl-dv-rank');
  if (el) el.querySelectorAll('[data-rw]').forEach(input => input.remove());
  chlRankRender(el);
};

async function chlRankRefreshAfter(id) {
  chlRank = null;
  await Promise.all([window.loadAdminChallengesData(), window.loadAdminSubmissionsData()]);
  if (window.chlActiveId === id) chlRankLoad(id, false);
}

window.chlRankApply = async function() {
  if (!chlRank || chlRank.finalized) return;
  const id = chlRank.id;
  const ranking = chlRank.order.slice(0, chlRankPlaces());
  const rewards = chlReadRewards(document.getElementById('chl-dv-rank'));
  if (rewards) chlRank.rewards = rewards;
  const body = JSON.stringify({ ranking, rewards, preview: true });
  const preview = await NopaApi.json(`/api/v1/admin/challenges/${id}/ranking`, { method: 'POST', body }).catch(e => ({ error: e.message }));
  if (preview.error) { showToast(preview.error, 'error'); return; }
  if (preview.window && !preview.window.open) { showToast(preview.window.message, 'error'); return; }
  // Payout waits until every member's participation is confirmed (by the mentor, or by the admin on their behalf)
  if (preview.unconfirmed.length) { showToast(`مشارکت اعضای این کاروان‌ها هنوز تأیید نشده است: ${preview.unconfirmed.join('، ')}`, 'error'); return; }
  const question = `${chlPayLine(preview)} به ${chlFa(preview.paidMembers)} نفر از ${chlFa(preview.members)} عضو پرداخت می‌شود. نتیجه‌ی کاروان‌ها در «میدان آثار» و جزئیات هر کاروان در «گروه چالش‌ها»ی خودش منتشر و گفت‌وگوها بسته می‌شوند. ادامه می‌دهید؟ (بعداً با «ویرایش رتبه‌بندی» قابل اصلاح است.)`;
  if (!(await NopaConfirm(question))) return;
  const res = await request(`/api/v1/admin/challenges/${id}/ranking`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ranking, rewards })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { showToast(data.error || 'خطا در ثبت رتبه‌بندی', 'error'); return; }
  showToast('رتبه‌بندی اعمال شد و جایزه‌ها پرداخت شدند.', 'success');
  chlRankRefreshAfter(id);
};

window.chlRankSaveEdit = async function() {
  if (!chlRank || !chlRank.finalized) return;
  const id = chlRank.id;
  const ranking = chlRank.order.slice(0, chlRankPlaces());
  const rewards = chlReadRewards(document.getElementById('chl-dv-rank'));
  const preview = await NopaApi.json(`/api/v1/admin/challenges/${id}/ranking`, { method: 'PUT', body: JSON.stringify({ ranking, rewards, preview: true }) }).catch(e => ({ error: e.message }));
  if (preview.error) { showToast(preview.error, 'error'); return; }
  if (preview.unchanged) { showToast('ترتیب و پاداش تغییری نکرده است.', 'info'); window.chlRankCancelEdit(); return; }
  const fa = chlFa;
  const names = window.assetNamesMap || {};
  const z = names.zarik || 'زریک', k = names.nakh || 'کلاف';
  const question = `با این اصلاح ${fa(preview.increase)} ${z} و ${fa(preview.increaseNakh)} ${k} به اعضا اضافه و ${fa(preview.decrease)} ${z} و ${fa(preview.decreaseNakh)} ${k} از اعضا کسر می‌شود (${fa(preview.members)} نفر تغییر می‌کنند). ادامه می‌دهید؟`;
  if (!(await NopaConfirm(question))) return;
  const res = await request(`/api/v1/admin/challenges/${id}/ranking`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ranking, rewards })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { showToast(data.error || 'خطا در اصلاح رتبه‌بندی', 'error'); return; }
  showToast(data.unchanged ? 'ترتیب تغییری نکرده است.' : 'رتبه‌بندی اصلاح شد.', 'success');
  chlRankRefreshAfter(id);
};

// ==================== CARAVAN STANDINGS (left column of the overview) ====================
window.chlRenderCaravanBoard = function() {
  const el = document.getElementById('chl-bento-caravans');
  if (!el) return;
  const caravans = (window.cachedAdminCaravans || []).slice()
    .sort((a, b) => (Number(b.groupPoints) || 0) - (Number(a.groupPoints) || 0) || (Number(b.wealth?.zarik) || 0) - (Number(a.wealth?.zarik) || 0));
  if (!caravans.length) {
    el.innerHTML = '<div class="lst-empty">هنوز کاروانی ثبت نشده است.</div>';
    return;
  }
  const chip = (icon, key, v) => `<span title="${esc(window.assetName(key))}"><i class="${icon}"></i> ${Number(v || 0).toLocaleString('fa-IR')}</span>`;
  el.innerHTML = `<div class="chl-board">${caravans.map((c, i) => {
    const pic = c.coverImageUrl
      ? `<img class="chl-rank-pic" src="${esc(c.coverImageUrl)}" alt="">`
      : `<span class="chl-rank-pic chl-rank-pic-empty">${esc(String(c.name).trim().charAt(0) || '؟')}</span>`;
    const w = c.wealth || {};
    return `
      <div class="chl-board-row${i < 3 ? ` is-top is-top-${i + 1}` : ''}">
        <span class="chl-board-no">${lmsFaDigits(i + 1)}</span>
        ${pic}
        <span class="chl-board-who">
          <strong>${esc(c.name)}</strong>
          <small><i class="fa-solid fa-user-tie"></i> ${esc(c.mentorName || 'بدون راهبر')} · ${lmsFaDigits(c.memberCount || 0)} عضو</small>
          <span class="chl-board-assets">
            ${chip('fa-solid fa-coins', 'zarik', w.zarik)}${chip('fa-solid fa-link', 'nakh', w.nakh)}${chip('fa-solid fa-border-all', 'farsh', w.farsh)}
          </span>
        </span>
        <span class="chl-board-pts" title="امتیاز گروهی"><b>${lmsFaDigits(c.groupPoints || 0)}</b><small>امتیاز</small></span>
      </div>`;
  }).join('')}</div>`;
};

// ==================== «فرهنگ اصطلاحات»: THE THREE CHALLENGE CATEGORIES ====================
// One source of truth for the names (GET/PUT /api/v1/admin/challenge-taxonomy, a SystemSetting row on the server; the
// app reads the same list). Keys and who creates each category are fixed by the code; admins edit names and text.
// Built-in copy so the tab never shows an old or empty name while the request runs.
const CHL_TAXONOMY_DEFAULTS = [
  { key: 'individual', label: 'چالش شخصی', shortLabel: 'شخصی', icon: 'user', color: '#7C9CF5', creator: 'راهبر', target: 'یک عضو یا گروهی انتخاب‌شده از اعضای کاروان', definition: '', rewards: '', conversation: '', replaces: [] },
  { key: 'intra_group', label: 'چالش گروهی', shortLabel: 'گروهی', icon: 'users', color: '#DFB690', creator: 'راهبر', target: 'همه‌ی اعضای کاروان راهبر', definition: '', rewards: '', conversation: '', replaces: [] },
  { key: 'inter_group', label: 'چالش فراگروهی', shortLabel: 'فراگروهی', icon: 'globe', color: '#CD8449', creator: 'مدیر', target: 'همه‌ی کاروان‌ها', definition: '', rewards: '', conversation: '', replaces: [] },
];
window.chlTaxonomy = window.chlTaxonomy || CHL_TAXONOMY_DEFAULTS;
let chlCanEditGlossary = true;
window.addEventListener('nopa:accesschange', e => {
  const access = e.detail || {};
  chlCanEditGlossary = !!access.all || access.sections?.challenges === 'edit';
  window.chlRenderGlossary();
});

/** Name of a category: the full one («چالش فراگروهی») or the short one for tags («فراگروهی»). */
function chlCatLabel(key, short = false) {
  const entry = (window.chlTaxonomy || CHL_TAXONOMY_DEFAULTS).find(t => t.key === key)
    || CHL_TAXONOMY_DEFAULTS.find(t => t.key === key) || CHL_TAXONOMY_DEFAULTS[1];
  return short ? entry.shortLabel : entry.label;
}
window.chlCatLabel = chlCatLabel;

window.chlLoadTaxonomy = async function() {
  try {
    const list = await NopaApi.json('/api/v1/admin/challenge-taxonomy');
    if (Array.isArray(list) && list.length) window.chlTaxonomy = list;
  } catch (e) {
    console.error('challenge taxonomy load error:', e);
  }
  window.chlRenderGlossary();
};

window.chlRenderGlossary = function() {
  const box = document.getElementById('chl-gls-grid');
  if (!box) return;
  const edit = document.getElementById('chl-gls-edit');
  if (edit) edit.hidden = !chlCanEditGlossary;
  const draw = () => {
    box.innerHTML = window.chlTaxonomy.map(t => {
      const facts = [
        ['fa-user-pen', 'سازنده', t.creator],
        ['fa-bullseye', 'مخاطب', t.target],
        ['fa-coins', 'پاداش', t.rewards],
        ['fa-comments', 'گفتگو', t.conversation],
      ].filter(([, , v]) => v);
      return `
        <article class="chl-gls-card" data-anim-key="gls:${esc(t.key)}" data-style="--gls-color:${esc(t.color)}">
          <header class="chl-gls-head">
            <span class="chl-gls-icon"><i class="fa-solid fa-${esc(t.icon)}"></i></span>
            <span class="chl-gls-name"><strong>${esc(t.label)}</strong><small>برچسب کوتاه: ${esc(t.shortLabel)} · <code>${esc(t.key)}</code></small></span>
          </header>
          ${t.definition ? `<p class="chl-gls-def">${esc(t.definition)}</p>` : ''}
          <ul class="chl-gls-facts">${facts.map(([icon, k, v]) => `<li><i class="fa-solid ${icon}"></i><span>${esc(k)}</span><b>${esc(v)}</b></li>`).join('')}</ul>
          ${(t.replaces || []).length ? `<div class="chl-gls-old"><span>جایگزین اصطلاحات قدیمی:</span>${t.replaces.map(r => `<s class="chl-chip">${esc(r)}</s>`).join('')}</div>` : ''}
        </article>`;
    }).join('');
  };
  if (window.NopaFlip?.render) window.NopaFlip.render(box, draw); else draw();
};

window.chlOpenGlossaryEditor = function() {
  const modal = document.getElementById('chl-gls-modal');
  const body = document.getElementById('chl-gls-form-body');
  if (!modal || !body) return;
  const field = (key, name, label, value, attrs = '') =>
    `<label class="lse-field"><span>${label}</span><input type="text" class="input-ctrl" data-gls="${key}.${name}" value="${esc(value)}" ${attrs}></label>`;
  body.innerHTML = window.chlTaxonomy.map(t => `
    <section class="lse-card">
      <h4 class="lse-card-title"><i class="fa-solid fa-${esc(t.icon)}"></i> ${esc(t.label)} <small class="lse-hint">سازنده: ${esc(t.creator)} (ثابت)</small></h4>
      <div class="lse-grid lse-grid-2">
        ${field(t.key, 'label', 'نام کامل <b class="lse-req">*</b>', t.label, 'maxlength="40" required')}
        ${field(t.key, 'shortLabel', 'برچسب کوتاه (کارت‌ها و زبانه‌ها) <b class="lse-req">*</b>', t.shortLabel, 'maxlength="20" required')}
        ${field(t.key, 'target', 'مخاطب <b class="lse-req">*</b>', t.target, 'maxlength="120" required')}
        ${field(t.key, 'icon', 'آیکون (نام Font Awesome، مثل users)', t.icon, 'maxlength="40" pattern="[a-z0-9-]+" required dir="ltr"')}
        <label class="lse-field"><span>رنگ</span><input type="color" class="input-ctrl" data-gls="${t.key}.color" value="${esc(t.color)}"></label>
      </div>
      <label class="lse-field"><span>تعریف <b class="lse-req">*</b></span><textarea class="input-ctrl" rows="2" maxlength="400" data-gls="${t.key}.definition" required>${esc(t.definition)}</textarea></label>
    </section>`).join('');
  modal.style.display = 'flex';
  modal.style.zIndex = 'var(--z-modal)';
};

window.chlSaveGlossary = async function(e) {
  if (e) e.preventDefault();
  const payload = {};
  document.querySelectorAll('#chl-gls-form-body [data-gls]').forEach(input => {
    const [key, name] = input.getAttribute('data-gls').split('.');
    (payload[key] = payload[key] || {})[name] = input.value.trim();
  });
  try {
    const list = await NopaApi.json('/api/v1/admin/challenge-taxonomy', { method: 'PUT', body: JSON.stringify(payload) });
    if (Array.isArray(list)) window.chlTaxonomy = list;
    NopaActions.hide('chl-gls-modal');
    showToast('فرهنگ اصطلاحات ذخیره شد؛ اپ و پنل از این نام‌ها استفاده می‌کنند.', 'success');
    window.chlRenderGlossary();
    // names inside cards, selects and tiles follow at once
    window.loadAdminChallengesData();
  } catch (err) {
    showToast(err.message || 'خطا در ذخیره‌ی فرهنگ اصطلاحات', 'error');
  }
};
