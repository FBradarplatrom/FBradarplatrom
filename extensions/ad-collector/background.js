// إضافة جمع الإعلانات – service worker.
// يتلقى الأوامر من صفحة المنصة (عبر relay.js) ومن نافذة الإضافة، ويدير طابور البحث في مكتبة إعلانات ميتا (تبويب واحد، بحث بعد بحث)،
// ويحفظ ما جُمع في «صندوق صادر» حتى تؤكد المنصة استلامه، فلا يضيع شيء إن أُغلقت صفحة المنصة أو نام الـworker.
// وضع الإرسال: تلقائي (يصل فور رصده) أو يدوي (يبقى في الصندوق حتى «إرسال الآن»).
'use strict';

const VERSION = chrome.runtime.getManifest().version;
const QK = 'bq', OK = 'outbox', SK = 'seq', PK = 'platformOrigin', MK = 'mode';
const LIB_RE = /^https:\/\/(www|web)\.facebook\.com\/ads\/library\//;
// أنواع المهام: fb = مكتبة إعلانات ميتا · ali = بحث AliExpress (إيجاد المورّد) · tt = بحث TikTok
const ALI_RE = /^https:\/\/([a-z]{2,3}\.|www\.)?aliexpress\.(com|us)\/(w\/wholesale|wholesale)/;
const TT_RE = /^https:\/\/www\.tiktok\.com\/search(\/video)?\?/;
// الأسواق الصينية (إيجاد المورّد): [نمط صفحة البحث، اسم معامل الكلمة]
const SHOPS = {
  alibaba: [/^https:\/\/(www\.)?alibaba\.com\/trade\/search\?/, 'SearchText'],
  '1688': [/^https:\/\/s\.1688\.com\/selloffer\/offer_search\.htm\?/, 'keywords'],
  taobao: [/^https:\/\/s\.taobao\.com\/search\?/, 'q'],
  pdd: [/^https:\/\/mobile\.yangkeduo\.com\/search_result\.html\?/, 'search_key']
};
const shopOf = (u) => Object.keys(SHOPS).find((k) => SHOPS[k][0].test(u)) || '';
const aliKey = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();   // «kid's light» = «kid-s-light» مهما حوّل AliExpress الرابط
const kindOf = (u) => (LIB_RE.test(u) ? 'fb' : ALI_RE.test(u) ? 'ali' : TT_RE.test(u) ? 'tt' : shopOf(u) ? 'shop' : '');
// حدود صلبة داخل الإضافة نفسها مهما أرسلت الصفحة: حماية لحساب المستخدم من التقييد
// ads: سقف الإعلانات للبحث الواحد (كان 500، ويقصّه حد المنصة). itemMs: مهلة البحث الواحد تكبر مع العدد المطلوب (انظر itemLimit)
const HARD = { items: 120, ads: 5000, waitMin: 8, waitMax: 60, itemMs: 7 * 60 * 1000, itemMsMax: 75 * 60 * 1000, outbox: 400 };
const itemLimit = (q) => Math.min(HARD.itemMsMax, Math.max(HARD.itemMs, ((q && q.settings && q.settings.maxAds) || 200) * 1500));

const ports = new Set();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const get = async (k) => (await chrome.storage.local.get(k))[k];
const set = (o) => chrome.storage.local.set(o);
let chain = Promise.resolve();
const locked = (fn) => { const p = chain.then(() => fn()); chain = p.catch(() => {}); return p; };   // قراءة-تعديل-كتابة التخزين لا تتداخل

// مفتاح البحث من الرابط: كلمة البحث (أو page:معرّف الصفحة في مراقبة المنافسين). يتحمّل تحويل AliExpress إلى نطاق لغة آخر.
const urlQ = (href) => {
  try {
    const u = new URL(href), p = u.searchParams;
    const sh = shopOf(href); if (sh) return aliKey(p.get(SHOPS[sh][1]));
    if (ALI_RE.test(href)) { const m = /wholesale-([^/?#]+)\.html/.exec(u.pathname); return aliKey(p.get('SearchText') || (m ? decodeURIComponent(m[1]) : '')); }
    return p.get('q') || (p.get('view_all_page_id') ? 'page:' + p.get('view_all_page_id') : '');
  } catch (_) { return ''; }
};
const adsIn = (out) => (out || []).reduce((n, e) => n + ((e && e.ads && e.ads.length) || 0), 0);
const getMode = async () => ((await get(MK)) === 'manual' ? 'manual' : 'auto');
const bc = (msg) => ports.forEach((p) => { try { p.postMessage(msg); } catch (_) { ports.delete(p); } });

const pub = (q) => (!q ? { active: false, total: 0, items: [] } : {
  active: !!q.active, id: q.id, mode: q.mode, idx: q.idx, total: q.items.length, startedAt: q.createdAt, finishedAt: q.finishedAt || 0, endReason: q.endReason || '',
  items: q.items.map((i) => ({ q: i.q, kind: i.kind || 'fb', niche: i.niche || '', status: i.status, seen: i.seen || 0, total: i.total || 0, reason: i.reason || '' }))
});
// حالة كاملة للمنصة وللنافذة: التقدّم + الإرسال
async function full(q) {
  const out = (await get(OK)) || [], pending = adsIn(out), pushed = q ? q.pushed || 0 : 0;
  return Object.assign(pub(q), { sendMode: await getMode(), pending, pushed, sent: Math.max(0, pushed - pending), connected: ports.size > 0, version: VERSION });
}
const emitState = async (q) => { try { bc({ evt: 'state', state: await full(q) }); } catch (_) { /* ignore */ } };

function sanitize(s, limits) {
  s = s || {}; limits = limits || {};
  return {
    speed: s.speed === 'slow' || (s.speed === 'fast' && limits.allowFast === true) ? s.speed : 'normal',
    maxAds: clamp(Math.floor(+s.maxAds) || 200, 1, Math.min(HARD.ads, Math.floor(+limits.maxAdsPerSearch) || 3000)),
    waitSeconds: clamp(Math.floor(+s.waitSeconds) || 20, HARD.waitMin, HARD.waitMax),
    activeOnly: s.activeOnly !== false
  };
}

// بعد التثبيت/التحديث لا تُحقن الإضافات تلقائياً في تبويبات مفتوحة قبلها: نحقن relay.js بأنفسنا فلا حاجة لـF5
const relayMatches = () => { const cs = (chrome.runtime.getManifest().content_scripts || []).find((c) => (c.js || []).includes('relay.js')); return (cs && cs.matches) || []; };
async function injectRelay() {
  try {
    if (!chrome.scripting) return;
    const tabs = await chrome.tabs.query({ url: relayMatches() });
    for (const t of tabs) { try { await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['relay.js'] }); } catch (_) { /* tab not injectable */ } }
  } catch (_) { /* ignore */ }
}
function init() { chrome.alarms.create('wpr_watch', { periodInMinutes: 1 }); }
chrome.runtime.onInstalled.addListener(() => { init(); injectRelay(); });
chrome.runtime.onStartup.addListener(init);

/* ---------- الطابور ---------- */
async function startQueue(m) {
  const items = (Array.isArray(m.items) ? m.items : []).slice(0, HARD.items)
    .map((x) => ({ q: String((x && x.q) || '').slice(0, 120), niche: String((x && x.niche) || '').slice(0, 60), url: String((x && x.url) || ''), status: 'pending' }))
    .map((x) => Object.assign(x, { kind: kindOf(x.url), key: urlQ(x.url) }))
    .filter((x) => x.kind && x.key && (x.kind === 'ali' || x.kind === 'shop' ? aliKey(x.q) === x.key : x.q === x.key));   // مكتبة الإعلانات أو AliExpress أو TikTok فقط، والكلمة = كلمة الرابط
  if (!items.length) return { ok: false, error: 'no_items' };
  const old = await get(QK);
  if (old && old.active) return { ok: false, error: 'busy' };
  const q = { id: 'b' + Date.now(), mode: 'queue', tabId: null, settings: sanitize(m.settings, m.limits), limits: m.limits || {}, label: String(m.label || '').slice(0, 160), items, idx: 0, active: true, createdAt: Date.now(), pushed: 0 };
  items[0].status = 'running'; items[0].startedAt = Date.now();
  try { q.tabId = (await chrome.tabs.create({ url: items[0].url, active: true })).id; } catch (_) { return { ok: false, error: 'tab' }; }
  await set({ [QK]: q });
  emitState(q);
  bc({ evt: 'search_start', id: q.id, idx: 0, query: items[0].q });
  return { ok: true, id: q.id };
}

async function startCurrent(m) {
  const old = await get(QK);
  if (old && old.active) return { ok: false, error: 'busy' };
  let tabs = [];
  try { tabs = await chrome.tabs.query({ url: ['https://www.facebook.com/ads/library/*', 'https://web.facebook.com/ads/library/*'] }); } catch (_) { /* ignore */ }
  const tab = tabs.find((t) => t.active) || tabs[0];
  if (!tab) return { ok: false, error: 'no_tab' };
  const item = { q: urlQ(tab.url), niche: '', url: tab.url, status: 'running', startedAt: Date.now() };
  const q = { id: 'c' + Date.now(), mode: 'current', tabId: tab.id, settings: sanitize(m.settings, m.limits), limits: m.limits || {}, label: String(m.label || '').slice(0, 160), items: [item], idx: 0, active: true, createdAt: Date.now(), pushed: 0 };
  try { await chrome.tabs.sendMessage(tab.id, { cmd: 'start', settings: q.settings }); } catch (_) { return { ok: false, error: 'reload_tab' }; }
  await set({ [QK]: q });
  emitState(q);
  bc({ evt: 'search_start', id: q.id, idx: 0, query: item.q });
  return { ok: true, id: q.id };
}

// ينهي البحث الحالي ويجهّز التالي. يُستدعى داخل القفل ويعيد «متابعة» تُنفَّذ بعد تحرير القفل (وقفة بشرية ثم الانتقال)
async function advance(q, reason, seen) {
  const it = q.items[q.idx];
  if (it) {
    it.status = reason === 'timeout' ? 'timeout' : reason === 'skipped' ? 'skipped' : reason === 'login' ? 'stopped' : 'done';
    it.reason = reason; it.finishedAt = Date.now();
    if (seen != null) it.seen = seen;
  }
  q.idx++;
  if (q.mode !== 'queue' || q.idx >= q.items.length) {
    q.active = false; q.finishedAt = Date.now(); q.endReason = reason || 'done';
    await set({ [QK]: q });
    emitState(q);
    bc({ evt: 'done', id: q.id, reason: reason || 'done' });
    return null;
  }
  q.items[q.idx].status = 'running'; q.items[q.idx].startedAt = Date.now();
  await set({ [QK]: q });
  emitState(q);
  const id = q.id, idx = q.idx;
  return async () => {
    await sleep(4000 + Math.random() * 4000);
    await locked(async () => {
      const cur = await get(QK);
      if (!(cur && cur.active && cur.id === id && cur.idx === idx)) return;
      try {
        await chrome.tabs.update(cur.tabId, { url: cur.items[idx].url });
        bc({ evt: 'search_start', id, idx, query: cur.items[idx].q });
      } catch (_) {                                                    // أُغلق التبويب
        cur.active = false; cur.items[idx].status = 'stopped'; cur.finishedAt = Date.now(); cur.endReason = 'tab_closed';
        await set({ [QK]: cur });
        emitState(cur);
        bc({ evt: 'done', id, reason: 'tab_closed' });
      }
    });
  };
}

async function stopInline(q, reason) {
  if (!(q && q.active)) return;
  q.active = false; q.finishedAt = Date.now(); q.endReason = reason || 'manual';
  const it = q.items[q.idx];
  if (it && it.status === 'running') it.status = 'stopped';
  await set({ [QK]: q });
  try { await chrome.tabs.sendMessage(q.tabId, { cmd: 'stop' }); } catch (_) { /* tab gone */ }
  emitState(q);
  bc({ evt: 'done', id: q.id, reason: q.endReason });
}
const stopQueue = () => locked(async () => { await stopInline(await get(QK), 'manual'); return { ok: true }; });
const skipCurrent = async () => { const cont = await locked(async () => { const q = await get(QK); return q && q.active ? advance(q, 'skipped') : undefined; }); if (cont) cont(); return { ok: true }; };

/* ---------- الصندوق الصادر ---------- */
// داخل القفل. تلقائي: يُرسل للمنصة فور رصده. يدوي: يبقى هنا حتى «إرسال الآن».
async function pushAds(msg, q) {
  const out = (await get(OK)) || [];
  if (out.length >= HARD.outbox) {                                     // لا نكدّس بلا حد
    await stopInline(q, 'outbox_full');
    bc({ evt: 'error', code: 'outbox_full' });
    return false;
  }
  const seq = ((await get(SK)) || 0) + 1, it = q.items[q.idx];
  const entry = {
    seq, batchId: q.id, t: Date.now(), label: q.label || '', kind: (it && it.kind) || 'fb',
    ctx: { query: String((msg.ctx && msg.ctx.query) || '').slice(0, 120), country: String((msg.ctx && msg.ctx.country) || '').slice(0, 10), niche: it ? it.niche || '' : '', total: Math.max(0, Math.floor(+(msg.ctx && msg.ctx.total) || 0)) },
    ads: (Array.isArray(msg.raw) ? msg.raw : []).slice(0, 60)
  };
  out.push(entry);
  q.pushed = (q.pushed || 0) + entry.ads.length;
  await set({ [OK]: out, [SK]: seq, [QK]: q });
  if ((await getMode()) === 'auto') bc(Object.assign({ evt: 'ads' }, entry));
  emitState(q);
  return true;
}
const ackAds = (seqs) => locked(async () => {
  const s = new Set((Array.isArray(seqs) ? seqs : []).map(Number));
  await set({ [OK]: ((await get(OK)) || []).filter((e) => !s.has(e.seq)) });
  emitState(await get(QK));
});
async function sendNow() {
  if (!ports.size) return { ok: false, error: 'no_platform' };
  const out = (await get(OK)) || [];
  out.forEach((e) => bc(Object.assign({ evt: 'ads' }, e)));
  return { ok: true, count: adsIn(out) };
}
async function setMode(m) {
  await set({ [MK]: m === 'manual' ? 'manual' : 'auto' });
  if (m !== 'manual') await sendNow();                                 // الرجوع للتلقائي يُرسل ما تجمّع
  emitState(await get(QK));
  return { ok: true };
}
const discardPending = () => locked(async () => { await set({ [OK]: [] }); emitState(await get(QK)); return { ok: true }; });

/* ---------- فتح المنصة ---------- */
async function openPlatform() {
  const matches = relayMatches().filter((m) => !/YOUR-PLATFORM/.test(m));
  try {
    const tabs = matches.length ? await chrome.tabs.query({ url: matches }) : [];
    if (tabs.length) { await chrome.tabs.update(tabs[0].id, { active: true }); try { await chrome.windows.update(tabs[0].windowId, { focused: true }); } catch (_) { /* ignore */ } return { ok: true }; }
    const o = await get(PK);
    let url = o ? o + '/collect' : '';
    if (!url) {                                                         // لم تتصل بعد: أقصر دومين مرتبط (غالباً الأساسي)
      const hosts = matches.map((m) => m.replace(/^\*:\/\//, '').replace(/\/\*$/, '')).filter((h) => !/^(localhost|127\.)/.test(h)).sort((a, b) => a.length - b.length);
      if (hosts[0]) url = 'https://' + hosts[0] + '/collect';
    }
    if (!url) return { ok: false, error: 'no_platform' };
    await chrome.tabs.create({ url });
    return { ok: true };
  } catch (_) { return { ok: false }; }
}

/* ---------- البحث بصورة المنتج في أسواق المورّدين ---------- */
// المنصة ترسل صورة المنتج (JPEG مصغّرة)، فتفتح الإضافة الصفحة الرئيسية للسوق وتضع الصورة في خانة «البحث بالصورة» كأنك رفعتها بنفسك.
const IMG_HOME = { ali: 'https://www.aliexpress.com/', alibaba: 'https://www.alibaba.com/', '1688': 'https://www.1688.com/', taobao: 'https://www.taobao.com/' };
const IMG_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
function tabReady(tabId, ms) {
  return new Promise((res) => {
    const done = (v) => { clearTimeout(t); chrome.tabs.onUpdated.removeListener(on); res(v); };
    const on = (id, info) => { if (id === tabId && info.status === 'complete') done(true); };
    const t = setTimeout(() => done(false), ms);
    chrome.tabs.onUpdated.addListener(on);
    chrome.tabs.get(tabId).then((tb) => { if (tb && tb.status === 'complete') done(true); }).catch(() => done(false));
  });
}
// تُحقن في صفحة السوق (دالة من الإضافة نفسها، لا شيفرة عن بُعد): تجد خانة رفع الصورة (أو تضغط أيقونة الكاميرا لتظهر) وتضع الملف فيها.
// إن لم تجدها: تعرض لوحة صغيرة فيها الصورة وزر حفظها، ليرفعها المستخدم من أيقونة الكاميرا بنفسه.
async function uploadToImageSearch(dataUrl, market, lang) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const bin = atob(dataUrl.split(',')[1]), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const type = (/^data:([^;]+)/.exec(dataUrl) || [])[1] || 'image/jpeg';
  const file = new File([u8], 'product.' + (type.split('/')[1] === 'jpeg' ? 'jpg' : type.split('/')[1]), { type });
  const seen = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const findInput = () => [...document.querySelectorAll('input[type="file"]')].find((i) => !i.disabled && (!i.accept || /image|jpe?g|png|webp/i.test(i.accept)));
  const SEL = {
    ali: ['[class*="picSearch"]', '[class*="pic-search"]', '[class*="image-search"]', '[class*="imageSearch"]', '[class*="camera"]'],
    alibaba: ['[class*="image-search"]', '[class*="imageSearch"]', '[class*="img-search"]', '[class*="picture-search"]', '[class*="camera"]'],
    '1688': ['[class*="img-search"]', '[class*="image-search"]', '[class*="imageSearch"]', '[class*="pic-search"]', '[class*="camera"]'],
    taobao: ['[class*="image-search"]', '[class*="imgsearch"]', '[class*="imageSearch"]', '[class*="pailitao"]', '[class*="camera"]']
  }[market] || [];
  const WORDS = /(pic|image|img|photo|picture)[-_ ]?(search|upload)|camera|拍立淘|以图搜|图片搜索|搜索图片|search by image|image search/i;
  const cands = () => {
    const a = SEL.flatMap((s) => [...document.querySelectorAll(s)]);
    const b = [...document.querySelectorAll('[class],[title],[aria-label]')].filter((el) => {
      const c = typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || '';
      return WORDS.test(c + ' ' + (el.getAttribute('title') || '') + ' ' + (el.getAttribute('aria-label') || ''));
    });
    return [...new Set(a.concat(b))].filter((el) => { if (!seen(el)) return false; const r = el.getBoundingClientRect(); return r.top < 400 && r.width < 200 && r.height < 120; });
  };
  let inp = findInput();
  for (let round = 0; !inp && round < 4; round++) {
    for (const c of cands().slice(0, 5)) { try { c.click(); } catch (_) { /* ignore */ } await sleep(800); inp = findInput(); if (inp) break; }
    if (!inp) await sleep(1500);
  }
  if (inp) {
    const dt = new DataTransfer(); dt.items.add(file);
    inp.files = dt.files;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true };
  }
  // احتياط: لوحة بالصورة (يمكن سحبها إلى أيقونة الكاميرا) وزر حفظها
  const box = document.createElement('div');
  box.setAttribute('style', 'position:fixed;z-index:2147483647;top:16px;right:16px;width:250px;background:#fff;color:#111;border:2px solid #15803d;border-radius:14px;padding:12px;font:14px/1.5 system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.25);direction:' + (lang === 'ar' ? 'rtl' : 'ltr'));
  const im = document.createElement('img'); im.src = dataUrl; im.setAttribute('style', 'width:100%;border-radius:10px;display:block;margin-bottom:8px');
  const tx = document.createElement('div'); tx.textContent = { ar: 'صورة المنتج من رادار المنتجات الرابحة: اضغط أيقونة الكاميرا 📷 في خانة البحث وارفعها (أو اسحبها إليها).', fr: 'Photo du produit (Radar) : cliquez sur l’icône appareil photo 📷 de la recherche et importez-la (ou glissez-la).', en: 'Product photo from Winning Product Radar: click the camera icon 📷 in the search box and upload it (or drag it there).' }[lang] || '';
  const a = document.createElement('a'); a.href = dataUrl; a.download = file.name; a.textContent = { ar: '⬇ حفظ الصورة', fr: '⬇ Enregistrer l’image', en: '⬇ Save image' }[lang]; a.setAttribute('style', 'display:inline-block;margin-top:8px;color:#15803d;font-weight:700');
  const x = document.createElement('button'); x.textContent = '×'; x.setAttribute('style', 'position:absolute;top:4px;left:8px;border:0;background:none;font-size:20px;cursor:pointer'); x.onclick = () => box.remove();
  box.append(x, im, tx, a); document.documentElement.appendChild(box);
  return { ok: false, error: 'no_input' };
}
async function imageSearch(m) {
  const home = IMG_HOME[m.market];
  if (!home) return { ok: false, error: 'market' };
  const img = String(m.image || '');
  if (img.length > 4e6 || !IMG_RE.test(img)) return { ok: false, error: 'image' };
  let tab;
  try { tab = await chrome.tabs.create({ url: home, active: true }); } catch (_) { return { ok: false, error: 'tab' }; }
  await tabReady(tab.id, 30000);
  await sleep(1200);                                                     // واجهة السوق تُبنى بعد التحميل
  try {
    const r = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: uploadToImageSearch, args: [img, m.market, ['ar', 'fr', 'en'].includes(await get('uiLang')) ? await get('uiLang') : 'ar'] });
    const out = (r && r[0] && r[0].result) || { ok: false, error: 'inject' };
    return Object.assign({ market: m.market }, out);
  } catch (_) { return { ok: false, error: 'inject', market: m.market }; }  // تحويل لنطاق آخر أو صفحة دخول لا تُحقن
}

/* ---------- أوامر المنصة ---------- */
async function onPage(port, m) {
  if (!m || typeof m.cmd !== 'string') return;
  // معرّف الرسالة يُكتب أخيراً: ردّ «start» يحمل معرّف الدفعة في batch ولا يطمس معرّف الرسالة
  const reply = (o) => { try { port.postMessage(Object.assign({ evt: 'reply' }, o, o && o.id ? { batch: o.id } : {}, { id: m.id })); } catch (_) { /* gone */ } };
  switch (m.cmd) {
    // حالة تسجيل الدخول في TikTok (وجود جلسة TikTok في هذا المتصفح، دون قراءة قيمتها)
    case 'tt_status': { let logged = false; try { logged = !!(await chrome.cookies.get({ url: 'https://www.tiktok.com', name: 'sessionid' })); } catch (_) { /* ignore */ } reply({ ok: true, logged }); break; }
    case 'ping': reply({ ok: true, version: VERSION, state: await full(await get(QK)) }); break;
    case 'start': reply(await locked(() => startQueue(m))); break;
    case 'imgsearch': reply(await imageSearch(m)); break;
    case 'start_current': reply(await locked(() => startCurrent(m))); break;
    case 'stop': reply(await stopQueue()); break;
    case 'skip': reply(await skipCurrent()); break;
    case 'ack': await ackAds(m.seqs); reply({ ok: true }); break;
    case 'flush': {
      const out = (await get(OK)) || [];
      if ((await getMode()) === 'auto') out.forEach((e) => { try { port.postMessage(Object.assign({ evt: 'ads' }, e)); } catch (_) { /* gone */ } });
      reply({ ok: true, pending: adsIn(out) });
      break;
    }
    case 'send_now': reply(await sendNow()); break;
    case 'set_mode': reply(await setMode(m.mode)); break;
    default: reply({ ok: false, error: 'unknown' });
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'platform') return;
  ports.add(port);
  port.onDisconnect.addListener(() => { ports.delete(port); });
  port.onMessage.addListener((m) => { onPage(port, m).catch(() => {}); });
  const origin = port.sender && port.sender.origin;
  if (origin) set({ [PK]: origin });
  get(QK).then((q) => full(q)).then((st) => port.postMessage({ evt: 'hello', version: VERSION, state: st })).catch(() => {});
});

/* ---------- رسائل المُجمِّع (داخل فيسبوك) ونافذة الإضافة ---------- */
const COLLECTOR = new Set(['queue_check', 'ads', 'progress', 'job_done']);
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg.cmd !== 'string') return false;
  if (msg.cmd.indexOf('popup_') === 0) {                              // من نافذة الإضافة نفسها فقط
    if (sender.id !== chrome.runtime.id || sender.tab) return false;
    (async () => {
      switch (msg.cmd) {
        case 'popup_state': return full(await get(QK));
        case 'popup_stop': return stopQueue();
        case 'popup_skip': return skipCurrent();
        case 'popup_send': return sendNow();
        case 'popup_mode': return setMode(msg.mode);
        case 'popup_open': return openPlatform();
        case 'popup_discard': return discardPending();
        default: return { ok: false };
      }
    })().then(sendResponse).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (!COLLECTOR.has(msg.cmd)) return false;
  (async () => {
    let res = { ok: false }, cont = null;
    await locked(async () => {
      const q = await get(QK), tabId = sender.tab && sender.tab.id;
      const it = q && q.active ? q.items[q.idx] : null;
      const mine = !!(it && tabId === q.tabId);
      switch (msg.cmd) {
        case 'queue_check':
          res = mine && q.mode === 'queue' && urlQ(msg.href) === (it.key || it.q) ? { start: true, settings: q.settings, kind: it.kind || 'fb' } : { start: false };
          return;
        case 'ads':
          if (mine) await pushAds(msg, q);
          res = { ok: mine };
          return;
        case 'progress':
          if (mine) { it.seen = Number(msg.seen) || 0; if (+msg.total > (it.total || 0)) it.total = Math.floor(+msg.total); await set({ [QK]: q }); bc({ evt: 'progress', id: q.id, idx: q.idx, seen: it.seen, total: it.total || 0 }); }
          res = { ok: mine };
          return;
        case 'job_done':
          res = { ok: mine };
          if (mine) cont = await advance(q, msg.reason || 'done', Number(msg.seen) || 0);
          return;
      }
    });
    sendResponse(res);
    if (cont) cont();
  })().catch(() => { try { sendResponse({ ok: false }); } catch (_) { /* answered */ } });
  return true;
});

// حارس: بحث لم تردّ صفحته يُتخطى بعد سبع دقائق
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'wpr_watch') return;
  const cont = await locked(async () => {
    const q = await get(QK);
    if (!q || !q.active) return null;
    const it = q.items[q.idx];
    return it && it.startedAt && Date.now() - it.startedAt > itemLimit(q) ? advance(q, 'timeout') : null;
  });
  if (cont) cont();
});
