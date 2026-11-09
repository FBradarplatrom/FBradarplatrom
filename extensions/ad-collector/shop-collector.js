// إضافة الجمع – صفحات بحث الأسواق الصينية (إيجاد المورّد): Alibaba · 1688 · Taobao · Pinduoduo.
// تعمل فقط عندما تفتحها المنصة لمهمة بحث. تقرأ المنتجات من بيانات الصفحة (JSON المضمّن) ثم من البطاقات، وتمرّر لتحميل المزيد.
// المطابقة بصورة منتجك والترتيب والتحويل إلى الدينار تتم في المنصة.
(() => {
  'use strict';
  if (window.__wprShop) return;
  window.__wprShop = true;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const send = (msg) => { try { return chrome.runtime.sendMessage(msg).catch(() => null); } catch (_) { return Promise.resolve(null); } };
  const H = location.hostname;
  const M = /alibaba\.com$/.test(H) ? 'alibaba' : /1688\.com$/.test(H) ? '1688' : /(taobao|tmall)\.com$/.test(H) ? 'taobao' : /(yangkeduo|pinduoduo)\.com$/.test(H) ? 'pdd' : '';
  if (!M) return;
  const CUR = M === 'alibaba' ? 'USD' : 'CNY';
  // روابط صفحة المنتج في كل سوق: [نمط المعرّف، بناء الرابط]
  const LINK = {
    alibaba: [/\/product-detail\/[^"'?#\s]*?_(\d{6,})\.html/, (id, h) => h || 'https://www.alibaba.com/product-detail/_' + id + '.html'],
    '1688': [/detail\.1688\.com\/offer\/(\d{6,})\.html/, (id) => 'https://detail.1688.com/offer/' + id + '.html'],
    taobao: [/(?:item\.taobao\.com\/item\.htm|detail\.tmall\.com\/item\.htm)\?[^"'\s]*?\bid=(\d{6,})/, (id) => 'https://item.taobao.com/item.htm?id=' + id],
    pdd: [/goods\d?\.html\?[^"'\s]*?goods_id=(\d{5,})/, (id) => 'https://mobile.yangkeduo.com/goods.html?goods_id=' + id]
  }[M];
  const found = new Map();
  let settings = { maxAds: 60 }, running = false;
  const abs = (u) => { u = String(u || '').trim().replace(/\\u002F/g, '/').replace(/\\\//g, '/'); if (u.startsWith('//')) return 'https:' + u; return /^https?:/.test(u) ? u : ''; };
  const clean = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\"/g, '"').replace(/\s+/g, ' ').trim();
  function add(o) {
    if (!o || !o.id) return;
    const p = found.get(o.id);
    if (p) { for (const k in o) if (!p[k] && o[k]) p[k] = o[k]; return; }
    o.market = M; o.currency = o.currency || CUR; o.url = o.url || LINK[1](o.id); found.set(o.id, o);
  }
  // 1) بيانات الصفحة: معرّف المنتج ثم الحقول حوله (الأسماء تختلف بين الأسواق)
  const ID_KEYS = { alibaba: ['productId', 'id'], '1688': ['offerId', 'id'], taobao: ['nid', 'itemId', 'item_id'], pdd: ['goods_id', 'goodsId'] }[M];
  function fromScripts() {
    for (const sc of document.querySelectorAll('script')) {
      const t = sc.textContent || '';
      if (t.length < 300) continue;
      const re = new RegExp('"(?:' + ID_KEYS.join('|') + ')"\\s*:\\s*"?(\\d{6,})"?', 'g'); let m;
      while ((m = re.exec(t))) {
        const win = t.slice(Math.max(0, m.index - 1500), m.index + 2500);
        const g = (r) => { const x = r.exec(win); return x ? clean(x[1]) : ''; };
        const title = g(/"(?:raw_title|subject|title|goods_name|goodsName|productTitle)"\s*:\s*"((?:[^"\\]|\\.){6,300})"/);
        if (!title) continue;
        add({ id: m[1], src: 'json', title,
          img: abs(g(/"(?:pic_url|picUrl|imageUrl|imgUrl|image|mainImage|thumb_url|hd_thumb_url|offerPicUrl)"\s*:\s*"([^"]+)"/)),
          price: g(/"(?:view_price|price|priceStr|promotionPrice|min_group_price|minPrice|localPrice)"\s*:\s*"?([\d.,~\- $US]+)"?/),
          sold: g(/"(?:view_sales|sales|salesTip|sales_tip|tradeQuantity|bookedCount|sold_quantity)"\s*:\s*"?([^",}]{1,30})"?/),
          moq: g(/"(?:moq|minOrderQuantity|quantityBegin)"\s*:\s*"?([^",}]{1,20})"?/),
          shop: g(/"(?:nick|shopName|companyName|mall_name|supplierName)"\s*:\s*"([^"]{1,60})"/) });
      }
    }
  }
  // 2) البطاقات الظاهرة (احتياط)
  function fromDom() {
    for (const a of document.querySelectorAll('a[href]')) {
      const href = a.href || '', m = LINK[0].exec(href); if (!m) continue;
      const card = a.closest('[class*="card"], [class*="item"], [class*="offer"], [class*="Card"], [class*="Item"], li') || a;
      const img = card.querySelector('img'), txt = (card.innerText || '').replace(/\s+/g, ' ');
      const pr = /((?:US\s?\$|\$|¥|￥)\s?\d[\d.,]*(?:\s?[-~]\s?\d[\d.,]*)?)/.exec(txt) || /(\d+(?:\.\d+)?)\s?元/.exec(txt);
      const sold = /(\d[\d.,万+]*\+?\s*(?:sold|人付款|人收货|成交|件|已拼|笔))/i.exec(txt);
      add({ id: m[1], src: 'dom', url: M === 'alibaba' ? href.split('?')[0] : LINK[1](m[1]), title: (img && img.alt) || (a.title || '').trim() || txt.slice(0, 140),
        img: abs(img && (img.currentSrc || img.src || img.getAttribute('data-src'))), price: pr ? pr[1] : '', sold: sold ? sold[1] : '' });
    }
  }
  async function run() {
    if (running) return; running = true;
    const want = Math.max(10, Math.min(120, +settings.maxAds || 60));
    fromScripts(); fromDom();
    for (let i = 0; i < 14 && found.size < want; i++) { window.scrollBy({ top: Math.round(innerHeight * 0.9), behavior: 'instant' }); await sleep(1100 + Math.random() * 600); fromDom(); send({ cmd: 'progress', href: location.href, seen: found.size }); }
    fromScripts();
    const items = [...found.values()].filter((x) => x.title || x.img).slice(0, want);
    for (let i = 0; i < items.length; i += 40) await send({ cmd: 'ads', raw: items.slice(i, i + 40), href: location.href, ctx: { query: '', country: '' } });
    send({ cmd: 'job_done', href: location.href, reason: items.length ? 'max' : 'idle', seen: items.length });
  }
  send({ cmd: 'queue_check', href: location.href }).then((r) => { if (r && r.start) { settings = Object.assign(settings, r.settings || {}); setTimeout(run, 3000); } });
})();
