import { useId } from 'react';
import { BRAND } from '@/config/brand';
import { cx } from '@/lib/format';

/** Stroke paths for C, D, E, 7 and the 6 stem (in logo units). */
export const LOGO_STROKES = [
  'M102 27.3A53.5 53.5 0 1 0 102 101.7',
  'M267 11H314.75A53.25 53.25 0 0 1 314.75 117.5H270.5V64',
  'M401 11H474M401 63.5H474M401 117.5H474',
  'M496 11H576L525 121',
  'M668 21C660 14 652 11.5 640 11.5C616 11.5 601 32 601 60V88.5',
] as const;
export const LOGO_VIEWBOX = '5 4 673 119';
export const LOGO_GRADIENT = [
  [0, '#36191B'], [0.26, '#4A2224'], [0.47, '#73383C'], [0.64, '#8F464A'], [0.79, '#A64C51'], [1, '#C45A60'],
] as const;
export const PIP_POSITIONS = [[165, 49], [194, 49], [179.5, 63.5], [165, 78], [194, 78]] as const;

/**
 * CODE76 logo, redrawn as vector paths from the master artwork
 * (public/brand/code76-logo.svg). Scales crisply at any size.
 *
 * - `color`: the brand gradient (default)
 * - `mono`:  single colour via `currentColor`, for photography or dark grounds
 */
export function Wordmark({ className, tone = 'color' }: { className?: string; tone?: 'color' | 'mono' }) {
  const gradId = `c76-${useId().replace(/:/g, '')}`;
  const stroke = tone === 'color' ? `url(#${gradId})` : 'currentColor';
  const disc = tone === 'color' ? '#4A2224' : 'currentColor';
  const pip = tone === 'color' ? '#F7F0EE' : 'var(--logo-pip, #F4F1EA)';

  return (
    <svg viewBox="5 4 673 119" role="img" aria-label={BRAND.name} className={cx('block h-auto', className)}>
      {tone === 'color' && (
        <defs>
          <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="6" y1="0" x2="677" y2="0">
            <stop offset="0" stopColor="#36191B" />
            <stop offset="0.26" stopColor="#4A2224" />
            <stop offset="0.47" stopColor="#73383C" />
            <stop offset="0.64" stopColor="#8F464A" />
            <stop offset="0.79" stopColor="#A64C51" />
            <stop offset="1" stopColor="#C45A60" />
          </linearGradient>
        </defs>
      )}
      <g fill="none" stroke={stroke} strokeWidth="8" strokeLinecap="butt" strokeLinejoin="miter">
        <path d="M102 27.3A53.5 53.5 0 1 0 102 101.7" />
        <path d="M267 11H314.75A53.25 53.25 0 0 1 314.75 117.5H270.5V64" />
        <path d="M401 11H474M401 63.5H474M401 117.5H474" />
        <path d="M496 11H576L525 121" />
        <path d="M668 21C660 14 652 11.5 640 11.5C616 11.5 601 32 601 60V88.5" />
        <ellipse cx="637" cy="88.5" rx="36" ry="29.5" />
      </g>
      <DieMark disc={disc} pip={pip} />
    </svg>
  );
}

/** The die “O” — usable on its own as a compact brand mark. */
function DieMark({ disc, pip }: { disc: string; pip: string }) {
  return (
    <>
      <circle cx="179.5" cy="63.5" r="58.5" fill={disc} />
      <g fill={pip}>
        <circle cx="165" cy="49" r="6" />
        <circle cx="194" cy="49" r="6" />
        <circle cx="179.5" cy="63.5" r="6" />
        <circle cx="165" cy="78" r="6" />
        <circle cx="194" cy="78" r="6" />
      </g>
    </>
  );
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="121 5 117 117" role="img" aria-label={BRAND.name} className={className}>
      <DieMark disc="#4A2224" pip="#F7F0EE" />
    </svg>
  );
}
