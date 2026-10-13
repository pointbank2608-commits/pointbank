-- 071: 선생님 "지금 수업 현황" — 지금 개별수업을 하고 있는 학생과 어느 단계(그룹·문제 종류)인지 보여 준다.
-- 최근 p_minutes 분 안에 움직임(답·넘김)이 있고 아직 안 끝낸 개별수업만. 반을 고르면 그 반 학생만.
-- 읽기 전용이고 선생님(자기 학원)만 부를 수 있다.

create or replace function public.solo_live(p_class uuid default null, p_minutes int default 20)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
  v_min int := greatest(1, least(coalesce(p_minutes, 20), 240));
begin
  return coalesce((
    select jsonb_agg(row_to_json(r) order by r.last_at desc)
      from (
        select a.id as assignment_id, s.id as student_id, s.name, l.name as lesson_name, a.kind,
               a.progress, jsonb_array_length(l.steps) as total,
               l.steps -> least(a.progress, greatest(jsonb_array_length(l.steps) - 1, 0)) ->> 't' as step_type,
               (select x.step ->> 'title'
                  from jsonb_array_elements(l.steps) with ordinality as x(step, n)
                 where n - 1 <= least(a.progress, greatest(jsonb_array_length(l.steps) - 1, 0))
                   and x.step ->> 't' = 'intro' and x.step ->> 'title' ~ '^[0-9]+\.\s'
                 order by n desc limit 1) as stage_title,
               coalesce(ev.last_at, a.started_at) as last_at,
               (a.help_at is not null and a.help_at > now() - interval '40 minutes') as help
          from public.solo_assignments a
          join public.students s on s.id = a.student_id and s.archived_at is null
          join public.solo_lessons l on l.id = a.lesson_id
          left join (
            select e.assignment_id, max(e.created_at) as last_at
              from public.solo_step_events e
             where e.created_at > now() - make_interval(mins => v_min)
             group by e.assignment_id
          ) ev on ev.assignment_id = a.id
         where a.academy_id = v_academy
           and a.finished_at is null
           and a.started_at is not null
           and (p_class is null or s.class_id = p_class)
           and coalesce(ev.last_at, a.started_at) > now() - make_interval(mins => v_min)
      ) r
  ), '[]'::jsonb);
end $$;

revoke all on function public.solo_live(uuid, int) from public, anon, authenticated;
grant execute on function public.solo_live(uuid, int) to authenticated;
