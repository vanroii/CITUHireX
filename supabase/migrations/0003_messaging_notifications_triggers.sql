-- ============================================================================
-- CITUHireX — Migration 0003
-- Messaging, notifications, and supporting triggers
-- ============================================================================

-- ---------- MESSAGES (Supabase Realtime powers live chat on top of this table) ----------

create table messages (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid references applications(id) on delete cascade,  -- optional context thread
  sender_id       uuid not null references profiles(id) on delete cascade,
  receiver_id     uuid not null references profiles(id) on delete cascade,
  body            text not null,
  sent_at         timestamptz not null default now(),
  read_at         timestamptz
);

comment on table messages is 'Direct messages between students, companies, and coordinators. Subscribe via Supabase Realtime on this table for live chat instead of custom polling.';

create index idx_messages_sender on messages(sender_id);
create index idx_messages_receiver on messages(receiver_id);
create index idx_messages_application on messages(application_id);

-- ---------- NOTIFICATIONS ----------

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  type        text not null,   -- e.g. 'application_status_change', 'new_message', 'job_approved'
  title       text not null,
  body        text,
  link_url    text,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

comment on table notifications is 'In-app notification feed. Insert rows via triggers or edge functions on relevant events (status changes, endorsements, new applicants).';

create index idx_notifications_user on notifications(user_id);
create index idx_notifications_unread on notifications(user_id) where is_read = false;

-- ---------- TRIGGERS: updated_at maintenance ----------

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

create trigger trg_job_postings_updated_at before update on job_postings
  for each row execute function set_updated_at();

create trigger trg_applications_updated_at before update on applications
  for each row execute function set_updated_at();

-- ---------- TRIGGER: roll up ojt_hour_logs into students.completed_hours ----------

create or replace function recalc_completed_hours()
returns trigger
security definer
as $$
declare
  v_student_id uuid;
  v_total numeric;
begin
  select a.student_id into v_student_id
  from applications a
  where a.id = coalesce(new.application_id, old.application_id);

  select coalesce(sum(h.hours_logged), 0) into v_total
  from ojt_hour_logs h
  join applications a on a.id = h.application_id
  where a.student_id = v_student_id;

  update students set completed_hours = v_total where profile_id = v_student_id;
  return null;
end;
$$ language plpgsql;

create trigger trg_hour_logs_after_change
  after insert or update or delete on ojt_hour_logs
  for each row execute function recalc_completed_hours();

-- ---------- TRIGGER: auto-create a notification when an endorsement decision is made ----------

create or replace function notify_on_endorsement()
returns trigger
security definer
as $$
declare
  v_student_profile uuid;
begin
  select student_id into v_student_profile from applications where id = new.application_id;

  insert into notifications (user_id, type, title, body)
  values (
    v_student_profile,
    'application_status_change',
    case new.decision
      when 'endorsed' then 'Your application was endorsed'
      when 'rejected' then 'Your application was not endorsed'
      else 'Your application needs revision'
    end,
    coalesce(new.remarks, '')
  );
  return new;
end;
$$ language plpgsql;

create trigger trg_notify_on_endorsement
  after insert on endorsements
  for each row execute function notify_on_endorsement();
