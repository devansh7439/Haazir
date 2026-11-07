-- Haazir — the hospital desk screen: a private link per hospital (no accounts), and "we're full" for a few hours.
-- facility_desk_links is server-only (row level security, no policies): only a hash of the link's token is kept, so
-- a database reader can't open a desk screen. Creating a new link replaces the old one. full_until is not secret:
-- the console shows it, and matching skips a hospital until then.
alter table facilities add column if not exists full_until timestamptz;

create table facility_desk_links (
  facility_id  uuid primary key references facilities(id) on delete cascade,
  org_id       uuid not null references organisations(id) on delete cascade,
  token_hash   text not null unique,
  created_at   timestamptz not null default now()
);
alter table facility_desk_links enable row level security;
