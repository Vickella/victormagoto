const { json, sameOrigin, parseJson } = require('../_lib/http');
const { safeEqual, createAdminSession, sessionCookie } = require('../_lib/auth');

const attempts = new Map();

module.exports = function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  if (!sameOrigin(req)) return json(res, 403, { error: 'Request origin was rejected.' });
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const record = attempts.get(ip) || { count: 0, reset: now + 15 * 60 * 1000 };
  if (now > record.reset) { record.count = 0; record.reset = now + 15 * 60 * 1000; }
  if (record.count >= 5) return json(res, 429, { error: 'Too many attempts. Try again later.' });
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !process.env.SESSION_SECRET) return json(res, 503, { error: 'Admin access is not configured.' });
  if (!safeEqual(parseJson(req).password || '', expected)) {
    record.count += 1;
    attempts.set(ip, record);
    return json(res, 401, { error: 'Incorrect password.' });
  }
  attempts.delete(ip);
  res.setHeader('Set-Cookie', sessionCookie(createAdminSession()));
  return json(res, 200, { ok: true });
};
