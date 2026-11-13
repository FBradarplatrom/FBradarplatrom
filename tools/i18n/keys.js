'use strict';
// يجمع كل النصوص العربية التي قد تظهر في لوحة التحكم (من الواجهة ورسائل الخادم) → قائمة مفاتيح القاموس.
// التشغيل: node tools/i18n/keys.js > keys.json
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const R = path.join(__dirname, '..', '..'), EX = path.join(__dirname, 'extract-lib.js'), tmp = require('os').tmpdir();
const h = fs.readFileSync(path.join(R, 'views/app.html'), 'utf8'), a = h.indexOf('<script>const DEF='), b = h.indexOf('</script><script src="/collect.js">');
const noeng = path.join(tmp, 'app-noengine.html'); fs.writeFileSync(noeng, h.slice(0, a) + h.slice(b + 9));
const files = [noeng, 'engine/ui.js', 'engine/core.js', 'public/account.js', 'public/admin-users.js', 'public/collect.js', 'public/tiktok.js', 'public/gap.js', 'public/tools.js', 'public/watch.js', 'public/profit.js', 'public/guide.js', 'public/edge.js',
  'server.js', 'adlib/index.js', 'adlib/billing.js', 'adlib/limits.js', 'adlib/notify.js', 'adlib/support.js', 'adlib/gap.js', 'adlib/tools.js', 'adlib/ai.js', 'adlib/backup.js', 'adlib/edge.js', 'adlib/mail.js', 'adlib/wa.js', 'adlib/stats.js'].map(f => path.isAbsolute(f) ? f : path.join(R, f));
let keys = [];
for (const f of files) keys.push(...JSON.parse(execFileSync(process.execPath, [EX, f], { maxBuffer: 1e8 }).toString()));
const lib = f => fs.readFileSync(path.join(R, 'adlib/lib', f), 'utf8');
for (const m of lib('niches.js').matchAll(/name: '([^']+)'/g)) keys.push(m[1]);
const mk = lib('markets.js'); for (const m of mk.matchAll(/(?:name|label): '([^']+)'/g)) keys.push(m[1]);
for (const m of (/REGIONS = \{([^}]+)\}/.exec(mk) || ['', ''])[1].matchAll(/'([^']+)'/g)) keys.push(m[1]);
const bad = k => k.length < 2 || /\(\?:|\[\^|\\u06/.test(k) || (k.split(',').length > 6) || /^[؀-ۿ]$/.test(k);
keys = [...new Set(keys.map(k => k.replace(/\s+/g, ' ').trim()))].filter(k => !bad(k));
process.stdout.write(JSON.stringify(keys, null, 1));
