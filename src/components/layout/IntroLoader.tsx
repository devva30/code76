import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from '@/lib/motion';
import { completeIntro, isIntroPending } from '@/lib/intro';
import { useSmoothScroll } from '@/lib/SmoothScroll';
import { LOGO_GRADIENT, LOGO_STROKES, LOGO_VIEWBOX, PIP_POSITIONS } from '@/components/ui/Wordmark';
import { BRAND } from '@/config/brand';

/** Resolves when fonts and the hero image are ready, capped so the intro never stalls. */
function assetsReady(maxMs: number) {
  const fonts = document.fonts?.ready ?? Promise.resolve();
  const hero = new Promise<void>((resolve) => {
    const img = document.querySelector<HTMLImageElement>('[data-hero-img]');
    if (!img || img.complete) return resolve();
    img.addEventListener('load', () => resolve(), { once: true });
    img.addEventListener('error', () => resolve(), { once: true });
  });
  return Promise.race([Promise.all([fonts, hero]), new Promise((r) => setTimeout(r, maxMs))]);
}

/**
 * Branded first-visit loader: the die rolls in, its pips count up, the letters
 * draw themselves, then the sheet lifts to reveal the page.
 */
export function IntroLoader() {
  const [active] = useState(isIntroPending);
  const [gone, setGone] = useState(!active);
  const ref = useRef<HTMLDivElement>(null);
  const locked = useRef(false);
  const { lock, unlock: unlockScroll } = useSmoothScroll();
  const unlock = () => {
    if (!locked.current) return;
    locked.current = false;
    unlockScroll();
  };

  useLayoutEffect(() => {
    if (!active || !ref.current) return;
    lock();
    locked.current = true;
    const el = ref.current;
    const q = gsap.utils.selector(el);
    const counter = { v: 0 };
    const counterEl = el.querySelector<HTMLElement>('[data-count]');
    let cancelled = false;

    const ctx = gsap.context(() => {
      gsap.set(q('[data-stroke]'), { strokeDasharray: 1, strokeDashoffset: 1 });
      gsap.set(q('[data-pip]'), { scale: 0, transformOrigin: '50% 50%' });

      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
      tl.fromTo(q('[data-die]'), { rotate: -400, scale: 0.2, svgOrigin: '179.5 63.5' }, { rotate: 0, scale: 1, duration: 1.1, ease: 'back.out(1.4)' })
        .to(q('[data-pip]'), { scale: 1, duration: 0.35, stagger: 0.09, ease: 'back.out(3)' }, 0.55)
        .to(q('[data-stroke]'), { strokeDashoffset: 0, duration: 1.1, stagger: 0.1, ease: 'power2.inOut' }, 0.7)
        .fromTo(q('[data-meta]'), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.08 }, 0.3)
        .to(counter, {
          v: 100,
          duration: 1.5,
          ease: 'power1.inOut',
          onUpdate: () => {
            if (counterEl) counterEl.textContent = String(Math.round(counter.v)).padStart(3, '0');
          },
        }, 0.2)
        .to(q('[data-bar]'), { scaleX: 1, duration: 1.5, ease: 'power1.inOut' }, 0.2);

      // Exit once both the intro choreography and the critical assets are ready.
      Promise.all([tl.then(), assetsReady(2200)]).then(() => {
        if (cancelled) return;
        gsap.timeline({
          onComplete: () => {
            setGone(true);
            unlock();
          },
        })
          .to(q('[data-logo]'), { yPercent: -30, autoAlpha: 0, duration: 0.6, ease: 'power2.in' })
          .to(q('[data-meta]'), { autoAlpha: 0, duration: 0.3 }, 0)
          .add(() => completeIntro(), 0.35)
          .to(el, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1, ease: 'expo.inOut' }, 0.3);
      });
    }, el);

    return () => {
      cancelled = true;
      ctx.revert();
      unlock();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Safety net: never leave the page locked behind the loader.
  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => {
      completeIntro();
      setGone(true);
      unlock();
    }, 5000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (gone) return null;

  return (
    <div
      ref={ref}
      role="status"
      aria-label={`Loading ${BRAND.name}`}
      className="fixed inset-0 z-[150] flex flex-col bg-paper"
      style={{ clipPath: 'inset(0% 0% 0% 0%)' }}
    >
      <div className="screentone pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(closest-side,transparent_55%,black)]" aria-hidden />

      <div className="site-container relative flex items-center justify-end pt-6 font-mono text-[0.65rem] uppercase tracking-[0.1em] text-graphite">
        <span data-meta>Roll 01</span>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-6">
        <svg data-logo viewBox={LOGO_VIEWBOX} className="w-[min(78vw,520px)]" aria-hidden>
          <defs>
            <linearGradient id="intro-grad" gradientUnits="userSpaceOnUse" x1="6" y1="0" x2="677" y2="0">
              {LOGO_GRADIENT.map(([o, c]) => (
                <stop key={o} offset={o} stopColor={c} />
              ))}
            </linearGradient>
          </defs>
          <g fill="none" stroke="url(#intro-grad)" strokeWidth="8">
            {LOGO_STROKES.map((d) => (
              <path key={d} data-stroke d={d} pathLength={1} />
            ))}
            <ellipse data-stroke cx="637" cy="88.5" rx="36" ry="29.5" pathLength={1} />
          </g>
          <g data-die>
            <circle cx="179.5" cy="63.5" r="58.5" fill="#4A2224" />
            {PIP_POSITIONS.map(([cx, cy]) => (
              <circle key={`${cx}-${cy}`} data-pip cx={cx} cy={cy} r="6" fill="#F7F0EE" />
            ))}
          </g>
        </svg>
      </div>

      <div className="site-container relative pb-6">
        <div className="flex items-end justify-between font-mono uppercase tracking-[0.1em]">
          <span data-meta className="text-[0.65rem] text-graphite">Rolling the new season</span>
          <span data-meta className="text-2xl tabular-nums text-ink md:text-3xl">
            <span data-count>000</span>
            <span className="text-graphite">%</span>
          </span>
        </div>
        <div className="mt-3 h-px w-full bg-rule">
          <div data-bar className="h-px origin-left scale-x-0 bg-ink" />
        </div>
      </div>
    </div>
  );
}
