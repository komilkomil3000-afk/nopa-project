// Horizontal top navigation, built from the tab registry (js/core/router.js). Loaded before the feature modules (js/app, js/features).
// - Groups with several tabs open a dropdown; a group with a single tab is a direct link.
// - Sub admins only see tabs whose section they were granted: NopaNav.applyAccess({ all, sections }).
// - Below NAV_BREAKPOINT the groups move into a slide-in panel (hamburger).
// - Section search ("/" or Ctrl+K), bell (own messages, newest support messages, "needs attention"), user menu.
(function () {
  const NAV_BREAKPOINT = 1180; // keep in sync with css/layout.css
  const ATTENTION_REFRESH_MS = 2 * 60 * 1000;
  const DASHBOARD = { tabId: 'dashboard-tab', label: 'داشبورد', icon: 'fa-solid fa-chart-pie' };

  let access = { all: true, sections: {} };
  let attentionTimer = null;
  const $ = id => document.getElementById(id);

  function isAllowed(tabId) {
    const t = NopaRouter.TABS[tabId];
    if (!t) return false;
    if (access.all || t.section === '*') return true;
    return !!(t.section && access.sections[t.section]);
  }
  // null = super-admin-only area (sub admins never see it)
  const sectionAllowed = section => access.all || (!!section && !!access.sections[section]);
  const hrefOf = tabId => '#' + NopaRouter.TABS[tabId].hashes[0];

  // ---- model ------------------------------------------------------------------------------
  function model() {
    const items = [];
    if (isAllowed(DASHBOARD.tabId)) items.push({ kind: 'link', tabId: DASHBOARD.tabId, label: DASHBOARD.label, icon: DASHBOARD.icon });
    NopaRouter.GROUPS.forEach(g => {
      const tabs = Object.keys(NopaRouter.TABS).filter(id => NopaRouter.TABS[id].group === g.id && isAllowed(id));
      if (tabs.length === 1) items.push({ kind: 'link', tabId: tabs[0], label: g.label, icon: g.icon, group: g.id });
      else if (tabs.length > 1) items.push({ kind: 'group', group: g, tabs });
    });
    return items;
  }

  // ---- render -----------------------------------------------------------------------------
  function render() {
    const list = $('topnav-list');
    if (!list) return;
    list.innerHTML = model().map(item => {
      if (item.kind === 'link') {
        return `<li class="topnav-item">
          <a class="topnav-link" href="${hrefOf(item.tabId)}" data-tab="${esc(item.tabId)}">
            <i class="${esc(item.icon)}"></i><span>${esc(item.label)}</span>
          </a></li>`;
      }
      const g = item.group;
      return `<li class="topnav-item has-menu" data-group="${esc(g.id)}">
        <button type="button" class="topnav-trigger" aria-haspopup="true" aria-expanded="false">
          <i class="${esc(g.icon)}"></i><span>${esc(g.label)}</span><i class="fa-solid fa-chevron-down topnav-caret"></i>
        </button>
        <div class="topnav-menu" role="menu">
          ${item.tabs.map(id => {
            const t = NopaRouter.TABS[id];
            return `<a class="topnav-menu-link" role="menuitem" href="${hrefOf(id)}" data-tab="${esc(id)}">
              <i class="${esc(t.icon)}"></i>
              <span class="topnav-menu-text"><span class="topnav-menu-label">${esc(t.label)}</span><span class="topnav-menu-desc">${esc(t.desc)}</span></span>
            </a>`;
          }).join('')}
        </div></li>`;
    }).join('');
    markActive(typeof activeTab !== 'undefined' ? activeTab : null);
  }

  function markActive(tabId) {
    document.querySelectorAll('#topnav [data-tab]').forEach(a => {
      const on = a.dataset.tab === tabId;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.querySelectorAll('#topnav .has-menu').forEach(li => {
      li.classList.toggle('is-active', !!li.querySelector(`[data-tab="${tabId}"]`));
    });
  }

  // ---- dropdowns --------------------------------------------------------------------------
  function closeMenus(except) {
    document.querySelectorAll('#topnav .has-menu.is-open').forEach(li => {
      if (li === except) return;
      li.classList.remove('is-open');
      li.querySelector('.topnav-trigger').setAttribute('aria-expanded', 'false');
    });
    document.querySelectorAll('.header-menu.is-open').forEach(m => {
      if (m === except) return;
      m.classList.remove('is-open');
      const btn = m.querySelector('[aria-expanded]');
      if (btn) btn.setAttribute('aria-expanded', 'false');
      const dd = m.querySelector('.header-dropdown');
      if (dd) dd.hidden = true;
    });
  }

  function toggleGroup(li) {
    const open = !li.classList.contains('is-open');
    closeMenus(li);
    li.classList.toggle('is-open', open);
    li.querySelector('.topnav-trigger').setAttribute('aria-expanded', String(open));
    return open;
  }

  function toggleHeaderMenu(menu) {
    const open = !menu.classList.contains('is-open');
    closeMenus(menu);
    menu.classList.toggle('is-open', open);
    menu.querySelector('[aria-expanded]').setAttribute('aria-expanded', String(open));
    menu.querySelector('.header-dropdown').hidden = !open;
    return open;
  }

  // ---- mobile panel -----------------------------------------------------------------------
  const isCompact = () => window.innerWidth <= NAV_BREAKPOINT;
  function setPanel(open) {
    document.body.classList.toggle('nav-open', open);
    const btn = $('btn-nav-toggle');
    if (btn) btn.setAttribute('aria-expanded', String(open));
    if (open) {
      const first = document.querySelector('#topnav .topnav-link, #topnav .topnav-trigger');
      if (first) first.focus({ preventScroll: true });
    }
  }

  function go(tabId) {
    closeMenus();
    setPanel(false);
    NopaRouter.switchTab(tabId, true);
  }

  // ---- search -----------------------------------------------------------------------------
  const norm = s => String(s || '').replace(/[‌‏‎]/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').toLowerCase().trim();
  let searchResults = [];
  let searchIndex = 0;

  function runSearch(q) {
    const box = $('nav-search-results');
    const query = norm(q);
    if (!query) { box.hidden = true; searchResults = []; return; }
    const groupLabel = id => (NopaRouter.GROUPS.find(g => g.id === NopaRouter.TABS[id].group) || {}).label || 'داشبورد';
    searchResults = Object.keys(NopaRouter.TABS).filter(isAllowed).filter(id => {
      const t = NopaRouter.TABS[id];
      return [t.label, t.title, t.desc, groupLabel(id)].some(v => norm(v).includes(query));
    }).slice(0, 8);
    searchIndex = 0;
    box.innerHTML = searchResults.length
      ? searchResults.map((id, i) => {
          const t = NopaRouter.TABS[id];
          return `<li role="option" class="nav-search-item${i === 0 ? ' is-selected' : ''}" data-tab="${esc(id)}" aria-selected="${i === 0}">
            <i class="${esc(t.icon)}"></i><span>${esc(t.label)}</span><small>${esc(groupLabel(id))}</small></li>`;
        }).join('')
      : '<li class="nav-search-empty">بخشی پیدا نشد</li>';
    box.hidden = false;
  }

  function selectResult(i) {
    const items = document.querySelectorAll('#nav-search-results .nav-search-item');
    if (!items.length) return;
    searchIndex = (i + items.length) % items.length;
    items.forEach((el, k) => { el.classList.toggle('is-selected', k === searchIndex); el.setAttribute('aria-selected', String(k === searchIndex)); });
  }

  function clearSearch() {
    const input = $('nav-search-input');
    if (input) { input.value = ''; input.blur(); }
    const box = $('nav-search-results');
    if (box) box.hidden = true;
    searchResults = [];
  }

  // ---- bell: own messages (js/core/inbox.js) + newest support messages + review queues ------
  let attentionTotal = 0;
  const INBOX_SHOWN = 8;
  const SUPPORT_SHOWN = 5;
  const faNum = n => Number(n).toLocaleString('fa-IR');
  const when = v => { try { return new Date(v).toLocaleString('fa-IR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };

  function renderBadge() {
    const unread = window.NopaInbox ? NopaInbox.state.unread : 0;
    const total = attentionTotal + unread;
    const badge = $('attention-badge');
    if (badge) {
      badge.hidden = total === 0;
      badge.textContent = total > 99 ? '99+' : faNum(total);
    }
    const btn = $('btn-attention');
    if (btn) btn.setAttribute('aria-label', total ? `${faNum(total)} اعلان و مورد نیازمند رسیدگی` : 'اعلان یا موردی برای رسیدگی نیست');
  }

  function renderInbox() {
    if (!window.NopaInbox) return;
    const { items, unread } = NopaInbox.state;
    const list = $('inbox-list');
    if (list) {
      list.innerHTML = items.length
        ? items.slice(0, INBOX_SHOWN).map(n => `<li><button type="button" class="inbox-item${n.isRead ? '' : ' is-unread'}" data-inbox-id="${esc(n.id)}">
            <span class="inbox-item-head"><strong>${esc(n.title || 'پیام')}</strong><time>${esc(when(n.createdAt))}</time></span>
            <span class="inbox-item-text">${esc(n.message || '')}</span></button></li>`).join('')
        : '<li class="attention-empty">پیامی برای شما نیامده است</li>';
    }
    const all = $('inbox-read-all');
    if (all) all.hidden = !unread;
    const perm = $('inbox-permission');
    if (perm) perm.hidden = NopaInbox.permission() !== 'default';
    renderBadge();
  }

  function renderSupport(items) {
    const recent = items
      .filter(i => i.recent && i.recent.length)
      .reduce((all, i) => all.concat(i.recent.map(r => Object.assign({ tab: i.tab, icon: i.icon }, r))), [])
      .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
      .slice(0, SUPPORT_SHOWN);
    const block = $('support-recent-block');
    if (block) block.hidden = !recent.length;
    const list = $('support-recent-list');
    if (list) {
      list.innerHTML = recent.map(r => `<li><a href="${hrefOf(r.tab)}" data-tab="${esc(r.tab)}" class="inbox-item is-unread">
          <span class="inbox-item-head"><strong><i class="${esc(r.icon)}"></i> ${esc(r.who || 'ناشناس')}</strong><time>${esc(when(r.at))}</time></span>
          <span class="inbox-item-text">${esc(String(r.text || '').slice(0, 140))}</span></a></li>`).join('');
    }
  }

  async function refreshAttention() {
    if (!window.NopaAttention || !NopaAuth.getToken()) return;
    const items = await NopaAttention.fetch(sectionAllowed);
    attentionTotal = items.reduce((s, i) => s + (i.count || 0), 0);
    renderBadge();
    renderSupport(items);
    const list = $('attention-list');
    if (list) {
      list.innerHTML = items.length
        ? items.map(i => `<li><a href="${hrefOf(i.tab)}" data-tab="${esc(i.tab)}" class="attention-item${i.count ? ' has-items' : ''}">
            <i class="${esc(i.icon)}"></i><span>${esc(i.label)}</span>
            <b>${i.count === null ? '—' : i.count.toLocaleString('fa-IR')}</b></a></li>`).join('')
        : '<li class="attention-empty">دسترسی به صف‌های رسیدگی ندارید</li>';
    }
  }

  function startAttention() {
    clearInterval(attentionTimer);
    refreshAttention();
    attentionTimer = setInterval(refreshAttention, ATTENTION_REFRESH_MS);
    if (window.NopaInbox) NopaInbox.start();
  }

  // ---- hide on scroll down, show on any scroll up ------------------------------------------
  // Scrolling down hides the header; the slightest scroll up (anywhere on the page) brings it
  // back. Never hides while one of its menus, the search or the mobile panel is in use.
  const SHOW_NEAR_TOP = 72;  // px: always visible near the top
  const HIDE_AFTER = 8;      // px of downward movement before hiding
  let lastY = 0;
  let scrollTicking = false;

  function setHeaderHidden(hidden) {
    const header = $('app-header');
    if (!header || header.classList.contains('is-hidden') === hidden) return;
    header.classList.toggle('is-hidden', hidden);
    if (hidden) closeMenus();
  }

  function headerInUse() {
    const header = $('app-header');
    return document.body.classList.contains('nav-open') ||
      !!document.querySelector('#topnav .has-menu.is-open, .header-menu.is-open') ||
      (header && header.contains(document.activeElement) && document.activeElement.tagName === 'INPUT');
  }

  function onScroll() {
    scrollTicking = false;
    const y = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
    const delta = y - lastY;
    if (y <= SHOW_NEAR_TOP || headerInUse()) setHeaderHidden(false);
    else if (delta < 0) setHeaderHidden(false);          // any upward movement reveals
    else if (delta > HIDE_AFTER) setHeaderHidden(true);
    else return;                                          // small downward jitter: keep lastY anchored
    lastY = y;
  }

  function watchScroll() {
    lastY = window.scrollY || 0;
    window.addEventListener('scroll', () => {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(onScroll);
    }, { passive: true });
    // Keyboard focus moving into the header (Tab) must reveal it
    $('app-header').addEventListener('focusin', () => setHeaderHidden(false));
    window.addEventListener('nopa:tabchange', () => { setHeaderHidden(false); lastY = window.scrollY || 0; });
  }

  // ---- public -----------------------------------------------------------------------------
  function applyAccess(next) {
    access = next && !next.all ? { all: false, sections: next.sections || {} } : { all: true, sections: {} };
    render();
    // Page parts that need a specific grant: <… data-requires-section="content">
    document.querySelectorAll('[data-requires-section]').forEach(el => {
      el.classList.toggle('is-denied', !sectionAllowed(el.dataset.requiresSection));
    });
    if (next && next.pending) return; // grants still loading: show nothing extra, poll nothing
    startAttention();
    try { window.dispatchEvent(new CustomEvent('nopa:accesschange', { detail: access })); } catch (_) { /* old browser */ }
  }

  function setUser(user) {
    user = user || {};
    const name = user.name || 'مدیر سیستم';
    const role = typeof window.roleLabel === 'function' ? window.roleLabel(user.role) : (user.role || '');
    if ($('current-user-avatar')) $('current-user-avatar').textContent = name.substring(0, 2);
    if ($('current-user-name')) $('current-user-name').textContent = name;
    if ($('current-user-name-full')) $('current-user-name-full').textContent = name;
    if ($('current-user-role')) $('current-user-role').textContent = role;
  }

  // ---- wiring -----------------------------------------------------------------------------
  function init() {
    // The old sidebar stored its width / compact state; nothing reads them any more
    try { localStorage.removeItem('sidebar_width'); localStorage.removeItem('sidebar_compact'); } catch (_) { /* storage blocked */ }
    render();

    const nav = $('topnav');
    nav.addEventListener('click', e => {
      const link = e.target.closest('a[data-tab]');
      if (link) {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return; // let the browser open a new tab
        e.preventDefault();
        go(link.dataset.tab);
        return;
      }
      const trigger = e.target.closest('.topnav-trigger');
      if (trigger) {
        const opened = toggleGroup(trigger.closest('.has-menu'));
        if (opened && !isCompact()) {
          const first = trigger.parentElement.querySelector('.topnav-menu-link');
          if (first && e.detail === 0) first.focus(); // keyboard activation: move into the menu
        }
      }
    });

    // Arrow keys inside an open menu
    nav.addEventListener('keydown', e => {
      const li = e.target.closest('.has-menu');
      if (!li) return;
      const links = Array.from(li.querySelectorAll('.topnav-menu-link'));
      const i = links.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); if (!li.classList.contains('is-open')) toggleGroup(li); (links[i + 1] || links[0]).focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); (links[i - 1] || links[links.length - 1]).focus(); }
    });

    $('btn-nav-toggle').addEventListener('click', () => setPanel(!document.body.classList.contains('nav-open')));
    $('btn-nav-close').addEventListener('click', () => setPanel(false));
    $('nav-backdrop').addEventListener('click', () => setPanel(false));
    window.addEventListener('resize', () => { if (!isCompact()) setPanel(false); });

    // Header dropdowns (bell, user)
    document.querySelectorAll('.header-menu').forEach(menu => {
      menu.querySelector('[aria-expanded]').addEventListener('click', e => {
        e.stopPropagation();
        const opened = toggleHeaderMenu(menu);
        if (opened && menu.id === 'attention-menu') { refreshAttention(); if (window.NopaInbox) NopaInbox.refresh(); }
      });
    });
    $('attention-dropdown').addEventListener('click', e => {
      const own = e.target.closest('[data-inbox-id]');
      // stopPropagation: the list re-renders, and a detached target would read as a click outside the menu
      if (own) { e.stopPropagation(); NopaInbox.markRead(own.dataset.inboxId); return; }
      const link = e.target.closest('a[data-tab]');
      if (!link || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      go(link.dataset.tab);
    });
    $('inbox-read-all').addEventListener('click', e => { e.stopPropagation(); NopaInbox.markAllRead(); });
    $('inbox-permission').addEventListener('click', e => { e.stopPropagation(); NopaInbox.askPermission().then(renderInbox); });
    if (window.NopaInbox) NopaInbox.onChange(renderInbox);

    // Search
    const input = $('nav-search-input');
    $('nav-search').addEventListener('click', () => input.focus()); // phones: the box is only an icon
    input.addEventListener('input', () => runSearch(input.value));
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); selectResult(searchIndex + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); selectResult(searchIndex - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); if (searchResults[searchIndex]) { go(searchResults[searchIndex]); clearSearch(); } }
      else if (e.key === 'Escape') { e.stopPropagation(); clearSearch(); }
    });
    $('nav-search-results').addEventListener('mousedown', e => {
      const item = e.target.closest('[data-tab]');
      if (!item) return;
      e.preventDefault();
      go(item.dataset.tab);
      clearSearch();
    });
    input.addEventListener('blur', () => setTimeout(() => { $('nav-search-results').hidden = true; }, 150));

    // Outside click / ESC / shortcuts
    document.addEventListener('click', e => {
      if (!e.target.closest('#topnav .has-menu') && !e.target.closest('.header-menu')) closeMenus();
    });
    document.addEventListener('keydown', e => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
      const modalOpen = window.NopaModal && NopaModal.top();
      if (e.key === 'Escape' && !modalOpen) {
        const anyOpen = document.querySelector('#topnav .has-menu.is-open, .header-menu.is-open');
        if (anyOpen) {
          closeMenus();
          const trigger = anyOpen.querySelector('.topnav-trigger, [aria-expanded]');
          if (trigger) trigger.focus();
        } else if (document.body.classList.contains('nav-open')) {
          setPanel(false);
          $('btn-nav-toggle').focus();
        }
      }
      if (!modalOpen && ((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)))) {
        e.preventDefault();
        setPanel(false);
        input.focus();
      }
    });

    window.addEventListener('nopa:tabchange', e => markActive(e.detail.tabId));
    watchScroll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.NopaNav = { applyAccess, setUser, render, refreshAttention, isAllowed, sectionAllowed };
})();
