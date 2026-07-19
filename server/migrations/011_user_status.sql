-- 011_user_status.sql — account status so the Control Hub can suspend / reactivate
-- customers. 'active' (default) or 'suspended'. A suspended account cannot sign in.
-- Uses a guarded ADD COLUMN so re-running is safe on servers that already have it.

SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'status');
SET @sql := IF(@has = 0,
  'ALTER TABLE users ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT ''active''',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
