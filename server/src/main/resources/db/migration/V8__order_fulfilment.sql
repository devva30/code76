-- Fulfilment: shipping details on orders, and a timeline of everything that happened to each order.

ALTER TABLE orders ADD COLUMN shipped_at      TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN delivered_at    TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN courier         VARCHAR(80);
ALTER TABLE orders ADD COLUMN tracking_number VARCHAR(80);
ALTER TABLE orders ADD COLUMN tracking_url    VARCHAR(500);
-- Why the order was cancelled, when the store (not the customer) cancelled it.
ALTER TABLE orders ADD COLUMN cancel_reason   VARCHAR(300);

ALTER TABLE orders ADD CONSTRAINT ck_orders_shipped
  CHECK (status NOT IN ('SHIPPED', 'DELIVERED') OR (shipped_at IS NOT NULL AND courier IS NOT NULL AND tracking_number IS NOT NULL));
ALTER TABLE orders ADD CONSTRAINT ck_orders_delivered CHECK (status <> 'DELIVERED' OR delivered_at IS NOT NULL);
ALTER TABLE orders ADD CONSTRAINT ck_orders_tracking_url CHECK (tracking_url IS NULL OR tracking_url ~ '^https://');

CREATE INDEX ix_orders_status_placed ON orders (status, placed_at DESC);

-- Timeline: placed, paid, shipped, delivered, cancelled, refunded... with who did it.
CREATE TABLE order_events (
  id          BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id    BIGINT       NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  type        VARCHAR(30)  NOT NULL,
  message     VARCHAR(500) NOT NULL,
  -- "customer", "system", "razorpay", or the admin's email.
  actor       VARCHAR(254) NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX ix_order_events_order ON order_events (order_id, id);

-- Give existing orders a starting point on their timeline.
INSERT INTO order_events (order_id, type, message, actor, created_at)
SELECT id, 'PLACED', 'Order placed', 'customer', placed_at FROM orders;
INSERT INTO order_events (order_id, type, message, actor, created_at)
SELECT id, 'PAID', 'Payment received', 'razorpay', paid_at FROM orders WHERE paid_at IS NOT NULL;
