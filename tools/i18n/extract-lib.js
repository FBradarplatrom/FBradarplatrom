// يستخرج النصوص العربية من الكود: القطع النصية (بعد إزالة الوسوم، ${…} → {})
const fs = require('fs');
const AR = /[؀-ۿ]/;
function jsStrings(src, out) {
  let i = 0, n = src.length, prev = '';
  const add = s => { s.replace(/(?:title|placeholder|aria-label|label|alt)="([^"]*)"/g, (m, v) => { v = v.replace(/\s+/g, ' ').trim(); if (AR.test(v)) out.push(v); }); s.split(/<[^>]*>|\n/).forEach(p => { p = p.replace(/\s+/g, ' ').trim(); if (AR.test(p)) out.push(p); }); };
  function tpl() { // at char after `
    let buf = '';
    while (i < n) {
      const c = src[i];
      if (c === '\\') { buf += src[i + 1]; i += 2; continue; }
      if (c === '`') { i++; break; }
      if (c === '$' && src[i + 1] === '{') { i += 2; buf += '{}'; let depth = 1; const st = i; code(true); continue; }
      buf += c; i++;
    }
    add(buf);
  }
  function str(q) { let buf = ''; while (i < n) { const c = src[i]; if (c === '\\') { buf += src[i + 1] === 'n' ? '\n' : src[i + 1]; i += 2; continue; } if (c === q || c === '\n') { i++; break; } buf += c; i++; } add(buf); }
  function code(inExpr) {
    let depth = 0;
    while (i < n) {
      const c = src[i];
      if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2); i = i < 0 ? n : i + 2; continue; }
      if (c === '/' && /[(,=:\[!&|?{};+\-*%<>~^]$|^$|return$|typeof$/.test(prev)) { // regex literal
        i++; let cls = false; while (i < n) { const d = src[i]; if (d === '\\') { i += 2; continue; } if (d === '[') cls = true; else if (d === ']') cls = false; else if (d === '/' && !cls) { i++; break; } else if (d === '\n') break; i++; } while (/[a-z]/.test(src[i])) i++; prev = 'x'; continue; }
      if (c === "'" || c === '"') { i++; str(c); prev = 'x'; continue; }
      if (c === '`') { i++; tpl(); prev = 'x'; continue; }
      if (inExpr) { if (c === '{') depth++; if (c === '}') { if (!depth) { i++; return; } depth--; } }
      if (!/\s/.test(c)) { if (/[A-Za-z0-9_$]/.test(c)) { let w = ''; while (i < n && /[A-Za-z0-9_$.]/.test(src[i])) w += src[i++]; prev = w === 'return' || w === 'typeof' ? w : 'x'; continue; } prev = c; }
      i++;
    }
  }
  code(false);
}
function html(src, out) {
  // scripts → js; the rest: text nodes + attributes
  src = src.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/g, (m, js) => { jsStrings(js, out); return ''; }).replace(/<style[\s\S]*?<\/style>/g, '');
  src.replace(/(?:placeholder|title|aria-label|alt|content)="([^"]*)"/g, (m, v) => { if (AR.test(v)) out.push(v.trim()); });
  src.split(/<[^>]*>/).forEach(p => { p = p.replace(/\s+/g, ' ').trim(); if (AR.test(p)) out.push(p); });
}
const out = [];
for (const f of process.argv.slice(2)) { const s = fs.readFileSync(f, 'utf8'); (f.endsWith('.html') ? html : jsStrings)(s, out); }
const u = [...new Set(out)];
process.stdout.write(JSON.stringify(u, null, 0));
