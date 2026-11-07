-- Haazir — consent to the transfer itself, kept with the referral (the transfer record / referral slip).
-- Who agreed: the patient, the attendant, or "emergency_waiver" when the patient cannot consent and no attendant is
-- present (the doctor then records the reason in the hospital's own file). Not an identifier, so it sits on referrals
-- and the slip can show it. Existing rows have none, which the slip prints as "not recorded".
alter table referrals add column if not exists transfer_consent text
  check (transfer_consent in ('patient', 'attendant', 'emergency_waiver'));
alter table referrals add column if not exists transfer_consent_at timestamptz;
alter table referrals add column if not exists transfer_reason text
  check (transfer_reason in ('service_not_available', 'needs_higher_care', 'no_bed', 'other'));
