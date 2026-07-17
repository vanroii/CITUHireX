-- ============================================================================
-- CITUHireX — Migration 0025
-- REAL fix for the infinite recursion bug. Migration 0024 added a corrected
-- policy but a second, differently-named duplicate policy
-- ("applications: coordinators scoped by assigned programs") was still live
-- with the old raw subquery into students — Postgres combines ALL permissive
-- policies on a table with OR, so that leftover policy alone was enough to
-- keep triggering the recursion regardless of the fixed one existing
-- alongside it. Dropping the duplicate leaves only the safe, function-based
-- policy from 0024.
-- ============================================================================

drop policy if exists "applications: coordinators scoped by assigned programs" on applications;
;