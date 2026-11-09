'use strict';
// قياس التنقل بين الأقسام بشبكة حقيقية (تأخير 150ms لكل طلب كما في استضافة بعيدة):
// لكل قسم: الزمن، عدد الطلبات إلى الخادم، وأبطأ الطلبات. التشغيل: node adlib/perf-net-test.js [عدد الإعلانات]
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require('playwright');
const PORT = 5400 + Math.floor(Math.random() * 80), BASE = 'http://127.0.0.1:' + PORT, DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-net-'));
const N = +process.argv[2] || 3000, NOW = Math.floor(Date.now() / 1000), LAT = +process.env.LAT || 150;
const raw = i => ({ ad_archive_id: String(100000 + i), page_id: 'p' + (i % 400), page_name: 'متجر ' + (i % 400), start_date: NOW - ((i % 60) + 1) * 86400, is_active: true, collation_count: 1,
  publisher_platform: ['FACEBOOK'], snapshot: { title: 'منتج رقم ' + i + ' يزيل البقع', body: { text: 'وصف طويل للمنتج '.repeat(8) + ' السعر ' + (1500 + (i % 40) * 100) + ' دج' },
    link_url: 'https://shop' + (i % 400) + '.dz/products/item-' + i, cta_type: 'SHOP_NOW', display_format: 'IMAGE', images: [{ resized_image_url: 'https://scontent.example/' + i + '.jpg' }] } });
(async () => {
  const env = Object.assign({}, process.env, { PORT, JWT_SECRET: 'x'.repeat(40), ADMIN_EMAIL: 'a@t.dz', DB_FILE: path.join(DIR, 'd.db'), NODE_ENV: 'test' });
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1300, height: 900 } }), pg = await ctx.newPage();
    // بلا اعتراض للطلبات: الاعتراض يعطّل ذاكرة المتصفح
    await pg.goto(BASE + '/login');
    await pg.request.post(BASE + '/api/register', { data: { email: 'a@t.dz', password: 'password123' } });
    for (let r = 0; r < 6; r++) for (let i = 0; i < N / 6; i += 400) await pg.request.post(BASE + '/api/lib/ingest', { data: { batch: 'b' + r, ads: Array.from({ length: Math.min(400, N / 6 - i) }, (_, k) => raw(r * 100000 + i + k)), ctx: { query: 'q' + r, country: 'DZ', label: 'دفعة ' + r } } });
    for (let i = 0; i < 40; i++) await pg.request.put(BASE + '/api/saved', { data: { k: 'k' + i, snap: { v: 2, name: 'منتج ' + i, cat: 'gem', score: 50, images: [], recs: [], top: { title: 'x' } } } });
    // شبكة بعيدة: تأخير لكل طلب
    const cdp = await ctx.newCDPSession(pg);
    await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: LAT, downloadThroughput: 4e6 / 8 * 1024, uploadThroughput: 1e6 / 8 * 1024 });
    let reqs = []; pg.on('requestfinished', async r => { if (!r.url().startsWith(BASE)) return; const t = r.timing(); let size = 0; try { size = (await r.sizes()).responseBodySize; } catch (e) {} reqs.push({ u: r.url().replace(BASE, ''), ms: Math.round(t.responseEnd), size }); });
    const rows = [];
    const step = async (label, fn) => { reqs = []; const t0 = Date.now(); await fn(); await pg.waitForLoadState('networkidle'); const ms = Date.now() - t0; const slow = reqs.slice().sort((a, b) => b.ms - a.ms).slice(0, 3).map(x => x.u.split('?')[0] + ' ' + x.ms + 'ms ' + Math.round(x.size / 1024) + 'KB');
      rows.push([label, ms, reqs.length, Math.round(reqs.reduce((s, x) => s + x.size, 0) / 1024), slow.join(' | ')]); };
    await step('فتح المنصة', async () => { await pg.goto(BASE + '/'); await pg.waitForSelector('#v-dash:not([hidden]) .kpi, #v-dash:not([hidden]) .empty'); });
    for (const [v, sel, l] of [['collect', '#l-prev, #l-body .card', 'جمع الإعلانات'], ['inbox', '#x-inbox [data-a="ianalyze"]', 'الواردة'], ['arch', '#x-arch .row, #x-arch .empty', 'الأرشيف'], ['saved', '#x-saved .pc, #x-saved .empty', 'المحفوظات'],
      ['gap', '#x-gap .g-list, #x-gap .empty, #x-gap .card', 'ثغرات السوق'], ['watch', '#x-watch .card', 'مراقبة المنافسين'], ['tiktok', '#x-tt .card, #v-tiktok .card', 'TikTok'], ['integrations', '#x-int .card', 'الربط'], ['settings', '#x-billing .meter, #x-billing h2', 'الإعدادات'], ['dash', '#v-dash:not([hidden]) .kpi', 'لوحة التحكم'], ['inbox', '#x-inbox [data-a="ianalyze"]', 'الواردة (مرة ثانية)']])
      await step(l, async () => { await pg.click(`.nv[data-v="${v}"]`); try { await pg.waitForSelector(sel, { timeout: 30000 }); } catch (e) { console.log('TIMEOUT', l, JSON.stringify((await pg.evaluate(() => [document.querySelector('.view:not([hidden])').id, document.querySelector('.view:not([hidden])').innerText.slice(0, 300), document.querySelector('#toasts').innerText])))); console.log('PENDING', reqs.length); throw e; } });
    await step('إعادة فتح المنصة (زيارة ثانية)', async () => { await pg.goto(BASE + '/'); await pg.waitForSelector('#v-dash:not([hidden]) .kpi, #v-dash:not([hidden]) .empty'); });
    reqs = []; await pg.goto(BASE + '/'); await pg.waitForLoadState('networkidle'); if (process.env.LIST) console.log('LIST', reqs.map(x => x.u.split('?')[0]).join(' '));
    console.log('تأخير الشبكة ' + LAT + 'ms لكل طلب');
    for (const [l, ms, n, kb, slow] of rows) console.log(String(ms).padStart(6) + ' ms  ' + String(n).padStart(3) + ' طلب  ' + String(kb).padStart(5) + 'KB  ' + l.padEnd(18) + '  ' + slow);
  } finally { await b.close(); srv.kill(); fs.rmSync(DIR, { recursive: true, force: true }); }
})();
