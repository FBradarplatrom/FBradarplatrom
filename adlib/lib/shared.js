// [radar-platform] Patched copy: normalizeAd no longer computes the extension's preliminary score.
// Ad Radar – shared logic (used by the content script AND the side panel).
(function (root) {
  'use strict';

  const Gd = root.AdRadarGold || (typeof require === 'function' ? require('./golden.js') : null);
  const Rl = root.AdRadarRules || (typeof require === 'function' ? require('./rules.js') : null);
  const Nc = root.AdRadarNiches || (typeof require === 'function' ? require('./niches.js') : null);

  const STORE_PREFIX = 'ad:';

  const DEFAULT_SETTINGS = {
    mode: 'filtered',        // 'filtered' | 'all'  (what counts toward Max ads)
    maxAds: 200,
    autoStop: true,
    waitSeconds: 30,
    speed: 'normal',         // slow | normal | fast
    bigBrands: '',           // confirmed big brands (comma/newline separated). Empty = built-in list
    filters: {
      ctaGroups: [],         // empty = any
      customCta: '',
      languages: [],         // empty = any
      keepUndetected: true,
      include: '',
      includeMode: 'any',    // any | all
      exclude: '',           // negative keywords
      minDupes: 0,
      minDays: 0,
      activeOnly: false,
      formats: [],
      platforms: [],
      requireLink: false,
      domainInclude: '',
      domainExclude: '',
      // criteria v2
      goldMode: 'off',       // off | any | strong | present   (golden-word evidence)
      stages: [],            // new | trial | scored | nodate  (empty = any)
      excludeBig: false,     // drop confirmed big brands
      excludeCod: false,     // drop large / fragile products (not fit for cash on delivery)
      niches: []             // niche names (empty = any)
    }
  };

  /* ---------- text helpers ---------- */

  // Lowercase, strip Latin accents, Arabic diacritics/tatweel, unify alef/ya.
  function norm(s) {
    return String(s == null ? '' : s)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .toLowerCase();
  }

  function parseKeywords(s) {
    return String(s || '')
      .split(/[,\n،;]+/)
      .map((x) => norm(x).trim())
      .filter(Boolean);
  }

  /* ---------- CTA groups ---------- */

  const CTA_GROUP_IDS = ['shop', 'learn', 'signup', 'offer', 'download', 'contact', 'message', 'none'];
  const CTA_GROUPS = {
    shop: {
      types: ['SHOP_NOW', 'ORDER_NOW', 'BUY_NOW', 'BUY', 'BUY_TICKETS', 'ADD_TO_CART'],
      re: /shop now|order now|buy now|acheter|commander|commandez|اطلب|اشتر|تسوق/i
    },
    learn: {
      types: ['LEARN_MORE', 'SEE_MORE', 'WATCH_MORE', 'LEARN_MORE_ABOUT'],
      re: /learn more|en savoir plus|see more|watch more|المزيد|اعرف|شاهد/i
    },
    signup: {
      types: ['SIGN_UP', 'SUBSCRIBE', 'GET_STARTED'],
      re: /sign up|subscribe|inscrire|abonner|سجل|اشترك|التسجيل/i
    },
    offer: {
      types: ['GET_OFFER', 'GET_OFFER_VIEW', 'GET_QUOTE', 'REQUEST_QUOTE'],
      re: /get offer|get quote|obtenir|devis|احصل على/i
    },
    download: {
      types: ['DOWNLOAD', 'INSTALL_MOBILE_APP', 'INSTALL_APP', 'USE_APP', 'PLAY_GAME', 'OPEN_LINK_APP'],
      re: /download|install|télécharger|telecharger|installer|تنزيل|تحميل|ثبت/i
    },
    contact: {
      types: ['CONTACT_US', 'APPLY_NOW', 'BOOK_TRAVEL', 'BOOK_NOW', 'BOOK', 'REQUEST_TIME'],
      re: /contact|apply now|book now|postuler|réserver|reserver|اتصل بنا|تواصل|قدم|احجز/i
    },
    message: {
      types: ['WHATSAPP_MESSAGE', 'SEND_WHATSAPP_MESSAGE', 'SEND_MESSAGE', 'MESSAGE_PAGE', 'CALL_NOW', 'CALL'],
      re: /whatsapp|message|call now|appeler|راسل|رسالة|اتصل/i
    },
    none: { types: ['NO_BUTTON'], re: null }
  };

  function ctaGroup(type, text) {
    const t = String(type || '').toUpperCase();
    const x = String(text || '').trim();
    if (!t && !x) return 'none';
    for (const id of CTA_GROUP_IDS) {
      if (CTA_GROUPS[id].types.includes(t)) return id;
    }
    if (x) {
      for (const id of CTA_GROUP_IDS) {
        const g = CTA_GROUPS[id];
        if (g.re && g.re.test(x)) return id;
      }
    }
    return 'other';
  }

  /* ---------- language detection ---------- */

  const STOP = {
    fr: 'le les des du et est pour avec votre vous une sur pas qui dans aux cette nous sont ce livraison prix commandez gratuite offre produit',
    en: 'the and is for with your you this that are our free shipping now get it of to on',
    es: 'el los las con una su es del envio gratis esta y',
    pt: 'os com uma seu sua em da voce nao frete um'
  };
  // Arabizi = Darija written with Latin letters and digits (3 = ع, 7 = ح, 9 = ق, 5 = خ ...)
  const ARZ_STOP = new Set('rak rani ya wach wesh bzaf bezaf kayen kayna nta nti hna dyal diyal 3la 3and 7na hada hadi hadak ghadi ghir ola wla kifach chhal lazem'.split(' '));
  const STOPSET = {};
  Object.keys(STOP).forEach((k) => { STOPSET[k] = new Set(STOP[k].split(' ')); });

  function detectLang(text) {
    const t = String(text || '');
    const letters = (t.match(/\p{L}/gu) || []).length;
    if (letters < 6) return 'und';
    const ar = (t.match(/[\u0600-\u06FF\u0750-\u077F]/g) || []).length;
    if (ar / letters >= 0.35) return 'ar';
    const latin = (t.match(/[A-Za-z\u00C0-\u024F]/g) || []).length;
    if (latin / letters < 0.5) return 'other';
    const words = norm(t).match(/[a-z0-9]+/g) || [];
    const score = { fr: 0, en: 0, es: 0, pt: 0 };
    let arz = 0;
    for (const w of words) {
      if (/^[a-z]+$/.test(w)) { for (const k in STOPSET) if (STOPSET[k].has(w)) score[k]++; }
      if (ARZ_STOP.has(w)) arz++;
      else if (w.length >= 3 && /[a-z][2356789]|[2356789][a-z]/.test(w)) arz++;   // 3andek, y7el, 9ettek ...
    }
    const sorted = Object.entries(score).sort((a, b) => b[1] - a[1]);
    if (arz >= 2 && arz > sorted[0][1]) return 'arz';
    if (sorted[0][1] >= 2 && sorted[0][1] > sorted[1][1]) return sorted[0][0];
    return 'und';
  }

  /* ---------- dates ---------- */

  const MONTHS = {
    jan: 1, janv: 1, ene: 1, fev: 2, feb: 2, mar: 3, avr: 4, apr: 4, abr: 4, mai: 5, may: 5, mayo: 5, maio: 5,
    jun: 6, juin: 6, jui: 6, juil: 7, jul: 7, aou: 8, aug: 8, ago: 8, sep: 9, sept: 9, set: 9,
    oct: 10, out: 10, nov: 11, dec: 12, dic: 12, dez: 12,
    'يناير': 1, 'فبراير': 2, 'مارس': 3, 'ابريل': 4, 'أبريل': 4, 'مايو': 5, 'يونيو': 6, 'يوليو': 7,
    'اغسطس': 8, 'أغسطس': 8, 'سبتمبر': 9, 'اكتوبر': 10, 'أكتوبر': 10, 'نوفمبر': 11, 'ديسمبر': 12
  };

  function arabicDigits(s) {
    return String(s).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  }

  // "2 mars 2026", "Oct 6, 2025", "6 Oct 2025", "٦ أكتوبر ٢٠٢٥" -> epoch seconds | null
  function parseLooseDate(str) {
    const s = arabicDigits(String(str || '')).replace(/[.,]/g, ' ');
    const day = s.match(/\b(\d{1,2})\b/);
    const year = s.match(/\b(20\d{2})\b/);
    if (!day || !year) return null;
    const words = s.match(/[\p{L}]+/gu) || [];
    let month = null;
    for (const w of words) {
      const k = norm(w);
      const key = MONTHS[w] ? w : (MONTHS[k] ? k : (MONTHS[k.slice(0, 4)] ? k.slice(0, 4) : (MONTHS[k.slice(0, 3)] ? k.slice(0, 3) : null)));
      if (key) { month = MONTHS[key]; break; }
    }
    if (!month) return null;
    const ms = Date.UTC(+year[1], month - 1, +day[1]);
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
  }

  function toEpochSeconds(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return v > 1e12 ? Math.floor(v / 1000) : Math.floor(v);
    if (/^\d+$/.test(String(v))) return toEpochSeconds(Number(v));
    const ms = Date.parse(String(v));
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
  }

  function isoDate(sec) {
    return sec ? new Date(sec * 1000).toISOString().slice(0, 10) : '';
  }

  /* ---------- links ---------- */

  function unwrapLink(u) {
    if (!u) return '';
    try {
      const x = new URL(u);
      if (/(^|\.)l\.facebook\.com$/.test(x.hostname) && x.pathname.indexOf('/l.php') === 0) {
        const t = x.searchParams.get('u');
        if (t) return t;
      }
    } catch (_) { /* not a URL */ }
    return String(u);
  }

  function domainOf(u) {
    try { return new URL(u).hostname.replace(/^www\./, ''); } catch (_) { return ''; }
  }

  function safeUrl(u) {
    try {
      const x = new URL(u);
      return x.protocol === 'https:' || x.protocol === 'http:' ? x.href : '';
    } catch (_) { return ''; }
  }

  /* ---------- configuration (dictionary, big brands) ---------- */

  let cfgVersion = 0;
  function configure(cfg) {
    cfg = cfg || {};
    if (cfg.gold !== undefined && Gd) Gd.setDictionary(cfg.gold);
    if (cfg.bigBrands !== undefined && Rl) Rl.setBigBrands(cfg.bigBrands);
    cfgVersion++;
  }

  /* ---------- derived, deterministic view of an ad ---------- */
  // Everything the criteria need from ONE ad. Cached per ad object and per configuration version.
  //   ageDays   whole days from the start date to the end date (or to the last time the data was collected)
  //   missing   '' | 'status' | 'date' | 'both'  → never invented, only reported
  //   stage     new (0-6) | trial (7-14) | scored (15+) | '' (no date)
  const infoCache = new WeakMap();
  function info(ad) {
    const c = infoCache.get(ad);
    if (c && c.ver === cfgVersion) return c;

    const startMs = ad.startTs ? ad.startTs * 1000 : (ad.startDate ? Date.parse(ad.startDate) : NaN);
    const endMs = ad.endTs ? ad.endTs * 1000 : (ad.endDate ? Date.parse(ad.endDate) : NaN);
    const dateKnown = Number.isFinite(startMs);
    const ref = ad.lastSeenAt || ad.capturedAt || Date.now();
    const ageDays = dateKnown ? Math.max(0, Math.floor(((Number.isFinite(endMs) ? endMs : ref) - startMs) / 864e5)) : null;
    const statusKnown = ad.isActive === true || ad.isActive === false;
    const missing = !statusKnown && !dateKnown ? 'both' : !statusKnown ? 'status' : !dateKnown ? 'date' : '';

    const text = [ad.title, ad.body, ad.linkDescription].join(' \n ');
    const gold = Gd.analyze({ title: ad.title, body: ad.body, linkDescription: ad.linkDescription });
    const big = Rl.bigBrandOf([ad.pageName, ad.domain, ad.link]);
    const cod = Rl.codRiskOf(text);
    const seasonal = Rl.seasonalOf(text);
    const pre = Rl.prelim(ageDays, ad.collationCount, gold);

    const out = {
      ver: cfgVersion,
      ageDays, dateKnown, statusKnown, missing,
      status: statusKnown ? (ad.isActive ? 'active' : 'inactive') : '',
      stage: Rl.stageOf(ageDays), band: Rl.bandOf(ageDays),
      gold, big, cod, seasonal, pre, score: pre.score
    };
    infoCache.set(ad, out);
    return out;
  }
  // Kept for backward compatibility: the extension's score is now the preliminary score of the new criteria.
  function computeScore(ad) { return info(ad).score; }

  /* ---------- normalization of a raw Meta ad object ---------- */

  function pickText(v) {
    if (!v) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object') return v.text || '';
    return '';
  }

  function normalizeAd(raw, source) {
    if (!raw || raw.ad_archive_id == null) return null;
    const s = raw.snapshot || {};
    const cards = Array.isArray(s.cards) ? s.cards : [];
    const c0 = cards[0] || {};
    const videos = Array.isArray(s.videos) ? s.videos : [];
    const imagesRaw = Array.isArray(s.images) ? s.images : [];

    let body = pickText(s.body);
    if (!body || /\{\{.*\}\}/.test(body)) {
      const cb = pickText(c0.body);
      if (cb && !/\{\{.*\}\}/.test(cb)) body = cb;
    }
    let title = s.title || c0.title || '';
    if (/\{\{.*\}\}/.test(title)) title = (c0.title && !/\{\{.*\}\}/.test(c0.title)) ? c0.title : '';
    const linkDescription = s.link_description || c0.link_description || '';
    const caption = s.caption || c0.caption || '';

    const imgs = [];
    const pushImg = (u) => { if (u && !imgs.includes(u)) imgs.push(u); };
    imagesRaw.forEach((i) => pushImg(i.resized_image_url || i.original_image_url));
    cards.forEach((c) => pushImg(c.resized_image_url || c.original_image_url));
    videos.forEach((v) => pushImg(v.video_preview_image_url));
    cards.forEach((c) => pushImg(c.video_preview_image_url));
    const videoUrl = (videos[0] && (videos[0].video_hd_url || videos[0].video_sd_url)) ||
      (cards.find((c) => c.video_hd_url || c.video_sd_url) || {}).video_hd_url || '';

    const df = String(s.display_format || '').toUpperCase();
    const format = df === 'VIDEO' ? 'VIDEO'
      : (df === 'CAROUSEL' || cards.length > 1) ? 'CAROUSEL'
      : (videos.length ? 'VIDEO' : 'IMAGE');

    const link = unwrapLink(s.link_url || c0.link_url || '');
    let domain = domainOf(link);
    if (!domain && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(caption)) domain = caption.toLowerCase();

    const ctaText = s.cta_text || c0.cta_text || '';
    const ctaType = String(s.cta_type || c0.cta_type || '').toUpperCase();

    const startTs = toEpochSeconds(raw.start_date);
    const endTs = toEpochSeconds(raw.end_date);
    const nowTs = Math.floor(Date.now() / 1000);
    // Whole days. No date → 0 here, and info() reports the date as missing.
    const daysRunning = startTs ? Math.max(0, Math.floor(((endTs || nowTs) - startTs) / 86400)) : 0;
    // Status is never guessed: an explicit flag, or an end date (which proves it stopped). Otherwise unknown (null).
    const isActive = typeof raw.is_active === 'boolean' ? raw.is_active : (endTs ? false : null);

    const pageId = String(raw.page_id || s.page_id || '');
    const ad = {
      id: String(raw.ad_archive_id),
      pageId,
      pageName: raw.page_name || s.page_name || '',
      pageUrl: s.page_profile_uri || (pageId ? 'https://www.facebook.com/' + pageId : ''),
      pageLikes: Number(s.page_like_count) || 0,
      body, title, linkDescription, caption,
      ctaText, ctaType, ctaGroup: ctaGroup(ctaType, ctaText),
      link, domain, format,
      thumb: imgs[0] || '',
      images: imgs.slice(0, 6),
      videoUrl,
      startDate: isoDate(startTs),
      endDate: isoDate(endTs),
      startTs: startTs || 0,
      endTs: endTs || 0,
      daysRunning,
      isActive,
      lastSeenAt: Date.now(),
      platforms: (Array.isArray(raw.publisher_platform) ? raw.publisher_platform : []).map((p) => String(p).toLowerCase()),
      collationCount: Number(raw.collation_count) || 1,
      collationId: raw.collation_id ? String(raw.collation_id) : '',
      categories: Array.isArray(raw.categories) ? raw.categories : [],
      pageCategories: (Array.isArray(s.page_categories) ? s.page_categories : Array.isArray(raw.page_categories) ? raw.page_categories : [])
        .map((x) => String(x && typeof x === 'object' ? x.name || x.text || '' : x || '')).filter(Boolean).slice(0, 5),
      lang: detectLang(body + ' ' + title),
      niches: [],
      libraryUrl: 'https://www.facebook.com/ads/library/?id=' + raw.ad_archive_id,
      source: source || 'net'
    };
    // [radar-platform] scoring is done by the platform engine, not here.
    return ad;
  }

  function mergeAd(old, nu) {
    if (old.source === 'net' && nu.source === 'dom') return old;
    const queries = Array.from(new Set([].concat(old.queries || [], nu.queries || [])));
    const niches = Array.from(new Set([].concat(old.niches || [], nu.niches || [])));
    return Object.assign({}, old, nu, {
      niches,
      lastSeenAt: nu.lastSeenAt || old.lastSeenAt,
      capturedAt: old.capturedAt || nu.capturedAt,
      searchKey: old.searchKey || nu.searchKey,
      query: old.query || nu.query,
      country: old.country || nu.country,
      queries,
      batchId: nu.batchId || old.batchId || ''
    });
  }

  // Same structure-agnostic walker as inject.js, for server-rendered JSON blobs.
  function walkAds(root, out) {
    const stack = [root];
    while (stack.length) {
      const o = stack.pop();
      if (!o || typeof o !== 'object') continue;
      if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) stack.push(o[i]); continue; }
      if (o.ad_archive_id != null && o.snapshot && typeof o.snapshot === 'object') { out.push(o); continue; }
      for (const k in o) { const v = o[k]; if (v && typeof v === 'object') stack.push(v); }
    }
  }

  /* ---------- filtering ---------- */

  const blobCache = new WeakMap();
  function adBlob(ad) {
    let b = blobCache.get(ad);
    if (b === undefined) {
      b = norm([ad.body, ad.title, ad.linkDescription, ad.caption, ad.pageName, ad.domain].join(' \n '));
      blobCache.set(ad, b);
    }
    return b;
  }

  function makeMatcher(filters) {
    const f = Object.assign({}, DEFAULT_SETTINGS.filters, filters || {});
    const inc = parseKeywords(f.include);
    const exc = parseKeywords(f.exclude);
    const ctaKw = parseKeywords(f.customCta);
    const domIn = parseKeywords(f.domainInclude);
    const domEx = parseKeywords(f.domainExclude);
    const groups = f.ctaGroups || [];
    const langs = f.languages || [];
    const fmts = f.formats || [];
    const plats = f.platforms || [];
    const minD = Number(f.minDays) || 0;
    const minC = Number(f.minDupes) || 0;
    const ctaActive = groups.length > 0 || ctaKw.length > 0;

    const stages = f.stages || [];
    const nicheSel = f.niches || [];
    const goldMode = f.goldMode || 'off';
    const needInfo = !!(minD || stages.length || goldMode !== 'off' || f.excludeBig || f.excludeCod);

    return function matches(ad) {
      // An ad with an unknown status is NOT excluded: it may well be active.
      if (f.activeOnly && ad.isActive === false) return false;
      if (minC && (ad.collationCount || 1) < minC) return false;
      if (f.requireLink && !ad.link) return false;
      if (fmts.length && !fmts.includes(ad.format)) return false;
      if (plats.length && !(ad.platforms || []).some((p) => plats.includes(p))) return false;
      if (nicheSel.length && !(ad.niches || []).some((n) => nicheSel.includes(n))) return false;

      if (needInfo) {
        const I = info(ad);
        // An ad without a start date is never dropped by the age filters (it is reported as "no date").
        if (minD && I.ageDays !== null && I.ageDays < minD) return false;
        if (stages.length && !stages.includes(I.stage || 'nodate')) return false;
        if (goldMode === 'any' && !(I.gold.strong || I.gold.normal)) return false;
        if (goldMode === 'strong' && !I.gold.strong) return false;
        if (goldMode === 'present' && !I.gold.present) return false;
        if (f.excludeBig && I.big.length) return false;
        if (f.excludeCod && I.cod.kind) return false;
      }

      if (ctaActive) {
        const okGroup = groups.includes(ad.ctaGroup);
        const ct = norm(ad.ctaText);
        const okCustom = ctaKw.some((k) => ct.includes(k));
        if (!okGroup && !okCustom) return false;
      }

      if (langs.length) {
        if (ad.lang === 'und') { if (!f.keepUndetected) return false; }
        else if (!langs.includes(ad.lang)) return false;
      }

      if (inc.length || exc.length) {
        const b = adBlob(ad);
        if (inc.length) {
          const ok = f.includeMode === 'all' ? inc.every((k) => b.includes(k)) : inc.some((k) => b.includes(k));
          if (!ok) return false;
        }
        if (exc.length && exc.some((k) => b.includes(k))) return false;
      }

      if (domIn.length || domEx.length) {
        const d = norm(ad.domain);
        if (domIn.length && !domIn.some((k) => d.includes(k))) return false;
        if (domEx.length && domEx.some((k) => d.includes(k))) return false;
      }
      return true;
    };
  }

  /* ---------- export ---------- */

  function csvCell(v) {
    let s = v == null ? '' : Array.isArray(v) ? v.join(' | ') : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralise spreadsheet formulas from scraped text
    if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  const iso = (ms) => (ms ? new Date(ms).toISOString() : '');
  const yn = (b) => (b ? 1 : 0);
  // Column names that the web app reads are kept exactly (ad_id, page_id, status, start_date, end_date,
  // days_running, duplicates, cta, format, language, domain, link_url, title, body, link_description,
  // image_url, video_url, page_likes, search). Unknown values are exported EMPTY, never guessed.
  const AD_COLUMNS = [
    ['ad_id', (a) => a.id],
    ['library_url', (a) => a.libraryUrl],
    ['page_id', (a) => a.pageId],
    ['page_name', (a) => a.pageName],
    ['page_url', (a) => a.pageUrl],
    ['page_likes', (a) => a.pageLikes],
    ['status', (a) => info(a).status],
    ['start_date', (a) => a.startDate],
    ['end_date', (a) => a.endDate],
    ['days_running', (a) => { const d = info(a).ageDays; return d == null ? '' : d; }],
    ['stage', (a) => info(a).stage],
    ['age_band', (a) => info(a).band],
    ['missing', (a) => info(a).missing],
    ['duplicates', (a) => a.collationCount],
    ['score', (a) => info(a).score],
    ['score_kind', () => 'prelim'],
    ['cta', (a) => a.ctaText],
    ['cta_group', (a) => a.ctaGroup],
    ['format', (a) => a.format],
    ['language', (a) => a.lang],
    ['platforms', (a) => a.platforms],
    ['domain', (a) => a.domain],
    ['link_url', (a) => a.link],
    ['title', (a) => a.title],
    ['body', (a) => a.body],
    ['link_description', (a) => a.linkDescription],
    ['image_url', (a) => a.thumb],
    ['video_url', (a) => a.videoUrl],
    ['search', (a) => a.query],
    ['search_terms', (a) => a.queries],
    ['search_terms_count', (a) => (a.queries || []).length],
    ['niche', (a) => (a.niches || [])[0] || ''],
    ['niches', (a) => a.niches || []],
    ['gold_strong', (a) => info(a).gold.strong],
    ['gold_normal', (a) => info(a).gold.normal],
    ['gold_weak', (a) => info(a).gold.weak],
    ['gold_units', (a) => info(a).gold.units],
    ['gold_present', (a) => yn(info(a).gold.present)],
    ['gold_terms', (a) => info(a).gold.terms],
    ['big_brand', (a) => info(a).big.join(' | ')],
    ['cod_risk', (a) => info(a).cod.kind],
    ['seasonal', (a) => info(a).seasonal.join(' | ')],
    ['collected_at', (a) => iso(a.capturedAt)],
    ['last_seen_at', (a) => iso(a.lastSeenAt)],
    ['source', (a) => a.source]
  ];

  // One flat object per ad, ready to POST to the web app (/api/ext/adlib).
  function adRow(ad) {
    const o = {};
    for (const [k, fn] of AD_COLUMNS) { const v = fn(ad); o[k] = Array.isArray(v) ? v.join(' | ') : v; }
    return o;
  }
  function toRows(list) { return list.map(adRow); }

  function toCSV(rows, columns) {
    const cols = columns || AD_COLUMNS;
    const lines = [cols.map((c) => csvCell(c[0])).join(',')];
    for (const r of rows) lines.push(cols.map((c) => csvCell(c[1](r))).join(','));
    return '\uFEFF' + lines.join('\r\n'); // BOM so Excel reads Arabic correctly
  }

  function groupAdvertisers(list) {
    const m = new Map();
    for (const a of list) {
      const k = a.pageId || a.pageName;
      let g = m.get(k);
      if (!g) {
        g = { pageId: a.pageId, pageName: a.pageName, pageUrl: a.pageUrl, ads: 0, active: 0, dupes: 0, maxDays: 0, best: 0, domains: new Map() };
        m.set(k, g);
      }
      g.ads++;
      if (a.isActive === true) g.active++;
      g.dupes += a.collationCount || 1;
      const I = info(a);
      g.maxDays = Math.max(g.maxDays, I.ageDays || 0);
      g.best = Math.max(g.best, I.score || 0);
      if (a.domain) g.domains.set(a.domain, (g.domains.get(a.domain) || 0) + 1);
    }
    return Array.from(m.values()).map((g) => {
      const top = Array.from(g.domains.entries()).sort((x, y) => y[1] - x[1])[0];
      return Object.assign(g, { topDomain: top ? top[0] : '' });
    }).sort((a, b) => b.best - a.best || b.ads - a.ads);
  }

  const ADV_COLUMNS = [
    ['page_id', (g) => g.pageId],
    ['page_name', (g) => g.pageName],
    ['page_url', (g) => g.pageUrl],
    ['ads', (g) => g.ads],
    ['active_ads', (g) => g.active],
    ['total_duplicates', (g) => g.dupes],
    ['max_days_running', (g) => g.maxDays],
    ['best_score', (g) => g.best],
    ['top_domain', (g) => g.topDomain]
  ];

  const api = {
    STORE_PREFIX, DEFAULT_SETTINGS, CTA_GROUP_IDS, CTA_GROUPS,
    norm, parseKeywords, ctaGroup, detectLang, parseLooseDate, toEpochSeconds, isoDate,
    unwrapLink, domainOf, safeUrl, computeScore, normalizeAd, mergeAd, walkAds,
    adBlob, makeMatcher, csvCell, AD_COLUMNS, ADV_COLUMNS, toCSV, groupAdvertisers,
    info, configure, adRow, toRows, Gold: Gd, Rules: Rl, Niches: Nc
  };

  root.AdRadar = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
