'use strict';
// اختبار متصفح (Playwright) لتحسينات 9.0: معنى الكلمات عند التمرير، إضافة/حذف الكلمات من صفحة الجمع، حد الإعلانات،
// سوق المنتج وعملته وما يعادلها بالدينار، دمج نفس المنتج من سوقين، فلتر السوق في المحفوظات، مؤشرات العمليات.
// التشغيل: node adlib/ui-intl-e2e-test.js
const { spawn } = require('child_process'), assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require('playwright');
const PORT = 4600 + Math.floor(Math.random() * 90), BASE = 'http://127.0.0.1:' + PORT, DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-ui9-'));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok', m); };
(async () => {
  const env = Object.assign({}, process.env, { PORT, JWT_SECRET: 'x'.repeat(40), ADMIN_EMAIL: 'a@t.dz', DB_FILE: path.join(DIR, 'd.db'), NODE_ENV: 'test', OPENAI_API_KEY: '' });
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stderr.on('data', d => log += d);
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  const b = await chromium.launch();
  try {
    const pg = await b.newPage({ viewport: { width: 1300, height: 1500 } });
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(BASE + '/login');
    await pg.request.post(BASE + '/api/register', { data: { email: 'a@t.dz', password: 'password123' } });
    // ---- الجمع: حد الإعلانات + المعنى عند التمرير
    await pg.goto(BASE + '/collect'); await pg.waitForSelector('select[data-p="country"]');
    ok(+(await pg.getAttribute('input[data-p="maxAds"]', 'max')) >= 3000, 'ads per search can be set up to 3000');
    await pg.selectOption('select[data-p="country"]', 'US'); await pg.waitForTimeout(400);
    await pg.$$eval('details', d => d.forEach(x => { x.open = true; }));
    ok((await pg.getAttribute('button[data-g="en"][data-t="Helps"]', 'data-tip')) === 'يساعد', 'English golden word carries its Arabic meaning');
    await pg.hover('button[data-g="en"][data-t="Helps"]'); await pg.waitForTimeout(250);
    ok(await pg.evaluate(() => { const t = document.querySelector('.wtip'); return t.classList.contains('on') && t.textContent === 'يساعد'; }), 'hover shows the meaning in a floating tooltip');
    await pg.click('button[data-g="en"][data-t="Helps"]'); await pg.click('button[data-c="kids"][data-sc="en"][data-t="your child"]');
    ok((await pg.getAttribute('#l-prev .l-q span', 'data-tip')) === 'يساعد + طفلك', 'search preview shows the meaning of the combined phrase');
    await pg.selectOption('select[data-p="country"]', 'TW'); await pg.waitForTimeout(400); await pg.$$eval('details', d => d.forEach(x => { x.open = true; }));
    ok((await pg.getAttribute('button[data-g="zh"][data-t="告別"]', 'data-tip')) === 'وداعاً لـ', 'Chinese words show their meaning too');
    // ---- إضافة / حذف كلمات من صفحة الجمع نفسها
    await pg.selectOption('select[data-p="country"]', 'US'); await pg.waitForTimeout(400);
    await pg.click('[data-l="kwedit"]'); await pg.waitForSelector('.l-edit'); await pg.$$eval('details', d => d.forEach(x => { x.open = true; }));
    await pg.fill('input[data-add][data-lg="en"]', 'Keeps you warm'); await pg.click('button[data-l="dadd"][data-lg="en"]');
    await pg.waitForSelector('button[data-d="g"][data-lg="en"][data-t="Keeps you warm"].custom', { timeout: 8000 });
    ok(true, 'a golden word is added from the collect page');
    await pg.click('button[data-d="g"][data-lg="en"][data-t="Fixes"]');
    await pg.waitForSelector('button[data-d="g"][data-lg="en"][data-t="Fixes"].off', { timeout: 8000 });
    ok(true, 'a default golden word is disabled with ×');
    await pg.fill('input[data-add][data-n="kids"][data-sc="en"]', 'your toddler'); await pg.click('button[data-l="dadd"][data-n="kids"][data-sc="en"]');
    await pg.waitForSelector('button[data-d="n"][data-n="kids"][data-sc="en"][data-t="your toddler"]', { timeout: 8000 });
    ok(true, 'a complementary word is added to a niche');
    await pg.click('[data-l="kwedit"]'); await pg.waitForTimeout(500); await pg.$$eval('details', d => d.forEach(x => { x.open = true; }));
    ok(await pg.$('button[data-g="en"][data-t="Keeps you warm"]') && !(await pg.$('button[data-g="en"][data-t="Fixes"]')), 'after editing, the new word is selectable and the disabled one is gone');
    // ---- التحليل: سوق المنتج، العملة، الدينار، نفس المنتج في سوقين
    const NOW = Date.now(), day = d => new Date(NOW - d * 864e5).toISOString().slice(0, 10);
    const rows = [
      { ad_id: '11', page_name: 'US Shop', title: 'Helps your baby sleep', body: 'Night light. Free shipping. Only $29.99', country: 'US', start_date: day(20), status: 'active', link_url: 'https://cjdropshipping.com/product/night-light-star-p-1a2b3c4d-5e6f.html', image_url: 'https://cdn.example.test/a.jpg', collected_at: new Date(NOW).toISOString() },
      { ad_id: '12', page_name: 'FR Boutique', title: 'Aide votre bébé à dormir', body: 'Veilleuse. Livraison gratuite. 24,90€', country: 'FR', start_date: day(15), status: 'active', link_url: 'https://cjdropshipping.com/product/veilleuse-p-1a2b3c4d-5e6f.html?from=fr', image_url: 'https://cdn.example.test/b.jpg', collected_at: new Date(NOW).toISOString() },
      { ad_id: '13', page_name: 'DZ Store', title: 'يساعد طفلك على النوم', body: 'مصباح. التوصيل 58 ولاية. 3500 دج', start_date: day(12), status: 'active', link_url: 'https://dzstore.example/p/lamp', image_url: 'https://cdn.example.test/c.jpg', collected_at: new Date(NOW).toISOString() }
    ];
    const f = path.join(DIR, 'ads.json'); fs.writeFileSync(f, JSON.stringify(rows));
    await pg.goto(BASE + '/analyze'); await pg.waitForSelector('#mkt');
    ok((await pg.$$eval('#mkt option', o => o.length)) > 40, 'file market selector lists the markets');
    await pg.setInputFiles('#file', f); await pg.waitForSelector('.pc', { timeout: 15000 }); await pg.waitForTimeout(800);
    const cards = await pg.$$eval('.pc', cs => cs.map(c => c.textContent));
    const merged = cards.find(t => /US Shop/.test(t));
    ok(cards.length === 3 && merged && /الولايات المتحدة/.test(merged) && cards.some(t => /FR Boutique/.test(t) && /فرنسا/.test(t)), 'each ad is its own card (no grouping) and keeps its own market');
    ok(/US\$/.test(merged) && /≈/.test(merged) && /دج/.test(merged), 'price shows its currency and the DZD equivalent');
    ok(cards.some(t => /DZ Store/.test(t) && /دج/.test(t) && !/≈/.test(t)), 'Algerian price stays in DZD');
    ok((await pg.$$eval('#fmk option', o => o.map(x => x.value))).includes('US'), 'market filter lists the markets of the results');
    ok((await pg.$$eval('#rates [data-rate]', i => i.map(x => x.dataset.rate))).includes('USD'), 'exchange rate editor shows the currencies found');
    ok(await pg.evaluate(() => !!document.querySelector('#actbar') && typeof window.__busy === 'function'), 'activity bar and status pill are installed');
    // حفظ المنتج → فلتر السوق في المحفوظات
    await pg.click('.pc:has-text("US Shop") button.save'); await pg.waitForTimeout(800);
    await pg.goto(BASE + '/saved'); await pg.waitForSelector('[data-svmk]');
    const btns = await pg.$$eval('[data-svmk]', x => x.map(y => y.textContent));
    ok(btns.some(t => /الولايات المتحدة/.test(t)), 'saved products can be filtered by market (origin kept)');
    ok(/الولايات المتحدة/.test(await pg.textContent('#x-saved .pc')), 'saved card shows the market it came from');
    ok(!errs.length, 'no page errors ' + errs.join(' | '));
    console.log(`PASS ${pass} v9 interface checks`);
  } catch (e) { console.error('FAIL', e.message); console.error(log.slice(-1500)); process.exitCode = 1; }
  finally { await b.close(); srv.kill(); fs.rmSync(DIR, { recursive: true, force: true }); }
})();
