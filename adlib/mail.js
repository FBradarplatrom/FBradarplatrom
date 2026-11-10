'use strict';
// البريد (SMTP): الاتصال، آخر نتيجة إرسال، وفحص إعدادات الدومين (SPF / DKIM / DMARC / MX).
// لماذا «أُرسل» ولا يصل؟ غالباً: (1) الخادم رفض الاتصال وكان الخطأ مخفياً، أو (2) Gmail/Outlook يرفضان بريداً
// بلا SPF/DKIM فيرجع إشعار الرفض إلى صندوق contact@ نفسه. هذه الأداة تُظهر السبب للمدير.
const dns = require('dns').promises;
const env = k => process.env[k] || '';

function transport() {
  if (!env('SMTP_HOST')) return null;
  const nm = require('nodemailer'), p = +env('SMTP_PORT') || 465;
  if (env('SMTP_HOST') === 'json') return nm.createTransport({ jsonTransport: true });
  return nm.createTransport({ host: env('SMTP_HOST'), port: p, secure: p === 465, requireTLS: p === 587, auth: { user: env('SMTP_USER'), pass: env('SMTP_PASS') },
    // استضافة مشتركة: شهادة خادم البريد قد تحمل اسم الخادم لا اسم الدومين. SMTP_TLS_SERVERNAME يحدد الاسم الصحيح، و SMTP_TLS_INSECURE=1 حل أخير
    tls: Object.assign({}, env('SMTP_TLS_SERVERNAME') ? { servername: env('SMTP_TLS_SERVERNAME') } : {}, env('SMTP_TLS_INSECURE') === '1' ? { rejectUnauthorized: false } : {}),
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000 });
}
const FROM = () => env('SMTP_FROM') || env('MAIL_FROM') || env('SMTP_USER');
const fromAddr = () => { const f = FROM(), m = /<([^>]+)>/.exec(f); return (m ? m[1] : f).trim(); };
const domainOf = a => String(a || '').split('@')[1] || '';
const mask = a => String(a || '').replace(/^(.)[^@]*(@.*)$/, '$1***$2');

// آخر محاولة إرسال (تُعرض للمدير في «إعدادات المنصة ← البريد»)
let last = null;
function hint(m) {
  return /altnames|certificate|self.signed|CERT/i.test(m) ? 'شهادة خادم البريد تحمل اسماً آخر: ضع SMTP_TLS_SERVERNAME باسم الخادم (cPanel ← Email Accounts ← Connect Devices ← Outgoing Server)، أو SMTP_HOST=mail.' + (domainOf(fromAddr()) || 'domain') + ' ، أو SMTP_TLS_INSECURE=1 كحل أخير'
    : /auth|535|534|credentials|Invalid login/i.test(m) ? 'اسم المستخدم أو كلمة المرور غير صحيحين: SMTP_USER هو البريد كاملاً، وتأكد من كلمة المرور (إن كانت فيها # أو مسافة ضعها بين علامتي تنصيص "…")'
    : /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ECONNRESET|Greeting|timeout/i.test(m) ? 'تعذّر الاتصال بخادم البريد: جرّب SMTP_HOST=mail.' + (domainOf(fromAddr()) || 'domain') + ' أو localhost (إن كانت المنصة على نفس استضافة البريد)، والمنفذ 465 أو 587'
    : /550|553|554|relay|not permitted|sender/i.test(m) ? 'الخادم رفض المرسِل: يجب أن يكون MAIL_FROM نفس البريد الذي تسجّل الدخول به (SMTP_USER)'
    : '';
}
async function send(msg, tag) {
  const tr = transport(); if (!tr) throw Object.assign(new Error('البريد غير مضبوط: أضف SMTP_HOST و SMTP_USER و SMTP_PASS في ملف .env ثم أعد تشغيل المنصة'), { status: 400 });
  const rt = env('MAIL_REPLY_TO') || fromAddr();
  try {
    const i = await tr.sendMail(Object.assign({ from: FROM(), replyTo: rt }, msg));
    last = { at: Date.now(), ok: true, tag, to: mask(msg.to), response: String(i.response || '').slice(0, 200), rejected: (i.rejected || []).length };
    if (env('SMTP_HOST') === 'json') console.log('MAIL', i.message);
    return i;
  } catch (e) {
    const m = String(e.message || e); last = { at: Date.now(), ok: false, tag, to: mask(msg.to), error: m.slice(0, 300), hint: hint(m) };
    throw Object.assign(new Error(m), { status: 400, hint: hint(m) });
  }
}

// فحص DNS للدومين: بدون SPF و DKIM يرفض Gmail الرسالة أو يُسقطها
async function txt(name) { try { return (await dns.resolveTxt(name)).map(r => r.join('')); } catch (e) { return null; } }
async function checkDomain() {
  const dom = domainOf(fromAddr()), host = env('SMTP_HOST'), out = [];
  if (!dom) return { domain: '', checks: [{ k: 'from', ok: false, msg: 'MAIL_FROM غير مضبوط' }] };
  const mx = await dns.resolveMx(dom).catch(() => null);
  out.push({ k: 'MX', ok: !!(mx && mx.length), val: mx ? mx.map(x => x.exchange).join(', ') : '', msg: mx && mx.length ? 'سجل استقبال البريد موجود' : 'لا يوجد سجل MX: البريد لا يُستقبل على هذا الدومين' });
  const t = await txt(dom), spf = (t || []).find(x => /^v=spf1/i.test(x));
  out.push({ k: 'SPF', ok: !!spf, val: spf || '', msg: spf ? 'موجود' : 'غير موجود: Gmail سيرفض رسائلك. فعّله من cPanel ← Email Deliverability ← Repair' });
  const sel = env('DKIM_SELECTOR') || 'default', dk = ((await txt(sel + '._domainkey.' + dom)) || []).find(x => /v=DKIM1|p=/i.test(x));
  out.push({ k: 'DKIM', ok: !!dk, val: dk ? dk.slice(0, 60) + '…' : '', msg: dk ? 'موجود (المحدِّد ' + sel + ')' : 'غير موجود للمحدِّد «' + sel + '»: فعّله من cPanel ← Email Deliverability' });
  const dm = ((await txt('_dmarc.' + dom)) || []).find(x => /^v=DMARC1/i.test(x));
  out.push({ k: 'DMARC', ok: !!dm, warn: !dm, val: dm || '', msg: dm ? 'موجود' : 'غير موجود (يُستحسن): أضف سجل TXT باسم _dmarc وقيمة v=DMARC1; p=none' });
  if (host && host !== 'json') {
    const a = await dns.lookup(host).catch(() => null);
    out.push({ k: 'SMTP_HOST', ok: !!a, val: host + (a ? ' → ' + a.address : ''), msg: a ? 'الخادم معروف' : 'اسم الخادم لا يُحلّ: تحقق من SMTP_HOST' });
  }
  return { domain: dom, checks: out };
}

function routes(app, { auth, admin }) {
  app.get('/api/admin/mail-status', auth, admin, (q, s) => s.json({ configured: !!transport(), host: env('SMTP_HOST'), port: +env('SMTP_PORT') || 465, user: env('SMTP_USER'), from: FROM(), last }));
  app.post('/api/admin/mail-dns', auth, admin, async (q, s) => s.json(await checkDomain()));
  // بريد تجريبي إلى أي عنوان (مثلاً Gmail) لمعرفة هل يصل إلى خارج الدومين
  app.post('/api/admin/mail-test', auth, admin, async (q, s) => {
    const to = String((q.body || {}).to || '').trim().toLowerCase() || q.u.email;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return s.status(400).json({ error: 'بريد غير صحيح' });
    const tr = transport(); if (!tr) return s.status(400).json({ error: 'البريد غير مضبوط: أضف SMTP_HOST و SMTP_USER و SMTP_PASS في ملف .env ثم أعد تشغيل المنصة' });
    try {
      await tr.verify();
      const i = await send({ to, subject: 'بريد تجريبي | رادار المنتجات الرابحة', text: 'وصل البريد التجريبي: إعدادات البريد تعمل.\nThe test email arrived: mail settings work.' }, 'test');
      s.json({ ok: 1, to, from: FROM(), response: String(i.response || ''), rejected: i.rejected || [] });
    } catch (e) {
      const m = String(e.message || e), h = e.hint || hint(m);
      if (!last || last.tag !== 'test' || Date.now() - last.at > 2000) last = { at: Date.now(), ok: false, tag: 'test', to: mask(to), error: m.slice(0, 300), hint: h };
      s.status(400).json({ error: 'فشل الإرسال: ' + m + (h ? ' — ' + h : '') });
    }
  });
}
module.exports = { transport, FROM, send, routes, checkDomain, hint, lastSend: () => last };
