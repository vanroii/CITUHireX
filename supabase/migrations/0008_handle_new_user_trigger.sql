-- ============================================================================
-- CITUHireX — Migration 0008
-- Auto-create profiles (+ role detail row) from auth.users metadata on signup.
-- This sidesteps the RLS timing problem where a freshly-signed-up client has
-- no active session yet (email confirmation pending) and so can't insert
-- into profiles itself. SECURITY DEFINER lets this run regardless of session
-- state, but it strictly rejects 'coordinator' — that role stays admin-only.
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
    raise exception 'Self-service signup only supports student or company roles';
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
end;
$$ language plpgsql;

drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function handle_new_user();

revoke execute on function handle_new_user() from public, anon, authenticated;
