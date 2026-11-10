'use strict';
// الحساب: دليل البداية في لوحة التحكم، تصدير البيانات، حذف الحساب نهائياً بكلمة المرور.
// التشغيل: node adlib/account-test.js
const { spawn } = require('child_process'), assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require('playwright');
const PORT = 5800 + Math.floor(Math.random() * 80), BASE = 'http://127.0.0.1:' + PORT, DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-acc-'));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok', m); };
const open = f => { try { return new (require('better-sqlite3'))(f, { readonly: true }); } catch (e) { return new (require('node:sqlite').DatabaseSync)(f); } };
(async () => {
  const env = Object.assign({}, process.env, { PORT, JWT_SECRET: 'c'.repeat(40), ADMIN_EMAIL: 'a@t.dz', DB_FILE: path.join(DIR, 'd.db'), NODE_ENV: 'test', BACKUP_DISABLE: '1' });
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stderr.on('data', d => log += d);
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  const b = await chromium.launch(); b.newPage = ((f) => o => f(Object.assign({ locale: 'ar-DZ' }, o)))(b.newPage.bind(b)); b.newContext = ((f) => o => f(Object.assign({ locale: 'ar-DZ' }, o)))(b.newContext.bind(b));   /* اللوحة بالعربية (لغة المتصفح الافتراضية) */
  try {
    const A = await b.newPage(); await A.request.post(BASE + '/api/register', { data: { email: 'a@t.dz', password: 'password123' } });
    const pg = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept(d.type() === 'prompt' ? (pg.__pw || '') : undefined));
    await pg.request.post(BASE + '/api/register', { data: { email: 'u@t.dz', password: 'password123', name: 'Amine' } });
    // دليل البداية
    await pg.goto(BASE + '/'); await pg.waitForSelector('.onb');
    ok(/0 من 5/.test(await pg.locator('.onb h2').innerText()) && /دليل البداية/.test(await pg.locator('.onb .ontag').innerText()) && (await pg.$$('.onb .onr')).length === 5, 'دليل البداية: 5 خطوات، لا شيء منجز');
    await pg.request.put(BASE + '/api/saved', { data: { k: 'k1', snap: { name: 'منتج', cat: 'gem' } } });
    await pg.request.put(BASE + '/api/notify', { data: { email: true } });
    await pg.reload(); await pg.waitForSelector('.onb');
    ok(/2 من 5/.test(await pg.locator('.onb h2').innerText()) && (await pg.$$('.onb .onr.ok')).length === 2, 'الخطوات المنجزة تُشطب تلقائياً (حفظ منتج + التنبيهات)');
    await pg.click('[data-a="onbhide"]'); await pg.waitForTimeout(300);
    ok(!(await pg.$('.onb')), 'إخفاء الدليل');
    // المساعدة والدعم
    await A.request.post(BASE + '/api/login', { data: { email: 'a@t.dz', password: 'password123' } });
    ok((await A.request.put(BASE + '/api/admin/config', { data: { ga_id: 'bad"><script>' } })).status() === 400, 'معرّف Analytics بصيغة خاطئة يُرفض');
    ok((await A.request.put(BASE + '/api/admin/config', { data: { ga_id: 'G-AB12CD34EF', meta_pixel: '123456789012', support_email: 'help@t.dz', support_whatsapp: '+213 555 12 34 56' } })).ok(), 'حفظ معرّفات القياس والدعم');
    await pg.goto(BASE + '/help'); await pg.waitForSelector('#x-help details');
    ok((await pg.$$('#x-help details')).length >= 8 && !!(await pg.$('a[href^="mailto:help@t.dz"]')) && !!(await pg.$('a[href="https://wa.me/213555123456"]')), 'صفحة المساعدة: أسئلة شائعة + بريد وواتساب الدعم');
    ok(!(await pg.content()).includes('googletagmanager') && !(await pg.content()).includes('fbevents'), 'لا أدوات قياس داخل المنصة');
    const lh = await (await fetch(BASE + '/login')).text(), th = await (await fetch(BASE + '/terms')).text();
    ok(lh.includes('gtag/js?id=G-AB12CD34EF') && lh.includes("fbq('init','123456789012')") && th.includes('G-AB12CD34EF'), 'أدوات القياس في الصفحات العامة');
    const hj = await (await fetch(BASE + '/api/health')).json();
    ok(hj.ok === true && !!hj.version && !JSON.stringify(hj).includes('@'), 'فحص صحة الخادم /api/health');
    // نموذج «اتصل بنا» ورسائل المدير
    ok((await fetch(BASE + '/api/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'bad', message: 'hello there friend' }) })).status === 400, 'اتصل بنا: بريد خاطئ يُرفض');
    ok((await fetch(BASE + '/api/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'bot@x.io', message: 'spam spam spam', website: 'x' }) })).ok, 'فخ الروبوتات: يُقبل ظاهرياً ولا يُحفظ');
    const vis = await b.newPage(); await vis.goto(BASE + '/contact?lang=en'); await vis.waitForSelector('#cform');
    ok(await vis.isVisible('#wa') && /wa\.me\/213555123456/.test(await vis.getAttribute('#wa', 'href')), 'زر واتساب عائم في الصفحات العامة');
    await vis.fill('#cform [name=name]', 'Karim'); await vis.fill('#cform [name=email]', 'visitor@mail.com'); await vis.fill('#cform [name=subject]', 'Question about plans'); await vis.fill('#cform [name=message]', 'Do you support the Moroccan market?');
    await vis.click('#cform button'); await vis.waitForSelector('#cmsg.ok');
    await pg.goto(BASE + '/help'); await pg.waitForSelector('#hf-m'); await pg.fill('#hf-s', 'مشكلة في الجمع'); await pg.fill('#hf-m', 'الإضافة لا تتصل بالمنصة عندي'); await pg.click('[data-a="hsend"]'); await pg.waitForTimeout(500);
    const M = await (await A.request.get(BASE + '/api/admin/messages')).json();
    ok(M.list.length === 2 && M.unread === 2 && M.list.some(m => m.email === 'visitor@mail.com' && !m.user_id) && M.list.some(m => m.email === 'u@t.dz' && m.user_id && m.subject === 'مشكلة في الجمع'), 'الرسائل تصل للمدير (زائر + مشترك ببريد حسابه)');
    await A.request.post(BASE + '/api/admin/messages/' + M.list[0].id + '/done', { data: {} });
    ok((await (await A.request.get(BASE + '/api/admin/messages')).json()).unread === 1, 'تعليم رسالة كمعالجة');
    ok((await pg.request.get(BASE + '/api/admin/messages')).status() === 403, 'المشترك لا يرى الرسائل');
    // تعديل الصفحات القانونية
    ok((await A.request.put(BASE + '/api/admin/legal', { data: { lang: 'en', doc: 'terms', body: 'no title' } })).status() === 400, 'النص بلا عنوان # يُرفض');
    ok((await A.request.put(BASE + '/api/admin/legal', { data: { lang: 'en', doc: 'terms', body: '# My Terms\n\n## Rule one\nBe nice to {name}.\nSecond line.' } })).ok, 'حفظ نص معدّل');
    ok((await pg.request.put(BASE + '/api/admin/legal', { data: { lang: 'en', doc: 'terms', body: '# x' } })).status() === 403, 'المشترك لا يعدّل الصفحات');
    await vis.goto(BASE + '/terms?lang=en'); await vis.waitForFunction(() => document.querySelector('#doc h1').textContent === 'My Terms');
    ok((await vis.innerText('#doc')).includes('Rule one') && (await vis.innerHTML('#doc')).includes('Second line') && !(await vis.innerText('#doc')).includes('Acceptable use'), 'الصفحة تعرض النص المعدّل');
    await A.request.put(BASE + '/api/admin/legal', { data: { lang: 'en', doc: 'terms', body: '' } });
    await vis.reload(); await vis.waitForTimeout(500); ok((await vis.innerText('#doc h1')) === 'Terms of Service', 'استرجاع النص الأصلي');
    await vis.close();
    // تصدير البيانات
    const ex = await pg.request.get(BASE + '/api/me/export'), J = await ex.json();
    ok(/attachment; filename="radar-my-data.json"/.test(ex.headers()['content-disposition']) && J.account.email === 'u@t.dz' && J.saved_products.length === 1 && J.settings.notify && Array.isArray(J.login_activity), 'تصدير البيانات: ملف JSON بالحساب والمحفوظات والإعدادات والنشاط');
    ok(!JSON.stringify(J).includes('hash') && !JSON.stringify(J).includes('api_enc'), 'التصدير بلا كلمة المرور المشفّرة ولا أسرار');
    // الحذف
    ok((await pg.request.delete(BASE + '/api/me', { data: { password: 'wrong-pass' } })).status() === 400, 'كلمة مرور خاطئة: لا حذف');
    await pg.goto(BASE + '/settings'); await pg.waitForSelector('[data-a="delme"]');
    pg.__pw = 'password123'; await Promise.all([pg.waitForURL(/deleted=1/), pg.click('[data-a="delme"]')]);
    ok(true, 'حذف الحساب من الإعدادات');
    ok((await pg.request.post(BASE + '/api/login', { data: { email: 'u@t.dz', password: 'password123' } })).status() === 401, 'لا دخول بعد الحذف');
    const db = open(path.join(DIR, 'd.db'));
    ok(db.prepare("select count(*) n from users where email='u@t.dz'").get().n === 0 && db.prepare('select count(*) n from saved').get().n === 0 && db.prepare("select count(*) n from user_kv where k='notify'").get().n === 0, 'لا بقايا: الحساب ومحفوظاته وإعداداته حُذفت');
    ok((await A.request.delete(BASE + '/api/me', { data: { password: 'password123' } })).status() === 400, 'المدير الوحيد لا يحذف حسابه');
    ok(!errs.length, 'لا أخطاء جافاسكربت: ' + errs.join(' | '));
    console.log(`PASS ${pass} account checks`);
  } catch (e) { console.error('FAIL', e.message, log.slice(-800)); process.exitCode = 1; }
  finally { await b.close(); srv.kill(); }
})();
