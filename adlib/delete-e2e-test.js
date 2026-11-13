'use strict';
// اختبار متصفح لخيارات الحذف (13.19): «الرسائل الواردة» في الدعم (أرشفة/إرجاع/حذف)، حذف إعلان أو كل إعلانات منتج في «ثغرات السوق»،
// تحديد عدة تحليلات وحذفها في «الخروج من المنافسة»، وحذف طلبات الدفع غير المقبولة (المشترك والمدير). التشغيل: node adlib/delete-e2e-test.js
const { spawn } = require('child_process'), assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require('playwright');
const PORT = 5300 + Math.floor(Math.random() * 80), BASE = 'http://127.0.0.1:' + PORT, DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-del-'));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok', m); };

(async () => {
  const env = Object.assign({}, process.env, { PORT, JWT_SECRET: 'd'.repeat(40), ADMIN_EMAIL: 'a@t.dz', DB_FILE: path.join(DIR, 'd.db'), NODE_ENV: 'test', BACKUP_DISABLE: '1' });
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stderr.on('data', d => log += d);
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/login'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  const b = await chromium.launch();
  try {
    const A = await b.newPage({ locale: 'ar-DZ', viewport: { width: 1366, height: 1000 } }), U = await b.newPage({ locale: 'ar-DZ', viewport: { width: 1366, height: 1000 } });
    const errs = []; [A, U].forEach(p => p.on('pageerror', e => errs.push(e.message)));
    await A.goto(BASE + '/login'); await U.goto(BASE + '/login');
    await A.request.post(BASE + '/api/register', { data: { email: 'a@t.dz', password: 'password123', name: 'admin' } });
    await U.request.post(BASE + '/api/register', { data: { email: 'u@t.dz', password: 'password123', name: 'U' } });
    const uid = (await (await A.request.get(BASE + '/api/admin/users')).json()).find(x => x.email === 'u@t.dz').id;

    // ---- 1) الدعم: بطاقة «الرسائل الواردة» مع الأرشفة والحذف
    for (const t of ['أهلاً بك في المنصة', 'تذكير بالتجديد', 'عرض خاص']) ok((await A.request.post(BASE + '/api/admin/contact', { data: { user_id: uid, via: 'app', subject: t, text: 'نص: ' + t } })).ok(), 'admin sends «' + t + '»');
    await U.request.post(BASE + '/api/contact', { data: { subject: 'سؤال عن الجمع', message: 'كيف أجمع الإعلانات من السوق؟', category: 'usage' } });
    await U.goto(BASE + '/help'); await U.waitForSelector('[data-a="hcin"]');
    ok(await U.$$eval('.hc-g .hc-c', x => x.length) === 4 && /الرسائل الواردة/.test(await U.textContent('[data-a="hcin"]')), 'a fourth card «Incoming messages» sits with the three help cards');
    ok(/3 جديدة/.test(await U.textContent('[data-a="hcin"]')), 'the card shows how many messages are new');
    await U.click('[data-a="hcin"]');
    ok(await U.$$eval('#hc-in [data-in]', x => x.length) === 3, 'the 3 support messages are listed under «Incoming messages»');
    ok(!/أهلاً بك في المنصة/.test(await U.textContent('.card:has(> h2:text("طلباتي"))')) && /سؤال عن الجمع/.test(await U.textContent('.card:has(> h2:text("طلباتي"))')), '«My requests» now holds only your own requests');
    const row = t => `#hc-in [data-in]:has(b:text("${t}"))`;
    await U.click(row('تذكير بالتجديد') + ' [data-act="archive"]'); await U.waitForFunction(() => document.querySelectorAll('#hc-in [data-in]').length === 2);
    ok(true, 'archive moves a message out of the inbox');
    await U.click('[data-a="hin-f"][data-f="arc"]'); await U.waitForSelector(row('تذكير بالتجديد'));
    ok(await U.$$eval('#hc-in [data-in]', x => x.length) === 1, 'the «Archived» tab shows the archived message');
    await U.click(row('تذكير بالتجديد') + ' [data-act="unarchive"]'); await U.waitForSelector('#hc-in p.muted');
    await U.click('[data-a="hin-f"][data-f="in"]'); await U.waitForFunction(() => document.querySelectorAll('#hc-in [data-in]').length === 3);
    ok(true, 'a message can be moved back to the inbox');
    await U.click(row('عرض خاص') + ' [data-act="delete"]'); await U.click(row('عرض خاص') + ' [data-act="delete"]');
    await U.waitForFunction(() => document.querySelectorAll('#hc-in [data-in]').length === 2);
    ok(true, 'delete (with confirmation) removes one message');
    const adm = await (await A.request.get(BASE + '/api/admin/messages')).json();
    ok(adm.list.some(m => m.subject === 'عرض خاص'), 'a message the subscriber deleted stays in the admin record');
    await U.click('[data-a="hin-all"]'); await U.click('[data-a="hin-all"]'); await U.waitForSelector('#hc-in p.muted');
    ok(!(await U.$('#hc-in [data-in]')), '«Delete all messages» empties the inbox');
    ok((await U.request.post(BASE + '/api/support/mine/' + adm.list.find(m => m.subject === 'سؤال عن الجمع').id + '/delete', { data: {} })).status() === 404, 'only support messages can be deleted this way (not your own requests)');
    const other = await b.newPage(); await other.request.post(BASE + '/api/register', { data: { email: 'o@t.dz', password: 'password123' } });
    ok((await other.request.post(BASE + '/api/support/mine/' + adm.list[0].id + '/archive', { data: {} })).status() === 404, 'a subscriber cannot touch another subscriber’s messages');

    // ---- 2) ثغرات السوق: حذف إعلان واحد (لا يعود) أو الكل دفعة واحدة
    const snap = { v: 2, name: 'Star Light', kw: 'star', cat: 'gem', score: 80, n: 2, images: [], top: { title: 'Star Light', body: 'x', link_url: 'https://example.com/p', country: 'US' } };
    await U.request.put(BASE + '/api/saved', { data: { k: 'star', snap } });
    const gp = (await (await U.request.post(BASE + '/api/gap', { data: { k: 'star' } })).json()).id;
    const mk = (id, level) => ({ level, ev: { why: 'test', score: 5 }, row: { ad_id: String(id), page_name: 'متجر ' + id, status: 'active', library_url: 'https://www.facebook.com/ads/library/?id=' + id, title: 'إعلان ' + id } });
    const push = () => U.request.post(BASE + '/api/gap/' + gp + '/matches', { data: { matches: [mk(701, 'strong'), mk(702, 'strong'), mk(703, 'possible')] } });
    await push();
    await U.goto(BASE + '/gaps/' + gp); await U.waitForSelector('[data-g="mdel"]');
    ok(await U.$$eval('[data-g="mdel"]', x => x.length) === 3, 'every ad has a «Delete» button');
    const id702 = (await (await U.request.get(BASE + '/api/gap/' + gp)).json()).matches.find(m => m.ad_id === '702').id;
    await U.click(`[data-g="mdel"][data-m="${id702}"]`); await U.click(`[data-g="mdel"][data-m="${id702}"]`);
    await U.waitForFunction(() => document.querySelectorAll('[data-g="mdel"]').length === 2);
    ok(true, 'one ad is deleted after confirmation');
    await push();
    let gj = await (await U.request.get(BASE + '/api/gap/' + gp)).json();
    ok(gj.matches.length === 2 && !gj.matches.some(m => m.ad_id === '702'), 'a deleted ad does not come back with the next scan');
    await U.reload(); await U.waitForSelector('[data-g="mdelall"]');
    await U.click('[data-g="mdelall"]'); await U.click('[data-g="mdelall"]'); await U.waitForFunction(() => !document.querySelector('[data-g="mdel"]'));
    gj = await (await U.request.get(BASE + '/api/gap/' + gp)).json();
    ok(!gj.matches.length && gj.verdict !== 'saturated', '«Delete all ads» clears the product’s ads at once');
    ok((await other.request.delete(BASE + '/api/gap/' + gp + '/matches/all')).status() === 404, 'nobody else can delete your ads');

    // ---- 3) الخروج من المنافسة: تحديد عدة تحليلات ثم حذفها
    const { DatabaseSync } = require('node:sqlite'), db = new DatabaseSync(path.join(DIR, 'd.db'));
    const aid = (await (await A.request.get(BASE + '/api/me')).json()).id || 1;
    const ins = db.prepare("insert into edge_runs(user_id,k,name,input,data,status,created_at) values(?,?,?,?,?,'done',?)");
    ['تحليل أ', 'تحليل ب', 'تحليل ج'].forEach((n, i) => ins.run(aid, '', n, '{}', JSON.stringify({ ideas: [] }), Date.now() - i * 1000));
    ins.run(uid, '', 'تحليل المشترك', '{}', '{}', Date.now()); db.close();
    await A.goto(BASE + '/compete'); await A.waitForSelector('.ed-hc .ed-ck');
    ok(await A.$$eval('.ed-hc', x => x.length) === 3 && await A.isDisabled('[data-ed="delsel"]'), 'each analysis has a checkbox, and «Delete selected» waits for a selection');
    await A.check('.ed-hc:has(b:text("تحليل أ")) .ed-ck'); await A.check('.ed-hc:has(b:text("تحليل ج")) .ed-ck');
    ok(/\(2\)/.test(await A.textContent('[data-ed="delsel"]')) && /\/compete$/.test(A.url()), 'ticking a box selects it (does not open the analysis)');
    await A.click('[data-ed="delsel"]'); await A.click('[data-ed="delsel"]');
    await A.waitForFunction(() => document.querySelectorAll('.ed-hc').length === 1);
    ok(/تحليل ب/.test(await A.textContent('.ed-hc')), 'the 2 selected analyses are deleted, the other stays');
    await A.check('[data-ed="selall"]'); ok(/\(1\)/.test(await A.textContent('[data-ed="delsel"]')), '«Select all» ticks every analysis');
    ok((await (await A.request.post(BASE + '/api/edge/delete', { data: { ids: [999, 1, 2, 3, 4] } })).json()).n === 1, 'delete only touches your own analyses');
    const db2 = new DatabaseSync(path.join(DIR, 'd.db')); ok(db2.prepare("select count(*) n from edge_runs where name='تحليل المشترك'").get().n === 1, 'another user’s analysis is untouched'); db2.close();

    // ---- 4) طلبات الدفع: المشترك والمدير يحذفان غير المقبول، والمقبول يبقى
    await A.request.put(BASE + '/api/admin/config', { data: { baridi_info: 'RIP: 00799999000000000000' } });
    const pl = (await (await U.request.get(BASE + '/api/billing')).json()).plans.find(p => !p.free);
    for (const r of ['BM-1', 'BM-2', 'BM-3']) { const x = await U.request.post(BASE + '/api/billing/baridi', { data: { plan_id: pl.id, months: 3, ref: r } }); ok(x.ok(), 'payment request ' + r + ' ' + (x.ok() ? '' : await x.text())); }
    let pays = await (await A.request.get(BASE + '/api/admin/payments')).json(); const P = r => pays.find(p => p.ref === r);
    await A.request.post(BASE + '/api/admin/payments/' + P('BM-1').id + '/approve', { data: {} });
    await A.request.post(BASE + '/api/admin/payments/' + P('BM-2').id + '/reject', { data: { note: 'وصل غير واضح' } });
    await U.goto(BASE + '/subscription'); await U.waitForSelector('#pay-hist');
    await U.click('#pay-hist summary');
    ok(await U.$$eval('#pay-hist [data-paydel]', x => x.length) === 2, 'the subscriber sees «Delete» on the rejected and the pending request, not on the paid one');
    await U.click(`[data-paydel="${P('BM-2').id}"]`); await U.click(`[data-paydel="${P('BM-2').id}"]`);
    await U.waitForFunction(() => document.querySelectorAll('#pay-hist [data-paydel]').length === 1);
    ok(await U.$eval('#pay-hist', d => d.open), 'the rejected request is deleted and the history stays open');
    ok((await U.request.delete(BASE + '/api/billing/payment/' + P('BM-1').id)).status() === 400, 'an approved payment cannot be deleted (accounting record)');
    ok((await other.request.delete(BASE + '/api/billing/payment/' + P('BM-3').id)).status() === 404, 'nobody can delete another subscriber’s payment');
    await A.goto(BASE + '/payments'); await A.waitForSelector('[data-adm="paydel"]');
    ok(await A.$$eval('[data-adm="paydel"]', x => x.length) === 1, 'the admin sees «Delete» only on the request that is not approved');
    await A.click('[data-adm="paydel"]'); await A.click('[data-adm="paydel"]'); await A.waitForFunction(() => !document.querySelector('[data-adm="paydel"]'));
    pays = await (await A.request.get(BASE + '/api/admin/payments')).json();
    ok(pays.length === 1 && pays[0].status === 'paid', 'the admin deleted the pending request; the paid one stays');
    ok((await A.request.post(BASE + '/api/admin/payments/' + pays[0].id + '/delete', { data: {} })).status() === 400, 'even the admin cannot delete an approved payment');
    ok(!errs.length, 'no page errors ' + errs.join(' | '));
    console.log(`PASS ${pass} delete checks`);
  } catch (e) { console.error('FAIL', e.message); console.error(log.slice(-1500)); process.exitCode = 1; }
  finally { await b.close(); srv.kill(); fs.rmSync(DIR, { recursive: true, force: true }); }
})();
