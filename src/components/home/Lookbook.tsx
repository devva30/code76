import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import type { SiteSections } from '@/content/types';
import { img, useContent } from '@/store/SiteContent';

type LookbookFrame = SiteSections['home.lookbook']['frames'][number];
import { ButtonLink } from '@/components/ui/Button';
import { gsap, MQ, ScrollTrigger, useGsap } from '@/lib/motion';
import { cx } from '@/lib/format';
import { PHONE_SIZES, sized, srcSetFor } from '@/lib/api';

/** Frame sizes in viewport height so the asymmetric track works at every screen size. */
const sizeClass: Record<LookbookFrame['size'], string> = {
  tall: 'h-[44vh] aspect-[4/5] lg:h-[56vh]',
  wide: 'h-[30vh] aspect-[3/2] lg:h-[42vh]',
  small: 'h-[28vh] aspect-[3/4] lg:h-[36vh]',
};
const offsetClass: Record<LookbookFrame['offset'], string> = {
  top: 'self-start',
  middle: 'self-center',
  bottom: 'self-end',
};

function Frame({ frame }: { frame: LookbookFrame }) {
  return (
    <figure data-look-frame className={cx('group relative flex shrink-0 flex-col', offsetClass[frame.offset])}>
      <div className={cx('relative overflow-hidden bg-white/5', sizeClass[frame.size])}>
        <img
          data-look-img
          src={sized(img(frame.image), 960)}
          srcSet={srcSetFor(img(frame.image), 1280)}
          sizes={`${PHONE_SIZES}, (min-width: 1024px) 40vw, 80vw`}
          alt={frame.alt}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full scale-110 object-cover transition-transform duration-[1.6s] ease-editorial group-hover:scale-[1.14]"
        />
      </div>
      {/* Caption takes the image's width, never wider. */}
      <figcaption className="mt-3 flex w-0 min-w-full items-start justify-between gap-4 lg:mt-4 lg:gap-6">
        <span className="flex gap-3 lg:gap-4">
          <span className="lede text-base leading-snug md:text-xl">{frame.caption}</span>
        </span>
        {frame.productSlug && (
          <Link
            to={`/product/${frame.productSlug}`}
            className="mt-1 inline-flex shrink-0 items-center gap-1 font-mono text-[0.62rem] font-medium uppercase tracking-[0.1em] text-onband/60 transition-colors hover:text-onband"
          >
            Shop <ArrowUpRight strokeWidth={1.25} className="h-3.5 w-3.5" />
          </Link>
        )}
      </figcaption>
    </figure>
  );
}

/**
 * Editorial lookbook. The section pins briefly and the track moves sideways with
 * scroll on every screen size; reduced-motion visitors get a native swipe row.
 */
export function Lookbook() {
  const c = useContent('home.lookbook');
  const ref = useRef<HTMLElement>(null);

  useGsap(ref, (mm, el) => {
    // Frames move on a transformed track, so native lazy-loading starts too late;
    // begin fetching them shortly before the section arrives.
    ScrollTrigger.create({
      trigger: el,
      start: 'top bottom+=1200',
      once: true,
      onEnter: () => el.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((img) => (img.loading = 'eager')),
    });

    mm.add({ motion: MQ.anyMotion, desktop: '(min-width: 1024px)' }, (ctx) => {
      if (!ctx.conditions?.motion) return;
      const desktop = !!ctx.conditions.desktop;
      const track = el.querySelector<HTMLElement>('[data-look-track]')!;
      const progress = el.querySelector<HTMLElement>('[data-look-progress]');
      const distance = () => track.scrollWidth - window.innerWidth;
      // Phones travel the track in less scroll, with almost no lag, so it never feels stuck.
      const scrollLength = () => distance() * (desktop ? 1 : 0.55);

      const tween = gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top top',
          end: () => `+=${scrollLength()}`,
          pin: true,
          scrub: desktop ? 0.8 : 0.25,
          invalidateOnRefresh: true,
          anticipatePin: 1,
          onUpdate: (self) => progress && gsap.set(progress, { scaleX: self.progress }),
        },
      });

      // Subtle counter-parallax inside each frame while the track moves.
      el.querySelectorAll<HTMLElement>('[data-look-img]').forEach((img) => {
        gsap.fromTo(
          img,
          { xPercent: -6 },
          {
            xPercent: 6,
            ease: 'none',
            scrollTrigger: { trigger: img.parentElement, containerAnimation: tween, start: 'left right', end: 'right left', scrub: 0.6 },
          },
        );
      });
    });
  });

  return (
    <section
      ref={ref}
      aria-labelledby="lookbook-title"
      className="relative h-[100svh] overflow-hidden bg-band text-onband motion-reduce:h-auto motion-reduce:py-20"
    >
      <div className="flex h-full items-center motion-reduce:block">
        <div
          data-look-track
          className="no-scrollbar flex items-stretch gap-6 px-5 py-[calc(var(--header-h)+2vh)] will-change-transform sm:gap-8 sm:px-6 lg:gap-[3.5vw] lg:px-10 motion-safe:overflow-visible motion-reduce:snap-x motion-reduce:snap-mandatory motion-reduce:scroll-px-5 motion-reduce:overflow-x-auto motion-reduce:py-0"
        >
          {/* Intro panel */}
          <div className="flex h-[54vh] w-[76vw] shrink-0 snap-start flex-col justify-between self-center sm:w-[52vw] lg:h-[62vh] lg:w-[26vw]">
            <div>
              <p className="eyebrow mb-6 flex items-center gap-3 !text-onband/60">
                <span>{c.eyebrow}</span>
              </p>
              <h2 id="lookbook-title" className="display text-[12.58vw] leading-[1.04] sm:text-[8vw] lg:text-[5.38vw]">
                {c.line1}
                <br />
                <span className="italic">{c.line2}</span>
              </h2>
            </div>
            <div className="max-w-xs">
              <p className="text-sm leading-relaxed text-onband/60">
                {c.intro}
              </p>
              <p className="mt-6 font-mono text-[0.62rem] font-medium uppercase tracking-[0.1em] text-onband/50 motion-reduce:hidden">Scroll to explore →</p>
            </div>
          </div>

          {c.frames.map((f, i) => (
            <div key={i} className="flex h-[62vh] shrink-0 snap-start lg:h-[68vh]">
              <Frame frame={f} />
            </div>
          ))}

          {/* Outro panel */}
          <div className="flex w-[66vw] shrink-0 snap-start flex-col justify-center self-center sm:w-[40vw] lg:w-[22vw]">
            <p className="display text-4xl leading-tight md:text-[2.6rem]">
              {c.outroLine1}
              <br />
              <span className="italic">{c.outroLine2}</span>
            </p>
            <div className="mt-8">
              {c.ctaLabel && <ButtonLink to={c.ctaLink} variant="light" arrow>{c.ctaLabel}</ButtonLink>}
            </div>
          </div>
        </div>
      </div>

      <div aria-hidden className="absolute inset-x-5 bottom-6 h-px bg-onband/15 motion-reduce:hidden lg:inset-x-10 lg:bottom-8">
        <div data-look-progress className="h-px origin-left scale-x-0 bg-onband" />
      </div>
    </section>
  );
}
