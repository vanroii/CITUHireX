-- ============================================================================
-- CITUHireX — Migration 0022
-- Scopes coordinator visibility on job_postings and applications to their
-- assigned_programs. An empty assigned_programs array (the current default)
-- means unrestricted — sees everything, like a general/admin coordinator —
-- so existing coordinator accounts aren't retroactively locked out. Once a
-- coordinator has specific programs assigned, they only see:
--   - job postings that are "open to all CEA" (empty eligible_programs) OR
--     overlap their assigned programs
--   - applications from students whose program is in their assigned programs
-- ============================================================================

create or replace function my_assigned_programs()
returns uuid[]
language sql stable security definer
set search_path = public, pg_temp
as $$
  select assigned_programs from coordinators where profile_id = auth.uid();
$$;

revoke execute on function my_assigned_programs() from public, anon;
grant execute on function my_assigned_programs() to authenticated;

drop policy if exists "jobs: coordinators read & approve all" on job_postings;
create policy "jobs: coordinators read & approve scoped" on job_postings
  for all using (
    my_role() = 'coordinator' and (
      coalesce(array_length(my_assigned_programs(), 1), 0) = 0
      or coalesce(array_length(eligible_programs, 1), 0) = 0
      or eligible_programs && my_assigned_programs()
    )
  );

drop policy if exists "applications: coordinators read & endorse all" on applications;
create policy "applications: coordinators read & endorse scoped" on applications
  for all using (
    my_role() = 'coordinator' and (
      coalesce(array_length(my_assigned_programs(), 1), 0) = 0
      or exists (
        select 1 from students st
        where st.profile_id = applications.student_id
          and st.program_id = any(my_assigned_programs())
      )
    )
  );
