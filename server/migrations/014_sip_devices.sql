-- 014_sip_devices.sql — per-DEVICE Telnyx SIP identities.
--
-- Why: a Telnyx credential connection accepts only ONE active registration at a
-- time. When the same user opened the web app AND the phone app, both registered
-- the single per-user credential (digiringou<uid>) and kicked each other off in a
-- ~2s takeover loop, so inbound calls rang neither reliably. Giving each DEVICE
-- its own credential connection lets every device stay registered at once; the
-- inbound TeXML then <Dial>s all of a user's active device SIP URIs in parallel,
-- so a call rings the phone AND the browser (AND any other signed-in device)
-- simultaneously — first to answer wins.
--
-- The server self-applies this via CREATE TABLE IF NOT EXISTS at first use
-- (Hostinger blocks the shell, so migrations can't be run by hand), but the file
-- is kept for parity with the other migrations and for a fresh DB bootstrap.

CREATE TABLE IF NOT EXISTS sip_devices (
  id                BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id           BIGINT       NOT NULL,
  device_id         VARCHAR(64)  NOT NULL,           -- stable client-generated id
  sip_username      VARCHAR(64)  NOT NULL,           -- digiringou<uid>d<hash>
  sip_credential_id VARCHAR(64)  NOT NULL,           -- Telnyx credential connection id
  platform          VARCHAR(16)  NOT NULL DEFAULT '',-- 'web' | 'android' | 'ios'
  last_seen         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_device (user_id, device_id),
  UNIQUE KEY uq_sip_username (sip_username),
  INDEX idx_sipdev_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
