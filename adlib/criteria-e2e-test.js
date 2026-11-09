'use strict';
// اختبار متصفح لمعايير 11.2: التصنيفات (تحت التجربة ← واعد ← جوهرة…) وزر «↩️ سبب خاطئ» للإقصاء.
// التشغيل: node adlib/criteria-e2e-test.js
const { spawn } = require('child_process'), assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require('playwright');
const PORT = 5100 + Math.floor(Math.random() * 80), BASE = 'http://127.0.0.1:' + PORT, DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-crit-'));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok', m); };
(async () => {
  const env = Object.assign({}, process.env, { PORT, JWT_SECRET: 'z'.repeat(40), ADMIN_EMAIL: 'a@t.dz', DB_FILE: path.join(DIR, 'd.db'), IMG_DIR: path.join(DIR, 'img'), NODE_ENV: 'test' });
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stderr.on('data', d => log += d);
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  const b = await chromium.launch();
  try {
    const pg = await b.newPage({ viewport: { width: 1300, height: 1400 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    pg.on('dialog', d => d.accept());
    await pg.request.post(BASE + '/api/register', { data: { email: 'a@t.dz', password: 'password123' } });
    const NOW = Date.now(), day = d => new Date(NOW - d * 864e5).toISOString().slice(0, 10);
    const ad = (id, o) => Object.assign({ ad_id: id, page_id: 'p' + id, page_name: 'متجر ' + id, status: 'active', country: 'DZ', image_url: 'https://cdn.example.test/' + id + '.jpg' }, o);
    const rows = [
      ad('1', { title: 'جهاز يقضي على الناموس', body: 'السعر 2900 دج التوصيل 58 ولاية', start_date: day(2), link_url: 'https://a.dz/products/mosq' }),
      ad('2', { title: 'كريم مضاد للتعرق', body: 'السعر 1900 دج الدفع عند الاستلام', start_date: day(5), link_url: 'https://b.dz/products/anti-sweat-cream' }),
      ad('3', { title: 'كريم مضاد للتعرق', body: 'السعر 1900 دج الدفع عند الاستلام', start_date: day(6), link_url: 'https://b.dz/products/anti-sweat-cream', page_id: 'p2', page_name: 'متجر 2' }),
      ad('4', { title: 'مصباح يساعد طفلك على النوم', body: 'السعر 3500 دج التوصيل مجاني', start_date: day(15), link_url: 'https://c.dz/products/lamp' }),
      ad('5', { title: 'مرآة حائط كبيرة', body: 'مرآة جدارية كبيرة بإطار ذهبي للصالون. السعر 9000 دج', start_date: day(12), link_url: 'https://d.dz/products/mirror' }),
      ad('6', { title: 'قشابية جزائرية أصيلة', body: 'لباس المرأة الجزائرية التقليدي، يحمي من البرد. السعر 6500 دج التوصيل لكل الولايات', start_date: day(12), link_url: 'https://e.dz/products/qachabia' })
    ];
    const f = path.join(DIR, 'ads.json'); fs.writeFileSync(f, JSON.stringify(rows));
    await pg.goto(BASE + '/analyze'); await pg.waitForSelector('#file', { state: 'attached' });
    await pg.setInputFiles('#file', f); await pg.waitForSelector('.pc', { timeout: 15000 }); await pg.waitForTimeout(800);
    const tabs = await pg.$$eval('#tabs button', bs => bs.map(x => x.dataset.t));
    ok(tabs.slice(1, 6).join(',') === 'trial,prom,gem,fire,maybe', 'ترتيب التبويبات: تحت التجربة ← واعد ← جوهرة ← رابح ← رابح محتمل');
    const cats = await pg.evaluate(() => window.WPR.PROD().map(p => [p.cat, p.name]));
    ok(cats[0][0] === 'trial' && cats[1][0] === 'prom', 'ترتيب البطاقات يبدأ بتحت التجربة ثم واعد: ' + JSON.stringify(cats));
    ok(cats.some(c => c[0] === 'prom' && /تعرق/.test(c[1])), 'إعلان عمره 5-6 أيام بنسختين وفائدة = 🌱 واعد');
    ok(cats.some(c => c[0] === 'gem' && /قشابية/.test(c[1])), 'القشابية لم تعد تُقصى بسبب «المرأة»');
    // زر «سبب خاطئ» على المرآة
    await pg.click('#tabs [data-t="excl"]'); await pg.waitForSelector('[data-fix]');
    const why = await pg.locator('.pc .tg.bad').first().textContent();
    ok(/«مرآة حائط»/.test(why), 'سبب الإقصاء يُظهر الكلمة في جملتها: ' + why.slice(0, 120));
    const pre = await (await pg.request.post(BASE + '/api/lib/ingest', { data: { ads: [{ ad_archive_id: '9001', page_id: '56', page_name: 'Deco', start_date: Math.floor(NOW / 1000) - 864000, is_active: true, collation_count: 1, publisher_platform: ['FACEBOOK'], snapshot: { title: 'مرآة حائط كبيرة', body: { text: 'مرآة جدارية كبيرة بإطار ذهبي. السعر 9000 دج' }, link_url: 'https://deco.dz/products/wall-mirror-1', cta_type: 'SHOP_NOW', display_format: 'IMAGE', images: [{ resized_image_url: 'https://scontent.example/9001.jpg' }] } }], ctx: { query: 'x', country: 'DZ' } } })).json();
    ok(pre.filtered === 1, 'قبل التصحيح: مرآة الحائط تُستبعد عند الاستقبال');
    await pg.click('[data-fix]'); await pg.waitForFunction(() => /تم التصحيح/.test(document.querySelector('#toasts').textContent), null, { timeout: 8000 });
    await pg.waitForFunction(() => !window.WPR.PROD().some(p => p.cat === 'excl'), null, { timeout: 8000 });
    ok(true, 'بعد «سبب خاطئ» عاد المنتج');
    const fx = await (await pg.request.get(BASE + '/api/lib/fix')).json();
    ok(fx.ignore.includes('مرآة حائط'), 'التصحيح محفوظ في الحساب');
    // يُطبَّق عند الاستقبال أيضاً
    const mirror = id => ({ ad_archive_id: id, page_id: '55', page_name: 'Deco', start_date: Math.floor(NOW / 1000) - 864000, is_active: true, collation_count: 1, publisher_platform: ['FACEBOOK'],
      snapshot: { title: 'مرآة حائط كبيرة', body: { text: 'مرآة جدارية كبيرة بإطار ذهبي. السعر 9000 دج' }, link_url: 'https://deco.dz/products/wall-mirror-' + id, cta_type: 'SHOP_NOW', display_format: 'IMAGE', images: [{ resized_image_url: 'https://scontent.example/' + id + '.jpg' }] } });
    const ing = await (await pg.request.post(BASE + '/api/lib/ingest', { data: { ads: [mirror('9002')], ctx: { query: 'x', country: 'DZ' } } })).json();
    ok(ing.added === 1 && !ing.filtered, 'الاستقبال يحترم التصحيح (لا استبعاد بنفس الكلمة): ' + JSON.stringify(ing).slice(0, 120));
    await pg.reload(); await pg.waitForSelector('[data-unfix="مرآة حائط"]', { state: 'attached', timeout: 8000 });
    await pg.evaluate(() => document.querySelector('[data-unfix="مرآة حائط"]').click());
    await pg.waitForFunction(() => /تم التراجع/.test(document.querySelector('#toasts').textContent), null, { timeout: 8000 });
    ok(!(await (await pg.request.get(BASE + '/api/lib/fix')).json()).ignore.includes('مرآة حائط'), 'التراجع عن التصحيح من إعدادات التحليل');
    ok(!errs.length, 'لا أخطاء جافاسكربت: ' + errs.join(' | '));
    console.log('\n✅ اختبار المعايير:', pass, 'فحصاً ناجحاً');
  } catch (e) { console.error('✖', e.message, '\n', log.slice(-1500)); process.exitCode = 1; }
  finally { await b.close(); srv.kill(); }
})();
