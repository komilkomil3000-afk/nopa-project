# JS patterns

A complete skeleton for a converted tab, distilled from `js/features/caravans.js` and `js/features/mentors.js`.
Replace `xxx` / `Xxx` with the page prefix, `/api/v1/admin/things` with the real route, and the field names with the
real ones. Keep the order of the sections; each one is there for a behaviour the other tabs have.

Contents: [State and helpers](#state-and-helpers) · [Loader](#loader) · [Bento](#bento) · [Shimmer](#shimmer) ·
[Open / close / select](#open--close--select) · [Paint](#paint) · [Detail loader](#detail-loader) ·
[Dialogs](#dialogs) · [Messenger](#messenger) · [Registering the tab](#registering-the-tab)

## State and helpers

```js
// Things: bento overview (#xxx-overview-view) and one thing's page (#xxx-detail-view), like the caravans tab.
// Styles: css/stations.css (.lst-*, .lsv-*, .crv-*, .xxx-*). Helpers crvAvatar / crvFa / crvArgs / crvInitial /
// crvFadeOut come from js/features/caravans.js and mntFitNotch from js/features/mentors.js (both load earlier).
window.xxxList = [];
window.xxxActiveId = null;
window.xxxRenderedId = null;
const xxxDetailCache = new Map();   // id -> second-request data (kept for next time)

function xxxFind(id) { return (window.xxxList || []).find(x => String(x.id) === String(id)) || null; }
function xxxStatusChip(x) {
  return x.isActive === false
    ? '<span class="lst-chip lst-chip-locked"><i class="fa-solid fa-pause"></i> غیرفعال</span>'
    : '<span class="lst-chip lst-chip-active"><i class="fa-solid fa-circle-check"></i> فعال</span>';
}
```

## Loader

The router calls this on every visit. It shimmers, fetches, redraws, and keeps an open detail page in sync
(a deleted item sends the user back to the overview).

```js
window.loadXxx = async function() {
  window.xxxSetLoading(true);
  try {
    const res = await request('/api/v1/admin/things');
    if (!res.ok) throw new Error('خطا در دریافت فهرست');
    const data = await res.json();
    window.xxxList = Array.isArray(data) ? data : (data.data || []);
    window.xxxSetLoading(false);
    window.filterXxxList();
    if (window.xxxActiveId) {
      if (xxxFind(window.xxxActiveId)) { xxxDetailCache.delete(String(window.xxxActiveId)); window.loadXxxPage(); }
      else window.closeXxxView();
    }
  } catch (err) {
    console.error('loadXxx error:', err);
    window.xxxSetLoading(false);
    const grid = document.getElementById('xxx-bento-list');
    if (grid) grid.innerHTML = `<div class="lst-empty"><i class="fa-solid fa-triangle-exclamation lst-warn"></i> ${esc(err.message)}</div>`;
  }
};
```

## Bento

All drawing goes through `NopaFlip.render` so filtering/sorting animates. Each tile's renderer guards for its element.

```js
window.filterXxxList = function() {
  const overview = document.getElementById('xxx-overview-view');
  if (window.NopaFlip && overview) window.NopaFlip.render(overview, xxxDrawBento); else xxxDrawBento();
};

function xxxCard(x) {
  return `
    <button type="button" class="crv-card" data-anim-key="xx:${esc(x.id)}" data-click="openXxxView" data-click-args="${crvArgs(x.id)}" title="ورود به ${esc(x.name)}">
      <span class="crv-card-top">
        ${crvAvatar(x.avatarUrl, x.name, 'crv-card-cover')}
        <span class="crv-card-name"><strong>${esc(x.name)}</strong>${xxxStatusChip(x)}</span>
      </span>
      <span class="crv-card-mentor"><i class="fa-solid fa-ICON"></i><span>${esc(x.subtitle || '')}</span></span>
      <span class="crv-card-foot"><span class="crv-card-nums"><span class="u-c-accent-text"><i class="fa-solid fa-coins"></i> ${crvFa(x.total)}</span></span></span>
    </button>`;
}

function xxxDrawBento() {
  const all = window.xxxList || [];
  const q = (document.getElementById('xxx-search')?.value || '').trim().toLowerCase();
  const status = document.getElementById('xxx-status-filter')?.value || 'all';
  const list = all.filter(x => (status === 'all' || x.status === status) &&
    (!q || [x.name, x.phoneNumber].some(v => String(v || '').toLowerCase().includes(q))));
  const filtering = !!q || status !== 'all';

  const badge = document.getElementById('xxx-count-badge');
  if (badge) badge.textContent = filtering ? `نمایش ${crvFa(list.length)} از ${crvFa(all.length)}` : 'برای ورود به صفحه هر مورد بزنید';

  const grid = document.getElementById('xxx-bento-list');
  if (grid) {
    const cards = list.map(xxxCard);
    if (!filtering) cards.push(`
      <button type="button" class="crv-card crv-card-add" data-anim-key="xx-add" data-click="openXxxModal" title="ثبت مورد جدید">
        <span class="lsv-round lsv-round-lg"><i class="fa-solid fa-plus"></i></span><span>مورد جدید</span>
      </button>`);
    else if (!list.length) cards.push('<div class="lst-empty" data-anim-key="xx-empty">موردی با این مشخصات یافت نشد.</div>');
    grid.innerHTML = cards.join('');
    grid.setAttribute('aria-busy', 'false');
  }

  const setStat = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setStat('xxx-stat-total', crvFa(all.length));
  // … the other tiles: stats from ALL items (not the filtered list), lists sliced to 4–6 rows,
  //   each with an .lst-empty message when there is nothing to show
}
```

## Shimmer

```js
// The stations tab's: a light band sweeps over each tile until the data arrives; the first load shows skeletons
window.xxxSetLoading = function(on) {
  const overview = document.getElementById('xxx-overview-view');
  if (!overview) return;
  overview.querySelectorAll('.lst-bento > .lst-tile').forEach(t => t.classList.toggle('is-loading', on));
  const grid = document.getElementById('xxx-bento-list');
  if (grid) grid.setAttribute('aria-busy', on ? 'true' : 'false');
  if (!on || (window.xxxList || []).length) return;   // a refresh keeps the old content under the shimmer
  if (grid) grid.innerHTML = Array.from({ length: 6 }, () => `
    <div class="crv-card lst-skel" aria-hidden="true">
      <span class="crv-card-top"><span class="crv-card-cover"></span><span class="crv-card-name"><span class="lst-skel-line"></span><span class="lst-skel-line lst-skel-chip"></span></span></span>
      <span class="lst-skel-line lst-skel-short"></span><span class="lst-skel-line"></span><span class="lst-skel-line lst-skel-short"></span>
    </div>`).join('');
  const lines = '<div class="lst-skel-lines" aria-hidden="true">' + '<span class="lst-skel-row"></span>'.repeat(3) + '</div>';
  ['xxx-bento-status', 'xxx-bento-top', 'xxx-bento-health'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = lines; });
};

// at the end of the file: the tab starts in its loading state until the first fetch finishes
if (!(window.xxxList || []).length) window.xxxSetLoading(true);
```

## Open / close / select

```js
window.openXxxView = function(id) {
  const overview = document.getElementById('xxx-overview-view');
  window.xxxActiveId = String(id);
  crvFadeOut(overview, () => {
    window.loadXxxPage();
    document.getElementById('xxx-tab')?.scrollIntoView({ block: 'start', behavior: NopaMotion.scrollBehavior() });
  });
};

window.closeXxxView = function() {
  const view = document.getElementById('xxx-detail-view');
  const overview = document.getElementById('xxx-overview-view');
  window.xxxActiveId = null;
  window.xxxRenderedId = null;
  crvFadeOut(view, () => {
    if (window.xxxActiveId) return;   // another item was opened meanwhile
    if (view) view.style.display = 'none';
    if (overview) {
      overview.style.display = '';
      if (window.NopaFlip) window.NopaFlip.enter(overview.querySelectorAll(':scope > div:first-child, .lst-bento > .lst-tile'));
    }
  });
};

// circles = sibling items: switching re-opens the page for that item
window.selectXxxCircle = function(id) { window.xxxActiveId = String(id); window.loadXxxPage(); };
// circles = the item's children: keep a second id (e.g. window.xxxActiveChildId), repaint with NopaFlip.render
//   and pop the picked circle — see selectMentorCaravan in js/features/mentors.js
```

## Paint

One function draws the whole page from (item, detail|null). `null` means the second request is still loading:
those parts show skeleton rows and `.is-loading`.

```js
function xxxCircles(activeId) {
  return (window.xxxList || []).map(x => {
    const active = String(x.id) === String(activeId);
    return `
      <button type="button" class="lsv-circle${active ? ' is-active' : ''}" data-anim-key="c:${esc(x.id)}" data-click="selectXxxCircle" data-click-args="${crvArgs(x.id)}" title="${esc(x.name)}"${active ? ' aria-current="true"' : ''}>
        <span class="lsv-circle-main">
          <span class="lsv-circle-img">${x.avatarUrl ? `<img src="${esc(x.avatarUrl)}" alt="" loading="lazy" data-error="lmsImageFallback" data-error-args='["$this", "${crvInitial(x.name)}"]'>` : `<span>${crvInitial(x.name)}</span>`}</span>
          <span class="lsv-circle-badge lsv-state-active">${crvFa(x.count)}</span>
        </span>
        <span class="lsv-circle-name"><span>${esc(x.name)}</span></span>
      </button>`;
  }).join('') + `
      <button type="button" class="lsv-circle lsv-circle-add" data-anim-key="c-add" data-click="openXxxModal" title="افزودن" aria-label="افزودن">
        <span class="lsv-circle-main"><span class="lsv-circle-img"><i class="fa-solid fa-plus"></i></span><span class="lsv-circle-badge lsv-state-add"><i class="fa-solid fa-plus"></i></span></span>
        <span class="lsv-circle-name"><span>افزودن</span></span>
      </button>`;
}

function xxxPaint(x, detail) {
  const set = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };
  set('xxx-title', el => { el.textContent = x.name; });
  set('xxx-state', el => { el.innerHTML = xxxStatusChip(x); });
  set('xxx-sub', el => { el.textContent = '…'; });
  set('xxx-circles', el => { el.innerHTML = xxxCircles(x.id); });
  set('xxx-info-card', el => { el.innerHTML = /* identity card markup */ ''; });

  const rows = detail ? (detail.rows || []) : null;
  set('xxx-list-count', el => { el.textContent = rows === null ? '…' : crvFa(rows.length); });
  set('xxx-list-card', el => { el.classList.toggle('is-loading', !detail); });
  set('xxx-list', el => {
    if (!detail) {
      el.innerHTML = Array.from({ length: 4 }, () => `
        <div class="lsv-row crv-member" aria-hidden="true"><span class="lsv-row-avatar lst-skel-avatar"></span>
          <span class="lsv-row-text"><span class="lst-skel-line"></span><span class="lst-skel-line lst-skel-short"></span></span></div>`).join('');
      return;
    }
    el.innerHTML = rows.length ? rows.map(r => `<div class="lsv-row crv-member" data-anim-key="r:${esc(r.id)}">…</div>`).join('')
      : '<div class="lsv-col-empty">هنوز موردی ثبت نشده است.</div>';
  });
}
```

## Detail loader

```js
window.loadXxxPage = async function() {
  const view = document.getElementById('xxx-detail-view');
  const overview = document.getElementById('xxx-overview-view');
  const id = window.xxxActiveId;
  const x = id && xxxFind(id);
  if (!view || !x) return;

  const cached = xxxDetailCache.get(id) || null;
  const wasOpen = view.style.display !== 'none';
  const same = wasOpen && window.xxxRenderedId === id;
  window.xxxRenderedId = id;
  if (overview) overview.style.display = 'none';
  view.style.display = 'block';
  if (same && window.NopaFlip) window.NopaFlip.render(view, () => xxxPaint(x, cached));
  else {
    xxxPaint(x, cached);
    if (window.NopaFlip) {
      // switching items keeps the header and circles still; opening animates everything in
      window.NopaFlip.enter(view.querySelectorAll(wasOpen ? '.xxx-flow > .lsv-col, .xxx-flow > .lsv-link'
                                                          : '.lsv-head, .lsv-board, .lsv-notch .lsv-circle, .xxx-flow > .lsv-col'));
      const picked = wasOpen && view.querySelector('.lsv-circle.is-active .lsv-circle-img');
      if (picked && typeof picked.animate === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        picked.animate([{ transform: 'scale(0.8)' }, { transform: 'scale(1.12)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
      }
    }
  }
  mntFitNotch(view);   // cut the board's notch around the circles and centre the active one
  if (cached) return;  // or always refresh, like the caravans page, if the data changes often

  let detail = null;
  try {
    const res = await request(`/api/v1/admin/things/${encodeURIComponent(id)}`);
    if (res.ok) detail = await res.json();
  } catch (_) {}
  if (window.xxxActiveId !== id) return;   // the user moved on while this loaded
  if (!detail) { xxxPaint(x, { rows: [] }); return; }   // or show an error row in the column
  xxxDetailCache.set(id, detail);
  if (window.NopaFlip) window.NopaFlip.render(view, () => xxxPaint(xxxFind(id) || x, detail)); else xxxPaint(x, detail);
};
```

## Dialogs

```js
window.openXxxModal = function(id = null) {
  const modal = document.getElementById('xxx-modal');
  const form = modal?.querySelector('form');
  if (!modal) return;
  if (form) form.reset();
  const x = id ? xxxFind(id) : null;
  document.getElementById('xxx-modal-title').textContent = x ? `ویرایش: ${x.name}` : 'ثبت مورد جدید';
  // fill fields from x …
  modal.style.display = 'flex';
  modal.style.zIndex = 'var(--z-modal)';
};

window.saveXxx = async function(e) {
  if (e) e.preventDefault();
  // read fields; if the API replaces the record, send every field (including ones the form does not show,
  // e.g. isActive / orderIndex) so an edit does not reset them
  const res = await request('/api/v1/admin/things', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ /* … */ }) });
  if (!res.ok) { const d = await res.json().catch(() => ({})); return showToast(d.error || 'خطا در ذخیره', 'error'); }
  showToast('ذخیره شد.', 'success');
  NopaActions.hide('xxx-modal');
  await window.loadXxx();   // redraws the bento and the open page
};
```

Confirmations use `await NopaConfirm('…؟')`, messages `showToast(text, 'success'|'error'|'info')`.

## Messenger

Wrap it in an IIFE with a single `st` state object, render functions for chips / list / conversation, and one
`bind()` that attaches listeners once (the loader may run many times). `js/features/tickets-chat.js` is the model:

```js
(function () {
  const $ = id => document.getElementById(id);
  const st = { items: [], filter: 'all', text: '', activeId: null, bound: false };
  function renderList() { /* chips + rows (or groups of rows) into #xxx-list */ }
  function renderConv() { /* head, #xxx-stream bubbles with .chm-day separators, notice */ }
  function setState(s) { $('xxx-messenger').dataset.state = s; }   // phones: list <-> conv
  function bind() {
    if (st.bound) return; st.bound = true;
    $('xxx-list').addEventListener('click', e => { const r = e.target.closest('[data-id]'); if (r) { st.activeId = r.dataset.id; renderList(); renderConv(); setState('conv'); } });
    $('xxx-back').addEventListener('click', () => setState('list'));
    $('xxx-composer').addEventListener('submit', send);
    $('xxx-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
  }
  async function load() {
    bind();
    if (!st.items.length) $('xxx-list').innerHTML = /* 6 × chm-row chm-skel */ '';
    // fetch, renderList(), keep the open item if it still exists
  }
  window.loadXxxInbox = load;
})();
```

After sending, update the local item (append the reply, change its status) and re-render instead of refetching
everything; scroll the stream to the bottom.

## Registering the tab

In `js/core/router.js` → `TABS`:

```js
'xxx-tab': {
  hashes: ['xxx'], group: 'GROUP_ID', label: 'برچسب منو', icon: 'fa-solid fa-ICON', section: 'SECTION_KEY',
  title: 'عنوان صفحه', desc: 'توضیح کوتاه',
  load: () => call('loadXxx'),
},
```

Add the script tag to the end of `index.html` after `js/features/caravans.js` and `js/features/mentors.js`
(their helpers must exist first).
