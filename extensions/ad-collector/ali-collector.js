// إضافة الجمع – صفحة بحث AliExpress (إيجاد المورّد). تعمل فقط عندما تفتحها المنصة لمهمة بحث.
// تقرأ المنتجات من بيانات الصفحة نفسها (JSON المضمّن) ثم من البطاقات كاحتياط، وتمرّر الصفحة لتحميل المزيد،
// وتسلّم: المعرّف، العنوان، السعر، الصورة، المبيعات، التقييم، الرابط. المطابقة بالصورة والترتيب في المنصة.
(() => {
  'use strict';
  if (window.__wprAli) return;
  window.__wprAli = true;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const send = (msg) => { try { return chrome.runtime.sendMessage(msg).catch(() => null); } catch (_) { return Promise.resolve(null); } };
  const found = new Map();
  let settings = { maxAds: 60 }, running = false;

  const abs = (u) => { if (!u) return ''; u = String(u).trim(); if (u.startsWith('//')) return 'https:' + u; return u; };
  const clean = (s) => String(s || '').replace(/\\u002F/g, '/').replace(/\\"/g, '"').replace(/\\u0026/g, '&').trim();
  function add(o) {
    if (!o || !o.id || found.has(o.id)) { if (o && o.id && found.has(o.id)) { const p = found.get(o.id); for (const k in o) if (!p[k] && o[k]) p[k] = o[k]; } return; }
    o.url = o.url || 'https://www.aliexpress.com/item/' + o.id + '.html';
    found.set(o.id, o);
  }
  // 1) بيانات الصفحة: كل كائن فيه productId نقرأ حوله العنوان والسعر والصورة والمبيعات (مقاوم لتغيّر البنية)
  function fromScripts() {
    for (const sc of document.querySelectorAll('script')) {
      const t = sc.textContent || '';
      if (t.length < 200 || t.indexOf('productId') === -1) continue;
      const re = /"productId"\s*:\s*"?(\d{9,})"?/g; let m;
      while ((m = re.exec(t))) {
        const win = t.slice(Math.max(0, m.index - 600), m.index + 3500);
        const g = (r) => { const x = r.exec(win); return x ? clean(x[1]) : ''; };
        add({
          id: m[1], src: 'json',
          title: g(/"displayTitle"\s*:\s*"((?:[^"\\]|\\.)*)"/) || g(/"title"\s*:\s*"((?:[^"\\]|\\.){8,})"/),
          img: abs(g(/"imgUrl"\s*:\s*"([^"]+)"/) || g(/"image(?:Url)?"\s*:\s*"([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/)),
          price: g(/"formattedPrice"\s*:\s*"([^"]+)"/) || g(/"minPrice"\s*:\s*"?([\d.]+)"?/),
          currency: g(/"currencyCode"\s*:\s*"([A-Z]{3})"/),
          sold: g(/"tradeDesc"\s*:\s*"([^"]+)"/),
          rating: g(/"starRating"\s*:\s*"?([\d.]+)"?/)
        });
      }
    }
  }
  // 2) البطاقات الظاهرة (احتياط)
  function fromDom() {
    for (const a of document.querySelectorAll('a[href*="/item/"]')) {
      const m = /\/item\/(?:[^/]*?)?(\d{9,})\.html/.exec(a.getAttribute('href') || ''); if (!m) continue;
      const card = a.closest('div[class*="card"], div[class*="item"], li') || a;
      const img = card.querySelector('img');
      const txt = (card.innerText || '').replace(/\s+/g, ' ');
      const pr = /((?:US\s?)?[$€£]\s?\d[\d.,]*|\d[\d.,]*\s?(?:€|US\s?\$|DZD|MAD|SAR|AED|ريال|درهم|руб))/.exec(txt);
      const sold = /(\d[\d.,+kK]*\+?\s*(?:sold|vendus?|vendidos?|مبيع|مباع|verkauft))/i.exec(txt);
      const rate = /\b([1-5]\.\d)\b/.exec(txt);
      add({ id: m[1], src: 'dom', url: abs(a.href).split('?')[0], title: (img && img.alt) || (a.title || '').trim() || txt.slice(0, 140), img: abs(img && (img.currentSrc || img.src || img.getAttribute('data-src'))), price: pr ? pr[1] : '', sold: sold ? sold[1] : '', rating: rate ? rate[1] : '' });
    }
  }
  async function run() {
    if (running) return; running = true;
    const want = Math.max(10, Math.min(120, +settings.maxAds || 60));
    fromScripts(); fromDom();
    for (let i = 0; i < 14 && found.size < want; i++) { window.scrollBy({ top: Math.round(innerHeight * 0.9), behavior: 'instant' }); await sleep(900 + Math.random() * 500); fromDom(); send({ cmd: 'progress', href: location.href, seen: found.size }); }
    fromScripts();
    const items = [...found.values()].filter((x) => x.title || x.img).slice(0, want);
    for (let i = 0; i < items.length; i += 40) await send({ cmd: 'ads', raw: items.slice(i, i + 40), href: location.href, ctx: { query: new URLSearchParams(location.search).get('SearchText') || decodeURIComponent((/wholesale-([^/?#]+)\.html/.exec(location.pathname) || [])[1] || '').replace(/-/g, ' '), country: '' } });
    send({ cmd: 'job_done', href: location.href, reason: items.length ? 'max' : 'idle', seen: items.length });
  }
  send({ cmd: 'queue_check', href: location.href }).then((r) => { if (r && r.start) { settings = Object.assign(settings, r.settings || {}); setTimeout(run, 2500); } });
})();
