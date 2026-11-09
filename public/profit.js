/* 💰 حاسبة الربح للدفع عند الاستلام (الجزائر): هل يربح هذا المنتج بعد الإعلان والتأكيد والتسليم والمرتجعات؟
   تُفتح من زر «💰 حاسبة الربح» في بطاقة المنتج. تُحفظ المدخلات لكل منتج، وآخر النسب تصبح افتراضية للمنتج التالي. */
(function () {
  'use strict';
  const W = window;
  const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => Math.round(Number(n) || 0).toLocaleString('ar-DZ');
  const dz = n => num(n) + ' دج';
  const MK = () => W.RadarMarkets || W.WPRMarkets || null;
  const rate = c => { if (!c || c === 'DZD') return 1; const m = MK(); return (m && m.RATES_DZD && m.RATES_DZD[c]) || 0; };
  const DEF = { price: '', cost: '', costCur: 'CNY', ship: 350, deliv: 0, pack: 50, cpl: 400, conf: 70, rate: 75, ret: 200, leads: 20 };
  const st = document.createElement('style');
  st.textContent = `.pf-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}.pf-g .fl small{display:block;color:var(--mut);font-weight:400;font-size:11.5px}
.pf-r{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:12px}.pf-r div{border:1px solid var(--line);border-radius:12px;padding:10px;background:var(--card2)}.pf-r b{display:block;font-size:19px}.pf-r span{font-size:12px;color:var(--mut)}
.pf-r .good{border-color:#16a34a;background:rgba(22,163,74,.08)}.pf-r .bad{border-color:#dc2626;background:rgba(220,38,38,.08)}.pf-v{margin-top:12px;padding:10px 12px;border-radius:12px;font-weight:600}
.pf-v.good{background:rgba(22,163,74,.12);color:#15803d}.pf-v.mid{background:rgba(245,158,11,.14);color:#b45309}.pf-v.bad{background:rgba(220,38,38,.12);color:#b91c1c}.pf-f{font-size:12.5px;color:var(--mut);line-height:1.9;margin-top:10px}`;
  document.head.appendChild(st);

  // الحساب: كل الأرقام لكل طلب «مُسلَّم» (هو الذي يدخل منه المال فعلاً)
  function calc(v) {
    const n = k => Math.max(0, +v[k] || 0);
    const conf = Math.min(100, n('conf')) / 100, del = Math.min(100, n('rate')) / 100, ok = conf * del;
    const unit = n('cost') * rate(v.costCur) + n('ship');            // تكلفة القطعة واصلة إلى الجزائر
    const adPer = ok ? n('cpl') / ok : 0;                              // كل طلب مسلَّم «يدفع» إعلان كل الطلبات الضائعة
    const retPer = del ? n('ret') * (1 - del) / del : 0;               // المرتجعات بعد التأكيد: رسوم الإرجاع موزعة على المسلَّم
    const fixed = unit + n('deliv') + n('pack');
    const profit = n('price') - fixed - adPer - retPer, spent = fixed + adPer + retPer;
    const beCpl = Math.max(0, (n('price') - fixed - retPer) * ok);     // أقصى تكلفة إعلان للطلب قبل الخسارة
    const leads = n('leads'), dDel = leads * ok;
    return { unit, adPer, retPer, profit, margin: n('price') ? profit / n('price') * 100 : 0, roi: spent ? profit / spent * 100 : 0, beCpl, ok, dDel, day: profit * dDel, month: profit * dDel * 30, spendDay: leads * n('cpl'), rateOk: !v.cost || rate(v.costCur) > 0 };
  }

  let X = null, CUR = null, DATA = null;
  async function data() { if (!DATA) { try { DATA = await X.api('GET', '/profit'); } catch (x) { DATA = { last: {}, items: {} }; } } return DATA; }

  async function open(k, saved) {
    const T = W.WPRTOOLS; if (!T) return;
    const p = (T.productOf && T.productOf(k, saved)) || { k, name: '' };
    const D = await data();
    const v = Object.assign({}, DEF, D.last || {}, (D.items || {})[k] || {});
    CUR = { k, v };
    const b = T.open('💰 حاسبة الربح', '<p class="sub">جارٍ التحميل…</p>');
    // اقتراح التكلفة من أرخص مورّد مطابق بالصورة (إن بحثت عن المورّد سابقاً)
    let hint = null;
    try { const r = await X.api('GET', '/sup?k=' + encodeURIComponent(k)); const pp = T.parsePrice; if (pp) hint = (r.items || []).map(x => Object.assign({ pp: pp(x.price, x.currency) }, x)).filter(x => (x.sim || 0) >= 84 && x.pp && x.pp.v).sort((a, b) => a.pp.dzd - b.pp.dzd)[0] || null; } catch (x) {}
    const inp = (f, label, help, extra) => `<label class="fl">${label}${help ? `<small>${help}</small>` : ''}<input type="number" min="0" step="any" inputmode="decimal" data-pf="${f}" value="${e(v[f])}" ${extra || ''}></label>`;
    b.innerHTML = `${p.name ? `<p style="margin:0 0 8px"><b dir="auto">${e(p.name)}</b>${p.price ? ` <span class="sub">· سعره في سوقه: ${e(p.price)}</span>` : ''}</p>` : ''}
${hint ? `<div class="alert info" style="margin-bottom:10px">🏭 أرخص مورّد مطابق: <b>${e(hint.price)}</b> <button class="btn ghost sm" data-pf-a="hint" data-val="${hint.pp.v}" data-c="${e(hint.pp.c)}">استعمله كتكلفة</button></div>` : ''}
<div class="pf-g">
${inp('price', 'سعر البيع للزبون (دج)', 'السعر في إعلانك')}
<label class="fl">سعر الشراء من المورّد<small>للقطعة الواحدة</small><span style="display:flex;gap:6px"><input type="number" min="0" step="any" data-pf="cost" value="${e(v.cost)}" style="flex:1"><select data-pf="costCur" style="width:auto">${['CNY', 'USD', 'EUR', 'DZD'].map(c => `<option${v.costCur === c ? ' selected' : ''}>${c}</option>`).join('')}</select></span></label>
${inp('ship', 'الشحن إلى الجزائر للقطعة (دج)', 'شحن + جمركة')}
${inp('deliv', 'التوصيل الذي تتحمّله أنت (دج)', '0 إن كان الزبون يدفعه')}
${inp('pack', 'التغليف وأخرى للطلب (دج)', '')}
${inp('cpl', 'تكلفة الإعلان لكل طلب (دج)', 'ميزانية الإعلان ÷ عدد الطلبات')}
${inp('conf', 'نسبة التأكيد %', 'من الطلبات يؤكدها الزبون هاتفياً', 'max="100"')}
${inp('rate', 'نسبة التسليم %', 'من المؤكَّد يستلمه ويدفع', 'max="100"')}
${inp('ret', 'تكلفة الطلب المرتجَع (دج)', 'رسوم الإرجاع لشركة التوصيل')}
${inp('leads', 'عدد الطلبات يومياً', 'للتقدير اليومي والشهري')}
</div><div id="pf-out"></div>
<p style="margin:12px 0 0;display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-pf-a="save">💾 حفظ لهذا المنتج</button><button class="btn ghost" data-pf-a="reset">القيم الافتراضية</button></p>`;
    const read = () => { b.querySelectorAll('[data-pf]').forEach(i => { v[i.dataset.pf] = i.tagName === 'SELECT' ? i.value : i.value === '' ? '' : +i.value; }); };
    const draw = () => {
      read(); const r = calc(v), out = b.querySelector('#pf-out');
      if (!(+v.price > 0)) { out.innerHTML = '<p class="sub" style="margin-top:12px">أدخل سعر البيع لترى الربح.</p>'; return; }
      const cls = r.profit <= 0 ? 'bad' : r.margin >= 25 ? 'good' : 'mid';
      out.innerHTML = `<div class="pf-r">
<div class="${r.profit > 0 ? 'good' : 'bad'}"><b>${dz(r.profit)}</b><span>صافي الربح لكل طلب مسلَّم</span></div>
<div><b>${num(r.margin)}%</b><span>هامش الربح من سعر البيع</span></div>
<div><b>${num(r.roi)}%</b><span>العائد على ما تصرفه (ROI)</span></div>
<div><b>${dz(r.beCpl)}</b><span>أقصى تكلفة إعلان للطلب قبل الخسارة</span></div>
<div><b>${dz(r.unit)}</b><span>تكلفة القطعة واصلة</span></div>
<div><b>${dz(r.adPer)}</b><span>الإعلان لكل طلب مسلَّم</span></div>
<div><b>${num(r.dDel * 10) / 10 === 0 ? 0 : (Math.round(r.dDel * 10) / 10).toLocaleString('ar-DZ')}</b><span>طلب مسلَّم يومياً من ${num(v.leads)}</span></div>
<div class="${r.day > 0 ? 'good' : r.day < 0 ? 'bad' : ''}"><b>${dz(r.month)}</b><span>الربح المتوقَّع شهرياً (${dz(r.day)} يومياً)</span></div>
</div>
<div class="pf-v ${cls}">${cls === 'good' ? '✅ منتج مربح: هامش جيد يتحمّل ارتفاع تكلفة الإعلان.' : cls === 'mid' ? '⚠️ مربح لكن الهامش ضيق: أي ارتفاع في تكلفة الإعلان أو المرتجعات قد يمحو الربح. جرّب رفع السعر أو عرض كمية (2 بـ…).' : '❌ خاسر بهذه الأرقام: ارفع السعر، أو اخفض تكلفة الإعلان تحت ' + dz(r.beCpl) + '، أو حسّن نسبة التأكيد.'}</div>
${r.rateOk ? '' : '<div class="alert">لا يوجد سعر صرف لهذه العملة؛ اكتب التكلفة بالدينار.</div>'}
<div class="pf-f">من كل ${num(100)} طلب: يُؤكَّد ${num(+v.conf || 0)}، ويُسلَّم ${num(r.ok * 100)}. تكلفة الإعلان تُدفع على كل الطلبات، لذلك تُقسَم على المسلَّم فقط (${dz(v.cpl)} ÷ ${(Math.round(r.ok * 100) / 100).toLocaleString('ar-DZ')}).
المرتجعات: ${dz(r.retPer)} لكل طلب مسلَّم. أسعار الصرف تقريبية (اليوان ≈ ${num(rate('CNY') * 10) / 10 || '—'} دج).</div>`;
    };
    b.addEventListener('input', draw); b.addEventListener('change', draw);
    b.addEventListener('click', async ev => {
      const t = ev.target.closest('[data-pf-a]'); if (!t) return; const a = t.dataset.pfA;
      if (a === 'hint') { b.querySelector('[data-pf="cost"]').value = t.dataset.val; b.querySelector('[data-pf="costCur"]').value = MK() && MK().RATES_DZD[t.dataset.c] ? t.dataset.c : 'DZD'; return draw(); }
      if (a === 'reset') { Object.keys(DEF).forEach(f => { if (f !== 'price' && f !== 'cost') { const i = b.querySelector(`[data-pf="${f}"]`); if (i) i.value = DEF[f]; } }); return draw(); }
      if (a === 'save') {
        read(); const pr = X.api('PUT', '/profit', { k, v }); W.__btnBusy && W.__btnBusy(ev, pr);
        try { await pr; DATA = null; const r = calc(v); X.toast('حُفظت الحاسبة · ربح ' + dz(r.profit) + ' للطلب'); W.WPRPROFIT.chips(); } catch (x) { X.toast(x.message, 'err'); }
      }
    });
    draw();
  }

  // شارة الربح على بطاقات المنتجات المحفوظة التي حُسبت
  async function chips() {
    if (!X) return; const D = await data(), it = D.items || {};
    document.querySelectorAll('[data-tool="profit"][data-k]').forEach(btn => {
      const v = it[btn.dataset.k]; if (!v || !(+v.price > 0)) { btn.textContent = '💰 حاسبة الربح'; btn.classList.remove('pf-on'); return; }
      const r = calc(Object.assign({}, DEF, v)); btn.textContent = '💰 ' + (r.profit >= 0 ? '+' : '') + num(r.profit) + ' دج/طلب'; btn.title = 'صافي الربح المحسوب لكل طلب مسلَّم · اضغط للتعديل';
    });
  }

  W.WPRPROFIT = { init(ctx) { X = ctx; }, open: (k, saved) => open(k, saved), calc, chips };
})();
