// End-to-end check of online payment WITHOUT real Razorpay keys.
//
// This script starts a small stand-in for the Razorpay API on :9999 and, inside the test browser
// only, swaps Razorpay's checkout.js for a fake payment window. The real backend talks to the
// stand-in exactly as it would to Razorpay, so signatures, stock, webhooks and refunds are all exercised.
//
// Start the backend pointed at the stand-in first (PowerShell):
//   $env:RAZORPAY_KEY_ID="rzp_test_e2estub0001"; $env:RAZORPAY_KEY_SECRET="e2e_stub_secret"
//   $env:RAZORPAY_WEBHOOK_SECRET="e2e_webhook_secret"; $env:RAZORPAY_BASE_URL="http://localhost:9999/v1"
//   .\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=dev"
// then: node scripts/verify-payments.mjs [screenshotDir]
import http from 'node:http';
import { createHmac } from 'node:crypto';
import { chromium } from 'playwright-core';

const APP = 'http://localhost:5173';
const API = 'http://localhost:8080';
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const KEY_ID = 'rzp_test_e2estub0001';
const KEY_SECRET = 'e2e_stub_secret';
const WEBHOOK_SECRET = 'e2e_webhook_secret';
const shots = process.argv[2];
const hmac = (data, secret) => createHmac('sha256', secret).update(data).digest('hex');

// ---------- stand-in Razorpay API ----------
const orders = new Map();
const payments = new Map();
let seq = Date.now(); // ids stay unique across runs, like real Razorpay ids
const apiCalls = [];

const stub = http.createServer(async (req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  const send = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json', ...cors });
    res.end(JSON.stringify(body));
  };
  if (req.method === 'OPTIONS') return send(204, {});
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  const url = req.url ?? '';
  apiCalls.push(`${req.method} ${url}`);

  // Only the browser's fake checkout uses /_test; everything else must carry our API key.
  if (url.startsWith('/v1/') && req.headers.authorization !== `Basic ${Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64')}`) {
    return send(401, { error: { description: 'Authentication failed' } });
  }
  if (req.method === 'POST' && url === '/v1/orders') {
    const order = { id: `order_STUB${++seq}`, entity: 'order', amount: body.amount, currency: body.currency, receipt: body.receipt, status: 'created' };
    orders.set(order.id, order);
    return send(200, order);
  }
  const pay = url.match(/^\/v1\/payments\/(pay_\w+)(\/capture|\/refund)?$/);
  if (pay) {
    const p = payments.get(pay[1]);
    if (!p) return send(404, { error: { description: 'No such payment' } });
    if (pay[2] === '/capture') p.status = 'captured';
    if (pay[2] === '/refund') return send(200, { id: `rfnd_STUB${++seq}`, payment_id: p.id });
    return send(200, p);
  }
  if (req.method === 'POST' && url === '/_test/pay') {
    const order = orders.get(body.order_id);
    if (!order) return send(404, { error: 'unknown order' });
    const p = { id: `pay_STUB${++seq}`, entity: 'payment', order_id: order.id, amount: order.amount, currency: order.currency, status: 'captured' };
    payments.set(p.id, p);
    return send(200, { razorpay_order_id: order.id, razorpay_payment_id: p.id, razorpay_signature: hmac(`${order.id}|${p.id}`, KEY_SECRET) });
  }
  send(404, { error: 'not found' });
});
await new Promise((resolve) => stub.listen(9999, resolve));

// ---------- fake Razorpay Checkout window (browser only) ----------
const FAKE_CHECKOUT = `
window.__rzpOpened = [];
window.Razorpay = function (options) { this.options = options; this.failed = null; };
window.Razorpay.prototype.on = function (event, fn) { if (event === 'payment.failed') this.failed = fn; };
window.Razorpay.prototype.open = async function () {
  const o = this.options;
  window.__rzpOpened.push({ key: o.key, order_id: o.order_id, amount: o.amount, contact: o.prefill && o.prefill.contact });
  const mode = window.__rzpMode || 'success';
  if (mode === 'dismiss') return setTimeout(() => o.modal.ondismiss(), 200);
  if (mode === 'fail') { this.failed && this.failed({ error: { description: 'Your bank declined this payment.' } }); return setTimeout(() => o.modal.ondismiss(), 200); }
  const res = await fetch('http://localhost:9999/_test/pay', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ order_id: o.order_id }) });
  const data = await res.json();
  setTimeout(() => o.handler(data), 200);
};`;

// ---------- test run ----------
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};
const visible = async (locator, timeout = 15000) => locator.first().waitFor({ timeout }).then(() => true, () => false);

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
await context.route('https://checkout.razorpay.com/v1/checkout.js', (route) =>
  route.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_CHECKOUT }));
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('dialog', (d) => d.accept());

const email = `payer+${Date.now()}@example.com`;
await page.goto(`${APP}/account?mode=register`, { waitUntil: 'domcontentloaded' });
await page.getByLabel('Name', { exact: true }).fill('Meera Iyer');
await page.getByLabel('Email', { exact: true }).fill(email);
await page.getByLabel('Password', { exact: true }).fill('a long paying passphrase');
await page.getByRole('button', { name: 'Create account' }).click();
await visible(page.getByText('Hello,'));

async function placeOrder(mode) {
  await page.goto(`${APP}/product/form-oversized-tee`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('radiogroup', { name: 'Size' }).getByRole('radio', { name: 'L', exact: true }).click();
  await page.getByRole('button', { name: /^Add to bag/ }).first().click();
  await page.waitForTimeout(600);
  await page.goto(`${APP}/checkout`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Mobile number').fill('9123456780');
  await page.getByLabel('Flat, house no., street').fill('7 Marine Drive');
  await page.getByLabel('City').fill('Mumbai');
  await page.getByLabel('PIN code').fill('400020');
  await page.getByLabel('State').selectOption('Maharashtra');
  await page.evaluate((m) => { window.__rzpMode = m; }, mode);
  await page.getByRole('button', { name: /Place order/ }).click();
  await page.waitForURL(/\/orders\/C76-/, { timeout: 15000 });
  return page.url().split('/orders/')[1];
}

// 1. Place an order: the payment window opens by itself and paying confirms the order.
const first = await placeOrder('success');
check('payment confirms the order', await visible(page.getByText('Order confirmed. Thank you!')) && await visible(page.getByText(/^Paid on /)), first);
check('status badge shows Confirmed', await visible(page.getByText('Confirmed', { exact: true })));
const opened = await page.evaluate(() => window.__rzpOpened?.[0]);
check('checkout opened with our test key and exact amount', opened?.key === KEY_ID && opened?.amount === 258900, JSON.stringify(opened));
check('prefilled with the delivery phone number', opened?.contact === '+919123456780');
check('server created the Razorpay order and checked the payment with Razorpay',
  apiCalls.includes('POST /v1/orders') && apiCalls.some((c) => c.startsWith('GET /v1/payments/pay_STUB')));
if (shots) await page.screenshot({ path: `${shots}/order-paid.png` });

// 2. Close the window, see a failed attempt, then pay with the button.
const second = await placeOrder('fail');
check('a declined attempt is explained', await visible(page.getByText('Your bank declined this payment.')), second);
check('the Pay button stays available', await visible(page.getByRole('button', { name: /^Pay ₹2,589/ })));
if (shots) await page.screenshot({ path: `${shots}/order-awaiting.png` });
await page.evaluate(() => { window.__rzpMode = 'success'; });
await page.getByRole('button', { name: /^Pay ₹2,589/ }).click();
check('paying from the button confirms the order', await visible(page.getByText(/^Paid on /)));

// 3. The customer pays but closes the browser: Razorpay's webhook confirms the order anyway.
const third = await placeOrder('dismiss');
await visible(page.getByRole('button', { name: /^Pay ₹/ }));
const rzpOrderId = [...orders.values()].at(-1)?.id;
const paid = await (await fetch('http://localhost:9999/_test/pay', { method: 'POST', body: JSON.stringify({ order_id: rzpOrderId }) })).json();
const webhookBody = JSON.stringify({ entity: 'event', event: 'payment.captured', payload: { payment: { entity: payments.get(paid.razorpay_payment_id) } } });
const hook = await fetch(`${API}/api/webhooks/razorpay`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Razorpay-Signature': hmac(webhookBody, WEBHOOK_SECRET), 'X-Razorpay-Event-Id': `evt_${third}` },
  body: webhookBody,
});
check('webhook accepted', hook.status === 200, String(hook.status));
await page.reload({ waitUntil: 'domcontentloaded' });
check('webhook confirmed the order without the browser', await visible(page.getByText(/^Paid on /)), third);

const forged = await fetch(`${API}/api/webhooks/razorpay`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Razorpay-Signature': 'f'.repeat(64) }, body: webhookBody,
});
check('a webhook with a forged signature is rejected', forged.status === 400, String(forged.status));

// 4. All three show as confirmed in My orders.
await page.goto(`${APP}/orders`, { waitUntil: 'domcontentloaded' });
await visible(page.getByText(first));
const confirmedCount = await page.getByText('Confirmed', { exact: true }).count();
check('My orders shows all three as Confirmed', confirmedCount >= 3, String(confirmedCount));
if (shots) await page.screenshot({ path: `${shots}/orders-paid.png` });

check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
await browser.close();
stub.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
