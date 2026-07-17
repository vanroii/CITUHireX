-- ============================================================================
-- CITUHireX — Migration 0024
-- CRITICAL FIX: migration 0022 introduced a circular RLS dependency that
-- broke logins for everyone, not just coordinators.
--
-- The cycle: applications' coordinator-scoped policy queries students ->
-- students has a policy (since 0004) that queries applications (so companies
-- can see their applicants) -> back to applications. Postgres detects this
-- as "infinite recursion detected in policy for relation applications" while
-- PLANNING the query, before it even knows which role is asking — so it
-- broke profiles reads too (profiles has a policy that queries applications
-- for the same reason), which is why a plain login attempt failed.
--
-- Fix: replace the raw correlated subquery into students with a call to a
-- SECURITY DEFINER function. SECURITY DEFINER bypasses RLS entirely on the
-- table it queries, so resolving applications' policy no longer needs to
-- evaluate students' policies at all — breaking the cycle.
-- ============================================================================

create or replace function student_program_id(p_student_id uuid)
returns uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select program_id from students where profile_id = p_student_id;
$$;

revoke execute on function student_program_id(uuid) from public, anon;
grant execute on function student_program_id(uuid) to authenticated;

drop policy if exists "applications: coordinators read & endorse scoped" on applications;
create policy "applications: coordinators read & endorse scoped" on applications
  for all using (
    my_role() = 'coordinator' and (
      coalesce(array_length(my_assigned_programs(), 1), 0) = 0
      or student_program_id(applications.student_id) = any(my_assigned_programs())
    )
  );
