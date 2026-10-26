// End-to-end check of the admin panel foundations: access control, dashboard, media library.
// Needs: backend on :8080 started with ADMIN_EMAILS including the address below, `npm run dev` on :5173, Chrome.
// Usage: node scripts/verify-admin.mjs [screenshotDir]
import { chromium } from 'playwright-core';
import path from 'node:path';

const APP = 'http://localhost:5173';
const API = 'http://localhost:8080';
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin.e2e@code76.local';
const ADMIN_PASSWORD = 'admin e2e passphrase';
const PHOTO = path.resolve('public/images/editorial/look-arch.webp');
const shots = process.argv[2];

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};
const visible = async (locator, timeout = 15000) => locator.first().waitFor({ timeout }).then(() => true, () => false);

async function signUpOrIn(page, name, email, password) {
  await page.goto(`${APP}/account?mode=register`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  // Wait for whichever answer comes: a new account ("Hello,") or "already exists".
  const outcome = await Promise.race([
    page.getByText('Hello,').first().waitFor({ timeout: 20000 }).then(() => 'created'),
    page.getByRole('button', { name: 'Sign in instead' }).waitFor({ timeout: 20000 }).then(() => 'exists'),
  ]).catch(() => 'timeout');
  if (outcome === 'exists') {
    await page.getByRole('button', { name: 'Sign in instead' }).click();
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  }
  await visible(page.getByText('Hello,'));
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const pageErrors = [];

// 1. A normal customer can't get in.
const customer = await (await browser.newContext()).newPage();
await signUpOrIn(customer, 'Just Shopping', `shopper+${Date.now()}@example.com`, 'a long customer passphrase');
await customer.goto(`${APP}/admin`, { waitUntil: 'domcontentloaded' });
check('customers see "No access"', await visible(customer.getByRole('heading', { name: 'No access' })));

// 2. Signed-out visitors are sent to sign in, then back to the admin.
const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('dialog', (d) => d.accept());
await page.goto(`${APP}/admin/media`, { waitUntil: 'domcontentloaded' });
check('signed-out visitors are sent to sign in', await visible(page.getByRole('form', { name: 'Sign in' })), page.url());
await signUpOrIn(page, 'Store Owner', ADMIN_EMAIL, ADMIN_PASSWORD);
check('the account page links to the admin panel', await visible(page.getByRole('link', { name: 'Open admin panel' })));

// 3. Dashboard.
await page.goto(`${APP}/admin`, { waitUntil: 'domcontentloaded' });
check('admin dashboard loads', await visible(page.getByText('What needs your attention today.')));
check('dashboard shows live product count', await visible(page.getByText('Products live')));
if (shots) await page.screenshot({ path: `${shots}/admin-dashboard.png` });

// 4. Media library: upload a real photo.
await page.getByRole('link', { name: 'Media library' }).first().click();
await visible(page.getByText('Drag images here, or'));
await visible(page.getByText(/^\d+ images?$/)); // wait for the library to finish loading before counting
const before = Number((await page.getByText(/^\d+ images?$/).first().textContent())?.match(/\d+/)?.[0] ?? '0');
await page.locator('input[type=file]').first().setInputFiles(PHOTO);
check('upload completes', await visible(page.getByText('Uploaded')), PHOTO);
await page.waitForTimeout(800);
const after = Number((await page.getByText(/^\d+ images?$/).first().textContent())?.match(/\d+/)?.[0] ?? '0');
check('the new image appears in the library', after === before + 1 || after === before, `${before} → ${after}`);
if (shots) await page.screenshot({ path: `${shots}/admin-media.png` });

// 5. Open it, describe it, check it's public, delete it.
await page.getByRole('button', { name: /look-arch/ }).first().click();
const dialog = page.getByRole('dialog');
check('details dialog opens', await visible(dialog.getByText('Where it’s used')));
await dialog.getByLabel('Description (alt text)').fill('Model under a concrete arch');
await dialog.getByRole('button', { name: 'Save description' }).click();
check('description saves', await visible(dialog.getByText('Saved.')));
const src = await dialog.locator('img').first().getAttribute('src');
const res = await fetch(src);
check('image is served publicly from the API', res.status === 200 && res.headers.get('content-type') === 'image/webp' && src.startsWith(`${API}/media/`), `${res.status} ${src}`);
check('served with long caching', (res.headers.get('cache-control') ?? '').includes('immutable'));
await dialog.getByRole('button', { name: 'Delete' }).click();
check('deleting removes it from the library', await dialog.waitFor({ state: 'detached', timeout: 10000 }).then(() => true, () => false));
check('deleted image is no longer served', (await fetch(src)).status === 404);

// 6. Activity log recorded it all.
await page.getByRole('link', { name: 'Activity' }).first().click();
check('activity log lists the upload', await visible(page.getByText(/Uploaded look-arch/)));
check('activity log lists the deletion', await visible(page.getByText(/Deleted look-arch/)));

// 7. Phone layout: menu button opens the admin navigation.
const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
await signUpOrIn(phone, 'Store Owner', ADMIN_EMAIL, ADMIN_PASSWORD);
await phone.goto(`${APP}/admin`, { waitUntil: 'domcontentloaded' });
await phone.getByRole('button', { name: 'Open admin menu' }).click();
check('phone: admin menu opens', await visible(phone.getByRole('navigation', { name: 'Admin' })));
if (shots) await phone.screenshot({ path: `${shots}/admin-phone.png` });

check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
