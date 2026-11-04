# Markup templates

Replace `xxx` with the page's prefix and the Persian labels with the page's own. All of these are the exact
structures used by the caravans / mentors tabs, so the shared CSS in `css/stations.css` styles them with no extra rules.

Contents: [Tab section](#tab-section) · [Overview bento](#overview-bento) · [Item card](#item-card) ·
[Side tiles](#side-tiles) · [Detail page](#detail-page) · [Circles](#circles) · [Identity card](#identity-card) ·
[Rows](#rows) · [Skeletons](#skeletons) · [Chips and states](#chips-and-states) · [Dialogs](#dialogs) · [Messenger](#messenger)

## Tab section

```html
<!-- XXX: what it is. Drawn by js/features/xxx.js; styles in css/stations.css (.lst-*, .lsv-*, .xxx-*). -->
<section id="xxx-tab" class="tab-panel" data-style="display: none;">
  <div id="xxx-overview-view"> …overview… </div>
  <div id="xxx-detail-view" data-style="display: none;"> …detail… </div>
</section>
```

## Overview bento

```html
<div class="lms-head-actions u-flex u-justify-end u-items-center u-mb-20">
  <div class="u-flex u-gap-10">
    <button type="button" class="btn-primary u-bgc-primary" data-click="openXxxModal"><i class="fa-solid fa-plus"></i> ثبت مورد جدید</button>
  </div>
</div>

<div class="lst-bento xxx-bento">
  <div class="lst-tile lst-tile-stations glass">
    <div class="lst-tile-head">
      <h4 class="lst-tile-title"><i class="fa-solid fa-ICON"></i> همه موارد <span class="lst-tile-sub" id="xxx-count-badge">برای ورود به صفحه هر مورد بزنید</span></h4>
      <div class="crv-filters">
        <div class="search-box">
          <i class="fa-solid fa-search"></i>
          <input aria-label="جستجو" type="text" id="xxx-search" class="input-ctrl" placeholder="نام، ..." data-input="filterXxxList">
        </div>
        <select aria-label="فیلتر وضعیت" id="xxx-status-filter" class="select-ctrl" data-change="filterXxxList">
          <option value="all">همه وضعیت‌ها</option>
        </select>
        <select aria-label="مرتب‌سازی" id="xxx-sort" class="select-ctrl" data-change="filterXxxList">
          <option value="name">ترتیب نام</option>
        </select>
      </div>
    </div>
    <div id="xxx-bento-list" class="crv-card-grid" aria-busy="true"></div>
  </div>

  <!-- side tiles, see below; the last one is usually lst-tile-wide -->
</div>
```

The big tile spans 3 of 4 columns and 3 rows; side tiles fill the 4th column, then wrap. `grid-auto-flow: dense`
packs them, so 5–7 side tiles is a good amount. The bento drops to 2 columns under 1100px and 1 under 640px on its own.

## Item card

A whole card is one `<button>` (so no buttons inside it). `data-anim-key` must be stable per item.

```html
<button type="button" class="crv-card" data-anim-key="xx:ID" data-click="openXxxView" data-click-args='["ID"]' title="ورود به ...">
  <span class="crv-card-top">
    <!-- crvAvatar(url, name, 'crv-card-cover'): round picture, first letter when missing -->
    <span class="crv-card-cover">ن</span>
    <span class="crv-card-name"><strong>نام مورد</strong><span class="lst-chip lst-chip-active"><i class="fa-solid fa-circle-check"></i> فعال</span></span>
  </span>
  <span class="crv-card-mentor"><i class="fa-solid fa-medal"></i><span>یک خط توضیح</span></span>
  <span class="crv-card-cap"><span>برچسب</span><strong>۳ / ۲۵</strong></span>
  <span class="lst-bar"><span class="lst-bar-active" data-style="width:12%"></span></span>   <!-- optional progress -->
  <span class="crv-card-foot">
    <span class="crv-faces"><span class="crv-face">ع</span><span class="crv-face crv-face-more">+۲</span></span>
    <span class="crv-card-nums">
      <span class="u-c-accent-text"><i class="fa-solid fa-coins"></i> ۳۲۰</span>
      <span class="u-c-success-text"><i class="fa-solid fa-route"></i> ۶۲٪</span>
    </span>
  </span>
</button>

<!-- last card when no filter is active -->
<button type="button" class="crv-card crv-card-add" data-anim-key="xx-add" data-click="openXxxModal" title="ثبت مورد جدید">
  <span class="lsv-round lsv-round-lg"><i class="fa-solid fa-plus"></i></span>
  <span>مورد جدید</span>
</button>

<!-- when a filter finds nothing -->
<div class="lst-empty" data-anim-key="xx-empty">موردی با این مشخصات یافت نشد.</div>
```

Bar colours by fill: `lst-bar-active` (<80%), `lst-bar-scheduled` (80–99%), `lst-bar-locked` (full).

## Side tiles

```html
<div class="lst-tile glass">
  <h4 class="lst-tile-title"><i class="fa-solid fa-chart-simple"></i> آمار کلی</h4>
  <div class="lst-mini-stats">
    <div class="lst-mini-stat"><span class="stat-label">کل</span><span class="stat-value u-c-primary-text" id="xxx-stat-total">-</span></div>
    <!-- 4 stats; colours u-c-primary-text / u-c-success-text / u-c-accent-text / u-c-info-text -->
  </div>
</div>

<div class="lst-tile glass">
  <h4 class="lst-tile-title"><i class="fa-solid fa-user-shield"></i> وضعیت‌ها</h4>
  <div id="xxx-bento-status"></div>   <!-- filled with: -->
  <!--
  <div class="lst-bar"><span class="lst-bar-active" data-style="width:60%"></span><span class="lst-bar-scheduled" data-style="width:25%"></span><span class="lst-bar-locked" data-style="width:15%"></span></div>
  <div class="lst-legend">
    <div class="lst-legend-row"><span><span class="lst-dot lst-dot-active"></span>فعال</span><strong>۱۲</strong></div>
  </div>
  -->
</div>

<div class="lst-tile glass">
  <h4 class="lst-tile-title"><i class="fa-solid fa-bolt"></i> دسترسی سریع</h4>
  <div class="lst-quick">
    <button type="button" class="lst-quick-btn" data-click="openXxxModal"><i class="fa-solid fa-plus"></i> مورد جدید</button>
    <button type="button" class="lst-quick-btn" data-click="loadXxx"><i class="fa-solid fa-sync"></i> بروزرسانی</button>
    <button type="button" class="lst-quick-btn" data-click="exportData" data-click-args='["xxx","excel"]'><i class="fa-solid fa-file-excel"></i> خروجی اکسل</button>
  </div>
</div>

<!-- ranked list -->
<ul class="lst-list">
  <li class="lst-list-item lst-clickable" role="button" tabindex="0" data-click="openXxxView" data-click-args='["ID"]'>
    <span class="crv-rank">۱</span>
    <span class="lst-avatar">ن</span>
    <span class="lst-grow"><strong>نام</strong></span>
    <span class="u-c-accent-text"><i class="fa-solid fa-star"></i> ۴٫۵</span>
  </li>
</ul>

<!-- needs attention (in a lst-tile lst-tile-wide) -->
<ul class="lst-list">
  <li class="lst-list-item lst-clickable" role="button" tabindex="0" data-click="openXxxView" data-click-args='["ID"]'>
    <i class="fa-solid fa-triangle-exclamation lst-warn"></i>
    <span class="lst-grow"><strong>نام</strong>: بدون تصویر، بدون رزومه</span>
  </li>
</ul>
<!-- all good: <div class="lst-empty"><i class="fa-solid fa-circle-check u-c-success-text"></i> همه چیز کامل است.</div> -->
```

## Detail page

```html
<div class="lsv-head">
  <button type="button" class="lsv-round" data-click="closeXxxView" title="بازگشت" aria-label="بازگشت"><i class="fa-solid fa-arrow-right"></i></button>
  <h3 id="xxx-title">عنوان</h3>
  <span id="xxx-state"></span>   <!-- status chip; add #xxx-state:empty { display:none } -->
</div>
<section class="lsv-board xxx-board">
  <header class="lsv-board-head">
    <div class="lsv-board-title"><h4>عنوان بورد</h4><span id="xxx-sub"></span></div>
    <div class="lsv-notch-wrap"><nav class="lsv-notch" id="xxx-circles" aria-label="..."></nav></div>
    <div class="lsv-round-group">
      <button type="button" class="lsv-round" data-click="editActiveXxx" title="ویرایش" aria-label="ویرایش"><i class="fa-solid fa-pen"></i></button>
      <button type="button" class="lsv-round lsv-round-danger" data-click="deleteActiveXxx" title="حذف" aria-label="حذف"><i class="fa-solid fa-trash"></i></button>
    </div>
  </header>
  <div class="lsv-flow crv-flow xxx-flow">
    <div class="lsv-col crv-col-mentor">                         <!-- 300px identity column (right in RTL) -->
      <div class="lsv-col-card crv-mentor" id="xxx-info-card"></div>
      <div class="lsv-col-label"><i class="fa-solid fa-id-card"></i> شناسنامه</div>
    </div>
    <div class="lsv-link" aria-hidden="true"></div>
    <div class="lsv-col mnt-col-caravans">                       <!-- ~420px list column -->
      <div class="lsv-col-card" id="xxx-list-card"><div class="crv-members-list" id="xxx-list"></div></div>
      <div class="lsv-col-label"><i class="fa-solid fa-ICON"></i> عنوان ستون <span class="lsv-col-count" id="xxx-list-count">0</span></div>
    </div>
    <div class="lsv-link" aria-hidden="true"></div>
    <div class="lsv-col mnt-col-students">                       <!-- flexible last column -->
      <div class="lsv-col-card" id="xxx-third-card"> … </div>
      <div class="lsv-col-label"><i class="fa-solid fa-ICON"></i> ستون سوم</div>
    </div>
  </div>
</section>
<!-- optional panels under the board (station page): <section class="lsv-panel"><header class="lsv-panel-head"><h4>…</h4></header>…</section> -->
```

Column width classes available: `crv-col-mentor` (300px), `crv-col-members` (≤540px), `crv-col-assets` (flex, tiles),
`mnt-col-caravans` (≤420px), `mnt-col-students` (flex). All stack under 900px. A column holding tiles instead of rows
can use `.crv-assets-card` with `.crv-asset.is-accent|is-primary|is-success|is-info` tiles.

## Circles

```html
<button type="button" class="lsv-circle is-active" data-anim-key="c:ID" data-click="selectXxxCircle" data-click-args='["ID"]' title="نام" aria-current="true">
  <span class="lsv-circle-main">
    <span class="lsv-circle-img"><img src="URL" alt="" loading="lazy" data-error="lmsImageFallback" data-error-args='["$this", "ن"]'></span>
    <!-- no picture: <span class="lsv-circle-img"><span>ن</span></span> -->
    <span class="lsv-circle-badge lsv-state-active">۳</span>   <!-- lsv-state-active | -scheduled | -locked; text or an icon -->
  </span>
  <span class="lsv-circle-name"><span>نام</span></span>
</button>
<!-- always last -->
<button type="button" class="lsv-circle lsv-circle-add" data-anim-key="c-add" data-click="openXxxModal" title="افزودن" aria-label="افزودن">
  <span class="lsv-circle-main">
    <span class="lsv-circle-img"><i class="fa-solid fa-plus"></i></span>
    <span class="lsv-circle-badge lsv-state-add"><i class="fa-solid fa-plus"></i></span>
  </span>
  <span class="lsv-circle-name"><span>افزودن</span></span>
</button>
```

## Identity card

Inside `.lsv-col-card.crv-mentor` (centred column):

```html
<span class="crv-mentor-photo">ن</span>                     <!-- crvAvatar(url, name, 'crv-mentor-photo') -->
<strong class="crv-mentor-name">نام</strong>
<span class="crv-mentor-phone" dir="ltr">0912…</span>
<div class="mnt-mini">                                       <!-- 3 small counters; add class is-warn to a span to tint it red -->
  <span><strong>۳</strong><small>کاروان</small></span>
  <span><strong>۵</strong><small>دانش‌آموز</small></span>
  <span><strong>…</strong><small>در حال بارگذاری</small></span>
</div>
<div class="lsv-facts crv-mentor-facts"><span><i class="fa-solid fa-location-dot"></i> تهران</span></div>
<p class="crv-mentor-bio">…</p>
<div class="mnt-info-actions">
  <button type="button" class="lsv-pill" data-click="editXxx" data-click-args='["ID"]'><i class="fa-solid fa-pen"></i> ویرایش</button>
  <button type="button" class="lse-btn" data-click="…"><i class="fa-solid fa-user-shield"></i> وضعیت</button>
</div>
```

## Rows

```html
<!-- plain row (not clickable as a whole) with hover-revealed tools -->
<div class="lsv-row crv-member" data-anim-key="r:ID">
  <span class="lsv-row-avatar lsv-row-num">ن</span>
  <span class="lsv-row-text"><strong>نام</strong><span>NP-1001 · <bdi dir="ltr">0912…</bdi></span></span>
  <span class="lsv-round-group crv-member-tools">
    <button type="button" class="lsv-round lsv-round-sm" data-click="…" data-click-args='["ID"]' title="جزئیات" aria-label="جزئیات"><i class="fa-solid fa-id-card"></i></button>
    <button type="button" class="lsv-round lsv-round-sm lsv-round-danger" data-click="…" title="حذف" aria-label="حذف"><i class="fa-solid fa-trash"></i></button>
  </span>
</div>

<!-- selectable row: main part is its own button, tools stay outside it -->
<div class="lsv-row crv-member mnt-caravan is-active" data-anim-key="r:ID">
  <button type="button" class="mnt-caravan-main" data-click="selectXxx" data-click-args='["ID"]' aria-current="true">
    <span class="lsv-row-avatar lsv-row-num">ک</span>
    <span class="lsv-row-text"><strong>نام</strong><span>۳ / ۲۵ عضو</span><span class="lst-bar"><span class="lst-bar-active" data-style="width:12%"></span></span></span>
  </button>
  <span class="lsv-round-group crv-member-tools"> … </span>
</div>

<!-- last row of a list -->
<button type="button" class="lsv-row lsv-row-add crv-member" data-anim-key="r-add" data-click="…">
  <span class="lsv-row-avatar lsv-row-plus"><i class="fa-solid fa-plus"></i></span>
  <span class="lsv-row-text"><strong>افزودن</strong><span>توضیح کوتاه</span></span>
</button>

<!-- empty list -->
<div class="lsv-col-empty">هنوز موردی ثبت نشده است.</div>
```

## Skeletons

```html
<!-- card skeleton (×6 in the grid on first load) -->
<div class="crv-card lst-skel" aria-hidden="true">
  <span class="crv-card-top"><span class="crv-card-cover"></span><span class="crv-card-name"><span class="lst-skel-line"></span><span class="lst-skel-line lst-skel-chip"></span></span></span>
  <span class="lst-skel-line lst-skel-short"></span>
  <span class="lst-skel-line"></span>
  <span class="lst-skel-line lst-skel-short"></span>
</div>

<!-- list tile skeleton -->
<div class="lst-skel-lines" aria-hidden="true"><span class="lst-skel-row"></span><span class="lst-skel-row"></span><span class="lst-skel-row"></span></div>

<!-- row skeleton inside a column (column card also gets .is-loading for the sweep) -->
<div class="lsv-row crv-member" aria-hidden="true"><span class="lsv-row-avatar lst-skel-avatar"></span>
  <span class="lsv-row-text"><span class="lst-skel-line"></span><span class="lst-skel-line lst-skel-short"></span></span></div>

<!-- identity card while loading -->
<span class="crv-mentor-photo lst-skel-avatar"></span><span class="lst-skel-line"></span><span class="lst-skel-line lst-skel-short"></span>
```

## Chips and states

`lst-chip lst-chip-active` (green, active), `lst-chip-scheduled` (amber, pending/waiting), `lst-chip-locked`
(red, suspended/full). Status pills in tables: `lsv-status is-ok | is-warn`. Text tints: `u-c-primary-text`,
`u-c-success-text`, `u-c-accent-text`, `u-c-info-text`, `u-c-danger-text`. Buttons: `lsv-round` (round outline icon),
`lsv-pill` (inverted primary pill), `lse-btn` (outline pill), `lst-quick-btn` (tile button).

## Dialogs

Small dialog:

```html
<div id="xxx-modal" class="modal-overlay lse-overlay u-z-z-modal" data-style="display:none">
  <div class="lse lse-sm">
    <header class="lse-head lse-head-plain">
      <div class="lse-id">
        <span class="lse-id-icon is-accent"><i class="fa-solid fa-pen"></i></span>
        <div class="lse-id-text"><h3 id="xxx-modal-title">عنوان</h3><span>یک خط توضیح</span></div>
      </div>
      <button type="button" class="lsv-round" data-click="NopaActions.hide" data-click-args='["xxx-modal"]' title="بستن" aria-label="بستن"><i class="fa-solid fa-xmark"></i></button>
    </header>
    <form class="lse-form" data-submit="saveXxx" data-submit-args='["$event"]'>
      <div class="lse-body">
        <section class="lse-card">
          <h4 class="lse-card-title"><i class="fa-solid fa-circle-info"></i> بخش</h4>
          <div class="lse-grid lse-grid-2">
            <label class="lse-field"><span>نام <b class="lse-req">*</b></span><input type="text" id="xxx-name" class="input-ctrl" required></label>
            <label class="lse-field"><span>توضیح <small>اختیاری</small></span><input type="text" id="xxx-desc" class="input-ctrl"></label>
          </div>
          <p class="lse-hint">راهنمای کوتاه.</p>
        </section>
      </div>
      <footer class="lse-foot">
        <span class="lse-foot-note"><i class="fa-solid fa-circle-info"></i> یادداشت</span>
        <div class="lse-foot-actions">
          <button type="button" class="lse-btn" data-click="NopaActions.hide" data-click-args='["xxx-modal"]'>انصراف</button>
          <button type="submit" class="lsv-pill"><i class="fa-solid fa-check"></i> ذخیره</button>
        </div>
      </footer>
    </form>
  </div>
</div>
```

- Large form: `<div class="lse lse-editor">` (fixed height, body scrolls). Override width with a page class if needed.
- Steps: copy `#caravan-wizard-modal` (`nav.lse-tabs` of `button.lse-tab.lse-step` with `.lse-step-num`, panes toggled by JS, disabled steps until valid).
- Pick list with checkboxes inside `.lse-body`:
  `<label class="search-box crv-modal-search"><i class="fa-solid fa-search"></i><input class="input-ctrl" …></label>`
  then `<div class="crv-results crv-results-tall">` of
  `<label class="lse-tree-row crv-cand"><input type="checkbox" …><span class="lse-tree-num crv-result-avatar">ک</span><span class="lse-tree-text"><strong>نام</strong><small>توضیح</small></span><span class="lst-chip …">…</span></label>`
  and add `crv-modal-tall` next to `lse-sm` so the list gets room.
- Radio choices: `.mnt-mod-options` of `label.lse-tree-row.mnt-mod-option.is-ok|is-warn|is-danger` (see `#mentor-moderation-modal`).
- Shared person fields (`<div data-person-fields="prefix" data-extra="city">`) work inside `.lse-grid-2`.
- Open: `modal.style.display = 'flex'; modal.style.zIndex = 'var(--z-modal)';` Close: `NopaActions.hide(id)`.
- Titles are `textContent` (no icon inside the h3; the icon lives in `.lse-id-icon`).

## Messenger

```html
<div id="xxx-messenger" class="chm xxx" data-state="list">
  <aside class="chm-side" aria-label="فهرست">
    <div class="chm-side-head">
      <div class="chm-side-title"><i class="fa-solid fa-inbox"></i>عنوان</div>
      <button type="button" class="chm-icon-btn" id="xxx-refresh" title="بازخوانی" aria-label="بازخوانی"><i class="fa-solid fa-rotate"></i></button>
    </div>
    <label class="search-box chm-search"><i class="fa-solid fa-magnifying-glass"></i><input type="search" id="xxx-filter-text" placeholder="جستجو..." autocomplete="off"></label>
    <div class="chm-chips" id="xxx-chips" role="tablist"></div>
    <div class="chm-list" id="xxx-list" aria-live="polite"></div>
  </aside>
  <section class="chm-main" aria-label="گفتگو">
    <div class="chm-empty" id="xxx-empty"><span class="chm-empty-icon"><i class="fa-solid fa-inbox"></i></span><strong>یک مورد را انتخاب کنید</strong><span>توضیح</span></div>
    <div class="chm-conv" id="xxx-conv" hidden>
      <header class="chm-head">
        <button type="button" class="chm-icon-btn chm-back" id="xxx-back" aria-label="بازگشت به فهرست"><i class="fa-solid fa-arrow-right"></i></button>
        <span class="chm-avatar" id="xxx-head-avatar"></span>
        <div class="chm-head-text"><strong id="xxx-head-title"></strong><span id="xxx-head-sub"></span></div>
        <div class="chm-head-tools"><button type="button" class="chm-pill-btn is-ok" id="xxx-resolve"><i class="fa-solid fa-circle-check"></i>بستن</button></div>
      </header>
      <div class="chm-stream" id="xxx-stream" tabindex="0" aria-live="polite"></div>
      <div class="chm-compose-wrap">
        <div class="chm-notice" id="xxx-notice" hidden></div>
        <form class="chm-composer" id="xxx-composer" autocomplete="off">
          <textarea id="xxx-input" rows="1" maxlength="4000" placeholder="پاسخ..." aria-label="متن پاسخ"></textarea>
          <button type="submit" class="chm-send" aria-label="ارسال"><i class="fa-solid fa-paper-plane"></i></button>
        </form>
      </div>
    </div>
  </section>
</div>
```

Rows: `button.chm-row[.is-active]` > avatar (`span.chm-avatar[.is-gold][.is-sm]` with img or initial) +
`span.chm-row-body` > `.chm-row-top` (`.chm-row-title`, `.chm-row-time`) + `.chm-row-bottom` (`.chm-row-preview`,
`.chm-badge` count or `.chm-mini-chip.is-open|is-reviewing|is-resolved`). Filters: `button.chm-chip[.is-active]` with
`.chm-chip-count`. Bubbles: `div.chm-msg.is-other|is-mine.is-first` > avatar (other side only) + `div.chm-bubble` >
`.chm-sender` (+ `.chm-role`), optional `.chm-att`, `p.chm-text`, `.chm-meta`; day separators `div.chm-day`; system
line `div.chm-msg.is-system > span.chm-system`. Skeleton row:
`<div class="chm-row chm-skel" aria-hidden="true"><span class="chm-skel-avatar"></span><span class="chm-skel-body"><span class="lst-skel-line chl-skel-title"></span><span class="lst-skel-line lst-skel-short"></span></span></div>`.
Collapsible groups: see `.mtk-group` / `.mtk-group-head` / `.mtk-group-body` in `css/chat.css`.
