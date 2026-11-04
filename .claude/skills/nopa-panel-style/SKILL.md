---
name: nopa-panel-style
description: Restyle or build any Nopa admin-panel page (admin_panel/public) in the house style of the stations, challenges, caravans, mentors and chat tabs — bento overview of cards and tiles, a detail page with circles hanging in the board's notch and linked columns, shimmer loading with skeletons, NopaFlip enter/re-render animations, station-editor (lse) dialogs and the chm messenger layout. Use this whenever the user asks to redesign, restyle, "make it like the stations / challenges / chat page", convert a table page to cards, add a detail page, fix loading or animations, or convert a modal on any admin-panel tab, even if they only name the tab (e.g. "بخش رسانه رو مثل منزلگاه‌ها کن", "سبک کاروان‌ها رو روی نوتیفیکیشن‌ها پیاده کن").
---

# Nopa admin-panel page style

The panel's newer tabs (منزلگاه‌ها `lms-tab`, چالش‌ها `submissions-tab`, کاروان‌ها `caravans-tab`, راهبران `mentors-profile-tab`, بانک اساتید `instructors-tab`, چت `chat-tab`, تیکت‌های راهبران `mentors-tickets-tab`) share one visual language. Restyling another page means rebuilding it out of the **same classes and helpers**, not inventing new look-alike CSS. That way every tab stays consistent in both themes, and fixes to the shared CSS reach all of them.

Reference implementations to open and copy from (read the one closest to the page you are converting before writing anything):

| Pattern | Best example |
|---|---|
| Bento overview + detail page with linked columns | `js/features/caravans.js` (`crvDrawBento`, `crvSetLoading`, `crvPaint`, `loadSelectedCaravanDetails`) and `#caravans-tab` in `index.html` |
| Same, where the circles are the item's children (not all items) | `js/features/mentors.js` (`mntDrawBento`, `mntPaint`, `loadMentorPage`) |
| Original station page (donuts, panels below the board, drag & drop) | `js/features/lms/station-view.js` |
| Detail as "open item on the right, list on the left" | `js/features/challenges.js` (`chl-dv-*`) |
| Messenger (list of conversations + open conversation) | `js/features/chat-messenger.js`; a compact copy in `js/features/tickets-chat.js` |
| Dialogs | `#caravan-wizard-modal` (steps), `#mentor-modal-overlay` (long form), `#rename-caravan-modal` (small) |

All paths are under `admin_panel/public/`. Styles live in `css/stations.css` (bento, board, dialogs) and `css/chat.css` (messenger); colours come from `css/tokens.css`.

## Ground rules of this codebase

These are what break a converted page most often:

- **No inline styles or handlers.** The CSP blocks `style="…"` and `onclick`. Use `data-style="width:40%"` for data-driven styles (applied by `js/ui/style-attr.js`, also for markup inserted later) and `data-click="fnName" data-click-args='["a","b"]'` (also `data-input`, `data-change`, `data-submit`; arg tokens `$this`, `$event`, `$value`, `$checked`). The named function must be on `window`.
- **Click dispatch bubbles to every ancestor with `data-click`.** So never nest a clickable button inside a clickable card/row; split the row into a main button and a separate tools group (see `.mnt-caravan` / `.mnt-caravan-main` in mentors.js).
- **Escape everything** interpolated into templates with `esc()`. Build args with a helper like `crvArgs(...ids)` (already global from caravans.js: `crvArgs`, `crvFa`, `crvAvatar`, `crvInitial`, `crvFadeOut`, `crvMemberCount`; `mntFitNotch` from mentors.js). Reuse them instead of re-declaring.
- **Persian digits:** format numbers with `crvFa(n)` (`toLocaleString('fa-IR')`); `fa-digits.js` converts the rest.
- Scripts are classic (shared globals) and load in the order in `index.html`; a helper from another file is only usable if that file loads earlier.
- Each tab is a `<section id="…-tab" class="tab-panel">` registered in `js/core/router.js` (`TABS`, with a `load` that calls your loader on every visit).
- Follow the repo rules in `AGENTS.md`: log the change in `AGENT_CHANGELOG.md`; update `admin_panel/docs/SERVER_CHECKLIST.md` if the server needs anything.

## The page anatomy

A converted page has two views inside its tab section, swapped with a fade:

1. **Overview** (`#xxx-overview-view`): an action row with the primary "+ new" button, then a `.lst-bento` grid:
   - one big `.lst-tile.lst-tile-stations.glass` (3 cols × 3 rows) holding the head (title + `.lst-tile-sub` hint + `.crv-filters`: search box and pill selects) and a `.crv-card-grid` of item cards, ending with a dashed "+ new" card (`.crv-card.crv-card-add`) when no filter is active, or an `.lst-empty` when the filter finds nothing;
   - small side tiles: `آمار کلی` (`.lst-mini-stats`), a status bar with legend (`.lst-bar` + `.lst-legend`), `دسترسی سریع` (`.lst-quick-btn`s), one or two ranked lists (`.lst-list` with `.crv-rank`), and a wide `نیازمند توجه` tile (`.lst-tile-wide`) listing clickable problems.
2. **Detail** (`#xxx-detail-view`, starts `data-style="display: none;"`): `.lsv-head` (round back button, `h3` title, status chip) then a `.lsv-board` with:
   - `.lsv-board-head`: `.lsv-board-title` (h4 + subline) | `.lsv-notch-wrap > nav.lsv-notch` of circles (`.lsv-circle`, the active one `.is-active`, a count/state badge, and a last dashed "+" circle `.lsv-circle-add`) | `.lsv-round-group` of round action buttons (danger one last, `.lsv-round-danger`);
   - `.lsv-flow` with columns `.lsv-col` (a `.lsv-col-card` + `.lsv-col-label` with icon and `.lsv-col-count`) separated by `<div class="lsv-link" aria-hidden="true">` dashed connectors. The first (right, RTL) column is the identity card (`.crv-mentor` style: big round photo, name, phone, `.lsv-facts` chips, actions); the next columns list related things as `.lsv-row` rows, each list ending with a dashed "+ add" row (`.lsv-row-add`).

Choose what the circles are: **sibling items** (all caravans / all instructors — switching a circle switches the page) or **the item's children** (a mentor's caravans — switching a circle changes what the next columns show). Pick whatever makes the notch answer "what else can I jump to from here".

Full markup templates for every piece are in `references/markup.md`. Read it before writing HTML.

## Loading and motion

The feel of these pages comes from four behaviours; implement all of them:

1. **Shimmer while loading**: `xxxSetLoading(on)` toggles `.is-loading` on every `.lst-bento > .lst-tile` (a light band sweeps across; `.stat-value`s turn into bars). On the **first** load (no data yet) it also fills the card grid with 6 skeleton cards (`.crv-card.lst-skel` with `.lst-skel-line`s) and each list tile with `.lst-skel-lines` rows. A refresh keeps the old content under the shimmer. Call `xxxSetLoading(true)` once at script load if there is no data, so the tab never flashes empty.
2. **Smooth re-render**: every card, row and circle gets a stable `data-anim-key="prefix:id"`; redraw through `NopaFlip.render(container, drawFn)` so moved items glide, new ones fade in, removed ones fade out. Filters and sorting go through this too.
3. **View switch**: open = `crvFadeOut(overview, () => paint detail + NopaFlip.enter(head, board, circles, columns))` and scroll the tab into view with `NopaMotion.scrollBehavior()`; close = fade the detail out, show the overview, `NopaFlip.enter` its tiles. Switching between items while the page is open only re-enters the columns, and pops the picked circle (`scale 0.8 → 1.12 → 1`). After painting, call `mntFitNotch(view)` (it cuts the board's notch and centres the active circle).
4. **Draw now, detail later**: paint the detail page immediately from list data; parts that need a second request (students, sessions, totals) show skeleton rows and `.is-loading` on their `.lsv-col-card`, are cached in a `Map` by id, and are repainted only if that item is still the open one (guard with the active id after `await`).

Everything respects `prefers-reduced-motion` already through NopaFlip and the CSS; keep it that way (no new animations without the reduced-motion guard).

The JS skeleton for all of this (loader, set-loading, bento draw, open/close/select, paint, detail loader) is in `references/js-patterns.md`. Start from it.

## Dialogs

Every dialog uses the station-editor shell: `.modal-overlay.lse-overlay` > `.lse` (+ `.lse-sm` for small, `.lse-editor` for large; add a width class if needed) > `header.lse-head.lse-head-plain` (`.lse-id` with `.lse-id-icon.is-accent` + title/subtitle, round close button) > `.lse-body` of `.lse-card` sections with `.lse-field` labels and `.lse-grid.lse-grid-2` > `footer.lse-foot` (`.lse-foot-note` | `.lse-btn` cancel + `.lsv-pill` primary). Multi-step creation uses `.lse-tabs` of `.lse-step`s with numbered badges (caravan wizard). Pick lists inside dialogs are `.lse-tree-row` rows (with `.crv-cand` for checkboxes) inside `.crv-results.crv-results-tall`. Keep existing element ids when converting so the old JS keeps working. Templates: `references/markup.md#dialogs`.

## Messenger pages

For anything that is a list of threads plus a conversation (tickets, cases, comments), reuse `.chm` from `css/chat.css` in its own container id: `.chm-side` (head, `.chm-search`, `.chm-chips` filters, `.chm-list` of `.chm-row`s; optional collapsible groups like `.mtk-group`) and `.chm-main` (`.chm-empty` state, `.chm-conv` with `.chm-head`, `.chm-stream` of `.chm-msg.is-mine|is-other` bubbles with `.chm-day` separators, `.chm-compose-wrap` + `.chm-composer`). Set `data-state="list|conv"` on the container for the phone layout and wire `.chm-back`. Loading = `chm-row chm-skel` skeleton rows. Use ids prefixed with your own short prefix — the chat tab's JS looks elements up by `chm-*` ids. See `js/features/tickets-chat.js` for a ~300-line complete example.

## Workflow for converting a page

1. Read the current tab markup in `index.html`, its JS, and the API it calls (route in `admin_panel/src/routes/admin.ts`, controller in `src/controllers`). Note what data exists for cards, stats and the detail page; if one small `include`/`select` on the backend unlocks a much better page (live counts, related items), add it and keep it backward compatible.
2. Pick a 3-letter prefix (`crv`, `mnt`, `ins`, `mtk`…) for new ids, classes and functions so nothing collides.
3. Replace the tab markup with overview + detail views; convert its dialogs to lse; delete markup and code that became unreachable (old tables, drawers) after grepping for other callers.
4. Write the JS from `references/js-patterns.md`; keep old global function names that other files call (wrap them if their meaning changed).
5. Add only the CSS the shared classes don't cover, in a commented section at the end of `css/stations.css` (or `chat.css`), using tokens (`var(--text)`, `rgb(var(--primary-rgb) / 0.12)`, `var(--app-card-*)`), plus `@media (max-width: 900px)` stacking for new column classes.
6. Verify (below), then log the change.

## Verifying

- `node --check` every changed script; `npx tsc --noEmit` in `admin_panel/` if the backend changed.
- Look at it in the browser. The real API needs a login, so a small mock server is usually the practical route: serve `admin_panel/public` at `/admin/` (map `/admin/libs/fontawesome` to `node_modules/@fortawesome/fontawesome-free`), answer the tab's API routes with realistic Persian sample data, set `localStorage.nopa_admin_token` and reload. `scripts/mock-server.js` in this skill is a starting point; extend its `api()` function for the routes your tab needs.
- Check: first load shows skeletons then content; filters animate; opening/closing the detail fades; switching circles; every dialog opens, saves and closes; dark and light theme; 375px width has no horizontal scroll (`document.documentElement.scrollWidth === innerWidth`).
- Screenshots right after a click can show a half-finished enter animation (empty board) — wait ~1.5s before judging.
- Say plainly in the final message what was checked only against the mock and not against the real API.
