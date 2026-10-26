import { useState } from 'react';
import { ImageIcon, RefreshCw, X } from 'lucide-react';
import { mediaUrl } from '@/lib/api';
import type { MediaDto } from '../adminApi';
import { AdminButton, Dialog, EmptyState, ErrorBox, Loading } from '../ui';
import { DropZone, MediaGrid, SearchBox, UploadQueue, useMediaList, useUploader } from './MediaLibrary';

/** Pick an image from the library, or upload a new one and use it straight away. */
export function MediaPicker({ open, onClose, onPick, title = 'Choose an image' }: {
  open: boolean; onClose: () => void; onPick: (media: MediaDto) => void; title?: string;
}) {
  const list = useMediaList();
  const { queue, upload } = useUploader();

  const onFiles = async (files: File[]) => {
    const done = await upload(files.slice(0, 1));
    if (done[0]) {
      onPick(done[0]);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={title} size="xl">
      <DropZone onFiles={onFiles} compact />
      <UploadQueue queue={queue} />
      <div className="my-5 w-full sm:w-80">
        <SearchBox value={list.query} onChange={list.setQuery} onSubmit={() => list.search(list.query)} />
      </div>
      {list.error ? (
        <ErrorBox error={list.error} onRetry={list.refresh} />
      ) : list.loading && list.items.length === 0 ? (
        <Loading />
      ) : list.items.length === 0 ? (
        <EmptyState title="The library is empty" body="Upload an image above." />
      ) : (
        <>
          <MediaGrid items={list.items} onSelect={(m) => { onPick(m); onClose(); }} />
          {list.hasMore && <div className="mt-6 flex justify-center"><AdminButton variant="outline" onClick={() => void list.more()}>Show more</AdminButton></div>}
        </>
      )}
    </Dialog>
  );
}

/**
 * A form field holding one image URL: shows a preview, and lets the admin choose, replace or remove it.
 * Works with uploaded images (/media/…) and the original bundled ones (/images/…).
 */
export function ImageField({ label, value, onChange, hint, aspect = 'aspect-[4/3]', required }: {
  label: string; value: string; onChange: (url: string, media?: MediaDto) => void; hint?: string; aspect?: string; required?: boolean;
}) {
  const [picking, setPicking] = useState(false);
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium">{label}{required && <span className="text-[rgb(var(--c-stamp))]"> *</span>}</p>
      <div className="flex items-start gap-4">
        <button type="button" onClick={() => setPicking(true)} className={`relative w-36 shrink-0 overflow-hidden border border-rule bg-newsprint ${aspect} hover:border-ink`} aria-label={value ? `Replace ${label}` : `Choose ${label}`}>
          {value ? (
            <img src={mediaUrl(value)} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-graphite"><ImageIcon className="h-6 w-6" strokeWidth={1.3} /></span>
          )}
        </button>
        <div className="flex flex-col gap-2">
          <AdminButton variant="outline" className="h-9 px-3 text-xs" onClick={() => setPicking(true)}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> {value ? 'Replace' : 'Choose image'}
          </AdminButton>
          {value && !required && (
            <AdminButton variant="ghost" className="h-8 px-0 text-xs" onClick={() => onChange('')}>
              <X className="h-3.5 w-3.5" aria-hidden /> Remove
            </AdminButton>
          )}
          {hint && <p className="max-w-[16rem] text-xs text-graphite">{hint}</p>}
        </div>
      </div>
      <MediaPicker open={picking} onClose={() => setPicking(false)} onPick={(m) => onChange(m.url, m)} title={`Choose: ${label}`} />
    </div>
  );
}
