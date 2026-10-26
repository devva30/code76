import { formatDateTime } from '@/components/orders/OrderBits';
import { adminApi } from '../adminApi';
import { AdminPage, Badge, Card, EmptyState, ErrorBox, Loading, useLoad } from '../ui';

/** The admin diary: who changed what, and when. */
export default function Activity() {
  const activity = useLoad((signal) => adminApi.activity(signal));
  return (
    <AdminPage title="Activity" description="Every change made in the admin panel, newest first. Entries can’t be edited or deleted.">
      {activity.error ? (
        <ErrorBox error={activity.error} onRetry={activity.reload} />
      ) : !activity.data ? (
        <Loading />
      ) : activity.data.length === 0 ? (
        <EmptyState title="No changes yet" />
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-rule text-sm">
            {activity.data.map((a) => (
              <li key={a.id} className="grid gap-1 px-5 py-3 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6">
                <div className="min-w-0">
                  <p>{a.summary}</p>
                  <p className="mt-0.5 text-xs text-graphite">{a.adminEmail}</p>
                </div>
                <div className="flex items-center gap-3 sm:justify-end">
                  <Badge tone="muted">{a.action.replace(/_/g, ' ').toLowerCase()}</Badge>
                  <span className="whitespace-nowrap text-xs text-graphite">{formatDateTime(a.at)}</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </AdminPage>
  );
}
