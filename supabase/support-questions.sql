-- Questions people leave when the FAQ does not answer them, from /entrada or Ayuda.
-- Anyone can leave one. Only a profile with can_create_agencies reads them and
-- marks them answered. Nobody deletes them from the app.
-- Run this in the SQL editor after agencies.sql. Safe to run again.
-- Keep the limits aligned with src/modules/support/support-question.ts.

create table if not exists public.support_questions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null default '' check (char_length(name) <= 80),
  phone text not null check (char_length(phone) between 8 and 30),
  question text not null check (char_length(question) between 5 and 1000),
  source text not null default 'entrada' check (source in ('entrada', 'ayuda')),
  user_id uuid references auth.users (id) on delete set null,
  agency_id text references public.agencies (agency_id),
  answered_at timestamptz,
  answered_by uuid references auth.users (id) on delete set null
);

create index if not exists support_questions_created_at_idx
  on public.support_questions (created_at desc);

alter table public.support_questions enable row level security;

create or replace function public.caller_can_create_agencies()
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
      and can_create_agencies = true
  );
$$;

revoke all on function public.caller_can_create_agencies() from public, anon, authenticated;
grant execute on function public.caller_can_create_agencies() to authenticated;

revoke all on public.support_questions from anon, authenticated;
grant insert on public.support_questions to anon, authenticated;
grant select, update on public.support_questions to authenticated;

-- Without a session: no user and no agency.
drop policy if exists support_questions_insert_anon on public.support_questions;
create policy support_questions_insert_anon
  on public.support_questions
  for insert
  to anon
  with check (
    user_id is null
    and agency_id is null
    and answered_at is null
    and answered_by is null
  );

-- With a session: only as yourself, and only for an agency you can use.
drop policy if exists support_questions_insert_signed_in on public.support_questions;
create policy support_questions_insert_signed_in
  on public.support_questions
  for insert
  to authenticated
  with check (
    (user_id is null or user_id = auth.uid())
    and (agency_id is null or public.caller_can_use_agency(agency_id))
    and answered_at is null
    and answered_by is null
  );

drop policy if exists support_questions_select_creators on public.support_questions;
create policy support_questions_select_creators
  on public.support_questions
  for select
  to authenticated
  using (public.caller_can_create_agencies());

drop policy if exists support_questions_update_creators on public.support_questions;
create policy support_questions_update_creators
  on public.support_questions
  for update
  to authenticated
  using (public.caller_can_create_agencies())
  with check (public.caller_can_create_agencies());
