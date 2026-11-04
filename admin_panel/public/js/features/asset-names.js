// Editable asset names (زریک / کلاف / قالیچه / درفش), their tile and rename dialog on the سرمایه‌ها tab, and the
// text replacement across the panel.
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

const ASSET_ICONS = {
  zarik: 'fa-coins', nakh: 'fa-circle-nodes', farsh: 'fa-rug', derafsh: 'fa-flag',
  derafsh_gold: 'fa-medal', derafsh_silver: 'fa-medal', derafsh_bronze: 'fa-medal', derafsh_cloth: 'fa-flag'
};
const ASSET_TONES = { zarik: 'u-c-accent-text', nakh: 'u-c-primary-text', farsh: 'u-c-danger-text', derafsh: 'u-c-info-text', derafsh_gold: 'u-c-accent-text' };
let assetNameRows = [];

// Runs on every panel start (bootstrap.js) and on each visit of the سرمایه‌ها tab, where the names are a tile of rows
window.loadAssetNames = async function() {
  const box = document.getElementById('asset-names-list');
  try {
    const res = await request('/api/v1/admin/assets');
    const rows = await res.json();
    if (!res.ok || !Array.isArray(rows)) throw new Error();
    assetNameRows = rows;
    window.assetNamesMap = Object.fromEntries(rows.map(r => [r.key, r.nameFa]));
    window.applyAssetNames();
    if (!box) return;
    box.innerHTML = rows.length
      ? `<ul class="lst-list">${rows.map(r => `
          <li class="lst-list-item lst-clickable" role="button" tabindex="0" data-anim-key="an:${esc(r.key)}" data-click="openAssetNameModal" data-click-args="${esc(JSON.stringify([String(r.key)]))}" title="تغییر نام">
            <i class="fa-solid ${ASSET_ICONS[r.key] || 'fa-tag'} ${ASSET_TONES[r.key] || 'u-c-text-muted'}"></i>
            <span class="lst-grow"><strong>${esc(r.nameFa)}</strong> <small class="u-c-text-muted" dir="ltr">${esc(r.key)}</small></span>
            <i class="fa-solid fa-pen u-c-text-muted"></i>
          </li>`).join('')}</ul>`
      : '<div class="lst-empty">دارایی‌ای تعریف نشده است.</div>';
  } catch (e) {
    console.error('loadAssetNames error', e);
    if (box) box.innerHTML = '<div class="lst-empty"><i class="fa-solid fa-triangle-exclamation lst-warn"></i> خطا در دریافت نام دارایی‌ها</div>';
  }
};

window.openAssetNameModal = function(key) {
  const row = assetNameRows.find(r => r.key === key);
  const modal = document.getElementById('eco-asset-modal');
  if (!row || !modal) return;
  document.getElementById('eco-asset-key').value = key;
  document.getElementById('eco-asset-key-label').textContent = key;
  document.getElementById('eco-asset-name').value = row.nameFa;
  document.getElementById('eco-asset-modal-title').textContent = `نام «${DEFAULT_ASSET_NAMES[key] || key}»`;
  modal.style.display = 'flex';
  modal.style.zIndex = 'var(--z-modal)';
  document.getElementById('eco-asset-name').focus();
};

window.saveAssetNameForm = async function(e) {
  if (e) e.preventDefault();
  const key = document.getElementById('eco-asset-key').value;
  const nameFa = document.getElementById('eco-asset-name').value.trim();
  if (await window.saveAssetName(key, nameFa)) NopaActions.hide('eco-asset-modal');
};

window.saveAssetName = async function(key, nameFa) {
  if (!nameFa) { showToast('نام دارایی نمی‌تواند خالی باشد.', 'info'); return false; }
  const res = await request(`/api/v1/admin/assets/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nameFa })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { showToast(data.error || 'خطا در ذخیره', 'error'); return false; }
  window.assetNamesMap = { ...(window.assetNamesMap || {}), [key]: nameFa };
  showToast('نام دارایی ذخیره شد. اپ در اجرای بعدی نام جدید را نشان می‌دهد؛ برای اعمال کامل در این پنل صفحه را رفرش کنید.', 'success');
  const row = assetNameRows.find(r => r.key === key);
  if (row) row.nameFa = nameFa;
  const strong = document.querySelector(`#asset-names-list [data-anim-key="an:${CSS.escape(key)}"] strong`);
  if (strong) strong.textContent = nameFa;
  return true;
};
