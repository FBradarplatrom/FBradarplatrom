'use strict';
// اختبار خادم لقسم «ثغرات السوق الجزائري»: الاقتراح بالذكاء الاصطناعي (خادم OpenAI محاكى)، عزل المستخدمين، الحذف.
// التشغيل: node adlib/gap-test.js
const { spawn } = require('child_process'), assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const PORT = 4500 + Math.floor(Math.random() * 90), BASE = 'http://127.0.0.1:' + PORT, DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-gapt-'));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; };
function client() {
  let cookie = '';
  return async (method, url, body) => {
    const r = await fetch(BASE + url, { method, headers: Object.assign({ cookie }, body ? { 'content-type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch (e) { j = t; } return { status: r.status, body: j };
  };
}
(async () => {
  // خادم OpenAI محاكى: يتحقق من المفتاح والطلب ويرد بـ JSON
  let seen = null;
  const ai = http.createServer((q, s) => { let b = ''; q.on('data', d => b += d); q.on('end', () => {
    seen = { auth: q.headers.authorization, body: JSON.parse(b), path: q.url };
    if (seen.body.model === 'broken-model') { s.writeHead(404, { 'content-type': 'application/json' }); return s.end(JSON.stringify({ error: { message: 'model not found' } })); }
    s.writeHead(200, { 'content-type': 'application/json' });
    s.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ name_ar: 'مصباح ليلي نجوم', name_fr: 'veilleuse projecteur étoiles',
      queries: [{ q: 'مصباح ليلي نجوم', lang: 'ar' }, { q: 'veilleuse étoiles', lang: 'fr' }, { q: 'بروجكتور ليلي للدراري', lang: 'dz' }, { q: 'ينوّم طفلك', lang: 'dz' }, { q: '', lang: 'ar' }],
      keywords: ['نجوم', 'بروجكتور', 'ضوضاء بيضاء', 'veilleuse', 'projecteur'] }) } }] }));
  }); }).listen(0);
  const AIP = ai.address().port;
  const env = Object.assign({}, process.env, { PORT, JWT_SECRET: 'x'.repeat(40), ADMIN_EMAIL: 'a@t.dz', DB_FILE: path.join(DIR, 'd.db'), NODE_ENV: 'test',
    OPENAI_API_KEY: 'sk-test', OPENAI_BASE_URL: 'http://127.0.0.1:' + AIP + '/v1', OPENAI_MODEL: 'broken-model' });
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stderr.on('data', d => log += d);
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  try {
    const A = client(), B = client();
    await A('POST', '/api/register', { email: 'a@t.dz', password: 'password123' });
    await B('POST', '/api/register', { email: 'b@t.dz', password: 'password123' });
    const users = (await A('GET', '/api/admin/users')).body; await A('POST', '/api/admin/users/' + users.find(u => u.email === 'b@t.dz').id, { days: 30, plan: 'شهري' });
    await A('PUT', '/api/saved', { k: 'p1', snap: { v: 2, name: 'Star Projector Night Light', kw: 'night light', images: [], top: { title: 'Helps your baby sleep', body: 'Stars + white noise', country: 'US', link_url: 'https://www.aliexpress.com/item/1005006123456789.html' }, recs: [] } });
    ok((await A('POST', '/api/gap', { k: 'nope' })).status === 404, 'only saved products can be sent');
    const g = (await A('POST', '/api/gap', { k: 'p1' })).body; ok(g.id, 'saved product added');
    ok((await A('POST', '/api/gap', { k: 'p1' })).body.existed, 'adding twice keeps one entry');
    const list = (await A('GET', '/api/gap')).body; ok(list.ai === true && list.products.length === 1 && list.products[0].verdict === 'new', 'list shows AI available and the new product');
    ok(list.products[0].snap.links[0].includes('aliexpress') && list.products[0].snap.country === 'US', 'supplier link and origin market kept');
    // الذكاء الاصطناعي: نموذج معطّل يُتجاوز إلى التالي
    const sg = (await A('POST', '/api/gap/' + g.id + '/suggest', {})).body;
    ok(sg.ai && sg.terms.length === 4 && sg.terms[2].lang === 'dz' && sg.keywords.includes('بروجكتور'), 'AI suggests Algerian terms (Arabic, French, Darija) and product keywords');
    ok(seen.auth === 'Bearer sk-test' && seen.body.model !== 'broken-model' && seen.path === '/v1/chat/completions', 'falls back from a broken model to the next one');
    ok(/Star Projector Night Light/.test(seen.body.messages[1].content), 'prompt carries the product');
    const p = (await A('GET', '/api/gap/' + g.id)).body; ok(p.terms.length === 4 && p.keywords.length >= 5, 'suggestions saved on the product');
    // عزل المستخدمين
    ok((await B('GET', '/api/gap/' + g.id)).status === 404 && (await B('GET', '/api/gap')).body.products.length === 0, 'another user cannot see the product');
    ok((await B('POST', '/api/gap/' + g.id + '/scan', { queries: [{ q: 'x', lang: 'ar' }] })).status === 404, 'another user cannot scan it');
    // فحص بلا عبارات مرفوض
    ok((await A('POST', '/api/gap/' + g.id + '/scan', { queries: [] })).status === 400, 'scan needs at least one term');
    // الحذف
    ok((await A('DELETE', '/api/gap/' + g.id)).status === 200 && (await A('GET', '/api/gap')).body.products.length === 0, 'delete removes it');
    console.log(`PASS ${pass} gap server checks`);
  } catch (e) { console.error('FAIL', e.message); console.error(log.slice(-1200)); process.exitCode = 1; }
  finally { srv.kill(); ai.close(); fs.rmSync(DIR, { recursive: true, force: true }); }
})();
