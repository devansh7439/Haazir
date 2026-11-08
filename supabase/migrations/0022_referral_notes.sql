-- Haazir — handover notes on a referral. A coordinator going off shift, or a doctor handing a case on, writes what is done and
-- what is pending ("Banyan said yes, waiting on Dr Kiran") so the next person does not start from the timeline.
-- Server-only (row level security, no policies): a free-text note can still carry a name, so the browser's realtime token
-- cannot read it. Notes are checked like the clinical note (no phone number, ID or email) and deleted with the other
-- identifiers by the retention purge. author_name is kept as written so a note outlives a deleted user. seq orders notes
-- written in the same instant (the id is random).
create table referral_notes (
  id           uuid primary key default gen_random_uuid(),
  seq          bigint generated always as identity,
  referral_id  uuid not null references referrals(id) on delete cascade,
  org_id       uuid not null default '00000000-0000-4000-8000-000000000001' references organisations(id),
  author_id    uuid references app_users(id) on delete set null,
  author_name  text not null,
  body         text not null check (char_length(body) between 1 and 500),
  created_at   timestamptz not null default now()
);
create index referral_notes_referral_idx on referral_notes (referral_id, created_at desc, seq desc);
create trigger referral_notes_org before insert on referral_notes for each row execute function inherit_org_from_referral();
alter table referral_notes enable row level security;
