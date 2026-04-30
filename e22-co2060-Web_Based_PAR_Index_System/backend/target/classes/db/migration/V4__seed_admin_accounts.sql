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
    '$2b$10$W36T9/PwC/Nv84vZi/DsyuRQOHodoBGL6Y0hiuz3ymzEYqpN0i68S',
    'ADMIN',
    TRUE
  ),
  (
    'Admin E22035',
    'e22035@eng.pdn.ac.lk',
    '$2b$10$wQdCxXf9wZ6zL8nCQQdvEOqAldIUItLv5P.B7dN4K7qo3bFwOC1ji',
    'ADMIN',
    TRUE
  );