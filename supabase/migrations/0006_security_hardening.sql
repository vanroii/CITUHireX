-- ============================================================================
-- CITUHireX — Migration 0006
-- Security hardening: pin search_path on all functions, and lock down
-- SECURITY DEFINER functions so they can't be invoked directly via the
-- PostgREST /rpc endpoint by anon/authenticated clients.
-- ============================================================================

-- Pin search_path (fixes "Function Search Path Mutable" warnings)
alter function set_updated_at() set search_path = public, pg_temp;
alter function recalc_completed_hours() set search_path = public, pg_temp;
alter function notify_on_endorsement() set search_path = public, pg_temp;
alter function my_role() set search_path = public, pg_temp;

-- Trigger-only functions: never need to be called directly by a client role.
-- Triggers still fire regardless of these grants.
revoke execute on function set_updated_at() from public, anon, authenticated;
revoke execute on function recalc_completed_hours() from public, anon, authenticated;
revoke execute on function notify_on_endorsement() from public, anon, authenticated;

-- my_role() IS needed by `authenticated` because RLS policies call it in the
-- querying session's context — keep that grant, but remove anon's ability to
-- call it directly (anon has no profiles row anyway, but no reason to expose it).
revoke execute on function my_role() from public, anon;
grant execute on function my_role() to authenticated;
