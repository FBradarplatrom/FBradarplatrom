'use strict';
// أيقونات الإضافة ومتجر Chrome من شعار المنصة نفسه (public/favicon.svg)، حتى تكون الأيقونة واحدة في كل مكان.
// التشغيل: node adlib/tools/build-icons.js   ← يكتب extensions/ad-collector/icons/icon{16,48,128}.png
// إرشادات المتجر: أيقونة 128 فيها رسم 96×96 في الوسط مع هامش شفاف 16px.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..'), SVG = fs.readFileSync(path.join(ROOT, 'public', 'favicon.svg'), 'utf8'), OUT = path.join(ROOT, 'extensions', 'ad-collector', 'icons');
(async () => {
  const { chromium } = require('playwright'), b = await chromium.launch();
  try {
    for (const [n, art] of [[16, 16], [48, 44], [128, 96]]) {
      const p = await b.newPage({ viewport: { width: n, height: n }, deviceScaleFactor: 1 });
      await p.setContent(`<html><body style="margin:0;width:${n}px;height:${n}px;display:grid;place-items:center;background:transparent">${SVG.replace('<svg ', `<svg width="${art}" height="${art}" `)}</body></html>`);
      fs.writeFileSync(path.join(OUT, 'icon' + n + '.png'), await p.screenshot({ omitBackground: true })); await p.close();
    }
    console.log('✔ icons: 16, 48, 128');
  } finally { await b.close(); }
})();
