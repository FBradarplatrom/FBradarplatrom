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
  ['alter table plans add column totals text', 'alter table plans add column features text', 'alter table plans add column price_usd real default 0', 'alter table plans add column free integer default 0', "alter table payments add column currency text default 'DZD'", 'alter table payments add column ext text']
    .forEach(x => { try { db.exec(x); } catch (e) {} });
  // الباقات: مستويات بسعر شهري، والمشترك يختار المدة (شهر، 3، 6، 12 شهراً) بخصم. المبالغ الافتراضية من عرض الأسعار المعتمد.
  const TIERS = [['الأساسية', 3900, 29, { searchesPerDay: 20, gapProducts: 20, aiPerMonth: 30, watchPages: 5 }, { 6: 21500 }, ''],
    ['المتقدمة', 6900, 49, { searchesPerDay: 60, gapProducts: 80, aiPerMonth: 120, watchPages: 20 }, { 6: 38000 }, 'الأكثر طلباً'],
    ['الاحترافية', 10900, 79, { searchesPerDay: 200, gapProducts: 300, aiPerMonth: 400, watchPages: 60 }, { 6: 60100 }, '']];
  if (!CFG.get('pricing_v2')) {
    db.prepare("update plans set active=0 where name in ('شهري','ربع سنوي','سنوي') and coalesce(free,0)=0").run();   // الباقات القديمة (حسب المدة) تبقى للسجل فقط
    const ins = db.prepare('insert or ignore into plans(name,days,price,price_usd,limits,active,sort,note,totals) values(?,30,?,?,?,1,?,?,?)');
    TIERS.forEach(([n, pr, us, L, t, note], i) => ins.run(n, pr, us, JSON.stringify(L), i + 1, note, JSON.stringify(t)));
    CFG.set('pricing_v2', '1');
  }
  // أسماء الباقات الخاصة بالمنصة (الإصدار 13.8 استعمل أسماء أخرى مؤقتاً): تُعاد تسميتها مع المشتركين ومدفوعاتهم، إلا إن غيّرها المدير
  if (!CFG.get('pricing_names_v3')) {
    [['البداية', 'الأساسية'], ['النمو', 'المتقدمة'], ['الاحتراف', 'الاحترافية']].forEach(([o, n]) => { try {
      if (!db.prepare('select 1 from plans where name=?').get(n) && db.prepare('update plans set name=? where name=?').run(n, o).changes) {
        db.prepare('update users set plan=? where plan=?').run(n, o); db.prepare("update payments set plan_name=? || substr(plan_name, length(?)+1) where plan_name=? or plan_name like ? || ' · %'").run(n, o, o, o);
      } } catch (e) {} });
    CFG.set('pricing_names_v3', '1');
  }
  // 13.10: حذف مدة «شهر» (التجربة المجانية تكفي للبداية)، وحذف الباقات القديمة حسب المدة نهائياً
  // (من كان عليها يُنقل إلى «الأساسية» بنفس تاريخ انتهائه؛ المدفوعات القديمة تبقى في السجل باسمها)
  if (!CFG.get('pricing_v4')) {
    try { const P = JSON.parse(CFG.get('billing_periods') || 'null'); if (Array.isArray(P)) { const Q = P.filter(x => +x.m !== 1); CFG.set('billing_periods', Q.length ? JSON.stringify(Q) : ''); } } catch (e) {}
    const base = db.prepare("select name from plans where coalesce(free,0)=0 and active=1 and name not in ('شهري','ربع سنوي','سنوي') order by sort, id limit 1").get();
    for (const o of ['شهري', 'ربع سنوي', 'سنوي']) {
      const r = db.prepare('select id, active from plans where name=?').get(o); if (!r || r.active) continue;   // باقة قديمة ما زالت مفعّلة (غيّرها المدير) تبقى
      if (base) db.prepare('update users set plan=? where plan=?').run(base.name, o);
      db.prepare('delete from plans where id=?').run(r.id);
    }
    CFG.set('pricing_v4', '1');
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
  // المدد المتاحة وخصم كل مدة (يعدّلها المدير). 12 شهراً = 365 يوماً
  const PER_DEF = [{ m: 3, off: 5 }, { m: 6, off: 8 }, { m: 12, off: 15 }];   // بلا «شهر»: التجربة المجانية هي بداية كل مشترك
  const periodsCfg = () => { let a = null; try { a = JSON.parse(CFG.get('billing_periods') || 'null'); } catch (e) {} return Array.isArray(a) && a.length ? a : PER_DEF; };
  const perLabel = m => m === 1 ? 'شهر' : m === 12 ? '12 شهراً' : m + ' أشهر';
  // سعر الباقة لمدة: المبلغ اليدوي إن ضبطه المدير، وإلا السعر الشهري × الأشهر − الخصم (مقرّب لأقرب 100 دج)
  function priceFor(p, m) {
    const per = periodsCfg().find(x => +x.m === +m); if (!per) return null;
    const tot = J(p.totals, {}) || {}, base = (+p.price || 0) * m, ub = (+p.price_usd || 0) * m, off = Math.max(0, Math.min(90, +per.off || 0));
    const dzd = +tot[m] > 0 && (+tot[m] <= base || !base) ? Math.round(+tot[m]) :   // مبلغ يدوي أعلى من السعر الكامل (بعد تغيير السعر الشهري) يُهمَل
       off ? Math.round(base * (1 - off / 100) / 100) * 100 : base;
    const usdv = ub ? Math.round(ub * (1 - off / 100) * 100) / 100 : 0;
    return { m: +m, days: +m === 12 ? 365 : +m * 30, label: perLabel(+m), dzd, usd: usdv, base, off: base ? Math.max(0, Math.round((1 - dzd / base) * 100)) : off, monthly: Math.round(dzd / m), save: Math.max(0, base - dzd) };
  }
  const periodsOf = p => p.free ? [] : periodsCfg().map(x => priceFor(p, x.m)).filter(x => x && (x.dzd > 0 || x.usd > 0));
  const planView = p => ({ totals: J(p.totals, {}) || {}, periods: periodsOf(p), id: p.id, name: p.name, days: p.days, price: p.price, price_usd: +p.price_usd || 0, free: !!p.free, features: (() => { const f = J(p.features, null), all = catKeys(); return Array.isArray(f) ? all.filter(k => f.includes(k)) : all; })(), limits: Object.assign(LIM.DEF(), J(p.limits, {})), active: !!p.active, sort: p.sort, note: p.note || '' });
  const plans = (all) => db.prepare('select * from plans' + (all ? '' : ' where active=1 and coalesce(free,0)=0 and (price>0 or price_usd>0)') + ' order by sort, days').all().map(planView);

  /* ---------- التفعيل ---------- */
  function markPaid(pay, adminId) {
    if (!pay || pay.status === 'paid') return false;
    const u = db.prepare('select id, expires_at from users where id=?').get(pay.user_id); if (!u) return false;
    const pl = pay.plan_id && db.prepare('select name from plans where id=?').get(pay.plan_id);
    db.prepare('update users set expires_at=?, plan=? where id=?').run(Math.max(now(), u.expires_at || 0) + pay.days * DAY, pl ? pl.name : String(pay.plan_name || '').split(' · ')[0], u.id);
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
      .map(p => ({ name: p.name, days: p.days, price: p.price, price_usd: p.price_usd, free: p.free, note: p.note, limits: p.limits, features: p.features, periods: p.periods }));
    s.set('Cache-Control', 'public, max-age=60').json({ plans: L, periods: periodsCfg(), features: catalog().filter(x => x.shown), methods: { satim: !!(CFG.get('satim_user') && CFG.get('satim_pass')), stripe: !!CFG.get('stripe_secret'), paypal: !!(CFG.get('paypal_client') && CFG.get('paypal_secret')), baridi: !!(CFG.get('baridi_info') || CFG.get('support_whatsapp')) } });
  });
  app.get('/api/billing', auth, wrap((q, s) => {
    const u = q.u;
    s.json({
      plan: u.plan, expires_at: u.expires_at, role: u.role, features: LIM.featuresOf(u), featureLabels: LIM.FLABEL, limits: LIM.limitsOf(u), usage: LIM.usage(u), labels: LIM.LABEL,
      plans: plans(false), periods: periodsCfg(), methods: { satim: !!(CFG.get('satim_user') && CFG.get('satim_pass')), stripe: !!CFG.get('stripe_secret'), paypal: !!(CFG.get('paypal_client') && CFG.get('paypal_secret')), baridi: CFG.get('baridi_info') || '', whatsapp: CFG.get('support_whatsapp') || '' },
      payments: db.prepare('select id,plan_name,days,amount,method,status,ref,created_at,paid_at,note from payments where user_id=? order by created_at desc limit 12').all(u.id)
    });
  }));
  // الباقة + المدة المختارة (months: 1، 3، 6، 12). السعر والأيام من المدة
  const getPlan = (id, months) => { const p = db.prepare('select * from plans where id=? and active=1 and coalesce(free,0)=0').get(+id); if (!p) throw bad('الباقة غير متاحة');
    const per = priceFor(p, +months || +(periodsCfg()[0] || {}).m || 1); if (!per) throw bad('المدة غير متاحة'); return Object.assign({}, p, { per }); };
  /* ---------- الدفع الإلكتروني: SATIM (CIB/الذهبية) · Stripe · PayPal ---------- */
  const newPay = (u, p, method, amount, currency) => Number(db.prepare("insert into payments(user_id,plan_id,plan_name,days,amount,currency,method,status,created_at) values(?,?,?,?,?,?,?,'pending',?)")
    .run(u.id, p.id, p.name + ' · ' + p.per.label, p.per.days, amount, currency, method, now()).lastInsertRowid);
  const failPay = (pid, note) => db.prepare("update payments set status='failed', note=? where id=? and status='pending'").run(str(note, 200), pid);
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
      const p = getPlan(q.body && q.body.plan_id, q.body && q.body.months), method = String(q.body.method || ''), base = baseUrl(q);
      if (method === 'satim') {
        if (!CFG.get('satim_user') || !CFG.get('satim_pass')) throw bad('الدفع بـ CIB/الذهبية غير مفعّل بعد');
        if (!(p.per.dzd > 0)) throw bad('لا سعر بالدينار لهذه الباقة');
        const pid = newPay(q.u, p, 'satim', p.per.dzd, 'DZD'), back = base + '/api/billing/return/satim?pid=' + pid;
        const qs = new URLSearchParams({ userName: CFG.get('satim_user'), password: CFG.get('satim_pass'), orderNumber: String(pid).padStart(10, '0'), amount: String(Math.round(p.per.dzd * 100)), currency: '012',
          returnUrl: back, failUrl: back, language: lang(q), jsonParams: JSON.stringify({ force_terminal_id: CFG.get('satim_terminal') || '', udf1: String(pid) }) });
        const r = await fetch(SATIM() + '/register.do?' + qs, { signal: AbortSignal.timeout(20000) }), j = await r.json().catch(() => ({}));
        if (String(j.errorCode || '0') !== '0' || !j.formUrl) { failPay(pid, j.errorMessage || 'SATIM ' + j.errorCode); throw bad('تعذّر إنشاء صفحة الدفع: ' + (j.errorMessage || j.errorCode || 'SATIM'), 502); }
        db.prepare('update payments set checkout_id=? where id=?').run(str(j.orderId, 80), pid); return s.json({ url: j.formUrl, id: pid });
      }
      if (method === 'stripe') {
        if (!CFG.get('stripe_secret')) throw bad('الدفع بالبطاقة الدولية غير مفعّل بعد');
        if (!(p.per.usd > 0)) throw bad('لا سعر بالدولار لهذه الباقة');
        const pid = newPay(q.u, p, 'stripe', p.per.usd, 'USD');
        const f = new URLSearchParams({ mode: 'payment', 'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': 'usd', 'line_items[0][price_data][unit_amount]': String(Math.round(p.per.usd * 100)),
          'line_items[0][price_data][product_data][name]': p.name + ' · ' + p.per.m + (p.per.m > 1 ? ' months' : ' month'), success_url: base + '/subscription?paid=' + pid, cancel_url: base + '/subscription?failed=' + pid,
          client_reference_id: String(pid), 'metadata[payment_id]': String(pid), customer_email: q.u.email });
        const r = await fetch(STRIPE() + '/v1/checkout/sessions', { method: 'POST', signal: AbortSignal.timeout(20000), headers: { authorization: 'Bearer ' + CFG.get('stripe_secret'), 'content-type': 'application/x-www-form-urlencoded' }, body: f.toString() });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.url) { failPay(pid, j.error && j.error.message); throw bad('Stripe: ' + ((j.error && j.error.message) || 'تعذّر إنشاء صفحة الدفع'), 502); }
        db.prepare('update payments set checkout_id=? where id=?').run(str(j.id, 80), pid); return s.json({ url: j.url, id: pid });
      }
      if (method === 'paypal') {
        if (!CFG.get('paypal_client') || !CFG.get('paypal_secret')) throw bad('PayPal غير مفعّل بعد');
        if (!(p.per.usd > 0)) throw bad('لا سعر بالدولار لهذه الباقة');
        const pid = newPay(q.u, p, 'paypal', p.per.usd, 'USD'), tok = await paypalToken();
        const r = await fetch(PAYPAL() + '/v2/checkout/orders', { method: 'POST', signal: AbortSignal.timeout(20000), headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' },
          body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ reference_id: String(pid), custom_id: String(pid), description: p.name + ' · ' + p.per.m + ' mo', amount: { currency_code: 'USD', value: p.per.usd.toFixed(2) } }],
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
    const p = getPlan(q.body && q.body.plan_id, q.body && q.body.months), ref = wa ? ('WhatsApp · ' + store).slice(0, 100) : str(q.body.ref, 60), img = wa ? '' : String(q.body.proof || '');
    if (!CFG.get('baridi_info') && !(wa && CFG.get('support_whatsapp'))) throw bad('الدفع عبر BaridiMob غير مفعّل');
    if (wa && store.length < 2) throw bad('اكتب اسم متجرك');
    const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(img);
    if (!ref && !m) throw bad('اكتب رقم العملية أو أرفق صورة الوصل');
    if (db.prepare("select count(*) n from payments where user_id=? and status='pending' and method='baridi'").get(q.u.id).n >= 3) throw bad('لديك طلبات قيد المراجعة. انتظر قبولها.');
    let proof = '';
    if (m) { const buf = Buffer.from(m[2], 'base64'); if (buf.length > 3e6) throw bad('الصورة كبيرة جداً'); proof = crypto.randomBytes(12).toString('hex') + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]); fs.writeFileSync(path.join(PROOF_DIR, proof), buf); }
    const id = db.prepare("insert into payments(user_id,plan_id,plan_name,days,amount,method,status,ref,proof,created_at) values(?,?,?,?,?,'baridi','pending',?,?,?)").run(q.u.id, p.id, p.name + ' · ' + p.per.label, p.per.days, p.per.dzd, ref, proof, now()).lastInsertRowid;
    act && act(q.u.id, 'payment_request', q, 'BaridiMob · ' + p.name + ' · ' + p.per.label);
    try { X.notifyAdmins && X.notifyAdmins('💳 طلب دفع BaridiMob جديد: ' + q.u.email + ' · ' + p.name + ' · ' + p.per.label + ' · ' + p.per.dzd + ' دج' + (wa ? ' · الوصل عبر واتساب · المتجر: ' + store : ''), '/payments'); } catch (e) {}
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
  app.get('/api/admin/plans', auth, admin, wrap((q, s) => s.json({ plans: plans(true), periods: periodsCfg(), keys: LIM.KEYS, labels: LIM.LABEL, cat: catalog() })));
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
    const up = db.prepare('update plans set name=?, days=?, price=?, limits=?, active=?, sort=?, note=?, price_usd=?, free=?, features=?, totals=? where id=?'), ins = db.prepare('insert into plans(name,days,price,limits,active,sort,note,price_usd,free,features,totals) values(?,?,?,?,?,?,?,?,?,?,?)');
    for (const p of list) {
      const name = str(p.name, 30), days = Math.max(1, Math.min(3650, Math.floor(+p.days || 30))), price = Math.max(0, Math.min(1e7, Math.floor(+p.price || 0)));
      if (!name) continue;
      const L = {}; for (const k of LIM.KEYS) { const v = Math.floor(+((p.limits || {})[k])); if (v > 0) L[k] = Math.min(1e6, v); }
      const pu = Math.max(0, Math.min(1e5, Math.round((+p.price_usd || 0) * 100) / 100)), fr = p.free ? 1 : 0, fe = JSON.stringify(Array.isArray(p.features) ? catKeys().filter(k => p.features.includes(k)) : catKeys());
      const T = {}; for (const [m, v] of Object.entries(p.totals || {})) { const x = Math.floor(+v); if (/^\d+$/.test(m) && x > 0) T[m] = Math.min(1e8, x); }   // مبالغ يدوية لكل مدة (فارغ = حساب تلقائي بالخصم)
      if (p.id) up.run(name, days, price, JSON.stringify(L), p.active ? 1 : 0, +p.sort || 0, str(p.note, 120), pu, fr, fe, JSON.stringify(T), +p.id); else ins.run(name, days, price, JSON.stringify(L), p.active ? 1 : 0, +p.sort || 0, str(p.note, 120), pu, fr, fe, JSON.stringify(T));
    }
    if (Array.isArray(q.body.periods)) {   // المدد وخصوماتها (مثلاً 3 أشهر −5٪)
      const P = q.body.periods.map(x => ({ m: Math.floor(+x.m), off: Math.max(0, Math.min(90, Math.round(+x.off || 0))) })).filter(x => [1, 2, 3, 4, 6, 9, 12, 18, 24].includes(x.m));
      const U = [...new Map(P.map(x => [x.m, x])).values()].sort((a, b) => a.m - b.m); if (U.length) CFG.set('billing_periods', JSON.stringify(U));
    }
    act && act(q.u.id, 'admin_plans', q, list.length + ' باقة');
    s.json({ plans: plans(true), periods: periodsCfg() });
  }));

  // لوحة الإحصائيات الشاملة: adlib/stats.js
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
