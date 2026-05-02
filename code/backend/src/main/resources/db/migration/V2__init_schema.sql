-- PAR Index System Schema
-- V2: Correct table order to satisfy FK dependencies

CREATE TABLE IF NOT EXISTS users (
    id            BIGINT       AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(120) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('DENTIST','ORTHODONTIST','UNDERGRADUATE','ADMIN') NOT NULL DEFAULT 'DENTIST',
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patients (
    id           BIGINT       AUTO_INCREMENT PRIMARY KEY,
    reference_id VARCHAR(50)  NOT NULL UNIQUE,
    name         VARCHAR(120) NOT NULL,
    date_of_birth DATE,
    contact      VARCHAR(100),
    is_archived  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_by   BIGINT       NOT NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_patient_user FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS ortho_cases (
    id                  BIGINT       AUTO_INCREMENT PRIMARY KEY,
    patient_id          BIGINT       NOT NULL,
    created_by          BIGINT       NOT NULL,
    stage               ENUM('PRE','POST') NOT NULL,
    is_finalized        BOOLEAN      NOT NULL DEFAULT FALSE,
    notes               TEXT,
    ml_predicted_score  FLOAT        NULL,
    created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_case_patient FOREIGN KEY (patient_id) REFERENCES patients(id),
    CONSTRAINT fk_case_user    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS par_scores (
    id               BIGINT  AUTO_INCREMENT PRIMARY KEY,
    case_id          BIGINT  NOT NULL UNIQUE,
    upper_anterior   INT     NOT NULL DEFAULT 0,
    lower_anterior   INT     NOT NULL DEFAULT 0,
    buccal_left      INT     NOT NULL DEFAULT 0,
    buccal_right     INT     NOT NULL DEFAULT 0,
    overjet          INT     NOT NULL DEFAULT 0,
    overbite         INT     NOT NULL DEFAULT 0,
    centreline       INT     NOT NULL DEFAULT 0,
    total_weighted   INT     NOT NULL DEFAULT 0,
    classification   VARCHAR(50),
    calculated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_score_case FOREIGN KEY (case_id) REFERENCES ortho_cases(id)
);

-- training_sets must come BEFORE model3d_files (FK dependency)
CREATE TABLE IF NOT EXISTS training_sets (
    id                   BIGINT        AUTO_INCREMENT PRIMARY KEY,
    submitted_by         BIGINT        NOT NULL,
    anonymised_label     VARCHAR(200)  NOT NULL,
    ground_truth_par     INT           NOT NULL,
    source_description   TEXT,
    status               ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
    reviewer_id          BIGINT        NULL,
    reviewer_comment     TEXT,
    reviewed_at          DATETIME      NULL,
    ml_dataset_version   VARCHAR(50)   NULL,
    submitted_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_training_user     FOREIGN KEY (submitted_by) REFERENCES users(id),
    CONSTRAINT fk_training_reviewer FOREIGN KEY (reviewer_id)  REFERENCES users(id)
);

-- model3d_files comes AFTER both ortho_cases and training_sets
CREATE TABLE IF NOT EXISTS model3d_files (
    id              BIGINT        AUTO_INCREMENT PRIMARY KEY,
    case_id         BIGINT        NULL,
    training_set_id BIGINT        NULL,
    slot            ENUM('UPPER','LOWER','BUCCAL') NOT NULL,
    file_name       VARCHAR(255)  NOT NULL,
    mime_type       VARCHAR(100)  NOT NULL,
    file_size_mb    DECIMAL(8,2)  NOT NULL,
    storage_path    VARCHAR(500)  NOT NULL,
    uploaded_by     BIGINT        NOT NULL,
    uploaded_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_model_case     FOREIGN KEY (case_id)         REFERENCES ortho_cases(id),
    CONSTRAINT fk_model_training FOREIGN KEY (training_set_id) REFERENCES training_sets(id),
    CONSTRAINT fk_model_user     FOREIGN KEY (uploaded_by)     REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id           BIGINT        AUTO_INCREMENT PRIMARY KEY,
    performed_by BIGINT        NOT NULL,
    action       VARCHAR(100)  NOT NULL,
    entity_type  VARCHAR(60)   NOT NULL,
    entity_id    BIGINT,
    detail       TEXT,
    performed_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_user FOREIGN KEY (performed_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_patients_created_by ON patients(created_by);
CREATE INDEX IF NOT EXISTS idx_cases_patient        ON ortho_cases(patient_id);
CREATE INDEX IF NOT EXISTS idx_cases_user           ON ortho_cases(created_by);
CREATE INDEX IF NOT EXISTS idx_model_case           ON model3d_files(case_id);
CREATE INDEX IF NOT EXISTS idx_model_training       ON model3d_files(training_set_id);
CREATE INDEX IF NOT EXISTS idx_training_status      ON training_sets(status);
CREATE INDEX IF NOT EXISTS idx_audit_user           ON audit_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_entity         ON audit_logs(entity_type, entity_id);
