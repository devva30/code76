import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Search, X } from 'lucide-react';
import { useProductSearch } from '@/lib/catalogue';
import { useScrollLock } from '@/lib/SmoothScroll';
import { EASE } from '@/lib/motion';
import { formatPrice } from '@/lib/format';

import { useContent } from '@/store/SiteContent';
import { sized } from '@/lib/api';

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const SUGGESTIONS = useContent('site.search').suggestions;
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  // Ask the server only once typing pauses, not on every key press.
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query), 200);
    return () => window.clearTimeout(t);
  }, [query]);
  const { results } = useProductSearch(debounced, 8);
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 80);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`/shop?q=${encodeURIComponent(query.trim())}`);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[70] bg-ink/25"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search products"
            className="fixed inset-x-0 top-0 z-[71] max-h-[92svh] overflow-y-auto bg-paper"
            data-lenis-prevent
            initial={{ y: '-100%' }}
            animate={{ y: 0 }}
            exit={{ y: '-100%' }}
            transition={{ duration: 0.65, ease: EASE }}
          >
            <div className="site-container pb-10 pt-6 md:pb-14 md:pt-10">
              <div className="flex items-center justify-between">
                <p className="eyebrow">Search</p>
                <button type="button" onClick={onClose} aria-label="Close search" className="-mr-2 flex h-10 w-10 items-center justify-center">
                  <X strokeWidth={1.25} className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={submit} className="mt-4 flex items-center gap-4 border-b border-ink pb-3" role="search">
                <Search strokeWidth={1.25} className="h-6 w-6 shrink-0 text-graphite" aria-hidden />
                <label htmlFor="site-search" className="sr-only">Search products</label>
                <input
                  id="site-search"
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search tees, fits, colours"
                  autoComplete="off"
                  className="display w-full bg-transparent text-3xl placeholder:text-graphite/50 focus:outline-none md:text-[2.6rem]"
                />
                {query && (
                  <button type="submit" className="flex shrink-0 items-center gap-2 text-[0.7rem] font-medium font-mono uppercase tracking-[0.1em]">
                    <span className="hidden sm:inline">View all</span> <ArrowRight strokeWidth={1.25} className="h-4 w-4" />
                  </button>
                )}
              </form>

              {!query && SUGGESTIONS.length > 0 && (
                <div className="mt-8">
                  <p className="eyebrow mb-4">Popular</p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setQuery(s)}
                        className="border border-rule px-4 py-2 text-xs tracking-wide transition-colors hover:border-ink"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {query && (
                <div className="mt-8" aria-live="polite">
                  <p className="eyebrow mb-5">
                    {results.length} {results.length === 1 ? 'result' : 'results'}
                  </p>
                  {results.length === 0 ? (
                    <p className="max-w-md text-sm text-graphite">
                      Nothing matches “{query}”. Try a fit like “oversized” or a colour like “noir”.
                    </p>
                  ) : (
                    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 lg:grid-cols-6">
                      {results.map((p) => (
                        <li key={p.slug}>
                          <Link to={`/product/${p.slug}`} onClick={onClose} className="group block">
                            <div className="aspect-[4/5] overflow-hidden bg-card">
                              <img decoding="async" src={sized(p.colorways[0].images[0].src, 480)} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-1000 ease-editorial group-hover:scale-105" />
                            </div>
                            <p className="mt-3 text-sm">{p.name}</p>
                            <p className="text-xs text-graphite">{formatPrice(p.price)}</p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
