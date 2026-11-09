const fs=require('fs');
eval(fs.readFileSync('dicts.js','utf8').replace('const DEF','global.DEF'));
const C=require('./core.js'),D=864e5,NOW=Date.UTC(2026,9,20),L=C.buildLists(DEF);
let fail=0;const eq=(n,a,b)=>{const ok=JSON.stringify(a)===JSON.stringify(b);if(!ok)fail++;console.log(ok?'ok  ':'FAIL',n,ok?'':`got ${JSON.stringify(a)} want ${JSON.stringify(b)}`)};
const mk=d=>({start:d==null?null:new Date(NOW-d*D),stat:'active'}),S=(d,P)=>C._t.scoreAd(mk(d),P,NOW);
// ===== التصنيف بالمدة وحدها، والفائدة للترتيب =====
const ALL={ben:2,tags:['يساعد طفلك على النوم']};
let r=S(20,ALL);eq('عمر20: جوهرة، فائدة في العنوان = 100',[r.cat,r.score],['gem',100]);
eq('حدود المدة: 0،3 تجربة · 4،7 واعد · 8،30 جوهرة · 31،60 رابح · 61 قديم',[0,3,4,7,8,30,31,60,61,200].map(d=>S(d,ALL).cat),['trial','trial','prom','prom','gem','gem','fire','fire','old','old']);
eq('بلا فائدة لا يتغير التصنيف (المدة وحدها)',[S(5,{ben:0}).cat,S(20,{ben:0}).cat,S(45,{ben:0}).cat],['prom','gem','fire']);
eq('درجة الفائدة: 100 عنوان · 50 نص · 0 بلا',[S(20,{ben:2}).score,S(20,{ben:1}).score,S(20,{ben:0}).score],[100,50,0]);
r=S(null,ALL);eq('بلا تاريخ: ضعيف',[r.cat,r.note],['low','بلا تاريخ']);
eq('وسوم المدة',[S(5,ALL).ev[0].tag,S(20,ALL).ev[0].tag,S(45,ALL).ev[0].tag,S(70,ALL).ev[0].tag],['اجتاز التجربة الأولى','مدة جولد','قديم نسبياً في السوق','قديم في السوق']);
eq('معياران فقط: المدة والفائدة',S(20,ALL).ev.map(e=>e.k),['dur','ben']);
eq('وسم الفائدة يظهر في جدول المعايير',S(20,ALL).ev[1].tag,'يساعد طفلك على النوم');
// ===== هوية المنتج والبائعون والفائدة =====
const row=o=>C.normRow(Object.assign({status:'Active',start_date:new Date(NOW-20*D).toISOString(),format:'VIDEO',page_id:'p0',page_name:'متجر'},o));
const body=t=>t+' وصف طويل للإعلان يتكرر هنا ليتجاوز الثمانين حرفاً حتى نختبر التطابق الحرفي للنص كاملاً مع السعر 3500 دج';
const A=(ads)=>C.analyze(ads,NOW,L);
let P=A([row({ad_id:'1',title:'أ',body:'نص أول مختلف تماماً هنا',image_url:'https://cdn.x/i/one.jpg'}),row({ad_id:'2',title:'أ',body:'نص ثان مختلف تماماً هناك',image_url:'https://cdn.x/i/two.jpg'})]);
eq('نفس المتجر وصور مختلفة = منتجان مختلفان',P.length,2);
P=A([row({ad_id:'1',image_url:'https://cdn.x/i/one.jpg?sig=1'}),row({ad_id:'2',image_url:'https://cdn.x/i/one.jpg?sig=2'})]);
eq('نفس ملف الصورة = منتج واحد بنسختين',[P.length,P[0].copies,[...P[0].proofs.keys()]],[1,2,['نفس صورة الإعلان']]);
P=A([row({ad_id:'1',title:'جهاز يساعد على النوم',body:'نص أ مختلف'}),row({ad_id:'2',title:'جهاز يساعد على النوم',body:'نص ب مختلف'})]);
eq('نفس العنوان وحده لا يكفي',P.length,2);
P=A([row({ad_id:'1',video_url:'https://cdn.x/v/clip1.mp4'}),row({ad_id:'2',page_id:'p9',page_name:'آخر',video_url:'https://cdn.x/v/clip1.mp4'})]);
eq('نفس الفيديو عند بائعين = منتج واحد وبائعان',[P.length,P[0].n],[1,2]);
P=A([row({ad_id:'1',body:body('نص'),title:'x1'}),row({ad_id:'2',page_id:'p5',page_name:'ب',body:body('نص'),title:'x2'})]);
eq('نص حرفي طويل + سعر مطابق = نفس المنتج',P.length,1);
P=A([row({ad_id:'1',body:'نص طويل جداً '.repeat(10),title:'x1'}),row({ad_id:'2',page_id:'p5',body:'نص طويل جداً '.repeat(10),title:'x2'})]);
eq('نص حرفي بلا سعر لا يكفي',P.length,2);
P=A([row({ad_id:'1',link_url:'https://s.dz/products/snore-guard'}),row({ad_id:'2',page_id:'p7',link_url:'https://s.dz/products/snore-guard?utm=1'})]);
eq('نفس رابط صفحة المنتج',P.length,1);
P=A([row({ad_id:'1',link_url:'https://s.dz/shop'}),row({ad_id:'2',page_id:'p7',link_url:'https://s.dz/shop'})]);
eq('رابط عام (shop) لا يُعتمد',P.length,2);
const same=(x,y)=>{const ps=A([row({ad_id:'1',image_url:'https://cdn.example.com/i/s.jpg',...x}),row({ad_id:'2',image_url:'https://cdn.example.com/i/s.jpg',...y})]);return ps[0].n};
eq('نفس page_id = بائع واحد',same({page_id:'7'},{page_id:'7',page_name:'اسم آخر'}),1);
eq('page_id مختلف ونطاق متجر مختلف = بائعان',same({page_id:'7',link_url:'https://a.dz/p/aaaaa'},{page_id:'8',link_url:'https://b.dz/p/bbbbb'}),2);
eq('page_id مختلف ونفس نطاق المتجر = بائع واحد',same({page_id:'7',link_url:'https://a.dz/p/aaaaa'},{page_id:'8',link_url:'https://a.dz/p/zzzzz'}),1);
eq('wa.me لا يدمج بائعين',same({page_id:'7',link_url:'https://wa.me/1'},{page_id:'8',link_url:'https://wa.me/2'}),2);
const ben=(title,b)=>A([row({ad_id:'1',title,body:b})])[0];
eq('كلمة قوية في العنوان: فائدة متحققة',ben('يساعد طفلك على النوم','جهاز للأطفال').benOk,true);
eq('الوسم يصف الفائدة',ben('يساعد طفلك على النوم','جهاز للأطفال').tags[0].startsWith('يساعد طفلك على النوم'),true);
eq('كلمة ضعيفة فقط: غير متحققة',ben('جهاز يعطي','جهاز يعطي ويجعل ويقوم').benOk,false);
r=ben('منتج',('كلام '.repeat(40))+' يزيل البقع');eq('فائدة بعد أول 160 حرفاً: «فائدة في النص» (مستوى 1)',[r.benOk,r.ben],[true,1]);
eq('فائدة في العنوان: مستوى 2',ben('جهاز يزيل البقع','x').ben,2);
eq('كلمتان عاديتان مختلفتان: متحققة',ben('منتج ينظف ويجفف','x').benOk,true);
eq('كلمة عادية واحدة: غير متحققة',ben('منتج ينظف','x').benOk,false);
// ===== ترتيب التصنيفات: تجربة، جوهرة، رابح، قديم، (ضعيف)، مقصاة =====
const old=d=>new Date(NOW-d*D).toISOString();
P=A([row({ad_id:'e1',page_id:'z1',start_date:old(90),image_url:'https://c/i/o.jpg',title:'يساعد طفلك على النوم'}),
 row({ad_id:'e2',page_id:'z2',start_date:old(45),image_url:'https://c/i/f.jpg',title:'يساعد طفلك على النوم'}),
 row({ad_id:'e3',page_id:'z3',start_date:old(3),image_url:'https://c/i/t.jpg',title:'يساعد طفلك على النوم'}),
 row({ad_id:'e4',page_id:'z4',status:'Inactive',start_date:old(20),image_url:'https://c/i/x.jpg',title:'يساعد طفلك على النوم'}),
 row({ad_id:'e5',page_id:'z5',start_date:old(20),image_url:'https://c/i/g.jpg',title:'يساعد طفلك على النوم'})]);
eq('الترتيب: تجربة ثم جوهرة ثم رابح ثم قديم ثم مقصاة',P.map(p=>p.cat),['trial','gem','fire','old','excl']);
eq('لا فئة للمراقبة',P.some(p=>p.cat==='watch'),false);
// ===== كل نسخة في تصنيفها =====
P=A([row({ad_id:'c1',start_date:old(25),image_url:'https://cdn.example.com/i/same.jpg',title:'يساعد طفلك على النوم'}),row({ad_id:'c2',start_date:old(3),image_url:'https://cdn.example.com/i/same.jpg?x=1',title:'يساعد طفلك على النوم'})]);
eq('إعلان عمره 25 ونسخة عمرها 3: مدخلان جوهرة وتجربة',[P.length,P.map(p=>p.cat)],[2,['trial','gem']]);
eq('كل مدخل يرى تصنيف النسخ الأخرى',P.map(p=>p.also.join()).sort(),['gem','trial']);
eq('مفاتيح المدخلين مختلفة',new Set(P.map(p=>p.k)).size,2);
// ===== الصور والروابط والقديم =====
let n=C.normRow({ad_id:'1234567890123',images:'["https://cdn.example.com/a.jpg?x=1","https://cdn.example.com/b.jpg"]',video_hd_url:'https://cdn.example.com/v.mp4'});
eq('أول صورة من مصفوفة',n.image_url,'https://cdn.example.com/a.jpg?x=1');
eq('الفيديو من video_hd_url',n.video_url,'https://cdn.example.com/v.mp4');
eq('رابط الإعلان من المعرّف',n.library_url,'https://www.facebook.com/ads/library/?id=1234567890123');
P=A([row({ad_id:'o1',page_id:'o1',start_date:old(90),image_url:'https://cdn.example.com/i/old.jpg',title:'يساعد طفلك على النوم',body:'x'}),row({ad_id:'o2',page_id:'o1',start_date:old(80),image_url:'https://cdn.example.com/i/old.jpg?z=1',title:'يساعد طفلك على النوم',body:'x'})]);
eq('قديم: التصنيف بالمدة',P[0].cat,'old');
P=A([row({ad_id:'o3',start_date:old(90),image_url:'https://cdn.example.com/i/o3.jpg',title:'يساعد طفلك على النوم'}),row({ad_id:'o4',start_date:old(20),image_url:'https://cdn.example.com/i/o3.jpg?z=1',title:'يساعد طفلك على النوم'})]);
eq('قديم مع نسخة جوهرة: مدخلان، وكل مدخل يذكر الآخر',[P.map(p=>p.cat),P.find(p=>p.cat==='old').also],[['gem','old'],['gem']]);
n=C.normRow({ad_id:'5',snapshot_videos:'[{"video_preview_image_url":"https://s.fbcdn.net/p.jpg","video_hd_url":"https://video.fbcdn.net/a.mp4?x=1"}]'});
eq('فيديو من عمود متداخل (يتجاوز صورة المعاينة)',[n.video_url,n.image_url],['https://video.fbcdn.net/a.mp4?x=1','https://s.fbcdn.net/p.jpg']);
n=C.normRow({ad_id:'6',media:'https://cdn.example.com/x/clip.mp4',other:'https://cdn.example.com/x/pic.jpg'});
eq('فيديو وصورة من أعمدة بأسماء غير معروفة',[n.video_url,n.image_url],['https://cdn.example.com/x/clip.mp4','https://cdn.example.com/x/pic.jpg']);
// ===== النسخ والبائعون (معلومة فقط) =====
P=A([row({ad_id:'v1',page_id:'s1',title:'جهاز يزيل البقع',link_url:'https://shop.dz/products/stain-remover-pro',duplicates:'3',collation_id:'G1'}),row({ad_id:'v2',page_id:'s1',title:'جهاز يزيل البقع',link_url:'https://shop.dz/products/stain-remover-pro',duplicates:'3',collation_id:'G1'}),
 row({ad_id:'v3',page_id:'s2',title:'جهاز يزيل البقع',link_url:'https://shop.dz/products/stain-remover-pro',duplicates:'2',collation_id:'G2'}),row({ad_id:'v4',page_id:'s3',page_name:'متجر 3',title:'جهاز يزيل البقع',link_url:'https://shop.dz/products/stain-remover-pro'})]);
eq('النسخ: مجموعة ميتا تُعد مرة واحدة (3 + 2 + 1 = 6)، و3 صفحات بنفس المتجر = بائع واحد',[P.length,P[0].versions,P[0].n],[1,6,1]);
eq('البائعون بلا تكرار عبر المنتجات (صفحة + متجر)',C.sellerCount([{page_id:'1',link_url:'https://a.dz/x'},{page_id:'2',link_url:'https://a.dz/y'},{page_id:'3',link_url:'https://www.aliexpress.com/item/1.html'},{page_id:'4',link_url:'https://www.aliexpress.com/item/2.html'},{page_name:'متجر',link_url:''},{page_name:'متجر',link_url:''}].map(C.normRow)),4);
// ===== الإقصاء والتنبيهات والمتوقف =====
P=A([row({ad_id:'f1',page_id:'f1',title:'ثلاجة صغيرة للسيارة',body:'ثلاجة تبرد مشروباتك. السعر 15000 دج',image_url:'https://c/i/f1.jpg'})]);
eq('كبير الحجم/هش/أكل: تنبيه لا إقصاء',[P[0].cat!=='excl',/قد يكون/.test(P[0].warn||'')],[true,true]);
P=A([row({ad_id:'s1',page_id:'s1',status:'Inactive',start_date:old(40),end_date:old(15),title:'جهاز يزيل البقع',image_url:'https://c/i/s1.jpg'})]);
eq('توقف بعد 25 يوماً: «توقف بعد نجاح»',[P[0].cat,P[0].days],['ended',25]);
P=A([row({ad_id:'s2',page_id:'s2',status:'Inactive',start_date:old(10),end_date:old(7),title:'جهاز يزيل البقع',image_url:'https://c/i/s2.jpg'})]);
eq('توقف بعد 3 أيام: يُقصى',[P[0].cat,/بعد 3 أيام/.test(P[0].why.join(''))],['excl',true]);
P=A([row({ad_id:'s3',page_id:'s3',status:'Inactive',title:'جهاز يزيل البقع',image_url:'https://c/i/s3.jpg'})]);
eq('متوقف بلا تاريخ: يُقصى',P[0].cat,'excl');
P=A([row({ad_id:'g1',page_id:'g1',start_date:old(20),title:'ساعة يد أنيقة',body:'ساعة عادية',image_url:'https://c/i/g1.jpg'}),row({ad_id:'g2',page_id:'g2',start_date:old(12),title:'جهاز يقضي على الناموس',body:'x',image_url:'https://c/i/g2.jpg'})]);
eq('داخل التصنيف: ما فيه فائدة أولاً ولو كان أحدث',P.map(p=>p.name),['جهاز يقضي على الناموس','ساعة يد أنيقة']);
// ===== قاعدة العلامة الكبيرة: صفحة العلامة فقط، والأسواق وسم =====
const B=t=>row(Object.assign({title:'يساعد طفلك على النوم بسرعة',body:'مصباح نجوم يهدئ الطفل. السعر 3900 دج والدفع عند الاستلام',start_date:old(15)},t));
P=A([B({ad_id:'b1',page_id:'p1',page_name:'Dream Lights DZ',link_url:'https://www.aliexpress.com/item/100500123.html',image_url:'https://c/i/b1.jpg'})]);
eq('رابط AliExpress لا يُقصي: وسم فقط',[P[0].cat!=='excl',P[0].mktTag],[true,'AliExpress']);
P=A([B({ad_id:'b2',page_id:'p2',page_name:'Jumia Algérie',image_url:'https://c/i/b2.jpg'})]);
eq('صفحة Jumia (سوق) لم تعد «علامة»',P[0].why.some(w=>/العلامة/.test(w)),false);
P=A([B({ad_id:'b3',page_id:'p3',page_name:'Samsung Algérie',image_url:'https://c/i/b3.jpg'})]);
eq('صفحة Samsung الرسمية تُقصى',[P[0].cat,/Samsung|samsung/.test(P[0].why.join(' '))],['excl',true]);
P=A([B({ad_id:'b4',page_id:'p4',page_name:'شاومي الجزائر الرسمي',image_url:'https://c/i/b4.jpg'})]);
eq('صفحة «شاومي الجزائر الرسمي» تُقصى',P[0].cat,'excl');
P=A([B({ad_id:'b5',page_id:'p5',page_name:'Tech Store Oran',body:'غطاء حماية لهاتف Samsung يحمي من الكسر. السعر 1500 دج',image_url:'https://c/i/b5.jpg'})]);
eq('بائع يذكر Samsung في النص لا يُقصى',P[0].why.some(w=>/العلامة/.test(w)),false);
P=A([B({ad_id:'b6',page_id:'p6',page_name:'Best Deals',link_url:'https://www.philips.com/c-p/HX1234',image_url:'https://c/i/b6.jpg'})]);
eq('موقع العلامة نفسه (philips.com) يُقصى',P[0].cat,'excl');
// الواعد أولاً داخل «التجربة»
P=A([B({ad_id:'t1',page_id:'q1',start_date:old(2),image_url:'https://c/i/t1.jpg',title:'منتج أ يزيل البقع'}),
 B({ad_id:'t2',page_id:'q2',start_date:old(5),link_url:'https://hairshop.dz/products/hair-remover-pro',image_url:'https://c/i/t2.jpg',title:'منتج ب يزيل الشعر'}),B({ad_id:'t3',page_id:'q2',start_date:old(6),link_url:'https://hairshop.dz/products/hair-remover-pro',image_url:'https://c/i/t3.jpg',title:'منتج ب يزيل الشعر'})]);
eq('عمر 5-6 بنسختين وفائدة: واعد، وعمر 2: تحت التجربة، والترتيب تجربة ثم واعد',P.map(p=>p.cat),['trial','prom']);
// ===== الفائدة: فعل + مشكلة، والصيغ الاسمية =====
const bo=(t,b)=>ben(t,b||'x').benOk;
eq('«نساعدك في اختيار مقاسك» ليست فائدة',bo('نساعدك في اختيار مقاسك'),false);
eq('«يساعد في التوصيل» ليست فائدة',bo('فريقنا يساعد في التوصيل السريع'),false);
eq('«يساعد على النوم» فائدة',bo('مصباح يساعد طفلك على النوم'),true);
eq('«يحمي هاتفك من الكسر» فائدة',bo('غطاء يحمي هاتفك من الكسر'),true);
eq('«يحمي» وحده بلا مشكلة ليس فائدة',bo('غطاء يحمي هاتفك الجميل'),false);
eq('«مضاد للتعرق» فائدة',bo('كريم مضاد للتعرق'),true);
eq('«بدون ألم» فائدة',bo('آلة إزالة الشعر بدون ألم'),true);
eq('«وداعاً للبقع» فائدة',bo('بخاخ سحري وداعا للبقع'),true);
eq('«ينظف البقع» (فعل عادي + مشكلة) فائدة',bo('جهاز ينظف البقع من الكنبة'),true);
eq('«يقضي على الناموس» فائدة',bo('جهاز يقضي على الناموس'),true);
eq('«Say goodbye to back pain» فائدة',bo('Say goodbye to back pain'),true);
eq('«anti-ronflement» فائدة',bo('Clip anti ronflement'),true);
// ===== الإقصاء الخاطئ: «المرأة» ليست «مرآة» =====
P=A([B({ad_id:'m1',page_id:'pm',page_name:'Dz Style',title:'قشابية جزائرية أصيلة',body:'لباس المرأة الجزائرية التقليدي، قماش دافئ يحمي من البرد. السعر 6500 دج التوصيل لكل الولايات',image_url:'https://c/i/m1.jpg'})]);
eq('قشابية فيها «المرأة» لا تُقصى كمرآة',[P[0].cat!=='excl',P[0].why.join(' ')],[true,'']);
P=A([B({ad_id:'m2',page_id:'pm2',page_name:'Deco Home',title:'مرآة حائط كبيرة',body:'مرآة جدارية كبيرة بإطار ذهبي للصالون. السعر 9000 دج',image_url:'https://c/i/m2.jpg'})]);
eq('مرآة حائط حقيقية: تنبيه «قد يكون هشاً» بلا إقصاء',[P[0].cat!=='excl',/قد يكون هش.*مرآة حائط/.test(P[0].warn||'')],[true,true]);
P=A([row(Object.assign({ad_id:'c1',page_id:'pc1',image_url:'https://c/i/c1.jpg'},{page_name:'Hair Pro',title:'تكوين في الحلاقة سجل الآن',body:'تكوين في الحلاقة سجل الآن. السعر 9000 دج',start_date:old(15)}))]);
eq('تكوين/دورة: يُقصى مع الجملة والكلمة',[P[0].cat,/في النص: …«تكوين»/.test(P[0].why.join(' ')),P[0].fix&&P[0].fix.terms.includes('تكوين')],['excl',true,true]);
P=C.analyze([row(Object.assign({ad_id:'c2',page_id:'pc2',image_url:'https://c/i/c2.jpg'},{page_name:'Hair Pro',title:'تكوين في الحلاقة سجل الآن',body:'تكوين في الحلاقة سجل الآن. السعر 9000 دج',start_date:old(15)}))],NOW,Object.assign({},L,{ignore:new Set(P[0].fix.terms)}));
eq('بعد «سبب خاطئ» لا يُقصى بنفس الكلمات',P[0].cat!=='excl',true);
P=C.analyze([row(Object.assign({ad_id:'c3',page_id:'777',image_url:'https://c/i/c3.jpg'},{page_name:'Hair Pro',title:'تكوين في الحلاقة سجل الآن',body:'تكوين في الحلاقة سجل الآن. السعر 9000 دج',start_date:old(15)}))],NOW,Object.assign({},L,{allowPages:new Set(['777'])}));
eq('صفحة مسموح بها لا تُقصى',P[0].cat!=='excl',true);
console.log(fail?`\n${fail} FAILED`:'\nALL PASSED');process.exit(fail?1:0)
