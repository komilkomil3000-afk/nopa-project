// «آمار» tab (#stats-tab): every usage number of the app, filtered by period, caravan, role and station.
// GET /api/v1/admin/analytics/stats/overview fills the tiles; the main chart is a NopaActivity card
// (js/ui/activity-chart.js) and the lists are NopaBars.rank (js/ui/bars.js). The router calls window.loadStatsPage().
(function () {
  const $ = id => document.getElementById(id);
  const faNum = n => Number(n || 0).toLocaleString('fa-IR');
  const st = { range: 'week', caravanId: '', role: '', stationId: '', caravanBy: 'appSeconds', peopleBy: 'appSeconds', data: null, seq: 0 };

  const KPIS = [
    // each tile in one of the app's colours (css/dashboard.css .kpi--*)
    ['appSeconds', 'زمان حضور در اپ', 'fa-mobile-screen', 'seconds', 'kpi--brand'],
    ['videoSeconds', 'زمان تماشای فیلم‌ها', 'fa-circle-play', 'seconds', 'kpi--pink'],
    ['opens', 'تعداد ورود به اپ', 'fa-right-to-bracket', 'count', 'kpi--blue'],
    ['activeUsers', 'کاربران فعال', 'fa-users', 'count', 'kpi--emerald'],
    ['onlineNow', 'آنلاین همین الان', 'fa-signal', 'count', 'kpi--sky'],
    ['messages', 'پیام‌های چت', 'fa-comments', 'count', 'kpi--purple'],
    ['challenges', 'ارسال پاسخ چالش', 'fa-trophy', 'count', 'kpi--orange'],
    ['quizzes', 'آزمون‌های داده‌شده', 'fa-spell-check', 'count', 'kpi--gold'],
  ];
  const CARAVAN_BY = [['appSeconds', 'حضور در اپ', 'seconds'], ['videoSeconds', 'تماشای فیلم', 'seconds'], ['activeMembers', 'اعضای فعال', 'count']];
  const PEOPLE_BY = [['appSeconds', 'حضور در اپ', 'seconds'], ['videoSeconds', 'تماشای فیلم', 'seconds'], ['opens', 'ورود به اپ', 'count']];

  const chips = (list, current, attr) => list.map(([k, l]) =>
    `<button type="button" class="chm-chip${k === current ? ' is-active' : ''}" ${attr}="${k}" aria-pressed="${k === current}">${l}</button>`).join('');

  function kpis(totals) {
    $('sts-kpis').innerHTML = KPIS.map(([k, label, icon, unit, cls]) => `
      <article class="tile kpi ${cls}${totals ? '' : ' is-loading'}" data-anim-key="sk:${k}">
        <div class="kpi-head"><span>${label}</span><i class="fa-solid ${icon}"></i></div>
        <div class="kpi-value">${totals ? esc(NopaBars.fmt(totals[k], unit)) : '—'}</div>
        <div class="kpi-sub">${esc(st.data ? st.data.rangeLabel : '')}${k === 'activeUsers' && totals ? ` · از ${faNum(totals.people)} نفر` : ''}</div>
      </article>`).join('');
  }

  const skel = '<div class="lst-skel-lines" aria-hidden="true">' + '<span class="lst-skel-row"></span>'.repeat(5) + '</div>';

  function paint() {
    const d = st.data;
    kpis(d && d.totals);
    const set = (id, html) => { const el = $(id); if (el) el.innerHTML = html; };
    if (!d) { ['sts-hours', 'sts-roles', 'sts-caravans', 'sts-stations', 'sts-classes', 'sts-people'].forEach(id => set(id, skel)); return; }

    const nowHour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tehran', hour: 'numeric', hourCycle: 'h23' }).format(new Date())) % 24;
    set('sts-hours', NopaBars.columns(d.hours.map((v, h) => ({ key: String(h), label: faNum(h), title: `ساعت ${faNum(h)} تا ${faNum(h + 1)}`, value: v, current: st.range === 'today' && h === nowHour })), { unit: 'seconds', label: 'حضور در اپ به تفکیک ساعت' }));
    set('sts-roles', NopaBars.rank(d.roles.map(r => ({ key: r.role, label: r.label, value: r.appSeconds, sub: `${faNum(r.people)} نفر فعال · تماشای فیلم ${nopaDuration(r.videoSeconds)}` })), { unit: 'seconds', empty: 'در این بازه فعالیتی ثبت نشده است.' }));

    const [cKey, , cUnit] = CARAVAN_BY.find(x => x[0] === st.caravanBy);
    set('sts-caravans-by', chips(CARAVAN_BY, st.caravanBy, 'data-sts-caravan-by'));
    set('sts-caravans', NopaBars.rank(d.caravans.slice().sort((a, b) => b[cKey] - a[cKey]).slice(0, 15).map(c => ({
      key: c.id, label: c.name, value: c[cKey],
      avatarHtml: crvAvatar(c.coverImageUrl, c.name, 'nbr-rank-avatar'),
      sub: `${faNum(c.activeMembers)} از ${faNum(c.members)} عضو فعال · حضور ${nopaDuration(c.appSeconds)} · فیلم ${nopaDuration(c.videoSeconds)}`,
    })), { unit: cUnit, click: 'stsPickCaravan', empty: 'کاروانی پیدا نشد.' }));

    set('sts-stations', NopaBars.rank(d.stations.map(s => ({
      key: s.id, label: s.title, value: s.videoSeconds, sub: `${faNum(s.viewers)} بیننده · ${faNum(s.classes)} کلاس دیده‌شده`,
    })), { unit: 'seconds', click: 'stsPickStation', empty: 'در این بازه فیلمی دیده نشده است.' }));
    set('sts-classes', NopaBars.rank(d.classes.map(c => ({
      key: c.id, label: c.title, value: c.videoSeconds, sub: [c.station, c.category, `${faNum(c.viewers)} بیننده`].filter(Boolean).join(' · '),
    })), { unit: 'seconds', empty: 'در این بازه فیلمی دیده نشده است.' }));

    const [pKey, , pUnit] = PEOPLE_BY.find(x => x[0] === st.peopleBy);
    set('sts-people-by', chips(PEOPLE_BY, st.peopleBy, 'data-sts-people-by'));
    set('sts-people', NopaBars.rank(d.topUsers.slice().sort((a, b) => b[pKey] - a[pKey]).filter(u => u[pKey] > 0).slice(0, 15).map(u => ({
      key: u.id, label: u.name, value: u[pKey],
      avatarHtml: crvAvatar(u.avatarUrl, u.name, 'nbr-rank-avatar'),
      sub: [u.caravanName ? `کاروان ${u.caravanName}` : '', `حضور ${nopaDuration(u.appSeconds)}`, `فیلم ${nopaDuration(u.videoSeconds)}`, `${faNum(u.opens)} ورود`].filter(Boolean).join(' · '),
    })), { unit: pUnit, click: 'viewUserDetails', empty: 'در این بازه فعالیتی ثبت نشده است.' }));
  }

  function paintFilters() {
    const d = st.data;
    $('sts-ranges').querySelectorAll('[data-sts-range]').forEach(b => {
      const on = b.dataset.stsRange === st.range;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', String(on));
    });
    const month = $('sts-month');
    if (d && d.months && month.options.length <= 1) {
      month.innerHTML = '<option value="">ماه‌های قبل</option>' + d.months.map(m => `<option value="${esc(m.key)}">${esc(m.label)}</option>`).join('');
    }
    month.value = /^month:/.test(st.range) ? st.range : '';
    month.parentElement.classList.toggle('is-active', /^month:/.test(st.range));
    const fill = (id, list, first, label) => {
      const el = $(id);
      if (!list || el.dataset.filled) return;
      el.innerHTML = `<option value="">${first}</option>` + list.map(x => `<option value="${esc(x.id)}">${esc(x[label])}</option>`).join('');
      el.dataset.filled = '1';
    };
    if (d && d.options) {
      fill('sts-caravan', d.options.caravans, 'همه کاروان‌ها', 'name');
      fill('sts-station', d.options.stations, 'همه منزلگاه‌ها', 'title');
    }
    $('sts-caravan').value = st.caravanId;
    $('sts-role').value = st.role;
    $('sts-station').value = st.stationId;
  }

  function mainChart() {
    NopaActivity.render($('sts-main-chart'), 'sts:main', {
      title: 'روند در بازه انتخاب‌شده',
      params: { caravanId: st.caravanId, role: st.role, stationId: st.stationId },
      metrics: ['app', 'video', 'opens', 'active', 'messages', 'challenges', 'quizzes'],
      range: st.range,
    });
  }

  async function load() {
    const seq = ++st.seq;
    document.querySelectorAll('#stats-tab .sts-tile').forEach(t => t.classList.add('is-loading'));
    if (!st.data) paint();
    mainChart();
    try {
      const q = new URLSearchParams({ range: st.range });
      if (st.caravanId) q.set('caravanId', st.caravanId);
      if (st.role) q.set('role', st.role);
      const data = await NopaApi.json(`/api/v1/admin/analytics/stats/overview?${q}`, { silent: true });
      if (seq !== st.seq) return;
      st.data = data;
    } catch (err) {
      if (seq !== st.seq) return;
      if (err.message !== 'Unauthorized') showToast(err.status === 403 ? 'دسترسی به آمار برای شما فعال نیست.' : 'دریافت آمار ممکن نشد.', 'error');
    }
    document.querySelectorAll('#stats-tab .sts-tile').forEach(t => t.classList.remove('is-loading'));
    paintFilters();
    const area = $('sts-bento');
    if (window.NopaFlip && area && st.data) NopaFlip.render(area, paint); else paint();
  }

  window.stsPickCaravan = function(id) {
    st.caravanId = String(id);
    load();
    $('stats-tab').scrollIntoView({ block: 'start', behavior: NopaMotion.scrollBehavior() });
  };
  window.stsPickStation = function(id) {
    st.stationId = String(id);
    paintFilters();
    NopaActivity.setMetric('sts:main', 'video');
    mainChart();
    $('sts-main-chart').scrollIntoView({ block: 'center', behavior: NopaMotion.scrollBehavior() });
  };

  function init() {
    const tab = $('stats-tab');
    if (!tab) return;
    tab.addEventListener('click', e => {
      const r = e.target.closest('[data-sts-range]');
      if (r) { if (st.range !== r.dataset.stsRange) { st.range = r.dataset.stsRange; load(); } return; }
      const c = e.target.closest('[data-sts-caravan-by]');
      if (c) { st.caravanBy = c.dataset.stsCaravanBy; paint(); return; }
      const p = e.target.closest('[data-sts-people-by]');
      if (p) { st.peopleBy = p.dataset.stsPeopleBy; paint(); return; }
      if (e.target.closest('#sts-refresh')) {
        NopaActivity.refresh('sts:main');
        load();
      }
      if (e.target.closest('#sts-clear')) {
        st.caravanId = ''; st.role = ''; st.stationId = '';
        load();
      }
    });
    tab.addEventListener('change', e => {
      const t = e.target;
      if (t.id === 'sts-month') { if (t.value) { st.range = t.value; load(); } }
      else if (t.id === 'sts-caravan') { st.caravanId = t.value; load(); }
      else if (t.id === 'sts-role') { st.role = t.value; load(); }
      else if (t.id === 'sts-station') { st.stationId = t.value; mainChart(); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.loadStatsPage = load;
})();
