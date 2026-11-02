// Drag and drop in the stations tab, and the "change on screen first, save in the background" helpers.
// One pointer-based engine serves these sortables:
//   - session cards: within a category or into another one   (.lsv-row[data-session-id] in .lsv-col-card[data-cat-id])
//   - category columns of a station                           (.lsv-col[data-cat-col] in .lsv-flow)
//   - station cards in the overview                           (.lst-station-card[data-station-id] in #lms-bento-stations)
//   - station circles at the top of a station                 (.lsv-circle[data-station-id] in .lsv-notch)
//   In the station editor (js/features/lms/station-editor.js):
//   - sessions in the side list, also into another category   (.lse-tree-row[data-session-id] in .lse-tree-group[data-cat-id])
//   - categories in the side list, by their header            (.lse-tree-group[data-cat-id] in .lse-tree)
//   - video parts of the selected session                     (.lcm-clip[data-clip-id] in .lcm-clips[data-session-id])
//   - gallery pictures (draft only, saved with the editor)    (.lse-gitem[data-gi] in .lse-gallery)
//   - the wizard's new categories (draft only)                (.lse-newcat[data-ni] in .lse-newcats)
// Mouse: drag from anywhere on the item (after 5px; a plain click still clicks). Touch: from the grip handle only,
// so swiping still scrolls. Video parts are full of inputs, so they move by their grip only. Escape cancels. Renders are deferred while dragging. Styles: css/stations.css.

// Re-renders the table, the bento and the open station view from window.lmsStationsMasterList
window.lmsRefreshStationViews = function() {
  if (typeof window.filterLmsTable === 'function') window.filterLmsTable();
  else if (typeof window.renderLmsStationView === 'function') window.renderLmsStationView();
};

// Runs the save requests in parallel; the toast comes once the cards have stopped moving.
// On any failure the server's data is reloaded so the screen shows what is really saved.
window.lmsSaveInBackground = async function(requests, okMessage, errMessage, onFail) {
  let failed = 0;
  try {
    const results = await Promise.all(requests.map(send => send().then(res => res && res.ok, () => false)));
    failed = results.filter(ok => !ok).length;
  } catch (_) {
    failed = 1;
  }
  if (window.NopaFlip) await window.NopaFlip.settled();
  if (failed) {
    showToast(errMessage, 'error');
    await window.fetchLiveLmsStations();
    if (onFail) onFail();
  } else if (okMessage && requests.length) {
    showToast(okMessage, 'success');
  }
};

(function() {
  const DRAG_START_PX = 5;
  const SLIDE_MS = 150;
  const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const activeStation = () => (window.lmsStationsMasterList || []).find(s => String(s.id) === String(window.lmsActiveStationId));
  const editorStation = () => (window.lmsStationsMasterList || []).find(s => String(s.id) === String(window.currentActiveContentStationId));
  const editorRefresh = () => { if (typeof window.lmsEditorRefresh === 'function') window.lmsEditorRefresh(); };
  const editorRedraw = () => { if (typeof window.lmsEditorRedraw === 'function') window.lmsEditorRedraw(); };
  // a move saved from the editor redraws the station page behind it and the editor itself
  const afterEditorMove = () => { window.lmsRefreshStationViews(); editorRefresh(); };
  const putJson = (url, body) => () => request(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  // Mouse may start anywhere on the item; touch only from its grip
  function pickItem(e, itemSelector, gripSelector) {
    const item = e.target.closest(itemSelector);
    if (!item) return null;
    const onGrip = !!(gripSelector && e.target.closest(gripSelector));
    if (e.pointerType === 'touch' && !onGrip) return null;
    if (!onGrip && e.target.closest('button:not(' + itemSelector + '), input, select, textarea')) return null;
    return item;
  }

  function overviewFiltered() {
    return Boolean((document.getElementById('lms-search-input')?.value || '').trim());
  }

  // New order of all stations -> data + one reorder request
  function saveStationOrder(ids) {
    const list = window.lmsStationsMasterList || [];
    const byId = new Map(list.map(s => [String(s.id), s]));
    const ordered = ids.map(id => byId.get(id)).filter(Boolean);
    if (ordered.length !== list.length || ordered.every((s, i) => s === list[i])) return false;
    ordered.forEach((s, i) => { s.orderIndex = i + 1; });
    list.splice(0, list.length, ...ordered);
    window.lmsRefreshStationViews();
    window.lmsSaveInBackground(
      [() => request('/api/v1/admin/lms/stations/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stationIds: ordered.map(s => s.id) })
      })],
      `ترتیب منزلگاه‌ها ذخیره شد (شماره‌گذاری ۱ تا ${ordered.length}).`,
      'ذخیره ترتیب منزلگاه‌ها انجام نشد؛ ترتیب قبلی بازگردانده شد.'
    );
    return true;
  }

  // One dashed link between consecutive category columns and one before the "new category" column
  function normalizeLinks(flow) {
    flow.querySelectorAll(':scope > .lsv-link').forEach(l => l.remove());
    const cols = Array.from(flow.querySelectorAll(':scope > .lsv-col[data-cat-col]'));
    cols.forEach((col, i) => {
      if (i === 0) return;
      const link = document.createElement('div');
      link.className = 'lsv-link';
      link.setAttribute('aria-hidden', 'true');
      link.setAttribute('data-anim-key', 'link:' + col.getAttribute('data-cat-col'));
      flow.insertBefore(link, col);
    });
    const newCol = flow.querySelector(':scope > [data-anim-key="col-new"]');
    if (newCol && cols.length) {
      const link = document.createElement('div');
      link.className = 'lsv-link';
      link.setAttribute('aria-hidden', 'true');
      link.setAttribute('data-anim-key', 'link-new');
      flow.insertBefore(link, newCol);
    }
  }

  // New order of a session's video parts: numbers on screen, data, one reorder request
  function saveClipOrder(list, sortable) {
    const sessionId = list.getAttribute('data-session-id');
    const ids = sortable.items(list).map(el => el.getAttribute('data-clip-id'));
    let session = null;
    (window.lmsStationsMasterList || []).forEach(st => (st.categories || []).forEach(c => (c.sessions || []).forEach(s => {
      if (String(s.id) === sessionId) session = s;
    })));
    const clips = (session && session.videoClips) || [];
    const before = clips.slice().sort((a, b) => (Number(a.clipOrder) || 0) - (Number(b.clipOrder) || 0)).map(c => String(c.id));
    if (before.join() === ids.join()) return false;
    ids.forEach((id, i) => {
      const c = clips.find(x => String(x.id) === id);
      if (c) c.clipOrder = i + 1;
    });
    // "پارت N" labels and the hidden order inputs the save functions read
    sortable.items(list).forEach((el, i) => {
      el.querySelectorAll('.lcm-clip-num').forEach(n => { n.textContent = String(i + 1); });
      const input = el.querySelector('input[id^="clip-order-"]');
      if (input) input.value = String(i + 1);
    });
    window.lmsSaveInBackground(
      [() => request(`/api/v1/admin/lms/sessions/${sessionId}/clips/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clipIds: ids })
      })],
      'ترتیب پارت‌ها ذخیره شد.',
      'ذخیره ترتیب پارت‌ها انجام نشد؛ ترتیب قبلی بازگردانده شد.',
      () => {
        if (typeof window.lmsEditorRefresh === 'function') window.lmsEditorRefresh();
      }
    );
    return true;
  }

  // Sessions after a move between / within category cards (both views use data-cat-id / data-session-id):
  // data first, then one PUT per moved session
  function commitSessions(station, fromCard, toCard, sortable, after, onFail) {
    if (!station || !toCard) return false;
    const cats = station.categories || [];
    const byId = new Map();
    cats.forEach(c => (c.sessions || []).forEach(s => byId.set(String(s.id), { s, cat: c })));
    const changed = [];
    (fromCard === toCard ? [toCard] : [fromCard, toCard]).forEach(card => {
      const cat = cats.find(c => String(c.id) === card.getAttribute('data-cat-id'));
      if (!cat) return;
      const list = sortable.items(card).map(r => byId.get(r.getAttribute('data-session-id'))).filter(Boolean);
      list.forEach(({ s, cat: oldCat }, i) => {
        const moved = oldCat !== cat;
        if (moved || Number(s.orderIndex) !== i + 1) {
          s.orderIndex = i + 1;
          s.categoryId = cat.id;
          changed.push(s);
        }
        if (moved) oldCat.sessions = (oldCat.sessions || []).filter(x => x !== s);
      });
      cat.sessions = list.map(x => x.s).concat((cat.sessions || []).filter(s => s.isDeleted));
    });
    if (!changed.length) return false;
    after();
    window.lmsSaveInBackground(
      changed.map(s => putJson(`/api/v1/admin/lms/sessions/${s.id}`, { id: s.id, categoryId: s.categoryId, orderIndex: s.orderIndex })),
      fromCard === toCard ? 'ترتیب جلسات ذخیره شد.' : 'جلسه به دسته جدید منتقل و ذخیره شد.',
      'ذخیره جابجایی جلسه انجام نشد؛ ترتیب قبلی بازگردانده شد.',
      onFail
    );
    return true;
  }

  // Categories in their new order (ids): data first, then one PUT per moved category
  function commitCategories(station, ids, after, onFail) {
    if (!station) return false;
    const byId = new Map((station.categories || []).map(c => [String(c.id), c]));
    const changed = [];
    ids.forEach((id, i) => {
      const c = byId.get(id);
      if (c && Number(c.orderIndex) !== i + 1) { c.orderIndex = i + 1; changed.push(c); }
    });
    if (!changed.length) return false;
    after();
    window.lmsSaveInBackground(
      changed.map(c => putJson(`/api/v1/admin/lms/classes/${c.id}`, { id: c.id, orderIndex: c.orderIndex })),
      'ترتیب دسته‌ها (و تب‌های صفحه کلاس‌ها در اپلیکیشن) ذخیره شد.',
      'ذخیره ترتیب دسته‌ها انجام نشد؛ ترتیب قبلی بازگردانده شد.',
      onFail
    );
    return true;
  }

  const SORTABLES = [
    {
      name: 'session',
      mode: 'list',
      match: e => pickItem(e, '#lms-station-view .lsv-row[data-session-id]', '.lsv-row-grip'),
      containers: item => Array.from(item.closest('.lsv-flow').querySelectorAll('.lsv-col-card[data-cat-id]')),
      items: card => Array.from(card.querySelectorAll(':scope > .lsv-row[data-session-id]')),
      anchor: card => card.querySelector(':scope > .lsv-row-add'),
      scroller: item => item.closest('.lsv-flow'),
      highlightTarget: true,
      beforeInsert: card => card.querySelector(':scope > .lsv-col-empty')?.remove(),
      commit: (item, fromCard, toCard, sortable) => commitSessions(activeStation(), fromCard, toCard, sortable, window.lmsRefreshStationViews)
    },
    {
      name: 'category',
      mode: 'row',
      match(e) {
        const item = pickItem(e, '#lms-station-view .lsv-col[data-cat-col]', '.lsv-col-grip');
        // the rows inside a column have their own drag
        if (!item || e.target.closest('.lsv-row')) return null;
        return item;
      },
      containers: item => [item.parentElement],
      items: flow => Array.from(flow.querySelectorAll(':scope > .lsv-col[data-cat-col]')),
      anchor: flow => flow.querySelector(':scope > .lsv-link[data-anim-key="link-new"]') || flow.querySelector(':scope > [data-anim-key="col-new"]'),
      scroller: item => item.parentElement,
      afterInsert: flow => normalizeLinks(flow),
      commit: (item, flow, _to, sortable) => commitCategories(activeStation(), sortable.items(flow).map(col => col.getAttribute('data-cat-col')), window.lmsRefreshStationViews)
    },
    {
      name: 'station-card',
      mode: 'grid',
      match(e) {
        const item = pickItem(e, '#lms-bento-stations .lst-station-card[data-station-id]', '.lst-station-grip');
        if (item && overviewFiltered()) {
          if (e.target.closest('.lst-station-grip')) showToast('برای جابجایی منزلگاه‌ها ابتدا جستجو و فیلترها را پاک کنید.', 'info');
          return null;
        }
        return item;
      },
      containers: item => [item.parentElement],
      items: grid => Array.from(grid.querySelectorAll(':scope > .lst-station-card[data-station-id]')),
      anchor: grid => grid.querySelector(':scope > .lst-station-card-add'),
      scroller: () => null,
      commit: (item, grid, _to, sortable) => saveStationOrder(sortable.items(grid).map(c => c.getAttribute('data-station-id')))
    },
    {
      name: 'station-circle',
      mode: 'row',
      match: e => pickItem(e, '#lms-station-view .lsv-circle[data-station-id]', null),
      containers: item => [item.parentElement],
      items: notch => Array.from(notch.querySelectorAll(':scope > .lsv-circle[data-station-id]')),
      anchor: notch => notch.querySelector(':scope > .lsv-circle-add'),
      scroller: item => item.parentElement,
      commit: (item, notch, _to, sortable) => saveStationOrder(sortable.items(notch).map(c => c.getAttribute('data-station-id')))
    },
    {
      name: 'clip',
      mode: 'list',
      match(e) {
        const grip = e.target.closest('#lms-station-editor-modal .lcm-clip-grip');
        return grip ? grip.closest('.lcm-clip[data-clip-id]') : null;
      },
      containers: item => [item.parentElement],
      items: list => Array.from(list.querySelectorAll(':scope > .lcm-clip[data-clip-id]')),
      anchor: () => null,
      scroller: item => item.closest('.lse-detail'),
      // the station editor is drawn from the data; a cancelled drag redraws it
      refresh: editorRefresh,
      commit: (item, list, _to, sortable) => saveClipOrder(list, sortable)
    },
    {
      name: 'editor-session',
      mode: 'list',
      match: e => pickItem(e, '#lms-station-editor-modal .lse-tree-row[data-session-id]', '.lse-tree-grip'),
      containers: item => Array.from(item.closest('.lse-tree').querySelectorAll(':scope > .lse-tree-group[data-cat-id]')),
      items: group => Array.from(group.querySelectorAll(':scope > .lse-tree-row[data-session-id]')),
      anchor: group => group.querySelector(':scope > .lse-tree-add'),
      scroller: item => item.closest('.lse-tree'),
      highlightTarget: true,
      refresh: editorRefresh,
      commit: (item, from, to, sortable) => commitSessions(editorStation(), from, to, sortable, afterEditorMove, editorRefresh)
    },
    {
      name: 'editor-category',
      mode: 'list',
      // by the category's header (the session rows below it have their own drag); touch from the grip only
      match(e) {
        const head = e.target.closest('#lms-station-editor-modal .lse-tree-cat');
        if (!head || (e.pointerType === 'touch' && !e.target.closest('.lse-tree-cat-grip'))) return null;
        return head.closest('.lse-tree-group[data-cat-id]');
      },
      containers: item => [item.parentElement],
      items: tree => Array.from(tree.querySelectorAll(':scope > .lse-tree-group[data-cat-id]')),
      anchor: tree => tree.querySelector(':scope > .lse-tree-new'),
      scroller: item => item.parentElement,
      refresh: editorRefresh,
      commit: (item, tree, _to, sortable) => commitCategories(editorStation(), sortable.items(tree).map(g => g.getAttribute('data-cat-id')), afterEditorMove, editorRefresh)
    },
    {
      name: 'gallery',
      mode: 'grid',
      match: e => pickItem(e, '#lms-station-editor-modal .lse-gitem[data-gi]', '.lse-gitem-grip'),
      containers: item => [item.parentElement],
      items: grid => Array.from(grid.querySelectorAll(':scope > .lse-gitem[data-gi]')),
      anchor: grid => grid.querySelector(':scope > .lse-gadd'),
      scroller: item => item.closest('.lse-body'),
      refresh: editorRedraw,
      commit: (item, grid, _to, sortable) => window.lmsEditorGalleryReorder(sortable.items(grid).map(g => g.getAttribute('data-gi')))
    },
    {
      name: 'newcat',
      mode: 'grid',
      match: e => pickItem(e, '#lms-station-editor-modal .lse-newcat[data-ni]', '.lse-newcat-grip'),
      containers: item => [item.parentElement],
      items: grid => Array.from(grid.querySelectorAll(':scope > .lse-newcat[data-ni]')),
      anchor: grid => grid.querySelector(':scope > .lse-gadd'),
      scroller: item => item.closest('.lse-body'),
      refresh: editorRedraw,
      commit: (item, grid, _to, sortable) => window.lmsEditorNewCatReorder(sortable.items(grid).map(g => g.getAttribute('data-ni')))
    }
  ];

  let pending = null; // pointer is down on an item, drag not started yet
  let drag = null;    // drag in progress

  // Glides every item of the sortable from where it was to where it is now
  function slide(sortable, containers, mutate) {
    const items = containers.flatMap(c => sortable.items(c));
    const before = new Map(items.map(el => [el, el.getBoundingClientRect()]));
    mutate();
    if (reduced()) return;
    items.forEach(el => {
      const a = before.get(el);
      const b = el.getBoundingClientRect();
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      el.getAnimations().forEach(x => x.cancel());
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: SLIDE_MS, easing: EASE });
    });
  }

  // Is the pointer before this item, in this container's reading order (RTL aware)?
  function isBefore(mode, rtl, x, y, r) {
    const midX = r.left + r.width / 2;
    const xBefore = rtl ? x > midX : x < midX;
    if (mode === 'list') return y < r.top + r.height / 2;
    if (mode === 'row') return xBefore;
    return y < r.top || (y <= r.bottom && xBefore); // grid: earlier row, or same row and earlier column
  }

  function start(e) {
    const { item, sortable, startX, startY } = pending;
    pending = null;
    const rect = item.getBoundingClientRect();
    window.lmsDragActive = true;

    const ghost = item.cloneNode(true);
    ghost.removeAttribute('data-anim-key');
    ghost.removeAttribute('data-click');
    ghost.classList.add('lms-drag-ghost', `lms-drag-ghost-${sortable.name}`);
    Object.assign(ghost.style, {
      position: 'fixed',
      top: rect.top + 'px',
      left: rect.left + 'px',
      width: rect.width + 'px',
      height: rect.height + 'px',
      margin: '0',
      zIndex: '8000', // above the modals (the station editor is one)
      pointerEvents: 'none'
    });
    document.body.appendChild(ghost);
    if (!reduced()) ghost.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }], { duration: 120, easing: EASE, fill: 'forwards' });

    item.classList.add('is-drag-source');
    document.body.classList.add('lms-dragging');
    drag = {
      item, sortable, ghost,
      from: item.parentElement,
      containers: sortable.containers(item),
      scroller: sortable.scroller(item),
      offsetX: startX - rect.left,
      offsetY: startY - rect.top,
      lastX: e.clientX,
      lastY: e.clientY,
      timer: null
    };
    drag.timer = setInterval(autoScroll, 16);
    move(e);
  }

  // Scrolls the strip (columns / circles) while the pointer is near its left or right edge
  function autoScroll() {
    if (!drag || !drag.scroller) return;
    const sc = drag.scroller;
    const r = sc.getBoundingClientRect();
    const edge = 60;
    let dx = 0;
    let dy = 0;
    if (sc.scrollWidth > sc.clientWidth) {
      if (drag.lastX < r.left + edge) dx = -Math.ceil((r.left + edge - drag.lastX) / 4);
      else if (drag.lastX > r.right - edge) dx = Math.ceil((drag.lastX - (r.right - edge)) / 4);
    }
    if (sc.scrollHeight > sc.clientHeight) {
      if (drag.lastY < r.top + edge) dy = -Math.ceil((r.top + edge - drag.lastY) / 4);
      else if (drag.lastY > r.bottom - edge) dy = Math.ceil((drag.lastY - (r.bottom - edge)) / 4);
    }
    if (dx || dy) {
      sc.scrollLeft += dx;
      sc.scrollTop += dy;
      place(drag.lastX, drag.lastY);
    }
  }

  function move(e) {
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    drag.ghost.style.left = (e.clientX - drag.offsetX) + 'px';
    drag.ghost.style.top = (e.clientY - drag.offsetY) + 'px';
    place(e.clientX, e.clientY);
  }

  // Puts the source item (the placeholder) where it would be dropped
  function place(x, y) {
    const { sortable, item, containers } = drag;
    const container = containers.length === 1 ? containers[0] : containers.find(c => {
      const r = c.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top - 30 && y <= r.bottom + 30;
    });
    if (!container) return;
    if (sortable.highlightTarget) containers.forEach(c => c.classList.toggle('is-drop-target', c === container));

    const rtl = getComputedStyle(container).direction === 'rtl';
    const next = sortable.items(container).filter(el => el !== item)
      .find(el => isBefore(sortable.mode, rtl, x, y, el.getBoundingClientRect()));
    const anchor = next || sortable.anchor(container);
    if (item.parentElement === container) {
      // already in place (category columns have a dashed link element between them)
      let sib = item.nextElementSibling;
      while (sib && sib.classList.contains('lsv-link') && sib !== anchor) sib = sib.nextElementSibling;
      if (sib === anchor) return;
    }
    slide(sortable, containers, () => {
      if (sortable.beforeInsert) sortable.beforeInsert(container);
      container.insertBefore(item, anchor || null);
      if (sortable.afterInsert) sortable.afterInsert(container);
    });
  }

  function finish(cancelled) {
    const d = drag;
    drag = null;
    clearInterval(d.timer);
    document.body.classList.remove('lms-dragging');
    d.containers.forEach(c => c.classList.remove('is-drop-target'));

    const land = () => {
      d.ghost.remove();
      d.item.classList.remove('is-drag-source');
      window.lmsDragActive = false;
      const saved = !cancelled && d.sortable.commit(d.item, d.from, d.item.parentElement, d.sortable);
      window.lmsRenderPending = false;
      // a saved move has re-rendered already; otherwise redraw from the data (puts a cancelled item back
      // and shows anything that was loaded during the drag)
      if (!saved) (d.sortable.refresh || window.lmsRefreshStationViews)();
    };
    if (reduced()) { land(); return; }
    const target = d.item.getBoundingClientRect();
    const g = d.ghost.getBoundingClientRect();
    d.ghost.getAnimations().forEach(a => a.cancel());
    const anim = d.ghost.animate(
      [{ transform: 'scale(1.04)' }, { transform: `translate(${target.left - g.left}px, ${target.top - g.top}px) scale(1)` }],
      { duration: 140, easing: EASE, fill: 'forwards' }
    );
    anim.onfinish = land;
    anim.oncancel = land;
  }

  // A drag ends with a click on the item; don't let it open anything
  function swallowNextClick() {
    const stop = ev => { ev.stopPropagation(); ev.preventDefault(); };
    window.addEventListener('click', stop, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0);
  }

  document.addEventListener('pointerdown', e => {
    if (e.button !== 0 || drag || !(e.target instanceof Element)) return;
    for (const sortable of SORTABLES) {
      const item = sortable.match(e);
      if (!item) continue;
      pending = { item, sortable, startX: e.clientX, startY: e.clientY, id: e.pointerId };
      if (e.target.closest('.lsv-row-grip, .lsv-col-grip, .lst-station-grip, .lcm-clip-grip, .lse-grip')) e.preventDefault();
      return;
    }
  });

  document.addEventListener('pointermove', e => {
    if (drag) { e.preventDefault(); move(e); return; }
    if (!pending || e.pointerId !== pending.id) return;
    if (Math.hypot(e.clientX - pending.startX, e.clientY - pending.startY) < DRAG_START_PX) return;
    e.preventDefault();
    start(e);
  });

  // images inside cards and circles would start the browser's own image drag
  document.addEventListener('dragstart', e => {
    if (e.target instanceof Element && e.target.closest('#lms-tab, #lms-station-editor-modal')) e.preventDefault();
  });

  document.addEventListener('pointerup', () => {
    pending = null;
    if (!drag) return;
    swallowNextClick();
    finish(false);
  });

  document.addEventListener('pointercancel', () => {
    pending = null;
    if (drag) finish(true);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && drag) finish(true);
  });
})();
