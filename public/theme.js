/* الوضع الليلي/النهاري + الأزرار العائمة (واتساب، اللغة، الوضع) لكل الصفحات.
   - الوضع: wpr_theme في المتصفح = light | dark | (فارغ = حسب الجهاز). يعمل بتفعيل/تعطيل قواعد ‎@media(prefers-color-scheme:dark)
     الموجودة في الصفحة نفسها، فلا حاجة لتكرار الألوان. يُحمَّل في <head> بعد الأنماط حتى لا تومض الصفحة.
   - الأزرار العائمة: تظهر إن كان للسكربت data-fab. اللغة = wpr_lang (نفس اختيار الصفحة الرئيسية). رقم واتساب من /api/legal/info. */
(function (W, D) {
  'use strict';
  var K = 'wpr_theme', DARK = /\(\s*prefers-color-scheme\s*:\s*dark\s*\)/;
  var get = function () { try { return localStorage.getItem(K) || ''; } catch (e) { return ''; } };
  var sys = function () { return !!(W.matchMedia && W.matchMedia('(prefers-color-scheme: dark)').matches); };
  var isDark = function () { var t = get(); return t ? t === 'dark' : sys(); };
  function walk(rules, t) {
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      if (r.type === 4 && r.media) {
        if (r.__o == null) r.__o = r.media.mediaText;
        if (DARK.test(r.__o)) { var m = t === 'dark' ? r.__o.replace(DARK, '(min-width:0px)') : t === 'light' ? r.__o.replace(DARK, '(max-width:0px)') : r.__o; if (r.media.mediaText !== m) r.media.mediaText = m; }
        if (r.cssRules) walk(r.cssRules, t);
      }
    }
  }
  function apply() {
    var t = get(); D.documentElement.setAttribute('data-theme', t || 'auto');
    for (var i = 0; i < D.styleSheets.length; i++) { var rs = null; try { rs = D.styleSheets[i].cssRules; } catch (e) {} if (rs) walk(rs, t); }
    var mc = D.querySelector('meta[name=theme-color]'); if (mc) mc.content = isDark() ? '#121916' : '#118553';
    var tb = D.querySelector('.wd-th'); if (tb) tb.innerHTML = isDark() ? SUN : MOON;
  }
  function set(t) { try { if (t) localStorage.setItem(K, t); else localStorage.removeItem(K); } catch (e) {} apply(); }
  var MOON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  var SUN = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
  W.WPRTHEME = { get: get, set: set, isDark: isDark, toggle: function () { set(isDark() ? 'light' : 'dark'); }, apply: apply };
  apply();
  // أنماط تُضاف لاحقاً (من سكربتات الأقسام) تأخذ نفس الوضع
  try { new MutationObserver(function (ms) { for (var i = 0; i < ms.length; i++) for (var j = 0; j < ms[i].addedNodes.length; j++) { var n = ms[i].addedNodes[j]; if (n.nodeName === 'STYLE' || n.nodeName === 'LINK') { setTimeout(apply, 0); return; } } }).observe(D.head || D.documentElement, { childList: true }); } catch (e) {}
  if (W.matchMedia) try { W.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply); } catch (e) {}

  /* ---------- الأزرار العائمة ---------- */
  var me = D.currentScript; if (!me || !me.hasAttribute('data-fab')) return;
  var LG = function () { var l = W.__LANG || D.documentElement.lang || 'ar'; l = String(l).slice(0, 2); return l === 'en' || l === 'fr' ? l : 'ar'; };
  var TX = { ar: { th: 'الوضع الليلي / النهاري', lg: 'اللغة', wa: 'تواصل معنا عبر واتساب' }, en: { th: 'Dark / light mode', lg: 'Language', wa: 'Chat with us on WhatsApp' }, fr: { th: 'Mode sombre / clair', lg: 'Langue', wa: 'Contactez-nous sur WhatsApp' } };
  var SHORT = { ar: 'ع', en: 'EN', fr: 'FR' }, NAMES = [['ar', 'العربية'], ['en', 'English'], ['fr', 'Français']];
  var GLOBE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
  var WA = '<svg viewBox="0 0 24 24" width="24" height="24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.4-3c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2s.2-1.1.1-1.2-.2-.2-.4-.3z"/></svg>';
  var css = '.wpr-dock{position:fixed;bottom:16px;inset-inline-end:16px;z-index:30;display:flex;gap:8px;align-items:center;font:14px/1.4 system-ui,sans-serif}' +
    '.wd-b{height:44px;min-width:44px;border-radius:99px;border:1px solid var(--line,#e5e7eb);background:var(--card,#fff);color:var(--ink,#121916);display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 12px;cursor:pointer;box-shadow:0 6px 18px -8px rgba(18,25,22,.35);font:inherit;font-weight:600;text-decoration:none}' +
    '.wd-b:hover{border-color:var(--brand,#118553);color:var(--brand,#118553)}.wd-wa{background:#25d366;border-color:#25d366;padding:0}.wd-wa:hover{background:#1ebe5b;border-color:#1ebe5b}.wd-th,.wd-wa{width:44px;padding:0}' +
    '.wd-l{position:relative}.wd-m{position:absolute;bottom:52px;inset-inline-end:0;background:var(--card,#fff);border:1px solid var(--line,#e5e7eb);border-radius:14px;padding:6px;min-width:150px;box-shadow:0 14px 34px -12px rgba(18,25,22,.4)}' +
    '.wd-m button{display:flex;width:100%;justify-content:space-between;gap:10px;border:0;background:none;color:var(--ink,#121916);padding:9px 12px;border-radius:10px;cursor:pointer;font:inherit}.wd-m button:hover{background:var(--soft,#e0f1e7)}.wd-m button.on{color:var(--brand,#118553);font-weight:700}' +
    '.wpr-dock [hidden]{display:none!important}@media print{.wpr-dock{display:none}}';
  function build() {
    if (D.querySelector('.wpr-dock')) return;
    var st = D.createElement('style'); st.textContent = css; D.head.appendChild(st);
    var l = LG(), t = TX[l], d = D.createElement('div'); d.className = 'wpr-dock'; d.setAttribute('translate', 'no');
    d.innerHTML = '<a id="wa" class="wd-b wd-wa" hidden target="_blank" rel="noopener" aria-label="WhatsApp" title="' + t.wa + '">' + WA + '</a>' +
      (me.hasAttribute('data-nolang') ? '' : '<div class="wd-l"><button type="button" class="wd-b wd-lang" aria-haspopup="menu" aria-expanded="false" title="' + t.lg + '">' + GLOBE + '<span>' + SHORT[l] + '</span></button>' +
      '<div class="wd-m" role="menu" hidden>' + NAMES.map(function (n) { return '<button type="button" role="menuitemradio" data-lang="' + n[0] + '" class="' + (n[0] === l ? 'on' : '') + '" lang="' + n[0] + '">' + n[1] + (n[0] === l ? ' <span>✓</span>' : '') + '</button>'; }).join('') + '</div></div>') +
      '<button type="button" class="wd-b wd-th" aria-label="' + t.th + '" title="' + t.th + '">' + (isDark() ? SUN : MOON) + '</button>';
    D.body.appendChild(d);
    var menu = d.querySelector('.wd-m') || D.createElement('div'), lb = d.querySelector('.wd-lang') || D.createElement('button');
    d.addEventListener('click', function (ev) {
      if (ev.target.closest('.wd-th')) return W.WPRTHEME.toggle();
      if (ev.target.closest('.wd-lang')) { menu.hidden = !menu.hidden; lb.setAttribute('aria-expanded', String(!menu.hidden)); return; }
      var b = ev.target.closest('[data-lang]'); if (!b) return;
      try { localStorage.setItem('wpr_lang', b.dataset.lang); } catch (e) {}
      var u = new URL(location.href); if (u.searchParams.has('lang') || !W.__V) u.searchParams.set('lang', b.dataset.lang);
      location.href = u.toString();
    });
    D.addEventListener('click', function (ev) { if (!ev.target.closest('.wd-l')) menu.hidden = true; });
    D.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') menu.hidden = true; });
    fetch('/api/legal/info').then(function (r) { return r.json(); }).then(function (j) { var w = String(j.whatsapp || '').replace(/[^\d]/g, ''), a = D.getElementById('wa'); if (w && a) { a.href = 'https://wa.me/' + w; a.hidden = false; } }).catch(function () {});
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', build); else build();
})(window, document);
