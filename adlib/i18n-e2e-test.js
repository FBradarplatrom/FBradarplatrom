'use strict';
// ترجمة لوحة التحكم: الإنجليزية والفرنسية تُترجَم كاملة (عدا محتوى الإعلانات)، والاتجاه LTR، والعربية لا تحمّل القاموس أصلاً.
// التشغيل: node adlib/i18n-e2e-test.js
const { spawn } = require('child_process'), assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require('playwright');
const PORT = 5880 + Math.floor(Math.random() * 60), BASE = 'http://127.0.0.1:' + PORT, DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-i18n-'));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok', m); };
const SKIP = '[translate=no],[dir=auto],.pc-ti,.pc-sub,.l-chips,script,style,textarea,code,pre';
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: Object.assign({}, process.env, { PORT, JWT_SECRET: 'i'.repeat(40), ADMIN_EMAIL: 'a@t.dz', DB_FILE: path.join(DIR, 'd.db'), NODE_ENV: 'test', BACKUP_DISABLE: '1' }), stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  const b = await chromium.launch();
  try {
    const day = d => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10), f = path.join(DIR, 'ads.json');
    fs.writeFileSync(f, JSON.stringify([['Star projector night light', 18, 'US'], ['Posture corrector for back pain', 40, 'FR'], ['مصباح ليلي يساعد طفلك على النوم', 5, 'DZ']].map(([t, d, c], i) => ({ ad_id: String(700 + i), page_id: 'p' + i, page_name: 'Shop ' + i, status: 'active', country: c, title: t, body: t + '. Free shipping', start_date: day(d), link_url: 'https://s' + i + '.example/p' }))));
    const leftovers = async pg => { await pg.waitForTimeout(500); return pg.evaluate(SK => { const AR = /[؀-ۿ]/, o = []; const w = document.createTreeWalker(document.body, 5); let n; while ((n = w.nextNode())) { if (n.nodeType === 1) { if (n.closest(SK)) continue; ['placeholder', 'title', 'aria-label'].forEach(a => { const v = n.getAttribute(a); if (v && AR.test(v)) o.push(v); }); } else { const p = n.parentElement; if (p && !p.closest(SK) && p.offsetParent !== null && AR.test(n.nodeValue)) o.push(n.nodeValue.trim()); } } return o.filter(x => !/[«"]?[؀-ۿ ]+[»"]? ·|^🟢|^مصباح ليلي/.test(x)); }, SKIP); };
    let first = true;
    for (const L of ['en', 'fr']) {
      const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); await ctx.addInitScript(l => { try { localStorage.setItem('wpr_lang', l); } catch (e) {} }, L);
      const pg = await ctx.newPage(), errs = []; pg.on('pageerror', e => errs.push(e.message));
      if (first) { await pg.request.post(BASE + '/api/register', { data: { email: 'a@t.dz', password: 'password123', name: 'Admin' } }); first = false; }
      else await pg.request.post(BASE + '/api/login', { data: { email: 'a@t.dz', password: 'password123' } });
      await pg.goto(BASE + '/'); await pg.waitForSelector('.dsum h2');
      ok(await pg.evaluate(() => document.getElementById('wpr-app').dir === 'ltr' && document.documentElement.lang) === L, L + ': الاتجاه من اليسار واللغة ' + L);
      ok((await pg.innerText('.dsum h2')).includes(L === 'en' ? 'summary' : 'Résumé') && (await pg.innerText('.nv[data-v="dash"]')).includes(L === 'en' ? 'Dashboard' : 'Tableau de bord'), L + ': لوحة التحكم مترجمة');
      let bad = await leftovers(pg);
      await pg.goto(BASE + '/analyze'); await pg.waitForSelector('#file', { state: 'attached' }); await pg.setInputFiles('#file', f); await pg.waitForSelector('#grid .pc');
      ok(/\d/.test(await pg.innerText('.kpis, #sum, #v-analyze')), L + ': نتائج التحليل تظهر');
      ok((await pg.innerText('#grid')).includes('مصباح ليلي'), L + ': نص الإعلان نفسه لا يُترجَم');
      bad = bad.concat(await leftovers(pg));
      for (const v of ['inbox', 'archive', 'saved', 'settings', 'help', 'integrations', 'subscribers']) { await pg.goto(BASE + '/' + v); bad = bad.concat(await leftovers(pg)); }
      ok(!bad.length, L + ': لا نصوص عربية متبقية في الواجهة' + (bad.length ? ': ' + [...new Set(bad)].slice(0, 8).join(' | ') : ''));
      ok(await pg.evaluate(() => window.__t('حفظ')) === (L === 'en' ? 'Save' : 'Enregistrer'), L + ': دالة الترجمة');
      ok(!errs.length, L + ': لا أخطاء جافاسكربت ' + errs.join(' | '));
      await ctx.close();
    }
    const ctx = await b.newContext(); await ctx.addInitScript(() => { try { if (!localStorage.getItem('wpr_lang')) localStorage.setItem('wpr_lang', 'ar'); } catch (e) {} });
    const pg = await ctx.newPage(); await pg.request.post(BASE + '/api/login', { data: { email: 'a@t.dz', password: 'password123' } });
    await pg.goto(BASE + '/'); await pg.waitForSelector('.dsum h2');
    ok(await pg.evaluate(() => !window.I18N_DICT && document.getElementById('wpr-app').dir === 'rtl') && (await pg.innerText('.dsum h2')).includes('ملخص'), 'العربية: بلا قاموس، من اليمين');
    await pg.click('.wd-lang'); await pg.click('[data-lang="en"]'); await pg.waitForLoadState('load'); await pg.waitForSelector('.dsum h2');
    ok((await pg.innerText('.dsum h2')).includes('summary'), 'تغيير اللغة من القائمة الجانبية');
    console.log(`PASS ${pass} i18n checks`);
  } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; }
  finally { await b.close(); srv.kill(); }
})();
