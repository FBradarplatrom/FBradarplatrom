'use strict';
// فحص شامل: كل أقسام المنصة كمدير، وكمشترك نشط، وكمشترك منتهي، بالعربية والإنجليزية والفرنسية.
// لكل صفحة: لا أخطاء جافاسكربت، لا طلب فاشل (500 أو 403 غير متوقع)، لا نص عربي متبقٍّ في الإنجليزية/الفرنسية،
// والمشترك لا يرى أي قسم إداري ولا يصل إلى واجهات المدير. التشغيل: node adlib/audit-e2e-test.js [--shots dir]
const { spawn } = require('child_process'), assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require('playwright');
const PORT = 6300 + Math.floor(Math.random() * 60), BASE = 'http://127.0.0.1:' + PORT, DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-audit-'));
const SHOTS = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : '';
let pass = 0; const ok = (c, m) => { if (!c && process.env.AUDIT_SOFT) { console.log('XX', m); process.exitCode = 1; return; } assert.ok(c, m); pass++; console.log('ok', m); };
const SKIP = '[translate=no],[dir=auto],.pc-ti,.pc-sub,.l-chips,script,style,textarea,code,pre,option,.noi18n';
const USER_V = ['/', '/collect', '/inbox', '/analyze', '/archive', '/saved', '/compete', '/gaps', '/watch', '/tiktok', '/integrations', '/settings', '/subscription', '/security', '/help', '/guide'];
const ADMIN_V = ['/admin', '/subscribers', '/payments', '/payments/plans', '/payments/methods', '/support-inbox', '/platform', '/platform/wa', '/platform/ai', '/platform/tg', '/platform/legal', '/platform/backup', '/platform/maint', '/platform/err'];
(async () => {
  // هذا الفحص روبوت يفتح ~100 صفحة في الدقيقة (أسرع من أي إنسان)، فيُرفع له حد الطلبات
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: Object.assign({}, process.env, { PORT, JWT_SECRET: 'q'.repeat(40), ADMIN_EMAIL: 'a@t.dz', DB_FILE: path.join(DIR, 'd.db'), NODE_ENV: 'test', RATE_USER_PER_MIN: '100000', BACKUP_DISABLE: '1', SMTP_HOST: 'json', SMTP_USER: 'contact@example.com' }), stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  const b = await chromium.launch(), bad = [];
  const reg = async (email) => { const c = await b.newContext(); const r = await c.request.post(BASE + '/api/register', { data: { email, password: 'password123', name: email.split('@')[0] } }); ok(r.ok(), 'تسجيل ' + email); return c; };
  try {
    const A = await reg('a@t.dz'); await reg('u@t.dz'); await reg('x@t.dz');
    const users = (await (await A.request.get(BASE + '/api/admin/users')).json()), uid = e => (users.users || users).find(u => u.email === e).id;
    await A.request.post(BASE + '/api/admin/users/' + uid('x@t.dz'), { data: { days: -30, plan: 'تجربة مجانية' } });
    const leftovers = pg => pg.evaluate(SK => { const AR = /[؀-ۿ]/, o = []; const w = document.createTreeWalker(document.body, 5); let n;
      while ((n = w.nextNode())) { if (n.nodeType === 1) { if (n.closest(SK)) continue; ['placeholder', 'title', 'aria-label'].forEach(a => { const v = n.getAttribute(a); if (v && AR.test(v) && n.offsetParent !== null) o.push(v); }); }
        else { const p = n.parentElement; if (p && !p.closest(SK) && p.offsetParent !== null && AR.test(n.nodeValue)) o.push(n.nodeValue.trim()); } } return o; }, SKIP);
    for (const [who, email, views] of [['admin', 'a@t.dz', USER_V.concat(ADMIN_V)], ['member', 'u@t.dz', USER_V], ['expired', 'x@t.dz', USER_V]]) {
      for (const L of ['ar', 'en', 'fr']) {
        const ctx = await b.newContext({ viewport: { width: 1300, height: 900 }, locale: { ar: 'ar-DZ', en: 'en-GB', fr: 'fr-FR' }[L] });
        await ctx.addInitScript(l => { try { localStorage.setItem('wpr_lang', l); localStorage.setItem('wpr_onb_hide', '1'); } catch (e) {} }, L);
        await ctx.request.post(BASE + '/api/login', { data: { email, password: 'password123' } });
        const pg = await ctx.newPage(), errs = [], fails = [], left = [];
        pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) errs.push('console: ' + m.text().slice(0, 160)); });
        pg.on('response', r => { const u = r.url(); if (!u.startsWith(BASE + '/api/')) return; const st = r.status();
          if (st >= 500 || (st === 403 && who !== 'expired') || (st === 404 && !/\/api\/(img|gap\/\d)/.test(u))) fails.push(st + ' ' + u.replace(BASE, '')); });
        for (const v of views) {
          await pg.goto(BASE + v); await pg.waitForFunction(() => { const s = document.querySelector('.view:not([hidden])'); return s && !/جارٍ التحميل/.test(s.innerText); }, null, { timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(400);
          if (L !== 'ar') left.push(...(await leftovers(pg)).map(x => v + ': ' + x));
          if (SHOTS && L === 'ar') { fs.mkdirSync(path.join(SHOTS, who), { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, who, (v.replace(/\//g, '_') || '_') + '.png'), fullPage: true }); }
          if (who !== 'admin') {
            const adm = await pg.evaluate(() => { const n = document.getElementById('nav-admin'); return !!(n && n.offsetParent !== null) || [...document.querySelectorAll('.view:not([hidden]) [data-adm]')].length; });
            if (adm) bad.push(who + ' يرى عناصر إدارية في ' + v);
          }
        }
        if (who !== 'admin') {
          for (const v of ADMIN_V) { await pg.goto(BASE + v); await pg.waitForTimeout(200); const vis = await pg.evaluate(() => { const s = document.querySelector('.view:not([hidden])'); return s ? s.id : ''; }); if (/^v-a/.test(vis) || vis === 'v-admin') bad.push(who + ' فتح ' + v + ' (' + vis + ')'); }
          for (const u of ['/api/admin/users', '/api/admin/stats', '/api/admin/config', '/api/admin/wa', '/api/admin/messages', '/api/admin/payments', '/api/admin/mail-status']) { const st = (await ctx.request.get(BASE + u)).status(); if (st !== 403) bad.push(who + ' ' + u + ' → ' + st); }
        }
        if (who === 'expired') { await pg.goto(BASE + '/saved'); await pg.waitForTimeout(300); if (new URL(pg.url()).pathname !== '/') bad.push('المنتهي فتح /saved'); }
        ok(!errs.length, who + '/' + L + ': لا أخطاء جافاسكربت' + (errs.length ? ': ' + [...new Set(errs)].slice(0, 5).join(' | ') : ''));
        ok(!fails.length, who + '/' + L + ': لا طلبات فاشلة' + (fails.length ? ': ' + [...new Set(fails)].slice(0, 8).join(' | ') : ''));
        if (L !== 'ar') ok(!left.length, who + '/' + L + ': لا نص عربي متبقٍّ' + (left.length ? ': ' + [...new Set(left)].slice(0, 12).join(' | ') : ''));
        await ctx.close();
      }
    }
    ok(!bad.length, 'لا تداخل صلاحيات' + (bad.length ? ': ' + [...new Set(bad)].join(' | ') : ''));
    console.log(`PASS ${pass} audit checks`);
  } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; }
  finally { await b.close(); srv.kill(); }
})();
