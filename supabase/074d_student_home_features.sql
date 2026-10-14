-- 074: 학생 홈 — 닫힌 기능(개별수업·숙제)은 목록을 비우고, 어떤 기능이 닫혔는지(features)를 같이 준다.

create or replace function public.student_home(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare
  v_sid uuid;
  v_academy uuid;
  v_solo boolean;
  v_hw boolean;
  v_out jsonb;
begin
  begin
    v_sid := public.student_session_student(p_token);
  exception when others then
    return jsonb_build_object('error', 'expired');
  end;
  select academy_id into v_academy from public.students where id = v_sid;
  v_solo := public.academy_feature(v_academy, 'solo');
  v_hw := public.academy_feature(v_academy, 'homework');
  select jsonb_build_object(
    'name', st.name,
    'academy', a.name,
    'class_name', c.name,
    'features', jsonb_build_object('solo', v_solo, 'homework', v_hw),
    'lessons', case when v_solo then public.solo_list(p_token) else '[]'::jsonb end,
    'homework', case when not v_hw then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
               'title', h.title, 'due_at', h.due_at, 'access', g.access_token,
               'done', coalesce(t.finished_at is not null, false)
             ) order by h.created_at desc)
        from public.homework_assignment_targets g
        join public.homework_assignments h on h.id = g.assignment_id
        left join public.homework_attempts t on t.assignment_id = h.id and t.student_id = st.id
       where g.student_id = st.id and h.closed_at is null
         and (h.due_at is null or h.due_at > now() - interval '1 day')
         and (g.token_expires_at is null or g.token_expires_at > now())
    ), '[]'::jsonb) end
  ) into v_out
  from public.students st
  join public.academies a on a.id = st.academy_id
  join public.classes c on c.id = st.class_id
  where st.id = v_sid;
  return v_out;
end $fn$;
