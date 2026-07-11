-- ============================================================================
-- CITUHireX — Migration 0014
-- Replaces the broad "students manage own applications at any status" policy
-- with granular ones: students can always SELECT their own applications, but
-- can only UPDATE or DELETE (withdraw) them while status = 'submitted'
-- ("Pending" in the UI). Once a company or coordinator has started acting on
-- it, editing must be locked server-side — a client-side-only restriction
-- can be bypassed by calling the API directly.
-- ============================================================================

drop policy if exists "applications: students manage own" on applications;

create policy "applications: students select own" on applications
  for select using (student_id = auth.uid());

create policy "applications: students insert own" on applications
  for insert with check (student_id = auth.uid());

create policy "applications: students update own while pending" on applications
  for update
  using (student_id = auth.uid() and status = 'submitted')
  with check (student_id = auth.uid() and status = 'submitted');

create policy "applications: students withdraw own while pending" on applications
  for delete using (student_id = auth.uid() and status = 'submitted');
