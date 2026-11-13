'use strict';
// أدوات صغيرة مشتركة بين وحدات الخادم (كانت مكررة حرفياً في كل وحدة)
const J = (s, d) => { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } };   // قراءة JSON بأمان
const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);   // نص نظيف بطول أقصى
// إعدادات المشترك (جدول user_kv)
const kvGet = (db, u, k, d) => { const r = db.prepare('select v from user_kv where user_id=? and k=?').get(u, k); return r ? J(r.v, d) : d; };
const kvSet = (db, u, k, v) => db.prepare('insert into user_kv(user_id,k,v) values(?,?,?) on conflict(user_id,k) do update set v=excluded.v').run(u, k, JSON.stringify(v));
module.exports = { J, str, kvGet, kvSet };
