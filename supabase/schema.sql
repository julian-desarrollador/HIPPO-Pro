-- HIPPO Pro ledger. One JSON snapshot per agency, plus who may sign in.
-- Run this in the Supabase SQL editor. The app uses the anon key only.
-- Never put the service_role key in the app, in Vercel, or in git.
-- While there is no login, also run open-ledger.sql. close-ledger.sql removes that access.

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  agency_id text not null,
  role text not null check (role in ('owner', 'operator')),
  display_name text not null default '',
  email text not null default ''
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

create or replace function public.caller_is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
      and role = 'owner'
  );
$$;

create or replace function public.caller_agency_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select agency_id
  from public.profiles
  where user_id = auth.uid();
$$;

revoke all on function public.caller_is_owner() from public, anon, authenticated;
revoke all on function public.caller_agency_id() from public, anon, authenticated;
grant execute on function public.caller_is_owner() to authenticated;
grant execute on function public.caller_agency_id() to authenticated;

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (user_id = auth.uid());

create policy profiles_select_agency
  on public.profiles
  for select
  to authenticated
  using (
    public.caller_is_owner()
    and agency_id = public.caller_agency_id()
  );

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

-- After creating an owner in Authentication (auto-confirm), enable them:
-- insert into public.profiles (user_id, agency_id, role, display_name)
-- values ('<user uuid>', 'agencia-dolores', 'owner', '<name>');
-- There is no insert policy on profiles. Owners are inserted from the SQL
-- editor. Operators are invited by an owner through manage-operator, which
-- uses the service role and never ships that key to the app.
