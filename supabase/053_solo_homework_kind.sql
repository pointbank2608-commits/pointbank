-- 053: 개별수업을 "오늘의 수업" 또는 "숙제"로 낸다 + 끝낸 학생에게 포인트 주기
-- 실행 순서: 이 파일 하나. 끝의 select 가 true 여야 한다.

alter table public.solo_assignments add column if not exists kind text not null default 'lesson';
alter table public.solo_assignments drop constraint if exists solo_assignments_kind_check;
alter table public.solo_assignments add constraint solo_assignments_kind_check check (kind in ('lesson', 'homework'));
alter table public.solo_assignments add column if not exists rewarded_at timestamptz;

-- 낼 때 종류를 고른다(옛 3칸 호출도 그대로 동작: 종류 기본값 lesson)
drop function if exists public.solo_assign(uuid, uuid[], timestamptz);
create or replace function public.solo_assign(p_lesson uuid, p_students uuid[], p_due timestamptz default null, p_kind text default 'lesson')
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
  v_n int;
  v_kind text := case when p_kind = 'homework' then 'homework' else 'lesson' end;
begin
  if not exists (select 1 from public.solo_lessons where id = p_lesson and academy_id = v_academy) then
    raise exception 'not_found';
  end if;
  insert into public.solo_assignments (academy_id, lesson_id, student_id, due_at, kind)
  select v_academy, p_lesson, s.id, p_due, v_kind
    from public.students s
   where s.academy_id = v_academy and s.archived_at is null and s.id = any (p_students)
  on conflict (lesson_id, student_id) do update
    set due_at = coalesce(excluded.due_at, public.solo_assignments.due_at),
        kind = excluded.kind;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- 현황에 종류·포인트 받음을 더한다
create or replace function public.solo_status(p_lesson uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
begin
  if not exists (select 1 from public.solo_lessons where id = p_lesson and academy_id = v_academy) then
    raise exception 'not_found';
  end if;
  return coalesce((
    select jsonb_agg(row_to_json(r) order by r.name)
      from (
        select a.id as assignment_id, s.id as student_id, s.name,
               a.progress, jsonb_array_length(l.steps) as total,
               a.started_at, a.finished_at, a.due_at, a.kind, (a.rewarded_at is not null) as rewarded,
               count(*) filter (where e.kind = 'answer' and e.correct is true) as right_count,
               count(*) filter (where e.kind = 'answer' and e.correct is false) as wrong_count,
               count(*) filter (where e.kind = 'unsure') as unsure_count,
               coalesce(array_agg(distinct e.step_index + 1) filter (where e.kind = 'unsure'), '{}') as unsure_steps
          from public.solo_assignments a
          join public.solo_lessons l on l.id = a.lesson_id
          join public.students s on s.id = a.student_id
          left join public.solo_step_events e on e.assignment_id = a.id
         where a.lesson_id = p_lesson
         group by a.id, s.id, s.name, l.steps
      ) r
  ), '[]'::jsonb);
end $$;

-- 학생 목록에 종류를 더한다(학생 홈이 "숙제" 표시)
create or replace function public.solo_list(p_token uuid)
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
    select jsonb_agg(jsonb_build_object(
             'id', a.id, 'name', l.name, 'minutes', l.minutes, 'progress', a.progress,
             'total', jsonb_array_length(l.steps), 'done', a.finished_at is not null, 'due_at', a.due_at,
             'kind', a.kind
           ) order by (a.finished_at is not null), a.assigned_at desc)
      from public.solo_assignments a
      join public.solo_lessons l on l.id = a.lesson_id
     where a.student_id = v_sid
  ), '[]'::jsonb);
end $$;

-- 끝낸 학생에게 통장 포인트를 한 번만 준다(그날 반 통장이 마감됐으면 막음)
create or replace function public.solo_reward(p_lesson uuid, p_preset uuid, p_students uuid[], p_today date)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
  v_p public.presets;
  v_name text;
  v_given int := 0;
  v_locked boolean := false;
  r record;
begin
  if not exists (select 1 from public.solo_lessons where id = p_lesson and academy_id = v_academy) then
    raise exception 'not_found';
  end if;
  select * into v_p from public.presets where id = p_preset and academy_id = v_academy;
  if v_p.id is null then
    raise exception 'no_preset';
  end if;
  select display_name into v_name from public.profiles where id = auth.uid();
  for r in
    select a.id as assignment_id, s.id as student_id, s.class_id
      from public.solo_assignments a
      join public.students s on s.id = a.student_id and s.archived_at is null
     where a.lesson_id = p_lesson and a.finished_at is not null and a.rewarded_at is null
       and a.student_id = any (p_students)
     for update of a
  loop
    if exists (select 1 from public.settlements where class_id = r.class_id and settled_on = p_today) then
      v_locked := true;
      continue;
    end if;
    insert into public.transactions (academy_id, class_id, student_id, delta, reason, created_by, created_by_name, is_homework)
    values (v_academy, r.class_id, r.student_id, v_p.delta, v_p.label, auth.uid(), coalesce(v_name, ''), v_p.is_homework);
    update public.solo_assignments set rewarded_at = now() where id = r.assignment_id;
    v_given := v_given + 1;
  end loop;
  return jsonb_build_object('given', v_given, 'locked', v_locked and v_given = 0);
end $$;

revoke all on function public.solo_assign(uuid, uuid[], timestamptz, text) from public, anon, authenticated;
revoke all on function public.solo_status(uuid) from public, anon, authenticated;
revoke all on function public.solo_list(uuid) from public, anon, authenticated;
revoke all on function public.solo_reward(uuid, uuid, uuid[], date) from public, anon, authenticated;
grant execute on function public.solo_assign(uuid, uuid[], timestamptz, text) to authenticated;
grant execute on function public.solo_status(uuid) to authenticated;
grant execute on function public.solo_reward(uuid, uuid, uuid[], date) to authenticated;

-- 확인(읽기 전용): 모두 true 여야 한다
select
  exists (select 1 from information_schema.columns where table_name = 'solo_assignments' and column_name = 'kind') as has_kind,
  exists (select 1 from information_schema.columns where table_name = 'solo_assignments' and column_name = 'rewarded_at') as has_rewarded,
  exists (select 1 from pg_proc where proname = 'solo_reward') as has_reward_fn,
  (select count(*) from pg_proc where proname = 'solo_assign') = 1 as one_assign_fn;
