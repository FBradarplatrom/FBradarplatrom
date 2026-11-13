'use strict';
const U = require('./util.js');   // J · str · kvGet · kvSet
/* «الخروج من المنافسة»: منتج يبيعه كثيرون ← أفكار عملية ودقيقة لبيعه بطريقة لا ينافسك فيها أحد
   (باك مع منتجات مكمّلة، خيار إضافي، تفكيك وبيع الأجزاء، شريحة جديدة، زاوية لم يستعملها أحد، مناسبة، عرض، تغليف، خدمة، بيع للمحترفين…)
   الطلب يعمل في الخلفية (قد يستغرق دقيقة): POST يُنشئ المهمة ويعود فوراً، والصفحة تسأل عن النتيجة كل ثانيتين،
   فلا يقطع الخادم الوسيط (cPanel) الطلب الطويل. لا يخترع مواصفات ولا شهادات ولا مراجعات. */
const AI = require('./ai.js'), LIM = require('./limits.js'), MK = require('./lib/markets.js');

const TYPES = ['bundle', 'upgrade', 'split', 'niche', 'angle', 'occasion', 'offer', 'packaging', 'service', 'b2b', 'format', 'content', 'wild'];
const LEVEL = ['easy', 'medium', 'hard'], COST = ['low', 'medium', 'high'], MARGIN = ['up', 'same', 'down'];

module.exports = function mountEdge(app, X) {
  const { db, auth, active, wrap, now, imgData } = X;
  const bad = (m, code) => Object.assign(new Error(m), { status: code || 400 });
  const J = U.J;
  const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, n);
  const int = (v, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo; };
  const arr = (v, n, len) => (Array.isArray(v) ? v : []).map(x => str(x, len)).filter(Boolean).slice(0, n);
  const pick = (v, list, d) => list.includes(v) ? v : d;

  db.exec(`create table if not exists edge_runs(id integer primary key, user_id integer, k text, name text, input text, data text, status text, error text, created_at integer, done_at integer);
create index if not exists edge_user on edge_runs(user_id, created_at);`);

  const gapTarget = uid => { try { const c = JSON.parse((db.prepare("select v from user_kv where user_id=? and k='gap_target'").get(uid) || {}).v || '"DZ"'); return MK.COUNTRIES[c] && c !== 'ALL' ? c : 'DZ'; } catch (e) { return 'DZ'; } };
  const countryName = c => { try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(c); } catch (e) { return c; } };

  // تنظيف رد النموذج: أنواع وقيم معروفة فقط، ونصوص بطول محدود (لا HTML: الواجهة تهرّب كل شيء)
  function clean(d) {
    d = d || {};
    const P = d.product || {}, G = d.diagnosis || {};
    const ideas = (Array.isArray(d.ideas) ? d.ideas : []).slice(0, 14).map(x => ({
      type: pick(x.type, TYPES, 'angle'), title: str(x.title, 120), what: str(x.what, 700), items: arr(x.items, 8, 90), why: str(x.why, 500),
      price: str(x.price, 300), effort: pick(x.effort, LEVEL, 'medium'), cost: pick(x.cost, COST, 'medium'), margin: pick(x.margin, MARGIN, 'same'),
      test: str(x.test, 500), risk: str(x.risk, 300), hook: str(x.hook, 300), novelty: int(x.novelty, 1, 5), score: int(x.score, 1, 10)
    })).filter(x => x.title && x.what);
    const top = (Array.isArray(d.top) ? d.top : []).map(t => ({ i: int(t && t.i, 0, 99), reason: str(t && t.reason, 300) })).filter(t => t.i < ideas.length).slice(0, 3);
    return {
      product: { what: str(P.what, 300), job: str(P.job, 300), buyer: str(P.buyer, 300) },
      diagnosis: { saturation: pick(G.saturation, ['low', 'medium', 'high'], 'medium'), why: str(G.why, 500), common_angle: str(G.common_angle, 500), price_war: str(G.price_war, 300), gaps: arr(G.gaps, 6, 200) },
      ideas, top: top.length ? top : ideas.slice(0, 3).map((x, i) => ({ i, reason: '' })),
      plan: (Array.isArray(d.plan) ? d.plan : []).slice(0, 8).map(p => ({ day: str(p && p.day, 20), do: str(p && p.do, 400) })).filter(p => p.do),
      avoid: arr(d.avoid, 6, 300), assumptions: arr(d.assumptions, 6, 300)
    };
  }

  function prompts(inp, market, exclude, ui) {
    const country = countryName(market), cur = (MK.COUNTRIES[market] || {}).cur || '', lang = ((MK.LANGS[(MK.langsOf(market) || [])[0]] || {}).native) || 'Arabic';
    const sys = 'You are a senior e-commerce product strategist for cash-on-delivery and online shops in ' + country + '. ' +
      'A seller found a product that sells well but MANY advertisers already sell it the same way. Your job: find concrete, realistic ways to sell this exact product so the seller ESCAPES the competition ' +
      '(stops competing on the same offer and price) — ideas the other advertisers have not thought of. ' +
      'Think like a product designer, a merchandiser and a direct-response marketer at the same time. Use these lenses: ' +
      'bundle (pair with specific complementary products into a pack/kit), upgrade (add an option, variant, accessory or feature), split (sell parts, refills, consumables or a cheaper entry version separately, or turn one product into a range), ' +
      'niche (reposition for a precise segment: profession, age, situation, hobby), angle (a different problem or desire nobody advertises), occasion (season, gift, holiday, life event), ' +
      'offer (guarantee, trial, quantity ladder, subscription/refill, free gift that costs little), packaging (gift box, private label, personalization), service (setup, video guide, after-sale), ' +
      'b2b (sell to shops, salons, gyms, offices, schools in bulk), format (size, travel/mini, family pack), content (a creative format no competitor uses), wild (a surprising idea that still works). ' +
      'RULES: Every idea must be specific to THIS product and name concrete items (exact complementary products, the exact option, the exact segment) — no generic advice like "improve your ads" or "offer good service". ' +
      'Ideas must be sourceable (AliExpress/1688/local wholesale) and deliverable with cash on delivery in ' + country + '. Use the competitor ad texts to detect what everybody already says and avoid it. ' +
      'Never invent product specs, certifications, medical effects or reviews; if an idea depends on an assumption, say it in "assumptions". No counterfeit or brand names. ' +
      'Prices in ' + (cur || 'local currency') + ' when you give numbers. Write everything in ' + ({ en: 'English', fr: 'French' }[ui] || 'Modern Standard Arabic') + ', except "hook" which is a short ad opening line in ' + lang + ' as people in ' + country + ' write it. Return ONLY JSON.';
    const facts = { product: inp.name, description: inp.desc, selling_price: inp.price, purchase_cost: inp.cost, market: country, today: new Date().toISOString().slice(0, 10),
      competitors_seen: inp.sellers || undefined, ad_copies_seen: inp.copies || undefined, days_running: inp.days || undefined, product_link: inp.link || undefined, seller_constraints: inp.notes || undefined };
    const user = 'Product facts: ' + JSON.stringify(facts) + (inp.texts.length ? '\nCompetitor ad texts (what the market already says):\n' + inp.texts.join('\n---\n') : '') +
      (exclude.length ? '\nThe seller already has these ideas — give DIFFERENT ones: ' + exclude.join(' | ') : '') +
      '\n\nReturn JSON exactly like: {"product":{"what":"ما هو المنتج بدقة","job":"المهمة التي يشتريه الزبون من أجلها","buyer":"من يشتريه اليوم"},' +
      '"diagnosis":{"saturation":"low|medium|high","why":"لماذا","common_angle":"ما يقوله ويفعله كل المنافسين","price_war":"هل توجد حرب أسعار وما مداها","gaps":["زوايا أو شرائح لا يستعملها أحد"]},' +
      '"ideas":[{"type":"one of ' + TYPES.join('|') + '","title":"عنوان قصير","what":"الفكرة بالتفصيل: ماذا تبيع بالضبط وكيف","items":["المنتجات أو الخيارات أو الأجزاء المحددة"],"why":"لماذا تُخرجك من المنافسة ولماذا يفضّلها الزبون","price":"نصيحة السعر بالأرقام","effort":"easy|medium|hard","cost":"low|medium|high","margin":"up|same|down","test":"كيف تختبرها في 3-5 أيام بميزانية صغيرة","risk":"الخطر وكيف تتجنبه","hook":"افتتاحية إعلان","novelty":1-5,"score":1-10}],' +
      '"top":[{"i":0,"reason":"لماذا هذه من أفضل 3"}],"plan":[{"day":"1-2","do":"ماذا تفعل"}],"avoid":["أخطاء لا تقع فيها"],"assumptions":["افتراضات تحتاج تحققاً من المورّد"]}' +
      '\nGive 10 to 12 ideas covering at least 7 different types, including at least one bundle, one niche and one wild idea (and one split when the product has separable parts, refills or consumables). Sort ideas by score, best first. "top" = indexes of the 3 best ideas to start with. "plan" = a 7-day plan to test the top ideas.';
    return { sys, user };
  }

  async function run(id, uid, inp, market, exclude, ui) {
    try {
      const imgs = [];
      for (const u of inp.images.slice(0, 2)) {
        const d = /^data:image\//.test(u) ? u : (imgData ? await imgData(u).catch(() => '') : '');
        if (d) imgs.push({ type: 'image_url', image_url: { url: d, detail: 'low' } });
      }
      const { sys, user } = prompts(inp, market, exclude, ui);
      const r = await AI.chatJSON(sys, imgs.length ? [{ type: 'text', text: user }].concat(imgs) : user, { timeout: 150000, temperature: 0.8 });
      const data = Object.assign(clean(r.data), { market, model: r.model, vision: imgs.length > 0 });
      if (!data.ideas.length) throw new Error('لم يُرجع الذكاء الاصطناعي أفكاراً، أعد المحاولة');
      db.prepare("update edge_runs set status='done', data=?, done_at=? where id=? and user_id=?").run(JSON.stringify(data), now(), id, uid);
    } catch (e) {
      db.prepare("update edge_runs set status='err', error=?, done_at=? where id=? and user_id=?").run(str(e.message, 300), now(), id, uid);
      LIM.refundAI && LIM.refundAI(uid);   // الطلب الفاشل لا يُحتسب من الرصيد
    }
  }

  const view = (r, full) => {
    const inp = J(r.input, {}), d = full ? J(r.data, null) : null;
    let status = r.status, error = r.error || '';
    if (status === 'run' && now() - r.created_at > 4 * 60e3) { status = 'err'; error = 'انقطعت العملية (أُعيد تشغيل الخادم؟)، أعد المحاولة'; }
    const o = { id: r.id, k: r.k || '', name: r.name, status, error, created_at: r.created_at, market: inp.market || '' };
    if (full) { o.input = { name: inp.name, desc: inp.desc, price: inp.price, cost: inp.cost, notes: inp.notes, link: inp.link, market: inp.market, sellers: inp.sellers, copies: inp.copies, days: inp.days, texts: (inp.texts || []).length, images: (inp.images || []).filter(u => !/^data:/.test(u)) }; o.data = d; }
    else { const dd = J(r.data, null); o.n = dd && dd.ideas ? dd.ideas.length : 0; o.top = dd && dd.ideas && dd.top && dd.top[0] ? (dd.ideas[dd.top[0].i] || {}).title || '' : ''; }
    return o;
  };
  const own = (uid, id) => { const r = db.prepare('select * from edge_runs where id=? and user_id=?').get(+id || 0, uid); if (!r) throw bad('غير موجود', 404); return r; };

  app.get('/api/edge', auth, active, wrap((q, s) => s.json({ ai: AI.enabled(), market: gapTarget(q.u.id), runs: db.prepare('select id,k,name,input,data,status,error,created_at from edge_runs where user_id=? order by created_at desc limit 50').all(q.u.id).map(r => view(r, false)) })));
  app.get('/api/edge/:id', auth, active, wrap((q, s) => s.json(view(own(q.u.id, q.params.id), true))));
  app.delete('/api/edge/:id', auth, active, wrap((q, s) => { own(q.u.id, q.params.id); db.prepare('delete from edge_runs where id=? and user_id=?').run(+q.params.id, q.u.id); s.json({ ok: 1 }); }));
  app.post('/api/edge', auth, active, wrap((q, s) => {
    if (!AI.enabled()) throw bad('الذكاء الاصطناعي غير مفعّل: يضيف المدير المفتاح من «إعدادات المنصة ← الذكاء الاصطناعي»');
    const b = q.body || {}, p = b.p || {};
    if (db.prepare("select count(*) n from edge_runs where user_id=? and status='run' and created_at>?").get(q.u.id, now() - 4 * 60e3).n >= 2) throw bad('لديك تحليلان قيد التنفيذ، انتظر حتى ينتهيا', 429);
    const images = (Array.isArray(p.images) ? p.images : []).filter(u => typeof u === 'string' && (/^https?:\/\//.test(u) ? u.length < 2000 : /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(u) && u.length < 900000)).slice(0, 2);
    const inp = { name: str(p.name, 200), desc: str(p.desc, 1500), price: str(p.price, 60), cost: str(p.cost, 60), notes: str(p.notes, 600), link: /^https?:\/\//.test(p.link || '') ? str(p.link, 500) : '',
      texts: arr(p.texts, 6, 900), images, sellers: int(p.n, 0, 9999), copies: int(p.copies, 0, 99999), days: int(p.days, 0, 9999) };
    if (!inp.name && !inp.desc && !images.length) throw bad('اكتب اسم المنتج أو وصفه، أو أضف صورته');
    const market = MK.COUNTRIES[String(p.market || '').toUpperCase()] && p.market !== 'ALL' ? String(p.market).toUpperCase() : gapTarget(q.u.id);
    inp.market = market;
    // «أفكار أخرى»: نستبعد عناوين الأفكار السابقة لنفس المنتج
    let exclude = [];
    if (b.more) { const prev = db.prepare('select data from edge_runs where id=? and user_id=?').get(+b.more || 0, q.u.id); exclude = ((J(prev && prev.data, {}) || {}).ideas || []).map(x => x.title).slice(0, 14); }
    LIM.useAI(q.u);
    const id = db.prepare("insert into edge_runs(user_id,k,name,input,status,created_at) values(?,?,?,?,'run',?)").run(q.u.id, str(b.k, 300), inp.name || str(inp.desc, 60) || 'منتج بالصورة', JSON.stringify(Object.assign({}, inp, { images: images.filter(u => !/^data:/.test(u)), uploaded: images.filter(u => /^data:/.test(u)).length })), now()).lastInsertRowid;
    run(id, q.u.id, inp, market, exclude, ['en', 'fr'].includes(b.lang) ? b.lang : 'ar');
    s.json({ id, status: 'run' });
  }));
};
module.exports.TYPES = TYPES;
