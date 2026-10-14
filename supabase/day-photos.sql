-- Private files for an optional image on a loaded day.
-- The object path is {agencyId}/{dayId}. Bytes stay out of the ledger JSON.
-- Run this in the SQL editor after operators.sql. Safe to run again.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'day-photos',
  'day-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

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
