-- Full access: an account that works as owner in every real agency.
-- Run once in the SQL editor, after multi-agency.sql. Safe to run again.
-- Then run isolation-check.sql: it must end without FUGA.
--
-- A real agency is one that is not a test (personal_user_id is null) and is
-- not in the trash. Someone else's test agency, like the developer's own
-- «HippoPro Soporte», stays out. No profiles rows are added, so the account
-- does not show up among the owners of those agencies; what it changes is
-- still signed with its name in each agency's Historial.
-- Give it with:
--   update public.profiles set can_access_all_agencies = true where email = '<correo>';

begin;

alter table public.profiles
  add column if not exists can_access_all_agencies boolean not null default false;

create or replace function public.caller_has_full_access()
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
      and can_access_all_agencies = true
  );
$$;

-- An agency the caller is in, their own test agency, or any real agency with
-- full access, while it is not removed.
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
        or (agency.personal_user_id is null and public.caller_has_full_access())
      )
  );
$$;

-- Owner of that agency, their own test agency, or a real agency with full access.
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
  ) or exists (
    select 1
    from public.agencies
    where agency_id = target
      and personal_user_id is null
      and archived_at is null
      and public.caller_has_full_access()
  );
$$;

revoke all on function public.caller_has_full_access() from public, anon, authenticated;
revoke all on function public.caller_can_use_agency(text) from public, anon, authenticated;
revoke all on function public.caller_owns_agency(text) from public, anon, authenticated;
grant execute on function public.caller_has_full_access() to authenticated;
grant execute on function public.caller_can_use_agency(text) to authenticated;
grant execute on function public.caller_owns_agency(text) to authenticated;

commit;
