-- ============================================================================
-- CITUHireX — Migration 0015
-- When a coordinator approves (endorses) an application, deduct one slot
-- from that job posting. If slots hit zero, close the posting automatically
-- so students can no longer see or apply to it. Implemented as a trigger
-- (not client-side JS) so this holds regardless of which page/flow triggers
-- the approval, and can't be bypassed by calling the API directly.
-- ============================================================================

create or replace function deduct_slot_on_approval()
returns trigger
security definer
set search_path = public, pg_temp
as $$
declare
  v_job_id uuid;
  v_remaining int;
begin
  if new.status = 'endorsed' and old.status is distinct from new.status then
    select job_posting_id into v_job_id from applications where id = new.id;

    update job_postings
    set slots_available = greatest(slots_available - 1, 0)
    where id = v_job_id
    returning slots_available into v_remaining;

    if v_remaining <= 0 then
      update job_postings set status = 'closed' where id = v_job_id;
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_deduct_slot_on_approval on applications;
create trigger trg_deduct_slot_on_approval
  after update on applications
  for each row execute function deduct_slot_on_approval();

revoke execute on function deduct_slot_on_approval() from public, anon, authenticated;
