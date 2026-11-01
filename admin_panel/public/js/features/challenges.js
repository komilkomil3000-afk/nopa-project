// Challenges & submissions: list, create/edit modals, steps, ranking, submission review.
// Split out of the former app.js (Phase 7). Classic script: shares globals with the other modules;
// load order is set in index.html.

// ==========================================
// CHALLENGES & SUBMISSIONS MANAGEMENT (LMS)
// ==========================================
window.cachedAdminChallenges = [];
window.cachedAdminCaravans = [];

window.loadChallengesAndSubmissionsTab = async function() {
  await Promise.all([
    window.loadAdminChallengesData(),
    window.loadAdminSubmissionsData()
  ]);
};

window.loadAdminChallengesData = async function() {
  try {
    const [challengesRes, caravansRes] = await Promise.all([
      request('/api/v1/admin/challenges'),
      request('/api/v1/admin/caravans').catch(() => null)
    ]);

    if (!challengesRes.ok) {
      console.warn('Failed to load admin challenges');
      return;
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
  } catch (err) {
    console.error('loadAdminChallengesData error:', err);
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

function renderAdminChallenges(challenges) {
  const tbody = document.getElementById('admin-challenges-tbody');
  if (!tbody) return;

  if (challenges.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 25px; color: var(--text-muted);">هیچ چالشی با فیلتر انتخابی یافت نشد</td></tr>`;
    return;
  }

  tbody.innerHTML = challenges.map(c => {
    // Creator Info Badge (Admin vs Mentor)
    const isByAdmin = c.creatorInfo?.isByAdmin ?? (!c.createdByMentorId);
    const creatorName = c.creatorInfo?.name || (isByAdmin ? 'مدیر سیستم' : 'راهبر کاروان');
    let creatorBadge = '';
    if (isByAdmin) {
      creatorBadge = `
        <span class="badge" style="background: linear-gradient(135deg, rgb(var(--primary-rgb) / 0.25), rgba(236, 72, 153, 0.25)); color: #f472b6; border: 1px solid rgba(244, 114, 182, 0.45); font-weight: 800; font-size: 11.5px; padding: 4px 10px; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;">
          <i class="fa-solid fa-shield-halved"></i> توسط مدیر سیستم
        </span>
      `;
    } else {
      creatorBadge = `
        <div style="display: flex; flex-direction: column; gap: 3px;">
          <span class="badge" style="background: rgb(var(--info-rgb) / 0.2); color: var(--info-text); border: 1px solid rgb(var(--info-rgb) / 0.45); font-weight: bold; font-size: 11px; padding: 3px 8px; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;">
            <i class="fa-solid fa-user-tie"></i> توسط راهبر
          </span>
          <span style="font-size: 11.5px; color: var(--text-soft); font-weight: 600;">${esc(creatorName)}</span>
        </div>
      `;
    }

    // Caravan & Mentor Column (تولید شده برای - مخاطبان)
    let caravanDisplay = '';
    const audience = c.targetAudience;
    if (audience && audience.type === 'caravan') {
      caravanDisplay = `
        <div style="display: flex; flex-direction: column; gap: 3px;">
          <span class="badge" style="background: rgb(var(--primary-rgb) / 0.18); color: var(--primary-text); border: 1px solid rgb(var(--primary-rgb) / 0.35); font-weight: bold; font-size: 11.5px; display: inline-flex; align-items: center; gap: 4px;">
            <i class="fa-solid fa-users"></i> کاروان: ${esc(audience.name)}
          </span>
          <span style="font-size: 11px; color: var(--text-muted);">
            <i class="fa-solid fa-user-tie" style="color: var(--text-faint);"></i> راهبر: ${esc(audience.mentorName || 'نامشخص')}
          </span>
        </div>
      `;
    } else if (c.caravanInfo) {
      caravanDisplay = `
        <div style="display: flex; flex-direction: column; gap: 3px;">
          <span class="badge" style="background: rgb(var(--primary-rgb) / 0.18); color: var(--primary-text); border: 1px solid rgb(var(--primary-rgb) / 0.35); font-weight: bold; font-size: 11.5px; display: inline-flex; align-items: center; gap: 4px;">
            <i class="fa-solid fa-users"></i> کاروان: ${esc(c.caravanInfo.name)}
          </span>
          <span style="font-size: 11px; color: var(--text-muted);">
            <i class="fa-solid fa-user-tie" style="color: var(--text-faint);"></i> راهبر: ${esc(c.caravanInfo.mentorName || 'نامشخص')}
          </span>
        </div>
      `;
    } else {
      caravanDisplay = `
        <span class="badge" style="background: rgb(var(--muted-rgb) / 0.15); color: var(--text-muted); border: 1px solid rgb(var(--muted-rgb) / 0.25); font-size: 11.5px; display: inline-flex; align-items: center; gap: 5px;">
          <i class="fa-solid fa-globe"></i> عمومی (همه کاروان‌ها)
        </span>
      `;
    }

    // Type badge
    let typeBadge = `<span class="badge" style="background: rgb(var(--muted-rgb) / 0.2); color: var(--text-soft); white-space: nowrap; display: inline-flex; align-items: center; gap: 5px;">${c.type}</span>`;
    if (c.type === 'quiz') {
      typeBadge = `<span class="badge" style="background: rgb(var(--success-rgb) / 0.2); color: var(--success-text); border: 1px solid rgb(var(--success-rgb) / 0.3); white-space: nowrap; display: inline-flex; align-items: center; gap: 5px;"><i class="fa-solid fa-circle-question"></i> آزمون مرحله‌ای</span>`;
    } else if (c.type === 'skill' || c.type === 'text') {
      typeBadge = `<span class="badge" style="background: rgb(var(--accent-rgb) / 0.2); color: var(--accent-text); border: 1px solid rgb(var(--accent-rgb) / 0.3); white-space: nowrap; display: inline-flex; align-items: center; gap: 5px;"><i class="fa-solid fa-pen"></i> تشریحی</span>`;
    } else if (c.type === 'file') {
      typeBadge = `<span class="badge" style="background: rgb(var(--primary-rgb) / 0.2); color: var(--primary-text); border: 1px solid rgb(var(--primary-rgb) / 0.3); white-space: nowrap; display: inline-flex; align-items: center; gap: 5px;"><i class="fa-solid fa-pen"></i> تشریحی</span>`;
    }

    // Submissions participation
    const approved = c.approvedSubmissions || (c.submissions ? c.submissions.filter(s => s.status === 'approved').length : 0);
    const pending = c.pendingSubmissions || (c.submissions ? c.submissions.filter(s => s.status === 'pending' || s.status === 'PENDING_REVIEW').length : 0);
    const participation = `<div style="font-size: 11.5px; display: flex; justify-content: center; gap: 6px;">
      <span style="color: var(--success-text); font-weight: bold;"><i class="fa-solid fa-check"></i> ${approved}</span>
      <span style="color: var(--text-faint);">|</span>
      <span style="color: var(--accent-text); font-weight: bold;"><i class="fa-solid fa-clock"></i> ${pending}</span>
    </div>`;

    const escapedTitle = escJs(c.title || '');

    return `
      <tr>
        <td><span class="badge" style="background: rgb(var(--primary-rgb) / 0.2); color: var(--primary-text); font-family: monospace; font-weight: bold; padding: 3px 8px;">${c.id}</span></td>
        <td>
          <div style="font-weight: bold; color: var(--text); font-size: 13px;">${esc(c.title)}</div>
          <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 3px; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${esc(c.description || '')}</div>
        </td>
        <td>${caravanDisplay}</td>
        <td>${creatorBadge}</td>
        <td style="white-space: nowrap;">
          <div style="margin-bottom: 6px;">${typeBadge}</div>
          <div style="color: var(--accent-text); font-weight: bold; font-size: 12.5px; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;"><i class="fa-solid ${c.category === 'inter_group' ? 'fa-flag' : 'fa-coins'}"></i> ${c.category === 'inter_group' ? 'درفش (بر اساس رتبه)' : window.formatChallengeReward(c)}</div>
        </td>
        <td style="text-align: center;">${participation}</td>
        <td style="text-align: center;">
          <div style="display: flex; gap: 5px; justify-content: center; flex-wrap: wrap;">
            <button type="button" class="btn-action" onclick="window.openChallengeStepsModal('${c.id}')" title="مشاهده مراحل چالش" style="background: rgb(var(--primary-rgb) / 0.15); color: var(--primary-text); border: 1px solid rgb(var(--primary-rgb) / 0.35); border-radius: 6px; padding: 4px 8px; font-size: 11px; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
              <i class="fa-solid fa-list-check"></i> مراحل
            </button>
            ${c.category === 'inter_group' ? `<button type="button" class="btn-action" onclick="window.openChallengeRanking('${c.id}')" title="رتبه‌بندی کاروان‌ها و اعطای درفش" style="background: rgb(var(--accent-rgb) / 0.15); color: var(--accent-text); border: 1px solid rgb(var(--accent-rgb) / 0.4); border-radius: 6px; padding: 4px 8px; font-size: 11px; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-flag"></i> رتبه‌بندی</button>` : ''}
            <button type="button" class="btn-action" onclick="window.openEditChallengeModal('${c.id}')" title="ویرایش و اصلاح چالش" style="background: rgb(var(--info-rgb) / 0.15); color: var(--info-text); border: 1px solid rgb(var(--info-rgb) / 0.35); border-radius: 6px; padding: 4px 8px; font-size: 11px; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
              <i class="fa-solid fa-pen-to-square"></i> ویرایش
            </button>
            <button type="button" class="btn-action" onclick="window.deleteChallengeAdmin('${c.id}', '${escapedTitle}')" title="حذف چالش" style="background: rgb(var(--danger-rgb) / 0.15); color: var(--danger-text); border: 1px solid rgb(var(--danger-rgb) / 0.35); border-radius: 6px; padding: 4px 8px; font-size: 11px; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
              <i class="fa-solid fa-trash"></i> حذف
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
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

  if (typeSelect.value === 'quiz') {
    section.style.display = 'block';
  } else {
    section.style.display = 'none';
  }
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
  const rewardAssetType = document.getElementById(`${mode}-chal-asset`)?.value === 'nakh' ? 'nakh' : 'zarik';
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
    note.style.cssText = 'font-size: 12px; color: var(--accent-text); background: rgb(var(--accent-rgb) / 0.1); border: 1px solid rgb(var(--accent-rgb) / 0.3); border-radius: 8px; padding: 8px 12px; margin-bottom: 14px; line-height: 1.7;';
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
  body.innerHTML = '<div style="color:var(--text-muted);">در حال بارگذاری...</div>';
  modal.style.display = 'flex';
  try {
    const res = await request(`/api/v1/admin/challenges/${challengeId}/ranking`);
    const data = await res.json();
    if (!res.ok) { body.innerHTML = `<div style="color:var(--danger-text);">${esc(data.error || 'خطا')}</div>`; return; }
    document.getElementById('ranking-title').textContent = `رتبه‌بندی کاروان‌ها: ${data.challenge.title}`;
    const names = window.assetNamesMap || {};
    const tierName = { gold: names.derafsh_gold || 'درفش طلایی', silver: names.derafsh_silver || 'درفش نقره‌ای', bronze: names.derafsh_bronze || 'درفش برنزی', cloth: names.derafsh_cloth || 'درفش پارچه‌ای' };
    const tierColor = { gold: 'var(--accent-text)', silver: 'var(--text-soft)', bronze: 'var(--accent-strong)', cloth: 'var(--text-muted)' };

    if (data.challenge.finalized) {
      body.innerHTML = '<div style="margin-bottom:10px; color:var(--success-text);"><i class="fa-solid fa-circle-check"></i> رتبه‌بندی تایید شده و درفش‌ها اعطا شده‌اند.</div>' +
        data.result.map(r => `<div style="display:flex; justify-content:space-between; padding:8px 12px; margin-bottom:6px; background:rgb(var(--fg-rgb) / 0.04); border-radius:8px;"><span>${r.rank ? 'رتبه ' + r.rank + ': ' : ''}${esc(r.caravanName)}</span><b style="color:${tierColor[r.tier]};">${esc(tierName[r.tier])}</b></div>`).join('');
      return;
    }
    if (!data.caravans.length) {
      body.innerHTML = '<div style="color:var(--text-muted);">هنوز هیچ کاروانی در این چالش پاسخ نداده است.</div>';
      return;
    }
    const places = Math.min(3, data.caravans.length);
    const placeLabel = ['رتبه‌ی اول (' + tierName.gold + ')', 'رتبه‌ی دوم (' + tierName.silver + ')', 'رتبه‌ی سوم (' + tierName.bronze + ')'];
    const options = '<option value="">انتخاب کاروان...</option>' + data.caravans.map(c => `<option value="${c.id}">${esc(c.name)}${c.mentorName ? ' - ' + esc(c.mentorName) : ''} (${c.answers} پاسخ)</option>`).join('');
    let html = `<div style="margin-bottom:12px; color:var(--text-muted);">${data.caravans.length} کاروان شرکت کرده‌اند. بقیه‌ی کاروان‌ها ${esc(tierName.cloth)} می‌گیرند. این تایید قابل بازگشت نیست.</div>`;
    for (let i = 0; i < places; i++) {
      html += `<label style="display:block; font-size:12px; font-weight:bold; margin:10px 0 4px; color:${[tierColor.gold, tierColor.silver, tierColor.bronze][i]};">${placeLabel[i]}</label>
        <select class="ranking-select" style="width:100%; padding:8px 12px; background:var(--surface-2); border:1px solid var(--border-strong); border-radius:8px; color:var(--text);">${options}</select>`;
    }
    html += `<button type="button" onclick="window.submitChallengeRanking('${challengeId}', ${places})" style="margin-top:16px; width:100%; padding:10px; background:var(--accent); color:var(--text-soft); font-weight:bold; border:none; border-radius:8px; cursor:pointer;">تایید نهایی رتبه‌بندی و اعطای درفش</button>`;
    body.innerHTML = html;
  } catch (e) {
    body.innerHTML = '<div style="color:var(--danger-text);">خطا در ارتباط با سرور</div>';
  }
};

window.submitChallengeRanking = async function(challengeId, places) {
  const ranking = Array.from(document.querySelectorAll('#ranking-body .ranking-select')).map(s => s.value);
  if (ranking.length !== places || ranking.some(v => !v) || new Set(ranking).size !== places) {
    showToast('برای هر رتبه یک کاروان متفاوت انتخاب کنید.', 'error');
    return;
  }
  if (!(await NopaConfirm('رتبه‌بندی نهایی می‌شود و قابل ویرایش نیست. ادامه می‌دهید؟'))) return;
  const res = await request(`/api/v1/admin/challenges/${challengeId}/ranking`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ranking })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { showToast(data.error || 'خطا در ثبت رتبه‌بندی', 'error'); return; }
  await window.openChallengeRanking(challengeId);
};

window.addQuestionRow = function(mode, initialData = null) {
  const container = document.getElementById(`${mode}-chal-questions-list`);
  if (!container) return;

  const qIndex = container.children.length + 1;
  const qText = initialData ? (initialData.q || initialData.question || '') : '';
  const opts = initialData && Array.isArray(initialData.options) ? initialData.options : ['', '', '', ''];
  const correctIdx = initialData && initialData.correct !== undefined ? initialData.correct : 0;

  const card = document.createElement('div');
  card.className = 'challenge-q-card';
  card.style.cssText = 'background: rgb(var(--fg-rgb) / 0.04); border: 1px solid rgb(var(--fg-rgb) / 0.08); border-radius: 8px; padding: 12px; position: relative;';
  card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <span style="font-weight: bold; color: var(--primary-text); font-size: 12px;">سوال / گام شماره ${qIndex}</span>
      <button type="button" onclick="this.closest('.challenge-q-card').remove()" style="background: rgb(var(--danger-rgb) / 0.2); color: var(--danger-text); border: none; border-radius: 4px; padding: 2px 6px; font-size: 11px; cursor: pointer;">
        <i class="fa-solid fa-trash"></i> حذف
      </button>
    </div>
    <div style="margin-bottom: 8px;">
      <input type="text" class="chal-q-title" placeholder="صورت سوال یا عنوان مرحله..." value="${esc(qText)}" style="width: 100%; padding: 6px 10px; background: var(--surface-2); border: 1px solid var(--border-strong); border-radius: 6px; color: var(--text); font-size: 12px;">
    </div>
    <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">گزینه‌ها (گزینه صحیح را با رادیوباتن انتخاب کنید):</div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
      ${[0, 1, 2, 3].map(i => `
        <div style="display: flex; align-items: center; gap: 6px; background: rgb(var(--shade-rgb) / 0.2); padding: 4px 8px; border-radius: 6px;">
          <input type="radio" name="${mode}-correct-${qIndex}" value="${i}" ${i === Number(correctIdx) ? 'checked' : ''} style="cursor: pointer; accent-color: var(--success);">
          <input type="text" class="chal-q-opt" placeholder="گزینه ${i + 1}" value="${(opts[i] || '').replace(/"/g, '&quot;')}" style="flex: 1; padding: 4px 8px; background: transparent; border: 1px solid var(--border-strong); border-radius: 4px; color: var(--text); font-size: 11.5px;">
        </div>
      `).join('')}
    </div>
  `;
  container.appendChild(card);
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

window.closeCreateChallengeModal = function() {
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
      const radio = card.querySelector(`input[name="new-correct-${idx + 1}"]:checked`);
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
      window.closeCreateChallengeModal();
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
  document.getElementById('edit-chal-asset').value = c.rewardAssetType === 'nakh' ? 'nakh' : 'zarik';
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

window.closeEditChallengeModal = function() {
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
      const radio = card.querySelector(`input[name="edit-correct-${idx + 1}"]:checked`);
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
      window.closeEditChallengeModal();
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

  if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-trophy" style="color: var(--accent-text);"></i> ${esc(c.title)}`;
  if (badgeEl) badgeEl.innerHTML = `کد: ${c.id} | پاداش: ${window.formatChallengeReward(c)} | نوع: ${c.type}`;

  const qList = Array.isArray(c.questions) ? c.questions : [];

  let html = '';
  if (qList.length > 0) {
    html += `
      <div style="margin-bottom: 16px; padding: 12px 16px; background: rgb(var(--primary-rgb) / 0.1); border: 1px solid rgb(var(--primary-rgb) / 0.25); border-radius: 10px;">
        <div style="font-weight: bold; color: var(--primary-text); font-size: 13px; margin-bottom: 4px;"><i class="fa-solid fa-info-circle"></i> ساختار مرحله‌ای چالش در اپلیکیشن نپا:</div>
        <div style="color: var(--text-muted); font-size: 12px;">این چالش شامل ${qList.length} مرحله یا سوال متوالی است که دانش‌آموز در اپلیکیشن قدم به قدم به آن پاسخ می‌دهد.</div>
      </div>
    `;

    qList.forEach((q, idx) => {
      const qText = q.q || q.question || q.title || `مرحله شماره ${idx + 1}`;
      const opts = Array.isArray(q.options) ? q.options : (Array.isArray(q.opts) ? q.opts : []);
      const correctIdx = q.correct !== undefined ? q.correct : -1;

      html += `
        <div style="background: rgb(var(--fg-rgb) / 0.03); border: 1px solid rgb(var(--fg-rgb) / 0.08); border-radius: 12px; padding: 16px; margin-bottom: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <span class="badge" style="background: rgb(var(--primary-rgb) / 0.25); color: var(--primary-text); font-weight: bold; font-size: 12px;">
              گام ${idx + 1} از ${qList.length}
            </span>
            <span style="font-size: 11px; color: var(--text-muted);">سوال چهارگزینه‌ای</span>
          </div>
          <h4 style="color: var(--text); font-size: 14px; margin: 0 0 12px 0; line-height: 1.6;">${esc(qText)}</h4>
          ${opts.length > 0 ? `
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${opts.map((opt, oIdx) => {
                const isCorrect = (oIdx === correctIdx);
                return `
                  <div style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 8px; background: ${isCorrect ? 'rgb(var(--success-rgb) / 0.15)' : 'rgb(var(--shade-rgb) / 0.2)'}; border: 1px solid ${isCorrect ? 'var(--success)' : 'rgb(var(--fg-rgb) / 0.06)'}; color: ${isCorrect ? 'var(--success-text)' : 'var(--border-strong)'}; font-size: 12.5px;">
                    <span style="width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; background: ${isCorrect ? 'var(--success)' : 'rgb(var(--fg-rgb) / 0.1)'}; color: white; font-weight: bold;">${oIdx + 1}</span>
                    <span style="flex: 1;">${esc(opt)}</span>
                    ${isCorrect ? '<span style="color: var(--success-text); font-weight: bold; font-size: 11px;"><i class="fa-solid fa-check"></i> گزینه صحیح</span>' : ''}
                  </div>
                `;
              }).join('')}
            </div>
          ` : `
            <div style="color: var(--text-muted); font-size: 12px;">بدون گزینه‌های چهارگزینه‌ای (پاسخ تشریحی)</div>
          `}
        </div>
      `;
    });
  } else {
    html += `
      <div style="background: rgb(var(--fg-rgb) / 0.03); border: 1px solid rgb(var(--fg-rgb) / 0.08); border-radius: 12px; padding: 18px; margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <span class="badge" style="background: rgb(var(--accent-rgb) / 0.2); color: var(--accent-text); font-weight: bold; font-size: 12px;">
            مرحله ۱: اجرای تکلیف مهارتی
          </span>
          <span style="font-size: 11px; color: var(--text-muted);">پاسخ متنی و پیوست فایل</span>
        </div>
        <h4 style="color: var(--text); font-size: 14px; margin: 0 0 10px 0; line-height: 1.6;">${esc(c.title)}</h4>
        <div style="background: rgb(var(--shade-rgb) / 0.25); border-radius: 8px; padding: 12px 14px; margin-bottom: 14px; color: var(--text-soft); font-size: 13px; line-height: 1.7; border-right: 3px solid var(--accent);">
          ${esc(c.description)}
        </div>
        <div style="background: rgb(var(--success-rgb) / 0.08); border: 1px solid rgb(var(--success-rgb) / 0.2); border-radius: 8px; padding: 10px 14px;">
          <div style="color: var(--success-text); font-size: 12px; font-weight: bold; margin-bottom: 4px;"><i class="fa-solid fa-mobile-screen"></i> نحوه نمایش و تعامل در اپلیکیشن:</div>
          <div style="color: var(--text-muted); font-size: 12px; line-height: 1.6;">دانش‌آموز متن پاسخ خود را در فیلد مربوطه تایپ کرده و در صورت تمایل فایل صوتی، عکس یا پوستر طراحی‌شده را ضمیمه می‌نماید. راهبر یا مدیر در بخش ارزیابی زیر می‌تواند آن را بررسی و پاداش زریک را ثبت کند.</div>
        </div>
      </div>
    `;
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
    if (!res.ok) return;
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
  } catch (err) {
    console.error('loadAdminSubmissionsData error:', err);
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
  const tbody = document.getElementById('admin-submissions-tbody');
  if (!tbody) return;

  if (submissions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 30px; color: var(--text-muted);"><i class="fa-solid fa-filter-circle-xmark" style="font-size: 24px; margin-bottom: 8px; display: block; opacity: 0.5;"></i>هیچ پاسخی با فیلترهای انتخابی یافت نشد</td></tr>`;
    return;
  }

  tbody.innerHTML = submissions.map(s => {
    const studentName = s.student?.name || 'دانش‌آموز نپا';
    const studentPhone = s.student?.phoneNumber || '';
    const caravanName = s.student?.caravan?.name || s.challenge?.caravan?.name || 'عمومی (فاقد کاروان)';
    const mentorName = s.student?.caravan?.mentor?.name || s.challenge?.creatorInfo?.name || 'راهبر نامشخص';

    const chalTitle = s.challenge?.title || s.challengeId || 'تکلیف کلاسی';
    const chalId = s.challengeId || (s.challenge ? s.challenge.id : '');
    const answer = s.answerText || 'بدون متن (فایل ارسالی)';
    const fileLink = s.fileUrl
      ? `<a href="${esc(s.fileUrl)}" target="_blank" class="btn-action" style="background: rgb(var(--primary-rgb) / 0.15); color: var(--primary-text); border: 1px solid rgb(var(--primary-rgb) / 0.3); border-radius: 6px; padding: 4px 10px; font-size: 11px; text-decoration: none; display: inline-flex; align-items: center; gap: 5px;"><i class="fa-solid fa-download"></i> دانلود فایل</a>`
      : '<span style="color: var(--text-faint);">-</span>';

    const dateStr = s.submittedAt ? new Date(s.submittedAt).toLocaleDateString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : '-';
    const rewardVal = s.challenge?.rewardZarik || 50;

    // Status badge
    let statusBadge = '';
    const isPending = s.status === 'pending' || s.status === 'PENDING_REVIEW';
    if (isPending) {
      statusBadge = `<span class="badge" style="background: rgb(var(--accent-rgb) / 0.2); color: var(--accent-text); border: 1px solid rgb(var(--accent-rgb) / 0.4);">در انتظار ارزیابی</span>`;
    } else if (s.status === 'approved') {
      statusBadge = `<span class="badge" style="background: rgb(var(--success-rgb) / 0.2); color: var(--success-text); border: 1px solid rgb(var(--success-rgb) / 0.4);"><i class="fa-solid fa-check"></i> تایید شده (+${s.score || rewardVal} زریک)</span>`;
    } else {
      statusBadge = `<span class="badge" style="background: rgb(var(--danger-rgb) / 0.2); color: var(--danger-text); border: 1px solid rgb(var(--danger-rgb) / 0.4);">رد شده</span>`;
    }

    // Actions Column with dedicated "مشاهده پاسخ"
    const actionCell = `
      <div style="display: flex; gap: 6px; justify-content: center; flex-wrap: wrap;">
        <button type="button" class="btn-action" onclick="window.openViewSubmissionModal('${s.id}')" style="background: rgb(var(--primary-rgb) / 0.15); color: var(--primary-text); border: 1px solid rgb(var(--primary-rgb) / 0.35); border-radius: 6px; padding: 5px 10px; font-size: 11px; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="مشاهده کامل و ارزیابی پاسخ">
          <i class="fa-solid fa-eye"></i> مشاهده پاسخ
        </button>
        ${isPending ? `
          <button type="button" class="page-btn btn-success" onclick="window.reviewAdminSubmission('${s.id}', true, ${rewardVal})" style="padding: 5px 8px; font-size: 11px;" title="تایید سریع"><i class="fa-solid fa-check"></i> تایید</button>
          <button type="button" class="page-btn btn-danger" onclick="window.reviewAdminSubmission('${s.id}', false, 0)" style="padding: 5px 8px; font-size: 11px;" title="رد سریع"><i class="fa-solid fa-times"></i> رد</button>
        ` : `
          <span style="font-size: 10.5px; color: var(--text-muted); align-self: center;">${s.mentorFeedback ? 'ارزیابی شد' : ''}</span>
        `}
      </div>
    `;

    return `
      <tr>
        <td>
          <div style="font-weight: bold; color: var(--text);">${esc(studentName)}</div>
          <div style="font-size: 11px; color: var(--text-faint);">${esc(studentPhone)}</div>
        </td>
        <td>
          <div style="font-weight: bold; color: var(--info-text); font-size: 12px; display: flex; align-items: center; gap: 4px;">
            <i class="fa-solid fa-users" style="font-size: 11px;"></i> ${esc(caravanName)}
          </div>
          <div style="font-size: 11px; color: var(--text-soft); margin-top: 3px; display: flex; align-items: center; gap: 4px;">
            <i class="fa-solid fa-user-tie" style="color: var(--primary-text); font-size: 11px;"></i> ${esc(mentorName)}
          </div>
        </td>
        <td>
          <div style="font-weight: bold; color: var(--primary-text);">${esc(chalTitle)}</div>
          <span class="badge" style="font-size: 10px; padding: 1px 6px; background: rgb(var(--fg-rgb) / 0.06);">${chalId}</span>
        </td>
        <td>
          <div style="max-width: 250px;">
            <div style="font-size: 12.5px; color: var(--text); line-height: 1.5; max-height: 44px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; cursor: pointer;" onclick="window.openViewSubmissionModal('${s.id}')" title="برای مشاهده کامل پاسخ کلیک فرمایید">
              ${esc(answer)}
            </div>
            <button type="button" onclick="window.openViewSubmissionModal('${s.id}')" style="background: none; border: none; color: var(--primary-text); font-size: 11px; cursor: pointer; padding: 3px 0 0 0; display: inline-flex; align-items: center; gap: 4px; font-weight: bold;">
              <i class="fa-solid fa-eye"></i> مشاهده جواب
            </button>
          </div>
        </td>
        <td>${fileLink}</td>
        <td style="font-size: 12px; color: var(--text-muted);">${dateStr}</td>
        <td><span style="color: var(--accent-text); font-weight: bold;"><i class="fa-solid fa-coins"></i> ${rewardVal}</span></td>
        <td>${statusBadge}</td>
        <td style="text-align: center;">${actionCell}</td>
      </tr>
    `;
  }).join('');
}

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
      metaBadge.style.background = 'rgb(var(--accent-rgb) / 0.2)';
      metaBadge.style.color = 'var(--accent-text)';
      metaBadge.innerHTML = '<i class="fa-solid fa-clock"></i> وضعیت: در انتظار بررسی و ارزیابی';
    } else if (s.status === 'approved') {
      metaBadge.style.background = 'rgb(var(--success-rgb) / 0.2)';
      metaBadge.style.color = 'var(--success-text)';
      metaBadge.innerHTML = `<i class="fa-solid fa-check"></i> وضعیت: تایید شده (+${s.score || defaultReward} ${s.challenge?.rewardAssetType === 'nakh' ? 'کلاف' : 'زریک'})`;
    } else {
      metaBadge.style.background = 'rgb(var(--danger-rgb) / 0.2)';
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
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <a href="${esc(s.fileUrl)}" target="_blank" title="مشاهده تصویر در اندازه اصلی">
              <img src="${esc(s.fileUrl)}" style="max-height: 220px; max-width: 100%; border-radius: 8px; object-fit: contain; border: 1px solid rgb(var(--fg-rgb) / 0.1); background: rgb(var(--shade-rgb) / 0.4);" />
            </a>
            <div style="font-size: 11px; color: var(--text-muted);">برای مشاهده در اندازه بزرگ روی تصویر کلیک کنید.</div>
          </div>
        `;
      } else {
        fileContainer.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 8px; color: var(--text-soft); font-size: 12.5px;">
              <i class="fa-solid fa-file-lines" style="color: var(--primary-text); font-size: 18px;"></i>
              <span>فایل ضمیمه شده توسط دانش‌آموز</span>
            </div>
            <a href="${esc(s.fileUrl)}" target="_blank" class="btn-action" style="background: rgb(var(--primary-rgb) / 0.2); color: var(--primary-text); border: 1px solid rgb(var(--primary-rgb) / 0.4); border-radius: 6px; padding: 6px 14px; font-size: 12px; font-weight: bold; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-download"></i> دانلود و مشاهده فایل
            </a>
          </div>
        `;
      }
    } else {
      fileContainer.innerHTML = `<span style="color: var(--text-faint); font-size: 12px;"><i class="fa-solid fa-info-circle"></i> بدون فایل یا پیوست ضمیمه</span>`;
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
