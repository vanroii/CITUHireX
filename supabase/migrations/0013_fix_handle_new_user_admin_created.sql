-- ============================================================================
-- CITUHireX — Migration 0013
-- Merges two fixes to handle_new_user() that both needed to land together:
--
-- 1. (Jovan's fix) Admin-created users via the Dashboard — e.g. manually
--    provisioning a coordinator — have no role metadata at all. The
--    previous version raised an exception for anything outside
--    ('student','company'), which rolled back the whole auth.users insert
--    and broke Dashboard user creation with "Database error creating new
--    user." Fixed by returning silently instead of raising — no profile
--    (and therefore no privilege) is ever auto-created for non-self-service
--    roles, so this doesn't reopen the coordinator self-signup gap.
--
-- 2. (0012_profile_completion_gate) New student/company signups still need
--    profiles.profile_completed = false so they're routed to finish their
--    profile before reaching the rest of the site.
-- ============================================================================

create or replace function handle_new_user()
returns trigger
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text := new.raw_user_meta_data->>'role';
begin
  if v_role is null or v_role not in ('student', 'company') then
    return new;
  end if;

  insert into public.profiles (id, role, full_name, email, profile_completed)
  values (new.id, v_role::user_role, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email, false);

  if v_role = 'student' then
    insert into public.students (profile_id, student_number, program_id, year_level)
    values (
      new.id,
      new.raw_user_meta_data->>'student_number',
      (new.raw_user_meta_data->>'program_id')::uuid,
      coalesce((new.raw_user_meta_data->>'year_level')::int, 1)
    );
  elsif v_role = 'company' then
    insert into public.companies (profile_id, company_name, industry, address, contact_person)
    values (
      new.id,
      new.raw_user_meta_data->>'company_name',
      new.raw_user_meta_data->>'industry',
      new.raw_user_meta_data->>'address',
      new.raw_user_meta_data->>'contact_person'
    );
  end if;

  return new;
end;
$$ language plpgsql;
