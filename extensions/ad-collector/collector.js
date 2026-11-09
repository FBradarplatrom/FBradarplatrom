// إضافة جمع الإعلانات – collector (isolated world) on facebook.com/ads/library/*.
// يعمل فقط عندما تأمره المنصة بالجمع: يمرّر الصفحة تلقائياً، ويلتقط الإعلانات من ردود الشبكة
// (والصفحة كاحتياط)، ويسلّمها كما هي تقريباً للخلفية ثم للمنصة. التطبيع والوسم والتصفية كلها في المنصة.
(() => {
  'use strict';
  if (window.__wprCollector) return;
  window.__wprCollector = true;

  const TAG = 'WPR_AD_MAIN';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const jitter = (ms) => Math.round(ms * (0.75 + Math.random() * 0.5));
  const send = (msg) => { try { return chrome.runtime.sendMessage(msg).catch(() => null); } catch (_) { return Promise.resolve(null); } };

  const SPEEDS = { slow: { step: 0.6, wait: 1800 }, normal: { step: 0.85, wait: 1100 }, fast: { step: 1.2, wait: 650 } };
  const run = { status: 'idle', token: 0, startedAt: 0 };
  let settings = { speed: 'normal', maxAds: 200, waitSeconds: 20, activeOnly: true };

  const seen = new Set();            // ids surfaced by THIS search
  let total = 0, sentTotal = 0;      // عدد النتائج الذي تعرضه مكتبة ميتا لهذا البحث («~220 نتيجة»)
  const sent = new Map();            // id -> signature of what was already handed over
  const early = [];                  // captured before the platform said "start" (kept in memory only)
  let pending = [], flushTimer = null, netCount = 0, lastNewAt = Date.now();

  /* ---------- search context ---------- */
  const params = () => { try { return new URLSearchParams(location.search); } catch (_) { return new URLSearchParams(); } };
  const queryLabel = () => { const p = params(); return p.get('q') || (p.get('view_all_page_id') ? 'page:' + p.get('view_all_page_id') : ''); };
  const countryParam = () => params().get('country') || '';

  /* ---------- hand-over ---------- */
  // Keep the structure Meta sent (so the server can normalise it and survive renames), but drop bulk.
  function prune(v, d) {
    if (v == null) return undefined;
    if (typeof v === 'string') return v.length > 3000 ? v.slice(0, 3000) : v;
    if (typeof v !== 'object') return v;
    if (d > 7) return undefined;
    if (Array.isArray(v)) return v.slice(0, 12).map((x) => prune(x, d + 1)).filter((x) => x !== undefined);
    const o = {};
    for (const k in v) { const x = prune(v[k], d + 1); if (x !== undefined && x !== '') o[k] = x; }
    return o;
  }

  function flush() {
    flushTimer = null;
    while (pending.length) {
      const chunk = pending.splice(0, 40);
      if (!total) domTotal();
      sentTotal = total;
      send({ cmd: 'ads', raw: chunk, href: location.href, ctx: { query: queryLabel(), country: countryParam(), total } });
    }
  }

  function ingest(list, src) {
    let added = 0;
    for (const raw of list) {
      if (!raw || raw.ad_archive_id == null) continue;
      if (settings.activeOnly && raw.is_active === false) continue;   // never guess: only an explicit "inactive" is dropped
      const id = String(raw.ad_archive_id);
      seen.add(id);
      const sig = [raw.collation_count, raw.is_active, raw.end_date, src].join('|');
      const prev = sent.get(id);
      if (prev === undefined) added++;
      if (prev === sig) continue;
      if (prev !== undefined && src === 'dom') continue;               // a page scrape never replaces what the network gave
      sent.set(id, sig);
      const p = prune(raw, 0);
      if (src === 'dom') p._src = 'dom';
      pending.push(p);
    }
    if (pending.length >= 25) flush(); else if (pending.length && !flushTimer) flushTimer = setTimeout(flush, 2500);
    if (added) lastNewAt = Date.now();
    return added;
  }
  function take(list, src) {
    if (run.status === 'running') return ingest(list, src);
    // not started (the person is just browsing the library): hold a little in memory, never send
    if (early.length < 400) list.forEach((r) => early.push([r, src]));
    return 0;
  }

  /* ---------- capture ---------- */
  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d.tag !== TAG || !Array.isArray(d.ads)) return;
    if (+d.total > total) total = +d.total;
    netCount += d.ads.length;
    take(d.ads, 'net');
  });

  function walkAds(root, out) {
    const stack = [root];
    while (stack.length) {
      const o = stack.pop();
      if (!o || typeof o !== 'object') continue;
      if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) stack.push(o[i]); continue; }
      if (o.ad_archive_id != null && o.snapshot && typeof o.snapshot === 'object') { out.push(o); continue; }
      const sr = o.search_results_connection; if (sr && typeof sr.count === 'number' && sr.count > total) total = sr.count;
      for (const k in o) { const v = o[k]; if (v && typeof v === 'object') stack.push(v); }
    }
  }
  // احتياط: قراءة «~220 نتيجة / ~220 results» من الصفحة نفسها
  // «~220 نتيجة» / «~220 results» / «environ 220 résultats»: علامات الاتجاه المخفية والأرقام العربية تُنظَّف أولاً
  const TOT_RE = /(?:^|[\s~≈])(?:about|environ|حوالي|نحو|около)?\s*~?\s*(\d[\d.,\s\u00a0\u202f\u066c]*)\s*(?:\+\s*)?(?:results?|résultats?|resultados|risultati|ergebnisse|resultaten|wyników|sonuç|hasil|kết quả|ผลลัพธ์|件|条结果|個結果|نتيجة|نتائج|نتيجه)/i;
  const BIDI = /[\u200e\u200f\u202a-\u202e\u2066-\u2069\u061c]/g;
  function domTotal() {
    try {
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let nd, k = 0;
      while ((nd = w.nextNode()) && k++ < 20000) {
        const t = (nd.nodeValue || '').replace(BIDI, '').trim(); if (!t || t.length > 60 || !/\d|[٠-٩]/.test(t)) continue;
        const m = TOT_RE.exec(' ' + t.replace(/[٠-٩]/g, (x) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(x))));
        if (m) { const n = parseInt(m[1].replace(/[^\d]/g, ''), 10); if (n > 0 && n < 1e7) { if (n > total) total = n; return; } }
      }
    } catch (_) { /* ignore */ }
  }
  function scanScripts() {
    const out = [];
    document.querySelectorAll('script[type="application/json"]').forEach((s) => {
      if (s.__wprDone) return;
      const t = s.textContent;
      if (t && t.indexOf('ad_archive_id') !== -1) { s.__wprDone = true; try { walkAds(JSON.parse(t), out); } catch (_) { /* ignore */ } }
    });
    if (out.length) { netCount += out.length; take(out, 'net'); }
  }
  let scans = 0;
  const scanTimer = setInterval(() => { scanScripts(); if (++scans > 30) clearInterval(scanTimer); }, 2000);
  document.addEventListener('DOMContentLoaded', scanScripts);

  /* ---------- page-reading fallback (lower fidelity, only if the network path gave nothing) ---------- */
  const ID_RE = /(?:id|identifiant|معرّ?ف)[^\d\n]{0,50}?(\d{12,20})/i;
  const META_LINE = /(library id|^id\b|identifiant|معرّ?ف|started running|début de diffusion|debut de diffusion|بدأ|sponsor|publicit|platforms|plateformes|المنصات|see ad details|voir les détails|عرض تفاصيل|^active$|^actif$|^inactive$|^inactif$|^نشط$|غير نشط|ouvrir|open dropdown)/i;
  const OWN_HOSTS = /(^|\.)(facebook\.com|fb\.com|instagram\.com|fbcdn\.net|whatsapp\.com|messenger\.com)$/;
  const CTA_RE = /shop now|order now|buy now|learn more|sign up|get offer|download|acheter|commander|en savoir plus|اطلب|اشتر|تسوق|المزيد|سجل/i;
  const MONTHS = { jan: 1, janv: 1, ene: 1, fev: 2, feb: 2, mar: 3, avr: 4, apr: 4, abr: 4, mai: 5, may: 5, jun: 6, juin: 6, juil: 7, jul: 7, aou: 8, aug: 8, ago: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12, dic: 12,
    'يناير': 1, 'فبراير': 2, 'مارس': 3, 'ابريل': 4, 'أبريل': 4, 'مايو': 5, 'يونيو': 6, 'يوليو': 7, 'اغسطس': 8, 'أغسطس': 8, 'سبتمبر': 9, 'اكتوبر': 10, 'أكتوبر': 10, 'نوفمبر': 11, 'ديسمبر': 12 };
  const strip = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function parseLooseDate(str) {
    const s = String(str || '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[.,]/g, ' ');
    const day = s.match(/\b(\d{1,2})\b/), year = s.match(/\b(20\d{2})\b/);
    if (!day || !year) return null;
    let month = null;
    for (const w of (s.match(/[\p{L}]+/gu) || [])) {
      const k = strip(w);
      const key = MONTHS[w] ? w : (MONTHS[k] ? k : (MONTHS[k.slice(0, 4)] ? k.slice(0, 4) : (MONTHS[k.slice(0, 3)] ? k.slice(0, 3) : null)));
      if (key) { month = MONTHS[key]; break; }
    }
    if (!month) return null;
    const ms = Date.UTC(+year[1], month - 1, +day[1]);
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
  }
  function unwrap(u) {
    try { const x = new URL(u); if (/(^|\.)l\.facebook\.com$/.test(x.hostname) && x.pathname.indexOf('/l.php') === 0) return x.searchParams.get('u') || u; } catch (_) { /* ignore */ }
    return u;
  }
  function containerOf(node) {
    let el = node.parentElement, best = null;
    for (let i = 0; i < 16 && el && el !== document.body; i++, el = el.parentElement) {
      const re = new RegExp(ID_RE.source, 'gi'), ids = new Set();
      let m; const t = el.innerText || '';
      while ((m = re.exec(t))) ids.add(m[1]);
      if (ids.size > 1) break;
      best = el;
    }
    return best;
  }
  function parseDomAd(id, el) {
    const text = el.innerText || '';
    const lines = text.split('\n').map((s) => s.trim()).filter(Boolean);
    const content = lines.filter((l) => l.length > 1 && !META_LINE.test(l));
    const rest = content.slice(1), long = rest.filter((l) => l.length > 25);
    const body = long.length ? long.join('\n') : (rest.sort((a, b) => b.length - a.length)[0] || '');
    let link = '';
    const anchors = Array.from(el.querySelectorAll('a[href]'));
    for (const a of anchors) if (/l\.facebook\.com\/l\.php/.test(a.href)) { link = unwrap(a.href); break; }
    if (!link) for (const a of anchors) { try { if (!OWN_HOSTS.test(new URL(a.href).hostname)) { link = a.href; break; } } catch (_) { /* skip */ } }
    let pageId = '';
    const pa = el.querySelector('a[href*="view_all_page_id="]');
    if (pa) { try { pageId = new URL(pa.href).searchParams.get('view_all_page_id') || ''; } catch (_) { /* skip */ } }
    const images = Array.from(el.querySelectorAll('img')).filter((i) => i.getBoundingClientRect().width >= 100).map((i) => i.currentSrc || i.src).filter((s) => /fbcdn|scontent/.test(s));
    el.querySelectorAll('video[poster]').forEach((v) => images.push(v.poster));
    let ctaText = '';
    for (const c of el.querySelectorAll('[role="button"], a, button')) { const t = (c.innerText || '').trim(); if (t && t.length <= 30 && !/\n/.test(t) && CTA_RE.test(t)) { ctaText = t; break; } }
    const dm = text.match(/(?:started running on|début de diffusion le|debut de diffusion le|بدأ عرضه في|comenzó a mostrarse el|veiculação iniciada em)\s*:?\s*([^\n·]+)/i);
    const dup = text.match(/(\d+)\s+(?:ads|annonces|إعلانات|anuncios|anúncios)\b/i);
    const inactive = /\b(inactive|inactif)\b|غير نشط/i.test(text), activeTxt = /\b(active|actif)\b|(^|\n)\s*نشط\s*($|\n)/i.test(text);
    return {
      ad_archive_id: id, page_id: pageId, page_name: content[0] || '', is_active: inactive ? false : (activeTxt ? true : undefined),
      start_date: dm ? parseLooseDate(dm[1]) : null, collation_count: dup ? Number(dup[1]) : 1, publisher_platform: [],
      snapshot: { body: { text: body }, cta_text: ctaText, link_url: link, display_format: el.querySelector('video') ? 'VIDEO' : 'IMAGE', images: images.map((u) => ({ resized_image_url: u })) }
    };
  }
  function domScan() {
    if (!document.body) return;
    const hits = [];
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.nodeValue && n.nodeValue.length < 120 && ID_RE.test(n.nodeValue)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
    let n;
    while ((n = tw.nextNode())) { const id = ID_RE.exec(n.nodeValue)[1]; if (!sent.has(id)) hits.push([id, n]); }
    const raws = [], done = new Set();
    for (const [id, node] of hits) {
      if (done.has(id)) continue;
      done.add(id);
      const el = containerOf(node);
      if (el) { try { raws.push(parseDomAd(id, el)); } catch (_) { /* skip */ } }
    }
    if (raws.length) take(raws, 'dom');
  }

  /* ---------- auto-scroll ---------- */
  const atBottom = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 200;
  function finish(reason) {
    if (run.status !== 'running') return;
    run.status = 'done';
    flush();
    domTotal();
    if (total && total !== sentTotal) { sentTotal = total; send({ cmd: 'ads', raw: [], href: location.href, ctx: { query: queryLabel(), country: countryParam(), total } }); }   // العدد وحده إن لم يُرسل بعد
    send({ cmd: 'job_done', href: location.href, reason, seen: seen.size, total });
  }

  // زر «عرض المزيد / See more» إن ظهر بدل التمرير اللانهائي
  function clickMore() {
    try {
      const re = /^(see more|show more|load more|voir plus|afficher plus|عرض المزيد|المزيد|ver más|mostrar más|ver mais|mehr anzeigen|lihat lainnya|xem thêm|顯示更多|查看更多)$/i;
      for (const b of document.querySelectorAll('div[role="button"], button, a[role="button"]')) {
        const t = (b.innerText || '').trim();
        if (t && t.length < 30 && re.test(t)) { b.click(); return true; }
      }
    } catch (_) { /* ignore */ }
    return false;
  }
  async function loop(token) {
    const sp = SPEEDS[settings.speed] || SPEEDS.normal;
    let tick = 0, lastNudge = 0, nudges = 0, lastNewSeen = lastNewAt;
    while (run.token === token && run.status === 'running') {
      if (settings.maxAds > 0 && seen.size >= settings.maxAds) { finish('max'); return; }
      window.scrollBy({ top: Math.round(window.innerHeight * sp.step), behavior: 'instant' });
      await sleep(jitter(sp.wait));
      tick++;
      if (netCount === 0 && Date.now() - run.startedAt > 5000 && tick % 3 === 0) domScan();
      const idleFor = (Date.now() - lastNewAt) / 1000;
      if (lastNewAt > lastNewSeen) { lastNewSeen = lastNewAt; nudges = 0; }
      // لا نتوقف عند أول بطء: فيسبوك تحمّل أبطأ كلما نزلنا. نتوقف فقط بعد مهلة الخمول ومحاولات إيقاظ متعددة بلا جديد
      if (idleFor >= settings.waitSeconds && nudges >= 4) { finish('idle'); return; }
      if (atBottom() && idleFor > 6 && Date.now() - lastNudge > 7000) {   // wiggle to re-trigger Facebook's infinite scroll
        lastNudge = Date.now(); nudges++;
        window.scrollBy({ top: -(600 + nudges * 400), behavior: 'instant' });
        await sleep(600 + nudges * 250);
        clickMore();
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
      }
      if (tick % 2 === 0) { if (!total) domTotal(); send({ cmd: 'progress', href: location.href, seen: seen.size, total }); }
    }
  }

  function start(s) {
    if (run.status === 'running') return;
    settings = Object.assign({}, settings, s || {});
    run.status = 'running';
    run.startedAt = Date.now();
    lastNewAt = Date.now();
    const token = ++run.token;
    scanScripts();
    for (const [raw, src] of early.splice(0)) ingest([raw], src);
    domTotal();
    send({ cmd: 'progress', href: location.href, seen: seen.size, total });
    loop(token);
  }

  // A queue opened this tab for one keyword: ask whether a job is waiting for it.
  send({ cmd: 'queue_check', href: location.href }).then((r) => {
    if (r && r.start) setTimeout(() => start(r.settings), 3000);   // let the first results render
  });

  chrome.runtime.onMessage.addListener((msg, _s, reply) => {
    switch (msg && msg.cmd) {
      case 'start': start(msg.settings); reply({ ok: true }); break;
      case 'stop': finish('manual'); reply({ ok: true }); break;
      case 'state': reply({ status: run.status, seen: seen.size }); break;
      default: return false;
    }
    return false;
  });
})();
