-- Haazir — the browser's database role reads only what the live board subscribes to.
-- /api/realtime-token hands every console user a Supabase JWT with role `authenticated`. With it the holder can call the
-- project's REST API directly (<project>.supabase.co/rest/v1), bypassing every check in our routes. The org-scoped policies
-- from 0003 stop another organisation's rows, but inside their own organisation a doctor could still read:
--   * referrers          doctors' phone numbers and registration numbers (GET /api/referrers is admin-only, and the
--                        doctors list drops phones on purpose)
--   * facility_contacts, portal_snapshots, facilities, facility_capabilities, facility_stats, referral_metrics
--   * family_update call_attempts, whose to_number is the attendant's phone: an identifier (CLAUDE.md rule 1). The API
--     blanks a family call's transcript and recording, but a direct read had no such filter.
-- The browser (components/board/useLiveReferral.ts) subscribes to Realtime changes on call_attempts, referrals and events
-- and calls no REST endpoint. The server reads through DATABASE_URL as the table owner, so none of this changes what it can do.

revoke select on facilities, facility_contacts, facility_capabilities, referrers, portal_snapshots,
  facility_stats, referral_metrics from authenticated;

-- A family call never reaches the browser's role. The board still learns of its progress from the next tick.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'auth' and p.proname = 'jwt'
  ) then
    drop policy if exists org_read on call_attempts;
    create policy org_read on call_attempts for select to authenticated
      using (org_id = nullif(auth.jwt() ->> 'org_id', '')::uuid and purpose <> 'family_update');
  end if;
end $$;
