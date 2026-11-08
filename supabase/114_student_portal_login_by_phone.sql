begin;

create index if not exists students_portal_active_name_idx
  on public.students (public.sp_name_key(name)) where archived_at is null;

create or replace function public.student_login_by_phone(
  p_name text, p_phone text, p_device text default null
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  name_key text := public.sp_name_key(p_name);
  digits text := public.sp_phone_digits(p_phone);
  failure_key text;
  matches uuid[];
  session_token uuid;
begin
  if length(name_key) not between 1 and 100 or length(digits) not between 10 and 11 then
    return jsonb_build_object('error', 'bad_login');
  end if;

  failure_key := 'portal-phone:' || encode(extensions.digest(name_key, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(failure_key, 0));
  if (select count(*) from public.student_login_failures
      where fail_key = failure_key and failed_at > now() - interval '10 minutes') >= 8 then
    return jsonb_build_object('error', 'locked');
  end if;

  select array(
    select s.id
    from public.students s
    join public.student_guardian g on g.student_id = s.id
    where s.archived_at is null and public.sp_name_key(s.name) = name_key
      and case when g.phone_last4 = right(digits, 4)
        then extensions.crypt(digits, g.phone_hash) = g.phone_hash else false end
    limit 2
  ) into matches;

  if cardinality(matches) <> 1 then
    insert into public.student_login_failures (fail_key) values (failure_key);
    return jsonb_build_object('error', case when cardinality(matches) = 2
      then 'ambiguous_login' else 'bad_login' end);
  end if;

  insert into public.student_sessions (student_id, device)
  values (matches[1], left(p_device, 120)) returning token into session_token;
  return jsonb_build_object('token', session_token);
end $$;

revoke all on function public.student_login_by_phone(text,text,text) from public, anon, authenticated;
grant execute on function public.student_login_by_phone(text,text,text) to anon, authenticated;

commit;
