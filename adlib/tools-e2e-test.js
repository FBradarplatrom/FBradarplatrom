'use strict';
// اختبار متصفح شامل لميزات 10.0 بإضافة محاكاة + ذكاء اصطناعي محاكى + Google Sheets محاكى:
// 🏭 المورّد (AliExpress + مطابقة الصورة) · 🧠 تحليل الإعلان · 📤 Google Sheets · 👁 مراقبة المنافسين · 🎵 TikTok
// التشغيل: node adlib/tools-e2e-test.js
const { spawn } = require('child_process'), assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), http = require('http'), crypto = require('crypto');
const { chromium } = require('playwright');
const PORT = 4900 + Math.floor(Math.random() * 80), BASE = 'http://127.0.0.1:' + PORT, DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-tools-')), IMG = path.join(DIR, 'images');
fs.mkdirSync(IMG);
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok', m); };
const cache = (u, b64) => { const k = crypto.createHash('sha256').update(u).digest('hex').slice(0, 40); fs.writeFileSync(path.join(IMG, k + '.bin'), Buffer.from(b64, 'base64')); fs.writeFileSync(path.join(IMG, k + '.type'), 'image/png'); };
const U = n => 'https://cdn.example.test/' + n + '.png';
const NOW = Math.floor(Date.now() / 1000);
(async () => {
  // خوادم محاكاة: OpenAI و Google Apps Script
  const sheetRows = [];
  const mock = http.createServer((q, s) => { let b = ''; q.on('data', d => b += d); q.on('end', () => {
    const j = JSON.parse(b || '{}'); if (process.env.DBG) console.log('MOCK', q.method, q.url, b.slice(0, 120)); s.writeHead(200, { 'content-type': 'application/json' });
    if (q.url.startsWith('/v1/chat/completions')) {
      const isQuery = /AliExpress/.test(j.messages[0].content);
      return s.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(isQuery ? { q: 'star projector night light' } : { summary: 'إعلان قوي يبيع النوم الهادئ للأطفال', product: 'مصباح ليلي بنجوم', angle: 'راحة الأم', audience: 'أمهات 25-40', pains: ['صعوبة نوم الطفل'], strengths: ['فيديو واضح'], weaknesses: ['غير مذكور السعر'], hooks: ['طفلك ما يرقدش؟'], offer: 'قطعتان بسعر خاص', algeria_fit: 'مناسب', ad_copy: { ar: 'نص عربي', dz: 'نص بالدارجة', fr: 'texte' } }) } }] }));
    }
    if (q.url.startsWith('/macros/exec')) { if (j.token !== 'سر') return s.end(JSON.stringify({ ok: false, error: 'رمز خاطئ' })); sheetRows.push(...j.rows); return s.end(JSON.stringify({ ok: true, count: j.rows.length })); }
    s.end('{}');
  }); }).listen(0);
  const MP = mock.address().port;
  const env = Object.assign({}, process.env, { PORT, JWT_SECRET: 'x'.repeat(40), ADMIN_EMAIL: 'a@t.dz', DB_FILE: path.join(DIR, 'd.db'), IMG_DIR: IMG, NODE_ENV: 'test',
    OPENAI_API_KEY: 'sk-test', OPENAI_BASE_URL: 'http://127.0.0.1:' + MP + '/v1', SHEETS_TEST_PREFIX: 'http://127.0.0.1:' + MP + '/macros/' });
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stderr.on('data', d => log += d);
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  const b = await chromium.launch();
  try {
    const pg = await b.newPage({ viewport: { width: 1300, height: 1500 } });
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(BASE + '/login');
    const imgs = await pg.evaluate(() => {
      const draw = f => { const c = document.createElement('canvas'); c.width = c.height = 600; const x = c.getContext('2d'); f(x, 600); return c.toDataURL('image/png').split(',')[1]; };
      const scene = (x, w) => { const g = x.createLinearGradient(0, 0, w, w); g.addColorStop(0, '#0b1d51'); g.addColorStop(1, '#7c3aed'); x.fillStyle = g; x.fillRect(0, 0, w, w); x.fillStyle = '#ffd34d'; for (let i = 0; i < 9; i++) { x.beginPath(); x.arc(w * (0.1 + 0.1 * i), w * (0.2 + 0.07 * (i % 4)), w * 0.03, 0, 7); x.fill(); } x.fillStyle = '#fff'; x.fillRect(w * 0.35, w * 0.55, w * 0.3, w * 0.35); };
      return { product: draw(scene), same: draw((x, w) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, w); x.save(); x.translate(w * .04, w * .04); scene(x, w * .92); x.restore(); }), other: draw((x, w) => { x.fillStyle = '#eee'; x.fillRect(0, 0, w, w); x.fillStyle = '#16a34a'; x.fillRect(60, 60, 300, 200); x.fillStyle = '#111'; x.fillRect(300, 300, 240, 260); }) };
    });
    cache(U('product'), imgs.product); cache(U('ali-same'), imgs.same); cache(U('ali-other'), imgs.other);
    // إضافة محاكاة
    await pg.addInitScript(() => {
      window.__sent = [];
      window.addEventListener('message', ev => { const d = ev.data; if (!d || d.tag !== 'WPR_PAGE') return; window.__sent.push(d);
        const rep = o => window.postMessage(Object.assign({ tag: 'WPR_BRIDGE', evt: 'reply' }, o, { id: d.id }), location.origin);
        if (d.cmd === 'ping') rep({ ok: true, version: '1.3.0', state: window.__state || { active: false } });
        else if (d.cmd === 'start') { window.__state = { active: true, id: 'j' + window.__sent.length, items: d.items.map((i, k) => ({ q: i.q, status: k ? 'pending' : 'running', seen: 0 })) }; rep({ ok: true, batch: window.__state.id }); }
        else rep({ ok: true });
      });
      window.__finish = (ads, label) => { const b = window.__state.id; window.postMessage({ tag: 'WPR_BRIDGE', evt: 'ads', seq: Date.now() % 1e6, batchId: b, label: label || '', ctx: { query: window.__state.items[0].q }, ads }, location.origin);
        setTimeout(() => { window.__state = { active: false, id: b, items: window.__state.items.map(i => Object.assign({}, i, { status: 'done', seen: ads.length })) }; window.postMessage({ tag: 'WPR_BRIDGE', evt: 'done', id: b, reason: 'done' }, location.origin); }, 1500); };
    });
    await pg.request.post(BASE + '/api/register', { data: { email: 'a@t.dz', password: 'password123' } });
    const top = { title: 'Helps your baby sleep', body: 'Star projector night light with white noise. Free shipping $29.99', link_url: 'https://shop.example/p/light', image_url: U('product'), country: 'US', page_id: '111222333', page_name: 'Dreamy Shop', library_url: 'https://www.facebook.com/ads/library/?id=1' };
    await pg.request.put(BASE + '/api/saved', { data: { k: 'p1', snap: { v: 2, name: 'Star Projector Night Light', kw: 'night light', cat: 'gem', score: 88, n: 1, copies: 2, images: [U('product')], top, recs: [{ a: top, age: 20, cat: 'gem', score: 88, ev: [] }], refIndex: 0, sellers: [{ pid: '111222333', name: 'Dreamy Shop', host: 'shop.example', copies: 2 }], market: 'US', markets: ['US'], cur: 'USD', pr: 29, prDzd: 3828, hits: [], why: [], proofs: [], also: [], tags: [] } } });
    await pg.goto(BASE + '/saved'); await pg.waitForSelector('[data-tool="sup"]');
    await pg.waitForFunction(() => window.WPRLIB && window.WPRLIB.bridge.ok());

    // ---- 🏭 المورّد
    await pg.click('[data-tool="sup"][data-k="p1"]'); await pg.waitForSelector('#sup-q');
    ok((await pg.inputValue('#sup-q')) === 'star projector night light', 'AI turns the product into an English AliExpress query');
    await pg.click('[data-tm="sup-go"]'); await pg.waitForFunction(() => window.__state && window.__state.active);
    const st = await pg.evaluate(() => window.__sent.find(x => x.cmd === 'start'));
    ok(/aliexpress\.com\/wholesale\?SearchText=star%20projector/.test(st.items[0].url) && /SortType=total_tranpro_desc/.test(st.items[0].url), 'extension searches AliExpress sorted by orders');
    await pg.evaluate(([a, b2]) => window.__finish([
      { id: '1005006123456789', title: 'Star Projector Night Light Kids', img: a, price: 'US $3.45', sold: '5,000+ sold', rating: '4.8', url: 'https://www.aliexpress.com/item/1005006123456789.html' },
      { id: '1005006999999999', title: 'Desk lamp LED', img: b2, price: 'US $1.99', sold: '200 sold', rating: '4.5', url: 'https://www.aliexpress.com/item/1005006999999999.html' }]), [U('ali-same'), U('ali-other')]);
    await pg.waitForSelector('.sp.match', { timeout: 20000 });
    const sup = await pg.textContent('.tm-b');
    ok(/أرخص مورّد مطابق بالصورة/.test(sup) && /US \$3\.45/.test(sup) && /دج/.test(sup), 'cheapest image-matching supplier is shown with its DZD price');
    ok((await pg.$$('.sp.match')).length === 1, 'only the supplier with the same photo is marked as matching');
    await pg.click('[data-tm="x"]');
    // ---- 🧠 تحليل الإعلان
    await pg.click('[data-tool="ai"][data-k="p1"]'); await pg.waitForSelector('[data-tm="ai-go"]'); await pg.click('[data-tm="ai-go"]');
    await pg.waitForSelector('.ai-copy', { timeout: 20000 });
    const ai = await pg.textContent('.tm-b');
    ok(/زاوية/.test(ai) && /أمهات 25-40/.test(ai) && /نص بالدارجة/.test(ai), 'AI analysis shows angle, audience and Algerian ad copy');
    await pg.click('[data-tm="x"]');
    // ---- 📤 Google Sheets
    await pg.click('.nv[data-v="settings"]'); await pg.waitForSelector('#g-url');
    await pg.fill('#g-url', 'http://127.0.0.1:' + MP + '/macros/exec'); await pg.fill('#g-tok', 'سر'); await pg.click('[data-a="gtest"]');
    await pg.waitForFunction(() => /وصل الصف التجريبي/.test(document.querySelector('#toasts').textContent), null, { timeout: 15000 });
    ok(sheetRows.length === 1, 'test row reaches the Google Sheet');
    await pg.click('.nv[data-v="saved"]'); await pg.waitForSelector('[data-tool="sheet"][data-src="saved"]'); await pg.click('[data-tool="sheet"][data-src="saved"]');
    await pg.waitForFunction(() => /أُرسل (1|١) صفاً إلى Google Sheets/.test(document.querySelector('#toasts').textContent), null, { timeout: 15000 });
    ok(sheetRows.length === 2 && sheetRows[1][0] === 'Star Projector Night Light' && sheetRows[1][1] === 'الولايات المتحدة', 'saved products are pushed to Google Sheets with their market');
    // ---- 👁 مراقبة المنافسين (من زر «راقب» في البائعين)
    await pg.$$eval('details.pc-more', d => d.forEach(x => { x.open = true; })); await pg.waitForSelector('[data-tool="watch"][data-pid="111222333"]');
    await pg.click('[data-tool="watch"][data-pid="111222333"]'); await pg.waitForTimeout(500);
    await pg.click('.nv[data-v="watch"]'); await pg.waitForSelector('[data-w="scan"]');
    const ad = (id, active, title) => ({ ad_archive_id: String(id), page_id: '111222333', page_name: 'Dreamy Shop', start_date: NOW - 86400 * 9, is_active: active, collation_count: 1, snapshot: { title, body: { text: title + ' free shipping' }, link_url: 'https://shop.example/p/' + id, cta_type: 'SHOP_NOW', images: [{ resized_image_url: U('product') }] } });
    await pg.click('[data-w="scan"]'); await pg.waitForFunction(() => window.__state && window.__state.active && /^page:/.test(window.__state.items[0].q));
    const ws = await pg.evaluate(() => window.__sent.filter(x => x.cmd === 'start').pop());
    ok(/view_all_page_id=111222333/.test(ws.items[0].url) && ws.items[0].q === 'page:111222333', 'monitoring opens the page in the Ad Library');
    await pg.evaluate(a => window.__finish(a), [ad(1, true, 'Night light'), ad(2, true, 'Lint roller')]);
    await pg.waitForFunction(() => /اكتمل الفحص الأول/.test(document.querySelector('#toasts').textContent), null, { timeout: 15000 });
    await pg.waitForSelector('[data-w="scan"]'); await pg.click('[data-w="scan"]'); await pg.waitForFunction(() => window.__state && window.__state.active);
    await pg.evaluate(a => window.__finish(a), [ad(1, true, 'Night light'), ad(3, true, 'Posture corrector')]);
    await pg.waitForFunction(() => /(1|١) إعلان جديد/.test(document.querySelector('#toasts').textContent), null, { timeout: 15000 });
    const wl = (await (await pg.request.get(BASE + '/api/watch')).json()).pages[0];
    ok(wl.stats.new === 1 && wl.stats.stopped === 1 && wl.stats.active === 2, 'second scan finds 1 new ad and 1 stopped ad');
    await pg.click('[data-w="open"]'); await pg.waitForSelector('#x-watch .g-m');
    ok(/Posture corrector/.test(await pg.textContent('#x-watch')) && /🆕 جديد/.test(await pg.textContent('#x-watch')), 'the new ad is highlighted on the page view');
    // ---- 🎵 TikTok
    await pg.click('.nv[data-v="tiktok"]'); await pg.waitForSelector('[data-tq]');
    ok((await pg.$$eval('[data-tq]', x => x.map(y => y.dataset.tq))).includes('tiktok made me buy it'), 'popular phrases are offered');
    await pg.click('[data-tq="tiktok made me buy it"]'); await pg.waitForTimeout(400); if (process.env.DBG) console.log('GO', await pg.evaluate(() => { const g = document.querySelector('[data-t="go"]'); return g && g.outerHTML; })); await pg.click('[data-t="go"]'); await pg.waitForTimeout(1500); if (process.env.DBG) console.log('AFTER', await pg.evaluate(() => JSON.stringify({ st: window.__state, sent: window.__sent.slice(-3).map(x => x.cmd), toasts: document.querySelector('#toasts').textContent, job: localStorage.getItem('wpr_job_v1') }))); await pg.waitForFunction(() => window.__state && window.__state.active);
    const ts = await pg.evaluate(() => window.__sent.filter(x => x.cmd === 'start').pop());
    ok(ts.items[0].url === 'https://www.tiktok.com/search?q=tiktok%20made%20me%20buy%20it', 'extension opens TikTok search for the phrase');
    const vids = [
      { id: '7300000000000000001', desc: 'This star projector changed my kids bedtime #tiktokmademebuyit #nightlight', author: 'mom', plays: 2500000, likes: 300000, comments: 2000, shares: 15000, saves: 20000, createTime: NOW - 86400 * 12, cover: U('product'), url: 'https://www.tiktok.com/@mom/video/7300000000000000001', tags: ['tiktokmademebuyit'], shop: true },
      { id: '7300000000000000002', desc: 'Best chocolate chip cookies recipe #food', author: 'chef', plays: 900000, likes: 50000, comments: 100, shares: 200, saves: 100, createTime: NOW - 86400 * 5, cover: U('ali-other'), url: 'https://www.tiktok.com/@chef/video/7300000000000000002' },
      { id: '7300000000000000003', desc: 'tiny gadget', author: 'x', plays: 1200, likes: 10, comments: 0, shares: 0, saves: 0, createTime: NOW - 86400 * 3, cover: '', url: 'https://www.tiktok.com/@x/video/7300000000000000003' }];
    await pg.evaluate(v => window.__finish(v), vids);
    await pg.waitForSelector('[data-t="savesel"]', { timeout: 15000 });
    const tt = await pg.textContent('#x-tiktok');
    ok(/star projector/i.test(tt) && !/cookies/i.test(tt) && !/tiny gadget/.test(tt), 'TikTok results keep the product and drop food and low-view videos');
    await pg.click('[data-t="save"][data-id="7300000000000000001"]'); await pg.waitForTimeout(600);
    const sv = await (await pg.request.get(BASE + '/api/saved')).json();
    ok(sv.some(x => x.k === 'tt:7300000000000000001' && /star projector/i.test(x.name)), 'a TikTok video is saved as a product (then supplier / AI / Algeria tools apply)');
    ok(!errs.length, 'no page errors ' + errs.join(' | '));
    console.log(`PASS ${pass} v10 tools browser checks`);
  } catch (e) { console.error('FAIL', e.message); try { console.error('TOASTS', await b.contexts()[0].pages()[0].textContent('#toasts')); } catch (x) {} console.error(log.slice(-1500)); process.exitCode = 1; }
  finally { await b.close(); srv.kill(); mock.close(); fs.rmSync(DIR, { recursive: true, force: true }); }
})();
