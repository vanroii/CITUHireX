-- ============================================================================
-- CITUHireX — Migration 0023
-- 1. Scopes the students table the same way job_postings/applications were
--    scoped in 0022 — a coordinator with assigned_programs only sees
--    students in those programs; empty assigned_programs stays unrestricted.
-- 2. Adds a real 3-state verification status (pending/verified/denied) for
--    companies, since is_verified was only ever a binary flag with no way
--    to represent "explicitly denied" vs "just hasn't been reviewed yet."
-- ============================================================================

drop policy if exists "students: coordinators read all" on students;
create policy "students: coordinators read scoped" on students
  for select using (
    my_role() = 'coordinator' and (
      coalesce(array_length(my_assigned_programs(), 1), 0) = 0
      or program_id = any(my_assigned_programs())
    )
  );

alter table companies
  add column verification_status text not null default 'pending'
  check (verification_status in ('pending', 'verified', 'denied'));

update companies
set verification_status = case when is_verified then 'verified' else 'pending' end;
