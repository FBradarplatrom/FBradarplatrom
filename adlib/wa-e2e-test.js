'use strict';
// رسائل واتساب الجاهزة (المدير يعدّلها، المشترك يرسلها من «اشتراكي» و«المساعدة والدعم»)، صفحة «اتصل بنا» بواتساب أولاً، والإشعارات.
// التشغيل: node adlib/wa-e2e-test.js
const { spawn } = require('child_process'), assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require('playwright');
const PORT = 6400 + Math.floor(Math.random() * 60), BASE = 'http://127.0.0.1:' + PORT, DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-wa-'));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok', m); };
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: Object.assign({}, process.env, { PORT, JWT_SECRET: 'w'.repeat(40), ADMIN_EMAIL: 'a@t.dz', DB_FILE: path.join(DIR, 'd.db'), NODE_ENV: 'test', BACKUP_DISABLE: '1', BARIDI_INFO: 'CCP 0012345 clé 67' }), stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  const b = await chromium.launch();
  try {
    const mk = async () => { const c = await b.newContext({ locale: 'ar-DZ', viewport: { width: 1280, height: 900 } }); await c.route('https://wa.me/**', r => r.fulfill({ body: 'wa' })); return c; };
    const A = await mk(), ap = await A.newPage(), errs = []; ap.on('pageerror', e => errs.push(e.message));
    await ap.request.post(BASE + '/api/register', { data: { email: 'a@t.dz', password: 'password123' } });
    // 1) المدير يعدّل رسالة «وصل الدفع»
    await ap.goto(BASE + '/platform/wa'); await ap.waitForSelector('[data-wat="pay"][data-l="ar"]');
    ok((await ap.$$('[data-wat]')).length === 27 && /\{store\}/.test(await ap.innerText('#x-aset')), 'المدير: 5 رسائل للمشترك + 4 رسائله إلى المشتركين × 3 لغات');
    const t0 = await ap.inputValue('[data-wat="pay"][data-l="ar"]');
    await ap.fill('[data-wat="pay"][data-l="ar"]', t0 + '\nمتجري هو {store} وشكراً');
    await ap.click('[data-adm="wasave"]'); await ap.waitForFunction(() => /معدّلة/.test(document.querySelector('#x-aset').innerText));
    ok(/شكراً/.test((await (await ap.request.get(BASE + '/api/wa')).json()).templates.pay.ar), 'الرسالة المعدّلة محفوظة');
    // 2) المشترك: «اشتراكي» ← إرسال وصل الدفع
    const U = await mk(), up = await U.newPage(), uerr = []; up.on('pageerror', e => uerr.push(e.message));
    await up.request.post(BASE + '/api/register', { data: { email: 'u@t.dz', password: 'password123', name: 'Amine' } });
    const AP = (await (await ap.request.get(BASE + '/api/admin/plans')).json()).plans;
    await ap.request.put(BASE + '/api/admin/plans', { data: { plans: AP.map(p => Object.assign({}, p, { price: p.name === 'الأساسية' ? 2900 : p.price, features: undefined })) } });
    ok((await (await up.request.get(BASE + '/api/billing')).json()).plans.some(p => p.price === 2900), 'باقة مدفوعة');
    await up.goto(BASE + '/subscription'); await up.waitForSelector('.pay-sec');
    const btns = await up.$$eval('.pay-sec [data-wac]', a => a.map(x => x.dataset.wac));
    ok(btns.join(',') === 'pay,upgrade,renew,billing', 'اشتراكي: أزرار واتساب (الوصل، الترقية، التجديد، سؤال)');
    await up.click('.pay-sec [data-wac="pay"]'); await up.waitForSelector('#wa-text');
    ok(/CCP 0012345/.test(await up.innerText('.tm')) && /u@t\.dz/.test(await up.inputValue('#wa-text')), 'نافذة الوصل: معلومات التحويل + الرسالة ببريد الحساب');
    await up.fill('#wa-store', 'Boutique Amine'); ok(/متجري هو Boutique Amine وشكراً/.test(await up.inputValue('#wa-text')), 'الرسالة تتحدث باسم المتجر (نص المدير المعدّل)');
    const [pop] = await Promise.all([up.waitForEvent('popup'), up.click('[data-wa="go"]')]); await pop.waitForURL(/wa\.me/, { timeout: 8000 });
    const url = decodeURIComponent(pop.url()), pays = (await (await ap.request.get(BASE + '/api/admin/payments')).json());
    const pid = ((pays.payments || pays).find(p => /Boutique Amine/.test(p.ref || '')) || {}).id;
    ok(/^https:\/\/wa\.me\/213664442637\?text=/.test(pop.url()) && pid && url.includes('#' + pid) && /Boutique Amine/.test(url), 'يفتح واتساب برقم الدعم + طلب دفع مسجّل برقمه في الرسالة');
    await pop.close();
    // ترقية: العرض الحالي مستثنى
    await up.waitForSelector('.pay-sec'); await up.click('.pay-sec [data-wac="billing"]'); await up.waitForSelector('#wa-text');
    ok(/سؤال عن اشتراكي/.test(await up.inputValue('#wa-text')) && !(await up.$('#wa-plan')), 'سؤال الدفع: رسالة بلا اختيار عرض');
    await up.keyboard.press('Escape');
    // 3) المساعدة: واتساب أولاً
    await up.goto(BASE + '/help'); await up.waitForSelector('#hc-wa', { state: 'attached' });
    const order = await up.evaluate(() => { const g = document.querySelector('.hc-g'), w = document.querySelector('#hc-wa'), f = document.querySelector('#hc-form'), q = document.querySelector('#hc-faq'); return !!(g.compareDocumentPosition(w) & 4) && !!(w.compareDocumentPosition(f) & 4) && !!(f.compareDocumentPosition(q) & 4); });
    ok(order && (await up.innerText('#hc-form h2')).trim() === 'رسالة مكتوبة' && (await up.$$('.hc-g .hc-c')).length === 4, 'المساعدة: البطاقات (مع «الرسائل الواردة») ← واتساب ← رسالة مكتوبة ← الأسئلة، بلا تكرار ولا «(بديل واتساب)»');
    ok(await up.isVisible('#hc-fq') && !(await up.isVisible('#hc-wa')) && !(await up.isVisible('#hc-form')), 'المساعدة تفتح على الأسئلة الشائعة فقط تحت البطاقات');
    await up.click('.hc-g [data-a="hcpay"]'); await up.waitForFunction(() => document.querySelector('#hc-wa').classList.contains('hl')); ok(true, 'بطاقة «الدفع والاشتراك» تنزل إلى قسم واتساب');
    ok(await up.isVisible('#hc-wa') && !(await up.isVisible('#hc-fq')) && !(await up.isVisible('#hc-form')) && await up.$eval('[data-a="hcpay"]', c => c.classList.contains('on')), 'الضغط على بطاقة يُظهر قسمها وحده، والبطاقة مُعلَّمة');
    await up.click('.hc-g [data-a="hcform"]'); ok(await up.isVisible('#hc-form') && !(await up.isVisible('#hc-wa')), 'بطاقة «رسالة مكتوبة» تُظهر النموذج وحده');
    await up.click('.hc-g [data-a="hcform"]'); ok(await up.isVisible('#hc-fq') && !(await up.isVisible('#hc-form')), 'الضغط مرة ثانية يعيد الأسئلة الشائعة');
    await up.click('.hc-g [data-a="hcpay"]'); await up.waitForSelector('#hc-wa');
    await up.click('#hc-wa [data-wac="support"][data-topic="tech"]'); await up.waitForSelector('#wa-topic');

    ok(/مشكلة تقنية/.test(await up.inputValue('#wa-text')), 'رسالة الدعم بنوع الطلب');
    await up.keyboard.press('Escape');
    // 4) الإشعارات: لا تكرار، 3 على الأكثر، تختفي بسرعة
    await up.evaluate(() => { for (let i = 0; i < 4; i++) window.__toast('حُفظ'); });
    ok(await up.$$eval('#toasts .toast', a => a.length) === 1, 'نفس الإشعار لا يتكرر عند الضغط عدة مرات');
    await up.evaluate(() => ['أ', 'ب', 'ج', 'د', 'ه'].forEach(x => window.__toast(x)));
    ok(await up.$$eval('#toasts .toast', a => a.length) === 3, '3 إشعارات على الأكثر');
    await up.waitForFunction(() => !document.querySelector('#toasts .toast'), null, { timeout: 4000 }); ok(true, 'الإشعار يختفي خلال 3 ثوانٍ');
    // 5) صفحة «اتصل بنا»: واتساب أولاً
    const cp = await U.newPage(); await cp.goto(BASE + '/contact?lang=ar'); await cp.waitForSelector('#cwa a');
    ok(/wa\.me\/213664442637/.test(await cp.getAttribute('#cwa a', 'href')) && /أو أرسل لنا رسالة مكتوبة/.test(await cp.innerText('#cf h2')), 'اتصل بنا: زر واتساب أولاً ثم النموذج');
    ok(/^https:\/\/wa\.me\//.test((await (await up.request.get(BASE + '/api/me')).json()).contact), 'رابط «تواصل مع الإدارة» = واتساب');
    ok(!errs.length && !uerr.length, 'لا أخطاء جافاسكربت ' + errs.concat(uerr).join(' | '));
    console.log(`PASS ${pass} whatsapp checks`);
  } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; }
  finally { await b.close(); srv.kill(); }
})();
