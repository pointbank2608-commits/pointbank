-- 047 확인용(읽기만 함): 표 3개·함수 13개가 생겼는지, 학생이 표를 직접 못 읽는지
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('solo_lessons', 'solo_assignments', 'solo_step_events')) as tables_3,
  (select count(*) from pg_proc where proname in ('solo_open', 'solo_answer', 'solo_advance', 'solo_reveal', 'solo_assign', 'solo_status', 'solo_list', 'solo_grade', 'solo_public_step', 'solo_correct_text', 'solo_norm', 'solo_assignment_for')) as functions_12,
  not has_table_privilege('anon', 'public.solo_lessons', 'select') as lessons_hidden_from_anon,
  not has_table_privilege('anon', 'public.solo_step_events', 'select') as events_hidden_from_anon,
  -- 정답이 학생에게 가는 단계에서 빠지는지(미리 만든 시험 단계로 확인)
  (public.solo_public_step('{"t":"pickWord","options":["a","b"],"answer":1}'::jsonb) ? 'answer') = false as answer_stripped,
  public.solo_grade('{"t":"spell","word":"Apple"}'::jsonb, ' apple ') as spell_grade_true;
