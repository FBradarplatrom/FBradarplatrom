'use strict';
// يتحقق أن كل نص عربي في الواجهة له ترجمة في القاموس (public/i18n-dict.js)، ما عدا المستثنى في ignore.json (بيانات/كود/رسائل البريد).
// التشغيل: node tools/i18n/missing.js   ← يطبع النصوص الناقصة ويفشل إن وُجدت. (--write-ignore يحفظ الناقص الحالي كمستثنى)
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const keys = JSON.parse(execFileSync(process.execPath, [path.join(__dirname, 'keys.js')], { maxBuffer: 1e8 }).toString());
global.window = {}; require(path.join(__dirname, '..', '..', 'public', 'i18n-dict.js'));
const have = new Set(window.I18N_DICT.filter(r => r[1] && r[2]).map(r => r[0])), IG = path.join(__dirname, 'ignore.json');
const ignore = new Set(fs.existsSync(IG) ? JSON.parse(fs.readFileSync(IG, 'utf8')) : []);
const miss = keys.filter(k => !have.has(k) && !ignore.has(k));
if (process.argv.includes('--write-ignore')) { fs.writeFileSync(IG, JSON.stringify([...ignore, ...miss], null, 1)); console.log('ignored', miss.length); process.exit(0); }
if (miss.length) { console.error('❌ ' + miss.length + ' نص بلا ترجمة (أضفه إلى public/i18n-dict.js):\n' + miss.map(k => '  ' + k).join('\n')); process.exit(1); }
console.log('PASS i18n: ' + keys.length + ' نص، كلها مترجمة أو مستثناة (' + ignore.size + ')');
