'use strict';
// أدوات المنتج والأقسام الجديدة (10.0):
//  • إيجاد المورّد: نتائج بحث AliExpress التي تجمعها الإضافة لكل منتج، ومطابقتها بالصورة تتم في المتصفح.
//  • تحليل الإعلان بالذكاء الاصطناعي: زاوية البيع، الجمهور، نقاط القوة والضعف، ونص إعلان جزائري مقترح.
//  • Google Sheets: إرسال مباشر إلى جدولك عبر Google Apps Script (بلا حساب Google في المنصة).
//  • مراقبة صفحات المنافسين: إعادة جمع إعلانات صفحة ومعرفة الجديد والمتوقف.
//  • TikTok: نتائج البحث بالعبارات الشائعة (tiktok made me buy it ...) مرتبة بالتفاعل.
const C = require('./core.js'), AI = require('./ai.js'), LIM = require('./limits.js'), NT = require('./notify.js'), MK = require('./lib/markets.js');
const WEEK = 7 * 864e5;

module.exports = function mountTools(app, X) {
  const { db, auth, active, wrap, now, imgData } = X;
  const bad = (m, code) => Object.assign(new Error(m), { status: code || 400 });
  const J = (s, d) => { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } };
  const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

  db.exec(`
create table if not exists user_kv(user_id integer, k text, v text, primary key(user_id, k));
create table if not exists sup_results(user_id integer, k text, q text, items text, updated_at integer, primary key(user_id, k));
create table if not exists ai_cache(user_id integer, k text, kind text, data text, created_at integer, primary key(user_id, k, kind));
create table if not exists watch_pages(id integer primary key, user_id integer, page_id text, name text, note text, created_at integer, last_scan_at integer, next_check_at integer, stats text, seen_new integer default 0, unique(user_id, page_id));
create table if not exists watch_ads(watch_id integer, ad_id text, row text, first_seen integer, last_seen integer, active integer, primary key(watch_id, ad_id));
create table if not exists watch_scans(id integer primary key, watch_id integer, user_id integer, started_at integer, finished_at integer, seen text, new_count integer default 0);
create table if not exists tt_runs(id integer primary key, user_id integer, label text, phrases text, created_at integer, count integer default 0);
create table if not exists tt_items(run_id integer, vid text, q text, row text, primary key(run_id, vid));`);
  // سجل كل فحص: الإعلانات التي ظهرت لأول مرة فيه، والتي توقفت، وأرقامه (لعرض الفحص الأول والذي بعده بوضوح)
  ['added text', 'gone text', 'stats text'].forEach(c => { try { db.exec('alter table watch_scans add column ' + c); } catch (e) {} });
  const kvGet = (u, k, d) => { const r = db.prepare('select v from user_kv where user_id=? and k=?').get(u, k); return r ? J(r.v, d) : d; };
  const kvSet = (u, k, v) => db.prepare('insert into user_kv(user_id,k,v) values(?,?,?) on conflict(user_id,k) do update set v=excluded.v').run(u, k, JSON.stringify(v));

  /* ================= إيجاد المورّد ================= */
  const cleanSup = it => ({
    id: str(it && it.id, 24).replace(/\D/g, ''), title: str(it.title, 300), img: /^https?:\/\//.test(it.img || '') ? str(it.img, 600) : '', price: str(it.price, 40), currency: str(it.currency, 4),
    sold: str(it.sold, 40), rating: str(it.rating, 6), moq: str(it.moq, 40), shop: str(it.shop, 80),
    market: ['ali', 'alibaba', '1688', 'taobao'].includes(it.market) ? it.market : 'ali',
    url: /^https:\/\/([a-z0-9-]+\.)*(aliexpress\.(com|us)|alibaba\.com|1688\.com|taobao\.com|tmall\.com)\//.test(it.url || '') ? str(it.url, 400) : ''
  });
  app.get('/api/sup', auth, active, wrap((q, s) => {
    const r = db.prepare('select q,items,updated_at from sup_results where user_id=? and k=?').get(q.u.id, str(q.query.k, 300));
    s.json(r ? { q: r.q, items: J(r.items, []), updated_at: r.updated_at } : { q: '', items: [] });
  }));
  app.post('/api/sup/ingest', auth, active, wrap((q, s) => {
    const b = q.body || {}, k = str(b.k, 300); if (!k) throw bad('k');
    const old = db.prepare('select items from sup_results where user_id=? and k=?').get(q.u.id, k), map = new Map((old && b.reset !== true ? J(old.items, []) : []).map(x => [x.id, x]));
    for (const it of (Array.isArray(b.items) ? b.items : []).slice(0, 200)) { const c = cleanSup(it || {}); if (c.id && (c.title || c.img)) map.set(c.market + ':' + c.id, Object.assign(map.get(c.market + ':' + c.id) || {}, c)); }
    const items = [...map.values()].slice(0, 500);
    db.prepare('insert into sup_results(user_id,k,q,items,updated_at) values(?,?,?,?,?) on conflict(user_id,k) do update set q=excluded.q, items=excluded.items, updated_at=excluded.updated_at').run(q.u.id, k, str(b.q, 120), JSON.stringify(items), now());
    s.json({ count: items.length });
  }));
  // تشابه الصورة المحسوب في المتصفح يُحفظ مع النتائج
  app.post('/api/sup/rank', auth, active, wrap((q, s) => {
    const b = q.body || {}, k = str(b.k, 300), r = db.prepare('select items from sup_results where user_id=? and k=?').get(q.u.id, k); if (!r) throw bad('غير موجود', 404);
    const sim = new Map((Array.isArray(b.ranked) ? b.ranked : []).map(x => [String(x.market || 'ali') + ':' + x.id, num(x.sim)]));
    const items = J(r.items, []).map(x => { const k2 = (x.market || 'ali') + ':' + x.id; return sim.has(k2) ? Object.assign(x, { sim: sim.get(k2) }) : x; });
    db.prepare('update sup_results set items=? where user_id=? and k=?').run(JSON.stringify(items), q.u.id, k); s.json({ ok: 1 });
  }));
  // تحديد المنتج بدقة: الذكاء الاصطناعي يرى صورة المنتج نفسها + نصوص الإعلان، ويكتب عبارة إنجليزية (AliExpress/Alibaba) وصينية مبسطة (1688/Taobao/Pinduoduo)
  app.post('/api/sup/query', auth, active, (q, s, n) => {
    const b = q.body || {}, name = str(b.name, 200), kw = str(b.kw, 120), texts = (Array.isArray(b.texts) ? b.texts : []).map(t => str(t, 500)).slice(0, 3);
    const latin = [kw, name].find(x => x && /[a-z]{3}/i.test(x) && !/[\u0600-\u06FF]/.test(x)) || '';
    const simple = latin.toLowerCase().replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 6).join(' ');
    if (!AI.enabled()) return s.json({ q: simple, zh: '', ai: false });
    try { LIM.useAI(q.u); } catch (e) { return s.json({ q: simple, zh: '', ai: false, limit: e.message }); }
    const img = (Array.isArray(b.images) ? b.images : [])[0] || '';
    (async () => {
      const data = img && imgData ? await imgData(img).catch(() => '') : '';
      const prompt = 'Identify this exact product (look at the photo first, then the ad text) so a buyer can find the SAME item from Chinese suppliers. Return ONLY JSON ' +
        '{"product":"short English name","q":"English search query for AliExpress/Alibaba, 3-7 words: product type + the 2-3 features that make it this exact item (shape, material, mechanism), no brand, no marketing words","zh":"the same query in Simplified Chinese as a 1688/Taobao seller would title it, 4-12 characters","features":["visual details to recognise it"]}' +
        '\nAd name: ' + name + '\nKeyword: ' + kw + '\nAd text:\n' + texts.join('\n---\n');
      const user = data ? [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: data, detail: 'low' } }] : prompt;
      const r = await AI.chatJSON('You are an expert product sourcing agent for Chinese marketplaces (AliExpress, Alibaba, 1688, Taobao).', user, { timeout: 40000 });
      const d = r.data || {};
      s.json({ q: str(d.q, 90).toLowerCase() || simple, zh: str(d.zh, 40), product: str(d.product, 80), features: (d.features || []).map(x => str(x, 60)).slice(0, 6), vision: !!data, ai: true });
    })().catch(e => { LIM.refundAI(q.u.id); n(e); });   // فشل المزوّد: لا يُحتسب من الرصيد
  });

  /* ================= تحليل الإعلان بالذكاء الاصطناعي ================= */
  app.get('/api/ai/ad', auth, active, wrap((q, s) => { const r = db.prepare("select data,created_at from ai_cache where user_id=? and k=? and kind='ad'").get(q.u.id, str(q.query.k, 300)); s.json(r ? { data: J(r.data, null), created_at: r.created_at } : { data: null, ai: AI.enabled() }); }));
  app.post('/api/ai/ad', auth, active, (q, s, n) => {
    const b = q.body || {}, k = str(b.k, 300), p = b.p || {};
    if (!k) return n(bad('k'));
    if (!AI.enabled()) return n(bad('الذكاء الاصطناعي غير مفعّل: أضف المفتاح من «الربط والتكامل»', 400));
    try { LIM.useAI(q.u); } catch (e) { return n(e); }
    const texts = (Array.isArray(p.texts) ? p.texts : []).map(t => str(t, 900)).slice(0, 5);
    const facts = { name: str(p.name, 200), market: str(p.market, 3), price: str(p.price, 40), category: str(p.cat, 10), score: num(p.score), days_running: num(p.days), sellers: num(p.n), copies: num(p.copies), benefit_tags: (p.tags || []).map(t => str(t, 80)).slice(0, 3) };
    // سوق المشترك المستهدف (نفس اختيار «ثغرات السوق»، الجزائر افتراضياً): العرض ونصوص الإعلان بلغاته
    let tgt = 'DZ'; try { const c = JSON.parse((db.prepare("select v from user_kv where user_id=? and k='gap_target'").get(q.u.id) || {}).v || '"DZ"'); if (MK.COUNTRIES[c] && c !== 'ALL') tgt = c; } catch (e) {}
    let country = tgt; try { country = new Intl.DisplayNames(['en'], { type: 'region' }).of(tgt); } catch (e) {}
    const langs = MK.langsOf(tgt).filter(l => l !== 'arz').slice(0, 3), copyT = {}; langs.forEach(l => { copyT[l] = 'ad text in ' + ((MK.LANGS[l] || {}).native || l); });
    const sys = 'You are a senior e-commerce ad strategist for the ' + country + ' market. You analyse a winning ad seen on Facebook (possibly from another country) and explain WHY it sells and HOW to sell the same product in ' + country + '. ' +
      'Never invent facts about the product (specs, certifications, reviews) that are not in the ad text; say "غير مذكور" when unknown. Answer in Arabic (Modern Standard), except the ad copies. Return ONLY JSON.';
    const user = 'Facts: ' + JSON.stringify(facts) + '\nAd texts:\n' + texts.join('\n---\n') +
      '\n\nReturn JSON: {"summary":"جملتان","product":"ما هو المنتج بالضبط","angle":"زاوية البيع الرئيسية","audience":"الجمهور المستهدف (العمر، الجنس، الاهتمامات)","pains":["المشكلة التي يحلها"],"strengths":["نقاط قوة الإعلان"],"weaknesses":["نقاط ضعف أو مخاطر"],"hooks":["3 افتتاحيات (أول 3 ثوانٍ) لفيديو"],"offer":"عرض مقترح لهذا السوق (كمية/هدية/توصيل)","price_hint":"ملاحظة سعرية إن أمكن","algeria_fit":"مدى ملاءمته لهذا السوق ولماذا","ad_copy":' + JSON.stringify(copyT) + '}';
    AI.chatJSON(sys, user, { timeout: 40000 }).then(r => {
      const d = Object.assign(r.data || {}, { market: tgt });
      db.prepare("insert into ai_cache(user_id,k,kind,data,created_at) values(?,?,'ad',?,?) on conflict(user_id,k,kind) do update set data=excluded.data, created_at=excluded.created_at").run(q.u.id, k, JSON.stringify(d), now());
      s.json({ data: d, created_at: now() });
    }).catch(e => { LIM.refundAI(q.u.id); n(e); });
  });

  /* ================= Google Sheets ================= */
  const SHEET_RE = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]{20,}\/exec$/;
  const TEST_SHEET = process.env.NODE_ENV === 'test' && process.env.SHEETS_TEST_PREFIX;   // للاختبارات الآلية فقط
  const sheetOk = u => SHEET_RE.test(u) || !!(TEST_SHEET && u.startsWith(TEST_SHEET));
  app.get('/api/sheets', auth, active, wrap((q, s) => { const c = kvGet(q.u.id, 'sheets', {}); s.json({ url: c.url || '', token: c.token || '' }); }));
  app.put('/api/sheets', auth, active, wrap((q, s) => {
    const url = str(q.body && q.body.url, 300), token = str(q.body && q.body.token, 80);
    if (url && !sheetOk(url)) throw bad('الرابط يجب أن يكون رابط تطبيق ويب من Google Apps Script وينتهي بـ /exec');
    kvSet(q.u.id, 'sheets', { url, token }); s.json({ ok: 1 });
  }));
  app.post('/api/sheets/push', auth, active, (q, s, n) => {
    const c = kvGet(q.u.id, 'sheets', {}), b = q.body || {};
    if (!c.url) return n(bad('اربط جدول Google أولاً من «الإعدادات»'));
    const header = (Array.isArray(b.header) ? b.header : []).map(x => str(x, 80)).slice(0, 40);
    const rows = (Array.isArray(b.rows) ? b.rows : []).slice(0, 5000).map(r => (Array.isArray(r) ? r : []).slice(0, 40).map(x => (typeof x === 'number' ? x : str(x, 2000))));
    if (!rows.length) return n(bad('لا صفوف للإرسال'));
    fetch(c.url, { method: 'POST', redirect: 'follow', signal: AbortSignal.timeout(30000), headers: { 'content-type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: c.token || '', sheet: str(b.sheet, 60) || 'رادار', header, rows }) })
      .then(r => r.text().then(t => ({ ok: r.ok, t })))
      .then(({ ok, t }) => { const j = J(t, null); if (!ok || !j || !j.ok) throw bad('رد Google: ' + ((j && j.error) || t.slice(0, 160) || 'غير مفهوم'), 502); s.json({ ok: 1, count: j.count || rows.length, url: j.url || '' }); })
      .catch(e => n(e.status ? e : bad('تعذّر الوصول إلى Google: ' + e.message, 502)));
  });

  /* ================= مراقبة صفحات المنافسين ================= */
  const wOwn = (u, id) => { const w = db.prepare('select * from watch_pages where id=? and user_id=?').get(+id, u); if (!w) throw bad('غير موجود', 404); return w; };
  const wView = w => ({ id: w.id, page_id: w.page_id, name: w.name, note: w.note || '', created_at: w.created_at, last_scan_at: w.last_scan_at, next_check_at: w.next_check_at, stats: J(w.stats, {}), seen_new: w.seen_new, due: !!(w.next_check_at && w.next_check_at <= now()) });
  app.get('/api/watch', auth, active, wrap((q, s) => { const ws = db.prepare('select * from watch_pages where user_id=? order by created_at desc').all(q.u.id).map(wView); s.json({ pages: ws, due: ws.filter(w => w.due).length, unseen: ws.reduce((a, w) => a + (w.seen_new || 0), 0) }); }));
  app.post('/api/watch', auth, active, wrap((q, s) => {
    const b = q.body || {}; let pid = str(b.page_id || b.url, 400);
    const m = /view_all_page_id=(\d{5,})/.exec(pid) || /[?&]id=(\d{5,})/.exec(pid) || /^(\d{5,})$/.exec(pid); if (!m) throw bad('أدخل معرّف الصفحة (أرقام) أو رابط مكتبة الإعلانات الذي فيه view_all_page_id');
    pid = m[1];
    const ex = db.prepare('select id from watch_pages where user_id=? and page_id=?').get(q.u.id, pid); if (ex) return s.json({ id: ex.id, existed: true });
    LIM.check(q.u, 'watchPages', db.prepare('select count(*) n from watch_pages where user_id=?').get(q.u.id).n);
    const id = db.prepare('insert into watch_pages(user_id,page_id,name,note,created_at,stats) values(?,?,?,?,?,?)').run(q.u.id, pid, str(b.name, 120) || 'صفحة ' + pid, str(b.note, 300), now(), '{}').lastInsertRowid;
    s.json({ id: Number(id) });
  }));
  app.delete('/api/watch/:id', auth, active, wrap((q, s) => { const w = wOwn(q.u.id, q.params.id); ['watch_ads', 'watch_scans'].forEach(t => db.prepare(`delete from ${t} where watch_id=?`).run(w.id)); db.prepare('delete from watch_pages where id=?').run(w.id); s.json({ ok: 1 }); }));
  app.get('/api/watch/:id', auth, active, wrap((q, s) => {
    const w = wOwn(q.u.id, q.params.id);
    // سجل الفحوص المكتملة (الأقدم أولاً): رقم الفحص، تاريخه، ما ظهر فيه لأول مرة وما توقف
    const sc = db.prepare('select id,started_at,finished_at,new_count,added,gone,stats,seen from watch_scans where watch_id=? and finished_at is not null order by id').all(w.id);
    const firstIn = new Map(), goneIn = new Map();
    const scans = sc.map((x, i) => {
      const st = J(x.stats, null), add = J(x.added, null), gn = J(x.gone, []), n = i + 1;
      (add || []).forEach(id => { if (!firstIn.has(id)) firstIn.set(id, n); }); gn.forEach(id => goneIn.set(id, n));
      return { n, id: x.id, at: x.finished_at, started: x.started_at, first: i === 0, scanned: st ? st.scanned : J(x.seen, []).length, new: i === 0 ? 0 : (st ? st.new : x.new_count), found: i === 0 ? (add ? add.length : x.new_count) : undefined,
        stopped: st ? st.stopped : 0, active: st ? st.active : null, total: st ? st.total : null, complete: st ? st.complete !== false : true, _add: !add };
    });
    // فحوص قديمة بلا قائمة «added»: الفحص الذي ظهر فيه الإعلان أول مرة يُستنتج من تاريخه
    const scanOf = t => { for (const x of sc) if (t <= x.finished_at) return sc.indexOf(x) + 1; return sc.length || 1; };
    const last = scans.length ? scans[scans.length - 1].n : 0;
    const ads = db.prepare('select ad_id,row,first_seen,last_seen,active from watch_ads where watch_id=? order by first_seen desc, ad_id desc limit 2000').all(w.id)
      .map(a => { const f = firstIn.get(a.ad_id) || scanOf(a.first_seen); return Object.assign(J(a.row, {}), { _first: a.first_seen, _last: a.last_seen, _active: !!a.active, _scan: f, _gone: goneIn.get(a.ad_id) || 0, _new: last > 1 && f === last }); });
    db.prepare('update watch_pages set seen_new=0 where id=?').run(w.id);
    s.json(Object.assign(wView(w), { ads, scans: scans.map(x => { delete x._add; return x; }) }));
  }));
  app.post('/api/watch/:id/scan', auth, active, wrap((q, s) => { const w = wOwn(q.u.id, q.params.id); const id = db.prepare('insert into watch_scans(watch_id,user_id,started_at,seen) values(?,?,?,?)').run(w.id, q.u.id, now(), '[]').lastInsertRowid; s.json({ scan: Number(id) }); }));
  app.post('/api/watch/:id/ingest', auth, active, wrap((q, s) => {
    const w = wOwn(q.u.id, q.params.id), b = q.body || {}, sc = db.prepare('select * from watch_scans where id=? and watch_id=?').get(+b.scan, w.id); if (!sc) throw bad('scan', 404);
    const seen = new Set(J(sc.seen, [])), added = J(sc.added, []), t = now(); let n = 0, name = '';
    const get = db.prepare('select first_seen from watch_ads where watch_id=? and ad_id=?'), put = db.prepare('insert into watch_ads(watch_id,ad_id,row,first_seen,last_seen,active) values(?,?,?,?,?,?) on conflict(watch_id,ad_id) do update set row=excluded.row, last_seen=excluded.last_seen, active=excluded.active');
    for (const raw of (Array.isArray(b.ads) ? b.ads : []).slice(0, 400)) {
      let r = null; try { r = C.rowFromRaw(raw, { query: 'page:' + w.page_id, niche: '', country: '', src: 'net' }, t); } catch (e) {} if (!r) continue;
      if (r.page_id && r.page_id !== w.page_id) continue;                    // إعلانات صفحة أخرى ظهرت في الصفحة: لا تُحسب
      name = name || r.page_name; seen.add(r.ad_id);
      const old = get.get(w.id, r.ad_id); if (!old) { n++; added.push(r.ad_id); }
      put.run(w.id, r.ad_id, JSON.stringify(r), old ? old.first_seen : t, t, r.status === 'inactive' ? 0 : 1);
    }
    db.prepare('update watch_scans set seen=?, added=?, new_count=new_count+? where id=?').run(JSON.stringify([...seen]), JSON.stringify(added.slice(0, 2000)), n, sc.id);
    if (name && /^صفحة \d+$/.test(w.name)) db.prepare('update watch_pages set name=? where id=?').run(str(name, 120), w.id);
    s.json({ scanned: seen.size, added: n });
  }));
  app.post('/api/watch/:id/finish', auth, active, wrap((q, s) => {
    const w = wOwn(q.u.id, q.params.id), b = q.body || {}, sc = db.prepare('select * from watch_scans where id=? and watch_id=?').get(+b.scan, w.id); if (!sc) throw bad('scan', 404);
    const first = !w.last_scan_at, seen = new Set(J(sc.seen, [])), t = now();
    // إعلان كان نشطاً ولم يعد يظهر = متوقف
    let stopped = 0; const gone = []; if (b.complete) for (const a of db.prepare('select ad_id from watch_ads where watch_id=? and active=1').all(w.id)) if (!seen.has(a.ad_id) && seen.size) { db.prepare('update watch_ads set active=0 where watch_id=? and ad_id=?').run(w.id, a.ad_id); stopped++; gone.push(a.ad_id); }
    const tot = db.prepare('select count(*) n, sum(active) a from watch_ads where watch_id=?').get(w.id);
    const stats = { scanned: seen.size, total: tot.n, active: tot.a || 0, new: first ? 0 : sc.new_count, stopped, first };
    db.prepare('update watch_scans set finished_at=?, gone=?, stats=? where id=?').run(t, JSON.stringify(gone), JSON.stringify(Object.assign({ complete: !!b.complete }, stats)), sc.id);
    db.prepare('update watch_pages set last_scan_at=?, next_check_at=?, stats=?, seen_new=seen_new+? where id=?').run(t, t + WEEK, JSON.stringify(stats), first ? 0 : sc.new_count, w.id);
    if (!first && sc.new_count > 0) NT.fire(q.u.id, 'watch', '👁 ' + sc.new_count + ' إعلان جديد لصفحة «' + (w.name || w.page_id) + '»: منتجات يختبرونها الآن.', '/watch/' + w.id);
    s.json(Object.assign(wView(wOwn(q.u.id, w.id)), { stats }));
  }));

  /* ================= TikTok ================= */
  const cleanTT = o => ({
    id: str(o && o.id, 30).replace(/\D/g, ''), desc: str(o.desc, 1500), author: str(o.author, 60), nickname: str(o.nickname, 80), followers: num(o.followers), createTime: num(o.createTime),
    plays: num(o.plays), likes: num(o.likes), comments: num(o.comments), shares: num(o.shares), saves: num(o.saves), duration: num(o.duration),
    cover: /^https?:\/\//.test(o.cover || '') ? str(o.cover, 800) : '', tags: (Array.isArray(o.tags) ? o.tags : []).map(t => str(t, 40)).slice(0, 15), ad: !!o.ad, shop: !!o.shop,
    url: /^https:\/\/www\.tiktok\.com\//.test(o.url || '') ? str(o.url, 300) : ''
  });
  const DEF_PHRASES = ['tiktok made me buy it', '#tiktokmademebuyit', 'amazon finds', 'amazon must haves', 'viral products', 'gadgets you need', 'things you didn\'t know you needed', 'kitchen gadgets', 'cleaning hacks', 'home finds', 'temu finds', 'aliexpress finds', 'car accessories must have', 'beauty gadgets', 'baby products must have', 'pet products', 'منتجات مفيدة', 'منتجات تيك توك', 'trouvaille amazon', 'produits tiktok'];
  /* ================= 💰 حاسبة الربح: مدخلات كل منتج + آخر القيم كافتراضي ================= */
  const PF = ['price', 'cost', 'costCur', 'ship', 'deliv', 'pack', 'cpl', 'conf', 'rate', 'ret', 'leads'];
  app.get('/api/profit', auth, active, wrap((q, s) => s.json(kvGet(q.u.id, 'profit', { last: {}, items: {} }))));
  app.put('/api/profit', auth, active, wrap((q, s) => {
    const k = str(q.body && q.body.k, 300), v = {}, b = (q.body && q.body.v) || {};
    for (const f of PF) if (b[f] !== undefined && b[f] !== '') v[f] = f === 'costCur' ? str(b[f], 4).toUpperCase().replace(/[^A-Z]/g, '') : Math.max(0, Math.min(1e8, +b[f] || 0));
    const d = kvGet(q.u.id, 'profit', { last: {}, items: {} });
    d.last = Object.assign({}, v); delete d.last.price; delete d.last.cost;      // الافتراضي للمنتج التالي: نسب التأكيد والتوصيل والإعلان…
    if (k) { delete d.items[k]; d.items[k] = Object.assign(v, { at: now() }); const ks = Object.keys(d.items); ks.slice(0, Math.max(0, ks.length - 500)).forEach(x => delete d.items[x]); }
    kvSet(q.u.id, 'profit', d); s.json({ ok: 1 });
  }));
  app.get('/api/tt/phrases', auth, active, wrap((q, s) => s.json({ phrases: kvGet(q.u.id, 'tt_phrases', DEF_PHRASES), defaults: DEF_PHRASES })));
  app.put('/api/tt/phrases', auth, active, wrap((q, s) => { const p = [...new Set((Array.isArray(q.body && q.body.phrases) ? q.body.phrases : []).map(x => str(x, 80)).filter(Boolean))].slice(0, 80); kvSet(q.u.id, 'tt_phrases', p.length ? p : DEF_PHRASES); s.json({ phrases: kvGet(q.u.id, 'tt_phrases', DEF_PHRASES) }); }));
  app.get('/api/tt', auth, active, wrap((q, s) => s.json({ runs: db.prepare('select id,label,phrases,created_at,count from tt_runs where user_id=? order by created_at desc limit 100').all(q.u.id).map(r => Object.assign(r, { phrases: J(r.phrases, []) })) })));
  app.post('/api/tt', auth, active, wrap((q, s) => {
    const ph = (Array.isArray(q.body && q.body.phrases) ? q.body.phrases : []).map(x => str(x, 80)).filter(Boolean).slice(0, 30);
    const id = db.prepare('insert into tt_runs(user_id,label,phrases,created_at) values(?,?,?,?)').run(q.u.id, str(q.body && q.body.label, 160) || 'TikTok', JSON.stringify(ph), now()).lastInsertRowid; s.json({ id: Number(id) });
  }));
  const ttOwn = (u, id) => { const r = db.prepare('select * from tt_runs where id=? and user_id=?').get(+id, u); if (!r) throw bad('غير موجود', 404); return r; };
  app.post('/api/tt/:id/ingest', auth, active, wrap((q, s) => {
    const r = ttOwn(q.u.id, q.params.id), b = q.body || {}, query = str(b.q, 120);
    const get = db.prepare('select row from tt_items where run_id=? and vid=?'), put = db.prepare('insert into tt_items(run_id,vid,q,row) values(?,?,?,?) on conflict(run_id,vid) do update set row=excluded.row');
    for (const o of (Array.isArray(b.items) ? b.items : []).slice(0, 400)) {
      const c = cleanTT(o || {}); if (!c.id) continue;
      const old = get.get(r.id, c.id), prev = old ? J(old.row, {}) : null;
      if (prev) for (const k of Object.keys(c)) if (!c[k] && prev[k]) c[k] = prev[k];                // بيانات الشبكة أدق من قراءة الصفحة: لا نمحو قيمة موجودة
      put.run(r.id, c.id, query, JSON.stringify(c));
    }
    const n = db.prepare('select count(*) n from tt_items where run_id=?').get(r.id).n; db.prepare('update tt_runs set count=? where id=?').run(n, r.id);
    s.json({ count: n });
  }));
  app.get('/api/tt/:id', auth, active, wrap((q, s) => { const r = ttOwn(q.u.id, q.params.id); s.type('application/json').send('{"id":' + r.id + ',"label":' + JSON.stringify(r.label) + ',"created_at":' + r.created_at + ',"items":[' + db.prepare('select row,q from tt_items where run_id=?').all(r.id).map(x => x.row.replace(/^\{/, '{"q":' + JSON.stringify(x.q) + ',')).join(',') + ']}'); }));
  app.delete('/api/tt/:id', auth, active, wrap((q, s) => { const r = ttOwn(q.u.id, q.params.id); db.prepare('delete from tt_items where run_id=?').run(r.id); db.prepare('delete from tt_runs where id=?').run(r.id); s.json({ ok: 1 }); }));

  return { DEF_PHRASES };
};
