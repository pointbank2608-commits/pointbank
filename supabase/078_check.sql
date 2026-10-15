-- 078 확인(읽기 전용): 표·함수가 다 있는지
select
  to_regclass('public.client_errors') is not null as errors_table,
  exists (select 1 from pg_proc where proname = 'report_client_error') as report_fn,
  exists (select 1 from pg_proc where proname = 'admin_error_summary') as summary_fn,
  exists (select 1 from pg_proc where proname = 'admin_weekly_report') as weekly_fn,
  exists (select 1 from pg_proc where proname = 'ops_health_tick') as tick_fn,
  exists (select 1 from information_schema.columns
           where table_name = 'announcements' and column_name = 'auto_key') as auto_key_col;
