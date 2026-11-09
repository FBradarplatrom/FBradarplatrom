'use strict';
// حدود الاستعمال حسب الباقة: عمليات البحث في اليوم، منتجات الثغرات، طلبات الذكاء الاصطناعي في الشهر، صفحات المراقبة.
// الباقة = users.plan (اسمها في جدول plans). المدير بلا حدود. باقة بلا حدود محددة تأخذ القيم الافتراضية.
let db = null;
const NUM = (k, d) => { const n = Number(process.env[k]); return Number.isFinite(n) && n > 0 ? n : d; };
const DEF = () => ({ searchesPerDay: NUM('LIB_MAX_SEARCHES_PER_DAY', 60), gapProducts: 50, aiPerMonth: 100, watchPages: 20 });
const KEYS = ['searchesPerDay', 'gapProducts', 'aiPerMonth', 'watchPages'];
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
  const d = DEF(); for (const k of KEYS) { const v = Number(L[k]); if (Number.isFinite(v) && v > 0) d[k] = v; }
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
  if (n >= L.aiPerMonth) throw err(`بلغت حد باقتك من طلبات الذكاء الاصطناعي هذا الشهر (${L.aiPerMonth}). رقِّ باقتك من «الإعدادات ← الاشتراك».`);
  db.prepare('insert into ai_usage(user_id,month,n) values(?,?,1) on conflict(user_id,month) do update set n=n+1').run(u.id, m);
}
function check(u, key, current) {
  const L = limitsOf(u);
  if (current >= L[key]) throw err(`بلغت حد باقتك: ${LABEL[key]} (${L[key]}). رقِّ باقتك من «الإعدادات ← الاشتراك».`);
}
module.exports = { init, limitsOf, usage, useAI, check, KEYS, LABEL, DEF };
