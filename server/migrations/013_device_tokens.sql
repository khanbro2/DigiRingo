-- 013_device_tokens.sql — native (FCM) device push tokens. Separate from the
-- browser Web Push table: these are Firebase Cloud Messaging registration tokens
-- from the Android/iOS Capacitor app, used to alert the app about incoming calls
-- and texts even when it's fully backgrounded/killed.

CREATE TABLE IF NOT EXISTS device_tokens (
  id         BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT       NOT NULL,
  token      VARCHAR(255) NOT NULL,
  platform   VARCHAR(16)  NOT NULL DEFAULT 'android',
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_device_token (token),
  INDEX idx_device_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
