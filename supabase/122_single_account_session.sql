-- Rollout: apply 121_remote_qr_pairing.sql, deploy the QR client, and verify a
-- signed-out phone can control the board before applying this migration.
-- In staging, also check two browsers on the same account, admin MFA, and
-- signed-out student links. 122_rollback.sql disables only single-session enforcement.
begin;

create schema if not exists private;

create table private.classbank_account_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_id uuid not null,
  created_at timestamptz not null
);
revoke all on private.classbank_account_sessions from public, anon, authenticated;

create function private.classbank_record_session()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into private.classbank_account_sessions as current_session (user_id, session_id, created_at)
  values (new.user_id, new.id, coalesce(new.created_at, transaction_timestamp()))
  on conflict (user_id) do update
    set session_id = excluded.session_id, created_at = excluded.created_at
    where (current_session.created_at, current_session.session_id)
        < (excluded.created_at, excluded.session_id);
  return new;
end;
$$;
revoke all on function private.classbank_record_session() from public, anon, authenticated;

-- Insertion is a new login. Refresh and MFA update the same session.
create trigger classbank_record_session after insert on auth.sessions
for each row execute function private.classbank_record_session();

insert into private.classbank_account_sessions (user_id, session_id, created_at)
select distinct on (user_id) user_id, id, coalesce(created_at, '-infinity'::timestamptz)
from auth.sessions
order by user_id, created_at desc nulls last, id desc;

create or replace function private.classbank_session_matches(p_user uuid, p_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select from private.classbank_account_sessions active
    join auth.sessions s on s.id = active.session_id and s.user_id = active.user_id
    where active.user_id = p_user and active.session_id = p_session
  );
$$;
revoke all on function private.classbank_session_matches(uuid, uuid) from public, anon, authenticated;

create or replace function public.classbank_current_session()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.classbank_session_matches(auth.uid(), (auth.jwt()->>'session_id')::uuid);
$$;
revoke all on function public.classbank_current_session() from public, anon, authenticated;
grant execute on function public.classbank_current_session() to authenticated;

create or replace function public.classbank_check_request()
returns void language plpgsql stable set search_path = '' as $$
begin
  if current_user <> 'authenticated' then return; end if;
  if not public.classbank_current_session() then
    raise sqlstate 'PT409' using message = 'classbank_session_replaced';
  end if;
end;
$$;
revoke all on function public.classbank_check_request() from public;
grant execute on function public.classbank_check_request() to anon, authenticated, service_role, authenticator;

do $$
begin
  if exists (
    select from pg_catalog.pg_db_role_setting s
    cross join lateral unnest(s.setconfig) as setting(value)
    where s.setrole in (0, 'authenticator'::regrole)
      and (s.setdatabase = 0 or s.setdatabase = (select oid from pg_catalog.pg_database where datname = current_database()))
      and setting.value like 'pgrst.db_pre_request=%'
  ) then
    raise exception 'An existing PostgREST pre-request hook must be composed with classbank_check_request';
  end if;
end;
$$;

alter role authenticator set pgrst.db_pre_request = 'public.classbank_check_request';

-- Storage and Realtime Postgres Changes do their own RLS checks.
create policy classbank_current_session on storage.objects as restrictive
for all to authenticated using ((select public.classbank_current_session()))
with check ((select public.classbank_current_session()));

do $$
declare
  target record;
begin
  for target in
    select schemaname, tablename from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
  loop
    execute format(
      'create policy classbank_current_session on %I.%I as restrictive for select to authenticated using ((select public.classbank_current_session()))',
      target.schemaname, target.tablename
    );
  end loop;
end;
$$;

notify pgrst, 'reload config';
notify pgrst, 'reload schema';
commit;
