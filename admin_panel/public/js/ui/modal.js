// Modal manager for every .modal-overlay (and the .drawer-content side drawers) in the panel. Loaded before
// the feature modules (js/app, js/features).
// Existing code opens modals by setting style.display (drawers: the "active" class); this watches those
// changes, so all modals get:
//   - a stack (nested modals close top-first)
//   - ESC closes the top modal (through its own close button, so cleanup handlers still run)
//   - click on the backdrop closes it, unless it has unsaved edits: a field the user focused no longer holds the
//     value it had then (search boxes and [data-modal-nodirty] fields don't count), or the modal's own guard
//     (NopaModal.guard(id, fn)) says so. Then it stays open, gives a small shake and says why. A form submit
//     inside it counts as saved. data-modal-static keeps a modal open on any backdrop click.
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

  // ---- unsaved edits ----
  const edited = new WeakMap(); // modal -> Map(field -> value when the user first focused it)
  const guards = new Map();     // modal id -> () => true while it must stay open
  const fieldValue = f => (f.type === 'checkbox' || f.type === 'radio' ? f.checked : f.value);
  const IGNORED_FIELD = 'input[type="hidden"], input[type="search"], input[type="button"], input[type="submit"], input[type="file"], [data-modal-nodirty], [data-modal-nodirty] *, .search-box *';

  document.addEventListener('focusin', e => {
    const f = e.target;
    if (!(f instanceof Element) || !f.matches('input, textarea, select') || f.matches(IGNORED_FIELD)) return;
    const el = f.closest('.modal-overlay');
    if (!el || !stack.includes(el)) return;
    if (!edited.has(el)) edited.set(el, new Map());
    const fields = edited.get(el);
    if (!fields.has(f)) fields.set(f, fieldValue(f));
  });
  // a submitted form inside a modal is saved
  document.addEventListener('submit', e => {
    const el = e.target instanceof Element ? e.target.closest('.modal-overlay') : null;
    if (el) edited.delete(el);
  }, true);

  function hasUnsaved(el) {
    // a modal with its own guard (it knows its draft) is not second-guessed by the field check
    const guard = el.id && guards.get(el.id);
    if (guard) { try { return !!guard(); } catch (_) { return false; } }
    const fields = edited.get(el);
    if (!fields) return false;
    for (const [f, value] of fields) {
      if (f.isConnected && el.contains(f) && fieldValue(f) !== value) return true;
    }
    return false;
  }

  let lastNudge = 0;
  function nudge(el) {
    const box = el.firstElementChild;
    if (box && typeof box.animate === 'function' && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      box.animate([{ transform: 'none' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(7px)' }, { transform: 'translateX(-4px)' }, { transform: 'none' }], { duration: 320, easing: 'ease-out' });
    }
    if (Date.now() - lastNudge > 2500 && typeof window.showToast === 'function') {
      window.showToast('تغییرات ذخیره‌نشده دارید؛ ابتدا ذخیره کنید یا با دکمه بستن خارج شوید.', 'info');
    }
    lastNudge = Date.now();
  }

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
    edited.delete(el);
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
    if (el.hasAttribute('data-modal-static')) return;
    if (hasUnsaved(el)) { nudge(el); return; }
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

  // fn() returns true while the modal must not close on a backdrop click (e.g. a draft not saved yet)
  function guard(idOrEl, fn) {
    const el = resolve(idOrEl);
    const id = el ? el.id : String(idOrEl);
    if (id) guards.set(id, fn);
  }

  window.NopaModal = { open, close, top, stack, guard, hasUnsaved: el => { el = resolve(el); return !!el && hasUnsaved(el); } };
})();
