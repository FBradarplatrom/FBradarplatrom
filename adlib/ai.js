'use strict';
// ذكاء اصطناعي اختياري (OPENAI_API_KEY): طلب JSON قصير مع تجاوز النموذج المعطّل إلى التالي. يستعمله «ثغرات السوق» وترجمة الكلمات.
// المفاتيح من «الربط والتكامل» (قاعدة البيانات، مشفّرة) أو من متغيرات البيئة
const CFG = require('./config.js');
const ENV = (k, d) => { const m = { OPENAI_API_KEY: 'openai_key', OPENAI_MODEL: 'openai_model', OPENAI_BASE_URL: 'openai_base' }[k]; return (m && CFG.get(m)) || d; };
const enabled = () => !!ENV('OPENAI_API_KEY', '');
async function chatJSON(system, user, opts) {
  // user: نص، أو مصفوفة أجزاء [{type:'text'},{type:'image_url'}] للرؤية (صورة المنتج)
  const key = ENV('OPENAI_API_KEY', ''); if (!key) return null;
  const base = ENV('OPENAI_BASE_URL', 'https://api.openai.com/v1').replace(/\/+$/, '');
  const models = [...new Set([ENV('OPENAI_MODEL', ''), 'gpt-4.1-mini', 'gpt-4o-mini'].filter(Boolean))];
  let lastErr = '';
  for (const model of models) {
    try {
      const r = await fetch(base + '/chat/completions', {
        method: 'POST', signal: AbortSignal.timeout((opts && opts.timeout) || 25000),
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
        body: JSON.stringify({ model, response_format: { type: 'json_object' }, temperature: (opts && opts.temperature != null) ? opts.temperature : 0.2, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { lastErr = (j.error && j.error.message) || ('HTTP ' + r.status); if (r.status === 401) break; continue; }
      const txt = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      try { return { data: JSON.parse(txt), model }; } catch (e) { lastErr = 'رد غير مفهوم'; }
    } catch (e) { lastErr = e.name === 'TimeoutError' ? 'انتهت مهلة الذكاء الاصطناعي' : e.message; }
  }
  throw Object.assign(new Error('تعذّر الاتصال بالذكاء الاصطناعي: ' + lastErr), { status: 502 });
}
module.exports = { enabled, chatJSON };
