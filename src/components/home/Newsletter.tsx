import { NewsletterForm } from '@/components/ui/NewsletterForm';
import { RevealLines, FadeUp } from '@/components/ui/Reveal';
import { EditorialImage } from '@/components/ui/EditorialImage';
import { img, useContent } from '@/store/SiteContent';

export function Newsletter() {
  const c = useContent('home.newsletter');
  return (
    <section aria-labelledby="newsletter-title" className="site-container py-24 md:py-36">
      <div className="grid items-end gap-14 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-7">
          <p className="eyebrow mb-6 flex items-center gap-3">
            <span>{c.eyebrow}</span>
          </p>
          <RevealLines
            id="newsletter-title"
            as="h2"
            lines={[c.line1, <span className="italic">{c.line2}</span>]}
            className="display text-[12.58vw] leading-[1.04] sm:text-[9.6vw] lg:text-[6.72vw] 2xl:text-[7.14rem]"
          />
          <FadeUp className="mt-10 max-w-lg">
            <p className="mb-10 text-sm leading-relaxed text-graphite">
              {c.body}
            </p>
            <NewsletterForm />
          </FadeUp>
        </div>
        <div className="hidden lg:col-span-4 lg:col-start-9 lg:block">
          <EditorialImage
            src={img(c.image)}
            alt={c.alt}
            ratio="4 / 5"
            parallax={6}
            sizes="30vw"
          />
        </div>
      </div>
    </section>
  );
}
