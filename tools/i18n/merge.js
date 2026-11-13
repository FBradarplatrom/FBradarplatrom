'use strict';
// يدمج ترجمات (ملفات TSV: رقم المفتاح ⇥ English ⇥ Français) مع قائمة المفاتيح في القاموس public/i18n-dict.js.
// التشغيل: node tools/i18n/merge.js keys.json t1.tsv t2.tsv …   (القاموس الحالي يبقى، والجديد يُضاف أو يُحدَّث)
const fs = require('fs'), path = require('path'), F = path.join(__dirname, '..', '..', 'public', 'i18n-dict.js');
const [keysFile, ...tsvs] = process.argv.slice(2), keys = JSON.parse(fs.readFileSync(keysFile, 'utf8'));
const cur = new Map(); try { global.window = {}; require(F); (window.I18N_DICT || []).forEach(r => cur.set(r[0], r)); } catch (e) {}
let n = 0;
for (const t of tsvs) for (const line of fs.readFileSync(t, 'utf8').split('\n')) {
  if (!line.trim()) continue; const [i, en, fr] = line.split('\t');
  const ar = /^\d+$/.test(i) ? keys[+i] : i;   // سطر يبدأ بنص عربي بدل الرقم = مفتاح إضافي
  if (!ar || !en || !fr) { console.error('skip', JSON.stringify(line.slice(0, 80))); continue; }
  cur.set(ar, [ar, en.trim(), fr.trim()]); n++;
}
const out = '/* قاموس ترجمة لوحة التحكم: [العربية، English، Français]. {} = قيمة متغيرة (رقم، اسم…). يُستعمل من public/i18n.js */\nwindow.I18N_DICT=' + JSON.stringify([...cur.values()]).replace(/\],\[/g, '],\n[') + ';\n';
fs.writeFileSync(F, out); console.log('merged', n, '→', cur.size, 'entries');
