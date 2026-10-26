import { useEffect, useLayoutEffect, useState, type DependencyList, type RefObject } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
gsap.defaults({ ease: 'power3.out', duration: 1 });
// Phones: ignore the address bar showing/hiding, so pinned and scrubbed sections never jump.
ScrollTrigger.config({ ignoreMobileResize: true });

export { gsap, ScrollTrigger };

/** Shared easing so GSAP and Framer Motion feel like one system. */
export const EASE = [0.22, 1, 0.36, 1] as const;

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export const useReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Scopes GSAP animations to a container and reverts them (including
 * ScrollTriggers) on unmount. The callback receives `gsap.matchMedia`
 * so sections can define desktop / mobile / reduced-motion variants.
 */
export function useGsap(
  scope: RefObject<HTMLElement>,
  setup: (mm: gsap.MatchMedia, self: HTMLElement) => void,
  deps: DependencyList = [],
) {
  useIsoLayoutEffect(() => {
    const el = scope.current;
    if (!el) return;
    const mm = gsap.matchMedia(el);
    setup(mm, el);
    return () => mm.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Media conditions shared by every animated section. */
export const MQ = {
  desktopMotion: '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
  anyMotion: '(prefers-reduced-motion: no-preference)',
  mobileMotion: '(max-width: 1023px) and (prefers-reduced-motion: no-preference)',
  reduced: '(prefers-reduced-motion: reduce)',
} as const;
