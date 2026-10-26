import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { type LinkProps } from 'react-router-dom';
import { SiteLink } from './SiteLink';
import { ArrowRight } from 'lucide-react';
import { cx } from '@/lib/format';

type Variant = 'primary' | 'outline' | 'ghost' | 'light';

const base =
  'group relative inline-flex select-none items-center justify-center gap-3 whitespace-nowrap font-sans text-[0.8rem] font-semibold tracking-[0.01em] disabled:cursor-not-allowed disabled:opacity-40';

const variants: Record<Variant, string> = {
  primary: 'press h-12 px-7 bg-solid text-onsolid hover:bg-solid/90',
  outline: 'press h-12 px-7 border-[1.5px] border-ink text-ink hover:bg-ink hover:text-paper',
  light: 'press h-12 px-7 bg-paper text-ink hover:bg-white',
  ghost: 'h-auto px-0 text-ink transition-colors',
};

function Inner({ children, arrow }: { children: ReactNode; arrow?: boolean }) {
  return (
    <>
      <span className="relative">{children}</span>
      {arrow && (
        <ArrowRight
          aria-hidden
          strokeWidth={1.25}
          className="relative h-4 w-4 transition-transform duration-500 ease-editorial group-hover:translate-x-1"
        />
      )}
    </>
  );
}

interface CommonProps {
  variant?: Variant;
  arrow?: boolean;
  full?: boolean;
  className?: string;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, CommonProps & ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ variant = 'primary', arrow, full, className, children, type = 'button', ...rest }, ref) => (
    <button ref={ref} type={type} className={cx(base, variants[variant], full && 'w-full', className)} {...rest}>
      <Inner arrow={arrow}>{children}</Inner>
    </button>
  ),
);
Button.displayName = 'Button';

export function ButtonLink({ variant = 'primary', arrow, full, className, children, ...rest }: CommonProps & LinkProps) {
  return (
    <SiteLink className={cx(base, variants[variant], full && 'w-full', className)} {...rest}>
      <Inner arrow={arrow}>{children}</Inner>
    </SiteLink>
  );
}

/** Understated text link with an underline that retracts on hover. */
export function TextLink({ className, children, ...rest }: LinkProps & { className?: string; children: ReactNode }) {
  return (
    <SiteLink
      className={cx('link-static-underline text-[0.82rem] font-semibold', className)}
      {...rest}
    >
      {children}
    </SiteLink>
  );
}
