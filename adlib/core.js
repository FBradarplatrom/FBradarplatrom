'use strict';
// منطق قسم «جمع الإعلانات» (دوال نقية): قاموس كلمات البحث لكل مستخدم + تحويل الإعلان الخام إلى صف يفهمه محرك التحليل.
// لا وسم ولا تصفية هنا: التقييم والتصفية كلها من محرك المنصة عند التحليل.
const G = require('./lib/golden.js'), S = require('./lib/shared.js'), MK = require('./lib/markets.js'), PC = require('./lib/productcheck.js');

// ar/dz/fr/arz = قاموس الجزائر الأصلي. باقي اللغات (en, es, id, vi, zh ...) من lib/markets.js.
// المكمّلات: ar تُستعمل مع الفصحى والدارجة، وكل لغة أخرى مكمّلاتها بلغتها.
const LANGS = MK.ALL_LANGS, TIERS = ['strong', 'normal', 'weak'], SCRIPTS = ['ar', 'fr', 'arz'].concat(MK.NEW_LANGS);
const LIM = { entry: 80, list: 600, niches: 40, name: 60 };

/* ---------- مفاتيح المقارنة ---------- */
const keyOf = s => { const n = G.nzm(String(s).split('/')[0]).replace(/\s+/g, ' ').trim(); return /[a-z]/.test(n) && !/[\u0600-\u06FF]/.test(n) ? G.collapse(n) : n; };
const keyAll = s => { const n = G.nzm(s).replace(/\s+/g, ' ').trim(); return /[a-z]/.test(n) && !/[\u0600-\u06FF]/.test(n) ? G.collapse(n) : n; };

/* ---------- فروقات القاموس: {add:[], off:[]} لكل قائمة ---------- */
const cleanStr = s => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, LIM.entry);
function cleanList(d, kf) {
  const out = { add: [], off: [] };
  if (!d || typeof d !== 'object') return out;
  for (const k of ['add', 'off']) {
    const seen = new Set();
    for (const x of (Array.isArray(d[k]) ? d[k] : []).slice(0, LIM.list)) {
      const t = cleanStr(x), kk = t && kf(t);
      if (kk && !seen.has(kk)) { seen.add(kk); out[k].push(t); }
    }
  }
  return out;
}
function cleanDiff(raw) {
  raw = raw && typeof raw === 'object' ? raw : {};
  const out = { v: 1, gold: {}, niches: { add: [], off: [], edit: {} }, bigBrands: cleanList(raw.bigBrands, keyAll) };
  for (const lg of LANGS) {
    out.gold[lg] = {};
    for (const t of TIERS) out.gold[lg][t] = cleanList(raw.gold && raw.gold[lg] && raw.gold[lg][t], keyOf);
  }
  const n = raw.niches || {};
  out.niches.off = (Array.isArray(n.off) ? n.off : []).map(x => String(x).slice(0, 40)).slice(0, 40);
  for (const x of (Array.isArray(n.add) ? n.add : []).slice(0, LIM.niches)) {
    const id = String((x && x.id) || '').replace(/[^\w-]/g, '').slice(0, 40), name = cleanStr(x && x.name).slice(0, LIM.name);
    if (!id || !name) continue;
    const comps = {};
    SCRIPTS.forEach(s => { comps[s] = cleanList({ add: x.comps && x.comps[s], off: [] }, keyAll).add; });
    out.niches.add.push({ id, name, comps });
  }
  for (const id of Object.keys(n.edit || {}).slice(0, 60)) {
    const e = n.edit[id] || {}, o = {};
    if (e.name) o.name = cleanStr(e.name).slice(0, LIM.name);
    if (e.comps) { o.comps = {}; SCRIPTS.forEach(s => { o.comps[s] = cleanList(e.comps[s], keyAll); }); }
    out.niches.edit[String(id).slice(0, 40)] = o;
  }
  return out;
}

function applyList(base, d, kf) {
  d = d || { add: [], off: [] };
  const off = new Set(d.off.map(kf)), seen = new Set(), out = [];
  for (const x of base) { const k = kf(x); if (!off.has(k) && !seen.has(k)) { seen.add(k); out.push(x); } }
  for (const x of d.add) { const k = kf(x); if (!seen.has(k)) { seen.add(k); out.push(x); } }
  return out;
}
// نفس القائمة مع الوسوم: def (افتراضي) · off (معطّل) · custom (من المستخدم)
function describeList(base, d, kf) {
  d = d || { add: [], off: [] };
  const off = new Set(d.off.map(kf)), seen = new Set(), out = [];
  for (const x of base) { const k = kf(x); if (!seen.has(k)) { seen.add(k); out.push({ t: x, s: off.has(k) ? 'off' : 'def' }); } }
  for (const x of d.add) { const k = kf(x); if (!seen.has(k)) { seen.add(k); out.push({ t: x, s: 'custom' }); } }
  return out;
}

function effective(base, diff) {
  diff = cleanDiff(diff);
  const gold = {};
  for (const lg of LANGS) { gold[lg] = {}; for (const t of TIERS) gold[lg][t] = applyList(base.gold[lg][t] || [], diff.gold[lg][t], keyOf); }
  for (const lg of LANGS) {                                   // لا يبقى المصطلح في مستويين: الأقوى يغلب
    const taken = new Set();
    for (const t of TIERS) gold[lg][t] = gold[lg][t].filter(x => { const k = keyOf(x); if (taken.has(k)) return false; taken.add(k); return true; });
  }
  const niches = [], off = new Set(diff.niches.off);
  for (const n of base.niches.concat(diff.niches.add)) {
    if (off.has(n.id)) continue;
    const e = diff.niches.edit[n.id] || {}, comps = {};
    SCRIPTS.forEach(s => { comps[s] = applyList((n.comps && n.comps[s]) || [], e.comps && e.comps[s], keyAll); });
    niches.push({ id: n.id, name: e.name || n.name, comps });
  }
  return { gold, niches, bigBrands: applyList(base.bigBrands, diff.bigBrands, keyAll), codLarge: base.codLarge, codFragile: base.codFragile, seasonal: base.seasonal };
}

// عرض للمحرّر: كل عنصر بوسمه
function describe(base, diff) {
  diff = cleanDiff(diff);
  const gold = {};
  for (const lg of LANGS) { gold[lg] = {}; for (const t of TIERS) gold[lg][t] = describeList(base.gold[lg][t] || [], diff.gold[lg][t], keyOf); }
  const niches = [];
  for (const n of base.niches) {
    const e = diff.niches.edit[n.id] || {}, comps = {};
    SCRIPTS.forEach(s => { comps[s] = describeList((n.comps && n.comps[s]) || [], e.comps && e.comps[s], keyAll); });
    niches.push({ id: n.id, name: e.name || n.name, def: true, off: diff.niches.off.includes(n.id), comps });
  }
  for (const n of diff.niches.add) {
    const e = diff.niches.edit[n.id] || {}, comps = {};
    SCRIPTS.forEach(s => { comps[s] = describeList([], { add: ((n.comps && n.comps[s]) || []).concat((e.comps && e.comps[s] && e.comps[s].add) || []), off: [] }, keyAll); });
    niches.push({ id: n.id, name: e.name || n.name, def: false, off: false, comps });
  }
  return { gold, niches, bigBrands: describeList(base.bigBrands, diff.bigBrands, keyAll) };
}

/* ---------- القاموس الأساسي + لغات الأسواق الدولية ---------- */
// يضيف للأصل (الملف أو ما عدّله المدير) كلمات اللغات الدولية إن لم تكن فيه، فلا يضيع تعديل المدير ولا تنقص لغة.
function withMarkets(base) {
  const seed = MK.dictSeed(), out = Object.assign({}, base, { gold: Object.assign({}, base.gold) });
  for (const lg of MK.NEW_LANGS) if (!out.gold[lg]) out.gold[lg] = seed.gold[lg];
  out.niches = (base.niches || []).map(n => {
    const comps = Object.assign({}, n.comps);
    const sd = seed.comps[n.id] || {};
    for (const lg of MK.NEW_LANGS) if (!comps[lg]) comps[lg] = (sd[lg] || []).slice();
    return Object.assign({}, n, { comps });
  });
  return out;
}

/* ---------- فحص صلاحية المنتج قبل الحفظ ---------- */
// يُرفض إعلان الخدمة/الدورة/الفعالية/المحل/الشركة/التطبيق، والأكل والكبير والهش، بلغة الدولة المختارة.
function eligibility(row, ignore) { return PC.check(row, { country: row.country, ignore }); }

/* ---------- من إعلان خام إلى صف بأعمدة المنصة ---------- */
const cap = (s, n) => String(s == null ? '' : s).slice(0, n);
const U = u => (u ? S.safeUrl(u) : '');
const isoDay = sec => (sec ? new Date(sec * 1000).toISOString().slice(0, 10) : '');
const bar = a => (a || []).filter(Boolean).join(' | ');
const split = s => (s ? String(s).split(' | ').filter(Boolean) : []);
const union = (a, b, max) => { const o = []; for (const x of a.concat(b)) if (x && !o.includes(x)) o.push(x); return o.slice(-max); };

function rowFromRaw(raw, meta, nowMs) {
  const ad = S.normalizeAd(raw, meta.src === 'dom' ? 'dom' : 'net');
  if (!ad) return null;
  const nowS = Math.floor(nowMs / 1000), startS = ad.startTs || null, endS = ad.endTs || null;
  const q = cap(meta.query, 120), niche = cap(meta.niche, 60), country = cap(String(meta.country || '').toUpperCase().replace(/[^A-Z]/g, ''), 3);
  return {
    ad_id: String(ad.id), library_url: 'https://www.facebook.com/ads/library/?id=' + ad.id, page_id: cap(ad.pageId, 40), page_name: cap(ad.pageName, 200),
    page_url: cap(U(ad.pageUrl), 500), page_likes: Math.max(0, Math.min(2e9, ad.pageLikes || 0)),
    status: ad.isActive === true ? 'active' : ad.isActive === false ? 'inactive' : '',
    start_date: isoDay(startS), end_date: isoDay(endS), days_running: startS ? Math.max(0, Math.floor(((endS || nowS) - startS) / 86400)) : '',
    duplicates: Math.max(1, Math.min(9999, ad.collationCount || 1)), cta: cap(ad.ctaText, 60), cta_group: ad.ctaGroup || '', cta_type: cap(ad.ctaType, 40),
    page_categories: cap((ad.pageCategories || []).join(' | '), 200), country,
    format: ad.format, language: ad.lang, platforms: bar(ad.platforms), domain: cap(ad.domain, 120), link_url: cap(U(ad.link), 1000),
    title: cap(ad.title, 500), body: cap(ad.body, 6000), link_description: cap(ad.linkDescription, 800),
    image_url: cap(U(ad.thumb), 1200), video_url: cap(U(ad.videoUrl), 1200),
    search: q, search_terms: bar(q ? [q] : []), niche, niches: bar(niche ? [niche] : []),
    collected_at: new Date(nowMs).toISOString(), last_seen_at: new Date(nowMs).toISOString(), source: ad.source
  };
}
// دمج صف جديد في صف موجود لنفس الإعلان (إعادة رصد)
function mergeRow(old, nu) {
  const terms = bar(union(split(old.search_terms), split(nu.search_terms), 30)), niches = bar(union(split(old.niches), split(nu.niches), 12));
  if (old.source === 'net' && nu.source === 'dom') return Object.assign({}, old, { search_terms: terms, niches, last_seen_at: nu.last_seen_at });   // الشبكة أدق من قراءة الصفحة
  const out = Object.assign({}, nu, { collected_at: old.collected_at || nu.collected_at, search: old.search || nu.search, niche: old.niche || nu.niche, search_terms: terms, niches });
  ['image_url', 'video_url', 'link_url', 'page_url'].forEach(k => { if (!out[k]) out[k] = old[k] || ''; });
  if (!out.status && old.status) out.status = old.status;
  return out;
}

module.exports = { LANGS, TIERS, SCRIPTS, keyOf, keyAll, cleanDiff, applyList, effective, describe, rowFromRaw, mergeRow, withMarkets, eligibility };
