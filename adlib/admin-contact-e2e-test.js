'use strict';
// تواصل المدير مع المشتركين: رسائل جاهزة (يعدّلها المدير) عبر واتساب أو داخل المنصة، من «صندوق الدعم» و«المساعدة والدعم»،
// ورقم الهاتف/واتساب في إعدادات المشترك، ومعاينة بطاقات المشترك عند المدير.
// التشغيل: node adlib/admin-contact-e2e-test.js
const { spawn } = require('child_process'), assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require('playwright');
const PORT = 5500 + Math.floor(Math.random() * 80), BASE = 'http://127.0.0.1:' + PORT, DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-acon-'));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok', m); };

(async () => {
  const env = Object.assign({}, process.env, { PORT, JWT_SECRET: 'x'.repeat(40), ADMIN_EMAIL: 'a@t.dz', DB_FILE: path.join(DIR, 'd.db'), NODE_ENV: 'test', BACKUP_DISABLE: '1', BARIDI_INFO: 'CCP 1' });
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stderr.on('data', d => log += d);
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  const b = await chromium.launch();
  try {
    const errs = [];
    const page = async (email, name) => { const c = await b.newContext({ locale: 'ar-DZ', viewport: { width: 1300, height: 900 } }); await c.route(/wa\.me/, r => r.fulfill({ contentType: 'text/html', body: 'wa' })); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.request.post(BASE + '/api/register', { data: { email, password: 'password123', name } }); return p; };
    const A = await page('a@t.dz', 'Admin'), U = await page('u@t.dz', 'Amine'), V = await page('v@t.dz', 'Sara');

    // ---- رقم الهاتف في إعدادات المشترك
    await U.goto(BASE + '/settings'); await U.waitForSelector('input[name="phone"]');
    await U.fill('input[name="phone"]', '12'); await U.click('form[data-form="profile"] .btn');
    await U.waitForFunction(() => /رقم الهاتف/.test(document.querySelector('#toasts').textContent));
    ok(true, 'an invalid phone number is refused with a clear message');
    await U.fill('input[name="phone"]', '+213 555 12 34 56'); await U.click('form[data-form="profile"] .btn');
    await U.waitForFunction(() => /تم حفظ بياناتك/.test(document.querySelector('#toasts').textContent));
    ok((await (await U.request.get(BASE + '/api/me')).json()).phone === '+213555123456', 'subscriber saves an optional phone / WhatsApp number');

    // ---- المشترك لا يرى رسائل المدير الجاهزة
    const wa = await (await U.request.get(BASE + '/api/wa')).json();
    ok(!Object.keys(wa.templates).some(k => /^a_/.test(k)) && wa.templates.pay, 'subscribers never receive the admin message templates');
    ok((await U.request.post(BASE + '/api/admin/contact', { data: { user_id: 1, text: 'x x' } })).status() === 403, 'only the admin can send messages to subscribers');

    // ---- المدير: تعديل الرسائل الجاهزة
    await A.goto(BASE + '/platform'); await A.click('.adm-t button:has-text("رسائل واتساب")'); await A.waitForSelector('[data-wat="a_paid"]');
    ok(/رسائلك إلى المشتركين/.test(await A.textContent('#x-aset')) && (await A.$$('[data-wat^="a_"]')).length === 12, 'admin edits 4 ready messages to subscribers × 3 languages, under their own heading');
    await A.fill('[data-wat="a_paid"][data-l="ar"]', 'مرحباً {name}، فُعّل عرضك {current}. شكراً!'); await A.click('[data-adm="wasave"]');
    await A.waitForFunction(() => /حُفظت/.test(document.querySelector('#toasts').textContent));

    // ---- صندوق الدعم: بطاقات التواصل + الإرسال داخل المنصة
    await A.goto(BASE + '/support-inbox'); await A.waitForSelector('[data-acon="a_paid"]');
    ok((await A.$$('.card [data-acon]')).length === 4, 'support inbox: 4 ready contact cards for the admin (plus the existing replies)');
    await A.click('[data-acon="a_paid"]'); await A.waitForSelector('#ac-u');
    const uid = await A.$eval('#ac-u', s => [...s.options].find(o => /u@t\.dz/.test(o.textContent)).value);
    await A.selectOption('#ac-u', uid);
    ok(/مرحباً Amine، فُعّل عرضك تجربة مجانية/.test(await A.inputValue('#ac-t')), 'the message is filled with the subscriber\'s name and plan (admin-edited text)');
    await A.click('[data-acs="app"]'); await A.waitForFunction(() => /أُرسلت الرسالة/.test(document.querySelector('#toasts').textContent));
    const mine = await (await U.request.get(BASE + '/api/support/mine')).json();
    ok(mine[0] && mine[0].origin === 'admin' && /مرحباً Amine/.test(mine[0].reply), 'in-platform message reaches the subscriber');
    await A.click('[data-adm="mf"][data-f="done"]'); await A.waitForSelector('text=أرسلتها أنت');
    ok(true, 'the inbox shows it as «sent by you»');
    // ---- صندوق الرسائل: عنوان «الرسائل الواردة» تحت بطاقات التواصل، قائمة، ونافذة الرسالة بالردود الثلاثة
    await U.request.post(BASE + '/api/contact', { data: { subject: 'تفعيل العرض', message: 'أرسلت الوصل، متى يُفعَّل عرضي؟', category: 'billing' } });
    await fetch(BASE + '/api/contact', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.9.9.9' }, body: JSON.stringify({ email: 'visitor@mail.com', name: 'Visitor', subject: 'سؤال عن الأسعار', message: 'هل توجد باقة شهرية للمتاجر الصغيرة؟' }) });
    await A.goto(BASE + '/support-inbox'); await A.click('[data-adm="mf"][data-f="new"]'); await A.waitForSelector('.mb-r');
    ok(await A.evaluate(() => { const c = document.querySelector('[data-acon]').closest('.card'), h = [...document.querySelectorAll('.card h2')].find(x => x.textContent.trim() === 'الرسائل الواردة'); return !!h && !!(c.compareDocumentPosition(h) & 4); }), '«Incoming messages» heading comes under the contact cards');
    ok((await A.$$('.mb-r.new')).length === 2 && /Amine/.test(await A.textContent('.mb-l')) && /Visitor/.test(await A.textContent('.mb-l')), 'a compact list of messages awaiting reply (sender, subject, date)');
    await A.click('.mb-r:has-text("تفعيل العرض")'); await A.waitForSelector('.tm #mb-t');
    const info = await A.textContent('.tm .mb-i');
    ok(/Amine/.test(info) && /u@t\.dz/.test(info) && /213555123456/.test(info) && /مشترك/.test(info), 'opening a message shows the sender: name, email, phone, subscriber');
    ok(await A.isVisible('[data-mb="app"]') && !(await A.$eval('[data-mb="wa"]', x => x.disabled)) && await A.isVisible('[data-mb="mail"]'), 'three ways to reply: in the platform, WhatsApp, email');
    await A.fill('#mb-t', 'فُعّل عرضك، شكراً لك.');
    const [wpop] = await Promise.all([A.waitForEvent('popup'), A.click('[data-mb="wa"]')]);
    await wpop.waitForURL(/wa\.me/, { timeout: 15000 }).catch(() => {});
    ok(/wa\.me\/213555123456\?text=/.test(wpop.url()) && decodeURIComponent(wpop.url()).includes('فُعّل عرضك'), 'WhatsApp opens with the written reply to the subscriber number'); await wpop.close();
    let M2 = await (await A.request.get(BASE + '/api/admin/messages')).json(), m2 = M2.list.find(m => m.subject === 'تفعيل العرض');
    ok(m2.status === 'done' && /فُعّل عرضك/.test(m2.reply), 'the WhatsApp reply is saved and the message is marked replied');
    await A.click('[data-adm="mf"][data-f="new"]'); await A.click('.mb-r:has-text("سؤال عن الأسعار")'); await A.waitForSelector('.tm #mb-t');
    ok(/زائر/.test(await A.textContent('.tm .mb-i')) && !(await A.$('[data-mb="app"]')) && await A.$eval('[data-mb="wa"]', x => x.disabled), 'a visitor (no account, no phone): reply by email only, WhatsApp disabled with a reason');
    ok((await A.request.post(BASE + '/api/admin/messages/' + M2.list.find(m => m.subject === 'سؤال عن الأسعار').id + '/reply', { data: { reply: 'نعم', via: 'whatsapp' } })).status() === 400, 'the server also refuses WhatsApp without a number');
    await A.click('[data-mb="del"]'); await A.click('[data-mb="del"]'); await A.waitForFunction(() => !document.querySelector('.tm'));
    M2 = await (await A.request.get(BASE + '/api/admin/messages')).json(); ok(!M2.list.some(m => m.subject === 'سؤال عن الأسعار'), 'delete (with confirmation) from the message window');
    await U.goto(BASE + '/help'); await U.click('[data-a="hcin"]'); await U.waitForSelector('#hc-in .hc-t');
    ok(/فريق الدعم/.test(await U.textContent('#hc-in .hc-t')) && /مرحباً Amine/.test(await U.textContent('#hc-in .hc-t')), 'subscriber sees it in «Help ← Incoming messages» from the support team');

    // ---- واتساب: برقم المشترك، وغير متاح لمن لا رقم له
    await A.goto(BASE + '/support-inbox'); await A.click('[data-acon="a_renew"]'); await A.waitForSelector('#ac-u');
    const vid = await A.$eval('#ac-u', s => [...s.options].find(o => /v@t\.dz/.test(o.textContent)).value);
    await A.selectOption('#ac-u', vid);
    ok(await A.$eval('[data-acs="whatsapp"]', x => x.disabled) && /لا يوجد رقم هاتف/.test(await A.textContent('#ac-ph')), 'WhatsApp is disabled (with a reason) for a subscriber without a phone');
    await A.selectOption('#ac-u', uid);
    const [pop] = await Promise.all([A.context().waitForEvent('page'), A.click('[data-acs="whatsapp"]')]);
    await pop.waitForURL(/wa\.me/, { timeout: 8000 });
    const url = decodeURIComponent(pop.url());
    ok(/wa\.me\/213555123456\?text=/.test(url) && /Amine/.test(url) && /ينتهي في/.test(url), 'WhatsApp opens to the subscriber\'s number with the renewal reminder');

    // ---- المساعدة عند المدير: معاينة بطاقات المشترك + بطاقات تواصله
    await A.goto(BASE + '/help'); await A.waitForSelector('#hc-wa', { state: 'attached' });
    ok((await A.$$('.hc-g .hc-c')).length === 3 && !(await A.$('[data-a="hcin"]')) && !(await A.$('[data-a="hcadm"]')), 'admin help page: 3 cards (no duplicate «Support inbox» card)');
    await A.click('[data-a="hcpay"]'); ok(await A.isVisible('#hc-wa') && await A.isVisible('#hc-admin') && !(await A.isVisible('#hc-fq')), '«Contact subscribers» shows with «Payment & subscription»');
    const prev = await A.$$eval('#hc-wa .wa-i', x => x.map(b => b.disabled));
    ok(prev.length === 7 && prev.every(Boolean) && /معاينة/.test(await A.textContent('#hc-wa')), 'admin help page: the same 7 subscriber cards, as a preview');
    ok((await A.$$('#hc-admin [data-acon]')).length === 4, 'admin help page: «Contact subscribers» cards below');
    await U.goto(BASE + '/help'); await U.waitForSelector('#hc-wa', { state: 'attached' });
    ok((await U.$$('#hc-wa .wa-i:not([disabled])')).length === 7 && !(await U.$('#hc-admin')), 'subscriber help page unchanged (7 cards, no admin cards)');
    ok(!errs.length, 'no page errors ' + errs.join(' | '));
    console.log(`PASS ${pass} admin contact checks`);
  } catch (e) { console.error('FAIL', e.message); console.error(log.slice(-1200)); process.exitCode = 1; }
  finally { await b.close(); srv.kill(); fs.rmSync(DIR, { recursive: true, force: true }); }
})();
