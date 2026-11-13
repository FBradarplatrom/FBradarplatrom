'use strict';
// رسائل واتساب الجاهزة: يضبطها المدير (إعدادات المنصة ← رسائل واتساب) بثلاث لغات، وتظهر للمشترك في «اشتراكي» و«المساعدة والدعم»
// مع الأزرار المناسبة. القيم بين {} تُملأ تلقائياً من حساب المشترك. واتساب هو قناة التواصل الأساسية، والبريد ثانوي.
const CFG = require('./config.js');

// المتغيرات المتاحة في كل رسالة (تظهر للمدير كمساعدة)
const VARS = { name: 'الاسم', email: 'بريد الحساب', plan: 'العرض المختار', current: 'العرض الحالي', amount: 'المبلغ', days: 'المدة بالأيام', expires: 'تاريخ الانتهاء', store: 'اسم المتجر', request: 'رقم الطلب', topic: 'نوع الطلب' };
const KEYS = {
  pay: ['إرسال وصل الدفع', ['plan', 'days', 'amount', 'store', 'request', 'email', 'name']],
  upgrade: ['ترقية أو تغيير العرض', ['current', 'plan', 'amount', 'email', 'name']],
  renew: ['تجديد الاشتراك', ['plan', 'expires', 'amount', 'email', 'name']],
  billing: ['سؤال عن الدفع أو الاشتراك', ['current', 'expires', 'email', 'name']],
  support: ['طلب مساعدة (الدعم)', ['topic', 'email', 'name']],
  // من المدير إلى المشترك (واتساب أو رسالة داخل المنصة)
  a_welcome: ['ترحيب ومساعدة في البدء', ['name', 'email'], 'admin'],
  a_paid: ['تأكيد الدفع والتفعيل', ['name', 'current', 'expires', 'email'], 'admin'],
  a_receipt: ['مشكلة في وصل الدفع', ['name', 'email'], 'admin'],
  a_renew: ['تذكير بالتجديد / انتهاء الاشتراك', ['name', 'current', 'expires'], 'admin']
};
const isAdminKey = k => (KEYS[k] || [])[2] === 'admin';
const DEF = {
  pay: {
    ar: 'السلام عليكم،\nأرسل لكم وصل الدفع لتفعيل عرضي في رادار المنتجات الرابحة:\n• العرض: {plan} ({days} يوماً)\n• المبلغ: {amount}\n• اسم المتجر: {store}\n• رقم الطلب: #{request}\n• بريد الحساب: {email}\nصورة الوصل مرفقة.',
    en: 'Hello,\nHere is my payment receipt to activate my Winning Product Radar plan:\n• Plan: {plan} ({days} days)\n• Amount: {amount}\n• Store: {store}\n• Request: #{request}\n• Account email: {email}\nReceipt photo attached.',
    fr: 'Bonjour,\nVoici mon reçu de paiement pour activer mon offre Radar des produits gagnants :\n• Offre : {plan} ({days} jours)\n• Montant : {amount}\n• Boutique : {store}\n• Demande : #{request}\n• E-mail du compte : {email}\nPhoto du reçu jointe.'
  },
  upgrade: {
    ar: 'السلام عليكم،\nأريد تغيير عرضي في رادار المنتجات الرابحة:\n• عرضي الحالي: {current}\n• العرض الذي أريده: {plan} ({amount})\n• بريد الحساب: {email}\nكيف أدفع الفرق؟',
    en: 'Hello,\nI would like to change my Winning Product Radar plan:\n• Current plan: {current}\n• New plan: {plan} ({amount})\n• Account email: {email}\nHow can I pay?',
    fr: 'Bonjour,\nJe souhaite changer mon offre Radar des produits gagnants :\n• Offre actuelle : {current}\n• Nouvelle offre : {plan} ({amount})\n• E-mail du compte : {email}\nComment puis-je payer ?'
  },
  renew: {
    ar: 'السلام عليكم،\nأريد تجديد اشتراكي في رادار المنتجات الرابحة:\n• العرض: {plan} ({amount})\n• ينتهي اشتراكي في: {expires}\n• بريد الحساب: {email}',
    en: 'Hello,\nI would like to renew my Winning Product Radar subscription:\n• Plan: {plan} ({amount})\n• My subscription ends on: {expires}\n• Account email: {email}',
    fr: 'Bonjour,\nJe souhaite renouveler mon abonnement Radar des produits gagnants :\n• Offre : {plan} ({amount})\n• Mon abonnement se termine le : {expires}\n• E-mail du compte : {email}'
  },
  billing: {
    ar: 'السلام عليكم،\nعندي سؤال عن اشتراكي في رادار المنتجات الرابحة:\n• عرضي: {current} (ينتهي في {expires})\n• بريد الحساب: {email}\nسؤالي: ',
    en: 'Hello,\nI have a question about my Winning Product Radar subscription:\n• Plan: {current} (ends on {expires})\n• Account email: {email}\nMy question: ',
    fr: 'Bonjour,\nJ’ai une question sur mon abonnement Radar des produits gagnants :\n• Offre : {current} (fin le {expires})\n• E-mail du compte : {email}\nMa question : '
  },
  a_welcome: {
    ar: 'مرحباً {name} في رادار المنتجات الرابحة 👋\nللبدء:\n1) ثبّت إضافة Chrome من «جمع الإعلانات ← الإضافة».\n2) اختر سوقك وكلماتك واضغط «ابدأ الجمع».\n3) افتح «تحليل جديد» لترى المنتجات الرابحة.\nدليل الاستخدام خطوة بخطوة في «المساعدة والدعم»، ونحن هنا لأي سؤال.',
    en: 'Welcome to Winning Product Radar, {name} 👋\nTo start:\n1) Install the Chrome extension from “Collect ads ← Extension”.\n2) Choose your market and words, then click “Start collecting”.\n3) Open “New analysis” to see the winning products.\nThe step-by-step guide is in “Help & support”, and we are here for any question.',
    fr: 'Bienvenue sur Radar des produits gagnants, {name} 👋\nPour commencer :\n1) Installez l’extension Chrome depuis « Collecter des pubs ← Extension ».\n2) Choisissez votre marché et vos mots, puis cliquez sur « Lancer la collecte ».\n3) Ouvrez « Nouvelle analyse » pour voir les produits gagnants.\nLe guide pas à pas est dans « Aide et support », et nous restons disponibles.'
  },
  a_paid: {
    ar: 'السلام عليكم {name}،\nاستلمنا دفعتك وفُعّل عرضك «{current}» في رادار المنتجات الرابحة حتى {expires}.\nشكراً لثقتك، ونحن هنا لأي سؤال.',
    en: 'Hello {name},\nWe received your payment and your “{current}” plan on Winning Product Radar is active until {expires}.\nThank you for your trust; we are here for any question.',
    fr: 'Bonjour {name},\nNous avons reçu votre paiement : votre offre « {current} » sur Radar des produits gagnants est active jusqu’au {expires}.\nMerci de votre confiance, nous restons disponibles.'
  },
  a_receipt: {
    ar: 'السلام عليكم {name}،\nبخصوص وصل الدفع الذي أرسلته: الوصل غير واضح أو المبلغ لا يطابق العرض المطلوب.\nأرسل لنا من فضلك صورة واضحة للوصل (أو أكمل المبلغ) لنفعّل عرضك فوراً.\nبريد الحساب: {email}',
    en: 'Hello {name},\nAbout the payment receipt you sent: it is not clear, or the amount does not match the chosen plan.\nPlease send us a clear photo of the receipt (or complete the amount) and we will activate your plan right away.\nAccount email: {email}',
    fr: 'Bonjour {name},\nÀ propos du reçu de paiement envoyé : il n’est pas lisible ou le montant ne correspond pas à l’offre choisie.\nEnvoyez-nous une photo nette du reçu (ou complétez le montant) et nous activerons votre offre aussitôt.\nE-mail du compte : {email}'
  },
  a_renew: {
    ar: 'السلام عليكم {name}،\nاشتراكك في رادار المنتجات الرابحة («{current}») ينتهي في {expires}.\nجدّده من «اشتراكي ← الدفع والتجديد» حتى لا يتوقف عملك، وبياناتك تبقى محفوظة كما هي.',
    en: 'Hello {name},\nYour Winning Product Radar subscription (“{current}”) ends on {expires}.\nRenew it from “My subscription ← Payment & renewal” so your work does not stop; your data stays saved.',
    fr: 'Bonjour {name},\nVotre abonnement Radar des produits gagnants (« {current} ») se termine le {expires}.\nRenouvelez-le depuis « Mon abonnement ← Paiement et renouvellement » pour ne pas interrompre votre travail ; vos données restent enregistrées.'
  },
  support: {
    ar: 'السلام عليكم،\nأحتاج مساعدة في رادار المنتجات الرابحة:\n• نوع الطلب: {topic}\n• بريد الحساب: {email}\nالمشكلة: ',
    en: 'Hello,\nI need help with Winning Product Radar:\n• Topic: {topic}\n• Account email: {email}\nThe problem: ',
    fr: 'Bonjour,\nJ’ai besoin d’aide avec Radar des produits gagnants :\n• Sujet : {topic}\n• E-mail du compte : {email}\nLe problème : '
  }
};
const LANGS = ['ar', 'en', 'fr'];
function templates() {
  let c = {}; try { c = JSON.parse(CFG.get('wa_templates') || '{}') || {}; } catch (e) {}
  const out = {};
  for (const k of Object.keys(KEYS)) { out[k] = {}; for (const l of LANGS) out[k][l] = (c[k] && typeof c[k][l] === 'string' && c[k][l].trim()) ? c[k][l] : DEF[k][l]; }
  return out;
}
const number = () => String(CFG.get('support_whatsapp') || '').replace(/[^\d]/g, '');

module.exports = function mountWA(app, { auth, admin, wrap }) {
  // للمشترك: الرقم والرسائل (كل اللغات؛ الواجهة تختار لغتها)
  app.get('/api/wa', auth, wrap((q, s) => { const t = templates(); Object.keys(t).forEach(k => { if (isAdminKey(k)) delete t[k]; }); s.json({ number: number(), templates: t }); }));
  // للمدير: الرسائل الحالية + الافتراضية + المتغيرات المسموحة
  app.get('/api/admin/wa', auth, admin, wrap((q, s) => s.json({ number: number(), templates: templates(), defaults: DEF, keys: KEYS, vars: VARS })));
  app.put('/api/admin/wa', auth, admin, wrap((q, s) => {
    const b = (q.body || {}).templates || {}, out = {};
    for (const k of Object.keys(KEYS)) for (const l of LANGS) {
      const v = b[k] && typeof b[k][l] === 'string' ? b[k][l].replace(/\r/g, '').slice(0, 1500).trim() : '';
      if (v && v !== DEF[k][l]) { out[k] = out[k] || {}; out[k][l] = v; }   // المطابق للافتراضي لا يُحفظ (يتحدث مع النسخ)
    }
    CFG.set('wa_templates', Object.keys(out).length ? JSON.stringify(out) : '');
    s.json({ ok: 1, templates: templates() });
  }));
};
module.exports.DEF = DEF; module.exports.KEYS = KEYS; module.exports.templates = templates; module.exports.isAdminKey = isAdminKey;
