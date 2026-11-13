'use strict';
// اختبار الأمان: ترويسات الحماية، قفل الحساب بعد محاولات فاشلة، حد التسجيل، إغلاق الجلسات الأخرى عند تغيير كلمة المرور،
// الخروج من كل الأجهزة، سجل النشاط وصلاحياته. التشغيل: node adlib/security-test.js
const { spawn } = require('child_process'), assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const PORT = 5100 + Math.floor(Math.random() * 80), BASE = 'http://127.0.0.1:' + PORT, DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-sec-'));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; };
function client(ip) {
  let cookie = '';
  const f = async (method, url, body) => {
    const r = await fetch(BASE + url, { method, redirect: 'manual', headers: Object.assign({ cookie, 'x-forwarded-for': ip }, body ? { 'content-type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch (e) { j = t; } return { status: r.status, body: j, headers: r.headers };
  };
  f.cookie = () => cookie; f.setCookie = c => { cookie = c; };
  return f;
}
(async () => {
  const env = Object.assign({}, process.env, { PORT, JWT_SECRET: 'x'.repeat(40), ADMIN_EMAIL: 'admin@t.dz', DB_FILE: path.join(DIR, 'd.db'), NODE_ENV: 'test' });
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stderr.on('data', d => log += d);
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/login'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  try {
    const A = client('10.0.0.1'), U = client('10.0.0.2');
    const h = (await A('GET', '/login')).headers;
    ok(h.get('x-frame-options') === 'DENY' && h.get('x-content-type-options') === 'nosniff' && /strict-origin/.test(h.get('referrer-policy') || ''), 'security headers on every page');
    ok((await A('POST', '/api/register', { email: 'admin@t.dz', password: 'password123' })).status === 200, 'admin register');
    ok((await U('POST', '/api/register', { email: 'u@t.dz', password: 'password123' })).status === 200, 'user register');
    // حد التسجيل: 5 حسابات في الساعة من نفس العنوان
    const R = client('10.0.0.9'); let last = 0;
    for (let i = 0; i < 6; i++) last = (await R('POST', '/api/register', { email: 'spam' + i + '@t.dz', password: 'password123' })).status;
    ok(last === 429, 'sixth account from the same address within an hour is refused');
    // قفل الحساب: محاولات من عناوين مختلفة
    for (let i = 0; i < 8; i++) await client('10.1.0.' + i)('POST', '/api/login', { email: 'u@t.dz', password: 'wrong' + i });
    ok((await client('10.2.0.1')('POST', '/api/login', { email: 'u@t.dz', password: 'password123' })).status === 429, 'account locks after 8 wrong passwords even from different addresses');
    ok((await client('10.2.0.2')('POST', '/api/login', { email: 'admin@t.dz', password: 'password123' })).status === 200, 'other accounts are not affected');
    // تغيير كلمة المرور يغلق الجلسات الأخرى
    const D1 = client('10.3.0.1'), D2 = client('10.3.0.2');
    D1.setCookie(U.cookie()); D2.setCookie(U.cookie());
    ok((await D2('GET', '/api/me')).status === 200, 'second device is signed in');
    ok((await D1('POST', '/api/password', { old: 'password123', password: 'newpassword1' })).status === 200, 'password changed');
    ok((await D1('GET', '/api/me')).status === 200, 'the device that changed it stays signed in');
    ok((await D2('GET', '/api/me')).status === 401, 'other devices are signed out');
    // الخروج من كل الأجهزة
    const D3 = client('10.3.0.3'); D3.setCookie(D1.cookie());
    ok((await D1('POST', '/api/logout-all', {})).status === 200 && (await D3('GET', '/api/me')).status === 401, 'sign out of all devices works');
    // سجل النشاط
    const L = client('10.4.0.1'); ok((await L('POST', '/api/login', { email: 'admin@t.dz', password: 'password123' })).status === 200, 'admin login');
    const act = (await L('GET', '/api/activity')).body;
    ok(Array.isArray(act) && act.some(a => a.kind === 'login'), 'user sees own recent logins');
    const all = (await L('GET', '/api/admin/activity')).body;
    ok(all.some(a => a.kind === 'login_fail' && a.email === 'u@t.dz') && all.some(a => a.kind === 'password'), 'admin log shows failed logins and password changes');
    const U2 = client('10.5.0.1'); await U2('POST', '/api/login', { email: 'spam0@t.dz', password: 'password123' });
    ok((await U2('GET', '/api/admin/activity')).status === 403, 'members cannot read the admin log');
    // ---- v13.18 (فحص الأمان) ----
    // 1) رمز «بانتظار التحقق بخطوتين» لا يصلح ككوكي جلسة (كان يتخطى رمز التطبيق بكلمة المرور وحدها)
    const TOTP = require('./totp.js'), F = client('10.6.0.1');
    await F('POST', '/api/register', { email: 'tf@t.dz', password: 'password123' });
    const st = (await F('POST', '/api/2fa/setup', {})).body;
    ok((await F('POST', '/api/2fa/enable', { code: TOTP.hotp(st.secret, Math.floor(Date.now() / 30000)) })).status === 200, '2FA enabled');
    const G = client('10.6.0.2'), lg = (await G('POST', '/api/login', { email: 'tf@t.dz', password: 'password123' })).body;
    ok(lg.need2fa && lg.t && !G.cookie(), 'password alone gives only a pending 2FA token, no session cookie');
    G.setCookie('t=' + lg.t);
    ok((await G('GET', '/api/me')).status === 401, 'the pending 2FA token is refused as a session cookie (2FA cannot be skipped)');
    ok((await G('GET', '/login')).status === 200, 'the pending 2FA token does not count as signed in');
    ok((await G('POST', '/api/login/2fa', { t: lg.t, code: TOTP.hotp(st.secret, Math.floor(Date.now() / 30000)) })).status === 200 && (await G('GET', '/api/me')).status === 200, 'with the app code, sign-in completes normally');
    // 2) رمز بلا توقيع (alg: none) مرفوض
    const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
    const N = client('10.6.0.3'); N.setCookie('t=' + b64({ alg: 'none', typ: 'JWT' }) + '.' + b64({ id: 1, v: 0 }) + '.');
    ok((await N('GET', '/api/me')).status === 401, 'an unsigned token (alg none) is refused');
    // 3) رابط استعادة كلمة المرور لا يأخذ الدومين من ترويسة Host (تسميم الرابط)
    const uid = (await L('GET', '/api/admin/users')).body; const tid = (Array.isArray(uid) ? uid : uid.users || []).find(x => x.email === 'tf@t.dz').id;
    const link = await new Promise((res, rej) => { const r = require('http').request(BASE + '/api/admin/users/' + tid + '/reset-link', { method: 'POST', headers: { host: 'evil.example', cookie: L.cookie(), 'content-type': 'application/json', 'x-forwarded-for': '10.4.0.1' } }, rs => { let d = ''; rs.on('data', c => d += c); rs.on('end', () => res(d)); }); r.on('error', rej); r.end('{}'); });
    ok(/^https:\/\/winningproductradar\.com\/reset\?t=/.test(JSON.parse(link).url), 'reset links use the platform domain, never the Host header');
    // 4) بعد أن يغيّر المدير بريده، لا يستطيع أحد أخذ صلاحية المدير بالتسجيل ببريد ADMIN_EMAIL
    ok((await L('PUT', '/api/profile', { email: 'boss@t.dz', password: 'password123' })).status === 200, 'admin changes their email');
    ok((await client('10.6.0.4')('POST', '/api/login', { email: 'boss@t.dz', password: 'password123' })).status === 200, 'admin signs in with the new email');
    const H = client('10.6.0.5'); ok((await H('POST', '/api/register', { email: 'admin@t.dz', password: 'password123' })).status === 200, 'someone registers the old ADMIN_EMAIL');
    ok((await H('GET', '/api/me')).body.role === 'member' && (await H('GET', '/api/admin/activity')).status === 403, '…but gets a normal member account, not admin');
    console.log(`PASS ${pass} security checks`);
  } catch (e) { console.error('FAIL', e.message); console.error(log.slice(-1200)); process.exitCode = 1; }
  finally { srv.kill(); fs.rmSync(DIR, { recursive: true, force: true }); }
})();
