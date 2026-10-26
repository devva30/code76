import { NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, Home, LayoutGrid, ShoppingBag, User } from 'lucide-react';
import { useShop } from '@/store/ShopContext';
import { EASE } from '@/lib/motion';
import { cx } from '@/lib/format';

const ITEM = 'relative flex flex-1 flex-col items-center justify-end gap-1 pb-2.5 font-mono text-[0.64rem] uppercase tracking-[0.08em] text-night transition-colors';

function Badge({ count, className }: { count: number; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {count > 0 && (
        <motion.span
          key={count}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          className={cx(
            'absolute flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 font-sans text-[0.62rem] font-bold leading-none',
            className,
          )}
        >
          {count}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

/** App-style bottom navigation for phones, in cream and gold: Home · Shop · Bag · Wishlist · My orders. */
export function BottomNav() {
  const { count, wishlist, openCart } = useShop();
  const link = ({ isActive }: { isActive: boolean }) => cx(ITEM, isActive ? 'font-bold [&_svg]:text-gold-deep' : 'font-semibold [&_svg]:text-night/80');
  const dot = (isActive: boolean) => (
    <span aria-hidden className={cx('absolute top-1.5 h-1 w-1 rounded-full bg-gold-deep transition-opacity', isActive ? 'opacity-100' : 'opacity-0')} />
  );

  return (
    <nav
      aria-label="Quick links"
      className="fixed inset-x-0 bottom-0 z-[45] bg-cream pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_24px_-12px_rgba(0,0,0,0.25)] lg:hidden"
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-deep to-transparent" />
      <div className="mx-auto flex h-[var(--bottom-nav-bar)] max-w-lg items-stretch">
        <NavLink to="/" end className={link}>
          {({ isActive }) => (
            <>
              {dot(isActive)}
              <Home strokeWidth={1.7} className="h-[1.3rem] w-[1.3rem]" />
              Home
            </>
          )}
        </NavLink>
        <NavLink to="/shop" className={link}>
          {({ isActive }) => (
            <>
              {dot(isActive)}
              <LayoutGrid strokeWidth={1.7} className="h-[1.3rem] w-[1.3rem]" />
              Shop
            </>
          )}
        </NavLink>

        {/* Bag: a raised gold button in the middle */}
        <div className="relative flex flex-1 justify-center">
          <button
            type="button"
            onClick={openCart}
            aria-label={`Open bag, ${count} ${count === 1 ? 'item' : 'items'}`}
            className="absolute -top-6 flex h-[3.6rem] w-[3.6rem] items-center justify-center rounded-full bg-gradient-to-br from-[#F1D892] via-gold to-gold-deep text-night shadow-[0_8px_20px_-6px_rgb(var(--c-gold)/0.7)] ring-[5px] ring-cream transition-transform active:scale-95"
          >
            <ShoppingBag strokeWidth={2} className="h-6 w-6" />
            <Badge count={count} className="-right-1 -top-1 bg-night text-gold ring-2 ring-gold" />
          </button>
        </div>

        <NavLink to="/account" className={link}>
          {({ isActive }) => (
            <>
              {dot(isActive)}
              <span className="relative">
                <Heart strokeWidth={1.7} className="h-[1.3rem] w-[1.3rem]" />
                <Badge count={wishlist.length} className="-right-2.5 -top-2 bg-gold text-night" />
              </span>
              Wishlist
            </>
          )}
        </NavLink>
        <NavLink to="/orders" className={link}>
          {({ isActive }) => (
            <>
              {dot(isActive)}
              <User strokeWidth={1.7} className="h-[1.3rem] w-[1.3rem]" />
              My orders
            </>
          )}
        </NavLink>
      </div>
    </nav>
  );
}
