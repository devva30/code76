import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useShop } from '@/store/ShopContext';
import { EASE } from '@/lib/motion';
import { sized } from '@/lib/api';

export function Toasts() {
  const { toasts, dismissToast } = useShop();
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-[calc(var(--bottom-nav-h)+16px)] left-4 right-4 z-[90] lg:bottom-4 flex flex-col items-start gap-2 sm:right-auto sm:w-[340px]">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.45, ease: EASE }}
            className="pointer-events-auto flex w-full items-center gap-3 border border-rule bg-paper p-3 pr-2 shadow-[0_10px_30px_-18px_rgb(var(--c-ink)/0.35)]"
          >
            {t.image && <img decoding="async" src={sized(t.image, 320)} alt="" className="h-12 w-10 shrink-0 object-cover" />}
            <div className="min-w-0 flex-1">
              <p className="text-[0.7rem] font-medium font-mono uppercase tracking-[0.1em]">{t.title}</p>
              {t.body && <p className="truncate text-xs text-graphite">{t.body}</p>}
            </div>
            <button type="button" onClick={() => dismissToast(t.id)} aria-label="Dismiss" className="flex h-8 w-8 shrink-0 items-center justify-center text-graphite hover:text-ink">
              <X strokeWidth={1.25} className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
