-- 068: 학생 "내 도장 달력" — 학생 포털(/s)에서 자기가 끝낸 숙제(온라인 숙제 + 개별수업 숙제)를 날짜별로 본다.
-- 기기 열쇠(045 student_sessions)로만 접근하고, 학생 본인의 기록만 돌려준다. 날짜는 한국 시간 기준.

create or replace function public.student_stamps(p_token uuid, p_from date, p_to date)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_sid uuid;
begin
  begin
    v_sid := public.student_session_student(p_token);
  exception when others then
    return jsonb_build_object('error', 'expired');
  end;
  return coalesce((
    select jsonb_agg(jsonb_build_object('day', x.d, 'title', x.title) order by x.d)
      from (
        select (at.finished_at at time zone 'Asia/Seoul')::date as d, h.title as title
          from public.homework_attempts at
          join public.homework_assignments h on h.id = at.assignment_id
         where at.student_id = v_sid and at.finished_at is not null
           and (at.finished_at at time zone 'Asia/Seoul')::date between p_from and p_to
        union all
        select (sa.finished_at at time zone 'Asia/Seoul')::date, sl.name
          from public.solo_assignments sa
          join public.solo_lessons sl on sl.id = sa.lesson_id
         where sa.student_id = v_sid and sa.kind = 'homework' and sa.finished_at is not null
           and (sa.finished_at at time zone 'Asia/Seoul')::date between p_from and p_to
      ) x
  ), '[]'::jsonb);
end $$;

revoke all on function public.student_stamps(uuid, date, date) from public, anon, authenticated;
grant execute on function public.student_stamps(uuid, date, date) to anon, authenticated;
