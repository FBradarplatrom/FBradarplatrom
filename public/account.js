/* الحساب والإدارة: 💳 الاشتراك والدفع (في «الإعدادات») · 🔌 الربط والتكامل (قسم) · لوحة المدير (الإحصائيات، المدفوعات، الباقات، الأخطاء).
   يعمل مع app.html عبر WPRACC.init(ctx). */
(function () {
  'use strict';
  const W = window; let X = null, inited = false;
  const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => Number(n || 0).toLocaleString('ar-DZ');
  const dz = n => num(n) + ' دج';
  const $ = s => X.root.querySelector(s);
  const ST = { pending: ['warn', 'قيد المراجعة'], paid: ['ok', 'مدفوع'], rejected: ['bad', 'مرفوض'], failed: ['bad', 'فشل'] };
  const MT = { satim: '💳 CIB / الذهبية', stripe: '💳 بطاقة دولية (Stripe)', paypal: '🅿️ PayPal', card: '💳 بطاقة', baridi: '📱 BaridiMob / CCP' };
  const money = (a, c) => (c === 'USD' ? '$' + Number(a || 0).toFixed(2) : dz(a));
  const priceOf = x => [x.price > 0 ? dz(x.price) : '', x.price_usd > 0 ? '$' + Number(x.price_usd).toFixed(2) : ''].filter(Boolean).join(' · ');
  const st = document.createElement('style');
  st.textContent = `.meter{margin:8px 0}.meter .t{display:flex;justify-content:space-between;font-size:13px}.meter .b{height:8px;background:var(--line);border-radius:99px;overflow:hidden;margin-top:4px}.meter .b i{display:block;height:100%;background:linear-gradient(90deg,#6366f1,#8b5cf6)}.meter .b i.hot{background:linear-gradient(90deg,#f59e0b,#dc2626)}
.plan-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}.plan{border:1px solid var(--line);border-radius:16px;padding:14px;background:var(--card2);display:flex;flex-direction:column;gap:6px}.plan.on{border-color:var(--brand);box-shadow:0 0 0 2px rgba(99,102,241,.25)}.plan .pr{font-size:24px;font-weight:800}.plan ul{margin:4px 0;padding-inline-start:18px;font-size:13px}
.adm-t{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 16px}.adm-t button{border:1px solid var(--line);background:var(--card);border-radius:99px;padding:7px 14px;font:inherit;font-size:14px;cursor:pointer;color:var(--ink)}.adm-t button.on{background:var(--brand);color:#fff;border-color:var(--brand)}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.kpis div{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px}.kpis b{display:block;font-size:22px}.kpis span{font-size:12.5px;color:var(--mut)}
.bars{display:flex;align-items:flex-end;gap:6px;height:140px;margin-top:10px}.bars div{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;font-size:11px;color:var(--mut)}.bars i{display:block;width:100%;background:linear-gradient(180deg,#8b5cf6,#6366f1);border-radius:6px 6px 0 0;min-height:2px}
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
${adm ? '' : BL.plans.length ? `<p style="margin:10px 0 0"><button class="btn" data-acc="plans">${me.active ? '🔄 جدّد أو غيّر الباقة' : '💳 اشترك الآن'}</button></p>` : `<p class="sub">الدفع الإلكتروني غير متاح بعد.${me.contact ? ` <a href="${e(me.contact)}" target="_blank" rel="noopener">تواصل مع الإدارة</a>` : ''}</p>`}
${BL.payments.length ? `<details class="fx" style="margin-top:10px"><summary>سجل المدفوعات (${num(BL.payments.length)})</summary><div class="tbw"><table class="tb"><tr><th>الباقة</th><th>المبلغ</th><th>الطريقة</th><th>الحالة</th><th>التاريخ</th></tr>${BL.payments.map(p => `<tr><td>${e(p.plan_name)}</td><td>${money(p.amount, p.currency)}</td><td>${MT[p.method] || e(p.method)}</td><td><span class="pill ${(ST[p.status] || [''])[0]}">${(ST[p.status] || ['', p.status])[1]}</span>${p.note ? '<br><small>' + e(p.note) + '</small>' : ''}</td><td>${X.fd(p.created_at)}</td></tr>`).join('')}</table></div></details>` : ''}`;
  }
  function plansModal() {
    const T = W.WPRTOOLS; if (!T) return;
    let sel = BL.plans[0] && BL.plans[0].id;
    const draw = () => {
      const b = T.open('💳 اختر باقتك', '');
      const p = BL.plans.find(x => x.id === sel) || BL.plans[0];
      b.innerHTML = `<div class="plan-g">${BL.plans.map(x => `<div class="plan${x.id === sel ? ' on' : ''}" data-acc="pick" data-id="${x.id}" style="cursor:pointer"><b>${e(x.name)}</b><span class="pr">${priceOf(x)}</span><small>${num(x.days)} يوماً${x.days >= 60 && x.price > 0 ? ' · ' + dz(Math.round(x.price / x.days * 30)) + ' للشهر' : ''}</small>
<ul>${Object.keys(BL.labels).map(k => `<li>${e(BL.labels[k])}: <b>${num(x.limits[k])}</b></li>`).join('')}</ul>${x.note ? `<small>${e(x.note)}</small>` : ''}</div>`).join('')}</div>
<h3 style="margin:16px 0 6px">طريقة الدفع لباقة «${e(p.name)}» · ${priceOf(p)}</h3>
${BL.methods.satim && p.price > 0 ? `<div class="card" style="margin:8px 0"><b>💳 بطاقة CIB أو الذهبية (Edahabia)</b><p class="sub">دفع آمن مباشرة عبر بوابة SATIM بالدينار. يُفعَّل اشتراكك فور نجاح الدفع.</p><button class="btn" data-acc="pay" data-m="satim">ادفع ${dz(p.price)}</button></div>` : ''}
${BL.methods.stripe && p.price_usd > 0 ? `<div class="card" style="margin:8px 0"><b>💳 Visa / Mastercard (Stripe)</b><p class="sub">لكل الدول. يُفعَّل اشتراكك فور نجاح الدفع.</p><button class="btn" data-acc="pay" data-m="stripe">ادفع $${Number(p.price_usd).toFixed(2)}</button></div>` : ''}
${BL.methods.paypal && p.price_usd > 0 ? `<div class="card" style="margin:8px 0"><b>🅿️ PayPal</b><p class="sub">ادفع من حسابك في PayPal أو ببطاقتك. يُفعَّل اشتراكك فور نجاح الدفع.</p><button class="btn" data-acc="pay" data-m="paypal">ادفع $${Number(p.price_usd).toFixed(2)} بـ PayPal</button></div>` : ''}
${BL.methods.baridi && p.price > 0 ? `<div class="card" style="margin:8px 0"><b>📱 BaridiMob أو CCP</b><div class="alert info" style="white-space:pre-wrap;margin:8px 0">${e(BL.methods.baridi)}</div>
<p class="sub">حوّل <b>${dz(p.price)}</b> ثم أدخل رقم العملية وأرفق صورة الوصل. يُفعَّل اشتراكك بعد مراجعة الإدارة (عادة خلال ساعات).</p>
<div class="grid2" style="gap:8px;margin:0"><label class="fl">رقم العملية<input id="bm-ref" dir="ltr"></label><label class="fl">صورة الوصل<input id="bm-img" type="file" accept="image/*"></label></div>
<p style="margin:8px 0 0"><button class="btn" data-acc="baridi">أرسل طلب التفعيل</button></p></div>` : ''}
${!BL.methods.satim && !BL.methods.stripe && !BL.methods.paypal && !BL.methods.baridi ? '<div class="alert">لا توجد طريقة دفع مفعّلة بعد. تواصل مع الإدارة.</div>' : ''}`;
      b.onclick = async ev => {
        const t = ev.target.closest('[data-acc]'); if (!t) return;
        const a = t.dataset.acc;
        if (a === 'pick') { sel = +t.dataset.id; return draw(); }
        const run = f => { const pr = Promise.resolve().then(f); W.__btnBusy && W.__btnBusy(ev, pr); pr.catch(x => X.toast(x.message || 'خطأ', 'err')); };
        if (a === 'pay') run(async () => { const r = await X.api('POST', '/billing/checkout', { plan_id: sel, method: t.dataset.m }); location.href = r.url; });
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
  const TABS = [['users', '👥 المشتركون'], ['stats', '📊 الإحصائيات'], ['pay', '💳 المدفوعات'], ['plans', '📦 الباقات'], ['err', '⚠️ الأخطاء']];
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
${r.keys.map(k => `<td><input data-l="${k}" type="number" value="${e(p.limits ? p.limits[k] : '')}" style="width:70px"></td>`).join('')}<td style="min-width:220px">${r.feats.map(k => `<label style="display:inline-flex;gap:4px;align-items:center;margin:2px 8px 2px 0;font-size:12.5px;white-space:nowrap"><input type="checkbox" data-ft="${k}"${!p.features || p.features.includes(k) ? ' checked' : ''}>${e(r.featLabels[k])}</label>`).join('')}</td><td><input data-f="active" type="checkbox"${p.active !== false ? ' checked' : ''}></td><td><input data-f="note" value="${e(p.note || '')}" placeholder="مثلاً: الأكثر طلباً" style="width:130px"></td></tr>`;
      el.innerHTML = `<div class="card"><h2>الباقات وحدودها</h2><p class="sub">السعر بالدينار (CIB/الذهبية وBaridiMob) وبالدولار (Stripe وPayPal للعالم). الباقة «المجانية للتجربة» تُمنح تلقائياً لكل مسجّل جديد بمدتها وحدودها ولا تُشترى. الباقة بلا سعر أو غير المفعّلة لا تظهر للشراء. الحدود تطبَّق فوراً على كل مشترك اسم باقته يطابق اسمها (يُكتب الاسم عند الدفع أو عند إضافة الأيام يدوياً).</p>
<div class="tbw"><table class="tb" id="pl-t"><tr><th>الاسم</th><th>الأيام</th><th>السعر (دج)</th><th>السعر ($)</th><th>مجانية للتجربة</th>${r.keys.map(k => `<th>${e(r.labels[k])}</th>`).join('')}<th>المميزات (تظهر للزبائن)</th><th>مفعّلة</th><th>ملاحظة</th></tr>${r.plans.map(row).join('')}${row({})}</table></div>
<p style="margin:10px 0 0"><button class="btn" data-adm="saveplans">حفظ الباقات</button></p></div>`;
    }
    if (ATAB === 'err') {
      const s = await X.api('GET', '/admin/stats');
      el.innerHTML = `<div class="card"><div style="display:flex;gap:10px;align-items:center"><h2 style="margin:0;flex:1">⚠️ سجل الأخطاء</h2>${s.errors.list.length ? '<button class="btn danger sm" data-adm="clearerr">مسح السجل</button>' : ''}</div>
<div class="tbw" style="margin-top:10px"><table class="tb"><tr><th>الوقت</th><th>الطلب</th><th>الرمز</th><th>الرسالة</th><th>المستخدم</th></tr>${s.errors.list.map(x => `<tr><td>${X.fd(x.at)} ${new Date(x.at).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })}</td><td dir="ltr">${e(x.method)} ${e(x.path)}</td><td>${num(x.status)}</td><td dir="auto">${e(x.msg)}</td><td>${x.user_id ? '#' + x.user_id : '—'}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">✅ لا أخطاء مسجّلة.</td></tr>'}</table></div></div>`;
    }
  }
  async function onAdmin(ev) {
    const b = ev.target.closest('[data-adm]'); if (!b) return;
    const a = b.dataset.adm;
    if (TABS.some(t => t[0] === a)) { ATAB = a; return adminTabs(); }
    if (a === 'approve') { await X.api('POST', '/admin/payments/' + b.dataset.id + '/approve', {}); X.toast('قُبل الدفع وفُعّل الاشتراك'); return drawAdmin(); }
    if (a === 'reject') { const note = prompt('سبب الرفض (يظهر للمشترك):') || ''; await X.api('POST', '/admin/payments/' + b.dataset.id + '/reject', { note }); return drawAdmin(); }
    if (a === 'clearerr') { await X.api('DELETE', '/admin/errors'); return drawAdmin(); }
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
<div class="card"><h2>📱 BaridiMob / CCP</h2>${S(C.baridi_info && C.baridi_info.set, C.baridi_info && C.baridi_info.set ? 'مفعّل' : 'غير مفعّل')}<p class="sub">ما يراه المشترك عند الدفع: رقم RIP / الحساب، الاسم، والتعليمات. تراجع الطلبات من «إدارة المشتركين ← المدفوعات».</p>
<label class="fl">معلومات التحويل<textarea data-cfg="baridi_info" rows="4" dir="auto" placeholder="RIP: 00799999…\nالاسم: …\nاكتب بريدك في ملاحظة التحويل">${e(C.baridi_info ? C.baridi_info.value : '')}</textarea></label>
<p style="margin:8px 0 0"><button class="btn sm" data-int="save">حفظ</button></p></div>
<div class="card"><h2>✈️ بوت تيليغرام (للتنبيهات)</h2>${S(C.telegram_token && C.telegram_token.set, C.telegram_token && C.telegram_token.set ? 'مفعّل' : 'غير مفعّل')}<p class="sub">أنشئ بوتاً من <a href="https://t.me/BotFather" target="_blank" rel="noopener">@BotFather</a> وضع رمزه واسمه هنا، فيستطيع كل مشترك ربط حسابه وتلقي التنبيهات.</p>
${field('telegram_token', 'رمز البوت (Token)', '123456:ABC…', 'secret')}${field('telegram_bot', 'اسم البوت', 'RadarProductsBot')}
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
