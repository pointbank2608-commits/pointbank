-- 096 확인(읽기 전용): 새 함수 6개·조정 칸·기록 표가 있는지, 새 함수를 익명이 못 부르는지.
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
    and p.proname in ('wm_plan_briefing', 'wm_plan_steps', 'wm_apply_step', 'wm_plan_progress', 'wm_plan_cards', 'wm_plan_weak_cards')) as new_functions_6,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'wm_targets' and column_name in ('mode_override', 'focus_skill')) as target_columns_2,
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'wm_step_log') as step_log_1,
  has_function_privilege('anon', 'public.wm_plan_progress(uuid)', 'execute') as anon_progress_should_be_false,
  has_function_privilege('anon', 'public.wm_apply_step(uuid,uuid,text)', 'execute') as anon_apply_should_be_false,
  has_function_privilege('authenticated', 'public.wm_plan_briefing(uuid)', 'execute') as teacher_briefing_should_be_true,
  position($q$'plus'$q$ in pg_get_functiondef('public.wm_assign(uuid,uuid,text,jsonb,jsonb,uuid[],text,int,int)'::regprocedure)) > 0 as assign_has_plus_should_be_true;
