// End-to-end check of accounts: sign-up, wishlist merge and sync, session persistence, errors, sign-out.
// Needs: backend on :8080 (dev profile), `npm run dev` on :5173, and a local Chrome.
// Usage: node scripts/verify-accounts.mjs [screenshotDir]
import { chromium } from 'playwright-core';

const APP = 'http://localhost:5173';
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const shots = process.argv[2];
const email = `e2e+${Date.now()}@example.com`;
const password = 'a long test passphrase';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};
const visible = async (locator, timeout = 15000) => locator.first().waitFor({ timeout }).then(() => true, () => false);

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await context.newPage();
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(e.message));

// Guest saved a tee on this device before having an account. Planted before the app's own
// scripts run (once per tab), so the app starts with it instead of racing to overwrite it.
await context.addInitScript(() => {
  if (sessionStorage.getItem('e2e-seeded')) return;
  localStorage.setItem('c76.wishlist.v1', JSON.stringify(['daily-regular-tee']));
  sessionStorage.setItem('e2e-seeded', '1');
});

// 1. Signed-out account page shows the sign-in form.
await page.goto(`${APP}/account`, { waitUntil: 'domcontentloaded' });
check('signed-out visitors see the sign-in form', await visible(page.getByRole('form', { name: 'Sign in' })));
check('device wishlist is shown to guests', await visible(page.getByText('Saved on this device')));
if (shots) await page.screenshot({ path: `${shots}/account-signin.png` });

// 2. Client-side validation before anything is sent.
await page.getByRole('button', { name: 'Sign in', exact: true }).click();
check('empty sign-in shows field errors', await visible(page.getByText('Please enter your email address.')));

// 3. Create an account.
await page.getByRole('button', { name: 'Create an account' }).click();
await page.getByLabel('Name', { exact: true }).fill('Test Customer');
await page.getByLabel('Email', { exact: true }).fill(email);
await page.getByLabel('Password', { exact: true }).fill(password);
if (shots) await page.screenshot({ path: `${shots}/account-register.png` });
await page.getByRole('button', { name: 'Create account' }).click();
check('sign-up lands on the signed-in account page', await visible(page.getByText('Hello,')), email);
check('device wishlist was merged into the account', await visible(page.locator('[data-product-card]', { hasText: 'Daily Regular Tee' })));
check('session cookie is not readable by JavaScript', !(await page.evaluate(() => document.cookie)).includes('C76_SESSION'));
if (shots) await page.screenshot({ path: `${shots}/account-signed-in.png` });

// 4. Hearts now save to the account, and survive a reload.
await page.goto(`${APP}/shop`, { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: 'Save Form Oversized Tee to wishlist' }).click();
await page.waitForTimeout(800);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.goto(`${APP}/account`, { waitUntil: 'domcontentloaded' });
check('still signed in after reload', await visible(page.getByText('Hello,')));
check('wishlist saved to the account (2 pieces)', await visible(page.getByText('2 pieces')));

// 5. Sign out clears the account from this device.
await page.getByRole('button', { name: 'Sign out' }).click();
check('sign-out returns to the sign-in form', await visible(page.getByRole('form', { name: 'Sign in' })));
const deviceList = await page.evaluate(() => localStorage.getItem('c76.wishlist.v1'));
check('account wishlist is not left on the device', deviceList === '[]', deviceList ?? 'null');

// 6. Errors are shown clearly.
await page.getByRole('button', { name: 'Create an account' }).click();
await page.getByLabel('Name', { exact: true }).fill('Someone');
await page.getByLabel('Email', { exact: true }).fill(email);
await page.getByLabel('Password', { exact: true }).fill('another passphrase');
await page.getByRole('button', { name: 'Create account' }).click();
check('duplicate email offers to sign in instead', await visible(page.getByRole('button', { name: 'Sign in instead' })));
await page.getByRole('button', { name: 'Sign in instead' }).click();
await page.getByLabel('Email', { exact: true }).fill(email);
await page.getByLabel('Password', { exact: true }).fill('wrong password here');
await page.getByRole('button', { name: 'Sign in', exact: true }).click();
check('wrong password shows a clear message', await visible(page.getByText('Email or password is incorrect.')));

// 7. Signing back in restores the account wishlist on a "new device".
const other = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const phone = await other.newPage();
await phone.goto(`${APP}/account`, { waitUntil: 'domcontentloaded' });
await phone.getByLabel('Email', { exact: true }).fill(email);
await phone.getByLabel('Password', { exact: true }).fill(password);
await phone.getByRole('button', { name: 'Sign in', exact: true }).click();
check('signing in on another device shows the same wishlist', await visible(phone.getByText('2 pieces')));
if (shots) await phone.screenshot({ path: `${shots}/account-phone.png` });

check('no page errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
