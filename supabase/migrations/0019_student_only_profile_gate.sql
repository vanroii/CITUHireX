-- ============================================================================
-- CITUHireX — Migration 0019
-- Scopes the profile-completion gate to students only. Companies now get
-- profile_completed = true immediately on signup — no forced setup flow,
-- no blocked dashboard access. Existing company rows are corrected too.
-- ============================================================================

update profiles
set profile_completed = true
where role = 'company' and profile_completed = false;

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
  values (
    new.id,
    v_role::user_role,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    v_role <> 'student' -- only students start incomplete
  );

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
