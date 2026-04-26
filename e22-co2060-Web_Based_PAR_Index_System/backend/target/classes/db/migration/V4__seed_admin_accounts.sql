-- ============================================================
--  V4: Seed pre-defined administrator accounts
--
--  These are the only ADMIN accounts in the system.
--  Public registration endpoint rejects ADMIN role requests.
--
--  Password for both accounts: admin
--  (BCrypt cost 10 — change after first deployment)
-- ============================================================

INSERT IGNORE INTO users (name, email, password_hash, role, is_active)
VALUES
  (
    'Admin E22014',
    'e22014@eng.pdn.ac.lk',
    '$2b$10$.iYcemmjWRvMtD/kIENYa.2aMLyl4zTPE5oz6NmhLlVDN46slYvjW',
    'ADMIN',
    TRUE
  ),
  (
    'Admin E22035',
    'e22035@eng.pdn.ac.lk',
    '$2b$10$9ltl6NSIMGRTPt2cbn5/q.58icnTQtbrDkx5.0YD0avqGR1TIAk5m',
    'ADMIN',
    TRUE
  );
