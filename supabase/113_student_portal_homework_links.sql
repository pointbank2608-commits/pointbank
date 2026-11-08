-- Resolve a shared homework code through the student portal.
begin;

create or replace function public.student_login_for_homework(
  p_homework_code text, p_name text, p_phone text, p_device text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  academy_code text;
begin
  select a.student_code into academy_code
  from public.homework_assignments h
  join public.academies a on a.id = h.academy_id
  where h.code = btrim(p_homework_code)
  order by (h.closed_at is null) desc, h.created_at desc, h.id
  limit 1;

  if academy_code is null then
    return jsonb_build_object('error', 'bad_login');
  end if;
  return public.student_login(academy_code, p_name, p_phone, p_device);
end $$;

create or replace function public.student_open_homework(p_token uuid, p_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  student uuid := public.student_session_student(p_token);
  target_access text;
  academy uuid;
begin
  select g.access_token, h.academy_id into target_access, academy
  from public.homework_assignment_targets g
  join public.homework_assignments h on h.id = g.assignment_id
  join public.students s on s.id = g.student_id and s.academy_id = h.academy_id
  where h.code = btrim(p_code) and g.student_id = student
  order by (h.closed_at is null) desc, h.created_at desc, h.id
  limit 1;

  if target_access is null then
    return jsonb_build_object('error', 'not_found');
  end if;
  if not public.academy_feature(academy, 'homework') then
    return jsonb_build_object('error', 'feature_closed');
  end if;
  return public.hw_open_personal(target_access);
end $$;

revoke all on function public.student_login_for_homework(text,text,text,text), public.student_open_homework(uuid,text) from public, anon, authenticated;
grant execute on function public.student_login_for_homework(text,text,text,text), public.student_open_homework(uuid,text) to anon, authenticated;

commit;
