import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { Product } from '@/data/products';
import { ProductCard } from './ProductCard';
import { gsap, MQ, useGsap } from '@/lib/motion';
import { cx } from '@/lib/format';

/**
 * Horizontal product rail: native swipe on touch, drag-to-scroll with a mouse,
 * arrow buttons and a live progress rule. Vertical page scrolling is untouched.
 */
export function ProductCarousel({ products, label }: { products: Product[]; label: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [edges, setEdges] = useState({ start: true, end: false });
  const [current, setCurrent] = useState(1);
  const drag = useRef({ active: false, moved: false, startX: 0, startLeft: 0 });

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const p = max > 0 ? el.scrollLeft / max : 0;
    setProgress(p);
    setEdges({ start: el.scrollLeft < 4, end: el.scrollLeft > max - 4 });
    const card = el.querySelector<HTMLElement>('[data-product-card]');
    const step = card ? card.offsetWidth + parseFloat(getComputedStyle(el).columnGap || '0') : el.clientWidth;
    setCurrent(Math.min(products.length, Math.round(el.scrollLeft / step) + 1));
  }, [products.length]);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const page = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('[data-product-card]');
    const step = card ? card.offsetWidth + 20 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step * Math.max(1, Math.floor(el.clientWidth / step)), behavior: 'smooth' });
  };

  // Mouse drag-to-scroll (touch already scrolls natively).
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || !trackRef.current) return;
    drag.current = { active: true, moved: false, startX: e.clientX, startLeft: trackRef.current.scrollLeft };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active || !trackRef.current) return;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > 5 && !d.moved) {
      d.moved = true;
      trackRef.current.setPointerCapture(e.pointerId);
      trackRef.current.style.scrollSnapType = 'none';
    }
    if (d.moved) trackRef.current.scrollLeft = d.startLeft - dx;
  };
  const endDrag = () => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    if (trackRef.current) trackRef.current.style.scrollSnapType = '';
    // Swallow the click that follows a drag so cards don't open accidentally.
    if (d.moved) window.setTimeout(() => (drag.current.moved = false), 0);
  };

  useGsap(wrapRef, (mm, el) => {
    mm.add(MQ.anyMotion, () => {
      gsap.fromTo(
        el.querySelectorAll('[data-product-card]'),
        { autoAlpha: 0, x: 60 },
        { autoAlpha: 1, x: 0, duration: 1.1, stagger: 0.08, ease: 'power3.out', clearProps: 'transform', scrollTrigger: { trigger: el, start: 'top 85%', once: true } },
      );
    });
  });

  return (
    <div ref={wrapRef}>
      <div
        ref={trackRef}
        onScroll={measure}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
        onClickCapture={(e) => {
          if (drag.current.moved) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        role="region"
        aria-roledescription="carousel"
        aria-label={label}
        tabIndex={0}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 pt-1 sm:-mx-6 sm:scroll-px-6 sm:gap-5 sm:px-6 lg:-mx-10 lg:scroll-px-10 lg:px-10 lg:[cursor:grab] 2xl:-mx-14 2xl:scroll-px-14 2xl:px-14"
      >
        {products.map((p, i) => (
          <ProductCard
            key={p.slug}
            product={p}
            index={i}
            priority={i < 2}
            className="w-[70vw] shrink-0 snap-start sm:w-[42vw] md:w-[34vw] lg:w-[calc((100vw-80px-60px)/4.3)] 2xl:w-[calc((min(100vw,1600px)-112px-60px)/4.3)]"
          />
        ))}
      </div>

      <div className="mt-8 flex items-center gap-5">
        <span className="font-mono text-[0.7rem] tabular-nums text-graphite">
          <span className="text-ink">{String(current).padStart(2, '0')}</span> / {String(products.length).padStart(2, '0')}
        </span>
        <div className="relative h-[2px] flex-1 bg-rule" aria-hidden>
          <div className="absolute inset-y-0 left-0 w-[22%] bg-ink transition-transform duration-150" style={{ transform: `translateX(${progress * (100 / 0.22 - 100)}%)` }} />
        </div>
        <div className="flex gap-2">
          {([-1, 1] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              onClick={() => page(dir)}
              disabled={dir === -1 ? edges.start : edges.end}
              aria-label={dir === -1 ? 'Previous products' : 'Next products'}
              className={cx(
                'press flex h-10 w-10 items-center justify-center border-[1.5px] border-ink text-ink transition-colors hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-30',
              )}
            >
              {dir === -1 ? <ArrowLeft strokeWidth={1.75} className="h-4 w-4" /> : <ArrowRight strokeWidth={1.75} className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
