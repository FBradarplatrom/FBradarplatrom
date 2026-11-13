// [radar-platform] Patched copy: analyze(parts, compiledTerms) and compile() are exported so each user can have their own dictionary.
// Ad Radar – golden-word dictionary + matching engine (v2, aligned with the winning-product criteria).
//
// Rules implemented here:
//  * Whole-word matching only: a term must never be a fragment of another word.
//  * Arabic: diacritics ignored, alef/ya/ta-marbuta unified, common prefixes accepted (و ف ب ل ك ال لل),
//    verb forms (ي → ت), pronoun suffixes on verbs, and hand-listed masdar / active-participle forms.
//  * French: accents ignored, optional plural s/x.
//  * Arabizi (Darija in Latin letters + digits): lower-cased, repeated letters collapsed.
//  * Tiers: strong (3 units) · normal (1) · weak (0.3). A term in the title or the first 160 characters of the
//    body counts fully, anywhere else half. Each distinct term counts once. If a term sits inside a longer
//    term only the longer one is counted.
(function (root) {
  'use strict';

  const TIER_W = { strong: 3, normal: 1, weak: 0.3 };
  const TIER_RANK = { strong: 3, normal: 2, weak: 1 };
  const HEAD_CHARS = 160;
  const PRESENT_UNITS = 3;     // evidence is "present" with one strong word or >= 3 units
  const SATURATION = 6;        // benefit score reaches 100% at 6 units

  /* ---------- default dictionary (single source of truth) ---------- */
  const DEFAULT_GOLD = {
    ar: {
      strong: ['يحل', 'يقضي على', 'يزيل', 'يمنع', 'يمنع من', 'يحمي', 'يحمي من', 'يصلح', 'يساعد', 'يساعد على', 'يخفف', 'يخفف من', 'يوقف', 'يكافح'],
      normal: ['تفادي', 'يحسن', 'يصحح', 'يسهل', 'يوفر عليك', 'يوفر', 'ينظف', 'يهدئ', 'يريح', 'ينذر', 'يكشف', 'ينبه', 'يراقب', 'يتتبع', 'يقيس', 'يسد', 'يسرب', 'يفك', 'يقطع', 'يجفف', 'يقشر', 'يشد', 'يضيق', 'يرطب', 'يقوي', 'يحرق', 'يبيض', 'يجمل', 'يلمع', 'يضاعف', 'ينمي', 'يطور', 'يبني', 'يسرع', 'يبطئ', 'يحفظ', 'يحافظ على', 'ينظم', 'يخزن', 'يطوي', 'بدون حاجة', 'يلغي', 'يطرد', 'يسقي', 'يقلم', 'يسخن', 'يضيء', 'يفيد'],
      weak: ['يعطي', 'يجعل', 'يقوم', 'يجد', 'يفتح', 'يناسب', 'يعلم', 'يشغل', 'يشحن', 'يزيد', 'يضعف', 'يجهد', 'يرافق', 'يربط', 'يغطي', 'يخلط']
    },
    dz: {
      strong: ['تخلص من', 'وداعا', 'ودّع', 'الحل النهائي', 'حل نهائي', 'جبنالك الحل', 'يداوي', 'تصليح', 'يحبّس', 'تخلّص نهائياً'],
      normal: ['عندك مشكل', 'راك تعاني', 'هل تعاني', 'تعاني من', 'تعبت من', 'راح تتهنى', 'نهائيا', 'يعاون', 'يسهّل عليك', 'ينحي', 'ينقص', 'بلا ما تحتاج', 'ما تحتاجش', 'ما تبقاش', 'ما تزيدش', 'طريقة سهلة', 'ساهل الاستعمال', 'متعدد الاستعمالات'],
      weak: []
    },
    fr: {
      strong: ['résout/résoudre', 'élimine/éliminer', 'supprime/supprimer', 'empêche/empêcher', 'protège/protéger', 'protège contre', 'répare/réparer', 'soulage/soulager', 'aide à', 'réduit/réduire', 'stoppe/arrête', 'lutte contre', 'solution définitive', 'dites adieu à', 'débarrassez-vous de', 'en finir avec', 'stop à'],
      normal: ['évite', 'améliore', 'corrige', 'facilite', 'simplifie', 'économise', 'fait gagner du temps', 'nettoie', 'apaise', 'détecte', 'alerte', 'surveille', 'mesure', 'sèche', 'hydrate', 'renforce', 'éclaire', 'range', 'conserve', 'organise', 'remplace', 'vous souffrez de', 'souffrez-vous de', 'marre de', 'fatigué de', 'vous avez un problème', 'on a la solution', 'voici la solution', 'définitivement', 'adieu', 'plus besoin de', 'sans avoir besoin de', 'ne plus avoir à', 'fini les'],
      weak: ['donne', 'rend', 'fait', 'permet', 'convient', 'ouvre', 'trouve', 'accompagne', 'connecte', 'mélange']
    },
    arz: {
      strong: ['y7el/yhel', 'y9dhi 3la/yqdi 3la', 'yzil/yzeel', 'ymna3/ymne3', 'y7mi/yahmi', 'ysal7/ysala7/ysli7', 'ysa3ed/ysa3d', 'ykhaffef/ykhafef', 'yw9ef/ywa9ef/y7bes', 'ykafe7/yka7ef', 'ydawi', 'jbnalek l7al/jibnalek el 7al', 'l7al nihai/7al nihai', 't5alas men/tkhalas men/takhallas men', 'wada3/ouda3an', 'tasli7/tsli7'],
      normal: ['rak t3ani/rak ta3ani', 't3ani men', 't3ebt men/ta3bt men', '3andek mochkil/andek mouchkil', 'rah tethana/ra7 tetheni', 'nihaiyan/nihayen', 'ysahel/ysahhel', 'ysahel 3lik', 'ywaffer/ywafer', 'ynaqqes/ynakes', 'yna7i', 'ma t7tajch/matahtajch', 'ma tb9ach/matebqach', 'ma tzidch/matzidch', 'bla ma t7taj', 'tari9a sahla', 'sahel l isti3mal', 'mouta3added listi3malat/multi usage'],
      weak: []
    }
  };

  // Hand-listed masdar / active-participle / lam forms (key = canonical Arabic term).
  const AR_FORMS = {
    'يزيل': ['إزالة', 'مزيل'],
    'يمنع': ['منع', 'مانع', 'مانعة'],
    'يمنع من': ['منع من'],
    'يحمي': ['حماية', 'حامي', 'واقي', 'واقية'],
    'يحمي من': ['حماية من', 'واقي من', 'واقية من'],
    'يصلح': ['إصلاح', 'مصلح'],
    'يساعد': ['مساعدة'],
    'يساعد على': ['مساعدة على'],
    'يخفف': ['تخفيف', 'مخفف'],
    'يخفف من': ['تخفيف من'],
    'يوقف': ['إيقاف'],
    'يكافح': ['مكافحة'],
    'يقضي على': ['القضاء على', 'قضاء على'],
    'يحسن': ['تحسين'],
    'يسهل': ['تسهيل'],
    'يوفر': ['توفير'],
    'ينظف': ['تنظيف'],
    'يرطب': ['ترطيب'],
    'يقوي': ['تقوية'],
    'يطور': ['تطوير'],
    'ينمي': ['تنمية'],
    'يحافظ على': ['المحافظة على', 'محافظة على'],
    'يجفف': ['تجفيف'],
    'يقشر': ['تقشير'],
    'يبيض': ['تبييض'],
    'يهدئ': ['تهدئة'],
    'يسرع': ['تسريع'],
    'ينظم': ['تنظيم'],
    'يخزن': ['تخزين'],
    'يكشف': ['كشف'],
    'يراقب': ['مراقبة'],
    'يتتبع': ['تتبع'],
    'يضاعف': ['مضاعفة'],
    'يجمل': ['تجميل'],
    'يلمع': ['تلميع']
  };

  /* ---------- normalisation ---------- */
  function nzm(s) {
    return String(s == null ? '' : s)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/ئ/g, 'ي')
      .replace(/ؤ/g, 'و')
      .toLowerCase();
  }
  const collapse = (s) => s.replace(/([a-z])\1+/g, '$1');
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tokens = (s) => s.split(/[\s\-]+/).filter(Boolean);
  const hasArabic = (s) => /[\u0600-\u06FF]/.test(s);
  const hasLatin = (s) => /[a-z]/.test(s);

  const B_BEFORE = '(?<![\\p{L}\\p{N}])';
  const B_AFTER = '(?![\\p{L}\\p{N}])';
  const B_BEFORE_L = '(?<![a-z0-9])';
  const B_AFTER_L = '(?![a-z0-9])';
  const AR_PREFIX = '(?:[وف]?(?:لل|[بكل]?(?:ال)?))';
  const AR_VERB_SUFFIX = '(?:ك|كم|ه|ها|هم|ني|نا)?';
  const SEP = '[\\s\\-]+';

  const srcOf = (toks, firstSuffix) =>
    toks.map((t, i) => esc(t) + (i === 0 && firstSuffix ? AR_VERB_SUFFIX : '')).join(SEP);

  /* ---------- compilation ---------- */
  let dictVersion = 0;
  let compiled = null;
  let currentDict = null;

  function compileTerm(entry, lang, tier) {
    const alts = String(entry).split('/').map((x) => x.trim()).filter(Boolean);
    if (!alts.length) return null;
    const canon = alts[0];
    const srcs = [];
    const seen = new Set();
    const push = (norm, verbSuffix) => {
      const toks = tokens(norm);
      if (!toks.length) return;
      const key = toks.join(' ') + '|' + (verbSuffix ? 1 : 0);
      if (seen.has(key)) return;
      seen.add(key);
      srcs.push(srcOf(toks, verbSuffix));
    };

    const arabicLike = lang === 'ar' || lang === 'dz';
    for (const alt of alts) {
      let n = nzm(alt);
      if (lang === 'arz') n = collapse(n);
      const toks = tokens(n);
      if (!toks.length) continue;
      if (arabicLike) {
        const verb = /^[يت].{2,}/.test(toks[0]);
        push(n, verb);
        if (/^ي.{2,}/.test(toks[0])) push('ت' + toks[0].slice(1) + (toks.length > 1 ? ' ' + toks.slice(1).join(' ') : ''), true);
        if (lang === 'ar' && AR_FORMS[alt]) AR_FORMS[alt].forEach((f) => push(nzm(f), false));
      } else {
        push(n, false);
      }
    }
    if (!srcs.length) return null;
    const body = '(?:' + srcs.join('|') + ')';
    let re;
    if (arabicLike) re = new RegExp(B_BEFORE + AR_PREFIX + body + B_AFTER, 'gu');
    else if (lang === 'fr') re = new RegExp(B_BEFORE + body + '(?:s|x)?' + B_AFTER, 'gu');
    else re = new RegExp(B_BEFORE_L + body + B_AFTER_L, 'g');
    return { canon, tier, lang, re };
  }

  function compile(dict) {
    const terms = [];
    const seen = new Set();
    for (const lang of ['ar', 'dz', 'fr', 'arz']) {
      const d = (dict && dict[lang]) || {};
      for (const tier of ['strong', 'normal', 'weak']) {
        for (const e of (d[tier] || [])) {
          const k = lang + '|' + nzm(String(e).split('/')[0]);
          if (seen.has(k)) continue;
          seen.add(k);
          const c = compileTerm(e, lang, tier);
          if (c) terms.push(c);
        }
      }
    }
    return terms;
  }

  function setDictionary(dict) {
    currentDict = dict && typeof dict === 'object' ? dict : DEFAULT_GOLD;
    compiled = compile(currentDict);
    dictVersion++;
  }
  function getDictionary() { return currentDict || DEFAULT_GOLD; }
  function ensure() { if (!compiled) setDictionary(DEFAULT_GOLD); }

  /* ---------- scanning ---------- */
  function scan(text, terms) {
    const out = [];
    const tAr = nzm(text);
    if (!tAr.trim()) return out;
    const tArz = collapse(tAr);
    const ar = hasArabic(tAr), lat = hasLatin(tAr);
    for (const term of (terms || compiled)) {
      let src;
      if (term.lang === 'ar' || term.lang === 'dz') { if (!ar) continue; src = tAr; }
      else { if (!lat) continue; src = term.lang === 'arz' ? tArz : tAr; }
      const re = term.re;
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(src))) {
        if (m[0] === '') { re.lastIndex++; continue; }
        out.push({ canon: term.canon, tier: term.tier, lang: term.lang, s: m.index, e: m.index + m[0].length, g: term.lang === 'arz' ? 'z' : 'a' });
      }
    }
    // keep the longest term when one sits inside another
    out.sort((a, b) => (b.e - b.s) - (a.e - a.s) || TIER_RANK[b.tier] - TIER_RANK[a.tier]);
    const kept = [];
    for (const o of out) {
      const inside = kept.some((k) => k.g === o.g && k.canon !== o.canon && k.s <= o.s && o.e <= k.e);
      if (!inside) kept.push(o);
    }
    return kept;
  }

  // parts: { title, body, linkDescription }
  function analyze(parts, terms) {
    if (!terms) ensure();
    const title = String((parts && parts.title) || '');
    const body = String((parts && parts.body) || '');
    const ld = String((parts && parts.linkDescription) || '');
    const head = title + ' \n ' + body.slice(0, HEAD_CHARS);
    const tail = body.slice(HEAD_CHARS) + ' \n ' + ld;

    const found = new Map(); // canon -> { tier, lang, head }
    for (const o of scan(head, terms)) found.set(o.canon, { tier: o.tier, lang: o.lang, head: true });
    for (const o of scan(tail, terms)) if (!found.has(o.canon)) found.set(o.canon, { tier: o.tier, lang: o.lang, head: false });

    const res = { strong: 0, normal: 0, weak: 0, units: 0, terms: [], strongTerms: [], hits: [], langs: [], present: false, benefit: 0 };
    const langs = new Set();
    for (const [canon, v] of found) {
      res[v.tier]++;
      res.units += TIER_W[v.tier] * (v.head ? 1 : 0.5);
      res.terms.push(canon);
      if (v.tier === 'strong') res.strongTerms.push(canon);
      res.hits.push({ t: canon, tier: v.tier, lang: v.lang, head: v.head });
      langs.add(v.lang);
    }
    res.units = Math.round(res.units * 100) / 100;
    res.langs = Array.from(langs);
    res.present = res.strong >= 1 || res.units >= PRESENT_UNITS;
    res.benefit = Math.min(1, res.units / SATURATION);
    res.hits.sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier] || Number(b.head) - Number(a.head));
    return res;
  }

  // First alternative of "a/b/c" → what is typed into the Ad Library search box.
  const searchForm = (entry) => String(entry).split('/')[0].trim();

  const api = {
    TIER_W, DEFAULT_GOLD, AR_FORMS, HEAD_CHARS, PRESENT_UNITS, SATURATION,
    nzm, collapse, esc, tokens, hasArabic, hasLatin,
    setDictionary, getDictionary, analyze, searchForm, compile,
    version: () => dictVersion,
    cloneDefault: () => JSON.parse(JSON.stringify(DEFAULT_GOLD))
  };
  root.AdRadarGold = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
