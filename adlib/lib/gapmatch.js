// Radar – «ثغرات السوق الجزائري»: هل هذا الإعلان الجزائري هو نفس المنتج الأجنبي؟
// ثلاثة أدلة مستقلة:
//  1) بصمة الصورة (dHash 64 بت، على الصورة كاملة وعلى وسطها): تتعرّف على صورة المورّد نفسها حتى لو صُغّرت أو قُصّت أطرافها أو أُضيف شعار صغير.
//  2) رابط المورّد: نفس رقم المنتج على AliExpress / Temu / Amazon / Alibaba / SHEIN / CJ.
//  3) الكلمات المميزة للمنتج (من الذكاء الاصطناعي أو من عباراتك): دليل مساعد فقط، لأن فيسبوك أعاد الإعلان أصلاً لاحتوائه على كلمة البحث.
// strong = تطابق مؤكد · possible = يحتاج تحققك (يظهر بجانب صورة المنتج لتقرر).
(function (root) {
  'use strict';

  /* ---------- رابط المورّد ---------- */
  const SUP = [
    [/aliexpress\.[a-z.]+\/(?:item|i)\/(?:\D[^/]*?)?(\d{9,})/i, 'ali'],
    [/[?&](?:productId|itemId|item_id)=(\d{9,})/i, 'ali'],
    [/temu\.com\/.*?-g-(\d{6,})/i, 'temu'],
    [/[?&]goods_id=(\d{6,})/i, 'temu'],
    [/amazon\.[a-z.]+\/(?:.*\/)?(?:dp|gp\/product)\/([A-Z0-9]{10})/i, 'amz'],
    [/alibaba\.com\/product-detail\/[^?#]*?_(\d{8,})\.html/i, 'alibaba'],
    [/shein\.[a-z.]+\/.*?-p-(\d{5,})/i, 'shein'],
    [/cjdropshipping\.com\/product\/[^?#]*?-p-([0-9a-f-]{8,})/i, 'cj'],
    [/1688\.com\/offer\/(\d{8,})/i, '1688']
  ];
  function supplierIds(links) {
    const out = new Set();
    for (const u of [].concat(links || [])) {
      const s = String(u || ''); if (!s) continue;
      let d = s; try { d = decodeURIComponent(s); } catch (e) {}
      for (const [re, k] of SUP) { const m = re.exec(d); if (m) out.add(k + ':' + m[1].toLowerCase()); }
    }
    return out;
  }

  /* ---------- النص ---------- */
  function norm(s) {
    return String(s == null ? '' : s).normalize('NFKC').toLowerCase()
      .replace(/[ً-ٰٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
      .normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');
  }
  const STOP = new Set(('من في على الى عن مع هذا هذه ذلك التي الذي كل او و يا لا ما هل جدا اكثر افضل جودة عالية سعر السعر التوصيل توصيل مجاني الدفع عند الاستلام اطلب الان متوفر ' +
    'le la les de des du un une et ou pour avec sans en au aux sur dans par votre vos notre nos est prix livraison gratuite commande commander qualite ' +
    'the and for with your you new best free shipping order now').split(/\s+/));
  const toks = s => norm(s).split(/[^\p{L}\p{N}]+/u).filter(w => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w));
  // يقبل السوابق العربية الشائعة: «بالمصباح» تطابق «مصباح»
  const stripAr = w => w.replace(/^(?:وال|بال|كال|فال|لل|ال)(?=..)/, '');
  function keywordHits(text, words) {
    const T = new Set(toks(text).map(stripAr)), hit = [];
    for (const w of words || []) {
      const parts = toks(w).map(stripAr); if (!parts.length) continue;
      if (parts.every(p => T.has(p))) hit.push(w);
    }
    return hit;
  }

  /* ---------- بصمة الصورة (المتصفح) ---------- */
  const HEX = n => n.toString(16).padStart(2, '0');
  function dhashFromCanvas(ctx, sx, sy, sw, sh) {
    const c = ctx.canvas; c.width = 9; c.height = 8;
    ctx.drawImage(ctx.__img, sx, sy, sw, sh, 0, 0, 9, 8);
    const d = ctx.getImageData(0, 0, 9, 8).data, g = [];
    for (let i = 0; i < 72; i++) g.push(d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114);
    let out = '';
    for (let y = 0; y < 8; y++) { let b = 0; for (let x = 0; x < 8; x++) b = (b << 1) | (g[y * 9 + x] > g[y * 9 + x + 1] ? 1 : 0); out += HEX(b); }
    return out;
  }
  // يعيد ثلاث بصمات: الصورة كاملة + 90% + 80% من وسطها، لتحمّل القص والإطارات والشعارات
  function hashImage(src) {
    return new Promise((res) => {
      const img = new Image(); img.decoding = 'async';
      const t = setTimeout(() => res(null), 15000);
      img.onload = () => {
        clearTimeout(t);
        try {
          const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true }); ctx.__img = img;
          const w = img.naturalWidth, h = img.naturalHeight; if (!w || !h) return res(null);
          const full = dhashFromCanvas(ctx, 0, 0, w, h), c90 = dhashFromCanvas(ctx, w * 0.05, h * 0.05, w * 0.9, h * 0.9), mid = dhashFromCanvas(ctx, w * 0.1, h * 0.1, w * 0.8, h * 0.8);
          // صورة شبه موحّدة اللون لا تصلح للمقارنة
          res(/^(0+|f+)$/.test(full) ? null : [full, c90, mid]);
        } catch (e) { res(null); }
      };
      img.onerror = () => { clearTimeout(t); res(null); };
      img.src = src;
    });
  }
  const POP = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];
  function hamming(a, b) { let n = 0; for (let i = 0; i < 16; i++) { let x = parseInt(a[i], 16) ^ parseInt(b[i], 16); n += POP[x]; } return n; }
  function bestImage(adHashes, productHashes) {
    let best = 64;
    for (const a of adHashes || []) for (const p of productHashes || []) if (a && p) best = Math.min(best, hamming(a, p));
    return best;
  }
  const IMG_STRONG = 10, IMG_POSSIBLE = 15;

  /* ---------- الحكم على إعلان واحد ---------- */
  // P = { hashes:[], supplier:Set, keywords:[] } · row = إعلان جزائري · adHashes = بصمات صورته (أو null)
  function judge(P, row, adHashes) {
    const ev = {};
    const sup = supplierIds([row.link_url]);
    for (const s of sup) if (P.supplier && P.supplier.has(s)) { ev.supplier = s; break; }
    if (adHashes && P.hashes && P.hashes.length) {
      const d = bestImage(adHashes, P.hashes);
      if (d <= IMG_POSSIBLE) ev.image = Math.round((1 - d / 64) * 100);
      ev.dist = d;
    }
    const kh = keywordHits([row.title, row.body].join(' \n '), P.keywords);
    if (kh.length) ev.words = kh.slice(0, 6);
    const imgStrong = ev.dist != null && ev.dist <= IMG_STRONG, imgMaybe = ev.image != null;
    const words = (ev.words || []).length;
    let level = '';
    if (ev.supplier || imgStrong || (imgMaybe && words >= 1)) level = 'strong';
    else if (imgMaybe || words >= 2) level = 'possible';
    const why = [];
    if (ev.supplier) why.push('نفس رابط المورّد');
    if (ev.image != null) why.push('تشابه الصورة ' + ev.image + '%');
    if (words) why.push('كلمات المنتج: ' + ev.words.slice(0, 3).join('، '));
    ev.why = why.join(' · ');
    return { level, ev };
  }

  const api = { supplierIds, keywordHits, hashImage, hamming, bestImage, judge, norm, toks, IMG_STRONG, IMG_POSSIBLE };
  root.RadarGapMatch = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
