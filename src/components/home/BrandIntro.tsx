import { useRef } from 'react';
import { RevealLines, FadeUp } from '@/components/ui/Reveal';
import { EditorialImage } from '@/components/ui/EditorialImage';
import { TextLink } from '@/components/ui/Button';
import { gsap, MQ, useGsap } from '@/lib/motion';
import { img, useContent } from '@/store/SiteContent';

/** Brand introduction with a scroll-scrubbed, word-by-word statement. */
export function BrandIntro() {
  const c = useContent('home.brandIntro');
  const statementRef = useRef<HTMLParagraphElement>(null);

  useGsap(statementRef, (mm, el) => {
    mm.add(MQ.anyMotion, () => {
      gsap.fromTo(
        el.querySelectorAll('[data-word]'),
        { opacity: 0.16 },
        {
          opacity: 1,
          stagger: 0.05,
          ease: 'none',
          scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 52%', scrub: 0.6 },
        },
      );
    });
  });

  return (
    <section aria-labelledby="intro-title" className="site-container relative py-24 md:py-36 lg:py-44">
      <div className="grid grid-cols-12 gap-y-14 lg:gap-x-8">
        <div className="col-span-12 lg:col-span-8">
          <p className="eyebrow mb-8 flex items-center gap-3">
            <span>{c.eyebrow}</span>
          </p>
          <RevealLines
            id="intro-title"
            as="h2"
            lines={[c.line1, c.line2]}
            lineClassName={(i) => (i === 1 ? 'italic pl-[8vw] lg:pl-[10vw]' : undefined)}
            className="display text-[11vw] leading-[1.04] sm:text-[9vw] lg:text-[6.8vw] 2xl:text-[7rem]"
          />
        </div>

        <div className="col-span-7 col-start-6 sm:col-span-5 sm:col-start-8 lg:col-span-3 lg:col-start-10 lg:mt-24">
          <EditorialImage
            src={img(c.image)}
            alt={c.alt}
            ratio="4 / 5"
            parallax={6}
            sizes="(min-width: 1024px) 22vw, 40vw"
          />
          <p className="mt-3 text-[0.68rem] font-mono uppercase tracking-[0.1em] text-graphite">{c.caption}</p>
        </div>

        <div className="col-span-12 lg:col-span-7 lg:col-start-3">
          <p ref={statementRef} className="lede text-[1.7rem] leading-[1.18] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.12]">
            {c.statement.split(' ').map((w, i) => (
              <span key={i} data-word className="inline-block whitespace-pre">
                {w}{' '}
              </span>
            ))}
          </p>
          <FadeUp className="mt-12 grid gap-8 border-t border-rule pt-8 sm:grid-cols-2">
            <p className="text-sm leading-relaxed text-graphite">
              {c.body}
            </p>
            <div className="sm:justify-self-end">
              {c.linkLabel && <TextLink to={c.linkTo}>{c.linkLabel}</TextLink>}
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}
