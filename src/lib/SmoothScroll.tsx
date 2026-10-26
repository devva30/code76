import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import Lenis from 'lenis';
import { gsap, ScrollTrigger } from './motion';

/**
 * Lenis is used only on fine-pointer desktops without reduced motion,
 * and is driven by GSAP's ticker so ScrollTrigger stays perfectly in sync.
 * Touch devices keep fully native scrolling.
 */
interface ScrollApi {
  lock: () => void;
  unlock: () => void;
  scrollTo: (target: number | string | HTMLElement, immediate?: boolean) => void;
}

const ScrollContext = createContext<ScrollApi>({ lock: () => {}, unlock: () => {}, scrollTo: () => {} });

export const useSmoothScroll = () => useContext(ScrollContext);

export function SmoothScroll({ children }: { children: ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);
  const locks = useRef(0);

  useEffect(() => {
    const canSmooth = window.matchMedia('(pointer: fine) and (prefers-reduced-motion: no-preference)').matches;
    if (!canSmooth) return;

    // Follows the wheel closely (no floaty trailing), still smooth.
    const lenis = new Lenis({ lerp: 0.14, wheelMultiplier: 1 });
    lenisRef.current = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  const api: ScrollApi = {
    lock: () => {
      locks.current += 1;
      lenisRef.current?.stop();
      document.documentElement.style.overflow = 'hidden';
    },
    unlock: () => {
      locks.current = Math.max(0, locks.current - 1);
      if (locks.current === 0) {
        lenisRef.current?.start();
        document.documentElement.style.overflow = '';
      }
    },
    scrollTo: (target, immediate = false) => {
      if (lenisRef.current) lenisRef.current.scrollTo(target, { immediate, offset: 0 });
      else if (typeof target === 'number') window.scrollTo({ top: target, behavior: immediate ? 'instant' : 'smooth' });
      else {
        const el = typeof target === 'string' ? document.querySelector(target) : target;
        el?.scrollIntoView({ behavior: immediate ? 'instant' : 'smooth' });
      }
    },
  };

  return <ScrollContext.Provider value={api}>{children}</ScrollContext.Provider>;
}

/** Locks page scroll (native + Lenis) while `active` is true. */
export function useScrollLock(active: boolean) {
  const { lock, unlock } = useSmoothScroll();
  useEffect(() => {
    if (!active) return;
    lock();
    return unlock;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
