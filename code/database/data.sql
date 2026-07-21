-- ============================================================
--  PAR Index System — Seed Data
--  Pre-seeded admin accounts (BCrypt cost 10, password: admin)
--
--  Admin 1: e22014@eng.pdn.ac.lk
--  Admin 2: e22035@eng.pdn.ac.lk
--
--  These are the ONLY administrator accounts in the system.
--  The public registration form does not allow ADMIN role selection.
--
--  BUG FIX: changed from a plain INSERT to INSERT IGNORE. The equivalent
--  Flyway migration (V4) already used INSERT IGNORE for the same two rows,
--  but this file used a plain INSERT — re-running it against a database
--  that has already been seeded (e.g. a second `docker compose up` without
--  wiping the MySQL volume) throws a duplicate-key error on the unique
--  email constraint and aborts. INSERT IGNORE makes this file safe to run
--  more than once, consistent with the migration it mirrors.
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
    'Admin E22036',
    'e22036@eng.pdn.ac.lk',
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
