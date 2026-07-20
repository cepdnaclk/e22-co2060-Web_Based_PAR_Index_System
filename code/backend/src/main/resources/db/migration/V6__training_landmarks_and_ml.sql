-- V5: ML landmark-prediction support
--
-- 1. training_landmark_points: ground-truth landmarks attached to an
--    APPROVED training_set by the reviewing orthodontist. These (mesh,
--    landmarks) pairs are the ONLY data the ML template model is built
--    from. Rows are only meaningful once the parent training_sets.status
--    = 'APPROVED' — the ML training job filters on that at read time.
--
-- 2. landmark_points.source: distinguishes clinician-placed points from
--    ML-predicted (unconfirmed) points so a predicted-but-not-reviewed
--    landmark can never silently feed into a finalised PAR score.
--
-- 3. training_sets.ml_dataset_version is already reserved from V2; this
--    migration adds the model-side companion table that records which
--    template version was produced from which snapshot of approved data.

CREATE TABLE IF NOT EXISTS training_landmark_points (
    id                BIGINT       AUTO_INCREMENT PRIMARY KEY,
    training_set_id   BIGINT       NOT NULL,
    slot              ENUM('UPPER','LOWER','BUCCAL') NOT NULL,
    point_name        VARCHAR(50)  NOT NULL,
    x                 DOUBLE       NOT NULL,
    y                 DOUBLE       NOT NULL,
    z                 DOUBLE       NOT NULL,
    created_by        BIGINT       NOT NULL,
    created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_train_landmark_set  FOREIGN KEY (training_set_id) REFERENCES training_sets(id) ON DELETE CASCADE,
    CONSTRAINT fk_train_landmark_user FOREIGN KEY (created_by)      REFERENCES users(id)
);

CREATE INDEX idx_train_landmark_set      ON training_landmark_points(training_set_id);
CREATE INDEX idx_train_landmark_set_slot ON training_landmark_points(training_set_id, slot);

-- Track provenance of clinical landmarks: manual (clinician) vs ml (predicted).
ALTER TABLE landmark_points
    ADD COLUMN source ENUM('MANUAL','ML_PREDICTED') NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN confirmed BOOLEAN NOT NULL DEFAULT TRUE;
-- confirmed=TRUE for MANUAL by default (clinician placement is inherently confirmed).
-- ML_PREDICTED rows are inserted with confirmed=FALSE and must be reviewed
-- (edited/accepted) by a clinician before auto-calculate is considered final.

CREATE TABLE IF NOT EXISTS ml_model_versions (
    id                  BIGINT        AUTO_INCREMENT PRIMARY KEY,
    version_label       VARCHAR(50)   NOT NULL UNIQUE,
    trained_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    training_set_count  INT           NOT NULL,
    method              VARCHAR(100)  NOT NULL DEFAULT 'ICP_TEMPLATE_MATCHING',
    notes               TEXT,
    is_active           BOOLEAN       NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_ml_model_active ON ml_model_versions(is_active);
