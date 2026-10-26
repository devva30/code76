import { useEffect, useMemo, useState } from 'react';
import { Link, useBlocker, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, ExternalLink, RotateCcw } from 'lucide-react';
import { adminApi, contentApi, type ContentValue } from '../adminApi';
import { AdminButton, AdminPage, Card, Dialog, ErrorBox, Loading, errorMessage, useLoad } from '../ui';
import { FieldList, ProductChoices, type FieldErrors } from './fields';
import { ApiError } from '@/lib/api';

const GROUP_ORDER = ['Home page', 'Every page', 'Pages', 'Product page'];

/** Admin → Website content: every editable part of the site, grouped by where it appears. */
export function ContentHome() {
  const { data, error, loading, reload } = useLoad((signal) => contentApi.all(signal));

  const groups = useMemo(() => {
    const map = new Map<string, NonNullable<typeof data>['schema']>();
    for (const s of data?.schema ?? []) map.set(s.group, [...(map.get(s.group) ?? []), s]);
    return [...map.entries()].sort((a, b) => GROUP_ORDER.indexOf(a[0]) - GROUP_ORDER.indexOf(b[0]));
  }, [data]);

  return (
    <AdminPage
      title="Website content"
      description="Every word, photo and link on the website. Choose a part to edit; changes show on the site as soon as you save."
    >
      {loading ? <Loading /> : error ? <ErrorBox error={error} onRetry={reload} /> : (
        <div className="space-y-8">
          {groups.map(([group, sections]) => (
            <section key={group}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-graphite">{group}</h2>
              <ul className="divide-y divide-rule border border-rule bg-paper">
                {sections.map((s) => (
                  <li key={s.key}>
                    <Link to={`/admin/content/${s.key}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-newsprint/60">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{s.label}</p>
                        <p className="mt-0.5 text-xs text-graphite">{s.description}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-graphite" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <p className="text-xs text-graphite">
            Store name, support email and shipping charges are under <Link to="/admin/settings" className="underline">Store settings</Link>.
            Products, collections and their banners are under <Link to="/admin/products" className="underline">Products</Link> and{' '}
            <Link to="/admin/collections" className="underline">Collections</Link>.
          </p>
        </div>
      )}
    </AdminPage>
  );
}

/** Edits one section of the website, with a form built from its schema. */
export function SectionEditor() {
  const { key = '' } = useParams();
  const { data, error, loading, reload } = useLoad((signal) => contentApi.all(signal), [key]);
  const products = useLoad((signal) => adminApi.products.list('', '', signal));
  const section = data?.schema.find((s) => s.key === key);

  const [saved, setSaved] = useState<ContentValue | null>(null);
  const [draft, setDraft] = useState<ContentValue | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<{ tone: 'good' | 'alert'; text: string } | null>(null);
  const [busy, setBusy] = useState<'save' | 'reset' | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!data) return;
    const v = (data.content[key] ?? {}) as ContentValue;
    setSaved(v);
    setDraft(structuredClone(v));
    setErrors({});
    setMessage(null);
  }, [data, key]);

  const dirty = !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved);

  // Don't lose unsaved work by clicking away or closing the tab.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = async () => {
    if (!draft) return;
    setBusy('save');
    setMessage(null);
    try {
      const stored = await contentApi.save(key, draft);
      setSaved(stored);
      setDraft(structuredClone(stored));
      setErrors({});
      setMessage({ tone: 'good', text: 'Saved. The website now shows this version.' });
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.length) {
        setErrors(Object.fromEntries(err.fieldErrors.map((f) => [f.field, f.message])));
        setMessage({ tone: 'alert', text: `Not saved: ${err.fieldErrors.length === 1 ? 'one field needs' : `${err.fieldErrors.length} fields need`} attention (marked in red).` });
      } else {
        setMessage({ tone: 'alert', text: errorMessage(err) });
      }
    } finally {
      setBusy(null);
    }
  };

  const reset = async () => {
    setConfirmReset(false);
    setBusy('reset');
    try {
      const original = await contentApi.reset(key);
      setSaved(original);
      setDraft(structuredClone(original));
      setErrors({});
      setMessage({ tone: 'good', text: 'Put back to the original content.' });
    } catch (err) {
      setMessage({ tone: 'alert', text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <AdminPage title="Website content"><Loading /></AdminPage>;
  if (error) return <AdminPage title="Website content"><ErrorBox error={error} onRetry={reload} /></AdminPage>;
  if (!section || !draft) {
    return (
      <AdminPage title="Website content">
        <p className="text-sm">There’s no website section called “{key}”. <Link to="/admin/content" className="underline">See all sections</Link></p>
      </AdminPage>
    );
  }

  const actions = (
    <>
      <AdminButton variant="ghost" onClick={() => setConfirmReset(true)} disabled={!!busy}>
        <RotateCcw className="h-4 w-4" aria-hidden /> Reset to original
      </AdminButton>
      <a href={section.previewPath} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 border border-ink/25 px-4 text-sm font-semibold hover:border-ink">
        View on site <ExternalLink className="h-4 w-4" aria-hidden />
      </a>
      <AdminButton onClick={save} busy={busy === 'save'} disabled={!dirty || !!busy}>
        {dirty ? 'Save changes' : 'Saved'}
      </AdminButton>
    </>
  );

  return (
    <AdminPage title={section.label} description={section.description} actions={actions}>
      <Link to="/admin/content" className="-mt-4 mb-6 inline-flex items-center gap-1.5 text-xs text-graphite hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All website content
      </Link>
      {message && (
        <p role="status" className={`mb-5 border px-4 py-3 text-sm ${message.tone === 'good' ? 'border-ink/20 bg-newsprint' : 'border-stamp text-[rgb(var(--c-stamp))]'}`}>
          {message.text}
        </p>
      )}
      <ProductChoices.Provider value={products.data ?? []}>
        <Card>
          <FieldList fields={section.fields} value={draft} onChange={setDraft} path="" errors={errors} />
        </Card>
      </ProductChoices.Provider>
      <div className="sticky bottom-0 -mx-4 mt-6 flex items-center justify-end gap-3 border-t border-rule bg-paper/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        {dirty && <span className="mr-auto text-xs text-graphite">You have unsaved changes.</span>}
        <AdminButton variant="outline" onClick={() => saved && setDraft(structuredClone(saved))} disabled={!dirty || !!busy}>Undo changes</AdminButton>
        <AdminButton onClick={save} busy={busy === 'save'} disabled={!dirty || !!busy}>{dirty ? 'Save changes' : 'Saved'}</AdminButton>
      </div>

      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset to the original?"
        footer={
          <>
            <AdminButton variant="outline" onClick={() => setConfirmReset(false)}>Keep my version</AdminButton>
            <AdminButton variant="danger" onClick={reset}>Reset “{section.label}”</AdminButton>
          </>
        }
      >
        <p className="text-sm">This replaces everything in “{section.label}” with the content the site launched with. Your uploaded images stay in the Media library.</p>
      </Dialog>

      <Dialog
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        title="Leave without saving?"
        footer={
          <>
            <AdminButton variant="outline" onClick={() => blocker.reset?.()}>Stay and keep editing</AdminButton>
            <AdminButton variant="danger" onClick={() => blocker.proceed?.()}>Leave and lose changes</AdminButton>
          </>
        }
      >
        <p className="text-sm">Your changes to “{section.label}” haven’t been saved.</p>
      </Dialog>
    </AdminPage>
  );
}
