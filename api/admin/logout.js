const { json, sameOrigin } = require('../_lib/http');
const { sessionCookie } = require('../_lib/auth');

module.exports = function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  if (!sameOrigin(req)) return json(res, 403, { error: 'Request origin was rejected.' });
  res.setHeader('Set-Cookie', sessionCookie('', 0));
  return json(res, 200, { ok: true });
};
