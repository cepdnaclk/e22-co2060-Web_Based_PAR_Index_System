-- V6: Remove the manual ground-truth-landmark annotation table.
--
-- The ML pipeline was redesigned: landmark detection is now fully
-- automatic (geometric, computed from the 3D mesh, no training data
-- required) instead of learned from orthodontist-placed ground-truth
-- points. See /ml-service/README.md.
--
-- Note: since this backend runs with spring.flyway.enabled=false and
-- ddl-auto=update, this file is NOT executed automatically — Hibernate
-- will simply leave the (now-unused) training_landmark_points table in
-- place. Run this manually if you want to clean it up, or just ignore
-- it; it's harmless dead weight either way.

DROP TABLE IF EXISTS training_landmark_points;
