// Delegated event handlers — replaces inline on…="" attributes (Phase 7), so the CSP can drop
// 'unsafe-inline' for script attributes. Loaded before the feature modules.
//
//   <button data-click="openUserModal" data-click-args='["u1", "$this"]'>
//   <input  data-change="toggleChannelOverride" data-change-args='["sms", "$checked"]'>
//
// data-<event> names a global function (dotted paths allowed); data-<event>-args is a JSON array.
// Argument tokens: "$this" (the element), "$event", "$value" (this.value), "$checked" (this.checked),
// {"$closest": "<selector>"} (this.closest(selector)).
// Like inline handlers: handlers on ancestors run too (innermost first) unless one calls
// event.stopPropagation(); a handler returning false prevents the default action.
(function () {
  const BUBBLING = ['click', 'change', 'input', 'submit', 'keydown', 'keyup'];
  const CAPTURED = ['error', 'load']; // do not bubble: listen in the capture phase

  function resolve(name) {
    let fn = window;
    for (const part of String(name).split('.')) { fn = fn == null ? undefined : fn[part]; }
    return typeof fn === 'function' ? fn : null;
  }

  function args(el, type, event) {
    const raw = el.getAttribute(`data-${type}-args`);
    if (!raw) return [];
    let list;
    try { list = JSON.parse(raw); } catch (e) { console.error(`bad data-${type}-args on`, el, e); return []; }
    return list.map(a => {
      if (a === '$this') return el;
      if (a === '$event') return event;
      if (a === '$value') return el.value;
      if (a === '$checked') return el.checked;
      if (a && typeof a === 'object' && a.$closest) return el.closest(a.$closest);
      return a;
    });
  }

  function run(el, type, event) {
    const name = el.getAttribute(`data-${type}`);
    const fn = resolve(name);
    // <a href="#" data-click="…"> is a keyboard-reachable button: never navigate to "#" (the router listens to the hash)
    if (type === 'click' && el.matches('a[href="#"]')) event.preventDefault();
    if (!fn) { console.error(`data-${type}: "${name}" is not a function`); return; }
    const result = fn.apply(window, args(el, type, event));
    if (result === false) event.preventDefault();
  }

  function dispatch(type) {
    return event => {
      let el = event.target instanceof Element ? event.target.closest(`[data-${type}]`) : null;
      while (el) {
        run(el, type, event);
        if (event.cancelBubble) break; // stopPropagation() inside a handler
        el = el.parentElement ? el.parentElement.closest(`[data-${type}]`) : null;
      }
    };
  }

  BUBBLING.forEach(t => document.addEventListener(t, dispatch(t)));
  CAPTURED.forEach(t => document.addEventListener(t, event => {
    const el = event.target;
    if (el instanceof Element && el.hasAttribute(`data-${t}`)) run(el, t, event);
  }, true));

  // Small helpers for handlers that used to be one-line statements
  window.NopaActions = {
    hide: id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; },
    show: (id, display) => { const e = document.getElementById(id); if (e) e.style.display = display || 'block'; },
    removeClosest: (el, selector) => { const t = el && el.closest(selector); if (t) t.remove(); },
    // live preview of an image URL typed into an input
    previewSrc: (id, value) => { const img = document.getElementById(id); if (img) img.src = value; },
    previewSrcIn: (el, scopeSelector, targetSelector) => {
      const scope = el.closest(scopeSelector);
      const img = scope && scope.querySelector(targetSelector);
      if (img) img.src = el.value;
    },
    setTextIn: (el, scopeSelector, targetSelector) => {
      const scope = el.closest(scopeSelector);
      const t = scope && scope.querySelector(targetSelector);
      if (t) t.textContent = el.value;
    },
    setTextById: (id, value) => { const t = document.getElementById(id); if (t) t.textContent = value; },
    hideSelf: el => { el.style.display = 'none'; },
    setVisibility: (el, value) => { el.style.visibility = value; },
    // <img data-error="NopaActions.fallbackSrc" data-error-args='["$this", "/uploads/x.jpg"]'>
    fallbackSrc: (el, src) => { if (!el.dataset.fellBack) { el.dataset.fellBack = '1'; el.src = src; } },
    // call fn when Enter is pressed (keydown)
    onEnter: (event, name) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      const fn = resolve(name);
      if (fn) fn();
    },
  };
})();
