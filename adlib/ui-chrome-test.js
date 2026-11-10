'use strict';
// v13: القائمة الجانبية المقسّمة + الطيّ + قائمة الحساب، الأزرار العائمة (واتساب/اللغة/الوضع)، الوضع الليلي في كل الصفحات، دليل الاستخدام.
// التشغيل: node adlib/ui-chrome-test.js
const { spawn } = require('child_process'), assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require('playwright');
const PORT = 6010 + Math.floor(Math.random() * 50), BASE = 'http://127.0.0.1:' + PORT, DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-ui-'));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok', m); };
const bg = pg => pg.evaluate(() => getComputedStyle(document.body).backgroundColor);
const dark = c => { const m = c.match(/\d+/g).map(Number); return m[0] + m[1] + m[2] < 200; };
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: Object.assign({}, process.env, { PORT, JWT_SECRET: 'u'.repeat(40), ADMIN_EMAIL: 'a@t.dz', DB_FILE: path.join(DIR, 'd.db'), NODE_ENV: 'test', BACKUP_DISABLE: '1', SUPPORT_WHATSAPP: '+213 555 00 11 22' }), stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ locale: 'ar-DZ', colorScheme: 'light', viewport: { width: 1280, height: 860 } }), pg = await ctx.newPage(), errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.request.post(BASE + '/api/register', { data: { email: 'u@t.dz', password: 'password123', name: 'Amine' } });
    await pg.goto(BASE + '/'); await pg.waitForSelector('.onb');
    // القائمة
    const groups = await pg.$$eval('.nvh', a => a.map(x => x.textContent.trim()));
    ok(groups.join('|') === 'البحث اليومي|منتجاتي|حسابي', 'مجموعات القائمة: ' + groups.join('، '));
    ok(await pg.isVisible('.nv[data-v="guide"]') && !(await pg.$('.nv[data-v="settings"]')), 'دليل الاستخدام في الأعلى، والإعدادات انتقلت لقائمة الحساب');
    await pg.click('#me-btn'); ok(await pg.isVisible('#am [data-v="settings"]') && await pg.isVisible('#am [data-a="billing"]') && await pg.isVisible('#am [data-a="logout"]'), 'قائمة الحساب: الإعدادات، العرض والدفع، الخروج');
    await pg.click('#am [data-a="billing"]'); await pg.waitForFunction(() => location.pathname === '/settings' && document.querySelector('#x-billing').textContent.length > 30);
    ok(await pg.isHidden('#am'), 'العرض والدفع يفتح الإعدادات وتُغلق القائمة');
    await pg.click('#sbc'); ok((await pg.$eval('#sb', e => e.getBoundingClientRect().width)) < 100, 'طيّ القائمة');
    await pg.reload(); await pg.waitForSelector('#sb'); ok(await pg.$eval('#wpr-app', e => e.classList.contains('sbmini')), 'الطيّ محفوظ بعد التحديث');
    await pg.click('#sbc');
    // الأزرار العائمة والوضع الليلي
    await pg.waitForFunction(() => { const a = document.getElementById('wa'); return a && !a.hidden; });
    ok(/wa\.me\/213555001122/.test(await pg.getAttribute('#wa', 'href')) && await pg.isVisible('.wd-lang') && await pg.isVisible('.wd-th'), 'الأزرار العائمة: واتساب + اللغة + الوضع');
    ok(!dark(await bg(pg)), 'الوضع النهاري افتراضياً (جهاز فاتح)');
    await pg.click('.wd-th'); await pg.waitForTimeout(200); ok(dark(await bg(pg)), 'زر الوضع: ليلي');
    await pg.goto(BASE + '/terms'); await pg.waitForTimeout(300); ok(dark(await bg(pg)), 'الوضع الليلي محفوظ في الصفحات القانونية');
    await pg.goto(BASE + '/login'); await pg.waitForTimeout(300);
    await pg.goto(BASE + '/'); await pg.waitForTimeout(300); ok(dark(await bg(pg)), '…وفي لوحة التحكم');
    await pg.click('.wd-th'); await pg.waitForTimeout(200); ok(!dark(await bg(pg)), 'العودة للنهاري');
    // الدليل
    await pg.goto(BASE + '/guide'); await pg.waitForSelector('.gd-st');
    const n = await pg.$$eval('.gd-st', a => a.length); ok(n >= 15 && (await pg.$$eval('.gd-toc a', a => a.length)) === n, 'دليل الاستخدام: ' + n + ' خطوة + فهرس');
    ok((await pg.$$('.gd-st .gm .mk')).length >= n * 2, 'صور توضيحية بعلامات مرقّمة');
    await pg.click('#gd-12 [data-v]'); await pg.waitForFunction(() => location.pathname === '/gaps'); ok(true, '«افتح هذه الصفحة» ينقل للقسم');
    // تغيير اللغة من الزر العائم
    await pg.goto(BASE + '/guide'); await pg.waitForSelector('.gd-st'); await pg.click('.wd-lang'); await pg.click('[data-lang="fr"]');
    await pg.waitForFunction(() => document.querySelector('.gd-st h2') && /Installez/.test(document.querySelector('.gd-st h2').textContent), null, { timeout: 15000 });
    ok(/Recherche quotidienne/i.test(await pg.innerText('#sb')), 'اللغة من الزر العائم: الدليل والقائمة بالفرنسية');
    const pub = await ctx.newPage(); await pub.goto(BASE + '/login'); await pub.waitForSelector('.wpr-dock'); ok(await pub.isVisible('.wd-th'), 'الأزرار العائمة في صفحة الدخول');
    ok(!errs.length, 'لا أخطاء جافاسكربت ' + errs.join(' | '));
    console.log(`PASS ${pass} ui checks`);
  } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; }
  finally { await b.close(); srv.kill(); }
})();
