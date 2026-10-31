-- Optional: run Haazir's background tick every minute from Supabase (pg_cron + pg_net).
-- Not a migration: it holds your app URL and CRON_SECRET. Run it once in the Supabase SQL editor after deploying.
-- Enable the extensions first (Database → Extensions): pg_cron and pg_net.

select cron.schedule(
  'haazir-tick',
  '* * * * *',  -- every minute; pg_cron 1.5+ also accepts '30 seconds'
  $$
  select net.http_post(
    url := 'https://YOUR_APP_URL/api/cron/tick',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET', 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);

-- To stop it:  select cron.unschedule('haazir-tick');
