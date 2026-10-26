-- Smaller copies of uploaded photos (for phones and product cards), made on first request and kept.
CREATE TABLE media_variants (
  asset_id      BIGINT       NOT NULL REFERENCES media_assets (id) ON DELETE CASCADE,
  width         INT          NOT NULL,
  content_type  VARCHAR(40)  NOT NULL,
  bytes         BYTEA        NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (asset_id, width),
  CONSTRAINT ck_media_variant_width CHECK (width BETWEEN 16 AND 4000)
);
