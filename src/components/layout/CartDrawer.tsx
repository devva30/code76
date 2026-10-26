import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useShop, CART_MAX_QTY, type ResolvedLine } from '@/store/ShopContext';
import { useAuth } from '@/store/AuthContext';
import { useScrollLock } from '@/lib/SmoothScroll';
import { EASE } from '@/lib/motion';
import { formatPrice } from '@/lib/format';
import { Button, ButtonLink } from '@/components/ui/Button';
import { QuantityStepper } from '@/components/ui/Selectors';
import { BRAND } from '@/config/brand';
import { sizeLabel } from '@/data/products';
import { sized } from '@/lib/api';

export function ShippingProgress({ subtotal }: { subtotal: number }) {
  const remaining = Math.max(0, BRAND.freeShippingThreshold - subtotal);
  const pct = Math.min(100, (subtotal / BRAND.freeShippingThreshold) * 100);
  return (
    <div>
      <p className="text-xs text-graphite">
        {remaining > 0 ? (
          <>You are <span className="text-ink">{formatPrice(remaining)}</span> away from complimentary shipping.</>
        ) : (
          <>Your order qualifies for complimentary shipping.</>
        )}
      </p>
      <div className="mt-3 h-px w-full bg-rule">
        <motion.div className="h-px bg-stamp" initial={false} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: EASE }} />
      </div>
    </div>
  );
}

/** What's wrong with a line, in words, when the server flags it. */
export function lineIssueText(line: ResolvedLine): string | null {
  if (line.issue === 'SOLD_OUT') return 'Sold out. Remove it to check out.';
  if (line.issue === 'UNAVAILABLE') return 'No longer available. Remove it to check out.';
  if (line.issue === 'NOT_ENOUGH_STOCK') return `Only ${line.available} left. Lower the quantity to check out.`;
  return null;
}

/** Checkout needs the CODE76 server; in the static preview there is none, so explain instead. */
export function useCheckoutAvailable() {
  return useAuth().status !== 'unavailable';
}

export function CartLineItem({ line, onNavigate, large }: { line: ResolvedLine; onNavigate?: () => void; large?: boolean }) {
  const { setQty, removeLine } = useShop();
  return (
    <motion.li
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.4, ease: EASE }}
      className={large ? 'grid grid-cols-[110px_1fr] gap-5 py-6 sm:grid-cols-[150px_1fr]' : 'grid grid-cols-[88px_1fr] gap-4 py-5'}
    >
      <Link to={`/product/${line.slug}?color=${line.colorId}`} onClick={onNavigate} className="block aspect-[4/5] overflow-hidden bg-card">
        <img decoding="async" src={sized(line.image, 320)} alt={`${line.product.name} in ${line.colorName}`} className="h-full w-full object-cover" loading="lazy" />
      </Link>
      <div className="flex min-w-0 flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link to={`/product/${line.slug}?color=${line.colorId}`} onClick={onNavigate} className="block truncate text-sm hover:underline">
              {line.product.name}
            </Link>
            <p className="mt-1 text-xs text-graphite">
              {line.colorName} · {sizeLabel(line.size)} · {line.product.fitLabel}
            </p>
            {lineIssueText(line) && (
              <p role="alert" className="mt-1.5 text-xs text-[rgb(var(--c-stamp))]">{lineIssueText(line)}</p>
            )}
          </div>
          <p className="shrink-0 text-sm tabular-nums">{formatPrice(line.lineTotal)}</p>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <QuantityStepper value={line.qty} max={CART_MAX_QTY} onChange={(n) => setQty(line.key, n)} label={line.product.name} />
          <button type="button" onClick={() => removeLine(line.key)} className="link-underline text-[0.68rem] font-mono uppercase tracking-[0.1em] text-graphite hover:text-ink">
            Remove
          </button>
        </div>
      </div>
    </motion.li>
  );
}

export function CheckoutNotice({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden text-xs leading-relaxed text-graphite"
          role="status"
        >
          Checkout needs the store server, which isn’t connected to this copy of the site — no order has been placed.
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export function CartDrawer() {
  const { cartOpen, closeCart, lines, subtotal, count } = useShop();
  const [notice, setNotice] = useState(false);
  const checkoutAvailable = useCheckoutAvailable();
  useScrollLock(cartOpen);

  useEffect(() => {
    if (!cartOpen) {
      setNotice(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeCart();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cartOpen, closeCart]);

  return (
    <AnimatePresence>
      {cartOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-[80] bg-ink/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
            onClick={closeCart}
            aria-hidden
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Shopping bag"
            className="fixed inset-y-0 right-0 z-[81] flex w-full max-w-[460px] flex-col bg-paper"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <div className="flex h-[var(--header-h)] shrink-0 items-center justify-between border-b border-rule px-5 sm:px-8">
              <p className="text-[0.72rem] font-medium font-mono uppercase tracking-[0.1em]">Your bag ({count})</p>
              <button type="button" onClick={closeCart} aria-label="Close bag" autoFocus className="-mr-2 flex h-10 w-10 items-center justify-center">
                <X strokeWidth={1.25} className="h-5 w-5" />
              </button>
            </div>

            {lines.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
                <p className="display text-4xl">Your bag is empty.</p>
                <p className="mt-3 max-w-xs text-sm text-graphite">Start with the essentials — our oversized and regular fits are a good place to begin.</p>
                <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
                  <ButtonLink to="/collections/new-arrivals" onClick={closeCart} full arrow>Shop new arrivals</ButtonLink>
                  <ButtonLink to="/shop" onClick={closeCart} variant="outline" full>Shop all</ButtonLink>
                </div>
              </div>
            ) : (
              <>
                <div className="border-b border-rule px-5 py-4 sm:px-8">
                  <ShippingProgress subtotal={subtotal} />
                </div>
                <ul className="flex-1 divide-y divide-rule overflow-y-auto px-5 sm:px-8" data-lenis-prevent>
                  <AnimatePresence initial={false}>
                    {lines.map((l) => (
                      <CartLineItem key={l.key} line={l} onNavigate={closeCart} />
                    ))}
                  </AnimatePresence>
                </ul>
                <div className="space-y-4 border-t border-rule px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:px-8">
                  <div className="flex items-baseline justify-between">
                    <p className="text-[0.72rem] font-medium font-mono uppercase tracking-[0.1em]">Subtotal</p>
                    <p className="text-base tabular-nums">{formatPrice(subtotal)}</p>
                  </div>
                  <p className="text-xs text-graphite">Taxes and shipping calculated at checkout.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <ButtonLink to="/cart" onClick={closeCart} variant="outline">View bag</ButtonLink>
                    {checkoutAvailable ? (
                      <ButtonLink to="/checkout" onClick={closeCart}>Checkout</ButtonLink>
                    ) : (
                      <Button onClick={() => setNotice(true)}>Checkout</Button>
                    )}
                  </div>
                  <CheckoutNotice show={notice} />
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
