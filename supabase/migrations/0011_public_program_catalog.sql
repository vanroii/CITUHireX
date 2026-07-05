-- ============================================================================
-- CITUHireX — Migration 0011
-- Fixes a real signup-blocking bug: the programs table was only readable by
-- `authenticated` users, but the signup form needs to load the program
-- dropdown *before* the person has an account. Program names aren't
-- sensitive — a public course catalog is fine to expose to anon too.
-- ============================================================================

drop policy if exists "programs: read all authenticated" on programs;

create policy "programs: read all" on programs
  for select using (true);
