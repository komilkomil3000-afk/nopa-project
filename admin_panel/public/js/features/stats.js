// «آمار» tab (#stats-tab): every usage number of the app, filtered by period, caravan, role and station.
// GET /api/v1/admin/analytics/stats/overview fills the tiles; the main chart is a NopaActivity card
// (js/ui/activity-chart.js) and the lists are NopaBars.rank (js/ui/bars.js). The router calls window.loadStatsPage().
// While the tab is on screen everything is asked again every 3 seconds and redrawn quietly (no loading state).
// Clicking a number tile shows its chart in the main chart.
(function () {
  const $ = id => document.getElementById(id);
  const faNum = n => Number(n || 0).toLocaleString('fa-IR');
  const LIVE_MS = 3000;
  const st = {
    range: 'week', caravanId: '', role: '', stationId: '',
    caravanBy: 'appSeconds', peopleBy: 'appSeconds', hoursBy: 'seconds', tableBy: 'appSeconds',
    kpi: 'appSeconds', data: null, seq: 0, timer: null, busy: false,
  };

  // [key in totals, label, icon, unit, colour (css/dashboard.css .kpi--*), metric of the main chart]
  const KPIS = [
    ['appSeconds', 'زمان حضور در اپ', 'fa-mobile-screen', 'seconds', 'kpi--brand', 'app'],
    ['chatSeconds', 'حضور در فضای چت', 'fa-comments', 'seconds', 'kpi--purple', 'chat'],
    ['stationSeconds', 'حضور در منزلگاه‌ها', 'fa-map-location-dot', 'seconds', 'kpi--emerald', 'station'],
    ['videoSeconds', 'زمان تماشای فیلم‌ها', 'fa-circle-play', 'seconds', 'kpi--pink', 'video'],
    ['otherSeconds', 'زمان در بقیه بخش‌ها', 'fa-shapes', 'seconds', 'kpi--blue', 'other'],
    ['onlineNow', 'آنلاین همین الان', 'fa-signal', 'count', 'kpi--sky', 'active'],
    ['activeUsers', 'کاربران فعال', 'fa-users', 'count', 'kpi--emerald', 'active'],
    ['opens', 'دفعات باز کردن اپ', 'fa-door-open', 'count', 'kpi--orange', 'opens'],
    ['logins', 'تعداد لاگین در اپ', 'fa-right-to-bracket', 'count', 'kpi--gold', 'logins'],
    ['messages', 'پیام‌های چت', 'fa-comment-dots', 'count', 'kpi--purple', 'messages'],
    ['challenges', 'ارسال پاسخ چالش', 'fa-trophy', 'count', 'kpi--orange', 'challenges'],
    ['quizzes', 'آزمون‌های داده‌شده', 'fa-spell-check', 'count', 'kpi--gold', 'quizzes'],
    ['avgSeconds', 'میانگین حضور هر کاربر فعال', 'fa-user-clock', 'seconds', 'kpi--emerald', 'app'],
  ];
  const KPI_NOTE = {
    activeUsers: 'کسانی که در این بازه دست‌کم چند ثانیه اپ را باز داشته‌اند',
    onlineNow: 'اپ همین حالا روی گوشی‌شان باز است',
    logins: 'ورود به حساب در اپ (بدون پنل مدیریت)',
    opens: 'اجرای اپ یا برگشتن به آن پس از یک دقیقه',
    videoSeconds: 'پخش فیلم جلسات و نگارستان منزلگاه‌ها، با همه تکرارها',
    stationSeconds: 'مدت باز بودن صفحه‌های منزلگاه، جدا از زمان پخش فیلم',
    otherSeconds: 'حضور در اپ منهای چت و منزلگاه‌ها',
  };
  const CARAVAN_BY = [['appSeconds', 'حضور در اپ', 'seconds'], ['videoSeconds', 'تماشای فیلم', 'seconds'], ['activeMembers', 'اعضای فعال', 'count']];
  const PEOPLE_BY = [['appSeconds', 'حضور در اپ', 'seconds'], ['chatSeconds', 'چت', 'seconds'], ['stationSeconds', 'منزلگاه‌ها', 'seconds'], ['videoSeconds', 'فیلم', 'seconds'], ['otherSeconds', 'بقیه بخش‌ها', 'seconds'], ['opens', 'باز کردن اپ', 'count'], ['logins', 'لاگین', 'count'], ['messages', 'پیام', 'count']];
  const HOURS_BY = [['seconds', 'زمان حضور'], ['users', 'تعداد افراد']];
  const TABLE_COLS = [
    ['appSeconds', 'حضور در اپ', 'seconds'], ['chatSeconds', 'چت', 'seconds'], ['stationSeconds', 'منزلگاه‌ها', 'seconds'],
    ['videoSeconds', 'فیلم', 'seconds'], ['otherSeconds', 'بقیه', 'seconds'], ['opens', 'باز کردن', 'count'], ['logins', 'لاگین', 'count'], ['messages', 'پیام', 'count'],
  ];
  // the parts of the app (services/userLog.ts APP_AREAS on the server)
  const AREA = {
    home: ['در خانه', 'fa-house', 'is-other'],
    academy: ['در آموزگاه', 'fa-graduation-cap', 'is-other'],
    station: ['در منزلگاه‌ها', 'fa-map-location-dot', 'is-video'],
    challenges: ['در چالش‌ها', 'fa-trophy', 'is-other'],
    market: ['در بازار', 'fa-store', 'is-other'],
    profile: ['در پروفایل', 'fa-id-badge', 'is-other'],
    chat: ['در فضای چت', 'fa-comments', 'is-chat'],
    other: ['در بخش‌های دیگر اپ', 'fa-shapes', 'is-other'],
  };
  const AREA_NAMES = { home: 'خانه', academy: 'آموزگاه', station: 'منزلگاه‌ها', challenges: 'چالش‌ها', market: 'بازار', profile: 'پروفایل', chat: 'چت', other: 'سایر' };
  const EVENT = {
    home: ['به خانه رفت', 'fa-house', 'is-other'],
    academy: ['وارد آموزگاه شد', 'fa-graduation-cap', 'is-other'],
    station: ['وارد منزلگاه شد', 'fa-map-location-dot', 'is-video'],
    challenges: ['وارد چالش‌ها شد', 'fa-trophy', 'is-other'],
    market: ['وارد بازار شد', 'fa-store', 'is-other'],
    profile: ['وارد پروفایل شد', 'fa-id-badge', 'is-other'],
    open: ['اپ را باز کرد', 'fa-door-open', 'is-open'],
    login: ['وارد حساب شد (لاگین)', 'fa-right-to-bracket', 'is-login'],
    logout: ['از حساب خارج شد', 'fa-right-from-bracket', 'is-away'],
    away: ['از اپ بیرون رفت', 'fa-moon', 'is-away'],
    chat: ['وارد فضای چت شد', 'fa-comments', 'is-chat'],
    video: ['شروع به تماشای فیلم کرد', 'fa-circle-play', 'is-video'],
    other: ['به بخش‌های دیگر اپ رفت', 'fa-shapes', 'is-other'],
  };

  const chips = (list, current, attr) => list.map(([k, l]) =>
    `<button type="button" class="chm-chip${k === current ? ' is-active' : ''}" ${attr}="${k}" aria-pressed="${k === current}">${l}</button>`).join('');

  /** seconds -> { h, rest: "۵ دقیقه و ۱۲ ثانیه" } */
  function hms(sec) {
    const s = Math.max(0, Math.round(Number(sec) || 0));
    return { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
  }
  const clock = sec => {
    const t = hms(sec);
    const two = n => String(n).padStart(2, '0');
    return (t.h ? `${t.h}:${two(t.m)}:${two(t.s)}` : `${t.m}:${two(t.s)}`).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  };
  const short = sec => {
    const t = hms(sec);
    if (t.h) return `${faNum(t.h)} ساعت و ${faNum(t.m)} دقیقه`;
    if (t.m) return `${faNum(t.m)} دقیقه و ${faNum(t.s)} ثانیه`;
    return `${faNum(t.s)} ثانیه`;
  };

  function kpiValue(v, unit) {
    if (unit !== 'seconds') return `<div class="kpi-value">${esc(faNum(v))}</div>`;
    const t = hms(v);
    return `<div class="kpi-value sts-dur"><span>${esc(faNum(t.h))}</span><small>ساعت</small></div>
      <div class="sts-dur-rest">${esc(faNum(t.m))} دقیقه و ${esc(faNum(t.s))} ثانیه</div>`;
  }

  function kpis(totals) {
    const d = st.data;
    set('sts-kpis', KPIS.map(([k, label, icon, unit, cls]) => {
      let sub = esc(d ? d.rangeLabel : '');
      if (totals && k === 'activeUsers') sub += ` · از ${faNum(totals.people)} نفر`;
      if (totals && k === 'onlineNow') sub = d.onlineAreas ? `چت ${faNum(d.onlineAreas.chat)} · منزلگاه ${faNum(d.onlineAreas.station)} · سایر ${faNum(d.onlineAreas.other)} · فیلم ${faNum(d.onlineAreas.video)}` : 'همین الان';
      const val = totals ? (k === 'avgSeconds' ? (totals.activeUsers ? totals.appSeconds / totals.activeUsers : 0) : totals[k]) : 0;
      const on = st.kpi === k;
      return `
      <button type="button" class="tile kpi sts-kpi ${cls}${totals ? '' : ' is-loading'}${on ? ' is-selected' : ''}" data-sts-kpi="${k}" aria-pressed="${on}"
        title="${esc(KPI_NOTE[k] ? `${label}: ${KPI_NOTE[k]}` : `نمودار ${label}`)}">
        <div class="kpi-head"><span>${label}</span><i class="fa-solid ${icon}"></i></div>
        ${totals ? kpiValue(val, unit) : '<div class="kpi-value">—</div>'}
        <div class="kpi-sub">${sub}</div>
      </button>`;
    }).join(''));
  }

  const skel = '<div class="lst-skel-lines" aria-hidden="true">' + '<span class="lst-skel-row"></span>'.repeat(5) + '</div>';
  // drawn again only when the markup changed (the 3-second rounds must not reset scrolling or hover for nothing)
  const drawn = new Map();
  const set = (id, html) => {
    const el = $(id);
    if (!el || (drawn.get(id) === html && el.isConnected && el.childElementCount)) return;
    drawn.set(id, html);
    el.innerHTML = html;
  };
  const avatar = u => crvAvatar(u.avatarUrl, u.name, 'nbr-rank-avatar');

  function hourRange(h) { return `${faNum(h)} تا ${faNum((h + 1) % 24)}`; }

  function paintHours(d) {
    const nowHour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tehran', hour: 'numeric', hourCycle: 'h23' }).format(new Date())) % 24;
    const peaks = d.peakHours || [];
    const medals = ['is-1', 'is-2', 'is-3'];
    const peakHtml = peaks.length ? `<ol class="sts-peaks">${peaks.map((p, i) => `
      <li class="sts-peak ${medals[i]}">
        <span class="sts-peak-rank">${faNum(i + 1)}</span>
        <span class="sts-peak-body"><strong>ساعت ${hourRange(p.hour)}</strong>
          <small>${esc(short(p.seconds))} حضور · ${faNum(p.users)} نفر</small></span>
      </li>`).join('')}</ol>` : '<div class="lsv-col-empty">در این بازه هنوز فعالیتی ثبت نشده است.</div>';
    set('sts-hours-by', chips(HOURS_BY, st.hoursBy, 'data-sts-hours-by'));
    const byUsers = st.hoursBy === 'users';
    const src = byUsers ? (d.hourUsers || []) : d.hours;
    const peakSet = new Set(peaks.map(p => p.hour));
    set('sts-hours', peakHtml + NopaBars.columns(src.map((v, h) => ({
      key: String(h), label: faNum(h), title: `ساعت ${hourRange(h)}${byUsers ? ' (نفر)' : ''}`, value: v,
      current: (st.range === 'today' && h === nowHour) || peakSet.has(h),
    })), { unit: byUsers ? 'count' : 'seconds', label: byUsers ? 'تعداد افراد به تفکیک ساعت' : 'حضور در اپ به تفکیک ساعت' }));
  }

  function paintSplit(t) {
    // chat + station pages + the rest = the time in the app; watching videos is shown on its own (it happens on the station pages)
    const parts = [['chatSeconds', 'فضای چت', 'is-chat'], ['stationSeconds', 'منزلگاه‌ها', 'is-video'], ['otherSeconds', 'بقیه بخش‌ها', 'is-other']];
    const areas = st.data && st.data.areaTotals ? Object.entries(st.data.areaTotals).filter(([k, v]) => v > 0 && k !== 'chat' && k !== 'station').sort((a, b) => b[1] - a[1]) : [];
    const total = Math.max(1, parts.reduce((s, [k]) => s + (t[k] || 0), 0));
    const pct = k => Math.round(((t[k] || 0) / total) * 100);
    set('sts-split', `
      <div class="sts-split-bar" role="img" aria-label="سهم بخش‌های اپ از زمان حضور">
        ${parts.map(([k, , c]) => `<span class="${c}" data-style="width:${(t[k] || 0) / total * 100}%"></span>`).join('')}
      </div>
      <ul class="sts-split-list">
        ${parts.map(([k, l, c]) => `<li class="${c}"><i></i><span>${l}</span><b>${esc(short(t[k]))}</b><em>${faNum(pct(k))}٪</em></li>`).join('')}
      </ul>
      ${areas.length ? `<p class="sts-split-foot">بقیه بخش‌ها: ${areas.map(([k, v]) => `${esc(AREA_NAMES[k] || k)} ${esc(short(v))}`).join(' · ')}</p>` : ''}
      <p class="sts-split-foot">تماشای فیلم (جلسات و نگارستان) ${esc(short(t.videoSeconds))} · چت ${faNum(t.messages)} پیام · ${faNum(t.opens)} بار باز کردن اپ · ${faNum(t.logins)} لاگین</p>`);
  }

  function paintOnline(d) {
    const list = d.online || [];
    set('sts-online-count', faNum(list.length));
    set('sts-online', list.length ? `<ul class="sts-online-list">${list.map(o => {
      const [label, icon, cls] = AREA[o.area] || AREA.other;
      return `<li><button type="button" class="sts-live-row" data-click="viewUserDetails" data-click-args="${esc(JSON.stringify([o.id]))}">
        ${avatar(o)}
        <span class="sts-live-body"><strong>${esc(o.name)}</strong>
          <small class="sts-area ${cls}"><i class="fa-solid ${icon}"></i> ${label} · ${esc(clock(o.areaSeconds))}${o.playing ? ' · <i class="fa-solid fa-circle-play"></i> در حال تماشای فیلم' : ''}</small></span>
        <span class="sts-live-time" title="مدت حضور در اپ از آخرین ورود">${esc(clock(o.sessionSeconds))}</span>
      </button></li>`;
    }).join('')}</ul>` : '<div class="lsv-col-empty">الان کسی در اپ نیست.</div>');
  }

  function paintLog(d) {
    const events = d.events || [];
    const now = new Date(d.serverTime || Date.now()).getTime();
    const ago = iso => {
      const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
      if (s < 60) return `${faNum(s)} ثانیه پیش`;
      if (s < 3600) return `${faNum(Math.floor(s / 60))} دقیقه پیش`;
      return new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
    };
    set('sts-log', events.length ? `<ul class="sts-log">${events.map(e => {
      const [label, icon, cls] = EVENT[e.type] || [e.type, 'fa-circle', ''];
      return `<li class="${cls}"><i class="fa-solid ${icon}"></i>
        <span><button type="button" class="sts-log-name" data-click="viewUserDetails" data-click-args="${esc(JSON.stringify([e.user.id]))}">${esc(e.user.name)}</button> ${label}</span>
        <time>${esc(ago(e.at))}</time></li>`;
    }).join('')}</ul>` : '<div class="lsv-col-empty">از آخرین راه‌اندازی سرور رویدادی ثبت نشده است.</div>');
  }

  function paintTable(d) {
    const [key] = TABLE_COLS.find(c => c[0] === st.tableBy) || TABLE_COLS[0];
    const rows = d.topUsers.slice().sort((a, b) => (b[key] || 0) - (a[key] || 0));
    const online = new Set((d.online || []).map(o => o.id));
    const cell = (v, unit) => unit === 'seconds' ? esc(short(v)) : esc(faNum(v));
    set('sts-table', rows.length ? `<div class="sts-table-wrap"><table class="sts-table">
      <thead><tr><th>نام</th>${TABLE_COLS.map(([k, l]) => `<th><button type="button" data-sts-table-by="${k}" class="${k === key ? 'is-active' : ''}" aria-pressed="${k === key}">${l}${k === key ? ' <i class="fa-solid fa-arrow-down-wide-short"></i>' : ''}</button></th>`).join('')}</tr></thead>
      <tbody>${rows.map(u => `<tr>
        <td><button type="button" class="sts-table-name" data-click="viewUserDetails" data-click-args="${esc(JSON.stringify([u.id]))}">
          ${avatar(u)}<span><strong>${esc(u.name)}</strong>${u.caravanName ? `<small>${esc(u.caravanName)}</small>` : ''}</span>
          ${online.has(u.id) ? '<i class="sts-dot" title="آنلاین"></i>' : ''}</button></td>
        ${TABLE_COLS.map(([k, , unit]) => `<td class="${k === key ? 'is-active' : ''}">${cell(u[k], unit)}</td>`).join('')}
      </tr>`).join('')}</tbody></table></div>` : '<div class="lsv-col-empty">در این بازه فعالیتی ثبت نشده است.</div>');
  }

  function paint() {
    const d = st.data;
    kpis(d && d.totals);
    if (!d) { ['sts-hours', 'sts-roles', 'sts-caravans', 'sts-stations', 'sts-classes', 'sts-people', 'sts-online', 'sts-log', 'sts-split', 'sts-table'].forEach(id => set(id, skel)); return; }

    paintHours(d);
    paintSplit(d.totals);
    paintOnline(d);
    paintLog(d);
    paintTable(d);
    set('sts-roles', NopaBars.rank(d.roles.map(r => ({ key: r.role, label: r.label, value: r.appSeconds, sub: `${faNum(r.people)} نفر فعال · تماشای فیلم ${nopaDuration(r.videoSeconds)}` })), { unit: 'seconds', empty: 'در این بازه فعالیتی ثبت نشده است.' }));

    const [cKey, , cUnit] = CARAVAN_BY.find(x => x[0] === st.caravanBy);
    set('sts-caravans-by', chips(CARAVAN_BY, st.caravanBy, 'data-sts-caravan-by'));
    set('sts-caravans', NopaBars.rank(d.caravans.slice().sort((a, b) => b[cKey] - a[cKey]).slice(0, 15).map(c => ({
      key: c.id, label: c.name, value: c[cKey],
      avatarHtml: crvAvatar(c.coverImageUrl, c.name, 'nbr-rank-avatar'),
      sub: `${faNum(c.activeMembers)} از ${faNum(c.members)} عضو فعال · حضور ${nopaDuration(c.appSeconds)} · فیلم ${nopaDuration(c.videoSeconds)}`,
    })), { unit: cUnit, click: 'stsPickCaravan', empty: 'کاروانی پیدا نشد.' }));

    set('sts-stations', NopaBars.rank(d.stations.map(s => ({
      key: s.id, label: s.title, value: s.videoSeconds, sub: `${faNum(s.viewers)} بیننده · ${faNum(s.classes)} کلاس دیده‌شده${s.gallerySeconds ? ` · نگارستان ${nopaDuration(s.gallerySeconds)}` : ''}`,
    })), { unit: 'seconds', click: 'stsPickStation', empty: 'در این بازه فیلمی دیده نشده است.' }));
    set('sts-classes', NopaBars.rank(d.classes.map(c => ({
      key: c.id, label: c.title, value: c.videoSeconds, sub: [c.station, c.category, `${faNum(c.viewers)} بیننده`].filter(Boolean).join(' · '),
    })), { unit: 'seconds', empty: 'در این بازه فیلمی دیده نشده است.' }));

    const [pKey, , pUnit] = PEOPLE_BY.find(x => x[0] === st.peopleBy);
    set('sts-people-by', chips(PEOPLE_BY, st.peopleBy, 'data-sts-people-by'));
    set('sts-people', NopaBars.rank(d.topUsers.slice().sort((a, b) => b[pKey] - a[pKey]).filter(u => u[pKey] > 0).slice(0, 15).map(u => ({
      key: u.id, label: u.name, value: u[pKey],
      avatarHtml: avatar(u),
      sub: [u.caravanName ? `کاروان ${u.caravanName}` : '', `حضور ${short(u.appSeconds)}`, `چت ${short(u.chatSeconds)}`, `منزلگاه ${short(u.stationSeconds)}`, `فیلم ${short(u.videoSeconds)}`, `${faNum(u.opens)} بار باز کردن`, `${faNum(u.logins)} لاگین`].filter(Boolean).join(' · '),
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

  const kpiMetric = k => (KPIS.find(x => x[0] === k) || KPIS[0])[5];

  function mainChart() {
    NopaActivity.render($('sts-main-chart'), 'sts:main', {
      metricTitle: true,
      params: { caravanId: st.caravanId, role: st.role, stationId: st.stationId },
      metrics: ['app', 'chat', 'station', 'video', 'other', 'opens', 'logins', 'active', 'messages', 'challenges', 'quizzes'],
      metric: kpiMetric(st.kpi),
      range: st.range,
    });
    NopaActivity.setMetric('sts:main', kpiMetric(st.kpi));
  }

  const query = () => {
    const q = new URLSearchParams({ range: st.range });
    if (st.caravanId) q.set('caravanId', st.caravanId);
    if (st.role) q.set('role', st.role);
    return `/api/v1/admin/analytics/stats/overview?${q}`;
  };

  async function load() {
    const seq = ++st.seq;
    document.querySelectorAll('#stats-tab .sts-tile').forEach(t => t.classList.add('is-loading'));
    if (!st.data) paint();
    mainChart();
    try {
      const data = await NopaApi.json(query(), { silent: true });
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
    startLive();
  }

  // ---- live: every 3 seconds while the tab is on screen and the window is visible ----
  const onScreen = () => {
    const tab = $('stats-tab');
    return !!tab && tab.offsetParent !== null && document.visibilityState === 'visible';
  };
  async function tick() {
    if (!onScreen()) { stopLive(); return; }
    if (st.busy) return;
    st.busy = true;
    const seq = st.seq;
    try {
      const data = await NopaApi.json(query(), { silent: true });
      if (seq === st.seq && onScreen()) {
        st.data = data;
        paint();
        NopaActivity.refresh('sts:main', { silent: true });
        const stamp = $('sts-live-stamp');
        if (stamp) stamp.textContent = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());
      }
    } catch (_) {
      // a missed round is fine; the next one tries again
    } finally {
      st.busy = false;
    }
  }
  function startLive() {
    if (st.timer) return;
    st.timer = setInterval(tick, LIVE_MS);
    $('sts-live') && $('sts-live').classList.add('is-on');
  }
  function stopLive() {
    clearInterval(st.timer);
    st.timer = null;
    $('sts-live') && $('sts-live').classList.remove('is-on');
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && onScreen() && st.data) { tick(); startLive(); } });

  window.stsPickCaravan = function(id) {
    st.caravanId = String(id);
    load();
    $('stats-tab').scrollIntoView({ block: 'start', behavior: NopaMotion.scrollBehavior() });
  };
  window.stsPickStation = function(id) {
    st.stationId = String(id);
    st.kpi = 'videoSeconds';
    paintFilters();
    kpis(st.data && st.data.totals);
    mainChart();
    $('sts-main-chart').scrollIntoView({ block: 'center', behavior: NopaMotion.scrollBehavior() });
  };

  function pickKpi(k) {
    if (!KPIS.some(x => x[0] === k)) return;
    st.kpi = k;
    kpis(st.data && st.data.totals);
    mainChart();
    const chart = $('sts-main-chart');
    const r = chart.getBoundingClientRect();
    if (r.top < 0 || r.top > window.innerHeight * 0.6) chart.scrollIntoView({ block: 'center', behavior: NopaMotion.scrollBehavior() });
  }

  function init() {
    const tab = $('stats-tab');
    if (!tab) return;
    tab.addEventListener('click', e => {
      const k = e.target.closest('[data-sts-kpi]');
      if (k) { pickKpi(k.dataset.stsKpi); return; }
      const r = e.target.closest('[data-sts-range]');
      if (r) { if (st.range !== r.dataset.stsRange) { st.range = r.dataset.stsRange; load(); } return; }
      const c = e.target.closest('[data-sts-caravan-by]');
      if (c) { st.caravanBy = c.dataset.stsCaravanBy; paint(); return; }
      const p = e.target.closest('[data-sts-people-by]');
      if (p) { st.peopleBy = p.dataset.stsPeopleBy; paint(); return; }
      const h = e.target.closest('[data-sts-hours-by]');
      if (h) { st.hoursBy = h.dataset.stsHoursBy; paint(); return; }
      const t = e.target.closest('[data-sts-table-by]');
      if (t) { st.tableBy = t.dataset.stsTableBy; paint(); return; }
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
      else if (t.matches('[data-nac-metric]')) {
        // the chart's own type box: select the tile of that metric
        const hit = KPIS.find(x => x[5] === t.value);
        if (hit) { st.kpi = hit[0]; kpis(st.data && st.data.totals); }
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.loadStatsPage = load;
})();
