import type { ReactNode } from 'react';
import { RevealLines } from './Reveal';
import { cx } from '@/lib/format';
import { Screentone } from './PrintMarks';

/** Top-of-page heading for interior routes; clears the fixed header. */
export function PageIntro({
  eyebrow,
  title,
  children,
  className,
  aside,
}: {
  eyebrow: string;
  title: ReactNode[];
  children?: ReactNode;
  className?: string;
  aside?: ReactNode;
}) {
  return (
    <div className={cx('site-container relative pb-10 pt-[calc(var(--header-h)+var(--announce-h)+3rem)] md:pb-14 md:pt-[calc(var(--header-h)+var(--announce-h)+5rem)]', className)}>
      <Screentone className="right-0 top-0 hidden h-[70%] w-[40%] md:block" fade="radial" />
      <div className="relative flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow mb-5">{eyebrow}</p>
          <RevealLines as="h1" immediate lines={title} className="display text-[11.1vw] leading-[1.04] sm:text-6xl lg:text-[6.3vw] 2xl:text-[6.72rem]" />
          {children && <div className="mt-6 max-w-md text-sm leading-relaxed text-graphite">{children}</div>}
        </div>
        {aside}
      </div>
    </div>
  );
}
