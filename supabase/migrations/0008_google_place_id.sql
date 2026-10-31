-- Haazir — the Google place a hospital is matched to, so its star rating can be shown on the Hospitals page.
-- Only the place id is stored. Google's terms allow keeping a place id; the rating itself is fetched live and held in
-- memory for a short time, never written to the database.
alter table facilities add column if not exists google_place_id text;
