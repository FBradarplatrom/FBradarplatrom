// Radar – product eligibility: does this ad sell a tangible product that can be shipped and sold online?
//
// It is a weighing of evidence, not a keyword blacklist. Each ad gets:
//   * non-product evidence per kind (service, course, event, store, company, digital), from the ad text in the
//     market's languages, the page name, the Facebook page category, the CTA button type and the landing domain;
//   * unsuitable-product evidence (food, bulky, fragile). A hit is cancelled when the same sentence shows it is an
//     accessory or tool ("cookie cutter", "sofa cover", "tempered glass screen protector");
//   * product evidence: local-currency price, shop CTA, product page link, local "free shipping / cash on delivery /
//     order now" wording, retail page category.
// The ad is rejected only when the non-product evidence is clear and outweighs the product evidence, so a product
// ad that happens to say "visit our store" is kept while a course or a shop opening is dropped.
(function (root) {
  'use strict';
  const M = root.RadarMarkets || (typeof require === 'function' ? require('./markets.js') : null);

  const SOFT = ['service', 'course', 'event', 'store', 'company', 'digital'];
  const HARD = ['food', 'bulky', 'fragile'];
  const KINDS = SOFT.concat(HARD);
  const LABEL = {
    service: 'خدمة وليس منتجاً', course: 'دورة أو تكوين أو محاضرة', event: 'فعالية أو معرض أو مؤتمر',
    store: 'إعلان محل أو فرع فعلي وليس منتجاً', company: 'إعلان شركة أو توظيف أو جمعية', digital: 'تطبيق أو منتج رقمي أو استثمار',
    food: 'منتج غذائي', bulky: 'كبير الحجم، صعب الشحن', fragile: 'هش، معرّض للكسر في الشحن', insufficient: 'لا دليل كافٍ على منتج محدد'
  };

  /* ---------- normalisation ---------- */
  function norm(s) {
    return String(s == null ? '' : s).normalize('NFC').toLowerCase()
      .replace(/[ً-ٰٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
      .replace(/[’`´]/g, "'").replace(/\s+/g, ' ');
  }
  const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').normalize('NFC');
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ARABIC = /[؀-ۿ]/;
  const AR_PREFIX = '(?:[وفبلك]?(?:ال)?)';

  // الأداء: لا تعابير نمطية ضخمة. النص يُقسَّم إلى كلمات، وكل عبارة من 1 إلى 5 كلمات تُبحث في جدول (Map) بزمن ثابت.
  // الصينية/اليابانية/التايلاندية/الكورية (بلا مسافات) تُبحث كنص داخل النص، وكذلك المدخلات ذات الرموز (% $ €).
  const TOK = /[\p{L}\p{M}\p{N}]+/gu;
  const AR_PRE = /^(?:[وفبلك](?:ال)?|ال|لل)(?=\S{2,})/;
  const SYM = /[^\p{L}\p{M}\p{N}\s'’\-]/u;
  function compileList(list) {
    const L = { map: new Map(), first: new Set(), maxN: 1, sub: [], entries: [] };
    const put = (key, e) => { const old = L.map.get(key); if (!old || old.w < e.w) L.map.set(key, e); };
    for (const raw of list || []) {
      const exact = raw[0] === '=', r0 = exact ? raw.slice(1) : raw;
      const strong = r0[0] === '!', label = (strong ? r0.slice(1) : r0), e = { w: strong ? 2 : 1, label: label.split('/')[0] };
      if (exact) e.exact = new RegExp('(?:' + label.split('/').map((v) => esc(v.trim())).join('|') + ')', 'u');   // حرفياً بالهمزة
      L.entries.push(e);
      for (const v of label.split('/')) {
        const t = norm(v).trim(); if (!t) continue;
        const variants = [t]; const st = strip(t); if (st !== t && st.replace(/[^\p{L}]/gu, '').length >= 5) variants.push(st);
        for (const a of variants) {
          if (M.CJK.test(a) || SYM.test(a)) { L.sub.push({ s: a, e }); continue; }
          const tk = a.match(TOK) || []; if (!tk.length) continue;
          put(tk.join(' '), e); L.first.add(tk[0]); L.maxN = Math.max(L.maxN, tk.length);
        }
      }
    }
    return L;
  }
  const strongOnly = (L) => { const S = { map: new Map(), first: L.first, maxN: L.maxN, sub: L.sub.filter((x) => x.e.w === 2), entries: L.entries.filter((e) => e.w === 2) }; L.map.forEach((e, k) => { if (e.w === 2) S.map.set(k, e); }); return S; };
  function tokensOf(text) { const out = []; TOK.lastIndex = 0; let m; while ((m = TOK.exec(text))) out.push({ w: m[0], s: m.index, t: m.index + m[0].length }); return out; }
  // كل المطابقات: [{e, s, t}] (الأطول أولاً، بلا تداخل)
  function scan(text, L, toks) {
    const out = [];
    if (L.map.size) {
      const T = toks || tokensOf(text);
      for (let i = 0; i < T.length; i++) {
        // الكلمة الأولى (أو بعد نزع سابقة عربية) يجب أن تبدأ عبارة ما، وإلا ننتقل فوراً
        const w = T[i].w, starts = [];
        if (L.first.has(w)) starts.push(w);
        if (T[i].ar === undefined) T[i].ar = ARABIC.test(w);
        if (T[i].ar) { const a = w.replace(AR_PRE, ''), b = a.replace(/^ال/, ''); if (a !== w && L.first.has(a)) starts.push(a); if (b !== a && L.first.has(b)) starts.push(b); }
        if (!starts.length) continue;
        let hit = null;
        for (let n = Math.min(L.maxN, T.length - i); n >= 1 && !hit; n--) {
          const rest = n > 1 ? ' ' + T.slice(i + 1, i + n).map((x) => x.w).join(' ') : '';
          for (const w0 of starts) { const e = L.map.get(w0 + rest); if (e) { hit = { e, s: T[i].s, t: T[i + n - 1].t, n }; break; } }
        }
        if (hit) { out.push(hit); i += hit.n - 1; }
      }
    }
    for (const x of L.sub) { let k = text.indexOf(x.s); if (k >= 0) out.push({ e: x.e, s: k, t: k + x.s.length }); }
    return out;
  }
  const cache = new Map();
  function lexicon(langs) {
    const key = langs.slice().sort().join(',');
    if (cache.has(key)) return cache.get(key);
    const L = {};
    for (const k of KINDS.concat(['cue', 'foodOk', 'bulkyOk', 'fragileOk'])) {
      const merged = [];
      for (const lg of langs) if (M.F[lg] && M.F[lg][k]) merged.push(...M.F[lg][k]);
      L[k] = compileList([...new Set(merged)]);
      L[k + 'S'] = strongOnly(L[k]);
    }
    cache.set(key, L);
    return L;
  }

  /* ---------- which languages to read the ad in ---------- */
  function scriptLangs(text) {
    const out = [];
    if (/[\u4e00-\u9fff]/.test(text)) out.push('zh', 'zhs');
    if (/[\u3040-\u30ff]/.test(text)) out.push('ja');
    if (/[\uac00-\ud7af]/.test(text)) out.push('ko');
    if (/[\u0980-\u09ff]/.test(text)) out.push('bn');
    if (/[฀-๿]/.test(text)) out.push('th');
    if (/[ऀ-ॿ]/.test(text)) out.push('hi');
    if (/[ٹڈڑںےۓ]/.test(text)) out.push('ur');
    if (ARABIC.test(text)) out.push('ar');
    if (/[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/.test(text)) out.push('vi');
    return out;
  }
  function langsFor(country, text) {
    const c = M.countryOf(country);
    const base = c && country !== 'ALL' ? c.langs.slice() : ['ar', 'dz', 'fr', 'arz', 'en'];
    if (c && ['DZ', 'MA', 'TN'].includes(String(country).toUpperCase())) base.push('ar', 'dz', 'fr', 'arz');
    base.push('en');                                                    // international ads are often in English
    for (const l of scriptLangs(text)) base.push(l);
    return [...new Set(base)].filter((l) => M.F[l]);
  }

  /* ---------- structural signals ---------- */
  const CTA = {
    SHOP_NOW: { p: 2 }, ORDER_NOW: { p: 2 }, BUY_NOW: { p: 2 }, BUY: { p: 2 }, ADD_TO_CART: { p: 2 }, GET_OFFER: { p: 1 }, GET_OFFER_VIEW: { p: 1 },
    WHATSAPP_MESSAGE: { p: 0.5 }, SEND_WHATSAPP_MESSAGE: { p: 0.5 }, MESSAGE_PAGE: { p: 0.5 }, SEND_MESSAGE: { p: 0.5 },
    INSTALL_MOBILE_APP: { digital: 4 }, INSTALL_APP: { digital: 4 }, USE_APP: { digital: 4 }, PLAY_GAME: { digital: 4 }, DOWNLOAD: { digital: 3 },
    LISTEN_NOW: { digital: 3 }, LISTEN_MUSIC: { digital: 3 }, OPEN_LINK_APP: { digital: 3 }, USE_MOBILE_APP: { digital: 4 },
    APPLY_NOW: { company: 3 }, BOOK_TRAVEL: { service: 4 }, BOOK_NOW: { service: 2 }, BOOK: { service: 2 }, REQUEST_TIME: { service: 3 },
    GET_QUOTE: { service: 3 }, REQUEST_QUOTE: { service: 3 }, CALL_NOW: { service: 1 }, CALL: { service: 1 }, CONTACT_US: { service: 1 },
    GET_DIRECTIONS: { store: 4 }, SEE_MENU: { food: 4 }, ORDER_FOOD: { food: 4 },
    SIGN_UP: { course: 1, digital: 1 }, SUBSCRIBE: { digital: 2 }, REGISTER: { course: 1.5, event: 1 }, GET_STARTED: { digital: 1 },
    BUY_TICKETS: { event: 4 }, GET_TICKETS: { event: 4 }, INTERESTED: { event: 2 }, DONATE: { company: 4 }, DONATE_NOW: { company: 4 }, VOTE_NOW: { company: 4 }
  };
  const CAT = [
    [/\b(restaurants?|bakery|bakeries|caf[eé]s?|coffee shop|food & beverage|food and beverage|food|beverages?|caterer|catering|dessert shop|pizza place|fast food|grocery|patisserie|tea room|food truck|juice bar)\b/i, 'food', 3],
    [/\b(education|educational|schools?|college|universit(y|ies)|tutors?|tutoring|language school|driving school|coach|academy|training|test preparation)\b/i, 'course', 3],
    [/\b(medical|health spa|dentists?|doctors?|clinics?|hospital|lawyers?|legal|law firm|real estate|insurance|financial|finance|bank|loans?|consult\w*|agency|marketing|advertising|travel|hotels?|tour\w*|car dealership|automotive repair|repair service|contractors?|cleaning service|movers?|moving|plumb\w*|electricians?|salons?|barber|beauty salon|spa|gym|fitness center|photograph\w*|printing service|web design|it company|telecommunication|internet service|logistics|transportation|recruit\w*|employment)\b/i, 'service', 3],
    [/\b(events?|concert|festival|venue|performance|theat(re|er)|exhibition|conference|trade fair)\b/i, 'event', 3],
    [/\b(nonprofit|non-profit|charity|charitable|political|politician|government|religious|church|mosque|community organi[sz]ation|public figure|news|media|magazine|tv channel|radio station|blogger|personal blog)\b/i, 'company', 3],
    [/\b(app page|video games?|software|internet company|crypto\w*|blockchain|gaming video creator|streaming service)\b/i, 'digital', 3],
    [/\b(bars?|pubs?|nightclubs?|lounge|night life|nightlife)\b/i, 'store', 3],
    [/\b(shopping mall|supermarket|grocery store|convenience store|department store|furniture store|appliances store)\b/i, 'store', 2]
  ];
  const CAT_PRODUCT = /(shopping|retail|e-?commerce|product\/service|clothing|apparel|baby goods|kids goods|household supplies|home decor|kitchen\/cooking|health\/beauty|cosmetics|beauty, cosmetic|electronics|toys?\b|pet supplies|jewelry|watches|shoes|bags|accessories|home goods|sporting goods|tools|hardware|household|brand)/i;
  const DOM = [
    [/(^|\.)((apps|itunes)\.apple\.com|play\.google\.com|onelink\.me|app\.adjust\.com|apps\.microsoft\.com|appgallery\.huawei\.com)$/, 'digital', 4],
    [/(eventbrite|meetup\.com|zoom\.us|ticketmaster|allevents|lu\.ma|kktix|accupass|ticketek|eventim|ticketmelon)/, 'event', 4],
    [/(udemy|coursera|teachable|kajabi|thinkific|skillshare|learnworlds|podia|hotmart|kiwify|eduzz|systeme\.io|domestika|masterclass\.com)/, 'course', 4],
    [/(calendly|booking\.com|airbnb|agoda|expedia|trip\.com|traveloka|setmore|fresha|treatwell|zocdoc|practo)/, 'service', 4],
    [/(ubereats|doordash|grubhub|deliveroo|just-eat|grabfood|foodpanda|gofood|zomato|swiggy|talabat|glovoapp|rappi|ifood|yemeksepeti)/, 'food', 4],
    [/(linkedin\.com|indeed\.|jobstreet|glassdoor|naukri|rozee|bayt\.com|wuzzuf)/, 'company', 4],
    [/(binance|bybit|etoro|olymptrade|quotex|pocketoption|iqoption|exness|1xbet|bet365|stake\.com)/, 'digital', 4]
  ];
  const MAPS = /(google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|waze\.com|maps\.apple\.com)/;
  const SHOP_DOM = /(myshopify\.com|shopee\.|lazada\.|tokopedia\.|tiki\.vn|amazon\.|aliexpress\.|temu\.com|youcan\.shop|etsy\.com|ebay\.|mercadoli[bv]re|daraz\.|flipkart|meesho|shein|jumia|ouedkniss|bukalapak|blibli|shopify|salla\.|zid\.store|noon\.com|trendyol|hepsiburada|momo\.com\.tw|pchome|shopline|cdiscount|walmart\.com|target\.com|tiktok\.com\/.*(shop|product))/;
  const SHOP_PATH = /\/(products?|item|items|dp|listing|listings|produit|produk|producto|produto|sanpham|san-pham)\/[^/?#]{3,}/i;
  const PRICE = /(?:[$€£₹₱₫฿¥₩₺]|\b(?:rs|rp|php|usd|eur|gbp|inr|pkr|idr|vnd|myr|rm|nt|thb|dzd|da|dh|mad|sar|aed|egp|tl|baht|sgd|aud|cad|mxn|cop|brl|r\$)\.?)\s?\d|\d[\d.,\s]{0,9}\s?(?:[$€£₹₱₫฿¥₺]|\b(?:rs|rp|php|usd|eur|dzd|da|dh|mad|sar|aed|egp|tl|baht|bath|vnd|vnđ|đ|k|pesos|euros?|dollars?|rupees?|ringgit|lira)\b|元|บาท|دج|د\.ج|دينار|ريال|درهم|جنيه|روپے|रुपये)/i;

  /* ---------- matching ---------- */
  const SENT = /[.!?\n|。！？•]+/;
  function windowAt(text, s, t) {
    let a = s, b = t;
    while (a > 0 && !SENT.test(text[a - 1])) a--;
    while (b < text.length && !SENT.test(text[b])) b++;
    return text.slice(a, b);
  }
  function hits(text, list, okList, toks, raw, ignore, pos) {
    const out = new Map();
    for (const h of scan(text, list, toks)) {
      if (ignore && ignore.has(h.e.label)) continue;                           // كلمة صحّحها المستخدم («سبب خاطئ»)
      if (h.e.exact && raw != null && !h.e.exact.test(raw)) continue;           // تشابه بعد توحيد الهمزات فقط
      if (okList && (okList.map.size || okList.sub.length)) {
        const win = windowAt(text, h.s, h.t);
        if (scan(win, okList).length) continue;                               // accessory / tool for it
      }
      if (pos && !pos.has(h.e.label)) pos.set(h.e.label, h);
      const prev = out.get(h.e.label);
      if (!prev || prev < h.e.w) out.set(h.e.label, h.e.w);
    }
    return out;
  }
  const sum = (m) => { let s = 0; m.forEach((w) => { s += w; }); return s; };

  /* ---------- the check ---------- */
  function catsOf(a) {
    const v = a.page_categories != null ? a.page_categories : a.pageCategories != null ? a.pageCategories : a.categories;
    if (!v) return '';
    if (Array.isArray(v)) return v.map((x) => (x && typeof x === 'object' ? x.name || x.text || '' : x)).join(' | ');
    return String(v);
  }
  function check(a, opts) {
    a = a || {}; opts = opts || {};
    const title = String(a.title || ''), body = String(a.body || ''), desc = String(a.link_description || a.linkDescription || '');
    const pageName = String(a.page_name || a.pageName || '');
    const rawAll = [title, body, desc, a.cta || a.ctaText || ''].join(' \n '), all = norm(rawAll), rawNoMarks = rawAll.replace(/[\u064B-\u065F\u0670\u0640]/g, '');
    const ignore = opts.ignore instanceof Set ? opts.ignore : Array.isArray(opts.ignore) ? new Set(opts.ignore) : null;
    const head = norm(title + ' \n ' + body.slice(0, 220));
    const country = String(opts.country || a.country || '').toUpperCase();
    const langs = opts.langs || langsFor(country, all);
    const L = lexicon(langs);
    const S = {}, terms = {}, textTerms = {}, at = {};
    KINDS.forEach((k) => { S[k] = 0; terms[k] = []; textTerms[k] = []; at[k] = new Map(); });

    // 1. ad text in the market's languages (a term in the headline / first lines counts 1.5×)
    const AT = tokensOf(all), HT = tokensOf(head);
    for (const k of KINDS) {
      const ok = k === 'food' ? L.foodOk : k === 'bulky' ? L.bulkyOk : k === 'fragile' ? L.fragileOk : null;
      const h = hits(all, L[k], ok, AT, rawNoMarks, ignore, at[k]);
      if (!h.size) continue;
      const hh = hits(head, L[k], ok, HT, rawNoMarks, ignore);
      h.forEach((w, t) => { S[k] += w + (hh.has(t) ? w / 2 : 0); terms[k].push(t); textTerms[k].push(t); });
    }
    // 2. the page name ("Sweet Bakery", "Smart Academy", "City Dental Clinic")
    if (pageName) {
      const pn = norm(pageName);
      for (const k of ['service', 'course', 'store', 'company', 'food', 'event']) {
        const h = hits(pn, L[k + 'S'], null);
        if (h.size) { S[k] += 2; terms[k].push('اسم الصفحة: ' + pageName.slice(0, 40)); }
      }
    }
    // 3. Facebook page category
    const cats = catsOf(a);
    let P = 0; const pTerms = [];
    if (cats) {
      for (const [re, k, w] of CAT) if (re.test(cats)) { S[k] += w; terms[k].push('تصنيف الصفحة: ' + cats.slice(0, 50)); }
      if (CAT_PRODUCT.test(cats)) { P += 2; pTerms.push('تصنيف الصفحة: ' + cats.slice(0, 50)); }
    }
    // 4. CTA button type
    const ct = String(a.cta_type || a.ctaType || '').toUpperCase();
    const cg = String(a.cta_group || a.ctaGroup || '');
    const sig = CTA[ct] || (cg === 'shop' ? { p: 2 } : null);
    if (sig) for (const k in sig) { if (k === 'p') { P += sig.p; if (sig.p >= 1) pTerms.push('زر ' + (ct || cg)); } else { S[k] += sig[k]; terms[k].push('زر ' + ct); } }
    // 5. landing page
    const link = String(a.link_url || a.link || ''), dom = String(a.domain || '').toLowerCase() || (() => { try { return new URL(link).hostname.toLowerCase(); } catch (e) { return ''; } })();
    const where = dom + ' ' + link.toLowerCase();
    for (const [re, k, w] of DOM) if (re.test(dom) || re.test(link.toLowerCase())) { S[k] += w; terms[k].push('الرابط: ' + dom); }
    if (MAPS.test(where)) { S.store += 4; terms.store.push('رابط خرائط'); }
    const productLink = SHOP_DOM.test(where) || SHOP_PATH.test(link);
    if (productLink) { P += 2; pTerms.push('رابط صفحة منتج'); }
    // 6. product evidence in the local language
    const cue = hits(all, L.cue, null, AT);
    P += Math.min(6, sum(cue)); cue.forEach((w, t) => pTerms.push(t));
    if (PRICE.test(all)) { P += 2; pTerms.push('سعر'); }

    // decision
    const letters = (all.match(/\p{L}/gu) || []).length;
    let kind = '', best = 0;
    for (const k of HARD) if (S[k] >= 2 && S[k] > best) { best = S[k]; kind = k; }
    if (!kind) {
      for (const k of SOFT) {
        const s = S[k];
        if ((s >= 3 && s > P) || (s >= 6 && s >= P - 1)) { if (s > best) { best = s; kind = k; } }
      }
    }
    if (!kind && letters < 12 && !productLink) kind = 'insufficient';             // a button alone does not say which product
    const reasons = kind ? [LABEL[kind] + (terms[kind] && terms[kind].length ? ' (' + [...new Set(terms[kind])].slice(0, 3).join('، ') + ')' : '')] : [];
    // الجملة التي وُجدت فيها الكلمة، بحروفها الأصلية (ليرى المستخدم «لباس المرأة» لا «مرآة»)
    let ctx = '';
    if (kind && at[kind] && at[kind].size) {
      const h = at[kind].values().next().value, before = (all.slice(0, h.s).match(TOK) || []).length, n = (all.slice(h.s, h.t).match(TOK) || []).length;
      const RT = rawAll.match(TOK) || [];
      if (RT.length) ctx = RT.slice(Math.max(0, before - 3), before).join(' ') + ' «' + RT.slice(before, before + n).join(' ') + '» ' + RT.slice(before + n, before + n + 3).join(' ');
      ctx = ctx.trim();
    }
    return { ok: !kind, kind, label: kind ? LABEL[kind] : '', reasons, terms: kind ? [...new Set(textTerms[kind])] : [], ctx, score: S, product: Math.round(P * 10) / 10, productEvidence: pTerms.slice(0, 5), langs };
  }

  const api = { check, KINDS, LABEL, langsFor, norm, _t: { scan, hits, lexicon } };
  root.RadarProductCheck = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
