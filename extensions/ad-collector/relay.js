// WPR Bridge – relay. يعمل فقط على دومين المنصة (يُضبط في manifest عند التنزيل).
// يجسّر بين صفحة المنصة (window.postMessage) وخدمة الخلفية (منفذ دائم). لا يحمل مفاتيح ولا يرسل شيئاً بنفسه.
(() => {
  'use strict';
  if (window.__wprRelay) return;
  window.__wprRelay = true;
  const PAGE = 'WPR_PAGE', BRIDGE = 'WPR_BRIDGE';
  let port = null, retry = 0;

  const toPage = (msg) => { try { window.postMessage(Object.assign({ tag: BRIDGE }, msg), location.origin); } catch (_) { /* ignore */ } };

  function connect() {
    try {
      port = chrome.runtime.connect({ name: 'platform' });
    } catch (_) { port = null; return; }       // سياق الإضافة أُبطل (تحديث/إعادة تحميل): تلزم F5
    port.onMessage.addListener((m) => { retry = 0; toPage(m); });
    port.onDisconnect.addListener(() => {
      port = null;
      if (!chrome.runtime || !chrome.runtime.id) { toPage({ evt: 'offline', reason: 'invalidated' }); return; }
      setTimeout(connect, Math.min(5000, 400 * ++retry));   // يوقظ الـworker من جديد
    });
  }
  connect();

  window.addEventListener('message', (e) => {
    if (e.source !== window || e.origin !== location.origin) return;
    const d = e.data;
    if (!d || d.tag !== PAGE || typeof d.cmd !== 'string') return;
    if (!port) connect();
    try { port.postMessage(d); } catch (_) { toPage({ evt: 'reply', id: d.id, ok: false, error: 'bridge_unreachable' }); }
  });
})();
