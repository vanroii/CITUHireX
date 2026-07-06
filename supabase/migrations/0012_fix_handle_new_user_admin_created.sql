-- ============================================================================
-- CITUHireX — Migration 0012
-- Fixes a real bug: handle_new_user() raised an exception for any signup
-- without role metadata in ('student','company'), which also blocked
-- Dashboard-created users (e.g. manually provisioning a coordinator) since
-- those have no metadata at all. An AFTER INSERT trigger exception rolls
-- back the whole auth.users insert, causing "Database error creating new user."
--
-- Fix: skip silently instead of raising. Security is unaffected — no profile
-- (and therefore no privilege) is ever auto-created for anything other than
-- student/company, so this closes the bug without reopening the coordinator
-- self-signup hole. Manual coordinator provisioning (profiles + coordinators
-- insert) still happens as a separate, deliberate step afterward.
-- ============================================================================

create or replace function handle_new_user()
returns trigger
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text := new.raw_user_meta_data->>'role';
begin
  -- Admin-created users (Dashboard, no metadata) and anything that isn't an
  -- expected self-service role just skip auto-provisioning — no error, no
  -- profile row, no access. This is intentionally silent rather than
  -- exception-raising so it never blocks the underlying auth.users insert.
  if v_role is null or v_role not in ('student', 'company') then
    return new;
  end if;

  insert into public.profiles (id, role, full_name, email)
  values (new.id, v_role::user_role, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email);

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
exception
  when others then
    raise;
end;
$$ language plpgsql;
