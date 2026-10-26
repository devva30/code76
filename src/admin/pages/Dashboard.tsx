import { Link } from 'react-router-dom';
import { paiseToRupees } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { useAuth } from '@/store/AuthContext';
import { adminApi } from '../adminApi';
import { AdminPage, Badge, Card, ErrorBox, Loading, StatCard, useLoad } from '../ui';
import { formatDateTime } from '@/components/orders/OrderBits';

export default function Dashboard() {
  const { user } = useAuth();
  const overview = useLoad((signal) => adminApi.overview(signal));
  const activity = useLoad((signal) => adminApi.activity(signal));
  const o = overview.data;

  return (
    <AdminPage title={`Hello, ${user?.name.split(/\s+/)[0] ?? 'there'}`} description="What needs your attention today.">
      {overview.error ? (
        <ErrorBox error={overview.error} onRetry={overview.reload} />
      ) : !o ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="To ship" value={o.ordersToShip} hint="Paid, waiting to be sent" to="/admin/orders?status=confirmed" tone={o.ordersToShip > 0 ? 'alert' : undefined} />
            <StatCard label="Awaiting payment" value={o.awaitingPayment} hint="Held for 30 minutes" to="/admin/orders?status=pending_payment" />
            <StatCard label="Orders today" value={o.ordersToday} to="/admin/orders" />
            <StatCard label="Sales, last 7 days" value={formatPrice(paiseToRupees(o.revenueLast7Days))} hint={`${o.paidOrdersLast7Days} paid ${o.paidOrdersLast7Days === 1 ? 'order' : 'orders'}`} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Products live" value={o.publishedProducts} to="/admin/products" />
            <StatCard label="Drafts" value={o.draftProducts} to="/admin/products" />
            <StatCard label="Customers" value={o.customers} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Running low" padded={false}>
              {o.lowStock.length === 0 ? (
                <p className="p-5 text-sm text-graphite">Every live size has more than 3 in stock.</p>
              ) : (
                <ul className="divide-y divide-rule text-sm">
                  {o.lowStock.map((s) => (
                    <li key={s.sku} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <Link to={`/admin/products/${s.productSlug}`} className="truncate hover:underline">{s.productName}</Link>
                        <p className="text-xs text-graphite">{s.colorName} · {s.size} · {s.sku}</p>
                      </div>
                      <Badge tone={s.available === 0 ? 'alert' : 'neutral'}>{s.available === 0 ? 'Sold out' : `${s.available} left`}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Recent changes" actions={<Link to="/admin/activity" className="text-xs text-graphite hover:text-ink">See all</Link>} padded={false}>
              {activity.error ? (
                <div className="p-5"><ErrorBox error={activity.error} /></div>
              ) : !activity.data ? (
                <div className="px-5"><Loading /></div>
              ) : activity.data.length === 0 ? (
                <p className="p-5 text-sm text-graphite">Nothing yet. Changes you make in the admin will appear here.</p>
              ) : (
                <ul className="divide-y divide-rule text-sm">
                  {activity.data.slice(0, 8).map((a) => (
                    <li key={a.id} className="px-5 py-3">
                      <p>{a.summary}</p>
                      <p className="mt-0.5 text-xs text-graphite">{a.adminEmail} · {formatDateTime(a.at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
