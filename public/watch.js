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
  async function drawList() {
    const root = $('#x-watch');
    if (!LIST) { root.innerHTML = '<div class="card"><p class="sub">جارٍ التحميل…</p></div>'; LIST = (await X.api('GET', '/watch')).pages; }
    const due = LIST.filter(w => w.due);
    root.innerHTML = `<div id="w-live"></div>
<div class="card"><h2>أضف صفحة منافس</h2><p class="sub">من أي بطاقة منتج: افتح «البائعون» واضغط «👁 راقب». أو الصق هنا رابط مكتبة الإعلانات للصفحة (فيه <code>view_all_page_id</code>) أو معرّف الصفحة.</p>
<div class="l-add" style="max-width:640px"><input id="w-new" dir="ltr" placeholder="https://www.facebook.com/ads/library/?view_all_page_id=123456789…"><button class="btn" data-w="add">إضافة</button></div></div>
${due.length ? `<div class="alert info" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:14px"><span style="flex:1">🔁 ${num(due.length)} صفحة مستحقة لإعادة الفحص الأسبوعية</span><button class="btn sm" data-w="rundue">افحصها تباعاً</button></div>` : ''}
<div class="card pad0" style="margin-top:14px;padding:4px 18px">${LIST.map(w => `<div class="row"><div class="grow"><b>${e(w.name)}</b> ${w.seen_new ? `<span class="pill warn">🆕 ${num(w.seen_new)} جديد</span>` : ''}${w.due ? '<span class="pill">🔁 مستحق</span>' : ''}
<div class="muted">${w.last_scan_at ? 'آخر فحص ' + X.ago(w.last_scan_at) + ' · ' + num(w.stats.active) + ' نشط من ' + num(w.stats.total) + (w.stats.first ? '' : ' · آخر فحص: ' + num(w.stats.new) + ' جديد، ' + num(w.stats.stopped) + ' توقف') : 'لم تُفحص بعد'} · <span dir="ltr">${e(w.page_id)}</span></div></div>
<div class="ac"><button class="btn sm" data-w="open" data-id="${w.id}">فتح</button><button class="btn ghost sm" data-w="scan" data-id="${w.id}">${w.last_scan_at ? '🔁 افحص الآن' : '👁 الفحص الأول'}</button><button class="btn danger sm" data-w="del" data-id="${w.id}">حذف</button></div></div>`).join('') || '<p class="sub" style="padding:14px 0">لا صفحات مراقبة بعد.</p>'}</div>`;
    drawLive();
  }
  const adCard = a => `<div class="g-m"><a href="${e(a.library_url)}" target="_blank" rel="noopener"><img loading="lazy" src="${e(img(a.image_url))}" alt=""></a><div>
<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">${a._new ? '<span class="pill warn">🆕 جديد</span>' : ''}<span class="pill ${a._active ? 'ok' : ''}">${a._active ? 'نشط' : 'متوقف'}</span>${a.start_date ? `<small>بدأ ${e(a.start_date)}${a.days_running !== '' ? ' · ' + num(a.days_running) + ' يوماً' : ''}</small>` : ''}${a.duplicates > 1 ? `<small>· ${num(a.duplicates)} نسخ</small>` : ''}</div>
<div class="tx" dir="auto" style="font-size:13.5px;max-height:4.6em;overflow:hidden">${e((a.title ? a.title + ' — ' : '') + (a.body || ''))}</div>
<div style="display:flex;gap:6px;margin-top:6px"><a class="btn ghost sm" href="${e(a.library_url)}" target="_blank" rel="noopener">الإعلان ↗</a>${a.link_url ? `<a class="btn ghost sm" href="${e(a.link_url)}" target="_blank" rel="noopener">المتجر ↗</a>` : ''}</div></div></div>`;
  async function drawPage(id) {
    const root = $('#x-watch');
    if (!CUR || CUR.id !== +id) { root.innerHTML = '<div class="card"><p class="sub">جارٍ التحميل…</p></div>'; CUR = await X.api('GET', '/watch/' + id); badge(); }
    const w = CUR, nw = w.ads.filter(a => a._new), act = w.ads.filter(a => a._active && !a._new), off = w.ads.filter(a => !a._active && !a._new);
    root.innerHTML = `<p><button class="btn ghost sm" data-w="back">→ كل الصفحات</button></p><div id="w-live"></div>
<div class="card"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><h2 style="margin:0;flex:1">${e(w.name)}</h2><button class="btn" data-w="scan" data-id="${w.id}">🔁 افحص الآن</button><button class="btn ghost" data-w="analyze">📊 حلّل إعلاناتها النشطة</button><a class="btn ghost" href="${e(pageUrl(w.page_id))}" target="_blank" rel="noopener">مكتبة الإعلانات ↗</a></div>
<div class="g-nums"><div><b>${num(nw.length)}</b><span>جديد منذ الفحص السابق</span></div><div><b>${num(w.ads.filter(a => a._active).length)}</b><span>نشط الآن</span></div><div><b>${num(off.length)}</b><span>متوقف</span></div><div><b>${num(w.ads.length)}</b><span>كل ما رأيناه</span></div></div>
<p class="sub">${w.last_scan_at ? 'آخر فحص ' + X.ago(w.last_scan_at) + ' · الفحص القادم ' + X.fd(w.next_check_at) : 'لم تُفحص بعد'}. «جديد» = إعلان ظهر أول مرة في آخر فحص: غالباً منتج جديد يختبره المنافس.</p></div>
${nw.length ? `<div class="card" style="margin-top:14px"><h2>🆕 إعلانات جديدة</h2>${nw.map(adCard).join('')}</div>` : ''}
<div class="card" style="margin-top:14px"><h2>النشط الآن <small>(${num(act.length)})</small></h2>${act.slice(0, 200).map(adCard).join('') || '<p class="sub">—</p>'}</div>
${off.length ? `<details class="fx" style="margin-top:14px"><summary>متوقف (${num(off.length)})</summary>${off.slice(0, 200).map(adCard).join('')}</details>` : ''}`;
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
