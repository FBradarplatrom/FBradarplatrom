'use strict';
// اختبار الاشتراكات: الباقات (تجربة مجانية + مدفوعة بالدينار والدولار)، BaridiMob، SATIM (CIB/الذهبية)، Stripe (إشعار موقّع)، PayPal، بوابات محاكاة، لوحة الإحصائيات، «الربط والتكامل».
// التشغيل: node adlib/billing-e2e-test.js
const { spawn } = require('child_process'), assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), http = require('http'), crypto = require('crypto');
const { chromium } = require('playwright');
const PORT = 5000 + Math.floor(Math.random() * 80), BASE = 'http://127.0.0.1:' + PORT, DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-bill-'));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok', m); };
const SK = 'sk_test_abc123', WH = 'whsec_test_123';
(async () => {
  const checkouts = [], satim = [], stripeS = [], ppOrders = [], tgSent = [], tgUpd = [];
  const mock = http.createServer((q, s) => { let b = ''; q.on('data', d => b += d); q.on('end', () => {
    s.writeHead(200, { 'content-type': 'application/json' });
    const u = new URL(q.url, 'http://x'), F = Object.fromEntries(new URLSearchParams(b));
    if (u.pathname === '/satim/register.do') { const P = Object.fromEntries(u.searchParams), jp = JSON.parse(P.jsonParams || '{}'); satim.push(P); return s.end(JSON.stringify({ errorCode: '0', orderId: 'SO' + satim.length, formUrl: BASE + '/api/billing/return/satim?pid=' + jp.udf1 })); }
    if (u.pathname === '/satim/confirmOrder.do') { const o = satim[+u.searchParams.get('orderId').slice(2) - 1]; return s.end(JSON.stringify({ ErrorCode: '0', OrderStatus: 2, Amount: +o.amount, actionCode: 0 })); }
    if (u.pathname === '/stripe/v1/checkout/sessions' && q.method === 'POST') { stripeS.push({ auth: q.headers.authorization, f: F, paid: false }); return s.end(JSON.stringify({ id: 'cs_' + stripeS.length, url: BASE + '/settings?paid=' + F['metadata[payment_id]'] })); }
    if (u.pathname.startsWith('/stripe/v1/checkout/sessions/cs_')) { const o = stripeS[+u.pathname.split('cs_')[1] - 1]; return s.end(JSON.stringify({ id: 'x', payment_status: o && o.paid ? 'paid' : 'unpaid' })); }
    if (u.pathname === '/paypal/v1/oauth2/token') return s.end(JSON.stringify({ access_token: 'PPTOK' }));
    if (u.pathname === '/paypal/v2/checkout/orders') { const j = JSON.parse(b); ppOrders.push({ auth: q.headers.authorization, j }); const id = 'PP' + ppOrders.length; return s.end(JSON.stringify({ id, links: [{ rel: 'approve', href: BASE + '/api/billing/return/paypal?pid=' + j.purchase_units[0].custom_id + '&token=' + id }] })); }
    if (/^\/paypal\/v2\/checkout\/orders\/PP\d+\/capture$/.test(u.pathname)) { const o = ppOrders[+u.pathname.split('/')[5].slice(2) - 1]; return s.end(JSON.stringify({ status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ amount: { value: o.j.purchase_units[0].amount.value } }] } }] })); }
    if (q.url.startsWith('/botTGTOKEN/sendMessage')) { tgSent.push(JSON.parse(b)); return s.end('{"ok":true,"result":{}}'); }
    if (q.url.startsWith('/botTGTOKEN/getUpdates')) { const off = +((/offset=(\d+)/.exec(q.url) || [])[1] || 0); return s.end(JSON.stringify({ ok: true, result: tgUpd.filter(u => u.update_id >= off) })); }
    if (q.url.startsWith('/bot')) return s.end('{"ok":false,"description":"Unauthorized"}');
    s.end('{}');
  }); }).listen(0);
  const env = Object.assign({}, process.env, { PORT, JWT_SECRET: 'y'.repeat(40), ADMIN_EMAIL: 'a@t.dz', DB_FILE: path.join(DIR, 'd.db'), IMG_DIR: path.join(DIR, 'img'), NODE_ENV: 'test',
    TRIAL_DAYS: '3', SATIM_TEST_API: 'http://127.0.0.1:' + mock.address().port + '/satim', STRIPE_TEST_API: 'http://127.0.0.1:' + mock.address().port + '/stripe', PAYPAL_TEST_API: 'http://127.0.0.1:' + mock.address().port + '/paypal', OPENAI_API_KEY: '', TELEGRAM_TEST_API: 'http://127.0.0.1:' + mock.address().port, SMTP_HOST: 'json', SMTP_FROM: 'radar@t.dz' });
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '', out = ''; srv.stderr.on('data', d => log += d); srv.stdout.on('data', d => out += d);
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  const b = await chromium.launch(); b.newPage = ((f) => o => f(Object.assign({ locale: 'ar-DZ' }, o)))(b.newPage.bind(b)); b.newContext = ((f) => o => f(Object.assign({ locale: 'ar-DZ' }, o)))(b.newContext.bind(b));   /* اللوحة بالعربية (لغة المتصفح الافتراضية) */
  try {
    const ad = await b.newContext({ viewport: { width: 1300, height: 1400 } }), mb = await b.newContext({ viewport: { width: 1300, height: 1400 } });
    const A = await ad.newPage(), M = await mb.newPage(); const errs = []; [A, M].forEach(p => p.on('pageerror', e => errs.push(e.message)));
    await A.request.post(BASE + '/api/register', { data: { email: 'a@t.dz', password: 'password123' } });
    await M.request.post(BASE + '/api/register', { data: { email: 'm@t.dz', password: 'password123' } });
    const toast = async (p, re) => { await p.waitForFunction(r => new RegExp(r).test(document.querySelector('#toasts').textContent), re.source, { timeout: 8000 }); };

    // ---- المدير: «الربط والتكامل» → مفاتيح الدفع
    await A.goto(BASE + '/platform/ai'); await A.waitForSelector('[data-cfg="openai_key"]');
    ok(await A.locator('.nv[data-v="aset"]').isVisible() && await A.locator('.nv[data-v="abill"]').isVisible(), 'قسما «إعدادات المنصة» و«العروض والمدفوعات» في قائمة الإدارة');
    ok(await A.locator('[data-cfg="openai_key"]').count() === 1, 'خانة مفتاح OpenAI في «إعدادات المنصة ← الذكاء الاصطناعي»');
    await A.goto(BASE + '/payments/methods'); await A.waitForSelector('[data-cfg="stripe_secret"]');
    ok(await A.locator('[data-cfg="satim_user"]').count() === 1 && await A.locator('[data-cfg="paypal_client"]').count() === 1 && !/[Cc]hargily/.test(await A.locator('#x-abill').textContent()), 'مفاتيح SATIM وStripe وPayPal، وبلا Chargily');
    await A.fill('[data-cfg="stripe_secret"]', SK); await A.fill('[data-cfg="stripe_webhook"]', WH); await A.locator('[data-cfg="stripe_secret"]').locator('xpath=ancestor::div[contains(@class,"card")][1]').locator('[data-int="save"]').click();
    await toast(A, /حُفظت الإعدادات/);
    await A.request.put(BASE + '/api/admin/config', { data: { satim_user: 'radar_api', satim_pass: 'satim-pass-9', satim_terminal: 'E010900001', paypal_client: 'PPCLIENT', paypal_secret: 'pp-secret-1' } });
    await A.fill('[data-cfg="baridi_info"]', 'RIP: 00799999000000000000\nالاسم: رادار'); await A.locator('[data-cfg="baridi_info"]').locator('xpath=ancestor::div[contains(@class,"card")][1]').locator('[data-int="save"]').click();
    await toast(A, /حُفظت الإعدادات/);
    const cfg = await (await A.request.get(BASE + '/api/admin/config')).json();
    ok(cfg.config.stripe_secret.value === '••••c123' && cfg.config.stripe_secret.source === 'platform' && cfg.config.satim_pass.value === '••••ss-9', 'المفاتيح مخزَّنة وتُعرض مخفية');
    // إعادة الحفظ بالقيمة المخفية لا تغيّر المفتاح
    await A.request.put(BASE + '/api/admin/config', { data: { stripe_secret: '••••c123' } });
    ok((await (await A.request.get(BASE + '/api/admin/config')).json()).config.stripe_secret.value === '••••c123', 'القيمة المخفية لا تمسح المفتاح');
    ok(!fs.readFileSync(path.join(DIR, 'd.db')).includes(Buffer.from(SK)), 'المفتاح مشفّر في قاعدة البيانات');
    const mpage = await (await M.request.get(BASE + '/api/admin/config')).status();
    ok(mpage === 403 || mpage === 401, 'المشترك لا يرى مفاتيح المنصة');

    // ---- المدير: الباقات (سعر + حدود)
    await A.goto(BASE + '/payments'); await A.waitForSelector('#t-abill [data-adm="plans"]');
    await A.click('[data-adm="plans"]'); await A.waitForSelector('#pl-t');
    const row = A.locator('#pl-t [data-pl]').filter({ has: A.locator('[data-f="name"][value="الأساسية"]') });
    await row.locator('[data-f="price"]').fill('2500'); await row.locator('[data-f="price_usd"]').fill('19'); await row.locator('[data-l="gapProducts"]').fill('2'); await row.locator('[data-l="searchesPerDay"]').fill('5'); await row.locator('[data-l="aiPerMonth"]').fill('1');
    await A.locator('#ft-t tr[data-fk=""] [data-g="ar"]').fill('تقارير أسبوعية'); await A.locator('#ft-t tr[data-fk=""] [data-g="en"]').fill('Weekly reports');
    await A.locator('[data-adm="saveall"]').first().click(); await toast(A, /حُفظت الباقات والأسعار والمميزات/); await A.waitForSelector('#ft-t');   // زر واحد يحفظ كل شيء
    if (process.env.DBG) console.log('DBG', await A.locator('#ft-t [data-g="ar"][value="تقارير أسبوعية"]').count(), await A.locator('#pl-t [data-ft^="c_"]').count());
    ok(await A.locator('#ft-t [data-g="ar"][value="تقارير أسبوعية"]').count() === 1 && await A.locator('#pl-t [data-ft^="c_"]').count() === 5, 'المدير يضيف ميزة من الواجهة فتظهر في جدول الباقات');
    if (process.env.SHOT) await A.locator('#x-abill').screenshot({ path: process.env.SHOT + '/admin-plans.png' });
    const PLS = (await (await A.request.get(BASE + '/api/admin/plans')).json()).plans, pl = PLS.find(x => x.name === 'الأساسية');
    ok(pl.price === 2500 && pl.price_usd === 19 && pl.limits.gapProducts === 2, 'حُفظ سعر الباقة (دج و$) وحدودها');
    ok(pl.features.length === 9 && pl.periods.find(x => x.m === 6).dzd === 13800 && pl.periods.find(x => x.m === 3).dzd === 7100 && !pl.periods.find(x => x.m === 1), 'الميزة الجديدة في الباقة + أسعار المدد (المبلغ اليدوي القديم الأعلى من السعر يُهمَل، و3 أشهر −5٪)');
    ok(PLS.filter(x => x.free).length === 1 && PLS.filter(x => !x.free).length === 3, 'أربع باقات: تجربة مجانية + ثلاث مدفوعة');
    ok((await (await M.request.get(BASE + '/api/me')).json()).plan === 'تجربة مجانية', 'المسجّل الجديد يأخذ الباقة المجانية تلقائياً');

    // ---- المشترك: بطاقة الاشتراك والعدادات
    await M.goto(BASE + '/subscription'); await M.waitForSelector('#x-billing .meter');
    ok((await M.locator('#x-billing .meter').count()) === 4, 'عدادات الاستعمال الأربعة');
    await M.waitForSelector('#pay-box .plan-g .plan');
    ok(!(await M.$('[data-acc="plans"]')) && !/الدفع أو تغيير العرض/.test(await M.textContent('#x-billing')), 'الدفع داخل «الدفع والتجديد» مباشرة: لا زر ولا نافذة مكررة');
    ok(await M.locator('.per-t [data-acc="per"]').count() === 3 && await M.locator('.per-t .on').getAttribute('data-m') === '6', 'قسم الدفع: 3 مدد (بلا شهر: التجربة المجانية تكفي)، و6 أشهر مختارة');
    await M.click('.per-t [data-acc="per"][data-m="3"]'); await M.locator('.plan-g [data-acc="pick"]', { hasText: 'الأساسية' }).click(); await M.waitForSelector('.per-t [data-m="3"].on');
    ok(/7[.,٬]?100/.test(await M.locator('.plan-g').textContent()), 'الباقة بسعرها في قسم الدفع (3 أشهر)');
    ok(['satim', 'stripe', 'paypal'].every(async m => 1) && await M.locator('[data-acc="pay"][data-m="satim"]').count() === 1 && await M.locator('[data-acc="pay"][data-m="stripe"]').count() === 1 && await M.locator('[data-acc="pay"][data-m="paypal"]').count() === 1 && await M.locator('[data-acc="baridi"]').count() === 1, 'طرق الدفع: CIB/الذهبية، Stripe، PayPal، BaridiMob');
    ok(/\$54\.15/.test(await M.locator('#pay-box').textContent()), 'السعر بالدولار ظاهر');
    // BaridiMob: رقم العملية + صورة الوصل
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    ok(await M.isVisible('[data-acc="wa"]') && /اسم متجرك/.test(await M.locator('.pay-m').textContent()), 'الطريقة اليدوية: BaridiMob/CCP/تحويل + زر واتساب');
    await M.click('.pay-m details summary');
    await M.fill('#bm-ref', 'BM-778899'); await M.setInputFiles('#bm-img', { name: 'r.png', mimeType: 'image/png', buffer: png });
    await M.click('[data-acc="baridi"]'); await toast(M, /أُرسل طلبك/);
    await M.waitForSelector('#x-billing details');
    ok(/قيد المراجعة/.test(await M.locator('#x-billing').textContent()), 'الطلب يظهر «قيد المراجعة» في سجل المشترك');

    // ---- المدير يقبل
    await A.goto(BASE + '/payments'); await A.waitForSelector('[data-adm="approve"]');
    ok(/BM-778899/.test(await A.locator('#x-abill').textContent()), 'رقم العملية ظاهر للمدير');
    const pid = await A.locator('[data-adm="approve"]').first().getAttribute('data-id');
    ok((await A.request.get(BASE + '/api/admin/payments/' + pid + '/proof')).status() === 200, 'صورة الوصل محفوظة ويراها المدير');
    ok((await M.request.get(BASE + '/api/admin/payments/' + pid + '/proof')).status() !== 200, 'المشترك لا يصل إلى وصولات الآخرين عبر مسار المدير');
    await A.click('[data-adm="approve"]'); await toast(A, /فُعّل الاشتراك/);
    let me = await (await M.request.get(BASE + '/api/me')).json();
    ok(me.plan === 'الأساسية' && me.expires_at > Date.now() + 32 * 864e5, 'القبول يفعّل الباقة ويضيف 30 يوماً فوق التجربة');

    // ---- حدود الباقة
    const mk = async i => { await M.request.put(BASE + '/api/saved', { data: { k: 'p' + i, snap: { v: 2, name: 'منتج ' + i, kw: 'kw' + i, cat: 'gem', score: 80, n: 1, copies: 1, images: [], top: { title: 'Night light ' + i, body: 'Star projector', link_url: 'https://shop.example/p' + i, image_url: '', country: 'US', page_id: '11' + i, page_name: 'Shop', library_url: 'https://www.facebook.com/ads/library/?id=' + i }, recs: [{ a: { title: 'Night light ' + i, body: 'Star projector', link_url: 'https://shop.example/p' + i, image_url: '', country: 'US', page_id: '11' + i, page_name: 'Shop', library_url: 'https://www.facebook.com/ads/library/?id=' + i }, age: 20, cat: 'gem', score: 80, ev: [] }], refIndex: 0, sellers: [], market: 'US', markets: ['US'], cur: 'USD', pr: 29, hits: [], why: [], proofs: [], also: [], tags: [] } } }); return M.request.post(BASE + '/api/gap', { data: { k: 'p' + i } }); };
    const r1 = await mk(1), r2 = await mk(2), r3 = await mk(3);
    ok(r1.ok() && r2.ok() && r3.status() === 429 && /حد باقتك/.test((await r3.json()).error || ''), 'حد «منتجات الثغرات» (2) يمنع الثالث');
    const st = await (await M.request.get(BASE + '/api/lib/stats')).json().catch(() => ({}));
    ok(!st.limits || st.limits.maxDay === 5, 'حد البحث اليومي من الباقة (5)');
    const bat = await M.request.post(BASE + '/api/lib/batch', { data: { count: 6 } });
    ok(bat.status() === 429, 'طلب 6 عمليات بحث يُرفض (الحد 5)');
    const bl = await (await M.request.get(BASE + '/api/billing')).json();
    ok(bl.limits.gapProducts === 2 && bl.usage.gapProducts === 2, 'الاستعمال والحدود في /api/billing');

    const days = async () => (await (await M.request.get(BASE + '/api/me')).json()).expires_at;
    const openPay = async m => { await M.goto(BASE + '/subscription'); await M.waitForSelector('#pay-box .per-t'); await M.click('.per-t [data-acc="per"][data-m="3"]'); await M.locator('.plan-g [data-acc="pick"]', { hasText: 'الأساسية' }).click(); await M.waitForSelector('.plan-g .plan.on:has-text("الأساسية")'); await M.waitForSelector('[data-acc="pay"][data-m="' + m + '"]'); };
    // ---- SATIM: CIB / الذهبية مباشرة
    let before = await days();
    await openPay('satim'); await Promise.all([M.waitForURL(/paid=/), M.click('[data-acc="pay"][data-m="satim"]')]);
    await toast(M, /تم الدفع وتفعيل اشتراكك/);
    ok(satim.length === 1 && satim[0].amount === '710000' && satim[0].currency === '012' && satim[0].userName === 'radar_api' && satim[0].password === 'satim-pass-9' && JSON.parse(satim[0].jsonParams).force_terminal_id === 'E010900001', 'SATIM: المبلغ بالسنتيم (250000) والعملة 012 ورقم الطرفية');
    ok(Math.round((await days() - before) / 864e5) === 90, 'SATIM: تأكيد الطلب من البوابة ثم تمديد 90 يوماً (3 أشهر)');
    // ---- Stripe: إشعار موقّع
    before = await days();
    await openPay('stripe'); await Promise.all([M.waitForURL(/paid=/), M.click('[data-acc="pay"][data-m="stripe"]')]);
    const sp = stripeS[0];
    ok(sp.auth === 'Bearer ' + SK && sp.f['line_items[0][price_data][unit_amount]'] === '5415' && sp.f['line_items[0][price_data][currency]'] === 'usd', 'Stripe: 54.15$ (3 أشهر −5٪) بالمفتاح السري');
    const cpid = sp.f['metadata[payment_id]'], ev = JSON.stringify({ type: 'checkout.session.completed', data: { object: { payment_status: 'paid', amount_total: 5415, metadata: { payment_id: cpid } } } });
    const t = Math.floor(Date.now() / 1000), sig = crypto.createHmac('sha256', WH).update(t + '.' + ev).digest('hex');
    const forged = await fetch(BASE + '/api/billing/webhook/stripe', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': 't=' + t + ',v1=' + 'ab'.repeat(32) }, body: ev });
    ok(forged.status === 403, 'Stripe: إشعار بتوقيع مزوَّر يُرفض');
    const good = await fetch(BASE + '/api/billing/webhook/stripe', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': 't=' + t + ',v1=' + sig }, body: ev });
    ok(good.status === 200, 'Stripe: الإشعار الموقّع يُقبل');
    for (let i = 0; i < 40 && Math.round((await days() - before) / 864e5) < 90; i++) await new Promise(r => setTimeout(r, 200));   // التفعيل نفسه (الإشعار المرئي قصير)
    let me2 = await days();
    ok(Math.round((me2 - before) / 864e5) === 90, 'Stripe: يمدّد 90 يوماً');
    await fetch(BASE + '/api/billing/webhook/stripe', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': 't=' + t + ',v1=' + sig }, body: ev });
    ok(await days() === me2, 'تكرار الإشعار لا يمدّد مرتين');
    // Stripe بلا إشعار: التحقق من الجلسة عند العودة
    const c2 = await (await M.request.post(BASE + '/api/billing/checkout', { data: { plan_id: pl.id, method: 'stripe' } })).json(); stripeS[1].paid = true;
    ok((await (await M.request.get(BASE + '/api/billing/payment/' + c2.id)).json()).status === 'paid', 'Stripe: يُفعَّل عند العودة حتى لو تأخر الإشعار');
    // ---- PayPal
    before = await days();
    await openPay('paypal'); await Promise.all([M.waitForURL(/paid=/), M.click('[data-acc="pay"][data-m="paypal"]')]);
    await toast(M, /تم الدفع وتفعيل اشتراكك/);
    ok(ppOrders.length === 1 && ppOrders[0].auth === 'Bearer PPTOK' && ppOrders[0].j.purchase_units[0].amount.value === '54.15', 'PayPal: طلب 54.15$ بالرمز');
    ok(Math.round((await days() - before) / 864e5) === 90, 'PayPal: موافقة ثم capture ثم تمديد 90 يوماً');
    const hist = await (await M.request.get(BASE + '/api/billing')).json();
    ok(hist.payments.filter(x => x.status === 'paid').map(x => x.method).sort().join(',') === 'baridi,paypal,satim,stripe,stripe', 'سجل المدفوعات بطرقها: ' + hist.payments.map(x => x.method + ':' + x.status).join(' '));

    // ---- الإحصائيات
    await A.goto(BASE + '/admin'); await A.waitForSelector('.kpis');
    const S = await (await A.request.get(BASE + '/api/admin/stats')).json();
    ok(S.active === 1 && S.revenueMonth === 14200 && S.revenueMonthUsd === 162.45 && S.revenue[11].n === 2, 'الإحصائيات: إيراد 14200 دج و162.45$ منفصلان: ' + S.revenueMonth + ' / ' + S.revenueMonthUsd);
    ok(S.plans[0].plan === 'الأساسية' && S.plans[0].n === 1, 'المشتركون حسب الباقة');
    await A.goto(BASE + '/platform/err'); await A.waitForSelector('text=سجل الأخطاء');
    await A.click('.nv[data-v="admin"]'); await A.waitForSelector('#x-users table'); ok(await A.locator('#x-users').isVisible(), 'قسم المشتركين');

    // ---- أزرار المحفوظات (3 + 2) و💰 حاسبة الربح
    await M.goto(BASE + '/saved'); await M.waitForSelector('.pc-g [data-tool="profit"]');
    const tops = await M.locator('.pc-g').first().evaluate(g => [...g.children].map(c => [c.textContent.trim().slice(0, 12), Math.round(c.getBoundingClientRect().top)]));
    const eq = (x, y) => Math.abs(x - y) < 4;
    ok(tops.length === 7 && eq(tops[1][1], tops[2][1]) && eq(tops[3][1], tops[4][1]) && eq(tops[5][1], tops[6][1]) && tops[0][1] < tops[1][1] && tops[1][1] < tops[3][1] && tops[3][1] < tops[5][1], 'الأزرار: التاريخ ثم صفوف من زرين (4 أدوات ثم الثغرات والإزالة): ' + JSON.stringify(tops));
    await M.locator('.pc-g [data-tool="profit"]').first().click(); await M.waitForSelector('[data-pf="price"]');
    await M.fill('[data-pf="price"]', '3900'); await M.fill('[data-pf="cost"]', '40'); await M.selectOption('[data-pf="costCur"]', 'CNY');
    await M.fill('[data-pf="ship"]', '350'); await M.fill('[data-pf="deliv"]', '0'); await M.fill('[data-pf="pack"]', '50'); await M.fill('[data-pf="cpl"]', '400');
    await M.fill('[data-pf="conf"]', '80'); await M.fill('[data-pf="rate"]', '75'); await M.fill('[data-pf="ret"]', '200'); await M.fill('[data-pf="leads"]', '20');
    const exp = await M.evaluate(() => window.WPRPROFIT.calc({ price: 3900, cost: 40, costCur: 'CNY', ship: 350, deliv: 0, pack: 50, cpl: 400, conf: 80, rate: 75, ret: 200, leads: 20 }));
    // 40¥×18.5=740 +350 = 1090 · إعلان 400/0.6=666.7 · مرتجع 200×0.25/0.75=66.7 · ربح 3900−1090−50−666.7−66.7 = 2026.7
    ok(Math.round(exp.profit) === 2027 && Math.round(exp.beCpl) === 1616 && Math.round(exp.unit) === 1090, 'معادلة الربح صحيحة: ' + Math.round(exp.profit) + ' · حد الإعلان ' + Math.round(exp.beCpl));
    ok(/2[.,٬]?027/.test(await M.locator('#pf-out').textContent()) && await M.locator('.pf-v.good').count() === 1, 'النتيجة تظهر مع حكم «مربح»');
    if (process.env.SHOT) { await M.locator('.tm').screenshot({ path: process.env.SHOT + '/profit.png' }); }
    await M.click('[data-pf-a="save"]'); await toast(M, /حُفظت الحاسبة/);
    await M.waitForFunction(() => /دج\/طلب/.test(document.querySelector('.pc-g [data-tool="profit"]').textContent));
    ok(true, 'شارة الربح على زر البطاقة');
    const pfd = await (await M.request.get(BASE + '/api/profit')).json();
    ok(pfd.last.conf === 80 && pfd.last.price === undefined && Object.values(pfd.items)[0].price === 3900, 'تُحفظ المدخلات، والنسب تصبح افتراضية');
    await M.keyboard.press('Escape');
    if (process.env.SHOT) { await M.locator('.pc-g').first().locator('xpath=ancestor::article[1]').screenshot({ path: process.env.SHOT + '/card.png' }); await A.goto(BASE + '/integrations'); await A.waitForSelector('[data-cfg]'); await A.screenshot({ path: process.env.SHOT + '/int.png', fullPage: true }); await A.goto(BASE + '/subscribers'); await A.click('[data-adm="stats"]'); await A.waitForSelector('.kpis'); await A.screenshot({ path: process.env.SHOT + '/stats.png' }); await M.goto(BASE + '/settings'); await M.waitForSelector('#x-billing .meter'); await M.locator('#x-billing').screenshot({ path: process.env.SHOT + '/billing.png' }); }

    // ---- 🔔 التنبيهات: ربط تيليغرام + البريد + الأحداث
    await A.request.put(BASE + '/api/admin/config', { data: { telegram_token: 'TGTOKEN', telegram_bot: '@RadarTestBot', app_url: 'https://radar.example' } });
    await M.goto(BASE + '/integrations'); await M.waitForSelector('#x-notif [data-int="tglink"]');
    await M.evaluate(() => { window.open = u => { window.__opened = u; }; });
    await M.click('[data-int="tglink"]'); await M.waitForFunction(() => window.__opened);
    const turl = await M.evaluate(() => window.__opened), code = /start=([a-f0-9]{16})$/.exec(turl)[1];
    ok(turl.startsWith('https://t.me/RadarTestBot?start='), 'رابط البوت برمز الربط');
    tgUpd.push({ update_id: 5, message: { chat: { id: 999 }, text: '/start ffffffffffffffff' } }, { update_id: 6, message: { chat: { id: 4242 }, text: '/start ' + code } });
    await M.click('[data-int="tgcheck"]'); await toast(M, /رُبط تيليغرام/);
    ok(await M.locator('#x-notif [data-nt="tg"]').isChecked(), 'تيليغرام مربوط ومفعّل');
    ok(tgSent.some(m => m.chat_id === '4242' && /تم ربط حسابك/.test(m.text)), 'رسالة ترحيب للمحادثة الصحيحة فقط');
    await M.check('#x-notif [data-nt="email"]'); await toast(M, /حُفظ/);
    await M.click('[data-int="ntest"]'); await toast(M, /أُرسل 2 تنبيه/);
    ok(tgSent.some(m => m.chat_id === '4242' && /تنبيه تجريبي/.test(m.text)) && /radar@t\.dz|تنبيه تجريبي|m@t\.dz/.test(out), 'التنبيه التجريبي عبر تيليغرام والبريد');
    const g1 = await (await M.request.post(BASE + '/api/notify/gems', { data: { items: [{ name: 'Star Lamp', score: 91 }, { name: 'Mini Fan', score: 88 }] } })).json();
    const g2 = await (await M.request.post(BASE + '/api/notify/gems', { data: { items: [{ name: 'star lamp', score: 91 }, { name: 'Neck Fan', score: 85 }] } })).json();
    ok(g1.fresh === 2 && g2.fresh === 1, '«جوهرة» جديدة تُنبَّه مرة واحدة لكل منتج');
    await new Promise(r => setTimeout(r, 500));
    ok(tgSent.some(m => /2 منتجات جديدة صارت/.test(m.text) && /radar\.example\/inbox/.test(m.text)), 'رسالة الجواهر مع رابط المنصة');
    await M.uncheck('#x-notif details [data-nev="gem"]').catch(async () => { await M.click('#x-notif details summary'); await M.uncheck('#x-notif details [data-nev="gem"]'); }); await toast(M, /حُفظ/);
    const before2 = tgSent.length; await M.request.post(BASE + '/api/notify/gems', { data: { items: [{ name: 'Other Gem', score: 90 }] } }); await new Promise(r => setTimeout(r, 400));
    ok(tgSent.length === before2, 'إيقاف نوع تنبيه يمنع إرساله');
    // طلب BaridiMob جديد ← تنبيه للمدير؛ قبوله ← تنبيه للمشترك
    const A2 = await (await A.request.put(BASE + '/api/notify', { data: { email: true } })).json();
    ok(A2.events.admin, 'المدير يرى نوع «طلبات دفع جديدة»');
    await M.request.post(BASE + '/api/billing/baridi', { data: { plan_id: pl.id, ref: 'BM-2' } }); await new Promise(r => setTimeout(r, 500));
    ok(/طلب دفع BaridiMob جديد/.test(out), 'المدير يصله بريد بطلب الدفع الجديد');
    const pend = (await (await A.request.get(BASE + '/api/admin/payments?status=pending')).json())[0];
    await A.request.post(BASE + '/api/admin/payments/' + pend.id + '/approve', { data: {} }); await new Promise(r => setTimeout(r, 500));
    ok(tgSent.some(m => m.chat_id === '4242' && /تم تفعيل اشتراكك/.test(m.text)), 'تأكيد التفعيل يصل المشترك على تيليغرام');
    await M.reload(); await M.waitForSelector('#x-notif'); ok(/آخر التنبيهات/.test(await M.locator('#x-notif').textContent()), 'سجل آخر التنبيهات');

    // ---- منتهي الاشتراك يصل إلى صفحة الدفع
    const ex = await b.newContext(), E = await ex.newPage(); E.on('pageerror', e => errs.push(e.message));
    await E.request.post(BASE + '/api/register', { data: { email: 'x@t.dz', password: 'password123' } });
    const uid = (await (await A.request.get(BASE + '/api/admin/users')).json()).find(u => u.email === 'x@t.dz').id;
    await A.request.post(BASE + '/api/admin/users/' + uid, { data: { days: -10, plan: 'الأساسية' } });
    await E.goto(BASE + '/subscription'); await E.waitForSelector('.pay-sec h3');
    ok(/اشترك الآن/.test(await E.textContent('.pay-sec h3')) && await E.$('#pay-box .plan-g'), 'منتهي الاشتراك يرى «اشترك الآن» والعروض مباشرة');

    ok(!errs.length, 'لا أخطاء جافاسكربت: ' + errs.join(' | '));
    console.log('\n✅ اختبار الاشتراكات:', pass, 'فحصاً ناجحاً');
  } catch (e) { console.error('✖', e.message, '\n', log.slice(-1500)); process.exitCode = 1; }
  finally { await b.close(); srv.kill(); mock.close(); }
})();
