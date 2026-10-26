/**
 * Demo catalogue. All product data lives here so a backend can later
 * replace this module with an API client exposing the same types.
 */

export type Fit = 'oversized' | 'regular';
export type Size = 'XXS' | 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL';

export interface ProductImage {
  src: string;
  alt: string;
}

export interface Colorway {
  id: string;
  name: string;
  hex: string;
  images: ProductImage[];
  /** Sizes that are currently unavailable in this colourway. */
  soldOut?: Size[];
}

export interface Product {
  slug: string;
  name: string;
  subtitle: string;
  price: number;
  /** Original price when the piece is on offer (demo pricing). */
  compareAtPrice?: number;
  fit: Fit;
  fitLabel: string;
  isNew: boolean;
  /** Lower numbers appear first in “Featured” sort. */
  rank: number;
  addedAt: string;
  description: string;
  details: string[];
  fitNotes: string[];
  care: string[];
  colorways: Colorway[];
  sizes: Size[];
}

export const ALL_SIZES: Size[] = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

/** How a size is shown to shoppers: XXXL is better known as 3XL. */
export const sizeLabel = (size: string) => (size === 'XXXL' ? '3XL' : size);

const img = (file: string, alt: string): ProductImage => ({ src: `/images/products/${file}.webp`, alt });

export const products: Product[] = [
  {
    slug: 'form-oversized-tee',
    name: 'Form Oversized Tee',
    subtitle: 'Dropped shoulder, boxy body',
    price: 2490,
    fit: 'oversized',
    fitLabel: 'Oversized fit',
    isNew: true,
    rank: 1,
    addedAt: '2026-10-01',
    description:
      'Our signature oversized silhouette. A wide, squared body with a dropped shoulder and a sleeve that settles just above the elbow — cut to hang with intent rather than simply run large.',
    details: [
      'Dense cotton jersey with a soft, dry hand',
      'Ribbed crew neck that holds its shape',
      'Dropped shoulder seam and elbow-length sleeve',
      'Straight, slightly cropped hem',
    ],
    fitNotes: ['Oversized through the body and shoulder', 'Take your usual size for the intended fit', 'Size down for a closer, boxy look'],
    care: ['Machine wash cold, inside out', 'Dry flat in the shade', 'Cool iron on reverse'],
    sizes: ALL_SIZES,
    colorways: [
      {
        id: 'noir',
        name: 'Noir',
        hex: '#26231F',
        images: [
          img('form-noir-1', 'Model wearing the Form Oversized Tee in Noir, front view'),
          img('form-noir-2', 'Model wearing the Form Oversized Tee in Noir, relaxed stance'),
          img('form-noir-3', 'Form Oversized Tee in Noir, shoulder and sleeve drape'),
          img('form-noir-4', 'Form Oversized Tee in Noir, full silhouette'),
        ],
        soldOut: ['XS'],
      },
      {
        id: 'rose',
        name: 'Dusty Rose',
        hex: '#C98587',
        images: [
          img('form-rose-1', 'Model wearing the Form Oversized Tee in Dusty Rose'),
          img('form-rose-2', 'Form Oversized Tee in Dusty Rose, styled with denim'),
          img('form-rose-3', 'Form Oversized Tee in Dusty Rose on a hanger'),
          img('form-rose-4', 'Form Oversized Tee in Dusty Rose, neckline detail'),
        ],
      },
      {
        id: 'chalk',
        name: 'Chalk',
        hex: '#F2F0EA',
        images: [
          img('form-chalk-1', 'Model wearing the Form Oversized Tee in Chalk'),
          img('form-chalk-2', 'Form Oversized Tee in Chalk, side view'),
          img('form-chalk-3', 'Form Oversized Tee in Chalk, three-quarter view'),
          img('form-chalk-4', 'Form Oversized Tee in Chalk, sleeve detail'),
        ],
        soldOut: ['XXL'],
      },
    ],
  },
  {
    slug: 'daily-regular-tee',
    name: 'Daily Regular Tee',
    subtitle: 'A true everyday crew',
    price: 1690,
    compareAtPrice: 1990,
    fit: 'regular',
    fitLabel: 'Regular fit',
    isNew: false,
    rank: 2,
    addedAt: '2026-06-12',
    description:
      'The tee you reach for first. A clean regular fit with a set-in shoulder and a slightly longer body, designed to sit neatly under a jacket or stand on its own.',
    details: ['Mid-weight cotton jersey', 'Narrow ribbed crew neck', 'Set-in shoulder for a tailored line', 'Straight hem with side seams'],
    fitNotes: ['True to size with a little ease', 'Model is 185 cm and wears size M'],
    care: ['Machine wash cold with similar colours', 'Do not tumble dry', 'Warm iron if needed'],
    sizes: ALL_SIZES,
    colorways: [
      {
        id: 'white',
        name: 'Optic White',
        hex: '#FAFAF7',
        images: [
          img('daily-white-1', 'Model wearing the Daily Regular Tee in Optic White, front view'),
          img('daily-white-2', 'Daily Regular Tee in Optic White, back view'),
          img('daily-white-3', 'Daily Regular Tee in Optic White on a hanger'),
          img('daily-white-4', 'Close-up of the shoulder seam on the Daily Regular Tee'),
        ],
      },
      {
        id: 'heather',
        name: 'Heather Grey',
        hex: '#A8A49C',
        images: [
          img('daily-heather-1', 'Model wearing the Daily Regular Tee in Heather Grey'),
          img('daily-heather-2', 'Daily Regular Tee in Heather Grey, back view'),
        ],
        soldOut: ['XS', 'XXL'],
      },
      {
        id: 'noir',
        name: 'Noir',
        hex: '#26231F',
        images: [
          img('daily-noir-1', 'Daily Regular Tee in Noir on a hanger'),
          img('daily-noir-2', 'Daily Regular Tee in Noir, back view'),
          img('daily-noir-3', 'Model wearing the Daily Regular Tee in Noir against a concrete wall'),
        ],
      },
    ],
  },
  {
    slug: 'relaxed-pocket-tee',
    name: 'Relaxed Pocket Tee',
    subtitle: 'Easy cut with a patch pocket',
    price: 2190,
    fit: 'regular',
    fitLabel: 'Relaxed regular fit',
    isNew: true,
    rank: 3,
    addedAt: '2026-09-20',
    description:
      'A relaxed take on the regular fit, finished with a single chest pocket. Warm sand tones and an easy line make it the most quietly versatile piece in the collection.',
    details: ['Soft cotton jersey', 'Single patch pocket at the chest', 'Slightly relaxed body and sleeve', 'Clean double-needle hem'],
    fitNotes: ['Relaxed, but not oversized', 'Take your usual size'],
    care: ['Machine wash cold', 'Reshape while damp and dry flat'],
    sizes: ALL_SIZES,
    colorways: [
      {
        id: 'sand',
        name: 'Sand',
        hex: '#C9B49A',
        images: [
          img('pocket-sand-1', 'Model wearing the Relaxed Pocket Tee in Sand, leaning in a doorway'),
          img('pocket-sand-2', 'Relaxed Pocket Tee in Sand, in motion'),
          img('pocket-sand-3', 'Relaxed Pocket Tee in Sand, front view'),
          img('pocket-sand-4', 'Relaxed Pocket Tee in Sand, seated'),
        ],
        soldOut: ['XXL'],
      },
    ],
  },
  {
    slug: 'heavyweight-boxy-tee',
    name: 'Heavyweight Boxy Tee',
    subtitle: 'Structured, squared silhouette',
    price: 2690,
    fit: 'regular',
    fitLabel: 'Boxy regular fit',
    isNew: true,
    rank: 4,
    addedAt: '2026-10-08',
    description:
      'Our most structured tee. A heavier jersey gives the boxy body its architectural shape — squared at the shoulder, straight through the side, and cropped to sit at the hip.',
    details: ['Heavyweight cotton jersey with body', 'Wide ribbed neckband', 'Squared shoulder and straight side', 'Cropped hip-length hem'],
    fitNotes: ['Boxy and slightly cropped', 'Take your usual size'],
    care: ['Machine wash cold, inside out', 'Dry flat', 'Do not bleach'],
    sizes: ['S', 'M', 'L', 'XL'],
    colorways: [
      {
        id: 'stone',
        name: 'Stone',
        hex: '#D9D6C8',
        images: [
          img('boxy-stone-1', 'Model wearing the Heavyweight Boxy Tee in Stone, in warm sunlight'),
          img('boxy-stone-2', 'Heavyweight Boxy Tee in Stone, laid flat'),
          img('boxy-stone-3', 'Heavyweight Boxy Tee in Stone, fabric in afternoon light'),
        ],
      },
    ],
  },
  {
    slug: 'weekend-relaxed-tee',
    name: 'Weekend Relaxed Tee',
    subtitle: 'Softly draped crew',
    price: 1890,
    compareAtPrice: 2290,
    fit: 'regular',
    fitLabel: 'Relaxed regular fit',
    isNew: false,
    rank: 5,
    addedAt: '2026-07-04',
    description:
      'A lighter, softly draped crew with a gentle shoulder and a relaxed sleeve. Simple enough for everything, considered enough to wear on its own.',
    details: ['Light cotton jersey', 'Fine ribbed neck', 'Relaxed sleeve with a clean hem', 'Gently curved hem'],
    fitNotes: ['Relaxed through the body', 'True to size'],
    care: ['Machine wash cold', 'Line dry in the shade'],
    sizes: ALL_SIZES,
    colorways: [
      {
        id: 'white',
        name: 'Soft White',
        hex: '#F4F2EC',
        images: [
          img('weekend-white-1', 'Model wearing the Weekend Relaxed Tee in Soft White'),
          img('weekend-white-2', 'Weekend Relaxed Tee in Soft White, back view'),
          img('weekend-white-4', 'Weekend Relaxed Tee in Soft White, styled with trousers'),
          img('weekend-white-3', 'Weekend Relaxed Tee in Soft White, styled with denim'),
        ],
      },
    ],
  },
  {
    slug: 'field-oversized-tee',
    name: 'Field Oversized Tee',
    subtitle: 'Generous cut, clean finish',
    price: 2390,
    compareAtPrice: 2790,
    fit: 'oversized',
    fitLabel: 'Oversized fit',
    isNew: false,
    rank: 6,
    addedAt: '2026-05-18',
    description:
      'A generous, easy oversized tee in a warm bone tone. The longer body and full sleeve give it a relaxed, lived-in movement from the first wear.',
    details: ['Cotton jersey with a soft finish', 'Wide crew neck', 'Full sleeve and longer body', 'Straight hem'],
    fitNotes: ['Generously oversized', 'Size down one for a closer fit'],
    care: ['Machine wash cold', 'Dry flat'],
    sizes: ALL_SIZES,
    colorways: [
      {
        id: 'bone',
        name: 'Bone',
        hex: '#EEEAE0',
        images: [
          img('field-bone-1', 'Model wearing the Field Oversized Tee in Bone'),
          img('field-bone-2', 'Field Oversized Tee in Bone, worn outdoors with a skateboard'),
          img('field-bone-3', 'Field Oversized Tee in Bone, front view with cap'),
          img('field-bone-4', 'Field Oversized Tee in Bone, neckline detail'),
        ],
        soldOut: ['XS', 'S'],
      },
    ],
  },
];

export type CollectionHandle = 'all' | 'new-arrivals' | 'oversized' | 'regular-fit';

export interface Collection {
  handle: CollectionHandle;
  title: string;
  eyebrow: string;
  intro: string;
  filter: (p: Product) => boolean;
}

export const collections: Record<CollectionHandle, Collection> = {
  all: {
    handle: 'all',
    title: 'Shop All',
    eyebrow: 'The collection',
    intro: 'Every piece in the current collection — oversized and regular fits in a considered, seasonless palette.',
    filter: () => true,
  },
  'new-arrivals': {
    handle: 'new-arrivals',
    title: 'New Arrivals',
    eyebrow: 'Just in',
    intro: 'The latest additions for the new season. Familiar shapes, refined with new weights and tones.',
    filter: (p) => p.isNew,
  },
  oversized: {
    handle: 'oversized',
    title: 'Oversized',
    eyebrow: 'Shop by fit',
    intro: 'Dropped shoulders, wider bodies and a deliberate drape. Cut to look relaxed, never sloppy.',
    filter: (p) => p.fit === 'oversized',
  },
  'regular-fit': {
    handle: 'regular-fit',
    title: 'Regular Fit',
    eyebrow: 'Shop by fit',
    intro: 'Clean, close lines with just enough ease. The everyday foundation, perfected.',
    filter: (p) => p.fit === 'regular',
  },
};

export const getProduct = (slug: string) => products.find((p) => p.slug === slug);

export const getColorway = (product: Product, colorId?: string) =>
  product.colorways.find((c) => c.id === colorId) ?? product.colorways[0];

/** Unique colour families present across the catalogue, for filtering. */
export const colorFilters = Array.from(
  new Map(products.flatMap((p) => p.colorways).map((c) => [c.name, c.hex])).entries(),
).map(([name, hex]) => ({ name, hex }));
