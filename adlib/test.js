'use strict';
// اختبار تكاملي لقسم «جمع الإعلانات»: node adlib/test.js   (أو DB_DRIVER=node node adlib/test.js لمحرك node:sqlite)
const { spawn, execSync } = require('child_process'), assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const C = require('./core.js'), { crc32 } = require('./zip.js'), CORE = require('../engine/core.js');

const PORT = 3900 + Math.floor(Math.random() * 90), DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-')), BASE = 'http://127.0.0.1:' + PORT;
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; };
const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); pass++; };
const NOW = Math.floor(Date.now() / 1000), D = n => NOW - n * 86400;
const ad = (id, o = {}) => ({
  ad_archive_id: String(id), page_id: '100' + id, page_name: 'متجر ' + id, start_date: o.start === undefined ? D(20) : o.start, end_date: o.end || null,
  is_active: o.active === undefined ? true : o.active, collation_count: o.copies || 1, publisher_platform: ['FACEBOOK'],
  snapshot: { body: { text: o.body || 'منتج رائع يزيل البقع بسرعة وبدون حاجة للفرك' }, title: o.title || '', link_url: 'https://shop' + id + '.example/p', cta_text: 'Shop Now', cta_type: 'SHOP_NOW',
    display_format: 'IMAGE', page_like_count: 500, images: [{ resized_image_url: 'https://scontent.example/' + id + '.jpg' }] }
});
function client() {
  let cookie = '';
  return async (method, url, body, raw) => {
    const r = await fetch(BASE + url, { method, redirect: 'manual', headers: Object.assign({ cookie }, body ? { 'content-type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    if (raw) return r;
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch (e) { j = t; }
    return { status: r.status, body: j, headers: r.headers };
  };
}

/* ---------- وحدة: الاحتفاظ والترحيل بلا خادم ---------- */
function unit() {
  const { DatabaseSync } = require('node:sqlite'), db = new DatabaseSync(':memory:');
  db.exec(`create table users(id integer primary key, role text, expires_at integer);
create table runs(id integer primary key, user_id integer, source text, label text, ads integer, summary text, rows text, created_at integer, fp text, counts text);
create table lib_ads(user_id integer, ad_id text, page_id text, page_name text, status integer, start_ts integer, end_ts integer, age_days integer, copies integer, lang text, format text, domain text, link_url text, title text, body text, link_desc text, cta text, cta_group text, image_url text, video_url text, page_likes integer, queries text, niches text, extra text, source text, first_seen integer, last_seen integer, primary key(user_id, ad_id));`);
  const t = Date.now(), DAYMS = 864e5;
  db.prepare('insert into lib_ads(user_id,ad_id,page_name,status,start_ts,age_days,copies,lang,title,body,queries,niches,extra,source,first_seen,last_seen) values(1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('55', 'متجر قديم', 1, NOW - 86400 * 9, 9, 3, 'ar', 'عنوان', 'نص إعلان من المكتبة القديمة', '["يزيل"]', '["المنزل"]', '{}', 'net', t, t);
  const ins = db.prepare('insert into runs(user_id,source,label,ads,rows,created_at,summary) values(?,?,?,?,?,?,?)');
  const addRun = (u, src, label, rows) => ins.run(u.id, src, label, rows.length, JSON.stringify(rows), Date.now(), null).lastInsertRowid;
  const noop = () => {}, app = { get: noop, post: noop, put: noop, delete: noop };
  const mod = require('./index.js')(app, { db, auth: noop, active: noop, admin: noop, wrap: f => f, now: () => Date.now(), DAY: DAYMS, addRun, fpOf: r => String(r.length) });
  const migrated = db.prepare("select * from runs where user_id=1 and source='adlib'").all();
  eq([migrated.length, JSON.parse(migrated[0].rows)[0].body, JSON.parse(migrated[0].rows)[0].status], [1, 'نص إعلان من المكتبة القديمة', 'active'], 'old library is migrated into an inbox batch');
  ok(!db.prepare("select 1 from sqlite_master where name='lib_ads'").get(), 'old library table is dropped');
  // احتفاظ: القديم غير المحلَّل يُحذف، والمحلَّل والحديث والرفع اليدوي يبقون
  const old = t - 60 * DAYMS;
  ins.run(2, 'adlib', 'قديم غير محلل', 1, '[]', old, null); ins.run(2, 'adlib', 'قديم محلل', 1, '[]', old, '[{"x":1}]'); ins.run(2, 'adlib', 'حديث', 1, '[]', t, null); ins.run(2, 'upload', 'ملف قديم', 1, '[]', old, null);
  const r = mod.purge(); eq(r.stale, 1, 'only stale unanalyzed collected batches are purged');
  eq(db.prepare('select label from runs where user_id=2 order by id').all().map(x => x.label), ['قديم محلل', 'حديث', 'ملف قديم'], 'analyzed, fresh and uploaded runs stay');
}

(async () => {
  unit();
  const env = Object.assign({}, process.env, { PORT, JWT_SECRET: 'x'.repeat(40), ADMIN_EMAIL: 'admin@test.dz', DB_FILE: path.join(DIR, 'data.db'), NODE_ENV: 'test',
    LIB_MAX_ADS_PER_BATCH: '6', LIB_MAX_SEARCHES_PER_BATCH: '3', LIB_MAX_SEARCHES_PER_DAY: '4' });
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }

  try {
    const A = client(), U = client(), V = client();
    // ---------- الصفحات والروابط ----------
    for (const p of ['/login.html', '/app.html', '/landing.html', '/app', '/library', '/admin']) eq((await V('GET', p, null, true)).status, 404, p + ' is not exposed');
    for (const p of ['/login', '/register', '/forgot', '/reset?t=abc']) { const r = await V('GET', p, null, true); ok(r.status === 200 && (await r.text()).includes('id="f-login"'), p + ' serves the login page'); }
    const lp = await (await V('GET', '/', null, true)).text(); ok(lp.includes('href="/login"') && lp.includes('href="/register"') && !lp.includes('login.html'), 'landing links are clean');
    const rd = await V('GET', '/collect/dictionary', null, true); eq([rd.status, rd.headers.get('location')], [302, '/login?next=%2Fcollect%2Fdictionary'], 'signed-out deep link goes to login and back');
    ok((await A('POST', '/api/register', { email: 'admin@test.dz', password: 'password123' })).status === 200, 'admin register');
    ok((await U('POST', '/api/register', { email: 'u@test.dz', password: 'password123' })).status === 200, 'user register');
    for (const p of ['/', '/collect', '/collect/dictionary', '/collect/extension', '/inbox', '/analyze', '/archive', '/saved', '/gaps', '/gaps/1', '/settings', '/subscribers']) {
      const r = await U('GET', p, null, true); ok(r.status === 200 && (await r.text()).includes('id="v-collect"'), 'signed-in ' + p + ' serves the app');
    }
    eq([(await U('GET', '/login', null, true)).status, (await U('GET', '/login', null, true)).headers.get('location')], [302, '/'], 'signed-in users skip the login page');
    ok(/no-store/.test((await U('GET', '/api/runs', null, true)).headers.get('cache-control') || ''), 'api responses are never cached (live data)');

    const users = (await A('GET', '/api/admin/users')).body, uid = users.find(x => x.email === 'u@test.dz').id;
    eq((await U('GET', '/api/lib/stats')).status, 402, 'inactive user is blocked');
    await A('POST', '/api/admin/users/' + uid, { days: 30, plan: 'شهري' });
    ok((await U('GET', '/api/lib/stats')).status === 200, 'active user ok');

    // ---------- الجمع يذهب إلى «الواردة» ----------
    const ctx1 = { query: 'يزيل', niche: 'المنزل والمطبخ', country: 'DZ', label: 'جمع: يزيل' };
    const a3 = ad(3, { start: null }); delete a3.is_active;
    let r = await U('POST', '/api/lib/ingest', { batch: 'b1', ads: [ad(1, { copies: 3 }), ad(2, { start: D(3) }), a3], ctx: ctx1 });
    eq([r.status, r.body.added, r.body.updated, r.body.rejected], [200, 3, 0, 0], 'ingest 3');
    const runs = (await U('GET', '/api/runs')).body, run = runs.find(x => x.source === 'adlib');
    ok(run && run.ads === 3 && !run.summary && /^جمع: يزيل/.test(run.label), 'a batch appears in the inbox at once: ' + (run && run.label));
    const full = (await U('GET', '/api/runs/' + run.id)).body.rows, row1 = full.find(x => x.ad_id === '1');
    eq([row1.status, row1.days_running, row1.duplicates, row1.start_date], ['active', 20, 3, new Date(D(20) * 1000).toISOString().slice(0, 10)], 'rows use the platform columns');
    eq([full.find(x => x.ad_id === '3').status, full.find(x => x.ad_id === '3').days_running], ['', ''], 'missing data is never guessed');
    ok(!('score' in row1) && !('stage' in row1) && !('gold_strong' in row1), 'no preliminary scoring or tags at collection');
    const n1 = CORE.normRow(row1); ok(n1.body && n1.link_url && n1.start && n1.collected && n1.stat === 'active', 'the platform engine reads the rows');

    // ---------- إعادة الرصد تحدّث ولا تكرّر ----------
    r = await U('POST', '/api/lib/ingest', { batch: 'b1', ads: [ad(1, { copies: 5 }), ad(4)], ctx: { query: 'حل', niche: '' } });
    eq([r.body.added, r.body.updated, r.body.run === run.id], [1, 1, true], 'same batch, same inbox row');
    const r2 = (await U('GET', '/api/runs/' + run.id)).body.rows;
    eq([r2.length, r2.find(x => x.ad_id === '1').duplicates, r2.find(x => x.ad_id === '1').search_terms], [4, 5, 'يزيل | حل'], 'merged: copies updated, searches union');
    eq((await U('GET', '/api/runs')).body.find(x => x.id === run.id).ads, 4, 'inbox count follows the batch');
    const dom = ad(1, { copies: 1 }); dom._src = 'dom';
    await U('POST', '/api/lib/ingest', { batch: 'b1', ads: [dom], ctx: {} });
    eq((await U('GET', '/api/runs/' + run.id)).body.rows.find(x => x.ad_id === '1').duplicates, 5, 'page-scrape never overwrites network capture');
    // سقف الدفعة
    r = await U('POST', '/api/lib/ingest', { batch: 'b1', ads: [ad(5), ad(6), ad(7), ad(8)], ctx: {} });
    eq([r.body.added, r.body.rejected, r.body.total], [2, 2, 6], 'batch cap enforced (6)');
    // دفعة أخرى = صف آخر في الواردة
    await U('POST', '/api/lib/ingest', { batch: 'b2', ads: [ad(9)], ctx: { label: 'جمع: ثانٍ' } });
    eq((await U('GET', '/api/runs')).body.filter(x => x.source === 'adlib').length, 2, 'each collection is its own inbox row');
    // بعد التحليل لا تُغيَّر الدفعة: التكملة تفتح صفاً جديداً
    await U('PUT', '/api/runs/' + run.id + '/summary', { summary: [{ k: 1 }], counts: {} });
    r = await U('POST', '/api/lib/ingest', { batch: 'b1', ads: [ad(10)], ctx: { label: 'جمع: يزيل' } });
    ok(r.body.run !== run.id && (await U('GET', '/api/runs')).body.find(x => x.id === r.body.run).label.includes('تكملة'), 'an analyzed batch is never modified');
    eq((await U('POST', '/api/lib/ingest', { ads: 'x' })).status, 400, 'bad payload rejected');
    eq((await U('POST', '/api/lib/ingest', { batch: 'z', ads: [{ foo: 1 }, null, 5], ctx: {} })).body.skipped, 3, 'garbage is skipped, not stored');

    // ---------- الحدود ----------
    eq((await U('POST', '/api/lib/batch', { count: 4 })).status, 429, 'batch cap');
    eq((await U('POST', '/api/lib/batch', { count: 3 })).status, 200, 'batch ok');
    for (let i = 0; i < 4; i++) eq((await U('POST', '/api/lib/tick')).status, 200, 'tick ' + i);
    eq((await U('POST', '/api/lib/tick')).status, 429, 'daily cap');
    const st = (await U('GET', '/api/lib/stats')).body;
    ok(st.limits.maxDay === 4 && st.retention.days === 45 && st.ext.hosts === undefined, 'members never see server/domain details');
    ok((await A('GET', '/api/lib/stats')).body.ext.hosts.includes('127.0.0.1'), 'admin sees the bound domains');

    // ---------- القاموس (كلمات البحث) ----------
    r = await U('GET', '/api/lib/dict'); ok(r.body.view.gold.ar.strong.length >= 14 && r.body.view.niches.length === 10, 'dict view');
    const diff = r.body.diff; diff.gold.ar.strong.off.push('يزيل'); diff.gold.ar.strong.add.push('بقع');
    r = await U('PUT', '/api/lib/dict', { diff }); ok(r.status === 200 && r.body.view.gold.ar.strong.find(x => x.t.split('/')[0] === 'يزيل').s === 'off' && r.body.view.gold.ar.strong.some(x => x.t === 'بقع' && x.s === 'custom'), 'user dictionary saved as a diff');
    ok((await A('GET', '/api/lib/dict')).body.view.gold.ar.strong.find(x => x.t.split('/')[0] === 'يزيل').s === 'def', 'other users keep the default');
    r = await U('PUT', '/api/lib/dict', { diff: { gold: { ar: { strong: { add: ['x'.repeat(500), '', 5, null] } } } } }); ok(r.body.diff.gold.ar.strong.add.length === 2 && r.body.diff.gold.ar.strong.add[0].length === 80, 'diff sanitized');
    eq((await U('GET', '/api/admin/lib/dict')).status, 403, 'dict admin only');
    const df = (await A('GET', '/api/admin/lib/dict')).body.diff; df.gold.ar.strong.add.push('كلمة_المدير'); await A('PUT', '/api/admin/lib/dict', { diff: df });
    ok((await U('GET', '/api/lib/dict')).body.view.gold.ar.strong.some(x => x.t === 'كلمة_المدير' && x.s === 'def'), 'admin edits reach every user as default');
    eq((await A('POST', '/api/admin/lib/dict/reset')).body.custom, false, 'reset default');

    // ---------- الإضافة المنزَّلة ----------
    for (const old of ['/api/lib/bridge.zip', '/api/lib/ads', '/api/lib/analyze', '/api/lib/export']) eq((await U('GET', old, null, true)).status, 404, old + ' is gone');
    const zr = await U('GET', '/api/lib/extension.zip', null, true); eq(zr.status, 200, 'extension zip');
    ok(/radar-ad-collector\.zip/.test(zr.headers.get('content-disposition')), 'download name');
    const zf = path.join(DIR, 'b.zip'); fs.writeFileSync(zf, Buffer.from(await zr.arrayBuffer()));
    const names = execSync(`unzip -Z1 "${zf}"`).toString().split('\n').filter(Boolean);
    ok(names.every(n => n.startsWith('radar-ad-collector/')) && names.includes('radar-ad-collector/popup.html') && !names.some(n => /status\./.test(n)), 'zip layout: popup, no old status page');
    const m = JSON.parse(execSync(`unzip -p "${zf}" radar-ad-collector/manifest.json`).toString()), relay = m.content_scripts.find(c => (c.js || []).includes('relay.js'));
    ok(relay.matches.includes('*://127.0.0.1/*') && m.host_permissions.includes('*://127.0.0.1/*') && !JSON.stringify(m).includes('YOUR-PLATFORM'), 'manifest bound to the platform host, no placeholder left');
    ok(m.action.default_popup === 'popup.html' && !/جسر/.test(m.name + m.description + m.short_name) && /إضافة/.test(m.name), 'named "extension", has a popup');
    eq(crc32(Buffer.from('123456789')), 0xCBF43926, 'crc32 vector');

    // ---------- حذف المستخدم يحذف بياناته ----------
    await A('DELETE', '/api/admin/users/' + uid);
    eq((await U('GET', '/api/runs')).status === 200 && (await A('GET', '/api/admin/users')).body.some(x => x.id === uid), false, 'user removed');
    console.log('PASS', pass, 'checks');
  } catch (e) {
    console.error('FAIL:', e.message); console.error(log.slice(-1500)); process.exitCode = 1;
  } finally { srv.kill(); fs.rmSync(DIR, { recursive: true, force: true }); }
})();
