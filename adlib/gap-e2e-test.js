'use strict';
// اختبار شامل لقسم «ثغرات السوق الجزائري» في متصفح حقيقي (Playwright) مع إضافة محاكاة:
// المحفوظات ← «افحص في الجزائر» ← عبارات ← فحص ← إعلانات جزائرية تصل ← مقارنة الصورة/الرابط/الكلمات ← الحكم ← تحققك اليدوي.
// التشغيل: node adlib/gap-e2e-test.js   (يتطلب playwright و Chromium)
const { spawn } = require('child_process'), assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const { chromium } = require('playwright');
const PORT = 4400 + Math.floor(Math.random() * 90), BASE = 'http://127.0.0.1:' + PORT, DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-gap-'));
const IMG_DIR = path.join(DIR, 'images'); fs.mkdirSync(IMG_DIR);
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok', m); };
const NOW = Math.floor(Date.now() / 1000);
const U = n => 'https://cdn.example.test/' + n + '.png';
const cache = (u, buf) => { const k = crypto.createHash('sha256').update(u).digest('hex').slice(0, 40); fs.writeFileSync(path.join(IMG_DIR, k + '.bin'), buf); fs.writeFileSync(path.join(IMG_DIR, k + '.type'), 'image/png'); };
const raw = (id, o) => ({ ad_archive_id: String(id), page_id: o.page || 'p' + id, page_name: o.name || 'متجر ' + id, start_date: NOW - (o.days || 12) * 86400, is_active: o.active !== false,
  collation_count: 1, publisher_platform: ['FACEBOOK'], snapshot: { title: o.title || '', body: { text: o.body || '' }, link_url: o.link || 'https://shop' + id + '.dz/p/x', cta_type: 'SHOP_NOW', display_format: 'IMAGE', images: [{ resized_image_url: o.img }] } });

(async () => {
  const env = Object.assign({}, process.env, { PORT, JWT_SECRET: 'x'.repeat(40), ADMIN_EMAIL: 'a@t.dz', DB_FILE: path.join(DIR, 'd.db'), IMG_DIR, NODE_ENV: 'test', OPENAI_API_KEY: '' });
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  const b = await chromium.launch(); b.newPage = ((f) => o => f(Object.assign({ locale: 'ar-DZ' }, o)))(b.newPage.bind(b)); b.newContext = ((f) => o => f(Object.assign({ locale: 'ar-DZ' }, o)))(b.newContext.bind(b));   /* اللوحة بالعربية (لغة المتصفح الافتراضية) */
  try {
    const pg = await b.newPage({ viewport: { width: 1280, height: 1600 } });
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    // ---- صور الاختبار: صورة المنتج، نفس الصورة مصغّرة بإطار وشعار (إعلان جزائري)، وصورة مختلفة
    await pg.goto(BASE + '/login');
    const imgs = await pg.evaluate(() => {
      const draw = (w, h, f) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); f(x, w, h); return c.toDataURL('image/png').split(',')[1]; };
      const scene = (x, w, h) => { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#0b1d51'); g.addColorStop(1, '#7c3aed'); x.fillStyle = g; x.fillRect(0, 0, w, h);
        x.fillStyle = '#ffd34d'; for (let i = 0; i < 9; i++) { x.beginPath(); x.arc(w * (0.1 + 0.1 * i), h * (0.2 + 0.07 * (i % 4)), w * 0.03, 0, 7); x.fill(); }
        x.fillStyle = '#fff'; x.fillRect(w * 0.35, h * 0.55, w * 0.3, h * 0.35); };
      return {
        product: draw(800, 800, scene),
        dzCopy: draw(600, 600, (x, w, h) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.save(); x.translate(w * 0.04, h * 0.04); scene(x, w * 0.92, h * 0.92); x.restore(); x.fillStyle = '#e11d48'; x.fillRect(w * 0.78, h * 0.86, w * 0.18, h * 0.08); }),
        other: draw(600, 600, (x, w, h) => { x.fillStyle = '#f5f5f4'; x.fillRect(0, 0, w, h); x.fillStyle = '#16a34a'; x.fillRect(w * 0.1, h * 0.1, w * 0.5, h * 0.3); x.fillStyle = '#111'; x.fillRect(w * 0.5, h * 0.5, w * 0.4, h * 0.45); })
      };
    });
    cache(U('product'), Buffer.from(imgs.product, 'base64')); cache(U('dz-copy'), Buffer.from(imgs.dzCopy, 'base64')); cache(U('other'), Buffer.from(imgs.other, 'base64'));

    // ---- إضافة محاكاة (relay): ترد على الأوامر، والاختبار يرسل الإعلانات والحالة
    await pg.addInitScript(() => {
      window.__sent = [];
      window.addEventListener('message', ev => { const d = ev.data; if (!d || d.tag !== 'WPR_PAGE') return; window.__sent.push(d);
        const rep = o => window.postMessage(Object.assign({ tag: 'WPR_BRIDGE', evt: 'reply' }, o, { id: d.id }), location.origin);
        if (d.cmd === 'ping') rep({ ok: true, version: '1.1.1', state: window.__state || { active: false } });
        else if (d.cmd === 'start') { window.__state = { active: true, id: 'gb' + window.__sent.length, items: d.items.map((i, k) => ({ q: i.q, status: k ? 'pending' : 'running', seen: 0 })) };
          rep({ ok: true, batch: window.__state.id }); setTimeout(() => window.postMessage({ tag: 'WPR_BRIDGE', evt: 'state', state: window.__state }, location.origin), 50); }
        else rep({ ok: true });
      });
    });
    const r0 = await pg.request.post(BASE + '/api/register', { data: { email: 'a@t.dz', password: 'password123' } }); ok(r0.ok(), 'register');
    // منتج رابح في أمريكا محفوظ في «المحفوظات»
    const snap = (name, img, link) => ({ v: 2, name, kw: 'night light', cat: 'gem', score: 88, n: 2, images: [U(img)], top: { title: name, body: 'Helps your baby sleep with stars and white noise', link_url: link, image_url: U(img), country: 'US', library_url: 'https://www.facebook.com/ads/library/?id=1' }, recs: [], tags: [], lib: '', saved_at: Date.now() });
    await pg.request.put(BASE + '/api/saved', { data: { k: 'star-light', snap: snap('Star Projector Night Light', 'product', 'https://www.aliexpress.com/item/1005006123456789.html') } });
    await pg.request.put(BASE + '/api/saved', { data: { k: 'other-thing', snap: snap('Magnetic Cable Organizer', 'cable-not-cached', 'https://www.temu.com/x-g-601099500000001.html') } });

    // ---- أدوات التجسس حُذفت
    await pg.goto(BASE + '/saved'); await pg.waitForSelector('[data-a="togap"]');
    ok(!(await pg.$('[data-v="plug"]')) && (await pg.textContent('[data-v="gap"]')).includes('ثغرات السوق'), 'spy tools removed, new section in the menu');
    ok((await pg.request.get(BASE + '/spy', { maxRedirects: 0 })).status() === 301, '/spy redirects to /gaps');
    // ---- من المحفوظات إلى القسم
    await pg.click('.pc:has-text("Star Projector") [data-a="togap"], [data-a="togap"][data-id="star-light"]');
    await pg.waitForURL(/\/gaps\/\d+$/); await pg.waitForSelector('[data-gt="0"]');
    ok(true, 'saved product opens in the gap section');
    ok((await pg.textContent('#x-gap')).includes('الذكاء الاصطناعي غير مفعّل'), 'without OPENAI_API_KEY the user writes the terms');
    await pg.fill('[data-gt="0"]', 'مصباح ليلي نجوم'); await pg.selectOption('[data-glang="0"]', 'ar');
    await pg.fill('[data-gt="1"]', 'veilleuse étoiles'); await pg.selectOption('[data-glang="1"]', 'fr');
    await pg.fill('[data-gt="2"]', 'بروجكتور ليلي'); await pg.selectOption('[data-glang="2"]', 'dz');
    await pg.fill('[data-g="kw"]', 'نجوم، بروجكتور، ضوضاء بيضاء، veilleuse، projecteur');
    await pg.waitForFunction(() => document.querySelector('[data-v="collect"]') && window.WPRLIB && window.WPRLIB.bridge.ok());
    await pg.click('[data-g="scan"]');
    await pg.waitForSelector('#g-live h2');
    const start = await pg.evaluate(() => window.__sent.find(x => x.cmd === 'start'));
    ok(start && start.items.length === 3 && start.items.every(i => /country=DZ/.test(i.url) && /active_status=all/.test(i.url)), 'extension searches the Algerian library (active + stopped) with the 3 terms');
    ok(start.label.startsWith('🎯 ثغرة #'), 'scan is labelled as a gap scan');
    // ---- الإعلانات الجزائرية تصل
    const batch = await pg.evaluate(() => window.__state.id);
    const ads = [
      raw(901, { name: 'Dz Kids Store', title: 'مصباح ليلي للأطفال', body: 'ضوء هادئ لغرفة طفلك. التوصيل 58 ولاية. 3900 دج', img: U('dz-copy') }),                  // نفس الصورة (مصغّرة + إطار + شعار)
      raw(902, { name: 'Bebe Shop', title: 'veilleuse', body: 'Livraison 58 wilayas', img: U('other'), link: 'https://www.aliexpress.com/item/1005006123456789.html?spm=a2g0o' }),  // نفس رابط المورّد
      raw(903, { name: 'Random', title: 'مصباح ليلي', body: 'بروجكتور نجوم مع ضوضاء بيضاء لنوم هادئ', img: U('other'), active: false }),                                // كلمات فقط → محتمل
      raw(904, { name: 'Lamps DZ', title: 'مصباح ليلي', body: 'مصباح مكتب LED قابل للشحن', img: U('other') })                                                                  // غير مطابق
    ];
    await pg.evaluate(([b, ads]) => window.postMessage({ tag: 'WPR_BRIDGE', evt: 'ads', seq: 1, batchId: b, label: '🎯 ثغرة', ctx: { query: 'مصباح ليلي نجوم', country: 'DZ' }, ads }, location.origin), [batch, ads]);
    await pg.waitForFunction(() => window.__sent.some(x => x.cmd === 'ack' && x.seqs[0] === 1), null, { timeout: 30000 });
    ok(true, 'ads acknowledged after comparison');
    const live = await pg.textContent('#g-live');
    ok(/4\s*إعلان فُحص/.test(live.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))), 'live counter shows 4 scanned ads');
    const inbox = await (await pg.request.get(BASE + '/api/runs')).json();
    ok(!inbox.length, 'gap scan ads do not go to the inbox');
    // ---- انتهاء الفحص
    await pg.evaluate(b => { window.__state = { active: false, id: b, items: window.__state.items.map(i => Object.assign({}, i, { status: 'done', seen: 4 })) };
      window.postMessage({ tag: 'WPR_BRIDGE', evt: 'state', state: window.__state }, location.origin); window.postMessage({ tag: 'WPR_BRIDGE', evt: 'done', id: b, reason: 'done' }, location.origin); }, batch);
    await pg.waitForFunction(() => !document.querySelector('#g-live h2') && /إعلانات مطابقة في/.test(document.querySelector('#x-gap').textContent), null, { timeout: 15000 });
    const id = +pg.url().split('/').pop();
    let p = await (await pg.request.get(BASE + '/api/gap/' + id)).json();
    const byAd = Object.fromEntries(p.matches.map(m => [m.ad_id, m]));
    console.log(p.matches.map(m => m.ad_id + ' ' + m.level + ' ' + m.ev.why).join('\n'));
    ok(byAd['901'] && byAd['901'].level === 'strong' && byAd['901'].ev.image >= 80, 'same supplier photo (resized, framed, logo) → strong image match');
    ok(byAd['902'] && byAd['902'].level === 'strong' && /ali:/.test(byAd['902'].ev.supplier), 'same AliExpress item → strong supplier match');
    ok(byAd['903'] && byAd['903'].level === 'possible', 'distinctive words only → possible (needs your check)');
    ok(byAd['904'] && byAd['904'].level === 'similar' && /من بحث/.test(byAd['904'].ev.why), 'a different lamp is not matched (kept only as a similar search result)');
    ok(p.verdict === 'weak' && p.stats.activeSellers === 2 && p.stats.scanned === 4, 'verdict: weak competition (2 active sellers)');
    // ---- تحققك اليدوي يغيّر الحكم
    await pg.click(`[data-g="no"][data-m="${byAd['901'].id}"]`); await pg.waitForTimeout(400);
    await pg.click(`[data-g="no"][data-m="${byAd['902'].id}"]`); await pg.waitForTimeout(400);
    p = await (await pg.request.get(BASE + '/api/gap/' + id)).json();
    ok(p.verdict === 'check', 'after rejecting both, the remaining possible match asks for your check');
    await pg.click(`[data-g="yes"][data-m="${byAd['903'].id}"]`); await pg.waitForTimeout(400);
    p = await (await pg.request.get(BASE + '/api/gap/' + id)).json();
    ok(p.verdict === 'tried', 'confirmed match is a stopped ad → "tried and stopped"');
    await pg.screenshot({ path: path.join(process.env.SHOT_DIR || DIR, 'gap-product.png'), fullPage: true });
    // ---- منتج ثانٍ: لا شيء في الجزائر → ثغرة مؤكدة
    const j2 = await (await pg.request.post(BASE + '/api/gap', { data: { k: 'other-thing' } })).json();
    await pg.request.put(BASE + '/api/gap/' + j2.id, { data: { terms: [{ q: 'منظم كوابل مغناطيسي', lang: 'ar' }, { q: 'organisateur câble magnétique', lang: 'fr' }] } });
    await pg.goto(BASE + '/gaps/' + j2.id); await pg.waitForSelector('[data-g="scan"]');
    await pg.click('[data-g="scan"]'); await pg.waitForSelector('#g-live h2');
    const b2 = await pg.evaluate(() => window.__state.id);
    await pg.evaluate(([b, ads]) => window.postMessage({ tag: 'WPR_BRIDGE', evt: 'ads', seq: 2, batchId: b, ctx: { query: 'منظم كوابل' }, ads }, location.origin), [b2, [ads[3]]]);
    await pg.waitForFunction(() => window.__sent.some(x => x.cmd === 'ack' && x.seqs[0] === 2), null, { timeout: 20000 });
    await pg.evaluate(b => { window.__state = { active: false, id: b, items: window.__state.items.map(i => Object.assign({}, i, { status: 'done', seen: 1 })) };
      window.postMessage({ tag: 'WPR_BRIDGE', evt: 'done', id: b }, location.origin); }, b2);
    await pg.waitForFunction(() => !document.querySelector('#g-live h2'), null, { timeout: 15000 });
    p = await (await pg.request.get(BASE + '/api/gap/' + j2.id)).json();
    await pg.waitForSelector('text=إعلانات مشابهة من نتائج البحث');
    ok(p.matches.length === 1 && p.matches[0].level === 'similar' && (await pg.textContent('#x-gap')).includes('Lamps DZ'), 'no match → the search results are shown as similar ads');
    await pg.screenshot({ path: path.join(process.env.SHOT_DIR || DIR, 'gap-similar.png'), fullPage: true });
    ok(p.verdict === 'gap' && p.watch && p.next_check_at > Date.now() + 6 * 864e5, 'nothing found with 2 completed searches → confirmed gap, re-check scheduled in 7 days');
    await pg.click(`[data-g="yes"][data-m="${p.matches[0].id}"]`); await pg.waitForTimeout(500);
    p = await (await pg.request.get(BASE + '/api/gap/' + j2.id)).json();
    ok(p.verdict === 'weak' && p.stats.matches === 1, 'a similar ad you confirm as the same product counts as a competitor');
    // ---- القائمة
    await pg.goto(BASE + '/gaps'); await pg.waitForSelector('.g-card');
    const lt = await pg.textContent('#x-gap');
    ok(/منافسة ضعيفة/.test(lt) && /جُرّب وتوقف/.test(lt), 'list shows both verdicts');
    await pg.waitForTimeout(700);
    ok(await pg.evaluate(() => document.querySelector('.nv.on').dataset.v === 'gap'), 'menu highlights the gap section');
    await pg.screenshot({ path: path.join(process.env.SHOT_DIR || DIR, 'gap-list.png'), fullPage: true });
    ok(!errs.length, 'no page errors ' + errs.join(' | '));
    console.log(`PASS ${pass} gap-section browser checks`);
  } catch (e) { console.error('FAIL', e.message); console.error(log.slice(-1200)); process.exitCode = 1; }
  finally { await b.close(); srv.kill(); if (!process.env.SHOT_DIR) fs.rmSync(DIR, { recursive: true, force: true }); }
})();
