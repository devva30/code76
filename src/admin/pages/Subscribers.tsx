import { useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { formatDateTime } from '@/components/orders/OrderBits';
import { API_BASE_URL } from '@/lib/api';
import { subscribersApi, type SubscriberDto } from '../adminApi';
import { AdminButton, AdminPage, Card, Dialog, EmptyState, ErrorBox, Loading, TextField, errorMessage, useLoad } from '../ui';

/** Admin → Subscribers: everyone who signed up for the newsletter on the website. */
export default function Subscribers() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const list = useLoad((signal) => subscribersApi.list(search, page, signal), [search, page]);
  const [removing, setRemoving] = useState<SubscriberDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    setProblem(null);
    try {
      await subscribersApi.remove(removing.id);
      setRemoving(null);
      list.reload();
    } catch (err) {
      setProblem(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const data = list.data;
  return (
    <AdminPage
      title="Subscribers"
      description="People who signed up for the newsletter on the website. Download the list to import into an email service such as Mailchimp or Brevo."
      actions={
        <a href={`${API_BASE_URL ?? ''}/api/admin/subscribers.csv`} className="inline-flex h-10 items-center gap-2 bg-ink px-4 text-sm font-semibold text-paper hover:bg-ink/90">
          <Download className="h-4 w-4" aria-hidden /> Download list (CSV)
        </a>
      }
    >
      <form
        className="mb-5 flex max-w-md items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(0);
          setSearch(q.trim());
        }}
      >
        <TextField label="Find an email" value={q} onChange={setQ} placeholder="name@example.com" className="flex-1" />
        <AdminButton type="submit" variant="outline">Search</AdminButton>
      </form>

      {list.error ? (
        <ErrorBox error={list.error} onRetry={list.reload} />
      ) : !data ? (
        <Loading />
      ) : data.items.length === 0 ? (
        <EmptyState title={search ? 'No one matches that search' : 'No subscribers yet'} body={search ? undefined : 'Sign-ups from the website’s newsletter forms will appear here.'} />
      ) : (
        <>
          <p className="mb-2 text-sm text-graphite">{data.totalItems} {data.totalItems === 1 ? 'subscriber' : 'subscribers'}</p>
          <Card padded={false}>
            <ul className="divide-y divide-rule text-sm">
              {data.items.map((s) => (
                <li key={s.id} className="flex items-center gap-4 px-5 py-2.5">
                  <span className="min-w-0 flex-1 truncate">{s.email}</span>
                  <span className="hidden whitespace-nowrap text-xs text-graphite sm:inline">{formatDateTime(s.createdAt)}</span>
                  <button type="button" onClick={() => setRemoving(s)} aria-label={`Remove ${s.email}`} title="Remove (unsubscribe)" className="flex h-9 w-9 items-center justify-center text-graphite hover:text-[rgb(var(--c-stamp))]">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          {data.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <AdminButton variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</AdminButton>
              <span className="text-graphite">Page {page + 1} of {data.totalPages}</span>
              <AdminButton variant="outline" disabled={page + 1 >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</AdminButton>
            </div>
          )}
        </>
      )}

      <Dialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Remove this subscriber?"
        footer={
          <>
            <AdminButton variant="outline" onClick={() => setRemoving(null)}>Cancel</AdminButton>
            <AdminButton variant="danger" busy={busy} onClick={remove}>Remove</AdminButton>
          </>
        }
      >
        <p className="text-sm">{removing?.email} will be taken off the newsletter list. Do this when someone asks to unsubscribe.</p>
        {problem && <p className="mt-3 text-sm text-[rgb(var(--c-stamp))]">{problem}</p>}
      </Dialog>
    </AdminPage>
  );
}
