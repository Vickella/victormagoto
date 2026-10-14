const { readRaw } = require('../_lib/http');
const { parsePaynowMessage, verifyPaynowMessage, paymentConfig } = require('../_lib/paynow');

async function handler(req, res) {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end('Method not allowed'); }
  try {
    const { integrationKey } = paymentConfig();
    const entries = parsePaynowMessage(await readRaw(req));
    if (!verifyPaynowMessage(entries, integrationKey)) { res.statusCode = 400; return res.end('Invalid signature'); }
    res.statusCode = 200;
    return res.end('OK');
  } catch (error) {
    console.error('Paynow callback error:', error.message);
    res.statusCode = 400;
    return res.end('Invalid request');
  }
}

handler.config = { api: { bodyParser: false } };
module.exports = handler;
