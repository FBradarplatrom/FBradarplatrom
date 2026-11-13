'use strict';
// التحقق بخطوتين (TOTP، RFC 6238): رمز من 6 أرقام يتغيّر كل 30 ثانية في تطبيق المصادقة (Google Authenticator، Microsoft Authenticator، Authy…).
// بلا مكتبات خارجية: HMAC-SHA1 من crypto. + رموز استرجاع لمرة واحدة إن ضاع الهاتف.
const crypto = require('crypto');
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32enc(buf) { let bits = 0, v = 0, out = ''; for (const b of buf) { v = (v << 8) | b; bits += 8; while (bits >= 5) { out += B32[(v >>> (bits - 5)) & 31]; bits -= 5; } } if (bits > 0) out += B32[(v << (5 - bits)) & 31]; return out; }
function b32dec(s) { s = String(s || '').toUpperCase().replace(/[^A-Z2-7]/g, ''); let bits = 0, v = 0; const out = []; for (const c of s) { v = (v << 5) | B32.indexOf(c); bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); }
function hotp(key, counter) {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', key).update(msg).digest(), o = h[h.length - 1] & 15;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, '0');
}
const secret = () => b32enc(crypto.randomBytes(20));
// يقبل الرمز الحالي والسابق والتالي (فرق ساعة الهاتف حتى 30 ثانية)
function verify(sec, code, at) {
  code = String(code || '').replace(/\s/g, ''); if (!/^\d{6}$/.test(code) || !sec) return false;
  const key = b32dec(sec), t = Math.floor((at || Date.now()) / 30000);
  return [-1, 0, 1].some(d => crypto.timingSafeEqual(Buffer.from(hotp(key, t + d)), Buffer.from(code)));
}
const uri = (sec, label, issuer) => 'otpauth://totp/' + encodeURIComponent(issuer + ':' + label) + '?secret=' + sec + '&issuer=' + encodeURIComponent(issuer) + '&algorithm=SHA1&digits=6&period=30';
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const recovery = () => Array.from({ length: 8 }, () => crypto.randomBytes(5).toString('hex').replace(/(.{5})/, '$1-'));
module.exports = { secret, verify, uri, hotp: (sec, t) => hotp(b32dec(sec), t), recovery, sha };
