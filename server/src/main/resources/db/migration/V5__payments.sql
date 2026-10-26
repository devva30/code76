-- Online payments through Razorpay. Card and UPI details never reach this database:
-- Razorpay handles them and we only keep its reference ids and the amounts.

ALTER TABLE orders ADD COLUMN paid_at TIMESTAMPTZ;
ALTER TABLE orders ADD CONSTRAINT ck_orders_paid CHECK (status NOT IN ('CONFIRMED', 'SHIPPED', 'DELIVERED') OR paid_at IS NOT NULL);

CREATE TABLE payments (
  id                   BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id             BIGINT       NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  provider             VARCHAR(20)  NOT NULL DEFAULT 'RAZORPAY',
  -- Razorpay's "order_…" id, created when the customer clicks Pay.
  provider_order_id    VARCHAR(64)  NOT NULL,
  -- Razorpay's "pay_…" id, known once a payment succeeds.
  provider_payment_id  VARCHAR(64),
  amount_paise         BIGINT       NOT NULL,
  currency             VARCHAR(3)   NOT NULL DEFAULT 'INR',
  status               VARCHAR(20)  NOT NULL DEFAULT 'CREATED',
  -- Reason given by Razorpay for the latest failed attempt, if any.
  failure_reason       VARCHAR(255),
  refund_id            VARCHAR(64),
  paid_at              TIMESTAMPTZ,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT uq_payments_provider_order UNIQUE (provider_order_id),
  CONSTRAINT uq_payments_provider_payment UNIQUE (provider_payment_id),
  CONSTRAINT ck_payments_provider CHECK (provider = 'RAZORPAY'),
  CONSTRAINT ck_payments_amount CHECK (amount_paise > 0),
  CONSTRAINT ck_payments_currency CHECK (currency = 'INR'),
  CONSTRAINT ck_payments_status CHECK (status IN ('CREATED', 'PAID', 'REFUNDED')),
  CONSTRAINT ck_payments_paid CHECK (status = 'CREATED' OR (provider_payment_id IS NOT NULL AND paid_at IS NOT NULL)),
  CONSTRAINT ck_payments_refunded CHECK (status <> 'REFUNDED' OR refund_id IS NOT NULL)
);

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX ix_payments_order ON payments (order_id);

-- Razorpay may deliver the same webhook more than once; each event id is processed only once.
CREATE TABLE payment_webhook_events (
  event_id     VARCHAR(64)  PRIMARY KEY,
  event_type   VARCHAR(60)  NOT NULL,
  received_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
