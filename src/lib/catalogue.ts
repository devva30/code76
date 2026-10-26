/**
 * Catalogue data for the UI. With VITE_API_BASE_URL set, everything comes from the
 * Java API; without it (e.g. the static Netlify preview) the bundled demo catalogue
 * in data/products.ts is used, so the site still works with no backend.
 * In API mode failures surface as errors with a retry: there is no silent fallback.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL, ApiError, api, mediaUrl, toProduct, type ApiSort, type ProductQuery } from './api';
import { ALL_SIZES, collections, colorFilters, getProduct, products as demoProducts, type CollectionHandle, type Fit, type Product, type Size } from '@/data/products';

export const catalogueSource: 'api' | 'demo' = API_BASE_URL ? 'api' : 'demo';

export type ListSort = 'featured' | 'newest' | 'price-asc' | 'price-desc';

export interface ListFilters {
  /** 'all', or a collection slug. */
  collection: string;
  q: string;
  fits: string[];
  colors: string[];
  sizes: string[];
  sort: ListSort;
}

const PAGE_SIZE = 12;

const API_SORT: Record<ListSort, ApiSort> = {
  featured: 'featured',
  newest: 'newest',
  'price-asc': 'price_asc',
  'price-desc': 'price_desc',
};

const asApiError = (err: unknown) =>
  err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Something went wrong while loading products.');

const isAbort = (err: unknown) => (err as Error | null)?.name === 'AbortError';

// ---- Demo-mode filtering (same rules the API applies) ----

function demoMatches(p: Product, f: ListFilters) {
  if (f.q) {
    const hay = [p.name, p.subtitle, p.fitLabel, p.fit, ...p.colorways.map((c) => c.name)].join(' ').toLowerCase();
    if (!f.q.toLowerCase().split(/\s+/).filter(Boolean).every((t) => hay.includes(t))) return false;
  }
  if (f.fits.length && !f.fits.includes(p.fit)) return false;
  if (f.colors.length && !p.colorways.some((c) => f.colors.includes(c.name))) return false;
  if (f.sizes.length && !f.sizes.some((s) => p.sizes.includes(s as Size) && p.colorways.some((c) => !c.soldOut?.includes(s as Size)))) return false;
  return true;
}

function demoList(f: ListFilters): Product[] {
  const collection = collections[f.collection as CollectionHandle] ?? collections.all;
  const sorted = demoProducts.filter(collection.filter).filter((p) => demoMatches(p, f));
  if (f.sort === 'featured') sorted.sort((a, b) => a.rank - b.rank);
  if (f.sort === 'newest') sorted.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  if (f.sort === 'price-asc') sorted.sort((a, b) => a.price - b.price);
  if (f.sort === 'price-desc') sorted.sort((a, b) => b.price - a.price);
  return sorted;
}

function toQuery(f: ListFilters, page: number): ProductQuery {
  return {
    q: f.q.trim() || undefined,
    collection: f.collection === 'all' ? undefined : f.collection,
    fit: f.fits as Fit[],
    colors: f.colors,
    sizes: f.sizes as Size[],
    sort: API_SORT[f.sort],
    page,
    pageSize: PAGE_SIZE,
  };
}

// ---- Listing ----

export interface ProductListState {
  products: Product[];
  total: number;
  /** True only before the first result for the current filters arrives. */
  loading: boolean;
  /** True while newer filters are loading and older results are still shown. */
  refreshing: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: ApiError | null;
  loadMore: () => void;
  retry: () => void;
}

export function useProductList(filters: ListFilters): ProductListState {
  const key = JSON.stringify(filters);
  const demo = useMemo(() => (catalogueSource === 'demo' ? demoList(filters) : null), [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const [state, setState] = useState<{ key: string | null; items: Product[]; page: number; total: number; totalPages: number }>({
    key: null,
    items: [],
    page: 0,
    total: 0,
    totalPages: 0,
  });
  const [pending, setPending] = useState<'first' | 'more' | null>(catalogueSource === 'api' ? 'first' : null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const moreCtrl = useRef<AbortController | null>(null);
  const failedOp = useRef<'first' | 'more'>('first');

  useEffect(() => {
    if (catalogueSource !== 'api') return;
    const ctrl = new AbortController();
    moreCtrl.current?.abort();
    setPending('first');
    setError(null);
    api
      .listProducts(toQuery(filters, 0), ctrl.signal)
      .then((res) => {
        setState({ key, items: res.items.map(toProduct), page: 0, total: res.totalItems, totalPages: res.totalPages });
        setPending(null);
      })
      .catch((err) => {
        if (isAbort(err)) return;
        failedOp.current = 'first';
        setError(asApiError(err));
        setPending(null);
      });
    return () => ctrl.abort();
  }, [key, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(() => {
    if (catalogueSource !== 'api' || pending || state.page + 1 >= state.totalPages) return;
    const ctrl = new AbortController();
    moreCtrl.current = ctrl;
    const nextPage = state.page + 1;
    setPending('more');
    setError(null);
    api
      .listProducts(toQuery(filters, nextPage), ctrl.signal)
      .then((res) => {
        setState((s) => {
          const seen = new Set(s.items.map((p) => p.slug));
          const fresh = res.items.map(toProduct).filter((p) => !seen.has(p.slug));
          return { ...s, items: [...s.items, ...fresh], page: nextPage, total: res.totalItems, totalPages: res.totalPages };
        });
        setPending(null);
      })
      .catch((err) => {
        if (isAbort(err)) return;
        failedOp.current = 'more';
        setError(asApiError(err));
        setPending(null);
      });
  }, [filters, pending, state.page, state.totalPages]);

  /** Repeats whichever request failed last: the first page, or the next page. */
  const retry = useCallback(() => {
    if (failedOp.current === 'more' && state.key === key) loadMore();
    else setAttempt((n) => n + 1);
  }, [loadMore, state.key, key]);

  if (demo) {
    return { products: demo, total: demo.length, loading: false, refreshing: false, loadingMore: false, hasMore: false, error: null, loadMore, retry };
  }

  const hasData = state.key !== null;
  return {
    products: state.items,
    total: state.total,
    loading: pending === 'first' && !hasData,
    refreshing: pending === 'first' && hasData,
    loadingMore: pending === 'more',
    hasMore: state.page + 1 < state.totalPages,
    error,
    loadMore,
    retry,
  };
}

// ---- Generic single-resource loader ----

interface Resource<T> {
  data: T | undefined;
  loading: boolean;
  error: ApiError | null;
  retry: () => void;
}

function useApiResource<T>(key: string, load: (signal: AbortSignal) => Promise<T>, demo: () => T): Resource<T> {
  const demoData = useMemo(() => (catalogueSource === 'demo' ? demo() : undefined), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const [state, setState] = useState<{ key: string | null; data?: T; error: ApiError | null }>({ key: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (catalogueSource !== 'api') return;
    const ctrl = new AbortController();
    setState({ key: null, error: null });
    load(ctrl.signal)
      .then((data) => setState({ key, data, error: null }))
      .catch((err) => {
        if (!isAbort(err)) setState({ key, error: asApiError(err) });
      });
    return () => ctrl.abort();
  }, [key, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  if (catalogueSource === 'demo') return { data: demoData, loading: false, error: null, retry };
  const settled = state.key === key;
  return { data: settled ? state.data : undefined, loading: !settled, error: settled ? state.error : null, retry };
}

/** Product detail. `notFound` is true for unknown or unpublished slugs. */
export function useProductDetail(slug: string) {
  const res = useApiResource<Product | null>(
    `product:${slug}`,
    (signal) =>
      api.getProduct(slug, signal).then(toProduct, (err) => {
        if (err instanceof ApiError && err.isNotFound) return null;
        throw err;
      }),
    () => getProduct(slug) ?? null,
  );
  return { product: res.data ?? undefined, notFound: res.data === null, loading: res.loading, error: res.error, retry: res.retry };
}

/** Featured-order products, e.g. for the home carousel and "You may also like". */
export function useFeaturedProducts(limit = 12) {
  const res = useApiResource<Product[]>(
    `featured:${limit}`,
    (signal) => api.listProducts({ sort: 'featured', pageSize: limit }, signal).then((r) => r.items.map(toProduct)),
    () => [...demoProducts].sort((a, b) => a.rank - b.rank).slice(0, limit),
  );
  return { products: res.data ?? [], loading: res.loading, error: res.error, retry: res.retry };
}

// ---- Collections, filter options, search, lookups ----

/** A collection page as shown in the shop (the admin sets all of this). */
export interface CollectionInfo {
  slug: string;
  title: string;
  eyebrow: string;
  intro: string;
  banner: { src: string; alt: string } | null;
}

/** Bundled copy used only by the static preview (no server). */
const DEMO_BANNERS: Record<string, { src: string; alt: string }> = {
  oversized: { src: '/images/editorial/fit-oversized.webp', alt: 'Model in an oversized white tee beside a timber building' },
  'regular-fit': { src: '/images/editorial/fit-regular.webp', alt: 'Model in a regular-fit white tee in a sunlit room' },
  'new-arrivals': { src: '/images/editorial/look-colonnade.webp', alt: 'Model in a white tee in a concrete colonnade' },
};

export function useCollections() {
  const res = useApiResource<CollectionInfo[]>(
    'collections',
    (signal) =>
      api.listCollections(signal).then((list) =>
        list.map((c) => ({
          slug: c.slug,
          title: c.name,
          eyebrow: c.eyebrow,
          intro: c.intro,
          banner: c.banner ? { src: mediaUrl(c.banner.url), alt: c.banner.alt } : null,
        })),
      ),
    () =>
      Object.values(collections)
        .filter((c) => c.handle !== 'all')
        .map((c) => ({ slug: c.handle, title: c.title, eyebrow: c.eyebrow, intro: c.intro, banner: DEMO_BANNERS[c.handle] ?? null })),
  );
  return { collections: res.data ?? [], loading: res.loading, error: res.error, retry: res.retry };
}

/** Colours and sizes that can actually be bought, for the filter chips. */
export function useFacets() {
  const res = useApiResource<{ colors: { name: string; hex: string }[]; sizes: Size[] }>(
    'facets',
    (signal) => api.facets(signal),
    () => ({ colors: colorFilters, sizes: ALL_SIZES.filter((s) => demoProducts.some((p) => p.sizes.includes(s))) }),
  );
  return { colors: res.data?.colors ?? [], sizes: res.data?.sizes ?? [], loading: res.loading };
}

/** Live search for the header's search panel. */
export function useProductSearch(query: string, limit = 8) {
  const q = query.trim();
  const res = useApiResource<Product[]>(
    `search:${q}:${limit}`,
    (signal) => (q ? api.listProducts({ q, pageSize: limit }, signal).then((r) => r.items.map(toProduct)) : Promise.resolve([])),
    () => (q ? demoList({ collection: 'all', q, fits: [], colors: [], sizes: [], sort: 'featured' }).slice(0, limit) : []),
  );
  return { results: res.data ?? [], loading: res.loading && q.length > 0, error: res.error };
}

/** Fetches specific products by slug (guest bag and wishlist). Demo mode reads the bundled data. */
export async function fetchProductsBySlugs(slugs: string[]): Promise<Product[]> {
  if (slugs.length === 0) return [];
  if (catalogueSource === 'demo') return demoProducts.filter((p) => slugs.includes(p.slug));
  const res = await api.listProducts({ slugs: slugs.slice(0, 100), pageSize: 48 });
  return res.items.map(toProduct);
}

/** A bundled product, only in the static preview; in API mode products always come from the server. */
export const demoProduct = (slug: string) => (catalogueSource === 'demo' ? getProduct(slug) : undefined);
