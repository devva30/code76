import { useRef, useState } from 'react';
import { useProductDetail } from '@/lib/catalogue';
import { img, useContent } from '@/store/SiteContent';
import { ButtonLink } from '@/components/ui/Button';
import { RevealLines } from '@/components/ui/Reveal';
import { ScrollTrigger, useGsap } from '@/lib/motion';
import { cx, formatPrice } from '@/lib/format';
import { PHONE_SIZES, sized, srcSetFor } from '@/lib/api';

/**
 * Signature product story. On desktop the image column stays put (CSS sticky —
 * no scroll hijacking) while three short chapters scroll past and swap the view.
 */
export function SignatureProduct() {
  const c = useContent('home.signature');
  const CHAPTERS = c.chapters;
  const { product, notFound } = useProductDetail(c.productSlug);
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

  useGsap(ref, (mm, el) => {
    mm.add({ desktop: '(min-width: 1024px)', mobile: '(max-width: 1023px)' }, (ctx) => {
      const line = ctx.conditions?.desktop ? '60%' : '78%';
      el.querySelectorAll<HTMLElement>('[data-chapter]').forEach((ch, i) => {
        ScrollTrigger.create({
          trigger: ch,
          start: `top ${line}`,
          end: `bottom ${line}`,
          onToggle: (self) => self.isActive && setActive(i),
        });
      });
    });
  });

  // The chosen tee was removed or hidden: leave the section out rather than show a broken one.
  if (notFound || !CHAPTERS.length) return null;

  return (
    <section ref={ref} aria-labelledby="signature-title" className="site-container py-24 md:py-36">
      <div className="mb-14 flex flex-col gap-4 md:mb-20 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow mb-5 flex items-center gap-3">
            <span>{c.eyebrow}</span>
          </p>
          <RevealLines id="signature-title" as="h2" lines={[c.line1, <span className="italic">{c.line2}</span>]} className="display text-[11.1vw] leading-[1.04] sm:text-6xl lg:text-[5.88vw] 2xl:text-[5.88rem]" />
        </div>
        {product && (
          <p className="font-mono text-xs uppercase tracking-[0.06em] text-graphite md:text-right">
            {product.fitLabel} · {product.colorways.length} colours
            <br />
            <span className="mt-1 inline-block text-base tracking-normal text-ink">{formatPrice(product.price)}</span>
          </p>
        )}
      </div>

      <div className="grid gap-0 lg:grid-cols-12 lg:gap-8">
        {/* Sticky image stage — pinned while the chapters scroll past */}
        <div className="sticky top-[calc(var(--header-h)+8px)] z-10 self-start bg-paper pb-3 lg:static lg:col-span-7 lg:self-stretch lg:bg-transparent lg:pb-0">
          <div className="lg:sticky lg:top-[calc(var(--header-h)+24px)]">
            <div className="relative h-[46svh] overflow-hidden border-[1.5px] border-ink bg-card lg:aspect-[4/5] lg:h-auto lg:max-h-[calc(100svh-var(--header-h)-64px)]">
              {CHAPTERS.map((c, i) => (
                <img decoding="async"
                  key={i}
                  src={sized(img(c.image), 1280)}
                  srcSet={srcSetFor(img(c.image))}
                  sizes={`${PHONE_SIZES}, (min-width: 1024px) 55vw, 100vw`}
                  alt={c.alt}
                  loading="lazy"
                  className={cx(
                    'absolute inset-0 h-full w-full object-cover transition-[clip-path,transform] duration-[1.2s] ease-editorial',
                    i === active ? 'scale-100 [clip-path:inset(0_0_0_0)]' : i < active ? 'scale-105 [clip-path:inset(0_0_0_0)]' : 'scale-105 [clip-path:inset(100%_0_0_0)]',
                  )}
                  style={{ zIndex: i }}
                />
              ))}
              <div className="absolute bottom-4 left-4 z-10 flex gap-2">
                {CHAPTERS.map((c, i) => (
                  <span
                    key={i}
                    className={cx(
                      'bg-paper/90 px-2 py-1 text-[0.6rem] font-medium font-mono uppercase tracking-[0.1em] transition-opacity duration-500',
                      i === active ? 'opacity-100' : 'opacity-50',
                    )}
                  >
                    {c.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Chapters */}
        <div className="lg:col-span-4 lg:col-start-9">
          {CHAPTERS.map((c, i) => (
            <div
              key={i}
              data-chapter
              className={cx(
                'flex min-h-[46vh] flex-col justify-center py-8 transition-opacity duration-700 lg:min-h-[62vh] lg:py-0',
                i === active ? 'opacity-100' : 'opacity-30',
              )}
            >
              <p className="text-[0.65rem] font-medium font-mono uppercase tracking-[0.1em] text-graphite">
                {c.label}
              </p>
              <h3 className="display mt-4 text-4xl leading-[1.02] md:text-[2.6rem]">{c.title}</h3>
              <p className="mt-5 max-w-sm text-sm leading-relaxed text-graphite">{c.body}</p>
            </div>
          ))}
          <div className="border-t border-rule pt-8 pb-[8vh] lg:pb-[18vh]">
            {product && <p className="max-w-sm text-sm leading-relaxed text-graphite">{product.description}</p>}
            <div className="mt-8">
              <ButtonLink to={`/product/${c.productSlug}`} arrow>{c.ctaLabel}</ButtonLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
