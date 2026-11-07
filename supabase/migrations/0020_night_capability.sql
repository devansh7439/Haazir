-- Haazir — which of a hospital's services are only there in the daytime. The ventilator may be broken at 2 a.m., the
-- neurosurgeon at home. night_available = false marks a declared capability as day-only: at night such a hospital is
-- ranked lower (never skipped, because the flag can be stale) and the call asks the desk directly whether it is there.
alter table facility_capabilities add column if not exists night_available boolean not null default true;
