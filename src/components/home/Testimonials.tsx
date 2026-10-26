import { FadeUp } from '@/components/ui/Reveal';
import { Screentone } from '@/components/ui/PrintMarks';
import { useContent } from '@/store/SiteContent';

/**
 * Customer quotes, edited in Admin → Website content. The original quotes are clearly labelled
 * samples; replace them with real reviews (and switch the sample note off) before launch.
 */
export function Testimonials() {
  const c = useContent('home.testimonials');
  if (!c.items.length) return null;
  return (
    <section aria-labelledby="impressions-title" className="relative overflow-hidden bg-newsprint py-24 md:py-32">
      <Screentone className="right-0 top-0 h-72 w-[45%]" fade="to-left" />
      <div className="site-container relative">
        <div className="mb-14 flex flex-col gap-5 md:mb-20 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow mb-5 flex items-center gap-3">
              <span>{c.eyebrow}</span>
            </p>
            <h2 id="impressions-title" className="display text-[8.14vw] leading-[1.04] sm:text-5xl lg:text-6xl">
              {c.line1} <span className="italic">{c.line2}</span>
            </h2>
          </div>
          {c.showSampleNote && c.sampleNote && <p className="stamp-mark self-start md:self-end">{c.sampleNote}</p>}
        </div>

        <FadeUp stagger={0.12} className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 sm:scroll-px-6 overflow-x-auto px-4 sm:-mx-6 sm:px-6 md:mx-0 md:grid md:grid-cols-3 md:gap-0 md:overflow-visible md:px-0">
          {c.items.map((t, i) => (
            <figure
              key={i}
              className="flex w-[82vw] shrink-0 snap-start flex-col justify-between border-t border-ink/70 pt-8 sm:w-[60vw] md:w-auto md:border-l md:border-t-0 md:px-10 md:pt-0 md:first:border-l-0 md:first:pl-0"
            >
              <blockquote className="lede text-[1.35rem] leading-[1.3] md:text-[1.6rem]">
                <span aria-hidden className="mr-1 text-stamp">“</span>
                {t.quote}
                <span aria-hidden className="text-stamp">”</span>
              </blockquote>
              <figcaption className="mt-10 text-xs">
                <span className="block font-medium font-mono uppercase tracking-[0.1em]">{t.name}</span>
                <span className="mt-1 block text-graphite">{t.detail}</span>
              </figcaption>
            </figure>
          ))}
        </FadeUp>
      </div>
    </section>
  );
}
