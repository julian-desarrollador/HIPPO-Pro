-- Agencies that use HippoPro. The menu and the WhatsApp text read the name
-- from here. Only the create-agency function writes rows, with the service
-- role. For a project that already ran schema.sql, operators.sql and
-- day-photos.sql. A fresh schema.sql already includes all of this.
-- Safe to run again.

create table if not exists public.agencies (
  agency_id text primary key
    check (agency_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(agency_id) <= 60),
  name text not null check (length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);

alter table public.agencies enable row level security;

revoke all on public.agencies from anon, authenticated;
grant select on public.agencies to authenticated;

-- create-agency and manage-operator read and write with the service role.
-- A table created in the SQL editor does not hand that role its privileges.
grant select, insert, update, delete on public.agencies to service_role;
grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.ledgers to service_role;

drop policy if exists agencies_select_own on public.agencies;
create policy agencies_select_own
  on public.agencies
  for select
  to authenticated
  using (agency_id = public.caller_agency_id());

insert into public.agencies (agency_id, name)
values ('agencia-dolores', 'Agencia Dolores')
on conflict (agency_id) do nothing;

-- Who may create agencies from the app. can_invite_owners only covers owners
-- of the same agency. Set it from the SQL editor:
-- update public.profiles set can_create_agencies = true where email = '<correo>';
alter table public.profiles
  add column if not exists can_create_agencies boolean not null default false;

-- A profile or a book can only point to an agency that exists.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and conname = 'profiles_agency_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_agency_id_fkey
      foreign key (agency_id) references public.agencies (agency_id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ledgers'::regclass and conname = 'ledgers_agency_id_fkey'
  ) then
    alter table public.ledgers
      add constraint ledgers_agency_id_fkey
      foreign key (agency_id) references public.agencies (agency_id);
  end if;
end;
$$;
