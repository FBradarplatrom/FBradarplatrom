/* محرك التحليل في خيط خلفي (Web Worker): الصفحة تبقى سلسة أثناء تحليل آلاف الإعلانات.
   نفس ملفات المحرك التي يستعملها المتصفح والخادم (لا نسخة ثانية من المنطق). */
const V = self.location.search || '';   // نفس رقم النسخة: من ذاكرة المتصفح
importScripts('/radar-lib/kwdata.js' + V, '/radar-lib/markets.js' + V, '/radar-lib/productcheck.js' + V, '/radar-lib/gapmatch.js' + V, '/radar-lib/core.js' + V);
let LK = '', LB = null;
onmessage = (e) => {
  const { id, rows, NOW, src, market, rates, vh } = e.data;
  try {
    const lk = JSON.stringify(src);
    if (lk !== LK) { LK = lk; LB = CORE.buildLists(src); }
    if (vh) for (const i in vh) if (rows[i]) rows[i]._vh = vh[i];   // دمج «بصمة الصورة»
    const t = Date.now(), P = CORE.analyze(rows, NOW, Object.assign({}, LB, { market, rates }));
    postMessage({ id, P, ms: Date.now() - t });
  } catch (x) { postMessage({ id, error: String((x && x.message) || x) }); }
};
