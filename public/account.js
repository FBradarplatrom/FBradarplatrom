/* الحساب والإدارة: 💳 الاشتراك والدفع (في «الإعدادات») · 🔌 الربط والتكامل (قسم) · لوحة المدير (الإحصائيات، المدفوعات، الباقات، الأخطاء).
   يعمل مع app.html عبر WPRACC.init(ctx). */
(function () {
  'use strict';
  const W = window; let X = null, inited = false;
  const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => Number(n || 0).toLocaleString((window.__LOC||'ar-DZ'));
  const dz = n => num(n) + ' دج';
  const $ = s => X.root.querySelector(s);
  const ST = { pending: ['warn', 'قيد المراجعة'], paid: ['ok', 'مدفوع'], rejected: ['bad', 'مرفوض'], failed: ['bad', 'فشل'] };
  const MT = { satim: '💳 CIB / الذهبية', stripe: '💳 بطاقة دولية (Stripe)', paypal: '🅿️ PayPal', card: '💳 بطاقة', baridi: '📱 BaridiMob / CCP / تحويل' };
  const money = (a, c) => (c === 'USD' ? '$' + Number(a || 0).toFixed(2) : dz(a));
  const priceOf = x => [x.price > 0 ? dz(x.price) : '', x.price_usd > 0 ? '$' + Number(x.price_usd).toFixed(2) : ''].filter(Boolean).join(' · ');
  const st = document.createElement('style');
  st.textContent = `.meter{margin:8px 0}.meter .t{display:flex;justify-content:space-between;font-size:13px}.meter .b{height:8px;background:var(--line);border-radius:99px;overflow:hidden;margin-top:4px}.meter .b i{display:block;height:100%;background:linear-gradient(90deg,#6366f1,#8b5cf6)}.meter .b i.hot{background:linear-gradient(90deg,#f59e0b,#dc2626)}
.plan-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}.plan{border:1px solid var(--line);border-radius:16px;padding:14px;background:var(--card2);display:flex;flex-direction:column;gap:6px}.plan.on{border-color:var(--brand);box-shadow:0 0 0 2px rgba(99,102,241,.25)}.plan .pr{font-size:24px;font-weight:800}.plan ul{margin:4px 0;padding-inline-start:18px;font-size:13px}
.adm-t{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 16px}.adm-t button{border:1px solid var(--line);background:var(--card);border-radius:99px;padding:7px 14px;font:inherit;font-size:14px;cursor:pointer;color:var(--ink)}.adm-t button.on{background:var(--brand);color:#fff;border-color:var(--brand)}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.kpis div{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px}.kpis b{display:block;font-size:22px}.kpis span{font-size:12.5px;color:var(--mut)}
.bars{display:flex;align-items:flex-end;gap:6px;height:140px;margin-top:10px}.bars div{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;font-size:11px;color:var(--mut)}.bars i{display:block;width:100%;background:linear-gradient(180deg,#8b5cf6,#6366f1);border-radius:6px 6px 0 0;min-height:2px}
.btn.wa{background:#25d366;color:#fff;border-color:#25d366;display:inline-flex;gap:8px;align-items:center}.btn.wa:hover{background:#1ebe5b}
.int-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px}.int-s{display:inline-flex;align-items:center;gap:6px;font-size:13px}.int-s i{width:9px;height:9px;border-radius:50%;background:var(--bad)}.int-s i.ok{background:var(--ok)}`;
  document.head.appendChild(st);

  /* ================= 💳 الاشتراك (للمشترك) ================= */
  let BL = null;
  const meter = (label, used, max) => { const inf = !Number.isFinite(max) || max >= 1e9, pct = inf ? 0 : Math.min(100, Math.round(used / max * 100)); return `<div class="meter"><div class="t"><span>${e(label)}</span><span>${num(used)} / ${inf ? '∞' : num(max)}</span></div><div class="b"><i class="${pct > 85 ? 'hot' : ''}" style="width:${inf ? 3 : pct}%"></i></div></div>`; };
  async function drawBilling() {
    const el = $('#x-billing'); if (!el) return;
    try { BL = await X.api('GET', '/billing'); } catch (x) { el.innerHTML = '<p class="sub">تعذّر تحميل الاشتراك.</p>'; return; }
    const me = X.me(), left = Math.ceil((BL.expires_at - Date.now()) / 864e5), adm = me.role === 'admin';
    el.innerHTML = `<h2>💳 الاشتراك</h2><p style="margin:6px 0"><span class="pill ${me.active ? 'ok' : 'bad'}">${e(adm ? 'مدير' : BL.plan && BL.plan !== 'none' ? BL.plan : 'بلا باقة')}</span>
${adm ? '<span class="sub"> حساب مدير، بلا انتهاء ولا حدود.</span>' : `<span class="sub"> ${me.active ? 'ينتهي في ' + X.fd(BL.expires_at) + ' (باقي ' + num(left) + ' يوم)' : 'منتهٍ'}</span>`}</p>
${!adm && me.active && left <= 5 ? '<div class="alert">⏰ اشتراكك ينتهي قريباً. جدّده الآن حتى لا يتوقف عملك.</div>' : ''}
${Object.keys(BL.labels).map(k => meter(BL.labels[k], ({ searchesPerDay: BL.usage.searchesToday, aiMonth: 0, gapProducts: BL.usage.gapProducts, watchPages: BL.usage.watchPages, aiPerMonth: BL.usage.aiMonth })[k] || 0, BL.limits[k])).join('')}
${adm ? '' : BL.plans.length ? `<p style="margin:10px 0 0"><button class="btn" data-acc="plans">${me.active ? '💳 الدفع أو تغيير العرض' : '💳 اشترك الآن'}</button></p>` : `<p class="sub">الدفع الإلكتروني غير متاح بعد.${me.contact ? ` <a href="${e(me.contact)}" target="_blank" rel="noopener">تواصل مع الإدارة</a>` : ''}</p>`}
${BL.payments.length ? `<details class="fx" style="margin-top:10px"><summary>سجل المدفوعات (${num(BL.payments.length)})</summary><div class="tbw"><table class="tb"><tr><th>الباقة</th><th>المبلغ</th><th>الطريقة</th><th>الحالة</th><th>التاريخ</th></tr>${BL.payments.map(p => `<tr><td>${e(p.plan_name)}</td><td>${money(p.amount, p.currency)}</td><td>${MT[p.method] || e(p.method)}</td><td><span class="pill ${(ST[p.status] || [''])[0]}">${(ST[p.status] || ['', p.status])[1]}</span>${p.note ? '<br><small>' + e(p.note) + '</small>' : ''}</td><td>${X.fd(p.created_at)}</td></tr>`).join('')}</table></div></details>` : ''}`;
  }
  function plansModal() {
    const T = W.WPRTOOLS; if (!T) return;
    let sel = BL.plans[0] && BL.plans[0].id;
    const draw = () => {
      const b = T.open('💳 الدفع أو تغيير العرض', '');
      const p = BL.plans.find(x => x.id === sel) || BL.plans[0];
      b.innerHTML = `<h3 style="margin:0 0 8px">1. اختر العرض</h3><div class="plan-g">${BL.plans.map(x => `<div class="plan${x.id === sel ? ' on' : ''}" data-acc="pick" data-id="${x.id}" style="cursor:pointer"><b>${e(x.name)}</b><span class="pr">${priceOf(x)}</span><small>${num(x.days)} يوماً${x.days >= 60 && x.price > 0 ? ' · ' + dz(Math.round(x.price / x.days * 30)) + ' للشهر' : ''}</small>
<ul>${Object.keys(BL.labels).map(k => `<li>${e(BL.labels[k])}: <b>${num(x.limits[k])}</b></li>`).join('')}</ul>${x.note ? `<small>${e(x.note)}</small>` : ''}</div>`).join('')}</div>
<h3 style="margin:16px 0 6px">2. ادفع: العرض «${e(p.name)}» · ${priceOf(p)}</h3>
${BL.methods.satim && p.price > 0 ? `<div class="card" style="margin:8px 0"><b>💳 بطاقة CIB أو الذهبية (Edahabia)</b><p class="sub">دفع آمن مباشرة عبر بوابة SATIM بالدينار. يُفعَّل اشتراكك فور نجاح الدفع.</p><button class="btn" data-acc="pay" data-m="satim">ادفع ${dz(p.price)}</button></div>` : ''}
${BL.methods.stripe && p.price_usd > 0 ? `<div class="card" style="margin:8px 0"><b>💳 Visa / Mastercard (Stripe)</b><p class="sub">لكل الدول. يُفعَّل اشتراكك فور نجاح الدفع.</p><button class="btn" data-acc="pay" data-m="stripe">ادفع $${Number(p.price_usd).toFixed(2)}</button></div>` : ''}
${BL.methods.paypal && p.price_usd > 0 ? `<div class="card" style="margin:8px 0"><b>🅿️ PayPal</b><p class="sub">ادفع من حسابك في PayPal أو ببطاقتك. يُفعَّل اشتراكك فور نجاح الدفع.</p><button class="btn" data-acc="pay" data-m="paypal">ادفع $${Number(p.price_usd).toFixed(2)} بـ PayPal</button></div>` : ''}
${(BL.methods.baridi || BL.methods.whatsapp) && p.price > 0 ? `<div class="card pay-m" style="margin:8px 0"><b>📱 BaridiMob أو CCP أو تحويل بنكي</b>
<p class="sub" style="margin:6px 0">حوّل <b>${dz(p.price)}</b> ثم أرسل الوصل مع اسم متجرك: يُفعَّل عرضك عند الاستلام.</p>
${BL.methods.baridi ? `<div class="alert info" style="white-space:pre-wrap;margin:8px 0" translate="no" dir="auto">${e(BL.methods.baridi)}</div>` : '<p class="sub">اطلب معلومات التحويل عبر واتساب.</p>'}
<label class="fl">اسم متجرك<input id="bm-store" maxlength="80" dir="auto" placeholder="مثال: Boutique Amine"></label>
${BL.methods.whatsapp ? `<p style="margin:10px 0 0"><button class="btn wa" data-acc="wa"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm4.5 12.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.4-3c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2s.2-1.1.1-1.2-.2-.2-.4-.3z"/></svg> إرسال الوصل عبر واتساب</button></p>
<p class="sub" style="margin:6px 0 0">يفتح واتساب برسالة جاهزة (العرض، المبلغ، اسم المتجر، بريد حسابك): أرفق صورة الوصل وأرسلها.</p>` : ''}
${BL.methods.baridi ? `<details class="fx" style="margin:10px 0 0"><summary>أو أرفق الوصل هنا بدل واتساب</summary>
<div class="grid2" style="gap:8px;margin:0"><label class="fl">رقم العملية<input id="bm-ref" dir="ltr"></label><label class="fl">صورة الوصل<input id="bm-img" type="file" accept="image/*"></label></div>
<p style="margin:8px 0 12px"><button class="btn ghost" data-acc="baridi">أرسل طلب التفعيل</button></p></details>` : ''}</div>` : ''}
${!BL.methods.satim && !BL.methods.stripe && !BL.methods.paypal && !BL.methods.baridi && !BL.methods.whatsapp ? '<div class="alert">لا توجد طريقة دفع مفعّلة بعد. تواصل مع الإدارة.</div>' : ''}`;
      b.onclick = async ev => {
        const t = ev.target.closest('[data-acc]'); if (!t) return;
        const a = t.dataset.acc;
        if (a === 'pick') { sel = +t.dataset.id; return draw(); }
        const run = f => { const pr = Promise.resolve().then(f); W.__btnBusy && W.__btnBusy(ev, pr); pr.catch(x => X.toast(x.message || 'خطأ', 'err')); };
        if (a === 'pay') run(async () => { const r = await X.api('POST', '/billing/checkout', { plan_id: sel, method: t.dataset.m }); location.href = r.url; });
        if (a === 'wa') {
          const store = b.querySelector('#bm-store').value.trim(); if (store.length < 2) { b.querySelector('#bm-store').focus(); return X.toast('اكتب اسم متجرك', 'err'); }
          const win = W.open('', '_blank');                        // يُفتح الآن (قبل الانتظار) حتى لا يمنعه المتصفح
          run(async () => {
            try {
              const p = BL.plans.find(x => x.id === sel), r = await X.api('POST', '/billing/baridi', { plan_id: sel, via: 'whatsapp', store });
              const lg = W.__LANG || 'ar', me = X.me(), amount = dz(p.price);
              const M = { ar: ['السلام عليكم 👋', 'أرسل لكم وصل الدفع لتفعيل عرضي في رادار المنتجات الرابحة:', '• العرض: ' + p.name + ' (' + p.days + ' يوماً)', '• المبلغ: ' + amount, '• اسم المتجر: ' + store, '• بريد الحساب: ' + me.email, '• رقم الطلب: #' + r.id, '📎 صورة الوصل مرفقة.'],
                en: ['Hello 👋', 'Here is my payment receipt to activate my Winning Product Radar plan:', '• Plan: ' + p.name + ' (' + p.days + ' days)', '• Amount: ' + amount, '• Store name: ' + store, '• Account email: ' + me.email, '• Request: #' + r.id, '📎 Receipt photo attached.'],
                fr: ['Bonjour 👋', 'Voici mon reçu de paiement pour activer mon offre Radar des produits gagnants :', '• Offre : ' + p.name + ' (' + p.days + ' jours)', '• Montant : ' + amount, '• Boutique : ' + store, '• E-mail du compte : ' + me.email, '• Demande : #' + r.id, '📎 Photo du reçu jointe.'] };
              const url = 'https://wa.me/' + String(BL.methods.whatsapp).replace(/[^\d]/g, '') + '?text=' + encodeURIComponent((M[lg] || M.ar).join('\n'));
              if (win) win.location.href = url; else location.href = url;
              T.close(); X.toast('أرسل صورة الوصل في واتساب. يُفعَّل عرضك عند الاستلام.'); drawBilling();
            } catch (x) { if (win) win.close(); throw x; }
          });
          return;
        }
        if (a === 'baridi') run(async () => {
          const ref = b.querySelector('#bm-ref').value.trim(), f = b.querySelector('#bm-img').files[0];
          const proof = f ? await shrink(f) : '';
          if (!ref && !proof) return X.toast('اكتب رقم العملية أو أرفق صورة الوصل', 'err');
          await X.api('POST', '/billing/baridi', { plan_id: sel, ref, proof }); T.close(); X.toast('أُرسل طلبك. سيُفعَّل اشتراكك بعد المراجعة وستصلك رسالة.'); drawBilling();
        });
      };
    };
    draw();
  }
  // تصغير صورة الوصل في المتصفح (JPEG ≤ 1400 بكسل)
  const shrink = f => new Promise((ok, no) => { const im = new Image(), u = URL.createObjectURL(f); im.onload = () => { const k = Math.min(1, 1400 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); ok(c.toDataURL('image/jpeg', 0.82)); }; im.onerror = () => no(new Error('صورة غير صالحة')); im.src = u; });
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

  /* ================= لوحة المدير ================= */
  let ATAB = 'users';
  const TABS = [['users', '👥 المشتركون'], ['stats', '📊 الإحصائيات'], ['pay', '💳 المدفوعات'], ['plans', '📦 الباقات'], ['msgs', '✉️ الرسائل'], ['legal', '📄 الصفحات القانونية'], ['err', '⚠️ الأخطاء'], ['backup', '💾 النسخ الاحتياطي']];
  let LG = { lang: 'ar', doc: 'terms' };
  const loadLegal = () => W.LEGAL_D ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement('script'); s.src = '/legal-texts.js'; s.onload = ok; s.onerror = () => no(new Error('تعذّر تحميل النصوص')); document.head.appendChild(s); });
  function adminTabs() {
    const v = $('#v-admin'); if (!v) return;
    let bar = $('#adm-tabs'); if (!bar) { bar = document.createElement('div'); bar.id = 'adm-tabs'; bar.className = 'adm-t'; v.querySelector('.ph').after(bar); const box = document.createElement('div'); box.id = 'x-adm'; v.appendChild(box); }
    bar.innerHTML = TABS.map(([k, t]) => `<button data-adm="${k}" class="${ATAB === k ? 'on' : ''}">${t}</button>`).join('');
    const users = ATAB === 'users';
    ['#x-users', '#x-link'].forEach(s => { const x = $(s); if (x) x.hidden = !users; });
    $('#x-adm').hidden = users;
    if (!users) drawAdmin().catch(x => { if (x.message !== 'auth') X.toast(x.message, 'err'); });
  }
  async function drawAdmin() {
    const el = $('#x-adm'); el.innerHTML = '<div class="card"><p class="sub">جارٍ التحميل…</p></div>';
    if (ATAB === 'stats') {
      const s = await X.api('GET', '/admin/stats'), mx = Math.max(1, ...s.revenue.map(r => r.a));
      el.innerHTML = `<div class="kpis"><div><b>${num(s.active)}</b><span>مشترك نشط</span></div><div><b>${num(s.users)}</b><span>كل الحسابات</span></div><div><b>${num(s.newMonth)}</b><span>تسجيلات هذا الشهر</span></div><div><b>${num(s.expiring7)}</b><span>ينتهي خلال 7 أيام</span></div><div><b>${num(s.expired30)}</b><span>انتهى خلال 30 يوماً (لم يجدّد)</span></div><div><b>${dz(s.revenueMonth)}</b><span>إيرادات هذا الشهر</span></div>${s.revenueMonthUsd ? `<div><b>$${Number(s.revenueMonthUsd).toFixed(2)}</b><span>إيرادات الشهر بالدولار (Stripe/PayPal)</span></div>` : ''}<div><b>${num(s.pending)}</b><span>دفع بانتظار المراجعة</span></div><div><b>${num(s.usage.activeUsers7)}</b><span>دخلوا خلال 7 أيام</span></div></div>
<div class="card" style="margin-top:14px"><h2>الإيرادات (12 شهراً)</h2><div class="bars">${s.revenue.map(r => `<div title="${e(r.m)}: ${dz(r.a)} · ${num(r.n)} دفعة"><small>${r.a ? num(Math.round(r.a / 1000)) + 'ك' : ''}</small><i style="height:${Math.round(r.a / mx * 110)}px"></i>${e(r.m.slice(5))}</div>`).join('')}</div></div>
<div class="grid2" style="margin-top:14px"><div class="card"><h2>الاستعمال</h2><div class="kpis"><div><b>${num(s.usage.searchesToday)}</b><span>عمليات بحث اليوم</span></div><div><b>${num(s.usage.searches30)}</b><span>عمليات بحث (30 يوماً)</span></div><div><b>${num(s.usage.ads30)}</b><span>إعلانات جُمعت (30 يوماً)</span></div><div><b>${num(s.usage.aiMonth)}</b><span>طلبات ذكاء اصطناعي هذا الشهر</span></div></div></div>
<div class="card"><h2>المشتركون النشطون حسب الباقة</h2>${s.plans.map(p => `<div class="row"><div class="grow">${e(p.plan || '—')}</div><b>${num(p.n)}</b></div>`).join('') || '<p class="sub">—</p>'}<p class="sub" style="margin-top:8px">${s.errors.day ? `⚠️ ${num(s.errors.day)} خطأ خلال 24 ساعة (تبويب «الأخطاء»)` : '✅ لا أخطاء خلال 24 ساعة'}</p></div></div>`;
    }
    if (ATAB === 'pay') {
      const L = await X.api('GET', '/admin/payments'), pend = L.filter(p => p.status === 'pending');
      el.innerHTML = `${pend.length ? `<div class="alert info">${num(pend.length)} طلب بانتظار مراجعتك.</div>` : ''}<div class="tbw"><table class="tb"><tr><th>المشترك</th><th>الباقة</th><th>المبلغ</th><th>الطريقة</th><th>رقم العملية / الوصل</th><th>الحالة</th><th>التاريخ</th><th></th></tr>${L.map(p => `<tr><td>${e(p.email || '—')}</td><td>${e(p.plan_name)} · ${num(p.days)} يوماً</td><td>${money(p.amount, p.currency)}</td><td>${MT[p.method] || e(p.method)}</td><td dir="ltr">${e(p.ref || '')}${p.proof ? ` <a href="/api/admin/payments/${p.id}/proof" target="_blank" rel="noopener">🧾 الوصل</a>` : ''}</td><td><span class="pill ${(ST[p.status] || [''])[0]}">${(ST[p.status] || ['', p.status])[1]}</span>${p.note ? '<br><small>' + e(p.note) + '</small>' : ''}</td><td>${X.fd(p.created_at)}</td>
<td>${p.status === 'pending' ? `<button class="btn sm" data-adm="approve" data-id="${p.id}">✓ قبول وتفعيل</button> <button class="btn danger sm" data-adm="reject" data-id="${p.id}">رفض</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="8" class="muted">لا مدفوعات بعد.</td></tr>'}</table></div>`;
    }
    if (ATAB === 'plans') {
      const r = await X.api('GET', '/admin/plans');
      const row = p => `<tr data-pl="${p.id || ''}"><td><input data-f="name" value="${e(p.name || '')}" style="width:110px"></td><td><input data-f="days" type="number" value="${e(p.days || 30)}" style="width:70px"></td><td><input data-f="price" type="number" value="${e(p.price || 0)}" style="width:90px"></td><td><input data-f="price_usd" type="number" step="0.01" value="${e(p.price_usd || 0)}" style="width:80px"></td><td><input data-f="free" type="checkbox"${p.free ? ' checked' : ''} title="تُمنح تلقائياً عند التسجيل"></td>
${r.keys.map(k => `<td><input data-l="${k}" type="number" value="${e(p.limits ? p.limits[k] : '')}" style="width:70px"></td>`).join('')}<td style="min-width:240px">${r.cat.map(f => `<label style="display:inline-flex;gap:4px;align-items:center;margin:2px 8px 2px 0;font-size:12.5px;white-space:nowrap${f.shown ? '' : ';opacity:.5'}" title="${f.shown ? '' : 'مخفية من صفحة الأسعار'}"><input type="checkbox" data-ft="${e(f.k)}"${!p.features || p.features.includes(f.k) ? ' checked' : ''}>${e(f.ar)}</label>`).join('')}</td><td><input data-f="active" type="checkbox"${p.active !== false ? ' checked' : ''}></td><td><input data-f="note" value="${e(p.note || '')}" placeholder="مثلاً: الأكثر طلباً" style="width:130px"></td></tr>`;
      const frow = f => `<tr data-fk="${e(f.k || '')}"><td><input data-g="ar" value="${e(f.ar || '')}" placeholder="بالعربية" style="width:190px"></td><td><input data-g="en" dir="ltr" value="${e(f.en || '')}" placeholder="English" style="width:170px"></td><td><input data-g="fr" dir="ltr" value="${e(f.fr || '')}" placeholder="Français" style="width:170px"></td>
<td style="text-align:center"><input type="checkbox" data-g="shown"${f.shown !== false ? ' checked' : ''}></td><td>${f.builtin ? '<small class="muted">ميزة من المنصة</small>' : f.k ? '<button class="btn danger sm" data-adm="fdel">حذف</button>' : '<small class="muted">جديدة</small>'}</td></tr>`;
      el.innerHTML = `<div class="card" style="margin-bottom:16px"><h2>مميزات الباقات (تظهر للزبائن في صفحة الأسعار)</h2><p class="sub">أضف ميزة جديدة (اكتب اسمها في السطر الفارغ) أو عدّل اسمها أو احذفها. المميزات «من المنصة» تُطبَّق فعلاً على المشترك حسب باقته، ولا تُحذف لكن يمكن إخفاؤها من صفحة الأسعار (فتصبح متاحة لكل الباقات). الميزة الجديدة تُضاف تلقائياً إلى الباقات المدفوعة، وتختار باقاتها من الجدول أدناه.</p>
<div class="tbw"><table class="tb" id="ft-t"><tr><th>الاسم بالعربية</th><th>English</th><th>Français</th><th>تظهر في الأسعار</th><th></th></tr>${r.cat.map(frow).join('')}${frow({ shown: true })}</table></div>
<p style="margin:10px 0 0"><button class="btn" data-adm="savefeats">حفظ المميزات</button></p></div>
<div class="card"><h2>الباقات وحدودها</h2><p class="sub">السعر بالدينار (CIB/الذهبية وBaridiMob) وبالدولار (Stripe وPayPal للعالم). الباقة «المجانية للتجربة» تُمنح تلقائياً لكل مسجّل جديد بمدتها وحدودها ولا تُشترى. الباقة بلا سعر أو غير المفعّلة لا تظهر للشراء. الحدود تطبَّق فوراً على كل مشترك اسم باقته يطابق اسمها (يُكتب الاسم عند الدفع أو عند إضافة الأيام يدوياً).</p>
<div class="tbw"><table class="tb" id="pl-t"><tr><th>الاسم</th><th>الأيام</th><th>السعر (دج)</th><th>السعر ($)</th><th>مجانية للتجربة</th>${r.keys.map(k => `<th>${e(r.labels[k])}</th>`).join('')}<th>المميزات المشمولة</th><th>مفعّلة</th><th>ملاحظة</th></tr>${r.plans.map(row).join('')}${row({})}</table></div>
<p style="margin:10px 0 0"><button class="btn" data-adm="saveplans">حفظ الباقات</button></p></div>`;
    }
    if (ATAB === 'msgs') {
      const r = await X.api('GET', '/admin/messages');
      el.innerHTML = `<div class="card"><h2>✉️ رسائل «اتصل بنا»</h2><p class="sub">تصلك هنا رسائل الزوار (من صفحة <a href="/contact" target="_blank">اتصل بنا</a>) والمشتركين (من «المساعدة والدعم»)، ويصلك تنبيه بالبريد/تيليغرام عند كل رسالة إن فعّلت التنبيهات. اضغط «رد بالبريد» لتجيب من بريدك.</p>
${r.list.map(m => `<div class="row" style="align-items:flex-start;${m.status === 'new' ? 'border-inline-start:3px solid var(--brand);padding-inline-start:10px' : 'opacity:.75'}"><div class="grow"><b>${m.status === 'new' ? '🆕 ' : ''}${e(m.subject)}</b><div class="muted">${X.fd(m.created_at)} ${new Date(m.created_at).toLocaleTimeString((window.__LOC||'ar-DZ'), { hour: '2-digit', minute: '2-digit' })} · ${e(m.name || '')} &lt;${e(m.email)}&gt; · ${m.user_id ? 'مشترك' + (m.plan ? ' (' + e(m.plan) + ')' : '') : 'زائر'}</div><p style="white-space:pre-wrap;margin:6px 0 0">${e(m.body)}</p></div>
<div style="display:flex;gap:6px;flex-wrap:wrap;flex:none"><a class="btn sm" href="mailto:${e(m.email)}?subject=${encodeURIComponent('Re: ' + m.subject)}">رد بالبريد</a>${m.status === 'new' ? `<button class="btn ghost sm" data-adm="mdone" data-id="${m.id}">✓ تمت المعالجة</button>` : `<button class="btn ghost sm" data-adm="mnew" data-id="${m.id}">إرجاع كجديدة</button>`}<button class="btn danger sm" data-adm="mdel" data-id="${m.id}">حذف</button></div></div>`).join('') || '<p class="sub">لا رسائل بعد.</p>'}</div>`;
    }
    if (ATAB === 'legal') {
      const [r] = await Promise.all([X.api('GET', '/admin/legal'), loadLegal()]), k = LG.lang + ':' + LG.doc, cu = r.docs[k], T = { terms: 'شروط الاستخدام', privacy: 'سياسة الخصوصية', refund: 'الاسترداد والإلغاء', contact: 'اتصل بنا' };
      el.innerHTML = `<div class="card"><h2>📄 تعديل الصفحات القانونية</h2><p class="sub">اختر الصفحة واللغة، عدّل النص ثم احفظ. السطر الذي يبدأ بـ <code>#</code> هو عنوان الصفحة، والذي يبدأ بـ <code>##</code> عنوان فقرة، وما تحته نصها. هذه الكلمات تُستبدل تلقائياً: <code>{name}</code> اسم النشاط، <code>{email}</code> بريد الدعم، <code>{wa_line}</code> واتساب، <code>{country}</code> البلد، <code>{days}</code> مدة الاسترداد، <code>{address_line}</code> العنوان (من «الربط والتكامل ← معلومات النشاط والدعم»). ننصح بمراجعتها مع مختص قانوني.</p>
<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0"><select id="lg-doc" style="width:auto">${Object.keys(T).map(d => `<option value="${d}"${d === LG.doc ? ' selected' : ''}>${T[d]}</option>`).join('')}</select><select id="lg-lang" style="width:auto">${[['ar', 'العربية'], ['en', 'English'], ['fr', 'Français']].map(([l, n]) => `<option value="${l}"${l === LG.lang ? ' selected' : ''}>${n}</option>`).join('')}</select>
<span class="pill ${cu ? 'warn' : 'ok'}">${cu ? 'نص معدّل' : 'النص الأصلي'}</span><a class="btn ghost sm" href="/${LG.doc}?lang=${LG.lang}" target="_blank">معاينة الصفحة ↗</a></div>
<textarea id="lg-body" rows="22" dir="${LG.lang === 'ar' ? 'rtl' : 'ltr'}" style="width:100%;font:inherit;font-size:14px;line-height:1.8;border:1px solid var(--line);border-radius:12px;padding:12px;background:var(--card);color:var(--ink)">${e(cu || W.LEGAL_TEXT(W.LEGAL_D[LG.lang][LG.doc]))}</textarea>
<p style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 0"><button class="btn" data-adm="lgsave">حفظ الصفحة</button>${cu ? '<button class="btn ghost" data-adm="lgreset">استرجاع النص الأصلي</button>' : ''}</p></div>`;
      const ch = () => { LG = { doc: $('#lg-doc').value, lang: $('#lg-lang').value }; drawAdmin(); };
      $('#lg-doc').onchange = ch; $('#lg-lang').onchange = ch;
    }
    if (ATAB === 'backup') {
      const r = await X.api('GET', '/admin/backups'), kb = n => num(Math.round(n / 1024)) + ' KB';
      el.innerHTML = `<div class="card"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><h2 style="margin:0;flex:1">💾 النسخ الاحتياطي لقاعدة البيانات</h2><button class="btn sm" data-adm="bknow">إنشاء نسخة الآن</button></div>
<p class="sub">نسخة تلقائية كل يوم، مضغوطة، وتُحفظ آخر ${num(r.keep)} نسخة في <code dir="ltr">${e(r.dir)}</code>. حمّل نسخة إلى حاسوبك أو خدمة سحابية من وقت لآخر: إن تعطّل الخادم نفسه تضيع النسخ التي عليه.</p>
<div class="tbw"><table class="tb"><tr><th>النسخة</th><th>التاريخ</th><th>الحجم</th><th></th></tr>${r.list.map(f => `<tr><td dir="ltr">${e(f.name)}</td><td>${X.fd(f.at)} ${new Date(f.at).toLocaleTimeString((window.__LOC||'ar-DZ'), { hour: '2-digit', minute: '2-digit' })}</td><td>${kb(f.size)}</td><td><a class="btn ghost sm" href="/api/admin/backups/${encodeURIComponent(f.name)}">⬇ تحميل</a></td></tr>`).join('') || '<tr><td colspan="4" class="muted">لا نسخ بعد. أول نسخة تُنشأ تلقائياً خلال دقيقة من تشغيل المنصة.</td></tr>'}</table></div>
<details class="fx" style="margin-top:12px"><summary>كيف أسترجع نسخة؟</summary><ol class="sub" style="line-height:2"><li>أوقف التطبيق من لوحة الاستضافة.</li><li>فك ضغط النسخة (ملف <code>.gz</code>) فتحصل على ملف <code>.db</code>.</li><li>احتفظ بالملف الحالي <code>data.db</code> باسم آخر احتياطاً، ثم ضع النسخة مكانه باسم <code>data.db</code>.</li><li>شغّل التطبيق.</li></ol><p class="sub">الصور المحفوظة ووصولات الدفع في مجلدي <code>images</code> و<code>proofs</code>: انسخهما أيضاً من وقت لآخر.</p></details></div>`;
    }
    if (ATAB === 'err') {
      const s = await X.api('GET', '/admin/stats');
      el.innerHTML = `<div class="card"><div style="display:flex;gap:10px;align-items:center"><h2 style="margin:0;flex:1">⚠️ سجل الأخطاء</h2>${s.errors.list.length ? '<button class="btn danger sm" data-adm="clearerr">مسح السجل</button>' : ''}</div>
<div class="tbw" style="margin-top:10px"><table class="tb"><tr><th>الوقت</th><th>الطلب</th><th>الرمز</th><th>الرسالة</th><th>المستخدم</th></tr>${s.errors.list.map(x => `<tr><td>${X.fd(x.at)} ${new Date(x.at).toLocaleTimeString((window.__LOC||'ar-DZ'), { hour: '2-digit', minute: '2-digit' })}</td><td dir="ltr">${e(x.method)} ${e(x.path)}</td><td>${num(x.status)}</td><td dir="auto">${e(x.msg)}</td><td>${x.user_id ? '#' + x.user_id : '—'}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">✅ لا أخطاء مسجّلة.</td></tr>'}</table></div></div>`;
    }
  }
  async function onAdmin(ev) {
    const b = ev.target.closest('[data-adm]'); if (!b) return;
    const a = b.dataset.adm;
    if (TABS.some(t => t[0] === a)) { ATAB = a; return adminTabs(); }
    if (a === 'approve') { await X.api('POST', '/admin/payments/' + b.dataset.id + '/approve', {}); X.toast('قُبل الدفع وفُعّل الاشتراك'); return drawAdmin(); }
    if (a === 'reject') { const note = prompt('سبب الرفض (يظهر للمشترك):') || ''; await X.api('POST', '/admin/payments/' + b.dataset.id + '/reject', { note }); return drawAdmin(); }
    if (a === 'mdone' || a === 'mnew' || a === 'mdel') { if (a === 'mdel' && !confirm('حذف الرسالة؟')) return; await X.api('POST', '/admin/messages/' + b.dataset.id + '/' + ({ mdone: 'done', mnew: 'new', mdel: 'delete' })[a], {}); return drawAdmin(); }
    if (a === 'lgsave') { await X.api('PUT', '/admin/legal', Object.assign({ body: $('#lg-body').value }, LG)); X.toast('حُفظت الصفحة، وتظهر الآن للزوار'); return drawAdmin(); }
    if (a === 'lgreset') { if (!confirm('استرجاع النص الأصلي لهذه الصفحة؟ سيُحذف تعديلك.')) return; await X.api('PUT', '/admin/legal', Object.assign({ body: '' }, LG)); X.toast('عاد النص الأصلي'); return drawAdmin(); }
    if (a === 'clearerr') { await X.api('DELETE', '/admin/errors'); return drawAdmin(); }
    if (a === 'bknow') { await X.api('POST', '/admin/backups', {}); X.toast('أُنشئت نسخة احتياطية'); return drawAdmin(); }
    if (a === 'fdel') { b.closest('tr').remove(); return; }
    if (a === 'savefeats') {
      const list = [...X.root.querySelectorAll('#ft-t [data-fk]')].map(tr => { const g = n => tr.querySelector(`[data-g="${n}"]`); return { k: tr.dataset.fk || undefined, ar: g('ar').value.trim(), en: g('en').value.trim(), fr: g('fr').value.trim(), shown: g('shown').checked }; }).filter(f => f.ar || f.en || f.fr);
      await X.api('PUT', '/admin/features', { list }); X.toast('حُفظت المميزات'); return drawAdmin();
    }
    if (a === 'saveplans') {
      const plans = [...X.root.querySelectorAll('#pl-t [data-pl]')].map((tr, i) => { const f = n => tr.querySelector(`[data-f="${n}"]`); const L = {}; tr.querySelectorAll('[data-l]').forEach(x => { if (x.value) L[x.dataset.l] = +x.value; });
        return { id: +tr.dataset.pl || 0, name: f('name').value.trim(), days: +f('days').value, price: +f('price').value, price_usd: +f('price_usd').value, free: f('free').checked, features: [...tr.querySelectorAll('[data-ft]:checked')].map(x => x.dataset.ft), active: f('active').checked, note: f('note').value.trim(), limits: L, sort: i }; }).filter(p => p.name);
      await X.api('PUT', '/admin/plans', { plans }); X.toast('حُفظت الباقات'); return drawAdmin();
    }
  }

  /* ================= 🔌 الربط والتكامل ================= */
  async function drawIntegrations() {
    const el = $('#x-int'); if (!el) return;
    el.innerHTML = '<div class="card"><p class="sub">جارٍ التحميل…</p></div>';
    const me = X.me(), adm = me.role === 'admin', br = W.WPRLIB && W.WPRLIB.bridge;
    const [sheets, cfg, notif] = await Promise.all([X.api('GET', '/sheets').catch(() => ({})), adm ? X.api('GET', '/admin/config').catch(() => null) : null, X.api('GET', '/notify').catch(() => null)]);
    const tt = br && br.ok() && W.WPRJOB ? await W.WPRJOB.ttStatus() : null;
    const S = (ok, t) => `<span class="int-s"><i class="${ok ? 'ok' : ''}"></i>${t}</span>`;
    const C = cfg ? cfg.config : {};
    const field = (k, label, ph, type) => `<label class="fl">${label}${C[k] && C[k].source === 'env' ? ' <small>(من إعدادات الخادم)</small>' : ''}<input data-cfg="${k}" ${type === 'secret' ? 'type="password" autocomplete="off"' : ''} dir="ltr" value="${e(C[k] ? C[k].value : '')}" placeholder="${e(ph || '')}"></label>`;
    el.innerHTML = `<div class="int-g">
<div class="card"><h2>🧩 إضافة Chrome</h2>${S(br && br.ok(), br && br.ok() ? 'متصلة · الإصدار ' + e(br.version()) : 'غير متصلة')}<p class="sub">تجمع إعلانات مكتبة ميتا، وتبحث عن المورّد في الأسواق الصينية، وتبحث في TikTok.</p><button class="btn ghost sm" data-v="collect" data-int="ext">التثبيت والتحديث</button></div>
<div class="card"><h2>🎵 TikTok</h2>${S(tt === true, tt === true ? 'مربوط (مسجّل الدخول في Chrome)' : tt === false ? 'غير مربوط' : 'غير معروف (الإضافة غير متصلة)')}<p class="sub">سجّل الدخول في TikTok على نفس المتصفح مرة واحدة: تبحث الإضافة بجلستك دون نافذة التسجيل.</p><a class="btn ghost sm" href="https://www.tiktok.com/login" target="_blank" rel="noopener">🔑 سجّل الدخول في TikTok</a></div>
<div class="card" style="grid-column:1/-1"><h2>📤 Google Sheets</h2>${S(!!sheets.url, sheets.url ? 'مربوط' : 'غير مربوط')}<p class="sub">أرسل نتائج التحليل والمنتجات المحفوظة إلى جدولك مباشرة بزر «📤 إلى Google Sheets». الربط مرة واحدة:</p>
<ol class="sub" style="line-height:2"><li>افتح جدولاً جديداً في Google Sheets، ثم <b>Extensions ← Apps Script</b>.</li><li>امسح ما فيه والصق الكود أدناه، وغيّر <code>TOKEN</code> إلى رمز سري من اختيارك.</li><li><b>Deploy ← New deployment ← Web app</b>: Execute as <b>Me</b> و Who has access <b>Anyone</b>، ثم <b>Deploy</b> ووافق على الأذونات.</li><li>انسخ رابط <b>Web app</b> (ينتهي بـ /exec) والصقه هنا مع نفس الرمز السري.</li></ol>
<div style="display:flex;gap:8px;margin:6px 0"><button class="btn ghost sm" data-a="gcopy">نسخ كود Apps Script</button></div>
<div class="grid2" style="margin:8px 0 0"><label class="fl">رابط Web app<input id="g-url" dir="ltr" value="${e(sheets.url||'')}" placeholder="https://script.google.com/macros/s/…/exec"></label><label class="fl">الرمز السري (TOKEN)<input id="g-tok" dir="ltr" value="${e(sheets.token||'')}"></label></div>
<p style="margin:8px 0 0;display:flex;gap:8px"><button class="btn" data-a="gsave">حفظ الربط</button><button class="btn ghost" data-a="gtest">إرسال صف تجريبي</button></p></div>
${notif ? `<div class="card" id="x-notif"></div>` : ''}
</div>
${adm ? `<h2 style="margin:22px 0 10px">🔐 مفاتيح المنصة (للمدير فقط)</h2><p class="sub">تُحفظ مشفّرة في قاعدة البيانات، ولا تظهر كاملة بعد الحفظ. ما يُضبط هنا يتقدّم على متغيرات الخادم.</p><div class="int-g">
<div class="card"><h2>🧠 الذكاء الاصطناعي (OpenAI)</h2>${S(C.openai_key && C.openai_key.set, C.openai_key && C.openai_key.set ? 'مفعّل' : 'غير مفعّل')}<p class="sub">لتحليل الإعلان، التعرّف على المنتج من صورته (المورّد)، عبارات الجزائر، ترجمة الكلمات.</p>
${field('openai_key', 'المفتاح', 'sk-…', 'secret')}${field('openai_model', 'النموذج (اختياري)', 'gpt-4.1-mini')}${field('openai_base', 'عنوان الخدمة (اختياري)', 'https://api.openai.com/v1')}
<p style="display:flex;gap:8px;margin:8px 0 0"><button class="btn sm" data-int="save">حفظ</button><button class="btn ghost sm" data-int="testai">اختبار الاتصال</button></p></div>
<div class="card"><h2>💳 CIB / الذهبية (SATIM)</h2>${S(C.satim_user && C.satim_user.set && C.satim_pass && C.satim_pass.set, C.satim_pass && C.satim_pass.set ? 'مفعّل · ' + (C.satim_mode && C.satim_mode.value === 'live' ? 'حقيقي' : 'تجريبي') : 'غير مفعّل')}<p class="sub">دفع مباشر بلا وسيط عبر بوابة SATIM. تحصل على اسم المستخدم وكلمة المرور ورقم الطرفية من بنكك بعد عقد الدفع الإلكتروني (اختبارات المطابقة على الوضع التجريبي أولاً).</p>
${field('satim_user', 'اسم المستخدم (userName)', '')}${field('satim_pass', 'كلمة المرور', '', 'secret')}${field('satim_terminal', 'رقم الطرفية (Terminal ID)', '')}<label class="fl">الوضع<select data-cfg="satim_mode"><option value="test"${!C.satim_mode || C.satim_mode.value !== 'live' ? ' selected' : ''}>تجريبي (test)</option><option value="live"${C.satim_mode && C.satim_mode.value === 'live' ? ' selected' : ''}>حقيقي (live)</option></select></label>
<p style="margin:8px 0 0"><button class="btn sm" data-int="save">حفظ</button></p></div>
<div class="card"><h2>💳 Stripe (بطاقات دولية)</h2>${S(C.stripe_secret && C.stripe_secret.set, C.stripe_secret && C.stripe_secret.set ? 'مفعّل' : 'غير مفعّل')}<p class="sub">Visa وMastercard لكل الدول بالدولار. رابط الإشعارات (Webhook) لحدث checkout.session.completed: <code dir="ltr">${e(location.origin)}/api/billing/webhook/stripe</code></p>
${field('stripe_secret', 'المفتاح السري (Secret key)', 'sk_test_… أو sk_live_…', 'secret')}${field('stripe_webhook', 'سر الإشعارات (Signing secret)', 'whsec_…', 'secret')}
<p style="margin:8px 0 0"><button class="btn sm" data-int="save">حفظ</button></p></div>
<div class="card"><h2>🅿️ PayPal</h2>${S(C.paypal_client && C.paypal_client.set && C.paypal_secret && C.paypal_secret.set, C.paypal_secret && C.paypal_secret.set ? 'مفعّل · ' + (C.paypal_mode && C.paypal_mode.value === 'live' ? 'حقيقي' : 'تجريبي') : 'غير مفعّل')}<p class="sub">من developer.paypal.com: أنشئ تطبيقاً وانسخ Client ID و Secret.</p>
${field('paypal_client', 'Client ID', '')}${field('paypal_secret', 'Secret', '', 'secret')}<label class="fl">الوضع<select data-cfg="paypal_mode"><option value="test"${!C.paypal_mode || C.paypal_mode.value !== 'live' ? ' selected' : ''}>تجريبي (test)</option><option value="live"${C.paypal_mode && C.paypal_mode.value === 'live' ? ' selected' : ''}>حقيقي (live)</option></select></label>
<p style="margin:8px 0 0"><button class="btn sm" data-int="save">حفظ</button></p></div>
<div class="card"><h2>📱 BaridiMob / CCP / تحويل بنكي</h2>${S(C.baridi_info && C.baridi_info.set, C.baridi_info && C.baridi_info.set ? 'مفعّل' : 'غير مفعّل')}<p class="sub">ما يراه المشترك عند الدفع: رقم RIP البريدي، حساب CCP، الحساب البنكي (RIB)، والاسم. يرسل المشترك الوصل مع اسم متجره عبر واتساب (رقم «واتساب الدعم» أدناه)، ويظهر طلبه في «إدارة المشتركين ← المدفوعات» لتقبله بضغطة.</p>
<label class="fl">معلومات التحويل<textarea data-cfg="baridi_info" rows="5" dir="auto" placeholder="BaridiMob (RIP): 00799999…\nCCP: 0000000000 clé 00\nBanque (RIB): …\nالاسم: …">${e(C.baridi_info ? C.baridi_info.value : '')}</textarea></label>
<p style="margin:8px 0 0"><button class="btn sm" data-int="save">حفظ</button></p></div>
<div class="card"><h2>✈️ بوت تيليغرام (للتنبيهات)</h2>${S(C.telegram_token && C.telegram_token.set, C.telegram_token && C.telegram_token.set ? 'مفعّل' : 'غير مفعّل')}<p class="sub">أنشئ بوتاً من <a href="https://t.me/BotFather" target="_blank" rel="noopener">@BotFather</a> وضع رمزه واسمه هنا، فيستطيع كل مشترك ربط حسابه وتلقي التنبيهات.</p>
${field('telegram_token', 'رمز البوت (Token)', '123456:ABC…', 'secret')}${field('telegram_bot', 'اسم البوت', 'RadarProductsBot')}
<p style="margin:8px 0 0"><button class="btn sm" data-int="save">حفظ</button></p></div>
<div class="card"><h2>🏢 معلومات النشاط والدعم</h2><p class="sub">تظهر في الصفحات القانونية (الشروط، الخصوصية، الاسترداد، اتصل بنا) وفي الدعم. <a href="/terms" target="_blank">معاينة</a></p>
${field('biz_name', 'اسم النشاط', 'Winning Product Radar')}${field('biz_country', 'البلد (القانون المطبّق)', 'الجزائر')}${field('biz_address', 'العنوان (اختياري)', '')}
${field('support_email', 'بريد الدعم', 'support@…')}${field('support_whatsapp', 'واتساب الدعم (اختياري)', '+213…')}${field('refund_days', 'مدة طلب الاسترداد (أيام)', '7')}${field('legal_updated', 'تاريخ آخر تحديث للشروط', '2026-11-10')}
<p style="margin:8px 0 0"><button class="btn sm" data-int="save">حفظ</button></p></div>
<div class="card"><h2>📈 قياس الزيارات والإعلانات</h2><p class="sub">في الصفحات العامة فقط (الرئيسية، التسجيل، الصفحات القانونية) لقياس نتائج إعلاناتك: زيارة الصفحة، وإنشاء حساب (CompleteRegistration / sign_up). لا يُحمَّل شيء منها داخل المنصة. اتركه فارغاً لتعطيله.</p>
${field('ga_id', 'Google Analytics 4 (Measurement ID)', 'G-XXXXXXXXXX')}${field('meta_pixel', 'Meta Pixel ID', '123456789012345')}
<p style="margin:8px 0 0"><button class="btn sm" data-int="save">حفظ</button></p></div>
<div class="card"><h2>🌐 المنصة والبريد</h2>${field('app_url', 'عنوان المنصة الكامل', 'https://winningproductradar.com')}<p class="sub">بريد الإرسال (SMTP): ${cfg && cfg.smtp ? '✅ مضبوط في إعدادات الخادم' : '⚠️ غير مضبوط (SMTP_HOST في إعدادات الخادم)'}</p><p style="margin:8px 0 0"><button class="btn sm" data-int="save">حفظ</button></p></div>
</div>` : ''}`;
    if (notif && W.WPRNOTIFY) W.WPRNOTIFY.draw($('#x-notif'), notif);
  }
  async function onInt(ev) {
    const b = ev.target.closest('[data-int]'); if (!b) return;
    const a = b.dataset.int;
    if (['tglink', 'tgcheck', 'tgoff', 'ntest'].includes(a)) return onNotify(a, b);
    if (a === 'ext') { localStorage.setItem('wpr_collect_prefs_v1', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('wpr_collect_prefs_v1') || '{}'), { tab: 'ext' }))); return; }
    if (a === 'save') { const body = {}; b.closest('.card').querySelectorAll('[data-cfg]').forEach(i => { body[i.dataset.cfg] = i.value; }); await X.api('PUT', '/admin/config', body); X.toast('حُفظت الإعدادات'); return drawIntegrations(); }
    if (a === 'testai') { const r = await X.api('POST', '/admin/config/test-ai', {}); X.toast('✅ الذكاء الاصطناعي يعمل (' + r.model + ')'); }
  }

  /* ================= 🔔 التنبيهات (بريد / تيليغرام) ================= */
  const VIA = { telegram: '✈️ تيليغرام', email: '✉️ البريد', app: '🔔 المنصة' };
  function drawNotify(el, d) {
    if (!el) return;
    const P = d.prefs, tg = d.tg;
    el.innerHTML = `<h2>🔔 التنبيهات</h2><p class="sub">تصلك رسالة عند: ظهور منافس لمنتج في «ثغرات السوق»، إعلانات جديدة لمنافس تراقبه، منتج جديد صار «جوهرة»، والدفع وقرب انتهاء الاشتراك.</p>
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
        const cur = X.cur(), fn = cur === 'admin' ? onAdmin : cur === 'integrations' ? onInt : null;
        const acc = ev.target.closest('[data-acc="plans"]'); if (acc) { plansModal(); return; }
        if (!fn) return; const pr = Promise.resolve().then(() => fn(ev)); W.__btnBusy && W.__btnBusy(ev, pr); pr.catch(x => { if (x && x.message !== 'auth') X.toast(x.message || 'حدث خطأ', 'err'); });
      });
      afterReturn();
    },
    billing: () => drawBilling(), admin: () => adminTabs(), integrations: () => drawIntegrations()
  };
})();
