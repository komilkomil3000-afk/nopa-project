// Modal manager for every .modal-overlay (and the .drawer-content side drawers) in the panel. Loaded before
// the feature modules (js/app, js/features).
// Existing code opens modals by setting style.display (drawers: the "active" class); this watches those
// changes, so all modals get:
//   - a stack (nested modals close top-first)
//   - ESC closes the top modal (through its own close button, so cleanup handlers still run)
//   - click on the backdrop closes it, unless it contains form fields (no accidental data loss)
//     or has data-modal-static
//   - focus moves into the modal, Tab stays inside it, focus returns to the opener on close
//   - role="dialog", aria-modal and a name (aria-labelledby → the modal's heading) for screen readers
//   - the page behind does not scroll
// New code can use NopaModal.open(idOrEl) / NopaModal.close(idOrEl).
(function () {
  const stack = [];
  const opener = new WeakMap();
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const EXCLUDED = new Set(); // ids of overlays the manager should ignore
  const WATCHED = ['modal-overlay', 'drawer-content'];
  let headingSeq = 0;

  const resolve = el => (typeof el === 'string' ? document.getElementById(el) : el);
  const isDrawer = el => el.classList.contains('drawer-content');
  const isOpen = el => el.isConnected && (isDrawer(el) ? el.classList.contains('active')
    : getComputedStyle(el).display !== 'none' && !el.classList.contains('hidden'));
  const visibleFocusables = el => Array.from(el.querySelectorAll(FOCUSABLE)).filter(n => n.offsetParent !== null);
  const watched = n => n.nodeType === 1 && WATCHED.some(c => n.classList.contains(c));

  // Name the dialog after its first visible heading (titles are often rewritten when the modal opens)
  function label(el) {
    if (el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby')))) return;
    const h = Array.from(el.querySelectorAll('h1, h2, h3, h4')).find(n => n.offsetParent !== null && n.textContent.trim());
    if (!h) return;
    if (!h.id) h.id = 'nopa-dialog-title-' + (++headingSeq);
    el.setAttribute('aria-labelledby', h.id);
  }

  function onOpened(el) {
    if (stack.includes(el)) return;
    opener.set(el, document.activeElement);
    stack.push(el);
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    label(el);
    document.body.classList.add('modal-open');
    // Focus the first field (or the dialog itself) once it is laid out
    requestAnimationFrame(() => {
      if (!isOpen(el) || el.contains(document.activeElement)) return;
      const first = visibleFocusables(el).find(n => !n.classList.contains('modal-close')) || visibleFocusables(el)[0];
      if (first) first.focus({ preventScroll: true });
    });
  }

  function onClosed(el) {
    const i = stack.indexOf(el);
    if (i === -1) return;
    stack.splice(i, 1);
    if (!stack.length) document.body.classList.remove('modal-open');
    const back = opener.get(el);
    if (back && back.isConnected && typeof back.focus === 'function') back.focus({ preventScroll: true });
  }

  function sync(el) {
    if (EXCLUDED.has(el.id)) return;
    if (isOpen(el)) onOpened(el); else onClosed(el);
  }

  function close(el) {
    el = resolve(el);
    if (!el) return;
    // Prefer the modal's own close control: it may reset state (e.g. closeCaravanDrawer)
    const btn = el.querySelector('.modal-close, [data-modal-close]');
    if (btn && btn.offsetParent !== null) btn.click();
    if (isOpen(el)) { if (isDrawer(el)) el.classList.remove('active'); else el.style.display = 'none'; }
  }

  function open(el) {
    el = resolve(el);
    if (!el) return;
    el.classList.remove('hidden');
    el.style.display = 'flex';
  }

  const top = () => {
    for (let i = stack.length - 1; i >= 0; i--) if (isOpen(stack[i])) return stack[i];
    return null;
  };

  document.addEventListener('keydown', e => {
    const el = top();
    if (!el) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close(el);
    } else if (e.key === 'Tab') {
      const items = visibleFocusables(el);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (!el.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // Backdrop click (mousedown + click both on the overlay, so a text selection drag never closes it)
  let downOnBackdrop = null;
  document.addEventListener('mousedown', e => { downOnBackdrop = e.target.classList && e.target.classList.contains('modal-overlay') ? e.target : null; });
  document.addEventListener('click', e => {
    const el = e.target;
    if (el !== downOnBackdrop || el !== top()) return;
    if (el.hasAttribute('data-modal-static') || el.querySelector('input:not([type="hidden"]), textarea, select')) return;
    close(el);
  });

  function watch() {
    const observer = new MutationObserver(records => {
      const touched = new Set();
      records.forEach(r => {
        if (r.type === 'attributes' && r.target.classList && watched(r.target)) touched.add(r.target);
        if (r.type === 'childList') {
          r.addedNodes.forEach(n => { if (watched(n)) touched.add(n); });
          r.removedNodes.forEach(n => { if (n.nodeType === 1 && stack.includes(n)) onClosed(n); });
        }
      });
      touched.forEach(sync);
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class'] });
    document.querySelectorAll('.modal-overlay, .drawer-content').forEach(sync);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
  else watch();

  window.NopaModal = { open, close, top, stack };
})();
