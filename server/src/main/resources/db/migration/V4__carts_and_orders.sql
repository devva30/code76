-- Signed-in customers' bags, and orders.
-- Orders copy ("snapshot") names, prices and the address at the moment of ordering, so later
-- catalogue edits never change what a customer actually ordered.

CREATE TABLE cart_items (
  user_id     BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  variant_id  BIGINT      NOT NULL REFERENCES product_variants (id) ON DELETE CASCADE,
  quantity    INT         NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, variant_id),
  CONSTRAINT ck_cart_items_quantity CHECK (quantity BETWEEN 1 AND 10)
);

CREATE TRIGGER trg_cart_items_updated_at
  BEFORE UPDATE ON cart_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE orders (
  id               BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_number     VARCHAR(20)  NOT NULL,
  user_id          BIGINT       NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  status           VARCHAR(20)  NOT NULL,
  currency         VARCHAR(3)   NOT NULL DEFAULT 'INR',
  subtotal_paise   BIGINT       NOT NULL,
  shipping_paise   BIGINT       NOT NULL,
  total_paise      BIGINT       NOT NULL,
  -- Delivery address, copied from the checkout form.
  ship_name        VARCHAR(80)  NOT NULL,
  ship_phone       VARCHAR(10)  NOT NULL,
  ship_line1       VARCHAR(120) NOT NULL,
  ship_line2       VARCHAR(120),
  ship_city        VARCHAR(60)  NOT NULL,
  ship_state       VARCHAR(60)  NOT NULL,
  ship_pincode     VARCHAR(6)   NOT NULL,
  -- Same key twice (a double-click, a retried request) returns the first order instead of a duplicate.
  idempotency_key  VARCHAR(64)  NOT NULL,
  -- Stock is held until this moment while the order awaits payment.
  expires_at       TIMESTAMPTZ,
  placed_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  closed_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT uq_orders_number UNIQUE (order_number),
  CONSTRAINT uq_orders_idempotency UNIQUE (user_id, idempotency_key),
  CONSTRAINT ck_orders_status CHECK (status IN ('PENDING_PAYMENT', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'EXPIRED')),
  CONSTRAINT ck_orders_currency CHECK (currency = 'INR'),
  CONSTRAINT ck_orders_amounts CHECK (subtotal_paise > 0 AND shipping_paise >= 0 AND total_paise = subtotal_paise + shipping_paise),
  CONSTRAINT ck_orders_pending_expiry CHECK (status <> 'PENDING_PAYMENT' OR expires_at IS NOT NULL),
  CONSTRAINT ck_orders_phone CHECK (ship_phone ~ '^[6-9][0-9]{9}$'),
  CONSTRAINT ck_orders_pincode CHECK (ship_pincode ~ '^[1-9][0-9]{5}$')
);

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX ix_orders_user_placed ON orders (user_id, placed_at DESC);
-- Lets the expiry job find overdue unpaid orders without scanning every order.
CREATE INDEX ix_orders_pending_expiry ON orders (expires_at) WHERE status = 'PENDING_PAYMENT';

CREATE TABLE order_items (
  id                BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id          BIGINT       NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  -- Kept for stock bookkeeping; becomes NULL if the variant is ever deleted, the snapshot remains.
  variant_id        BIGINT       REFERENCES product_variants (id) ON DELETE SET NULL,
  sku               VARCHAR(64)  NOT NULL,
  product_slug      VARCHAR(120) NOT NULL,
  product_name      VARCHAR(160) NOT NULL,
  color_name        VARCHAR(80)  NOT NULL,
  size              VARCHAR(5)   NOT NULL,
  image_url         VARCHAR(500),
  unit_price_paise  BIGINT       NOT NULL,
  quantity          INT          NOT NULL,
  line_total_paise  BIGINT       NOT NULL,
  CONSTRAINT uq_order_items_sku UNIQUE (order_id, sku),
  CONSTRAINT ck_order_items_quantity CHECK (quantity BETWEEN 1 AND 10),
  CONSTRAINT ck_order_items_amounts CHECK (unit_price_paise > 0 AND line_total_paise = unit_price_paise * quantity)
);

CREATE INDEX ix_order_items_order ON order_items (order_id);
CREATE INDEX ix_order_items_variant ON order_items (variant_id);
