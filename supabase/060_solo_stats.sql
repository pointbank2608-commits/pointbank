-- 060: 개별수업·복습·시험 기록을 학생 스탯(학습 카드)에 합친다.
--
-- 배경: 학습 카드(student_learning_card)는 숙제(learning_events)만 읽어서, 학생이 하루 종일 하는 개별수업·복습·시험이
--       스탯에 안 잡혔다. 블록(단계 종류)마다 "무슨 능력을 재는지" 이름표를 붙여 같은 능력 5개로 합친다.
--
--  - solo_step_events.skill : 단계가 재는 세부 능력(트리거가 채움, 기존 기록도 채움). 낱말(word)을 기록하는 방식과 같다.
--  - solo_lessons.origin    : 'test_retry' = 시험 틀린 문제 다시 풀기(059). 바로 다시 푸는 것이라 능력 점수에는 넣지 않고 "재도전"에만 센다.
--  - solo_first_answers     : 단계마다 "처음 답"만 골라 낸다(숙제 규칙과 같음). "모르겠어요"를 먼저 눌렀으면 오답으로 센다.
--  - student_skill_events   : 숙제 처음 답 + 개별수업 처음 답을 한 줄로 합친 읽기 전용 함수.
--  - student_learning_card  : 위를 쓰도록 바꿈. 반환 모양은 그대로(+ solo 요약 칸 하나).
--
-- 세부 능력 이름표(단계 종류 → 능력):
--   pickWord        그림이 있으면 vocab.picture, 없으면 vocab.meaning
--   pickMeaning     vocab.meaning        fillBlank   vocab.context     pickPos   vocab.pos
--   spell·typeWord  vocab.spelling
--   listenPick      listening.word       dictation   listening.dictation   lyricBlank  listening.content
--   translatePick   reading.sentence     sayPick     reading.situation
--   unscramble      sentence.order       pickCorrect sentence.correct
--   그 밖(만나기·말하기·역할극·무지개 문법 …)은 점수 없이 이름표도 없다.

-- ---------- 1) 칸 ----------
alter table public.solo_step_events add column if not exists skill text;
alter table public.solo_lessons add column if not exists origin text;

-- ---------- 2) 단계 → 세부 능력 ----------
create or replace function public.solo_step_skill(p jsonb) returns text
language sql immutable set search_path = public
as $$
  select case p->>'t'
    when 'pickWord' then case when nullif(p->>'imageUrl', '') is not null then 'vocab.picture' else 'vocab.meaning' end
    when 'pickMeaning' then 'vocab.meaning'
    when 'fillBlank' then 'vocab.context'
    when 'pickPos' then 'vocab.pos'
    when 'spell' then 'vocab.spelling'
    when 'typeWord' then 'vocab.spelling'
    when 'listenPick' then 'listening.word'
    when 'dictation' then 'listening.dictation'
    when 'lyricBlank' then 'listening.content'
    when 'translatePick' then 'reading.sentence'
    when 'sayPick' then 'reading.situation'
    when 'unscramble' then 'sentence.order'
    when 'pickCorrect' then 'sentence.correct'
    else null
  end
$$;

-- 기록 한 줄이 재는 능력: 그 순간 수업의 단계 내용으로 정한다(시험은 단계 안의 문제에서 찾는다).
create or replace function public.solo_event_skill(p_assignment uuid, p_step int, p_type text, p_word text) returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  v_step jsonb;
  v_item jsonb;
  v_by_type jsonb := jsonb_build_object('t', p_type);
begin
  select x.s into v_step
    from public.solo_assignments a
    join public.solo_lessons l on l.id = a.lesson_id,
         jsonb_array_elements(l.steps) with ordinality as x(s, n)
   where a.id = p_assignment and x.n = p_step + 1;
  if v_step is null then
    return public.solo_step_skill(v_by_type);
  end if;
  if v_step->>'t' = 'test' then
    select i into v_item
      from jsonb_array_elements(coalesce(v_step->'items', '[]'::jsonb)) as x(i)
     where i->>'t' = p_type and (p_word is null or public.solo_step_word(i) = p_word)
     limit 1;
    return coalesce(public.solo_step_skill(v_item), public.solo_step_skill(v_by_type));
  end if;
  -- 기록한 뒤 수업을 고쳐 그 자리 단계가 달라졌으면 종류만으로 정한다
  if v_step->>'t' <> p_type then
    return public.solo_step_skill(v_by_type);
  end if;
  return public.solo_step_skill(v_step);
end $$;

create or replace function public.solo_event_set_skill() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.skill is null and new.kind in ('answer', 'unsure') then
    new.skill := public.solo_event_skill(new.assignment_id, new.step_index, new.step_type, new.word);
  end if;
  return new;
end $$;

drop trigger if exists solo_step_events_skill on public.solo_step_events;
create trigger solo_step_events_skill before insert on public.solo_step_events
  for each row execute function public.solo_event_set_skill();

-- 기존 기록도 채운다(이미 채워진 것은 건드리지 않음)
update public.solo_step_events e
   set skill = public.solo_event_skill(e.assignment_id, e.step_index, e.step_type, e.word)
 where e.skill is null and e.kind in ('answer', 'unsure');

create index if not exists solo_step_events_skill_idx on public.solo_step_events (assignment_id, skill);

-- ---------- 3) 시험 틀린 문제 다시 풀기(059)에 표시를 남긴다 ----------
-- 059 의 함수와 같고, 만드는 수업에 origin = 'test_retry' 만 더했다.
create or replace function public.solo_start_test_retry(p_token uuid, p_assignment uuid, p_step int, p_name text, p_intro text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_a public.solo_assignments;
  v_st public.students;
  v_step jsonb;
  v_res public.solo_test_results;
  v_steps jsonb;
  v_count int;
  v_lesson uuid;
  v_new uuid;
begin
  begin
    v_a := public.solo_assignment_for(p_token, p_assignment);
  exception when others then
    return jsonb_build_object('error', case when sqlerrm like '%expired%' then 'expired' else 'not_found' end);
  end;
  select * into v_st from public.students where id = v_a.student_id;
  select s into v_step from public.solo_lessons l, jsonb_array_elements(l.steps) with ordinality as x(s, n)
   where l.id = v_a.lesson_id and n = p_step + 1;
  select * into v_res from public.solo_test_results where assignment_id = v_a.id and step_index = p_step;
  if v_step is null or v_step->>'t' <> 'test' or v_res.id is null then
    return jsonb_build_object('error', 'not_found');
  end if;

  -- 틀린 문제만(결과의 items[i].correct = false), 순서를 섞고 보기도 다시 섞는다
  select coalesce(jsonb_agg(public.solo_reshuffle(i - 'area' - 'sec') order by random()), '[]'::jsonb), count(*)
    into v_steps, v_count
    from jsonb_array_elements(coalesce(v_step->'items', '[]'::jsonb)) with ordinality as x(i, n)
   where coalesce((v_res.result->'items'->((n - 1)::int)->>'correct')::boolean, false) = false
     and i->>'t' <> 'test';
  if v_count = 0 then
    return jsonb_build_object('empty', true);
  end if;

  -- 하루에 너무 많이 만들지 않게(057 복습과 같은 한도)
  if (select count(*) from public.solo_assignments where student_id = v_st.id and kind = 'review' and assigned_at > now() - interval '1 day') >= 30 then
    return jsonb_build_object('error', 'too_many');
  end if;
  -- 끝내지 않은 예전 복습은 지운다(057 과 같은 규칙)
  delete from public.solo_lessons l
   using public.solo_assignments a
   where a.lesson_id = l.id and a.student_id = v_st.id and a.kind = 'review' and a.finished_at is null and l.source = 'review';

  v_steps := jsonb_build_array(jsonb_build_object(
    't', 'intro',
    'title', left(coalesce(nullif(btrim(p_name), ''), '틀린 문제 다시 풀기'), 60),
    'text', left(coalesce(nullif(btrim(p_intro), ''), ''), 200))) || v_steps;

  insert into public.solo_lessons (academy_id, class_id, name, level, minutes, steps, source, origin, created_by)
  values (v_st.academy_id, v_st.class_id, left(coalesce(nullif(btrim(p_name), ''), '틀린 문제 다시 풀기'), 60), null,
          greatest(1, least(v_count, 30)), v_steps, 'review', 'test_retry', null)
  returning id into v_lesson;
  insert into public.solo_assignments (academy_id, lesson_id, student_id, kind, started_at)
  values (v_st.academy_id, v_lesson, v_st.id, 'review', now())
  returning id into v_new;
  return jsonb_build_object('assignment', v_new, 'count', v_count);
end $$;

-- ---------- 4) 처음 답만 골라 내기 ----------
-- 단계마다 첫 번째 답(또는 "모르겠어요")만 능력 점수가 된다. 다시 시도한 답은 재도전으로만 센다.
-- 시험 단계는 문제마다 기록이 한 줄이라 그대로 모두 처음 답이다.
create or replace function public.solo_first_answers(p_student uuid, p_since timestamptz)
returns table (skill text, ok boolean, created_at timestamptz, word text, retry boolean, is_test boolean, attempt_no int, kind text)
language sql stable security definer set search_path = public
as $$
  select q.skill, q.ok, q.created_at, q.word, q.retry, q.is_test, q.rn::int, q.kind
    from (
      select e.skill,
             case when e.kind = 'unsure' then false else e.correct end as ok,
             e.created_at,
             e.word,
             coalesce(l.origin, '') = 'test_retry' as retry,
             (t.assignment_id is not null) as is_test,
             e.kind,
             row_number() over (partition by e.assignment_id, e.step_index order by e.id) as rn
        from public.solo_step_events e
        join public.solo_assignments a on a.id = e.assignment_id
        join public.solo_lessons l on l.id = a.lesson_id
        left join public.solo_test_results t on t.assignment_id = e.assignment_id and t.step_index = e.step_index
       where a.student_id = p_student and e.kind in ('answer', 'unsure') and e.step_type <> 'test'
    ) q
   where q.created_at >= p_since
$$;

-- ---------- 5) 능력 점수 재료: 숙제 처음 답 + 개별수업 처음 답 ----------
create or replace function public.student_skill_events(p_student uuid, p_since timestamptz)
returns table (skill text, correct boolean, created_at timestamptz, word text, src text)
language sql stable security definer set search_path = public
as $$
  select e.skill, e.correct, e.created_at, e.word, 'homework'::text
    from public.learning_events e
   where e.student_id = p_student and e.event_type = 'answer' and e.correct is not null and e.skill is not null
     and e.created_at >= p_since
  union all
  select f.skill, f.ok, f.created_at, f.word, 'solo'::text
    from public.solo_first_answers(p_student, p_since) f
   where not f.retry and (f.is_test or f.attempt_no = 1) and f.skill is not null and f.ok is not null
$$;

-- ---------- 6) 학습 카드(041 의 함수를 바꿈) ----------
-- 가중치(최근을 조금 더): 7일 안 1.0, 30일 안 0.75, 그보다 오래 0.5. 처음 답만 센다 — 다시 풀기는 따로.
-- 달라진 점: 능력 점수·채점 수·틀린 낱말에 개별수업·복습·시험이 들어오고, 끝낸 활동·숙제 완료율·재도전에도 반영된다.
create or replace function public.student_learning_card(p_student_id uuid, p_days int default 30)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
  v_days int := case when p_days in (30, 90) then p_days else 30 end;
  v_from timestamptz := now() - make_interval(days => v_days);
  v_prev timestamptz := now() - make_interval(days => v_days * 2);
  v_s public.students;
begin
  select * into v_s from public.students where id = p_student_id and academy_id = v_academy;
  if v_s.id is null then
    raise exception 'not_found';
  end if;
  return jsonb_build_object(
    'student', jsonb_build_object('id', v_s.id, 'name', v_s.name, 'archived', v_s.archived_at is not null),
    'days', v_days,
    'graded', (select count(*) from public.student_skill_events(v_s.id, v_from)),
    'completed_activities',
      (select count(*) from public.homework_item_attempts x join public.homework_attempts t on t.id = x.attempt_id where t.student_id = v_s.id and x.finished_at >= v_from)
      + (select count(*) from public.solo_assignments a where a.student_id = v_s.id and a.finished_at >= v_from),
    'skills', coalesce((
      select jsonb_agg(jsonb_build_object('skill', c.skill, 'n', c.n, 'correct', c.k, 'weighted', c.w, 'prev_n', coalesce(p.n, 0), 'prev_correct', coalesce(p.k, 0)) order by c.skill)
        from (
          select skill, count(*) as n, count(*) filter (where correct) as k,
                 round((sum(case when correct then wt else 0 end) / nullif(sum(wt), 0))::numeric, 3) as w
            from (
              select ev.skill, ev.correct,
                     case when ev.created_at > now() - interval '7 days' then 1.0 when ev.created_at > now() - interval '30 days' then 0.75 else 0.5 end as wt
                from public.student_skill_events(v_s.id, v_from) ev
            ) z group by skill
        ) c
        left join (
          select ev.skill, count(*) as n, count(*) filter (where ev.correct) as k
            from public.student_skill_events(v_s.id, v_prev) ev
           where ev.created_at < v_from
           group by ev.skill
        ) p on p.skill = c.skill
    ), '[]'::jsonb),
    'habit', jsonb_build_object(
      'assigned',
        (select count(*) from public.homework_assignment_targets g join public.homework_assignments a on a.id = g.assignment_id where g.student_id = v_s.id and a.created_at >= v_from)
        + (select count(*) from public.solo_assignments a where a.student_id = v_s.id and a.kind = 'homework' and a.assigned_at >= v_from),
      'finished',
        (select count(*) from public.homework_attempts t join public.homework_assignments a on a.id = t.assignment_id where t.student_id = v_s.id and a.created_at >= v_from and t.finished_at is not null)
        + (select count(*) from public.solo_assignments a where a.student_id = v_s.id and a.kind = 'homework' and a.assigned_at >= v_from and a.finished_at is not null),
      'prev_assigned',
        (select count(*) from public.homework_assignment_targets g join public.homework_assignments a on a.id = g.assignment_id where g.student_id = v_s.id and a.created_at >= v_prev and a.created_at < v_from)
        + (select count(*) from public.solo_assignments a where a.student_id = v_s.id and a.kind = 'homework' and a.assigned_at >= v_prev and a.assigned_at < v_from),
      'prev_finished',
        (select count(*) from public.homework_attempts t join public.homework_assignments a on a.id = t.assignment_id where t.student_id = v_s.id and a.created_at >= v_prev and a.created_at < v_from and t.finished_at is not null)
        + (select count(*) from public.solo_assignments a where a.student_id = v_s.id and a.kind = 'homework' and a.assigned_at >= v_prev and a.assigned_at < v_from and a.finished_at is not null)
    ),
    -- 다시 풀기: 숙제의 retry_answer + 개별수업에서 같은 단계를 다시 푼 답(두 번째부터) + 시험 틀린 문제 다시 풀기
    'retries', jsonb_build_object(
      'count',
        (select count(*) from public.learning_events where student_id = v_s.id and event_type = 'retry_answer' and created_at >= v_from)
        + (select count(*) from public.solo_first_answers(v_s.id, v_from) f where f.kind = 'answer' and not f.is_test and (f.retry or f.attempt_no >= 2)),
      'corrected',
        (select count(*) from public.learning_events where student_id = v_s.id and event_type = 'retry_answer' and correct and created_at >= v_from)
        + (select count(*) from public.solo_first_answers(v_s.id, v_from) f where f.kind = 'answer' and not f.is_test and (f.retry or f.attempt_no >= 2) and f.ok)
    ),
    'shadowing', jsonb_build_object(
      'lines', (select count(*) from public.learning_events where student_id = v_s.id and event_type = 'shadow_line' and created_at >= v_from),
      'listens', (select coalesce(sum((meta->>'listens')::int), 0) from public.learning_events where student_id = v_s.id and event_type = 'shadow_line' and created_at >= v_from)
    ),
    'wrong_words', coalesce((
      select jsonb_agg(jsonb_build_object('word', w.word, 'count', w.n, 'skills', w.skills) order by w.n desc)
        from (
          select min(ev.word) as word, count(*) as n, jsonb_agg(distinct ev.skill) as skills
            from public.student_skill_events(v_s.id, v_from) ev
           where ev.correct = false and coalesce(ev.word, '') <> ''
           group by lower(btrim(ev.word)) order by count(*) desc limit 12
        ) w
    ), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'created_at', a.created_at, 'kind', a.kind,
               'status', case when t.id is null then 'none' when t.finished_at is not null then 'done' else 'doing' end,
               'score', t.score, 'total', t.total) order by a.created_at desc)
        from (select * from public.homework_assignment_targets where student_id = v_s.id) g
        join public.homework_assignments a on a.id = g.assignment_id
        left join public.homework_attempts t on t.assignment_id = a.id and t.student_id = v_s.id
       where a.created_at >= now() - interval '90 days'
    ), '[]'::jsonb),
    -- 통장 "숙제 완료/미제출" 버튼 기록(온라인 숙제와 따로 보여 준다, 합치지 않는다)
    'passbook_homework', jsonb_build_object(
      'done', (select count(*) from public.transactions where student_id = v_s.id and is_homework and delta > 0 and created_at >= v_from),
      'missing', (select count(*) from public.transactions where student_id = v_s.id and is_homework and delta < 0 and created_at >= v_from)
    ),
    -- 개별수업(오늘의 수업·숙제·복습·시험)에서 온 채점 수와 끝낸 수업 수 — 화면에서 출처를 작게 보여 줄 때 쓴다
    'solo', jsonb_build_object(
      'graded', (select count(*) from public.student_skill_events(v_s.id, v_from) ev where ev.src = 'solo'),
      'finished', (select count(*) from public.solo_assignments a where a.student_id = v_s.id and a.finished_at >= v_from)
    )
  );
end $$;

-- ---------- 7) 권한 ----------
-- 안쪽 도우미는 바깥에서 못 부른다(학습 카드·트리거가 소유자 권한으로 쓴다)
revoke all on function public.solo_step_skill(jsonb) from public, anon, authenticated;
revoke all on function public.solo_event_skill(uuid, int, text, text) from public, anon, authenticated;
revoke all on function public.solo_event_set_skill() from public, anon, authenticated;
revoke all on function public.solo_first_answers(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.student_skill_events(uuid, timestamptz) from public, anon, authenticated;
-- create or replace 는 권한을 그대로 두지만 확실히 해 둔다
revoke all on function public.solo_start_test_retry(uuid, uuid, int, text, text) from public;
grant execute on function public.solo_start_test_retry(uuid, uuid, int, text, text) to anon, authenticated;
revoke all on function public.student_learning_card(uuid, int) from public, anon;
grant execute on function public.student_learning_card(uuid, int) to authenticated;
