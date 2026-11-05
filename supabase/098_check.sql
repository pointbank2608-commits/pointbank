select to_regclass('public.learning_delivery_runs') is not null as runs_exist,
 to_regclass('public.learning_solo_versions') is not null as frozen_versions_exist,
 not has_table_privilege('anon','public.learning_sensor_snapshots','SELECT') as answers_private,
 not has_table_privilege('authenticated','public.learning_delivery_items','SELECT') as goals_private,
 has_function_privilege('anon','public.learning_run_open(text,text,uuid)','EXECUTE') as open_enabled,
 has_function_privilege('anon','public.learning_run_action(uuid,text,int,text,jsonb)','EXECUTE') as action_enabled,
 not has_function_privilege('anon','public.learning_solo_action(uuid,int,text,jsonb)','EXECUTE') as inner_grader_private;
