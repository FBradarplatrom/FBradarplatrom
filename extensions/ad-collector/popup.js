'use strict';
// نافذة الإضافة: تعرض ما يجري (المرصود، المُرسَل، التقدّم) وتتحكم في الإرسال. لا تعرض أي عنوان أو معلومة حساسة.
const $ = (id) => document.getElementById(id);
// اللغة: نفس لغة المنصة (تحفظها relay.js عند فتح المنصة)، وإلا لغة المتصفح. العربية هي الأصل.
let LG = (navigator.language || 'ar').slice(0, 2);
const TR = {
  'إضافة جمع الإعلانات': ['Ad Collector', 'Collecteur de pubs'], 'الإرسال إلى المنصة': ['Sending to the platform', 'Envoi vers la plateforme'],
  'تلقائي': ['Automatic', 'Automatique'], 'يدوي': ['Manual', 'Manuel'], 'إرسال الآن': ['Send now', 'Envoyer'], 'مسح غير المرسل': ['Clear unsent', 'Effacer le non-envoyé'],
  'اكتمل': ['Completed', 'Terminé'], 'بلغ الحد الأقصى': ['Reached the maximum', 'Maximum atteint'], 'لم تعد تظهر إعلانات جديدة': ['No new ads are appearing', 'Plus de nouvelles pubs'],
  'أُوقف يدوياً': ['Stopped manually', 'Arrêté manuellement'], 'انتهت المهلة': ['Timed out', 'Délai dépassé'], 'تُخطّي': ['Skipped', 'Ignoré'], 'أُغلق تبويب فيسبوك': ['The Facebook tab was closed', 'L’onglet Facebook a été fermé'],
  'توقف: صفحة المنصة مغلقة منذ مدة': ['Stopped: the platform page has been closed for a while', 'Arrêté : la page de la plateforme est fermée depuis un moment'],
  'متصلة بالمنصة': ['Connected to the platform', 'Connectée à la plateforme'], 'غير متصلة': ['Not connected', 'Non connectée'], 'الإصدار': ['Version', 'Version'],
  '📡 جاهزة للجمع': ['📡 Ready to collect', '📡 Prête à collecter'], 'ابدأ عملية الجمع من المنصة (قسم «جمع الإعلانات»). سيظهر هنا تقدّمها لحظة بلحظة.': ['Start a collection from the platform (“Collect ads” section). Its progress will show here live.', 'Lancez une collecte depuis la plateforme (section « Collecter des pubs »). Sa progression s’affichera ici en direct.'],
  '⏳ جارٍ الجمع': ['⏳ Collecting', '⏳ Collecte en cours'], '✅ انتهى الجمع': ['✅ Collection finished', '✅ Collecte terminée'], 'البحث': ['Search', 'Recherche'], 'من': ['of', 'sur'], 'انتهى': ['Finished', 'Terminé'],
  'عمليات بحث': ['searches', 'recherches'], 'في هذا البحث': ['In this search', 'Dans cette recherche'], 'المرصود': ['Observed', 'Observées'], 'أُرسل': ['Sent', 'Envoyées'], 'بانتظار الإرسال': ['Waiting to send', 'En attente'],
  '(الصفحة المفتوحة)': ['(open page)', '(page ouverte)'], 'تصل الإعلانات إلى «الإعلانات الواردة» فور رصدها.': ['Ads reach “Incoming ads” as soon as they are seen.', 'Les pubs arrivent dans « Publicités reçues » dès leur détection.'],
  'تبقى الإعلانات هنا حتى تضغط «إرسال الآن». راجعها ثم أرسل.': ['Ads stay here until you click “Send now”. Review them, then send.', 'Les pubs restent ici jusqu’à ce que vous cliquiez sur « Envoyer ». Vérifiez-les puis envoyez.'],
  'افتح المنصة أولاً': ['Open the platform first', 'Ouvrez d’abord la plateforme'], 'تخطّي البحث الحالي': ['Skip current search', 'Ignorer la recherche'], 'إيقاف الجمع': ['Stop collecting', 'Arrêter la collecte'],
  'فتح المنصة': ['Open the platform', 'Ouvrir la plateforme'], 'تأكيد المسح؟': ['Confirm clearing?', 'Confirmer ?'] };
const T = (s) => { const r = TR[s]; return LG === 'en' && r ? r[0] : LG === 'fr' && r ? r[1] : s; };
let nf = new Intl.NumberFormat('ar-DZ');
const REASON = { done: 'اكتمل', max: 'بلغ الحد الأقصى', idle: 'لم تعد تظهر إعلانات جديدة', manual: 'أُوقف يدوياً', timeout: 'انتهت المهلة', skipped: 'تُخطّي', tab_closed: 'أُغلق تبويب فيسبوك', outbox_full: 'توقف: صفحة المنصة مغلقة منذ مدة' };
function applyLang(l) {
  LG = l === 'en' || l === 'fr' ? l : 'ar'; nf = new Intl.NumberFormat({ ar: 'ar-DZ', en: 'en-GB', fr: 'fr-FR' }[LG]);
  document.documentElement.lang = LG; document.documentElement.dir = LG === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-t]').forEach((n) => { n.textContent = T(n.dataset.t); });
}
const ICON = { pending: '⏳', running: '🔄', done: '✅', skipped: '⏭️', timeout: '⚠️', stopped: '⏹️' };
let S = null, armed = false;

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const call = (cmd, extra) => new Promise((res) => { try { chrome.runtime.sendMessage(Object.assign({ cmd }, extra || {}), (r) => { void chrome.runtime.lastError; res(r || {}); }); } catch (_) { res({}); } });

function stat(n, label) { const d = el('div'); d.append(el('b', '', nf.format(n || 0)), el('span', '', label)); return d; }

function render() {
  if (!S) return;
  const conn = $('conn'); conn.textContent = T(S.connected ? 'متصلة بالمنصة' : 'غير متصلة'); conn.className = 'pill ' + (S.connected ? 'ok' : 'bad');
  $('ver').textContent = T('الإصدار') + ' ' + S.version;

  const box = $('status'); box.replaceChildren();
  const items = S.items || [], done = items.filter((i) => ['done', 'skipped', 'timeout', 'stopped'].includes(i.status)).length;
  const cur = items[S.idx];
  if (!items.length) {
    box.append(el('h2', '', T('📡 جاهزة للجمع')), el('p', 'mut', T('ابدأ عملية الجمع من المنصة (قسم «جمع الإعلانات»). سيظهر هنا تقدّمها لحظة بلحظة.')));
  } else {
    box.append(el('h2', '', T(S.active ? '⏳ جارٍ الجمع' : '✅ انتهى الجمع')));
    if (S.active) {
      box.append(el('p', 'mut', T('البحث') + ' ' + nf.format(Math.min(S.idx + 1, items.length)) + ' ' + T('من') + ' ' + nf.format(items.length) + (cur && cur.q ? ': «' + cur.q + '»' : '')));
    } else {
      box.append(el('p', 'mut', T(REASON[S.endReason] || 'انتهى') + ' · ' + nf.format(done) + ' ' + T('من') + ' ' + nf.format(items.length) + ' ' + T('عمليات بحث')));
    }
    const bar = el('div', 'bar'), fill = el('i'); fill.style.width = Math.round(done / items.length * 100) + '%'; bar.append(fill); box.append(bar);
    const g = el('div', 'big');
    g.append(stat(S.active && cur ? cur.seen : items.reduce((n, i) => n + (i.seen || 0), 0), T(S.active ? 'في هذا البحث' : 'المرصود')), stat(S.sent, T('أُرسل')), stat(S.pending, T('بانتظار الإرسال')));
    box.append(g);
    const ul = el('ul');
    items.forEach((i) => { const li = el('li'); li.append(el('span', '', ICON[i.status] || '•'), el('span', 'q', i.q || T('(الصفحة المفتوحة)')), el('small', '', i.seen ? nf.format(i.seen) : '')); ul.append(li); });
    box.append(ul);
  }

  $('m-auto').classList.toggle('on', S.sendMode === 'auto'); $('m-manual').classList.toggle('on', S.sendMode === 'manual');
  $('mode-hint').textContent = T(S.sendMode === 'auto' ? 'تصل الإعلانات إلى «الإعلانات الواردة» فور رصدها.' : 'تبقى الإعلانات هنا حتى تضغط «إرسال الآن». راجعها ثم أرسل.');
  const send = $('send'); send.textContent = T('إرسال الآن') + (S.pending ? ' (' + nf.format(S.pending) + ')' : ''); send.disabled = !S.pending || !S.connected;
  send.title = !S.connected && S.pending ? T('افتح المنصة أولاً') : '';
  $('discard').hidden = !S.pending; if (!armed) $('discard').textContent = T('مسح غير المرسل');

  const a = $('actions'); a.replaceChildren();
  const b = (txt, cls, fn) => { const x = el('button', 'btn ' + cls, txt); x.onclick = fn; a.append(x); };
  if (S.active) { b(T('تخطّي البحث الحالي'), 'ghost', () => act('popup_skip')); b(T('إيقاف الجمع'), 'danger', () => act('popup_stop')); }
  b(T('فتح المنصة'), 'ghost', () => act('popup_open'));
}

async function refresh() { S = await call('popup_state'); render(); }
async function act(cmd, extra) { await call(cmd, extra); await refresh(); }

$('m-auto').onclick = () => act('popup_mode', { mode: 'auto' });
$('m-manual').onclick = () => act('popup_mode', { mode: 'manual' });
$('send').onclick = () => act('popup_send');
$('discard').onclick = () => {                      // نقرتان للتأكيد
  if (!armed) { armed = true; $('discard').textContent = T('تأكيد المسح؟'); setTimeout(() => { armed = false; render(); }, 3000); return; }
  armed = false; act('popup_discard');
};
chrome.storage.onChanged.addListener(refresh);
setInterval(refresh, 1200);
applyLang(LG);
try { chrome.storage.local.get('uiLang', (o) => { void chrome.runtime.lastError; if (o && o.uiLang) applyLang(o.uiLang); refresh(); }); } catch (_) { refresh(); }
