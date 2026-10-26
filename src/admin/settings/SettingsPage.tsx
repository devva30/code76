import { useEffect, useState } from 'react';
import { contentApi, type StoreSettingsDto } from '../adminApi';
import { AdminButton, AdminPage, Card, ErrorBox, Loading, RupeeField, TextField, errorMessage, useLoad } from '../ui';
import { ApiError } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { PaymentKeysCard } from './PaymentKeysCard';

type Errors = Partial<Record<keyof StoreSettingsDto, string>>;

/** Admin → Store settings: the store's name and contact, shipping charges and checkout limits. */
export function SettingsPage() {
  const { data, error, loading, reload } = useLoad((signal) => contentApi.settings(signal));
  const [form, setForm] = useState<StoreSettingsDto | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<{ tone: 'good' | 'alert'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (loading) return <AdminPage title="Store settings"><Loading /></AdminPage>;
  if (error || !form) return <AdminPage title="Store settings"><ErrorBox error={error} onRetry={reload} /></AdminPage>;

  const dirty = JSON.stringify(form) !== JSON.stringify(data);
  const set = <K extends keyof StoreSettingsDto>(key: K, value: StoreSettingsDto[K]) => setForm({ ...form, [key]: value });
  const num = (key: 'maxQuantityPerLine' | 'maxCartLines' | 'paymentWindowMinutes') => (v: string) => set(key, v === '' ? 0 : Math.round(Number(v)));

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const stored = await contentApi.saveSettings(form);
      setForm(stored);
      setErrors({});
      setMessage({ tone: 'good', text: 'Saved. New orders and the website use these settings straight away.' });
      reload();
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.length) {
        setErrors(Object.fromEntries(err.fieldErrors.map((f) => [f.field, f.message])) as Errors);
        setMessage({ tone: 'alert', text: 'Not saved: some fields need attention (marked in red).' });
      } else {
        setMessage({ tone: 'alert', text: errorMessage(err) });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPage
      title="Store settings"
      description="Your store’s name and contact details, what shipping costs, and limits for the bag and checkout."
      actions={<AdminButton onClick={save} busy={busy} disabled={!dirty || busy}>{dirty ? 'Save settings' : 'Saved'}</AdminButton>}
    >
      {message && (
        <p role="status" className={`mb-5 border px-4 py-3 text-sm ${message.tone === 'good' ? 'border-ink/20 bg-newsprint' : 'border-stamp text-[rgb(var(--c-stamp))]'}`}>
          {message.text}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Your store">
          <div className="space-y-5">
            <TextField label="Store name *" value={form.storeName} maxLength={60} error={errors.storeName} onChange={(v) => set('storeName', v)}
              hint="Shown in page titles, the footer and emails. The logo artwork itself is a file in the code." />
            <TextField label="Tagline *" value={form.tagline} maxLength={120} error={errors.tagline} onChange={(v) => set('tagline', v)}
              hint="Used in the browser tab on the home page." />
            <TextField label="Support email *" type="email" value={form.supportEmail} maxLength={254} error={errors.supportEmail} onChange={(v) => set('supportEmail', v)}
              hint="Shown in the footer and wherever a page says {email}." />
          </div>
        </Card>

        <Card title="Shipping">
          <div className="space-y-5">
            <RupeeField label="Shipping charge" value={form.shippingFeePaise} error={errors.shippingFeePaise} onChange={(p) => set('shippingFeePaise', p ?? 0)}
              hint="Added to orders below the free-shipping amount. Use 0 for always-free shipping." />
            <RupeeField label="Free shipping on orders from" value={form.freeShippingThresholdPaise} error={errors.freeShippingThresholdPaise}
              onChange={(p) => set('freeShippingThresholdPaise', p ?? 0)}
              hint={`Bags worth ${formatPrice(form.freeShippingThresholdPaise / 100)} or more ship free. Pages that say {freeShipping} show this amount.`} />
          </div>
        </Card>

        <Card title="Bag and checkout">
          <div className="space-y-5">
            <TextField label="Most of one item per order" type="number" min={1} max={10} className="max-w-[14rem]" value={form.maxQuantityPerLine}
              error={errors.maxQuantityPerLine} onChange={num('maxQuantityPerLine')} hint="Same tee, colour and size. From 1 to 10." />
            <TextField label="Most different items in a bag" type="number" min={1} max={50} className="max-w-[14rem]" value={form.maxCartLines}
              error={errors.maxCartLines} onChange={num('maxCartLines')} hint="From 1 to 50." />
            <TextField label="Minutes to pay before an order expires" type="number" min={5} max={1440} className="max-w-[14rem]" value={form.paymentWindowMinutes}
              error={errors.paymentWindowMinutes} onChange={num('paymentWindowMinutes')}
              hint="Stock is held for an unpaid order this long, then released. From 5 minutes to 24 hours." />
          </div>
        </Card>

        {/* Saved on its own, with a password check: see PaymentKeysCard. */}
        <PaymentKeysCard />
      </div>
    </AdminPage>
  );
}
