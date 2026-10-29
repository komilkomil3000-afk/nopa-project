// Output-encoding helpers for the admin panel. Loaded before app.js / lms.js.
// Use esc() for every piece of user-controlled data that is placed into an HTML string
// (innerHTML templates, attribute values). Prefer textContent when no markup is needed.
(function () {
  var MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
  window.esc = function (value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"'`]/g, function (ch) { return MAP[ch]; });
  };
  // For values placed inside a JS string literal that itself lives in an inline HTML
  // attribute, e.g. onclick="fn('${escJs(name)}')". HTML-entity escaping is not enough there
  // because the browser decodes entities before the JS runs, so every dangerous character is
  // written as a \xNN / \uNNNN escape instead.
  var JS_UNSAFE = new RegExp('[\\\\\'"`<>&\\r\\n' + String.fromCharCode(0x2028) + String.fromCharCode(0x2029) + ']', 'g');
  window.escJs = function (value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(JS_UNSAFE, function (ch) {
      var code = ch.charCodeAt(0);
      return code < 256
        ? '\\x' + ('0' + code.toString(16)).slice(-2)
        : '\\u' + ('0000' + code.toString(16)).slice(-4);
    });
  };
})();
