import { cx } from '@/lib/format';
import { Pips } from './PrintMarks';

/** Continuous, understated editorial marquee (pure CSS, pauses on hover). */
export function Marquee({ words, className }: { words: string[]; className?: string }) {
  const row = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {words.map((w) => (
        <li key={w} className="flex items-center">
          <span className="whitespace-nowrap px-5 font-display text-lg font-semibold tracking-[-0.02em] md:px-8 md:text-2xl">{w}</span>
          <Pips className="h-3 w-3 text-stamp" />
        </li>
      ))}
    </ul>
  );
  return (
    <div className={cx('group relative flex overflow-hidden border-y border-rule py-4 md:py-5', className)}>
      <div className="flex w-max animate-marquee [@media(hover:hover)]:group-hover:[animation-play-state:paused]">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
