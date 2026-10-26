import { useEffect, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { FadeUp } from '@/components/ui/Reveal';
import { SiteLink } from '@/components/ui/SiteLink';
import { img, useContent, useFill } from '@/store/SiteContent';
import { PHONE_SIZES, sized, srcSetFor } from '@/lib/api';

/** Time left until the end of the given day (YYYY-MM-DD, local time), or null if none or past. */
export function useCountdown(endsOn: string) {
  const end = /^\d{4}-\d{2}-\d{2}$/.test(endsOn) ? new Date(`${endsOn}T23:59:59`).getTime() : NaN;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (Number.isNaN(end)) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [end]);
  if (Number.isNaN(end) || end <= now) return null;
  const s = Math.floor((end - now) / 1000);
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), mins: Math.floor((s % 3600) / 60), secs: s % 60 };
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The "Power-Up Deal" offer band. Every word, the photo, the button and the optional countdown are
 * edited in Admin → Website content → Power-Up Deal; it can be hidden or moved in Home page layout.
 */
export function OfferBanner() {
  const c = useContent('home.offer');
  const fill = useFill();
  const left = useCountdown(c.endsOn);

  return (
    <section id="power-up-deal" aria-labelledby="offer-title" className="relative scroll-mt-20 overflow-hidden bg-night text-white">
      {/* soft gold glow and fine diagonal lines */}
      <div aria-hidden className="pointer-events-none absolute -left-40 top-1/2 h-[520px] w-[520px] -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(212_175_92_/_0.2),transparent)]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgb(var(--c-gold)) 0 1px, transparent 1px 14px)' }}
      />
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />

      <div className="site-container relative grid items-center gap-14 py-20 md:py-28 lg:grid-cols-12 lg:gap-10">
        <FadeUp className="lg:col-span-7">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <span className="font-mono text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-gold">{c.eyebrow}</span>
            {c.badge && (
              <span className="rounded-full border border-gold/50 px-3 py-1 font-mono text-[0.62rem] font-medium uppercase tracking-[0.14em] text-gold">
                {c.badge}
              </span>
            )}
          </div>
          <h2 id="offer-title" className="display text-[10.5vw] leading-[1.02] sm:text-6xl lg:text-[4.6rem]">
            {c.line1}
            {c.line2 && (
              <>
                <br />
                <span className="bg-gradient-to-r from-gold via-[#F1D892] to-gold-deep bg-clip-text italic text-transparent">{c.line2}</span>
              </>
            )}
          </h2>
          {c.body && <p className="mt-6 max-w-lg text-base leading-relaxed text-white/70">{fill(c.body)}</p>}

          {c.perks.length > 0 && (
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {c.perks.map((p, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-white/85">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold text-night">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {fill(p)}
                </li>
              ))}
            </ul>
          )}

          {left && (
            <div className="mt-9" aria-label="Offer ends in">
              <p className="mb-3 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-white/50">Ends in</p>
              <div className="flex gap-2 sm:gap-3">
                {([['Days', left.days], ['Hrs', left.hours], ['Min', left.mins], ['Sec', left.secs]] as const).map(([label, v]) => (
                  <div key={label} className="w-16 rounded-md border border-gold/30 bg-white/[0.04] py-2.5 text-center sm:w-[4.5rem]">
                    <span className="block font-mono text-2xl font-semibold tabular-nums text-gold">{pad(v)}</span>
                    <span className="mt-0.5 block font-mono text-[0.58rem] uppercase tracking-[0.14em] text-white/50">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <SiteLink
            to={c.ctaLink || '/shop'}
            className="group mt-10 inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-gold to-gold-deep px-8 py-4 text-sm font-semibold text-night shadow-[0_10px_30px_-10px_rgb(var(--c-gold)/0.7)] transition-transform hover:-translate-y-0.5"
          >
            {c.ctaLabel}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </SiteLink>
        </FadeUp>

        <FadeUp className="relative mx-auto w-full max-w-md lg:col-span-5">
          {c.image ? (
            <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] border border-gold/40 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]">
              <img decoding="async" src={sized(img(c.image), 960)} srcSet={srcSetFor(img(c.image), 1280)} sizes={`${PHONE_SIZES}, (min-width: 1024px) 30vw, 90vw`} alt={c.alt} loading="lazy" className="h-full w-full object-cover" />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-night/50 via-transparent to-transparent" />
            </div>
          ) : (
            <div aria-hidden className="aspect-[4/5]" />
          )}
          {c.bigText && (
            <div
              className={
                c.image
                  ? 'absolute -left-1 -top-6 flex h-32 w-32 sm:-left-6 sm:h-36 sm:w-36 lg:h-40 lg:w-40 rotate-[-10deg] flex-col items-center justify-center rounded-full bg-gradient-to-br from-[#F1D892] via-gold to-gold-deep text-center text-night shadow-[0_20px_50px_-15px_rgba(0,0,0,0.8)] ring-4 ring-night'
                  : 'absolute inset-0 m-auto flex h-64 w-64 rotate-[-8deg] flex-col items-center justify-center rounded-full bg-gradient-to-br from-[#F1D892] via-gold to-gold-deep text-center text-night shadow-[0_30px_70px_-20px_rgba(0,0,0,0.9)]'
              }
            >
              <span className={c.image ? 'display text-4xl leading-none' : 'display text-7xl leading-none'}>{c.bigText}</span>
              {c.bigNote && (
                <span className={c.image ? 'mt-1.5 max-w-[7.5rem] text-[0.62rem] font-semibold uppercase leading-tight tracking-wide' : 'mt-3 max-w-[11rem] text-xs font-semibold uppercase leading-tight tracking-wide'}>
                  {fill(c.bigNote)}
                </span>
              )}
            </div>
          )}
        </FadeUp>
      </div>
    </section>
  );
}
