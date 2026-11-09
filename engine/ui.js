(function(){
'use strict';
if(typeof document==='undefined')return;
const R=document.getElementById('wpr-app');if(!R)return;
const $=s=>R.querySelector(s),D=document,NF=Math.round;
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const MK=()=>window.RadarMarkets;
const flag=c=>/^[A-Z]{2}$/.test(c||'')?String.fromCodePoint(...[...c].map(x=>127397+x.charCodeAt())):'';
const mkName=c=>{const m=MK();return m&&m.COUNTRIES[c]?m.COUNTRIES[c].name:c};
const nf=n=>Number(n||0).toLocaleString('ar-DZ');
/* السعر بعملته + ما يعادله بالدينار */
const priceTxt=p=>{if(!p.pr)return'—';const m=MK(),c=p.cur||'DZD',sym=m?m.curSymbol(c):c;return nf(p.pr)+' '+sym+(c!=='DZD'&&p.prDzd?`<small style="display:block;font-weight:400">≈ ${nf(p.prDzd)} دج</small>`:'')};
/* سوق المنتج وكل الأسواق التي ظهر فيها */
const mkChip=p=>{const ms=(p.markets||[]).filter(Boolean),m=p.market||ms[0];if(!m)return'';return`<span class="tg soft" title="السوق الذي جاء منه المنتج">${flag(m)} ${esc(mkName(m))}</span>`+(ms.length>1?`<span class="tg" title="${esc(ms.map(mkName).join('، '))}">🌍 يظهر في ${ms.length} أسواق: ${ms.map(flag).join(' ')}</span>`:'')};
/* أسعار الصرف (تقريبية، قابلة للتعديل، تُحفظ في هذا المتصفح) */
const RK='wpr_rates_v1',myRates=()=>{try{return JSON.parse(localStorage.getItem(RK))||{}}catch(e){return{}}};
const CL={trial:'🧪 تحت التجربة',gem:'💎 جوهرة',fire:'🔥 رابح',old:'🕰️ قديم في السوق',low:'ضعيف',excl:'مقصاة',watch:'👀 للمراقبة (قديم)',new:'🆕 جديد (قديم)'};
const TRL={emerging:'بداية انتشار',rising:'صاعد',steady:'مستقر',declining:'في هبوط',saturated:'متشبع'};
const fd=d=>new Date(d).toLocaleDateString('ar-DZ',{year:'numeric',month:'long',day:'numeric'});
let ALL=[],PROD=[],VIEW=[],shown=60,NOW=Date.now(),FAV=new Set(),tab='all';
const arr=j=>{if(Array.isArray(j))return j;for(const k in j){if(Array.isArray(j[k]))return j[k];if(j[k]&&typeof j[k]==='object')for(const k2 in j[k])if(Array.isArray(j[k][k2]))return j[k][k2]}return[j]};
/* مكتبة Excel (900 كيلوبايت) تُحمَّل فقط عند رفع ملف Excel/CSV، لا مع كل فتح للمنصة */
let XL=null;const needXLSX=()=>window.XLSX?Promise.resolve():XL||(XL=new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=ok;s.onerror=()=>{XL=null;no(new Error('تعذّر تحميل قارئ ملفات Excel، تحقق من الاتصال'))};document.head.appendChild(s)}));
async function readFile(f){const n=f.name.toLowerCase();if(!/\.(json|jsonl|txt)$/.test(n))await needXLSX();
 if(/\.(json|jsonl|txt)$/.test(n)){const t=(await f.text()).replace(/^\uFEFF/,'');try{return arr(JSON.parse(t))}catch(e){return t.split(/\r?\n/).filter(l=>l.trim()).map(l=>JSON.parse(l))}}
 if(/\.(csv|tsv)$/.test(n)){const wb=XLSX.read((await f.text()).replace(/^\uFEFF/,''),{type:'string',cellDates:true});return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''})}
 const wb=XLSX.read(await f.arrayBuffer(),{type:'array',cellDates:true});return wb.SheetNames.flatMap(s=>XLSX.utils.sheet_to_json(wb.Sheets[s],{defval:''}))}
function msg(t,err){$('#msg').innerHTML=t?`<div class="alert ${err?'err':''}">${esc(t)}</div>`:''}

let LAST_L=null,VP=0,LK='',LCACHE=null;const VH=new Map();
/* قائمة «سوق الملف» و«فلتر السوق» وأسعار الصرف */
function fillMarkets(){const m=MK();if(!m)return;const sel=$('#mkt');if(sel&&sel.options.length<2){sel.innerHTML='<option value="">تلقائي (من عمود الدولة في الملف)</option>'+Object.keys(m.COUNTRIES).filter(c=>c!=='ALL').map(c=>`<option value="${c}">${flag(c)} ${esc(m.COUNTRIES[c].name)}</option>`).join('')}
 const f=$('#fmk');if(f){const cur=f.value,ms=[...new Set(PROD.flatMap(p=>p.markets||[]))].filter(Boolean);f.innerHTML='<option value="">كل الأسواق</option>'+ms.map(c=>`<option value="${c}"${c===cur?' selected':''}>${flag(c)} ${esc(mkName(c))}</option>`).join('')}
 const rb=$('#rates');if(rb){const cs=[...new Set(PROD.map(p=>p.cur).filter(c=>c&&c!=='DZD'))],r=Object.assign({},m.RATES_DZD,myRates());rb.innerHTML=cs.length?cs.map(c=>`<label class="fl">1 ${esc(m.curSymbol(c))} (${c}) = ? دج<input type="number" step="any" min="0" data-rate="${c}" value="${r[c]||''}"></label>`).join(''):'<p class="sub">كل الأسعار بالدينار.</p>'}}
/* بصمة الصورة: نفس المنتج بصور متطابقة بصرياً (في سوقين، بلغتين، أو بروابط مختلفة) يُدمج في منتج واحد */
async function vpass(){const G=window.RadarGapMatch;if(!G||!PROD.length)return;const run=++VP;
 const ps=[...new Map(PROD.filter(p=>!p.excl&&p.cat!=='low').map(p=>[p.k.split('#')[0],p])).values()].slice(0,250),todo=[];   /* الأداء: المنتجات المهمة فقط وصورة واحدة لكل منتج */
 ps.forEach(p=>imgsOf(p).slice(0,1).forEach(u=>{if(u&&!VH.has(u)&&!todo.includes(u))todo.push(u)}));
 let i=0,done=0;const step=async()=>{while(i<todo.length){const u=todo[i++];VH.set(u,await G.hashImage('/api/img?u='+encodeURIComponent(u))||[]);done++;if(run!==VP)return;if(done%10===0)window.__busy&&window.__busy('vp','جارٍ مقارنة بصمات صور المنتجات '+nf(done)+'/'+nf(todo.length))}};
 if(todo.length){window.__busy&&window.__busy('vp','جارٍ مقارنة بصمات صور المنتجات…');try{await Promise.all([1,2,3].map(step))}finally{window.__busy&&window.__busy('vp')}}
 if(run!==VP)return;
 const H=ps.map(p=>imgsOf(p).slice(0,1).flatMap(u=>VH.get(u)||[])),par=ps.map((_,k)=>k),f=k=>{while(par[k]!==k){par[k]=par[par[k]];k=par[k]}return k};
 for(let a=0;a<ps.length;a++)if(H[a].length)for(let b=a+1;b<ps.length;b++)if(H[b].length&&f(a)!==f(b)&&G.bestImage(H[a],H[b])<=6)par[f(b)]=f(a);
 const size=new Map();ps.forEach((_,k)=>size.set(f(k),(size.get(f(k))||0)+1));let merged=0;
 ps.forEach((p,k)=>{const r=f(k);if(size.get(r)>1){merged++;p.ads.forEach(a=>{if(a._i!=null)VHI[a._i]='v'+r})}});
 if(!merged)return;
 await analyze();
 if($('#note').textContent.includes('🔗'))return;$('#note').insertAdjacentHTML('beforeend',`<div class="alert info">🔗 بصمة الصورة: دُمج ${nf(merged)} منتجاً ظهرت بنفس الصورة (في أسواق أو لغات أو متاجر مختلفة)، فصار كلٌّ منها منتجاً واحداً بكل بائعيه.</div>`);render()}
async function load(files){VP++;for(const k in VHI)delete VHI[k];msg('');let rows=[],lm=0;window.__busy&&window.__busy('ld','جارٍ قراءة الملف…');try{
 for(const f of files){lm=Math.max(lm,f.lastModified||0);if(Array.isArray(f.rows)){rows=rows.concat(f.rows);continue}   /* صفوف جاهزة من المنصة: بلا تحويل إلى ملف ثم قراءته */
  try{rows=rows.concat(await readFile(f))}catch(e){msg('تعذّرت قراءة الملف '+f.name+'. تأكد أنه JSON أو Excel أو CSV سليم.',1)}}
 const seen=new Set();ALL=[];
 rows.filter(r=>r&&typeof r==='object').map(CORE.normRow).forEach(a=>{if(!(a.body||a.link_url||a.title))return;const k=a.ad_id||a.library_url||a.body.slice(0,80)+a.page_name;if(seen.has(k))return;seen.add(k);ALL.push(a)});
 if(!ALL.length){msg('لم أجد إعلانات في الملف. تحقق من أسماء الأعمدة (مثل body و link_url و start_date).',1);return}
 const cd=ALL.map(a=>a.collected).filter(Boolean).map(Number);
 NOW=cd.length?Math.max(...cd):(lm||Date.now());   // تاريخ جمع البيانات
}finally{window.__busy&&window.__busy('ld')}
 await analyze();$('#app').hidden=false;window.__onLoaded&&window.__onLoaded(files.map(f=>f.name),rows);setTimeout(()=>vpass().catch(()=>{}),300)}

/* التحليل في خيط خلفي للملفات الكبيرة (الصفحة لا تتجمد)، ومباشرة للصغيرة أو إن تعذّر الخيط */
let WK=null,WKN=0;const WKW=new Map();
function worker(){if(WK!==null)return WK;try{WK=new Worker('/engine-worker.js');WK.onmessage=e=>{const f=WKW.get(e.data.id);if(f){WKW.delete(e.data.id);f(e.data)}};WK.onerror=()=>{WK=false;WKW.forEach(f=>f({error:'worker'}));WKW.clear()}}catch(x){WK=false}return WK}
const VHI={};   /* بصمة الصورة: رقم الإعلان في ALL → مجموعة الدمج */
async function analyze(){
 const MKT=window.RadarMarkets,mg=t=>MKT?', '+MKT.goldText(t):'';   /* الفائدة تُقرأ أيضاً بلغات الأسواق الدولية */
 const src={strong:$('#d_strong').value+mg('strong'),normal:$('#d_mid').value+mg('normal'),brands:$('#d_brand').value,bulky:$('#d_bulky').value,fragile:$('#d_fragile').value},lk=JSON.stringify(src);
 const market=($('#mkt')||{}).value||'',rates=Object.assign({},MK()?MK().RATES_DZD:{},myRates());
 ALL.forEach((a,i)=>{a._i=i;if(VHI[i])a._vh=VHI[i]});
 window.__busy&&window.__busy('an','جارٍ التحليل…');
 try{
  let done=false;const w=ALL.length>=1500&&worker();
  if(w){const r=await new Promise(ok=>{const id=++WKN;WKW.set(id,ok);w.postMessage({id,rows:ALL,NOW,src,market,rates,vh:VHI})});if(!r.error){PROD=r.P;done=true}}
  if(!done){/* الأداء: القوائم تُبنى مرة واحدة ما لم تتغير الإعدادات */if(LK!==lk){LK=lk;LCACHE=CORE.buildLists(src)}PROD=CORE.analyze(ALL,NOW,Object.assign({},LCACHE,{market,rates}))}
 }finally{window.__busy&&window.__busy('an')}
 LAST_L={market,rates};fillMarkets();
 const kw=new Set(ALL.map(a=>a.search).filter(Boolean)).size,ds=Math.floor((Date.now()-NOW)/864e5);
 $('#note').innerHTML=`<div class="alert info">تاريخ جمع البيانات: ${fd(NOW)}، وتُقاس أعمار الإعلانات منه.${ds>3?` مرّ على الجمع ${ds} أيام، فقد تكون الأعمار والحالات متقادمة، والأفضل إعادة جمع البيانات.`:''}</div>`+
  (ALL.length<400||kw<3?`<div class="alert info">دقة قياس المنافسة مبنية على ${ALL.length} إعلان ${kw?'من '+kw+' كلمة بحث':''}. كلما أضفت ملفات من كلمات بحث أخرى ارتفعت دقة عدد البائعين والاتجاه.</div>`:'');
 render()}

function render(){shown=60;const v=id=>$('#'+id).value,ck=id=>$('#'+id).checked;
 const q=CORE.N(v('q')).trim(),min=+v('minScore')||0,mc=+v('maxComp')||1e9,md=+v('minDays')||0,pmin=+v('pmin')||0,pmax=+v('pmax')||1e12,fm=v('fmt');
 const B=PROD.filter(p=>(p.excl||p.score>=min)&&p.n<=mc&&p.days>=md&&(!fm||p.fmt===fm)&&(!q||p.q.includes(q))&&(!(v('pmin')||v('pmax'))||(p.prDzd&&p.prDzd>=pmin&&p.prDzd<=pmax))&&(!$('#fmk')||!v('fmk')||(p.markets||[]).includes(v('fmk')))&&(!ck('cb')||p.benOk)&&(!ck('cs')||!p.seas));
 const cnt={all:0,trial:0,gem:0,fire:0,old:0,low:0,excl:0,fav:0,watch:0,new:0};B.forEach(p=>{cnt[p.cat]++;if(p.cat!=='excl')cnt.all++;if(FAV.has(p.k))cnt.fav++});
 R.querySelectorAll('#tabs button').forEach(b=>{b.querySelector('b').textContent=cnt[b.dataset.t];b.classList.toggle('on',b.dataset.t===tab)});
 VIEW=B.filter(p=>tab==='all'?p.cat!=='excl':tab==='fav'?FAV.has(p.k):p.cat===tab);
 const so=v('sort');VIEW.sort((a,b)=>so==='days'?b.days-a.days:so==='comp'?a.n-b.n||b.score-a.score:so==='new'?a.days-b.days:a.rank-b.rank||b.score-a.score||(a.seas-b.seas));
 const act=PROD.reduce((s,p)=>s+p.counted.length,0);
 $('#sum').innerHTML=[[ALL.length,'إعلان'],[act,'نشط ويدخل التحليل'],[ALL.length-act,'متوقف (خارج التحليل)'],[new Set(PROD.map(p=>p.k.split('#')[0])).size,'منتج'],[PROD.length,'مدخل بتصنيفاته'],[cnt.gem,'💎 جوهرة'],[VIEW.length,'معروض الآن']].map(x=>`<div class="kpi"><b>${x[0]}</b><span>${x[1]}</span></div>`).join('');
 draw()}
const ok=u=>/^https?:/i.test(u||'');
const T=(m,t)=>window.__toast&&window.__toast(m,t);
/* ---------- صور المنتج (تُجمع من كل إعلاناته) ---------- */
function imgsOf(p){if(p.images)return p.images;const out=[];const add=u=>{if(ok(u)&&!out.includes(u))out.push(u)};add(p.top&&p.top.image_url);(p.recs||[]).forEach(r=>add(r.a.image_url));return out.slice(0,12)}
async function blobOf(u){const r=await fetch('/api/img?u='+encodeURIComponent(u));if(!r.ok)throw new Error('تعذّر جلب الصورة من مصدرها (قد تكون منتهية الصلاحية)');return r.blob()}
async function dlImg(u){const b=await blobOf(u),a=D.createElement('a');a.href=URL.createObjectURL(b);a.download='product-'+Date.now()+'.jpg';D.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},600)}
async function cpImg(u){const b=await blobOf(u),m=await createImageBitmap(b),c=D.createElement('canvas');c.width=m.width;c.height=m.height;c.getContext('2d').drawImage(m,0,0);
 const png=await new Promise(r=>c.toBlob(r,'image/png'));await navigator.clipboard.write([new ClipboardItem({'image/png':png})])}
/* ---------- المعاينة المكبّرة ---------- */
let LB={l:[],i:0,saved:false};
function lbShow(){const u=LB.l[LB.i];$('#lb-img').src=LB.saved?'/api/img?u='+encodeURIComponent(u):u;$('#lb-n').textContent=(LB.i+1)+' / '+LB.l.length;$('#lb').querySelectorAll('.lb-nav').forEach(b=>b.hidden=LB.l.length<2);
 $('#lb-lens').href='https://lens.google.com/uploadbyurl?url='+encodeURIComponent(u)}
function lbOpen(l,i,saved){LB={l,i,saved};lbShow();$('#lb').hidden=false;D.body.classList.add('noscroll')}
function lbClose(){$('#lb').hidden=true;D.body.classList.remove('noscroll');$('#lb-img').removeAttribute('src')}
/* ---------- بطاقة المنتج ---------- */
function evTable(r){if(r.coef!==undefined)return evTableOld(r);
 return `<table class="tb"><tr><th>الدليل</th><th>الوزن</th><th>متحقق</th><th>النقاط</th></tr>${r.ev.map(e=>`<tr><td>${e.name}${e.tag?' <small>('+e.tag+')</small>':''}</td><td>${e.w||'—'}</td><td>${e.w?(e.present?'✓':'—'):''}</td><td>${e.w?Math.round(e.pts*100)/100:(e.val?'<b>'+(TRL[e.val]||e.val)+'</b> <small>(وسم فقط، بلا درجة)</small>':'وسم فقط')}</td></tr>`).join('')}<tr class="ft"><td colspan="3">المجموع من 100</td><td><b>${r.score}</b></td></tr></table>`}
function proofLine(p){const a=[...(p.proofs||[])].map(([k,n])=>`${k} (${n} إعلانات)`).join('، ');return `<p class="sub"><b>إثبات أن الإعلانات لمنتج واحد:</b> ${a||'إعلان واحد، لا تطابق مع غيره'}</p>`}
function simLine(p){const n=p.tg?p.tg.size:p.tgN;return n?`<p class="sub"><b>منتجات مشابهة لوظيفته (${p.sim||0}):</b> ${(p.simNames||[]).map(esc).join('، ')||'لا يوجد'}</p>`:'<p class="sub">لم تُستخرج فائدة محددة، فلا يمكن التحقق من المشابهة.</p>'}
function evTableOld(r){return `<table class="tb"><tr><th>الدليل</th><th>الوزن</th><th>حاضر</th><th>الدرجة</th><th>النقاط</th></tr>${r.ev.map(e=>`<tr><td>${e.name}${e.half?' <small>(نصف الدرجة: لا دليل آخر)</small>':''}</td><td>${e.w}</td><td>${e.present?'✓':'—'}</td><td>${NF(e.pct*100)}%</td><td>${Math.round(e.pts*10)/10}</td></tr>`).join('')}<tr class="ft"><td colspan="2">الأدلة الحاضرة ك = ${r.k}</td><td colspan="2">معامل التضافر ${r.coef.toFixed(2)}</td><td>${Math.round(r.raw*10)/10} × ${r.coef.toFixed(2)} = <b>${r.score}</b></td></tr></table>`}
function adsTable(p,saved){const rs=[...(p.recs||[])].sort((a,b)=>(a.age==null)-(b.age==null)||a.age-b.age).slice(0,20);if(!rs.length)return'';
 const L=(u,t)=>ok(u)?`<a href="${esc(u)}" target="_blank" rel="noopener">${t}</a>`:'';
 const th=u=>ok(u)?`<a href="${esc(u)}" target="_blank" rel="noopener"><img class="th" loading="lazy" referrerpolicy="no-referrer" alt="" src="${esc(saved?'/api/img?u='+encodeURIComponent(u):u)}" data-o="${esc(u)}" onerror="if(!this.dataset.p&&!${saved?1:0}){this.dataset.p=1;this.src='/api/img?u='+encodeURIComponent(this.dataset.o)}else{this.remove()}"></a>`:'';
 return `<table class="tb"><tr><th>صورة</th><th>عمر الإعلان</th><th>الفئة</th><th>الدرجة</th><th>الحالة</th><th>الروابط</th></tr>${rs.map(r=>`<tr><td>${th(r.a.image_url)}</td><td>${r.age==null?'بلا تاريخ':r.age+' يوم'}</td><td>${CL[r.cat]}${r.range?' · '+r.range:''}</td><td>${r.score}</td><td>${r.a.stat==='active'?'نشط':'بلا حالة'}</td><td>${[L(r.a.library_url,'الإعلان'),L(r.a.image_url,'الصورة'),L(r.a.video_url,'الفيديو')].filter(Boolean).join(' · ')}</td></tr>`).join('')}</table>${p.recs.length>20?`<p class="sub">يعرض أحدث 20 من ${p.recs.length} إعلاناً.</p>`:''}${p.stopped?`<p class="sub">${p.stopped} إعلان متوقف لا يدخل التحليل ولا العدّ، ويُستعمل في قياس الاتجاه فقط.</p>`:''}`}
function oldBanner(p){const o=p.oldInfo;if(!o)return'';
 const d=p.days!=null?p.days+' يوماً':'';
 const up=o.up&&o.up.length?` ولبعض نسخه تصنيف ${o.up.map(c=>CL[c]).join(' و')} أيضاً.`:'';
 return o.all?`<div class="oldn ok">🕰️ <b>قديم في السوق (${d})</b>، لكنه <b>يستوفي كل معايير الجوهرة والرابح الأخرى</b>: ${o.met.join('، ')}.${up}</div>`
 :`<div class="oldn">🕰️ <b>قديم في السوق (${d})</b>. يستوفي: ${o.met.length?o.met.join('، '):'لا شيء'}${o.miss.length?`. لا يستوفي: ${o.miss.join('، ')}`:''}.${up}</div>`}
function srcBox(p,kw,imgs){const q=encodeURIComponent(kw||p.name.slice(0,60)),im=imgs[0],e=encodeURIComponent;
 return `<div class="src"><div class="src-r"><span class="src-l">🔎 بالكلمة${kw?` <b>«${esc(kw)}»</b>`:''}</span>
<a class="chip" href="https://www.aliexpress.com/wholesale?SearchText=${q}" target="_blank" rel="noopener">AliExpress</a><a class="chip" href="https://www.alibaba.com/trade/search?SearchText=${q}" target="_blank" rel="noopener">Alibaba (جملة)</a><a class="chip" href="https://www.google.com/search?q=${q}" target="_blank" rel="noopener">Google</a><a class="chip" href="https://www.tiktok.com/search?q=${q}" target="_blank" rel="noopener">TikTok</a><a class="chip" href="https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=DZ&q=${q}&search_type=keyword_unordered" target="_blank" rel="noopener">منافسون بالجزائر</a></div>
${im?`<div class="src-r"><span class="src-l">🖼️ بالصورة</span><a class="chip" href="https://lens.google.com/uploadbyurl?url=${e(im)}" target="_blank" rel="noopener">عدسة Google</a><a class="chip" href="https://yandex.com/images/search?rpt=imageview&url=${e(im)}" target="_blank" rel="noopener">Yandex</a><button class="chip" data-act="dl" data-img="${esc(im)}">⬇ حمّل الصورة</button><button class="chip" data-act="cp" data-img="${esc(im)}">📋 انسخ الصورة</button></div>
<div class="src-r"><span class="src-l">ثم ارفعها في بحث الصورة (أيقونة 📷) على:</span><a class="chip alt" href="https://www.1688.com/" target="_blank" rel="noopener">1688</a><a class="chip alt" href="https://www.aliexpress.com/" target="_blank" rel="noopener">AliExpress</a><a class="chip alt" href="https://www.alibaba.com/" target="_blank" rel="noopener">Alibaba</a></div>`:'<p class="sub">لا توجد صورة لهذا المنتج، فالبحث بالكلمة الدلالية فقط.</p>'}</div>`}
/* الأداء: جداول الإعلانات والأدلة داخل كل بطاقة تُبنى فقط عند فتحها (كانت تُبنى لكل البطاقات مسبقاً: عشرات آلاف العناصر) */
const LZ=new Map();let LZN=0;const lzPut=f=>{const k='z'+(++LZN);LZ.set(k,f);if(LZ.size>3000)LZ.delete(LZ.keys().next().value);return k};
document.addEventListener('toggle',ev=>{const d=ev.target;if(!d.open||!d.dataset||!d.dataset.lz||d.dataset.done)return;const f=LZ.get(d.dataset.lz);if(!f)return;d.dataset.done=1;const sm=d.querySelector('summary');d.innerHTML='';d.appendChild(sm);d.insertAdjacentHTML('beforeend',f())},true);
function cardHTML(p,o={}){const t=p.top||{},r=p.ref,imgs=imgsOf(p),im=imgs[0],kw=(o.kw!=null&&o.kw!==''?o.kw:p.kw)||'',saved=!!o.saved;
 const src=u=>saved?'/api/img?u='+encodeURIComponent(u):u,pr=priceTxt(p);
 const lk=f=>{if(ok(t[f]))return t[f];const x=(p.recs||[]).find(r=>ok(r.a[f]));return x?x.a[f]:''};
 const media=im?`<div class="pc-media" data-imgs="${esc(JSON.stringify(imgs))}" data-saved="${saved?1:0}" title="اضغط للتكبير"><img loading="lazy" referrerpolicy="no-referrer" alt="" src="${esc(src(im))}" data-o="${esc(im)}" onerror="if(!this.dataset.p&&!${saved?1:0}){this.dataset.p=1;this.src='/api/img?u='+encodeURIComponent(this.dataset.o)}else{this.parentNode.classList.add('noimg');this.remove()}"><span class="zoom">⤢ ${imgs.length>1?imgs.length+' صور':'تكبير'}</span></div>`:'<div class="pc-media noimg"></div>';
 const notes=r&&r.note?`<span class="tg warn">${r.note}</span>`:'';
 return `<article class="pc ${p.cat}">${media.replace('class="pc-media','class="pc-media cat-'+p.cat)}
<div class="pc-top"><span class="bdg cat-${p.cat}">${CL[p.cat]}${p.promising?' · ⭐ واعد':''}</span>${p.excl?'':`<div class="ring" style="--p:${p.score}"><b>${p.score}</b></div>`}</div>
<div class="pc-body"><h3 class="pc-ti">${esc(p.name)}</h3><p class="pc-sub">${esc(p.pages||'')}</p>${oldBanner(p)}
<div class="pc-tags">${p.excl?'':`${r&&r.ev&&r.ev[0]&&r.ev[0].tag?`<span class="tg">${r.ev[0].tag}</span>`:''}<span class="tg">اتجاه السوق: ${TRL[p.trend]||''}</span>`}${p.also&&p.also.length?`<span class="tg">له نسخ أيضاً في: ${p.also.map(c=>CL[c]).join('، ')}</span>`:''}${mkChip(p)}${p.seas?`<span class="tg">موسمي${p.seasTag?': '+esc(p.seasTag):''}</span>`:''}${notes}</div>
<div class="pc-st"><div><b>${p.n}</b><span>بائع</span></div><div><b>${p.copies}</b><span>إعلانات/بائع</span></div><div><b>${(p.counted||[]).length}</b><span>نشطة</span></div><div><b>${r&&r.age!=null?r.age:'—'}</b><span>عمر (يوم)</span></div><div><b>${pr}</b><span>السعر</span></div></div>
${saved?`<label class="fl">الكلمة الدلالية للبحث<input dir="auto" data-f="kw" data-k="${esc(o.k)}" value="${esc(kw)}" placeholder="مثال: قلم التلوين السحري"></label>`:(kw?`<div class="pc-kw">🔑 الكلمة الدلالية: <b>${esc(kw)}</b></div>`:'')}
<div class="pc-ch">${p.excl?(p.why||[]).map(x=>`<span class="tg bad">${esc(x)}</span>`).join(''):(p.hits||[]).slice(0,6).map(x=>`<span class="tg soft">🟢 ${esc(x.label)}</span>`).join('')}</div>
${srcBox(p,kw,imgs)}
<details class="pc-more" data-lz="${lzPut(()=>`${p.excl||!r?'':`<h4>الإعلان المرجعي</h4>${evTable(r)}`}${proofLine(p)}${simLine(p)}<h4>إعلانات المنتج، كلٌّ بتصنيفه</h4>${adsTable(p,saved)}
<h4>البائعون</h4><table class="tb"><tr><th>البائع</th><th>المتجر</th><th>نسخ</th><th>السعر</th><th></th></tr>${(p.sellers||[]).slice(0,12).map(s=>`<tr><td>${esc(s.name)}</td><td>${esc(s.host)}</td><td>${s.copies}</td><td>${s.p||'—'}</td><td>${/^\d{5,}$/.test(s.pid||'')?`<button class="btn ghost sm" data-tool="watch" data-pid="${esc(s.pid)}" data-name="${esc(s.name)}" title="راقب إعلانات هذه الصفحة">👁 راقب</button>`:''}</td></tr>`).join('')}</table>`)}"><summary>${p.excl||!r?'الإعلانات والبائعون':'تحليل الأدلة والإعلانات والبائعون'}</summary><p class="sub">…</p></details>
<div class="pc-lk">${[['library_url','الإعلان'],['link_url','المتجر'],['video_url','الفيديو']].map(([f,l])=>{const u=lk(f);return ok(u)?`<a class="lk" href="${esc(u)}" target="_blank" rel="noopener">${l} ↗</a>`:''}).join('')}${ok(im)?`<a class="lk" href="${esc(im)}" target="_blank" rel="noopener">الصورة ↗</a>`:''}</div>
${saved?`<label class="fl">ملاحظتي<textarea data-f="note" data-k="${esc(o.k)}" rows="2" placeholder="ملاحظاتك على المنتج">${esc(o.note||'')}</textarea></label><div class="pc-act"><span class="sub">نسخة محفوظة بتاريخ ${fd(o.at||Date.now())}</span><button class="btn ghost sm" data-tool="sup" data-k="${esc(saved?o.k:p.k)}" data-sv="${saved?1:0}" title="ابحث عن هذا المنتج في AliExpress وقارن بالصورة">🏭 المورّد</button><button class="btn ghost sm" data-tool="ai" data-k="${esc(saved?o.k:p.k)}" data-sv="${saved?1:0}" title="زاوية البيع والجمهور ونص إعلان جزائري">🧠 تحليل الإعلان</button><button class="btn sm" data-a="togap" data-id="${esc(o.k)}" title="هل يُباع في الجزائر؟">🎯 افحص في الجزائر</button><button class="btn danger sm" data-a="unsave" data-id="${esc(o.k)}">إزالة من المحفوظات</button></div>`
:`<div class="pc-act"><button class="btn ghost sm" data-tool="sup" data-k="${esc(saved?o.k:p.k)}" data-sv="${saved?1:0}" title="ابحث عن هذا المنتج في AliExpress وقارن بالصورة">🏭 المورّد</button><button class="btn ghost sm" data-tool="ai" data-k="${esc(saved?o.k:p.k)}" data-sv="${saved?1:0}" title="زاوية البيع والجمهور ونص إعلان جزائري">🧠 تحليل الإعلان</button><button class="btn ${FAV.has(p.k)?'':'ghost'} sm save" data-k="${esc(p.k)}">${FAV.has(p.k)?'★ محفوظ':'☆ حفظ المنتج'}</button></div>`}</div></article>`}
const card=p=>cardHTML(p);
function draw(){const s=VIEW.slice(0,shown);$('#grid').innerHTML=s.length?s.map(card).join(''):'<div class="empty">لا توجد منتجات في هذا التبويب بهذه الفلاتر. خفّف شرطاً أو أكثر.</div>';$('#more').hidden=VIEW.length<=shown}
/* ---------- نسخة المنتج المحفوظة كما هي ---------- */
const slim=a=>({title:a.title,body:String(a.body||'').slice(0,700),page_name:a.page_name,page_id:a.page_id,library_url:a.library_url,link_url:a.link_url,image_url:a.image_url,video_url:a.video_url,format:a.format,start_date:a.start_date,stat:a.stat,domain:a.domain,ad_id:a.ad_id});
function snapshot(p){const recs=p.recs.slice(0,30),ri=Math.max(0,recs.indexOf(p.ref));
 return{v:2,name:p.name,kw:p.kw||'',cat:p.cat,tier:p.cat,score:p.score,days:p.days,trend:p.trend,seas:p.seas,n:p.n,copies:p.copies,pr:p.pr,price:p.pr,pages:p.pages,why:p.why,stopped:p.stopped,fmt:p.fmt,
  counted:new Array(p.counted.length).fill(0),hits:p.hits.slice(0,8).map(h=>({label:h.label,w:h.w})),tags:p.tags,proofs:[...p.proofs],sim:p.sim,simNames:p.simNames,tgN:p.tg.size,promising:p.promising,also:p.also,oldInfo:p.oldInfo,benOk:p.benOk,top:slim(p.top),images:imgsOf(p),
  sellers:p.sellers.slice(0,12).map(s=>({pid:s.pid||'',name:s.name,host:s.host,copies:s.copies,p:s.p})),
  recs:recs.map(r=>({a:slim(r.a),age:r.age,cat:r.cat,range:r.range,score:r.score,note:r.note,ev:r.ev,raw:r.raw,promising:r.promising})),refIndex:ri,note:'',saved_at:Date.now(),lib:p.top.library_url,link:p.top.link_url,excl:p.excl,market:p.market||'',markets:p.markets||[],cur:p.cur||'',prDzd:p.prDzd||0,seasTag:p.seasTag||''}}
function hydrate(s){if(s.v===2){s.ref=s.recs[s.refIndex]||s.recs[0]||null;return s}
 return{name:s.name||'',kw:s.kw||'',cat:s.tier||'low',score:s.score||0,n:s.n||0,copies:0,pr:s.price||0,days:s.days||0,pages:'',why:[],stopped:0,counted:[],hits:[],trend:'steady',
  top:{library_url:s.lib,link_url:s.link},images:[],sellers:[],recs:[],ref:null,excl:false,saved_at:s.date}}
function counts(){const c={trial:0,gem:0,fire:0,old:0,low:0,excl:0};PROD.forEach(p=>c[p.cat]++);c.products=new Set(PROD.map(p=>p.k.split('#')[0])).size;c.ads=ALL.length;c.active=PROD.reduce((s,p)=>s+p.counted.length,0);return c}

$('#d_strong').value=DEF.strong;$('#d_mid').value=DEF.normal;$('#d_brand').value=DEF.brands;$('#d_bulky').value=DEF.bulky;$('#d_fragile').value=DEF.fragile;
$('#file').addEventListener('change',e=>load([...e.target.files]));
['dragover','dragenter'].forEach(ev=>$('#drop').addEventListener(ev,e=>{e.preventDefault();$('#drop').classList.add('on')}));
['dragleave','drop'].forEach(ev=>$('#drop').addEventListener(ev,e=>{e.preventDefault();$('#drop').classList.remove('on')}));
$('#drop').addEventListener('drop',e=>load([...e.dataTransfer.files]));
R.querySelectorAll('.flt input,.flt select').forEach(el=>el.addEventListener('input',render));
/* سوق الملف وأسعار الصرف يعيدان التحليل */
$('#mkt')&&$('#mkt').addEventListener('change',()=>{if(ALL.length){analyze();setTimeout(()=>vpass().catch(()=>{}),300)}});
R.addEventListener('change',e=>{const i=e.target.closest('[data-rate]');if(!i)return;const r=myRates();r[i.dataset.rate]=+i.value||undefined;try{localStorage.setItem(RK,JSON.stringify(r))}catch(x){}if(ALL.length)analyze()});
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('button[data-t]');if(b){tab=b.dataset.t;render()}});
R.addEventListener('click',async e=>{
 const sv=e.target.closest('.save');if(sv){const k=sv.dataset.k;FAV.has(k)?FAV.delete(k):FAV.add(k);window.__onFav&&window.__onFav(k,FAV.has(k));render();return}
 const m=e.target.closest('.pc-media[data-imgs]');if(m){lbOpen(JSON.parse(m.dataset.imgs),0,m.dataset.saved==='1');return}
 const b=e.target.closest('[data-act]');if(!b)return;
 try{if(b.dataset.act==='dl'){await dlImg(b.dataset.img);T('بدأ تنزيل الصورة. ارفعها الآن في بحث الصورة على الموقع.')}
  if(b.dataset.act==='cp'){await cpImg(b.dataset.img);T('تم نسخ الصورة. افتح بحث الصورة على الموقع والصقها (Ctrl+V) أو ارفعها.')}}
 catch(x){T(x.message||'تعذّر تنفيذ العملية','err')}});
$('#lb').addEventListener('click',e=>{if(e.target.id==='lb'||e.target.closest('#lb-x'))lbClose();else if(e.target.closest('#lb-p')){LB.i=(LB.i+LB.l.length-1)%LB.l.length;lbShow()}else if(e.target.closest('#lb-nx')){LB.i=(LB.i+1)%LB.l.length;lbShow()}
 else if(e.target.closest('#lb-dl'))dlImg(LB.l[LB.i]).catch(x=>T(x.message,'err'))});
D.addEventListener('keydown',e=>{if($('#lb').hidden)return;if(e.key==='Escape')lbClose();if(e.key==='ArrowLeft'){LB.i=(LB.i+1)%LB.l.length;lbShow()}if(e.key==='ArrowRight'){LB.i=(LB.i+LB.l.length-1)%LB.l.length;lbShow()}});
$('#apply').addEventListener('click',analyze);
$('#more').addEventListener('click',()=>{shown+=60;draw()});
const HEAD=['التصنيف','الدرجة','المنتج','الاتجاه','عدد البائعين','أكبر نسخ لبائع','إعلانات نشطة','إعلانات متوقفة','عمر الإعلان المرجعي','السعر','العملة','السعر بالدينار (تقريبي)','السوق','الأسواق','أسباب الإقصاء','رابط الإعلان','رابط الصورة','رابط الفيديو'];
const rows=()=>[HEAD].concat(VIEW.map(p=>[CL[p.cat],p.excl?'':p.score,p.name,p.excl?'':TRL[p.trend],p.n,p.copies,p.counted.length,p.stopped,p.ref&&p.ref.age!=null?p.ref.age:'',p.pr||'',p.cur||'',p.prDzd||'',p.market?mkName(p.market):'',(p.markets||[]).map(mkName).join(' | '),p.why.join(' | '),p.top.library_url,imgsOf(p)[0]||'',(p.recs||[]).map(r=>r.a.video_url).find(ok)||'']));
$('#copy').addEventListener('click',async()=>{const tx=rows().map(r=>r.map(x=>String(x).replace(/[\t\r\n]+/g,' ')).join('\t')).join('\n');
 try{await navigator.clipboard.writeText(tx)}catch(e){const a=D.createElement('textarea');a.value=tx;D.body.appendChild(a);a.select();D.execCommand('copy');a.remove()}
 msg('تم نسخ '+VIEW.length+' منتجاً. الصقها في Excel أو Google Sheets.')});
$('#csv').addEventListener('click',()=>{const tx='\uFEFF'+rows().map(r=>r.map(x=>'"'+String(x).replace(/"/g,'""').replace(/[\r\n]+/g,' ')+'"').join(',')).join('\r\n');window.__dl('winning-products.csv',tx)});
fillMarkets();
window.WPR={sheetRows:()=>rows(),load,msg,PROD:()=>PROD,byKey:k=>PROD.find(p=>p.k===k),setFav:a=>{FAV=new Set(a)},snapshot,hydrate,cardHTML,counts,imgsOf};
})();
