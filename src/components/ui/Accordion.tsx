import { useId, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { EASE } from '@/lib/motion';
import { cx } from '@/lib/format';

export function AccordionItem({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="border-b border-rule">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between py-5 text-left text-[0.72rem] font-medium font-mono uppercase tracking-[0.1em]"
        >
          {title}
          <Plus aria-hidden strokeWidth={1.25} className={cx('h-4 w-4 transition-transform duration-500 ease-editorial', open && 'rotate-45')} />
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            role="region"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="pb-6 text-sm leading-relaxed text-graphite">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
