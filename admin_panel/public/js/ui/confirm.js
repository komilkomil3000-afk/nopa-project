// Non-blocking replacement for window.confirm(). Loaded before app.js.
//   if (!(await NopaConfirm('حذف شود؟', { danger: true }))) return;
// Options: title, okText, cancelText, danger (red confirm button).
// Detects danger automatically from the wording (حذف / مسدود / تعلیق / لغو ...) when not given.
(function () {
  const DANGER_WORDS = /حذف|مسدود|تعلیق|لغو|ابطال|پاک|رد |بازنشانی|delete|remove/i;

  function NopaConfirm(message, opts) {
    opts = opts || {};
    const danger = opts.danger !== undefined ? opts.danger : DANGER_WORDS.test(String(message));
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay nopa-confirm';
      overlay.style.zIndex = 'var(--z-modal-confirm)';
      overlay.innerHTML = `
        <div class="modal-content glass nopa-confirm-box" role="alertdialog" aria-labelledby="nopa-confirm-title" aria-describedby="nopa-confirm-msg">
          <div class="modal-header">
            <h3 id="nopa-confirm-title"><i class="fa-solid ${danger ? 'fa-triangle-exclamation' : 'fa-circle-question'}"></i> <span></span></h3>
            <button type="button" class="modal-close" aria-label="بستن">&times;</button>
          </div>
          <p id="nopa-confirm-msg" class="nopa-confirm-msg"></p>
          <div class="nopa-confirm-actions">
            <button type="button" class="btn-action nopa-confirm-cancel"></button>
            <button type="button" class="btn-primary nopa-confirm-ok${danger ? ' is-danger' : ''}"></button>
          </div>
        </div>`;
      // textContent: messages may contain user data
      overlay.querySelector('#nopa-confirm-title span').textContent = opts.title || (danger ? 'تایید عملیات' : 'تایید');
      overlay.querySelector('.nopa-confirm-msg').textContent = String(message == null ? '' : message);
      overlay.querySelector('.nopa-confirm-ok').textContent = opts.okText || (danger ? 'بله، انجام شود' : 'تایید');
      overlay.querySelector('.nopa-confirm-cancel').textContent = opts.cancelText || 'انصراف';

      let done = false;
      const finish = value => {
        if (done) return;
        done = true;
        overlay.style.display = 'none';
        setTimeout(() => overlay.remove(), 0);
        resolve(value);
      };
      overlay.querySelector('.nopa-confirm-ok').addEventListener('click', () => finish(true));
      overlay.querySelector('.nopa-confirm-cancel').addEventListener('click', () => finish(false));
      overlay.querySelector('.modal-close').addEventListener('click', () => finish(false));
      overlay.addEventListener('click', e => { if (e.target === overlay) finish(false); });

      document.body.appendChild(overlay);
      overlay.style.display = 'flex';
      // Safer default focus: cancel for destructive actions, confirm otherwise
      requestAnimationFrame(() => overlay.querySelector(danger ? '.nopa-confirm-cancel' : '.nopa-confirm-ok').focus());
    });
  }

  window.NopaConfirm = NopaConfirm;
})();
