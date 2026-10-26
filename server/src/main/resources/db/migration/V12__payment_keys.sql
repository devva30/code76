-- Razorpay keys entered in the admin. One row at most; when it's absent the server's
-- environment settings (RAZORPAY_KEY_ID etc.) are used. Secrets are stored encrypted
-- (AES-GCM, key from SETTINGS_ENCRYPTION_KEY), never in plain text.
CREATE TABLE payment_keys (
    id                 SMALLINT     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    key_id             VARCHAR(40)  NOT NULL,
    key_secret_enc     TEXT         NOT NULL,
    webhook_secret_enc TEXT,
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by         VARCHAR(254)
);
