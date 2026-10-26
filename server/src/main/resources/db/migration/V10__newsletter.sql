-- People who signed up for the newsletter from the website. One row per address (any letter case).
CREATE TABLE newsletter_subscribers (
  id          BIGSERIAL    PRIMARY KEY,
  email       VARCHAR(254) NOT NULL,
  source      VARCHAR(40)  NOT NULL DEFAULT 'website',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT ck_newsletter_email CHECK (email LIKE '%_@_%')
);

CREATE UNIQUE INDEX ux_newsletter_email ON newsletter_subscribers (lower(email));
CREATE INDEX ix_newsletter_created ON newsletter_subscribers (created_at DESC);
