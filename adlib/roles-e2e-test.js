'use strict';
// فصل الصلاحيات: ما يخص المدير في أقسام الإدارة فقط، وما يخص المشترك في حسابه فقط.
// التشغيل: node adlib/roles-e2e-test.js
const { spawn } = require('child_process'), assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require('playwright');
const PORT = 5400 + Math.floor(Math.random() * 80), BASE = 'http://127.0.0.1:' + PORT, DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-roles-'));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok', m); };

(async () => {
  const env = Object.assign({}, process.env, { PORT, JWT_SECRET: 'x'.repeat(40), ADMIN_EMAIL: 'a@t.dz', DB_FILE: path.join(DIR, 'd.db'), NODE_ENV: 'test', BACKUP_DISABLE: '1', BARIDI_INFO: 'CCP 1' });
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stderr.on('data', d => log += d);
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  const b = await chromium.launch();
  try {
    const errs = [];
    const page = async (email) => { const p = await (await b.newContext({ locale: 'ar-DZ', viewport: { width: 1300, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message)); await p.request.post(BASE + '/api/register', { data: { email, password: 'password123', name: email[0] } }); return p; };
    const A = await page('a@t.dz'), U = await page('u@t.dz');

    // ---- المدير
    await A.goto(BASE + '/'); await A.waitForSelector('#nav-admin:not([hidden])');
    ok(await A.$eval('.am-i[data-v="sub"]', x => x.hidden), 'admin: no «My subscription» in the account menu (admins have no subscription)');
    await A.goto(BASE + '/subscription'); await A.waitForURL(/\/payments$/);
    ok(true, 'admin: /subscription opens «Plans & payments» instead');
    await A.goto(BASE + '/collect/extension'); await A.waitForSelector('.l-steps');
    ok(!/للمدير|BRIDGE_ORIGINS/.test(await A.textContent('#l-body')), 'admin: the extension tab (a subscriber section) has no admin-only card');
    await A.goto(BASE + '/collect/dictionary'); await A.waitForSelector('#l-body h2');
    ok(!/وضع المدير/.test(await A.textContent('#l-body')), 'admin: the normal dictionary tab edits the admin\'s own dictionary (no admin switch there)');
    await A.goto(BASE + '/platform'); await A.click('.adm-t button:has-text("الإضافة والقاموس")'); await A.waitForSelector('input[data-cfg="ext_store_url"]');
    const t = await A.textContent('#x-aset');
    ok(/القاموس الافتراضي/.test(t) && /BRIDGE_ORIGINS|ضمنها/.test(t), 'admin: extension domains, store link and default dictionary are in «Platform settings ← Extension & dictionary»');
    await A.click('a[href="/collect/dictionary?admin=1"]'); await A.waitForSelector('[data-l="dadminoff"]');
    ok(/وضع المدير/.test(await A.textContent('#l-body')), 'admin: the default dictionary editor opens from platform settings with a clear admin banner');
    await A.click('[data-l="dadminoff"]'); await A.waitForFunction(() => !document.querySelector('[data-l="dadminoff"]'));
    ok(true, 'admin: one click returns to their own dictionary');
    await A.goto(BASE + '/platform'); await A.click('.adm-t button:has-text("النشاط والتواصل")'); await A.waitForSelector('[data-cfg="support_email"]');
    ok(!(await A.$('[data-cfg="ext_store_url"]')), 'the store link is not duplicated in «Business & contact»');

    // ---- المشترك
    for (const u of ['/admin', '/subscribers', '/payments', '/support-inbox', '/platform']) { await U.goto(BASE + u); await U.waitForTimeout(300); ok(!/\/(admin|subscribers|payments|support-inbox|platform)$/.test(U.url()) || !(await U.isVisible('#v-' + { '/admin': 'aover', '/subscribers': 'admin', '/payments': 'abill', '/support-inbox': 'ainbox', '/platform': 'aset' }[u])), 'subscriber cannot open admin page ' + u); }
    ok(await U.$eval('#nav-admin', x => x.hidden), 'subscriber: the admin menu is hidden');
    await U.goto(BASE + '/collect/dictionary?admin=1'); await U.waitForSelector('#l-body h2');
    ok(!/وضع المدير/.test(await U.textContent('#l-body')), 'subscriber: ?admin=1 does nothing');
    for (const [m, u] of [['GET', '/api/admin/lib/dict'], ['PUT', '/api/admin/lib/dict'], ['GET', '/api/admin/config'], ['GET', '/api/admin/users'], ['GET', '/api/admin/plans'], ['GET', '/api/admin/stats'], ['PUT', '/api/admin/features'], ['POST', '/api/admin/payments/1/approve']])
      ok((await U.request.fetch(BASE + u, { method: m, data: {} })).status() === 403, `subscriber API ${m} ${u} → 403`);
    const st = await (await U.request.get(BASE + '/api/lib/stats')).json();
    ok(st.ext && st.ext.hosts === undefined, 'subscriber: server domains are never sent');
    await U.goto(BASE + '/subscription'); await U.waitForSelector('#pay-box .plan-g');
    ok(!(await U.$('[data-acc="plans"]')) && (await U.$$('.pay-sec [data-wac]')).length === 1, 'subscriber: «Payment & renewal» has the plans inline (no duplicate «Pay or change plan» button)');
    await U.goto(BASE + '/integrations'); await U.waitForSelector('#x-mk');
    ok(!(await U.$('[data-cfg]')), 'subscriber: «Integrations» has only personal connections (no platform keys)');
    ok(!errs.length, 'no page errors ' + errs.join(' | '));
    console.log(`PASS ${pass} roles checks`);
  } catch (e) { console.error('FAIL', e.message); console.error(log.slice(-1200)); process.exitCode = 1; }
  finally { await b.close(); srv.kill(); fs.rmSync(DIR, { recursive: true, force: true }); }
})();
