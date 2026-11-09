// Radar – international markets: which languages each country searches in, and the local-language data the whole
// pipeline uses (golden keywords, complementary keywords per niche, product-eligibility lexicons).
//
// Writing rules for the data below:
//  * Natural phrases advertisers really use in that market, not word-for-word translations of the English list.
//  * Golden keywords = the benefit / problem-solution verb or phrase ("Helps", "Say goodbye to").
//    Complementary keywords = the niche noun the benefit applies to ("your child", "your car").
//    A combined search is ALWAYS golden first, then complementary: "Helps your child".
//  * Filter lexicons: entries starting with "!" are strong evidence (weight 2), others weak (weight 1).
//    "/" separates spelling variants of the same entry.
//  * ar / dz / fr / arz golden words + complements stay in golden.js / niches.js (the Algerian workflow); this file
//    only adds their filter lexicons, so the Algerian search behaviour is unchanged.
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ languages ------------------------------------------------------------------ */
  // fb = value for the Ad Library content_languages filter. joiner = how golden + complementary are glued in an exact phrase.
  const LANGS = {
    ar: { name: 'الفصحى', native: 'العربية', fb: 'ar', script: 'arab' },
    dz: { name: 'الدارجة', native: 'الدارجة', fb: 'ar', script: 'arab' },
    fr: { name: 'الفرنسية', native: 'Français', fb: 'fr', script: 'latn' },
    arz: { name: 'الأرابيزي', native: 'Arabizi', fb: '', script: 'latn' },
    en: { name: 'الإنجليزية', native: 'English', fb: 'en', script: 'latn' },
    es: { name: 'الإسبانية', native: 'Español', fb: 'es', script: 'latn' },
    pt: { name: 'البرتغالية', native: 'Português', fb: 'pt', script: 'latn' },
    de: { name: 'الألمانية', native: 'Deutsch', fb: 'de', script: 'latn' },
    it: { name: 'الإيطالية', native: 'Italiano', fb: 'it', script: 'latn' },
    tr: { name: 'التركية', native: 'Türkçe', fb: 'tr', script: 'latn' },
    id: { name: 'الإندونيسية', native: 'Bahasa Indonesia', fb: 'id', script: 'latn' },
    ms: { name: 'الماليزية', native: 'Bahasa Melayu', fb: 'ms', script: 'latn' },
    vi: { name: 'الفيتنامية', native: 'Tiếng Việt', fb: 'vi', script: 'latn' },
    tl: { name: 'الفلبينية (تاغالوغ)', native: 'Tagalog / Taglish', fb: 'tl', script: 'latn' },
    hi: { name: 'الهندية (هنغلش)', native: 'हिन्दी / Hinglish', fb: 'hi', script: 'deva' },
    ur: { name: 'الأردية', native: 'اردو / Roman Urdu', fb: 'ur', script: 'arab' },
    zh: { name: 'الصينية التقليدية', native: '繁體中文', fb: 'zh', script: 'hani', joiner: '' },
    th: { name: 'التايلاندية', native: 'ไทย', fb: 'th', script: 'thai', joiner: '' },
    zhs: { name: 'الصينية المبسطة', native: '简体中文', fb: 'zh', script: 'hani', joiner: '' },
    ja: { name: 'اليابانية', native: '日本語', fb: 'ja', script: 'jpan', joiner: '' },
    ko: { name: 'الكورية', native: '한국어', fb: 'ko', script: 'hang' },
    bn: { name: 'البنغالية', native: 'বাংলা', fb: 'bn', script: 'beng' },
    nl: { name: 'الهولندية', native: 'Nederlands', fb: 'nl', script: 'latn' },
    pl: { name: 'البولندية', native: 'Polski', fb: 'pl', script: 'latn' },
    gulf: { name: 'اللهجة الخليجية', native: 'خليجي', fb: 'ar', script: 'arab' },
    eg: { name: 'اللهجة المصرية', native: 'مصري', fb: 'ar', script: 'arab' }
  };
  // Languages whose golden / complementary keywords come from golden.js + niches.js (Algerian workflow).
  const LEGACY = ['ar', 'dz', 'fr', 'arz'];

  /* ------------------------------------------------------------------ countries ------------------------------------------------------------------ */
  // langs: لغات البحث بالترتيب (الأولى = لغة الإعلانات الرئيسية). cur: عملة السوق.
  // sellers: حد «قلة البائعين» حسب حجم السوق. الجزائر تبقى 3 كما هي؛ الأسواق الكبيرة تتحمل بائعين أكثر قبل أن يُعدّ المنتج مزدحماً.
  const C = (name, langs, region, cur, sellers) => ({ name, langs, region, cur, sellers: sellers || 4 });
  const GULF = ['ar', 'gulf', 'en'];
  const COUNTRIES = {
    DZ: C('الجزائر', ['ar', 'dz', 'fr', 'arz'], 'mena', 'DZD', 3), MA: C('المغرب', ['ar', 'fr', 'dz', 'arz'], 'mena', 'MAD', 4), TN: C('تونس', ['ar', 'fr', 'dz', 'arz'], 'mena', 'TND', 3),
    LY: C('ليبيا', ['ar', 'en'], 'mena', 'LYD', 3), EG: C('مصر', ['ar', 'eg', 'en'], 'mena', 'EGP', 6), SA: C('السعودية', GULF, 'mena', 'SAR', 6), AE: C('الإمارات', GULF, 'mena', 'AED', 5),
    QA: C('قطر', GULF, 'mena', 'QAR', 3), KW: C('الكويت', GULF, 'mena', 'KWD', 3), BH: C('البحرين', GULF, 'mena', 'BHD', 3), OM: C('عُمان', GULF, 'mena', 'OMR', 3),
    IQ: C('العراق', ['ar', 'en'], 'mena', 'IQD', 5), JO: C('الأردن', ['ar', 'en'], 'mena', 'JOD', 4),
    FR: C('فرنسا', ['fr'], 'eu', 'EUR', 6), BE: C('بلجيكا', ['fr', 'nl', 'en'], 'eu', 'EUR', 4), NL: C('هولندا', ['nl', 'en'], 'eu', 'EUR', 5), CH: C('سويسرا', ['fr', 'de', 'it'], 'eu', 'CHF', 4),
    LU: C('لوكسمبورغ', ['fr', 'de'], 'eu', 'EUR', 3), GB: C('المملكة المتحدة', ['en'], 'eu', 'GBP', 7), IE: C('أيرلندا', ['en'], 'eu', 'EUR', 4), ES: C('إسبانيا', ['es'], 'eu', 'EUR', 6),
    PT: C('البرتغال', ['pt'], 'eu', 'EUR', 4), DE: C('ألمانيا', ['de'], 'eu', 'EUR', 7), AT: C('النمسا', ['de'], 'eu', 'EUR', 4), IT: C('إيطاليا', ['it'], 'eu', 'EUR', 6),
    PL: C('بولندا', ['pl'], 'eu', 'PLN', 5), TR: C('تركيا', ['tr'], 'eu', 'TRY', 7),
    US: C('الولايات المتحدة', ['en', 'es'], 'am', 'USD', 10), CA: C('كندا', ['en', 'fr'], 'am', 'CAD', 6), MX: C('المكسيك', ['es'], 'am', 'MXN', 7), CO: C('كولومبيا', ['es'], 'am', 'COP', 6),
    AR: C('الأرجنتين', ['es'], 'am', 'ARS', 5), CL: C('تشيلي', ['es'], 'am', 'CLP', 5), PE: C('بيرو', ['es'], 'am', 'PEN', 5), EC: C('الإكوادور', ['es'], 'am', 'USD', 4), BR: C('البرازيل', ['pt'], 'am', 'BRL', 10),
    IN: C('الهند', ['en', 'hi'], 'asia', 'INR', 10), PK: C('باكستان', ['en', 'ur'], 'asia', 'PKR', 7), BD: C('بنغلاديش', ['bn', 'en'], 'asia', 'BDT', 6),
    PH: C('الفلبين', ['en', 'tl'], 'asia', 'PHP', 7), ID: C('إندونيسيا', ['id'], 'asia', 'IDR', 10), MY: C('ماليزيا', ['ms', 'en', 'zhs'], 'asia', 'MYR', 6), SG: C('سنغافورة', ['en', 'zhs'], 'asia', 'SGD', 4),
    VN: C('فيتنام', ['vi'], 'asia', 'VND', 8), TW: C('تايوان', ['zh'], 'asia', 'TWD', 6), HK: C('هونغ كونغ', ['zh', 'en'], 'asia', 'HKD', 4), TH: C('تايلاند', ['th'], 'asia', 'THB', 8),
    JP: C('اليابان', ['ja'], 'asia', 'JPY', 8), KR: C('كوريا الجنوبية', ['ko'], 'asia', 'KRW', 7),
    AU: C('أستراليا', ['en'], 'oc', 'AUD', 6), NZ: C('نيوزيلندا', ['en'], 'oc', 'NZD', 4),
    NG: C('نيجيريا', ['en'], 'af', 'NGN', 6), KE: C('كينيا', ['en'], 'af', 'KES', 4), GH: C('غانا', ['en'], 'af', 'GHS', 4), ZA: C('جنوب أفريقيا', ['en'], 'af', 'ZAR', 6),
    ALL: C('كل الدول', ['en', 'fr', 'ar', 'es'], 'all', '', 6)
  };
  const REGIONS = { mena: 'الدول العربية', eu: 'أوروبا', am: 'الأمريكتان', asia: 'آسيا', oc: 'أوقيانوسيا', af: 'أفريقيا', all: 'عام' };

  /* --------------------------------------------------------- golden + complementary keywords --------------------------------------------------------- */
  // Niche ids are the same ten as niches.js: kids home beauty car pets sport travel phone fashion tools.
  // الكلمات الذهبية والمكمّلة لكل لغة مع معناها بالعربية: lib/kwdata.js
  const KWD = root.RadarKW || (typeof require === 'function' ? require('./kwdata.js') : null);
  const KW = KWD.KW;

  /* ------------------------------------------------------- product-eligibility lexicons (per language) ------------------------------------------------------- */
  // service / course / event / store / company / digital: the ad sells something that is not a physical product.
  // food / bulky / fragile: a physical product, but excluded by the business rules.
  // *Ok lists: context words that cancel a food / bulky / fragile hit in the same sentence ("cookie cutter", "sofa cover",
  // "tempered glass screen protector"). cue: evidence that a physical product is being sold.
  const F = {
    en: {
      service: ['!our services', '!we offer', '!book an appointment', '!book your appointment', '!schedule a consultation', '!free consultation', '!free quote', '!get a quote', '!request a quote', 'clinic', '!dental clinic', 'dentist', '!hair salon', '!nail salon', '!beauty salon', '!day spa', '!plumbing services', '!cleaning services', '!cleaning service', '!moving company', '!movers', '!law firm', 'attorney', 'lawyer', '!insurance', '!life insurance', '!car insurance', '!loan', '!loans', '!mortgage', '!real estate', '!for rent', '!apartment for sale', '!house for sale', '!property for sale', '!visa', '!immigration', '!travel agency', '!tour package', '!tour packages', 'hotel', 'resort', '!car rental', '!rent a car', '!marketing agency', '!digital marketing', '!web design', '!repair service', '!installation service', '!home services', '!therapy session', 'counseling', '!home care', '!car wash', '!photography services', '!printing services', '!we deliver to your door', '!site visit', '!bhk', '!ready to move', '!plots for sale', '!pre-selling', '!condo units'],
      course: ['!online course', '!this course', '!our course', '!free course', '!the course', '!course starts', '!courses', '!masterclass', '!webinar', '!workshop', '!training program', '!enroll now', '!enrol now', '!enroll today', '!register now', 'certification', '!certificate program', '!diploma', '!academy', '!bootcamp', '!lessons', '!tutoring', '!online classes', '!classes start', '!coaching program', '!mentorship', 'learn how to', '!free training', '!lecture', '!lectures', '!seminar', '!tuition', '!admissions open'],
      event: ['!conference', '!summit', '!expo', '!exhibition', '!trade show', '!concert', '!festival', 'tickets', '!get your tickets', '!meetup', '!save the date', '!join us on', '!live event', '!gala', 'event', '!convention', '!open house', '!live music', '!live band', '!dj night', '!happy hour'],
      store: ['!visit our store', '!visit us at', '!visit our showroom', '!visit our shop', '!our store in', '!located at', '!opening hours', '!open daily', '!now open', '!grand opening', '!new location', '!new branch', '!in-store', '!in store only', '!walk-in', '!walk in', '!get directions', '!drive-thru', '!our branches', 'come visit', 'shop local', 'come by'],
      company: ["!we're hiring", '!we are hiring', '!join our team', '!careers', '!job opening', '!job openings', '!apply now', '!franchise', '!business opportunity', '!become a distributor', '!become a reseller', 'our company', 'leading provider', 'trusted partner', '!b2b', 'solutions for businesses', 'donate', '!donation', '!charity', 'vote for', 'campaign'],
      digital: ['!download the app', '!download our app', '!get the app', '!install now', '!app store', '!google play', '!play now', '!play for free', '!mobile game', 'subscription', '!subscribe now', '!software', '!saas', '!free trial', '!ebook', '!e-book', '!pdf guide', '!templates', '!digital download', '!membership', '!crypto', '!trading', '!forex', 'invest', '!investment', '!earn money', '!make money online', '!passive income', 'streaming', '!vpn', '!casino', '!betting'],
      food: ['!cookies', '!cookie', '!biscuits', '!cake', '!cakes', '!cupcakes', '!pastry', '!pastries', '!bakery', '!brownies', '!chocolate', '!chocolates', '!honey', '!medjool dates', '!coffee', '!coffee beans', '!tea', '!snacks', '!candy', '!sweets', '!bread', '!croissants', '!macarons', '!pizza', '!burger', '!burgers', '!restaurant', 'menu', '!meals', '!meal prep', '!catering', '!spices', '!olive oil', 'jam', '!nuts', '!jerky', '!food delivery', '!dessert', '!desserts', '!donuts', '!pies', '!baked goods', '!homemade food', '!frozen food', '!seafood', '!fresh fruit', 'juice', '!smoothie'],
      foodOk: ['mold', 'molds', 'mould', 'moulds', 'cutter', 'cutters', 'maker', 'machine', 'pan', 'pans', 'tray', 'trays', 'container', 'containers', 'grinder', 'stand', 'press', 'dispenser', 'kit', 'tool', 'tools', 'decorating', 'organizer', 'storage', 'opener', 'peeler', 'slicer', 'whisk', 'mug', 'mugs', 'cup', 'tumbler', 'thermos', 'flask', 'warmer', 'scale', 'plate', 'rack', 'frother', 'brewer', 'kettle', 'toy', 'plush', 'candle', 'lamp', 'pillow', 'keychain', 'scented', 'scrub', 'mask', 'soap', 'serum', 'shampoo', 'cream', 'lotion', 'balm', 'lip', 'stain', 'stains', 'spill', 'spills', 'crumbs', 'squishy', 'towel', 'towels', 'teapot', 'lunch box', 'bento box', 'storage box', 'food container', 'infuser', 'strainer', 'pot', 'bolts', 'screws', 'color', 'colour', 'brown', 'table', 'cozy', 'sticker', 'costume', 'shaped'],
      bulky: ['!sofa', '!couch', '!sectional', '!mattress', '!bed frame', '!king size bed', '!queen size bed', '!wardrobe', '!armoire', '!refrigerator', '!fridge', '!freezer', '!washing machine', '!dryer', '!dishwasher', '!dining table', '!treadmill', '!furniture', 'cabinet', '!bookshelf', '!recliner', '!bunk bed', '!hot tub', '!trampoline', '!piano', '!pool table', '!bathtub', '!generator', '!air conditioner', '!television', '!smart tv', '!sofa bed', '!desk', '!office chair', '!gazebo', '!shed', '!kayak', '!electric bike', '!e-bike', '!e-scooter', '!electric scooter'],
      bulkyOk: ['cover', 'covers', 'slipcover', 'protector', 'sheet', 'sheets', 'organizer', 'holder', 'mat', 'cushion', 'pad', 'light', 'lamp', 'accessory', 'accessories', 'mini', 'toy', 'dollhouse', 'miniature', 'handle', 'cleaner', 'brush', 'remote', 'mount', 'magnet', 'magnets', 'filter', 'sticker', 'decal', 'skirt', 'pillow', 'caddy', 'model', 'deodorizer', 'odor', 'smell', 'stain', 'freshener', 'liner', 'lock', 'alarm', 'bumper', 'gap', 'rail', 'hair', 'shoe', 'nail', 'salad', 'mount', 'risers', 'leg', 'legs', 'wheels', 'casters', 'bag', 'charger', 'phone', 'clip', 'stand', 'lap', 'tray'],
      fragile: ['!glassware', '!wine glasses', '!glass vase', '!vase', '!ceramic', '!ceramics', '!porcelain', '!crystal glass', '!chandelier', '!aquarium', '!fish tank', '!terrarium', '!snow globe', '!glass bottle', '!glass jar', '!glass cup', '!glass cups', '!wall mirror', '!full length mirror', '!floor mirror', '!stained glass', '!fragile', '!handmade pottery', '!pottery'],
      fragileOk: ['tempered', 'screen protector', 'unbreakable', 'shatterproof', 'shatter-proof', 'acrylic', 'plastic', 'silicone', 'stainless', 'cleaner', 'scraper', 'coating', 'repair', 'glue', 'non-stick', 'nonstick', 'heater', 'pump', 'filter', 'light', 'lights', 'decor sticker'],
      cue: ['!free shipping', '!free delivery', '!cash on delivery', '!order now', '!buy now', '!shop now', '!add to cart', '!limited stock', '!in stock', '!sold out', '!% off', '!off today', '!buy 1 get 1', '!buy one get one', '!bogo', 'sale', 'discount', 'bundle', 'ships', 'shipping', 'money-back', 'guarantee', 'warranty', 'pcs', 'pieces', 'pack of', 'set of', 'only today', 'grab yours', 'get yours', 'order yours']
    },
    fr: {
      service: ['!nos services', '!prestation', '!prestations', '!sur rendez-vous', '!prenez rendez-vous', '!devis gratuit', '!demandez un devis', 'cabinet', '!clinique', '!institut de beauté', '!salon de coiffure', '!assurance', 'crédit', '!prêt personnel', '!prêt immobilier', '!immobilier', '!appartement à vendre', '!maison à vendre', '!à louer', '!agence', '!agence de voyage', '!dépannage', '!plombier', '!déménagement', '!nettoyage professionnel', '!location de voiture', '!hôtel', '!visa', '!avocat', 'consultation', '!soins à domicile', '!auto-école', '!lavage auto'],
      course: ['!formation', '!formations', '!cours en ligne', '!cours de', '!masterclass', '!webinaire', '!webinar', '!atelier', '!inscrivez-vous', '!inscription', '!inscriptions ouvertes', '!certifiante', '!diplôme', '!école', '!académie', '!coaching', '!conférence en ligne', '!séminaire', '!leçons', '!soutien scolaire', '!programme de formation'],
      event: ['!conférence', '!exposition', '!foire', '!concert', '!festival', '!billets', '!billetterie', '!événement', '!évènement', '!journée portes ouvertes', '!salon professionnel', '!rendez-vous le', 'soirée', '!gala'],
      store: ['!venez nous rendre visite', '!rendez-nous visite', '!en magasin', '!notre boutique située', '!notre magasin', 'adresse', '!ouvert du', '!ouvert tous les jours', '!horaires', "!horaires d'ouverture", '!nouvelle boutique', '!grande ouverture', '!nouvelle ouverture', '!ouverture de notre', '!showroom', '!succursale', '!itinéraire'],
      company: ['!recrutement', '!nous recrutons', '!on recrute', '!rejoignez notre équipe', '!offre d’emploi', "!offre d'emploi", '!franchise', '!devenez revendeur', '!devenez distributeur', 'notre entreprise', 'entreprise spécialisée', '!faites un don', 'association', 'votez'],
      digital: ["!téléchargez l'application", '!télécharger l’application', '!app store', '!google play', 'jouez', '!abonnement', '!logiciel', '!essai gratuit', '!ebook', '!e-book', '!guide pdf', '!crypto', '!trading', '!investissement', "!gagner de l'argent", '!revenus passifs', '!casino', '!paris sportifs'],
      food: ['!biscuits', '!gâteaux', '!gâteau', '!pâtisserie', '!pâtisseries', '!viennoiseries', '!chocolat', '!chocolats', '!miel', '!dattes', '!café', '!thé', '!confiserie', '!bonbons', '!pain de mie', '!pain maison', '!traiteur', '!restaurant', 'menu', '!plats', "!huile d'olive", '!épices', '!macarons', '!croissants', '!boulangerie', 'snack', '!pizza', '!burger', '!repas', '!livraison de repas', '!fruits secs', '!confiture', 'jus'],
      foodOk: ['moule', 'moules', 'emporte-pièce', 'machine', 'appareil', 'ustensile', 'plaque', 'moulin', 'presse', 'distributeur', 'cafetière', 'théière', 'tasse', 'mug', 'kit', 'accessoire', 'jouet', 'bougie', 'gommage', 'savon', 'masque', 'shampoing', 'crème', 'baume', 'tache', 'taches', 'parfum', 'support', 'organisateur', 'rangement'],
      bulky: ['!canapé', '!matelas', '!armoire', '!réfrigérateur', '!frigo', '!congélateur', '!machine à laver', '!lave-linge', '!lave-vaisselle', '!lit double', '!cadre de lit', '!sommier', '!table à manger', '!tapis de course', '!meuble', '!meubles', '!bureau', '!climatiseur', '!téléviseur', '!vélo électrique', '!trottinette électrique', '!baignoire', '!piano'],
      bulkyOk: ['rangement', 'bac', 'bacs', 'housse', 'protège', 'drap', 'draps', 'couvre', 'organisateur', 'support', 'mini', 'coussin', 'tapis', 'lampe', 'accessoire', 'accessoires', 'jouet', 'poignée', 'filtre', 'autocollant', 'nettoyant', 'brosse', 'télécommande', 'roulettes', 'pieds', 'cale', 'parfum', 'odeur', 'sac', 'chargeur', 'tablette', 'plateau'],
      fragile: ['!verrerie', '!vase', '!céramique', '!porcelaine', '!cristal', '!lustre', '!aquarium', '!miroir mural', '!grand miroir', '!bouteille en verre', '!bocal en verre', '!verres à vin', '!fragile', '!poterie'],
      fragileOk: ['trempé', 'protection écran', 'incassable', 'anti-casse', 'silicone', 'inox', 'acrylique', 'plastique', 'nettoyant', 'réparation', 'colle', 'antiadhésif', 'pompe', 'filtre', 'lumière'],
      cue: ['!livraison gratuite', '!paiement à la livraison', '!commandez', '!commander maintenant', '!acheter maintenant', '!ajouter au panier', '!stock limité', '!en stock', '!-50%', '!promo', 'soldes', 'réduction', 'offre', 'garantie', 'satisfait ou remboursé', 'pièces', 'lot de', 'livraison', 'prix']
    },
    ar: {
      service: ['!خدماتنا', '!نقدم خدمات', 'خدمة', 'خدمات', '!احجز موعدك', '!حجز موعد', '!احجز الآن', '!استشارة', '!استشارة مجانية', '!عيادة', '!عيادات', 'صالون', '!مركز تجميل', '!تأمين', '!قرض', '!تمويل', '!عقار', '!عقارات', '!شقة للبيع', '!شقق للبيع', '!للكراء', '!للإيجار', '!وكالة', '!وكالة سياحية', '!عمرة', '!تأشيرة', '!فيزا', '!محامي', 'صيانة', '!نقل أثاث', '!تنظيف المنازل', '!كراء السيارات', '!فندق', 'رحلات'],
      course: ['!دورة', '!دورة تدريبية', '!دورات', '!تكوين', '!تكوينات', '!ورشة', '!ورشات', '!ندوة', '!محاضرة', '!محاضرات', '!سجل الآن', '!التسجيل مفتوح', '!التسجيلات مفتوحة', '!أكاديمية', '!شهادة معتمدة', '!كورس', '!دروس', '!دروس خصوصية', 'مدرسة', '!معهد', 'تعلم', '!فورماسيون'],
      event: ['معرض', '!مؤتمر', '!ملتقى', '!حفل', '!تذاكر', '!فعالية', '!مهرجان', 'صالون'],
      store: ['!زورونا', '!زوروا محلنا', '!زوروا متجرنا', '!محلنا', 'العنوان', '!عنواننا', '!فرعنا', '!فرع جديد', '!افتتاح', '!الافتتاح', '!مفتوح يوميا', '!أوقات العمل', '!أوقات الدوام', '!الموقع على الخريطة', '!حانوت', '!معرضنا'],
      company: ['!شركتنا', '!توظيف', '!مطلوب للعمل', '!فرص عمل', '!فرصة عمل', '!نوظف', '!امتياز تجاري', '!فرانشايز', '!كن وكيلا', '!تبرع', '!جمعية', '!صوت'],
      digital: ['!حمل التطبيق', '!حمّل التطبيق', '!تحميل التطبيق', 'التطبيق', 'اشتراك', '!اشترك الآن', 'برنامج', '!كتاب إلكتروني', '!ملف pdf', '!تداول', '!فوركس', '!استثمار', '!اربح المال', '!الربح من الانترنت', '!عملات رقمية'],
      food: ['!حلويات', '!حلوى', '!كعك', '!بسكويت', '!كيك', '!كيكة', '!معجنات', '!مخبزة', '!مخبز', '!شوكولاتة', '!شكولاطة', '!عسل', '!تمر', '!تمور', '!قهوة', '!شاي', '!وجبات', '!وجبة', '!مطعم', '!بيتزا', '!برغر', 'أكل', '!ماكلة', '!زيت الزيتون', '!مكسرات', '!توابل', '!بهارات', '!عصير', '!مربى', '!خبز', '!بقلاوة', '!مقروط'],
      foodOk: ['قالب', 'قوالب', 'آلة', 'ماكينة', 'ماكنة', 'وعاء', 'أداة', 'أدوات', 'صينية', 'مطحنة', 'خلاط', 'كوب', 'فنجان', 'إبريق', 'ترمس', 'حافظة', 'منظم', 'لعبة', 'شمعة', 'صابون', 'ماسك', 'قناع', 'شامبو', 'كريم', 'مقشر', 'محمصة', 'طاولة', 'بقع', 'رائحة', 'سخان', 'حامل'],
      bulky: ['!ثلاجة', '!ثلاجات', '!غسالة', '!غسالات', '!خزانة ملابس', '!دولاب', '!كنبة', '!أريكة', '!سرير', '!طاولة سفرة', '!طاولة أكل', '!أثاث', '!تلفاز', '!تلفزيون', '!مكيف', '!سجاد كبير', '!دراجة كهربائية', '!سكوتر كهربائي', '!جهاز مشي', '!مفروشات', '!غرفة نوم', '!طقم صالون'],
      bulkyOk: ['غطاء', 'أغطية', 'مفرش', 'حامي', 'منظم', 'حامل', 'وسادة', 'مصباح', 'إكسسوار', 'لعبة', 'مقبض', 'فلتر', 'ملصق', 'منظف', 'فرشاة', 'جهاز تحكم', 'عجلات', 'شاحن'],
      fragile: ['=!مرآة حائط/مرآة جدارية/مرآة كبيرة/مراية كبيرة', '!فخار', '!مزهرية', '!فازة', '!ثريا', '!حوض سمك', '!أكواريوم', '!كؤوس', '!أواني زجاجية'],
      fragileOk: ['مقوى', 'لاصق حماية', 'واقي شاشة', 'غير قابل للكسر', 'ضد الكسر', 'سيليكون', 'ستانلس', 'بلاستيك', 'منظف'],
      cue: ['!التوصيل مجاني', '!توصيل مجاني', '!الدفع عند الاستلام', '!اطلب الآن', '!اطلبي الآن', '!اطلب', '!الكمية محدودة', '!دج', '!د.ج', '!ريال', '!درهم', '!جنيه', 'التوصيل', 'السعر', 'تخفيض', 'عرض', 'ضمان', 'قطع', 'متوفر']
    },
    es: {
      service: ['!nuestros servicios', '!ofrecemos', '!agenda tu cita', '!reserva tu cita', '!pide tu cita', '!consulta gratis', '!presupuesto gratis', '!cotización', '!clínica', '!consultorio', '!dentista', '!peluquería', '!salón de belleza', 'spa', '!seguro de vida', '!seguro de auto', '!seguros', '!préstamo', '!préstamos', '!hipoteca', '!inmobiliaria', '!se vende casa', '!se alquila', '!en renta', '!agencia', '!agencia de viajes', '!paquete turístico', 'hotel', '!abogado', '!fontanero', '!plomero', '!mudanzas', '!limpieza profesional', '!alquiler de coches', '!renta de autos', '!reparación de'],
      course: ['!curso', '!cursos', '!curso online', '!clases', '!clase gratis', '!masterclass', '!webinar', '!taller', '!talleres', '!inscríbete', '!inscripciones abiertas', '!matrícula', '!certificación', '!diplomado', '!academia', 'escuela', '!formación', '!capacitación', '!seminario', '!conferencia', '!tutorías'],
      event: ['!congreso', '!exposición', '!expo', '!feria', '!concierto', '!festival', 'entradas', '!boletos', '!evento', '!cumbre', '!gala'],
      store: ['!visítanos', '!visita nuestra tienda', '!nuestra tienda en', '!ubicados en', 'dirección', '!horario', '!abierto todos los días', '!gran apertura', '!nueva sucursal', '!sucursal', '!sucursales', '!showroom', '!cómo llegar', '!en tienda física'],
      company: ['!estamos contratando', '!únete a nuestro equipo', '!vacante', '!vacantes', '!empleo', '!franquicia', '!sé distribuidor', '!hazte distribuidor', 'nuestra empresa', 'empresa líder', '!dona', '!donación', 'vota'],
      digital: ['!descarga la app', '!descarga la aplicación', '!app store', '!google play', '!juega gratis', '!suscripción', '!suscríbete', '!software', '!prueba gratis', '!ebook', '!libro digital', '!plantillas', '!cripto', '!trading', '!invierte', '!inversión', '!gana dinero', '!ingresos pasivos', '!casino', '!apuestas'],
      food: ['!galletas', '!pastel', '!pasteles', '!tarta', '!tartas', '!pastelería', '!panadería', '!repostería', '!chocolate', '!chocolates', '!miel', '!dátiles', '!café', '!té', '!dulces', '!caramelos', '!pan casero', '!pan dulce', '!restaurante', 'menú', '!comida', '!comidas', '!pizza', '!hamburguesa', '!catering', '!especias', '!aceite de oliva', '!mermelada', '!frutos secos', '!postres', '!donas', '!empanadas', '!jugo', '!zumo'],
      foodOk: ['molde', 'moldes', 'cortador', 'cortadores', 'máquina', 'cafetera', 'bandeja', 'recipiente', 'molinillo', 'dispensador', 'kit', 'herramienta', 'organizador', 'taza', 'termo', 'vaso', 'juguete', 'vela', 'jabón', 'mascarilla', 'champú', 'crema', 'exfoliante', 'mancha', 'manchas', 'soporte'],
      bulky: ['!sofá', '!colchón', '!armario', '!ropero', '!refrigerador', '!nevera', '!frigorífico', '!lavadora', '!secadora', '!lavavajillas', 'cama', '!mesa de comedor', '!cinta de correr', '!caminadora', '!muebles', '!mueble', '!escritorio', '!aire acondicionado', '!televisor', '!bicicleta eléctrica', '!patinete eléctrico', '!bañera'],
      bulkyOk: ['funda', 'fundas', 'protector', 'sábana', 'sábanas', 'organizador', 'soporte', 'mini', 'cojín', 'alfombrilla', 'lámpara', 'accesorio', 'accesorios', 'juguete', 'manija', 'filtro', 'pegatina', 'limpiador', 'cepillo', 'control remoto', 'ruedas', 'patas', 'cargador', 'bandeja'],
      fragile: ['!cristalería', '!jarrón', '!cerámica', '!porcelana', '!cristal', '!candelabro', '!lámpara de araña', '!acuario', '!pecera', '!espejo de pared', '!botella de vidrio', '!frasco de vidrio', '!copas de vino', '!frágil'],
      fragileOk: ['templado', 'protector de pantalla', 'irrompible', 'silicona', 'acero inoxidable', 'acrílico', 'plástico', 'limpiador', 'reparación', 'pegamento', 'bomba', 'filtro'],
      cue: ['!envío gratis', '!envío gratuito', '!pago contra entrega', '!pago contraentrega', '!compra ahora', '!pide ya', '!pídelo ya', '!ordena ya', '!añadir al carrito', '!stock limitado', '!últimas unidades', '!en stock', 'oferta', 'descuento', 'rebajas', 'garantía', 'piezas', 'paquete de', 'envío', 'precio']
    },
    pt: {
      service: ['!nossos serviços', '!oferecemos', '!agende sua consulta', '!agende seu horário', '!consulta grátis', '!orçamento grátis', '!clínica', '!dentista', '!salão de beleza', '!seguro de vida', '!seguro de auto', '!seguros', '!empréstimo', '!financiamento', '!imobiliária', '!aluga-se', '!vende-se', '!agência', '!agência de viagens', '!pacote de viagem', 'hotel', '!advogado', '!encanador', '!mudanças', '!limpeza profissional', '!aluguel de carros', '!conserto de'],
      course: ['!curso', '!cursos', '!curso online', '!aulas', '!aula grátis', '!masterclass', '!webinar', '!oficina', '!workshop', '!inscreva-se', '!inscrições abertas', '!matrícula', '!certificado', '!academia de', 'escola', '!formação', '!capacitação', '!palestra', '!mentoria', '!treinamento'],
      event: ['!congresso', '!exposição', '!feira', '!festival', '!ingressos', '!evento', '!encontro', '!gala'],
      store: ['!visite nossa loja', '!venha nos visitar', '!nossa loja em', '!localizado em', 'endereço', '!horário de funcionamento', '!aberto todos os dias', '!inauguração', '!nova unidade', '!filial', '!showroom', '!como chegar'],
      company: ['!estamos contratando', '!vagas', '!vaga de emprego', '!trabalhe conosco', '!franquia', '!seja revendedor', '!seja distribuidor', 'nossa empresa', 'empresa líder', '!doe', '!doação', 'vote'],
      digital: ['!baixe o app', '!baixe o aplicativo', '!app store', '!google play', '!jogue grátis', '!assinatura', '!assine', '!software', '!teste grátis', '!ebook', '!e-book', '!cripto', '!trading', '!invista', '!investimento', '!ganhe dinheiro', '!renda extra', '!renda passiva', '!cassino', '!apostas'],
      food: ['!biscoitos', '!bolachas', '!bolo', '!bolos', '!confeitaria', '!padaria', '!doces', '!chocolate', '!chocolates', '!mel', '!tâmaras', '!café', '!chá', '!balas', '!pão', '!restaurante', '!cardápio', '!marmitas', '!comida', '!pizza', '!hambúrguer', '!salgados', '!temperos', '!azeite', '!geleia', '!castanhas', '!sobremesas', '!brigadeiro', '!suco'],
      foodOk: ['forma', 'formas', 'cortador', 'máquina', 'cafeteira', 'bandeja', 'moedor', 'dispensador', 'kit', 'ferramenta', 'organizador', 'caneca', 'garrafa térmica', 'copo', 'brinquedo', 'vela', 'sabonete', 'máscara', 'shampoo', 'creme', 'esfoliante', 'mancha', 'manchas', 'suporte'],
      bulky: ['!sofá', '!colchão', '!guarda-roupa', '!armário', '!geladeira', '!freezer', '!máquina de lavar', '!lava-louças', '!cama box', 'cama', '!mesa de jantar', '!esteira', '!móveis', '!escrivaninha', '!ar-condicionado', '!televisão', '!bicicleta elétrica', '!patinete elétrico', '!banheira'],
      bulkyOk: ['capa', 'capas', 'protetor', 'lençol', 'organizador', 'suporte', 'mini', 'almofada', 'tapete', 'luminária', 'acessório', 'acessórios', 'brinquedo', 'puxador', 'filtro', 'adesivo', 'limpador', 'escova', 'controle', 'rodinhas', 'pés', 'carregador', 'bandeja'],
      fragile: ['!cristaleira', '!vaso decorativo', '!cerâmica', '!porcelana', '!cristal', '!lustre', '!aquário', '!espelho de parede', '!garrafa de vidro', '!pote de vidro', '!taças', '!frágil'],
      fragileOk: ['temperado', 'película', 'inquebrável', 'silicone', 'inox', 'acrílico', 'plástico', 'limpador', 'reparo', 'cola', 'bomba', 'filtro'],
      cue: ['!frete grátis', '!entrega grátis', '!pagamento na entrega', '!compre agora', '!peça já', '!garanta o seu', '!adicionar ao carrinho', '!estoque limitado', '!últimas unidades', 'oferta', 'desconto', 'promoção', 'garantia', 'peças', 'kit com', 'entrega', 'preço']
    },
    de: {
      service: ['!unsere leistungen', '!wir bieten', '!termin vereinbaren', '!jetzt termin buchen', '!kostenlose beratung', '!kostenloses angebot', '!praxis', '!zahnarzt', '!friseur', '!kosmetikstudio', '!versicherung', '!kredit', '!darlehen', '!immobilien', '!zu vermieten', '!zu verkaufen', '!agentur', '!reisebüro', '!pauschalreise', 'hotel', '!anwalt', '!klempner', '!umzug', '!umzugsfirma', '!reinigungsservice', '!autovermietung', '!reparaturservice'],
      course: ['!kurs', '!kurse', '!onlinekurs', '!online-kurs', '!masterclass', '!webinar', '!workshop', '!seminar', '!jetzt anmelden', '!anmeldung', '!zertifikat', '!ausbildung', '!weiterbildung', '!akademie', 'schule', '!coaching', '!unterricht', '!nachhilfe'],
      event: ['!konferenz', '!messe', '!ausstellung', '!konzert', '!festival', 'tickets', '!veranstaltung', 'event', '!gala'],
      store: ['!besuchen sie uns', '!besuche uns', '!in unserem laden', '!in unserem geschäft', 'adresse', '!öffnungszeiten', '!täglich geöffnet', '!neueröffnung', '!eröffnung', '!filiale', '!showroom', '!anfahrt'],
      company: ['!wir stellen ein', '!jetzt bewerben', '!stellenangebot', '!karriere', '!werde teil unseres teams', '!franchise', '!vertriebspartner', 'unser unternehmen', 'führender anbieter', '!jetzt spenden', '!spende', '!wählen sie'],
      digital: ['!app herunterladen', '!lade die app', '!app store', '!google play', '!jetzt spielen', '!abonnement', 'abo', '!software', '!kostenlos testen', '!e-book', '!ebook', '!krypto', '!trading', '!investieren', '!geld verdienen', '!passives einkommen', '!casino', '!sportwetten'],
      food: ['!kekse', '!plätzchen', '!kuchen', '!torte', '!torten', '!gebäck', '!bäckerei', '!konditorei', '!schokolade', '!pralinen', '!honig', '!datteln', '!kaffee', 'tee', '!süßigkeiten', '!brot', '!restaurant', '!speisekarte', '!lieferdienst', '!pizza', '!burger', '!gewürze', '!olivenöl', '!marmelade', '!nüsse', '!desserts', '!saft'],
      foodOk: ['form', 'formen', 'ausstecher', 'maschine', 'kaffeemaschine', 'blech', 'behälter', 'glas', 'mühle', 'spender', 'werkzeug', 'organizer', 'tasse', 'becher', 'thermoskanne', 'spielzeug', 'kerze', 'seife', 'maske', 'shampoo', 'creme', 'peeling', 'fleck', 'flecken', 'halter'],
      bulky: ['!sofa', '!couch', '!matratze', '!kleiderschrank', '!kühlschrank', '!gefrierschrank', '!waschmaschine', '!trockner', '!spülmaschine', '!bett', '!bettgestell', '!esstisch', '!laufband', '!möbel', '!schreibtisch', '!klimaanlage', '!fernseher', '!e-bike', '!e-scooter', '!badewanne'],
      bulkyOk: ['bezug', 'bezüge', 'schutz', 'laken', 'organizer', 'halter', 'halterung', 'mini', 'kissen', 'matte', 'lampe', 'zubehör', 'spielzeug', 'griff', 'filter', 'aufkleber', 'reiniger', 'bürste', 'fernbedienung', 'rollen', 'füße', 'ladegerät', 'tablett'],
      fragile: ['!glaswaren', '!vase', '!keramik', '!porzellan', '!kristall', '!kronleuchter', '!aquarium', '!wandspiegel', '!glasflasche', '!weingläser', '!zerbrechlich'],
      fragileOk: ['gehärtet', 'panzerglas', 'displayschutz', 'unzerbrechlich', 'bruchsicher', 'silikon', 'edelstahl', 'acryl', 'kunststoff', 'reiniger', 'reparatur', 'kleber', 'pumpe', 'filter'],
      cue: ['!kostenloser versand', '!versandkostenfrei', '!gratis versand', '!jetzt bestellen', '!jetzt kaufen', '!in den warenkorb', '!nur noch wenige', '!auf lager', '!begrenzter vorrat', 'angebot', 'rabatt', 'sale', 'garantie', 'stück', 'set', 'versand', 'preis']
    },
    it: {
      service: ['!i nostri servizi', '!offriamo', '!prenota un appuntamento', '!prenota ora', '!consulenza gratuita', '!preventivo gratuito', '!clinica', '!studio dentistico', '!dentista', '!parrucchiere', '!centro estetico', '!assicurazione', '!prestito', '!finanziamento', '!immobiliare', '!affittasi', '!vendesi', '!agenzia', '!agenzia viaggi', '!pacchetto vacanza', 'hotel', '!avvocato', '!idraulico', '!traslochi', '!pulizie professionali', '!noleggio auto', '!riparazione'],
      course: ['!corso online', '!corso di', '!il corso', '!corsi', '!corso online', '!masterclass', '!webinar', '!workshop', '!laboratorio', '!iscriviti', '!iscrizioni aperte', '!certificazione', '!diploma', '!accademia', 'scuola', '!formazione', '!lezioni', '!seminario', '!coaching'],
      event: ['!conferenza', '!fiera', "!mostra d'arte", '!esposizione', '!concerto', '!festival', '!biglietti', '!evento', '!gala'],
      store: ['!vieni a trovarci', '!visita il nostro negozio', '!nel nostro negozio', 'indirizzo', '!orari di apertura', '!aperto tutti i giorni', '!inaugurazione', '!nuova apertura', '!filiale', '!showroom', '!come raggiungerci'],
      company: ['!stiamo assumendo', '!lavora con noi', '!offerta di lavoro', '!candidati', '!franchising', '!diventa rivenditore', '!diventa distributore', 'la nostra azienda', 'azienda leader', '!dona ora', '!donazione', 'vota'],
      digital: ["!scarica l'app", '!app store', '!google play', '!gioca gratis', '!abbonamento', '!abbonati', '!software', '!prova gratuita', '!ebook', '!e-book', '!cripto', '!trading', '!investi', '!investimento', '!guadagna', '!rendita passiva', '!casinò', '!scommesse'],
      food: ['!biscotti', '!torta', '!torte', 'dolci', '!pasticceria', '!panetteria', '!cioccolato', '!cioccolatini', '!miele', '!datteri', '!caffè', '!tè', '!caramelle', '!pane', '!ristorante', '!menù', '!pizza', '!hamburger', '!spezie', "!olio d'oliva", '!olio extravergine', '!marmellata', '!frutta secca', '!dessert', '!panettone', '!succo'],
      foodOk: ['stampo', 'stampi', 'tagliabiscotti', 'macchina', 'macchinetta', 'teglia', 'contenitore', 'macinino', 'dispenser', 'kit', 'attrezzo', 'organizer', 'tazza', 'termos', 'bicchiere', 'giocattolo', 'candela', 'sapone', 'maschera', 'shampoo', 'crema', 'scrub', 'macchia', 'macchie', 'supporto'],
      bulky: ['!divano', '!materasso', '!armadio', '!frigorifero', '!congelatore', '!lavatrice', '!asciugatrice', '!lavastoviglie', 'letto', '!tavolo da pranzo', '!tapis roulant', '!mobili', '!scrivania', '!condizionatore', '!televisore', '!bici elettrica', '!monopattino elettrico', '!vasca da bagno'],
      bulkyOk: ['copridivano', 'fodera', 'coprimaterasso', 'lenzuola', 'organizer', 'supporto', 'mini', 'cuscino', 'tappetino', 'lampada', 'accessorio', 'accessori', 'giocattolo', 'maniglia', 'filtro', 'adesivo', 'detergente', 'spazzola', 'telecomando', 'ruote', 'piedini', 'caricatore', 'vassoio'],
      fragile: ['!cristalleria', '!vaso', '!ceramica', '!porcellana', '!cristallo', '!lampadario', '!acquario', '!specchio da parete', '!bottiglia di vetro', '!barattolo di vetro', '!calici', '!fragile'],
      fragileOk: ['temperato', 'pellicola', 'infrangibile', 'silicone', 'acciaio inox', 'acrilico', 'plastica', 'detergente', 'riparazione', 'colla', 'pompa', 'filtro'],
      cue: ['!spedizione gratuita', '!consegna gratuita', '!pagamento alla consegna', '!ordina ora', '!acquista ora', '!compra ora', '!aggiungi al carrello', '!scorte limitate', '!disponibile', 'offerta', 'sconto', 'saldi', 'garanzia', 'pezzi', 'set da', 'spedizione', 'prezzo']
    },
    tr: {
      service: ['!hizmetlerimiz', '!hizmet', '!randevu alın', '!randevu için', '!ücretsiz danışmanlık', '!ücretsiz teklif', '!klinik', '!diş hekimi', '!kuaför', '!güzellik merkezi', '!sigorta', '!kredi başvurusu', '!ihtiyaç kredisi', '!emlak', '!kiralık', '!satılık', '!ajans', '!seyahat acentesi', '!tur paketi', '!otel', '!avukat', '!tesisatçı', '!nakliyat', '!temizlik hizmeti', '!araç kiralama', '!tamir servisi'],
      course: ['!kurs', '!kursu', '!online eğitim', 'eğitim', '!eğitimi', '!masterclass', '!webinar', '!atölye', '!seminer', '!hemen kaydol', '!kayıtlar başladı', '!sertifika', '!sertifikalı', '!akademi', 'okul', '!ders', '!dersleri', '!koçluk'],
      event: ['!konferans', '!fuar', '!sergi', '!konser', '!festival', '!bilet', '!biletler', '!etkinlik', '!zirve'],
      store: ['!mağazamıza bekliyoruz', '!mağazamızı ziyaret', 'adres', '!adresimiz', '!çalışma saatleri', '!her gün açık', '!açılış', '!yeni şubemiz', '!şube', '!şubelerimiz', '!showroom', '!yol tarifi'],
      company: ['!personel alımı', '!eleman aranıyor', '!iş ilanı', '!kariyer', '!ekibimize katıl', '!franchise', '!bayilik', '!bayi ol', 'şirketimiz', 'lider firma', '!bağış', '!oy verin'],
      digital: ['!uygulamayı indir', '!app store', '!google play', '!hemen oyna', '!abonelik', '!abone ol', '!yazılım', '!ücretsiz deneme', '!e-kitap', '!kripto', '!borsa', '!yatırım', '!para kazan', '!pasif gelir', '!casino', '!bahis'],
      food: ['!kurabiye', '!bisküvi', '!pasta', '!kek', '!pastane', '!fırın', '!tatlı', '!tatlılar', '!çikolata', '!bal', '!hurma', '!kahve', '!çay', 'şeker', '!lokum', '!baklava', '!ekmek', '!restoran', '!menü', '!yemek', '!pizza', '!hamburger', '!baharat', '!zeytinyağı', '!reçel', '!kuruyemiş', '!meyve suyu'],
      foodOk: ['kalıp', 'kalıbı', 'kesici', 'makinesi', 'makine', 'tepsi', 'saklama', 'öğütücü', 'dispenser', 'aparat', 'düzenleyici', 'kupa', 'termos', 'bardak', 'oyuncak', 'mum', 'sabun', 'maske', 'şampuan', 'krem', 'peeling', 'leke', 'standı'],
      bulky: ['!koltuk takımı', '!kanepe', '!yatak', '!gardırop', '!buzdolabı', '!derin dondurucu', '!çamaşır makinesi', '!kurutma makinesi', '!bulaşık makinesi', '!yemek masası', '!koşu bandı', '!mobilya', '!çalışma masası', '!klima', '!televizyon', '!elektrikli bisiklet', '!elektrikli scooter', '!küvet'],
      bulkyOk: ['kılıfı', 'örtüsü', 'koruyucu', 'çarşaf', 'düzenleyici', 'tutucu', 'mini', 'yastık', 'paspas', 'lamba', 'aksesuar', 'aksesuarı', 'oyuncak', 'kulp', 'filtre', 'etiket', 'temizleyici', 'fırça', 'kumanda', 'tekerlek', 'ayak', 'şarj', 'tepsi'],
      fragile: ['!cam eşya', '!vazo', '!seramik', '!porselen', '!kristal', '!avize', '!akvaryum', '!duvar aynası', '!cam şişe', '!cam kavanoz', '!kadeh', '!kırılabilir'],
      fragileOk: ['temperli', 'ekran koruyucu', 'kırılmaz', 'silikon', 'paslanmaz', 'akrilik', 'plastik', 'temizleyici', 'tamir', 'yapıştırıcı', 'pompa', 'filtre'],
      cue: ['!ücretsiz kargo', '!kargo bedava', '!kapıda ödeme', '!hemen sipariş', '!sipariş ver', '!satın al', '!sepete ekle', '!sınırlı stok', '!stokta', 'indirim', 'kampanya', 'fırsat', 'garanti', 'adet', 'set', 'kargo', 'fiyat', '₺', 'tl']
    },
    id: {
      service: ['!jasa', '!layanan kami', '!melayani', '!konsultasi gratis', '!booking sekarang', '!reservasi', '!klinik', '!dokter gigi', '!salon', '!asuransi', '!pinjaman', '!pinjol', '!kredit', '!kpr', '!properti', '!rumah dijual', '!disewakan', 'sewa', '!rental mobil', '!travel umroh', '!umroh', '!paket wisata', 'hotel', '!agen travel', '!pengacara', '!tukang', '!servis ac', '!laundry kiloan', '!cuci mobil', '!ekspedisi'],
      course: ['!kursus', '!kelas online', '!kelas gratis', '!pelatihan', '!webinar', '!seminar', '!workshop', '!bimbel', '!les privat', '!daftar sekarang', '!pendaftaran dibuka', '!sertifikasi', '!bersertifikat', '!akademi', 'sekolah', '!kuliah', '!mentoring', '!coaching', '!ebook'],
      event: ['acara', '!pameran', '!expo', '!konser', '!festival', '!tiket', 'event', '!gathering', '!talkshow'],
      store: ['!kunjungi toko kami', '!datang langsung ke toko', 'alamat', '!lokasi toko', '!cabang', '!cabang baru', '!grand opening', '!buka setiap hari', '!jam buka', '!jam operasional', '!showroom', '!outlet kami'],
      company: ['!lowongan', '!loker', '!lowongan kerja', '!kami membuka', '!bergabung bersama kami', '!kemitraan', '!franchise', '!waralaba', '!peluang usaha', 'perusahaan kami', '!donasi', '!sedekah', '!pilih nomor'],
      digital: ['!download aplikasi', '!unduh aplikasi', '!app store', '!google play', '!main sekarang', '!top up', '!langganan', 'aplikasi', '!software', '!gratis trial', '!e-book', '!kripto', '!trading', '!investasi', '!saham', '!cuan', '!penghasilan tambahan', '!slot', '!judi'],
      food: ['!kue', '!kue kering', '!biskuit', '!cookies', '!roti', '!bakery', '!cokelat', '!coklat', '!madu', '!kurma', '!kopi', '!teh', '!camilan', '!cemilan', 'snack', '!makanan', '!keripik', '!sambal', '!frozen food', '!katering', '!catering', '!restoran', 'menu', '!nasi', '!bolu', '!brownies', '!dessert', '!minuman', 'jus', '!rendang', '!abon'],
      foodOk: ['cetakan', 'loyang', 'mesin', 'alat', 'gilingan', 'dispenser', 'organizer', 'mug', 'gelas', 'termos', 'tumbler', 'mainan', 'lilin', 'sabun', 'masker', 'sampo', 'shampo', 'krim', 'scrub', 'noda', 'rak', 'pemanggang', 'toaster', 'penanak', 'rice cooker', 'magic com', 'botol'],
      bulky: ['!sofa', '!kasur', '!springbed', '!lemari', '!lemari pakaian', '!kulkas', '!mesin cuci', '!ranjang', '!tempat tidur', '!meja makan', '!treadmill', '!furniture', '!mebel', '!meja kerja', 'ac', '!televisi', '!sepeda listrik', '!motor listrik', '!bathtub'],
      bulkyOk: ['sarung', 'cover', 'sprei', 'pelindung', 'organizer', 'holder', 'mini', 'bantal', 'keset', 'lampu', 'aksesoris', 'mainan', 'gagang', 'filter', 'stiker', 'pembersih', 'sikat', 'remote', 'roda', 'kaki', 'charger', 'nampan', 'rak'],
      fragile: ['!vas bunga', '!guci', '!keramik', '!porselen', '!kristal', '!lampu gantung kristal', '!akuarium', '!aquarium', '!cermin dinding', '!botol kaca', '!toples kaca', '!gelas kaca', '!pecah belah', '!mudah pecah'],
      fragileOk: ['tempered', 'anti gores', 'antigores', 'anti pecah', 'tidak mudah pecah', 'silikon', 'stainless', 'akrilik', 'plastik', 'pembersih', 'lem', 'pompa', 'filter'],
      cue: ['!gratis ongkir', '!free ongkir', '!bisa cod', '!cod', '!bayar di tempat', '!order sekarang', '!beli sekarang', '!checkout sekarang', '!stok terbatas', '!ready stock', '!klik link', 'diskon', 'promo', 'harga', 'garansi', 'pcs', 'isi', 'rp', 'ongkir', 'keranjang kuning']
    },
    ms: {
      service: ['!perkhidmatan', '!servis', '!tempahan', '!buat temujanji', '!konsultasi percuma', '!klinik', '!salon', '!insurans', '!pinjaman', '!hartanah', '!rumah untuk dijual', '!untuk disewa', '!sewa kereta', '!pakej umrah', '!pakej pelancongan', 'hotel', '!agensi', '!peguam', '!tukang paip', '!pindah rumah', '!cuci kereta'],
      course: ['!kursus', '!kelas online', '!kelas percuma', '!latihan', '!webinar', '!seminar', '!bengkel', '!daftar sekarang', '!pendaftaran dibuka', '!sijil', '!akademi', '!tuisyen', '!coaching'],
      event: ['acara', '!pameran', '!ekspo', '!konsert', '!festival', '!tiket', '!karnival'],
      store: ['!kunjungi kedai kami', '!datang ke kedai', 'alamat', '!cawangan', '!cawangan baru', '!grand opening', '!dibuka setiap hari', '!waktu operasi', '!showroom'],
      company: ['!jawatan kosong', '!kami mengambil pekerja', '!sertai pasukan kami', '!francais', '!peluang perniagaan', '!jadi ejen', '!jadi stokis', 'syarikat kami', '!derma', 'undi'],
      digital: ['!muat turun aplikasi', '!app store', '!google play', '!main sekarang', '!langganan', 'aplikasi', '!perisian', '!e-book', '!kripto', '!trading', '!pelaburan', '!pendapatan pasif', '!judi'],
      food: ['!kuih', '!biskut', '!kek', '!roti', '!coklat', '!madu', '!kurma', '!kopi', '!teh', '!snek', '!makanan', '!kerepek', '!sambal', '!frozen food', '!katering', '!restoran', 'menu', '!nasi lemak', '!dessert', '!minuman', 'jus'],
      foodOk: ['acuan', 'loyang', 'mesin', 'alat', 'pengisar', 'dispenser', 'mug', 'cawan', 'termos', 'tumbler', 'mainan', 'lilin', 'sabun', 'topeng', 'syampu', 'krim', 'skrub', 'kotoran', 'rak'],
      bulky: ['!sofa', '!tilam', '!almari', '!peti sejuk', '!mesin basuh', '!katil', '!meja makan', '!treadmill', '!perabot', '!penghawa dingin', '!televisyen', '!basikal elektrik'],
      bulkyOk: ['sarung', 'cover', 'cadar', 'pelindung', 'organizer', 'pemegang', 'mini', 'bantal', 'lampu', 'aksesori', 'mainan', 'penapis', 'pelekat', 'pembersih', 'berus', 'alat kawalan', 'roda', 'kaki', 'pengecas', 'dulang'],
      fragile: ['!pasu', '!seramik', '!porselin', '!kristal', '!akuarium', '!cermin dinding', '!botol kaca', '!balang kaca', '!mudah pecah'],
      fragileOk: ['tempered', 'pelindung skrin', 'tidak mudah pecah', 'silikon', 'keluli tahan karat', 'akrilik', 'plastik', 'pembersih', 'gam'],
      cue: ['!penghantaran percuma', '!free shipping', '!cod', '!bayar semasa terima', '!order sekarang', '!beli sekarang', '!stok terhad', '!ready stock', 'diskaun', 'promosi', 'harga', 'jaminan', 'pcs', 'rm', 'pos']
    },
    vi: {
      service: ['!dịch vụ', '!đặt lịch', '!đặt lịch hẹn', '!tư vấn miễn phí', '!phòng khám', '!nha khoa', 'spa', '!thẩm mỹ viện', '!salon tóc', '!bảo hiểm', '!vay vốn', '!cho vay', '!bất động sản', '!căn hộ', '!bán nhà', '!cho thuê', '!thuê xe', '!tour du lịch', '!khách sạn', '!luật sư', '!sửa chữa tận nơi', '!chuyển nhà', '!vệ sinh công nghiệp', '!rửa xe', '!đại lý vé'],
      course: ['!khóa học', '!khoá học', '!lớp học', '!học online', '!đăng ký học', '!hội thảo', '!workshop', '!webinar', '!đào tạo', '!chứng chỉ', '!học viện', 'trung tâm', '!tuyển sinh', '!buổi học', '!coaching', '!giáo trình'],
      event: ['!sự kiện', '!triển lãm', '!hội chợ', '!vé', '!concert', '!lễ hội', '!buổi hòa nhạc', '!hội nghị'],
      store: ['!ghé cửa hàng', '!ghé shop', '!đến cửa hàng', 'địa chỉ', '!chi nhánh', '!khai trương', '!giờ mở cửa', '!mở cửa từ', '!showroom', '!cửa hàng tại'],
      company: ['!tuyển dụng', '!tuyển nhân viên', '!việc làm', '!nhượng quyền', '!tuyển đại lý', '!tuyển ctv', '!tuyển cộng tác viên', 'công ty chúng tôi', '!quyên góp', '!từ thiện', '!bầu chọn'],
      digital: ['!tải app', '!tải ứng dụng', '!app store', '!google play', '!chơi ngay', '!gói cước', '!đăng ký gói', '!phần mềm', '!dùng thử miễn phí', '!ebook', '!tiền ảo', '!coin', '!chứng khoán', '!đầu tư', '!kiếm tiền online', '!thu nhập thụ động', '!cá cược'],
      food: ['!bánh quy', '!bánh tráng', '!bánh pía', '!bánh ngọt', '!bánh kem', '!bánh mì', '!bánh trung thu', '!kẹo', '!sô cô la', '!socola', '!mật ong', '!cà phê', '!trà', '!đồ ăn vặt', '!ăn vặt', '!nhà hàng', '!thực đơn', '!món ăn', '!đặc sản', '!hạt dinh dưỡng', '!khô gà', '!bò khô', '!trà sữa', '!nước ép', '!cơm', '!bún', '!phở', '!lẩu', '!đồ ăn'],
      foodOk: ['khuôn', 'máy', 'dụng cụ', 'khay', 'bình', 'cối', 'kệ', 'cốc', 'ly', 'giữ nhiệt', 'đồ chơi', 'nến', 'xà phòng', 'mặt nạ', 'dầu gội', 'kem', 'tẩy tế bào', 'vết bẩn', 'nồi', 'chảo'],
      bulky: ['!sofa', '!ghế sofa', '!nệm', '!đệm', '!tủ quần áo', '!tủ lạnh', '!máy giặt', '!máy sấy', '!máy rửa bát', '!giường', '!bàn ăn', '!máy chạy bộ', '!nội thất', '!bàn làm việc', '!điều hòa', '!tivi', '!xe đạp điện', '!xe máy điện', '!bồn tắm'],
      bulkyOk: ['bọc', 'vỏ bọc', 'ga', 'drap', 'tấm phủ', 'kệ để', 'mini', 'gối', 'thảm', 'đèn', 'phụ kiện', 'đồ chơi', 'tay nắm', 'lọc', 'miếng dán', 'vệ sinh', 'chổi', 'điều khiển', 'bánh xe', 'chân', 'sạc', 'khay'],
      fragile: ['!thủy tinh', '!đồ gốm', '!gốm sứ', '!sứ', '!pha lê', '!đèn chùm', '!bể cá', '!gương treo tường', '!bình hoa', '!lọ hoa', '!chai thủy tinh', '!hũ thủy tinh', '!ly thủy tinh', '!dễ vỡ'],
      fragileOk: ['cường lực', 'kính cường lực', 'dán màn hình', 'không vỡ', 'chống vỡ', 'silicon', 'inox', 'acrylic', 'nhựa', 'vệ sinh', 'keo'],
      cue: ['!freeship', '!miễn phí vận chuyển', '!giao hàng toàn quốc', '!thanh toán khi nhận hàng', '!nhận hàng mới thanh toán', '!đặt hàng ngay', '!mua ngay', '!inbox ngay', '!số lượng có hạn', '!sale', 'giảm giá', 'khuyến mãi', 'bảo hành', 'chính hãng', 'giá', 'cod', 'vnđ']
    },
    tl: {
      service: ['!serbisyo', 'book now', '!appointment', '!pa-appointment', '!clinic', '!salon', '!insurance', '!loan', '!pautang', '!condo', '!house and lot', '!for rent', '!paupahan', '!car rental', '!travel and tours', '!tour package', 'hotel', 'resort', '!abogado', '!aircon cleaning', '!plumbing', '!lipat bahay', '!car wash'],
      course: ['!seminar', '!webinar', 'training', '!klase', '!online class', '!enroll na', '!enrollment', '!workshop', '!this course', '!our course', '!free course', '!the course', '!course starts', '!review center', '!tutorial', '!coaching', '!certificate'],
      event: ['event', '!concert', 'tickets', '!expo', '!festival', 'fiesta'],
      store: ['!bisitahin', '!visit our store', '!puntahan', '!located at', 'address', '!branch', '!bagong branch', '!grand opening', '!open daily', '!bukas araw-araw', '!showroom'],
      company: ['!hiring', "!we're hiring", '!naghahanap', '!job opening', '!franchise', '!reseller wanted', '!negosyo package', '!business opportunity', 'donate', 'iboto'],
      digital: ['!download the app', '!i-download', '!app store', '!google play', 'laro', 'subscription', '!software', '!ebook', '!crypto', '!trading', '!investment', '!kumita online', '!extra income', '!casino', '!sabong'],
      food: ['!cookies', '!cake', '!tinapay', '!pandesal', '!kakanin', '!pastries', '!chocolate', '!honey', '!kape', '!coffee', '!snacks', '!ulam', '!pagkain', '!meal', '!restaurant', 'menu', '!catering', '!lechon', '!longganisa', '!polvoron', '!ube', '!leche flan', '!milk tea', 'juice', 'food'],
      foodOk: ['molder', 'mold', 'maker', 'machine', 'lalagyan', 'container', 'tray', 'kit', 'tool', 'tumbler', 'mug', 'laruan', 'kandila', 'sabon', 'mask', 'shampoo', 'cream', 'scrub', 'mantsa', 'kaldero', 'kawali'],
      bulky: ['!sofa', '!kama', '!kutson', '!foam mattress', '!aparador', 'ref', '!refrigerator', '!washing machine', '!dining table', '!treadmill', '!furniture', '!aircon', '!tv', '!e-bike', '!ebike'],
      bulkyOk: ['cover', 'kobre', 'punda', 'protector', 'organizer', 'holder', 'mini', 'unan', 'lamp', 'mount', 'stand', 'box', 'accessories', 'laruan', 'handle', 'filter', 'sticker', 'cleaner', 'brush', 'remote', 'gulong', 'charger', 'tray'],
      fragile: ['!babasagin', '!vase', '!ceramic', '!porcelain', '!crystal', '!aquarium', '!wall mirror', '!glass bottle', '!glass jar', '!fragile'],
      fragileOk: ['tempered', 'screen protector', 'hindi nababasag', 'unbreakable', 'silicone', 'stainless', 'acrylic', 'plastic', 'cleaner'],
      cue: ['!cod', '!cash on delivery', '!free shipping', '!order na', '!mag-order na', '!check out', '!add to cart', '!limited stocks', '!sale', 'sulit', 'promo', 'presyo', 'warranty', 'pcs', '₱', 'php']
    },
    hi: {
      service: ['service', '!services', 'booking', '!appointment', '!clinic', '!salon', '!insurance', '!loan', '!property', '!flat for sale', '!for rent', '!kiraye', '!travel agency', '!tour package', 'hotel', '!lawyer', '!vakil', '!repair service', '!packers and movers', '!सेवा', '!बुकिंग', '!क्लिनिक', '!बीमा', '!लोन', '!प्रॉपर्टी', '!किराये'],
      course: ['!this course', '!our course', '!free course', '!the course', '!course starts', '!classes', '!coaching', '!webinar', '!seminar', '!workshop', 'training', '!admission open', '!admissions open', '!enroll', '!certificate', '!institute', '!academy', '!tuition', '!कोर्स', '!कक्षा', '!कोचिंग', '!प्रशिक्षण', '!सेमिनार', '!एडमिशन', '!दाखिला'],
      event: ['event', '!exhibition', '!expo', '!mela', '!concert', 'tickets', '!मेला', '!प्रदर्शनी', '!कार्यक्रम'],
      store: ['!visit our store', '!visit our showroom', '!showroom', 'address', '!branch', '!shop no', '!grand opening', '!open daily', '!दुकान पर', 'पता', '!शोरूम'],
      company: ['!hiring', '!vacancy', '!naukri', 'job', '!franchise', '!dealership', '!distributorship', '!नौकरी', '!भर्ती', '!फ्रेंचाइजी', 'donate', '!दान', 'vote'],
      digital: ['!download app', '!app download', '!app store', '!google play', '!play now', 'subscription', '!software', '!ebook', '!crypto', '!trading', '!share market', '!investment', '!earn money', '!paise kamaye', '!online earning', '!पैसे कमाएं', '!betting', '!fantasy'],
      food: ['!mithai', '!मिठाई', '!namkeen', '!नमकीन', '!biscuit', '!cookies', '!cake', '!chocolate', '!honey', '!shahad', '!शहद', '!chai', '!चाय', '!coffee', '!achar', '!अचार', '!masala', '!मसाला', '!ghee', '!घी', '!sweets', '!restaurant', '!thali', '!tiffin', '!dry fruits', '!ड्राई फ्रूट्स', 'khana', '!खाना'],
      foodOk: ['mould', 'mold', 'maker', 'machine', 'container', 'tray', 'grinder', 'kit', 'tool', 'mug', 'cup', 'flask', 'toy', 'candle', 'soap', 'mask', 'shampoo', 'cream', 'scrub', 'daag', 'stand', 'मशीन', 'डिब्बा', 'साबुन'],
      bulky: ['!sofa', '!mattress', '!almirah', '!palang', '!fridge', '!refrigerator', '!washing machine', '!double bed', '!dining table', '!treadmill', '!furniture', 'AC', '!television', '!electric scooter', '!सोफा', '!अलमारी', '!पलंग', '!फ्रिज'],
      bulkyOk: ['cover', 'protector', 'bedsheet', 'organizer', 'holder', 'stand', 'mini', 'cushion', 'mat', 'lamp', 'accessories', 'toy', 'handle', 'filter', 'sticker', 'cleaner', 'brush', 'remote', 'wheels', 'charger', 'tray'],
      fragile: ['!kaanch', '!काँच', '!कांच', '!glassware', '!vase', '!ceramic', '!porcelain', '!crystal', '!chandelier', '!aquarium', '!glass bottle', '!glass jar', '!fragile'],
      fragileOk: ['tempered', 'screen guard', 'screen protector', 'unbreakable', 'silicone', 'stainless steel', 'steel', 'acrylic', 'plastic', 'cleaner'],
      cue: ['!cod', '!cash on delivery', '!free delivery', '!free shipping', '!order now', '!buy now', '!abhi order', '!limited stock', '!offer', 'discount', 'sale', 'price', 'warranty', 'pcs', 'set of', 'रुपये', 'ऑर्डर']
    },
    ur: {
      service: ['service', '!services', 'booking', '!appointment', '!clinic', '!salon', '!insurance', '!loan', '!property', '!plot for sale', '!for rent', '!kiraye', '!travel agency', '!umrah package', '!tour package', 'hotel', '!lawyer', '!wakeel', '!repair service', '!سروس', '!کلینک', '!بکنگ', '!پراپرٹی', '!قرض', '!عمرہ پیکج'],
      course: ['!this course', '!our course', '!free course', '!the course', '!course starts', '!classes', '!admission', '!admissions open', '!webinar', '!seminar', '!workshop', 'training', '!academy', '!institute', '!tuition', '!certificate', '!کورس', '!کلاسز', '!داخلہ', '!ٹریننگ', '!اکیڈمی'],
      event: ['event', '!exhibition', '!expo', '!mela', '!concert', 'tickets', '!میلہ', '!نمائش'],
      store: ['!visit our store', '!showroom', 'address', '!branch', '!shop no', '!grand opening', '!open daily', '!دکان پر', 'پتہ', '!شوروم'],
      company: ['!hiring', '!jobs', '!naukri', '!vacancy', '!franchise', '!dealership', '!نوکری', '!ملازمت', 'donate', '!عطیہ', 'vote'],
      digital: ['!download app', '!app store', '!google play', '!play now', 'subscription', '!software', '!ebook', '!crypto', '!trading', '!investment', '!earn money', '!online earning', '!paise kamayen', '!betting'],
      food: ['!mithai', '!مٹھائی', '!nimko', '!biscuit', '!cookies', '!cake', '!chocolate', '!shehad', '!شہد', '!honey', '!chai', '!چائے', '!achar', '!اچار', '!masala', '!مصالحہ', '!sweets', '!restaurant', '!biryani', '!بریانی', 'khana', '!کھانا', '!dry fruits', '!desi ghee'],
      foodOk: ['mould', 'mold', 'maker', 'machine', 'container', 'tray', 'grinder', 'kit', 'tool', 'mug', 'cup', 'flask', 'toy', 'candle', 'soap', 'mask', 'shampoo', 'cream', 'scrub', 'daagh', 'stand', 'مشین', 'صابن'],
      bulky: ['!sofa', '!mattress', '!almari', '!palang', '!fridge', '!refrigerator', '!washing machine', '!double bed', '!dining table', '!treadmill', '!furniture', 'AC', '!LED TV', '!electric bike', '!صوفہ', '!الماری', '!پلنگ', '!فریج'],
      bulkyOk: ['cover', 'protector', 'bedsheet', 'organizer', 'holder', 'stand', 'mini', 'cushion', 'mat', 'lamp', 'accessories', 'toy', 'handle', 'filter', 'sticker', 'cleaner', 'brush', 'remote', 'wheels', 'charger', 'tray'],
      fragile: ['!kaanch', '!کانچ', '!sheesha', '!شیشہ', '!glassware', '!vase', '!ceramic', '!porcelain', '!crystal', '!chandelier', '!aquarium', '!glass bottle', '!glass jar', '!fragile'],
      fragileOk: ['tempered', 'screen protector', 'unbreakable', 'silicone', 'stainless steel', 'steel', 'acrylic', 'plastic', 'cleaner'],
      cue: ['!cod', '!cash on delivery', '!free delivery', '!free home delivery', '!order now', '!abhi order karein', '!limited stock', 'discount', 'sale', 'price', 'warranty', 'pcs', 'روپے', 'آرڈر']
    },
    zh: {
      service: ['服務', '!預約', '!諮詢', '!免費諮詢', '!診所', '!牙醫', '!美容院', '!美髮', '!保險', '!貸款', '!房地產', '!房屋出售', '!租屋', '!出租', '!代辦', '!旅行社', '!旅遊行程', '!飯店', '!民宿', '!律師', '!搬家', '!清潔服務', '!維修服務', '!租車', '!洗車'],
      course: ['!課程', '!線上課程', '!講座', '!研討會', '!工作坊', '!報名', '!立即報名', '!學院', '!補習', '!教學', '!證照', '!學費', '!招生', '!培訓', '!上課'],
      event: ['!展覽', '!博覽會', '!展會', '!演唱會', '!音樂會', '!門票', '!活動報名', '!市集', '!嘉年華', '!論壇'],
      store: ['!門市', '!實體店', '!歡迎蒞臨', '!歡迎光臨', '地址', '!營業時間', '!分店', '!新店開幕', '!盛大開幕', '!展示中心', '!門店', '!店址'],
      company: ['!徵才', '!招募', '!誠徵', '!職缺', '!加盟', '!代理商招募', '!經銷商', '!公司簡介', '!捐款', '!投票'],
      digital: ['!下載App', '下載', '!應用程式', '!App Store', '!Google Play', '!手遊', '遊戲', '!訂閱', '!軟體', '!免費試用', '!電子書', '!加密貨幣', '!虛擬貨幣', '投資', '!股票', '!賺錢', '!被動收入', '!娛樂城'],
      food: ['!餅乾', '!蛋糕', '!糕點', '!甜點', '!巧克力', '!蜂蜜', '!咖啡豆', '!咖啡', '!茶葉', '!零食', '!麵包', '!月餅', '!鳳梨酥', '!牛軋糖', '!堅果', '!便當', '!餐廳', '!菜單', '!美食', '伴手禮', '禮盒', '!果汁', '!肉乾', '!水餃', '!料理包'],
      foodOk: ['模具', '模', '機', '烤盤', '工具', '器', '架', '杯', '壺', '玩具', '蠟燭', '皂', '面膜', '洗髮', '霜', '去漬', '污漬', '收納', '色'],
      bulky: ['!沙發', '!床墊', '!衣櫃', '!冰箱', '!洗衣機', '!烘衣機', '!洗碗機', '!床架', '!雙人床', '!餐桌', '!跑步機', '!家具', '!書桌', '!冷氣', '!電視', '!電動自行車', '!電動機車', '!浴缸'],
      bulkyOk: ['套', '罩', '保潔墊', '床包', '收納', '架', '迷你', '枕', '墊', '燈', '配件', '玩具', '把手', '濾', '貼', '清潔', '刷', '遙控', '輪', '腳', '充電'],
      fragile: ['!玻璃', '!陶瓷', '!瓷器', '!水晶', '!鏡子', '!花瓶', '!吊燈', '!魚缸', '!易碎'],
      fragileOk: ['鋼化', '保護貼', '不易碎', '防摔', '防碎', '矽膠', '不鏽鋼', '壓克力', '塑膠', '清潔', '膠'],
      cue: ['!免運', '!貨到付款', '!下單', '!立即購買', '!搶購', '!限時', '!特價', '!現貨', '!NT$', '!折', '優惠', '元', '入', '組', '保固', '團購']
    },
    th: {
      service: ['!บริการ', '!จองคิว', '!นัดหมาย', '!ปรึกษาฟรี', '!คลินิก', '!ทำฟัน', '!ร้านเสริมสวย', '!ประกัน', '!สินเชื่อ', '!กู้เงิน', '!คอนโด', '!บ้านเช่า', '!ให้เช่า', '!ขายบ้าน', '!ทัวร์', '!โรงแรม', '!ทนาย', '!ขนย้าย', '!รับทำความสะอาด', '!เช่ารถ', '!ล้างรถ'],
      course: ['!คอร์ส', '!คอร์สเรียน', '!สัมมนา', '!เวิร์กช็อป', '!อบรม', '!สมัครเรียน', '!ติว', '!เรียนออนไลน์', '!ใบประกาศ', '!สถาบัน', '!โรงเรียน'],
      event: ['!งานแสดง', '!นิทรรศการ', '!คอนเสิร์ต', '!บัตรเข้างาน', '!อีเวนต์', '!งานแฟร์', '!เทศกาล'],
      store: ['!หน้าร้าน', '!สาขา', '!แวะมา', '!เปิดทุกวัน', '!เวลาทำการ', 'ที่อยู่', '!เปิดใหม่', '!โชว์รูม'],
      company: ['!รับสมัครงาน', '!สมัครงาน', '!แฟรนไชส์', '!รับตัวแทน', '!รับสมัครตัวแทน', '!บริษัทของเรา', '!บริจาค', '!เลือกตั้ง'],
      digital: ['!ดาวน์โหลดแอป', '!แอป', '!สมัครสมาชิก', '!ซอฟต์แวร์', '!ทดลองใช้ฟรี', '!อีบุ๊ก', '!คริปโต', '!เทรด', '!ลงทุน', '!หารายได้', '!รายได้เสริม', '!คาสิโน', '!พนัน'],
      food: ['!คุกกี้', '!ขนม', '!เค้ก', '!เบเกอรี่', '!ช็อกโกแลต', '!น้ำผึ้ง', '!กาแฟ', '!ชาเขียว', '!ใบชา', '!ชานม', '!ขนมปัง', '!อาหาร', '!ร้านอาหาร', '!เมนู', '!ของฝาก', '!ผลไม้', '!น้ำพริก', '!หมูแดดเดียว', '!เครื่องดื่ม'],
      foodOk: ['แม่พิมพ์', 'พิมพ์', 'เครื่อง', 'ถาด', 'ขวด', 'แก้วน้ำ', 'ที่เก็บ', 'ของเล่น', 'เทียน', 'สบู่', 'มาส์ก', 'แชมพู', 'ครีม', 'สครับ', 'คราบ', 'ที่หั่น', 'มีด'],
      bulky: ['!โซฟา', '!ที่นอน', '!ตู้เสื้อผ้า', '!ตู้เย็น', '!เครื่องซักผ้า', '!เตียง', '!โต๊ะกินข้าว', '!ลู่วิ่ง', '!เฟอร์นิเจอร์', '!แอร์', '!ทีวี', '!จักรยานไฟฟ้า'],
      bulkyOk: ['ผ้าคลุม', 'ปลอก', 'ผ้าปู', 'กันเปื้อน', 'ที่จัดเก็บ', 'มินิ', 'หมอน', 'พรม', 'โคม', 'อุปกรณ์เสริม', 'ของเล่น', 'มือจับ', 'ไส้กรอง', 'สติกเกอร์', 'ทำความสะอาด', 'แปรง', 'รีโมท', 'ล้อ', 'ขา', 'ที่ชาร์จ'],
      fragile: ['!เครื่องแก้ว', '!เซรามิก', '!กระเบื้องเคลือบ', '!คริสตัล', '!แจกัน', '!โคมระย้า', '!ตู้ปลา', '!กระจกติดผนัง', '!ขวดแก้ว', '!โหลแก้ว', '!แตกง่าย'],
      fragileOk: ['นิรภัย', 'ฟิล์ม', 'กันแตก', 'ไม่แตก', 'ซิลิโคน', 'สแตนเลส', 'อะคริลิก', 'พลาสติก', 'เก็บความเย็น'],
      cue: ['!ส่งฟรี', '!เก็บเงินปลายทาง', '!สั่งเลย', '!สั่งซื้อ', '!สินค้าพร้อมส่ง', '!มีจำนวนจำกัด', '!โปร', 'ลดราคา', 'บาท', '฿', 'รับประกัน', 'ชิ้น']
    }
  };
  // Darija and Arabizi reuse the Arabic / French evidence plus a few local forms.
  F.dz = {
    service: ['خدمة', '!كراء', '!للكراء', '!نقدمو خدمات'], course: ['!فورماسيون', '!تكوين', '!دروس', '!كورسات'], event: ['صالون', 'معرض'],
    store: ['!محلنا', '!حانوتنا', '!زورونا', '!جيونا لمحل', 'العنوان'], company: ['!نوظفو', '!مطلوب'], digital: ['!حمّلو التطبيق'],
    food: ['!حلويات', '!ماكلة', '!مقروط', '!قريوش', '!كسرة', '!بقلاوة'], foodOk: F.ar.foodOk, bulky: [], bulkyOk: F.ar.bulkyOk, fragile: [], fragileOk: F.ar.fragileOk,
    cue: ['!التوصيل لـ 58 ولاية', '!توصيل 58 ولاية', '!الدفع عند الاستلام', '!اطلب', '!دج', 'السعر']
  };
  F.arz = {
    service: ['service', '!kra', '!service apres vente'], course: ['!formation', '!dourous', '!cours'], event: ['!salon'], store: ['!mahalna', '!7anoutna', 'adresse'],
    company: ['!recrutement'], digital: [], food: ['!7alwiyat', '!makla', '!gateau', '!gâteaux'], foodOk: F.fr.foodOk, bulky: [], bulkyOk: F.fr.bulkyOk, fragile: [], fragileOk: F.fr.fragileOk,
    cue: ['!livraison 58 wilayas', '!livraison', '!da', '!dzd', 'prix']
  };

  // ---- اللغات المضافة في 9.0
  F.nl = {
    service: ['!onze diensten', '!wij bieden', '!maak een afspraak', '!gratis advies', '!gratis offerte', '!kliniek', '!tandarts', '!kapper', '!schoonheidssalon', '!verzekering', '!lening', '!hypotheek', '!makelaar', '!te huur', '!te koop', '!reisbureau', '!hotel', '!advocaat', '!loodgieter', '!verhuisbedrijf', '!schoonmaakdienst', '!autoverhuur', '!reparatieservice'],
    course: ['!cursus', '!cursussen', '!online cursus', '!masterclass', '!webinar', '!workshop', '!training', '!schrijf je in', '!inschrijven', '!certificaat', '!opleiding', '!academie', '!lessen', '!bijles', '!coaching'],
    event: ['!congres', '!beurs', '!tentoonstelling', '!concert', '!festival', '!tickets', '!evenement'],
    store: ['!bezoek onze winkel', '!kom langs', '!in onze winkel', 'adres', '!openingstijden', '!dagelijks geopend', '!nieuwe vestiging', '!opening', '!showroom', '!routebeschrijving'],
    company: ['!vacature', '!vacatures', '!wij zoeken', '!solliciteer', '!kom bij ons team', '!franchise', '!word dealer', 'ons bedrijf', '!doneer', '!stem'],
    digital: ['!download de app', '!app store', '!google play', '!speel nu', '!abonnement', '!software', '!gratis proberen', '!e-book', '!crypto', '!beleggen', '!geld verdienen', '!casino', '!gokken'],
    food: ['!koekjes', '!taart', '!gebak', '!bakkerij', '!chocolade', '!honing', '!koffie', '!thee', '!snoep', '!brood', '!restaurant', '!menu', '!maaltijd', '!pizza', '!kruiden', '!olijfolie', '!jam', '!noten', '!sap'],
    foodOk: ['vorm', 'vormen', 'uitsteker', 'machine', 'apparaat', 'bakvorm', 'bakblik', 'molen', 'dispenser', 'gereedschap', 'organizer', 'mok', 'beker', 'thermosfles', 'speelgoed', 'kaars', 'zeep', 'masker', 'shampoo', 'crème', 'scrub', 'vlek', 'vlekken', 'houder'],
    bulky: ['!bank', '!loungebank', '!matras', '!kledingkast', '!koelkast', '!vriezer', '!wasmachine', '!droger', '!vaatwasser', '!bed', '!eettafel', '!loopband', '!meubels', '!bureau', '!airco', '!televisie', '!e-bike', '!bad'],
    bulkyOk: ['hoes', 'beschermer', 'laken', 'organizer', 'houder', 'mini', 'kussen', 'mat', 'lamp', 'accessoire', 'speelgoed', 'handvat', 'filter', 'sticker', 'reiniger', 'borstel', 'afstandsbediening', 'wieltjes', 'poten', 'oplader', 'dienblad'],
    fragile: ['!glaswerk', '!vaas', '!keramiek', '!porselein', '!kristal', '!kroonluchter', '!aquarium', '!wandspiegel', '!glazen fles', '!wijnglazen', '!breekbaar'],
    fragileOk: ['gehard', 'screenprotector', 'onbreekbaar', 'siliconen', 'rvs', 'acryl', 'plastic', 'reiniger', 'lijm', 'pomp', 'filter'],
    cue: ['!gratis verzending', '!gratis bezorging', '!bestel nu', '!koop nu', '!in winkelwagen', '!op voorraad', '!beperkte voorraad', 'korting', 'aanbieding', 'sale', 'garantie', 'stuks', 'verzending', 'prijs']
  };
  F.pl = {
    service: ['!nasze usługi', '!oferujemy', '!umów wizytę', '!bezpłatna konsultacja', '!darmowa wycena', '!klinika', '!dentysta', '!fryzjer', '!salon kosmetyczny', '!ubezpieczenie', '!pożyczka', '!kredyt hipoteczny', '!nieruchomości', '!do wynajęcia', '!na sprzedaż', '!biuro podróży', '!hotel', '!adwokat', '!hydraulik', '!przeprowadzki', '!sprzątanie', '!wynajem samochodów', '!serwis'],
    course: ['!kurs', '!kursy', '!kurs online', '!masterclass', '!webinar', '!warsztaty', '!szkolenie', '!zapisz się', '!zapisy', '!certyfikat', '!akademia', '!lekcje', '!korepetycje', '!coaching'],
    event: ['!konferencja', '!targi', '!wystawa', '!koncert', '!festiwal', '!bilety', '!wydarzenie'],
    store: ['!odwiedź nasz sklep', '!zapraszamy do sklepu', '!w naszym sklepie', 'adres', '!godziny otwarcia', '!czynne codziennie', '!nowy sklep', '!otwarcie', '!salon', '!dojazd'],
    company: ['!praca', '!oferta pracy', '!zatrudnimy', '!rekrutacja', '!dołącz do zespołu', '!franczyza', '!zostań dystrybutorem', 'nasza firma', '!wpłać', '!zagłosuj'],
    digital: ['!pobierz aplikację', '!app store', '!google play', '!graj teraz', '!subskrypcja', '!oprogramowanie', '!wypróbuj za darmo', '!e-book', '!kryptowaluty', '!inwestuj', '!zarabiaj', '!kasyno', '!zakłady'],
    food: ['!ciastka', '!ciasto', '!tort', '!cukiernia', '!piekarnia', '!czekolada', '!miód', '!kawa', '!herbata', '!słodycze', '!chleb', '!restauracja', '!menu', '!obiad', '!pizza', '!przyprawy', '!oliwa', '!dżem', '!orzechy', '!sok'],
    foodOk: ['forma', 'foremka', 'foremki', 'maszyna', 'ekspres', 'blacha', 'młynek', 'dozownik', 'narzędzie', 'organizer', 'kubek', 'termos', 'zabawka', 'świeca', 'mydło', 'maska', 'szampon', 'krem', 'peeling', 'plama', 'plamy', 'uchwyt'],
    bulky: ['!sofa', '!kanapa', '!materac', '!szafa', '!lodówka', '!zamrażarka', '!pralka', '!suszarka do ubrań', '!zmywarka', '!łóżko', '!stół', '!bieżnia', '!meble', '!biurko', '!klimatyzator', '!telewizor', '!rower elektryczny', '!wanna'],
    bulkyOk: ['pokrowiec', 'ochraniacz', 'prześcieradło', 'organizer', 'uchwyt', 'mini', 'poduszka', 'mata', 'lampa', 'akcesoria', 'zabawka', 'filtr', 'naklejka', 'środek', 'szczotka', 'pilot', 'kółka', 'nóżki', 'ładowarka', 'taca'],
    fragile: ['!szkło', '!wazon', '!ceramika', '!porcelana', '!kryształ', '!żyrandol', '!akwarium', '!lustro ścienne', '!szklana butelka', '!kieliszki', '!kruche'],
    fragileOk: ['hartowane', 'szkło ochronne', 'nietłukące', 'silikon', 'stal nierdzewna', 'akryl', 'plastik', 'środek', 'klej', 'pompa', 'filtr'],
    cue: ['!darmowa dostawa', '!za pobraniem', '!zamów teraz', '!kup teraz', '!dodaj do koszyka', '!dostępne od ręki', '!ograniczona ilość', 'promocja', 'rabat', 'wyprzedaż', 'gwarancja', 'sztuk', 'zestaw', 'dostawa', 'cena']
  };
  F.ja = {
    service: ['!ご予約', '!予約受付', '!無料相談', '!無料見積', '!クリニック', '!歯科', '!美容室', '!サロン', '!保険', '!ローン', '!不動産', '!賃貸', '!旅行代理店', '!ツアー', '!ホテル', '!弁護士', '!引越し', '!ハウスクリーニング', '!修理サービス', '!レンタカー'],
    course: ['!講座', '!オンライン講座', '!セミナー', '!ワークショップ', '!スクール', '!レッスン', '!受講', '!申し込み', '!資格', '!研修', '!教室', '!コーチング'],
    event: ['!展示会', '!イベント', '!コンサート', '!フェス', '!チケット', '!博覧会'],
    store: ['!店舗', '!ご来店', '!営業時間', '!住所', '!新店舗', '!オープン', '!ショールーム', '!アクセス'],
    company: ['!採用', '!求人', '!募集', '!スタッフ募集', '!フランチャイズ', '!代理店募集', '!会社概要', '!寄付'],
    digital: ['アプリ', '!ダウンロード', '!App Store', '!Google Play', 'ゲーム', '!サブスク', '!ソフト', '!無料体験', '!電子書籍', '!仮想通貨', '!投資', '!副業', '!稼ぐ', '!カジノ'],
    food: ['!クッキー', '!ケーキ', '!お菓子', '!スイーツ', '!チョコレート', '!はちみつ', '!コーヒー豆', '!紅茶', '!緑茶', '!パン', '!レストラン', '!メニュー', '!お弁当', '!グルメ', '!お取り寄せ', '!ジュース', '!和菓子'],
    foodOk: ['型', 'メーカー', '機', 'トレー', 'ケース', '容器', 'ツール', 'スタンド', 'マグ', 'タンブラー', 'おもちゃ', 'キャンドル', '石鹸', 'マスク', 'シャンプー', 'クリーム', 'スクラブ', '汚れ', '収納'],
    bulky: ['!ソファ', '!マットレス', '!タンス', '!冷蔵庫', '!冷凍庫', '!洗濯機', '!乾燥機', '!食洗機', '!ベッド', '!ダイニングテーブル', '!ランニングマシン', '!家具', '!デスク', '!エアコン', '!テレビ', '!電動自転車', '!浴槽'],
    bulkyOk: ['カバー', 'シーツ', 'パッド', '収納', 'ホルダー', 'ミニ', 'クッション', 'マット', 'ライト', 'アクセサリー', 'おもちゃ', 'ハンドル', 'フィルター', 'ステッカー', 'クリーナー', 'ブラシ', 'リモコン', 'キャスター', '充電器', 'トレー'],
    fragile: ['!ガラス', '!陶器', '!磁器', '!クリスタル', '!花瓶', '!シャンデリア', '!水槽', '!鏡', '!割れ物'],
    fragileOk: ['眼鏡', 'メガネ', '強化ガラス', '保護フィルム', '割れない', 'シリコン', 'ステンレス', 'アクリル', 'プラスチック', 'クリーナー'],
    cue: ['!送料無料', '!代引き', '!今すぐ購入', '!カートに入れる', '!在庫限り', '!限定', '!セール', '%OFF', '円', '個', 'セット', '保証', '税込']
  };
  F.ko = {
    service: ['!예약', '!무료 상담', '!무료 견적', '!클리닉', '!치과', '!미용실', '!피부과', '!보험', '!대출', '!부동산', '!분양', '!임대', '!여행사', '!패키지 여행', '!호텔', '!변호사', '!이사', '!청소 서비스', '!수리 서비스', '!렌터카'],
    course: ['!강의', '!온라인 강의', '!세미나', '!워크숍', '!클래스', '!수강', '!수강 신청', '!자격증', '!교육', '!학원', '!아카데미', '!코칭'],
    event: ['!박람회', '!전시회', '!콘서트', '!페스티벌', '!티켓', '!행사'],
    store: ['!매장', '!방문해 주세요', '!영업시간', '!주소', '!신규 매장', '!오픈', '!쇼룸', '!오시는 길'],
    company: ['!채용', '!구인', '!모집', '!가맹', '!대리점 모집', '!회사 소개', '!기부', '!투표'],
    digital: ['!앱 다운로드', '!앱스토어', '!구글 플레이', '게임', '!구독', '!소프트웨어', '!무료 체험', '!전자책', '!코인', '!주식', '!투자', '!부업', '!카지노'],
    food: ['!쿠키', '!케이크', '!과자', '!디저트', '!초콜릿', '!벌꿀', '!원두', '!커피', '!녹차', '!홍차', '!식빵', '!빵집', '!베이커리', '!식당', '!메뉴', '!도시락', '!밀키트', '!반찬', '!주스'],
    foodOk: ['틀', '메이커', '기계', '트레이', '케이스', '용기', '도구', '거치대', '머그', '텀블러', '장난감', '캔들', '비누', '마스크', '샴푸', '크림', '스크럽', '얼룩', '수납'],
    bulky: ['!소파', '!매트리스', '!옷장', '!냉장고', '!냉동고', '!세탁기', '!건조기', '!식기세척기', '!침대', '!식탁', '!러닝머신', '!가구', '!책상', '!에어컨', '!TV', '!전기자전거', '!욕조'],
    bulkyOk: ['커버', '시트', '패드', '수납', '거치대', '미니', '쿠션', '매트', '조명', '액세서리', '장난감', '손잡이', '필터', '스티커', '클리너', '브러시', '리모컨', '바퀴', '충전기', '트레이'],
    fragile: ['!유리', '!도자기', '!세라믹', '!크리스탈', '!꽃병', '!샹들리에', '!어항', '!거울', '!깨지기 쉬운'],
    fragileOk: ['강화유리', '보호필름', '깨지지 않는', '실리콘', '스테인리스', '아크릴', '플라스틱', '클리너'],
    cue: ['!무료배송', '!착불', '!지금 구매', '!장바구니', '!한정 수량', '!특가', '!세일', '!할인', '원', '개', '세트', '보증']
  };
  F.bn = {
    service: ['!আমাদের সেবা', 'সেবা', '!অ্যাপয়েন্টমেন্ট', '!ফ্রি পরামর্শ', '!ক্লিনিক', '!ডাক্তার', '!পার্লার', '!বিমা', '!লোন', '!ঋণ', '!ফ্ল্যাট বিক্রি', '!ভাড়া', '!ট্রাভেল এজেন্সি', '!ট্যুর প্যাকেজ', '!হোটেল', '!উকিল', '!মেরামত সেবা', 'service', 'booking'],
    course: ['!কোর্স', '!অনলাইন কোর্স', '!ক্লাস', '!প্রশিক্ষণ', '!সেমিনার', '!কর্মশালা', '!ভর্তি', '!রেজিস্ট্রেশন', '!সার্টিফিকেট', '!একাডেমি', '!কোচিং', 'course', 'admission'],
    event: ['!মেলা', '!প্রদর্শনী', '!কনসার্ট', '!টিকিট', '!অনুষ্ঠান', 'event'],
    store: ['!আমাদের দোকানে', '!শোরুম', '!ঠিকানা', '!শাখা', '!নতুন শাখা', '!উদ্বোধন', '!প্রতিদিন খোলা'],
    company: ['!নিয়োগ', '!চাকরি', '!চাকরির বিজ্ঞপ্তি', '!ফ্র্যাঞ্চাইজি', '!ডিলারশিপ', '!দান', 'hiring', 'job'],
    digital: ['!অ্যাপ ডাউনলোড', '!গেম', '!সাবস্ক্রিপশন', '!সফটওয়্যার', '!ইবুক', '!ক্রিপ্টো', '!ট্রেডিং', '!বিনিয়োগ', '!আয় করুন', '!অনলাইন ইনকাম', '!বেটিং'],
    food: ['!মিষ্টি', '!বিস্কুট', '!কেক', '!চকলেট', '!মধু', '!চা', '!কফি', '!আচার', '!মশলা', '!ঘি', '!রেস্টুরেন্ট', '!খাবার', '!বিরিয়ানি', '!পিঠা', '!জুস'],
    foodOk: ['মেশিন', 'মেকার', 'বক্স', 'কৌটা', 'ট্রে', 'গ্রাইন্ডার', 'টুল', 'মগ', 'কাপ', 'ফ্লাস্ক', 'খেলনা', 'মোমবাতি', 'সাবান', 'মাস্ক', 'শ্যাম্পু', 'ক্রিম', 'স্ক্রাব', 'দাগ', 'স্ট্যান্ড'],
    bulky: ['!সোফা', '!ম্যাট্রেস', '!আলমারি', '!ফ্রিজ', '!ওয়াশিং মেশিন', '!খাট', '!ডাইনিং টেবিল', '!ট্রেডমিল', '!আসবাবপত্র', '!এসি', '!টিভি'],
    bulkyOk: ['কভার', 'চাদর', 'অর্গানাইজার', 'হোল্ডার', 'মিনি', 'বালিশ', 'ম্যাট', 'লাইট', 'এক্সেসরিজ', 'খেলনা', 'হ্যান্ডেল', 'ফিল্টার', 'স্টিকার', 'ক্লিনার', 'ব্রাশ', 'রিমোট', 'চার্জার'],
    fragile: ['!কাচ', '!কাঁচ', '!সিরামিক', '!চীনামাটি', '!ক্রিস্টাল', '!ফুলদানি', '!ঝাড়বাতি', '!অ্যাকোয়ারিয়াম', '!আয়না', '!ভঙ্গুর'],
    fragileOk: ['টেম্পারড', 'স্ক্রিন প্রটেক্টর', 'ভাঙে না', 'সিলিকন', 'স্টেইনলেস', 'প্লাস্টিক', 'ক্লিনার'],
    cue: ['!ক্যাশ অন ডেলিভারি', '!ফ্রি ডেলিভারি', '!হোম ডেলিভারি', '!অর্ডার করুন', '!এখনই অর্ডার', '!সীমিত স্টক', '!অফার', 'ছাড়', 'দাম', 'টাকা', '৳', 'ওয়ারেন্টি', 'পিস']
  };
  // الصينية المبسطة: نفس معجم الصينية التقليدية بالحروف المبسطة
  F.zhs = {
    service: ['服务', '!预约', '!咨询', '!免费咨询', '!诊所', '!牙医', '!美容院', '!美发', '!保险', '!贷款', '!房地产', '!房屋出售', '!租房', '!出租', '!代办', '!旅行社', '!旅游行程', '!酒店', '!民宿', '!律师', '!搬家', '!清洁服务', '!维修服务', '!租车', '!洗车'],
    course: ['!课程', '!线上课程', '!讲座', '!研讨会', '!工作坊', '!报名', '!立即报名', '!学院', '!补习', '!教学', '!证书', '!学费', '!招生', '!培训', '!上课'],
    event: ['!展览', '!博览会', '!展会', '!演唱会', '!音乐会', '!门票', '!活动报名', '!市集', '!嘉年华', '!论坛'],
    store: ['!门市', '!实体店', '!欢迎莅临', '!欢迎光临', '地址', '!营业时间', '!分店', '!新店开幕', '!盛大开幕', '!展示中心', '!门店', '!店址'],
    company: ['!招聘', '!招募', '!诚聘', '!职缺', '!加盟', '!代理商招募', '!经销商', '!公司简介', '!捐款', '!投票'],
    digital: ['!下载App', '下载', '!应用程序', '!App Store', '!Google Play', '!手游', '游戏', '!订阅', '!软件', '!免费试用', '!电子书', '!加密货币', '!虚拟货币', '投资', '!股票', '!赚钱', '!被动收入', '!娱乐城'],
    food: ['!饼干', '!蛋糕', '!糕点', '!甜点', '!巧克力', '!蜂蜜', '!咖啡豆', '!咖啡', '!茶叶', '!零食', '!面包', '!月饼', '!凤梨酥', '!牛轧糖', '!坚果', '!便当', '!餐厅', '!菜单', '!美食', '伴手礼', '礼盒', '!果汁', '!肉干', '!水饺'],
    foodOk: ['模具', '模', '机', '烤盘', '工具', '器', '架', '杯', '壶', '玩具', '蜡烛', '皂', '面膜', '洗发', '霜', '去渍', '污渍', '收纳', '色'],
    bulky: ['!沙发', '!床垫', '!衣柜', '!冰箱', '!洗衣机', '!烘干机', '!洗碗机', '!床架', '!双人床', '!餐桌', '!跑步机', '!家具', '!书桌', '!空调', '!电视', '!电动自行车', '!电动车', '!浴缸'],
    bulkyOk: ['套', '罩', '保洁垫', '床笠', '收纳', '架', '迷你', '枕', '垫', '灯', '配件', '玩具', '把手', '滤', '贴', '清洁', '刷', '遥控', '轮', '脚', '充电'],
    fragile: ['!玻璃', '!陶瓷', '!瓷器', '!水晶', '!镜子', '!花瓶', '!吊灯', '!鱼缸', '!易碎'],
    fragileOk: ['钢化', '保护贴', '不易碎', '防摔', '防碎', '硅胶', '不锈钢', '亚克力', '塑料', '清洁', '胶'],
    cue: ['!包邮', '!免运', '!货到付款', '!下单', '!立即购买', '!抢购', '!限时', '!特价', '!现货', '!折', '优惠', '元', '入', '组', '保修', '团购']
  };
  // اللهجات الخليجية والمصرية: معجم العربية + عبارات محلية
  const arWith = (extra) => { const o = {}; for (const k of Object.keys(F.ar)) o[k] = F.ar[k].concat((extra && extra[k]) || []); return o; };
  F.gulf = arWith({ service: ['!احجز موعدك الحين', '!خدمة توصيل للمنازل'], store: ['!تفضلوا بزيارتنا', '!فرعنا الجديد', '!محلنا في'], food: ['!كنافة', '!لقيمات', '!مجبوس', '!كبسة'],
    cue: ['!التوصيل مجاني', '!الدفع عند الاستلام', '!اطلب الحين', '!ريال', '!درهم', '!دينار', 'العرض'] });
  F.eg = arWith({ service: ['!احجز ميعادك', '!خدمة عملاء'], store: ['!شرفونا', '!فرعنا الجديد', '!المحل في'], food: ['!كحك', '!بسبوسة', '!كنافة', '!فطير', '!حلويات'],
    cue: ['!التوصيل مجاني', '!الدفع عند الاستلام', '!اطلب دلوقتي', '!جنيه', '!ج.م', 'العرض', 'الخصم'] });

  // Language groups used by the filter: the language of the market + English (international ads) + Arabic/French in North Africa.
  const FILTER_LANGS = Object.keys(F);

  /* ------------------------------------------------------------------ helpers ------------------------------------------------------------------ */
  const CJK = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\u0e00-\u0e7f\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/;     // no spaces / attached suffixes: Chinese, Japanese, Thai, Korean

  /* ---------- المواسم (وسم فقط، لا يغيّر الدرجة) ---------- */
  const SEASONS = [
    'رمضان', 'العيد', 'عيد الفطر', 'عيد الأضحى', 'الأضحية', 'الشتاء', 'شتاء', 'الصيف', 'الدخول المدرسي', 'العودة للمدارس', 'بلاك فرايداي', 'الجمعة البيضاء', 'عيد الأم', 'رأس السنة',
    'black friday', 'cyber monday', '11.11', '12.12', '9.9', 'singles day', 'prime day', 'christmas', 'xmas', "mother's day", 'mothers day', "father's day", "valentine's day", 'valentine', 'halloween', 'back to school', 'new year', 'ramadan', 'eid', 'diwali', 'holi', 'raksha bandhan', 'chinese new year', 'lunar new year', 'thanksgiving', 'easter', 'boxing day',
    'noël', 'fête des mères', 'saint-valentin', 'rentrée', 'soldes', 'navidad', 'reyes', 'día de la madre', 'buen fin', 'hot sale', 'natal', 'dia das mães', 'weihnachten', 'muttertag', 'natale', 'festa della mamma', 'sinterklaas', 'kerst', 'boże narodzenie', 'yılbaşı', 'anneler günü', 'bayram',
    'lebaran', 'idul fitri', 'hari raya', 'harbolnas', 'tết', 'trung thu', 'pasko', 'simbang gabi', 'दिवाली', 'होली', 'ঈদ', 'পূজা', 'عید',
    '春節', '過年', '中秋', '母親節', '雙11', '双11', '双十一', '618', '春节', '母亲节', '圣诞', '聖誕', 'お正月', '母の日', 'クリスマス', 'お中元', 'お歳暮', '설날', '추석', '어버이날', '크리스마스', 'สงกรานต์', 'ปีใหม่', 'วันแม่'
  ];

  /* ---------- العملات ---------- */
  const CUR = {
    DZD: 'دج', USD: 'US$', EUR: '€', GBP: '£', CAD: 'CA$', AUD: 'A$', NZD: 'NZ$', INR: '₹', PKR: 'Rs', BDT: '৳', PHP: '₱', IDR: 'Rp', MYR: 'RM', SGD: 'S$', VND: '₫', TWD: 'NT$',
    HKD: 'HK$', THB: '฿', JPY: '¥', KRW: '₩', CNY: '¥', TRY: '₺', PLN: 'zł', CHF: 'CHF', BRL: 'R$', MXN: 'MX$', COP: 'COL$', ARS: 'AR$', CLP: 'CLP$', PEN: 'S/', SAR: 'ر.س', AED: 'د.إ',
    QAR: 'ر.ق', KWD: 'د.ك', BHD: 'د.ب', OMR: 'ر.ع', EGP: 'ج.م', MAD: 'د.م', TND: 'د.ت', LYD: 'د.ل', IQD: 'د.ع', JOD: 'د.أ', NGN: '₦', KES: 'KSh', GHS: 'GH₵', ZAR: 'R'
  };
  // أسعار تقريبية: كم ديناراً جزائرياً تساوي وحدة واحدة (قرابة السعر الرسمي). تُعدَّل من صفحة التحليل (مثلاً حسب السوق الموازي).
  const RATES_DZD = {
    DZD: 1, USD: 132, EUR: 152, GBP: 176, CAD: 95, AUD: 87, NZD: 78, CHF: 165, INR: 1.55, PKR: 0.47, BDT: 1.1, PHP: 2.3, IDR: 0.0082, MYR: 31, SGD: 102, VND: 0.0052, TWD: 4.2,
    HKD: 17, THB: 4, JPY: 0.88, KRW: 0.095, CNY: 18.5, TRY: 3.2, PLN: 36, BRL: 24, MXN: 7.2, COP: 0.033, ARS: 0.11, CLP: 0.14, PEN: 37, SAR: 35, AED: 36, QAR: 36, KWD: 430,
    BHD: 350, OMR: 343, EGP: 2.7, MAD: 14, TND: 45, LYD: 24, IQD: 0.1, JOD: 186, NGN: 0.09, KES: 1.02, GHS: 9, ZAR: 7.3
  };
  // عملة السعر المكتوب: رمز صريح في النص، وإلا عملة سوق الإعلان. الرموز المشتركة ($، Rs، pesos، ¥) تُحسم بالسوق.
  const CUR_HINTS = [
    [/(دج|د\.ج|دينار جزائري|\bDA\b|\bDZD\b)/i, 'DZD'], [/(€|\beur\b|\beuros?\b)/i, 'EUR'], [/(£|\bgbp\b)/i, 'GBP'], [/(₹|\binr\b|रुपये)/i, 'INR'], [/(\bpkr\b|روپے)/i, 'PKR'],
    [/(৳|\bbdt\b|টাকা)/i, 'BDT'], [/(₱|\bphp\b)/i, 'PHP'], [/(\brp\.?\s?\d|\bidr\b)/i, 'IDR'], [/(\brm\s?\d|\bmyr\b|ringgit)/i, 'MYR'], [/(₫|\bvnd\b|vnđ|\d\s?đ(?![a-z]))/i, 'VND'],
    [/(nt\$)/i, 'TWD'], [/(฿|บาท|\bbaht\b)/i, 'THB'], [/(₩|\d\s?원)/, 'KRW'], [/(\d\s?円|税込)/, 'JPY'], [/(₺|\btl\b|\blira\b)/i, 'TRY'], [/(zł|\bpln\b)/i, 'PLN'], [/(r\$)/i, 'BRL'],
    [/(ريال|ر\.س|\bsar\b)/i, 'SAR'], [/(درهم|د\.إ|\baed\b)/i, 'AED'], [/(جنيه|ج\.م|\begp\b)/i, 'EGP'], [/(\bmad\b)/i, 'MAD'], [/(₦|\bngn\b|naira)/i, 'NGN'], [/(\bchf\b)/i, 'CHF'],
    [/(\$|\busd\b|dollars?)/i, '$'], [/(\brs\.?\s?\d|rupees?)/i, 'RS'], [/(pesos?)/i, 'PESO'], [/(¥|元)/, 'YEN'], [/(\d\s?k\b)/i, 'K']
  ];
  function currencyOf(text, country) {
    const mc = (COUNTRIES[String(country || '').toUpperCase()] || {}).cur || '';
    for (const [re, c] of CUR_HINTS) {
      if (!re.test(text)) continue;
      if (c === '$') return ['USD', 'CAD', 'AUD', 'NZD', 'SGD', 'HKD', 'TWD', 'MXN', 'COP', 'ARS', 'CLP'].includes(mc) ? mc : 'USD';
      if (c === 'RS') return ['PKR', 'INR'].includes(mc) ? mc : 'INR';
      if (c === 'PESO') return ['PHP', 'MXN', 'COP', 'ARS', 'CLP'].includes(mc) ? mc : 'PHP';
      if (c === 'YEN') return mc === 'TWD' || mc === 'HKD' ? mc : mc === 'JPY' ? 'JPY' : 'CNY';
      if (c === 'K') { if (mc === 'VND') return 'VND'; continue; }
      if (c === 'AED' && mc === 'MAD') return 'MAD';
      return c;
    }
    return mc;
  }
  const curSymbol = (c) => CUR[c] || c || '';
  const countryOf = (code) => COUNTRIES[String(code || '').toUpperCase()] || null;
  const langsOf = (code) => { const c = countryOf(code); return c ? c.langs.slice() : ['ar', 'dz', 'fr', 'arz']; };
  // Golden + complementary, golden ALWAYS first. Exact phrases in Chinese / Thai are glued without a space.
  function combine(golden, comp, lang, exact) {
    const g = String(golden || '').trim(), c = String(comp || '').trim();
    if (!g) return c; if (!c) return g;
    const j = LANGS[lang] && LANGS[lang].joiner != null && exact ? LANGS[lang].joiner : ' ';
    return g + j + c;
  }
  // Dictionary seed for the platform's keyword dictionary (non-legacy languages only).
  function dictSeed() {
    const gold = {}, comps = {};
    for (const lg of Object.keys(KW)) {
      gold[lg] = { strong: KW[lg].strong.slice(), normal: KW[lg].normal.slice(), weak: [] };
      for (const id of Object.keys(KW[lg].comps)) (comps[id] = comps[id] || {})[lg] = KW[lg].comps[id].slice();
    }
    return { gold, comps };
  }
  // Benefit words of every language, as comma lists the analysis engine understands.
  function goldText(tier) {
    return Object.keys(KW).map((lg) => KW[lg][tier].join(', ')).join(', ');
  }

  const api = { LANGS, LEGACY, COUNTRIES, REGIONS, KW, F, FILTER_LANGS, CJK, countryOf, langsOf, combine, dictSeed, goldText, SEASONS, CUR, RATES_DZD, currencyOf, curSymbol,
    gloss: (lang, t) => (KWD.gloss ? KWD.gloss(lang, t) : ''), sellersMax: (c) => ((COUNTRIES[String(c || '').toUpperCase()] || {}).sellers || 3),
    NEW_LANGS: Object.keys(KW), ALL_LANGS: LEGACY.concat(Object.keys(KW)) };
  root.RadarMarkets = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
