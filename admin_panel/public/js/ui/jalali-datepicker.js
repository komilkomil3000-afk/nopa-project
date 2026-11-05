// Shamsi (Jalali) date picker for every <input type="date"> and <input type="datetime-local"> in the panel.
// The native input stays in the DOM (hidden) and keeps its Gregorian ISO value ("2026-11-04" or
// "2026-11-04T10:30"), so every feature that reads or sets `.value` works unchanged. Next to it a read-only
// text box shows the Shamsi date and opens a calendar popover; picking a date writes the ISO value back into
// the native input and fires bubbling `input` + `change` events on it (data-input / data-change handlers,
// addEventListener and delegated listeners all still fire).
//   - runs for the page on load, then for every date input inserted later (innerHTML templates, editors)
//   - setting `input.value = …` from code updates the Shamsi text (per-element value setter)
//   - honours min / max / disabled on the native input
//   - add class "no-jdp" to an input to keep the browser's own picker
//   - a text input with data-jdp="jalali" gets the same picker but keeps a Shamsi text value ("1380/05/12"),
//     for fields stored as Shamsi text (birth dates); a value it cannot read is shown as typed
(function () {
  'use strict';

  // ---------- Jalali <-> Gregorian (jalaali algorithm, Borkowski) ----------
  var BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  function div(a, b) { return ~~(a / b); }
  function mod(a, b) { return a - ~~(a / b) * b; }

  function jalCal(jy) {
    var bl = BREAKS.length, gy = jy + 621, leapJ = -14, jp = BREAKS[0], jm, jump = 0, leap, leapG, march, n, i;
    for (i = 1; i < bl; i++) {
      jm = BREAKS[i]; jump = jm - jp;
      if (jy < jm) break;
      leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
      jp = jm;
    }
    n = jy - jp;
    leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
    leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    march = 20 + leapJ - leapG;
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;
    return { leap: leap, gy: gy, march: march };
  }
  function g2d(gy, gm, gd) {
    var d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
    return d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  }
  function d2g(jdn) {
    var j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    var i = div(mod(j, 1461), 4) * 5 + 308;
    var gd = div(mod(i, 153), 5) + 1, gm = mod(div(i, 153), 12) + 1;
    var gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return { gy: gy, gm: gm, gd: gd };
  }
  function j2d(jy, jm, jd) {
    var r = jalCal(jy);
    return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
  }
  function d2j(jdn) {
    var gy = d2g(jdn).gy, jy = gy - 621, r = jalCal(jy), jdn1f = g2d(gy, 3, r.march), jd, jm, k = jdn - jdn1f;
    if (k >= 0) {
      if (k <= 185) { jm = 1 + div(k, 31); jd = mod(k, 31) + 1; return { jy: jy, jm: jm, jd: jd }; }
      k -= 186;
    } else {
      jy -= 1; k += 179;
      if (r.leap === 1) k += 1;
    }
    jm = 7 + div(k, 30); jd = mod(k, 30) + 1;
    return { jy: jy, jm: jm, jd: jd };
  }
  function toJalali(gy, gm, gd) { return d2j(g2d(gy, gm, gd)); }
  function toGregorian(jy, jm, jd) { return d2g(j2d(jy, jm, jd)); }
  function monthLength(jy, jm) {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    return jalCal(jy).leap === 0 ? 30 : 29;
  }

  // ---------- formatting ----------
  var MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  var WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
  function fa(v) { return String(v).replace(/[0-9]/g, function (d) { return String.fromCharCode(0x06F0 + (+d)); }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isoDate(g) { return g.gy + '-' + pad(g.gm) + '-' + pad(g.gd); }

  // "2026-11-04" / "2026-11-04T10:30" -> { gy, gm, gd, h, mi } or null
  function parseIso(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(v || '');
    if (!m) return null;
    return { gy: +m[1], gm: +m[2], gd: +m[3], h: m[4] != null ? +m[4] : null, mi: m[5] != null ? +m[5] : null };
  }
  function todayG() { var d = new Date(); return { gy: d.getFullYear(), gm: d.getMonth() + 1, gd: d.getDate() }; }

  // ---------- per-input wiring ----------
  var proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  function rawValue(input) { return proto.get.call(input); }

  function isTarget(el) {
    return el && el.tagName === 'INPUT' && !el.__jdp && !el.classList.contains('no-jdp') &&
      (el.type === 'date' || el.type === 'datetime-local' || (el.type === 'text' && el.getAttribute('data-jdp') === 'jalali'));
  }
  function isJalaliText(input) { return input.type === 'text' && input.getAttribute('data-jdp') === 'jalali'; }

  // "1380/05/12" / "۱۳۸۰/۰۵/۱۲" / "1380-5-12" -> { gy, gm, gd } or null
  function latin(v) {
    return String(v || '').replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); })
      .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); });
  }
  function parseJalaliText(v) {
    var m = /^\s*(1[34]\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\s*$/.exec(latin(v));
    if (!m) return null;
    var jy = +m[1], jm = +m[2], jd = +m[3];
    if (jm < 1 || jm > 12 || jd < 1 || jd > monthLength(jy, jm)) return null;
    var g = toGregorian(jy, jm, jd);
    return { gy: g.gy, gm: g.gm, gd: g.gd, h: null, mi: null };
  }
  /** the input's value as a date, whatever the input's kind */
  function parseValue(input) { return isJalaliText(input) ? parseJalaliText(rawValue(input)) : parseIso(rawValue(input)); }
  /** a picked day (Gregorian) in the input's own value format */
  function formatValue(input, g) {
    if (!isJalaliText(input)) return isoDate(g);
    var j = toJalali(g.gy, g.gm, g.gd);
    return j.jy + '/' + pad(j.jm) + '/' + pad(j.jd);
  }

  function enhance(input) {
    if (!isTarget(input)) return;
    var withTime = input.type === 'datetime-local';
    var display = document.createElement('input');
    display.type = 'text';
    display.readOnly = true;
    display.className = input.className;
    display.classList.remove('is-invalid');
    display.classList.add('jdp-display');
    if (withTime) display.classList.add('jdp-display--time');
    display.dir = 'rtl';
    display.autocomplete = 'off';
    display.placeholder = input.getAttribute('placeholder') || (withTime ? 'انتخاب تاریخ و ساعت' : 'انتخاب تاریخ');
    ['title', 'aria-label'].forEach(function (a) { if (input.hasAttribute(a)) display.setAttribute(a, input.getAttribute(a)); });
    if (input.style.cssText) display.style.cssText = input.style.cssText;
    display.setAttribute('aria-haspopup', 'dialog');

    input.__jdp = { display: display, withTime: withTime };
    input.insertAdjacentElement('afterend', display);
    input.style.setProperty('display', 'none', 'important');
    input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');

    // code that writes `input.value = …` refreshes the Shamsi text
    Object.defineProperty(input, 'value', {
      configurable: true,
      get: function () { return proto.get.call(this); },
      set: function (v) { proto.set.call(this, v); refresh(this); }
    });
    if (input.form) input.form.addEventListener('reset', function () { setTimeout(function () { refresh(input); }, 0); });
    input.addEventListener('change', function () { refresh(input); });

    display.addEventListener('click', function () { open(input); });
    display.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); open(input); }
      else if ((e.key === 'Backspace' || e.key === 'Delete') && !input.required) { e.preventDefault(); commit(input, ''); }
    });
    refresh(input);
  }

  function refresh(input) {
    var st = input.__jdp;
    if (!st) return;
    st.display.disabled = input.disabled;
    st.display.classList.toggle('is-invalid', input.classList.contains('is-invalid'));
    var p = parseValue(input);
    if (!p) { st.display.value = isJalaliText(input) ? rawValue(input) : ''; return; }
    var j = toJalali(p.gy, p.gm, p.gd);
    var text = fa(j.jd) + ' ' + MONTHS[j.jm - 1] + ' ' + fa(j.jy);
    if (st.withTime && p.h != null) text += '  ساعت ' + fa(pad(p.h) + ':' + pad(p.mi));
    st.display.value = text;
  }

  function commit(input, iso) {
    if (rawValue(input) === iso) { refresh(input); return; }
    proto.set.call(input, iso);
    refresh(input);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // ---------- popover ----------
  var pop = null, cur = null; // cur = { input, jy, jm, h, mi }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function bounds(input) {
    var lo = parseIso(input.min), hi = parseIso(input.max);
    return { lo: lo ? g2d(lo.gy, lo.gm, lo.gd) : -Infinity, hi: hi ? g2d(hi.gy, hi.gm, hi.gd) : Infinity };
  }

  function open(input) {
    if (input.disabled) return;
    if (cur && cur.input === input) { close(); return; }
    close();
    var p = parseValue(input);
    var base = p || todayG();
    var j = toJalali(base.gy, base.gm, base.gd);
    var now = new Date();
    cur = {
      input: input, jy: j.jy, jm: j.jm,
      h: p && p.h != null ? p.h : now.getHours(),
      mi: p && p.mi != null ? p.mi : now.getMinutes()
    };
    pop = el('div', 'jdp-pop');
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'انتخاب تاریخ');
    pop.dir = 'rtl';
    document.body.appendChild(pop);
    render();
    place();
    input.__jdp.display.setAttribute('aria-expanded', 'true');
    var focusBtn = pop.querySelector('.jdp-day.is-selected') || pop.querySelector('.jdp-day.is-today') || pop.querySelector('.jdp-day:not([disabled])');
    if (focusBtn) focusBtn.focus({ preventScroll: true });
  }

  function close(refocus) {
    if (!pop) return;
    var input = cur && cur.input;
    pop.remove();
    pop = null; cur = null;
    if (input && input.__jdp) {
      input.__jdp.display.setAttribute('aria-expanded', 'false');
      if (refocus) input.__jdp.display.focus({ preventScroll: true });
    }
  }

  function selectedJdn() {
    var p = parseValue(cur.input);
    return p ? g2d(p.gy, p.gm, p.gd) : null;
  }

  function writeDay(jdn) {
    var g = d2g(jdn);
    var iso = formatValue(cur.input, g);
    if (cur.input.__jdp.withTime) iso += 'T' + pad(cur.h) + ':' + pad(cur.mi);
    commit(cur.input, iso);
  }

  function shiftMonth(delta) {
    var m = cur.jm + delta, y = cur.jy;
    while (m < 1) { m += 12; y--; }
    while (m > 12) { m -= 12; y++; }
    cur.jm = m; cur.jy = y;
    render();
  }

  function render() {
    var input = cur.input, withTime = input.__jdp.withTime, b = bounds(input);
    pop.textContent = '';

    // header: › month year ‹
    var head = el('div', 'jdp-head');
    var prev = el('button', 'jdp-nav'); prev.type = 'button'; prev.setAttribute('aria-label', 'ماه قبل');
    prev.appendChild(el('i', 'fa-solid fa-chevron-right'));
    prev.addEventListener('click', function () { shiftMonth(-1); });
    var next = el('button', 'jdp-nav'); next.type = 'button'; next.setAttribute('aria-label', 'ماه بعد');
    next.appendChild(el('i', 'fa-solid fa-chevron-left'));
    next.addEventListener('click', function () { shiftMonth(1); });

    var title = el('div', 'jdp-title');
    var mSel = el('select', 'jdp-sel'); mSel.setAttribute('aria-label', 'ماه');
    MONTHS.forEach(function (name, i) { var o = el('option', null, name); o.value = i + 1; if (i + 1 === cur.jm) o.selected = true; mSel.appendChild(o); });
    mSel.addEventListener('change', function () { cur.jm = +mSel.value; render(); });
    var ySel = el('select', 'jdp-sel'); ySel.setAttribute('aria-label', 'سال');
    var thisJy = toJalali(todayG().gy, todayG().gm, todayG().gd).jy;
    var y0 = Math.min(cur.jy, thisJy - 90), y1 = Math.max(cur.jy, thisJy + 10);
    for (var y = y1; y >= y0; y--) { var o = el('option', null, fa(y)); o.value = y; if (y === cur.jy) o.selected = true; ySel.appendChild(o); }
    ySel.addEventListener('change', function () { cur.jy = +ySel.value; render(); });
    title.appendChild(mSel); title.appendChild(ySel);
    head.appendChild(prev); head.appendChild(title); head.appendChild(next);
    pop.appendChild(head);

    // weekdays + days (week starts on Saturday)
    var grid = el('div', 'jdp-grid');
    WEEKDAYS.forEach(function (w, i) { grid.appendChild(el('span', 'jdp-wd' + (i === 6 ? ' is-friday' : ''), w)); });
    var first = j2d(cur.jy, cur.jm, 1);
    var g1 = d2g(first);
    var lead = (new Date(g1.gy, g1.gm - 1, g1.gd).getDay() + 1) % 7;
    for (var k = 0; k < lead; k++) grid.appendChild(el('span', 'jdp-blank'));
    var tg = todayG(), today = g2d(tg.gy, tg.gm, tg.gd), sel = selectedJdn();
    var len = monthLength(cur.jy, cur.jm);
    for (var d = 1; d <= len; d++) {
      (function (jdn, dayNo, col) {
        var btn = el('button', 'jdp-day', fa(dayNo));
        btn.type = 'button';
        if (jdn === today) btn.classList.add('is-today');
        if (jdn === sel) { btn.classList.add('is-selected'); btn.setAttribute('aria-pressed', 'true'); }
        if (col === 6) btn.classList.add('is-friday');
        if (jdn < b.lo || jdn > b.hi) btn.disabled = true;
        btn.dataset.jdn = jdn;
        btn.addEventListener('click', function () {
          writeDay(jdn);
          if (withTime) render(); else close(true);
        });
        grid.appendChild(btn);
      })(first + d - 1, d, (lead + d - 1) % 7);
    }
    grid.addEventListener('keydown', onGridKey);
    pop.appendChild(grid);

    // time row for datetime-local
    if (withTime) {
      var time = el('div', 'jdp-time');
      time.appendChild(el('span', 'jdp-time-label', 'ساعت'));
      var hSel = el('select', 'jdp-sel'); hSel.setAttribute('aria-label', 'ساعت');
      for (var h = 0; h < 24; h++) { var ho = el('option', null, fa(pad(h))); ho.value = h; if (h === cur.h) ho.selected = true; hSel.appendChild(ho); }
      var miSel = el('select', 'jdp-sel'); miSel.setAttribute('aria-label', 'دقیقه');
      for (var mi = 0; mi < 60; mi++) { var mo = el('option', null, fa(pad(mi))); mo.value = mi; if (mi === cur.mi) mo.selected = true; miSel.appendChild(mo); }
      // the clock itself reads HH:MM left to right, the label stays on the right (RTL row)
      var clock = el('div', 'jdp-clock');
      clock.dir = 'ltr';
      clock.appendChild(hSel); clock.appendChild(el('span', 'jdp-colon', ':')); clock.appendChild(miSel);
      time.appendChild(clock);
      var onTime = function () {
        cur.h = +hSel.value; cur.mi = +miSel.value;
        var s = selectedJdn();
        if (s == null) { var t = todayG(); s = g2d(t.gy, t.gm, t.gd); }
        writeDay(s);
        render();
      };
      hSel.addEventListener('change', onTime);
      miSel.addEventListener('change', onTime);
      pop.appendChild(time);
    }

    // footer
    var foot = el('div', 'jdp-foot');
    var todayBtn = el('button', 'jdp-link', withTime ? 'اکنون' : 'امروز'); todayBtn.type = 'button';
    todayBtn.disabled = today < b.lo || today > b.hi;
    todayBtn.addEventListener('click', function () {
      var t = toJalali(tg.gy, tg.gm, tg.gd);
      cur.jy = t.jy; cur.jm = t.jm;
      if (withTime) { var n = new Date(); cur.h = n.getHours(); cur.mi = n.getMinutes(); }
      writeDay(today);
      if (withTime) render(); else close(true);
    });
    foot.appendChild(todayBtn);
    if (!input.required) {
      var clr = el('button', 'jdp-link jdp-link--muted', 'پاک کردن'); clr.type = 'button';
      clr.addEventListener('click', function () { commit(input, ''); close(true); });
      foot.appendChild(clr);
    }
    if (withTime) {
      var ok = el('button', 'jdp-ok', 'تأیید'); ok.type = 'button';
      ok.addEventListener('click', function () { close(true); });
      foot.appendChild(ok);
    }
    pop.appendChild(foot);
  }

  function onGridKey(e) {
    var btn = e.target.closest && e.target.closest('.jdp-day');
    if (!btn) return;
    var step = { ArrowRight: -1, ArrowLeft: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (e.key === 'PageUp' || e.key === 'PageDown') { e.preventDefault(); shiftMonth(e.key === 'PageUp' ? -1 : 1); return; }
    if (!step) return;
    e.preventDefault();
    var target = +btn.dataset.jdn + step;
    var t = d2j(target);
    if (t.jy !== cur.jy || t.jm !== cur.jm) { cur.jy = t.jy; cur.jm = t.jm; render(); }
    var nb = pop.querySelector('.jdp-day[data-jdn="' + target + '"]');
    if (nb) nb.focus();
  }

  function place() {
    if (!pop || !cur) return;
    var r = cur.input.__jdp.display.getBoundingClientRect();
    if (!cur.input.__jdp.display.isConnected || (r.width === 0 && r.height === 0)) { close(); return; }
    var w = pop.offsetWidth, h = pop.offsetHeight, vw = document.documentElement.clientWidth, vh = window.innerHeight, gap = 6;
    var top = r.bottom + gap;
    if (top + h > vh - 8 && r.top - gap - h >= 8) top = r.top - gap - h;
    top = Math.max(8, Math.min(top, vh - h - 8));
    var left = r.right - w; // RTL: align right edges
    left = Math.max(8, Math.min(left, vw - w - 8));
    pop.style.top = top + 'px';
    pop.style.left = left + 'px';
  }

  document.addEventListener('mousedown', function (e) {
    if (!pop) return;
    if (pop.contains(e.target) || (cur && e.target === cur.input.__jdp.display)) return;
    close();
  }, true);
  document.addEventListener('keydown', function (e) {
    if (pop && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
  }, true);
  window.addEventListener('resize', place);
  window.addEventListener('scroll', function (e) { if (pop && !pop.contains(e.target)) place(); }, true);

  // ---------- page + later inserts ----------
  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.tagName === 'INPUT') { enhance(root); return; }
    root.querySelectorAll('input[type="date"], input[type="datetime-local"], input[data-jdp="jalali"]').forEach(enhance);
  }
  function start() {
    scan(document.body);
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        m.addedNodes.forEach(scan);
        if (m.type === 'attributes' && m.target.__jdp) refresh(m.target);
      });
      if (pop && cur && !cur.input.isConnected) close();
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'value', 'class'] });
  }

  window.NopaJalali = { toJalali: toJalali, toGregorian: toGregorian, monthLength: monthLength, enhance: enhance, refresh: refresh };

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
