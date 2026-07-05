-- ============================================================================
-- CITUHireX — Migration 0005
-- Seed: College of Engineering and Architecture program catalog
-- Adjust codes/names/hours to match CIT-U's actual current offerings & OJT
-- hour requirements before going live.
-- ============================================================================

insert into programs (code, name, college, required_ojt_hours) values
  ('BSCPE',  'BS Computer Engineering',            'CEA', 600),
  ('BSCE',   'BS Civil Engineering',                'CEA', 600),
  ('BSEE',   'BS Electrical Engineering',           'CEA', 600),
  ('BSECE',  'BS Electronics Engineering',          'CEA', 600),
  ('BSME',   'BS Mechanical Engineering',           'CEA', 600),
  ('BSIE',   'BS Industrial Engineering',           'CEA', 600),
  ('BSARCH', 'BS Architecture',                     'CEA', 600),
  ('BSCHE',  'BS Chemical Engineering',             'CEA', 600)
on conflict (code) do nothing;
