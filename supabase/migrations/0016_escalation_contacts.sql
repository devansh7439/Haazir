-- Haazir — escalation numbers beyond 108 and 112: the district referral officer, the state's designated referral hospital,
-- a control room. An admin lists them for the organisation; the board shows them when no hospital accepted. Nothing is
-- seeded: these numbers differ by district and state, and a wrong one is worse than none.
-- Server-only: row level security with no policies, like push_tokens.
create table escalation_contacts (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organisations(id) on delete cascade,
  label      text not null check (char_length(label) between 2 and 80),
  phone_e164 text not null,
  sort_order smallint not null default 1,
  created_at timestamptz not null default now(),
  unique (org_id, phone_e164)
);
create index escalation_contacts_org_idx on escalation_contacts (org_id, sort_order);
alter table escalation_contacts enable row level security;
