-- ============================================================
--  PAR Index System — Seed Data
--  Pre-seeded admin accounts (BCrypt cost 10, password: admin)
--
--  Admin 1: e22014@eng.pdn.ac.lk
--  Admin 2: e22035@eng.pdn.ac.lk
--
--  These are the ONLY administrator accounts in the system.
--  The public registration form does not allow ADMIN role selection.
-- ============================================================

INSERT INTO users (name, email, password_hash, role, is_active)
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
