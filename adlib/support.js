'use strict';
// الدعم: نموذج «اتصل بنا» (للزوار والمشتركين) → صندوق رسائل المدير + تنبيه بالبريد/تيليغرام،
// ونصوص الصفحات القانونية التي يعدّلها المدير (تحل محل النص الأصلي، وفارغ = العودة للأصلي).
module.exports = function mountSupport(app, X) {
  const { db, auth, admin, wrap, now, blocked, fail, optUser } = X, CFG = require('./config.js');
  db.exec(`create table if not exists contact_msgs(id integer primary key, user_id integer, name text, email text, subject text, body text, ip text, status text default 'new', created_at integer);
create table if not exists legal_docs(lang text, doc text, body text, updated_at integer, primary key(lang, doc));`);
  ['category text', 'reply text', 'replied_at integer', "origin text default 'user'", 'user_archived integer default 0', 'user_hidden integer default 0'].forEach(c => { try { db.exec('alter table contact_msgs add column ' + c); } catch (e) {} });
  const CATS = ['tech', 'billing', 'usage', 'idea', 'other'];
  const bad = (m, st) => Object.assign(new Error(m), { status: st || 400 }), str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  const LANGS = ['ar', 'en', 'fr'], DOCS = ['terms', 'privacy', 'refund', 'contact'];

  app.post('/api/contact', wrap((q, s) => {
    const b = q.body || {}; if (b.website) return s.json({ ok: 1 });              // فخ الروبوتات: حقل مخفي لا يملؤه إنسان
    if (blocked('c:' + q.ip, 5, 36e5)) throw bad('أرسلت رسائل كثيرة، أعد المحاولة بعد ساعة', 429);
    const u = optUser(q), email = u ? u.email : str(b.email, 120).toLowerCase(), msg = str(b.message, 4000);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad('email');
    if (msg.length < 10) throw bad('message');
    const subject = str(b.subject, 150) || '—', name = str(b.name, 80) || (u && u.name) || '', category = CATS.includes(b.category) ? b.category : 'other';
    fail('c:' + q.ip, 36e5);
    const id = db.prepare('insert into contact_msgs(user_id,name,email,subject,body,ip,created_at,category) values(?,?,?,?,?,?,?,?)').run(u ? u.id : null, name, email, subject, msg, q.ip || '', now(), category).lastInsertRowid;
    try { X.notifyAdmins && X.notifyAdmins('✉️ رسالة جديدة من ' + (name ? name + ' · ' : '') + email + '\n' + subject + '\n\n' + msg.slice(0, 500), '/support-inbox'); } catch (e) {}
    s.json({ ok: 1, id: Number(id) });
  }));
  // المشترك: طلباته وردود الدعم عليها
  app.get('/api/support/mine', auth, wrap((q, s) => s.json(db.prepare("select id, category, subject, body, status, reply, replied_at, created_at, coalesce(origin,'user') origin, coalesce(user_archived,0) archived from contact_msgs where user_id=? and coalesce(user_hidden,0)=0 order by created_at desc limit 50").all(q.u.id))));
  // المشترك: أرشفة / إرجاع / حذف رسائل فريق الدعم الواردة (الحذف يخفيها عنده فقط، وتبقى في سجل المدير)
  app.post('/api/support/mine/:id/:act', auth, wrap((q, s) => {
    const a = q.params.act, set = { archive: 'user_archived=1', unarchive: 'user_archived=0', delete: 'user_hidden=1' }[a]; if (!set) throw bad('?');
    const ids = String(q.params.id) === 'all' ? db.prepare("select id from contact_msgs where user_id=? and origin='admin' and coalesce(user_hidden,0)=0 and coalesce(user_archived,0)=?").all(q.u.id, a === 'unarchive' ? 1 : (q.body && q.body.archived ? 1 : 0)).map(r => r.id) : [+q.params.id];
    const up = db.prepare(`update contact_msgs set ${set} where id=? and user_id=? and origin='admin'`); let n = 0; ids.forEach(id => { n += up.run(id, q.u.id).changes; });
    if (!n && String(q.params.id) !== 'all') throw bad('غير موجود', 404); s.json({ ok: 1, n });
  }));
  // المدير يبادر بالتواصل مع مشترك: رسالة داخل المنصة (تظهر في «طلباتي» مع تنبيه) أو واتساب (يُفتح من متصفح المدير ويُسجَّل هنا)
  app.post('/api/admin/contact', auth, admin, wrap((q, s) => {
    const b = q.body || {}, u = db.prepare('select id, email, name, phone from users where id=?').get(+b.user_id); if (!u) throw bad('المشترك غير موجود', 404);
    const text = str(b.text, 4000), subject = str(b.subject, 150) || 'رسالة من فريق الدعم', via = b.via === 'whatsapp' ? 'whatsapp' : 'app';
    if (text.length < 2) throw bad('اكتب الرسالة');
    if (via === 'whatsapp') { if (!u.phone) throw bad('لا يوجد رقم هاتف لهذا المشترك'); X.act && X.act(q.u.id, 'admin_contact', q, 'واتساب → #' + u.id + ' · ' + subject); return s.json({ ok: 1, phone: u.phone.replace(/[^\d]/g, '') }); }
    const id = db.prepare("insert into contact_msgs(user_id,name,email,subject,body,ip,created_at,category,reply,replied_at,status,origin) values(?,?,?,?,'',?,?,'other',?,?,'done','admin')")
      .run(u.id, u.name || '', u.email, subject, q.ip || '', now(), text, now()).lastInsertRowid;
    if (X.notify) X.notify(u.id, 'support', '💬 ' + subject + ':\n' + text.slice(0, 600), '/help');
    X.act && X.act(q.u.id, 'admin_contact', q, 'داخل المنصة → #' + u.id + ' · ' + subject);
    s.json({ ok: 1, id: Number(id) });
  }));
  // المدير يردّ من المنصة: يُحفظ الرد ويُعلَّم الطلب «تم الرد» ويصل تنبيه للمشترك
  app.post('/api/admin/messages/:id/reply', auth, admin, wrap((q, s) => {
    const m = db.prepare('select * from contact_msgs where id=?').get(+q.params.id); if (!m) throw bad('غير موجود', 404);
    const reply = str(q.body && q.body.reply, 4000), wa = q.body && q.body.via === 'whatsapp'; if (reply.length < 2) throw bad('اكتب الرد');
    // واتساب: يُفتح من متصفح المدير بنص الرد إلى رقم المشترك، ويُحفظ الرد هنا سجلاً (بلا تنبيه داخل المنصة لأنه وصله في واتساب)
    const ph = wa ? String((m.user_id && (db.prepare('select phone from users where id=?').get(m.user_id) || {}).phone) || '').replace(/[^\d]/g, '') : '';
    if (wa && !ph) throw bad('لا يوجد رقم هاتف لهذا المرسل');
    if (!wa && !m.user_id) throw bad('زائر بلا حساب: ردّ عليه بالبريد');
    db.prepare("update contact_msgs set reply=?, replied_at=?, status='done' where id=?").run(reply, now(), m.id);
    if (!wa && X.notify) X.notify(m.user_id, 'support', '💬 ردّ فريق الدعم على «' + (m.subject || '—') + '»:\n' + reply.slice(0, 600), '/help');
    X.act && X.act(q.u.id, 'admin_reply', q, '#' + m.id + (wa ? ' · واتساب' : ''));
    s.json(wa ? { ok: 1, phone: ph } : { ok: 1 });
  }));
  app.get('/api/admin/messages', auth, admin, wrap((q, s) => s.json({
    list: db.prepare('select m.*, u.plan, u.expires_at, u.phone from contact_msgs m left join users u on u.id=m.user_id order by m.created_at desc limit 300').all(),
    unread: db.prepare("select count(*) n from contact_msgs where status='new'").get().n })));
  app.post('/api/admin/messages/:id/:act', auth, admin, wrap((q, s) => {
    const id = +q.params.id, a = q.params.act;
    if (a === 'delete') db.prepare('delete from contact_msgs where id=?').run(id);
    else if (a === 'done' || a === 'new') db.prepare('update contact_msgs set status=? where id=?').run(a, id);
    else throw bad('?');
    s.json({ ok: 1 });
  }));

  // نصوص الصفحات القانونية المعدّلة
  X.legalDocs = () => { const o = {}; for (const r of db.prepare('select lang, doc, body from legal_docs').all()) o[r.lang + ':' + r.doc] = r.body; return o; };
  app.get('/api/admin/legal', auth, admin, wrap((q, s) => s.json({ docs: X.legalDocs() })));
  app.put('/api/admin/legal', auth, admin, wrap((q, s) => {
    const b = q.body || {}, lang = String(b.lang), doc = String(b.doc), body = String(b.body || '').replace(/\r/g, '').trim();
    if (!LANGS.includes(lang) || !DOCS.includes(doc)) throw bad('صفحة غير معروفة');
    if (body.length > 30000) throw bad('النص طويل جداً');
    if (!body) db.prepare('delete from legal_docs where lang=? and doc=?').run(lang, doc);
    else {
      if (!/^#\s+\S/m.test(body)) throw bad('اكتب عنوان الصفحة في السطر الأول بعد علامة # (مثال: # شروط الاستخدام)');
      db.prepare('insert into legal_docs(lang,doc,body,updated_at) values(?,?,?,?) on conflict(lang,doc) do update set body=excluded.body, updated_at=excluded.updated_at').run(lang, doc, body, now());
    }
    CFG.set('legal_updated', new Date().toISOString().slice(0, 10));             // تاريخ «آخر تحديث» يتغيّر تلقائياً
    X.act && X.act(q.u.id, 'admin_legal', q, lang + ':' + doc + (body ? '' : ' (reset)'));
    s.json({ docs: X.legalDocs() });
  }));
};
