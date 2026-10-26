import { useCallback, useRef, useState, type DragEvent } from 'react';
import { Check, Copy, ImagePlus, Search, Trash2, UploadCloud } from 'lucide-react';
import { mediaUrl } from '@/lib/api';
import { cx } from '@/lib/format';
import { adminApi, type MediaDto } from '../adminApi';
import { AdminButton, AdminPage, Dialog, EmptyState, ErrorBox, Loading, TextArea, errorMessage, formatBytes, useLoad } from '../ui';
import { prepareImage } from './prepareImage';

// ---- uploading ----

interface QueueItem {
  key: string;
  name: string;
  state: 'preparing' | 'uploading' | 'done' | 'error';
  error?: string;
}

/** Shrinks each file, uploads it, and tracks progress for the list under the drop zone. */
export function useUploader() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const upload = useCallback(async (files: File[]) => {
    const uploaded: MediaDto[] = [];
    for (const file of files) {
      const key = `${file.name}-${file.size}-${Math.random()}`;
      const set = (patch: Partial<QueueItem>) => setQueue((q) => q.map((i) => (i.key === key ? { ...i, ...patch } : i)));
      setQueue((q) => [{ key, name: file.name, state: 'preparing' as const }, ...q].slice(0, 12));
      try {
        const ready = await prepareImage(file);
        set({ state: 'uploading' });
        uploaded.push(await adminApi.media.upload(ready));
        set({ state: 'done' });
      } catch (err) {
        set({ state: 'error', error: errorMessage(err) });
      }
    }
    return uploaded;
  }, []);
  return { queue, upload };
}

export function DropZone({ onFiles, compact }: { onFiles: (files: File[]) => void; compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const take = (list: FileList | null) => list && list.length > 0 && onFiles(Array.from(list));
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    take(e.dataTransfer.files);
  };
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={cx('flex flex-col items-center justify-center border border-dashed text-center transition-colors', compact ? 'px-4 py-6' : 'px-6 py-10', over ? 'border-ink bg-newsprint' : 'border-ink/25')}
    >
      <UploadCloud className="h-7 w-7 text-graphite" strokeWidth={1.4} aria-hidden />
      <p className="mt-3 text-sm">Drag images here, or</p>
      <AdminButton variant="outline" className="mt-3" onClick={() => input.current?.click()}>
        <ImagePlus className="h-4 w-4" aria-hidden /> Choose files
      </AdminButton>
      <p className="mt-3 text-xs text-graphite">JPEG, PNG or WebP, up to 10 MB. Large photos are resized and converted to WebP automatically.</p>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { take(e.target.files); e.target.value = ''; }} />
    </div>
  );
}

export function UploadQueue({ queue }: { queue: QueueItem[] }) {
  if (queue.length === 0) return null;
  const label = { preparing: 'Preparing…', uploading: 'Uploading…', done: 'Uploaded', error: 'Failed' };
  return (
    <ul className="mt-3 divide-y divide-rule border border-rule text-sm" aria-live="polite">
      {queue.map((q) => (
        <li key={q.key} className="flex items-center justify-between gap-4 px-4 py-2">
          <span className="truncate">{q.name}</span>
          <span className={cx('shrink-0 text-xs', q.state === 'error' ? 'text-[rgb(var(--c-stamp))]' : 'text-graphite')}>
            {q.state === 'error' ? q.error : label[q.state]}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ---- grid ----

export function MediaGrid({ items, selectedId, onSelect }: { items: MediaDto[]; selectedId?: number; onSelect: (m: MediaDto) => void }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {items.map((m) => (
        <li key={m.id}>
          <button
            type="button"
            onClick={() => onSelect(m)}
            className={cx('group block w-full border text-left transition-colors', selectedId === m.id ? 'border-ink ring-1 ring-ink' : 'border-rule hover:border-ink')}
          >
            <div className="relative aspect-square overflow-hidden bg-newsprint">
              <img src={mediaUrl(m.url)} alt={m.altText} loading="lazy" className="h-full w-full object-cover" />
              {selectedId === m.id && (
                <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-paper"><Check className="h-3.5 w-3.5" /></span>
              )}
            </div>
            <div className="px-2.5 py-2">
              <p className="truncate text-xs">{m.fileName}</p>
              <p className="text-[0.65rem] text-graphite">{m.width}×{m.height} · {formatBytes(m.sizeBytes)}</p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Search + paging over the library; shared by the page and the picker. */
export function useMediaList() {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [extra, setExtra] = useState<MediaDto[]>([]);
  const [page, setPage] = useState(0);
  const first = useLoad((signal) => adminApi.media.list(submitted, 0, 40, signal), [submitted]);
  const items = [...(first.data?.items ?? []), ...extra];
  const hasMore = first.data ? page + 1 < first.data.totalPages : false;

  const search = (q: string) => {
    setExtra([]);
    setPage(0);
    setSubmitted(q.trim());
  };
  const more = async () => {
    const next = await adminApi.media.list(submitted, page + 1, 40);
    setExtra((e) => [...e, ...next.items]);
    setPage(next.page);
  };
  const refresh = () => {
    setExtra([]);
    setPage(0);
    first.reload();
  };
  const replace = (m: MediaDto) => {
    first.setData((d) => (d ? { ...d, items: d.items.map((i) => (i.id === m.id ? m : i)) } : d));
    setExtra((e) => e.map((i) => (i.id === m.id ? m : i)));
  };
  return { query, setQuery, search, items, total: first.data?.totalItems ?? 0, loading: first.loading, error: first.error, hasMore, more, refresh, replace };
}

function SearchBox({ value, onChange, onSubmit }: { value: string; onChange: (v: string) => void; onSubmit: () => void }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="flex items-center gap-2 border border-rule bg-paper px-3 focus-within:border-ink">
      <Search className="h-4 w-4 text-graphite" aria-hidden />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Search by file name or description" className="h-10 w-full bg-transparent text-sm outline-none" />
    </form>
  );
}

// ---- details dialog ----

function MediaDetails({ media, onClose, onSaved, onDeleted }: { media: MediaDto; onClose: () => void; onSaved: (m: MediaDto) => void; onDeleted: () => void }) {
  const [alt, setAlt] = useState(media.altText);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const usages = useLoad(() => adminApi.media.usages(media.id), [media.id]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      onSaved(await adminApi.media.update(media.id, alt));
      setMessage('Saved.');
    } catch (err) {
      setMessage(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!window.confirm('Delete this image from the library? This can’t be undone.')) return;
    setDeleting(true);
    setMessage(null);
    try {
      await adminApi.media.remove(media.id);
      onDeleted();
    } catch (err) {
      setMessage(errorMessage(err));
      setDeleting(false);
    }
  };
  const copy = async () => {
    await navigator.clipboard?.writeText(mediaUrl(media.url));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  const inUse = (usages.data?.length ?? 0) > 0;

  return (
    <Dialog
      open
      onClose={onClose}
      title={media.fileName}
      size="lg"
      footer={
        <>
          <AdminButton variant="danger" onClick={remove} busy={deleting} disabled={inUse} title={inUse ? 'Still used on the site' : undefined}>
            <Trash2 className="h-4 w-4" aria-hidden /> Delete
          </AdminButton>
          <AdminButton onClick={save} busy={saving} disabled={alt === media.altText}>Save description</AdminButton>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex items-center justify-center bg-newsprint">
          <img src={mediaUrl(media.url)} alt={media.altText} className="max-h-[55vh] w-auto object-contain" />
        </div>
        <div className="space-y-5 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
            <dt className="text-graphite">Size</dt><dd>{media.width} × {media.height} px · {formatBytes(media.sizeBytes)}</dd>
            <dt className="text-graphite">Type</dt><dd>{media.contentType}</dd>
            <dt className="text-graphite">Added</dt><dd>{new Date(media.createdAt).toLocaleString('en-IN')}</dd>
          </dl>
          <TextArea
            label="Description (alt text)"
            hint="Describe the photo for people using screen readers, e.g. “Model in the oversized tee in Noir”."
            value={alt}
            onChange={setAlt}
            maxLength={300}
            rows={3}
          />
          <AdminButton variant="outline" onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy image link'}
          </AdminButton>
          <div>
            <p className="mb-1.5 text-xs font-medium">Where it’s used</p>
            {usages.loading ? (
              <p className="text-xs text-graphite">Checking…</p>
            ) : inUse ? (
              <ul className="list-inside list-disc text-xs text-graphite">{usages.data!.map((u) => <li key={u}>{u}</li>)}</ul>
            ) : (
              <p className="text-xs text-graphite">Not used anywhere yet.</p>
            )}
          </div>
          {message && <p role="status" className="text-xs">{message}</p>}
        </div>
      </div>
    </Dialog>
  );
}

// ---- page ----

export default function MediaLibrary() {
  const list = useMediaList();
  const { queue, upload } = useUploader();
  const [selected, setSelected] = useState<MediaDto | null>(null);

  const onFiles = async (files: File[]) => {
    const done = await upload(files);
    if (done.length) list.refresh();
  };

  return (
    <AdminPage title="Media library" description="Every image on the site lives here. Upload once, then choose it anywhere: products, banners, lookbook, pages.">
      <DropZone onFiles={onFiles} />
      <UploadQueue queue={queue} />

      <div className="mb-5 mt-10 flex flex-wrap items-center justify-between gap-3">
        {!(list.loading && list.items.length === 0) && <p className="text-sm text-graphite">{list.total} {list.total === 1 ? 'image' : 'images'}</p>}
        <div className="w-full sm:w-80">
          <SearchBox value={list.query} onChange={list.setQuery} onSubmit={() => list.search(list.query)} />
        </div>
      </div>

      {list.error ? (
        <ErrorBox error={list.error} onRetry={list.refresh} />
      ) : list.loading && list.items.length === 0 ? (
        <Loading />
      ) : list.items.length === 0 ? (
        <EmptyState title="No images yet" body="Upload your first photos above." />
      ) : (
        <>
          <MediaGrid items={list.items} onSelect={setSelected} />
          {list.hasMore && (
            <div className="mt-8 flex justify-center"><AdminButton variant="outline" onClick={() => void list.more()}>Show more</AdminButton></div>
          )}
        </>
      )}

      {selected && (
        <MediaDetails
          key={selected.id}
          media={selected}
          onClose={() => setSelected(null)}
          onSaved={(m) => { list.replace(m); setSelected(m); }}
          onDeleted={() => { setSelected(null); list.refresh(); }}
        />
      )}
    </AdminPage>
  );
}

export { SearchBox };
