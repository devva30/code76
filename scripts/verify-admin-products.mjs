// End-to-end check of catalogue management: an admin creates a T-shirt in the admin panel,
// and it shows up everywhere in the shop. Also checks display order and collection banners.
// Needs: backend on :8080 with ADMIN_EMAILS including the address below, `npm run dev` on :5173, Chrome.
// Usage: node scripts/verify-admin-products.mjs [screenshotDir]
import { chromium } from 'playwright-core';
import path from 'node:path';

const APP = 'http://localhost:5173';
const API = 'http://localhost:8080';
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin.e2e@code76.local';
const ADMIN_PASSWORD = 'admin e2e passphrase';
const PHOTO = path.resolve('public/images/editorial/look-light.webp');
const NAME = `Monsoon Linen Tee ${Date.now().toString(36)}`;
const SLUG = NAME.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const shots = process.argv[2];

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};
const visible = async (locator, timeout = 15000) => locator.first().waitFor({ timeout }).then(() => true, () => false);

async function signIn(page) {
  await page.goto(`${APP}/account?mode=register`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Name', { exact: true }).fill('Store Owner');
  await page.getByLabel('Email', { exact: true }).fill(ADMIN_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  const outcome = await Promise.race([
    page.getByText('Hello,').first().waitFor({ timeout: 20000 }).then(() => 'created'),
    page.getByRole('button', { name: 'Sign in instead' }).waitFor({ timeout: 20000 }).then(() => 'exists'),
  ]).catch(() => 'timeout');
  if (outcome === 'exists') {
    await page.getByRole('button', { name: 'Sign in instead' }).click();
    await page.getByLabel('Email', { exact: true }).fill(ADMIN_EMAIL);
    await page.getByLabel('Password', { exact: true }).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await visible(page.getByText('Hello,'));
  }
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('dialog', (d) => d.accept());
await signIn(page);

// 1. Create a draft.
await page.goto(`${APP}/admin/products/new`, { waitUntil: 'domcontentloaded' });
await page.getByLabel('Name', { exact: true }).fill(NAME);
await page.getByLabel('Short line under the name').fill('Breathable, easy, made for rain days');
await page.getByLabel('Price', { exact: true }).fill('1999');
await page.getByLabel('“Was” price (optional)').fill('2499');
await page.getByRole('button', { name: 'New Arrivals' }).click();
await page.getByLabel('Description').fill('A light, airy tee for humid days.');
await page.getByLabel('Details').fill('Linen-cotton blend\nGarment dyed');
await page.getByRole('button', { name: 'Create draft' }).click();
check('draft is created and opens in the editor', await visible(page.getByText('Hidden from shoppers until you publish.')), page.url());
if (shots) await page.screenshot({ path: `${shots}/admin-product-new.png` });

// 2. Publishing too early explains what's missing.
await page.getByRole('button', { name: 'Publish' }).click();
check('publishing an incomplete product explains what is missing', await visible(page.getByText('Add at least one colour.')));

// 3. Colour, photo, sizes.
await page.getByLabel('New colour', { exact: true }).fill('Clay');
await page.getByRole('button', { name: 'Add colour' }).click();
check('colour added', await visible(page.getByRole('heading', { name: 'Clay' })));
await page.getByRole('button', { name: 'Add photo' }).click();
await page.getByRole('dialog').locator('input[type=file]').setInputFiles(PHOTO);
check('photo uploaded from the picker and added', await visible(page.getByText('Main')), PHOTO);
await page.getByLabel('Description for photo 1').fill('Model in the Monsoon tee in Clay');
await page.getByRole('button', { name: 'Save colour & photos' }).click();
check('colour and photos saved', await visible(page.getByText('Colour and photos saved.')));
for (const [size, stock] of [['S', '4'], ['M', '6'], ['3XL', '2']]) {
  await page.getByLabel(`Sell size ${size}`, { exact: true }).check();
  await page.getByLabel(`Stock for size ${size}`, { exact: true }).fill(stock);
}
await page.getByRole('button', { name: 'Save sizes & stock' }).click();
check('sizes and stock saved with generated SKUs', await visible(page.getByText('Sizes and stock saved.')));
if (shots) await page.screenshot({ path: `${shots}/admin-product-colour.png`, fullPage: true });

// 4. Publish.
await page.getByRole('button', { name: 'Publish' }).click();
check('product goes live', await visible(page.getByText('Shoppers can see and buy this.')));

// 5. It appears everywhere in the shop.
const shop = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
shop.on('pageerror', (e) => pageErrors.push(e.message));
await shop.goto(`${APP}/collections/new-arrivals`, { waitUntil: 'domcontentloaded' });
check('appears in its collection', await visible(shop.locator('[data-product-card]', { hasText: NAME })));
await shop.goto(`${APP}/product/${SLUG}`, { waitUntil: 'domcontentloaded' });
check('product page shows name and offer price', await visible(shop.getByRole('heading', { name: NAME })) && await visible(shop.getByText('₹1,999')));
check('3XL is shown with its friendly label', await visible(shop.getByRole('radio', { name: '3XL', exact: true })));
const imgSrc = await shop.locator('main img').first().getAttribute('src');
check('product photo is the uploaded image', imgSrc?.startsWith(`${API}/media/`), imgSrc ?? '');
await shop.getByRole('radio', { name: 'M', exact: true }).click();
await shop.getByRole('button', { name: /^Add to bag/ }).first().click();
check('a guest can add the new tee to the bag', await visible(shop.getByRole('dialog', { name: 'Shopping bag' }).getByText(NAME)));
await shop.reload({ waitUntil: 'domcontentloaded' });
await shop.goto(`${APP}/cart`, { waitUntil: 'domcontentloaded' });
check('guest bag still shows it after reload (fetched from the server)', await visible(shop.getByText(NAME)));
await shop.goto(`${APP}/shop?q=monsoon`, { waitUntil: 'domcontentloaded' });
check('shop search finds it', await visible(shop.locator('[data-product-card]', { hasText: NAME })));

// 6. Display order: move it to the top, and the shop follows.
await page.goto(`${APP}/admin/products`, { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: 'Change display order' }).click();
const ups = page.getByRole('button', { name: `Move ${NAME} up` });
await ups.waitFor();
for (let i = 0; i < 12 && (await ups.isEnabled()); i++) await ups.click();
await page.getByRole('button', { name: 'Save order' }).click();
await visible(page.getByRole('button', { name: 'Change display order' }));
await shop.goto(`${APP}/shop`, { waitUntil: 'domcontentloaded' });
await visible(shop.locator('[data-product-card]'));
const firstCard = await shop.locator('[data-product-card]').first().textContent();
check('the shop shows it first after reordering', firstCard?.includes(NAME), firstCard?.slice(0, 60));

// 7. Collections: change the intro and the shop shows it.
await page.goto(`${APP}/admin/collections`, { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: 'Edit Oversized' }).click();
const savedIntro = await page.getByRole('dialog').getByLabel('Intro paragraph').inputValue(); // put back afterwards
const intro = `Roomy cuts for slow days ${Date.now().toString(36)}.`;
await page.getByRole('dialog').getByLabel('Intro paragraph').fill(intro);
await page.getByRole('button', { name: 'Save collection' }).click();
await page.getByRole('dialog').waitFor({ state: 'detached' });
await shop.goto(`${APP}/collections/oversized`, { waitUntil: 'domcontentloaded' });
check('collection intro edited in the admin shows in the shop', await visible(shop.getByText(intro)));
if (shots) await shop.screenshot({ path: `${shots}/shop-collection-edited.png` });

// Put the original intro back.
await page.getByRole('button', { name: 'Edit Oversized' }).click();
await page.getByRole('dialog').getByLabel('Intro paragraph').fill(savedIntro);
await page.getByRole('button', { name: 'Save collection' }).click();
await page.getByRole('dialog').waitFor({ state: 'detached' });

// 8. Archiving hides it again; then delete it (it has no orders) so test products don't pile up.
await page.goto(`${APP}/admin/products`, { waitUntil: 'domcontentloaded' });
await page.getByRole('link', { name: new RegExp(NAME) }).click();
await page.getByRole('button', { name: 'Archive' }).click();
check('archiving hides it again', await visible(page.getByText('Hidden and kept for its order history.')));
await page.getByRole('button', { name: 'Delete' }).click(); // the confirm box is accepted above
// Success returns to the product list, where it must no longer appear.
const backToList = await page.waitForURL(/\/admin\/products$/, { timeout: 15000 }).then(() => true, () => false);
await visible(page.getByRole('link').filter({ hasText: /Tee/ }));
check('a product without orders can be deleted',
  backToList && (await page.getByRole('link', { name: new RegExp(NAME) }).count()) === 0, page.url());

check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
