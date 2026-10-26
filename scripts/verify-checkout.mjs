// End-to-end check of the bag, checkout and orders, as a customer would do it.
// Needs: backend on :8080 (dev profile), `npm run dev` on :5173, and a local Chrome.
// Usage: node scripts/verify-checkout.mjs [screenshotDir]
import { chromium } from 'playwright-core';

const APP = 'http://localhost:5173';
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const shots = process.argv[2];
const email = `shopper+${Date.now()}@example.com`;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};
const visible = async (locator, timeout = 15000) => locator.first().waitFor({ timeout }).then(() => true, () => false);

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('dialog', (d) => d.accept()); // "Cancel this order?" confirmation

// 1. A guest adds a tee to the bag from the product page.
await page.goto(`${APP}/product/form-oversized-tee`, { waitUntil: 'domcontentloaded' });
await page.getByRole('radiogroup', { name: 'Size' }).getByRole('radio', { name: 'M', exact: true }).click();
await page.getByRole('button', { name: /^Add to bag/ }).first().click();
check('guest can add to the bag', await visible(page.getByRole('dialog', { name: 'Shopping bag' }).getByText('Form Oversized Tee')));

// 2. Checkout asks a guest to sign in, then comes back to checkout.
await page.getByRole('dialog', { name: 'Shopping bag' }).getByRole('link', { name: 'Checkout' }).click();
check('guests are asked to sign in before checkout', await visible(page.getByText('Sign in or create an account to check out.')));
await page.getByRole('button', { name: 'Create an account' }).click();
await page.getByLabel('Name', { exact: true }).fill('Priya Nair');
await page.getByLabel('Email', { exact: true }).fill(email);
await page.getByLabel('Password', { exact: true }).fill('a long shopping passphrase');
await page.getByRole('button', { name: 'Create account' }).click();
check('after sign-up the customer lands back on checkout', await visible(page.getByRole('form', { name: 'Checkout' })), page.url());
check('the guest bag came along into the account', await visible(page.getByRole('complementary', { name: 'Order summary' }).getByText('Form Oversized Tee')));
check('server totals include ₹99 shipping (₹2,589)', await visible(page.getByRole('button', { name: /Place order — ₹2,589/ })));
check('name is prefilled from the account', (await page.getByLabel('Full name').inputValue()) === 'Priya Nair');

// 3. Validation, then a real order.
await page.getByLabel('Mobile number').fill('12345');
await page.getByRole('button', { name: /Place order/ }).click();
check('a bad phone number is caught', await visible(page.getByText('Enter a 10-digit Indian mobile number.')));
await page.getByLabel('Mobile number').fill('+91 98765-43210');
await page.getByLabel('Flat, house no., street').fill('Flat 4B, 21 Residency Road');
await page.getByLabel('City').fill('Bengaluru');
await page.getByLabel('PIN code').fill('560025');
await page.getByLabel('State').selectOption('Karnataka');
if (shots) await page.screenshot({ path: `${shots}/checkout.png`, fullPage: false });
await page.getByRole('button', { name: /Place order/ }).click();
check('placing the order opens its page', await visible(page.getByText('Order placed. Thank you!')), page.url());
const orderNumber = page.url().split('/orders/')[1];
check('order number looks right', /^C76-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/.test(orderNumber ?? ''), orderNumber);
check('order awaits payment with a countdown', await visible(page.getByText(/left\)/)));
check('phone shown normalised', await visible(page.getByText('+91 98765 43210')));
if (shots) await page.screenshot({ path: `${shots}/order-detail.png`, fullPage: false });

// 4. The bag is now empty, and the order is listed.
await page.goto(`${APP}/cart`, { waitUntil: 'domcontentloaded' });
check('the bag is empty after ordering', await visible(page.getByText('Your bag is empty.')));
await page.goto(`${APP}/orders`, { waitUntil: 'domcontentloaded' });
check('My orders lists the new order', await visible(page.getByText(orderNumber)));
if (shots) await page.screenshot({ path: `${shots}/orders.png`, fullPage: false });

// 5. Cancel it.
await page.getByText(orderNumber).click();
await page.getByRole('button', { name: 'Cancel order' }).click();
check('cancelling marks the order cancelled', await visible(page.getByText('You cancelled this order. Nothing was charged.')));

// 6. Phone layout of checkout.
const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
await phone.goto(`${APP}/account`, { waitUntil: 'domcontentloaded' });
await phone.getByLabel('Email', { exact: true }).fill(email);
await phone.getByLabel('Password', { exact: true }).fill('a long shopping passphrase');
await phone.getByRole('button', { name: 'Sign in', exact: true }).click();
await visible(phone.getByText('Hello,'));
await phone.goto(`${APP}/product/daily-regular-tee`, { waitUntil: 'domcontentloaded' });
await phone.getByRole('radiogroup', { name: 'Size' }).getByRole('radio', { name: 'L', exact: true }).click();
await phone.getByRole('button', { name: /^Add to bag/ }).first().click();
await phone.waitForTimeout(800);
await phone.goto(`${APP}/checkout`, { waitUntil: 'domcontentloaded' });
check('phone: checkout loads with the account bag', await visible(phone.getByText('Daily Regular Tee')));
await phone.waitForTimeout(1500);
if (shots) await phone.screenshot({ path: `${shots}/checkout-phone.png`, fullPage: true });

check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
