-- Haazir — close the database to Supabase's public roles.
-- Supabase serves every table, view and function in `public` through its REST API (<project>.supabase.co/rest/v1),
-- and the anon key that unlocks it ships in the browser bundle. Before this migration that key could read
-- `organisations`, `haazir_migrations` and both views (cross-organisation), insert or rename organisations, delete
-- the migration log and call next_referral_code(). tests/security.test.ts reproduces Supabase's roles and grants.
--
-- The server reads and writes through DATABASE_URL as the table owner, so none of this changes what it can do.
-- The browser needs only SELECT, as `authenticated` (the short-lived token from /api/realtime-token), on the rows
-- the org-scoped policies from 0003 allow.

-- 1. Tables that had no row level security. No policies: server-only.
alter table organisations enable row level security;
do $$
begin
  if to_regclass('public.haazir_migrations') is not null then
    execute 'alter table haazir_migrations enable row level security';
  end if;
end $$;

-- 2. Views run with their owner's rights, which skip row level security. Make them use the caller's.
alter view facility_stats set (security_invoker = true);
alter view referral_metrics set (security_invoker = true);

-- 3. Least privilege, so a table or function added later without row level security isn't exposed either.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

-- Reference data, readable before sign-in (policy console_read from 0001).
grant select on capabilities, case_templates to anon, authenticated;
-- The live board's Realtime subscription and the org-scoped reads (policies org_read from 0003).
grant select on facilities, facility_contacts, facility_capabilities, referrers, referrals, call_attempts, events,
  portal_snapshots, facility_stats, referral_metrics to authenticated;
