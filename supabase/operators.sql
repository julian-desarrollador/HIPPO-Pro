-- For a project that already ran schema.sql. A fresh schema.sql already
-- includes these columns, functions, and the agency read policy.
-- Owners still cannot insert profiles from the app. The manage-operator
-- function writes them with the service role.

alter table public.profiles
  add column if not exists display_name text not null default '';

alter table public.profiles
  add column if not exists email text not null default '';

alter table public.profiles
  add column if not exists can_invite_owners boolean not null default false;

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

drop policy if exists profiles_select_agency on public.profiles;

create policy profiles_select_agency
  on public.profiles
  for select
  to authenticated
  using (
    public.caller_is_owner()
    and agency_id = public.caller_agency_id()
  );
