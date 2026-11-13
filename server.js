'use strict';
try { require('fs').readFileSync(require('path').join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach(l => {
  const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2');
}); } catch (e) {}
const express = require('express'), bcrypt = require('bcryptjs'),
  jwt = require('jsonwebtoken'), cookie = require('cookie-parser'), crypto = require('crypto'), dns = require('dns'), fs = require('fs'), path = require('path');
const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 24) { console.error('JWT_SECRET (24+ chars) is required'); process.exit(1); }
// أمان: رمز الجلسة فقط (لا يُقبل رمز «بانتظار التحقق بخطوتين» ككوكي جلسة)، وخوارزمية التوقيع مثبتة
const JWTO = { algorithms: ['HS256'] };
const session = tok => { const t = jwt.verify(tok, SECRET, JWTO); if (t.p) throw new Error('not a session'); return t; };
const ADMIN = (process.env.ADMIN_EMAIL || '').toLowerCase(), DAY = 864e5, now = () => Date.now();
const contactUrl = () => { const w = String(require('./adlib/config.js').get('support_whatsapp') || '').replace(/[^\d]/g, ''); return process.env.CONTACT_URL || (w ? 'https://wa.me/' + w : '') || (process.env.ADMIN_EMAIL ? 'mailto:' + process.env.ADMIN_EMAIL : ''); };   // واتساب هو قناة التواصل الأساسية
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const zlib = require('zlib');
// الأداء: ضغط gzip لكل رد نصي (الصفحة، السكربتات، JSON). دفعة 5000 إعلان: 4.5 ميغا → نحو 0.4 ميغا.
function gzip(q, s, n) {
  if (q.method === 'HEAD' || !/\bgzip\b/.test(q.headers['accept-encoding'] || '')) return n();
  const write = s.write.bind(s), end = s.end.bind(s); let gz = null, decided = false;
  const decide = () => {
    if (decided) return; decided = true;
    const ct = String(s.getHeader('content-type') || ''), len = +s.getHeader('content-length') || 0;
    if (s.statusCode < 200 || s.statusCode === 204 || s.statusCode === 304 || s.getHeader('content-encoding') || !/json|text|javascript|svg|xml/.test(ct) || (len && len < 1024)) return;
    gz = zlib.createGzip({ level: 6 }); s.setHeader('Content-Encoding', 'gzip'); s.removeHeader('Content-Length'); s.setHeader('Vary', 'Accept-Encoding');
    gz.on('data', c => write(c)); gz.on('end', () => end());
  };
  const buf = (c, e) => (typeof c === 'string' ? Buffer.from(c, typeof e === 'string' ? e : 'utf8') : c);
  s.write = (c, e, cb) => { decide(); if (!gz) return write(c, e, cb); gz.write(buf(c, e)); if (typeof e === 'function') e(); else if (cb) cb(); return true; };
  s.end = (c, e, cb) => { if (typeof c === 'function') { cb = c; c = null; } decide(); if (!gz) return end(c, e, cb); if (c) gz.write(buf(c, e)); gz.end(); if (typeof e === 'function') s.once('finish', e); else if (cb) s.once('finish', cb); return s; };
  n();
}

const DBF = process.env.DB_FILE || 'data.db';
let db;
try {
  if (process.env.DB_DRIVER === 'node') throw new Error('forced');
  db = new (require('better-sqlite3'))(DBF);
} catch (e) {
  db = new (require('node:sqlite').DatabaseSync)(DBF);   // مدمج في Node 22.5+، بلا تجميع
  console.log('DB driver: node:sqlite');
}
db.exec(`
create table if not exists users(id integer primary key, email text unique, hash text, role text default 'member',
  plan text default 'none', expires_at integer default 0, api_hash text unique, created_at integer);
create table if not exists runs(id integer primary key, user_id integer, source text, label text, ads integer,
  summary text, rows text, created_at integer);
create index if not exists runs_u on runs(user_id, created_at);
create table if not exists resets(h text primary key, user_id integer, exp integer);
create table if not exists saved(user_id integer, k text, snap text, created_at integer, primary key(user_id, k));
create table if not exists lib_rows(run_id integer, ad_id text, row text, primary key(run_id, ad_id));
create table if not exists activity(id integer primary key, user_id integer, kind text, ip text, ua text, detail text, at integer);
create index if not exists activity_u on activity(user_id, at);`);
try { db.exec('alter table users add column tv integer default 0'); } catch (e) {}
try { db.exec('alter table users add column phone text'); } catch (e) {}   // رقم الهاتف / واتساب (اختياري): ليتواصل معه المدير
['totp_secret text', 'totp_on integer default 0', 'totp_recovery text'].forEach(c => { try { db.exec('alter table users add column ' + c); } catch (e) {} });   // التحقق بخطوتين
try { db.exec('alter table runs add column batch text'); } catch (e) {}   // دفعة الجمع (لأرقام صفحة التحليل)
// إعدادات المنصة المشفّرة (المفاتيح) وحدود الباقات
require('./adlib/config.js').init(db, t => enc(t), t => dec(t));
require('./adlib/limits.js').init(db);
// الأداء: إعلانات «جمع الإعلانات» تُخزَّن صفاً لكل إعلان (lib_rows) بدل إعادة كتابة الدفعة كلها مع كل 60 إعلاناً.
// runs.rows = '@lib' يعني أن صفوف الدفعة في lib_rows. الملفات المرفوعة والأرشيف القديم يبقيان JSON كما هما.
const LIB = '@lib';
const rowsJson = r => r.rows === LIB ? '[' + db.prepare('select row from lib_rows where run_id=? order by rowid').all(r.id).map(x => x.row).join(',') + ']' : (r.rows || '[]');

const cols = t => db.prepare(`pragma table_info(${t})`).all().map(c => c.name);
[['users', 'name text'], ['users', 'username text'], ['users', 'api_enc text'], ['runs', 'counts text'], ['runs', 'fp text']]
  .forEach(([t, c]) => { if (!cols(t).includes(c.split(' ')[0])) db.exec(`alter table ${t} add column ${c}`); });
db.exec('create unique index if not exists users_un on users(username) where username is not null');
const EK = crypto.createHash('sha256').update('apikey:' + SECRET).digest();   // تشفير المفتاح المحفوظ
const enc = t => { const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', EK, iv), b = Buffer.concat([c.update(t, 'utf8'), c.final()]); return Buffer.concat([iv, c.getAuthTag(), b]).toString('base64'); };
const dec = x => { try { const b = Buffer.from(x, 'base64'), d = crypto.createDecipheriv('aes-256-gcm', EK, b.subarray(0, 12), { authTagLength: 16 }); d.setAuthTag(b.subarray(12, 28)); return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'); } catch (e) { return null; } };
const app = express();
app.disable('x-powered-by'); app.set('trust proxy', 1);
app.use(gzip);
// الأمان: ترويسات تمنع تضمين المنصة في مواقع أخرى (clickjacking) وتخمين أنواع الملفات وتسريب الروابط
app.use((q, s, n) => { s.set({ 'X-Frame-Options': 'DENY', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' }); if (q.secure) s.set('Strict-Transport-Security', 'max-age=15552000'); n(); });
app.use(cookie());
// الحماية من الإغراق بالطلبات: حد لكل مشترك مسجّل (600 طلب/دقيقة) ولكل عنوان للزوار (120/دقيقة) على /api فقط.
// المسجّل يُحسب بحسابه لا بعنوانه (مشتركو الجوال قد يخرجون بنفس العنوان). الصفحات والملفات لا تُحسب. القيم قابلة للتعديل من .env
const RL = new Map(), RL_USER = +process.env.RATE_USER_PER_MIN || 600, RL_ANON = +process.env.RATE_ANON_PER_MIN || 120;
setInterval(() => { const t = now(); for (const [k, v] of RL) if (t - v.at >= 6e4) RL.delete(k); }, 6e4).unref();
app.use('/api', (q, s, n) => {
  if (q.path.startsWith('/billing/webhook')) return n();                        // بوابات الدفع تُرسل من خوادمها
  let k, max; try { k = 'u' + session(q.cookies.t).id; max = RL_USER; } catch (e) { k = 'i' + q.ip; max = RL_ANON; }
  const t = now(); let v = RL.get(k); if (!v || t - v.at >= 6e4) { v = { at: t, n: 0 }; RL.set(k, v); }
  if (++v.n > max) { s.set('Retry-After', String(Math.ceil((v.at + 6e4 - t) / 1000))); return s.status(429).json({ error: 'طلبات كثيرة جداً، انتظر دقيقة ثم أعد المحاولة' }); }
  n();
});
// حجم الطلب: 2MB عادةً، و50MB فقط لمسارات رفع الإعلانات (الإضافة) وصور الوصل والإدارة
const BIG = /^\/api\/(runs|lib\/|gap\/|watch\/|tt\/|edge|saved|billing\/baridi|admin\/)/;
const jsonOpt = l => express.json({ limit: l, verify: (q, s, buf) => { if (q.url.startsWith('/api/billing/webhook')) q.rawBody = buf; } });   // الجسم الخام لتحقق توقيع بوابة الدفع
const jBig = jsonOpt('50mb'), jSmall = jsonOpt('2mb');
app.use((q, s, n) => (BIG.test(q.path) ? jBig : jSmall)(q, s, n));
app.use('/api', (q, s, n) => { s.set('Cache-Control', 'no-store'); n(); });
// ---------- وضع الصيانة: الزوار والمشتركون يرون صفحة الصيانة (503)، والمدير يعمل عادياً ----------
// مفتوح دائماً: صفحة الدخول (ليدخل المدير)، الصفحات القانونية، الملفات الثابتة، وإشعارات بوابات الدفع (حتى لا يضيع دفع)
const MAINT_HTML = fs.readFileSync(path.join(__dirname, 'views', 'maint.html'), 'utf8'), CFGM = require('./adlib/config.js');
const maintOn = () => CFGM.get('maint_on') === '1';
const MAINT_OPEN = /^\/(login|forgot|reset|terms|privacy|refund|contact|fonts\/|radar-lib\/|api\/(login|logout|health|legal\/info|maint\/info|billing\/(webhook|return))|[\w.-]+\.(js|css|svg|png|ico|woff2|txt|map)$)/;
app.use((q, s, n) => {
  if (!maintOn() || MAINT_OPEN.test(q.path)) return n();
  const u = optUser(q), r = u && db.prepare('select role from users where id=?').get(u.id); if (r && r.role === 'admin') return n();
  s.set({ 'Retry-After': '1800', 'Cache-Control': 'no-store' });
  if (q.path.startsWith('/api/')) return s.status(503).json({ error: 'المنصة في صيانة قصيرة، نعود قريباً', maint: true });
  s.status(503).type('html').send(MAINT_HTML);
});
app.get('/api/maint/info', (q, s) => s.json({ on: maintOn(), msg: CFGM.get('maint_msg') || '', until: CFGM.get('maint_until') || '', whatsapp: CFGM.get('support_whatsapp') || '' }));
   // البيانات حيّة: لا تُخزَّن في المتصفح (تظهر فور وصولها)


const wrap = h => (q, s, n) => { try { h(q, s, n); } catch (e) { n(e); } };
// حدود المحاولات: لكل عنوان IP، ولكل حساب (ضد التخمين من أجهزة كثيرة)، وللتسجيل (ضد الحسابات الوهمية)
const fails = new Map();
const blocked = (k, max, win) => { const f = fails.get(k); return !!(f && f.n >= (max || 10) && now() - f.t < (win || 9e5)); };
const fail = (k, win) => { const f = fails.get(k); fails.set(k, { n: (f && now() - f.t < (win || 9e5) ? f.n : 0) + 1, t: now() }); };
setInterval(() => { const t = now(); fails.forEach((f, k) => { if (t - f.t > 36e5) fails.delete(k); }); }, 36e5).unref();
// سجل النشاط: الدخول، المحاولات الفاشلة، تغيير كلمة المرور، إجراءات المدير
const act = (uid, kind, q, detail) => { try { db.prepare('insert into activity(user_id,kind,ip,ua,detail,at) values(?,?,?,?,?,?)').run(uid || null, kind, (q && q.ip) || '', String((q && q.get && q.get('user-agent')) || '').slice(0, 160), String(detail || '').slice(0, 300), now()); } catch (e) {} };
// tv = إصدار الجلسة: تغيير كلمة المرور يرفعه فتُغلق الجلسات على الأجهزة الأخرى
const login = (s, id) => s.cookie('t', jwt.sign({ id, v: (db.prepare('select tv from users where id=?').get(id) || {}).tv || 0 }, SECRET, { expiresIn: '30d' }),
  { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' || !!(s.req && s.req.secure), maxAge: 30 * DAY });

function auth(q, s, n) {
  let u;   // الدخول بالكوكي فقط (لا مفاتيح خارجية: الإضافة تتصل عبر صفحة المنصة نفسها)
  try { const t = session(q.cookies.t); u = db.prepare('select * from users where id=?').get(t.id); if (u && (t.v || 0) !== (u.tv || 0)) u = null; } catch (e) {}
  if (!u) return s.status(401).json({ error: 'auth' });
  q.u = u; n();
}
const isActive = u => u.role === 'admin' || u.expires_at > now();
const active = (q, s, n) => isActive(q.u) ? n() : s.status(402).json({ error: 'انتهى الاشتراك' });
const admin = (q, s, n) => q.u.role === 'admin' ? n() : s.sendStatus(403);

// ---------- الحسابات ----------
const UN = /^[a-z0-9_.]{3,30}$/;
app.post('/api/register', wrap((q, s) => {
  if (blocked('r:' + q.ip, 5, 36e5)) return s.status(429).json({ error: 'حسابات كثيرة من نفس الجهاز، أعد المحاولة بعد ساعة' });
  const { email = '', password = '', name = '', username = '' } = q.body || {}, em = String(email).toLowerCase().trim(), un = String(username).toLowerCase().trim();
  if (!/^\S+@\S+\.\S+$/.test(em) || String(password).length < 8) return s.status(400).json({ error: 'بريد غير صالح أو كلمة مرور أقل من 8 أحرف' });
  if (un && !UN.test(un)) return s.status(400).json({ error: 'اسم المستخدم: 3 إلى 30 حرفاً لاتينياً أو أرقاماً أو _ .' });
  if (db.prepare('select 1 from users where email=?').get(em)) return s.status(409).json({ error: 'البريد مسجّل مسبقاً' });
  if (un && db.prepare('select 1 from users where username=?').get(un)) return s.status(409).json({ error: 'اسم المستخدم مستعمل' });
  // ADMIN_EMAIL يصبح مديراً فقط إن لم يوجد مدير بعد (وإلا يستطيع أي شخص أخذه بعد أن يغيّر المدير بريده)
  const isAdm = em === ADMIN && !db.prepare("select 1 from users where role='admin'").get();
  const id = db.prepare('insert into users(email,hash,role,expires_at,created_at,name,username) values(?,?,?,?,?,?,?)')
    .run(em, bcrypt.hashSync(String(password), 10), isAdm ? 'admin' : 'member', now() + (+process.env.TRIAL_DAYS || 0) * DAY, now(), String(name).trim().slice(0, 60), un || null).lastInsertRowid;
  // الباقة المجانية لتجربة المنصة (من «إدارة المشتركين ← الباقات»): مدتها وحدودها تُطبَّق فوراً
  try { const tp = !isAdm && db.prepare('select name, days from plans where free=1 and active=1 order by sort limit 1').get(); if (tp) db.prepare('update users set plan=?, expires_at=? where id=?').run(tp.name, now() + tp.days * DAY, id); } catch (e) {}
  fail('r:' + q.ip, 36e5); act(id, 'register', q); login(s, id); s.json({ ok: 1 });
}));
app.post('/api/login', wrap((q, s) => {
  const { email = '', password = '' } = q.body || {}, l = String(email).toLowerCase().trim();
  if (blocked(q.ip) || blocked('a:' + l, 8)) return s.status(429).json({ error: 'محاولات كثيرة، أعد المحاولة بعد 15 دقيقة' });
  const u = db.prepare('select * from users where email=? or username=?').get(l, l);
  if (!u || !bcrypt.compareSync(String(password), u.hash)) { fail(q.ip); fail('a:' + l); if (u) act(u.id, 'login_fail', q); return s.status(401).json({ error: 'بيانات الدخول غير صحيحة' }); }
  fails.delete(q.ip); fails.delete('a:' + l);
  if (u.totp_on) { act(u.id, 'login_pw', q); return s.json({ need2fa: true, t: jwt.sign({ id: u.id, p: '2fa', v: u.tv || 0 }, SECRET, { expiresIn: '5m' }) }); }   // كلمة المرور صحيحة، بقي رمز التطبيق
  act(u.id, 'login', q); login(s, u.id); s.json({ ok: 1 });
}));
// الخطوة الثانية: رمز تطبيق المصادقة أو رمز استرجاع (لمرة واحدة)
app.post('/api/login/2fa', wrap((q, s) => {
  if (blocked('2fa:' + q.ip, 8)) return s.status(429).json({ error: 'محاولات كثيرة، أعد المحاولة بعد 15 دقيقة' });
  let t; try { t = jwt.verify(String((q.body || {}).t || ''), SECRET, JWTO); } catch (e) { return s.status(401).json({ error: 'انتهت المهلة، سجّل الدخول من جديد' }); }
  const u = t && t.p === '2fa' && db.prepare('select * from users where id=?').get(t.id);
  if (!u || !u.totp_on || (t.v || 0) !== (u.tv || 0)) return s.status(401).json({ error: 'انتهت المهلة، سجّل الدخول من جديد' });
  const code = String((q.body || {}).code || '').trim().toLowerCase(), TOTP = require('./adlib/totp.js');
  let ok = TOTP.verify(u.totp_secret, code);
  if (!ok && /^[0-9a-f]{5}-[0-9a-f]{5}$/.test(code)) {                          // رمز استرجاع: يُستهلك
    const L = JSON.parse(u.totp_recovery || '[]'), h = TOTP.sha(code), i = L.indexOf(h);
    if (i >= 0) { L.splice(i, 1); db.prepare('update users set totp_recovery=? where id=?').run(JSON.stringify(L), u.id); ok = true; act(u.id, '2fa_recovery', q); }
  }
  if (!ok) { fail('2fa:' + q.ip); act(u.id, 'login_fail', q, '2fa'); return s.status(400).json({ error: 'الرمز غير صحيح' }); }
  fails.delete('2fa:' + q.ip); act(u.id, 'login', q, '2fa'); login(s, u.id); s.json({ ok: 1 });
}));
// إعداد التحقق بخطوتين من «أمان الحساب»
app.post('/api/2fa/setup', auth, wrap((q, s) => {
  if (q.u.totp_on) return s.status(400).json({ error: 'التحقق بخطوتين مفعّل مسبقاً' });
  const T = require('./adlib/totp.js'), sec = T.secret();
  db.prepare('update users set totp_secret=? where id=?').run(sec, q.u.id);
  s.json({ secret: sec, uri: T.uri(sec, q.u.email, 'Winning Product Radar') });
}));
app.post('/api/2fa/enable', auth, wrap((q, s) => {
  const T = require('./adlib/totp.js');
  if (q.u.totp_on) return s.status(400).json({ error: 'التحقق بخطوتين مفعّل مسبقاً' });
  if (!T.verify(q.u.totp_secret, (q.body || {}).code)) return s.status(400).json({ error: 'الرمز غير صحيح. تأكد من وقت هاتفك ثم أعد المحاولة.' });
  const codes = T.recovery();
  db.prepare('update users set totp_on=1, totp_recovery=?, tv=coalesce(tv,0)+1 where id=?').run(JSON.stringify(codes.map(T.sha)), q.u.id);   // يُخرج الأجهزة الأخرى
  act(q.u.id, '2fa_on', q); login(s, q.u.id); s.json({ ok: 1, recovery: codes });
}));
app.post('/api/2fa/disable', auth, wrap((q, s) => {
  const b = q.body || {}, T = require('./adlib/totp.js');
  if (!bcrypt.compareSync(String(b.password || ''), q.u.hash)) return s.status(400).json({ error: 'كلمة المرور غير صحيحة' });
  if (q.u.totp_on && !T.verify(q.u.totp_secret, b.code)) return s.status(400).json({ error: 'الرمز غير صحيح' });
  db.prepare('update users set totp_on=0, totp_secret=null, totp_recovery=null where id=?').run(q.u.id);
  act(q.u.id, '2fa_off', q); s.json({ ok: 1 });
}));
app.post('/api/logout', (q, s) => { s.clearCookie('t'); s.json({ ok: 1 }); });
// تسجيل الخروج من كل الأجهزة
app.post('/api/logout-all', auth, wrap((q, s) => { db.prepare('update users set tv=coalesce(tv,0)+1 where id=?').run(q.u.id); act(q.u.id, 'logout_all', q); s.clearCookie('t'); s.json({ ok: 1 }); }));
app.get('/api/activity', auth, wrap((q, s) => s.json(db.prepare("select kind,ip,ua,at from activity where user_id=? and kind in ('login','login_fail','password','reset','logout_all') order by at desc limit 15").all(q.u.id))));
app.get('/api/me', auth, (q, s) => s.json({ maint: q.u.role === 'admin' && maintOn(), email: q.u.email, name: q.u.name || '', username: q.u.username || '', phone: q.u.phone || '', role: q.u.role, plan: q.u.plan, expires_at: q.u.expires_at, active: isActive(q.u), features: require('./adlib/limits.js').featuresOf(q.u), contact: contactUrl(), totp_on: !!q.u.totp_on, recovery_left: q.u.totp_on ? JSON.parse(q.u.totp_recovery || '[]').length : 0, gap_target: (() => { try { return JSON.parse((db.prepare("select v from user_kv where user_id=? and k='gap_target'").get(q.u.id) || {}).v || '"DZ"'); } catch (e) { return 'DZ'; } })() }));
app.put('/api/profile', auth, wrap((q, s) => {
  const b = q.body || {}, name = String(b.name || '').trim().slice(0, 60), un = String(b.username || '').trim().toLowerCase(), em = String(b.email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(em)) return s.status(400).json({ error: 'بريد غير صالح' });
  if (un && !UN.test(un)) return s.status(400).json({ error: 'اسم المستخدم: 3 إلى 30 حرفاً لاتينياً أو أرقاماً أو _ .' });
  if (em !== q.u.email) {
    if (!bcrypt.compareSync(String(b.password || ''), q.u.hash)) return s.status(400).json({ error: 'أدخل كلمة المرور الحالية لتأكيد تغيير البريد' });
    if (db.prepare('select 1 from users where email=? and id!=?').get(em, q.u.id)) return s.status(409).json({ error: 'البريد مستعمل لحساب آخر' });
  }
  if (un && db.prepare('select 1 from users where username=? and id!=?').get(un, q.u.id)) return s.status(409).json({ error: 'اسم المستخدم مستعمل' });
  const ph = String(b.phone == null ? (q.u.phone || '') : b.phone).replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '').slice(0, 20);
  if (ph && !/^\+?\d{8,15}$/.test(ph)) return s.status(400).json({ error: 'رقم الهاتف: 8 إلى 15 رقماً، ويُفضّل بالرمز الدولي (مثل +213…)' });
  db.prepare('update users set name=?, username=?, email=?, phone=? where id=?').run(name, un || null, em, ph || null, q.u.id); s.json({ ok: 1 });
}));

// ---------- التحليلات والأرشيف ----------
// بصمة المحتوى: مجموعة معرّفات الإعلانات. الملف نفسه (أو نفس الإعلانات) يُؤرشف مرة واحدة
const fpOf = rows => sha(rows.map(r => { const lo = {}; if (r && typeof r === 'object') for (const k in r) lo[String(k).toLowerCase().trim()] = r[k];
  const id = [lo.ad_id, lo.id, lo.adid, lo.ad_archive_id, lo.library_url, lo.ad_url].find(x => x != null && x !== '');
  return String(id != null ? id : String(lo.body || lo.text || lo.ad_text || lo.primary_text || '').slice(0, 80) + '|' + String(lo.page_name || lo.advertiser || lo.page || '') + '|' + String(lo.start_date || lo.start || '')); }).sort().join('\n'));
const ins = db.prepare('insert into runs(user_id,source,label,ads,rows,created_at,fp) values(?,?,?,?,?,?,?)');
const addRun = (u, source, label, rows) => ins.run(u.id, source, String(label || source).slice(0, 200), rows.length, JSON.stringify(rows), now(), fpOf(rows)).lastInsertRowid;
const arr = (s, m) => { if (!Array.isArray(s)) throw Object.assign(new Error(m), { status: 400 }); return s; };

app.get('/api/runs', auth, active, wrap((q, s) => {
  s.json(db.prepare('select r.id,r.source,r.label,r.ads,r.summary,r.counts,r.created_at,(select count(*) from lib_bfilt f where f.user_id=r.user_id and f.batch_id=r.batch) filtered from runs r where r.user_id=? order by r.created_at desc limit 300').all(q.u.id)
    .map(r => ({ ...r, summary: r.summary ? JSON.parse(r.summary) : null, counts: r.counts ? JSON.parse(r.counts) : null })));
}));
app.get('/api/runs/:id', auth, active, wrap((q, s) => {
  const r = db.prepare('select id,source,label,rows,created_at,batch from runs where id=? and user_id=?').get(q.params.id, q.u.id);
  if (!r) return s.sendStatus(404);
  // المرصود (ما تعرضه ميتا لكل بحث، مجموعاً) والمستبعد عند الاستقبال لهذه الدفعة
  let stats = null, excl = [];
  if (r.batch) { try { const b = db.prepare('select observed from lib_bstats where user_id=? and batch_id=?').get(q.u.id, r.batch), ob = b ? JSON.parse(b.observed || '{}') : {};
    // الإعلانات المستبعدة عند الاستقبال تُرسل مع النتيجة (لتظهر في «مستبعد» ويتطابق العدد مع ما جُلب)
    try { excl = db.prepare('select e.row, e.why from lib_bfilt f join lib_excluded e on e.user_id=f.user_id and e.ad_id=f.ad_id where f.user_id=? and f.batch_id=?').all(q.u.id, r.batch).map(x => Object.assign(JSON.parse(x.row || '{}'), { pre_excl: x.why || 'ليس منتجاً' })); } catch (e) { excl = []; }
    stats = { batch: r.batch, observed: Object.values(ob).reduce((a, x) => a + (+x || 0), 0), searches: Object.keys(ob).length, filtered: db.prepare('select count(*) n from lib_bfilt where user_id=? and batch_id=?').get(q.u.id, r.batch).n }; } catch (e) {} }
  // بلا JSON.parse ثم JSON.stringify لملايين الأحرف: النص المخزَّن يُرسل كما هو
  s.type('application/json').send('{"id":' + r.id + ',"source":' + JSON.stringify(r.source) + ',"label":' + JSON.stringify(r.label) + ',"created_at":' + r.created_at + ',"stats":' + JSON.stringify(stats) + ',"excluded":' + JSON.stringify(excl) + ',"rows":' + rowsJson(r) + '}');
}));
app.delete('/api/runs/:id', auth, active, wrap((q, s) => { if (db.prepare('delete from runs where id=? and user_id=?').run(q.params.id, q.u.id).changes) db.prepare('delete from lib_rows where run_id=?').run(q.params.id); s.json({ ok: 1 }); }));
app.post('/api/runs', auth, active, wrap((q, s) => {
  const rows = arr(q.body.rows, 'rows'), fp = fpOf(rows);
  let ex = db.prepare('select id,created_at from runs where user_id=? and fp=? limit 1').get(q.u.id, fp);
  if (!ex) for (const r of db.prepare('select id,rows,created_at from runs where user_id=? and fp is null and ads=?').all(q.u.id, rows.length)) {   // أرشيف قديم بلا بصمة: تُحسب وتُحفظ مرة واحدة
    if (r.rows === LIB) continue; let f; try { f = fpOf(JSON.parse(r.rows)); } catch (e) { continue; }
    db.prepare('update runs set fp=? where id=?').run(f, r.id); if (f === fp) { ex = r; break; } }
  if (ex) return s.json({ id: ex.id, dup: 1, created_at: ex.created_at });
  s.json({ id: addRun(q.u, 'upload', q.body.label, rows) });
}));
app.put('/api/runs/:id/summary', auth, active, wrap((q, s) => {
  db.prepare('update runs set summary=?, counts=? where id=? and user_id=?').run(JSON.stringify(arr(q.body.summary, 'summary').slice(0, 30)), JSON.stringify(q.body.counts || null), q.params.id, q.u.id); s.json({ ok: 1 });
}));

// ---------- المنتجات المحفوظة ----------
// الأداء: لوحة التحكم وعلامة ★ تحتاجان المفاتيح فقط، لا المنتجات كاملة بصورها وإعلاناتها
app.get('/api/saved/keys', auth, active, wrap((q, s) => s.json(db.prepare('select k from saved where user_id=? order by created_at desc').all(q.u.id).map(r => r.k))));
app.get('/api/saved', auth, active, wrap((q, s) => s.json(db.prepare('select k,snap from saved where user_id=? order by created_at desc').all(q.u.id).map(r => ({ k: r.k, ...JSON.parse(r.snap) })))));
app.put('/api/saved', auth, active, wrap((q, s) => {
  const { k, snap } = q.body || {}; if (!k || typeof snap !== 'object') return s.sendStatus(400);
  db.prepare('insert into saved(user_id,k,snap,created_at) values(?,?,?,?) on conflict(user_id,k) do update set snap=excluded.snap').run(q.u.id, String(k), JSON.stringify(snap), now()); s.json({ ok: 1 });
}));
app.delete('/api/saved', auth, active, wrap((q, s) => { db.prepare('delete from saved where user_id=? and k=?').run(q.u.id, String(q.query.k)); s.json({ ok: 1 }); }));

// ---------- واجهة الإضافات ----------
// إضافة خارجية قديمة (إرسال دفعات جاهزة): POST {label, rows:[ads...]}

// ---------- الإدارة والاشتراكات ----------
app.get('/api/admin/users', auth, admin, wrap((q, s) => s.json(db.prepare('select id,email,name,username,phone,role,plan,expires_at,created_at from users order by created_at desc').all())));
app.get('/api/admin/activity', auth, admin, wrap((q, s) => s.json(db.prepare('select a.kind,a.ip,a.ua,a.detail,a.at,u.email from activity a left join users u on u.id=a.user_id order by a.at desc limit 300').all())));
app.post('/api/admin/users/:id', auth, admin, wrap((q, s) => {
  const u = db.prepare('select plan, expires_at from users where id=?').get(q.params.id); if (!u) return s.sendStatus(404);
  const d = Math.max(-3650, Math.min(3650, +q.body.days || 0)), LIM = require('./adlib/limits.js'), t = now();
  // باقة حقيقية دائماً: المختارة، وإلا باقته الحالية إن وُجدت، وإلا أول باقة مدفوعة (كانت «paid» فيأخذ الحدود الافتراضية وكل المميزات)
  const real = n => n && db.prepare('select 1 from plans where name=?').get(n) ? n : '';
  const plan = real(String(q.body.plan || '').slice(0, 30)) || real(u.plan) || ((db.prepare('select name from plans where coalesce(free,0)=0 and active=1 order by sort, id limit 1').get() || {}).name) || 'paid';
  db.prepare('update users set expires_at=?, plan=? where id=?').run(t + LIM.carryOver(u, plan, t) + d * DAY, plan, q.params.id); act(q.u.id, 'admin_grant', q, '#' + q.params.id + ' ' + d + ' يوم'); s.json({ ok: 1 });
}));


// ---------- كلمة المرور واستعادتها ----------
const okPw = p => String(p || '').length >= 8, hashPw = p => bcrypt.hashSync(String(p), 10);
app.post('/api/password', auth, wrap((q, s) => {            // تغيير كلمة المرور (يعمل حتى لو انتهى الاشتراك)
  if (!bcrypt.compareSync(String(q.body.old || ''), q.u.hash)) return s.status(400).json({ error: 'كلمة المرور الحالية خاطئة' });
  if (!okPw(q.body.password)) return s.status(400).json({ error: 'كلمة المرور الجديدة أقل من 8 أحرف' });
  db.prepare('update users set hash=?, tv=coalesce(tv,0)+1 where id=?').run(hashPw(q.body.password), q.u.id);
  act(q.u.id, 'password', q); login(s, q.u.id); s.json({ ok: 1 });   // هذا الجهاز يبقى مسجلاً، والأجهزة الأخرى تُسجَّل خروجها
}));
app.post('/api/reset', wrap((q, s) => {                      // يستعمل رابط الاستعادة الذي يولّده المدير
  if (blocked(q.ip)) return s.status(429).json({ error: 'محاولات كثيرة، أعد المحاولة لاحقاً' });
  const { token = '', password = '' } = q.body || {};
  const r = db.prepare('select * from resets where h=?').get(sha(String(token)));
  if (!r || r.exp < now()) { fail(q.ip); return s.status(400).json({ error: 'الرابط غير صالح أو منتهي، اطلب رابطاً جديداً من الإدارة' }); }
  if (!okPw(password)) return s.status(400).json({ error: 'كلمة المرور أقل من 8 أحرف' });
  db.prepare('update users set hash=?, tv=coalesce(tv,0)+1 where id=?').run(hashPw(password), r.user_id);
  db.prepare('delete from resets where user_id=?').run(r.user_id); act(r.user_id, 'reset', q); login(s, r.user_id); s.json({ ok: 1 });
}));

// ---------- إدارة المستخدمين ----------
app.post('/api/admin/users/:id/reset-link', auth, admin, wrap((q, s) => {
  const u = db.prepare('select id from users where id=?').get(q.params.id); if (!u) return s.sendStatus(404);
  const t = crypto.randomBytes(24).toString('hex');
  db.prepare('delete from resets where user_id=? or exp<?').run(u.id, now());
  db.prepare('insert into resets(h,user_id,exp) values(?,?,?)').run(sha(t), u.id, now() + 36e5);   // ساعة واحدة
  act(q.u.id, 'admin_reset_link', q, 'للمستخدم #' + u.id);
  s.json({ url: appUrl(q) + '/reset?t=' + t });
}));
app.post('/api/admin/users/:id/update', auth, admin, wrap((q, s) => {
  const id = +q.params.id, u = db.prepare('select * from users where id=?').get(id); if (!u) return s.sendStatus(404);
  const em = String(q.body.email || u.email).toLowerCase().trim(), role = q.body.role === 'admin' ? 'admin' : 'member';
  if (!/^\S+@\S+\.\S+$/.test(em)) return s.status(400).json({ error: 'بريد غير صالح' });
  if (em !== u.email && db.prepare('select 1 from users where email=?').get(em)) return s.status(409).json({ error: 'البريد مستعمل لحساب آخر' });
  if (u.role === 'admin' && role !== 'admin' && db.prepare("select count(*) c from users where role='admin'").get().c < 2) return s.status(400).json({ error: 'لا يمكن إزالة آخر مدير' });
  db.prepare('update users set email=?, role=? where id=?').run(em, role, id); act(q.u.id, 'admin_update', q, '#' + id + ' ' + em + ' ' + role); s.json({ ok: 1 });
}));
// حذف حساب وكل بياناته (يُستعمل من المدير ومن المشترك نفسه). سجلات الدفع تبقى لأن القانون قد يفرض الاحتفاظ بها
const USER_TABLES = ['runs', 'saved', 'resets', 'lib_user', 'lib_usage', 'lib_batch', 'gap_products', 'gap_scans', 'gap_matches', 'user_kv', 'sup_results', 'ai_cache', 'watch_pages', 'tt_runs', 'lib_excluded', 'ad_track', 'ai_usage', 'edge_runs', 'notify_log', 'lib_bstats', 'lib_bfilt', 'activity', 'contact_msgs'];
function deleteUser(id) {
  USER_TABLES.forEach(t => { try { db.prepare(`delete from ${t} where user_id=?`).run(id); } catch (e) {} });
  db.prepare('delete from lib_rows where run_id not in (select id from runs)').run();
  ['delete from watch_ads where watch_id not in (select id from watch_pages)', 'delete from watch_scans where watch_id not in (select id from watch_pages)', 'delete from tt_items where run_id not in (select id from tt_runs)'].forEach(x => db.prepare(x).run());
  db.prepare('delete from users where id=?').run(id);
}
app.delete('/api/admin/users/:id', auth, admin, wrap((q, s) => {
  const id = +q.params.id; if (id === q.u.id) return s.status(400).json({ error: 'لا يمكنك حذف حسابك' });
  deleteUser(id); act(q.u.id, 'admin_delete', q, '#' + id); s.json({ ok: 1 });
}));
// المشترك: تصدير بياناته (ملف JSON) وحذف حسابه نهائياً بكلمة المرور
app.get('/api/me/export', auth, wrap((q, s) => {
  const id = q.u.id, all = (sql, ...a) => { try { return db.prepare(sql).all(...a); } catch (e) { return []; } }, J = x => { try { return JSON.parse(x); } catch (e) { return x; } };
  const out = { exported_at: new Date().toISOString(), account: { email: q.u.email, name: q.u.name || '', username: q.u.username || '', phone: q.u.phone || '', plan: q.u.plan, expires_at: q.u.expires_at ? new Date(q.u.expires_at).toISOString() : null, created_at: q.u.created_at ? new Date(q.u.created_at).toISOString() : null },
    saved_products: all('select k, snap, created_at from saved where user_id=?', id).map(r => Object.assign({ key: r.k, saved_at: new Date(r.created_at).toISOString() }, J(r.snap))),
    analyses: all('select id, source, label, ads, summary, created_at from runs where user_id=? order by created_at desc', id).map(r => ({ id: r.id, source: r.source, label: r.label, ads: r.ads, summary: J(r.summary), created_at: new Date(r.created_at).toISOString() })),
    market_gaps: all('select name, snap, verdict, created_at from gap_products where user_id=?', id).map(r => ({ name: r.name, product: J(r.snap), verdict: r.verdict, created_at: r.created_at })),
    compete_ideas: all('select name, input, data, created_at from edge_runs where user_id=? and status=?', id, 'done').map(r => ({ name: r.name, input: J(r.input), ideas: J(r.data), created_at: new Date(r.created_at).toISOString() })),
    watched_pages: all('select page_id, name, note, created_at, stats from watch_pages where user_id=?', id).map(r => Object.assign({}, r, { stats: J(r.stats) })),
    settings: Object.fromEntries(all('select k, v from user_kv where user_id=?', id).map(r => [r.k, J(r.v)])),
    payments: all('select plan_name, days, amount, currency, method, status, created_at, paid_at from payments where user_id=? order by created_at desc', id),
    login_activity: all('select kind, at, ip, ua from activity where user_id=? order by at desc limit 200', id).map(r => Object.assign({}, r, { at: new Date(r.at).toISOString() })) };
  s.set('Content-Disposition', 'attachment; filename="radar-my-data.json"').type('application/json').send(JSON.stringify(out, null, 2));
}));
app.delete('/api/me', auth, wrap((q, s) => {
  if (!bcrypt.compareSync(String((q.body || {}).password || ''), q.u.hash)) return s.status(400).json({ error: 'كلمة المرور غير صحيحة' });
  if (q.u.role === 'admin' && db.prepare("select count(*) n from users where role='admin'").get().n <= 1) return s.status(400).json({ error: 'أنت المدير الوحيد: عيّن مديراً آخر قبل حذف حسابك' });
  deleteUser(q.u.id); s.clearCookie('t'); s.json({ ok: 1 });
}));

// ---------- نسيت كلمة المرور (بريد SMTP) ----------
const fgot = new Map();
const ML = require('./adlib/mail.js'), transport = ML.transport, MAIL_FROM = ML.FROM;   // البريد: الاتصال وآخر نتيجة وفحص الدومين
const RESET_MAIL = {
  ar: { subject: 'استعادة كلمة المرور | رادار المنتجات الرابحة', hi: 'وصلنا طلب لاستعادة كلمة المرور لحسابك.', btn: 'تعيين كلمة مرور جديدة', note: 'الرابط صالح لمدة ساعة واحدة. إن لم تطلبه فتجاهل هذه الرسالة.' },
  en: { subject: 'Reset your password | Winning Product Radar', hi: 'We received a request to reset the password of your account.', btn: 'Set a new password', note: 'This link is valid for one hour. If you didn’t request it, just ignore this email.' },
  fr: { subject: 'Réinitialisation du mot de passe | Radar des produits gagnants', hi: 'Nous avons reçu une demande de réinitialisation du mot de passe de votre compte.', btn: 'Choisir un nouveau mot de passe', note: 'Ce lien est valable une heure. Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.' } };
app.post('/api/forgot', async (q, s, n) => { try {
  const f = fgot.get(q.ip); if (f && f.n >= 5 && now() - f.t < 9e5) return s.status(429).json({ error: 'محاولات كثيرة، أعد المحاولة بعد 15 دقيقة' });
  fgot.set(q.ip, { n: (f && now() - f.t < 9e5 ? f.n : 0) + 1, t: now() });
  const tr = transport();
  if (!tr) return s.json({ ok: 1, manual: true, contact: contactUrl() });   // لا بريد مضبوط: يراسل المدير
  const u = db.prepare('select * from users where email=? or username=?').get(String(q.body.email || '').toLowerCase().trim(), String(q.body.email || '').toLowerCase().trim());
  if (u) {
    const t = crypto.randomBytes(24).toString('hex'), url = appUrl(q) + '/reset?t=' + t;
    db.prepare('delete from resets where user_id=? or exp<?').run(u.id, now());
    db.prepare('insert into resets(h,user_id,exp) values(?,?,?)').run(sha(t), u.id, now() + 36e5);
    // الرسالة بلغة صفحة الدخول التي طُلبت منها (العربية / English / Français)
    const lg = ['en', 'fr'].includes(q.body.lang) ? q.body.lang : 'ar', M = RESET_MAIL[lg];
    ML.send({ to: u.email, subject: M.subject, text: M.hi + '\n\n' + M.btn + ':\n' + url + '\n\n' + M.note,
      html: `<div dir="${lg === 'ar' ? 'rtl' : 'ltr'}" style="font-family:Tahoma,Arial,sans-serif;line-height:1.9"><p>${M.hi}</p><p><a href="${url}" style="background:#118553;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">${M.btn}</a></p><p>${M.note}</p><p style="color:#5d6661;font-size:13px">${url}</p></div>` }, 'reset')
      .catch(e => { console.error('mail error', e.message); BX.logError && BX.logError(Object.assign(new Error('استعادة كلمة المرور: تعذّر إرسال البريد: ' + e.message + (e.hint ? ' — ' + e.hint : '')), { status: 500 }), q); });
  }
  s.json({ ok: 1 });   // نفس الرد دائماً، فلا يُكشف وجود الحساب
} catch (e) { n(e); } });

// ---------- الصور: وكيل آمن + نسخة محفوظة للمنتجات المحفوظة ----------
const IMG_DIR = process.env.IMG_DIR || path.join(path.dirname(path.resolve(process.env.DB_FILE || 'data.db')), 'images');
fs.mkdirSync(IMG_DIR, { recursive: true });
const appUrl = q => String(CFGM.get('app_url') || (q.protocol + '://' + q.get('host'))).replace(/\/$/, '');   // لا نثق بترويسة Host (تسميم رابط الاستعادة)
const priv = a => /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(a) || /^(::1?$|f[cd]|fe80|::ffff:)/i.test(a);
const safeLookup = (h, o, cb) => dns.lookup(h, Object.assign({}, o, { all: true }), (e, L) => {
  if (e) return cb(e); if (!L.length || L.some(a => priv(a.address))) return cb(Object.assign(new Error('private'), { code: 'EPRIVATE' }));
  return o && o.all ? cb(null, L) : cb(null, L[0].address, L[0].family);
});
const getImg = x => new Promise((res, rej) => {
  const r = require(x.protocol === 'https:' ? 'https' : 'http').get(x, { lookup: safeLookup, headers: { 'user-agent': 'Mozilla/5.0' } }, rs => {
    const ch = []; let n = 0;
    rs.on('data', d => { n += d.length; if (n > 4e6) r.destroy(new Error('too big')); else ch.push(d); });
    rs.on('end', () => res({ status: rs.statusCode, headers: rs.headers, buf: Buffer.concat(ch) })); rs.on('error', rej);
  });
  r.setTimeout(9000, () => r.destroy(new Error('timeout'))); r.on('error', rej);
});
async function fetchImg(u, hop = 0) {
  const x = new URL(u); if (!/^https?:$/.test(x.protocol) || (x.port && !['80', '443'].includes(x.port))) throw new Error('bad url');
  if ((await dns.promises.lookup(x.hostname, { all: true })).some(a => priv(a.address))) throw new Error('private');
  const r = await getImg(x), loc = r.headers.location;
  if (r.status >= 300 && r.status < 400 && loc && hop < 3) return fetchImg(new URL(loc, x).href, hop + 1);
  const type = String(r.headers['content-type'] || '').split(';')[0].trim();
  if (r.status < 200 || r.status >= 300 || !/^image\/(jpeg|png|webp|gif|avif)$/.test(type)) throw new Error('not image');
  return { buf: r.buf, type };
}
const ik = u => sha(u).slice(0, 40);
app.get('/api/img', auth, active, async (q, s) => { try {
  const u = String(q.query.u || ''); if (!/^https?:\/\//.test(u) || u.length > 2000) return s.sendStatus(400);
  const f = path.join(IMG_DIR, ik(u)); s.set('X-Content-Type-Options', 'nosniff');
  if (fs.existsSync(f + '.bin')) return s.set({ 'Content-Type': fs.readFileSync(f + '.type', 'utf8'), 'Cache-Control': 'private,max-age=604800' }).send(fs.readFileSync(f + '.bin'));
  const r = await fetchImg(u); s.set({ 'Content-Type': r.type, 'Cache-Control': 'private,max-age=3600' }).send(r.buf);
} catch (e) { s.sendStatus(404); } });
app.post('/api/img/keep', auth, active, async (q, s) => {   // يحفظ نسخة من صور المنتج المحفوظ قبل أن تنتهي صلاحية روابطها
  let ok = 0;
  for (const u of (Array.isArray(q.body.urls) ? q.body.urls : []).slice(0, 10)) { try {
    if (!/^https?:\/\//.test(u) || u.length > 2000) continue; const f = path.join(IMG_DIR, ik(u)); if (fs.existsSync(f + '.bin')) { ok++; continue; }
    const r = await fetchImg(u); fs.writeFileSync(f + '.bin', r.buf); fs.writeFileSync(f + '.type', r.type); ok++;
  } catch (e) {} }
  s.json({ saved: ok });
});

// ---------- جمع الإعلانات (الإضافة ← الواردة + قاموس كلمات البحث) ----------
// مميزات الباقة: ما لم يُفعَّل في باقة المشترك يُرفض برسالة واضحة (المدير بلا قيود)
{ const LIM = require('./adlib/limits.js'), F = { '/api/gap': 'gap', '/api/sup': 'supplier', '/api/ai': 'ai', '/api/edge': 'ai', '/api/watch': 'watch', '/api/tt': 'tiktok', '/api/profit': 'profit', '/api/sheets': 'sheets' };
  for (const [pre, k] of Object.entries(F)) app.use(pre, (q, s, n) => auth(q, s, () => LIM.has(q.u, k) ? n() : s.status(403).json({ error: 'غير متاح في باقتك: ' + LIM.FLABEL[k] + '. رقِّ باقتك من «اشتراكي».', feature: k }))); }
require('./adlib')(app, { db, auth, active, admin, wrap, now, DAY, addRun, fpOf });
require('./adlib/gap.js')(app, { db, auth, active, wrap, now });   // ثغرات السوق الجزائري
// صورة كـ data URL للذكاء الاصطناعي (النسخة المحفوظة أولاً، وإلا تُجلب عبر الوكيل الآمن)
const imgData = async u => { if (!/^https?:\/\//.test(u || '')) return ''; const f = path.join(IMG_DIR, ik(u)); let buf, type;
  if (fs.existsSync(f + '.bin')) { buf = fs.readFileSync(f + '.bin'); type = fs.readFileSync(f + '.type', 'utf8'); } else { const r = await fetchImg(u); buf = r.buf; type = r.type; }
  return buf.length > 3.5e6 ? '' : 'data:' + type + ';base64,' + buf.toString('base64'); };
require('./adlib/tools.js')(app, { db, auth, active, wrap, now, imgData });
require('./adlib/edge.js')(app, { db, auth, active, wrap, now, imgData });   // الخروج من المنافسة (أفكار بالذكاء الاصطناعي)
const optUser = q => { try { const t = session(q.cookies.t), u = db.prepare('select id, email, name, tv from users where id=?').get(t.id); return u && (t.v || 0) === (u.tv || 0) ? u : null; } catch (e) { return null; } };
const BX = { db, auth, active, admin, wrap, now, act, blocked, fail, optUser, DATA_DIR: path.dirname(path.resolve(DBF)) };
Object.assign(BX, require('./adlib/notify.js')(app, Object.assign({ mailer: () => transport(), sendMail: ML.send }, BX)));   // 🔔 التنبيهات: بريد وتيليغرام
require('./adlib/billing.js')(app, BX);  // الاشتراكات والدفع والإحصائيات وسجل الأخطاء ومفاتيح المنصة
require('./adlib/backup.js')(app, BX);   // 💾 نسخة احتياطية يومية لقاعدة البيانات
require('./adlib/support.js')(app, BX);
require('./adlib/wa.js')(app, BX);
require('./adlib/stats.js')(app, BX);
app.get('/maint-preview', auth, admin, (q, s) => s.set('Cache-Control', 'no-store').type('html').send(MAINT_HTML));
app.put('/api/admin/maint', auth, admin, wrap((q, s) => {
  const b = q.body || {}, until = String(b.until || '').slice(0, 30);
  CFGM.set('maint_on', b.on ? '1' : ''); CFGM.set('maint_msg', String(b.msg || '').slice(0, 600)); CFGM.set('maint_until', until && !isNaN(new Date(until)) ? new Date(until).toISOString() : '');
  act(q.u.id, 'admin_maint', q, b.on ? 'تفعيل وضع الصيانة' : 'إيقاف وضع الصيانة'); s.json({ ok: 1, on: maintOn() });
}));    // 📊 إحصائيات المنصة الشاملة + نبضة النشاط والبلد       // 💬 رسائل واتساب الجاهزة (يضبطها المدير، تظهر للمشترك)  // ✉️ نموذج «اتصل بنا» + رسائل المدير + نصوص الصفحات القانونية المعدّلة
// المورّد، تحليل الإعلان، Google Sheets، مراقبة المنافسين، TikTok

ML.routes(app, BX);   // المدير: حالة البريد، بريد تجريبي إلى أي عنوان، فحص SPF/DKIM
// ---------- الصفحات ----------
const LANDING = fs.readFileSync(path.join(__dirname, 'views', 'landing.html'), 'utf8');
// قياس الزيارات في الصفحات العامة فقط (الرئيسية، التسجيل، الصفحات القانونية): Google Analytics و Meta Pixel من «الربط والتكامل».
// المعرّفات تُتحقق بصيغة صارمة لأنها تدخل في سكربت مضمَّن. لا شيء من هذا داخل المنصة بعد الدخول.
function analytics() {
  const C = require('./adlib/config.js'), ga = C.get('ga_id'), px = C.get('meta_pixel'); let h = '';
  if (/^G-[A-Z0-9]{4,16}$/.test(ga)) h += `<script async src="https://www.googletagmanager.com/gtag/js?id=${ga}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${ga}');</script>`;
  if (/^\d{8,20}$/.test(px)) h += `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${px}');fbq('track','PageView');</script>`;
  return h;
}
const pub = html => { const a = analytics(); return a ? html.replace('</head>', a + '</head>') : html; };
// صفحات الواجهة تُخدَم من views/ (خارج المجلد العام) فلا تظهر بأسماء ملفاتها (.html). التطبيق صفحة واحدة بروابط حقيقية لكل قسم.
const APP_PAGE = path.join(__dirname, 'views', 'app.html'), LOGIN_PAGE = path.join(__dirname, 'views', 'login.html');
const sendApp = s => s.type('html').set('Cache-Control', 'no-cache').send(APP_HTML);   // الصفحة نفسها تُفحص دائماً، وملفاتها من ذاكرة المتصفح
const signedIn = q => { try { session(q.cookies.t); return true; } catch (e) { return false; } };
app.get('/', (q, s) => signedIn(q) ? sendApp(s) : s.type('html').send(pub(LANDING)));
app.get(['/collect', '/collect/:tab', '/inbox', '/analyze', '/archive', '/saved', '/compete', '/compete/:id', '/gaps', '/gaps/:id', '/watch', '/watch/:id', '/tiktok', '/tiktok/:id', '/integrations', '/settings', '/subscription', '/security', '/help', '/guide', '/subscribers', '/admin', '/payments', '/payments/:tab', '/support-inbox', '/platform', '/platform/:tab'],
  (q, s) => signedIn(q) ? sendApp(s) : s.redirect('/login?next=' + encodeURIComponent(q.path)));
app.get('/spy', (q, s) => s.redirect(301, '/gaps'));   // أدوات التجسس حُذفت؛ القسم الجديد مكانها
// الصفحات القانونية: شروط الاستخدام، الخصوصية، الاسترداد، الاتصال (بثلاث لغات، ومعلومات النشاط من «الربط والتكامل»)
const LEGAL_HTML = fs.readFileSync(path.join(__dirname, 'views', 'legal.html'), 'utf8'), LOGIN_HTML = fs.readFileSync(LOGIN_PAGE, 'utf8');
app.get(['/terms', '/privacy', '/refund', '/contact'], (q, s) => s.set('Cache-Control', 'no-cache').type('html').send(pub(LEGAL_HTML)));
// فحص صحة الخادم لخدمات المراقبة (UptimeRobot وغيرها): 200 إن كانت قاعدة البيانات تعمل، وإلا 503. لا يكشف أي بيانات.
const BOOT = Date.now();
app.get('/api/health', (q, s) => { let okDb = false; try { okDb = db.prepare('select 1 x').get().x === 1; } catch (e) {}
  s.set('Cache-Control', 'no-store').status(okDb ? 200 : 503).json({ ok: okDb, version: require('./package.json').version, build: VER, uptime: Math.round((Date.now() - BOOT) / 1000) }); });
app.get('/api/legal/info', (q, s) => { const C = require('./adlib/config.js');
  s.json({ name: C.get('biz_name'), country: C.get('biz_country'), address: C.get('biz_address'), email: C.get('support_email') || process.env.ADMIN_EMAIL || '', whatsapp: C.get('support_whatsapp'), refund_days: +C.get('refund_days') || 7, updated: C.get('legal_updated') || '', docs: BX.legalDocs ? BX.legalDocs() : {} }); });
app.get(['/login', '/register', '/forgot', '/reset'], (q, s) => (q.path !== '/reset' && signedIn(q)) ? s.redirect('/') : s.set('Cache-Control', 'no-cache').type('html').send(pub(LOGIN_HTML)));
// الأداء: روابط الملفات تحمل رقم نسختها (?v=…) فيحفظها المتصفح سنة كاملة ولا يسأل الخادم عنها في كل زيارة.
// يتغير الرقم تلقائياً متى تغيّر أي ملف (بعد إعادة تشغيل الخادم عند النشر).
const VER = (() => { const h = crypto.createHash('sha1'); for (const d of ['public', 'engine', path.join('adlib', 'lib')]) for (const f of fs.readdirSync(path.join(__dirname, d)).filter(x => x.endsWith('.js')).sort()) h.update(fs.readFileSync(path.join(__dirname, d, f))); return h.digest('hex').slice(0, 10); })();
const APP_HTML = fs.readFileSync(APP_PAGE, 'utf8').replace(/<script src="(\/[^"?]+\.js)">/g, '<script src="$1?v=' + VER + '">').replace('<head>', '<head><script>window.__V="' + VER + '"</script>');
const immutable = (q, s, n) => { if (q.query.v) s.set('Cache-Control', 'public, max-age=31536000, immutable'); n(); };
app.use(immutable);
app.use('/fonts', express.static(path.join(__dirname, 'public', 'fonts'), { index: false, maxAge: '365d', immutable: true }));   // الخطوط لا تتغير
app.use(express.static(path.join(__dirname, 'public'), { index: false, cacheControl: false }));
// منطق الأسواق وفحص المنتج مشترك بين الخادم والمتصفح (ملف واحد لكل منطق)
app.get('/radar-lib/core.js', (q, s) => s.type('application/javascript').set('Cache-Control', q.query.v ? 'public, max-age=31536000, immutable' : 'no-cache').sendFile(path.join(__dirname, 'engine', 'core.js')));   // محرك التحليل للخيط الخلفي
app.get(['/radar-lib/kwdata.js', '/radar-lib/markets.js', '/radar-lib/productcheck.js', '/radar-lib/gapmatch.js'], (q, s) => s.type('application/javascript').set('Cache-Control', q.query.v ? 'public, max-age=31536000, immutable' : 'no-cache').sendFile(path.join(__dirname, 'adlib', 'lib', path.basename(q.path))));
app.use((e, q, s, n) => { if (!e.status || e.status >= 500) { console.error(e); BX.logError && BX.logError(e, q); } s.status(e.status || 500).json({ error: e.status ? e.message : 'server' }); });
app.listen(+process.env.PORT || 3000, () => console.log('Radar platform on :' + (process.env.PORT || 3000)));
