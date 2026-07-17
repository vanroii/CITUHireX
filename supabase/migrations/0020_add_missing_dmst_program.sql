-- ============================================================================
-- CITUHireX — Migration 0020
-- Data fix: DMST (Diploma in Manufacturing and Semiconductor Technology) was
-- included in migration 0010's seed script but never actually landed in the
-- programs table (only 10 of the intended 11 rows existed). Adding it now.
-- ============================================================================

insert into programs (code, name, college, required_ojt_hours) values
  ('DMST', 'Diploma in Manufacturing and Semiconductor Technology', 'CEA', 600)
on conflict (code) do nothing;
