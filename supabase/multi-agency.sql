-- One account in several agencies. Run once in the SQL editor, after
-- agencies.sql, operators.sql, personal-agencies.sql and lottery-ledgers.sql.
-- Safe to run again. Then run isolation-check.sql: it must end without FUGA.
--
-- profiles becomes one row per person and agency. Role, name and
-- can_invite_owners belong to that agency. can_create_agencies and
-- can_manage_trash count for the person if any of their rows has them.
-- The rules stop asking "which is your agency" (caller_agency_id) and ask
-- "are you in this agency" (caller_is_member, caller_owns_agency).
-- After this file, do not run agencies.sql, operators.sql,
-- personal-agencies.sql or lottery-ledgers.sql again: they bring back the
-- one-agency rules.

begin;

-- One row per person and agency. The rows that exist already fit.
do $$
begin
  if (
    select count(*)
    from pg_index i
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
    where i.indrelid = 'public.profiles'::regclass and i.indisprimary
  ) = 1 then
    alter table public.profiles drop constraint profiles_pkey;
    alter table public.profiles add constraint profiles_pkey primary key (user_id, agency_id);
  end if;
end;
$$;

create or replace function public.caller_is_member(target text)
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
      and agency_id = target
  );
$$;

-- Owner of that agency, or it is their own test agency.
create or replace function public.caller_owns_agency(target text)
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
      and agency_id = target
      and role = 'owner'
  ) or exists (
    select 1
    from public.agencies
    where agency_id = target
      and personal_user_id = auth.uid()
  );
$$;

-- An agency the caller is in, or their own test agency, while it is not removed.
create or replace function public.caller_can_use_agency(target text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agencies as agency
    where agency.agency_id = target
      and agency.archived_at is null
      and (
        agency.personal_user_id = auth.uid()
        or exists (
          select 1
          from public.profiles
          where user_id = auth.uid()
            and agency_id = target
        )
      )
  );
$$;

-- For the edge functions only: is there an account with this email?
create or replace function public.user_id_for_email(target text)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select id
  from auth.users
  where lower(email) = lower(btrim(target))
  limit 1;
$$;

revoke all on function public.caller_is_member(text) from public, anon, authenticated;
revoke all on function public.caller_owns_agency(text) from public, anon, authenticated;
revoke all on function public.caller_can_use_agency(text) from public, anon, authenticated;
revoke all on function public.user_id_for_email(text) from public, anon, authenticated;
grant execute on function public.caller_is_member(text) to authenticated;
grant execute on function public.caller_owns_agency(text) to authenticated;
grant execute on function public.caller_can_use_agency(text) to authenticated;
grant execute on function public.user_id_for_email(text) to service_role;

-- An owner reads the people of each agency they own, and no other.
drop policy if exists profiles_select_agency on public.profiles;
create policy profiles_select_agency
  on public.profiles
  for select
  to authenticated
  using (public.caller_owns_agency(agency_id));

-- Activar the lottery: an owner of that same agency.
drop policy if exists lottery_ledgers_insert_owner on public.lottery_ledgers;
create policy lottery_ledgers_insert_owner
  on public.lottery_ledgers
  for insert
  to authenticated
  with check (public.caller_can_use_agency(agency_id) and public.caller_owns_agency(agency_id));

-- Nothing uses them now. If a policy still did, this stops and nothing changes.
drop function if exists public.caller_is_owner();
drop function if exists public.caller_agency_id();

commit;
