/**
 * Admin API client (server: /api/admin/**, admins only). Shares transport, CSRF handling and
 * error parsing with the storefront client in src/lib/api.ts.
 */
import { request, type MoneyDto, type OrderDetailDto, type OrderStatus, type PageResponse } from '@/lib/api';

export interface LowStockItem {
  sku: string;
  productName: string;
  productSlug: string;
  colorName: string;
  size: string;
  available: number;
}

export interface Overview {
  ordersToShip: number;
  awaitingPayment: number;
  ordersToday: number;
  revenueLast7Days: MoneyDto;
  paidOrdersLast7Days: number;
  publishedProducts: number;
  draftProducts: number;
  customers: number;
  lowStock: LowStockItem[];
}

export interface AuditEntry {
  id: number;
  adminEmail: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  at: string;
}

export interface MediaDto {
  id: number;
  url: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  width: number;
  height: number;
  altText: string;
  createdAt: string;
}

// ---- catalogue ----

export type ProductStatus = 'draft' | 'published' | 'archived';
export const SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const;
export type AdminSize = (typeof SIZES)[number];

export interface ProductRow {
  id: number;
  slug: string;
  name: string;
  status: ProductStatus;
  fit: 'oversized' | 'regular';
  category: string;
  price: MoneyDto;
  compareAtPrice: MoneyDto | null;
  newArrival: boolean;
  featuredRank: number;
  thumbnail: string | null;
  colorCount: number;
  sizes: AdminSize[];
  stock: number;
  /** Published and complete, so shoppers can see it. */
  live: boolean;
}

export interface SizeRow {
  variantId: number;
  size: AdminSize;
  sku: string;
  active: boolean;
  stock: number;
  reserved: number;
  available: number;
  pricePaise: number | null;
}

export interface ImageRef {
  url: string;
  alt: string;
}

export interface ColorDetail {
  id: number;
  code: string;
  name: string;
  hex: string;
  sortOrder: number;
  images: ImageRef[];
  sizes: SizeRow[];
}

export interface ProductDetail {
  id: number;
  slug: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  status: ProductStatus;
  fit: 'oversized' | 'regular';
  fitLabel: string;
  categorySlug: string;
  collections: string[];
  price: MoneyDto;
  compareAtPrice: MoneyDto | null;
  newArrival: boolean;
  featuredRank: number;
  details: string[];
  fitNotes: string[];
  care: string[];
  publishedAt: string | null;
  colors: ColorDetail[];
  hasOrders: boolean;
}

export interface ProductInput {
  name: string;
  slug: string;
  subtitle: string;
  description: string;
  categorySlug: string;
  fit: 'oversized' | 'regular';
  fitLabel: string;
  pricePaise: number | null;
  compareAtPricePaise: number | null;
  newArrival: boolean;
  details: string[];
  fitNotes: string[];
  care: string[];
  collections: string[];
}

export interface SizeInput {
  size: AdminSize;
  active: boolean;
  stock: number;
  pricePaise: number | null;
}

export interface CategoryRow {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  productCount: number;
}

export interface CollectionRow {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  active: boolean;
  eyebrow: string;
  intro: string;
  bannerUrl: string | null;
  bannerAlt: string;
  productCount: number;
}

export type CategoryInput = Omit<CategoryRow, 'id' | 'productCount'>;
export type CollectionInput = Omit<CollectionRow, 'id' | 'productCount'>;

// ---- orders ----

export interface AdminOrderRow {
  orderNumber: string;
  placedAt: string;
  status: OrderStatus;
  customerName: string;
  email: string;
  phone: string;
  city: string;
  itemCount: number;
  total: MoneyDto;
}

export interface AdminOrderDetail {
  order: OrderDetailDto;
  customerEmail: string;
  customerName: string;
  payments: {
    razorpayOrderId: string;
    razorpayPaymentId: string | null;
    amount: MoneyDto;
    status: 'created' | 'paid' | 'refunded';
    refundId: string | null;
    failureReason: string | null;
    paidAt: string | null;
  }[];
  history: { type: string; message: string; actor: string; at: string }[];
  canShip: boolean;
  canDeliver: boolean;
  canCancel: boolean;
}

const P = '/api/admin/products';
const O = '/api/admin/orders';

export const adminApi = {
  overview: (signal?: AbortSignal) => request<Overview>('/api/admin/overview', signal),
  activity: (signal?: AbortSignal) => request<AuditEntry[]>('/api/admin/activity', signal),

  products: {
    list: (q = '', status = '', signal?: AbortSignal) =>
      request<ProductRow[]>(`${P}?q=${encodeURIComponent(q)}&status=${status}`, signal),
    get: (idOrSlug: string | number, signal?: AbortSignal) => request<ProductDetail>(`${P}/${idOrSlug}`, signal),
    create: (body: ProductInput) => request<ProductDetail>(P, { method: 'POST', body }),
    update: (id: number, body: ProductInput) => request<ProductDetail>(`${P}/${id}`, { method: 'PUT', body }),
    setStatus: (id: number, status: ProductStatus) => request<ProductDetail>(`${P}/${id}/status`, { method: 'PUT', body: { status } }),
    remove: (id: number) => request<void>(`${P}/${id}`, { method: 'DELETE' }),
    reorder: (ids: number[]) => request<ProductRow[]>(`${P}/order`, { method: 'PUT', body: { ids } }),
    addColor: (id: number, name: string, hex: string) => request<ProductDetail>(`${P}/${id}/colors`, { method: 'POST', body: { name, hex } }),
    updateColor: (id: number, colorId: number, body: { name: string; hex: string; images: ImageRef[] }) =>
      request<ProductDetail>(`${P}/${id}/colors/${colorId}`, { method: 'PUT', body }),
    reorderColors: (id: number, ids: number[]) => request<ProductDetail>(`${P}/${id}/colors/order`, { method: 'PUT', body: { ids } }),
    removeColor: (id: number, colorId: number) => request<ProductDetail>(`${P}/${id}/colors/${colorId}`, { method: 'DELETE' }),
    setSizes: (id: number, colorId: number, sizes: SizeInput[]) =>
      request<ProductDetail>(`${P}/${id}/colors/${colorId}/sizes`, { method: 'PUT', body: { sizes } }),
  },

  orders: {
    list: (status = '', q = '', page = 0, signal?: AbortSignal) =>
      request<PageResponse<AdminOrderRow>>(`${O}?status=${status}&q=${encodeURIComponent(q)}&page=${page}&pageSize=25`, signal),
    get: (orderNumber: string, signal?: AbortSignal) => request<AdminOrderDetail>(`${O}/${encodeURIComponent(orderNumber)}`, signal),
    ship: (orderNumber: string, body: { courier: string; trackingNumber: string; trackingUrl: string }) =>
      request<AdminOrderDetail>(`${O}/${encodeURIComponent(orderNumber)}/ship`, { method: 'POST', body }),
    deliver: (orderNumber: string) => request<AdminOrderDetail>(`${O}/${encodeURIComponent(orderNumber)}/deliver`, { method: 'POST', body: {} }),
    cancel: (orderNumber: string, reason: string) =>
      request<AdminOrderDetail>(`${O}/${encodeURIComponent(orderNumber)}/cancel`, { method: 'POST', body: { reason } }),
  },

  categories: {
    list: (signal?: AbortSignal) => request<CategoryRow[]>('/api/admin/categories', signal),
    save: (id: number | null, body: CategoryInput) =>
      request<CategoryRow>(id ? `/api/admin/categories/${id}` : '/api/admin/categories', { method: id ? 'PUT' : 'POST', body }),
    remove: (id: number) => request<void>(`/api/admin/categories/${id}`, { method: 'DELETE' }),
  },

  collections: {
    list: (signal?: AbortSignal) => request<CollectionRow[]>('/api/admin/collections', signal),
    save: (id: number | null, body: CollectionInput) =>
      request<CollectionRow>(id ? `/api/admin/collections/${id}` : '/api/admin/collections', { method: id ? 'PUT' : 'POST', body }),
    remove: (id: number) => request<void>(`/api/admin/collections/${id}`, { method: 'DELETE' }),
  },

  media: {
    list: (q = '', page = 0, pageSize = 40, signal?: AbortSignal) =>
      request<PageResponse<MediaDto>>(`/api/admin/media?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`, signal),
    upload: (file: File, altText = '') => {
      const form = new FormData();
      form.append('file', file);
      form.append('altText', altText);
      return request<MediaDto>('/api/admin/media', { method: 'POST', body: form });
    },
    update: (id: number, altText: string) => request<MediaDto>(`/api/admin/media/${id}`, { method: 'PATCH', body: { altText } }),
    usages: (id: number) => request<string[]>(`/api/admin/media/${id}/usages`),
    remove: (id: number) => request<void>(`/api/admin/media/${id}`, { method: 'DELETE' }),
  },
};

// ---- website content and store settings ----

export type ContentFieldType = 'text' | 'textarea' | 'image' | 'link' | 'select' | 'toggle' | 'number' | 'product' | 'strings' | 'list';

/** One editable field, described by the server (ContentSchema.java). The admin builds its forms from these. */
export interface ContentField {
  key: string;
  label: string;
  type: ContentFieldType;
  required: boolean;
  max?: number;
  min?: number;
  hint?: string;
  options?: { value: string; label: string }[];
  maxItems?: number;
  fields?: ContentField[];
  itemLabel?: string;
}

export interface ContentSection {
  key: string;
  label: string;
  group: string;
  description: string;
  previewPath: string;
  fields: ContentField[];
}

export type ContentValue = Record<string, unknown>;

export interface StoreSettingsDto {
  storeName: string;
  tagline: string;
  supportEmail: string;
  freeShippingThresholdPaise: number;
  shippingFeePaise: number;
  maxQuantityPerLine: number;
  maxCartLines: number;
  paymentWindowMinutes: number;
}

export const contentApi = {
  all: (signal?: AbortSignal) => request<{ schema: ContentSection[]; content: Record<string, ContentValue> }>('/api/admin/content', signal),
  save: (key: string, body: ContentValue) => request<ContentValue>(`/api/admin/content/${key}`, { method: 'PUT', body }),
  reset: (key: string) => request<ContentValue>(`/api/admin/content/${key}/reset`, { method: 'POST', body: {} }),
  settings: (signal?: AbortSignal) => request<StoreSettingsDto>('/api/admin/settings', signal),
  saveSettings: (body: StoreSettingsDto) => request<StoreSettingsDto>('/api/admin/settings', { method: 'PUT', body }),
};

// ---- payment keys (Razorpay) ----

/** Secrets are never sent back: only whether one is saved. */
export interface PaymentKeysStatus {
  keyId: string | null;
  mode: 'test' | 'live' | null;
  /** admin: saved here; server: from server/.env; none: online payment is off */
  source: 'admin' | 'server' | 'none';
  secretSaved: boolean;
  webhookSecretSaved: boolean;
  webhookPath: string;
  updatedAt: string | null;
  updatedBy: string | null;
  canSave: boolean;
  liveKeysAllowed: boolean;
}

export interface SavePaymentKeys {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  removeWebhookSecret: boolean;
  currentPassword: string;
}

export const paymentKeysApi = {
  status: (signal?: AbortSignal) => request<PaymentKeysStatus>('/api/admin/settings/payments', signal),
  save: (body: SavePaymentKeys) => request<PaymentKeysStatus>('/api/admin/settings/payments', { method: 'PUT', body }),
  remove: (currentPassword: string) => request<PaymentKeysStatus>('/api/admin/settings/payments/remove', { method: 'POST', body: { currentPassword } }),
  test: (keyId: string, keySecret: string) =>
    request<{ ok: boolean; mode: 'test' | 'live' | null; message: string }>('/api/admin/settings/payments/test', { method: 'POST', body: { keyId, keySecret } }),
};

// ---- newsletter ----

export interface SubscriberDto {
  id: number;
  email: string;
  source: string;
  createdAt: string;
}

export const subscribersApi = {
  list: (q = '', page = 0, signal?: AbortSignal) =>
    request<PageResponse<SubscriberDto>>(`/api/admin/subscribers?q=${encodeURIComponent(q)}&page=${page}&pageSize=50`, signal),
  remove: (id: number) => request<void>(`/api/admin/subscribers/${id}`, { method: 'DELETE' }),
};
