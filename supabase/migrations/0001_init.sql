-- Haazir — initial schema
-- Target: Supabase (Postgres 15+). Run in the Supabase SQL editor or with `supabase db push`.
-- Writes happen server-side with the service-role key (bypasses RLS).
-- The browser only reads, through the policies at the bottom of this file.

-- ============================================================
-- Helpers
-- ============================================================

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Short spoken reference such as R-4821. Resolved at insert time.
create or replace function next_referral_code() returns text
language plpgsql as $$
declare
  candidate text;
begin
  loop
    candidate := 'R-' || (1000 + floor(random() * 9000))::int::text;
    exit when not exists (select 1 from referrals where code = candidate);
  end loop;
  return candidate;
end $$;

-- ============================================================
-- Reference data
-- ============================================================

create table capabilities (
  code       text primary key,
  label      text not null,                -- shown in the UI
  spoken_en  text not null,                -- used to build the spoken "needs" phrase
  category   text not null check (category in ('bed','equipment','specialist','service','drug'))
);
comment on table capabilities is 'Static things a hospital can offer. Live availability is asked on the call, never stored here.';

create table case_templates (
  case_type             text primary key,
  label                 text not null,
  spoken_en             text not null,
  default_capabilities  text[] not null default '{}',
  clinician_reviewed    boolean not null default false
);
comment on table case_templates is 'Editable defaults. Keep clinician_reviewed = false until a doctor has reviewed the mapping.';

-- ============================================================
-- Directory
-- ============================================================

create table facilities (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  kind             text not null check (kind in ('phc','chc','district_hospital','medical_college','private_hospital','nursing_home','other')),
  ownership        text not null default 'unknown' check (ownership in ('public','private','trust','unknown')),
  address          text,
  city             text,
  district         text,
  lat              double precision not null check (lat between -90 and 90),
  lng              double precision not null check (lng between -180 and 180),
  call_language    text not null default 'en' check (call_language ~ '^[a-z]{2}$'),  -- Bolna language key the call starts in
  whatsapp_number  text check (whatsapp_number is null or whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'),
  is_demo          boolean not null default false,
  active           boolean not null default true,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table facility_contacts (
  id              uuid primary key default gen_random_uuid(),
  facility_id     uuid not null references facilities(id) on delete cascade,
  role            text not null check (role in ('casualty_desk','referral_desk','nursing_station','duty_manager','reception','other')),
  phone_e164      text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  priority        smallint not null default 1,        -- 1 = try first
  is_ivr          boolean not null default false,     -- agent cannot press keys, so IVR lines are a last resort
  verified_at     timestamptz,
  calls_made      integer not null default 0,
  calls_answered  integer not null default 0,
  last_outcome    text,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (facility_id, phone_e164)
);

create table facility_capabilities (
  facility_id        uuid not null references facilities(id) on delete cascade,
  capability_code    text not null references capabilities(code),
  status             text not null default 'declared' check (status in ('declared','confirmed','not_available','unknown')),
  source             text not null default 'directory' check (source in ('directory','self_reported','call','manual')),
  last_confirmed_at  timestamptz,
  primary key (facility_id, capability_code)
);

create table referrers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  phone_e164   text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  facility_id  uuid references facilities(id),
  languages    text[] not null default '{en}',
  created_at   timestamptz not null default now()
);

-- ============================================================
-- Referrals and calls
-- ============================================================

create table referrals (
  id                     uuid primary key default gen_random_uuid(),
  code                   text not null unique default next_referral_code(),
  status                 text not null default 'searching'
                           check (status in ('draft','searching','options_ready','confirming','confirmed','exhausted','cancelled','closed')),
  referrer_id            uuid not null references referrers(id),
  origin_facility_id     uuid references facilities(id),
  origin_lat             double precision not null,
  origin_lng             double precision not null,
  case_type              text not null references case_templates(case_type),
  acuity                 text not null check (acuity in ('critical','serious','stable')),
  age_value              integer check (age_value between 0 and 120),
  age_unit               text not null default 'years' check (age_unit in ('days','months','years')),
  sex                    text not null default 'unknown' check (sex in ('male','female','other','unknown')),
  note                   text check (char_length(note) <= 160),          -- no names or IDs (enforced in the API too)
  required_capabilities  text[] not null default '{}',
  spoken_summary         text not null,                                  -- exactly what hospitals hear
  transport              text not null default 'ambulance' check (transport in ('ambulance','private_vehicle','unknown')),
  search_radius_km       integer not null default 40 check (search_radius_km between 1 and 300),
  current_wave           smallint not null default 0,
  wave_started_at        timestamptz,
  selected_facility_id   uuid references facilities(id),
  selected_attempt_id    uuid,                                           -- FK added below
  hold_expires_at        timestamptz,
  first_acceptance_at    timestamptz,
  confirmed_at           timestamptz,
  closed_at              timestamptz,
  close_reason           text,
  is_simulated           boolean not null default false,
  is_demo                boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Identifying details live apart from the referral. Server-only (no RLS policy).
create table patient_details (
  referral_id               uuid primary key references referrals(id) on delete cascade,
  patient_name              text,
  attendant_name            text,
  attendant_phone_e164      text check (attendant_phone_e164 is null or attendant_phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  attendant_language        text not null default 'en' check (attendant_language ~ '^[a-z]{2}$'),
  shared_with_facility_at   timestamptz,
  created_at                timestamptz not null default now()
);

create table call_attempts (
  id                    uuid primary key default gen_random_uuid(),
  referral_id           uuid not null references referrals(id) on delete cascade,
  facility_id           uuid references facilities(id),
  contact_id            uuid references facility_contacts(id) on delete set null,
  parent_attempt_id     uuid references call_attempts(id) on delete set null,   -- redials and callbacks point to the original
  purpose               text not null check (purpose in ('availability','hold_confirm','release','family_update')),
  wave                  smallint not null default 1,
  rank                  smallint,
  distance_km           numeric(6,1),
  eta_minutes           integer,
  rank_reasons          jsonb not null default '[]'::jsonb,                     -- "why this hospital" chips
  to_number             text not null,
  call_language         text not null default 'en',
  bolna_agent_id        text,
  bolna_execution_id    text unique,
  status                text not null default 'queued'
                          check (status in ('queued','dialing','ringing','in_progress','wrapping_up','completed','no_answer','busy','failed','canceled')),
  bolna_status          text,
  termination_reason    text,
  outcome               text check (outcome in ('accepted','conditional','declined','redirected','needs_doctor','callback_later','ivr_blocked','unclear',
                                                'hold_confirmed','hold_declined','release_ack','family_informed')),
  outcome_source        text check (outcome_source in ('function','extraction','manual','simulation')),
  extraction_outcome    text,                                                   -- second opinion from post-call extraction
  needs_review          boolean not null default false,
  bed_type              text,
  specialist_available  text,
  ready_in_minutes      integer,
  conditions            text,
  contact_person        text,
  decline_reason        text,
  alternate_number      text,
  callback_due_at       timestamptz,
  transcript            text,
  recording_url         text,
  extracted_data        jsonb,
  dispatched_at         timestamptz,
  answered_at           timestamptz,
  outcome_at            timestamptz,
  ended_at              timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table referrals
  add constraint referrals_selected_attempt_fk
  foreign key (selected_attempt_id) references call_attempts(id) on delete set null;

-- Append-only audit trail. Payloads must never contain patient identifiers.
create table events (
  id           bigint generated always as identity primary key,
  referral_id  uuid not null references referrals(id) on delete cascade,
  attempt_id   uuid references call_attempts(id) on delete set null,
  type         text not null,
  payload      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

-- Outbound WhatsApp/SMS. Server-only: bodies may contain the patient name after acceptance.
create table messages (
  id                   uuid primary key default gen_random_uuid(),
  referral_id          uuid not null references referrals(id) on delete cascade,
  channel              text not null default 'whatsapp' check (channel in ('whatsapp','sms')),
  audience             text not null check (audience in ('receiving_facility','referrer','family')),
  to_number            text not null,
  body                 text not null,
  provider             text,
  provider_message_id  text,
  status               text not null default 'queued' check (status in ('queued','sent','delivered','failed','simulated')),
  error                text,
  created_at           timestamptz not null default now()
);

-- Raw Bolna webhook payloads for debugging. Server-only.
create table bolna_webhook_log (
  id            bigint generated always as identity primary key,
  execution_id  text,
  status        text,
  payload       jsonb not null,
  received_at   timestamptz not null default now()
);

-- ============================================================
-- Indexes and triggers
-- ============================================================

create index referrals_status_idx            on referrals (status);
create index call_attempts_referral_idx      on call_attempts (referral_id);
create index call_attempts_facility_idx      on call_attempts (facility_id);
create index call_attempts_status_idx        on call_attempts (status);
create index call_attempts_callback_idx      on call_attempts (callback_due_at) where callback_due_at is not null;
create index events_referral_created_idx     on events (referral_id, created_at);
create index messages_referral_idx           on messages (referral_id);
create index webhook_log_execution_idx       on bolna_webhook_log (execution_id);
create index facility_contacts_facility_idx  on facility_contacts (facility_id);

create trigger facilities_set_updated_at    before update on facilities    for each row execute function set_updated_at();
create trigger referrals_set_updated_at     before update on referrals     for each row execute function set_updated_at();
create trigger call_attempts_set_updated_at before update on call_attempts for each row execute function set_updated_at();

-- ============================================================
-- Views
-- ============================================================

create view facility_stats as
select
  f.id                                                                                         as facility_id,
  count(a.id) filter (where a.purpose = 'availability')                                        as availability_calls,
  count(a.id) filter (where a.purpose = 'availability' and a.answered_at is not null)          as answered,
  count(a.id) filter (where a.purpose = 'availability' and a.outcome in ('accepted','conditional')) as accepted,
  max(a.created_at)                                                                            as last_called_at
from facilities f
left join call_attempts a on a.facility_id = f.id
group by f.id;

create view referral_metrics as
select
  r.id,
  r.code,
  r.status,
  r.created_at,
  r.first_acceptance_at,
  extract(epoch from (r.first_acceptance_at - r.created_at))::int as ttfa_seconds,
  extract(epoch from (r.confirmed_at - r.created_at))::int         as time_to_confirmed_seconds,
  (select count(*) from call_attempts a where a.referral_id = r.id) as calls_total
from referrals r;

-- ============================================================
-- Row Level Security (hackathon setting: the console reads, the server writes)
-- ============================================================

alter table capabilities          enable row level security;
alter table case_templates        enable row level security;
alter table facilities            enable row level security;
alter table facility_contacts     enable row level security;
alter table facility_capabilities enable row level security;
alter table referrers             enable row level security;
alter table referrals             enable row level security;
alter table patient_details       enable row level security;   -- no policy: server-only
alter table call_attempts         enable row level security;
alter table events                enable row level security;
alter table messages              enable row level security;   -- no policy: server-only
alter table bolna_webhook_log     enable row level security;   -- no policy: server-only

create policy console_read on capabilities          for select to anon, authenticated using (true);
create policy console_read on case_templates        for select to anon, authenticated using (true);
create policy console_read on facilities            for select to anon, authenticated using (true);
create policy console_read on facility_contacts     for select to anon, authenticated using (true);
create policy console_read on facility_capabilities for select to anon, authenticated using (true);
create policy console_read on referrers             for select to anon, authenticated using (true);
create policy console_read on referrals             for select to anon, authenticated using (true);
create policy console_read on call_attempts         for select to anon, authenticated using (true);
create policy console_read on events                for select to anon, authenticated using (true);
-- Production: replace `using (true)` with organisation-scoped policies and require sign-in.

-- ============================================================
-- Realtime (Supabase only; skipped on plain Postgres)
-- ============================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table referrals, call_attempts, events;
  end if;
end $$;
