-- Haazir — a widened search does not ring a hospital that already said no to this patient.
-- A widen starts a new referral, and each wave only skips hospitals called on its own referral. Without this, the new
-- search rang the same desks first and new hospitals could wait for a later wave. Text ids, as required_capabilities is.

alter table referrals add column if not exists declined_facility_ids text[] not null default '{}';
