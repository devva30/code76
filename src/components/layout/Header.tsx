import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Heart, Menu, Search, ShoppingBag, User } from 'lucide-react';
import { Wordmark } from '@/components/ui/Wordmark';
import { MobileMenu } from './MobileMenu';
import { SearchOverlay } from './SearchOverlay';
import { useShop } from '@/store/ShopContext';
import { BRAND } from '@/config/brand';
import { EASE } from '@/lib/motion';
import { cx } from '@/lib/format';
import { img, isExternal, useContent, useFill } from '@/store/SiteContent';
import { SiteLink } from '@/components/ui/SiteLink';
import { Pips } from '@/components/ui/PrintMarks';
import { sized } from '@/lib/api';

const ICON_BTN = 'flex h-10 w-9 sm:w-10 items-center justify-center transition-colors duration-500';
const iconHover = (over: boolean) => (over ? 'hover:bg-white/10 drop-shadow-[0_1px_6px_rgba(0,0,0,0.5)]' : 'hover:bg-ink/[0.06]');

function AnnouncementBar({ hidden, transparent }: { hidden: boolean; transparent: boolean }) {
  const { items: rawItems, link } = useContent('site.announcements');
  const fill = useFill();
  const announcements = rawItems.map(fill);
  const items = [...announcements, ...announcements];
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (!hidden) setRun((r) => r + 1);
  }, [hidden]);
  useEffect(() => {
    const onShow = () => !document.hidden && setRun((r) => r + 1);
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('pageshow', onShow);
    return () => {
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('pageshow', onShow);
    };
  }, []);
  return (
    <motion.div
      initial={false}
      animate={{ height: hidden ? 0 : 'var(--announce-h)', opacity: hidden ? 0 : 1 }}
      transition={{ duration: 0.5, ease: EASE }}
      className={cx(
        'overflow-hidden border-b transition-colors duration-500',
        transparent ? 'border-gold/25 bg-night/45 text-gold [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]' : 'border-transparent bg-gradient-to-r from-gold-deep via-gold to-gold-deep text-night',
      )}
    >
      <SiteLink
        to={link || '/shop'}
        aria-label={announcements.join('. ')}
        className="group flex h-[var(--announce-h)] items-center overflow-hidden"
      >
        {/* Two identical rows scroll as one continuous ticker. */}
        <div key={run} aria-hidden className="flex w-max animate-ticker will-change-transform [@media(hover:hover)]:group-hover:[animation-play-state:paused]">
          {[0, 1].map((row) => (
            <ul key={row} className="flex shrink-0 items-center">
              {items.map((text, i) => (
                <li key={`${row}-${i}`} className="flex shrink-0 items-center gap-6 whitespace-nowrap px-6 font-mono text-[0.625rem] font-medium uppercase tracking-[0.1em] sm:text-[0.6875rem]">
                  <span>{text}</span>
                  <Pips className="h-2 w-2 opacity-60" />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </SiteLink>
    </motion.div>
  );
}

export function Header() {
  const { pathname } = useLocation();
  const menu = useContent('site.header');
  const hasAnnouncements = useContent('site.announcements').items.length > 0;
  const NAV = menu.nav.map((n) => ({ label: n.label, to: n.link, mega: n.showPanel && menu.panel.length > 0 }));

  // With no announcements the bar is left out, and pages close the gap it used to take.
  useEffect(() => {
    document.documentElement.style.setProperty('--announce-h', hasAnnouncements ? '' : '0px');
  }, [hasAnnouncements]);
  const { count, openCart, wishlist } = useShop();
  const [scrolled, setScrolled] = useState(false);
  const [hiddenNav, setHiddenNav] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const lastY = useRef(0);
  const megaTimer = useRef<number>();

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 24);
      // Retract on scroll down, return on scroll up — never while overlays are open.
      setHiddenNav(y > 520 && y > lastY.current + 2 ? true : y < lastY.current - 2 ? false : (prev) => prev);
      lastY.current = y;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
    setMegaOpen(false);
  }, [pathname]);

  const overlayOpen = menuOpen || searchOpen || megaOpen;
  const overHero = pathname === '/' && !scrolled && !overlayOpen;
  const retracted = hiddenNav && !overlayOpen;

  // Lets sticky UI (shop toolbar, product info) sit flush beneath the visible header.
  useEffect(() => {
    document.documentElement.style.setProperty('--nav-offset', retracted ? '0px' : 'var(--header-h)');
  }, [retracted]);

  const openMega = () => {
    window.clearTimeout(megaTimer.current);
    setMegaOpen(true);
  };
  const closeMega = () => {
    megaTimer.current = window.setTimeout(() => setMegaOpen(false), 140);
  };

  return (
    <>
      <header
        className={cx(
          'fixed inset-x-0 top-0 z-50 transition-transform duration-700 ease-editorial',
          retracted && '-translate-y-full',
        )}
      >
        {hasAnnouncements && <AnnouncementBar hidden={scrolled} transparent={overHero} />}
        <div
          className={cx(
            'relative border-b transition-[background-color,border-color,color,backdrop-filter] duration-500 ease-editorial',
            overHero
              ? 'border-transparent bg-transparent text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.5)]'
              : 'border-gold/25 bg-night text-white shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]',
          )}
          onMouseLeave={closeMega}
        >
          <nav aria-label="Primary" className="site-container grid h-[var(--header-h)] grid-cols-[1fr_auto_1fr] items-center">
            {/* Left: desktop links / mobile menu */}
            <div className="flex items-center">
              <button
                type="button"
                className="-ml-2 mr-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/10 xl:mr-6"
                aria-label="Open menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(true)}
              >
                <Menu strokeWidth={1.75} className="h-[1.35rem] w-[1.35rem]" />
              </button>
              <ul className="hidden items-center gap-7 whitespace-nowrap xl:flex">
                {NAV.map((item, i) => (
                  <li key={i} onMouseEnter={item.mega ? openMega : () => setMegaOpen(false)} onFocus={item.mega ? openMega : undefined}>
                    {isExternal(item.to) || item.to.includes('#') ? (
                      <SiteLink to={item.to} className="link-underline text-[0.85rem] font-medium">{item.label}</SiteLink>
                    ) : (
                    <NavLink
                      to={item.to}
                      end={item.to === '/shop' || item.to === '/'}
                      aria-haspopup={item.mega ? 'true' : undefined}
                      aria-expanded={item.mega ? megaOpen : undefined}
                      className={({ isActive }) =>
                        cx(
                          'link-underline text-[0.85rem] font-medium',
                          isActive && !item.mega && !item.to.includes('#') && 'after:origin-left after:scale-x-100',
                        )
                      }
                    >
                      <span className="inline-flex items-center gap-1">
                        {item.label}
                        {item.mega && <ChevronDown aria-hidden className={cx('h-3.5 w-3.5 transition-transform duration-300', megaOpen && 'rotate-180')} strokeWidth={2} />}
                      </span>
                    </NavLink>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <Link to="/" className="justify-self-center transition-opacity hover:opacity-80" aria-label={`${BRAND.name} — home`}>
              <span className="relative block w-[92px] min-[400px]:w-[104px] sm:w-[116px] lg:w-[132px]">
                <Wordmark className="w-full opacity-0" />
                <span
                  aria-hidden
                  className={cx('absolute inset-0 text-white transition-[filter] duration-500', overHero && 'drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]')}
                  style={{ '--logo-pip': 'rgb(var(--c-ink))' } as React.CSSProperties}
                >
                  <Wordmark tone="mono" className="w-full" />
                </span>
              </span>
            </Link>

            <div className="flex items-center justify-end gap-0.5 sm:gap-1.5">
              <button type="button" aria-label="Search" onClick={() => setSearchOpen(true)} className={cx(ICON_BTN, iconHover(true))}>
                <Search strokeWidth={1.75} className="h-5 w-5" />
              </button>
              <Link to="/account" aria-label={`Account and wishlist, ${wishlist.length} saved`} className={cx(ICON_BTN, iconHover(true), 'relative hidden sm:flex')}>
                <User strokeWidth={1.75} className="h-5 w-5 sm:hidden" />
                <Heart strokeWidth={1.75} className="hidden h-5 w-5 sm:block" />
                {wishlist.length > 0 && (
                  <span className={cx('absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[0.55rem] leading-none', 'bg-white text-ink')}>
                    {wishlist.length}
                  </span>
                )}
              </Link>
              <Link to="/account" aria-label="Account" className={cx(ICON_BTN, iconHover(true), 'hidden sm:flex')}>
                <User strokeWidth={1.75} className="h-5 w-5" />
              </Link>
              <button
                type="button"
                onClick={openCart}
                aria-label={`Shopping bag, ${count} ${count === 1 ? 'item' : 'items'}`}
                className={cx('press relative ml-1 flex h-10 w-10 items-center justify-center transition-colors duration-500 sm:ml-1.5', overHero ? 'bg-white text-ink shadow-[0_2px_12px_rgba(0,0,0,0.25)] [text-shadow:none]' : 'bg-gold text-night [text-shadow:none] hover:bg-gold/90')}
              >
                <ShoppingBag strokeWidth={1.75} className="h-[1.15rem] w-[1.15rem]" />
                <AnimatePresence initial={false}>
                  {count > 0 && (
                    <motion.span
                      key={count}
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.4, opacity: 0 }}
                      transition={{ duration: 0.35, ease: EASE }}
                      className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-stamp px-1 font-mono text-[0.6rem] font-medium leading-none text-paper ring-2 ring-paper"
                    >
                      {count}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </div>
          </nav>

          {/* Collections mega panel (desktop) */}
          <AnimatePresence>
            {megaOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.45, ease: EASE }}
                onMouseEnter={openMega}
                onMouseLeave={closeMega}
                className="absolute inset-x-0 top-full hidden border-b border-gold/25 bg-paper text-ink [text-shadow:none] shadow-[0_24px_40px_-24px_rgba(0,0,0,0.35)] lg:block"
              >
                <div className="site-container grid grid-cols-[1fr_2.4fr] gap-12 py-10">
                  <div className="flex flex-col justify-between">
                    <div>
                      {menu.panelEyebrow && <p className="eyebrow mb-4">{menu.panelEyebrow}</p>}
                      <p className="display max-w-xs text-4xl">{menu.panelTitle}</p>
                    </div>
                    {menu.panelLinkLabel && (
                      <SiteLink to={menu.panelLink || '/shop'} className="link-static-underline self-start text-[0.7rem] font-medium font-mono uppercase tracking-[0.1em]">
                        {menu.panelLinkLabel}
                      </SiteLink>
                    )}
                  </div>
                  <ul className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(0,1fr))]">
                    {menu.panel.map((m, i) => (
                      <li key={i}>
                        <SiteLink to={m.link} className="group block" onClick={() => setMegaOpen(false)}>
                          <div className="aspect-[4/3] overflow-hidden bg-card">
                            <img decoding="async" src={sized(img(m.image), 640)} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-[1.4s] ease-editorial group-hover:scale-105" />
                          </div>
                          <p className="mt-3 text-[0.7rem] font-medium font-mono uppercase tracking-[0.1em]">{m.label}</p>
                          <p className="mt-1 text-xs text-graphite">{m.note}</p>
                        </SiteLink>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} onSearch={() => { setMenuOpen(false); setSearchOpen(true); }} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
