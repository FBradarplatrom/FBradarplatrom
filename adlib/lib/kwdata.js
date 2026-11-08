// Radar – golden + complementary keywords of every international market, each with its Arabic meaning ("term=معنى").
// s = strong golden · n = normal golden · c = complementary keywords per niche (kids home beauty car pets sport travel phone fashion tools).
// The Arabic meaning is shown when hovering a foreign word (dictionary, bulk search, search preview).
// Arabic-script dialects (gulf, eg, ur) need no meaning. GLOSS_LEGACY = meanings of the Algerian French / Arabizi lists.
(function (root) {
  'use strict';
  const D = {
    en: {
      s: 'Helps=يساعد; Say goodbye to=وداعاً لـ; Get rid of=تخلّص من; No more=لا مزيد من; Eliminates=يقضي على; Prevents=يمنع; Protects=يحمي; Relieves=يخفف; Fixes=يصلح; Stops=يوقف; Removes=يزيل; Solves=يحل; Reduces=يقلل',
      n: 'Makes it easy=يسهّل; Saves time=يوفر الوقت; Keeps=يحافظ على; Cleans=ينظف; Organizes=ينظم; Perfect for=مثالي لـ; Must-have for=ضروري لـ; Game changer for=يغيّر قواعد اللعبة لـ; Tired of=تعبت من; Struggling with=تعاني من; Upgrade=طوّر; Instantly=فوراً; Life hack=حيلة ذكية',
      c: {
        kids: 'your child=طفلك; your baby=رضيعك; your kids=أطفالك; toddlers=الأطفال الصغار; newborn=المولود; moms=الأمهات; breastfeeding=الرضاعة',
        home: 'your kitchen=مطبخك; your home=بيتك; your bathroom=حمامك; laundry=الغسيل; cleaning=التنظيف; cooking=الطبخ; storage=التخزين',
        beauty: 'your skin=بشرتك; your hair=شعرك; your face=وجهك; your teeth=أسنانك; nails=الأظافر; wrinkles=التجاعيد; acne=حب الشباب; beard=اللحية',
        car: 'your car=سيارتك; car interior=داخل السيارة; driving=القيادة; windshield=الزجاج الأمامي; car seats=مقاعد السيارة',
        pets: 'your dog=كلبك; your cat=قطتك; pet hair=شعر الحيوانات; pets=الحيوانات الأليفة; cat litter=فضلات القطط',
        sport: 'back pain=ألم الظهر; posture=وضعية الجسم; your workout=تمرينك; muscles=العضلات; knee pain=ألم الركبة; fitness=اللياقة',
        travel: 'travel=السفر; your luggage=أمتعتك; suitcase=حقيبة السفر; road trips=الرحلات البرية; packing=ترتيب الحقيبة',
        phone: 'your phone=هاتفك; iPhone=آيفون; charging=الشحن; battery=البطارية; earbuds=السماعات',
        fashion: 'your outfit=إطلالتك; shoes=الأحذية; your watch=ساعتك; sunglasses=النظارات الشمسية; jewelry=المجوهرات; sneakers=الأحذية الرياضية',
        tools: 'repairs=الإصلاحات; leaks=التسربات; DIY=الأعمال اليدوية; drilling=الثقب; plumbing=السباكة; your garage=مرآبك'
      }
    },
    es: {
      s: 'Ayuda a=يساعد على; Adiós a=وداعاً لـ; Olvídate de=انسَ; Elimina=يزيل; Evita=يتجنب; Protege=يحمي; Alivia=يخفف; Repara=يصلح; Acaba con=يقضي على; Soluciona=يحل; Nunca más=لن يعود أبداً; Reduce=يقلل',
      n: 'Facilita=يسهّل; Ahorra tiempo=يوفر الوقت; Limpia=ينظف; Organiza=ينظم; Perfecto para=مثالي لـ; Imprescindible para=لا غنى عنه لـ; Cansado de=تعبت من; Sin esfuerzo=بلا مجهود; Mejora=يحسّن; Práctico para=عملي لـ',
      c: {
        kids: 'tu bebé=رضيعك; tu hijo=ابنك; los niños=الأطفال; bebés=الرضّع; mamás=الأمهات; recién nacido=المولود; lactancia=الرضاعة',
        home: 'tu cocina=مطبخك; tu casa=بيتك; el baño=الحمام; la limpieza=التنظيف; la ropa=الملابس; el orden=الترتيب',
        beauty: 'tu piel=بشرتك; tu cabello=شعرك; tu rostro=وجهك; tus dientes=أسنانك; las uñas=الأظافر; las arrugas=التجاعيد; el acné=حب الشباب',
        car: 'tu coche=سيارتك; tu carro=سيارتك; tu auto=سيارتك; el parabrisas=الزجاج الأمامي; los asientos=المقاعد',
        pets: 'tu perro=كلبك; tu gato=قطتك; tu mascota=حيوانك الأليف; pelos de mascota=شعر الحيوانات',
        sport: 'dolor de espalda=ألم الظهر; la postura=وضعية الجسم; tus músculos=عضلاتك; el entrenamiento=التمرين; dolor de rodilla=ألم الركبة',
        travel: 'tus viajes=رحلاتك; la maleta=حقيبة السفر; el equipaje=الأمتعة; viajar=السفر',
        phone: 'tu móvil=هاتفك; tu celular=هاتفك; el cargador=الشاحن; la batería=البطارية; los auriculares=السماعات',
        fashion: 'tus zapatos=حذاؤك; tu reloj=ساعتك; gafas de sol=نظارات شمسية; joyas=مجوهرات; tu bolso=حقيبة يدك',
        tools: 'reparaciones=إصلاحات; fugas=تسربات; bricolaje=أعمال يدوية; herramientas=أدوات; el taladro=المثقاب'
      }
    },
    pt: {
      s: 'Ajuda a=يساعد على; Diga adeus=قل وداعاً; Chega de=كفى من; Elimina=يزيل; Evita=يتجنب; Protege=يحمي; Alivia=يخفف; Acaba com=يقضي على; Resolve=يحل; Nunca mais=لن يعود أبداً; Reduz=يقلل',
      n: 'Facilita=يسهّل; Economiza tempo=يوفر الوقت; Limpa=ينظف; Organiza=ينظم; Perfeito para=مثالي لـ; Indispensável=لا غنى عنه; Cansado de=تعبت من; Sem esforço=بلا مجهود; Melhora=يحسّن; Prático=عملي',
      c: {
        kids: 'seu bebê=رضيعك; seu filho=ابنك; crianças=الأطفال; mamães=الأمهات; recém-nascido=المولود; amamentação=الرضاعة',
        home: 'sua cozinha=مطبخك; sua casa=بيتك; banheiro=الحمام; limpeza=التنظيف; roupas=الملابس; organização=الترتيب',
        beauty: 'sua pele=بشرتك; seu cabelo=شعرك; rosto=الوجه; dentes=الأسنان; unhas=الأظافر; rugas=التجاعيد; acne=حب الشباب',
        car: 'seu carro=سيارتك; carro=السيارة; para-brisa=الزجاج الأمامي; bancos do carro=مقاعد السيارة',
        pets: 'seu cachorro=كلبك; seu gato=قطتك; seu pet=حيوانك الأليف; pelos de pet=شعر الحيوانات',
        sport: 'dor nas costas=ألم الظهر; postura=وضعية الجسم; músculos=العضلات; treino=التمرين; dor no joelho=ألم الركبة',
        travel: 'viagem=السفر; mala=حقيبة السفر; bagagem=الأمتعة; viajar=أن تسافر',
        phone: 'seu celular=هاتفك; carregador=الشاحن; bateria=البطارية; fone de ouvido=السماعات',
        fashion: 'sapatos=أحذية; relógio=ساعة; óculos de sol=نظارات شمسية; joias=مجوهرات; bolsa=حقيبة يد',
        tools: 'reparos=إصلاحات; vazamentos=تسربات; ferramentas=أدوات; furadeira=مثقاب; faça você mesmo=اصنعها بنفسك'
      }
    },
    de: {
      s: 'Hilft=يساعد; Hilft bei=يساعد في; Schluss mit=كفى من; Nie wieder=لن يتكرر أبداً; Beseitigt=يقضي على; Entfernt=يزيل; Verhindert=يمنع; Schützt=يحمي; Lindert=يخفف; Repariert=يصلح; Reduziert=يقلل',
      n: 'Erleichtert=يسهّل; Spart Zeit=يوفر الوقت; Reinigt=ينظف; Organisiert=ينظم; Perfekt für=مثالي لـ; Praktisch für=عملي لـ; Genial für=رائع لـ; Ohne Aufwand=بلا مجهود; Verbessert=يحسّن',
      c: {
        kids: 'Ihr Kind=طفلك; dein Kind=طفلك; Baby=رضيع; Kinder=أطفال; Mamas=الأمهات; Neugeborene=المواليد; Stillen=الرضاعة',
        home: 'Küche=المطبخ; Zuhause=البيت; Badezimmer=الحمام; Haushalt=شؤون المنزل; Putzen=التنظيف; Wäsche=الغسيل',
        beauty: 'Haut=البشرة; Haare=الشعر; Gesicht=الوجه; Zähne=الأسنان; Nägel=الأظافر; Falten=التجاعيد; Pickel=الحبوب',
        car: 'Auto=السيارة; dein Auto=سيارتك; Windschutzscheibe=الزجاج الأمامي; Autositze=مقاعد السيارة',
        pets: 'Hund=كلب; Katze=قطة; Haustier=حيوان أليف; Tierhaare=شعر الحيوانات',
        sport: 'Rückenschmerzen=ألم الظهر; Haltung=وضعية الجسم; Muskeln=العضلات; Training=التمرين; Knieschmerzen=ألم الركبة',
        travel: 'Reisen=السفر; Koffer=حقيبة السفر; Gepäck=الأمتعة; Urlaub=العطلة',
        phone: 'Handy=الهاتف; Smartphone=الهاتف الذكي; Ladegerät=الشاحن; Akku=البطارية; Kopfhörer=السماعات',
        fashion: 'Schuhe=أحذية; Uhr=ساعة; Sonnenbrille=نظارة شمسية; Schmuck=مجوهرات; Tasche=حقيبة',
        tools: 'Reparaturen=إصلاحات; Werkzeug=أدوات; Heimwerker=الأعمال اليدوية; Bohren=الثقب; Lecks=التسربات'
      }
    },
    it: {
      s: 'Aiuta a=يساعد على; Dì addio=قل وداعاً; Basta con=كفى من; Mai più=لن يعود أبداً; Elimina=يزيل; Previene=يمنع; Protegge=يحمي; Allevia=يخفف; Ripara=يصلح; Riduce=يقلل',
      n: 'Facilita=يسهّل; Risparmia tempo=يوفر الوقت; Pulisce=ينظف; Organizza=ينظم; Perfetto per=مثالي لـ; Indispensabile=لا غنى عنه; Senza fatica=بلا تعب; Migliora=يحسّن; Pratico=عملي',
      c: {
        kids: 'tuo figlio=ابنك; il tuo bambino=طفلك; bambini=الأطفال; neonato=المولود; mamme=الأمهات; allattamento=الرضاعة',
        home: 'la cucina=المطبخ; casa=البيت; il bagno=الحمام; le pulizie=التنظيف; il bucato=الغسيل',
        beauty: 'la pelle=البشرة; i capelli=الشعر; il viso=الوجه; i denti=الأسنان; le unghie=الأظافر; le rughe=التجاعيد; acne=حب الشباب',
        car: 'la tua auto=سيارتك; auto=السيارة; parabrezza=الزجاج الأمامي; sedili=المقاعد',
        pets: 'il tuo cane=كلبك; il tuo gatto=قطتك; animali domestici=الحيوانات الأليفة; peli=الشعر',
        sport: 'mal di schiena=ألم الظهر; postura=وضعية الجسم; muscoli=العضلات; allenamento=التمرين; ginocchio=الركبة',
        travel: 'viaggio=السفر; valigia=حقيبة السفر; bagagli=الأمتعة; viaggiare=أن تسافر',
        phone: 'telefono=الهاتف; cellulare=الهاتف المحمول; caricatore=الشاحن; batteria=البطارية; auricolari=السماعات',
        fashion: 'scarpe=أحذية; orologio=ساعة; occhiali da sole=نظارات شمسية; gioielli=مجوهرات; borsa=حقيبة',
        tools: 'riparazioni=إصلاحات; attrezzi=أدوات; fai da te=اصنعها بنفسك; trapano=مثقاب; perdite=تسربات'
      }
    },
    nl: {
      s: 'Helpt=يساعد; Helpt bij=يساعد في; Zeg vaarwel tegen=قل وداعاً لـ; Nooit meer=لن يعود أبداً; Verwijdert=يزيل; Voorkomt=يمنع; Beschermt=يحمي; Verlicht=يخفف; Repareert=يصلح; Lost op=يحل; Vermindert=يقلل',
      n: 'Maakt het makkelijk=يسهّل; Bespaart tijd=يوفر الوقت; Reinigt=ينظف; Organiseert=ينظم; Perfect voor=مثالي لـ; Handig voor=مفيد لـ; Moe van=تعبت من; Zonder moeite=بلا مجهود; Verbetert=يحسّن',
      c: {
        kids: 'je kind=طفلك; je baby=رضيعك; kinderen=الأطفال; peuters=الأطفال الصغار; moeders=الأمهات; borstvoeding=الرضاعة',
        home: 'je keuken=مطبخك; je huis=بيتك; badkamer=الحمام; schoonmaken=التنظيف; was=الغسيل; opbergen=التخزين',
        beauty: 'je huid=بشرتك; je haar=شعرك; gezicht=الوجه; tanden=الأسنان; nagels=الأظافر; rimpels=التجاعيد; puistjes=الحبوب',
        car: 'je auto=سيارتك; auto=السيارة; voorruit=الزجاج الأمامي; autostoelen=مقاعد السيارة',
        pets: 'je hond=كلبك; je kat=قطتك; huisdieren=الحيوانات الأليفة; dierenhaar=شعر الحيوانات',
        sport: 'rugpijn=ألم الظهر; houding=وضعية الجسم; spieren=العضلات; training=التمرين; kniepijn=ألم الركبة',
        travel: 'reizen=السفر; koffer=حقيبة السفر; bagage=الأمتعة; vakantie=العطلة',
        phone: 'je telefoon=هاتفك; oplader=الشاحن; batterij=البطارية; oordopjes=السماعات',
        fashion: 'schoenen=أحذية; horloge=ساعة; zonnebril=نظارة شمسية; sieraden=مجوهرات; tas=حقيبة',
        tools: 'reparaties=إصلاحات; gereedschap=أدوات; klussen=أعمال يدوية; boren=الثقب; lekkages=تسربات'
      }
    },
    pl: {
      s: 'Pomaga=يساعد; Pożegnaj=ودّع; Pozbądź się=تخلّص من; Nigdy więcej=لن يعود أبداً; Usuwa=يزيل; Zapobiega=يمنع; Chroni=يحمي; Łagodzi=يخفف; Naprawia=يصلح; Rozwiązuje=يحل; Zmniejsza=يقلل',
      n: 'Ułatwia=يسهّل; Oszczędza czas=يوفر الوقت; Czyści=ينظف; Organizuje=ينظم; Idealny do=مثالي لـ; Niezbędny=ضروري; Masz dość=سئمت من; Bez wysiłku=بلا مجهود; Poprawia=يحسّن',
      c: {
        kids: 'twoje dziecko=طفلك; niemowlę=الرضيع; dzieci=الأطفال; maluchy=الصغار; mamy=الأمهات; karmienie piersią=الرضاعة',
        home: 'kuchnia=المطبخ; dom=البيت; łazienka=الحمام; sprzątanie=التنظيف; pranie=الغسيل; przechowywanie=التخزين',
        beauty: 'skóra=البشرة; włosy=الشعر; twarz=الوجه; zęby=الأسنان; paznokcie=الأظافر; zmarszczki=التجاعيد; trądzik=حب الشباب',
        car: 'twój samochód=سيارتك; samochód=السيارة; szyba=الزجاج; fotele samochodowe=مقاعد السيارة',
        pets: 'twój pies=كلبك; twój kot=قطتك; zwierzęta=الحيوانات; sierść=شعر الحيوانات',
        sport: 'ból pleców=ألم الظهر; postawa=وضعية الجسم; mięśnie=العضلات; trening=التمرين; ból kolan=ألم الركبة',
        travel: 'podróż=السفر; walizka=حقيبة السفر; bagaż=الأمتعة; wakacje=العطلة',
        phone: 'twój telefon=هاتفك; ładowarka=الشاحن; bateria=البطارية; słuchawki=السماعات',
        fashion: 'buty=أحذية; zegarek=ساعة; okulary przeciwsłoneczne=نظارات شمسية; biżuteria=مجوهرات; torebka=حقيبة يد',
        tools: 'naprawy=إصلاحات; narzędzia=أدوات; majsterkowanie=أعمال يدوية; wiertarka=مثقاب; przecieki=تسربات'
      }
    },
    tr: {
      s: 'Yardımcı olur=يساعد; Kurtulun=تخلّصوا; Son verin=ضعوا حداً; Elveda=وداعاً; Önler=يمنع; Korur=يحمي; Giderir=يزيل; Rahatlatır=يريح; Onarır=يصلح; Azaltır=يقلل; Artık yok=لم يعد موجوداً',
      n: 'Kolaylaştırır=يسهّل; Zaman kazandırır=يوفر الوقت; Temizler=ينظف; Düzenler=ينظم; İçin mükemmel=مثالي لـ; Pratik=عملي; Zahmetsiz=بلا عناء; İyileştirir=يحسّن',
      c: {
        kids: 'bebeğiniz=رضيعك; çocuğunuz=طفلك; çocuklar=الأطفال; anneler=الأمهات; yenidoğan=المولود; emzirme=الرضاعة',
        home: 'mutfak=المطبخ; eviniz=بيتك; banyo=الحمام; temizlik=التنظيف; çamaşır=الغسيل; düzen=الترتيب',
        beauty: 'cildiniz=بشرتك; saçlarınız=شعرك; yüz=الوجه; dişler=الأسنان; tırnak=الأظافر; kırışıklık=التجاعيد; sivilce=حب الشباب',
        car: 'aracınız=سيارتك; araba=السيارة; ön cam=الزجاج الأمامي; koltuk=المقعد',
        pets: 'kediniz=قطتك; köpeğiniz=كلبك; evcil hayvan=حيوان أليف; tüy=الشعر',
        sport: 'bel ağrısı=ألم أسفل الظهر; duruş=وضعية الجسم; kaslar=العضلات; antrenman=التمرين; diz ağrısı=ألم الركبة',
        travel: 'seyahat=السفر; valiz=حقيبة السفر; bavul=الحقيبة; tatil=العطلة',
        phone: 'telefonunuz=هاتفك; şarj=الشحن; batarya=البطارية; kulaklık=السماعات',
        fashion: 'ayakkabı=حذاء; saat=ساعة; güneş gözlüğü=نظارة شمسية; takı=مجوهرات; çanta=حقيبة',
        tools: 'tamir=إصلاح; alet=أداة; sızıntı=تسرب; matkap=مثقاب; kendin yap=اصنعها بنفسك'
      }
    },
    id: {
      s: 'Membantu=يساعد; Bantu=ساعد; Atasi=عالج; Mengatasi=يعالج; Hilangkan=أزِل; Menghilangkan=يزيل; Cegah=امنع; Mencegah=يمنع; Melindungi=يحمي; Meredakan=يخفف; Solusi=حل; Bye bye=وداعاً; Gak perlu lagi=لم تعد بحاجة; Ampuh=فعّال',
      n: 'Praktis=عملي; Mudah=سهل; Hemat=موفّر; Bersihkan=نظّف; Rapikan=رتّب; Cocok untuk=مناسب لـ; Wajib punya=لا بد من امتلاكه; Anti=مضاد لـ; Bikin=يجعل; Tanpa ribet=بلا تعقيد; Auto=تلقائياً',
      c: {
        kids: 'si kecil=الصغير; anak=الطفل; bayi=الرضيع; bunda=الأم; balita=الطفل الصغير; MPASI=طعام الرضّع; menyusui=الرضاعة',
        home: 'dapur=المطبخ; rumah=البيت; kamar mandi=الحمام; cucian=الغسيل; masak=الطبخ; bersih-bersih=التنظيف',
        beauty: 'kulit=البشرة; wajah=الوجه; rambut=الشعر; gigi=الأسنان; kuku=الأظافر; jerawat=حب الشباب; kerutan=التجاعيد',
        car: 'mobil=السيارة; motor=الدراجة النارية; kabin mobil=داخل السيارة; kaca mobil=زجاج السيارة',
        pets: 'kucing=القط; anjing=الكلب; anabul=الحيوان الأليف; bulu kucing=شعر القط',
        sport: 'sakit punggung=ألم الظهر; postur=وضعية الجسم; otot=العضلات; olahraga=الرياضة; diet=الحمية',
        travel: 'traveling=السفر; koper=حقيبة السفر; liburan=العطلة; mudik=السفر إلى البلدة',
        phone: 'HP=الهاتف; handphone=الهاتف; charger=الشاحن; baterai=البطارية; earphone=السماعات',
        fashion: 'sepatu=حذاء; jam tangan=ساعة يد; kacamata=نظارة; perhiasan=مجوهرات; tas=حقيبة',
        tools: 'perbaikan=إصلاح; perkakas=أدوات; bocor=تسرب; bor=مثقاب; pipa=أنبوب'
      }
    },
    ms: {
      s: 'Membantu=يساعد; Bantu=ساعد; Atasi=عالج; Hilangkan=أزِل; Mencegah=يمنع; Melindungi=يحمي; Melegakan=يخفف; Selamat tinggal=وداعاً; Tak perlu lagi=لم تعد بحاجة; Penyelesaian=حل',
      n: 'Mudah=سهل; Jimat masa=يوفر الوقت; Bersihkan=نظّف; Kemas=مرتّب; Sesuai untuk=مناسب لـ; Wajib ada=لا بد منه; Praktikal=عملي; Tanpa susah payah=بلا عناء',
      c: {
        kids: 'anak=الطفل; si kecil=الصغير; bayi=الرضيع; ibu=الأم; menyusu=الرضاعة',
        home: 'dapur=المطبخ; rumah=البيت; bilik air=الحمام; kain baju=الملابس; memasak=الطبخ',
        beauty: 'kulit=البشرة; wajah=الوجه; rambut=الشعر; gigi=الأسنان; jerawat=حب الشباب; kedutan=التجاعيد',
        car: 'kereta=السيارة; motosikal=الدراجة النارية; cermin kereta=زجاج السيارة',
        pets: 'kucing=القط; anjing=الكلب; bulu kucing=شعر القط',
        sport: 'sakit belakang=ألم الظهر; postur=وضعية الجسم; otot=العضلات; senaman=التمرين',
        travel: 'melancong=السفر; bagasi=الأمتعة; beg pakaian=حقيبة الملابس; percutian=العطلة',
        phone: 'telefon=الهاتف; pengecas=الشاحن; bateri=البطارية; earphone=السماعات',
        fashion: 'kasut=حذاء; jam tangan=ساعة يد; cermin mata=نظارة; barang kemas=مجوهرات; beg tangan=حقيبة يد',
        tools: 'pembaikan=إصلاح; perkakas=أدوات; bocor=تسرب; gerudi=مثقاب; paip=أنبوب'
      }
    },
    vi: {
      s: 'Giúp=يساعد; Tạm biệt=وداعاً; Loại bỏ=يزيل; Đánh bay=يطرد تماماً; Chống=مضاد لـ; Ngăn ngừa=يمنع; Bảo vệ=يحمي; Giảm=يقلل; Trị=يعالج; Khắc phục=يصلح; Không còn=لم يعد; Giải quyết=يحل',
      n: 'Tiện lợi=مريح وعملي; Tiết kiệm=موفّر; Làm sạch=ينظف; Gọn gàng=مرتّب; Siêu tiện=عملي جداً; Dễ dàng=بسهولة; Hết ngay=يزول فوراً; Cải thiện=يحسّن',
      c: {
        kids: 'bé=الطفل; con bạn=طفلك; trẻ em=الأطفال; mẹ bỉm=الأمهات الجدد; trẻ sơ sinh=المولود; bé yêu=الطفل الحبيب',
        home: 'nhà bếp=المطبخ; nhà cửa=البيت; phòng tắm=الحمام; giặt giũ=الغسيل; nấu ăn=الطبخ; dọn dẹp=التنظيف',
        beauty: 'da=البشرة; da mặt=بشرة الوجه; tóc=الشعر; răng=الأسنان; móng=الأظافر; nếp nhăn=التجاعيد; mụn=حب الشباب',
        car: 'ô tô=السيارة; xe hơi=السيارة; xe máy=الدراجة النارية; kính xe=زجاج السيارة',
        pets: 'chó=الكلب; mèo=القط; thú cưng=الحيوانات الأليفة; boss=الحيوان المدلل',
        sport: 'đau lưng=ألم الظهر; tư thế=وضعية الجسم; cơ bắp=العضلات; tập gym=التمرين في النادي; giảm cân=إنقاص الوزن',
        travel: 'du lịch=السياحة; vali=حقيبة السفر; hành lý=الأمتعة; đi phượt=رحلات المغامرة',
        phone: 'điện thoại=الهاتف; sạc=الشحن; pin=البطارية; tai nghe=السماعات',
        fashion: 'giày=حذاء; đồng hồ=ساعة; kính=نظارة; trang sức=مجوهرات; túi xách=حقيبة يد',
        tools: 'sửa chữa=إصلاح; dụng cụ=أدوات; rò rỉ=تسرب; khoan=ثقب; ống nước=أنبوب الماء'
      }
    },
    tl: {
      s: 'Makakatulong=سيساعد; Tumutulong=يساعد; Solusyon=حل; Wala nang=لم يعد هناك; Paalam na=وداعاً; Iwas=تجنّب; Pantanggal=مزيل; Tanggal=يزول; Proteksyon=حماية; Pang-alis=لإزالة',
      n: 'Hassle-free=بلا متاعب; Sulit=يستحق ثمنه; Tipid=موفّر; Madali=سهل; Pang-linis=للتنظيف; Must-have=ضروري; Para sa=من أجل; Ayos na=صار جيداً',
      c: {
        kids: 'baby=الرضيع; anak=الطفل; mga bata=الأطفال; mommy=الأم; sanggol=المولود',
        home: 'kusina=المطبخ; bahay=البيت; banyo=الحمام; labada=الغسيل; paglilinis=التنظيف',
        beauty: 'balat=البشرة; mukha=الوجه; buhok=الشعر; ngipin=الأسنان; pimples=الحبوب; kuko=الأظافر',
        car: 'sasakyan=المركبة; kotse=السيارة; motor=الدراجة النارية',
        pets: 'aso=الكلب; pusa=القط; fur baby=الحيوان الأليف',
        sport: 'likod=الظهر; katawan=الجسم; workout=التمرين; tuhod=الركبة',
        travel: 'biyahe=الرحلة; maleta=حقيبة السفر; travel=السفر',
        phone: 'cellphone=الهاتف; phone=الهاتف; charger=الشاحن; battery=البطارية',
        fashion: 'sapatos=حذاء; relo=ساعة; salamin=نظارة; alahas=مجوهرات; bag=حقيبة',
        tools: 'tagas=تسرب; pag-aayos=إصلاح; gamit=أدوات; barena=مثقاب; tubo=أنبوب'
      }
    },
    hi: {
      s: 'Chhutkara=التخلص من; Chutkara paaye=تخلّص من; Madad kare=يساعد; Rahat=راحة; Door kare=يبعد; Bachaye=يحمي; Khatam=ينهي; छुटकारा=التخلص من; मदद=مساعدة; राहत=راحة; बचाए=يحمي; समाधान=حل',
      n: 'Aasan=سهل; Asaan=سهل; Time bachaye=يوفر الوقت; Saaf kare=ينظف; Ke liye perfect=مثالي لـ; Jugaad=حيلة ذكية; आसान=سهل; साफ़=نظيف; बचत=توفير',
      c: {
        kids: 'bachche=الأطفال; baby=الرضيع; bacchon=للأطفال; बच्चे=الأطفال; शिशु=الرضيع; माँ=الأم',
        home: 'kitchen=المطبخ; ghar=البيت; रसोई=المطبخ; घर=البيت; safai=التنظيف; सफाई=التنظيف',
        beauty: 'skin=البشرة; baal=الشعر; chehra=الوجه; त्वचा=البشرة; बाल=الشعر; चेहरा=الوجه; pimples=الحبوب',
        car: 'gaadi=السيارة; car=السيارة; bike=الدراجة النارية; गाड़ी=السيارة',
        pets: 'dog=الكلب; kutta=الكلب; billi=القطة; pet=الحيوان الأليف',
        sport: 'kamar dard=ألم الظهر; कमर दर्द=ألم الظهر; ghutno ka dard=ألم الركبتين; gym=النادي; workout=التمرين',
        travel: 'safar=السفر; yatra=الرحلة; यात्रा=الرحلة; travel bag=حقيبة سفر',
        phone: 'mobile=الهاتف; phone=الهاتف; मोबाइल=الهاتف; charger=الشاحن; battery=البطارية',
        fashion: 'joote=الأحذية; जूते=الأحذية; ghadi=ساعة; घड़ी=ساعة; chashma=نظارة',
        tools: 'repair=إصلاح; marammat=صيانة; leakage=تسرب; tools=أدوات; plumbing=سباكة'
      }
    },
    bn: {
      s: 'সাহায্য করে=يساعد; মুক্তি পান=تخلّص من; বিদায় জানান=قل وداعاً; দূর করে=يزيل; প্রতিরোধ করে=يمنع; রক্ষা করে=يحمي; আরাম দেয়=يريح; সমাধান=حل; কমায়=يقلل; আর নয়=لا مزيد',
      n: 'সহজ=سهل; সময় বাঁচায়=يوفر الوقت; পরিষ্কার করে=ينظف; গুছিয়ে রাখে=يرتّب; জন্য পারফেক্ট=مثالي لـ; দরকারি=ضروري; ঝামেলা ছাড়া=بلا متاعب',
      c: {
        kids: 'শিশু=الطفل; বাচ্চা=الطفل; আপনার সন্তান=طفلك; মা=الأم; নবজাতক=المولود',
        home: 'রান্নাঘর=المطبخ; ঘর=البيت; বাথরুম=الحمام; কাপড় ধোয়া=غسل الملابس; রান্না=الطبخ',
        beauty: 'ত্বক=البشرة; চুল=الشعر; মুখ=الوجه; দাঁত=الأسنان; ব্রণ=حب الشباب',
        car: 'গাড়ি=السيارة; বাইক=الدراجة النارية; মোটরসাইকেল=الدراجة النارية',
        pets: 'বিড়াল=القطة; কুকুর=الكلب; পোষা প্রাণী=الحيوان الأليف',
        sport: 'কোমর ব্যথা=ألم الظهر; ব্যায়াম=التمرين; পেশি=العضلات; হাঁটু ব্যথা=ألم الركبة',
        travel: 'ভ্রমণ=السفر; লাগেজ=الأمتعة; ব্যাগ=الحقيبة',
        phone: 'মোবাইল=الهاتف; চার্জার=الشاحن; ব্যাটারি=البطارية; হেডফোন=السماعات',
        fashion: 'জুতা=حذاء; ঘড়ি=ساعة; চশমা=نظارة; গয়না=مجوهرات',
        tools: 'মেরামত=إصلاح; যন্ত্রপাতি=أدوات; লিক=تسرب; ড্রিল=مثقاب'
      }
    },
    ur: {
      s: 'Chhutkara=التخلص من; Nijaat=نجاة / خلاص; Madad=مساعدة; Hifazat=حماية; Khatam=ينهي; Masla hal=يحل المشكلة; چھٹکارا; نجات; مدد; حفاظت; حل',
      n: 'Aasan=سهل; Sukoon=راحة; Saaf=نظيف; Bachat=توفير; Ke liye behtareen=الأفضل لـ; آسان; سکون; صفائی',
      c: {
        kids: 'bachay=الأطفال; bachon=للأطفال; baby=الرضيع; بچے; بچوں; ماں',
        home: 'kitchen=المطبخ; ghar=البيت; گھر; کچن; safai=التنظيف',
        beauty: 'skin=البشرة; jild=البشرة; baal=الشعر; chehra=الوجه; جلد; بال; چہرہ',
        car: 'gari=السيارة; گاڑی; car=السيارة; bike=الدراجة النارية',
        pets: 'billi=القطة; kutta=الكلب; pet=الحيوان الأليف',
        sport: 'kamar dard=ألم الظهر; کمر درد; gym=النادي; workout=التمرين',
        travel: 'safar=السفر; سفر; travel=السفر',
        phone: 'mobile=الهاتف; موبائل; charger=الشاحن; battery=البطارية',
        fashion: 'joote=الأحذية; جوتے; ghari=ساعة; گھڑی; chashma=نظارة',
        tools: 'repair=إصلاح; marammat=صيانة; leakage=تسرب; tools=أدوات'
      }
    },
    zh: {
      s: '幫助=يساعد; 幫你=يساعدك; 解決=يحل; 告別=وداعاً لـ; 擺脫=تخلّص من; 防止=يمنع; 預防=يقي من; 保護=يحمي; 緩解=يخفف; 去除=يزيل; 消除=يقضي على; 不再=لم يعد',
      n: '輕鬆=بسهولة; 神器=أداة سحرية; 省時=يوفر الوقت; 清潔=ينظف; 收納=يرتّب; 改善=يحسّن; 必備=ضروري; 超實用=عملي جداً; 一秒=في ثانية',
      c: {
        kids: '寶寶=الرضيع; 孩子=الطفل; 小孩=الطفل; 媽媽=الأم; 新生兒=المولود; 嬰兒=الرضيع',
        home: '廚房=المطبخ; 居家=المنزل; 浴室=الحمام; 洗衣=الغسيل; 打掃=التنظيف',
        beauty: '肌膚=البشرة; 皮膚=الجلد; 頭髮=الشعر; 臉部=الوجه; 牙齒=الأسنان; 皺紋=التجاعيد; 痘痘=حب الشباب',
        car: '汽車=السيارة; 愛車=سيارتك; 車用=للسيارة; 開車=القيادة',
        pets: '狗狗=الكلب; 貓咪=القطة; 毛孩=الحيوان الأليف; 寵物=الحيوانات الأليفة',
        sport: '腰痛=ألم أسفل الظهر; 駝背=انحناء الظهر; 肌肉=العضلات; 健身=اللياقة; 膝蓋=الركبة',
        travel: '旅行=السفر; 行李箱=حقيبة السفر; 出國=السفر للخارج; 旅遊=السياحة',
        phone: '手機=الهاتف; 充電=الشحن; 電池=البطارية; 耳機=السماعات',
        fashion: '鞋子=حذاء; 手錶=ساعة; 眼鏡=نظارة; 飾品=إكسسوارات; 包包=حقيبة',
        tools: '維修=إصلاح; 工具=أدوات; 漏水=تسرب الماء; 鑽孔=ثقب; DIY=اصنعها بنفسك'
      }
    },
    zhs: {
      s: '帮助=يساعد; 帮你=يساعدك; 解决=يحل; 告别=وداعاً لـ; 摆脱=تخلّص من; 防止=يمنع; 预防=يقي من; 保护=يحمي; 缓解=يخفف; 去除=يزيل; 消除=يقضي على; 不再=لم يعد',
      n: '轻松=بسهولة; 神器=أداة سحرية; 省时=يوفر الوقت; 清洁=ينظف; 收纳=يرتّب; 改善=يحسّن; 必备=ضروري; 超实用=عملي جداً; 一秒=في ثانية',
      c: {
        kids: '宝宝=الرضيع; 孩子=الطفل; 小孩=الطفل; 妈妈=الأم; 新生儿=المولود; 婴儿=الرضيع',
        home: '厨房=المطبخ; 居家=المنزل; 浴室=الحمام; 洗衣=الغسيل; 打扫=التنظيف',
        beauty: '肌肤=البشرة; 皮肤=الجلد; 头发=الشعر; 脸部=الوجه; 牙齿=الأسنان; 皱纹=التجاعيد; 痘痘=حب الشباب',
        car: '汽车=السيارة; 爱车=سيارتك; 车用=للسيارة; 开车=القيادة',
        pets: '狗狗=الكلب; 猫咪=القطة; 毛孩=الحيوان الأليف; 宠物=الحيوانات الأليفة',
        sport: '腰痛=ألم أسفل الظهر; 驼背=انحناء الظهر; 肌肉=العضلات; 健身=اللياقة; 膝盖=الركبة',
        travel: '旅行=السفر; 行李箱=حقيبة السفر; 出国=السفر للخارج; 旅游=السياحة',
        phone: '手机=الهاتف; 充电=الشحن; 电池=البطارية; 耳机=السماعات',
        fashion: '鞋子=حذاء; 手表=ساعة; 眼镜=نظارة; 饰品=إكسسوارات; 包包=حقيبة',
        tools: '维修=إصلاح; 工具=أدوات; 漏水=تسرب الماء; 钻孔=ثقب; DIY=اصنعها بنفسك'
      }
    },
    ja: {
      s: '解消=يزيل / يحل; さようなら=وداعاً; 防ぐ=يمنع; 守る=يحمي; 和らげる=يخفف; 取り除く=يزيل; 解決=حل; もう悩まない=لا مزيد من القلق; 助ける=يساعد; 軽減=يقلل',
      n: '簡単=سهل; 時短=يوفر الوقت; 便利=مريح وعملي; お掃除=التنظيف; 収納=الترتيب; ぴったり=مناسب تماماً; 必需品=ضروري; 手間なし=بلا عناء; 快適=مريح',
      c: {
        kids: '赤ちゃん=الرضيع; 子供=الطفل; お子様=طفلكم; ママ=الأم; 新生児=المولود; 授乳=الرضاعة',
        home: 'キッチン=المطبخ; お家=البيت; お風呂=الحمام; 洗濯=الغسيل; 料理=الطبخ; 掃除=التنظيف',
        beauty: '肌=البشرة; 髪=الشعر; 顔=الوجه; 歯=الأسنان; 爪=الأظافر; シワ=التجاعيد; ニキビ=حب الشباب',
        car: '車=السيارة; 愛車=سيارتك; 車内=داخل السيارة; 運転=القيادة',
        pets: '犬=الكلب; 猫=القطة; ペット=الحيوان الأليف; 抜け毛=الشعر المتساقط',
        sport: '腰痛=ألم أسفل الظهر; 姿勢=وضعية الجسم; 筋肉=العضلات; トレーニング=التمرين; 膝=الركبة',
        travel: '旅行=السفر; スーツケース=حقيبة السفر; 荷物=الأمتعة',
        phone: 'スマホ=الهاتف الذكي; 充電=الشحن; バッテリー=البطارية; イヤホン=السماعات',
        fashion: '靴=حذاء; 腕時計=ساعة يد; サングラス=نظارة شمسية; アクセサリー=إكسسوارات; バッグ=حقيبة',
        tools: '修理=إصلاح; 工具=أدوات; 水漏れ=تسرب الماء; DIY=اصنعها بنفسك'
      }
    },
    ko: {
      s: '도와줍니다=يساعد; 해결=حل; 안녕=وداعاً; 제거=إزالة; 방지=منع; 보호=حماية; 완화=تخفيف; 더 이상=لم يعد; 줄여줍니다=يقلل; 없애줍니다=يزيل',
      n: '간편=سهل; 시간 절약=يوفر الوقت; 청소=التنظيف; 정리=الترتيب; 딱 맞는=مناسب تماماً; 필수템=منتج ضروري; 꿀템=منتج رائع; 편리=مريح',
      c: {
        kids: '아기=الرضيع; 아이=الطفل; 우리 아이=طفلنا; 엄마=الأم; 신생아=المولود; 육아=تربية الأطفال',
        home: '주방=المطبخ; 집=البيت; 욕실=الحمام; 빨래=الغسيل; 요리=الطبخ; 청소=التنظيف',
        beauty: '피부=البشرة; 머리카락=الشعر; 얼굴=الوجه; 치아=الأسنان; 손톱=الأظافر; 주름=التجاعيد; 여드름=حب الشباب',
        car: '자동차=السيارة; 차량=المركبة; 운전=القيادة; 차량용=للسيارة',
        pets: '강아지=الجرو; 고양이=القطة; 반려동물=الحيوان الأليف; 털=الشعر',
        sport: '허리 통증=ألم الظهر; 자세=وضعية الجسم; 근육=العضلات; 운동=الرياضة; 무릎=الركبة',
        travel: '여행=السفر; 캐리어=حقيبة السفر; 짐=الأمتعة',
        phone: '휴대폰=الهاتف; 충전=الشحن; 배터리=البطارية; 이어폰=السماعات',
        fashion: '신발=حذاء; 시계=ساعة; 선글라스=نظارة شمسية; 액세서리=إكسسوارات; 가방=حقيبة',
        tools: '수리=إصلاح; 공구=أدوات; 누수=تسرب; 드릴=مثقاب'
      }
    },
    th: {
      s: 'ช่วย=يساعد; แก้ปัญหา=يحل المشكلة; กำจัด=يزيل; ป้องกัน=يمنع; บรรเทา=يخفف; บอกลา=وداعاً; ปกป้อง=يحمي; ลด=يقلل; ไม่ต้อง=لا داعي',
      n: 'สะดวก=مريح; ประหยัด=موفّر; ทำความสะอาด=ينظف; จัดระเบียบ=يرتّب; ง่าย=سهل; ต้องมี=ضروري; เหมาะสำหรับ=مناسب لـ',
      c: {
        kids: 'ลูกน้อย=طفلك الصغير; เด็ก=الطفل; คุณแม่=الأم; ทารก=الرضيع',
        home: 'ห้องครัว=المطبخ; บ้าน=البيت; ห้องน้ำ=الحمام; ซักผ้า=غسل الملابس',
        beauty: 'ผิว=البشرة; ผม=الشعر; ใบหน้า=الوجه; ฟัน=الأسنان; สิว=حب الشباب; ริ้วรอย=التجاعيد',
        car: 'รถยนต์=السيارة; รถ=المركبة; มอเตอร์ไซค์=الدراجة النارية',
        pets: 'สุนัข=الكلب; แมว=القطة; สัตว์เลี้ยง=الحيوان الأليف',
        sport: 'ปวดหลัง=ألم الظهر; กล้ามเนื้อ=العضلات; ออกกำลังกาย=التمرين; ปวดเข่า=ألم الركبة',
        travel: 'เดินทาง=السفر; กระเป๋าเดินทาง=حقيبة السفر; เที่ยว=السياحة',
        phone: 'มือถือ=الهاتف; ชาร์จ=الشحن; แบตเตอรี่=البطارية; หูฟัง=السماعات',
        fashion: 'รองเท้า=حذاء; นาฬิกา=ساعة; แว่นตา=نظارة; เครื่องประดับ=مجوهرات; กระเป๋า=حقيبة',
        tools: 'ซ่อม=إصلاح; เครื่องมือ=أدوات; รั่วซึม=تسرب; สว่าน=مثقاب'
      }
    },
    gulf: {
      s: 'يساعدك; يخلصك من; وداعاً لـ; يحل مشكلة; يحميك من; يريحك من; ما عاد تحتاج; يقضي على; يشيل; الحل لـ',
      n: 'يسهل عليك; يوفر وقتك; ينظف; يرتب; مرة عملي; لازم يكون عندك; بدون تعب; سهل الاستخدام',
      c: {
        kids: 'طفلك; عيالك; ياهلك; المولود; الأم',
        home: 'مطبخك; بيتك; الحمام; الغسيل; التنظيف',
        beauty: 'بشرتك; شعرك; ويهك; أسنانك; التجاعيد; الحبوب',
        car: 'سيارتك; السيارة; الدركسون; المقاعد',
        pets: 'قطوتك; القطاوة; كلبك; الحيوانات الأليفة',
        sport: 'ألم الظهر; ظهرك; عضلاتك; التمارين; الركبة',
        travel: 'السفر; شنطتك; الشنطة; الرحلة',
        phone: 'جوالك; الجوال; الشاحن; البطارية; السماعات',
        fashion: 'ملابسك; الجزمة; الساعة; النظارة; العطر',
        tools: 'التصليح; الأدوات; التسريب; الكهرباء; المواسير'
      }
    },
    eg: {
      s: 'هيساعدك; هيخلصك من; باي باي لـ; وداعاً لـ; بيحل مشكلة; هيحميك من; هيريحك من; مش هتحتاج; بيقضي على; الحل السحري',
      n: 'هيسهل عليك; هيوفر وقتك; بينضف; بيرتب; عملي جداً; لازم يكون عندك; من غير تعب; سهل الاستخدام',
      c: {
        kids: 'طفلك; ولادك; عيالك; البيبي; المولود; الأم',
        home: 'مطبخك; بيتك; الحمام; الغسيل; التنضيف',
        beauty: 'بشرتك; شعرك; وشك; سنانك; التجاعيد; الحبوب',
        car: 'عربيتك; العربية; الدريكسيون; الكراسي',
        pets: 'قطتك; القطط; كلبك; الحيوانات الأليفة',
        sport: 'ألم الضهر; ضهرك; عضلاتك; التمارين; الركبة',
        travel: 'السفر; شنطتك; الشنطة; الرحلة',
        phone: 'موبايلك; الموبايل; الشاحن; البطارية; السماعة',
        fashion: 'هدومك; الجزمة; الساعة; النضارة; البرفان',
        tools: 'التصليح; العدة; التسريب; الكهربا; المواسير'
      }
    }
  };

  // Meanings of the Algerian French / Arabizi dictionary (golden.js, niches.js, engine/dicts.js).
  const GLOSS_LEGACY = {
    fr: 'résout=يحل; élimine=يزيل; supprime=يلغي; empêche=يمنع; protège=يحمي; protège contre=يحمي من; répare=يصلح; soulage=يخفف; aide à=يساعد على; réduit=يقلل; stoppe=يوقف; lutte contre=يكافح; solution définitive=حل نهائي; dites adieu à=قولوا وداعاً لـ; débarrassez-vous de=تخلصوا من; en finir avec=انتهِ من; stop à=كفى من; ' +
      'évite=يتجنب; améliore=يحسّن; corrige=يصحح; facilite=يسهّل; simplifie=يبسّط; économise=يوفر; fait gagner du temps=يوفر الوقت; nettoie=ينظف; apaise=يهدّئ; détecte=يكشف; alerte=ينبّه; surveille=يراقب; mesure=يقيس; sèche=يجفف; hydrate=يرطب; renforce=يقوّي; éclaire=يضيء; range=يرتّب; conserve=يحفظ; organise=ينظم; remplace=يعوّض; vous souffrez de=هل تعاني من; souffrez-vous de=هل تعاني من; marre de=سئمت من; fatigué de=تعبت من; vous avez un problème=عندك مشكلة; on a la solution=عندنا الحل; voici la solution=هذا هو الحل; définitivement=نهائياً; adieu=وداعاً; plus besoin de=لا حاجة بعد الآن لـ; sans avoir besoin de=دون الحاجة إلى; ne plus avoir à=لن تضطر بعد الآن إلى; fini les=انتهى زمن; ' +
      'donne=يعطي; rend=يجعل; fait=يفعل; permet=يسمح; convient=يناسب; ouvre=يفتح; trouve=يجد; accompagne=يرافق; connecte=يربط; mélange=يخلط; ' +
      'votre enfant=طفلك; enfants=الأطفال; bébé=الرضيع; nourrisson=الرضيع; maman=الأم; allaitement=الرضاعة; grossesse=الحمل; nouveau-né=المولود; cuisine=المطبخ; maison=البيت; salle de bain=الحمام; ménage=أشغال البيت; vaisselle=الأواني; rangement=الترتيب; nettoyage=التنظيف; ' +
      'votre peau=بشرتك; peau=البشرة; cheveux=الشعر; visage=الوجه; dents=الأسنان; ongles=الأظافر; rides=التجاعيد; barbe=اللحية; voiture=السيارة; auto=السيارة; moteur=المحرك; pare-brise=الزجاج الأمامي; volant=المقود; sièges=المقاعد; pneus=الإطارات; tableau de bord=لوحة القيادة; ' +
      'votre chat=قطتك; votre chien=كلبك; chats=القطط; chiens=الكلاب; animaux=الحيوانات; litière=فضلات القطط; musculation=كمال الأجسام; sport=الرياضة; fitness=اللياقة; course=الجري; entraînement=التمرين; muscles=العضلات; yoga=اليوغا; ' +
      'voyage=السفر; valise=حقيبة السفر; bagages=الأمتعة; organisation=التنظيم; sac=الحقيبة; téléphone=الهاتف; smartphone=الهاتف الذكي; chargeur=الشاحن; batterie=البطارية; écran=الشاشة; écouteurs=السماعات; coque=الغلاف; ' +
      'vêtements=الملابس; mode=الموضة; chaussures=الأحذية; montre=الساعة; sac à main=حقيبة اليد; lunettes=النظارات; bijoux=المجوهرات; parfum=العطر; bricolage=الأعمال اليدوية; réparation=الإصلاح; outils=الأدوات; fuite=التسرب; plomberie=السباكة; électricité=الكهرباء; perceuse=المثقاب; colle=الغراء',
    arz: 'y7el=يحل; y9dhi 3la=يقضي على; yzil=يزيل; ymna3=يمنع; y7mi=يحمي; ysal7=يصلح; ysa3ed=يساعد; ykhaffef=يخفف; yw9ef=يوقف; ykafe7=يكافح; ydawi=يداوي; jbnalek l7al=جبنالك الحل; l7al nihai=الحل النهائي; t5alas men=تخلّص من; wada3=وداعاً; tasli7=تصليح; ' +
      'rak t3ani=راك تعاني; t3ani men=تعاني من; t3ebt men=تعبت من; 3andek mochkil=عندك مشكل; rah tethana=راح تتهنى; nihaiyan=نهائياً; ysahel=يسهّل; ysahel 3lik=يسهّل عليك; ywaffer=يوفّر; ynaqqes=ينقص; yna7i=ينحّي; ma t7tajch=ما تحتاجش; ma tb9ach=ما تبقاش; ma tzidch=ما تزيدش; bla ma t7taj=بلا ما تحتاج; tari9a sahla=طريقة سهلة; sahel l isti3mal=ساهل الاستعمال; mouta3added listi3malat=متعدد الاستعمالات; ' +
      'tflek=طفلك; wldek=ولدك; sghirek=صغيرك; bebe=البيبي; mama=الماما; cuisine=الكوزينة; dar=الدار; hammam=الحمام; tbikh=الطبيخ; tanzif=التنظيف; bechrtek=بشرتك; wejhek=وجهك; cha3rek=شعرك; sennek=سنّك; cheveux=الشعر; tonobil=الطونوبيل (السيارة); voiture=السيارة; moteur=المحرك; volan=المقود; pneu=العجلة; ' +
      '9ettek=قطتك; klebek=كلبك; chat=القط; chien=الكلب; sport=الرياضة; muscu=كمال الأجسام; tmarin=التمارين; fitness=اللياقة; safar=السفر; valise=الحقيبة; sac=الحقيبة; voyage=السفر; telifon=التيليفون; tel=التيليفون; chargeur=الشارجور; batterie=البطارية; ecran=الشاشة; ecouteur=السماعات; ' +
      'vetement=الملابس; sebbat=الصباط (الحذاء); montre=الساعة; lunette=النظارة; bricolage=الأعمال اليدوية; outil=الأدوات; fuite=التسرب; plomberie=السباكة'
  };

  /* ---------- parsing ---------- */
  const split = (s) => String(s || '').split(';').map((x) => x.trim()).filter(Boolean);
  const term = (x) => x.split('=')[0].trim();
  const gl = (x) => { const i = x.indexOf('='); return i > 0 ? x.slice(i + 1).trim() : ''; };
  const KW = {}, GLOSS = {};
  for (const lg of Object.keys(D)) {
    const L = D[lg], g = (GLOSS[lg] = {});
    const take = (s) => split(s).map((x) => { const t = term(x), m = gl(x); if (m) g[t.toLowerCase()] = m; return t; });
    KW[lg] = { strong: take(L.s), normal: take(L.n), comps: {} };
    for (const n of Object.keys(L.c)) KW[lg].comps[n] = take(L.c[n]);
  }
  for (const lg of Object.keys(GLOSS_LEGACY)) { const g = (GLOSS[lg] = GLOSS[lg] || {}); split(GLOSS_LEGACY[lg]).forEach((x) => { const m = gl(x); if (m) g[term(x).toLowerCase()] = m; }); }
  // the meaning of a word (or of a "golden + complementary" phrase) in Arabic
  function gloss(lang, text) {
    const g = GLOSS[lang]; if (!g || !text) return '';
    const t = String(text).split('/')[0].trim().toLowerCase();
    return g[t] || '';
  }
  const api = { KW, GLOSS, gloss };
  root.RadarKW = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
