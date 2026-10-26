import { sizeLabel, type Colorway, type Size } from '@/data/products';
import { cx } from '@/lib/format';

export function ColorSwatches({
  colorways,
  value,
  onChange,
  size = 'md',
  label = 'Colour',
}: {
  colorways: Colorway[];
  value: string;
  onChange: (id: string) => void;
  size?: 'sm' | 'md';
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-2">
      {colorways.map((c) => {
        const active = c.id === value;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={c.name}
            title={c.name}
            onClick={() => onChange(c.id)}
            onMouseEnter={size === 'sm' ? () => onChange(c.id) : undefined}
            className={cx(
              'relative rounded-full transition-[box-shadow] duration-300',
              size === 'sm' ? 'h-3.5 w-3.5' : 'h-7 w-7',
              active ? 'shadow-[0_0_0_1px_rgb(var(--c-paper)),0_0_0_2px_rgb(var(--c-ink))]' : 'shadow-[0_0_0_1px_rgb(var(--c-rule))] hover:shadow-[0_0_0_1px_rgb(var(--c-paper)),0_0_0_2px_rgb(var(--c-graphite))]',
            )}
            style={{ backgroundColor: c.hex }}
          />
        );
      })}
    </div>
  );
}

export function SizeSelector({
  sizes,
  soldOut = [],
  value,
  onChange,
  compact,
  error,
}: {
  sizes: Size[];
  soldOut?: Size[];
  value: Size | null;
  onChange: (s: Size) => void;
  compact?: boolean;
  error?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Size" aria-invalid={error || undefined} className={cx('grid gap-1.5', compact ? 'grid-cols-6' : 'grid-cols-6')}>
      {sizes.map((s) => {
        const unavailable = soldOut.includes(s);
        const active = value === s;
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={unavailable ? `${sizeLabel(s)}, sold out` : sizeLabel(s)}
            disabled={unavailable}
            onClick={() => onChange(s)}
            className={cx(
              'relative flex items-center justify-center border text-xs font-medium tracking-wider transition-colors duration-300',
              compact ? 'h-9' : 'h-12',
              active ? 'border-ink bg-ink text-paper' : 'border-rule hover:border-ink',
              error && !active && 'border-[rgb(var(--c-stamp))]/60',
              unavailable && 'cursor-not-allowed text-graphite/50 hover:border-rule',
            )}
          >
            {sizeLabel(s)}
            {unavailable && (
              <span aria-hidden className="pointer-events-none absolute inset-0">
                <span className="absolute left-1/2 top-1/2 h-px w-[70%] -translate-x-1/2 -translate-y-1/2 -rotate-[24deg] bg-graphite/40" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function QuantityStepper({
  value,
  onChange,
  max = 10,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  max?: number;
  label: string;
}) {
  return (
    <div className="inline-flex h-9 items-center border border-rule" role="group" aria-label={`Quantity for ${label}`}>
      <button
        type="button"
        className="flex h-full w-9 items-center justify-center text-lg leading-none transition-colors hover:bg-newsprint"
        onClick={() => onChange(value - 1)}
        aria-label={value <= 1 ? `Remove ${label}` : `Decrease quantity of ${label}`}
      >
        −
      </button>
      <span className="w-7 text-center text-xs tabular-nums" aria-live="polite">{value}</span>
      <button
        type="button"
        className="flex h-full w-9 items-center justify-center text-lg leading-none transition-colors hover:bg-newsprint disabled:opacity-30"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={`Increase quantity of ${label}`}
      >
        +
      </button>
    </div>
  );
}
