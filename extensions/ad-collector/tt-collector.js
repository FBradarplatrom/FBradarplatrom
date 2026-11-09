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
  // التمرير التدريجي: TikTok يحمّل الدفعة التالية عندما تقترب آخر البطاقات من الشاشة، والقفز المباشر للأسفل لا يُطلقه دائماً.
  // ننزل شاشة بشاشة («عادي» أو «بطيء») ونحرّك العجلة ونمرّر الحاوية الداخلية إن كانت هي التي تتمرر.
  function scroller() {
    const de = document.scrollingElement || document.documentElement;
    if (de.scrollHeight > window.innerHeight * 1.3) return null;            // الصفحة نفسها تتمرر
    let best = null;
    for (const el of document.querySelectorAll('main, div')) {
      if (el.scrollHeight <= el.clientHeight + 200 || el.clientHeight < 300) continue;
      const oy = getComputedStyle(el).overflowY; if (oy !== 'auto' && oy !== 'scroll') continue;
      if (!best || el.scrollHeight > best.scrollHeight) best = el;
    }
    return best;
  }
  function step(dy) {
    const el = scroller();
    try { (el || document.body).dispatchEvent(new WheelEvent('wheel', { deltaY: dy, bubbles: true, cancelable: true })); } catch (_) { /* ignore */ }
    if (el) el.scrollBy({ top: dy, behavior: 'smooth' }); else window.scrollBy({ top: dy, behavior: 'smooth' });
  }
  function atEnd() { const el = scroller(); return el ? el.scrollTop + el.clientHeight >= el.scrollHeight - 50 : window.innerHeight + window.scrollY >= (document.scrollingElement || document.documentElement).scrollHeight - 50; }
  async function run() {
    if (running) return; running = true;
    const want = Math.max(10, Math.min(2000, +settings.maxAds || 150)), wait = Math.max(15, +settings.waitSeconds || 25);
    const slow = settings.speed === 'slow', pause = () => (slow ? 2600 : 1500) + Math.random() * (slow ? 1800 : 1100);
    let idleRounds = 0, lastCount = 0;
    fromDom(); flush();
    while (items.size < want) {
      if (loginWall()) { await sleep(900); if (walls > 6 && document.querySelector('[data-e2e="login-modal"], #login-modal, div[class*="LoginModal"]')) { flush(); send({ cmd: 'job_done', href: location.href, reason: 'login', seen: items.size }); running = false; return; } }
      step(Math.round(window.innerHeight * (slow ? 0.6 : 0.85)));
      await sleep(pause());
      if (atEnd()) { await sleep(slow ? 2500 : 1600); loadMore(); }
      fromDom(); flush(); send({ cmd: 'progress', href: location.href, seen: items.size });
      if (items.size > lastCount) { lastCount = items.size; idleRounds = 0; continue; }
      // لا جديد: انتظر التحميل، ثم اصعد قليلاً وانزل لإيقاظ التحميل اللانهائي
      idleRounds++;
      if (atEnd() || idleRounds % 3 === 0) { step(-Math.round(window.innerHeight * 1.2)); await sleep(900); step(Math.round(window.innerHeight * 2)); await sleep(pause()); loadMore(); }
      if ((Date.now() - lastNew) / 1000 >= wait && idleRounds >= 8) break;
    }
    flush();
    send({ cmd: 'job_done', href: location.href, reason: items.size >= want ? 'max' : 'idle', seen: items.size });
    running = false;
  }
  send({ cmd: 'queue_check', href: location.href }).then((r) => { if (r && r.start) { settings = Object.assign(settings, r.settings || {}); setTimeout(run, 3000); } });
})();
