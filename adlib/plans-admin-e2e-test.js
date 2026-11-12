'use strict';
// اختبار متصفح لمحرّر «العروض والمميزات»: الحدود (0 = غير متاح، فارغ = بلا حد) تبقى بعد الحفظ وإعادة التحميل،
// ترتيب المميزات والباقات، وإخفاء الميزة غير المشمولة بدل شطبها، وظهور كل ذلك فوراً في صفحة الأسعار.
// التشغيل: node adlib/plans-admin-e2e-test.js
const { spawn } = require('child_process'), assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require('playwright');
const PORT = 5200 + Math.floor(Math.random() * 80), BASE = 'http://127.0.0.1:' + PORT, DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-plans-'));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok', m); };

(async () => {
  const env = Object.assign({}, process.env, { PORT, JWT_SECRET: 'x'.repeat(40), ADMIN_EMAIL: 'a@t.dz', DB_FILE: path.join(DIR, 'd.db'), NODE_ENV: 'test', BACKUP_DISABLE: '1' });
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stderr.on('data', d => log += d);
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  const b = await chromium.launch();
  try {
    const pg = await b.newPage({ locale: 'ar-DZ', viewport: { width: 1366, height: 1000 } });
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(BASE + '/login');
    await pg.request.post(BASE + '/api/register', { data: { email: 'a@t.dz', password: 'password123', name: 'admin' } });
    const open = async () => { await pg.goto(BASE + '/payments'); await pg.click('.adm-t button:has-text("العروض والمميزات")'); await pg.waitForSelector('#pl-t [data-pl] [data-f="name"]'); };
    const card = n => `#pl-t [data-pl]:has([data-f="name"][value="${n}"])`;
    const save = async () => { await pg.click('[data-adm="saveall"] >> nth=0'); await pg.waitForFunction(() => [...document.querySelectorAll('.toast')].some(t => /حُفظت الباقات/.test(t.textContent))); await pg.waitForTimeout(400); };
    await open();

    // ---- الحدود: 0 للتجربة، فارغ (بلا حد) للاحترافية، 77 للأساسية
    await pg.fill(card('تجربة مجانية') + ' [data-l="aiPerMonth"]', '0');
    await pg.fill(card('الاحترافية') + ' [data-l="aiPerMonth"]', '');
    await pg.fill(card('الأساسية') + ' [data-l="aiPerMonth"]', '77');
    // ---- الترتيب: TikTok إلى أعلى القائمة، والاحترافية قبل المتقدمة
    for (let i = 0; i < 6; i++) { const up = await pg.$('#ft-t tr[data-fk="tiktok"] [data-adm="fmv"][data-d="-1"]'); await up.click(); }
    await pg.click(card('الاحترافية') + ' [data-adm="plmv"][data-d="-1"]');
    // ---- ميزة غير مشمولة: Google Sheets ليست في الأساسية، وتُخفى بدل الشطب
    await pg.uncheck(card('الأساسية') + ' [data-ft="sheets"]');
    await pg.selectOption('#ft-miss', 'hide');
    await save();

    await pg.reload(); await open();
    const val = (n, k) => pg.inputValue(card(n) + ` [data-l="${k}"]`);
    ok(await val('تجربة مجانية', 'aiPerMonth') === '0', '0 (not available) stays 0 after save and reload (it used to fall back to 100)');
    ok(await val('الاحترافية', 'aiPerMonth') === '', 'an empty limit stays empty = unlimited');
    ok(await val('الأساسية', 'aiPerMonth') === '77', 'a changed AI limit stays after save and reload');
    ok(await pg.$eval('#ft-t tr[data-fk]', tr => tr.dataset.fk) === 'tiktok', 'feature order is saved (TikTok moved to the top)');
    ok((await pg.$$eval('#pl-t [data-pl] [data-f="name"]', x => x.map(i => i.value).filter(Boolean))).join() === 'تجربة مجانية,الأساسية,الاحترافية,المتقدمة', 'plan order is saved');
    ok(await pg.$eval('#ft-miss', s => s.value) === 'hide', 'the "hide not-included features" choice is saved');

    // ---- صفحة الأسعار العامة: تتغير فوراً (بلا تخزين مؤقت)
    const pub = await pg.request.get(BASE + '/api/plans/public');
    ok(/no-cache/.test(pub.headers()['cache-control']), 'public price list is not cached, so changes show at once');
    const v = await b.newPage({ locale: 'ar-DZ', viewport: { width: 1366, height: 1000 } });
    await v.goto(BASE + '/?lang=ar'); await v.waitForSelector('#plans .plan h3');
    const cards = await v.$$eval('#plans .plan', x => x.map(c => ({ n: c.querySelector('h3').textContent, t: c.textContent, li: [...c.querySelectorAll('li')].map(l => l.textContent) })));
    ok(cards.map(c => c.n).join() === 'الأساسية,الاحترافية,المتقدمة', 'pricing page shows the plans in the saved order');
    const basic = cards[0], pro = cards[1];
    ok(!basic.t.includes('Google Sheets') && pro.t.includes('Google Sheets'), 'a feature not in a plan is hidden from that plan card');
    ok(basic.li[2].includes('TikTok'), 'pricing page shows features in the saved order');
    ok(basic.li.some(l => /الذكاء الاصطناعي.*77/.test(l)) && pro.li.some(l => /الذكاء الاصطناعي.*بلا حد/.test(l)), 'AI line shows 77/month for Basic and "unlimited" for Professional');
    // الشطب من جديد
    await pg.selectOption('#ft-miss', 'strike'); await save();
    await v.reload(); await v.waitForSelector('#plans .plan h3');
    ok(await v.$eval('#plans .plan', c => [...c.querySelectorAll('li.off')].some(l => l.textContent.includes('Google Sheets'))), 'switching back: the missing feature is shown crossed out');

    // ---- الحدود تُطبَّق على المشترك: التجربة (0 ذكاء اصطناعي) = غير متاح
    const u = await b.newPage({ locale: 'ar-DZ' });
    await u.request.post(BASE + '/api/register', { data: { email: 'u@t.dz', password: 'password123', name: 'U' } });
    const bl = await (await u.request.get(BASE + '/api/billing')).json();
    ok(bl.limits.aiPerMonth === 0, 'a trial subscriber gets 0 AI requests (not the default 100)');
    // ---- رابط الإضافة في متجر Chrome: يُتحقق منه، ويغيّر خطوات التثبيت
    ok((await pg.request.put(BASE + '/api/admin/config', { data: { ext_store_url: 'https://evil.example/x' } })).status() === 400, 'a store link that is not a Chrome Web Store link is refused');
    const SU = 'https://chromewebstore.google.com/detail/winning-product-radar/abcdefghijklmnopabcdefghijklmnop';
    ok((await pg.request.put(BASE + '/api/admin/config', { data: { ext_store_url: SU } })).ok(), 'the Chrome Web Store link is saved');
    await u.goto(BASE + '/collect/extension'); await u.waitForSelector('.l-steps');
    ok(await u.$eval(`a[href="${SU}"]`, a => /متجر Chrome/.test(a.textContent)) && /إضافة إلى Chrome/.test(await u.textContent('#l-body')), 'subscribers install from the Chrome Web Store (Add to Chrome)');
    ok(await u.$eval('details.fx summary', s => /تثبيت يدوي/.test(s.textContent)), 'manual ZIP install stays available as an alternative');
    await u.goto(BASE + '/guide'); await u.waitForTimeout(600);
    ok(/إضافة إلى Chrome/.test(await u.textContent('body')) && !/وضع المطوّر/.test(await u.textContent('body')), 'the usage guide shows the Chrome Web Store steps');
    ok(!errs.length, 'no page errors ' + errs.join(' | '));
    console.log(`PASS ${pass} plans editor checks`);
  } catch (e) { console.error('FAIL', e.message); console.error(log.slice(-1200)); process.exitCode = 1; }
  finally { await b.close(); srv.kill(); fs.rmSync(DIR, { recursive: true, force: true }); }
})();
