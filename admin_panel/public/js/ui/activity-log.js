// A person's detailed activity log in the mobile app (GET /api/v1/admin/analytics/stats/user-log), drawn under
// the person's activity chart on their page (همسفران, the mentor page and the full report: nopaPersonChart in
// js/features/users.js). Loaded after js/ui/activity-chart.js.
//   NopaActivityLog.render(host, userId)   draws the card (drawing again for the same person keeps it as it is)
// Shows what they did, newest first, grouped by day (entered a part of the app, watched a video and how much,
// changed the picture / profile, sent an answer ...), a filter, «بیشتر» for older rows, and every station video they
// played: times started, time played (repeats included) and how much of it was really watched.
(function () {
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const faNum = n => Number(n || 0).toLocaleString('fa-IR');
  const dur = s => (window.nopaDuration ? window.nopaDuration(s) : `${faNum(Math.round((s || 0) / 60))} دقیقه`);

  const AREA = { home: 'خانه', academy: 'آموزگاه', station: 'منزلگاه', challenges: 'چالش‌ها', market: 'بازار', profile: 'پروفایل', chat: 'چت', other: 'بخش‌های دیگر' };
  // [icon, colour class (css/stations.css .is-*)]
  const TYPE = {
    enter: ['fa-arrow-right-to-bracket', 'is-other'], open: ['fa-door-open', 'is-open'], away: ['fa-moon', 'is-away'],
    login: ['fa-right-to-bracket', 'is-login'], logout: ['fa-right-from-bracket', 'is-away'],
    video: ['fa-circle-play', 'is-video'], avatar: ['fa-image-portrait', 'is-login'], profile: ['fa-id-card', 'is-login'],
    password: ['fa-key', 'is-login'], challenge: ['fa-trophy', 'is-open'], quiz: ['fa-spell-check', 'is-open'],
    ticket: ['fa-headset', 'is-other'], exchange: ['fa-right-left', 'is-open'], rate: ['fa-star', 'is-open'], message: ['fa-comment-dots', 'is-chat'],
  };
  const AREA_ICON = { home: 'fa-house', academy: 'fa-graduation-cap', station: 'fa-map-location-dot', challenges: 'fa-trophy', market: 'fa-store', profile: 'fa-id-badge', chat: 'fa-comments' };
  const GROUPS = [['all', 'همه'], ['areas', 'بخش‌های اپ'], ['videos', 'فیلم‌ها'], ['actions', 'کارها و تغییرات']];

  const states = new Map(); // host -> state
  const dayFmt = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeFmt = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit' });
  const dayKey = iso => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date(iso));

  function text(it) {
    if (it.type === 'enter') return it.label ? `وارد ${esc(it.label)} شد` : `وارد ${esc(AREA[it.area] || 'بخشی از اپ')} شد`;
    if (it.type === 'video') return `${esc(it.label || 'تماشای فیلم')} · <b>${esc(dur(it.seconds))}</b> تماشا`;
    return esc(it.label || it.type);
  }

  function rows(items) {
    let last = '';
    return items.map(it => {
      const k = dayKey(it.at);
      const head = k !== last ? `<li class="nal-day">${esc(dayFmt.format(new Date(it.at)))}</li>` : '';
      last = k;
      const [icon, cls] = it.type === 'enter' ? [AREA_ICON[it.area] || TYPE.enter[0], it.area === 'chat' ? 'is-chat' : it.area === 'station' ? 'is-video' : 'is-other'] : (TYPE[it.type] || ['fa-circle', '']);
      return `${head}<li class="${cls}"><i class="fa-solid ${icon}"></i><span>${text(it)}</span><time>${esc(timeFmt.format(new Date(it.at)))}</time></li>`;
    }).join('');
  }

  function videos(list) {
    if (!list || !list.length) return '';
    return `
      <details class="nal-videos">
        <summary><i class="fa-solid fa-film"></i> فیلم‌های دیده‌شده <span class="lsv-col-count">${faNum(list.length)}</span></summary>
        <div class="sts-table-wrap"><table class="sts-table">
          <thead><tr><th>فیلم</th><th>منزلگاه</th><th>دفعات پخش</th><th>زمان پخش (با تکرار)</th><th>واقعاً دیده‌شده</th><th>آخرین بار</th></tr></thead>
          <tbody>${list.map(v => `<tr>
            <td><strong>${esc(v.title || 'بدون عنوان')}</strong><small class="nal-kind">${v.kind === 'gallery' ? 'نگارستان' : 'جلسه'}</small></td>
            <td>${esc(v.station || '—')}</td>
            <td>${faNum(v.plays)}</td>
            <td>${esc(dur(v.playSeconds))}</td>
            <td><span class="nal-pct${v.percent >= 90 ? ' is-done' : ''}"><i data-style="width:${Math.min(100, v.percent)}%"></i></span> ${faNum(v.percent)}٪</td>
            <td>${esc(new Date(v.lastWatchedAt).toLocaleDateString('fa-IR'))}</td>
          </tr>`).join('')}</tbody>
        </table></div>
      </details>`;
  }

  function draw(st) {
    const body = st.error
      ? `<div class="lsv-col-empty"><i class="fa-solid fa-triangle-exclamation lst-warn"></i> ${esc(st.error)}</div>`
      : !st.items ? '<div class="lst-skel-lines" aria-hidden="true">' + '<span class="lst-skel-row"></span>'.repeat(5) + '</div>'
      : st.items.length ? `<ul class="sts-log nal-list">${rows(st.items)}</ul>
          ${st.next ? `<button type="button" class="chm-chip nal-more" data-nal-more${st.busy ? ' disabled' : ''}>${st.busy ? 'در حال دریافت…' : 'موارد قدیمی‌تر'}</button>` : ''}`
      : '<div class="lsv-col-empty">هنوز فعالیتی از اپ برای این شخص ثبت نشده است.</div>';
    st.host.innerHTML = `
      <section class="lse-card nal" data-nal-user="${esc(st.userId)}">
        <header class="nac-head">
          <h4 class="lse-card-title"><i class="fa-solid fa-list-check"></i> لاگ فعالیت در اپ</h4>
        </header>
        <div class="chm-chips" role="tablist" aria-label="نوع فعالیت">
          ${GROUPS.map(([k, l]) => `<button type="button" class="chm-chip${st.group === k ? ' is-active' : ''}" role="tab" aria-selected="${st.group === k}" data-nal-group="${k}">${l}</button>`).join('')}
        </div>
        ${st.group === 'all' || st.group === 'videos' ? videos(st.videos) : ''}
        <div class="nal-body">${body}</div>
      </section>`;
  }

  async function load(st, more) {
    const q = new URLSearchParams({ userId: st.userId, group: st.group, limit: '60' });
    if (more && st.next) q.set('before', st.next);
    const seq = ++st.seq;
    if (more) { st.busy = true; draw(st); } else { st.items = null; st.error = ''; draw(st); }
    try {
      const data = await NopaApi.json(`/api/v1/admin/analytics/stats/user-log?${q}`, { silent: true });
      if (seq !== st.seq) return;
      st.items = more ? (st.items || []).concat(data.items) : data.items;
      st.next = data.next;
      if (data.videos) st.videos = data.videos;
      st.error = '';
    } catch (err) {
      if (seq !== st.seq) return;
      if (!more) st.items = null;
      st.error = err.status === 403 ? 'دسترسی به آمار برای شما فعال نیست.' : 'دریافت لاگ فعالیت ممکن نشد.';
    }
    st.busy = false;
    if (st.host.isConnected) draw(st);
  }

  function render(host, userId) {
    if (!host || !userId) return;
    const id = String(userId);
    const old = states.get(host);
    if (old && old.userId === id && host.querySelector(`[data-nal-user="${CSS.escape(id)}"]`)) return;
    const st = { host, userId: id, group: (old && old.group) || 'all', items: null, videos: null, next: null, error: '', busy: false, seq: 0 };
    states.set(host, st);
    load(st);
  }

  const stateOf = el => {
    const card = el.closest('.nal');
    return card ? states.get(card.parentElement) : null;
  };
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-nal-group]');
    if (g) {
      const st = stateOf(g);
      if (st && st.group !== g.dataset.nalGroup) { st.group = g.dataset.nalGroup; st.videos = null; load(st); }
      return;
    }
    const m = e.target.closest('[data-nal-more]');
    const st = m && stateOf(m);
    if (st && !st.busy) load(st, true);
  });

  window.NopaActivityLog = { render };
})();
