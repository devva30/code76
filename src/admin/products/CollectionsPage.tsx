import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { mediaUrl } from '@/lib/api';
import { adminApi, type CategoryInput, type CategoryRow, type CollectionInput, type CollectionRow } from '../adminApi';
import { ImageField } from '../media/ImageField';
import { AdminButton, AdminPage, Badge, Card, Dialog, ErrorBox, Loading, TextArea, TextField, Toggle, errorMessage, useLoad } from '../ui';

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function CollectionDialog({ row, onClose, onSaved }: { row: CollectionRow | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<CollectionInput>(
    row
      ? { slug: row.slug, name: row.name, description: row.description, sortOrder: row.sortOrder, active: row.active, eyebrow: row.eyebrow, intro: row.intro, bannerUrl: row.bannerUrl, bannerAlt: row.bannerAlt }
      : { slug: '', name: '', description: '', sortOrder: 100, active: true, eyebrow: '', intro: '', bannerUrl: null, bannerAlt: '' },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof CollectionInput>(k: K, v: CollectionInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await adminApi.collections.save(row?.id ?? null, { ...form, slug: form.slug || slugify(form.name) });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} title={row ? `Edit ${row.name}` : 'New collection'} size="lg" footer={
      <>
        <AdminButton variant="outline" onClick={onClose}>Cancel</AdminButton>
        <AdminButton onClick={save} busy={saving} disabled={!form.name.trim()}>Save collection</AdminButton>
      </>
    }>
      <div className="grid gap-5 md:grid-cols-2">
        <TextField label="Name" value={form.name} onChange={(v) => set('name', v)} maxLength={120} hint="Shown as the tab and the page title." />
        <TextField label="Web address" value={form.slug} onChange={(v) => set('slug', slugify(v))} placeholder={slugify(form.name) || 'made-from-the-name'} maxLength={80} hint={`/collections/${form.slug || slugify(form.name) || '…'}`} />
        <TextField label="Small heading above the title" value={form.eyebrow} onChange={(v) => set('eyebrow', v)} maxLength={80} placeholder="e.g. Shop by fit" />
        <TextField label="Position" type="number" value={form.sortOrder} onChange={(v) => set('sortOrder', Math.max(0, Number(v) || 0))} hint="Lower numbers show first in the tabs." />
        <TextArea label="Intro paragraph" value={form.intro} onChange={(v) => set('intro', v)} maxLength={600} rows={3} className="md:col-span-2" />
        <div className="md:col-span-2">
          <ImageField label="Banner photo (optional)" value={form.bannerUrl ?? ''} onChange={(url, m) => { set('bannerUrl', url || null); if (m && !form.bannerAlt) set('bannerAlt', m.altText); }} hint="Shown beside the title on larger screens." />
        </div>
        {form.bannerUrl && <TextField label="Banner description" value={form.bannerAlt} onChange={(v) => set('bannerAlt', v)} maxLength={300} className="md:col-span-2" />}
        <Toggle label="Show in the shop" hint="Hidden collections keep their products but don’t appear as a tab." checked={form.active} onChange={(v) => set('active', v)} />
      </div>
      {error && <div className="mt-5"><ErrorBox error={error} /></div>}
    </Dialog>
  );
}

function CategoryDialog({ row, onClose, onSaved }: { row: CategoryRow | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<CategoryInput>(row ? { slug: row.slug, name: row.name, description: row.description, sortOrder: row.sortOrder } : { slug: '', name: '', description: '', sortOrder: 100 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await adminApi.categories.save(row?.id ?? null, { ...form, slug: form.slug || slugify(form.name) });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };
  return (
    <Dialog open onClose={onClose} title={row ? `Edit ${row.name}` : 'New category'} footer={
      <>
        <AdminButton variant="outline" onClick={onClose}>Cancel</AdminButton>
        <AdminButton onClick={save} busy={saving} disabled={!form.name.trim()}>Save category</AdminButton>
      </>
    }>
      <div className="space-y-5">
        <TextField label="Name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} maxLength={120} />
        <TextField label="Code" value={form.slug} onChange={(v) => setForm((f) => ({ ...f, slug: slugify(v) }))} placeholder={slugify(form.name)} maxLength={80} />
        <TextArea label="Description" value={form.description ?? ''} onChange={(v) => setForm((f) => ({ ...f, description: v }))} maxLength={500} rows={3} />
        <TextField label="Position" type="number" value={form.sortOrder} onChange={(v) => setForm((f) => ({ ...f, sortOrder: Math.max(0, Number(v) || 0) }))} />
      </div>
      {error && <div className="mt-5"><ErrorBox error={error} /></div>}
    </Dialog>
  );
}

export default function CollectionsPage() {
  const collections = useLoad((signal) => adminApi.collections.list(signal));
  const categories = useLoad((signal) => adminApi.categories.list(signal));
  const [editingCollection, setEditingCollection] = useState<CollectionRow | null | 'new'>(null);
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null | 'new'>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const remove = async (kind: 'collection' | 'category', id: number, name: string) => {
    if (!window.confirm(`Delete ${name}? ${kind === 'collection' ? 'Its products are kept.' : ''}`)) return;
    setProblem(null);
    try {
      if (kind === 'collection') {
        await adminApi.collections.remove(id);
        collections.reload();
      } else {
        await adminApi.categories.remove(id);
        categories.reload();
      }
    } catch (err) {
      setProblem(errorMessage(err));
    }
  };

  return (
    <AdminPage title="Collections" description="Collections are the tabs in the shop (New arrivals, Oversized…), each with its own banner and intro. Categories group products behind the scenes.">
      {problem && <div className="mb-5"><ErrorBox error={problem} /></div>}
      <div className="space-y-6">
        <Card title="Collections" actions={<AdminButton className="h-9 px-3 text-xs" onClick={() => setEditingCollection('new')}><Plus className="h-3.5 w-3.5" /> New collection</AdminButton>} padded={false}>
          {collections.error ? <div className="p-5"><ErrorBox error={collections.error} onRetry={collections.reload} /></div> : !collections.data ? <div className="px-5"><Loading /></div> : (
            <ul className="divide-y divide-rule">
              {collections.data.map((c) => (
                <li key={c.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="h-12 w-16 shrink-0 overflow-hidden bg-newsprint">
                    {c.bannerUrl && <img src={mediaUrl(c.bannerUrl)} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="truncate text-xs text-graphite">/collections/{c.slug} · {c.productCount} products{c.intro && ` · ${c.intro}`}</p>
                  </div>
                  {!c.active && <Badge tone="muted">Hidden</Badge>}
                  <AdminButton variant="ghost" className="h-9 px-2" onClick={() => setEditingCollection(c)} aria-label={`Edit ${c.name}`}><Pencil className="h-4 w-4" /></AdminButton>
                  <AdminButton variant="ghost" className="h-9 px-2" onClick={() => remove('collection', c.id, c.name)} aria-label={`Delete ${c.name}`}><Trash2 className="h-4 w-4" /></AdminButton>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Categories" actions={<AdminButton variant="outline" className="h-9 px-3 text-xs" onClick={() => setEditingCategory('new')}><Plus className="h-3.5 w-3.5" /> New category</AdminButton>} padded={false}>
          {categories.error ? <div className="p-5"><ErrorBox error={categories.error} onRetry={categories.reload} /></div> : !categories.data ? <div className="px-5"><Loading /></div> : (
            <ul className="divide-y divide-rule">
              {categories.data.map((c) => (
                <li key={c.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-graphite">{c.productCount} products</p>
                  </div>
                  <AdminButton variant="ghost" className="h-9 px-2" onClick={() => setEditingCategory(c)} aria-label={`Edit ${c.name}`}><Pencil className="h-4 w-4" /></AdminButton>
                  <AdminButton variant="ghost" className="h-9 px-2" onClick={() => remove('category', c.id, c.name)} aria-label={`Delete ${c.name}`}><Trash2 className="h-4 w-4" /></AdminButton>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {editingCollection && (
        <CollectionDialog row={editingCollection === 'new' ? null : editingCollection} onClose={() => setEditingCollection(null)} onSaved={() => { setEditingCollection(null); collections.reload(); }} />
      )}
      {editingCategory && (
        <CategoryDialog row={editingCategory === 'new' ? null : editingCategory} onClose={() => setEditingCategory(null)} onSaved={() => { setEditingCategory(null); categories.reload(); }} />
      )}
    </AdminPage>
  );
}
