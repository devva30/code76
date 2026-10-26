import { useEffect, useState } from 'react';
import { paymentKeysApi, type PaymentKeysStatus } from '../adminApi';
import { AdminButton, Card, ErrorBox, Loading, TextField, errorMessage, useLoad } from '../ui';
import { API_BASE_URL, ApiError } from '@/lib/api';

type Field = 'keyId' | 'keySecret' | 'webhookSecret' | 'currentPassword';
type Note = { tone: 'good' | 'alert'; text: string };

const SOURCE: Record<PaymentKeysStatus['source'], string> = {
  admin: 'Saved here in the admin',
  server: 'From the server settings file (server/.env)',
  none: 'Not set: customers can’t pay online yet',
};

/**
 * Store settings → Payments: paste the Razorpay keys checkout uses. The secrets are stored encrypted
 * and never shown again; changes need your password and take effect on the very next payment.
 */
export function PaymentKeysCard() {
  const { data, error, loading, reload } = useLoad((signal) => paymentKeysApi.status(signal));
  const [status, setStatus] = useState<PaymentKeysStatus | null>(null);
  const [keyId, setKeyId] = useState('');
  const [keySecret, setKeySecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [note, setNote] = useState<Note | null>(null);
  const [busy, setBusy] = useState<'save' | 'test' | 'remove' | null>(null);

  useEffect(() => {
    if (data) {
      setStatus(data);
      setKeyId(data.source === 'admin' ? data.keyId ?? '' : '');
    }
  }, [data]);

  if (loading) return <Card title="Payments (Razorpay)"><Loading /></Card>;
  if (error || !status) return <Card title="Payments (Razorpay)"><ErrorBox error={error} onRetry={reload} /></Card>;

  const savedHere = status.source === 'admin';
  const keyChanged = keyId.trim() !== (savedHere ? status.keyId ?? '' : '');
  const webhookUrl = `${API_BASE_URL ?? window.location.origin}${status.webhookPath}`;

  const fail = (err: unknown, prefix: string) => {
    if (err instanceof ApiError && err.fieldErrors.length) {
      setErrors(Object.fromEntries(err.fieldErrors.map((f) => [f.field, f.message])));
      setNote({ tone: 'alert', text: `${prefix}: some fields need attention (marked in red).` });
    } else {
      setNote({ tone: 'alert', text: errorMessage(err) });
    }
  };

  const save = async () => {
    setBusy('save');
    setNote(null);
    setErrors({});
    try {
      const next = await paymentKeysApi.save({ keyId, keySecret, webhookSecret, removeWebhookSecret: false, currentPassword: password });
      setStatus(next);
      setKeySecret('');
      setWebhookSecret('');
      setPassword('');
      setNote({ tone: 'good', text: `Saved. The next customer payment uses ${next.keyId} (${next.mode === 'live' ? 'LIVE' : 'test'} mode).` });
    } catch (err) {
      fail(err, 'Not saved');
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy('test');
    setNote(null);
    try {
      const r = await paymentKeysApi.test(keyId, keySecret);
      setNote({ tone: r.ok ? 'good' : 'alert', text: r.message });
    } catch (err) {
      setNote({ tone: 'alert', text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!window.confirm('Remove the keys saved here? Payments will use the server settings file, or switch off if it has none.')) return;
    setBusy('remove');
    setNote(null);
    setErrors({});
    try {
      const next = await paymentKeysApi.remove(password);
      setStatus(next);
      setKeyId('');
      setPassword('');
      setNote({ tone: 'good', text: 'Removed the keys saved in the admin.' });
    } catch (err) {
      fail(err, 'Not removed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card title="Payments (Razorpay)" className="lg:col-span-2">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-3 text-sm">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-graphite">Now using:</span>
            {status.keyId ? <code className="bg-newsprint px-1.5 py-0.5 text-xs">{status.keyId}</code> : <span>—</span>}
            {status.mode && (
              <span className={`px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.1em] ${status.mode === 'live' ? 'bg-stamp text-paper' : 'bg-gold/25 text-ink'}`}>
                {status.mode === 'live' ? 'Live: real money' : 'Test mode'}
              </span>
            )}
          </p>
          <p className="text-graphite">{SOURCE[status.source]}</p>
          {savedHere && status.updatedAt && (
            <p className="text-xs text-graphite">
              Last changed {new Date(status.updatedAt).toLocaleString('en-IN')}{status.updatedBy ? ` by ${status.updatedBy}` : ''}.
            </p>
          )}
          <div className="border-l-2 border-gold pl-3 text-xs leading-relaxed text-graphite">
            <p>
              Find your keys in Razorpay → <strong className="text-ink">Account &amp; Settings → API Keys</strong>. Use <strong className="text-ink">Test Mode</strong> keys
              (rzp_test_…) until the store goes live{status.liveKeysAllowed ? '' : '; live keys are refused on this computer'}.
            </p>
            <p className="mt-2">
              Webhook URL to add in Razorpay → Webhooks (events: payment.captured, payment.failed, order.paid):
              <br />
              <code className="break-all text-ink">{webhookUrl}</code>
            </p>
            <p className="mt-2">Secrets are stored encrypted and never shown again. Changing them needs your password and is recorded in Activity.</p>
          </div>
        </div>

        <div className="space-y-5">
          {!status.canSave && (
            <p className="border border-stamp px-3 py-2 text-sm text-[rgb(var(--c-stamp))]">
              The server can’t store secrets yet: add SETTINGS_ENCRYPTION_KEY to its settings file and restart it.
            </p>
          )}
          <TextField label="Key ID *" value={keyId} maxLength={40} autoComplete="off" spellCheck={false} placeholder="rzp_test_…"
            error={errors.keyId} onChange={setKeyId} />
          <TextField label={savedHere && !keyChanged ? 'Key Secret (leave empty to keep the saved one)' : 'Key Secret *'} type="password"
            value={keySecret} maxLength={100} autoComplete="new-password" placeholder={savedHere && !keyChanged && status.secretSaved ? '•••••••• saved' : ''}
            error={errors.keySecret} onChange={setKeySecret} />
          <TextField label="Webhook Secret (optional)" type="password" value={webhookSecret} maxLength={100} autoComplete="new-password"
            placeholder={savedHere && status.webhookSecretSaved ? '•••••••• saved' : ''} error={errors.webhookSecret} onChange={setWebhookSecret}
            hint="The secret you typed when creating the webhook in Razorpay. Lets orders update even if a customer closes the page after paying." />
          <TextField label="Your admin password *" type="password" value={password} maxLength={200} autoComplete="current-password"
            error={errors.currentPassword} onChange={setPassword} hint="Needed to change payment keys, so a stolen login can’t redirect your payments." />

          {note && (
            <p role="status" className={`border px-3 py-2 text-sm ${note.tone === 'good' ? 'border-ink/20 bg-newsprint' : 'border-stamp text-[rgb(var(--c-stamp))]'}`}>
              {note.text}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <AdminButton onClick={() => void save()} busy={busy === 'save'} disabled={busy !== null || !status.canSave || !keyId.trim() || !password}>
              Save keys
            </AdminButton>
            <AdminButton variant="outline" onClick={() => void test()} busy={busy === 'test'} disabled={busy !== null || (!keyId.trim() && !status.keyId)}>
              Test keys
            </AdminButton>
            {savedHere && (
              <AdminButton variant="ghost" onClick={() => void remove()} busy={busy === 'remove'} disabled={busy !== null || !password}>
                Remove saved keys
              </AdminButton>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
