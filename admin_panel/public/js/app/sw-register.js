// PWA: register the service worker (was an inline <script>; moved out so the CSP needs no 'unsafe-inline')
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' })
      .catch(function (err) { console.error('SW registration failed:', err); });
  });
}
