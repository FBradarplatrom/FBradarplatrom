# يولّد dicts.js: القوائم حرفياً من المعايير + الصيغ المضافة (مخاطب/مؤنث، مصدر، اسم فاعل) للفصحى فقط
def L(s): return [x.strip() for x in s.replace('،',',').replace('\n',',').split(',') if x.strip()]

MSA_STRONG="يحل، يقضي على، يزيل، يمنع، يمنع من، يحمي، يحمي من، يصلح، يساعد، يساعد على، يخفف، يخفف من، يوقف، يكافح"
MSA_NORMAL="تفادي، يحسن، يصحح، يسهل، يوفر عليك، يوفر، ينظف، يهدئ، يريح، ينذر، يكشف، ينبه، يراقب، يتتبع، يقيس، يسد، يسرب، يفك، يقطع، يجفف، يقشر، يشد، يضيق، يرطب، يقوي، يحرق، يبيض، يجمل، يلمع، يضاعف، ينمي، يطور، يبني، يسرع، يبطئ، يحفظ، يحافظ على، ينظم، يخزن، يطوي، بدون حاجة، يلغي، يطرد، يسقي، يقلم، يسخن، يضيء، يفيد"
MSA_WEAK="يعطي، يجعل، يقوم، يجد، يفتح، يناسب، يعلم، يشغل، يشحن، يزيد، يضعف، يجهد، يرافق، يربط، يغطي، يخلط"
EXTRA={ # مصدر / اسم فاعل مضافان
 'يحل':'حل','يقضي على':'قضاء على/قاضي على','يزيل':'إزالة/مزيل','يمنع':'منع/مانع','يمنع من':'منع من/مانع من',
 'يحمي':'حماية/حامي','يحمي من':'حماية من/حامي من','يصلح':'إصلاح/تصليح/مصلح','يساعد':'مساعدة/مساعد',
 'يساعد على':'مساعدة على/مساعد على','يخفف':'تخفيف/مخفف','يخفف من':'تخفيف من/مخفف من','يوقف':'إيقاف','يكافح':'مكافحة/مكافح',
 'يحسن':'تحسين/محسن','يصحح':'تصحيح/مصحح','يسهل':'تسهيل/مسهل','يوفر':'توفير/موفر','يوفر عليك':'توفير عليك',
 'ينظف':'تنظيف/منظف','يهدئ':'تهدئة/مهدئ','ينذر':'إنذار/منذر','يكشف':'كشف/كاشف','ينبه':'تنبيه/منبه',
 'يراقب':'مراقبة/مراقب','يجفف':'تجفيف/مجفف','يرطب':'ترطيب/مرطب','يقوي':'تقوية/مقوي','يبيض':'تبييض/مبيض',
 'يلمع':'تلميع/ملمع','ينمي':'تنمية/منمي','يسرع':'تسريع/مسرع','يحفظ':'حفظ/حافظ','يحافظ على':'محافظة على/محافظ على',
 'ينظم':'تنظيم/منظم','يخزن':'تخزين/مخزن','يطرد':'طرد/طارد','يسخن':'تسخين/مسخن','يضيء':'إضاءة/مضيء','يلغي':'إلغاء/ملغي'}
def expand(lst):
    out=[]
    for w in L(lst):
        alts=[w]
        if w.startswith('ي'): alts.append('ت'+w[1:])      # مخاطب / مؤنث
        if w in EXTRA: alts+=EXTRA[w].split('/')
        out.append('/'.join(alts))
    return ', '.join(out)

DAR_STRONG="تخلص من، وداعا، ودّع، الحل النهائي، حل نهائي، جبنالك الحل، يداوي، تصليح، يحبّس، تخلّص نهائياً"
DAR_NORMAL="عندك مشكل، راك تعاني، هل تعاني، تعاني من، تعبت من، راح تتهنى، نهائيا، يعاون، يسهّل عليك، ينحي، ينقص، بلا ما تحتاج، ما تحتاجش، ما تبقاش، ما تزيدش، طريقة سهلة، ساهل الاستعمال، متعدد الاستعمالات"
FR_STRONG="résout/résoudre, élimine/éliminer, supprime/supprimer, empêche/empêcher, protège/protéger, répare/réparer, soulage/soulager, aide à, réduit/réduire, stoppe/arrête, lutte contre, solution définitive, dites adieu à, débarrassez-vous de, en finir avec, stop à"
FR_NORMAL="évite, améliore, corrige, facilite, simplifie, économise, fait gagner du temps, nettoie, apaise, détecte, alerte, surveille, mesure, sèche, hydrate, renforce, éclaire, range, protège contre, conserve, organise, remplace, vous souffrez de, souffrez-vous de, marre de, fatigué de, vous avez un problème, on a la solution, voici la solution, définitivement, adieu, plus besoin de, sans avoir besoin de, ne plus avoir à, fini les"
FR_WEAK="donne, rend, fait, permet, convient, ouvre, trouve, accompagne, connecte, mélange"
AZ_STRONG="y7el/yhel, y9dhi 3la/yqdi 3la, yzil/yzeel, ymna3/ymne3, y7mi/yahmi, ysal7/ysala7/ysli7, ysa3ed/ysa3d, ykhaffef/ykhafef, yw9ef/ywa9ef/y7bes, ykafe7/yka7ef, ydawi, jbnalek l7al/jibnalek el 7al, l7al nihai/7al nihai, t5alas men/tkhalas men/takhallas men, wada3/ouda3an, tasli7/tsli7"
AZ_NORMAL="rak t3ani/rak ta3ani, t3ani men, t3ebt men/ta3bt men, 3andek mochkil/andek mouchkil, rah tethana/ra7 tetheni, nihaiyan/nihayen, ysahel/ysahhel, ysahel 3lik, ywaffer/ywafer, ynaqqes/ynakes, yna7i, ma t7tajch/matahtajch, ma tb9ach/matebqach, ma tzidch/matzidch, bla ma t7taj, tari9a sahla, sahel l isti3mal, mouta3added listi3malat/multi usage"
BULKY="خزانة، خزائن، دولاب، دواليب، ثلاجة، ثلاجات، غسالة، غسالات، كنبة، كنبات، أريكة، أرائك، سرير، أسرّة، طاولة، طاولات، أثاث، مكيف، مكيفات, armoire, meuble, réfrigérateur, lave-linge, canapé, lit, table, climatiseur, khizana, dulab, thalaja, frigo, ghassala, kanaba, kanapé, sarir, tawla, meuble"
FRAGILE="زجاج، هش، قابل للكسر، خزف، سيراميك، بلور، مرآة, verre, fragile, céramique, cristal, miroir, zoujaj, zejaj, hech, fragile, 9abil lel kasr"
BRANDS="jumia, ouedkniss, temu, aliexpress, amazon"
J=lambda s: ', '.join(L(s))
import json
DEF={
 'strong': ', '.join([expand(MSA_STRONG),J(DAR_STRONG),J(FR_STRONG),J(AZ_STRONG)]),
 'normal': ', '.join([expand(MSA_NORMAL),J(DAR_NORMAL),J(FR_NORMAL),J(AZ_NORMAL)]),
 'weak':   ', '.join([expand(MSA_WEAK),J(FR_WEAK)]),
 'bulky':J(BULKY),'fragile':J(FRAGILE),'brands':J(BRANDS)}
open('dicts.js','w',encoding='utf8').write('const DEF='+json.dumps(DEF,ensure_ascii=False)+';\n')
print({k:len(L(v.replace('/',','))) for k,v in DEF.items()})
