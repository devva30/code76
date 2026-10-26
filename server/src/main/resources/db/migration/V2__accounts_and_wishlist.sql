-- Customer accounts and their saved wishlist.
-- Passwords are never stored: only a one-way hash (bcrypt, prefixed e.g. "{bcrypt}$2a$10$...").

CREATE TABLE users (
  id             BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email          VARCHAR(254) NOT NULL,
  full_name      VARCHAR(80)  NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  role           VARCHAR(20)  NOT NULL DEFAULT 'CUSTOMER',
  enabled        BOOLEAN      NOT NULL DEFAULT TRUE,
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  -- Emails are stored trimmed and lower-cased, so this also makes them case-insensitively unique.
  CONSTRAINT uq_users_email UNIQUE (email),
  CONSTRAINT ck_users_email_normalised CHECK (email = lower(btrim(email)) AND email LIKE '%_@_%'),
  CONSTRAINT ck_users_full_name CHECK (length(btrim(full_name)) > 0),
  CONSTRAINT ck_users_role CHECK (role IN ('CUSTOMER', 'ADMIN'))
);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE wishlist_items (
  user_id     BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  product_id  BIGINT      NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

CREATE INDEX ix_wishlist_items_product ON wishlist_items (product_id);
