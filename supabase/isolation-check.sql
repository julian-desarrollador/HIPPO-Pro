-- Checks that agencies cannot read or change each other's book, people,
-- names, day photos or deposit photos, and that nothing opens without a session.
-- Run it in the SQL editor after agencies.sql, close-ledger.sql,
-- day-photos.sql and deposit-photos.sql, and again after any change to a policy.
-- Everything runs inside one transaction that is rolled back: the test
-- users, agencies, books and photos never stay. A leak stops the run with
-- an error that starts with FUGA. The last line says it passed.

begin;

-- Test data, written as the database owner.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000a001', 'aislamiento-a@example.invalid'),
  ('00000000-0000-4000-8000-00000000a002', 'aislamiento-b@example.invalid'),
  ('00000000-0000-4000-8000-00000000a003', 'aislamiento-c@example.invalid');

insert into public.agencies (agency_id, name) values
  ('aislamiento-a', 'Prueba A'),
  ('aislamiento-b', 'Prueba B'),
  ('aislamiento-c', 'Prueba C');

insert into public.profiles (user_id, agency_id, role, display_name, email) values
  ('00000000-0000-4000-8000-00000000a001', 'aislamiento-a', 'owner', 'Prueba A', 'aislamiento-a@example.invalid'),
  ('00000000-0000-4000-8000-00000000a002', 'aislamiento-b', 'owner', 'Prueba B', 'aislamiento-b@example.invalid');

insert into public.ledgers (agency_id, snapshot) values
  ('aislamiento-a', '{"agencyId":"aislamiento-a","month":"2026-10","days":[],"deposits":[],"expenses":[],"openingBalances":[]}'),
  ('aislamiento-b', '{"agencyId":"aislamiento-b","month":"2026-10","days":[],"deposits":[],"expenses":[],"openingBalances":[]}');

insert into storage.objects (bucket_id, name) values
  ('day-photos', 'aislamiento-a/dia'),
  ('day-photos', 'aislamiento-b/dia'),
  ('deposit-photos', 'aislamiento-a/deposito'),
  ('deposit-photos', 'aislamiento-b/deposito');

-- A profile or a book cannot point to an agency that does not exist.
do $$
begin
  begin
    insert into public.profiles (user_id, agency_id, role)
    values ('00000000-0000-4000-8000-00000000a003', 'aislamiento-inexistente', 'owner');
    raise exception 'FUGA: se guardó un perfil de una agencia que no existe';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.ledgers (agency_id, snapshot) values ('aislamiento-inexistente', '{}');
    raise exception 'FUGA: se guardó un libro de una agencia que no existe';
  exception when foreign_key_violation then null;
  end;
end;
$$;

-- Without a session.
set local role anon;

do $$
declare
  n integer;
begin
  begin
    select count(*) into n from public.ledgers;
    if n <> 0 then
      raise exception 'FUGA: sin sesión se leen % libros', n;
    end if;
  exception when insufficient_privilege then null;
  end;
  begin
    select count(*) into n from public.profiles;
    if n <> 0 then
      raise exception 'FUGA: sin sesión se leen % perfiles', n;
    end if;
  exception when insufficient_privilege then null;
  end;
  begin
    select count(*) into n from public.agencies;
    if n <> 0 then
      raise exception 'FUGA: sin sesión se leen % agencias', n;
    end if;
  exception when insufficient_privilege then null;
  end;
  begin
    select count(*) into n from storage.objects where bucket_id = 'day-photos';
    if n <> 0 then
      raise exception 'FUGA: sin sesión se ven % imágenes', n;
    end if;
  exception when insufficient_privilege then null;
  end;
  begin
    select count(*) into n from storage.objects where bucket_id = 'deposit-photos';
    if n <> 0 then
      raise exception 'FUGA: sin sesión se ven % imágenes de depósitos', n;
    end if;
  exception when insufficient_privilege then null;
  end;
  begin
    update public.ledgers set version = version + 1;
    get diagnostics n = row_count;
    if n <> 0 then
      raise exception 'FUGA: sin sesión se modifican % libros', n;
    end if;
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- Each test owner, signed in, against the other agency.
set local role authenticated;

do $$
declare
  pair record;
  n integer;
begin
  for pair in
    select * from (values
      ('00000000-0000-4000-8000-00000000a001'::uuid, 'aislamiento-a', 'aislamiento-b'),
      ('00000000-0000-4000-8000-00000000a002'::uuid, 'aislamiento-b', 'aislamiento-a')
    ) as people (me, mine, other)
  loop
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', pair.me, 'role', 'authenticated')::text,
      true
    );

    -- Its own agency works, so the checks below are not passing by accident.
    select count(*) into n from public.ledgers where agency_id = pair.mine;
    if n <> 1 then
      raise exception 'La prueba no anda: % no ve su propio libro', pair.mine;
    end if;
    update public.ledgers set version = version + 1 where agency_id = pair.mine;
    get diagnostics n = row_count;
    if n <> 1 then
      raise exception 'La prueba no anda: % no puede guardar su libro', pair.mine;
    end if;

    -- Books.
    select count(*) into n from public.ledgers where agency_id <> pair.mine;
    if n <> 0 then
      raise exception 'FUGA: % lee % libros de otras agencias', pair.mine, n;
    end if;
    update public.ledgers set version = version + 1 where agency_id = pair.other;
    get diagnostics n = row_count;
    if n <> 0 then
      raise exception 'FUGA: % modifica el libro de %', pair.mine, pair.other;
    end if;
    begin
      insert into public.ledgers (agency_id, snapshot) values ('aislamiento-c', '{}');
      raise exception 'FUGA: % crea el libro de otra agencia', pair.mine;
    exception when insufficient_privilege then null;
    end;
    begin
      update public.ledgers set agency_id = 'aislamiento-c' where agency_id = pair.mine;
      raise exception 'FUGA: % pasa su libro a otra agencia', pair.mine;
    exception when insufficient_privilege then null;
    end;

    -- People.
    select count(*) into n from public.profiles where agency_id <> pair.mine;
    if n <> 0 then
      raise exception 'FUGA: % lee % perfiles de otras agencias', pair.mine, n;
    end if;
    begin
      update public.profiles set agency_id = pair.other where user_id = pair.me;
      get diagnostics n = row_count;
      if n <> 0 then
        raise exception 'FUGA: % se cambia de agencia', pair.mine;
      end if;
    exception when insufficient_privilege then null;
    end;
    begin
      update public.profiles set can_create_agencies = true where user_id = pair.me;
      get diagnostics n = row_count;
      if n <> 0 then
        raise exception 'FUGA: % se da permiso para crear agencias', pair.mine;
      end if;
    exception when insufficient_privilege then null;
    end;
    begin
      insert into public.profiles (user_id, agency_id, role)
      values ('00000000-0000-4000-8000-00000000a003', pair.other, 'owner');
      raise exception 'FUGA: % mete una persona en %', pair.mine, pair.other;
    exception when insufficient_privilege then null;
    end;

    -- Agency names.
    select count(*) into n from public.agencies where agency_id <> pair.mine;
    if n <> 0 then
      raise exception 'FUGA: % lee % agencias ajenas', pair.mine, n;
    end if;
    begin
      update public.agencies set name = 'Cambiada' where agency_id = pair.other;
      get diagnostics n = row_count;
      if n <> 0 then
        raise exception 'FUGA: % cambia el nombre de %', pair.mine, pair.other;
      end if;
    exception when insufficient_privilege then null;
    end;
    begin
      insert into public.agencies (agency_id, name) values ('aislamiento-nueva', 'Nueva');
      raise exception 'FUGA: % crea una agencia sin la función', pair.mine;
    exception when insufficient_privilege then null;
    end;

    -- Day photos.
    select count(*) into n from storage.objects
    where bucket_id = 'day-photos' and name = pair.mine || '/dia';
    if n <> 1 then
      raise exception 'La prueba no anda: % no ve su propia imagen', pair.mine;
    end if;
    select count(*) into n from storage.objects
    where bucket_id = 'day-photos' and (storage.foldername(name))[1] is distinct from pair.mine;
    if n <> 0 then
      raise exception 'FUGA: % ve % imágenes de otras agencias', pair.mine, n;
    end if;
    begin
      insert into storage.objects (bucket_id, name) values ('day-photos', pair.other || '/intruso');
      raise exception 'FUGA: % sube una imagen en la carpeta de %', pair.mine, pair.other;
    exception when insufficient_privilege then null;
    end;
    update storage.objects set name = pair.mine || '/robada'
    where bucket_id = 'day-photos' and name = pair.other || '/dia';
    get diagnostics n = row_count;
    if n <> 0 then
      raise exception 'FUGA: % se lleva la imagen de %', pair.mine, pair.other;
    end if;

    -- Deposit photos.
    select count(*) into n from storage.objects
    where bucket_id = 'deposit-photos' and name = pair.mine || '/deposito';
    if n <> 1 then
      raise exception 'La prueba no anda: % no ve su propia imagen de depósito', pair.mine;
    end if;
    select count(*) into n from storage.objects
    where bucket_id = 'deposit-photos' and (storage.foldername(name))[1] is distinct from pair.mine;
    if n <> 0 then
      raise exception 'FUGA: % ve % imágenes de depósito de otras agencias', pair.mine, n;
    end if;
    begin
      insert into storage.objects (bucket_id, name) values ('deposit-photos', pair.other || '/intruso');
      raise exception 'FUGA: % sube una imagen de depósito en la carpeta de %', pair.mine, pair.other;
    exception when insufficient_privilege then null;
    end;
    update storage.objects set name = pair.mine || '/robada-deposito'
    where bucket_id = 'deposit-photos' and name = pair.other || '/deposito';
    get diagnostics n = row_count;
    if n <> 0 then
      raise exception 'FUGA: % se lleva la imagen de depósito de %', pair.mine, pair.other;
    end if;
  end loop;
end;
$$;

rollback;

select 'Aislamiento correcto: ninguna agencia lee ni toca lo de otra, y sin sesión no se ve nada.' as resultado;
