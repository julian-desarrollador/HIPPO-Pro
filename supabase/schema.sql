-- HIPPO Pro ledger. One JSON snapshot per agency, plus who may sign in.
-- Run this in the Supabase SQL editor. The app uses the anon key only.
-- Never put the service_role key in the app, in Vercel, or in git.
-- While there is no login, also run open-ledger.sql. close-ledger.sql removes that access.

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  agency_id text not null,
  role text not null check (role in ('owner', 'operator'))
);

create table public.ledgers (
  agency_id text primary key,
  snapshot jsonb not null,
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_ledger_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger ledgers_touch_updated_at
  before update on public.ledgers
  for each row
  execute function public.touch_ledger_updated_at();

revoke all on function public.touch_ledger_updated_at() from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.ledgers enable row level security;

revoke all on public.profiles from anon;
revoke all on public.ledgers from anon;

grant select on public.profiles to authenticated;
grant select, insert, update on public.ledgers to authenticated;

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (user_id = auth.uid());

create policy ledgers_select_own_agency
  on public.ledgers
  for select
  to authenticated
  using (
    agency_id = (select profiles.agency_id from public.profiles where profiles.user_id = auth.uid())
  );

create policy ledgers_insert_own_agency
  on public.ledgers
  for insert
  to authenticated
  with check (
    agency_id = (select profiles.agency_id from public.profiles where profiles.user_id = auth.uid())
  );

create policy ledgers_update_own_agency
  on public.ledgers
  for update
  to authenticated
  using (
    agency_id = (select profiles.agency_id from public.profiles where profiles.user_id = auth.uid())
  )
  with check (
    agency_id = (select profiles.agency_id from public.profiles where profiles.user_id = auth.uid())
  );

-- After creating a user in Authentication (auto-confirm), enable them:
-- insert into public.profiles (user_id, agency_id, role)
-- values ('<user uuid>', 'agencia-dolores', 'owner');
-- role is 'owner' or 'operator'. There is no insert policy on profiles:
-- this statement is run from the SQL editor, not from the app.
