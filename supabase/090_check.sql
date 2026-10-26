-- 090 확인(읽기 전용): 표 5개·함수 모두 만들어졌는지, 표 직접 접근이 막혀 있는지.
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('wm_plans', 'wm_targets', 'wm_words', 'wm_sessions', 'wm_answers')) as tables_5,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in
     ('wm_assign', 'wm_open', 'wm_today_state', 'wm_ack', 'wm_hint', 'wm_answer', 'wm_collection', 'wm_plan_list', 'wm_plan_results', 'wm_plan_links', 'wm_plan_close', 'wm_student_links')) as public_functions_12,
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname like 'wm\_%' and c.relkind = 'r' and c.relrowsecurity) as rls_tables_5,
  has_table_privilege('anon', 'public.wm_words', 'select') as anon_can_read_words_should_be_false,
  has_function_privilege('anon', 'public.wm_assign(uuid,uuid,text,jsonb,jsonb,uuid[],text,int,int)', 'execute') as anon_can_assign_should_be_false;
