const crypto = require('node:crypto');
const { json, sameOrigin, parseJson } = require('../_lib/http');
const { PAYNOW_INIT_URL, PAYNOW_MOBILE_URL, generateHash, parsePaynowMessage, getValue, verifyPaynowMessage, isPaynowUrl, signPayload, paymentConfig } = require('../_lib/paynow');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const attempts = new Map();

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  if (!sameOrigin(req)) return json(res, 403, { error: 'Request origin was rejected.' });
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const record = attempts.get(ip) || { count: 0, reset: now + 15 * 60 * 1000 };
  if (now > record.reset) { record.count = 0; record.reset = now + 15 * 60 * 1000; }
  if (record.count >= 30) return json(res, 429, { error: 'Too many payment attempts. Please wait and try again.' });
  record.count += 1;
  attempts.set(ip, record);
  try {
    const { integrationId, integrationKey, sessionSecret } = paymentConfig();
    const body = parseJson(req);
    const name = String(body.name || '').trim().slice(0, 80);
    const email = String(body.email || '').trim().toLowerCase().slice(0, 120);
    const purpose = String(body.purpose || '').trim().replace(/[\r\n]+/g, ' ').slice(0, 120);
    const method = String(body.method || '').trim().toLowerCase();
    const phone = String(body.phone || '').trim().replace(/[\s-]+/g, '');
    const isMobile = method === 'ecocash' || method === 'onemoney';
    const numericAmount = Number(body.amount);
    if (name.length < 2 || !emailPattern.test(email) || purpose.length < 2 || !['card', 'ecocash', 'onemoney'].includes(method) || !Number.isFinite(numericAmount) || numericAmount < 1 || numericAmount > 10_000) {
      return json(res, 400, { error: 'Please enter valid payment details, select a payment method and enter an amount from 1 to 10,000.' });
    }
    if (isMobile && !/^(?:\+263|0)7\d{8}$/.test(phone)) return json(res, 400, { error: 'Enter a valid Zimbabwe mobile number, for example 0771234567.' });
    const amount = numericAmount.toFixed(2);
    const reference = `VM-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const siteUrl = (process.env.PUBLIC_SITE_URL || 'https://victormagoto.vercel.app').replace(/\/$/, '');
    const returnUrl = `${siteUrl}/pay?reference=${encodeURIComponent(reference)}`;
    const resultUrl = `${siteUrl}/api/paynow/result`;
    const fields = isMobile
      ? [['resulturl', resultUrl], ['returnurl', returnUrl], ['reference', reference], ['amount', amount], ['id', integrationId], ['additionalinfo', purpose], ['authemail', email], ['phone', phone], ['method', method], ['status', 'Message']]
      : [['id', integrationId], ['reference', reference], ['amount', amount], ['additionalinfo', purpose], ['returnurl', returnUrl], ['resulturl', resultUrl], ['authemail', email], ['authname', name], ['status', 'Message']];
    fields.push(['hash', generateHash(fields, integrationKey)]);
    const response = await fetch(isMobile ? PAYNOW_MOBILE_URL : PAYNOW_INIT_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields), signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error('Paynow is temporarily unavailable.');
    const entries = parsePaynowMessage(await response.text());
    if (String(getValue(entries, 'status')).toLowerCase() !== 'ok') throw new Error(getValue(entries, 'error') || 'Paynow could not start this payment.');
    if (!verifyPaynowMessage(entries, integrationKey)) throw new Error('Paynow returned an invalid security signature.');
    const redirectUrl = getValue(entries, 'browserurl');
    const pollUrl = getValue(entries, 'pollurl');
    if (!isPaynowUrl(pollUrl) || (!isMobile && !isPaynowUrl(redirectUrl))) throw new Error('Paynow returned an invalid destination.');
    const statusToken = signPayload({ reference, amount, pollUrl, exp: Date.now() + 24 * 60 * 60 * 1000 }, sessionSecret);
    if (isMobile) return json(res, 200, { mode: 'mobile', method, instructions: getValue(entries, 'instructions') || `Approve the ${method === 'ecocash' ? 'EcoCash' : 'OneMoney'} prompt on your phone.`, reference, statusToken });
    return json(res, 200, { mode: 'card', redirectUrl, reference, statusToken });
  } catch (error) {
    console.error('Paynow create error:', error.message);
    return json(res, error.message.includes('not configured') ? 503 : 502, { error: error.message });
  }
};
