'use strict';
// قسم «جمع الإعلانات»: تستقبل المنصة ما تجمعه الإضافة وتضعه مباشرة في «الإعلانات الواردة» (دفعة لكل عملية جمع)،
// والتصفية والتقييم كلها في قسم التحليل. هنا أيضاً: قاموس كلمات البحث لكل مستخدم، حدود الجمع، وتنزيل الإضافة.
const fs = require('fs'), path = require('path');
const LIM = require('./limits.js'), C = require('./core.js'), { zip } = require('./zip.js'), AI = require('./ai.js'), MK = require('./lib/markets.js');
const FILE_DICT = require('./default_dict.json');

const ENV = (k, d) => (process.env[k] !== undefined && process.env[k] !== '' ? process.env[k] : d);
const NUM = (k, d) => { const n = Number(ENV(k, d)); return Number.isFinite(n) ? n : d; };
const EXT_DIR = path.join(__dirname, '..', 'extensions', 'ad-collector');

module.exports = function mount(app, X) {
  const { db, auth, active, admin, wrap, now, DAY, addRun, fpOf } = X;
  const bad = (m, code) => Object.assign(new Error(m), { status: code || 400 });

  /* ---------- الإعدادات (من .env) ---------- */
  const CFG = {
    retentionDays: NUM('LIB_RETENTION_DAYS', 45),          // الدفعات المجمَّعة التي لم تُحلَّل تُحذف بعد هذه المدة
    maxBatch: NUM('LIB_MAX_SEARCHES_PER_BATCH', 15),
    maxDay: NUM('LIB_MAX_SEARCHES_PER_DAY', 60),
    maxAdsPerSearch: NUM('LIB_MAX_ADS_PER_SEARCH', 3000),
    maxAdsPerRun: NUM('LIB_MAX_ADS_PER_BATCH', 15000),      // سقف الدفعة الواحدة في «الواردة»
    allowFast: ENV('LIB_ALLOW_FAST', '0') === '1',
    ingestPerMin: NUM('LIB_INGEST_PER_MIN', 120)
  };
  let EXT_VERSION = '1.0.0';
  try { EXT_VERSION = JSON.parse(fs.readFileSync(path.join(EXT_DIR, 'manifest.json'), 'utf8')).version; } catch (e) {}
  const EXT_MIN = ENV('LIB_BRIDGE_MIN_VERSION', '1.0.0');
  const CFG_STORE = () => require('./config.js').get('ext_store_url') || '';   // رابط الإضافة في متجر Chrome (من «الربط والتكامل»)

  /* ---------- الجداول ---------- */
  db.exec(`
create table if not exists user_kv(user_id integer, k text, v text, primary key(user_id, k));
create table if not exists lib_user(user_id integer primary key, diff text, updated_at integer);
create table if not exists lib_kv(k text primary key, v text);
create table if not exists lib_usage(user_id integer, day text, searches integer default 0, primary key(user_id, day));
create table if not exists lib_batch(user_id integer, batch_id text, run_id integer, created_at integer, primary key(user_id, batch_id));
create table if not exists lib_bstats(user_id integer, batch_id text, observed text, primary key(user_id, batch_id));
create table if not exists lib_bfilt(user_id integer, batch_id text, ad_id text, primary key(user_id, batch_id, ad_id));
create table if not exists lib_rows(run_id integer, ad_id text, row text, primary key(run_id, ad_id));
create table if not exists lib_excluded(user_id integer, ad_id text, kind text, why text, label text, row text, created_at integer, primary key(user_id, ad_id));
create index if not exists lib_excl_t on lib_excluded(user_id, created_at);
create table if not exists ad_track(user_id integer, ad_id text, first_seen integer, last_seen integer, days integer default 1, active integer, ended integer, start_date text, primary key(user_id, ad_id));`);
  try { db.exec('alter table runs add column batch text'); } catch (e) {}
  const tx = f => { db.exec('BEGIN'); try { const r = f(); db.exec('COMMIT'); return r; } catch (e) { try { db.exec('ROLLBACK'); } catch (x) {} throw e; } };
  const kvGet = k => { const r = db.prepare('select v from lib_kv where k=?').get(k); return r ? r.v : null; };
  const kvSet = (k, v) => db.prepare('insert into lib_kv(k,v) values(?,?) on conflict(k) do update set v=excluded.v').run(k, v);
  const J = (s, d) => { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } };

  /* ---------- ترحيل: مكتبة النسخة السابقة (lib_ads) تصير دفعة في «الواردة» ثم يُحذف الجدول ---------- */
  try {
    if (db.prepare("select 1 from sqlite_master where type='table' and name='lib_ads'").get()) {
      const users = db.prepare('select distinct user_id from lib_ads').all();
      for (const { user_id } of users) {
        const old = db.prepare('select * from lib_ads where user_id=? order by last_seen desc limit ?').all(user_id, CFG.maxAdsPerRun);
        const rows = old.map(r => {
          const x = J(r.extra, {}), q = J(r.queries, []), n = J(r.niches, []), iso = ms => (ms ? new Date(ms).toISOString() : '');
          return { ad_id: r.ad_id, library_url: 'https://www.facebook.com/ads/library/?id=' + r.ad_id, page_id: r.page_id || '', page_name: r.page_name || '', page_url: x.pageUrl || '', page_likes: r.page_likes || 0,
            status: r.status === 1 ? 'active' : r.status === 0 ? 'inactive' : '', start_date: r.start_ts ? new Date(r.start_ts * 1000).toISOString().slice(0, 10) : '',
            end_date: r.end_ts ? new Date(r.end_ts * 1000).toISOString().slice(0, 10) : '', days_running: r.age_days == null ? '' : r.age_days, duplicates: r.copies || 1, cta: r.cta || '', cta_group: r.cta_group || '',
            format: r.format || '', language: r.lang || '', platforms: (x.platforms || []).join(' | '), domain: r.domain || '', link_url: r.link_url || '', title: r.title || '', body: r.body || '', link_description: r.link_desc || '',
            image_url: r.image_url || '', video_url: r.video_url || '', search: q[0] || '', search_terms: q.join(' | '), niche: n[0] || '', niches: n.join(' | '), collected_at: iso(r.first_seen), last_seen_at: iso(r.last_seen), source: r.source || 'net' };
        });
        if (rows.length) addRun({ id: user_id }, 'adlib', 'ما جُمع سابقاً · ' + new Date().toISOString().slice(0, 10), rows);
      }
      db.exec('drop table lib_ads');
    }
  } catch (e) { console.error('lib migrate', e.message); }

  /* ---------- القاموس الافتراضي + قاموس كل مستخدم (لكلمات البحث فقط) ---------- */
  let baseCache = null;
  const baseDict = () => {
    if (baseCache) return baseCache;
    let d = FILE_DICT; const v = kvGet('default_dict');
    if (v) { try { d = JSON.parse(v); } catch (e) {} }
    return (baseCache = C.withMarkets(d));
  };

  /* ---------- الاستقبال: الإعلانات تذهب إلى دفعة في «الإعلانات الواردة» ---------- */
  const rl = new Map();
  const limited = uid => { const t = now(), r = rl.get(uid); if (!r || t - r.t > 6e4) { rl.set(uid, { t, n: 1 }); return false; } return ++r.n > CFG.ingestPerMin; };
  const str = (v, n) => String(v == null ? '' : v).slice(0, n);
  const stamp = ms => new Date(ms).toLocaleString('ar-DZ', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false });

  app.post('/api/lib/ingest', auth, active, wrap((q, s) => {
    const u = q.u, b = q.body || {};
    if (!Array.isArray(b.ads)) throw bad('ads');
    if (b.ads.length > 400) throw bad('الدفعة أكبر من 400 إعلان', 413);
    if (limited(u.id)) throw bad('طلبات كثيرة، أبطئ الجمع قليلاً', 429);
    const c = b.ctx || {}, meta = { query: str(c.query, 120), niche: str(c.niche, 60), country: str(c.country, 10), src: 'net' }, t = now();
    const strict = c.filter === 'strict';   // لا استبعاد عند الوصول: كل إعلان يدخل «الواردة». الاستبعاد في التحليل للعلامات الرسمية فقط
    const batch = str(b.batch || c.batch || 'manual', 40), label = str(c.label, 160);
    const rows = [], byKind = {}, samples = [], excl = [];
    let skipped = 0, filtered = 0;
    const ignoreW = new Set(J((db.prepare("select v from user_kv where user_id=? and k='pc_ignore'").get(u.id) || {}).v, []) || []);   // كلمات صحّحها («سبب خاطئ»)
    const allowPages = new Set((J((db.prepare("select v from user_kv where user_id=? and k='allow_pages'").get(u.id) || {}).v, []) || []).map(String));
    for (const raw of b.ads) {
      let r = null;
      try { meta.src = raw && raw._src === 'dom' ? 'dom' : 'net'; r = C.rowFromRaw(raw, meta, t); } catch (e) { r = null; }
      if (!r) { skipped++; continue; }
      if (strict) {
        const v = allowPages.has(String(r.page_id)) ? { ok: true } : C.eligibility(r, ignoreW);   // صفحة سمح بها المستخدم: لا تُستبعد
        if (!v.ok) {                                                   // ليس منتجاً مادياً صالحاً: لا يدخل «الواردة» بل «المستبعد» (قابل للاسترجاع)
          filtered++; byKind[v.kind] = (byKind[v.kind] || 0) + 1; excl.push([r, v]);
          if (samples.length < 5) samples.push({ title: (r.title || r.body || '').slice(0, 80), page: r.page_name, why: v.reasons[0] || v.label });
          continue;
        }
      }
      rows.push(r);
    }
    // أرقام صفحة التحليل: ما تعرضه ميتا لكل بحث («~220 نتيجة»)، وما استُبعد عند الاستقبال (بلا تكرار)
    const tot = Math.max(0, Math.floor(+c.total || 0));
    if (tot && meta.query) {
      const st = db.prepare('select observed from lib_bstats where user_id=? and batch_id=?').get(u.id, batch), ob = J(st && st.observed, {});
      if (!(ob[meta.query] >= tot)) { ob[meta.query] = tot; db.prepare('insert into lib_bstats(user_id,batch_id,observed) values(?,?,?) on conflict(user_id,batch_id) do update set observed=excluded.observed').run(u.id, batch, JSON.stringify(ob)); }
    }
    if (excl.length) { const fi = db.prepare('insert or ignore into lib_bfilt(user_id,batch_id,ad_id) values(?,?,?)'); tx(() => { for (const [r] of excl) fi.run(u.id, batch, String(r.ad_id)); }); }
    if (excl.length) {
      const ins = db.prepare('insert into lib_excluded(user_id,ad_id,kind,why,label,row,created_at) values(?,?,?,?,?,?,?) on conflict(user_id,ad_id) do update set kind=excluded.kind, why=excluded.why, row=excluded.row, created_at=excluded.created_at');
      tx(() => { for (const [r, v] of excl) ins.run(u.id, r.ad_id, v.kind, String(v.reasons[0] || v.label).slice(0, 200), label, JSON.stringify(r), t); });
    }
    // تتبع عمر الإعلان عبر الزمن: متى رأيناه أول مرة وآخر مرة، في كم يوم جمع، وهل ما زال نشطاً
    if (rows.length) {
      const day = Math.floor(t / 864e5), get = db.prepare('select last_seen from ad_track where user_id=? and ad_id=?');
      const put = db.prepare(`insert into ad_track(user_id,ad_id,first_seen,last_seen,days,active,ended,start_date) values(?,?,?,?,1,?,?,?)
        on conflict(user_id,ad_id) do update set last_seen=excluded.last_seen, days=ad_track.days+?, active=excluded.active,
        ended=case when excluded.active=0 then coalesce(ad_track.ended, excluded.ended) else null end, start_date=coalesce(excluded.start_date, ad_track.start_date)`);
      tx(() => { for (const r of rows) { const old = get.get(u.id, r.ad_id), act = r.status === 'inactive' ? 0 : 1, end = r.end_date ? Date.parse(r.end_date) || t : (act ? null : t);
        put.run(u.id, r.ad_id, t, t, act, end, r.start_date || null, old && Math.floor(old.last_seen / 864e5) === day ? 0 : 1); } });
    }
    let added = 0, updated = 0, rejected = 0, runId = 0, total = 0;
    // الأداء: كل إعلان صف مستقل في lib_rows. لا تُقرأ الدفعة كلها ولا تُعاد كتابتها مع كل إرسال.
    tx(() => {
      const link = db.prepare('select run_id from lib_batch where user_id=? and batch_id=?').get(u.id, batch);
      const run = link && db.prepare('select id, rows, summary from runs where id=? and user_id=?').get(link.run_id, u.id);
      const open = run && !run.summary;                                   // دفعة سبق تحليلها لا نغيّرها: تُفتح تكملة جديدة
      if (open && run.rows !== '@lib') {                                  // دفعة مفتوحة من نسخة سابقة: تُنقل صفوفها مرة واحدة
        const ins0 = db.prepare('insert or ignore into lib_rows(run_id,ad_id,row) values(?,?,?)');
        for (const r of J(run.rows, [])) ins0.run(run.id, String(r.ad_id), JSON.stringify(r));
        db.prepare("update runs set rows='@lib', fp=null where id=?").run(run.id);
      }
      if (open) { runId = run.id; db.prepare('update runs set batch=coalesce(batch,?) where id=?').run(batch, run.id); }
      else if (rows.length) {
        runId = Number(db.prepare("insert into runs(user_id,source,label,ads,rows,created_at,fp,batch) values(?,?,?,0,'@lib',?,null,?)")
          .run(u.id, 'adlib', String((label || 'جمع الإعلانات') + (run ? ' · تكملة' : '') + ' · ' + stamp(t)).slice(0, 200), t, batch).lastInsertRowid);
        db.prepare('insert into lib_batch(user_id,batch_id,run_id,created_at) values(?,?,?,?) on conflict(user_id,batch_id) do update set run_id=excluded.run_id, created_at=excluded.created_at').run(u.id, batch, runId, t);
      }
      if (!runId) return;
      const get = db.prepare('select row from lib_rows where run_id=? and ad_id=?'), put = db.prepare('insert into lib_rows(run_id,ad_id,row) values(?,?,?) on conflict(run_id,ad_id) do update set row=excluded.row');
      let size = db.prepare('select count(*) n from lib_rows where run_id=?').get(runId).n;
      for (const r of rows) {
        const old = get.get(runId, r.ad_id);
        if (old) { put.run(runId, r.ad_id, JSON.stringify(C.mergeRow(J(old.row, {}), r))); updated++; }
        else if (size >= CFG.maxAdsPerRun) rejected++;
        else { put.run(runId, r.ad_id, JSON.stringify(r)); added++; size++; }
      }
      db.prepare('update runs set ads=? where id=?').run(size, runId);
      total = size;
    });
    s.json({ added, updated, rejected, skipped, filtered, byKind, samples, run: runId, total, cap: CFG.maxAdsPerRun });
  }));

  /* ---------- تتبع العمر: بيانات الإعلانات التي في التحليل ---------- */
  app.post('/api/track', auth, active, wrap((q, s) => {
    const ids = (Array.isArray(q.body && q.body.ids) ? q.body.ids : []).map(x => str(x, 40)).filter(Boolean).slice(0, 20000), out = {};
    const get = db.prepare('select first_seen f,last_seen l,days n,active a,ended e,start_date s from ad_track where user_id=? and ad_id=?');
    for (const id of ids) { const r = get.get(q.u.id, id); if (r) out[id] = r; }
    s.json(out);
  }));

  /* ---------- «المستبعد»: ما رفضه فحص صلاحية المنتج، للمراجعة والاسترجاع ---------- */
  app.get('/api/lib/excluded', auth, active, wrap((q, s) => {
    const kind = str(q.query.kind, 20), lim = Math.min(500, +q.query.limit || 200);
    const by = db.prepare('select kind, count(*) n from lib_excluded where user_id=? group by kind').all(q.u.id);
    const list = db.prepare('select ad_id,kind,why,label,row,created_at from lib_excluded where user_id=?' + (kind ? ' and kind=?' : '') + ' order by created_at desc limit ?')
      .all(...[q.u.id].concat(kind ? [kind] : [], [lim])).map(x => { const r = J(x.row, {}); return { ad_id: x.ad_id, kind: x.kind, why: x.why, label: x.label, at: x.created_at, title: r.title, body: String(r.body || '').slice(0, 400), page_name: r.page_name, page_id: r.page_id, image_url: r.image_url, library_url: r.library_url, country: r.country }; });
    s.json({ by, total: by.reduce((a, x) => a + x.n, 0), list, allow: J((db.prepare("select v from user_kv where user_id=? and k='allow_pages'").get(q.u.id) || {}).v, []) });
  }));
  // استرجاع: تذهب الإعلانات إلى دفعة جديدة في «الواردة». allowPages: لا تُستبعد إعلانات هذه الصفحات مستقبلاً
  app.post('/api/lib/excluded/restore', auth, active, wrap((q, s) => {
    const ids = (Array.isArray(q.body && q.body.ids) ? q.body.ids : []).map(x => str(x, 40)).slice(0, 2000);
    const rows = ids.map(id => db.prepare('select row from lib_excluded where user_id=? and ad_id=?').get(q.u.id, id)).filter(Boolean).map(x => J(x.row, null)).filter(Boolean);
    if (!rows.length) throw bad('لا إعلانات محددة');
    let runId = 0;
    tx(() => {
      runId = Number(db.prepare("insert into runs(user_id,source,label,ads,rows,created_at,fp) values(?,?,?,?,'@lib',?,null)").run(q.u.id, 'adlib', 'مسترجعة من «المستبعد» · ' + stamp(now()), rows.length, now()).lastInsertRowid);
      const put = db.prepare('insert or ignore into lib_rows(run_id,ad_id,row) values(?,?,?)');
      for (const r of rows) { put.run(runId, String(r.ad_id), JSON.stringify(r)); db.prepare('delete from lib_excluded where user_id=? and ad_id=?').run(q.u.id, String(r.ad_id)); }
      const pages = (Array.isArray(q.body.allowPages) ? q.body.allowPages : []).map(x => str(x, 40)).filter(x => /^\d+$/.test(x));
      if (pages.length) {
        const cur = new Set(J((db.prepare("select v from user_kv where user_id=? and k='allow_pages'").get(q.u.id) || {}).v, []));
        pages.forEach(x => cur.add(x));
        db.prepare("insert into user_kv(user_id,k,v) values(?,'allow_pages',?) on conflict(user_id,k) do update set v=excluded.v").run(q.u.id, JSON.stringify([...cur].slice(-2000)));
      }
    });
    s.json({ run: runId, restored: rows.length });
  }));
  app.delete('/api/lib/excluded', auth, active, wrap((q, s) => { db.prepare('delete from lib_excluded where user_id=?').run(q.u.id); s.json({ ok: 1 }); }));
  // «سبب خاطئ»: كلمات لا تُستبعد بها المنتجات بعد الآن، وصفحات يُسمح بها دائماً (للتحليل وللاستقبال)
  const kvJ = (u, k) => J((db.prepare('select v from user_kv where user_id=? and k=?').get(u, k) || {}).v, []) || [];
  const kvW = (u, k, v) => db.prepare('insert into user_kv(user_id,k,v) values(?,?,?) on conflict(user_id,k) do update set v=excluded.v').run(u, k, JSON.stringify(v));
  app.get('/api/lib/fix', auth, active, wrap((q, s) => s.json({ ignore: kvJ(q.u.id, 'pc_ignore'), allowPages: kvJ(q.u.id, 'allow_pages') })));
  app.post('/api/lib/fix', auth, active, wrap((q, s) => {
    const b = q.body || {}, ig = new Set(kvJ(q.u.id, 'pc_ignore')), ap = new Set(kvJ(q.u.id, 'allow_pages').map(String));
    (Array.isArray(b.ignore) ? b.ignore : []).slice(0, 20).map(x => str(x, 60).trim()).filter(Boolean).forEach(x => ig.add(x));
    (Array.isArray(b.allowPages) ? b.allowPages : []).slice(0, 20).map(x => str(x, 40)).filter(x => /^\d+$/.test(x)).forEach(x => ap.add(x));
    (Array.isArray(b.unignore) ? b.unignore : []).forEach(x => ig.delete(String(x)));
    kvW(q.u.id, 'pc_ignore', [...ig].slice(-500)); kvW(q.u.id, 'allow_pages', [...ap].slice(-2000));
    s.json({ ignore: [...ig], allowPages: [...ap] });
  }));
  app.delete('/api/lib/allow-pages', auth, active, wrap((q, s) => { db.prepare("delete from user_kv where user_id=? and k='allow_pages'").run(q.u.id); s.json({ ok: 1 }); }));

  /* ---------- الحالة والحدود ---------- */
  const dayMax = u => { const v = LIM.limitsOf(u).searchesPerDay; return Number.isFinite(v) ? v : 100000; };   // حد الباقة (المدير بلا حد)
  const today = () => new Date().toISOString().slice(0, 10);
  const usedToday = uid => { const r = db.prepare('select searches from lib_usage where user_id=? and day=?').get(uid, today()); return r ? r.searches : 0; };
  // الدومينات المرتبطة بالإضافة: ما ضُبط في .env + العنوان الذي يستعمله المشترك الآن (+ www/بدونها). بلا منفذ ولا بروتوكول.
  const hostOk = h => /^[a-z0-9.-]{1,253}$/i.test(h);
  function extHosts(q) {
    const base = [];
    const add = u => { try { const h = new URL(/^[a-z]+:\/\//i.test(u) ? u : 'https://' + u).hostname.toLowerCase(); if (hostOk(h)) base.push(h); } catch (e) {} };
    String(ENV('BRIDGE_ORIGINS', ENV('APP_URL', ''))).split(',').map(x => x.trim()).filter(Boolean).forEach(add);
    add(q.get('host') || '');
    const out = new Set(base);
    base.forEach(h => { if (h.includes('.') && !/^\d+\.\d+\.\d+\.\d+$/.test(h)) out.add(h.startsWith('www.') ? h.slice(4) : 'www.' + h); });
    if (process.env.NODE_ENV !== 'production') { out.add('localhost'); out.add('127.0.0.1'); }
    return [...out];
  }
  app.get('/api/lib/stats', auth, active, wrap((q, s) => {
    const lastRun = db.prepare("select id,ads,created_at from runs where user_id=? and source='adlib' order by created_at desc limit 1").get(q.u.id);
    s.json({
      limits: { maxBatch: CFG.maxBatch, maxDay: dayMax(q.u), usedToday: usedToday(q.u.id), maxAdsPerSearch: CFG.maxAdsPerSearch, allowFast: CFG.allowFast, maxAdsPerRun: CFG.maxAdsPerRun },
      retention: { days: CFG.retentionDays }, lastRun: lastRun || null,
      ext: { latest: EXT_VERSION, min: EXT_MIN, store: CFG_STORE(), hosts: q.u.role === 'admin' ? extHosts(q) : undefined }     // الدومينات للمدير فقط
    });
  }));
  // فحص قبل بدء دفعة (لا يستهلك شيئاً) ثم نقرة لكل بحث يبدأ فعلاً
  app.post('/api/lib/batch', auth, active, wrap((q, s) => {
    const n = Math.max(1, Math.floor(+q.body.count || 1)), used = usedToday(q.u.id), max = dayMax(q.u), left = max - used;
    if (n > CFG.maxBatch) throw bad(`الحد الأقصى ${CFG.maxBatch} عملية بحث في الدفعة الواحدة. هذا لحماية حسابك على فيسبوك.`, 429);
    if (n > left) throw bad(`المتبقي لك اليوم ${Math.max(0, left)} عملية بحث من أصل ${max} (حد باقتك).`, 429);
    s.json({ ok: 1, remaining: left });
  }));
  app.post('/api/lib/tick', auth, active, wrap((q, s) => {
    const used = usedToday(q.u.id);
    if (used >= dayMax(q.u)) throw bad(`بلغت حد اليوم (${dayMax(q.u)} عملية بحث، حد باقتك).`, 429);
    db.prepare('insert into lib_usage(user_id,day,searches) values(?,?,1) on conflict(user_id,day) do update set searches=searches+1').run(q.u.id, today());
    s.json({ ok: 1, remaining: dayMax(q.u) - used - 1 });
  }));

  /* ---------- معنى الكلمات الأجنبية بالعربية (يظهر عند التمرير) ---------- */
  // الكلمات الافتراضية لها معنى جاهز في المتصفح. هنا الكلمات التي يضيفها المستخدم: بالذكاء الاصطناعي إن وُجد المفتاح، مع حفظ النتيجة.
  app.post('/api/lib/gloss', auth, active, (q, s, n) => {
    const lang = String((q.body && q.body.lang) || '').slice(0, 8), words = [...new Set((Array.isArray(q.body && q.body.words) ? q.body.words : []).map(w => String(w).slice(0, 80).trim()).filter(Boolean))].slice(0, 60);
    if (!MK.LANGS[lang] || !words.length) return s.json({ map: {}, ai: AI.enabled() });
    const map = {}, need = [];
    for (const w of words) { const g = MK.gloss(lang, w) || kvGet('gloss:' + lang + ':' + w.toLowerCase()); if (g) map[w] = g; else need.push(w); }
    if (!need.length || !AI.enabled()) return s.json({ map, ai: AI.enabled() });
    try { LIM.useAI(q.u); } catch (e) { return s.json({ map, ai: true, limit: e.message }); }
    AI.chatJSON('Translate advertising search keywords into short natural Modern Standard Arabic meanings (2-5 words each). Return ONLY JSON {"map":{"<word>":"<arabic>"}}.',
      'Language: ' + MK.LANGS[lang].native + '\nWords:\n' + need.join('\n')).then(r => {
      const m = (r && r.data && r.data.map) || {};
      for (const w of need) { const g = String(m[w] || '').slice(0, 80).trim(); if (g) { map[w] = g; kvSet('gloss:' + lang + ':' + w.toLowerCase(), g); } }
      s.json({ map, ai: true });
    }).catch(e => { LIM.refundAI(q.u.id); n(e); });
  });

  /* ---------- القاموس (كلمات البحث) ---------- */
  app.get('/api/lib/dict', auth, active, wrap((q, s) => {
    const row = db.prepare('select diff from lib_user where user_id=?').get(q.u.id);
    s.json({ diff: C.cleanDiff(J(row && row.diff, {})), view: C.describe(baseDict(), J(row && row.diff, {})), version: baseDict().version });
  }));
  app.put('/api/lib/dict', auth, active, wrap((q, s) => {
    const diff = C.cleanDiff(q.body && q.body.diff);
    db.prepare('insert into lib_user(user_id,diff,updated_at) values(?,?,?) on conflict(user_id) do update set diff=excluded.diff, updated_at=excluded.updated_at').run(q.u.id, JSON.stringify(diff), now());
    s.json({ diff, view: C.describe(baseDict(), diff) });
  }));
  // المدير: يعدّل القاموس الافتراضي للجميع (نفس المحرّر؛ التعديلات تُطبَّق على الأصل نفسه)
  const applyToBase = diff => {
    const base = baseDict(), eff = C.effective(base, diff);
    return Object.assign({}, base, { version: new Date().toISOString().slice(0, 10) + '*', gold: eff.gold, bigBrands: eff.bigBrands, niches: eff.niches.map(n => ({ id: n.id, name: n.name, comps: n.comps })) });
  };
  app.get('/api/admin/lib/dict', auth, admin, wrap((q, s) => s.json({ diff: C.cleanDiff({}), view: C.describe(baseDict(), {}), version: baseDict().version, custom: !!kvGet('default_dict') })));
  app.put('/api/admin/lib/dict', auth, admin, wrap((q, s) => {
    kvSet('default_dict', JSON.stringify(applyToBase(q.body && q.body.diff))); baseCache = null;
    s.json({ diff: C.cleanDiff({}), view: C.describe(baseDict(), {}), version: baseDict().version, custom: true });
  }));
  app.post('/api/admin/lib/dict/reset', auth, admin, wrap((q, s) => {
    db.prepare('delete from lib_kv where k=?').run('default_dict'); baseCache = null;
    s.json({ view: C.describe(baseDict(), {}), version: baseDict().version, custom: false });
  }));

  /* ---------- تنزيل الإضافة: تُولَّد عند التنزيل وتُربط بدومين المنصة ---------- */
  const walk = (dir, base = '') => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => d.isDirectory() ? walk(path.join(dir, d.name), base + d.name + '/') : [{ name: base + d.name, file: path.join(dir, d.name) }]);
  const zipCache = new Map();
  function extZip(hosts) {
    const k = hosts.join('|'), hit = zipCache.get(k);
    if (hit) return hit;
    const matches = hosts.map(h => `*://${h}/*`);
    const files = walk(EXT_DIR).map(f => {
      let data = fs.readFileSync(f.file);
      if (f.name === 'manifest.json') {
        const m = JSON.parse(data.toString('utf8'));
        m.content_scripts.forEach(c => { if ((c.js || []).includes('relay.js')) c.matches = matches; });
        m.host_permissions = (m.host_permissions || []).filter(x => !x.includes('YOUR-PLATFORM-DOMAIN')).concat(matches);
        data = Buffer.from(JSON.stringify(m, null, 2));
      }
      return { name: 'radar-ad-collector/' + f.name, data };
    });
    files.push({ name: 'radar-ad-collector/INSTALL.txt', data: Buffer.from(`إضافة جمع الإعلانات v${EXT_VERSION}

1) فك الضغط في مجلد دائم (لا تحذفه بعد التثبيت).
2) افتح chrome://extensions وفعّل «وضع المطوّر».
3) اضغط «تحميل إضافة غير مضغوطة» واختر المجلد radar-ad-collector.
4) افتح المنصة: ستظهر حالة الإضافة «متصلة» في قسم جمع الإعلانات (إن لم تتصل اضغط F5).

اضغط أيقونة الإضافة في Chrome لترى تقدّم الجمع وتتحكم في الإرسال.
لا تعمل هذه الإضافة إلا مع المنصة التي نزّلتها منها، ولا تخزّن مفاتيح ولا كلمات مرور.
تتطلب Chrome 116 فأحدث على الحاسوب.
`) });
    const buf = zip(files); zipCache.set(k, buf);
    if (zipCache.size > 8) zipCache.delete(zipCache.keys().next().value);
    return buf;
  }
  app.get('/api/lib/extension.zip', auth, active, wrap((q, s) => {
    s.set({ 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="radar-ad-collector.zip"', 'Cache-Control': 'no-store' }).send(extZip(extHosts(q)));
  }));

  /* ---------- سياسة الاحتفاظ ---------- */
  function purge() {
    try {
      const a = db.prepare("delete from runs where source='adlib' and summary is null and created_at<?").run(now() - CFG.retentionDays * DAY);
      db.prepare('delete from lib_rows where run_id not in (select id from runs)').run();
      db.prepare('delete from lib_excluded where created_at<?').run(now() - CFG.retentionDays * DAY);
      db.prepare('delete from lib_usage where day<?').run(new Date(now() - 8 * DAY).toISOString().slice(0, 10));
      db.prepare('delete from lib_batch where created_at<?').run(now() - 30 * DAY);
      return { stale: Number(a.changes) };
    } catch (e) { console.error('lib purge', e.message); return null; }
  }
  setTimeout(purge, 60e3).unref(); setInterval(purge, 6 * 36e5).unref();
  return { purge, CFG, extZip };
};
