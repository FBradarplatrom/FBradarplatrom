/* ترجمة لوحة التحكم (الإنجليزية والفرنسية).
   الواجهة مكتوبة بالعربية؛ هذا الملف يترجم كل نص عربي يظهر في الصفحة (ومنها ما يُرسم لاحقاً) من القاموس public/i18n-dict.js:
   1) تطابق تام للنص، 2) قوالب فيها {} لقيم متغيرة (أرقام، أسماء…)، 3) تقسيم النص عند « · » و«: » وترجمة الأجزاء.
   نص المستخدم (الإعلانات، أسماء المنتجات، الملاحظات) لا يُترجم: ضع translate="no" على حاويته.
   لإضافة نص جديد: أضفه إلى القاموس (ar, en, fr) — أداة tools-i18n/missing.js تسرد ما ينقص. */
(function (W, D) {
  'use strict';
  var L = W.__LANG; if (!L || L === 'ar' || !W.I18N_DICT) { D.documentElement.classList.remove('i18n-wait'); return; }
  var col = L === 'fr' ? 2 : 1, EX = new Map(), PB = new Map(), memo = new Map();
  var AR = /[؀-ۿ]/, ARW = /[؀-ۿ][؀-ۿً-ٟـ]*/;
  var norm = function (s) { return s.replace(/\s+/g, ' ').trim(); };
  var fw = function (s) { var m = ARW.exec(s); return m ? m[0] : ''; };
  var esc = function (s) { return s.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&'); };
  W.I18N_DICT.forEach(function (r) {
    var k = norm(r[0]), t = r[col]; if (!t) return;
    if (k.indexOf('{}') < 0) { EX.set(k, t); return; }
    var re = new RegExp('^' + k.split('{}').map(esc).join('(.*?)') + '$'), b = fw(k);
    if (!PB.has(b)) PB.set(b, []); PB.get(b).push([re, t]);
  });
  function look(k) {
    var r = EX.get(k); if (r != null) return r;
    var b = PB.get(fw(k)); if (!b) return null;
    for (var i = 0; i < b.length; i++) {
      var m = b[i][0].exec(k); if (!m) continue;
      var v = m.slice(1), j = 0;
      return b[i][1].replace(/\{(\d?)\}/g, function (_, d) { var x = d ? v[+d] : v[j++]; if (x == null) return ''; var y = AR.test(x) ? tr(x) : null; return y == null ? x : y; });
    }
    return null;
  }
  var SEP = /(\s·\s|\s—\s|\s\|\s|:\s|،\s|\s\/\s|\s←\s|\s→\s)/;
  function tr(s) {
    if (!AR.test(s)) return null;
    var k = norm(s); if (memo.has(k)) return memo.get(k);
    memo.set(k, null);                                           // يمنع الحلقات
    var r = look(k);
    if (r == null) {                                             // رموز أو أرقام حول النص: «💎 جوهرة» ، «(3)»
      var m = /^([^؀-ۿ]*?)([؀-ۿ][\s\S]*[؀-ۿ«»؟!.)]|[؀-ۿ])([^؀-ۿ]*)$/.exec(k);
      if (m && (m[1] || m[3])) { var c = look(norm(m[2])); if (c == null && /[.؟!:،]$/.test(m[2])) { c = look(m[2].slice(0, -1)); if (c != null) c += m[2].slice(-1).replace('؟', '?').replace('،', ','); } if (c != null) r = m[1] + c + m[3]; if (r == null && m[1]) { c = look(k.slice(m[1].length)); if (c != null) r = m[1] + c; } }
    }
    if (r == null && SEP.test(k)) {                              // «تجريبي · باقي 7 يوم» ← ترجمة كل جزء
      var parts = k.split(SEP), hit = false;
      parts = parts.map(function (p, i) { if (i % 2) return p.replace('،', ','); if (!AR.test(p)) return p; var y = tr(p); if (y != null) { hit = true; return y; } return p; });
      if (hit) r = parts.join('');
    }
    memo.set(k, r); return r;
  }
  W.__t = function (s) { var r = tr(String(s)); return r == null ? s : r; };
  var SK = '[translate="no"],.notranslate,[dir=auto],.pc-ti,.pc-sub,.l-chips,script,style,code,pre';
  var ATTR = ['placeholder', 'title', 'aria-label', 'label', 'alt'];
  function doText(n) {
    var v = n.nodeValue; if (!v || !AR.test(v)) return;
    var p = n.parentNode; if (!p || p.nodeName === 'TEXTAREA' || (p.closest && p.closest(SK))) return;
    var t = tr(v); if (t == null) return;
    n.nodeValue = (/^\s*/.exec(v)[0]) + t + (/\s*$/.exec(v)[0]);
  }
  function doEl(el) {
    for (var i = 0; i < ATTR.length; i++) { var a = ATTR[i], v = el.getAttribute(a); if (v && AR.test(v)) { var t = tr(v); if (t != null) el.setAttribute(a, t); } }
  }
  function walk(root) {
    if (root.nodeType === 3) return doText(root);
    if (root.nodeType !== 1) return; if (root.closest && root.closest(SK)) { if (/^(INPUT|TEXTAREA)$/.test(root.nodeName)) doEl(root); return; }
    doEl(root);
    var it = D.createTreeWalker(root, 5, { acceptNode: function (n) { if (n.nodeType === 1 && n.matches(SK)) { if (/^(INPUT|TEXTAREA)$/.test(n.nodeName)) doEl(n); return 2; } return 1; } }), n;
    while ((n = it.nextNode())) { if (n.nodeType === 3) doText(n); else doEl(n); }
  }
  new MutationObserver(function (ms) {
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i];
      if (m.type === 'characterData') doText(m.target);
      else if (m.type === 'attributes') doEl(m.target);
      else for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
    }
  }).observe(D.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTR });
  ['alert', 'confirm', 'prompt'].forEach(function (f) {
    var o = W[f]; W[f] = function (msg) { var a = [].slice.call(arguments); if (typeof msg === 'string') a[0] = msg.split('\n').map(function (l) { var t = tr(l); return t == null ? l : t; }).join('\n'); return o.apply(W, a); };
  });
  var done = function () { var app = D.getElementById('wpr-app'); if (app) { app.dir = 'ltr'; app.lang = L; } walk(D.documentElement); D.documentElement.classList.remove('i18n-wait'); };
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', done); else done();
  setTimeout(function () { D.documentElement.classList.remove('i18n-wait'); }, 2500);
})(window, document);
