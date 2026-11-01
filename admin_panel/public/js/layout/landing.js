// Public landing page (#landing-view), shown while signed out. Loaded before the feature modules (js/app, js/features).
// - [data-open-login] opens the existing login modal (#login-modal / #admin-login-form)
// - [data-scroll-to="id"] scrolls to a section (no hash: the hash belongs to the panel router)
// - Header hides while scrolling down and returns on any scroll up (same feel as the panel header)
// - Sections fade in as they enter the viewport (skipped with prefers-reduced-motion)
// - A panel link opened while signed out (e.g. /admin/#caravans) opens the login straight away;
//   after login the router takes the user to that tab.
(function () {
  const $ = id => document.getElementById(id);
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function openLogin() {
    if (window.NopaModal) NopaModal.open('login-modal');
    else $('login-modal').style.display = 'flex';
    requestAnimationFrame(() => {
      const phone = $('login-phone');
      if (phone) phone.focus();
    });
  }

  function onShow() {
    const hasPanelHash = window.NopaRouter && NopaRouter.tabFromHash(window.location.hash);
    if (hasPanelHash) openLogin();
  }

  function watchHeader() {
    const header = $('landing-header');
    if (!header) return;
    let lastY = window.scrollY || 0;
    let ticking = false;
    const update = () => {
      ticking = false;
      if (document.documentElement.getAttribute('data-session') !== 'out') return;
      const y = Math.max(0, window.scrollY || 0);
      header.classList.toggle('is-scrolled', y > 8);
      const delta = y - lastY;
      if (y <= 72 || delta < 0) header.classList.remove('is-hidden');
      else if (delta > 8) header.classList.add('is-hidden');
      else return;
      lastY = y;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    header.addEventListener('focusin', () => header.classList.remove('is-hidden'));
  }

  function watchReveal() {
    const items = document.querySelectorAll('#landing-view [data-reveal]');
    if (reduceMotion || !('IntersectionObserver' in window)) return; // content simply stays visible
    document.documentElement.classList.add('landing-reveal'); // hidden-until-visible only from here on
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-visible');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(el => io.observe(el));
  }

  function init() {
    const view = $('landing-view');
    if (!view) return;
    view.addEventListener('click', e => {
      if (e.target.closest('[data-open-login]')) {
        e.preventDefault();
        openLogin();
        return;
      }
      const jump = e.target.closest('[data-scroll-to]');
      if (jump) {
        e.preventDefault();
        const target = $(jump.dataset.scrollTo);
        if (target) target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      }
    });
    watchHeader();
    watchReveal();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.NopaLanding = { openLogin, onShow };
})();
