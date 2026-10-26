import { useEffect } from 'react';
import { Hero } from '@/components/home/Hero';
import { BrandIntro } from '@/components/home/BrandIntro';
import { FeaturedCollection } from '@/components/home/FeaturedCollection';
import { Lookbook } from '@/components/home/Lookbook';
import { ShopByFit } from '@/components/home/ShopByFit';
import { SignatureProduct } from '@/components/home/SignatureProduct';
import { BrandDetails } from '@/components/home/BrandDetails';
import { Testimonials } from '@/components/home/Testimonials';
import { Newsletter } from '@/components/home/Newsletter';
import { OfferBanner } from '@/components/home/OfferBanner';
import { GoldRibbon } from '@/components/home/GoldRibbon';
import { Marquee } from '@/components/ui/Marquee';
import { BRAND } from '@/config/brand';
import { useContent } from '@/store/SiteContent';
import type { HomeSectionId } from '@/content/types';

function MarqueeSection() {
  const { words } = useContent('home.marquee');
  return words.length ? <Marquee words={words} /> : null;
}

const SECTIONS: Record<HomeSectionId, () => JSX.Element | null> = {
  hero: Hero,
  ribbon: GoldRibbon,
  featured: FeaturedCollection,
  offer: OfferBanner,
  shopByFit: ShopByFit,
  marquee: MarqueeSection,
  signature: SignatureProduct,
  lookbook: Lookbook,
  brandIntro: BrandIntro,
  brandDetails: BrandDetails,
  testimonials: Testimonials,
  newsletter: Newsletter,
};

export default function Home() {
  useEffect(() => {
    document.title = `${BRAND.name} — ${BRAND.tagline.replace(/\.$/, '')}`;
  }, []);
  // Order and visibility come from Admin → Website content → Home page layout.
  const { sections } = useContent('home.layout');

  return (
    <>
      {sections
        .filter((s) => s.visible && SECTIONS[s.id])
        .map((s) => {
          const Section = SECTIONS[s.id];
          return <Section key={s.id} />;
        })}
    </>
  );
}
