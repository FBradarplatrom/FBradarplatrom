'use strict';
// 🔔 التنبيهات بالبريد أو تيليغرام:
//  • ظهر منافس في الجزائر لمنتج في «ثغرات السوق» · إعلانات جديدة لصفحة منافس مراقبة · منتج جديد صار «💎 جوهرة»
//  • تأكيد الدفع وتفعيل الاشتراك · تذكير قبل انتهاء الاشتراك · (للمدير) طلبات دفع BaridiMob جديدة
// ربط تيليغرام: المشترك يفتح رابط البوت (t.me/البوت?start=رمز) ويضغط Start، ثم تقرأ المنصة الرسالة (getUpdates) فتعرف محادثته.
// لا يحتاج webhook ولا عنواناً عاماً، فيعمل على الاستضافة المشتركة.
const crypto = require('crypto');
const CFG = require('./config.js');
const EV = { gap: '🎯 ظهر منافس لمنتج تتابعه في «ثغرات السوق»', support: '💬 رد من فريق الدعم', watch: '👁 إعلانات جديدة لمنافس تراقبه', gem: '💎 منتج جديد صار «جوهرة» في تحليلك',
  payment: '💳 الدفع والاشتراك', expiry: '⏰ تذكير قبل انتهاء الاشتراك', admin: '🛠 للمدير: طلبات دفع جديدة' };
let db = null, mailer = null, sendMail = null, appName = 'رادار المنتجات الرابحة';
const now = () => Date.now();
const J = (s, d) => { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } };
const kvGet = (u, k, d) => { const r = db.prepare('select v from user_kv where user_id=? and k=?').get(u, k); return r ? J(r.v, d) : d; };
const kvSet = (u, k, v) => db.prepare('insert into user_kv(user_id,k,v) values(?,?,?) on conflict(user_id,k) do update set v=excluded.v').run(u, k, JSON.stringify(v));
const DEFP = () => ({ email: false, tg: false, chat: '', ev: { gap: true, watch: true, gem: true, payment: true, expiry: true, admin: true, support: true } });
const prefs = uid => { const p = Object.assign(DEFP(), kvGet(uid, 'notify', {})); p.ev = Object.assign(DEFP().ev, p.ev || {}); return p; };
const tgApi = () => (process.env.TELEGRAM_TEST_API || 'https://api.telegram.org') + '/bot' + CFG.get('telegram_token');
const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const appUrl = () => (CFG.get('app_url') || '').replace(/\/$/, '');

async function tgSend(chat, text) {
  if (!CFG.get('telegram_token') || !chat) throw new Error('تيليغرام غير مربوط');
  const r = await fetch(tgApi() + '/sendMessage', { method: 'POST', signal: AbortSignal.timeout(15000), headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true }) });
  const j = await r.json().catch(() => ({})); if (!j.ok) throw new Error(j.description || 'Telegram ' + r.status);
}
async function mailSend(to, subject, text, link) {
  const tr = mailer && mailer(); if (!tr) throw new Error('البريد غير مضبوط في الخادم');
  const msg = { to, subject: subject + ' | ' + appName, text: text + (link ? '\n\n' + link : ''),
    html: `<div dir="rtl" style="font-family:Tahoma,sans-serif;line-height:1.9;font-size:15px"><p>${esc(text).replace(/\n/g, '<br>')}</p>${link ? `<p><a href="${esc(link)}" style="background:#118553;color:#fff;padding:9px 18px;border-radius:8px;text-decoration:none">افتح في المنصة</a></p>` : ''}<p style="color:#888;font-size:12px">يمكنك إيقاف هذه التنبيهات من «الربط والتكامل».</p></div>` };
  if (sendMail) return sendMail(msg, 'notify');
  const i = await tr.sendMail(Object.assign({ from: process.env.SMTP_FROM || process.env.MAIL_FROM || process.env.SMTP_USER }, msg));
  if (process.env.SMTP_HOST === 'json') console.log('MAIL', i.message);
}
function log(uid, ev, text, via, ok) {
  try { db.prepare('insert into notify_log(user_id,at,ev,text,via,ok) values(?,?,?,?,?,?)').run(uid, now(), ev, String(text).slice(0, 500), via, ok ? 1 : 0);
    db.prepare('delete from notify_log where user_id=? and id not in (select id from notify_log where user_id=? order by id desc limit 100)').run(uid, uid); } catch (e) {}
}
// يرسل التنبيه عبر القنوات التي فعّلها المشترك لهذا النوع. لا يرمي أخطاء: يسجّلها فقط.
async function notify(uid, ev, text, path) {
  if (!db) return { sent: 0 };
  const u = db.prepare('select id,email from users where id=?').get(uid); if (!u) return { sent: 0 };
  const p = prefs(uid); if (ev !== 'test' && p.ev[ev] === false) return { sent: 0 };
  if (['gap', 'watch', 'gem', 'test'].includes(ev)) { const uu = db.prepare('select * from users where id=?').get(uid); if (uu && !require('./limits.js').has(uu, 'alerts')) return { sent: 0 }; }
  const link = path && appUrl() ? appUrl() + path : '', out = { sent: 0, errors: [] };
  const msg = text + (link ? '\n' + link : '');
  if (p.tg && p.chat) { try { await tgSend(p.chat, esc(msg)); out.sent++; log(uid, ev, text, 'telegram', 1); } catch (e) { out.errors.push('تيليغرام: ' + e.message); log(uid, ev, text + ' — ' + e.message, 'telegram', 0); } }
  if (p.email) { try { await mailSend(u.email, (EV[ev] || '🔔 تنبيه').replace(/^\S+\s/, ''), text, link); out.sent++; log(uid, ev, text, 'email', 1); } catch (e) { out.errors.push('البريد: ' + e.message); log(uid, ev, text + ' — ' + e.message, 'email', 0); } }
  if (!out.sent && !out.errors.length) log(uid, ev, text, 'app', 1);   // لا قناة مفعّلة: يبقى في سجل التنبيهات داخل المنصة
  return out;
}
const fire = (...a) => { notify(...a).catch(() => {}); };
const notifyAdmins = (text, path) => db.prepare("select id from users where role='admin'").all().forEach(a => fire(a.id, 'admin', text, path || '/payments'));

// ربط تيليغرام: رمز مؤقت ← رسالة /start رمز ← معرّف المحادثة
const LINKS = new Map(); let offset = 0, polling = null;
async function pollTg() {
  if (polling) return polling;
  polling = (async () => {
    const r = await fetch(tgApi() + '/getUpdates?timeout=0&allowed_updates=%5B%22message%22%5D' + (offset ? '&offset=' + offset : ''), { signal: AbortSignal.timeout(15000) });
    const j = await r.json().catch(() => ({})); if (!j.ok) throw new Error(j.description || 'Telegram ' + r.status);
    for (const up of j.result || []) {
      offset = Math.max(offset, up.update_id + 1);
      const m = up.message || {}, t = String(m.text || '').trim(), mm = /^\/start\s+([a-f0-9]{16})$/.exec(t);
      if (!mm || !m.chat) continue;
      const L = LINKS.get(mm[1]); if (!L || L.exp < now()) continue;
      LINKS.delete(mm[1]);
      const p = prefs(L.uid); p.chat = String(m.chat.id); p.tg = true; kvSet(L.uid, 'notify', p);
      tgSend(p.chat, '✅ تم ربط حسابك في «' + appName + '». ستصلك التنبيهات هنا.').catch(() => {});
    }
  })().finally(() => { polling = null; });
  return polling;
}

module.exports = function mountNotify(app, X) {
  const { auth, active, admin, wrap } = X; db = X.db; mailer = X.mailer; sendMail = X.sendMail;
  db.exec(`create table if not exists user_kv(user_id integer, k text, v text, primary key(user_id, k));
create table if not exists notify_log(id integer primary key, user_id integer, at integer, ev text, text text, via text, ok integer);
create index if not exists notify_log_u on notify_log(user_id, id);`);
  const bad = (m, c) => Object.assign(new Error(m), { status: c || 400 });
  const view = u => { const p = prefs(u.id), bot = CFG.get('telegram_bot').replace(/^@/, '');
    return { email: u.email, smtp: !!(mailer && process.env.SMTP_HOST), tg: { available: !!(CFG.get('telegram_token') && bot), linked: !!p.chat, bot }, prefs: { email: p.email, tg: p.tg, ev: p.ev },
      events: Object.fromEntries(Object.entries(EV).filter(([k]) => k !== 'admin' || u.role === 'admin')),
      log: db.prepare('select at,ev,text,via,ok from notify_log where user_id=? order by id desc limit 15').all(u.id) }; };
  app.get('/api/notify', auth, wrap((q, s) => s.json(view(q.u))));
  app.put('/api/notify', auth, wrap((q, s) => {
    const b = q.body || {}, p = prefs(q.u.id);
    if (b.email !== undefined) p.email = !!b.email;
    if (b.tg !== undefined) p.tg = !!b.tg && !!p.chat;
    if (b.ev && typeof b.ev === 'object') for (const k of Object.keys(EV)) if (b.ev[k] !== undefined) p.ev[k] = !!b.ev[k];
    kvSet(q.u.id, 'notify', p); s.json(view(q.u));
  }));
  app.post('/api/notify/tg/link', auth, wrap((q, s) => {
    const bot = CFG.get('telegram_bot').replace(/^@/, ''); if (!CFG.get('telegram_token') || !bot) throw bad('بوت تيليغرام غير مضبوط بعد (يضبطه المدير من «الربط والتكامل»)');
    for (const [c, L] of LINKS) if (L.uid === q.u.id || L.exp < now()) LINKS.delete(c);
    const code = crypto.randomBytes(8).toString('hex'); LINKS.set(code, { uid: q.u.id, exp: now() + 15 * 60e3 });
    s.json({ url: 'https://t.me/' + encodeURIComponent(bot) + '?start=' + code, code });
  }));
  app.post('/api/notify/tg/check', auth, async (q, s, n) => {
    try { if (!prefs(q.u.id).chat) await pollTg(); s.json({ linked: !!prefs(q.u.id).chat }); } catch (e) { n(bad('تعذّر الاتصال بتيليغرام: ' + e.message, 502)); }
  });
  app.delete('/api/notify/tg', auth, wrap((q, s) => { const p = prefs(q.u.id); p.chat = ''; p.tg = false; kvSet(q.u.id, 'notify', p); s.json(view(q.u)); }));
  app.post('/api/notify/test', auth, async (q, s, n) => {
    try { const p = prefs(q.u.id); if (!p.email && !(p.tg && p.chat)) throw bad('فعّل البريد أو تيليغرام أولاً');
      const r = await notify(q.u.id, 'test', '🔔 تنبيه تجريبي: التنبيهات تعمل.', '/integrations'); s.json(r); } catch (e) { n(e); }
  });
  // منتجات صارت «جوهرة» في تحليل المتصفح: تُنبَّه مرة واحدة لكل منتج
  app.post('/api/notify/gems', auth, active, wrap((q, s) => {
    const items = (Array.isArray(q.body && q.body.items) ? q.body.items : []).slice(0, 30).map(x => ({ name: String(x && x.name || '').trim().slice(0, 120), score: +x.score || 0 })).filter(x => x.name);
    const seen = kvGet(q.u.id, 'gems_seen', []), set = new Set(seen), fresh = items.filter(x => !set.has(x.name.toLowerCase()));
    if (fresh.length) {
      kvSet(q.u.id, 'gems_seen', seen.concat(fresh.map(x => x.name.toLowerCase())).slice(-3000));
      fire(q.u.id, 'gem', '💎 ' + (fresh.length > 1 ? fresh.length + ' منتجات جديدة صارت «جوهرة»:\n' : 'منتج جديد صار «جوهرة»: ') + fresh.slice(0, 8).map(x => '• ' + x.name + ' (' + x.score + ')').join('\n'), '/inbox');
    }
    s.json({ fresh: fresh.length });
  }));

  // تذكير قبل انتهاء الاشتراك (3 أيام): مرة لكل تاريخ انتهاء
  const remind = () => { try {
    const t = now(); for (const u of db.prepare("select id,expires_at from users where role!='admin' and expires_at>? and expires_at<?").all(t, t + 3 * 864e5)) {
      if (kvGet(u.id, 'exp_note', 0) === u.expires_at) continue; kvSet(u.id, 'exp_note', u.expires_at);
      fire(u.id, 'expiry', '⏰ اشتراكك ينتهي خلال ' + Math.max(1, Math.ceil((u.expires_at - t) / 864e5)) + ' يوم. جدّده الآن من «اشتراكي» حتى لا يتوقف عملك.', '/subscription');
    } } catch (e) {} };
  setTimeout(remind, 30e3).unref(); setInterval(remind, 6 * 36e5).unref();
  return { notify: fire, notifyNow: notify, notifyAdmins, remind };
};
module.exports.EV = EV;
module.exports.fire = (...a) => { if (db) notifyFire(...a); };
function notifyFire(...a) { notify(...a).catch(() => {}); }
