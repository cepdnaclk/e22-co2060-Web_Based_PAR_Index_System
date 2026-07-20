-- ============================================================
--  PAR Index System — V5: ML Metrics + Safety Columns
--  Run manually (Flyway disabled in accepted system).
--  All ALTER statements use safe conditional pattern —
--  safe to re-run if columns/tables already exist.
-- ============================================================

-- ── 1. ml_metrics table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ml_metrics (
    id            BIGINT       AUTO_INCREMENT PRIMARY KEY,
    model_version VARCHAR(50)  NOT NULL,
    accuracy      DOUBLE       NOT NULL DEFAULT 0.0,
    val_accuracy  DOUBLE,
    loss          DOUBLE       NOT NULL DEFAULT 0.0,
    val_loss      DOUBLE,
    epoch_number  INT          NOT NULL,
    dataset_size  INT,
    status        VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                  COMMENT 'PENDING | TRAINING | COMPLETED | FAILED',
    submitted_by  BIGINT       NOT NULL,
    trained_at    DATETIME     NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ml_metrics_user FOREIGN KEY (submitted_by) REFERENCES users(id)
);

CREATE INDEX idx_ml_metrics_status   ON ml_metrics(status);
CREATE INDEX idx_ml_metrics_user     ON ml_metrics(submitted_by);
CREATE INDEX idx_ml_metrics_version  ON ml_metrics(model_version);

-- ── 2. ortho_cases: ml_confidence_note ───────────────────────────────────
SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'ortho_cases'
     AND COLUMN_NAME  = 'ml_confidence_note') > 0,
  'SELECT 1',
  'ALTER TABLE ortho_cases ADD COLUMN ml_confidence_note VARCHAR(500) NULL AFTER ml_predicted_score'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── 3. ortho_cases: version (optimistic locking — REQUIREMENT 7) ─────────
SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'ortho_cases'
     AND COLUMN_NAME  = 'version') > 0,
  'SELECT 1',
  'ALTER TABLE ortho_cases ADD COLUMN version INT NOT NULL DEFAULT 0'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── 4. ortho_cases: pre_case_id (PRE/POST pairing — REQUIREMENT 2) ───────
SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'ortho_cases'
     AND COLUMN_NAME  = 'pre_case_id') > 0,
  'SELECT 1',
  'ALTER TABLE ortho_cases ADD COLUMN pre_case_id BIGINT NULL'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add FK for pre_case_id (safe: only add if not exists)
SET @constraint_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA    = DATABASE()
    AND TABLE_NAME      = 'ortho_cases'
    AND CONSTRAINT_NAME = 'fk_pre_case'
);
SET @s = IF(@constraint_exists > 0,
  'SELECT 1',
  'ALTER TABLE ortho_cases ADD CONSTRAINT fk_pre_case FOREIGN KEY (pre_case_id) REFERENCES ortho_cases(id)'
);
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── 5. ortho_cases: finalized_by (REQUIREMENT 3) ─────────────────────────
SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'ortho_cases'
     AND COLUMN_NAME  = 'finalized_by') > 0,
  'SELECT 1',
  'ALTER TABLE ortho_cases ADD COLUMN finalized_by BIGINT NULL'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @constraint_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA    = DATABASE()
    AND TABLE_NAME      = 'ortho_cases'
    AND CONSTRAINT_NAME = 'fk_finalized_by'
);
SET @s = IF(@constraint_exists > 0,
  'SELECT 1',
  'ALTER TABLE ortho_cases ADD CONSTRAINT fk_finalized_by FOREIGN KEY (finalized_by) REFERENCES users(id)'
);
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── 6. ortho_cases: finalized_at (REQUIREMENT 3) ─────────────────────────
SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'ortho_cases'
     AND COLUMN_NAME  = 'finalized_at') > 0,
  'SELECT 1',
  'ALTER TABLE ortho_cases ADD COLUMN finalized_at DATETIME NULL'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── 7. model3d_files: file_checksum (REQUIREMENT 8) ──────────────────────
SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'model3d_files'
     AND COLUMN_NAME  = 'file_checksum') > 0,
  'SELECT 1',
  'ALTER TABLE model3d_files ADD COLUMN file_checksum VARCHAR(32) NULL COMMENT ''MD5 checksum for integrity verification'''
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── 8. Indexes ────────────────────────────────────────────────────────────
-- pre_case_id lookup index
SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'ortho_cases'
     AND INDEX_NAME   = 'idx_cases_pre_case') > 0,
  'SELECT 1',
  'CREATE INDEX idx_cases_pre_case ON ortho_cases(pre_case_id)'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── 9. audit_logs: ensure performed_at is indexed for date-range queries ──
SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'audit_logs'
     AND INDEX_NAME   = 'idx_audit_performed_at') > 0,
  'SELECT 1',
  'CREATE INDEX idx_audit_performed_at ON audit_logs(performed_at)'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- ROLLBACK SECTION
-- To undo all changes from this migration, run the SQL below.
-- Execute in REVERSE order of the additions above.
-- ============================================================
-- -- 9. Drop audit performed_at index
-- DROP INDEX idx_audit_performed_at ON audit_logs;
--
-- -- 8. Drop pre_case index
-- DROP INDEX idx_cases_pre_case ON ortho_cases;
--
-- -- 7. Drop file_checksum
-- ALTER TABLE model3d_files DROP COLUMN file_checksum;
--
-- -- 6. Drop finalized_at
-- ALTER TABLE ortho_cases DROP COLUMN finalized_at;
--
-- -- 5. Drop finalized_by FK + column
-- ALTER TABLE ortho_cases DROP FOREIGN KEY fk_finalized_by;
-- ALTER TABLE ortho_cases DROP COLUMN finalized_by;
--
-- -- 4. Drop pre_case_id FK + column
-- ALTER TABLE ortho_cases DROP FOREIGN KEY fk_pre_case;
-- ALTER TABLE ortho_cases DROP COLUMN pre_case_id;
--
-- -- 3. Drop version
-- ALTER TABLE ortho_cases DROP COLUMN version;
--
-- -- 2. Drop ml_confidence_note
-- ALTER TABLE ortho_cases DROP COLUMN ml_confidence_note;
--
-- -- 1. Drop ml_metrics table
-- DROP TABLE IF EXISTS ml_metrics;
-- ============================================================
