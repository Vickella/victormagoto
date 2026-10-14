const test = require('node:test');
const assert = require('node:assert/strict');
const { generateHash, parsePaynowMessage, verifyPaynowMessage, isPaynowUrl, signPayload, verifyPayload } = require('../api/_lib/paynow');
const createPayment = require('../api/paynow/create');
const { safeEqual, createAdminSession, isAdmin } = require('../api/_lib/auth');

function mockResponse() {
  return { statusCode: 0, headers: {}, setHeader(key,value){this.headers[key]=value}, end(value){this.body=String(value)} };
}

test('generates the official Paynow SHA-512 example hash', () => {
  const fields = [['id','1201'],['reference','TEST REF'],['amount','99.99'],['additionalinfo','A test ticket transaction'],['returnurl','http://www.google.com/search?q=returnurl'],['resulturl','http://www.google.com/search?q=resulturl'],['status','Message']];
  assert.equal(generateHash(fields, '3e9fed89-60e1-4ce5-ab6e-6b1eb2d4f977'), '2A033FC38798D913D42ECB786B9B19645ADEDBDE788862032F1BD82CF3B92DEF84F316385D5B40DBB35F1A4FD7D5BFE73835174136463CDD48C9366B0749C689');
});

test('verifies URL-decoded Paynow response values in their received order', () => {
  const raw = 'status=Ok&browserurl=https%3A%2F%2Fwww.paynow.co.zw%2FPayment%2FConfirmPayment%2F1&pollurl=https%3A%2F%2Fwww.paynow.co.zw%2FInterface%2FCheckPayment%2F%3Fguid%3D1';
  const key = 'test-key';
  const entries = parsePaynowMessage(raw);
  entries.push(['hash', generateHash(entries, key)]);
  assert.equal(verifyPaynowMessage(entries, key), true);
  entries[1][1] = 'https://evil.example/';
  assert.equal(verifyPaynowMessage(entries, key), false);
});

test('accepts only secure Paynow destinations', () => {
  assert.equal(isPaynowUrl('https://www.paynow.co.zw/Payment/1'), true);
  assert.equal(isPaynowUrl('http://www.paynow.co.zw/Payment/1'), false);
  assert.equal(isPaynowUrl('https://paynow.co.zw.evil.example/'), false);
});

test('signs, verifies and rejects tampered payment status tokens', () => {
  const secret = 'a-long-test-secret';
  const token = signPayload({ reference: 'VM-1', exp: Date.now() + 60_000 }, secret);
  assert.equal(verifyPayload(token, secret).reference, 'VM-1');
  assert.equal(verifyPayload(`${token}x`, secret), null);
});

test('payment endpoint verifies Paynow and returns only a signed checkout response', async () => {
  process.env.PAYNOW_INTEGRATION_ID = '1201';
  process.env.PAYNOW_INTEGRATION_KEY = 'integration-test-key';
  process.env.SESSION_SECRET = 'session-test-secret-at-least-32-characters';
  process.env.PUBLIC_SITE_URL = 'https://victormagoto.vercel.app';
  const originalFetch = global.fetch;
  global.fetch = async (_url, options) => {
    const sent = [...new URLSearchParams(String(options.body)).entries()];
    assert.equal(verifyPaynowMessage(sent, process.env.PAYNOW_INTEGRATION_KEY), true);
    const responseFields = [['status','Ok'],['browserurl','https://www.paynow.co.zw/Payment/ConfirmPayment/1'],['pollurl','https://www.paynow.co.zw/Interface/CheckPayment/?guid=1']];
    responseFields.push(['hash',generateHash(responseFields,process.env.PAYNOW_INTEGRATION_KEY)]);
    return { ok:true, text:async()=>new URLSearchParams(responseFields).toString() };
  };
  try {
    const req = { method:'POST', headers:{origin:'https://victormagoto.vercel.app','x-forwarded-for':'203.0.113.10'}, body:{name:'Test Payer',email:'payer@example.com',amount:'25.00',purpose:'Consultation',method:'card'} };
    const res = mockResponse();
    await createPayment(req,res);
    assert.equal(res.statusCode,200);
    const body = JSON.parse(res.body);
    assert.equal(body.redirectUrl,'https://www.paynow.co.zw/Payment/ConfirmPayment/1');
    assert.match(body.reference,/^VM-/);
    assert.equal(Boolean(body.statusToken),true);
    assert.equal(res.body.includes(process.env.PAYNOW_INTEGRATION_KEY),false);
  } finally {
    global.fetch = originalFetch;
  }
});

test('surfaces Paynow test-mode errors before checking a missing error hash', async () => {
  process.env.PAYNOW_INTEGRATION_ID = '1201';
  process.env.PAYNOW_INTEGRATION_KEY = 'integration-test-key';
  process.env.SESSION_SECRET = 'session-test-secret-at-least-32-characters';
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok:true, text:async()=>new URLSearchParams([['status','Error'],['error','The email address must match your merchant login in test mode.']]).toString() });
  try {
    const req = { method:'POST', headers:{origin:'https://victormagoto.vercel.app','x-forwarded-for':'203.0.113.11'}, body:{name:'Test Payer',email:'other@example.com',amount:'10.00',purpose:'Test',method:'card'} };
    const res = mockResponse();
    await createPayment(req,res);
    assert.equal(res.statusCode,502);
    assert.match(JSON.parse(res.body).error,/merchant login/i);
  } finally {
    global.fetch = originalFetch;
  }
});

test('starts an EcoCash payment with a phone number and no browser redirect', async () => {
  process.env.PAYNOW_INTEGRATION_ID = '1201';
  process.env.PAYNOW_INTEGRATION_KEY = 'integration-test-key';
  process.env.SESSION_SECRET = 'session-test-secret-at-least-32-characters';
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    assert.equal(url,'https://www.paynow.co.zw/interface/remotetransaction');
    const sent = [...new URLSearchParams(String(options.body)).entries()];
    assert.equal(new Map(sent).get('method'),'ecocash');
    assert.equal(new Map(sent).get('phone'),'0771111111');
    assert.equal(verifyPaynowMessage(sent,process.env.PAYNOW_INTEGRATION_KEY),true);
    const responseFields = [['status','Ok'],['instructions','Approve the EcoCash prompt.'],['pollurl','https://www.paynow.co.zw/Interface/CheckPayment/?guid=2']];
    responseFields.push(['hash',generateHash(responseFields,process.env.PAYNOW_INTEGRATION_KEY)]);
    return { ok:true, text:async()=>new URLSearchParams(responseFields).toString() };
  };
  try {
    const req = { method:'POST', headers:{origin:'https://victormagoto.vercel.app','x-forwarded-for':'203.0.113.12'}, body:{name:'Test Payer',email:'payer@example.com',amount:'10.00',purpose:'Test',method:'ecocash',phone:'0771111111'} };
    const res = mockResponse();
    await createPayment(req,res);
    assert.equal(res.statusCode,200);
    const body = JSON.parse(res.body);
    assert.equal(body.mode,'mobile');
    assert.equal(body.method,'ecocash');
    assert.equal(body.redirectUrl,undefined);
    assert.match(body.instructions,/EcoCash/i);
  } finally {
    global.fetch = originalFetch;
  }
});

test('admin sessions are signed and reject modified cookies', () => {
  process.env.SESSION_SECRET = 'session-test-secret-at-least-32-characters';
  assert.equal(safeEqual('correct','correct'),true);
  assert.equal(safeEqual('wrong','correct'),false);
  const token = createAdminSession();
  assert.equal(isAdmin({headers:{cookie:`vm_admin=${encodeURIComponent(token)}`}}),true);
  assert.equal(isAdmin({headers:{cookie:`vm_admin=${encodeURIComponent(token)}x`}}),false);
});
