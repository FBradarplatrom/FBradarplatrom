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
    const pls = (await (await A.request.get(BASE + '/api/admin/plans')).json()).plans.map((p, i) => Object.assign(p, p.free ? { features: p.features.filter(k => k !== 'tiktok' && k !== 'sheets') } : { price: [2900, 7900, 24900][i - 1] || 0, price_usd: [19, 49, 149][i - 1] || 0 }));
    await A.request.put(BASE + '/api/admin/plans', { data: { plans: pls } });
    const pub = await (await fetch(BASE + '/api/plans/public')).json();
    ok(pub.plans.length === 4 && pub.plans.filter(p => p.free).length === 1 && pub.methods.stripe === true && !JSON.stringify(pub).includes('"id"'), 'الأسعار العامة: 4 باقات (واحدة مجانية) بلا بيانات داخلية');
    const errs = [];
    for (const [lg, h1, dir] of [['ar', /قبل أن يزدحم السوق/, 'rtl'], ['en', /before the market gets crowded/, 'ltr'], ['fr', /avant que le marché ne sature/, 'ltr']]) {
      const pg = await b.newPage({ viewport: { width: 1280, height: 900 } }); pg.on('pageerror', e => errs.push(lg + ': ' + e.message));
      await pg.goto(BASE + '/?lang=' + lg); await pg.waitForSelector('#plans .plan');
      const txt = await pg.locator('body').innerText();
      ok(h1.test(await pg.locator('h1').innerText()) && await pg.getAttribute('html', 'dir') === dir, lg + ': العنوان واتجاه الصفحة');
      ok((await pg.$$('#plans .plan')).length === 4 && /\$19/.test(txt), lg + ': الباقات الأربع بأسعارها');
      ok(!/الجزائري|algérien|Algerian market/i.test(await pg.locator('.hero').innerText()), lg + ': لا عبارة «للسوق الجزائري» في الواجهة');
      ok(!/(أوزان|weights|pondération|الكلمات الذهبية|golden word|mots dorés|عدد البائعين|number of sellers|37|26 نقطة)/i.test(txt), lg + ': لا كشف لطريقة التصنيف والأوزان');
      ok(!/(للجزائر فقط|لكل الأسواق|Every market|Tous les marchés|only for one country|réservé à un seul pays)/i.test(txt) && (await pg.$$('#faqs details')).length >= 8, lg + ': أسئلة مفيدة، وبلا «للجزائر فقط» ولا «لكل الأسواق»');
      ok(await pg.$eval('#lang', s => s.tagName) === 'SELECT', lg + ': اختيار اللغة قائمة منسدلة');
      const free = pg.locator('#plans .plan').first(), offs = await free.locator('li.off').allTextContents(), ons = await pg.locator('#plans .plan').nth(1).locator('li.off').count();
      ok(offs.length === 2 && offs.some(x => /TikTok/.test(x)) && ons === 0, lg + ': مميزات كل باقة كما حددها المدير (✕ لغير المشمول): ' + offs.join(' | '));
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
    await pg.selectOption('#lang', 'fr'); await pg.waitForURL(/lang=fr/); await pg.waitForSelector('#ttl');
    ok(/Créez votre compte/.test(await pg.locator('#ttl').innerText()), 'تبديل اللغة إلى الفرنسية');
    if (process.env.SHOT) await pg.screenshot({ path: process.env.SHOT + '/login-fr.png' });
    await pg.fill('#r-em', 'n@t.dz'); await pg.fill('#r-pw', 'password123'); await pg.fill('#r-pw2', 'password123'); await pg.click('#f-register .btn'); await pg.waitForURL(BASE + '/');
    const me = await (await pg.request.get(BASE + '/api/me')).json();
    ok(me.plan === 'تجربة مجانية' && me.active, 'الحساب الجديد يبدأ بالتجربة المجانية');
    ok(!me.features.includes('tiktok') && me.features.includes('gap'), 'مميزات الحساب = مميزات باقته');
    const tt = await pg.request.get(BASE + '/api/tt'), gp = await pg.request.get(BASE + '/api/gap');
    ok(tt.status() === 403 && /غير متاح في باقتك/.test((await tt.json()).error) && gp.status() === 200, 'ميزة خارج الباقة تُرفض (TikTok) والمشمولة تعمل');
    await pg.waitForSelector('.nv[data-v="gap"]', { state: 'attached' });
    ok(await pg.$eval('.nv[data-v="tiktok"]', b => b.hidden) && !(await pg.$eval('.nv[data-v="gap"]', b => b.hidden)), 'قسم TikTok مخفي في القائمة لأنه خارج الباقة');
    if (process.env.SHOT) { await pg.goto(BASE + '/login?lang=ar'); await pg.context().clearCookies(); await pg.goto(BASE + '/login?lang=ar'); await pg.waitForSelector('#ttl'); await pg.screenshot({ path: process.env.SHOT + '/login-ar.png' }); }
    ok(!errs.length, 'لا أخطاء جافاسكربت: ' + errs.join(' | '));
    console.log(`PASS ${pass} public pages checks`);
  } catch (e) { console.error('FAIL', e.message, log.slice(-800)); process.exitCode = 1; }
  finally { await b.close(); srv.kill(); }
})();
