// Ad Radar – the ten niches. A niche is defined by its complement words (the nouns that pin the niche down),
// written in three scripts so each golden-word language pairs with its own complements:
//   ar  → Arabic script (used with Fusha + Darija golden words)
//   fr  → French (used with French golden words)
//   arz → Arabizi, Darija in Latin letters + digits (used with Arabizi golden words)
(function (root) {
  'use strict';

  const DEFAULT_NICHES = [
    {
      id: 'kids', name: 'منتجات الأطفال والأمهات',
      comps: {
        ar: ['طفلك', 'الأطفال', 'ابنك', 'صغيرك', 'رضيعك', 'المولود', 'الرضاعة', 'الأم', 'الحامل', 'بنتك'],
        fr: ['votre enfant', 'enfants', 'bébé', 'nourrisson', 'maman', 'allaitement', 'grossesse', 'nouveau-né'],
        arz: ['tflek', 'wldek', 'sghirek', 'bebe', 'mama']
      }
    },
    {
      id: 'home', name: 'المنزل والمطبخ',
      comps: {
        ar: ['المطبخ', 'البيت', 'المنزل', 'الطبخ', 'الحمام', 'الغسيل', 'التنظيف', 'الأواني', 'الأرضية', 'الغبار'],
        fr: ['cuisine', 'maison', 'salle de bain', 'ménage', 'vaisselle', 'rangement', 'nettoyage'],
        arz: ['cuisine', 'dar', 'hammam', 'tbikh', 'tanzif']
      }
    },
    {
      id: 'beauty', name: 'الجمال والعناية الشخصية',
      comps: {
        ar: ['بشرتك', 'البشرة', 'وجهك', 'شعرك', 'الشعر', 'أسنانك', 'الأظافر', 'التجاعيد', 'الجسم', 'اللحية'],
        fr: ['votre peau', 'peau', 'cheveux', 'visage', 'dents', 'ongles', 'rides', 'barbe'],
        arz: ['bechrtek', 'wejhek', 'cha3rek', 'sennek', 'cheveux']
      }
    },
    {
      id: 'car', name: 'إكسسوارات السيارات',
      comps: {
        ar: ['سيارتك', 'السيارة', 'المحرك', 'المقود', 'المقاعد', 'الإطارات', 'لوحة القيادة', 'الزجاج الأمامي'],
        fr: ['voiture', 'auto', 'moteur', 'pare-brise', 'volant', 'sièges', 'pneus', 'tableau de bord'],
        arz: ['tonobil', 'voiture', 'moteur', 'volan', 'pneu']
      }
    },
    {
      id: 'pets', name: 'الحيوانات الأليفة',
      comps: {
        ar: ['قطتك', 'كلبك', 'القطط', 'الكلاب', 'حيوانك', 'الحيوانات الأليفة', 'الطيور'],
        fr: ['votre chat', 'votre chien', 'chats', 'chiens', 'animaux', 'litière'],
        arz: ['9ettek', 'klebek', 'chat', 'chien']
      }
    },
    {
      id: 'sport', name: 'الرياضة واللياقة',
      comps: {
        ar: ['عضلاتك', 'اللياقة', 'الجري', 'التمرين', 'التمارين', 'الركبة', 'الجسم', 'الرياضة'],
        fr: ['musculation', 'sport', 'fitness', 'course', 'entraînement', 'muscles', 'yoga'],
        arz: ['sport', 'muscu', 'tmarin', 'fitness']
      }
    },
    {
      id: 'travel', name: 'السفر والتنظيم',
      comps: {
        ar: ['السفر', 'حقيبتك', 'الحقيبة', 'الشنطة', 'الرحلة', 'الأمتعة', 'المنظم', 'الجواز'],
        fr: ['voyage', 'valise', 'bagages', 'organisation', 'rangement', 'sac'],
        arz: ['safar', 'valise', 'sac', 'voyage']
      }
    },
    {
      id: 'phone', name: 'إكسسوارات الهاتف',
      comps: {
        ar: ['هاتفك', 'الهاتف', 'الجوال', 'الشاحن', 'البطارية', 'الشاشة', 'السماعات', 'الكابل'],
        fr: ['téléphone', 'smartphone', 'chargeur', 'batterie', 'écran', 'écouteurs', 'coque'],
        arz: ['telifon', 'tel', 'chargeur', 'batterie', 'ecran', 'ecouteur']
      }
    },
    {
      id: 'fashion', name: 'الموضة والإكسسوارات',
      comps: {
        ar: ['ملابسك', 'الأناقة', 'الحذاء', 'الساعة', 'النظارات', 'العطر', 'المجوهرات', 'الحقيبة'],
        fr: ['vêtements', 'mode', 'chaussures', 'montre', 'sac à main', 'lunettes', 'bijoux', 'parfum'],
        arz: ['vetement', 'sebbat', 'montre', 'lunette', 'sac']
      }
    },
    {
      id: 'tools', name: 'الأدوات العملية والإصلاح',
      comps: {
        ar: ['التصليح', 'الأدوات', 'المسامير', 'الأنابيب', 'التسرب', 'الكهرباء', 'السباكة', 'الصنبور', 'المثقاب'],
        fr: ['bricolage', 'réparation', 'outils', 'fuite', 'plomberie', 'électricité', 'perceuse', 'colle'],
        arz: ['bricolage', 'outil', 'fuite', 'plomberie']
      }
    }
  ];

  // Ids of niches shipped by earlier versions: they are replaced, never merged.
  const LEGACY_IDS = ['general', 'kids', 'beauty', 'health', 'home', 'car', 'gadgets', 'pets', 'fr'];

  const api = {
    DEFAULT_NICHES,
    LEGACY_IDS,
    NEW_IDS: DEFAULT_NICHES.map((n) => n.id),
    clone: () => JSON.parse(JSON.stringify(DEFAULT_NICHES))
  };
  root.AdRadarNiches = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
