const crypto = require('node:crypto');
const { json, sameOrigin, parseJson } = require('../_lib/http');
const { PAYNOW_INIT_URL, generateHash, parsePaynowMessage, getValue, verifyPaynowMessage, isPaynowUrl, signPayload, paymentConfig } = require('../_lib/paynow');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const attempts = new Map();

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  if (!sameOrigin(req)) return json(res, 403, { error: 'Request origin was rejected.' });
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const record = attempts.get(ip) || { count: 0, reset: now + 15 * 60 * 1000 };
  if (now > record.reset) { record.count = 0; record.reset = now + 15 * 60 * 1000; }
  if (record.count >= 10) return json(res, 429, { error: 'Too many payment attempts. Please wait and try again.' });
  record.count += 1;
  attempts.set(ip, record);
  try {
    const { integrationId, integrationKey, sessionSecret } = paymentConfig();
    const body = parseJson(req);
    const name = String(body.name || '').trim().slice(0, 80);
    const email = String(body.email || '').trim().toLowerCase().slice(0, 120);
    const purpose = String(body.purpose || '').trim().replace(/[\r\n]+/g, ' ').slice(0, 120);
    const numericAmount = Number(body.amount);
    if (name.length < 2 || !emailPattern.test(email) || purpose.length < 2 || !Number.isFinite(numericAmount) || numericAmount < 1 || numericAmount > 10_000) {
      return json(res, 400, { error: 'Please enter valid payment details and an amount from USD 1 to USD 10,000.' });
    }
    const amount = numericAmount.toFixed(2);
    const reference = `VM-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const siteUrl = (process.env.PUBLIC_SITE_URL || 'https://victormagoto.vercel.app').replace(/\/$/, '');
    const fields = [
      ['id', integrationId],
      ['reference', reference],
      ['amount', amount],
      ['additionalinfo', purpose],
      ['returnurl', `${siteUrl}/pay?reference=${encodeURIComponent(reference)}`],
      ['resulturl', `${siteUrl}/api/paynow/result`],
      ['authemail', email],
      ['authname', name],
      ['status', 'Message']
    ];
    fields.push(['hash', generateHash(fields, integrationKey)]);
    const response = await fetch(PAYNOW_INIT_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields), signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error('Paynow is temporarily unavailable.');
    const entries = parsePaynowMessage(await response.text());
    if (!verifyPaynowMessage(entries, integrationKey)) throw new Error('Paynow returned an invalid security signature.');
    if (String(getValue(entries, 'status')).toLowerCase() !== 'ok') throw new Error(getValue(entries, 'error') || 'Paynow could not start this payment.');
    const redirectUrl = getValue(entries, 'browserurl');
    const pollUrl = getValue(entries, 'pollurl');
    if (!isPaynowUrl(redirectUrl) || !isPaynowUrl(pollUrl)) throw new Error('Paynow returned an invalid destination.');
    const statusToken = signPayload({ reference, amount, pollUrl, exp: Date.now() + 24 * 60 * 60 * 1000 }, sessionSecret);
    return json(res, 200, { redirectUrl, reference, statusToken });
  } catch (error) {
    console.error('Paynow create error:', error.message);
    return json(res, error.message.includes('not configured') ? 503 : 502, { error: error.message });
  }
};
