import { forwardRef } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

/**
 * A link that can point at a page of this site ("/shop") or, when the admin enters one, an outside
 * address ("https://instagram.com/…", "mailto:…"). Outside addresses open in a new tab.
 */
export const SiteLink = forwardRef<HTMLAnchorElement, LinkProps>(({ to, children, replace, state, ...rest }, ref) => {
  if (typeof to === 'string' && /^(https:|mailto:)/.test(to)) {
    const web = to.startsWith('https:');
    return (
      <a ref={ref} href={to} {...(web ? { target: '_blank', rel: 'noopener noreferrer' } : {})} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link ref={ref} to={to} replace={replace} state={state} {...rest}>
      {children}
    </Link>
  );
});
SiteLink.displayName = 'SiteLink';
