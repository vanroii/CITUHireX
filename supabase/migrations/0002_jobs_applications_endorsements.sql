-- ============================================================================
-- CITUHireX — Migration 0002
-- Job postings, applications, and the coordinator endorsement trust layer
-- ============================================================================

-- ---------- JOB POSTINGS ----------

create table job_postings (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies(profile_id) on delete cascade,
  title             text not null,
  description       text not null,
  location          text not null,
  is_remote         boolean not null default false,
  required_hours    integer not null,
  slots_available   integer not null default 1,
  eligible_programs uuid[] not null default '{}',   -- references programs.id, empty = open to all CEA
  required_skills   text[] default '{}',
  status            job_status not null default 'pending_approval',
  approved_by       uuid references coordinators(profile_id),
  approved_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table job_postings is 'OJT openings posted by partner companies. Must be approved by a coordinator (status transitions pending_approval -> open) before students can see or apply.';

create index idx_job_postings_company on job_postings(company_id);
create index idx_job_postings_status on job_postings(status);

-- ---------- APPLICATIONS ----------

create table applications (
  id                  uuid primary key default gen_random_uuid(),
  student_id          uuid not null references students(profile_id) on delete cascade,
  job_posting_id      uuid not null references job_postings(id) on delete cascade,
  status              application_status not null default 'submitted',
  resume_url          text,
  referral_letter_url text,
  cover_note          text,
  applied_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (student_id, job_posting_id)
);

comment on table applications is 'A student''s application to a specific job posting. Status moves through company_review -> coordinator_review -> endorsed/rejected -> placement_active -> completed.';

create index idx_applications_student on applications(student_id);
create index idx_applications_job on applications(job_posting_id);
create index idx_applications_status on applications(status);

-- ---------- ENDORSEMENTS (Coordinator trust / audit layer) ----------

create table endorsements (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references applications(id) on delete cascade,
  coordinator_id  uuid not null references coordinators(profile_id),
  decision        text not null check (decision in ('endorsed', 'rejected', 'needs_revision')),
  remarks         text,
  decided_at      timestamptz not null default now()
);

comment on table endorsements is 'Immutable audit trail of every coordinator decision on an application — the institutional trust layer that differentiates CITUHireX from informal channels.';

create index idx_endorsements_application on endorsements(application_id);

-- ---------- OJT HOUR LOGS ----------

create table ojt_hour_logs (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references applications(id) on delete cascade,
  log_date        date not null,
  hours_logged    numeric(4,2) not null check (hours_logged > 0),
  notes           text,
  verified_by     uuid references profiles(id),   -- company supervisor or coordinator
  verified_at     timestamptz,
  created_at      timestamptz not null default now()
);

comment on table ojt_hour_logs is 'Daily/periodic OJT hour entries tied to an active placement; sums roll up into students.completed_hours via trigger.';

create index idx_hour_logs_application on ojt_hour_logs(application_id);
