/* قسم «جمع الإعلانات» داخل المنصة: الجمع عبر الإضافة، القاموس (كلمات البحث)، تثبيت الإضافة. تذهب الإعلانات المجموعة إلى «الإعلانات الواردة» ويتم تحليلها هناك.
   يعمل مع app.html عبر WPRLIB.init(ctx) و WPRLIB.render(). */
(function () {
  'use strict';
  const W = window;
  let X = null;                              // سياق المنصة: api, toast, e, fd, ago, root, me, cur, url, refresh
  const $ = s => X.root.querySelector(s), $$ = s => [...X.root.querySelectorAll(s)];
  const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => Number(n || 0).toLocaleString((window.__LOC||'ar-DZ'));
  const VIEW = 'collect';

  /* ---------- الأنماط ---------- */
  const st = document.createElement('style');
  st.textContent = `
.lt{display:flex;gap:6px;overflow-x:auto;margin:0 0 18px;padding:2px;scrollbar-width:none}.lt::-webkit-scrollbar{display:none}
.lt button{display:flex;align-items:center;gap:7px;border:1px solid var(--line);background:var(--card);color:var(--mut);border-radius:99px;padding:8px 16px;font:inherit;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap;transition:.15s}
.lt button:hover{color:var(--ink);border-color:var(--brand)}.lt button.on{background:linear-gradient(135deg,var(--brand),#0a7040);border-color:transparent;color:#fff}
.l-st{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:14px}.l-st .grow{flex:1;min-width:200px}
.l-dot{width:10px;height:10px;border-radius:50%;background:var(--bad);flex:none}.l-dot.ok{background:var(--ok)}.l-dot.warn{background:var(--warn)}
.l-g3{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;align-items:end}
.l-chips{display:flex;flex-wrap:wrap;gap:6px;max-height:210px;overflow:auto;padding:2px}
.lc{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:99px;padding:3px 12px;font:inherit;font-size:13px;cursor:pointer;transition:.12s;display:inline-flex;gap:6px;align-items:center}
.lc:hover{border-color:var(--brand)}.lc.on{background:var(--brand);border-color:var(--brand);color:#fff}.lc.off{opacity:.45;text-decoration:line-through}.lc.custom{border-style:dashed;border-color:var(--brand)}.lc i{font-style:normal;opacity:.7}
.l-sub{margin:12px 0 6px;font-size:13px;font-weight:600;color:var(--mut)}
.l-q{max-height:150px;overflow:auto;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:8px 12px;font-size:13px;display:flex;flex-wrap:wrap;gap:4px 14px}
.l-bi{display:flex;gap:10px;align-items:center;padding:7px 4px;border-bottom:1px solid var(--line);font-size:13.5px}.l-bi:last-child{border:0}.l-bi .q{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.l-bar{height:8px;border-radius:99px;background:var(--line);overflow:hidden}.l-bar i{display:block;height:100%;background:linear-gradient(90deg,#118553,#35ac74);transition:width .3s}.l-bar.hot i{background:linear-gradient(90deg,#f59e0b,#dc2626)}
.l-nums{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin:12px 0}.l-nums div{background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:8px 10px;text-align:center}.l-nums b{display:block;font-size:22px;line-height:1.3}.l-nums span{font-size:12px;color:var(--mut)}
.l-ck{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:10px;font-size:13.5px}.l-ck label{display:flex;gap:6px;align-items:center;cursor:pointer}
.l-steps li{margin:6px 0}.l-steps code{direction:ltr;display:inline-block;background:var(--card2);border:1px solid var(--line);border-radius:6px;padding:0 6px}
.l-add{display:flex;gap:6px;margin-top:8px}.l-add input{max-width:260px}
.wtip{position:fixed;top:0;left:0;z-index:300;transform:translate(-50%,calc(-100% - 6px)) scale(.96);background:#111827;color:#fff;padding:5px 11px;border-radius:9px;font-size:12.5px;line-height:1.5;max-width:280px;text-align:center;opacity:0;pointer-events:none;transition:opacity .14s ease,transform .14s ease;box-shadow:0 6px 18px rgba(0,0,0,.2)}.wtip.on{opacity:1;transform:translate(-50%,calc(-100% - 6px)) scale(1)}
.lc[data-tip]{text-decoration:underline dotted rgba(127,127,127,.55);text-underline-offset:4px}.l-q span[data-tip]{cursor:help}
.lc .x{font-style:normal;margin-inline-start:4px;opacity:.6}
.l-nic{border:1px solid var(--line);border-radius:14px;padding:4px 14px;margin:8px 0;background:var(--card)}.l-nic summary{cursor:pointer;padding:9px 0;font-weight:600;display:flex;gap:8px;align-items:center}`;
  document.head.appendChild(st);

  /* ---------- التفضيلات ---------- */
  const PK = 'wpr_collect_prefs_v1';
  const P = Object.assign({ tab: 'collect', country: 'DZ', status: 'active', media: 'all', lang: '', type: 'keyword_unordered', speed: 'normal', maxAds: 150, wait: 20,
    alone: false, mode: 'combo', filter: true, selG: {}, selC: {}, q: '' }, (() => { try { return JSON.parse(localStorage.getItem(PK)) || {}; } catch (x) { return {}; } })());
  const saveP = () => { try { localStorage.setItem(PK, JSON.stringify(P)); } catch (x) {} };
  let STATS = null, DICT = null, DMODE = 'user';

  /* ---------- الإضافة (المتصفح) ---------- */
  const B = { ok: false, version: '', state: null, n: 0, wait: new Map() };
  const RUN = { added: 0, updated: 0, rejected: 0, filtered: 0, byKind: {}, samples: [], quota: false, run: 0, active: false, batch: '' };
  const vlt = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0; } return false; };
  function bsend(cmd, payload, ms) {
    return new Promise((res, rej) => {
      const id = 'p' + (++B.n), t = setTimeout(() => { B.wait.delete(id); rej(new Error('timeout')); }, ms || 3000);
      B.wait.set(id, v => { clearTimeout(t); res(v); });
      W.postMessage(Object.assign({ tag: 'WPR_PAGE', id, cmd }, payload || {}), location.origin);
    });
  }
  let chain = Promise.resolve(); const inflight = new Set();
  const running = () => !!(B.state && B.state.active);
  // الإعلانات التي يجمعها فحص «ثغرات السوق» تذهب لذلك القسم لا إلى «الواردة»
  const GAP = () => (W.WPRGAP && W.WPRGAP.ready ? W.WPRGAP : null);
  /* ---------- مهام الأقسام الأخرى (المورّد، مراقبة المنافسين، TikTok): كل قسم يسجّل معالجه، والمهمة الجارية تُحفظ فتصمد بعد إعادة التحميل ---------- */
  const JK = 'wpr_job_v1', MODS = {};
  let JOB = (() => { try { return JSON.parse(localStorage.getItem(JK)); } catch (x) { return null; } })();
  const saveJob = j => { JOB = j; try { j ? localStorage.setItem(JK, JSON.stringify(j)) : localStorage.removeItem(JK); } catch (x) {} };
  const jobOwns = id => !!(JOB && id && id === JOB.batch && MODS[JOB.mod]);
  W.WPRJOB = {
    register(name, h) { MODS[name] = h; },
    cur: () => JOB,
    // يبدأ مهمة في الإضافة باسم القسم وسياقه. items: [{q, url}]
    async start(mod, items, ctx, settings, label) {
      if (!B.ok) throw new Error('الإضافة غير متصلة. ثبّتها من «جمع الإعلانات ← الإضافة» ثم أعد تحميل الصفحة.');
      if (vlt(B.version, '1.3.0') && items.some(i => !/facebook\.com/.test(i.url))) throw new Error('هذه الميزة تحتاج الإضافة 1.3.0 أو أحدث: نزّلها من «جمع الإعلانات ← الإضافة» واستبدل القديمة.');
      try { const r = await bsend('ping', {}, 2500); if (r && r.state) B.state = r.state; } catch (x) {}   // حالة الإضافة الفعلية لا آخر حدث وصل
      if (running()) throw new Error('هناك عملية جمع تعمل الآن. انتظر انتهاءها.');
      if (!STATS) await loadStats();
      await api('POST', '/lib/batch', { count: items.length });
      const r = await startQueue({ items, settings: Object.assign(settingsOut(), settings || {}), limits: STATS && STATS.limits, label: String(label || mod).slice(0, 150) }, 8000);
      if (!r.ok) throw new Error({ busy: 'هناك عملية جمع تعمل الآن', tab: 'تعذّر فتح التبويب', no_items: 'لا توجد عناصر صالحة' }[r.error] || 'تعذّر البدء');
      saveJob({ mod, batch: r.batch, ctx: ctx || {}, at: Date.now() }); return r.batch;
    },
    stop: () => bsend('stop').catch(() => {}), skip: () => bsend('skip').catch(() => {}),
    ttStatus: async () => { if (!B.ok) return null; try { const r = await bsend('tt_status', {}, 3000); return r && r.ok ? !!r.logged : null; } catch (x) { return null; } }
  };
  function onBridge(ev) {
    if (JOB && MODS[JOB.mod]) {
      const h = MODS[JOB.mod];
      if (ev.evt === 'ads' && jobOwns(ev.batchId)) {
        if (inflight.has(ev.seq)) return; inflight.add(ev.seq);
        chain = chain.then(() => h.ads(ev, JOB.ctx)).then(() => bsend('ack', { seqs: [ev.seq] }).catch(() => {}))
          .catch(x => { X && X.toast(x.message || 'خطأ', 'err'); setTimeout(() => bsend('flush').catch(() => {}), 15000); }).finally(() => inflight.delete(ev.seq));
        return;
      }
      if ((ev.evt === 'state' && ev.state && jobOwns(ev.state.id)) || (ev.evt === 'progress' && jobOwns(ev.id))) { try { h.event && h.event(ev, JOB.ctx); } catch (x) {} }
      if (ev.evt === 'done' && jobOwns(ev.id)) {
        const j = JOB;
        chain = chain.then(async () => { let st = B.state; try { const r = await bsend('ping', {}, 3000); if (r && r.state) { st = r.state; B.state = r.state; } } catch (x) {} saveJob(null); await h.done(ev, j.ctx, (st && st.id === j.batch && st.items) || []); })
          .catch(x => X && X.toast(x.message || 'خطأ', 'err'));
        return;
      }
    }
    if (GAP() && ['state', 'progress', 'done'].includes(ev.evt)) { try { GAP().event(ev); } catch (x) {} }
    if (ev.evt === 'ads' && GAP() && GAP().owns(ev)) {
      if (inflight.has(ev.seq)) return; inflight.add(ev.seq);
      chain = chain.then(() => GAP().ads(ev)).then(() => bsend('ack', { seqs: [ev.seq] }).catch(() => {}))
        .catch(() => setTimeout(() => bsend('flush').catch(() => {}), 15000)).finally(() => inflight.delete(ev.seq));
      return;
    }
    if (ev.evt === 'done' && GAP() && GAP().ownsBatch(ev.id)) return;
    if (ev.evt === 'reply') { const f = B.wait.get(ev.id); if (f) { B.wait.delete(ev.id); f(ev); } return; }
    if (ev.evt === 'hello') { B.ok = true; B.version = ev.version; B.state = ev.state; bsend('flush').catch(() => {});
      if (JOB && MODS[JOB.mod] && ev.state && !ev.state.active && ev.state.id === JOB.batch) setTimeout(() => onBridge({ evt: 'done', id: JOB.batch, reason: 'done' }), 2500);   // انتهت المهمة والصفحة مغلقة
      return redraw(); }
    if (ev.evt === 'offline') { B.ok = false; return redraw(); }
    if (ev.evt === 'state') { const was = running(); B.state = ev.state; return was !== running() ? redraw() : drawProg(); }
    if (ev.evt === 'progress') { if (B.state && B.state.items && B.state.items[ev.idx]) { B.state.items[ev.idx].seen = ev.seen; if (ev.total) B.state.items[ev.idx].total = ev.total; } return drawProg(); }
    if (ev.evt === 'search_start') { X.api('POST', '/lib/tick', {}).catch(x => { X.toast(x.message, 'err'); bsend('stop').catch(() => {}); }); return; }
    if (ev.evt === 'ads') { chain = chain.then(() => ingest(ev)); return; }
    if (ev.evt === 'error') return X.toast(ev.code === 'outbox_full' ? 'توقف الجمع: تراكمت بيانات كثيرة لم تُرسل. افتح المنصة وأرسلها ثم أعد المحاولة.' : 'خطأ في الإضافة', 'err');
    if (ev.evt === 'done') {
      chain = chain.then(() => { const p = B.state && B.state.pending; X.toast(ev.reason === 'manual' ? 'أُوقف الجمع' : 'انتهى الجمع: وصل ' + num(RUN.added) + ' إعلان جديد إلى «الإعلانات الواردة»' + (p ? ' · ' + num(p) + ' بانتظار الإرسال' : '')); X.refresh(); loadStats(); redraw(); });
      return;
    }
  }
  async function ingest(ev) {
    if (inflight.has(ev.seq)) return; inflight.add(ev.seq);
    try {
      W.__busy && W.__busy('ing', 'جارٍ إرسال الإعلانات إلى المنصة وفحصها…');
      const r = await X.api('POST', '/lib/ingest', { ads: ev.ads, batch: ev.batchId, ctx: Object.assign({ label: ev.label }, ev.ctx, { country: (ev.ctx && ev.ctx.country) || P.country }) });
      RUN.added += r.added; RUN.updated += r.updated; RUN.rejected += r.rejected; RUN.run = r.run || RUN.run;
      RUN.filtered += r.filtered || 0; for (const k in (r.byKind || {})) RUN.byKind[k] = (RUN.byKind[k] || 0) + r.byKind[k];
      (r.samples || []).forEach(x => { if (RUN.samples.length < 8) RUN.samples.push(x); });
      await bsend('ack', { seqs: [ev.seq] }).catch(() => {});
      X.refresh();
      if (r.rejected > 0 && !RUN.quota) { RUN.quota = true; X.toast('بلغت الدفعة حدّها (' + num(r.cap) + ' إعلان). ابدأ دفعة جديدة بعد تحليل هذه.', 'err'); bsend('stop').catch(() => {}); }
    } catch (x) {
      if (x.status === 402) { X.toast('انتهى الاشتراك: أُوقف الجمع', 'err'); bsend('stop').catch(() => {}); }
      else setTimeout(() => bsend('flush').catch(() => {}), x.status === 429 ? 20000 : 15000);   // تبقى في صندوق الإضافة وتُعاد لاحقاً
    } finally { inflight.delete(ev.seq); W.__busy && W.__busy('ing'); drawProg(); }
  }
  function ping() {
    if (document.hidden && B.ok) return;
    bsend('ping', null, 1800).then(r => { const was = B.ok; B.ok = true; B.version = r.version; B.state = r.state; if (!was) { bsend('flush').catch(() => {}); redraw(); } else drawProg(); })
      .catch(() => { if (B.ok) { B.ok = false; redraw(); } });
  }

  /* ---------- مساعدات الواجهة ---------- */
  const api = (...a) => X.api(...a);
  // الدول ولغاتها من lib/markets.js (نفس الملف الذي يستعمله الخادم): البحث والتصفية بلغة الدولة المختارة
  const MK = window.RadarMarkets;
  const COUNTRIES = Object.keys(MK.COUNTRIES);
  const cname = c => (MK.COUNTRIES[c] ? MK.COUNTRIES[c].name : c);
  const countryOpts = cur => Object.keys(MK.REGIONS).map(r => { const cs = COUNTRIES.filter(c => MK.COUNTRIES[c].region === r); return cs.length ? `<optgroup label="${e(MK.REGIONS[r])}">${cs.map(c => opt(c, cname(c) + ' · ' + MK.COUNTRIES[c].langs.map(l => MK.LANGS[l].native).join(' / '), cur)).join('')}</optgroup>` : ''; }).join('');
  const curLangs = () => MK.langsOf(P.country).filter(l => DICT && DICT.view.gold[l]);
  // المكمّلات: الفصحى والدارجة مع المكمّلات العربية، وكل لغة أخرى مع مكمّلاتها بلغتها
  const scriptOf = l => (l === 'dz' ? 'ar' : l);
  const curScripts = () => uniq(curLangs().map(scriptOf));
  const goldFor = sc => curLangs().filter(l => scriptOf(l) === sc);
  const MODES = { combo: 'الذهبية + المكمّلة', gold: 'الكلمة الذهبية وحدها', comp: 'الكلمة المكمّلة وحدها' };
  const opt = (v, t, cur) => `<option value="${e(v)}"${String(cur) === String(v) ? ' selected' : ''}>${e(t)}</option>`;
  const uniq = a => [...new Set(a)];
  const LGN = Object.fromEntries(Object.keys(MK.LANGS).map(l => [l, MK.LANGS[l].name])), TRN = { strong: 'قوية', normal: 'عادية', weak: 'عامة' };
  const SCN = Object.fromEntries(Object.keys(MK.LANGS).map(l => [l, l === 'ar' ? 'مكمّلات عربية' : 'مكمّلات ' + MK.LANGS[l].name]));
  const ALL_SCRIPTS = uniq(MK.ALL_LANGS.map(scriptOf));
  const sf = t => String(t).split('/')[0].trim();
  /* معنى الكلمة الأجنبية بالعربية عند التمرير: معاني جاهزة لكلمات القاموس، وللكلمات المضافة يدوياً بالذكاء الاصطناعي إن وُجد */
  const GL = new Map();
  const isForeign = t => /[^\u0600-\u06FF\s\d.,!?'"«»()\-]/.test(t);
  const tipOf = (lang, t) => { const w = sf(t); return MK.gloss(lang, w) || GL.get(lang + '|' + w.toLowerCase()) || ''; };
  const tipA = (lang, t) => { const g = tipOf(lang, t); return g ? ` data-tip="${e(g)}"` : isForeign(sf(t)) ? ` data-needtip="${e(lang)}"` : ''; };
  async function fetchGloss() {
    const by = {};
    $$('[data-needtip]').forEach(el => { const lg = el.dataset.needtip, w = sf(el.dataset.t || el.textContent); if (!GL.has(lg + '|' + w.toLowerCase())) (by[lg] = by[lg] || new Set()).add(w); });
    for (const lg of Object.keys(by)) {
      try {
        const r = await api('POST', '/lib/gloss', { lang: lg, words: [...by[lg]].slice(0, 60) });
        for (const w of by[lg]) GL.set(lg + '|' + w.toLowerCase(), (r.map || {})[w] || '');
      } catch (x) { return; }
    }
    $$('[data-needtip]').forEach(el => { const g = GL.get(el.dataset.needtip + '|' + sf(el.dataset.t || el.textContent).toLowerCase()); if (g) { el.dataset.tip = g; el.removeAttribute('data-needtip'); } });
  }
  // تلميح عائم واحد (لا يُقصّ داخل القوائم القابلة للتمرير)
  const tipEl = document.createElement('div'); tipEl.className = 'wtip'; document.body.appendChild(tipEl);
  document.addEventListener('mouseover', ev => {
    const t = ev.target.closest && ev.target.closest('[data-tip]');
    if (!t || !t.dataset.tip) { tipEl.classList.remove('on'); return; }
    tipEl.textContent = t.dataset.tip; const r = t.getBoundingClientRect();
    tipEl.style.top = r.top + 'px'; tipEl.style.left = (r.left + r.width / 2) + 'px'; tipEl.classList.add('on');   // ثابت على الشاشة: لا يطيل الصفحة بعد التنقل
  });
  document.addEventListener('scroll', () => tipEl.classList.remove('on'), true);

  const SLUG = { collect: '', dict: 'dictionary', ext: 'extension' }, TAB_OF = { dictionary: 'dict', extension: 'ext' };
  const tabPath = t => '/collect' + (SLUG[t] ? '/' + SLUG[t] : '');
  const TABS = [['collect', '📡 الجمع'], ['dict', '🔑 القاموس'], ['ext', '🧩 الإضافة']];
  function redraw() {
    if (!X || X.cur() !== VIEW) return; drawTabs();
    const f = { collect: drawCollect, dict: drawDict, ext: drawExt }[P.tab];
    f && Promise.resolve().then(() => f()).catch(x => { if (x && x.message !== 'auth') X.toast(x.message || 'حدث خطأ', 'err'); });
  }
  function drawTabs() {
    const old = B.ok && STATS && vlt(B.version, STATS.ext.min), dot = B.ok ? (old ? 'warn' : 'ok') : '';
    $('#l-tabs').innerHTML = TABS.map(([k, t]) => `<button data-lt="${k}" class="${P.tab === k ? 'on' : ''}">${t}${k === 'ext' ? `<span class="l-dot ${dot}"></span>` : ''}</button>`).join('');
  }
  const extCard = () => {
    const old = B.ok && STATS && vlt(B.version, STATS.ext.min);
    return `<div class="card"><div class="l-st"><span class="l-dot ${B.ok ? (old ? 'warn' : 'ok') : ''}"></span><div class="grow"><b>${B.ok ? (old ? 'الإضافة قديمة' : 'الإضافة متصلة') + ' <small dir="ltr" class="muted">v' + e(B.version) + '</small>' : 'الإضافة غير مكتشفة'}</b>
      <div class="muted">${B.ok ? (old ? 'حدّث الإضافة لمتابعة الجمع: نزّل النسخة الجديدة من تبويب «الإضافة» واستبدلها.' : 'جاهزة للجمع من مكتبة إعلانات ميتا. اترك تبويب فيسبوك ظاهراً أثناء الجمع.') : 'ثبّت الإضافة مرة واحدة (Chrome على الحاسوب) ثم أعد تحميل هذه الصفحة.'}</div></div>
      ${B.ok && !old ? '' : '<button class="btn sm" data-lt="ext">تثبيت الإضافة</button>'}</div>${limitsBar()}</div>`;
  };
  function limitsBar() {
    if (!STATS) return '';
    const L = STATS.limits;
    return `<div style="margin-top:6px;max-width:420px"><div class="muted">عمليات البحث اليوم: ${num(L.usedToday)} / ${num(L.maxDay)}</div><div class="l-bar${L.usedToday / L.maxDay > .85 ? ' hot' : ''}"><i style="width:${Math.min(100, Math.round(L.usedToday / L.maxDay * 100))}%"></i></div></div>`;
  }
  async function loadStats() { try { STATS = await api('GET', '/lib/stats'); } catch (x) { if (x.message === 'auth') throw x; } drawTabs(); return STATS; }

  /* ================= الجمع ================= */
  async function loadDict(force) {
    if (!DICT || force) DICT = await api('GET', '/lib/dict');
    return DICT;
  }
  const selSet = (a, k) => (a[k] = a[k] || []);
  function chipsGold(lang) {
    const v = DICT.view.gold[lang], sel = selSet(P.selG, lang);
    if (P.edit) return ['strong', 'normal'].flatMap(tr => v[tr].map(x => `<button type="button" class="lc ${x.s}" data-d="g" data-lg="${lang}" data-tr="${tr}" data-t="${e(x.t)}" data-s="${x.s}"${tipA(lang, x.t)} title="${x.s === 'off' ? 'معطّلة: اضغط للاستعادة' : x.s === 'custom' ? 'أضفتها أنت: اضغط للحذف' : 'اضغط للتعطيل'}">${e(sf(x.t))}<i class="x">${x.s === 'off' ? '↺' : '×'}</i></button>`)).join('')
      + `<div class="l-add" style="width:100%"><input dir="auto" placeholder="أضف كلمة ذهبية…" data-add data-d="g" data-lg="${lang}" data-tr="normal"><button class="btn ghost sm" data-l="dadd" data-d="g" data-lg="${lang}" data-tr="normal">إضافة</button></div>`;
    const items = v.strong.concat(v.normal).filter(x => x.s !== 'off');
    return items.map(x => `<button type="button" class="lc${sel.includes(x.t) ? ' on' : ''}" data-g="${lang}" data-t="${e(x.t)}"${tipA(lang, x.t)}>${e(sf(x.t))}${v.strong.includes(x) ? '<i>★</i>' : ''}</button>`).join('') || '<span class="muted">لا كلمات</span>';
  }
  // ثلاثة أوضاع مستقلة: الذهبية وحدها · المكمّلة وحدها · الذهبية + المكمّلة (الذهبية أولاً دائماً: «Helps your child»)
  function compChips(n, sc) {
    if (P.edit) return (n.comps[sc] || []).map(x => `<button type="button" class="lc ${x.s}" data-d="n" data-n="${e(n.id)}" data-sc="${sc}" data-t="${e(x.t)}" data-s="${x.s}"${tipA(sc, x.t)} title="${x.s === 'off' ? 'معطّلة: اضغط للاستعادة' : x.s === 'custom' ? 'أضفتها أنت: اضغط للحذف' : 'اضغط للتعطيل'}">${e(x.t)}<i class="x">${x.s === 'off' ? '↺' : '×'}</i></button>`).join('')
      + `<div class="l-add" style="width:100%"><input dir="auto" placeholder="أضف كلمة مكمّلة…" data-add data-d="n" data-n="${e(n.id)}" data-sc="${sc}"><button class="btn ghost sm" data-l="dadd" data-d="n" data-n="${e(n.id)}" data-sc="${sc}">إضافة</button></div>`;
    return (n.comps[sc] || []).filter(x => x.s !== 'off').map(x => `<button type="button" class="lc${((P.selC[n.id] || {})[sc] || []).includes(x.t) ? ' on' : ''}" data-c="${e(n.id)}" data-sc="${sc}" data-t="${e(x.t)}"${tipA(sc, x.t)}>${e(x.t)}</button>`).join('') || '<span class="muted">لا مكمّلات</span>';
  }
  function buildQueries() {
    const exact = P.type === 'keyword_exact_phrase', mode = MODES[P.mode] ? P.mode : 'combo', out = [], seen = new Set();
    const key = q => { const f = q.replace(/\s+/g, ' ').trim().toLowerCase(); return exact ? f : f.split(' ').sort().join(' '); };
    const add = (q, niche, lang, tip) => { const k = key(q); if (!k || seen.has(k)) return; seen.add(k); out.push({ q, niche, lang, tip: tip || '' }); };
    const gw = sc => w => goldFor(sc).map(lg => tipOf(lg, w)).find(Boolean) || '';
    const golds = {};
    for (const sc of curScripts()) golds[sc] = uniq(goldFor(sc).flatMap(lg => {
      const v = DICT.view.gold[lg], ok = new Set(v.strong.concat(v.normal).filter(x => x.s !== 'off').map(x => x.t));
      return (P.selG[lg] || []).filter(t => ok.has(t)).map(sf);
    }));
    if (mode === 'gold') { curScripts().forEach(sc => golds[sc].forEach(w => add(w, '', sc, gw(sc)(w)))); return out; }
    for (const n of DICT.view.niches) {
      if (n.off) continue;
      for (const sc of curScripts()) {
        const cs = ((P.selC[n.id] && P.selC[n.id][sc]) || []).filter(c => (n.comps[sc] || []).some(x => x.t === c && x.s !== 'off'));
        if (!cs.length) continue;
        if (mode === 'comp') { cs.forEach(c => add(c, n.name, sc, tipOf(sc, c))); continue; }
        for (const w of golds[sc]) for (const c of cs) { const a = gw(sc)(w), b = tipOf(sc, c); add(MK.combine(w, c, sc, exact), n.name, sc, a || b ? (a || w) + ' + ' + (b || c) : ''); }
      }
    }
    return out;
  }
  function sampleKW() {
    const lg = curLangs()[0] || 'ar', sc = scriptOf(lg), v = DICT.view.gold[lg];
    const g = sf(((v && v.strong.find(x => x.s !== 'off')) || {}).t || '');
    const n = DICT.view.niches.find(n => !n.off && (n.comps[sc] || []).some(x => x.s !== 'off'));
    return { g, c: n ? n.comps[sc].find(x => x.s !== 'off').t : '', sc };
  }
  function modeHint() {
    const { g, c, sc } = sampleKW(), m = P.mode || 'combo';
    const ex = m === 'gold' ? g : m === 'comp' ? c : MK.combine(g, c, sc, P.type === 'keyword_exact_phrase');
    return '<span>مثال:</span> <bdi translate="no" dir="auto">«' + e(ex) + '»</bdi> <span>' + (m === 'combo' ? '· الترتيب ثابت: الكلمة الذهبية أولاً ثم المكمّلة' : m === 'gold' ? '· كل كلمة ذهبية مختارة بحث مستقل' : '· كل مكمّلة مختارة بحث مستقل') + '</span>';
  }
  const quickHint = () => { const { g, c, sc } = sampleKW(); return MK.combine(g, c, sc, false); };
  function libUrl(q, lang) {
    const p = new URLSearchParams();
    p.set('active_status', P.status); p.set('ad_type', 'all'); p.set('country', P.country);
    const cl = P.lang === 'auto' ? (MK.LANGS[lang || curLangs()[0]] || {}).fb : P.lang;   // «تلقائي» = لغة الكلمة المبحوث بها
    if (cl) p.set('content_languages[0]', cl);
    p.set('is_targeted_country', 'false'); p.set('media_type', P.media); p.set('q', q); p.set('search_type', P.type);
    return 'https://www.facebook.com/ads/library/?' + p.toString();
  }
  const settingsOut = () => ({ speed: P.speed, maxAds: Math.max(1, +P.maxAds || 150), waitSeconds: Math.min(60, Math.max(8, +P.wait || 20)), activeOnly: P.status === 'active' });
  const batchLabel = items => 'جمع: ' + items.slice(0, 2).map(i => i.q).join('، ') + (items.length > 2 ? ' +' + (items.length - 2) : '');
  async function startItems(items) {
    if (!B.ok) return X.toast('الإضافة غير متصلة. ثبّتها ثم أعد تحميل الصفحة.', 'err');
    if (running()) return X.toast('هناك عملية جمع تعمل الآن', 'err');
    if (STATS && vlt(B.version, STATS.ext.min)) return X.toast('حدّث الإضافة أولاً', 'err');
    await api('POST', '/lib/batch', { count: items.length });
    RUN.added = RUN.updated = RUN.rejected = RUN.filtered = 0; RUN.byKind = {}; RUN.samples = []; RUN.quota = false; RUN.run = 0;
    const r = await startQueue({ items: items.map(i => ({ q: i.q, niche: i.niche || '', url: libUrl(i.q, i.lang) })), settings: settingsOut(), limits: STATS && STATS.limits, label: batchLabel(items) }, 8000);
    if (!r.ok) return X.toast({ busy: 'هناك عملية جمع تعمل الآن', tab: 'تعذّر فتح تبويب فيسبوك', no_items: 'لا توجد كلمات صالحة' }[r.error] || 'تعذّر بدء الجمع', 'err');
    X.toast('بدأ الجمع. سيُفتح تبويب فيسبوك، اتركه ظاهراً.');
  }

  const nSel = id => num(curScripts().reduce((a, sc) => a + ((P.selC[id] || {})[sc] || []).length, 0));
  function prevHtml(qs) {
    const L = STATS.limits;
    return `<div class="l-sub">${qs.length ? `ستُنفَّذ ${num(qs.length)} عملية بحث` : 'لم تختر شيئاً بعد'}${qs.length > L.maxBatch ? ` <span style="color:var(--bad)">(الحد الأقصى ${num(L.maxBatch)} في الدفعة، قلّل الاختيار)</span>` : ''}</div>
${qs.length ? `<div class="l-q">${qs.slice(0, 40).map(x => `<span dir="auto"${x.tip ? ` data-tip="${e(x.tip)}"` : ''}>${e(x.q)}</span>`).join('')}${qs.length > 40 ? '<span class="muted">…</span>' : ''}</div>` : ''}
<p style="margin:12px 0 0"><button class="btn" data-l="batch"${qs.length && qs.length <= L.maxBatch ? '' : ' disabled'}>ابدأ البحث الجماعي</button></p>`;
  }
  function refreshPrev() {
    const el = $('#l-prev'); if (!el) return;
    el.innerHTML = prevHtml(buildQueries());
    DICT.view.niches.forEach(n => { const c = $(`[data-cnt="n:${CSS.escape(n.id)}"]`); if (c) c.textContent = nSel(n.id) + ' مختارة'; });
    curLangs().forEach(lg => { const c = $(`[data-cnt="g:${lg}"]`); if (c) c.textContent = num((P.selG[lg] || []).length) + ' مختارة'; });
  }
  function drawProg() {
    const el = $('#l-prog'); if (!el) return;
    const s = B.state;
    if (!s || !s.items || !s.items.length) { el.innerHTML = ''; return; }
    const items = s.items, done = items.filter(i => ['done', 'skipped', 'timeout', 'stopped'].includes(i.status)).length, seen = items.reduce((n, i) => n + (i.seen || 0), 0);
    const L = { pending: 'بالانتظار', running: 'يعمل…', done: 'تم', skipped: 'تُخطّي', timeout: 'انتهت المهلة', stopped: 'أُوقف' };
    const WHY = { max: '✅ اكتمل العدد المطلوب', idle: 'توقفت فيسبوك عن عرض المزيد', timeout: 'انتهت المهلة', manual: 'أوقفته أنت', skipped: 'تخطيته' };
    const want = Math.max(1, +P.maxAds || 150);
    const fin = !s.active, got = RUN.added + RUN.updated;
    el.innerHTML = `<div class="card" style="margin-top:14px"><div class="l-st"><h2 class="grow" style="margin:0">${s.active ? '⏳ الجمع يعمل' : '✅ انتهى الجمع'} <small>(${num(done)}/${num(items.length)})</small></h2>
      ${s.active ? '<button class="btn ghost sm" data-l="skip">تخطّي الحالي</button><button class="btn danger sm" data-l="stop">إيقاف</button>' : ''}</div>
      <div class="l-bar"><i style="width:${Math.round(done / items.length * 100)}%"></i></div>
      <div class="l-nums"><div><b>${num(seen)}</b><span>المرصود</span></div><div><b>${num(RUN.added)}</b><span>وصل إلى «الواردة»</span></div><div><b>${num(s.pending)}</b><span>بانتظار الإرسال</span></div></div>
      ${s.sendMode === 'manual' && s.pending ? `<p><button class="btn" data-l="sendnow">إرسال الآن (${num(s.pending)})</button> <small>الوضع اليدوي: لم تصل هذه الإعلانات إلى المنصة بعد.</small></p>` : ''}
      ${RUN.filtered ? `<div class="alert info">🛡️ استُبعد ${num(RUN.filtered)} إعلاناً ليست منتجات مادية صالحة للتجارة الإلكترونية: ${Object.entries(RUN.byKind).map(([k, n]) => `${e((window.RadarProductCheck && RadarProductCheck.LABEL[k]) || k)} ${num(n)}`).join(' · ')}${RUN.samples.length ? `<details style="margin-top:6px"><summary>أمثلة</summary>${RUN.samples.map(x => `<div class="muted" dir="auto">• ${e(x.title)} <small>(${e(x.page || '')}) ← ${e(x.why)}</small></div>`).join('')}</details>` : ''}</div>` : ''}
      ${RUN.rejected ? `<div class="alert err">${num(RUN.rejected)} إعلان لم يُحفظ لأن الدفعة بلغت حدّها.</div>` : ''}
      ${fin && got ? `<div class="alert info">حُفظت الإعلانات في «الإعلانات الواردة» (${num(got)} إعلان). افتحها وحلّلها بمعايير المنصة. <button class="btn sm" data-v="inbox">فتح الإعلانات الواردة</button></div>` : ''}
      <div style="max-height:260px;overflow:auto">${items.map(i => `<div class="l-bi"><span class="q" dir="auto" title="${e(i.niche)}">${e(i.q || '(الصفحة المفتوحة)')}</span><span class="muted">${i.status === 'running' || i.seen ? num(i.seen) + ' / ' + num(want) + ' إعلان · ' : ''}${(i.kind || 'fb') === 'fb' && (i.status === 'running' || i.seen) ? (i.total ? 'مرصود في ميتا: ' + num(i.total) + ' · ' : 'لم يُقرأ عدد ميتا بعد · ') : ''}${(i.status === 'done' && WHY[i.reason]) || L[i.status] || i.status}</span></div>`).join('')}</div></div>`;
  }
  async function drawCollect(soft) {
    try { const qq = localStorage.getItem('wpr_collect_quick'); if (qq) { P.q = qq; localStorage.removeItem('wpr_collect_quick'); } } catch (x) {}
    const root = $('#l-body'), opened = soft ? $$('#l-body details').map(d => d.open) : [], y0 = scrollY;
    if (!soft) root.innerHTML = '<div class="card"><p class="sub">جارٍ التحميل…</p></div>';
    try { await Promise.all([STATS ? 0 : loadStats(), loadDict()]); } catch (x) { if (x.message !== 'auth') root.innerHTML = '<div class="alert err">' + e(x.message) + '</div>'; return; }
    drawTabs();
    const L = STATS.limits, speeds = [['slow', 'بطيئة (الأأمن)'], ['normal', 'عادية']].concat(L.allowFast ? [['fast', 'سريعة']] : []);
    const niches = DICT.view.niches.filter(n => !n.off), sm = (B.state && B.state.sendMode) || 'auto';
    root.innerHTML = `${extCard()}
<div class="card" style="margin-top:14px"><h2>إعدادات البحث والجمع</h2><div class="l-g3">
<label class="fl">الدولة<select data-p="country">${countryOpts(P.country)}</select></label>
<label class="fl">الحالة<select data-p="status">${opt('active', 'نشطة فقط (الأسرع)', P.status)}${opt('all', 'كل الحالات (يشمل المتوقفة)', P.status)}${opt('inactive', 'المتوقفة فقط', P.status)}</select></label>
<label class="fl">الوسائط<select data-p="media">${opt('all', 'الكل', P.media)}${opt('image', 'صور', P.media)}${opt('video', 'فيديو', P.media)}</select></label>
<label class="fl">لغة المحتوى<select data-p="lang">${opt('', 'أي لغة', P.lang)}${opt('auto', 'تلقائي: لغة كلمة البحث', P.lang)}${uniq(Object.values(MK.LANGS).map(l => l.fb).filter(Boolean)).map(fb => opt(fb, (Object.values(MK.LANGS).find(l => l.fb === fb) || {}).native || fb, P.lang)).join('')}</select></label>
<label class="fl">نوع البحث<select data-p="type">${opt('keyword_unordered', 'الكلمات بأي ترتيب', P.type)}${opt('keyword_exact_phrase', 'عبارة مطابقة', P.type)}</select></label>
<label class="fl">السرعة<select data-p="speed">${speeds.map(s => opt(s[0], s[1], P.speed)).join('')}</select></label>
<label class="fl">أقصى إعلانات للبحث الواحد<input type="number" min="10" max="${L.maxAdsPerSearch}" data-p="maxAds" value="${e(P.maxAds)}"></label>
<label class="fl">التوقف بعد خمول (ثانية)<input type="number" min="8" max="60" data-p="wait" value="${e(P.wait)}"></label>
<label class="fl">وضع الإرسال<select data-sm>${opt('auto', 'تلقائي: يصل فور الرصد', sm)}${opt('manual', 'يدوي: أرسل أنا بعد المراجعة', sm)}</select></label></div>
<p class="sub" style="margin:10px 0 0">تصل الإعلانات المجموعة إلى «الإعلانات الواردة» (دفعة لكل عملية جمع) وتُقيَّم هناك بمعايير المنصة. الدفعات التي لا تُحلَّل تُحذف تلقائياً بعد ${num(STATS.retention.days)} يوماً.</p></div>

<div class="card" style="margin-top:14px"><h2>بحث سريع</h2><div class="l-add" style="max-width:640px"><input id="l-qs" dir="auto" placeholder="كلمة البحث بلغة ${e(cname(P.country))}، مثل: ${e(quickHint())}" value="${e(P.q)}"><button class="btn" data-l="quick">ابدأ الجمع</button></div>
<p style="margin:10px 0 0"><button class="btn ghost sm" data-l="current">جمع الصفحة المفتوحة في فيسبوك</button> <small>إن كنت فتحت بحثاً في مكتبة الإعلانات بنفسك.</small></p></div>

<div class="card${P.edit ? ' l-edit' : ''}" style="margin-top:14px"><div class="l-st" style="margin-bottom:4px"><h2 class="grow" style="margin:0">بحث جماعي بالكلمات الذهبية</h2><button class="btn ${P.edit ? '' : 'ghost'} sm" data-l="kwedit">${P.edit ? '✓ إنهاء التعديل' : '✎ إضافة / حذف كلمات'}</button></div>
${P.edit ? '<div class="alert info">وضع التعديل: اضغط × على كلمة لتعطيلها (أو لحذفها إن أضفتها أنت)، و↺ لاستعادتها، واكتب كلمة جديدة في الخانة تحت كل لغة أو نيش. تُحفظ تلقائياً في قاموسك.</div>' : ''}
<p class="sub">الكلمات معروضة بلغات ${e(cname(P.country))}: ${curLangs().map(l => e(MK.LANGS[l].native)).join(' · ')}. كل كلمة ذهبية تُركَّب مع مكمّلات لغتها فقط. عدّل القوائم من تبويب «القاموس».</p>
<div class="l-ck" style="margin:6px 0 10px"><b>طريقة البحث:</b> ${Object.entries(MODES).map(([k, t]) => `<label style="display:inline-flex;align-items:center;gap:6px;white-space:nowrap;margin-inline-end:16px"><input type="radio" name="l-mode" data-p="mode" value="${k}"${(P.mode || 'combo') === k ? ' checked' : ''}> ${t}</label>`).join(' ')}
<div class="muted" style="width:100%">${modeHint()}</div></div>
${(P.mode || 'combo') === 'comp' ? '' : `<div class="l-sub">الكلمات الذهبية</div>`}
${(P.mode || 'combo') === 'comp' ? '' : curLangs().map(lg => `<details class="fx"><summary>${LGN[lg]} <small data-cnt="g:${lg}">${num((P.selG[lg] || []).length)} مختارة</small></summary><div class="l-chips" data-gl="${lg}">${chipsGold(lg)}</div></details>`).join('')}
${(P.mode || 'combo') === 'gold' ? '' : `<div class="l-sub">النيشات ومكمّلاتها</div>
${niches.map(n => `<details class="l-nic"><summary>${e(n.name)} <small data-cnt="n:${e(n.id)}">${nSel(n.id)} مختارة</small></summary>
${curScripts().map(sc => `<div class="l-sub">${SCN[sc]}</div><div class="l-chips">${compChips(n, sc)}</div>`).join('')}</details>`).join('')}
`}
<div id="l-prev">${prevHtml(buildQueries())}</div>
<p class="sub" style="margin-top:8px">⚠️ الجمع الآلي من مكتبة ميتا يخالف شروط استخدامها وقد يقيّد حسابك. التزم بالسرعة العادية أو البطيئة وبكميات معقولة.</p></div>
<div id="l-prog"></div>`;
    if (soft) { $$('#l-body details').forEach((d, i) => { if (opened[i]) d.open = true; }); scrollTo({ top: y0 }); }
    drawProg(); fetchGloss();
  }

  /* ================= القاموس ================= */
  let saveT = null, saving = false;
  function scheduleSave() { clearTimeout(saveT); saving = true; drawDictStatus(); saveT = setTimeout(async () => { try { const r = await api('PUT', DMODE === 'admin' ? '/admin/lib/dict' : '/lib/dict', { diff: DICT.diff }); DICT.diff = r.diff; DICT.view = r.view; saving = false; P.tab === 'collect' ? drawCollect(true) : drawDict(true); } catch (x) { saving = false; X.toast(x.message, 'err'); } }, 500); }
  const drawDictStatus = () => { const el = $('#l-dst'); if (el) el.textContent = saving ? 'جارٍ الحفظ…' : 'تُحفظ التعديلات تلقائياً'; };
  const dl = (lg, tier) => DICT.diff.gold[lg][tier];
  function itemAct(list, it, kind) {                     // list = {add:[],off:[]}
    if (kind === 'add') { const i = list.off.indexOf(it); if (i >= 0) list.off.splice(i, 1); else if (!list.add.includes(it)) list.add.push(it); return; }
    if (it.s === 'custom') { const i = list.add.indexOf(it.t); if (i >= 0) list.add.splice(i, 1); } else if (it.s === 'def') list.off.push(it.t); else { const i = list.off.indexOf(it.t); if (i >= 0) list.off.splice(i, 1); }
  }
  const chipD = (x, attrs, lang) => `<button type="button" class="lc ${x.s}" ${attrs}${lang ? tipA(lang, x.t) : ''} title="${x.s === 'def' ? 'افتراضي: اضغط للتعطيل' : x.s === 'off' ? 'معطّل: اضغط للاستعادة' : 'مضاف منك: اضغط للحذف'}">${e(x.t)}</button>`;
  const addBox = attrs => `<div class="l-add"><input dir="auto" placeholder="أضف…" data-add ${attrs}><button class="btn ghost sm" data-l="dadd" ${attrs}>إضافة</button></div>`;
  async function drawDict(soft) {
    const root = $('#l-body'), opened = soft ? $$('#l-body details').map(d => d.open) : [], y0 = scrollY;
    if (!soft) root.innerHTML = '<div class="card"><p class="sub">جارٍ التحميل…</p></div>';
    try { if (DMODE === 'admin') { DICT = await api('GET', '/admin/lib/dict'); } else await loadDict(!soft); await (STATS ? 0 : loadStats()); } catch (x) { return; }
    const v = DICT.view, isAdm = X.me().role === 'admin';
    root.innerHTML = `<div class="card"><div class="l-st"><div class="grow"><h2 style="margin:0">قاموس كلمات البحث</h2><p class="sub" style="margin:2px 0 0">هذه الكلمات هي ما يبحث به «البحث الجماعي». قاموس المنصة الافتراضي (لغات الجزائر + لغات الأسواق الدولية) يصلك دائماً ومحدَّثاً، وما تضيفه أو تعطّله يخصّك وحدك ولا يضيع عند تحديث الافتراضي. <small id="l-dst">تُحفظ التعديلات تلقائياً</small></p></div>
<button class="btn ghost sm" data-l="dreset">استعادة كل الافتراضي</button></div>
${isAdm ? `<label class="fl chk" style="margin-top:8px"><input type="checkbox" data-l="dadmin"${DMODE === 'admin' ? ' checked' : ''}> وضع المدير: تعديل القاموس الافتراضي لكل المشتركين${DICT.custom ? ' (معدَّل)' : ''}</label>${DMODE === 'admin' ? `<p class="sub">⚠️ تعديلاتك هنا تغيّر الأصل للجميع. <button class="btn danger sm" data-l="dadminreset">العودة للأصل المرفق</button></p>` : ''}` : ''}</div>
<div class="card" style="margin-top:14px"><h2>الكلمات الذهبية</h2><p class="sub">قوية = 3 وحدات · عادية = 1 · عامة = 0.3. تُطابَق كلمة مستقلة مكتملة، وتُقبل السوابق وصيغ المخاطب. الصيغ البديلة تُفصل بـ «/».</p>
${MK.ALL_LANGS.filter(lg => v.gold[lg]).map(lg => `<details class="fx"><summary>${LGN[lg]} <small>${['strong', 'normal', 'weak'].map(t => num(v.gold[lg][t].filter(x => x.s !== 'off').length)).join(' · ')}</small></summary>
${['strong', 'normal', 'weak'].map(t => `<div class="l-sub">${TRN[t]}</div><div class="l-chips">${v.gold[lg][t].map(x => chipD(x, `data-d="g" data-lg="${lg}" data-tr="${t}" data-t="${e(x.t)}" data-s="${x.s}"`, lg)).join('')}</div>${addBox(`data-d="g" data-lg="${lg}" data-tr="${t}"`)}`).join('')}
<p style="margin:10px 0 0"><button class="btn ghost sm" data-l="dresetlg" data-lg="${lg}">استعادة افتراضي ${LGN[lg]}</button></p></details>`).join('')}</div>
<div class="card" style="margin-top:14px"><div class="l-st"><h2 class="grow" style="margin:0">النيشات ومكمّلاتها</h2></div>
${v.niches.map(n => `<details class="l-nic"><summary><span${n.off ? ' style="opacity:.5;text-decoration:line-through"' : ''}>${e(n.name)}</span>${n.def ? '' : '<span class="tg soft">من إضافتك</span>'}</summary>
<div class="l-add"><input dir="auto" value="${e(n.name)}" data-nname="${e(n.id)}" style="max-width:260px"><button class="btn ghost sm" data-l="nname" data-id="${e(n.id)}">تغيير الاسم</button><button class="btn ${n.def ? 'ghost' : 'danger'} sm" data-l="${n.def ? 'noff' : 'ndel'}" data-id="${e(n.id)}">${n.def ? (n.off ? 'إظهار' : 'إخفاء') : 'حذف'}</button></div>
${ALL_SCRIPTS.filter(sc => n.comps[sc]).map(sc => `<div class="l-sub">${SCN[sc]}</div><div class="l-chips">${n.comps[sc].map(x => chipD(x, `data-d="n" data-n="${e(n.id)}" data-sc="${sc}" data-t="${e(x.t)}" data-s="${x.s}"`, sc)).join('')}</div>${addBox(`data-d="n" data-n="${e(n.id)}" data-sc="${sc}"`)}`).join('')}</details>`).join('')}
<div class="l-add" style="margin-top:14px"><input dir="auto" id="l-newn" placeholder="اسم نيش جديد، مثل: مستلزمات المدرسة"><button class="btn sm" data-l="nnew">إضافة نيش</button></div></div>
`;
    $$('#l-body details').forEach((d, i) => { if (opened[i]) d.open = true; });
    scrollTo({ top: y0 }); fetchGloss();
  }
  function dictClick(b) {
    const it = { t: b.dataset.t, s: b.dataset.s };
    if (b.dataset.d === 'g') itemAct(dl(b.dataset.lg, b.dataset.tr), it);
    else {
      const id = b.dataset.n, sc = b.dataset.sc, add = DICT.diff.niches.add.find(n => n.id === id);
      if (add) { const i = add.comps[sc].indexOf(it.t); if (i >= 0) add.comps[sc].splice(i, 1); }
      else itemAct(nicheList(id, sc), it);
    }
    scheduleSave();
  }
  function nicheList(id, sc) { const ed = (DICT.diff.niches.edit[id] = DICT.diff.niches.edit[id] || {}); ed.comps = ed.comps || {}; return (ed.comps[sc] = ed.comps[sc] || { add: [], off: [] }); }
  function dictAdd(b) {
    const inp = b.parentElement.querySelector('[data-add]'), t = inp.value.trim().replace(/\s+/g, ' ');
    if (!t) return inp.focus();
    if (b.dataset.d === 'g') itemAct(dl(b.dataset.lg, b.dataset.tr), t, 'add');
    else { const add = DICT.diff.niches.add.find(n => n.id === b.dataset.n); if (add) { if (!add.comps[b.dataset.sc].includes(t)) add.comps[b.dataset.sc].push(t); } else itemAct(nicheList(b.dataset.n, b.dataset.sc), t, 'add'); }
    inp.value = ''; scheduleSave();
  }


  /* ================= الإضافة ================= */
  async function drawExt() {
    if (!STATS) await loadStats();
    const admin = X.me().role === 'admin', hosts = (STATS.ext && STATS.ext.hosts) || [];
    const store = STATS.ext && STATS.ext.store;
    // التثبيت اليدوي (ملف ZIP): الطريقة الوحيدة قبل النشر في المتجر، وبديل بعده (نسخة تجريبية أو دومين آخر)
    const manual = `<ol class="l-steps"><li><a class="btn sm" href="/api/lib/extension.zip" download>⬇️ نزّل الإضافة</a> وفُكّ الضغط في مجلد دائم (لا تحذفه بعد التثبيت).</li>
<li>افتح <code>chrome://extensions</code> وفعّل <b>وضع المطوّر</b>.</li><li>اضغط <b>تحميل إضافة غير مضغوطة</b> واختر المجلد <code>radar-ad-collector</code>.</li>
<li>افتح هذه الصفحة: تتحول الحالة إلى «الإضافة متصلة» (وإن لم تتحول اضغط F5).</li>
<li>عند تحديث الإضافة لاحقاً: نزّل الجديدة، استبدل المجلد، اضغط أيقونة التحديث في chrome://extensions ثم F5 هنا.</li></ol>`;
    $('#l-body').innerHTML = `${extCard()}<div class="card" style="margin-top:14px"><h2>تثبيت الإضافة (مرة واحدة)</h2>
<p class="sub">الإضافة صغيرة مهمتها فتح مكتبة إعلانات ميتا وتمريرها والتقاط الإعلانات وإرسالها إلى حسابك هنا. كل الواجهة والتحليل في المنصة. لا تحمل مفاتيح ولا كلمات مرور.</p>
${store ? `<ol class="l-steps"><li><a class="btn sm" href="${e(store)}" target="_blank" rel="noopener">🧩 الإضافة في متجر Chrome ↗</a></li><li>في المتجر اضغط «إضافة إلى Chrome» (Add to Chrome) ثم «إضافة الإضافة».</li>
<li>ثبّتها في شريط Chrome: اضغط أيقونة قطعة البازل 🧩 أعلى المتصفح، ثم الدبوس 📌 بجانب «Winning Product Radar».</li>
<li>عد إلى هذه الصفحة واضغط F5: تتحول الحالة إلى «الإضافة متصلة».</li><li>اضغط أيقونة الإضافة في Chrome لترى تقدّم الجمع وتتحكم في الإرسال.</li>
<li>التحديثات تصل تلقائياً من المتجر، فلا تحتاج لتنزيل شيء بعد اليوم.</li></ol>
<details class="fx" style="margin-top:10px"><summary>تثبيت يدوي من ملف (بديل)</summary>${manual}</details>` : manual}</div>
<div class="card" style="margin-top:14px"><h2>ملاحظات مهمة</h2><ul class="l-steps"><li>تعمل على <b>Chrome للحاسوب</b> (116 فأحدث). النتائج والتحليل تعمل من الجوال بعد الجمع.</li>
<li>أثناء الجمع <b>اترك تبويب فيسبوك ظاهراً</b> وصفحة المنصة مفتوحة في تبويب آخر. فيسبوك لا يحمّل المزيد في تبويب مخفي.</li>
<li>يجب أن تكون مسجلاً الدخول إلى فيسبوك. لا تقرأ الإضافة شيئاً خارج مكتبة الإعلانات.</li>
<li>الحدود لحماية حسابك: ${STATS ? num(STATS.limits.maxBatch) + ' بحثاً في الدفعة و' + num(STATS.limits.maxDay) + ' في اليوم' : 'حدود يومية'}، وسرعة عادية أو بطيئة. شروط ميتا تقيّد الجمع الآلي وتبعته عليك.</li></ul>
${B.ok ? '' : `<p class="sub"><b>لا تتصل؟</b> تأكد أنها مفعَّلة في <code>chrome://extensions</code>، ثم أعد تحميل هذه الصفحة (F5).</p><p class="sub">${store ? 'وإن كانت لديك نسخة يدوية قديمة فاحذفها وثبّتها من المتجر.' : 'وإن كانت لديك نسخة قديمة فاحذفها ونزّل الجديدة.'}</p>`}</div>
${admin ? `<div class="card" style="margin-top:14px"><h2>للمدير</h2><p class="sub">تُربط الإضافة المنزَّلة بهذه الدومينات: ${hosts.map(h => `<code>${e(h)}</code>`).join('، ') || '—'}.
${hosts.includes(location.hostname) ? 'عنوانك الحالي ضمنها.' : '<b style="color:var(--bad)">عنوانك الحالي <code>' + e(location.hostname) + '</code> ليس ضمنها: اضبط BRIDGE_ORIGINS في إعدادات الخادم ثم أعد التنزيل.</b>'}</p></div>` : ''}`;
  }

  /* ================= الحدث والتفاعل ================= */
  let inited = false;
  const emptyDiff = () => { const d = { v: 1, gold: {}, niches: { add: [], off: [], edit: {} }, bigBrands: { add: [], off: [] } }; MK.ALL_LANGS.forEach(l => { d.gold[l] = {}; ['strong', 'normal', 'weak'].forEach(t => { d.gold[l][t] = { add: [], off: [] }; }); }); return d; };
  const two = b => { if (b.dataset.s2 !== '1') { b.dataset.s2 = '1'; b.dataset.t2 = b.textContent; b.textContent = 'تأكيد؟'; setTimeout(() => { b.dataset.s2 = ''; b.textContent = b.dataset.t2 || b.textContent; }, 3500); return false; } return true; };
  async function onClick(ev) {
    const t = ev.target.closest('[data-lt]'); if (t && X.cur() === VIEW) { P.tab = t.dataset.lt; saveP(); X.url(tabPath(P.tab)); redraw(); return true; }
    const g = ev.target.closest('[data-g]'); if (g) { const a = selSet(P.selG, g.dataset.g), i = a.indexOf(g.dataset.t); i >= 0 ? a.splice(i, 1) : a.push(g.dataset.t); saveP(); g.classList.toggle('on', i < 0); refreshPrev(); return true; }
    const c = ev.target.closest('[data-c]'); if (c) { const m = (P.selC[c.dataset.c] = P.selC[c.dataset.c] || {}), a = (m[c.dataset.sc] = m[c.dataset.sc] || []), i = a.indexOf(c.dataset.t); i >= 0 ? a.splice(i, 1) : a.push(c.dataset.t); saveP(); c.classList.toggle('on', i < 0); refreshPrev(); return true; }
    const d = ev.target.closest('[data-d]'); if (d && d.classList.contains('lc')) { dictClick(d); return true; }
    const b = ev.target.closest('[data-l]'); if (!b) return false;
    const k = b.dataset.l, id = b.dataset.id;
    if (k === 'quick') { P.q = $('#l-qs').value.trim(); saveP(); if (!P.q) return $('#l-qs').focus(), true; await startItems([{ q: P.q }]); return true; }
    if (k === 'batch') { const qs = buildQueries(); if (qs.length) await startItems(qs); return true; }
    if (k === 'current') { if (!B.ok) { X.toast('الإضافة غير متصلة', 'err'); return true; } RUN.added = RUN.updated = RUN.rejected = 0; RUN.quota = false; RUN.run = 0; const r = await bsend('start_current', { settings: settingsOut(), limits: STATS && STATS.limits, label: 'جمع من الصفحة المفتوحة' }, 8000); X.toast(r.ok ? 'بدأ جمع الصفحة المفتوحة' : { no_tab: 'لا يوجد تبويب مفتوح على مكتبة الإعلانات', reload_tab: 'أعد تحميل تبويب فيسبوك (F5) ثم أعد المحاولة', busy: 'هناك عملية جمع تعمل الآن' }[r.error] || 'تعذّر البدء', r.ok ? '' : 'err'); return true; }
    if (k === 'stop') { await bsend('stop'); return true; }
    if (k === 'skip') { await bsend('skip'); return true; }
    if (k === 'sendnow') { const r = await bsend('send_now'); if (!r.ok) X.toast('تعذّر الإرسال', 'err'); return true; }
    // القاموس
    if (k === 'dadd') { dictAdd(b); return true; }
    if (k === 'kwedit') { P.edit = !P.edit; saveP(); drawCollect(true); return true; }
    if (k === 'dreset') { if (!two(b)) return true; DICT.diff = emptyDiff(); scheduleSave(); return true; }
    if (k === 'dresetlg') { ['strong', 'normal', 'weak'].forEach(t => { DICT.diff.gold[b.dataset.lg][t] = { add: [], off: [] }; }); scheduleSave(); return true; }
    if (k === 'nname') { const v = $(`[data-nname="${CSS.escape(id)}"]`).value.trim(); if (!v) return true; const add = DICT.diff.niches.add.find(n => n.id === id); if (add) add.name = v; else (DICT.diff.niches.edit[id] = DICT.diff.niches.edit[id] || {}).name = v; scheduleSave(); return true; }
    if (k === 'noff') { const o = DICT.diff.niches.off, i = o.indexOf(id); i >= 0 ? o.splice(i, 1) : o.push(id); scheduleSave(); return true; }
    if (k === 'ndel') { if (!two(b)) return true; DICT.diff.niches.add = DICT.diff.niches.add.filter(n => n.id !== id); scheduleSave(); return true; }
    if (k === 'nnew') { const v = $('#l-newn').value.trim(); if (!v) return true; DICT.diff.niches.add.push({ id: 'u' + Date.now().toString(36), name: v, comps: Object.fromEntries(ALL_SCRIPTS.map(sc => [sc, []])) }); scheduleSave(); return true; }
    if (k === 'dadminreset') { if (!two(b)) return true; DICT = await api('POST', '/admin/lib/dict/reset', {}); X.toast('عاد القاموس الافتراضي للأصل'); drawDict(true); return true; }
    return false;
  }
  function onChange(ev) {
    const p = ev.target.closest('[data-p]'); if (p) { P[p.dataset.p] = p.type === 'number' ? +p.value : p.value; saveP(); if (['type', 'country', 'mode'].includes(p.dataset.p)) drawCollect(); return true; }
    const pc = ev.target.closest('[data-pc]'); if (pc) { P[pc.dataset.pc] = pc.checked; saveP(); refreshPrev(); return true; }
    const sm = ev.target.closest('[data-sm]'); if (sm) { bsend('set_mode', { mode: sm.value }).then(() => { if (B.state) B.state.sendMode = sm.value; drawProg(); }).catch(() => X.toast('الإضافة غير متصلة', 'err')); return true; }
    const ad = ev.target.closest('[data-l="dadmin"]'); if (ad) { DMODE = ad.checked ? 'admin' : 'user'; DICT = null; drawDict(); return true; }
    return false;
  }
  function guardRun(f, ev) { const pr = Promise.resolve().then(f); if (ev && W.__btnBusy) W.__btnBusy(ev, pr); pr.catch(x => { if (x && x.message !== 'auth') X.toast(x.message || 'حدث خطأ', 'err'); }); }

  // بدء الطابور: الإضافات حتى 1.1.x كانت تطمس معرّف الرسالة في ردّ «start» فينتهي الانتظار رغم أن الجمع بدأ فعلاً.
  // عند انتهاء المهلة نتحقق من حالة الإضافة: إن كانت تعمل على نفس الكلمات فقد بدأ الجمع.
  async function startQueue(payload, ms) {
    try { const r = await bsend('start', payload, ms || 8000); return Object.assign({}, r, { batch: r.batch || (r.ok && B.state && B.state.id) || '' }); }
    catch (x) {
      if (x.message !== 'timeout') throw x;
      await new Promise(r => setTimeout(r, 800));
      const s = B.state, qs = (payload.items || []).map(i => i.q);
      if (s && s.active && s.items && s.items.length === qs.length && s.items.every((it, i) => it.q === qs[i])) return { ok: true, batch: s.id };
      throw x;
    }
  }
  W.WPRLIB = {
    bridge: { ok: () => B.ok, version: () => B.version, state: () => B.state, running, send: (c, p, ms) => bsend(c, p, ms), start: (p, ms) => startQueue(p, ms), stats: () => STATS, loadStats: () => loadStats(), settings: () => settingsOut() },
    init(ctx) {
      X = ctx; if (inited) return; inited = true;
      W.addEventListener('message', ev => { if (ev.source !== W || ev.origin !== location.origin) return; const d = ev.data; if (d && d.tag === 'WPR_BRIDGE') onBridge(d); });
      X.root.addEventListener('click', ev => { if (X.cur() === VIEW) guardRun(() => onClick(ev), ev); });
      X.root.addEventListener('change', ev => { if (X.cur() === VIEW) guardRun(() => onChange(ev)); });
      X.root.addEventListener('keydown', ev => { if (ev.key === 'Enter' && X.cur() === VIEW) { const i = ev.target.closest('[data-add]'); if (i) { ev.preventDefault(); i.parentElement.querySelector('[data-l="dadd"]').click(); } else if (ev.target.id === 'l-qs') { ev.preventDefault(); $('[data-l="quick"]').click(); } } });
      ping(); setInterval(ping, 4000);
      loadStats().catch(() => {});
    },
    render(sub, o) {
      if (!$('#l-tabs')) $('#x-collect').innerHTML = '<div class="lt" id="l-tabs"></div><div id="l-body"></div>';
      if (sub && TAB_OF[sub]) P.tab = TAB_OF[sub]; else if (!sub && o && o.fromUrl) P.tab = 'collect';
      if (!TABS.some(t => t[0] === P.tab)) P.tab = 'collect';
      X.url(tabPath(P.tab), !!(o && o.nopush));
      DICT = DMODE === 'admin' ? DICT : null; if (DMODE === 'admin' && X.me().role !== 'admin') DMODE = 'user';
      ping(); STATS = null; redraw();
    }
  };
})();
