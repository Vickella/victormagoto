const crypto = require('node:crypto');

const PAYNOW_INIT_URL = 'https://www.paynow.co.zw/interface/initiatetransaction';

function generateHash(entries, integrationKey) {
  const joined = entries
    .filter(([key]) => key.toLowerCase() !== 'hash')
    .map(([, value]) => String(value ?? '').trim())
    .join('');
  return crypto.createHash('sha512').update(joined + integrationKey, 'utf8').digest('hex').toUpperCase();
}

function parsePaynowMessage(message) {
  return [...new URLSearchParams(message).entries()];
}

function getValue(entries, name) {
  return entries.find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
}

function verifyPaynowMessage(entries, integrationKey) {
  const supplied = getValue(entries, 'hash');
  if (!supplied) return false;
  const expected = generateHash(entries, integrationKey);
  const left = Buffer.from(supplied.toUpperCase());
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function isPaynowUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'paynow.co.zw' || url.hostname.endsWith('.paynow.co.zw'));
  } catch {
    return false;
  }
}

function signPayload(payload, secret) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyPayload(token, secret) {
  if (typeof token !== 'string') return null;
  const [encoded, supplied, extra] = token.split('.');
  if (!encoded || !supplied || extra) return null;
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    return Number(payload.exp) > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

function paymentConfig() {
  const integrationId = process.env.PAYNOW_INTEGRATION_ID;
  const integrationKey = process.env.PAYNOW_INTEGRATION_KEY;
  const sessionSecret = process.env.SESSION_SECRET;
  if (!integrationId || !integrationKey || !sessionSecret) throw new Error('Payment service is not configured yet. Please contact Victor.');
  return { integrationId, integrationKey, sessionSecret };
}

module.exports = { PAYNOW_INIT_URL, generateHash, parsePaynowMessage, getValue, verifyPaynowMessage, isPaynowUrl, signPayload, verifyPayload, paymentConfig };
