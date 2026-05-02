-- V3: Landmark points for 3D-based automatic PAR calculation
-- Each row stores one named 3D landmark placed by a clinician on a dental model.

CREATE TABLE IF NOT EXISTS landmark_points (
    id          BIGINT       AUTO_INCREMENT PRIMARY KEY,
    case_id     BIGINT       NOT NULL,
    slot        ENUM('UPPER','LOWER','BUCCAL') NOT NULL,
    point_name  VARCHAR(50)  NOT NULL,
    x           DOUBLE       NOT NULL,
    y           DOUBLE       NOT NULL,
    z           DOUBLE       NOT NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_landmark_case FOREIGN KEY (case_id) REFERENCES ortho_cases(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_landmark_case      ON landmark_points(case_id);
CREATE INDEX IF NOT EXISTS idx_landmark_case_slot ON landmark_points(case_id, slot);
