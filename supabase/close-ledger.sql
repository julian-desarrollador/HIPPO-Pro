-- Closes the public book. After this, only a signed-in profile can read or
-- write the ledger. Also clear EXPO_PUBLIC_SUPABASE_PUBLIC and redeploy.

drop policy if exists ledgers_anon_select on public.ledgers;
drop policy if exists ledgers_anon_insert on public.ledgers;
drop policy if exists ledgers_anon_update on public.ledgers;

revoke all on public.ledgers from anon;
