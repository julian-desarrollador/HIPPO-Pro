-- Checks lottery_ledgers: no session sees nothing, another agency cannot read
-- or write, an operator cannot activate, and the racing book does not change.
-- Run it in the SQL editor after lottery-ledgers.sql, and again after any
-- change to its policies. Everything is rolled back. A leak stops the run with
-- an error that starts with FUGA. The last line says it passed.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000b001', 'quiniela-a@example.invalid'),
  ('00000000-0000-4000-8000-00000000b002', 'quiniela-b@example.invalid'),
  ('00000000-0000-4000-8000-00000000b003', 'quiniela-op@example.invalid');

insert into public.agencies (agency_id, name) values
  ('quiniela-a', 'Prueba A'),
  ('quiniela-b', 'Prueba B');

insert into public.profiles (user_id, agency_id, role, display_name, email) values
  ('00000000-0000-4000-8000-00000000b001', 'quiniela-a', 'owner', 'Prueba A', 'quiniela-a@example.invalid'),
  ('00000000-0000-4000-8000-00000000b002', 'quiniela-b', 'owner', 'Prueba B', 'quiniela-b@example.invalid'),
  ('00000000-0000-4000-8000-00000000b003', 'quiniela-a', 'operator', 'Operador A', 'quiniela-op@example.invalid');

insert into public.ledgers (agency_id, snapshot) values
  ('quiniela-a', '{"agencyId":"quiniela-a","month":"2026-10","days":[],"deposits":[],"expenses":[],"openingBalances":[]}');

insert into public.lottery_ledgers (agency_id, snapshot) values
  ('quiniela-b', '{"agencyId":"quiniela-b"}');

set local role anon;

do $$
declare
  n integer;
begin
  begin
    select count(*) into n from public.lottery_ledgers;
    if n > 0 then
      raise exception 'FUGA: sin sesión se lee la quiniela';
    end if;
  exception when insufficient_privilege then null;
  end;
end;
$$;

set local role authenticated;

do $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', '00000000-0000-4000-8000-00000000b003', 'role', 'authenticated')::text,
    true
  );
  begin
    insert into public.lottery_ledgers (agency_id, snapshot) values ('quiniela-a', '{"agencyId":"quiniela-a"}');
    raise exception 'FUGA: un operador activó la quiniela';
  exception when insufficient_privilege then null;
  end;
end;
$$;

do $$
declare
  n integer;
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', '00000000-0000-4000-8000-00000000b001', 'role', 'authenticated')::text,
    true
  );
  select count(*) into n from public.lottery_ledgers where agency_id = 'quiniela-b';
  if n > 0 then
    raise exception 'FUGA: un dueño lee la quiniela de otra agencia';
  end if;
  begin
    insert into public.lottery_ledgers (agency_id, snapshot) values ('quiniela-b', '{"agencyId":"quiniela-b"}');
    raise exception 'FUGA: un dueño crea la quiniela de otra agencia';
  exception when insufficient_privilege or unique_violation then null;
  end;
  update public.lottery_ledgers set version = version + 1 where agency_id = 'quiniela-b';
  get diagnostics n = row_count;
  if n > 0 then
    raise exception 'FUGA: un dueño cambia la quiniela de otra agencia';
  end if;

  insert into public.lottery_ledgers (agency_id, snapshot) values ('quiniela-a', '{"agencyId":"quiniela-a"}');
  begin
    update public.lottery_ledgers set snapshot = '{"agencyId":"quiniela-b"}' where agency_id = 'quiniela-a';
    raise exception 'FUGA: la fila guarda un libro de otra agencia';
  exception when check_violation then null;
  end;
end;
$$;

do $$
declare
  n integer;
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', '00000000-0000-4000-8000-00000000b003', 'role', 'authenticated')::text,
    true
  );
  update public.lottery_ledgers set version = version + 1 where agency_id = 'quiniela-a';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'FALLA: el operador no puede cargar la quiniela activada';
  end if;
end;
$$;

reset role;

do $$
begin
  if (select snapshot from public.ledgers where agency_id = 'quiniela-a')
    <> '{"agencyId":"quiniela-a","month":"2026-10","days":[],"deposits":[],"expenses":[],"openingBalances":[]}'::jsonb then
    raise exception 'FUGA: la quiniela cambió el libro de hípica';
  end if;
end;
$$;

rollback;

select 'Quiniela aislada: sin sesión no se ve, otra agencia no la toca, el operador no la activa y la hípica no cambió.' as resultado;
