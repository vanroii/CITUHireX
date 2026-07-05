-- ============================================================================
-- CITUHireX — Migration 0010
-- Corrects the CEA program catalog to match cit.edu's actual current
-- baccalaureate offerings (migration 0005 had a generic "BS Mechanical
-- Engineering" — CIT-U actually splits it into two tracks — and was
-- missing Mining Engineering and the Manufacturing/Semiconductor diploma).
-- ============================================================================

-- Repoint the old generic BSME row at one specific track instead of deleting it
-- (avoids breaking any student rows that already reference this program_id).
update programs
set code = 'BSME-CS', name = 'BS Mechanical Engineering with Computational Science'
where code = 'BSME';

insert into programs (code, name, college, required_ojt_hours) values
  ('BSME-MT', 'BS Mechanical Engineering with Mechatronics', 'CEA', 600),
  ('BSMinE', 'BS Mining Engineering', 'CEA', 600)
on conflict (code) do nothing;
