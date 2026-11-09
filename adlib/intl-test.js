'use strict';
// اختبار تكاملي للبحث الدولي: الخادم الحقيقي + إعلانات بصيغة مكتبة ميتا من عدة دول.
// يتحقق أن: القاموس يحمل لغات الأسواق، والاستقبال يستبعد غير المنتجات بلغة الدولة، ويُبقي المنتجات، ومحرك التحليل
// يقصي ما تسرّب، ومسار الجزائر لا يتغير.   التشغيل: node adlib/intl-test.js
const { spawn } = require('child_process'), assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const CORE = require('../engine/core.js');
const PORT = 4100 + Math.floor(Math.random() * 90), DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-intl-')), BASE = 'http://127.0.0.1:' + PORT;
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; };
const NOW = Math.floor(Date.now() / 1000);
let seq = 1000;
// إعلان خام بصيغة مكتبة ميتا (snapshot)
const raw = (title, body, o = {}) => ({
  ad_archive_id: String(++seq), page_id: String(5000 + seq), page_name: o.page || 'Page ' + seq, start_date: NOW - (o.days || 20) * 86400, is_active: true,
  collation_count: o.copies || 1, publisher_platform: ['FACEBOOK'],
  snapshot: { title, body: { text: body }, link_url: o.link || 'https://shop' + seq + '.example/products/item-' + seq, cta_type: o.cta || 'SHOP_NOW', cta_text: 'Shop now',
    page_categories: o.cats || [], display_format: 'IMAGE', images: [{ resized_image_url: 'https://scontent.example/' + seq + '.jpg' }] }
});
function client() {
  let cookie = '';
  return async (method, url, body) => {
    const r = await fetch(BASE + url, { method, redirect: 'manual', headers: Object.assign({ cookie }, body ? { 'content-type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch (e) { j = t; }
    return { status: r.status, body: j };
  };
}

const MARKETS = {
  US: { keep: [raw('Helps your child sleep through the night', 'White noise night light. Free shipping, $29.99.'), raw('Say goodbye to pet hair', 'Reusable lint roller. Buy 1 get 1 free.')],
    drop: [raw('Join our free masterclass', 'Learn Amazon FBA. Enroll now!', { cta: 'SIGN_UP' }),
      raw('Grand opening!', 'Visit our store at 12 Main St. Opening hours 9-9.', { cta: 'GET_DIRECTIONS', link: 'https://maps.app.goo.gl/x' })],
    warn: [raw('Fresh homemade cookies', 'Chocolate chip cookies baked daily.', { cta: 'ORDER_NOW' })] },
  FR: { keep: [raw('Dites adieu aux moustiques', 'Lampe anti-moustique USB. Livraison gratuite, 24,90€.')],
    drop: [raw('Formation en ligne certifiante', 'Inscrivez-vous, places limitées !', { cta: 'SIGN_UP' })], warn: [raw('Canapé d’angle 5 places', 'Livraison offerte. 899€')] },
  VN: { keep: [raw('Giúp bé ngủ ngon', 'Đèn ngủ cho bé. Freeship toàn quốc, 199k.')],
    drop: [raw('Khóa học livestream', 'Đăng ký học ngay hôm nay!', { cta: 'SIGN_UP' })], warn: [raw('Bánh trung thu handmade', 'Hộp 4 bánh, giao toàn quốc.')] },
  TW: { keep: [raw('告別腰痛', '人體工學護腰坐墊，免運，NT$590')], warn: [raw('鳳梨酥禮盒', '在地手工鳳梨酥，限時優惠。')], drop: [raw('新店開幕', '歡迎蒞臨！營業時間 11:00-21:00', { cta: 'GET_DIRECTIONS' })] },
  ID: { keep: [raw('Atasi jerawat dalam 7 hari', 'Serum anti jerawat. Gratis ongkir, bisa COD. Rp89.000')], drop: [raw('Kursus digital marketing', 'Kelas online bersertifikat. Daftar sekarang!', { cta: 'SIGN_UP' })] },
  PH: { keep: [raw('Wala nang lamok!', 'Mosquito killer lamp. COD nationwide, ₱399.')], drop: [raw("We're hiring!", 'Call center agents. Apply now!', { cta: 'APPLY_NOW' })] },
  IN: { keep: [raw('Get rid of back pain', 'Posture corrector belt. Cash on delivery. ₹499.')], drop: [raw('Admissions open', 'NEET coaching classes. Enroll now.', { cta: 'SIGN_UP', cats: ['Education'] })] },
  PK: { keep: [raw('Chehre ke daagh se chhutkara', 'Vitamin C serum. COD all over Pakistan. Rs 1,499')], drop: [raw('Umrah package 2026', '15 days with hotel. Book now.', { cta: 'BOOK_TRAVEL' })] },
  GB: { keep: [raw('Get rid of damp for good', 'Mini dehumidifier. Free UK delivery. £34.99')], drop: [raw('Summer Food Festival', 'Get your tickets now!', { cta: 'BUY_TICKETS' })] },
  ES: { keep: [raw('Adiós a las manchas de tu sofá', 'Limpiador portátil. Envío gratis, 29,95€.')], drop: [raw('Curso online de maquillaje', '¡Inscríbete hoy!', { cta: 'SIGN_UP' })] },
  DZ: { keep: [raw('يساعد طفلك على النوم', 'مصباح ليلي. التوصيل لـ 58 ولاية والدفع عند الاستلام. 3500 دج'), raw('وداعا لمشاكل التسرب', 'شريط لاصق يحبّس التسرب. خدمة التوصيل لجميع الولايات. 2200 دج')],
    drop: [raw('دورة تكوينية في الحلاقة', 'التسجيلات مفتوحة! سجل الآن', { cta: 'SIGN_UP' })], warn: [raw('حلويات تقليدية', 'مقروط وبقلاوة. اطلب الآن')] }
};

(async () => {
  const env = Object.assign({}, process.env, { PORT, JWT_SECRET: 'x'.repeat(40), ADMIN_EMAIL: 'admin@test.dz', DB_FILE: path.join(DIR, 'data.db'), NODE_ENV: 'test' });
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  try {
    const A = client();
    ok((await A('POST', '/api/register', { email: 'admin@test.dz', password: 'password123' })).status === 200, 'register');
    // ---- shared browser files are served
    for (const f of ['markets.js', 'productcheck.js']) { const r = await fetch(BASE + '/radar-lib/' + f); ok(r.status === 200 && /javascript/.test(r.headers.get('content-type')), f + ' served'); }
    // ---- dictionary carries every market language
    const d = (await A('GET', '/api/lib/dict')).body;
    for (const lg of ['en', 'es', 'vi', 'zh', 'id', 'tl', 'hi', 'ur', 'ar', 'dz', 'fr', 'arz']) ok(d.view.gold[lg] && d.view.gold[lg].strong.length, 'dict gold ' + lg);
    ok(d.view.niches.find(n => n.id === 'kids').comps.en.some(x => x.t === 'your child'), 'english complement "your child"');
    ok(d.view.niches.find(n => n.id === 'kids').comps.ar.some(x => x.t === 'طفلك'), 'algerian complements unchanged');
    // user edits on a new language are kept
    const put = await A('PUT', '/api/lib/dict', { diff: { gold: { en: { strong: { add: ['Keeps your'], off: ['Fixes'] } } } } });
    ok(put.body.view.gold.en.strong.some(x => x.t === 'Keeps your' && x.s === 'custom') && put.body.view.gold.en.strong.some(x => x.t === 'Fixes' && x.s === 'off'), 'per-user edits in English');
    // ---- ingestion per country
    const summary = [];
    for (const [cc, set] of Object.entries(MARKETS)) {
      const r = await A('POST', '/api/lib/ingest', { batch: 'b-' + cc, ads: set.keep.concat(set.drop, set.warn || []), ctx: { query: 'q', country: cc, label: 'جمع ' + cc } });
      ok(r.status === 200, cc + ' ingest ' + JSON.stringify(r.body));
      const kept = set.keep.length + (set.warn || []).length;   // الأكل/الكبير/الهش: تُحفظ مع تنبيه
      ok(r.body.added === kept, `${cc}: ${kept} products kept (got ${r.body.added})`);
      ok(r.body.filtered === set.drop.length, `${cc}: ${set.drop.length} non-products filtered (got ${r.body.filtered} ${JSON.stringify(r.body.byKind)})`);
      summary.push(`${cc} +${r.body.added}/-${r.body.filtered}`);
    }
    // filter switched off → everything is stored (user choice)
    const off = await A('POST', '/api/lib/ingest', { batch: 'b-off', ads: MARKETS.US.drop.map(x => Object.assign({}, x, { ad_archive_id: x.ad_archive_id + '9' })), ctx: { country: 'US', filter: false } });
    ok(off.body.added === MARKETS.US.drop.length && !off.body.filtered, 'filter can be switched off');
    // ---- stored rows carry country + CTA type, and the analysis engine reads them
    const runs = (await A('GET', '/api/runs')).body;
    const us = runs.find(x => /US/.test(x.label));
    const rows = (await A('GET', '/api/runs/' + us.id)).body.rows;
    ok(rows.every(r => r.country === 'US' && r.cta_type) && rows.filter(r => r.cta_type === 'SHOP_NOW').length === MARKETS.US.keep.length, 'rows carry country and CTA type');
    const offRun = runs.find(x => x.ads === MARKETS.US.drop.length && !/US/.test(x.label));
    const offRows = (await A('GET', '/api/runs/' + offRun.id)).body.rows;
    const L = CORE.buildLists({ strong: 'Helps, Say goodbye to', normal: '', brands: '', bulky: '', fragile: '' });
    const res = CORE.analyze(offRows.map(CORE.normRow), Date.now(), L);
    ok(res.length === MARKETS.US.drop.length && res.every(p => p.excl && p.why.some(w => /ليس منتجاً صالحاً/.test(w))), 'analysis excludes non-products that were stored with the filter off');
    const resUs = CORE.analyze(rows.map(CORE.normRow), Date.now(), L);
    ok(resUs.every(p => !p.excl) && resUs.some(p => p.benOk), 'US products stay and English golden words count as benefit');
    ok(resUs.some(p => /قد يكون/.test(p.warn || '') && /cookies/i.test(p.name)), 'food is kept with a warning tag');
    console.log('ingest by country:', summary.join(' · '));
    console.log(`PASS ${pass} international integration checks`);
  } catch (e) { console.error('FAIL', e.message); console.error(log.slice(-1500)); process.exitCode = 1; } finally { srv.kill(); fs.rmSync(DIR, { recursive: true, force: true }); }
})();
