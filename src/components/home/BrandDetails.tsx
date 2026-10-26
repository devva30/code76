import { EditorialImage } from '@/components/ui/EditorialImage';
import { FadeUp, RevealLines } from '@/components/ui/Reveal';
import { img, useContent } from '@/store/SiteContent';

export function BrandDetails() {
  const c = useContent('home.brandDetails');
  return (
    <section aria-labelledby="details-title" className="border-t border-rule">
      <div className="site-container py-24 md:py-36">
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-5">
            <p className="eyebrow mb-5 flex items-center gap-3">
              <span>{c.eyebrow}</span>
            </p>
            <RevealLines id="details-title" as="h2" lines={[c.line1, <span className="italic">{c.line2}</span>]} className="display text-[8.88vw] leading-[1.04] sm:text-5xl lg:text-[4.54vw] 2xl:text-[4.62rem]" />
            <div className="mt-12 grid grid-cols-5 gap-3">
              <EditorialImage
                className="col-span-3"
                src={img(c.image1)}
                alt={c.alt1}
                ratio="4 / 5"
                parallax={5}
                sizes="(min-width: 1024px) 24vw, 60vw"
              />
              <EditorialImage
                className="col-span-2 mt-16"
                src={img(c.image2)}
                alt={c.alt2}
                ratio="3 / 4"
                reveal="up"
                sizes="(min-width: 1024px) 16vw, 40vw"
              />
            </div>
          </div>

          <FadeUp stagger={0.1} className="grid content-end gap-x-10 sm:grid-cols-2 lg:col-span-6 lg:col-start-7">
            {c.items.map((d, i) => (
              <div key={i} className="border-t border-ink/80 py-8 sm:py-10">
                <h3 className="display text-3xl md:text-4xl">{d.title}</h3>
                <p className="mt-4 max-w-xs text-sm leading-relaxed text-graphite">{d.body}</p>
              </div>
            ))}
          </FadeUp>
        </div>
      </div>
    </section>
  );
}
