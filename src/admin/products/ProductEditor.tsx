import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ExternalLink, ImagePlus, Trash2, X } from 'lucide-react';
import { ApiError, mediaUrl } from '@/lib/api';
import { sizeLabel } from '@/data/products';
import { cx } from '@/lib/format';
import {
  SIZES,
  adminApi,
  type CategoryRow,
  type CollectionRow,
  type ColorDetail,
  type ImageRef,
  type ProductDetail,
  type ProductInput,
  type ProductStatus,
  type SizeInput,
} from '../adminApi';
import { MediaPicker } from '../media/ImageField';
import {
  AdminButton,
  AdminPage,
  Card,
  ErrorBox,
  LinesField,
  Loading,
  RupeeField,
  SelectField,
  TextArea,
  TextField,
  Toggle,
  errorMessage,
  useLoad,
} from '../ui';
import { StatusBadge } from './ProductList';

const EMPTY: ProductInput = {
  name: '', slug: '', subtitle: '', description: '', categorySlug: '', fit: 'regular', fitLabel: 'Regular fit',
  pricePaise: null, compareAtPricePaise: null, newArrival: false, details: [], fitNotes: [], care: [], collections: [],
};

const toInput = (p: ProductDetail): ProductInput => ({
  name: p.name, slug: p.slug, subtitle: p.subtitle ?? '', description: p.description ?? '', categorySlug: p.categorySlug,
  fit: p.fit, fitLabel: p.fitLabel, pricePaise: p.price.amountPaise, compareAtPricePaise: p.compareAtPrice?.amountPaise ?? null,
  newArrival: p.newArrival, details: p.details, fitNotes: p.fitNotes, care: p.care, collections: p.collections,
});

/** Field errors from the server, keyed by field name. */
function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError)) return {};
  return Object.fromEntries(err.fieldErrors.map((f) => [f.field, f.message]));
}

function Saved({ show }: { show: boolean }) {
  return show ? <span role="status" className="text-xs text-graphite">Saved.</span> : null;
}

// ================= basics =================

function BasicsForm({ product, categories, collections, onSaved }: {
  product: ProductDetail | null; categories: CategoryRow[]; collections: CollectionRow[]; onSaved: (p: ProductDetail) => void;
}) {
  const [form, setForm] = useState<ProductInput>(() => (product ? toInput(product) : { ...EMPTY, categorySlug: categories[0]?.slug ?? '' }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = !product || JSON.stringify(form) !== JSON.stringify(toInput(product));

  const set = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setErrors({});
    try {
      const result = product ? await adminApi.products.update(product.id, form) : await adminApi.products.create(form);
      onSaved(result);
      setForm(toInput(result));
      setSaved(true);
    } catch (err) {
      const byField = fieldErrors(err);
      setErrors(byField);
      setError(Object.keys(byField).length ? 'Please fix the highlighted fields.' : errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Basics" actions={<div className="flex items-center gap-3"><Saved show={saved && !dirty} /><AdminButton onClick={save} busy={saving} disabled={!dirty}>{product ? 'Save changes' : 'Create draft'}</AdminButton></div>}>
      {error && <div className="mb-5"><ErrorBox error={error} /></div>}
      <div className="grid gap-5 md:grid-cols-2">
        <TextField label="Name" value={form.name} onChange={(v) => set('name', v)} error={errors.name} maxLength={160} className="md:col-span-2" />
        <TextField label="Short line under the name" value={form.subtitle} onChange={(v) => set('subtitle', v)} error={errors.subtitle} maxLength={200} placeholder="e.g. Dropped shoulder, boxy body" />
        <TextField
          label="Web address"
          value={form.slug}
          onChange={(v) => set('slug', v.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
          error={errors.slug}
          hint={product ? `${window.location.host}/product/${form.slug || '…'}` : 'Leave empty to make one from the name.'}
          maxLength={120}
        />
        <RupeeField label="Price" value={form.pricePaise} onChange={(v) => set('pricePaise', v)} error={errors.pricePaise} />
        <RupeeField label="“Was” price (optional)" value={form.compareAtPricePaise} onChange={(v) => set('compareAtPricePaise', v)} error={errors.compareAtPricePaise} hint="Shows the price crossed out with a % off badge." />
        <SelectField label="Category" value={form.categorySlug} onChange={(v) => set('categorySlug', v)} error={errors.categorySlug} options={categories.map((c) => ({ value: c.slug, label: c.name }))} />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Fit" value={form.fit} onChange={(v) => set('fit', v as ProductInput['fit'])} options={[{ value: 'regular', label: 'Regular' }, { value: 'oversized', label: 'Oversized' }]} />
          <TextField label="Fit label" value={form.fitLabel} onChange={(v) => set('fitLabel', v)} error={errors.fitLabel} maxLength={60} />
        </div>
        <div className="md:col-span-2">
          <p className="mb-2 text-xs font-medium">Collections</p>
          <div className="flex flex-wrap gap-2">
            {collections.map((c) => {
              const on = form.collections.includes(c.slug);
              return (
                <button
                  key={c.slug}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set('collections', on ? form.collections.filter((s) => s !== c.slug) : [...form.collections, c.slug])}
                  className={cx('h-9 border px-3 text-sm', on ? 'border-ink bg-ink text-paper' : 'border-rule hover:border-ink')}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="md:col-span-2">
          <Toggle label="Mark as new" hint="Shows a “New” badge on the product." checked={form.newArrival} onChange={(v) => set('newArrival', v)} />
        </div>
        <TextArea label="Description" value={form.description} onChange={(v) => set('description', v)} error={errors.description} rows={4} maxLength={4000} className="md:col-span-2" />
        <LinesField label="Details" value={form.details} onChange={(v) => set('details', v)} />
        <LinesField label="Fit notes" value={form.fitNotes} onChange={(v) => set('fitNotes', v)} />
        <LinesField label="Care" value={form.care} onChange={(v) => set('care', v)} />
      </div>
    </Card>
  );
}

// ================= colours =================

interface SizeDraft extends SizeInput {
  reserved: number;
  sku: string | null;
}

const draftSizes = (c: ColorDetail): SizeDraft[] =>
  SIZES.map((size) => {
    const row = c.sizes.find((s) => s.size === size);
    return row
      ? { size, active: row.active, stock: row.stock, pricePaise: row.pricePaise, reserved: row.reserved, sku: row.sku }
      : { size, active: false, stock: 0, pricePaise: null, reserved: 0, sku: null };
  });

function PhotoStrip({ images, onChange }: { images: ImageRef[]; onChange: (images: ImageRef[]) => void }) {
  const [picking, setPicking] = useState(false);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [img] = next.splice(from, 1);
    next.splice(to, 0, img);
    onChange(next);
  };
  return (
    <div>
      <p className="mb-2 text-xs font-medium">Photos <span className="font-normal text-graphite">(the first one is the main photo)</span></p>
      <ul className="flex flex-wrap gap-3">
        {images.map((img, i) => (
          <li key={`${img.url}-${i}`} className="w-32 border border-rule bg-paper">
            <div className="relative aspect-[4/5] bg-newsprint">
              <img src={mediaUrl(img.url)} alt="" className="h-full w-full object-cover" />
              <button type="button" onClick={() => onChange(images.filter((_, j) => j !== i))} aria-label="Remove photo" className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center bg-paper/90 text-ink hover:bg-paper">
                <X className="h-3.5 w-3.5" />
              </button>
              {i === 0 && <span className="absolute bottom-1 left-1 bg-ink px-1.5 py-0.5 font-mono text-[0.55rem] uppercase text-paper">Main</span>}
            </div>
            <input
              value={img.alt}
              onChange={(e) => onChange(images.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))}
              placeholder="Describe the photo"
              aria-label={`Description for photo ${i + 1}`}
              maxLength={300}
              className="w-full border-t border-rule px-2 py-1.5 text-xs outline-none focus:bg-newsprint"
            />
            <div className="flex border-t border-rule">
              <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Move photo left" className="flex h-7 flex-1 items-center justify-center text-graphite hover:text-ink disabled:opacity-30"><ArrowLeft className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => move(i, i + 1)} disabled={i === images.length - 1} aria-label="Move photo right" className="flex h-7 flex-1 items-center justify-center text-graphite hover:text-ink disabled:opacity-30"><ArrowRight className="h-3.5 w-3.5" /></button>
            </div>
          </li>
        ))}
        <li>
          <button type="button" onClick={() => setPicking(true)} className="flex aspect-[4/5] w-32 flex-col items-center justify-center gap-2 border border-dashed border-ink/30 text-xs text-graphite hover:border-ink hover:text-ink">
            <ImagePlus className="h-5 w-5" strokeWidth={1.4} /> Add photo
          </button>
        </li>
      </ul>
      <MediaPicker open={picking} onClose={() => setPicking(false)} onPick={(m) => onChange([...images, { url: m.url, alt: m.altText }])} title="Add a photo" />
    </div>
  );
}

function ColorCard({ product, color, index, count, onChange }: {
  product: ProductDetail; color: ColorDetail; index: number; count: number; onChange: (p: ProductDetail) => void;
}) {
  const [name, setName] = useState(color.name);
  const [hex, setHex] = useState(color.hex);
  const [images, setImages] = useState<ImageRef[]>(color.images);
  const [sizes, setSizes] = useState<SizeDraft[]>(() => draftSizes(color));
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const colorJson = JSON.stringify(color);

  // When this colour changes on the server (after a save), show the saved version.
  useEffect(() => {
    setName(color.name);
    setHex(color.hex);
    setImages(color.images);
    setSizes(draftSizes(color));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorJson]);

  const looksDirty = name !== color.name || hex.toUpperCase() !== color.hex.toUpperCase() || JSON.stringify(images) !== JSON.stringify(color.images);
  const sizesDirty = JSON.stringify(sizes) !== JSON.stringify(draftSizes(color));

  const run = async (label: string, action: () => Promise<ProductDetail>, okText: string) => {
    setBusy(label);
    setMessage(null);
    try {
      onChange(await action());
      setMessage({ text: okText });
    } catch (err) {
      setMessage({ text: errorMessage(err), error: true });
    } finally {
      setBusy(null);
    }
  };

  const setSize = (i: number, patch: Partial<SizeDraft>) => setSizes((s) => s.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  // Ticked sizes with nothing in stock show as "sold out" in the shop and can't be chosen.
  const emptySizes = sizes.filter((r) => r.active && r.stock <= 0).map((r) => sizeLabel(r.size));
  const [fillAll, setFillAll] = useState('');
  const applyFillAll = () => {
    const n = Math.max(0, Math.floor(Number(fillAll) || 0));
    setSizes((s) => s.map((row) => (row.active ? { ...row, stock: Math.max(n, row.reserved) } : row)));
  };

  return (
    <div className="border border-rule bg-paper">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="h-6 w-6 rounded-full shadow-[0_0_0_1px_rgb(var(--c-ink)/0.2)]" style={{ backgroundColor: hex }} aria-hidden />
          <h3 className="text-sm font-semibold">{color.name}</h3>
          <span className="font-mono text-[0.65rem] text-graphite">{color.code}</span>
        </div>
        <div className="flex items-center">
          <button type="button" disabled={index === 0 || !!busy} onClick={() => run('order', () => {
            const ids = product.colors.map((c) => c.id);
            [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
            return adminApi.products.reorderColors(product.id, ids);
          }, 'Order saved.')} aria-label="Show this colour earlier" className="flex h-9 w-9 items-center justify-center text-graphite hover:text-ink disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
          <button type="button" disabled={index === count - 1 || !!busy} onClick={() => run('order', () => {
            const ids = product.colors.map((c) => c.id);
            [ids[index + 1], ids[index]] = [ids[index], ids[index + 1]];
            return adminApi.products.reorderColors(product.id, ids);
          }, 'Order saved.')} aria-label="Show this colour later" className="flex h-9 w-9 items-center justify-center text-graphite hover:text-ink disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
          <button type="button" disabled={!!busy} onClick={() => {
            if (window.confirm(`Remove the colour ${color.name} and its sizes?`)) void run('delete', () => adminApi.products.removeColor(product.id, color.id), 'Removed.');
          }} aria-label={`Remove colour ${color.name}`} className="flex h-9 w-9 items-center justify-center text-graphite hover:text-[rgb(var(--c-stamp))]"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="space-y-6 p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <TextField label="Colour name" value={name} onChange={setName} maxLength={80} />
          <div>
            <p className="mb-1.5 text-xs font-medium">Swatch colour</p>
            <div className="flex items-center gap-2">
              <input type="color" value={hex} onChange={(e) => setHex(e.target.value.toUpperCase())} aria-label="Pick swatch colour" className="h-10 w-12 cursor-pointer border border-rule bg-paper p-1" />
              <input value={hex} onChange={(e) => setHex(e.target.value)} aria-label="Swatch colour code" maxLength={7} className="h-10 w-24 border border-rule px-2 font-mono text-sm uppercase outline-none focus:border-ink" />
            </div>
          </div>
        </div>
        <PhotoStrip images={images} onChange={setImages} />
        <div className="flex justify-end">
          <AdminButton onClick={() => run('look', () => adminApi.products.updateColor(product.id, color.id, { name, hex, images }), 'Colour and photos saved.')} busy={busy === 'look'} disabled={!looksDirty || !!busy}>
            Save colour &amp; photos
          </AdminButton>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium">Sizes &amp; stock</p>
          <p className="mb-3 text-xs text-graphite">Tick each size you sell and enter how many pieces you have. A size with 0 pieces shows as sold out in the shop.</p>
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <label className="text-xs">
              <span className="mb-1 block font-medium">Same stock for every ticked size</span>
              <input
                type="number"
                min={0}
                value={fillAll}
                onChange={(e) => setFillAll(e.target.value)}
                placeholder="e.g. 20"
                aria-label="Stock for every ticked size"
                className="h-9 w-28 border border-rule px-2 text-sm tabular-nums outline-none focus:border-ink"
              />
            </label>
            <AdminButton variant="outline" className="h-9 px-3 text-xs" onClick={applyFillAll} disabled={fillAll === '' || !sizes.some((r) => r.active)}>
              Apply to ticked sizes
            </AdminButton>
          </div>
          <div className="overflow-x-auto" data-lenis-prevent>
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-ink text-left font-mono text-[0.6rem] uppercase tracking-[0.08em] text-graphite">
                  <th className="py-2 font-medium">Size</th>
                  <th className="py-2 font-medium">Sell</th>
                  <th className="py-2 font-medium">In stock (pieces)</th>
                  <th className="py-2 font-medium">Held</th>
                  <th className="py-2 font-medium">Price for this size</th>
                  <th className="py-2 font-medium">SKU</th>
                </tr>
              </thead>
              <tbody>
                {sizes.map((row, i) => (
                  <tr key={row.size} className={cx('border-b border-rule', !row.active && 'text-graphite')}>
                    <td className="py-2 font-medium">{sizeLabel(row.size)}</td>
                    <td className="py-2">
                      <input
                        type="checkbox"
                        checked={row.active}
                        onChange={(e) => {
                          setSize(i, { active: e.target.checked });
                          // Straight to the stock box, so a newly ticked size doesn't stay at 0 by accident.
                          if (e.target.checked && row.stock <= 0) {
                            window.setTimeout(() => (document.getElementById(`stock-${color.id}-${row.size}`) as HTMLInputElement | null)?.select(), 0);
                          }
                        }}
                        aria-label={`Sell size ${sizeLabel(row.size)}`}
                        className="h-4 w-4 accent-ink"
                      />
                    </td>
                    <td className="py-2">
                      <input
                        id={`stock-${color.id}-${row.size}`}
                        type="number"
                        min={row.reserved}
                        value={row.stock}
                        onChange={(e) => setSize(i, { stock: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                        aria-label={`Stock for size ${sizeLabel(row.size)}`}
                        className={cx('h-9 w-20 border px-2 text-sm tabular-nums outline-none focus:border-ink', row.active && row.stock <= 0 ? 'border-stamp' : 'border-rule')}
                      />
                      {row.active && row.stock <= 0 && <span className="ml-2 text-xs text-[rgb(var(--c-stamp))]">Sold out in shop</span>}
                    </td>
                    <td className="py-2 tabular-nums" title="Reserved for orders awaiting payment">{row.reserved || '—'}</td>
                    <td className="py-2">
                      <input
                        inputMode="decimal"
                        value={row.pricePaise == null ? '' : String(row.pricePaise / 100)}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^0-9.]/g, '');
                          setSize(i, { pricePaise: v === '' ? null : Math.round(Number(v) * 100) });
                        }}
                        placeholder="Same as product"
                        aria-label={`Price for size ${sizeLabel(row.size)}`}
                        className="h-9 w-32 border border-rule px-2 text-sm outline-none focus:border-ink"
                      />
                    </td>
                    <td className="py-2 font-mono text-[0.65rem] text-graphite">{row.sku ?? 'Made on save'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {emptySizes.length > 0 && (
            <p role="status" className="mt-3 border border-stamp px-3 py-2 text-xs text-[rgb(var(--c-stamp))]">
              {emptySizes.join(', ')} {emptySizes.length === 1 ? 'has' : 'have'} 0 pieces in stock, so shoppers will see {emptySizes.length === 1 ? 'it' : 'them'} as sold out. Enter a number to make {emptySizes.length === 1 ? 'it' : 'them'} buyable.
            </p>
          )}
          <div className="mt-3 flex justify-end">
            <AdminButton
              onClick={() => run('sizes', () => adminApi.products.setSizes(product.id, color.id, sizes.map(({ size, active, stock, pricePaise }) => ({ size, active, stock, pricePaise }))), 'Sizes and stock saved.')}
              busy={busy === 'sizes'}
              disabled={!sizesDirty || !!busy}
            >
              Save sizes &amp; stock
            </AdminButton>
          </div>
        </div>
        {message && <p role={message.error ? 'alert' : 'status'} className={cx('text-xs', message.error && 'text-[rgb(var(--c-stamp))]')}>{message.text}</p>}
      </div>
    </div>
  );
}

function ColorsSection({ product, onChange }: { product: ProductDetail; onChange: (p: ProductDetail) => void }) {
  const [name, setName] = useState('');
  const [hex, setHex] = useState('#1A1A1A');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    setAdding(true);
    setError(null);
    try {
      onChange(await adminApi.products.addColor(product.id, name.trim(), hex));
      setName('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  return (
    <Card title="Colours, photos and sizes">
      <div className="space-y-5">
        {product.colors.length === 0 && <p className="text-sm text-graphite">Add the first colour this T-shirt comes in.</p>}
        {product.colors.map((c, i) => (
          <ColorCard key={c.id} product={product} color={c} index={i} count={product.colors.length} onChange={onChange} />
        ))}
        <div className="flex flex-wrap items-end gap-3 border border-dashed border-ink/25 p-4">
          <TextField label="New colour" value={name} onChange={setName} placeholder="e.g. Olive" maxLength={80} className="min-w-[12rem] flex-1" />
          <div>
            <p className="mb-1.5 text-xs font-medium">Swatch</p>
            <input type="color" value={hex} onChange={(e) => setHex(e.target.value.toUpperCase())} aria-label="Pick swatch colour for the new colour" className="h-10 w-12 cursor-pointer border border-rule bg-paper p-1" />
          </div>
          <AdminButton variant="outline" onClick={add} busy={adding} disabled={!name.trim()}>Add colour</AdminButton>
        </div>
        {error && <ErrorBox error={error} />}
      </div>
    </Card>
  );
}

// ================= page =================

function StatusBar({ product, onChange }: { product: ProductDetail; onChange: (p: ProductDetail) => void }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<ReactNode>(null);
  const productJson = JSON.stringify(product);
  // A "not ready" message is about the product as it was; clear it once anything changes.
  useEffect(() => setProblem(null), [productJson]);

  const setStatus = async (status: ProductStatus) => {
    setBusy(status);
    setProblem(null);
    try {
      onChange(await adminApi.products.setStatus(product.id, status));
    } catch (err) {
      setProblem(err instanceof ApiError && err.fieldErrors.length ? (
        <>
          <p className="font-medium">{err.message}</p>
          <ul className="mt-1 list-inside list-disc">{err.fieldErrors.map((f) => <li key={f.message}>{f.message}</li>)}</ul>
        </>
      ) : errorMessage(err));
    } finally {
      setBusy(null);
    }
  };
  const remove = async () => {
    if (!window.confirm(`Delete ${product.name} for good? This can’t be undone.`)) return;
    setBusy('delete');
    try {
      await adminApi.products.remove(product.id);
      navigate('/admin/products', { replace: true });
    } catch (err) {
      setProblem(errorMessage(err));
      setBusy(null);
    }
  };

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 border border-rule bg-paper px-5 py-3">
        <div className="flex items-center gap-3 text-sm">
          <StatusBadge status={product.status} />
          <span className="text-graphite">
            {product.status === 'published' ? 'Shoppers can see and buy this.' : product.status === 'draft' ? 'Hidden from shoppers until you publish.' : 'Hidden and kept for its order history.'}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {product.status === 'published' && (
            <a href={`/product/${product.slug}`} target="_blank" rel="noreferrer"><AdminButton variant="ghost"><ExternalLink className="h-4 w-4" aria-hidden /> View in store</AdminButton></a>
          )}
          {product.status !== 'published' && <AdminButton onClick={() => setStatus('published')} busy={busy === 'published'}>Publish</AdminButton>}
          {product.status !== 'draft' && <AdminButton variant="outline" onClick={() => setStatus('draft')} busy={busy === 'draft'}>Move to drafts</AdminButton>}
          {product.status !== 'archived' && <AdminButton variant="outline" onClick={() => setStatus('archived')} busy={busy === 'archived'}>Archive</AdminButton>}
          {!product.hasOrders && <AdminButton variant="danger" onClick={remove} busy={busy === 'delete'}><Trash2 className="h-4 w-4" aria-hidden /> Delete</AdminButton>}
        </div>
      </div>
      {problem && <div role="alert" className="border-l-2 border-stamp bg-paper px-5 py-3 text-sm text-[rgb(var(--c-stamp))]">{problem}</div>}
    </div>
  );
}

export default function ProductEditor() {
  const { id = 'new' } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const loaded = useLoad((signal) => (isNew ? Promise.resolve(null) : adminApi.products.get(id, signal)), [id]);
  const categories = useLoad((signal) => adminApi.categories.list(signal));
  const collections = useLoad((signal) => adminApi.collections.list(signal));
  const product = loaded.data;

  const onSaved = (p: ProductDetail) => {
    if (isNew) navigate(`/admin/products/${p.id}`, { replace: true });
    else loaded.setData(p);
  };

  const error = loaded.error ?? categories.error ?? collections.error;
  return (
    <AdminPage
      title={isNew ? 'New product' : product?.name ?? 'Product'}
      description={<Link to="/admin/products" className="hover:underline">← All products</Link>}
    >
      {error ? (
        <ErrorBox error={error} onRetry={() => { loaded.reload(); categories.reload(); collections.reload(); }} />
      ) : (!isNew && !product) || !categories.data || !collections.data ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          {product && <StatusBar product={product} onChange={loaded.setData} />}
          <BasicsForm key={product?.id ?? 'new'} product={product} categories={categories.data} collections={collections.data} onSaved={onSaved} />
          {product ? <ColorsSection product={product} onChange={loaded.setData} /> : <p className="text-sm text-graphite">Create the draft first, then add colours, photos and sizes.</p>}
        </div>
      )}
    </AdminPage>
  );
}
