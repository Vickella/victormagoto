const { json, sameOrigin, parseJson } = require('../_lib/http');
const { parsePaynowMessage, getValue, verifyPaynowMessage, isPaynowUrl, verifyPayload, paymentConfig } = require('../_lib/paynow');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  if (!sameOrigin(req)) return json(res, 403, { error: 'Request origin was rejected.' });
  try {
    const { integrationKey, sessionSecret } = paymentConfig();
    const payload = verifyPayload(parseJson(req).token, sessionSecret);
    if (!payload || !isPaynowUrl(payload.pollUrl)) return json(res, 400, { error: 'This payment session is invalid or has expired.' });
    const response = await fetch(payload.pollUrl, { method: 'POST', headers: { Accept: 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error('Unable to confirm payment status.');
    const entries = parsePaynowMessage(await response.text());
    if (!verifyPaynowMessage(entries, integrationKey)) throw new Error('Paynow returned an invalid security signature.');
    const status = getValue(entries, 'status') || 'Pending';
    return json(res, 200, { reference: payload.reference, amount: payload.amount, status, paid: /paid|awaiting delivery|delivered/i.test(status) });
  } catch (error) {
    console.error('Paynow status error:', error.message);
    return json(res, 502, { error: error.message });
  }
};
