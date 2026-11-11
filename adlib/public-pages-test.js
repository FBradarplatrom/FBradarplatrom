'use strict';
// الصفحات العامة: الصفحة الرئيسية وصفحة الدخول بثلاث لغات، الأسعار من الباقات، وبلا كشف لطريقة عمل المنصة.
// التشغيل: node adlib/public-pages-test.js   (SHOT=مجلد لحفظ صور الشاشة)
const { spawn } = require('child_process'), assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require('playwright');
const PORT = 5200 + Math.floor(Math.random() * 80), BASE = 'http://127.0.0.1:' + PORT, DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-pub-'));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok', m); };
(async () => {
  const env = Object.assign({}, process.env, { PORT, JWT_SECRET: 'p'.repeat(40), ADMIN_EMAIL: 'a@t.dz', DB_FILE: path.join(DIR, 'd.db'), IMG_DIR: path.join(DIR, 'img'), NODE_ENV: 'test', STRIPE_SECRET_KEY: 'sk_test_x' });
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stderr.on('data', d => log += d);
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  const b = await chromium.launch();
  try {
    // prices for the pricing section
    const A = await b.newPage(); await A.request.post(BASE + '/api/register', { data: { email: 'a@t.dz', password: 'password123' } });
    // الأسعار الافتراضية: 3 باقات بسعر شهري × مدد بخصم (مثل عرض الأسعار المعتمد)
    const pub0 = await (await fetch(BASE + '/api/plans/public')).json(), st = pub0.plans.find(p => p.name === 'البداية');
    ok(pub0.plans.length === 4 && pub0.periods.map(x => x.m + ':' + x.off).join(',') === '1:0,3:5,6:8,12:15', 'تجربة مجانية + 3 باقات، والمدد 1/3/6/12 بخصم 0/5/8/15٪');
    ok(st.price === 3900 && st.periods.find(x => x.m === 6).dzd === 21500 && st.periods.find(x => x.m === 6).monthly === 3583 && st.periods.find(x => x.m === 6).save === 1900, 'البداية: 3900 شهرياً، 6 أشهر = 21500 (3583 للشهر، توفير 1900)');
    { const pg0 = await b.newPage(); await pg0.goto(BASE + '/?lang=ar'); await pg0.waitForSelector('#plans .plan');
      const t0 = await pg0.locator('#plans').innerText();
      ok((await pg0.$$('#plans .plan')).length === 3 && (await pg0.$$('.ptabs [data-per]')).length === 4 && await pg0.getAttribute('.ptabs .on', 'data-per') === '6' && /21[.,٬\s]?500/.test(t0) && /3[.,٬\s]?583/.test(t0) && await pg0.isVisible('.ptrial'), 'الأسعار: أزرار المدد (6 أشهر افتراضياً)، 3 بطاقات، والتجربة المجانية');
      await pg0.click('.ptabs [data-per="12"]'); ok(/39[.,٬\s]?800/.test(await pg0.locator('#plans').innerText()), 'تغيير المدة يغيّر الأسعار (12 شهراً −15٪)'); await pg0.close(); }
    // المدير يضيف ميزة ويحذف أخرى ويخفي ميزة مدمجة
    const cat0 = (await (await A.request.get(BASE + '/api/admin/plans')).json()).cat;
    ok(cat0.length === 8 && cat0.every(f => f.builtin && f.ar && f.en && f.fr), 'كتالوج المميزات: 8 مدمجة بثلاث لغات');
    let r = await (await A.request.put(BASE + '/api/admin/features', { data: { list: cat0.map(f => f.k === 'sheets' ? Object.assign({}, f, { shown: false }) : f).concat([{ ar: 'دعم عبر واتساب', en: 'WhatsApp support', fr: 'Support WhatsApp' }, { ar: 'ميزة للحذف', en: 'To delete' }]) } })).json();
    ok(r.cat.length === 10 && r.cat.filter(f => !f.builtin).length === 2, 'إضافة ميزتين جديدتين');
    const del = r.cat.find(f => f.ar === 'ميزة للحذف');
    r = await (await A.request.put(BASE + '/api/admin/features', { data: { list: r.cat.filter(f => f.k !== del.k).concat([{ k: 'gap', ar: 'x' }].slice(0, 0)) } })).json();
    ok(r.cat.length === 9 && !r.cat.some(f => f.k === del.k), 'حذف الميزة المضافة');
    r = await (await A.request.put(BASE + '/api/admin/features', { data: { list: r.cat.filter(f => f.k !== 'gap') } })).json();
    ok(r.cat.some(f => f.k === 'gap'), 'الميزات المدمجة لا تُحذف');
    const wa = r.cat.find(f => f.en === 'WhatsApp support');
    const pls = (await (await A.request.get(BASE + '/api/admin/plans')).json()).plans.map((p, i) => Object.assign(p, p.free ? { features: p.features.filter(k => k !== 'tiktok' && k !== 'sheets') } : { price: [2900, 7900, 24900][i - 1] || 0, price_usd: [19, 49, 149][i - 1] || 0 }));
    await A.request.put(BASE + '/api/admin/plans', { data: { plans: pls } });
    const pub = await (await fetch(BASE + '/api/plans/public')).json();
    ok(pub.features.some(f => f.k === wa.k) && !pub.features.some(f => f.k === 'sheets') && pub.plans.filter(p => !p.free).every(p => p.features.includes(wa.k)), 'الميزة الجديدة في الأسعار ومضافة للباقات المدفوعة، والمخفية لا تظهر');
    ok(pub.plans.length === 4 && pub.plans.filter(p => p.free).length === 1 && pub.methods.stripe === true && !JSON.stringify(pub).includes('"id"'), 'الأسعار العامة: 4 باقات (واحدة مجانية) بلا بيانات داخلية');
    const errs = [];
    for (const [lg, h1, dir] of [['ar', /قبل أن يزدحم السوق/, 'rtl'], ['en', /before the market gets crowded/, 'ltr'], ['fr', /avant que le marché ne sature/, 'ltr']]) {
      const pg = await b.newPage({ viewport: { width: 1280, height: 900 } }); pg.on('pageerror', e => errs.push(lg + ': ' + e.message));
      await pg.goto(BASE + '/?lang=' + lg); await pg.waitForSelector('#plans .plan');
      const txt = await pg.locator('body').innerText();
      ok(h1.test(await pg.locator('h1').innerText()) && await pg.getAttribute('html', 'dir') === dir, lg + ': العنوان واتجاه الصفحة');
      ok((await pg.$$('#plans .plan')).length === 3 && await pg.isVisible('.ptrial') && /\$104\.88/.test(txt), lg + ': الباقات الثلاث بأسعارها (والدولار للبطاقة الدولية) + التجربة المجانية');
      ok(!/الجزائري|algérien|Algerian market/i.test(await pg.locator('.hero').innerText()), lg + ': لا عبارة «للسوق الجزائري» في الواجهة');
      ok(!/(أوزان|weights|pondération|الكلمات الذهبية|golden word|mots dorés|عدد البائعين|number of sellers|37|26 نقطة)/i.test(txt), lg + ': لا كشف لطريقة التصنيف والأوزان');
      ok(!/(للجزائر فقط|لكل الأسواق|Every market|Tous les marchés|only for one country|réservé à un seul pays)/i.test(txt) && (await pg.$$('#faqs details')).length >= 8, lg + ': أسئلة مفيدة، وبلا «للجزائر فقط» ولا «لكل الأسواق»');
      await pg.waitForSelector('.wpr-dock .wd-th'); ok(await pg.isVisible('#lang-b') && !(await pg.$('.wpr-dock .wd-lang')) && !(await pg.isVisible('#lang')), lg + ': اللغة في الأعلى، والأزرار العائمة واتساب والوضع فقط');
      ok(await pg.isVisible('footer .fb p') && await pg.isVisible('footer .fcp') && /BaridiMob/.test(await pg.innerText('#pay')) && !/طرق الدفع:|Payment methods:|Moyens de paiement/.test(await pg.innerText('#pay')), lg + ': فوتر بالوصف والحقوق، وجملة الدفع');
      const tr = await pg.innerText('.ptrial'), ons = await pg.locator('#plans .plan').nth(1).locator('li.off').count();
      ok(/TikTok/.test(tr) && /واتساب|WhatsApp/.test(tr) && ons === 0, lg + ': مميزات كل باقة كما حددها المدير (غير المشمول في التجربة مذكور): ' + tr.replace(/\n/g, ' '));
      if (process.env.SHOT) await pg.screenshot({ path: process.env.SHOT + '/landing-' + lg + '.png', fullPage: true });
      await pg.close();
    }
    // language persists to the sign-up page
    const pg = await b.newPage({ viewport: { width: 1280, height: 900 } }); pg.on('pageerror', e => errs.push('login: ' + e.message));
    await pg.goto(BASE + '/?lang=en'); await pg.click('a.btn.p >> nth=0'); await pg.waitForURL(/\/register\?lang=en/);
    await pg.waitForSelector('#f-register:not([hidden])');
    ok(/Create your account/.test(await pg.locator('#ttl').innerText()) && /Email/.test(await pg.locator('#f-register').innerText()), 'التسجيل بالإنجليزية بعد اختيارها في الصفحة الرئيسية');
    await pg.fill('#r-em', 'bad'); await pg.click('#f-register .btn'); await pg.waitForSelector('#msg .msg');
    ok(/Enter a valid email/.test(await pg.locator('#msg').innerText()), 'رسائل الخطأ مترجمة');
    await pg.waitForSelector('.wd-lang'); await pg.click('.wd-lang'); await pg.click('[data-lang="fr"]'); await pg.waitForURL(/lang=fr/); await pg.waitForSelector('#ttl');
    ok(/Créez votre compte/.test(await pg.locator('#ttl').innerText()), 'تبديل اللغة إلى الفرنسية');
    if (process.env.SHOT) await pg.screenshot({ path: process.env.SHOT + '/login-fr.png' });
    await pg.fill('#r-em', 'n@t.dz'); await pg.fill('#r-pw', 'password123'); await pg.fill('#r-pw2', 'password123'); await pg.click('#f-register .btn'); await pg.waitForURL(BASE + '/');
    const me = await (await pg.request.get(BASE + '/api/me')).json();
    ok(me.plan === 'تجربة مجانية' && me.active, 'الحساب الجديد يبدأ بالتجربة المجانية');
    ok(!me.features.includes('tiktok') && me.features.includes('gap') && me.features.includes('sheets'), 'مميزات الحساب = مميزات باقته (والمخفية من الأسعار متاحة للجميع)');
    const tt = await pg.request.get(BASE + '/api/tt'), gp = await pg.request.get(BASE + '/api/gap');
    ok(tt.status() === 403 && /غير متاح في باقتك/.test((await tt.json()).error) && gp.status() === 200, 'ميزة خارج الباقة تُرفض (TikTok) والمشمولة تعمل');
    await pg.waitForSelector('.nv[data-v="gap"]', { state: 'attached' });
    ok(await pg.$eval('.nv[data-v="tiktok"]', b => b.hidden) && !(await pg.$eval('.nv[data-v="gap"]', b => b.hidden)), 'قسم TikTok مخفي في القائمة لأنه خارج الباقة');
    if (process.env.SHOT) { await pg.goto(BASE + '/login?lang=ar'); await pg.context().clearCookies(); await pg.goto(BASE + '/login?lang=ar'); await pg.waitForSelector('#ttl'); await pg.screenshot({ path: process.env.SHOT + '/login-ar.png' }); }
    // الصفحات القانونية
    await A.request.put(BASE + '/api/admin/config', { data: { biz_name: 'Radar SARL', biz_country: 'الجزائر', support_email: 'help@radar.test', refund_days: '10' } });
    for (const [path, lg, re] of [['/terms', 'ar', /شروط الاستخدام/], ['/privacy', 'en', /Privacy Policy/], ['/refund', 'fr', /Remboursement/], ['/contact', 'en', /Contact us/]]) {
      const lp = await b.newPage(); lp.on('pageerror', e => errs.push(path + ': ' + e.message)); await lp.goto(BASE + path + '?lang=' + lg); await lp.waitForFunction(() => /help@radar\.test/.test(document.body.innerText));
      const tx = await lp.locator('main').innerText(); ok(re.test(tx) && /help@radar\.test/.test(tx) && (path !== '/refund' || /10/.test(tx)), 'صفحة ' + path + ' (' + lg + ') بمعلومات النشاط'); await lp.close(); }
    { const lp = await b.newPage(); await lp.goto(BASE + '/?lang=en'); ok((await lp.$$('footer a[href^="/terms"], footer a[href^="/privacy"], footer a[href^="/refund"], footer a[href^="/contact"]')).length === 4, 'روابط الصفحات القانونية في أسفل الصفحة الرئيسية'); await lp.close(); }
    { const lp = await b.newPage(); await lp.goto(BASE + '/register?lang=en'); await lp.waitForSelector('#f-register:not([hidden])'); ok(/By creating an account you agree to the/.test(await lp.locator('.consent').innerText()), 'موافقة الشروط عند التسجيل (مترجمة)'); await lp.close(); }
    ok(!errs.length, 'لا أخطاء جافاسكربت: ' + errs.join(' | '));
    console.log(`PASS ${pass} public pages checks`);
  } catch (e) { console.error('FAIL', e.message, log.slice(-800)); process.exitCode = 1; }
  finally { await b.close(); srv.kill(); }
})();
