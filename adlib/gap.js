'use strict';
const U = require('./util.js');   // J · str · kvGet · kvSet
// قسم «ثغرات السوق»: منتج رابح في سوق أجنبي (من المحفوظات) ← هل يُعلَن عنه في السوق المستهدف (الجزائر افتراضياً، أو أي دولة يختارها المشترك)؟
// 1) عبارات بحث بلغات ذلك السوق (ذكاء اصطناعي إن وُجد OPENAI_API_KEY، وإلا كتابة يدوية)
// 2) الإضافة تبحث في مكتبة إعلانات ميتا (السوق المستهدف، النشطة والمتوقفة) والصفحة تقارن لحظياً (بصمة الصورة، رابط المورّد، الكلمات المميزة)
// 3) الحكم: ثغرة مؤكدة · منافسة ضعيفة · جُرّب وتوقف · مشبع · يحتاج تحققك · غير حاسم. والثغرات تُراقَب أسبوعياً.
const C = require('./core.js'), AI = require('./ai.js'), LIM = require('./limits.js'), NT = require('./notify.js'), MK = require('./lib/markets.js');

const WEEK = 7 * 864e5, SIMILAR_MAX = 40;
const VERDICTS = ['new', 'gap', 'weak', 'tried', 'saturated', 'check', 'inconclusive'];

module.exports = function mountGap(app, X) {
  const { db, auth, active, wrap, now } = X;
  const bad = (m, code) => Object.assign(new Error(m), { status: code || 400 });
  const J = U.J;
  const str = U.str;

  db.exec(`
create table if not exists gap_products(id integer primary key, user_id integer, k text, name text, snap text, terms text, keywords text, hashes text,
  verdict text default 'new', stats text, watch integer default 1, created_at integer, last_scan_at integer, next_check_at integer, unique(user_id, k));
create table if not exists gap_scans(id integer primary key, gp_id integer, user_id integer, started_at integer, finished_at integer, queries text, scanned integer default 0, seen text);
create table if not exists gap_matches(id integer primary key, gp_id integer, user_id integer, ad_id text, scan_id integer, row text, ev text, level text, decision text,
  created_at integer, unique(gp_id, ad_id));
create index if not exists gap_m_gp on gap_matches(gp_id);`);
  try { db.exec("alter table gap_products add column target text default 'DZ'"); } catch (e) {}
  try { db.exec('alter table gap_products add column hidden text'); } catch (e) {}   // إعلانات حذفها المشترك: لا تعود في الفحوص القادمة   // السوق المستهدف لكل منتج
  // السوق المستهدف: دولة من lib/markets.js (ليس «كل الدول»). اختيار المشترك الافتراضي محفوظ في user_kv
  const okC = c => { c = String(c || '').toUpperCase(); return MK.COUNTRIES[c] && c !== 'ALL' ? c : null; };
  const userTarget = uid => { try { return okC(J((db.prepare("select v from user_kv where user_id=? and k='gap_target'").get(uid) || {}).v, '')) || 'DZ'; } catch (e) { return 'DZ'; } };
  const cnameAr = c => (MK.COUNTRIES[c] || {}).name || c;
  // أدوات التجسس حُذفت نهائياً: نتائجها القديمة لا تبقى في الأرشيف
  try { db.prepare("delete from runs where source='spy'").run(); } catch (e) {}

  const own = (uid, id) => { const p = db.prepare('select * from gap_products where id=? and user_id=?').get(+id, uid); if (!p) throw bad('غير موجود', 404); return p; };
  const view = p => ({
    id: p.id, k: p.k, name: p.name, target: okC(p.target) || 'DZ', snap: J(p.snap, {}), terms: J(p.terms, []), keywords: J(p.keywords, []), hashes: J(p.hashes, []), verdict: p.verdict,
    stats: J(p.stats, {}), watch: !!p.watch, created_at: p.created_at, last_scan_at: p.last_scan_at, next_check_at: p.next_check_at,
    due: !!(p.watch && p.next_check_at && p.next_check_at <= now())
  });
  const matchesOf = gp => db.prepare('select id,ad_id,scan_id,row,ev,level,decision,created_at from gap_matches where gp_id=? order by id desc').all(gp)
    .map(m => ({ id: m.id, ad_id: m.ad_id, scan_id: m.scan_id, row: J(m.row, {}), ev: J(m.ev, {}), level: m.level, decision: m.decision || '', created_at: m.created_at }));

  /* ---------- الحكم ---------- */
  function verdictOf(gp) {
    const ms = matchesOf(gp.id), last = db.prepare('select * from gap_scans where gp_id=? and finished_at is not null order by id desc limit 1').get(gp.id);
    const yes = ms.filter(m => m.decision === 'yes' || (m.level === 'strong' && m.decision !== 'no'));
    const maybe = ms.filter(m => m.level === 'possible' && !m.decision);
    const sellers = new Set(yes.map(m => m.row.page_id || m.row.page_name || m.ad_id));
    const act = yes.filter(m => m.row.status !== 'inactive');
    const actSellers = new Set(act.map(m => m.row.page_id || m.row.page_name || m.ad_id));
    const qs = last ? J(last.queries, []) : [], done = qs.filter(q => q.status === 'done').length;
    const firstSeen = act.map(m => m.row.start_date).filter(Boolean).sort()[0] || '';
    const stats = { matches: yes.length, possible: maybe.length, sellers: sellers.size, activeSellers: actSellers.size, active: act.length, scanned: last ? last.scanned : 0,
      queries: qs.length, queriesDone: done, firstSeen, scans: db.prepare('select count(*) n from gap_scans where gp_id=? and finished_at is not null').get(gp.id).n };
    let v = 'new';
    if (last) {
      if (!yes.length) v = maybe.length ? 'check' : done >= 2 ? 'gap' : 'inconclusive';
      else if (!act.length) v = 'tried';
      else if (actSellers.size <= 2) v = 'weak';
      else v = 'saturated';
    }
    return { v, stats };
  }
  function refresh(gp) {
    const { v, stats } = verdictOf(gp);
    db.prepare('update gap_products set verdict=?, stats=? where id=?').run(v, JSON.stringify(stats), gp.id);
    return own(gp.user_id, gp.id);
  }

  /* ---------- القائمة ---------- */
  app.get('/api/gap', auth, active, wrap((q, s) => {
    const ps = db.prepare('select * from gap_products where user_id=? order by created_at desc').all(q.u.id).map(view);
    s.json({ products: ps, ai: AI.enabled(), due: ps.filter(p => p.due).length, target: userTarget(q.u.id) });
  }));
  app.put('/api/gap-target', auth, wrap((q, s) => {
    const c = okC(q.body && q.body.target); if (!c) throw bad('دولة غير معروفة');
    db.prepare("insert into user_kv(user_id,k,v) values(?,'gap_target',?) on conflict(user_id,k) do update set v=excluded.v").run(q.u.id, JSON.stringify(c));
    s.json({ target: c });
  }));
  app.get('/api/gap/due', auth, active, wrap((q, s) => s.json({ due: db.prepare('select count(*) n from gap_products where user_id=? and watch=1 and next_check_at<=?').get(q.u.id, now()).n })));
  app.get('/api/gap/:id', auth, active, wrap((q, s) => { const p = own(q.u.id, q.params.id); s.json(Object.assign(view(p), { matches: matchesOf(p.id) })); }));

  // من «المحفوظات» إلى القسم: نسخة من المنتج كما حُفظ (الاسم، الصور، روابط المورّد، نصوص الإعلانات الأجنبية)
  app.post('/api/gap', auth, active, wrap((q, s) => {
    const k = str(q.body && q.body.k, 300); if (!k) throw bad('k');
    const sv = db.prepare('select snap from saved where user_id=? and k=?').get(q.u.id, k);
    if (!sv) throw bad('المنتج غير موجود في المحفوظات', 404);
    const old = db.prepare('select id from gap_products where user_id=? and k=?').get(q.u.id, k);
    if (old) return s.json({ id: old.id, existed: true });
    LIM.check(q.u, 'gapProducts', db.prepare('select count(*) n from gap_products where user_id=?').get(q.u.id).n);
    const p = J(sv.snap, {}), recs = (p.recs || []).slice(0, 12);
    const ads = recs.map(r => r.a || {}).concat(p.top ? [p.top] : []);
    const uniq = a => [...new Set(a.filter(Boolean))];
    const snap = {
      name: str(p.name, 200), kw: str(p.kw, 120), cat: p.cat || p.tier || '', score: p.score || 0, n: p.n || 0, price: p.pr || p.price || 0,
      images: uniq((p.images || []).concat(ads.map(a => a.image_url))).slice(0, 8),
      links: uniq(ads.map(a => a.link_url)).slice(0, 8), lib: p.lib || (p.top && p.top.library_url) || '',
      country: p.market || uniq(ads.map(a => a.country))[0] || '', markets: (p.markets || []).slice(0, 10),
      texts: uniq(ads.map(a => str([a.title, a.body].filter(Boolean).join(' — '), 600))).slice(0, 4), tags: (p.tags || []).slice(0, 3)
    };
    const target = okC(q.body.target) || userTarget(q.u.id);
    const id = db.prepare('insert into gap_products(user_id,k,name,snap,terms,keywords,hashes,stats,created_at,target) values(?,?,?,?,?,?,?,?,?,?)')
      .run(q.u.id, k, snap.name || 'منتج', JSON.stringify(snap), '[]', '[]', '[]', '{}', now(), target).lastInsertRowid;
    s.json({ id: Number(id) });
  }));
  app.delete('/api/gap/:id', auth, active, wrap((q, s) => {
    const p = own(q.u.id, q.params.id);
    ['gap_matches', 'gap_scans'].forEach(t => db.prepare(`delete from ${t} where gp_id=?`).run(p.id));
    db.prepare('delete from gap_products where id=?').run(p.id); s.json({ ok: 1 });
  }));
  // العبارات والكلمات المميزة وبصمات الصور والمراقبة
  const cleanTerms = a => (Array.isArray(a) ? a : []).slice(0, 12).map(t => ({ q: str(t && t.q, 100), lang: MK.LANGS[t && t.lang] ? t.lang : 'ar' })).filter(t => t.q);
  const cleanWords = a => [...new Set((Array.isArray(a) ? a : []).map(w => str(w, 40)).filter(w => w.length >= 2))].slice(0, 30);
  app.put('/api/gap/:id', auth, active, wrap((q, s) => {
    const p = own(q.u.id, q.params.id), b = q.body || {};
    if (b.terms) db.prepare('update gap_products set terms=? where id=?').run(JSON.stringify(cleanTerms(b.terms)), p.id);
    if (b.keywords) db.prepare('update gap_products set keywords=? where id=?').run(JSON.stringify(cleanWords(b.keywords)), p.id);
    if (Array.isArray(b.hashes)) db.prepare('update gap_products set hashes=? where id=?').run(JSON.stringify(b.hashes.filter(h => /^[0-9a-f]{16}$/.test(h)).slice(0, 30)), p.id);
    if (b.watch !== undefined) db.prepare('update gap_products set watch=? where id=?').run(b.watch ? 1 : 0, p.id);
    if (b.target !== undefined) { const c = okC(b.target); if (!c) throw bad('دولة غير معروفة'); db.prepare('update gap_products set target=? where id=?').run(c, p.id); }
    s.json(view(own(q.u.id, p.id)));
  }));

  /* ---------- اقتراح عبارات السوق المستهدف بالذكاء الاصطناعي ---------- */
  async function aiTerms(snap, target) {
    if (!AI.enabled()) return null;
    let country = target; try { country = new Intl.DisplayNames(['en'], { type: 'region' }).of(target); } catch (e) {}
    const langs = MK.langsOf(target), ln = langs.map(l => l + ' = ' + ((MK.LANGS[l] || {}).native || l)).join(', ');
    const sys = 'You help an e-commerce researcher check whether a product that sells abroad is already advertised in ' + country + ' on the Facebook Ad Library. ' +
      'Advertisers in ' + country + ' write in these languages (code = language): ' + ln + '. Return ONLY JSON.';
    const user = 'Product (from a foreign ' + (snap.country || '') + ' ad):\nName: ' + snap.name + '\nKeyword: ' + snap.kw + '\nAd texts:\n- ' + (snap.texts || []).join('\n- ') +
      '\n\nReturn JSON {"names":[""],"queries":[{"q":"","lang":"' + langs.join('|') + '"}],"keywords":[""]}.\n' +
      'queries: 5 short searches (1-4 words) the way a seller in ' + country + ' would name or advertise THIS product: the generic product name in each of the main local languages, and 1-2 phrases with its main benefit. No brand names unless the product is known by it. ' +
      'names: the generic product name in each local language. keywords: 8-14 distinctive words (in the local languages) that would appear in an ad in ' + country + ' for this exact product (type, material, key feature), not generic words like quality, delivery or price.';
    const r = await AI.chatJSON(sys, user); const o = r.data;
    return { terms: cleanTerms(o.queries), keywords: cleanWords([].concat(o.keywords || [], Array.isArray(o.names) ? o.names : [], o.name_ar ? [o.name_ar] : [], o.name_fr ? [o.name_fr] : [])), model: r.model };
  }
  app.post('/api/gap/:id/suggest', auth, active, (q, s, n) => {
    let p; try { p = own(q.u.id, q.params.id); if (AI.enabled()) LIM.useAI(q.u); } catch (e) { return n(e); }
    aiTerms(J(p.snap, {}), okC(p.target) || 'DZ').then(r => {
      if (!r) return s.json({ ai: false });
      db.prepare('update gap_products set terms=?, keywords=? where id=?').run(JSON.stringify(r.terms), JSON.stringify(r.keywords), p.id);
      s.json(Object.assign({ ai: true }, r));
    }).catch(e => { LIM.refundAI(q.u.id); n(e); });
  });

  /* ---------- الفحص ---------- */
  app.post('/api/gap/:id/scan', auth, active, wrap((q, s) => {
    const p = own(q.u.id, q.params.id), qs = cleanTerms(q.body && q.body.queries).map(t => ({ q: t.q, lang: t.lang, status: 'pending', seen: 0 }));
    if (!qs.length) throw bad('اكتب عبارة بحث واحدة على الأقل');
    const id = db.prepare('insert into gap_scans(gp_id,user_id,started_at,queries,seen) values(?,?,?,?,?)').run(p.id, q.u.id, now(), JSON.stringify(qs), '[]').lastInsertRowid;
    db.prepare("delete from gap_matches where gp_id=? and level='similar' and decision is null").run(p.id);   // «المشابهة» تُبنى من جديد مع كل فحص
    s.json({ scan: Number(id) });
  }));
  // إعلانات السوق المستهدف من الإضافة → صفوف موحّدة تعود للصفحة لتقارنها (الصورة تُقارن في المتصفح)
  app.post('/api/gap/:id/ingest', auth, active, wrap((q, s) => {
    const p = own(q.u.id, q.params.id), b = q.body || {};
    const sc = db.prepare('select * from gap_scans where id=? and gp_id=?').get(+b.scan, p.id); if (!sc) throw bad('scan', 404);
    if (!Array.isArray(b.ads) || b.ads.length > 400) throw bad('ads');
    const seen = new Set(J(sc.seen, [])), rows = [], t = now();
    for (const raw of b.ads) {
      let r = null; try { r = C.rowFromRaw(raw, { query: str(b.query, 120), niche: '', country: okC(p.target) || 'DZ', src: raw && raw._src === 'dom' ? 'dom' : 'net' }, t); } catch (e) {}
      if (!r || seen.has(r.ad_id)) continue;
      seen.add(r.ad_id);
      rows.push({ ad_id: r.ad_id, library_url: r.library_url, page_id: r.page_id, page_name: r.page_name, status: r.status, start_date: r.start_date, days_running: r.days_running,
        title: r.title, body: r.body.slice(0, 1500), link_url: r.link_url, domain: r.domain, image_url: r.image_url, video_url: r.video_url, duplicates: r.duplicates, search: r.search });
    }
    db.prepare('update gap_scans set seen=?, scanned=? where id=?').run(JSON.stringify([...seen].slice(-5000)), seen.size, sc.id);
    s.json({ rows, scanned: seen.size });
  }));
  app.post('/api/gap/:id/matches', auth, active, wrap((q, s) => {
    const p = own(q.u.id, q.params.id), b = q.body || {};
    const up = db.prepare(`insert into gap_matches(gp_id,user_id,ad_id,scan_id,row,ev,level,created_at) values(?,?,?,?,?,?,?,?)
      on conflict(gp_id,ad_id) do update set row=excluded.row, ev=excluded.ev, scan_id=excluded.scan_id,
      level=case when excluded.level='strong' or gap_matches.level='strong' then 'strong' when excluded.level='possible' or gap_matches.level='possible' then 'possible' else 'similar' end`);
    let n = 0; const hid = new Set(J(p.hidden, []));
    for (const m of (Array.isArray(b.matches) ? b.matches : []).slice(0, 200)) {
      if (!m || !m.row || !m.row.ad_id || !['strong', 'possible', 'similar'].includes(m.level) || hid.has(String(m.row.ad_id))) continue;
      const row = {}; ['ad_id', 'library_url', 'page_id', 'page_name', 'status', 'start_date', 'days_running', 'title', 'body', 'link_url', 'domain', 'image_url', 'video_url', 'duplicates', 'search']
        .forEach(k => { row[k] = m.row[k] == null ? '' : typeof m.row[k] === 'number' ? m.row[k] : str(m.row[k], k === 'body' ? 1500 : 1200); });
      up.run(p.id, q.u.id, String(row.ad_id), +b.scan || 0, JSON.stringify(row), JSON.stringify(m.ev || {}).slice(0, 2000), m.level, now()); n++;
    }
    // «مشابهة» = نتائج البحث التي لم تطابق: نُبقي الأقرب فقط (لا تدخل في الحكم إلا إن أكّدها المشترك «نفس المنتج»)
    db.prepare(`delete from gap_matches where gp_id=? and level='similar' and decision is null and id not in
      (select id from gap_matches where gp_id=? and level='similar' order by cast(json_extract(ev,'$.score') as integer) desc, id desc limit ${SIMILAR_MAX})`).run(p.id, p.id);
    const v = view(refresh(p)); s.json({ saved: n, verdict: v.verdict, stats: v.stats });
  }));
  app.post('/api/gap/:id/finish', auth, active, wrap((q, s) => {
    const p = own(q.u.id, q.params.id), b = q.body || {};
    const sc = db.prepare('select * from gap_scans where id=? and gp_id=?').get(+b.scan, p.id); if (!sc) throw bad('scan', 404);
    const qs = J(sc.queries, []), st = Array.isArray(b.items) ? b.items : [];
    qs.forEach(x => { const it = st.find(i => i && i.q === x.q); if (it) { x.status = ['done', 'timeout', 'skipped', 'stopped'].includes(it.status) ? it.status : 'stopped'; x.seen = +it.seen || 0; } });
    db.prepare('update gap_scans set finished_at=?, queries=? where id=?').run(now(), JSON.stringify(qs), sc.id);
    db.prepare('update gap_products set last_scan_at=?, next_check_at=? where id=?').run(now(), now() + WEEK, p.id);
    // تنبيه: منافسون جدد ظهروا في هذا الفحص (أول ظهور لإعلانهم)
    const fresh = db.prepare("select count(*) n, sum(level='strong') st from gap_matches where gp_id=? and created_at>=? and (decision is null or decision!='no') and (level!='similar' or decision='yes')").get(p.id, sc.started_at || 0);
    if (fresh.n) NT.fire(q.u.id, 'gap', '🎯 «' + (p.name || 'منتج') + '»: ' + fresh.n + ' إعلان جديد في ' + cnameAr(okC(p.target) || 'DZ') + (fresh.st ? ' (' + fresh.st + ' مطابق بقوة)' : ' (محتمل)') + '. افتحه لتتحقق: هل دخل منافس؟', '/gaps/' + p.id);
    s.json(Object.assign(view(refresh(p)), { matches: matchesOf(p.id) }));
  }));
  // حذف إعلان واحد (لا يعود في الفحوص القادمة) أو كل إعلانات المنتج دفعة واحدة (تُعاد في الفحص القادم)
  app.delete('/api/gap/:id/matches/:mid', auth, active, wrap((q, s) => {
    const p = own(q.u.id, q.params.id);
    if (q.params.mid === 'all') db.prepare('delete from gap_matches where gp_id=?').run(p.id);
    else { const m = db.prepare('select ad_id from gap_matches where id=? and gp_id=?').get(+q.params.mid, p.id); if (!m) throw bad('غير موجود', 404);
      const h = J(p.hidden, []); if (!h.includes(m.ad_id)) h.push(m.ad_id); db.prepare('update gap_products set hidden=? where id=?').run(JSON.stringify(h.slice(-2000)), p.id);
      db.prepare('delete from gap_matches where id=? and gp_id=?').run(+q.params.mid, p.id); }
    s.json(Object.assign(view(refresh(own(q.u.id, p.id))), { matches: matchesOf(p.id) }));
  }));
  // تحققك اليدوي: هذا هو المنتج نفسه / ليس هو
  app.put('/api/gap/:id/matches/:mid', auth, active, wrap((q, s) => {
    const p = own(q.u.id, q.params.id), d = q.body && q.body.decision;
    db.prepare('update gap_matches set decision=? where id=? and gp_id=?').run(['yes', 'no'].includes(d) ? d : null, +q.params.mid, p.id);
    s.json(view(refresh(p)));
  }));

  return { verdictOf, VERDICTS };
};
