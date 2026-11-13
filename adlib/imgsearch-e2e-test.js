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

// صفحات الأسواق المحاكاة على شكل الصفحات الحقيقية (لقطات 11/2026). كل استلام للصورة يكتب نوعها وحجمها واسمها في العنوان
const GOT = `function gotF(f,how){document.title='GOT:'+f.type+':'+f.size+':'+f.name+':'+how;if(!window.NOOP)setTimeout(()=>{location.hash='results'},300)}function got(i){i.addEventListener('change',()=>gotF(i.files[0],'file'))}`;
const PAGES = {
  // AliExpress: أيقونة كاميرا داخل خانة البحث ← نافذة «Search by image»: منطقة سحب + زر «Upload a photo» (خانة الرفع تُنشأ عند الضغط)
  'www.aliexpress.com': `<header><input placeholder="99 Cents For 3 Items" style="width:380px"><span class="search--picSearch--3aeyGeH" style="display:inline-block;width:24px;height:24px"><svg width="20" height="20"></svg></span></header>
<script>${GOT};document.querySelector('.search--picSearch--3aeyGeH').onclick=()=>{const p=document.createElement('div');p.innerHTML='<b>Search by image</b><div class="drop" style="width:280px;height:120px">Drag an image here<br>or<button>Upload a photo</button></div>';document.body.appendChild(p);const i=document.createElement('input');i.type='file';i.accept='image/*';i.style.display='none';p.appendChild(i);got(i)}</script>`,
  // 1688: زر نصّي «以图搜款» ← لوحة سحب وإفلات فقط (بلا خانة رفع ظاهرة)
  'www.1688.com': `<div><input placeholder="全球热销" style="width:500px"><button style="width:140px;height:40px">搜索</button><div class="btn-img" style="display:inline-block;width:140px;height:40px"><i></i>以图搜款</div></div>
<script>${GOT};document.querySelector('.btn-img').onclick=()=>{const z=document.createElement('div');z.style.cssText='width:500px;height:200px';z.textContent='拖放文件到此处 点击上传或按 Ctrl+V 粘贴';z.addEventListener('dragover',e=>e.preventDefault());z.addEventListener('drop',e=>{e.preventDefault();gotF(e.dataTransfer.files[0],'drop')});document.body.appendChild(z)}</script>`,
  // Alibaba (بالفرنسية): «Recherche par image» تحت خانة البحث (وكلمة Dropshipping في القائمة لا تُخلط بمنطقة السحب)
  'www.alibaba.com': `<nav><a>Toutes les catégories</a> <a>Dropshipping</a></nav><div><input placeholder="climatiseur portable" style="width:600px"><div class="sb"><span><i></i></span><span>Recherche par image</span></div></div>
<script>${GOT};document.querySelector('.sb').onclick=()=>{const i=document.createElement('input');i.type='file';i.accept='image/*';i.style.display='none';document.body.appendChild(i);got(i)}</script>`,
  // Taobao: زر «搜同款» بجانب البحث
  'www.taobao.com': `<div><input value="海报" style="width:500px"><button>搜索</button><div class="tb-img" style="display:inline-block;width:100px;height:40px">搜同款</div></div>
<script>${GOT};document.querySelector('.tb-img').onclick=()=>{const i=document.createElement('input');i.type='file';i.style.display='none';document.body.appendChild(i);got(i)}</script>`
};
const VARIANT = {
  // Alibaba: بعد وضع الصورة تظهر معاينة وزر «搜索» للتأكيد (زر البحث بالكلمة الأصلي «搜索» يجب ألا يُضغط)
  'alibaba-confirm': `<div><input style="width:500px"><button id="kw" style="width:80px;height:30px">搜索</button><span class="sb" style="display:inline-block;width:150px;height:30px">Search by image</span></div>
<script>window.NOOP=1;${GOT};document.querySelector('#kw').onclick=()=>{document.title='WRONG:keyword'};document.querySelector('.sb').onclick=()=>{const i=document.createElement('input');i.type='file';i.style.display='none';document.body.appendChild(i);
i.addEventListener('change',()=>{const d=document.createElement('div');d.innerHTML='<img width=80 height=80><button style="width:80px;height:30px">搜索</button>';document.body.appendChild(d);d.querySelector('button').onclick=()=>{document.title='GOT:'+i.files[0].type+':'+i.files[0].size+':'+i.files[0].name+':confirm';location.hash='results'}})}</script>`,
  // 1688: خانة رفع موجودة لكن الموقع يتجاهلها، ومنطقة السحب هي التي تعمل: يجب تجربة الطريقة التالية
  '1688-fileignored': `<div><input style="width:400px"><label class="img-search-upload"><input type="file" accept="image/*" hidden></label>
<div class="dz" style="width:400px;height:120px">拖放文件到此处</div></div>
<script>window.NOOP=0;${GOT};const z=document.querySelector('.dz');z.addEventListener('dragover',e=>e.preventDefault());z.addEventListener('drop',e=>{e.preventDefault();gotF(e.dataTransfer.files[0],'drop')})</script>`,
  // AliExpress دون أيقونة معروفة: يقبل لصق الصورة (Ctrl+V) في خانة البحث
  'ali-paste': `<input placeholder="search" style="width:400px"><script>${GOT};document.querySelector('input').addEventListener('paste',e=>gotF(e.clipboardData.files[0],'paste'))</script>`,
  // Taobao لغير المسجّل: يحوّل فوراً إلى صفحة الدخول
  'taobao-login': `<script>location.href='https://login.taobao.com/member/login.jhtml'</script>`,
  // Alibaba يستلم الصورة ولا يفتح أي نتائج (تغيّر في الموقع): يجب ألا يُعدّ نجاحاً
  'alibaba-noop': `<script>window.NOOP=1</script>` + PAGES['www.alibaba.com']
};
PAGES['login.taobao.com'] = `<h1>密码登录</h1><input type="password">`;

(async () => {
  const env = Object.assign({}, process.env, { PORT, JWT_SECRET: 'x'.repeat(40), ADMIN_EMAIL: 'a@t.dz', DB_FILE: path.join(DIR, 'd.db'), NODE_ENV: 'test', BACKUP_DISABLE: '1' });
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stderr.on('data', d => log += d);
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  const ctx = await chromium.launchPersistentContext(path.join(DIR, 'prof'), { channel: 'chromium', headless: true, locale: 'ar-DZ', viewport: { width: 1300, height: 900 },
    args: ['--headless=new', '--disable-extensions-except=' + EXT, '--load-extension=' + EXT] });
  try {
    for (const h of Object.keys(PAGES)) await ctx.route('https://' + h + '/**', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><meta charset="utf-8"><body>' + PAGES[h] + '</body>' }));
    const got = async (p) => { await p.waitForFunction(() => document.title.startsWith('GOT:'), null, { timeout: 15000 }); return (await p.title()).split(':'); };
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
      const res = nextToast('النتائج في التبويب|لم يكتمل|يطلب تسجيل|تعذّر');
      const [p, out] = await Promise.all([tab, res]); return { p, out };
    };
    // 1) AliExpress: أيقونة الكاميرا ← نافذة البحث بالصورة ← الصورة في خانة الرفع
    let { p, out } = await run('ali', 'www.aliexpress.com'), t = await got(p);
    ok(t[1] === 'image/jpeg' && +t[2] > 1000 && t[3] === 'product.jpg' && t[4] === 'file' && /النتائج في التبويب/.test(out.msg), 'AliExpress: camera icon opens "Search by image" and the product photo (JPEG) is uploaded');
    await p.close();
    // 2) 1688: زر «以图搜款» ← لوحة سحب وإفلات
    ({ p, out } = await run('1688', 'www.1688.com')); t = await got(p);
    ok(t[4] === 'drop' && /النتائج في التبويب/.test(out.msg), '1688: «以图搜款» button, photo dropped into the drag-and-drop area'); await p.close();
    // 3) Alibaba بالفرنسية: «Recherche par image» (ولا يُخلط بـ Dropshipping)
    ({ p, out } = await run('alibaba', 'www.alibaba.com')); t = await got(p);
    ok(t[4] === 'file' && /النتائج في التبويب/.test(out.msg), 'Alibaba (French UI): «Recherche par image» found by its text, photo uploaded'); await p.close();
    // 4) Taobao: «搜同款»
    ({ p, out } = await run('taobao', 'www.taobao.com')); t = await got(p);
    ok(t[4] === 'file' && /النتائج في التبويب/.test(out.msg), 'Taobao: «搜同款» button, photo uploaded'); await p.close();
    // 5) AliExpress بلا أيقونة معروفة: لصق الصورة في خانة البحث (Ctrl+V)
    PAGES['www.aliexpress.com'] = VARIANT['ali-paste'];
    ({ p, out } = await run('ali', 'www.aliexpress.com')); t = await got(p);
    ok(t[4] === 'paste' && t[1] === 'image/jpeg', 'AliExpress fallback: photo pasted into the search box (like Ctrl+V)'); await p.close();
    // 5b) زر التأكيد «搜索» بعد المعاينة: يُضغط الجديد فقط
    PAGES['www.alibaba.com'] = VARIANT['alibaba-confirm'];
    ({ p, out } = await run('alibaba', 'www.alibaba.com')); t = await got(p);
    ok(t[4] === 'confirm' && /النتائج في التبويب/.test(out.msg), 'after the photo preview, the new «搜索» confirm button is clicked (not the keyword search button)'); await p.close();
    // 5c) الطريقة الأولى بلا أثر: تُجرَّب التالية تلقائياً
    PAGES['www.1688.com'] = VARIANT['1688-fileignored'];
    ({ p, out } = await run('1688', 'www.1688.com')); t = await got(p);
    ok(t[4] === 'drop' && /النتائج في التبويب/.test(out.msg), 'upload field ignored by the site → the extension retries with drag-and-drop and succeeds'); await p.close();
    // 6) Taobao بلا تسجيل دخول: يُكتشف التحويل إلى صفحة الدخول، ورسالة تدلّه على «حسابات الأسواق»
    PAGES['www.taobao.com'] = VARIANT['taobao-login'];
    ({ p, out } = await run('taobao', 'login.taobao.com'));
    ok(out.k === 'err' && /يطلب تسجيل الدخول/.test(out.msg) && /حسابات الأسواق/.test(out.msg), 'Taobao login page detected: the user is sent to «Integrations ← market accounts»');
    await p.waitForSelector('#wpr-img-panel', { timeout: 10000 });
    ok(/سجّل دخولك/.test(await p.textContent('#wpr-img-panel')), 'the market page shows a panel explaining the login is needed'); await p.close();
    // 7) الصورة وُضعت لكن الموقع لم يفتح نتائج: لا يُعدّ نجاحاً، ولوحة فيها الصورة + تقرير للدعم
    PAGES['www.alibaba.com'] = VARIANT['alibaba-noop'];
    ({ p, out } = await run('alibaba', 'www.alibaba.com'));
    ok(out.k === 'err' && /لم يكتمل البحث بالصورة/.test(out.msg), 'photo accepted but no results opened: reported as not finished (no false success)');
    await p.waitForSelector('#wpr-img-panel a[download="product.jpg"]', { timeout: 10000 });
    ok(/نسخ تقرير للدعم/.test(await p.textContent('#wpr-img-panel')), 'the panel offers «copy report for support»'); await p.close();
    // 8) حالة الحسابات من الإضافة + بطاقة «حسابات الأسواق» في «الربط والتكامل»
    let st = await pg.evaluate(() => window.WPRIMG.status());
    ok(st && st.taobao === false && st['1688'] === false, 'market accounts: not logged in at first');
    await ctx.addCookies([{ name: 'unb', value: '2200000000', domain: '.taobao.com', path: '/', secure: true }, { name: '__cn_logon__', value: 'true', domain: '.1688.com', path: '/', secure: true }]);
    st = await pg.evaluate(() => window.WPRIMG.status());
    ok(st.taobao === true && st['1688'] === true && st.ali === false, 'after logging in to Taobao and 1688 the extension sees it (cookie presence only)');
    await pg.goto(BASE + '/integrations'); await pg.waitForSelector('#x-mk table');
    const mk = await pg.textContent('#x-mk');
    ok(/Taobao[^]*مسجّل الدخول/.test(mk) && /AliExpress[^]*غير مسجّل/.test(mk) && (await pg.$$('#x-mk a[href^="https://login."]')).length === 2, 'Integrations shows each market account and a login button for the missing ones');
    ok(!(await pg.evaluate(() => window.WPRIMG.markets.pdd)), 'Pinduoduo is no longer offered');
    // 7) الإضافة ترفض صورة غير صالحة وسوقاً غير معروف
    const bad = await pg.evaluate(async () => [await window.WPRLIB.bridge.send('imgsearch', { market: 'ali', image: 'javascript:alert(1)' }, 5000), await window.WPRLIB.bridge.send('imgsearch', { market: 'evil', image: 'data:image/jpeg;base64,AAAA' }, 5000)]);
    ok(bad[0].ok === false && bad[0].error === 'image' && bad[1].error === 'market', 'extension refuses non-image data and unknown markets');
    ok(!errs.length, 'no page errors ' + errs.join(' | '));
    console.log(`PASS ${pass} image-search browser checks`);
  } catch (e) { console.error('FAIL', e.message); console.error(log.slice(-1200)); process.exitCode = 1; }
  finally { await ctx.close(); srv.kill(); fs.rmSync(DIR, { recursive: true, force: true }); }
})();
