// End-to-end check of Website content and Store settings: an admin edits the banner, ticker, home
// layout, footer and shipping settings in the admin panel, and the shop shows each change. Every
// change is put back at the end.
// Needs: backend on :8080 with ADMIN_EMAILS including the address below, `npm run dev` on :5173, Chrome.
// Usage: node scripts/verify-admin-content.mjs [screenshotDir]
import { chromium } from 'playwright-core';
import path from 'node:path';

const APP = 'http://localhost:5173';
const API = 'http://localhost:8080';
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin.e2e@code76.local';
const ADMIN_PASSWORD = 'admin e2e passphrase';
const PHOTO = path.resolve('public/images/editorial/look-light.webp');
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

/** Opens a section editor in the admin. */
async function openSection(page, key) {
  await page.goto(`${APP}/admin/content/${key}`, { waitUntil: 'domcontentloaded' });
  await visible(page.getByRole('link', { name: 'All website content' }));
}

async function saveSection(page) {
  await page.getByRole('button', { name: 'Save changes' }).first().click();
  return visible(page.getByText('Saved. The website now shows this version.'));
}

async function resetSection(page, key, label) {
  await openSection(page, key);
  await page.getByRole('button', { name: 'Reset to original' }).click();
  await page.getByRole('button', { name: `Reset “${label}”` }).click();
  return visible(page.getByText('Put back to the original content.'));
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
await signIn(page);
// The shop is checked in its own window, as a signed-out shopper would see it.
const shop = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
shop.on('pageerror', (e) => pageErrors.push(e.message));
const year = new Date().getFullYear();
let originalSettings = null;

// Remember the store's current content, so the test puts back exactly what was there (not the
// original demo content).
const TOUCHED = ['home.hero', 'site.announcements', 'home.layout', 'site.footer', 'product.sizeGuide'];
const adminFetch = (method, url, body) => page.evaluate(async ({ api, method, url, body }) => {
  const { headerName, token } = await fetch(`${api}/api/auth/csrf`, { credentials: 'include' }).then((r) => r.json());
  const res = await fetch(api + url, {
    method, credentials: 'include',
    headers: { 'Content-Type': 'application/json', [headerName]: token },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { ok: res.ok, data: res.status === 204 ? null : await res.json().catch(() => null) };
}, { api: API, method, url, body });
const before = (await adminFetch('GET', '/api/admin/content')).data.content;
const firstHeadline = before['home.hero'].slides[0].line1;
const marqueeWord = (await adminFetch('GET', '/api/admin/content')).data.content['home.marquee'].words.at(-1);
// A product that is on sale now, for the product-page checks.
const PRODUCT = await page.evaluate(async (api) => (await fetch(`${api}/api/products?pageSize=1`).then((r) => r.json())).items[0].slug, API);
let uploadedUrl = null;

try {
  // 1. The content overview lists every section, grouped.
  await page.goto(`${APP}/admin/content`, { waitUntil: 'domcontentloaded' });
  check('content overview lists sections by where they appear',
    (await visible(page.getByRole('heading', { name: 'Home page' }))) && (await visible(page.getByRole('link', { name: /Banner slideshow/ })))
    && (await visible(page.getByRole('heading', { name: 'Every page' }))) && (await visible(page.getByRole('link', { name: /Size guide/ }))));
  if (shots) await page.screenshot({ path: `${shots}/admin-content-home.png`, fullPage: true });
  if (!results.at(-1).ok) console.log((await page.locator('body').innerText()).slice(0, 600));

  // 2. Banner: new headline and a freshly uploaded photo.
  await page.getByRole('link', { name: /Banner slideshow/ }).click();
  await page.getByRole('button', { name: firstHeadline, exact: true }).click();
  await page.getByLabel('Headline, first line *').first().fill('Monsoon,');
  await page.getByRole('button', { name: 'Replace Photo for computers (landscape)' }).first().click();
  await page.getByRole('dialog').locator('input[type=file]').setInputFiles(PHOTO);
  await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
  uploadedUrl = await page.locator('img[src*="/media/"]').first().getAttribute('src').catch(() => null);
  check('uploaded photo is chosen for the slide', !!uploadedUrl, uploadedUrl ?? 'no /media/ preview');
  check('banner saves', await saveSection(page));
  if (shots) await page.screenshot({ path: `${shots}/admin-content-hero.png`, fullPage: true });

  await shop.goto(`${APP}/`, { waitUntil: 'domcontentloaded' });
  check('home banner shows the new headline', await visible(shop.locator('[data-copy="0"]').getByText('Monsoon,')));
  const srcset = await shop.locator('[data-slide="0"] source').getAttribute('srcset').catch(() => '');
  check('home banner uses the uploaded photo', !!srcset && srcset.includes('/media/'), srcset);

  // 3. Unsafe links are refused, with the field marked.
  await openSection(page, 'home.hero');
  await page.getByRole('button', { name: 'Monsoon,', exact: true }).click();
  await page.getByLabel('Button goes to *').first().fill('javascript:alert(1)');
  await page.getByRole('button', { name: 'Save changes' }).first().click();
  check('an unsafe link is refused and explained', await visible(page.getByText(/Not saved: one field needs attention/)));
  if (!results.at(-1).ok) console.log('  status:', await page.getByRole('status').first().innerText().catch(() => '(none)'));

  // 4. Leaving with unsaved changes asks first.
  await page.getByRole('link', { name: 'All website content' }).click();
  check('leaving with unsaved changes asks first', await visible(page.getByRole('dialog', { name: 'Leave without saving?' })));
  await page.getByRole('button', { name: 'Leave and lose changes' }).click();
  await visible(page.getByRole('heading', { name: 'Website content' }));

  // 5. Ticker messages.
  await openSection(page, 'site.announcements');
  await page.getByLabel('Messages').fill('Monsoon sale — 20% off\nFree returns');
  check('ticker saves', await saveSection(page));
  await shop.goto(`${APP}/shop`, { waitUntil: 'domcontentloaded' });
  const ticker = await shop.locator('header a[aria-label]').first().getAttribute('aria-label').catch(() => '');
  check('every page shows the new ticker', ticker === 'Monsoon sale — 20% off. Free returns', ticker);

  // 6. Home layout: hide the scrolling words, move "The details" above "Our approach".
  await openSection(page, 'home.layout');
  await page.getByRole('button', { name: 'Scrolling words', exact: true }).click();
  await page.getByRole('switch', { name: 'Show on the home page' }).click();
  await page.getByRole('button', { name: 'Move The details up' }).click();
  check('home layout saves', await saveSection(page));
  await shop.goto(`${APP}/`, { waitUntil: 'domcontentloaded' });
  await visible(shop.locator('#details-title'));
  const order = await shop.evaluate(() => {
    const a = document.getElementById('details-title');
    const b = document.getElementById('intro-title');
    return a && b ? !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) : null;
  });
  check('home page follows the new order', order === true);
  check('hidden home section is gone', (await shop.getByText(marqueeWord, { exact: true }).count()) === 0);

  // 7. Footer copyright with placeholders.
  await openSection(page, 'site.footer');
  await page.getByLabel('Copyright line').fill('© {year} {store}. Made in India.');
  check('footer saves', await saveSection(page));
  await shop.goto(`${APP}/about`, { waitUntil: 'domcontentloaded' });
  check('footer fills in the year and store name', await visible(shop.getByText(new RegExp(`© ${year} .+\. Made in India\.`))));

  // 8. Store settings drive the shop.
  await page.goto(`${APP}/admin/settings`, { waitUntil: 'domcontentloaded' });
  await visible(page.getByLabel('Store name *'));
  originalSettings = {
    fee: await page.getByLabel('Shipping charge').inputValue(),
    free: await page.getByLabel('Free shipping on orders from').inputValue(),
  };
  await page.getByLabel('Shipping charge').fill('49');
  await page.getByLabel('Free shipping on orders from').fill('5000');
  await page.getByRole('button', { name: 'Save settings' }).click();
  check('store settings save', await visible(page.getByText('Saved. New orders and the website use these settings straight away.')));
  if (shots) await page.screenshot({ path: `${shots}/admin-settings.png`, fullPage: true });
  await shop.goto(`${APP}/product/${PRODUCT}`, { waitUntil: 'domcontentloaded' });
  check('product page shows the new free-shipping amount', await visible(shop.getByText('Complimentary shipping on orders over ₹5,000.')));

  // 9. Size guide numbers.
  await openSection(page, 'product.sizeGuide');
  await page.getByRole('button', { name: 'M', exact: true }).first().click();
  await page.getByLabel('Chest (cm) *').first().fill('125');
  check('size guide saves', await saveSection(page));
  await shop.goto('about:blank'); // a real page load, not just a jump to #size-guide on the same page
  await shop.goto(`${APP}/product/${PRODUCT}#size-guide`, { waitUntil: 'domcontentloaded' });
  const row = shop.getByRole('dialog', { name: /Oversized fit/ }).getByRole('row', { name: /^M\b/ });
  check('size guide shows the new measurement', await visible(row.getByRole('cell', { name: '125' })));

  // 10. Newsletter: a shopper signs up on the home page, and the admin sees them.
  const subscriber = `news.e2e+${Date.now().toString(36)}@example.com`;
  await shop.goto(`${APP}/`, { waitUntil: 'domcontentloaded' });
  const form = shop.locator('#newsletter-title').locator('xpath=ancestor::section[1]');
  // The form fades in as it scrolls into view, like a shopper reaching it.
  await form.scrollIntoViewIfNeeded();
  await form.getByLabel('Email address').waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  await form.getByLabel('Email address').fill(subscriber);
  await form.getByRole('checkbox').check();
  await form.getByRole('button', { name: 'Subscribe' }).click();
  check('newsletter sign-up is confirmed', await visible(form.getByText(`We’ll write to ${subscriber}`)));
  await page.goto(`${APP}/admin/subscribers`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Find an email').fill(subscriber);
  await page.getByRole('button', { name: 'Search' }).click();
  check('admin sees the new subscriber', await visible(page.getByText(subscriber, { exact: true })));
  if (shots) await page.screenshot({ path: `${shots}/admin-subscribers.png` });
  await page.getByRole('button', { name: `Remove ${subscriber}` }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
  check('admin can remove a subscriber', await visible(page.getByText('No one matches that search')));
} catch (err) {
  check('test ran to the end', false, err.message.split(/\r?\n/)[0]);
} finally {
  // Put everything back.
  const restored = [];
  // "Reset to original" works from the admin (checked on one section)…
  restored.push(await resetSection(page, 'site.announcements', 'Ticker'));
  if (shots) await page.screenshot({ path: `${shots}/admin-content-reset.png` });
  // …then every section goes back to how the store had it before the test.
  for (const key of TOUCHED) restored.push((await adminFetch('PUT', `/api/admin/content/${key}`, before[key])).ok);
  if (originalSettings) {
    await page.goto(`${APP}/admin/settings`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Shipping charge').fill(originalSettings.fee);
    await page.getByLabel('Free shipping on orders from').fill(originalSettings.free);
    await page.getByRole('button', { name: 'Save settings' }).click();
    restored.push(await visible(page.getByText('Saved. New orders and the website use these settings straight away.')));
  }
  check('everything is put back to the original', restored.every(Boolean));
  // Remove the test photo from the library, unless something else uses it: the library keeps one copy
  // of identical files, so the same photo may already belong to a product.
  if (uploadedUrl) {
    const removed = await page.evaluate(async ({ api, url }) => {
      const { headerName, token } = await fetch(`${api}/api/auth/csrf`, { credentials: 'include' }).then((r) => r.json());
      const list = await fetch(`${api}/api/admin/media?pageSize=100`, { credentials: 'include' }).then((r) => r.json());
      const item = list.items.find((m) => url.endsWith(m.url));
      if (!item) return true; // already gone
      const usages = await fetch(`${api}/api/admin/media/${item.id}/usages`, { credentials: 'include' }).then((r) => r.json());
      if (usages.length) return true; // in use elsewhere, so it stays
      const res = await fetch(`${api}/api/admin/media/${item.id}`, { method: 'DELETE', credentials: 'include', headers: { [headerName]: token } });
      return res.ok;
    }, { api: API, url: uploadedUrl });
    check('test photo removed from the library (if unused)', removed);
  }
  await shop.goto(`${APP}/`, { waitUntil: 'domcontentloaded' });
  check('home banner is back to how it was', await visible(shop.locator('[data-copy="0"]').getByText(before['home.hero'].slides[0].line1)));
}

check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
