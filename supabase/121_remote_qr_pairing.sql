-- Deploy this before the QR client. Legacy rows retain their existing owner-only access.
begin;
create schema if not exists private;

-- Replaced by 122 when single-session enforcement is enabled.
create function private.classbank_session_matches(p_user uuid, p_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select from auth.sessions where id = p_session and user_id = p_user);
$$;
revoke all on function private.classbank_session_matches(uuid, uuid) from public, anon, authenticated;

alter table public.remote_sessions
  add column pairing_key uuid,
  add column host_session_id uuid,
  add column paired_class_id uuid,
  add column pairing_expires_at timestamptz,
  add column board_seen_at timestamptz not null default now();

create function private.classbank_remote_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.board_seen_at := now();
  return new;
end;
$$;
revoke all on function private.classbank_remote_touch() from public, anon, authenticated;
create trigger classbank_remote_touch before update of state on public.remote_sessions
for each row execute function private.classbank_remote_touch();

create table private.classbank_remote_point_requests (
  remote_id uuid not null references public.remote_sessions(id) on delete cascade,
  request_id uuid not null,
  result integer not null,
  primary key (remote_id, request_id)
);
alter table private.classbank_remote_point_requests enable row level security;
revoke all on private.classbank_remote_point_requests from public, anon, authenticated;

create function public.remote_qr_open(p_class uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  host public.profiles;
  host_session uuid := (auth.jwt()->>'session_id')::uuid;
  remote public.remote_sessions;
begin
  select * into host from public.profiles where id = auth.uid() and role in ('owner', 'teacher');
  if host.id is null or not private.classbank_session_matches(host.id, host_session)
    or (p_class is not null and not exists (
      select from public.classes where id = p_class and academy_id = host.academy_id
    )) then
    raise sqlstate '42501' using message = 'remote_unavailable';
  end if;

  delete from public.remote_sessions where user_id = host.id and created_at < now() - interval '1 day';
  insert into public.remote_sessions (user_id, pairing_key, host_session_id, paired_class_id, pairing_expires_at)
  values (host.id, gen_random_uuid(), host_session, p_class, now() + interval '6 hours')
  returning * into remote;
  return jsonb_build_object('id', remote.id, 'key', remote.pairing_key);
end;
$$;
revoke all on function public.remote_qr_open(uuid) from public, anon, authenticated;
grant execute on function public.remote_qr_open(uuid) to authenticated;

-- This lookup is private. The phone can only use the narrow RPCs below.
create function private.classbank_remote_pair(p_id uuid, p_key uuid)
returns public.remote_sessions language sql stable security definer set search_path = '' as $$
  select r.* from public.remote_sessions r
  join public.profiles p on p.id = r.user_id and p.role in ('owner', 'teacher')
  where r.id = p_id and r.pairing_key = p_key and r.pairing_expires_at > now()
    and r.board_seen_at > now() - interval '2 minutes'
    and private.classbank_session_matches(r.user_id, r.host_session_id);
$$;
revoke all on function private.classbank_remote_pair(uuid, uuid) from public, anon, authenticated;

create function public.remote_qr_poll(p_id uuid, p_key uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('state', r.state, 'updated_at', r.updated_at)
  from private.classbank_remote_pair(p_id, p_key) r where r.id is not null;
$$;
revoke all on function public.remote_qr_poll(uuid, uuid) from public, anon, authenticated;
grant execute on function public.remote_qr_poll(uuid, uuid) to anon;

create function public.remote_qr_send(p_id uuid, p_key uuid, p_name text, p_arg integer, p_action text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_name not in ('next', 'prev', 'goto', 'exit', 'action') or p_name is null then
    return false;
  end if;
  update public.remote_sessions r set cmd = jsonb_strip_nulls(jsonb_build_object(
    'seq', coalesce((r.cmd->>'seq')::bigint, 0) + 1, 'name', p_name, 'arg', p_arg, 'id', p_action
  )), updated_at = now()
  where r.id = (private.classbank_remote_pair(p_id, p_key)).id and r.state->>'ended' = 'false'
    and (p_name <> 'goto' or p_arg >= 0 and p_arg < jsonb_array_length(r.state->'steps'))
    and (p_name <> 'action' or r.state->'actions' @> jsonb_build_array(jsonb_build_object('id', p_action)));
  return found;
end;
$$;
revoke all on function public.remote_qr_send(uuid, uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.remote_qr_send(uuid, uuid, text, integer, text) to anon;

create function public.remote_qr_points(p_id uuid, p_key uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'unit', a.point_unit,
    'locked', exists (select from public.settlements where class_id = c.id and settled_on = (now() at time zone 'Asia/Seoul')::date),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'today', coalesce((
        select sum(t.delta) from public.transactions t where t.student_id = s.id and t.class_id = c.id
          and t.created_at >= date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'
      ), 0)) order by s.name)
      from public.students s where s.class_id = c.id and s.academy_id = a.id and s.archived_at is null
    ), '[]'::jsonb),
    'presets', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'label', p.label, 'delta', p.delta) order by p.sort_order, p.created_at)
      from public.presets p where p.academy_id = a.id
    ), '[]'::jsonb)
  )
  from private.classbank_remote_pair(p_id, p_key) r
  join public.profiles host on host.id = r.user_id
  join public.classes c on c.id = r.paired_class_id and c.academy_id = host.academy_id
  join public.academies a on a.id = c.academy_id
  where r.state->>'ended' = 'false' and r.state->>'classId' = c.id::text;
$$;
revoke all on function public.remote_qr_points(uuid, uuid) from public, anon, authenticated;
grant execute on function public.remote_qr_points(uuid, uuid) to anon;

create function public.remote_qr_give(
  p_id uuid, p_key uuid, p_request uuid, p_preset uuid, p_students uuid[]
)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  remote public.remote_sessions;
  host public.profiles;
  preset public.presets;
  result integer;
begin
  select r.* into remote from public.remote_sessions r
  where r.id = (private.classbank_remote_pair(p_id, p_key)).id for update;
  if remote.id is null or remote.state->>'ended' is distinct from 'false'
    or remote.paired_class_id is null or remote.state->>'classId' is distinct from remote.paired_class_id::text
    or p_request is null or coalesce(cardinality(p_students), 0) = 0 then
    raise sqlstate '42501' using message = 'remote_unavailable';
  end if;

  select rq.result into result from private.classbank_remote_point_requests rq
  where rq.remote_id = remote.id and rq.request_id = p_request;
  if found then return result; end if;

  select * into host from public.profiles where id = remote.user_id and role in ('owner', 'teacher');
  select * into preset from public.presets where id = p_preset and academy_id = host.academy_id;
  if preset.id is null or not exists (
    select from public.classes where id = remote.paired_class_id and academy_id = host.academy_id
  ) or exists (
    select from public.settlements where class_id = remote.paired_class_id
      and settled_on = (now() at time zone 'Asia/Seoul')::date
  ) then
    raise sqlstate '42501' using message = 'remote_points_unavailable';
  end if;

  insert into public.transactions (academy_id, class_id, student_id, delta, reason, created_by, created_by_name, is_homework)
  select host.academy_id, remote.paired_class_id, s.id, preset.delta, preset.label,
    host.id, coalesce(host.display_name, ''), preset.is_homework
  from public.students s
  where s.id = any(p_students) and s.class_id = remote.paired_class_id
    and s.academy_id = host.academy_id and s.archived_at is null;
  get diagnostics result = row_count;
  if result <> cardinality(p_students) then
    raise sqlstate '42501' using message = 'remote_points_unavailable';
  end if;

  insert into private.classbank_remote_point_requests values (remote.id, p_request, result);
  return result;
end;
$$;
revoke all on function public.remote_qr_give(uuid, uuid, uuid, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.remote_qr_give(uuid, uuid, uuid, uuid, uuid[]) to anon;

notify pgrst, 'reload schema';
commit;
