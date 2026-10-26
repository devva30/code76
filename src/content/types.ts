/**
 * The shape of each editable website section. Mirrors the server's ContentSchema
 * (server/src/main/java/com/code76/store/content/ContentSchema.java) and the original content in
 * server/src/main/resources/content/defaults.json.
 */
export interface Link2 {
  label: string;
  link: string;
}

export interface HeroSlideContent {
  image: string;
  mobileImage: string;
  alt: string;
  eyebrowLeft: string;
  eyebrowRight: string;
  line1: string;
  line2: string;
  copy: string;
  ctaLabel: string;
  ctaLink: string;
  pill: string;
  secondaryLabel: string;
  secondaryLink: string;
  tone: 'ink' | 'paper';
  align: 'left' | 'right';
  vAlign: 'top' | 'bottom';
  scrim: boolean;
  /** auto: tall photos are shown whole; cover: always fill; contain: always show the whole photo. */
  fit?: 'auto' | 'cover' | 'contain';
  position: string;
  mobilePosition: string;
}

export type HomeSectionId =
  | 'hero' | 'ribbon' | 'featured' | 'offer' | 'shopByFit' | 'marquee' | 'signature' | 'lookbook' | 'brandIntro' | 'brandDetails' | 'testimonials' | 'newsletter';

interface Heading {
  eyebrow: string;
  line1: string;
  line2: string;
}

export interface SizeRow {
  size: string;
  chest: number;
  length: number;
  shoulder: number;
}

export interface SiteSections {
  'home.layout': { sections: { id: HomeSectionId; visible: boolean }[] };
  'home.hero': { slides: HeroSlideContent[] };
  'home.ribbon': { items: string[]; link: string };
  'home.featured': Heading & { copy: string; linkLabel: string; linkTo: string; count: number };
  'home.shopByFit': Heading & {
    intro: string;
    cards: { badge: string; title: string; copy: string; ctaLabel: string; link: string; image: string; alt: string }[];
  };
  'home.marquee': { words: string[] };
  'home.signature': Heading & {
    productSlug: string;
    chapters: { label: string; title: string; body: string; image: string; alt: string }[];
    ctaLabel: string;
  };
  'home.lookbook': Heading & {
    intro: string;
    frames: { image: string; alt: string; caption: string; size: 'tall' | 'wide' | 'small'; offset: 'top' | 'middle' | 'bottom'; productSlug: string }[];
    outroLine1: string;
    outroLine2: string;
    ctaLabel: string;
    ctaLink: string;
  };
  'home.brandIntro': Heading & { statement: string; image: string; alt: string; caption: string; body: string; linkLabel: string; linkTo: string };
  'home.brandDetails': Heading & { image1: string; alt1: string; image2: string; alt2: string; items: { title: string; body: string }[] };
  'home.testimonials': Heading & { showSampleNote: boolean; sampleNote: string; items: { quote: string; name: string; detail: string }[] };
  'home.newsletter': Heading & { body: string; image: string; alt: string };
  'home.offer': {
    eyebrow: string; badge: string; line1: string; line2: string; body: string; bigText: string; bigNote: string;
    perks: string[]; ctaLabel: string; ctaLink: string; endsOn: string; image: string; alt: string;
  };
  'site.announcements': { items: string[]; link: string };
  'site.header': {
    nav: (Link2 & { showPanel: boolean })[];
    panelEyebrow: string;
    panelTitle: string;
    panelLinkLabel: string;
    panelLink: string;
    panel: (Link2 & { image: string; note: string })[];
  };
  'site.mobileMenu': { links: Link2[]; promoImage: string; promoEyebrow: string; promoTitle: string; promoLink: string };
  'site.footer': { blurb: string; columns: { title: string; links: Link2[] }[]; socials: Link2[]; copyright: string; legal: Link2[] };
  'site.search': { suggestions: string[] };
  'page.shopAll': Heading & { title: string; intro: string };
  'page.about': Heading & {
    heroImage: string;
    heroImageMobile: string;
    heroAlt: string;
    ideaLabel: string;
    ideaLead: string;
    ideaBody1: string;
    ideaBody2: string;
    marquee: string[];
    sideImage: string;
    sideAlt: string;
    beliefsLine1: string;
    beliefsLine2: string;
    principles: { title: string; body: string }[];
    showDetails: boolean;
    careLine1: string;
    careLine2: string;
    careNote: string;
    policies: { anchor: string; title: string; body: string }[];
    primaryLabel: string;
    primaryLink: string;
    secondaryLabel: string;
    secondaryLink: string;
  };
  'page.offers': { eyebrow: string; line1: string; line2: string; intro: string; emptyTitle: string; emptyBody: string };
  'product.page': { priceNote: string; shippingNote: string; shippingReturns: string };
  'product.sizeGuide': { intro: string; oversized: SizeRow[]; oversizedAdvice: string; regular: SizeRow[]; regularAdvice: string };
}

export type SectionKey = keyof SiteSections;

/** Store settings the website shows (money in rupees for display). */
export interface SiteSettings {
  storeName: string;
  tagline: string;
  supportEmail: string;
  freeShippingThreshold: number;
  shippingFee: number;
  maxQuantityPerLine: number;
}
