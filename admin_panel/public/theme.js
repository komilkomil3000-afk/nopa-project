// Dark / light theme for the admin panel. Loaded in <head> (before first paint) so there is no flash.
// - Default follows the OS (prefers-color-scheme) until the user picks one; the pick is stored.
// - Any element with [data-theme-toggle] toggles the theme.
// - Charts (Chart.js) are re-coloured on change; listen to 'nopa:themechange' for anything else.
(function () {
  var KEY = 'nopa_theme';
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function stored() {
    try { var v = localStorage.getItem(KEY); return v === 'dark' || v === 'light' ? v : null; } catch (_) { return null; }
  }
  function preferred() {
    return stored() || (media && !media.matches ? 'light' : 'dark');
  }
  function cssVar(name) {
    return getComputedStyle(root).getPropertyValue(name).trim();
  }

  function syncChrome(theme) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', cssVar('--bg') || (theme === 'light' ? '#F7F5FC' : '#120C1F'));
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      var next = theme === 'dark' ? 'روشن' : 'تاریک';
      btn.setAttribute('aria-label', 'تغییر به تم ' + next);
      btn.setAttribute('title', 'تغییر به تم ' + next);
      var icon = btn.querySelector('i');
      if (icon) icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    });
  }

  function syncCharts() {
    if (!window.Chart) return;
    var text = cssVar('--text-muted');
    var grid = cssVar('--border');
    window.Chart.defaults.color = text;
    window.Chart.defaults.borderColor = grid;
    window.Chart.defaults.font.family = "'YekanBakh', Tahoma, sans-serif";
    var instances = window.Chart.instances || {};
    Object.keys(instances).forEach(function (k) {
      var chart = instances[k];
      try {
        var scales = (chart.options && chart.options.scales) || {};
        Object.keys(scales).forEach(function (s) {
          if (scales[s].ticks) scales[s].ticks.color = text;
          if (scales[s].grid) scales[s].grid.color = grid;
          if (scales[s].pointLabels) scales[s].pointLabels.color = text;
          if (scales[s].angleLines) scales[s].angleLines.color = grid;
        });
        var legend = chart.options && chart.options.plugins && chart.options.plugins.legend;
        if (legend && legend.labels) legend.labels.color = text;
        chart.update('none');
      } catch (_) { /* a chart being destroyed */ }
    });
  }

  function apply(theme, persist) {
    root.setAttribute('data-theme', theme);
    if (persist) { try { localStorage.setItem(KEY, theme); } catch (_) { /* storage blocked */ } }
    if (document.readyState !== 'loading') {
      syncChrome(theme);
      syncCharts();
    }
    try { window.dispatchEvent(new CustomEvent('nopa:themechange', { detail: { theme: theme } })); } catch (_) { /* old browser */ }
  }

  window.NopaTheme = {
    get: function () { return root.getAttribute('data-theme') || 'dark'; },
    set: function (theme) {
      root.classList.add('theme-animating');
      apply(theme === 'light' ? 'light' : 'dark', true);
      setTimeout(function () { root.classList.remove('theme-animating'); }, 300);
    },
    toggle: function () { this.set(this.get() === 'dark' ? 'light' : 'dark'); },
    cssVar: cssVar,
    // rgba() string from a "*-rgb" token, for canvas (charts) which cannot read var()
    rgba: function (name, alpha) {
      var parts = cssVar(name).split(/\s+/);
      return 'rgba(' + parts.join(',') + ',' + (alpha == null ? 1 : alpha) + ')';
    },
    syncCharts: syncCharts
  };

  // Reduced motion (OS setting): CSS handles transitions/animations (css/components.css);
  // JS scrolling and Chart.js animations ask here.
  var motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  window.NopaMotion = {
    reduced: function () { return !!(motionQuery && motionQuery.matches); },
    scrollBehavior: function () { return this.reduced() ? 'auto' : 'smooth'; }
  };

  apply(preferred(), false);

  // Signed in or not, decided before first paint so neither the landing page nor the panel flashes.
  // css/landing.css hides #landing-view for "in"; js/app/bootstrap.js keeps the flag current (login / logout / expiry).
  try { root.setAttribute('data-session', localStorage.getItem('nopa_admin_token') ? 'in' : 'out'); } catch (_) { root.setAttribute('data-session', 'out'); }

  if (media && media.addEventListener) {
    media.addEventListener('change', function () { if (!stored()) apply(preferred(), false); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    syncChrome(window.NopaTheme.get());
    if (window.Chart && window.NopaMotion.reduced()) window.Chart.defaults.animation = false;
    syncCharts();
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[data-theme-toggle]')) window.NopaTheme.toggle();
    });
  });
})();
