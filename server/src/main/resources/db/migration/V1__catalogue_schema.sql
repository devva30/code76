-- CODE76 catalogue schema.
-- Money is stored as BIGINT paise (1 INR = 100 paise): exact integer arithmetic, no floating point.

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Categories: what kind of tee (essentials, graphic, pocket …)
-- ---------------------------------------------------------------------------
CREATE TABLE categories (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug        VARCHAR(80)  NOT NULL,
  name        VARCHAR(120) NOT NULL,
  description TEXT,
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT uq_categories_slug UNIQUE (slug),
  CONSTRAINT ck_categories_slug CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

-- ---------------------------------------------------------------------------
-- Collections: curated groupings (new arrivals, oversized, a seasonal drop …)
-- ---------------------------------------------------------------------------
CREATE TABLE collections (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug        VARCHAR(80)  NOT NULL,
  name        VARCHAR(120) NOT NULL,
  description TEXT,
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT uq_collections_slug UNIQUE (slug),
  CONSTRAINT ck_collections_slug CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
CREATE TABLE products (
  id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug                   VARCHAR(120) NOT NULL,
  name                   VARCHAR(160) NOT NULL,
  subtitle               VARCHAR(200),
  description            TEXT         NOT NULL DEFAULT '',
  category_id            BIGINT       NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
  fit                    VARCHAR(20)  NOT NULL,
  fit_label              VARCHAR(60)  NOT NULL,
  price_paise            BIGINT       NOT NULL,
  compare_at_price_paise BIGINT,
  status                 VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
  new_arrival            BOOLEAN      NOT NULL DEFAULT FALSE,
  featured_rank          INTEGER      NOT NULL DEFAULT 1000,
  details                TEXT[]       NOT NULL DEFAULT '{}',
  fit_notes              TEXT[]       NOT NULL DEFAULT '{}',
  care_instructions      TEXT[]       NOT NULL DEFAULT '{}',
  published_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT uq_products_slug UNIQUE (slug),
  CONSTRAINT ck_products_slug CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT ck_products_fit CHECK (fit IN ('OVERSIZED', 'REGULAR')),
  CONSTRAINT ck_products_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  CONSTRAINT ck_products_price CHECK (price_paise > 0),
  CONSTRAINT ck_products_compare_at CHECK (compare_at_price_paise IS NULL OR compare_at_price_paise > price_paise),
  CONSTRAINT ck_products_published_at CHECK (status <> 'PUBLISHED' OR published_at IS NOT NULL)
);

CREATE INDEX ix_products_status_rank ON products (status, featured_rank);
CREATE INDEX ix_products_category ON products (category_id);
CREATE INDEX ix_products_fit ON products (fit);
CREATE INDEX ix_products_price ON products (price_paise);
CREATE INDEX ix_products_published_at ON products (published_at DESC);

-- Many-to-many: products in curated collections.
CREATE TABLE product_collections (
  product_id    BIGINT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  collection_id BIGINT NOT NULL REFERENCES collections (id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, collection_id)
);
CREATE INDEX ix_product_collections_collection ON product_collections (collection_id);

-- ---------------------------------------------------------------------------
-- Colourways (one product, many colours)
-- ---------------------------------------------------------------------------
CREATE TABLE product_colors (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id BIGINT      NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  code       VARCHAR(40) NOT NULL,
  name       VARCHAR(80) NOT NULL,
  hex        VARCHAR(7)  NOT NULL,
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_product_colors_code UNIQUE (product_id, code),
  CONSTRAINT ck_product_colors_hex CHECK (hex ~ '^#[0-9A-Fa-f]{6}$')
);
CREATE INDEX ix_product_colors_product ON product_colors (product_id);
CREATE INDEX ix_product_colors_name ON product_colors (lower(name));

-- ---------------------------------------------------------------------------
-- Images (per colourway, ordered)
-- ---------------------------------------------------------------------------
CREATE TABLE product_images (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id BIGINT       NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  color_id   BIGINT       NOT NULL REFERENCES product_colors (id) ON DELETE CASCADE,
  url        VARCHAR(500) NOT NULL,
  alt_text   VARCHAR(300) NOT NULL,
  sort_order INTEGER      NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT uq_product_images_order UNIQUE (color_id, sort_order)
);
CREATE INDEX ix_product_images_product ON product_images (product_id);

-- ---------------------------------------------------------------------------
-- Variants: one sellable SKU per product × colour × size
-- ---------------------------------------------------------------------------
CREATE TABLE product_variants (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id  BIGINT      NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  color_id    BIGINT      NOT NULL REFERENCES product_colors (id) ON DELETE CASCADE,
  size        VARCHAR(5)  NOT NULL,
  sku         VARCHAR(64) NOT NULL,
  price_paise BIGINT,                -- optional override of the product price
  active      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_product_variants_sku UNIQUE (sku),
  CONSTRAINT uq_product_variants_option UNIQUE (product_id, color_id, size),
  CONSTRAINT ck_product_variants_size CHECK (size IN ('XS', 'S', 'M', 'L', 'XL', 'XXL')),
  CONSTRAINT ck_product_variants_price CHECK (price_paise IS NULL OR price_paise > 0)
);
CREATE INDEX ix_product_variants_product ON product_variants (product_id);
CREATE INDEX ix_product_variants_color ON product_variants (color_id);
CREATE INDEX ix_product_variants_size_active ON product_variants (size) WHERE active;

-- ---------------------------------------------------------------------------
-- Inventory: stock per variant
-- ---------------------------------------------------------------------------
CREATE TABLE inventory (
  variant_id        BIGINT      PRIMARY KEY REFERENCES product_variants (id) ON DELETE CASCADE,
  quantity_on_hand  INTEGER     NOT NULL DEFAULT 0,
  quantity_reserved INTEGER     NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_inventory_on_hand CHECK (quantity_on_hand >= 0),
  CONSTRAINT ck_inventory_reserved CHECK (quantity_reserved >= 0 AND quantity_reserved <= quantity_on_hand)
);

-- Keep updated_at honest for writes made outside the application too.
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_collections_updated_at BEFORE UPDATE ON collections FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_product_colors_updated_at BEFORE UPDATE ON product_colors FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_product_images_updated_at BEFORE UPDATE ON product_images FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_product_variants_updated_at BEFORE UPDATE ON product_variants FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_inventory_updated_at BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION set_updated_at();
