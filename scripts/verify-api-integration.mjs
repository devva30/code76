// End-to-end check that the storefront loads its catalogue from the Java API.
// Needs: backend on :8080 (dev profile), `npm run dev` on :5173, and a local Chrome.
// Usage: node scripts/verify-api-integration.mjs [screenshotDir]
import { chromium } from 'playwright-core';

const APP = 'http://localhost:5173';
const API = 'http://localhost:8080';
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const shots = process.argv[2];

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const apiCalls = [];
const consoleErrors = [];
page.on('request', (r) => r.url().startsWith(API) && apiCalls.push(r.url().slice(API.length)));
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push(e.message));

const cards = () => page.locator('[data-product-card]');
const waitForCards = (n) => page.waitForFunction((n) => document.querySelectorAll('[data-product-card]').length === n, n, { timeout: 15000 });
const resetCalls = () => apiCalls.splice(0);

// 1. Shop listing
resetCalls();
await page.goto(`${APP}/shop`, { waitUntil: 'domcontentloaded' });
await waitForCards(6).catch(() => {});
check('shop requests /api/products', apiCalls.some((u) => u.startsWith('/api/products?')), apiCalls[0]);
check('shop renders 6 products', (await cards().count()) === 6, `${await cards().count()} cards`);
check('shop count reads 6 pieces', (await page.getByText('6 pieces').count()) > 0);
if (shots) await page.screenshot({ path: `${shots}/shop.png` });

// 2. Filters go to the API
resetCalls();
await page.goto(`${APP}/shop?fit=oversized&size=M`, { waitUntil: 'domcontentloaded' });
await waitForCards(2).catch(() => {});
const filterCall = apiCalls.find((u) => u.includes('fit=oversized'));
check('fit+size filter sent to API', !!filterCall && filterCall.includes('sizes=M'), filterCall);
check('fit filter shows 2 products', (await cards().count()) === 2, `${await cards().count()} cards`);

resetCalls();
await page.goto(`${APP}/collections/new-arrivals?sort=price-asc`, { waitUntil: 'domcontentloaded' });
await waitForCards(3).catch(() => {});
const colCall = apiCalls.find((u) => u.includes('collection=new-arrivals'));
check('collection + sort sent to API', !!colCall && colCall.includes('sort=price_asc'), colCall);
check('new arrivals shows 3 products', (await cards().count()) === 3);

resetCalls();
await page.goto(`${APP}/shop?q=nothing-matches-this`, { waitUntil: 'domcontentloaded' });
await page.getByText('Nothing quite matches.').waitFor({ timeout: 15000 }).catch(() => {});
check('empty state for no results', (await page.getByText('Nothing quite matches.').count()) > 0);

// 3. Product detail
resetCalls();
await page.goto(`${APP}/product/form-oversized-tee`, { waitUntil: 'domcontentloaded' });
await page.locator('h1', { hasText: 'Form Oversized Tee' }).waitFor({ timeout: 15000 }).catch(() => {});
check('detail requests /api/products/form-oversized-tee', apiCalls.includes('/api/products/form-oversized-tee'));
check('detail renders product name', (await page.locator('h1', { hasText: 'Form Oversized Tee' }).count()) === 1);
check('detail shows API price ₹2,490', (await page.getByText('₹2,490').count()) > 0);
const xsDisabled = await page.locator('button', { hasText: /^XS$/ }).first().evaluate((b) => b.disabled || b.getAttribute('aria-disabled') === 'true' || /line-through/.test(b.className)).catch(() => null);
check('sold-out XS (Noir) is unavailable', xsDisabled === true);
await page.waitForFunction(() => document.querySelectorAll('[data-product-card]').length === 4, null, { timeout: 15000 }).catch(() => {});
check('related products render 4', (await cards().count()) === 4);
if (shots) await page.screenshot({ path: `${shots}/product.png` });

resetCalls();
await page.goto(`${APP}/product/does-not-exist`, { waitUntil: 'domcontentloaded' });
await page.getByText('Lost').waitFor({ timeout: 15000 }).catch(() => {});
check('unknown product shows 404 page', (await page.getByText('Error 404').count()) > 0);

// 4. Home carousel
resetCalls();
await page.goto(`${APP}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.querySelectorAll('[data-product-card]').length >= 6, null, { timeout: 20000 }).catch(() => {});
check('home carousel loads from API', apiCalls.some((u) => u.includes('sort=featured')) && (await cards().count()) >= 6);

// 5. API down → error state with working retry
await page.route(`${API}/**`, (r) => r.abort('connectionrefused'));
await page.goto(`${APP}/shop`, { waitUntil: 'domcontentloaded' });
await page.getByText('Couldn’t load the collection.').waitFor({ timeout: 15000 }).catch(() => {});
check('error state when API is unreachable', (await page.getByText('Couldn’t load the collection.').count()) > 0);
if (shots) await page.screenshot({ path: `${shots}/shop-error.png` });
await page.unroute(`${API}/**`);
await page.getByRole('button', { name: 'Try again' }).click();
await waitForCards(6).catch(() => {});
check('retry recovers once API is back', (await cards().count()) === 6);

check('no console errors', consoleErrors.filter((e) => !/ERR_CONNECTION_REFUSED|Failed to load resource/.test(e)).length === 0, consoleErrors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
