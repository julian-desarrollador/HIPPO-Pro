-- A personal agency belongs to one user and has no other members.
-- That user keeps their profile agency and can also read and write the
-- personal book and its photos. Run this in the SQL editor after
-- agencies.sql, day-photos.sql and deposit-photos.sql. Safe to run again.

alter table public.agencies
  add column if not exists personal_user_id uuid references auth.users (id);

create or replace function public.caller_can_use_agency(target text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target = public.caller_agency_id()
    or exists (
      select 1
      from public.agencies
      where agency_id = target
        and personal_user_id = auth.uid()
    );
$$;

revoke all on function public.caller_can_use_agency(text) from public, anon, authenticated;
grant execute on function public.caller_can_use_agency(text) to authenticated;

drop policy if exists agencies_select_own on public.agencies;
create policy agencies_select_own
  on public.agencies
  for select
  to authenticated
  using (public.caller_can_use_agency(agency_id));

drop policy if exists ledgers_select_own_agency on public.ledgers;
create policy ledgers_select_own_agency
  on public.ledgers
  for select
  to authenticated
  using (public.caller_can_use_agency(agency_id));

drop policy if exists ledgers_insert_own_agency on public.ledgers;
create policy ledgers_insert_own_agency
  on public.ledgers
  for insert
  to authenticated
  with check (public.caller_can_use_agency(agency_id));

drop policy if exists ledgers_update_own_agency on public.ledgers;
create policy ledgers_update_own_agency
  on public.ledgers
  for update
  to authenticated
  using (public.caller_can_use_agency(agency_id))
  with check (public.caller_can_use_agency(agency_id));

drop policy if exists day_photos_select on storage.objects;
create policy day_photos_select on storage.objects
for select to authenticated
using (
  bucket_id = 'day-photos'
  and public.caller_can_use_agency((storage.foldername(name))[1])
);

drop policy if exists day_photos_insert on storage.objects;
create policy day_photos_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'day-photos'
  and public.caller_can_use_agency((storage.foldername(name))[1])
);

drop policy if exists day_photos_update on storage.objects;
create policy day_photos_update on storage.objects
for update to authenticated
using (
  bucket_id = 'day-photos'
  and public.caller_can_use_agency((storage.foldername(name))[1])
)
with check (
  bucket_id = 'day-photos'
  and public.caller_can_use_agency((storage.foldername(name))[1])
);

drop policy if exists day_photos_delete on storage.objects;
create policy day_photos_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'day-photos'
  and public.caller_can_use_agency((storage.foldername(name))[1])
);

drop policy if exists deposit_photos_select on storage.objects;
create policy deposit_photos_select on storage.objects
for select to authenticated
using (
  bucket_id = 'deposit-photos'
  and public.caller_can_use_agency((storage.foldername(name))[1])
);

drop policy if exists deposit_photos_insert on storage.objects;
create policy deposit_photos_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'deposit-photos'
  and public.caller_can_use_agency((storage.foldername(name))[1])
);

drop policy if exists deposit_photos_update on storage.objects;
create policy deposit_photos_update on storage.objects
for update to authenticated
using (
  bucket_id = 'deposit-photos'
  and public.caller_can_use_agency((storage.foldername(name))[1])
)
with check (
  bucket_id = 'deposit-photos'
  and public.caller_can_use_agency((storage.foldername(name))[1])
);

drop policy if exists deposit_photos_delete on storage.objects;
create policy deposit_photos_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'deposit-photos'
  and public.caller_can_use_agency((storage.foldername(name))[1])
);
