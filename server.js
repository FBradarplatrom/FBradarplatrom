'use strict';
try { require('fs').readFileSync(require('path').join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach(l => {
  const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2');
}); } catch (e) {}
const express = require('express'), bcrypt = require('bcryptjs'),
  jwt = require('jsonwebtoken'), cookie = require('cookie-parser'), crypto = require('crypto'), dns = require('dns'), fs = require('fs'), path = require('path');
const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 24) { console.error('JWT_SECRET (24+ chars) is required'); process.exit(1); }
const ADMIN = (process.env.ADMIN_EMAIL || '').toLowerCase(), DAY = 864e5, now = () => Date.now();
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
const dec = x => { try { const b = Buffer.from(x, 'base64'), d = crypto.createDecipheriv('aes-256-gcm', EK, b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28)); return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'); } catch (e) { return null; } };
const app = express();
app.disable('x-powered-by'); app.set('trust proxy', 1);
app.use(gzip);
// الأمان: ترويسات تمنع تضمين المنصة في مواقع أخرى (clickjacking) وتخمين أنواع الملفات وتسريب الروابط
app.use((q, s, n) => { s.set({ 'X-Frame-Options': 'DENY', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' }); if (q.secure) s.set('Strict-Transport-Security', 'max-age=15552000'); n(); });
app.use(express.json({ limit: '50mb', verify: (q, s, buf) => { if (q.url.startsWith('/api/billing/webhook')) q.rawBody = buf; } }), cookie());   // الجسم الخام لتحقق توقيع بوابة الدفع
app.use('/api', (q, s, n) => { s.set('Cache-Control', 'no-store'); n(); });   // البيانات حيّة: لا تُخزَّن في المتصفح (تظهر فور وصولها)

// CORS للإضافات فقط (المصادقة بمفتاح، بلا كوكيز)
const EXT = (process.env.EXT_ORIGINS || 'https://www.facebook.com').split(',').map(s => s.trim());
app.use('/api/ext', (q, s, n) => {
  const o = q.get('origin') || '';
  if (/^(chrome|moz)-extension:\/\//.test(o) || EXT.includes(o))
    s.set({ 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Headers': 'content-type,x-api-key', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', Vary: 'Origin' });
  if (q.method === 'OPTIONS') return s.sendStatus(204);
  n();
});

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
  { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 30 * DAY });

function auth(q, s, n) {
  const k = q.get('x-api-key'); let u;
  if (k) u = db.prepare('select * from users where api_hash=?').get(sha(k));
  else try { const t = jwt.verify(q.cookies.t, SECRET); u = db.prepare('select * from users where id=?').get(t.id); if (u && (t.v || 0) !== (u.tv || 0)) u = null; } catch (e) {}
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
  const id = db.prepare('insert into users(email,hash,role,expires_at,created_at,name,username) values(?,?,?,?,?,?,?)')
    .run(em, bcrypt.hashSync(String(password), 10), em === ADMIN ? 'admin' : 'member', now() + (+process.env.TRIAL_DAYS || 0) * DAY, now(), String(name).trim().slice(0, 60), un || null).lastInsertRowid;
  fail('r:' + q.ip, 36e5); act(id, 'register', q); login(s, id); s.json({ ok: 1 });
}));
app.post('/api/login', wrap((q, s) => {
  const { email = '', password = '' } = q.body || {}, l = String(email).toLowerCase().trim();
  if (blocked(q.ip) || blocked('a:' + l, 8)) return s.status(429).json({ error: 'محاولات كثيرة، أعد المحاولة بعد 15 دقيقة' });
  const u = db.prepare('select * from users where email=? or username=?').get(l, l);
  if (!u || !bcrypt.compareSync(String(password), u.hash)) { fail(q.ip); fail('a:' + l); if (u) act(u.id, 'login_fail', q); return s.status(401).json({ error: 'بيانات الدخول غير صحيحة' }); }
  fails.delete(q.ip); fails.delete('a:' + l); act(u.id, 'login', q); login(s, u.id); s.json({ ok: 1 });
}));
app.post('/api/logout', (q, s) => { s.clearCookie('t'); s.json({ ok: 1 }); });
// تسجيل الخروج من كل الأجهزة
app.post('/api/logout-all', auth, wrap((q, s) => { db.prepare('update users set tv=coalesce(tv,0)+1 where id=?').run(q.u.id); act(q.u.id, 'logout_all', q); s.clearCookie('t'); s.json({ ok: 1 }); }));
app.get('/api/activity', auth, wrap((q, s) => s.json(db.prepare("select kind,ip,ua,at from activity where user_id=? and kind in ('login','login_fail','password','reset','logout_all') order by at desc limit 15").all(q.u.id))));
app.get('/api/me', auth, (q, s) => s.json({ email: q.u.email, name: q.u.name || '', username: q.u.username || '', role: q.u.role, plan: q.u.plan, expires_at: q.u.expires_at, active: isActive(q.u), contact: process.env.CONTACT_URL || '' }));
app.put('/api/profile', auth, wrap((q, s) => {
  const b = q.body || {}, name = String(b.name || '').trim().slice(0, 60), un = String(b.username || '').trim().toLowerCase(), em = String(b.email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(em)) return s.status(400).json({ error: 'بريد غير صالح' });
  if (un && !UN.test(un)) return s.status(400).json({ error: 'اسم المستخدم: 3 إلى 30 حرفاً لاتينياً أو أرقاماً أو _ .' });
  if (em !== q.u.email) {
    if (!bcrypt.compareSync(String(b.password || ''), q.u.hash)) return s.status(400).json({ error: 'أدخل كلمة المرور الحالية لتأكيد تغيير البريد' });
    if (db.prepare('select 1 from users where email=? and id!=?').get(em, q.u.id)) return s.status(409).json({ error: 'البريد مستعمل لحساب آخر' });
  }
  if (un && db.prepare('select 1 from users where username=? and id!=?').get(un, q.u.id)) return s.status(409).json({ error: 'اسم المستخدم مستعمل' });
  db.prepare('update users set name=?, username=?, email=? where id=?').run(name, un || null, em, q.u.id); s.json({ ok: 1 });
}));
app.get('/api/key', auth, (q, s) => s.json({ key: q.u.api_enc ? dec(q.u.api_enc) : null }));   // يبقى محفوظاً ويُعرض متى شئت
app.post('/api/key', auth, active, wrap((q, s) => {
  const key = 'wpr_' + crypto.randomBytes(24).toString('hex');
  db.prepare('update users set api_hash=?, api_enc=? where id=?').run(sha(key), enc(key), q.u.id); s.json({ key });
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
  s.json(db.prepare('select id,source,label,ads,summary,counts,created_at from runs where user_id=? order by created_at desc limit 300').all(q.u.id)
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
app.get('/api/saved', auth, active, wrap((q, s) => s.json(db.prepare('select k,snap from saved where user_id=? order by created_at desc').all(q.u.id).map(r => ({ k: r.k, ...JSON.parse(r.snap) })))));
app.put('/api/saved', auth, active, wrap((q, s) => {
  const { k, snap } = q.body || {}; if (!k || typeof snap !== 'object') return s.sendStatus(400);
  db.prepare('insert into saved(user_id,k,snap,created_at) values(?,?,?,?) on conflict(user_id,k) do update set snap=excluded.snap').run(q.u.id, String(k), JSON.stringify(snap), now()); s.json({ ok: 1 });
}));
app.delete('/api/saved', auth, active, wrap((q, s) => { db.prepare('delete from saved where user_id=? and k=?').run(q.u.id, String(q.query.k)); s.json({ ok: 1 }); }));

// ---------- واجهة الإضافات ----------
// إضافة خارجية قديمة (إرسال دفعات جاهزة): POST {label, rows:[ads...]}
app.post('/api/ext/adlib', auth, active, wrap((q, s) => s.json({ id: addRun(q.u, 'adlib', q.body.label, arr(q.body.rows, 'rows')) })));

// ---------- الإدارة والاشتراكات ----------
app.get('/api/admin/users', auth, admin, wrap((q, s) => s.json(db.prepare('select id,email,name,username,role,plan,expires_at,created_at from users order by created_at desc').all())));
app.get('/api/admin/activity', auth, admin, wrap((q, s) => s.json(db.prepare('select a.kind,a.ip,a.ua,a.detail,a.at,u.email from activity a left join users u on u.id=a.user_id order by a.at desc limit 300').all())));
app.post('/api/admin/users/:id', auth, admin, wrap((q, s) => {
  const u = db.prepare('select expires_at from users where id=?').get(q.params.id); if (!u) return s.sendStatus(404);
  const d = Math.max(-3650, Math.min(3650, +q.body.days || 0));
  db.prepare('update users set expires_at=?, plan=? where id=?').run(Math.max(now(), u.expires_at) + d * DAY, String(q.body.plan || 'paid').slice(0, 30), q.params.id); act(q.u.id, 'admin_grant', q, '#' + q.params.id + ' ' + d + ' يوم'); s.json({ ok: 1 });
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
  s.json({ url: (process.env.APP_URL || q.protocol + '://' + q.get('host')).replace(/\/$/, '') + '/reset?t=' + t });
}));
app.post('/api/admin/users/:id/update', auth, admin, wrap((q, s) => {
  const id = +q.params.id, u = db.prepare('select * from users where id=?').get(id); if (!u) return s.sendStatus(404);
  const em = String(q.body.email || u.email).toLowerCase().trim(), role = q.body.role === 'admin' ? 'admin' : 'member';
  if (!/^\S+@\S+\.\S+$/.test(em)) return s.status(400).json({ error: 'بريد غير صالح' });
  if (em !== u.email && db.prepare('select 1 from users where email=?').get(em)) return s.status(409).json({ error: 'البريد مستعمل لحساب آخر' });
  if (u.role === 'admin' && role !== 'admin' && db.prepare("select count(*) c from users where role='admin'").get().c < 2) return s.status(400).json({ error: 'لا يمكن إزالة آخر مدير' });
  db.prepare('update users set email=?, role=? where id=?').run(em, role, id); act(q.u.id, 'admin_update', q, '#' + id + ' ' + em + ' ' + role); s.json({ ok: 1 });
}));
app.delete('/api/admin/users/:id', auth, admin, wrap((q, s) => {
  const id = +q.params.id; if (id === q.u.id) return s.status(400).json({ error: 'لا يمكنك حذف حسابك' });
  ['runs', 'saved', 'resets', 'lib_user', 'lib_usage', 'lib_batch', 'gap_products', 'gap_scans', 'gap_matches', 'user_kv', 'sup_results', 'ai_cache', 'watch_pages', 'tt_runs', 'lib_excluded', 'ad_track', 'ai_usage', 'notify_log', 'lib_bstats', 'lib_bfilt'].forEach(t => db.prepare(`delete from ${t} where user_id=?`).run(id));
  db.prepare('delete from lib_rows where run_id not in (select id from runs)').run();
  ['delete from watch_ads where watch_id not in (select id from watch_pages)', 'delete from watch_scans where watch_id not in (select id from watch_pages)', 'delete from tt_items where run_id not in (select id from tt_runs)'].forEach(x => db.prepare(x).run());
  db.prepare('delete from users where id=?').run(id); act(q.u.id, 'admin_delete', q, '#' + id); s.json({ ok: 1 });
}));

// ---------- نسيت كلمة المرور (بريد SMTP) ----------
const fgot = new Map();
const transport = () => { if (!process.env.SMTP_HOST) return null; const nm = require('nodemailer'), p = +process.env.SMTP_PORT || 465;
  return process.env.SMTP_HOST === 'json' ? nm.createTransport({ jsonTransport: true })
    : nm.createTransport({ host: process.env.SMTP_HOST, port: p, secure: p === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }); };
app.post('/api/forgot', async (q, s, n) => { try {
  const f = fgot.get(q.ip); if (f && f.n >= 5 && now() - f.t < 9e5) return s.status(429).json({ error: 'محاولات كثيرة، أعد المحاولة بعد 15 دقيقة' });
  fgot.set(q.ip, { n: (f && now() - f.t < 9e5 ? f.n : 0) + 1, t: now() });
  const tr = transport();
  if (!tr) return s.json({ ok: 1, manual: true, contact: process.env.CONTACT_URL || '' });   // لا بريد مضبوط: يراسل المدير
  const u = db.prepare('select * from users where email=? or username=?').get(String(q.body.email || '').toLowerCase().trim(), String(q.body.email || '').toLowerCase().trim());
  if (u) {
    const t = crypto.randomBytes(24).toString('hex'), url = (process.env.APP_URL || q.protocol + '://' + q.get('host')).replace(/\/$/, '') + '/reset?t=' + t;
    db.prepare('delete from resets where user_id=? or exp<?').run(u.id, now());
    db.prepare('insert into resets(h,user_id,exp) values(?,?,?)').run(sha(t), u.id, now() + 36e5);
    tr.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: u.email, subject: 'استعادة كلمة المرور | رادار المنتجات الرابحة',
      html: `<div dir="rtl" style="font-family:Tahoma,sans-serif;line-height:1.9"><p>وصلنا طلب لاستعادة كلمة المرور لحسابك.</p><p><a href="${url}" style="background:#4f46e5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">تعيين كلمة مرور جديدة</a></p><p>الرابط صالح لمدة ساعة واحدة. إن لم تطلبه فتجاهل هذه الرسالة.</p></div>` })
      .then(i => { if (process.env.SMTP_HOST === 'json') console.log('MAIL', i.message); }).catch(e => console.error('mail error', e.message));
  }
  s.json({ ok: 1 });   // نفس الرد دائماً، فلا يُكشف وجود الحساب
} catch (e) { n(e); } });

// ---------- الصور: وكيل آمن + نسخة محفوظة للمنتجات المحفوظة ----------
const IMG_DIR = process.env.IMG_DIR || path.join(path.dirname(path.resolve(process.env.DB_FILE || 'data.db')), 'images');
fs.mkdirSync(IMG_DIR, { recursive: true });
const priv = a => /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(a) || /^(::1?$|f[cd]|fe80|::ffff:)/i.test(a);
async function fetchImg(u, hop = 0) {
  const x = new URL(u); if (!/^https?:$/.test(x.protocol) || (x.port && !['80', '443'].includes(x.port))) throw new Error('bad url');
  if ((await dns.promises.lookup(x.hostname, { all: true })).some(a => priv(a.address))) throw new Error('private');
  const r = await fetch(x, { redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(9000) });
  if (r.status >= 300 && r.status < 400 && r.headers.get('location') && hop < 3) return fetchImg(new URL(r.headers.get('location'), x).href, hop + 1);
  const type = (r.headers.get('content-type') || '').split(';')[0].trim();
  if (!r.ok || !/^image\/(jpeg|png|webp|gif|avif)$/.test(type)) throw new Error('not image');
  const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > 4e6) throw new Error('too big');
  return { buf, type };
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
require('./adlib')(app, { db, auth, active, admin, wrap, now, DAY, addRun, fpOf });
require('./adlib/gap.js')(app, { db, auth, active, wrap, now });   // ثغرات السوق الجزائري
// صورة كـ data URL للذكاء الاصطناعي (النسخة المحفوظة أولاً، وإلا تُجلب عبر الوكيل الآمن)
const imgData = async u => { if (!/^https?:\/\//.test(u || '')) return ''; const f = path.join(IMG_DIR, ik(u)); let buf, type;
  if (fs.existsSync(f + '.bin')) { buf = fs.readFileSync(f + '.bin'); type = fs.readFileSync(f + '.type', 'utf8'); } else { const r = await fetchImg(u); buf = r.buf; type = r.type; }
  return buf.length > 3.5e6 ? '' : 'data:' + type + ';base64,' + buf.toString('base64'); };
require('./adlib/tools.js')(app, { db, auth, active, wrap, now, imgData });
const BX = { db, auth, active, admin, wrap, now, act, DATA_DIR: path.dirname(path.resolve(DBF)) };
Object.assign(BX, require('./adlib/notify.js')(app, Object.assign({ mailer: () => transport() }, BX)));   // 🔔 التنبيهات: بريد وتيليغرام
require('./adlib/billing.js')(app, BX);  // الاشتراكات والدفع والإحصائيات وسجل الأخطاء ومفاتيح المنصة
// المورّد، تحليل الإعلان، Google Sheets، مراقبة المنافسين، TikTok

// ---------- الصفحات ----------
const LANDING = fs.readFileSync(path.join(__dirname, 'views', 'landing.html'), 'utf8')
  .replace(/\{\{CONTACT\}\}/g, process.env.CONTACT_URL || 'mailto:' + (process.env.ADMIN_EMAIL || ''));
// صفحات الواجهة تُخدَم من views/ (خارج المجلد العام) فلا تظهر بأسماء ملفاتها (.html). التطبيق صفحة واحدة بروابط حقيقية لكل قسم.
const APP_PAGE = path.join(__dirname, 'views', 'app.html'), LOGIN_PAGE = path.join(__dirname, 'views', 'login.html');
const signedIn = q => { try { jwt.verify(q.cookies.t, SECRET); return true; } catch (e) { return false; } };
app.get('/', (q, s) => signedIn(q) ? s.sendFile(APP_PAGE) : s.type('html').send(LANDING));
app.get(['/collect', '/collect/:tab', '/inbox', '/analyze', '/archive', '/saved', '/gaps', '/gaps/:id', '/watch', '/watch/:id', '/tiktok', '/tiktok/:id', '/integrations', '/settings', '/subscribers'],
  (q, s) => signedIn(q) ? s.sendFile(APP_PAGE) : s.redirect('/login?next=' + encodeURIComponent(q.path)));
app.get('/spy', (q, s) => s.redirect(301, '/gaps'));   // أدوات التجسس حُذفت؛ القسم الجديد مكانها
app.get(['/login', '/register', '/forgot', '/reset'], (q, s) => (q.path !== '/reset' && signedIn(q)) ? s.redirect('/') : s.sendFile(LOGIN_PAGE));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));
// منطق الأسواق وفحص المنتج مشترك بين الخادم والمتصفح (ملف واحد لكل منطق)
app.get('/radar-lib/core.js', (q, s) => s.type('application/javascript').set('Cache-Control', 'no-cache').sendFile(path.join(__dirname, 'engine', 'core.js')));   // محرك التحليل للخيط الخلفي
app.get(['/radar-lib/kwdata.js', '/radar-lib/markets.js', '/radar-lib/productcheck.js', '/radar-lib/gapmatch.js'], (q, s) => s.type('application/javascript').set('Cache-Control', 'no-cache').sendFile(path.join(__dirname, 'adlib', 'lib', path.basename(q.path))));
app.use((e, q, s, n) => { if (!e.status || e.status >= 500) { console.error(e); BX.logError && BX.logError(e, q); } s.status(e.status || 500).json({ error: e.status ? e.message : 'server' }); });
app.listen(+process.env.PORT || 3000, () => console.log('Radar platform on :' + (process.env.PORT || 3000)));
