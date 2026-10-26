import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Package } from 'lucide-react';
import { ApiError, mediaUrl, orderApi, paiseToRupees, type OrderSummaryDto, sized } from '@/lib/api';
import { useAuth } from '@/store/AuthContext';
import { OrderStatusBadge, formatDateTime } from '@/components/orders/OrderBits';
import { CatalogueError } from '@/components/product/CatalogueStates';
import { PageIntro } from '@/components/ui/PageIntro';
import { Button, ButtonLink } from '@/components/ui/Button';
import { BRAND } from '@/config/brand';
import { formatPrice } from '@/lib/format';

const PAGE_SIZE = 10;

function EmptyOrders({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center border-y border-rule px-6 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-newsprint">
        <Package strokeWidth={1.5} className="h-6 w-6 text-graphite" />
      </span>
      <p className="display mt-6 text-3xl">{title}</p>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-graphite">{body}</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">{children}</div>
    </div>
  );
}

function OrderRow({ order }: { order: OrderSummaryDto }) {
  return (
    <li>
      <Link to={`/orders/${order.orderNumber}`} className="group grid grid-cols-[1fr_auto] items-center gap-4 py-6 sm:grid-cols-[auto_1fr_auto_auto] sm:gap-8">
        <div className="hidden -space-x-4 sm:col-start-1 sm:row-start-1 sm:flex">
          {order.previewImages.map((src, i) => (
            <img decoding="async" key={src + i} src={sized(mediaUrl(src), 320)} alt="" className="h-20 w-16 border-2 border-paper bg-card object-cover" loading="lazy" />
          ))}
        </div>
        <div className="col-start-1 row-start-1 min-w-0 sm:col-start-2">
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-sm tracking-[0.05em]">{order.orderNumber}</p>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="mt-2 text-xs text-graphite">
            {formatDateTime(order.placedAt)} · {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
          </p>
        </div>
        <p className="col-start-2 row-start-1 text-sm tabular-nums sm:col-start-3">{formatPrice(paiseToRupees(order.total))}</p>
        <ChevronRight strokeWidth={1.25} className="hidden h-5 w-5 text-graphite transition-transform group-hover:translate-x-1 sm:col-start-4 sm:row-start-1 sm:block" aria-hidden />
      </Link>
    </li>
  );
}

/** Order history for the signed-in customer. */
export default function Orders() {
  const { status } = useAuth();
  const [orders, setOrders] = useState<OrderSummaryDto[] | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [error, setError] = useState<ApiError | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    document.title = `My orders — ${BRAND.name}`;
  }, []);

  const load = useCallback((nextPage: number, signal?: AbortSignal) => {
    setError(null);
    return orderApi
      .list(nextPage, PAGE_SIZE, signal)
      .then((res) => {
        setOrders((prev) => (nextPage === 0 || !prev ? res.items : [...prev, ...res.items]));
        setPage(res.page);
        setTotalPages(res.totalPages);
      })
      .catch((err) => {
        if ((err as Error).name !== 'AbortError') setError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Something went wrong.'));
      });
  }, []);

  useEffect(() => {
    if (status !== 'signed-in') return;
    const ctrl = new AbortController();
    void load(0, ctrl.signal);
    return () => ctrl.abort();
  }, [status, load]);

  const loadMore = async () => {
    setLoadingMore(true);
    await load(page + 1);
    setLoadingMore(false);
  };

  let body: React.ReactNode;
  if (status === 'unavailable') {
    body = (
      <EmptyOrders title="No orders yet." body="Orders need the CODE76 server, which isn’t connected in this preview.">
        <ButtonLink to="/shop" arrow>Start shopping</ButtonLink>
      </EmptyOrders>
    );
  } else if (status === 'signed-out') {
    body = (
      <EmptyOrders title="Sign in to see your orders." body="Your order history is saved to your account.">
        <ButtonLink to="/account?next=/orders" arrow>Sign in</ButtonLink>
        <ButtonLink to="/account?mode=register&next=/orders" variant="outline">Create an account</ButtonLink>
      </EmptyOrders>
    );
  } else if (error && !orders) {
    body = <CatalogueError error={error} onRetry={() => void load(0)} title="Couldn’t load your orders." />;
  } else if (!orders) {
    body = (
      <div aria-busy="true" className="divide-y divide-rule border-y border-rule">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-center gap-8 py-6">
            <div className="hidden h-20 w-16 animate-pulse bg-card sm:block" />
            <div className="flex-1 space-y-2"><div className="h-3.5 w-40 animate-pulse bg-rule" /><div className="h-3 w-56 animate-pulse bg-rule" /></div>
          </div>
        ))}
      </div>
    );
  } else if (orders.length === 0) {
    body = (
      <EmptyOrders title="No orders yet." body="When you place an order, it will appear here.">
        <ButtonLink to="/shop" arrow>Start shopping</ButtonLink>
        <ButtonLink to="/account" variant="outline">View wishlist</ButtonLink>
      </EmptyOrders>
    );
  } else {
    body = (
      <>
        <ul className="divide-y divide-rule border-y border-rule">
          {orders.map((o) => <OrderRow key={o.orderNumber} order={o} />)}
        </ul>
        {page + 1 < totalPages && (
          <div className="mt-10 flex justify-center">
            <Button variant="outline" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Show older orders'}</Button>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <PageIntro eyebrow="Account" title={['My orders']} />
      <section className="site-container pb-24 md:pb-36">{body}</section>
    </>
  );
}
