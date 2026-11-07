-- Haazir — attachments (ECG, photo, records) kept in Postgres, and when treatment started.
-- Attachments: server-only (row level security, no policies), because a photo or a record can carry the patient's name even
-- though Haazir never reads it. The browser gets only metadata (kind, type, size); the bytes are served by a route that checks
-- a console session or a signed, expiring link and the referral's state. No filename is stored: filenames carry names.
-- They live in the database so tests, Supabase and any Postgres need no extra storage service; 4 MB each, 6 per referral
-- (enforced in the service; the check below is the hard cap). Deleted with the other identifiers by the retention purge.
create table referral_attachments (
  id           uuid primary key default gen_random_uuid(),
  referral_id  uuid not null references referrals(id) on delete cascade,
  org_id       uuid not null default '00000000-0000-4000-8000-000000000001' references organisations(id),
  kind         text not null check (kind in ('ecg', 'photo', 'record', 'other')),
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes   integer not null check (size_bytes between 1 and 5242880),
  data         bytea not null,
  created_by   uuid references app_users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index referral_attachments_referral_idx on referral_attachments (referral_id, created_at);
create trigger referral_attachments_org before insert on referral_attachments for each row execute function inherit_org_from_referral();
alter table referral_attachments enable row level security;

-- When the receiving hospital began treating the patient, recorded by the doctor (or the hospital screen). With the arrival
-- check it gives request-to-arrival and arrival-to-treatment times. Null until someone records it.
alter table referrals add column if not exists treatment_started_at timestamptz;
