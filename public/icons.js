/* أيقونات خطية موحّدة بدل الإيموجي (بأسلوب Lucide، رخصة ISC): كل إيموجي في واجهة المنصة يُرسم أيقونة SVG بلون النص.
   يعمل تلقائياً على الصفحة وما يُرسم لاحقاً، ويترك نص المستخدم (الإعلانات، أسماء المنتجات) كما هو.
   W.ICO(name) يعيد وسم SVG لاستعماله في الكود مباشرة. */
(function (W, D) {
  'use strict';
  var P = {
    check: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    factory: '<path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1M12 18h1M7 18h1"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    sparkles: '<path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.13-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.13a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.13 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.13a.5.5 0 0 1-.96 0z"/><path d="M20 3v4M22 5h-4"/>',
    gem: '<path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>',
    radar: '<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>',
    sprout: '<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    hourglass: '<path d="M5 22h14M5 2h14M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    flask: '<path d="M10 2v7.53a2 2 0 0 1-.27 1L4.7 19a2 2 0 0 0 1.73 3h11.14a2 2 0 0 0 1.73-3l-5.03-8.47a2 2 0 0 1-.27-1V2"/><path d="M8.5 2h7M7 16h10"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    star: '<path d="M11.5 2.3a.53.53 0 0 1 .95 0l2.31 4.68a2.1 2.1 0 0 0 1.6 1.16l5.16.76a.53.53 0 0 1 .3.9l-3.74 3.64a2.1 2.1 0 0 0-.61 1.88l.88 5.14a.53.53 0 0 1-.77.56l-4.62-2.43a2.1 2.1 0 0 0-1.97 0L6.4 21.01a.53.53 0 0 1-.77-.56l.88-5.14a2.1 2.1 0 0 0-.61-1.88L2.16 9.8a.53.53 0 0 1 .3-.9l5.16-.76a2.1 2.1 0 0 0 1.6-1.16z"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    unlock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C9 3 12 8 12 8s3-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    phone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
    laptop: '<path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    plug: '<path d="M12 22v-5M9 8V2M15 8V2M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>',
    clip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
    puzzle: '<path d="M15.39 4.39a1 1 0 0 0 1.68-.47 2.5 2.5 0 1 1 3.01 3.01 1 1 0 0 0-.47 1.68l1.68 1.68a2.4 2.4 0 0 1 0 3.42l-1.61 1.61a1 1 0 0 1-1.7-.48 2.5 2.5 0 1 0-3.21 3.21 1 1 0 0 1 .48 1.7l-1.61 1.61a2.4 2.4 0 0 1-3.42 0l-1.68-1.68a1 1 0 0 0-1.68.47 2.5 2.5 0 1 1-3.01-3.01 1 1 0 0 0 .47-1.68l-1.68-1.68a2.4 2.4 0 0 1 0-3.42L4.24 8.7a1 1 0 0 1 1.7.48 2.5 2.5 0 1 0 3.21-3.21 1 1 0 0 1-.48-1.7l1.61-1.61a2.4 2.4 0 0 1 3.42 0z"/>',
    up: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    down: '<path d="m22 17-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',
    copy: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
    chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8H8M16 12H8M13 16H8"/>',
    pen: '<path d="M12 20h9"/><path d="M16.38 3.62a1 1 0 0 1 3 3L7.37 18.64a2 2 0 0 1-.86.5l-2.87.84a.5.5 0 0 1-.62-.62l.84-2.87a2 2 0 0 1 .5-.86z"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    pain: '<circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2M9 9h.01M15 9h.01"/>',
    swap: '<path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/>',
    zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
    video: '<path d="m16 13 5.22 3.48a.5.5 0 0 0 .78-.42V7.87a.5.5 0 0 0-.75-.43L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
    chart: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
    cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7M7 3v4a1 1 0 0 0 1 1h7"/>',
    x: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>',
    book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>',
    edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .71-1.53l7-6a2 2 0 0 1 2.58 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
    bottle: '<path d="M10 2v2.34M14 2v2.34"/><path d="M9 4.34h6a1 1 0 0 1 1 1v2.32a1 1 0 0 0 .3.71l.4.4a1 1 0 0 1 .3.7V20a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9.47a1 1 0 0 1 .3-.7l.4-.4a1 1 0 0 0 .3-.71V5.34a1 1 0 0 1 1-1Z"/><path d="M7 13h10"/>',
    lamp: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.74V17h8v-2.26A7 7 0 0 0 12 2z"/>'
  };
  // [الإيموجي، الأيقونة، لون اختياري] — '' = يُحذف الإيموجي فقط
  var M = { '✅': ['check', '#118553'], '🏭': ['factory'], '🎯': ['target'], '🧠': ['sparkles'], '✨': ['sparkles'], '💎': ['gem'], '📡': ['radar'], '🔥': ['flame'], '💰': ['calc'],
    '🌱': ['sprout'], '⚠️': ['alert', '#d97706'], '⚠': ['alert', '#d97706'], '👁': ['eye'], '👀': ['eye'], '💳': ['card'], '🚫': ['ban'], '🔁': ['refresh'], '🔄': ['refresh'], '🔑': ['key'], '↩️': ['undo'], '↩': ['undo'],
    '⏳': ['hourglass'], '🎵': ['music'], '🧪': ['flask'], '📤': ['upload'], '⬆️': ['upload'], '🔎': ['search'], '🔍': ['search'], '🔔': ['bell'], '🕰️': ['clock'], '🕰': ['clock'], '⏰': ['clock'],
    '★': ['star', 'fill'], '⭐': ['star', 'fill'], '☆': ['star'], '🌍': ['globe'], '🌐': ['globe'], '🔒': ['lock'], '🔐': ['lock'], '🔓': ['unlock'], '🖼️': ['image'], '🖼': ['image'], '👋': [''], '🛡️': ['shield'], '🛡': ['shield'],
    '🎁': ['gift'], '✈️': ['send'], '✈': ['send'], '⏹️': ['stop'], '⏹': ['stop'], '🔗': ['link'], '📱': ['phone'], '💻': ['laptop'], '✉️': ['mail'], '✉': ['mail'], '🔌': ['plug'], '📎': ['clip'], '🧩': ['puzzle'],
    '📈': ['up'], '📉': ['down'], '📋': ['copy'], '📷': ['camera'], '💬': ['chat'], '🧾': ['receipt'], '✍️': ['pen'], '✍': ['pen'], '✏️': ['edit'], '✏': ['edit'], '👥': ['users'], '😣': ['pain'], '💱': ['swap'],
    '📥': ['inbox'], '🚪': ['logout'], '🗑': ['trash'], '📜': ['file'], '💪': ['zap'], '🎬': ['video'], '📊': ['chart'], '🛒': ['cart'], '💾': ['save'], '❌': ['x', '#dc2626'], '📘': ['book'], '🏆': ['trophy'],
    '❔': ['help'], '❓': ['help'], '🚀': ['zap'], '🧭': ['target'], '🟢': ['dot', '#16a34a'], '🟡': ['dot', '#eab308'], '🔵': ['dot', '#2563eb'], '🔴': ['dot', '#dc2626'], '🟠': ['dot', '#f97316'], '⚫': ['dot', '#475569'], '⚪': ['dot', '#cbd5e1'], '🔸': ['dot', '#f59e0b'], '🏠': ['home'] };
  var keys = Object.keys(M).sort(function (a, b) { return b.length - a.length; });
  var RE = new RegExp('(' + keys.map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')\\uFE0F?', 'g');
  function svg(name, color) {
    if (name === 'dot') return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" fill="' + color + '"/></svg>';
    var fill = color === 'fill' ? 'currentColor' : 'none', st = color && color !== 'fill' ? ' style="color:' + color + '"' : '';
    return '<svg viewBox="0 0 24 24" fill="' + fill + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' + st + '>' + (P[name] || '') + '</svg>';
  }
  W.ICO = function (name, color) { return '<i class="ico" aria-hidden="true">' + svg(name, color) + '</i>'; };
  var SK = '[translate=no],.notranslate,[dir=auto],.pc-ti,.pc-sub,.l-chips,.noico,script,style,textarea,select,option,code,pre,title';
  function doText(n) {
    var v = n.nodeValue; RE.lastIndex = 0; if (!v || !RE.test(v)) return; RE.lastIndex = 0;
    var p = n.parentNode; if (!p || p.nodeType !== 1 || (p.closest && p.closest(SK))) return;
    var f = D.createDocumentFragment(), last = 0, m;
    RE.lastIndex = 0;
    while ((m = RE.exec(v))) {
      if (m.index > last) f.appendChild(D.createTextNode(v.slice(last, m.index)));
      var e = M[m[1]] || M[m[1].replace(/️/g, '')];
      if (e && e[0]) { var i = D.createElement('i'); i.className = 'ico'; i.setAttribute('aria-hidden', 'true'); i.innerHTML = svg(e[0], e[1]); f.appendChild(i); }
      last = m.index + m[0].length;
    }
    if (last < v.length) f.appendChild(D.createTextNode(e && !e[0] ? v.slice(last).replace(/^\s+/, ' ') : v.slice(last)));
    p.replaceChild(f, n);
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) return doText(root);
    if (root.nodeType !== 1 || (root.closest && root.closest(SK))) return;
    var it = D.createTreeWalker(root, 4, { acceptNode: function (n) { return n.parentNode && n.parentNode.closest && n.parentNode.closest(SK) ? 2 : 1; } }), L = [], n;
    while ((n = it.nextNode())) { RE.lastIndex = 0; if (RE.test(n.nodeValue)) L.push(n); }
    RE.lastIndex = 0; L.forEach(doText);
  }
  var st = D.createElement('style');
  st.textContent = 'i.ico{display:inline-flex!important;width:1.1em!important;height:1.1em!important;min-width:0!important;vertical-align:-.18em;flex:none!important;background:none!important;border:0!important;border-radius:0!important;box-shadow:none!important;padding:0!important;margin:0!important;font-style:normal}i.ico svg{width:100%;height:100%;display:block}h1 i.ico,h2 i.ico{width:.95em!important;height:.95em!important}';
  (D.head || D.documentElement).appendChild(st);
  function start() {
    walk(D.body);
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i];
        if (m.type === 'characterData') { if (m.target.parentNode) doText(m.target); }
        else for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
      }
    }).observe(D.body, { subtree: true, childList: true, characterData: true });
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', start); else start();
})(window, document);
