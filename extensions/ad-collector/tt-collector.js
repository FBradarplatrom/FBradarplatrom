// إضافة الجمع – صفحة بحث TikTok (سكربت المحتوى). عند أمر المنصة: يبقى على تبويب «الأفضل/Top» (الافتراضي)،
// يمرّر النتائج، ويجمع الفيديوهات من ردود الشبكة (tt-inject.js) ثم من البطاقات كاحتياط، ويسلّمها للمنصة.
(() => {
  'use strict';
  if (window.__wprTTc) return;
  window.__wprTTc = true;
  const TAG = 'WPR_TT_MAIN';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const send = (msg) => { try { return chrome.runtime.sendMessage(msg).catch(() => null); } catch (_) { return Promise.resolve(null); } };
  const items = new Map(); let pending = [], running = false, lastNew = Date.now(), settings = { maxAds: 150, waitSeconds: 20 };
  const q = () => new URLSearchParams(location.search).get('q') || '';
  function add(o, src) {
    if (!o || !o.id) return;
    const p = items.get(o.id);
    if (p) { if (src === 'net' && p._src === 'dom') { items.set(o.id, Object.assign(o, { _src: 'net' })); pending.push(o); } return; }
    o._src = src; items.set(o.id, o); pending.push(o); lastNew = Date.now();
  }
  window.addEventListener('message', (e) => { if (e.source === window && e.data && e.data.tag === TAG) (e.data.items || []).forEach((o) => add(o, 'net')); });
  const parseCount = (t) => { const m = /([\d.,]+)\s*([KkMmBb]?)/.exec(t || ''); if (!m) return 0; const n = parseFloat(m[1].replace(',', '.')); return Math.round(n * ({ k: 1e3, m: 1e6, b: 1e9 }[m[2].toLowerCase()] || 1)); };
  function fromDom() {
    for (const a of document.querySelectorAll('a[href*="/video/"]')) {
      const m = /\/@([^/]+)\/video\/(\d+)/.exec(a.getAttribute('href') || ''); if (!m) continue;
      const card = a.closest('[data-e2e="search_top-item"], [data-e2e="search-card-item"], div[class*="DivItemContainer"]') || a.parentElement || a;
      const img = card.querySelector('img'), views = card.querySelector('[data-e2e="video-views"], strong');
      const desc = (card.querySelector('[data-e2e="search-card-video-caption"], [data-e2e="search-card-desc"]') || {}).innerText || (img && img.alt) || '';
      add({ id: m[2], author: m[1], desc: desc.slice(0, 1500), plays: parseCount(views && views.innerText), likes: 0, cover: img ? img.currentSrc || img.src : '', url: 'https://www.tiktok.com/@' + m[1] + '/video/' + m[2] }, 'dom');
    }
  }
  // نافذة «سجّل الدخول» التي تظهر بعد تمرير قليل: نغلقها ونكمل. إن عادت مراراً نتوقف ونطلب تسجيل الدخول
  let walls = 0;
  function loginWall() {
    const m = document.querySelector('[data-e2e="login-modal"], #login-modal, [id^="login-modal"], div[class*="LoginModal"], div[class*="DivLoginContainer"]')
      || [...document.querySelectorAll('div[role="dialog"]')].find((d) => /log in|sign up|تسجيل الدخول|se connecter|iniciar sesión|masuk/i.test(d.innerText || ''));
    if (!m) return false;
    const close = m.querySelector('[data-e2e="modal-close-inner-button"], [data-e2e="modal-close-button"], [aria-label="Close"], [aria-label="إغلاق"], div[class*="CloseWrapper"], button[class*="Close"]')
      || document.querySelector('[data-e2e="modal-close-inner-button"], [data-e2e="modal-close-button"]');
    if (close) { close.click(); walls++; return true; }
    try { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); } catch (_) { /* ignore */ }
    walls++; return true;
  }
  function loadMore() {
    for (const b of document.querySelectorAll('button, div[role="button"]')) { const t = (b.innerText || '').trim(); if (t.length < 25 && /^(load more|see more|more|تحميل المزيد|عرض المزيد|voir plus|ver más|muat lebih banyak|xem thêm)$/i.test(t)) { b.click(); return true; } }
    return false;
  }
  function flush() { while (pending.length) { const chunk = pending.splice(0, 40); send({ cmd: 'ads', raw: chunk, href: location.href, ctx: { query: q(), country: '' } }); } }
  async function run() {
    if (running) return; running = true;
    const want = Math.max(10, Math.min(1000, +settings.maxAds || 150)), wait = Math.max(10, +settings.waitSeconds || 20);
    let nudges = 0, lastSeen = lastNew;
    while (items.size < want) {
      if (loginWall()) { await sleep(900); if (walls > 6 && document.querySelector('[data-e2e="login-modal"], #login-modal, div[class*="LoginModal"]')) { flush(); send({ cmd: 'job_done', href: location.href, reason: 'login', seen: items.size }); return; } }
      // تمرير حتى آخر الصفحة (يحمّل TikTok الدفعة التالية عند الوصول للأسفل) ثم زر «المزيد» إن وُجد
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
      await sleep(1500 + Math.random() * 900);
      loadMore();
      fromDom(); flush(); send({ cmd: 'progress', href: location.href, seen: items.size });
      if (lastNew > lastSeen) { lastSeen = lastNew; nudges = 0; }
      const idle = (Date.now() - lastNew) / 1000;
      if (idle > 5) { nudges++; window.scrollBy({ top: -(900 + nudges * 300), behavior: 'instant' }); await sleep(800 + nudges * 200); loadMore(); window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }); }
      if (idle >= wait && nudges >= 6) break;
    }
    flush();
    send({ cmd: 'job_done', href: location.href, reason: items.size >= want ? 'max' : 'idle', seen: items.size });
  }
  send({ cmd: 'queue_check', href: location.href }).then((r) => { if (r && r.start) { settings = Object.assign(settings, r.settings || {}); setTimeout(run, 3000); } });
})();
