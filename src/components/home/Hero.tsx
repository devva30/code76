import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { ButtonLink, TextLink } from '@/components/ui/Button';
import { CropMarks } from '@/components/ui/PrintMarks';
import type { HeroSlideContent } from '@/content/types';
import { img, useContent } from '@/store/SiteContent';
import { BRAND } from '@/config/brand';
import { gsap, MQ, useGsap, useReducedMotion } from '@/lib/motion';
import { isIntroPending, onIntroDone } from '@/lib/intro';
import { cx } from '@/lib/format';
import { srcSetFor } from '@/lib/api';

interface HeroSlide {
  id: string;
  desktop: string;
  mobile: string;
  alt: string;
  eyebrow: [string, string];
  lines: [string, string];
  copy: string;
  cta: { label: string; to: string };
  /** Short, punchy label for the in-photo button on phones. */
  pill: string;
  secondary?: { label: string; to: string };
  /** Text colour on desktop, chosen for the calm area of each photograph. */
  tone: 'ink' | 'paper';
  align: 'left' | 'right';
  vAlign: 'top' | 'bottom';
  /** Adds a soft shade behind light text where the photo is busy. */
  scrim?: boolean;
  fit?: 'auto' | 'cover' | 'contain';
  position: string;
  mobilePosition: string;
}

const INTERVAL = 5000;
const pad = (n: number) => String(n).padStart(2, '0');
/** Ken Burns zoom: each slide eases from 100% to 110% while it is shown. */
const ZOOM = 1.06;
const ZOOM_TIME = 7.5;

function SlideCopy({ slide, index, active }: { slide: HeroSlide; index: number; active: boolean }) {
  const light = slide.tone === 'paper';
  return (
    <div
      data-copy={index}
      aria-hidden={!active}
      {...(!active ? { inert: '' } : {})}
      className={cx(
        'col-start-1 row-start-1 flex flex-col',
        // Desktop placement follows the calm area of each photograph.
        slide.vAlign === 'top' ? 'lg:justify-start' : 'lg:justify-end',
        slide.align === 'right' && 'lg:items-end lg:text-right',
        light ? 'lg:text-paper' : 'lg:text-ink',
        !active && 'invisible',
      )}
    >
      {(slide.eyebrow[0] || slide.eyebrow[1]) && (
        <p data-fade className={cx('eyebrow mb-5 flex items-center gap-3 lg:mb-6', light && 'lg:!text-paper/75')}>
          <span className={light ? 'text-ink lg:text-paper' : 'text-ink'}>{slide.eyebrow[0]}</span>
          <span aria-hidden className={cx('h-px w-8 bg-ink/30', light && 'lg:bg-paper/40')} />
          <span>{slide.eyebrow[1]}</span>
        </p>
      )}
      {slide.lines.some(Boolean) && (
        <h2 className="display text-[10vw] leading-[1.04] sm:text-[8vw] lg:text-[5vw] 2xl:text-[5.4rem]">
          {slide.lines.filter(Boolean).map((line, i) => (
            <span key={i} data-line className="reveal-line">
              <span className={i === 1 ? 'italic' : undefined}>{line}</span>
            </span>
          ))}
        </h2>
      )}
      {slide.copy && (
        <p data-fade className={cx('mt-6 max-w-sm text-base leading-relaxed text-ink/80 md:text-lg', light && 'lg:text-paper/85')}>
          {slide.copy}
        </p>
      )}
      <div data-fade className={cx(slide.lines.some(Boolean) || slide.copy ? 'mt-7' : '', 'flex flex-wrap items-center gap-x-8 gap-y-4', slide.align === 'right' && 'lg:justify-end')}>
        <ButtonLink to={slide.cta.to} arrow className={light ? 'lg:!bg-paper lg:!text-ink' : undefined}>
          {slide.cta.label}
        </ButtonLink>
        {slide.secondary && <TextLink to={slide.secondary.to}>{slide.secondary.label}</TextLink>}
      </div>
    </div>
  );
}

/** Admin-edited slide (Website content → Banner slideshow) in the shape the slideshow draws. */
function toSlide(c: HeroSlideContent, i: number): HeroSlide {
  return {
    id: `slide-${i}`,
    desktop: img(c.image),
    mobile: img(c.mobileImage || c.image),
    alt: c.alt,
    eyebrow: [c.eyebrowLeft, c.eyebrowRight],
    lines: [c.line1, c.line2],
    copy: c.copy,
    cta: { label: c.ctaLabel, to: c.ctaLink },
    pill: c.pill || c.ctaLabel,
    secondary: c.secondaryLabel && c.secondaryLink ? { label: c.secondaryLabel, to: c.secondaryLink } : undefined,
    tone: c.tone,
    align: c.align,
    vAlign: c.vAlign,
    scrim: c.scrim,
    fit: c.fit,
    position: c.position || '50% 50%',
    mobilePosition: c.mobilePosition || c.position || '50% 50%',
  };
}

export function Hero() {
  const { slides } = useContent('home.hero');
  if (!slides.length) return null;
  return <Slideshow heroSlides={slides.map(toSlide)} />;
}

/**
 * Campaign slideshow. Slides advance every 5 seconds with a wipe-and-settle
 * transition; autoplay pauses on hover, focus, a hidden tab, off-screen, or on demand.
 * Below `lg`, copy sits beneath the image so text never covers a subject.
 */
function Slideshow({ heroSlides }: { heroSlides: HeroSlide[] }) {
  const COUNT = heroSlides.length;
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [cycle, setCycle] = useState(0);
  const prev = useRef(0);
  const direction = useRef<1 | -1>(1);
  const reduced = useReducedMotion();

  // Reduced-motion visitors never get autoplay; everyone else pauses on hover/focus.
  const userPaused = reduced;
  const [hovering, setHovering] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [hiddenTab, setHiddenTab] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const [introPending, setIntroPending] = useState(isIntroPending);
  const paused = userPaused || hovering || focusWithin || hiddenTab || offscreen || introPending;

  const go = useCallback((to: number, dir: 1 | -1) => {
    direction.current = dir;
    setActive((cur) => {
      prev.current = cur;
      return ((to % COUNT) + COUNT) % COUNT;
    });
    setCycle((c) => c + 1);
  }, [COUNT]);
  const next = useCallback(() => go(active + 1, 1), [active, go]);
  const previous = useCallback(() => go(active - 1, -1), [active, go]);

  useEffect(() => onIntroDone(() => setIntroPending(false)), []);

  // Photos allowed to download: the first slide straight away, each following one shortly before it
  // shows, so the opening photo never shares a slow connection with photos nobody is looking at yet.
  const [warm, setWarm] = useState<ReadonlySet<number>>(() => new Set([0]));
  useEffect(() => {
    const t = window.setTimeout(() => {
      setWarm((w) => (w.has(active) && w.has((active + 1) % COUNT) ? w : new Set([...w, active, (active + 1) % COUNT])));
    }, active === 0 && cycle === 0 ? 2500 : 0);
    return () => window.clearTimeout(t);
  }, [active, cycle, COUNT]);

  // Tall photos in a wide banner would lose their top and bottom, so (unless the slide says otherwise)
  // they are shown whole, fading into matte black at the sides. Shapes are read from the loaded file.
  const mediaRef = useRef<HTMLDivElement>(null);
  const [frameRatio, setFrameRatio] = useState(16 / 9);
  const [shapes, setShapes] = useState<Record<number, number>>({});
  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (height) setFrameRatio(width / height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const measure = useCallback((i: number, img: HTMLImageElement | null) => {
    if (!img?.complete || !img.naturalHeight) return;
    const r = img.naturalWidth / img.naturalHeight;
    setShapes((s) => (Math.abs((s[i] ?? 0) - r) < 0.01 ? s : { ...s, [i]: r }));
  }, []);
  const showWhole = (s: HeroSlide, i: number) =>
    s.fit === 'contain' || (s.fit !== 'cover' && shapes[i] !== undefined && shapes[i] < frameRatio * 0.72);

  useEffect(() => {
    const onVis = () => setHiddenTab(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    const io = new IntersectionObserver(([e]) => setOffscreen(!e.isIntersecting), { threshold: 0.2 });
    if (ref.current) io.observe(ref.current);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      io.disconnect();
    };
  }, []);

  // Reduced motion has no progress animation, so advance with a plain timer instead.
  useEffect(() => {
    if (!reduced || paused) return;
    const t = window.setTimeout(next, INTERVAL);
    return () => window.clearTimeout(t);
  }, [reduced, paused, next, cycle]);

  // First-slide entrance + scroll parallax.
  useGsap(ref, (mm, el) => {
    const q = gsap.utils.selector(el);
    mm.add(MQ.anyMotion, () => {
      const tl = gsap.timeline({ paused: isIntroPending(), defaults: { ease: 'expo.out' } });
      tl.fromTo(q('[data-media]'), { clipPath: 'inset(12% 8% 12% 8%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.8, ease: 'expo.inOut' })
        .fromTo(q('[data-slide="0"] img'), { scale: 1 }, { scale: ZOOM, duration: ZOOM_TIME, ease: 'none' }, 0)
        .fromTo(q('[data-copy="0"] [data-line] > span'), { yPercent: 115 }, { yPercent: 0, duration: 1.4, stagger: 0.12 }, 0.75)
        .fromTo(q('[data-copy="0"] [data-fade], [data-controls]'), { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 1.2, stagger: 0.1 }, 1.15);
      return onIntroDone(() => tl.play());
    });
    // Scroll parallax on the photograph at every screen size.
    mm.add(MQ.anyMotion, () => {
      gsap.to(q('[data-parallax]'), {
        yPercent: 12,
        ease: 'none',
        scrollTrigger: { trigger: q('[data-media]')[0], start: 'top top', end: 'bottom top', scrub: 0.6 },
      });
    });
    // Copy drifts up and fades on desktop, where it sits over the photograph.
    mm.add(MQ.desktopMotion, () => {
      gsap.to(q('[data-copy-wrap]'), {
        yPercent: -18,
        opacity: 0.2,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top top', end: 'bottom top', scrub: 0.6 },
      });
    });
  });

  // Slide transition: wipe the incoming image in, settle its scale, reveal its copy.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || cycle === 0) return;
    const from = prev.current;
    const to = active;
    const q = gsap.utils.selector(el);
    const slides = q('[data-slide]');
    const inSlide = slides[to];
    const outSlide = slides[from];

    const ctx = gsap.context(() => {
      // Normalise state so interrupted transitions never leave gaps.
      slides.forEach((s, i) => gsap.set(s, { zIndex: i === to ? 2 : i === from ? 1 : 0, autoAlpha: i === to || i === from ? 1 : 0 }));
      const inImg = inSlide.querySelector('img');
      const outLines = q(`[data-copy="${from}"] [data-line] > span, [data-copy="${from}"] [data-fade]`);
      const inLines = q(`[data-copy="${to}"] [data-line] > span`);
      const inFades = q(`[data-copy="${to}"] [data-fade]`);

      if (reduced) {
        gsap.set(outSlide, { autoAlpha: 0 });
        gsap.set(inImg, { scale: 1 });
        gsap.set([...inLines, ...inFades], { autoAlpha: 1, yPercent: 0, y: 0 });
        return;
      }
      // Slow, continuous zoom across the slide's whole time on screen.
      gsap.fromTo(inImg, { scale: 1 }, { scale: ZOOM, duration: ZOOM_TIME, ease: 'none' });
      gsap
        .timeline({
          onComplete: () => {
            gsap.set(outSlide, { autoAlpha: 0 });
          },
        })
        .fromTo(inSlide, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.4, ease: 'power2.inOut' })
        .to(outLines, { autoAlpha: 0, duration: 0.4, ease: 'power2.in' }, 0)
        .fromTo(inLines, { yPercent: 115, autoAlpha: 1 }, { yPercent: 0, duration: 1.2, stagger: 0.1, ease: 'expo.out' }, 0.5)
        .fromTo(inFades, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out' }, 0.75);
    }, el);
    return () => ctx.kill();
  }, [active, cycle, reduced]);

  // Swipe on touch.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') touch.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const t = touch.current;
    touch.current = null;
    if (!t) return;
    const dx = e.clientX - t.x;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - t.y)) (dx < 0 ? next : previous)();
  };

  const light = heroSlides[active].tone === 'paper';

  const bars = (variant: 'desktop' | 'mobile') =>
    heroSlides.map((s, i) => (
      <button
        key={s.id}
        type="button"
        onClick={() => i !== active && go(i, i > active ? 1 : -1)}
        aria-label={`Go to slide ${i + 1}: ${s.lines.filter(Boolean).join(' ') || s.alt}`}
        aria-current={i === active}
        className={cx('relative h-6', variant === 'desktop' ? 'flex-1 lg:w-14 lg:flex-none' : i === active ? 'w-12' : 'w-6')}
      >
        <span className={cx('absolute inset-x-0 top-1/2 -translate-y-1/2 bg-current opacity-30', variant === 'mobile' ? 'h-[3px] rounded-full' : 'h-[2px]')} />
        <span
          key={i === active ? `${active}-${cycle}` : i}
          className={cx(
            'absolute inset-x-0 top-1/2 origin-left -translate-y-1/2 bg-current',
            variant === 'mobile' ? 'h-[3px] rounded-full' : 'h-[2px]',
            i < active ? 'scale-x-100' : 'scale-x-0',
            i === active && (reduced ? '!scale-x-100' : 'animate-slidefill'),
          )}
          style={i === active ? { animationPlayState: paused ? 'paused' : 'running' } : undefined}
          onAnimationEnd={i === active && !reduced ? next : undefined}
        />
      </button>
    ));

  return (
    <section
      ref={ref}
      aria-roledescription="carousel"
      aria-label="Featured campaigns"
      className="relative flex flex-col lg:block lg:h-[100svh] lg:min-h-[680px]"
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHovering(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setHovering(false)}
      onFocus={(e) => (e.target as HTMLElement).matches(':focus-visible') && setFocusWithin(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setFocusWithin(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') next();
        if (e.key === 'ArrowLeft') previous();
      }}
    >
      <h1 className="sr-only">{BRAND.name} — {BRAND.tagline}</h1>

      {/* Media */}
      <div
        ref={mediaRef}
        data-media
        className="relative order-1 h-[76svh] min-h-[480px] touch-pan-y overflow-hidden bg-newsprint lg:absolute lg:inset-0 lg:h-full"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <div data-parallax className="absolute inset-0">
          {heroSlides.map((s, i) => (
            <div
              key={s.id}
              data-slide={i}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${COUNT}`}
              aria-hidden={i !== active}
              className={cx('absolute inset-0 overflow-hidden', showWhole(s, i) && 'bg-night')}
              style={{ zIndex: i === 0 ? 2 : 0, visibility: i === 0 ? 'visible' : 'hidden' }}
            >
              <picture className={cx(showWhole(s, i) && 'absolute inset-0 flex justify-center')}>
                {warm.has(i) && <source media="(min-width: 1024px)" srcSet={srcSetFor(s.desktop, 1600, 2400) ?? s.desktop} sizes="100vw" />}
                <img
                  // The banner is the first thing anyone sees, so phones always get the full-quality file.
                  src={warm.has(i) ? s.mobile : undefined}
                  alt={s.alt}
                  {...(i === 0 ? { 'data-hero-img': '', fetchpriority: 'high' } : {})}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                  ref={(el) => measure(i, el)}
                  onLoad={(e) => measure(i, e.currentTarget)}
                  className={cx(
                    'will-change-transform',
                    showWhole(s, i)
                      ? 'relative h-full w-auto max-w-full object-contain [mask-image:linear-gradient(to_right,transparent,#000_14%,#000_86%,transparent)]'
                      : 'absolute inset-0 h-full w-full object-cover [object-position:var(--mpos)] lg:[object-position:var(--dpos)]',
                  )}
                  style={{ '--mpos': s.mobilePosition, '--dpos': s.position } as React.CSSProperties}
                />
              </picture>
              <div aria-hidden className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/50 via-black/15 to-transparent lg:h-64 lg:from-black/55 lg:via-black/20" />
              {s.scrim && <div aria-hidden className="absolute inset-0 hidden bg-gradient-to-r from-ink/60 via-ink/25 to-transparent lg:block" />}
              {s.tone === 'paper' && !s.scrim && (
                <div aria-hidden className="absolute inset-x-0 top-0 hidden h-3/4 bg-gradient-to-b from-ink/30 to-transparent lg:block" />
              )}
            </div>
          ))}
        </div>

        {/* Phone overlay: shop pill, progress dashes and round arrows inside the photo */}
        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/50 via-black/20 to-transparent px-4 pb-5 pt-20 text-white lg:hidden">
          <Link
            to={heroSlides[active].cta.to}
            className="inline-flex items-center gap-2.5 rounded-full bg-ink/90 py-2.5 pl-4 pr-3.5 text-[0.9rem] font-semibold text-white shadow-lg"
          >
            <span aria-hidden className="h-2 w-2 rounded-full bg-stamp" />
            <span key={active} className="animate-[pillin_0.5s_cubic-bezier(0.22,1,0.36,1)]">{heroSlides[active].pill}</span>
            <ArrowRight strokeWidth={2} className="h-4 w-4" />
          </Link>
          <div className="mt-4 flex items-center gap-1.5">{bars('mobile')}</div>
        </div>
        <button
          type="button"
          onClick={previous}
          aria-label="Previous slide"
          className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-md lg:hidden"
        >
          <ChevronLeft strokeWidth={2} className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={next}
          aria-label="Next slide"
          className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-md lg:hidden"
        >
          <ChevronRight strokeWidth={2} className="h-5 w-5" />
        </button>
      </div>

      {/* Copy — every slide shares one grid cell, so the height never jumps */}
      <div className="relative order-3 hidden lg:pointer-events-none lg:absolute lg:inset-0 lg:z-10 lg:block">
        <div
          data-copy-wrap
          className="site-container grid h-full pb-14 pt-6 lg:pb-28 lg:pt-[calc(var(--header-h)+var(--announce-h)+5vh)] lg:[&>*]:pointer-events-auto"
        >
          {heroSlides.map((s, i) => (
            <SlideCopy key={s.id} slide={s} index={i} active={i === active} />
          ))}
        </div>
      </div>

      {/* Controls (outer wrapper positions; inner element animates) */}
      <div className="site-container relative z-20 order-2 hidden pt-4 lg:absolute lg:bottom-9 lg:left-1/2 lg:block lg:w-auto lg:-translate-x-1/2 lg:px-0 lg:pt-0">
        <div data-controls className={cx('flex items-center gap-4 text-ink transition-colors duration-700', light && 'lg:text-paper')}>
          <span className="font-mono text-[0.7rem] tabular-nums">
            <span className="font-medium">{pad(active + 1)}</span>
            <span className="opacity-60"> / {pad(COUNT)}</span>
          </span>
          <div className="flex flex-1 items-center gap-1.5 lg:flex-none">{bars('desktop')}
          </div>
          <div className="flex items-center">
            <button type="button" onClick={previous} aria-label="Previous slide" className="flex h-9 w-9 items-center justify-center transition-opacity hover:opacity-60">
              <ArrowLeft strokeWidth={1.75} className="h-4 w-4" />
            </button>
            <button type="button" onClick={next} aria-label="Next slide" className="flex h-9 w-9 items-center justify-center transition-opacity hover:opacity-60">
              <ArrowRight strokeWidth={1.75} className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <CropMarks className={cx('!top-[calc(var(--header-h)+var(--announce-h))] hidden transition-colors duration-700 lg:block', light ? '!text-paper/70' : '!text-ink/70')} inset={20} />
    </section>
  );
}
