'use strict';
// قياس سلاسة الواجهة في متصفح حقيقي: تحميل المنصة، التنقل بين الأقسام، فتح دفعة 5000 إعلان للتحليل، المحفوظات.
// التشغيل: node adlib/perf-ui-test.js
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require('playwright');
const PORT = 4800 + Math.floor(Math.random() * 90), BASE = 'http://127.0.0.1:' + PORT, DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-pui-'));
const N = +process.argv[2] || 5000, NOW = Math.floor(Date.now() / 1000);
const WORDS = 'مصباح ليلي يساعد طفلك على النوم حزام لتعديل القوام منظم مطبخ لاصق مقاوم للماء فرشاة تنظيف شاحن سيارة سماعات لاسلكية حقيبة ظهر مضادة للسرقة'.split(' ');
const pick = (i, n) => Array.from({ length: n }, (_, k) => WORDS[(i * 7 + k * 3) % WORDS.length]).join(' ');
const raw = i => ({ ad_archive_id: String(100000 + i), page_id: 'p' + (i % 900), page_name: 'متجر ' + (i % 900), start_date: NOW - ((i % 60) + 1) * 86400, is_active: i % 5 !== 0, collation_count: 1 + (i % 4),
  publisher_platform: ['FACEBOOK'], snapshot: { title: pick(i, 4), body: { text: pick(i + 3, 18) + ' التوصيل 58 ولاية والدفع عند الاستلام. السعر ' + (1500 + (i % 40) * 100) + ' دج' },
    link_url: 'https://shop' + (i % 900) + '.dz/products/item-' + (i % 1700), cta_type: 'SHOP_NOW', display_format: 'IMAGE', images: [{ resized_image_url: 'https://scontent.example/' + (i % 2100) + '.jpg' }] } });
(async () => {
  const env = Object.assign({}, process.env, { PORT, JWT_SECRET: 'x'.repeat(40), ADMIN_EMAIL: 'a@t.dz', DB_FILE: path.join(DIR, 'd.db'), NODE_ENV: 'test' });
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  const b = await chromium.launch(); b.newPage = ((f) => o => f(Object.assign({ locale: 'ar-DZ' }, o)))(b.newPage.bind(b)); b.newContext = ((f) => o => f(Object.assign({ locale: 'ar-DZ' }, o)))(b.newContext.bind(b));   /* اللوحة بالعربية (لغة المتصفح الافتراضية) */
  const out = [];
  try {
    const pg = await b.newPage({ viewport: { width: 1300, height: 900 } });
    await pg.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());     // بلا إنترنت: نقيس المنصة وحدها
    await pg.goto(BASE + '/login');
    await pg.request.post(BASE + '/api/register', { data: { email: 'a@t.dz', password: 'password123' } });
    for (let i = 0; i < N; i += 60) await pg.request.post(BASE + '/api/lib/ingest', { data: { batch: 'b1', ads: Array.from({ length: Math.min(60, N - i) }, (_, k) => raw(i + k)), ctx: { query: 'q', country: 'DZ', label: 'perf' } } });
    let t = Date.now(); await pg.goto(BASE + '/'); await pg.waitForSelector('#v-dash:not([hidden]) .kpi, #v-dash:not([hidden]) .empty', { timeout: 30000 }); out.push(['تحميل المنصة (لوحة التحكم)', Date.now() - t]);
    const nav = async (v, sel, label) => { const t0 = Date.now(); await pg.click(`.nv[data-v="${v}"]`); await pg.waitForSelector(sel, { timeout: 60000 }); out.push([label, Date.now() - t0]); };
    await nav('collect', '#l-prev, #l-body .card', 'الانتقال إلى «جمع الإعلانات»');
    await nav('inbox', '#x-inbox [data-a="ianalyze"]', 'الانتقال إلى «الواردة»');
    await nav('arch', '#x-arch .row', 'الانتقال إلى «الأرشيف»');
    await nav('saved', '#x-saved .empty, #x-saved .pc', 'الانتقال إلى «المحفوظات»');
    await nav('gap', '#x-gap .g-list, #x-gap .empty', 'الانتقال إلى «ثغرات السوق»');
    await nav('collect', '#l-prev', 'العودة إلى «جمع الإعلانات»');
    await nav('inbox', '#x-inbox [data-a="ianalyze"]', 'العودة إلى «الواردة»');
    await pg.evaluate(() => { window.__lag = 0; let last = performance.now(); window.__lagT = setInterval(() => { const n = performance.now(); window.__lag = Math.max(window.__lag, n - last - 50); last = n; }, 50); });
    t = Date.now(); await pg.click('#x-inbox [data-a="ianalyze"]'); await pg.waitForSelector('#grid .pc', { timeout: 120000 }); out.push([`فتح دفعة ${N} إعلان للتحليل حتى ظهور النتائج`, Date.now() - t]);
    out.push(['أطول تجمّد للواجهة أثناء التحليل', Math.round(await pg.evaluate(() => { clearInterval(window.__lagT); return window.__lag; }))]);
    // استجابة الصفحة بعد ظهور النتائج: أطول توقف للواجهة
    const lag = await pg.evaluate(() => new Promise(res => { let worst = 0, last = performance.now(); const id = setInterval(() => { const n = performance.now(); worst = Math.max(worst, n - last - 50); last = n; }, 50); setTimeout(() => { clearInterval(id); res(Math.round(worst)); }, 2500); }));
    out.push(['أطول تجمّد للواجهة بعد ظهور النتائج', lag]);
    t = Date.now(); await pg.click('#tabs [data-t="all"]'); await pg.waitForTimeout(50); out.push(['تبديل تبويب النتائج', Date.now() - t]);
    for (let i = 0; i < 3; i++) { const s = await pg.$$('#grid .save'); if (s[i]) await s[i].click(); }
    await pg.waitForTimeout(800);
    await nav('saved', '#x-saved .pc', 'المحفوظات (3 منتجات)');
    const dom = await pg.evaluate(() => document.getElementsByTagName('*').length); out.push(['عدد عناصر الصفحة (DOM)', dom]);
    for (const [k, v] of out) console.log(String(v).padStart(7) + (/عدد/.test(k) ? '   ' : ' ms') + '  ' + k);
  } finally { await b.close(); srv.kill(); fs.rmSync(DIR, { recursive: true, force: true }); }
})();
