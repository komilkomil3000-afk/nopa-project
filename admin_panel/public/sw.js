// Nopa Admin PWA service worker
// Strategy: network-first for the shell, never cache API calls (live, sensitive data).
const CACHE = 'nopa-admin-v26';
const SCOPE_PREFIX = '/admin';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(SCOPE_PREFIX)) return;
  // Never cache API or uploaded/dynamic content
  if (url.pathname.includes('/api/') || url.pathname.includes('/uploads/')) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => cached || (req.mode === 'navigate' ? caches.match('/admin/') : undefined))
      )
  );
});

// A click on a message notification (js/core/inbox.js): bring the panel forward with the bell open
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const panel = list.find((c) => new URL(c.url).pathname.startsWith(SCOPE_PREFIX));
      if (!panel) return self.clients.openWindow(SCOPE_PREFIX + '/');
      panel.postMessage({ type: 'nopa:open-inbox' });
      return panel.focus();
    })
  );
});
