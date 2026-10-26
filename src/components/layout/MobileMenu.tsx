import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Heart, LogOut, MapPin, Package, Search, ShoppingBag, Sparkles, User, X } from 'lucide-react';
import { useScrollLock } from '@/lib/SmoothScroll';
import { EASE } from '@/lib/motion';
import { useShop } from '@/store/ShopContext';
import { useAuth } from '@/store/AuthContext';
import { SiteLink } from '@/components/ui/SiteLink';
import { Wordmark } from '@/components/ui/Wordmark';
import { BRAND } from '@/config/brand';
import { img, useContent } from '@/store/SiteContent';
import { sized } from '@/lib/api';

function Row({ to, onClick, icon, children, badge }: { to: string; onClick: () => void; icon?: ReactNode; children: ReactNode; badge?: ReactNode }) {
  return (
    <li>
      <SiteLink to={to} onClick={onClick} className="flex items-center gap-3.5 px-5 py-3.5 text-[0.95rem] font-medium text-ink transition-colors hover:bg-newsprint">
        {icon && <span className="flex h-5 w-5 shrink-0 items-center justify-center text-graphite">{icon}</span>}
        <span className="flex-1">{children}</span>
        {badge}
        <ChevronRight className="h-4 w-4 shrink-0 text-graphite/70" strokeWidth={1.75} />
      </SiteLink>
    </li>
  );
}

const Heading = ({ children }: { children: ReactNode }) => (
  <p className="px-5 pb-1.5 pt-5 font-mono text-[0.66rem] font-bold uppercase tracking-[0.16em] text-graphite">{children}</p>
);

/** Side menu (all screen sizes). The shop links and promo come from Admin → Website content → Phone menu. */
export function MobileMenu({ open, onClose, onSearch }: { open: boolean; onClose: () => void; onSearch: () => void }) {
  const { count, wishlist } = useShop();
  const { user, signOut } = useAuth();
  const c = useContent('site.mobileMenu');
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const icon = 'h-[1.1rem] w-[1.1rem]';
  const pill = (n: number) =>
    n > 0 ? <span className="rounded-full bg-gold px-2 py-0.5 font-mono text-[0.65rem] font-bold text-night">{n}</span> : null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="menu-backdrop"
          aria-hidden
          onClick={onClose}
          className="fixed inset-0 z-[59] bg-night/65"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
      )}
      {open && (
        <motion.div
          key="menu-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-y-0 left-0 z-[60] flex w-[86vw] max-w-[380px] flex-col bg-paper shadow-2xl"
          initial={{ x: '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: '-100%' }}
          transition={{ duration: 0.45, ease: EASE }}
          data-lenis-prevent
        >
          {/* Greeting */}
          <div className="relative shrink-0 bg-night px-5 pb-5 pt-4 text-white">
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
            <div className="flex items-center justify-between">
              <button type="button" onClick={onSearch} aria-label="Search" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10">
                <Search className="h-[1.1rem] w-[1.1rem]" strokeWidth={1.75} />
              </button>
              <Link to="/" onClick={onClose} aria-label={`${BRAND.name} — home`} className="block w-[112px]">
                <span className="block text-white" style={{ '--logo-pip': 'rgb(var(--c-night))' } as React.CSSProperties}>
                  <Wordmark tone="mono" className="w-full" />
                </span>
              </Link>
              <button type="button" onClick={onClose} aria-label="Close menu" autoFocus className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10">
                <X className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>
            {user ? (
              <Link to="/account" onClick={onClose} className="mt-2 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold font-semibold text-night">{user.name.charAt(0).toUpperCase()}</span>
                <span>
                  <span className="block text-[0.72rem] uppercase tracking-[0.12em] text-white/60">Hey there</span>
                  <span className="block text-lg font-semibold">{user.name.split(' ')[0]}</span>
                </span>
              </Link>
            ) : (
              <div className="mt-2">
                <p className="text-lg font-semibold">Hello!</p>
                <p className="mt-0.5 text-sm text-white/65">Sign in for orders, wishlist and faster checkout.</p>
                <Link to="/account" onClick={onClose} className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2 text-sm font-semibold text-night hover:bg-gold/90">
                  Log in / Sign up
                </Link>
              </div>
            )}
          </div>

          <nav aria-label="Menu" className="flex-1 overflow-y-auto pb-6">
            <Heading>Shop</Heading>
            <ul className="divide-y divide-rule border-y border-rule">
              {c.links.map((l, i) => (
                <Row key={i} to={l.link} onClick={onClose}>{l.label}</Row>
              ))}
            </ul>

            <Heading>My account</Heading>
            <ul className="divide-y divide-rule border-y border-rule">
              <Row to="/orders" onClick={onClose} icon={<Package className={icon} strokeWidth={1.75} />}>My orders</Row>
              <Row to="/account" onClick={onClose} icon={<Heart className={icon} strokeWidth={1.75} />} badge={pill(wishlist.length)}>Wishlist</Row>
              <Row to="/cart" onClick={onClose} icon={<ShoppingBag className={icon} strokeWidth={1.75} />} badge={pill(count)}>My bag</Row>
              <Row to="/account" onClick={onClose} icon={<User className={icon} strokeWidth={1.75} />}>My account</Row>
            </ul>

            <Heading>Help</Heading>
            <ul className="divide-y divide-rule border-y border-rule">
              <Row to="/offers" onClick={onClose} icon={<Sparkles className={icon} strokeWidth={1.75} />}>Offers</Row>
              <Row to="/about#shipping" onClick={onClose} icon={<MapPin className={icon} strokeWidth={1.75} />}>Shipping &amp; returns</Row>
              <Row to="/about#contact" onClick={onClose}>Contact us</Row>
              <Row to="/about" onClick={onClose}>Our story</Row>
            </ul>

            {c.promoTitle && (
              <SiteLink to={c.promoLink || '/shop'} onClick={onClose} className="mx-5 mt-6 grid grid-cols-[72px_1fr] items-center gap-4 rounded-xl border border-gold/30 bg-night p-3 text-white">
                {c.promoImage ? <img decoding="async" src={sized(img(c.promoImage), 320)} alt="" className="aspect-square w-full rounded-lg object-cover" loading="lazy" /> : <span />}
                <span>
                  {c.promoEyebrow && <span className="block font-mono text-[0.62rem] uppercase tracking-[0.14em] text-gold">{c.promoEyebrow}</span>}
                  <span className="mt-0.5 block text-sm font-semibold leading-snug">{c.promoTitle}</span>
                </span>
              </SiteLink>
            )}

            {user && (
              <button
                type="button"
                onClick={() => { void signOut(); onClose(); }}
                className="mx-5 mt-6 flex items-center gap-2 text-sm font-medium text-graphite hover:text-ink"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.75} /> Sign out
              </button>
            )}
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
