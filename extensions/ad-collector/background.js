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
  taobao: [/^https:\/\/s\.taobao\.com\/search\?/, 'q']
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
// تُحقن في صفحة السوق (دالة من الإضافة نفسها، لا شيفرة عن بُعد) وتضع صورة المنتج في «البحث بالصورة» كما يفعلها المستخدم.
// الطرق: file = خانة رفع ملف · drop = سحب وإفلات في منطقة «Drag an image here / 拖放文件到此处» · paste = لصق (Ctrl+V) في خانة البحث.
// skip = طرق جُرّبت قبلُ ولم تفتح النتائج (تجرّب خدمة الخلفية الطريقة التالية). بعد الرفع: تضغط زر «搜索 / Search» إن ظهر.
// تعيد الطريقة + وصفاً مختصراً للصفحة (للتشخيص). النجاح الفعلي (فتح صفحة النتائج) تتحقق منه خدمة الخلفية.
async function uploadToImageSearch(dataUrl, market, skip) {
  skip = skip || [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const bin = atob(dataUrl.split(',')[1]), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const type = (/^data:([^;]+)/.exec(dataUrl) || [])[1] || 'image/jpeg';
  const file = new File([u8], 'product.' + (type.split('/')[1] === 'jpeg' ? 'jpg' : type.split('/')[1]), { type });
  const dt = () => { const d = new DataTransfer(); d.items.add(file); return d; };
  // كل العناصر، بما فيها داخل Shadow DOM المفتوح (بعض الواجهات الحديثة)
  const all = (sel) => { const out = [], walk = (root) => { root.querySelectorAll(sel).forEach((x) => out.push(x)); root.querySelectorAll('*').forEach((x) => { if (x.shadowRoot) walk(x.shadowRoot); }); }; walk(document); return out; };
  const box = (el) => el.getBoundingClientRect();
  const seen = (el) => { const r = box(el); if (!r.width || !r.height) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity !== 0; };
  const text = (el) => (el.innerText || el.textContent || '').trim();
  const fileInput = () => all('input[type="file"]').find((i) => !i.disabled && (!i.accept || /image|jpe?g|png|webp|\*/i.test(i.accept)));
  const TXT = /以图搜|搜同款|拍立淘|图片搜索|按图搜|识图|search by image|image search|recherche par image|buscar por imagen|pesquisa por imagem|ricerca per immagine|bildersuche|البحث بالصورة|بحث بالصورة/i;
  const ATTR = /(pic|image|img|photo|picture)[-_ ]?(search|upload)|camera|imgsearch|picsearch|拍立淘|以图搜|search by image|image search/i;
  const UPL = /^(上传|上传图片|本地上传|点击上传|选择图片|upload( a)? (photo|image|file)|upload|importer( une)? (photo|image)|télécharger( une)? (photo|image)|subir( una)? (foto|imagen)|ارفع|رفع صورة|تحميل صورة)$/i;
  const GO = /^(搜索|搜同款|找同款|开始搜索|搜图|查找|确定|search|search now|rechercher|buscar|بحث|ابحث)$/i;
  const SEL = {
    ali: ['[class*="picSearch"]', '[class*="pic-search"]', '[class*="image-search"]', '[class*="imageSearch"]', '[class*="camera"]'],
    alibaba: ['[class*="image-search"]', '[class*="imageSearch"]', '[class*="img-search"]', '[class*="picture-search"]', '[class*="camera"]'],
    '1688': ['[class*="img-search"]', '[class*="image-search"]', '[class*="imageSearch"]', '[class*="pic-search"]', '[class*="camera"]'],
    taobao: ['[class*="image-search"]', '[class*="imgsearch"]', '[class*="imageSearch"]', '[class*="pailitao"]', '[class*="camera"]']
  }[market] || [];
  const attrs = (el) => { const c = typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || ''; return c + ' ' + (el.getAttribute('title') || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('alt') || ''); };
  const leaf = (els, re) => els.filter((el) => { const t = text(el); return t && t.length <= 30 && re.test(t) && ![...el.children].some((c) => re.test(text(c))); });
  const triggers = () => {
    const cand = all('button,a,[role="button"],span,div,label,i,img,svg').filter((el) => { if (!seen(el)) return false; const r = box(el); return r.top <= 520 && r.width <= 320 && r.height <= 120; });
    return [...new Set(SEL.flatMap((s) => all(s)).filter(seen).concat(leaf(cand, TXT), cand.filter((el) => ATTR.test(attrs(el)))))];
  };
  const buttonsLike = (re) => leaf(all('button,a,[role="button"],span,div,label').filter(seen), re);
  const giveFile = (inp) => { inp.files = dt().files; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); };
  const dropZone = () => all('div,section,label,form').filter((el) => seen(el) && /drag|drop (an |a |your )?(image|file|photo)|拖放|拖拽|拖到|glisse|dépose|arrastra|اسحب/i.test(text(el).slice(0, 200)) && box(el).width < 900)
    .sort((a, b) => box(a).width * box(a).height - box(b).width * box(b).height)[0];
  const dropOn = (el) => { const d = dt(), r = box(el), o = { bubbles: true, cancelable: true, composed: true, dataTransfer: d, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    ['dragenter', 'dragover', 'drop'].forEach((t) => el.dispatchEvent(new DragEvent(t, o))); };
  const searchBox = () => all('input[type="text"],input[type="search"],input:not([type]),textarea').filter((i) => seen(i) && box(i).top < 400).sort((a, b) => box(b).width - box(a).width)[0];
  const pasteIn = (el) => { el.focus(); el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, composed: true, clipboardData: dt() })); };
  const click = (el) => { try { (el.closest('button,a,[role="button"]') || el).click(); } catch (_) { /* ignore */ } };
  const desc = (el) => (el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '.' + attrs(el).trim().slice(0, 50) + ' «' + text(el).slice(0, 20) + '»').replace(/\s+/g, ' ');
  const tried = [];
  const diag = () => ({ url: location.href.slice(0, 160), title: document.title.slice(0, 60), inputs: all('input[type="file"]').length, skip, tried, triggers: triggers().slice(0, 6).map(desc), drop: !!dropZone(), search: !!searchBox() });
  // بعد وضع الصورة: بعض المواقع تعرض معاينة وزر «搜索 / Search» للتأكيد
  // (فقط زر ظهر بعد بدء العملية: زر البحث بالكلمة الأصلي في الصفحة لا يُضغط أبداً)
  let pre = null;
  const confirm = async () => { await sleep(1500); const b = buttonsLike(GO).filter((el) => !pre.has(el) && box(el).top > 0).slice(-1)[0]; if (b) { tried.push('confirm ' + desc(b)); click(b); } };
  // ما يمكن فعله الآن دون ضغط أي زر (الطريقة التي لم تُجرَّب بعد)
  const tryNow = async () => {
    if (!skip.includes('file')) { let inp = fileInput();
      if (!inp) for (const u of buttonsLike(UPL).slice(0, 2)) { tried.push('upload ' + desc(u)); click(u); await sleep(400); inp = fileInput(); if (inp) break; }   // زر «上传 / Upload a photo» يُنشئ الخانة
      if (inp) { giveFile(inp); await confirm(); return 'file'; } }
    if (!skip.includes('drop')) { const z = dropZone(); if (z) { dropOn(z); await confirm(); return 'drop'; } }
    return '';
  };
  // الواجهة الثقيلة تُبنى بعد التحميل: ننتظر ظهور زر البحث بالصورة (حتى 8 ثوانٍ)
  for (let i = 0; i < 16 && !fileInput() && !triggers().length; i++) await sleep(500);
  pre = new Set(buttonsLike(GO));
  let how = await tryNow();
  if (how) return { how, diag: diag() };
  for (let round = 0; round < 2 && !how; round++) {
    for (const t of triggers().slice(0, 6)) {
      tried.push(desc(t)); click(t);
      for (let k = 0; k < 6 && !how; k++) { await sleep(300); if (fileInput() || dropZone() || buttonsLike(UPL).length) how = await tryNow(); }
      if (how) break;
    }
    if (!how) await sleep(1200);
  }
  if (!how && !skip.includes('paste') && (market === 'ali' || market === '1688')) { const s = searchBox(); if (s) { pasteIn(s); how = 'paste'; } }
  return { how, diag: diag() };
}
// لوحة داخل صفحة السوق عند عدم اكتمال البحث: الصورة (تُسحب إلى أيقونة الكاميرا) + حفظها + نسخ تقرير للدعم
function showImagePanel(dataUrl, lang, reason, report) {
  const T = {
    ar: { login: 'هذا السوق يطلب تسجيل الدخول. سجّل دخولك ثم ارجع إلى المنصة وأعد البحث بالصورة.', other: 'لم يكتمل البحث بالصورة تلقائياً. اضغط أيقونة الكاميرا 📷 في خانة البحث وارفع هذه الصورة (أو اسحبها إليها).', save: '⬇ حفظ الصورة', copy: '📋 نسخ تقرير للدعم', copied: '✓ نُسخ التقرير', head: 'صورة المنتج من رادار المنتجات الرابحة' },
    fr: { login: 'Ce site demande une connexion. Connectez-vous puis relancez la recherche par image depuis la plateforme.', other: 'La recherche par image ne s’est pas terminée seule. Cliquez sur l’icône appareil photo 📷 et importez cette image (ou glissez-la).', save: '⬇ Enregistrer l’image', copy: '📋 Copier le rapport', copied: '✓ Rapport copié', head: 'Photo du produit (Radar)' },
    en: { login: 'This site asks you to log in. Log in, then run the image search again from the platform.', other: 'The image search did not finish by itself. Click the camera icon 📷 in the search box and upload this image (or drag it there).', save: '⬇ Save image', copy: '📋 Copy report for support', copied: '✓ Report copied', head: 'Product photo from Winning Product Radar' }
  }[lang] || {};
  const old = document.getElementById('wpr-img-panel'); if (old) old.remove();
  const p = document.createElement('div'); p.id = 'wpr-img-panel';
  p.setAttribute('style', 'position:fixed;z-index:2147483647;top:16px;right:16px;width:260px;background:#fff;color:#111;border:2px solid #15803d;border-radius:14px;padding:12px;font:14px/1.5 system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.25);direction:' + (lang === 'ar' ? 'rtl' : 'ltr'));
  const h = document.createElement('b'); h.textContent = T.head; h.setAttribute('style', 'display:block;margin-bottom:6px');
  const im = document.createElement('img'); im.src = dataUrl; im.draggable = true; im.setAttribute('style', 'width:100%;border-radius:10px;display:block;margin-bottom:8px;cursor:grab');
  const tx = document.createElement('div'); tx.textContent = reason === 'login' ? T.login : T.other;
  const row = document.createElement('div'); row.setAttribute('style', 'display:flex;gap:10px;flex-wrap:wrap;margin-top:8px');
  const a = document.createElement('a'); a.href = dataUrl; a.download = 'product.jpg'; a.textContent = T.save; a.setAttribute('style', 'color:#15803d;font-weight:700');
  const c = document.createElement('button'); c.textContent = T.copy; c.setAttribute('style', 'border:0;background:none;color:#15803d;font:inherit;font-weight:700;cursor:pointer;padding:0');
  c.onclick = () => { navigator.clipboard.writeText(report).then(() => { c.textContent = T.copied; }).catch(() => { prompt('', report); }); };
  const x = document.createElement('button'); x.textContent = '×'; x.setAttribute('style', 'position:absolute;top:4px;' + (lang === 'ar' ? 'left' : 'right') + ':8px;border:0;background:none;font-size:20px;cursor:pointer'); x.onclick = () => p.remove();
  row.append(a, c); p.append(x, h, im, tx, row); document.documentElement.appendChild(p);
}
// صفحة دخول (السوق حوّل إليها لأن البحث بالصورة يتطلب حساباً)
const LOGIN_RE = /^https:\/\/(login|passport|signin|account)\.|\/(login|signin|newlogin|member\/signin)[^/]*(\?|$)/i;
async function imageSearch(m) {
  const home = IMG_HOME[m.market];
  if (!home) return { ok: false, error: 'market' };
  const img = String(m.image || '');
  if (img.length > 4e6 || !IMG_RE.test(img)) return { ok: false, error: 'image' };
  let tab;
  try { tab = await chrome.tabs.create({ url: home, active: true }); } catch (_) { return { ok: false, error: 'tab' }; }
  const lang = ['ar', 'fr', 'en'].includes(await get('uiLang')) ? await get('uiLang') : 'ar';
  const urlOf = async () => ((await chrome.tabs.get(tab.id).catch(() => null)) || {}).url || '';
  const panel = async (reason, rep) => { try { await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: showImagePanel, args: [img, lang, reason, rep] }); } catch (_) { /* ignore */ } };
  const report = (o) => JSON.stringify(Object.assign({ v: VERSION, market: m.market, at: new Date().toISOString() }, o));
  await tabReady(tab.id, 30000);
  await sleep(1500);                                                     // واجهة السوق تُبنى بعد التحميل
  const before = await urlOf();
  if (LOGIN_RE.test(before)) { await panel('login', report({ error: 'login', url: before })); return { ok: false, error: 'login', market: m.market }; }
  // النجاح الحقيقي: صفحة النتائج تُفتح (في نفس التبويب أو تبويب جديد كما في 1688)
  const kids = []; const onNew = (t) => { if (t.openerTabId === tab.id) kids.push(t.id); };
  chrome.tabs.onCreated.addListener(onNew);
  // حتى 3 محاولات: إن لم تفتح الطريقة النتائج تُجرَّب التالية (خانة الرفع ← السحب والإفلات ← اللصق)
  let out = null, after = before; const used = [], hist = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    try { const r = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: uploadToImageSearch, args: [img, m.market, used] }); out = (r && r[0] && r[0].result) || null; } catch (_) { out = null; }
    after = await urlOf();
    for (let i = 0; i < 14 && after === before && !kids.length && (!out || out.how); i++) { await sleep(500); after = await urlOf(); }
    if (after !== before || kids.length || !out || !out.how) break;
    used.push(out.how); hist.push(out.diag);
  }
  chrome.tabs.onCreated.removeListener(onNew);
  const moved = !!after && after !== before;
  if (moved && LOGIN_RE.test(after)) { await panel('login', report({ error: 'login', url: after })); return { ok: false, error: 'login', market: m.market }; }
  if (moved || kids.length) return { ok: true, market: m.market, how: (out && out.how) || 'navigated', result: kids.length ? 'new_tab' : 'same_tab' };
  const error = !out ? 'inject' : out.how || used.length ? 'no_effect' : 'no_input';
  await panel(error, report({ error, how: out && out.how, used, diag: out && out.diag, earlier: hist }));
  return { ok: false, error, market: m.market };
}
// حالة تسجيل الدخول في أسواق المورّدين (وجود كعكة الجلسة فقط، دون قراءة قيمتها أو إرسالها)
const MK_LOGIN = { taobao: ['https://www.taobao.com', ['unb', '_nk_']], '1688': ['https://www.1688.com', ['__cn_logon__', 'unb']], alibaba: ['https://www.alibaba.com', ['xman_us_t']], ali: ['https://www.aliexpress.com', ['xman_us_t']] };
async function marketStatus() {
  const out = {};
  for (const [k, [url, names]] of Object.entries(MK_LOGIN)) {
    let on = false;
    for (const name of names) { try { const c = await chrome.cookies.get({ url, name }); if (c && c.value && c.value !== 'false') { on = true; break; } } catch (_) { /* ignore */ } }
    out[k] = on;
  }
  return out;
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
    case 'mk_status': reply({ ok: true, status: await marketStatus() }); break;
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
