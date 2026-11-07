-- Haazir — where the ambulance is, as the referring doctor records it.
-- There is no public 108 dispatch API, so Haazir does not book the ambulance: the doctor calls 108 (or the hospital's own
-- ambulance) and taps the state here, so the board, the slip and a colleague taking over all show it. Not an identifier.
-- Existing rows are "not_requested".
alter table referrals add column if not exists ambulance_status text not null default 'not_requested'
  check (ambulance_status in ('not_requested', 'requested', 'dispatched', 'at_patient', 'not_available'));
alter table referrals add column if not exists ambulance_updated_at timestamptz;
