/* قسم «👁 مراقبة المنافسين»: صفحات فيسبوك تتابعها. الإضافة تجمع كل إعلانات الصفحة من مكتبة ميتا، والمنصة تقارن بالفحص السابق:
   إعلانات جديدة (منتجات جديدة يختبرها المنافس)، إعلانات توقفت، والنشط الآن. يُعاد الفحص أسبوعياً. يعمل مع app.html عبر WPRWATCH. */
(function () {
  'use strict';
  const W = window; let X = null, LIST = null, CUR = null, inited = false;
  const $ = s => X.root.querySelector(s);
  const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => Number(n || 0).toLocaleString((window.__LOC||'ar-DZ'));
  const img = u => (u ? '/api/img?u=' + encodeURIComponent(u) : '');
  const VIEW = 'watch', QK = 'wpr_watch_queue_v1';
  const ls = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (x) { return null; } };
  const LIVE = { id: 0, scanned: 0, added: 0 };
  const pageUrl = pid => 'https://www.facebook.com/ads/library/?' + new URLSearchParams({ active_status: 'all', ad_type: 'all', country: 'ALL', is_targeted_country: 'false', media_type: 'all', search_type: 'page', view_all_page_id: pid }).toString();

  /* ---------- الفحص عبر الإضافة ---------- */
  async function scan(w) {
    const { scan: sid } = await X.api('POST', '/watch/' + w.id + '/scan', {});
    await W.WPRJOB.start('watch', [{ q: 'page:' + w.page_id, url: pageUrl(w.page_id) }], { id: w.id, scan: sid, name: w.name }, { maxAds: 1000, activeOnly: false }, '👁 مراقبة: ' + w.name);
    Object.assign(LIVE, { id: w.id, scanned: 0, added: 0 });
    X.toast('فُتحت مكتبة الإعلانات على صفحة «' + w.name + '». اتركها ظاهرة حتى ينتهي الفحص.'); redraw();
  }
  const H = {
    async ads(ev, ctx) {
      W.__busy && W.__busy('wt', 'جارٍ مقارنة إعلانات الصفحة بالفحص السابق…');
      try { const r = await X.api('POST', '/watch/' + ctx.id + '/ingest', { scan: ctx.scan, ads: ev.ads }); Object.assign(LIVE, { id: ctx.id, scanned: r.scanned, added: LIVE.added + r.added }); }
      finally { W.__busy && W.__busy('wt'); }
      drawLive();
    },
    event() { drawLive(); },
    async done(ev, ctx, items) {
      const complete = (items[0] && items[0].status === 'done') || false;
      const r = await X.api('POST', '/watch/' + ctx.id + '/finish', { scan: ctx.scan, complete });
      LIVE.id = 0; LIST = null; if (CUR && CUR.id === ctx.id) CUR = null;
      const s = r.stats || {};
      X.toast(s.first ? 'اكتمل الفحص الأول: ' + num(s.total) + ' إعلاناً (' + num(s.active) + ' نشطاً). الفحوص القادمة تكشف الجديد.' : '«' + ctx.name + '»: ' + num(s.new) + ' إعلان جديد · ' + num(s.stopped) + ' توقف');
      badge();
      const q = ls(QK) || []; if (q.length) { const n = q.shift(); ls(QK, q); setTimeout(() => runQueued(n), 4000); }
      redraw();
    }
  };
  async function runQueued(id) { try { const w = (LIST || (await X.api('GET', '/watch')).pages).find(x => x.id === id); if (w) await scan(w); } catch (x) { X.toast(x.message, 'err'); } }

  /* ---------- الرسم ---------- */
  function drawLive() { const el = $('#w-live'); if (!el || X.cur() !== VIEW) return; const j = W.WPRJOB.cur(); el.innerHTML = j && j.mod === 'watch' ? `<div class="alert info">⏳ يفحص الآن «${e(j.ctx.name)}»: ${num(LIVE.scanned)} إعلاناً حتى الآن · ${num(LIVE.added)} لم تكن معروفة <button class="btn ghost sm" data-w="stop">إيقاف</button></div>` : ''; }
  const st = document.createElement('style');
  st.textContent = `.wt-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;margin-top:14px}
.wt-c{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:10px}.wt-c.nw{border-color:var(--brand);box-shadow:0 0 0 3px var(--soft)}
.wt-h{display:flex;gap:8px;align-items:center}.wt-h b{flex:1;font-size:16px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wt-n{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.wt-n div{background:var(--card2);border-radius:12px;padding:8px 6px;text-align:center}.wt-n b{display:block;font-size:20px;line-height:1.3}.wt-n span{font-size:12px;color:var(--mut)}
.wt-n .up b{color:var(--brand)}.wt-n .dn b{color:var(--bad)}.wt-s{font-size:13px;color:var(--mut);line-height:1.7}.wt-a{display:flex;gap:6px;flex-wrap:wrap}
.wt-k{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px}@media(max-width:700px){.wt-k{grid-template-columns:repeat(2,1fr)}}.wt-k div{background:var(--card2);border-radius:12px;padding:10px;text-align:center}.wt-k b{display:block;font-size:24px}.wt-k span{font-size:12.5px;color:var(--mut)}.wt-k .up b{color:var(--brand)}.wt-k .dn b{color:var(--bad)}
.wt-tl{display:flex;flex-direction:column}.wt-r{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)}.wt-r:last-child{border:0}
.wt-r .no{width:34px;height:34px;border-radius:50%;background:var(--soft);color:var(--brand-h);display:grid;place-items:center;font-weight:700;font-size:13px}.wt-r.f .no{background:var(--card2);color:var(--mut)}
.wt-r .tx b{display:block;font-size:14px}.wt-r .tx span{font-size:13px;color:var(--mut)}.wt-ch{display:flex;gap:6px;flex-wrap:wrap}.wt-ch i{font-style:normal;border-radius:99px;padding:2px 9px;font-size:12.5px;font-weight:700}
.wt-ch .up{background:#dcfce7;color:#166534}.wt-ch .dn{background:#fee2e2;color:#991b1b}.wt-ch .ac{background:var(--card2);color:var(--mut)}
@media(prefers-color-scheme:dark){.wt-ch .up{background:#14532d;color:#bbf7d0}.wt-ch .dn{background:#7f1d1d;color:#fecaca}}
.wt-f{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}.wt-f button{border:1px solid var(--line);background:var(--card);border-radius:99px;padding:6px 13px;font:inherit;font-size:13px;cursor:pointer}.wt-f button.on{background:var(--brand);border-color:var(--brand);color:#fff}`;
  document.head.appendChild(st);
  let FLT = 'new';
  const scanLine = w => {
    const s = w.stats || {};
    if (!w.last_scan_at) return 'لم تُفحص بعد: اضغط «الفحص الأول» لتسجيل إعلاناتها الحالية كنقطة بداية.';
    return (s.first ? 'الفحص الأول (نقطة البداية) ' + X.ago(w.last_scan_at) + ': سُجّل ' + num(s.total) + ' إعلاناً. الفحص التالي يكشف الجديد والمتوقف.'
      : 'آخر فحص ' + X.ago(w.last_scan_at) + ': ' + num(s.new) + ' جديد، ' + num(s.stopped) + ' توقف.') + ' الفحص القادم ' + X.fd(w.next_check_at) + '.';
  };
  async function drawList() {
    const root = $('#x-watch');
    if (!LIST) { root.innerHTML = '<div class="card"><p class="sub">جارٍ التحميل…</p></div>'; LIST = (await X.api('GET', '/watch')).pages; }
    const due = LIST.filter(w => w.due);
    root.innerHTML = `<div id="w-live"></div>
<div class="card"><h2>أضف صفحة منافس</h2><p class="sub">من أي بطاقة منتج: افتح «البائعون» واضغط «👁 راقب». أو الصق هنا رابط مكتبة الإعلانات للصفحة (فيه <code>view_all_page_id</code>) أو معرّف الصفحة.</p>
<div class="l-add" style="max-width:640px"><input id="w-new" dir="ltr" placeholder="https://www.facebook.com/ads/library/?view_all_page_id=123456789…"><button class="btn" data-w="add">إضافة</button></div>
<p class="sub" style="margin:10px 0 0">كيف تعمل: <b>الفحص الأول</b> يسجّل كل إعلانات الصفحة الحالية كنقطة بداية. ثم كل فحص بعده (أسبوعياً) يقارن بما قبله: <b>جديد</b> = إعلان لم يكن موجوداً (غالباً منتج يختبره المنافس الآن)، و<b>توقف</b> = إعلان أوقفه.</p></div>
${due.length ? `<div class="alert info" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:14px"><span style="flex:1">🔁 ${num(due.length)} صفحة مستحقة لإعادة الفحص الأسبوعية</span><button class="btn sm" data-w="rundue">افحصها تباعاً</button></div>` : ''}
${LIST.length ? `<div class="wt-g">${LIST.map(w => { const s = w.stats || {}, sc = !!w.last_scan_at, fst = sc && s.first; return `<div class="wt-c${w.seen_new ? ' nw' : ''}">
<div class="wt-h"><b title="${e(w.name)}">${e(w.name)}</b>${w.seen_new ? `<span class="pill ok">${num(w.seen_new)} جديد لم تره</span>` : ''}${w.due ? '<span class="pill warn">مستحق</span>' : ''}${!sc ? '<span class="pill">لم تُفحص</span>' : ''}</div>
<div class="wt-n"><div><b>${sc ? num(s.active) : '—'}</b><span>نشط الآن</span></div><div class="up"><b dir="ltr">${sc && !fst ? '+' + num(s.new) : '—'}</b><span>جديد في آخر فحص</span></div><div class="dn"><b>${sc && !fst ? num(s.stopped) : '—'}</b><span>توقف في آخر فحص</span></div></div>
<div class="wt-s">${scanLine(w)}</div>
<div class="wt-a"><button class="btn sm" data-w="open" data-id="${w.id}">التفاصيل والسجل</button><button class="btn ghost sm" data-w="scan" data-id="${w.id}">${sc ? '🔁 افحص الآن' : '👁 الفحص الأول'}</button><button class="btn danger sm" data-w="del" data-id="${w.id}">حذف</button></div></div>`; }).join('')}</div>` : '<div class="card" style="margin-top:14px"><p class="sub">لا صفحات مراقبة بعد.</p></div>'}`;
    drawLive();
  }
  const adCard = a => `<div class="g-m"><a href="${e(a.library_url)}" target="_blank" rel="noopener"><img loading="lazy" src="${e(img(a.image_url))}" alt=""></a><div>
<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">${a._new ? '<span class="pill ok">جديد في آخر فحص</span>' : ''}<span class="pill ${a._active ? 'ok' : 'bad'}">${a._active ? 'نشط' : 'متوقف'}</span><small>ظهر في الفحص ${num(a._scan)}${a._scan === 1 ? ' (نقطة البداية)' : ''}${a._gone ? ' · توقف في الفحص ' + num(a._gone) : ''}</small>${a.start_date ? `<small>· بدأ ${e(a.start_date)}${a.days_running !== '' ? ' (' + num(a.days_running) + ' يوماً)' : ''}</small>` : ''}${a.duplicates > 1 ? `<small>· ${num(a.duplicates)} نسخ</small>` : ''}</div>
<div class="tx" dir="auto" style="font-size:13.5px;max-height:4.6em;overflow:hidden">${e((a.title ? a.title + ' — ' : '') + (a.body || ''))}</div>
<div style="display:flex;gap:6px;margin-top:6px"><a class="btn ghost sm" href="${e(a.library_url)}" target="_blank" rel="noopener">الإعلان ↗</a>${a.link_url ? `<a class="btn ghost sm" href="${e(a.link_url)}" target="_blank" rel="noopener">المتجر ↗</a>` : ''}</div></div></div>`;
  async function drawPage(id) {
    const root = $('#x-watch');
    if (!CUR || CUR.id !== +id) { root.innerHTML = '<div class="card"><p class="sub">جارٍ التحميل…</p></div>'; CUR = await X.api('GET', '/watch/' + id); badge(); FLT = 'new'; }
    const w = CUR, sc = w.scans || [], last = sc[sc.length - 1], nw = w.ads.filter(a => a._new), on = w.ads.filter(a => a._active), off = w.ads.filter(a => !a._active);
    if (FLT === 'new' && !nw.length) FLT = 'on';
    const m = /^s(\d+)(n|g)$/.exec(FLT), list = m ? w.ads.filter(a => m[2] === 'n' ? a._scan === +m[1] : a._gone === +m[1]) : FLT === 'new' ? nw : FLT === 'on' ? on : FLT === 'off' ? off : w.ads;
    const tl = sc.slice().reverse().map(x => `<div class="wt-r${x.first ? ' f' : ''}"><span class="no">${num(x.n)}</span><div class="tx"><b>${x.first ? 'الفحص الأول: نقطة البداية' : 'الفحص ' + num(x.n)} · ${e(X.fd(x.at))}</b>
<span>${x.first ? 'سُجّل ' + num(x.found != null ? x.found : x.total) + ' إعلاناً كانت موجودة قبل بدء المراقبة (لا نعدّها جديدة لأننا لا نعرف متى ظهرت).' : `<span class="wt-ch"><i class="up"><bdi dir="ltr">+${num(x.new)}</bdi> جديد</i><i class="dn">${num(x.stopped)} توقف</i>${x.active != null ? `<i class="ac">${num(x.active)} نشط</i>` : ''}</span>${x.complete ? '' : ' فحص غير مكتمل: لا يُحسب المتوقف.'}`}</span></div>
<div class="wt-a">${(x.first ? x.found || x.total : x.new) ? `<button class="btn ghost sm" data-w="flt" data-f="s${x.n}n">${x.first ? 'اعرضها' : 'الجديد'}</button>` : ''}${x.stopped ? `<button class="btn ghost sm" data-w="flt" data-f="s${x.n}g">المتوقف</button>` : ''}</div></div>`).join('');
    const F = [['new', 'الجديد في آخر فحص', nw.length], ['on', 'نشط الآن', on.length], ['off', 'متوقف', off.length], ['all', 'الكل', w.ads.length]];
    const title = m ? (m[2] === 'n' ? (+m[1] === 1 ? 'إعلانات الفحص الأول' : 'الجديد في الفحص ' + num(m[1])) : 'ما توقف في الفحص ' + num(m[1])) : '';
    root.innerHTML = `<p><button class="btn ghost sm" data-w="back">→ كل الصفحات</button></p><div id="w-live"></div>
<div class="card"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><h2 style="margin:0;flex:1">${e(w.name)} <small class="muted" dir="ltr" style="font-weight:400;font-size:12px">${e(w.page_id)}</small></h2><button class="btn" data-w="scan" data-id="${w.id}">${w.last_scan_at ? '🔁 افحص الآن' : '👁 الفحص الأول'}</button><button class="btn ghost" data-w="analyze">📊 حلّل إعلاناتها النشطة</button><a class="btn ghost" href="${e(pageUrl(w.page_id))}" target="_blank" rel="noopener">مكتبة الإعلانات ↗</a></div>
<div class="wt-k"><div><b>${num(on.length)}</b><span>نشط الآن</span></div><div class="up"><b dir="ltr">${sc.length > 1 ? '+' + num(nw.length) : '—'}</b><span>جديد في آخر فحص</span></div><div class="dn"><b>${sc.length > 1 && last ? num(last.stopped) : '—'}</b><span>توقف في آخر فحص</span></div><div><b>${num(sc.length)}</b><span>عدد الفحوص</span></div></div>
<p class="sub" style="margin:10px 0 0">${scanLine(w)}</p></div>
${sc.length ? `<div class="card" style="margin-top:14px"><h2>سجل الفحوص</h2><div class="wt-tl">${tl}</div>${sc.length === 1 ? '<p class="sub" style="margin:8px 0 0">بعد الفحص التالي سترى هنا ما أضافه المنافس وما أوقفه.</p>' : ''}</div>` : ''}
${w.ads.length ? `<div class="card" style="margin-top:14px"><h2>${title ? e(title) + ` <small>(${num(list.length)})</small>` : 'الإعلانات'}</h2>
<div class="wt-f">${F.filter(f => f[0] !== 'new' || sc.length > 1).map(f => `<button data-w="flt" data-f="${f[0]}" class="${FLT === f[0] ? 'on' : ''}">${f[1]} (${num(f[2])})</button>`).join('')}</div>
${list.slice(0, 200).map(adCard).join('') || '<p class="sub">لا إعلانات هنا.</p>'}</div>` : ''}`;
    drawLive();
  }
  function redraw() {
    if (!X || X.cur() !== VIEW) return;
    const id = (location.pathname.split('/')[2] || '').replace(/\D/g, '');
    (id ? drawPage(id) : drawList()).catch(x => { if (x.message !== 'auth') X.toast(x.message, 'err'); });
  }
  async function badge() { try { const r = await X.api('GET', '/watch'), b = X.root.querySelector('#nb-watch'), n = r.unseen + r.due; if (b) { b.hidden = !n; b.textContent = n; } } catch (x) {} }

  async function onClick(ev) {
    const b = ev.target.closest('[data-w]'); if (!b) return;
    const a = b.dataset.w, id = +b.dataset.id;
    if (a === 'add') { const v = $('#w-new').value.trim(); if (!v) return; const r = await X.api('POST', '/watch', { url: v }); X.toast(r.existed ? 'موجودة من قبل' : 'أُضيفت. اضغط «الفحص الأول».'); LIST = null; return redraw(); }
    if (a === 'open') { X.url('/watch/' + id); CUR = null; return redraw(); }
    if (a === 'flt') { FLT = b.dataset.f; await drawPage(CUR.id); const c = X.root.querySelector('.wt-f'); if (c && b.closest('.wt-r')) c.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    if (a === 'back') { X.url('/watch'); LIST = null; return redraw(); }
    if (a === 'scan') { const w = (LIST || []).find(x => x.id === id) || CUR; return scan(w); }
    if (a === 'stop') return W.WPRJOB.stop();
    if (a === 'del') { if (b.dataset.s !== '1') { b.dataset.s = '1'; b.textContent = 'تأكيد؟'; return; } await X.api('DELETE', '/watch/' + id); LIST = null; CUR = null; return redraw(); }
    if (a === 'rundue') { const ids = LIST.filter(w => w.due).map(w => w.id); ls(QK, ids.slice(1)); return runQueued(ids[0]); }
    if (a === 'analyze') { const rows = CUR.ads.filter(x => x._active); if (!rows.length) return X.toast('لا إعلانات نشطة', 'err'); X.show('analyze'); await W.WPR.load([{ rows, name: 'مراقبة: ' + CUR.name + '.json', lastModified: Date.now() }]); }
  }
  W.WPRWATCH = {
    init(ctx) {
      X = ctx; if (inited) return; inited = true;
      W.WPRJOB && W.WPRJOB.register('watch', H);
      X.root.addEventListener('click', ev => { if (X.cur() !== VIEW) return; const pr = Promise.resolve().then(() => onClick(ev)); W.__btnBusy && W.__btnBusy(ev, pr); pr.catch(x => { if (x && x.message !== 'auth') X.toast(x.message || 'حدث خطأ', 'err'); }); });
      badge();
    },
    render() { LIST = null; CUR = null; redraw(); }
  };
})();
