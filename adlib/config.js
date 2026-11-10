'use strict';
// إعدادات المنصة التي يضبطها المدير من «الربط والتكامل» (مفاتيح الذكاء الاصطناعي، بوابة الدفع، بوت تيليغرام…).
// تُخزَّن في قاعدة البيانات، والأسرار مشفّرة (AES-GCM بمفتاح مشتق من JWT_SECRET). إن لم تُضبط يُقرأ متغير البيئة المقابل.
const ENV = { openai_key: 'OPENAI_API_KEY', openai_model: 'OPENAI_MODEL', openai_base: 'OPENAI_BASE_URL', satim_user: 'SATIM_USER', satim_pass: 'SATIM_PASSWORD', satim_terminal: 'SATIM_TERMINAL_ID', satim_mode: 'SATIM_MODE',
  stripe_secret: 'STRIPE_SECRET_KEY', stripe_webhook: 'STRIPE_WEBHOOK_SECRET', paypal_client: 'PAYPAL_CLIENT_ID', paypal_secret: 'PAYPAL_SECRET', paypal_mode: 'PAYPAL_MODE',
  telegram_token: 'TELEGRAM_BOT_TOKEN', telegram_bot: 'TELEGRAM_BOT_USERNAME', baridi_info: 'BARIDI_INFO', app_url: 'APP_URL',
  biz_name: 'BIZ_NAME', biz_country: 'BIZ_COUNTRY', biz_address: 'BIZ_ADDRESS', support_email: 'SUPPORT_EMAIL', support_whatsapp: 'SUPPORT_WHATSAPP', refund_days: 'REFUND_DAYS', legal_updated: 'LEGAL_UPDATED', ga_id: 'GA_ID', meta_pixel: 'META_PIXEL_ID' };
const SECRET = new Set(['openai_key', 'satim_pass', 'stripe_secret', 'stripe_webhook', 'paypal_secret', 'telegram_token']);
let db = null, enc = null, dec = null, cache = null;
function init(d, e, x) {
  if (db) return; db = d; enc = e; dec = x;
  db.exec('create table if not exists settings(k text primary key, v text)');
}
const load = () => { if (!cache) { cache = new Map(); if (db) for (const r of db.prepare('select k,v from settings').all()) cache.set(r.k, SECRET.has(r.k) && dec ? dec(r.v) || '' : r.v); } return cache; };
// قيم افتراضية للمنصة (تُغيَّر من «الربط والتكامل»)
const DEF = { support_whatsapp: '+213664442637', app_url: 'https://winningproductradar.com', legal_updated: '2026-11-10' };
function get(k) { const v = load().get(k); if (v) return v; const e = ENV[k]; return e && process.env[e] ? process.env[e] : (DEF[k] || ''); }
function set(k, v) {
  if (!db) throw new Error('config');
  v = String(v == null ? '' : v).trim();
  if (!v) db.prepare('delete from settings where k=?').run(k);
  else db.prepare('insert into settings(k,v) values(?,?) on conflict(k) do update set v=excluded.v').run(k, SECRET.has(k) && enc ? enc(v) : v);
  cache = null;
}
// للعرض: الأسرار مخفية (آخر 4 أحرف فقط)
function view() {
  const out = {};
  for (const k of Object.keys(ENV)) { const v = get(k), fromDb = load().has(k); out[k] = { set: !!v, source: v ? (fromDb ? 'platform' : 'env') : '', value: SECRET.has(k) ? (v ? '••••' + v.slice(-4) : '') : v }; }
  return out;
}
module.exports = { init, get, set, view, SECRET, KEYS: Object.keys(ENV) };
