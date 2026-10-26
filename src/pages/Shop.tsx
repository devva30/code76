import { useEffect, useState } from 'react';
import { NavLink, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';
import { sizeLabel } from '@/data/products';
import { useCollections, useFacets, useProductList, type CollectionInfo, type ListSort } from '@/lib/catalogue';
import { ProductGrid } from '@/components/product/ProductGrid';
import { CatalogueError, ProductGridSkeleton } from '@/components/product/CatalogueStates';
import { PageIntro } from '@/components/ui/PageIntro';
import { Button } from '@/components/ui/Button';
import { useScrollLock } from '@/lib/SmoothScroll';
import { EASE, useMediaQuery } from '@/lib/motion';
import { useContent } from '@/store/SiteContent';
import { BRAND } from '@/config/brand';
import { cx } from '@/lib/format';
import NotFound from './NotFound';
import { OFFERS_COLLECTION } from './Offers';
import { sized } from '@/lib/api';

type SortKey = ListSort;

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'featured', label: 'Featured' },
  { key: 'newest', label: 'Newest' },
  { key: 'price-asc', label: 'Price: low to high' },
  { key: 'price-desc', label: 'Price: high to low' },
];

/** The "All" tab. Collections themselves (tabs, titles, intros, banners) come from the admin. */
const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="eyebrow mb-4">{title}</legend>
      {children}
    </fieldset>
  );
}

function Chip({ active, onClick, children, label }: { active: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={cx(
        'inline-flex h-9 items-center gap-2 border px-3.5 text-xs tracking-wide transition-colors duration-300',
        active ? 'border-ink bg-ink text-paper' : 'border-rule hover:border-ink',
      )}
    >
      {children}
    </button>
  );
}

export default function Shop() {
  const { handle: rawHandle } = useParams();
  const handle = rawHandle ?? 'all';
  const { collections, loading: collectionsLoading } = useCollections();
  const allPage = useContent('page.shopAll');
  const ALL_PAGE: CollectionInfo = { slug: 'all', title: allPage.title, eyebrow: allPage.eyebrow, intro: allPage.intro, banner: null };
  const facets = useFacets();
  const collection: CollectionInfo | undefined = handle === 'all' ? ALL_PAGE : collections.find((c) => c.slug === handle);
  const tabs = [{ slug: 'all', label: 'All', to: '/shop' }, ...collections.filter((c) => c.slug !== OFFERS_COLLECTION).map((c) => ({ slug: c.slug, label: c.title, to: `/collections/${c.slug}` }))];
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  useScrollLock(filtersOpen && !isDesktop);

  const q = params.get('q') ?? '';
  const fits = list(params.get('fit'));
  const colors = list(params.get('color'));
  const sizes = list(params.get('size'));
  const sort = (params.get('sort') as SortKey) || 'featured';
  const [query, setQuery] = useState(q);

  useEffect(() => setQuery(q), [q]);
  useEffect(() => {
    if (collection) document.title = `${collection.title} — ${BRAND.name}`;
  }, [collection]);

  // Debounce the search field into the URL so results are shareable and refresh-safe.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (query === q) return;
      update({ q: query || null });
    }, 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true, preventScrollReset: true });
  };

  const toggle = (key: 'fit' | 'color' | 'size', value: string, current: string[]) => {
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    update({ [key]: next.length ? next.join(',') : null });
  };

  const catalogue = useProductList({
    collection: collection ? handle : 'all',
    q,
    fits,
    colors,
    sizes,
    sort: SORTS.some((s) => s.key === sort) ? sort : 'featured',
  });
  const results = catalogue.products;

  // Collections load from the server; only call it "not found" once we know it doesn't exist.
  if (!collection) {
    return collectionsLoading ? (
      <div className="site-container pb-24 pt-[calc(var(--header-h)+var(--announce-h)+3rem)]"><ProductGridSkeleton /></div>
    ) : (
      <NotFound />
    );
  }

  const activeCount = fits.length + colors.length + sizes.length + (q ? 1 : 0);
  const banner = collection.banner;
  const clearAll = () => {
    setQuery('');
    setParams(new URLSearchParams(sort !== 'featured' ? { sort } : {}), { replace: true, preventScrollReset: true });
  };

  const filterBody = (
    <div className="grid gap-9 lg:grid-cols-3 lg:gap-12">
      <FilterGroup title="Fit">
        <div className="flex flex-wrap gap-2">
          <Chip active={fits.includes('oversized')} onClick={() => toggle('fit', 'oversized', fits)}>Oversized</Chip>
          <Chip active={fits.includes('regular')} onClick={() => toggle('fit', 'regular', fits)}>Regular</Chip>
        </div>
      </FilterGroup>
      <FilterGroup title="Colour">
        <div className="flex flex-wrap gap-2">
          {facets.colors.map((c) => (
            <Chip key={c.name} active={colors.includes(c.name)} onClick={() => toggle('color', c.name, colors)}>
              <span aria-hidden className="h-3 w-3 rounded-full shadow-[0_0_0_1px_rgb(var(--c-ink)/0.15)]" style={{ backgroundColor: c.hex }} />
              {c.name}
            </Chip>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title="Size">
        <div className="flex flex-wrap gap-2">
          {facets.sizes.map((s) => (
            <Chip key={s} active={sizes.includes(s)} onClick={() => toggle('size', s, sizes)} label={`Size ${sizeLabel(s)}`}>
              <span className="min-w-6 text-center">{sizeLabel(s)}</span>
            </Chip>
          ))}
        </div>
      </FilterGroup>
    </div>
  );

  return (
    <>
      <PageIntro
        key={handle}
        eyebrow={collection.eyebrow}
        title={handle === 'all' ? [allPage.line1, <span className="italic">{allPage.line2}</span>] : [collection.title]}
        aside={
          banner && (
            <div className="hidden aspect-[4/3] w-[30vw] max-w-md overflow-hidden bg-card md:block">
              <img decoding="async" src={sized(banner.src, 960)} alt={banner.alt} className="h-full w-full object-cover" />
            </div>
          )
        }
      >
        {collection.intro}
      </PageIntro>

      {/* Collection tabs */}
      <div className="site-container">
        <nav aria-label="Collections" className="no-scrollbar -mx-4 flex gap-6 overflow-x-auto border-b border-rule px-4 sm:mx-0 sm:px-0">
          {tabs.map((t) => (
            <NavLink
              key={t.slug}
              to={t.to}
              end
              className={({ isActive }) =>
                cx(
                  'relative shrink-0 pb-4 text-[0.7rem] font-medium font-mono uppercase tracking-[0.1em] transition-colors',
                  isActive ? 'text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-ink' : 'text-graphite hover:text-ink',
                )
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Toolbar */}
      <div className="sticky top-[var(--nav-offset,var(--header-h))] z-30 border-b border-rule bg-paper transition-[top] duration-700 ease-editorial">
        <div className="site-container flex h-14 items-center gap-3 sm:gap-6">
          <label className="flex min-w-0 flex-1 items-center gap-2.5">
            <Search strokeWidth={1.25} className="h-4 w-4 shrink-0 text-graphite" aria-hidden />
            <span className="sr-only">Search this collection</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="w-full min-w-0 bg-transparent text-sm placeholder:text-graphite/70 focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
            className="inline-flex shrink-0 items-center gap-2 text-[0.7rem] font-medium font-mono uppercase tracking-[0.1em]"
          >
            <SlidersHorizontal strokeWidth={1.25} className="h-4 w-4" />
            Filter{activeCount > 0 && ` (${activeCount})`}
          </button>
          <label className="relative inline-flex shrink-0 items-center">
            <span className="sr-only">Sort products</span>
            <select
              value={sort}
              onChange={(e) => update({ sort: e.target.value === 'featured' ? null : e.target.value })}
              className="cursor-pointer appearance-none bg-transparent pr-5 text-[0.7rem] font-medium font-mono uppercase tracking-[0.1em] focus:outline-none"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            <ChevronDown strokeWidth={1.25} className="pointer-events-none absolute right-0 h-3.5 w-3.5" aria-hidden />
          </label>
          <p className="hidden shrink-0 text-xs tabular-nums text-graphite md:block" aria-live="polite">
            {catalogue.loading || (catalogue.error && results.length === 0) ? '—' : `${catalogue.total} ${catalogue.total === 1 ? 'piece' : 'pieces'}`}
          </p>
        </div>

        {/* Desktop inline filter panel */}
        <AnimatePresence initial={false}>
          {filtersOpen && isDesktop && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="overflow-hidden border-t border-rule"
            >
              <div className="site-container py-8">{filterBody}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile filter sheet */}
      <AnimatePresence>
        {filtersOpen && !isDesktop && (
          <>
            <motion.div className="fixed inset-0 z-[75] bg-ink/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setFiltersOpen(false)} aria-hidden />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Filters"
              className="fixed inset-x-0 bottom-0 z-[76] max-h-[85svh] overflow-y-auto bg-paper"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.55, ease: EASE }}
            >
              <div className="sticky top-0 flex items-center justify-between border-b border-rule bg-paper px-4 py-4">
                <p className="text-[0.72rem] font-medium font-mono uppercase tracking-[0.1em]">Filter</p>
                <button type="button" autoFocus onClick={() => setFiltersOpen(false)} aria-label="Close filters" className="-mr-2 flex h-10 w-10 items-center justify-center">
                  <X strokeWidth={1.25} className="h-5 w-5" />
                </button>
              </div>
              <div className="px-4 py-6">{filterBody}</div>
              <div className="sticky bottom-0 grid grid-cols-2 gap-3 border-t border-rule bg-paper px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
                <Button variant="outline" onClick={clearAll}>Clear</Button>
                <Button onClick={() => setFiltersOpen(false)}>{catalogue.loading ? 'View' : `View ${catalogue.total}`}</Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <section aria-label="Products" className="site-container pb-24 pt-8 md:pb-36 md:pt-10">
        {activeCount > 0 && (
          <div className="mb-8 flex flex-wrap items-center gap-2">
            {q && (
              <Chip active onClick={() => { setQuery(''); update({ q: null }); }} label={`Remove search ${q}`}>
                “{q}” <X strokeWidth={1.5} className="h-3 w-3" />
              </Chip>
            )}
            {[...fits.map((v) => ['fit', v, fits] as const), ...colors.map((v) => ['color', v, colors] as const), ...sizes.map((v) => ['size', v, sizes] as const)].map(([k, v, cur]) => (
              <Chip key={`${k}-${v}`} active onClick={() => toggle(k, v, [...cur])} label={`Remove filter ${v}`}>
                {k === 'fit' ? (v === 'oversized' ? 'Oversized' : 'Regular') : k === 'size' ? sizeLabel(v) : v} <X strokeWidth={1.5} className="h-3 w-3" />
              </Chip>
            ))}
            <button type="button" onClick={clearAll} className="link-underline ml-2 text-[0.68rem] font-mono uppercase tracking-[0.1em] text-graphite hover:text-ink">
              Clear all
            </button>
          </div>
        )}

        {catalogue.loading ? (
          <ProductGridSkeleton />
        ) : catalogue.error && results.length === 0 ? (
          <CatalogueError error={catalogue.error} onRetry={catalogue.retry} />
        ) : results.length > 0 ? (
          <div className={cx('transition-opacity duration-300', catalogue.refreshing && 'opacity-50')} aria-busy={catalogue.refreshing}>
            <ProductGrid products={results} />
            {catalogue.error && (
              <p role="alert" className="mt-8 text-center text-xs text-graphite">
                Couldn’t load more.{' '}
                <button type="button" onClick={catalogue.retry} className="link-underline text-ink">Try again</button>
              </p>
            )}
            {catalogue.hasMore && !catalogue.error && (
              <div className="mt-12 flex justify-center">
                <Button variant="outline" onClick={catalogue.loadMore} disabled={catalogue.loadingMore}>
                  {catalogue.loadingMore ? 'Loading…' : `Load more (${catalogue.total - results.length})`}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center border border-dashed border-rule px-6 py-24 text-center">
            <p className="display text-4xl md:text-[2.6rem]">Nothing quite matches.</p>
            <p className="mt-4 max-w-sm text-sm text-graphite">
              Try removing a filter or searching for a fit or colour — “oversized”, “noir” or “sand”.
            </p>
            <div className="mt-8">
              <Button variant="outline" onClick={clearAll}>Clear filters</Button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
