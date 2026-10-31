// Non-blocking toast notifications for the admin panel (bottom-left, auto-hide after 10s).
// Loaded before app.js. Replaces the blocking window.alert so no message ever locks the UI.
//   showToast(message, 'error' | 'success' | 'info', { duration })
(function () {
  var DEFAULT_DURATION = 10000;
  var MAX_VISIBLE = 5;
  var recent = {}; // message -> timestamp, to collapse bursts of the same message

  var ICONS = { error: 'fa-circle-exclamation', success: 'fa-circle-check', info: 'fa-circle-info' };

  function getContainer() {
    var c = document.getElementById('nopa-toast-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'nopa-toast-container';
      c.setAttribute('aria-live', 'polite');
      document.body.appendChild(c);
    }
    return c;
  }

  function hide(el) {
    if (!el || el.dataset.closing) return;
    el.dataset.closing = '1';
    clearTimeout(el._timer);
    el.classList.remove('show');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
  }

  // Guess the type of a legacy alert() message from its wording.
  function detectType(text) {
    var t = String(text || '');
    if (/خطا|ناموفق|نامعتبر|نادرست|اشتباه|برقرار نشد|یافت نشد|منقضی|دسترسی ندارید|مجاز نیست|غیرمجاز|❌|⚠|error|fail/i.test(t)) return 'error';
    if (/موفق|✅|ذخیره شد|ثبت شد|حذف شد|تایید شد|ارسال شد|ارسال گردید|اضافه شد|انجام شد|بروزرسانی شد|به‌روزرسانی/.test(t)) return 'success';
    if (/لطفا|لطفاً|ابتدا|الزامی|وارد کنید|انتخاب کنید|تکمیل|انتخاب نشده/.test(t)) return 'error';
    return 'info';
  }

  function showToast(message, type, opts) {
    if (message === undefined || message === null) message = '';
    var text = String(message);
    type = type || detectType(text);
    if (!ICONS[type]) type = 'info';
    var duration = (opts && opts.duration) || DEFAULT_DURATION;

    // Collapse identical messages fired within 2s (e.g. many parallel 401 responses)
    var now = Date.now();
    if (recent[text] && now - recent[text] < 2000) return null;
    recent[text] = now;

    if (!document.body) {
      document.addEventListener('DOMContentLoaded', function () { showToast(text, type, opts); });
      return null;
    }

    var container = getContainer();
    while (container.children.length >= MAX_VISIBLE) {
      clearTimeout(container.firstChild._timer);
      container.removeChild(container.firstChild);
    }

    var el = document.createElement('div');
    el.className = 'nopa-toast nopa-toast-' + type;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');

    var icon = document.createElement('i');
    icon.className = 'fa-solid ' + ICONS[type] + ' nopa-toast-icon';

    var body = document.createElement('div');
    body.className = 'nopa-toast-body';
    body.textContent = text; // textContent: messages may contain server/user data

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'nopa-toast-close';
    close.setAttribute('aria-label', 'بستن');
    close.innerHTML = '&times;';
    close.addEventListener('click', function () { hide(el); });

    var bar = document.createElement('div');
    bar.className = 'nopa-toast-progress';
    bar.style.animationDuration = duration + 'ms';

    el.appendChild(icon);
    el.appendChild(body);
    el.appendChild(close);
    el.appendChild(bar);
    container.appendChild(el);

    // Pause auto-hide while hovered
    var remaining = duration, startedAt;
    function start() { startedAt = Date.now(); el._timer = setTimeout(function () { hide(el); }, remaining); bar.style.animationPlayState = 'running'; }
    el.addEventListener('mouseenter', function () { clearTimeout(el._timer); remaining -= Date.now() - startedAt; bar.style.animationPlayState = 'paused'; });
    el.addEventListener('mouseleave', start);

    requestAnimationFrame(function () { el.classList.add('show'); });
    start();
    return el;
  }

  window.showToast = showToast;
  window.showToastError = function (m, o) { return showToast(m, 'error', o); };
  window.showToastSuccess = function (m, o) { return showToast(m, 'success', o); };
  window.showToastInfo = function (m, o) { return showToast(m, 'info', o); };

  // Route every legacy alert() through the toast (alert returns undefined either way,
  // so callers behave the same, just without blocking the page).
  window.alert = function (message) { showToast(message); };
})();