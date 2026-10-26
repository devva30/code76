import { useRef } from 'react';
import { ArrowUp } from 'lucide-react';
import { Wordmark } from '@/components/ui/Wordmark';
import { NewsletterForm } from '@/components/ui/NewsletterForm';
import { gsap, MQ, useGsap } from '@/lib/motion';
import { useSmoothScroll } from '@/lib/SmoothScroll';
import { useShop } from '@/store/ShopContext';
import { Screentone } from '@/components/ui/PrintMarks';
import { SiteLink } from '@/components/ui/SiteLink';
import { useContent, useFill, useSettings } from '@/store/SiteContent';

export function Footer() {
  const ref = useRef<HTMLElement>(null);
  const { scrollTo } = useSmoothScroll();
  const { notify } = useShop();
  const c = useContent('site.footer');
  const { supportEmail } = useSettings();
  const fill = useFill();

  useGsap(ref, (mm, el) => {
    mm.add(MQ.anyMotion, () => {
      gsap.fromTo(
        el.querySelector('[data-footer-mark]'),
        { yPercent: 60, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          ease: 'none',
          scrollTrigger: { trigger: el, start: 'top 85%', end: 'bottom bottom', scrub: 0.6 },
        },
      );
      gsap.fromTo(
        el.querySelectorAll('[data-footer-col]'),
        { y: 24, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, stagger: 0.08, duration: 1, scrollTrigger: { trigger: el, start: 'top 85%', once: true } },
      );
    });
  });

  return (
    <footer ref={ref} className="relative overflow-hidden border-t-[1.5px] border-ink bg-newsprint">
      <Screentone className="right-0 top-0 h-64 w-1/2" fade="to-left" />
      <div className="site-container relative pt-16 md:pt-24">
        <div className="grid gap-12 lg:grid-cols-12">
          <div data-footer-col className="lg:col-span-4">
            <p className="max-w-xs text-sm leading-relaxed text-graphite">
              {fill(c.blurb)}
            </p>
            <div className="mt-8 max-w-sm">
              <NewsletterForm compact tone="muted" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-5 lg:col-start-6">
            {c.columns.map((col, ci) => (
              <div key={ci} data-footer-col>
                <p className="eyebrow mb-5">{col.title}</p>
                <ul className="space-y-3 text-sm">
                  {col.links.map((l, li) => (
                    <li key={li}>
                      <SiteLink to={l.link} className="link-underline">{l.label}</SiteLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div data-footer-col className="lg:col-span-2 lg:col-start-11 lg:text-right">
            {c.socials.length > 0 && (
              <>
                <p className="eyebrow mb-5">Follow</p>
                <ul className="flex flex-wrap gap-5 text-sm lg:flex-col lg:gap-3">
                  {c.socials.map((s, i) => (
                    <li key={i}>
                      {s.link ? (
                        <SiteLink to={s.link} className="link-underline">{s.label}</SiteLink>
                      ) : (
                        // No address yet (Admin → Website content → Footer): say so instead of a dead link.
                        <button type="button" className="link-underline" onClick={() => notify({ title: `${s.label} link coming soon`, body: 'This account will be added soon.' })}>
                          {s.label}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="mt-8 text-xs text-graphite">
              Support
              <br />
              <a href={`mailto:${supportEmail}`} className="link-underline text-ink">{supportEmail}</a>
            </p>
          </div>
        </div>

        <div className="mt-16 flex flex-col-reverse gap-6 border-t border-rule py-6 text-xs text-graphite md:flex-row md:items-center md:justify-between">
          <p>{fill(c.copyright)}</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {c.legal.map((l, i) => (
              <li key={i}><SiteLink to={l.link} className="link-underline">{l.label}</SiteLink></li>
            ))}
            <li>
              <button type="button" onClick={() => scrollTo(0)} className="link-underline inline-flex items-center gap-1.5">
                Back to top <ArrowUp strokeWidth={1.25} className="h-3.5 w-3.5" />
              </button>
            </li>
          </ul>
        </div>
      </div>

      <div aria-hidden className="pointer-events-none select-none overflow-hidden">
        <div data-footer-mark className="site-container flex justify-center pb-10 pt-6 md:pb-14 md:pt-8">
          <Wordmark className="w-[min(62vw,400px)]" />
        </div>
      </div>
    </footer>
  );
}
