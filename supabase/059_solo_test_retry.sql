-- ============================================================
-- 059 시험 블록 "틀린 것 다시 풀기"(2026-10-12)
--
-- 학생이 시험 결과 화면에서 누르면, 그 시험에서 틀린 문제만으로 복습 수업(kind = 'review')을 만든다.
-- 문제는 서버가 시험 결과(solo_test_results)와 수업 단계에서 직접 꺼낸다 — 학생이 내용을 보낼 수 없다.
-- 복습 수업은 일반 수업 단계처럼 진행된다(바로 채점·한 번 틀리면 다시·두 번 틀리면 정답·모르겠어요).
-- 보기 순서와 문장 조각 순서는 다시 섞고, 문제 순서도 섞는다. 선생님은 "복습·누적 테스트 결과"에서 본다.
-- 실행: 058 다음에 이 파일 하나. 끝의 select 가 모두 true 여야 한다.
-- ============================================================

-- 문제 하나의 보기·조각 순서를 섞는다(정답 번호·그림 순서도 같이)
create or replace function public.solo_reshuffle(p_item jsonb) returns jsonb
language plpgsql volatile set search_path = public
as $$
declare
  v_n int;
  v_perm int[];
  v_out jsonb := p_item;
begin
  if p_item ? 'options' and p_item ? 'answer' and jsonb_typeof(p_item->'options') = 'array' then
    v_n := jsonb_array_length(p_item->'options');
    if v_n >= 2 then
      select array_agg(i order by random()) into v_perm from generate_series(0, v_n - 1) as g(i);
      v_out := jsonb_set(v_out, '{options}', (select jsonb_agg(p_item->'options'->(v_perm[k]) order by k) from generate_subscripts(v_perm, 1) as s(k)));
      v_out := jsonb_set(v_out, '{answer}', to_jsonb(array_position(v_perm, (p_item->>'answer')::int) - 1));
      if p_item ? 'images' and jsonb_typeof(p_item->'images') = 'array' and jsonb_array_length(p_item->'images') = v_n then
        v_out := jsonb_set(v_out, '{images}', (select jsonb_agg(p_item->'images'->(v_perm[k]) order by k) from generate_subscripts(v_perm, 1) as s(k)));
      end if;
    end if;
  elsif p_item->>'t' in ('unscramble', 'spell') then
    if p_item->>'t' = 'unscramble' and jsonb_typeof(p_item->'words') = 'array' then
      v_out := jsonb_set(v_out, '{words}', (select coalesce(jsonb_agg(w order by random()), '[]'::jsonb) from jsonb_array_elements(p_item->'words') as x(w)));
    elsif p_item->>'t' = 'spell' and jsonb_typeof(p_item->'letters') = 'array' then
      v_out := jsonb_set(v_out, '{letters}', (select coalesce(jsonb_agg(w order by random()), '[]'::jsonb) from jsonb_array_elements(p_item->'letters') as x(w)));
    end if;
  end if;
  return v_out;
end $$;

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

  insert into public.solo_lessons (academy_id, class_id, name, level, minutes, steps, source, created_by)
  values (v_st.academy_id, v_st.class_id, left(coalesce(nullif(btrim(p_name), ''), '틀린 문제 다시 풀기'), 60), null,
          greatest(1, least(v_count, 30)), v_steps, 'review', null)
  returning id into v_lesson;
  insert into public.solo_assignments (academy_id, lesson_id, student_id, kind, started_at)
  values (v_st.academy_id, v_lesson, v_st.id, 'review', now())
  returning id into v_new;
  return jsonb_build_object('assignment', v_new, 'count', v_count);
end $$;

revoke all on function public.solo_reshuffle(jsonb) from public, anon, authenticated;
revoke all on function public.solo_start_test_retry(uuid, uuid, int, text, text) from public, anon, authenticated;
grant execute on function public.solo_start_test_retry(uuid, uuid, int, text, text) to anon, authenticated;

-- 확인(읽기 전용): 모두 true 여야 한다
with s as (
  select public.solo_reshuffle('{"t":"listenPick","word":"dog","options":["cat","dog","pig","cow"],"images":["c","d","p","w"],"answer":1}'::jsonb) as j
)
select
  (select count(*) from pg_proc where proname in ('solo_reshuffle', 'solo_start_test_retry')) = 2 as functions_ok,
  (select j->'options'->>((j->>'answer')::int) from s) = 'dog' as answer_follows_shuffle,
  (select j->'images'->>((j->>'answer')::int) from s) = 'd' as image_follows_shuffle,
  (select jsonb_array_length(public.solo_reshuffle('{"t":"unscramble","sentence":"I like red apples","words":["I","like","red","apples"]}'::jsonb)->'words')) = 4 as unscramble_ok;
