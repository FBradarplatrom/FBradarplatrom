'use strict';
// الإحصائيات الشاملة (البلد من المتصفح، المتصلون، التسجيلات، الاستعمال) + وضع الصيانة. التشغيل: node adlib/stats-maint-e2e-test.js
const { spawn } = require('child_process'), assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require('playwright');
const PORT = 6700 + Math.floor(Math.random() * 60), BASE = 'http://127.0.0.1:' + PORT, DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-st-'));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok', m); };
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: Object.assign({}, process.env, { PORT, JWT_SECRET: 'm'.repeat(40), ADMIN_EMAIL: 'a@t.dz', DB_FILE: path.join(DIR, 'd.db'), NODE_ENV: 'test', BACKUP_DISABLE: '1' }), stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  const b = await chromium.launch();
  try {
    const A = await b.newContext({ locale: 'ar-DZ', timezoneId: 'Africa/Algiers', viewport: { width: 1300, height: 950 } }), ap = await A.newPage(), errs = []; ap.on('pageerror', e => errs.push(e.message));
    await ap.request.post(BASE + '/api/register', { data: { email: 'a@t.dz', password: 'password123' } });
    // مشتركان من بلدين (البلد من المنطقة الزمنية للمتصفح)
    for (const [em, tz, loc] of [['dz@t.dz', 'Africa/Algiers', 'ar-DZ'], ['fr@t.dz', 'Europe/Paris', 'fr-FR']]) {
      const c = await b.newContext({ locale: loc, timezoneId: tz }), p = await c.newPage();
      await p.request.post(BASE + '/api/register', { data: { email: em, password: 'password123', name: em.slice(0, 2) } });
      await p.goto(BASE + '/'); await p.waitForSelector('#d-head'); await p.waitForTimeout(500); await c.close();
    }
    const st = await (await ap.request.get(BASE + '/api/admin/stats')).json();
    ok(st.subs.members === 2 && st.subs.trialActive === 2 && st.subs.paidActive === 0 && st.subs.new1 === 2, 'المشتركون: 2 في التجربة، 0 يدفع، 2 تسجيل اليوم');
    ok(st.geo.countries.some(x => x.c === 'DZ' && x.n === 1) && st.geo.countries.some(x => x.c === 'FR' && x.n === 1), 'البلدان من المتصفح: الجزائر وفرنسا');
    ok(st.subs.dau === 2 && st.regs.length === 30 && st.regs[29].n === 2 && st.system.version && st.work && typeof st.work.adsAll === 'number', 'النشطون اليوم، التسجيلات 30 يوماً، النظام، والاستعمال');
    await ap.goto(BASE + '/admin'); await ap.waitForSelector('.st-k'); await ap.waitForTimeout(300);
    const tx = await ap.innerText('#x-aover');
    ok(/متصل الآن/.test(tx) && /الجزائر/.test(tx) && /فرنسا/.test(tx) && /ما يجري في المنصة/.test(tx) && /النظام والخلفية/.test(tx) && /أنشط المشتركين/.test(tx) && /fr@t\.dz/.test(tx), 'صفحة الإحصائيات: المتصلون، البلدان، الاستعمال، النظام، أنشط المشتركين');
    // ---- وضع الصيانة
    await ap.goto(BASE + '/platform/maint'); await ap.waitForSelector('#mt-on');
    await ap.check('#mt-on'); await ap.fill('#mt-msg', 'نضيف ميزات جديدة، نعود بعد ساعة'); await ap.fill('#mt-until', '2030-01-01T10:00');
    ap.once('dialog', d => d.accept()); await ap.click('[data-adm="mtsave"]'); await ap.waitForTimeout(1500); await ap.waitForSelector('.maint-bar');
    ok(/وضع الصيانة مفعّل/.test(await ap.innerText('.maint-bar')), 'المدير يرى شريط «وضع الصيانة مفعّل» ويستعمل المنصة عادياً');
    const M = await b.newContext({ locale: 'ar-DZ' }), mp = await M.newPage();
    const r0 = await mp.goto(BASE + '/'); await mp.waitForSelector('#h'); await mp.waitForTimeout(500);
    ok(r0.status() === 503 && /نُحسّن المنصة الآن/.test(await mp.innerText('#h')) && /نضيف ميزات جديدة/.test(await mp.innerText('#m')) && await mp.isVisible('#u .til') && /wa\.me/.test(await mp.getAttribute('#w a', 'href')), 'الزائر يرى صفحة الصيانة (503) برسالة المدير وموعد العودة وواتساب');
    await mp.request.post(BASE + '/api/login', { data: { email: 'dz@t.dz', password: 'password123' } });
    ok((await mp.request.get(BASE + '/api/me')).status() === 503 && (await (await b.newContext()).request.get(BASE + '/login')).status() === 200 && (await mp.request.get(BASE + '/privacy')).status() === 200, 'المشترك: الواجهة البرمجية 503، وصفحة الدخول والصفحات القانونية متاحة');
    const en = await M.newPage(); await en.goto(BASE + '/?lang=en'); await en.waitForSelector('#h'); ok(/improving the platform/.test(await en.innerText('#h')), 'صفحة الصيانة بلغة الزائر');
    ok((await ap.request.get(BASE + '/maint-preview')).status() === 200 && (await mp.request.get(BASE + '/maint-preview')).status() !== 200, 'معاينة صفحة الصيانة للمدير فقط');
    await ap.goto(BASE + '/platform/maint'); await ap.waitForSelector('#mt-on'); await ap.uncheck('#mt-on'); await ap.click('[data-adm="mtsave"]'); await ap.waitForTimeout(1500);
    const r1 = await mp.goto(BASE + '/'); ok(r1.status() === 200 && !(await (await mp.request.get(BASE + '/api/maint/info')).json()).on, 'إيقاف الصيانة: المنصة متاحة للجميع');
    ok(!errs.length, 'لا أخطاء جافاسكربت ' + errs.join(' | '));
    console.log(`PASS ${pass} stats/maintenance checks`);
  } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; }
  finally { await b.close(); srv.kill(); }
})();
