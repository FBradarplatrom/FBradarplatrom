// Ad Radar – rules taken from the final winning-product criteria.
// Everything here is deterministic and testable (no DOM, no chrome.*).
(function (root) {
  'use strict';
  const G = root.AdRadarGold || (typeof require === 'function' ? require('./golden.js') : null);
  const { nzm, collapse, esc, tokens } = G;

  /* ---------- lists ---------- */
  // Confirmed big brands only (no followers / "official store" / page-age heuristics).
  // The Arabic spellings are transliterations of the same five names.
  const DEFAULT_BIG_BRANDS = ['jumia', 'ouedkniss', 'temu', 'aliexpress', 'amazon', 'جوميا', 'واد كنيس', 'علي اكسبرس', 'امازون', 'تيمو'];

  // Cash-on-delivery exclusion lists. Clothes / shoes / kids' clothes are NOT here on purpose.
  const COD_LARGE = [
    'خزانة', 'خزائن', 'دولاب', 'دواليب', 'ثلاجة', 'ثلاجات', 'غسالة', 'غسالات', 'كنبة', 'كنبات', 'أريكة', 'أرائك', 'سرير', 'أسرّة', 'طاولة', 'طاولات', 'أثاث', 'مكيف', 'مكيفات',
    'armoire', 'meuble', 'réfrigérateur', 'lave-linge', 'canapé', 'lit', 'table', 'climatiseur',
    'khizana', 'dulab', 'thalaja', 'frigo', 'ghassala', 'kanaba', 'kanapé', 'sarir', 'tawla'
  ];
  const COD_FRAGILE = [
    'زجاج', 'هش', 'قابل للكسر', 'خزف', 'سيراميك', 'بلور', 'مرآة',
    'verre', 'fragile', 'céramique', 'cristal', 'miroir',
    'zoujaj', 'zejaj', 'hech', '9abil lel kasr'
  ];
  // Seasonal products are only tagged; they never change the score.
  const SEASONAL = ['رمضان', 'العيد', 'الأضحية', 'الشتاء', 'شتاء', 'بلاك فرايداي', 'black friday', 'ramadan', 'الدخول المدرسي'];

  /* ---------- whole-word list matcher ---------- */
  const B_BEFORE = '(?<![\\p{L}\\p{N}])';
  const B_AFTER = '(?![\\p{L}\\p{N}])';
  const AR_PREFIX = '(?:[وف]?(?:لل|[بكل]?(?:ال)?))';

  function wordMatcher(list) {
    const arabic = [], latin = [];
    for (const raw of list || []) {
      for (const alt of String(raw).split('/')) {
        const n = nzm(alt).trim();
        if (!n) continue;
        const toks = tokens(n);
        if (/[\u0600-\u06FF]/.test(n)) arabic.push({ canon: String(raw).split('/')[0].trim(), src: toks.map(esc).join('[\\s\\-]+') });
        else latin.push({ canon: String(raw).split('/')[0].trim(), src: collapse(toks.join(' ')).split(' ').map(esc).join('[\\s\\-]+') });
      }
    }
    const reA = arabic.map((x) => ({ canon: x.canon, re: new RegExp(B_BEFORE + AR_PREFIX + '(?:' + x.src + ')' + B_AFTER, 'u') }));
    const reL = latin.map((x) => ({ canon: x.canon, re: new RegExp('(?<![a-z0-9])(?:' + x.src + ')(?:s|x)?(?![a-z0-9])') }));
    return function match(text) {
      const t = nzm(text);
      if (!t.trim()) return [];
      const out = [];
      if (/[\u0600-\u06FF]/.test(t)) for (const m of reA) if (m.re.test(t) && !out.includes(m.canon)) out.push(m.canon);
      if (/[a-z]/.test(t)) {
        const tl = collapse(t);
        for (const m of reL) if (m.re.test(tl) && !out.includes(m.canon)) out.push(m.canon);
      }
      return out;
    };
  }

  /* ---------- configurable matchers ---------- */
  let bigMatch = wordMatcher(DEFAULT_BIG_BRANDS);
  let bigList = DEFAULT_BIG_BRANDS.slice();
  const codLarge = wordMatcher(COD_LARGE);
  const codFragile = wordMatcher(COD_FRAGILE);
  const seasonal = wordMatcher(SEASONAL);

  function parseList(s) {
    return String(s || '').split(/[,\n،;]+/).map((x) => x.trim()).filter(Boolean);
  }
  function setBigBrands(listOrString) {
    const l = Array.isArray(listOrString) ? listOrString : parseList(listOrString);
    bigList = l.length ? l : DEFAULT_BIG_BRANDS.slice();
    bigMatch = wordMatcher(bigList);
  }

  /* ---------- stages and age bands ---------- */
  // 0-6 new · 7-14 trial · 15+ scored.  Age = whole days from the ad's start date to the data-collection date.
  function stageOf(ageDays) {
    if (ageDays == null) return '';
    if (ageDays < 7) return 'new';
    if (ageDays < 15) return 'trial';
    return 'scored';
  }
  function bandOf(ageDays) {
    if (ageDays == null || ageDays < 15) return '';
    if (ageDays < 30) return '15-29';
    if (ageDays < 45) return '30-44';
    if (ageDays < 60) return '45-59';
    if (ageDays < 90) return '60-89';
    return '90+';
  }
  const BAND_PCT = { '15-29': 1, '30-44': 0.75, '45-59': 0.5, '60-89': 0.25, '90+': 0.1 };
  const COPIES_PCT = [0, 0, 0.3, 0.5, 0.7, 0.85, 1];        // index = copies (1 → 0%, 6+ → 100%)
  const copiesPct = (n) => COPIES_PCT[Math.max(1, Math.min(6, Number(n) || 1))];

  // Preliminary score (0-100), only from what a single ad can prove:
  // duration (30) + copies (22) + benefit (14), out of 66, then scaled and cohesion-weighted.
  // Sellers, similar products and trend need the whole dataset and are left to the web app.
  const PRE_W = { dur: 30, cop: 22, ben: 14 };
  const PRE_CF = { 3: 1, 2: 0.7, 1: 0.35, 0: 0 };
  function prelim(ageDays, copies, gold) {
    const stage = stageOf(ageDays);
    const band = bandOf(ageDays);
    const durPct = stage === 'scored' ? BAND_PCT[band] : 0;
    const copPct = copiesPct(copies);
    const benPct = gold ? gold.benefit : 0;
    const durPresent = ageDays != null && ageDays >= 15 && ageDays < 45;
    const copPresent = (Number(copies) || 1) >= 2;
    const benPresent = !!(gold && gold.present);
    const k = (durPresent ? 1 : 0) + (copPresent ? 1 : 0) + (benPresent ? 1 : 0);
    // duration counts fully only when another piece of evidence backs it up
    const durFactor = (copPresent || benPresent) ? 1 : 0.5;
    const pts = PRE_W.dur * durPct * durFactor + PRE_W.cop * copPct + PRE_W.ben * benPct;
    const score = Math.round((pts / (PRE_W.dur + PRE_W.cop + PRE_W.ben)) * 100 * PRE_CF[k]);
    return { score, k, durPct, copPct, benPct, durFactor, present: { dur: durPresent, cop: copPresent, ben: benPresent } };
  }

  const api = {
    DEFAULT_BIG_BRANDS, COD_LARGE, COD_FRAGILE, SEASONAL,
    wordMatcher, parseList, setBigBrands,
    getBigBrands: () => bigList.slice(),
    bigBrandOf: (parts) => bigMatch(parts.join(' \n ')),
    codRiskOf: (text) => {
      const large = codLarge(text), fragile = codFragile(text);
      return { large, fragile, kind: large.length && fragile.length ? 'both' : large.length ? 'large' : fragile.length ? 'fragile' : '' };
    },
    seasonalOf: (text) => seasonal(text),
    stageOf, bandOf, BAND_PCT, copiesPct, prelim, PRE_W, PRE_CF
  };
  root.AdRadarRules = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
