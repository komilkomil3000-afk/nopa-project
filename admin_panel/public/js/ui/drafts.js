// Drafts of unfinished challenges / stations. They live on the server (one row per admin: /api/v1/admin/drafts/:kind/:key)
// so an admin finds them again on any device; a copy is kept in this browser (localStorage) as a cache and as the
// fallback when the server cannot be reached. Reads are synchronous (from memory), writes go to both places.
//   NopaDrafts.sync()                         loads the drafts from the server (call when a page that shows them opens)
//   NopaDrafts.save('challenge:new', data)    NopaDrafts.load(key) -> { data, savedAt } | null
//   NopaDrafts.remove(key)                    NopaDrafts.has(key)   NopaDrafts.when(key) -> "۱۴۰۵/…"
//   await NopaDrafts.askOnClose({ what: 'چالش', problems: 2 }) -> 'save' | 'discard' | 'stay'
//   Keys are "<kind>:<item>" with kind "challenge" | "station" and item "new" or the id of the item being edited.
//   Changes fire the document event "nopa-drafts" so buttons that depend on drafts can redraw.
(function () {
  const KINDS = ['challenge', 'station'];
  const cache = new Map(); // "kind:key" -> { data, savedAt }
  let lastSync = 0;

  const owner = () => (window.currentUser && window.currentUser.id) || 'anon';
  const storeKey = key => `nopa-draft:${owner()}:${key}`;
  const split = key => { const i = key.indexOf(':'); return [key.slice(0, i), key.slice(i + 1)]; };
  const changed = () => document.dispatchEvent(new Event('nopa-drafts'));

  function readLocal(key) {
    try {
      const raw = localStorage.getItem(storeKey(key));
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }
  function writeLocal(key, value) {
    try { localStorage.setItem(storeKey(key), JSON.stringify(value)); } catch (_) {}
  }
  function removeLocal(key) {
    try { localStorage.removeItem(storeKey(key)); } catch (_) {}
  }
  function localKeys(kind) {
    const prefix = `nopa-draft:${owner()}:${kind}:`;
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) out.push(k.slice(`nopa-draft:${owner()}:`.length));
      }
    } catch (_) {}
    return out;
  }
  const api = (method, kind, key, body) => request(`/api/v1/admin/drafts/${kind}${key ? '/' + encodeURIComponent(key) : ''}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });

  const NopaDrafts = {
    // Replaces the in-memory drafts with the server's (or this browser's copy when the server is unreachable)
    async sync(force) {
      if (!force && Date.now() - lastSync < 15000) return;
      lastSync = Date.now();
      for (const kind of KINDS) {
        try {
          const res = await api('GET', kind);
          if (!res.ok) throw new Error('status ' + res.status);
          const rows = await res.json();
          Array.from(cache.keys()).filter(k => k.startsWith(kind + ':')).forEach(k => cache.delete(k));
          localKeys(kind).forEach(removeLocal);
          rows.forEach(r => {
            const entry = { data: r.data, savedAt: r.savedAt };
            cache.set(`${kind}:${r.key}`, entry);
            writeLocal(`${kind}:${r.key}`, entry);
          });
        } catch (_) {
          localKeys(kind).forEach(k => { const v = readLocal(k); if (v) cache.set(k, v); });
        }
      }
      changed();
    },
    save(key, data) {
      const entry = { data, savedAt: Date.now() };
      cache.set(key, entry);
      writeLocal(key, entry);
      const [kind, item] = split(key);
      api('PUT', kind, item, { data }).catch(() => {});
      changed();
      return true;
    },
    load(key) {
      if (!cache.has(key)) {
        const v = readLocal(key);
        if (v) cache.set(key, v);
      }
      return cache.get(key) || null;
    },
    has(key) { return !!NopaDrafts.load(key); },
    remove(key) {
      const existed = cache.delete(key) || !!readLocal(key);
      removeLocal(key);
      if (existed) {
        const [kind, item] = split(key);
        api('DELETE', kind, item).catch(() => {});
        changed();
      }
    },
    when(key) {
      const d = NopaDrafts.load(key);
      return d ? new Date(d.savedAt).toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }) : '';
    },
    // Offers a saved draft back: 'resume' | 'delete' | 'fresh' (start from scratch, draft stays)
    async offerResume(key, what) {
      const answer = await NopaConfirm(`${what} ذخیره‌شده‌ای از ${NopaDrafts.when(key)} دارید. ادامه آن؟`, {
        title: 'پیش‌نویس',
        okText: 'ادامه پیش‌نویس',
        altText: 'حذف پیش‌نویس',
        cancelText: 'شروع از نو',
        danger: false
      });
      if (answer === true) return 'resume';
      if (answer === 'alt') { NopaDrafts.remove(key); return 'delete'; }
      return 'fresh';
    },
    async askOnClose({ what, problems = 0, isNew = true }) {
      const lead = isNew ? `${what} هنوز ثبت نشده است` : `${what} تغییر ذخیره‌نشده دارد`;
      const gaps = problems ? ` و ${problems.toLocaleString('fa-IR')} مورد نقص دارد` : '';
      const answer = await NopaConfirm(`${lead}${gaps}. پیش‌نویس ذخیره شود تا بعداً کامل کنید و سریع ثبتش کنید؟`, {
        title: 'خروج از ویرایش',
        okText: 'ذخیره پیش‌نویس',
        altText: 'بستن بدون ذخیره',
        altDanger: true,
        cancelText: 'ادامه ویرایش',
        danger: false
      });
      if (answer === true) return 'save';
      if (answer === 'alt') return 'discard';
      return 'stay';
    }
  };
  window.NopaDrafts = NopaDrafts;
})();
