// Wallet & league: Zarik ledger, adjustments, reward rules, Zarik analytics, leaderboards.
// Split out of the former app.js (Phase 7). Classic script: shares globals with the other modules;
// load order is set in index.html.

let currentLeagueTab = 'caravans';
let leagueSearchTimeout = null;

function switchLeagueTab(tab) {
  currentLeagueTab = tab;
  const btnCaravans = document.getElementById('btn-league-caravans');
  const btnIndividuals = document.getElementById('btn-league-individuals');
  const containerCaravans = document.getElementById('league-caravans-container');
  const containerIndividuals = document.getElementById('league-individuals-container');
  const roleFilterBox = document.getElementById('league-role-filter-box');

  if (tab === 'caravans') {
    if (btnCaravans) {
      btnCaravans.style.background = 'var(--color-accent)';
      btnCaravans.style.color = '#fff';
      btnCaravans.style.fontWeight = '700';
    }
    if (btnIndividuals) {
      btnIndividuals.style.background = 'transparent';
      btnIndividuals.style.color = 'var(--text-secondary)';
      btnIndividuals.style.fontWeight = 'normal';
    }
    if (containerCaravans) containerCaravans.style.display = 'block';
    if (containerIndividuals) containerIndividuals.style.display = 'none';
    if (roleFilterBox) roleFilterBox.style.display = 'none';
    loadCaravansLeaderboard();
  } else {
    if (btnIndividuals) {
      btnIndividuals.style.background = 'var(--color-accent)';
      btnIndividuals.style.color = '#fff';
      btnIndividuals.style.fontWeight = '700';
    }
    if (btnCaravans) {
      btnCaravans.style.background = 'transparent';
      btnCaravans.style.color = 'var(--text-secondary)';
      btnCaravans.style.fontWeight = 'normal';
    }
    if (containerCaravans) containerCaravans.style.display = 'none';
    if (containerIndividuals) containerIndividuals.style.display = 'block';
    if (roleFilterBox) roleFilterBox.style.display = 'flex';
    loadIndividualsLeaderboard();
  }
}

function debounceLeagueSearch() {
  clearTimeout(leagueSearchTimeout);
  leagueSearchTimeout = setTimeout(() => {
    applyLeagueFilters();
  }, 300);
}

function applyLeagueFilters() {
  if (currentLeagueTab === 'caravans') {
    loadCaravansLeaderboard();
  } else {
    loadIndividualsLeaderboard();
  }
}

async function loadLeagueCaravansOptions() {
  try {
    const res = await request('/api/v1/admin/caravans');
    if (!res.ok) return;
    const data = await res.json();
    const select = document.getElementById('league-caravan-filter');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="all">تمام کاروان‌ها</option>';
    const caravans = Array.isArray(data) ? data : (data.caravans || []);
    caravans.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      select.appendChild(opt);
    });
    if (currentVal) select.value = currentVal;
  } catch (err) {
    console.error('Failed to load caravan options for league filter', err);
  }
}

async function loadCaravansLeaderboard() {
  const tbody = document.querySelector('#caravans-leaderboard-table tbody');
  if (!tbody) return;
  NopaTable.loading(tbody, 'در حال دریافت رتبه‌بندی کاروان‌ها...');

  const sortBy = document.getElementById('league-sort-by')?.value || 'totalScore';
  const search = document.getElementById('league-search-input')?.value || '';
  const caravanId = document.getElementById('league-caravan-filter')?.value || 'all';

  try {
    const res = await request(`/api/v1/admin/leaderboard/caravans?sortBy=${encodeURIComponent(sortBy)}&search=${encodeURIComponent(search)}`);
    if (!res.ok) throw new Error('خطا در ارتباط با سرور');
    let caravans = await res.json();

    if (caravanId && caravanId !== 'all') {
      caravans = caravans.filter(c => c.id === caravanId);
    }

    tbody.innerHTML = '';
    if (!caravans || caravans.length === 0) {
      NopaTable.empty(tbody, 'موردی برای نمایش یافت نشد.');
      return;
    }

    // Calculate tie-aware & zero-aware ranks
    function getCaravanSortValue(c) {
      switch (sortBy) {
        case 'zarik': return c.zarik || 0;
        case 'beyragh': return c.beyragh || 0;
        case 'nakh': return c.nakh || 0;
        case 'farsh': return c.farsh || 0;
        case 'stars':
        case 'quizzes': return c.stars || 0;
        case 'quizScore': return c.quizScore || 0;
        case 'challenges':
        case 'challengeScore': return c.challengeScore || 0;
        case 'progress': return c.overallProgress || 0;
        case 'members': return c.memberCount || 0;
        case 'wealth': return c.totalWealth || 0;
        case 'totalScore':
        default: return c.totalScore || 0;
      }
    }

    let currentRank = 0;
    let prevScore = null;
    const rankedCaravans = caravans.map((c) => {
      const score = getCaravanSortValue(c);
      let rank = null;
      if (score > 0) {
        if (prevScore === null) {
          currentRank = 1;
        } else if (score < prevScore) {
          currentRank++;
        }
        rank = currentRank;
        prevScore = score;
      }
      return { c, score, rank };
    });

    rankedCaravans.forEach(({ c, rank }) => {
      let rankBadge = '';
      let trStyle = '';

      if (rank === null || rank === undefined) {
        rankBadge = '<span class="u-c-text-secondary u-fs-13 u-fw-600" title="بدون رتبه">-</span>';
        trStyle = '';
      } else if (rank === 1) {
        rankBadge = '<span class="badge u-bg-accent-20 u-c-accent-text u-bd-accent-40 u-fw-800 u-fs-12 u-p-2-8 u-r-6">۱</span>';
        trStyle = 'background: rgb(var(--accent-rgb) / 0.07); border-right: 3px solid var(--accent);';
      } else if (rank === 2) {
        rankBadge = '<span class="badge u-bg-muted-20 u-c-text-muted u-bd-muted-40 u-fw-800 u-fs-12 u-p-2-8 u-r-6">۲</span>';
        trStyle = 'background: rgb(var(--muted-rgb) / 0.05); border-right: 3px solid var(--text-muted);';
      } else if (rank === 3) {
        rankBadge = '<span class="badge u-bg-accent-20 u-c-accent-text u-bd-accent-40 u-fw-800 u-fs-12 u-p-2-8 u-r-6">۳</span>';
        trStyle = 'background: rgb(var(--accent-rgb) / 0.05); border-right: 3px solid var(--accent-strong);';
      } else {
        rankBadge = `<span class="u-fw-700 u-c-text-secondary u-fs-12">${rank}</span>`;
        trStyle = '';
      }

      const tr = document.createElement('tr');
      if (trStyle) tr.style = trStyle;
      tr.innerHTML = `
        <td class="u-text-center u-va-middle">${rankBadge}</td>
        <td>
          <div class="u-fw-700 u-fs-14 u-c-text">${esc(c.name)}</div>
        </td>
        <td>
          <div class="u-fs-13 u-fw-500">${esc(c.mentorName || '-')}</div>
          ${c.mentorPhone && c.mentorPhone !== '-' ? `<span class="u-fs-11 u-c-text-secondary">${esc(c.mentorPhone)}</span>` : ''}
        </td>
        <td class="u-text-center">
          <span class="u-bg-fg-8 u-p-2-8 u-r-12 u-fs-12 u-fw-600">${c.memberCount} / ${c.capacityLimit}</span>
        </td>
        <td class="u-c-accent-text u-fw-600">${(c.zarik || 0).toLocaleString()}</td>
        <td class="u-c-primary-text u-fw-600">${(c.nakh || 0).toLocaleString()}</td>
        <td class="u-c-danger-text u-fw-600">${(c.farsh || 0).toLocaleString()}</td>
        <td class="u-c-info-text u-fw-600">${(c.beyragh || 0).toLocaleString()}</td>
        <td class="u-c-accent-text u-fw-600">${c.stars || 0}</td>
        <td><span class="u-c-primary-text u-fw-600">${c.challengeScore || 0}</span></td>
        <td class="u-minw-110">
          <div class="u-flex u-items-center u-gap-6">
            <div class="u-flex-1 u-h-6 u-bg-fg-10 u-r-3 u-overflow-hidden">
              <div class="u-h-full u-r-3" style="width: ${Math.min(100, c.overallProgress || 0)}%; background: linear-gradient(to left, var(--success), var(--primary))"></div>
            </div>
            <span class="u-fs-11 u-fw-600 u-c-text-secondary">${c.overallProgress || 0}%</span>
          </div>
        </td>
        <td class="u-c-success-text u-fw-800 u-fs-14">${(c.totalScore || 0).toLocaleString()}</td>
        <td class="u-text-center u-nowrap">
          <button class="page-btn u-p-4-10 u-fs-11" data-click="viewCaravanDetails" data-click-args="${esc(JSON.stringify([String(c.id)]))}">
            <i class="fa-solid fa-eye u-ml-4"></i>اعضا
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load caravans leaderboard', err);
    NopaTable.error(tbody, `خطا در بارگذاری اطلاعات: ${err.message}`);
  }
}

async function loadIndividualsLeaderboard() {
  const tbody = document.querySelector('#individuals-leaderboard-table tbody');
  if (!tbody) return;
  NopaTable.loading(tbody, 'در حال دریافت رتبه‌بندی افراد...');

  const role = document.getElementById('league-role-filter')?.value || 'all';
  const caravanId = document.getElementById('league-caravan-filter')?.value || 'all';
  const sortBy = document.getElementById('league-sort-by')?.value || 'totalScore';
  const search = document.getElementById('league-search-input')?.value || '';

  try {
    const res = await request(`/api/v1/admin/leaderboard/individuals?role=${encodeURIComponent(role)}&caravanId=${encodeURIComponent(caravanId)}&sortBy=${encodeURIComponent(sortBy)}&search=${encodeURIComponent(search)}`);
    if (!res.ok) throw new Error('خطا در ارتباط با سرور');
    const users = await res.json();

    tbody.innerHTML = '';
    if (!users || users.length === 0) {
      NopaTable.empty(tbody, 'موردی برای نمایش یافت نشد.');
      return;
    }

    // Calculate tie-aware & zero-aware ranks
    function getIndividualSortValue(u) {
      switch (sortBy) {
        case 'zarik': return u.zarik || 0;
        case 'beyragh': return u.beyragh || 0;
        case 'nakh': return u.nakh || 0;
        case 'farsh': return u.farsh || 0;
        case 'stars':
        case 'quizzes': return u.stars || 0;
        case 'quizScore': return u.quizScore || 0;
        case 'challenges':
        case 'challengeScore': return u.challengeScore || 0;
        case 'progress': return u.progressPercentage || 0;
        case 'wealth': return u.wealthScore || 0;
        case 'totalScore':
        default: return u.totalScore || 0;
      }
    }

    let currentRankInd = 0;
    let prevScoreInd = null;
    const rankedUsers = users.map((u) => {
      const score = getIndividualSortValue(u);
      let rank = null;
      if (score > 0) {
        if (prevScoreInd === null) {
          currentRankInd = 1;
        } else if (score < prevScoreInd) {
          currentRankInd++;
        }
        rank = currentRankInd;
        prevScoreInd = score;
      }
      return { u, score, rank };
    });

    rankedUsers.forEach(({ u, rank }) => {
      let rankBadge = '';
      let trStyle = '';

      if (rank === null || rank === undefined) {
        rankBadge = '<span class="u-c-text-secondary u-fs-13 u-fw-600" title="بدون رتبه">-</span>';
        trStyle = '';
      } else if (rank === 1) {
        rankBadge = '<span class="badge u-bg-accent-20 u-c-accent-text u-bd-accent-40 u-fw-800 u-fs-12 u-p-2-8 u-r-6">۱</span>';
        trStyle = 'background: rgb(var(--accent-rgb) / 0.07); border-right: 3px solid var(--accent);';
      } else if (rank === 2) {
        rankBadge = '<span class="badge u-bg-muted-20 u-c-text-muted u-bd-muted-40 u-fw-800 u-fs-12 u-p-2-8 u-r-6">۲</span>';
        trStyle = 'background: rgb(var(--muted-rgb) / 0.05); border-right: 3px solid var(--text-muted);';
      } else if (rank === 3) {
        rankBadge = '<span class="badge u-bg-accent-20 u-c-accent-text u-bd-accent-40 u-fw-800 u-fs-12 u-p-2-8 u-r-6">۳</span>';
        trStyle = 'background: rgb(var(--accent-rgb) / 0.05); border-right: 3px solid var(--accent-strong);';
      } else {
        rankBadge = `<span class="u-fw-700 u-c-text-secondary u-fs-12">${rank}</span>`;
        trStyle = '';
      }

      const roleBadge = u.role === 'mentor'
        ? '<span class="u-bg-primary-20 u-c-primary-text u-bd-primary-40 u-p-2-8 u-r-6 u-fs-11">راهبر</span>'
        : '<span class="u-bg-success-20 u-c-success-text u-bd-success-40 u-p-2-8 u-r-6 u-fs-11">دانش‌آموز</span>';

      const tr = document.createElement('tr');
      if (trStyle) tr.style = trStyle;
      tr.innerHTML = `
        <td class="u-text-center u-va-middle">${rankBadge}</td>
        <td>
          <div class="u-flex u-items-center u-gap-8">
            <div class="u-w-32 u-h-32 u-r-50p u-bg-fg-10 u-overflow-hidden u-flex u-items-center u-justify-center u-fs-14">
              ${u.avatarUrl ? `<img src="${esc(u.avatarUrl)}" class="u-w-full u-h-full u-fit-cover">` : '<i class="fa-solid fa-user u-c-text-secondary"></i>'}
            </div>
            <div>
              <div class="u-fw-700 u-fs-13 u-c-text">${esc(u.name)}</div>
              <div class="u-fs-11 u-c-text-secondary">${esc(u.phoneNumber || '')}</div>
            </div>
          </div>
        </td>
        <td>${roleBadge}</td>
        <td><span class="u-bg-fg-5 u-p-2-8 u-r-6 u-fs-12">${esc(u.caravanName)}</span></td>
        <td class="u-c-accent-text u-fw-600">${(u.zarik || 0).toLocaleString()}</td>
        <td class="u-c-primary-text u-fw-600">${(u.nakh || 0).toLocaleString()}</td>
        <td class="u-c-danger-text u-fw-600">${(u.farsh || 0).toLocaleString()}</td>
        <td class="u-c-info-text u-fw-600">${(u.beyragh || 0).toLocaleString()}</td>
        <td class="u-c-accent-text u-fw-600">${u.stars || 0}</td>
        <td><span class="u-c-primary-text u-fw-600">${u.quizScore || 0}</span></td>
        <td><span class="u-c-primary-text u-fw-600">${u.challengeScore || 0}</span></td>
        <td class="u-minw-100">
          <div class="u-flex u-items-center u-gap-6">
            <div class="u-flex-1 u-h-6 u-bg-fg-10 u-r-3 u-overflow-hidden">
              <div class="u-h-full u-r-3" style="width: ${Math.min(100, u.progressPercentage || 0)}%; background: linear-gradient(to left, var(--primary), var(--primary))"></div>
            </div>
            <span class="u-fs-11 u-fw-600 u-c-text-secondary">${u.progressPercentage || 0}%</span>
          </div>
        </td>
        <td class="u-c-success-text u-fw-800 u-fs-14">${(u.totalScore || 0).toLocaleString()}</td>
        <td class="u-text-center u-nowrap">
          <button class="page-btn u-p-3-8 u-fs-11" data-click="viewUserDetails" data-click-args="${esc(JSON.stringify([String(u.id)]))}" title="مشاهده پروفایل">
            <i class="fa-solid fa-user"></i>
          </button>
          <button class="page-btn u-p-3-8 u-fs-11 u-mr-4" data-click="pickZarikTarget" data-click-args="${esc(JSON.stringify([String(u.id)]))}" title="تعدیل زریک">
            <i class="fa-solid fa-coins"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load individuals leaderboard', err);
    NopaTable.error(tbody, `خطا در بارگذاری اطلاعات: ${err.message}`);
  }
}

function exportCurrentLeague(format) {
  format = format || 'excel';
  document.querySelectorAll('.dropdown-wrapper.open').forEach(el => el.classList.remove('open'));
  
  const isCaravans = (typeof currentLeagueTab !== 'undefined' && currentLeagueTab === 'caravans') ||
                     (document.getElementById('league-caravans-container') && document.getElementById('league-caravans-container').style.display !== 'none');
  const exportType = isCaravans ? 'league_caravans' : 'league_individuals';
  return window.exportData(exportType, format);
}
window.exportCurrentLeague = exportCurrentLeague;

async function loadAssetLeaderboard() {
  loadLeagueCaravansOptions();
  if (currentLeagueTab === 'caravans') {
    loadCaravansLeaderboard();
  } else {
    loadIndividualsLeaderboard();
  }
}

// 2. REWARDS LEDGER & ANALYTICS
async function loadLedger() {
  try {
    const cat = document.getElementById('filter-ledger-cat').value;
    const res = await request(`/api/v1/admin/rewards/ledger?category=${cat}`);
    const data = await res.json();

    const tbody = document.querySelector('#ledger-data-table tbody');
    tbody.innerHTML = '';

    data.transactions.forEach(t => {
      const amountColor = t.amount > 0 ? 'var(--color-success)' : 'var(--color-danger)';
      const amountPrefix = t.amount > 0 ? '+' : '';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${esc(t.userName)}</strong></td>
        <td class="u-mono">${esc(t.userPhone)}</td>
        <td><strong style="color: ${amountColor};">${amountPrefix}${t.amount} زریک</strong></td>
        <td><span class="badge badge-student">${esc(t.category)}</span></td>
        <td>${esc(t.reason)}</td>
        <td>${esc(t.createdBy)}</td>
        <td class="u-fs-11 u-c-text-secondary">${new Date(t.createdAt).toLocaleString('fa-IR')}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load ledger:', err);
  }
}

async function loadAllUsersDropdown() {
  try {
    const res = await request('/api/v1/admin/users?page=1&limit=500');
    const data = await res.json();
    allUsersList = data.users;

    const select = document.getElementById('zarik-target-user');
    select.innerHTML = '<option value="">انتخاب کاربر...</option>';
    data.users.forEach(u => {
      select.innerHTML += `<option value="${u.id}">${esc(u.name)} (${esc(u.phoneNumber)}) - موجودی: ${u.zarikBalance}</option>`;
    });
  } catch (err) {
    console.error(err);
  }
}

// The form offers an asset type: Zarik goes through rewards/adjust (keeps the ledger category),
// the other assets (کلاف / قالیچه / درفش) through students/:id/adjust-balance. A second, broken
// handler used to run on the same form; this is the only one now.
async function handleZarikAdjustment(e) {
  e.preventDefault();
  const userId = document.getElementById('zarik-target-user').value;
  const assetType = document.getElementById('adj-asset-type')?.value || 'zarik';
  const amount = parseInt(document.getElementById('zarik-amount').value);
  const category = document.getElementById('zarik-category').value;
  const reason = document.getElementById('zarik-reason').value;
  if (!userId) return showToast('کاربر را انتخاب کنید', 'error');

  try {
    const res = assetType === 'zarik'
      ? await request('/api/v1/admin/rewards/adjust', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, amount, category, reason })
        })
      : await request(`/api/v1/admin/students/${encodeURIComponent(userId)}/adjust-balance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assetType, amount, note: reason })
        });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      showToast(data.message || 'تغییر موجودی با موفقیت اعمال شد', 'success');
      document.getElementById('zarik-amount').value = '';
      document.getElementById('zarik-reason').value = '';
      loadLedger();
      loadZarikAnalytics();
      loadAllUsersDropdown();
    } else {
      showToast(data.error || 'خطا در تغییر موجودی', 'error');
    }
  } catch (err) {
    console.error(err);
  }
}

async function handleRewardRuleUpsert(e) {
  e.preventDefault();
  const key = document.getElementById('rule-key').value.trim();
  const min = parseInt(document.getElementById('rule-min').value);
  const max = parseInt(document.getElementById('rule-max').value);
  try {
    const res = await request('/api/v1/admin/rewards/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, min, max })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('قانون ذخیره شد', 'success');
      document.getElementById('reward-rules-form').reset();
      loadRewardRules();
    } else {
      showToast(data.error);
    }
  } catch (err) { console.error(err); }
}

async function loadRewardRules() {
  try {
    const res = await request('/api/v1/admin/rewards/rules');
    const rules = await res.json();
    const list = document.getElementById('rule-list');
    list.innerHTML = '';
    rules.forEach(r => {
      const li = document.createElement('li');
      li.textContent = `${r.key}: min=${r.min}, max=${r.max}`;
      list.appendChild(li);
    });
  } catch (err) { console.error('Failed to load reward rules', err); }
}

async function loadZarikAnalytics() {
  try {
    const res = await request('/api/v1/admin/rewards/analytics');
    if (!res.ok) return;
    const data = await res.json();

    // Stats display update
    const totalZarikElem = document.getElementById('stats-total-zarik');
    if (totalZarikElem && data.circulation !== undefined) {
      totalZarikElem.textContent = data.circulation.toLocaleString();
    }

    // Wealth chart
    const wealthCanvas = document.getElementById('wealthChart');
    if (wealthCanvas && typeof Chart !== 'undefined') {
      const wealthCtx = wealthCanvas.getContext('2d');
      if (wealthChart) wealthChart.destroy();
      
      wealthChart = new Chart(wealthCtx, {
        type: 'bar',
        data: {
          labels: data.topWealthy ? data.topWealthy.map(w => w.name) : [],
          datasets: [{
            label: 'موجودی زریک (۵ نفر برتر)',
            data: data.topWealthy ? data.topWealthy.map(w => w.zarikBalance) : [],
            backgroundColor: NopaTheme.rgba('--primary-rgb', 0.6),
            borderColor: NopaTheme.rgba('--primary-rgb', 1), // canvas cannot resolve var(); the old 'var(--…)' never drew
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false
        }
      });
    }

    // Velocity chart (distribution by category)
    const velCanvas = document.getElementById('velocityChart');
    if (velCanvas && typeof Chart !== 'undefined') {
      const velCtx = velCanvas.getContext('2d');
      if (velocityChart) velocityChart.destroy();

      velocityChart = new Chart(velCtx, {
        type: 'doughnut',
        data: {
          labels: data.distributions ? data.distributions.map(d => d.category) : [],
          datasets: [{
            data: data.distributions ? data.distributions.map(d => Math.abs(d.totalAmount)) : [],
            backgroundColor: [
              NopaTheme.rgba('--primary-rgb', 0.75),
              NopaTheme.rgba('--success-rgb', 0.75),
              NopaTheme.rgba('--accent-rgb', 0.75),
              NopaTheme.rgba('--danger-rgb', 0.75)
            ],
            borderColor: NopaTheme.cssVar('--surface')
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'right' }
          }
        }
      });
    }

  } catch (err) {
    console.error('loadZarikAnalytics error:', err);
  }
}

// "adjust" icon in the wealth leaderboard: preselect the user in the Zarik form and scroll to it
window.pickZarikTarget = function(userId) {
  const select = document.getElementById('zarik-target-user');
  if (select) select.value = userId;
  const form = document.getElementById('zarik-adjust-form');
  if (form) form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  else window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
};
