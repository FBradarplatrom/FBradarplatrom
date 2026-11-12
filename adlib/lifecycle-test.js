'use strict';
// دورة حياة الاشتراك كاملة عبر الخادم الحقيقي (بلا متصفح):
// تجربة مجانية ← انتهاء (توقف الأدوات) ← دفع وقبول (تفعيل) ← تجديد (يُضاف) ← ترقية (تحويل المتبقي بنسبة السعر)
// ← مميزات الباقة ← إعادة تسمية الباقة ← منح يدوي من المدير ← تنبيه «انتهى اشتراكك» مرة واحدة ← قبول مكرر مرفوض.
// التشغيل: node adlib/lifecycle-test.js
const { spawn } = require('child_process'), assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const Database = require('better-sqlite3');
const PORT = 5300 + Math.floor(Math.random() * 80), BASE = 'http://127.0.0.1:' + PORT, DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-life-')), DB = path.join(DIR, 'd.db');
const DAY = 864e5;
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok', m); };
const near = (a, b, tolDays) => Math.abs(a - b) <= (tolDays || 0.02) * DAY;

const env = Object.assign({}, process.env, { PORT, JWT_SECRET: 'x'.repeat(40), ADMIN_EMAIL: 'a@t.dz', DB_FILE: DB, NODE_ENV: 'test', BACKUP_DISABLE: '1', BARIDI_INFO: 'CCP 1', REMIND_FIRST_MS: '800' });
let srv = null;
const up = async () => { srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, stdio: 'ignore' }); for (let i = 0; i < 80; i++) { try { await fetch(BASE + '/api/health'); return; } catch (e) { await new Promise(r => setTimeout(r, 150)); } } };
const down = async () => { srv.kill(); await new Promise(r => setTimeout(r, 400)); };
// عميل بكعكة جلسة خاصة به
const client = () => { let ck = ''; const call = async (method, url, body) => {
  const r = await fetch(BASE + url, { method, headers: Object.assign({ 'content-type': 'application/json', origin: BASE }, ck ? { cookie: ck } : {}), body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
  const sc = r.headers.get('set-cookie'); if (sc) ck = sc.split(',').map(x => x.split(';')[0]).filter(x => /=/.test(x)).join('; ');
  let j = null; try { j = await r.json(); } catch (e) {} return { status: r.status, j };
}; return call; };

(async () => {
  await up();
  try {
    const A = client(), U = client();
    await A('POST', '/api/register', { email: 'a@t.dz', password: 'password123', name: 'admin' });
    await U('POST', '/api/register', { email: 'u@t.dz', password: 'password123', name: 'U' });
    const db = new Database(DB); db.pragma('busy_timeout = 3000');
    const uid = db.prepare("select id from users where email='u@t.dz'").get().id;
    const exp = () => db.prepare('select expires_at from users where id=?').get(uid).expires_at;
    const bill = async () => (await U('GET', '/api/billing')).j;
    const P = (await A('GET', '/api/admin/plans')).j, id = n => P.plans.find(p => p.name === n).id;

    // 1) التجربة المجانية عند التسجيل
    let b = await bill();
    ok(b.plan === 'تجربة مجانية' && near(b.expires_at, Date.now() + 7 * DAY), 'new account: free trial for 7 days');
    ok((await U('GET', '/api/runs')).status === 200, 'tools work during the trial');

    // 2) الانتهاء: الأدوات تتوقف، والدفع متاح
    db.prepare('update users set expires_at=? where id=?').run(Date.now() - 1000, uid);
    ok((await U('GET', '/api/runs')).status === 402 && (await U('GET', '/api/saved')).status === 402, 'expired: research tools stop (402)');
    ok((await U('GET', '/api/billing')).status === 200, 'expired: the subscription page still works so they can pay');

    // 3) الدفع والقبول: 3 أشهر «الأساسية» تبدأ من اليوم
    const pay = async (plan, months) => { const r = await U('POST', '/api/billing/baridi', { plan_id: id(plan), months, ref: 'R' + Math.random() }); assert.ok(r.j && r.j.id, JSON.stringify(r.j)); return r.j.id; };
    let pid = await pay('الأساسية', 3);
    ok((await U('GET', '/api/runs')).status === 402, 'a pending payment does not activate anything');
    await A('POST', '/api/admin/payments/' + pid + '/approve', {});
    b = await bill();
    ok(b.plan === 'الأساسية' && near(b.expires_at, Date.now() + 90 * DAY), 'approved: Basic active for 90 days from today');
    ok((await U('GET', '/api/runs')).status === 200, 'tools work again after payment');
    ok((await A('POST', '/api/admin/payments/' + pid + '/approve', {})).status === 400 && near(exp(), Date.now() + 90 * DAY), 'approving the same payment twice is refused (no double days)');

    // 4) التجديد قبل الانتهاء: يُضاف إلى ما بقي
    pid = await pay('الأساسية', 3); await A('POST', '/api/admin/payments/' + pid + '/approve', {});
    ok(near(exp(), Date.now() + 180 * DAY), 'renewing early adds to the remaining time (180 days)');

    // 5) الترقية: المتبقي يُحوَّل بنسبة السعر الشهري ثم تُضاف مدة الباقة الجديدة
    const basic = P.plans.find(p => p.name === 'الأساسية').price, adv = P.plans.find(p => p.name === 'المتقدمة').price;
    pid = await pay('المتقدمة', 3); await A('POST', '/api/admin/payments/' + pid + '/approve', {});
    b = await bill();
    ok(b.plan === 'المتقدمة' && near(b.expires_at, Date.now() + 180 * DAY * basic / adv + 90 * DAY, 0.05), `upgrade: remaining 180 Basic days become ${Math.round(180 * basic / adv)} Advanced days, plus 90`);
    ok(b.limits.searchesPerDay === 60, 'upgrade: the new plan limits apply at once');

    // 6) مميزات الباقة: ميزة تُزال من الباقة تُرفض للمشترك فوراً
    const save = async (fn) => { const L = (await A('GET', '/api/admin/plans')).j; L.plans.forEach(fn); return A('PUT', '/api/admin/plans', { plans: L.plans, periods: L.periods }); };
    await save(p => { if (p.name === 'المتقدمة') p.features = p.features.filter(k => k !== 'gap'); });
    ok((await U('GET', '/api/gap')).status === 403, 'a feature removed from the plan is blocked for its subscribers');
    await save(p => { if (p.name === 'المتقدمة') p.features = p.features.concat('gap'); });
    ok((await U('GET', '/api/gap')).status === 200, 'and works again when added back');

    // 7) إعادة تسمية الباقة: المشتركون يتبعونها (كانوا يفقدون حدودها)
    await save(p => { if (p.name === 'المتقدمة') p.name = 'المتقدمة برو'; });
    b = await bill();
    ok(b.plan === 'المتقدمة برو' && b.limits.searchesPerDay === 60, 'renaming a plan keeps its subscribers on it (same limits)');
    ok((await save(p => { if (p.name === 'المتقدمة برو') p.name = 'الأساسية'; })).status === 400, 'two plans with the same name are refused');

    // 8) المنح اليدوي من المدير: يبقى على باقته إن لم تُختر باقة، ويُضاف للمتبقي
    const before = exp();
    await A('POST', '/api/admin/users/' + uid, { days: 30 });
    ok((await bill()).plan === 'المتقدمة برو' && near(exp(), before + 30 * DAY, 0.01), 'admin +30 days without choosing a plan: keeps the plan, adds 30 days');
    await A('POST', '/api/admin/users/' + uid, { days: -5 });
    ok(near(exp(), before + 25 * DAY, 0.01), 'admin can also remove days');

    // 9) تنبيه «انتهى اشتراكك»: مرة واحدة فقط
    db.prepare('update users set expires_at=? where id=?').run(Date.now() - 36e5, uid);
    await down(); await up(); await new Promise(r => setTimeout(r, 2500));
    const n1 = db.prepare("select count(*) n from notify_log where user_id=? and ev='expiry' and text like '%انتهى اشتراكك%'").get(uid).n;
    await down(); await up(); await new Promise(r => setTimeout(r, 2500));
    const n2 = db.prepare("select count(*) n from notify_log where user_id=? and ev='expiry' and text like '%انتهى اشتراكك%'").get(uid).n;
    ok(n1 === 1 && n2 === 1, 'an "your subscription has ended" alert is sent once (not repeated after restarts)');
    ok((await U('GET', '/api/runs')).status === 402, 'after the end date the tools stop again');
    db.close();
    console.log(`PASS ${pass} subscription lifecycle checks`);
  } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; }
  finally { srv.kill(); fs.rmSync(DIR, { recursive: true, force: true }); }
})();
