-- Everything the website says and shows, editable in the admin panel.

-- One row per section of the site (hero banners, footer, about page...). The admin panel and the
-- server share one schema (SiteContentSchema) that says which fields each section has; the server
-- checks every save against it. Missing sections are filled with the original site content on startup.
CREATE TABLE site_content (
  key         VARCHAR(60)  PRIMARY KEY,
  content     JSONB        NOT NULL,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_by  VARCHAR(254)
);

CREATE TRIGGER trg_site_content_updated_at
  BEFORE UPDATE ON site_content
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Store-wide settings, one row. Shipping and payment rules here are used by checkout itself.
CREATE TABLE store_settings (
  id                           SMALLINT     PRIMARY KEY DEFAULT 1,
  store_name                   VARCHAR(60)  NOT NULL,
  tagline                      VARCHAR(120) NOT NULL,
  support_email                VARCHAR(254) NOT NULL,
  free_shipping_threshold_paise BIGINT      NOT NULL,
  shipping_fee_paise           BIGINT       NOT NULL,
  max_quantity_per_line        INT          NOT NULL,
  max_cart_lines               INT          NOT NULL,
  payment_window_minutes       INT          NOT NULL,
  updated_at                   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT ck_store_settings_single CHECK (id = 1),
  CONSTRAINT ck_store_settings_amounts CHECK (free_shipping_threshold_paise >= 0 AND shipping_fee_paise >= 0),
  CONSTRAINT ck_store_settings_limits CHECK (max_quantity_per_line BETWEEN 1 AND 10 AND max_cart_lines BETWEEN 1 AND 50
                                             AND payment_window_minutes BETWEEN 5 AND 1440),
  CONSTRAINT ck_store_settings_email CHECK (support_email LIKE '%_@_%')
);

CREATE TRIGGER trg_store_settings_updated_at
  BEFORE UPDATE ON store_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO store_settings (store_name, tagline, support_email, free_shipping_threshold_paise, shipping_fee_paise,
                            max_quantity_per_line, max_cart_lines, payment_window_minutes)
VALUES ('CODE76', 'Everyday, redefined.', 'support@code76.example', 299900, 9900, 10, 20, 30);
