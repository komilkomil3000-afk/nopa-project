// Name bubble for the circles in a detail page's notch (.lsv-circle in همسفران، راهبران، کاروان‌ها، منزلگاه‌ها ...).
// Hovering or focusing a circle shows its name in a small speech bubble above it (below, if there is no room).
// The notch scrolls sideways and clips anything drawn above it, so the bubble is one fixed element on <body>
// that follows whichever circle is under the pointer. The name comes from the circle's own
// `.lsv-circle-name > span` (kept in the markup, visually hidden, so screen readers still read it).
(function () {
  'use strict';
  let tip = null;
  let owner = null;

  function bubble() {
    if (tip) return tip;
    tip = document.createElement('div');
    tip.className = 'lsv-tip';
    tip.setAttribute('role', 'tooltip');
    tip.setAttribute('aria-hidden', 'true'); // the circle's own hidden name is what assistive tech reads
    tip.dir = 'rtl';
    const text = document.createElement('span');
    text.className = 'lsv-tip-text';
    tip.appendChild(text);
    document.body.appendChild(tip);
    return tip;
  }

  function nameOf(circle) {
    const span = circle.querySelector('.lsv-circle-name > span');
    return ((span && span.textContent) || circle.getAttribute('aria-label') || '').trim();
  }

  function place() {
    if (!owner || !tip) return;
    const img = owner.querySelector('.lsv-circle-img') || owner;
    const r = img.getBoundingClientRect();
    if (!owner.isConnected || (r.width === 0 && r.height === 0)) { hide(); return; }
    const w = tip.offsetWidth, h = tip.offsetHeight, gap = 10;
    const vw = document.documentElement.clientWidth;
    let top = r.top - gap - h;
    const below = top < 8;
    if (below) top = r.bottom + gap;
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, vw - w - 8));
    tip.classList.toggle('is-below', below);
    // the arrow stays under the circle even when the bubble is pushed in from the screen edge
    tip.style.setProperty('--tip-arrow', `${Math.round(r.left + r.width / 2 - left)}px`);
    tip.style.top = `${Math.round(top)}px`;
    tip.style.left = `${Math.round(left)}px`;
  }

  function show(circle) {
    // the circles carry a title too; the browser's own tooltip would pop up over the bubble
    if (circle.hasAttribute('title')) {
      if (!circle.hasAttribute('aria-label')) circle.setAttribute('aria-label', circle.getAttribute('title'));
      circle.removeAttribute('title');
    }
    const text = nameOf(circle);
    if (!text) { hide(); return; }
    owner = circle;
    const t = bubble();
    t.firstChild.textContent = text;
    t.classList.add('is-on');
    place();
  }

  function hide() {
    owner = null;
    if (tip) tip.classList.remove('is-on');
  }

  const circleOf = target => (target && target.closest ? target.closest('.lsv-circle') : null);

  document.addEventListener('mouseover', e => {
    const c = circleOf(e.target);
    if (c && c !== owner) show(c);
  });
  document.addEventListener('mouseout', e => {
    const c = circleOf(e.target);
    if (c && c === owner && !c.contains(e.relatedTarget)) hide();
  });
  document.addEventListener('focusin', e => {
    const c = circleOf(e.target);
    if (c && c.matches(':focus-visible')) show(c);
  });
  document.addEventListener('focusout', e => { if (circleOf(e.target) === owner) hide(); });
  // a click opens another page or starts a drag: the bubble would hang over the new content
  document.addEventListener('pointerdown', hide, true);
  document.addEventListener('dragstart', hide, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
  window.addEventListener('scroll', () => { if (owner) place(); }, true);
  window.addEventListener('resize', hide);
})();
