/* أدوات المنتج في كل بطاقة (التحليل والمحفوظات): 🏭 إيجاد المورّد · 🧠 تحليل الإعلان بالذكاء الاصطناعي · 👁 راقب الصفحة · 📤 Google Sheets.
   يعمل مع app.html عبر WPRTOOLS.init(ctx). مهام الإضافة تمر عبر WPRJOB (collect.js). */
(function () {
  'use strict';
  const W = window; let X = null;
  const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => Number(n || 0).toLocaleString((window.__LOC||'ar-DZ'));
  const img = u => (u ? '/api/img?u=' + encodeURIComponent(u) : '');
  const MK = () => W.RadarMarkets, G = () => W.RadarGapMatch;

  const st = document.createElement('style');
  st.textContent = `
.tm-bg{position:fixed;inset:0;background:rgba(18,25,22,.55);z-index:120;display:flex;align-items:flex-start;justify-content:center;padding:4vh 12px;overflow:auto;animation:in .15s ease}
.tm{background:var(--card);border:1px solid var(--line);border-radius:18px;width:min(980px,100%);box-shadow:0 20px 60px rgba(0,0,0,.25);padding:18px 20px 22px}
.tm-h{display:flex;gap:10px;align-items:center;margin-bottom:10px}.tm-h h2{flex:1;margin:0;font-size:18px}.tm-x{background:none;border:0;font-size:22px;cursor:pointer;color:var(--mut)}
.sp-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-top:12px}.sp{border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--card2);display:flex;flex-direction:column}
.sp img{width:100%;aspect-ratio:1;object-fit:cover;background:var(--card)}.sp .b{padding:8px 10px;display:flex;flex-direction:column;gap:4px;font-size:13px}.sp .t{max-height:3em;overflow:hidden}.sp .pr{font-weight:700;font-size:15px}
.sp.match{border-color:var(--ok);box-shadow:0 0 0 2px rgba(22,163,74,.25)}
.ai-s h4{margin:14px 0 4px}.ai-s ul{margin:4px 0;padding-inline-start:20px}.ai-copy{white-space:pre-wrap;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:10px 12px;font-size:14px}`;
  document.head.appendChild(st);

  /* ---------- نافذة ---------- */
  let modal = null;
  function open(title, html) {
    close();
    modal = document.createElement('div'); modal.className = 'tm-bg';
    modal.innerHTML = `<div class="tm" role="dialog" aria-label="${e(title)}"><div class="tm-h"><h2>${e(title)}</h2><button class="tm-x" data-tm="x" aria-label="إغلاق">×</button></div><div class="tm-b">${html}</div></div>`;
    modal.addEventListener('click', ev => { if (ev.target === modal || ev.target.closest('[data-tm="x"]')) close(); });
    document.body.appendChild(modal); return modal.querySelector('.tm-b');
  }
  function close() { if (modal) { modal.remove(); modal = null; } }
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') close(); });
  const body = () => modal && modal.querySelector('.tm-b');

  /* ---------- بيانات المنتج من بطاقة التحليل أو المحفوظات ---------- */
  function productOf(k, saved) {
    let p = saved ? (W.__sv && W.__sv(k)) : (W.WPR && W.WPR.byKey(k));
    if (!p) return null;
    if (saved && W.WPR) p = W.WPR.hydrate(p);
    const imgs = (W.WPR && W.WPR.imgsOf ? W.WPR.imgsOf(p) : p.images) || [];
    const ads = (p.recs || []).map(r => r.a || {}).concat(p.top ? [p.top] : []);
    const texts = [...new Set(ads.map(a => [a.title, a.body].filter(Boolean).join(' — ')).filter(Boolean))].slice(0, 5);
    const links = [...new Set(ads.map(a => a.link_url).filter(Boolean))];
    const m = MK(), sym = m && p.cur ? m.curSymbol(p.cur) : 'دج';
    return { k, saved, name: p.name || '', kw: p.kw || '', images: imgs.slice(0, 6), texts, links, market: p.market || '', cat: p.cat || p.tier || '', score: p.score || 0, days: p.days || 0, n: p.n || 0, copies: p.copies || 0,
      price: p.pr ? p.pr + ' ' + sym : '', tags: p.tags || (p.hits || []).map(h => h.label) };
  }

  /* ================= 🏭 إيجاد المورّد (الأسواق الصينية + صورة المنتج) ================= */
  const MKS = {
    ali: { n: 'AliExpress', url: q => 'https://www.aliexpress.com/wholesale?SearchText=' + encodeURIComponent(q) + '&SortType=total_tranpro_desc', zh: false, note: 'تجزئة، شحن للجزائر' },
    alibaba: { n: 'Alibaba', url: q => 'https://www.alibaba.com/trade/search?SearchText=' + encodeURIComponent(q), zh: false, note: 'جملة، حد أدنى للكمية' },
    '1688': { n: '1688', url: q => 'https://s.1688.com/selloffer/offer_search.htm?keywords=' + encodeURIComponent(q) + '&charset=utf8', zh: true, note: 'أرخص سعر صيني (جملة محلية)' },
    taobao: { n: 'Taobao', url: q => 'https://s.taobao.com/search?q=' + encodeURIComponent(q), zh: true, note: 'يتطلب تسجيل الدخول' },
    pdd: { n: 'Pinduoduo', url: q => 'https://mobile.yangkeduo.com/search_result.html?search_key=' + encodeURIComponent(q), zh: true, note: 'يتطلب تسجيل الدخول برقم الهاتف' }
  };
  const SK = 'wpr_sup_mk_v1', selMk = () => { try { return JSON.parse(localStorage.getItem(SK)) || ['ali', '1688', 'alibaba']; } catch (x) { return ['ali', '1688', 'alibaba']; } };
  const parsePrice = (t, cur) => {
    const s = String(t || ''), m = /(\d[\d.,\s]*)/.exec(s); if (!m) return null;
    let x = m[1].replace(/\s/g, ''); if (/,\d{1,2}$/.test(x)) x = x.replace(/\./g, '').replace(',', '.'); else x = x.replace(/,/g, '');
    const v = parseFloat(x); if (!v) return null;
    const c = /¥|￥|元/.test(s) ? 'CNY' : /US\s?\$|\$/.test(s) ? 'USD' : (cur || 'USD');
    const r = MK() ? MK().RATES_DZD[c] : 0;
    return { v, c, dzd: r ? Math.round(v * r) : 0 };
  };
  async function supRank(k, items, p) {
    if (!G() || !p || !p.images.length) return items;
    const ph = []; for (const u of p.images.slice(0, 4)) { const h = await G().hashImage(img(u)); if (h) ph.push(...h); }
    if (!ph.length) return items;
    let i = 0; const todo = items.filter(x => x.img && x.sim == null);
    if (!todo.length) return items;
    W.__busy && W.__busy('sup', 'جارٍ مقارنة صور الموردين بصورة المنتج…');
    try { await Promise.all([1, 2, 3, 4].map(async () => { while (i < todo.length) { const x = todo[i++]; const h = await G().hashImage(img(x.img)); x.sim = h ? Math.round((1 - G().bestImage(h, ph) / 64) * 100) : 0; } })); }
    finally { W.__busy && W.__busy('sup'); }
    await X.api('POST', '/sup/rank', { k, ranked: items.filter(x => x.sim != null).map(x => ({ id: x.id, market: x.market || 'ali', sim: x.sim })) }).catch(() => {});
    return items;
  }
  let SUPF = '';
  function supCards(items) {
    const q = items.filter(x => !SUPF || (x.market || 'ali') === SUPF).map(x => Object.assign({}, x, { pp: parsePrice(x.price, x.currency) }));
    q.sort((a, b) => ((b.sim || 0) >= 84) - ((a.sim || 0) >= 84) || (b.sim || 0) - (a.sim || 0) || ((a.pp && a.pp.dzd) || 9e9) - ((b.pp && b.pp.dzd) || 9e9));
    const matches = items.map(x => Object.assign({}, x, { pp: parsePrice(x.price, x.currency) })).filter(x => (x.sim || 0) >= 84 && x.pp).sort((a, b) => a.pp.dzd - b.pp.dzd);
    const by = {}; items.forEach(x => { const m = x.market || 'ali'; by[m] = (by[m] || 0) + 1; });
    const best = matches[0];
    return `${best ? `<div class="alert info">✅ أرخص مورّد مطابق بالصورة: <b>${e(MKS[best.market || 'ali'].n)}</b> · <b>${e(best.price)}</b>${best.pp.dzd ? ' ≈ ' + num(best.pp.dzd) + ' دج' : ''}${best.moq ? ' · أقل كمية ' + e(best.moq) : ''} · <a href="${e(best.url)}" target="_blank" rel="noopener">افتحه ↗</a>${matches.length > 1 ? `<br><small>${num(matches.length)} موردين مطابقين: ${matches.slice(0, 5).map(x => e(MKS[x.market || 'ali'].n) + ' ' + num(x.pp.dzd) + ' دج').join(' · ')}</small>` : ''}</div>`
      : items.length ? '<div class="alert">لم نجد صورة مطابقة تماماً. النتائج مرتبة بالتشابه ثم بالسعر، فتحقق بنفسك.</div>' : ''}
${Object.keys(by).length > 1 ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0"><button class="btn sm ${SUPF ? 'ghost' : ''}" data-tm="supf" data-m="">الكل (${num(items.length)})</button>${Object.keys(by).map(m => `<button class="btn sm ${SUPF === m ? '' : 'ghost'}" data-tm="supf" data-m="${m}">${e(MKS[m].n)} (${num(by[m])})</button>`).join('')}</div>` : ''}
<div class="sp-g">${q.slice(0, 60).map(x => `<a class="sp${(x.sim || 0) >= 84 ? ' match' : ''}" href="${e(x.url)}" target="_blank" rel="noopener"><img loading="lazy" src="${e(img(x.img))}" alt=""><div class="b">
<span class="pr">${e(x.price || '—')}${x.pp && x.pp.dzd && x.pp.c !== 'DZD' ? ` <small>≈ ${num(x.pp.dzd)} دج</small>` : ''}</span><span class="t" dir="auto">${e(x.title)}</span>
<small><b>${e(MKS[x.market || 'ali'].n)}</b>${x.sim != null ? ' · ' + (x.sim >= 84 ? '🟢 مطابق بالصورة ' : 'تشابه ') + x.sim + '%' : ''}${x.sold ? ' · ' + e(x.sold) : ''}${x.moq ? ' · أقل كمية ' + e(x.moq) : ''}${x.rating ? ' · ⭐ ' + e(x.rating) : ''}</small></div></a>`).join('')}</div>`;
  }
  async function openSupplier(k, saved) {
    const p = productOf(k, saved); if (!p) return X.toast('المنتج غير موجود', 'err');
    open('🏭 المورّد: ' + p.name, '<p class="sub">جارٍ التحميل…</p>');
    const prev = await X.api('GET', '/sup?k=' + encodeURIComponent(k));
    let Q = { q: prev.q || '', zh: '', features: [], vision: false };
    try { const x = JSON.parse(localStorage.getItem('wpr_supq_' + k) || 'null'); if (x) Q = Object.assign(Q, x); } catch (x) {}
    if (!Q.q) { const el = body(); if (el) el.innerHTML = '<p class="sub">🔍 جارٍ التعرّف على المنتج من صورته ونص إعلانه…</p>'; try { Q = Object.assign(Q, await X.api('POST', '/sup/query', { name: p.name, kw: p.kw, texts: p.texts, images: p.images })); localStorage.setItem('wpr_supq_' + k, JSON.stringify(Q)); } catch (x) {} }
    const im = p.images[0], sel = selMk();
    const draw = items => { const el = body(); if (!el) return; el.innerHTML = `<div style="display:grid;grid-template-columns:120px 1fr;gap:14px;align-items:start">${im ? `<img src="${e(img(im))}" alt="" style="width:120px;height:120px;object-fit:cover;border-radius:12px;border:1px solid var(--line)">` : '<div></div>'}<div>
<p class="sub" style="margin-top:0">${Q.vision ? '🧠 تعرّف الذكاء الاصطناعي على المنتج من <b>صورته</b>' + (Q.product ? ': <b>' + e(Q.product) + '</b>' : '') + '.' : 'عبارة البحث من اسم المنتج. أضف OPENAI_API_KEY من «الربط والتكامل» ليتعرّف على المنتج من صورته.'}${(Q.features || []).length ? ' علاماته: ' + Q.features.map(e).join('، ') : ''}</p>
<div class="grid2" style="gap:8px;margin:0"><label class="fl">بالإنجليزية (AliExpress، Alibaba)<input id="sup-q" dir="ltr" value="${e(Q.q || '')}" placeholder="e.g. star projector night light"></label><label class="fl">بالصينية (1688، Taobao، Pinduoduo)<input id="sup-zh" dir="auto" value="${e(Q.zh || '')}" placeholder="مثل: 星空投影小夜灯"></label></div>
<div style="display:flex;gap:10px;flex-wrap:wrap;margin:8px 0">${Object.keys(MKS).map(m => `<label class="fl chk" style="margin:0" title="${e(MKS[m].note)}"><input type="checkbox" data-sm="${m}"${sel.includes(m) ? ' checked' : ''}> ${e(MKS[m].n)} <small>(${e(MKS[m].note)})</small></label>`).join('')}</div>
<p style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 0"><button class="btn" data-tm="sup-go">🔎 ابحث في الأسواق المختارة</button>${im ? `<a class="btn ghost sm" target="_blank" rel="noopener" href="https://lens.google.com/uploadbyurl?url=${encodeURIComponent(im)}">🖼️ بالصورة: Google Lens ↗</a><a class="btn ghost sm" target="_blank" rel="noopener" href="https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(im)}">🖼️ Yandex ↗</a>` : ''}</p>
<p class="sub" style="margin:4px 0 0">تفتح الإضافة كل سوق في تبويب، تقرأ النتائج وتعود، ثم تقارن المنصة صورة كل نتيجة بصورة منتجك وتحوّل السعر (يوان/دولار) إلى الدينار. Taobao وPinduoduo يحتاجان أن تكون مسجّلاً فيهما على Chrome.</p></div></div>
${items.length ? supCards(items) : '<p class="sub" style="margin-top:12px">لا نتائج بعد.</p>'}${prev.updated_at ? `<p class="sub" style="margin-top:8px">آخر بحث: ${X.fd(prev.updated_at)} · ${num(items.length)} نتيجة</p>` : ''}`; };
    let ITEMS = prev.items || [];
    draw(ITEMS);
    if (ITEMS.some(x => x.sim == null)) supRank(k, ITEMS, p).then(draw).catch(() => {});
    body().onclick = async ev => {
      const f = ev.target.closest('[data-tm="supf"]'); if (f) { SUPF = f.dataset.m; return draw(ITEMS); }
      if (!ev.target.closest('[data-tm="sup-go"]')) return;
      const el = body(), q = el.querySelector('#sup-q').value.trim(), zh = el.querySelector('#sup-zh').value.trim();
      const mk = [...el.querySelectorAll('[data-sm]:checked')].map(c => c.dataset.sm); localStorage.setItem(SK, JSON.stringify(mk));
      Q.q = q; Q.zh = zh; localStorage.setItem('wpr_supq_' + k, JSON.stringify(Q));
      const jobs = mk.map(m => ({ m, q: MKS[m].zh ? zh || q : q })).filter(j => j.q).map(j => ({ q: j.q, url: MKS[j.m].url(j.q) }));
      if (!jobs.length) return X.toast('اكتب عبارة البحث واختر سوقاً واحداً على الأقل', 'err');
      try { await W.WPRJOB.start('sup', jobs, { k, saved, q }, { maxAds: 60 }, '🏭 مورّد: ' + p.name); X.toast('تفتح الإضافة ' + num(jobs.length) + ' أسواق تباعاً. اتركها تعمل حتى تعود النتائج.'); }
      catch (x) { X.toast(x.message, 'err'); }
    };
  }
  const SUP = {
    async ads(ev, ctx) { await X.api('POST', '/sup/ingest', { k: ctx.k, q: ctx.q, items: ev.ads, reset: !ctx._got }); ctx._got = true; },
    async done(ev, ctx) {
      const r = await X.api('GET', '/sup?k=' + encodeURIComponent(ctx.k)), p = productOf(ctx.k, ctx.saved);
      await supRank(ctx.k, r.items || [], p);
      X.toast(r.items && r.items.length ? 'وُجدت ' + num(r.items.length) + ' نتيجة في الأسواق الصينية' : 'لم تُقرأ نتائج. جرّب عبارة أخرى أو تأكد أنك ترى نتائج في التبويب (وأنك مسجّل في Taobao/Pinduoduo).', r.items && r.items.length ? '' : 'err');
      if (p) openSupplier(ctx.k, ctx.saved);
    }
  };

  /* ================= 🧠 تحليل الإعلان ================= */
  const li = a => (Array.isArray(a) && a.length ? '<ul>' + a.map(x => `<li>${e(x)}</li>`).join('') + '</ul>' : '<p class="sub">—</p>');
  // سوق التحليل (سوق المشترك المستهدف) واسم اللغة لكل نص إعلان
  const mkName = c => { const M = W.RadarMarkets; c = c || 'DZ'; return M && M.COUNTRIES[c] ? M.COUNTRIES[c].name : c; };
  const mkFlag = c => /^[A-Z]{2}$/.test(c || 'DZ') ? String.fromCodePoint(...[...(c || 'DZ')].map(x => 127397 + x.charCodeAt())) : '';
  const langName = k => { const M = W.RadarMarkets; return M && M.LANGS[k] ? M.LANGS[k].name : ({ ar: 'بالعربية', dz: 'بالدارجة', fr: 'بالفرنسية' })[k] || k; };
  function aiHtml(d) {
    if (!d) return '';
    const c = d.ad_copy || {};
    return `<div class="ai-s"><div class="alert info">${e(d.summary || '')}</div>
<h4>🎯 المنتج وزاوية البيع</h4><p>${e(d.product || '')}</p><p><b>الزاوية:</b> ${e(d.angle || '')}</p>
<h4>👥 الجمهور المستهدف</h4><p>${e(d.audience || '')}</p>
<h4>😣 المشكلة التي يحلها</h4>${li(d.pains)}<h4>💪 نقاط القوة</h4>${li(d.strengths)}<h4>⚠️ نقاط الضعف والمخاطر</h4>${li(d.weaknesses)}
<h4>🎬 افتتاحيات فيديو (أول 3 ثوانٍ)</h4>${li(d.hooks)}
<h4>🎁 عرض مقترح لـ ${e(mkName(d.market))}</h4><p>${e(d.offer || '')}</p>${d.price_hint ? `<p class="sub">${e(d.price_hint)}</p>` : ''}
<h4>${mkFlag(d.market)} ملاءمته لسوق ${e(mkName(d.market))}</h4><p>${e(d.algeria_fit || '')}</p>
<h4>✍️ نصوص إعلان مقترحة</h4>${Object.keys(c).filter(k => c[k]).map(k => [k, langName(k)]).map(([k, l]) => `<div style="margin:8px 0"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><b>${l}</b><button class="btn ghost sm" data-tm="copy" data-t="${e(c[k])}">نسخ</button></div><div class="ai-copy" dir="auto">${e(c[k])}</div></div>`).join('')}</div>`;
  }
  async function openAI(k, saved) {
    const p = productOf(k, saved); if (!p) return X.toast('المنتج غير موجود', 'err');
    const b = open('🧠 تحليل الإعلان: ' + p.name, '<p class="sub">جارٍ التحميل…</p>');
    const r = await X.api('GET', '/ai/ad?k=' + encodeURIComponent(k));
    const draw = (d, at) => { const el = body(); if (!el) return; el.innerHTML = (d ? aiHtml(d) + `<p class="sub" style="margin-top:12px">حُلّل ${X.ago(at)}.</p>` : '<p class="sub">يحلّل الذكاء الاصطناعي نص الإعلان: لماذا يبيع، ولمن، وكيف تبيعه في سوقك، مع نصوص إعلان جاهزة بلغاته. لا يخترع مواصفات غير مذكورة.</p>')
      + `<p><button class="btn" data-tm="ai-go">${d ? '🔄 أعد التحليل' : '🧠 حلّل الآن'}</button></p>`; };
    if (r.ai === false && !r.data) { b.innerHTML = '<div class="alert">الذكاء الاصطناعي غير مفعّل. أضف <code>OPENAI_API_KEY</code> في إعدادات الخادم (cPanel ← Setup Node.js App ← Environment variables) ثم أعد التشغيل.</div>'; return; }
    draw(r.data, r.created_at);
    b.addEventListener('click', async ev => {
      const cp = ev.target.closest('[data-tm="copy"]'); if (cp) { try { await navigator.clipboard.writeText(cp.dataset.t); X.toast('نُسخ النص'); } catch (x) {} return; }
      const go = ev.target.closest('[data-tm="ai-go"]'); if (!go) return;
      go.disabled = true; go.textContent = '⏳ يحلّل… (حتى 30 ثانية)'; W.__busy && W.__busy('ai', 'الذكاء الاصطناعي يحلّل الإعلان…');
      try { const x = await X.api('POST', '/ai/ad', { k, p }); draw(x.data, x.created_at); } catch (x) { X.toast(x.message, 'err'); go.disabled = false; go.textContent = '🧠 حلّل الآن'; }
      finally { W.__busy && W.__busy('ai'); }
    });
  }

  /* ================= 📤 Google Sheets ================= */
  const SCRIPT = `// رادار المنتجات → Google Sheets
// الصق هذا في: الجدول ← Extensions ← Apps Script، ثم Deploy ← New deployment ← Web app (Execute as: Me · Who has access: Anyone)
const TOKEN = 'ضع-رمزاً-سرياً-هنا';
function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  if (TOKEN && d.token !== TOKEN) return out({ ok: false, error: 'رمز خاطئ' });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(d.sheet) || ss.insertSheet(d.sheet);
  if (sh.getLastRow() === 0 && d.header && d.header.length) sh.appendRow(d.header);
  if (d.rows.length) sh.getRange(sh.getLastRow() + 1, 1, d.rows.length, d.rows[0].length).setValues(d.rows);
  return out({ ok: true, count: d.rows.length, url: ss.getUrl() + '#gid=' + sh.getSheetId() });
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }`;
  W.__sheetScript = SCRIPT;
  async function pushSheet(src) {
    let header, rows, sheet;
    if (src === 'results') { const r = W.WPR && W.WPR.sheetRows ? W.WPR.sheetRows() : []; if (r.length < 2) return X.toast('لا نتائج معروضة', 'err'); header = r[0]; rows = r.slice(1); sheet = 'نتائج التحليل'; }
    else {
      const L = W.__svList ? W.__svList() : []; if (!L.length) return X.toast('لا منتجات محفوظة', 'err'); const m = MK();
      header = ['المنتج', 'السوق', 'الكلمة الدلالية', 'التصنيف', 'الدرجة', 'البائعون', 'السعر', 'العملة', 'بالدينار تقريباً', 'ملاحظة', 'رابط الإعلان', 'المتجر', 'تاريخ الحفظ'];
      rows = L.map(p => [p.name, p.market && m && m.COUNTRIES[p.market] ? m.COUNTRIES[p.market].name : (p.market || ''), p.kw || '', p.cat || p.tier || '', p.score || 0, p.n || 0, p.pr || p.price || '', p.cur || '', p.prDzd || '', p.note || '', p.lib || (p.top && p.top.library_url) || '', p.link || (p.top && p.top.link_url) || '', new Date(p.saved_at || p.date || Date.now()).toISOString().slice(0, 10)]);
      sheet = 'المنتجات المحفوظة';
    }
    W.__busy && W.__busy('gs', 'جارٍ الإرسال إلى Google Sheets…');
    try { const r = await X.api('POST', '/sheets/push', { sheet, header, rows }); X.toast('أُرسل ' + num(r.count) + ' صفاً إلى Google Sheets'); if (r.url) W.open(r.url, '_blank', 'noopener'); }
    catch (x) { if (/اربط/.test(x.message)) { X.toast(x.message, 'err'); X.show && X.show('settings'); } else X.toast(x.message, 'err'); }
    finally { W.__busy && W.__busy('gs'); }
  }

  /* ================= 👁 راقب الصفحة ================= */
  async function watchPage(pid, name) {
    const r = await X.api('POST', '/watch', { page_id: pid, name });
    X.toast(r.existed ? 'هذه الصفحة في «مراقبة المنافسين» من قبل' : 'أُضيفت إلى «مراقبة المنافسين». افحصها من هناك.');
  }

  /* ================= 🛡️ المستبعد ================= */
  const KL = () => (W.RadarProductCheck && W.RadarProductCheck.LABEL) || {};
  async function openExcluded(kind) {
    const b = open('🛡️ المستبعد: ما رفضه فحص صلاحية المنتج', '<p class="sub">جارٍ التحميل…</p>');
    const r = await X.api('GET', '/lib/excluded?limit=300' + (kind ? '&kind=' + encodeURIComponent(kind) : ''));
    const el = body(); if (!el) return;
    el.innerHTML = `<p class="sub">هذه إعلانات لم تدخل «الواردة» لأن الفحص رآها ليست منتجاً مادياً صالحاً (خدمة، دورة، محل، أكل، كبير الحجم…). إن أخطأ الفحص: حدّدها واضغط «استرجاع» فتصل إلى «الواردة» في دفعة جديدة. تُحذف تلقائياً بعد مدة الاحتفاظ.</p>
<div class="g-kp" style="display:flex;flex-wrap:wrap;gap:8px;margin:10px 0"><button class="btn sm ${kind ? 'ghost' : ''}" data-ex="kind" data-k="">الكل (${num(r.total)})</button>${r.by.map(x => `<button class="btn sm ${kind === x.kind ? '' : 'ghost'}" data-ex="kind" data-k="${e(x.kind)}">${e(KL()[x.kind] || x.kind)} (${num(x.n)})</button>`).join('')}</div>
${r.list.length ? `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px"><label class="fl chk" style="margin:0"><input type="checkbox" data-ex="all"> تحديد الكل</label>
<label class="fl chk" style="margin:0"><input type="checkbox" id="ex-allow"> لا تستبعد إعلانات هذه الصفحات مستقبلاً</label><button class="btn sm" data-ex="restore">↩️ استرجاع المحدد</button><button class="btn danger sm" data-ex="clear">مسح القائمة</button></div>
<div>${r.list.map(x => `<div class="g-m"><label style="display:block;position:relative"><img loading="lazy" src="${e(img(x.image_url))}" alt=""><input type="checkbox" data-exid="${e(x.ad_id)}" data-pid="${e(x.page_id || '')}" style="position:absolute;top:6px;inset-inline-start:6px;width:20px;height:20px"></label><div>
<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><span class="pill warn">${e(KL()[x.kind] || x.kind)}</span><b>${e(x.page_name || '')}</b><small>${X.ago(x.at)}${x.label ? ' · ' + e(x.label) : ''}</small></div>
<div class="g-ev">${e(x.why)}</div><div class="tx muted" dir="auto" style="font-size:13.5px;max-height:4.6em;overflow:hidden">${e((x.title ? x.title + ' — ' : '') + (x.body || ''))}</div>
${x.library_url ? `<a class="btn ghost sm" style="margin-top:6px" href="${e(x.library_url)}" target="_blank" rel="noopener">الإعلان ↗</a>` : ''}</div></div>`).join('')}</div>` : '<p class="sub">لا شيء مستبعد.</p>'}
${r.allow.length ? `<p class="sub" style="margin-top:12px">صفحات مسموح بها دائماً: ${num(r.allow.length)} <button class="btn ghost sm" data-ex="unallow">إلغاء السماح لكل الصفحات</button></p>` : ''}`;
    el.onclick = async ev => {
      const t = ev.target.closest('[data-ex]'); if (!t) return;
      const a = t.dataset.ex;
      if (a === 'kind') return openExcluded(t.dataset.k);
      if (a === 'all') { el.querySelectorAll('[data-exid]').forEach(c => { c.checked = t.checked; }); return; }
      if (a === 'restore') {
        const sel = [...el.querySelectorAll('[data-exid]:checked')]; if (!sel.length) return X.toast('حدّد إعلاناً واحداً على الأقل', 'err');
        const allow = el.querySelector('#ex-allow').checked ? [...new Set(sel.map(c => c.dataset.pid).filter(Boolean))] : [];
        const x = await X.api('POST', '/lib/excluded/restore', { ids: sel.map(c => c.dataset.exid), allowPages: allow });
        X.toast('استُرجع ' + num(x.restored) + ' إعلاناً إلى «الواردة»' + (allow.length ? ' ولن تُستبعد صفحاتها مستقبلاً' : '')); X.refresh && X.refresh(); return openExcluded(kind);
      }
      if (a === 'clear') { if (t.dataset.s !== '1') { t.dataset.s = '1'; t.textContent = 'تأكيد المسح؟'; return; } await X.api('DELETE', '/lib/excluded'); return openExcluded(''); }
      if (a === 'unallow') { await X.api('DELETE', '/lib/allow-pages'); return openExcluded(kind); }
    };
  }

  W.WPRTOOLS = {
    open, close, productOf, parsePrice, script: SCRIPT,
    init(ctx) {
      X = ctx;
      W.WPRJOB && W.WPRJOB.register('sup', SUP);
      X.root.addEventListener('click', ev => {
        const b = ev.target.closest('[data-tool]'); if (!b) return;
        ev.preventDefault();
        const t = b.dataset.tool, run = f => { const pr = Promise.resolve().then(f); W.__btnBusy && W.__btnBusy(ev, pr); pr.catch(x => { if (x && x.message !== 'auth') X.toast(x.message || 'حدث خطأ', 'err'); }); };
        if (t === 'sup') run(() => openSupplier(b.dataset.k, b.dataset.sv === '1'));
        if (t === 'ai') run(() => openAI(b.dataset.k, b.dataset.sv === '1'));
        if (t === 'edge') run(() => { const p = productOf(b.dataset.k, b.dataset.sv === '1'); if (!p) throw new Error('المنتج غير موجود'); if (!W.WPREDGE) throw new Error('تعذّر تحميل القسم'); W.WPREDGE.from(p); });
        if (t === 'profit') run(() => W.WPRPROFIT && W.WPRPROFIT.open(b.dataset.k, b.dataset.sv === '1'));
        if (t === 'watch') run(() => watchPage(b.dataset.pid, b.dataset.name));
        if (t === 'sheet') run(() => pushSheet(b.dataset.src));
        if (t === 'excl') run(() => openExcluded(''));
      });
    }
  };
})();
