import { ArrowRight } from 'lucide-react';
import { EditorialImage } from '@/components/ui/EditorialImage';
import { FadeUp, RevealLines } from '@/components/ui/Reveal';
import { cx } from '@/lib/format';
import { PHONE_SIZES } from '@/lib/api';
import { Screentone } from '@/components/ui/PrintMarks';
import { SiteLink } from '@/components/ui/SiteLink';
import { img, useContent } from '@/store/SiteContent';

export function ShopByFit() {
  const c = useContent('home.shopByFit');
  return (
    <section aria-labelledby="fit-title" className="relative overflow-hidden bg-newsprint py-24 md:py-36">
      <Screentone className="left-0 top-0 h-80 w-1/2" fade="to-right" />
      <div className="site-container relative">
        <div className="mb-14 grid gap-6 md:mb-20 md:grid-cols-2 md:items-end">
          <div>
            <p className="eyebrow mb-5 flex items-center gap-3">
              <span>{c.eyebrow}</span>
            </p>
            <RevealLines id="fit-title" as="h2" lines={[c.line1, <span className="italic">{c.line2}</span>]} className="display text-[8.14vw] sm:text-5xl lg:text-6xl" />
          </div>
          <FadeUp as="p" className="max-w-sm text-sm leading-relaxed text-graphite md:justify-self-end">
            {c.intro}
          </FadeUp>
        </div>

        <div className="grid gap-16 md:grid-cols-12 md:gap-8">
          {c.cards.map((p, i) => (
            <SiteLink
              key={i}
              to={p.link}
              className={cx('group block', i % 2 === 0 ? 'md:col-span-6 lg:col-span-6' : 'md:col-span-5 md:col-start-8 md:mt-40')}
            >
              <div className="relative">
                <EditorialImage
                  src={img(p.image)}
                  alt={p.alt}
                  ratio="4 / 5"
                  reveal={i % 2 === 0 ? 'left' : 'right'}
                  imgClassName="transition-transform duration-[1.8s] ease-editorial group-hover:scale-[1.04]"
                  sizes={`${PHONE_SIZES}, (min-width: 768px) 45vw, 100vw`}
                />
                {p.badge && (
                  <span className="absolute left-4 top-4 border border-ink bg-paper px-2 py-1 font-mono text-[0.62rem] font-medium uppercase tracking-[0.1em]">{p.badge}</span>
                )}
              </div>
              <div className="mt-7 flex items-start justify-between gap-6">
                <div>
                  <h3 className="display text-[2.6rem] md:text-5xl">{p.title}</h3>
                  <p className="mt-4 max-w-sm text-sm leading-relaxed text-graphite">{p.copy}</p>
                </div>
              </div>
              <span className="mt-6 inline-flex items-center gap-3 text-[0.72rem] font-medium font-mono uppercase tracking-[0.1em]">
                <span className="link-static-underline">{p.ctaLabel}</span>
                <ArrowRight strokeWidth={1.25} className="h-4 w-4 transition-transform duration-500 ease-editorial group-hover:translate-x-1" />
              </span>
            </SiteLink>
          ))}
        </div>
      </div>
    </section>
  );
}
