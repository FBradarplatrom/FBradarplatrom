'use strict';
// النسخ الاحتياطي التلقائي لقاعدة البيانات: نسخة يومية مضغوطة (VACUUM INTO آمن أثناء عمل المنصة)، تُحفظ آخر 14 نسخة.
// المكان: BACKUP_DIR (افتراضياً مجلد قاعدة البيانات/backups). المدير: «إعدادات المنصة ← النسخ الاحتياطي».
// الاسترجاع: أوقف التطبيق، فك ضغط النسخة (gunzip)، ضعها مكان data.db، ثم شغّل التطبيق.
const fs = require('fs'), path = require('path'), zlib = require('zlib');

module.exports = function mountBackup(app, X) {
  const { db, auth, admin, wrap, now, DATA_DIR } = X;
  const DIR = process.env.BACKUP_DIR || path.join(DATA_DIR, 'backups'), KEEP = Math.max(2, +process.env.BACKUP_KEEP || 14), DAY = 864e5;
  const NAME = /^radar-\d{8}-\d{6}\.db\.gz$/;
  fs.mkdirSync(DIR, { recursive: true });
  const list = () => fs.readdirSync(DIR).filter(f => NAME.test(f)).map(f => { const st = fs.statSync(path.join(DIR, f)); return { name: f, size: st.size, at: st.mtimeMs }; }).sort((a, b) => b.at - a.at);
  let running = false;
  function run() {
    if (running) return null; running = true;
    try {
      const d = new Date(), p2 = n => String(n).padStart(2, '0');
      const base = 'radar-' + d.getUTCFullYear() + p2(d.getUTCMonth() + 1) + p2(d.getUTCDate()) + '-' + p2(d.getUTCHours()) + p2(d.getUTCMinutes()) + p2(d.getUTCSeconds()) + '.db';
      const tmp = path.join(DIR, base + '.tmp');
      try { fs.unlinkSync(tmp); } catch (e) {}
      db.exec("VACUUM INTO '" + tmp.replace(/'/g, "''") + "'");                    // نسخة متّسقة حتى أثناء الكتابة
      fs.writeFileSync(path.join(DIR, base + '.gz'), zlib.gzipSync(fs.readFileSync(tmp), { level: 6 }));
      fs.unlinkSync(tmp);
      list().slice(KEEP).forEach(f => { try { fs.unlinkSync(path.join(DIR, f.name)); } catch (e) {} });   // آخر KEEP نسخة فقط
      return base + '.gz';
    } catch (e) { console.error('backup failed', e.message); X.logError && X.logError(Object.assign(e, { status: 500 }), null); return null; }
    finally { running = false; }
  }
  const due = () => { const L = list(); return !L.length || now() - L[0].at > DAY - 60e3; };
  if (process.env.BACKUP_DISABLE !== '1') { setTimeout(() => { if (due()) run(); }, +process.env.BACKUP_FIRST_MS || 60e3).unref(); setInterval(() => { if (due()) run(); }, 36e5).unref(); }

  app.get('/api/admin/backups', auth, admin, wrap((q, s) => s.json({ dir: DIR, keep: KEEP, list: list() })));
  app.post('/api/admin/backups', auth, admin, wrap((q, s) => { const f = run(); if (!f) throw Object.assign(new Error('تعذّر إنشاء النسخة (راجع سجل الأخطاء)'), { status: 500 }); s.json({ name: f, list: list() }); }));
  app.get('/api/admin/backups/:name', auth, admin, (q, s) => {
    const n = String(q.params.name); if (!NAME.test(n) || !fs.existsSync(path.join(DIR, n))) return s.sendStatus(404);
    s.set('Cache-Control', 'no-store'); s.download(path.join(DIR, n), n);
  });
  return { run, list, DIR };
};
