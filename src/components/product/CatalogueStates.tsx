import type { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { cx } from '@/lib/format';

/** Placeholder matching a ProductCard's footprint, so the grid doesn't jump when data arrives. */
export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cx('flex flex-col border border-rule bg-surface', className)}>
      <div className="aspect-[4/5] animate-pulse bg-card" />
      <div className="space-y-2.5 p-3 sm:p-4">
        <div className="h-2.5 w-1/3 animate-pulse bg-rule" />
        <div className="h-3.5 w-3/4 animate-pulse bg-rule" />
        <div className="h-3 w-1/4 animate-pulse bg-rule" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8, columns = 4 }: { count?: number; columns?: 3 | 4 }) {
  return (
    <div role="status" aria-label="Loading products" className={cx('grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3', columns === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3')}>
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Inline failure panel with a retry action. Never shows raw server details. */
export function CatalogueError({ error, onRetry, title = 'Couldn’t load the collection.' }: { error: ApiError; onRetry: () => void; title?: string }) {
  return (
    <div role="alert" className="flex flex-col items-center border border-dashed border-rule px-6 py-20 text-center">
      <p className="display text-3xl md:text-4xl">{title}</p>
      <p className="mt-4 max-w-sm text-sm text-graphite">
        {error.status === 0 ? error.message : 'The store is having trouble right now. Please try again in a moment.'}
      </p>
      <div className="mt-8">
        <Button variant="outline" onClick={onRetry}>Try again</Button>
      </div>
    </div>
  );
}
