// The one way the admin panel talks to the API. Loaded before app.js.
//   request(url, options)      -> Response   (adds the bearer token, handles 401/403)
//   NopaApi.json(url, options) -> parsed body (throws an Error with the server message on !ok)
// A string body without a Content-Type is sent as JSON (express.json() ignores bodies otherwise).
(function () {
  async function request(url, options) {
    options = options || {};
    const currentToken = NopaAuth.getToken();
    const headers = Object.assign({}, options.headers);
    if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;
    const hasType = Object.keys(headers).some(h => h.toLowerCase() === 'content-type');
    if (typeof options.body === 'string' && !hasType) headers['Content-Type'] = 'application/json';
    const res = await fetch(url, Object.assign({}, options, { headers }));

    if (res.status === 403) {
      // 403 from the permission layer (e.g. a sub admin without this section) is not an expired
      // session: show the server's reason and keep the user signed in. Only a bad/expired token logs out.
      let reason = '';
      try { reason = (await res.clone().json()).error || ''; } catch (_) { /* not JSON */ }
      if (reason && !/توکن|نشست|مسدود|IP/.test(reason)) {
        showToast(reason, 'error');
        return res;
      }
    }
    if (res.status === 401 || res.status === 403) {
      // Session expired or unauthorized: non-blocking toast, only if a token was actually sent
      if (currentToken) showToast('نشست کاربری شما منقضی شده یا دسترسی ندارید', 'error');
      NopaAuth.clear();
      if (typeof window.showLogin === 'function') window.showLogin();
      throw new Error('Unauthorized');
    }
    return res;
  }

  async function json(url, options) {
    const res = await request(url, options);
    let body = null;
    try { body = await res.json(); } catch (_) { /* empty or not JSON */ }
    if (!res.ok) {
      const err = new Error((body && (body.error || body.message)) || `HTTP ${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  }

  window.request = request;
  window.NopaApi = { request, json };
})();
