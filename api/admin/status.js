const { json } = require('../_lib/http');
const { isAdmin } = require('../_lib/auth');

module.exports = function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });
  try {
    if (!isAdmin(req)) return json(res, 401, { error: 'Authentication required.' });
    const id = process.env.PAYNOW_INTEGRATION_ID || '';
    return json(res, 200, {
      configured: Boolean(id && process.env.PAYNOW_INTEGRATION_KEY && process.env.SESSION_SECRET),
      integration: id ? `••••${id.slice(-4)}` : 'Not configured',
      mode: process.env.PAYNOW_MODE === 'live' ? 'Live' : 'Test',
      methods: (process.env.PAYNOW_METHODS || 'Mobile money, Visa, Mastercard').split(',').map(value => value.trim()).filter(Boolean),
      merchantPortal: 'https://www.paynow.co.zw/'
    });
  } catch (error) {
    return json(res, 503, { error: error.message });
  }
};
