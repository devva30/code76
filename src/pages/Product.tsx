import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, Ruler, X } from 'lucide-react';
import { getColorway, sizeLabel, type Fit, type Size } from '@/data/products';
import { useFeaturedProducts, useProductDetail } from '@/lib/catalogue';
import { useShop } from '@/store/ShopContext';
import { ProductGallery } from '@/components/product/ProductGallery';
import { ProductGrid } from '@/components/product/ProductGrid';
import { CatalogueError, ProductGridSkeleton } from '@/components/product/CatalogueStates';
import { ColorSwatches, SizeSelector } from '@/components/ui/Selectors';
import { AccordionItem } from '@/components/ui/Accordion';
import { Button } from '@/components/ui/Button';
import { useScrollLock } from '@/lib/SmoothScroll';
import { EASE } from '@/lib/motion';
import { BRAND } from '@/config/brand';
import { cx, discountPercent, formatPrice } from '@/lib/format';
import { useContent, useFill } from '@/store/SiteContent';
import NotFound from './NotFound';
import { sized } from '@/lib/api';

/** Size guide drawer. Measurements and advice are edited in Admin → Website content → Size guide. */
function SizeGuide({ open, onClose, fit }: { open: boolean; onClose: () => void; fit: Fit }) {
  const guide = useContent('product.sizeGuide');
  const rows = fit === 'oversized' ? guide.oversized : guide.regular;
  const advice = fit === 'oversized' ? guide.oversizedAdvice : guide.regularAdvice;
  useScrollLock(open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-[85] bg-ink/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="size-guide-title"
            className="fixed inset-x-0 bottom-0 z-[86] max-h-[88svh] overflow-y-auto bg-paper p-6 sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:max-h-none sm:w-[480px] sm:p-10"
            data-lenis-prevent
            initial={{ y: '100%', x: 0 }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="eyebrow mb-3">Size guide</p>
                <h2 id="size-guide-title" className="display text-4xl">{fit === 'oversized' ? 'Oversized fit' : 'Regular fit'}</h2>
              </div>
              <button type="button" autoFocus onClick={onClose} aria-label="Close size guide" className="-mr-2 flex h-10 w-10 items-center justify-center">
                <X strokeWidth={1.25} className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-graphite">
              {guide.intro}
            </p>
            <table className="mt-8 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink text-[0.65rem] font-mono uppercase tracking-[0.1em]">
                  <th className="py-3 font-medium">Size</th>
                  <th className="py-3 font-medium">Chest</th>
                  <th className="py-3 font-medium">Length</th>
                  <th className="py-3 font-medium">Shoulder</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map((r) => (
                  <tr key={r.size} className="border-b border-rule">
                    <td className="py-3 font-medium">{sizeLabel(r.size as Size)}</td>
                    <td className="py-3">{r.chest}</td>
                    <td className="py-3">{r.length}</td>
                    <td className="py-3">{r.shoulder}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {advice && (
              <div className="mt-8 bg-newsprint p-5 text-sm leading-relaxed">
                <p className="eyebrow mb-2">Fit advice</p>
                {advice}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** Same two-column footprint as the loaded page, so content settles in place. */
function ProductSkeleton() {
  return (
    <div role="status" aria-label="Loading product" className="pt-[calc(var(--header-h)+var(--announce-h))] lg:pt-[calc(var(--header-h)+var(--announce-h)+1.5rem)]">
      <div className="lg:site-container lg:grid lg:grid-cols-12 lg:gap-10 lg:pt-14 xl:gap-16">
        <div className="aspect-[4/5] animate-pulse bg-card lg:col-span-7" />
        <div className="site-container space-y-4 pt-8 lg:col-span-5 lg:px-0 lg:pt-0">
          <div className="h-3 w-24 animate-pulse bg-rule" />
          <div className="h-11 w-4/5 animate-pulse bg-rule" />
          <div className="h-3.5 w-1/2 animate-pulse bg-rule" />
          <div className="h-5 w-28 animate-pulse bg-rule" />
          <div className="!mt-10 h-12 w-full animate-pulse bg-rule" />
        </div>
      </div>
    </div>
  );
}

export default function Product() {
  const { slug = '' } = useParams();
  const detail = useProductDetail(slug);
  const featured = useFeaturedProducts(12);
  const product = detail.product;
  const [params, setParams] = useSearchParams();
  const { addToCart, toggleWishlist, isWished } = useShop();
  const [size, setSize] = useState<Size | null>(null);
  const [sizeError, setSizeError] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const pageText = useContent('product.page');
  const fill = useFill();
  const [showBar, setShowBar] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<HTMLDivElement>(null);

  const colorway = product ? getColorway(product, params.get('color') ?? undefined) : null;

  useEffect(() => {
    if (product) document.title = `${product.name} — ${BRAND.name}`;
    setSize(null);
    setSizeError(false);
  }, [product]);

  useEffect(() => {
    if (window.location.hash === '#size-guide') setGuideOpen(true);
  }, []);

  // Mobile: show a compact add-to-bag bar once the main CTA leaves the viewport.
  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setShowBar(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, [product]);

  if (detail.loading) return <ProductSkeleton />;
  if (detail.error) {
    return (
      <div className="site-container pb-24 pt-[calc(var(--header-h)+var(--announce-h)+3rem)]">
        <CatalogueError error={detail.error} onRetry={detail.retry} title="Couldn’t load this piece." />
      </div>
    );
  }
  if (!product || !colorway) return <NotFound />;

  const soldOut = colorway.soldOut ?? [];
  const off = discountPercent(product.price, product.compareAtPrice);
  const wished = isWished(product.slug);
  const sameFit = (p: typeof product) => Number(p.fit === product.fit);
  const related = featured.products
    .filter((p) => p.slug !== product.slug)
    .sort((a, b) => sameFit(b) - sameFit(a) || a.rank - b.rank)
    .slice(0, 4);

  const selectColor = (id: string) => {
    const next = new URLSearchParams(params);
    if (id === product.colorways[0].id) next.delete('color');
    else next.set('color', id);
    setParams(next, { replace: true, preventScrollReset: true });
    if (size && getColorway(product, id).soldOut?.includes(size)) setSize(null);
  };

  const add = () => {
    if (!size) {
      setSizeError(true);
      sizeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    addToCart(product.slug, colorway.id, size);
  };

  return (
    <>
      <div className="pt-[calc(var(--header-h)+var(--announce-h))] lg:pt-[calc(var(--header-h)+var(--announce-h)+1.5rem)]">
        <div className="site-container">
          <nav aria-label="Breadcrumb" className="hidden py-5 text-[0.68rem] font-mono uppercase tracking-[0.1em] text-graphite lg:block">
            <ol className="flex items-center gap-2">
              <li><Link to="/" className="link-underline">Home</Link></li>
              <li aria-hidden>/</li>
              <li><Link to="/shop" className="link-underline">Shop</Link></li>
              <li aria-hidden>/</li>
              <li aria-current="page" className="text-ink">{product.name}</li>
            </ol>
          </nav>
        </div>

        <div className="lg:site-container lg:grid lg:grid-cols-12 lg:gap-10 xl:gap-16">
          <div className="lg:col-span-7">
            <ProductGallery images={colorway.images} name={`${product.name} in ${colorway.name}`} />
          </div>

          <div className="site-container pt-8 lg:col-span-5 lg:px-0 lg:pt-0">
            <div className="lg:sticky lg:top-[calc(var(--nav-offset,var(--header-h))+2rem)] lg:transition-[top] lg:duration-700">
              <div className="flex items-center gap-3">
                {product.isNew && <span className="stamp-mark">New</span>}
                <span className="eyebrow">{product.fitLabel}</span>
              </div>
              <h1 className="display mt-4 text-[2.6rem] leading-[1.04] md:text-5xl">{product.name}</h1>
              <p className="mt-2 text-sm text-graphite">{product.subtitle}</p>
              <p className="mt-5 flex items-center gap-3 font-mono text-lg tabular-nums">
                {off > 0 && <span className="text-base text-graphite line-through">{formatPrice(product.compareAtPrice!)}</span>}
                <span className={off > 0 ? 'text-stamp' : undefined}>{formatPrice(product.price)}</span>
                {off > 0 && <span className="bg-stamp px-1.5 py-0.5 text-[0.65rem] font-medium text-paper">−{off}%</span>}
              </p>
              {pageText.priceNote && <p className="mt-1 text-xs text-graphite">{fill(pageText.priceNote)}</p>}

              <div className="mt-9 border-t border-rule pt-7">
                <p className="mb-4 text-xs">
                  <span className="eyebrow mr-2">Colour</span>
                  {colorway.name}
                </p>
                <ColorSwatches colorways={product.colorways} value={colorway.id} onChange={selectColor} />
              </div>

              <div ref={sizeRef} className="mt-8" id="size-guide">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-xs">
                    <span className="eyebrow mr-2">Size</span>
                    {size ?? <span className="text-graphite">Select</span>}
                  </p>
                  <button type="button" onClick={() => setGuideOpen(true)} className="inline-flex items-center gap-1.5 text-[0.68rem] font-mono uppercase tracking-[0.1em] text-graphite transition-colors hover:text-ink">
                    <Ruler strokeWidth={1.25} className="h-3.5 w-3.5" /> Size guide
                  </button>
                </div>
                <SizeSelector
                  sizes={product.sizes}
                  soldOut={soldOut}
                  value={size}
                  error={sizeError}
                  onChange={(s) => { setSize(s); setSizeError(false); }}
                />
                <AnimatePresence>
                  {sizeError && (
                    <motion.p role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 text-xs text-[rgb(var(--c-stamp))]">
                      Please select a size to continue.
                    </motion.p>
                  )}
                </AnimatePresence>
                {soldOut.length > 0 && <p className="mt-3 text-xs text-graphite">Sizes crossed out are currently unavailable in {colorway.name}.</p>}
              </div>

              <div ref={ctaRef} className="mt-8 flex gap-2">
                <Button onClick={add} full arrow>
                  {size ? `Add to bag — ${formatPrice(product.price)}` : 'Add to bag'}
                </Button>
                <button
                  type="button"
                  onClick={() => toggleWishlist(product.slug)}
                  aria-pressed={wished}
                  aria-label={wished ? 'Remove from wishlist' : 'Save to wishlist'}
                  className="flex h-12 w-12 shrink-0 items-center justify-center border border-rule transition-colors hover:border-ink"
                >
                  <Heart strokeWidth={1.25} className={cx('h-[1.1rem] w-[1.1rem]', wished && 'fill-ink')} />
                </button>
              </div>
              {pageText.shippingNote && <p className="mt-4 text-xs leading-relaxed text-graphite">{fill(pageText.shippingNote)}</p>}

              <div className="mt-10 border-t border-rule">
                <AccordionItem title="Description" defaultOpen>
                  <p>{product.description}</p>
                </AccordionItem>
                <AccordionItem title="Details">
                  <ul className="list-inside list-disc space-y-1.5 marker:text-rule">
                    {product.details.map((d) => <li key={d}>{d}</li>)}
                  </ul>
                </AccordionItem>
                <AccordionItem title="Fit & sizing">
                  <ul className="list-inside list-disc space-y-1.5 marker:text-rule">
                    {product.fitNotes.map((d) => <li key={d}>{d}</li>)}
                  </ul>
                  <button type="button" onClick={() => setGuideOpen(true)} className="link-underline mt-4 text-[0.68rem] font-mono uppercase tracking-[0.1em] text-ink">
                    View size guide
                  </button>
                </AccordionItem>
                <AccordionItem title="Care">
                  <ul className="list-inside list-disc space-y-1.5 marker:text-rule">
                    {product.care.map((d) => <li key={d}>{d}</li>)}
                  </ul>
                </AccordionItem>
                <AccordionItem title="Shipping & returns">
                  <p className="whitespace-pre-line">{fill(pageText.shippingReturns)}</p>
                  <Link to="/about#shipping" className="mt-3 inline-block underline underline-offset-2">Shipping & returns policy</Link>
                </AccordionItem>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section aria-labelledby="related-title" className="site-container mt-24 border-t border-rule pb-24 pt-14 md:mt-32 md:pb-36">
        <div className="mb-10 flex items-end justify-between">
          <h2 id="related-title" className="display text-4xl md:text-5xl">
            You may <span className="italic">also like</span>
          </h2>
          <Link to="/shop" className="link-static-underline hidden text-[0.7rem] font-medium font-mono uppercase tracking-[0.1em] sm:inline-block">Shop all</Link>
        </div>
        {featured.loading ? (
          <ProductGridSkeleton count={4} />
        ) : featured.error ? (
          <CatalogueError error={featured.error} onRetry={featured.retry} title="Couldn’t load suggestions." />
        ) : (
          <ProductGrid products={related} columns={4} />
        )}
      </section>

      {/* Mobile sticky purchase bar */}
      <AnimatePresence>
        {showBar && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.45, ease: EASE }}
            className="fixed inset-x-0 bottom-[var(--bottom-nav-h)] z-40 border-t border-rule bg-paper px-4 pb-3 pt-3 lg:hidden"
          >
            <div className="flex items-center gap-3">
              <img decoding="async" src={sized(colorway.images[0].src, 320)} alt="" className="h-12 w-10 object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{product.name}</p>
                <p className="text-xs text-graphite">{colorway.name}{size ? ` · ${size}` : ''} · {formatPrice(product.price)}</p>
              </div>
              <Button onClick={add} className="h-11 px-5">{size ? 'Add to bag' : 'Select size'}</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SizeGuide open={guideOpen} onClose={() => setGuideOpen(false)} fit={product.fit} />
    </>
  );
}
