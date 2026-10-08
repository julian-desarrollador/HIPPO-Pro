-- HIPPO Pro ledger. One JSON snapshot per agency, plus who may sign in.
-- Run this in the Supabase SQL editor. The app uses the anon key only.
-- Never put the service_role key in the app, in Vercel, or in git.
-- While there is no login, also run open-ledger.sql. close-ledger.sql removes that access.

create table public.agencies (
  agency_id text primary key
    check (agency_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(agency_id) <= 60),
  name text not null check (length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  agency_id text not null references public.agencies (agency_id),
  role text not null check (role in ('owner', 'operator')),
  display_name text not null default '',
  email text not null default '',
  can_invite_owners boolean not null default false,
  can_create_agencies boolean not null default false
);

create table public.ledgers (
  agency_id text primary key references public.agencies (agency_id),
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

alter table public.agencies enable row level security;
alter table public.profiles enable row level security;
alter table public.ledgers enable row level security;

revoke all on public.agencies from anon, authenticated;
revoke all on public.profiles from anon;
revoke all on public.ledgers from anon;

grant select on public.agencies to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update on public.ledgers to authenticated;

-- The edge functions use the service role. It bypasses row security and still
-- needs these privileges. The anon key never receives them.
grant select, insert, update, delete on public.agencies to service_role;
grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.ledgers to service_role;

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

create policy agencies_select_own
  on public.agencies
  for select
  to authenticated
  using (agency_id = public.caller_agency_id());

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

-- After creating an owner in Authentication (auto-confirm), enable them.
-- can_invite_owners lets that owner invite other owners from the app.
-- can_create_agencies lets them create other agencies from the app.
-- insert into public.agencies (agency_id, name) values ('agencia-dolores', 'Agencia Dolores');
-- insert into public.profiles (user_id, agency_id, role, display_name, can_invite_owners)
-- values ('<user uuid>', 'agencia-dolores', 'owner', '<name>', true);
-- There is no insert policy on agencies or profiles. The first owners are
-- inserted from the SQL editor. Later owners and operators are invited through
-- manage-operator, and new agencies through create-agency. Both use the
-- service role and never ship that key to the app.
