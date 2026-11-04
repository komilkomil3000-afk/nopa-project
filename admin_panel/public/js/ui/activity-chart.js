// Activity bar chart with a chart-type box and a period filter (GET /api/v1/admin/analytics/stats/series).
// Loaded after js/ui/bars.js, before the feature modules. Used on a person's page, the mentor page, the full report
// and the «آمار» tab.
//   NopaActivity.render(host, key, options)
//       host      element the card is drawn into (drawing again with the same key + params keeps it as it is)
//       key       remembers the chosen chart type and period across repaints
//       options   { params: { userId | caravanId | role | stationId }, metrics: ['app', ...], title,
//                   range: fixed period (hides the period chips; the «آمار» tab sets its own), metric,
//                   metricTitle: true = the title names the chosen chart type }
//   NopaActivity.refresh(key, { silent })  asks the server again (silent: no loading state, redrawn only when changed)
//   NopaActivity.setMetric(key, metric) / NopaActivity.metricOf(key)
(function () {
  const escHtml = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const METRICS = {
    app: { label: 'زمان حضور در اپ', icon: 'fa-mobile-screen' },
    video: { label: 'زمان تماشای فیلم‌ها', icon: 'fa-circle-play' },
    chat: { label: 'زمان حضور در چت', icon: 'fa-comments' },
    station: { label: 'زمان حضور در منزلگاه‌ها', icon: 'fa-map-location-dot' },
    other: { label: 'زمان در بقیه بخش‌ها', icon: 'fa-shapes' },
    opens: { label: 'دفعات باز کردن اپ', icon: 'fa-door-open' },
    logins: { label: 'تعداد لاگین در اپ', icon: 'fa-right-to-bracket' },
    active: { label: 'کاربران فعال', icon: 'fa-users' },
    messages: { label: 'پیام‌های چت', icon: 'fa-comment-dots' },
    challenges: { label: 'ارسال پاسخ چالش', icon: 'fa-trophy' },
    quizzes: { label: 'آزمون‌های داده‌شده', icon: 'fa-spell-check' },
  };
  const PERSON_METRICS = ['app', 'video', 'station', 'chat', 'other', 'opens', 'logins', 'messages', 'challenges', 'quizzes'];
  const RANGES = [['today', 'امروز'], ['week', 'هفته جاری'], ['month', 'ماه جاری'], ['all', 'تمام مدت']];
  const NOTE = {
    opens: 'از نسخه جدید اپ ثبت می‌شود.',
    video: 'پخش فیلم جلسات و نگارستان منزلگاه‌ها، با همه تکرارها (هر بار و هر مقدار که پخش شد).',
    station: 'مدت باز بودن صفحه‌های منزلگاه در اپ، جدا از زمان پخش فیلم؛ از نسخه جدید اپ ثبت می‌شود.',
    active: 'در «تمام مدت»، شلوغ‌ترین روز هر ماه.',
    chat: 'از نسخه جدید اپ ثبت می‌شود.',
    other: 'حضور در اپ منهای زمان چت و منزلگاه‌ها.',
    logins: 'فقط ورود به حساب در اپ موبایل؛ ورودهای پنل مدیریت شمرده نمی‌شوند.',
  };

  const states = new Map(); // key -> { host, opts, metric, range, data, error, loading, sig }
  const cache = new Map();  // url -> { at, data }
  let monthsList = [];      // previous Jalali months, from the first answer

  function url(st) {
    const q = new URLSearchParams({ metric: st.metric, range: st.opts.range || st.range });
    Object.entries(st.opts.params || {}).forEach(([k, v]) => { if (v) q.set(k, v); });
    return `/api/v1/admin/analytics/stats/series?${q}`;
  }

  function summary(st) {
    const d = st.data;
    if (!d) return '<span class="lst-skel-line"></span>';
    const f = v => NopaBars.fmt(v, d.unit);
    const per = { hours: 'ساعت', days: 'روز', months: 'ماه' }[d.bucketKind] || 'روز';
    return `
      <span><small>${d.metric === 'active' ? 'افراد فعال در این بازه' : `مجموع ${escHtml(d.rangeLabel)}`}</small><strong>${escHtml(f(d.total))}</strong></span>
      <span><small>میانگین هر ${per}</small><strong>${escHtml(f(d.average))}</strong></span>
      <span><small>بیشترین</small><strong>${d.peak ? `${escHtml(f(d.peak.value))} <em>${escHtml(d.peak.label)}</em>` : '—'}</strong></span>`;
  }

  function draw(st) {
    const o = st.opts;
    const metrics = (o.metrics || PERSON_METRICS).filter(m => METRICS[m]);
    const range = st.range;
    const isPrev = /^month:/.test(range);
    const months = (st.data && st.data.months) || monthsList;
    const m = METRICS[st.metric];
    st.host.innerHTML = `
      <section class="lse-card nac${st.loading ? ' is-loading' : ''}" data-nac="${escHtml(st.key)}">
        <header class="nac-head">
          <h4 class="lse-card-title"><i class="fa-solid ${m.icon}"></i> ${escHtml(o.metricTitle ? `روند ${m.label}` : (o.title || 'نمودار فعالیت'))}</h4>
          <label class="nac-type"><span>نوع نمودار</span>
            <select class="select-ctrl" data-nac-metric aria-label="نوع نمودار">
              ${metrics.map(k => `<option value="${k}"${k === st.metric ? ' selected' : ''}>${escHtml(METRICS[k].label)}</option>`).join('')}
            </select>
          </label>
        </header>
        ${o.range ? '' : `
        <div class="chm-chips nac-ranges" role="tablist" aria-label="بازه نمودار">
          ${RANGES.slice(0, 3).map(([k, l]) => `<button type="button" class="chm-chip${range === k ? ' is-active' : ''}" role="tab" aria-selected="${range === k}" data-nac-range="${k}">${l}</button>`).join('')}
          <label class="nac-month${isPrev ? ' is-active' : ''}"><select class="select-ctrl" data-nac-month aria-label="ماه‌های قبل">
            <option value="">ماه‌های قبل</option>
            ${months.map(x => `<option value="${escHtml(x.key)}"${x.key === range ? ' selected' : ''}>${escHtml(x.label)}</option>`).join('')}
          </select></label>
          <button type="button" class="chm-chip${range === 'all' ? ' is-active' : ''}" role="tab" aria-selected="${range === 'all'}" data-nac-range="all">تمام مدت</button>
        </div>`}
        <div class="nac-summary">${summary(st)}</div>
        <div class="nac-chart">${st.error
          ? `<div class="lsv-col-empty"><i class="fa-solid fa-triangle-exclamation lst-warn"></i> ${escHtml(st.error)}</div>`
          : st.data ? NopaBars.columns(st.data.buckets, { unit: st.data.unit, label: `${m.label}، ${st.data.rangeLabel}` })
          : '<div class="nbr nbr-skel" aria-hidden="true"></div>'}</div>
        ${NOTE[st.metric] ? `<p class="nac-note"><i class="fa-solid fa-circle-info"></i> ${escHtml(NOTE[st.metric])}</p>` : ''}
      </section>`;
  }

  // a quiet re-ask (the «آمار» tab every few seconds): no loading state, redrawn only if the answer changed
  async function quiet(st) {
    const u = url(st);
    if (st.loading || st.quietBusy) return;
    st.quietBusy = true;
    try {
      const data = await NopaApi.json(u, { silent: true });
      cache.set(u, { at: Date.now(), data });
      if (url(st) !== u || !st.host.isConnected) return;
      if (JSON.stringify(data) === JSON.stringify(st.data)) return;
      st.data = data;
      st.error = '';
      draw(st);
    } catch (_) {
      // keep what is shown; the next round tries again
    } finally {
      st.quietBusy = false;
    }
  }

  async function load(st, force) {
    const u = url(st);
    const hit = cache.get(u);
    if (!force && hit && Date.now() - hit.at < 60000) { st.data = hit.data; st.error = ''; st.loading = false; draw(st); return; }
    st.loading = true;
    st.error = '';
    draw(st);
    try {
      const data = await NopaApi.json(u, { silent: true });
      cache.set(u, { at: Date.now(), data });
      if (data.months && data.months.length) monthsList = data.months;
      if (url(st) !== u) return; // the choice changed meanwhile
      st.data = data;
    } catch (err) {
      if (url(st) !== u) return;
      st.data = null;
      st.error = err.status === 403 ? 'دسترسی به آمار برای شما فعال نیست.' : 'دریافت نمودار ممکن نشد.';
    }
    st.loading = false;
    if (st.host.isConnected) draw(st);
  }

  function render(host, key, options) {
    if (!host) return;
    const opts = options || {};
    const sig = JSON.stringify([opts.params || {}, opts.range || '', opts.metrics || '']);
    let st = states.get(key);
    if (st && st.sig === sig && st.host === host && host.querySelector(`[data-nac="${CSS.escape(key)}"]`)) return;
    const metrics = opts.metrics || PERSON_METRICS;
    st = {
      key, host, opts, sig,
      metric: (st && metrics.includes(st.metric) && st.metric) || opts.metric || metrics[0],
      range: (st && st.range) || 'week',
      data: null, error: '', loading: true,
    };
    states.set(key, st);
    load(st);
  }

  function refresh(key, o) {
    const st = states.get(key);
    if (!st) return;
    if (o && o.silent) quiet(st); else load(st, true);
  }

  const stateOf = el => {
    const card = el.closest('[data-nac]');
    return card ? states.get(card.dataset.nac) : null;
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-nac-range]');
    const st = b && stateOf(b);
    if (!st || st.range === b.dataset.nacRange) return;
    st.range = b.dataset.nacRange;
    load(st);
  });
  document.addEventListener('change', e => {
    const t = e.target;
    const st = t.matches && (t.matches('[data-nac-metric]') || t.matches('[data-nac-month]')) ? stateOf(t) : null;
    if (!st) return;
    if (t.matches('[data-nac-metric]')) st.metric = t.value;
    else if (t.value) st.range = t.value;
    else return;
    load(st);
  });

  function setMetric(key, metric) {
    const st = states.get(key);
    if (st && METRICS[metric] && st.metric !== metric) { st.metric = metric; load(st); }
  }

  const metricOf = key => (states.get(key) || {}).metric || '';

  window.NopaActivity = { render, refresh, setMetric, metricOf, METRICS };
})();
