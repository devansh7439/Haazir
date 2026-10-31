-- Haazir — hardening found in a devil's-advocate review.

-- Failed sign-in attempts, keyed by "ip:<address>" and "email:<address>", for throttling. Server-only.
create table login_failures (
  key  text not null,
  at   timestamptz not null default now()
);
create index login_failures_key_at_idx on login_failures (key, at desc);
alter table login_failures enable row level security;

-- One referral per "Find a bed" press: the form sends a request id, and a retry or double-click reuses it.
alter table referrals add column client_request_id uuid;
create unique index referrals_client_request_idx on referrals (org_id, client_request_id) where client_request_id is not null;

-- Voice test matrix (docs/05-voice-agents.md §9): two full passes before the demo. Server-only.
create table test_matrix_results (
  org_id         uuid not null references organisations(id) on delete cascade,
  pass           smallint not null check (pass in (1, 2)),
  row_no         smallint not null check (row_no between 1 and 20),
  result         text not null check (result in ('pass', 'fail', 'untested')),
  note           text check (note is null or char_length(note) <= 300),
  referral_code  text check (referral_code is null or char_length(referral_code) <= 12),
  tested_by      text check (tested_by is null or char_length(tested_by) <= 80),
  tested_at      timestamptz not null default now(),
  primary key (org_id, pass, row_no)
);
alter table test_matrix_results enable row level security;
