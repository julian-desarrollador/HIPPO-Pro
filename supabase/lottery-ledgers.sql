-- Agencia de Quiniela. Its own book per agency, apart from public.ledgers:
-- nothing here reads or changes the racing book, profiles or agencies.
-- The row exists once an owner presses Activar. For a project that already
-- ran schema.sql and agencies.sql. A fresh schema.sql already includes this.
-- Safe to run again.

create table if not exists public.lottery_ledgers (
  agency_id text primary key references public.agencies (agency_id),
  snapshot jsonb not null check (snapshot ->> 'agencyId' = agency_id),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);

drop trigger if exists lottery_ledgers_touch_updated_at on public.lottery_ledgers;
create trigger lottery_ledgers_touch_updated_at
  before update on public.lottery_ledgers
  for each row
  execute function public.touch_ledger_updated_at();

alter table public.lottery_ledgers enable row level security;

revoke all on public.lottery_ledgers from anon, authenticated;
grant select, insert, update on public.lottery_ledgers to authenticated;
grant select, insert, update, delete on public.lottery_ledgers to service_role;

drop policy if exists lottery_ledgers_select_own_agency on public.lottery_ledgers;
create policy lottery_ledgers_select_own_agency
  on public.lottery_ledgers
  for select
  to authenticated
  using (public.caller_can_use_agency(agency_id));

-- Activar: only an owner creates the row.
drop policy if exists lottery_ledgers_insert_owner on public.lottery_ledgers;
create policy lottery_ledgers_insert_owner
  on public.lottery_ledgers
  for insert
  to authenticated
  with check (public.caller_can_use_agency(agency_id) and public.caller_is_owner());

drop policy if exists lottery_ledgers_update_own_agency on public.lottery_ledgers;
create policy lottery_ledgers_update_own_agency
  on public.lottery_ledgers
  for update
  to authenticated
  using (public.caller_can_use_agency(agency_id))
  with check (public.caller_can_use_agency(agency_id));
