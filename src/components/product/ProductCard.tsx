import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, Plus, X } from 'lucide-react';
import { getColorway, sizeLabel, type Product, type Size } from '@/data/products';
import { useShop } from '@/store/ShopContext';
import { EASE, useMediaQuery } from '@/lib/motion';
import { cx, discountPercent, formatPrice } from '@/lib/format';
import { sized, srcSetFor } from '@/lib/api';

interface ProductCardProps {
  product: Product;
  priority?: boolean;
  className?: string;
  /** Position in a list, printed as a ticket number (e.g. No. 03). */
  index?: number;
  /** How wide the card shows, for picking the photo size (defaults suit carousels). */
  sizes?: string;
}

const CAROUSEL_SIZES = '(min-width: 1536px) 22vw, (min-width: 1024px) 25vw, (min-width: 640px) 42vw, 70vw';

function QuickAddSizes({ product, colorId, onDone }: { product: Product; colorId: string; onDone?: () => void }) {
  const { addToCart } = useShop();
  const colorway = getColorway(product, colorId);
  return (
    <div>
      <p className="mb-2 flex items-center justify-between font-mono text-[0.6rem] uppercase tracking-[0.1em]">
        <span>Select size</span>
        <span className="text-graphite">{colorway.name}</span>
      </p>
      <div className="grid grid-cols-6 gap-1">
        {product.sizes.map((s: Size) => {
          const out = colorway.soldOut?.includes(s);
          return (
            <button
              key={s}
              type="button"
              disabled={out}
              onClick={(e) => {
                e.preventDefault();
                addToCart(product.slug, colorway.id, s);
                onDone?.();
              }}
              aria-label={out ? `${sizeLabel(s)} sold out` : `Add size ${sizeLabel(s)} to bag`}
              className={cx(
                'h-8 border font-mono text-[0.65rem] font-medium transition-colors duration-300',
                out ? 'cursor-not-allowed border-rule text-graphite/40 line-through' : 'border-ink/20 hover:border-ink hover:bg-ink hover:text-paper',
              )}
            >
              {sizeLabel(s)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Product “ticket”: photo on a soft card, a perforated tear line, then the
 * spec — fit label, name, price (with offer pricing) and colourways.
 */
export function ProductCard({ product, priority, className, sizes = CAROUSEL_SIZES }: ProductCardProps) {
  const [colorId, setColorId] = useState(product.colorways[0].id);
  const [quickOpen, setQuickOpen] = useState(false);
  const [primaryLoaded, setPrimaryLoaded] = useState(false);
  // The hover image is fully clipped, so native lazy-loading would never start it;
  // fetch it once the primary has loaded, and only where hover exists.
  const canHover = useMediaQuery('(hover: hover) and (min-width: 768px)');
  const { toggleWishlist, isWished } = useShop();
  const colorway = getColorway(product, colorId);
  const [primary, secondary] = colorway.images;
  const href = `/product/${product.slug}${colorId !== product.colorways[0].id ? `?color=${colorId}` : ''}`;
  const wished = isWished(product.slug);
  const off = discountPercent(product.price, product.compareAtPrice);
  const fitTag = product.fit === 'oversized' ? 'Oversized' : 'Regular fit';

  return (
    <article
      data-product-card
      className={cx('group/card press relative flex flex-col border border-rule bg-surface hover:border-ink', className)}
    >
      {/* Image */}
      <div className="relative">
        <Link to={href} className="block" aria-label={`${product.name}, ${colorway.name}, ${formatPrice(product.price)}`}>
          <div className="relative aspect-[4/5] overflow-hidden bg-card">
            <AnimatePresence initial={false}>
              <motion.img
                key={primary.src}
                src={sized(primary.src, 640)}
                srcSet={srcSetFor(primary.src, 1280)}
                sizes={sizes}
                alt={primary.alt}
                loading={priority ? 'eager' : 'lazy'}
                decoding="async"
                onLoad={() => setPrimaryLoaded(true)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.6s] ease-editorial group-hover/card:scale-[1.04]"
              />
            </AnimatePresence>
            {secondary && canHover && primaryLoaded && (
              <img
                src={sized(secondary.src, 640)}
                srcSet={srcSetFor(secondary.src, 1280)}
                sizes={sizes}
                alt=""
                aria-hidden
                decoding="async"
                className="absolute inset-0 h-full w-full scale-[1.06] object-cover transition-[clip-path,transform] duration-[1.1s] ease-editorial [clip-path:inset(100%_0_0_0)] group-hover/card:scale-100 group-hover/card:[clip-path:inset(0_0_0_0)]"
              />
            )}
          </div>
        </Link>

        <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
          {product.isNew && <span className="stamp-mark">New</span>}
          {off > 0 && <span className="bg-stamp px-1.5 py-[3px] font-mono text-[0.6rem] font-medium uppercase text-paper">−{off}%</span>}
        </div>

        <button
          type="button"
          onClick={() => toggleWishlist(product.slug)}
          aria-pressed={wished}
          aria-label={wished ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center bg-paper/90 text-ink transition-colors hover:bg-paper"
        >
          <Heart strokeWidth={1.6} className={cx('h-4 w-4', wished && 'fill-stamp text-stamp')} />
        </button>

        {/* Quick add: hover panel on desktop, toggled panel on touch */}
        <div className="pointer-events-none absolute inset-x-2 bottom-2 hidden translate-y-2 border border-ink bg-paper p-2.5 opacity-0 transition-all duration-500 ease-editorial group-focus-within/card:pointer-events-auto group-focus-within/card:translate-y-0 group-focus-within/card:opacity-100 group-hover/card:pointer-events-auto group-hover/card:translate-y-0 group-hover/card:opacity-100 lg:block">
          <QuickAddSizes product={product} colorId={colorId} />
        </div>
        <button
          type="button"
          onClick={() => setQuickOpen((o) => !o)}
          aria-expanded={quickOpen}
          aria-label={quickOpen ? 'Close quick add' : `Quick add ${product.name}`}
          className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center bg-solid text-onsolid lg:hidden"
        >
          {quickOpen ? <X strokeWidth={1.75} className="h-4 w-4" /> : <Plus strokeWidth={1.75} className="h-4 w-4" />}
        </button>
        <AnimatePresence>
          {quickOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="absolute inset-x-2 bottom-12 border border-ink bg-paper p-2 lg:hidden"
            >
              <QuickAddSizes product={product} colorId={colorId} onDone={() => setQuickOpen(false)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Perforated tear line */}
      <div aria-hidden className="relative h-px border-t border-dashed border-ink/25">
        <span className="absolute -left-[5px] -top-[5px] h-[9px] w-[9px] rounded-full border border-rule bg-paper transition-colors group-hover/card:border-ink" />
        <span className="absolute -right-[5px] -top-[5px] h-[9px] w-[9px] rounded-full border border-rule bg-paper transition-colors group-hover/card:border-ink" />
      </div>

      {/* Spec */}
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2 whitespace-nowrap font-mono text-[0.6rem] uppercase tracking-[0.1em] sm:text-[0.62rem]">
          <span className="truncate text-stamp">{fitTag}</span>
        </div>
        <h3 className="mt-2 text-[0.85rem] font-semibold leading-snug sm:text-[0.95rem]">
          <Link to={href} className="link-underline">{product.name}</Link>
        </h3>
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <p className="font-mono text-[0.78rem] tabular-nums sm:text-[0.85rem]">
            {product.compareAtPrice && off > 0 && (
              <span className="mr-1.5 text-graphite line-through decoration-graphite/60">{formatPrice(product.compareAtPrice)}</span>
            )}
            <span className={cx(off > 0 && 'text-stamp')}>{formatPrice(product.price)}</span>
          </p>
          <div role="radiogroup" aria-label="Colour" className="flex shrink-0 items-center gap-1.5">
            {product.colorways.map((c) => {
              const active = c.id === colorId;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={c.name}
                  title={c.name}
                  onClick={() => setColorId(c.id)}
                  onMouseEnter={() => setColorId(c.id)}
                  className={cx(
                    'h-3.5 w-3.5 rounded-full transition-shadow',
                    active ? 'shadow-[0_0_0_1.5px_rgb(var(--c-surface)),0_0_0_2.5px_rgb(var(--c-ink))]' : 'shadow-[0_0_0_1px_rgb(var(--c-ink)/0.2)]',
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </article>
  );
}
