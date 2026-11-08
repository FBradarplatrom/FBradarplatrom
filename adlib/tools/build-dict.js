'use strict';
// يولّد adlib/default_dict.json = قاموس الإكستنشن (الكلمات الذهبية + النيشات العشرة + القوائم)
// مدموجاً مع قاموس المنصة (engine/dicts.js). التشغيل: node adlib/tools/build-dict.js
const fs = require('fs'), path = require('path');
const G = require('../lib/golden.js'), R = require('../lib/rules.js'), N = require('../lib/niches.js');

const src = fs.readFileSync(path.join(__dirname, '..', '..', 'engine', 'dicts.js'), 'utf8');
const DEF = JSON.parse(src.match(/const DEF=(\{[\s\S]*?\});/)[1]);
const split = s => String(s || '').split(/\s*,\s*/).map(x => x.trim()).filter(Boolean);
const key = s => { const n = G.nzm(s).replace(/\s+/g, ' ').trim(); return /[a-z]/.test(n) && !/[\u0600-\u06FF]/.test(n) ? G.collapse(n) : n; };
const alts = e => String(e).split('/').map(x => x.trim()).filter(Boolean);

const gold = G.cloneDefault();
const LANGS = ['ar', 'dz', 'fr', 'arz'], TIERS = ['strong', 'normal', 'weak'];
const index = new Map();            // key(alt) -> {lang, tier, i}
for (const lg of LANGS) for (const t of TIERS) gold[lg][t].forEach((e, i) => alts(e).forEach(a => index.set(lg + '|' + key(a), { lang: lg, tier: t, i })));
const findAny = a => { for (const lg of LANGS) { const h = index.get(lg + '|' + key(a)); if (h) return h; } return null; };

const stats = { merged: 0, added: 0, tierConflicts: [], newByLang: { ar: 0, fr: 0, arz: 0 } };
const frWord = /[àâçéèêëîïôûùüÿœ]|\b(le|la|les|de|du|des|un|une|vous|votre|pas|plus|sans|fini|stop|ne|avoir|besoin|solution|problème|temps|gagner|contre)\b/i;
for (const tier of TIERS) {
  for (const entry of split(DEF[tier])) {
    const A = alts(entry);
    let hit = null;
    for (const a of A) { hit = findAny(a); if (hit) break; }
    if (hit) {
      if (hit.tier !== tier) stats.tierConflicts.push(entry + ' (' + hit.tier + ' ← ' + tier + ')');
      const target = gold[hit.lang][hit.tier];
      const have = new Set(alts(target[hit.i]).map(key));
      const extra = A.filter(a => !have.has(key(a)));
      if (extra.length) { target[hit.i] = alts(target[hit.i]).concat(extra).join('/'); extra.forEach(a => index.set(hit.lang + '|' + key(a), hit)); stats.merged++; }
      continue;
    }
    const first = A[0];
    const lang = /[\u0600-\u06FF]/.test(first) ? 'ar' : (/\d/.test(first) || !frWord.test(first) ? 'arz' : 'fr');
    gold[lang][tier].push(entry);
    A.forEach(a => index.set(lang + '|' + key(a), { lang, tier, i: gold[lang][tier].length - 1 }));
    stats.added++; stats.newByLang[lang]++;
  }
}

const union = (a, b) => { const seen = new Set(), out = []; for (const x of a.concat(b)) { const k = key(x); if (k && !seen.has(k)) { seen.add(k); out.push(x); } } return out; };
const out = {
  version: new Date().toISOString().slice(0, 10),
  gold,
  niches: N.clone(),
  bigBrands: union(R.DEFAULT_BIG_BRANDS, split(DEF.brands)),
  codLarge: union(R.COD_LARGE, split(DEF.bulky)),
  codFragile: union(R.COD_FRAGILE, split(DEF.fragile)),
  seasonal: R.SEASONAL.slice()
};
fs.writeFileSync(path.join(__dirname, '..', 'default_dict.json'), JSON.stringify(out, null, 1));
const cnt = o => LANGS.reduce((n, lg) => n + TIERS.reduce((m, t) => m + o[lg][t].length, 0), 0);
console.log('gold entries:', cnt(G.cloneDefault()), '→', cnt(gold));
console.log('entries enriched with platform alt-forms:', stats.merged, '· platform-only entries added:', stats.added, JSON.stringify(stats.newByLang));
console.log('tier conflicts (kept extension tier):', stats.tierConflicts.length, stats.tierConflicts.slice(0, 6));
console.log('bigBrands', out.bigBrands.length, 'codLarge', out.codLarge.length, 'codFragile', out.codFragile.length);
