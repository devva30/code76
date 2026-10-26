import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { CartDrawer } from './CartDrawer';
import { Toasts } from './Toasts';
import { IntroLoader } from './IntroLoader';
import { BottomNav } from './BottomNav';
import { useSmoothScroll } from '@/lib/SmoothScroll';
import { ScrollTrigger } from '@/lib/motion';
import { useSiteReady } from '@/store/SiteContent';

/** Resets scroll on navigation (or jumps to a hash) and refreshes ScrollTrigger. */
function RouteEffects() {
  const { pathname, hash, key } = useLocation();
  const { scrollTo } = useSmoothScroll();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    const samePage = lastPath.current === pathname;
    lastPath.current = pathname;
    if (hash) {
      // Glide when the section is on the page already; otherwise wait for it to appear, then jump.
      let tries = 0;
      const timers: number[] = [];
      const aim = (el: HTMLElement, smooth: boolean) => scrollTo(el.getBoundingClientRect().top + window.scrollY - 70, !smooth);
      const go = () => {
        const el = document.querySelector(decodeURIComponent(hash));
        if (!(el instanceof HTMLElement)) {
          if (tries++ < 25) timers.push(window.setTimeout(go, 120));
          return;
        }
        aim(el, samePage);
        if (!samePage) {
          // Content above it (products, photos) may still be loading and push it down: re-aim as it settles.
          for (const ms of [350, 800, 1500, 2500]) {
            timers.push(window.setTimeout(() => {
              if (Math.abs(el.getBoundingClientRect().top - 70) > 30) aim(el, false);
            }, ms));
          }
        }
      };
      timers.push(window.setTimeout(go, samePage ? 0 : 150));
      return () => timers.forEach((x) => window.clearTimeout(x));
    }
    scrollTo(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, hash, key]);

  useEffect(() => {
    // Re-measure scroll animations once things settle; triggers that land close together share one
    // refresh, and it waits for an idle moment so it never freezes scrolling.
    let t = 0;
    let idle = 0;
    let alive = true;
    const refresh = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        const run = () => alive && ScrollTrigger.refresh();
        if ('requestIdleCallback' in window) idle = window.requestIdleCallback(run, { timeout: 800 });
        else run();
      }, 250);
    };
    refresh();
    window.addEventListener('load', refresh);
    document.fonts?.ready.then(refresh);
    return () => {
      alive = false;
      window.clearTimeout(t);
      if (idle) window.cancelIdleCallback(idle);
      window.removeEventListener('load', refresh);
    };
  }, [pathname]);

  return null;
}

export function Layout() {
  const { pathname } = useLocation();
  // Wait for the admin-edited content (a single fast request) so nothing flashes from old to new.
  if (!useSiteReady()) return <div className="min-h-svh bg-paper" aria-busy="true" />;
  return (
    <>
      <a
        href="#main"
        className="fixed left-4 top-2 z-[100] -translate-y-24 bg-ink px-4 py-2 text-xs font-mono uppercase tracking-[0.1em] text-paper focus:translate-y-0"
      >
        Skip to content
      </a>
      <IntroLoader />
      <RouteEffects />
      <Header />
      <main id="main" key={pathname} className="min-h-[70vh]">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
      <Toasts />
      <BottomNav />
    </>
  );
}
