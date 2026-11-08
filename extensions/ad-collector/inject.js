// WPR Bridge – runs in the page's own JS world (document_start).
// It does NOT send any request of its own. It only reads the responses that
// Facebook's Ad Library page already receives, extracts ad objects from them,
// and hands them to the content script through window.postMessage.
(() => {
  'use strict';
  if (window.__wprHooked) return;
  window.__wprHooked = true;

  const TAG = 'WPR_AD_MAIN';
  const URL_RE = /\/api\/graphql|\/ads\/library|\/async\//;

  // Find every object that looks like an ad: { ad_archive_id, snapshot:{...} }.
  // Structure-agnostic on purpose, so it survives path changes in Meta's JSON.
  function walk(root, out) {
    const stack = [root];
    while (stack.length) {
      const o = stack.pop();
      if (!o || typeof o !== 'object') continue;
      if (Array.isArray(o)) {
        for (let i = 0; i < o.length; i++) stack.push(o[i]);
        continue;
      }
      if (o.ad_archive_id != null && o.snapshot && typeof o.snapshot === 'object') {
        out.push(o);
        continue;
      }
      for (const k in o) {
        const v = o[k];
        if (v && typeof v === 'object') stack.push(v);
      }
    }
  }

  function handleText(text) {
    if (!text || text.indexOf('ad_archive_id') === -1) return;
    const out = [];
    const clean = text.replace(/^for \(;;\);/, '');
    try {
      walk(JSON.parse(clean), out);
    } catch (_) {
      // Streamed / newline-delimited JSON: parse line by line.
      const lines = clean.split('\n');
      for (const ln of lines) {
        const t = ln.trim();
        if (!t || t.indexOf('ad_archive_id') === -1) continue;
        try { walk(JSON.parse(t), out); } catch (_) { /* ignore bad line */ }
      }
    }
    if (out.length) {
      try { window.postMessage({ tag: TAG, ads: out }, window.location.origin); } catch (_) { /* ignore */ }
    }
  }

  // fetch
  const origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function (...args) {
      const p = origFetch.apply(this, args);
      try {
        const a0 = args[0];
        const url = typeof a0 === 'string' ? a0 : (a0 && a0.url) || '';
        if (URL_RE.test(url)) {
          p.then((res) => {
            try { res.clone().text().then(handleText).catch(() => {}); } catch (_) { /* ignore */ }
          }).catch(() => {});
        }
      } catch (_) { /* never break the page */ }
      return p;
    };
  }

  // XMLHttpRequest
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__arUrl = String(url || '');
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    try {
      if (URL_RE.test(this.__arUrl || '')) {
        this.addEventListener('load', () => {
          try {
            if (this.responseType === '' || this.responseType === 'text') handleText(this.responseText);
          } catch (_) { /* ignore */ }
        });
      }
    } catch (_) { /* never break the page */ }
    return origSend.apply(this, arguments);
  };
})();
