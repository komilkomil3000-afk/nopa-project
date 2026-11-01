// Single session store for the admin panel. Loaded before app.js.
// One key for the token and one for the user; older builds also wrote 'token', 'adminToken'
// and 'user', which are migrated once and then removed so logout really clears the session.
(function () {
  var TOKEN_KEY = 'nopa_admin_token';
  var USER_KEY = 'nopa_admin_user';
  var LEGACY_TOKEN_KEYS = ['token', 'adminToken'];
  var LEGACY_USER_KEYS = ['user'];

  function read(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, value); } catch (_) { /* storage blocked */ }
  }
  function remove(key) {
    try { localStorage.removeItem(key); } catch (_) { /* storage blocked */ }
  }

  // One-time migration from the legacy keys
  if (!read(TOKEN_KEY)) {
    for (var i = 0; i < LEGACY_TOKEN_KEYS.length; i++) {
      var legacy = read(LEGACY_TOKEN_KEYS[i]);
      if (legacy && legacy !== 'dev-bypass') { write(TOKEN_KEY, legacy); break; }
    }
  }
  if (!read(USER_KEY) && read('user')) write(USER_KEY, read('user'));
  LEGACY_TOKEN_KEYS.concat(LEGACY_USER_KEYS).forEach(remove);

  window.NopaAuth = {
    getToken: function () {
      var t = read(TOKEN_KEY) || '';
      return t === 'dev-bypass' ? '' : t;
    },
    getUser: function () {
      try { return JSON.parse(read(USER_KEY) || '{}') || {}; } catch (_) { return {}; }
    },
    setSession: function (token, user) {
      write(TOKEN_KEY, token);
      write(USER_KEY, JSON.stringify(user || {}));
    },
    clear: function () {
      remove(TOKEN_KEY);
      remove(USER_KEY);
      LEGACY_TOKEN_KEYS.concat(LEGACY_USER_KEYS).forEach(remove);
    }
  };

  // Many older handlers read a global `token`; make it always reflect the current session
  // instead of the value captured when the page loaded.
  Object.defineProperty(window, 'token', {
    get: function () { return window.NopaAuth.getToken(); },
    configurable: true
  });
})();
