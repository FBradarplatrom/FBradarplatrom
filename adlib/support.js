'use strict';
// الدعم: نموذج «اتصل بنا» (للزوار والمشتركين) → صندوق رسائل المدير + تنبيه بالبريد/تيليغرام،
// ونصوص الصفحات القانونية التي يعدّلها المدير (تحل محل النص الأصلي، وفارغ = العودة للأصلي).
module.exports = function mountSupport(app, X) {
  const { db, auth, admin, wrap, now, blocked, fail, optUser } = X, CFG = require('./config.js');
  db.exec(`create table if not exists contact_msgs(id integer primary key, user_id integer, name text, email text, subject text, body text, ip text, status text default 'new', created_at integer);
create table if not exists legal_docs(lang text, doc text, body text, updated_at integer, primary key(lang, doc));`);
  const bad = (m, st) => Object.assign(new Error(m), { status: st || 400 }), str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  const LANGS = ['ar', 'en', 'fr'], DOCS = ['terms', 'privacy', 'refund', 'contact'];

  app.post('/api/contact', wrap((q, s) => {
    const b = q.body || {}; if (b.website) return s.json({ ok: 1 });              // فخ الروبوتات: حقل مخفي لا يملؤه إنسان
    if (blocked('c:' + q.ip, 5, 36e5)) throw bad('أرسلت رسائل كثيرة، أعد المحاولة بعد ساعة', 429);
    const u = optUser(q), email = u ? u.email : str(b.email, 120).toLowerCase(), msg = str(b.message, 4000);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad('email');
    if (msg.length < 10) throw bad('message');
    const subject = str(b.subject, 150) || '—', name = str(b.name, 80) || (u && u.name) || '';
    fail('c:' + q.ip, 36e5);
    db.prepare('insert into contact_msgs(user_id,name,email,subject,body,ip,created_at) values(?,?,?,?,?,?,?)').run(u ? u.id : null, name, email, subject, msg, q.ip || '', now());
    try { X.notifyAdmins && X.notifyAdmins('✉️ رسالة جديدة من ' + (name ? name + ' · ' : '') + email + '\n' + subject + '\n\n' + msg.slice(0, 500)); } catch (e) {}
    s.json({ ok: 1 });
  }));
  app.get('/api/admin/messages', auth, admin, wrap((q, s) => s.json({
    list: db.prepare('select m.*, u.plan, u.expires_at from contact_msgs m left join users u on u.id=m.user_id order by m.created_at desc limit 300').all(),
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
