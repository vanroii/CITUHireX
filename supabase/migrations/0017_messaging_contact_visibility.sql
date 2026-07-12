-- ============================================================================
-- CITUHireX — Migration 0017
-- Extends profiles visibility so messaging can actually be *started*, not
-- just continued. Previously a student/company could only see someone's
-- name after a message already existed between them — a chicken-and-egg
-- problem that made it impossible to send a first message to anyone.
-- Each new rule follows an existing, already-established relationship:
--   - Students can see the company profile for any job they applied to
--   - Students can see the profile of a coordinator who decided on their application
--   - Companies can see the profile of a coordinator who approved their posting
-- (Companies seeing applicant profiles, and coordinators seeing everyone,
-- were already covered by earlier migrations.)
-- ============================================================================

create policy "profiles: students read company profiles for their applications" on profiles
  for select using (
    my_role() = 'student' and exists (
      select 1 from applications a
      join job_postings j on j.id = a.job_posting_id
      where j.company_id = profiles.id and a.student_id = auth.uid()
    )
  );

create policy "profiles: students read coordinators who decided on their applications" on profiles
  for select using (
    my_role() = 'student' and exists (
      select 1 from endorsements e
      join applications a on a.id = e.application_id
      where e.coordinator_id = profiles.id and a.student_id = auth.uid()
    )
  );

create policy "profiles: companies read coordinators who approved their postings" on profiles
  for select using (
    my_role() = 'company' and exists (
      select 1 from job_postings j
      where j.approved_by = profiles.id and j.company_id = auth.uid()
    )
  );
