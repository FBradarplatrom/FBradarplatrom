'use strict';
// نافذة الإضافة: تعرض ما يجري (المرصود، المُرسَل، التقدّم) وتتحكم في الإرسال. لا تعرض أي عنوان أو معلومة حساسة.
const $ = (id) => document.getElementById(id);
const nf = new Intl.NumberFormat('ar-DZ');
const REASON = { done: 'اكتمل', max: 'بلغ الحد الأقصى', idle: 'لم تعد تظهر إعلانات جديدة', manual: 'أُوقف يدوياً', timeout: 'انتهت المهلة', skipped: 'تُخطّي', tab_closed: 'أُغلق تبويب فيسبوك', outbox_full: 'توقف: صفحة المنصة مغلقة منذ مدة' };
const ICON = { pending: '⏳', running: '🔄', done: '✅', skipped: '⏭️', timeout: '⚠️', stopped: '⏹️' };
let S = null, armed = false;

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const call = (cmd, extra) => new Promise((res) => { try { chrome.runtime.sendMessage(Object.assign({ cmd }, extra || {}), (r) => { void chrome.runtime.lastError; res(r || {}); }); } catch (_) { res({}); } });

function stat(n, label) { const d = el('div'); d.append(el('b', '', nf.format(n || 0)), el('span', '', label)); return d; }

function render() {
  if (!S) return;
  const conn = $('conn'); conn.textContent = S.connected ? 'متصلة بالمنصة' : 'غير متصلة'; conn.className = 'pill ' + (S.connected ? 'ok' : 'bad');
  $('ver').textContent = 'الإصدار ' + S.version;

  const box = $('status'); box.replaceChildren();
  const items = S.items || [], done = items.filter((i) => ['done', 'skipped', 'timeout', 'stopped'].includes(i.status)).length;
  const cur = items[S.idx];
  if (!items.length) {
    box.append(el('h2', '', '📡 جاهزة للجمع'), el('p', 'mut', 'ابدأ عملية الجمع من المنصة (قسم «جمع الإعلانات»). سيظهر هنا تقدّمها لحظة بلحظة.'));
  } else {
    box.append(el('h2', '', S.active ? '⏳ جارٍ الجمع' : '✅ انتهى الجمع'));
    if (S.active) {
      box.append(el('p', 'mut', 'البحث ' + nf.format(Math.min(S.idx + 1, items.length)) + ' من ' + nf.format(items.length) + (cur && cur.q ? ': «' + cur.q + '»' : '')));
    } else {
      box.append(el('p', 'mut', (REASON[S.endReason] || 'انتهى') + ' · ' + nf.format(done) + ' من ' + nf.format(items.length) + ' عمليات بحث'));
    }
    const bar = el('div', 'bar'), fill = el('i'); fill.style.width = Math.round(done / items.length * 100) + '%'; bar.append(fill); box.append(bar);
    const g = el('div', 'big');
    g.append(stat(S.active && cur ? cur.seen : items.reduce((n, i) => n + (i.seen || 0), 0), S.active ? 'في هذا البحث' : 'المرصود'), stat(S.sent, 'أُرسل'), stat(S.pending, 'بانتظار الإرسال'));
    box.append(g);
    const ul = el('ul');
    items.forEach((i) => { const li = el('li'); li.append(el('span', '', ICON[i.status] || '•'), el('span', 'q', i.q || '(الصفحة المفتوحة)'), el('small', '', i.seen ? nf.format(i.seen) : '')); ul.append(li); });
    box.append(ul);
  }

  $('m-auto').classList.toggle('on', S.sendMode === 'auto'); $('m-manual').classList.toggle('on', S.sendMode === 'manual');
  $('mode-hint').textContent = S.sendMode === 'auto' ? 'تصل الإعلانات إلى «الإعلانات الواردة» فور رصدها.' : 'تبقى الإعلانات هنا حتى تضغط «إرسال الآن». راجعها ثم أرسل.';
  const send = $('send'); send.textContent = 'إرسال الآن' + (S.pending ? ' (' + nf.format(S.pending) + ')' : ''); send.disabled = !S.pending || !S.connected;
  send.title = !S.connected && S.pending ? 'افتح المنصة أولاً' : '';
  $('discard').hidden = !S.pending; if (!armed) $('discard').textContent = 'مسح غير المرسل';

  const a = $('actions'); a.replaceChildren();
  const b = (txt, cls, fn) => { const x = el('button', 'btn ' + cls, txt); x.onclick = fn; a.append(x); };
  if (S.active) { b('تخطّي البحث الحالي', 'ghost', () => act('popup_skip')); b('إيقاف الجمع', 'danger', () => act('popup_stop')); }
  b('فتح المنصة', 'ghost', () => act('popup_open'));
}

async function refresh() { S = await call('popup_state'); render(); }
async function act(cmd, extra) { await call(cmd, extra); await refresh(); }

$('m-auto').onclick = () => act('popup_mode', { mode: 'auto' });
$('m-manual').onclick = () => act('popup_mode', { mode: 'manual' });
$('send').onclick = () => act('popup_send');
$('discard').onclick = () => {                      // نقرتان للتأكيد
  if (!armed) { armed = true; $('discard').textContent = 'تأكيد المسح؟'; setTimeout(() => { armed = false; render(); }, 3000); return; }
  armed = false; act('popup_discard');
};
chrome.storage.onChanged.addListener(refresh);
setInterval(refresh, 1200);
refresh();
