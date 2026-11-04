// Bar charts drawn as plain markup (no canvas): css/stations.css «Bar charts». Loaded before the feature modules.
//   nopaDuration(seconds)            -> "۲ ساعت و ۵ دقیقه"
//   NopaBars.fmt(value, unit)        -> duration for unit 'seconds', a Persian number otherwise
//   NopaBars.columns(buckets, opts)  -> vertical bars; buckets [{ key, label, value, future?, current? }]
//       opts.unit 'seconds' | 'count', opts.clickable (adds data-bar-key for a click handler)
//   NopaBars.rank(rows, opts)        -> horizontal ranked bars; rows [{ key, label, sub, value, avatarHtml }]
//       opts.unit, opts.click (window function name; called with the row key), opts.empty
// Heights go through data-style (js/ui/style-attr.js) because the CSP forbids style attributes.
(function () {
  const escHtml = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const faNum = n => Number(n || 0).toLocaleString('fa-IR');

  function nopaDuration(sec) {
    const s = Math.max(0, Math.round(Number(sec) || 0));
    if (s < 60) return s ? 'کمتر از یک دقیقه' : '۰';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (!h) return `${faNum(m)} دقیقه`;
    return m ? `${faNum(h)} ساعت و ${faNum(m)} دقیقه` : `${faNum(h)} ساعت`;
  }
  // short form for axes: "۳ س" / "۴۵ د"
  function shortDuration(sec) {
    const s = Math.max(0, Number(sec) || 0);
    if (s >= 3600) return `${(s / 3600).toLocaleString('fa-IR', { maximumFractionDigits: s >= 36000 ? 0 : 1 })} ساعت`;
    if (s >= 60) return `${faNum(Math.round(s / 60))} دقیقه`;
    return s ? `${faNum(Math.round(s))} ثانیه` : '۰';
  }
  const fmt = (v, unit) => (unit === 'seconds' ? nopaDuration(v) : faNum(v));
  const fmtShort = (v, unit) => (unit === 'seconds' ? shortDuration(v) : faNum(v));

  // a round axis maximum (1, 2, 5 x 10^n; whole hours/minutes for durations)
  function niceMax(max, unit) {
    if (!(max > 0)) return unit === 'seconds' ? 3600 : 5;
    if (unit === 'seconds') {
      const steps = [60, 300, 600, 900, 1800, 3600, 7200, 10800, 18000, 36000, 72000, 180000, 360000, 720000, 1800000, 3600000];
      return steps.find(s => s >= max) || Math.ceil(max / 3600000) * 3600000;
    }
    const p = Math.pow(10, Math.floor(Math.log10(max)));
    return [1, 2, 5, 10].map(k => k * p).find(v => v >= max);
  }

  function columns(buckets, opts) {
    const o = opts || {};
    const list = buckets || [];
    if (!list.length) return '<div class="lsv-col-empty">داده‌ای برای نمایش نیست.</div>';
    const unit = o.unit || 'count';
    const top = niceMax(Math.max(0, ...list.map(b => b.value || 0)), unit);
    const every = list.length > 24 ? Math.ceil(list.length / 12) : list.length > 14 ? 2 : 1;
    return `
      <div class="nbr" role="img" aria-label="${escHtml(o.label || 'نمودار میله‌ای')}">
        <div class="nbr-axis" aria-hidden="true"><span>${escHtml(fmtShort(top, unit))}</span><span>${escHtml(fmtShort(top / 2, unit))}</span><span>۰</span></div>
        <div class="nbr-plot">
          <div class="nbr-grid" aria-hidden="true"><span></span><span></span><span></span></div>
          <div class="nbr-cols">${list.map((b, i) => {
            const pct = b.value > 0 ? Math.max(2, Math.round((b.value / top) * 100)) : 0;
            const cls = ['nbr-col', b.future ? 'is-future' : '', b.current ? 'is-current' : '', b.value ? '' : 'is-zero', o.clickable ? 'is-clickable' : ''].filter(Boolean).join(' ');
            const tip = `${b.title || b.label}: ${fmt(b.value, unit)}`;
            return `<span class="${cls}" data-tip="${escHtml(tip)}" title="${escHtml(tip)}"${o.clickable ? ` data-bar-key="${escHtml(b.key)}"` : ''}>
              <span class="nbr-bar"><span data-style="height:${pct}%"></span></span>
              <small class="nbr-label${i % every ? ' is-hidden' : ''}">${escHtml(b.label)}</small>
            </span>`;
          }).join('')}</div>
        </div>
      </div>`;
  }

  function rank(rows, opts) {
    const o = opts || {};
    const list = (rows || []).filter(r => r);
    if (!list.length) return `<div class="lsv-col-empty">${escHtml(o.empty || 'داده‌ای برای نمایش نیست.')}</div>`;
    const unit = o.unit || 'count';
    const max = Math.max(1, ...list.map(r => r.value || 0));
    return `<ol class="nbr-rank">${list.map((r, i) => {
      const pct = r.value > 0 ? Math.max(2, Math.round((r.value / max) * 100)) : 0;
      const inner = `
        <span class="nbr-rank-num">${faNum(i + 1)}</span>
        ${r.avatarHtml || ''}
        <span class="nbr-rank-body">
          <span class="nbr-rank-top"><strong>${escHtml(r.label)}</strong><b>${escHtml(fmt(r.value, unit))}</b></span>
          <span class="nbr-rank-bar"><span data-style="width:${pct}%"></span></span>
          ${r.sub ? `<small>${escHtml(r.sub)}</small>` : ''}
        </span>`;
      return `<li>${o.click
        ? `<button type="button" class="nbr-rank-row" data-click="${escHtml(o.click)}" data-click-args="${escHtml(JSON.stringify([String(r.key)]))}">${inner}</button>`
        : `<div class="nbr-rank-row">${inner}</div>`}</li>`;
    }).join('')}</ol>`;
  }

  window.nopaDuration = nopaDuration;
  window.NopaBars = { columns, rank, fmt, fmtShort, niceMax };
})();
