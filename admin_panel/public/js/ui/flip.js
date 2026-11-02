// Smooth re-renders (FLIP) for views that are rebuilt with innerHTML. Mark elements in the markup:
//   data-anim-key="unique"      matched across renders: moved ones glide, new ones fade in, removed ones fade out
//   data-anim-size="h|w|wh"     (with a key) the element's height / width also animates to its new size
//   data-anim-dash              (with a key, SVG) stroke-dasharray animates from its old value (donut segments)
//
//   NopaFlip.render(container, () => { container.innerHTML = ... });
//   NopaFlip.enter(elements)      staggered fade-up, e.g. after switching views
//   NopaFlip.count(el, n, fmt)    tweens a number shown in el.textContent
//   NopaFlip.settled()            promise: all animations started so far have finished
// Uses the Web Animations API (no style attributes, so it works under the CSP). Honours reduced motion.
(function() {
  const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const MOVE_MS = 240;
  const IN_MS = 230;
  const OUT_MS = 170;

  // Resolves once every animation started so far has finished (e.g. to show a toast after cards have moved)
  let pending = Promise.resolve();
  function track(root) {
    if (!root || typeof root.getAnimations !== 'function') return;
    const anims = root.getAnimations({ subtree: true })
      .filter(a => a.effect && a.effect.getComputedTiming().endTime !== Infinity);
    if (!anims.length) return;
    const done = Promise.all(anims.map(a => a.finished.catch(() => {})));
    pending = Promise.all([pending, done]).then(() => {});
  }
  function settled() { return pending; }

  function reduced() {
    return !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function usable(container) {
    return container && typeof container.animate === 'function' && !reduced() && container.getClientRects().length > 0;
  }

  function parentKeyEl(el) {
    return el.parentElement ? el.parentElement.closest('[data-anim-key]') : null;
  }

  function snapshot(container) {
    const map = new Map();
    container.querySelectorAll('[data-anim-key]').forEach(el => {
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) return;
      map.set(el.getAttribute('data-anim-key'), {
        el,
        rect: r,
        dash: el.hasAttribute('data-anim-dash') ? el.getAttribute('stroke-dasharray') : null,
        offset: el.hasAttribute('data-anim-dash') ? el.getAttribute('stroke-dashoffset') : null
      });
    });
    return map;
  }

  function fadeIn(el, delay) {
    el.animate(
      [{ opacity: 0, transform: 'translateY(10px) scale(0.96)' }, { opacity: 1, transform: 'none' }],
      { duration: IN_MS, easing: EASE, delay: delay || 0, fill: 'backwards' }
    );
  }

  // A removed element leaves a copy, positioned where it was, that fades and shrinks away. The copy goes into
  // the container (absolute, not fixed: a backdrop-filter / transform ancestor would move fixed elements).
  function ghostOut(container, info) {
    const { el, rect } = info;
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    const host = container.getBoundingClientRect();
    const ghost = el.cloneNode(true);
    ghost.removeAttribute('data-anim-key');
    ghost.querySelectorAll('[data-anim-key]').forEach(n => n.removeAttribute('data-anim-key'));
    ghost.setAttribute('aria-hidden', 'true');
    ghost.classList.add('nopa-flip-ghost');
    Object.assign(ghost.style, {
      position: 'absolute',
      top: (rect.top - host.top + container.scrollTop) + 'px',
      left: (rect.left - host.left + container.scrollLeft) + 'px',
      width: rect.width + 'px',
      height: rect.height + 'px',
      margin: '0',
      boxSizing: 'border-box',
      pointerEvents: 'none',
      zIndex: '5'
    });
    // a table row on its own loses its layout; show it as a block with its cells in a row
    if (el.tagName === 'TR') Object.assign(ghost.style, { display: 'flex', alignItems: 'center' });
    container.appendChild(ghost);
    const anim = ghost.animate(
      [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.9)' }],
      { duration: OUT_MS, easing: 'ease-in', fill: 'forwards' }
    );
    anim.onfinish = () => ghost.remove();
    anim.oncancel = () => ghost.remove();
  }

  function render(container, renderFn) {
    if (!usable(container)) { renderFn(); return; }
    container.querySelectorAll('.nopa-flip-ghost').forEach(g => g.remove());
    const before = snapshot(container);

    renderFn();
    // data-style is normally applied by a MutationObserver (after this task); widths etc. must be in place to measure
    if (window.NopaStyleAttr) window.NopaStyleAttr.applyAll(container);

    const seen = new Set();
    const deltas = new Map(); // element -> [dx, dy] already applied by its keyed ancestor
    let newIndex = 0;
    container.querySelectorAll('[data-anim-key]').forEach(el => {
      const key = el.getAttribute('data-anim-key');
      seen.add(key);
      const old = before.get(key);
      const parent = parentKeyEl(el);
      const inherited = (parent && deltas.get(parent)) || [0, 0];
      if (!old) {
        if (el.hasAttribute('data-anim-dash')) {
          // a new donut segment grows from zero
          el.animate([{ strokeDasharray: '0 100' }, { strokeDasharray: el.getAttribute('stroke-dasharray') }], { duration: 700, easing: EASE });
        } else if (!parent || before.has(parent.getAttribute('data-anim-key'))) {
          // inside a new keyed parent the parent's fade covers it
          fadeIn(el, Math.min(newIndex++, 8) * 35);
        }
        deltas.set(el, inherited);
        return;
      }
      const r = el.getBoundingClientRect();
      const dx = old.rect.left - r.left;
      const dy = old.rect.top - r.top;
      deltas.set(el, [dx, dy]);
      const mx = dx - inherited[0];
      const my = dy - inherited[1];
      // (an SVG arc's box changes with its length, not its position: no glide for donut segments)
      if ((Math.abs(mx) > 0.5 || Math.abs(my) > 0.5) && !el.hasAttribute('data-anim-dash')) {
        el.animate(
          [{ transform: `translate(${mx}px, ${my}px)` }, { transform: 'none' }],
          { duration: MOVE_MS, easing: EASE }
        );
      }
      const size = el.getAttribute('data-anim-size');
      if (size) {
        const frames = [{}, {}];
        if (size.includes('h') && Math.abs(old.rect.height - r.height) > 1) {
          frames[0].height = old.rect.height + 'px';
          frames[1].height = r.height + 'px';
        }
        if (size.includes('w') && Math.abs(old.rect.width - r.width) > 1) {
          frames[0].width = old.rect.width + 'px';
          frames[1].width = r.width + 'px';
        }
        if (Object.keys(frames[0]).length) {
          const prevOverflow = el.style.overflow;
          if (size.includes('h')) el.style.overflow = 'hidden';
          const anim = el.animate(frames, { duration: MOVE_MS, easing: EASE });
          const restore = () => { el.style.overflow = prevOverflow; };
          anim.onfinish = restore;
          anim.oncancel = restore;
        }
      }
      if (el.hasAttribute('data-anim-dash')) {
        const to = el.getAttribute('stroke-dasharray');
        const toOffset = el.getAttribute('stroke-dashoffset');
        if ((old.dash && old.dash !== to) || (old.offset && old.offset !== toOffset)) {
          el.animate([
            { strokeDasharray: old.dash || to, strokeDashoffset: old.offset || toOffset },
            { strokeDasharray: to, strokeDashoffset: toOffset }
          ], { duration: 700, easing: EASE });
        }
      }
    });

    // Removed: fade out, unless an ancestor that is also gone already does
    before.forEach((info, key) => {
      if (seen.has(key) || info.el.hasAttribute('data-anim-dash')) return;
      const parent = parentKeyEl(info.el);
      if (parent && !seen.has(parent.getAttribute('data-anim-key'))) return;
      ghostOut(container, info);
    });
    track(container);
  }

  function enter(elements) {
    if (reduced()) return;
    Array.from(elements || []).forEach((el, i) => {
      if (!el || typeof el.animate !== 'function') return;
      el.animate(
        [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
        { duration: 460, easing: EASE, delay: Math.min(i, 10) * 50, fill: 'backwards' }
      );
      // donut segments draw in from zero
      el.querySelectorAll('[data-anim-dash]').forEach(seg => {
        seg.animate([{ strokeDasharray: '0 100' }, { strokeDasharray: seg.getAttribute('stroke-dasharray') }],
          { duration: 900, easing: EASE, delay: 150 + i * 50, fill: 'backwards' });
      });
      track(el);
    });
  }

  // Tweens the number in el from its last value; fmt(n) builds the text
  function count(el, to, fmt) {
    if (!el) return;
    const format = fmt || (n => String(n));
    const from = Number(el.getAttribute('data-count-value'));
    el.setAttribute('data-count-value', String(to));
    if (reduced() || !Number.isFinite(from) || from === to) {
      el.textContent = format(to);
      return;
    }
    const start = performance.now();
    const dur = 700;
    const step = now => {
      if (el.getAttribute('data-count-value') !== String(to)) return; // a newer count took over
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = format(Math.round(from + (to - from) * eased));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  window.NopaFlip = { render, enter, count, settled };
})();
