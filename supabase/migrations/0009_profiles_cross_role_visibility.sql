-- ============================================================================
-- CITUHireX — Migration 0009
-- Fixes a real gap: profiles RLS only allowed reading your own row (or, for
-- coordinators, everyone's). That blocked companies from seeing an
-- applicant's name, and blocked message threads from showing who sent what.
-- ============================================================================

-- Companies can read the profile of any student who applied to one of their postings.
create policy "profiles: companies read applicant profiles" on profiles
  for select using (
    my_role() = 'company' and exists (
      select 1 from applications a
      join job_postings j on j.id = a.job_posting_id
      where a.student_id = profiles.id and j.company_id = auth.uid()
    )
  );

-- Anyone can read the profile of someone they've exchanged a message with —
-- scoped strictly to existing conversations, not an open directory.
create policy "profiles: messaging partners" on profiles
  for select using (
    exists (
      select 1 from messages m
      where (m.sender_id = auth.uid() and m.receiver_id = profiles.id)
         or (m.receiver_id = auth.uid() and m.sender_id = profiles.id)
    )
  );
