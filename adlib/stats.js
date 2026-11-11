'use strict';
// إحصائيات المنصة الشاملة للمدير: المشتركون (نشط/تجربة/منتهٍ/متصل الآن)، التسجيلات، البلدان واللغات، الإيرادات، الاستعمال
// (الإعلانات المجلوبة، البحث، الذكاء الاصطناعي، الثغرات، المراقبة، TikTok)، أنشط المشتركين، وما يجري في الخلفية (النسخ، الأخطاء، الذاكرة).
// بلد المشترك: من رأس الخادم الوسيط إن وُجد (Cloudflare)، وإلا من المنطقة الزمنية لمتصفحه، وإلا من لغة المتصفح (ar-DZ ← DZ). لا خدمة خارجية.
const fs = require('fs'), path = require('path');
const TZ = { 'Africa/Algiers': 'DZ', 'Africa/Casablanca': 'MA', 'Africa/El_Aaiun': 'MA', 'Africa/Tunis': 'TN', 'Africa/Tripoli': 'LY', 'Africa/Cairo': 'EG', 'Africa/Nouakchott': 'MR', 'Africa/Khartoum': 'SD',
  'Asia/Riyadh': 'SA', 'Asia/Dubai': 'AE', 'Asia/Qatar': 'QA', 'Asia/Kuwait': 'KW', 'Asia/Bahrain': 'BH', 'Asia/Muscat': 'OM', 'Asia/Baghdad': 'IQ', 'Asia/Amman': 'JO', 'Asia/Beirut': 'LB', 'Asia/Damascus': 'SY', 'Asia/Gaza': 'PS', 'Asia/Hebron': 'PS', 'Asia/Aden': 'YE',
  'Europe/Paris': 'FR', 'Europe/Brussels': 'BE', 'Europe/London': 'GB', 'Europe/Madrid': 'ES', 'Europe/Berlin': 'DE', 'Europe/Rome': 'IT', 'Europe/Amsterdam': 'NL', 'Europe/Zurich': 'CH', 'Europe/Istanbul': 'TR', 'Europe/Lisbon': 'PT', 'Europe/Stockholm': 'SE', 'Europe/Vienna': 'AT',
  'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Los_Angeles': 'US', 'America/Phoenix': 'US', 'America/Toronto': 'CA', 'America/Montreal': 'CA', 'America/Vancouver': 'CA', 'America/Mexico_City': 'MX', 'America/Sao_Paulo': 'BR',
  'Asia/Karachi': 'PK', 'Asia/Kolkata': 'IN', 'Asia/Jakarta': 'ID', 'Asia/Kuala_Lumpur': 'MY', 'Australia/Sydney': 'AU', 'Africa/Lagos': 'NG', 'Africa/Johannesburg': 'ZA', 'Africa/Dakar': 'SN', 'Africa/Abidjan': 'CI' };
function countryOf(q, tz) {
  const h = String(q.get('cf-ipcountry') || q.get('x-country-code') || q.get('x-vercel-ip-country') || '').toUpperCase();
  if (/^[A-Z]{2}$/.test(h) && h !== 'XX' && h !== 'T1') return h;
  if (TZ[tz]) return TZ[tz];
  const m = /^[a-z]{2,3}-([A-Z]{2})\b/.exec(String(q.get('accept-language') || '')); return m ? m[1] : '';
}

module.exports = function mountStats(app, X) {
  const { db, auth, admin, wrap, now, DATA_DIR } = X, DAY = 864e5, VER = require('../package.json').version, T0 = Date.now();
  ['country text', 'tz text', 'ui_lang text', 'last_seen integer'].forEach(c => { try { db.exec('alter table users add column ' + c); } catch (e) {} });
  const str = (v, n) => String(v == null ? '' : v).replace(/[^\w/+\-]/g, '').slice(0, n);

  // نبضة من المنصة عند كل فتح: آخر نشاط، والمنطقة الزمنية ولغة الواجهة والبلد
  app.post('/api/me/ping', auth, wrap((q, s) => {
    const b = q.body || {}, tz = str(b.tz, 60), lg = ['ar', 'en', 'fr'].includes(b.lang) ? b.lang : '', c = countryOf(q, tz) || q.u.country || '';
    db.prepare('update users set last_seen=?, tz=coalesce(nullif(?,\'\'),tz), ui_lang=coalesce(nullif(?,\'\'),ui_lang), country=coalesce(nullif(?,\'\'),country) where id=?').run(now(), tz, lg, c, q.u.id);
    s.json({ ok: 1 });
  }));

  app.get('/api/admin/stats', auth, admin, wrap((q, s) => {
    const t = now(), g = (sql, ...a) => { try { return db.prepare(sql).get(...a) || {}; } catch (e) { return {}; } }, all = (sql, ...a) => { try { return db.prepare(sql).all(...a); } catch (e) { return []; } };
    const mStart = new Date(new Date(t).toISOString().slice(0, 7) + '-01T00:00:00Z').getTime(), day = new Date(t).toISOString().slice(0, 10), d30 = new Date(t - 30 * DAY).toISOString().slice(0, 10), mon = new Date(t).toISOString().slice(0, 7);
    const months = []; for (let i = 11; i >= 0; i--) { const d = new Date(t); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i); months.push(d.toISOString().slice(0, 7)); }
    const rev = new Map(all("select strftime('%Y-%m', paid_at/1000, 'unixepoch') m, sum(amount) a, count(*) n from payments where status='paid' and coalesce(currency,'DZD')='DZD' and paid_at>=? group by m", t - 400 * DAY).map(r => [r.m, r]));
    const freeNames = all('select name from plans where free=1').map(r => r.name), FN = freeNames.length ? freeNames : ['__none__'], ph = FN.map(() => '?').join(',');
    const M = "role!='admin'";
    // التسجيلات يوماً بيوم (30 يوماً)
    const regMap = new Map(all("select strftime('%Y-%m-%d', created_at/1000, 'unixepoch') d, count(*) n from users where " + M + " and created_at>=? group by d", t - 30 * DAY).map(r => [r.d, r.n]));
    const regs = []; for (let i = 29; i >= 0; i--) { const d = new Date(t - i * DAY).toISOString().slice(0, 10); regs.push({ d, n: regMap.get(d) || 0 }); }
    const paidEver = g("select count(distinct user_id) n from payments where status='paid'").n || 0, members = g('select count(*) n from users where ' + M).n || 0;
    const adsIn = since => g('select count(*) n from lib_rows r join runs u on u.id=r.run_id where u.created_at>=?', since).n || 0;
    let dbSize = 0; try { dbSize = fs.statSync(path.resolve(process.env.DB_FILE || 'data.db')).size; } catch (e) {}
    let lastBackup = null; try { const BD = process.env.BACKUP_DIR || path.join(DATA_DIR, 'backups'); const L = fs.readdirSync(BD).filter(f => /\.db\.gz$/.test(f)).map(f => fs.statSync(path.join(BD, f))).sort((a, b) => b.mtimeMs - a.mtimeMs); if (L[0]) lastBackup = { at: L[0].mtimeMs, size: L[0].size, count: L.length }; } catch (e) {}
    s.json({
      // (حقول الإصدار السابق تبقى كما هي)
      users: g('select count(*) n from users').n, active: g('select count(*) n from users where ' + M + ' and expires_at>?', t).n,
      newMonth: g('select count(*) n from users where created_at>=?', mStart).n, expiring7: g('select count(*) n from users where ' + M + ' and expires_at>? and expires_at<?', t, t + 7 * DAY).n,
      expired30: g('select count(*) n from users where ' + M + ' and expires_at<=? and expires_at>?', t, t - 30 * DAY).n,
      revenueMonth: g("select coalesce(sum(amount),0) a from payments where status='paid' and coalesce(currency,'DZD')='DZD' and paid_at>=?", mStart).a,
      revenueMonthUsd: Math.round((g("select coalesce(sum(amount),0) a from payments where status='paid' and currency='USD' and paid_at>=?", mStart).a || 0) * 100) / 100, pending: g("select count(*) n from payments where status='pending'").n,
      revenue: months.map(m => ({ m, a: (rev.get(m) || {}).a || 0, n: (rev.get(m) || {}).n || 0 })),
      plans: all('select plan, count(*) n from users where ' + M + ' and expires_at>? group by plan order by n desc', t),
      usage: { searchesToday: g('select coalesce(sum(searches),0) n from lib_usage where day=?', day).n, searches30: g('select coalesce(sum(searches),0) n from lib_usage where day>=?', d30).n,
        aiMonth: g('select coalesce(sum(n),0) n from ai_usage where month=?', mon).n, ads30: g("select coalesce(sum(ads),0) n from runs where source='adlib' and created_at>=?", t - 30 * DAY).n,
        activeUsers7: g('select count(distinct user_id) n from activity where kind=? and at>=?', 'login', t - 7 * DAY).n },
      errors: { day: g('select count(*) n from error_logs where at>=?', t - DAY).n, list: all('select at,method,path,status,msg,user_id from error_logs order by at desc limit 50') },
      // ---- الجديد
      subs: { members, paidActive: g('select count(*) n from users where ' + M + ' and expires_at>? and plan not in (' + ph + ')', t, ...FN).n, trialActive: g('select count(*) n from users where ' + M + ' and expires_at>? and plan in (' + ph + ')', t, ...FN).n,
        expired: g('select count(*) n from users where ' + M + ' and expires_at<=?', t).n, new1: g('select count(*) n from users where ' + M + ' and created_at>=?', t - DAY).n, new7: g('select count(*) n from users where ' + M + ' and created_at>=?', t - 7 * DAY).n,
        new30: g('select count(*) n from users where ' + M + ' and created_at>=?', t - 30 * DAY).n, online: g('select count(*) n from users where last_seen>=?', t - 5 * 60e3).n, dau: g('select count(*) n from users where ' + M + ' and last_seen>=?', t - DAY).n,
        wau: g('select count(*) n from users where ' + M + ' and last_seen>=?', t - 7 * DAY).n, conv: members ? Math.round(paidEver / members * 1000) / 10 : 0, paidEver,
        tfa: g('select count(*) n from users where totp_on=1').n },
      regs,
      geo: { countries: all("select coalesce(nullif(country,''),'?') c, count(*) n, sum(case when expires_at>? then 1 else 0 end) a from users where " + M + ' group by c order by n desc limit 25', t),
        langs: all("select coalesce(nullif(ui_lang,''),'?') l, count(*) n from users where " + M + ' group by l order by n desc'),
        targets: all("select replace(v,'\"','') c, count(*) n from user_kv where k='gap_target' group by c order by n desc limit 12") },
      money: { byMethod: all("select method, coalesce(currency,'DZD') cur, count(*) n, coalesce(sum(amount),0) a from payments where status='paid' group by method, cur order by a desc"),
        byPeriod: all("select days, count(*) n, coalesce(sum(amount),0) a from payments where status='paid' and coalesce(currency,'DZD')='DZD' group by days order by days"),
        pendingAmount: g("select coalesce(sum(amount),0) a from payments where status='pending' and coalesce(currency,'DZD')='DZD'").a, totalDzd: g("select coalesce(sum(amount),0) a from payments where status='paid' and coalesce(currency,'DZD')='DZD'").a,
        totalUsd: Math.round((g("select coalesce(sum(amount),0) a from payments where status='paid' and currency='USD'").a || 0) * 100) / 100 },
      work: { adsToday: adsIn(t - DAY), ads7: adsIn(t - 7 * DAY), ads30: adsIn(t - 30 * DAY), adsAll: g('select count(*) n from lib_rows').n, batches30: g('select count(*) n from lib_batch where created_at>=?', t - 30 * DAY).n,
        adsByCountry: all("select upper(json_extract(r.row,'$.country')) c, count(*) n from lib_rows r join runs u on u.id=r.run_id where u.created_at>=? and json_valid(r.row) group by c order by n desc limit 12", t - 30 * DAY).filter(x => x.c),
        analyses30: g('select count(*) n from runs where created_at>=?', t - 30 * DAY).n, saved: g('select count(*) n from saved').n, excluded: g('select count(*) n from lib_excluded').n,
        ai: g('select coalesce(sum(n),0) n from ai_usage where month=?', mon).n, aiAd: g("select count(*) n from ai_cache where kind='ad' and created_at>=?", t - 30 * DAY).n, edge30: g("select count(*) n from edge_runs where created_at>=? and status='done'", t - 30 * DAY).n,
        gapProducts: g('select count(*) n from gap_products').n, gapScans7: g('select count(*) n from gap_scans where started_at>=?', t - 7 * DAY).n,
        watchPages: g('select count(*) n from watch_pages').n, watchScans7: g('select count(*) n from watch_scans where started_at>=?', t - 7 * DAY).n,
        ttRuns30: g('select count(*) n from tt_runs where created_at>=?', t - 30 * DAY).n, ttItems: g('select count(*) n from tt_items').n,
        supplier: g('select count(*) n from sup_results').n, supportNew: g("select count(*) n from contact_msgs where status='new'").n, notify7: g('select count(*) n from notify_log where at>=?', t - 7 * DAY).n },
      top: all('select u.id, u.email, u.name, u.plan, u.country, u.last_seen, coalesce(sum(l.searches),0) searches from users u left join lib_usage l on l.user_id=u.id and l.day>=? where u.' + M + ' group by u.id order by searches desc, u.last_seen desc limit 10', d30)
        .map(r => Object.assign(r, { ads: g('select count(*) n from lib_rows r join runs x on x.id=r.run_id where x.user_id=? and x.created_at>=?', r.id, t - 30 * DAY).n || 0 })),
      system: { version: VER, node: process.version, uptime: Math.round((Date.now() - T0) / 1000), mem: Math.round(process.memoryUsage().rss / 1048576), dbSize, lastBackup,
        maint: !!(require('./config.js').get('maint_on')) }
    });
  }));
};
module.exports.countryOf = countryOf;
