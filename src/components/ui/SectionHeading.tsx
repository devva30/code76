import type { ReactNode } from 'react';
import { RevealLines } from './Reveal';
import { cx } from '@/lib/format';

interface SectionHeadingProps {
  eyebrow?: string;
  index?: string;
  lines: ReactNode[];
  aside?: ReactNode;
  className?: string;
  size?: 'md' | 'lg';
}

/** Editorial section header: index + eyebrow, display headline, optional aside. */
export function SectionHeading({ eyebrow, index, lines, aside, className, size = 'md' }: SectionHeadingProps) {
  return (
    <div className={cx('flex flex-col gap-6 md:flex-row md:items-end md:justify-between', className)}>
      <div>
        {(eyebrow || index) && (
          <p className="eyebrow mb-5 flex items-center gap-3">
            {eyebrow && <span>{eyebrow}</span>}
          </p>
        )}
        <RevealLines
          lines={lines}
          className={cx(
            'display',
            size === 'lg' ? 'text-[9.6vw] sm:text-[8vw] lg:text-[6vw] 2xl:text-[5.9rem]' : 'text-[8.2vw] sm:text-5xl lg:text-6xl 2xl:text-[4.6rem]',
          )}
        />
      </div>
      {aside && <div className="md:max-w-sm md:pb-2">{aside}</div>}
    </div>
  );
}
