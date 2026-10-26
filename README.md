# CODE76

A premium streetwear T-shirt storefront in two parts:

| Part | Where | Stack |
| --- | --- | --- |
| Frontend | repository root (`src/`) | React 18, TypeScript, Vite, Tailwind CSS, React Router, GSAP + ScrollTrigger, Framer Motion, Lenis |
| Backend | `server/` | Java 21, Spring Boot 4.0, Spring Web MVC, Spring Data JPA (Hibernate 7), PostgreSQL 17, Flyway, Bean Validation, JUnit + Mockito + Testcontainers |

The frontend stays at the root so the existing Netlify deploy keeps working unchanged. The two parts talk only over REST.

**Done so far:**
- **Phase 2:** a read-only catalogue API (products, variants, colours, images, categories, collections and inventory).
- **Phase 3:** customer accounts (sign-up, sign-in, sign-out) with the wishlist saved to the account.
- **Phase 4:** the bag saved to the account, checkout with an Indian delivery address, and order history. New orders **await payment**: their stock is held for 30 minutes, then the order expires and the stock is released.

- **Phase 5:** online payment with **Razorpay** (UPI, cards, netbanking, wallets). Paying confirms the order and turns its held stock into a sale. Payments are verified on the server (signature check plus a direct lookup with Razorpay), confirmed by webhook if the browser closes, and refunded automatically if they arrive too late to use.
- **Phase 6:** the **admin panel** at `/admin`. Products (sizes, stock, colours, photos, display order), collections and their banners, orders (ship with tracking, mark delivered, cancel with refund), every word, photo and link on the website, store settings (name, support email, shipping charges, checkout limits), an image library, newsletter subscribers and an activity log. **Nothing on the website needs a code change to edit**; only the Razorpay keys stay in `server/.env` on purpose. See [Admin panel](#admin-panel).

---

## Quick start (both apps)

Prerequisites: **Java 21**, **Docker Desktop** (for PostgreSQL and the tests) and **Node 18+**. You don't need Maven installed: the project includes the Maven Wrapper (`mvnw`).

```bash
# 1. Database (one time): create server/.env from the template and set a strong DB_PASSWORD
cd server
cp .env.example .env            # then edit DB_PASSWORD
docker compose up -d            # PostgreSQL 17 on localhost:5433

# 2. Backend with demo data: http://localhost:8080
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev      # Windows: mvnw.cmd ...

# 3. Frontend (second terminal, repo root): http://localhost:5173
npm install
npm run dev
```

`npm run dev` reads `.env.development`, which sets `VITE_API_BASE_URL=http://localhost:8080`, so the shop, product pages and home carousel load from the Java API.

---

## Backend (`server/`)

### Java setup

Install a Java 21 JDK (for example Eclipse Temurin 21) and make sure `java -version` reports 21, or set `JAVA_HOME` to it:

```bash
export JAVA_HOME=/path/to/jdk-21     # Windows PowerShell: $env:JAVA_HOME="C:\path\to\jdk-21"
```

The Maven Wrapper downloads Maven 3.9 on first use.

### PostgreSQL setup

`server/docker-compose.yml` runs PostgreSQL 17 in Docker. It maps to host port **5433**, not 5432, so it can't clash with a locally installed PostgreSQL. Data persists in the `code76-pgdata` volume.

```bash
cd server
docker compose up -d        # start
docker compose ps           # should show "healthy"
docker compose down         # stop (keeps data)
docker compose down -v      # stop and DELETE all data
```

To use an existing PostgreSQL instead, create a database and user, then point `DB_URL` at it.

### Environment configuration

Configuration comes from environment variables. For local development they're read from `server/.env`. That file is **git-ignored** and must never be committed; `server/.env.example` is the template.

| Variable | Required | Example | Notes |
| --- | --- | --- | --- |
| `DB_URL` | yes | `jdbc:postgresql://localhost:5433/code76` | Defaults to this under the `dev` profile |
| `DB_USERNAME` | yes | `code76` | Defaults to `code76` under `dev` |
| `DB_PASSWORD` | yes | *(long random string)* | Never has a default. Docker Compose refuses to start without it |
| `CORS_ALLOWED_ORIGINS` | prod | `https://code-76.netlify.app` | Comma-separated exact origins. `*` is rejected at startup |
| `PORT` | no | `8080` | HTTP port |
| `DB_POOL_SIZE` | no | `10` | `prod` profile only |
| `SESSION_COOKIE_SECURE` | no | `false` | Sends the session cookie over HTTPS only. Always `true` under `prod` |
| `RAZORPAY_KEY_ID` | for payments | `rzp_test_…` | Unset means online payment is off. **Use Test Mode keys in development**; `rzp_live_…` keys are refused outside the `prod` profile |
| `RAZORPAY_KEY_SECRET` | with key id | *(secret)* | Never share it, never commit it |
| `RAZORPAY_WEBHOOK_SECRET` | prod | *(secret)* | The secret you set on the Razorpay webhook. Without it, webhooks are refused |
| `RAZORPAY_BASE_URL` | no | `https://api.razorpay.com/v1` | Only changed for testing against a stand-in |
| `ADMIN_EMAILS` | for the admin | `you@example.com` | Comma-separated. Accounts with these emails get the admin role (on sign-up, and on every server start). Removing an email takes the role away at the next start |

Shop rules (shipping charge, free-shipping amount, quantity limits, how long an unpaid order holds stock) are **not** in config files any more: they're edited in **Admin → Store settings** and stored in the `store_settings` table. Checkout reads them from there.

Profiles:

- **`dev`**: local defaults, CORS for `http://localhost:5173`, `127.0.0.1:5173` and `localhost:4173`, and it enables `demo-data`.
- **`prod`**: no defaults for credentials or origins; everything must come from the environment. CORS allows only the origins you list. With no origins configured, cross-origin requests are blocked rather than opened up.
- **`demo-data`**: seeds the demo catalogue (see below). Never enable it in production.

### Migrations (Flyway)

The schema lives in `server/src/main/resources/db/migration/` and is applied automatically at startup. Hibernate runs with `ddl-auto: validate`, so it checks the schema but never changes it.

- `V1__catalogue_schema.sql` creates the tables `categories`, `collections`, `products`, `product_collections`, `product_colors`, `product_images`, `product_variants` and `inventory`.
- Database constraints: foreign keys; unique slugs and SKUs; one variant per product, colour and size; prices in **integer paise** (`> 0`); `compare_at_price_paise` greater than the price; non-negative stock with `reserved ≤ on_hand`; a valid size, fit, status and hex colour; and `published_at` required when a product is published.
- `V2__accounts_and_wishlist.sql` creates `users` (email stored lower-case and unique, a bcrypt `password_hash`, role `CUSTOMER` or `ADMIN`) and `wishlist_items` (deleted automatically with the user or the product).
- `V3__http_sessions.sql` creates `spring_session` and `spring_session_attributes`, where Spring Session stores signed-in sessions.
- `V4__carts_and_orders.sql` creates `cart_items`, `orders` and `order_items`. Orders copy each product's name, colour, size, image and **price at the moment of ordering**, plus the delivery address, so later catalogue changes never alter a past order. Database checks enforce `total = subtotal + shipping`, `line total = unit price × quantity`, quantities of 1–10, an Indian mobile number, a 6-digit PIN code, a known status, and a unique order number.
- Every table has `created_at` and `updated_at`, maintained by a trigger.

- `V5__payments.sql` creates `payments` (one per Razorpay order: its ids, amount, status `CREATED`/`PAID`/`REFUNDED`, refund id) and `payment_webhook_events` (each webhook event handled once), and adds `paid_at` to orders. **No card or UPI details are ever stored**; Razorpay holds them.
- `V6__admin_media_audit.sql` creates `media_assets` (uploaded images, stored in the database and served at `/media/…`) and `admin_audit_log` (every admin change: who, what, when).
- `V7__catalogue_admin.sql` allows sizes XXS–XXXL and gives collections their own label, intro and banner.
- `V8__order_fulfilment.sql` adds shipping details (courier, tracking number and link, shipped/delivered times, cancel reason) and `order_events`, the timeline shown on each order.
- `V9__site_content_and_settings.sql` creates `site_content` (one JSON document per website section) and `store_settings` (one row).
- `V10__newsletter.sql` creates `newsletter_subscribers` (one row per address, any letter case).

To change the schema, add the next numbered file (e.g. `V11__description.sql`). Never edit a migration that has already been applied.

To check migration status on the running database:

```bash
docker exec code76-postgres psql -U code76 -d code76 -c "select version, description, success from flyway_schema_history"
```

### Demo data (seeding)

With the `demo-data` profile (included in `dev`), `DemoCatalogueSeeder` loads `server/src/main/resources/demo/catalogue.json` into an **empty** database:

- 6 products, their colourways, sizes and image paths, exported from the frontend's `src/data/products.ts`.
- The image URLs are the frontend's existing `/images/products/*.webp` files; no image URLs were invented.
- 3 categories and 3 collections.
- Demo stock levels per SKU. Sizes the frontend marks as sold out get 0.

It does nothing if any product already exists. The production profile never loads this data. To reseed from scratch:

```bash
docker compose down -v && docker compose up -d   # wipes the database
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

### Running the backend

```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev     # development
./mvnw test                                               # all tests (Docker must be running)
./mvnw package && java -jar target/code76-server-0.1.0.jar --spring.profiles.active=prod
```

### Tests

`./mvnw test` runs 199 tests. The integration tests start a throwaway PostgreSQL 17 container through Testcontainers, so they need Docker but don't touch your dev database.

| Suite | Covers |
| --- | --- |
| `CatalogueApiIntegrationTest` | Health; listing; pagination; every filter (fit, size, colour, category, collection, price range, search); sorting; detail; 404s; drafts and inactive variants hidden; invalid parameters return 400; taxonomy counts; CORS allow and deny |
| `FlywayMigrationIntegrationTest` | Migration applied; all tables exist; database rejects duplicate SKUs, negative stock, over-reservation, bad prices, an unknown size or hex value, and deleting a category that still has products |
| `ProductServiceTest`, `ProductMapperTest` | Mockito unit tests: paging and sorting, filter parsing, 404 rules, DTO mapping (paise, offers, active variants only) |
| `ProductControllerWebTest`, `HealthControllerWebTest` | HTTP contract: parameter binding, validation, error body, no leaked internals, 405, health 503 when the database is down |
| `AuthIntegrationTest` | Sign-up signs you in; passwords stored only as bcrypt hashes; HttpOnly and SameSite cookie; email unique regardless of case; field validation; 72-byte password limit; sign-in issues a new session id; identical message for a wrong password or an unknown email; lockout after 5 failures; disabled accounts; sign-out kills the session (a replayed cookie fails); CSRF required; malformed JSON gives 400 |
| `WishlistIntegrationTest` | 401 when signed out; add, list and remove (newest first); idempotent add and remove; unknown product 404; merge skips unknowns and duplicates; customers only see their own list; the list survives signing out and back in |
| `LoginAttemptServiceTest` | Lockout window, reset on success, separate counts per email and address |
| `CartIntegrationTest` | 401 when signed out; prices come from the catalogue; ₹99 shipping and the free-shipping threshold; adding again raises the quantity up to 10; sold-out and low-stock sizes refused; bad input; change, remove, clear; lines flagged when stock drops or a size is withdrawn; lowering a low-stock line is allowed; sign-in merge trims to stock and skips unknowns; customers only see their own bag |
| `CheckoutIntegrationTest` | Placing an order holds stock, copies prices and empties the bag; shipping; prices sent by the browser are ignored; the same checkout submitted twice creates one order; empty bag; address validation; a bag with problems is sent back with nothing held; **two customers racing for the last unit: exactly one gets it**; order list and detail are private; past orders keep their price; cancel releases stock once; overdue orders expire and release stock |
| `OrderRulesTest` | Shipping rule, phone number clean-up, the 36 states and union territories, readable random order numbers |
| `PaymentIntegrationTest` | One Razorpay order per order for the exact total (reused on retry); a verified payment confirms the order and sells the held stock; forged signatures, wrong amounts and failed payments rejected; authorised payments captured; verifying twice is harmless; only the owner pays, and only while the order is open; the webhook confirms orders when the browser never returns; forged webhooks rejected; repeated webhooks handled once; failed attempts recorded; late payments revive the order if stock remains, otherwise refunded; payments for cancelled orders refunded. Uses a fake Razorpay, so it never touches the network |
| `PaymentRulesTest` | Signatures match an independent HMAC and break on any change; live keys refused unless allowed; key validation; secrets never printed |
| `AdminAccessIntegrationTest` | Signed-out visitors get 401 and customers 403 on admin addresses; the admin role is re-checked on each request, so taking it away works immediately; listed emails become admins |
| `MediaIntegrationTest` | Uploads checked by their actual bytes (not the file name), image sizes read from the file, identical files stored once, public serving with long caching, search and descriptions, customers can't upload, an image in use can't be deleted, every change logged |
| `AdminCatalogueIntegrationTest` | Create, edit, publish (refused until complete), archive and delete products; colours, photos, sizes and stock; display order drives the shop's Featured sort; categories and collections with banners; ordered products can only be archived |
| `AdminOrderIntegrationTest` | Find orders by number, name, email or phone and filter by status; ship with tracking, then mark delivered, and the customer sees it; cancelling releases stock, and refunds paid orders; shipped orders can't be cancelled; customers can't manage orders |
| `SiteContentIntegrationTest` | The original content passes its own rules; one public request returns everything; edits show straight away; unsafe links, outside images and over-long text refused with the exact field; reset to original; fields added later get their original value; store settings drive checkout |
| `NewsletterIntegrationTest` | Sign-up with consent, the same answer whether or not the address was already listed, one address can't flood the list, admin list, CSV download (safe against spreadsheet formulas), removal |

### API reference

All responses are JSON. Money is always `{ "amountPaise": 249000, "currency": "INR" }`. Only published products with at least one active variant are ever returned.

| Method and path | Description |
| --- | --- |
| `GET /api/health` | `{status, database, service, timestamp}`. Returns 503 if the database is unreachable |
| `GET /api/products` | Paginated listing (see parameters) |
| `GET /api/products/{slug}` | Full product detail, or 404 |
| `GET /api/categories` | Categories with visible product counts |
| `GET /api/collections` | Active collections with visible product counts |

Account endpoints. Sessions are an HttpOnly cookie, so the browser must send requests with credentials. Every `POST`, `PUT` and `DELETE` must carry the CSRF token in the `X-XSRF-TOKEN` header.

| Method and path | Description |
| --- | --- |
| `GET /api/auth/csrf` | `{headerName, token}`: the anti-forgery token to send on writes |
| `GET /api/auth/session` | `{authenticated, user}`. Signed-out visitors get `authenticated: false`, not an error |
| `POST /api/auth/register` | `{name, email, password}` → 201 with the user, already signed in. 409 `EMAIL_TAKEN` if the email exists |
| `POST /api/auth/login` | `{email, password}` → the user. 401 `INVALID_CREDENTIALS`; 429 `TOO_MANY_ATTEMPTS` after 5 failures in 15 minutes |
| `POST /api/auth/logout` | 204. Ends the session |
| `GET /api/me/wishlist` | `{items: [product summaries]}`, newest first. Requires sign-in |
| `PUT` / `DELETE /api/me/wishlist/{slug}` | Add or remove one product; returns the updated list |
| `POST /api/me/wishlist/merge` | `{slugs: [...]}` adds a signed-out visitor's saved products on sign-in |

Bag and order endpoints (sign-in required). The server prices everything itself; prices sent by the browser are ignored.

| Method and path | Description |
| --- | --- |
| `GET /api/me/cart` | The bag: lines with live prices and stock, any `issue` per line (`SOLD_OUT`, `NOT_ENOUGH_STOCK`, `UNAVAILABLE`), subtotal, shipping, total and `readyForCheckout` |
| `POST /api/me/cart/items` | `{slug, color, size, quantity}` adds to the bag. 409 `SOLD_OUT`, `NOT_ENOUGH_STOCK`, `UNAVAILABLE` or `CART_FULL` |
| `PUT /api/me/cart/items/{sku}` | `{quantity}` sets a line's quantity; `0` removes it |
| `DELETE /api/me/cart/items/{sku}` · `DELETE /api/me/cart` | Remove one line · empty the bag |
| `POST /api/me/cart/merge` | `{items: [...]}` adds a signed-out visitor's bag on sign-in, trimmed to what's in stock |
| `POST /api/me/orders` | `{address, idempotencyKey}` places an order from the bag: 201 when new, 200 when that key already placed one. 409 `CART_EMPTY` or `CART_NEEDS_ATTENTION` (problem lines listed in `errors`) |
| `GET /api/me/orders?page=&pageSize=` | The customer's orders, newest first |
| `GET /api/me/orders/{orderNumber}` | One order; anyone else's order answers 404 |
| `POST /api/me/orders/{orderNumber}/cancel` | Cancels an order awaiting payment and releases its stock. 409 `ORDER_NOT_CANCELLABLE` otherwise |

Order statuses: `pending_payment` (stock held until `expiresAt`), `confirmed` (paid; stock sold), `cancelled` and `expired` (stock released). `shipped` and `delivered` come with fulfilment.

Payment endpoints:

| Method and path | Description |
| --- | --- |
| `POST /api/me/orders/{orderNumber}/payment` | Creates (or reuses) the Razorpay order and returns what the browser needs to open Razorpay Checkout: key id, Razorpay order id, amount, prefill, seconds left. 409 `ORDER_NOT_PAYABLE` or `PAYMENT_WINDOW_CLOSED`; 503 `PAYMENTS_UNAVAILABLE` when no keys are set |
| `POST /api/me/orders/{orderNumber}/payment/verify` | `{razorpayOrderId, razorpayPaymentId, razorpaySignature}` from Checkout. The signature is checked with the key secret, then the payment is fetched from Razorpay and must match the order, amount and currency. Returns the updated order. 400 `PAYMENT_VERIFICATION_FAILED` |
| `POST /api/webhooks/razorpay` | Called by Razorpay, not browsers. Must carry a valid `X-Razorpay-Signature` (HMAC of the raw body with the webhook secret); 400 `INVALID_SIGNATURE` otherwise. Handles `payment.captured`, `order.paid` and `payment.failed`; each `X-Razorpay-Event-Id` is processed once |

When a payment is settled (by the browser or the webhook, whichever comes first):

| Order is… | Result |
| --- | --- |
| awaiting payment | **Confirmed**; held units become sold |
| expired, stock still available | **Confirmed** (stock sold again) |
| expired, stock gone · cancelled · already paid | Payment **refunded in full** automatically; the order page says so |

`GET /api/products` query parameters (all optional; list parameters can be repeated or comma-separated):

| Param | Example | Notes |
| --- | --- | --- |
| `q` | `noir oversized` | Every word must match the name, subtitle, fit label or a colour name |
| `category` | `pocket-tees` | Category slug |
| `collection` | `new-arrivals` | Collection slug |
| `fit` | `oversized`, `regular` | |
| `sizes` | `M,L` | Only matches sizes that are in stock |
| `colors` | `noir` or `Heather Grey` | Colour code or name, case-insensitive |
| `minPricePaise`, `maxPricePaise` | `200000` | Inclusive; min must be ≤ max |
| `sort` | `featured` (default), `newest`, `price_asc`, `price_desc`, `name` | |
| `page`, `pageSize` | `0`, `12` | `page` is 0-based; `pageSize` is 1–48 (default 12) |

Every error uses the same body:

```json
{ "timestamp": "…", "status": 400, "error": "VALIDATION_FAILED",
  "message": "One or more request parameters are invalid.", "path": "/api/products",
  "errors": [{ "field": "pageSize", "message": "must be at most 48" }] }
```

The error codes are:

| Code | Status | Meaning |
| --- | --- | --- |
| `VALIDATION_FAILED` | 400 | One or more fields or parameters are invalid |
| `MALFORMED_REQUEST` | 400 | The JSON body is missing or broken |
| `UNAUTHENTICATED` | 401 | Sign-in required |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `CSRF_TOKEN_INVALID` | 403 | The anti-forgery token is missing or stale |
| `FORBIDDEN` | 403 | Signed in but not allowed |
| `NOT_FOUND` | 404 | No such product or resource |
| `METHOD_NOT_ALLOWED` | 405 | The endpoint doesn't support this method |
| `EMAIL_TAKEN` | 409 | That email already has an account |
| `WISHLIST_FULL` | 409 | The wishlist already has 100 products |
| `SOLD_OUT` · `NOT_ENOUGH_STOCK` · `UNAVAILABLE` | 409 | That size can't be added in that quantity right now |
| `CART_FULL` | 409 | The bag already has 20 different items |
| `CART_EMPTY` | 409 | Nothing to check out |
| `CART_NEEDS_ATTENTION` | 409 | Stock or availability changed; `errors` lists each affected SKU |
| `ORDER_IN_PROGRESS` | 409 | The same checkout is being placed at this very moment |
| `ORDER_NOT_CANCELLABLE` | 409 | Only orders awaiting payment can be cancelled |
| `ORDER_NOT_PAYABLE` · `PAYMENT_WINDOW_CLOSED` | 409 | The order isn't awaiting payment, or under a minute is left |
| `PAYMENT_VERIFICATION_FAILED` | 400 | The payment result didn't check out with Razorpay |
| `INVALID_SIGNATURE` | 400 | A webhook wasn't signed with our webhook secret |
| `PAYMENT_PROVIDER_ERROR` | 502 | Razorpay couldn't be reached; details are logged on the server |
| `PAYMENTS_UNAVAILABLE` · `WEBHOOKS_DISABLED` | 503 | Razorpay keys or the webhook secret aren't configured |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | The body isn't sent as JSON |
| `TOO_MANY_ATTEMPTS` | 429 | Sign-in is locked for now; see `Retry-After` |
| `INTERNAL_ERROR` | 500 | Unexpected failure; details are logged on the server only |

Any path that isn't explicitly public answers 401 to signed-out visitors (deny by default).

### Code layout

```
server/src/main/java/com/code76/store/
  catalogue/api/         REST controllers (DTOs in and out only)
  catalogue/service/     Business rules: visibility, filtering, entity→DTO mapping
  catalogue/repository/  Spring Data repositories + JPA Specifications (bind parameters only)
  catalogue/domain/      JPA entities and enums
  catalogue/dto/         Request and response records, sort options
  accounts/api/          Sign-up, sign-in, sign-out, session, wishlist endpoints
  accounts/service/      Account rules (email normalising, hashing), wishlist rules
  accounts/security/     Password checking, lockout, starting and ending sessions
  accounts/domain/       UserAccount, Role, WishlistItem entities
  orders/api/            Bag and order endpoints
  orders/service/        Bag rules, checkout, cancel, expiry job, order numbers, Indian states
  orders/domain/         CartItem, CustomerOrder, OrderItem, ShippingAddress, OrderStatus
  orders/ShopProperties  Shipping fee, free-shipping threshold, limits, payment window
  payments/api/          Start and verify payment; Razorpay webhook
  payments/service/      PaymentService: verify, settle (confirm or refund), webhook handling
  payments/gateway/      Razorpay API client and HMAC signature checks
  payments/domain/       Payment, WebhookEvent
  common/error/          Error body and centralized @RestControllerAdvice
  config/                SecurityConfig (who may call what, CSRF, CORS), session cookie
  health/                /api/health
  seed/                  Demo catalogue seeder (demo-data profile only)
```

---

## Frontend

```bash
npm install
npm run dev          # http://localhost:5173 (uses the Java API via .env.development)
npm run build        # type-check + production build
npm run preview      # http://localhost:4173
```

### Catalogue source

- `src/lib/api.ts` is the single API client. It holds the base URL from `VITE_API_BASE_URL`, the typed DTOs that mirror the Java records, error parsing, and `toProduct()`, which adapts API data to the UI's existing `Product` type (paise to rupees, out-of-stock sizes to `soldOut`).
- `src/lib/catalogue.ts` provides the hooks the pages use: `useProductList` (filters, sort, search, load more), `useProductDetail` and `useFeaturedProducts`.
- **When `VITE_API_BASE_URL` is set**, the shop, collection pages, product page, related products and home carousel load from the API. They show loading skeletons, an error panel with **Try again**, and empty and 404 states. There is no silent fallback to demo data.
- **When it's unset** (e.g. the static Netlify preview), the same hooks use the bundled demo catalogue in `src/data/products.ts`, so the site works without a backend. To point a deployed frontend at a hosted API, set `VITE_API_BASE_URL` in the build environment, and add that site's origin to the backend's `CORS_ALLOWED_ORIGINS`.
- The search overlay, colour filter chips and signature product still read the bundled catalogue.

### Accounts

- `src/store/AuthContext.tsx` tracks who is signed in for the whole app. On load it asks `GET /api/auth/session` once.
- `src/components/account/AuthForm.tsx` holds the sign-in and create-account forms on `/account`. Use `/account?mode=register` to open the create-account form.
- The session is an **HttpOnly cookie** that the browser stores and sends; the frontend code never sees it. `api.ts` sends requests with `credentials: 'include'` and adds the CSRF token to every write automatically.
- **Wishlist:** guests save to the browser as before. On sign-in those items are merged into the account; while signed in every heart saves to the server; on sign-out the account's list is removed from the device.
- Without `VITE_API_BASE_URL` (the static preview), accounts are switched off and `/account` shows the device wishlist as before.
- **Bag:** works the same way. Guests keep it in the browser; on sign-in it's merged into the account (trimmed to what's in stock); while signed in every change goes to the server, and the server's answer, with live prices and any "only 2 left" warnings, is what's shown.
- **Checkout** (`/checkout`) needs sign-in; guests are sent to `/account?next=/checkout` and brought straight back. The page sends a random `idempotencyKey` once per checkout, so a double-click or a retried request never creates two orders.
- **Orders:** `/orders` lists them and `/orders/:orderNumber` shows one, with a live countdown while it awaits payment and a Cancel button.
- Open the dev site at **`http://localhost:5173`**, not `127.0.0.1`. The cookie is set for `localhost`, and the browser treats the two addresses as different sites.

End-to-end checks (both apps running, Chrome installed):

```bash
node scripts/verify-api-integration.mjs   # catalogue pages load from the API
node scripts/verify-accounts.mjs          # sign-up, wishlist merge and sync, errors, sign-out
node scripts/verify-checkout.mjs          # guest bag → sign-up → checkout → order → My orders → cancel
node scripts/verify-payments.mjs          # pay, declined attempt + retry, webhook-only payment, forged webhook
```

`verify-payments.mjs` needs no Razorpay account. It starts a stand-in for the Razorpay API on port 9999 and, inside the test browser only, swaps in a fake payment window. Start the backend pointed at the stand-in first (PowerShell):

```powershell
$env:RAZORPAY_KEY_ID="rzp_test_e2estub0001"; $env:RAZORPAY_KEY_SECRET="e2e_stub_secret"
$env:RAZORPAY_WEBHOOK_SECRET="e2e_webhook_secret"; $env:RAZORPAY_BASE_URL="http://localhost:9999/v1"
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=dev"
```

### Payments with Razorpay

1. In the Razorpay Dashboard, switch to **Test Mode**, then go to **Account & Settings → API Keys → Generate Test Key**.
2. Put the keys in `server/.env` (git-ignored), never in code or chat:
   ```
   RAZORPAY_KEY_ID=rzp_test_...
   RAZORPAY_KEY_SECRET=...
   ```
3. Restart the backend. The log says `Razorpay enabled in TEST mode`.
4. Place an order: Razorpay Checkout opens. In test mode, use UPI `success@razorpay` to succeed or `failure@razorpay` to fail, or one of Razorpay's test cards. No real money moves.

How it works:
- `src/lib/razorpay.ts` loads Razorpay's `checkout.js` only when someone pays, and opens the payment window. Its timeout is set to close before the stock hold ends.
- After checkout the window opens automatically; afterwards `/orders/:orderNumber` keeps a **Pay** button while time remains.
- Card and UPI details are typed into Razorpay's window and never reach CODE76.

**Webhooks** tell the backend about payments even if the customer's browser closes. Razorpay needs a public HTTPS address to send them, so they're set up at deploy time: Dashboard → Webhooks → URL `https://<your-api>/api/webhooks/razorpay`, events `payment.captured`, `order.paid`, `payment.failed`, and a secret that you also put in `RAZORPAY_WEBHOOK_SECRET`. Locally, payments still confirm through the browser's verify step.
```

### Routes

| Route | Page |
| --- | --- |
| `/` | Campaign homepage |
| `/shop` | All products: search, filters, sort (state kept in the URL) |
| `/collections/new-arrivals` · `/oversized` · `/regular-fit` | Collection views |
| `/product/:slug` | Product page: gallery, colour and size, size guide |
| `/about` | Brand story and placeholder policies |
| `/cart` | Full bag page |
| `/account` | Sign in or create an account; when signed in, profile and wishlist |
| `/checkout` | Delivery address and order summary (sign-in required) |
| `/orders` | Order history (sign-in required) |
| `/orders/:orderNumber` | One order: status, Pay button and countdown while awaiting payment, items, address, totals, shipping and history |
| `/admin/*` | The admin panel (admins only; loaded separately, so shoppers never download it) |

### Where things live

```
src/
  config/brand.ts        Store name, tagline, support email (live from Store settings), storage keys
  lib/api.ts             Java API client, DTO types, DTO → Product adapter
  lib/catalogue.ts       Catalogue hooks (API or bundled demo data)
  data/products.ts       Typed demo catalogue (also the seed source for the backend)
  content/types.ts       The shape of each editable website section
  store/SiteContent.tsx  Loads the admin-edited content and settings once per visit
  admin/                 The admin panel (dashboard, products, orders, content, media, settings…)
  store/AuthContext.tsx  Who is signed in; sign-in, sign-up and sign-out
  store/ShopContext.tsx  Bag and wishlist (device or account), toasts
  components/account/    Sign-in and create-account form
  components/orders/     Order status badge, dates, payment countdown
  lib/indianStates.ts    States and union territories (mirrors the server list)
  lib/motion.ts          GSAP setup, useGsap hook, media queries
  lib/SmoothScroll.tsx   Lenis (fine-pointer desktops only) synced to ScrollTrigger
  components/layout/     Header, mobile menu, search, cart drawer, footer
  components/home/       Homepage sections
  components/product/    Product card, grid, gallery, loading and error states
  components/ui/         Buttons, reveals, selectors, form controls
  pages/                 Route pages
```

### Theme

A premium white, navy and red palette, inspired by The Souled Store. Colours are CSS variables in `src/index.css` (`:root`), and Tailwind reads them through `tailwind.config.ts`.

| Token | Value | Use |
| --- | --- | --- |
| `paper` | `#FFFFFF` | Page background |
| `newsprint` | `#F5F5F6` | Alternate sections, footer |
| `ink` | `#282C3F` | Text, rules |
| `graphite` | `#626570` | Secondary text |
| `stamp` | `#D6282E` | Signature red: labels, offers, active states |
| `card` | `#FCEDE9` | Soft blush behind product photos |
| `solid` | `#282C3F` | Buttons, bag button, ticker |

### Photography

Images are free-licensed Pexels photographs. `scripts/fetch-images.py` downloads them, crops them to consistent ratios, applies a subtle warm grade and exports WebP to `public/images/`. Product images use a 4:5 ratio.

---

## Security notes

- Database credentials exist only in environment variables or the git-ignored `server/.env`. No secrets are committed.
- CORS uses an explicit origin allow-list (with credentials, needed for the session cookie). Wildcards are rejected, and production has no default origins.
- **Passwords** are hashed with bcrypt (stored as `{bcrypt}…` so the algorithm can be upgraded later). They're never logged, never returned and never stored in plain text. Passwords must be 8–72 characters, because bcrypt ignores anything past 72 bytes.
- **Sessions** use an HttpOnly, SameSite=Lax cookie (`C76_SESSION`), Secure in production, stored server-side in PostgreSQL. A new session id is issued on sign-in to block session fixation. Sign-out deletes the session, so a copied cookie stops working. Sessions end after 7 days without a visit.
- **CSRF:** every write must include a per-session token that other websites can't read.
- **Sign-in** gives the same answer for a wrong password and an unknown email, and takes the same time for both. After 5 failures for one email from one address within 15 minutes, sign-in is locked until the window passes. The counter is kept in memory, so it would need a shared store such as Redis before running several servers.
- **Deny by default:** only the catalogue, the website content (`/api/site`), `/api/auth/**`, uploaded images (`/media/**`), newsletter sign-up and the Razorpay webhook are public; everything else needs a session, and `/api/admin/**` needs the admin role.
- **Going live:** the frontend and API must be served from the same site (e.g. Netlify proxying `/api/*` to the backend), or browsers will block the session cookie. The deploy phase will set this up.
- Every query uses bind parameters. User search text is escaped before it goes into `LIKE`.
- Error responses never include stack traces, SQL or exception messages.
- **Prices are decided by the server.** Checkout recalculates every unit price, the shipping and the total from the database; anything price-like sent by the browser is ignored.
- **No overselling.** Stock is held with a single conditional `UPDATE` ("add to reserved only if enough is unreserved"), so when two customers race for the last unit, exactly one succeeds. Holds are taken in a fixed order to avoid deadlocks, and the whole checkout is one transaction: if any step fails, nothing is held or saved.
- **No duplicate orders.** Each checkout carries an idempotency key that is unique per customer in the database.
- **Private orders.** Every order lookup includes the signed-in customer's id; someone else's order number answers 404.
- Cancelling and expiry lock the order row, so stock is released exactly once.
- **Payments are never trusted from the browser.** A success needs a valid HMAC signature (key secret) *and* a direct lookup with Razorpay showing the same Razorpay order, the exact amount, INR, and an authorised or captured status. Signatures are compared in constant time.
- **Webhooks** are public but must be signed with the webhook secret over the exact raw body. They're exempt from CSRF (they come from Razorpay's servers, not a browser), deduplicated by event id, and settled under row locks, so the browser and the webhook can't both confirm or refund the same payment.
- **Live keys are refused outside production**, because they charge real money. Secrets are never logged.
- **Late or duplicate payments are refunded automatically** when the order can't be fulfilled.
- **Admin access** comes only from `ADMIN_EMAILS` on the server. The role is checked against the database on **every** admin request, so removing someone takes effect immediately. Every admin change is written to the activity log, which can't be edited from the panel.
- **Admin edits are validated on the server** against one schema: links must be a page of this site, an `https://` address or `mailto:` (so no `javascript:` links), images must come from the library or the bundled set, and text has length limits. Uploaded files are checked by their actual bytes, not their names.
- **Razorpay keys can't be changed from the admin**, so a stolen admin login can't redirect payments.
- **Register the owner's admin email yourself, first.** There is no email verification yet, so whoever creates the account for an address listed in `ADMIN_EMAILS` gets the admin role. Add email verification before going live.
- **Newsletter sign-ups** are limited to 5 per address every 15 minutes and never reveal whether an email was already on the list.

---

## Admin panel

Open `/admin` while signed in with an admin account.

**Becoming an admin (one time):**
1. In `server/.env`, set `ADMIN_EMAILS=your.real@email.com` (several are allowed, separated by commas).
2. Restart the backend.
3. On the website, create an account with exactly that email (or sign in if it exists). The account page then shows **Open admin panel**.

**What you can change, without touching code:**

| Admin page | What it controls |
| --- | --- |
| Dashboard | Orders to ship, awaiting payment, revenue in the last 7 days, low stock |
| Orders | Every order; mark shipped (courier and tracking link, shown to the customer), delivered, or cancel (paid orders are refunded through Razorpay) |
| Products | Add and edit T-shirts: name, prices, fit, details, colours, photos, which sizes are sold and stock for each; publish, archive or delete; **drag the display order** (this is the shop's "Featured" order) |
| Collections | Collection pages: title, label, intro and banner photo |
| Website content | Every section: home page order and visibility, banner slideshow, featured row, shop-by-fit, scrolling words, signature product, lookbook, our approach, details, quotes, newsletter, ticker, top menu and drop-down, phone menu, footer, search suggestions, shop page, Our story page with all policies, product page notes, size guide measurements |
| Media library | Upload images once (they're resized in the browser before upload) and reuse them anywhere; images in use can't be deleted |
| Subscribers | Newsletter sign-ups; download as CSV for an email service; remove someone who unsubscribes |
| Store settings | Store name, tagline, support email, shipping charge, free-shipping amount, quantity limits, how long an unpaid order holds stock |
| Activity | Who changed what, and when |

Text fields accept `{store}`, `{year}`, `{email}` and `{freeShipping}`, which are filled in from Store settings. Every content section has **Reset to original**. The original content lives in `server/src/main/resources/content/defaults.json`; the frontend uses the same file when no server is connected.

**Adding a new editable field** is a one-line change in `ContentSchema.java`: the server starts validating it and the admin form shows it automatically. The website component then reads it with `useContent('section.key')`.

**End-to-end checks** (both apps running, backend started with a test admin):

```bash
ADMIN_EMAILS=admin.e2e@code76.local ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev   # in server/, for the test run only
node scripts/verify-admin.mjs
node scripts/verify-admin-products.mjs
node scripts/verify-admin-orders.mjs
node scripts/verify-admin-content.mjs
```

Each script puts back what it changes. Don't add the test admin email to your real `server/.env`.
