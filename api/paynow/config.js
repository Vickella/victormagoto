const { json } = require('../_lib/http');

module.exports = function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });
  return json(res, 200, { mode: String(process.env.PAYNOW_MODE || 'test').toLowerCase() === 'live' ? 'live' : 'test' });
};
