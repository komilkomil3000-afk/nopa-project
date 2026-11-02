// Shows every number in the panel with Persian digits (۰-۹).
// Only visible text nodes are changed: links (href/src), input values, scripts, styles and
// anything inside an element marked with class "keep-latin" stay as they are.
(function () {
  'use strict';

  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, CODE: 1, PRE: 1, NOSCRIPT: 1, CANVAS: 1, SVG: 1 };
  var DIGITS = /[0-9]/;
  var MIME_LIKE = /^\s*[a-z]+\/[a-z0-9.+-]+\s*$/i;

  function toFa(s) {
    return s.replace(/[0-9]/g, function (d) { return String.fromCharCode(0x06F0 + (d.charCodeAt(0) - 48)); });
  }

  function skipNode(node) {
    var p = node.parentElement;
    while (p) {
      if (SKIP_TAGS[p.tagName.toUpperCase()] || p.classList.contains('keep-latin') || p.isContentEditable) return true;
      p = p.parentElement;
    }
    return false;
  }

  function convertNode(node) {
    var v = node.nodeValue;
    if (!v || !DIGITS.test(v)) return;
    if (v.indexOf('://') !== -1 || MIME_LIKE.test(v)) return;
    if (skipNode(node)) return;
    node.nodeValue = toFa(v);
  }

  function walk(root) {
    if (root.nodeType === 3) { convertNode(root); return; }
    if (root.nodeType !== 1) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var n;
    var batch = [];
    while ((n = w.nextNode())) batch.push(n);
    batch.forEach(convertNode);
  }

  function start() {
    walk(document.body);
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        if (m.type === 'characterData') convertNode(m.target);
        else m.addedNodes.forEach(walk);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
