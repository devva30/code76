import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cx } from '@/lib/format';

/** Underlined input style shared by the account and checkout forms. */
export const inputClass = 'min-w-0 flex-1 bg-transparent py-3 text-base placeholder:text-graphite/50 focus:outline-none';

/**
 * A labelled form field with the CODE76 underline, plus an error (red) or hint (grey) beneath.
 * Give the input `aria-describedby={`${id}-msg`}` when an error or hint is shown.
 */
export function Field({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: ReactNode;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="eyebrow mb-2 block">
        {label}
      </label>
      <div className={cx('flex items-center border-b transition-colors', error ? 'border-[rgb(var(--c-stamp))]' : 'border-ink')}>{children}</div>
      <AnimatePresence initial={false}>
        {error ? (
          <motion.p key="err" id={`${id}-msg`} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-2 text-xs text-[rgb(var(--c-stamp))]">
            {error}
          </motion.p>
        ) : (
          hint && <p id={`${id}-msg`} className="mt-2 text-xs text-graphite">{hint}</p>
        )}
      </AnimatePresence>
    </div>
  );
}
