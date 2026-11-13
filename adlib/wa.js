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
  support: ['طلب مساعدة (الدعم)', ['topic', 'email', 'name']]
};
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
  app.get('/api/wa', auth, wrap((q, s) => s.json({ number: number(), templates: templates() })));
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
module.exports.DEF = DEF; module.exports.KEYS = KEYS; module.exports.templates = templates;
