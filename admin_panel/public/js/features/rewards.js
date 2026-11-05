// Wallet & league tab (#rewards-tab): bento overview of the league (caravans / people) with the platform totals,
// Zarik by category, the richest people, reward rules and the latest Zarik transactions (#wlt-overview-view), and one
// person's wallet page (#wlt-detail-view): circles are the people of the current league list; the person's card is
// linked to their assets and to their Zarik transactions. Dialogs: new transaction, promotional Zarik, reward rule.
// Both leaderboards are fetched once and filtered / sorted here, so filters animate through NopaFlip.
// Styles: css/stations.css (.lst-*, .lsv-*, .crv-*, .wlt-*). Helpers crvAvatar / crvFa / crvArgs / crvInitial /
// crvFadeOut come from caravans.js and mntFitNotch from mentors.js (they load later, but are only used at run time).
// Classic script: shares globals with the other modules; load order is set in index.html.

let currentLeagueTab = 'caravans';
window.wltCaravans = [];
window.wltPeople = [];
window.wltActiveId = null;
window.wltRenderedId = null;
let wltLoadedOnce = false;
let wltShowCount = 48;
const WLT_PAGE = 48;
const wltLedgerCache = new Map(); // userId -> that person's Zarik transactions

const WLT_CATEGORY = {
  'Quiz Rewards': 'جوایز آزمون',
  'Skill Tasks': 'چالش مهارتی',
  'Mentor Bonuses': 'پاداش مربی',
  'Special Campaigns': 'کمپین ویژه',
};
const WLT_SORT_LABEL = {
  totalScore: 'امتیاز کل', zarik: 'زریک', beyragh: 'درفش', nakh: 'کلاف', farsh: 'قالیچه', stars: 'ستاره‌ها',
  quizScore: 'نمره آزمون', challengeScore: 'امتیاز چالش', progress: 'پیشرفت', wealth: 'ارزش دارایی',
};

function wltCat(c) { return WLT_CATEGORY[c] || c || 'بدون دسته'; }
function wltDate(d) {
  const t = new Date(d);
  return isNaN(t) ? '' : t.toLocaleString('fa-IR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function wltFind(id) { return (window.wltPeople || []).find(p => String(p.id) === String(id)) || null; }
function wltSet(id, fn) { const el = document.getElementById(id); if (el) fn(el); }

// The value a list is sorted by (caravans and people name a few fields differently)
function wltSortValue(x, sortBy) {
  switch (sortBy) {
    case 'zarik': return x.zarik || 0;
    case 'beyragh': return x.beyragh || 0;
    case 'nakh': return x.nakh || 0;
    case 'farsh': return x.farsh || 0;
    case 'stars': return x.stars || 0;
    case 'quizScore': return x.quizScore || 0;
    case 'challengeScore': return x.challengeScore || 0;
    case 'progress': return x.overallProgress ?? x.progressPercentage ?? 0;
    case 'wealth': return x.totalWealth ?? x.wealthScore ?? 0;
    default: return x.totalScore || 0;
  }
}
// Sorted copy with tie-aware ranks; a zero score has no rank
function wltRanked(list, sortBy) {
  let rank = 0;
  let prev = null;
  return list.slice().sort((a, b) => wltSortValue(b, sortBy) - wltSortValue(a, sortBy)).map(x => {
    const score = wltSortValue(x, sortBy);
    if (score <= 0) return { x, score, rank: null };
    if (prev === null || score < prev) rank++;
    prev = score;
    return { x, score, rank };
  });
}
function wltFilters() {
  return {
    q: (document.getElementById('league-search-input')?.value || '').trim().toLowerCase(),
    sortBy: document.getElementById('league-sort-by')?.value || 'totalScore',
    role: document.getElementById('league-role-filter')?.value || 'all',
    caravanId: document.getElementById('league-caravan-filter')?.value || 'all',
  };
}
function wltHas(values, q) { return !q || values.some(v => String(v || '').toLowerCase().includes(q)); }

function wltShownCaravans() {
  const f = wltFilters();
  const list = (window.wltCaravans || []).filter(c =>
    (f.caravanId === 'all' || String(c.id) === String(f.caravanId)) && wltHas([c.name, c.mentorName, c.mentorPhone], f.q));
  return wltRanked(list, f.sortBy);
}
// Ranks are over everyone who matches the role / caravan filters; the search only hides rows
function wltShownPeople() {
  const f = wltFilters();
  const base = (window.wltPeople || []).filter(p =>
    (f.role === 'all' || p.role === f.role) && (f.caravanId === 'all' || String(p.caravanId) === String(f.caravanId)));
  return wltRanked(base, f.sortBy).filter(r => wltHas([r.x.name, r.x.phoneNumber, r.x.caravanName], f.q));
}
function wltRankOf(id) {
  const r = wltRanked(window.wltPeople || [], 'totalScore').find(r => String(r.x.id) === String(id));
  return r ? r.rank : null;
}
function wltRankChip(rank) {
  if (!rank) return '';
  return rank <= 3
    ? `<span class="lst-chip lst-chip-active"><i class="fa-solid fa-medal"></i> رتبه ${crvFa(rank)}</span>`
    : `<span class="lst-chip lst-chip-scheduled"><i class="fa-solid fa-hashtag"></i> رتبه ${crvFa(rank)}</span>`;
}
function wltNums(x) {
  return `
    <span class="crv-card-nums">
      <span class="u-c-accent-text" title="زریک"><i class="fa-solid fa-coins"></i> ${crvFa(x.zarik)}</span>
      <span class="u-c-primary-text" title="کلاف"><i class="fa-solid fa-circle-nodes"></i> ${crvFa(x.nakh)}</span>
      <span class="u-c-danger-text" title="قالیچه"><i class="fa-solid fa-rug"></i> ${crvFa(x.farsh)}</span>
      <span class="u-c-info-text" title="درفش"><i class="fa-solid fa-flag"></i> ${crvFa(x.beyragh)}</span>
    </span>`;
}

// ==================== LOADERS ====================
// Called by the router on every visit; each part also has its own loader (the dialogs refresh only what changed)
window.loadWallet = async function() {
  window.wltSetLoading(true);
  await Promise.allSettled([loadAssetLeaderboard(), loadZarikAnalytics(), loadRewardRules(), loadLedger()]);
  wltLoadedOnce = true;
  window.wltSetLoading(false);
};

async function loadAssetLeaderboard() {
  try {
    const [cRes, pRes] = await Promise.all([
      request('/api/v1/admin/leaderboard/caravans?sortBy=totalScore'),
      request('/api/v1/admin/leaderboard/individuals?role=all&sortBy=totalScore&limit=300'),
    ]);
    if (!cRes.ok || !pRes.ok) throw new Error('خطا در دریافت رتبه‌بندی');
    const caravans = await cRes.json();
    const people = await pRes.json();
    window.wltCaravans = Array.isArray(caravans) ? caravans : [];
    window.wltPeople = Array.isArray(people) ? people : [];
    wltLedgerCache.clear();
    wltFillCaravanFilter();
    wltLoadedOnce = true;
    window.applyLeagueFilters();
    if (window.wltActiveId) {
      if (wltFind(window.wltActiveId)) window.loadWalletPage(); else window.closeWalletView();
    }
  } catch (err) {
    console.error('Failed to load leaderboards', err);
    wltSet('wlt-bento-list', el => {
      el.innerHTML = `<div class="lst-empty"><i class="fa-solid fa-triangle-exclamation lst-warn"></i> ${esc(err.message || 'خطا در دریافت رتبه‌بندی')}</div>`;
    });
  }
}
window.loadAssetLeaderboard = loadAssetLeaderboard;

function wltFillCaravanFilter() {
  const sel = document.getElementById('league-caravan-filter');
  if (!sel) return;
  const current = sel.value;
  const list = (window.wltCaravans || []).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'fa'));
  sel.innerHTML = '<option value="all">همه کاروان‌ها</option>' + list.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  sel.value = list.some(c => String(c.id) === current) ? current : 'all';
}

// Platform totals (economy hub) and Zarik by ledger category (analytics)
async function loadZarikAnalytics() {
  try {
    const [hubRes, anRes] = await Promise.all([
      request('/api/v1/admin/zarik/economy-hub'),
      request('/api/v1/admin/rewards/analytics'),
    ]);
    const hub = hubRes.ok ? await hubRes.json() : null;
    const an = anRes.ok ? await anRes.json() : null;
    if (hub) {
      wltSet('eco-zarik', el => { el.textContent = crvFa(hub.totalZarik); });
      wltSet('eco-nakh', el => { el.textContent = crvFa(hub.totalNakh); });
      wltSet('eco-farsh', el => { el.textContent = crvFa(hub.totalFarsh); });
      wltSet('eco-beyragh', el => { el.textContent = crvFa(hub.totalBeyragh); });
    }
    wltSet('stats-total-zarik', el => { if (an && an.circulation !== undefined) el.textContent = crvFa(an.circulation); });
    wltSet('wlt-bento-dist', el => { el.innerHTML = wltDistHtml(an ? an.distributions || [] : null); });
  } catch (err) {
    console.error('loadZarikAnalytics error:', err);
    wltSet('wlt-bento-dist', el => { el.innerHTML = wltDistHtml(null); });
  }
}
window.loadZarikAnalytics = loadZarikAnalytics;

function wltDistHtml(dist) {
  if (!dist) return '<div class="lst-empty"><i class="fa-solid fa-triangle-exclamation lst-warn"></i> خطا در دریافت آمار</div>';
  const rows = dist.map(d => ({ ...d, abs: Math.abs(Number(d.totalAmount) || 0) })).filter(d => d.abs || d.count).sort((a, b) => b.abs - a.abs);
  if (!rows.length) return '<div class="lst-empty">هنوز تراکنش زریکی ثبت نشده است.</div>';
  const total = rows.reduce((n, d) => n + d.abs, 0) || 1;
  return `
    <div class="lst-bar">${rows.map((d, i) => `<span class="wlt-c${i % 4}" data-style="width:${(d.abs / total * 100).toFixed(1)}%"></span>`).join('')}</div>
    <div class="lst-legend">${rows.map((d, i) => `
      <div class="lst-legend-row"><span><span class="lst-dot wlt-c${i % 4}"></span>${esc(wltCat(d.category))} <small class="u-c-text-muted">${crvFa(d.count)} تراکنش</small></span><strong>${crvFa(d.totalAmount)}</strong></div>`).join('')}
    </div>`;
}

async function loadRewardRules() {
  const box = document.getElementById('rule-list');
  if (!box) return;
  try {
    const res = await request('/api/v1/admin/rewards/rules');
    const rules = await res.json();
    if (!res.ok || !Array.isArray(rules)) throw new Error();
    window.wltRules = rules;
    const add = '<div class="lst-quick wlt-rule-add"><button type="button" class="lst-quick-btn" data-click="openWalletRule"><i class="fa-solid fa-plus"></i> قانون جدید</button></div>';
    box.innerHTML = (rules.length
      ? `<ul class="lst-list">${rules.slice(0, 6).map(r => `
          <li class="lst-list-item lst-clickable" role="button" tabindex="0" data-click="openWalletRule" data-click-args="${crvArgs(r.key)}" title="ویرایش قانون">
            <i class="fa-solid fa-sliders u-c-primary-text"></i>
            <span class="lst-grow"><bdi dir="ltr" class="wlt-key">${esc(r.key)}</bdi></span>
            <span class="u-c-accent-text">${crvFa(r.min)} تا ${crvFa(r.max)}</span>
          </li>`).join('')}</ul>${rules.length > 6 ? `<div class="lst-tile-sub">و ${crvFa(rules.length - 6)} قانون دیگر</div>` : ''}`
      : '<div class="lst-empty">هنوز قانونی ثبت نشده است.</div>') + add;
  } catch (err) {
    console.error('Failed to load reward rules', err);
    box.innerHTML = '<div class="lst-empty"><i class="fa-solid fa-triangle-exclamation lst-warn"></i> خطا در دریافت قوانین پاداش</div>';
  }
}
window.loadRewardRules = loadRewardRules;

function wltLedgerItem(t) {
  const plus = Number(t.amount) > 0;
  const known = wltFind(t.userId);
  return `
    <li class="lst-list-item${known ? ' lst-clickable' : ''}" data-anim-key="lg:${esc(t.id)}"${known ? ` role="button" tabindex="0" data-click="openWalletView" data-click-args="${crvArgs(t.userId)}"` : ''}>
      <span class="lst-avatar wlt-amount-icon ${plus ? 'is-plus' : 'is-minus'}"><i class="fa-solid ${plus ? 'fa-arrow-down' : 'fa-arrow-up'}"></i></span>
      <span class="lst-grow"><strong>${esc(t.userName || '')}</strong> <small class="u-c-text-muted">${esc(t.reason || '')} · ${esc(wltCat(t.category))} · ${esc(wltDate(t.createdAt))}</small></span>
      <strong class="${plus ? 'u-c-success-text' : 'u-c-danger-text'}" dir="ltr">${plus ? '+' : ''}${crvFa(t.amount)}</strong>
    </li>`;
}

async function loadLedger() {
  const box = document.getElementById('wlt-bento-ledger');
  if (!box) return;
  wltLedgerCache.clear();
  try {
    const cat = document.getElementById('filter-ledger-cat')?.value || '';
    const res = await request(`/api/v1/admin/rewards/ledger?limit=8&category=${encodeURIComponent(cat)}`);
    const data = await res.json();
    if (!res.ok || !data || !Array.isArray(data.transactions)) throw new Error();
    const draw = () => {
      box.innerHTML = data.transactions.length
        ? `<ul class="lst-list wlt-ledger">${data.transactions.map(wltLedgerItem).join('')}</ul>`
        : '<div class="lst-empty">تراکنشی با این فیلتر یافت نشد.</div>';
    };
    if (window.NopaFlip) window.NopaFlip.render(box, draw); else draw();
  } catch (err) {
    console.error('Failed to load ledger:', err);
    box.innerHTML = '<div class="lst-empty"><i class="fa-solid fa-triangle-exclamation lst-warn"></i> خطا در دریافت دفتر تراکنش‌ها</div>';
  }
  if (window.wltActiveId && document.getElementById('wlt-detail-view')?.style.display !== 'none') window.loadWalletPage();
}
window.loadLedger = loadLedger;

// Users for the two dialogs' pickers (also refreshed by the users tab after a change)
async function loadAllUsersDropdown() {
  try {
    const res = await request('/api/v1/admin/users?page=1&limit=500');
    const data = await res.json();
    allUsersList = data.users || [];
    const options = '<option value="">انتخاب کاربر...</option>' + allUsersList.map(u =>
      `<option value="${esc(u.id)}">${esc(u.name)} (${esc(u.phoneNumber)}) · ${crvFa(u.zarikBalance)} زریک</option>`).join('');
    ['zarik-target-user', 'promo-target-user'].forEach(id => wltSet(id, sel => {
      const current = sel.value;
      sel.innerHTML = options;
      sel.value = current;
    }));
  } catch (err) {
    console.error(err);
  }
}
window.loadAllUsersDropdown = loadAllUsersDropdown;

// ==================== OVERVIEW (BENTO) ====================

function switchLeagueTab(tab) {
  currentLeagueTab = tab === 'individuals' ? 'individuals' : 'caravans';
  document.querySelectorAll('#rewards-tab .wlt-seg-btn').forEach(btn => {
    const on = btn.id === `btn-league-${currentLeagueTab}`;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  wltSet('league-role-filter', el => { el.style.display = currentLeagueTab === 'individuals' ? '' : 'none'; });
  window.applyLeagueFilters();
}
window.switchLeagueTab = switchLeagueTab;

window.applyLeagueFilters = function() {
  wltShowCount = WLT_PAGE;
  const overview = document.getElementById('wlt-overview-view');
  if (window.NopaFlip && overview) window.NopaFlip.render(overview, wltDrawBento); else wltDrawBento();
};
window.debounceLeagueSearch = window.applyLeagueFilters; // old name
window.loadCaravansLeaderboard = () => switchLeagueTab('caravans');
window.loadIndividualsLeaderboard = () => switchLeagueTab('individuals');

window.showMoreLeague = function() {
  wltShowCount += WLT_PAGE;
  const grid = document.getElementById('wlt-bento-list');
  if (window.NopaFlip && grid) window.NopaFlip.render(grid, wltDrawGrid); else wltDrawGrid();
};

function wltCaravanCard({ x: c, score, rank }, sortBy) {
  const cap = Number(c.capacityLimit) || 0;
  const tier = rank && rank <= 3 ? ` is-rank-${rank}` : '';
  return `
    <button type="button" class="crv-card" data-anim-key="wc:${esc(c.id)}" data-click="openUserCaravanPage" data-click-args="${crvArgs(c.id)}" title="ورود به صفحه ${esc(c.name)}">
      <span class="crv-card-top">
        <span class="crv-card-cover wlt-rank-cover${tier}">${rank ? crvFa(rank) : '-'}</span>
        <span class="crv-card-name"><strong>${esc(c.name)}</strong>${wltRankChip(rank)}</span>
      </span>
      <span class="crv-card-mentor"><i class="fa-solid fa-user-tie"></i><span>${esc(c.mentorName || 'بدون راهبر')} · ${crvFa(c.memberCount)}${cap ? ` / ${crvFa(cap)}` : ''} عضو</span></span>
      <span class="crv-card-cap"><span>${esc(WLT_SORT_LABEL[sortBy] || 'امتیاز')}</span><strong>${crvFa(score)}${sortBy === 'progress' ? '٪' : ''}</strong></span>
      <span class="lst-bar" title="پیشرفت کلاس‌ها"><span class="lst-bar-active" data-style="width:${Math.min(100, Number(c.overallProgress) || 0)}%"></span></span>
      <span class="crv-card-foot">${wltNums(c)}</span>
    </button>`;
}

function wltPersonCard({ x: p, score, rank }, sortBy) {
  return `
    <button type="button" class="crv-card" data-anim-key="wp:${esc(p.id)}" data-click="openWalletView" data-click-args="${crvArgs(p.id)}" title="کیف پول ${esc(p.name)}">
      <span class="crv-card-top">
        ${crvAvatar(p.avatarUrl, p.name, 'crv-card-cover')}
        <span class="crv-card-name"><strong>${esc(p.name)}</strong>${wltRankChip(rank)}</span>
      </span>
      <span class="crv-card-mentor"><i class="fa-solid ${p.role === 'mentor' ? 'fa-user-tie' : 'fa-user-graduate'}"></i><span>${p.role === 'mentor' ? 'راهبر' : 'دانش‌آموز'} · ${esc(p.caravanName || 'بدون کاروان')}</span></span>
      <span class="crv-card-cap"><span>${esc(WLT_SORT_LABEL[sortBy] || 'امتیاز')}</span><strong>${crvFa(score)}${sortBy === 'progress' ? '٪' : ''}</strong></span>
      <span class="lst-bar" title="پیشرفت کلاس‌ها"><span class="lst-bar-active" data-style="width:${Math.min(100, Number(p.progressPercentage) || 0)}%"></span></span>
      <span class="crv-card-foot">${wltNums(p)}</span>
    </button>`;
}

function wltDrawGrid() {
  const grid = document.getElementById('wlt-bento-list');
  if (!grid) return;
  const f = wltFilters();
  const caravans = currentLeagueTab === 'caravans';
  const list = caravans ? wltShownCaravans() : wltShownPeople();
  const filtering = !!f.q || f.caravanId !== 'all' || (!caravans && f.role !== 'all');
  const cards = list.slice(0, wltShowCount).map(r => caravans ? wltCaravanCard(r, f.sortBy) : wltPersonCard(r, f.sortBy));
  if (list.length > wltShowCount) cards.push(`
    <button type="button" class="crv-card crv-card-add" data-anim-key="wl-more" data-click="showMoreLeague" title="نمایش بیشتر">
      <span class="lsv-round lsv-round-lg"><i class="fa-solid fa-chevron-down"></i></span><span>${crvFa(list.length - wltShowCount)} مورد دیگر</span>
    </button>`);
  if (!list.length) cards.push(`<div class="lst-empty" data-anim-key="wl-empty">${filtering ? 'موردی با این مشخصات یافت نشد.' : caravans ? 'هنوز کاروانی ساخته نشده است.' : 'هنوز کسی در لیگ نیست.'}</div>`);
  grid.innerHTML = cards.join('');
  grid.setAttribute('aria-busy', 'false');

  const total = caravans ? (window.wltCaravans || []).length : (window.wltPeople || []).length;
  wltSet('wlt-count-badge', el => {
    el.textContent = filtering
      ? `نمایش ${crvFa(list.length)} از ${crvFa(total)}`
      : caravans ? 'برای ورود به صفحه هر کاروان بزنید' : 'برای دیدن کیف پول هر نفر بزنید';
  });
}

function wltDrawBento() {
  wltDrawGrid();
  wltSet('wlt-bento-top', el => {
    const top = (window.wltPeople || []).filter(p => p.role !== 'mentor' && (p.wealthScore || 0) > 0)
      .sort((a, b) => (b.wealthScore || 0) - (a.wealthScore || 0)).slice(0, 5);
    el.innerHTML = top.length
      ? `<ul class="lst-list">${top.map((p, i) => `
          <li class="lst-list-item lst-clickable" role="button" tabindex="0" data-anim-key="wt:${esc(p.id)}" data-click="openWalletView" data-click-args="${crvArgs(p.id)}">
            <span class="crv-rank">${crvFa(i + 1)}</span>
            ${crvAvatar(p.avatarUrl, p.name, 'lst-avatar')}
            <span class="lst-grow"><strong>${esc(p.name)}</strong></span>
            <span class="u-c-accent-text" title="ارزش دارایی‌ها"><i class="fa-solid fa-coins"></i> ${crvFa(p.wealthScore)}</span>
          </li>`).join('')}</ul>`
      : '<div class="lst-empty">هنوز دارایی‌ای جمع نشده است.</div>';
  });
}

// ==================== LOADING SHIMMER ====================
window.wltSetLoading = function(on) {
  const overview = document.getElementById('wlt-overview-view');
  if (!overview) return;
  overview.querySelectorAll('.lst-bento > .lst-tile').forEach(t => t.classList.toggle('is-loading', on));
  const grid = document.getElementById('wlt-bento-list');
  if (grid) grid.setAttribute('aria-busy', on ? 'true' : 'false');
  if (!on || wltLoadedOnce) return;
  if (grid) {
    grid.innerHTML = Array.from({ length: 6 }, () => `
      <div class="crv-card lst-skel" aria-hidden="true">
        <span class="crv-card-top"><span class="crv-card-cover"></span><span class="crv-card-name"><span class="lst-skel-line"></span><span class="lst-skel-line lst-skel-chip"></span></span></span>
        <span class="lst-skel-line lst-skel-short"></span>
        <span class="lst-skel-line"></span>
        <span class="lst-skel-line lst-skel-short"></span>
      </div>`).join('');
  }
  const lines = '<div class="lst-skel-lines" aria-hidden="true">' + '<span class="lst-skel-row"></span>'.repeat(3) + '</div>';
  ['wlt-bento-dist', 'wlt-bento-top', 'rule-list', 'wlt-bento-ledger'].forEach(id => wltSet(id, el => { el.innerHTML = lines; }));
};

// ==================== ONE PERSON'S WALLET ====================

window.openWalletView = function(userId) {
  if (!wltFind(userId)) return showToast('این کاربر در فهرست لیگ نیست', 'info');
  const overview = document.getElementById('wlt-overview-view');
  window.wltActiveId = String(userId);
  const open = () => {
    window.loadWalletPage();
    document.getElementById('rewards-tab')?.scrollIntoView({ block: 'start', behavior: NopaMotion.scrollBehavior() });
  };
  if (overview && overview.style.display !== 'none') crvFadeOut(overview, open); else open();
};

window.closeWalletView = function() {
  const view = document.getElementById('wlt-detail-view');
  const overview = document.getElementById('wlt-overview-view');
  window.wltActiveId = null;
  window.wltRenderedId = null;
  crvFadeOut(view, () => {
    if (window.wltActiveId) return; // another person was opened meanwhile
    if (view) view.style.display = 'none';
    if (overview) {
      overview.style.display = '';
      if (window.NopaFlip) window.NopaFlip.enter(overview.querySelectorAll(':scope > div:first-child, .lst-bento > .lst-tile'));
    }
  });
};

window.selectWalletCircle = function(userId) {
  if (String(window.wltActiveId) === String(userId)) return;
  window.wltActiveId = String(userId);
  window.loadWalletPage();
};
window.adjustActiveWallet = function() { window.openWalletAdjust(window.wltActiveId); };
window.promoActiveWallet = function() { window.openWalletPromo(window.wltActiveId); };
window.reportActiveWallet = function() { if (window.wltActiveId) viewUserDetails(window.wltActiveId); };

// Up to 15 people of the current list around the open one (the open one is always there)
function wltCircles(activeId) {
  const list = wltShownPeople().map(r => r.x);
  let i = list.findIndex(p => String(p.id) === String(activeId));
  if (i < 0) { const p = wltFind(activeId); if (p) list.unshift(p); i = 0; }
  const start = Math.max(0, Math.min(i - 7, list.length - 15));
  return list.slice(start, start + 15).map(p => {
    const active = String(p.id) === String(activeId);
    return `
      <button type="button" class="lsv-circle${active ? ' is-active' : ''}" data-anim-key="wcc:${esc(p.id)}" data-click="selectWalletCircle" data-click-args="${crvArgs(p.id)}" title="${esc(p.name)}"${active ? ' aria-current="true"' : ''}>
        <span class="lsv-circle-main">
          <span class="lsv-circle-img">${nopaImgSrc(p.avatarUrl) ? `<img src="${esc(nopaImgSrc(p.avatarUrl))}" alt="" loading="lazy" data-error="lmsImageFallback" data-error-args='["$this", "${crvInitial(p.name)}"]'>` : `<span>${crvInitial(p.name)}</span>`}</span>
          <span class="lsv-circle-badge ${p.role === 'mentor' ? 'lsv-state-scheduled' : 'lsv-state-active'}"><i class="fa-solid fa-coins"></i></span>
        </span>
        <span class="lsv-circle-name"><span>${esc(p.name)}</span></span>
      </button>`;
  }).join('');
}

function wltInfoCard(p) {
  const rank = wltRankOf(p.id);
  const level = typeof window.lvlLevelName === 'function' ? window.lvlLevelName(p.levelFrame || 1, true) : `سطح ${crvFa(p.levelFrame || 1)}`;
  return `
    ${crvAvatar(p.avatarUrl, p.name, 'crv-mentor-photo')}
    <strong class="crv-mentor-name">${esc(p.name)}</strong>
    <span class="crv-mentor-phone" dir="ltr">${esc(p.phoneNumber || '')}</span>
    <div class="mnt-mini">
      <span><strong>${rank ? crvFa(rank) : '-'}</strong><small>رتبه کل</small></span>
      <span><strong>${crvFa(p.totalScore)}</strong><small>امتیاز کل</small></span>
      <span><strong>${crvFa(p.wealthScore)}</strong><small>ارزش دارایی</small></span>
    </div>
    <div class="lsv-facts crv-mentor-facts">
      <span><i class="fa-solid ${p.role === 'mentor' ? 'fa-user-tie' : 'fa-user-graduate'}"></i> ${p.role === 'mentor' ? 'راهبر' : 'دانش‌آموز'}</span>
      <span><i class="fa-solid fa-compass"></i> ${esc(p.caravanName || 'بدون کاروان')}</span>
      <span><i class="fa-solid fa-layer-group"></i> ${esc(level)}</span>
    </div>
    <div class="mnt-info-actions">
      <button type="button" class="lsv-pill" data-click="adjustActiveWallet"><i class="fa-solid fa-plus"></i> تراکنش جدید</button>
      <button type="button" class="lse-btn" data-click="promoActiveWallet"><i class="fa-solid fa-gift"></i> زریک هدیه</button>
      ${p.caravanId ? `<button type="button" class="lse-btn" data-click="openUserCaravanPage" data-click-args="${crvArgs(p.caravanId)}"><i class="fa-solid fa-compass"></i> کاروان</button>` : ''}
    </div>`;
}

function wltAssetTile(cls, icon, label, value, key) {
  return `
    <div class="crv-asset ${cls}" data-anim-key="wa:${key}">
      <span class="crv-asset-icon"><i class="fa-solid ${icon}"></i></span>
      <span class="crv-asset-text"><small>${esc(label)}</small><strong>${value}</strong></span>
    </div>`;
}

function wltPaint(p, ledger) {
  wltSet('wlt-title', el => { el.textContent = `کیف پول ${p.name}`; });
  wltSet('wlt-state', el => { el.innerHTML = wltRankChip(wltRankOf(p.id)); });
  wltSet('wlt-sub', el => { el.textContent = `${p.role === 'mentor' ? 'راهبر' : 'دانش‌آموز'} · ${p.caravanName || 'بدون کاروان'}`; });
  wltSet('wlt-circles', el => { el.innerHTML = wltCircles(p.id); });
  wltSet('wlt-info-card', el => { el.innerHTML = wltInfoCard(p); });
  wltSet('wlt-assets-card', el => {
    el.innerHTML = [
      wltAssetTile('is-accent', 'fa-coins', 'زریک', crvFa(p.zarik), 'zarik'),
      wltAssetTile('', 'fa-circle-nodes', 'کلاف', crvFa(p.nakh), 'nakh'),
      wltAssetTile('wlt-asset-danger', 'fa-rug', 'قالیچه', crvFa(p.farsh), 'farsh'),
      wltAssetTile('is-info', 'fa-flag', 'درفش', crvFa(p.beyragh), 'beyragh'),
      wltAssetTile('is-success', 'fa-sack-dollar', 'ارزش دارایی‌ها (زریک)', crvFa(p.wealthScore), 'wealth'),
      wltAssetTile('is-accent', 'fa-star', 'آزمون‌های قبول‌شده', `${crvFa(p.stars)} · نمره ${crvFa(p.quizScore)}`, 'quiz'),
      wltAssetTile('', 'fa-trophy', 'چالش‌های تأییدشده', `${crvFa(p.approvedChallenges)} · امتیاز ${crvFa(p.challengeScore)}`, 'challenge'),
      wltAssetTile('is-progress', 'fa-route', 'پیشرفت کلاس‌ها', `${crvFa(p.progressPercentage)}٪`, 'progress'),
    ].join('');
  });

  wltSet('wlt-ledger-card', el => { el.classList.toggle('is-loading', !ledger); });
  wltSet('wlt-ledger-count', el => { el.textContent = ledger ? crvFa(ledger.length) : '…'; });
  wltSet('wlt-ledger-list', el => {
    if (!ledger) {
      el.innerHTML = Array.from({ length: 4 }, () => `
        <div class="lsv-row crv-member" aria-hidden="true"><span class="lsv-row-avatar lst-skel-avatar"></span>
          <span class="lsv-row-text"><span class="lst-skel-line"></span><span class="lst-skel-line lst-skel-short"></span></span></div>`).join('');
      return;
    }
    const rows = ledger.map(t => {
      const plus = Number(t.amount) > 0;
      return `
        <div class="lsv-row crv-member" data-anim-key="wl:${esc(t.id)}">
          <span class="lsv-row-avatar lsv-row-num wlt-amount-icon ${plus ? 'is-plus' : 'is-minus'}"><i class="fa-solid ${plus ? 'fa-arrow-down' : 'fa-arrow-up'}"></i></span>
          <span class="lsv-row-text"><strong>${esc(t.reason || 'بدون شرح')}</strong><span>${esc(wltCat(t.category))} · ${esc(wltDate(t.createdAt))}${t.createdBy ? ` · <bdi>${esc(t.createdBy)}</bdi>` : ''}</span></span>
          <span class="lsv-status ${plus ? 'is-ok' : 'is-warn'}" dir="ltr">${plus ? '+' : ''}${crvFa(t.amount)}</span>
        </div>`;
    });
    if (!rows.length) rows.push('<div class="lsv-col-empty">هنوز تراکنش زریکی برای این نفر ثبت نشده است.</div>');
    rows.push(`
      <button type="button" class="lsv-row lsv-row-add crv-member" data-anim-key="wl-add" data-click="adjustActiveWallet">
        <span class="lsv-row-avatar lsv-row-plus"><i class="fa-solid fa-plus"></i></span>
        <span class="lsv-row-text"><strong>تراکنش جدید</strong><span>واریز یا کسر زریک، کلاف، قالیچه یا درفش</span></span>
      </button>`);
    el.innerHTML = rows.join('');
  });
}

window.loadWalletPage = async function() {
  const view = document.getElementById('wlt-detail-view');
  const overview = document.getElementById('wlt-overview-view');
  const id = window.wltActiveId;
  const p = id && wltFind(id);
  if (!view || !p) return;

  const cached = wltLedgerCache.get(id) || null;
  const wasOpen = view.style.display !== 'none';
  const same = wasOpen && window.wltRenderedId === id;
  window.wltRenderedId = id;
  if (overview) overview.style.display = 'none';
  view.style.display = 'block';
  if (same && window.NopaFlip) window.NopaFlip.render(view, () => wltPaint(p, cached));
  else {
    wltPaint(p, cached);
    if (window.NopaFlip) {
      // switching people keeps the header and circles still; opening animates everything in
      window.NopaFlip.enter(view.querySelectorAll(wasOpen ? '.wlt-flow > .lsv-col, .wlt-flow > .lsv-link'
        : '.lsv-head, .lsv-board, .lsv-notch .lsv-circle, .wlt-flow > .lsv-col'));
      const picked = wasOpen && view.querySelector('.lsv-circle.is-active .lsv-circle-img');
      if (picked && typeof picked.animate === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        picked.animate([{ transform: 'scale(0.8)' }, { transform: 'scale(1.12)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
      }
    }
  }
  mntFitNotch(view);
  if (cached) return;

  let ledger = null;
  try {
    // the server filters by userId; the filter here also covers a server that ignores it
    const res = await request(`/api/v1/admin/rewards/ledger?limit=50&userId=${encodeURIComponent(id)}`);
    const data = res.ok ? await res.json() : null;
    if (data && Array.isArray(data.transactions)) ledger = data.transactions.filter(t => String(t.userId) === String(id));
  } catch (_) {}
  if (window.wltActiveId !== id) return; // the user moved on while this loaded
  if (ledger) wltLedgerCache.set(id, ledger);
  const draw = () => wltPaint(wltFind(id) || p, ledger || []);
  if (window.NopaFlip) window.NopaFlip.render(view, draw); else draw();
};

// ==================== DIALOGS ====================

function wltShowModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return null;
  modal.style.display = 'flex';
  modal.style.zIndex = 'var(--z-modal)';
  return modal;
}
function wltPickUser(selectId, userId) {
  const sel = document.getElementById(selectId);
  if (!sel || !userId) return;
  if (!sel.querySelector(`option[value="${CSS.escape(String(userId))}"]`)) {
    const p = wltFind(userId);
    sel.insertAdjacentHTML('beforeend', `<option value="${esc(userId)}">${esc(p ? `${p.name} (${p.phoneNumber})` : userId)}</option>`);
  }
  sel.value = String(userId);
}

window.openWalletAdjust = function(userId) {
  const uid = typeof userId === 'string' ? userId : ''; // a data-click with no args
  const form = document.getElementById('zarik-adjust-form');
  if (form) form.reset();
  if (!(allUsersList || []).length) loadAllUsersDropdown().then(() => wltPickUser('zarik-target-user', uid));
  wltPickUser('zarik-target-user', uid);
  const p = uid && wltFind(uid);
  wltSet('wlt-adjust-title', el => { el.textContent = p ? `تراکنش جدید برای ${p.name}` : 'تراکنش جدید'; });
  wltLoadAdjustCaravans();
  window.wltAdjustSync();
  wltShowModal('wlt-adjust-modal');
};

// Caravans for «اعمال برای: یک کاروان», loaded once per page
let wltCaravans = null;
async function wltLoadAdjustCaravans() {
  if (wltCaravans) return;
  try {
    const res = await request('/api/v1/admin/caravans', { silent: true });
    const data = res.ok ? await res.json() : null;
    wltCaravans = Array.isArray(data) ? data : ((data && (data.caravans || data.data)) || []);
  } catch (_) { return; } // tried again on the next opening
  wltSet('adj-target-caravan', sel => {
    const keep = sel.value;
    sel.innerHTML = '<option value="">انتخاب کاروان...</option>' + wltCaravans.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
    sel.value = keep;
  });
}

// Shows the fields that fit the choice: the person or the caravan, and the banner's tier for درفش
window.wltAdjustSync = function() {
  const caravan = document.getElementById('adj-target-kind')?.value === 'caravan';
  const banner = document.getElementById('adj-asset-type')?.value === 'beyragh';
  wltSet('adj-user-field', el => { el.hidden = caravan; });
  wltSet('adj-caravan-field', el => { el.hidden = !caravan; });
  wltSet('adj-tier-field', el => { el.hidden = !banner; });
  wltSet('adj-target-hint', el => {
    el.textContent = caravan
      ? (banner ? 'درفش به خود کاروان داده می‌شود (مثل رتبه‌بندی چالش فراگروهی). با مقدار منفی فقط درفش‌هایی که دستی داده شده‌اند کم می‌شوند.'
        : 'این مقدار به حساب هر یک از اعضای کاروان واریز (یا از آن کسر) می‌شود.')
      : (banner ? 'درفش با نوع انتخاب‌شده در حساب همین نفر ثبت می‌شود.' : '');
    el.hidden = !el.textContent;
  });
};
// "adjust" from another list: open the dialog with the person picked
window.pickZarikTarget = function(userId) { window.openWalletAdjust(String(userId)); };

window.openWalletPromo = function(userId) {
  const uid = typeof userId === 'string' ? userId : '';
  const form = document.getElementById('zarik-promo-form');
  if (form) form.reset();
  if (!(allUsersList || []).length) loadAllUsersDropdown().then(() => wltPickUser('promo-target-user', uid));
  wltPickUser('promo-target-user', uid);
  wltShowModal('wlt-promo-modal');
};

window.openWalletRule = function(key) {
  const form = document.getElementById('reward-rules-form');
  if (form) form.reset();
  const r = typeof key === 'string' && (window.wltRules || []).find(x => x.key === key);
  wltSet('rule-key', el => { el.value = r ? r.key : ''; });
  wltSet('rule-min', el => { el.value = r ? r.min : ''; });
  wltSet('rule-max', el => { el.value = r ? r.max : ''; });
  wltSet('wlt-rule-title', el => { el.textContent = r ? 'ویرایش قانون پاداش' : 'قانون پاداش جدید'; });
  wltShowModal('wlt-rule-modal');
};

// After a balance changed: totals, ledger, league and the open wallet
function wltAfterBalanceChange() {
  loadLedger();
  loadZarikAnalytics();
  loadAssetLeaderboard();
  loadAllUsersDropdown();
  if (typeof window.urpRefresh === 'function') window.urpRefresh();
}
window.wltAfterBalanceChange = wltAfterBalanceChange;

// The dialog offers an asset type and a recipient. For one person, Zarik goes through rewards/adjust (keeps the
// ledger category) and کلاف / قالیچه through students/:id/adjust-balance; a درفش of a tier, and anything for a
// whole caravan, through rewards/assets/grant.
async function handleZarikAdjustment(e) {
  e.preventDefault();
  const toCaravan = document.getElementById('adj-target-kind')?.value === 'caravan';
  const userId = document.getElementById('zarik-target-user').value;
  const caravanId = document.getElementById('adj-target-caravan')?.value || '';
  const assetType = document.getElementById('adj-asset-type')?.value || 'zarik';
  const tier = document.getElementById('adj-banner-tier')?.value || '';
  const amount = parseInt(document.getElementById('zarik-amount').value, 10);
  const category = document.getElementById('zarik-category').value;
  const reason = document.getElementById('zarik-reason').value;
  if (toCaravan ? !caravanId : !userId) return showToast(toCaravan ? 'کاروان را انتخاب کنید' : 'کاربر را انتخاب کنید', 'error');
  if (!amount) return showToast('مقدار تراکنش را وارد کنید', 'error');

  try {
    const res = (toCaravan || assetType === 'beyragh')
      ? await request('/api/v1/admin/rewards/assets/grant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target: toCaravan ? 'caravan' : 'user', userId, caravanId, assetType, tier, amount, category, reason })
        })
      : assetType === 'zarik'
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
    if (!res.ok) return showToast(data.error || 'خطا در تغییر موجودی', 'error');
    showToast(data.message || 'تغییر موجودی با موفقیت اعمال شد', 'success');
    NopaActions.hide('wlt-adjust-modal');
    wltAfterBalanceChange();
  } catch (err) {
    console.error(err);
    showToast('خطای شبکه', 'error');
  }
}

async function handleRewardRuleUpsert(e) {
  e.preventDefault();
  const key = document.getElementById('rule-key').value.trim();
  const min = parseInt(document.getElementById('rule-min').value, 10);
  const max = parseInt(document.getElementById('rule-max').value, 10);
  if (min > max) return showToast('حداقل نمی‌تواند از حداکثر بیشتر باشد', 'error');
  try {
    const res = await request('/api/v1/admin/rewards/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, min, max })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return showToast(data.error || 'خطا در ذخیره قانون', 'error');
    showToast('قانون ذخیره شد', 'success');
    NopaActions.hide('wlt-rule-modal');
    loadRewardRules();
  } catch (err) { console.error(err); }
}

function exportCurrentLeague(format) {
  document.querySelectorAll('.dropdown-wrapper.open').forEach(el => el.classList.remove('open'));
  return window.exportData(currentLeagueTab === 'caravans' ? 'league_caravans' : 'league_individuals', format || 'excel');
}
window.exportCurrentLeague = exportCurrentLeague;

// The tab starts in its loading state until the first fetch finishes
window.wltSetLoading(true);
