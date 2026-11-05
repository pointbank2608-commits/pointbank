select to_regclass('public.learning_path_states') is not null as states_exist,
 not has_table_privilege('anon','public.learning_path_checks','SELECT') as student_records_private,
 not has_function_privilege('anon','public.learning_path_assign(uuid,uuid,uuid[],text,jsonb,text)','EXECUTE') as student_cannot_assign,
 has_function_privilege('authenticated','public.learning_path_assign(uuid,uuid,uuid[],text,jsonb,text)','EXECUTE') as teacher_assign_enabled,
 has_function_privilege('anon','public.learning_path_action(uuid,uuid,uuid,int,text,text)','EXECUTE') as learner_actions_enabled,
 to_regprocedure('public.solo_open_before_paths(uuid,uuid)') is not null as legacy_solo_preserved,
 to_regprocedure('public.student_home_before_paths(uuid)') is not null as legacy_portal_preserved,
 public.learning_path_compat_problems() = '{}' as compat_boundary_intact,
 (select count(*) from public.learning_path_compat) = 6 as compat_registry_complete,
 not has_function_privilege('anon','public.learning_path_adopt_legacy(text,text)','EXECUTE')
   and not has_function_privilege('authenticated','public.learning_path_adopt_legacy(text,text)','EXECUTE') as adopt_and_wrap_private,
 not has_function_privilege('anon','public.learning_path_compat_problems()','EXECUTE') as compat_internals_private;
