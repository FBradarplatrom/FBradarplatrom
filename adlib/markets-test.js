'use strict';
// Quality test of the international pipeline: local-language search phrases and the product-eligibility check
// on realistic ads from ten markets (+ Algeria, which must keep working exactly as before).
// Run: node adlib/markets-test.js
const M = require('./lib/markets.js'), PC = require('./lib/productcheck.js');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };

/* ---------- 1. golden + complementary order and the three search modes ---------- */
ok(M.combine('Helps', 'your child', 'en', false) === 'Helps your child', 'golden first');
ok(M.combine('幫助', '寶寶', 'zh', true) === '幫助寶寶', 'zh exact phrase glued');
ok(M.combine('幫助', '寶寶', 'zh', false) === '幫助 寶寶', 'zh unordered keeps a space');
ok(M.combine('Helps', '', 'en') === 'Helps' && M.combine('', 'your child', 'en') === 'your child', 'single keyword modes');

/* ---------- 2. every tested country searches in its own language ---------- */
const EXPECT = { FR: 'fr', US: 'en', IN: 'en', PK: 'en', PH: 'en', TW: 'zh', VN: 'vi', ID: 'id', GB: 'en', ES: 'es', DZ: 'ar' };
for (const [c, l] of Object.entries(EXPECT)) ok(M.langsOf(c)[0] === l, c + ' main language ' + l);
ok(M.langsOf('IN').includes('hi') && M.langsOf('PK').includes('ur') && M.langsOf('PH').includes('tl'), 'local second languages');
for (const lg of M.NEW_LANGS) {
  ok(M.KW[lg].strong.length >= 8, lg + ' golden keywords');
  for (const n of ['kids', 'home', 'beauty', 'car', 'pets', 'sport', 'travel', 'phone', 'fashion', 'tools']) ok((M.KW[lg].comps[n] || []).length >= 3, lg + ' complements ' + n);
}

/* ---------- 3. eligibility on realistic ads ---------- */
// [country, expected (true = keep), ad]
const A = (country, keep, ad, note) => ({ country, keep, ad, note });
const CASES = [
  // ---- United States / United Kingdom
  A('US', true, { title: 'Helps your child sleep through the night', body: 'The cloud night light with white noise. Free shipping on all US orders. Only $29.99 today – 50% off!', cta_type: 'SHOP_NOW', link_url: 'https://dreamy.myshopify.com/products/cloud-light' }),
  A('US', true, { title: 'Say goodbye to pet hair', body: 'Reusable lint roller removes dog & cat hair from couch, car seats and clothes. Buy 1 get 1 free. Order now!', cta_type: 'SHOP_NOW' }, 'couch mentioned as surface, not sold'),
  A('US', true, { title: 'Cookie cutter set – 24 pcs', body: 'Stainless steel cookie cutters for holiday baking. $19.95 + free shipping', cta_type: 'SHOP_NOW' }, 'baking tool, not food'),
  A('US', true, { title: 'No more cracked phone screens', body: 'Tempered glass screen protector, 9H hardness, bubble-free install. 3-pack for $12.99', cta_type: 'SHOP_NOW' }, 'tempered glass is not fragile'),
  A('US', false, { title: 'Join our free masterclass', body: 'Learn how to build a 6-figure Amazon business. Enroll now – seats are limited!', cta_type: 'SIGN_UP', link_url: 'https://academy.kajabi.com/offers/x' }, 'course'),
  A('US', false, { title: 'Grand opening this Saturday!', body: 'Visit our store at 120 Main St, Austin. Opening hours 9am–9pm. Get directions below.', cta_type: 'GET_DIRECTIONS' }, 'shop opening'),
  A('US', false, { title: 'Fresh homemade cookies delivered', body: 'Chocolate chip cookies and brownies baked daily. Order a box of 12 for $24.', cta_type: 'ORDER_NOW' }, 'food'),
  A('US', false, { title: 'Free roof inspection', body: 'Storm damage? Our licensed contractors offer a free quote. Call now to book an appointment.', cta_type: 'CALL_NOW', page_categories: ['Roofing Service'] }, 'service'),
  A('US', false, { title: 'Modern sectional sofa', body: 'Our best-selling 7-seat sectional sofa with chaise. Free white-glove delivery. $1,899', cta_type: 'SHOP_NOW' }, 'bulky'),
  A('US', false, { title: 'Download now and play for free', body: 'The #1 puzzle game of 2026. Install now!', cta_type: 'INSTALL_MOBILE_APP', link_url: 'https://play.google.com/store/apps/details?id=x' }, 'app'),
  A('US', true, { title: 'Sofa cover that actually stays put', body: 'Waterproof stretch couch cover, protects your sofa from pets and kids. 40% off today. Free shipping.', cta_type: 'SHOP_NOW' }, 'sofa accessory'),
  A('GB', true, { title: 'Get rid of damp & mould for good', body: 'Our mini dehumidifier pulls 500ml of water a day. Free UK delivery. £34.99', cta_type: 'SHOP_NOW' }),
  A('GB', false, { title: 'Summer Food Festival 2026', body: 'Join us on 12 July at Hyde Park! Get your tickets now – street food, live music and more.', cta_type: 'BUY_TICKETS' }, 'event'),
  A('GB', false, { title: 'We are hiring delivery drivers', body: 'Join our team! Flexible hours, £14/hour. Apply now.', cta_type: 'APPLY_NOW' }, 'jobs'),
  A('GB', false, { title: 'Hand-painted ceramic vase', body: 'Each porcelain vase is unique. Perfect gift. £45', cta_type: 'SHOP_NOW' }, 'fragile'),
  // ---- France
  A('FR', true, { title: 'Dites adieu aux moustiques', body: 'Lampe anti-moustique USB silencieuse. Livraison gratuite en France. Paiement à la livraison possible. 24,90€', cta_type: 'SHOP_NOW' }),
  A('FR', true, { title: 'Aide votre enfant à bien dormir', body: 'Veilleuse projecteur étoiles pour bébé. -40% aujourd’hui seulement. Commandez maintenant !', cta_type: 'SHOP_NOW' }),
  A('FR', true, { title: 'Moule à gâteau en silicone', body: 'Démoulage facile, compatible four. Lot de 3. 19€ – livraison gratuite.', cta_type: 'SHOP_NOW' }, 'cake mould'),
  A('FR', false, { title: 'Formation en ligne : devenez esthéticienne', body: 'Formation certifiante 100% en ligne. Inscriptions ouvertes, places limitées. Inscrivez-vous !', cta_type: 'SIGN_UP' }, 'course'),
  A('FR', false, { title: 'Nouvelle boutique à Lyon', body: 'Venez nous rendre visite ! Ouvert du lundi au samedi, 10h-19h. Adresse : 12 rue de la République.', cta_type: 'GET_DIRECTIONS' }, 'store'),
  A('FR', false, { title: 'Pâtisserie artisanale', body: 'Nos gâteaux et viennoiseries faits maison. Commandez votre gâteau d’anniversaire !', page_categories: ['Bakery'] }, 'food'),
  A('FR', false, { title: 'Prêt personnel à taux réduit', body: 'Simulez votre crédit en 2 minutes. Réponse immédiate.', cta_type: 'APPLY_NOW', page_categories: ['Financial Service'] }, 'finance'),
  A('FR', false, { title: 'Canapé d’angle convertible', body: 'Canapé 5 places en tissu gris, livraison offerte. 899€', cta_type: 'SHOP_NOW' }, 'bulky'),
  // ---- Spain
  A('ES', true, { title: 'Adiós a las manchas de tu sofá', body: 'Limpiador de tapicería portátil. Envío gratis y pago contra reembolso. Solo 29,95€. ¡Pídelo ya!', cta_type: 'SHOP_NOW' }, 'cleaner for the sofa'),
  A('ES', true, { title: 'Ayuda a tu bebé a dormir', body: 'Ruido blanco y luz nocturna. Envío gratis a toda España. 50% de descuento.', cta_type: 'SHOP_NOW' }),
  A('ES', false, { title: 'Curso online de maquillaje profesional', body: 'Clases en directo, certificado incluido. ¡Inscríbete hoy, plazas limitadas!', cta_type: 'SIGN_UP' }, 'course'),
  A('ES', false, { title: 'Visítanos en nuestra nueva sucursal', body: 'Gran apertura en Madrid. Horario: de 10 a 21h. Te esperamos.', cta_type: 'GET_DIRECTIONS' }, 'store'),
  A('ES', false, { title: 'Galletas artesanas de mantequilla', body: 'Caja de galletas recién horneadas. Pide ya, envío 24h.', cta_type: 'SHOP_NOW' }, 'food'),
  A('ES', true, { title: 'Es seguro para tu bebé', body: 'Protector de esquinas de silicona, sin BPA. Pack de 8. Envío gratis.', cta_type: 'SHOP_NOW' }, '"seguro" means safe, not insurance'),
  // ---- India
  A('IN', true, { title: 'Get rid of back pain in 7 days', body: 'Posture corrector belt for men & women. Cash on delivery available. ₹499 only. Order now!', cta_type: 'SHOP_NOW' }),
  A('IN', true, { title: 'Kitchen ka jugaad', body: 'Vegetable chopper 12 in 1 – saaf aur aasan. COD available, free delivery. Rs 399', cta_type: 'ORDER_NOW' }),
  A('IN', false, { title: 'Admissions open 2026', body: 'NEET/JEE coaching classes. Enroll now for the new batch. Limited seats.', page_categories: ['Education'], cta_type: 'SIGN_UP' }, 'coaching'),
  A('IN', false, { title: 'Pure desi ghee and homemade achar', body: 'Order fresh mithai and namkeen online. Free delivery above ₹999.', cta_type: 'SHOP_NOW' }, 'food'),
  A('IN', false, { title: 'Earn money online from home', body: 'Join our trading course, earn ₹50,000/month. Download app now.', cta_type: 'INSTALL_MOBILE_APP' }, 'digital/trading'),
  A('IN', false, { title: 'Visit our showroom', body: 'Biggest furniture showroom in Pune – sofa, double bed, almirah. Address: FC Road. Open daily.', cta_type: 'GET_DIRECTIONS' }, 'store + bulky'),
  // ---- Pakistan
  A('PK', true, { title: 'Chehre ke daagh se chhutkara', body: 'Vitamin C serum, 100% original. Cash on delivery all over Pakistan. Rs 1,499 only. Order now', cta_type: 'SHOP_NOW' }),
  A('PK', true, { title: 'Gari ki safai ab aasan', body: 'Portable car vacuum cleaner. Free delivery, COD. Rs 2,999', cta_type: 'ORDER_NOW' }),
  A('PK', false, { title: 'Umrah package 2026', body: '15 days Umrah package with hotel near Haram. Book now, limited seats.', cta_type: 'BOOK_TRAVEL' }, 'travel service'),
  A('PK', false, { title: 'Admissions open', body: 'Daakhla jari hai! Spoken English classes and IELTS course. Call now.', cta_type: 'CALL_NOW', page_categories: ['Education'] }, 'course'),
  A('PK', false, { title: 'Desi ghee mithai', body: 'Fresh mithai aur nimko ghar par order karein. Free delivery in Lahore.', cta_type: 'ORDER_NOW' }, 'food'),
  // ---- Philippines
  A('PH', true, { title: 'Wala nang lamok sa bahay!', body: 'Mosquito killer lamp, USB powered. COD nationwide, free shipping. ₱399 lang! Order na!', cta_type: 'SHOP_NOW', link_url: 'https://shopee.ph/product/123/456' }),
  A('PH', true, { title: 'Makakatulong sa likod mo', body: 'Back support posture corrector. Cash on delivery. Sulit na sulit! Php 299', cta_type: 'MESSAGE_PAGE' }),
  A('PH', false, { title: 'House and lot for sale', body: 'Pre-selling 2BR house and lot in Cavite. Low monthly amortization. Message us for a free tripping!', cta_type: 'MESSAGE_PAGE', page_categories: ['Real Estate'] }, 'real estate'),
  A('PH', false, { title: 'Ube cheese pandesal', body: 'Freshly baked tinapay and kakanin. Order na for pick up or delivery!', cta_type: 'ORDER_NOW' }, 'food'),
  A('PH', false, { title: "We're hiring!", body: 'Call center agents needed. No experience required. Apply now!', cta_type: 'APPLY_NOW' }, 'jobs'),
  // ---- Taiwan
  A('TW', true, { title: '告別腰痛！', body: '人體工學護腰坐墊，久坐不累。全館免運，貨到付款。限時特價 NT$590', cta_type: 'SHOP_NOW' }),
  A('TW', true, { title: '幫助寶寶一夜好眠', body: '白噪音安撫小夜燈，現貨供應，下單立即出貨。特價 790元', cta_type: 'SHOP_NOW' }),
  A('TW', true, { title: '蛋糕模具三件組', body: '矽膠蛋糕模具，耐熱好脫模。免運 NT$399', cta_type: 'SHOP_NOW' }, 'cake mould'),
  A('TW', false, { title: '線上課程限時報名', body: '電商操盤手實戰課程，立即報名享早鳥優惠！', cta_type: 'SIGN_UP' }, 'course'),
  A('TW', false, { title: '鳳梨酥禮盒', body: '在地手工鳳梨酥，中秋送禮首選，限時優惠。', cta_type: 'SHOP_NOW' }, 'food'),
  A('TW', false, { title: '新店開幕', body: '台北信義門市盛大開幕，歡迎蒞臨！營業時間 11:00-21:00', cta_type: 'GET_DIRECTIONS' }, 'store'),
  A('TW', false, { title: '北歐風布沙發', body: '三人座沙發，免費到府安裝。', cta_type: 'SHOP_NOW' }, 'bulky'),
  // ---- Vietnam
  A('VN', true, { title: 'Giúp bé ngủ ngon cả đêm', body: 'Đèn ngủ tiếng ồn trắng cho bé. Freeship toàn quốc, nhận hàng mới thanh toán. Chỉ 199k!', cta_type: 'SHOP_NOW' }),
  A('VN', true, { title: 'Đánh bay vết bẩn nhà bếp', body: 'Bình xịt tẩy dầu mỡ đa năng. Giảm 50% hôm nay. Đặt hàng ngay!', cta_type: 'SHOP_NOW' }),
  A('VN', true, { title: 'Khuôn bánh silicon', body: 'Bộ khuôn bánh 6 món, chịu nhiệt tốt. Freeship. 149k', cta_type: 'SHOP_NOW' }, 'cake mould'),
  A('VN', false, { title: 'Khóa học livestream bán hàng', body: 'Đăng ký học ngay hôm nay, nhận chứng chỉ sau khóa học. Số lượng có hạn!', cta_type: 'SIGN_UP' }, 'course'),
  A('VN', false, { title: 'Bánh trung thu handmade', body: 'Bánh trung thu nhân thập cẩm, hộp 4 bánh. Đặt hàng ngay, giao toàn quốc.', cta_type: 'SHOP_NOW' }, 'food'),
  A('VN', false, { title: 'Khai trương chi nhánh mới', body: 'Ghé cửa hàng tại 25 Lê Lợi, Quận 1. Giờ mở cửa 8h-22h.', cta_type: 'GET_DIRECTIONS' }, 'store'),
  A('VN', false, { title: 'Spa trị mụn chuẩn y khoa', body: 'Đặt lịch hẹn ngay để được tư vấn miễn phí tại phòng khám.', cta_type: 'BOOK_NOW' }, 'service'),
  // ---- Indonesia
  A('ID', true, { title: 'Atasi jerawat dalam 7 hari', body: 'Serum anti jerawat BPOM. Gratis ongkir, bisa COD! Cuma Rp89.000. Checkout sekarang', cta_type: 'SHOP_NOW', link_url: 'https://www.tokopedia.com/toko/serum' }),
  A('ID', true, { title: 'Bantu si kecil makan lahap', body: 'Piring makan bayi anti tumpah. Ready stock, bisa COD. Promo Rp45rb', cta_type: 'SHOP_NOW' }),
  A('ID', true, { title: 'Cetakan kue silikon', body: 'Set cetakan kue 12 lubang, anti lengket. Gratis ongkir.', cta_type: 'SHOP_NOW' }, 'cake mould'),
  A('ID', false, { title: 'Kursus digital marketing', body: 'Kelas online bersertifikat. Daftar sekarang, kuota terbatas!', cta_type: 'SIGN_UP' }, 'course'),
  A('ID', false, { title: 'Kue kering lebaran', body: 'Nastar, kastengel dan putri salju. Pesan sekarang, gratis ongkir Jabodetabek.', cta_type: 'SHOP_NOW' }, 'food'),
  A('ID', false, { title: 'Grand opening cabang baru!', body: 'Kunjungi toko kami di Mall Kelapa Gading. Buka setiap hari 10.00-22.00', cta_type: 'GET_DIRECTIONS' }, 'store'),
  A('ID', false, { title: 'Pinjaman cepat cair', body: 'Pinjaman online tanpa jaminan, cair 5 menit. Download aplikasi sekarang.', cta_type: 'INSTALL_MOBILE_APP' }, 'loan app'),
  // ---- Algeria (existing workflow must keep its products)
  A('DZ', true, { title: 'يساعد طفلك على النوم', body: 'مصباح ليلي بصوت أبيض. التوصيل لـ 58 ولاية والدفع عند الاستلام. السعر 3500 دج. اطلب الآن', cta_type: 'SHOP_NOW' }),
  A('DZ', true, { title: 'وداعا لمشاكل التسرب', body: 'شريط لاصق مقاوم للماء يحبّس التسرب في ثواني. خدمة التوصيل متوفرة لجميع الولايات. 2200 دج', cta_type: 'MESSAGE_PAGE' }, '"خدمة التوصيل" is not a service ad'),
  A('DZ', true, { title: 'قالب كيك سيليكون', body: 'قوالب حلويات سيليكون مقاومة للحرارة، طقم 6 قطع. 1800 دج مع التوصيل', cta_type: 'SHOP_NOW' }, 'cake mould'),
  A('DZ', false, { title: 'دورة تكوينية في الحلاقة', body: 'التسجيلات مفتوحة! تكوين مع شهادة معتمدة. سجل الآن، الأماكن محدودة', cta_type: 'SIGN_UP' }, 'course'),
  A('DZ', false, { title: 'حلويات تقليدية', body: 'مقروط وبقلاوة وحلويات العيد. اطلب الآن والتوصيل متوفر', cta_type: 'ORDER_NOW' }, 'food'),
  // ---- hard cases: product ads with misleading words, and non-product ads without obvious words
  A("US", true, {"title":"Of course it works!","body":"Our posture corrector fixes slouching in 2 weeks. $24.99 free shipping","cta_type":"SHOP_NOW"}, 'hard case'),
  A("US", true, {"title":"Perfect gift for coffee lovers","body":"Smart mug warmer keeps your coffee hot all day. 30% off","cta_type":"SHOP_NOW"}, 'hard case'),
  A("US", true, {"title":"3-in-1 hair dryer brush","body":"Dry, straighten and volumize in one step. Free shipping","cta_type":"SHOP_NOW"}, 'hard case'),
  A("US", true, {"title":"Tea tree oil shampoo","body":"Stops dandruff and itchy scalp. Buy 2 get 1 free","cta_type":"SHOP_NOW"}, 'hard case'),
  A("US", true, {"title":"Chocolate brown leather wallet","body":"RFID blocking slim wallet. Only $19 today","cta_type":"SHOP_NOW"}, 'hard case'),
  A("US", true, {"title":"Never lose your phone between car seats again","body":"Car seat gap filler, 2 pack. Free shipping","cta_type":"SHOP_NOW"}, 'hard case'),
  A("US", true, {"title":"Turn your couch into a cozy reading nook","body":"Couch arm tray table organizer. 40% off","cta_type":"SHOP_NOW"}, 'hard case'),
  A("US", true, {"title":"Kids learn to read faster","body":"Montessori phonics flash cards for toddlers. Free shipping on orders over $35","cta_type":"SHOP_NOW"}, 'hard case'),
  A("US", true, {"title":"Potty training made easy","body":"Toddler potty training seat with handles. Only $21.99","cta_type":"SHOP_NOW"}, 'hard case'),
  A("US", true, {"title":"Turn any room into a home gym","body":"Resistance bands set of 5. Buy now","cta_type":"SHOP_NOW"}, 'hard case'),
  A("FR", true, {"title":"Nettoyez votre machine à café","body":"Pastilles détartrantes, lot de 20. Livraison gratuite","cta_type":"SHOP_NOW"}, 'hard case'),
  A("FR", true, {"title":"Coussin de canapé ergonomique","body":"Soulage le dos. -30%. Commandez","cta_type":"SHOP_NOW"}, 'hard case'),
  A("FR", true, {"title":"Prêt à l'emploi","body":"Spray anti-buée pour pare-brise. 14,90€. Livraison gratuite","cta_type":"SHOP_NOW"}, 'hard case'),
  A("FR", true, {"title":"Rangement pour réfrigérateur","body":"Bacs empilables, lot de 6. Livraison gratuite","cta_type":"SHOP_NOW"}, 'hard case'),
  A("FR", true, {"title":"Ouverture facile","body":"Ouvre-bocal électrique pour seniors. 19,90€","cta_type":"SHOP_NOW"}, 'hard case'),
  A("ES", true, {"title":"Organizador para nevera","body":"Set de 6 cajas transparentes. Envío gratis","cta_type":"SHOP_NOW"}, 'hard case'),
  A("ID", true, {"title":"Sarung kasur anti air","body":"Pelindung kasur waterproof. Gratis ongkir, bisa COD","cta_type":"SHOP_NOW"}, 'hard case'),
  A("ID", true, {"title":"Tas sekolah anak anti air","body":"Tas ransel karakter, ringan. Promo Rp99rb, bisa COD","cta_type":"SHOP_NOW"}, 'hard case'),
  A("VN", true, {"title":"Máy pha cà phê mini","body":"Pha espresso trong 1 phút. Freeship, giảm 30%","cta_type":"SHOP_NOW"}, 'hard case'),
  A("VN", true, {"title":"Ốp bánh xe máy","body":"Bọc bánh xe chống bùn. Freeship","cta_type":"SHOP_NOW"}, 'hard case'),
  A("TW", true, {"title":"咖啡色真皮皮夾","body":"RFID防盜，限時特價 NT$690，免運","cta_type":"SHOP_NOW"}, 'hard case'),
  A("TW", true, {"title":"電競遊戲手把","body":"無線藍牙，支援手機與電腦。免運","cta_type":"SHOP_NOW"}, 'hard case'),
  A("PH", true, {"title":"Aircon cleaner spray","body":"Linisin ang aircon mo, no need for technician. COD nationwide","cta_type":"SHOP_NOW"}, 'hard case'),
  A("IN", true, {"title":"Mobile stand for bed","body":"Flexible gooseneck holder. COD available. Rs 299","cta_type":"SHOP_NOW"}, 'hard case'),
  A("IN", true, {"title":"3 khane wala organizer","body":"Kitchen organizer rack. COD. ₹349","cta_type":"SHOP_NOW"}, 'hard case'),
  A("DZ", true, {"title":"علبة حفظ الأكل","body":"علب حفظ الطعام 5 قطع، التوصيل لجميع الولايات، 2500 دج","cta_type":"SHOP_NOW"}, 'hard case'),
  A("DZ", true, {"title":"حقيبة رحلات","body":"حقيبة سفر مقاومة للماء، الدفع عند الاستلام، 3900 دج","cta_type":"SHOP_NOW"}, 'hard case'),
  A("DZ", true, {"title":"سهل التطبيق","body":"لاصق جدران ثلاثي الأبعاد سهل التطبيق، 1500 دج، التوصيل 58 ولاية","cta_type":"SHOP_NOW"}, 'hard case'),
  A("US", false, {"title":"Dental implants in one day","body":"Learn more about our dental implants. Free consultation for new patients.","cta_type":"LEARN_MORE","page_categories":["Dentist & Dental Office"]}, 'hard case'),
  A("US", false, {"title":"Scale your brand with Facebook ads","body":"Our agency helps e-commerce brands grow. Book a call with our team.","cta_type":"BOOK_NOW","page_categories":["Marketing Agency"]}, 'hard case'),
  A("VN", false, {"title":"Dịch vụ vệ sinh máy lạnh tận nhà","body":"Đặt lịch ngay, có mặt sau 30 phút.","cta_type":"CALL_NOW"}, 'hard case'),
  A("ID", false, {"title":"Jasa pembuatan website","body":"Website toko online profesional, konsultasi gratis!","cta_type":"WHATSAPP_MESSAGE"}, 'hard case'),
  A("TW", false, {"title":"牙醫診所","body":"植牙矯正，線上預約享優惠","cta_type":"BOOK_NOW"}, 'hard case'),
  A("ES", false, {"title":"Seguros de coche baratos","body":"Calcula tu seguro en 2 minutos","cta_type":"LEARN_MORE"}, 'hard case'),
  A("GB", false, {"title":"Live music every Friday","body":"Join us at The Crown pub. Free entry.","cta_type":"LEARN_MORE","page_categories":["Bar"]}, 'hard case'),
  A("FR", false, {"title":"Webinaire gratuit","body":"Comment lancer sa boutique Shopify. Inscrivez-vous !","cta_type":"SIGN_UP"}, 'hard case'),
  A("IN", false, {"title":"2BHK flats in Noida","body":"Ready to move flats starting ₹45 lakh. Book site visit.","cta_type":"LEARN_MORE","page_categories":["Real Estate"]}, 'hard case'),
  A("PH", false, {"title":"Milk tea 1+1 promo","body":"Buy 1 take 1 sa lahat ng branch!","cta_type":"LEARN_MORE"}, 'hard case'),
  A("US", false, {"title":"","body":"","cta_type":"SHOP_NOW"}, 'hard case'),
  A('DZ', false, { title: 'افتتاح فرعنا الجديد', body: 'زورونا في محلنا بباب الزوار. مفتوح يوميا من 9 صباحا. العنوان: حي الجرف', cta_type: 'GET_DIRECTIONS' }, 'store')
];
// ---- لغات 9.0: اليابانية، الكورية، الهولندية، البولندية، البنغالية، الصينية المبسطة، الخليجية، المصرية
CASES.push(
  A('JP', true, { title: '腰痛を解消', body: '姿勢矯正ベルト。送料無料、今すぐ購入 2,980円', cta_type: 'SHOP_NOW' }),
  A('JP', false, { title: 'オンライン講座', body: '副業で稼ぐ方法を学ぶセミナー。今すぐ申し込み', cta_type: 'SIGN_UP' }, 'course'),
  A('JP', true, { title: 'おしゃれな眼鏡ケース', body: '送料無料 1,500円', cta_type: 'SHOP_NOW' }, '"眼鏡" is eyewear, not a fragile mirror'),
  A('KR', true, { title: '허리 통증 해결', body: '자세 교정 밴드. 무료배송, 지금 구매 19,900원', cta_type: 'SHOP_NOW' }),
  A('KR', true, { title: '차량용 방향제', body: '자동차 필수템! 무료배송', cta_type: 'SHOP_NOW' }, '"차" inside "자동차" is not tea'),
  A('KR', false, { title: '수강 신청 오픈', body: '온라인 강의로 자격증 취득! 지금 수강 신청', cta_type: 'SIGN_UP' }, 'course'),
  A('NL', true, { title: 'Zeg vaarwel tegen rugpijn', body: 'Houdingscorrector. Gratis verzending, bestel nu €24,95', cta_type: 'SHOP_NOW' }),
  A('NL', false, { title: 'Wij zoeken jou!', body: 'Vacature: magazijnmedewerker. Solliciteer nu.', cta_type: 'APPLY_NOW' }, 'jobs'),
  A('PL', true, { title: 'Pozbądź się bólu pleców', body: 'Korektor postawy. Darmowa dostawa, zamów teraz 99 zł', cta_type: 'SHOP_NOW' }),
  A('PL', false, { title: 'Kurs online', body: 'Zapisz się na szkolenie z certyfikatem!', cta_type: 'SIGN_UP' }, 'course'),
  A('BD', true, { title: 'কোমর ব্যথা থেকে মুক্তি পান', body: 'পোস্চার বেল্ট। ক্যাশ অন ডেলিভারি, ফ্রি ডেলিভারি। মাত্র ৳৯৯০', cta_type: 'SHOP_NOW' }),
  A('BD', false, { title: 'ভর্তি চলছে', body: 'অনলাইন কোর্স ও কোচিং। এখনই রেজিস্ট্রেশন করুন', cta_type: 'SIGN_UP' }, 'course'),
  A('SG', true, { title: '告别腰痛', body: '人体工学护腰坐垫，包邮，限时特价 S$29', cta_type: 'SHOP_NOW' }),
  A('SG', false, { title: '凤梨酥礼盒', body: '手工凤梨酥，中秋送礼首选', cta_type: 'SHOP_NOW' }, 'food (simplified)'),
  A('SA', true, { title: 'يخلصك من ألم الظهر', body: 'حزام تعديل القوام، التوصيل مجاني والدفع عند الاستلام، 149 ريال', cta_type: 'SHOP_NOW' }),
  A('SA', false, { title: 'لقيمات وكنافة', body: 'اطلب الحين، توصيل لكل الرياض', cta_type: 'ORDER_NOW' }, 'food (gulf)'),
  A('EG', true, { title: 'هيخلصك من ألم الضهر', body: 'حزام لتعديل القوام، الدفع عند الاستلام، 450 جنيه، اطلب دلوقتي', cta_type: 'SHOP_NOW' }),
  A('EG', false, { title: 'كحك العيد', body: 'كحك وبسكويت بالسمن، اطلب دلوقتي', cta_type: 'ORDER_NOW' }, 'food (egyptian)')
);
for (const c of ['JP', 'KR', 'NL', 'PL', 'BD', 'SG', 'SA', 'EG']) ok(M.langsOf(c).length, c + ' has search languages');
ok(M.langsOf('JP')[0] === 'ja' && M.langsOf('KR')[0] === 'ko' && M.langsOf('NL')[0] === 'nl' && M.langsOf('PL')[0] === 'pl' && M.langsOf('BD')[0] === 'bn', 'new markets search in their own language');
ok(M.langsOf('SA').includes('gulf') && M.langsOf('EG').includes('eg') && M.langsOf('SG').includes('zhs'), 'Gulf, Egyptian and Simplified Chinese are used');

/* ---------- المعنى بالعربية لكل كلمة أجنبية ---------- */
let missing = [];
for (const lg of M.NEW_LANGS) {
  if (['gulf', 'eg'].includes(lg)) continue;
  const all = M.KW[lg].strong.concat(M.KW[lg].normal, ...Object.values(M.KW[lg].comps));
  for (const t of all) if (!/^[؀-ۿ\s]+$/.test(t) && !M.gloss(lg, t)) missing.push(lg + ':' + t);
}
ok(!missing.length, 'every foreign keyword has an Arabic meaning ' + missing.slice(0, 5).join(', '));
ok(M.gloss('en', 'Helps') === 'يساعد' && M.gloss('vi', 'Giúp') === 'يساعد' && M.gloss('zh', '幫助') === 'يساعد' && M.gloss('fr', 'dites adieu à'), 'meanings for English, Vietnamese, Chinese and the Algerian French list');

/* ---------- العملات وحد البائعين حسب السوق ---------- */
ok(M.currencyOf('Only $29.99', 'US') === 'USD' && M.currencyOf('Only $29.99', 'CA') === 'CAD' && M.currencyOf('Rs 1,499', 'PK') === 'PKR' && M.currencyOf('Rs 499', 'IN') === 'INR', '$ and Rs are resolved by market');
ok(M.currencyOf('199k freeship', 'VN') === 'VND' && M.currencyOf('NT$590', 'TW') === 'TWD' && M.currencyOf('3500 دج', 'FR') === 'DZD' && M.currencyOf('24,90€', 'DZ') === 'EUR', 'explicit currencies win');
ok(M.sellersMax('DZ') === 3 && M.sellersMax('US') > 3 && M.sellersMax('IN') > 3, 'Algeria keeps 3 sellers, big markets allow more');
ok(M.RATES_DZD.USD > 0 && M.RATES_DZD.EUR > 0 && M.curSymbol('EUR') === '€', 'rates and symbols');

const byCountry = {};
for (const c of CASES) {
  const r = PC.check(c.ad, { country: c.country });
  const s = (byCountry[c.country] = byCountry[c.country] || { n: 0, ok: 0 });
  s.n++; if (r.ok === c.keep) s.ok++;
  ok(r.ok === c.keep, `${c.country} ${c.keep ? 'keep' : 'reject'} «${c.ad.title}» ${c.note || ''} → ${r.ok ? 'kept' : 'rejected: ' + r.reasons.join(' ')} [P=${r.product}]`);
}
console.log('accuracy by country:', Object.entries(byCountry).map(([c, s]) => `${c} ${s.ok}/${s.n}`).join(' · '));
console.log(fail ? `FAILED ${fail} / ${pass + fail}` : `PASS ${pass} market checks`);
process.exitCode = fail ? 1 : 0;
