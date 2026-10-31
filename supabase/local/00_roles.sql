-- Plain Postgres / PGlite only: create the roles Supabase provides, so 0001_init.sql's policies apply.
-- Skipped automatically on Supabase (the roles already exist).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;
