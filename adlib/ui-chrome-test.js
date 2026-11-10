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
    const groups = await pg.$$eval('.nvh', a => a.filter(x => x.offsetParent !== null).map(x => x.textContent.trim()));   // المشترك لا يرى مجموعة «الإدارة»
    ok(groups.join('|') === 'البحث اليومي|منتجاتي|الربط والمساعدة', 'مجموعات القائمة: ' + groups.join('، '));
    ok(await pg.isVisible('.nv[data-v="guide"]') && !(await pg.$('.nv[data-v="settings"]')), 'دليل الاستخدام في الأعلى، والإعدادات انتقلت لقائمة الحساب');
    await pg.click('#me-btn'); ok(await pg.isVisible('#am [data-v="settings"]') && await pg.isVisible('#am [data-v="sub"]') && await pg.isVisible('#am [data-a="logout"]'), 'قائمة الحساب: الإعدادات، العرض والدفع، الخروج');
    await pg.click('#am [data-v="sub"]'); await pg.waitForFunction(() => location.pathname === '/subscription' && document.querySelector('#x-billing').textContent.length > 30);
    ok(await pg.isHidden('#am'), '«اشتراكي» يفتح صفحة الاشتراك وتُغلق القائمة');
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
    // الدعم: طلب من المشترك ← ردّ المدير من المنصة ← يظهر في «طلباتي» وتنبيه في لوحة التحكم
    await pg.click('.wd-lang'); await pg.click('[data-lang="ar"]'); await pg.waitForLoadState('load');
    await pg.goto(BASE + '/help'); await pg.waitForSelector('#hf-m');
    ok(await pg.isVisible('.hc-hero #hc-q') && (await pg.$$('.hf-q')).length >= 12 && !(await pg.$('[data-a="onbshow"]')), 'مركز المساعدة: بحث + أسئلة مصنّفة، بلا «إظهار دليل البداية» المكرر');
    await pg.fill('#hc-q', 'واتساب'); await pg.waitForTimeout(200); const shown = await pg.$$eval('.hf-q', a => a.filter(x => !x.hidden).length);
    ok(shown >= 1 && shown < 14, 'البحث في الأسئلة يصفّي (' + shown + ')');
    await pg.selectOption('#hf-c', 'billing'); await pg.fill('#hf-s', 'تفعيل العرض'); await pg.fill('#hf-m', 'أرسلت الوصل عبر واتساب، متى يُفعَّل؟'); await pg.click('[data-a="hsend"]');
    await pg.waitForSelector('.hc-t'); ok(/قيد المراجعة/.test(await pg.innerText('.hc-t')), '«طلباتي»: الطلب قيد المراجعة');
    const A = await b.newContext({ locale: 'ar-DZ', viewport: { width: 1280, height: 860 } }), ap = await A.newPage(); ap.on('pageerror', e => errs.push('A ' + e.message));
    await ap.request.post(BASE + '/api/register', { data: { email: 'a@t.dz', password: 'password123' } });
    await ap.goto(BASE + '/'); await ap.waitForSelector('#nav-admin:not([hidden])');
    ok((await ap.$$eval('#nav-admin .nv', a => a.map(x => x.dataset.v))).join(',') === 'aover,admin,abill,ainbox,aset', 'قائمة الإدارة: نظرة عامة، المشتركون، العروض والمدفوعات، صندوق الدعم، إعدادات المنصة');
    await ap.waitForFunction(() => !document.getElementById('nb-sup').hidden); ok(true, 'شارة الرسائل الجديدة على «صندوق الدعم»');
    await ap.click('.nv[data-v="ainbox"]'); await ap.waitForSelector('[data-reply]');
    ok(/الدفع والعروض/.test(await ap.innerText('.sup-t')), 'نوع الطلب ظاهر للمدير');
    await ap.fill('[data-reply]', 'فُعّل عرضك، شكراً لك.'); await ap.click('[data-adm="mreply"]'); await ap.waitForFunction(() => !document.querySelector('[data-reply]'));
    await ap.goto(BASE + '/platform'); await ap.waitForSelector('[data-cfg="biz_name"]'); ok(!!(await ap.$('#t-aset [data-adm="legal"]')) && !!(await ap.$('#t-aset [data-adm="backup"]')), 'إعدادات المنصة: النشاط، المفاتيح، الصفحات القانونية، النسخ الاحتياطي');
    await pg.goto(BASE + '/'); await pg.waitForSelector('.dsum'); await pg.waitForSelector('.dal'); ok(/ردّ فريق الدعم/.test(await pg.innerText('.dal')), 'تنبيه في لوحة التحكم: ردّ الدعم');
    await pg.click('.dal-i[data-v="help"]'); await pg.waitForSelector('.hc-t .sup-r'); ok(/فُعّل عرضك/.test(await pg.innerText('.hc-t')), 'الرد ظاهر في «طلباتي»');
    await pg.goto(BASE + '/'); await pg.waitForSelector('.dsum'); ok(!/ردّ فريق الدعم/.test(await pg.innerText('#d-body')), 'التنبيه يختفي بعد قراءة الرد');
    await pg.click('[data-a="dper"][data-d="7"]'); await pg.waitForFunction(() => /7/.test(document.querySelector('.dsum h2').textContent)); ok(true, 'أزرار الفترة في الملخص');
    ok(await pg.evaluate(() => document.querySelectorAll('#d-body i.ico svg').length > 0 && !/[\u{1F300}-\u{1FAFF}]/u.test(document.getElementById('wpr-app').innerText)), 'أيقونات خطية بدل الإيموجي في اللوحة');
    const lp = await b.newPage({ viewport: { width: 1280, height: 860 } }); await lp.goto(BASE + '/'); await lp.waitForSelector('.mimg svg');
    ok((await lp.$$('.mimg svg')).length === 3 && !/[\u{1F300}-\u{1FAFF}]/u.test(await lp.innerText('body')), 'الواجهة: أيقونات المنتجات وبلا إيموجي');
    ok(await lp.evaluate(() => { const a = [...document.querySelectorAll('footer nav a')].filter(x => x.offsetParent); return a.length >= 5 && a.every(x => Math.abs(x.getBoundingClientRect().top - a[0].getBoundingClientRect().top) < 4); }), 'روابط الفوتر في صف أفقي واحد');
    ok(!errs.length, 'لا أخطاء جافاسكربت ' + errs.join(' | '));
    console.log(`PASS ${pass} ui checks`);
  } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; }
  finally { await b.close(); srv.kill(); }
})();
