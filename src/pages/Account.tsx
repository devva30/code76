import { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useShop } from '@/store/ShopContext';
import { useAuth } from '@/store/AuthContext';
import { AuthForm, type AuthMode } from '@/components/account/AuthForm';
import { PageIntro } from '@/components/ui/PageIntro';
import { ProductGrid } from '@/components/product/ProductGrid';
import { ProductGridSkeleton } from '@/components/product/CatalogueStates';
import { Button, ButtonLink } from '@/components/ui/Button';
import { BRAND } from '@/config/brand';
import type { Product } from '@/data/products';

const memberSince = new Intl.DateTimeFormat(BRAND.locale, { month: 'long', year: 'numeric' });

function EmptyWishlist({ compact }: { compact?: boolean }) {
  return (
    <div className={compact ? 'border border-dashed border-rule px-6 py-14 text-center' : 'flex flex-col items-center border-y border-rule py-24 text-center'}>
      <p className={compact ? 'display text-3xl' : 'display text-4xl md:text-[2.6rem]'}>Nothing saved yet.</p>
      <p className="mx-auto mt-4 max-w-sm text-sm text-graphite">Tap the heart on any piece to keep it here for later.</p>
      <div className="mt-8">
        <ButtonLink to="/shop" arrow>Browse the collection</ButtonLink>
      </div>
    </div>
  );
}

function Wishlist({ products, title, note }: { products: Product[]; title: string; note?: string }) {
  return (
    <section aria-labelledby="wishlist-title" className="site-container pb-24 md:pb-36">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3 border-b border-rule pb-4">
        <h2 id="wishlist-title" className="display text-3xl md:text-4xl">{title}</h2>
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.1em] text-graphite">
          {products.length} {products.length === 1 ? 'piece' : 'pieces'}
        </p>
      </div>
      {note && <p className="-mt-4 mb-8 text-xs text-graphite">{note}</p>}
      {products.length === 0 ? <EmptyWishlist compact /> : <ProductGrid products={products} columns={4} />}
    </section>
  );
}

/**
 * Signed out: sign-in / create-account forms, plus anything saved on this device.
 * Signed in: profile, sign out, and the wishlist stored in the account.
 * Without an API (static preview) accounts are off and the wishlist stays on the device.
 */
export default function Account() {
  const { wishlistProducts, notify } = useShop();
  const { status, user, signOut } = useAuth();
  const [params, setParams] = useSearchParams();
  const mode: AuthMode = params.get('mode') === 'register' ? 'register' : 'sign-in';
  // Where to go after signing in, e.g. back to checkout. Only paths on this site are allowed.
  const rawNext = params.get('next');
  const next = rawNext && /^\/(?![/\\])/.test(rawNext) ? rawNext : null;

  useEffect(() => {
    document.title = `${status === 'signed-in' ? 'Your account' : mode === 'register' ? 'Create an account' : status === 'unavailable' ? 'Wishlist' : 'Sign in'} — ${BRAND.name}`;
  }, [status, mode]);

  const setMode = (m: AuthMode) => {
    const p: Record<string, string> = m === 'register' ? { mode: 'register' } : {};
    if (next) p.next = next;
    setParams(p, { replace: true, preventScrollReset: true });
  };

  if (status === 'unavailable') {
    return (
      <>
        <PageIntro
          eyebrow="Account"
          title={['Your', <span className="italic">wishlist</span>]}
          aside={
            <div className="max-w-xs border-l border-rule pl-5 text-xs leading-relaxed text-graphite">
              Accounts need the CODE76 server. In this preview, saved pieces stay on this device.
            </div>
          }
        />
        <section className="site-container pb-24 md:pb-36">
          {wishlistProducts.length === 0 ? <EmptyWishlist /> : <ProductGrid products={wishlistProducts} columns={4} />}
        </section>
      </>
    );
  }

  if (status === 'loading') {
    return (
      <>
        <PageIntro eyebrow="Account" title={['Your', <span className="italic">account</span>]} />
        <section className="site-container pb-24" aria-busy="true">
          <ProductGridSkeleton count={4} />
        </section>
      </>
    );
  }

  if (status === 'signed-in' && user && next) return <Navigate to={next} replace />;

  if (status === 'signed-in' && user) {
    const firstName = user.name.split(/\s+/)[0];
    const handleSignOut = async () => {
      await signOut();
      notify({ title: 'Signed out', body: 'See you soon.' });
    };
    return (
      <>
        <PageIntro
          eyebrow="Account"
          title={['Hello,', <span className="italic">{firstName}</span>]}
          aside={
            <div className="max-w-xs border-l border-rule pl-5 text-sm leading-relaxed">
              <p className="break-all">{user.email}</p>
              <p className="mt-1 text-xs text-graphite">Member since {memberSince.format(new Date(user.memberSince))}</p>
              {user.role === 'admin' && (
                <ButtonLink to="/admin" className="mt-5 h-10 w-full px-5">Open admin panel</ButtonLink>
              )}
              <Button variant="outline" onClick={handleSignOut} className="mt-5 h-10 px-5">
                <LogOut strokeWidth={1.5} className="mr-2 inline h-4 w-4" aria-hidden />
                Sign out
              </Button>
            </div>
          }
        >
          Your wishlist is saved to your account, so it follows you on every device.
        </PageIntro>
        <Wishlist products={wishlistProducts} title="Your wishlist" />
      </>
    );
  }

  return (
    <>
      <PageIntro
        key={mode}
        eyebrow="Account"
        title={mode === 'register' ? ['Create an', <span className="italic">account</span>] : ['Welcome', <span className="italic">back</span>]}
      >
        {next === '/checkout'
          ? 'Sign in or create an account to check out. Your bag comes with you.'
          : mode === 'register'
            ? 'Save your wishlist and bag across devices, check out, and track your orders.'
            : 'Sign in to see your saved pieces, bag and orders on any device.'}
      </PageIntro>
      <section className="site-container pb-16 md:pb-24">
        <div className="max-w-md">
          <AuthForm mode={mode} onModeChange={setMode} />
        </div>
      </section>
      {wishlistProducts.length > 0 && (
        <Wishlist products={wishlistProducts} title="Saved on this device" note="Sign in and these will be added to your account." />
      )}
    </>
  );
}
