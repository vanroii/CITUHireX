-- ============================================================================
-- CITUHireX — Migration 0026
-- 1. Adds 'declined' as a distinct job_postings status — a coordinator
--    actively rejecting a posting is a different fact than it being
--    'archived' (which implies it was once live and is now retired).
-- 2. Adds 'terminated' to companies.verification_status — ending an
--    already-verified partnership is a different fact than 'denied' (which
--    implies it was never approved in the first place).
-- ============================================================================

alter type job_status add value 'declined';

alter table companies drop constraint companies_verification_status_check;
alter table companies add constraint companies_verification_status_check
  check (verification_status in ('pending', 'verified', 'denied', 'terminated'));
