-- Haazir — organisations, console users, org-scoped access, and data for reliability and stretch features.
-- Existing rows (the demo directory) land in the default "Demo organisation".

-- ============================================================
-- Organisations and console users
-- ============================================================

create table organisations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);
insert into organisations (id, name) values ('00000000-0000-4000-8000-000000000001', 'Demo organisation')
on conflict (id) do nothing;

-- Console sign-in (AUTH_MODE=users). Server-only: RLS on, no policy.
create table app_users (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organisations(id) on delete cascade,
  email          text not null unique check (email = lower(email)),
  name           text not null,
  password_hash  text not null,
  role           text not null default 'doctor' check (role in ('admin', 'doctor')),
  referrer_id    uuid references referrers(id) on delete set null,
  active         boolean not null default true,
  last_login_at  timestamptz,
  created_at     timestamptz not null default now()
);
alter table app_users enable row level security;

-- ============================================================
-- org_id everywhere the console reads. Children inherit it from their parent on insert.
-- ============================================================

alter table facilities            add column org_id uuid not null default '00000000-0000-4000-8000-000000000001' references organisations(id);
alter table facility_contacts     add column org_id uuid not null default '00000000-0000-4000-8000-000000000001' references organisations(id);
alter table facility_capabilities add column org_id uuid not null default '00000000-0000-4000-8000-000000000001' references organisations(id);
alter table referrers             add column org_id uuid not null default '00000000-0000-4000-8000-000000000001' references organisations(id);
alter table referrals             add column org_id uuid not null default '00000000-0000-4000-8000-000000000001' references organisations(id);
alter table call_attempts         add column org_id uuid not null default '00000000-0000-4000-8000-000000000001' references organisations(id);
alter table events                add column org_id uuid not null default '00000000-0000-4000-8000-000000000001' references organisations(id);

create index facilities_org_idx on facilities (org_id);
create index referrals_org_created_idx on referrals (org_id, created_at desc);

create or replace function inherit_org_from_facility() returns trigger
language plpgsql as $$
begin
  select org_id into new.org_id from facilities where id = new.facility_id;
  return new;
end $$;

create or replace function inherit_org_from_referrer() returns trigger
language plpgsql as $$
begin
  select org_id into new.org_id from referrers where id = new.referrer_id;
  return new;
end $$;

create or replace function inherit_org_from_referral() returns trigger
language plpgsql as $$
begin
  select org_id into new.org_id from referrals where id = new.referral_id;
  return new;
end $$;

create trigger facility_contacts_org     before insert on facility_contacts     for each row execute function inherit_org_from_facility();
create trigger facility_capabilities_org before insert on facility_capabilities for each row execute function inherit_org_from_facility();
create trigger referrals_org             before insert on referrals             for each row execute function inherit_org_from_referrer();
create trigger call_attempts_org         before insert on call_attempts         for each row execute function inherit_org_from_referral();
create trigger events_org                before insert on events                for each row execute function inherit_org_from_referral();

-- ============================================================
-- Reliability and stretch features
-- ============================================================

-- Missed-webhook recovery: when we last asked Bolna for this execution's status.
alter table call_attempts add column last_polled_at timestamptz;

-- Answers can also arrive as a WhatsApp quick reply (C6).
alter table call_attempts drop constraint if exists call_attempts_outcome_source_check;
alter table call_attempts add constraint call_attempts_outcome_source_check
  check (outcome_source in ('function', 'extraction', 'manual', 'simulation', 'whatsapp'));

-- WhatsApp bed requests to hospitals (C6) are their own audience.
alter table messages drop constraint if exists messages_audience_check;
alter table messages add constraint messages_audience_check
  check (audience in ('receiving_facility', 'referrer', 'family', 'availability_ping'));

-- Public bed-portal readings, to flag "portal says free, desk says full" (C4).
create table portal_snapshots (
  id                bigint generated always as identity primary key,
  org_id            uuid not null default '00000000-0000-4000-8000-000000000001' references organisations(id),
  facility_id       uuid not null references facilities(id) on delete cascade,
  source            text not null,
  icu_beds_free     integer check (icu_beds_free is null or icu_beds_free >= 0),
  ventilators_free  integer check (ventilators_free is null or ventilators_free >= 0),
  observed_at       timestamptz not null,
  created_at        timestamptz not null default now()
);
create index portal_snapshots_facility_idx on portal_snapshots (facility_id, observed_at desc);
create trigger portal_snapshots_org before insert on portal_snapshots for each row execute function inherit_org_from_facility();
alter table portal_snapshots enable row level security;

-- Referral drafts from a doctor's WhatsApp text or voice note (C2). Server-only: the transcript may hold identifiers.
create table intake_drafts (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organisations(id) on delete cascade,
  referrer_id  uuid references referrers(id) on delete set null,
  channel      text not null default 'whatsapp',
  kind         text not null check (kind in ('text', 'voice')),
  transcript   text,
  parsed       jsonb not null default '{}'::jsonb,   -- no identifiers: case, acuity, age, sex, needs, guarded note
  status       text not null default 'new' check (status in ('new', 'used', 'dismissed')),
  created_at   timestamptz not null default now()
);
create index intake_drafts_org_idx on intake_drafts (org_id, created_at desc);
alter table intake_drafts enable row level security;

-- ============================================================
-- Org-scoped browser reads (Supabase only). The browser gets a short-lived JWT carrying org_id
-- from /api/realtime-token. Anonymous reads of referral data are removed.
-- ============================================================

do $$
declare
  t text;
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'auth' and p.proname = 'jwt'
  ) then
    foreach t in array array['facilities', 'facility_contacts', 'facility_capabilities', 'referrers', 'referrals', 'call_attempts', 'events', 'portal_snapshots']
    loop
      execute format('drop policy if exists console_read on %I', t);
      execute format('drop policy if exists org_read on %I', t);
      execute format(
        'create policy org_read on %I for select to authenticated using (org_id = nullif(auth.jwt() ->> ''org_id'', '''')::uuid)', t);
    end loop;
  end if;
end $$;
