'use strict';
// الاشتراكات كخدمة: الباقات (السعر، المدة، الحدود)، الدفع، التفعيل التلقائي، لوحة إحصائيات المدير، سجل الأخطاء، إعدادات الربط.
//  • CIB والذهبية مباشرة عبر بوابة SATIM (بلا وسيط): register.do ثم confirmOrder.do عند العودة.
//  • البطاقات الدولية عبر Stripe Checkout (إشعار موقّع + تحقق عند العودة)، و PayPal (Orders v2: موافقة ثم capture).
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
  ['alter table plans add column features text', 'alter table plans add column price_usd real default 0', 'alter table plans add column free integer default 0', "alter table payments add column currency text default 'DZD'", 'alter table payments add column ext text']
    .forEach(x => { try { db.exec(x); } catch (e) {} });
  // الباقات الأولى: المدد المعتادة، والسعر يحدده المدير (باقة سعرها 0 لا تُعرض للشراء)
  if (!db.prepare('select count(*) n from plans').get().n) {
    const ins = db.prepare('insert into plans(name,days,price,limits,active,sort) values(?,?,?,?,1,?)'), L = JSON.stringify(LIM.DEF());
    [['شهري', 30, 1], ['ربع سنوي', 90, 2], ['سنوي', 365, 3]].forEach(([n, d, s]) => ins.run(n, d, 0, L, s));
  }
  // الباقة المجانية لتجربة المنصة: تُمنح تلقائياً عند التسجيل (المدة والحدود يعدّلها المدير)
  if (!db.prepare('select count(*) n from plans where free=1').get().n)
    db.prepare('insert into plans(name,days,price,limits,active,sort,free,note) values(?,?,0,?,1,0,1,?)').run('تجربة مجانية', 7, JSON.stringify({ searchesPerDay: 10, gapProducts: 5, aiPerMonth: 10, watchPages: 3 }), 'لتجربة المنصة');
  // كتالوج مميزات الباقات: 8 مدمجة (تُطبَّق فعلاً) + مميزات يضيفها المدير (للعرض في الأسعار). الاسم بثلاث لغات
  db.exec('create table if not exists plan_features(k text primary key, ar text, en text, fr text, builtin integer default 0, shown integer default 1, sort integer default 0)');
  { const EN = { gap: 'Market gaps', supplier: 'Supplier finder', ai: 'AI: ad analysis & beat the competition', watch: 'Competitor tracking', tiktok: 'TikTok trends', profit: 'Profit calculator', alerts: 'Alerts (email/Telegram)', sheets: 'Export to Google Sheets' },
      FR = { gap: 'Opportunités de marché', supplier: 'Recherche de fournisseur', ai: 'IA : analyse des pubs et sortir de la concurrence', watch: 'Suivi des concurrents', tiktok: 'Tendances TikTok', profit: 'Calculateur de profit', alerts: 'Alertes (e-mail/Telegram)', sheets: 'Export vers Google Sheets' };
    const ins = db.prepare('insert or ignore into plan_features(k,ar,en,fr,builtin,shown,sort) values(?,?,?,?,1,1,?)');
    LIM.FEATS.forEach((k, i) => ins.run(k, LIM.FLABEL[k], EN[k], FR[k], i));
    // الاسم القديم لميزة الذكاء الاصطناعي (قبل «الخروج من المنافسة») يُحدَّث، إلا إن غيّره المدير
    db.prepare("update plan_features set ar=?, en=?, fr=? where k='ai' and ar='تحليل الإعلان بالذكاء الاصطناعي'").run(LIM.FLABEL.ai, EN.ai, FR.ai); }
  const catalog = () => db.prepare('select k,ar,en,fr,builtin,shown,sort from plan_features order by sort, rowid').all().map(x => ({ k: x.k, ar: x.ar || '', en: x.en || '', fr: x.fr || '', builtin: !!x.builtin, shown: !!x.shown, sort: x.sort }));
  const catKeys = () => catalog().map(x => x.k);
  const planView = p => ({ id: p.id, name: p.name, days: p.days, price: p.price, price_usd: +p.price_usd || 0, free: !!p.free, features: (() => { const f = J(p.features, null), all = catKeys(); return Array.isArray(f) ? all.filter(k => f.includes(k)) : all; })(), limits: Object.assign(LIM.DEF(), J(p.limits, {})), active: !!p.active, sort: p.sort, note: p.note || '' });
  const plans = (all) => db.prepare('select * from plans' + (all ? '' : ' where active=1 and coalesce(free,0)=0 and (price>0 or price_usd>0)') + ' order by sort, days').all().map(planView);

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
  // للصفحة العامة (الأسعار): الباقات المفعّلة فقط، بلا بيانات داخلية
  app.get('/api/plans/public', (q, s) => {
    const L = db.prepare('select * from plans where active=1 order by sort, days').all().map(planView)
      .map(p => ({ name: p.name, days: p.days, price: p.price, price_usd: p.price_usd, free: p.free, note: p.note, limits: p.limits, features: p.features }));
    s.set('Cache-Control', 'public, max-age=60').json({ plans: L, features: catalog().filter(x => x.shown), methods: { satim: !!(CFG.get('satim_user') && CFG.get('satim_pass')), stripe: !!CFG.get('stripe_secret'), paypal: !!(CFG.get('paypal_client') && CFG.get('paypal_secret')), baridi: !!(CFG.get('baridi_info') || CFG.get('support_whatsapp')) } });
  });
  app.get('/api/billing', auth, wrap((q, s) => {
    const u = q.u;
    s.json({
      plan: u.plan, expires_at: u.expires_at, role: u.role, features: LIM.featuresOf(u), featureLabels: LIM.FLABEL, limits: LIM.limitsOf(u), usage: LIM.usage(u), labels: LIM.LABEL,
      plans: plans(false), methods: { satim: !!(CFG.get('satim_user') && CFG.get('satim_pass')), stripe: !!CFG.get('stripe_secret'), paypal: !!(CFG.get('paypal_client') && CFG.get('paypal_secret')), baridi: CFG.get('baridi_info') || '', whatsapp: CFG.get('support_whatsapp') || '' },
      payments: db.prepare('select id,plan_name,days,amount,method,status,ref,created_at,paid_at,note from payments where user_id=? order by created_at desc limit 12').all(u.id)
    });
  }));
  const getPlan = id => { const p = db.prepare('select * from plans where id=? and active=1 and coalesce(free,0)=0').get(+id); if (!p) throw bad('الباقة غير متاحة'); return p; };
  /* ---------- الدفع الإلكتروني: SATIM (CIB/الذهبية) · Stripe · PayPal ---------- */
  const newPay = (u, p, method, amount, currency) => Number(db.prepare("insert into payments(user_id,plan_id,plan_name,days,amount,currency,method,status,created_at) values(?,?,?,?,?,?,?,'pending',?)")
    .run(u.id, p.id, p.name, p.days, amount, currency, method, now()).lastInsertRowid);
  const failPay = (pid, note) => db.prepare("update payments set status='failed', note=? where id=? and status='pending'").run(str(note, 200), pid);
  const usd = p => Math.round((+p.price_usd || 0) * 100) / 100;
  const SATIM = () => process.env.SATIM_TEST_API || (CFG.get('satim_mode') === 'live' ? 'https://cib.satim.dz/payment/rest' : 'https://test.satim.dz/payment/rest');
  const STRIPE = () => process.env.STRIPE_TEST_API || 'https://api.stripe.com';
  const PAYPAL = () => process.env.PAYPAL_TEST_API || (CFG.get('paypal_mode') === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com');
  const lang = q => (/^(fr|en)/i.test(String(q.get('accept-language') || '')) ? String(q.get('accept-language')).slice(0, 2).toUpperCase() : 'AR');
  async function paypalToken() {
    const r = await fetch(PAYPAL() + '/v1/oauth2/token', { method: 'POST', signal: AbortSignal.timeout(20000), headers: { authorization: 'Basic ' + Buffer.from(CFG.get('paypal_client') + ':' + CFG.get('paypal_secret')).toString('base64'), 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
    const j = await r.json().catch(() => ({})); if (!j.access_token) throw bad('PayPal: ' + (j.error_description || 'تعذّر الاتصال'), 502); return j.access_token;
  }
  app.post('/api/billing/checkout', auth, async (q, s, n) => {
    try {
      const p = getPlan(q.body && q.body.plan_id), method = String(q.body.method || ''), base = baseUrl(q);
      if (method === 'satim') {
        if (!CFG.get('satim_user') || !CFG.get('satim_pass')) throw bad('الدفع بـ CIB/الذهبية غير مفعّل بعد');
        if (!(p.price > 0)) throw bad('لا سعر بالدينار لهذه الباقة');
        const pid = newPay(q.u, p, 'satim', p.price, 'DZD'), back = base + '/api/billing/return/satim?pid=' + pid;
        const qs = new URLSearchParams({ userName: CFG.get('satim_user'), password: CFG.get('satim_pass'), orderNumber: String(pid).padStart(10, '0'), amount: String(Math.round(p.price * 100)), currency: '012',
          returnUrl: back, failUrl: back, language: lang(q), jsonParams: JSON.stringify({ force_terminal_id: CFG.get('satim_terminal') || '', udf1: String(pid) }) });
        const r = await fetch(SATIM() + '/register.do?' + qs, { signal: AbortSignal.timeout(20000) }), j = await r.json().catch(() => ({}));
        if (String(j.errorCode || '0') !== '0' || !j.formUrl) { failPay(pid, j.errorMessage || 'SATIM ' + j.errorCode); throw bad('تعذّر إنشاء صفحة الدفع: ' + (j.errorMessage || j.errorCode || 'SATIM'), 502); }
        db.prepare('update payments set checkout_id=? where id=?').run(str(j.orderId, 80), pid); return s.json({ url: j.formUrl, id: pid });
      }
      if (method === 'stripe') {
        if (!CFG.get('stripe_secret')) throw bad('الدفع بالبطاقة الدولية غير مفعّل بعد');
        if (!(usd(p) > 0)) throw bad('لا سعر بالدولار لهذه الباقة');
        const pid = newPay(q.u, p, 'stripe', usd(p), 'USD');
        const f = new URLSearchParams({ mode: 'payment', 'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': 'usd', 'line_items[0][price_data][unit_amount]': String(Math.round(usd(p) * 100)),
          'line_items[0][price_data][product_data][name]': p.name + ' · ' + p.days + ' days', success_url: base + '/subscription?paid=' + pid, cancel_url: base + '/subscription?failed=' + pid,
          client_reference_id: String(pid), 'metadata[payment_id]': String(pid), customer_email: q.u.email });
        const r = await fetch(STRIPE() + '/v1/checkout/sessions', { method: 'POST', signal: AbortSignal.timeout(20000), headers: { authorization: 'Bearer ' + CFG.get('stripe_secret'), 'content-type': 'application/x-www-form-urlencoded' }, body: f.toString() });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.url) { failPay(pid, j.error && j.error.message); throw bad('Stripe: ' + ((j.error && j.error.message) || 'تعذّر إنشاء صفحة الدفع'), 502); }
        db.prepare('update payments set checkout_id=? where id=?').run(str(j.id, 80), pid); return s.json({ url: j.url, id: pid });
      }
      if (method === 'paypal') {
        if (!CFG.get('paypal_client') || !CFG.get('paypal_secret')) throw bad('PayPal غير مفعّل بعد');
        if (!(usd(p) > 0)) throw bad('لا سعر بالدولار لهذه الباقة');
        const pid = newPay(q.u, p, 'paypal', usd(p), 'USD'), tok = await paypalToken();
        const r = await fetch(PAYPAL() + '/v2/checkout/orders', { method: 'POST', signal: AbortSignal.timeout(20000), headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' },
          body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ reference_id: String(pid), custom_id: String(pid), description: p.name, amount: { currency_code: 'USD', value: usd(p).toFixed(2) } }],
            application_context: { return_url: base + '/api/billing/return/paypal?pid=' + pid, cancel_url: base + '/subscription?failed=' + pid, user_action: 'PAY_NOW', shipping_preference: 'NO_SHIPPING' } }) });
        const j = await r.json().catch(() => ({})), ap = (j.links || []).find(l => l.rel === 'approve' || l.rel === 'payer-action');
        if (!j.id || !ap) { failPay(pid, j.message); throw bad('PayPal: ' + (j.message || 'تعذّر إنشاء الطلب'), 502); }
        db.prepare('update payments set checkout_id=? where id=?').run(str(j.id, 80), pid); return s.json({ url: ap.href, id: pid });
      }
      throw bad('طريقة دفع غير معروفة');
    } catch (e) { n(e.status ? e : bad('تعذّر الاتصال ببوابة الدفع: ' + e.message, 502)); }
  });
  const own = (q) => { const p = db.prepare('select * from payments where id=? and user_id=?').get(+q.query.pid, q.u.id); return p; };
  // العودة من SATIM: نؤكد الطلب من البوابة نفسها (لا نثق في رابط العودة وحده)
  app.get('/api/billing/return/satim', auth, async (q, s) => {
    const p = own(q); if (!p) return s.redirect('/subscription');
    if (p.status === 'paid') return s.redirect('/subscription?paid=' + p.id);
    try {
      const qs = new URLSearchParams({ userName: CFG.get('satim_user'), password: CFG.get('satim_pass'), orderId: p.checkout_id || String(q.query.orderId || ''), language: lang(q) });
      const j = await (await fetch(SATIM() + '/confirmOrder.do?' + qs, { signal: AbortSignal.timeout(20000) })).json();
      db.prepare('update payments set ext=? where id=?').run(JSON.stringify({ ErrorCode: j.ErrorCode, OrderStatus: j.OrderStatus, actionCode: j.actionCode, approvalCode: j.approvalCode, OrderNumber: j.OrderNumber }).slice(0, 500), p.id);
      if (String(j.ErrorCode) === '0' && +j.OrderStatus === 2 && (!j.Amount || +j.Amount >= Math.round(p.amount * 100))) { markPaid(p); return s.redirect('/subscription?paid=' + p.id); }
      failPay(p.id, (j.params && j.params.respCode_desc) || j.actionCodeDescription || j.ErrorMessage || 'رُفض الدفع');
    } catch (e) { failPay(p.id, 'تعذّر التحقق من الدفع'); }
    s.redirect('/subscription?failed=' + p.id);
  });
  // العودة من PayPal: capture
  app.get('/api/billing/return/paypal', auth, async (q, s) => {
    const p = own(q); if (!p) return s.redirect('/subscription');
    if (p.status === 'paid') return s.redirect('/subscription?paid=' + p.id);
    try {
      const tok = await paypalToken(), r = await fetch(PAYPAL() + '/v2/checkout/orders/' + encodeURIComponent(p.checkout_id) + '/capture', { method: 'POST', signal: AbortSignal.timeout(20000), headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: '{}' });
      const j = await r.json().catch(() => ({})), cap = ((((j.purchase_units || [])[0] || {}).payments || {}).captures || [])[0] || {};
      if (j.status === 'COMPLETED' && (!cap.amount || +cap.amount.value >= p.amount)) { markPaid(p); return s.redirect('/subscription?paid=' + p.id); }
      failPay(p.id, j.message || j.status || 'لم يكتمل الدفع');
    } catch (e) { failPay(p.id, 'تعذّر تأكيد PayPal'); }
    s.redirect('/subscription?failed=' + p.id);
  });
  // Stripe: إشعار موقّع (Stripe-Signature: t=…,v1=… = HMAC-SHA256 لـ «t.الجسم الخام» بسر الإشعار)
  app.post('/api/billing/webhook/stripe', (q, s) => {
    const sec = CFG.get('stripe_webhook'), raw = q.rawBody || Buffer.from(''), h = String(q.get('stripe-signature') || '');
    const t = (/t=(\d+)/.exec(h) || [])[1], v1 = [...h.matchAll(/v1=([a-f0-9]{64})/g)].map(m => m[1]);
    if (!sec || !t || !v1.length) return s.sendStatus(400);
    if (Math.abs(Date.now() / 1000 - +t) > 600) return s.sendStatus(400);
    const calc = crypto.createHmac('sha256', sec).update(t + '.').update(raw).digest('hex');
    if (!v1.some(v => crypto.timingSafeEqual(Buffer.from(v), Buffer.from(calc)))) return s.sendStatus(403);
    const ev = J(raw.toString('utf8'), {}), o = (ev.data || {}).object || {}, pid = +((o.metadata && o.metadata.payment_id) || o.client_reference_id || 0);
    const pay = pid && db.prepare('select * from payments where id=?').get(pid);
    if (pay && ev.type === 'checkout.session.completed' && o.payment_status === 'paid' && (!o.amount_total || o.amount_total >= Math.round(pay.amount * 100))) markPaid(pay);
    s.sendStatus(200);
  });
  // BaridiMob / CCP: رقم العملية + صورة الوصل (data URL من المتصفح، مصغّرة)
  app.post('/api/billing/baridi', auth, wrap((q, s) => {
    // طريقتان: الوصل عبر واتساب (اسم المتجر فقط هنا، والوصل يصل في واتساب) أو رقم العملية/صورة الوصل هنا
    const wa = q.body.via === 'whatsapp', store = str(q.body.store, 80);
    const p = getPlan(q.body && q.body.plan_id), ref = wa ? ('WhatsApp · ' + store).slice(0, 100) : str(q.body.ref, 60), img = wa ? '' : String(q.body.proof || '');
    if (!CFG.get('baridi_info') && !(wa && CFG.get('support_whatsapp'))) throw bad('الدفع عبر BaridiMob غير مفعّل');
    if (wa && store.length < 2) throw bad('اكتب اسم متجرك');
    const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(img);
    if (!ref && !m) throw bad('اكتب رقم العملية أو أرفق صورة الوصل');
    if (db.prepare("select count(*) n from payments where user_id=? and status='pending' and method='baridi'").get(q.u.id).n >= 3) throw bad('لديك طلبات قيد المراجعة. انتظر قبولها.');
    let proof = '';
    if (m) { const buf = Buffer.from(m[2], 'base64'); if (buf.length > 3e6) throw bad('الصورة كبيرة جداً'); proof = crypto.randomBytes(12).toString('hex') + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]); fs.writeFileSync(path.join(PROOF_DIR, proof), buf); }
    const id = db.prepare("insert into payments(user_id,plan_id,plan_name,days,amount,method,status,ref,proof,created_at) values(?,?,?,?,?,'baridi','pending',?,?,?)").run(q.u.id, p.id, p.name, p.days, p.price, ref, proof, now()).lastInsertRowid;
    act && act(q.u.id, 'payment_request', q, 'BaridiMob · ' + p.name);
    try { X.notifyAdmins && X.notifyAdmins('💳 طلب دفع BaridiMob جديد: ' + q.u.email + ' · ' + p.name + ' · ' + p.price + ' دج' + (wa ? ' · الوصل عبر واتساب · المتجر: ' + store : ''), '/payments'); } catch (e) {}
    s.json({ id: Number(id) });
  }));
  app.get('/api/billing/payment/:id', auth, async (q, s, n) => {
    try {
      let p = db.prepare('select * from payments where id=? and user_id=?').get(+q.params.id, q.u.id); if (!p) throw bad('غير موجود', 404);
      if (p.status === 'pending' && p.method === 'stripe' && p.checkout_id && CFG.get('stripe_secret')) {
        const j = await (await fetch(STRIPE() + '/v1/checkout/sessions/' + encodeURIComponent(p.checkout_id), { signal: AbortSignal.timeout(15000), headers: { authorization: 'Bearer ' + CFG.get('stripe_secret') } })).json().catch(() => ({}));
        if (j.payment_status === 'paid') { markPaid(p); p = db.prepare('select * from payments where id=?').get(p.id); }
      }
      s.json({ id: p.id, status: p.status, plan_name: p.plan_name, days: p.days, amount: p.amount, currency: p.currency || 'DZD', method: p.method, note: p.note || '' });
    } catch (e) { n(e); }
  });

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
  app.get('/api/admin/plans', auth, admin, wrap((q, s) => s.json({ plans: plans(true), keys: LIM.KEYS, labels: LIM.LABEL, cat: catalog() })));
  // المدير: إضافة ميزة، تعديل اسمها، إخفاء ميزة مدمجة من الأسعار، حذف ميزة مضافة
  app.put('/api/admin/features', auth, admin, wrap((q, s) => {
    const list = Array.isArray(q.body && q.body.list) ? q.body.list.slice(0, 60) : [], cur = new Map(catalog().map(x => [x.k, x])), keep = new Set();
    const up = db.prepare('update plan_features set ar=?, en=?, fr=?, shown=?, sort=? where k=?'), ins = db.prepare('insert into plan_features(k,ar,en,fr,builtin,shown,sort) values(?,?,?,?,0,?,?)');
    list.forEach((f, i) => {
      const ar = str(f.ar, 80), en = str(f.en, 80), fr = str(f.fr, 80); if (!ar && !en && !fr) return;
      if (f.k && cur.has(f.k)) { up.run(ar || cur.get(f.k).ar, en, fr, f.shown === false ? 0 : 1, i, f.k); keep.add(f.k); }
      else { const k = 'c_' + crypto.randomBytes(4).toString('hex'); ins.run(k, ar || en || fr, en, fr, f.shown === false ? 0 : 1, i); keep.add(k);
        // ميزة جديدة: تُضاف إلى الباقات المحددة (افتراضياً كل الباقات المدفوعة)
        const to = Array.isArray(f.plans) ? f.plans.map(Number) : null;
        for (const p of db.prepare('select id,features,free from plans').all()) { let a = J(p.features, null); if (!Array.isArray(a)) a = [...cur.keys()];   // باقة بلا قائمة محفوظة: تُثبَّت مميزاتها الحالية أولاً
          if (!(to ? !to.includes(p.id) : p.free)) a = a.concat(k); db.prepare('update plans set features=? where id=?').run(JSON.stringify(a), p.id); } }
    });
    for (const [k, x] of cur) if (!x.builtin && !keep.has(k)) db.prepare('delete from plan_features where k=?').run(k);   // المدمجة لا تُحذف
    act && act(q.u.id, 'admin_plans', q, 'مميزات الباقات');
    s.json({ cat: catalog() });
  }));
  app.put('/api/admin/plans', auth, admin, wrap((q, s) => {
    const list = Array.isArray(q.body && q.body.plans) ? q.body.plans.slice(0, 20) : [];
    const up = db.prepare('update plans set name=?, days=?, price=?, limits=?, active=?, sort=?, note=?, price_usd=?, free=?, features=? where id=?'), ins = db.prepare('insert into plans(name,days,price,limits,active,sort,note,price_usd,free,features) values(?,?,?,?,?,?,?,?,?,?)');
    for (const p of list) {
      const name = str(p.name, 30), days = Math.max(1, Math.min(3650, Math.floor(+p.days || 30))), price = Math.max(0, Math.min(1e7, Math.floor(+p.price || 0)));
      if (!name) continue;
      const L = {}; for (const k of LIM.KEYS) { const v = Math.floor(+((p.limits || {})[k])); if (v > 0) L[k] = Math.min(1e6, v); }
      const pu = Math.max(0, Math.min(1e5, Math.round((+p.price_usd || 0) * 100) / 100)), fr = p.free ? 1 : 0, fe = JSON.stringify(Array.isArray(p.features) ? catKeys().filter(k => p.features.includes(k)) : catKeys());
      if (p.id) up.run(name, days, price, JSON.stringify(L), p.active ? 1 : 0, +p.sort || 0, str(p.note, 120), pu, fr, fe, +p.id); else ins.run(name, days, price, JSON.stringify(L), p.active ? 1 : 0, +p.sort || 0, str(p.note, 120), pu, fr, fe);
    }
    act && act(q.u.id, 'admin_plans', q, list.length + ' باقة');
    s.json({ plans: plans(true) });
  }));

  /* ---------- المدير: لوحة الإحصائيات ---------- */
  app.get('/api/admin/stats', auth, admin, wrap((q, s) => {
    const t = now(), g = (sql, ...a) => db.prepare(sql).get(...a) || {}, mStart = new Date(new Date(t).toISOString().slice(0, 7) + '-01T00:00:00Z').getTime();
    const months = []; for (let i = 11; i >= 0; i--) { const d = new Date(t); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i); months.push(d.toISOString().slice(0, 7)); }
    const rev = new Map(db.prepare("select strftime('%Y-%m', paid_at/1000, 'unixepoch') m, sum(amount) a, count(*) n from payments where status='paid' and coalesce(currency,'DZD')='DZD' and paid_at>=? group by m").all(t - 400 * DAY).map(r => [r.m, r]));
    const day = new Date(t).toISOString().slice(0, 10), d30 = new Date(t - 30 * DAY).toISOString().slice(0, 10);
    s.json({
      users: g('select count(*) n from users').n, active: g("select count(*) n from users where role!='admin' and expires_at>?", t).n,
      newMonth: g('select count(*) n from users where created_at>=?', mStart).n, expiring7: g("select count(*) n from users where role!='admin' and expires_at>? and expires_at<?", t, t + 7 * DAY).n,
      expired30: g("select count(*) n from users where role!='admin' and expires_at<=? and expires_at>?", t, t - 30 * DAY).n,
      revenueMonth: g("select coalesce(sum(amount),0) a from payments where status='paid' and coalesce(currency,'DZD')='DZD' and paid_at>=?", mStart).a,
      revenueMonthUsd: Math.round(g("select coalesce(sum(amount),0) a from payments where status='paid' and currency='USD' and paid_at>=?", mStart).a * 100) / 100, pending: g("select count(*) n from payments where status='pending'").n,
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
      const v = k === 'baridi_info' ? String(b[k] == null ? '' : b[k]).replace(/\r/g, '').replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ').trim().slice(0, 600) : str(b[k], 300);   // معلومات التحويل: تبقى الأسطر
      if (CFG.SECRET.has(k) && /^•+/.test(v)) continue;                               // القيمة المخفية لم تُعدَّل
      if (/_mode$/.test(k) && v && !['test', 'live'].includes(v)) throw bad('الوضع: test أو live');
      if (k === 'ga_id' && v && !/^G-[A-Z0-9]{4,16}$/.test(v)) throw bad('معرّف Google Analytics يبدأ بـ G- مثل G-AB12CD34EF');
      if (k === 'meta_pixel' && v && !/^\d{8,20}$/.test(v)) throw bad('معرّف Meta Pixel أرقام فقط (8 إلى 20 رقماً)');
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
