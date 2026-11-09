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
      ad('4', { title: 'مصباح يساعد طفلك على النوم', body: 'السعر 3500 دج التوصيل مجاني', start_date: day(15), link_url: 'https://c.dz/products/lamp' }),
      ad('7', { title: 'ساعة يد أنيقة', body: 'ساعة عادية بتصميم جميل. السعر 2500 دج', start_date: day(25), link_url: 'https://g.dz/products/watch' }),
      ad('5', { title: 'مرآة حائط كبيرة', body: 'مرآة جدارية كبيرة بإطار ذهبي للصالون. السعر 9000 دج', start_date: day(12), link_url: 'https://d.dz/products/mirror' }),
      ad('6', { title: 'قشابية جزائرية أصيلة', body: 'لباس المرأة الجزائرية التقليدي، يحمي من البرد. السعر 6500 دج التوصيل لكل الولايات', start_date: day(12), link_url: 'https://e.dz/products/qachabia' }),
      ad('8', { title: 'منظف سحري للسيراميك', body: 'السعر 1200 دج. ' + 'منتج جديد بتركيبة فعالة وسهل الاستعمال في كل البيت والمطبخ والحمام وبدون مجهود كبير منك. '.repeat(2) + 'يزيل البقع الصعبة من الأرضيات', start_date: day(18), link_url: 'https://h.dz/products/cleaner' }),
      ad('9', { status: 'inactive', title: 'جهاز يزيل الشعر', body: 'السعر 4500 دج', start_date: day(50), end_date: day(20), link_url: 'https://i.dz/products/epil' }),
      ad('10', { page_name: 'Hair Pro', title: 'تكوين في الحلاقة سجل الآن', body: 'تكوين في الحلاقة سجل الآن. السعر 9000 دج', start_date: day(15), link_url: 'https://j.dz/formation' })
    ];
    const f = path.join(DIR, 'ads.json'); fs.writeFileSync(f, JSON.stringify(rows));
    await pg.goto(BASE + '/analyze'); await pg.waitForSelector('#file', { state: 'attached' });
    await pg.setInputFiles('#file', f); await pg.waitForSelector('.pc', { timeout: 15000 }); await pg.waitForTimeout(800);
    const tabs = await pg.$$eval('#tabs button', bs => bs.map(x => x.dataset.t));
    ok(tabs.slice(1, 8).join(',') === 'trial,prom,gem,fire,old,ended,low', 'التبويبات: تحت التجربة ← واعد ← جوهرة ← رابح ← قديم ← توقف بعد نجاح ← ضعيف: ' + tabs.join(','));
    const P = await pg.evaluate(() => window.WPR.PROD().map(p => ({ cat: p.cat, name: p.name, ben: p.ben, warn: p.warn || '' })));
    const names = P.map(p => p.cat + ':' + p.name);
    ok(P[0].cat === 'trial' && P[1].cat === 'prom', 'الترتيب يبدأ بتحت التجربة ثم واعد: ' + JSON.stringify(names));
    const gems = P.filter(p => p.cat === 'gem');
    ok(gems.map(p => p.ben).join(',') === [...gems.map(p => p.ben)].sort((a, b) => b - a).join(',') && gems[gems.length - 1].ben === 0, 'داخل «جوهرة»: الفائدة في العنوان ← في النص ← بلا فائدة: ' + gems.map(p => p.name + '(' + p.ben + ')').join(' · '));
    ok(gems.some(p => /منظف/.test(p.name) && p.ben === 1), 'الفائدة في باقي النص = ☑️ «فائدة في النص»');
    ok(gems.some(p => /ساعة/.test(p.name)) , 'منتج بلا فائدة يبقى في تصنيف مدته (لا يختفي)');
    ok(gems.some(p => /قشابية/.test(p.name)), 'القشابية لا تُقصى بسبب «المرأة»');
    ok(gems.some(p => /مرآة/.test(p.name) && /قد يكون هش/.test(p.warn)), 'مرآة الحائط: تنبيه «قد يكون هشاً» بدل الإقصاء');
    ok(P.some(p => p.cat === 'ended' && /الشعر/.test(p.name)), 'إعلان استمر 30 يوماً ثم توقف = ⏹️ توقف بعد نجاح');
    if (process.env.SHOT) await pg.locator('#grid').screenshot({ path: process.env.SHOT + '/grid.png' });
    const badges = await pg.$$eval('.pc .bn', b => b.map(x => x.textContent));
    ok(badges.includes('✅ فائدة') && badges.includes('☑️ فائدة في النص') && badges.includes('بلا فائدة واضحة') && !(await pg.$('.pc .ring')), 'شارة الفائدة بدل دائرة النقاط');
    ok(!/بائع/.test(await pg.locator('.pc .pc-st').first().textContent()), 'لا عدد بائعين في البطاقة');
    // زر «سبب خاطئ» على إعلان تكوين
    await pg.click('#tabs [data-t="excl"]'); await pg.waitForSelector('[data-fix]');
    const why = await pg.locator('.pc .tg.bad').first().textContent();
    ok(/«تكوين»/.test(why), 'سبب الإقصاء يُظهر الكلمة في جملتها: ' + why.slice(0, 120));
    const crs = id => ({ ad_archive_id: id, page_id: '5' + id, page_name: 'Hair Pro', start_date: Math.floor(NOW / 1000) - 864000, is_active: true, collation_count: 1, publisher_platform: ['FACEBOOK'],
      snapshot: { title: 'تكوين في الحلاقة سجل الآن', body: { text: 'تكوين في الحلاقة سجل الآن. السعر 9000 دج' }, link_url: 'https://hair.dz/formation-' + id, display_format: 'IMAGE', images: [{ resized_image_url: 'https://scontent.example/' + id + '.jpg' }] } });
    const pre = await (await pg.request.post(BASE + '/api/lib/ingest', { data: { ads: [crs('9001')], ctx: { query: 'x', country: 'DZ' } } })).json();
    ok(pre.filtered === 1, 'قبل التصحيح: إعلان التكوين يُستبعد عند الاستقبال');
    const mir = await (await pg.request.post(BASE + '/api/lib/ingest', { data: { ads: [Object.assign(crs('9003'), { snapshot: { title: 'مرآة حائط كبيرة', body: { text: 'مرآة جدارية كبيرة بإطار. السعر 9000 دج' }, link_url: 'https://deco.dz/products/mirror-9003', cta_type: 'SHOP_NOW', display_format: 'IMAGE', images: [{ resized_image_url: 'https://scontent.example/9003.jpg' }] } })], ctx: { query: 'x', country: 'DZ' } } })).json();
    ok(mir.added === 1 && !mir.filtered, 'الهش لا يُستبعد عند الاستقبال');
    await pg.click('[data-fix]'); await pg.waitForFunction(() => /تم التصحيح/.test(document.querySelector('#toasts').textContent), null, { timeout: 8000 });
    await pg.waitForFunction(() => !window.WPR.PROD().some(p => p.cat === 'excl'), null, { timeout: 8000 });
    ok(true, 'بعد «سبب خاطئ» عاد المنتج');
    const fx = await (await pg.request.get(BASE + '/api/lib/fix')).json();
    ok(fx.ignore.includes('تكوين'), 'التصحيح محفوظ في الحساب: ' + fx.ignore.join('،'));
    const ing = await (await pg.request.post(BASE + '/api/lib/ingest', { data: { ads: [crs('9002')], ctx: { query: 'x', country: 'DZ' } } })).json();
    ok(ing.added === 1 && !ing.filtered, 'الاستقبال يحترم التصحيح: ' + JSON.stringify(ing).slice(0, 120));
    await pg.reload(); await pg.waitForSelector('[data-unfix="تكوين"]', { state: 'attached', timeout: 8000 });
    await pg.evaluate(() => document.querySelector('[data-unfix="تكوين"]').click());
    await pg.waitForFunction(() => /تم التراجع/.test(document.querySelector('#toasts').textContent), null, { timeout: 8000 });
    ok(!(await (await pg.request.get(BASE + '/api/lib/fix')).json()).ignore.includes('تكوين'), 'التراجع عن التصحيح من إعدادات التحليل');
    // «URI malformed»: نص فيه نصف إيموجي (من بيانات قديمة) يُفتح من الأرشيف ويُحلَّل بلا خطأ
    const half = '😀'.slice(0, 1);
    const bad = [ad('u1', { title: 'منتج رائع ' + half, body: 'يزيل البقع ' + half + ' السعر 2000 دج', start_date: day(10), link_url: 'https://u.dz/products/x' + half }),
      ad('u2', { title: 'x'.repeat(79) + '😀', body: 'جهاز يقضي على الناموس', start_date: day(12), link_url: 'https://u.dz/products/y' })];
    const run = await (await pg.request.post(BASE + '/api/runs', { data: { label: 'بيانات بإيموجي مقطوع', rows: bad } })).json();
    await pg.goto(BASE + '/archive'); await pg.waitForSelector('[data-a="open"][data-id="' + run.id + '"]');
    await pg.click('[data-a="open"][data-id="' + run.id + '"]'); await pg.waitForSelector('.pc', { timeout: 15000 }); await pg.waitForTimeout(600);
    const toasts = await pg.locator('#toasts').textContent();
    ok(!/URI malformed/.test(toasts) && (await pg.$$('.pc')).length >= 2, 'فتح نتيجة فيها نصف إيموجي من الأرشيف يعمل (بلا «URI malformed»)');
    ok(await pg.evaluate(() => { try { encodeURIComponent('a' + '😀'.slice(0, 1)); return true; } catch (e) { return false; } }), 'الترميز في الصفحة لا يسقط بنصف حرف');
    ok(!errs.length, 'لا أخطاء جافاسكربت: ' + errs.join(' | '));
    console.log('\n✅ اختبار المعايير:', pass, 'فحصاً ناجحاً');
  } catch (e) { console.error('✖', e.message, '\n', log.slice(-1500)); process.exitCode = 1; }
  finally { await b.close(); srv.kill(); }
})();
