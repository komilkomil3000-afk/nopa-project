// «لغو» for deletes and edits: a toast with an undo button that works for 10 seconds.
// Loaded after toast.js and js/core/api.js, before the feature modules.
//
// A delete (nothing reaches the server until the time is up):
//   NopaUndo.later({
//     message: 'خبر حذف شد.',
//     hide:    () => NopaUndo.hideEl(card),          // show it gone now; returns the way back
//     commit:  () => request(url, { method: 'DELETE' }), // runs after 10s; a Response that is not ok, a throw or false = failed
//     done:    () => loadNews(),                      // optional, after a commit that worked
//   });
//   «لغو» puts the item back and nothing is sent; a failed commit puts it back too and shows the error.
//
// An edit the server checks inside the form (it is saved at once; «لغو» sends the old values back):
//   NopaUndo.after({ message: 'تغییرات ذخیره شد.', undo: () => NopaApi.json(url, { method: 'PUT', body: JSON.stringify(old) }), done: reload });
//
// Pending deletes are sent at once when the page is closed or reloaded.
(function () {
  const WINDOW_MS = 10000;
  const pending = new Set();

  /** Hides an element now; the returned function shows it again. */
  function hideEl(el) {
    if (!el) return () => {};
    const els = Array.isArray(el) ? el : [el];
    const before = els.map(e => e.style.display);
    els.forEach(e => { e.style.display = 'none'; });
    return () => els.forEach((e, i) => { e.style.display = before[i]; });
  }

  const ROW = 'tr, li, .lsv-row, [data-undo-row]';

  /** The row (table row, list row, card) of the button just clicked through data-click, or null. */
  function lastRow(selector) {
    const el = window.NopaActions && window.NopaActions.lastEl;
    return el && el.isConnected ? el.closest(selector || ROW) : null;
  }

  /** Hides the row of the button just clicked; returns the way back. */
  function hideRow(selector) {
    return hideEl(lastRow(selector));
  }

  async function failureOf(result) {
    if (result === false) return 'انجام تغییر ممکن نشد.';
    if (result && typeof result === 'object' && typeof result.ok === 'boolean' && typeof result.clone === 'function' && !result.ok) {
      try {
        const body = await result.clone().json();
        return (body && (body.error || body.message)) || `خطا (${result.status})`;
      } catch (_) {
        return `خطا (${result.status})`;
      }
    }
    return null;
  }

  function toast(message, onUndo) {
    return showToast(message, 'info', {
      duration: WINDOW_MS,
      noPause: true,
      action: { label: 'لغو', onClick: onUndo },
    });
  }

  function later(opts) {
    let restore = null;
    try { restore = opts.hide ? opts.hide() : null; } catch (e) { console.error(e); }
    const putBack = () => {
      try { if (typeof restore === 'function') restore(); if (opts.restore) opts.restore(); } catch (e) { console.error(e); }
    };

    const item = { done: false, timer: null, el: null };
    item.commit = async () => {
      if (item.done) return;
      item.done = true;
      clearTimeout(item.timer);
      pending.delete(item);
      if (item.el && typeof hideToast === 'function') hideToast(item.el);
      let error;
      try {
        error = await failureOf(await opts.commit());
      } catch (e) {
        error = (e && e.message) || 'انجام تغییر ممکن نشد.';
      }
      if (error) {
        putBack();
        showToast(error, 'error');
        return;
      }
      try { if (opts.done) await opts.done(); } catch (e) { console.error(e); }
    };

    item.el = toast(opts.message, () => {
      if (item.done) return;
      item.done = true;
      clearTimeout(item.timer);
      pending.delete(item);
      putBack();
      if (opts.undone) opts.undone();
    });
    item.timer = setTimeout(item.commit, WINDOW_MS);
    pending.add(item);
    return item;
  }

  function after(opts) {
    let used = false;
    toast(opts.message, async () => {
      if (used) return;
      used = true;
      let error;
      try {
        error = await failureOf(await opts.undo());
      } catch (e) {
        error = (e && e.message) || 'برگرداندن تغییر ممکن نشد.';
      }
      if (error) {
        showToast(`برگرداندن تغییر انجام نشد: ${error}`, 'error');
      } else {
        showToast(opts.undoneMessage || 'تغییر لغو شد.', 'success', { duration: 3000 });
      }
      // done(ok): ok is false when sending the old values back failed
      try { if (opts.done) await opts.done(!error); } catch (e) { console.error(e); }
    });
  }

  const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

  /**
   * An edit already saved with `method url body`: «لغو» sends the old values of the same fields back.
   * before: the item as it was (fields named like the body's); revert: the body to send back, when the names differ.
   * form: true sends the old values as multipart form fields (the body may then be a FormData).
   * Fields the old item does not have (a password, a file) are left as they are.
   * When nothing changed there is nothing to undo, and a plain success toast is shown.
   */
  function afterEdit(opts) {
    let back = opts.revert;
    if (!back) {
      back = {};
      const before = opts.before || {};
      const sent = (typeof FormData !== 'undefined' && opts.body instanceof FormData)
        ? Object.fromEntries(Array.from(opts.body.entries()).filter(([, v]) => typeof v === 'string'))
        : (opts.body || {});
      // form fields arrive as text: compare them as text
      const norm = v => (opts.form ? String(v ?? '') : v);
      Object.keys(sent).forEach(k => {
        if (sent[k] === undefined) return; // not sent, so not changed
        if (Object.prototype.hasOwnProperty.call(before, k) && !same(norm(before[k]), norm(sent[k]))) back[k] = before[k];
      });
    }
    if (!Object.keys(back).length) {
      showToast(opts.message, 'success');
      return;
    }
    after({
      message: opts.message,
      undo: () => {
        let body = JSON.stringify(back);
        if (opts.form) {
          // a multipart endpoint (news, banners): the old values as form fields
          body = new FormData();
          Object.keys(back).forEach(k => { if (back[k] !== undefined && back[k] !== null) body.append(k, String(back[k])); });
        }
        return request(opts.url, { method: opts.method || 'PUT', body });
      },
      undoneMessage: opts.undoneMessage,
      done: opts.done,
    });
  }

  /** Sends every waiting change now (the page is going away). */
  function flush() {
    window.NopaUndo.flushing = true;
    try { Array.from(pending).forEach(item => item.commit()); } finally { window.NopaUndo.flushing = false; }
  }

  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);

  window.NopaUndo = { later, after, afterEdit, hideEl, hideRow, lastRow, flush, WINDOW_MS, flushing: false };
})();
