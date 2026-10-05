-- ============================================================
-- 042 숙제 → 포인트 통장 연결 + 학부모 리포트 재료 (2026-10-05)
--   1) 숙제를 끝낸 학생에게 통장 프리셋으로 포인트를 한 번에 준다(hw_reward).
--      같은 숙제로 같은 학생에게 두 번 주지 않는다(homework_attempts.rewarded_at).
--      숙제 프리셋(is_homework)이면 지급 기록이 그대로 숙제 캘린더 "완료"가 된다(룰 5 — 별도 입력 없음).
--      그날 반 통장이 마감됐으면 통장 화면과 똑같이 막는다(p_today = 선생님 기기 날짜).
--   2) 결과 화면에 "포인트 받음" 표시(hw_assignment_summary 에 rewarded 추가).
--   3) 학부모 리포트용 기간 숫자(student_report_extras): 출석일·받은 칭찬 포인트·온라인 숙제 수.
--   041 다음에 실행. 다시 실행해도 안전하다.
-- ============================================================

alter table public.homework_attempts add column if not exists rewarded_at timestamptz;

create or replace function public.hw_reward(p_assignment_id uuid, p_preset_id uuid, p_student_ids uuid[], p_today date)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
  v_a public.homework_assignments;
  v_p public.presets;
  v_name text;
  v_given int := 0;
  r record;
begin
  select * into v_a from public.homework_assignments where id = p_assignment_id and academy_id = v_academy;
  if v_a.id is null then
    raise exception 'not_found';
  end if;
  select * into v_p from public.presets where id = p_preset_id and academy_id = v_academy;
  if v_p.id is null then
    raise exception 'no_preset';
  end if;
  if exists (select 1 from public.settlements where class_id = v_a.class_id and settled_on = p_today) then
    return jsonb_build_object('given', 0, 'locked', true);
  end if;
  select display_name into v_name from public.profiles where id = auth.uid();
  for r in
    select t.id as attempt_id, t.student_id
      from public.homework_attempts t
      join public.students s on s.id = t.student_id and s.archived_at is null
     where t.assignment_id = v_a.id and t.finished_at is not null and t.rewarded_at is null
       and t.student_id = any (p_student_ids)
     for update of t
  loop
    insert into public.transactions (academy_id, class_id, student_id, delta, reason, created_by, created_by_name, is_homework)
    values (v_academy, v_a.class_id, r.student_id, v_p.delta, v_p.label, auth.uid(), coalesce(v_name, ''), v_p.is_homework);
    update public.homework_attempts set rewarded_at = now() where id = r.attempt_id;
    v_given := v_given + 1;
  end loop;
  return jsonb_build_object('given', v_given, 'locked', false);
end $$;

-- 결과 화면: 041 과 같고 학생마다 rewarded(포인트 받음)만 더한다
create or replace function public.hw_assignment_summary(p_assignment_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
  v_a public.homework_assignments;
begin
  select * into v_a from public.homework_assignments where id = p_assignment_id and academy_id = v_academy;
  if v_a.id is null then
    raise exception 'not_found';
  end if;
  return jsonb_build_object(
    'target_count', coalesce(v_a.target_count, 0),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'kind', i.kind, 'title', i.title, 'count', jsonb_array_length(coalesce(i.content->'questions', '[]'::jsonb))) order by i.position) from public.homework_items i where i.assignment_id = v_a.id), '[]'::jsonb),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'student_id', s.id, 'name', s.name, 'archived', s.archived_at is not null,
        'status', case when t.id is null then 'none' when t.finished_at is not null then 'done' else 'doing' end,
        'answered', (select count(*) from public.homework_answers h where h.attempt_id = t.id),
        'correct', (select count(*) from public.homework_answers h where h.attempt_id = t.id and h.correct),
        'minutes', case when t.id is null then null else greatest(1, round(extract(epoch from (coalesce(t.finished_at, t.last_seen_at) - t.started_at)) / 60)) end,
        'retries', (select coalesce(sum(x.retry_count), 0) from public.homework_item_attempts x where x.attempt_id = t.id),
        'rewarded', t.rewarded_at is not null,
        'wrong_words', coalesce((select jsonb_agg(distinct h.word) from public.homework_answers h where h.attempt_id = t.id and not h.correct and h.word <> ''), '[]'::jsonb)
      ) order by s.name)
      from public.homework_assignment_targets g
      join public.students s on s.id = g.student_id
      left join public.homework_attempts t on t.assignment_id = v_a.id and t.student_id = s.id
      where g.assignment_id = v_a.id
    ), '[]'::jsonb),
    'class_wrong_words', coalesce((
      select jsonb_agg(jsonb_build_object('word', w.word, 'count', w.n, 'card', w.card) order by w.n desc)
        from (
          select h.word, count(*) as n,
                 (select e.meta from public.learning_events e where e.assignment_id = v_a.id and e.word = h.word and e.meta ? 'meaning' order by e.id desc limit 1) as card
            from public.homework_answers h join public.homework_attempts t on t.id = h.attempt_id
           where t.assignment_id = v_a.id and not h.correct and h.word <> ''
           group by h.word order by count(*) desc limit 15
        ) w
    ), '[]'::jsonb)
  );
end $$;

-- 학부모 리포트용 기간 숫자(30/90일) — 다른 학생과 비교하는 값은 넣지 않는다
create or replace function public.student_report_extras(p_student_id uuid, p_days int default 30)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
  v_days int := case when p_days in (30, 90) then p_days else 30 end;
  v_from timestamptz := now() - make_interval(days => v_days);
  v_s public.students;
begin
  select * into v_s from public.students where id = p_student_id and academy_id = v_academy;
  if v_s.id is null then
    raise exception 'not_found';
  end if;
  return jsonb_build_object(
    'class_name', (select name from public.classes where id = v_s.class_id),
    'attended_days', (select count(*) from public.attendance where student_id = v_s.id and attended_on >= v_from::date and checked_in_at is not null),
    'points_earned', (select coalesce(sum(delta), 0) from public.transactions where student_id = v_s.id and delta > 0 and created_at >= v_from),
    'online_finished', (select count(*) from public.homework_attempts where student_id = v_s.id and finished_at >= v_from)
  );
end $$;

revoke all on function public.hw_reward(uuid, uuid, uuid[], date) from public, anon, authenticated;
revoke all on function public.student_report_extras(uuid, int) from public, anon, authenticated;
revoke all on function public.hw_assignment_summary(uuid) from public, anon, authenticated;
grant execute on function public.hw_reward(uuid, uuid, uuid[], date) to authenticated;
grant execute on function public.student_report_extras(uuid, int) to authenticated;
grant execute on function public.hw_assignment_summary(uuid) to authenticated;
