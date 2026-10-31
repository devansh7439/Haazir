-- Haazir — record that the attendant agreed to be contacted (docs/09 §3).
-- The doctor ticks a box on the referral form; the time is stored with the identifiers, server-only like the rest of
-- patient_details. Without it the family is not messaged or called. Existing rows have none, which means no consent.
alter table patient_details add column if not exists attendant_consent_at timestamptz;
