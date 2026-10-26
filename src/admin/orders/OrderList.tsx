import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { paiseToRupees, type OrderStatus } from '@/lib/api';
import { formatPrice, cx } from '@/lib/format';
import { OrderStatusBadge, formatDateTime } from '@/components/orders/OrderBits';
import { adminApi } from '../adminApi';
import { AdminButton, AdminPage, EmptyState, ErrorBox, Loading, useLoad } from '../ui';

const TABS: { value: '' | OrderStatus; label: string }[] = [
  { value: 'confirmed', label: 'To ship' },
  { value: 'pending_payment', label: 'Awaiting payment' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'expired', label: 'Expired' },
  { value: '', label: 'All' },
];

export default function OrderList() {
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') ?? 'confirmed') as '' | OrderStatus;
  const q = params.get('q') ?? '';
  const [query, setQuery] = useState(q);
  const [page, setPage] = useState(0);
  const list = useLoad((signal) => adminApi.orders.list(status, q, page, signal), [status, q, page]);

  const setFilter = (next: Record<string, string>) => {
    setPage(0);
    setParams({ status, q, ...next }, { replace: true });
  };

  return (
    <AdminPage title="Orders" description="Paid orders wait under “To ship”. Open one to ship it, mark it delivered or cancel it.">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Filter by status">
          {TABS.map((t) => (
            <button
              key={t.value || 'all'}
              type="button"
              role="tab"
              aria-selected={status === t.value}
              onClick={() => setFilter({ status: t.value })}
              className={cx('h-9 shrink-0 px-3 text-sm', status === t.value ? 'bg-ink text-paper' : 'text-graphite hover:text-ink')}
            >
              {t.label}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); setFilter({ q: query.trim() }); }} className="flex w-full items-center gap-2 border border-rule bg-paper px-3 focus-within:border-ink sm:w-80">
          <Search className="h-4 w-4 text-graphite" aria-hidden />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Order number, name, email or phone" className="h-10 w-full bg-transparent text-sm outline-none" />
        </form>
      </div>

      {list.error ? (
        <ErrorBox error={list.error} onRetry={list.reload} />
      ) : !list.data ? (
        <Loading />
      ) : list.data.items.length === 0 ? (
        <EmptyState title={status === 'confirmed' && !q ? 'Nothing to ship right now' : 'No orders here'} body={q ? 'Try a different search.' : undefined} />
      ) : (
        <>
          <ul className="divide-y divide-rule border border-rule bg-paper">
            {list.data.items.map((o) => (
              <li key={o.orderNumber}>
                <Link to={`/admin/orders/${o.orderNumber}`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-newsprint sm:grid-cols-[10rem_1fr_auto_auto]">
                  <span className="font-mono text-sm">{o.orderNumber}</span>
                  <span className="col-start-1 row-start-2 min-w-0 truncate text-xs text-graphite sm:col-start-2 sm:row-start-1 sm:text-sm sm:text-ink">
                    {o.customerName} <span className="text-graphite">· {o.city} · {o.itemCount} {o.itemCount === 1 ? 'item' : 'items'} · {formatDateTime(o.placedAt)}</span>
                  </span>
                  <span className="text-right text-sm tabular-nums">{formatPrice(paiseToRupees(o.total))}</span>
                  <span className="col-start-2 row-start-2 text-right sm:col-start-4 sm:row-start-1"><OrderStatusBadge status={o.status} /></span>
                </Link>
              </li>
            ))}
          </ul>
          {list.data.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3 text-sm">
              <AdminButton variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Newer</AdminButton>
              <span className="text-graphite">Page {page + 1} of {list.data.totalPages}</span>
              <AdminButton variant="outline" disabled={page + 1 >= list.data.totalPages} onClick={() => setPage((p) => p + 1)}>Older</AdminButton>
            </div>
          )}
        </>
      )}
    </AdminPage>
  );
}
