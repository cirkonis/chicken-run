-- Migration: grant the Data API roles access to the public schema.
--
-- Why this is needed: PostgREST / pg_graphql act as the Postgres roles `anon`
-- (logged-out), `authenticated` (signed-in / guests), and `service_role` (our
-- admin client). Those roles need table-level privileges to touch a table at all
-- — Row Level Security then restricts WHICH rows they see. Functions are already
-- executable by everyone (Postgres grants EXECUTE to PUBLIC by default), which is
-- why our RPCs worked even before this; tables are not, so reads/writes failed
-- with "permission denied for table ...".
--
-- Newer Supabase stopped auto-granting these for migration-created tables, so we
-- do it explicitly. This makes the schema reproducible on a fresh project, and is
-- a harmless no-op on prod (which already has equivalent grants). `service_role`
-- additionally bypasses RLS, as intended for server-side admin work.

grant usage on schema public to anon, authenticated, service_role;

-- Existing objects
grant all on all tables in schema public    to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public  to anon, authenticated, service_role;

-- Future objects created by the postgres role (so later migrations are covered)
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines  to anon, authenticated, service_role;
