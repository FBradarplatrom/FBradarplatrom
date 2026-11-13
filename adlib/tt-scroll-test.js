'use strict';
// اختبار تمرير TikTok: صفحة محاكاة تحمّل الدفعة التالية فقط حين تقترب آخر البطاقات من الشاشة (مثل TikTok)،
// وتحمل ببطء. يجب أن يجمع سكربت الإضافة العدد المطلوب (200) لا ما يظهر أولاً فقط.
// التشغيل: node adlib/tt-scroll-test.js
const assert = require('assert'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'extensions', 'ad-collector', 'tt-collector.js'), 'utf8');
const PAGE = `<!doctype html><html><body style="margin:0"><div id="list" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px"></div><div id="s" style="height:10px"></div>
<script>
let n = 0, loading = false;
function more() { if (loading || n >= 600) return; loading = true; setTimeout(() => { const L = document.getElementById('list');
  for (let i = 0; i < 12; i++) { n++; const d = document.createElement('div'); d.setAttribute('data-e2e', 'search_top-item'); d.style.height = '320px';
    d.innerHTML = '<a href="/@shop' + n + '/video/' + (7000000000000000000n + BigInt(n)) + '"><img alt="product ' + n + '"></a><strong data-e2e="video-views">' + n + 'K</strong>'; L.appendChild(d); }
  loading = false; }, 900); }
more();
new IntersectionObserver(e => { if (e[0].isIntersecting) more(); }, { rootMargin: '0px' }).observe(document.getElementById('s'));
</script></body></html>`;
(async () => {
  const b = await chromium.launch(); b.newPage = ((f) => o => f(Object.assign({ locale: 'ar-DZ' }, o)))(b.newPage.bind(b)); b.newContext = ((f) => o => f(Object.assign({ locale: 'ar-DZ' }, o)))(b.newContext.bind(b));   /* اللوحة بالعربية (لغة المتصفح الافتراضية) */ let ok = false;
  try {
    const pg = await b.newPage({ viewport: { width: 1200, height: 800 } });
    await pg.route('https://www.tiktok.com/**', r => r.fulfill({ contentType: 'text/html', body: PAGE }));
    await pg.addInitScript(() => {
      window.__sent = { seen: 0, done: null };
      window.chrome = { runtime: { sendMessage: (m) => {
        if (m.cmd === 'queue_check') return Promise.resolve({ start: true, settings: { maxAds: 200, speed: 'normal', waitSeconds: 15 } });
        if (m.cmd === 'progress') window.__sent.seen = m.seen;
        if (m.cmd === 'job_done') window.__sent.done = m;
        return Promise.resolve({ ok: true });
      } } };
    });
    await pg.goto('https://www.tiktok.com/search?q=gadget&t=1794239616839');
    await pg.addScriptTag({ content: SRC });
    await pg.waitForFunction(() => window.__sent.done, null, { timeout: 240000 });
    const d = await pg.evaluate(() => window.__sent.done);
    assert.ok(d.seen >= 200 && d.reason === 'max', 'collected ' + d.seen + ' (' + d.reason + ')');
    console.log('ok TikTok gradual scroll collected', d.seen, 'videos (wanted 200, first screen shows 12)');
    ok = true;
  } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; } finally { await b.close(); }
  if (ok) console.log('PASS TikTok scroll test');
})();
