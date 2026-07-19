-- DIGIRINGO — per-user call history, so the Calls log + Recents survive refresh.
-- WebRTC calls don't reliably appear in Telnyx CDRs (esp. credential-connection
-- calls), so we persist each finished call ourselves.
--
-- Run once against the production database:
--   mysql -h 127.0.0.1 -u <DB_USER> -p <DB_NAME> < server/migrations/005_calls.sql
--
-- Safe to re-run (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS call_logs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  contact     VARCHAR(64)  NOT NULL,                   -- the other party (E.164 / dialed)
  direction   VARCHAR(16)  NOT NULL DEFAULT 'outgoing', -- outgoing | incoming | missed
  status      VARCHAR(32)  NOT NULL DEFAULT '',         -- e.g. "Call ended" / "Missed call"
  duration    VARCHAR(16)  NOT NULL DEFAULT '',         -- "m:ss" (empty if never connected)
  via_e164    VARCHAR(32)  NOT NULL DEFAULT '',         -- the owned number used
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_calls_user (user_id, id)
);
