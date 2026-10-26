import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useShop } from '@/store/ShopContext';
import { CartLineItem, CheckoutNotice, ShippingProgress, useCheckoutAvailable } from '@/components/layout/CartDrawer';
import { ProductGrid } from '@/components/product/ProductGrid';
import { PageIntro } from '@/components/ui/PageIntro';
import { Button, ButtonLink } from '@/components/ui/Button';
import { useFeaturedProducts } from '@/lib/catalogue';
import { BRAND } from '@/config/brand';
import { formatPrice } from '@/lib/format';

export default function Cart() {
  const { lines, subtotal, count, clearCart, accountCart } = useShop();
  const [notice, setNotice] = useState(false);
  const checkoutAvailable = useCheckoutAvailable();
  const shipping = accountCart ? accountCart.shipping.amountPaise / 100 : null;
  const total = accountCart ? accountCart.total.amountPaise / 100 : subtotal;
  const inCart = new Set(lines.map((l) => l.slug));
  const featured = useFeaturedProducts(12);
  const suggestions = featured.products.filter((p) => !inCart.has(p.slug)).slice(0, 4);

  useEffect(() => {
    document.title = `Your bag — ${BRAND.name}`;
  }, []);

  return (
    <>
      <PageIntro eyebrow={`${count} ${count === 1 ? 'item' : 'items'}`} title={['Your', <span className="italic">bag</span>]} />

      <div className="site-container pb-24 md:pb-32">
        {lines.length === 0 ? (
          <div className="flex flex-col items-center border-y border-rule py-24 text-center">
            <p className="display text-4xl md:text-[2.6rem]">Your bag is empty.</p>
            <p className="mt-4 max-w-sm text-sm text-graphite">When you add pieces, they’ll appear here — saved on this device, ready when you are.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink to="/collections/new-arrivals" arrow>Shop new arrivals</ButtonLink>
              <ButtonLink to="/shop" variant="outline">Shop all</ButtonLink>
            </div>
          </div>
        ) : (
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-7">
              <div className="flex items-center justify-between border-b border-ink pb-4 text-[0.68rem] font-mono uppercase tracking-[0.1em]">
                <span>Product</span>
                <button type="button" onClick={clearCart} className="link-underline text-graphite hover:text-ink">Clear bag</button>
              </div>
              <ul className="divide-y divide-rule">
                <AnimatePresence initial={false}>
                  {lines.map((l) => (
                    <CartLineItem key={l.key} line={l} large />
                  ))}
                </AnimatePresence>
              </ul>
            </div>

            <aside className="lg:col-span-5" aria-label="Order summary">
              <div className="bg-newsprint p-6 md:p-10 lg:sticky lg:top-[calc(var(--nav-offset,var(--header-h))+2rem)]">
                <h2 className="display text-4xl">Summary</h2>
                <dl className="mt-8 space-y-4 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-graphite">Subtotal</dt>
                    <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-graphite">Shipping</dt>
                    <dd className="tabular-nums">
                      {subtotal >= BRAND.freeShippingThreshold || shipping === 0 ? 'Complimentary' : shipping !== null ? formatPrice(shipping) : 'Calculated at checkout'}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t border-graphite/25 pt-4 text-base">
                    <dt>{accountCart ? 'Total' : 'Estimated total'}</dt>
                    <dd className="tabular-nums">{formatPrice(total)}</dd>
                  </div>
                </dl>
                <div className="mt-6">
                  <ShippingProgress subtotal={subtotal} />
                </div>
                <div className="mt-8 space-y-4">
                  {checkoutAvailable ? (
                    <ButtonLink to="/checkout" full arrow>Proceed to checkout</ButtonLink>
                  ) : (
                    <Button full arrow onClick={() => setNotice(true)}>Proceed to checkout</Button>
                  )}
                  <CheckoutNotice show={notice} />
                  <ButtonLink to="/shop" variant="outline" full>Continue shopping</ButtonLink>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>

      <section aria-labelledby="suggest-title" className="site-container border-t border-rule pb-24 pt-14 md:pb-36">
        <h2 id="suggest-title" className="display mb-10 text-4xl md:text-5xl">
          Complete <span className="italic">the wardrobe</span>
        </h2>
        <ProductGrid products={suggestions} columns={4} />
      </section>
    </>
  );
}
