-- Read-only. True columns expected after 097. Does not verify browser collection or effectiveness.
select to_regclass('public.learning_sensor_events') is not null as events_exist,
  to_regclass('public.learning_sensor_snapshots') is not null as snapshots_exist,
  to_regclass('public.learning_sensor_outcomes') is not null as outcomes_exist,
  not has_table_privilege('anon','public.learning_sensor_events','SELECT') as anon_cannot_read,
  not has_table_privilege('authenticated','public.learning_sensor_outcomes','SELECT') as private_outcomes,
  has_function_privilege('anon','public.learning_sensor_report(text,text,uuid,jsonb)','EXECUTE') as student_rpc_exists,
  not has_function_privilege('anon','public.admin_learning_sensor_summary(int)','EXECUTE') as admin_rpc_private;
