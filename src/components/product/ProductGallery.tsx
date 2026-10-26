import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { ProductImage } from '@/data/products';
import { useScrollLock } from '@/lib/SmoothScroll';
import { EASE } from '@/lib/motion';
import { cx } from '@/lib/format';
import { sized, srcSetFor } from '@/lib/api';

/**
 * Desktop: editorial two-column image stack.
 * Mobile/tablet: native swipeable scroll-snap carousel with a counter.
 * Any image opens a full-screen viewer with keyboard navigation.
 */
export function ProductGallery({ images, name }: { images: ProductImage[]; name: string }) {
  const [active, setActive] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  useScrollLock(viewer !== null);

  useEffect(() => {
    setActive(0);
    trackRef.current?.scrollTo({ left: 0 });
  }, [images]);

  const onTrackScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    setActive(Math.round(el.scrollLeft / el.clientWidth));
  };

  const goTo = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  useEffect(() => {
    if (viewer === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setViewer(null);
      if (e.key === 'ArrowRight') setViewer((v) => (v === null ? v : (v + 1) % images.length));
      if (e.key === 'ArrowLeft') setViewer((v) => (v === null ? v : (v - 1 + images.length) % images.length));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewer, images.length]);

  return (
    <>
      {/* Mobile carousel */}
      <div className="relative lg:hidden">
        <div
          ref={trackRef}
          onScroll={onTrackScroll}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
          aria-roledescription="carousel"
          aria-label={`${name} images`}
        >
          {images.map((img, i) => (
            <button
              key={img.src}
              type="button"
              onClick={() => setViewer(i)}
              className="relative aspect-[4/5] w-full shrink-0 snap-center bg-card"
              aria-label={`View image ${i + 1} of ${images.length} full screen`}
            >
              <img src={sized(img.src, 960)} srcSet={srcSetFor(img.src, 960, null)} sizes="100vw" alt={img.alt} loading={i === 0 ? 'eager' : 'lazy'} decoding="async" className="absolute inset-0 h-full w-full object-cover" />
            </button>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex items-center justify-center gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to image ${i + 1}`}
              aria-current={active === i}
              className={cx('pointer-events-auto h-[3px] transition-all duration-500 ease-editorial', active === i ? 'w-8 bg-ink' : 'w-4 bg-ink/25')}
            />
          ))}
        </div>
        <p className="absolute right-4 top-4 bg-paper/85 px-2 py-1 text-[0.62rem] font-medium tabular-nums font-mono tracking-[0.06em]">
          {active + 1} / {images.length}
        </p>
      </div>

      {/* Desktop editorial stack */}
      <div className="hidden grid-cols-2 gap-2 lg:grid">
        {images.map((img, i) => (
          <motion.button
            key={img.src}
            type="button"
            onClick={() => setViewer(i)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, ease: EASE, delay: i * 0.08 }}
            className={cx('group relative cursor-zoom-in overflow-hidden bg-card', i === 0 || (images.length % 2 === 0 && i === images.length - 1 && images.length > 2) ? 'col-span-2 aspect-[4/5] xl:aspect-[5/6]' : 'aspect-[4/5]')}
            aria-label={`View image ${i + 1} of ${images.length} full screen`}
          >
            <img
              src={sized(img.src, 1280)}
              srcSet={srcSetFor(img.src)}
              sizes={i === 0 ? '(min-width: 1024px) 55vw, 100vw' : '(min-width: 1024px) 28vw, 50vw'}
              alt={img.alt}
              loading={i < 2 ? 'eager' : 'lazy'}
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.6s] ease-editorial group-hover:scale-[1.03]"
            />
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {viewer !== null && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`${name} image viewer`}
            className="fixed inset-0 z-[95] flex items-center justify-center bg-paper"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <AnimatePresence mode="wait">
              <motion.img
                key={images[viewer].src}
                src={images[viewer].src}
                alt={images[viewer].alt}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="max-h-[92svh] max-w-[94vw] object-contain"
              />
            </AnimatePresence>
            <button type="button" autoFocus onClick={() => setViewer(null)} aria-label="Close viewer" className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center bg-paper/80">
              <X strokeWidth={1.25} className="h-5 w-5" />
            </button>
            {images.length > 1 && (
              <>
                <button type="button" onClick={() => setViewer((viewer - 1 + images.length) % images.length)} aria-label="Previous image" className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center bg-paper/80">
                  <ChevronLeft strokeWidth={1.25} className="h-5 w-5" />
                </button>
                <button type="button" onClick={() => setViewer((viewer + 1) % images.length)} aria-label="Next image" className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center bg-paper/80">
                  <ChevronRight strokeWidth={1.25} className="h-5 w-5" />
                </button>
              </>
            )}
            <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-[0.65rem] font-medium tabular-nums font-mono tracking-[0.06em]">
              {viewer + 1} / {images.length}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
