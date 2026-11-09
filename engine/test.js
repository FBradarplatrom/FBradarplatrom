const fs=require('fs');
eval(fs.readFileSync('dicts.js','utf8').replace('const DEF','global.DEF'));
const C=require('./core.js'),D=864e5,NOW=Date.UTC(2026,9,20),L=C.buildLists(DEF);
let fail=0;const eq=(n,a,b)=>{const ok=JSON.stringify(a)===JSON.stringify(b);if(!ok)fail++;console.log(ok?'ok  ':'FAIL',n,ok?'':`got ${JSON.stringify(a)} want ${JSON.stringify(b)}`)};
const mk=d=>({start:d==null?null:new Date(NOW-d*D),stat:'active'}),S=(d,P)=>C._t.scoreAd(mk(d),P,NOW);
// ===== الدرجات (الأوزان 37/26/19/13/5) والتصنيف بالمدة =====
const ALL={copies:2,n:2,benOk:true,simOk:true};
let r=S(20,ALL);eq('عمر20 كل الأدلة = 100 💎',[r.score,r.cat],[100,'gem']);
r=S(45,{copies:1,n:5,benOk:true,simOk:true});eq('عمر45: 31.45+26+5=62 🔥 رابح',[r.score,r.cat],[62,'fire']);
r=S(45,ALL);eq('عمر45 بكل الأدلة: رابح وليس جوهرة (المدة تحدد)',[r.score,r.cat],[94,'fire']);
r=S(70,{copies:1,n:1,benOk:true,simOk:false});eq('عمر70: 29.6+26+19=75 قديم في السوق',[r.score,r.cat],[75,'old']);
r=S(100,ALL);eq('عمر100 بكل الأدلة: قديم وليس جوهرة',[r.score,r.cat],[93,'old']);
eq('أوزان المجموع 100',S(20,ALL).ev.reduce((s,e)=>s+e.w,0),100);
eq('عمر8 مدة كاملة جولد',[S(8,ALL).ev[0].pct,S(8,ALL).ev[0].tag,S(8,ALL).cat],[1,'مدة جولد','gem']);
eq('عمر30 جولد جوهرة، عمر31 85% رابح',[S(30,ALL).ev[0].pct,S(30,ALL).cat,S(31,ALL).ev[0].pct,S(31,ALL).cat],[1,'gem',.85,'fire']);
eq('عمر60 85% رابح، عمر61 80% قديم',[S(60,ALL).ev[0].pct,S(60,ALL).cat,S(61,ALL).ev[0].pct,S(61,ALL).cat],[.85,'fire',.8,'old']);
r=S(7,ALL);eq('عمر7: تحت التجربة وبلا مدة',[r.cat,r.ev[0].pct,r.promising],['trial',0,true]);
eq('عمر0: تحت التجربة',S(0,ALL).cat,'trial');
eq('تحت التجربة تبقى تجربة حتى بدرجة منخفضة',S(5,{copies:1,n:9,benOk:false,simOk:false}).cat,'trial');
eq('عمر4 مع نسخ: واعد',S(4,ALL).promising,true);
eq('عمر3 مع نسخ: ليس واعداً',S(3,ALL).promising,false);
eq('عمر5 بلا نسخ: ليس واعداً',S(5,{...ALL,copies:1}).promising,false);
r=S(20,{copies:1,n:9,benOk:false,simOk:false});eq('مدة جولد وحدها (37) لا تكفي: ضعيف',[r.score,r.cat],[37,'low']);
r=S(20,{copies:1,n:2,benOk:false,simOk:false});eq('جولد + بائعون قلة بلا فائدة (56): رابح محتمل',[r.score,r.cat,r.miss],[56,'maybe',['الفائدة']]);
r=S(20,{copies:2,n:9,benOk:false,simOk:false});eq('جولد + نسخ بلا فائدة (50): رابح محتمل',[r.score,r.cat],[50,'maybe']);
r=S(20,{copies:1,n:9,benOk:true,simOk:true});eq('فائدة بلا قلة بائعين ولا نسخ (68): رابح محتمل',[r.score,r.cat,r.miss],[68,'maybe',['قلة البائعين أو تعدد النسخ']]);
r=S(20,{copies:2,n:9,benOk:true,simOk:false});eq('فائدة + نسخ (76): جوهرة',[r.score,r.cat],[76,'gem']);
r=S(20,{copies:1,n:2,benOk:true,simOk:false});eq('فائدة + قلة بائعين (82): جوهرة',[r.score,r.cat],[82,'gem']);
r=S(100,{copies:1,n:2,benOk:false,simOk:false});eq('قديم + بائعون فقط (48.6): ضعيف',[r.score,r.cat],[49,'low']);
r=S(null,ALL);eq('بلا تاريخ: مدة صفر وضعيف',[r.ev[0].pct,r.score,r.cat,r.note],[0,63,'low','بلا تاريخ']);
eq('اتجاه السوق بلا درجة',S(20,{...ALL,trend:'rising'}).ev.find(e=>e.k==='trd').pts,0);
eq('درجات الأدلة ثنائية (لا جزئية)',[...new Set(S(20,{copies:5,n:9,benOk:true,simOk:false}).ev.slice(1,5).map(e=>e.pct))].sort(),[0,1]);
eq('وسم الفائدة يظهر في جدول الأدلة',S(20,{...ALL,tags:['يساعد طفلك على النوم']}).ev[1].tag,'يساعد طفلك على النوم');
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
eq('قوية بعد أول 160 حرفاً: غير متحققة',ben('منتج',('كلام '.repeat(40))+' يزيل البقع').benOk,false);
eq('كلمتان عاديتان مختلفتان: متحققة',ben('منتج ينظف ويجفف','x').benOk,true);
eq('كلمة عادية واحدة: غير متحققة',ben('منتج ينظف','x').benOk,false);
// ===== ترتيب التصنيفات: تجربة، جوهرة، رابح، قديم، (ضعيف)، مقصاة =====
const old=d=>new Date(NOW-d*D).toISOString();
P=A([row({ad_id:'e1',page_id:'z1',start_date:old(90),image_url:'https://c/i/o.jpg',title:'يساعد طفلك على النوم'}),
 row({ad_id:'e2',page_id:'z2',start_date:old(45),image_url:'https://c/i/f.jpg',title:'يساعد طفلك على النوم'}),
 row({ad_id:'e3',page_id:'z3',start_date:old(3),image_url:'https://c/i/t.jpg',title:'يساعد طفلك على النوم'}),
 row({ad_id:'e4',page_id:'z4',status:'Inactive',start_date:old(20),image_url:'https://c/i/x.jpg',title:'يساعد طفلك على النوم'}),
 row({ad_id:'e5',page_id:'z5',start_date:old(20),image_url:'https://c/i/g.jpg',title:'يساعد طفلك على النوم'})]);
eq('الترتيب: جوهرة ثم رابح ثم تجربة ثم قديم ثم مقصاة',P.map(p=>p.cat),['gem','fire','trial','old','excl']);
eq('لا فئة للمراقبة',P.some(p=>p.cat==='watch'),false);
// ===== كل نسخة في تصنيفها =====
P=A([row({ad_id:'c1',start_date:old(25),image_url:'https://cdn.example.com/i/same.jpg',title:'يساعد طفلك على النوم'}),row({ad_id:'c2',start_date:old(3),image_url:'https://cdn.example.com/i/same.jpg?x=1',title:'يساعد طفلك على النوم'})]);
eq('إعلان عمره 25 ونسخة عمرها 3: مدخلان جوهرة وتجربة',[P.length,P.map(p=>p.cat)],[2,['gem','trial']]);
eq('كل مدخل يرى تصنيف النسخ الأخرى',P.map(p=>p.also.join()).sort(),['gem','trial']);
eq('مفاتيح المدخلين مختلفة',new Set(P.map(p=>p.k)).size,2);
// ===== الصور والروابط والقديم =====
let n=C.normRow({ad_id:'1234567890123',images:'["https://cdn.example.com/a.jpg?x=1","https://cdn.example.com/b.jpg"]',video_hd_url:'https://cdn.example.com/v.mp4'});
eq('أول صورة من مصفوفة',n.image_url,'https://cdn.example.com/a.jpg?x=1');
eq('الفيديو من video_hd_url',n.video_url,'https://cdn.example.com/v.mp4');
eq('رابط الإعلان من المعرّف',n.library_url,'https://www.facebook.com/ads/library/?id=1234567890123');
eq('اتجاه السوق يحمل قيمته ولا درجة',[S(20,{...ALL,trend:'rising'}).ev.find(e=>e.k==='trd').val,S(20,{...ALL,trend:'rising'}).ev.find(e=>e.k==='trd').pts],['rising',0]);
P=A([row({ad_id:'o1',page_id:'o1',start_date:old(90),image_url:'https://cdn.example.com/i/old.jpg',title:'يساعد طفلك على النوم',body:'x'}),row({ad_id:'o2',page_id:'o1',start_date:old(80),image_url:'https://cdn.example.com/i/old.jpg?z=1',title:'يساعد طفلك على النوم',body:'x'})]);
eq('قديم يستوفي المعايير: بيان واضح',[P[0].cat,P[0].oldInfo&&P[0].oldInfo.all],['old',true]);
P=A([row({ad_id:'o3',start_date:old(90),image_url:'https://cdn.example.com/i/o3.jpg',title:'يساعد طفلك على النوم'}),row({ad_id:'o4',start_date:old(20),image_url:'https://cdn.example.com/i/o3.jpg?z=1',title:'يساعد طفلك على النوم'})]);
eq('قديم مع نسخة جوهرة: يُذكر',[P.map(p=>p.cat),P.find(p=>p.cat==='old').oldInfo.up],[['gem','old'],['gem']]);
n=C.normRow({ad_id:'5',snapshot_videos:'[{"video_preview_image_url":"https://s.fbcdn.net/p.jpg","video_hd_url":"https://video.fbcdn.net/a.mp4?x=1"}]'});
eq('فيديو من عمود متداخل (يتجاوز صورة المعاينة)',[n.video_url,n.image_url],['https://video.fbcdn.net/a.mp4?x=1','https://s.fbcdn.net/p.jpg']);
n=C.normRow({ad_id:'6',media:'https://cdn.example.com/x/clip.mp4',other:'https://cdn.example.com/x/pic.jpg'});
eq('فيديو وصورة من أعمدة بأسماء غير معروفة',[n.video_url,n.image_url],['https://cdn.example.com/x/clip.mp4','https://cdn.example.com/x/pic.jpg']);
// ===== المشابهة والإقصاء والاتجاه =====
P=A([row({ad_id:'1',image_url:'https://c/i/a.jpg',title:'جهاز يمنع الشخير',body:'x'}),row({ad_id:'2',page_id:'q',image_url:'https://c/i/b.jpg',title:'مشبك يوقف الشخير',body:'y'}),row({ad_id:'3',page_id:'r',image_url:'https://c/i/c.jpg',title:'ساعة',body:'ساعة عادية'})]);
const a=P.find(p=>p.name.includes('يمنع'));eq('منتجان مختلفان لنفس الوظيفة = مشابه 1',[a.sim,a.simOk],[1,true]);
eq('بلا فائدة معروفة: المشابهة غير متحققة',P.find(p=>p.name==='ساعة').simOk,false);
P=A([row({ad_id:'1',title:'ثلاجة صغيرة'}),row({ad_id:'2',page_id:'j',page_name:'Jumia',image_url:'https://c/i/j.jpg'}),row({ad_id:'3',page_id:'s',status:'Inactive',image_url:'https://cdn.example.com/i/s.jpg'})]);
eq('الإقصاء: كبير الحجم/علامة/متوقف',P.map(p=>p.cat).sort(),['excl','excl','excl']);
eq('اتجاه السوق وسم لا يحذف',P.length,3);
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
eq('داخل التجربة: الواعد أولاً',P.filter(p=>p.cat==='trial').map(p=>p.promising),[true,false]);
console.log(fail?`\n${fail} FAILED`:'\nALL PASSED');process.exit(fail?1:0)
