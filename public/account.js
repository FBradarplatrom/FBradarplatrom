/* الحساب والإدارة: 💳 الاشتراك والدفع (في «الإعدادات») · 🔌 الربط والتكامل (قسم) · لوحة المدير (الإحصائيات، المدفوعات، الباقات، الأخطاء).
   يعمل مع app.html عبر WPRACC.init(ctx). */
(function () {
  'use strict';
  const W = window; let X = null, inited = false;
  const e = window.WPRU.e;   // public/shared.js
  const num = n => Number(n || 0).toLocaleString((window.__LOC||'ar-DZ'));
  const dz = n => num(n) + ' دج';
  const $ = s => X.root.querySelector(s);
  const ST = { pending: ['warn', 'قيد المراجعة'], paid: ['ok', 'مدفوع'], rejected: ['bad', 'مرفوض'], failed: ['bad', 'فشل'] };
  const MT = { satim: '💳 CIB / الذهبية', stripe: '💳 بطاقة دولية (Stripe)', paypal: '🅿️ PayPal', card: '💳 بطاقة', baridi: '📱 BaridiMob / CCP / تحويل' };
  const money = (a, c) => (c === 'USD' ? '$' + Number(a || 0).toFixed(2) : dz(a));
  const perName = m => +m === 1 ? 'شهر' : +m === 12 ? '12 شهراً' : m + ' أشهر';
  const perOf = (p, m) => (p && p.periods || []).find(z => z.m === +m);
  const defMonths = () => { const ms = ((BL && BL.periods) || []).map(x => +x.m); return ms.includes(6) ? 6 : ms[0] || 1; };
  const st = document.createElement('style');
  st.textContent = `.meter{margin:8px 0}.meter .t{display:flex;justify-content:space-between;font-size:13px}.meter .b{height:8px;background:var(--line);border-radius:99px;overflow:hidden;margin-top:4px}.meter .b i{display:block;height:100%;background:linear-gradient(90deg,#118553,#35ac74)}.meter .b i.hot{background:linear-gradient(90deg,#f59e0b,#dc2626)}
.adm-t{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 16px}.adm-t button{border:1px solid var(--line);background:var(--card);border-radius:99px;padding:7px 14px;font:inherit;font-size:14px;cursor:pointer;color:var(--ink)}.adm-t button.on{background:var(--brand);color:#fff;border-color:var(--brand)}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.kpis div{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px}.kpis b{display:block;font-size:22px}.kpis span{font-size:12.5px;color:var(--mut)}
.bars{display:flex;align-items:flex-end;gap:6px;height:140px;margin-top:10px}@media(max-width:600px){.bars{gap:2px}.bars small{display:none}.bars span{font-size:9px}.bars div:nth-child(even) span{visibility:hidden}}.bars div{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;font-size:11px;color:var(--mut)}.bars i{display:block;width:100%;background:linear-gradient(180deg,#35ac74,#118553);border-radius:6px 6px 0 0;min-height:2px}
.btn.wa{background:#25d366;color:#fff;border-color:#25d366;display:inline-flex;gap:8px;align-items:center}.btn.wa:hover{background:#1ebe5b}
.pay-sec{margin:16px 0 4px;padding-top:16px;border-top:1px solid var(--line)}.pay-h{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}.pay-h h3{margin:0 0 2px;font-size:17px}
.wa-l{margin-top:14px}.wa-lt{display:flex;gap:8px;align-items:center;font-size:13.5px;font-weight:700;color:var(--mut);margin-bottom:8px}.wa-lt svg{color:var(--brand)}.wa-lg{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}
.wa-i{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:start;border:1px solid var(--line);background:var(--card);border-radius:12px;padding:10px 14px;cursor:pointer;font:inherit;color:var(--ink);transition:.15s}.wa-i:hover{border-color:var(--brand);background:var(--soft)}.wa-i b{font-size:14px}.wa-i small{color:var(--mut);font-size:12.5px}
.st-k>div.ok b{color:var(--ok)}.st-k>div.warn b{color:var(--warn)}.st-hb{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) auto;gap:10px;align-items:center;padding:5px 0;font-size:14px}.st-hb i{height:8px;background:var(--card2);border-radius:99px;overflow:hidden}.st-hb i s{display:block;height:100%;background:var(--brand);border-radius:99px}.st-hb b{min-width:36px;text-align:end}
.st-l{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:2px 18px}.st-l>div{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid var(--line);font-size:14px}.st-l span{color:var(--mut)}
.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}@media(max-width:860px){.grid3{grid-template-columns:1fr}}
.wa-m{display:flex;flex-direction:column;gap:10px}.wa-m textarea{font:inherit;line-height:1.7}
.sup-f{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}.sup-f button{border:1px solid var(--line);background:var(--card);border-radius:99px;padding:6px 14px;font:inherit;font-size:13.5px;cursor:pointer;color:var(--ink)}.sup-f button.on{background:var(--brand);color:#fff;border-color:var(--brand)}
.mb-l{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:12px;overflow:hidden}.mb-r{display:flex;gap:12px;align-items:center;text-align:start;width:100%;padding:12px 14px;border:0;border-bottom:1px solid var(--line);background:var(--card);color:var(--ink);font:inherit;cursor:pointer}.mb-r:last-child{border-bottom:0}.mb-r:hover{background:var(--soft)}.mb-r.new{border-inline-start:3px solid var(--brand)}.mb-r.new .mb-n{font-weight:800}.mb-w{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.mb-w small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mb-s{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0}.mb-i{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;background:var(--soft);border-radius:12px;padding:10px 14px;font-size:14px}.mb-i dt{color:var(--mut)}.mb-i dd{margin:0;overflow-wrap:anywhere}.mb-a{display:flex;gap:8px;flex-wrap:wrap}
.sup-t{margin-bottom:12px}.sup-t.new{border-inline-start:3px solid var(--brand)}.sup-h{display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap}.sup-b{white-space:pre-wrap;margin:10px 0}.sup-r{background:var(--soft);border-radius:12px;padding:10px 12px;margin:0 0 10px}.sup-r p{margin:4px 0 0;white-space:pre-wrap}.sup-a{display:flex;gap:6px;flex-wrap:wrap}.btn.bad{color:var(--bad)}
.pe-top{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:14px}.pe-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;align-items:start}
.pe{display:flex;flex-direction:column;gap:6px}.pe.pe-new{border-style:dashed;opacity:.85}.pe-h{display:flex;gap:8px;align-items:center}.pe-h .mv{display:flex;gap:2px;flex:none}.pe-h input{flex:1;font-size:18px;font-weight:700;padding:8px 10px}
.pe-sw{display:flex;gap:14px;flex-wrap:wrap;font-size:13.5px;margin:2px 0 4px}.pe-sw label{display:inline-flex;gap:6px;align-items:center;cursor:pointer}
.pe-s{font-size:12px;font-weight:700;color:var(--mut);letter-spacing:.3px;margin:10px 0 2px;padding-top:8px;border-top:1px solid var(--line)}
.pe-r{display:flex;gap:10px;align-items:center;justify-content:space-between;font-size:14px}.pe-r span{flex:1}.pe-r input{width:120px;flex:none;padding:6px 8px}.pe-n input{width:150px}
.pe-f{display:grid;gap:4px}.pe-f label{display:flex;gap:8px;align-items:center;font-size:14px;cursor:pointer}.pe-f label.off{opacity:.55}
.int-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px}.int-s{display:inline-flex;align-items:center;gap:6px;font-size:13px}.int-s i{width:9px;height:9px;border-radius:50%;background:var(--bad)}.int-s i.ok{background:var(--ok)}`;
  document.head.appendChild(st);

  /* ================= 💳 الاشتراك (للمشترك) ================= */
  let BL = null;
  const meter = (label, used, max) => { const inf = !Number.isFinite(max) || max >= 1e9, pct = inf ? 0 : Math.min(100, Math.round(used / max * 100)); return `<div class="meter"><div class="t"><span>${e(label)}</span><span>${num(used)} / ${inf ? '∞' : num(max)}</span></div><div class="b"><i class="${pct > 85 ? 'hot' : ''}" style="width:${inf ? 3 : pct}%"></i></div></div>`; };
  async function drawBilling() {
    const el = $('#x-billing'); if (!el) return;
    try { BL = await X.api('GET', '/billing'); } catch (x) { el.innerHTML = '<p class="sub">تعذّر تحميل الاشتراك.</p>'; return; }
    const me = X.me(), left = Math.ceil((BL.expires_at - Date.now()) / 864e5), adm = me.role === 'admin';
    el.innerHTML = `<h2>الاشتراك</h2><p style="margin:6px 0"><span class="pill ${me.active ? 'ok' : 'bad'}">${e(adm ? 'مدير' : BL.plan && BL.plan !== 'none' ? BL.plan : 'بلا باقة')}</span>
${adm ? '<span class="sub"> حساب مدير، بلا انتهاء ولا حدود.</span>' : `<span class="sub"> ${me.active ? '<span>ينتهي في</span> ' + X.fd(BL.expires_at) + ' · <span>باقي ' + num(left) + ' يوم</span>' : 'منتهٍ'}</span>`}</p>
${!adm && me.active && left <= 5 ? '<div class="alert">⏰ اشتراكك ينتهي قريباً. جدّده الآن حتى لا يتوقف عملك.</div>' : ''}
${(() => { const U = { searchesPerDay: BL.usage.searchesToday, gapProducts: BL.usage.gapProducts, watchPages: BL.usage.watchPages, aiPerMonth: BL.usage.aiMonth }, hot = adm ? [] : Object.keys(BL.labels).filter(k => { const mx = BL.limits[k]; return Number.isFinite(mx) && mx > 0 && mx < 1e9 && (U[k] || 0) / mx >= .8; }); return hot.length ? `<div class="alert" style="margin:8px 0">⚠️ اقتربت من حد عرضك في: ${hot.map(k => e(BL.labels[k])).join('، ')}. انتقل إلى عرض أعلى قبل أن يتوقف هذا الاستعمال.</div>` : ''; })()}${Object.keys(BL.labels).map(k => meter(BL.labels[k], ({ searchesPerDay: BL.usage.searchesToday, aiMonth: 0, gapProducts: BL.usage.gapProducts, watchPages: BL.usage.watchPages, aiPerMonth: BL.usage.aiMonth })[k] || 0, BL.limits[k])).join('')}
${adm ? '' : `<div class="pay-sec"><div class="pay-h"><div><h3>الدفع والتجديد</h3><span class="sub">ادفع بالتحويل وأرسل الوصل، أو اطلب الترقية أو التجديد، عبر واتساب.</span></div></div>
${BL.plans.length ? '' : `<p class="sub" style="margin:8px 0 0">لا توجد عروض متاحة للشراء بعد.</p>`}
<div class="wa-l"><div class="wa-lt">${WAICON} عبر واتساب: رسالة جاهزة بمعلومات حسابك</div><div class="wa-lg">
${[['pay', 'إرسال وصل الدفع', 'بعد التحويل عبر BaridiMob أو CCP'], me.active ? ['upgrade', 'ترقية أو تغيير العرض', 'انتقل إلى باقة أخرى'] : null, me.active ? ['renew', 'تجديد الاشتراك', 'مدّد اشتراكك الحالي'] : null, ['billing', 'سؤال عن الدفع أو الاشتراك', 'نجيبك في أقرب وقت']].filter(Boolean)
  .map(([k, t, h]) => `<button type="button" class="wa-i" data-wac="${k}"><b>${t}</b><small>${h}</small></button>`).join('')}</div></div>
${(BL.methods.satim || BL.methods.stripe || BL.methods.paypal) && BL.plans.length ? '<div class="card" id="cpay" style="margin:14px 0 0"></div>' : ''}</div>`}
${BL.payments.length ? `<details class="fx" id="pay-hist" style="margin-top:10px"><summary>سجل المدفوعات (${num(BL.payments.length)})</summary><div class="tbw"><table class="tb"><tr><th>الباقة</th><th>المبلغ</th><th>الطريقة</th><th>الحالة</th><th>التاريخ</th><th></th></tr>${BL.payments.map(p => `<tr><td>${e(p.plan_name)}</td><td>${money(p.amount, p.currency)}</td><td>${MT[p.method] || e(p.method)}</td><td><span class="pill ${(ST[p.status] || [''])[0]}">${(ST[p.status] || ['', p.status])[1]}</span>${p.note ? '<br><small>' + e(p.note) + '</small>' : ''}</td><td>${X.fd(p.created_at)}</td><td>${p.del ? `<button class="btn ghost sm" data-paydel="${p.id}">حذف</button>` : ''}</td></tr>`).join('')}</table></div><p class="sub" style="margin:6px 0 0">الطلبات المرفوضة أو قيد المراجعة يمكن حذفها. الدفعات المقبولة تبقى في السجل.</p></details>` : ''}`;
    cardPay($('#cpay'));
  }
  function cardPay(el) {
    if (!el) return;
    const cur = BL.plans.find(x => x.name === BL.plan);
    let sel = (cur || BL.plans.find(x => x.note) || BL.plans[0]).id, mon = defMonths();
    const draw = () => {
      const p = BL.plans.find(x => x.id === +sel) || BL.plans[0], ms = (BL.periods || []).filter(z => perOf(p, z.m));
      if (!ms.some(z => +z.m === +mon)) mon = (ms[0] || {}).m; const x = perOf(p, mon) || {};
      el.innerHTML = `<b>💳 الدفع بالبطاقة</b><p class="sub" style="margin:4px 0 8px">ادفع مباشرة عبر بوابة آمنة، ويُفعَّل عرضك فور نجاح الدفع.</p>
<div class="grid2" style="margin:0"><label class="fl">العرض<select data-cp="plan">${BL.plans.map(q => `<option value="${q.id}"${q.id === p.id ? ' selected' : ''}>${e(q.name)}${cur && q.id === cur.id ? ' (عرضك الحالي)' : ''}</option>`).join('')}</select></label>
<label class="fl">المدة<select data-cp="mon">${ms.map(z => { const pz = perOf(p, z.m); return `<option value="${z.m}"${+z.m === +mon ? ' selected' : ''}>${perName(z.m)} · ${dz(pz.dzd)}${z.off ? ' (−' + z.off + '%)' : ''}</option>`; }).join('')}</select></label></div>
<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">${BL.methods.satim && x.dzd > 0 ? `<button class="btn" data-cpay="satim">CIB / الذهبية · ${dz(x.dzd)}</button>` : ''}${BL.methods.stripe && x.usd > 0 ? `<button class="btn" data-cpay="stripe">Visa / Mastercard · $${Number(x.usd).toFixed(2)}</button>` : ''}${BL.methods.paypal && x.usd > 0 ? `<button class="btn ghost" data-cpay="paypal">PayPal · $${Number(x.usd).toFixed(2)}</button>` : ''}</div>`;
    };
    el.onchange = ev => { const c = ev.target.dataset.cp; if (c === 'plan') sel = +ev.target.value; else if (c === 'mon') mon = +ev.target.value; else return; draw(); };
    el.onclick = ev => { const b = ev.target.closest('[data-cpay]'); if (!b) return;
      const pr = X.api('POST', '/billing/checkout', { plan_id: +sel, months: +mon, method: b.dataset.cpay }).then(r => { location.href = r.url; }).catch(x => X.toast(x.message, 'err'));
      W.__btnBusy && W.__btnBusy(ev, pr); };
    draw();
  }
  /* ================= 💬 واتساب: رسائل جاهزة يضبطها المدير ================= */
  let WA = null;
  const waLoad = async () => (WA = WA || await X.api('GET', '/wa'));
  const waFill = (k, v) => { const L = W.__LANG || 'ar', t = (WA.templates[k] || {})[L] || (WA.templates[k] || {}).ar || ''; return t.replace(/\{(\w+)\}/g, (m, n) => v[n] != null && v[n] !== '' ? String(v[n]) : '—'); };
  const waUrl = text => 'https://wa.me/' + WA.number + '?text=' + encodeURIComponent(text);
  const WAICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm4.5 12.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.4-3c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2s.2-1.1.1-1.2-.2-.2-.4-.3z"/></svg>';
  const WAT = { pay: 'إرسال وصل الدفع', upgrade: 'ترقية أو تغيير العرض', renew: 'تجديد الاشتراك', billing: 'سؤال عن الدفع أو الاشتراك', support: 'طلب مساعدة' };
  // key: نوع الرسالة. o.plan: العرض المختار مسبقاً، o.topic: نوع طلب الدعم
  async function waModal(key, o) {
    o = o || {}; await waLoad(); const T = W.WPRTOOLS; if (!T) return;
    if (!WA.number) return X.toast('رقم واتساب الدعم غير مضبوط بعد', 'err');
    if (['pay', 'upgrade', 'renew', 'billing'].includes(key) && !BL) BL = await X.api('GET', '/billing');
    const me = X.me(), paid = BL ? BL.plans.filter(x => x.price > 0 || x.price_usd > 0) : [], cur = BL ? (BL.plan && BL.plan !== 'none' ? BL.plan : '') : '';
    const curPlan = paid.find(x => x.name === cur), others = key === 'upgrade' ? paid.filter(x => x.name !== cur) : paid;
    let sel = o.plan || (key === 'renew' && curPlan ? curPlan.id : (others[0] || {}).id), mon = o.months || defMonths(), dirty = false;
    const TOP = { tech: 'مشكلة تقنية', billing: 'الدفع والعروض', usage: 'سؤال عن الاستعمال', idea: 'اقتراح', other: 'أخرى' };
    const b = T.open(WAT[key], '');
    const vars = () => { const p = paid.find(x => x.id === +sel) || {}, z = perOf(p, mon) || {}, f = b.querySelector('#wa-store'), tp = b.querySelector('#wa-topic');
      return { name: me.name || '', email: me.email, plan: p.name ? p.name + ' · ' + perName(z.m || mon) : '', days: z.days || '', amount: z.dzd > 0 ? dz(z.dzd) : z.usd > 0 ? '$' + Number(z.usd).toFixed(2) : '', current: cur || '—',
        expires: BL && BL.expires_at ? X.fd(BL.expires_at) : '—', store: f ? f.value.trim() : '', request: '…', topic: tp ? (TOP[tp.value] || '') : '' }; };
    const needPlan = ['pay', 'upgrade', 'renew'].includes(key);
    b.innerHTML = `<div class="wa-m">${needPlan ? (others.length ? `<label class="fl">${key === 'upgrade' ? 'العرض الذي تريده' : 'العرض'}<select id="wa-plan">${others.map(x => `<option value="${x.id}"${x.id === +sel ? ' selected' : ''}>${e(x.name)} · ${dz(x.price)} / شهرياً</option>`).join('')}</select></label>
<label class="fl">المدة<select id="wa-mon">${(BL.periods || []).map(z => { const pz = perOf(paid.find(x => x.id === +sel), z.m); return pz ? `<option value="${z.m}"${+z.m === +mon ? ' selected' : ''}>${perName(z.m)} · ${dz(pz.dzd)}${z.off ? ' (−' + z.off + '%)' : ''}</option>` : ''; }).join('')}</select></label>` : '<div class="alert">لا توجد عروض مدفوعة بعد.</div>') : ''}
${key === 'pay' ? `${BL.methods.baridi ? `<div class="alert info" style="white-space:pre-wrap;margin:0" translate="no" dir="auto">${e(BL.methods.baridi)}</div>` : ''}<label class="fl">اسم متجرك<input id="wa-store" maxlength="80" dir="auto" placeholder="مثال: Boutique Amine"></label>` : ''}
${key === 'support' ? `<label class="fl">نوع الطلب<select id="wa-topic">${Object.entries(TOP).map(([k, t]) => `<option value="${k}"${k === o.topic ? ' selected' : ''}>${t}</option>`).join('')}</select></label>` : ''}
<label class="fl">الرسالة <small class="muted" style="font-weight:400">(يمكنك تعديلها قبل الإرسال)</small><textarea id="wa-text" rows="8" dir="auto"></textarea></label>
<p style="margin:0"><button class="btn wa" data-wa="go">${WAICON} افتح واتساب وأرسل</button></p>
<p class="sub" style="margin:0">${key === 'pay' ? 'يُسجَّل طلبك في المنصة، ثم يفتح واتساب بالرسالة: أرفق صورة الوصل واضغط إرسال. يُفعَّل عرضك عند المراجعة.' : 'يفتح واتساب بالرسالة جاهزة، فقط اضغط إرسال.'}</p></div>`;
    const ta = b.querySelector('#wa-text'), upd = () => { if (!dirty) ta.value = waFill(key, vars()); };
    upd(); ta.addEventListener('input', () => { dirty = true; });
    b.addEventListener('input', ev => { if (ev.target.id === 'wa-store') upd(); });
    b.addEventListener('change', ev => { if (ev.target.id === 'wa-plan' || ev.target.id === 'wa-mon') { if (ev.target.id === 'wa-plan') { sel = +ev.target.value; const pm = paid.find(x => x.id === sel), sm = b.querySelector('#wa-mon');   // مبالغ المدد للباقة الجديدة
          if (sm && pm) [...sm.options].forEach(o => { const z = perOf(pm, o.value); if (z) o.textContent = perName(z.m) + ' · ' + dz(z.dzd) + (z.off ? ' (−' + z.off + '%)' : ''); }); } else mon = +ev.target.value; dirty = false; upd(); } if (ev.target.id === 'wa-topic') { dirty = false; upd(); } });
    b.addEventListener('click', ev => {
      if (!ev.target.closest('[data-wa="go"]')) return;
      if (key === 'pay') {
        const st = b.querySelector('#wa-store'); if (st.value.trim().length < 2) { st.focus(); return X.toast('اكتب اسم متجرك', 'err'); }
        if (!sel) return;
        const win = W.open('', '_blank');                         // يُفتح الآن (قبل الانتظار) حتى لا يمنعه المتصفح
        const pr = X.api('POST', '/billing/baridi', { plan_id: +sel, months: +mon, via: 'whatsapp', store: st.value.trim() }).then(r => {
          const url = waUrl(ta.value.split('#…').join('#' + r.id));
          if (win) win.location.href = url; else location.href = url;
          T.close(); X.toast('أرسل صورة الوصل في واتساب. يُفعَّل عرضك عند الاستلام.'); drawBilling();
        }).catch(x => { if (win) win.close(); X.toast(x.message, 'err'); });
        W.__btnBusy && W.__btnBusy(ev, pr); return;
      }
      W.open(waUrl(ta.value), '_blank', 'noopener'); T.close();
    });
  }
  W.WPRWA = { open: (k, o) => waModal(k, o).catch(x => X.toast(x.message, 'err')), url: async t => { await waLoad(); return WA.number ? waUrl(t) : ''; } };

  // العودة من صفحة الدفع: ننتظر إشعار البوابة ثم نحدّث الحساب
  async function afterReturn() {
    const p = new URLSearchParams(location.search), id = p.get('paid'), fail = p.get('failed');
    if (fail) { X.toast('لم يكتمل الدفع. يمكنك المحاولة مرة أخرى.', 'err'); history.replaceState({}, '', location.pathname); return; }
    if (!id) return;
    history.replaceState({}, '', location.pathname);
    W.__busy && W.__busy('pay', 'جارٍ تأكيد الدفع…');
    try { for (let i = 0; i < 20; i++) { const r = await X.api('GET', '/billing/payment/' + id); if (r.status === 'paid') { X.toast('✅ تم الدفع وتفعيل اشتراكك: ' + r.plan_name); X.reloadMe && await X.reloadMe(); drawBilling(); return; } if (r.status === 'failed') { X.toast('فشل الدفع', 'err'); return; } await new Promise(o => setTimeout(o, 3000)); } X.toast('الدفع قيد التأكيد. سيُفعَّل اشتراكك تلقائياً عند وصول التأكيد.'); }
    catch (x) {} finally { W.__busy && W.__busy('pay'); }
  }

  /* ================= 📨 تواصل المدير مع المشتركين: رسائل جاهزة (يعدّلها المدير) عبر واتساب أو داخل المنصة ================= */
  const ACK = [['a_welcome', 'ترحيب ومساعدة في البدء', 'لمشترك جديد: خطوات البداية'], ['a_paid', 'تأكيد الدفع والتفعيل', 'بعد قبول دفعته'], ['a_receipt', 'مشكلة في وصل الدفع', 'وصل غير واضح أو مبلغ ناقص'], ['a_renew', 'تذكير بالتجديد / انتهاء الاشتراك', 'اشتراك ينتهي قريباً أو انتهى']];
  const acCards = uid => `<div class="wa-lg">${ACK.map(([k, t, h]) => `<button type="button" class="wa-i" data-acon="${k}"${uid ? ` data-uid="${uid}"` : ''}><b>${t}</b><small>${h}</small></button>`).join('')}</div>`;
  async function acModal(key, uid) {
    const T = W.WPRTOOLS; if (!T) return;
    const [AWA, US] = await Promise.all([X.api('GET', '/admin/wa'), X.api('GET', '/admin/users')]);
    const subs = US.filter(u => u.role !== 'admin'); if (!subs.length) return X.toast('لا يوجد مشتركون بعد', 'err');
    let L = W.__LANG || 'ar', sel = +uid || subs[0].id, dirty = false;
    const b = T.open('📨 رسالة إلى مشترك', '');
    const fill = () => { const u = subs.find(x => x.id === +sel) || {}, t = (AWA.templates[key] || {})[L] || '';
      const v = { name: u.name || (u.email || '').split('@')[0], email: u.email || '', current: u.plan && u.plan !== 'none' ? u.plan : '—', expires: u.expires_at ? X.fd(u.expires_at) : '—' };
      return t.replace(/\{(\w+)\}/g, (m, n) => v[n] != null && v[n] !== '' ? String(v[n]) : '—'); };
    b.innerHTML = `<div class="wa-m"><div class="grid2" style="margin:0"><label class="fl">الرسالة الجاهزة<select id="ac-k">${ACK.map(([k, t]) => `<option value="${k}"${k === key ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
<label class="fl">لغة الرسالة<select id="ac-l">${[['ar', 'العربية'], ['fr', 'Français'], ['en', 'English']].map(([k, n]) => `<option value="${k}"${k === L ? ' selected' : ''}>${n}</option>`).join('')}</select></label></div>
<label class="fl">المشترك<select id="ac-u">${subs.map(u => `<option value="${u.id}"${u.id === sel ? ' selected' : ''}>${u.name ? e(u.name) + ' · ' : ''}${e(u.email)}${u.phone ? ' · 📱' : ''}</option>`).join('')}</select></label>
<label class="fl">النص <small class="muted" style="font-weight:400">(يمكنك تعديله قبل الإرسال)</small><textarea id="ac-t" rows="8" dir="auto"></textarea></label>
<p id="ac-ph" class="sub" style="margin:0"></p>
<p style="display:flex;gap:8px;flex-wrap:wrap;margin:0"><button class="btn wa" data-acs="whatsapp">${WAICON} عبر واتساب</button><button class="btn" data-acs="app">إرسال داخل المنصة</button></p>
<p class="sub" style="margin:0">داخل المنصة: تظهر للمشترك في «المساعدة والدعم ← طلباتي» مع تنبيه (وبالبريد/تيليغرام إن فعّلها). واتساب: يُفتح برسالة جاهزة إلى رقمه.</p></div>`;
    const ta = b.querySelector('#ac-t'), upd = () => { if (!dirty) ta.value = fill(); const u = subs.find(x => x.id === +sel) || {};
      b.querySelector('#ac-ph').innerHTML = u.phone ? `رقم واتساب: <bdi dir="ltr">${e(u.phone)}</bdi>` : 'لا يوجد رقم هاتف لهذا المشترك (يضيفه من «الإعدادات»)، فواتساب غير متاح له.'; b.querySelector('[data-acs="whatsapp"]').disabled = !u.phone; };
    upd(); ta.addEventListener('input', () => { dirty = true; });
    b.addEventListener('change', ev => { const id = ev.target.id; if (id === 'ac-u') sel = +ev.target.value; else if (id === 'ac-l') L = ev.target.value; else if (id === 'ac-k') key = ev.target.value; else return; dirty = false; upd(); });
    b.addEventListener('click', ev => {
      const s = ev.target.closest('[data-acs]'); if (!s) return;
      const via = s.dataset.acs, subject = (ACK.find(x => x[0] === key) || [])[1], win = via === 'whatsapp' ? W.open('', '_blank') : null;   // تُفتح الآن حتى لا يمنعها المتصفح
      const pr = X.api('POST', '/admin/contact', { user_id: +sel, via, text: ta.value.trim(), subject }).then(r => {
        if (via === 'whatsapp') { const url = 'https://wa.me/' + r.phone + '?text=' + encodeURIComponent(ta.value); if (win) win.location.href = url; else location.href = url; }
        T.close(); X.toast(via === 'whatsapp' ? 'فُتح واتساب برسالة جاهزة' : 'أُرسلت الرسالة إلى المشترك داخل المنصة');
        if (X.cur() === 'ainbox') drawAdmin();
      }).catch(x => { if (win) win.close(); X.toast(x.message, 'err'); });
      W.__btnBusy && W.__btnBusy(ev, pr);
    });
  }
  W.WPRACON = { cards: acCards, open: (k, u) => acModal(k, u).catch(x => X.toast(x.message, 'err')) };

  /* ================= لوحة المدير ================= */
  // كل قسم إداري في مكانه: نظرة عامة · المشتركون · العروض والمدفوعات · صندوق الدعم · إعدادات المنصة
  const AV = {
    aover: [['stats', '']],
    abill: [['pay', 'طلبات الدفع'], ['plans', 'العروض والمميزات'], ['methods', 'طرق الدفع']],
    ainbox: [['msgs', '']],
    aset: [['general', 'النشاط والتواصل'], ['wa', 'رسائل واتساب'], ['ai', 'الذكاء الاصطناعي'], ['tg', 'التنبيهات'], ['legal', 'الصفحات القانونية'], ['backup', 'النسخ الاحتياطي'], ['maint', 'وضع الصيانة'], ['err', 'سجل الأخطاء']]
  };
  const ABASE = { aover: '/admin', abill: '/payments', ainbox: '/support-inbox', aset: '/platform' };
  let AVIEW = 'aover', ATAB = 'stats', MF = 'new';
  let LG = { lang: 'ar', doc: 'terms' };
  const loadLegal = () => W.LEGAL_D ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement('script'); s.src = '/legal-texts.js'; s.onload = ok; s.onerror = () => no(new Error('تعذّر تحميل النصوص')); document.head.appendChild(s); });
  function adminView(v, sub) {
    AVIEW = v; const T = AV[v]; ATAB = (T.find(t => t[0] === sub) || T[0])[0];
    const bar = $('#t-' + v);
    if (bar) { bar.hidden = T.length < 2; bar.innerHTML = T.map(([k, t]) => `<button data-adm="${k}" class="${ATAB === k ? 'on' : ''}">${t}</button>`).join(''); }
    return drawAdmin().catch(x => { if (x.message !== 'auth') X.toast(x.message, 'err'); });
  }
  // حالة البريد: الإعدادات الحالية وآخر محاولة إرسال (نجحت أو فشلت ولماذا)
  async function mailStatus() {
    const el = $('#mail-st'); if (!el) return;
    try {
      const j = await X.api('GET', '/admin/mail-status'), L = j.last;
      el.innerHTML = !j.configured ? '<div class="alert err">البريد غير مضبوط: أضف إعدادات SMTP في ملف .env ثم أعد تشغيل المنصة.</div>'
        : `<div class="sub" dir="auto">الخادم: <code dir="ltr">${e(j.host)}:${e(j.port)}</code> · المستخدم: <code dir="ltr">${e(j.user)}</code> · المرسِل: <code dir="ltr">${e(j.from)}</code>${j.cert ? ` · اسم الشهادة المعتمد: <code dir="ltr">${e(j.cert)}</code> <button class="btn ghost sm" data-int="mailcert" data-n="">إلغاء</button>` : ''}</div>` +
          (!L ? '<div class="sub" style="margin-top:4px">لم تُرسل أي رسالة منذ آخر تشغيل للمنصة.</div>'
            : L.ok ? `<div class="alert ok" style="margin-top:8px">آخر إرسال (${e(X.ago(L.at))} إلى ${e(L.to)}) قَبِله الخادم. ردّه: <code dir="ltr">${e(L.response)}</code></div>`
            : `<div class="alert err" style="margin-top:8px">آخر إرسال (${e(X.ago(L.at))} إلى ${e(L.to)}) فشل: <code dir="ltr">${e(L.error)}</code>${L.hint ? '<br>الحل: ' + e(L.hint) : ''}</div>`);
    } catch (x) { el.textContent = ''; }
  }
  async function drawAdmin() {
    const el = $('#x-' + AVIEW); if (!el) return; el.innerHTML = '<div class="card"><p class="sub">جارٍ التحميل…</p></div>';
    if (['methods', 'general', 'ai', 'tg'].includes(ATAB)) {
      const c = cfgUI(await X.api('GET', '/admin/config').catch(() => null));
      const intro = { methods: 'الطرق التي يراها المشترك عند الدفع أو تغيير العرض. تظهر كل طريقة فقط بعد ضبطها.', general: 'معلومات نشاطك وطرق التواصل: تظهر في الصفحات القانونية وصفحة المساعدة وزر واتساب.', ai: 'يُستعمل في تحليل الإعلان، «الخروج من المنافسة»، التعرّف على المنتج من صورته، واقتراح عبارات البحث.', tg: 'بوت تيليغرام يرسل التنبيهات للمشتركين. البريد يُضبط في إعدادات الخادم (SMTP).' }[ATAB];
      const pick = { methods: ['baridi', 'satim', 'stripe', 'paypal'], general: ['biz', 'platform', 'analytics'], ai: ['ai'], tg: ['tg'] }[ATAB];
      const mail = ATAB === 'tg' ? `<div class="card" id="mail-c"><h2>البريد (SMTP)</h2><p class="sub">يرسل رسائل استعادة كلمة المرور والتنبيهات. يُضبط في ملف <code>.env</code> على الخادم: SMTP_HOST، SMTP_PORT، SMTP_USER، SMTP_PASS، MAIL_FROM.</p>
<div id="mail-st" class="sub">…</div>
<div class="row" style="align-items:flex-end;margin-top:10px"><label class="grow">أرسل بريداً تجريبياً إلى<input id="mail-to" type="email" dir="ltr" placeholder="you@gmail.com"></label><button class="btn sm" data-int="mailtest">إرسال</button><button class="btn ghost sm" data-int="maildns">فحص إعدادات الدومين</button></div>
<p class="sub" style="margin-top:6px">جرّب بريداً على Gmail: إن وصل إلى بريد الدومين ولم يصل إلى Gmail فالسبب غالباً SPF/DKIM، وإشعار الرفض يصل إلى صندوق بريد الإرسال نفسه (Webmail).</p><div id="mail-r"></div></div>` : '';
      el.innerHTML = `<p class="sub" style="margin:0 0 12px"><span>${intro}</span> <span>المفاتيح السرية تُحفظ مشفّرة ولا تظهر كاملة بعد الحفظ.</span></p><div class="int-g">${pick.map(k => c[k]).join('')}${mail}</div>`;
      if (mail) mailStatus();
      return;
    }
    if (ATAB === 'stats') {
      const s = await X.api('GET', '/admin/stats'), S = s.subs || {}, Wk = s.work || {}, Mo = s.money || {}, Sy = s.system || {};
      const flag = window.WPRU.flag;
      let DN = null; try { DN = new Intl.DisplayNames([W.__LANG || 'ar'], { type: 'region' }); } catch (x) {}
      const cname = c => c === '?' || !c ? 'غير معروف' : (DN ? DN.of(c) : c), LGN = { ar: 'العربية', en: 'English', fr: 'Français', '?': 'غير معروف' };
      const kp = (n, l, cls) => `<div class="${cls || ''}"><b>${n}</b><span>${l}</span></div>`;
      const bars = (arr, val, lab, tip) => { const mx = Math.max(1, ...arr.map(val)); return `<div class="bars">${arr.map(r => `<div title="${e(tip(r))}"><small>${val(r) ? num(val(r)) : ''}</small><i style="height:${Math.round(val(r) / mx * 110)}px"></i><span>${e(lab(r))}</span></div>`).join('')}</div>`; };
      const hb = (arr, k, lab) => { const mx = Math.max(1, ...arr.map(x => x[k])); return arr.map(x => `<div class="st-hb"><span>${lab(x)}</span><i><s style="width:${Math.round(x[k] / mx * 100)}%"></s></i><b>${num(x[k])}</b></div>`).join('') || '<p class="sub">لا بيانات بعد.</p>'; };
      const ago = t => t ? X.ago(t) : '—', mb = n => (n / 1048576).toFixed(1) + ' MB', up = x => x > 86400 ? Math.floor(x / 86400) + ' يوم' : x > 3600 ? Math.floor(x / 3600) + ' ساعة' : Math.floor(x / 60) + ' دقيقة';
      el.innerHTML = `<div class="kpis st-k">${kp(num(S.online), 'متصل الآن', 'ok')}${kp(num(S.paidActive), 'مشترك يدفع (نشط)')}${kp(num(S.trialActive), 'في التجربة المجانية')}${kp(num(S.expired), 'اشتراك منتهٍ')}${kp(num(S.members), 'كل المشتركين')}${kp(S.conv + '%', 'نسبة التحويل إلى الدفع')}</div>
<div class="kpis st-k" style="margin-top:10px">${kp(num(S.new1), 'تسجيلات اليوم')}${kp(num(S.new7), 'تسجيلات 7 أيام')}${kp(num(S.new30), 'تسجيلات 30 يوماً')}${kp(num(S.dau), 'نشطون اليوم')}${kp(num(S.wau), 'نشطون هذا الأسبوع')}${kp(num(s.expiring7), 'ينتهي خلال 7 أيام', s.expiring7 ? 'warn' : '')}</div>
<div class="card" style="margin-top:14px"><h2>التسجيلات الجديدة (30 يوماً)</h2>${bars(s.regs, r => r.n, r => r.d.slice(8), r => r.d + ': ' + r.n)}</div>
<div class="grid2" style="margin-top:14px"><div class="card"><h2>البلدان</h2><p class="sub" style="margin:0 0 8px">بلد المشترك من متصفحه (المنطقة الزمنية واللغة). «النشط» = اشتراكه ساري.</p>${hb(s.geo.countries, 'n', x => `${flag(x.c)} ${e(cname(x.c))} <small class="muted">${num(x.a)} نشط</small>`)}</div>
<div class="card"><h2>لغة الواجهة</h2>${hb(s.geo.langs, 'n', x => e(LGN[x.l] || x.l))}<h2 style="margin-top:16px">الأسواق المستهدفة (ثغرات السوق)</h2>${hb(s.geo.targets, 'n', x => `${flag(x.c)} ${e(cname(x.c))}`)}</div></div>
<div class="card" style="margin-top:14px"><h2>الإيرادات</h2><div class="kpis">${kp(dz(s.revenueMonth), 'هذا الشهر (دج)')}${kp('$' + Number(s.revenueMonthUsd || 0).toFixed(2), 'هذا الشهر ($)')}${kp(dz(Mo.totalDzd || 0), 'منذ البداية (دج)')}${kp(num(s.pending) + ' · ' + dz(Mo.pendingAmount || 0), 'طلبات دفع بانتظارك', s.pending ? 'warn' : '')}</div>
${bars(s.revenue, r => r.a, r => r.m.slice(5), r => r.m + ': ' + dz(r.a) + ' · ' + r.n + ' دفعة')}
<div class="grid2" style="margin-top:10px"><div><b>حسب طريقة الدفع</b>${hb(Mo.byMethod || [], 'n', x => e((MT[x.method] || x.method) + ' · ' + (x.cur === 'USD' ? '$' + Number(x.a).toFixed(2) : dz(x.a))))}</div><div><b>حسب المدة المدفوعة</b>${hb(Mo.byPeriod || [], 'n', x => e((x.days >= 365 ? '12 شهراً' : x.days >= 180 ? '6 أشهر' : x.days >= 90 ? '3 أشهر' : 'شهر') + ' · ' + dz(x.a)))}</div></div></div>
<div class="grid2" style="margin-top:14px"><div class="card"><h2>المشتركون النشطون حسب الباقة</h2>${hb(s.plans, 'n', x => e(x.plan || '—'))}<p class="sub" style="margin-top:8px">${num(S.paidEver)} مشترك دفع مرة على الأقل · ${num(S.tfa)} فعّلوا التحقق بخطوتين</p></div>
<div class="card"><h2>ما يجري في المنصة</h2><div class="st-l">
${[['الإعلانات المجلوبة اليوم', Wk.adsToday], ['الإعلانات المجلوبة (7 أيام)', Wk.ads7], ['الإعلانات المجلوبة (30 يوماً)', Wk.ads30], ['كل الإعلانات المخزّنة', Wk.adsAll], ['عمليات البحث اليوم', s.usage.searchesToday], ['عمليات البحث (30 يوماً)', s.usage.searches30], ['دفعات جمع (30 يوماً)', Wk.batches30], ['تحليلات (30 يوماً)', Wk.analyses30], ['منتجات محفوظة', Wk.saved], ['إعلانات مستبعدة (علامات تجارية)', Wk.excluded],
  ['طلبات الذكاء الاصطناعي هذا الشهر', Wk.ai], ['تحليل إعلان بالذكاء (30 يوماً)', Wk.aiAd], ['«الخروج من المنافسة» (30 يوماً)', Wk.edge30], ['منتجات «ثغرات السوق»', Wk.gapProducts], ['فحوص الثغرات (7 أيام)', Wk.gapScans7], ['صفحات منافسين مراقَبة', Wk.watchPages], ['فحوص المراقبة (7 أيام)', Wk.watchScans7], ['بحوث TikTok (30 يوماً)', Wk.ttRuns30], ['فيديوهات TikTok المخزّنة', Wk.ttItems], ['بحوث المورّد', Wk.supplier], ['رسائل دعم جديدة', Wk.supportNew], ['تنبيهات أُرسلت (7 أيام)', Wk.notify7]]
  .map(([l, v]) => `<div><span>${e(l)}</span><b>${num(v || 0)}</b></div>`).join('')}</div></div></div>
<div class="grid2" style="margin-top:14px"><div class="card"><h2>الإعلانات المجلوبة حسب السوق (30 يوماً)</h2>${hb(Wk.adsByCountry || [], 'n', x => `${flag(x.c)} ${e(cname(x.c))}`)}</div>
<div class="card"><h2>النظام والخلفية</h2><div class="st-l">${[['الإصدار', Sy.version], ['Node.js', Sy.node], ['يعمل منذ', up(Sy.uptime || 0)], ['الذاكرة المستعملة', (Sy.mem || 0) + ' MB'], ['حجم قاعدة البيانات', mb(Sy.dbSize || 0)],
  ['آخر نسخة احتياطية', Sy.lastBackup ? ago(Sy.lastBackup.at) + ' · ' + mb(Sy.lastBackup.size) + ' · ' + num(Sy.lastBackup.count) + ' نسخ' : 'لا توجد'], ['أخطاء آخر 24 ساعة', num(s.errors.day)], ['وضع الصيانة', Sy.maint ? 'مفعّل' : 'متوقف']].map(([l, v]) => `<div><span>${e(l)}</span><b dir="auto">${e(v)}</b></div>`).join('')}</div>
<p style="margin:10px 0 0;display:flex;gap:8px;flex-wrap:wrap"><a class="btn ghost sm" href="/platform/err" data-adm-go="err">سجل الأخطاء</a><a class="btn ghost sm" href="/platform/backup">النسخ الاحتياطي</a><a class="btn ghost sm" href="/platform/maint">وضع الصيانة</a></p></div></div>
<div class="card" style="margin-top:14px"><h2>أنشط المشتركين (30 يوماً)</h2><div class="tbw"><table class="tb"><tr><th>المشترك</th><th>البلد</th><th>الباقة</th><th>عمليات البحث</th><th>إعلانات مجلوبة</th><th>آخر نشاط</th></tr>${(s.top || []).map(u => `<tr><td><b>${e(u.name || '—')}</b><br><small dir="ltr">${e(u.email)}</small></td><td>${flag(u.country)} ${e(u.country ? cname(u.country) : '—')}</td><td>${e(u.plan || '—')}</td><td>${num(u.searches)}</td><td>${num(u.ads)}</td><td>${ago(u.last_seen)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">لا نشاط بعد.</td></tr>'}</table></div></div>`;
      return;
    }
    if (ATAB === 'pay') {
      const L = await X.api('GET', '/admin/payments'), pend = L.filter(p => p.status === 'pending');
      el.innerHTML = `${pend.length ? `<div class="alert info">${num(pend.length)} طلب بانتظار مراجعتك.</div>` : ''}<div class="tbw"><table class="tb"><tr><th>المشترك</th><th>الباقة</th><th>المبلغ</th><th>الطريقة</th><th>رقم العملية / الوصل</th><th>الحالة</th><th>التاريخ</th><th></th></tr>${L.map(p => `<tr><td>${e(p.email || '—')}</td><td>${e(p.plan_name)} · ${num(p.days)} يوماً</td><td>${money(p.amount, p.currency)}</td><td>${MT[p.method] || e(p.method)}</td><td dir="ltr">${e(p.ref || '')}${p.proof ? ` <a href="/api/admin/payments/${p.id}/proof" target="_blank" rel="noopener">🧾 الوصل</a>` : ''}</td><td><span class="pill ${(ST[p.status] || [''])[0]}">${(ST[p.status] || ['', p.status])[1]}</span>${p.note ? '<br><small>' + e(p.note) + '</small>' : ''}</td><td>${X.fd(p.created_at)}</td>
<td>${p.status === 'pending' ? `<button class="btn sm" data-adm="approve" data-id="${p.id}">✓ قبول وتفعيل</button> <button class="btn danger sm" data-adm="reject" data-id="${p.id}">رفض</button>` : ''}${p.del ? ` <button class="btn ghost sm" data-adm="paydel" data-id="${p.id}">حذف</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="8" class="muted">لا مدفوعات بعد.</td></tr>'}</table></div>`;
    }
    if (ATAB === 'plans') {
      const r = await X.api('GET', '/admin/plans'), PERS = r.periods || [];
      const auto = (p, m) => { const per = PERS.find(x => +x.m === +m) || { off: 0 }, base = (+p.price || 0) * m; return per.off ? Math.round(base * (1 - per.off / 100) / 100) * 100 : base; };
      // كل باقة بطاقة: الاسم والحالة، السعر الشهري، مبلغ كل مدة (تلقائي بالخصم أو يدوي)، الحدود، المميزات
      const row = p => `<div class="card pe${p.id ? '' : ' pe-new'}" data-pl="${p.id || ''}">
<div class="pe-h"><input data-f="name" value="${e(p.name || '')}" placeholder="${p.id ? 'اسم الباقة' : '+ باقة جديدة: اكتب اسمها'}" aria-label="اسم الباقة">${p.free ? '<span class="pill ok">تجربة مجانية</span>' : ''}${p.id ? '<span class="mv"><button type="button" class="btn ghost sm" data-adm="plmv" data-d="-1" title="قبلها" aria-label="تحريك قبلها">→</button><button type="button" class="btn ghost sm" data-adm="plmv" data-d="1" title="بعدها" aria-label="تحريك بعدها">←</button></span>' : ''}</div>
<div class="pe-sw"><label><input data-f="active" type="checkbox"${p.active !== false ? ' checked' : ''}> مفعّلة (تظهر للشراء)</label><label title="تُمنح تلقائياً عند التسجيل"><input data-f="free" type="checkbox"${p.free ? ' checked' : ''}> مجانية للتجربة</label></div>
<div class="pe-s">${p.free ? 'مدة التجربة' : 'السعر الشهري'}</div>
<div class="pe-r"${p.free ? '' : ' hidden'}><span>مدة التجربة (أيام)</span><input data-f="days" type="number" min="1" value="${e(p.days || 7)}"></div>
<div class="pe-r"${p.free ? ' hidden' : ''}><span>السعر الشهري بالدينار (دج)</span><input data-f="price" type="number" min="0" value="${e(p.price || 0)}"></div>
<div class="pe-r"${p.free ? ' hidden' : ''}><span>السعر الشهري بالدولار ($)</span><input data-f="price_usd" type="number" min="0" step="0.01" value="${e(p.price_usd || 0)}"></div>
${p.free ? '' : `<div class="pe-s">مبلغ كل مدة (دج) <small class="muted" style="font-weight:400">فارغ = تلقائي بالخصم</small></div>${PERS.filter(x => +x.m > 1).map(x => `<div class="pe-r"><span>${perName(x.m)}${x.off ? ` <small class="muted"><bdi dir="ltr">-${x.off}%</bdi></small>` : ''}</span><input data-t="${x.m}" type="number" min="0" value="${e((p.totals || {})[x.m] || '')}" placeholder="${num(auto(p, x.m))}"></div>`).join('')}`}
<div class="pe-s">الحدود</div>
${r.keys.map(k => `<div class="pe-r"><span>${e(r.labels[k])}</span><input data-l="${k}" type="number" min="0" value="${e(p.limits && +p.limits[k] >= 0 ? p.limits[k] : '')}" placeholder="بلا حد"></div>`).join('')}<p class="sub" style="margin:2px 0 0;font-size:12px">اتركه فارغاً = بلا حد · 0 = غير متاح في هذه الباقة</p>
<div class="pe-s">المميزات المشمولة</div>
<div class="pe-f">${r.cat.map(f => `<label class="${f.shown ? '' : 'off'}" title="${f.shown ? '' : 'مخفية من صفحة الأسعار'}"><input type="checkbox" data-ft="${e(f.k)}"${!p.features || p.features.includes(f.k) ? ' checked' : ''}> ${e(f.ar)}</label>`).join('')}</div>
<div class="pe-r pe-n"><span>شارة في صفحة الأسعار</span><input data-f="note" value="${e(p.note || '')}" placeholder="مثلاً: الأكثر طلباً"></div></div>`;
      const frow = f => `<tr data-fk="${e(f.k || '')}"><td><input data-g="ar" value="${e(f.ar || '')}" placeholder="بالعربية" style="width:190px"></td><td><input data-g="en" dir="ltr" value="${e(f.en || '')}" placeholder="English" style="width:170px"></td><td><input data-g="fr" dir="ltr" value="${e(f.fr || '')}" placeholder="Français" style="width:170px"></td>
<td style="text-align:center"><input type="checkbox" data-g="shown"${f.shown !== false ? ' checked' : ''}></td><td style="white-space:nowrap">${f.k ? '<button type="button" class="btn ghost sm" data-adm="fmv" data-d="-1" title="أعلى" aria-label="أعلى">↑</button><button type="button" class="btn ghost sm" data-adm="fmv" data-d="1" title="أسفل" aria-label="أسفل">↓</button>' : ''}</td><td>${f.builtin ? '<small class="muted">ميزة من المنصة</small>' : f.k ? '<button class="btn danger sm" data-adm="fdel">حذف</button>' : '<small class="muted">جديدة</small>'}</td></tr>`;
      const prow = x => `<div class="pe-r" data-per><span>المدة</span><select data-pm style="width:130px">${[1, 2, 3, 4, 6, 9, 12, 18, 24].map(m => `<option value="${m}"${+x.m === m ? ' selected' : ''}>${perName(m)}</option>`).join('')}</select><span>الخصم %</span><input data-po type="number" min="0" max="90" value="${e(x.off || 0)}" style="width:80px"><button class="btn ghost sm" data-adm="pdel" title="حذف">×</button></div>`;
      el.innerHTML = `<div class="pe-top"><div class="grow"><h2 style="margin:0">الباقات والأسعار</h2><p class="sub" style="margin:4px 0 0">كل باقة لها سعر شهري، والمشترك يختار المدة (شهر، 3، 6، 12 شهراً) فيأخذ خصمها. السعر بالدينار لـ BaridiMob وCCP والتحويل وCIB/الذهبية، وبالدولار لـ Stripe وPayPal. الباقة «المجانية للتجربة» تُمنح لكل مسجّل جديد. الحدود تطبَّق فوراً على كل مشترك في الباقة.</p></div><button class="btn" data-adm="saveall">حفظ كل التغييرات</button></div>
<div class="card" style="margin-bottom:14px"><h2>المدد والخصومات</h2><p class="sub">تظهر للزبون كأزرار فوق الأسعار (مثلاً «6 أشهر −8٪»). الخصم يُحسب على السعر الشهري، ويمكنك كتابة مبلغ دقيق لكل مدة داخل بطاقة الباقة.</p><div id="per-t" style="max-width:520px">${PERS.map(prow).join('')}</div><p style="margin:8px 0 0"><button class="btn ghost sm" data-adm="padd">+ مدة</button></p></div>
<div class="pe-g" id="pl-t">${r.plans.map(row).join('')}${row({})}</div>
<div class="card" style="margin-top:16px"><h2>قائمة المميزات (تظهر للزبائن في صفحة الأسعار)</h2><p class="sub">أضف ميزة جديدة (اكتب اسمها في السطر الفارغ) أو عدّل اسمها أو احذفها، وفعّلها في بطاقات الباقات أعلاه. المميزات «من المنصة» تُطبَّق فعلاً على المشترك حسب باقته، ولا تُحذف لكن يمكن إخفاؤها من صفحة الأسعار.</p>
<div class="tbw"><table class="tb" id="ft-t"><tr><th>الاسم بالعربية</th><th>English</th><th>Français</th><th>تظهر في الأسعار</th><th>الترتيب</th><th></th></tr>${r.cat.map(frow).join('')}${frow({ shown: true })}</table></div>
<label class="fl" style="margin-top:12px;max-width:520px">الميزة غير المشمولة في باقة (غير مؤشّرة في بطاقتها)<select id="ft-miss"><option value="strike"${r.missing !== 'hide' ? ' selected' : ''}>تظهر مشطوبة (ليعرف الزبون ما يكسبه بالترقية)</option><option value="hide"${r.missing === 'hide' ? ' selected' : ''}>تُخفى كلياً من بطاقة تلك الباقة</option></select></label>
<p class="sub" style="margin:4px 0 0">الترتيب هنا هو ترتيب ظهور المميزات في صفحة الأسعار، وترتيب البطاقات أعلاه (الأسهم → ←) هو ترتيب ظهور الباقات.</p></div>
<p style="margin:14px 0 0"><button class="btn" data-adm="saveall">حفظ كل التغييرات</button></p>`;
      el.querySelectorAll('[data-pl] [data-f="free"]').forEach(c => c.onchange = () => { const card = c.closest('[data-pl]'); card.querySelector('[data-f="days"]').closest('.pe-r').hidden = !c.checked; ['price', 'price_usd'].forEach(n => { card.querySelector(`[data-f="${n}"]`).closest('.pe-r').hidden = c.checked; }); });
      return;
    }
    if (ATAB === 'msgs') {
      const r = await X.api('GET', '/admin/messages'), CAT = { tech: 'مشكلة تقنية', billing: 'الدفع والعروض', usage: 'سؤال عن الاستعمال', idea: 'اقتراح', other: 'أخرى' };
      const L = r.list.filter(m => MF === 'all' || (MF === 'new' ? m.status === 'new' : m.status !== 'new'));
      const cnt = { new: r.list.filter(m => m.status === 'new').length, done: r.list.filter(m => m.status !== 'new').length, all: r.list.length };
      el.innerHTML = `<div class="card" style="margin-bottom:14px"><h2>📨 تواصل مع مشترك</h2><p class="sub">رسائل جاهزة (تعدّل نصّها بثلاث لغات من «إعدادات المنصة ← رسائل واتساب»): اختر الرسالة ثم المشترك، وأرسلها عبر واتساب أو داخل المنصة.</p>${acCards()}</div>
<div class="card"><h2>الرسائل الواردة</h2><div class="sup-f">${[['new', 'بانتظار الرد'], ['done', 'تمت معالجتها'], ['all', 'الكل']].map(([k, t]) => `<button data-adm="mf" data-f="${k}" class="${MF === k ? 'on' : ''}">${t} <b>${num(cnt[k])}</b></button>`).join('')}</div>
${L.length ? `<div class="mb-l">${L.map(m => `<button class="mb-r${m.status === 'new' ? ' new' : ''}" data-adm="mopen" data-id="${m.id}"><span class="mb-w"><span class="mb-n" dir="auto">${e(m.name || m.email)}</span><small dir="auto"><b>${e(m.subject)}</b>${m.body ? ' — ' + e(m.body.slice(0, 120)) : ''}</small></span><span class="mb-s"><small class="muted">${X.fd(m.created_at)}</small>${m.origin === 'admin' ? '<span class="pill">📤 أرسلتها أنت</span>' : `<span class="pill ${m.status === 'new' ? 'warn' : 'ok'}">${m.status === 'new' ? 'بانتظار الرد' : m.reply ? 'تم الرد' : 'تمت المعالجة'}</span>`}</span></button>`).join('')}</div>` : '<p class="sub" style="margin:0">لا رسائل هنا.</p>'}</div>`;
      MSGS = r.list; CATS = CAT;
      return;
    }
    if (ATAB === 'wa') {
      const r = await X.api('GET', '/admin/wa'), L3 = [['ar', 'العربية'], ['en', 'English'], ['fr', 'Français']];
      el.innerHTML = `<div class="card"><h2>رسائل واتساب الجاهزة</h2><p class="sub"><span>تظهر للمشترك في «اشتراكي» و«المساعدة والدعم»: يختار الموقف فتُفتح هذه الرسالة في واتساب بمعلومات حسابه، ويستطيع تعديلها قبل الإرسال.</span> <span>تُرسل إلى رقم واتساب الدعم:</span> ${r.number ? `<b><bdi dir="ltr">+${e(r.number)}</bdi></b>` : '<b>(غير مضبوط: أضفه في «النشاط والتواصل»)</b>'}</p>
<p class="sub" style="margin:6px 0 0">الكلمات بين {} تُملأ تلقائياً: ${Object.entries(r.vars).map(([k, v]) => `<code dir="ltr">{${k}}</code> ${e(v)}`).join(' · ')}</p></div>
${Object.entries(r.keys).map(([k, [t, vs, g]], i, A) => `${g === 'admin' && (A[i - 1] || [0, []])[1][2] !== 'admin' ? '<h2 style="margin:26px 0 0">📨 رسائلك إلى المشتركين</h2><p class="sub" style="margin:4px 0 0">تُرسل من «صندوق الدعم» و«المساعدة والدعم» عبر واتساب أو داخل المنصة.</p>' : ''}<div class="card" style="margin-top:14px"><h2>${e(t)}</h2><p class="sub" style="margin:0 0 8px">المتاح هنا: ${vs.map(v => `<code dir="ltr">{${v}}</code>`).join(' ')}</p>
<div class="grid3" style="margin:0">${L3.map(([l, n]) => `<label class="fl">${n}<textarea rows="8" data-wat="${k}" data-l="${l}" dir="${l === 'ar' ? 'rtl' : 'ltr'}" style="font:inherit;font-size:13.5px;line-height:1.7">${e(r.templates[k][l])}</textarea>${r.templates[k][l] !== r.defaults[k][l] ? '<small class="muted">معدّلة</small>' : ''}</label>`).join('')}</div></div>`).join('')}
<p style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 0"><button class="btn" data-adm="wasave">حفظ الرسائل</button><button class="btn ghost" data-adm="wareset">استرجاع الرسائل الأصلية</button></p>`;
      return;
    }
    if (ATAB === 'maint') {
      const r = await X.api('GET', '/maint/info'), loc = v => { if (!v) return ''; const d = new Date(v), z = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + 'T' + z(d.getHours()) + ':' + z(d.getMinutes()); };
      el.innerHTML = `<div class="card"><h2>وضع الصيانة <span class="pill ${r.on ? 'warn' : 'ok'}">${r.on ? 'مفعّل' : 'متوقف'}</span></h2>
<p class="sub">عند التفعيل يرى الزوار والمشتركون صفحة «نُحسّن المنصة الآن» بلغتهم (مع زر واتساب)، وتتوقف الإضافة مؤقتاً. أنت (المدير) تستعمل المنصة عادياً، وصفحة الدخول وإشعارات بوابات الدفع تبقى تعمل. الصفحة تتحدث تلقائياً عند الإيقاف.</p>
<label class="fl" style="flex-direction:row;gap:8px;align-items:center;margin:10px 0"><input type="checkbox" id="mt-on"${r.on ? ' checked' : ''}> <b>تفعيل وضع الصيانة الآن</b></label>
<label class="fl">رسالة للزوار بالعربية <small class="muted" style="font-weight:400">(اختياري: فارغ = الرسالة الافتراضية، والإنجليزية والفرنسية تلقائية)</small><textarea id="mt-msg" rows="3" maxlength="600" placeholder="نقوم بصيانة قصيرة لنقدّم لك منصة أسرع وأفضل. بياناتك ومنتجاتك محفوظة كما هي.">${e(r.msg)}</textarea></label>
<label class="fl" style="max-width:320px">العودة المتوقعة <small class="muted" style="font-weight:400">(اختياري)</small><input type="datetime-local" id="mt-until" value="${e(loc(r.until))}"></label>
<p style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 0"><button class="btn" data-adm="mtsave">حفظ</button><a class="btn ghost" href="/maint-preview" target="_blank" rel="noopener">معاينة صفحة الصيانة ↗</a></p></div>`;
      return;
    }
    if (ATAB === 'legal') {
      const [r] = await Promise.all([X.api('GET', '/admin/legal'), loadLegal()]), k = LG.lang + ':' + LG.doc, cu = r.docs[k], T = { terms: 'شروط الاستخدام', privacy: 'سياسة الخصوصية', refund: 'الاسترداد والإلغاء', contact: 'اتصل بنا' };
      el.innerHTML = `<div class="card"><h2>تعديل الصفحات القانونية</h2><p class="sub">اختر الصفحة واللغة، عدّل النص ثم احفظ. السطر الذي يبدأ بـ <code>#</code> هو عنوان الصفحة، والذي يبدأ بـ <code>##</code> عنوان فقرة، وما تحته نصها. هذه الكلمات تُستبدل تلقائياً: <code>{name}</code> اسم النشاط، <code>{email}</code> بريد الدعم، <code>{wa_line}</code> واتساب، <code>{country}</code> البلد، <code>{days}</code> مدة الاسترداد، <code>{address_line}</code> العنوان (من «الربط والتكامل ← معلومات النشاط والدعم»). ننصح بمراجعتها مع مختص قانوني.</p>
<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0"><select id="lg-doc" style="width:auto">${Object.keys(T).map(d => `<option value="${d}"${d === LG.doc ? ' selected' : ''}>${T[d]}</option>`).join('')}</select><select id="lg-lang" style="width:auto">${[['ar', 'العربية'], ['en', 'English'], ['fr', 'Français']].map(([l, n]) => `<option value="${l}"${l === LG.lang ? ' selected' : ''}>${n}</option>`).join('')}</select>
<span class="pill ${cu ? 'warn' : 'ok'}">${cu ? 'نص معدّل' : 'النص الأصلي'}</span><a class="btn ghost sm" href="/${LG.doc}?lang=${LG.lang}" target="_blank">معاينة الصفحة ↗</a></div>
<textarea id="lg-body" rows="22" dir="${LG.lang === 'ar' ? 'rtl' : 'ltr'}" style="width:100%;font:inherit;font-size:14px;line-height:1.8;border:1px solid var(--line);border-radius:12px;padding:12px;background:var(--card);color:var(--ink)">${e(cu || W.LEGAL_TEXT(W.LEGAL_D[LG.lang][LG.doc]))}</textarea>
<p style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 0"><button class="btn" data-adm="lgsave">حفظ الصفحة</button>${cu ? '<button class="btn ghost" data-adm="lgreset">استرجاع النص الأصلي</button>' : ''}</p></div>`;
      const ch = () => { LG = { doc: $('#lg-doc').value, lang: $('#lg-lang').value }; drawAdmin(); };
      $('#lg-doc').onchange = ch; $('#lg-lang').onchange = ch;
    }
    if (ATAB === 'backup') {
      const r = await X.api('GET', '/admin/backups'), kb = n => num(Math.round(n / 1024)) + ' KB';
      el.innerHTML = `<div class="card"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><h2 style="margin:0;flex:1">النسخ الاحتياطي لقاعدة البيانات</h2><button class="btn sm" data-adm="bknow">إنشاء نسخة الآن</button></div>
<p class="sub">نسخة تلقائية كل يوم، مضغوطة، وتُحفظ آخر ${num(r.keep)} نسخة في <code dir="ltr">${e(r.dir)}</code>. حمّل نسخة إلى حاسوبك أو خدمة سحابية من وقت لآخر: إن تعطّل الخادم نفسه تضيع النسخ التي عليه.</p>
<div class="tbw"><table class="tb"><tr><th>النسخة</th><th>التاريخ</th><th>الحجم</th><th></th></tr>${r.list.map(f => `<tr><td dir="ltr">${e(f.name)}</td><td>${X.fd(f.at)} ${new Date(f.at).toLocaleTimeString((window.__LOC||'ar-DZ'), { hour: '2-digit', minute: '2-digit' })}</td><td>${kb(f.size)}</td><td><a class="btn ghost sm" href="/api/admin/backups/${encodeURIComponent(f.name)}">⬇ تحميل</a></td></tr>`).join('') || '<tr><td colspan="4" class="muted">لا نسخ بعد. أول نسخة تُنشأ تلقائياً خلال دقيقة من تشغيل المنصة.</td></tr>'}</table></div>
<details class="fx" style="margin-top:12px"><summary>كيف أسترجع نسخة؟</summary><ol class="sub" style="line-height:2"><li>أوقف التطبيق من لوحة الاستضافة.</li><li>فك ضغط النسخة (ملف <code>.gz</code>) فتحصل على ملف <code>.db</code>.</li><li>احتفظ بالملف الحالي <code>data.db</code> باسم آخر احتياطاً، ثم ضع النسخة مكانه باسم <code>data.db</code>.</li><li>شغّل التطبيق.</li></ol><p class="sub">الصور المحفوظة ووصولات الدفع في مجلدي <code>images</code> و<code>proofs</code>: انسخهما أيضاً من وقت لآخر.</p></details></div>`;
    }
    if (ATAB === 'err') {
      const s = await X.api('GET', '/admin/stats');
      el.innerHTML = `<div class="card"><div style="display:flex;gap:10px;align-items:center"><h2 style="margin:0;flex:1">سجل الأخطاء</h2>${s.errors.list.length ? '<button class="btn danger sm" data-adm="clearerr">مسح السجل</button>' : ''}</div>
<div class="tbw" style="margin-top:10px"><table class="tb"><tr><th>الوقت</th><th>الطلب</th><th>الرمز</th><th>الرسالة</th><th>المستخدم</th></tr>${s.errors.list.map(x => `<tr><td>${X.fd(x.at)} ${new Date(x.at).toLocaleTimeString((window.__LOC||'ar-DZ'), { hour: '2-digit', minute: '2-digit' })}</td><td dir="ltr">${e(x.method)} ${e(x.path)}</td><td>${num(x.status)}</td><td dir="auto">${e(x.msg)}</td><td>${x.user_id ? '#' + x.user_id : '—'}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">✅ لا أخطاء مسجّلة.</td></tr>'}</table></div></div>`;
    }
  }
  /* صندوق الدعم: نافذة الرسالة — معلومات المرسل، والرد من المنصة أو بالبريد أو بواتساب */
  let MSGS = [], CATS = {};
  function msgOpen(id) {
    const m = MSGS.find(x => x.id === +id), T = W.WPRTOOLS; if (!m || !T) return;
    const NOPH = 'لا يوجد رقم هاتف لهذا المرسل', ph = String(m.phone || '').replace(/[^\d]/g, ''), mine = m.origin === 'admin', canApp = m.user_id && !mine && !m.reply;
    const b = T.open(m.subject || 'رسالة', '');
    b.innerHTML = `<div class="wa-m"><dl class="mb-i" style="margin:0"><dt>الاسم</dt><dd dir="auto">${e(m.name || '—')}</dd><dt>البريد</dt><dd><bdi dir="ltr">${e(m.email)}</bdi></dd><dt>الهاتف</dt><dd>${m.phone ? `<bdi dir="ltr">${e(m.phone)}</bdi>` : '—'}</dd><dt>المرسل</dt><dd>${m.user_id ? 'مشترك' + (m.plan ? ' (' + e(m.plan) + ')' : '') : 'زائر (بلا حساب)'}</dd><dt>التاريخ</dt><dd>${X.fd(m.created_at)}</dd></dl>
<div class="sup-h">${mine ? '<span class="pill">📤 أرسلتها أنت</span>' : `<span class="pill">${CATS[m.category] || CATS.other}</span>`}<span class="pill ${m.status === 'new' ? 'warn' : 'ok'}">${m.status === 'new' ? 'بانتظار الرد' : m.reply ? 'تم الرد' : 'تمت المعالجة'}</span></div>
${m.body ? `<p class="sup-b" dir="auto" style="margin:0">${e(m.body)}</p>` : ''}
${m.reply ? `<div class="sup-r" style="margin:0"><small>${mine ? 'رسالتك' : 'ردّك'} · ${X.fd(m.replied_at)}</small><p dir="auto">${e(m.reply)}</p></div>` : ''}
<label class="fl">${mine || m.reply ? 'رسالة جديدة' : 'ردّك'}<textarea id="mb-t" rows="4" dir="auto" placeholder="اكتب ردّك مرة واحدة، ثم اختر طريقة الإرسال…"></textarea></label>
<div class="mb-a">${canApp ? '<button class="btn" data-mb="app">إرسال داخل المنصة</button>' : ''}<button class="btn wa" data-mb="wa"${ph ? '' : ' disabled title="' + NOPH + '"'}>${WAICON} الرد بواتساب</button><button class="btn ghost" data-mb="mail">الرد بالبريد</button></div>
<p class="sub" style="margin:0">${canApp ? '<span>داخل المنصة: يظهر الرد للمشترك في «المساعدة والدعم» مع تنبيه.</span> ' : ''}${ph ? '<span>واتساب: يُفتح بنص ردّك إلى رقمه ويُحفظ الرد هنا.</span> ' : '<span>واتساب غير متاح: لا يوجد رقم هاتف لهذا المرسل.</span> '}<span>البريد: يفتح برنامج البريد عندك بنص ردّك.</span></p>
<div class="mb-a" style="border-top:1px solid var(--line);padding-top:10px">${m.user_id ? `<button class="btn ghost sm" data-mb="ready">📨 رسالة جاهزة</button>` : ''}${m.status === 'new' ? '<button class="btn ghost sm" data-mb="done">✓ تمت المعالجة</button>' : '<button class="btn ghost sm" data-mb="new">إرجاع كجديدة</button>'}<button class="btn ghost sm bad" data-mb="del">حذف</button></div></div>`;
    const ta = b.querySelector('#mb-t'), act = (path, ok) => X.api('POST', '/admin/messages/' + m.id + '/' + path, {}).then(() => { T.close(); if (ok) X.toast(ok); drawAdmin(); });
    b.addEventListener('click', ev => {
      const k = (ev.target.closest('[data-mb]') || {}).dataset; if (!k || !k.mb) return; const a = k.mb, v = ta.value.trim();
      if ((a === 'app' || a === 'wa') && v.length < 2) { ta.focus(); return X.toast('اكتب الرد أولاً', 'err'); }
      let pr;
      if (a === 'app') pr = X.api('POST', '/admin/messages/' + m.id + '/reply', { reply: v }).then(() => { T.close(); X.toast('أُرسل الرد إلى المشترك'); drawAdmin(); });
      else if (a === 'wa') { const win = W.open('', '_blank');   // تُفتح الآن حتى لا يمنعها المتصفح
        pr = X.api('POST', '/admin/messages/' + m.id + '/reply', { reply: v, via: 'whatsapp' }).then(r => { const url = 'https://wa.me/' + r.phone + '?text=' + encodeURIComponent(v); if (win) win.location.href = url; else location.href = url; T.close(); X.toast('فُتح واتساب بنص ردّك'); drawAdmin(); }).catch(x => { if (win) win.close(); throw x; }); }
      else if (a === 'mail') { location.href = 'mailto:' + m.email + '?subject=' + encodeURIComponent('Re: ' + (m.subject || '')) + (v ? '&body=' + encodeURIComponent(v) : ''); return; }
      else if (a === 'ready') { T.close(); W.WPRACON.open(m.category === 'billing' ? 'a_paid' : 'a_welcome', m.user_id); return; }
      else if (a === 'done' || a === 'new') pr = act(a);
      else if (a === 'del') { if (k.s !== '1') { ev.target.closest('[data-mb]').dataset.s = '1'; ev.target.closest('[data-mb]').textContent = 'تأكيد الحذف؟'; return; } pr = act('delete', 'حُذفت الرسالة'); }
      if (pr) pr.catch(x => X.toast(x.message, 'err'));
    });
  }
  async function onAdmin(ev) {
    const b = ev.target.closest('[data-adm]'); if (!b) return;
    const a = b.dataset.adm;
    if ((AV[AVIEW] || []).some(t => t[0] === a)) { X.url(ABASE[AVIEW] + (a === AV[AVIEW][0][0] ? '' : '/' + a)); return adminView(AVIEW, a); }
    if (a === 'approve') { await X.api('POST', '/admin/payments/' + b.dataset.id + '/approve', {}); X.toast('قُبل الدفع وفُعّل الاشتراك'); return drawAdmin(); }
    if (a === 'paydel') { if (b.dataset.s !== '1') { b.dataset.s = '1'; b.textContent = 'تأكيد الحذف؟'; return; } await X.api('POST', '/admin/payments/' + b.dataset.id + '/delete', {}); X.toast('حُذف طلب الدفع'); return drawAdmin(); }
    if (a === 'reject') { const note = prompt('سبب الرفض (يظهر للمشترك):') || ''; await X.api('POST', '/admin/payments/' + b.dataset.id + '/reject', { note }); return drawAdmin(); }
    if (a === 'mf') { MF = b.dataset.f; return drawAdmin(); }
    if (a === 'mopen') return msgOpen(b.dataset.id);
    if (a === 'wasave' || a === 'wareset') {
      if (a === 'wareset' && !confirm('استرجاع كل الرسائل الأصلية؟ ستُحذف تعديلاتك.')) return;
      const t = {}; if (a === 'wasave') X.root.querySelectorAll('[data-wat]').forEach(x => { (t[x.dataset.wat] = t[x.dataset.wat] || {})[x.dataset.l] = x.value; });
      await X.api('PUT', '/admin/wa', { templates: t }); WA = null; X.toast(a === 'wasave' ? 'حُفظت الرسائل' : 'استُرجعت الرسائل الأصلية'); return drawAdmin();
    }
    if (a === 'mtsave') {
      const on = $('#mt-on').checked; if (on && !confirm('تفعيل وضع الصيانة؟ لن يستطيع المشتركون استعمال المنصة حتى توقفه.')) return;
      const u = $('#mt-until').value; await X.api('PUT', '/admin/maint', { on, msg: $('#mt-msg').value.trim(), until: u ? new Date(u).toISOString() : '' });
      X.toast(on ? 'وضع الصيانة مفعّل' : 'وضع الصيانة متوقف: المنصة متاحة للجميع'); return setTimeout(() => location.reload(), 600);
    }
    if (a === 'lgsave') { await X.api('PUT', '/admin/legal', Object.assign({ body: $('#lg-body').value }, LG)); X.toast('حُفظت الصفحة، وتظهر الآن للزوار'); return drawAdmin(); }
    if (a === 'lgreset') { if (!confirm('استرجاع النص الأصلي لهذه الصفحة؟ سيُحذف تعديلك.')) return; await X.api('PUT', '/admin/legal', Object.assign({ body: '' }, LG)); X.toast('عاد النص الأصلي'); return drawAdmin(); }
    if (a === 'clearerr') { await X.api('DELETE', '/admin/errors'); return drawAdmin(); }
    if (a === 'bknow') { await X.api('POST', '/admin/backups', {}); X.toast('أُنشئت نسخة احتياطية'); return drawAdmin(); }
    if (a === 'fdel') { b.closest('tr').remove(); return; }
    if (a === 'fmv') { const tr = b.closest('tr'), sib = +b.dataset.d < 0 ? tr.previousElementSibling : tr.nextElementSibling; if (sib && sib.dataset.fk) (+b.dataset.d < 0 ? sib.before(tr) : sib.after(tr)); return; }   // يُحفظ بـ«حفظ كل التغييرات»
    if (a === 'plmv') { const c = b.closest('[data-pl]'), sib = +b.dataset.d < 0 ? c.previousElementSibling : c.nextElementSibling; if (sib && sib.dataset.pl) (+b.dataset.d < 0 ? sib.before(c) : sib.after(c)); return; }
    if (a === 'pdel') { b.closest('[data-per]').remove(); return; }
    if (a === 'padd') { const t = $('#per-t'), d = document.createElement('div'); d.innerHTML = `<div class="pe-r" data-per><span>المدة</span><select data-pm style="width:130px">${[1, 2, 3, 4, 6, 9, 12, 18, 24].map(m => `<option value="${m}">${perName(m)}</option>`).join('')}</select><span>الخصم %</span><input data-po type="number" min="0" max="90" value="0" style="width:80px"><button class="btn ghost sm" data-adm="pdel" title="حذف">×</button></div>`; t.appendChild(d.firstElementChild); return; }
    if (a === 'saveall') {   // زر واحد يحفظ كل شيء (كان زرّان، فتضيع تعديلات المميزات أو الباقات إن ضُغط الآخر)
      const periods = [...X.root.querySelectorAll('#per-t [data-per]')].map(r => ({ m: +r.querySelector('[data-pm]').value, off: +r.querySelector('[data-po]').value || 0 }));
      if (!periods.length) return X.toast('أضف مدة واحدة على الأقل', 'err');
      const plans = [...X.root.querySelectorAll('#pl-t [data-pl]')].map((tr, i) => { const f = n => tr.querySelector(`[data-f="${n}"]`); const L = {}, Tt = {}; tr.querySelectorAll('[data-l]').forEach(x => { L[x.dataset.l] = x.value === '' ? null : +x.value; }); tr.querySelectorAll('[data-t]').forEach(x => { if (+x.value > 0) Tt[x.dataset.t] = +x.value; });
        return { id: +tr.dataset.pl || 0, name: f('name').value.trim(), days: f('free').checked ? +f('days').value : 30, price: +f('price').value, price_usd: +f('price_usd').value, totals: Tt, free: f('free').checked, features: [...tr.querySelectorAll('[data-ft]:checked')].map(x => x.dataset.ft), active: f('active').checked, note: f('note').value.trim(), limits: L, sort: i }; }).filter(p => p.name);
      const list = [...X.root.querySelectorAll('#ft-t [data-fk]')].map(tr => { const g = n => tr.querySelector(`[data-g="${n}"]`); return { k: tr.dataset.fk || undefined, ar: g('ar').value.trim(), en: g('en').value.trim(), fr: g('fr').value.trim(), shown: g('shown').checked }; }).filter(f => f.ar || f.en || f.fr);
      await X.api('PUT', '/admin/plans', { plans, periods }); await X.api('PUT', '/admin/features', { list, missing: $('#ft-miss').value });
      X.toast('حُفظت الباقات والأسعار والمميزات'); return drawAdmin();
    }
  }


  /* ================= مفاتيح المنصة (للمدير) ================= */
  // تُعرض في «العروض والمدفوعات ← طرق الدفع» و«إعدادات المنصة». القيم السرية مخفية، والحفظ عبر data-int="save".
  function cfgUI(cfg) {
    const C = cfg ? cfg.config : {};
    const S = (ok, t) => `<span class="int-s"><i class="${ok ? 'ok' : ''}"></i>${t}</span>`;
    const field = (k, label, ph, type) => `<label class="fl">${label}${C[k] && C[k].source === 'env' ? ' <small>(من إعدادات الخادم)</small>' : ''}<input data-cfg="${k}" ${type === 'secret' ? 'type="password" autocomplete="off"' : ''} dir="ltr" value="${e(C[k] ? C[k].value : '')}" placeholder="${e(ph || '')}"></label>`;
    return {
      ai: `<div class="card"><h2>الذكاء الاصطناعي (OpenAI)</h2>${S(C.openai_key && C.openai_key.set, C.openai_key && C.openai_key.set ? 'مفعّل' : 'غير مفعّل')}<p class="sub">لتحليل الإعلان، التعرّف على المنتج من صورته (المورّد)، عبارات الجزائر، ترجمة الكلمات.</p>
${field('openai_key', 'المفتاح', 'sk-…', 'secret')}${field('openai_model', 'النموذج (اختياري)', 'gpt-4.1-mini')}${field('openai_base', 'عنوان الخدمة (اختياري)', 'https://api.openai.com/v1')}
<p style="display:flex;gap:8px;margin:8px 0 0"><button class="btn sm" data-int="save">حفظ</button><button class="btn ghost sm" data-int="testai">اختبار الاتصال</button></p></div>`,
      satim: `<div class="card"><h2>CIB / الذهبية (SATIM)</h2>${S(C.satim_user && C.satim_user.set && C.satim_pass && C.satim_pass.set, C.satim_pass && C.satim_pass.set ? 'مفعّل · ' + (C.satim_mode && C.satim_mode.value === 'live' ? 'حقيقي' : 'تجريبي') : 'غير مفعّل')}<p class="sub">دفع مباشر بلا وسيط عبر بوابة SATIM. تحصل على اسم المستخدم وكلمة المرور ورقم الطرفية من بنكك بعد عقد الدفع الإلكتروني (اختبارات المطابقة على الوضع التجريبي أولاً).</p>
${field('satim_user', 'اسم المستخدم (userName)', '')}${field('satim_pass', 'كلمة المرور', '', 'secret')}${field('satim_terminal', 'رقم الطرفية (Terminal ID)', '')}<label class="fl">الوضع<select data-cfg="satim_mode"><option value="test"${!C.satim_mode || C.satim_mode.value !== 'live' ? ' selected' : ''}>تجريبي (test)</option><option value="live"${C.satim_mode && C.satim_mode.value === 'live' ? ' selected' : ''}>حقيقي (live)</option></select></label>
<p style="margin:8px 0 0"><button class="btn sm" data-int="save">حفظ</button></p></div>`,
      stripe: `<div class="card"><h2>Stripe (بطاقات دولية)</h2>${S(C.stripe_secret && C.stripe_secret.set, C.stripe_secret && C.stripe_secret.set ? 'مفعّل' : 'غير مفعّل')}<p class="sub">Visa وMastercard لكل الدول بالدولار. رابط الإشعارات (Webhook) لحدث checkout.session.completed: <code dir="ltr" style="word-break:break-all">${e(location.origin)}/api/billing/webhook/stripe</code></p>
${field('stripe_secret', 'المفتاح السري (Secret key)', 'sk_test_… أو sk_live_…', 'secret')}${field('stripe_webhook', 'سر الإشعارات (Signing secret)', 'whsec_…', 'secret')}
<p style="margin:8px 0 0"><button class="btn sm" data-int="save">حفظ</button></p></div>`,
      paypal: `<div class="card"><h2>🅿️ PayPal</h2>${S(C.paypal_client && C.paypal_client.set && C.paypal_secret && C.paypal_secret.set, C.paypal_secret && C.paypal_secret.set ? 'مفعّل · ' + (C.paypal_mode && C.paypal_mode.value === 'live' ? 'حقيقي' : 'تجريبي') : 'غير مفعّل')}<p class="sub">من developer.paypal.com: أنشئ تطبيقاً وانسخ Client ID و Secret.</p>
${field('paypal_client', 'Client ID', '')}${field('paypal_secret', 'Secret', '', 'secret')}<label class="fl">الوضع<select data-cfg="paypal_mode"><option value="test"${!C.paypal_mode || C.paypal_mode.value !== 'live' ? ' selected' : ''}>تجريبي (test)</option><option value="live"${C.paypal_mode && C.paypal_mode.value === 'live' ? ' selected' : ''}>حقيقي (live)</option></select></label>
<p style="margin:8px 0 0"><button class="btn sm" data-int="save">حفظ</button></p></div>`,
      baridi: `<div class="card"><h2>BaridiMob / CCP / تحويل بنكي</h2>${S(C.baridi_info && C.baridi_info.set, C.baridi_info && C.baridi_info.set ? 'مفعّل' : 'غير مفعّل')}<p class="sub">ما يراه المشترك عند الدفع: رقم RIP البريدي، حساب CCP، الحساب البنكي (RIB)، والاسم. يرسل المشترك الوصل مع اسم متجره عبر واتساب (رقم «واتساب الدعم» أدناه)، ويظهر طلبه في «العروض والمدفوعات ← طلبات الدفع» لتقبله بضغطة.</p>
<label class="fl">معلومات التحويل<textarea data-cfg="baridi_info" rows="5" dir="auto" placeholder="BaridiMob (RIP): 00799999…\nCCP: 0000000000 clé 00\nBanque (RIB): …\nالاسم: …">${e(C.baridi_info ? C.baridi_info.value : '')}</textarea></label>
<p style="margin:8px 0 0"><button class="btn sm" data-int="save">حفظ</button></p></div>`,
      tg: `<div class="card"><h2>بوت تيليغرام (للتنبيهات)</h2>${S(C.telegram_token && C.telegram_token.set, C.telegram_token && C.telegram_token.set ? 'مفعّل' : 'غير مفعّل')}<p class="sub">أنشئ بوتاً من <a href="https://t.me/BotFather" target="_blank" rel="noopener">@BotFather</a> وضع رمزه واسمه هنا، فيستطيع كل مشترك ربط حسابه وتلقي التنبيهات.</p>
${field('telegram_token', 'رمز البوت (Token)', '123456:ABC…', 'secret')}${field('telegram_bot', 'اسم البوت', 'RadarProductsBot')}
<p style="margin:8px 0 0"><button class="btn sm" data-int="save">حفظ</button></p></div>`,
      biz: `<div class="card"><h2>معلومات النشاط والدعم</h2><p class="sub">تظهر في الصفحات القانونية (الشروط، الخصوصية، الاسترداد، اتصل بنا) وفي الدعم. <a href="/terms" target="_blank">معاينة</a></p>
${field('biz_name', 'اسم النشاط', 'Winning Product Radar')}${field('biz_country', 'البلد (القانون المطبّق)', 'الجزائر')}${field('biz_address', 'العنوان (اختياري)', '')}
${field('ext_store_url', 'رابط الإضافة في متجر Chrome', 'https://chromewebstore.google.com/detail/…')}${field('support_email', 'بريد الدعم', 'support@…')}${field('support_whatsapp', 'واتساب الدعم (اختياري)', '+213…')}${field('refund_days', 'مدة طلب الاسترداد (أيام)', '7')}${field('legal_updated', 'تاريخ آخر تحديث للشروط', '2026-11-10')}
<p style="margin:8px 0 0"><button class="btn sm" data-int="save">حفظ</button></p></div>`,
      analytics: `<div class="card"><h2>قياس الزيارات والإعلانات</h2><p class="sub">في الصفحات العامة فقط (الرئيسية، التسجيل، الصفحات القانونية) لقياس نتائج إعلاناتك: زيارة الصفحة، وإنشاء حساب (CompleteRegistration / sign_up). لا يُحمَّل شيء منها داخل المنصة. اتركه فارغاً لتعطيله.</p>
${field('ga_id', 'Google Analytics 4 (Measurement ID)', 'G-XXXXXXXXXX')}${field('meta_pixel', 'Meta Pixel ID', '123456789012345')}
<p style="margin:8px 0 0"><button class="btn sm" data-int="save">حفظ</button></p></div>`,
      platform: `<div class="card"><h2>المنصة والبريد</h2>${field('app_url', 'عنوان المنصة الكامل', 'https://winningproductradar.com')}<p class="sub">بريد الإرسال (SMTP): ${cfg && cfg.smtp ? '✅ مضبوط في إعدادات الخادم' : '⚠️ غير مضبوط (SMTP_HOST في إعدادات الخادم)'}</p><p style="margin:8px 0 0"><button class="btn sm" data-int="save">حفظ</button></p></div>`
    };
  }

  /* ================= 🔌 الربط والتكامل ================= */
  let INTV = 0;   // رسم «الربط والتكامل»: يُعتمد آخر رسم فقط
  async function drawIntegrations() {
    const el = $('#x-int'); if (!el) return; const tok = ++INTV;
    el.innerHTML = '<div class="card"><p class="sub">جارٍ التحميل…</p></div>';
    const br = W.WPRLIB && W.WPRLIB.bridge;
    const [sheets, notif] = await Promise.all([X.api('GET', '/sheets').catch(() => ({})), X.api('GET', '/notify').catch(() => null)]);
    const S = (ok, t) => `<span class="int-s"><i class="${ok ? 'ok' : ''}"></i>${t}</span>`;
    for (let i = 0; i < 10 && br && !br.ok(); i++) await new Promise(r => setTimeout(r, 200));   // الإضافة تتصل بعد تحميل الصفحة بلحظات
    const [tt, mk] = await Promise.all([br && br.ok() && W.WPRJOB ? W.WPRJOB.ttStatus() : null, W.WPRIMG ? W.WPRIMG.status() : null]);
    if (tok !== INTV) return;
    // حسابات أسواق المورّدين: البحث بالصورة يستعمل جلستك في Chrome (1688 وTaobao يشترطان الدخول)
    const MKA = [['1688', '1688', 'https://login.1688.com/member/signin.htm', 1], ['taobao', 'Taobao', 'https://login.taobao.com/', 1], ['ali', 'AliExpress', 'https://login.aliexpress.com/', 0], ['alibaba', 'Alibaba', 'https://login.alibaba.com/', 0]];
    const mkCard = `<div class="card" style="grid-column:1/-1" id="x-mk"><h2>حسابات أسواق المورّدين (للبحث بالصورة)</h2>
<p class="sub">البحث بصورة المنتج يتم في متصفحك بحسابك أنت. سجّل الدخول مرة واحدة في Chrome، فيعمل البحث بالصورة مباشرة. 1688 وTaobao يشترطان الدخول، والدخول في AliExpress وAlibaba اختياري. يمكنك الدخول إلى 1688 بحساب Taobao نفسه.</p>
${mk ? `<div class="tbw"><table class="tb">${MKA.map(([k, n, url, need]) => `<tr><td><b>${n}</b> <small class="muted">${need ? '(يشترط الدخول)' : '(اختياري)'}</small></td><td>${S(!!mk[k], mk[k] ? 'مسجّل الدخول' : 'غير مسجّل')}</td><td>${mk[k] ? '' : `<a class="btn sm${need ? '' : ' ghost'}" href="${url}" target="_blank" rel="noopener">سجّل الدخول ↗</a>`}</td></tr>`).join('')}</table></div>
<p style="margin:8px 0 0"><button class="btn ghost sm" data-int="mkcheck">↻ تحقق مجدداً بعد الدخول</button></p>`
  : `<p class="sub">${br && br.ok() ? 'حدّث الإضافة إلى الإصدار 1.7.6 أو أحدث لرؤية حالة الحسابات هنا.' : 'ثبّت الإضافة أولاً لرؤية حالة الحسابات.'}</p><div style="display:flex;gap:6px;flex-wrap:wrap">${MKA.map(([k, n, url]) => `<a class="btn ghost sm" href="${url}" target="_blank" rel="noopener">${n}: سجّل الدخول ↗</a>`).join('')}</div>`}</div>`;
    el.innerHTML = `<div class="int-g">
<div class="card"><h2>إضافة Chrome</h2>${S(br && br.ok(), br && br.ok() ? 'متصلة · الإصدار ' + e(br.version()) : 'غير متصلة')}<p class="sub">تجمع إعلانات مكتبة ميتا، وتبحث عن المورّد في الأسواق الصينية، وتبحث في TikTok.</p><button class="btn ghost sm" data-v="collect" data-int="ext">التثبيت والتحديث</button></div>
<div class="card"><h2>TikTok</h2>${S(tt === true, tt === true ? 'مربوط (مسجّل الدخول في Chrome)' : tt === false ? 'غير مربوط' : 'غير معروف (الإضافة غير متصلة)')}<p class="sub">سجّل الدخول في TikTok على نفس المتصفح مرة واحدة: تبحث الإضافة بجلستك دون نافذة التسجيل.</p><a class="btn ghost sm" href="https://www.tiktok.com/login" target="_blank" rel="noopener">🔑 سجّل الدخول في TikTok</a></div>
${mkCard}
<div class="card" style="grid-column:1/-1"><h2>Google Sheets</h2>${S(!!sheets.url, sheets.url ? 'مربوط' : 'غير مربوط')}<p class="sub">أرسل نتائج التحليل والمنتجات المحفوظة إلى جدولك مباشرة بزر «📤 إلى Google Sheets». الربط مرة واحدة:</p>
<ol class="sub" style="line-height:2"><li>افتح جدولاً جديداً في Google Sheets، ثم <b>Extensions ← Apps Script</b>.</li><li>امسح ما فيه والصق الكود أدناه، وغيّر <code>TOKEN</code> إلى رمز سري من اختيارك.</li><li><b>Deploy ← New deployment ← Web app</b>: Execute as <b>Me</b> و Who has access <b>Anyone</b>، ثم <b>Deploy</b> ووافق على الأذونات.</li><li>انسخ رابط <b>Web app</b> (ينتهي بـ /exec) والصقه هنا مع نفس الرمز السري.</li></ol>
<div style="display:flex;gap:8px;margin:6px 0"><button class="btn ghost sm" data-a="gcopy">نسخ كود Apps Script</button></div>
<div class="grid2" style="margin:8px 0 0"><label class="fl">رابط Web app<input id="g-url" dir="ltr" value="${e(sheets.url||'')}" placeholder="https://script.google.com/macros/s/…/exec"></label><label class="fl">الرمز السري (TOKEN)<input id="g-tok" dir="ltr" value="${e(sheets.token||'')}"></label></div>
<p style="margin:8px 0 0;display:flex;gap:8px"><button class="btn" data-a="gsave">حفظ الربط</button><button class="btn ghost" data-a="gtest">إرسال صف تجريبي</button></p></div>
${notif ? `<div class="card" id="x-notif"></div>` : ''}
</div>
`;
    if (notif && W.WPRNOTIFY) W.WPRNOTIFY.draw($('#x-notif'), notif);
  }
  async function onInt(ev) {
    const b = ev.target.closest('[data-int]'); if (!b) return;
    const a = b.dataset.int;
    if (['tglink', 'tgcheck', 'tgoff', 'ntest'].includes(a)) return onNotify(a, b);
    if (a === 'mkcheck') return drawIntegrations();
    if (a === 'ext') { localStorage.setItem('wpr_collect_prefs_v1', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('wpr_collect_prefs_v1') || '{}'), { tab: 'ext' }))); return; }
    if (a === 'save') { const body = {}; b.closest('.card').querySelectorAll('[data-cfg]').forEach(i => { body[i.dataset.cfg] = i.value; }); await X.api('PUT', '/admin/config', body); X.toast('حُفظت الإعدادات'); return X.cur() === 'integrations' ? drawIntegrations() : drawAdmin(); }
    if (a === 'mailtest') { const r = $('#mail-r'); r.innerHTML = '<p class="sub">جارٍ الإرسال…</p>'; try { const j = await X.api('POST', '/admin/mail-test', { to: ($('#mail-to') || {}).value || '' }); r.innerHTML = `<div class="alert ok" style="margin-top:10px">أُرسل إلى ${e(j.to)} من ${e(j.from)}. ردّ الخادم: <code dir="ltr">${e(j.response || '')}</code><br>افحص صندوق الوارد والرسائل غير المرغوبة. إن لم يصل خلال دقائق فاضغط «فحص إعدادات الدومين».</div>`; }
      catch (x) { r.innerHTML = `<div class="alert err" style="margin-top:10px">${e(x.message)}${x.data && x.data.certName ? `<p style="margin:10px 0 0"><button class="btn sm" data-int="mailcert" data-n="${e(x.data.certName)}">اعتمد اسم الشهادة «${e(x.data.certName)}» وأعد التجربة</button></p>` : ''}</div>`; } mailStatus(); return; }
    if (a === 'mailcert') { await X.api('POST', '/admin/mail-cert', { name: b.dataset.n || '' }); if (b.dataset.n) { X.toast('اعتُمد اسم الشهادة'); const t = $('[data-int="mailtest"]'); if (t) t.click(); } else { X.toast('أُلغي اسم الشهادة'); mailStatus(); } return; }
    if (a === 'maildns') { const r = $('#mail-r'); r.innerHTML = '<p class="sub">جارٍ الفحص…</p>'; try { const j = await X.api('POST', '/admin/mail-dns', {}); const bad = j.checks.filter(c => !c.ok && !c.warn).length;
      r.innerHTML = `<div class="alert ${bad ? 'err' : 'ok'}" style="margin-top:10px">${bad ? 'وُجدت مشكلة في إعدادات الدومين ' + e(j.domain) + ': بسببها لا تصل الرسائل إلى Gmail وغيره.' : 'إعدادات الدومين ' + e(j.domain) + ' سليمة.'}</div><table style="margin-top:8px"><tbody>${j.checks.map(c => `<tr><td><b dir="ltr">${e(c.k)}</b></td><td>${c.ok ? '<span class="pill ok">سليم</span>' : c.warn ? '<span class="pill warn">يُستحسن</span>' : '<span class="pill bad">ناقص</span>'}</td><td>${e(c.msg)}${c.val ? `<br><small class="muted" dir="ltr" style="word-break:break-all">${e(c.val)}</small>` : ''}</td></tr>`).join('')}</tbody></table>`; } catch (x) { r.innerHTML = `<div class="alert err" style="margin-top:10px">${e(x.message)}</div>`; } return; }
    if (a === 'testai') { const r = await X.api('POST', '/admin/config/test-ai', {}); X.toast('✅ الذكاء الاصطناعي يعمل (' + r.model + ')'); }
  }

  /* ================= 🔔 التنبيهات (بريد / تيليغرام) ================= */
  const VIA = { telegram: '✈️ تيليغرام', email: '✉️ البريد', app: '🔔 المنصة' };
  function drawNotify(el, d) {
    if (!el) return;
    const P = d.prefs, tg = d.tg;
    el.innerHTML = `<h2>التنبيهات</h2><p class="sub">تصلك رسالة عند: ظهور منافس لمنتج في «ثغرات السوق»، إعلانات جديدة لمنافس تراقبه، منتج جديد صار «جوهرة»، والدفع وقرب انتهاء الاشتراك.</p>
<div class="row" style="align-items:center"><label class="grow" style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-nt="tg"${P.tg ? ' checked' : ''}${tg.linked ? '' : ' disabled'}> ✈️ تيليغرام
${tg.linked ? '<span class="pill ok">مربوط</span>' : '<span class="pill">غير مربوط</span>'}</label>
${tg.available ? (tg.linked ? '<button class="btn ghost sm" data-int="tgoff">فكّ الربط</button>' : '<button class="btn sm" data-int="tglink">✈️ ربط تيليغرام</button>') : '<small class="muted">يفعّله المدير أولاً</small>'}</div>
<div id="nt-wait"></div>
<div class="row" style="align-items:center"><label class="grow" style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-nt="email"${P.email ? ' checked' : ''}${d.smtp ? '' : ' disabled'}> ✉️ البريد <small class="muted" dir="ltr">${e(d.email)}</small></label>${d.smtp ? '' : '<small class="muted">البريد غير مضبوط في الخادم</small>'}</div>
<details class="fx" style="margin-top:8px"><summary>ما الذي يصلني؟</summary>${Object.keys(d.events).map(k => `<label style="display:flex;gap:8px;align-items:center;margin:6px 0"><input type="checkbox" data-nev="${k}"${P.ev[k] !== false ? ' checked' : ''}> ${e(d.events[k])}</label>`).join('')}</details>
<p style="margin:10px 0 0"><button class="btn ghost sm" data-int="ntest">إرسال تنبيه تجريبي</button></p>
${d.log.length ? `<details class="fx" style="margin-top:8px"><summary>آخر التنبيهات (${num(d.log.length)})</summary>${d.log.map(l => `<div class="row"><div class="grow" style="white-space:pre-wrap" dir="auto">${e(l.text)}</div><small class="muted">${VIA[l.via] || e(l.via)}${l.ok ? '' : ' ⚠️'}<br>${X.fd(l.at)}</small></div>`).join('')}</details>` : ''}`;
    el.onchange = async ev => {
      const i = ev.target; if (!i.matches('[data-nt],[data-nev]')) return;
      const body = i.dataset.nt ? { [i.dataset.nt]: i.checked } : { ev: { [i.dataset.nev]: i.checked } };
      try { drawNotify(el, await X.api('PUT', '/notify', body)); X.toast('حُفظ'); } catch (x) { X.toast(x.message, 'err'); }
    };
  }
  let tgTimer = null;
  async function onNotify(a, b) {
    const el = $('#x-notif');
    if (a === 'tglink') {
      const r = await X.api('POST', '/notify/tg/link', {}); window.open(r.url, '_blank', 'noopener');
      $('#nt-wait').innerHTML = `<div class="alert info">افتح تيليغرام واضغط <b>Start</b> في البوت. ننتظر التأكيد… <a href="${e(r.url)}" target="_blank" rel="noopener">فتح البوت</a> <button class="btn ghost sm" data-int="tgcheck">تحقّق الآن</button></div>`;
      clearInterval(tgTimer); let n = 0;
      tgTimer = setInterval(async () => { if (++n > 40 || X.cur() !== 'integrations') return clearInterval(tgTimer); try { const c = await X.api('POST', '/notify/tg/check', {}); if (c.linked) { clearInterval(tgTimer); X.toast('✅ رُبط تيليغرام'); drawNotify(el, await X.api('GET', '/notify')); } } catch (x) {} }, 4000);
      return;
    }
    if (a === 'tgcheck') { const c = await X.api('POST', '/notify/tg/check', {}); if (c.linked) { clearInterval(tgTimer); X.toast('✅ رُبط تيليغرام'); return drawNotify(el, await X.api('GET', '/notify')); } return X.toast('لم يصل التأكيد بعد. اضغط Start في البوت ثم أعد المحاولة.', 'err'); }
    if (a === 'tgoff') { clearInterval(tgTimer); return drawNotify(el, await X.api('DELETE', '/notify/tg')); }
    if (a === 'ntest') { const r = await X.api('POST', '/notify/test', {}); if (r.errors && r.errors.length) X.toast(r.errors.join(' · '), 'err'); else X.toast('✅ أُرسل ' + r.sent + ' تنبيه تجريبي'); drawNotify(el, await X.api('GET', '/notify')); }
  }
  W.WPRNOTIFY = { draw: drawNotify };

  W.WPRACC = {
    init(ctx) {
      X = ctx; if (inited) return; inited = true;
      X.root.addEventListener('click', ev => {
        const cur = X.cur(), fn = AV[cur] ? (e => e.target.closest('[data-int]') ? onInt(e) : onAdmin(e)) : cur === 'integrations' ? onInt : null;
        const acon = ev.target.closest('[data-acon]'); if (acon) { W.WPRACON.open(acon.dataset.acon, acon.dataset.uid); return; }
        const pd = ev.target.closest('[data-paydel]'); if (pd) {   // المشترك يحذف طلب دفع مرفوضاً أو قيد المراجعة
          if (pd.dataset.s !== '1') { pd.dataset.s = '1'; pd.textContent = 'تأكيد الحذف؟'; return; }
          X.api('DELETE', '/billing/payment/' + pd.dataset.paydel).then(async () => { X.toast('حُذف طلب الدفع'); await drawBilling(); const h = $('#pay-hist'); if (h) h.open = true; }).catch(x => X.toast(x.message, 'err')); return;
        }
        const wac = ev.target.closest('[data-wac]'); if (wac) { W.WPRWA.open(wac.dataset.wac, { topic: wac.dataset.topic }); return; }
        if (!fn) return; const pr = Promise.resolve().then(() => fn(ev)); W.__btnBusy && W.__btnBusy(ev, pr); pr.catch(x => { if (x && x.message !== 'auth') X.toast(x.message || 'حدث خطأ', 'err'); });
      });
      afterReturn();
    },
    billing: () => drawBilling(), adminView, integrations: () => drawIntegrations()
  };
})();
