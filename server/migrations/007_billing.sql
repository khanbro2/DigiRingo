-- DIGIRINGO — card-on-file billing + monthly number renewals.
--
-- 1) billing_profiles: the user's saved Stripe customer + default card (masked
--    details only — the PAN never touches our server; Stripe stores the card).
--    Used to show "VISA •••• 4242" in Wallet & Billing, and to charge renewals
--    off-session when the wallet is short.
-- 2) numbers.renews_at: epoch-ms of the next monthly rental charge for the
--    number (0 = legacy rows, backfilled below).
--
-- Run once against the production database:
--   mysql -h 127.0.0.1 -u <DB_USER> -p <DB_NAME> < server/migrations/007_billing.sql

CREATE TABLE IF NOT EXISTS billing_profiles (
  user_id            INT PRIMARY KEY,
  stripe_customer_id VARCHAR(64)  NOT NULL DEFAULT '',
  payment_method_id  VARCHAR(64)  NOT NULL DEFAULT '',
  brand              VARCHAR(24)  NOT NULL DEFAULT '',
  last4              VARCHAR(4)   NOT NULL DEFAULT '',
  exp_month          TINYINT      NOT NULL DEFAULT 0,
  exp_year           SMALLINT     NOT NULL DEFAULT 0,
  updated_at         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

ALTER TABLE numbers ADD COLUMN renews_at BIGINT NOT NULL DEFAULT 0;

-- Backfill: existing active numbers renew one month after they were created
-- (or one month from now if that's already in the past).
UPDATE numbers
   SET renews_at = GREATEST(
     (UNIX_TIMESTAMP(created_at) + 30*24*3600) * 1000,
     (UNIX_TIMESTAMP() + 7*24*3600) * 1000
   )
 WHERE status = 'active' AND renews_at = 0;
