/* أدوات المنتج في كل بطاقة (التحليل والمحفوظات): 🏭 إيجاد المورّد · 🧠 تحليل الإعلان بالذكاء الاصطناعي · 👁 راقب الصفحة · 📤 Google Sheets.
   يعمل مع app.html عبر WPRTOOLS.init(ctx). مهام الإضافة تمر عبر WPRJOB (collect.js). */
(function () {
  'use strict';
  const W = window; let X = null;
  const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => Number(n || 0).toLocaleString('ar-DZ');
  const img = u => (u ? '/api/img?u=' + encodeURIComponent(u) : '');
  const MK = () => W.RadarMarkets, G = () => W.RadarGapMatch;

  const st = document.createElement('style');
  st.textContent = `
.tm-bg{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:120;display:flex;align-items:flex-start;justify-content:center;padding:4vh 12px;overflow:auto;animation:in .15s ease}
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

  /* ================= 🏭 إيجاد المورّد ================= */
  const aliUrl = q => 'https://www.aliexpress.com/wholesale?SearchText=' + encodeURIComponent(q) + '&SortType=total_tranpro_desc';
  const parsePrice = (t, cur) => {
    const m = /(\d[\d.,\s]*)/.exec(String(t || '')); if (!m) return null;
    let x = m[1].replace(/\s/g, ''); if (/,\d{1,2}$/.test(x)) x = x.replace(/\./g, '').replace(',', '.'); else x = x.replace(/,/g, '');
    const v = parseFloat(x); if (!v) return null;
    const c = cur || (MK() ? MK().currencyOf(String(t), '') : '') || 'USD';
    const r = MK() ? MK().RATES_DZD[c] : 0;
    return { v, c, dzd: r ? Math.round(v * r) : 0 };
  };
  async function supRank(k, items, p) {
    if (!G() || !p || !p.images.length) return items;
    const ph = []; for (const u of p.images.slice(0, 4)) { const h = await G().hashImage(img(u)); if (h) ph.push(...h); }
    if (!ph.length) return items;
    let i = 0; const todo = items.filter(x => x.img && x.sim == null);
    W.__busy && W.__busy('sup', 'جارٍ مقارنة صور الموردين بصورة المنتج…');
    try {
      await Promise.all([1, 2, 3, 4].map(async () => { while (i < todo.length) { const x = todo[i++]; const h = await G().hashImage(img(x.img)); x.sim = h ? Math.round((1 - G().bestImage(h, ph) / 64) * 100) : 0; } }));
    } finally { W.__busy && W.__busy('sup'); }
    await X.api('POST', '/sup/rank', { k, ranked: items.filter(x => x.sim != null).map(x => ({ id: x.id, sim: x.sim })) }).catch(() => {});
    return items;
  }
  function supCards(items) {
    const q = items.map(x => Object.assign({}, x, { pp: parsePrice(x.price, x.currency) }));
    q.sort((a, b) => ((b.sim || 0) >= 84) - ((a.sim || 0) >= 84) || (b.sim || 0) - (a.sim || 0) || ((a.pp && a.pp.dzd) || 9e9) - ((b.pp && b.pp.dzd) || 9e9));
    const matches = q.filter(x => (x.sim || 0) >= 84), best = matches.filter(x => x.pp).sort((a, b) => a.pp.dzd - b.pp.dzd)[0];
    return `${best ? `<div class="alert info">✅ أرخص مورّد مطابق بالصورة: <b>${e(best.price)}</b>${best.pp.dzd ? ' ≈ ' + num(best.pp.dzd) + ' دج' : ''} · ${e(best.sold || '')} · <a href="${e(best.url)}" target="_blank" rel="noopener">افتحه ↗</a></div>` : q.length ? '<div class="alert">لم نجد صورة مطابقة تماماً. النتائج مرتبة بالتشابه ثم بالسعر، فتحقق بنفسك.</div>' : ''}
<div class="sp-g">${q.slice(0, 40).map(x => `<a class="sp${(x.sim || 0) >= 84 ? ' match' : ''}" href="${e(x.url)}" target="_blank" rel="noopener"><img loading="lazy" src="${e(img(x.img))}" alt=""><div class="b">
<span class="pr">${e(x.price || '—')}${x.pp && x.pp.dzd && x.pp.c !== 'DZD' ? ` <small>≈ ${num(x.pp.dzd)} دج</small>` : ''}</span><span class="t" dir="auto">${e(x.title)}</span>
<small>${x.sim != null ? (x.sim >= 84 ? '🟢 مطابق بالصورة ' : 'تشابه الصورة ') + x.sim + '%' : ''}${x.sold ? ' · ' + e(x.sold) : ''}${x.rating ? ' · ⭐ ' + e(x.rating) : ''}</small></div></a>`).join('')}</div>`;
  }
  async function openSupplier(k, saved) {
    const p = productOf(k, saved); if (!p) return X.toast('المنتج غير موجود', 'err');
    const b = open('🏭 المورّد: ' + p.name, '<p class="sub">جارٍ التحميل…</p>');
    const prev = await X.api('GET', '/sup?k=' + encodeURIComponent(k));
    let q = prev.q;
    if (!q) { b.innerHTML = '<p class="sub">جارٍ تجهيز عبارة البحث بالإنجليزية…</p>'; try { q = (await X.api('POST', '/sup/query', { name: p.name, kw: p.kw, texts: p.texts })).q; } catch (x) { q = ''; } }
    const draw = items => { const el = body(); if (!el) return; el.innerHTML = `<p class="sub">تبحث الإضافة في AliExpress (الأكثر مبيعاً) عن هذا المنتج، ثم تقارن المنصة صورة كل نتيجة بصورة منتجك وتحسب السعر بالدينار. اكتب العبارة بالإنجليزية لنتائج أدق.</p>
<div class="l-add" style="max-width:640px"><input id="sup-q" dir="ltr" value="${e(q || '')}" placeholder="e.g. star projector night light"><button class="btn" data-tm="sup-go">ابحث في AliExpress</button></div>
${items.length ? supCards(items) : '<p class="sub" style="margin-top:12px">لا نتائج بعد.</p>'}${prev.updated_at ? `<p class="sub" style="margin-top:8px">آخر بحث: ${X.fd(prev.updated_at)} · ${num(items.length)} نتيجة</p>` : ''}`; };
    draw(prev.items || []);
    if ((prev.items || []).some(x => x.sim == null)) supRank(k, prev.items, p).then(draw).catch(() => {});
    body().addEventListener('click', async ev => {
      if (!ev.target.closest('[data-tm="sup-go"]')) return;
      q = body().querySelector('#sup-q').value.trim(); if (!q) return;
      try { await W.WPRJOB.start('sup', [{ q, url: aliUrl(q) }], { k, saved, q }, { maxAds: 60 }, '🏭 مورّد: ' + p.name); X.toast('فُتح AliExpress في تبويب جديد: اتركه ظاهراً حتى تُجمع النتائج.'); }
      catch (x) { X.toast(x.message, 'err'); }
    });
  }
  const SUP = {
    async ads(ev, ctx) { await X.api('POST', '/sup/ingest', { k: ctx.k, q: ctx.q, items: ev.ads, reset: !ctx._got }); ctx._got = true; },
    async done(ev, ctx) {
      const r = await X.api('GET', '/sup?k=' + encodeURIComponent(ctx.k)), p = productOf(ctx.k, ctx.saved);
      await supRank(ctx.k, r.items || [], p);
      X.toast(r.items && r.items.length ? 'وُجدت ' + num(r.items.length) + ' نتيجة في AliExpress' : 'لم تُقرأ نتائج من AliExpress. جرّب عبارة أخرى أو تأكد أنك ترى نتائج في التبويب.', r.items && r.items.length ? '' : 'err');
      if (p) openSupplier(ctx.k, ctx.saved);
    }
  };

  /* ================= 🧠 تحليل الإعلان ================= */
  const li = a => (Array.isArray(a) && a.length ? '<ul>' + a.map(x => `<li>${e(x)}</li>`).join('') + '</ul>' : '<p class="sub">—</p>');
  function aiHtml(d) {
    if (!d) return '';
    const c = d.ad_copy || {};
    return `<div class="ai-s"><div class="alert info">${e(d.summary || '')}</div>
<h4>🎯 المنتج وزاوية البيع</h4><p>${e(d.product || '')}</p><p><b>الزاوية:</b> ${e(d.angle || '')}</p>
<h4>👥 الجمهور المستهدف</h4><p>${e(d.audience || '')}</p>
<h4>😣 المشكلة التي يحلها</h4>${li(d.pains)}<h4>💪 نقاط القوة</h4>${li(d.strengths)}<h4>⚠️ نقاط الضعف والمخاطر</h4>${li(d.weaknesses)}
<h4>🎬 افتتاحيات فيديو (أول 3 ثوانٍ)</h4>${li(d.hooks)}
<h4>🎁 عرض مقترح للجزائر</h4><p>${e(d.offer || '')}</p>${d.price_hint ? `<p class="sub">${e(d.price_hint)}</p>` : ''}
<h4>🇩🇿 ملاءمته للسوق الجزائري</h4><p>${e(d.algeria_fit || '')}</p>
<h4>✍️ نصوص إعلان مقترحة</h4>${[['ar', 'بالعربية'], ['dz', 'بالدارجة'], ['fr', 'بالفرنسية']].filter(([k]) => c[k]).map(([k, l]) => `<div style="margin:8px 0"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><b>${l}</b><button class="btn ghost sm" data-tm="copy" data-t="${e(c[k])}">نسخ</button></div><div class="ai-copy" dir="auto">${e(c[k])}</div></div>`).join('')}</div>`;
  }
  async function openAI(k, saved) {
    const p = productOf(k, saved); if (!p) return X.toast('المنتج غير موجود', 'err');
    const b = open('🧠 تحليل الإعلان: ' + p.name, '<p class="sub">جارٍ التحميل…</p>');
    const r = await X.api('GET', '/ai/ad?k=' + encodeURIComponent(k));
    const draw = (d, at) => { const el = body(); if (!el) return; el.innerHTML = (d ? aiHtml(d) + `<p class="sub" style="margin-top:12px">حُلّل ${X.ago(at)}.</p>` : '<p class="sub">يحلّل الذكاء الاصطناعي نص الإعلان: لماذا يبيع، ولمن، وكيف تبيعه في الجزائر، مع نصوص إعلان جاهزة. لا يخترع مواصفات غير مذكورة.</p>')
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

  W.WPRTOOLS = {
    open, close, productOf, script: SCRIPT,
    init(ctx) {
      X = ctx;
      W.WPRJOB && W.WPRJOB.register('sup', SUP);
      X.root.addEventListener('click', ev => {
        const b = ev.target.closest('[data-tool]'); if (!b) return;
        ev.preventDefault();
        const t = b.dataset.tool, run = f => { const pr = Promise.resolve().then(f); W.__btnBusy && W.__btnBusy(ev, pr); pr.catch(x => { if (x && x.message !== 'auth') X.toast(x.message || 'حدث خطأ', 'err'); }); };
        if (t === 'sup') run(() => openSupplier(b.dataset.k, b.dataset.sv === '1'));
        if (t === 'ai') run(() => openAI(b.dataset.k, b.dataset.sv === '1'));
        if (t === 'watch') run(() => watchPage(b.dataset.pid, b.dataset.name));
        if (t === 'sheet') run(() => pushSheet(b.dataset.src));
      });
    }
  };
})();
