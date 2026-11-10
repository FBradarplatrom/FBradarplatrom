'use strict';
// أمان الحساب: التحقق بخطوتين (تفعيل بـ QR، دخول بالرمز، رمز استرجاع لمرة واحدة، إيقاف) + صفحات الحساب الثلاث.
// التشغيل: node adlib/security-2fa-test.js
const { spawn } = require('child_process'), assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require('playwright'); const T = require('./totp.js');
const PORT = 6070 + Math.floor(Math.random() * 50), BASE = 'http://127.0.0.1:' + PORT, DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-2fa-'));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok', m); };
const code = sec => T.hotp(sec, Math.floor(Date.now() / 30000));
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: Object.assign({}, process.env, { PORT, JWT_SECRET: 'z'.repeat(40), ADMIN_EMAIL: 'a@t.dz', DB_FILE: path.join(DIR, 'd.db'), NODE_ENV: 'test', BACKUP_DISABLE: '1' }), stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ locale: 'ar-DZ', viewport: { width: 1280, height: 900 } }), pg = await ctx.newPage(), errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.request.post(BASE + '/api/register', { data: { email: 'a@t.dz', password: 'password123' } });
    await pg.request.post(BASE + '/api/register', { data: { email: 'u@t.dz', password: 'password123', name: 'Amine' } });
    await pg.goto(BASE + '/'); await pg.waitForSelector('.dsum'); await pg.waitForSelector('.dal');
    ok(/التحقق بخطوتين/.test(await pg.innerText('.dal')), 'لوحة التحكم تنبّه: فعّل التحقق بخطوتين');
    await pg.click('#me-btn'); const items = await pg.$$eval('#am .am-i span', a => a.map(x => x.textContent.trim()));
    ok(items.join('|') === 'الملف الشخصي|اشتراكي|أمان الحساب|تسجيل الخروج', 'قائمة الحساب: ' + items.join('، '));
    await pg.click('#am [data-v="sub"]'); await pg.waitForFunction(() => location.pathname === '/subscription' && document.querySelector('#x-billing').textContent.length > 30);
    ok(/الاشتراك/.test(await pg.innerText('#x-billing')) && (await pg.$$('#x-billing .meter')).length >= 1, '«اشتراكي»: العرض والدفع في صفحة مستقلة');
    await pg.goto(BASE + '/settings'); await pg.waitForSelector('[data-form="profile"]'); ok(!(await pg.$('[data-form="password"]')) && !(await pg.$('#x-billing:not(:empty) .meter')), '«الملف الشخصي»: البيانات فقط (كلمة المرور في الأمان)');
    // التفعيل
    await pg.goto(BASE + '/security'); await pg.waitForSelector('.sec-h.warn');
    await pg.click('#sec-2fa [data-a="2fa-start"]'); await pg.waitForSelector('#sec-qr svg');
    const sec = (await pg.innerText('#sec-2fa code')).replace(/\s/g, '');
    ok(/^[A-Z2-7]{32}$/.test(sec), 'رمز QR + المفتاح اليدوي');
    await pg.fill('[data-form="2fa-on"] [name="code"]', '000000'); await pg.click('[data-form="2fa-on"] button'); await pg.waitForTimeout(500);
    ok(await pg.isVisible('#sec-qr'), 'رمز خاطئ: لا تفعيل');
    await pg.fill('[data-form="2fa-on"] [name="code"]', code(sec)); await pg.click('[data-form="2fa-on"] button'); await pg.waitForSelector('.sec-codes code');
    const rec = await pg.$$eval('.sec-codes code', a => a.map(x => x.textContent.trim()));
    ok(rec.length === 8 && rec.every(c => /^[0-9a-f]{5}-[0-9a-f]{5}$/.test(c)), '8 رموز استرجاع تظهر مرة واحدة');
    await pg.click('[data-a="2fa-done"]'); await pg.waitForSelector('.sec-h.ok'); ok(/محمي بخطوتين/.test(await pg.innerText('.sec-h')), 'الحالة: حسابك محمي بخطوتين');
    // الدخول بخطوتين من صفحة الدخول
    const c2 = await b.newContext({ locale: 'ar-DZ' }), lp = await c2.newPage();
    await lp.goto(BASE + '/login'); await lp.fill('#l-id', 'u@t.dz'); await lp.fill('#l-pw', 'password123'); await lp.click('#f-login button[type="submit"]');
    await lp.waitForSelector('#f-2fa:not([hidden])'); ok(true, 'بعد كلمة المرور: يُطلب رمز التطبيق');
    ok((await (await lp.request.get(BASE + '/api/me')).status()) === 401, 'لا جلسة قبل الرمز');
    await lp.fill('#t-code', '123456'); await lp.click('#f-2fa button[type="submit"]'); await lp.waitForSelector('#msg .msg'); ok(/غير صحيح/.test(await lp.innerText('#msg')), 'رمز خاطئ يُرفض');
    await lp.fill('#t-code', code(sec)); await Promise.all([lp.waitForURL(u => !/login/.test(u.pathname)), lp.click('#f-2fa button[type="submit"]')]);
    ok((await (await lp.request.get(BASE + '/api/me')).json()).totp_on === true, 'الدخول بالرمز الصحيح');
    // رمز استرجاع لمرة واحدة (عبر الواجهة البرمجية)
    const step = async () => (await (await fetch(BASE + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'u@t.dz', password: 'password123' }) })).json()).t;
    const r1 = await fetch(BASE + '/api/login/2fa', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ t: await step(), code: rec[0] }) });
    const r2 = await fetch(BASE + '/api/login/2fa', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ t: await step(), code: rec[0] }) });
    ok(r1.status === 200 && r2.status === 400, 'رمز الاسترجاع يعمل مرة واحدة فقط');
    // الإيقاف
    await pg.goto(BASE + '/security'); await pg.waitForSelector('.sec-h.ok');
    ok(/بقي 7/.test(await pg.innerText('#sec-2fa')), 'عدد رموز الاسترجاع المتبقية');
    await pg.click('#sec-2fa summary'); await pg.fill('[data-form="2fa-off"] [name="password"]', 'password123'); await pg.fill('[data-form="2fa-off"] [name="code"]', code(sec)); await pg.click('[data-form="2fa-off"] button');
    await pg.waitForSelector('.sec-h.warn'); ok(true, 'إيقاف التحقق بخطوتين بكلمة المرور + الرمز');
    ok((await (await fetch(BASE + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'u@t.dz', password: 'password123' }) })).json()).ok === 1, 'بعد الإيقاف: الدخول بكلمة المرور وحدها');
    ok(/محاولة دخول فاشلة|الأجهزة/.test(await pg.innerText('#x-sec')) && (await pg.$$('.sec-d')).length >= 1, 'الأجهزة وعمليات الدخول');
    ok(!errs.length, 'لا أخطاء جافاسكربت ' + errs.join(' | '));
    // المدير: قسم المشتركين بلا خطأ
    const ac = await b.newContext({ locale: 'ar-DZ' }), ap = await ac.newPage(), aerr = []; ap.on('pageerror', e => aerr.push(e.message));
    await ap.request.post(BASE + '/api/login', { data: { email: 'a@t.dz', password: 'password123' } });
    await ap.goto(BASE + '/subscribers'); await ap.waitForSelector('#x-users table'); await ap.waitForTimeout(500);
    ok(!aerr.length && !(await ap.evaluate(() => [...document.querySelectorAll('.toast,#toast,[class*=toast]')].some(t => /WPRACC/.test(t.textContent)))), 'قسم المشتركين بلا رسالة خطأ');
    console.log(`PASS ${pass} security checks`);
  } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; }
  finally { await b.close(); srv.kill(); }
})();
