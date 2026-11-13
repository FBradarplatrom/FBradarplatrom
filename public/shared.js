/* أدوات صغيرة مشتركة بين أقسام لوحة التحكم (كانت مكررة حرفياً في كل ملف). تُحمَّل قبل ملفات الأقسام. */
(function () {
  'use strict';
  const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const vlt = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0; } return false; };
  const ls = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (x) { return null; } };
  const flag = c => /^[A-Z]{2}$/.test(c || '') ? String.fromCodePoint(...[...c].map(x => 127397 + x.charCodeAt())) : '';
  window.WPRU = { e, vlt, ls, flag };
})();
