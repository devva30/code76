import { useRef } from 'react';
import type { Product } from '@/data/products';
import { ProductCard } from './ProductCard';
import { gsap, MQ, ScrollTrigger, useGsap } from '@/lib/motion';
import { cx } from '@/lib/format';

/** Product grid with staggered, batched entrances as rows scroll into view. */
export function ProductGrid({ products, columns = 4, className }: { products: Product[]; columns?: 3 | 4; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const key = products.map((p) => p.slug).join('|');

  useGsap(
    ref,
    (mm, el) => {
      mm.add(MQ.anyMotion, () => {
        const cards = el.querySelectorAll('[data-product-card]');
        gsap.set(cards, { autoAlpha: 0, y: 48 });
        ScrollTrigger.batch(cards, {
          start: 'top 92%',
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.1, ease: 'power3.out', overwrite: true, clearProps: 'transform' }),
        });
      });
    },
    [key],
  );

  return (
    <div
      ref={ref}
      className={cx(
        'grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3',
        columns === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3',
        className,
      )}
    >
      {products.map((p, i) => (
        <ProductCard key={p.slug} product={p} index={i} priority={i < 2} sizes={columns === 4 ? '(min-width: 1024px) 24vw, (min-width: 768px) 32vw, 48vw' : '(min-width: 768px) 32vw, 48vw'} />
      ))}
    </div>
  );
}
