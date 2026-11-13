/* قسم «الخروج من المنافسة»: منتج يبيعه كثيرون ← أفكار بالذكاء الاصطناعي لبيعه بطريقة لا ينافسك فيها أحد.
   المدخل: منتج محفوظ (صوره ونصوص إعلانات المنافسين ترسل تلقائياً) أو منتج جديد (اسم، وصف، صورة).
   الخادم: adlib/edge.js (مهمة في الخلفية، والصفحة تسأل عن النتيجة). يعمل مع app.html عبر WPREDGE.init(ctx) و WPREDGE.render(sub). */
(function () {
  'use strict';
  const W = window; let X = null, inited = false, seed = null, up = [], timer = null, LIST = null;
  const $ = s => X.root.querySelector(s);
  const e = window.WPRU.e;   // public/shared.js
  const I = n => (W.ICO ? W.ICO(n) : '');
  const MK = () => W.RadarMarkets;
  const flag = window.WPRU.flag;
  const mkName = c => (MK() && MK().COUNTRIES[c] ? MK().COUNTRIES[c].name : c || '');
  const img = u => (/^https?:/.test(u || '') ? '/api/img?u=' + encodeURIComponent(u) : u);

  const TYPE = {
    bundle: ['باك مع منتجات مكمّلة', 'package'], upgrade: ['خيار أو ميزة إضافية', 'plus'], split: ['التفكيك وبيع الأجزاء', 'scissors'], niche: ['شريحة جديدة', 'target'],
    angle: ['زاوية لم يستعملها أحد', 'chat'], occasion: ['مناسبة أو هدية', 'calendar'], offer: ['هيكلة العرض', 'tag'], packaging: ['التغليف والتخصيص', 'gift'],
    service: ['خدمة مضافة', 'wrench'], b2b: ['البيع للمحترفين', 'briefcase'], format: ['شكل أو حجم جديد', 'layers'], content: ['محتوى إعلاني مختلف', 'video'], wild: ['فكرة غير متوقعة', 'sparkles']
  };
  const LV = { easy: ['سهل', 'ok'], medium: ['متوسط', 'warn'], hard: ['صعب', 'bad'] }, CS = { low: ['تكلفة قليلة', 'ok'], medium: ['تكلفة متوسطة', 'warn'], high: ['تكلفة عالية', 'bad'] };
  const MG = { up: ['هامش أعلى', 'ok'], same: ['نفس الهامش', ''], down: ['هامش أقل', 'bad'] }, SAT = { low: 'منافسة ضعيفة', medium: 'منافسة متوسطة', high: 'منافسة شديدة' };
  const STEPS = ['يتعرّف على المنتج من الصورة والوصف…', 'يدرس ما يقوله المنافسون في إعلاناتهم…', 'يبحث عن الشرائح والزوايا التي لم يستعملها أحد…', 'يركّب الباكات والخيارات والعروض…', 'يرتّب الأفكار ويكتب خطة الاختبار…'];

  const st = document.createElement('style');
  st.textContent = `
.ed-hero{background:linear-gradient(135deg,var(--brand-h),var(--brand));color:#fff;border:0;padding:22px 24px}.ed-hero h2{color:#fff;margin:0 0 6px;font-size:21px}.ed-hero p{margin:0;opacity:.92;line-height:1.8}
.ed-steps{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.ed-steps span{background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.25);border-radius:99px;padding:5px 12px;font-size:13px;display:inline-flex;gap:6px;align-items:center}
.ed-src{display:flex;gap:6px;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:4px;width:max-content;max-width:100%;margin-bottom:14px}.ed-src button{border:0;background:none;font:inherit;padding:7px 14px;border-radius:9px;cursor:pointer;color:var(--mut)}.ed-src button.on{background:var(--card);color:var(--brand-t);font-weight:700;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.ed-f{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.ed-f .full{grid-column:1/-1}@media(max-width:700px){.ed-f{grid-template-columns:1fr}}
.ed-f label{display:flex;flex-direction:column;gap:5px;font-size:13.5px;font-weight:600}.ed-f textarea{min-height:84px}
.ed-ims{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.ed-ims img{width:64px;height:64px;object-fit:cover;border-radius:10px;border:1px solid var(--line);background:var(--card2)}
.ed-up{width:64px;height:64px;border:1.5px dashed var(--line);border-radius:10px;display:grid;place-items:center;color:var(--mut);cursor:pointer;background:var(--card2)}.ed-up:hover{border-color:var(--brand-t);color:var(--brand-t)}
.ed-seed{display:flex;gap:12px;align-items:center;background:var(--soft);border-radius:12px;padding:10px 12px;font-size:13.5px}.ed-seed img{width:52px;height:52px;border-radius:10px;object-fit:cover}
.ed-run{text-align:center;padding:34px 16px}.ed-run .sp{width:46px;height:46px;border-radius:50%;border:4px solid var(--soft);border-top-color:var(--brand-t);margin:0 auto 14px;animation:edsp 1s linear infinite}@keyframes edsp{to{transform:rotate(360deg)}}
.ed-run ol{list-style:none;padding:0;margin:14px auto 0;max-width:420px;text-align:start}.ed-run li{padding:5px 0;color:var(--mut);display:flex;gap:8px;align-items:center}.ed-run li.on{color:var(--ink);font-weight:700}.ed-run li.ok{color:var(--brand-t)}
.ed-head{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.ed-head h2{flex:1;margin:0;font-size:20px;min-width:200px}
.ed-dg{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px}@media(max-width:860px){.ed-dg{grid-template-columns:1fr}}
.ed-sat{display:flex;gap:4px;margin:6px 0 4px}.ed-sat i{flex:1;height:8px;border-radius:99px;background:var(--line)}.ed-sat.low i:nth-child(1){background:#16a34a}.ed-sat.medium i:nth-child(-n+2){background:#d97706}.ed-sat.high i{background:#dc2626}
.ed-q{background:var(--card2);border:1px solid var(--line);border-radius:8px;padding:8px 12px;margin:6px 0;font-size:14px}
.ed-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.ed-chips span{background:var(--soft);color:var(--brand-h);border-radius:99px;padding:4px 11px;font-size:13px}
.ed-top{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}@media(max-width:860px){.ed-top{grid-template-columns:1fr}}
.ed-tc{border:1.5px solid var(--brand);border-radius:14px;padding:14px;background:var(--card);cursor:pointer;display:flex;flex-direction:column;gap:6px}.ed-tc:hover{box-shadow:0 8px 22px -14px rgba(18,25,22,0.22)}
.ed-tc .n{width:28px;height:28px;border-radius:50%;background:var(--brand);color:var(--on-brand);display:grid;place-items:center;font-weight:700}
.ed-flt{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 12px}@media(max-width:700px){.ed-flt{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}.ed-flt button{flex:none}}.ed-flt button{border:1px solid var(--line);background:var(--card);border-radius:99px;padding:5px 12px;font:inherit;font-size:13px;cursor:pointer;display:inline-flex;gap:5px;align-items:center}.ed-flt button.on{background:var(--brand);border-color:var(--brand-t);color:var(--on-brand)}
.ed-ideas{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}@media(max-width:860px){.ed-ideas{grid-template-columns:1fr}}
.ed-i{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:8px;scroll-margin-top:80px}.ed-i.hl{border-color:var(--brand-t);box-shadow:0 0 0 3px var(--soft)}
.ed-t{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:var(--brand-t);background:var(--soft);border-radius:99px;padding:3px 10px;width:max-content}
.ed-i h3{margin:0;font-size:16.5px;line-height:1.5}.ed-i p{margin:0;line-height:1.75;font-size:14px}.ed-lb{font-size:12.5px;font-weight:700;color:var(--mut);display:flex;gap:5px;align-items:center;white-space:nowrap}
.ed-rows{display:flex;flex-direction:column;gap:2px;border-top:1px solid var(--line);padding-top:8px}.ed-rows>div{display:grid;grid-template-columns:96px minmax(0,1fr);gap:10px;align-items:baseline;padding:3px 0}.ed-rows p{font-size:13.5px!important}
.ed-sc{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--mut)}.ed-sc u{flex:1;height:6px;border-radius:99px;background:var(--line);overflow:hidden;text-decoration:none;max-width:120px}.ed-sc u s{display:block;height:100%;background:var(--brand)}
.ed-hook{display:flex;gap:8px;align-items:flex-start;background:var(--card2);border:1px dashed var(--line);border-radius:10px;padding:8px 10px;font-size:14px}.ed-hook div{flex:1}
.ed-pl{display:flex;flex-direction:column;gap:0}.ed-pl div{display:grid;grid-template-columns:90px minmax(0,1fr);gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}.ed-pl div:last-child{border:0}.ed-pl b{color:var(--brand-t)}
.ed-h{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}.ed-hc{border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:var(--card);cursor:pointer;display:flex;flex-direction:column;gap:3px}.ed-hc:hover{border-color:var(--brand-t)}
.ed-hb{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px}.ed-all{display:flex;gap:6px;align-items:center;font-size:13.5px;cursor:pointer}.ed-hc{position:relative}.ed-ck{position:absolute;top:10px;inset-inline-end:10px;width:17px;height:17px;cursor:pointer}.ed-hc b{font-size:14.5px;padding-inline-end:24px}.ed-hc small{color:var(--mut)}`;
  document.head.appendChild(st);

  /* ---------- الصفحة الرئيسية للقسم: النموذج + التحليلات السابقة ---------- */
  async function home() {
    const el = $('#x-edge'); stop();
    const j = await X.api('GET', '/edge'); LIST = j;
    if (!j.ai) { el.innerHTML = '<div class="alert">الذكاء الاصطناعي غير مفعّل. يضيف المدير المفتاح من «إعدادات المنصة ← الذكاء الاصطناعي».</div>' + hist(j.runs); return; }
    let sv = []; try { sv = W.__svLoad ? await W.__svLoad() : []; } catch (x) {}
    const M = MK(), mk = (seed && seed.market) || j.market || 'DZ';
    const opts = M ? Object.keys(M.COUNTRIES).filter(c => c !== 'ALL').sort((a, b) => (a === mk ? -1 : b === mk ? 1 : 0)).map(c => `<option value="${c}"${c === mk ? ' selected' : ''}>${flag(c)} ${e(M.COUNTRIES[c].name)}</option>`).join('') : `<option value="${e(mk)}">${e(mk)}</option>`;
    const mode = seed ? 'saved' : (sv.length ? 'saved' : 'new');
    el.innerHTML = `<div class="card ed-hero"><h2>بِع المنتج نفسه… بطريقة لا ينافسك فيها أحد</h2><p>وجدت منتجاً رابحاً لكن يبيعه كثيرون؟ يحلّله الذكاء الاصطناعي ويدرس ما يقوله المنافسون، ثم يقترح عليك أفكاراً عملية ودقيقة: باك مع منتجات مكمّلة، خيار إضافي، تفكيكه وبيع أجزائه، شريحة لم يستهدفها أحد، مناسبة، عرض مختلف… مع خطة اختبار لـ 7 أيام.</p>
<div class="ed-steps"><span>${I('package')} 1. اختر المنتج</span><span>${I('search')} 2. يدرس المنافسة</span><span>${I('lamp')} 3. أفكار مرتّبة وخطة اختبار</span></div></div>
<div class="card" style="margin-top:14px"><div class="ed-src" role="tablist"><button type="button" data-ed="src" data-m="saved" class="${mode === 'saved' ? 'on' : ''}">من منتجاتي المحفوظة</button><button type="button" data-ed="src" data-m="new" class="${mode === 'new' ? 'on' : ''}">منتج جديد</button></div>
<form class="ed-f" id="ed-form">
<div class="full" data-pane="saved"${mode === 'saved' ? '' : ' hidden'}>${sv.length || seed ? `<label>المنتج<select id="ed-sv"><option value="">— اختر منتجاً محفوظاً —</option>${sv.map(p => `<option value="${e(p.k)}"${seed && seed.k === p.k ? ' selected' : ''}>${e(p.name || p.k)}</option>`).join('')}</select></label><div id="ed-seed" style="margin-top:10px"></div>` : '<p class="sub">لا توجد منتجات محفوظة بعد. احفظ منتجاً من نتائج التحليل، أو اختر «منتج جديد».</p>'}</div>
<label class="full" data-pane="new"${mode === 'new' ? '' : ' hidden'}>اسم المنتج<input id="ed-name" maxlength="200" placeholder="مثال: مصباح ليلي بإسقاط النجوم"></label>
<label class="full">وصف المنتج أو نص إعلان منافس <small class="muted" style="font-weight:400">(اختياري، كلما كان أدق كانت الأفكار أدق)</small><textarea id="ed-desc" maxlength="1500" placeholder="ما هو المنتج، كيف يعمل، ما يقوله المعلنون عنه…"></textarea></label>
<div class="full"><div class="ed-lb" style="font-size:13.5px;font-weight:600;margin-bottom:5px">صورة المنتج <small class="muted" style="font-weight:400">(حتى صورتين: يراها الذكاء الاصطناعي ليفهم المنتج)</small></div><div class="ed-ims" id="ed-ims"></div><input type="file" id="ed-file" accept="image/*" multiple hidden></div>
<label>سعر البيع عند المنافسين<input id="ed-price" maxlength="60" placeholder="مثال: 3900 دج"></label>
<label>سعر الشراء من المورّد <small class="muted" style="font-weight:400">(اختياري)</small><input id="ed-cost" maxlength="60" placeholder="مثال: 900 دج"></label>
<label>السوق المستهدف<select id="ed-mk">${opts}</select></label>
<label>إمكانياتك وقيودك <small class="muted" style="font-weight:400">(اختياري)</small><input id="ed-notes" maxlength="600" placeholder="مثال: ميزانية صغيرة، أستورد من الصين، لا أملك مخزناً"></label>
<div class="full row" style="align-items:center;gap:12px"><button class="btn" type="submit">${I('lamp')} ابحث عن طريق للخروج من المنافسة</button><span class="sub">يستهلك طلباً واحداً من رصيد الذكاء الاصطناعي، ويستغرق نحو دقيقة.</span></div>
</form></div>` + hist(j.runs);
    if (seed) { fillSeed(seed); } else if (mode === 'saved' && sv.length === 1) { $('#ed-sv').value = sv[0].k; pickSaved(sv[0].k); }
    drawUp();
  }
  function hist(runs) {
    if (!runs || !runs.length) return '';
    return `<div class="card" style="margin-top:14px"><div class="ed-hb"><h2 style="margin:0;flex:1">تحليلاتك السابقة</h2><label class="ed-all"><input type="checkbox" data-ed="selall"> تحديد الكل</label><button class="btn danger sm" data-ed="delsel" disabled>حذف المحدد</button></div><div class="ed-h">${runs.map(r => `<div class="ed-hc" data-ed="open" data-id="${r.id}"><input type="checkbox" class="ed-ck" data-ed="sel" value="${r.id}" aria-label="تحديد"><b>${e(r.name)}</b>${r.status === 'done' ? `<small>${r.n} فكرة${r.top ? ' · الأولى: ' + e(r.top) : ''}</small>` : r.status === 'run' ? '<small>قيد التحليل…</small>' : `<small style="color:var(--bad)">${e(r.error || 'فشل')}</small>`}<small>${flag(r.market)} ${e(X.ago(r.created_at))}</small></div>`).join('')}</div></div>`;
  }
  function pickSaved(k) {
    if (!k) { seed = null; $('#ed-seed').innerHTML = ''; drawUp(); return; }
    const p = W.WPRTOOLS && W.WPRTOOLS.productOf(k, true); if (!p) return;
    seed = p; fillSeed(p);
  }
  function fillSeed(p) {
    const box = $('#ed-seed'); if (box) box.innerHTML = `<div class="ed-seed">${p.images[0] ? `<img src="${e(img(p.images[0]))}" alt="">` : ''}<div><b>${e(p.name)}</b><div class="sub">${p.market ? flag(p.market) + ' ' + e(mkName(p.market)) + ' · ' : ''}${p.n ? p.n + ' معلنين · ' : ''}${p.days ? p.days + ' يوماً · ' : ''}سنرسل ${p.texts.length} من نصوص إعلانات المنافسين${p.images.length ? ' وصورة المنتج' : ''}</div></div></div>`;
    if (p.price && !$('#ed-price').value) $('#ed-price').value = p.price;
    if ($('#ed-sv') && p.k && !$('#ed-sv').value) { const o = [...$('#ed-sv').options].find(x => x.value === p.k); if (o) $('#ed-sv').value = p.k; }
    drawUp();
  }
  function drawUp() {
    const box = $('#ed-ims'); if (!box) return;
    const fromSeed = isSaved() && seed ? seed.images.slice(0, 2) : [];
    box.innerHTML = fromSeed.concat(up).map((u, i) => `<img src="${e(img(u))}" alt="" title="${i < fromSeed.length ? 'من المنتج المحفوظ' : 'صورتك'}">`).join('') + (fromSeed.length + up.length < 2 ? `<label class="ed-up" for="ed-file" title="أضف صورة">${I('upload')}</label>` : `<button type="button" class="btn ghost sm" data-ed="clrimg">إزالة صوري</button>`);
  }
  const isSaved = () => { const b = X.root.querySelector('.ed-src .on'); return b && b.dataset.m === 'saved'; };
  // تصغير الصورة في المتصفح (768px) قبل الإرسال
  const shrink = f => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => { const s = Math.min(1, 768 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', 0.85)); }; im.onerror = () => no(new Error('صورة غير صالحة')); im.src = r.result; }; r.onerror = () => no(new Error('تعذّرت قراءة الصورة')); r.readAsDataURL(f); });

  async function submit(more, base) {
    let body;
    if (more) body = { more: base.id, k: base.k, p: base.p };
    else {
      const saved = isSaved() && seed, name = saved ? seed.name : $('#ed-name').value.trim(), desc = $('#ed-desc').value.trim();
      if (isSaved() && !seed) return X.toast('اختر منتجاً محفوظاً، أو اضغط «منتج جديد»', 'err');
      if (!saved && !name && !desc && !up.length) return X.toast('اكتب اسم المنتج أو وصفه، أو أضف صورته', 'err');
      const p = { name, desc, price: $('#ed-price').value.trim(), cost: $('#ed-cost').value.trim(), notes: $('#ed-notes').value.trim(), market: $('#ed-mk').value,
        images: (saved ? seed.images.slice(0, 2) : []).concat(up).slice(0, 2), texts: saved ? seed.texts : [], n: saved ? seed.n : 0, copies: saved ? seed.copies : 0, days: saved ? seed.days : 0, link: saved && seed.links ? seed.links[0] || '' : '' };
      body = { k: saved ? seed.k : '', p };
      try { sessionStorage.setItem('wpr_edge_last', JSON.stringify({ k: body.k, p: Object.assign({}, p, { images: p.images.filter(u => !/^data:/.test(u)) }) })); } catch (x) {}
    }
    body.lang = W.__LANG || 'ar';
    const j = await X.api('POST', '/edge', body);
    seed = null; up = [];
    X.url('/compete/' + j.id); return result(j.id);
  }

  /* ---------- النتيجة ---------- */
  function stop() { if (timer) { clearTimeout(timer); timer = null; } }
  async function result(id) {
    stop(); const el = $('#x-edge'); const t0 = Date.now();
    const tick = async () => {
      if (X.cur() !== 'edge' || !location.pathname.startsWith('/compete/' + id)) return stop();
      let r; try { r = await X.api('GET', '/edge/' + id); } catch (x) { el.innerHTML = `<div class="alert err">${e(x.message)}</div><p><button class="btn ghost" data-ed="home">رجوع</button></p>`; return; }
      if (r.status === 'run') {
        const s = Math.min(STEPS.length - 1, Math.floor((Date.now() - Math.max(t0, r.created_at)) / 12000));
        el.innerHTML = `<div class="card ed-run"><div class="sp"></div><h2 style="margin:0">يحلّل «${e(r.name)}»</h2><p class="sub">يستغرق نحو دقيقة. يمكنك مغادرة الصفحة والعودة: النتيجة تُحفظ في «تحليلاتك السابقة».</p><ol>${STEPS.map((x, i) => `<li class="${i < s ? 'ok' : i === s ? 'on' : ''}">${i < s ? I('check') : i === s ? I('hourglass') : I('clock')} ${x}</li>`).join('')}</ol></div>`;
        timer = setTimeout(tick, 2000); return;
      }
      if (r.status === 'err') { el.innerHTML = `<div class="alert err">تعذّر التحليل: ${e(r.error)}</div><p class="row"><button class="btn" data-ed="retry" data-id="${r.id}">أعد المحاولة</button><button class="btn ghost" data-ed="home">رجوع</button></p>`; return; }
      draw(r);
    };
    return tick();
  }
  let CUR = null;
  function draw(r) {
    CUR = r; scrollTo({ top: 0 }); const d = r.data || {}, G = d.diagnosis || {}, P = d.product || {}, ideas = d.ideas || [], topI = (d.top || []).map(t => t.i);
    const types = [...new Set(ideas.map(x => x.type))];
    $('#x-edge').innerHTML = `<div class="card"><div class="ed-head"><button class="btn ghost sm" data-ed="home" title="رجوع">${I('undo')} كل التحليلات</button><h2>${e(r.name)}</h2><span class="sub">${flag(d.market)} ${e(mkName(d.market))} · ${e(X.ago(r.created_at))}</span>
<button class="btn ghost sm" data-ed="copy">${I('copy')} نسخ كل الأفكار</button><button class="btn sm" data-ed="more">${I('refresh')} أفكار أخرى</button><button class="btn ghost sm" data-ed="del" title="حذف">${I('trash')}</button></div></div>
<div class="ed-dg" style="margin-top:14px"><div class="card"><h2>حالة المنافسة</h2><div class="ed-sat ${e(G.saturation)}"><i></i><i></i><i></i></div><b>${e(SAT[G.saturation] || '')}</b><p class="sub" style="margin:4px 0 0">${e(G.why)}</p>
${G.common_angle ? `<div class="ed-lb" style="margin-top:10px;font-weight:700">ما يفعله كل المنافسين</div><div class="ed-q">${e(G.common_angle)}</div>` : ''}${G.price_war ? `<p class="sub" style="margin:6px 0 0">${I('tag')} ${e(G.price_war)}</p>` : ''}</div>
<div class="card"><h2>المنتج كما فهمه الذكاء الاصطناعي</h2><p style="margin:0 0 6px">${e(P.what)}</p>${P.job ? `<p class="sub" style="margin:0 0 4px"><b>يشتريه الزبون من أجل:</b> ${e(P.job)}</p>` : ''}${P.buyer ? `<p class="sub" style="margin:0"><b>من يشتريه اليوم:</b> ${e(P.buyer)}</p>` : ''}
${(G.gaps || []).length ? `<div class="ed-lb" style="margin-top:10px;font-weight:700">مساحات لا يستعملها أحد</div><div class="ed-chips">${G.gaps.map(g => `<span>${e(g)}</span>`).join('')}</div>` : ''}</div></div>
<div class="card" style="margin-top:14px"><h2>ابدأ بهذه الأفكار الثلاث</h2><div class="ed-top">${(d.top || []).map((t, n) => { const x = ideas[t.i] || {}; return `<div class="ed-tc" data-ed="go" data-i="${t.i}"><div style="display:flex;gap:8px;align-items:center"><span class="n">${n + 1}</span><span class="ed-t">${I((TYPE[x.type] || [])[1])} ${e((TYPE[x.type] || [''])[0])}</span></div><b>${e(x.title)}</b>${t.reason ? `<span class="sub">${e(t.reason)}</span>` : ''}</div>`; }).join('')}</div></div>
<div style="margin-top:18px"><h2 style="margin:0 0 8px">كل الأفكار (${ideas.length})</h2><div class="ed-flt"><button class="on" data-ed="flt" data-t="">الكل</button>${types.map(t => `<button data-ed="flt" data-t="${e(t)}">${I((TYPE[t] || [])[1])} ${e((TYPE[t] || [t])[0])} (${ideas.filter(x => x.type === t).length})</button>`).join('')}</div>
<div class="ed-ideas">${ideas.map((x, i) => card(x, i, topI.includes(i))).join('')}</div></div>
${(d.plan || []).length ? `<div class="card" style="margin-top:14px"><h2>${I('calendar')} خطة اختبار لـ 7 أيام</h2><div class="ed-pl">${d.plan.map(p => `<div><b>اليوم ${e(p.day)}</b><span>${e(p.do)}</span></div>`).join('')}</div></div>` : ''}
<div class="ed-dg" style="margin-top:14px">${(d.avoid || []).length ? `<div class="card"><h2>${I('ban')} أخطاء لا تقع فيها</h2><ul style="margin:0;padding-inline-start:20px;line-height:1.9">${d.avoid.map(a => `<li>${e(a)}</li>`).join('')}</ul></div>` : ''}
${(d.assumptions || []).length ? `<div class="card"><h2>${I('search')} تحقّق منها مع المورّد</h2><ul style="margin:0;padding-inline-start:20px;line-height:1.9">${d.assumptions.map(a => `<li>${e(a)}</li>`).join('')}</ul></div>` : ''}</div>
<p class="sub" style="margin-top:12px">أفكار يقترحها الذكاء الاصطناعي من وصف المنتج وإعلانات المنافسين: اختبرها بميزانية صغيرة قبل التوسّع، وتحقّق من المواصفات مع المورّد.</p>`;
  }
  function card(x, i, top) {
    const t = TYPE[x.type] || [x.type, 'lamp'], pill = (m, k) => m[k] ? `<span class="pill ${m[k][1]}">${m[k][0]}</span>` : '';
    return `<div class="ed-i${top ? ' hl' : ''}" id="ed-i${i}" data-type="${e(x.type)}"><div style="display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap"><span class="ed-t">${I(t[1])} ${e(t[0])}</span><span class="ed-sc" title="التقييم ${x.score}/10 · الجِدّة ${x.novelty}/5"><u><s style="width:${x.score * 10}%"></s></u>${x.score}/10</span></div>
<h3>${e(x.title)}</h3><p>${e(x.what)}</p>${(x.items || []).length ? `<div class="ed-chips">${x.items.map(s => `<span>${e(s)}</span>`).join('')}</div>` : ''}
<div class="ed-rows">${x.why ? `<div><span class="ed-lb">${I('target')} لماذا تنجح</span><p>${e(x.why)}</p></div>` : ''}${x.price ? `<div><span class="ed-lb">${I('tag')} السعر</span><p>${e(x.price)}</p></div>` : ''}${x.test ? `<div><span class="ed-lb">${I('flask')} اختبرها</span><p>${e(x.test)}</p></div>` : ''}${x.risk ? `<div><span class="ed-lb">${I('alert')} انتبه</span><p class="sub">${e(x.risk)}</p></div>` : ''}</div>
${x.hook ? `<div class="ed-hook"><div dir="auto">${e(x.hook)}</div><button type="button" class="btn ghost sm" data-ed="cp" data-t="${e(x.hook)}" title="نسخ">${I('copy')}</button></div>` : ''}
<div class="ed-chips" style="margin-top:2px">${pill(LV, x.effort)}${pill(CS, x.cost)}${pill(MG, x.margin)}</div></div>`;
  }
  function asText(r) {
    const d = r.data || {}, L = [r.name, ''];
    (d.ideas || []).forEach((x, i) => { L.push((i + 1) + '. [' + ((TYPE[x.type] || [x.type])[0]) + '] ' + x.title, x.what); if ((x.items || []).length) L.push('- ' + x.items.join('، ')); if (x.why) L.push('لماذا: ' + x.why); if (x.price) L.push('السعر: ' + x.price); if (x.test) L.push('الاختبار: ' + x.test); if (x.hook) L.push('افتتاحية: ' + x.hook); L.push(''); });
    if ((d.plan || []).length) { L.push('خطة 7 أيام:'); d.plan.forEach(p => L.push('اليوم ' + p.day + ': ' + p.do)); }
    return L.join('\n');
  }

  function bind() {
    X.root.addEventListener('click', async ev => {
      const b = ev.target.closest('[data-ed]'); if (!b || !b.closest('#v-edge')) return;
      const a = b.dataset.ed;
      try {
        if (a === 'sel' || a === 'selall') {
          if (a === 'selall') X.root.querySelectorAll('#v-edge .ed-ck').forEach(c => { c.checked = b.checked; });
          const n = X.root.querySelectorAll('#v-edge .ed-ck:checked').length, d = $('[data-ed="delsel"]');
          if (d) { d.disabled = !n; d.dataset.s = ''; d.textContent = n ? 'حذف المحدد (' + n + ')' : 'حذف المحدد'; } return;
        }
        if (a === 'delsel') {
          const ids = [...X.root.querySelectorAll('#v-edge .ed-ck:checked')].map(c => +c.value); if (!ids.length) return;
          if (b.dataset.s !== '1') { b.dataset.s = '1'; b.textContent = 'تأكيد حذف ' + ids.length + '؟'; return; }
          const r = await X.api('POST', '/edge/delete', { ids }); X.toast('حُذف ' + r.n + ' تحليل'); return home();
        }
        if (a === 'src') { X.root.querySelectorAll('.ed-src button').forEach(x => x.classList.toggle('on', x === b)); X.root.querySelectorAll('#ed-form [data-pane]').forEach(x => x.hidden = x.dataset.pane !== b.dataset.m); drawUp(); }
        else if (a === 'clrimg') { up = []; if (isSaved() && seed) { seed = Object.assign({}, seed, { images: [] }); } drawUp(); }
        else if (a === 'open') { X.url('/compete/' + b.dataset.id); await result(b.dataset.id); }
        else if (a === 'home') { X.url('/compete'); await home(); }
        else if (a === 'go') { const t = $('#ed-i' + b.dataset.i); if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'start' }); t.classList.add('hl'); } }
        else if (a === 'flt') { X.root.querySelectorAll('.ed-flt button').forEach(x => x.classList.toggle('on', x === b)); X.root.querySelectorAll('.ed-i').forEach(x => x.hidden = !!b.dataset.t && x.dataset.type !== b.dataset.t); }
        else if (a === 'cp') { await navigator.clipboard.writeText(b.dataset.t); X.toast('نُسخ النص'); }
        else if (a === 'copy' && CUR) { await navigator.clipboard.writeText(asText(CUR)); X.toast('نُسخت كل الأفكار'); }
        else if (a === 'del' && CUR) { if (b.dataset.s !== '1') { b.dataset.s = '1'; b.textContent = 'تأكيد الحذف؟'; return; } await X.api('DELETE', '/edge/' + CUR.id); X.url('/compete'); await home(); }
        else if ((a === 'more' && CUR) || a === 'retry') {
          b.disabled = true; let base;
          if (a === 'more') { const i = CUR.input || {}; base = { id: CUR.id, k: CUR.k, p: { name: i.name, desc: i.desc, price: i.price, cost: i.cost, notes: i.notes, market: i.market, link: i.link, n: i.sellers, copies: i.copies, days: i.days, images: i.images || [], texts: [] } };
            if (CUR.k && W.__svLoad && !(W.__sv && W.__sv(CUR.k))) await W.__svLoad().catch(() => {});
            const sv = CUR.k && W.WPRTOOLS && W.WPRTOOLS.productOf(CUR.k, true); if (sv) base.p.texts = sv.texts; }
          else { let l = null; try { l = JSON.parse(sessionStorage.getItem('wpr_edge_last')); } catch (x) {} if (!l) { X.url('/compete'); return home(); } base = { id: 0, k: l.k, p: l.p }; }
          const j = await X.api('POST', '/edge', Object.assign(a === 'more' ? { more: base.id, k: base.k, p: base.p } : { k: base.k, p: base.p }, { lang: W.__LANG || 'ar' }));
          X.url('/compete/' + j.id); await result(j.id);
        }
      } catch (x) { b.disabled = false; if (x.message !== 'auth') X.toast(x.message, 'err'); }
    });
    X.root.addEventListener('change', async ev => {
      if (ev.target.id === 'ed-sv') pickSaved(ev.target.value);
      if (ev.target.id === 'ed-file') {
        const fs = [...ev.target.files].slice(0, 2 - up.length - (isSaved() && seed ? Math.min(2, seed.images.length) : 0));
        for (const f of fs) { try { up.push(await shrink(f)); } catch (x) { X.toast(x.message, 'err'); } }
        ev.target.value = ''; drawUp();
      }
    });
    X.root.addEventListener('submit', async ev => {
      if (ev.target.id !== 'ed-form') return; ev.preventDefault();
      const btn = ev.target.querySelector('button[type=submit]'); btn.disabled = true;
      try { await submit(false); } catch (x) { if (x.message !== 'auth') X.toast(x.message, 'err'); } finally { btn.disabled = false; }
    });
  }

  W.WPREDGE = {
    init(ctx) { X = ctx; if (!inited) { inited = true; bind(); } },
    // من بطاقة منتج (التحليل أو المحفوظات): يملأ النموذج بالمنتج
    from(p) { seed = p; up = []; X.url('/compete'); X.show('edge'); },
    render(sub) { if (sub && /^\d+$/.test(sub)) return result(sub); return home(); }
  };
})();
