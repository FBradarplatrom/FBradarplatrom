/* قسم «🎯 ثغرات السوق الجزائري»: منتج رابح في سوق أجنبي (من المحفوظات) ← هل يُعلَن عنه في الجزائر؟
   الإضافة تبحث في مكتبة إعلانات ميتا (الجزائر) بعبارات جزائرية، وهذه الصفحة تقارن كل إعلان لحظة وصوله:
   بصمة الصورة + رابط المورّد + كلمات المنتج المميزة (adlib/lib/gapmatch.js). يعمل مع app.html عبر WPRGAP.init(ctx) و WPRGAP.render(). */
(function () {
  'use strict';
  const W = window, G = () => W.RadarGapMatch, BR = () => (W.WPRLIB && W.WPRLIB.bridge) || null;
  let X = null, inited = false;
  const $ = s => X.root.querySelector(s);
  const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => Number(n || 0).toLocaleString('ar-DZ');
  const VIEW = 'gap';
  const img = u => (u ? '/api/img?u=' + encodeURIComponent(u) : '');

  const st = document.createElement('style');
  st.textContent = `
.g-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.g-card{background:var(--card);border:1px solid var(--line);border-radius:var(--r,16px);overflow:hidden;display:flex;flex-direction:column;cursor:pointer;transition:.15s}.g-card:hover{border-color:var(--brand);transform:translateY(-1px)}
.g-card .im{aspect-ratio:16/10;background:var(--card2) center/cover no-repeat}.g-card .bd{padding:12px 14px;display:flex;flex-direction:column;gap:6px}
.g-v{display:inline-flex;align-items:center;gap:6px;border-radius:99px;padding:3px 12px;font-size:13px;font-weight:700;border:1px solid transparent}
.g-v.gap{background:#dcfce7;color:#166534}.g-v.weak{background:#fef9c3;color:#854d0e}.g-v.tried{background:#dbeafe;color:#1e40af}.g-v.saturated{background:#fee2e2;color:#991b1b}
.g-v.check{background:#ffedd5;color:#9a3412}.g-v.inconclusive,.g-v.new{background:var(--card2);color:var(--mut);border-color:var(--line)}
@media(prefers-color-scheme:dark){.g-v.gap{background:#14532d;color:#bbf7d0}.g-v.weak{background:#713f12;color:#fef08a}.g-v.tried{background:#1e3a8a;color:#bfdbfe}.g-v.saturated{background:#7f1d1d;color:#fecaca}.g-v.check{background:#7c2d12;color:#fed7aa}}
.g-kp{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 16px}.g-kp button{border:1px solid var(--line);background:var(--card);border-radius:99px;padding:6px 14px;font:inherit;font-size:13.5px;cursor:pointer;color:var(--ink)}.g-kp button.on{border-color:var(--brand);background:var(--soft);color:var(--brand);font-weight:700}
.g-top{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:16px}@media(max-width:860px){.g-top{grid-template-columns:1fr}}
.g-ims{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.g-ims img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;border:1px solid var(--line);background:var(--card2)}
.g-t{display:flex;gap:6px;margin:6px 0}.g-t input{flex:1;min-width:0}.g-t select{width:auto}
.g-m{display:grid;grid-template-columns:110px minmax(0,1fr);gap:12px;padding:12px 0;border-bottom:1px solid var(--line)}.g-m:last-child{border:0}
.g-m img{width:110px;height:110px;object-fit:cover;border-radius:10px;background:var(--card2);border:1px solid var(--line)}
.g-m .tx{font-size:13.5px;max-height:4.6em;overflow:hidden}.g-ev{font-size:12.5px;color:var(--brand);font-weight:600}
.g-q{display:flex;gap:10px;align-items:center;padding:6px 2px;border-bottom:1px solid var(--line);font-size:13.5px}.g-q:last-child{border:0}.g-q .q{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.g-nums{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin:10px 0}.g-nums div{background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:8px;text-align:center}.g-nums b{display:block;font-size:20px}.g-nums span{font-size:12px;color:var(--mut)}`;
  document.head.appendChild(st);

  const VL = {
    new: ['⚫', 'لم يُفحص بعد', 'جهّز عبارات البحث الجزائرية ثم ابدأ الفحص.'],
    gap: ['🟢', 'ثغرة مؤكدة', 'لم نجد هذا المنتج في إعلانات الجزائر بعد البحث بكل العبارات. فرصة لتكون الأول.'],
    weak: ['🟡', 'منافسة ضعيفة', 'موجود عند بائع أو بائعين فقط بإعلانات نشطة. ما زالت فرصة إن دخلت بسرعة وبعرض أفضل.'],
    tried: ['🔵', 'جُرّب وتوقف', 'وُجدت إعلانات قديمة متوقفة فقط: جرّبه أحد في الجزائر ثم توقف. ادرس السبب (السعر؟ العرض؟) قبل الدخول.'],
    saturated: ['🔴', 'مشبع', 'ثلاثة بائعين أو أكثر يعلنون عنه الآن في الجزائر.'],
    check: ['🟠', 'يحتاج تحققك', 'وجدنا إعلانات مشابهة غير مؤكدة. قارنها بصورة المنتج واضغط «نفس المنتج» أو «ليس هو».'],
    inconclusive: ['⚪', 'غير حاسم', 'اكتمل أقل من بحثين. أعد الفحص أو أضف عبارات أخرى.']
  };
  const badge = v => { const x = VL[v] || VL.new; return `<span class="g-v ${e(v)}">${x[0]} ${x[1]}</span>`; };
  const LANGS = { ar: 'الفصحى', dz: 'الدارجة', fr: 'الفرنسية', arz: 'الأرابيزي', en: 'الإنجليزية' };
  const cname = c => { const M = W.RadarMarkets; return c && M && M.COUNTRIES[c] ? M.COUNTRIES[c].name : c || 'سوق أجنبي'; };

  /* ---------- حالة الفحص الجاري (تبقى بعد إعادة تحميل الصفحة) ---------- */
  const SK = 'wpr_gap_scan_v1', QK = 'wpr_gap_queue_v1';
  const ls = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (x) { return null; } };
  let S = ls(SK);                   // {pid, scan, batch, name}
  const LIVE = { scanned: 0, strong: 0, possible: 0, items: [], last: [] };
  let LIST = null, CUR = null, FILTER = 'all', AI = false;
  const MCTX = new Map();           // pid -> سياق المقارنة {hashes, supplier, keywords}

  /* ---------- بصمات صور المنتج ---------- */
  async function productHashes(p) {
    if (p.hashes && p.hashes.length) return p.hashes;
    const out = [];
    for (const u of (p.snap.images || []).slice(0, 8)) { const h = await G().hashImage(img(u)); if (h) out.push(...h); }
    if (out.length) { try { await X.api('PUT', '/gap/' + p.id, { hashes: out }); } catch (x) {} }
    p.hashes = out; return out;
  }
  function keywordsOf(p) {
    if (p.keywords && p.keywords.length) return p.keywords;
    // بلا ذكاء اصطناعي: كلمات العبارات نفسها (تُستبعد منها كلمات البحث الذي أعاد الإعلان، عند المقارنة)
    return [...new Set(p.terms.flatMap(t => G().toks(t.q)))];
  }
  async function ctxOf(p) {
    const c = { hashes: await productHashes(p), supplier: G().supplierIds(p.snap.links || []), keywords: keywordsOf(p) };
    MCTX.set(p.id, c); return c;
  }

  /* ---------- طابور بصمات صور الإعلانات الجزائرية ---------- */
  function pool(list, n, f) { let i = 0; return Promise.all(Array.from({ length: Math.min(n, list.length) }, async () => { while (i < list.length) { const k = i++; await f(list[k], k); } })); }

  /* ---------- الإضافة ---------- */
  const libUrl = q => 'https://www.facebook.com/ads/library/?' + new URLSearchParams({ active_status: 'all', ad_type: 'all', country: 'DZ', is_targeted_country: 'false', media_type: 'all', q, search_type: 'keyword_unordered' }).toString();
  const label = p => ('🎯 ثغرة #' + p.id + ': ' + p.name).slice(0, 150);
  async function startScan(p) {
    const b = BR();
    if (!b || !b.ok()) throw new Error('الإضافة غير متصلة. ثبّتها من «جمع الإعلانات ← الإضافة» ثم أعد تحميل الصفحة.');
    if (b.running()) throw new Error('هناك عملية جمع أو فحص تعمل الآن. انتظر انتهاءها.');
    const terms = p.terms.filter(t => t.q.trim());
    if (!terms.length) throw new Error('اكتب عبارة بحث جزائرية واحدة على الأقل');
    let stats = b.stats(); if (!stats) stats = await b.loadStats();
    await X.api('POST', '/lib/batch', { count: terms.length });                 // حدود الجمع اليومية نفسها (حماية حسابك)
    await ctxOf(p);
    const { scan } = await X.api('POST', '/gap/' + p.id + '/scan', { queries: terms });
    const settings = Object.assign({}, b.settings(), { activeOnly: false, maxAds: Math.min(200, (stats && stats.limits.maxAdsPerSearch) || 200) });
    const r = await b.start({ items: terms.map(t => ({ q: t.q, niche: '', url: libUrl(t.q) })), settings, limits: stats && stats.limits, label: label(p) }, 8000);
    if (!r.ok) throw new Error({ busy: 'هناك عملية جمع تعمل الآن', tab: 'تعذّر فتح تبويب فيسبوك', no_items: 'لا توجد عبارات صالحة' }[r.error] || 'تعذّر بدء الفحص');
    S = { pid: p.id, scan, batch: r.batch, name: p.name }; ls(SK, S);
    Object.assign(LIVE, { scanned: 0, strong: 0, possible: 0, items: terms.map(t => ({ q: t.q, status: 'pending', seen: 0 })), last: [] });
    X.toast('بدأ الفحص في الجزائر. سيُفتح تبويب فيسبوك، اتركه ظاهراً.');
    drawLive();
  }

  /* ---------- وصول الإعلانات: مقارنة لحظية ---------- */
  async function onAds(ev) {
    const s = S; if (!s) return;
    W.__busy && W.__busy('gap', 'جارٍ مقارنة الإعلانات الجزائرية بالمنتج (الصورة، الرابط، الكلمات)…');
    try {
    const r = await X.api('POST', '/gap/' + s.pid + '/ingest', { scan: s.scan, ads: ev.ads, query: (ev.ctx && ev.ctx.query) || '' });
    LIVE.scanned = r.scanned;
    let c = MCTX.get(s.pid);
    if (!c) { const p = await X.api('GET', '/gap/' + s.pid); c = await ctxOf(p); }
    const found = [];
    await pool(r.rows, 4, async row => {
      const qWords = new Set(G().toks(row.search || ''));
      const P = Object.assign({}, c, { keywords: c.keywords.filter(w => !G().toks(w).every(t => qWords.has(t))) });
      const h = row.image_url && c.hashes.length ? await G().hashImage(img(row.image_url)) : null;
      const j = G().judge(P, row, h);
      if (j.level) found.push({ row, ev: j.ev, level: j.level });
    });
    if (found.length) {
      const m = await X.api('POST', '/gap/' + s.pid + '/matches', { scan: s.scan, matches: found });
      found.forEach(f => { LIVE[f.level]++; LIVE.last.unshift(f); }); LIVE.last = LIVE.last.slice(0, 6);
      if (CUR && CUR.id === s.pid) { CUR.verdict = m.verdict; CUR.stats = m.stats; }
    }
    } finally { W.__busy && W.__busy('gap'); }
    drawLive();
  }
  async function onEvent(ev) {
    if (!S) return;
    if (ev.evt === 'state' && ev.state && ev.state.id === S.batch) { LIVE.items = ev.state.items || LIVE.items; drawLive(); }
    if (ev.evt === 'progress' && ev.id === S.batch && LIVE.items[ev.idx]) { LIVE.items[ev.idx].seen = ev.seen; drawLive(); }
    if (ev.evt === 'done' && ev.id === S.batch) {
      const s = S, b = BR(); let items = LIVE.items;
      await new Promise(r => setTimeout(r, 1500));                              // آخر الإعلانات قد تكون في الطريق
      // الحالة النهائية لكل عبارة: من الإضافة نفسها (أدق من آخر حدث وصل)
      try { const r = b && await b.send('ping', {}, 3000); const stt = (r && r.state) || (b && b.state()); if (stt && stt.id === s.batch && stt.items) items = stt.items; } catch (x) {}
      W.__busy && W.__busy('gapf', 'جارٍ حساب النتيجة…');
      let p; try { p = await X.api('POST', '/gap/' + s.pid + '/finish', { scan: s.scan, items }); } finally { W.__busy && W.__busy('gapf'); }
      S = null; ls(SK, null);
      X.toast('انتهى الفحص: ' + (VL[p.verdict] || VL.new)[1] + ' · فُحص ' + num(p.stats.scanned) + ' إعلاناً جزائرياً');
      if (CUR && CUR.id === p.id) CUR = p;
      LIST = null;
      const q = ls(QK) || [];
      if (q.length) { const next = q.shift(); ls(QK, q); setTimeout(() => runQueued(next), 4000); }
      redraw();
    }
  }
  async function runQueued(id) {
    try { const p = await X.api('GET', '/gap/' + id); if (!p.terms.length) throw new Error('بلا عبارات: ' + p.name); await startScan(p); }
    catch (x) { X.toast(x.message, 'err'); const q = ls(QK) || []; if (q.length) { const n = q.shift(); ls(QK, q); setTimeout(() => runQueued(n), 2000); } }
  }

  /* ---------- الرسم ---------- */
  const scanning = id => S && S.pid === id;
  function liveHtml() {
    if (!S) return '';
    const done = LIVE.items.filter(i => ['done', 'skipped', 'timeout', 'stopped'].includes(i.status)).length;
    const L = { pending: 'بالانتظار', running: 'يبحث…', done: 'تم', skipped: 'تُخطّي', timeout: 'انتهت المهلة', stopped: 'أُوقف' };
    return `<div class="card" style="margin-bottom:14px"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><h2 style="margin:0;flex:1">⏳ يفحص الآن: ${e(S.name)} <small>(${num(done)}/${num(LIVE.items.length)})</small></h2>
<button class="btn ghost sm" data-g="skip">تخطّي العبارة</button><button class="btn danger sm" data-g="stop">إيقاف</button></div>
<div class="g-nums"><div><b>${num(LIVE.scanned)}</b><span>إعلان جزائري فُحص</span></div><div><b>${num(LIVE.strong)}</b><span>تطابق مؤكد</span></div><div><b>${num(LIVE.possible)}</b><span>يحتاج تحققك</span></div></div>
${LIVE.items.map(i => `<div class="g-q"><span class="q" dir="auto">${e(i.q)}</span><span class="muted">${i.seen ? num(i.seen) + ' إعلان · ' : ''}${L[i.status] || i.status}</span></div>`).join('')}
${LIVE.last.length ? `<div class="l-sub" style="margin-top:10px">آخر ما وُجد</div>${LIVE.last.map(f => `<div class="g-ev" dir="auto">${f.level === 'strong' ? '✅' : '❔'} ${e(f.row.page_name)} · ${e(f.ev.why)}</div>`).join('')}` : ''}</div>`;
  }
  function drawLive() { const el = $('#g-live'); if (el && X.cur() === VIEW) el.innerHTML = liveHtml(); }

  async function drawList() {
    const root = $('#x-gap');
    if (!LIST) { root.innerHTML = '<div class="card"><p class="sub">جارٍ التحميل…</p></div>'; const r = await X.api('GET', '/gap'); LIST = r.products; AI = r.ai; }
    const cnt = { all: LIST.length }; LIST.forEach(p => { cnt[p.verdict] = (cnt[p.verdict] || 0) + 1; }); cnt.due = LIST.filter(p => p.due).length;
    const tabs = [['all', 'الكل'], ['gap', '🟢 ثغرات'], ['weak', '🟡 منافسة ضعيفة'], ['tried', '🔵 جُرّب وتوقف'], ['check', '🟠 تحقق'], ['saturated', '🔴 مشبع'], ['new', '⚫ لم يُفحص'], ['due', '🔁 مستحق إعادة الفحص']];
    const shown = LIST.filter(p => FILTER === 'all' || (FILTER === 'due' ? p.due : p.verdict === FILTER));
    root.innerHTML = `<div id="g-live">${liveHtml()}</div>
${cnt.due ? `<div class="alert info" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span style="flex:1">🔁 ${num(cnt.due)} منتج مستحق لإعادة الفحص الأسبوعية (هل ظهر منافس جديد في الجزائر؟)</span><button class="btn sm" data-g="rundue">افحص المستحق تباعاً</button></div>` : ''}
${LIST.length ? `<div class="g-kp">${tabs.filter(t => t[0] === 'all' || cnt[t[0]]).map(([k, t]) => `<button data-gf="${k}" class="${FILTER === k ? 'on' : ''}">${t} <b>${num(cnt[k] || 0)}</b></button>`).join('')}</div>` : ''}
<div class="g-list">${shown.map(p => `<div class="g-card" data-gopen="${p.id}"><div class="im" style="background-image:url('${e(img((p.snap.images || [])[0]))}')"></div><div class="bd">
<div>${badge(p.verdict)} ${p.due ? '<span class="pill warn">🔁 مستحق</span>' : ''}${scanning(p.id) ? '<span class="pill">⏳ يُفحص</span>' : ''}</div>
<b dir="auto">${e(p.name)}</b><small>من ${e(cname(p.snap.country))}${p.snap.score ? ' · درجته هناك ' + num(p.snap.score) : ''}</small>
<small class="muted">${p.last_scan_at ? 'فُحص ' + num(p.stats.scanned) + ' إعلاناً جزائرياً · ' + X.ago(p.last_scan_at) : 'لم يُفحص بعد'}${p.stats.sellers ? ' · ' + num(p.stats.sellers) + ' بائع' : ''}</small></div></div>`).join('') ||
  `<div class="empty" style="grid-column:1/-1">${LIST.length ? 'لا منتجات في هذا التصنيف.' : 'لا منتجات هنا بعد.<br>افتح «المنتجات المحفوظة» واضغط «🎯 افحص في الجزائر» على منتج وجدته في سوق أجنبي.'}</div>`}</div>`;
  }

  function termsHtml(p) {
    const rows = p.terms.length ? p.terms : [{ q: '', lang: 'ar' }, { q: '', lang: 'fr' }, { q: '', lang: 'dz' }];
    return rows.map((t, i) => `<div class="g-t"><input dir="auto" data-gt="${i}" value="${e(t.q)}" placeholder="${['مثال: مصباح ليلي نجوم للأطفال', 'Ex: veilleuse projecteur étoiles', 'مثال: بروجكتور ليلي للدراري'][i % 3]}">
<select data-glang="${i}">${Object.entries(LANGS).map(([k, v]) => `<option value="${k}"${t.lang === k ? ' selected' : ''}>${v}</option>`).join('')}</select><button class="btn ghost sm" data-g="tdel" data-i="${i}" title="حذف">✕</button></div>`).join('');
  }
  function matchHtml(m) {
    const r = m.row, dec = m.decision;
    return `<div class="g-m"><a href="${e(r.library_url)}" target="_blank" rel="noopener"><img loading="lazy" src="${e(img(r.image_url))}" alt=""></a><div>
<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><b dir="auto">${e(r.page_name || 'صفحة')}</b><span class="pill ${r.status === 'inactive' ? '' : 'ok'}">${r.status === 'inactive' ? 'متوقف' : 'نشط'}</span>${r.start_date ? `<small>منذ ${e(r.start_date)}</small>` : ''}${dec === 'yes' ? '<span class="pill ok">✓ أكّدته أنت</span>' : dec === 'no' ? '<span class="pill">✗ استبعدته</span>' : m.level === 'strong' ? '<span class="pill ok">✅ مؤكد</span>' : '<span class="pill warn">❔ محتمل</span>'}</div>
<div class="g-ev">${e(m.ev.why || '')}</div><div class="tx muted" dir="auto">${e((r.title ? r.title + ' — ' : '') + (r.body || ''))}</div>
<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap"><button class="btn sm ${dec === 'yes' ? '' : 'ghost'}" data-g="yes" data-m="${m.id}">✓ نفس المنتج</button><button class="btn sm ${dec === 'no' ? 'danger' : 'ghost'}" data-g="no" data-m="${m.id}">✗ ليس هو</button><a class="btn ghost sm" href="${e(r.library_url)}" target="_blank" rel="noopener">الإعلان ↗</a></div></div></div>`;
  }
  async function drawProduct(id) {
    const root = $('#x-gap');
    if (!CUR || CUR.id !== +id || !CUR.matches) { root.innerHTML = '<div class="card"><p class="sub">جارٍ التحميل…</p></div>'; CUR = await X.api('GET', '/gap/' + id); if (LIST === null) { const r = await X.api('GET', '/gap'); LIST = r.products; AI = r.ai; } }
    const p = CUR, s = p.stats || {}, V = VL[p.verdict] || VL.new;
    const strong = p.matches.filter(m => m.decision === 'yes' || (m.level === 'strong' && m.decision !== 'no')), maybe = p.matches.filter(m => !strong.includes(m) && m.decision !== 'no');
    const rejected = p.matches.filter(m => m.decision === 'no');
    root.innerHTML = `<p><button class="btn ghost sm" data-g="back">→ كل المنتجات</button></p><div id="g-live">${liveHtml()}</div>
<div class="g-top"><div class="card"><h2 dir="auto" style="margin-bottom:6px">${e(p.name)}</h2><p class="sub">رابح في ${e(cname(p.snap.country))}${p.snap.score ? ' · درجته ' + num(p.snap.score) : ''}${p.snap.n ? ' · ' + num(p.snap.n) + ' بائع هناك' : ''} ${p.snap.lib ? `· <a href="${e(p.snap.lib)}" target="_blank" rel="noopener">إعلانه ↗</a>` : ''}</p>
<div class="g-ims">${(p.snap.images || []).slice(0, 8).map(u => `<img loading="lazy" src="${e(img(u))}" alt="">`).join('')}</div>
${(p.snap.texts || [])[0] ? `<p class="sub" dir="auto" style="margin-top:10px;max-height:6.5em;overflow:hidden">${e(p.snap.texts[0])}</p>` : ''}
<label class="fl chk" style="margin-top:10px"><input type="checkbox" data-g="watch"${p.watch ? ' checked' : ''}> 🔁 مراقبة أسبوعية: أعد فحصه كل 7 أيام لأعرف متى يظهر أول منافس</label></div>
<div class="card"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><h2 style="margin:0;flex:1">النتيجة</h2>${badge(p.verdict)}</div>
<p class="sub">${e(V[2])}</p>
${p.last_scan_at ? `<div class="g-nums"><div><b>${num(s.scanned)}</b><span>إعلان جزائري فُحص</span></div><div><b>${num(s.queriesDone)}/${num(s.queries)}</b><span>عبارة اكتمل بحثها</span></div><div><b>${num(s.matches)}</b><span>إعلان مطابق</span></div><div><b>${num(s.activeSellers)}</b><span>بائع نشط</span></div></div>
<p class="sub">آخر فحص ${X.ago(p.last_scan_at)}${s.firstSeen ? ' · أقدم إعلان نشط مطابق بدأ ' + e(s.firstSeen) : ''}${p.watch && p.next_check_at ? ' · الفحص القادم ' + X.fd(p.next_check_at) : ''}</p>` : ''}
<h3 style="margin:14px 0 4px">عبارات البحث في الجزائر</h3><p class="sub">كما يكتبها البائع الجزائري: الاسم بالعربية والفرنسية والدارجة، وعبارة بالفائدة. ${AI ? 'اضغط «اقتراح بالذكاء الاصطناعي» ثم راجعها.' : 'الذكاء الاصطناعي غير مفعّل (أضف OPENAI_API_KEY في إعدادات الخادم)، اكتبها بنفسك.'}</p>
<div id="g-terms">${termsHtml(p)}</div>
<p style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0"><button class="btn ghost sm" data-g="tadd">+ عبارة</button>${AI ? '<button class="btn ghost sm" data-g="ai">✨ اقتراح بالذكاء الاصطناعي</button>' : ''}<button class="btn ghost sm" data-g="tsave">حفظ العبارات</button></p>
<label class="fl">كلمات المنتج المميزة (للمقارنة، افصل بفاصلة)<input dir="auto" data-g="kw" value="${e((p.keywords || []).join('، '))}" placeholder="مثال: نجوم، بروجكتور، ضوضاء بيضاء، veilleuse"></label>
<p style="margin:12px 0 0"><button class="btn" data-g="scan"${scanning(p.id) ? ' disabled' : ''}>${p.last_scan_at ? '🔁 أعد الفحص في الجزائر' : '🎯 ابدأ الفحص في الجزائر'}</button> <button class="btn danger sm" data-g="del">حذف من القسم</button></p>
<p class="sub" style="margin-top:6px">يبحث في مكتبة إعلانات ميتا (الجزائر، النشطة والمتوقفة) بكل عبارة، ويقارن كل إعلان لحظة وصوله: بصمة الصورة، رابط المورّد، وكلمات المنتج. يستهلك من حدّ عمليات البحث اليومي.</p></div></div>
<div class="card" style="margin-top:14px"><h2>✅ إعلانات جزائرية مطابقة <small>(${num(strong.length)})</small></h2>${strong.map(matchHtml).join('') || '<p class="sub">لا شيء مؤكد.</p>'}</div>
${maybe.length ? `<div class="card" style="margin-top:14px"><h2>❔ محتملة: قارنها بصور المنتج وقرّر <small>(${num(maybe.length)})</small></h2>${maybe.map(matchHtml).join('')}</div>` : ''}
${rejected.length ? `<details class="fx" style="margin-top:14px"><summary>استبعدتها أنت (${num(rejected.length)})</summary>${rejected.map(matchHtml).join('')}</details>` : ''}`;
  }
  function redraw() {
    if (!X || X.cur() !== VIEW) return;
    const id = (location.pathname.split('/')[2] || '').replace(/\D/g, '');
    (id ? drawProduct(id) : drawList()).catch(x => { if (x.message !== 'auth') X.toast(x.message, 'err'); });
  }

  /* ---------- الأحداث ---------- */
  function readTerms() {
    const out = [];
    X.root.querySelectorAll('[data-gt]').forEach(i => { const q = i.value.trim(); if (q) out.push({ q, lang: X.root.querySelector(`[data-glang="${i.dataset.gt}"]`).value }); });
    return out;
  }
  const readKw = () => { const i = $('[data-g="kw"]'); return i ? i.value.split(/[,،\n]+/).map(x => x.trim()).filter(Boolean) : CUR.keywords; };
  async function saveTerms() { CUR = Object.assign(CUR, await X.api('PUT', '/gap/' + CUR.id, { terms: readTerms(), keywords: readKw() })); MCTX.delete(CUR.id); }
  async function onClick(ev) {
    const f = ev.target.closest('[data-gf]'); if (f) { FILTER = f.dataset.gf; return drawList(); }
    const o = ev.target.closest('[data-gopen]'); if (o) { X.url('/gaps/' + o.dataset.gopen); CUR = null; return redraw(); }
    const b = ev.target.closest('[data-g]'); if (!b || b.tagName === 'INPUT') return;
    const a = b.dataset.g;
    if (a === 'back') { X.url('/gaps'); LIST = null; return redraw(); }
    if (a === 'stop') return BR() && BR().send('stop').catch(() => {});
    if (a === 'skip') return BR() && BR().send('skip').catch(() => {});
    if (a === 'rundue') { const ids = LIST.filter(p => p.due && p.terms.length).map(p => p.id); if (!ids.length) return X.toast('المنتجات المستحقة بلا عبارات بحث', 'err'); ls(QK, ids.slice(1)); return runQueued(ids[0]); }
    if (!CUR) return;
    if (a === 'tadd') { CUR.terms = readTerms().concat([{ q: '', lang: 'ar' }]); $('#g-terms').innerHTML = termsHtml(CUR); return; }
    if (a === 'tdel') { const t = readTerms(); t.splice(+b.dataset.i, 1); CUR.terms = t; $('#g-terms').innerHTML = termsHtml(CUR); return; }
    if (a === 'tsave') { await saveTerms(); return X.toast('حُفظت العبارات'); }
    if (a === 'ai') { b.disabled = true; b.textContent = '✨ يقترح…'; try { const r = await X.api('POST', '/gap/' + CUR.id + '/suggest', {}); if (!r.ai) return X.toast('الذكاء الاصطناعي غير مفعّل', 'err'); CUR.terms = r.terms; CUR.keywords = r.keywords; MCTX.delete(CUR.id); X.toast('اقتُرحت ' + r.terms.length + ' عبارات. راجعها ثم ابدأ الفحص.'); return drawProduct(CUR.id); } finally { b.disabled = false; } }
    if (a === 'scan') { await saveTerms(); await startScan(CUR); return drawProduct(CUR.id); }
    if (a === 'del') { if (b.dataset.s !== '1') { b.dataset.s = '1'; b.textContent = 'تأكيد الحذف؟'; return; } await X.api('DELETE', '/gap/' + CUR.id); CUR = null; LIST = null; X.url('/gaps'); return redraw(); }
    if (a === 'yes' || a === 'no') {
      const m = CUR.matches.find(x => x.id === +b.dataset.m), d = m && m.decision === a ? '' : a;
      const r = await X.api('PUT', '/gap/' + CUR.id + '/matches/' + b.dataset.m, { decision: d }); if (m) m.decision = d; CUR.verdict = r.verdict; CUR.stats = r.stats; return drawProduct(CUR.id);
    }
  }
  async function onChange(ev) {
    const w = ev.target.closest('[data-g="watch"]'); if (w && CUR) { await X.api('PUT', '/gap/' + CUR.id, { watch: w.checked }); CUR.watch = w.checked; X.toast(w.checked ? 'سيُعاد فحصه أسبوعياً' : 'أُوقفت المراقبة'); }
  }
  const guard = f => ev => { if (X.cur() === VIEW) (W.__btnBusy ? W.__btnBusy(ev, Promise.resolve().then(() => f(ev))) : Promise.resolve().then(() => f(ev))).catch(x => { if (x && x.message !== 'auth') X.toast(x.message || 'حدث خطأ', 'err'); }); };

  W.WPRGAP = {
    ready: false,
    owns: ev => !!(S && (ev.batchId === S.batch || String(ev.label || '').startsWith('🎯 ثغرة #' + S.pid + ':'))),
    ownsBatch: id => !!(S && id === S.batch),
    ads: ev => onAds(ev),
    event: ev => { onEvent(ev).catch(x => X && X.toast(x.message, 'err')); },
    init(ctx) {
      X = ctx; if (inited) return; inited = true; this.ready = true;
      X.root.addEventListener('click', guard(onClick));
      X.root.addEventListener('change', guard(onChange));
      // إن انتهت الإضافة من الفحص والصفحة مغلقة: يُغلق الفحص عند العودة
      setTimeout(() => { const b = BR(); if (S && b && b.ok() && !b.running()) onEvent({ evt: 'done', id: S.batch }).catch(() => {}); }, 6000);
    },
    async dueCount() { try { return (await X.api('GET', '/gap/due')).due; } catch (x) { return 0; } },
    render() { LIST = null; redraw(); }
  };
})();
