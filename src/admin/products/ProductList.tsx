import { useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, GripVertical, ImageIcon, Plus, Search } from 'lucide-react';
import { mediaUrl, paiseToRupees } from '@/lib/api';
import { sizeLabel } from '@/data/products';
import { cx, formatPrice } from '@/lib/format';
import { adminApi, type ProductRow, type ProductStatus } from '../adminApi';
import { AdminButton, AdminPage, Badge, EmptyState, ErrorBox, Loading, errorMessage, useLoad } from '../ui';

const STATUS_FILTERS: { value: '' | ProductStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'published', label: 'Live' },
  { value: 'draft', label: 'Drafts' },
  { value: 'archived', label: 'Archived' },
];

export function StatusBadge({ status, live }: { status: ProductStatus; live?: boolean }) {
  if (status === 'published') return live === false ? <Badge tone="alert">Live · hidden</Badge> : <Badge tone="good">Live</Badge>;
  if (status === 'draft') return <Badge tone="neutral">Draft</Badge>;
  return <Badge tone="muted">Archived</Badge>;
}

function Thumb({ src }: { src: string | null }) {
  return (
    <div className="h-14 w-11 shrink-0 overflow-hidden bg-newsprint">
      {src ? <img src={mediaUrl(src)} alt="" className="h-full w-full object-cover" loading="lazy" /> : (
        <span className="flex h-full items-center justify-center text-graphite"><ImageIcon className="h-4 w-4" strokeWidth={1.3} /></span>
      )}
    </div>
  );
}

/** Drag rows (or use the arrows) to set the order products appear in the shop. */
function ReorderList({ rows, onDone }: { rows: ProductRow[]; onDone: (saved: ProductRow[] | null) => void }) {
  const [order, setOrder] = useState(rows);
  const [dragging, setDragging] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    setOrder((o) => {
      const next = [...o];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };
  const onDragOver = (e: DragEvent, index: number) => {
    e.preventDefault();
    if (dragging !== null && dragging !== index) {
      move(dragging, index);
      setDragging(index);
    }
  };
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      onDone(await adminApi.products.reorder(order.map((r) => r.id)));
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-ink bg-paper px-4 py-3">
        <p className="text-sm">Drag products into the order you want, top first. This is the shop’s “Featured” order and the home page carousel order.</p>
        <div className="flex gap-2">
          <AdminButton variant="outline" onClick={() => onDone(null)} disabled={saving}>Cancel</AdminButton>
          <AdminButton onClick={save} busy={saving}>Save order</AdminButton>
        </div>
      </div>
      {error && <div className="mb-4"><ErrorBox error={error} /></div>}
      <ol className="divide-y divide-rule border border-rule bg-paper">
        {order.map((r, i) => (
          <li
            key={r.id}
            draggable
            onDragStart={() => setDragging(i)}
            onDragOver={(e) => onDragOver(e, i)}
            onDragEnd={() => setDragging(null)}
            className={cx('flex items-center gap-4 px-3 py-2', dragging === i && 'bg-newsprint')}
          >
            <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-graphite" aria-hidden />
            <span className="w-6 text-right font-mono text-xs text-graphite">{i + 1}</span>
            <Thumb src={r.thumbnail} />
            <span className="min-w-0 flex-1 truncate text-sm">{r.name}</span>
            <StatusBadge status={r.status} live={r.live} />
            <div className="flex">
              <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${r.name} up`} className="flex h-9 w-9 items-center justify-center text-graphite hover:text-ink disabled:opacity-30">
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => move(i, i + 1)} disabled={i === order.length - 1} aria-label={`Move ${r.name} down`} className="flex h-9 w-9 items-center justify-center text-graphite hover:text-ink disabled:opacity-30">
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function ProductList() {
  const [status, setStatus] = useState<'' | ProductStatus>('');
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [reordering, setReordering] = useState(false);
  const list = useLoad((signal) => adminApi.products.list(submitted, status, signal), [submitted, status]);
  const rows = list.data ?? [];

  return (
    <AdminPage
      title="Products"
      description="Every T-shirt in the store. Drafts stay hidden until you publish them."
      actions={
        !reordering && (
          <>
            <AdminButton variant="outline" onClick={() => { setStatus(''); setSubmitted(''); setQuery(''); setReordering(true); }}>Change display order</AdminButton>
            <Link to="/admin/products/new"><AdminButton><Plus className="h-4 w-4" aria-hidden /> New product</AdminButton></Link>
          </>
        )
      }
    >
      {reordering ? (
        list.data ? (
          <ReorderList rows={rows} onDone={(saved) => { setReordering(false); if (saved) list.setData(saved); }} />
        ) : <Loading />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filter by status">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  role="tab"
                  aria-selected={status === f.value}
                  onClick={() => setStatus(f.value)}
                  className={cx('h-9 px-3 text-sm', status === f.value ? 'bg-ink text-paper' : 'text-graphite hover:text-ink')}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); setSubmitted(query.trim()); }} className="flex w-full items-center gap-2 border border-rule bg-paper px-3 focus-within:border-ink sm:w-72">
              <Search className="h-4 w-4 text-graphite" aria-hidden />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products" className="h-10 w-full bg-transparent text-sm outline-none" />
            </form>
          </div>

          {list.error ? (
            <ErrorBox error={list.error} onRetry={list.reload} />
          ) : list.loading && !list.data ? (
            <Loading />
          ) : rows.length === 0 ? (
            <EmptyState title="No products here" body={submitted || status ? 'Try another search or filter.' : 'Create your first product.'} />
          ) : (
            <ul className="divide-y divide-rule border border-rule bg-paper">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link to={`/admin/products/${r.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-newsprint">
                    <Thumb src={r.thumbnail} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.name}</p>
                      <p className="mt-0.5 truncate text-xs text-graphite">
                        {r.category} · {r.fit === 'oversized' ? 'Oversized' : 'Regular'} · {r.colorCount} {r.colorCount === 1 ? 'colour' : 'colours'}
                        {r.sizes.length > 0 && ` · ${r.sizes.map(sizeLabel).join(' ')}`}
                      </p>
                    </div>
                    <div className="hidden text-right text-sm tabular-nums sm:block">
                      {formatPrice(paiseToRupees(r.price))}
                      {r.compareAtPrice && <p className="text-xs text-graphite line-through">{formatPrice(paiseToRupees(r.compareAtPrice))}</p>}
                    </div>
                    <div className="hidden w-20 text-right text-xs text-graphite md:block">{r.stock} in stock</div>
                    <div className="w-28 text-right"><StatusBadge status={r.status} live={r.live} /></div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </AdminPage>
  );
}
