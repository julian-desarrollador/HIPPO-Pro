-- The trash of removed agencies (Papelera). Run once, after agencies.sql.
-- Only a profile with this mark lists removed agencies, restores them or deletes
-- them for good, through create-agency. There is no update policy on profiles,
-- so nobody can give it to themselves from the app.
alter table public.profiles
  add column if not exists can_manage_trash boolean not null default false;
