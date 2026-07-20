-- ============================================================================
-- CITUHireX — Migration 0027
-- Real bug fix: the RLS policy letting students read job_postings only
-- allowed status = 'open'. Once a job's slots hit zero and the auto-close
-- trigger flips it to 'closed', students lost SELECT access to that row
-- entirely — including students who had already applied to it, whose
-- My Applications page would then silently show blank job info (RLS blocks
-- the embedded join, PostgREST just returns null instead of erroring).
--
-- Fix: students can also read 'closed' postings. Closed jobs still won't
-- accept new applications (enforced separately, not by visibility), but
-- they stay visible instead of vanishing.
-- ============================================================================

drop policy if exists "jobs: students read open" on job_postings;
create policy "jobs: students read open or closed" on job_postings
  for select using (my_role() = 'student' and status in ('open', 'closed'));
