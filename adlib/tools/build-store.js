'use strict';
// حزمة متجر Chrome: الإضافة مربوطة بدومين المنصة + اسم ووصف بثلاث لغات (_locales) + نصوص صفحة المتجر + صور (اختياري).
// التشغيل: node adlib/tools/build-store.js --domain winningproductradar.com [--shots]
// الناتج في مجلد store-build/: الحزمة ZIP جاهزة للرفع، وملفات النصوص، والصور.
const fs = require('fs'), path = require('path'), { zip } = require('../zip.js');
const arg = n => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : null; };
const domain = String(arg('domain') || process.env.STORE_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) { console.error('حدد دومين المنصة: --domain example.com'); process.exit(1); }
const ROOT = path.join(__dirname, '..', '..'), EXT = path.join(ROOT, 'extensions', 'ad-collector'), OUT = path.join(ROOT, 'store-build');
const L = JSON.parse(fs.readFileSync(path.join(ROOT, 'extensions', 'store', 'listing.json'), 'utf8'));
const sub = s => String(s).replace(/\{site\}/g, domain);
fs.mkdirSync(OUT, { recursive: true });

// 1) الإضافة: نفس ملفات الإضافة، والمانيفست مربوط بالدومين ومترجم
const walk = (dir, base = '') => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => d.isDirectory() ? walk(path.join(dir, d.name), base + d.name + '/') : [{ name: base + d.name, file: path.join(dir, d.name) }]);
const hosts = [domain].concat(domain.startsWith('www.') ? [] : ['www.' + domain]), matches = hosts.map(h => `https://${h}/*`);
const m = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
m.content_scripts.forEach(c => { if ((c.js || []).includes('relay.js')) c.matches = matches; });
m.host_permissions = (m.host_permissions || []).filter(x => !x.includes('YOUR-PLATFORM-DOMAIN')).concat(matches);
m.name = '__MSG_name__'; m.short_name = '__MSG_short__'; m.description = '__MSG_desc__'; m.default_locale = 'en';
if (m.action) m.action.default_title = '__MSG_name__';
m.homepage_url = 'https://' + domain + '/';
const files = walk(EXT).filter(f => f.name !== 'manifest.json').map(f => ({ name: f.name, data: fs.readFileSync(f.file) }));
files.push({ name: 'manifest.json', data: Buffer.from(JSON.stringify(m, null, 2)) });
for (const lg of ['en', 'ar', 'fr']) {
  const desc = sub(L.short[lg]).slice(0, 132);   // حد المتجر لوصف المانيفست
  files.push({ name: `_locales/${lg}/messages.json`, data: Buffer.from(JSON.stringify({ name: { message: L.name[lg].slice(0, 75) }, short: { message: L.name[lg].split('–')[0].trim().slice(0, 45) }, desc: { message: desc } }, null, 2)) });
}
const zipName = `radar-ad-collector-${m.version}-${domain}.zip`;
fs.writeFileSync(path.join(OUT, zipName), zip(files));

// 2) نصوص صفحة المتجر
for (const lg of ['en', 'ar', 'fr']) fs.writeFileSync(path.join(OUT, `listing-${lg}.txt`), [
  'Name / الاسم:', L.name[lg], '', 'Summary / الملخص (≤132):', sub(L.short[lg]), '', 'Description / الوصف:', sub(L.description[lg]), ''].join('\n'));
fs.writeFileSync(path.join(OUT, 'review-answers.txt'), [
  'Category: ' + L.category, '', 'Single purpose:', L.single_purpose, '', 'Permission justifications:',
  ...Object.entries(L.permissions).map(([k, v]) => '• ' + k + ': ' + v), '', 'Remote code: ' + L.remote_code, '',
  'Data usage – collects: ' + L.data_usage.collects.join('; '), 'Data usage – does NOT collect: ' + L.data_usage.does_not_collect.join('; '),
  'Certifications: ' + L.data_usage.certify.join('; '), '', 'Privacy policy URL: ' + sub(L.privacy_url), 'Homepage URL: ' + sub(L.homepage_url), 'Support URL: ' + sub(L.support_url), ''].join('\n'));
console.log('✔ ' + path.join('store-build', zipName) + '  (v' + m.version + ', ' + files.length + ' files)');
console.log('✔ store-build/listing-en.txt · listing-ar.txt · listing-fr.txt · review-answers.txt');

// 3) الصور (اختياري): لقطات 1280×800 ولوحة ترويجية 440×280، من المنصة نفسها ببيانات تجريبية
if (process.argv.includes('--shots')) require('./store-shots.js')(OUT).then(n => console.log('✔ ' + n + ' صور في store-build/')).catch(e => { console.error('الصور:', e.message); process.exitCode = 1; });
// 4) دليل التعبئة بالعربية
fs.copyFileSync(path.join(ROOT, 'extensions', 'store', 'GUIDE-ar.txt'), path.join(OUT, 'GUIDE-ar.txt'));
