'use strict';
// حدود الاستعمال حسب الباقة: عمليات البحث في اليوم، منتجات الثغرات، طلبات الذكاء الاصطناعي في الشهر، صفحات المراقبة.
// الباقة = users.plan (اسمها في جدول plans). المدير بلا حدود. باقة بلا حدود محددة تأخذ القيم الافتراضية.
let db = null;
const NUM = (k, d) => { const n = Number(process.env[k]); return Number.isFinite(n) && n > 0 ? n : d; };
const DEF = () => ({ searchesPerDay: NUM('LIB_MAX_SEARCHES_PER_DAY', 60), gapProducts: 50, aiPerMonth: 100, watchPages: 20 });
const KEYS = ['searchesPerDay', 'gapProducts', 'aiPerMonth', 'watchPages'];
// مميزات تُفعَّل أو تُعطَّل لكل باقة من «العروض والمدفوعات ← العروض والمميزات» (البحث والتحليل متاحان لكل الباقات)
const FEATS = ['gap', 'supplier', 'ai', 'watch', 'tiktok', 'profit', 'alerts', 'sheets'];
const FLABEL = { gap: 'ثغرات السوق', supplier: 'إيجاد المورّد', ai: 'الذكاء الاصطناعي (تحليل الإعلان والخروج من المنافسة)', watch: 'مراقبة المنافسين', tiktok: 'اتجاهات TikTok', profit: 'حاسبة الربح', alerts: 'التنبيهات (بريد/تيليغرام)', sheets: 'التصدير إلى Google Sheets' };
function featuresOf(u) {
  if (!u || u.role === 'admin') return FEATS.slice();
  let hidden = new Set();   // ميزة مدمجة أخفاها المدير من صفحة الأسعار: ليست جزءاً من العرض، فهي متاحة للجميع
  try { hidden = new Set(db.prepare('select k from plan_features where builtin=1 and shown=0').all().map(r => r.k)); } catch (e) {}
  try { const p = db && db.prepare('select features from plans where name=?').get(u.plan); if (p && p.features) { const f = JSON.parse(p.features); if (Array.isArray(f)) return FEATS.filter(k => f.includes(k) || hidden.has(k)); } } catch (e) {}
  return FEATS.slice();   // باقة يدوية/قديمة بلا قائمة: كل المميزات
}
const has = (u, k) => featuresOf(u).includes(k);
const LABEL = { searchesPerDay: 'عمليات البحث في اليوم', gapProducts: 'منتجات «ثغرات السوق»', aiPerMonth: 'طلبات الذكاء الاصطناعي في الشهر', watchPages: 'صفحات المنافسين المراقبة' };
function init(d) {
  if (db) return; db = d;
  db.exec('create table if not exists ai_usage(user_id integer, month text, n integer default 0, primary key(user_id, month))');
}
const month = () => new Date().toISOString().slice(0, 7);
function limitsOf(u) {
  if (!u) return DEF();
  if (u.role === 'admin') return Object.fromEntries(KEYS.map(k => [k, Infinity]));
  let L = {};
  try { const p = db && db.prepare('select limits from plans where name=?').get(u.plan); if (p) L = JSON.parse(p.limits || '{}'); } catch (e) {}
  const d = DEF(); for (const k of KEYS) { if (L[k] == null || L[k] === '') continue; const v = Number(L[k]); if (v === -1) d[k] = Infinity; else if (Number.isFinite(v) && v >= 0) d[k] = v; }   // −1 = بلا حد، 0 = غير متاح
  return d;
}
const err = (m) => Object.assign(new Error(m), { status: 429 });
function usage(u) {
  const day = new Date().toISOString().slice(0, 10), q = (sql, ...a) => { try { return db.prepare(sql).get(...a) || {}; } catch (e) { return {}; } };
  return {
    searchesToday: q('select searches n from lib_usage where user_id=? and day=?', u.id, day).n || 0,
    aiMonth: q('select n from ai_usage where user_id=? and month=?', u.id, month()).n || 0,
    gapProducts: q('select count(*) n from gap_products where user_id=?', u.id).n || 0,
    watchPages: q('select count(*) n from watch_pages where user_id=?', u.id).n || 0
  };
}
// يُستدعى قبل كل طلب ذكاء اصطناعي: يرفض إن نفد الرصيد الشهري، وإلا يحتسبه
function useAI(u) {
  const L = limitsOf(u), m = month(), r = db.prepare('select n from ai_usage where user_id=? and month=?').get(u.id, m), n = r ? r.n : 0;
  if (!L.aiPerMonth) throw err('الذكاء الاصطناعي غير متاح في باقتك. رقِّ باقتك من «اشتراكي».');
  if (n >= L.aiPerMonth) throw err(`بلغت حد باقتك من طلبات الذكاء الاصطناعي هذا الشهر (${L.aiPerMonth}). رقِّ باقتك من «اشتراكي».`);
  db.prepare('insert into ai_usage(user_id,month,n) values(?,?,1) on conflict(user_id,month) do update set n=n+1').run(u.id, m);
}
// طلب ذكاء اصطناعي فشل (خطأ من المزوّد): لا يُحتسب
function refundAI(uid) { try { db.prepare('update ai_usage set n=max(0,n-1) where user_id=? and month=?').run(uid, month()); } catch (e) {} }
function check(u, key, current) {
  const L = limitsOf(u);
  if (!L[key]) throw err(`${LABEL[key]}: غير متاح في باقتك. رقِّ باقتك من «اشتراكي».`);
  if (current >= L[key]) throw err(`بلغت حد باقتك: ${LABEL[key]} (${L[key]}). رقِّ باقتك من «اشتراكي».`);
}
// الوقت المتبقي عند تغيير الباقة: يُحوَّل بنسبة السعر الشهري (20 يوماً في باقة بـ3900 = 11 يوماً في باقة بـ6900)،
// فلا تتحول أيام الباقة الأرخص إلى أيام كاملة في الأغلى. نفس الباقة أو التجربة المجانية أو باقة بلا سعر: يبقى كما هو.
function carryOver(u, newPlan, t) {
  const left = Math.max(0, (u.expires_at || 0) - t); if (!left || !newPlan || u.plan === newPlan) return left;
  try {
    const a = db.prepare('select price, free from plans where name=?').get(u.plan), b = db.prepare('select price from plans where name=?').get(newPlan);
    if (!a || !b || a.free || !(a.price > 0) || !(b.price > 0)) return left;
    return Math.round(left * a.price / b.price);
  } catch (e) { return left; }
}
module.exports = { init, carryOver, limitsOf, usage, useAI, refundAI, check, KEYS, LABEL, DEF, FEATS, FLABEL, featuresOf, has };
