import { SiteLink } from '@/components/ui/SiteLink';
import { useContent, useFill } from '@/store/SiteContent';

/** Matte black strip with rolling gold offers. Edited in Admin → Website content → Gold offers ribbon. */
export function GoldRibbon() {
  const { items, link } = useContent('home.ribbon');
  const fill = useFill();
  if (!items.length) return null;
  const words = items.map(fill);
  const row = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {[...words, ...words].map((w, i) => (
        <li key={i} className="flex items-center">
          <span className="whitespace-nowrap px-6 font-mono text-[0.78rem] font-bold uppercase tracking-[0.16em] md:px-9 md:text-[0.86rem]">{w}</span>
          <span aria-hidden className="text-[0.7rem] text-gold/70">✦</span>
        </li>
      ))}
    </ul>
  );
  return (
    <SiteLink
      to={link || '/offers'}
      aria-label={words.join('. ')}
      className="group relative block overflow-hidden bg-night py-3.5 md:py-4"
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
      <div className="flex w-max animate-ticker bg-gradient-to-r from-gold-deep via-[#F1D892] to-gold bg-clip-text text-transparent [@media(hover:hover)]:group-hover:[animation-play-state:paused]">
        {row(false)}
        {row(true)}
      </div>
    </SiteLink>
  );
}
