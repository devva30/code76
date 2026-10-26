import { ArrowRight } from 'lucide-react';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { SiteLink } from '@/components/ui/SiteLink';
import { ProductCarousel } from '@/components/product/ProductCarousel';
import { ProductCardSkeleton } from '@/components/product/CatalogueStates';
import { useFeaturedProducts, useProductList } from '@/lib/catalogue';
import { useContent } from '@/store/SiteContent';

export function FeaturedCollection() {
  const c = useContent('home.featured');
  const { products: featured, loading, error, retry } = useFeaturedProducts(c.count);
  // Every product in the store, for "View all {count} pieces".
  const all = useProductList({ collection: 'all', q: '', fits: [], colors: [], sizes: [], sort: 'featured' });
  const label = c.linkLabel.split('{count}').join(all.loading ? '' : String(all.total)).replace(/\s{2,}/g, ' ');
  return (
    <section aria-label="Featured collection" className="site-container overflow-hidden pb-24 pt-10 md:pb-32 md:pt-24">
      <SectionHeading
        eyebrow={c.eyebrow}
        lines={[c.line1, <span className="italic">{c.line2}</span>]}
        aside={
          <div className="space-y-5">
            {c.copy && <p className="text-sm leading-relaxed text-graphite">{c.copy}</p>}
            {c.linkLabel && (
              <SiteLink to={c.linkTo || '/shop'} className="group inline-flex items-center gap-2 text-[0.95rem] font-medium text-gold-deep hover:text-ink">
                {label}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={1.75} />
              </SiteLink>
            )}
          </div>
        }
        className="mb-10 md:mb-14"
      />
      {loading ? (
        <div role="status" aria-label="Loading products" className="flex gap-3 overflow-hidden sm:gap-5">
          {Array.from({ length: 5 }, (_, i) => (
            <ProductCardSkeleton key={i} className="w-[70vw] shrink-0 sm:w-[42vw] md:w-[34vw] lg:w-[calc((100vw-80px-60px)/4.3)] 2xl:w-[calc((min(100vw,1600px)-112px-60px)/4.3)]" />
          ))}
        </div>
      ) : error ? (
        <p role="alert" className="border border-dashed border-rule px-6 py-16 text-center text-sm text-graphite">
          The new drop couldn’t be loaded.{' '}
          <button type="button" onClick={retry} className="link-underline text-ink">Try again</button>
        </p>
      ) : (
        <ProductCarousel products={featured} label={`${c.line1} ${c.line2}`} />
      )}
    </section>
  );
}
