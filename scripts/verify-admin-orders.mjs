// End-to-end check of order handling: the store ships and delivers a paid order, the customer
// sees tracking and history, and an unpaid order is cancelled with a reason the customer can read.
// Needs: backend on :8080 with ADMIN_EMAILS including the address below, `npm run dev` on :5173, Chrome,
// and at least one paid order (run scripts/verify-payments.mjs against the Razorpay stand-in first).
// Usage: node scripts/verify-admin-orders.mjs [screenshotDir]
import { chromium } from 'playwright-core';

const APP = 'http://localhost:5173';
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin.e2e@code76.local';
const ADMIN_PASSWORD = 'admin e2e passphrase';
const PAYER_PASSWORD = 'a long paying passphrase'; // accounts created by verify-payments.mjs
const shots = process.argv[2];

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};
const visible = async (locator, timeout = 15000) => locator.first().waitFor({ timeout }).then(() => true, () => false);

async function signIn(page, email, password, name = 'Store Owner') {
  await page.goto(`${APP}/account?mode=register`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  const outcome = await Promise.race([
    page.getByText('Hello,').first().waitFor({ timeout: 20000 }).then(() => 'created'),
    page.getByRole('button', { name: 'Sign in instead' }).waitFor({ timeout: 20000 }).then(() => 'exists'),
  ]).catch(() => 'timeout');
  if (outcome === 'exists') {
    await page.getByRole('button', { name: 'Sign in instead' }).click();
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await visible(page.getByText('Hello,'));
  }
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const admin = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
const pageErrors = [];
admin.on('pageerror', (e) => pageErrors.push(e.message));
admin.on('dialog', (d) => d.accept());
await signIn(admin, ADMIN_EMAIL, ADMIN_PASSWORD);

// 1. "To ship" lists paid orders; open one created by a test payer.
await admin.goto(`${APP}/admin/orders?status=confirmed&q=payer`, { waitUntil: 'domcontentloaded' });
check('“To ship” lists paid orders', await visible(admin.locator('a[href^="/admin/orders/C76-"]')));
await admin.locator('a[href^="/admin/orders/C76-"]').first().click();
await visible(admin.getByText('Ready to pack and ship'));
const orderNumber = admin.url().split('/admin/orders/')[1];
const customerEmail = (await admin.locator('a[href^="mailto:"]').first().textContent())?.trim();
check('order page shows the customer and the address to copy', !!customerEmail && await visible(admin.getByRole('button', { name: 'Copy address' })), customerEmail);
if (shots) await admin.screenshot({ path: `${shots}/admin-order.png` });

// 2. Ship it.
await admin.getByRole('button', { name: 'Mark as shipped' }).click();
await admin.getByLabel('Courier').fill('Delhivery');
await admin.getByLabel('Tracking number').fill('DL5550001IN');
await admin.getByLabel('Tracking link (optional)').fill('https://www.delhivery.com/track/package/DL5550001IN');
await admin.getByRole('dialog').getByRole('button', { name: 'Mark as shipped' }).click();
check('order is marked shipped', await visible(admin.getByRole('button', { name: 'Mark as delivered' })), orderNumber);
check('timeline records who shipped it', await visible(admin.getByText('Shipped with Delhivery (tracking DL5550001IN)')));

// 3. The customer sees tracking.
const customer = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
customer.on('pageerror', (e) => pageErrors.push(e.message));
await signIn(customer, customerEmail, PAYER_PASSWORD, 'Meera Iyer');
await customer.goto(`${APP}/orders/${orderNumber}`, { waitUntil: 'domcontentloaded' });
check('customer sees “On its way” with courier and tracking', await visible(customer.getByText(/On its way/)) && await visible(customer.getByText('DL5550001IN')));
check('customer gets a Track package button', await visible(customer.getByRole('button', { name: 'Track package' })));
check('customer sees the order history', await visible(customer.getByText('History')) && await visible(customer.getByText('Payment received')));
if (shots) await customer.screenshot({ path: `${shots}/customer-shipped.png` });

// 4. Delivered.
await admin.getByRole('button', { name: 'Mark as delivered' }).click();
check('order is marked delivered', await visible(admin.getByText('Delivered', { exact: true })));
await customer.reload({ waitUntil: 'domcontentloaded' });
check('customer sees Delivered', await visible(customer.getByText(/^Delivered on /)));

// 5. Cancel an unpaid order with a reason.
await customer.goto(`${APP}/product/daily-regular-tee`, { waitUntil: 'domcontentloaded' });
await customer.getByRole('radiogroup', { name: 'Size' }).getByRole('radio', { name: 'L', exact: true }).click();
await customer.getByRole('button', { name: /^Add to bag/ }).first().click();
await customer.waitForTimeout(700);
await customer.goto(`${APP}/checkout`, { waitUntil: 'domcontentloaded' });
await customer.getByLabel('Mobile number').fill('9123456780');
await customer.getByLabel('Flat, house no., street').fill('7 Marine Drive');
await customer.getByLabel('City').fill('Mumbai');
await customer.getByLabel('PIN code').fill('400020');
await customer.getByLabel('State').selectOption('Maharashtra');
await customer.getByRole('button', { name: /Place order/ }).click();
await customer.waitForURL(/\/orders\/C76-/);
const unpaid = customer.url().split('/orders/')[1];
await admin.goto(`${APP}/admin/orders/${unpaid}`, { waitUntil: 'domcontentloaded' });
await admin.getByRole('button', { name: 'Cancel order' }).click();
await admin.getByLabel('Reason (shown to the customer)').fill('Sorry, this size was damaged in our warehouse.');
await admin.getByRole('dialog').getByRole('button', { name: 'Cancel order' }).click();
check('store cancels the unpaid order', await visible(admin.getByText('Cancelled by CODE76: Sorry, this size was damaged in our warehouse.')), unpaid);
await customer.reload({ waitUntil: 'domcontentloaded' });
check('customer reads the store’s reason', await visible(customer.getByText(/We cancelled this order: Sorry, this size was damaged/)));

check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
