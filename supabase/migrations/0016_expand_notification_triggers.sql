-- ============================================================================
-- CITUHireX — Migration 0016
-- Expands notifications beyond just endorsement decisions:
--   1. Student gets notified on every application status change (replaces
--      the narrower notify_on_endorsement, which only covered the final step)
--   2. Company gets notified when a new application comes in
--   3. Company gets notified when their job posting is approved
-- ============================================================================

drop trigger if exists trg_notify_on_endorsement on endorsements;
drop function if exists notify_on_endorsement();

create or replace function notify_on_application_status_change()
returns trigger
security definer
set search_path = public, pg_temp
as $$
declare
  v_job_title text;
  v_title text;
  v_body text;
begin
  if old.status is distinct from new.status then
    select title into v_job_title from job_postings where id = new.job_posting_id;

    v_title := case new.status
      when 'company_review' then 'Your application is being reviewed'
      when 'coordinator_review' then 'Forwarded to your OJT coordinator'
      when 'endorsed' then 'Your application was approved'
      when 'rejected' then 'Your application was not approved'
      when 'placement_active' then 'Your placement is now active'
      when 'completed' then 'Your placement is complete'
      else 'Your application status changed'
    end;
    v_body := coalesce(v_job_title, 'A job posting') || ' — status updated.';

    insert into notifications (user_id, type, title, body)
    values (new.student_id, 'application_status_change', v_title, v_body);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_notify_on_application_status_change on applications;
create trigger trg_notify_on_application_status_change
  after update on applications
  for each row execute function notify_on_application_status_change();

create or replace function notify_company_on_new_application()
returns trigger
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_job_title text;
  v_student_name text;
begin
  select company_id, title into v_company_id, v_job_title from job_postings where id = new.job_posting_id;
  select full_name into v_student_name from profiles where id = new.student_id;

  insert into notifications (user_id, type, title, body)
  values (
    v_company_id,
    'new_applicant',
    'New applicant received',
    coalesce(v_student_name, 'A student') || ' applied to "' || coalesce(v_job_title, 'your posting') || '".'
  );
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_notify_company_on_new_application on applications;
create trigger trg_notify_company_on_new_application
  after insert on applications
  for each row execute function notify_company_on_new_application();

create or replace function notify_company_on_job_approved()
returns trigger
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status = 'pending_approval' and new.status = 'open' then
    insert into notifications (user_id, type, title, body)
    values (
      new.company_id,
      'job_approved',
      'Job posting approved',
      '"' || new.title || '" is now live and visible to students.'
    );
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_notify_company_on_job_approved on job_postings;
create trigger trg_notify_company_on_job_approved
  after update on job_postings
  for each row execute function notify_company_on_job_approved();

revoke execute on function notify_on_application_status_change() from public, anon, authenticated;
revoke execute on function notify_company_on_new_application() from public, anon, authenticated;
revoke execute on function notify_company_on_job_approved() from public, anon, authenticated;
