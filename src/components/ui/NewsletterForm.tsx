import { useId, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { EASE } from '@/lib/motion';
import { cx, isValidEmail } from '@/lib/format';
import { API_BASE_URL, ApiError, request } from '@/lib/api';

/**
 * Newsletter sign-up. Addresses are saved on the server and listed in Admin → Subscribers.
 * Without a server (static preview) nothing is sent, and the form says so.
 */
export function NewsletterForm({ tone = 'default', compact }: { tone?: 'default' | 'muted'; compact?: boolean }) {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const id = useId();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return setError('Please enter your email address.');
    if (!isValidEmail(email)) return setError('That email doesn’t look quite right — please check it.');
    if (!compact && !consent) return setError('Please confirm you’d like to receive our emails.');
    setError(null);
    if (API_BASE_URL) {
      setSending(true);
      try {
        // The short footer form has no tick box: pressing Subscribe under its note is the consent.
        await request<void>('/api/newsletter', { method: 'POST', body: { email: email.trim(), consent: true } });
      } catch (err) {
        setSending(false);
        return setError(err instanceof ApiError && err.status === 429 ? err.message : 'We couldn’t sign you up just now. Please try again in a moment.');
      }
      setSending(false);
    }
    setDone(true);
  };

  return (
    <div className="relative">
      <AnimatePresence mode="wait" initial={false}>
        {done ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            role="status"
            className="flex items-start gap-4"
          >
            <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stamp text-paper">
              <Check strokeWidth={1.5} className="h-4 w-4" />
            </span>
            <div>
              <p className={cx('display', compact ? 'text-2xl' : 'text-3xl')}>Thank you — you’re on the list.</p>
              <p className="mt-2 text-sm text-graphite">
                {API_BASE_URL ? (
                  <>We’ll write to <span className="text-ink">{email.trim()}</span> when there’s something worth sharing.</>
                ) : (
                  'This copy of the site isn’t connected to the store server, so your email wasn’t saved.'
                )}
              </p>
              <button type="button" onClick={() => { setDone(false); setEmail(''); setConsent(false); }} className="link-underline mt-3 text-[0.68rem] font-mono uppercase tracking-[0.1em]">
                Use another email
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.form key="form" onSubmit={submit} noValidate exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <label htmlFor={`${id}-email`} className="eyebrow mb-3 block">
              Email address
            </label>
            <div className={cx('flex items-center border-b transition-colors', error ? 'border-[rgb(var(--c-stamp))]' : 'border-ink')}>
              <input
                id={`${id}-email`}
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
                placeholder="you@example.com"
                aria-invalid={!!error}
                aria-describedby={error ? `${id}-err` : undefined}
                className={cx(
                  'min-w-0 flex-1 bg-transparent py-3 placeholder:text-graphite/50 focus:outline-none',
                  compact ? 'text-sm' : 'text-base md:text-lg',
                  tone === 'muted' && 'placeholder:text-graphite/60',
                )}
              />
              <button type="submit" aria-label="Subscribe" disabled={sending} className="group disabled:opacity-50 flex h-11 shrink-0 items-center gap-2 pl-3 text-[0.7rem] font-medium font-mono uppercase tracking-[0.1em]">
                {!compact && <span>Subscribe</span>}
                <ArrowRight strokeWidth={1.25} className="h-4 w-4 transition-transform duration-500 ease-editorial group-hover:translate-x-1" />
              </button>
            </div>
            {!compact && (
              <label className="mt-4 flex cursor-pointer items-start gap-3 text-xs leading-relaxed text-graphite">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => { setConsent(e.target.checked); if (error) setError(null); }}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-ink"
                />
                I’d like to receive occasional emails about new collections. Unsubscribe anytime.
              </label>
            )}
            {compact && <p className="mt-2 text-[0.7rem] leading-relaxed text-graphite">Occasional emails about new collections. Unsubscribe anytime.</p>}
            <AnimatePresence>
              {error && (
                <motion.p
                  id={`${id}-err`}
                  role="alert"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-3 text-xs text-[rgb(var(--c-stamp))]"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
