(function(){
'use strict';
if(typeof document==='undefined')return;
const R=document.getElementById('wpr-app');if(!R)return;
const $=s=>R.querySelector(s),D=document,NF=Math.round;
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const MK=()=>window.RadarMarkets;
/* تتبع عمر الإعلان عبر الزمن (من كل عمليات الجمع السابقة) */
const TRK=new Map();
function trackOf(p){const ads=(p.ads||p.counted||[]).map(a=>TRK.get(String(a.ad_id))).filter(Boolean);if(!ads.length)return null;
 const f=Math.min(...ads.map(x=>x.f)),l=Math.max(...ads.map(x=>x.l)),n=Math.max(...ads.map(x=>x.n)),act=ads.filter(x=>x.a).length,span=Math.max(0,Math.round((l-f)/864e5));
 const ended=ads.filter(x=>!x.a&&x.e).map(x=>x.e),stop=act?0:(ended.length?Math.max(...ended):l);return{f,l,n,span,act,tot:ads.length,stop}}
const trackChip=p=>{const t=trackOf(p);if(!t||t.n<2)return'';return t.act?`<span class="tg soft" title="رُصد في ${t.n} أيام جمع مختلفة">📈 مستمر منذ ${t.span} يوماً من المتابعة · ${t.act} إعلان نشط</span>`:`<span class="tg bad" title="آخر رصد ${new Date(t.l).toLocaleDateString('ar-DZ')}">📉 توقف بعد ${Math.max(1,Math.round((t.stop-t.f)/864e5))} يوماً من المتابعة</span>`};
async function trackPass(){const ids=[...new Set(ALL.map(a=>String(a.ad_id||'')).filter(x=>x&&!TRK.has(x)))];if(!ids.length)return;
 for(let i=0;i<ids.length;i+=5000){try{const r=await fetch('/api/track',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ids:ids.slice(i,i+5000)})});if(!r.ok)return;const j=await r.json();for(const k in j)TRK.set(k,j[k])}catch(x){return}}
 if(PROD.some(p=>trackOf(p)))render()}
const flag=c=>/^[A-Z]{2}$/.test(c||'')?String.fromCodePoint(...[...c].map(x=>127397+x.charCodeAt())):'';
const mkName=c=>{const m=MK();return m&&m.COUNTRIES[c]?m.COUNTRIES[c].name:c};
const nf=n=>Number(n||0).toLocaleString('ar-DZ');
/* السعر بعملته + ما يعادله بالدينار */
const priceTxt=p=>{if(!p.pr)return'—';const m=MK(),c=p.cur||'DZD',sym=m?m.curSymbol(c):c;return nf(p.pr)+' '+sym+(c!=='DZD'&&p.prDzd?`<small style="display:block;font-weight:400">≈ ${nf(p.prDzd)} دج</small>`:'')};
/* سوق المنتج وكل الأسواق التي ظهر فيها */
const mkChip=p=>{const ms=(p.markets||[]).filter(Boolean),m=p.market||ms[0];if(!m)return'';return`<span class="tg soft" title="السوق الذي جاء منه المنتج">${flag(m)} ${esc(mkName(m))}</span>`+(ms.length>1?`<span class="tg" title="${esc(ms.map(mkName).join('، '))}">🌍 يظهر في ${ms.length} أسواق: ${ms.map(flag).join(' ')}</span>`:'')};
/* أسعار الصرف (تقريبية، قابلة للتعديل، تُحفظ في هذا المتصفح) */
const RK='wpr_rates_v1',myRates=()=>{try{return JSON.parse(localStorage.getItem(RK))||{}}catch(e){return{}}};
const CL={ended:'⏹️ توقف بعد نجاح',trial:'🧪 تحت التجربة',prom:'🌱 واعد',gem:'💎 جوهرة',maybe:'🔸 رابح محتمل',fire:'🔥 رابح',old:'🕰️ قديم في السوق',low:'ضعيف',excl:'🚫 مستبعد',watch:'👀 للمراقبة (قديم)',new:'🆕 جديد (قديم)'};
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

let LAST_L=null,LK='',LCACHE=null;
/* قائمة «سوق الملف» و«فلتر السوق» وأسعار الصرف */
function fillMarkets(){const m=MK();if(!m)return;const sel=$('#mkt');if(sel&&sel.options.length<2){sel.innerHTML='<option value="">تلقائي (من عمود الدولة في الملف)</option>'+Object.keys(m.COUNTRIES).filter(c=>c!=='ALL').map(c=>`<option value="${c}">${flag(c)} ${esc(m.COUNTRIES[c].name)}</option>`).join('')}
 const f=$('#fmk');if(f){const cur=f.value,ms=[...new Set(PROD.flatMap(p=>p.markets||[]))].filter(Boolean);f.innerHTML='<option value="">كل الأسواق</option>'+ms.map(c=>`<option value="${c}"${c===cur?' selected':''}>${flag(c)} ${esc(mkName(c))}</option>`).join('')}
 const rb=$('#rates');if(rb){const cs=[...new Set(PROD.map(p=>p.cur).filter(c=>c&&c!=='DZD'))],r=Object.assign({},m.RATES_DZD,myRates());rb.innerHTML=cs.length?cs.map(c=>`<label class="fl">1 ${esc(m.curSymbol(c))} (${c}) = ? دج<input type="number" step="any" min="0" data-rate="${c}" value="${r[c]||''}"></label>`).join(''):'<p class="sub">كل الأسعار بالدينار.</p>'}}
let RST=null;
async function load(files){RST=(files&&files[0]&&files[0].stats)||null;for(const k in VHI)delete VHI[k];msg('');let rows=[],lm=0;window.__busy&&window.__busy('ld','جارٍ قراءة الملف…');try{
 for(const f of files){lm=Math.max(lm,f.lastModified||0);if(Array.isArray(f.rows)){rows=rows.concat(f.rows);continue}   /* صفوف جاهزة من المنصة: بلا تحويل إلى ملف ثم قراءته */
  try{rows=rows.concat(await readFile(f))}catch(e){msg('تعذّرت قراءة الملف '+f.name+'. تأكد أنه JSON أو Excel أو CSV سليم.',1)}}
 const seen=new Set();ALL=[];
 rows.filter(r=>r&&typeof r==='object').map(CORE.normRow).forEach(a=>{if(!(a.body||a.link_url||a.title))return;const k=a.ad_id||a.library_url||a.body.slice(0,80)+a.page_name;if(seen.has(k))return;seen.add(k);ALL.push(a)});
 if(!ALL.length){msg('لم أجد إعلانات في الملف. تحقق من أسماء الأعمدة (مثل body و link_url و start_date).',1);return}
 const cd=ALL.map(a=>a.collected).filter(Boolean).map(Number);
 NOW=cd.length?Math.max(...cd):(lm||Date.now());   // تاريخ جمع البيانات
}finally{window.__busy&&window.__busy('ld')}
 await analyze();$('#app').hidden=false;window.__onLoaded&&window.__onLoaded(files.map(f=>f.name),rows);trackPass().catch(()=>{})}

/* التحليل في خيط خلفي للملفات الكبيرة (الصفحة لا تتجمد)، ومباشرة للصغيرة أو إن تعذّر الخيط */
let WK=null,WKN=0;const WKW=new Map();
function worker(){if(WK!==null)return WK;try{WK=new Worker('/engine-worker.js'+(window.__V?'?v='+window.__V:''));WK.onmessage=e=>{const f=WKW.get(e.data.id);if(f){WKW.delete(e.data.id);f(e.data)}};WK.onerror=()=>{WK=false;WKW.forEach(f=>f({error:'worker'}));WKW.clear()}}catch(x){WK=false}return WK}
const VHI={};   /* بصمة الصورة: رقم الإعلان في ALL → مجموعة الدمج */
async function analyze(){
 const MKT=window.RadarMarkets,mg=t=>MKT?', '+MKT.goldText(t):'';   /* الفائدة تُقرأ أيضاً بلغات الأسواق الدولية */
 const src={strong:$('#d_strong').value+mg('strong'),normal:$('#d_mid').value+mg('normal'),brands:$('#d_brand').value,ignore:FIX.ignore||[],allowPages:FIX.allowPages||[],group:false},lk=JSON.stringify(src);
 if(lk!==LK)ALL.forEach(a=>{delete a._pc});   /* التصحيحات تغيّرت: يُعاد فحص الصلاحية */
 const market=($('#mkt')||{}).value||'',rates=Object.assign({},MK()?MK().RATES_DZD:{},myRates());
 ALL.forEach((a,i)=>{a._i=i;if(VHI[i])a._vh=VHI[i]});
 window.__busy&&window.__busy('an','جارٍ التحليل…');
 try{
  let done=false;const w=ALL.length>=1500&&worker();
  if(w){const r=await new Promise(ok=>{const id=++WKN;WKW.set(id,ok);w.postMessage({id,rows:ALL,NOW,src,market,rates,vh:VHI})});if(!r.error){PROD=r.P;done=true}}
  if(!done){/* الأداء: القوائم تُبنى مرة واحدة ما لم تتغير الإعدادات */if(LK!==lk){LK=lk;LCACHE=CORE.buildLists(src)}PROD=CORE.analyze(ALL,NOW,Object.assign({},LCACHE,{market,rates}))}
 }finally{window.__busy&&window.__busy('an')}
 LAST_L={market,rates};fillMarkets();markDups();
 const kw=new Set(ALL.map(a=>a.search).filter(Boolean)).size,ds=Math.floor((Date.now()-NOW)/864e5);
 $('#note').innerHTML=`<div class="alert info">تاريخ جمع البيانات: ${fd(NOW)}، وتُقاس أعمار الإعلانات منه.${ds>3?` مرّ على الجمع ${ds} أيام، فقد تكون الأعمار والحالات متقادمة، والأفضل إعادة جمع البيانات.`:''}</div>`+
  '';
 render()}

/* أرقام أعلى صفحة التحليل: كل إعلان وكل منتج يُعد مرة واحدة */
function sumStats(){const U=new Map();PROD.forEach(p=>{if(!U.has(p.ads))U.set(p.ads,p)});const ps=[...U.values()],ok=ps.filter(p=>!p.excl);
 const inAds=ok.flatMap(p=>p.ads),exclAds=ps.filter(p=>p.excl).flatMap(p=>p.ads),pre=exclAds.filter(a=>a.pre_excl).length;
 const pg=new Set(inAds.map(a=>CORE.N(a.page_name||'').trim()||'#'+(a.page_id||'')).filter(x=>x&&x!=='#'));   /* البائع = اسم صفحة الإعلان */
 return{observed:RST&&RST.observed?RST.observed:null,searches:RST&&RST.searches||0,fetched:ALL.length,analyzed:inAds.length,excluded:exclAds.length,
  excl_detail:`عند الاستقبال (ليست منتجات): ${pre} · في التحليل (علامة رسمية/ليس منتجاً/متوقف): ${exclAds.length-pre}`,sellers:pg.size}}
/* استبعاد المكرر: نسخ متطابقة للإعلان الواحد من نفس الصفحة تُجمع، وتبقى الأقدم (دليل المدة) مع «+N نسخ مطابقة» */
function markDups(){const ps=PROD.filter(p=>!p.excl),par=ps.map((_,i)=>i),f=i=>{while(par[i]!==i){par[i]=par[par[i]];i=par[i]}return i},B=new Map();
 PROD.forEach(p=>{p.dupOf=null;p.dupN=0});
 ps.forEach((p,i)=>CORE.dupKeys(p.top||p.ads[0]).forEach(k=>{const j=B.get(k);if(j===undefined)B.set(k,i);else{const x=f(i),y=f(j);if(x!==y)par[x]=y}}));
 const G=new Map();ps.forEach((p,i)=>{const r=f(i);if(!G.has(r))G.set(r,[]);G.get(r).push(p)});
 G.forEach(g=>{if(g.length<2)return;g.sort((a,b)=>(b.days||0)-(a.days||0)||String((a.top||{}).ad_id).localeCompare(String((b.top||{}).ad_id)));const rep=g[0];rep.dupN=g.length-1;g.slice(1).forEach(p=>p.dupOf=rep.k)})}
function render(){shown=60;const v=id=>($('#'+id)||{}).value||'',ck=id=>!!($('#'+id)||{}).checked;
 const q=CORE.N(v('q')).trim(),md=+v('minDays')||0,pmin=+v('pmin')||0,pmax=+v('pmax')||1e12,fm=v('fmt');
 const dd=ck('dd'),B0=PROD.filter(p=>!dd||!p.dupOf),hid=PROD.length-B0.length,B=B0.filter(p=>p.days>=md&&(!fm||p.fmt===fm)&&(!q||p.q.includes(q))&&(!(v('pmin')||v('pmax'))||(p.prDzd&&p.prDzd>=pmin&&p.prDzd<=pmax))&&(!$('#fmk')||!v('fmk')||(p.markets||[]).includes(v('fmk')))&&(!ck('cb')||p.benOk)&&(!ck('cs')||!p.seas));
 const cnt={all:0,ended:0,trial:0,prom:0,maybe:0,gem:0,fire:0,old:0,low:0,excl:0,fav:0,watch:0,new:0};B.forEach(p=>{cnt[p.cat]++;cnt.all++;if(FAV.has(p.k))cnt.fav++});
 const dn=$('#dupn');if(dn)dn.textContent=dd&&hid?'أُخفيت '+hid+' نسخة مكررة':'';
 R.querySelectorAll('#tabs button').forEach(b=>{b.querySelector('b').textContent=cnt[b.dataset.t];b.classList.toggle('on',b.dataset.t===tab)});
 VIEW=B.filter(p=>tab==='all'?true:tab==='fav'?FAV.has(p.k):p.cat===tab);
 const so=v('sort'),tk=p=>{const t=trackOf(p);return t?(t.act?t.n:-1):0};   /* المتابعة: رُصد نشطاً في أيام جمع أكثر = أوثق */
 VIEW.sort((a,b)=>so==='days'?b.days-a.days:so==='new'?a.days-b.days:a.rank-b.rank||(b.ben||0)-(a.ben||0)||tk(b)-tk(a)||(b.days||0)-(a.days||0));
 const S=sumStats(),nf=x=>x==null?'—':Number(x).toLocaleString('ar-DZ');
 $('#sum').innerHTML=[[S.observed,'الإعلانات المرصودة',S.observed==null?'العدد الذي تعرضه مكتبة ميتا أعلى نتائج البحث («~220 نتيجة»). يظهر للدفعات التي جُمعت بالإضافة 1.6 فأحدث: حدّث الإضافة وأعد الجمع':'مجموع ما عرضته مكتبة ميتا أعلى نتائج '+S.searches+' بحث («~N نتيجة»)'],
  [S.fetched,'الإعلانات التي تم جلبها','كل إعلان مختلف وصل من الإضافة (بلا تكرار) = «الكل» = دخلت التحليل + المستبعدة'],[S.analyzed,'دخلت التحليل','إعلانات نشطة غير مستبعدة، كل منها في تصنيف عمره'],
  [S.excluded,'الإعلانات المستبعدة',S.excl_detail+' · تظهر في تبويب «مستبعد»'],[S.sellers,'عدد البائعين','أسماء صفحات مختلفة في الإعلانات التي دخلت التحليل']]
  .map(x=>`<div class="kpi" title="${esc(x[2]||'')}"><b>${nf(x[0])}</b><span>${x[1]}</span></div>`).join('');
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
function evTable(r){if(r.coef!==undefined)return evTableOld(r);if(r.ev&&r.ev.some(e=>e.w))return'';   /* نسخ محفوظة بالمعايير القديمة */
 return `<table class="tb"><tr><th>المعيار</th><th>القيمة</th></tr>${r.ev.map(e=>`<tr><td>${e.name}</td><td>${e.present?'✓ ':''}${esc(e.val||'')}${e.tag?' <small>('+esc(e.tag)+')</small>':''}</td></tr>`).join('')}</table>`}
function evTableOld(r){return `<table class="tb"><tr><th>الدليل</th><th>الوزن</th><th>حاضر</th><th>الدرجة</th><th>النقاط</th></tr>${r.ev.map(e=>`<tr><td>${e.name}${e.half?' <small>(نصف الدرجة: لا دليل آخر)</small>':''}</td><td>${e.w}</td><td>${e.present?'✓':'—'}</td><td>${NF(e.pct*100)}%</td><td>${Math.round(e.pts*10)/10}</td></tr>`).join('')}<tr class="ft"><td colspan="2">الأدلة الحاضرة ك = ${r.k}</td><td colspan="2">معامل التضافر ${r.coef.toFixed(2)}</td><td>${Math.round(r.raw*10)/10} × ${r.coef.toFixed(2)} = <b>${r.score}</b></td></tr></table>`}
function adsTable(p,saved){const rs=[...(p.recs||[])].sort((a,b)=>(a.age==null)-(b.age==null)||a.age-b.age).slice(0,20);if(!rs.length)return'';
 const L=(u,t)=>ok(u)?`<a href="${esc(u)}" target="_blank" rel="noopener">${t}</a>`:'';
 const th=u=>ok(u)?`<a href="${esc(u)}" target="_blank" rel="noopener"><img class="th" loading="lazy" referrerpolicy="no-referrer" alt="" src="${esc(saved?'/api/img?u='+encodeURIComponent(u):u)}" data-o="${esc(u)}" onerror="if(!this.dataset.p&&!${saved?1:0}){this.dataset.p=1;this.src='/api/img?u='+encodeURIComponent(this.dataset.o)}else{this.remove()}"></a>`:'';
 return `<table class="tb"><tr><th>صورة</th><th>عمر الإعلان</th><th>الفئة</th><th>الحالة</th><th>الروابط</th></tr>${rs.map(r=>`<tr><td>${th(r.a.image_url)}</td><td>${r.age==null?'بلا تاريخ':r.age+' يوم'}</td><td>${CL[r.cat]||r.cat}${r.range?' · '+r.range:''}</td><td>${r.a.stat==='active'?'نشط':'بلا حالة'}</td><td>${[L(r.a.library_url,'الإعلان'),L(r.a.image_url,'الصورة'),L(r.a.video_url,'الفيديو')].filter(Boolean).join(' · ')}</td></tr>`).join('')}</table>${p.recs.length>20?`<p class="sub">يعرض أحدث 20 من ${p.recs.length} إعلاناً.</p>`:''}${p.stopped?`<p class="sub">${p.stopped} إعلان متوقف لا يدخل التحليل ولا العدّ، ويُستعمل في قياس الاتجاه فقط.</p>`:''}`}
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
<div class="pc-top"><span class="bdg cat-${p.cat}">${CL[p.cat]||p.cat}</span></div>
<div class="pc-body"><h3 class="pc-ti">${esc(p.name)}</h3><p class="pc-sub">${esc(p.pages||'')}</p>
<div class="pc-tags">${p.excl?'':`${r&&r.ev&&r.ev[0]&&r.ev[0].tag?`<span class="tg">${r.ev[0].tag}</span>`:''}${p.dupN&&($('#dd')||{}).checked?`<span class="tg" title="نسخ من نفس الصفحة بنفس الصورة أو النص أو مجموعة ميتا، أُخفيت وبقيت هذه (الأقدم)">+${p.dupN} نسخ مطابقة</span>`:''}${p.warn?`<span class="tg warn">${esc(p.warn)}</span>`:''}${p.warn2?`<span class="tg warn">${esc(p.warn2)}</span>`:''}`}${p.also&&p.also.length?`<span class="tg">له نسخ أيضاً في: ${p.also.map(c=>CL[c]).join('، ')}</span>`:''}${p.mktTag?`<span class="tg">🔗 يحوّل إلى ${esc(p.mktTag)}</span>`:''}${mkChip(p)}${trackChip(p)}${p.seas?`<span class="tg">موسمي${p.seasTag?': '+esc(p.seasTag):''}</span>`:''}${notes}</div>
<div class="pc-st"><div><b>${(p.counted||[]).length?'نشط':'متوقف'}</b><span>الحالة</span></div><div><b>${r&&r.age!=null?r.age:'—'}</b><span>عمر (يوم)</span></div><div><b>${pr}</b><span>السعر</span></div></div>
${saved?`<label class="fl">الكلمة الدلالية للبحث<input dir="auto" data-f="kw" data-k="${esc(o.k)}" value="${esc(kw)}" placeholder="مثال: قلم التلوين السحري"></label>`:(kw?`<div class="pc-kw">🔑 الكلمة الدلالية: <b>${esc(kw)}</b></div>`:'')}
<div class="pc-ch">${p.excl?(p.why||[]).map(x=>`<span class="tg bad">${esc(x)}</span>`).join('')+(p.fix&&(p.fix.terms.length||p.fix.pages.length)?`<button class="btn ghost sm" data-fix="${esc(p.k)}" title="أعد هذا المنتج ولا تستبعد بهذا السبب مستقبلاً">↩️ سبب خاطئ</button>`:''):(p.hits||[]).slice(0,6).map(x=>`<span class="tg soft">🟢 ${esc(x.label)}</span>`).join('')}</div>
${srcBox(p,kw,imgs)}
<details class="pc-more" data-lz="${lzPut(()=>`${p.excl||!r?'':`<h4>الإعلان المرجعي</h4>${evTable(r)}`}<h4>إعلانات المنتج، كلٌّ بتصنيفه</h4>${adsTable(p,saved)}
<h4>الصفحات المعلِنة</h4><table class="tb"><tr><th>الصفحة</th><th>المتجر</th><th>السعر</th><th></th></tr>${(p.sellers||[]).slice(0,12).map(s=>`<tr><td>${esc(s.name)}</td><td>${esc(s.host)}</td><td>${s.p||'—'}</td><td>${/^\d{5,}$/.test(s.pid||'')?`<button class="btn ghost sm" data-tool="watch" data-pid="${esc(s.pid)}" data-name="${esc(s.name)}" title="راقب إعلانات هذه الصفحة">👁 راقب</button>`:''}</td></tr>`).join('')}</table>`)}"><summary>${p.excl||!r?'الإعلانات والصفحات':'المعايير والإعلانات والصفحات'}</summary><p class="sub">…</p></details>
<div class="pc-lk">${[['library_url','الإعلان'],['link_url','المتجر'],['video_url','الفيديو']].map(([f,l])=>{const u=lk(f);return ok(u)?`<a class="lk" href="${esc(u)}" target="_blank" rel="noopener">${l} ↗</a>`:''}).join('')}${ok(im)?`<a class="lk" href="${esc(im)}" target="_blank" rel="noopener">الصورة ↗</a>`:''}</div>
${saved?`<label class="fl">ملاحظتي<textarea data-f="note" data-k="${esc(o.k)}" rows="2" placeholder="ملاحظاتك على المنتج">${esc(o.note||'')}</textarea></label><div class="pc-act pc-g"><span class="sub full">نسخة محفوظة بتاريخ ${fd(o.at||Date.now())}</span><button class="btn ghost sm" data-tool="sup" data-k="${esc(saved?o.k:p.k)}" data-sv="${saved?1:0}" title="ابحث عن هذا المنتج في الأسواق الصينية وقارن بالصورة">🏭 المورّد</button><button class="btn ghost sm" data-tool="ai" data-k="${esc(saved?o.k:p.k)}" data-sv="${saved?1:0}" title="زاوية البيع والجمهور ونص إعلان جزائري">🧠 تحليل الإعلان</button><button class="btn ghost sm" data-tool="profit" data-k="${esc(saved?o.k:p.k)}" data-sv="${saved?1:0}" title="هل يربح بعد الإعلان والتأكيد والتسليم والمرتجعات؟">💰 حاسبة الربح</button><button class="btn sm w" data-a="togap" data-id="${esc(o.k)}" title="هل يُباع في الجزائر؟">🎯 افحص في الجزائر</button><button class="btn danger sm w" data-a="unsave" data-id="${esc(o.k)}">إزالة من المحفوظات</button></div>`
:`<div class="pc-act pc-g"><button class="btn ghost sm" data-tool="sup" data-k="${esc(saved?o.k:p.k)}" data-sv="${saved?1:0}" title="ابحث عن هذا المنتج في الأسواق الصينية وقارن بالصورة">🏭 المورّد</button><button class="btn ghost sm" data-tool="ai" data-k="${esc(saved?o.k:p.k)}" data-sv="${saved?1:0}" title="زاوية البيع والجمهور ونص إعلان جزائري">🧠 تحليل الإعلان</button><button class="btn ghost sm" data-tool="profit" data-k="${esc(saved?o.k:p.k)}" data-sv="${saved?1:0}" title="هل يربح بعد الإعلان والتأكيد والتسليم والمرتجعات؟">💰 حاسبة الربح</button><button class="btn ${FAV.has(p.k)?'':'ghost'} sm save full" data-k="${esc(p.k)}">${FAV.has(p.k)?'★ محفوظ':'☆ حفظ المنتج'}</button></div>`}</div></article>`}
const card=p=>cardHTML(p);
function draw(){const s=VIEW.slice(0,shown);$('#grid').innerHTML=s.length?s.map(card).join(''):'<div class="empty">لا توجد منتجات في هذا التبويب بهذه الفلاتر. خفّف شرطاً أو أكثر.</div>';$('#more').hidden=VIEW.length<=shown}
/* ---------- نسخة المنتج المحفوظة كما هي ---------- */
const slim=a=>({title:a.title,body:String(a.body||'').slice(0,700).replace(/[\uD800-\uDBFF]$/,''),page_name:a.page_name,page_id:a.page_id,library_url:a.library_url,link_url:a.link_url,image_url:a.image_url,video_url:a.video_url,format:a.format,start_date:a.start_date,stat:a.stat,domain:a.domain,ad_id:a.ad_id});
function snapshot(p){const recs=p.recs.slice(0,30),ri=Math.max(0,recs.indexOf(p.ref));
 return{v:2,name:p.name,kw:p.kw||'',cat:p.cat,tier:p.cat,score:p.score,days:p.days,trend:p.trend,seas:p.seas,n:p.n,copies:p.copies,pr:p.pr,price:p.pr,pages:p.pages,why:p.why,stopped:p.stopped,fmt:p.fmt,
  counted:new Array(p.counted.length).fill(0),hits:p.hits.slice(0,8).map(h=>({label:h.label,w:h.w})),tags:p.tags,proofs:[...p.proofs],sim:p.sim,simNames:p.simNames,tgN:p.tg.size,promising:p.promising,also:p.also,oldInfo:p.oldInfo,benOk:p.benOk,top:slim(p.top),images:imgsOf(p),
  sellers:p.sellers.slice(0,12).map(s=>({pid:s.pid||'',name:s.name,host:s.host,copies:s.copies,p:s.p})),
  recs:recs.map(r=>({a:slim(r.a),age:r.age,cat:r.cat,range:r.range,score:r.score,note:r.note,ev:r.ev,raw:r.raw,promising:r.promising,miss:r.miss})),refIndex:ri,note:'',saved_at:Date.now(),lib:p.top.library_url,link:p.top.link_url,excl:p.excl,market:p.market||'',markets:p.markets||[],cur:p.cur||'',prDzd:p.prDzd||0,seasTag:p.seasTag||'',mktTag:p.mktTag||'',ben:p.ben||0,warn:p.warn||'',warn2:p.warn2||''}}
function hydrate(s){if(s.v===2){s.ref=s.recs[s.refIndex]||s.recs[0]||null;return s}
 return{name:s.name||'',kw:s.kw||'',cat:s.tier||'low',score:s.score||0,n:s.n||0,copies:0,pr:s.price||0,days:s.days||0,pages:'',why:[],stopped:0,counted:[],hits:[],trend:'steady',
  top:{library_url:s.lib,link_url:s.link},images:[],sellers:[],recs:[],ref:null,excl:false,saved_at:s.date}}
function counts(){const c={ended:0,trial:0,prom:0,maybe:0,gem:0,fire:0,old:0,low:0,excl:0};PROD.forEach(p=>c[p.cat]++);const S=sumStats();c.products=S.analyzed;c.ads=ALL.length;c.active=S.analyzed;c.sellers=S.sellers;c.observed=S.observed;c.excluded=S.excluded;return c}

$('#d_strong').value=DEF.strong;$('#d_mid').value=DEF.normal;$('#d_brand').value=DEF.brands;
$('#file').addEventListener('change',e=>load([...e.target.files]));
['dragover','dragenter'].forEach(ev=>$('#drop').addEventListener(ev,e=>{e.preventDefault();$('#drop').classList.add('on')}));
['dragleave','drop'].forEach(ev=>$('#drop').addEventListener(ev,e=>{e.preventDefault();$('#drop').classList.remove('on')}));
$('#drop').addEventListener('drop',e=>load([...e.dataTransfer.files]));
R.querySelectorAll('.flt input,.flt select').forEach(el=>el.addEventListener('input',render));
/* سوق الملف وأسعار الصرف يعيدان التحليل */
$('#mkt')&&$('#mkt').addEventListener('change',()=>{if(ALL.length){analyze()}});
R.addEventListener('change',e=>{const i=e.target.closest('[data-rate]');if(!i)return;const r=myRates();r[i.dataset.rate]=+i.value||undefined;try{localStorage.setItem(RK,JSON.stringify(r))}catch(x){}if(ALL.length)analyze()});
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('button[data-t]');if(b){tab=b.dataset.t;render()}});
let FIX={ignore:[],allowPages:[]};
function drawFix(){const el=$('#d_fix');if(!el)return;const ig=FIX.ignore||[],ap=FIX.allowPages||[];
 el.innerHTML=ig.length||ap.length?'<b>تصحيحاتك («سبب خاطئ»)</b><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">'+ig.map(w=>`<button type="button" class="btn ghost sm" data-unfix="${esc(w)}" title="تراجع: عُد للاستبعاد بهذه الكلمة">${esc(w)} ✕</button>`).join('')+(ap.length?`<button type="button" class="btn ghost sm" data-unfix-pages="1" title="تراجع عن السماح الدائم">${ap.length} صفحة مسموح بها ✕</button>`:'')+'</div>':''}
fetch('/api/lib/fix').then(r=>r.ok?r.json():null).then(j=>{if(j){FIX=j;drawFix()}}).catch(()=>{});
document.addEventListener('click',async e=>{const u=e.target.closest('[data-unfix],[data-unfix-pages]');if(!u)return;
 try{if(u.dataset.unfixPages){await fetch('/api/lib/allow-pages',{method:'DELETE'});FIX.allowPages=[]}else{const r=await fetch('/api/lib/fix',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({unignore:[u.dataset.unfix]})});FIX=await r.json()}
  drawFix();T('تم التراجع. أعد التحليل لتطبيقه.')}catch(x){T('تعذّر التراجع','err')}});
R.addEventListener('click',async e=>{
 const fx=e.target.closest('[data-fix]');if(fx){const p=PROD.find(x=>x.k===fx.dataset.fix);if(!p||!p.fix)return;
  const t=p.fix.terms||[],pg=p.fix.pages||[],msg=t.length?'لن تُستبعد المنتجات بعد الآن بسبب: «'+t.join('، ')+'».':'ستُقبل إعلانات صفحة هذا المنتج دائماً.';
  if(!confirm('سبب خاطئ؟\n'+msg+'\nيمكن التراجع من «إعدادات التحليل».'))return;
  try{const r=await fetch('/api/lib/fix',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(t.length?{ignore:t}:{allowPages:pg})});if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||'تعذّر الحفظ');
   FIX=await r.json();drawFix();T('تم التصحيح، وأُعيد التحليل');analyze()}catch(x){T(x.message,'err')}return}
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
const HEAD=['التصنيف','الفائدة','المنتج','إعلانات نشطة','إعلانات متوقفة','عمر الإعلان المرجعي','السعر','العملة','السعر بالدينار (تقريبي)','السوق','الأسواق','أسباب الإقصاء','رابط الإعلان','رابط الصورة','رابط الفيديو'];
const rows=()=>[HEAD].concat(VIEW.map(p=>[CL[p.cat]||p.cat,p.excl?'':['لا','في النص','في العنوان'][p.ben||0],p.name,p.counted.length,p.stopped,p.ref&&p.ref.age!=null?p.ref.age:'',p.pr||'',p.cur||'',p.prDzd||'',p.market?mkName(p.market):'',(p.markets||[]).map(mkName).join(' | '),p.why.join(' | '),p.top.library_url,imgsOf(p)[0]||'',(p.recs||[]).map(r=>r.a.video_url).find(ok)||'']));
$('#copy').addEventListener('click',async()=>{const tx=rows().map(r=>r.map(x=>String(x).replace(/[\t\r\n]+/g,' ')).join('\t')).join('\n');
 try{await navigator.clipboard.writeText(tx)}catch(e){const a=D.createElement('textarea');a.value=tx;D.body.appendChild(a);a.select();D.execCommand('copy');a.remove()}
 msg('تم نسخ '+VIEW.length+' منتجاً. الصقها في Excel أو Google Sheets.')});
$('#csv').addEventListener('click',()=>{const tx='\uFEFF'+rows().map(r=>r.map(x=>'"'+String(x).replace(/"/g,'""').replace(/[\r\n]+/g,' ')+'"').join(',')).join('\r\n');window.__dl('winning-products.csv',tx)});
fillMarkets();
window.WPR={fix:()=>FIX,setFix:f=>{FIX=f;LK=null},sheetRows:()=>rows(),load,msg,PROD:()=>PROD,byKey:k=>PROD.find(p=>p.k===k),setFav:a=>{FAV=new Set(a)},snapshot,hydrate,cardHTML,counts,imgsOf};
})();
