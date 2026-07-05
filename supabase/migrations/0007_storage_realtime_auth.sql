-- ============================================================================
-- CITUHireX — Migration 0007
-- Storage bucket for documents, Realtime on messages/notifications, and a
-- student email-domain guard.
-- ============================================================================

-- ---------- STORAGE: private "documents" bucket for resumes / referral letters ----------

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Path convention: documents/{user_id}/{filename} — enforced by the policies below.

create policy "documents: owners manage their own files"
on storage.objects for all
using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "documents: companies read applicant files"
on storage.objects for select
using (
  bucket_id = 'documents'
  and my_role() = 'company'
  and exists (
    select 1 from applications a
    join job_postings j on j.id = a.job_posting_id
    where j.company_id = auth.uid()
      and a.student_id::text = (storage.foldername(name))[1]
  )
);

create policy "documents: coordinators read all"
on storage.objects for select
using (bucket_id = 'documents' and my_role() = 'coordinator');

-- ---------- REALTIME: live chat + live notifications ----------

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;

-- ---------- AUTH GUARD: students must sign up with a cit.edu address ----------
-- Companies and coordinators are exempt (companies use their own domain;
-- coordinators are manually provisioned/verified by an admin).

create or replace function enforce_student_email_domain()
returns trigger
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role = 'student' and new.email !~* '@cit\.edu$' then
    raise exception 'Student accounts must use a cit.edu email address';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_enforce_student_email_domain
  before insert or update on profiles
  for each row execute function enforce_student_email_domain();

revoke execute on function enforce_student_email_domain() from public, anon, authenticated;
