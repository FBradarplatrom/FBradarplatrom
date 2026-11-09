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
    ok(tabs.slice(1, 7).join(',') === 'trial,prom,gem,fire,old,low' && !tabs.includes('ended'), 'التبويبات: تحت التجربة ← واعد ← جوهرة ← رابح ← قديم ← ضعيف (بلا «توقف بعد نجاح»): ' + tabs.join(','));
    const P = await pg.evaluate(() => window.WPR.PROD().map(p => ({ cat: p.cat, name: p.name, ben: p.ben, warn: p.warn || '' })));
    const names = P.map(p => p.cat + ':' + p.name);
    ok(P[0].cat === 'trial' && P[1].cat === 'prom', 'الترتيب يبدأ بتحت التجربة ثم واعد: ' + JSON.stringify(names));
    const gems = P.filter(p => p.cat === 'gem');
    ok(gems.map(p => p.ben).join(',') === [...gems.map(p => p.ben)].sort((a, b) => b - a).join(',') && gems[gems.length - 1].ben === 0, 'داخل «جوهرة»: الفائدة في العنوان ← في النص ← بلا فائدة: ' + gems.map(p => p.name + '(' + p.ben + ')').join(' · '));
    ok(gems.some(p => /منظف/.test(p.name) && p.ben === 1), 'الفائدة في باقي النص = ☑️ «فائدة في النص»');
    ok(gems.some(p => /ساعة/.test(p.name)) , 'منتج بلا فائدة يبقى في تصنيف مدته (لا يختفي)');
    ok(gems.some(p => /قشابية/.test(p.name)), 'القشابية لا تُقصى بسبب «المرأة»');
    ok(gems.some(p => /مرآة/.test(p.name) && /قد يكون هش/.test(p.warn)), 'مرآة الحائط: تنبيه «قد يكون هشاً» بدل الإقصاء');
    ok(P.some(p => p.cat === 'excl' && /الشعر/.test(p.name)), 'منتج كل إعلاناته متوقفة: مستبعد');
    if (process.env.SHOT) await pg.locator('#grid').screenshot({ path: process.env.SHOT + '/grid.png' });
    ok(!(await pg.$('.pc .bn')) && !(await pg.$('.pc .ring')), 'لا وسم «فائدة/بلا فائدة» ولا دائرة نقاط: الفائدة للترتيب فقط');
    // زر «سبب خاطئ» على إعلان تكوين
    await pg.click('#tabs [data-t="excl"]'); await pg.waitForSelector('[data-fix]');
    const why = await pg.locator('.pc:has([data-fix]) .tg.bad').first().textContent();
    ok(/«تكوين»/.test(why), 'سبب الإقصاء يُظهر الكلمة في جملتها: ' + why.slice(0, 120));
    const crs = id => ({ ad_archive_id: id, page_id: '5' + id, page_name: 'Hair Pro', start_date: Math.floor(NOW / 1000) - 864000, is_active: true, collation_count: 1, publisher_platform: ['FACEBOOK'],
      snapshot: { title: 'تكوين في الحلاقة سجل الآن', body: { text: 'تكوين في الحلاقة سجل الآن. السعر 9000 دج' }, link_url: 'https://hair.dz/formation-' + id, display_format: 'IMAGE', images: [{ resized_image_url: 'https://scontent.example/' + id + '.jpg' }] } });
    const pre = await (await pg.request.post(BASE + '/api/lib/ingest', { data: { ads: [crs('9001')], ctx: { query: 'x', country: 'DZ' } } })).json();
    ok(pre.filtered === 1, 'قبل التصحيح: إعلان التكوين يُستبعد عند الاستقبال');
    const mir = await (await pg.request.post(BASE + '/api/lib/ingest', { data: { ads: [Object.assign(crs('9003'), { snapshot: { title: 'مرآة حائط كبيرة', body: { text: 'مرآة جدارية كبيرة بإطار. السعر 9000 دج' }, link_url: 'https://deco.dz/products/mirror-9003', cta_type: 'SHOP_NOW', display_format: 'IMAGE', images: [{ resized_image_url: 'https://scontent.example/9003.jpg' }] } })], ctx: { query: 'x', country: 'DZ' } } })).json();
    ok(mir.added === 1 && !mir.filtered, 'الهش لا يُستبعد عند الاستقبال');
    await pg.click('[data-fix]'); await pg.waitForFunction(() => /تم التصحيح/.test(document.querySelector('#toasts').textContent), null, { timeout: 8000 });
    await pg.waitForFunction(() => !window.WPR.PROD().some(p => p.cat === 'excl' && /تكوين/.test(p.name)), null, { timeout: 8000 });
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
    // ===== أرقام صفحة التحليل: المرصود/المجلوب/المحلَّل/المستبعد/المنتجات/البائعون =====
    // 1) الإضافة تقرأ «~220 نتيجة» من رد مكتبة ميتا نفسه
    await pg.goto(BASE + '/login');
    await pg.route('**/api/graphql/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { ad_library_main: { search_results_connection: { count: 220, edges: [{ node: { collated_results: [{ ad_archive_id: '1', snapshot: {} }] } }] } } } }) }));
    await pg.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '..', 'extensions', 'ad-collector', 'inject.js'), 'utf8') });
    const tot = await pg.evaluate(() => new Promise(ok => { addEventListener('message', e => { if (e.data && e.data.tag === 'WPR_AD_MAIN') ok(e.data.total); }); fetch('/api/graphql/x'); setTimeout(() => ok(-1), 4000); }));
    ok(tot === 220, 'الإضافة تقرأ عدد النتائج من رد مكتبة ميتا (220)');
    // 2) الوصول إلى المنصة مع العدد، وإعلان مكرر، وإعلان «تكوين» يُستبعد عند الاستقبال
    const rawAd = (id, page, title, o) => Object.assign({ ad_archive_id: id, page_id: page, page_name: 'صفحة ' + page, start_date: Math.floor(NOW / 1000) - 12 * 86400, is_active: true, collation_count: 1, publisher_platform: ['FACEBOOK'],
      snapshot: { title, body: { text: title + '. السعر 6500 دج التوصيل لكل الولايات' }, link_url: 'https://s' + page + '.dz/products/item-' + id, cta_type: 'SHOP_NOW', display_format: 'IMAGE', images: [{ resized_image_url: 'https://scontent.example/k' + id + '.jpg' }] } }, o || {});
    const fx0 = await (await pg.request.get(BASE + '/api/lib/fix')).json(); await pg.request.post(BASE + '/api/lib/fix', { data: { unignore: fx0.ignore } });   // بلا تصحيحات سابقة
    const ctx = { query: 'قشابية', country: 'DZ', label: 'قشابية', total: 220 };
    const c1 = [rawAd('7001', '901', 'قشابية رجالية دافئة'), rawAd('7002', '901', 'قشابية رجالية دافئة', { collation_count: 3, collation_id: 'K1', snapshot: { title: 'قشابية رجالية دافئة', body: { text: 'قشابية رجالية دافئة. السعر 6500 دج التوصيل لكل الولايات' }, link_url: 'https://s901.dz/products/item-7001', cta_type: 'SHOP_NOW', display_format: 'IMAGE', images: [{ resized_image_url: 'https://scontent.example/k7002.jpg' }] } }), rawAd('7003', '902', 'قشابية نسائية'), rawAd('7009', '909', 'تكوين في الحلاقة سجل الآن', { snapshot: { title: 'تكوين في الحلاقة سجل الآن', body: { text: 'تكوين في الحلاقة سجل الآن. السعر 9000 دج' }, link_url: 'https://hair.dz/formation', cta_type: 'SIGN_UP', display_format: 'IMAGE', images: [{ resized_image_url: 'https://scontent.example/k7009.jpg' }] } })];
    const c2 = [rawAd('7003', '902', 'قشابية نسائية'), rawAd('7004', '903', 'برنوس تقليدي', { snapshot: { title: 'برنوس تقليدي', body: { text: 'برنوس تقليدي. السعر 9000 دج' }, link_url: 'https://s903.dz/products/burnous', cta_type: 'SHOP_NOW', display_format: 'IMAGE', images: [{ resized_image_url: 'https://scontent.example/burnous-traditional-white.jpg' }] } }), rawAd('7005', '904', 'برنوس تقليدي', { snapshot: { title: 'برنوس تقليدي', body: { text: 'برنوس تقليدي. السعر 9000 دج' }, link_url: 'https://s904.dz/products/burnous', cta_type: 'SHOP_NOW', display_format: 'IMAGE', images: [{ resized_image_url: 'https://scontent.example/burnous-traditional-white.jpg' }] } })];
    await pg.request.post(BASE + '/api/lib/ingest', { data: { batch: 'QB', ads: c1, ctx } });
    await pg.request.post(BASE + '/api/lib/ingest', { data: { batch: 'QB', ads: c2, ctx: Object.assign({}, ctx, { total: 214 }) } });
    const runs = await (await pg.request.get(BASE + '/api/runs')).json(), qr = runs.find(r => /قشابية/.test(r.label));
    const det = await (await pg.request.get(BASE + '/api/runs/' + qr.id)).json();
    ok(det.stats && det.stats.observed === 220 && det.stats.filtered === 1 && det.rows.length === 5, 'الخادم يحفظ المرصود (أكبر عدد للبحث) والمستبعد عند الاستقبال: ' + JSON.stringify(det.stats));
    // 3) صفحة التحليل
    await pg.goto(BASE + '/archive'); await pg.waitForSelector('[data-a="open"][data-id="' + qr.id + '"]');
    await pg.click('[data-a="open"][data-id="' + qr.id + '"]'); await pg.waitForSelector('#sum .kpi', { timeout: 15000 }); await pg.waitForTimeout(500);
    if (process.env.DBG) console.log(JSON.stringify(await pg.evaluate(() => window.WPR.PROD().map(p => [p.k, p.cat, p.ads.length, p.counted.length, p.ads.map(a => a.ad_id + ':' + a.stat)]))));
    if (process.env.SHOT) { await pg.locator('#sum').screenshot({ path: process.env.SHOT + '/sum.png' }); await pg.locator('.pc').first().screenshot({ path: process.env.SHOT + '/card2.png' }); }
    const K = Object.fromEntries(await pg.$$eval('#sum .kpi', ks => ks.map(k => [k.querySelector('span').textContent, k.querySelector('b').textContent])));
    const num = t => +String(t).replace(/[^\d٠-٩]/g, '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
    ok(Object.keys(K).join('|') === 'الإعلانات المرصودة|الإعلانات التي تم جلبها|دخلت التحليل|الإعلانات المستبعدة|عدد البائعين', 'خمسة أرقام دقيقة فقط (بلا عدد المنتجات): ' + Object.keys(K).join('|'));
    ok(num(K['الإعلانات المرصودة']) === 220 && num(K['الإعلانات التي تم جلبها']) === 6 && num(K['دخلت التحليل']) === 5 && num(K['الإعلانات المستبعدة']) === 1, 'المرصود 220 · المجلوب 6 (بلا تكرار) · التحليل 5 · المستبعد 1: ' + JSON.stringify(K));
    ok(num(K['دخلت التحليل']) + num(K['الإعلانات المستبعدة']) === num(K['الإعلانات التي تم جلبها']), 'المجلوب = دخلت التحليل + المستبعدة');
    ok(num(K['عدد البائعين']) === 4, 'البائعون = أسماء صفحات مختلفة (4)');
    const tabN = await pg.$$eval('#tabs button', bs => Object.fromEntries(bs.map(b => [b.dataset.t, +b.querySelector('b').textContent])));
    ok(tabN.all === num(K['الإعلانات التي تم جلبها']) && ['trial', 'prom', 'gem', 'fire', 'old', 'low', 'excl'].reduce((x, k) => x + (tabN[k] || 0), 0) === tabN.all && tabN.excl === 1, '«الكل» = المجلوب = مجموع التبويبات، و«مستبعد» = 1: ' + JSON.stringify(tabN));
    ok(await pg.$eval('#tabs [data-t="excl"]', b => /مستبعد/.test(b.textContent)), 'تبويب «🚫 مستبعد» موجود');
    await pg.click('#tabs [data-t="excl"]'); await pg.waitForTimeout(300);
    ok(/استُبعد عند الاستقبال/.test(await pg.locator('#grid').textContent()), 'المستبعد عند الاستقبال يظهر في «مستبعد» بسببه');
    await pg.click('#tabs [data-t="all"]'); await pg.waitForTimeout(300);
    const st = await pg.$$eval('.pc .pc-st', b => b.map(x => x.textContent));
    ok(st.length && st.every(t => !/نسخ|بائعين|نشطة/.test(t)) && !(await pg.$('.pc .bn')), 'البطاقة بلا «نسخ» ولا «بائعين» ولا وسم فائدة');
    // قراءة «~220 نتيجة» من نص الصفحة: علامات اتجاه مخفية، أرقام عربية، فواصل
    const src = fs.readFileSync(path.join(__dirname, '..', 'extensions', 'ad-collector', 'collector.js'), 'utf8');
    const TOT_RE = eval(/const TOT_RE = (\/.*\/i);/.exec(src)[1]), BIDI = eval(/const BIDI = (\/.*\/g);/.exec(src)[1]);
    const rd = t => { const m = TOT_RE.exec(' ' + t.replace(BIDI, '').trim().replace(/[٠-٩]/g, x => String('٠١٢٣٤٥٦٧٨٩'.indexOf(x)))); return m ? parseInt(m[1].replace(/[^\d]/g, ''), 10) : 0; };
    ok(rd('\u200f~220 نتيجة') === 220 && rd('~٢٢٠ نتيجة') === 220 && rd('~1,250 results') === 1250 && rd('environ 3 400 résultats') === 3400 && rd('‏~1٬250 نتيجة') === 1250 && rd('4 نتائج') === 4 && rd('السعر 2900 دج') === 0, 'قراءة عدد النتائج من نص الصفحة بكل الصيغ');
    ok(!errs.length, 'لا أخطاء جافاسكربت: ' + errs.join(' | '));
    console.log('\n✅ اختبار المعايير:', pass, 'فحصاً ناجحاً');
  } catch (e) { console.error('✖', e.message, '\n', log.slice(-1500)); process.exitCode = 1; }
  finally { await b.close(); srv.kill(); }
})();
