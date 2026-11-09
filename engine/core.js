const CORE=(function(){
'use strict';
const D=864e5,NF=Math.round;
/* فحص صلاحية المنتج (خدمة؟ دورة؟ محل؟ أكل؟ ...) بلغة السوق: adlib/lib/productcheck.js، نفس الملف في الخادم والمتصفح */
const PCK=(typeof globalThis!=='undefined'&&globalThis.RadarProductCheck)||(typeof require==='function'?(()=>{try{return require('../adlib/lib/productcheck.js')}catch(e){return null}})():null);
const CJK=/[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\u0e00-\u0e7f\uac00-\ud7af]/;
/* الأسواق (عملة، حد البائعين، المواسم) ومقارنة روابط المورّد: نفس الملفات في الخادم والمتصفح */
const MKT=(typeof globalThis!=='undefined'&&globalThis.RadarMarkets)||(typeof require==='function'?(()=>{try{return require('../adlib/lib/markets.js')}catch(e){return null}})():null);
const GM=(typeof globalThis!=='undefined'&&globalThis.RadarGapMatch)||(typeof require==='function'?(()=>{try{return require('../adlib/lib/gapmatch.js')}catch(e){return null}})():null);
/* ---------- التطبيع: عربية + فرنسية + أرابيزي ---------- */
function N(s){
 s=String(s==null?'':s).replace(/[\u00C0-\u024F]+/g,c=>c.normalize('NFD').replace(/[\u0300-\u036f]/g,''))
  .replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').toLowerCase();
 return s.replace(/[a-z][a-z0-9]*|[0-9]+[a-z][a-z0-9]*/g,t=>{
  if(/\d/.test(t))t=t.replace(/[23579]/g,d=>({2:'ء',3:'ع',5:'خ',7:'ح',9:'ق'}[d]));
  return t.replace(/([a-z])\1+/g,'$1')})}
/* ---------- القوائم: مطابقة كلمة مستقلة مكتملة ---------- */
const PRE='(?:[وفبلك]?(?:ال)?)';
function compile(entry){
 const alts=String(entry).split('/').map(x=>N(x).trim()).filter(Boolean);if(!alts.length)return null;
 const body=alts.map(t=>{let r=t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/[\s\-]+/g,'[\\s\\-]+');if(/[a-z]$/.test(t))r+='[sx]?';return r}).join('|');
 const cjk=alts.some(t=>CJK.test(t)),re=cjk?new RegExp('(?:'+body+')','gu'):new RegExp('(?<![\\p{L}\\p{M}\\p{N}])'+PRE+'(?:'+body+')(?![\\p{L}\\p{M}\\p{N}])','gu');   // الصينية والتايلاندية بلا مسافات
 re._body=body;re._cjk=cjk;re._len=Math.max(...alts.map(t=>t.length));return re}
function parseList(txt,w){const out=[],seen=new Set();String(txt||'').split(/[,،\n]+/).map(s=>s.trim()).filter(Boolean).forEach(e=>{if(seen.has(e))return;seen.add(e);const re=compile(e);if(re)out.push({id:w+':'+e,label:e.split('/')[0],w,re})});return out}
function buildLists(t){const gold=parseList(t.strong,3).concat(parseList(t.normal,1),parseList(t.weak,.3));return{gold,goldB:gold.filter(e=>e.w>=1),brands:parseList(t.brands,1).filter(e=>!MKSET.has(N(e.label).trim())),ignore:new Set((t.ignore||[]).map(String)),allowPages:new Set((t.allowPages||[]).map(String))}}
/* الأداء: كل قائمة تُدمج في تعبير واحد (مجموعة لكل مدخل، الأطول أولاً) فيُقرأ النص مرة واحدة بدل مرة لكل كلمة */
function mxOf(list){if(list._mx)return list._mx;const mk=(arr,bound)=>{if(!arr.length)return null;const ord=arr.slice().sort((a,b)=>b.re._len-a.re._len),src=ord.map(e=>'('+e.re._body+')').join('|');
  return{re:new RegExp(bound?'(?<![\\p{L}\\p{M}\\p{N}])'+PRE+'(?:'+src+')(?![\\p{L}\\p{M}\\p{N}])':'(?:'+src+')','gu'),ord}};
 return Object.defineProperty(list,'_mx',{value:[mk(list.filter(e=>!e.re._cjk),1),mk(list.filter(e=>e.re._cjk),0)].filter(Boolean)})._mx}
function findAll(txt,list){const ms=[];for(const {re,ord} of mxOf(list)){re.lastIndex=0;let m;while((m=re.exec(txt))){let i=1;while(m[i]===undefined&&i<m.length)i++;if(i<m.length)ms.push({e:ord[i-1],s:m.index,t:m.index+m[0].length});if(!m[0].length)re.lastIndex++}}
 ms.sort((a,b)=>(b.t-b.s)-(a.t-a.s));const kept=[];ms.forEach(x=>{if(!kept.some(k=>x.s>=k.s&&x.t<=k.t))kept.push(x)});return kept}
/* ---------- الأعمدة ---------- */
const ALIAS={collation_id:['collation_id','collationid'],end_date:['end_date','ad_delivery_stop_time','stop_date'],ad_id:['ad_id','id','adid','ad_archive_id'],library_url:['library_url','ad_url','ad_library_url','snapshot_url','permalink'],page_id:['page_id','pageid'],page_name:['page_name','advertiser','page','pagename'],status:['status'],start_date:['start_date','start','startdate'],duplicates:['duplicates','collation_count','variants'],format:['format','media_type'],domain:['domain'],link_url:['link_url','url','link','landing_url'],title:['title','headline'],body:['body','text','ad_text','primary_text'],link_description:['link_description'],image_url:['image_url','image','images','image_urls','original_image_url','resized_image_url','picture','picture_url','thumbnail','thumbnail_url','cover','cover_url','preview_image_url','video_preview_image_url','video_preview_image','poster','media_url'],video_url:['video_url','video','videos','video_urls','video_hd_url','video_sd_url','video_link'],search:['search','keyword'],keywords:['keywords','tags'],product_name:['product_name','product'],store_name:['store_name','shop','store'],image_hash:['image_hash','image_id'],video_hash:['video_hash','video_id'],creative_id:['creative_id','media_id'],collected:['collected_at','scraped_at','collection_date','date_collected','fetched_at'],cta:['cta','cta_text'],cta_type:['cta_type'],cta_group:['cta_group'],page_categories:['page_categories','categories','page_category'],country:['country','market']};
const firstUrl=v=>{if(v==null||v==='')return'';if(typeof v==='object')try{v=JSON.stringify(v)}catch(e){return''}const m=/https?:\/\/[^\s"'\\\[\]<>,}]+/i.exec(String(v));return m?m[0]:''};
const allUrls=v=>{if(v==null||v==='')return[];if(typeof v==='object')try{v=JSON.stringify(v)}catch(e){return[]}return String(v).match(/https?:\/\/[^\s"'\\\[\]<>,}]+/gi)||[]};
const VID=/\.(mp4|webm|mov|m4v|m3u8)(\?|$)/i,IMG=/\.(jpe?g|png|webp|gif)(\?|$)/i,SKIPK=/^(body|text|ad_text|primary_text|title|headline|link_description|link_url|url|link|landing_url|library_url|ad_url|ad_library_url|permalink|snapshot_url|domain)$/;
function findMedia(lo,kind){const vid=kind==='video',kre=vid?/video|mp4|reel|clip/:/image|img|picture|photo|thumb|cover|poster|preview/;
 const good=u=>vid?(VID.test(u)||/video/i.test(u)):(!VID.test(u)&&IMG.test(u));
 for(const k in lo){if(!kre.test(k)||(vid&&/preview|thumb|image|poster|hash|duration|count|length/.test(k)))continue;const us=allUrls(lo[k]),u=us.find(good)||(!vid?us.find(x=>!VID.test(x)):'');if(u)return u}
 for(const k in lo){if(SKIPK.test(k))continue;const u=allUrls(lo[k]).find(good);if(u)return u}return''}
const toDate=v=>{if(!v)return null;const d=v instanceof Date?v:new Date(v);return isNaN(d)?null:d};
function stat(s){s=String(s||'').trim().toLowerCase();if(!s)return'none';
 if(/inactive|غير نشط|متوقف|stopped|paused|ended|منتهي|انتهى|expired/.test(s))return'stopped';
 if(/active|نشط|running|جاري|ساري/.test(s))return'active';return'none'}
/* أنصاف حروف (إيموجي مقطوع) تُحذف: تُسقط الترميز والروابط */
const WF=s=>String(s).replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,''),cut=(s,n)=>WF(String(s).slice(0,n));
function normRow(r){const lo={};for(const k in r)lo[String(k).toLowerCase().trim()]=r[k];const o={};
 for(const f in ALIAS)for(const a of ALIAS[f]){const v=lo[a];if(v!==undefined&&v!==null&&v!==''){o[f]=v;break}}
 ['image_url','video_url','library_url'].forEach(k=>o[k]=firstUrl(o[k]));
 if(!o.video_url)o.video_url=findMedia(lo,'video');
 if(!o.image_url)o.image_url=findMedia(lo,'image');
 if(!o.library_url&&/^\d{8,}$/.test(String(o.ad_id||'').trim()))o.library_url='https://www.facebook.com/ads/library/?id='+String(o.ad_id).trim();
 o.start=toDate(o.start_date);o.end=toDate(o.end_date);o.collected=toDate(o.collected);o.stat=stat(o.status);o.format=String(o.format||'').toUpperCase();
 ['collation_id','title','body','link_description','link_url','page_name','image_url','video_url','library_url','product_name','store_name','keywords','search','duplicates','image_hash','video_hash','creative_id','cta','cta_type','cta_group','page_categories','country'].forEach(k=>o[k]=o[k]!=null?WF(o[k]):'');
 if(!o.domain&&o.link_url)try{o.domain=new URL(o.link_url).hostname}catch(e){}
 return o}
const SOC=/^(facebook|fb|instagram|whatsapp|m|l\.facebook)\.(com|me)$|^(wa|fb)\.me$/;
const hostOf=a=>{try{return new URL(a.link_url).hostname.replace(/^www\./,'').toLowerCase()}catch(e){return String(a.domain||'').replace(/^www\./,'').toLowerCase()}};
const urlKey=u=>{try{const x=new URL(u);return(x.hostname+x.pathname).toLowerCase()}catch(e){return''}};
function price(t){t=t.replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));let m=t.match(/(\d[\d\s.,]{0,7})\s*(?:دج|د\.ج|دينار|DA\b|DZD)/i);
 if(m){const v=parseFloat(m[1].replace(/[\s,]/g,'').replace(/\.(?=\d{3}$)/,''));if(v)return NF(v)}
 m=t.match(/(\d[\d.,]{0,5})\s*(?:ألف|الف)/);if(m){const v=parseFloat(m[1].replace(',','.'));if(v)return NF(v*10)}
 /* عملات الأسواق الأخرى: السعر قبل الرمز أو بعده */
 const num=x=>{x=String(x).replace(/\s/g,'').replace(/[.,](\d{1,2})$/,'');return parseFloat(x.replace(/[.,]/g,''))||null};
 m=t.match(/(?:€|\$|£|₹|₱|₫|฿|₺|¥|R\$|NT\$|\b(?:rs|rp|php|rm|usd|eur|gbp|inr|pkr|idr|myr|thb|sar|aed|mad|egp|tl)\.?)\s?(\d[\d.,\s]{0,9}\d|\d)/i);
 if(m){const v=num(m[1]);if(v)return NF(v)}
 m=t.match(/(\d[\d.,\s]{0,9}\d|\d)\s?(?:€|\$|£|₹|₱|₫|đ|vnđ|vnd|฿|บาท|baht|元|₺|tl\b|eur\b|euros?\b|usd\b|dollars?\b|rupees?\b|pesos?\b|ريال|درهم|جنيه|روپے)/i);
 if(m){const v=num(m[1]);if(v)return NF(v)}
 return null}
const med=a=>{if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);return s[s.length>>1]};
const age=(a,NOW)=>a.start?Math.max(0,Math.floor((NOW-a.start)/D)):null;
/* ---------- هوية المنتج: أدلة قاطعة فقط (لا يكفي اسم المتجر ولا تشابه العنوان) ---------- */
const GEN=new Set('collections collection shop store products product catalog cart checkout home index index.html all item items p pages page lp order commande'.split(' '));
function plinkKey(u){try{const x=new URL(u),segs=x.pathname.split('/').filter(Boolean);if(!segs.length)return'';
 const ali=/\/item\/(\d{8,})/.exec(x.pathname);if(ali&&/aliexpress/.test(x.hostname))return'ali:'+ali[1];
 const last=segs[segs.length-1].toLowerCase();if(last.length<5||GEN.has(last))return'';
 return x.hostname.replace(/^www\./,'').toLowerCase()+'/'+segs.join('/').toLowerCase()}catch(e){return''}}
const PROOF={sup:'نفس رابط المورّد (AliExpress/Temu/Amazon…)',vh:'نفس الصورة بالبصمة البصرية',img:'نفس صورة الإعلان',vid:'نفس الفيديو',hash:'نفس معرّف الوسائط',plink:'نفس رابط صفحة المنتج',name:'نفس اسم المنتج',txt:'نص مطابق حرفياً وبسعر مطابق'};
function keysOf(a){const K=[],gm=(typeof globalThis!=='undefined'&&globalThis.RadarGapMatch)||GM;if(gm&&a.link_url)gm.supplierIds([a.link_url]).forEach(x=>K.push(['sup',x]));if(a._vh)K.push(['vh',a._vh]);let k=urlKey(a.image_url);if(k.length>12)K.push(['img',k]);k=urlKey(a.video_url);if(k.length>12)K.push(['vid',k]);
 [a.image_hash,a.video_hash,a.creative_id].forEach(v=>{if(v&&String(v).length>=6)K.push(['hash',String(v)])});
 k=plinkKey(a.link_url);if(k)K.push(['plink',k]);
 k=N(a.product_name).trim();if(k.length>=3)K.push(['name',k]);
 const b=N(a.body).replace(/[^\u0621-\u064Aa-z0-9]/g,'');a._p=a._p??price(a.title+' '+a.body);
 if(b.length>=80&&a._p)K.push(['txt',b.slice(0,400)+'|'+a._p]);return K}
function groupAds(ads){const p=ads.map((_,i)=>i),f=i=>{while(p[i]!==i){p[i]=p[p[i]];i=p[i]}return i},B=new Map();
 ads.forEach((a,i)=>keysOf(a).forEach(([t,k])=>{const key=t+'|'+k;let b=B.get(key);if(!b)B.set(key,b=[]);b.push(i)}));
 B.forEach(b=>{for(let i=1;i<b.length;i++)if(f(b[i])!==f(b[0]))p[f(b[i])]=f(b[0])});
 const g={};ads.forEach((a,i)=>{const r=f(i);(g[r]=g[r]||{ads:[],proofs:new Map()}).ads.push(a)});
 B.forEach((b,key)=>{if(b.length<2)return;const t=key.slice(0,key.indexOf('|')),G=g[f(b[0])],l=PROOF[t];G.proofs.set(l,Math.max(G.proofs.get(l)||0,b.length))});
 return Object.values(g)}
/* ---------- البائعون: هوية دقيقة ---------- */
const MARKET=/(^|\.)(aliexpress|alibaba|amazon|temu|jumia|ouedkniss|linktr\.ee|bit\.ly|tinyurl|t\.me)(\.|$)/;
function sameSeller(a,b){
 if(a.page_id&&b.page_id){if(String(a.page_id)===String(b.page_id))return true}
 else{const x=N(a.page_name).trim();if(x&&x===N(b.page_name).trim())return true}
 const s=N(a.store_name).trim();if(s&&s===N(b.store_name).trim())return true;
 const h=hostOf(a);return!!h&&h===hostOf(b)&&!SOC.test(h)&&!MARKET.test(h)}
function sellerCount(ads){const p=new Map(),f=k=>{while(p.get(k)!==k){p.set(k,p.get(p.get(k)));k=p.get(k)}return k},add=k=>{if(!p.has(k))p.set(k,k)};
 ads.forEach(a=>{const ks=[];if(a.page_id)ks.push('p:'+a.page_id);else{const x=N(a.page_name).trim();if(x)ks.push('n:'+x)}const s=N(a.store_name).trim();if(s)ks.push('s:'+s);const h=hostOf(a);if(h&&!SOC.test(h)&&!MARKET.test(h))ks.push('h:'+h);
  ks.forEach(add);for(let i=1;i<ks.length;i++){const x=f(ks[0]),y=f(ks[i]);if(x!==y)p.set(y,x)}});
 return new Set([...p.keys()].map(f)).size}
function clusterSellers(ads){const p=ads.map((_,i)=>i),f=i=>{while(p[i]!==i){p[i]=p[p[i]];i=p[i]}return i};
 for(let i=0;i<ads.length;i++)for(let j=i+1;j<ads.length;j++)if(f(i)!==f(j)&&sameSeller(ads[i],ads[j]))p[f(i)]=f(j);
 ads.forEach((a,i)=>a._s=f(i))}
/* ---------- الفائدة ---------- */
const STOPT=new Set('مشكله مشاكل شيء هذا هاذا هذه هاذي الذي التي مع بدون كل كلما اكثر اقل جدا فقط نهائيا بعد قبل عند الي علي منه عنه لديك عندك الان اليوم كثير'.split(' '));
const cache=new Map();
function snippet(hr,hn,m){const raw=hr.split(/\s+/).filter(Boolean),pre=hn.slice(0,m.s).trim(),wi=pre?pre.split(/\s+/).length:0;
 let t=raw.slice(wi,wi+7).join(' ');const c=t.search(/[.!؟?،,;:\n]/);if(c>=4)t=t.slice(0,c);
 return t.replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu,'').replace(/[.!؟?،,;:\s]+$/,'').trim()}
/* الفائدة = فعل ذهبي يتبعه (خلال 4 كلمات) مشكلة أو نتيجة، أو صيغة اسمية: مضاد/ضد/بدون/وداعاً + مشكلة.
   الأفعال العامة (يساعد، يحمي، يوفر…) لا تُحتسب إلا مع مشكلة. وفعل يتبعه مباشرة «التوصيل/الطلب/المقاس…» ليس فائدة. */
const NS=t=>t.split(/\s*,\s*/).map(x=>N(x).trim()).filter(Boolean);
const GENERIC=new Set(NS('يساعد, يساعد على, يحمي, يحمي من, يوفر, يوفر عليك, يسهل, يحسن, يعطي, يجعل, يقوم, helps, help, aide, aider, protects, protect, protège, makes'));
const SERVICE=new Set(NS('توصيل, التوصيل, طلب, الطلب, طلبك, طلبيتك, اختيار, الاختيار, مقاس, مقاسك, المقاس, الدفع, دفع, الشحن, شحن, الحجز, حجز, التسجيل, تسجيل, الاتصال, التواصل, زبائننا, livraison, commande, taille, paiement, delivery, order, shipping, size, checkout, payment, choisir, choose'));
const PROB=new Set(NS(`ألم, آلام, الام, وجع, أوجاع, اوجاع, شخير, بقع, بقعة, رطوبة, عرق, تعرق, رائحة, روائح, ريحة, تساقط, قشرة, حبوب, حب الشباب, تجاعيد, هالات, ناموس, بعوض, حشرات, صراصير, فئران, ذباب, نمل, قمل, غبار, أوساخ, وسخ, صدأ, دهون, كرش, وزن, سمنة, ترهل, إمساك, انتفاخ, أرق, نوم, تعب, إرهاق, شعر, شيب, صلع, كلف, تشققات, شقوق, جفاف, برد, حرارة, سخانة, تسرب, انسداد, فوضى, وقت, مال, مصاريف, كسر, خدوش, حروق, ضياع, سرقة, قلق, توتر, صداع, دوخة, حساسية, التهاب, سيلوليت, اصفرار, ضجيج, إزعاج, ضوضاء, جراثيم, بكتيريا, ميكروبات, فيروسات, تلوث, كلس, جير, دخان, حوادث, خطر, انزلاق, تشابك, راحة, نظافة, لمعان, نعومة, ترتيب, تنظيم, أمان,
 douleur, douleurs, maux, ronflement, tache, taches, humidité, transpiration, sueur, odeur, odeurs, chute, pellicules, acné, rides, moustiques, moustique, insectes, cafards, poussière, saleté, rouille, graisse, ventre, poids, insomnie, sommeil, fatigue, poils, fuite, fuites, bouchon, désordre, temps, argent, rayures, stress, migraine, cellulite, calcaire, bactéries, germes, froid, chaleur, bruit,
 pain, aches, snoring, stain, stains, moisture, sweat, sweating, odor, odour, smell, odors, hair, dandruff, acne, wrinkles, mosquito, mosquitoes, bugs, insects, pests, roaches, mice, dust, dirt, rust, fat, belly, weight, insomnia, sleep, fatigue, leak, leaks, clog, clogs, mess, time, money, scratches, stress, headache, cellulite, limescale, germs, bacteria, cold, heat, noise, back, neck, knee, joints, lawj3, rri7a, nemous, lkerch`));
const PSTEM=NS('تساقط, تجاعيد, حشر, صرصور, بكتير, جراثيم, douleur, tache, moustiq, insect, odeur, wrinkl, stain, mosquit, sweat, snor, ronfl');
const NOUN=new Set(NS('مضاد, ضد, بدون, بلا, نهاية, وداعا, ودع, anti, sans, without, goodbye, adieu, fini, stop'));
const PFX=/^[وفبلك]/,AL=/^(?:[وفبلك]?ال|لل)(?=\S{2,})/;
const forms=w=>{const o=[w],a=w.replace(AL,'');if(a!==w)o.push(a);if(PFX.test(w)&&w.length>3)o.push(w.slice(1));return o};
const isProb=w=>forms(w).some(x=>PROB.has(x)||PSTEM.some(st=>x.startsWith(st)));
const isSvc=w=>forms(w).some(x=>SERVICE.has(x));
function benefitAd(a,L,rest){const hr=rest?cut(String(a.body).slice(160),1500)+' . '+a.link_description:a.title+' . '+cut(a.body,160),hn=N(hr);
 if(cache.get(L)&&cache.get(L).has(hn))return cache.get(L).get(hn);
 const W=[],re=/[\p{L}\p{N}]+/gu;let x;while((x=re.exec(hn)))W.push({w:x[0],s:x.index,t:x.index+x[0].length});
 const after=(pos,k)=>{let i=0;while(i<W.length&&W[i].s<pos)i++;return W.slice(i,i+k).map(o=>o.w)};
 const ms=findAll(hn,L.goldB||(L.goldB=L.gold.filter(e=>e.w>=1))).sort((x,y)=>x.s-y.s),good=[],normal=new Set();let strongN=0;
 for(const m of ms){const nx=after(m.t,4),prob=nx.some(isProb);
  if(!prob&&nx.slice(0,2).some(isSvc))continue;                                  // «يساعدك في التوصيل/الطلب»
  if(!prob&&GENERIC.has(N(m.e.label).trim()))continue;                          // فعل عام بلا مشكلة
  if(m.e.w===3||prob){strongN++;good.push(m)}else{normal.add(m.e.id);good.push(m)}}
 for(let i=0;i<W.length;i++){const w=W[i].w,fs=forms(w);
  if(fs.some(f=>NOUN.has(f))||(w==='no'&&W[i+1]&&W[i+1].w==='more')){const nx=W.slice(i+1,i+4).map(o=>o.w);
   if(nx.some(isProb)){strongN++;good.push({e:{w:3,id:'noun:'+w},s:W[i].s,t:W[i].t})}}}
 good.sort((p,q)=>p.s-q.s);
 const ok=strongN>0||normal.size>=2,tg=new Set();
 if(ok)good.forEach(m=>{const x=/^[^\p{L}\p{N}]*([\p{L}\p{N}]+)(?:[^\p{L}\p{N}]+([\p{L}\p{N}]+))?(?:[^\p{L}\p{N}]+([\p{L}\p{N}]+))?/u.exec(hn.slice(m.t));
  if(x)[x[1],x[2],x[3]].forEach(w=>{if(!w)return;w=w.replace(/^[وفبلك]?ال/,'');if(w.length>=4&&!STOPT.has(w))tg.add(w)})});
 const r={ok,strong:strongN>0,tag:ok?snippet(hr,hn,(good.find(m=>m.e.w===3)||good[0])):'',tg};
 if(!cache.has(L))cache.set(L,new Map());cache.get(L).set(hn,r);return r}
/* ---------- الجداول ---------- */
/* التصنيف تحدده المدة وحدها: 0-7 تجربة، 8-30 جوهرة، 31-60 رابح، 61+ قديم. من لم يبلغ الحد الأدنى ضعيف. بلا تاريخ = ضعيف */
/* 0-3 تحت التجربة · 4-7 واعد (بشروط الجوهرة) · 8-30 جوهرة · 31-60 رابح · 61+ قديم */
const MIN_SCORE=0,TIER=ag=>ag==null?'low':ag<=3?'trial':ag<=7?'prom':ag<=30?'gem':ag<=60?'fire':'old';
/* المواسم بكل اللغات (وسم فقط) */
const SEAS=MKT&&MKT.SEASONS?new RegExp(MKT.SEASONS.map(x=>{const t=N(x),e=t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return CJK.test(t)?e:'(?<![\\p{L}\\p{N}.])'+e+'(?![\\p{L}\\p{N}.])'}).join('|'),'u'):/رمضان|العيد|الاضحيه|الشتاء|شتاء|بلاك فرايداي|black friday|ramadan|الدخول المدرسي/;
const seasonOf=t=>{const m=SEAS.exec(t);return m?m[0]:''};
/* حد «قلة البائعين» حسب حجم السوق (الجزائر 3) */
const SELL=m=>MKT&&m?MKT.sellersMax(m):3;
/* ---------- الكلمة الدلالية للمنتج (للبحث في المواقع) ---------- */
const STOPW=new Set(`ارواحو ارواح تعالو تعالوا تشوفو شوفو شوف تشوف واش وين كاين كاينة راه راهو راهي هاذا هاذي هذا هذه هذي ذلك تلك هاد هادا هادي جبتلكم جبتلك جبنالكم جبنالك جبنا جبت جايبلكم جايبلك وصل وصلنا وصلت وصلكم عندنا عندك عندكم عند لدينا يتوفر متوفر متوفرة متوفرين منتج منتوج منتجات منتوجات سلعة جديد جديدة الجديد الجديدة جدد هبال هبالة خطير خطيرة رهيب رهيبة روعة رائع رائعة ممتاز ممتازة مميز مميزة افضل احسن اجمل اقوى حصري حصريا عرض عروض العرض خصم تخفيض تخفيضات سعر اسعار الاسعار بسعر ثمن مجاني مجانا مجانية توصيل التوصيل شحن الشحن الدفع الاستلام استلام ولاية ولايات الولايات كل جميع لجميع اطلب اطلبه اطلبها اطلبو اطلبوه طلب الطلب للطلب اتصل اتصلوا تواصل واتساب واتس ماسنجر رابط الرابط اضغط انقر الان دير ديرو خذ خذو خد خدو اشتري اشتر اشتروا سارع سارعو بادر لا تفوت تفوتو فرصة الفرصة محدود محدودة كمية الكمية قبل بعد غير فقط ماكانش ماكاش مكاين دج دينار جزائري الجزائر جزائر حبيبي حبيبتي اخي اختي يا اهلا مرحبا السلام عليكم عليك لكم لك لنا انتم انت نحن في من الى على عن مع او ثم لكن حتى اذا لو ان كما كان كانت يكون تكون هو هي هم هن ما لا لم لن كيفاش كيف علاش لماذا هل ديال تاع ديالك تاعك ديالنا تاعنا نتاع عليه عليها به بها له لها فيه فيها منه منها اللي الذي التي وين هنا هناك اليوم غدا جدا كثير كبير صغير مرة واحد واحدة اثنين ثلاثة
nouveau nouvelle nouveaux promo promotion offre livraison gratuite gratuit prix dzd da dinars commandez commander commande disponible disponibles produit produits le la les un une des du de d l et ou pour avec sans en au aux sur dans par ce cette ces votre vos notre nos est sont a ont plus moins tout tous toutes seulement uniquement best new free delivery shipping order now only the and for with y your you our get buy shop sale off today this that it is are to of in on at from by as be will can all one more just so an or no not
el los las tu su para con por envio envío gratis oferta precio ahora dan yang untuk di ini itu dengan ongkir harga beli sekarang cod promo giam gia mua ngay freeship sa ang ng mga na lang orderour you our this that from`.split(/\s+/).map(N));
const BRK=/[\n\r.!؟?,،:;|•·\-–—()\[\]{}"«»*#_~=+\/\\@<>0-9٠-٩]+|[\u{1F000}-\u{1FAFF}\u2600-\u27BF\u2B00-\u2BFF]+/u;
function phrases(text,extra){const out=[];
 String(text||'').split(BRK).forEach(seg=>{let run=[];const flush=()=>{if(!run.length)return;const L=run.length,mx=Math.min(4,L);
   for(let n=mx;n>=1;n--)for(let i=0;i+n<=L;i++)out.push({p:run.slice(i,i+n).map(x=>x.n).join(' '),o:run.slice(i,i+n).map(x=>x.o).join(' '),n,pos:i});run=[]};
  seg.split(/\s+/).filter(Boolean).forEach(o=>{const w=N(o),base=w.replace(/^[وفبلك]?ال/,'');
   if(w.length<2||STOPW.has(w)||STOPW.has(base)||(extra&&extra.has(w))||/\d/.test(w))flush();else run.push({n:w,o})});flush()});return out}
function keywordOf(texts,names){const extra=new Set();(names||[]).forEach(x=>N(x).split(/[^\p{L}]+/u).forEach(w=>w.length>2&&extra.add(w)));
 const df=new Map(),first=new Map();
 texts.forEach(t=>{const seen=new Set();phrases(t,extra).forEach(({p,o,n,pos})=>{if(seen.has(p))return;seen.add(p);df.set(p,(df.get(p)||0)+1);if(!first.has(p))first.set(p,{n,pos,o})})});
 let best='',bs=-1;df.forEach((d,p)=>{const {n,pos,o}=first.get(p),sc=d*10+(n>=2?n*3+2:0)-pos*.5;if(sc>bs){bs=sc;best=o}});
 return best}
/* ---------- الاتجاه ---------- */
function trendOf(p,NOW){const d=p.ads.filter(a=>a.start),t=a=>+a.start;
 const c14=d.filter(a=>t(a)>=NOW-14*D&&t(a)<=NOW).length,p14=d.filter(a=>t(a)>=NOW-28*D&&t(a)<NOW-14*D).length,c30=d.filter(a=>t(a)>=NOW-30*D&&t(a)<=NOW).length;
 const first=new Map();d.forEach(a=>{const v=first.get(a._s);if(v===undefined||t(a)<v)first.set(a._s,t(a))});
 let n14=0,n30=0;first.forEach(v=>{if(v>=NOW-14*D&&v<=NOW)n14++;if(v>=NOW-30*D&&v<=NOW)n30++});
 const act=p.ads.filter(a=>a.stat!=='stopped').length/p.ads.length;
 if(c30===0&&n30===0&&p.n>SELL(p.market))return'saturated';
 if(act<.5||(p14>0&&c14<p14/2))return'declining';
 if(c14>p14&&n14>=1)return p.n<=3?'emerging':'rising';
 return'steady'}
/* ---------- منتج واحد: الأدلة المشتركة والإقصاء ---------- */
const MKN=h=>{const m=MARKET.exec(h);const n=m?m[2]:h;return{aliexpress:'AliExpress',alibaba:'Alibaba',amazon:'Amazon',temu:'Temu',jumia:'Jumia',ouedkniss:'Ouedkniss','linktr.ee':'Linktree','bit.ly':'رابط مختصر',tinyurl:'رابط مختصر','t.me':'Telegram'}[n]||n};
const MKSET=new Set(['jumia','ouedkniss','temu','aliexpress','amazon','alibaba','shein']);
/* بقايا اسم الصفحة بعد حذف العلامة: كلمات «رسمي/متجر/الدولة» فقط = صفحة العلامة */
const OFFW=new Set('official officiel officielle store shop boutique online officialstore global international algerie algeria dz dza maroc morocco tunisie tunisia france fr uk usa us eg egypt ksa uae mena africa afrique arabia arab الرسمي الرسميه الرسمية رسمي متجر الجزائر الجزائريه المغرب تونس مصر السعوديه الامارات العربيه'.split(' '));
function officialBrand(sl,L){if(!L.brands||!L.brands.length)return'';
 const h=String(sl.host||'').split('.').slice(0,-1).join(' ');let hm=h&&!SOC.test(sl.host||'')?findAll(N(h),L.brands):[];if(hm.length)return hm[0].e.label;
 const nm=N(sl.name||'').trim();if(!nm)return'';const ms=findAll(nm,L.brands);if(!ms.length)return'';
 let rest=nm;ms.forEach(m=>{rest=rest.slice(0,m.s)+' '.repeat(Math.max(0,m.t-m.s))+rest.slice(m.t)});
 const left=rest.split(/[^\p{L}\p{N}]+/u).filter(w=>w&&!OFFW.has(w));return left.length?'':ms[0].e.label}
const modeOf=a=>{const c=new Map();a.forEach(x=>x&&c.set(x,(c.get(x)||0)+1));let b='',n=0;c.forEach((v,k)=>{if(v>n){n=v;b=k}});return b};
function mkProduct(ads,NOW,L,proofs){
 clusterSellers(ads);
 /* السوق الذي جاء منه المنتج: دولة إعلاناته (أو «سوق الملف»)، وكل الأسواق التي ظهر فيها */
 ads.forEach(a=>{a._mk=String(a.country||L.market||'').toUpperCase()});
 const market=modeOf(ads.map(a=>a._mk)),markets=[...new Set(ads.map(a=>a._mk).filter(Boolean))];
 const counted=ads.filter(a=>a.stat!=='stopped'),stopped=ads.length-counted.length;
 const S={};counted.forEach(a=>{const s=S[a._s]=S[a._s]||{pid:a.page_id||'',name:a.page_name,host:hostOf(a),ads:[],pr:[],start:Infinity};s.ads.push(a);if(a.start)s.start=Math.min(s.start,+a.start);
  const p=a._p??(a._p=price(a.title+' '+a.body));if(p)s.pr.push(p)});
 const sellers=Object.values(S).map(s=>({...s,p:med(s.pr),copies:s.ads.length,lib:s.ads[0].library_url})).sort((a,b)=>b.copies-a.copies),n=sellers.length;
 const copies=n?sellers[0].copies:0;
 /* عدد النسخ (معلومة فقط): مجموع «X إعلانات تستخدم هذا التصميم» من ميتا، مرة واحدة لكل مجموعة نسخ */
 const vg=new Map();(counted.length?counted:ads).forEach(a=>{const k=a.collation_id?'c'+a.collation_id:'a'+(a.ad_id||a._i);vg.set(k,Math.max(vg.get(k)||1,Math.max(1,parseInt(a.duplicates,10)||1)))});
 const versions=[...vg.values()].reduce((x,y)=>x+y,0);
 const P={ads,counted,stopped,sellers,n,copies,versions,market,markets};
 const why=[];
 /* كل إعلاناته متوقفة: إن استمر أحدها 8 أيام فأكثر = «توقف بعد نجاح» (فرصة لسوق آخر)، وإلا يُقصى */
 if(!counted.length){const run=Math.max(-1,...ads.filter(a=>a.start&&a.end).map(a=>Math.floor((a.end-a.start)/D)));
  if(run>=8)P.ended={days:run,last:Math.max(...ads.filter(a=>a.end).map(a=>+a.end))};else why.push('لا إعلان نشط: كل إعلاناته متوقفة'+(run>=0?' بعد '+run+' أيام فقط':''))}
 if(counted.length){
  /* «علامة كبيرة»: تُقصى فقط إن كانت الصفحة نفسها هي العلامة أو متجرها الرسمي، أو كان الموقع موقع العلامة. ذكر العلامة في النص لا يُقصي. */
  const bm=new Set();sellers.forEach(sl=>{const b=officialBrand(sl,L);if(b)bm.add(b)});
  if(bm.size)why.push('صفحة العلامة نفسها أو متجرها الرسمي: '+[...bm].join('، '));
  /* هل يبيع منتجاً مادياً؟ يُقصى إن كان نصف إعلاناته أو أكثر خدمة/دورة/فعالية/محلاً/شركة/تطبيقاً */
  if(PCK&&L.check!==false){const ig=L.ignore&&L.ignore.size?L.ignore:null,ap=L.allowPages;
   const rs=counted.map(a=>ap&&ap.has(String(a.page_id))?{ok:true}:(a._pc||(a._pc=PCK.check(a,{country:a.country||L.market,ignore:ig,hard:false})))),bad=rs.filter(r=>!r.ok);
   /* الهش وكبير الحجم والأكل: تنبيه فقط (وسم)، لا إقصاء */
   const wr=rs.filter(r=>r.warn);if(wr.length&&wr.length*2>=counted.length){const w=wr[0].warn;P.warn='⚠️ قد يكون '+w.label+(w.terms&&w.terms.length?' ('+w.terms.slice(0,2).join('، ')+')':'')}
   if(bad.length&&bad.length*2>=counted.length){const by={};bad.forEach(r=>{by[r.kind]=(by[r.kind]||0)+1});const top=Object.keys(by).sort((x,y)=>by[y]-by[x])[0],r=bad.find(x=>x.kind===top);
    why.push('ليس منتجاً صالحاً للتجارة الإلكترونية: '+r.reasons[0]+(r.ctx?' · في النص: …'+r.ctx+'…':'')+(counted.length>1?' · '+bad.length+' من '+counted.length+' إعلان':''));
    P.fix={terms:[...new Set(bad.filter(x=>x.kind===top).flatMap(x=>x.terms||[]))].slice(0,6),pages:[...new Set(counted.filter((a,i)=>!rs[i].ok).map(a=>String(a.page_id||'')).filter(Boolean))].slice(0,10)}}}}
 P.why=why;P.excl=why.length>0;
 const mk=counted.map(a=>hostOf(a)).find(h=>MARKET.test(h));P.mktTag=mk?MKN(mk):'';
 /* الفائدة: 2 = في العنوان/أول النص، 1 = في باقي النص فقط، 0 = بلا فائدة واضحة. تُرتِّب داخل التصنيف ولا تُقصي */
 const pool=counted.length?counted:ads;let tags=[],tg=new Set(),ben=0;
 const take=r=>{if(r.ok&&r.tag){if(!tags.includes(r.tag)&&tags.length<3)tags.push(r.tag);r.tg.forEach(x=>tg.add(x));return true}return false};
 pool.forEach(a=>{if(take(benefitAd(a,L)))ben=2});
 if(!ben)pool.forEach(a=>{if(String(a.body).length>160&&take(benefitAd(a,L,true)))ben=1});
 P.ben=ben;P.benOk=ben>0;P.strong=ben===2;P.tags=tags;P.tg=tg;P.proofs=proofs||new Map();P.trend='';
 const txt=N(pool.map(a=>a.title+' '+a.body).join(' '));P.seasTag=seasonOf(txt);P.seas=!!P.seasTag;
 P.q=N(txt+' '+sellers.map(s=>s.name).join(' '));
 return P}
function similar(P){const idx=new Map();P.forEach((p,i)=>p.tg.forEach(t=>{let s=idx.get(t);if(!s)idx.set(t,s=new Set());s.add(i)}));
 const cap=Math.max(10,Math.ceil(.2*P.filter(p=>p.tg.size).length));
 P.forEach((p,i)=>{const s=new Set();p.tg.forEach(t=>{const g=idx.get(t);if(g.size<=cap)g.forEach(j=>j!==i&&s.add(j))});
  p.sim=s.size;p.simNames=[...s].slice(0,4).map(j=>P[j].name);p.simOk=p.tg.size>0&&p.sim<=2})}
/* ---------- تقييم كل إعلان: المدة تخصه، والباقي مشترك بين إعلانات المنتج ---------- */
function scoreAd(a,P,NOW){
 const ag=age(a,NOW),dated=ag!=null,cat=TIER(dated?ag:null);
 const BL=['بلا فائدة واضحة','في نص الإعلان','في العنوان'];
 const ev=[
  {k:'dur',name:'مدة الإعلان (أساس التصنيف)',present:dated,val:dated?ag+' يوم':'بلا تاريخ',tag:!dated||ag<=3?'':ag<=7?'اجتاز التجربة الأولى':ag<=30?'مدة جولد':ag<=60?'قديم نسبياً في السوق':'قديم في السوق'},
  {k:'ben',name:'الفائدة (ترتيب داخل التصنيف)',present:P.ben>0,val:BL[P.ben||0],tag:P.tags&&P.tags[0]?P.tags[0]:''}];
 const score=(P.ben||0)*50;   // 100 فائدة في العنوان · 50 في النص · 0 بلا فائدة
 const nS=a.stat==='none',note=nS&&!dated?'بلا حالة وبلا تاريخ':nS?'بلا حالة':!dated?'بلا تاريخ':'';
 return{a,age:ag,ev,raw:score,score,cat,range:'',promising:false,note,miss:[]}}
/* ---------- الواجهة الرئيسية للنواة ---------- */
function analyze(rows,NOW,L){
 const P=groupAds(rows).map(g=>mkProduct(g.ads,NOW,L,g.proofs));
 const fl=t=>t.split(/\n/).map(x=>x.replace(/[*#_]|[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu,'').trim()).find(x=>x.length>3)||'';
 P.forEach(p=>{
  const top=p.counted.slice().sort((x,y)=>(y.start?+y.start:0)-(x.start?+x.start:0))[0]||p.ads[0];
  p.top=top;p.name=cut(top.title||fl(top.body)||top.domain||'منتج',80);
  p.k=(top.domain||'')+'|'+cut(N(p.name),24);
  /* السعر بعملته (من النص أو عملة السوق) + ما يعادله بالدينار */
  p.counted.forEach(a=>{if(a._p&&!a._cur)a._cur=MKT?MKT.currencyOf(a.title+' '+a.body,a._mk):'DZD'});
  p.cur=modeOf(p.counted.filter(a=>a._p).map(a=>a._cur))||(MKT&&p.market&&MKT.COUNTRIES[p.market]?MKT.COUNTRIES[p.market].cur:'DZD');
  p.pr=med(p.counted.filter(a=>a._p&&(a._cur||'DZD')===p.cur).map(a=>a._p));p.fmt=top.format;
  const rate=(L.rates||(MKT&&MKT.RATES_DZD)||{})[p.cur||'DZD'];p.prDzd=p.pr&&rate?NF(p.pr*rate):(p.cur==='DZD'||!p.cur?p.pr:0)});
 const rank={trial:0,prom:1,gem:2,fire:3,maybe:4,old:5,ended:6,low:7,excl:8},out=[];   // تحت التجربة ← واعد ← جوهرة ← رابح ← قديم ← توقف بعد نجاح ← ضعيف ← مقصاة
 P.forEach(p=>{
  p.recs=(p.ended?p.ads:p.counted).map(a=>scoreAd(a,p,NOW));
  if(p.ended){const ref=p.recs.slice().sort((x,y)=>((y.a.end&&y.a.start?y.a.end-y.a.start:0)-(x.a.end&&x.a.start?x.a.end-x.a.start:0)))[0];
   p.hits=p.tags.map(t=>({label:t,w:3}));p.pages=(p.ads[0]&&p.ads[0].page_name)||'—';p.also=[];
   p.ref=ref;p.top=ref.a;p.cat=p.tier='ended';p.score=ref.score;p.promising=false;p.days=p.ended.days;p.rank=rank.ended;p.oldInfo=null;out.push(p);return}
  p.hits=p.tags.map(t=>({label:t,w:3}));
  p.pages=(p.sellers[0]?p.sellers[0].name:'—')+(p.n>1?' و'+(p.n-1)+' آخرين':'');
  p.also=[];
  if(p.excl){const d=p.recs.filter(r=>r.age!=null).sort((x,y)=>x.age-y.age),ref=d[0]||p.recs[0]||null;
   p.ref=ref;p.top=ref?ref.a:p.ads[0];p.cat=p.tier='excl';p.score=0;p.promising=false;p.days=ref&&ref.age!=null?ref.age:0;p.rank=rank.excl;out.push(p);return}
  /* كل نسخة (إعلان) تُوضع في تصنيفها حسب عمرها: للمنتج مدخل في كل تصنيف تقع فيه نسخه */
  const by=new Map();p.recs.forEach(r=>{if(!by.has(r.cat))by.set(r.cat,[]);by.get(r.cat).push(r)});
  const cats=[...by.keys()].sort((x,y)=>rank[x]-rank[y]);
  cats.forEach((c,i)=>{const q=i?{...p}:p,rs=by.get(c).slice().sort((x,y)=>(y.age==null?-1:y.age)-(x.age==null?-1:x.age));
   q.ref=rs[0];q.top=q.ref.a;q.cat=q.tier=c;q.score=q.ref.score;q.promising=c==='trial'&&rs.some(r=>r.promising);
   q.days=q.ref.age!=null?q.ref.age:0;q.rank=rank[c];q.also=cats.filter(x=>x!==c);
   q.oldInfo=null;
   if(i)q.k=p.k+'#'+c;out.push(q)})});
 out.sort((a,b)=>a.rank-b.rank||(b.ben||0)-(a.ben||0)||(b.days||0)-(a.days||0));   // التصنيف ← الفائدة ← الأطول عمراً
 return out}
return{analyze,sellerCount,buildLists,MIN_SCORE,firstUrl,normRow,N,price,hostOf,stat,keywordOf,_t:{scoreAd,groupAds,compile,findAll}};
})();
if(typeof module!=='undefined')module.exports=CORE;
