'use strict';
// الاشتراكات كخدمة: الباقات (السعر، المدة، الحدود)، الدفع، التفعيل التلقائي، لوحة إحصائيات المدير، سجل الأخطاء، إعدادات الربط.
//  • الدفع بالبطاقة (CIB / الذهبية) عبر Chargily Pay: صفحة دفع آمنة، وعند نجاحه يصل إشعار موقّع (webhook) فيُفعَّل الاشتراك تلقائياً.
//  • BaridiMob / CCP: تحويل ثم رفع وصل الدفع، والمدير يقبله بضغطة فيُفعَّل تلقائياً.
//  • البطاقات الجزائرية لا تدعم الخصم المتكرر، فـ«التجديد» تذكير قبل الانتهاء + دفع بضغطة واحدة.
const crypto = require('crypto'), fs = require('fs'), path = require('path');
const CFG = require('./config.js'), LIM = require('./limits.js'), AI = require('./ai.js');

module.exports = function mountBilling(app, X) {
  const { db, auth, active, admin, wrap, now, act, DATA_DIR } = X;
  const DAY = 864e5;
  const bad = (m, code) => Object.assign(new Error(m), { status: code || 400 });
  const J = (s, d) => { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } };
  const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
  const PROOF_DIR = path.join(DATA_DIR, 'proofs'); fs.mkdirSync(PROOF_DIR, { recursive: true });

  db.exec(`
create table if not exists plans(id integer primary key, name text unique, days integer, price integer default 0, limits text, active integer default 1, sort integer default 0, note text);
create table if not exists payments(id integer primary key, user_id integer, plan_id integer, plan_name text, days integer, amount integer, method text, status text, ref text, proof text, checkout_id text, created_at integer, paid_at integer, note text, admin_id integer);
create index if not exists payments_u on payments(user_id, created_at);
create table if not exists error_logs(id integer primary key, at integer, method text, path text, status integer, msg text, stack text, user_id integer);`);
  // الباقات الأولى: المدد المعتادة، والسعر يحدده المدير (باقة سعرها 0 لا تُعرض للشراء)
  if (!db.prepare('select count(*) n from plans').get().n) {
    const ins = db.prepare('insert into plans(name,days,price,limits,active,sort) values(?,?,?,?,1,?)'), L = JSON.stringify(LIM.DEF());
    [['شهري', 30, 1], ['ربع سنوي', 90, 2], ['سنوي', 365, 3]].forEach(([n, d, s]) => ins.run(n, d, 0, L, s));
  }
  const planView = p => ({ id: p.id, name: p.name, days: p.days, price: p.price, limits: Object.assign(LIM.DEF(), J(p.limits, {})), active: !!p.active, sort: p.sort, note: p.note || '' });
  const plans = (all) => db.prepare('select * from plans' + (all ? '' : ' where active=1 and price>0') + ' order by sort, days').all().map(planView);

  /* ---------- التفعيل ---------- */
  function markPaid(pay, adminId) {
    if (!pay || pay.status === 'paid') return false;
    const u = db.prepare('select id, expires_at from users where id=?').get(pay.user_id); if (!u) return false;
    db.prepare('update users set expires_at=?, plan=? where id=?').run(Math.max(now(), u.expires_at || 0) + pay.days * DAY, pay.plan_name, u.id);
    db.prepare("update payments set status='paid', paid_at=?, admin_id=? where id=?").run(now(), adminId || null, pay.id);
    act && act(u.id, 'payment', null, pay.method + ' · ' + pay.plan_name + ' · ' + pay.amount + ' دج');
    try { X.notify && X.notify(u.id, 'payment', '✅ تم تفعيل اشتراكك: ' + pay.plan_name + ' (' + pay.days + ' يوماً)'); } catch (e) {}
    return true;
  }

  /* ---------- المشترك: باقته واستعماله والدفع ---------- */
  const baseUrl = q => (CFG.get('app_url') || (q.protocol + '://' + q.get('host'))).replace(/\/$/, '');
  app.get('/api/billing', auth, wrap((q, s) => {
    const u = q.u;
    s.json({
      plan: u.plan, expires_at: u.expires_at, role: u.role, limits: LIM.limitsOf(u), usage: LIM.usage(u), labels: LIM.LABEL,
      plans: plans(false), methods: { card: !!CFG.get('chargily_secret'), baridi: CFG.get('baridi_info') || '' },
      payments: db.prepare('select id,plan_name,days,amount,method,status,ref,created_at,paid_at,note from payments where user_id=? order by created_at desc limit 12').all(u.id)
    });
  }));
  const getPlan = id => { const p = db.prepare('select * from plans where id=? and active=1 and price>0').get(+id); if (!p) throw bad('الباقة غير متاحة'); return p; };
  // الدفع بالبطاقة: Chargily Pay (CIB / الذهبية)
  app.post('/api/billing/checkout', auth, (q, s, n) => {
    let p; try { p = getPlan(q.body && q.body.plan_id); } catch (e) { return n(e); }
    const key = CFG.get('chargily_secret'); if (!key) return n(bad('الدفع بالبطاقة غير مفعّل بعد. استعمل BaridiMob أو تواصل مع الإدارة.'));
    const pid = Number(db.prepare("insert into payments(user_id,plan_id,plan_name,days,amount,method,status,created_at) values(?,?,?,?,?,'card','pending',?)").run(q.u.id, p.id, p.name, p.days, p.price, now()).lastInsertRowid);
    const live = CFG.get('chargily_mode') === 'live', api = process.env.CHARGILY_TEST_API || (live ? 'https://pay.chargily.net/api/v2' : 'https://pay.chargily.net/test/api/v2'), base = baseUrl(q);   // CHARGILY_TEST_API للاختبار فقط
    fetch(api + '/checkouts', { method: 'POST', signal: AbortSignal.timeout(20000), headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
      body: JSON.stringify({ amount: p.price, currency: 'dzd', success_url: base + '/settings?paid=' + pid, failure_url: base + '/settings?failed=' + pid, webhook_endpoint: base + '/api/billing/webhook/chargily', description: 'رادار المنتجات · ' + p.name, locale: 'ar', metadata: { payment_id: pid } }) })
      .then(r => r.json().then(j => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok || !j.checkout_url) { db.prepare("update payments set status='failed', note=? where id=?").run(str(j && (j.message || JSON.stringify(j.errors || '')), 200), pid); throw bad('تعذّر إنشاء صفحة الدفع: ' + ((j && j.message) || 'رد غير مفهوم'), 502); }
        db.prepare('update payments set checkout_id=? where id=?').run(str(j.id, 80), pid); s.json({ url: j.checkout_url, id: pid });
      }).catch(e => n(e.status ? e : bad('تعذّر الاتصال ببوابة الدفع: ' + e.message, 502)));
  });
  // إشعار Chargily الموقّع: يُتحقق من التوقيع (HMAC-SHA256 للجسم الخام بالمفتاح السري) قبل أي تفعيل
  app.post('/api/billing/webhook/chargily', (q, s) => {
    const key = CFG.get('chargily_secret'), sig = String(q.get('signature') || ''), raw = q.rawBody || Buffer.from('');
    if (!key || !sig) return s.sendStatus(400);
    const calc = crypto.createHmac('sha256', key).update(raw).digest('hex');
    if (calc.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(sig))) return s.sendStatus(403);
    const ev = J(raw.toString('utf8'), {}), d = ev.data || {}, pid = +((d.metadata && d.metadata.payment_id) || 0);
    const pay = pid ? db.prepare('select * from payments where id=?').get(pid) : db.prepare('select * from payments where checkout_id=?').get(String(d.id || ''));
    if (!pay) return s.sendStatus(200);
    if (ev.type === 'checkout.paid' && (!d.amount || +d.amount >= pay.amount)) markPaid(pay);
    else if (ev.type === 'checkout.failed' || ev.type === 'checkout.canceled' || ev.type === 'checkout.expired') db.prepare("update payments set status='failed' where id=? and status='pending'").run(pay.id);
    s.sendStatus(200);
  });
  // BaridiMob / CCP: رقم العملية + صورة الوصل (data URL من المتصفح، مصغّرة)
  app.post('/api/billing/baridi', auth, wrap((q, s) => {
    const p = getPlan(q.body && q.body.plan_id), ref = str(q.body.ref, 60), img = String(q.body.proof || '');
    if (!CFG.get('baridi_info')) throw bad('الدفع عبر BaridiMob غير مفعّل');
    const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(img);
    if (!ref && !m) throw bad('اكتب رقم العملية أو أرفق صورة الوصل');
    if (db.prepare("select count(*) n from payments where user_id=? and status='pending' and method='baridi'").get(q.u.id).n >= 3) throw bad('لديك طلبات قيد المراجعة. انتظر قبولها.');
    let proof = '';
    if (m) { const buf = Buffer.from(m[2], 'base64'); if (buf.length > 3e6) throw bad('الصورة كبيرة جداً'); proof = crypto.randomBytes(12).toString('hex') + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]); fs.writeFileSync(path.join(PROOF_DIR, proof), buf); }
    const id = db.prepare("insert into payments(user_id,plan_id,plan_name,days,amount,method,status,ref,proof,created_at) values(?,?,?,?,?,'baridi','pending',?,?,?)").run(q.u.id, p.id, p.name, p.days, p.price, ref, proof, now()).lastInsertRowid;
    act && act(q.u.id, 'payment_request', q, 'BaridiMob · ' + p.name);
    try { X.notifyAdmins && X.notifyAdmins('💳 طلب دفع BaridiMob جديد: ' + q.u.email + ' · ' + p.name + ' · ' + p.price + ' دج'); } catch (e) {}
    s.json({ id: Number(id) });
  }));
  app.get('/api/billing/payment/:id', auth, wrap((q, s) => { const p = db.prepare('select id,status,plan_name,days,amount,method from payments where id=? and user_id=?').get(+q.params.id, q.u.id); if (!p) throw bad('غير موجود', 404); s.json(p); }));

  /* ---------- المدير: المدفوعات والباقات ---------- */
  app.get('/api/admin/payments', auth, admin, wrap((q, s) => s.json(db.prepare(`select p.*, u.email from payments p left join users u on u.id=p.user_id ${q.query.status ? 'where p.status=?' : ''} order by p.created_at desc limit 300`).all(...(q.query.status ? [str(q.query.status, 10)] : [])).map(p => Object.assign(p, { proof: !!p.proof })))));
  app.get('/api/admin/payments/:id/proof', auth, admin, (q, s) => { const p = db.prepare('select proof from payments where id=?').get(+q.params.id); if (!p || !p.proof || !/^[a-f0-9]{24}\.(jpg|png|webp)$/.test(p.proof)) return s.sendStatus(404); s.set('Cache-Control', 'private, no-store').sendFile(path.join(PROOF_DIR, p.proof)); });
  app.post('/api/admin/payments/:id/:act', auth, admin, wrap((q, s) => {
    const p = db.prepare('select * from payments where id=?').get(+q.params.id); if (!p) throw bad('غير موجود', 404);
    if (q.params.act === 'approve') { if (!markPaid(p, q.u.id)) throw bad('مدفوع مسبقاً'); act && act(q.u.id, 'admin_payment', q, 'قبول #' + p.id); }
    else if (q.params.act === 'reject') { db.prepare("update payments set status='rejected', note=?, admin_id=? where id=? and status='pending'").run(str(q.body && q.body.note, 200), q.u.id, p.id); act && act(q.u.id, 'admin_payment', q, 'رفض #' + p.id);
      try { X.notify && X.notify(p.user_id, 'payment', '❌ لم يُقبل طلب الدفع ' + p.plan_name + (q.body && q.body.note ? ': ' + q.body.note : '')); } catch (e) {} }
    else throw bad('إجراء غير معروف');
    s.json({ ok: 1 });
  }));
  app.get('/api/admin/plans', auth, admin, wrap((q, s) => s.json({ plans: plans(true), keys: LIM.KEYS, labels: LIM.LABEL })));
  app.put('/api/admin/plans', auth, admin, wrap((q, s) => {
    const list = Array.isArray(q.body && q.body.plans) ? q.body.plans.slice(0, 20) : [];
    const up = db.prepare('update plans set name=?, days=?, price=?, limits=?, active=?, sort=?, note=? where id=?'), ins = db.prepare('insert into plans(name,days,price,limits,active,sort,note) values(?,?,?,?,?,?,?)');
    for (const p of list) {
      const name = str(p.name, 30), days = Math.max(1, Math.min(3650, Math.floor(+p.days || 30))), price = Math.max(0, Math.min(1e7, Math.floor(+p.price || 0)));
      if (!name) continue;
      const L = {}; for (const k of LIM.KEYS) { const v = Math.floor(+((p.limits || {})[k])); if (v > 0) L[k] = Math.min(1e6, v); }
      if (p.id) up.run(name, days, price, JSON.stringify(L), p.active ? 1 : 0, +p.sort || 0, str(p.note, 120), +p.id); else ins.run(name, days, price, JSON.stringify(L), p.active ? 1 : 0, +p.sort || 0, str(p.note, 120));
    }
    act && act(q.u.id, 'admin_plans', q, list.length + ' باقة');
    s.json({ plans: plans(true) });
  }));

  /* ---------- المدير: لوحة الإحصائيات ---------- */
  app.get('/api/admin/stats', auth, admin, wrap((q, s) => {
    const t = now(), g = (sql, ...a) => db.prepare(sql).get(...a) || {}, mStart = new Date(new Date(t).toISOString().slice(0, 7) + '-01T00:00:00Z').getTime();
    const months = []; for (let i = 11; i >= 0; i--) { const d = new Date(t); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i); months.push(d.toISOString().slice(0, 7)); }
    const rev = new Map(db.prepare("select strftime('%Y-%m', paid_at/1000, 'unixepoch') m, sum(amount) a, count(*) n from payments where status='paid' and paid_at>=? group by m").all(t - 400 * DAY).map(r => [r.m, r]));
    const day = new Date(t).toISOString().slice(0, 10), d30 = new Date(t - 30 * DAY).toISOString().slice(0, 10);
    s.json({
      users: g('select count(*) n from users').n, active: g("select count(*) n from users where role!='admin' and expires_at>?", t).n,
      newMonth: g('select count(*) n from users where created_at>=?', mStart).n, expiring7: g("select count(*) n from users where role!='admin' and expires_at>? and expires_at<?", t, t + 7 * DAY).n,
      expired30: g("select count(*) n from users where role!='admin' and expires_at<=? and expires_at>?", t, t - 30 * DAY).n,
      revenueMonth: g("select coalesce(sum(amount),0) a from payments where status='paid' and paid_at>=?", mStart).a, pending: g("select count(*) n from payments where status='pending'").n,
      revenue: months.map(m => ({ m, a: (rev.get(m) || {}).a || 0, n: (rev.get(m) || {}).n || 0 })),
      plans: db.prepare("select plan, count(*) n from users where role!='admin' and expires_at>? group by plan order by n desc").all(t),
      usage: { searchesToday: g('select coalesce(sum(searches),0) n from lib_usage where day=?', day).n, searches30: g('select coalesce(sum(searches),0) n from lib_usage where day>=?', d30).n,
        aiMonth: g('select coalesce(sum(n),0) n from ai_usage where month=?', new Date(t).toISOString().slice(0, 7)).n, ads30: g("select coalesce(sum(ads),0) n from runs where source='adlib' and created_at>=?", t - 30 * DAY).n,
        activeUsers7: g('select count(distinct user_id) n from activity where kind=? and at>=?', 'login', t - 7 * DAY).n },
      errors: { day: g('select count(*) n from error_logs where at>=?', t - DAY).n, list: db.prepare('select at,method,path,status,msg,user_id from error_logs order by at desc limit 50').all() }
    });
  }));
  app.delete('/api/admin/errors', auth, admin, wrap((q, s) => { db.prepare('delete from error_logs').run(); s.json({ ok: 1 }); }));

  /* ---------- المدير: «الربط والتكامل» (مفاتيح المنصة) ---------- */
  app.get('/api/admin/config', auth, admin, wrap((q, s) => s.json({ config: CFG.view(), smtp: !!process.env.SMTP_HOST })));
  app.put('/api/admin/config', auth, admin, wrap((q, s) => {
    const b = q.body || {};
    for (const k of CFG.KEYS) if (b[k] !== undefined) {
      const v = str(b[k], k === 'baridi_info' ? 600 : 300);
      if (CFG.SECRET.has(k) && /^•+/.test(v)) continue;                               // القيمة المخفية لم تُعدَّل
      if (k === 'chargily_mode' && v && !['test', 'live'].includes(v)) throw bad('الوضع: test أو live');
      CFG.set(k, v);
    }
    act && act(q.u.id, 'admin_config', q, Object.keys(b).filter(k => CFG.KEYS.includes(k)).join(','));
    s.json({ config: CFG.view() });
  }));
  app.post('/api/admin/config/test-ai', auth, admin, (q, s, n) => {
    if (!AI.enabled()) return n(bad('لا يوجد مفتاح'));
    AI.chatJSON('Return ONLY JSON {"ok":true}.', 'ping', { timeout: 20000 }).then(r => s.json({ ok: true, model: r.model })).catch(n);
  });

  /* ---------- سجل الأخطاء ---------- */
  X.logError = (e, q) => { try { db.prepare('insert into error_logs(at,method,path,status,msg,stack,user_id) values(?,?,?,?,?,?,?)').run(now(), q ? q.method : '', q ? String(q.originalUrl || q.url || '').slice(0, 200) : '', e.status || 500, String(e.message || e).slice(0, 300), String(e.stack || '').slice(0, 1500), q && q.u ? q.u.id : null); db.prepare('delete from error_logs where id not in (select id from error_logs order by id desc limit 2000)').run(); } catch (x) {} };
  return { markPaid, plans };
};
