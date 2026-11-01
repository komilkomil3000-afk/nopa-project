// Bento dashboard (#dashboard-tab). Loaded before app.js; the router calls window.loadDashboard().
// Every tile loads on its own (one slow or forbidden endpoint never blanks the others):
//   - a tile whose section the user was not granted is never shown (and its endpoint never called)
//   - a 403 hides the tile; any other failure shows an inline error in that tile
// Only real data is shown: the time-series in /admin/analytics are placeholders on the server,
// so they are not used here.
(function () {
  const $ = id => document.getElementById(id);
  const fa = n => Number(n || 0).toLocaleString('fa-IR');
  const compact = n => (Math.abs(n) >= 1e6
    ? new Intl.NumberFormat('fa-IR', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
    : fa(n));

  const ACTIONS = {
    'new-user': { tab: 'users-tab', open: () => window.openUserModal && window.openUserModal() },
    'new-station': { tab: 'lms-tab', open: () => window.openCreateStationModal && window.openCreateStationModal() },
    'new-challenge': { tab: 'submissions-tab', open: () => window.openCreateChallengeModal && window.openCreateChallengeModal() },
    'new-news': { tab: 'news-tab', open: () => window.openCreateNewsModal && window.openCreateNewsModal() },
  };

  let chart = null;
  let chartData = null;

  // ---- visibility ---------------------------------------------------------------------------
  const allowed = section => {
    if (!window.NopaNav) return true;
    if (section === '__super') return NopaNav.sectionAllowed(null);
    return NopaNav.sectionAllowed(section);
  };
  const tile = name => document.querySelector(`#dash-bento [data-tile="${name}"]`);
  const showTile = (name, on) => { const t = tile(name); if (t) t.hidden = !on; };

  function applyVisibility() {
    document.querySelectorAll('#dash-bento [data-tile][data-section]').forEach(t => { t.hidden = !allowed(t.dataset.section); });
    const anyAttention = window.NopaAttention && NopaAttention.SOURCES.some(s => allowed(s.section));
    showTile('attention', !!anyAttention);
    let anyAction = false;
    document.querySelectorAll('#dash-actions [data-action]').forEach(b => {
      const on = allowed(b.dataset.section);
      b.hidden = !on;
      anyAction = anyAction || on;
    });
    showTile('actions', anyAction);
  }

  // ---- helpers ------------------------------------------------------------------------------
  async function get(url) {
    const res = await request(url, { silent: true });
    if (res.status === 403) { const e = new Error('forbidden'); e.forbidden = true; throw e; }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  function setLoading(name, on) {
    const t = tile(name);
    if (t) t.classList.toggle('is-loading', on);
  }

  function fail(name, err, listId) {
    if (err && err.message === 'Unauthorized') return; // session expired: request() already handled it
    if (err && err.forbidden) { showTile(name, false); return; }
    console.error(`dashboard ${name}:`, err);
    const t = tile(name);
    if (!t) return;
    if (listId) $(listId).innerHTML = '<li class="dash-empty is-error">دریافت اطلاعات ممکن نشد</li>';
    else t.querySelectorAll('.kpi-value').forEach(v => { v.textContent = '—'; });
  }

  // run a tile loader only when the tile is visible
  async function run(name, fn) {
    const t = tile(name);
    if (!t || t.hidden) return;
    setLoading(name, true);
    try { await fn(); } finally { setLoading(name, false); }
  }

  // ---- tiles --------------------------------------------------------------------------------
  const loadUsers = () => run('users', async () => {
    try {
      const m = await get('/api/v1/admin/users/metrics');
      $('kpi-users').textContent = fa(m.total);
      $('kpi-users-sub').textContent = `${fa(m.active)} نفر فعال در ۳۰ روز اخیر`;
    } catch (e) { fail('users', e); }
  });

  async function loadRewards() {
    if (tile('zarik').hidden && tile('distribution').hidden && tile('earners').hidden) return;
    ['zarik', 'distribution', 'earners'].forEach(n => setLoading(n, true));
    try {
      const d = await get('/api/v1/admin/rewards/analytics');
      $('kpi-zarik').textContent = compact(d.circulation);
      $('kpi-zarik').title = fa(d.circulation);
      chartData = (d.distributions || []).filter(x => x.totalAmount).map(x => ({ label: x.category || 'سایر', value: Math.abs(x.totalAmount) }));
      renderChart();
      const top = Array.isArray(d.topWealthy) ? d.topWealthy : [];
      $('dash-earners').innerHTML = top.length
        ? top.map((u, i) => `<li><span class="dash-rank">${fa(i + 1)}</span><span class="dash-name">${esc(u.name || 'بدون نام')}</span><b>${compact(u.zarikBalance)}</b></li>`).join('')
        : '<li class="dash-empty">هنوز کاربری زریک ندارد</li>';
    } catch (e) {
      fail('zarik', e); fail('distribution', e); fail('earners', e, 'dash-earners');
    } finally {
      ['zarik', 'distribution', 'earners'].forEach(n => setLoading(n, false));
    }
  }

  function renderChart() {
    const canvas = $('dash-zarik-chart');
    if (!canvas || !window.Chart || !chartData) return;
    if (chart) { chart.destroy(); chart = null; }
    const empty = chartData.length === 0;
    $('dash-zarik-empty').hidden = !empty;
    canvas.hidden = empty;
    if (empty) return;
    const palette = ['--primary-rgb', '--accent-rgb', '--success-rgb', '--info-rgb', '--danger-rgb', '--muted-rgb'];
    const data = chartData.slice().sort((a, b) => b.value - a.value);
    chart = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: data.map(x => x.label),
        datasets: [{
          data: data.map(x => x.value),
          backgroundColor: data.map((_, i) => NopaTheme.rgba(palette[i % palette.length], 0.85)),
          borderColor: NopaTheme.cssVar('--surface'),
          borderWidth: 3,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '64%',
        // narrow tile (phones): legend under the ring instead of squeezing it
        onResize: (c, size) => {
          const pos = size.width < 420 ? 'bottom' : 'right';
          if (c.options.plugins.legend.position !== pos) { c.options.plugins.legend.position = pos; c.update('none'); }
        },
        plugins: {
          legend: { position: canvas.parentElement.clientWidth < 420 ? 'bottom' : 'right', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, padding: 12 } },
          tooltip: { callbacks: { label: c => ` ${c.label}: ${fa(c.raw)}` } },
        },
      },
    });
  }

  const loadPerformance = () => {
    const names = ['completion', 'rating'].filter(n => !tile(n).hidden);
    if (!names.length) return;
    names.forEach(n => setLoading(n, true));
    const tf = $('dash-timeframe').value;
    return get('/api/v1/admin/analytics' + (tf && tf !== 'all' ? `?timeframe=${encodeURIComponent(tf)}` : ''))
      .then(d => {
        const eng = d.engagement || {};
        const ev = d.evaluation || {};
        const subs = Number(eng.totalSubmissions || 0);
        $('kpi-completion').textContent = subs ? fa(parseFloat(eng.completionRate)) + '٪' : '—';
        $('kpi-completion-sub').textContent = subs
          ? `${fa(subs)} تکلیف · میانگین نمره ${fa(parseFloat(eng.avgQuizScore))}`
          : 'تکلیفی در این بازه ارسال نشده';
        const ratings = Number(ev.totalRatings || 0);
        $('kpi-rating').textContent = ratings ? `${fa(parseFloat(ev.avgMentorRating))} از ۵` : '—';
        $('kpi-rating-sub').textContent = ratings ? `${fa(ratings)} ارزیابی در این بازه` : 'ارزیابی‌ای در این بازه ثبت نشده';
      })
      .catch(e => names.forEach(n => fail(n, e)))
      .finally(() => names.forEach(n => setLoading(n, false)));
  };

  const loadAttention = () => run('attention', async () => {
    const items = await NopaAttention.fetch(allowed);
    const total = items.reduce((s, i) => s + (i.count || 0), 0);
    $('dash-attention-total').textContent = total ? fa(total) : '';
    $('dash-attention-total').hidden = !total;
    $('dash-attention').innerHTML = items.map(i => `
      <li><a href="#" data-go="${esc(i.tab)}" class="dash-attention-item${i.count ? ' has-items' : ''}">
        <span class="dash-attention-icon"><i class="${esc(i.icon)}"></i></span>
        <span class="dash-attention-label">${esc(i.label)}</span>
        <b>${i.count === null ? '—' : fa(i.count)}</b>
        <i class="fa-solid fa-chevron-left dash-attention-go"></i>
      </a></li>`).join('') + (total === 0 && items.every(i => i.count !== null)
        ? '<li class="dash-all-clear"><i class="fa-solid fa-circle-check"></i> همه‌چیز رسیدگی شده است</li>' : '');
  });

  const loadLeague = () => run('league', async () => {
    try {
      const list = await get('/api/v1/admin/caravans/league?sortBy=progress');
      const top = (Array.isArray(list) ? list : []).slice(0, 5);
      $('dash-league').innerHTML = top.length
        ? top.map((c, i) => {
            const pct = Math.max(0, Math.min(100, Number(c.overallProgress) || 0));
            return `<li>
              <span class="dash-rank${i < 3 ? ' is-top' : ''}">${fa(i + 1)}</span>
              <div class="dash-league-body">
                <div class="dash-league-row"><span class="dash-name">${esc(c.name)}</span><b>${fa(pct)}٪</b></div>
                <div class="dash-progress"><i style="width:${pct}%"></i></div>
                <small>${esc(c.mentorName || 'بدون راهبر')} · ${fa(c.memberCount)} عضو</small>
              </div></li>`;
          }).join('')
        : '<li class="dash-empty">هنوز کاروانی ثبت نشده است</li>';
    } catch (e) { fail('league', e, 'dash-league'); }
  });

  const relTime = (() => {
    const rtf = window.Intl && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat('fa', { numeric: 'auto' }) : null;
    return value => {
      const t = new Date(value).getTime();
      if (!t) return '';
      const sec = Math.round((t - Date.now()) / 1000);
      if (!rtf) return new Date(t).toLocaleString('fa-IR');
      const abs = Math.abs(sec);
      if (abs < 60) return rtf.format(sec, 'second');
      if (abs < 3600) return rtf.format(Math.round(sec / 60), 'minute');
      if (abs < 86400) return rtf.format(Math.round(sec / 3600), 'hour');
      return rtf.format(Math.round(sec / 86400), 'day');
    };
  })();

  // Persian names for audit action codes, taken from the audit tab's own filter (one source of truth)
  function actionLabel(code) {
    const opt = Array.from(document.querySelectorAll('#audit-action-filter option')).find(o => o.value && o.value === code);
    return opt ? opt.textContent.trim() : code;
  }

  const loadAudit = () => run('audit', async () => {
    try {
      const d = await get('/api/v1/admin/audit/logs?limit=6');
      const logs = (Array.isArray(d) ? d : (d.logs || [])).slice(0, 6);
      $('dash-audit').innerHTML = logs.length
        ? logs.map(l => {
            const label = actionLabel(l.action || '');
            return `<li>
            <span class="dash-audit-dot"></span>
            <div><span class="dash-name">${esc(l.actorName || 'سیستم')}</span> <span class="dash-audit-action${label === l.action ? ' is-code' : ''}">${esc(label)}</span>
            <small>${esc(l.targetEntity || '')}${l.targetEntity ? ' · ' : ''}${esc(relTime(l.createdAt))}</small></div></li>`;
          }).join('')
        : '<li class="dash-empty">رویدادی ثبت نشده است</li>';
    } catch (e) { fail('audit', e, 'dash-audit'); }
  });

  // ---- public -------------------------------------------------------------------------------
  function header() {
    const user = window.NopaAuth ? NopaAuth.getUser() : {};
    const h = new Date().getHours();
    const part = h < 12 ? 'صبح بخیر' : h < 17 ? 'روز بخیر' : 'عصر بخیر';
    $('dash-greeting').textContent = `${part}${user.name ? '، ' + user.name : ''}`;
    $('dash-date').textContent = new Date().toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  async function loadDashboard() {
    header();
    applyVisibility();
    await Promise.all([loadUsers(), loadRewards(), loadPerformance(), loadAttention(), loadLeague(), loadAudit()]);
  }

  function init() {
    const section = $('dashboard-tab');
    if (!section) return;
    $('dash-timeframe').addEventListener('change', loadPerformance);
    $('btn-dash-refresh').addEventListener('click', () => {
      const icon = $('btn-dash-refresh').querySelector('i');
      icon.classList.add('fa-spin');
      Promise.resolve(loadDashboard()).finally(() => icon.classList.remove('fa-spin'));
      if (window.NopaNav) NopaNav.refreshAttention();
    });
    section.addEventListener('click', e => {
      const go = e.target.closest('[data-go]');
      if (go) {
        if (e.ctrlKey || e.metaKey) return;
        e.preventDefault();
        NopaRouter.switchTab(go.dataset.go, true);
        return;
      }
      const btn = e.target.closest('[data-action]');
      if (btn && ACTIONS[btn.dataset.action]) {
        const a = ACTIONS[btn.dataset.action];
        NopaRouter.switchTab(a.tab, true);
        requestAnimationFrame(() => a.open());
      }
    });
    // sub-admin grants arrive after the first render; theme changes need new chart colours
    window.addEventListener('nopa:accesschange', () => {
      if (typeof activeTab !== 'undefined' && activeTab === 'dashboard-tab') loadDashboard();
    });
    window.addEventListener('nopa:themechange', () => { if (chart) renderChart(); });
    // The dashboard greets the user itself; the generic page title above it would repeat "داشبورد"
    window.addEventListener('nopa:tabchange', e => {
      const ph = document.querySelector('#main-content > .page-header');
      if (ph) ph.hidden = e.detail.tabId === 'dashboard-tab';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.loadDashboard = loadDashboard;
  window.NopaDashboard = { load: loadDashboard };
})();
