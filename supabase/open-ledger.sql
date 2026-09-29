-- Temporary public book for Agencia Dolores. Visitors can read and write this
-- one ledger. Profiles stay closed. Run once in the SQL editor.
-- To require sign-in later, run close-ledger.sql.

grant select, insert, update on public.ledgers to anon;

drop policy if exists ledgers_anon_select on public.ledgers;
create policy ledgers_anon_select
  on public.ledgers
  for select
  to anon
  using (agency_id = 'agencia-dolores');

drop policy if exists ledgers_anon_insert on public.ledgers;
create policy ledgers_anon_insert
  on public.ledgers
  for insert
  to anon
  with check (agency_id = 'agencia-dolores');

drop policy if exists ledgers_anon_update on public.ledgers;
create policy ledgers_anon_update
  on public.ledgers
  for update
  to anon
  using (agency_id = 'agencia-dolores')
  with check (agency_id = 'agencia-dolores');
