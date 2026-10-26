/**
 * Building blocks for admin pages. Same colours and fonts as the store, but denser and boxier:
 * the admin is a tool for getting work done, not a showroom.
 */
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { cx } from '@/lib/format';

// ---- data loading ----

/** Loads something for a page, with loading/error state and a reload. */
export function useLoad<T>(load: (signal: AbortSignal) => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    loadRef
      .current(ctrl.signal)
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return;
        setError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', (err as Error).message || 'Something went wrong.'));
        setLoading(false);
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { data, setData, error, loading, reload };
}

/** Turns any thrown error into one readable sentence for the admin. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.fieldErrors.length) return err.fieldErrors.map((f) => (f.field === 'usage' ? f.message : `${f.field}: ${f.message}`)).join(' · ');
    return err.message;
  }
  return (err as Error)?.message || 'Something went wrong.';
}

// ---- layout ----

export function AdminPage({ title, description, actions, children }: { title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  useEffect(() => {
    document.title = `${title} — Admin`;
  }, [title]);
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6 lg:px-10 lg:pt-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-sm text-graphite">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function Card({ title, actions, children, className, padded = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={cx('border border-rule bg-paper', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3.5">
          {title && <h2 className="font-mono text-[0.7rem] font-medium uppercase tracking-[0.1em]">{title}</h2>}
          {actions}
        </div>
      )}
      <div className={padded ? 'p-5' : undefined}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, hint, to, tone }: { label: string; value: ReactNode; hint?: string; to?: string; tone?: 'alert' }) {
  const body = (
    <>
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-graphite">{label}</p>
      <p className={cx('mt-2 text-3xl font-semibold tabular-nums', tone === 'alert' && 'text-[rgb(var(--c-stamp))]')}>{value}</p>
      {hint && <p className="mt-1 text-xs text-graphite">{hint}</p>}
    </>
  );
  const cls = 'block border border-rule bg-paper p-5 transition-colors';
  return to ? <Link to={to} className={cx(cls, 'hover:border-ink')}>{body}</Link> : <div className={cls}>{body}</div>;
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'alert' | 'muted' }) {
  const tones = {
    neutral: 'border-ink/20 text-ink',
    good: 'border-ink bg-ink text-paper',
    alert: 'border-stamp text-[rgb(var(--c-stamp))]',
    muted: 'border-rule text-graphite',
  };
  return <span className={cx('inline-flex h-6 items-center whitespace-nowrap border px-2 font-mono text-[0.6rem] font-medium uppercase tracking-[0.08em]', tones[tone])}>{children}</span>;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 py-16 text-sm text-graphite">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {label}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="border-l-2 border-stamp bg-newsprint px-5 py-4 text-sm">
      <p className="text-[rgb(var(--c-stamp))]">{errorMessage(error)}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="link-underline mt-2 text-xs">Try again</button>
      )}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center border border-dashed border-rule px-6 py-14 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {body && <p className="mt-2 max-w-sm text-sm text-graphite">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

// ---- buttons ----

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'danger' | 'ghost'; busy?: boolean };

export function AdminButton({ variant = 'primary', busy, className, children, disabled, ...rest }: BtnProps) {
  const variants = {
    primary: 'bg-ink text-paper hover:bg-ink/90',
    outline: 'border border-ink/25 text-ink hover:border-ink',
    danger: 'border border-stamp text-[rgb(var(--c-stamp))] hover:bg-stamp hover:text-paper',
    ghost: 'text-graphite hover:text-ink',
  };
  return (
    <button
      type="button"
      disabled={disabled || busy}
      className={cx('inline-flex h-10 items-center justify-center gap-2 px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50', variants[variant], className)}
      {...rest}
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

// ---- form controls ----

const control = 'w-full border border-rule bg-paper px-3 text-sm outline-none transition-colors placeholder:text-graphite/60 focus:border-ink disabled:bg-newsprint';

export function FieldShell({ id, label, hint, error, children, className }: { id: string; label: string; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium">{label}</label>
      {children}
      {error ? <p className="mt-1.5 text-xs text-[rgb(var(--c-stamp))]">{error}</p> : hint ? <p className="mt-1.5 text-xs text-graphite">{hint}</p> : null}
    </div>
  );
}

export function TextField({ label, hint, error, className, value, onChange, ...rest }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  label: string; hint?: ReactNode; error?: string | null; value: string | number; onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} className={cx(control, 'h-10')} {...rest} />
    </FieldShell>
  );
}

export function TextArea({ label, hint, error, className, value, onChange, rows = 4, ...rest }: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> & {
  label: string; hint?: ReactNode; error?: string | null; value: string; onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <textarea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} className={cx(control, 'py-2 leading-relaxed')} {...rest} />
    </FieldShell>
  );
}

export function SelectField({ label, hint, error, className, value, onChange, options }: {
  label: string; hint?: ReactNode; error?: string | null; className?: string; value: string; onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cx(control, 'h-10 cursor-pointer')}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </FieldShell>
  );
}

export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors', checked ? 'bg-ink' : 'bg-rule')}
      >
        <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-paper shadow transition-transform', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
      </button>
      <label htmlFor={id} className="cursor-pointer text-sm">
        {label}
        {hint && <span className="block text-xs text-graphite">{hint}</span>}
      </label>
    </div>
  );
}

// ---- dialog ----

export function Dialog({ open, onClose, title, children, footer, size = 'md' }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: 'md' | 'lg' | 'xl';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  const widths = { md: 'max-w-lg', lg: 'max-w-3xl', xl: 'max-w-5xl' };
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-6">
          <motion.div className="absolute inset-0 bg-ink/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.25 }}
            className={cx('relative flex max-h-[92svh] w-full flex-col bg-paper shadow-xl', widths[size])}
          >
            <div className="flex items-center justify-between gap-4 border-b border-rule px-5 py-3.5">
              <h2 className="text-base font-semibold">{title}</h2>
              <button type="button" onClick={onClose} aria-label="Close" autoFocus className="-mr-2 flex h-9 w-9 items-center justify-center text-graphite hover:text-ink">
                <X className="h-5 w-5" strokeWidth={1.5} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5" data-lenis-prevent>{children}</div>
            {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-rule px-5 py-3.5">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ---- formatting ----

export const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);

// ---- money and lists ----

/** Price in rupees on screen, paise in the data (₹2,490.00 ↔ 249000). Empty means "no price". */
export function RupeeField({ label, hint, error, value, onChange, className }: {
  label: string; hint?: ReactNode; error?: string | null; value: number | null; onChange: (paise: number | null) => void; className?: string;
}) {
  const id = useId();
  const [text, setText] = useState(value == null ? '' : String(value / 100));
  useEffect(() => {
    setText((t) => (t !== '' && Math.round(Number(t) * 100) === value ? t : value == null ? '' : String(value / 100)));
  }, [value]);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <div className="flex items-center border border-rule bg-paper focus-within:border-ink">
        <span className="pl-3 text-sm text-graphite">₹</span>
        <input
          id={id}
          inputMode="decimal"
          value={text}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9.]/g, '');
            setText(raw);
            onChange(raw === '' || Number.isNaN(Number(raw)) ? null : Math.round(Number(raw) * 100));
          }}
          aria-invalid={!!error}
          className="h-10 w-full bg-transparent px-2 text-sm outline-none"
        />
      </div>
    </FieldShell>
  );
}

/** A list edited as one item per line (product details, fit notes, care). */
export function LinesField({ label, hint, value, onChange, rows = 4 }: { label: string; hint?: string; value: string[]; onChange: (lines: string[]) => void; rows?: number }) {
  const [text, setText] = useState(value.join('\n'));
  useEffect(() => {
    setText((t) => (t.split('\n').map((l) => l.trim()).filter(Boolean).join('\n') === value.join('\n') ? t : value.join('\n')));
  }, [value]);
  return (
    <TextArea
      label={label}
      hint={hint ?? 'One per line.'}
      rows={rows}
      value={text}
      onChange={(t) => {
        setText(t);
        onChange(t.split('\n').map((l) => l.trim()).filter(Boolean));
      }}
    />
  );
}
