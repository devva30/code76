/**
 * Centralised client for the CODE76 Java API (server/). Every request goes
 * through `request`, so base URL, error parsing and cancellation live in one place.
 * Money arrives in integer paise and is converted to rupees only in `toProduct`.
 */
import type { Colorway, Fit, Product, Size } from '@/data/products';

/** Configured base URL without a trailing slash, or null when the API is not configured. */
export const API_BASE_URL: string | null = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '') || null;

// ---- DTOs (mirror server/src/main/java/com/code76/store/catalogue/dto/CatalogueDtos.java) ----

export interface MoneyDto {
  amountPaise: number;
  currency: 'INR';
}

export interface SizeOptionDto {
  size: Size;
  sku: string;
  available: boolean;
}

export interface ColorwayDto {
  code: string;
  name: string;
  hex: string;
  images: { url: string; alt: string }[];
  sizes: SizeOptionDto[];
}

export interface ProductSummaryDto {
  slug: string;
  name: string;
  subtitle: string | null;
  fit: Fit;
  fitLabel: string;
  category: { slug: string; name: string };
  price: MoneyDto;
  compareAtPrice: MoneyDto | null;
  newArrival: boolean;
  featuredRank: number;
  publishedAt: string;
  sizes: Size[];
  colorways: ColorwayDto[];
}

export interface ProductDetailDto extends ProductSummaryDto {
  description: string | null;
  collections: string[];
  details: string[];
  fitNotes: string[];
  care: string[];
}

export interface PageResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ApiErrorBody {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
  errors: { field: string; message: string }[];
}

export type ApiSort = 'featured' | 'newest' | 'price_asc' | 'price_desc' | 'name';

/** A collection page as set in the admin: title, small heading, intro and optional banner. */
export interface CollectionDto {
  slug: string;
  name: string;
  description: string | null;
  eyebrow: string;
  intro: string;
  banner: { url: string; alt: string } | null;
  productCount: number;
}

/** Colours and sizes on sale right now, for the shop's filter chips. */
export interface FacetsDto {
  colors: { name: string; hex: string }[];
  sizes: Size[];
}

export interface ProductQuery {
  q?: string;
  category?: string;
  collection?: string;
  fit?: Fit[];
  sizes?: Size[];
  colors?: string[];
  /** Exact products by slug (e.g. a guest's saved bag or wishlist). */
  slugs?: string[];
  minPricePaise?: number;
  maxPricePaise?: number;
  sort?: ApiSort;
  page?: number;
  pageSize?: number;
}

// ---- Errors ----

/** Any failed API call. `status` is 0 when the server could not be reached. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors: ApiErrorBody['errors'] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNotFound() {
    return this.status === 404;
  }
}

// ---- Transport ----

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: Method;
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * Anti-forgery (CSRF) token. The server only accepts POST/PUT/DELETE that echo it back in a header,
 * which another website can't do. Fetched once and reused; dropped whenever the session changes.
 */
let csrf: Promise<{ headerName: string; token: string }> | null = null;

function csrfToken() {
  csrf ??= request<{ headerName: string; token: string }>('/api/auth/csrf').catch((err) => {
    csrf = null;
    throw err;
  });
  return csrf;
}

/** Call after sign-in, sign-up and sign-out: the server issues a new token with the new session. */
export function resetCsrfToken() {
  csrf = null;
}

/**
 * Uploaded images are served by the API (/media/…), which runs on a different address from the
 * site during development, so they need the API's base URL in front. Bundled images (/images/…)
 * and full URLs are returned unchanged.
 */
export function mediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  return url.startsWith('/media/') && API_BASE_URL ? `${API_BASE_URL}${url}` : url;
}

/** Widths the server can make smaller copies at (see MediaVariants.java). */
const MEDIA_WIDTHS = [320, 480, 640, 960];
const isMedia = (src: string | undefined): src is string => !!src && src.includes('/media/') && !src.includes('?');

/** A smaller copy of an uploaded photo (larger requests, and other images, get the original). */
export function sized(src: string | undefined, width: number): string {
  if (!isMedia(src)) return src ?? '';
  const w = MEDIA_WIDTHS.find((x) => x >= width);
  return w ? `${src}?w=${w}` : src;
}

/**
 * Put first in a full-width photo's `sizes`: very sharp phone screens (3×) would otherwise fetch the
 * full-size original, though the 960px copy already looks the same at phone size.
 */
export const PHONE_SIZES = '(max-width: 639px) and (min-resolution: 2.5dppx) 320px';

/**
 * srcSet for an uploaded photo, so each screen downloads only the size it needs: small copies up
 * to `max`, then the original (about `originalWidth` pixels wide) for big screens. Pass
 * `originalWidth: null` to stop at the small copies (phones never need the full-size file).
 */
export function srcSetFor(src: string | undefined, max = 960, originalWidth: number | null = 1600): string | undefined {
  if (!isMedia(src)) return undefined;
  const list = MEDIA_WIDTHS.filter((w) => w <= max).map((w) => `${src}?w=${w} ${w}w`);
  if (originalWidth) list.push(`${src} ${originalWidth}w`);
  return list.join(', ');
}

/** Shared by api.ts and the admin client. */
export async function request<T>(path: string, options: RequestOptions | AbortSignal = {}, retried = false): Promise<T> {
  if (!API_BASE_URL) throw new ApiError(0, 'NOT_CONFIGURED', 'The catalogue API is not configured.');
  const { method = 'GET', body, signal } = options instanceof AbortSignal ? { signal: options } : options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') {
    const { headerName, token } = await csrfToken();
    headers[headerName] = token;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      // File uploads go as multipart form data (the browser sets the boundary); everything else as JSON.
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      // Send and accept the HttpOnly session cookie. The browser keeps it; our code never sees it.
      credentials: 'include',
      signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'We couldn’t reach the store right now. Check your connection and try again.');
  }

  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as Partial<ApiErrorBody> | null;
    // A stale token (e.g. the session expired) is fixed by fetching a fresh one and trying once more.
    if (res.status === 403 && err?.error === 'CSRF_TOKEN_INVALID' && !retried) {
      resetCsrfToken();
      return request<T>(path, options, true);
    }
    throw new ApiError(res.status, err?.error ?? 'HTTP_ERROR', err?.message ?? `Request failed (${res.status}).`, err?.errors ?? []);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function toSearchParams(query: ProductQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) value.forEach((v) => params.append(key, String(v)));
    else params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

// ---- Endpoints ----

export const api = {
  listCollections: (signal?: AbortSignal) => request<CollectionDto[]>('/api/collections', signal),
  facets: (signal?: AbortSignal) => request<FacetsDto>('/api/facets', signal),
  listProducts: (query: ProductQuery = {}, signal?: AbortSignal) =>
    request<PageResponse<ProductSummaryDto>>(`/api/products${toSearchParams(query)}`, signal),
  getProduct: (slug: string, signal?: AbortSignal) =>
    request<ProductDetailDto>(`/api/products/${encodeURIComponent(slug)}`, signal),
  health: (signal?: AbortSignal) => request<{ status: string; database: string }>('/api/health', signal),
};

// ---- Accounts (mirror server/.../accounts/dto/AccountDtos.java) ----

export interface UserDto {
  name: string;
  email: string;
  role: 'customer' | 'admin';
  memberSince: string;
}

export interface SessionDto {
  authenticated: boolean;
  user: UserDto | null;
}

export interface WishlistDto {
  items: ProductSummaryDto[];
}

export const accountApi = {
  session: (signal?: AbortSignal) => request<SessionDto>('/api/auth/session', signal),
  register: (body: { name: string; email: string; password: string }) =>
    request<UserDto>('/api/auth/register', { method: 'POST', body }),
  login: (body: { email: string; password: string }) => request<UserDto>('/api/auth/login', { method: 'POST', body }),
  logout: () => request<void>('/api/auth/logout', { method: 'POST', body: {} }),

  wishlist: () => request<WishlistDto>('/api/me/wishlist'),
  addToWishlist: (slug: string) => request<WishlistDto>(`/api/me/wishlist/${encodeURIComponent(slug)}`, { method: 'PUT' }),
  removeFromWishlist: (slug: string) => request<WishlistDto>(`/api/me/wishlist/${encodeURIComponent(slug)}`, { method: 'DELETE' }),
  mergeWishlist: (slugs: string[]) => request<WishlistDto>('/api/me/wishlist/merge', { method: 'POST', body: { slugs } }),
};

// ---- Bag and orders (mirror server/.../orders/dto/OrderDtos.java) ----

export type LineIssue = 'UNAVAILABLE' | 'SOLD_OUT' | 'NOT_ENOUGH_STOCK';

export interface CartLineDto {
  sku: string;
  product: ProductSummaryDto;
  colorCode: string;
  colorName: string;
  size: Size;
  image: { url: string; alt: string } | null;
  unitPrice: MoneyDto;
  quantity: number;
  lineTotal: MoneyDto;
  availableQuantity: number;
  issue: LineIssue | null;
}

export interface CartDto {
  lines: CartLineDto[];
  itemCount: number;
  subtotal: MoneyDto;
  shipping: MoneyDto;
  total: MoneyDto;
  freeShippingThreshold: MoneyDto;
  maxQuantityPerLine: number;
  readyForCheckout: boolean;
}

export interface CartChoice {
  slug: string;
  color: string;
  size: Size;
  quantity: number;
}

export interface AddressInput {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
}

export type OrderStatus = 'pending_payment' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'expired';

export interface OrderItemDto {
  sku: string;
  productSlug: string;
  productName: string;
  colorName: string;
  size: Size;
  imageUrl: string | null;
  unitPrice: MoneyDto;
  quantity: number;
  lineTotal: MoneyDto;
}

export interface OrderSummaryDto {
  orderNumber: string;
  status: OrderStatus;
  placedAt: string;
  expiresAt: string | null;
  itemCount: number;
  total: MoneyDto;
  previewImages: string[];
}

export interface OrderDetailDto {
  orderNumber: string;
  status: OrderStatus;
  placedAt: string;
  expiresAt: string | null;
  closedAt: string | null;
  items: OrderItemDto[];
  subtotal: MoneyDto;
  shipping: MoneyDto;
  total: MoneyDto;
  shippingAddress: Omit<AddressInput, 'line2'> & { line2: string | null };
  paidAt: string | null;
  canCancel: boolean;
  /** Awaiting payment, payments are set up, and there's still time to pay. */
  canPay: boolean;
  /** A payment arrived but couldn't be used (e.g. after the order expired) and was refunded. */
  refunded: boolean;
  /** Courier and tracking, once shipped. */
  shipment: { courier: string; trackingNumber: string; trackingUrl: string | null; shippedAt: string; deliveredAt: string | null } | null;
  /** Set when the store cancelled the order. */
  cancelReason: string | null;
  timeline: { type: string; message: string; at: string }[];
}

// ---- Payments (mirror server/.../payments/dto/PaymentDtos.java) ----

export interface PaymentSessionDto {
  keyId: string;
  razorpayOrderId: string;
  amount: MoneyDto;
  orderNumber: string;
  businessName: string;
  description: string;
  prefill: { name: string; email: string | null; contact: string };
  timeoutSeconds: number;
  testMode: boolean;
}

export const paymentApi = {
  start: (orderNumber: string) =>
    request<PaymentSessionDto>(`/api/me/orders/${encodeURIComponent(orderNumber)}/payment`, { method: 'POST', body: {} }),
  verify: (orderNumber: string, result: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) =>
    request<OrderDetailDto>(`/api/me/orders/${encodeURIComponent(orderNumber)}/payment/verify`, { method: 'POST', body: result }),
};

const sku = (s: string) => encodeURIComponent(s);

export const cartApi = {
  get: () => request<CartDto>('/api/me/cart'),
  add: (choice: CartChoice) => request<CartDto>('/api/me/cart/items', { method: 'POST', body: choice }),
  setQuantity: (lineSku: string, quantity: number) =>
    request<CartDto>(`/api/me/cart/items/${sku(lineSku)}`, { method: 'PUT', body: { quantity } }),
  remove: (lineSku: string) => request<CartDto>(`/api/me/cart/items/${sku(lineSku)}`, { method: 'DELETE' }),
  clear: () => request<CartDto>('/api/me/cart', { method: 'DELETE' }),
  merge: (items: CartChoice[]) => request<CartDto>('/api/me/cart/merge', { method: 'POST', body: { items } }),
};

export const orderApi = {
  place: (address: AddressInput, idempotencyKey: string) =>
    request<OrderDetailDto>('/api/me/orders', { method: 'POST', body: { address, idempotencyKey } }),
  list: (page = 0, pageSize = 10, signal?: AbortSignal) =>
    request<PageResponse<OrderSummaryDto>>(`/api/me/orders?page=${page}&pageSize=${pageSize}`, signal),
  get: (orderNumber: string, signal?: AbortSignal) => request<OrderDetailDto>(`/api/me/orders/${encodeURIComponent(orderNumber)}`, signal),
  cancel: (orderNumber: string) =>
    request<OrderDetailDto>(`/api/me/orders/${encodeURIComponent(orderNumber)}/cancel`, { method: 'POST', body: {} }),
};

export const paiseToRupees = (m: MoneyDto) => m.amountPaise / 100;

// ---- Adapter: API DTO → the UI's existing Product shape ----

const rupees = (m: MoneyDto) => m.amountPaise / 100;

export function toProduct(dto: ProductSummaryDto | ProductDetailDto): Product {
  const detail = 'details' in dto ? dto : null;
  const colorways: Colorway[] = dto.colorways.map((c) => ({
    id: c.code,
    name: c.name,
    hex: c.hex,
    images: c.images.map((i) => ({ src: mediaUrl(i.url), alt: i.alt })),
    // Out of stock, or not offered in this colour at all.
    soldOut: dto.sizes.filter((size) => !c.sizes.some((s) => s.size === size && s.available)),
  }));
  return {
    slug: dto.slug,
    name: dto.name,
    subtitle: dto.subtitle ?? '',
    price: rupees(dto.price),
    compareAtPrice: dto.compareAtPrice ? rupees(dto.compareAtPrice) : undefined,
    fit: dto.fit,
    fitLabel: dto.fitLabel,
    isNew: dto.newArrival,
    rank: dto.featuredRank,
    addedAt: dto.publishedAt.slice(0, 10),
    description: detail?.description ?? '',
    details: detail?.details ?? [],
    fitNotes: detail?.fitNotes ?? [],
    care: detail?.care ?? [],
    colorways,
    sizes: dto.sizes,
  };
}
