'use strict';
// اختبار منطق الإضافة (background.js) بمحاكاة chrome.*: node adlib/bridge-test.js
const vm = require('vm'), fs = require('fs'), path = require('path'), assert = require('assert');
const dir = path.join(__dirname, '..', 'extensions', 'ad-collector');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; }; const eq = (a, b, m) => { assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m); pass++; };

const store = {}, tabs = [], listeners = {}, injected = [], focused = [];
let platformTabs = [{ id: 77, windowId: 5 }, { id: 78, windowId: 5 }];
const MANIFEST = { version: '1.1.0', content_scripts: [{ js: ['inject.js'], matches: ['https://www.facebook.com/ads/library/*'] }, { js: ['relay.js'], matches: ['*://radar.example/*'] }] };
const chrome = {
  runtime: { id: 'ext', getManifest: () => MANIFEST, getURL: p => 'chrome-extension://ext/' + p, onInstalled: { addListener: f => listeners.installed = f }, onStartup: { addListener() {} },
    onConnect: { addListener: f => listeners.connect = f }, onMessage: { addListener: f => listeners.message = f } },
  alarms: { create() {}, onAlarm: { addListener: f => listeners.alarm = f } },
  storage: { local: { get: async k => (typeof k === 'string' ? { [k]: store[k] } : { ...store }), set: async o => { Object.assign(store, JSON.parse(JSON.stringify(o))); } } },
  tabs: { create: async o => { const t = { id: tabs.length + 10, url: o.url }; tabs.push(t); return t; }, update: async (id, o) => { const t = tabs.find(x => x.id === id); if (t && o.url) t.url = o.url; if (o.active) focused.push(id); },
    sendMessage: async () => ({ ok: true }), query: async o => (o && o.url && o.url[0] === '*://radar.example/*' ? platformTabs : []) },
  windows: { update: async () => {} },
  scripting: { executeScript: async o => { injected.push(o); } }
};
const ctx = vm.createContext({ chrome, console, setTimeout: f => { f(); return 0; }, clearTimeout() {}, URL, Promise, JSON, Math, Date, Set, Map });   // الوقفات تُنفَّذ فوراً
vm.runInContext(fs.readFileSync(path.join(dir, 'background.js'), 'utf8'), ctx);

const mkPort = () => { const p = { name: 'platform', sender: { origin: 'https://radar.example' }, out: [], on: null, postMessage(m) { this.out.push(m); }, onMessage: { addListener(f) { p.on = f; } }, onDisconnect: { addListener(f) { p.dc = f; } } }; return p; };
const tick = () => new Promise(r => setImmediate(r)); const later = async n => { for (let i = 0; i < (n || 8); i++) await tick(); };
const msg = (m, sender) => new Promise((res, rej) => { const ret = listeners.message(m, sender, res); if (ret === false) res(undefined); });
const fromTab = (tabId, m) => msg(m, { tab: { id: tabId } });
const popup = (cmd, extra) => msg(Object.assign({ cmd }, extra || {}), { id: 'ext' });
const url = q => 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=DZ&q=' + encodeURIComponent(q) + '&search_type=keyword_unordered';

(async () => {
  // الملفات: نافذة منبثقة بدل صفحة، والاسم «إضافة»، ولا صفحة تشخيص تكشف الدومينات
  const man = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  ok(man.action.default_popup === 'popup.html' && fs.existsSync(path.join(dir, 'popup.html')) && !fs.existsSync(path.join(dir, 'status.html')), 'popup, no status page');
  ok(/إضافة/.test(man.name) && !/جسر/.test(JSON.stringify(man)), 'named extension');
  const popupSrc = fs.readFileSync(path.join(dir, 'popup.js'), 'utf8') + fs.readFileSync(path.join(dir, 'popup.html'), 'utf8');
  ok(!/platformOrigin|matches|location|hostname|origin/i.test(popupSrc), 'popup never touches or shows domains');

  listeners.installed(); await later();
  eq(injected.map(x => x.target.tabId), [77, 78], 'relay injected into already-open platform tabs'); eq(injected[0].files, ['relay.js'], 'injects relay.js');
  let st = await popup('popup_state'); eq([st.active, st.connected, st.sendMode, st.pending], [false, false, 'auto', 0], 'idle popup state before connecting');
  ok(!JSON.stringify(st).includes('radar.example'), 'state carries no domain');
  ok((await msg({ cmd: 'popup_stop' }, { id: 'ext', tab: { id: 3 } })) === undefined, 'popup commands from web tabs are ignored');
  ok((await msg({ cmd: 'popup_stop' }, { id: 'other' })) === undefined, 'popup commands from other extensions are ignored');

  const port = mkPort(); listeners.connect(port); await later();
  eq([port.out[0].evt, port.out[0].state.version], ['hello', '1.1.0'], 'hello carries the version'); eq(store.platformOrigin, 'https://radar.example', 'remembers the platform');
  const send = async (m) => { port.out.length = 0; await port.on(Object.assign({ id: 'r' + Math.random() }, m)); await later(); return port.out.find(x => x.evt === 'reply'); };
  eq((await popup('popup_state')).connected, true, 'popup sees the connection');

  let r = await send({ cmd: 'start', items: [{ q: 'a', url: 'https://evil.example/ads/library/?q=a' }, { q: 'b', url: 'https://www.facebook.com/profile?q=b' }] });
  eq([r.ok, tabs.length], [false, 0], 'only ad-library urls are opened');
  eq((await send({ cmd: 'start', items: [{ q: 'x', url: url('y') }] })).ok, false, 'url q must equal item q');
  // 10.0: AliExpress (المورّد) و TikTok مقبولان بشرط مطابقة الكلمة، وأي موقع آخر مرفوض
  eq((await send({ cmd: 'start', items: [{ q: 'lamp', url: 'https://aliexpress.evil.example/wholesale?SearchText=lamp' }, { q: 'x', url: 'https://www.tiktok.com.evil.example/search?q=x' }, { q: 'x', url: 'https://www.tiktok.com/@a/video/1?q=x' }] })).ok, false, 'look-alike AliExpress / TikTok hosts and non-search pages are refused');
  eq((await send({ cmd: 'start', items: [{ q: 'lamp', url: 'https://www.aliexpress.com/wholesale?SearchText=other' }, { q: 'a', url: 'https://www.tiktok.com/search?q=b' }] })).ok, false, 'AliExpress / TikTok query must equal the item');

  r = await send({ cmd: 'start', label: 'جمع: يزيل البقع +1', items: [{ q: 'يزيل البقع', niche: 'المنزل', url: url('يزيل البقع') }, { q: 'يحمي', niche: '', url: url('يحمي') }],
    settings: { speed: 'fast', maxAds: 99999, waitSeconds: 1, activeOnly: true }, limits: { maxAdsPerSearch: 300, allowFast: false } });
  ok(r.ok && tabs.length === 1, 'queue started in one tab');
  let q = store.bq; eq([q.settings.speed, q.settings.maxAds, q.settings.waitSeconds], ['normal', 300, 8], 'hard caps: no fast, ads<=300, wait>=8s');
  eq((await send({ cmd: 'start', items: [{ q: 'z', url: url('z') }] })).error, 'busy', 'one batch at a time');
  eq((await fromTab(10, { cmd: 'queue_check', href: url('يزيل البقع') })).start, true, 'collector gets the job');
  eq([(await fromTab(11, { cmd: 'queue_check', href: url('يزيل البقع') })).start, (await fromTab(10, { cmd: 'queue_check', href: url('غير ذلك') })).start], [false, false], 'other tabs / queries get nothing');

  // الوضع التلقائي: تصل فور الرصد مع اسم الدفعة والنيش
  port.out.length = 0;
  await fromTab(10, { cmd: 'ads', raw: [{ ad_archive_id: '1' }, { ad_archive_id: '2' }], ctx: { query: 'يزيل البقع', country: 'DZ' } }); await later();
  const ev = port.out.find(x => x.evt === 'ads'); ok(ev && ev.ads.length === 2 && ev.ctx.niche === 'المنزل' && ev.label === 'جمع: يزيل البقع +1' && ev.batchId === q.id, 'auto mode delivers live with label and niche');
  st = await popup('popup_state'); eq([st.pushed, st.pending, st.sent], [2, 2, 0], 'counters: collected 2, waiting 2');
  await send({ cmd: 'ack', seqs: [ev.seq] }); st = await popup('popup_state'); eq([st.pending, st.sent], [0, 2], 'ack: sent 2');
  eq((await fromTab(99, { cmd: 'ads', raw: [{ ad_archive_id: '3' }], ctx: {} })).ok, false, 'ads from unrelated tabs are ignored');

  // الوضع اليدوي: لا يصل شيء حتى «إرسال الآن»
  eq((await popup('popup_mode', { mode: 'manual' })).ok, true, 'switch to manual');
  port.out.length = 0; await fromTab(10, { cmd: 'ads', raw: [{ ad_archive_id: '4' }, { ad_archive_id: '5' }, { ad_archive_id: '6' }], ctx: { query: 'يزيل البقع' } }); await later();
  ok(!port.out.some(x => x.evt === 'ads'), 'manual mode holds ads back');
  st = await popup('popup_state'); eq([st.sendMode, st.pending, st.pushed, st.sent], ['manual', 3, 5, 2], 'manual: 3 waiting');
  port.out.length = 0; await send({ cmd: 'flush' }); ok(!port.out.some(x => x.evt === 'ads'), 'page reconnect does not leak manual ads');
  port.out.length = 0; r = await popup('popup_send'); await later(); eq([r.ok, r.count], [true, 3], 'send now'); const ev2 = port.out.find(x => x.evt === 'ads'); ok(ev2 && ev2.ads.length === 3, 'held ads delivered on demand');
  await send({ cmd: 'ack', seqs: [ev2.seq] }); eq((await popup('popup_state')).pending, 0, 'acknowledged');
  // تراكم ثم عودة للتلقائي يرسل المتراكم
  await fromTab(10, { cmd: 'ads', raw: [{ ad_archive_id: '7' }], ctx: { query: 'x' } }); port.out.length = 0;
  await popup('popup_mode', { mode: 'auto' }); await later(); ok(port.out.some(x => x.evt === 'ads' && x.ads.length === 1), 'back to auto sends what was held');
  // مسح غير المرسل
  await popup('popup_mode', { mode: 'manual' }); await fromTab(10, { cmd: 'ads', raw: [{ ad_archive_id: '8' }], ctx: {} });
  eq((await popup('popup_state')).pending, 2, 'held again (1 unacked + 1 new)'); await popup('popup_discard'); eq((await popup('popup_state')).pending, 0, 'discard clears the outbox');
  await popup('popup_mode', { mode: 'auto' });
  // بلا منصة مفتوحة لا يمكن «إرسال الآن»
  port.out.length = 0; port.dc(); eq((await popup('popup_send')).ok, false, 'cannot send without an open platform'); eq((await popup('popup_state')).connected, false, 'popup shows disconnected');

  // التقدّم ثم الانتقال للبحث التالي ثم النهاية
  await fromTab(10, { cmd: 'progress', seen: 37 }); await later();
  await fromTab(10, { cmd: 'job_done', href: url('يزيل البقع'), reason: 'idle', seen: 37 }); await later(20);
  q = store.bq; eq([q.idx, q.items[0].status, q.items[0].seen, q.items[1].status], [1, 'done', 37, 'running'], 'advanced to the next search'); eq(tabs[0].url, url('يحمي'), 'same tab navigated');
  await fromTab(10, { cmd: 'job_done', href: url('يحمي'), reason: 'max', seen: 300 }); await later(20);
  st = await popup('popup_state'); eq([st.active, st.endReason, st.items[1].reason], [false, 'max', 'max'], 'finished state is reported to the popup');

  // إيقاف وتخطٍّ من النافذة
  await send({ cmd: 'start', items: [{ q: 'a b', url: url('a b') }, { q: 'c', url: url('c') }], settings: {} });
  await popup('popup_skip'); await later(20); eq(store.bq.items[0].status, 'skipped', 'skip from the popup');
  await popup('popup_stop'); st = await popup('popup_state'); eq([st.active, st.endReason], [false, 'manual'], 'stop from the popup');

  // فتح المنصة: يفعّل تبويباً مفتوحاً، وإلا يفتح أقصر دومين مرتبط
  focused.length = 0; eq((await popup('popup_open')).ok, true, 'open platform'); eq(focused, [77], 'focuses the open platform tab');
  platformTabs = []; tabs.length = 0; await popup('popup_open'); eq(tabs.map(t => t.url), ['https://radar.example/collect'], 'opens the collect page when closed');

  // امتلاء الصندوق الصادر يوقف الجمع
  listeners.connect(port); await later();                              // المنصة تُفتح من جديد
  await send({ cmd: 'start', items: [{ q: 'c', url: url('c') }], settings: {} });
  store.outbox = new Array(400).fill({ seq: 0, ads: [] }); port.out.length = 0;
  await fromTab(tabs[tabs.length - 1].id, { cmd: 'ads', raw: [{ ad_archive_id: '9' }], ctx: {} }); await later();
  ok(port.out.some(x => x.evt === 'error' && x.code === 'outbox_full') && store.bq.active === false, 'outbox full stops collection');
  console.log('PASS', pass, 'extension checks');
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
