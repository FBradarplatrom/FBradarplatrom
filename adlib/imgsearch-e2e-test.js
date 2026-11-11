'use strict';
// اختبار متصفح بالإضافة الحقيقية محمّلة في Chromium: «🖼️ البحث بصورة المنتج» في أسواق المورّدين.
// الأسواق محاكاة (صفحات تشبه بنيتها: أيقونة كاميرا تُظهر خانة رفع، أو خانة موجودة مسبقاً، أو صفحة بلا بحث بالصورة).
// التشغيل: node adlib/imgsearch-e2e-test.js
const { spawn } = require('child_process'), assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require('playwright');
const PORT = 5100 + Math.floor(Math.random() * 80), BASE = 'http://127.0.0.1:' + PORT, DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-imgs-'));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok', m); };

// نسخة من الإضافة مربوطة بالمنصة المحلية (كما يفعل التنزيل من المنصة)
const EXT = path.join(DIR, 'ext');
fs.cpSync(path.join(__dirname, '..', 'extensions', 'ad-collector'), EXT, { recursive: true });
const mf = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
mf.content_scripts.forEach(c => { if (c.js.includes('relay.js')) c.matches = ['*://127.0.0.1/*']; });
mf.host_permissions = mf.host_permissions.filter(x => !x.includes('YOUR-PLATFORM-DOMAIN')).concat(['*://127.0.0.1/*']);
fs.writeFileSync(path.join(EXT, 'manifest.json'), JSON.stringify(mf, null, 2));

// صفحات الأسواق المحاكاة: كل رفع ناجح يكتب نوع الملف وحجمه في العنوان
const GOT = `function got(i){i.addEventListener('change',()=>{const f=i.files[0];document.title='GOT:'+f.type+':'+f.size+':'+f.name})}`;
const PAGES = {
  // أيقونة كاميرا تُنشئ خانة الرفع عند الضغط (مثل AliExpress)
  'www.aliexpress.com': `<header><input placeholder="search"><span class="search--picSearch--x1" title="Search by image" style="display:inline-block;width:24px;height:24px">📷</span></header>
<script>${GOT};document.querySelector('.search--picSearch--x1').onclick=()=>{if(document.querySelector('input[type=file]'))return;const p=document.createElement('div');p.innerHTML='<div class="upload-box">Drop image<input type="file" accept="image/*" style="display:none"></div>';document.body.appendChild(p);got(p.querySelector('input'))}</script>`,
  // خانة الرفع موجودة مسبقاً ومخفية (مثل 1688)
  'www.1688.com': `<div class="search"><input name="keywords"><label class="img-search-upload"><i class="camera"></i><input type="file" accept=".jpg,.jpeg,.png" hidden></label></div><script>${GOT};got(document.querySelector('input[type=file]'))</script>`,
  // أيقونة بالصينية في title (مثل Alibaba/Taobao بعناوين مختلفة)
  'www.alibaba.com': `<div><button title="以图搜款" style="width:30px;height:30px">◎</button></div><script>${GOT};document.querySelector('button').onclick=()=>{const i=document.createElement('input');i.type='file';i.accept='image/*';i.style.display='none';document.body.appendChild(i);got(i)}</script>`,
  // صفحة دخول بلا بحث بالصورة (مثل Taobao لغير المسجّل)
  'www.taobao.com': `<h1>请登录</h1><input type="password">`
};

(async () => {
  const env = Object.assign({}, process.env, { PORT, JWT_SECRET: 'x'.repeat(40), ADMIN_EMAIL: 'a@t.dz', DB_FILE: path.join(DIR, 'd.db'), NODE_ENV: 'test', BACKUP_DISABLE: '1' });
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stderr.on('data', d => log += d);
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  const ctx = await chromium.launchPersistentContext(path.join(DIR, 'prof'), { channel: 'chromium', headless: true, locale: 'ar-DZ', viewport: { width: 1300, height: 900 },
    args: ['--headless=new', '--disable-extensions-except=' + EXT, '--load-extension=' + EXT] });
  try {
    for (const h of Object.keys(PAGES)) await ctx.route('https://' + h + '/**', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><meta charset="utf-8"><body>' + PAGES[h] + '</body>' }));
    // صورة المنتج كما يعيدها وكيل الصور في المنصة
    let png = null;
    await ctx.route('**/api/img?**', r => r.fulfill({ contentType: 'image/png', body: png }));
    let sw = ctx.serviceWorkers()[0]; if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
    ok(true, 'the real extension (' + mf.version + ') is loaded in Chromium');
    const pg = ctx.pages()[0] || await ctx.newPage();
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(BASE + '/login');
    png = Buffer.from(await pg.evaluate(() => { const c = document.createElement('canvas'); c.width = 1600; c.height = 1200; const x = c.getContext('2d'); x.fillStyle = '#0b1d51'; x.fillRect(0, 0, 1600, 1200); x.fillStyle = '#ffd34d'; x.beginPath(); x.arc(800, 600, 300, 0, 7); x.fill(); return c.toDataURL('image/png').split(',')[1]; }), 'base64');
    await pg.request.post(BASE + '/api/register', { data: { email: 'u@t.dz', password: 'password123', name: 'U' } });
    await pg.goto(BASE + '/saved');
    await pg.waitForFunction(() => window.WPRLIB && window.WPRLIB.bridge.ok(), null, { timeout: 20000 });
    ok(await pg.evaluate(() => window.WPRLIB.bridge.version()) === mf.version, 'platform page is connected to the extension');

    // كل إشعار يظهر في الصفحة يُسجَّل
    await pg.evaluate(() => { window.__tl = []; new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1 && /toast/.test(n.className)) window.__tl.push({ msg: n.textContent, k: /err/.test(n.className) ? 'err' : '' }); }))).observe(document.body, { childList: true, subtree: true }); });
    const nextToast = (re) => pg.waitForFunction(re => { const i = window.__tl.findIndex(t => new RegExp(re).test(t.msg)); if (i < 0) return null; return window.__tl.splice(0, i + 1).pop(); }, re, { timeout: 30000 }).then(h => h.jsonValue());
    const run = async (m, host) => {
      const tab = ctx.waitForEvent('page', { timeout: 20000 }).then(async p => { await p.waitForURL('https://' + host + '/**', { timeout: 15000 }); return p; });
      await pg.evaluate(m => window.WPRIMG.search(m, 'https://cdn.example.test/p.png'), m);
      const res = nextToast('أُرسلت|لم نجد|تعذّر');
      const [p, out] = await Promise.all([tab, res]); return { p, out };
    };
    // 1) AliExpress: أيقونة الكاميرا تُضغط، تظهر خانة الرفع، وتوضع الصورة
    let { p, out } = await run('ali', 'www.aliexpress.com');
    await p.waitForFunction(() => document.title.startsWith('GOT:'), null, { timeout: 15000 });
    const t1 = (await p.title()).split(':');
    ok(t1[1] === 'image/jpeg' && +t1[2] > 1000 && t1[3] === 'product.jpg' && /أُرسلت/.test(out.msg), 'AliExpress: camera icon clicked and the product photo (JPEG) uploaded to image search');
    // 2) 1688: خانة رفع موجودة مخفية
    ({ p, out } = await run('1688', 'www.1688.com'));
    await p.waitForFunction(() => document.title.startsWith('GOT:'), null, { timeout: 15000 });
    ok(/أُرسلت/.test(out.msg), '1688: hidden upload field filled with the product photo');
    // 3) Alibaba: أيقونة بعنوان صيني «以图搜款»
    ({ p, out } = await run('alibaba', 'www.alibaba.com'));
    await p.waitForFunction(() => document.title.startsWith('GOT:'), null, { timeout: 15000 });
    ok(/أُرسلت/.test(out.msg), 'Alibaba: image-search button found by its Chinese title, photo uploaded');
    // 4) Taobao بلا تسجيل دخول: لا خانة رفع → لوحة بالصورة داخل الصفحة + رسالة واضحة
    ({ p, out } = await run('taobao', 'www.taobao.com'));
    ok(out.k === 'err' && /لم نجد زر البحث بالصورة/.test(out.msg), 'Taobao login page: the user is told to upload it from the camera icon');
    await p.waitForSelector('a[download="product.jpg"]', { timeout: 10000 });
    ok(/الكاميرا/.test(await p.evaluate(() => document.documentElement.textContent)), 'a panel with the product photo and a save button is shown on the market page');
    // 5) Pinduoduo: لا بحث بالصورة في موقعه → تنزيل الصورة + شرح التطبيق، دون فتح تبويب
    const dl = pg.waitForEvent('download', { timeout: 10000 });
    await pg.evaluate(() => window.WPRIMG.search('pdd', 'https://cdn.example.test/p.png'));
    const pdd = (await nextToast('Pinduoduo')).msg;
    ok(/تطبيقه فقط/.test(pdd) && (await dl).suggestedFilename().endsWith('.jpg'), 'Pinduoduo: explained (image search is app-only) and the photo is downloaded');
    // 6) الإضافة ترفض صورة غير صالحة وسوقاً غير معروف
    const bad = await pg.evaluate(async () => [await window.WPRLIB.bridge.send('imgsearch', { market: 'ali', image: 'javascript:alert(1)' }, 5000), await window.WPRLIB.bridge.send('imgsearch', { market: 'evil', image: 'data:image/jpeg;base64,AAAA' }, 5000)]);
    ok(bad[0].ok === false && bad[0].error === 'image' && bad[1].error === 'market', 'extension refuses non-image data and unknown markets');
    ok(!errs.length, 'no page errors ' + errs.join(' | '));
    console.log(`PASS ${pass} image-search browser checks`);
  } catch (e) { console.error('FAIL', e.message); console.error(log.slice(-1200)); process.exitCode = 1; }
  finally { await ctx.close(); srv.kill(); fs.rmSync(DIR, { recursive: true, force: true }); }
})();
