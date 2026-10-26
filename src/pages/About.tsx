import { useEffect } from 'react';
import { EditorialImage } from '@/components/ui/EditorialImage';
import { FadeUp, RevealLines } from '@/components/ui/Reveal';
import { ButtonLink } from '@/components/ui/Button';
import { Marquee } from '@/components/ui/Marquee';
import { BRAND } from '@/config/brand';
import { img, useContent, useFill } from '@/store/SiteContent';

function PolicyBlock({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-32 border-t border-rule py-10 md:grid md:grid-cols-12 md:gap-8">
      <h3 id={`${id}-title`} className="display text-3xl md:col-span-4">{title}</h3>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-graphite md:col-span-7 md:col-start-6 md:mt-0">{children}</div>
    </section>
  );
}

/** Our story page. Every word and photo here is edited in Admin → Website content → Our story page. */
export default function About() {
  const c = useContent('page.about');
  const details = useContent('home.brandDetails').items;
  const fill = useFill();

  useEffect(() => {
    document.title = `${c.eyebrow || 'Our story'} — ${BRAND.name}`;
  }, [c.eyebrow]);

  return (
    <>
      <section className="site-container pt-[calc(var(--header-h)+var(--announce-h)+3rem)] md:pt-[calc(var(--header-h)+var(--announce-h)+5rem)]">
        <p className="eyebrow mb-6">{c.eyebrow}</p>
        <RevealLines
          as="h1"
          immediate
          lines={[c.line1, <span className="italic">{c.line2}</span>]}
          className="display text-[11.1vw] leading-[1.04] sm:text-[8.8vw] lg:text-[7.06vw] 2xl:text-[7.56rem]"
        />
        {c.heroImage && (
          <div className="mt-12 md:mt-16">
            <EditorialImage src={img(c.heroImage)} alt={c.heroAlt} ratio="3 / 2" reveal="up" parallax={6} eager className="hidden md:block" />
            <EditorialImage src={img(c.heroImageMobile || c.heroImage)} alt={c.heroAlt} ratio="4 / 5" reveal="up" eager className="md:hidden" />
          </div>
        )}
      </section>

      <section className="site-container py-24 md:py-36">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          <p className="eyebrow lg:col-span-3">{c.ideaLabel}</p>
          <div className="lg:col-span-8">
            <FadeUp as="p" className="lede text-3xl leading-[1.15] md:text-[2.75rem] md:leading-[1.12]">
              {fill(c.ideaLead)}
            </FadeUp>
            {(c.ideaBody1 || c.ideaBody2) && (
              <FadeUp className="mt-12 grid gap-8 text-sm leading-relaxed text-graphite sm:grid-cols-2">
                {c.ideaBody1 && <p>{fill(c.ideaBody1)}</p>}
                {c.ideaBody2 && <p>{fill(c.ideaBody2)}</p>}
              </FadeUp>
            )}
          </div>
        </div>
      </section>

      {c.marquee.length > 0 && <Marquee words={c.marquee} />}

      <section className="site-container py-24 md:py-36">
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-8">
          {c.sideImage && (
            <div className="lg:col-span-5">
              <EditorialImage src={img(c.sideImage)} alt={c.sideAlt} ratio="4 / 5" reveal="left" parallax={6} />
            </div>
          )}
          <div className="lg:col-span-6 lg:col-start-7 lg:self-center">
            <RevealLines as="h2" lines={[c.beliefsLine1, <span className="italic">{c.beliefsLine2}</span>]} className="display text-[8.88vw] leading-[1.04] sm:text-5xl lg:text-6xl" />
            <FadeUp stagger={0.1} className="mt-12">
              {c.principles.map((p, i) => (
                <div key={i} className="border-t border-rule py-7">
                  <div>
                    <h3 className="display text-3xl">{p.title}</h3>
                    <p className="mt-3 max-w-md text-sm leading-relaxed text-graphite">{p.body}</p>
                  </div>
                </div>
              ))}
            </FadeUp>
          </div>
        </div>
      </section>

      {/* The same points as the home page's "The details" section. */}
      {c.showDetails && details.length > 0 && (
        <section className="bg-newsprint py-24 md:py-32">
          <div className="site-container grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {details.map((d, i) => (
              <FadeUp key={i} className="border-t border-ink/70 pt-6">
                <h3 className="display text-3xl">{d.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-graphite">{d.body}</p>
              </FadeUp>
            ))}
          </div>
        </section>
      )}

      <section className="site-container py-24 md:py-32" aria-labelledby="info-title">
        <div className="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <h2 id="info-title" className="display text-[2.6rem] md:text-6xl">
            {c.careLine1} <span className="italic">{c.careLine2}</span>
          </h2>
          {c.careNote && <p className="stamp-mark self-start md:self-end">{c.careNote}</p>}
        </div>

        {c.policies.map((p) => (
          <PolicyBlock key={p.anchor} id={p.anchor} title={p.title}>
            {/* A blank line in the admin starts a new paragraph. */}
            {fill(p.body)
              .split(/\n\s*\n/)
              .filter((para) => para.trim())
              .map((para, i) => (
                <p key={i} className="whitespace-pre-line">{para.trim()}</p>
              ))}
          </PolicyBlock>
        ))}

        {(c.primaryLabel || c.secondaryLabel) && (
          <div className="mt-16 flex flex-col gap-3 sm:flex-row">
            {c.primaryLabel && <ButtonLink to={c.primaryLink || '/shop'} arrow>{c.primaryLabel}</ButtonLink>}
            {c.secondaryLabel && <ButtonLink to={c.secondaryLink || '/shop'} variant="outline">{c.secondaryLabel}</ButtonLink>}
          </div>
        )}
      </section>
    </>
  );
}
