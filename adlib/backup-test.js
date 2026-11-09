'use strict';
// النسخ الاحتياطي: نسخة تلقائية عند التشغيل + نسخة يدوية، تحميلها، فك ضغطها، فتحها كقاعدة بيانات والتأكد من اكتمال البيانات (اختبار استرجاع حقيقي).
// التشغيل: node adlib/backup-test.js
const { spawn } = require('child_process'), assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), zlib = require('zlib');
const PORT = 5600 + Math.floor(Math.random() * 80), BASE = 'http://127.0.0.1:' + PORT, DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-bk-'));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok', m); };
const open = f => { try { return new (require('better-sqlite3'))(f, { readonly: true }); } catch (e) { return new (require('node:sqlite').DatabaseSync)(f); } };
(async () => {
  const env = Object.assign({}, process.env, { PORT, JWT_SECRET: 'b'.repeat(40), ADMIN_EMAIL: 'a@t.dz', DB_FILE: path.join(DIR, 'data.db'), NODE_ENV: 'test', BACKUP_FIRST_MS: '1500', BACKUP_KEEP: '3' });
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stderr.on('data', d => log += d);
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  let ck = '';
  const A = async (m, u, b) => { const r = await fetch(BASE + u, { method: m, headers: Object.assign({ cookie: ck }, b ? { 'content-type': 'application/json' } : {}), body: b ? JSON.stringify(b) : undefined }); const sc = r.headers.get('set-cookie'); if (sc) ck = sc.split(';')[0]; return r; };
  try {
    await A('POST', '/api/register', { email: 'a@t.dz', password: 'password123' });
    for (let i = 0; i < 25; i++) await A('PUT', '/api/saved', { k: 'k' + i, snap: { name: 'منتج ' + i, cat: 'gem' } });
    await new Promise(r => setTimeout(r, 2500));
    let L = await (await A('GET', '/api/admin/backups')).json();
    ok(L.list.length === 1 && /^radar-\d{8}-\d{6}\.db\.gz$/.test(L.list[0].name), 'نسخة تلقائية عند التشغيل: ' + (L.list[0] || {}).name);
    for (let i = 0; i < 4; i++) { await new Promise(r => setTimeout(r, 1100)); const r = await A('POST', '/api/admin/backups'); ok(r.status === 200, 'نسخة يدوية ' + (i + 1)); }
    L = await (await A('GET', '/api/admin/backups')).json();
    ok(L.list.length === 3, 'تُحفظ آخر 3 نسخ فقط (BACKUP_KEEP)');
    const dl = await A('GET', '/api/admin/backups/' + L.list[0].name);
    const gz = Buffer.from(await dl.arrayBuffer());
    ok(dl.status === 200 && gz[0] === 0x1f && gz[1] === 0x8b, 'تحميل النسخة (ملف مضغوط)');
    const restored = path.join(DIR, 'restored.db'); fs.writeFileSync(restored, zlib.gunzipSync(gz));
    const rdb = open(restored);
    ok(rdb.prepare('select count(*) n from users').get().n === 1 && rdb.prepare('select count(*) n from saved').get().n === 25, 'الاسترجاع: النسخة قاعدة بيانات كاملة (الحساب + 25 منتجاً محفوظاً)');
    ok(rdb.prepare("select count(*) n from sqlite_master where type='table'").get().n > 20, 'كل الجداول موجودة في النسخة');
    // غير المدير لا يصل
    const ck0 = ck; ck = ''; await A('POST', '/api/register', { email: 'm@t.dz', password: 'password123' });
    ok((await A('GET', '/api/admin/backups')).status === 403 && (await A('GET', '/api/admin/backups/' + L.list[0].name)).status === 403, 'المشترك العادي لا يرى النسخ ولا يحمّلها'); ck = ck0;
    ok((await A('GET', '/api/admin/backups/..%2Fdata.db')).status === 404, 'لا تحميل لملفات خارج مجلد النسخ');
    console.log(`PASS ${pass} backup checks`);
  } catch (e) { console.error('FAIL', e.message, log.slice(-800)); process.exitCode = 1; }
  finally { srv.kill(); }
})();
