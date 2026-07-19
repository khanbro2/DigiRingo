-- DIGIRINGO — subscriptions (bundle plans + wallet-funded auto-renew).
-- Run once against the production database:
--   mysql -h 127.0.0.1 -u <DB_USER> -p <DB_NAME> < server/migrations/002_subscriptions.sql
--
-- Safe to re-run (IF NOT EXISTS). Does not touch users / wallet_transactions.

CREATE TABLE IF NOT EXISTS subscriptions (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  user_id          INT NOT NULL,
  tier             VARCHAR(32)  NOT NULL,
  cycle            VARCHAR(16)  NOT NULL DEFAULT 'monthly',
  minutes_included INT          NOT NULL DEFAULT 0,
  sms_included     INT          NOT NULL DEFAULT 0,
  minutes_used     INT          NOT NULL DEFAULT 0,
  sms_used         INT          NOT NULL DEFAULT 0,
  status           VARCHAR(16)  NOT NULL DEFAULT 'active',  -- active | past_due | replaced | expired
  period_end       BIGINT       NOT NULL DEFAULT 0,          -- epoch ms
  pay_method       VARCHAR(16)  NOT NULL DEFAULT 'wallet',   -- wallet | card
  auto_renew       TINYINT(1)   NOT NULL DEFAULT 1,
  renew_amount     DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_status (user_id, status)
);
