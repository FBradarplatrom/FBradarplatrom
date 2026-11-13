// إضافة الجمع – TikTok (عالم الصفحة). لا ترسل أي طلب بنفسها: تقرأ فقط ردود البحث التي تستلمها صفحة TikTok
// (/api/search/...) وتستخرج منها الفيديوهات وإحصاءاتها، وتسلّمها لسكربت المحتوى عبر postMessage.
(() => {
  'use strict';
  if (window.__wprTT) return;
  window.__wprTT = true;
  const TAG = 'WPR_TT_MAIN', URL_RE = /\/api\/(search|recommend|post)\//;
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  function pick(o) {
    const st = o.stats || {}, s2 = o.statsV2 || {}, a = o.author || {}, v = o.video || {};
    return {
      id: String(o.id), desc: String(o.desc || '').slice(0, 1500), createTime: num(o.createTime),
      author: a.uniqueId || '', nickname: a.nickname || '', followers: num((o.authorStats || {}).followerCount),
      plays: num(st.playCount || s2.playCount), likes: num(st.diggCount || s2.diggCount), comments: num(st.commentCount || s2.commentCount),
      shares: num(st.shareCount || s2.shareCount), saves: num(st.collectCount || s2.collectCount),
      cover: v.cover || v.originCover || v.dynamicCover || '', duration: num(v.duration),
      tags: (o.textExtra || []).map((t) => t && t.hashtagName).filter(Boolean).slice(0, 15),
      ad: !!(o.isAd || o.is_ad), shop: !!(o.anchors && o.anchors.length) || /shop|product/i.test(JSON.stringify(o.anchors || '')),
      url: a.uniqueId ? 'https://www.tiktok.com/@' + a.uniqueId + '/video/' + o.id : 'https://www.tiktok.com/video/' + o.id
    };
  }
  function walk(root, out) {
    const stack = [root];
    while (stack.length) {
      const o = stack.pop();
      if (!o || typeof o !== 'object') continue;
      if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) stack.push(o[i]); continue; }
      if (o.id && typeof o.desc === 'string' && (o.stats || o.statsV2) && o.author) { out.push(pick(o)); continue; }
      for (const k in o) { const v = o[k]; if (v && typeof v === 'object') stack.push(v); }
    }
  }
  function handle(text) {
    if (!text || text.indexOf('"desc"') === -1) return;
    const out = []; try { walk(JSON.parse(text), out); } catch (_) { return; }
    if (out.length) try { window.postMessage({ tag: TAG, items: out }, location.origin); } catch (_) { /* ignore */ }
  }
  const of = window.fetch;
  if (typeof of === 'function') window.fetch = function (...a) {
    const p = of.apply(this, a);
    try { const u = String((a[0] && a[0].url) || a[0] || ''); if (URL_RE.test(u)) p.then((r) => r.clone().text()).then(handle).catch(() => {}); } catch (_) { /* ignore */ }
    return p;
  };
  const oo = XMLHttpRequest.prototype.open, os = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u) { this.__wprU = String(u || ''); return oo.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function () {
    if (URL_RE.test(this.__wprU || '')) this.addEventListener('load', () => { try { handle(typeof this.response === 'string' ? this.response : this.responseText); } catch (_) { /* ignore */ } });
    return os.apply(this, arguments);
  };
  // بيانات الصفحة الأولى المضمّنة
  document.addEventListener('DOMContentLoaded', () => {
    for (const id of ['__UNIVERSAL_DATA_FOR_REHYDRATION__', 'SIGI_STATE', '__NEXT_DATA__']) { const el = document.getElementById(id); if (el) handle(el.textContent); }
  });
})();
