-- Catalogue management from the admin panel.

-- Sizes: XXS to 3XL (stored as XXXL). Each colour offers whichever of these the admin chooses.
ALTER TABLE product_variants DROP CONSTRAINT ck_product_variants_size;
ALTER TABLE product_variants ADD CONSTRAINT ck_product_variants_size
  CHECK (size IN ('XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'));
ALTER TABLE order_items ADD CONSTRAINT ck_order_items_size
  CHECK (size IN ('XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'));

-- What each collection page shows: a small heading, an intro paragraph and an optional banner photo.
ALTER TABLE collections ADD COLUMN eyebrow    VARCHAR(80)  NOT NULL DEFAULT '';
ALTER TABLE collections ADD COLUMN intro      VARCHAR(600) NOT NULL DEFAULT '';
ALTER TABLE collections ADD COLUMN banner_url VARCHAR(500);
ALTER TABLE collections ADD COLUMN banner_alt VARCHAR(300) NOT NULL DEFAULT '';

-- Bring over the copy and banners that used to be written into the website code.
UPDATE collections SET eyebrow = 'Just in',
  intro = 'The latest additions for the new season. Familiar shapes, refined with new weights and tones.',
  banner_url = '/images/editorial/look-colonnade.webp', banner_alt = 'Model in a white tee in a concrete colonnade'
  WHERE slug = 'new-arrivals';
UPDATE collections SET eyebrow = 'Shop by fit',
  intro = 'Dropped shoulders, wider bodies and a deliberate drape. Cut to look relaxed, never sloppy.',
  banner_url = '/images/editorial/fit-oversized.webp', banner_alt = 'Model in an oversized white tee beside a timber building'
  WHERE slug = 'oversized';
UPDATE collections SET eyebrow = 'Shop by fit',
  intro = 'Clean, close lines with just enough ease. The everyday foundation, perfected.',
  banner_url = '/images/editorial/fit-regular.webp', banner_alt = 'Model in a regular-fit white tee in a sunlit room'
  WHERE slug = 'regular-fit';

-- Keeps the admin's chosen order stable when two products share a rank.
CREATE INDEX IF NOT EXISTS ix_products_rank_id ON products (featured_rank, id);
