/* قسم «🎵 TikTok»: البحث في TikTok بأشهر عبارات المنتجات (tiktok made me buy it, amazon finds…).
   تختار العبارات ← الإضافة تفتح بحث TikTok (تبويب «الأفضل/Top» الافتراضي) وتمرّر وتجمع الفيديوهات وإحصاءاتها ← هنا تُرتَّب بالتفاعل
   وتُستبعد غير المنتجات، وتختار المنتجات لحفظها (ثم المورّد، تحليل الإعلان، فحص الجزائر). يعمل مع app.html عبر WPRTT. */
(function () {
  'use strict';
  const W = window; let X = null, inited = false, PH = null, RUNS = null, CUR = null;
  const $ = s => X.root.querySelector(s), $$ = s => [...X.root.querySelectorAll(s)];
  const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => Number(n || 0).toLocaleString('ar-DZ');
  const big = n => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + ' مليون' : n >= 1e3 ? Math.round(n / 1e3) + ' ألف' : num(n));
  const img = u => (u ? '/api/img?u=' + encodeURIComponent(u) : '');
  const VIEW = 'tiktok', PK = 'wpr_tt_prefs_v1';
  const P = Object.assign({ sel: [], per: 60, minViews: 50000, maxAge: 90, sort: 'score', onlyProducts: true }, (() => { try { return JSON.parse(localStorage.getItem(PK)) || {}; } catch (x) { return {}; } })());
  const saveP = () => { try { localStorage.setItem(PK, JSON.stringify(P)); } catch (x) {} };
  const LIVE = { n: 0 };
  const ttUrl = q => 'https://www.tiktok.com/search?q=' + encodeURIComponent(q);

  /* ---------- المنتج من وصف الفيديو ---------- */
  const titleOf = v => String(v.desc || '').replace(/#[\p{L}\p{N}_]+/gu, ' ').replace(/@[\w.]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 110) || (v.tags || []).slice(0, 3).join(' ') || 'فيديو TikTok';
  const ageDays = v => (v.createTime ? Math.max(0, Math.floor((Date.now() / 1000 - v.createTime) / 86400)) : null);
  const engage = v => (v.plays ? (v.likes + 2 * v.comments + 3 * v.shares + 2 * v.saves) / v.plays : 0);
  // درجة: مشاهدات (لوغاريتم) × تفاعل × حداثة
  const score = v => { const a = ageDays(v); return Math.round(Math.log10(1 + v.plays) * 10 * (0.6 + Math.min(1.4, engage(v) * 10)) * (a == null ? 0.8 : a <= 30 ? 1.2 : a <= 90 ? 1 : 0.7)); };
  const isProduct = v => { const PC = W.RadarProductCheck; if (!PC) return true; const r = PC.check({ title: titleOf(v), body: v.desc, cta_type: v.shop ? 'SHOP_NOW' : '' }, { langs: ['en', 'fr', 'ar', 'es', 'id', 'vi', 'tl'] }); return r.ok || r.kind === 'insufficient'; };

  /* ---------- الجمع عبر الإضافة ---------- */
  async function start() {
    const phrases = P.sel.filter(q => PH.includes(q));
    if (!phrases.length) return X.toast('اختر عبارة واحدة على الأقل', 'err');
    const label = '🎵 TikTok: ' + phrases.slice(0, 2).join('، ') + (phrases.length > 2 ? ' +' + (phrases.length - 2) : '');
    const { id } = await X.api('POST', '/tt', { phrases, label });
    await W.WPRJOB.start('tt', phrases.map(q => ({ q, url: ttUrl(q) })), { run: id }, { maxAds: Math.max(20, Math.min(500, +P.per || 60)) }, label);
    LIVE.n = 0; RUNS = null;
    X.toast('فُتح TikTok في تبويب جديد. اتركه ظاهراً: يبحث بكل عبارة ويمرّر النتائج تلقائياً.'); redraw();
  }
  const H = {
    async ads(ev, ctx) { const r = await X.api('POST', '/tt/' + ctx.run + '/ingest', { q: (ev.ctx && ev.ctx.query) || '', items: ev.ads }); LIVE.n = r.count; drawLive(); },
    event() { drawLive(); },
    async done(ev, ctx) { RUNS = null; CUR = null; X.toast('انتهى البحث في TikTok: ' + num(LIVE.n) + ' فيديو'); X.url('/tiktok/' + ctx.run); redraw(); }
  };

  /* ---------- الرسم ---------- */
  function drawLive() { const el = $('#t-live'); if (!el || X.cur() !== VIEW) return; const j = W.WPRJOB.cur(); el.innerHTML = j && j.mod === 'tt' ? `<div class="alert info">⏳ يبحث الآن في TikTok: ${num(LIVE.n)} فيديو حتى الآن <button class="btn ghost sm" data-t="skip">تخطّي العبارة</button> <button class="btn danger sm" data-t="stop">إيقاف</button></div>` : ''; }
  async function drawHome() {
    const root = $('#x-tiktok');
    if (!PH || !RUNS) { root.innerHTML = '<div class="card"><p class="sub">جارٍ التحميل…</p></div>'; const [a, b] = await Promise.all([X.api('GET', '/tt/phrases'), X.api('GET', '/tt')]); PH = a.phrases; RUNS = b.runs; }
    const sel = new Set(P.sel);
    root.innerHTML = `<div id="t-live"></div>
<div class="card"><h2>🎵 ابحث في TikTok بأشهر عبارات المنتجات</h2><p class="sub">اختر العبارات، فتفتح الإضافة بحث TikTok لكل عبارة على تبويب «الأفضل» وتمرّر وتجمع الفيديوهات مع مشاهداتها وإعجاباتها وتاريخها، ثم تُرتَّب هنا وتُستبعد غير المنتجات. يجب أن تكون مسجّلاً في TikTok على Chrome.</p>
<div class="l-chips" style="max-height:none">${PH.map(q => `<button type="button" class="lc${sel.has(q) ? ' on' : ''}" data-tq="${e(q)}" dir="auto">${e(q)}</button>`).join('')}</div>
<div class="l-add" style="max-width:520px"><input id="t-new" dir="auto" placeholder="أضف عبارة، مثل: amazon gadgets 2026"><button class="btn ghost sm" data-t="add">إضافة</button></div>
<div class="l-g3" style="margin-top:12px"><label class="fl">فيديوهات لكل عبارة<input type="number" min="20" max="500" data-tp="per" value="${e(P.per)}"></label></div>
<p style="margin:12px 0 0;display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-t="go"${sel.size ? '' : ' disabled'}>🎵 ابدأ البحث (${num(P.sel.filter(q => PH.includes(q)).length)} عبارة)</button><button class="btn ghost sm" data-t="selnone">إلغاء الاختيار</button>${P.sel.length ? '<button class="btn danger sm" data-t="delsel">حذف المختارة من القائمة</button>' : ''}</p></div>
<div class="card pad0" style="margin-top:14px;padding:4px 18px"><h2 style="margin:12px 0 4px">عمليات البحث السابقة</h2>${RUNS.map(r => `<div class="row"><div class="grow"><b>${e(r.label)}</b><div class="muted">${X.fd(r.created_at)} · ${num(r.count)} فيديو</div></div><div class="ac"><button class="btn sm" data-t="open" data-id="${r.id}">عرض النتائج</button><button class="btn danger sm" data-t="del" data-id="${r.id}">حذف</button></div></div>`).join('') || '<p class="sub" style="padding:8px 0 14px">لا شيء بعد.</p>'}</div>`;
    drawLive();
  }
  function vCard(v) {
    const a = ageDays(v), t = titleOf(v);
    return `<article class="pc"><a class="pc-media" href="${e(v.url)}" target="_blank" rel="noopener" style="display:block;aspect-ratio:9/12;background:var(--card2) center/cover no-repeat url('${e(img(v.cover))}')"></a>
<div class="pc-body"><label style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" data-tsel="${e(v.id)}" style="margin-top:5px"><h3 class="pc-ti" dir="auto" style="margin:0">${e(t)}</h3></label>
<p class="pc-sub">@${e(v.author || '')}${v.q ? ' · 🔎 ' + e(v.q) : ''}</p>
<div class="pc-st"><div><b>${big(v.plays)}</b><span>مشاهدة</span></div><div><b>${big(v.likes)}</b><span>إعجاب</span></div><div><b>${big(v.shares)}</b><span>مشاركة</span></div><div><b>${(engage(v) * 100).toFixed(1)}%</b><span>تفاعل</span></div><div><b>${a == null ? '—' : num(a)}</b><span>عمر (يوم)</span></div></div>
<div class="pc-tags">${v.shop ? '<span class="tg soft">🛒 فيه رابط متجر</span>' : ''}${v.ad ? '<span class="tg">إعلان</span>' : ''}${(v.tags || []).slice(0, 4).map(x => `<span class="tg">#${e(x)}</span>`).join('')}</div>
<div class="pc-act"><button class="btn sm ghost" data-t="save" data-id="${e(v.id)}">⭐ احفظه منتجاً</button><button class="btn sm ghost" data-t="fb" data-id="${e(v.id)}" title="ابحث عنه في مكتبة إعلانات فيسبوك">🔎 في فيسبوك</button><a class="btn sm ghost" href="${e(v.url)}" target="_blank" rel="noopener">الفيديو ↗</a></div></div></article>`;
  }
  function filtered() {
    let L = CUR.items.filter(v => v.plays >= (+P.minViews || 0) && (!(+P.maxAge) || ageDays(v) == null || ageDays(v) <= +P.maxAge));
    if (P.onlyProducts) L = L.filter(isProduct);
    const k = { score, plays: v => v.plays, likes: v => v.likes, engage, new: v => v.createTime || 0 }[P.sort] || score;
    return L.sort((a, b) => k(b) - k(a));
  }
  async function drawRun(id) {
    const root = $('#x-tiktok');
    if (!CUR || CUR.id !== +id) { root.innerHTML = '<div class="card"><p class="sub">جارٍ التحميل…</p></div>'; CUR = await X.api('GET', '/tt/' + id); }
    const L = filtered();
    root.innerHTML = `<p><button class="btn ghost sm" data-t="back">→ البحث في TikTok</button></p><div id="t-live"></div>
<div class="card"><h2 style="margin:0 0 8px">${e(CUR.label)} <small>(${num(L.length)} من ${num(CUR.items.length)} فيديو)</small></h2><div class="l-g3">
<label class="fl">أدنى مشاهدات<input type="number" min="0" step="1000" data-tp="minViews" value="${e(P.minViews)}"></label>
<label class="fl">أقصى عمر (يوم)<input type="number" min="0" data-tp="maxAge" value="${e(P.maxAge)}"></label>
<label class="fl">الترتيب<select data-tp="sort">${[['score', 'الأفضل (مشاهدات × تفاعل × حداثة)'], ['plays', 'الأكثر مشاهدة'], ['likes', 'الأكثر إعجاباً'], ['engage', 'أعلى تفاعل'], ['new', 'الأحدث']].map(([v, t]) => `<option value="${v}"${P.sort === v ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
<label class="fl chk"><input type="checkbox" data-tp="onlyProducts"${P.onlyProducts ? ' checked' : ''}> منتجات فقط (استبعاد الأكل والخدمات والدورات…)</label></div>
<p style="margin:10px 0 0;display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-t="savesel">⭐ احفظ المختارة منتجات</button><button class="btn ghost sm" data-t="selall">اختيار أول 20</button></p></div>
<div class="grid" style="margin-top:14px">${L.slice(0, 120).map(vCard).join('') || '<div class="empty">لا فيديوهات بهذه الفلاتر.</div>'}</div>`;
    drawLive();
  }
  function redraw() { if (!X || X.cur() !== VIEW) return; const id = (location.pathname.split('/')[2] || '').replace(/\D/g, ''); (id ? drawRun(id) : drawHome()).catch(x => { if (x.message !== 'auth') X.toast(x.message, 'err'); }); }

  /* ---------- حفظ فيديو كمنتج: يدخل «المحفوظات» فتعمل عليه كل الأدوات (المورّد، التحليل، الجزائر) ---------- */
  async function saveVideo(v) {
    const name = titleOf(v), k = 'tt:' + v.id;
    const a = { title: name, body: v.desc, page_name: '@' + (v.author || ''), library_url: v.url, link_url: '', image_url: v.cover, video_url: v.url, start_date: v.createTime ? new Date(v.createTime * 1000).toISOString().slice(0, 10) : '' };
    const snap = { v: 2, name, kw: (v.tags || []).slice(0, 2).join(' '), cat: 'trial', tier: 'trial', score: Math.min(100, score(v)), days: ageDays(v) || 0, trend: 'steady', n: 1, copies: 1, pr: 0, pages: '@' + (v.author || ''), why: [], stopped: 0,
      counted: [0], hits: [], tags: [], proofs: [], sim: 0, simNames: [], tgN: 0, also: [], top: a, images: v.cover ? [v.cover] : [], sellers: [{ name: '@' + (v.author || ''), host: 'tiktok.com', copies: 1, p: 0 }],
      recs: [{ a, age: ageDays(v), cat: 'trial', score: 0, note: 'TikTok: ' + big(v.plays) + ' مشاهدة · ' + big(v.likes) + ' إعجاب', ev: [], raw: 0 }], refIndex: 0, note: 'من TikTok · ' + big(v.plays) + ' مشاهدة', saved_at: Date.now(), lib: v.url, link: '', excl: false, market: '', markets: [], source: 'tiktok' };
    await X.api('PUT', '/saved', { k, snap }); X.api('POST', '/img/keep', { urls: snap.images }).catch(() => {});
  }
  async function onClick(ev) {
    const tq = ev.target.closest('[data-tq]'); if (tq) { const q = tq.dataset.tq, i = P.sel.indexOf(q); i >= 0 ? P.sel.splice(i, 1) : P.sel.push(q); saveP(); return drawHome(); }
    const b = ev.target.closest('[data-t]'); if (!b) return;
    const a = b.dataset.t, id = b.dataset.id, vid = id && CUR ? CUR.items.find(v => v.id === id) : null;
    if (a === 'go') return start();
    if (a === 'stop') return W.WPRJOB.stop();
    if (a === 'skip') return W.WPRJOB.skip();
    if (a === 'add') { const v = $('#t-new').value.trim(); if (!v) return; PH = (await X.api('PUT', '/tt/phrases', { phrases: PH.concat([v]) })).phrases; P.sel.push(v); saveP(); return drawHome(); }
    if (a === 'delsel') { PH = (await X.api('PUT', '/tt/phrases', { phrases: PH.filter(q => !P.sel.includes(q)) })).phrases; P.sel = []; saveP(); return drawHome(); }
    if (a === 'selnone') { P.sel = []; saveP(); return drawHome(); }
    if (a === 'open') { X.url('/tiktok/' + id); CUR = null; return redraw(); }
    if (a === 'back') { X.url('/tiktok'); RUNS = null; return redraw(); }
    if (a === 'del') { if (b.dataset.s !== '1') { b.dataset.s = '1'; b.textContent = 'تأكيد؟'; return; } await X.api('DELETE', '/tt/' + id); RUNS = null; return redraw(); }
    if (a === 'save' && vid) { await saveVideo(vid); b.textContent = '★ محفوظ'; return X.toast('حُفظ في «المنتجات المحفوظة»: من هناك ابحث عن مورّده أو حلّله أو افحصه في الجزائر'); }
    if (a === 'fb' && vid) { localStorage.setItem('wpr_collect_quick', titleOf(vid)); X.show('collect'); return X.toast('اكتب كلمة البحث بلغة السوق في «بحث سريع». وصف الفيديو: ' + titleOf(vid).slice(0, 60)); }
    if (a === 'selall') { $$('[data-tsel]').slice(0, 20).forEach(c => { c.checked = true; }); return; }
    if (a === 'savesel') { const ids = $$('[data-tsel]:checked').map(c => c.dataset.tsel); if (!ids.length) return X.toast('اختر فيديوهات أولاً', 'err'); for (const i of ids) await saveVideo(CUR.items.find(v => v.id === i)); return X.toast('حُفظ ' + num(ids.length) + ' منتجاً في «المحفوظات»'); }
  }
  function onChange(ev) { const p = ev.target.closest('[data-tp]'); if (!p) return; P[p.dataset.tp] = p.type === 'checkbox' ? p.checked : p.type === 'number' ? +p.value : p.value; saveP(); if (CUR && p.dataset.tp !== 'per') drawRun(CUR.id); }
  W.WPRTT = {
    init(ctx) {
      X = ctx; if (inited) return; inited = true;
      W.WPRJOB && W.WPRJOB.register('tt', H);
      X.root.addEventListener('click', ev => { if (X.cur() !== VIEW) return; const pr = Promise.resolve().then(() => onClick(ev)); W.__btnBusy && W.__btnBusy(ev, pr); pr.catch(x => { if (x && x.message !== 'auth') X.toast(x.message || 'حدث خطأ', 'err'); }); });
      X.root.addEventListener('change', ev => { if (X.cur() === VIEW) onChange(ev); });
    },
    render() { PH = null; RUNS = null; redraw(); }
  };
})();
