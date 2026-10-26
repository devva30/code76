import { cx } from '@/lib/format';

/** Printer’s crop marks at the four corners of a relative container. */
export function CropMarks({ className, inset = 16, size = 14 }: { className?: string; inset?: number; size?: number }) {
  const corner = (pos: string, rot: number) => (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 14 14"
      className={cx('pointer-events-none absolute', pos)}
      style={{ transform: `rotate(${rot}deg)`, margin: inset }}
    >
      <path d="M0 0.5H14M0.5 0V14" stroke="currentColor" strokeWidth="1" fill="none" />
    </svg>
  );
  return (
    <div aria-hidden className={cx('pointer-events-none absolute inset-0 text-ink/70', className)}>
      {corner('left-0 top-0', 0)}
      {corner('right-0 top-0', 90)}
      {corner('bottom-0 right-0', 180)}
      {corner('bottom-0 left-0', 270)}
    </div>
  );
}

/** Registration target, as printed in the trim of a press sheet. */
export function RegistrationMark({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 22 22" className={cx('pointer-events-none', className)}>
      <circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M11 0V22M0 11H22" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

/** Halftone dot field that fades out in the given direction. */
export function Screentone({ className, fade = 'to-left' }: { className?: string; fade?: 'to-left' | 'to-right' | 'to-top' | 'to-bottom' | 'radial' }) {
  const mask =
    fade === 'radial'
      ? 'radial-gradient(closest-side, black, transparent)'
      : `linear-gradient(${fade.replace('-', ' ')}, black, transparent 85%)`;
  return <div aria-hidden className={cx('screentone pointer-events-none absolute', className)} style={{ maskImage: mask, WebkitMaskImage: mask }} />;
}

/** Five-pip die glyph from the CODE76 mark — used as a separator/bullet. */
export function Pips({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 10 10" className={cx('h-2.5 w-2.5', className)} fill="currentColor">
      <circle cx="2" cy="2" r="1.3" />
      <circle cx="8" cy="2" r="1.3" />
      <circle cx="5" cy="5" r="1.3" />
      <circle cx="2" cy="8" r="1.3" />
      <circle cx="8" cy="8" r="1.3" />
    </svg>
  );
}
