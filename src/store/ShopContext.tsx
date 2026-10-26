import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { BRAND } from '@/config/brand';
import { getColorway, type Product, type Size } from '@/data/products';
import { catalogueSource, demoProduct, fetchProductsBySlugs } from '@/lib/catalogue';
import { ApiError, accountApi, cartApi, mediaUrl, paiseToRupees, toProduct, type CartDto, type CartLineDto, type LineIssue, type WishlistDto } from '@/lib/api';
import { useAuth } from '@/store/AuthContext';

export interface CartLine {
  key: string;
  slug: string;
  colorId: string;
  size: Size;
  qty: number;
}

export interface ResolvedLine extends CartLine {
  product: Product;
  colorName: string;
  image: string;
  lineTotal: number;
  /** Signed in only: a problem the server found (sold out, not enough stock, no longer sold). */
  issue?: LineIssue | null;
  /** Signed in only: units still available for this line. */
  available?: number;
}

type CartAction =
  | { type: 'add'; slug: string; colorId: string; size: Size; qty?: number }
  | { type: 'setQty'; key: string; qty: number }
  | { type: 'remove'; key: string }
  | { type: 'clear' };

export interface Toast {
  id: number;
  title: string;
  body?: string;
  image?: string;
}

const MAX_QTY = 10;
const lineKey = (slug: string, colorId: string, size: Size) => `${slug}::${colorId}::${size}`;

function cartReducer(state: CartLine[], action: CartAction): CartLine[] {
  switch (action.type) {
    case 'add': {
      const key = lineKey(action.slug, action.colorId, action.size);
      const qty = action.qty ?? 1;
      const existing = state.find((l) => l.key === key);
      if (existing) return state.map((l) => (l.key === key ? { ...l, qty: Math.min(MAX_QTY, l.qty + qty) } : l));
      return [...state, { key, slug: action.slug, colorId: action.colorId, size: action.size, qty }];
    }
    case 'setQty':
      if (action.qty <= 0) return state.filter((l) => l.key !== action.key);
      return state.map((l) => (l.key === action.key ? { ...l, qty: Math.min(MAX_QTY, action.qty) } : l));
    case 'remove':
      return state.filter((l) => l.key !== action.key);
    case 'clear':
      return [];
  }
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — cart still works for this session */
  }
}

interface ShopContextValue {
  lines: ResolvedLine[];
  count: number;
  subtotal: number;
  /** The server's view of the bag (prices, shipping, total, problems) while signed in; null otherwise. */
  accountCart: CartDto | null;
  /** Re-reads the bag from the server, e.g. after checkout reports that something changed. */
  refreshCart: () => Promise<void>;
  addToCart: (slug: string, colorId: string, size: Size, qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  removeLine: (key: string) => void;
  clearCart: () => void;
  cartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  wishlist: string[];
  /** Saved products to display: from the account when signed in, else from this device. */
  wishlistProducts: Product[];
  toggleWishlist: (slug: string) => void;
  isWished: (slug: string) => boolean;
  toasts: Toast[];
  notify: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
}

const ShopContext = createContext<ShopContextValue | null>(null);

/** A bag line from the server, in the shape the bag UI already uses. The SKU is the line's key. */
function fromServerLine(l: CartLineDto): ResolvedLine {
  return {
    key: l.sku,
    slug: l.product.slug,
    colorId: l.colorCode,
    size: l.size,
    qty: l.quantity,
    product: toProduct(l.product),
    colorName: l.colorName,
    image: mediaUrl(l.image?.url),
    lineTotal: paiseToRupees(l.lineTotal),
    issue: l.issue,
    available: l.availableQuantity,
  };
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const [rawLines, dispatch] = useReducer(cartReducer, undefined, () =>
    // In the static preview, drop lines whose product no longer exists; with the server, unknown ones are fetched below.
    readStorage<CartLine[]>(BRAND.storageKeys.cart, []).filter((l) => catalogueSource === 'api' || demoProduct(l.slug)),
  );
  const [wishlist, setWishlist] = useState<string[]>(() => readStorage<string[]>(BRAND.storageKeys.wishlist, []));
  /** The account's saved products while signed in (null when signed out). */
  const [accountWishlist, setAccountWishlist] = useState<Product[] | null>(null);
  /** The account's bag while signed in (null when signed out). */
  const [accountCart, setAccountCart] = useState<CartDto | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const { status: authStatus } = useAuth();
  const signedIn = authStatus === 'signed-in';

  useEffect(() => writeStorage(BRAND.storageKeys.cart, rawLines), [rawLines]);
  // The device copy is only for guests; once signed in, the account (server) is the source of truth.
  useEffect(() => {
    if (authStatus === 'signed-out' || authStatus === 'unavailable') writeStorage(BRAND.storageKeys.wishlist, wishlist);
  }, [wishlist, authStatus]);

  /**
   * Products a guest's bag or wishlist refers to. With the server they're fetched by slug, so products
   * added in the admin work too; in the static preview the bundled catalogue is used.
   */
  const [known, setKnown] = useState<Record<string, Product>>({});
  const lookup = useCallback((slug: string) => known[slug] ?? demoProduct(slug), [known]);
  const requested = useRef(new Set<string>());
  useEffect(() => {
    if (catalogueSource !== 'api' || signedIn) return;
    const missing = [...new Set([...rawLines.map((l) => l.slug), ...wishlist])].filter((s) => !known[s] && !requested.current.has(s));
    if (missing.length === 0) return;
    missing.forEach((s) => requested.current.add(s));
    fetchProductsBySlugs(missing)
      .then((found) => setKnown((k) => ({ ...k, ...Object.fromEntries(found.map((p) => [p.slug, p])) })))
      .catch(() => missing.forEach((s) => requested.current.delete(s)));
  }, [rawLines, wishlist, known, signedIn]);

  const lines = useMemo<ResolvedLine[]>(() => {
    if (signedIn && accountCart) return accountCart.lines.map(fromServerLine);
    return rawLines.flatMap((l) => {
      const product = lookup(l.slug);
      if (!product) return [];
      const colorway = getColorway(product, l.colorId);
      return [{ ...l, product, colorName: colorway.name, image: colorway.images[0].src, lineTotal: product.price * l.qty }];
    });
  }, [rawLines, signedIn, accountCart, lookup]);

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const notify = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = ++toastId.current;
      setToasts((t) => [...t.slice(-2), { ...toast, id }]);
      window.setTimeout(() => dismissToast(id), 3800);
    },
    [dismissToast],
  );

  /** Runs a bag change on the server and shows the result; on failure the server's message is shown. */
  const updateAccountCart = useCallback(
    (change: Promise<CartDto>) =>
      change.then(setAccountCart).catch((err) => {
        notify({
          title: 'Couldn’t update your bag',
          body: err instanceof ApiError && err.status !== 0 ? err.message : 'Please check your connection and try again.',
        });
      }),
    [notify],
  );

  const addToCart = useCallback(
    (slug: string, colorId: string, size: Size, qty = 1) => {
      setCartOpen(true);
      if (signedIn) {
        void updateAccountCart(cartApi.add({ slug, color: colorId, size, quantity: qty }));
      } else {
        dispatch({ type: 'add', slug, colorId, size, qty });
      }
    },
    [signedIn, updateAccountCart],
  );

  const setQty = useCallback(
    (key: string, qty: number) => {
      if (!signedIn) return dispatch({ type: 'setQty', key, qty });
      void updateAccountCart(qty <= 0 ? cartApi.remove(key) : cartApi.setQuantity(key, qty));
    },
    [signedIn, updateAccountCart],
  );

  const removeLine = useCallback(
    (key: string) => (signedIn ? void updateAccountCart(cartApi.remove(key)) : dispatch({ type: 'remove', key })),
    [signedIn, updateAccountCart],
  );

  const clearCart = useCallback(
    () => (signedIn ? void updateAccountCart(cartApi.clear()) : dispatch({ type: 'clear' })),
    [signedIn, updateAccountCart],
  );

  const refreshCart = useCallback(async () => {
    if (signedIn) await cartApi.get().then(setAccountCart);
  }, [signedIn]);

  const applyAccountWishlist = useCallback((res: WishlistDto) => {
    const items = res.items.map(toProduct);
    setAccountWishlist(items);
    setWishlist(items.map((p) => p.slug));
  }, []);

  // Signing in: fold this device's hearts into the account, then use the account's list.
  // Signing out: forget the account's list on this device (it may be a shared computer).
  const previousAuth = useRef(authStatus);
  useEffect(() => {
    const before = previousAuth.current;
    previousAuth.current = authStatus;
    if (authStatus === 'signed-in' && before !== 'signed-in') {
      // Same for the bag: anything added while signed out joins the account's bag.
      const deviceBag = readStorage<CartLine[]>(BRAND.storageKeys.cart, []);
      (deviceBag.length
        ? cartApi.merge(deviceBag.map((l) => ({ slug: l.slug, color: l.colorId, size: l.size, quantity: l.qty })))
        : cartApi.get()
      )
        .then((cart) => {
          setAccountCart(cart);
          dispatch({ type: 'clear' }); // now safely stored in the account
        })
        .catch(() => notify({ title: 'Couldn’t load your bag', body: 'Please refresh to try again.' }));

      const deviceList = readStorage<string[]>(BRAND.storageKeys.wishlist, []);
      (deviceList.length ? accountApi.mergeWishlist(deviceList) : accountApi.wishlist())
        .then((res) => {
          applyAccountWishlist(res);
          writeStorage(BRAND.storageKeys.wishlist, []); // now safely stored in the account
        })
        .catch(() => notify({ title: 'Couldn’t load your wishlist', body: 'Please refresh to try again.' }));
    }
    if (before === 'signed-in' && authStatus === 'signed-out') {
      setAccountWishlist(null);
      setWishlist([]);
      setAccountCart(null);
      dispatch({ type: 'clear' });
    }
  }, [authStatus, applyAccountWishlist, notify]);

  const toggleWishlist = useCallback(
    (slug: string) => {
      const has = wishlist.includes(slug);
      const product = lookup(slug) ?? accountWishlist?.find((p) => p.slug === slug);
      setWishlist((w) => (has ? w.filter((s) => s !== slug) : w.includes(slug) ? w : [...w, slug]));
      notify({
        title: has ? 'Removed from wishlist' : 'Saved to wishlist',
        body: product?.name,
        image: product?.colorways[0].images[0].src,
      });
      if (!signedIn) return;
      // Update the screen instantly, then save to the account; undo if the save fails.
      (has ? accountApi.removeFromWishlist(slug) : accountApi.addToWishlist(slug)).then(applyAccountWishlist).catch(() => {
        setWishlist((w) => (has ? (w.includes(slug) ? w : [...w, slug]) : w.filter((s) => s !== slug)));
        notify({ title: 'Couldn’t update your wishlist', body: 'Please check your connection and try again.' });
      });
    },
    [wishlist, notify, signedIn, applyAccountWishlist, lookup, accountWishlist],
  );

  const wishlistProducts = useMemo(
    () =>
      signedIn && accountWishlist
        ? accountWishlist.filter((p) => wishlist.includes(p.slug))
        : wishlist.flatMap((slug) => {
            const p = lookup(slug);
            return p ? [p] : [];
          }),
    [signedIn, accountWishlist, wishlist, lookup],
  );

  const value: ShopContextValue = {
    lines,
    count: lines.reduce((n, l) => n + l.qty, 0),
    subtotal: signedIn && accountCart ? paiseToRupees(accountCart.subtotal) : lines.reduce((n, l) => n + l.lineTotal, 0),
    accountCart: signedIn ? accountCart : null,
    refreshCart,
    addToCart,
    setQty,
    removeLine,
    clearCart,
    cartOpen,
    openCart: () => setCartOpen(true),
    closeCart: () => setCartOpen(false),
    wishlist,
    wishlistProducts,
    toggleWishlist,
    isWished: (slug) => wishlist.includes(slug),
    toasts,
    notify,
    dismissToast,
  };

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShop must be used within ShopProvider');
  return ctx;
}

export const CART_MAX_QTY = MAX_QTY;
