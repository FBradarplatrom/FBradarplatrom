/* «📘 دليل الاستخدام»: كل خطوات المنصة بالترتيب، لكل خطوة: مكانها في القائمة، تعليمات مرقّمة، صورة توضيحية مبسّطة
   بعلامات حمراء مرقّمة (رسم HTML لا صور حقيقية)، وزر «افتح هذه الصفحة». النصوص عربية وتُترجم بالقاموس (i18n-dict.js). */
(function () {
  'use strict';
  const W = window;
  const st = document.createElement('style');
  st.textContent = `
.gd-flow{display:flex;flex-wrap:wrap;gap:6px 4px;align-items:center}.gd-flow span{background:var(--soft);color:var(--brand);border-radius:10px;padding:6px 10px;font-weight:600;font-size:13.5px}.gd-flow i{color:var(--mut);font-style:normal}
.gd-toc{display:grid;grid-template-columns:1fr 1fr;gap:2px 28px;margin:16px 0 4px;padding:0;list-style:none}.gd-toc a{display:flex;gap:10px;padding:6px 4px;color:var(--ink);text-decoration:none;border-radius:8px;font-size:14.5px}.gd-toc a:hover{background:var(--card2);color:var(--brand)}.gd-toc b{color:var(--mut);font-weight:500;min-width:22px;text-align:end}
@media(max-width:760px){.gd-toc{grid-template-columns:1fr}}
.gd-st{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:22px;align-items:start;margin-top:16px;scroll-margin-top:16px}@media(max-width:960px){.gd-st{grid-template-columns:1fr}}
.gd-n{font-size:12px;font-weight:700;color:var(--brand);letter-spacing:.3px}.gd-st h2{margin:4px 0 8px;font-size:19px}
.gd-path{display:inline-block;background:var(--card2);border:1px solid var(--line);border-radius:8px;padding:2px 10px;font-size:12.5px;color:var(--mut);margin-bottom:10px}
.gd-ol{list-style:none;margin:0;padding:0;display:grid;gap:10px}.gd-ol li{display:flex;gap:10px;line-height:1.75}.gd-ol li>b,.mk{flex:none;width:22px;height:22px;border-radius:50%;background:#e11d48;color:#fff;font-size:12px;display:inline-grid;place-items:center;font-weight:700;line-height:1}
.gd-tip{background:var(--soft);border-radius:12px;padding:10px 12px;margin-top:12px;font-size:14px;line-height:1.7}
.gm{border:1px solid var(--line);border-radius:14px;background:var(--card2);overflow:hidden;font-size:12.5px}.gm-h{display:flex;align-items:center;gap:6px;padding:7px 10px;border-bottom:1px solid var(--line);color:var(--mut)}.gm-h i{width:8px;height:8px;border-radius:50%;background:var(--line)}
.gm-b{padding:12px;display:grid;gap:8px}.gm-r{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.gm-c{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 10px}
.gm-hl{outline:2px solid #e11d48;outline-offset:1px;border-radius:8px}.gm-btn{background:var(--brand);color:#fff;border-radius:8px;padding:4px 10px;font-weight:600}.gm-gh{border:1px solid var(--line);border-radius:8px;padding:3px 9px;background:var(--card)}
.gm-pill{border-radius:99px;padding:2px 9px;font-weight:600;background:var(--card);border:1px solid var(--line)}.gm-bar{height:6px;border-radius:9px;background:var(--line);overflow:hidden}.gm-bar i{display:block;height:100%;background:linear-gradient(90deg,#118553,#0a7040)}
.gm .mk{width:18px;height:18px;font-size:11px}.gm-wa{background:#25d366;color:#fff;border-radius:8px;padding:4px 10px;font-weight:600}`;
  document.head.appendChild(st);

  // أدوات الرسم المبسّط
  const mk = n => `<span class="mk">${n}</span>`;
  const win = (t, body) => `<div class="gm" aria-hidden="true"><div class="gm-h"><i></i><i></i><i></i><span>${t}</span></div><div class="gm-b">${body}</div></div>`;
  const row = (...a) => `<div class="gm-r">${a.join('')}</div>`;
  const c = (x, hl) => `<span class="gm-c${hl ? ' gm-hl' : ''}">${x}</span>`;
  const btn = (x, hl) => `<span class="gm-btn${hl ? ' gm-hl' : ''}">${x}</span>`;
  const gh = (x, hl) => `<span class="gm-gh${hl ? ' gm-hl' : ''}">${x}</span>`;
  const pill = (x, bg) => `<span class="gm-pill" style="${bg ? 'background:' + bg + ';color:#fff;border:0' : ''}">${x}</span>`;

  /* [عنوان، المكان، القسم، [تعليمات]، نصيحة، رسم] */
  const S = [
    ['ثبّت إضافة Chrome', 'جمع الإعلانات ← 🧩 الإضافة', 'collect',
      ['نزّل الإضافة وفُكّ ضغطها في مجلد دائم.', 'افتح chrome://extensions وفعّل «وضع المطوّر»، ثم «تحميل إضافة غير مضغوطة» واختر المجلد.', 'أعد تحميل المنصة: تتحول الحالة إلى «الإضافة متصلة».'],
      'تعمل على Chrome في الحاسوب. النتائج والتحليل تعمل من الجوال بعد الجمع.',
      win('جمع الإعلانات', row(gh('📡 الجمع'), gh('🔑 القاموس'), gh('🧩 الإضافة', 1), mk(1)) + `<div class="gm-c">${row(pill('● الإضافة متصلة · v1.7', '#059669'), mk(3))}</div>` + row(btn('⬇️ نزّل الإضافة'), mk(2)))],
    ['اختر سوقك وكلماتك', 'جمع الإعلانات ← 📡 الجمع', 'collect',
      ['في «إعدادات البحث والجمع» اختر الدولة التي تبحث فيها (مثلاً فرنسا أو السعودية).', 'اختر الكلمات الذهبية (عبارات الفائدة) والنيشات: كل اختيار يصير عملية بحث.', 'عدّل القوائم من تبويب «القاموس» إن أردت كلمات خاصة بك.'],
      'ابحث في الأسواق الكبيرة لتجد المنتج الرابح قبل أن يصل إلى سوقك.',
      win('إعدادات البحث والجمع', row(c('الدولة: فرنسا ▾', 1), mk(1), c('نشطة فقط ▾')) + row(pill('يحل'), pill('يساعد على', ''), pill('وداعا'), mk(2)) + row(gh('✎ إضافة / حذف كلمات'), mk(3))) ],
    ['ابدأ الجمع', 'جمع الإعلانات ← 🏆 بحث جماعي', 'collect',
      ['اضغط «ابدأ البحث الجماعي»: يُفتح تبويب فيسبوك ويبدأ الجمع.', 'اترك تبويب فيسبوك ظاهراً حتى ينتهي، وصفحة المنصة مفتوحة في تبويب آخر.', 'يظهر التقدّم لحظة بلحظة، وتصل الإعلانات إلى «الإعلانات الواردة».'],
      'التزم بالسرعة العادية أو البطيئة وبكميات معقولة لحماية حسابك على فيسبوك.',
      win('⏳ الجمع يعمل', row(btn('ابدأ البحث الجماعي', 1), mk(1)) + `<div class="gm-bar"><i style="width:60%"></i></div>` + row(c('✅ يحل طفلك · 140'), c('🔄 وداعا الألم · 85'), mk(3)))],
    ['حلّل الدفعة', 'الإعلانات الواردة', 'inbox',
      ['كل عملية جمع تصل كدفعة. اضغط «تحليل» بجانبها.', 'أو حدّد عدة دفعات واضغط «تحليل المحدد معاً»: النتيجة أدق.', 'يُحفظ كل تحليل في «الأرشيف» تلقائياً.'],
      'للحصول على أدق نتيجة: أكثر من 400 إعلان من 3 كلمات بحث فأكثر.',
      win('الإعلانات الواردة', row(c('☑ يحل طفلك · 312 إعلان'), btn('تحليل', 1), mk(1)) + row(c('☑ وداعا الألم · 205 إعلان'), btn('تحليل')) + row(gh('تحليل المحدد معاً', 1), mk(2)))],
    ['اقرأ التصنيفات', 'تحليل جديد ← النتائج', 'analyze',
      ['كل منتج يأخذ تصنيفاً حسب عمر إعلانه النشط: 🧪 تجربة، 🌱 واعد، 💎 جوهرة، 🔥 ناري، 🕰️ قديم.', 'الإعلان الذي يستمر صاحبه في دفع ثمنه أياماً طويلة دليل على أنه يبيع.', 'أعلى الصفحة: المرصود، المجلوب، ما دخل التحليل، المستبعد، وعدد البائعين.'],
      'ابدأ بـ 💎 الجوهرة: منتجات أثبتت نفسها ولم تتشبّع بعد.',
      win('النتائج', row(pill('🧪 تجربة'), pill('🌱 واعد'), pill('💎 جوهرة', '#118553'), pill('🔥 ناري'), mk(1)) + `<div class="gm-c">${row('<b>مصباح ليلي نجوم</b>', pill('💎 جوهرة', '#118553'))}<div>${row(c('نشط'), c('21 يوماً', 1), mk(2), c('29 US$'))}</div></div>`)],
    ['صفِّ النتائج', 'تحليل جديد ← الفلاتر', 'analyze',
      ['افتح «الفلاتر»: السوق، السعر، الصيغة، والترتيب.', '«استبعاد المكرر» يُبقي أقدم نسخة من نفس الإعلان لكل صفحة.', 'نزّل النتائج CSV أو أرسلها إلى Google Sheets.'],
      '',
      win('الفلاتر', row(c('السوق: كل الأسواق ▾'), c('السعر من ... إلى'), mk(1)) + row(c('☑ استبعاد المكرر', 1), mk(2)) + row(gh('تحميل CSV'), gh('📤 إلى Google Sheets'), mk(3)))],
    ['راجع المستبعد', 'تحليل جديد ← 🚫 مستبعد', 'analyze',
      ['تبويب «🚫 مستبعد» يعرض كل إعلان استُبعد مع سببه: علامة تجارية رسمية، بلا تاريخ، أو متوقف.', 'إن كان السبب خاطئاً اضغط «↩️ سبب خاطئ»: يعود المنتج ولا يُستبعد بهذا السبب مستقبلاً.', 'يمكنك التراجع عن تصحيحاتك من «القواميس والقوائم».'],
      '',
      win('🚫 مستبعد', `<div class="gm-c">${row('<b>Nike Air</b>', pill('علامة تجارية'))}${row(gh('↩️ سبب خاطئ', 1), mk(2))}</div>` + row(c('السبب: صفحة العلامة نفسها'), mk(1)))],
    ['احفظ المنتج', 'بطاقة المنتج ← ☆ حفظ المنتج', 'saved',
      ['اضغط «☆ حفظ المنتج» على أي بطاقة تعجبك.', 'يُحفظ كما هو بصوره وإعلاناته وتحليله، حتى لو توقف الإعلان لاحقاً.', 'تجده في «المنتجات المحفوظة» مع ملاحظاتك.'],
      '',
      win('بطاقة المنتج', row('<b>مصباح ليلي نجوم</b>') + row(gh('🏭 المورّد'), gh('🧠 تحليل الإعلان'), gh('💰 حاسبة الربح')) + row(btn('☆ حفظ المنتج', 1), mk(1)) + row(c('ملاحظتي: جرّبه في رمضان'), mk(3)))],
    ['ابحث عن المورّد', 'بطاقة المنتج ← 🏭 المورّد', 'saved',
      ['اضغط «🏭 المورّد»: يتعرّف الذكاء الاصطناعي على المنتج من صورته ويقترح عبارة البحث.', 'اختر الأسواق (AliExpress، Alibaba، 1688…) واضغط «ابحث في الأسواق المختارة».', 'تقارن المنصة صورة كل نتيجة بصورة منتجك وتحوّل السعر إلى عملتك.'],
      'Taobao وPinduoduo يحتاجان أن تكون مسجّلاً فيهما على Chrome.',
      win('🏭 المورّد', row(c('star projector night light', 1), mk(1)) + row(pill('AliExpress'), pill('1688'), pill('Alibaba'), btn('🔎 ابحث', 1), mk(2)) + row(c('🟢 مطابق بالصورة · 4.2 US$'), mk(3))) ],
    ['احسب ربحك', 'بطاقة المنتج ← 💰 حاسبة الربح', 'saved',
      ['أدخل سعر البيع، وتكلفة المورّد والشحن، وتكلفة الإعلان لكل طلب.', 'أدخل نسبة التأكيد ونسبة التسليم كما في تجارتك.', 'تعرف صافي الربح لكل طلب مسلَّم، وأقصى تكلفة إعلان قبل الخسارة.'],
      '',
      win('💰 حاسبة الربح', row(c('سعر البيع: 3900'), c('تكلفة القطعة: 1200'), mk(1)) + row(c('التأكيد 70%'), c('التسليم 80%'), mk(2)) + `<div class="gm-c gm-hl">${row('<b>صافي الربح: 950 / طلب</b>', mk(3))}</div>`)],
    ['حلّل الإعلان بالذكاء الاصطناعي', 'بطاقة المنتج ← 🧠 تحليل الإعلان', 'saved',
      ['اضغط «🧠 حلّل الآن»: لماذا يبيع، لمن، والمشكلة التي يحلها.', 'تحصل على افتتاحيات فيديو ونصوص إعلان جاهزة بعدة لغات.', 'لا يخترع مواصفات غير مذكورة في الإعلان.'],
      '',
      win('🧠 تحليل الإعلان', row(btn('🧠 حلّل الآن', 1), mk(1)) + row(c('👥 الجمهور المستهدف'), c('😣 المشكلة التي يحلها'), mk(2)) + row(c('✍️ نصوص إعلان مقترحة'), mk(2)))],
    ['افحص المنتج في سوقك', 'ثغرات السوق', 'gap',
      ['من بطاقة منتج محفوظ اضغط «🎯 افحص في سوقك».', 'اختر «سوقك المستهدف» (الجزائر، المغرب، فرنسا…) وجهّز عبارات البحث بلغاته أو اقترحها بالذكاء الاصطناعي.', 'اضغط «ابدأ الفحص»: تقارن المنصة كل إعلان هناك بصورة منتجك ورابط مورّده.', 'النتيجة: 🟢 ثغرة مؤكدة، 🟡 منافسة ضعيفة، 🔵 جُرّب وتوقف، 🔴 مشبع.'],
      'فعّل «المراقبة الأسبوعية» لتعرف متى يظهر أول منافس.',
      win('🎯 ثغرات السوق', row(c('🎯 سوقك المستهدف: الجزائر ▾', 1), mk(2)) + row(btn('🎯 ابدأ الفحص في الجزائر', 1), mk(3)) + row(pill('🟢 ثغرة مؤكدة', '#059669'), mk(4)))],
    ['راقب المنافسين', 'مراقبة المنافسين', 'watch',
      ['من بطاقة المنتج افتح «البائعون» واضغط «👁 راقب» على صفحة منافس.', 'كل فحص يكشف إعلاناته الجديدة (منتجات يختبرها الآن) والتي توقفت.', 'يُعاد الفحص أسبوعياً، وتصلك التنبيهات إن فعّلتها.'],
      '',
      win('👁 مراقبة المنافسين', row(c('Lumi Shop'), gh('👁 راقب', 1), mk(1)) + row(pill('🆕 3 جديد', '#118553'), c('نشط 12 من 30'), mk(2)))],
    ['اكتشف منتجات TikTok', 'منتجات TikTok', 'tiktok',
      ['اختر عبارات مثل «tiktok made me buy it» واضغط «ابدأ البحث».', 'تُرتَّب الفيديوهات بالمشاهدات والتفاعل والحداثة، وتُستبعد غير المنتجات.', 'احفظ الفيديو كمنتج لتبحث عن مورّده وتفحصه في سوقك.'],
      'سجّل الدخول في TikTok على Chrome مرة واحدة لنتائج أكثر.',
      win('🎵 منتجات TikTok', row(pill('tiktok made me buy it'), pill('amazon finds'), btn('🎵 ابدأ البحث', 1), mk(1)) + row(c('1.2M مشاهدة · 8% تفاعل'), gh('⭐ احفظه منتجاً', 1), mk(3)))],
    ['فعّل التنبيهات والربط', 'الربط والتكامل', 'integrations',
      ['اربط تيليغرام أو البريد لتصلك التنبيهات: منتج جديد صار «جوهرة»، منافس جديد، إعلانات جديدة لمنافس تراقبه.', 'اربط Google Sheets لترسل النتائج إلى جدولك بضغطة.', 'تحقق من حالة الإضافة وTikTok في نفس الصفحة.'],
      '',
      win('🔌 الربط والتكامل', row(c('🔔 التنبيهات'), gh('✈️ ربط تيليغرام', 1), mk(1)) + row(c('📤 Google Sheets'), gh('حفظ الربط'), mk(2)))],
    ['عرضك والدفع', 'حسابك ← العرض والدفع', 'settings',
      ['من «اشتراكي» (قائمة الحساب أعلى الصفحة) اضغط «💳 الدفع أو تغيير العرض» واختر العرض.', 'حوّل المبلغ عبر BaridiMob أو CCP أو تحويل بنكي.', 'اكتب اسم متجرك واضغط «إرسال الوصل عبر واتساب» وأرفق صورة الوصل: يُفعَّل عرضك عند الاستلام.'],
      'لا خصم تلقائي: تدفع فقط عندما تقرر التجديد.',
      win('💳 الدفع أو تغيير العرض', row(c('شهر'), c('6 أشهر −8٪', 1), c('12 شهراً −15٪'), mk(1)) + row(c('BaridiMob · CCP · تحويل'), mk(2)) + row(`<span class="gm-wa gm-hl">إرسال الوصل عبر واتساب</span>`, mk(3)))],
    ['احمِ حسابك', 'حسابك ← أمان الحساب', 'settings',
      ['استعمل كلمة مرور قوية لا تستعملها في موقع آخر.', 'راجع «آخر عمليات الدخول»، وإن رأيت دخولاً لا تعرفه غيّر كلمة المرور فوراً.', '«تسجيل الخروج من كل الأجهزة» يغلق كل الجلسات الأخرى.', 'من «بياناتي وحسابي» تصدّر بياناتك أو تحذف حسابك.'],
      '',
      win('🔒 الأمان', row(c('✅ دخول · Chrome · اليوم'), mk(2)) + row(gh('تسجيل الخروج من كل الأجهزة', 1), mk(3)) + row(gh('⬇ تصدير بياناتي'), mk(4)))]
  ];
  const FLOW = ['اجمع الإعلانات', 'حلّل الدفعة', 'احفظ المنتج', 'ابحث عن المورّد', 'احسب ربحك', 'افحص في سوقك'];

  W.WPRGUIDE = {
    count: S.length,
    render(el, top) {
      el.innerHTML = (top || '') + `<div class="card"><h2 style="margin:0 0 10px">مسار العمل</h2><div class="gd-flow">${FLOW.map(x => `<span>${x}</span>`).join('<i>←</i>')}</div></div>
<ol class="gd-toc">${S.map((s, i) => `<li><a href="#gd-${i + 1}" data-gd="${i + 1}"><b>${i + 1}</b><span>${s[0]}</span></a></li>`).join('')}</ol>
<p class="sub" style="font-size:13px">الصور توضيحية بأسماء وأرقام وهمية. شاشتك الحقيقية تشبهها، وبياناتك لا تظهر هنا أبداً.</p>
${S.map((s, i) => `<section class="card gd-st" id="gd-${i + 1}"><div><div class="gd-n">الخطوة ${i + 1} / ${S.length}</div><h2>${s[0]}</h2><span class="gd-path">${s[1]}</span>
<ol class="gd-ol">${s[3].map((t, j) => `<li><b>${j + 1}</b><span>${t}</span></li>`).join('')}</ol>${s[4] ? `<div class="gd-tip"><b>نصيحة:</b> ${s[4]}</div>` : ''}
<p style="margin:14px 0 0"><button class="btn sm" data-v="${s[2]}">افتح هذه الصفحة ↗</button></p></div><div>${s[5]}</div></section>`).join('')}`;
      el.onclick = ev => { const a = ev.target.closest('[data-gd]'); if (!a) return; ev.preventDefault(); const t = document.getElementById('gd-' + a.dataset.gd); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    }
  };
})();
