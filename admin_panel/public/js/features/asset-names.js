// Editable asset names (زریک / کلاف / قالیچه / درفش) and the text replacement across the panel.
// Split out of the former app.js (Phase 7). Classic script: shares globals with the other modules;
// load order is set in index.html.

// ---- Editable asset names ----
// The panel's texts are written with the default names. Once the server's names are loaded every text node
// (and placeholder/title) that contains a default name is rewritten to the current one, and a MutationObserver
// does the same for content rendered later. Names change on page refresh, not live.
const DEFAULT_ASSET_NAMES = {
  zarik: 'زریک', nakh: 'کلاف', farsh: 'قالیچه', derafsh: 'درفش',
  derafsh_gold: 'درفش طلایی', derafsh_silver: 'درفش نقره‌ای', derafsh_bronze: 'درفش برنزی', derafsh_cloth: 'درفش پارچه‌ای'
};
const ASSET_REPLACE_ORDER = ['derafsh_gold', 'derafsh_silver', 'derafsh_bronze', 'derafsh_cloth', 'derafsh', 'zarik', 'nakh', 'farsh'];
window.assetNamesMap = { ...DEFAULT_ASSET_NAMES };
window.assetName = key => (window.assetNamesMap && window.assetNamesMap[key]) || DEFAULT_ASSET_NAMES[key] || key;

(function() {
  let activeRules = [];
  const processed = new WeakMap();
  let observer = null;

  function convert(text) {
    if (!text || !activeRules.length) return text;
    let out = text;
    // default -> token first, so a new name containing another default word is never replaced twice
    activeRules.forEach((r, i) => { out = out.split(r.from).join(`\u0001${i}\u0001`); });
    activeRules.forEach((r, i) => { out = out.split(`\u0001${i}\u0001`).join(r.to); });
    return out;
  }

  function processTextNode(node) {
    const value = node.nodeValue;
    if (!value || processed.get(node) === value) return;
    const next = convert(value);
    processed.set(node, next);
    if (next !== value) node.nodeValue = next;
  }

  function processElement(el) {
    if (el.nodeType === 3) { processTextNode(el); return; }
    if (el.nodeType !== 1 || /^(SCRIPT|STYLE|TEXTAREA)$/.test(el.tagName)) return;
    ['placeholder', 'title'].forEach(attr => {
      const v = el.getAttribute && el.getAttribute(attr);
      if (v) { const n = convert(v); if (n !== v) el.setAttribute(attr, n); }
    });
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      if (node.nodeType === 3) {
        if (!/^(SCRIPT|STYLE|TEXTAREA)$/.test(node.parentNode.tagName)) processTextNode(node);
      } else if (node.getAttribute) {
        ['placeholder', 'title'].forEach(attr => {
          const v = node.getAttribute(attr);
          if (v) { const n = convert(v); if (n !== v) node.setAttribute(attr, n); }
        });
      }
      node = walker.nextNode();
    }
  }

  window.applyAssetNames = function() {
    activeRules = ASSET_REPLACE_ORDER
      .map(k => ({ from: DEFAULT_ASSET_NAMES[k], to: window.assetName(k) }))
      .filter(r => r.from !== r.to);
    if (!activeRules.length) return;
    processElement(document.body);
    if (!observer) {
      observer = new MutationObserver(muts => {
        muts.forEach(m => {
          if (m.type === 'characterData') processTextNode(m.target);
          else m.addedNodes.forEach(n => processElement(n));
        });
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  };
})();

window.loadAssetNames = async function() {
  const box = document.getElementById('asset-names-list');
  try {
    const res = await request('/api/v1/admin/assets');
    const rows = await res.json();
    if (!res.ok) return;
    window.assetNamesMap = Object.fromEntries(rows.map(r => [r.key, r.nameFa]));
    window.applyAssetNames();
    if (!box) return;
    box.innerHTML = rows.map(r => `
      <div class="u-flex u-gap-6 u-items-center">
        <span class="u-fs-11 u-c-text-muted u-minw-78">${esc(r.key)}</span>
        <input type="text" id="asset-name-${r.key}" value="${esc(r.nameFa)}" maxlength="30" class="u-flex-1 u-p-6-10 u-bg-surface-2 u-bd-border-strong u-r-6 u-c-text u-fs-12_5">
        <button type="button" data-click="saveAssetName" data-click-args="${esc(JSON.stringify([String(r.key)]))}" class="btn-action u-p-5-10 u-fs-11 u-pointer">ذخیره</button>
      </div>`).join('');
  } catch (e) { console.error('loadAssetNames error', e); }
};

window.saveAssetName = async function(key) {
  const nameFa = document.getElementById(`asset-name-${key}`)?.value.trim();
  if (!nameFa) { showToast('نام دارایی نمی‌تواند خالی باشد.', 'info'); return; }
  const res = await request(`/api/v1/admin/assets/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nameFa })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { showToast(data.error || 'خطا در ذخیره', 'error'); return; }
  window.assetNamesMap = { ...(window.assetNamesMap || {}), [key]: nameFa };
  showToast('نام دارایی ذخیره شد. اپ در اجرای بعدی نام جدید را نشان می‌دهد؛ برای اعمال کامل در این پنل صفحه را رفرش کنید.', 'success');
};
