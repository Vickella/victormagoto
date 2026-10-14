const crypto = require('node:crypto');
const { signPayload, verifyPayload } = require('./paynow');

function sessionSecret() {
  if (!process.env.SESSION_SECRET) throw new Error('Admin access is not configured.');
  return process.env.SESSION_SECRET;
}

function safeEqual(value, expected) {
  const left = crypto.createHash('sha256').update(String(value)).digest();
  const right = crypto.createHash('sha256').update(String(expected)).digest();
  return crypto.timingSafeEqual(left, right);
}

function createAdminSession() {
  return signPayload({ sub: 'admin', exp: Date.now() + 8 * 60 * 60 * 1000 }, sessionSecret());
}

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map(part => part.trim()).filter(Boolean).map(part => {
    const index = part.indexOf('=');
    return [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
  }));
}

function isAdmin(req) {
  const payload = verifyPayload(parseCookies(req).vm_admin, sessionSecret());
  return payload?.sub === 'admin';
}

function sessionCookie(token, maxAge = 28_800) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `vm_admin=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

module.exports = { safeEqual, createAdminSession, isAdmin, sessionCookie };
