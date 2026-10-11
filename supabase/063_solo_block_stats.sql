-- 063: 개별수업 블록 보드에 보여 줄 "이 수업·이 반의 정답률" 읽기 함수.
--
-- (선생님) solo_block_stats(수업, 기간) →
--   steps  : 이 수업을 낸 학생들의 처음 답 — 문제(단계) 번호마다 학생 수·처음 답 수·정답 수
--            (블록 = 같은 종류가 이어진 문제들이라, 앱이 블록 범위로 더한다)
--   skills : 이 수업의 반(반 없는 수업이면 학원 전체) 학생들의 최근 N일 능력별 처음 답 수·정답 수 — 학습 카드와 같은 재료
-- 규칙은 060 과 같다: 처음 답만 점수, "모르겠어요"는 오답, 시험은 문제마다 한 줄. 학생 이름·순위는 내보내지 않는다(합계만).

create or replace function public.solo_block_stats(p_lesson uuid, p_days int default 30)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
  v_l public.solo_lessons;
  v_days int := case when p_days in (30, 90) then p_days else 30 end;
  v_from timestamptz := now() - make_interval(days => v_days);
begin
  select * into v_l from public.solo_lessons where id = p_lesson and academy_id = v_academy;
  if v_l.id is null then
    raise exception 'not_found';
  end if;
  return jsonb_build_object(
    'days', v_days,
    'scope', case when v_l.class_id is null then 'academy' else 'class' end,
    'steps', coalesce((
      select jsonb_agg(jsonb_build_object('step', s.step_index, 'students', s.students, 'n', s.n, 'correct', s.k) order by s.step_index)
        from (
          select f.step_index, count(distinct f.aid) as students, count(*) as n, count(*) filter (where f.ok) as k
            from (
              select e.step_index,
                     a.id as aid,
                     case when e.kind = 'unsure' then false else e.correct end as ok,
                     (t.assignment_id is not null) as is_test,
                     row_number() over (partition by e.assignment_id, e.step_index order by e.id) as rn
                from public.solo_step_events e
                join public.solo_assignments a on a.id = e.assignment_id
                left join public.solo_test_results t on t.assignment_id = e.assignment_id and t.step_index = e.step_index
               where a.lesson_id = p_lesson and e.kind in ('answer', 'unsure') and e.step_type <> 'test'
            ) f
           where (f.is_test or f.rn = 1) and f.ok is not null
           group by f.step_index
        ) s
    ), '[]'::jsonb),
    'skills', coalesce((
      select jsonb_agg(jsonb_build_object('skill', k.skill, 'n', k.n, 'correct', k.c, 'students', k.students) order by k.skill)
        from (
          select ev.skill, count(*) as n, count(*) filter (where ev.correct) as c, count(distinct st.id) as students
            from public.students st
            cross join lateral public.student_skill_events(st.id, v_from) ev
           where st.academy_id = v_academy and st.archived_at is null
             and (v_l.class_id is null or st.class_id = v_l.class_id)
           group by ev.skill
        ) k
    ), '[]'::jsonb)
  );
end $$;

revoke all on function public.solo_block_stats(uuid, int) from public, anon;
grant execute on function public.solo_block_stats(uuid, int) to authenticated;
