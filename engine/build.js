'use strict';
// يبني views/app.html من مصادر المحرك: engine/dicts.js + engine/core.js + engine/ui.js (مضمّنة في الصفحة)،
// ويضيف قبلها ملفي الأسواق وفحص المنتج (يخدمهما الخادم من adlib/lib على /radar-lib/).
// التشغيل: node engine/build.js   (بعد أي تعديل في core.js أو ui.js أو dicts.js)
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), APP = path.join(ROOT, 'views', 'app.html');
const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
let html = fs.readFileSync(APP, 'utf8');
const LIBS = '<script src="/radar-lib/kwdata.js"></script><script src="/radar-lib/markets.js"></script><script src="/radar-lib/productcheck.js"></script>';
const START = '<script>const DEF=', END = '</script><script src="/collect.js">';
const a = html.indexOf(START), b = html.indexOf(END);
if (a < 0 || b < a) throw new Error('app.html: engine markers not found');
const engine = read('dicts.js') + read('core.js') + read('ui.js');
const before = html.slice(0, a).split(LIBS).join('');
html = before + LIBS + '<script>' + engine + html.slice(b);
fs.writeFileSync(APP, html);
console.log('views/app.html rebuilt (' + Math.round(html.length / 1024) + ' KB)');
