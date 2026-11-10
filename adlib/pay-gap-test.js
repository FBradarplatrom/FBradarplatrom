'use strict';
// v12.9: الدفع بوصل عبر واتساب · «ثغرات السوق» لأي دولة · رسالة استعادة كلمة المرور بلغة المستخدم
// التشغيل: node adlib/pay-gap-test.js
const { spawn } = require('child_process'), assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require('playwright');
const PORT = 5940 + Math.floor(Math.random() * 50), BASE = 'http://127.0.0.1:' + PORT, DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-pg-'));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok', m); };
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: Object.assign({}, process.env, { PORT, JWT_SECRET: 'p'.repeat(40), ADMIN_EMAIL: 'a@t.dz', DB_FILE: path.join(DIR, 'd.db'), NODE_ENV: 'test', BACKUP_DISABLE: '1', SMTP_HOST: 'json', SMTP_FROM: 'r@t.dz', TRIAL_DAYS: '3' }), stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; srv.stdout.on('data', d => out += d);
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  const b = await chromium.launch();
  try {
    const A = await b.newContext({ locale: 'ar-DZ' }), a = A.request;
    await a.post(BASE + '/api/register', { data: { email: 'a@t.dz', password: 'password123' } });
    await a.put(BASE + '/api/admin/config', { data: { baridi_info: 'CCP: 0011223344 clé 55', support_whatsapp: '+213 664 44 26 37' } });
    const pls = (await (await a.get(BASE + '/api/admin/plans')).json()).plans;
    const paid = pls.find(p => !p.free) || pls[0];
    await a.put(BASE + '/api/admin/plans', { data: { plans: pls.map(p => Object.assign({}, p, p.id === paid.id ? { price: 2500, active: true } : {})) } });
    // ---- الدفع عبر واتساب
    const U = await b.newContext({ locale: 'ar-DZ', viewport: { width: 1200, height: 900 } }), pg = await U.newPage(), errs = [];
    await U.route(/wa\.me|whatsapp\.com/, r => r.fulfill({ contentType: 'text/html', body: 'wa' }));   // لا خروج للإنترنت في الاختبار pg.on('pageerror', e => errs.push(e.message));
    await pg.request.post(BASE + '/api/register', { data: { email: 'u@t.dz', password: 'password123', name: 'Amine' } });
    await pg.goto(BASE + '/subscription'); await pg.waitForSelector('[data-acc="plans"]');
    ok((await pg.innerText('[data-acc="plans"]')).includes('الدفع أو تغيير العرض'), 'زر «الدفع أو تغيير العرض»');
    await pg.click('[data-acc="plans"]'); await pg.waitForSelector('.pay-m');
    const tx = await pg.innerText('.pay-m');
    ok(/BaridiMob أو CCP أو تحويل بنكي/.test(tx) && /يُفعَّل عرضك عند الاستلام/.test(tx) && tx.includes('CCP: 0011223344'), 'بطاقة التحويل: BaridiMob/CCP/بنك + معلومات التحويل');
    await pg.click('[data-acc="wa"]'); await pg.waitForTimeout(400);
    ok(/اسم متجرك/.test(await pg.innerText('#toast, .toast, body')), 'اسم المتجر مطلوب');
    await pg.fill('#bm-store', 'Boutique Amine');
    const [wa] = await Promise.all([U.waitForEvent('page'), pg.click('[data-acc="wa"]')]);
    await wa.waitForURL(/wa\.me|whatsapp/, { timeout: 8000 }).catch(() => {});
    const url = decodeURIComponent(wa.url());
    ok(/wa\.me\/213664442637|phone=213664442637/.test(url) && url.includes('Boutique Amine') && url.includes('u@t.dz') && /2[.,٬\s]?500/.test(url), 'واتساب برسالة جاهزة: الرقم، المتجر، البريد، المبلغ');
    const P = (await (await a.get(BASE + '/api/admin/payments')).json());
    const req = P.find(p => p.email === 'u@t.dz');
    ok(req && req.status === 'pending' && req.method === 'baridi' && /WhatsApp · Boutique Amine/.test(req.ref), 'الطلب ظاهر للمدير (قيد المراجعة) باسم المتجر');
    ok((await a.post(BASE + '/api/admin/payments/' + req.id + '/approve', { data: {} })).ok(), 'المدير يقبل بضغطة');
    ok((await (await pg.request.get(BASE + '/api/me')).json()).plan === paid.name, 'فُعّل العرض عند الاستلام');
    ok((await pg.request.post(BASE + '/api/billing/baridi', { data: { plan_id: paid.id, via: 'whatsapp', store: '' } })).status() === 400, 'بلا اسم متجر: مرفوض');
    // ---- ثغرات السوق لأي دولة
    ok((await (await pg.request.get(BASE + '/api/gap')).json()).target === 'DZ', 'السوق المستهدف الافتراضي: الجزائر');
    ok((await pg.request.put(BASE + '/api/gap-target', { data: { target: 'XX' } })).status() === 400 && (await pg.request.put(BASE + '/api/gap-target', { data: { target: 'ALL' } })).status() === 400, 'دولة غير صالحة مرفوضة');
    await pg.request.put(BASE + '/api/gap-target', { data: { target: 'MA' } });
    ok((await (await pg.request.get(BASE + '/api/me')).json()).gap_target === 'MA', 'اختيار المشترك محفوظ (المغرب)');
    await pg.request.put(BASE + '/api/saved', { data: { k: 'p1', snap: { name: 'Star projector', cat: 'gem', market: 'US', images: [] } } });
    const g = await (await pg.request.post(BASE + '/api/gap', { data: { k: 'p1' } })).json();
    let gp = await (await pg.request.get(BASE + '/api/gap/' + g.id)).json();
    ok(gp.target === 'MA', 'المنتج الجديد يُفحص في سوق المشترك');
    const sc = await (await pg.request.post(BASE + '/api/gap/' + g.id + '/scan', { data: { queries: [{ q: 'veilleuse étoiles', lang: 'fr' }, { q: 'projecteur', lang: 'es' }] } })).json();
    const ing = await (await pg.request.post(BASE + '/api/gap/' + g.id + '/ingest', { data: { scan: sc.scan, ads: [{ ad_archive_id: '555', page_name: 'Shop MA', snapshot: { body: { text: 'veilleuse étoiles' } }, start_date: 1700000000, is_active: true }] } })).json();
    ok(Array.isArray(ing.rows), 'الاستقبال يعمل للسوق المستهدف');
    gp = await (await pg.request.put(BASE + '/api/gap/' + g.id, { data: { target: 'FR' } })).json();
    ok(gp.target === 'FR' && (await pg.request.put(BASE + '/api/gap/' + g.id, { data: { target: 'ZZ' } })).status() === 400, 'تغيير دولة المنتج (فرنسا) والتحقق منها');
    await pg.goto(BASE + '/gaps/' + g.id); await pg.waitForSelector('[data-g="ptarget"]');
    ok(await pg.$eval('[data-g="ptarget"]', s => s.value) === 'FR' && /فرنسا/.test(await pg.innerText('[data-g="scan"]')), 'صفحة المنتج: الدولة وزر «ابدأ الفحص في فرنسا»');
    ok((await pg.$$eval('[data-glang] option', o => o.map(x => x.value))).includes('fr'), 'لغات العبارات من لغات الدولة');
    await pg.goto(BASE + '/gaps'); await pg.waitForSelector('[data-g="target"]');
    ok(await pg.$eval('[data-g="target"]', s => s.value) === 'MA' && !(await pg.innerText('#v-gap')).includes('الجزائري'), 'قائمة الثغرات: اختيار السوق، بلا «الجزائري»');
    ok(!errs.length, 'لا أخطاء جافاسكربت ' + errs.join(' | '));
    // ---- رسالة استعادة كلمة المرور بلغة صفحة الدخول
    for (const [lg, re] of [['en', /Reset your password/], ['fr', /R=C3=A9initialisation|Réinitialisation/], ['ar', /=D8|استعادة/]]) {
      out = ''; await fetch(BASE + '/api/forgot', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'u@t.dz', lang: lg }) });
      for (let i = 0; i < 20 && !/MAIL/.test(out); i++) await new Promise(r => setTimeout(r, 100));
      ok(re.test(out), 'رسالة الاستعادة بلغة ' + lg);
    }
    console.log(`PASS ${pass} pay/gap/mail checks`);
  } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; }
  finally { await b.close(); srv.kill(); }
})();
