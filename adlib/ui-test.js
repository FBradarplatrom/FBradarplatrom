'use strict';
// اختبار دخاني للواجهة في jsdom مع إضافة مُحاكاة. يتطلب jsdom خارج المشروع:  NODE_PATH=<path>/node_modules node adlib/ui-test.js
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const { JSDOM, VirtualConsole } = require('jsdom');
const PORT = 3800 + Math.floor(Math.random() * 90), BASE = 'http://127.0.0.1:' + PORT, DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wprui-'));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; }, eq = (a, b, m) => { assert.strictEqual(a, b, m); pass++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const waitFor = async (f, m, ms = 9000) => { const t = Date.now(); while (Date.now() - t < ms) { try { const v = f(); if (v) return v; } catch (e) {} await sleep(40); } throw new Error('timeout: ' + m); };

(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: Object.assign({}, process.env, { PORT, JWT_SECRET: 'y'.repeat(40), ADMIN_EMAIL: 'admin@t.dz', DB_FILE: path.join(DIR, 'd.db'), NODE_ENV: 'test' }), stdio: 'ignore' });
  try {
    for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/'); break; } catch (e) { await sleep(150); } }
    const mkClient = () => { let cookie = ''; const call = async (m, u, b) => { const r = await fetch(BASE + u, { method: m, headers: Object.assign({ cookie }, b ? { 'content-type': 'application/json' } : {}), body: b ? JSON.stringify(b) : undefined }); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0]; return r; }; call.cookie = () => cookie; return call; };
    const call = mkClient(), mcall = mkClient();
    await call('POST', '/api/register', { email: 'admin@t.dz', password: 'password123', name: 'المدير' });
    await mcall('POST', '/api/register', { email: 'm@t.dz', password: 'password123', name: 'عضو' });
    const uid = (await (await call('GET', '/api/admin/users')).json()).find(x => x.email === 'm@t.dz').id; await call('POST', '/api/admin/users/' + uid, { days: 30 });
    const NOW = Math.floor(Date.now() / 1000);
    const mk = (id, o = {}) => ({ ad_archive_id: String(id), page_id: '9' + id, page_name: 'متجر ' + id, start_date: NOW - (o.age || 20) * 86400, is_active: true, collation_count: o.c || 2, snapshot: { body: { text: 'يزيل البقع بسرعة ' + id }, title: 'عنوان ' + id, link_url: 'https://s' + id + '.example', cta_text: 'Shop Now', display_format: 'IMAGE', images: [{ resized_image_url: 'https://scontent.example/' + id + '.jpg' }] } });

    const errors = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message)); vc.on('error', e => errors.push(String(e)));
    const boot = async (client, urlPath, sent) => {
      const html = await (await client('GET', urlPath)).text();
      return new JSDOM(html, { url: BASE + urlPath, runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc, beforeParse(w) {
        w.fetch = (u, o = {}) => fetch(new URL(u, BASE).href, Object.assign({}, o, { headers: Object.assign({ cookie: client.cookie() }, o.headers || {}) }));
        w.CSS = { escape: s => String(s).replace(/[^\w-]/g, c => '\\' + c) }; w.scrollTo = () => {};
        w.postMessage = d => setTimeout(() => w.dispatchEvent(new w.MessageEvent('message', { data: d, origin: BASE, source: w })), 0);   // jsdom لا يملأ origin/source كالمتصفحات
        w.addEventListener('message', ev => { const d = ev.data; if (!d || d.tag !== 'WPR_PAGE') return; sent.push(d);
          const rep = o => w.postMessage(Object.assign({ tag: 'WPR_BRIDGE', evt: 'reply', id: d.id }, o), BASE);
          rep(d.cmd === 'ping' ? { ok: true, version: '1.1.0', state: { active: false } } : d.cmd === 'start' ? { ok: true, id: 'b1' } : { ok: true }); });
      } });
    };

    const sent = [], dom = await boot(call, '/', sent), w = dom.window, doc = w.document, $ = s => doc.querySelector(s), $$ = s => [...doc.querySelectorAll(s)], click = el => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await waitFor(() => $('#me-name') && $('#me-name').textContent, 'app boot');
    eq(w.location.pathname, '/', 'dashboard lives at the root');
    ok(/جمع الإعلانات/.test($('[data-v="collect"]').textContent) && !/مكتبة/.test($('[data-v="collect"]').textContent), 'section is named "جمع الإعلانات"');
    ok(!$('[data-v="library"]') && !/الجسر/.test(doc.body.textContent), 'no "library" and no "bridge" wording');

    // ---------- الجمع ----------
    click($('[data-v="collect"]')); await waitFor(() => /الإضافة متصلة/.test($('#l-body').textContent), 'extension detected');
    eq(w.location.pathname, '/collect', 'collect url');
    ok(!$('[data-lt="library"]') && $$('[data-lt]').length === 3, 'tabs: collect, dictionary, extension (no library)');
    ok($$('[data-g="ar"]').length > 10 && !!$('[data-sm]'), 'golden words and send-mode selector rendered');
    click($('[data-g="ar"]')); click($('[data-c]'));
    await waitFor(() => /ستُنفَّذ/.test($('#l-prev').textContent), 'preview'); click($('[data-l="batch"]'));
    const st = await waitFor(() => sent.find(x => x.cmd === 'start'), 'start sent to the extension');
    ok(/^https:\/\/www\.facebook\.com\/ads\/library\/\?/.test(st.items[0].url) && st.settings.activeOnly === true && /^جمع: /.test(st.label), 'queue handed over with url, active-only, and a batch label');
    const sm = $('[data-sm]'); sm.value = 'manual'; sm.dispatchEvent(new w.Event('change', { bubbles: true })); await waitFor(() => sent.find(x => x.cmd === 'set_mode' && x.mode === 'manual'), 'send mode changed');

    // ---------- مزامنة لحظية: الواردة تتحدّث دون إعادة تحميل ----------
    click($('[data-v="inbox"]')); await waitFor(() => /لم يصلك شيء بعد/.test($('#x-inbox').textContent), 'empty inbox');
    w.postMessage({ tag: 'WPR_BRIDGE', evt: 'ads', seq: 7, batchId: 'bX', label: 'جمع: يزيل البقع', ctx: { query: 'يزيل', niche: 'المنزل والمطبخ', country: 'DZ' }, ads: [mk(1), mk(2, { age: 3 }), mk(3)] }, BASE);
    await waitFor(() => sent.find(x => x.cmd === 'ack' && x.seqs[0] === 7), 'ack after ingest');
    await waitFor(() => $('#x-inbox [data-a="ianalyze"]'), 'the batch shows up in the inbox on its own (no reload)');
    ok(/جمع: يزيل البقع/.test($('#x-inbox').textContent) && /3/.test($('#x-inbox').textContent), 'inbox row has the batch label and count');
    ok($('#nb-inbox') && !$('#nb-inbox').hidden, 'inbox badge updated');
    w.postMessage({ tag: 'WPR_BRIDGE', evt: 'ads', seq: 8, batchId: 'bX', ctx: { query: 'حل' }, ads: [mk(4)] }, BASE);
    await waitFor(() => /4/.test($('#x-inbox tr td:nth-child(4)') ? $('#x-inbox tr:nth-of-type(2) td:nth-child(4)').textContent : ''), 'row count grows live (3 -> 4)');
    eq($$('#x-inbox [data-a="ianalyze"]').length, 1, 'still a single batch row');

    // ---------- التحليل (كان يفشل بـ «لم أجد إعلانات») ----------
    click($('#x-inbox [data-a="ianalyze"]'));
    await waitFor(() => w.location.pathname === '/analyze', 'analysis view opened');
    await sleep(600);
    ok(!/لم أجد إعلانات/.test(($('#msg') || {}).textContent || ''), 'no "no ads found" error');
    const runs = await (await call('GET', '/api/runs')).json();
    await waitFor(async () => true, 'settle'); let analyzed = null;
    for (let i = 0; i < 60 && !analyzed; i++) { const rs = await (await call('GET', '/api/runs')).json(); analyzed = rs.find(r => r.source === 'adlib' && r.summary); if (!analyzed) await sleep(100); }
    ok(analyzed && analyzed.ads === 4, 'engine analysed the collected batch and saved a summary: ' + JSON.stringify(runs.map(r => [r.id, !!r.summary])));

    // ---------- الإرسال اليدوي من المنصة ----------
    click($('[data-v="collect"]')); await waitFor(() => /الإضافة متصلة/.test($('#l-body').textContent), 'back to collect');
    await waitFor(() => $('[data-l="batch"]'), 'collect tab rendered'); await sleep(350);
    w.postMessage({ tag: 'WPR_BRIDGE', evt: 'state', state: { active: true, idx: 0, total: 1, sendMode: 'manual', pending: 5, pushed: 5, sent: 0, items: [{ q: 'يزيل', status: 'running', seen: 5 }] } }, BASE);
    await waitFor(() => $('[data-l="sendnow"]'), 'manual mode shows a send-now button'); ok(/5/.test($('[data-l="sendnow"]').textContent), 'pending count on the button');
    click($('[data-l="sendnow"]')); await waitFor(() => sent.find(x => x.cmd === 'send_now'), 'send_now reaches the extension');
    w.postMessage({ tag: 'WPR_BRIDGE', evt: 'state', state: { active: false, idx: 1, total: 1, sendMode: 'auto', pending: 0, pushed: 5, sent: 5, items: [{ q: 'يزيل', status: 'done', seen: 5 }] } }, BASE);
    await waitFor(() => /انتهى الجمع/.test($('#l-prog').textContent), 'finished card');

    // ---------- الروابط ----------
    click($('[data-lt="dict"]')); await waitFor(() => w.location.pathname === '/collect/dictionary' && $$('.lc[data-d="g"]').length > 50, 'dictionary tab + url');
    const chip = $$('.lc.def[data-d="g"]')[0], t0 = chip.dataset.t; click(chip);
    await waitFor(() => { const c = $$('.lc[data-d="g"]').find(x => x.dataset.t === t0); return c && c.classList.contains('off'); }, 'default word disabled and saved');
    const inp = $('[data-add][data-lg="ar"][data-tr="strong"]'); inp.value = 'كلمة جديدة'; click(inp.parentElement.querySelector('[data-l="dadd"]'));
    await waitFor(() => $$('.lc.custom').some(x => x.dataset.t === 'كلمة جديدة'), 'custom word added');
    ok(!/العلامات الكبيرة|إعادة وسم/.test($('#l-body').textContent), 'dictionary is about search words only');
    click($('[data-lt="ext"]')); await waitFor(() => w.location.pathname === '/collect/extension' && $('a[href="/api/lib/extension.zip"]'), 'extension tab');
    ok(/للمدير/.test($('#l-body').textContent), 'admin sees the admin card');
    w.history.back(); await waitFor(() => w.location.pathname === '/collect/dictionary' && $$('.lc[data-d="g"]').length > 50, 'back returns to the dictionary');
    click($('[data-v="admin"]')); eq(w.location.pathname, '/subscribers', 'subscribers url'); ok(w.document.title.includes('إدارة المشتركين'), 'title follows the section');

    // ---------- العضو العادي لا يرى إرشادات المدير ----------
    const dom3 = await boot(mcall, '/collect/extension', []); const d3 = dom3.window.document;
    await waitFor(() => d3.querySelector('a[href="/api/lib/extension.zip"]'), 'member extension tab');
    const txt = d3.getElementById('l-body').textContent; ok(!/BRIDGE_ORIGINS|للمدير|إعدادات الخادم/.test(txt), 'members see no server/admin guidance');
    ok(!d3.querySelector('[data-v="admin"]') || d3.querySelector('[data-v="admin"]').hidden, 'members do not get the subscribers section'); dom3.window.close();
    ok(errors.filter(m => !/xlsx|Could not load (script|link)|not implemented/i.test(m)).length === 0, 'no script errors: ' + errors.slice(0, 3).join(' | '));
    console.log('PASS', pass, 'UI checks');
  } catch (e) { console.error('FAIL:', e.message); process.exitCode = 1; }
  finally { srv.kill(); fs.rmSync(DIR, { recursive: true, force: true }); process.exit(process.exitCode || 0); }
})();
