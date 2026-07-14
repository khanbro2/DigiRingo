-- 010_push_subscriptions.sql — Web Push subscriptions (browser push for incoming
-- calls when the tab is backgrounded). Run once:
--   mysql -h 127.0.0.1 -u <DB_USER> -p <DB_NAME> < server/migrations/010_push_subscriptions.sql

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT       NOT NULL,
  endpoint   VARCHAR(512) NOT NULL,
  p256dh     VARCHAR(191) NOT NULL,
  auth       VARCHAR(191) NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_push_endpoint (endpoint(191)),
  INDEX idx_push_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
