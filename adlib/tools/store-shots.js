'use strict';
// صور متجر Chrome من المنصة نفسها ببيانات تجريبية:
//   store-build/{en,ar,fr}/  ← 5 لقطات 1280×800 لكل لغة (الواجهة، النتائج، الخروج من المنافسة، حاسبة الربح، جمع الإعلانات)
//   store-build/global/     ← أيقونة المتجر 128، اللوحة الصغيرة 440×280، اللوحة الكبيرة 1400×560
// كل الصور PNG بـ 24 بت بلا شفافية (شرط المتجر)، عدا الأيقونة. الذكاء الاصطناعي هنا خادم وهمي بنتيجة ثابتة لكل لغة.
const { spawn, execFileSync } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const ROOT = path.join(__dirname, '..', '..'), LOGO = fs.readFileSync(path.join(ROOT, 'public', 'favicon.svg'), 'utf8');

const DEMO = {
  en: { mk: 'US', ads: ['Star projector night light helps your baby sleep', 'Posture corrector – say goodbye to back pain', 'Mini vacuum removes dust from your car', 'Anti-snoring nose clip for a quiet night', 'Magnetic phone holder for car', 'Portable blender for smoothies on the go'], body: i => '. Free shipping. Only $' + (19 + i * 5) + '.99' },
  ar: { mk: 'DZ', ads: ['مصباح النجوم الليلي يساعد طفلك على النوم', 'حزام تصحيح الظهر يخلصك من آلام الظهر', 'مكنسة صغيرة تنظف سيارتك من الغبار', 'مشبك الأنف ضد الشخير لليلة هادئة', 'حامل هاتف مغناطيسي للسيارة', 'خلاط محمول للعصائر في أي مكان'], body: i => '. التوصيل مجاني لكل الولايات. السعر ' + (2900 + i * 500) + ' دج' },
  fr: { mk: 'FR', ads: ['Veilleuse projecteur d’étoiles qui aide bébé à dormir', 'Correcteur de posture – fini le mal de dos', 'Mini aspirateur qui enlève la poussière de la voiture', 'Clip nasal anti-ronflement pour des nuits calmes', 'Support téléphone magnétique pour voiture', 'Blender portable pour smoothies partout'], body: i => '. Livraison gratuite. Seulement ' + (19 + i * 5) + ',99 €' }
};
const ICONS = [[/projector|étoiles|النجوم/i, 'lamp'], [/posture|الظهر/i, 'users'], [/vacuum|aspirateur|مكنسة/i, 'car'], [/snor|ronfl|الشخير/i, 'sparkles'], [/phone|téléphone|هاتف/i, 'phone'], [/blend|خلاط/i, 'bottle']];

// نتيجة «الخروج من المنافسة» التجريبية بكل لغة
const idea = (type, title, what, items, price, hook, score) => ({ type, title, what, items, why: '', price, effort: 'easy', cost: 'low', margin: 'up', test: '', risk: '', hook, novelty: 4, score });
const EDGE = {
  en: { name: 'Star projector night light', product: { what: 'A night light that projects moving stars on the ceiling', job: 'Help a child fall asleep calmly', buyer: 'Parents of children aged 1–8' },
    diagnosis: { saturation: 'high', why: '14 advertisers run the same offer at almost the same price.', common_angle: 'Everyone says: “stars in your child’s room” at $29.99', price_war: 'Prices dropped from $39 to $24 in a month.', gaps: ['Adults with insomnia', 'Nurseries and kindergartens', 'Gift for a baby shower'] },
    ideas: [idea('bundle', '“Calm sleep” kit for kids', 'Projector + white-noise speaker + soft eye mask in one box.', ['Star projector', 'White-noise speaker', 'Kids eye mask'], '$49 instead of $29', 'Bedtime in 10 minutes, without tears.', 10), idea('split', 'Sell extra projection discs', 'Ocean, space and alphabet discs sold separately: repeat purchases.', ['Ocean disc', 'Space disc', 'Alphabet disc'], '$9 per disc, 3 for $22', 'New stars every week.', 9), idea('niche', 'Version for meditation and yoga rooms', 'Warm colours only, no music, for adults who relax before sleep.', ['Warm light only', 'Timer 30/60 min'], '$35', 'Your evening ritual, in light.', 8),
      idea('b2b', 'For nurseries and kindergartens', 'Packs of 10 with a quiet-time guide for staff.', ['10-pack price'], '$190 per 10', 'Nap time, made easy.', 8), idea('occasion', 'Baby shower gift box', 'Gift box with the child’s name printed on the card.', ['Gift box', 'Name card'], '$39', 'The gift every parent will use.', 7), idea('wild', 'Bedtime audio stories + matching disc', 'Each disc comes with a short audio story that matches the stars.', ['Story QR code'], '$12 per story-disc', 'A story they can see.', 7)],
    top: [{ i: 0, reason: 'Easy to source and raises the basket value' }, { i: 1, reason: 'Repeat purchases no competitor offers' }, { i: 2, reason: 'A segment nobody targets' }], plan: [{ day: '1-2', do: 'Order samples' }, { day: '3-5', do: 'Test the kit' }], avoid: [], assumptions: [] },
  ar: { name: 'مصباح النجوم الليلي', product: { what: 'مصباح ليلي يُسقط نجوماً متحركة على السقف', job: 'أن ينام الطفل بهدوء وبسرعة', buyer: 'أولياء أطفال من سنة إلى 8 سنوات' },
    diagnosis: { saturation: 'high', why: '14 معلناً يقدّمون نفس العرض بنفس السعر تقريباً.', common_angle: 'الكل يقول: «نجوم في غرفة طفلك» بسعر 3900 دج', price_war: 'نزلت الأسعار من 4500 إلى 3200 دج خلال شهر.', gaps: ['الكبار الذين يعانون الأرق', 'الحضانات وروض الأطفال', 'هدية مولود جديد'] },
    ideas: [idea('bundle', 'باك «نوم هادئ» للأطفال', 'المصباح + سماعة ضوضاء بيضاء + غطاء عين ناعم في علبة واحدة.', ['مصباح النجوم', 'سماعة ضوضاء بيضاء', 'غطاء عين للأطفال'], '5900 دج بدل 3900', 'طفلك ينام وحدو في 10 دقايق', 10), idea('split', 'بيع أقراص إسقاط إضافية', 'أقراص المحيط والفضاء والحروف تُباع منفصلة: شراء متكرر.', ['قرص المحيط', 'قرص الفضاء', 'قرص الحروف'], '900 دج للقرص، 3 بـ 2200', 'نجوم جديدة كل أسبوع', 9), idea('niche', 'نسخة لغرف التأمل واليوغا', 'ألوان دافئة فقط وبلا موسيقى، للكبار قبل النوم.', ['ضوء دافئ فقط', 'مؤقت 30/60 دقيقة'], '4500 دج', 'طقوس المساء تاعك بالضوء', 8),
      idea('b2b', 'للحضانات وروض الأطفال', 'باك 10 قطع مع دليل وقت القيلولة للمربّيات.', ['سعر 10 قطع'], '32000 دج للـ 10', 'القيلولة صارت ساهلة', 8), idea('occasion', 'علبة هدية للمولود الجديد', 'علبة هدية مع بطاقة باسم الطفل.', ['علبة هدية', 'بطاقة بالاسم'], '4900 دج', 'الهدية اللي كل أم تستعملها', 7), idea('wild', 'قصص صوتية قبل النوم مع القرص', 'كل قرص معه قصة صوتية قصيرة تناسب النجوم.', ['رمز QR للقصة'], '1200 دج للقصة والقرص', 'قصة يشوفها طفلك', 7)],
    top: [{ i: 0, reason: 'سهل التوفير ويرفع قيمة الطلب' }, { i: 1, reason: 'شراء متكرر لا يقدّمه أي منافس' }, { i: 2, reason: 'شريحة لا يستهدفها أحد' }], plan: [{ day: '1-2', do: 'اطلب عينات' }, { day: '3-5', do: 'اختبر الباك' }], avoid: [], assumptions: [] },
  fr: { name: 'Veilleuse projecteur d’étoiles', product: { what: 'Une veilleuse qui projette des étoiles mobiles au plafond', job: 'Aider l’enfant à s’endormir calmement', buyer: 'Parents d’enfants de 1 à 8 ans' },
    diagnosis: { saturation: 'high', why: '14 annonceurs proposent la même offre au même prix.', common_angle: 'Tout le monde dit : « des étoiles dans la chambre de votre enfant » à 29,99 €', price_war: 'Les prix sont passés de 39 € à 24 € en un mois.', gaps: ['Adultes insomniaques', 'Crèches et maternelles', 'Cadeau de naissance'] },
    ideas: [idea('bundle', 'Kit « sommeil calme » pour enfants', 'Projecteur + enceinte bruit blanc + masque doux dans une seule boîte.', ['Projecteur', 'Enceinte bruit blanc', 'Masque enfant'], '49 € au lieu de 29 €', 'Au lit en 10 minutes, sans pleurs.', 10), idea('split', 'Vendre des disques de projection en plus', 'Disques océan, espace et alphabet vendus à part : achats répétés.', ['Disque océan', 'Disque espace', 'Disque alphabet'], '9 € le disque, 3 pour 22 €', 'De nouvelles étoiles chaque semaine.', 9), idea('niche', 'Version pour méditation et yoga', 'Couleurs chaudes uniquement, sans musique, pour les adultes.', ['Lumière chaude', 'Minuterie 30/60 min'], '35 €', 'Votre rituel du soir, en lumière.', 8),
      idea('b2b', 'Pour crèches et maternelles', 'Packs de 10 avec un guide de la sieste pour le personnel.', ['Prix par 10'], '190 € les 10', 'La sieste, simplifiée.', 8), idea('occasion', 'Coffret cadeau de naissance', 'Coffret avec carte au prénom de l’enfant.', ['Coffret', 'Carte prénom'], '39 €', 'Le cadeau que chaque parent utilise.', 7), idea('wild', 'Histoires audio + disque assorti', 'Chaque disque a une courte histoire audio assortie aux étoiles.', ['QR code histoire'], '12 € le disque-histoire', 'Une histoire qu’ils peuvent voir.', 7)],
    top: [{ i: 0, reason: 'Facile à sourcer, panier plus élevé' }, { i: 1, reason: 'Achats répétés qu’aucun concurrent n’offre' }, { i: 2, reason: 'Un segment que personne ne cible' }], plan: [{ day: '1-2', do: 'Commandez des échantillons' }, { day: '3-5', do: 'Testez le kit' }], avoid: [], assumptions: [] }
};

module.exports = async function shots(OUT) {
  const { chromium } = require('playwright');
  const mock = http.createServer((q, s) => { let b = ''; q.on('data', d => b += d); q.on('end', () => {
    const sys = ((JSON.parse(b || '{}').messages || [])[0] || {}).content || '', lg = /in English/.test(sys) ? 'en' : /in French/.test(sys) ? 'fr' : 'ar';
    s.setHeader('content-type', 'application/json'); s.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(EDGE[lg]) } }] }));
  }); }).listen(0);
  const PORT = 5700 + Math.floor(Math.random() * 80), BASE = 'http://127.0.0.1:' + PORT, DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wpr-shots-'));
  const srv = spawn(process.execPath, [path.join(ROOT, 'server.js')], { env: Object.assign({}, process.env, { PORT, JWT_SECRET: 's'.repeat(40), ADMIN_EMAIL: 'admin@radar.app', DB_FILE: path.join(DIR, 'd.db'), NODE_ENV: 'test', BACKUP_DISABLE: '1',
    OPENAI_API_KEY: 'sk-demo', OPENAI_BASE_URL: 'http://127.0.0.1:' + mock.address().port + '/v1' }), stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  const b = await chromium.launch(), out = [];
  const clean = pg => pg.evaluate(() => { document.querySelectorAll('.wpr-dock,#toasts,.toast').forEach(d => d.remove()); }).catch(() => {});   // بلا الأزرار العائمة والإشعارات
  const shot = async (pg, file) => { await clean(pg); await pg.waitForTimeout(150); fs.mkdirSync(path.dirname(file), { recursive: true }); await pg.screenshot({ path: file }); out.push(file); };
  try {
    // حساب تجريبي (أول حساب = مدير؛ نستعمل الثاني كمشترك عادي)
    await fetch(BASE + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@radar.app', password: 'password123' }) });
    for (const L of ['en', 'ar', 'fr']) {
      const D = DEMO[L], dir = path.join(OUT, L);
      const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, locale: { en: 'en-US', ar: 'ar-DZ', fr: 'fr-FR' }[L] });
      await ctx.addInitScript(l => { try { localStorage.setItem('wpr_lang', l); } catch (e) {} }, L);
      // الإضافة «مثبّتة» (جسر وهمي يجيب مثل الإضافة) حتى تظهر صفحة الجمع كما يراها المستخدم بعد التثبيت
      await ctx.addInitScript(() => window.addEventListener('message', ev => { const d = ev.data; if (!d || d.tag !== 'WPR_PAGE') return;
        window.postMessage(Object.assign({ tag: 'WPR_BRIDGE', evt: 'reply', ok: true, id: d.id }, d.cmd === 'ping' ? { version: '1.7.2', state: { active: false } } : {}), location.origin); }));
      const pg = await ctx.newPage();
      // 1) الواجهة
      await pg.goto(BASE + '/?lang=' + L); await pg.waitForTimeout(900); await shot(pg, path.join(dir, '1-home.png'));
      // 2) نتائج التحليل (ثم 4: حاسبة الربح، ثم 3: الخروج من المنافسة)
      await pg.request.post(BASE + '/api/register', { data: { email: 'demo-' + L + '@radar.app', password: 'password123', name: { en: 'Sarah', ar: 'أمين', fr: 'Camille' }[L] } });
      const day = d => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10), C = ['#a2ddbf', '#bbf7d0', '#fed7aa', '#fbcfe8', '#bae6fd', '#cfeedd'], AGE = [18, 25, 6, 12, 3, 40];
      const rows = D.ads.map((t, i) => ({ ad_id: String(9100 + i), page_id: 'p' + i, page_name: ['Lumi Shop', 'BackFix', 'CarCare Store', 'SleepWell', 'DriveMate', 'BlendGo'][i], status: 'active', country: ['US', 'FR', 'GB', 'DE', 'SA', 'US'][i], title: t, body: t + D.body(i),
        start_date: day(AGE[i]), link_url: 'https://shop' + i + '.example/products/item-' + i, image_url: 'https://img.example/' + i + '.jpg' }));
      const f = path.join(DIR, 'demo-' + L + '.json'); fs.writeFileSync(f, JSON.stringify(rows));
      await pg.goto(BASE + '/analyze'); await pg.waitForSelector('#file', { state: 'attached' }); await pg.setInputFiles('#file', f); await pg.waitForSelector('#grid .pc');
      await pg.evaluate(([C, IC]) => document.querySelectorAll('#grid .pc-media').forEach((m, i) => { const tx = (m.closest('.pc') || m).innerText, ic = (IC.find(x => new RegExp(x[0], 'i').test(tx)) || [0, 'star'])[1];
        m.style.background = 'linear-gradient(135deg,' + C[i % C.length] + ',#6bc79a)'; m.innerHTML = '<div style="display:grid;place-items:center;height:100%;min-height:180px;color:#fff;font-size:84px">' + (window.ICO ? window.ICO(ic) : '') + '</div>'; }), [C, ICONS.map(x => [x[0].source, x[1]])]);
      await pg.evaluate(() => { const t = document.querySelector('#tabs'); window.scrollTo(0, t.getBoundingClientRect().top + window.scrollY - 20); }); await pg.waitForTimeout(300); await shot(pg, path.join(dir, '2-results.png'));
      // 4) حاسبة الربح (على أول بطاقة)
      await pg.click('#grid .pc [data-tool="profit"]'); await pg.waitForSelector('.tm [data-pf="price"]');
      await pg.fill('.tm [data-pf="price"]', '4900'); await pg.fill('.tm [data-pf="cost"]', '28'); await pg.dispatchEvent('.tm [data-pf="cost"]', 'input'); await pg.waitForTimeout(500);
      const pf = path.join(dir, '4-profit.png'); await shot(pg, pf); await pg.keyboard.press('Escape');
      const r = await (await pg.request.post(BASE + '/api/edge', { data: { p: { name: EDGE[L].name, market: D.mk }, lang: L } })).json();
      for (let i = 0; i < 50; i++) { const x = await (await pg.request.get(BASE + '/api/edge/' + r.id)).json(); if (x.status !== 'run') break; await new Promise(z => setTimeout(z, 200)); }
      await pg.goto(BASE + '/compete/' + r.id); await pg.waitForSelector('.ed-tc'); await pg.waitForTimeout(400);
      await pg.evaluate(() => { const h = document.querySelector('#v-edge .ph'); if (h) window.scrollTo(0, h.getBoundingClientRect().bottom + window.scrollY - 10); }); await shot(pg, path.join(dir, '3-compete.png'));
      // 5) جمع الإعلانات (حيث تعمل الإضافة)
      await pg.goto(BASE + '/collect'); await pg.waitForTimeout(1200); await shot(pg, path.join(dir, '5-collect.png'));
      await ctx.close();
    }
    // الصور العامة
    const G = path.join(OUT, 'global'); fs.mkdirSync(G, { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'extensions', 'ad-collector', 'icons', 'icon128.png'), path.join(G, 'store-icon-128.png'));
    const logo = (n, extra) => LOGO.replace('<svg ', `<svg width="${n}" height="${n}" style="display:block;border-radius:${n / 4}px;box-shadow:0 0 0 2px rgba(255,255,255,.35)${extra || ''}" `);
    const BG = 'background:radial-gradient(600px 400px at 85% 0%,#6bc79a,transparent),linear-gradient(135deg,#0a7040,#118553)';
    const tile = await b.newPage({ viewport: { width: 440, height: 280 }, deviceScaleFactor: 1 });
    await tile.setContent(`<link rel="stylesheet" href="${BASE}/fonts/fonts.css"><body style="margin:0;width:440px;height:280px;display:flex;flex-direction:column;justify-content:center;gap:10px;padding:0 34px;box-sizing:border-box;font-family:Inter,system-ui,sans-serif;color:#fff;${BG}">
<div>${logo(56)}</div><div style="font-size:30px;font-weight:800;line-height:1.15">Winning Product Radar</div><div style="font-size:16px;opacity:.92">Find winning products before the market gets crowded</div></body>`);
    await tile.waitForTimeout(400); await shot(tile, path.join(G, 'small-promo-tile-440x280.png'));
    const shotData = 'data:image/png;base64,' + fs.readFileSync(path.join(OUT, 'en', '2-results.png')).toString('base64');
    const mq = await b.newPage({ viewport: { width: 1400, height: 560 }, deviceScaleFactor: 1 });
    await mq.setContent(`<link rel="stylesheet" href="${BASE}/fonts/fonts.css"><body style="margin:0;width:1400px;height:560px;overflow:hidden;display:flex;align-items:center;gap:56px;padding:0 0 0 80px;box-sizing:border-box;font-family:Inter,system-ui,sans-serif;color:#fff;${BG}">
<div style="width:520px;flex:none;display:flex;flex-direction:column;gap:16px">${logo(72)}<div style="font-size:48px;font-weight:800;line-height:1.1">Winning Product Radar</div><div style="font-size:22px;opacity:.92;line-height:1.45">Spot winning products before the market gets crowded: winning ads, video trends, suppliers and AI ideas in one place.</div>
<div style="display:flex;gap:8px;flex-wrap:wrap">${['Winning ads', 'Trending videos', 'Suppliers', 'AI ideas'].map(t => `<span style="border:1px solid rgba(255,255,255,.4);background:rgba(255,255,255,.14);border-radius:99px;padding:6px 14px;font-size:15px">${t}</span>`).join('')}</div></div>
<div style="flex:1;align-self:stretch;position:relative"><img src="${shotData}" style="position:absolute;top:60px;left:0;width:880px;border-radius:18px;box-shadow:0 30px 60px -20px rgba(0,0,0,.45);border:6px solid rgba(255,255,255,.18)"></div></body>`);
    await mq.waitForTimeout(500); await shot(mq, path.join(G, 'marquee-promo-tile-1400x560.png'));
  } finally { await b.close(); srv.kill(); mock.close(); }
  // 24 بت بلا شفافية (شرط المتجر للقطات واللوحات)
  const conv = out.filter(f => !/store-icon/.test(f));
  execFileSync('python3', ['-I', '-c', 'import sys\nfrom PIL import Image\nfor f in sys.argv[1:]:\n  im=Image.open(f)\n  bg=Image.new("RGB",im.size,(255,255,255))\n  bg.paste(im.convert("RGBA"),mask=im.convert("RGBA").split()[3])\n  bg.save(f,optimize=True)', ...conv]);
  return out.length + 1;
};
