-- Private files for an optional image on an agency or lottery expense.
-- The object path is {agencyId}/{expenseId}. Bytes stay out of the ledger JSON.
-- Run this in the SQL editor after cash-photos.sql. Safe to run again.
-- It does not touch day-photos, deposit-photos or cash-photos.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expense-photos',
  'expense-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists expense_photos_select on storage.objects;
create policy expense_photos_select on storage.objects
for select to authenticated
using (
  bucket_id = 'expense-photos'
  and public.caller_can_use_agency((storage.foldername(name))[1])
);

drop policy if exists expense_photos_insert on storage.objects;
create policy expense_photos_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'expense-photos'
  and public.caller_can_use_agency((storage.foldername(name))[1])
);

drop policy if exists expense_photos_update on storage.objects;
create policy expense_photos_update on storage.objects
for update to authenticated
using (
  bucket_id = 'expense-photos'
  and public.caller_can_use_agency((storage.foldername(name))[1])
)
with check (
  bucket_id = 'expense-photos'
  and public.caller_can_use_agency((storage.foldername(name))[1])
);

drop policy if exists expense_photos_delete on storage.objects;
create policy expense_photos_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'expense-photos'
  and public.caller_can_use_agency((storage.foldername(name))[1])
);
