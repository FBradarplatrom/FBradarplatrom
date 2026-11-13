/* المدير ← «المشتركون»: جدول المشتركين (البريد، الدور، الباقة والمدة) وسجل النشاط.
   نُقل كما هو من views/app.html (تنظيم فقط، بلا تغيير في الوظائف). يستعمل أدوات الصفحة من W.__APP. */
(function () {
  'use strict';
  const W = window, A = () => W.__APP;
  async function rAdmin() {
    const { api, e, fd, ft, uaShort, AK, $ } = A();
    const [us,AP]=await Promise.all([api('GET','/admin/users'),api('GET','/admin/plans').catch(()=>({plans:[]}))]);const PN=(AP.plans||[]).filter(p=>p.active||p.free).map(p=>p.name);
 $('#x-users').innerHTML=`<div class="tbw"><table class="tb"><tr><th>المستخدم</th><th>البريد</th><th>الدور</th><th>الاشتراك</th><th>تعديل الاشتراك</th><th>إجراءات</th></tr>${us.map(u=>`<tr><td><b>${e(u.name||'—')}</b><br><small dir="ltr">${e(u.username||'')}</small></td><td><input dir="ltr" data-em="${u.id}" value="${e(u.email)}"></td><td><select data-role="${u.id}"><option value="member"${u.role==='member'?' selected':''}>مشترك</option><option value="admin"${u.role==='admin'?' selected':''}>مدير</option></select></td><td>${e(u.plan)}<br><small>${u.role==='admin'?'—':u.expires_at>Date.now()?fd(u.expires_at):'منتهٍ'}</small></td><td style="white-space:nowrap"><select data-pn="${u.id}" style="width:auto" title="الباقة">${PN.map(n=>`<option${n===u.plan?' selected':''}>${e(n)}</option>`).join('')}</select> <select data-plan="${u.id}" style="width:auto" title="المدة"><option value="30">شهر</option><option value="90">3 أشهر</option><option value="180">6 أشهر</option><option value="365">12 شهراً</option><option value="0">مخصص</option></select> <input type="number" value="30" style="width:76px" data-days="${u.id}" title="أيام (سالب = إنقاص)"> <button class="btn sm" data-a="grant" data-id="${u.id}" title="تُضاف الأيام إلى ما بقي. تغيير الباقة يحوّل الأيام المتبقية بنسبة السعر الشهري">تطبيق</button></td><td style="white-space:nowrap"><button class="btn ghost sm" data-a="usave" data-id="${u.id}">حفظ</button> <button class="btn ghost sm" data-a="rlink" data-id="${u.id}">رابط استعادة</button> <button class="btn danger sm" data-a="udel" data-id="${u.id}">حذف</button></td></tr>`).join('')}</table></div>`
 try{const L=await api('GET','/admin/activity');$('#x-users').insertAdjacentHTML('beforeend',`<details class="fx" style="margin-top:16px"><summary>📜 سجل النشاط (آخر ${L.length} عملية)</summary><div class="tbw"><table class="tb"><tr><th>العملية</th><th>المستخدم</th><th>التفاصيل</th><th>التاريخ</th><th>الجهاز</th><th>العنوان</th></tr>${L.map(a=>`<tr${a.kind==='login_fail'?' style="color:var(--bad)"':''}><td>${AK[a.kind]||e(a.kind)}</td><td>${e(a.email||'—')}</td><td>${e(a.detail||'')}</td><td>${fd(a.at)} ${ft(a.at)}</td><td>${e(uaShort(a.ua))}</td><td dir="ltr">${e(a.ip)}</td></tr>`).join('')}</table></div></details>`)}catch(x){}
  }
  async function act(a, id, b) {
    const { api, e, toast, two, R, $ } = A();
 if(a==='grant'){const pn=R.querySelector('[data-pn="'+id+'"]');await api('POST','/admin/users/'+id,{days:+R.querySelector('[data-days="'+id+'"]').value,plan:pn?pn.value:''});toast('تم تحديث الاشتراك');return rAdmin()}
 if(a==='usave'){await api('POST','/admin/users/'+id+'/update',{email:R.querySelector('[data-em="'+id+'"]').value,role:R.querySelector('[data-role="'+id+'"]').value});toast('تم الحفظ');return rAdmin()}
 if(a==='rlink'){const j=await api('POST','/admin/users/'+id+'/reset-link',{});$('#x-link').innerHTML=`<div class="alert info">أرسل هذا الرابط للمشترك (صالح ساعة واحدة):<br><b dir="ltr" style="word-break:break-all;user-select:all">${e(j.url)}</b></div>`;return}
 if(a==='udel'){if(!two(b))return;await api('DELETE','/admin/users/'+id);toast('تم الحذف');return rAdmin()}
  }
  // اختيار المدة يملأ عدد الأيام
  function change(ev) { const { R } = A(); const ps = ev.target.closest('[data-plan]'); if (!ps) return false; R.querySelector('[data-days="' + ps.dataset.plan + '"]').value = ps.value === '0' ? 30 : ps.value; return true; }
  W.WPRUSERS = { render: rAdmin, act, change, acts: ['grant', 'usave', 'rlink', 'udel'] };
})();
