-- Admin foundations: uploaded images (the media library) and a record of every admin change.

-- Images are stored in the database so they survive redeploys on hosts with temporary disks
-- and are backed up with everything else. Served publicly at /media/{public_key}.{ext}.
CREATE TABLE media_assets (
  id             BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_key     VARCHAR(32)  NOT NULL,
  file_name      VARCHAR(160) NOT NULL,
  content_type   VARCHAR(40)  NOT NULL,
  extension      VARCHAR(5)   NOT NULL,
  bytes          BYTEA        NOT NULL,
  size_bytes     INT          NOT NULL,
  width          INT          NOT NULL,
  height         INT          NOT NULL,
  -- Same file uploaded twice is stored once.
  sha256         VARCHAR(64)  NOT NULL,
  alt_text       VARCHAR(300) NOT NULL DEFAULT '',
  uploaded_by    BIGINT       REFERENCES users (id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT uq_media_public_key UNIQUE (public_key),
  CONSTRAINT uq_media_sha256 UNIQUE (sha256),
  CONSTRAINT ck_media_type CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT ck_media_extension CHECK (extension IN ('jpg', 'png', 'webp')),
  CONSTRAINT ck_media_size CHECK (size_bytes > 0 AND size_bytes <= 10485760 AND size_bytes = octet_length(bytes)),
  CONSTRAINT ck_media_dimensions CHECK (width BETWEEN 1 AND 8000 AND height BETWEEN 1 AND 8000)
);

CREATE TRIGGER trg_media_assets_updated_at
  BEFORE UPDATE ON media_assets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX ix_media_created ON media_assets (created_at DESC);

-- Who changed what, when. Rows are only ever added, never edited.
CREATE TABLE admin_audit_log (
  id           BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_id     BIGINT       REFERENCES users (id) ON DELETE SET NULL,
  admin_email  VARCHAR(254) NOT NULL,
  action       VARCHAR(40)  NOT NULL,
  entity_type  VARCHAR(40)  NOT NULL,
  entity_id    VARCHAR(120),
  summary      VARCHAR(500) NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX ix_admin_audit_created ON admin_audit_log (created_at DESC);
