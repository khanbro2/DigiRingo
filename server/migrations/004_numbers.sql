-- DIGIRINGO — owned numbers (per-user), so plan number-capacity can be enforced.
-- Each bundle includes 1 FREE number and allows a capped number of extra numbers
-- (billed at the flat rental) that share the plan's minute/SMS pool.
--
-- Run once against the production database:
--   mysql -h 127.0.0.1 -u <DB_USER> -p <DB_NAME> < server/migrations/004_numbers.sql
--
-- Safe to re-run (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS numbers (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL,
  e164            VARCHAR(32)  NOT NULL,
  kind            VARCHAR(16)  NOT NULL DEFAULT 'local',   -- local | tollfree
  telnyx_id       VARCHAR(64)  NOT NULL DEFAULT '',
  free            TINYINT(1)   NOT NULL DEFAULT 0,          -- 1 = included free with the plan
  status          VARCHAR(16)  NOT NULL DEFAULT 'active',   -- active | released
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_e164 (e164),
  INDEX idx_numbers_user (user_id, status)
);
