select to_regclass('public.learning_homework_plans') is not null as plans_exist,
 (select relrowsecurity from pg_class where oid='public.learning_homework_plans'::regclass) as plans_rls,
 not has_table_privilege('anon','public.learning_homework_plans','SELECT') and not has_table_privilege('authenticated','public.learning_homework_plans','SELECT') as approval_private,
 not has_function_privilege('anon','public.learning_homework_assign(uuid,uuid,uuid[],text,jsonb,text,int,timestamptz,text,uuid)','EXECUTE') as student_cannot_assign,
 has_function_privilege('authenticated','public.learning_homework_assign(uuid,uuid,uuid[],text,jsonb,text,int,timestamptz,text,uuid)','EXECUTE') as teacher_can_assign,
 position('public.learning_homework_guard(' in pg_get_functiondef('public.solo_assignment_for(uuid,uuid)'::regprocedure))>0 as homework_gate_intact,
 public.learning_path_compat_problems()='{}' as path_wrappers_intact,
 not has_function_privilege('anon','public.admin_learning_homework_summary(int)','EXECUTE') as admin_summary_private,
 exists(select 1 from pg_trigger where tgrelid='public.learning_delivery_runs'::regclass and tgname='learning_homework_run_mode' and tgenabled='O') as run_mode_frozen;
