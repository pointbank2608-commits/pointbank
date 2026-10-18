-- 088a -> 088b 실행 후. 모두 true 여야 한다. 운영 학습 기록은 읽거나 만들지 않는다.
select
  to_regclass('public.solo_game_checks') is not null as checks_table_ok,
  to_regclass('public.solo_personal_starts') is not null as personal_starts_ok,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='learning_events' and column_name='solo_assignment_id') as event_link_ok,
  to_regprocedure('public.solo_game_check_open(uuid,uuid,integer)') is not null as open_function_ok,
  to_regprocedure('public.solo_game_check_answer(uuid,uuid,integer,integer,text,uuid)') is not null as answer_function_ok,
  to_regprocedure('public.solo_start_personal_game(uuid,uuid)') is not null as personal_review_ok,
  to_regprocedure('public.student_game_growth(uuid,integer)') is not null as growth_function_ok,
  to_regprocedure('public.solo_game_results(uuid)') is not null as teacher_game_results_ok,
  not has_table_privilege('anon','public.solo_game_checks','select') as answers_hidden,
  not has_table_privilege('authenticated','public.solo_game_checks','update') as student_cannot_edit_checks,
  (select relrowsecurity from pg_class where oid='public.solo_game_checks'::regclass) as checks_rls_on,
  not has_function_privilege('anon','public.solo_game_check_state(uuid)','execute') as internal_helper_hidden,
  has_function_privilege('anon','public.solo_game_check_open(uuid,uuid,integer)','execute') as token_open_enabled,
  has_function_privilege('anon','public.solo_start_personal_game(uuid,uuid)','execute') as token_review_enabled,
  not has_function_privilege('anon','public.student_game_growth(uuid,integer)','execute') as teacher_growth_only,
  not has_function_privilege('anon','public.student_review_candidates(uuid)','execute') as teacher_recommend_only,
  not (public.solo_public_step('{"t":"typeWord","word":"apple","meaning":"사과","length":5,"first":""}'::jsonb) ? 'word') as spelling_answer_hidden;
