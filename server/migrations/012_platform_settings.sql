-- 012_platform_settings.sql — Control Hub persistent config store. A simple
-- key→value table: JSON config lives under cfg:* keys, encrypted secrets under
-- secret:* keys (AES-256-GCM, see settings-store.mjs). Idempotent.

CREATE TABLE IF NOT EXISTS platform_settings (
  k          VARCHAR(191) NOT NULL PRIMARY KEY,
  v          LONGTEXT     NULL,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
