-- DIGIRINGO — email verification on signup.
-- Run once against the production database:
--   mysql -h 127.0.0.1 -u <DB_USER> -p <DB_NAME> < server/migrations/003_email_verification.sql
--
-- Adds verification columns to users. Existing accounts (created before this
-- feature) are grandfathered as verified so nobody is locked out.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified    TINYINT(1)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verify_token_hash VARCHAR(64) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS verify_expires    BIGINT      NOT NULL DEFAULT 0;

-- Grandfather everyone who already exists (they never got a verification link).
UPDATE users SET email_verified = 1 WHERE email_verified = 0 AND verify_token_hash = '';
