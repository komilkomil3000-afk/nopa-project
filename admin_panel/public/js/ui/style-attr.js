// data-style="…" → element.style (Phase 8). The CSP has no 'unsafe-inline' for style attributes, so markup
// and templates carry per-element styles that depend on data (progress widths, category colours) or that JS
// toggles (an initial display:none) as data-style. This applies them through the CSSOM, which the policy
// allows, so the element ends up with exactly the inline style it used to have.
//   - runs for the page as soon as it loads, then for every element inserted later (innerHTML templates)
//   - a property that JS already set on the element is left alone (code may show a panel right after rendering it)
//   - css/components.css keeps [data-style*="display:none"] hidden until this has run (no flash on load)
(function () {
  // split "a:b; c:url(x;y)" on top-level semicolons
  function declarations(text) {
    const out = [];
    let depth = 0, cur = '';
    for (const ch of text) {
      if (ch === '(') depth++;
      else if (ch === ')') depth = Math.max(0, depth - 1);
      if (ch === ';' && !depth) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur);
    return out.map(d => d.trim()).filter(Boolean);
  }

  function apply(el) {
    const text = el.getAttribute('data-style');
    el.removeAttribute('data-style');
    if (!text) return;
    declarations(text).forEach(d => {
      const i = d.indexOf(':');
      if (i < 1) return;
      const prop = d.slice(0, i).trim().toLowerCase();
      const value = d.slice(i + 1).trim();
      if (el.style.getPropertyValue(prop) !== '') return;
      el.style.setProperty(prop, value);
    });
  }

  function applyAll(root) {
    if (root.nodeType !== 1) return;
    if (root.hasAttribute('data-style')) apply(root);
    root.querySelectorAll('[data-style]').forEach(apply);
  }

  applyAll(document.documentElement);
  new MutationObserver(records => {
    records.forEach(r => {
      if (r.type === 'childList') r.addedNodes.forEach(applyAll);
      else if (r.target.hasAttribute('data-style')) apply(r.target);
    });
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-style'] });

  window.NopaStyleAttr = { applyAll };
})();
