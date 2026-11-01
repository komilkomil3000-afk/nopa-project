// Table helpers shared by the panel's data tables. Loaded before the feature modules (js/app, js/features).
//   NopaTable.loading(tbody)                       -> skeleton row while a request runs
//   NopaTable.empty(tbody, 'متن', 'fa-icon')        -> friendly empty state
//   NopaTable.error(tbody, 'متن')                   -> error state
//   NopaTable.render(tbody, rows, row => '<tr>…</tr>', { empty: 'متن', emptyIcon })
//   NopaTable.pagination(el, { page, pageSize, total, onChange })
// Row templates must escape user data with esc() (safe.js).
(function () {
  function columns(tbody) {
    const table = tbody && tbody.closest('table');
    const head = table && table.querySelector('thead tr');
    return head ? Math.max(head.children.length, 1) : 1;
  }

  function stateRow(tbody, html, cls) {
    if (!tbody) return;
    tbody.innerHTML = `<tr class="nopa-table-state ${cls}"><td colspan="${columns(tbody)}">${html}</td></tr>`;
  }

  const NopaTable = {
    loading(tbody, text) {
      stateRow(tbody, `<i class="fa-solid fa-circle-notch fa-spin"></i> ${esc(text || 'در حال بارگذاری...')}`, 'is-loading');
    },
    empty(tbody, text, icon) {
      stateRow(tbody, `<i class="${esc(icon || 'fa-solid fa-inbox')}"></i><div>${esc(text || 'موردی یافت نشد')}</div>`, 'is-empty');
    },
    error(tbody, text) {
      stateRow(tbody, `<i class="fa-solid fa-triangle-exclamation"></i><div>${esc(text || 'خطا در دریافت اطلاعات')}</div>`, 'is-error');
    },
    render(tbody, rows, rowHtml, opts) {
      if (!tbody) return;
      opts = opts || {};
      if (!Array.isArray(rows) || rows.length === 0) return NopaTable.empty(tbody, opts.empty, opts.emptyIcon);
      tbody.innerHTML = rows.map(rowHtml).join('');
    },
    pagination(el, opts) {
      if (!el) return;
      const page = Math.max(1, opts.page || 1);
      const pageSize = Math.max(1, opts.pageSize || 20);
      const total = Math.max(0, opts.total || 0);
      const pages = Math.max(1, Math.ceil(total / pageSize));
      el.classList.add('nopa-pagination');
      el.innerHTML = `
        <span class="nopa-pagination-info">صفحه ${page} از ${pages} (کل ${total})</span>
        <span class="nopa-pagination-buttons">
          <button type="button" class="page-btn" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i> قبلی</button>
          <button type="button" class="page-btn" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>بعدی <i class="fa-solid fa-chevron-left"></i></button>
        </span>`;
      el.onclick = e => {
        const btn = e.target.closest('button[data-page]');
        if (btn && !btn.disabled && typeof opts.onChange === 'function') opts.onChange(Number(btn.dataset.page));
      };
    },
  };

  window.NopaTable = NopaTable;
})();
