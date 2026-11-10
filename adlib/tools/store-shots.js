'use strict';
// صور متجر Chrome من المنصة نفسها ببيانات تجريبية: 3 لقطات 1280×800 + لوحة ترويجية 440×280.
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
module.exports = async function shots(OUT) {
  const { chromium } = require('playwright');
  const PORT = 5700 + Math.floor(Math.random() * 80), BASE = 'http://127.0.0.1:' + PORT, DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-shots-'));
  const srv = spawn(process.execPath, [path.join(__dirname, '..', '..', 'server.js')], { env: Object.assign({}, process.env, { PORT, JWT_SECRET: 's'.repeat(40), ADMIN_EMAIL: 'demo@radar.app', DB_FILE: path.join(DIR, 'd.db'), NODE_ENV: 'test', BACKUP_DISABLE: '1' }), stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  const b = await chromium.launch(); let n = 0;
  try {
    const shot = async (pg, name) => { await pg.screenshot({ path: path.join(OUT, name) }); n++; };
    // 1) الصفحة الرئيسية (إنجليزية) والأسعار
    const pg = await b.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    await pg.goto(BASE + '/?lang=en'); await pg.waitForTimeout(800); await shot(pg, 'screenshot-1-home-en.png');
    await pg.goto(BASE + '/?lang=fr'); await pg.waitForSelector('#plans .plan'); await pg.locator('#pricing').scrollIntoViewIfNeeded(); await pg.waitForTimeout(300); await shot(pg, 'screenshot-3-pricing-fr.png');
    // 2) النتائج داخل المنصة ببيانات تجريبية
    await pg.request.post(BASE + '/api/register', { data: { email: 'demo@radar.app', password: 'password123', name: 'Demo' } });
    const day = d => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10), C = ['#a2ddbf', '#bbf7d0', '#fed7aa', '#fbcfe8', '#bae6fd', '#cfeedd'];
    const T = [['Star projector night light helps your baby sleep', 18], ['Posture corrector – say goodbye to back pain', 25], ['Mini vacuum removes dust from your car', 6], ['Anti-snoring nose clip', 12], ['Magnetic phone holder for car', 3], ['Portable blender for smoothies on the go', 40]];
    const rows = T.map(([t, d], i) => ({ ad_id: String(9100 + i), page_id: 'p' + i, page_name: ['Lumi Shop', 'BackFix', 'CarCare Store', 'SleepWell', 'DriveMate', 'BlendGo'][i], status: 'active', country: ['US', 'FR', 'GB', 'DE', 'SA', 'US'][i], title: t, body: t + '. Free shipping. Only $' + (19 + i * 5) + '.99',
      start_date: day(d), link_url: 'https://shop' + i + '.example/products/item-' + i, image_url: 'https://img.example/' + i + '.jpg' }));
    const f = path.join(DIR, 'demo.json'); fs.writeFileSync(f, JSON.stringify(rows));
    await pg.evaluate(() => { try { localStorage.setItem('wpr_lang', 'en'); } catch (e) {} });   // لوحة التحكم بالإنجليزية لصور المتجر
    await pg.goto(BASE + '/analyze'); await pg.waitForSelector('#file', { state: 'attached' }); await pg.setInputFiles('#file', f); await pg.waitForSelector('#grid .pc');
    await pg.evaluate(C => document.querySelectorAll('#grid .pc-media').forEach((m, i) => { m.style.background = 'linear-gradient(135deg,' + C[i % C.length] + ',#6bc79a)'; m.innerHTML = ''; }), C);
    await pg.evaluate(() => { const t = document.querySelector('#tabs'); window.scrollTo(0, t.getBoundingClientRect().top + window.scrollY - 20); }); await pg.waitForTimeout(300); await shot(pg, 'screenshot-2-results.png');
    // 3) لوحة ترويجية صغيرة 440×280
    const tile = await b.newPage({ viewport: { width: 440, height: 280 }, deviceScaleFactor: 1 });
    await tile.setContent(`<body style="margin:0;width:440px;height:280px;display:flex;flex-direction:column;justify-content:center;gap:10px;padding:0 34px;box-sizing:border-box;font-family:Inter,system-ui,sans-serif;color:#fff;background:radial-gradient(400px 260px at 90% 0%,#6bc79a,transparent),linear-gradient(135deg,#118553,#0a7040)">
<div style="font-size:44px">📡</div><div style="font-size:30px;font-weight:800;line-height:1.15">Winning Product Radar</div><div style="font-size:16px;opacity:.9">Find winning products before the market gets crowded</div></body>`);
    await shot(tile, 'promo-tile-440x280.png');
  } finally { await b.close(); srv.kill(); }
  return n;
};
