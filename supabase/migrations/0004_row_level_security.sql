-- ============================================================================
-- CITUHireX — Migration 0004
-- Row Level Security: enforces that Students / Companies / Coordinators can
-- only see and modify data appropriate to their role.
-- ============================================================================

-- ---------- Helper: current user's role, without recursive RLS lookups ----------

create or replace function my_role()
returns user_role
language sql stable security definer
as $$
  select role from profiles where id = auth.uid();
$$;

-- ============================================================================
-- PROFILES
-- ============================================================================
alter table profiles enable row level security;

create policy "profiles: read own" on profiles
  for select using (id = auth.uid());

create policy "profiles: coordinators read all" on profiles
  for select using (my_role() = 'coordinator');

create policy "profiles: insert own on signup" on profiles
  for insert with check (id = auth.uid());

create policy "profiles: update own" on profiles
  for update using (id = auth.uid());

-- ============================================================================
-- PROGRAMS (reference data — readable by everyone signed in)
-- ============================================================================
alter table programs enable row level security;

create policy "programs: read all authenticated" on programs
  for select using (auth.role() = 'authenticated');

-- ============================================================================
-- STUDENTS
-- ============================================================================
alter table students enable row level security;

create policy "students: read own" on students
  for select using (profile_id = auth.uid());

create policy "students: update own" on students
  for update using (profile_id = auth.uid());

create policy "students: insert own" on students
  for insert with check (profile_id = auth.uid());

create policy "students: coordinators read all" on students
  for select using (my_role() = 'coordinator');

create policy "students: companies read applicants" on students
  for select using (
    my_role() = 'company' and exists (
      select 1 from applications a
      join job_postings j on j.id = a.job_posting_id
      where a.student_id = students.profile_id
        and j.company_id = auth.uid()
    )
  );

-- ============================================================================
-- COMPANIES
-- ============================================================================
alter table companies enable row level security;

create policy "companies: read own" on companies
  for select using (profile_id = auth.uid());

create policy "companies: update own" on companies
  for update using (profile_id = auth.uid());

create policy "companies: insert own" on companies
  for insert with check (profile_id = auth.uid());

create policy "companies: coordinators manage" on companies
  for all using (my_role() = 'coordinator');

create policy "companies: students read verified" on companies
  for select using (my_role() = 'student' and is_verified = true);

-- ============================================================================
-- COORDINATORS
-- ============================================================================
alter table coordinators enable row level security;

create policy "coordinators: read own" on coordinators
  for select using (profile_id = auth.uid());

create policy "coordinators: read each other" on coordinators
  for select using (my_role() = 'coordinator');

-- ============================================================================
-- JOB POSTINGS
-- ============================================================================
alter table job_postings enable row level security;

create policy "jobs: companies manage own" on job_postings
  for all using (company_id = auth.uid());

create policy "jobs: students read open" on job_postings
  for select using (my_role() = 'student' and status = 'open');

create policy "jobs: coordinators read & approve all" on job_postings
  for all using (my_role() = 'coordinator');

-- ============================================================================
-- APPLICATIONS
-- ============================================================================
alter table applications enable row level security;

create policy "applications: students manage own" on applications
  for all using (student_id = auth.uid());

create policy "applications: companies read for their jobs" on applications
  for select using (
    exists (
      select 1 from job_postings j
      where j.id = applications.job_posting_id and j.company_id = auth.uid()
    )
  );

create policy "applications: companies update status for their jobs" on applications
  for update using (
    exists (
      select 1 from job_postings j
      where j.id = applications.job_posting_id and j.company_id = auth.uid()
    )
  );

create policy "applications: coordinators read & endorse all" on applications
  for all using (my_role() = 'coordinator');

-- ============================================================================
-- ENDORSEMENTS
-- ============================================================================
alter table endorsements enable row level security;

create policy "endorsements: coordinators insert own decisions" on endorsements
  for insert with check (coordinator_id = auth.uid());

create policy "endorsements: coordinators read all" on endorsements
  for select using (my_role() = 'coordinator');

create policy "endorsements: students read own application's endorsements" on endorsements
  for select using (
    exists (
      select 1 from applications a
      where a.id = endorsements.application_id and a.student_id = auth.uid()
    )
  );

create policy "endorsements: companies read own postings' endorsements" on endorsements
  for select using (
    exists (
      select 1 from applications a
      join job_postings j on j.id = a.job_posting_id
      where a.id = endorsements.application_id and j.company_id = auth.uid()
    )
  );

-- ============================================================================
-- OJT HOUR LOGS
-- ============================================================================
alter table ojt_hour_logs enable row level security;

create policy "hour_logs: students read own" on ojt_hour_logs
  for select using (
    exists (
      select 1 from applications a
      where a.id = ojt_hour_logs.application_id and a.student_id = auth.uid()
    )
  );

create policy "hour_logs: companies manage for their placements" on ojt_hour_logs
  for all using (
    exists (
      select 1 from applications a
      join job_postings j on j.id = a.job_posting_id
      where a.id = ojt_hour_logs.application_id and j.company_id = auth.uid()
    )
  );

create policy "hour_logs: coordinators read all" on ojt_hour_logs
  for select using (my_role() = 'coordinator');

-- ============================================================================
-- MESSAGES
-- ============================================================================
alter table messages enable row level security;

create policy "messages: participants read" on messages
  for select using (sender_id = auth.uid() or receiver_id = auth.uid());

create policy "messages: sender inserts" on messages
  for insert with check (sender_id = auth.uid());

create policy "messages: receiver marks read" on messages
  for update using (receiver_id = auth.uid());

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================
alter table notifications enable row level security;

create policy "notifications: read own" on notifications
  for select using (user_id = auth.uid());

create policy "notifications: mark own read" on notifications
  for update using (user_id = auth.uid());

-- Note: notification rows are inserted by SECURITY DEFINER trigger functions
-- (see 0003_messaging_notifications_triggers.sql), which run with the
-- privileges of the function owner and bypass RLS on insert — no separate
-- insert policy is needed for that path.
