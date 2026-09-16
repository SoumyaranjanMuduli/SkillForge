-- Security hardening for existing SkillForge projects.
-- Apply after migrations 001–005.

-- SECURITY DEFINER functions must never retain PostgreSQL's default PUBLIC
-- execute grant. The two mutation RPCs are invoked only by the server's
-- service-role client; is_admin is the minimal helper needed by RLS policies.
revoke all on function public.handle_new_user() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;
revoke all on function public.start_attempt_atomic(text, uuid, jsonb, numeric) from public, anon, authenticated;
grant execute on function public.start_attempt_atomic(text, uuid, jsonb, numeric) to service_role;
revoke all on function public.save_assessment_atomic(jsonb, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.save_assessment_atomic(jsonb, jsonb, uuid) to service_role;

-- New public-schema objects must be explicitly granted API access. This guards
-- against accidental Data API exposure when future migrations add tables.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public;
