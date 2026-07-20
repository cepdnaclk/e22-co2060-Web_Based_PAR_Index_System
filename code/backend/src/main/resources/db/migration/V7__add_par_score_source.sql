-- ============================================================
--  PAR Index System — V6: PAR score source tracking
--  Adds par_scores.score_source so the UI/API can distinguish
--  a score that was:
--    MANUAL        — entered component-by-component by the clinician
--    AUTO_LANDMARK — computed geometrically from placed 3D landmarks
--    ML            — taken directly from the ML model's total prediction
--                    (no per-component breakdown available)
--  Uses the same safe conditional-ALTER pattern as V5 — safe to re-run.
-- ============================================================

SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'par_scores'
     AND COLUMN_NAME  = 'score_source') > 0,
  'SELECT 1',
  'ALTER TABLE par_scores ADD COLUMN score_source VARCHAR(20) NOT NULL DEFAULT ''MANUAL'' COMMENT ''MANUAL | AUTO_LANDMARK | ML'' AFTER centreline'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- ROLLBACK SECTION
-- ============================================================
-- ALTER TABLE par_scores DROP COLUMN score_source;
-- ============================================================
