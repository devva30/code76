import { useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { useProductList } from '@/lib/catalogue';
import { ProductGrid } from '@/components/product/ProductGrid';
import { CatalogueError, ProductGridSkeleton } from '@/components/product/CatalogueStates';
import { SiteLink } from '@/components/ui/SiteLink';
import { useCountdown } from '@/components/home/OfferBanner';
import { BRAND } from '@/config/brand';
import { useContent, useFill } from '@/store/SiteContent';

/** Products appear on this page when the "Offers" collection is ticked on them in Admin → Products. */
export const OFFERS_COLLECTION = 'offers';

const pad = (n: number) => String(n).padStart(2, '0');

export default function Offers() {
  const page = useContent('page.offers');
  const deal = useContent('home.offer');
  const fill = useFill();
  const left = useCountdown(deal.endsOn);
  const list = useProductList({ collection: OFFERS_COLLECTION, q: '', fits: [], colors: [], sizes: [], sort: 'featured' });

  useEffect(() => {
    document.title = `${page.line1} — ${BRAND.name}`;
  }, [page.line1]);

  return (
    <>
      <section className="relative overflow-hidden bg-night text-white">
        <div aria-hidden className="pointer-events-none absolute -right-32 top-0 h-[480px] w-[480px] rounded-full bg-[radial-gradient(closest-side,rgb(212_175_92_/_0.2),transparent)]" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgb(var(--c-gold)) 0 1px, transparent 1px 14px)' }}
        />
        <div className="site-container relative grid items-end gap-10 pb-16 pt-[calc(var(--header-h)+var(--announce-h)+4rem)] md:pb-20 lg:grid-cols-12">
          <div className="lg:col-span-8">
            {page.eyebrow && <p className="mb-5 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-gold">{page.eyebrow}</p>}
            <h1 className="display text-[13vw] leading-[1.02] sm:text-7xl lg:text-[5.5rem]">
              {page.line1}
              {page.line2 && (
                <>
                  {' '}
                  <span className="bg-gradient-to-r from-gold via-[#F1D892] to-gold-deep bg-clip-text italic text-transparent">{page.line2}</span>
                </>
              )}
            </h1>
            {page.intro && <p className="mt-6 max-w-xl text-base leading-relaxed text-white/70">{fill(page.intro)}</p>}
            {left && (
              <div className="mt-8 flex flex-wrap items-center gap-3" aria-label="Offer ends in">
                <span className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-white/50">Ends in</span>
                {([['d', left.days], ['h', left.hours], ['m', left.mins], ['s', left.secs]] as const).map(([u, v]) => (
                  <span key={u} className="rounded-md border border-gold/30 bg-white/[0.04] px-3 py-1.5 font-mono text-lg font-semibold tabular-nums text-gold">
                    {pad(v)}
                    <span className="ml-0.5 text-xs text-white/50">{u}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          {deal.bigText && (
            <div className="flex justify-start lg:col-span-4 lg:justify-end">
              <div className="flex h-40 w-40 rotate-[-8deg] flex-col items-center justify-center rounded-full bg-gradient-to-br from-[#F1D892] via-gold to-gold-deep text-center text-night shadow-[0_25px_60px_-20px_rgba(0,0,0,0.9)]">
                <span className="display text-5xl leading-none">{deal.bigText}</span>
                {deal.bigNote && <span className="mt-2 max-w-[8rem] text-[0.62rem] font-semibold uppercase leading-tight tracking-wide">{fill(deal.bigNote)}</span>}
              </div>
            </div>
          )}
        </div>
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
      </section>

      <section className="site-container py-14 md:py-20" aria-label="Products on offer">
        {list.loading ? (
          <ProductGridSkeleton count={4} />
        ) : list.error ? (
          <CatalogueError error={list.error} onRetry={list.retry} title="Couldn’t load the offers." />
        ) : list.products.length === 0 ? (
          <div className="flex flex-col items-center border border-dashed border-rule px-6 py-20 text-center">
            <p className="display text-3xl md:text-4xl">{page.emptyTitle || 'No offers right now.'}</p>
            {page.emptyBody && <p className="mt-3 max-w-md text-sm text-graphite">{fill(page.emptyBody)}</p>}
            <SiteLink to="/shop" className="mt-8 inline-flex items-center gap-2 rounded-full bg-night px-6 py-3 text-sm font-semibold text-white hover:bg-night/90">
              Shop everything <ArrowRight className="h-4 w-4" />
            </SiteLink>
          </div>
        ) : (
          <>
            <p className="mb-6 font-mono text-xs uppercase tracking-[0.12em] text-graphite">
              {list.total} {list.total === 1 ? 'piece' : 'pieces'} on offer
            </p>
            <ProductGrid products={list.products} />
          </>
        )}
      </section>
    </>
  );
}
