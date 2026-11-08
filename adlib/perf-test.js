'use strict';
// قياس الأداء: استقبال 5000 إعلان على دفعات (كما ترسلها الإضافة)، فتح الأقسام، وزمن التحليل.
// التشغيل: node adlib/perf-test.js [عدد الإعلانات]
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const N = +process.argv[2] || 5000;
const PORT = 4700 + Math.floor(Math.random() * 90), BASE = 'http://127.0.0.1:' + PORT, DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-perf-'));
const NOW = Math.floor(Date.now() / 1000);
const WORDS = 'مصباح ليلي يساعد طفلك على النوم حزام لتعديل القوام منظم مطبخ لاصق مقاوم للماء فرشاة تنظيف شاحن سيارة سماعات لاسلكية حقيبة ظهر مضادة للسرقة'.split(' ');
const pick = (i, n) => Array.from({ length: n }, (_, k) => WORDS[(i * 7 + k * 3) % WORDS.length]).join(' ');
const raw = i => ({ ad_archive_id: String(100000 + i), page_id: 'p' + (i % 900), page_name: 'متجر ' + (i % 900), start_date: NOW - ((i % 60) + 1) * 86400, is_active: i % 5 !== 0, collation_count: 1 + (i % 4),
  publisher_platform: ['FACEBOOK'], snapshot: { title: pick(i, 4), body: { text: pick(i + 3, 18) + ' التوصيل 58 ولاية والدفع عند الاستلام. السعر ' + (1500 + (i % 40) * 100) + ' دج' },
    link_url: 'https://shop' + (i % 900) + '.dz/products/item-' + (i % 1700), cta_type: 'SHOP_NOW', display_format: 'IMAGE', images: [{ resized_image_url: 'https://scontent.example/' + (i % 2100) + '.jpg' }] } });
const t0 = () => process.hrtime.bigint(), ms = a => Number(process.hrtime.bigint() - a) / 1e6;
(async () => {
  const env = Object.assign({}, process.env, { PORT, JWT_SECRET: 'x'.repeat(40), ADMIN_EMAIL: 'a@t.dz', DB_FILE: path.join(DIR, 'd.db'), NODE_ENV: 'test' });
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  let cookie = '';
  const call = async (m, u, b) => { const r = await fetch(BASE + u, { method: m, headers: Object.assign({ cookie }, b ? { 'content-type': 'application/json' } : {}), body: b ? JSON.stringify(b) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0]; const t = await r.text(); return { status: r.status, size: t.length, body: t }; };
  try {
    await call('POST', '/api/register', { email: 'a@t.dz', password: 'password123' });
    let first = 0, last = 0, total = 0; const a = t0();
    for (let i = 0; i < N; i += 60) {
      const s = t0(); await call('POST', '/api/lib/ingest', { batch: 'b1', ads: Array.from({ length: Math.min(60, N - i) }, (_, k) => raw(i + k)), ctx: { query: 'q', country: 'DZ', label: 'perf' } });
      const d = ms(s); if (!i) first = d; last = d; total++;
    }
    console.log(`ingest ${N} ads in ${total} requests: ${ms(a).toFixed(0)} ms total · first ${first.toFixed(0)} ms · last ${last.toFixed(0)} ms`);
    for (const u of ['/', '/api/me', '/api/runs', '/api/saved', '/api/lib/stats', '/api/lib/dict', '/api/gap', '/collect.js', '/radar-lib/kwdata.js', '/radar-lib/markets.js']) {
      const s = t0(); const r = await call('GET', u); console.log(`GET ${u.padEnd(24)} ${String(ms(s).toFixed(0)).padStart(5)} ms  ${(r.size / 1024).toFixed(0)} KB`);
    }
    const runs = JSON.parse((await call('GET', '/api/runs')).body), id = runs[0].id;
    let s = t0(); const rr = await call('GET', '/api/runs/' + id); console.log(`GET /api/runs/${id} (rows) ${ms(s).toFixed(0)} ms ${(rr.size / 1024).toFixed(0)} KB`);
    const rows = JSON.parse(rr.body).rows;
    global.RadarMarkets = require('./lib/markets.js'); global.RadarProductCheck = require('./lib/productcheck.js'); global.RadarGapMatch = require('./lib/gapmatch.js');
    const CORE = require('../engine/core.js'), dict = fs.readFileSync(path.join(__dirname, '..', 'engine', 'dicts.js'), 'utf8'), DEF = JSON.parse(dict.match(/const DEF=(\{[\s\S]*?\});/)[1]);
    const L = CORE.buildLists({ strong: DEF.strong + ', ' + RadarMarkets.goldText('strong'), normal: DEF.normal + ', ' + RadarMarkets.goldText('normal'), brands: DEF.brands, bulky: DEF.bulky, fragile: DEF.fragile });
    s = t0(); const all = rows.map(CORE.normRow); const tn = ms(s);
    s = t0(); const P = CORE.analyze(all, Date.now(), L); console.log(`analysis of ${all.length} ads: normRow ${tn.toFixed(0)} ms · analyze ${ms(s).toFixed(0)} ms → ${P.length} entries`);
    s = t0(); CORE.analyze(all, Date.now(), L); console.log(`second analysis (warm) ${ms(s).toFixed(0)} ms`);
  } finally { srv.kill(); fs.rmSync(DIR, { recursive: true, force: true }); }
})();
