-- ============================================================================
-- CITUHireX — Migration 0001
-- Enums, profiles, and role-specific tables (students, companies, coordinators)
-- ============================================================================

-- ---------- ENUMS ----------

create type user_role as enum ('student', 'company', 'coordinator');

create type application_status as enum (
  'submitted',            -- student applied
  'company_review',       -- company reviewing applicant
  'coordinator_review',   -- forwarded to coordinator for endorsement
  'endorsed',             -- coordinator endorsed / approved
  'rejected',             -- rejected at any stage
  'placement_active',     -- student is actively doing OJT
  'completed'             -- OJT hours completed, placement closed
);

create type job_status as enum (
  'pending_approval',  -- company submitted, waiting on coordinator
  'open',               -- approved and visible to students
  'closed',             -- no longer accepting applicants
  'archived'
);

-- ---------- PROGRAMS (CEA course catalog) ----------

create table programs (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,        -- e.g. 'BSCPE', 'BSCE', 'BSARCH'
  name          text not null,               -- e.g. 'BS Computer Engineering'
  college       text not null default 'CEA',
  required_ojt_hours integer not null default 600,
  created_at    timestamptz not null default now()
);

comment on table programs is 'CEA degree programs students can belong to; drives required OJT hours and job matching.';

-- ---------- PROFILES (1:1 with auth.users) ----------

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          user_role not null,
  full_name     text not null,
  email         text not null unique,
  phone         text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table profiles is 'Base identity record for every user; role determines which detail table (students/companies/coordinators) applies.';

-- ---------- STUDENTS ----------

create table students (
  profile_id        uuid primary key references profiles(id) on delete cascade,
  student_number    text not null unique,
  program_id        uuid not null references programs(id),
  year_level        integer not null check (year_level between 1 and 6),
  completed_hours   integer not null default 0,
  resume_url        text,
  skills            text[] default '{}',
  preferred_location text,
  gpa               numeric(3,2),
  created_at        timestamptz not null default now()
);

comment on table students is 'OJT-eligible CEA students. required hours come from programs.required_ojt_hours; completed_hours accumulates from ojt_hour_logs.';

-- ---------- COMPANIES (Partner Companies) ----------

create table companies (
  profile_id        uuid primary key references profiles(id) on delete cascade,
  company_name      text not null,
  industry          text,
  address           text,
  website           text,
  contact_person    text,
  is_verified       boolean not null default false,   -- verified by a coordinator/admin
  verified_by       uuid references profiles(id),
  verified_at       timestamptz,
  created_at        timestamptz not null default now()
);

comment on table companies is 'Partner companies offering OJT slots. is_verified gates whether they can post jobs (coordinator trust layer).';

-- ---------- COORDINATORS ----------

create table coordinators (
  profile_id        uuid primary key references profiles(id) on delete cascade,
  department        text not null,          -- e.g. 'Computer Engineering Department'
  assigned_programs uuid[] default '{}',    -- program ids this coordinator can endorse for
  created_at        timestamptz not null default now()
);

comment on table coordinators is 'OJT Coordinators. assigned_programs scopes which student programs/applications they can review and endorse.';
