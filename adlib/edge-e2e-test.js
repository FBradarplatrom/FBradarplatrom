'use strict';
// «الخروج من المنافسة» (ذكاء اصطناعي وهمي) + تشخيص البريد + أيقونة الموقع.  التشغيل: node adlib/edge-e2e-test.js
const { spawn } = require('child_process'), assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const PORT = 6200 + Math.floor(Math.random() * 50), BASE = 'http://127.0.0.1:' + PORT, DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-edge-'));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok', m); };
const IDEAS = [
  ['bundle', 'باك «نوم هادئ» للأطفال', ['مصباح النجوم', 'جهاز ضوضاء بيضاء', 'غطاء عين للأطفال']], ['niche', 'نسخة لغرف التأمل واليوغا', ['ألوان دافئة فقط']],
  ['split', 'بيع أقراص الإسقاط منفصلة', ['قرص المحيط', 'قرص الفضاء', 'قرص الحروف']], ['upgrade', 'إضافة جهاز تحكم ومؤقت', ['ريموت', 'مؤقت 30/60 دقيقة']],
  ['occasion', 'هدية عيد ميلاد الطفل', ['علبة هدية', 'بطاقة باسم الطفل']], ['b2b', 'للحضانات وروض الأطفال', ['سعر جملة 10 قطع']],
  ['offer', 'ضمان «ينام طفلك أو نعيد مالك»', []], ['packaging', 'اسم الطفل محفور على القاعدة', []], ['content', 'فيديو قبل/بعد لغرفة الطفل', []],
  ['format', 'نسخة سفر صغيرة', []], ['wild', 'سلسلة قصص صوتية قبل النوم مع القرص', []]
].map(([type, title, items], i) => ({ type, title, what: 'تفاصيل الفكرة ' + (i + 1), items, why: 'لا أحد من المنافسين يقدّمها', price: '4900 دج بدل 3900', effort: i % 3 === 0 ? 'easy' : 'medium', cost: 'low', margin: 'up', test: 'إعلان بـ 1500 دج لمدة 3 أيام', risk: 'تحقق من المورّد', hook: 'طفلك ينام وحدو في 10 دقايق', novelty: 4, score: 10 - (i % 5) }));
const RESULT = { product: { what: 'مصباح ليلي يسقط النجوم', job: 'نوم الطفل بسرعة', buyer: 'الأمهات' }, diagnosis: { saturation: 'high', why: '12 معلناً بنفس العرض', common_angle: 'الكل يقول: نجوم في غرفة طفلك بسعر 3900', price_war: 'الأسعار نزلت من 4500 إلى 3500', gaps: ['البالغون الذين يعانون الأرق', 'الحضانات'] },
  ideas: IDEAS, top: [{ i: 0, reason: 'سهل وسريع' }, { i: 2, reason: 'شراء متكرر' }, { i: 1, reason: 'شريحة بلا منافس' }], plan: [{ day: '1-2', do: 'اطلب عينات' }, { day: '3-5', do: 'اختبر الباك' }], avoid: ['لا تدخل حرب الأسعار'], assumptions: ['هل الأقراص قابلة للتبديل؟'] };
(async () => {
  const reqs = []; let fail = false;
  const mock = http.createServer((q, s) => { let b = ''; q.on('data', d => b += d); q.on('end', () => {
    const j = JSON.parse(b || '{}'); reqs.push(j); s.setHeader('content-type', 'application/json');
    if (fail) { s.statusCode = 500; return s.end(JSON.stringify({ error: { message: 'boom' } })); }
    setTimeout(() => s.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(RESULT) } }] })), 1500);
  }); }).listen(0);
  const MP = mock.address().port;
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: Object.assign({}, process.env, { PORT, JWT_SECRET: 'e'.repeat(40), ADMIN_EMAIL: 'a@t.dz', DB_FILE: path.join(DIR, 'd.db'), NODE_ENV: 'test', BACKUP_DISABLE: '1',
    OPENAI_API_KEY: 'sk-test', OPENAI_BASE_URL: 'http://127.0.0.1:' + MP + '/v1', SMTP_HOST: 'json', SMTP_USER: 'contact@example.com', MAIL_FROM: 'Radar <contact@example.com>' }), stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ locale: 'ar-DZ', viewport: { width: 1300, height: 950 } }), pg = await ctx.newPage(), errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.request.post(BASE + '/api/register', { data: { email: 'a@t.dz', password: 'password123' } });
    const ad = i => ({ title: 'Star projector ' + i, body: 'Your kids fall asleep in minutes. Free shipping ' + i, link_url: 'https://shop.example/p', image_url: '', country: 'FR', page_id: '9' + i, page_name: 'Shop ' + i, library_url: 'https://www.facebook.com/ads/library/?id=' + i });
    await pg.request.put(BASE + '/api/saved', { data: { k: 'lamp', snap: { v: 2, name: 'مصباح النجوم', kw: 'star projector', cat: 'gem', score: 85, n: 3, copies: 7, days: 40, market: 'FR', images: [], top: ad(0), recs: [0, 1, 2].map(i => ({ a: ad(i), age: 30, cat: 'gem', score: 80, ev: [] })) } } });
    // من بطاقة المنتج المحفوظ
    await pg.goto(BASE + '/saved'); await pg.waitForSelector('[data-tool="edge"]');
    await pg.click('[data-tool="edge"]'); await pg.waitForSelector('#ed-seed .ed-seed');
    ok(new URL(pg.url()).pathname === '/compete' && (await pg.isVisible('.nv.on[data-v="edge"]')) && /3 من نصوص إعلانات المنافسين/.test(await pg.innerText('#ed-seed')), 'زر «اخرج من المنافسة» في البطاقة يفتح القسم بالمنتج ونصوص المنافسين');
    ok(await pg.$eval('#ed-mk', s => s.value) === 'FR', 'السوق من المنتج المحفوظ');
    await pg.fill('#ed-cost', '900 دج'); await pg.fill('#ed-notes', 'ميزانية صغيرة');
    await pg.click('#ed-form button[type=submit]'); await pg.waitForSelector('.ed-run'); ok(/\/compete\/\d+$/.test(pg.url()), 'شاشة التقدّم وعنوان خاص بالتحليل');
    await pg.waitForSelector('.ed-i', { timeout: 15000 });
    const r0 = reqs[0], sys = r0.messages[0].content, usr = typeof r0.messages[1].content === 'string' ? r0.messages[1].content : r0.messages[1].content[0].text;
    ok(/France/.test(sys) && /EUR/.test(sys) && /Competitor ad texts/.test(usr) && /Star projector 1/.test(usr) && /900 دج/.test(usr) && /ميزانية صغيرة/.test(usr) && r0.temperature === 0.8, 'الطلب: السوق والعملة ونصوص المنافسين والتكلفة والقيود');
    ok((await pg.$$('.ed-i')).length === 11 && (await pg.$$('.ed-tc')).length === 3, '11 فكرة + أفضل 3');
    ok(/الكل يقول/.test(await pg.innerText('.ed-q')) && (await pg.$('.ed-sat.high')) && /الحضانات/.test(await pg.innerText('.ed-chips')), 'تشخيص المنافسة والثغرات');
    await pg.click('.ed-flt [data-t="bundle"]'); ok((await pg.$$eval('.ed-i', a => a.filter(x => !x.hidden).length)) === 1, 'التصفية حسب نوع الفكرة');
    ok((await pg.$$('.ed-i .ed-t i.ico svg')).length >= 11 && (await pg.$$('.ed-pl div')).length === 2, 'أيقونات الأنواع وخطة 7 أيام');
    // أفكار أخرى
    await pg.click('[data-ed="more"]');
    await pg.waitForSelector('.ed-run'); await pg.waitForSelector('.ed-i', { timeout: 15000 });
    const u1 = reqs[1].messages[1].content; ok(/give DIFFERENT ones/.test(typeof u1 === 'string' ? u1 : u1[0].text) && /باك «نوم هادئ»/.test(typeof u1 === 'string' ? u1 : u1[0].text), '«أفكار أخرى» تستبعد الأفكار السابقة');
    // منتج جديد بصورة
    const png = path.join(DIR, 'p.png'); fs.writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64'));
    await pg.click('[data-ed="home"]'); await pg.waitForSelector('#ed-form'); await pg.click('[data-ed="src"][data-m="new"]');
    await pg.fill('#ed-name', 'حزام تصحيح الظهر'); await pg.setInputFiles('#ed-file', png); await pg.waitForSelector('#ed-ims img');
    await pg.click('#ed-form button[type=submit]'); await pg.waitForSelector('.ed-i', { timeout: 15000 });
    const r2 = reqs[2].messages[1].content; ok(Array.isArray(r2) && r2[1].type === 'image_url' && /^data:image\/jpeg/.test(r2[1].image_url.url) && /Algeria/.test(reqs[2].messages[0].content), 'منتج جديد: الصورة تُرسل للذكاء الاصطناعي، والسوق الافتراضي الجزائر');
    // الخطأ لا يُحتسب ويظهر بوضوح
    fail = true; await pg.click('[data-ed="home"]'); await pg.waitForSelector('.ed-hc');
    ok((await pg.$$('.ed-hc')).length === 3, 'التحليلات السابقة محفوظة');
    await pg.click('[data-ed="src"][data-m="new"]'); await pg.fill('#ed-name', 'منتج'); await pg.click('#ed-form button[type=submit]');
    await pg.waitForSelector('.alert.err', { timeout: 15000 }); ok(/تعذّر التحليل/.test(await pg.innerText('#x-edge')) && await pg.$('[data-ed="retry"]'), 'فشل الذكاء الاصطناعي: رسالة واضحة وزر إعادة');
    fail = false; await pg.click('[data-ed="retry"]'); await pg.waitForSelector('.ed-i', { timeout: 15000 }); ok(true, 'إعادة المحاولة تنجح');
    await pg.click('[data-ed="del"]'); await pg.click('[data-ed="del"]'); await pg.waitForSelector('#ed-form'); ok((await pg.$$('.ed-hc')).length === 4, 'حذف تحليل');
    const ex = await (await pg.request.get(BASE + '/api/me/export')).json(); ok(Array.isArray(ex.compete_ideas) && ex.compete_ideas.length === 3, 'الأفكار ضمن تصدير بيانات الحساب');
    ok(!errs.length, 'لا أخطاء جافاسكربت ' + errs.join(' | '));
    // الواجهة بالإنجليزية: القسم مترجم والأفكار تُكتب بالإنجليزية
    const ce = await b.newContext({ locale: 'en-GB', viewport: { width: 1300, height: 900 } }); await ce.addInitScript(() => { try { localStorage.setItem('wpr_lang', 'en'); } catch (x) {} }); await ce.addCookies(await ctx.cookies());
    const pe = await ce.newPage(); await pe.goto(BASE + '/compete'); await pe.waitForSelector('.ed-hero'); await pe.waitForTimeout(500);
    ok(/in a way nobody competes with/.test(await pe.innerText('.ed-hero')) && /Beat the competition/.test(await pe.innerText('.nv[data-v="edge"]')), 'القسم مترجم للإنجليزية');
    await pe.click('[data-ed="src"][data-m="new"]'); await pe.fill('#ed-name', 'Posture corrector'); await pe.click('#ed-form button[type=submit]'); await pe.waitForSelector('.ed-i', { timeout: 15000 });
    ok(/Write everything in English/.test(reqs[reqs.length - 1].messages[0].content), 'الأفكار بلغة الواجهة (English)');
    // البريد: حالة، تجربة إلى أي عنوان، فحص الدومين
    const mt = await (await pg.request.post(BASE + '/api/admin/mail-test', { data: { to: 'someone@gmail.com' } })).json();
    const ms = await (await pg.request.get(BASE + '/api/admin/mail-status')).json();
    ok(mt.ok === 1 && mt.to === 'someone@gmail.com' && ms.last && ms.last.ok && ms.last.to === 's***@gmail.com' && ms.from === 'Radar <contact@example.com>', 'بريد تجريبي إلى أي عنوان + آخر حالة إرسال');
    const dn = await (await pg.request.post(BASE + '/api/admin/mail-dns', { data: {} })).json(); ok(dn.domain === 'example.com' && dn.checks.some(c => c.k === 'SPF') && dn.checks.some(c => c.k === 'DKIM'), 'فحص SPF/DKIM/DMARC للدومين');
    const ML = require('./mail.js'), cm = "Hostname/IP does not match certificate's altnames: Host: mail.example.com. is not in the cert's altnames: DNS:*.web-hosting.com, DNS:web-hosting.com";
    ok(ML.certName(cm) === 'web-hosting.com' && /اعتمد اسم الشهادة/.test(ML.hint(cm)), 'خطأ شهادة الاستضافة المشتركة: يُقترح اسمها');
    const mc = await (await pg.request.post(BASE + '/api/admin/mail-cert', { data: { name: 'web-hosting.com' } })).json(), ms2 = await (await pg.request.get(BASE + '/api/admin/mail-status')).json();
    ok(mc.ok === 1 && ms2.cert === 'web-hosting.com' && (await pg.request.post(BASE + '/api/admin/mail-cert', { data: { name: 'bad name;' } })).status() === 400, '«اعتمد اسم الشهادة» يُحفظ من الواجهة بلا تعديل .env');
    await pg.goto(BASE + '/platform/tg'); await pg.waitForSelector('#mail-st .alert.ok'); ok(/قَبِله الخادم/.test(await pg.innerText('#mail-st')) && /web-hosting.com/.test(await pg.innerText('#mail-st')), 'بطاقة البريد تعرض آخر إرسال واسم الشهادة المعتمد');
    // أيقونة الموقع
    const fi = await pg.request.get(BASE + '/favicon.ico'), fs2 = await (await pg.request.get(BASE + '/favicon.svg')).text();
    ok(fi.ok() && (await fi.body()).readUInt16LE(2) === 1 && /M4.9 19.1/.test(fs2) && /href="\/favicon.svg"/.test(await (await pg.request.get(BASE + '/')).text()), 'أيقونة المتصفح = شعار الرادار');
    console.log(`PASS ${pass} compete/mail checks`);
  } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; }
  finally { await b.close(); srv.kill(); mock.close(); }
})();
